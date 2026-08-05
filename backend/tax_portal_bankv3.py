"""
Tax Portal - Bank Extractor v3 
Flow: Login → Clients → DblClick → ManageReturnsTab → Edit → ClientInfo → Bank Data
The Edit button opens a popup. The popup has TreeNavigationAll with form links.
ClientInfo form has bank data at the bottom.
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
LOG_FILE = "/tmp/bankv3_status.txt"

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
                        if "sms" in v.lower(): await r.click(force=True); break
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
    log("LOGIN_COMPLETE"); return True


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    log("=== BANK EXTRACTOR V3 - Edit → ClientInfo Flow ===")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        page = await ctx.new_page()
        
        try:
            if not await do_login(page): return
            
            # Nav to Clients
            for frame in page.frames:
                if "OLTPRO" in frame.url:
                    try:
                        cl = frame.locator("td:text-is('Clients')")
                        if await cl.count()>0: await cl.first.click(force=True); await asyncio.sleep(8); break
                    except: pass
            
            # Skip to page 3 for real clients
            for _ in range(2):
                for frame in page.frames:
                    url = frame.url or ""
                    if "LookUpInfo" in url or "OLTPRO_redirect" in url:
                        try:
                            nb = frame.locator("a:text-is('Next')")
                            if await nb.count()>0: await nb.first.click(force=True); await asyncio.sleep(4)
                        except: pass
            
            # Find table frame and get first client SSN
            table_frame = None
            for frame in page.frames:
                url = frame.url or ""
                if "LookUpInfo" in url or "OLTPRO_redirect" in url:
                    table_frame = frame; break
            if not table_frame: log("ERROR: No table frame"); return
            
            first_client = await table_frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                for (const t of tables) {
                    const rows = t.querySelectorAll('tr');
                    if (rows.length < 3) continue;
                    if (!rows[0].textContent.toLowerCase().includes('s.no')) continue;
                    for (let i = 1; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length >= 3) {
                            const name = cells[1].textContent.trim();
                            if (name && name !== ',') {
                                return { name: name, ssn: cells[2].textContent.trim() };
                            }
                        }
                    }
                }
                return null;
            }""")
            
            if not first_client:
                log("ERROR: No client found"); return
            
            log(f"Testing with: {first_client['name']} ({first_client['ssn']})")
            
            # Double-click to open ManageReturnsTab
            log("Step 1: Double-click to ManageReturnsTab...")
            await table_frame.evaluate(f"""(ssn) => {{
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
            }}""", first_client['ssn'])
            
            await asyncio.sleep(10)
            log("ManageReturnsTab loaded")
            
            # Step 2: Find and click "Edit" in ManageReturnsTab
            log("Step 2: Looking for Edit button...")
            manage_frame = None
            for frame in page.frames:
                if "ManageReturns" in frame.url:
                    manage_frame = frame
                    break
            
            if not manage_frame:
                log("ERROR: ManageReturnsTab not found")
                # Try the redirect frame
                for frame in page.frames:
                    if "OLTPRO_redirect" in frame.url or "LookUpInfo" in frame.url:
                        text = await frame.locator("body").text_content(timeout=5000)
                        if text and "personal info" in text.lower():
                            manage_frame = frame
                            break
            
            if not manage_frame:
                log("ERROR: Cannot find ManageReturnsTab frame"); return
            
            log(f"ManageReturnsTab frame: {manage_frame.url.split('/')[-1][:40]}")
            
            # Find the "Edit" link/button - it might be a link with onclick that opens popup
            edit_info = await manage_frame.evaluate("""() => {
                // Find all links and elements with text "Edit"
                const allElements = document.querySelectorAll('a, input, button, td, span, div');
                let editElements = [];
                for (const el of allElements) {
                    const text = el.textContent?.trim() || '';
                    const value = el.getAttribute('value') || '';
                    const onclick = el.getAttribute('onclick') || '';
                    const href = el.getAttribute('href') || '';
                    
                    if ((text === 'Edit' || value === 'Edit') && el.tagName !== 'SCRIPT') {
                        editElements.push({
                            tag: el.tagName,
                            text: text.substring(0, 30),
                            onclick: onclick.substring(0, 200),
                            href: href.substring(0, 200),
                            id: el.id || '',
                            class: el.className?.substring?.(0, 50) || ''
                        });
                    }
                }
                return editElements;
            }""")
            
            log(f"Edit elements found: {json.dumps(edit_info, indent=2)}")
            
            # Click the Edit element
            popup_captured = False
            edit_popup = None
            
            if edit_info:
                # The Edit likely opens a popup via onclick or href
                for ei in edit_info:
                    if ei.get('onclick') or ei.get('href'):
                        log(f"Clicking Edit: {ei['tag']} onclick={ei['onclick'][:80]}")
                        break
                
                # Try to capture popup when clicking Edit
                try:
                    async with ctx.expect_page(timeout=15000) as popup_info:
                        # Click the Edit element
                        edit_el = manage_frame.locator("text='Edit'").first
                        # Check if it's a link vs TD/div
                        edit_link = manage_frame.locator("a:text-is('Edit')")
                        if await edit_link.count() > 0:
                            await edit_link.first.click(force=True)
                        else:
                            edit_td = manage_frame.locator("td:text-is('Edit')")
                            if await edit_td.count() > 0:
                                await edit_td.first.click(force=True)
                            else:
                                await edit_el.click(force=True)
                    
                    edit_popup = await popup_info.value
                    popup_captured = True
                    log(f"★ EDIT POPUP CAPTURED! URL: {edit_popup.url[:100]}")
                    
                except Exception as e:
                    log(f"No popup from Edit click: {str(e)[:80]}")
            
            if not popup_captured:
                # Edit might navigate within the frame, not open a popup
                log("No popup - checking if frame navigated...")
                await asyncio.sleep(5)
                
                # Check all frames for new content
                for fi, frame in enumerate(page.frames):
                    url = frame.url or ""
                    if not url or url == "about:blank" or "recaptcha" in url: continue
                    fname = url.split('/')[-1].split('?')[0][:30]
                    log(f"  F{fi}({fname}): {url[:80]}")
                
                # Maybe Edit uses JavaScript to load content in OLTPROIFrame
                for frame in page.frames:
                    url = frame.url or ""
                    if "OLTPROIFrame" in url or "editReturn" in url.lower() or "ClientInfo" in url:
                        log(f"★ Found editor frame: {url[:80]}")
                        edit_popup = frame
                        break
                
                # Try all pages
                for pg in ctx.pages:
                    if pg != page:
                        log(f"★ Found new page: {pg.url[:80]}")
                        edit_popup = pg
                        popup_captured = True
                        break
            
            # ── Step 3: Navigate to ClientInfo in the editor ──
            target = edit_popup if edit_popup else page
            
            if popup_captured and edit_popup:
                try:
                    await edit_popup.wait_for_load_state("networkidle", timeout=15000)
                except:
                    await asyncio.sleep(8)
                
                log(f"Editor page URL: {edit_popup.url[:100]}")
                await edit_popup.screenshot(path=f"{OUTPUT_DIR}/editor_page.png")
            
            log("Step 3: Looking for ClientInfo / Bank data...")
            
            # Search ALL frames in target for TreeNavigationAll, ClientInfo, Bank data
            target_pages = list(ctx.pages)
            
            for pg_idx, pg in enumerate(target_pages):
                log(f"\nSearching page {pg_idx} ({pg.url[:50]})")
                log(f"  Frames: {len(pg.frames)}")
                
                for fi, frame in enumerate(pg.frames):
                    url = frame.url or ""
                    if not url or url == "about:blank" or "recaptcha" in url: continue
                    fname = url.split('/')[-1].split('?')[0][:30]
                    
                    try:
                        # Check for TreeNavigationAll iframe
                        tree = await frame.evaluate("""() => {
                            const tree = document.getElementById('TreeNavigationAll');
                            if (tree) {
                                return {
                                    tag: tree.tagName,
                                    src: tree.src || '',
                                    id: tree.id
                                };
                            }
                            return null;
                        }""")
                        
                        if tree:
                            log(f"  ★ TreeNavigationAll in F{fi}({fname}): {tree}")
                        
                        # Get text content
                        text = await frame.locator("body").text_content(timeout=5000)
                        if not text: continue
                        tc = " ".join(text.split())
                        
                        # Check for form tree items
                        if any(k in tc.lower() for k in ["clientinfo", "client info", "w-2", "1099"]):
                            log(f"  ★ FORM TREE in F{fi}({fname})!")
                            log(f"    Content: {tc[:300]}")
                            with open(f"{OUTPUT_DIR}/form_tree_f{fi}.txt", "w") as fout:
                                fout.write(tc)
                            
                            # Look for ClientInfo link
                            ci_link = frame.locator("a:text-is('ClientInfo')")
                            ci_link2 = frame.locator("a:text-is('Client Info')")
                            ci_link3 = frame.locator("text=ClientInfo")
                            
                            for ci in [ci_link, ci_link2, ci_link3]:
                                if await ci.count() > 0:
                                    log(f"  ★ Clicking ClientInfo link...")
                                    await ci.first.click(force=True)
                                    await asyncio.sleep(5)
                                    break
                        
                        # Check for bank data directly
                        bank_kw = ["routing number", "account number", "bank name", 
                                   "direct deposit", "checking account", "savings account"]
                        found = [k for k in bank_kw if k in tc.lower()]
                        if found:
                            log(f"  ★★★ BANK DATA FOUND in F{fi}({fname})! Keywords: {found}")
                            
                            # Scroll to bottom
                            await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await asyncio.sleep(2)
                            
                            # Extract ALL inputs
                            inputs = await frame.locator("input").all()
                            log(f"  Total inputs: {len(inputs)}")
                            bank_inputs = {}
                            for inp in inputs:
                                n = (await inp.get_attribute("name") or "")
                                v = (await inp.get_attribute("value") or "").strip()
                                iid = (await inp.get_attribute("id") or "")
                                key = n or iid
                                key_lower = key.lower()
                                if v and any(k in key_lower for k in [
                                    "bank","routing","account","rtn","aba",
                                    "deposit","refund","drt","check","saving"
                                ]):
                                    bank_inputs[key] = v
                                    log(f"    ★ INPUT: {key} = '{v}'")
                            
                            # Extract selects
                            selects = await frame.locator("select").all()
                            for sel in selects:
                                sn = (await sel.get_attribute("name") or "")
                                if any(k in sn.lower() for k in ["bank","account","type","deposit","refund"]):
                                    try:
                                        val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                        if val:
                                            bank_inputs[sn] = val
                                            log(f"    ★ SELECT: {sn} = '{val}'")
                                    except: pass
                            
                            # Save results
                            log(f"  Bank data extracted: {json.dumps(bank_inputs, indent=2)}")
                            with open(f"{OUTPUT_DIR}/bank_result_test.json", "w") as fout:
                                json.dump({"client": first_client, "bank": bank_inputs}, fout, indent=2)
                            
                            # Save surrounding HTML
                            html = await frame.locator("body").inner_html()
                            for kw in ["routing", "bank", "direct deposit"]:
                                idx = html.lower().find(kw)
                                if idx >= 0:
                                    section = html[max(0,idx-500):idx+1000]
                                    with open(f"{OUTPUT_DIR}/bank_html_v3.txt", "w") as fout:
                                        fout.write(section)
                                    log(f"  Bank HTML section saved")
                                    break
                            
                            # Dump last 500 chars of text
                            log(f"  Last 500 chars: {tc[-500:]}")
                            
                    except Exception as e:
                        log(f"  F{fi}({fname}) error: {str(e)[:60]}")
            
            # Close any popups
            for pg in ctx.pages:
                if pg != page:
                    try: await pg.close()
                    except: pass
            
            await page.screenshot(path=f"{OUTPUT_DIR}/bankv3_final.png")
            log("\n=== V3 COMPLETE ===")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/bankv3_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
