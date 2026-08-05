"""
Tax Portal - Deep ManageReturnsTab Explorer
After double-clicking into ManageReturnsTab, explore its nested iframes and 
tree navigation to find the Client Info / Bank Account section.
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
LOG_FILE = "/tmp/explore_status.txt"

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
    log("=== MANAGE RETURNS TAB EXPLORER ===")
    
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
            
            # Skip to page 3
            for _ in range(2):
                for frame in page.frames:
                    url = frame.url or ""
                    if not url or url == "about:blank" or "recaptcha" in url: continue
                    try:
                        nb = frame.locator("a:text-is('Next')")
                        if await nb.count()>0: await nb.first.click(force=True); await asyncio.sleep(4); break
                    except: pass
            
            # Find client table frame
            table_frame = None
            for frame in page.frames:
                url = frame.url or ""
                if "LookUpInfo" in url or "OLTPRO_redirect" in url:
                    table_frame = frame; break
            if not table_frame: log("ERROR: No table frame"); return
            
            # Get first client SSN from table
            first_ssn = await table_frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                for (const t of tables) {
                    const rows = t.querySelectorAll('tr');
                    if (rows.length < 3) continue;
                    if (!rows[0].textContent.toLowerCase().includes('s.no')) continue;
                    for (let i = 1; i < rows.length; i++) {
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length >= 3) {
                            const name = cells[1].textContent.trim();
                            if (name && name !== ',') return cells[2].textContent.trim();
                        }
                    }
                }
                return '';
            }""")
            log(f"First client SSN: {first_ssn}")
            
            # Double-click to open ManageReturnsTab
            log("Double-clicking...")
            await table_frame.evaluate(f"""(ssn) => {{
                const tables = document.querySelectorAll('table');
                for (const t of tables) {{
                    const rows = t.querySelectorAll('tr');
                    for (let i = 1; i < rows.length; i++) {{
                        const cells = rows[i].querySelectorAll('td');
                        if (cells.length >= 3 && cells[2].textContent.trim() === ssn) {{
                            const event = new MouseEvent('dblclick', {{bubbles: true}});
                            rows[i].dispatchEvent(event);
                            return true;
                        }}
                    }}
                }}
                return false;
            }}""", first_ssn)
            
            await asyncio.sleep(10)
            
            # Now we should be in ManageReturnsTab
            log("\n=== DEEP FRAME ANALYSIS ===")
            log(f"Total frames: {len(page.frames)}")
            
            for fi, frame in enumerate(page.frames):
                url = frame.url or ""
                if not url or url == "about:blank":
                    continue
                fname = url.split('/')[-1].split('?')[0][:40]
                log(f"\nFRAME {fi}: {fname}")
                log(f"  URL: {url[:120]}")
                
                try:
                    # Get iframe structure inside this frame
                    iframes = await frame.evaluate("""() => {
                        const iframes = document.querySelectorAll('iframe');
                        return Array.from(iframes).map(f => ({
                            id: f.id || '',
                            name: f.name || '',
                            src: (f.src || '').substring(0, 100),
                            width: f.width,
                            height: f.height
                        }));
                    }""")
                    if iframes:
                        log(f"  Nested iframes: {len(iframes)}")
                        for iframe in iframes:
                            log(f"    iframe: id='{iframe['id']}' name='{iframe['name']}' src='{iframe['src']}'")
                    
                    # Get ALL links
                    links = await frame.locator("a").all()
                    link_info = []
                    for link in links[:40]:
                        text = (await link.text_content() or "").strip()
                        href = await link.get_attribute("href") or ""
                        onclick = await link.get_attribute("onclick") or ""
                        lid = await link.get_attribute("id") or ""
                        if text and len(text) < 80:
                            link_info.append(f"'{text}' (id={lid}, href={href[:50]}, onclick={onclick[:60]})")
                    if link_info:
                        log(f"  Links ({len(link_info)}):")
                        for li in link_info:
                            log(f"    {li}")
                    
                    # Get text content summary
                    text = await frame.locator("body").text_content(timeout=5000)
                    if text:
                        tc = " ".join(text.split())
                        log(f"  Text length: {len(tc)}")
                        log(f"  First 200: {tc[:200]}")
                        
                        # Check for key navigation items
                        tl = tc.lower()
                        nav_items = ["client info", "personal info", "bank", "direct deposit",
                                     "routing", "account", "w-2", "1099", "sch c", "schedule",
                                     "dependents", "filing info", "refund"]
                        found = [n for n in nav_items if n in tl]
                        if found:
                            log(f"  ★ KEY ITEMS: {found}")
                        
                        # Save full content if it has interesting items
                        if found:
                            with open(f"{OUTPUT_DIR}/explore_frame_{fi}_{fname[:20]}.txt", "w") as fout:
                                fout.write(tc)
                            log(f"  Content saved to explore_frame_{fi}_{fname[:20]}.txt")
                        
                except Exception as e:
                    log(f"  Error: {str(e)[:60]}")
            
            await page.screenshot(path=f"{OUTPUT_DIR}/explore_manage_returns.png")
            
            # ── Now try to find and click on "Client Info" or navigate to bank section ──
            log("\n=== NAVIGATING TO BANK DATA ===")
            
            # Check if there's a TreeNavigation iframe with form links
            for frame in page.frames:
                url = frame.url or ""
                if "TreeNavigation" in url or "tree" in url.lower():
                    log(f"★ Found TreeNavigation frame: {url[:80]}")
                    try:
                        text = await frame.locator("body").text_content(timeout=5000)
                        log(f"  Tree content: {text[:500] if text else 'empty'}")
                        
                        # Look for bank/client info links
                        links = await frame.locator("a").all()
                        for link in links:
                            lt = (await link.text_content() or "").strip()
                            if any(k in lt.lower() for k in ["client info", "bank", "direct", "personal"]):
                                log(f"  ★ Clicking tree link: '{lt}'")
                                await link.click(force=True)
                                await asyncio.sleep(5)
                                break
                    except Exception as e:
                        log(f"  Tree frame error: {e}")
            
            # Check for any frame that has a form tree (list of tax forms on the left)
            for frame in page.frames:
                url = frame.url or ""
                if not url or url == "about:blank" or "recaptcha" in url:
                    continue
                try:
                    # Look for elements with IDs related to navigation/tree
                    tree_html = await frame.evaluate("""() => {
                        const tree = document.getElementById('TreeNavigationAll') || 
                                     document.getElementById('TreeNavigation') ||
                                     document.getElementById('formTree') ||
                                     document.getElementById('leftNav');
                        if (tree) return tree.innerHTML.substring(0, 2000);
                        
                        // Look for any div/table with form navigation
                        const divs = document.querySelectorAll('div, td');
                        for (const d of divs) {
                            const text = d.textContent.toLowerCase();
                            if (text.includes('client info') && text.includes('w-2')) {
                                return d.innerHTML.substring(0, 2000);
                            }
                        }
                        return '';
                    }""")
                    if tree_html:
                        fname = url.split('/')[-1].split('?')[0][:30]
                        log(f"\n★ TREE NAVIGATION found in {fname}:")
                        log(f"  HTML: {tree_html[:500]}")
                        with open(f"{OUTPUT_DIR}/tree_nav_html.txt", "w") as fout:
                            fout.write(tree_html)
                except:
                    pass
            
            # Take final screenshot
            await page.screenshot(path=f"{OUTPUT_DIR}/explore_final.png")
            
            # ── Last resort: dump ALL frame content to files for manual analysis ──
            log("\n=== DUMPING ALL FRAME CONTENT ===")
            for fi, frame in enumerate(page.frames):
                url = frame.url or ""
                if not url or url == "about:blank" or "recaptcha" in url:
                    continue
                fname = url.split('/')[-1].split('?')[0][:30]
                try:
                    text = await frame.locator("body").text_content(timeout=5000)
                    if text and len(text) > 100:
                        tc = " ".join(text.split())
                        with open(f"{OUTPUT_DIR}/dump_f{fi}_{fname[:20]}.txt", "w") as fout:
                            fout.write(tc)
                        log(f"  F{fi}({fname}): {len(tc)} chars saved")
                except:
                    pass
            
            log("\n=== EXPLORATION COMPLETE ===")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/explore_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
