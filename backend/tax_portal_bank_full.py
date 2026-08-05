"""
Tax Portal - FULL Bank Data Extraction for ALL Clients
Flow per client: Client List → DblClick → ManageReturnsTab → Edit → Personal Info → Extract ALL inputs → Back to Client List
Saves progress after each page to enable resume.
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
LOG_FILE = "/tmp/bank_full_status.txt"
PROGRESS_FILE = "/app/backend/scraped_data/bank_progress.json"
BANK_OUTPUT = "/app/backend/scraped_data/bank_data.json"

# Bank-related field name patterns (case-insensitive)
BANK_FIELDS = [
    "routing", "account", "rtn", "acct", "bank", "deposit",
    "refund", "drt", "check", "saving", "aba", "dd8888"
]

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def save_progress(results, processed_ssns, last_page):
    """Save current progress to enable resume."""
    with open(PROGRESS_FILE, "w") as f:
        json.dump({
            "results": results,
            "processed_ssns": list(processed_ssns),
            "last_page": last_page,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)

def save_final(results):
    """Save final results."""
    with open(BANK_OUTPUT, "w") as f:
        json.dump({
            "count": len(results),
            "extracted_at": datetime.now().isoformat(),
            "clients": results
        }, f, indent=2)
    log(f"★ Final results saved: {len(results)} clients to {BANK_OUTPUT}")

async def solve_captcha(image_path):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"c{time.time()}",
                    system_message="Solve CAPTCHAs. Return ONLY ONE word or number.")
    chat.with_model("openai", "gpt-4o")
    with open(image_path, "rb") as f:
        b = base64.b64encode(f.read()).decode()
    r = await chat.send_message(UserMessage(text="Solve. ONLY ONE answer.",
        file_contents=[ImageContent(image_base64=b)]))
    return r.strip().strip('"').strip("'").lower()

async def do_login(page):
    log("LOGIN_START")
    await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(3)
    if "might be a robot" in await page.content():
        await page.locator("img").first.screenshot(path=f"{OUTPUT_DIR}/cf.png")
        a = await solve_captcha(f"{OUTPUT_DIR}/cf.png")
        await page.locator("input[type='text']").first.fill(a)
        await page.locator("text=CONTINUE").click()
        await asyncio.sleep(5)
        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
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
    log("LOGIN_SUBMITTED"); await asyncio.sleep(5)
    
    # CAPTCHA retry loop (up to 3 attempts)
    for captcha_attempt in range(3):
        captcha_found = False
        for frame in page.frames:
            if "OLTPRO_captcha" in frame.url:
                captcha_found = True
                imgs = await frame.locator("img").all()
                if imgs:
                    cp = f"{OUTPUT_DIR}/cap.png"
                    src = await imgs[0].get_attribute("src") or ""
                    if src.startswith("data:image"):
                        with open(cp,"wb") as f: f.write(base64.b64decode(src.split(",",1)[1]))
                    else: await imgs[0].screenshot(path=cp)
                    a = await solve_captcha(cp); log(f"CAPTCHA attempt {captcha_attempt+1}: {a}")
                    inp = frame.locator("input[type='text']")
                    if await inp.count()>0: await inp.first.fill(a)
                    sub = frame.locator("input[type='submit'],input[value='Submit']")
                    if await sub.count()>0: await sub.first.click(force=True)
                    await asyncio.sleep(5)
                    
                    # Check if CAPTCHA failed - check BOTH main page and iframes
                    captcha_failed = False
                    for check_frame in page.frames:
                        try:
                            fc = await check_frame.content()
                            if "incorrect answer" in fc.lower() or "incorrect" in fc.lower() and "security" in fc.lower():
                                captcha_failed = True
                                break
                        except: pass
                    
                    if captcha_failed:
                        log(f"CAPTCHA_FAILED attempt {captcha_attempt+1}, retrying...")
                        # Reload and try again
                        await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
                        await asyncio.sleep(3)
                        if "might be a robot" in await page.content():
                            await page.locator("img").first.screenshot(path=f"{OUTPUT_DIR}/cf.png")
                            cf_a = await solve_captcha(f"{OUTPUT_DIR}/cf.png")
                            await page.locator("input[type='text']").first.fill(cf_a)
                            await page.locator("text=CONTINUE").click()
                            await asyncio.sleep(5)
                            await page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=30000)
                            await asyncio.sleep(3)
                        # Re-fill login form
                        lf = None
                        for f2 in page.frames:
                            if "cobrandLogin" in f2.url: lf = f2; break
                        if lf:
                            await lf.locator("#id_input-username").fill(FIRM_ID)
                            await lf.locator("#id_input-passwrd").fill(PASSWORD)
                            await lf.locator("#id_input-firmName").fill(USERNAME)
                            await asyncio.sleep(1)
                            await lf.locator("#LoginButton").click(force=True)
                            log("LOGIN_RE_SUBMITTED"); await asyncio.sleep(5)
                        continue
                    else:
                        log("CAPTCHA_PASSED")
                        break
                break
        if not captcha_found:
            break
    for frame in page.frames:
        url = frame.url or ""
        if url and "recaptcha" not in url and url != "about:blank":
            try:
                t = await frame.locator("body").text_content()
                if t and ("verification" in t.lower() or "send me" in t.lower() or "two-factor" in t.lower() or "2fa" in t.lower()):
                    log(f"2FA_PAGE_FOUND in frame: {url[:60]}")
                    # Save debug screenshot
                    try:
                        await page.screenshot(path="/tmp/2fa_page.png")
                        log("2FA screenshot saved")
                    except: pass
                    
                    rs = await frame.locator("input[type='radio']").all()
                    log(f"2FA: Found {len(rs)} radio buttons")
                    for r in rs:
                        v = await r.get_attribute("value") or ""
                        log(f"2FA: Radio value='{v}'")
                        if "sms" in v.lower(): await r.click(force=True); log("SMS_RADIO_SELECTED"); break
                    cb = frame.locator("input[type='checkbox']")
                    if await cb.count()>0:
                        try: await cb.first.check(force=True)
                        except: pass
                    await asyncio.sleep(2)
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    log(f"2FA: Found {len(bs)} buttons")
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        log(f"2FA: Button value='{v}'")
                        if any(k in v.lower() for k in ["continue","send","submit","next"]):
                            await b.click(force=True); log("SMS_SENT"); break
                    await asyncio.sleep(5); break
            except Exception as e:
                log(f"2FA frame error: {e}")
    
    # Extra wait for SMS delivery
    await asyncio.sleep(5)
    
    # Save screenshot before waiting for code
    try:
        await page.screenshot(path="/tmp/2fa_waiting.png")
    except: pass
    
    log("WAITING_FOR_CODE")
    code = ""
    for _ in range(1800):
        if os.path.exists(CODE_FILE):
            with open(CODE_FILE) as f: code = f.read().strip()
            if code and len(code)>=4: log(f"CODE: {code}"); os.remove(CODE_FILE); break
        await asyncio.sleep(1)
    if not code: log("ERROR: No code"); return False
    for frame in page.frames:
        try:
            ci = frame.locator("input[name='verifiy_code']")
            if await ci.count()>0:
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
            if await nn.count()>0: await nn.first.click(force=True); log("DISMISSED_SETUP")
        except: pass
    await asyncio.sleep(5)
    for frame in page.frames:
        try:
            t = await frame.locator("body").text_content()
            if t and any(k in t.lower() for k in ["pin","code","security","enter"]):
                inputs = await frame.locator("input[type='text'],input[type='password'],input[type='tel']").all()
                if inputs:
                    await inputs[0].fill("1990"); log("ENTERED_1990")
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["verify","submit","continue"]):
                            await b.click(force=True); break
                    await asyncio.sleep(5)
        except: pass
    log("LOGIN_COMPLETE"); return True


async def nav_to_clients(page):
    """Navigate to Clients/Returns tab."""
    await asyncio.sleep(5)
    
    log(f"NAV: Found {len(page.frames)} frames")
    for i, frame in enumerate(page.frames):
        log(f"  Frame {i}: {frame.url[:80] if frame.url else 'no-url'}")
    
    # Scan ALL frames for "Returns" or "Clients" clickable elements
    for frame in page.frames:
        try:
            all_els = await frame.locator("td[onclick], a[onclick]").all()
            for el in all_els:
                try:
                    txt = (await el.text_content(timeout=3000) or "").strip()
                    clean = " ".join(txt.split())
                    if clean.startswith("Returns") or clean.startswith("Clients"):
                        log(f"NAV: Found clickable: '{clean[:40]}'")
                        await el.click(force=True)
                        log("NAV: Clicked, waiting for table to load...")
                        # Wait longer for the frame to navigate and load
                        await asyncio.sleep(15)
                        # Log frame state after click
                        for i, f in enumerate(page.frames):
                            log(f"  Post-click Frame {i}: {f.url[:80] if f.url else 'no-url'}")
                        return True
                except:
                    continue
        except:
            continue
    
    log("NAV: No Returns/Clients found, trying 'Switch to Classic View'...")
    # Try switching to Classic View which may show Clients tab
    for frame in page.frames:
        try:
            switch_el = frame.locator("text=Switch to Classic View")
            if await switch_el.count() > 0:
                await switch_el.first.click(force=True)
                await asyncio.sleep(8)
                log("NAV: Switched to Classic View")
                # Retry finding Clients
                for f2 in page.frames:
                    try:
                        all_els = await f2.locator("td[onclick], a[onclick]").all()
                        for el in all_els:
                            txt = (await el.text_content(timeout=3000) or "").strip()
                            clean = " ".join(txt.split())
                            if clean.startswith("Returns") or clean.startswith("Clients"):
                                await el.click(force=True)
                                await asyncio.sleep(8)
                                log(f"NAV: Clicked '{clean[:30]}' after classic switch!")
                                return True
                    except:
                        continue
        except:
            continue
    
    # Save debug screenshot
    try:
        await page.screenshot(path="/tmp/nav_clients_fail.png")
        log("NAV: Screenshot saved to /tmp/nav_clients_fail.png")
    except:
        pass
    
    return False


async def find_table_frame(page):
    """Find the frame containing the client table."""
    log(f"TABLE: Searching {len(page.frames)} frames...")
    
    # Priority 1: Check OLTPRO_start frame (client list loads here after clicking Clients)
    for frame in page.frames:
        url = frame.url or ""
        if "OLTPRO_start" in url:
            try:
                result = await frame.evaluate("""() => {
                    const tables = document.querySelectorAll('table');
                    for (const t of tables) {
                        const text = t.textContent || '';
                        // Look for client table markers: S.No + SSN-like patterns or names with comma
                        if (text.toLowerCase().includes('s.no') && text.includes('XXX-XX-')) {
                            return {found: true, rows: t.querySelectorAll('tr').length};
                        }
                    }
                    return {found: false, tables: tables.length};
                }""")
                if result.get('found'):
                    log(f"TABLE: Found client table in OLTPRO_start ({result['rows']} rows)")
                    return frame
                else:
                    log(f"TABLE: OLTPRO_start has {result.get('tables',0)} tables but no client data")
            except Exception as e:
                log(f"TABLE: Error checking OLTPRO_start: {str(e)[:60]}")
    
    # Priority 2: Check LookUpInfo frames  
    for frame in page.frames:
        url = frame.url or ""
        if "LookUpInfo" in url:
            try:
                has_table = await frame.evaluate("""() => {
                    const tables = document.querySelectorAll('table');
                    for (const t of tables) {
                        if (t.textContent.includes('XXX-XX-')) return true;
                    }
                    return false;
                }""")
                if has_table:
                    log(f"TABLE: Found in LookUpInfo frame")
                    return frame
            except:
                pass
    
    # Priority 3: Check ALL frames for actual client data
    for frame in page.frames:
        url = frame.url or ""
        if "about:blank" in url or not url:
            continue
        try:
            result = await frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                for (const t of tables) {
                    const text = t.textContent || '';
                    if (text.includes('XXX-XX-') || (text.toLowerCase().includes('s.no') && text.includes(','))) {
                        return {found: true, rows: t.querySelectorAll('tr').length, sample: text.substring(0, 200).replace(/\\s+/g, ' ')};
                    }
                }
                return {found: false};
            }""")
            if result.get('found'):
                log(f"TABLE: Found in frame {url[:50]} ({result.get('rows',0)} rows)")
                return frame
        except:
            continue
    
    # Debug: dump all tables from all frames
    for frame in page.frames:
        url = frame.url or ""
        if "about:blank" in url or not url:
            continue
        try:
            info = await frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                let results = [];
                for (const t of tables) {
                    const rows = t.querySelectorAll('tr').length;
                    const text = (t.textContent || '').substring(0, 150).replace(/\\s+/g, ' ').trim();
                    results.push({rows: rows, text: text});
                }
                return results;
            }""")
            for t in info:
                log(f"TABLE DEBUG: {url[:40]} - {t['rows']} rows: {t['text'][:80]}")
        except:
            continue
    
    log("TABLE: No table frame found!")
    return None


async def get_page_clients(table_frame):
    """Get all clients on the current page with their ondblclick URLs."""
    return await table_frame.evaluate("""() => {
        const tables = document.querySelectorAll('table');
        for (const t of tables) {
            const rows = t.querySelectorAll('tr');
            if (rows.length < 3) continue;
            if (!rows[0].textContent.toLowerCase().includes('s.no')) continue;
            
            let clients = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) continue;
                const name = cells[1].textContent.trim();
                if (!name || name === ',') continue;
                const ondblclick = row.getAttribute('ondblclick') || '';
                clients.push({
                    sno: cells[0].textContent.trim(),
                    name: name,
                    ssn: cells[2] ? cells[2].textContent.trim() : '',
                    ondblclick_url: ondblclick
                });
            }
            return clients;
        }
        return [];
    }""")


async def dblclick_client(table_frame, ssn):
    """Double-click a client row by SSN to navigate to ManageReturnsTab."""
    return await table_frame.evaluate(f"""(ssn) => {{
        const tables = document.querySelectorAll('table');
        for (const t of tables) {{
            const rows = t.querySelectorAll('tr');
            for (let i = 1; i < rows.length; i++) {{
                const cells = rows[i].querySelectorAll('td');
                if (cells.length >= 3 && cells[2].textContent.trim() === ssn) {{
                    rows[i].dispatchEvent(new MouseEvent('dblclick', {{bubbles: true}}));
                    return true;
                }}
            }}
        }}
        return false;
    }}""", ssn)


async def click_edit(page):
    """Click the Edit button in ManageReturnsTab to open form editor."""
    manage_frame = None
    for frame in page.frames:
        if "ManageReturns" in frame.url:
            manage_frame = frame
            break
    
    if not manage_frame:
        return False
    
    # Click the EditClickBtn div
    try:
        edit_btn = manage_frame.locator("#EditClickBtn")
        if await edit_btn.count() > 0:
            await edit_btn.first.click(force=True)
            return True
        # Fallback: try text match
        edit_div = manage_frame.locator("div:text-is('Edit')")
        if await edit_div.count() > 0:
            await edit_div.first.click(force=True)
            return True
    except:
        pass
    return False


async def extract_bank_fields(page):
    """Extract ALL bank-related fields from popup_redirect.php frame.
    Returns dict of field_name: value pairs.
    """
    bank_data = {}
    
    # Find the popup_redirect.php frame (which loads Personal Info form)
    target_frame = None
    for frame in page.frames:
        url = frame.url or ""
        if "popup_redirect" in url:
            target_frame = frame
            break
    
    if not target_frame:
        return bank_data
    
    # Extract ALL inputs from the form using JavaScript
    try:
        all_fields = await target_frame.evaluate("""() => {
            const result = {};
            
            // All inputs
            document.querySelectorAll('input').forEach(inp => {
                const name = inp.name || inp.id || '';
                if (!name) return;
                const nameLower = name.toLowerCase();
                
                // Bank fields
                const isBankField = ['routing', 'account', 'rtn', 'acct', 'bank', 'deposit',
                    'refund', 'drt', 'check', 'saving', 'aba', 'dd8888', 'directdeposit'].some(k => nameLower.includes(k));
                
                if (isBankField) {
                    if (inp.type === 'checkbox' || inp.type === 'radio') {
                        result[name] = inp.checked ? inp.value : '';
                    } else {
                        result[name] = inp.value || '';
                    }
                }
            });
            
            // All selects related to bank
            document.querySelectorAll('select').forEach(sel => {
                const name = sel.name || sel.id || '';
                const nameLower = name.toLowerCase();
                const isBankField = ['routing', 'account', 'bank', 'deposit', 'refund',
                    'type', 'dd8888'].some(k => nameLower.includes(k));
                if (isBankField) {
                    result[name] = sel.options[sel.selectedIndex]?.text || '';
                }
            });
            
            // Bank Name from span
            const bankName = document.getElementById('lblBankName');
            if (bankName) result['bankName'] = bankName.textContent.trim();
            
            // Direct Deposit section text extraction
            const labels = document.querySelectorAll('span.OLTLabelField, td');
            let nextIsValue = false;
            let lastLabel = '';
            labels.forEach(el => {
                const text = el.textContent.trim();
                const lower = text.toLowerCase();
                if (['routing number', 'account number', 're-type routing', 're-type account',
                     'bank name', 'direct deposit', 'refund method', 'account type'].some(k => lower.includes(k))) {
                    lastLabel = text;
                    nextIsValue = true;
                }
            });
            
            return result;
        }""")
        
        bank_data = all_fields or {}
    except Exception as e:
        log(f"    Extract error: {str(e)[:60]}")
    
    return bank_data


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    
    log("=== FULL BANK DATA EXTRACTION ===")
    
    # Load progress
    results = []
    processed_ssns = set()
    start_page = 1
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE) as f:
                progress = json.load(f)
            results = progress.get("results", [])
            processed_ssns = set(progress.get("processed_ssns", []))
            start_page = progress.get("last_page", 1)
            log(f"RESUMING from page {start_page}, {len(processed_ssns)} already done")
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
            
            # Extra wait for post-login page to fully load
            await asyncio.sleep(10)
            
            # Navigate to Clients
            if not await nav_to_clients(page):
                log("ERROR: Cannot navigate to Clients")
                return
            
            # Skip to start_page
            table_frame = await find_table_frame(page)
            if not table_frame:
                log("ERROR: No table frame found")
                return
            
            current_page = 1
            if start_page > 1:
                for _ in range(start_page - 1):
                    try:
                        nb = table_frame.locator("a:text-is('Next')")
                        if await nb.count() > 0:
                            await nb.first.click(force=True)
                            await asyncio.sleep(3)
                            current_page += 1
                    except:
                        break
                table_frame = await find_table_frame(page)
                log(f"Navigated to page {current_page}")
            
            total_extracted = len(results)
            total_with_bank = len([r for r in results if r.get("has_bank_data")])
            errors = 0
            max_errors = 20
            
            # Process all pages
            while True:
                # Refresh table frame reference
                table_frame = await find_table_frame(page)
                if not table_frame:
                    log("Lost table frame, trying to navigate back...")
                    if not await nav_to_clients(page):
                        log("ERROR: Cannot recover table frame")
                        break
                    table_frame = await find_table_frame(page)
                    if not table_frame:
                        break
                
                # Get clients on this page
                page_clients = await get_page_clients(table_frame)
                log(f"\n=== PAGE {current_page}: {len(page_clients)} clients ===")
                
                if not page_clients:
                    log("No clients on this page, done!")
                    break
                
                for ci, client in enumerate(page_clients):
                    ssn = client['ssn']
                    name = client['name']
                    
                    # Skip already processed
                    if ssn in processed_ssns:
                        log(f"  [{ci+1}/{len(page_clients)}] SKIP {name} (already done)")
                        continue
                    
                    log(f"  [{ci+1}/{len(page_clients)}] Processing: {name} ({ssn})")
                    
                    try:
                        # Step 1: Double-click to ManageReturnsTab
                        table_frame = await find_table_frame(page)
                        if not table_frame:
                            log("    Lost table frame, navigating back...")
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                            table_frame = await find_table_frame(page)
                            # Navigate to current page
                            for _ in range(current_page - 1):
                                nb = table_frame.locator("a:text-is('Next')")
                                if await nb.count() > 0:
                                    await nb.first.click(force=True)
                                    await asyncio.sleep(3)
                            table_frame = await find_table_frame(page)
                        
                        if not await dblclick_client(table_frame, ssn):
                            log(f"    Cannot find row for SSN {ssn}")
                            errors += 1
                            continue
                        
                        await asyncio.sleep(6)
                        
                        # Step 2: Click Edit
                        if not await click_edit(page):
                            log(f"    Cannot click Edit")
                            errors += 1
                            # Navigate back to clients
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                            # Re-navigate to current page
                            table_frame = await find_table_frame(page)
                            if table_frame:
                                for _ in range(current_page - 1):
                                    nb = table_frame.locator("a:text-is('Next')")
                                    if await nb.count() > 0:
                                        await nb.first.click(force=True)
                                        await asyncio.sleep(3)
                            continue
                        
                        await asyncio.sleep(8)
                        
                        # Step 3: Extract bank data from popup_redirect frame
                        bank_data = await extract_bank_fields(page)
                        
                        has_bank = bool(bank_data and any(
                            v for k, v in bank_data.items()
                            if "routing" in k.lower() or "account" in k.lower()
                        ))
                        
                        result = {
                            "name": name,
                            "ssn": ssn,
                            "sno": client.get("sno", ""),
                            "bank_fields": bank_data,
                            "has_bank_data": has_bank,
                            "extracted_at": datetime.now().isoformat()
                        }
                        
                        results.append(result)
                        processed_ssns.add(ssn)
                        total_extracted += 1
                        if has_bank:
                            total_with_bank += 1
                            log(f"    ★ BANK DATA: {bank_data}")
                        else:
                            log(f"    No bank data (fields: {list(bank_data.keys())})")
                        
                        # Step 4: Navigate back to Clients
                        # Click "Clients" in the top navigation
                        # The form editor (wfi) has different frame structure
                        # Need to find the OLTPRO navigation
                        went_back = False
                        for frame in page.frames:
                            url = frame.url or ""
                            if "OLTPRO_start" in url or "wfi_redirect" in url:
                                try:
                                    cl = frame.locator("td:text-is('Clients')")
                                    if await cl.count() > 0:
                                        await cl.first.click(force=True)
                                        await asyncio.sleep(6)
                                        went_back = True
                                        break
                                except:
                                    pass
                        
                        if not went_back:
                            # Try broader approach
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                        
                        # Re-navigate to current page
                        table_frame = await find_table_frame(page)
                        if table_frame and current_page > 1:
                            for _ in range(current_page - 1):
                                try:
                                    nb = table_frame.locator("a:text-is('Next')")
                                    if await nb.count() > 0:
                                        await nb.first.click(force=True)
                                        await asyncio.sleep(3)
                                    table_frame = await find_table_frame(page)
                                except:
                                    break
                        
                    except Exception as e:
                        log(f"    ERROR: {str(e)[:80]}")
                        errors += 1
                        # Try to recover
                        try:
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                            table_frame = await find_table_frame(page)
                            if table_frame and current_page > 1:
                                for _ in range(current_page - 1):
                                    nb = table_frame.locator("a:text-is('Next')")
                                    if await nb.count() > 0:
                                        await nb.first.click(force=True)
                                        await asyncio.sleep(3)
                        except:
                            pass
                    
                    if errors >= max_errors:
                        log(f"Too many errors ({errors}), stopping")
                        break
                
                # Save progress after each page
                save_progress(results, processed_ssns, current_page)
                log(f"Progress: {total_extracted} total, {total_with_bank} with bank data, {errors} errors")
                
                if errors >= max_errors:
                    break
                
                # Go to next page
                table_frame = await find_table_frame(page)
                if not table_frame:
                    await nav_to_clients(page)
                    await asyncio.sleep(5)
                    table_frame = await find_table_frame(page)
                
                if table_frame:
                    try:
                        nb = table_frame.locator("a:text-is('Next')")
                        if await nb.count() > 0:
                            await nb.first.click(force=True)
                            await asyncio.sleep(4)
                            current_page += 1
                        else:
                            log("No Next button - reached last page")
                            break
                    except:
                        log("Cannot click Next")
                        break
                else:
                    break
            
            # Save final results
            save_final(results)
            
            log(f"\n=== EXTRACTION COMPLETE ===")
            log(f"Total: {total_extracted}")
            log(f"With bank data: {total_with_bank}")
            log(f"Errors: {errors}")
            log(f"Pages processed: {current_page}")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            # Save whatever we have
            if results:
                save_progress(results, processed_ssns, current_page if 'current_page' in dir() else 1)
                save_final(results)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
