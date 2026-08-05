"""
Tax Portal - Bank Account Extractor FINAL
Uses DOUBLE-CLICK (ondblclick) to open client detail via OLTPRO_ManageReturnsTab.php
Then navigates to Client Info tab, scrolls to bottom, extracts bank data.
"""
import asyncio
import base64
import json
import os
import re
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
LOG_FILE = "/tmp/bank_final_status.txt"
BANK_OUTPUT = "/app/backend/scraped_data/bank_data.json"
PROGRESS_FILE = "/app/backend/scraped_data/bank_progress.json"

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
        text="Solve. Return ONLY ONE answer word or number. If it asks to identify from a list, return that word. If math, return the number.",
        file_contents=[ImageContent(image_base64=b)]))
    return r.strip().strip('"').strip("'").lower()

async def do_login(page):
    log("LOGIN_START")
    await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
    await asyncio.sleep(3)
    if "might be a robot" in await page.content():
        log("CLOUDFLARE")
        await page.locator("img").first.screenshot(path=f"{OUTPUT_DIR}/cf.png")
        a = await solve_captcha(f"{OUTPUT_DIR}/cf.png")
        await page.locator("input[type='text']").first.fill(a)
        await page.locator("text=CONTINUE").click()
        await asyncio.sleep(5)
        await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(3)
    
    lf = None
    for frame in page.frames:
        if "cobrandLogin" in frame.url: lf = frame; break
    if not lf: log("ERROR: No login frame"); return False
    
    await lf.locator("#id_input-username").fill(FIRM_ID)
    await lf.locator("#id_input-passwrd").fill(PASSWORD)
    await lf.locator("#id_input-firmName").fill(USERNAME)
    await asyncio.sleep(1)
    await lf.locator("#LoginButton").click(force=True)
    log("LOGIN_SUBMITTED")
    await asyncio.sleep(5)
    
    for frame in page.frames:
        if "OLTPRO_captcha" in frame.url:
            imgs = await frame.locator("img").all()
            if imgs:
                cp = f"{OUTPUT_DIR}/cap.png"
                src = await imgs[0].get_attribute("src") or ""
                if src.startswith("data:image"):
                    with open(cp, "wb") as f: f.write(base64.b64decode(src.split(",", 1)[1]))
                else: await imgs[0].screenshot(path=cp)
                a = await solve_captcha(cp)
                log(f"CAPTCHA: {a}")
                inp = frame.locator("input[type='text']")
                if await inp.count() > 0: await inp.first.fill(a)
                sub = frame.locator("input[type='submit'],input[value='Submit']")
                if await sub.count() > 0: await sub.first.click(force=True)
                await asyncio.sleep(5)
            break
    
    for frame in page.frames:
        url = frame.url or ""
        if url and "recaptcha" not in url and url != "about:blank":
            try:
                t = await frame.locator("body").text_content()
                if t and ("verification" in t.lower() or "send me" in t.lower()):
                    rs = await frame.locator("input[type='radio']").all()
                    for r in rs:
                        v = await r.get_attribute("value") or ""
                        if "sms" in v.lower(): await r.click(force=True); break
                    cb = frame.locator("input[type='checkbox']")
                    if await cb.count() > 0:
                        try: await cb.first.check(force=True)
                        except: pass
                    await asyncio.sleep(1)
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["continue", "send", "submit"]):
                            await b.click(force=True); log("SMS_SENT"); break
                    await asyncio.sleep(5); break
            except: pass
    
    await asyncio.sleep(8)
    log("WAITING_FOR_CODE")
    code = ""
    for _ in range(1800):
        if os.path.exists(CODE_FILE):
            with open(CODE_FILE) as f: code = f.read().strip()
            if code and len(code) >= 4: log(f"CODE: {code}"); os.remove(CODE_FILE); break
        await asyncio.sleep(1)
    if not code: log("ERROR: No code"); return False
    
    for frame in page.frames:
        try:
            ci = frame.locator("input[name='verifiy_code']")
            if await ci.count() > 0:
                await ci.first.fill(code)
                bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                for b in bs:
                    v = await b.get_attribute("value") or await b.text_content() or ""
                    if "verify" in v.lower(): await b.click(force=True); break
                break
        except: pass
    await asyncio.sleep(8)
    
    for frame in page.frames:
        try:
            nn = frame.locator("input[value='Not at this time']")
            if await nn.count() > 0: await nn.first.click(force=True); log("DISMISSED_SETUP")
        except: pass
    await asyncio.sleep(5)
    
    for frame in page.frames:
        try:
            t = await frame.locator("body").text_content()
            if t and any(k in t.lower() for k in ["pin", "code", "security", "enter"]):
                inputs = await frame.locator("input[type='text'],input[type='password'],input[type='tel']").all()
                if inputs:
                    await inputs[0].fill("1990"); log("ENTERED_1990")
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["verify", "submit", "continue"]):
                            await b.click(force=True); break
                    await asyncio.sleep(5)
        except: pass
    
    log("LOGIN_COMPLETE")
    return True


def find_client_table_frame(page):
    """Find the frame containing the client table."""
    for frame in page.frames:
        url = frame.url or ""
        if "LookUpInfo" in url or "OLTPRO_redirect" in url:
            return frame
    return None


async def get_clients_on_page(frame):
    """Extract client rows with their ondblclick URLs from the current page."""
    clients = await frame.evaluate("""() => {
        const tables = document.querySelectorAll('table');
        for (const t of tables) {
            const rows = t.querySelectorAll('tr');
            if (rows.length < 3) continue;
            const headerText = rows[0].textContent.toLowerCase();
            if (!headerText.includes('s.no')) continue;
            
            let clients = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) continue;
                
                const name = cells[1].textContent.trim();
                if (!name || name === ',') continue;
                
                const ondblclick = row.getAttribute('ondblclick') || '';
                // Extract URL from ondblclick
                const match = ondblclick.match(/location\\.href='([^']+)'/);
                const url = match ? match[1] : '';
                
                clients.push({
                    sno: cells[0].textContent.trim(),
                    name: name,
                    ssn: cells[2].textContent.trim(),
                    detail_url: url
                });
            }
            return clients;
        }
        return [];
    }""")
    return clients


async def extract_bank_data_from_detail(frame):
    """Extract bank account data from the ManageReturnsTab detail page.
    The bank info is at the bottom of the client info page.
    """
    bank_data = {}
    
    # First, look for "Client Info" or similar tab in the detail page
    # The ManageReturnsTab may have sub-tabs
    try:
        # Check all frames for bank-relevant content
        for f in frame.page.frames:
            url = f.url or ""
            if not url or url == "about:blank" or "recaptcha" in url:
                continue
            
            try:
                text = await f.locator("body").text_content(timeout=5000)
                if not text:
                    continue
                text_lower = text.lower()
                
                # Look for bank-specific keywords (not just "bank" which could be in filters)
                has_bank = any(k in text_lower for k in [
                    "routing number", "account number", "bank name",
                    "direct deposit", "refund method", "checking account",
                    "savings account", "rtn", "drt"
                ])
                
                if has_bank:
                    fname = url.split('/')[-1].split('?')[0][:30]
                    
                    # Scroll to bottom to make sure bank data is loaded
                    await f.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await asyncio.sleep(1)
                    
                    # Extract from ALL inputs
                    inputs = await f.locator("input").all()
                    for inp in inputs:
                        n = (await inp.get_attribute("name") or "")
                        iid = (await inp.get_attribute("id") or "")
                        v = (await inp.get_attribute("value") or "").strip()
                        key = n or iid
                        key_lower = key.lower()
                        if v and any(k in key_lower for k in [
                            "bank", "routing", "account", "rtn", "acct", "aba",
                            "deposit", "refund", "drt", "checking", "savings"
                        ]):
                            bank_data[key] = v
                    
                    # Extract from selects
                    selects = await f.locator("select").all()
                    for sel in selects:
                        sn = (await sel.get_attribute("name") or "")
                        sid = (await sel.get_attribute("id") or "")
                        key = sn or sid
                        key_lower = key.lower()
                        if any(k in key_lower for k in ["bank", "account", "type", "deposit", "refund"]):
                            try:
                                val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                if val and val != "Select":
                                    bank_data[key] = val
                            except:
                                pass
                    
                    # Extract from label:value TD pairs
                    tds = await f.locator("td,th").all()
                    for idx in range(len(tds) - 1):
                        try:
                            label = (await tds[idx].text_content() or "").strip()
                            if len(label) > 80 or len(label) < 3:
                                continue
                            label_lower = label.lower()
                            if any(k in label_lower for k in [
                                "routing", "account num", "bank name", "checking",
                                "savings", "aba", "refund", "deposit", "account type",
                                "rtn", "drt"
                            ]):
                                value = (await tds[idx + 1].text_content() or "").strip()
                                if value and len(value) < 100:
                                    bank_data[label.strip()[:50]] = value
                        except:
                            pass
                    
                    # Also try extracting from spans
                    spans = await f.locator("span").all()
                    for sp in spans:
                        try:
                            sp_id = (await sp.get_attribute("id") or "").lower()
                            if any(k in sp_id for k in ["bank", "routing", "account", "rtn"]):
                                sp_text = (await sp.text_content() or "").strip()
                                if sp_text:
                                    bank_data[sp_id] = sp_text
                        except:
                            pass
                    
                    if bank_data:
                        break  # Found bank data, no need to check more frames
                        
            except:
                pass
    except Exception as e:
        log(f"    Bank extraction error: {str(e)[:60]}")
    
    return bank_data


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    
    log("=== BANK ACCOUNT EXTRACTOR - FINAL VERSION ===")
    log("Uses DOUBLE-CLICK (ondblclick) to open client details")
    
    # Load previous progress if any
    all_bank_data = []
    processed_ssns = set()
    start_page = 1
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE) as f:
                progress = json.load(f)
            all_bank_data = progress.get("results", [])
            processed_ssns = set(progress.get("processed_ssns", []))
            start_page = progress.get("last_page", 1)
            log(f"Resuming from page {start_page}, {len(processed_ssns)} already processed")
        except:
            pass
    
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
                            await asyncio.sleep(8)
                            break
                    except:
                        pass
            
            # ── First, do a diagnostic with ONE client to verify the approach ──
            log("=== PHASE 1: Verify approach with first client ===")
            
            # Skip to page 3 for real clients
            table_frame = find_client_table_frame(page)
            if not table_frame:
                log("ERROR: No client frame found")
                return
            
            for _ in range(2):
                try:
                    nb = table_frame.locator("a:text-is('Next')")
                    if await nb.count() > 0:
                        await nb.first.click(force=True)
                        await asyncio.sleep(4)
                except:
                    pass
            
            # Refresh frame reference after navigation
            table_frame = find_client_table_frame(page)
            if not table_frame:
                log("ERROR: Lost client frame after pagination")
                return
            
            # Get clients on this page
            clients = await get_clients_on_page(table_frame)
            log(f"Found {len(clients)} clients on page 3")
            
            if not clients:
                log("ERROR: No clients found")
                return
            
            # Test with first client
            test_client = clients[0]
            log(f"Testing with: {test_client['name']} ({test_client['ssn']})")
            log(f"Detail URL: {test_client['detail_url'][:80]}")
            
            if not test_client['detail_url']:
                log("ERROR: No detail URL found in ondblclick")
                return
            
            # DOUBLE-CLICK approach: Navigate the frame to the detail URL
            # The ondblclick sets location.href which navigates within the frame
            # We can directly navigate the frame to this URL
            base_url = table_frame.url.rsplit('/', 1)[0]  # Get base path
            detail_full_url = base_url + '/' + test_client['detail_url'].replace('../oltproc/', '')
            
            # Actually, let's use the dblclick on the row element directly
            # This is more reliable as it preserves session/cookie context
            log("Double-clicking client row...")
            
            # Find and double-click the row
            row_dblclicked = await table_frame.evaluate(f"""(ssn) => {{
                const tables = document.querySelectorAll('table');
                for (const t of tables) {{
                    const rows = t.querySelectorAll('tr');
                    for (let i = 1; i < rows.length; i++) {{
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length >= 3 && cells[2].textContent.trim() === ssn) {{
                            // Trigger the ondblclick event
                            const event = new MouseEvent('dblclick', {{bubbles: true}});
                            rows[i].dispatchEvent(event);
                            return true;
                        }}
                    }}
                }}
                return false;
            }}""", test_client['ssn'])
            
            log(f"Double-click dispatched: {row_dblclicked}")
            await asyncio.sleep(8)
            
            # Check what happened - the frame should now show ManageReturnsTab
            log("Checking frames after double-click...")
            for fi, frame in enumerate(page.frames):
                url = frame.url or ""
                if not url or url == "about:blank" or "recaptcha" in url:
                    continue
                fname = url.split('/')[-1].split('?')[0][:35]
                try:
                    text = await frame.locator("body").text_content(timeout=5000)
                    tc = " ".join(text.split())[:150] if text else ""
                    log(f"  F{fi}({fname}): {tc[:120]}")
                except:
                    log(f"  F{fi}({fname}): (timeout)")
            
            # Look for the ManageReturnsTab frame
            manage_frame = None
            for frame in page.frames:
                if "ManageReturns" in frame.url:
                    manage_frame = frame
                    log(f"★ ManageReturnsTab found! URL: {frame.url[:80]}")
                    break
            
            if not manage_frame:
                log("ManageReturnsTab not found directly, checking if frame URL changed...")
                table_frame = find_client_table_frame(page)
                if table_frame:
                    new_url = table_frame.url
                    log(f"Frame URL now: {new_url[:80]}")
                    if "ManageReturns" in new_url:
                        manage_frame = table_frame
                        log("★ Frame navigated to ManageReturnsTab!")
            
            if manage_frame:
                # SUCCESS! Now look for Client Info tab and bank data
                log("Looking for bank data in ManageReturnsTab...")
                
                # First, take screenshot
                await page.screenshot(path=f"{OUTPUT_DIR}/manage_returns_tab.png")
                
                # Look for Client Info tab/link
                links = await manage_frame.locator("a").all()
                for link in links[:30]:
                    text = (await link.text_content() or "").strip()
                    if text:
                        log(f"  Link: '{text}'")
                        if any(k in text.lower() for k in ["client info", "info", "personal", "bank"]):
                            log(f"  ★ Clicking: '{text}'")
                            await link.click(force=True)
                            await asyncio.sleep(5)
                            break
                
                # Dump ALL frames to see what we have
                for fi, frame in enumerate(page.frames):
                    url = frame.url or ""
                    if not url or url == "about:blank" or "recaptcha" in url:
                        continue
                    fname = url.split('/')[-1].split('?')[0][:35]
                    try:
                        # Scroll to bottom
                        await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(1)
                        
                        text = await frame.locator("body").text_content(timeout=5000)
                        if not text:
                            continue
                        text_lower = text.lower()
                        
                        # Check for actual bank data keywords
                        bank_keywords = ["routing", "account number", "bank name", "direct deposit", 
                                        "refund method", "checking", "savings"]
                        found = [k for k in bank_keywords if k in text_lower]
                        
                        if found:
                            log(f"  ★★★ BANK DATA in F{fi}({fname}): keywords={found}")
                            
                            # Extract bank data
                            bank = await extract_bank_data_from_detail(frame)
                            log(f"  Extracted bank data: {bank}")
                            
                            # Also dump the last 800 chars for context
                            tc = " ".join(text.split())
                            log(f"  Last 500 chars: {tc[-500:]}")
                            
                            # Save the raw HTML of bank section
                            html = await frame.locator("body").inner_html()
                            for kw in ["routing", "bank name", "direct deposit"]:
                                idx = html.lower().find(kw)
                                if idx >= 0:
                                    section = html[max(0, idx-300):idx+500]
                                    with open(f"{OUTPUT_DIR}/bank_html_section.txt", "w") as fout:
                                        fout.write(section)
                                    log(f"  Bank HTML section saved ({len(section)} chars)")
                                    break
                    except:
                        pass
                
                await page.screenshot(path=f"{OUTPUT_DIR}/after_bank_check.png")
            else:
                log("ERROR: Could not navigate to client detail page")
                log("Trying alternative: direct frame navigation...")
                
                # Try navigating frame directly
                relative_url = test_client['detail_url']
                if relative_url.startswith('../'):
                    # Convert relative URL to absolute
                    # Base URL of the frame is something like:
                    # https://www.mytaxoffice.com/2025/oltpro/oltproc/OLTPRO_LookUpInfo.php
                    frame_base = table_frame.url.rsplit('/', 1)[0]
                    abs_url = frame_base + '/' + relative_url.lstrip('./')
                    log(f"Navigating frame to: {abs_url[:100]}")
                    
                    try:
                        await table_frame.goto(abs_url, wait_until="networkidle", timeout=15000)
                        await asyncio.sleep(5)
                        
                        log("Frame navigated! Checking content...")
                        text = await table_frame.locator("body").text_content(timeout=5000)
                        tc = " ".join(text.split())[:200] if text else ""
                        log(f"Content: {tc}")
                        
                        await page.screenshot(path=f"{OUTPUT_DIR}/direct_nav_result.png")
                    except Exception as e:
                        log(f"Direct navigation failed: {e}")
            
            log("=== PHASE 1 COMPLETE ===")
            log("Review the output and screenshots to refine the full extraction")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/bank_final_error.png")
        finally:
            await browser.close()
    
    log("=== DONE ===")


if __name__ == "__main__":
    asyncio.run(main())
