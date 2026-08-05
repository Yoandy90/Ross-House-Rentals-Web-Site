"""
Tax Portal - Bank Account Extractor
Assumes we're already logged in (reuses the main flow for login).
Focuses on properly clicking each client and extracting bank info.
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
LOG_FILE = "/tmp/bank_scraper_status.txt"

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
        text="Solve. Return ONLY ONE answer word or number.",
        file_contents=[ImageContent(image_base64=b)]))
    return r.strip().strip('"').strip("'").lower()

async def do_login(page):
    """Full login flow: credentials -> captcha -> SMS -> 2FA code -> secondary code"""
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
    
    # Captcha
    for frame in page.frames:
        if "OLTPRO_captcha" in frame.url:
            imgs = await frame.locator("img").all()
            if imgs:
                cp = f"{OUTPUT_DIR}/cap.png"
                src = await imgs[0].get_attribute("src") or ""
                if src.startswith("data:image"):
                    with open(cp,"wb") as f: f.write(base64.b64decode(src.split(",",1)[1]))
                else: await imgs[0].screenshot(path=cp)
                a = await solve_captcha(cp)
                log(f"CAPTCHA: {a}")
                inp = frame.locator("input[type='text']")
                if await inp.count()>0: await inp.first.fill(a)
                sub = frame.locator("input[type='submit'],input[value='Submit']")
                if await sub.count()>0: await sub.first.click(force=True)
                await asyncio.sleep(5)
            break
    
    # SMS
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
                    await asyncio.sleep(5)
                    break
            except: pass
    
    # Wait for code
    await asyncio.sleep(8)
    log("WAITING_FOR_CODE")
    code = ""
    for _ in range(600):
        if os.path.exists(CODE_FILE):
            with open(CODE_FILE) as f: code = f.read().strip()
            if code and len(code)>=4:
                log(f"CODE: {code}")
                os.remove(CODE_FILE)
                break
        await asyncio.sleep(1)
    if not code: log("ERROR: No code"); return False
    
    # Enter code
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
    
    # Dismiss setup + enter 1990
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
                    await inputs[0].fill("1990")
                    log("ENTERED_1990")
                    bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                    for b in bs:
                        v = await b.get_attribute("value") or await b.text_content() or ""
                        if any(k in v.lower() for k in ["verify","submit","continue"]):
                            await b.click(force=True); break
                    await asyncio.sleep(5)
        except: pass
    
    log("LOGIN_COMPLETE")
    return True


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    
    log("=== BANK ACCOUNT EXTRACTOR ===")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        page = await ctx.new_page()
        
        try:
            if not await do_login(page): return
            
            # Navigate to Clients
            log("NAV_CLIENTS")
            for frame in page.frames:
                if "OLTPRO" in frame.url:
                    try:
                        cl = frame.locator("td:text-is('Clients')")
                        if await cl.count()>0:
                            await cl.first.click(force=True)
                            await asyncio.sleep(5)
                            break
                    except: pass
            
            # Now process clients one by one
            bank_results = []
            processed = 0
            current_page = 1
            
            while True:
                # Find client frame and table
                cf = None
                for frame in page.frames:
                    if "LookUpInfo" in frame.url or "OLTPRO_redirect" in frame.url:
                        try:
                            tables = await frame.locator("table").all()
                            for t in tables:
                                rows = await t.locator("tr").all()
                                if len(rows) >= 3:
                                    h = await rows[0].locator("th,td").all()
                                    ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                                    if "s.no" in ht:
                                        cf = frame
                                        break
                        except: pass
                    if cf: break
                
                if not cf:
                    log(f"No client frame on page {current_page}")
                    break
                
                # Get all rows on this page
                client_table = None
                tables = await cf.locator("table").all()
                for t in tables:
                    rows = await t.locator("tr").all()
                    if len(rows) >= 3:
                        h = await rows[0].locator("th,td").all()
                        ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                        if "s.no" in ht:
                            client_table = t
                            break
                
                if not client_table:
                    log(f"No table on page {current_page}")
                    break
                
                data_rows = await client_table.locator("tr").all()
                num_clients = len(data_rows) - 1
                log(f"Page {current_page}: {num_clients} clients")
                
                # Process each client on this page
                for row_idx in range(1, len(data_rows)):
                    # Re-find frame and table after each iteration (they may change after go_back)
                    if row_idx > 1:
                        cf = None
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
                                                cf = frame
                                                client_table = t
                                                data_rows = rows
                                                break
                                except: pass
                            if cf: break
                        
                        if not cf or row_idx >= len(data_rows):
                            log(f"  Lost frame after row {row_idx}, moving to next page")
                            break
                    
                    try:
                        cells = await data_rows[row_idx].locator("td").all()
                        if len(cells) < 3: continue
                        
                        sno = (await cells[0].text_content() or "").strip()
                        name = (await cells[1].text_content() or "").strip()
                        ssn = (await cells[2].text_content() or "").strip()
                        
                        if not name or name == ",":
                            processed += 1
                            continue
                        
                        # CLICK on client name
                        name_link = cells[1].locator("a")
                        if await name_link.count() > 0:
                            await name_link.first.click(force=True)
                        else:
                            await cells[1].click(force=True)
                        
                        await asyncio.sleep(5)
                        
                        # Examine what loaded - take screenshot for first few
                        if processed < 3:
                            await page.screenshot(path=f"{OUTPUT_DIR}/client_detail_{sno}.png")
                        
                        # Search ALL frames for bank info
                        bank_info = {"s_no": sno, "name": name, "ssn": ssn}
                        
                        # Log frame structure for first client
                        if processed == 0:
                            log("  DETAIL PAGE FRAMES:")
                            for i, frame in enumerate(page.frames):
                                url = frame.url or ""
                                if url and "recaptcha" not in url and url != "about:blank":
                                    fname = url.split('/')[-1].split('?')[0]
                                    try:
                                        text = await frame.locator("body").text_content()
                                        tc = " ".join(text.split())[:150] if text else ""
                                        log(f"    F{i}({fname[:30]}): {tc[:100]}")
                                    except: pass
                        
                        for frame in page.frames:
                            url = frame.url or ""
                            if url and "recaptcha" not in url and url != "about:blank":
                                try:
                                    text = await frame.locator("body").text_content()
                                    if not text: continue
                                    tl = text.lower()
                                    
                                    # Check for bank-related content
                                    if any(k in tl for k in ["bank","routing","account number","checking","savings","direct deposit","aba","refund"]):
                                        log(f"  ★ Bank content found in {url.split('/')[-1].split('?')[0][:25]}")
                                        
                                        # Extract from inputs
                                        inputs = await frame.locator("input").all()
                                        for inp in inputs:
                                            n = (await inp.get_attribute("name") or "").lower()
                                            iid = (await inp.get_attribute("id") or "").lower()
                                            v = (await inp.get_attribute("value") or "").strip()
                                            key = n or iid
                                            if v and any(k in key for k in ["bank","routing","account","rtn","acct","aba","deposit","refund"]):
                                                bank_info[key] = v
                                        
                                        # Extract from selects
                                        selects = await frame.locator("select").all()
                                        for sel in selects:
                                            sn = (await sel.get_attribute("name") or "").lower()
                                            sid = (await sel.get_attribute("id") or "").lower()
                                            key = sn or sid
                                            if any(k in key for k in ["bank","account","type","deposit"]):
                                                try:
                                                    val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                                    if val: bank_info[key] = val
                                                except: pass
                                        
                                        # Extract from TD pairs
                                        tds = await frame.locator("td,th").all()
                                        for i in range(len(tds)-1):
                                            try:
                                                t1 = (await tds[i].text_content() or "").strip()
                                                if len(t1)>50: continue
                                                if any(k in t1.lower() for k in ["routing","account","bank name","checking","savings","aba","refund","deposit"]):
                                                    t2 = (await tds[i+1].text_content() or "").strip()
                                                    if t2 and len(t2)<100:
                                                        bank_info[t1[:40]] = t2
                                            except: pass
                                except: pass
                        
                        has_bank = len(bank_info) > 3
                        bank_results.append(bank_info)
                        processed += 1
                        
                        if processed <= 5 or processed % 50 == 0:
                            bk = {k:v for k,v in bank_info.items() if k not in ('s_no','name','ssn')}
                            log(f"  [{processed}] {name}: {'BANK ✓ ' + str(bk) if has_bank else 'no bank data'}")
                        
                        # GO BACK to client list - use Clients tab instead of go_back
                        try:
                            for frame in page.frames:
                                url = frame.url or ""
                                if "OLTPRO" in url:
                                    cl = frame.locator("td:text-is('Clients')")
                                    if await cl.count()>0:
                                        await cl.first.click(force=True)
                                        await asyncio.sleep(4)
                                        break
                        except:
                            try:
                                await page.go_back(timeout=5000)
                                await asyncio.sleep(3)
                            except: pass
                    
                    except Exception as e:
                        log(f"  Error row {row_idx}: {str(e)[:60]}")
                        processed += 1
                        try:
                            for frame in page.frames:
                                url = frame.url or ""
                                if "OLTPRO" in url:
                                    cl = frame.locator("td:text-is('Clients')")
                                    if await cl.count()>0:
                                        await cl.first.click(force=True)
                                        await asyncio.sleep(4)
                                        break
                        except:
                            try: await page.go_back(timeout=5000); await asyncio.sleep(3)
                            except: pass
                        continue
                
                # Click Next for next page
                current_page += 1
                cf = None
                for frame in page.frames:
                    url = frame.url or ""
                    if "LookUpInfo" in url or "OLTPRO_redirect" in url:
                        cf = frame; break
                
                if cf:
                    try:
                        nb = cf.locator("a:text-is('Next')")
                        if await nb.count()>0:
                            await nb.first.click(force=True)
                            await asyncio.sleep(4)
                        else:
                            log("No Next button, done")
                            break
                    except:
                        log("Next click failed, done")
                        break
                else:
                    log("No frame for Next, done")
                    break
                
                if processed >= 800:  # Safety limit
                    break
            
            # Save results
            with_bank = [c for c in bank_results if len(c) > 3]
            out = f"{OUTPUT_DIR}/bank_data.json"
            with open(out, "w") as f:
                json.dump({
                    "ts": datetime.now().isoformat(),
                    "total_processed": processed,
                    "with_bank_data": len(with_bank),
                    "all_results": bank_results,
                    "bank_only": with_bank,
                }, f, indent=2, ensure_ascii=False)
            
            log(f"DONE: {processed} processed, {len(with_bank)} with bank data -> {out}")
            
            # Also save to permanent location
            import shutil
            shutil.copy(out, "/app/backend/scraped_data/bank_data.json")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/bank_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
