"""
Part A: Login + Captcha + Trigger SMS → Save session cookies
Part B: Load cookies → Enter 2FA code → Extract data
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
EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
OUTPUT_DIR = "/tmp/tax_portal_data"
STATE_FILE = "/tmp/tax_portal_cookies.json"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


async def solve_captcha(image_path: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"c-{datetime.now().timestamp()}",
                    system_message="Solve CAPTCHAs. Return ONLY the answer. No quotes.")
    chat.with_model("openai", "gpt-4o")
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    resp = await chat.send_message(UserMessage(text="Solve. ONLY the answer.",
                                                file_contents=[ImageContent(image_base64=img_b64)]))
    return resp.strip().strip('"').strip("'").lower()


async def part_a():
    """Login + Captcha + Trigger SMS + Save cookies."""
    print("=== PART A: Login + SMS ===")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        page = await context.new_page()

        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(3)

        # Cloudflare
        if "might be a robot" in await page.content():
            await page.locator("img").first.screenshot(path=f"{OUTPUT_DIR}/cf.png")
            ans = await solve_captcha(f"{OUTPUT_DIR}/cf.png")
            await page.locator("input[type='text']").first.fill(ans)
            await page.locator("text=CONTINUE").click()
            await asyncio.sleep(5)
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

        # Login frame
        login_frame = None
        for frame in page.frames:
            if "cobrandLogin" in frame.url:
                login_frame = frame
                break
        if not login_frame:
            print("[ERROR] No login frame"); return False

        await login_frame.locator("#id_input-username").fill(FIRM_ID)
        await login_frame.locator("#id_input-passwrd").fill(PASSWORD)
        await login_frame.locator("#id_input-firmName").fill(USERNAME)
        await asyncio.sleep(1)
        await login_frame.locator("#LoginButton").click(force=True)
        print("[OK] Login submitted")
        await asyncio.sleep(5)

        # Captcha
        for frame in page.frames:
            if "OLTPRO_captcha" in frame.url:
                imgs = await frame.locator("img").all()
                if imgs:
                    cpath = f"{OUTPUT_DIR}/captcha_a.png"
                    src = await imgs[0].get_attribute("src") or ""
                    if src.startswith("data:image"):
                        with open(cpath, "wb") as f: f.write(base64.b64decode(src.split(",", 1)[1]))
                    else:
                        await imgs[0].screenshot(path=cpath)
                    ans = await solve_captcha(cpath)
                    print(f"[OK] Captcha: {ans}")
                    inp = frame.locator("input[type='text']")
                    if await inp.count() > 0: await inp.first.fill(ans)
                    sub = frame.locator("input[type='submit'], input[value='Submit']")
                    if await sub.count() > 0: await sub.first.click(force=True)
                    await asyncio.sleep(5)
                break

        # 2FA - Select SMS
        tfa_frame = None
        for frame in page.frames:
            url = frame.url or ""
            if url and "recaptcha" not in url and url != "about:blank":
                try:
                    text = await frame.locator("body").text_content()
                    if text and ("verification" in text.lower() or "send me" in text.lower()):
                        tfa_frame = frame; break
                except: pass

        if tfa_frame:
            radios = await tfa_frame.locator("input[type='radio']").all()
            for r in radios:
                val = await r.get_attribute("value") or ""
                if "sms" in val.lower():
                    await r.click(force=True); break

            cb = tfa_frame.locator("input[type='checkbox']")
            if await cb.count() > 0:
                try: await cb.first.check(force=True)
                except: pass

            await asyncio.sleep(1)
            btns = await tfa_frame.locator("input[type='submit'], input[type='button'], button").all()
            for btn in btns:
                val = await btn.get_attribute("value") or await btn.text_content() or ""
                if any(kw in val.lower() for kw in ["continue", "send", "submit"]):
                    await btn.click(force=True); print(f"[OK] SMS triggered: {val.strip()[:20]}"); break

            await asyncio.sleep(5)

        # Save state
        state = await context.storage_state()
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
        
        # Also save the current page URL
        with open(f"{OUTPUT_DIR}/last_url.txt", "w") as f:
            f.write(page.url)

        await page.screenshot(path=f"{OUTPUT_DIR}/part_a_done.png")
        
        # Print frame info for debugging
        for i, frame in enumerate(page.frames):
            url = frame.url or ""
            if url and "recaptcha" not in url and url != "about:blank":
                print(f"  Frame {i}: {url.split('?')[0]}")

        print(f"[OK] Cookies saved to {STATE_FILE}")
        await browser.close()
        return True


async def part_b(code: str):
    """Load cookies + Enter 2FA code + Extract client data."""
    print(f"\n=== PART B: Enter code {code} + Extract ===")
    
    if not os.path.exists(STATE_FILE):
        print("[ERROR] No saved state file!"); return False

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            storage_state=STATE_FILE,
        )
        page = await context.new_page()

        # Navigate back to the login page (cookies should maintain session)
        with open(f"{OUTPUT_DIR}/last_url.txt", "r") as f:
            last_url = f.read().strip()
        
        print(f"[INFO] Resuming at: {last_url}")
        await page.goto(last_url, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(5)
        await page.screenshot(path=f"{OUTPUT_DIR}/part_b_start.png")

        # Check current state - are we at code entry?
        print("[INFO] Checking page state...")
        for i, frame in enumerate(page.frames):
            url = frame.url or ""
            if url and "recaptcha" not in url and url != "about:blank":
                try:
                    text = await frame.locator("body").text_content()
                    text_clean = " ".join(text.split())[:150] if text else ""
                    print(f"  Frame {i} ({url.split('/')[-1].split('?')[0]}): {text_clean[:100]}")
                except: pass

        # Try to find and fill the verification code
        code_entered = False
        for frame in page.frames:
            url = frame.url or ""
            if url and "recaptcha" not in url and url != "about:blank":
                try:
                    # Look for the verifiy_code field
                    code_input = frame.locator("input[name='verifiy_code']")
                    if await code_input.count() > 0:
                        await code_input.first.fill(code)
                        code_entered = True
                        print(f"[OK] Code entered: {code}")
                        
                        # Click Verify
                        btns = await frame.locator("input[type='submit'], input[type='button'], button").all()
                        for btn in btns:
                            val = await btn.get_attribute("value") or await btn.text_content() or ""
                            if any(kw in val.lower() for kw in ["verify", "submit", "continue"]):
                                await btn.click(force=True)
                                print(f"[OK] Clicked: {val.strip()}")
                                break
                        break
                except: pass

        if not code_entered:
            print("[WARN] Code input not found - session may have expired")
            # We may need to re-login
            print("[INFO] Attempting fresh login with immediate code entry...")
            
            # Re-do login
            login_frame = None
            for frame in page.frames:
                if "cobrandLogin" in frame.url:
                    login_frame = frame; break
            
            if login_frame:
                await login_frame.locator("#id_input-username").fill(FIRM_ID)
                await login_frame.locator("#id_input-passwrd").fill(PASSWORD)
                await login_frame.locator("#id_input-firmName").fill(USERNAME)
                await asyncio.sleep(1)
                await login_frame.locator("#LoginButton").click(force=True)
                await asyncio.sleep(5)
                
                # Check if captcha appears again
                for frame in page.frames:
                    if "OLTPRO_captcha" in frame.url:
                        imgs = await frame.locator("img").all()
                        if imgs:
                            cpath = f"{OUTPUT_DIR}/captcha_b.png"
                            src = await imgs[0].get_attribute("src") or ""
                            if src.startswith("data:image"):
                                with open(cpath, "wb") as f: f.write(base64.b64decode(src.split(",",1)[1]))
                            else:
                                await imgs[0].screenshot(path=cpath)
                            ans = await solve_captcha(cpath)
                            inp = frame.locator("input[type='text']")
                            if await inp.count() > 0: await inp.first.fill(ans)
                            sub = frame.locator("input[type='submit'], input[value='Submit']")
                            if await sub.count() > 0: await sub.first.click(force=True)
                            await asyncio.sleep(5)
                        break
                
                # Now try code entry again
                await asyncio.sleep(3)
                for frame in page.frames:
                    try:
                        code_input = frame.locator("input[name='verifiy_code']")
                        if await code_input.count() > 0:
                            await code_input.first.fill(code)
                            code_entered = True
                            print(f"[OK] Code entered on retry: {code}")
                            btns = await frame.locator("input[type='submit'], input[type='button'], button").all()
                            for btn in btns:
                                val = await btn.get_attribute("value") or await btn.text_content() or ""
                                if "verify" in val.lower():
                                    await btn.click(force=True); break
                            break
                    except: pass

        await asyncio.sleep(10)
        await page.screenshot(path=f"{OUTPUT_DIR}/part_b_after_code.png")

        # Check if we're in the dashboard
        print("\n[INFO] Post-verification state:")
        dashboard = False
        for i, frame in enumerate(page.frames):
            url = frame.url or ""
            if url and "recaptcha" not in url and url != "about:blank":
                try:
                    text = await frame.locator("body").text_content()
                    text_clean = " ".join(text.split())[:200] if text else ""
                    if any(kw in text_clean.lower() for kw in ["client", "return", "dashboard", "logout", "welcome", "menu", "home", "new"]):
                        dashboard = True
                        print(f"  [DASHBOARD] Frame {i}: {text_clean[:150]}")
                    elif text_clean and len(text_clean) > 20:
                        print(f"  Frame {i} ({url.split('/')[-1].split('?')[0][:30]}): {text_clean[:100]}")
                    
                    # List navigation links
                    links = await frame.locator("a").all()
                    for link in links[:15]:
                        href = await link.get_attribute("href") or ""
                        lt = (await link.text_content() or "").strip()
                        if lt and len(lt) < 50 and any(kw in lt.lower() for kw in ["client", "return", "new", "search", "list", "home"]):
                            print(f"    [LINK] {lt}: {href[:60]}")
                except: pass

        if dashboard:
            print("\n[SUCCESS] We're in the dashboard!")
        
        # Extract any visible client data
        print("\n[EXTRACTING] Client data...")
        clients = []
        for frame in page.frames:
            try:
                tables = await frame.locator("table").all()
                for table in tables:
                    rows = await table.locator("tr").all()
                    if len(rows) > 1:
                        hcells = await rows[0].locator("th, td").all()
                        headers = [(await c.text_content() or "").strip() for c in hcells if len((await c.text_content() or "").strip()) < 50]
                        if headers and len(headers) >= 2 and not any("verification" in h.lower() for h in headers):
                            print(f"  [TABLE] {len(rows)} rows: {headers[:6]}")
                            for row in rows[1:]:
                                cells = await row.locator("td").all()
                                rd = {}
                                for idx, cell in enumerate(cells):
                                    txt = (await cell.text_content() or "").strip()
                                    if txt and len(txt) < 300:
                                        rd[headers[idx] if idx < len(headers) else f"col_{idx}"] = txt
                                if rd and len(rd) >= 2:
                                    clients.append(rd)
            except: pass

        out = f"{OUTPUT_DIR}/clients_final.json"
        with open(out, "w") as f:
            json.dump({"timestamp": datetime.now().isoformat(), "count": len(clients), "clients": clients}, f, indent=2, ensure_ascii=False)
        print(f"\n[RESULT] {len(clients)} clients → {out}")

        await page.screenshot(path=f"{OUTPUT_DIR}/final.png")
        await browser.close()
        return dashboard


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "a"
    code = sys.argv[2] if len(sys.argv) > 2 else ""
    
    if mode == "a":
        asyncio.run(part_a())
    elif mode == "b":
        if not code:
            print("Usage: python tax_portal_2step.py b CODE")
            sys.exit(1)
        asyncio.run(part_b(code))
    elif mode == "full":
        # Run both parts, code must be provided
        if not code:
            print("Usage: python tax_portal_2step.py full CODE")
            sys.exit(1)
        result_a = asyncio.run(part_a())
        if result_a:
            asyncio.run(part_b(code))
