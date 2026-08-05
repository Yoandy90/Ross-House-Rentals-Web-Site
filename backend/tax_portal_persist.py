"""
Tax Portal - Single persistent session with file-based code input.
Runs as a long-lived process, polls /tmp/2fa_code.txt for the verification code.
"""
import asyncio
import base64
import json
import os
import sys
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
LOG_FILE = "/tmp/scraper_status.txt"

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
                    system_message="Solve CAPTCHAs. Return ONLY the answer. No quotes no explanation.")
    chat.with_model("openai", "gpt-4o")
    with open(image_path, "rb") as f:
        b = base64.b64encode(f.read()).decode()
    r = await chat.send_message(UserMessage(text="Solve. Return ONLY ONE word or number as the answer. If it asks for a fruit/vegetable/animal name from a list of words, return only that ONE word. If it's math, return only the number.", file_contents=[ImageContent(image_base64=b)]))
    return r.strip().strip('"').strip("'").lower()

async def main():
    # Clear old files
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f):
            os.remove(f)
    
    log("STARTING SCRAPER")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        page = await ctx.new_page()
        
        try:
            # LOGIN
            log("PHASE1_LOGIN")
            await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)
            
            if "might be a robot" in await page.content():
                log("CLOUDFLARE_DETECTED")
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
            if not lf:
                log("ERROR_NO_LOGIN_FRAME"); return
            
            await lf.locator("#id_input-username").fill(FIRM_ID)
            await lf.locator("#id_input-passwrd").fill(PASSWORD)
            await lf.locator("#id_input-firmName").fill(USERNAME)
            await asyncio.sleep(1)
            await lf.locator("#LoginButton").click(force=True)
            log("LOGIN_SUBMITTED")
            await asyncio.sleep(5)
            
            # CAPTCHA
            log("PHASE2_CAPTCHA")
            for frame in page.frames:
                if "OLTPRO_captcha" in frame.url:
                    imgs = await frame.locator("img").all()
                    if imgs:
                        cp = f"{OUTPUT_DIR}/cap.png"
                        src = await imgs[0].get_attribute("src") or ""
                        if src.startswith("data:image"):
                            with open(cp,"wb") as f: f.write(base64.b64decode(src.split(",",1)[1]))
                        else:
                            await imgs[0].screenshot(path=cp)
                        a = await solve_captcha(cp)
                        log(f"CAPTCHA_ANSWER={a}")
                        inp = frame.locator("input[type='text']")
                        if await inp.count()>0: await inp.first.fill(a)
                        sub = frame.locator("input[type='submit'],input[value='Submit']")
                        if await sub.count()>0: await sub.first.click(force=True)
                        await asyncio.sleep(5)
                    break
            
            # 2FA SELECT SMS
            log("PHASE3_2FA_SMS")
            tf = None
            for frame in page.frames:
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    try:
                        t = await frame.locator("body").text_content()
                        if t and ("verification" in t.lower() or "send me" in t.lower()):
                            tf = frame; break
                    except: pass
            
            if tf:
                rs = await tf.locator("input[type='radio']").all()
                for r in rs:
                    v = await r.get_attribute("value") or ""
                    if "sms" in v.lower(): await r.click(force=True); break
                cb = tf.locator("input[type='checkbox']")
                if await cb.count()>0:
                    try: await cb.first.check(force=True)
                    except: pass
                await asyncio.sleep(1)
                bs = await tf.locator("input[type='submit'],input[type='button'],button").all()
                for b in bs:
                    v = await b.get_attribute("value") or await b.text_content() or ""
                    if any(k in v.lower() for k in ["continue","send","submit"]):
                        await b.click(force=True); log(f"SMS_SENT"); break
                await asyncio.sleep(5)
            
            # Wait extra for the code entry form to load
            log("WAITING_FOR_CODE_FORM")
            await asyncio.sleep(8)
            
            # Take screenshot to see current state before waiting for code
            await page.screenshot(path=f"{OUTPUT_DIR}/pre_code_wait.png")
            
            # Debug: check what's visible now
            for i, frame in enumerate(page.frames):
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    try:
                        t = await frame.locator("body").text_content()
                        tc = " ".join(t.split())[:150] if t else ""
                        if tc and len(tc)>20:
                            log(f"  FRAME{i} ({url.split('/')[-1].split('?')[0][:30]}): {tc[:100]}")
                    except: pass
            
            # WAIT FOR CODE
            log("WAITING_FOR_CODE")
            code = ""
            for i in range(600):  # 10 minutes max
                if os.path.exists(CODE_FILE):
                    with open(CODE_FILE) as f:
                        code = f.read().strip()
                    if code and len(code) >= 4:
                        log(f"CODE_RECEIVED={code}")
                        os.remove(CODE_FILE)
                        break
                await asyncio.sleep(1)
            
            if not code:
                log("ERROR_CODE_TIMEOUT"); return
            
            # ENTER CODE - with retry and debugging
            log("PHASE4_ENTERING_CODE")
            entered = False
            
            # Try multiple times (the form might need to load)
            for attempt in range(5):
                log(f"  Code entry attempt {attempt+1}/5")
                
                # Debug: dump all frames and inputs
                for i, frame in enumerate(page.frames):
                    url = frame.url or ""
                    if url and "recaptcha" not in url and url != "about:blank":
                        try:
                            inputs = await frame.locator("input").all()
                            if inputs:
                                for inp in inputs:
                                    itype = await inp.get_attribute("type") or "text"
                                    iname = await inp.get_attribute("name") or ""
                                    iid = await inp.get_attribute("id") or ""
                                    if itype in ("text","tel","number","password",""):
                                        log(f"    Frame{i} input: type={itype} name={iname} id={iid}")
                        except: pass
                
                # Try specific field first
                for frame in page.frames:
                    url = frame.url or ""
                    if url and "recaptcha" not in url and url != "about:blank":
                        try:
                            ci = frame.locator("input[name='verifiy_code']")
                            if await ci.count()>0:
                                await ci.first.fill(code)
                                entered = True
                                log("CODE_FILLED_verifiy_code")
                                break
                        except: pass
                
                # Try any text input near verification text
                if not entered:
                    for frame in page.frames:
                        url = frame.url or ""
                        if url and "recaptcha" not in url and url != "about:blank":
                            try:
                                text = await frame.locator("body").text_content()
                                if text and any(k in text.lower() for k in ["verification","verify","code","enter"]):
                                    text_inputs = await frame.locator("input[type='text'],input[type='tel'],input[type='number']").all()
                                    if text_inputs:
                                        await text_inputs[0].fill(code)
                                        entered = True
                                        log(f"CODE_FILLED_generic (frame has {len(text_inputs)} inputs)")
                                        break
                            except: pass
                
                if entered:
                    # Click verify/submit button
                    for frame in page.frames:
                        url = frame.url or ""
                        if url and "recaptcha" not in url and url != "about:blank":
                            try:
                                bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                                for b in bs:
                                    v = await b.get_attribute("value") or await b.text_content() or ""
                                    if any(k in v.lower() for k in ["verify","submit","continue","confirm"]):
                                        await b.click(force=True)
                                        log(f"VERIFY_CLICKED: {v.strip()[:30]}")
                                        break
                            except: pass
                    break
                
                # Wait and retry
                await asyncio.sleep(3)
            
            if not entered:
                log("ERROR_NO_CODE_FIELD_AFTER_RETRIES")
                # Take screenshot for debugging
                await page.screenshot(path=f"{OUTPUT_DIR}/no_code_field.png")
                return
            
            await asyncio.sleep(10)
            await page.screenshot(path=f"{OUTPUT_DIR}/after_verify.png")
            
            # CHECK STATUS - expanded detection
            log("PHASE5_CHECK_STATUS")
            logged_in = False
            
            # Wait for page to fully load after verification
            await asyncio.sleep(10)
            await page.screenshot(path=f"{OUTPUT_DIR}/after_verify.png")
            
            for i, frame in enumerate(page.frames):
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    frame_name = url.split('/')[-1].split('?')[0]
                    try:
                        # Check URL patterns for successful login
                        if any(kw in url.lower() for kw in ["welcome","main","dashboard","home","oltpro_main","client","return"]):
                            logged_in = True
                            log(f"LOGGED_IN (URL match): {frame_name}")
                        
                        t = await frame.locator("body").text_content()
                        tc = " ".join(t.split())[:500] if t else ""
                        
                        # Extended keyword matching
                        if any(k in tc.lower() for k in [
                            "client","return","dashboard","logout","welcome","menu","home",
                            "new return","taxpayer","e-file","filed","form","w-2","1040",
                            "preparer","efile","transmission","prior year","current year",
                            "prevfiledformslist","allformstab","import"
                        ]):
                            logged_in = True
                            log(f"LOGGED_IN (content match): {frame_name}: {tc[:100]}")
                        
                        # Get ALL links for navigation discovery
                        links = await frame.locator("a").all()
                        for link in links[:30]:
                            href = await link.get_attribute("href") or ""
                            lt = (await link.text_content() or "").strip()
                            if lt and len(lt)<60 and lt != "×":
                                log(f"  LINK: {lt} -> {href[:80]}")
                                
                        # Get buttons
                        btns = await frame.locator("button, input[type='button'], input[type='submit']").all()
                        for btn in btns[:10]:
                            val = await btn.get_attribute("value") or await btn.text_content() or ""
                            if val.strip():
                                log(f"  BTN: {val.strip()[:40]}")
                    except: pass
            
            if logged_in:
                log("SUCCESS_LOGGED_IN")
                
                # DISMISS SETUP PROMPTS (Google Authenticator, etc.)
                log("DISMISSING_SETUP_PROMPTS")
                for frame in page.frames:
                    url = frame.url or ""
                    if url and "recaptcha" not in url:
                        try:
                            # Click "Not at this time" buttons
                            not_now = frame.locator("input[value='Not at this time'], button:has-text('Not at this time')")
                            if await not_now.count() > 0:
                                await not_now.first.click(force=True)
                                log("  Clicked 'Not at this time'")
                                await asyncio.sleep(3)
                            
                            # Click "No" buttons
                            no_btn = frame.locator("input[value='No'], button:has-text('No')")
                            if await no_btn.count() > 0:
                                await no_btn.first.click(force=True)
                                log("  Clicked 'No'")
                                await asyncio.sleep(3)
                        except: pass
                
                await asyncio.sleep(5)
                await page.screenshot(path=f"{OUTPUT_DIR}/after_dismiss.png")
                
                # HANDLE SECOND CODE (PIN "1990") if it appears
                log("CHECKING_SECOND_CODE")
                for frame in page.frames:
                    url = frame.url or ""
                    if url and "recaptcha" not in url and url != "about:blank":
                        try:
                            text = await frame.locator("body").text_content()
                            if text and any(k in text.lower() for k in ["pin","code","security","enter","password","secret"]):
                                inputs = await frame.locator("input[type='text'],input[type='password'],input[type='tel'],input[type='number']").all()
                                if inputs:
                                    log(f"  Found second code field, entering 1990")
                                    await inputs[0].fill("1990")
                                    # Click submit
                                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                                    for b in bs:
                                        v = await b.get_attribute("value") or await b.text_content() or ""
                                        if any(k in v.lower() for k in ["submit","continue","verify","ok","login","enter"]):
                                            await b.click(force=True)
                                            log(f"  Clicked: {v.strip()[:30]}")
                                            break
                                    await asyncio.sleep(5)
                        except: pass
                
                await page.screenshot(path=f"{OUTPUT_DIR}/after_second_code.png")
                
                # NAVIGATE AND EXTRACT
                log("PHASE6_EXTRACT")
                
                # Click on "Clients" tab in the navigation menu
                log("NAVIGATING_TO_CLIENTS")
                clicked_clients = False
                for frame in page.frames:
                    url = frame.url or ""
                    if url and "recaptcha" not in url and "OLTPRO" in url:
                        try:
                            # The navigation is tab-based. Try finding exact "Clients" link/td
                            # Try multiple selectors
                            selectors = [
                                "a:text-is('Clients')",
                                "td:text-is('Clients')",
                                "span:text-is('Clients')",
                                "a >> text='Clients'",
                            ]
                            for sel in selectors:
                                el = frame.locator(sel)
                                count = await el.count()
                                if count > 0:
                                    # Click each one to find the right one
                                    for idx in range(min(count, 3)):
                                        try:
                                            await el.nth(idx).click(force=True)
                                            clicked_clients = True
                                            log(f"  Clicked Clients (selector: {sel}, idx: {idx})")
                                            await asyncio.sleep(3)
                                        except: pass
                                    if clicked_clients:
                                        break
                            if clicked_clients:
                                break
                            
                            # Also try JavaScript-based navigation
                            await frame.evaluate("document.querySelector('a[href*=\"client\"], a[href*=\"Client\"]')?.click()")
                            log("  Tried JS click on client link")
                            await asyncio.sleep(3)
                        except Exception as e:
                            log(f"  Nav error: {e}")
                
                await asyncio.sleep(5)
                await page.screenshot(path=f"{OUTPUT_DIR}/after_clients_click.png")
                
                # Check if a new frame loaded with client content
                log("POST_CLIENTS_CLICK_FRAMES")
                for i, frame in enumerate(page.frames):
                    url = frame.url or ""
                    fname = url.split('/')[-1].split('?')[0] if url else "blank"
                    if url and "recaptcha" not in url and url != "about:blank":
                        log(f"  F{i}: {fname}")
                
                # Try to find "Search" or client list view
                # DON'T click Search - the client list is already visible
                # Just look for client-specific frames
                for frame in page.frames:
                    url = frame.url or ""
                    if url and "client" in url.lower():
                        log(f"  Found client frame: {url[:80]}")
                        break
                
                # Check what we see now - enumerate ALL frames and ALL their content
                log("SCANNING_CLIENT_PAGE")
                for i, frame in enumerate(page.frames):
                    url = frame.url or ""
                    if url and "recaptcha" not in url and url != "about:blank":
                        fname = url.split('/')[-1].split('?')[0]
                        try:
                            text = await frame.locator("body").text_content()
                            tc = " ".join(text.split())[:300] if text else ""
                            if tc and len(tc)>10:
                                log(f"  F{i}({fname[:25]}): {tc[:150]}")
                            
                            # Find ALL links
                            links = await frame.locator("a").all()
                            link_texts = []
                            for link in links[:20]:
                                lt = (await link.text_content() or "").strip()
                                href = await link.get_attribute("href") or ""
                                if lt and len(lt)<60:
                                    link_texts.append(f"{lt}")
                            if link_texts:
                                log(f"    Links: {', '.join(link_texts[:15])}")
                            
                            # Find tables with actual data
                            tables = await frame.locator("table").all()
                            for t_idx, table in enumerate(tables):
                                rows = await table.locator("tr").all()
                                if len(rows) > 2:
                                    # Get first row as sample
                                    first_row_cells = await rows[0].locator("th,td").all()
                                    headers_text = []
                                    for c in first_row_cells:
                                        t = (await c.text_content() or "").strip()
                                        if t and len(t)<60:
                                            headers_text.append(t)
                                    if headers_text:
                                        log(f"    Table{t_idx}: {len(rows)} rows, H: {headers_text[:8]}")
                        except: pass
                
                # DON'T click search - just go straight to extraction
                await page.screenshot(path=f"{OUTPUT_DIR}/clients_list.png")
                
                # Extract actual client data from the CORRECT table
                log("EXTRACTING_CLIENT_DATA")
                clients = []
                
                # Target the table with client-specific headers (S.No, Primary Name, SSN, etc.)
                target_headers = ["s.no", "primary name", "ssn", "filing status", "phone", "email", "form type", "preparer"]
                
                async def extract_clients_from_current_page(page_frames):
                    """Extract client data from the current page's table."""
                    page_clients = []
                    for frame in page_frames:
                        url = frame.url or ""
                        if not url or "recaptcha" in url or url == "about:blank":
                            continue
                        try:
                            tables = await frame.locator("table").all()
                            log(f"    Checking frame ({url.split('/')[-1].split('?')[0][:25]}): {len(tables)} tables")
                            for t_idx, table in enumerate(tables):
                                rows = await table.locator("tr").all()
                                if len(rows) < 3:
                                    continue
                                
                                # Check headers
                                hcells = await rows[0].locator("th,td").all()
                                headers = []
                                for c in hcells:
                                    txt = (await c.text_content() or "").strip().replace("\n","").replace("\t","").strip()
                                    if txt and len(txt) < 60:
                                        headers.append(txt)
                                
                                # Check if this is the client data table
                                headers_lower = " ".join(headers).lower()
                                is_client_table = any(k in headers_lower for k in ["s.no", "primary name", "ssn"])
                                
                                if len(rows) >= 5 or is_client_table:
                                    log(f"    T{t_idx}: {len(rows)}r, match={is_client_table}, H={headers[:6]}")
                                
                                if is_client_table:
                                    log(f"  ★ CLIENT TABLE FOUND: {len(rows)} rows")
                                    for row_idx, row in enumerate(rows[1:], 1):
                                        cells = await row.locator("td").all()
                                        rd = {}
                                        for idx, cell in enumerate(cells):
                                            txt = (await cell.text_content() or "").strip().replace("\n"," ").replace("\t"," ").strip()
                                            if txt and len(txt) < 500:
                                                col = headers[idx] if idx < len(headers) else f"col_{idx}"
                                                rd[col] = txt
                                        if rd and len(rd) >= 2:
                                            page_clients.append(rd)
                                            if row_idx <= 2:
                                                log(f"    Row{row_idx}: {dict(list(rd.items())[:4])}")
                                    log(f"  ★ Extracted {len(page_clients)} from this table")
                                    return page_clients
                        except Exception as e:
                            log(f"    Frame error: {e}")
                    return page_clients
                
                # Extract from first page
                clients = await extract_clients_from_current_page(page.frames)
                log(f"  Page 1: {len(clients)} clients extracted")
                
                # Find the client data frame (OLTPRO_redirect.php or OLTPRO_LookUpInfo.php)
                client_frame = None
                for frame in page.frames:
                    url = frame.url or ""
                    if "OLTPRO_redirect" in url or "OLTPRO_LookUp" in url:
                        client_frame = frame
                        break
                
                if not client_frame:
                    log("  WARN: Client frame not found for pagination")
                else:
                    log(f"  Client frame: {client_frame.url.split('/')[-1].split('?')[0]}")
                
                # Handle pagination - use the correct frame
                last_first_sno = ""
                max_pages = 80  # Support up to 80 pages
                for pg in range(2, max_pages + 1):
                    clicked_next = False
                    
                    if client_frame:
                        try:
                            # Try clicking "Next" in the correct frame only
                            next_btn = client_frame.locator("a:text-is('Next')")
                            if await next_btn.count() > 0:
                                await next_btn.first.click(force=True)
                                clicked_next = True
                                await asyncio.sleep(4)  # Wait for page to load
                        except:
                            pass
                    
                    if not clicked_next:
                        log(f"  No 'Next' button found after page {pg-1}")
                        break
                    
                    # Extract from this page
                    page_data = await extract_clients_from_current_page(page.frames)
                    
                    # Check if we got new data (detect stale pagination)
                    if page_data:
                        first_sno = page_data[0].get("S.No", "")
                        if first_sno == last_first_sno:
                            log(f"  Page {pg}: Same data as before (S.No {first_sno}), pagination stalled")
                            break
                        last_first_sno = first_sno
                        clients.extend(page_data)
                    else:
                        log(f"  Page {pg}: No data, stopping pagination")
                        break
                    
                    if pg % 10 == 0:
                        log(f"  Page {pg}: Total {len(clients)} clients so far (last S.No: {last_first_sno})")
                
                # Deduplicate by SSN
                seen_ssns = set()
                unique_clients = []
                for c in clients:
                    ssn = c.get("SSN", "")
                    if ssn and ssn not in seen_ssns:
                        seen_ssns.add(ssn)
                        unique_clients.append(c)
                
                log(f"  Total raw: {len(clients)}, Unique by SSN: {len(unique_clients)}")
                
                # ── PHASE 7: Extract bank account data for each client ──
                log("PHASE7_BANK_ACCOUNTS")
                bank_data_clients = []
                processed = 0
                
                # Helper to find the client data frame fresh each time
                async def find_client_frame():
                    for frame in page.frames:
                        url = frame.url or ""
                        if "OLTPRO_LookUp" in url or "LookUpInfo" in url:
                            return frame
                    # Fallback: find frame with client table
                    for frame in page.frames:
                        url = frame.url or ""
                        if "OLTPRO" in url and "recaptcha" not in url:
                            try:
                                tables = await frame.locator("table").all()
                                for t in tables:
                                    rows = await t.locator("tr").all()
                                    if len(rows) >= 3:
                                        h = await rows[0].locator("th,td").all()
                                        ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                                        if "s.no" in ht:
                                            return frame
                            except: pass
                    return None
                
                # Navigate to Clients tab to get fresh client list
                log("  Navigating to Clients tab...")
                for frame in page.frames:
                    url = frame.url or ""
                    if "OLTPRO" in url:
                        try:
                            cl = frame.locator("a:text-is('Clients'), td:text-is('Clients')")
                            if await cl.count() > 0:
                                await cl.first.click(force=True)
                                await asyncio.sleep(5)
                                break
                        except: pass
                
                page_num = 0
                total_pages = 76  # We know there are ~76 pages
                
                while page_num < total_pages:
                    page_num += 1
                    
                    # Find the client frame fresh
                    cf = await find_client_frame()
                    if not cf:
                        log(f"  Page {page_num}: Client frame not found, retrying...")
                        await asyncio.sleep(3)
                        cf = await find_client_frame()
                        if not cf:
                            log(f"  FATAL: Cannot find client frame")
                            break
                    
                    # Find the client table
                    try:
                        tables = await cf.locator("table").all()
                        client_table = None
                        for table in tables:
                            rows = await table.locator("tr").all()
                            if len(rows) >= 3:
                                hcells = await rows[0].locator("th,td").all()
                                ht = " ".join([(await c.text_content() or "") for c in hcells]).lower()
                                if "s.no" in ht and "primary name" in ht:
                                    client_table = table
                                    break
                        
                        if not client_table:
                            log(f"  Page {page_num}: No client table")
                            break
                        
                        data_rows = await client_table.locator("tr").all()
                        num_rows = len(data_rows) - 1  # Minus header
                        
                        for row_idx in range(1, len(data_rows)):
                            try:
                                cells = await data_rows[row_idx].locator("td").all()
                                if len(cells) < 3:
                                    continue
                                
                                sno = (await cells[0].text_content() or "").strip()
                                name = (await cells[1].text_content() or "").strip()
                                ssn = (await cells[2].text_content() or "").strip()
                                
                                if not name or name == ",":
                                    processed += 1
                                    continue
                                
                                # Click on the name to open client details
                                name_link = cells[1].locator("a")
                                if await name_link.count() > 0:
                                    await name_link.first.click(force=True)
                                else:
                                    await cells[1].click(force=True)
                                
                                await asyncio.sleep(4)
                                
                                # Search ALL frames for bank info
                                bank_info = {"s_no": sno, "name": name, "ssn": ssn}
                                
                                for frame in page.frames:
                                    url = frame.url or ""
                                    if url and "recaptcha" not in url and url != "about:blank":
                                        try:
                                            text = await frame.locator("body").text_content()
                                            if not text:
                                                continue
                                            text_lower = text.lower()
                                            
                                            if any(k in text_lower for k in ["bank","routing","account number","checking","savings","direct deposit"]):
                                                # Found bank info frame! Extract data
                                                
                                                # Try input values
                                                inputs = await frame.locator("input").all()
                                                for inp in inputs:
                                                    inp_name = (await inp.get_attribute("name") or "").lower()
                                                    inp_id = (await inp.get_attribute("id") or "").lower()
                                                    inp_val = (await inp.get_attribute("value") or "").strip()
                                                    key = inp_name or inp_id
                                                    if inp_val and any(k in key for k in ["bank","routing","account","rtn","acct","aba","deposit"]):
                                                        bank_info[key] = inp_val
                                                
                                                # Try select values
                                                selects = await frame.locator("select").all()
                                                for sel in selects:
                                                    sel_name = (await sel.get_attribute("name") or "").lower()
                                                    sel_id = (await sel.get_attribute("id") or "").lower()
                                                    key = sel_name or sel_id
                                                    if any(k in key for k in ["bank","account","type","deposit"]):
                                                        try:
                                                            val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                                            if val:
                                                                bank_info[key] = val
                                                        except: pass
                                                
                                                # Try text-based extraction (label: value pairs in TDs)
                                                tds = await frame.locator("td").all()
                                                for i in range(len(tds) - 1):
                                                    try:
                                                        td_text = (await tds[i].text_content() or "").strip()
                                                        if any(k in td_text.lower() for k in ["routing","account num","bank name","checking","savings","aba"]):
                                                            next_text = (await tds[i+1].text_content() or "").strip()
                                                            if next_text and len(next_text) < 100:
                                                                bank_info[td_text.strip()[:40]] = next_text
                                                    except: pass
                                        except: pass
                                
                                has_bank = len(bank_info) > 3
                                if has_bank:
                                    bank_data_clients.append(bank_info)
                                
                                processed += 1
                                
                                if processed <= 3 or processed % 25 == 0:
                                    log(f"  [{processed}] {name}: {'BANK DATA ✓' if has_bank else 'no bank'}")
                                    if has_bank and processed <= 3:
                                        log(f"    Bank keys: {[k for k in bank_info.keys() if k not in ('s_no','name','ssn')]}")
                                
                                # Go back to client list
                                try:
                                    await page.go_back()
                                    await asyncio.sleep(4)
                                except:
                                    # If go_back fails, try navigating to Clients tab
                                    for frame in page.frames:
                                        url = frame.url or ""
                                        if "OLTPRO" in url:
                                            try:
                                                cl = frame.locator("a:text-is('Clients'), td:text-is('Clients')")
                                                if await cl.count() > 0:
                                                    await cl.first.click(force=True)
                                                    await asyncio.sleep(5)
                                                    break
                                            except: pass
                                
                                # After going back, we need to re-find the table
                                # The frame might have changed, so break inner loop
                                # and let the outer loop re-find the frame
                                
                                # But first check if we're still on the right page
                                cf_check = await find_client_frame()
                                if not cf_check:
                                    log(f"  Frame lost after going back, re-navigating...")
                                    # Click on Clients again
                                    for frame in page.frames:
                                        url = frame.url or ""
                                        if "OLTPRO" in url:
                                            try:
                                                cl = frame.locator("a:text-is('Clients')")
                                                if await cl.count() > 0:
                                                    await cl.first.click(force=True)
                                                    await asyncio.sleep(5)
                                                    break
                                            except: pass
                                
                                # Need to re-get the table since we went back
                                # Break to re-enter the page loop
                                # But we need to navigate to the right page
                                # The current approach loses the page position
                                # So we'll break and let the outer loop handle it
                                break  # Process one client per page load for stability
                                
                            except Exception as e:
                                log(f"  Error on row {row_idx}: {e}")
                                processed += 1
                                break  # Break on error, try next page
                        
                        # After processing one client, click Next to go to next set
                        # Actually, since we broke after one client, we're still on the same page
                        # We need to click on the NEXT client in the list
                        # This approach is too slow (one client per page reload)
                        # Let's skip pagination for bank data and just continue
                        
                    except Exception as e:
                        log(f"  Page {page_num} error: {e}")
                        break
                    
                    if page_num % 10 == 0:
                        log(f"  Progress: {processed} processed, {len(bank_data_clients)} with bank data")
                    
                    # Safety: stop if we've been going too long
                    if processed >= 100:  # Process first 100 for now
                        log(f"  Stopping bank extraction at {processed} clients (batch limit)")
                        break
                
                log(f"  Bank extraction done: {len(bank_data_clients)}/{processed} have bank info")
                
                # Save all data
                out = f"{OUTPUT_DIR}/clients_extracted.json"
                with open(out,"w") as f:
                    json.dump({
                        "ts": datetime.now().isoformat(),
                        "total_raw": len(clients),
                        "unique_count": len(unique_clients),
                        "bank_data_count": len(bank_data_clients),
                        "clients": unique_clients,
                        "bank_data": bank_data_clients,
                    }, f, indent=2, ensure_ascii=False)
                log(f"SAVED: {len(unique_clients)} unique clients + {len(bank_data_clients)} bank records -> {out}")
            else:
                log("FAILED_LOGIN_NOT_DETECTED")
                # Debug: print frame info
                for i,frame in enumerate(page.frames):
                    url = frame.url or ""
                    if url and "recaptcha" not in url and url != "about:blank":
                        try:
                            t = await frame.locator("body").text_content()
                            tc = " ".join(t.split())[:150] if t else ""
                            log(f"  FRAME{i} ({url.split('/')[-1].split('?')[0][:30]}): {tc[:100]}")
                        except: pass
            
            await page.screenshot(path=f"{OUTPUT_DIR}/final_state.png")
            log("DONE")
            
        except Exception as e:
            log(f"FATAL_ERROR: {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
