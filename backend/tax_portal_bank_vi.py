"""
Tax Portal - Bank Data Extractor via "View Input" Popup
CORRECT FLOW (confirmed by user screenshots):
1. Client List → Double-click client → ManageReturnsTab
2. Click "View Input" button → Opens popup (showuserinputs.php)
3. Popup shows Personal Info with "Filed Forms" tree on left
4. Scroll to bottom → "Bank Information for Direct Deposit" section
5. Extract: Account Type, Routing Number, Bank Name, Account Number, Re-Type values
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
LOG_FILE = "/tmp/bank_vi_status.txt"
PROGRESS_FILE = "/app/backend/scraped_data/bank_progress.json"
BANK_OUTPUT = "/app/backend/scraped_data/bank_data.json"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def save_progress(results, processed_ssns, last_page):
    with open(PROGRESS_FILE, "w") as f:
        json.dump({
            "results": results,
            "processed_ssns": list(processed_ssns),
            "last_page": last_page,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)

def save_final(results):
    with open(BANK_OUTPUT, "w") as f:
        json.dump({
            "count": len(results),
            "with_bank_data": len([r for r in results if r.get("has_bank_data")]),
            "extracted_at": datetime.now().isoformat(),
            "clients": results
        }, f, indent=2)
    log(f"★ Saved {len(results)} clients to {BANK_OUTPUT}")

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
    await page.goto(LOGIN_URL, wait_until="networkidle", timeout=30000)
    await asyncio.sleep(3)
    if "might be a robot" in await page.content():
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
    log("LOGIN_SUBMITTED"); await asyncio.sleep(5)
    for frame in page.frames:
        if "OLTPRO_captcha" in frame.url:
            imgs = await frame.locator("img").all()
            if imgs:
                cp = f"{OUTPUT_DIR}/cap.png"
                src = await imgs[0].get_attribute("src") or ""
                if src.startswith("data:image"):
                    with open(cp,"wb") as f: f.write(base64.b64decode(src.split(",",1)[1]))
                else: await imgs[0].screenshot(path=cp)
                a = await solve_captcha(cp); log(f"CAPTCHA: {a}")
                inp = frame.locator("input[type='text']")
                if await inp.count()>0: await inp.first.fill(a)
                sub = frame.locator("input[type='submit'],input[value='Submit']")
                if await sub.count()>0: await sub.first.click(force=True)
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
                        if "email" in v.lower(): await r.click(force=True); log("SELECTED_EMAIL"); break
                    cb = frame.locator("input[type='checkbox']")
                    if await cb.count()>0:
                        try: await cb.first.check(force=True)
                        except: pass
                    await asyncio.sleep(1)
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["continue","send","submit"]):
                            await b.click(force=True); log("SMS_SENT"); break
                    await asyncio.sleep(5); break
            except: pass
    await asyncio.sleep(8); log("WAITING_FOR_CODE")
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
    log("LOGIN_COMPLETE")
    # Extra wait for dashboard to fully load
    await asyncio.sleep(10)
    
    # Dump all frames to understand the page state
    log("Post-login frame dump:")
    for fi, frame in enumerate(page.frames):
        url = frame.url or ""
        if not url or url == "about:blank": continue
        fname = url.split('/')[-1].split('?')[0][:35]
        try:
            text = await frame.locator("body").text_content(timeout=3000)
            tc = " ".join(text.split())[:120] if text else ""
            log(f"  F{fi}({fname}): {tc[:100]}")
        except:
            log(f"  F{fi}({fname}): (timeout)")
    
    # Take screenshot after login
    await page.screenshot(path=f"{OUTPUT_DIR}/post_login.png")
    
    # Dismiss any remaining popups/prompts
    for frame in page.frames:
        try:
            # Close/OK/Continue buttons
            for selector in ["input[value='OK']", "input[value='Close']", "input[value='Continue']",
                            "button:text-is('OK')", "button:text-is('Close')", "input[value='Not at this time']"]:
                el = frame.locator(selector)
                if await el.count() > 0:
                    await el.first.click(force=True)
                    log(f"  Dismissed: {selector}")
                    await asyncio.sleep(3)
        except: pass
    
    await asyncio.sleep(3)
    return True


async def nav_to_clients(page):
    """Navigate to Clients tab from any page. More robust version."""
    # Wait for frames to load
    await asyncio.sleep(3)
    
    # Try multiple strategies
    for attempt in range(3):
        for frame in page.frames:
            url = frame.url or ""
            if not url or url == "about:blank" or "recaptcha" in url:
                continue
            try:
                # Strategy 1: td with exact text
                cl = frame.locator("td:text-is('Clients')")
                if await cl.count() > 0:
                    await cl.first.click(force=True)
                    await asyncio.sleep(8)
                    return True
            except: pass
            try:
                # Strategy 2: Any element containing "Clients" text
                cl = frame.locator("text=Clients").first
                if cl:
                    text = await cl.text_content()
                    if text and text.strip() == "Clients":
                        await cl.click(force=True)
                        await asyncio.sleep(8)
                        return True
            except: pass
            try:
                # Strategy 3: Link with Clients text
                cl = frame.locator("a:text-is('Clients')")
                if await cl.count() > 0:
                    await cl.first.click(force=True)
                    await asyncio.sleep(8)
                    return True
            except: pass
            try:
                # Strategy 4: JavaScript navigation - click Clients in nav
                clicked = await frame.evaluate("""() => {
                    const tds = document.querySelectorAll('td');
                    for (const td of tds) {
                        if (td.textContent.trim() === 'Clients') {
                            td.click();
                            return true;
                        }
                    }
                    // Also check images with alt text
                    const imgs = document.querySelectorAll('img');
                    for (const img of imgs) {
                        if (img.alt && img.alt.toLowerCase().includes('client')) {
                            img.click();
                            return true;
                        }
                    }
                    return false;
                }""")
                if clicked:
                    await asyncio.sleep(8)
                    return True
            except: pass
        
        if attempt < 2:
            log(f"  Nav attempt {attempt+1} failed, waiting...")
            await asyncio.sleep(5)
    
    return False


async def find_table_frame(page):
    """Find frame with client table."""
    for frame in page.frames:
        url = frame.url or ""
        if "LookUpInfo" in url or "OLTPRO_redirect" in url:
            return frame
    return None


async def get_page_clients(table_frame):
    """Get all clients on current page with ondblclick URLs."""
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
                const ssn = cells[2] ? cells[2].textContent.trim() : '';
                // Include ALL rows that have a valid SSN (even if name is blank/comma)
                if (!ssn || ssn.length < 5) continue;
                clients.push({
                    sno: cells[0].textContent.trim(),
                    name: name || '(blank)',
                    ssn: ssn
                });
            }
            return clients;
        }
        return [];
    }""")


async def dblclick_client(table_frame, ssn):
    """Double-click client row by SSN."""
    return await table_frame.evaluate("""(ssn) => {
        const tables = document.querySelectorAll('table');
        for (const t of tables) {
            const rows = t.querySelectorAll('tr');
            for (let i = 1; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('td');
                if (cells.length >= 3 && cells[2].textContent.trim() === ssn) {
                    rows[i].dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
                    return true;
                }
            }
        }
        return false;
    }""", ssn)


async def extract_bank_from_popup(popup, is_first=False):
    """Extract bank data from the View Input popup (showuserinputs.php).
    The popup has a tree nav (left) and form content (right) in iframes.
    Bank data is at the bottom of the Personal Info form content.
    """
    bank_data = {}
    
    # Wait for the popup to fully load
    try:
        await popup.wait_for_load_state("networkidle", timeout=15000)
    except:
        pass
    await asyncio.sleep(5)
    
    # The popup likely has nested iframes. Check all frames.
    all_frames = popup.frames
    if is_first:
        log(f"    Popup frames: {len(all_frames)}")
    
    for fi, frame in enumerate(all_frames):
        url = frame.url or ""
        if not url or url == "about:blank" or "recaptcha" in url:
            continue
        
        fname = url.split('/')[-1].split('?')[0][:30]
        
        try:
            # Scroll to bottom
            try:
                await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            except:
                pass
            await asyncio.sleep(1)
            
            text = await frame.locator("body").text_content(timeout=5000)
            if not text:
                continue
            
            tc = " ".join(text.split())
            text_lower = tc.lower()
            
            if is_first:
                log(f"    F{fi}({fname}): len={len(tc)}, first100: {tc[:100]}")
                with open(f"{OUTPUT_DIR}/popup_f{fi}_{fname[:15]}.txt", "w") as fout:
                    fout.write(tc)
            
            # Check for bank-related content
            has_bank = any(k in text_lower for k in [
                "routing number", "bank information", "direct deposit",
                "account number", "bank name", "routing transit"
            ])
            
            if has_bank:
                log(f"    ★ Bank section in F{fi}({fname})")
                
                # Extract ALL form fields using JS
                fields = await frame.evaluate("""() => {
                    const result = {};
                    document.querySelectorAll('input').forEach(inp => {
                        const name = inp.name || inp.id || '';
                        if (!name) return;
                        if (inp.type === 'checkbox' || inp.type === 'radio') {
                            if (inp.checked) result[name] = inp.value || 'checked';
                        } else if (inp.type !== 'hidden' || inp.value) {
                            result[name] = inp.value || '';
                        }
                    });
                    document.querySelectorAll('select').forEach(sel => {
                        const name = sel.name || sel.id || '';
                        if (!name) return;
                        const opt = sel.options[sel.selectedIndex];
                        if (opt) result[name] = opt.text || opt.value || '';
                    });
                    document.querySelectorAll('span[id]').forEach(sp => {
                        if (sp.id && sp.textContent.trim()) {
                            result['span_' + sp.id] = sp.textContent.trim();
                        }
                    });
                    return result;
                }""")
                
                bank_keywords = ['routing', 'account', 'bank', 'rtn', 'acct', 'aba',
                               'deposit', 'check', 'saving', 'refund', 'dd', 'drt']
                for key, value in fields.items():
                    key_lower = key.lower()
                    if any(k in key_lower for k in bank_keywords):
                        bank_data[key] = value
                
                if bank_data:
                    break
                
                # Fallback: text pattern extraction
                import re
                for pattern, key in [
                    (r'Routing\s*(?:Number|#|Transit)\s*[:\s]*(\d{9})', 'routing_number'),
                    (r'Account\s*(?:Number|#)\s*[:\s]*(\d+)', 'account_number'),
                    (r'Bank\s*Name\s*[:\s]*([A-Z][A-Z\s,\.]+)', 'bank_name'),
                ]:
                    m = re.search(pattern, tc, re.IGNORECASE)
                    if m:
                        bank_data[key] = m.group(1).strip()
                
                # Also try extracting from table cell pairs (label: value)
                tds = await frame.locator("td").all()
                for idx in range(len(tds) - 1):
                    try:
                        label = (await tds[idx].text_content() or "").strip()
                        if len(label) > 60 or len(label) < 3: continue
                        label_lower = label.lower()
                        if any(k in label_lower for k in ['routing', 'account num', 'bank name',
                               'account type', 'direct deposit']):
                            value = (await tds[idx + 1].text_content() or "").strip()
                            if value and len(value) < 100:
                                bank_data[label[:40]] = value
                    except: pass
                
                if bank_data:
                    break
                    
        except Exception as e:
            if is_first:
                log(f"    F{fi}({fname}) error: {str(e)[:60]}")
    
    return bank_data


async def navigate_to_page(table_frame, target_page, current_page):
    """Navigate from current_page to target_page using pagination."""
    if target_page == current_page:
        return True
    if target_page > current_page:
        for _ in range(target_page - current_page):
            try:
                nb = table_frame.locator("a:text-is('Next')")
                if await nb.count() > 0:
                    await nb.first.click(force=True)
                    await asyncio.sleep(3)
                else:
                    return False
            except:
                return False
    return True


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    
    log("=== BANK EXTRACTOR via View Input ===")
    
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
            log(f"RESUMING from page {start_page}, {len(processed_ssns)} done")
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
            if not await nav_to_clients(page):
                log("ERROR: Cannot navigate to Clients"); return
            
            # Navigate to start page
            table_frame = await find_table_frame(page)
            if not table_frame:
                log("ERROR: No table frame"); return
            
            current_page = 1
            if start_page > 1:
                if not await navigate_to_page(table_frame, start_page, 1):
                    log(f"ERROR: Cannot navigate to page {start_page}")
                current_page = start_page
                table_frame = await find_table_frame(page)
            
            total_extracted = len(results)
            total_with_bank = len([r for r in results if r.get("has_bank_data")])
            consecutive_errors = 0
            
            # Process all pages
            while True:
                table_frame = await find_table_frame(page)
                if not table_frame:
                    log("Lost table frame, recovering...")
                    await nav_to_clients(page)
                    await asyncio.sleep(5)
                    table_frame = await find_table_frame(page)
                    if table_frame and current_page > 1:
                        await navigate_to_page(table_frame, current_page, 1)
                        table_frame = await find_table_frame(page)
                    if not table_frame:
                        log("Cannot recover"); break
                
                page_clients = await get_page_clients(table_frame)
                log(f"\n=== PAGE {current_page}: {len(page_clients)} clients ===")
                
                if not page_clients:
                    log("No clients on this page, done!")
                    break
                
                for ci, client in enumerate(page_clients):
                    ssn = client['ssn']
                    name = client['name']
                    
                    if ssn in processed_ssns:
                        continue
                    
                    log(f"  [{ci+1}/{len(page_clients)}] {name} ({ssn})")
                    
                    try:
                        # Ensure we're on the client list
                        table_frame = await find_table_frame(page)
                        if not table_frame:
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                            table_frame = await find_table_frame(page)
                            if table_frame and current_page > 1:
                                await navigate_to_page(table_frame, current_page, 1)
                                table_frame = await find_table_frame(page)
                            if not table_frame:
                                log("    Cannot recover table frame")
                                consecutive_errors += 1
                                continue
                        
                        # Step 1: Double-click to ManageReturnsTab
                        if not await dblclick_client(table_frame, ssn):
                            log(f"    Cannot find SSN {ssn}")
                            consecutive_errors += 1
                            continue
                        
                        await asyncio.sleep(6)
                        
                        # Step 2: Find and click "View Input" button
                        manage_frame = None
                        for frame in page.frames:
                            if "ManageReturns" in frame.url:
                                manage_frame = frame; break
                        
                        if not manage_frame:
                            log("    ManageReturnsTab not found")
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                            table_frame = await find_table_frame(page)
                            if table_frame and current_page > 1:
                                await navigate_to_page(table_frame, current_page, 1)
                            consecutive_errors += 1
                            continue
                        
                        # Click "View Input" - it opens a popup (showuserinputs.php)
                        popup = None
                        try:
                            async with ctx.expect_page(timeout=15000) as popup_info:
                                # Try clicking "View Input" div/button
                                vi = manage_frame.locator("div:text-is('View Input')")
                                if await vi.count() > 0:
                                    await vi.first.click(force=True)
                                else:
                                    vi = manage_frame.locator("text=View Input")
                                    if await vi.count() > 0:
                                        await vi.first.click(force=True)
                                    else:
                                        # Try td
                                        vi = manage_frame.locator("td:text-is('View Input')")
                                        if await vi.count() > 0:
                                            await vi.first.click(force=True)
                                        else:
                                            log("    View Input button not found")
                                            raise Exception("No View Input")
                            
                            popup = await popup_info.value
                            log(f"    ★ Popup opened: {popup.url.split('/')[-1][:40]}")
                            
                        except Exception as e:
                            if "No View Input" in str(e):
                                log("    No View Input button")
                            else:
                                log(f"    No popup: {str(e)[:60]}")
                                # Check if View Input opened in a new page via event
                                for pg in ctx.pages:
                                    if pg != page and "showuserinputs" in pg.url:
                                        popup = pg
                                        log(f"    ★ Found popup page: {popup.url.split('/')[-1][:40]}")
                                        break
                        
                        if popup:
                            # Step 3: Extract bank data from popup
                            is_first_client = (total_extracted == 0)
                            bank_data = await extract_bank_from_popup(popup, is_first=is_first_client)
                            
                            has_bank = bool(bank_data and any(
                                v for k, v in bank_data.items()
                                if any(bk in k.lower() for bk in ["routing", "account"])
                                and v and len(v) > 3
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
                            consecutive_errors = 0
                            
                            if has_bank:
                                total_with_bank += 1
                                log(f"    ★ BANK: {bank_data}")
                            else:
                                log(f"    No bank data")
                            
                            # Close popup
                            try:
                                await popup.close()
                            except:
                                pass
                        else:
                            # No popup captured, still record the attempt
                            results.append({
                                "name": name, "ssn": ssn,
                                "sno": client.get("sno", ""),
                                "bank_fields": {},
                                "has_bank_data": False,
                                "error": "no_popup",
                                "extracted_at": datetime.now().isoformat()
                            })
                            processed_ssns.add(ssn)
                            total_extracted += 1
                            consecutive_errors += 1
                        
                        # Step 4: Navigate back to Clients
                        # Close any remaining popups first
                        for pg in ctx.pages:
                            if pg != page:
                                try: await pg.close()
                                except: pass
                        
                        await nav_to_clients(page)
                        await asyncio.sleep(5)
                        
                        # Navigate to current page
                        table_frame = await find_table_frame(page)
                        if table_frame and current_page > 1:
                            await navigate_to_page(table_frame, current_page, 1)
                        
                    except Exception as e:
                        log(f"    ERROR: {str(e)[:80]}")
                        consecutive_errors += 1
                        # Recover
                        for pg in ctx.pages:
                            if pg != page:
                                try: await pg.close()
                                except: pass
                        try:
                            await nav_to_clients(page)
                            await asyncio.sleep(5)
                            table_frame = await find_table_frame(page)
                            if table_frame and current_page > 1:
                                await navigate_to_page(table_frame, current_page, 1)
                        except: pass
                    
                    if consecutive_errors >= 10:
                        log(f"Too many consecutive errors ({consecutive_errors})")
                        break
                
                # Save progress after each page
                save_progress(results, processed_ssns, current_page)
                log(f"PROGRESS: page={current_page} total={total_extracted} withBank={total_with_bank} errors={consecutive_errors}")
                
                if consecutive_errors >= 10:
                    break
                
                # Next page
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
                            log("No Next button - last page!")
                            break
                    except:
                        log("Cannot click Next")
                        break
                else:
                    break
            
            # Save final
            save_final(results)
            log(f"\n=== COMPLETE ===")
            log(f"Total: {total_extracted}")
            log(f"With bank: {total_with_bank}")
            log(f"Pages: {current_page}")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            if results:
                save_progress(results, processed_ssns, current_page if 'current_page' in dir() else 1)
                save_final(results)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
