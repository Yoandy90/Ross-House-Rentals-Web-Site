"""
Tax Portal Scraper - Persistent Browser Session
Keeps the browser open while waiting for 2FA code from a file.
Flow: Login → Captcha → SMS → Wait for code file → Enter code → Extract data
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
CODE_FILE = "/tmp/2fa_code.txt"  # Write the code here to continue

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
# Remove old code file
if os.path.exists(CODE_FILE):
    os.remove(CODE_FILE)


async def solve_captcha(image_path: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"c-{datetime.now().timestamp()}",
        system_message="You solve CAPTCHAs. Return ONLY the answer. No quotes, no explanation.",
    )
    chat.with_model("openai", "gpt-4o")
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()
    resp = await chat.send_message(
        UserMessage(text="Solve this CAPTCHA. Return ONLY the answer.",
                    file_contents=[ImageContent(image_base64=img_b64)])
    )
    return resp.strip().strip('"').strip("'").lower()


async def wait_for_code(timeout_seconds=300) -> str:
    """Poll for the 2FA code file. Returns the code when found."""
    print(f"\n{'='*60}")
    print(f"WAITING FOR 2FA CODE")
    print(f"Write the code to: {CODE_FILE}")
    print(f"Command: echo 'YOUR_CODE' > {CODE_FILE}")
    print(f"Timeout: {timeout_seconds}s")
    print(f"{'='*60}\n")
    
    start = datetime.now()
    while (datetime.now() - start).total_seconds() < timeout_seconds:
        if os.path.exists(CODE_FILE):
            with open(CODE_FILE, "r") as f:
                code = f.read().strip()
            if code and len(code) >= 4:
                print(f"[OK] Code received: {code}")
                os.remove(CODE_FILE)
                return code
        await asyncio.sleep(1)
    
    print("[ERROR] Timeout waiting for code")
    return ""


async def run():
    print("=" * 60)
    print("Tax Portal Scraper - Persistent Session")
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
            # ── Login ──
            print("\n[1/6] Navigating to login...")
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            # Cloudflare check
            if "might be a robot" in await page.content():
                print("  Cloudflare detected, solving...")
                await page.locator("img").first.screenshot(path=f"{OUTPUT_DIR}/cf.png")
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
                print("[ERROR] Login iframe not found")
                return

            await login_frame.locator("#id_input-username").fill(FIRM_ID)
            await login_frame.locator("#id_input-passwrd").fill(PASSWORD)
            await login_frame.locator("#id_input-firmName").fill(USERNAME)
            await asyncio.sleep(1)
            await login_frame.locator("#LoginButton").click(force=True)
            print("  [OK] Credentials submitted")
            await asyncio.sleep(5)

            # ── Captcha ──
            print("\n[2/6] Solving captcha...")
            for frame in page.frames:
                if "OLTPRO_captcha" in frame.url:
                    imgs = await frame.locator("img").all()
                    if imgs:
                        src = await imgs[0].get_attribute("src") or ""
                        cpath = f"{OUTPUT_DIR}/captcha.png"
                        if src.startswith("data:image"):
                            with open(cpath, "wb") as f:
                                f.write(base64.b64decode(src.split(",", 1)[1]))
                        else:
                            await imgs[0].screenshot(path=cpath)
                        ans = await solve_captcha(cpath)
                        print(f"  Answer: {ans}")
                        inp = frame.locator("input[type='text']")
                        if await inp.count() > 0:
                            await inp.first.fill(ans)
                        sub = frame.locator("input[type='submit'], input[value='Submit']")
                        if await sub.count() > 0:
                            await sub.first.click(force=True)
                        await asyncio.sleep(5)
                    break

            # ── 2FA: Select SMS ──
            print("\n[3/6] Selecting SMS verification...")
            tfa_frame = None
            for frame in page.frames:
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    try:
                        text = await frame.locator("body").text_content()
                        if text and ("verification" in text.lower() or "send me" in text.lower()):
                            tfa_frame = frame
                            break
                    except:
                        pass

            if tfa_frame:
                radios = await tfa_frame.locator("input[type='radio']").all()
                for r in radios:
                    val = await r.get_attribute("value") or ""
                    if "sms" in val.lower():
                        await r.click(force=True)
                        print(f"  Selected: {val}")
                        break

                cb = tfa_frame.locator("input[type='checkbox']")
                if await cb.count() > 0:
                    try:
                        await cb.first.check(force=True)
                    except:
                        pass

                await asyncio.sleep(1)
                btns = await tfa_frame.locator("input[type='submit'], input[type='button'], button").all()
                for btn in btns:
                    val = await btn.get_attribute("value") or await btn.text_content() or ""
                    if any(kw in val.lower() for kw in ["continue", "send", "submit"]):
                        await btn.click(force=True)
                        print(f"  Clicked: {val.strip()[:30]}")
                        break

                await asyncio.sleep(5)
                print("  [OK] SMS sent! Waiting for code...")

            # ── Wait for 2FA code ──
            code = await wait_for_code(timeout_seconds=300)
            if not code:
                print("[ERROR] No code received, aborting")
                return

            # ── Enter 2FA code ──
            print(f"\n[4/6] Entering code: {code}...")
            code_entered = False
            for frame in page.frames:
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    try:
                        inputs = await frame.locator("input[name='verifiy_code']").all()
                        if inputs:
                            await inputs[0].fill(code)
                            code_entered = True
                            print("  [OK] Code entered in verifiy_code field")

                            # Click Verify Now
                            btns = await frame.locator("input[type='submit'], input[type='button'], button").all()
                            for btn in btns:
                                val = await btn.get_attribute("value") or await btn.text_content() or ""
                                if any(kw in val.lower() for kw in ["verify", "submit", "continue"]):
                                    await btn.click(force=True)
                                    print(f"  [OK] Clicked: {val.strip()}")
                                    break
                            break
                    except:
                        pass

            if not code_entered:
                # Broader search
                for frame in page.frames:
                    url = frame.url or ""
                    if url and "recaptcha" not in url and url != "about:blank":
                        try:
                            text_inputs = await frame.locator("input[type='text'], input[type='tel'], input[type='number']").all()
                            for inp in text_inputs:
                                name = await inp.get_attribute("name") or ""
                                if "code" in name.lower() or "verify" in name.lower() or "otp" in name.lower():
                                    await inp.fill(code)
                                    code_entered = True
                                    print(f"  [OK] Code entered in: {name}")
                                    break
                            if code_entered:
                                btns = await frame.locator("input[type='submit'], input[type='button']").all()
                                for btn in btns:
                                    val = await btn.get_attribute("value") or ""
                                    if any(kw in val.lower() for kw in ["verify", "submit"]):
                                        await btn.click(force=True)
                                        break
                                break
                        except:
                            pass

            await asyncio.sleep(10)
            await page.screenshot(path=f"{OUTPUT_DIR}/after_2fa.png")

            # ── Check login success ──
            print(f"\n[5/6] Verifying login success...")
            print(f"  URL: {page.url}")

            # Dump all frame info for analysis
            for i, frame in enumerate(page.frames):
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    try:
                        text = await frame.locator("body").text_content()
                        text_clean = " ".join(text.split())[:200] if text else ""
                        print(f"  Frame {i} ({url.split('/')[-1][:40]}): {text_clean[:120]}")
                    except:
                        pass

            # ── Extract client data ──
            print(f"\n[6/6] Extracting client data...")
            clients = []

            # Navigate to client list if we can find a link
            for frame in page.frames:
                url = frame.url or ""
                if url and "recaptcha" not in url:
                    try:
                        links = await frame.locator("a").all()
                        for link in links:
                            href = await link.get_attribute("href") or ""
                            text = (await link.text_content() or "").strip()
                            if text and any(kw in text.lower() for kw in ["client", "return", "list", "new", "search", "home", "menu"]):
                                print(f"  [LINK] {text}: {href[:80]}")
                    except:
                        pass

            # Extract table data
            for frame in page.frames:
                url = frame.url or ""
                if url and "recaptcha" not in url:
                    try:
                        tables = await frame.locator("table").all()
                        for t_idx, table in enumerate(tables):
                            rows = await table.locator("tr").all()
                            if len(rows) > 1:
                                # Get headers
                                hcells = await rows[0].locator("th, td").all()
                                headers = []
                                for c in hcells:
                                    txt = (await c.text_content() or "").strip()
                                    if len(txt) < 50 and txt:
                                        headers.append(txt)
                                
                                if headers and len(headers) >= 2:
                                    print(f"  [TABLE] {len(rows)} rows, headers: {headers[:6]}")
                                    for row in rows[1:]:
                                        cells = await row.locator("td").all()
                                        rd = {}
                                        for idx, cell in enumerate(cells):
                                            txt = (await cell.text_content() or "").strip()
                                            if txt and len(txt) < 300:
                                                col = headers[idx] if idx < len(headers) else f"col_{idx}"
                                                rd[col] = txt
                                        if rd and len(rd) >= 2:
                                            clients.append(rd)
                    except:
                        pass

            # Save
            out = f"{OUTPUT_DIR}/clients_final_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(out, "w") as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "client_count": len(clients),
                    "clients": clients,
                }, f, indent=2, ensure_ascii=False)
            print(f"\n[RESULT] {len(clients)} clients saved to {out}")

            # Take final screenshot
            await page.screenshot(path=f"{OUTPUT_DIR}/final_state.png")

        except Exception as e:
            print(f"[ERROR] {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/error.png")
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(run())
