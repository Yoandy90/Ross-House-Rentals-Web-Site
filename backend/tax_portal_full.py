"""
Tax Portal - Complete flow: Login + Captcha + 2FA + Extract Data
All in one session without closing the browser.
"""

import asyncio
import base64
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

LOGIN_URL = "https://www.mytaxoffice.com/main/pro/Taxseason_Login.php"
FIRM_ID = "90090829983"
USERNAME = "Yoandy Ross"
PASSWORD = "Interpol.1990"
TFA_CODE = "335582"
EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
OUTPUT_DIR = "/tmp/tax_portal_data"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


async def solve_captcha(image_path: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"captcha-{datetime.now().timestamp()}",
        system_message=(
            "You solve CAPTCHAs. Identify the fruit/vegetable/animal/bird from given words, "
            "or solve the math equation. Return ONLY the answer, no quotes."
        ),
    )
    chat.with_model("openai", "gpt-4o")
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    resp = await chat.send_message(
        UserMessage(text="Solve this CAPTCHA. Return ONLY the answer.",
                    file_contents=[ImageContent(image_base64=img_b64)])
    )
    answer = resp.strip().strip('"').strip("'").lower()
    print(f"  [CAPTCHA] Answer: {answer}")
    return answer


async def solve_captcha_in_frame(frame):
    """Extract captcha image from frame, solve it, fill and submit."""
    captcha_imgs = await frame.locator("img").all()
    if not captcha_imgs:
        return False
    
    captcha_path = f"{OUTPUT_DIR}/captcha_{datetime.now().strftime('%H%M%S')}.png"
    src = await captcha_imgs[0].get_attribute("src") or ""
    if src.startswith("data:image"):
        b64_data = src.split(",", 1)[1]
        with open(captcha_path, "wb") as f:
            f.write(base64.b64decode(b64_data))
    else:
        await captcha_imgs[0].screenshot(path=captcha_path)
    
    answer = await solve_captcha(captcha_path)
    
    captcha_input = frame.locator("input[type='text']")
    if await captcha_input.count() > 0:
        await captcha_input.first.fill(answer)
    
    submit = frame.locator("input[type='submit'], input[value='Submit']")
    if await submit.count() > 0:
        await submit.first.click(force=True)
    
    await asyncio.sleep(5)
    return True


async def run_full_flow():
    print("=" * 60)
    print("Tax Portal - Complete Automation Flow")
    print(f"Time: {datetime.now().isoformat()}")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        )
        page = await context.new_page()

        try:
            # ── PHASE 1: Login ──
            print("\n[PHASE 1] Login...")
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            # Handle Cloudflare if present
            if "might be a robot" in await page.content():
                print("  Cloudflare check detected...")
                img = page.locator("img").first
                await img.screenshot(path=f"{OUTPUT_DIR}/cf.png")
                ans = await solve_captcha(f"{OUTPUT_DIR}/cf.png")
                await page.locator("input[type='text']").first.fill(ans)
                await page.locator("text=CONTINUE").click()
                await asyncio.sleep(5)
                await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(3)

            login_frame = None
            for frame in page.frames:
                if "cobrandLogin" in frame.url:
                    login_frame = frame
                    break
            if not login_frame:
                print("  [ERROR] Login frame not found!")
                return False

            await login_frame.locator("#id_input-username").fill(FIRM_ID)
            await login_frame.locator("#id_input-passwrd").fill(PASSWORD)
            await login_frame.locator("#id_input-firmName").fill(USERNAME)
            await asyncio.sleep(1)
            await login_frame.locator("#LoginButton").click(force=True)
            print("  [OK] Credentials submitted")
            await asyncio.sleep(5)

            # ── PHASE 2: Solve Captcha ──
            print("\n[PHASE 2] Security Challenge...")
            captcha_frame = None
            for frame in page.frames:
                if "OLTPRO_captcha" in frame.url:
                    captcha_frame = frame
                    break
            
            if captcha_frame:
                await solve_captcha_in_frame(captcha_frame)
                print("  [OK] Captcha solved")
            else:
                print("  [WARN] No captcha found")

            await asyncio.sleep(3)
            await page.screenshot(path=f"{OUTPUT_DIR}/phase2_done.png")

            # ── PHASE 3: 2FA - Select SMS ──
            print("\n[PHASE 3] Two-Factor Authentication...")
            
            tfa_frame = None
            for frame in page.frames:
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        text = await frame.locator("body").text_content()
                        if text and ("verification" in text.lower() or "send me" in text.lower()):
                            tfa_frame = frame
                            break
                    except:
                        pass

            if tfa_frame:
                print("  [OK] Found 2FA form")
                
                # Select SMS
                radios = await tfa_frame.locator("input[type='radio']").all()
                for radio in radios:
                    val = await radio.get_attribute("value") or ""
                    if "sms" in val.lower():
                        await radio.click(force=True)
                        print(f"  [OK] Selected SMS: {val}")
                        break
                
                # Check agree
                checkbox = tfa_frame.locator("input[type='checkbox']")
                if await checkbox.count() > 0:
                    try:
                        await checkbox.first.check(force=True)
                        print("  [OK] Agreed to SMS")
                    except:
                        pass
                
                await asyncio.sleep(1)
                
                # Click CONTINUE
                buttons = await tfa_frame.locator("input[type='submit'], input[type='button'], button").all()
                for btn in buttons:
                    val = await btn.get_attribute("value") or await btn.text_content() or ""
                    if any(kw in val.lower() for kw in ["continue", "send", "submit", "next"]):
                        await btn.click(force=True)
                        print(f"  [OK] Clicked: {val.strip()[:30]}")
                        break
                
                await asyncio.sleep(5)
                await page.screenshot(path=f"{OUTPUT_DIR}/phase3_sms_sent.png")
            else:
                print("  [INFO] No 2FA form found (might already be past it)")

            # ── PHASE 4: Enter 2FA Code ──
            print(f"\n[PHASE 4] Entering 2FA code: {TFA_CODE}...")
            
            # Look for code entry field in all frames
            code_entered = False
            for frame in page.frames:
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        text = await frame.locator("body").text_content()
                        if not text:
                            continue
                        text_lower = text.lower()
                        
                        # Check if this frame has a code entry field
                        if any(kw in text_lower for kw in ["enter", "code", "verification", "verify", "pin"]):
                            print(f"  [INFO] Found code entry frame: {url[:60]}")
                            
                            # Find text inputs
                            inputs = await frame.locator("input[type='text'], input[type='number'], input[type='tel']").all()
                            print(f"  [INFO] Found {len(inputs)} input fields")
                            
                            for inp in inputs:
                                inp_name = await inp.get_attribute("name") or ""
                                inp_id = await inp.get_attribute("id") or ""
                                inp_placeholder = await inp.get_attribute("placeholder") or ""
                                print(f"    Input: name={inp_name}, id={inp_id}, ph={inp_placeholder}")
                                
                                if any(kw in (inp_name + inp_id + inp_placeholder).lower() 
                                       for kw in ["code", "verify", "pin", "otp", "token", "sms"]):
                                    await inp.fill(TFA_CODE)
                                    code_entered = True
                                    print(f"  [OK] Filled code in field: {inp_name or inp_id}")
                                    break
                            
                            if not code_entered and inputs:
                                # Fill first available text input
                                await inputs[0].fill(TFA_CODE)
                                code_entered = True
                                print("  [OK] Filled code in first available input")
                            
                            if code_entered:
                                # Click verify/submit
                                btns = await frame.locator("input[type='submit'], input[type='button'], button").all()
                                for btn in btns:
                                    val = await btn.get_attribute("value") or await btn.text_content() or ""
                                    if any(kw in val.lower() for kw in ["verify", "submit", "continue", "confirm", "ok"]):
                                        await btn.click(force=True)
                                        print(f"  [OK] Clicked: {val.strip()[:30]}")
                                        break
                                
                                await asyncio.sleep(8)
                                break
                    except Exception as e:
                        pass

            if not code_entered:
                print("  [WARN] Could not find code entry field")
                # Debug: print all frame contents
                for i, frame in enumerate(page.frames):
                    url = frame.url or ""
                    if url and url != "about:blank" and "recaptcha" not in url:
                        try:
                            text = await frame.locator("body").text_content()
                            text_clean = " ".join(text.split())[:200] if text else ""
                            if text_clean:
                                print(f"  Frame {i} ({url[:50]}): {text_clean[:150]}")
                        except:
                            pass

            await page.screenshot(path=f"{OUTPUT_DIR}/phase4_code_entered.png")

            # ── PHASE 5: Verify we're in the dashboard ──
            print(f"\n[PHASE 5] Checking login status...")
            print(f"  URL: {page.url}")
            
            await asyncio.sleep(3)
            
            # List all frames and their content summaries
            dashboard_found = False
            for i, frame in enumerate(page.frames):
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        text = await frame.locator("body").text_content()
                        text_clean = " ".join(text.split())[:300] if text else ""
                        if any(kw in text_clean.lower() for kw in [
                            "client", "return", "taxpayer", "dashboard", "menu",
                            "new return", "search", "logout", "home"
                        ]):
                            dashboard_found = True
                            print(f"  [OK] Dashboard content found in frame {i}")
                            print(f"  Content preview: {text_clean[:200]}")
                        
                        # Look for links to client list
                        links = await frame.locator("a").all()
                        for link in links[:20]:
                            href = await link.get_attribute("href") or ""
                            link_text = (await link.text_content() or "").strip()
                            if link_text and any(kw in link_text.lower() for kw in [
                                "client", "return", "list", "search", "new", "home", "menu"
                            ]):
                                print(f"  [LINK] {link_text}: {href[:80]}")
                    except:
                        pass

            await page.screenshot(path=f"{OUTPUT_DIR}/phase5_dashboard.png")

            if not dashboard_found:
                print("  [INFO] Dashboard not clearly detected, taking extra screenshots...")
                # Maybe we're already in the app but the content is JS-heavy
                # Let's wait and try scrolling/clicking
                await asyncio.sleep(5)
                await page.screenshot(path=f"{OUTPUT_DIR}/phase5_wait.png")

            # ── PHASE 6: Extract Client Data ──
            print(f"\n[PHASE 6] Looking for client data...")
            
            clients = []
            
            # Try to find client list or navigate to it
            for frame in page.frames:
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        tables = await frame.locator("table").all()
                        for table in tables:
                            rows = await table.locator("tr").all()
                            if len(rows) > 1:
                                headers = []
                                header_cells = await rows[0].locator("th, td").all()
                                for cell in header_cells:
                                    text = (await cell.text_content() or "").strip()
                                    if len(text) < 50:  # Only real headers
                                        headers.append(text)
                                
                                if headers and len(headers) >= 2:
                                    print(f"  [TABLE] Headers: {headers[:8]}")
                                    
                                    for row in rows[1:]:
                                        cells = await row.locator("td").all()
                                        row_data = {}
                                        for idx, cell in enumerate(cells):
                                            text = (await cell.text_content() or "").strip()
                                            if text and len(text) < 200:
                                                col = headers[idx] if idx < len(headers) else f"col_{idx}"
                                                row_data[col] = text
                                        if row_data and len(row_data) >= 2:
                                            clients.append(row_data)
                    except:
                        pass

            # Save results
            output_file = f"{OUTPUT_DIR}/clients_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(output_file, "w") as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "url": page.url,
                    "client_count": len(clients),
                    "clients": clients,
                }, f, indent=2, ensure_ascii=False)
            
            print(f"\n[RESULT] Saved {len(clients)} client records to {output_file}")
            
            # Final screenshot
            await page.screenshot(path=f"{OUTPUT_DIR}/final.png")
            
            return True

        except Exception as e:
            print(f"\n[FATAL ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/error.png")
            return False

        finally:
            await browser.close()


if __name__ == "__main__":
    result = asyncio.run(run_full_flow())
    print(f"\n{'SUCCESS' if result else 'FAILED'}")
