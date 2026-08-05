"""
Tax Portal - Bank Account Extractor v2
Key fix: Properly handles popup windows when clicking on client names.
The client detail page opens in a new window/tab (target="_blank" or window.open).
Uses context.expect_page() to capture the popup, then scrolls to bottom for bank data.
"""
import asyncio
import base64
import json
import os
import time
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
CODE_FILE = "/tmp/2fa_code.txt"
LOG_FILE = "/tmp/bank_v2_status.txt"
BANK_OUTPUT = "/app/backend/scraped_data/bank_data.json"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

async def solve_captcha(image_path):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"c{time.time()}",
                    system_message="Solve CAPTCHAs. Return ONLY ONE word or number. No quotes.")
    chat.with_model("openai", "gpt-4o")
    with open(image_path, "rb") as f:
        b = base64.b64encode(f.read()).decode()
    r = await chat.send_message(UserMessage(
        text="Solve. Return ONLY ONE answer word or number. If it asks to identify a word from a list (fruit, vegetable, animal), return just that one word. If it's math, return the number.",
        file_contents=[ImageContent(image_base64=b)]))
    return r.strip().strip('"').strip("'").lower()

async def do_login(page):
    """Full login flow with interactive SMS code via file."""
    log("LOGIN_START")
    await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
    await asyncio.sleep(3)
    
    # Cloudflare check
    if "might be a robot" in await page.content():
        log("CLOUDFLARE")
        await page.locator("img").first.screenshot(path=f"{OUTPUT_DIR}/cf.png")
        a = await solve_captcha(f"{OUTPUT_DIR}/cf.png")
        await page.locator("input[type='text']").first.fill(a)
        await page.locator("text=CONTINUE").click()
        await asyncio.sleep(5)
        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(3)
    
    # Find login frame
    lf = None
    for frame in page.frames:
        if "cobrandLogin" in frame.url:
            lf = frame
            break
    if not lf:
        log("ERROR: No login frame")
        return False
    
    await lf.locator("#id_input-username").fill(FIRM_ID)
    await lf.locator("#id_input-passwrd").fill(PASSWORD)
    await lf.locator("#id_input-firmName").fill(USERNAME)
    await asyncio.sleep(1)
    await lf.locator("#LoginButton").click(force=True)
    log("LOGIN_SUBMITTED")
    await asyncio.sleep(5)
    
    # Captcha
    for frame in page.frames:
        if "OLTPRO_captcha" in frame.url:
            imgs = await frame.locator("img").all()
            if imgs:
                cp = f"{OUTPUT_DIR}/cap.png"
                src = await imgs[0].get_attribute("src") or ""
                if src.startswith("data:image"):
                    with open(cp, "wb") as f:
                        f.write(base64.b64decode(src.split(",", 1)[1]))
                else:
                    await imgs[0].screenshot(path=cp)
                a = await solve_captcha(cp)
                log(f"CAPTCHA: {a}")
                inp = frame.locator("input[type='text']")
                if await inp.count() > 0:
                    await inp.first.fill(a)
                sub = frame.locator("input[type='submit'],input[value='Submit']")
                if await sub.count() > 0:
                    await sub.first.click(force=True)
                await asyncio.sleep(5)
            break
    
    # SMS 2FA
    log("SMS_SELECT")
    for frame in page.frames:
        url = frame.url or ""
        if url and "recaptcha" not in url and url != "about:blank":
            try:
                t = await frame.locator("body").text_content()
                if t and ("verification" in t.lower() or "send me" in t.lower()):
                    rs = await frame.locator("input[type='radio']").all()
                    for r in rs:
                        v = await r.get_attribute("value") or ""
                        if "sms" in v.lower():
                            await r.click(force=True)
                            break
                    cb = frame.locator("input[type='checkbox']")
                    if await cb.count() > 0:
                        try:
                            await cb.first.check(force=True)
                        except:
                            pass
                    await asyncio.sleep(1)
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["continue", "send", "submit"]):
                            await b.click(force=True)
                            log("SMS_SENT")
                            break
                    await asyncio.sleep(5)
                    break
            except:
                pass
    
    # Wait for SMS code
    await asyncio.sleep(8)
    log("WAITING_FOR_CODE - Write code to /tmp/2fa_code.txt")
    code = ""
    for _ in range(600):
        if os.path.exists(CODE_FILE):
            with open(CODE_FILE) as f:
                code = f.read().strip()
            if code and len(code) >= 4:
                log(f"CODE: {code}")
                os.remove(CODE_FILE)
                break
        await asyncio.sleep(1)
    if not code:
        log("ERROR: No code received")
        return False
    
    # Enter verification code
    for frame in page.frames:
        try:
            ci = frame.locator("input[name='verifiy_code']")
            if await ci.count() > 0:
                await ci.first.fill(code)
                bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                for b in bs:
                    v = await b.get_attribute("value") or await b.text_content() or ""
                    if "verify" in v.lower():
                        await b.click(force=True)
                        break
                break
        except:
            pass
    await asyncio.sleep(8)
    
    # Dismiss setup prompts
    for frame in page.frames:
        try:
            nn = frame.locator("input[value='Not at this time']")
            if await nn.count() > 0:
                await nn.first.click(force=True)
                log("DISMISSED_SETUP")
        except:
            pass
    await asyncio.sleep(5)
    
    # Enter secondary code "1990"
    for frame in page.frames:
        try:
            t = await frame.locator("body").text_content()
            if t and any(k in t.lower() for k in ["pin", "code", "security", "enter"]):
                inputs = await frame.locator("input[type='text'],input[type='password'],input[type='tel']").all()
                if inputs:
                    await inputs[0].fill("1990")
                    log("ENTERED_1990")
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["verify", "submit", "continue"]):
                            await b.click(force=True)
                            break
                    await asyncio.sleep(5)
        except:
            pass
    
    log("LOGIN_COMPLETE")
    return True


async def extract_bank_from_page(detail_page, client_name):
    """
    Extract bank account data from a client detail page.
    The bank info is at the BOTTOM of the client information page.
    """
    bank_data = {}
    
    # Wait for the page to fully load
    try:
        await detail_page.wait_for_load_state("networkidle", timeout=15000)
    except:
        await asyncio.sleep(5)
    
    # Log all frames in the detail page
    log(f"  Detail page frames: {len(detail_page.frames)}")
    
    for i, frame in enumerate(detail_page.frames):
        url = frame.url or ""
        if not url or "recaptcha" in url or url == "about:blank":
            continue
        
        fname = url.split('/')[-1].split('?')[0][:30]
        
        try:
            # Scroll to bottom of the frame to load bank data
            await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1)
            
            text = await frame.locator("body").text_content()
            if not text:
                continue
            text_lower = text.lower()
            
            # Check if this frame has bank-related content
            has_bank_keywords = any(k in text_lower for k in [
                "routing", "account number", "bank name", "direct deposit",
                "checking", "savings", "aba", "refund method"
            ])
            
            if has_bank_keywords:
                log(f"  ★ Bank data found in frame {i} ({fname})")
                
                # Extract from input fields
                inputs = await frame.locator("input").all()
                for inp in inputs:
                    n = (await inp.get_attribute("name") or "").lower()
                    iid = (await inp.get_attribute("id") or "").lower()
                    v = (await inp.get_attribute("value") or "").strip()
                    key = n or iid
                    if v and any(k in key for k in [
                        "bank", "routing", "account", "rtn", "acct", "aba",
                        "deposit", "refund", "checking", "savings"
                    ]):
                        bank_data[key] = v
                
                # Extract from select elements
                selects = await frame.locator("select").all()
                for sel in selects:
                    sn = (await sel.get_attribute("name") or "").lower()
                    sid = (await sel.get_attribute("id") or "").lower()
                    key = sn or sid
                    if any(k in key for k in ["bank", "account", "type", "deposit", "refund"]):
                        try:
                            val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                            if val:
                                bank_data[key] = val
                        except:
                            pass
                
                # Extract from TD label:value pairs
                tds = await frame.locator("td,th").all()
                for idx in range(len(tds) - 1):
                    try:
                        label = (await tds[idx].text_content() or "").strip()
                        if len(label) > 60:
                            continue
                        if any(k in label.lower() for k in [
                            "routing", "account num", "bank name", "checking",
                            "savings", "aba", "refund", "deposit", "account type"
                        ]):
                            value = (await tds[idx + 1].text_content() or "").strip()
                            if value and len(value) < 100:
                                bank_data[label.strip()[:50]] = value
                    except:
                        pass
                
                # Also try extracting from spans near bank-related labels
                spans = await frame.locator("span").all()
                for sp in spans:
                    try:
                        sp_text = (await sp.text_content() or "").strip()
                        sp_id = (await sp.get_attribute("id") or "").lower()
                        if any(k in sp_id for k in ["bank", "routing", "account", "rtn"]):
                            if sp_text:
                                bank_data[sp_id] = sp_text
                    except:
                        pass
                
                # Try to get the full HTML of the bank section for debugging (first client only)
                try:
                    html = await frame.locator("body").inner_html()
                    # Find bank section
                    html_lower = html.lower()
                    for keyword in ["routing", "bank name", "direct deposit"]:
                        idx = html_lower.find(keyword)
                        if idx >= 0:
                            start = max(0, idx - 500)
                            end = min(len(html), idx + 1000)
                            section = html[start:end]
                            log(f"  HTML around '{keyword}': ...{section[:300]}...")
                            break
                except:
                    pass
            
        except Exception as e:
            log(f"  Frame {i} error: {str(e)[:60]}")
    
    return bank_data


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f):
            os.remove(f)
    
    log("=== BANK ACCOUNT EXTRACTOR V2 ===")
    log("Key improvement: Handles popup windows for client details")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        ctx = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = await ctx.new_page()
        
        # Track popups
        new_pages = []
        ctx.on("page", lambda p: new_pages.append(p))
        
        try:
            if not await do_login(page):
                return
            
            # Navigate to Clients
            log("NAV_CLIENTS")
            for frame in page.frames:
                if "OLTPRO" in frame.url:
                    try:
                        cl = frame.locator("td:text-is('Clients')")
                        if await cl.count() > 0:
                            await cl.first.click(force=True)
                            await asyncio.sleep(5)
                            break
                    except:
                        pass
            
            # ── PHASE 1: Diagnostic - understand what happens when clicking a client ──
            log("=== DIAGNOSTIC: Understanding client click behavior ===")
            
            # Find the client frame and table
            client_frame = None
            for frame in page.frames:
                url = frame.url or ""
                if "LookUpInfo" in url or "OLTPRO_redirect" in url:
                    try:
                        tables = await frame.locator("table").all()
                        for t in tables:
                            rows = await t.locator("tr").all()
                            if len(rows) >= 3:
                                h = await rows[0].locator("th,td").all()
                                ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                                if "s.no" in ht:
                                    client_frame = frame
                                    break
                    except:
                        pass
                if client_frame:
                    break
            
            if not client_frame:
                log("ERROR: Cannot find client frame")
                await page.screenshot(path=f"{OUTPUT_DIR}/no_client_frame.png")
                return
            
            log(f"Client frame URL: {client_frame.url}")
            
            # Find first client with a real name
            tables = await client_frame.locator("table").all()
            client_table = None
            for t in tables:
                rows = await t.locator("tr").all()
                if len(rows) >= 3:
                    h = await rows[0].locator("th,td").all()
                    ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                    if "s.no" in ht:
                        client_table = t
                        break
            
            if not client_table:
                log("ERROR: Cannot find client table")
                return
            
            data_rows = await client_table.locator("tr").all()
            
            # Examine the first client link's attributes
            for row_idx in range(1, len(data_rows)):
                cells = await data_rows[row_idx].locator("td").all()
                if len(cells) < 3:
                    continue
                name = (await cells[1].text_content() or "").strip()
                if not name or name == ",":
                    continue
                
                # Get link attributes
                link = cells[1].locator("a")
                if await link.count() > 0:
                    href = await link.first.get_attribute("href") or ""
                    target = await link.first.get_attribute("target") or ""
                    onclick = await link.first.get_attribute("onclick") or ""
                    link_html = await link.first.evaluate("el => el.outerHTML")
                    log(f"CLIENT LINK: name={name}")
                    log(f"  href={href[:120]}")
                    log(f"  target={target}")
                    log(f"  onclick={onclick[:120]}")
                    log(f"  HTML={link_html[:200]}")
                else:
                    log(f"CLIENT: {name} - NO <a> TAG, just text")
                
                # Count pages before click
                pages_before = len(ctx.pages)
                log(f"  Pages before click: {pages_before}")
                new_pages.clear()
                
                # Try to catch popup
                try:
                    async with ctx.expect_page(timeout=10000) as popup_info:
                        if await link.count() > 0:
                            await link.first.click()
                        else:
                            await cells[1].click()
                    popup = await popup_info.value
                    log(f"  ★ POPUP DETECTED! URL: {popup.url[:100]}")
                    
                    # Wait for popup to load
                    try:
                        await popup.wait_for_load_state("networkidle", timeout=15000)
                    except:
                        await asyncio.sleep(5)
                    
                    # Take screenshot of popup
                    await popup.screenshot(path=f"{OUTPUT_DIR}/popup_detail.png")
                    
                    # Dump ALL frames in popup
                    log(f"  Popup frames: {len(popup.frames)}")
                    for fi, frame in enumerate(popup.frames):
                        url = frame.url or ""
                        if not url or url == "about:blank":
                            continue
                        fname = url.split('/')[-1].split('?')[0][:30]
                        try:
                            text = await frame.locator("body").text_content()
                            tc = " ".join(text.split())[:200] if text else ""
                            log(f"    PopupF{fi}({fname}): {tc[:150]}")
                            
                            # Scroll to bottom
                            await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await asyncio.sleep(1)
                            
                            text_after_scroll = await frame.locator("body").text_content()
                            tc2 = " ".join(text_after_scroll.split()) if text_after_scroll else ""
                            
                            # Check for bank keywords
                            if any(k in tc2.lower() for k in ["routing", "bank name", "account number", "direct deposit", "checking", "savings"]):
                                log(f"    ★★★ BANK DATA IN POPUP FRAME {fi} ★★★")
                                # Dump last 500 chars
                                log(f"    Last 500: {tc2[-500:]}")
                                
                                # Dump ALL inputs
                                inputs = await frame.locator("input").all()
                                for inp in inputs:
                                    n = (await inp.get_attribute("name") or "")
                                    v = (await inp.get_attribute("value") or "")
                                    if v or any(k in n.lower() for k in ["bank", "routing", "account", "rtn", "aba"]):
                                        log(f"      INPUT: name={n} value='{v[:50]}'")
                                
                                # Dump ALL selects
                                selects = await frame.locator("select").all()
                                for sel in selects:
                                    sn = (await sel.get_attribute("name") or "")
                                    try:
                                        val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                        if any(k in sn.lower() for k in ["bank", "account", "type", "deposit", "refund"]):
                                            log(f"      SELECT: name={sn} selected='{val}'")
                                    except:
                                        pass
                        except Exception as e:
                            log(f"    PopupF{fi} error: {str(e)[:60]}")
                    
                    # Extract bank data from popup
                    bank_data = await extract_bank_from_page(popup, name)
                    log(f"  Bank data extracted: {bank_data}")
                    
                    # Close popup
                    await popup.close()
                    log("  Popup closed")
                    
                except Exception as e:
                    log(f"  No popup detected: {str(e)[:80]}")
                    
                    # Check if navigation happened within the frame
                    await asyncio.sleep(3)
                    pages_after = len(ctx.pages)
                    log(f"  Pages after click: {pages_after}")
                    
                    # Check if any new pages were captured by event
                    if new_pages:
                        log(f"  ★ New pages via event: {len(new_pages)}")
                        for np in new_pages:
                            log(f"    New page URL: {np.url[:100]}")
                    
                    # Check ALL frames in ALL pages
                    for pi, pg in enumerate(ctx.pages):
                        log(f"  Page {pi}: {pg.url[:80]} ({len(pg.frames)} frames)")
                        for fi, frame in enumerate(pg.frames):
                            url = frame.url or ""
                            if not url or url == "about:blank" or "recaptcha" in url:
                                continue
                            fname = url.split('/')[-1].split('?')[0][:30]
                            try:
                                text = await frame.locator("body").text_content()
                                tc = " ".join(text.split())[:150] if text else ""
                                if tc:
                                    log(f"    P{pi}F{fi}({fname}): {tc[:100]}")
                            except:
                                pass
                    
                    # Check if frame content changed (navigated within iframe)
                    new_url = client_frame.url
                    log(f"  Client frame URL after click: {new_url}")
                    
                    # Try checking for bank content in all frames
                    for frame in page.frames:
                        url = frame.url or ""
                        if not url or url == "about:blank" or "recaptcha" in url:
                            continue
                        try:
                            text = await frame.locator("body").text_content()
                            if text and any(k in text.lower() for k in ["routing", "bank name", "direct deposit"]):
                                fname = url.split('/')[-1].split('?')[0][:30]
                                log(f"  ★ Bank content in main page frame ({fname})")
                                log(f"    Content around 'bank': {text[text.lower().find('bank')-100:text.lower().find('bank')+200]}")
                        except:
                            pass
                    
                    # Navigate back
                    try:
                        for frame in page.frames:
                            if "OLTPRO" in frame.url:
                                cl = frame.locator("td:text-is('Clients')")
                                if await cl.count() > 0:
                                    await cl.first.click(force=True)
                                    await asyncio.sleep(4)
                                    break
                    except:
                        pass
                
                # Only test with first client for diagnostic
                break
            
            log("=== DIAGNOSTIC COMPLETE ===")
            log("Next step: Based on diagnostic results, update the extraction script")
            
            await page.screenshot(path=f"{OUTPUT_DIR}/diag_v2_final.png")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/bank_v2_error.png")
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
