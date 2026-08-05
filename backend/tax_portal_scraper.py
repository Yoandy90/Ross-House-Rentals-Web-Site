"""
Tax Portal Scraper v2 - Complete automated login and client data extraction
from mytaxoffice.com

Flow:
1. Navigate to login page
2. Fill credentials in iframe
3. Click LOGIN
4. Solve the Security Challenge CAPTCHA using LLM
5. Navigate to client list
6. Extract client data + bank info
"""

import asyncio
import base64
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

# ── Configuration ──────────────────────────────────────────
LOGIN_URL = "https://www.mytaxoffice.com/main/pro/Taxseason_Login.php"
FIRM_ID = "90090829983"
USERNAME = "Yoandy Ross"
PASSWORD = "Interpol.1990"
EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
OUTPUT_DIR = "/tmp/tax_portal_data"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


async def solve_challenge_with_llm(challenge_text: str) -> str:
    """Use LLM to solve the security challenge text."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"captcha-{datetime.now().timestamp()}",
        system_message=(
            "You are a challenge solver. You will be given a challenge prompt with some words. "
            "Your job is to identify the correct answer. Examples:\n"
            "- 'Type fruit / vegetable name from given words: papaya slier raked' → answer: papaya\n"
            "- 'Type animal name from given words: dog xylz pqrs' → answer: dog\n"
            "- 'Solve: 86 + 6 = ?' → answer: 92\n"
            "- 'Type the number: seven' → answer: 7\n"
            "IMPORTANT: Return ONLY the answer word or number. No quotes, no explanation. "
            "Ignore any special characters, numbers, and spaces in the words when identifying them."
        ),
    )
    chat.with_model("openai", "gpt-4o")

    user_message = UserMessage(
        text=f"Solve this challenge: {challenge_text}"
    )

    response = await chat.send_message(user_message)
    answer = response.strip().strip('"').strip("'").lower()
    print(f"[LLM] Challenge: {challenge_text}")
    print(f"[LLM] Answer: {answer}")
    return answer


async def solve_challenge_with_vision(image_path: str) -> str:
    """Fallback: Use Vision API to solve image-based CAPTCHA."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"captcha-vis-{datetime.now().timestamp()}",
        system_message=(
            "You are a CAPTCHA solver. Analyze the image and determine the answer. "
            "If it's text like 'Type fruit / vegetable name from given words' with words listed, "
            "identify which word is a fruit/vegetable/animal etc. "
            "If it's a math equation, solve it. "
            "Return ONLY the answer, nothing else."
        ),
    )
    chat.with_model("openai", "gpt-4o")

    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    user_message = UserMessage(
        text="Solve this CAPTCHA. Return ONLY the answer.",
        file_contents=[ImageContent(image_base64=image_b64)],
    )

    response = await chat.send_message(user_message)
    return response.strip().strip('"').strip("'").lower()


async def login_and_scrape():
    """Main automation flow."""
    print("=" * 60)
    print("Tax Portal Scraper v2")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)

    if not EMERGENT_KEY:
        print("[ERROR] EMERGENT_LLM_KEY not set")
        sys.exit(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()

        try:
            # ─── STEP 1: Navigate to login page ───
            print("\n[STEP 1] Navigating to login page...")
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            # Check for initial robot/cloudflare captcha
            content = await page.content()
            if "might be a robot" in content:
                print("[INFO] Cloudflare robot check detected - attempting bypass...")
                # Handle the text captcha if present
                captcha_img = page.locator("img").first
                captcha_path = f"{OUTPUT_DIR}/cf_captcha.png"
                await captcha_img.screenshot(path=captcha_path)
                answer = await solve_challenge_with_vision(captcha_path)
                await page.locator("input[type='text']").first.fill(answer)
                await page.locator("text=CONTINUE").click()
                await asyncio.sleep(5)
                # Re-navigate to login
                await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(3)

            # ─── STEP 2: Find login iframe and fill credentials ───
            print("\n[STEP 2] Filling login credentials...")
            login_frame = None
            for frame in page.frames:
                if "cobrandLogin" in frame.url:
                    login_frame = frame
                    break

            if not login_frame:
                print("[ERROR] Login iframe not found!")
                await page.screenshot(path=f"{OUTPUT_DIR}/error_no_frame.png")
                return False

            print(f"[INFO] Found login frame: {login_frame.url[:80]}")

            # Account Name = Firm number, Firm Name = Person's name
            await login_frame.locator("#id_input-username").fill(FIRM_ID)
            print(f"[OK] Account Name: {FIRM_ID}")

            await login_frame.locator("#id_input-passwrd").fill(PASSWORD)
            print("[OK] Password: ***")

            await login_frame.locator("#id_input-firmName").fill(USERNAME)
            print(f"[OK] Firm Name: {USERNAME}")

            await asyncio.sleep(1)

            # ─── STEP 3: Click LOGIN ───
            print("\n[STEP 3] Clicking LOGIN...")
            await login_frame.locator("#LoginButton").click(force=True)
            await asyncio.sleep(5)

            # ─── STEP 4: Handle Security Challenge CAPTCHA ───
            print("\n[STEP 4] Looking for Security Challenge...")
            await page.screenshot(path=f"{OUTPUT_DIR}/after_login_click.png")

            captcha_frame = None
            for frame in page.frames:
                # Target the OLTPRO_captcha frame, NOT the reCAPTCHA frame
                if "OLTPRO_captcha" in frame.url or "oltpro_captcha" in frame.url.lower():
                    captcha_frame = frame
                    break
            
            # If OLTPRO not found, check for any custom captcha frame (not recaptcha)
            if not captcha_frame:
                for frame in page.frames:
                    url = frame.url.lower()
                    if "captcha" in url and "recaptcha" not in url and "about:blank" not in url:
                        captcha_frame = frame
                        break

            if not captcha_frame:
                print("[INFO] No captcha frame found - might have logged in directly")
            else:
                print(f"[INFO] Captcha frame: {captcha_frame.url[:80]}")

                # Try to extract challenge text from DOM
                challenge_text = ""
                try:
                    body_text = await captcha_frame.locator("body").text_content()
                    print(f"[DEBUG] Captcha body text: {body_text[:300]}")
                    challenge_text = body_text.strip()
                except Exception as e:
                    print(f"[WARN] Could not get captcha text: {e}")

                # Also try to get the image
                captcha_imgs = await captcha_frame.locator("img").all()
                captcha_path = f"{OUTPUT_DIR}/captcha_challenge.png"

                if captcha_imgs:
                    img = captcha_imgs[0]
                    src = await img.get_attribute("src") or ""
                    if src.startswith("data:image"):
                        b64_data = src.split(",", 1)[1]
                        with open(captcha_path, "wb") as f:
                            f.write(base64.b64decode(b64_data))
                        print(f"[INFO] Saved captcha image (base64)")
                    else:
                        await img.screenshot(path=captcha_path)
                        print(f"[INFO] Saved captcha screenshot")

                # Solve the challenge using vision API on the captcha image
                answer = ""
                if os.path.exists(captcha_path):
                    print("[INFO] Using Vision API to solve captcha image...")
                    answer = await solve_challenge_with_vision(captcha_path)
                else:
                    # Fallback: try text-based solving from DOM
                    if challenge_text:
                        lines = [l.strip() for l in challenge_text.split("\n") if l.strip()]
                        challenge_clean = ""
                        for line in lines:
                            if any(
                                kw in line.lower()
                                for kw in [
                                    "type fruit", "type animal", "type the",
                                    "solve", "what is", "type vegetable",
                                ]
                            ):
                                challenge_clean = line
                                break
                        if challenge_clean:
                            answer = await solve_challenge_with_llm(challenge_clean)

                if answer:
                    # Find the input field in captcha frame
                    captcha_input = captcha_frame.locator(
                        "input[type='text'], input[placeholder*='correct'], input[placeholder*='answer']"
                    )
                    if await captcha_input.count() > 0:
                        await captcha_input.first.fill(answer)
                        print(f"[OK] Filled captcha answer: {answer}")
                    else:
                        # Try any visible input
                        all_inputs = await captcha_frame.locator("input:visible").all()
                        for inp in all_inputs:
                            inp_type = await inp.get_attribute("type") or "text"
                            if inp_type in ("text", ""):
                                await inp.fill(answer)
                                print(f"[OK] Filled captcha input: {answer}")
                                break

                    await asyncio.sleep(1)

                    # Click Submit
                    submit_btn = captcha_frame.locator(
                        "input[type='submit'], button:has-text('Submit'), input[value='Submit']"
                    )
                    if await submit_btn.count() > 0:
                        await submit_btn.first.click(force=True)
                        print("[OK] Clicked Submit")
                    else:
                        print("[WARN] Submit button not found, trying Enter")
                        await captcha_input.first.press("Enter")

                    await asyncio.sleep(8)
                else:
                    print("[ERROR] Could not solve captcha")
                    return False

            # ─── STEP 5: Verify login success / re-enter credentials ───
            print("\n[STEP 5] Verifying login...")
            await page.screenshot(path=f"{OUTPUT_DIR}/post_captcha.png")
            print(f"[INFO] Current URL: {page.url}")

            # Check if we need to re-enter credentials (form may have been cleared after captcha)
            logged_in = False
            
            # Re-find login frame to check state
            login_frame_check = None
            for frame in page.frames:
                if "cobrandLogin" in frame.url:
                    login_frame_check = frame
                    break

            if login_frame_check:
                try:
                    body_text = await login_frame_check.locator("body").text_content()
                    body_clean = " ".join(body_text.split())[:300] if body_text else ""
                    print(f"[INFO] Login frame state: {body_clean[:150]}")
                    
                    if "does not match" in body_clean.lower() or "step 1" in body_clean.lower():
                        print("[INFO] Credentials rejected or form reset - re-entering credentials...")
                        
                        # Clear and re-fill credentials (Account Name = Firm number)
                        username_field = login_frame_check.locator("#id_input-username")
                        await username_field.fill("")
                        await username_field.fill(FIRM_ID)
                        
                        password_field = login_frame_check.locator("#id_input-passwrd")
                        await password_field.fill("")
                        await password_field.fill(PASSWORD)
                        
                        firm_field = login_frame_check.locator("#id_input-firmName")
                        await firm_field.fill("")
                        await firm_field.fill(USERNAME)
                        
                        print(f"[OK] Re-filled credentials")
                        await asyncio.sleep(1)
                        
                        # Click LOGIN again
                        await login_frame_check.locator("#LoginButton").click(force=True)
                        print("[OK] Clicked LOGIN again")
                        await asyncio.sleep(8)
                        
                        await page.screenshot(path=f"{OUTPUT_DIR}/post_relogin.png")
                        
                        # Check if another captcha appeared
                        for frame in page.frames:
                            if "OLTPRO_captcha" in frame.url:
                                print("[INFO] New captcha appeared after re-login")
                                captcha_imgs2 = await frame.locator("img").all()
                                if captcha_imgs2:
                                    captcha_path2 = f"{OUTPUT_DIR}/captcha_challenge2.png"
                                    src2 = await captcha_imgs2[0].get_attribute("src") or ""
                                    if src2.startswith("data:image"):
                                        b64_data2 = src2.split(",", 1)[1]
                                        with open(captcha_path2, "wb") as f:
                                            f.write(base64.b64decode(b64_data2))
                                    else:
                                        await captcha_imgs2[0].screenshot(path=captcha_path2)
                                    
                                    answer2 = await solve_challenge_with_vision(captcha_path2)
                                    if answer2:
                                        captcha_input2 = frame.locator("input[type='text']")
                                        if await captcha_input2.count() > 0:
                                            await captcha_input2.first.fill(answer2)
                                            print(f"[OK] Filled 2nd captcha answer: {answer2}")
                                        
                                        submit2 = frame.locator("input[type='submit'], button:has-text('Submit'), input[value='Submit']")
                                        if await submit2.count() > 0:
                                            await submit2.first.click(force=True)
                                            print("[OK] Submitted 2nd captcha")
                                        
                                        await asyncio.sleep(8)
                                break
                except Exception as e:
                    print(f"[WARN] Re-login check error: {e}")
            
            # Check all frames for dashboard/client content
            await page.screenshot(path=f"{OUTPUT_DIR}/final_login_state.png")
            for frame in page.frames:
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        text = await frame.locator("body").text_content()
                        text_short = " ".join(text.split())[:300] if text else ""
                        if any(
                            kw in text_short.lower()
                            for kw in [
                                "dashboard", "client", "welcome", "return",
                                "logout", "step 2", "menu", "home",
                            ]
                        ):
                            logged_in = True
                            print(f"[OK] Login successful! Content: {text_short[:150]}")
                            break
                        elif text_short:
                            print(f"[FRAME] {url[:60]}: {text_short[:150]}")
                    except:
                        pass

            if not logged_in:
                print("[WARN] Login may not have succeeded")
                print("[INFO] Taking final screenshot for debugging...")

            # ─── STEP 6: Navigate to client list ───
            print("\n[STEP 6] Looking for client navigation...")
            await page.screenshot(path=f"{OUTPUT_DIR}/step6_state.png")

            # Try to find navigation to clients
            for frame in page.frames:
                try:
                    links = await frame.locator("a").all()
                    for link in links:
                        text = await link.text_content() or ""
                        href = await link.get_attribute("href") or ""
                        if any(
                            kw in text.lower()
                            for kw in ["client", "return", "list", "taxpayer"]
                        ):
                            print(f"[LINK] {text.strip()}: {href[:80]}")
                except:
                    pass

            # ─── STEP 7: Extract client data ───
            print("\n[STEP 7] Extracting client data...")
            clients = []

            # Try to find and click on client list
            for frame in page.frames:
                try:
                    tables = await frame.locator("table").all()
                    for table_idx, table in enumerate(tables):
                        rows = await table.locator("tr").all()
                        if len(rows) > 1:
                            print(f"[INFO] Found table with {len(rows)} rows")

                            # Get headers
                            header_cells = await rows[0].locator("th, td").all()
                            headers = []
                            for cell in header_cells:
                                text = await cell.text_content()
                                headers.append(text.strip() if text else f"col_{len(headers)}")

                            # Get data rows
                            for row in rows[1:]:
                                cells = await row.locator("td").all()
                                row_data = {}
                                for i, cell in enumerate(cells):
                                    text = await cell.text_content()
                                    col_name = headers[i] if i < len(headers) else f"col_{i}"
                                    row_data[col_name] = text.strip() if text else ""
                                if any(v for v in row_data.values()):
                                    clients.append(row_data)
                except:
                    pass

            # Save results
            output_file = f"{OUTPUT_DIR}/clients_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_file, "w") as f:
                json.dump(
                    {
                        "timestamp": datetime.now().isoformat(),
                        "client_count": len(clients),
                        "clients": clients,
                    },
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
            print(f"\n[RESULT] Saved {len(clients)} clients to {output_file}")

            return True

        except Exception as e:
            print(f"\n[FATAL ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/fatal_error.png")
            return False

        finally:
            await browser.close()


if __name__ == "__main__":
    result = asyncio.run(login_and_scrape())
    print(f"\n{'SUCCESS' if result else 'FAILED'}")
    sys.exit(0 if result else 1)
