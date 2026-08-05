"""
Quick diagnostic script - Login, click on ONE client, and dump ALL info from their detail page.
Focuses on understanding the page structure for bank data extraction.
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
LOG_FILE = "/tmp/diag_status.txt"

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

async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    
    log("=== DIAGNOSTIC: Client Detail Page Analysis ===")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        page = await ctx.new_page()
        
        try:
            # LOGIN (compact)
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
            await lf.locator("#id_input-username").fill(FIRM_ID)
            await lf.locator("#id_input-passwrd").fill(PASSWORD)
            await lf.locator("#id_input-firmName").fill(USERNAME)
            await asyncio.sleep(1)
            await lf.locator("#LoginButton").click(force=True)
            await asyncio.sleep(5)
            
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
            for frame in page.frames:
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    try:
                        t = await frame.locator("body").text_content()
                        if t and "verification" in t.lower():
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
                                if any(k in v.lower() for k in ["continue","send"]):
                                    await b.click(force=True); log("SMS_SENT"); break
                            await asyncio.sleep(5)
                            break
                    except: pass
            
            await asyncio.sleep(8)
            log("WAITING_FOR_CODE")
            code = ""
            for _ in range(600):
                if os.path.exists(CODE_FILE):
                    with open(CODE_FILE) as f: code = f.read().strip()
                    if code and len(code)>=4: os.remove(CODE_FILE); break
                await asyncio.sleep(1)
            if not code: log("ERROR: No code"); return
            log(f"CODE: {code}")
            
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
                    if await nn.count()>0: await nn.first.click(force=True)
                except: pass
            await asyncio.sleep(5)
            
            for frame in page.frames:
                try:
                    t = await frame.locator("body").text_content()
                    if t and any(k in t.lower() for k in ["pin","code","security"]):
                        inputs = await frame.locator("input[type='text'],input[type='password'],input[type='tel']").all()
                        if inputs:
                            await inputs[0].fill("1990")
                            bs = await frame.locator("input[type='submit'],input[type='button'],button").all()
                            for b in bs:
                                v = await b.get_attribute("value") or await b.text_content() or ""
                                if any(k in v.lower() for k in ["verify","submit"]):
                                    await b.click(force=True); break
                            await asyncio.sleep(5)
                except: pass
            
            log("LOGGED_IN")
            
            # Navigate to Clients
            for frame in page.frames:
                if "OLTPRO" in frame.url:
                    try:
                        cl = frame.locator("td:text-is('Clients')")
                        if await cl.count()>0:
                            await cl.first.click(force=True)
                            await asyncio.sleep(5)
                            break
                    except: pass
            
            log("ON_CLIENTS_PAGE")
            
            # Skip to page 3 to find a client with a real name
            for _ in range(2):
                for frame in page.frames:
                    try:
                        nb = frame.locator("a:text-is('Next')")
                        if await nb.count()>0:
                            await nb.first.click(force=True)
                            await asyncio.sleep(3)
                            break
                    except: pass
            
            log("SKIPPED_TO_PAGE_3")
            
            # Find and click on the FIRST client with a real name
            for frame in page.frames:
                url = frame.url or ""
                if "OLTPRO" in url and "recaptcha" not in url:
                    try:
                        tables = await frame.locator("table").all()
                        for table in tables:
                            rows = await table.locator("tr").all()
                            if len(rows) >= 3:
                                h = await rows[0].locator("th,td").all()
                                ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                                if "s.no" not in ht: continue
                                
                                # Find first row with a real name
                                for row_idx in range(1, len(rows)):
                                    cells = await rows[row_idx].locator("td").all()
                                    if len(cells) < 3: continue
                                    name = (await cells[1].text_content() or "").strip()
                                    if name and name != ",":
                                        log(f"CLICKING: {name}")
                                        # Click the name link
                                        link = cells[1].locator("a")
                                        if await link.count()>0:
                                            await link.first.click(force=True)
                                        else:
                                            await cells[1].click(force=True)
                                        await asyncio.sleep(6)
                                        break
                                break
                    except: pass
            
            # NOW: Dump EVERYTHING about the client detail page
            log("=== CLIENT DETAIL PAGE ANALYSIS ===")
            
            await page.screenshot(path=f"{OUTPUT_DIR}/detail_top.png")
            
            for i, frame in enumerate(page.frames):
                url = frame.url or ""
                if url and "recaptcha" not in url and url != "about:blank":
                    fname = url.split('/')[-1].split('?')[0]
                    try:
                        # Get full text content
                        text = await frame.locator("body").text_content()
                        if not text: continue
                        text_clean = " ".join(text.split())
                        
                        log(f"\n=== FRAME {i}: {fname} (len={len(text_clean)}) ===")
                        
                        # Save long content to file
                        if len(text_clean) > 200:
                            with open(f"{OUTPUT_DIR}/frame_{i}_{fname[:20]}.txt", "w") as f:
                                f.write(text_clean)
                            log(f"  Full content saved to frame_{i}_{fname[:20]}.txt")
                            log(f"  First 300 chars: {text_clean[:300]}")
                            log(f"  Last 500 chars: {text_clean[-500:]}")
                        else:
                            log(f"  Content: {text_clean}")
                        
                        # Check for bank-related content
                        tl = text_clean.lower()
                        if any(k in tl for k in ["bank","routing","account","direct deposit","checking","savings","refund"]):
                            log(f"  ★★★ BANK CONTENT DETECTED ★★★")
                            
                            # Find the bank section - extract surrounding text
                            for keyword in ["routing", "bank", "account", "direct deposit"]:
                                idx = tl.find(keyword)
                                if idx >= 0:
                                    start = max(0, idx - 50)
                                    end = min(len(text_clean), idx + 200)
                                    log(f"  Context for '{keyword}': ...{text_clean[start:end]}...")
                        
                        # SCROLL DOWN in this frame
                        try:
                            await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await asyncio.sleep(2)
                        except: pass
                        
                        # List ALL inputs with their values
                        inputs = await frame.locator("input").all()
                        if inputs:
                            log(f"  === {len(inputs)} INPUTS ===")
                            for inp in inputs[:50]:
                                n = (await inp.get_attribute("name") or "")
                                iid = (await inp.get_attribute("id") or "")
                                t = (await inp.get_attribute("type") or "")
                                v = (await inp.get_attribute("value") or "")
                                if v or any(k in (n+iid).lower() for k in ["bank","routing","account","rtn","deposit","refund","aba"]):
                                    log(f"    INPUT: name={n} id={iid} type={t} value='{v[:50]}'")
                        
                        # List ALL selects
                        selects = await frame.locator("select").all()
                        if selects:
                            log(f"  === {len(selects)} SELECTS ===")
                            for sel in selects[:20]:
                                sn = (await sel.get_attribute("name") or "")
                                sid = (await sel.get_attribute("id") or "")
                                try:
                                    val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                    log(f"    SELECT: name={sn} id={sid} selected='{val}'")
                                except: pass
                        
                    except Exception as e:
                        log(f"  Frame {i} error: {e}")
            
            # Take screenshot of bottom of page (after scroll)
            await page.screenshot(path=f"{OUTPUT_DIR}/detail_bottom.png")
            
            log("=== DIAGNOSTIC COMPLETE ===")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/diag_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
