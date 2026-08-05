"""
Tax Portal Scraper v3 - Login + 2FA + Client Data Extraction
Step 1: Run this script to login and trigger SMS 2FA
Step 2: Run step2 script with the code received
"""

import asyncio
import base64
import json
import os
import pickle
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
EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
OUTPUT_DIR = "/tmp/tax_portal_data"
STATE_FILE = "/tmp/tax_portal_state.json"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


async def solve_captcha_with_vision(image_path: str) -> str:
    """Use OpenAI Vision via emergentintegrations to solve a CAPTCHA image."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"captcha-{datetime.now().timestamp()}",
        system_message=(
            "You solve CAPTCHAs. You will see an image with a challenge. "
            "If it says 'Type fruit/vegetable name', identify which word is a fruit/vegetable. "
            "If it says 'Type animal/bird name', identify which word is an animal/bird. "
            "If it's a math equation, solve it. "
            "Return ONLY the answer, nothing else. No quotes."
        ),
    )
    chat.with_model("openai", "gpt-4o")

    with open(image_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode("utf-8")

    resp = await chat.send_message(
        UserMessage(
            text="Solve this CAPTCHA. Return ONLY the answer.",
            file_contents=[ImageContent(image_base64=image_b64)],
        )
    )
    answer = resp.strip().strip('"').strip("'").lower()
    print(f"[CAPTCHA] Answer: {answer}")
    return answer


async def step1_login_and_trigger_sms():
    """Login, solve captcha, and trigger SMS 2FA code."""
    print("=" * 60)
    print("STEP 1: Login + Captcha + Trigger SMS 2FA")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        page = await context.new_page()

        # Navigate to login
        print("[1] Navigating to login page...")
        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(3)

        # Handle Cloudflare robot check if present
        content = await page.content()
        if "might be a robot" in content:
            print("[1] Cloudflare check detected, solving...")
            captcha_img = page.locator("img").first
            captcha_path = f"{OUTPUT_DIR}/cf_captcha.png"
            await captcha_img.screenshot(path=captcha_path)
            answer = await solve_captcha_with_vision(captcha_path)
            await page.locator("input[type='text']").first.fill(answer)
            await page.locator("text=CONTINUE").click()
            await asyncio.sleep(5)
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

        # Find login iframe
        print("[2] Finding login iframe...")
        login_frame = None
        for frame in page.frames:
            if "cobrandLogin" in frame.url:
                login_frame = frame
                break

        if not login_frame:
            print("[ERROR] Login iframe not found!")
            return False

        # Fill credentials
        print("[3] Filling credentials...")
        await login_frame.locator("#id_input-username").fill(FIRM_ID)
        await login_frame.locator("#id_input-passwrd").fill(PASSWORD)
        await login_frame.locator("#id_input-firmName").fill(USERNAME)
        await asyncio.sleep(1)

        # Click LOGIN
        print("[4] Clicking LOGIN...")
        await login_frame.locator("#LoginButton").click(force=True)
        await asyncio.sleep(5)

        # Solve captcha
        print("[5] Solving Security Challenge captcha...")
        captcha_frame = None
        for frame in page.frames:
            if "OLTPRO_captcha" in frame.url:
                captcha_frame = frame
                break

        if captcha_frame:
            captcha_imgs = await captcha_frame.locator("img").all()
            if captcha_imgs:
                captcha_path = f"{OUTPUT_DIR}/captcha_step1.png"
                src = await captcha_imgs[0].get_attribute("src") or ""
                if src.startswith("data:image"):
                    b64_data = src.split(",", 1)[1]
                    with open(captcha_path, "wb") as f:
                        f.write(base64.b64decode(b64_data))
                else:
                    await captcha_imgs[0].screenshot(path=captcha_path)

                answer = await solve_captcha_with_vision(captcha_path)

                captcha_input = captcha_frame.locator("input[type='text']")
                if await captcha_input.count() > 0:
                    await captcha_input.first.fill(answer)

                submit = captcha_frame.locator("input[type='submit'], input[value='Submit']")
                if await submit.count() > 0:
                    await submit.first.click(force=True)

                await asyncio.sleep(5)
                print(f"[OK] Captcha solved: {answer}")
        else:
            print("[WARN] No captcha frame found")

        # Now we should be at the 2FA page
        print("[6] Looking for 2FA verification form...")
        await page.screenshot(path=f"{OUTPUT_DIR}/step1_2fa.png")

        # Find the 2FA frame
        tfa_frame = None
        for frame in page.frames:
            url = frame.url or ""
            if "OLTPRO_login" in url and url != "about:blank":
                try:
                    text = await frame.locator("body").text_content()
                    if text and "verification" in text.lower():
                        tfa_frame = frame
                        print(f"[OK] Found 2FA frame: {url[:80]}")
                        break
                except:
                    pass

        if not tfa_frame:
            # Try any frame with verification content
            for frame in page.frames:
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        text = await frame.locator("body").text_content()
                        if text and ("verification" in text.lower() or "send me" in text.lower()):
                            tfa_frame = frame
                            print(f"[OK] Found 2FA frame (alt): {url[:80]}")
                            break
                    except:
                        pass

        if not tfa_frame:
            print("[ERROR] 2FA frame not found")
            # Print all frame contents for debugging
            for i, frame in enumerate(page.frames):
                url = frame.url or ""
                if url and url != "about:blank" and "recaptcha" not in url:
                    try:
                        text = await frame.locator("body").text_content()
                        text_clean = " ".join(text.split())[:200] if text else ""
                        print(f"  Frame {i} ({url[:60]}): {text_clean[:100]}")
                    except:
                        pass
            await browser.close()
            return False

        # Select SMS option and send
        print("[7] Selecting SMS verification...")
        
        # Find SMS radio button
        radios = await tfa_frame.locator("input[type='radio']").all()
        print(f"[INFO] Found {len(radios)} radio buttons")
        
        sms_selected = False
        for radio in radios:
            val = await radio.get_attribute("value") or ""
            name = await radio.get_attribute("name") or ""
            label_text = ""
            try:
                parent = radio.locator("..")
                label_text = await parent.text_content() or ""
            except:
                pass
            print(f"  Radio: name={name}, value={val}, label={label_text.strip()[:50]}")
            
            if "sms" in val.lower() or "text" in val.lower() or "phone" in val.lower():
                await radio.click(force=True)
                sms_selected = True
                print(f"[OK] Selected SMS radio: {val}")
                break

        if not sms_selected and radios:
            # Try first radio (usually SMS)
            await radios[0].click(force=True)
            print("[OK] Selected first radio button (assuming SMS)")

        await asyncio.sleep(1)

        # Check for agree checkbox
        agree_checkbox = tfa_frame.locator("input[type='checkbox']")
        if await agree_checkbox.count() > 0:
            try:
                await agree_checkbox.first.check(force=True)
                print("[OK] Checked agreement checkbox")
            except:
                pass

        await asyncio.sleep(1)

        # Click Send/Submit button
        send_btn = tfa_frame.locator(
            "input[type='submit'], input[type='button'], button"
        )
        buttons = await send_btn.all()
        for btn in buttons:
            val = await btn.get_attribute("value") or ""
            text = await btn.text_content() or ""
            btn_text = val or text
            print(f"  Button: '{btn_text.strip()[:40]}'")
            if any(kw in btn_text.lower() for kw in ["send", "submit", "continue", "enviar", "next"]):
                await btn.click(force=True)
                print(f"[OK] Clicked '{btn_text.strip()[:40]}'")
                break

        await asyncio.sleep(5)
        await page.screenshot(path=f"{OUTPUT_DIR}/step1_sms_sent.png")

        # Save browser state for step 2
        state = await context.storage_state()
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
        print(f"[OK] Browser state saved to {STATE_FILE}")

        # Check current state
        print("\n[INFO] Current page state:")
        for i, frame in enumerate(page.frames):
            url = frame.url or ""
            if url and url != "about:blank" and "recaptcha" not in url:
                try:
                    text = await frame.locator("body").text_content()
                    text_clean = " ".join(text.split())[:150] if text else ""
                    if text_clean:
                        print(f"  Frame {i}: {text_clean}")
                except:
                    pass

        # Save current URL for step 2
        current_url = page.url
        with open(f"{OUTPUT_DIR}/current_url.txt", "w") as f:
            f.write(current_url)

        await browser.close()

        print("\n" + "=" * 60)
        print("SMS 2FA code should have been sent to 8069307456")
        print("Run step 2 script with the code to complete login")
        print("=" * 60)

        return True


if __name__ == "__main__":
    result = asyncio.run(step1_login_and_trigger_sms())
    print(f"\n{'SUCCESS - Check SMS' if result else 'FAILED'}")
