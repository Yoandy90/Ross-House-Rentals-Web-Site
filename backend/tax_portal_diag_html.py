"""
Tax Portal - HTML Structure Diagnostic
Goal: Get the RAW HTML of the client table rows to understand the click mechanism.
Also check tr onclick handlers, links in other columns, etc.
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
LOG_FILE = "/tmp/diag_html_status.txt"

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


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f): os.remove(f)
    
    log("=== HTML STRUCTURE DIAGNOSTIC ===")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox","--disable-blink-features=AutomationControlled"])
        ctx = await browser.new_context(viewport={"width":1920,"height":1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
        page = await ctx.new_page()
        
        popup_pages = []
        ctx.on("page", lambda pg: popup_pages.append(pg))
        
        try:
            if not await do_login(page): return
            
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
                    except: pass
            
            # Skip to page 3 for real clients
            for skip in range(2):
                for frame in page.frames:
                    url = frame.url or ""
                    if not url or url == "about:blank" or "recaptcha" in url: continue
                    try:
                        nb = frame.locator("a:text-is('Next')")
                        if await nb.count() > 0:
                            await nb.first.click(force=True)
                            await asyncio.sleep(4)
                            break
                    except: pass
            
            # Find the client table frame
            table_frame = None
            for frame in page.frames:
                url = frame.url or ""
                if not url or url == "about:blank" or "recaptcha" in url: continue
                try:
                    tables = await frame.locator("table").all()
                    for t in tables:
                        rows = await t.locator("tr").all()
                        if len(rows) >= 3:
                            h = await rows[0].locator("th,td").all()
                            ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                            if "s.no" in ht:
                                table_frame = frame
                                break
                except: pass
                if table_frame: break
            
            if not table_frame:
                log("ERROR: No client table frame")
                return
            
            log(f"Table frame: {table_frame.url.split('/')[-1].split('?')[0]}")
            
            # ── GET RAW HTML of the table ──
            log("\n=== RAW HTML ANALYSIS ===")
            
            # Get the full HTML of the client table
            table_html = await table_frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                for (const t of tables) {
                    const rows = t.querySelectorAll('tr');
                    if (rows.length >= 3) {
                        const firstRow = rows[0];
                        const headerText = firstRow.textContent.toLowerCase();
                        if (headerText.includes('s.no')) {
                            // Return HTML of header + first 3 data rows
                            let html = '';
                            for (let i = 0; i < Math.min(rows.length, 5); i++) {
                                html += 'ROW_' + i + ': ' + rows[i].outerHTML + '\\n\\n';
                            }
                            return html;
                        }
                    }
                }
                return 'TABLE_NOT_FOUND';
            }""")
            
            # Save full HTML
            with open(f"{OUTPUT_DIR}/client_table_html.txt", "w") as f:
                f.write(table_html)
            log(f"Full table HTML saved to client_table_html.txt ({len(table_html)} chars)")
            
            # Log first 2000 chars
            log(f"TABLE HTML (first 2000):\n{table_html[:2000]}")
            
            # ── Check for onclick handlers on rows ──
            log("\n=== ONCLICK HANDLERS ===")
            onclick_info = await table_frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                for (const t of tables) {
                    const rows = t.querySelectorAll('tr');
                    if (rows.length >= 3) {
                        const headerText = rows[0].textContent.toLowerCase();
                        if (headerText.includes('s.no')) {
                            let info = [];
                            for (let i = 1; i < Math.min(rows.length, 5); i++) {
                                const row = rows[i];
                                const rowInfo = {
                                    row_idx: i,
                                    tr_onclick: row.getAttribute('onclick') || '',
                                    tr_style: row.getAttribute('style') || '',
                                    tr_class: row.getAttribute('class') || '',
                                    tr_id: row.getAttribute('id') || '',
                                    cells: []
                                };
                                const cells = row.querySelectorAll('td');
                                for (let j = 0; j < cells.length; j++) {
                                    const cell = cells[j];
                                    const links = cell.querySelectorAll('a');
                                    const inputs = cell.querySelectorAll('input');
                                    const buttons = cell.querySelectorAll('button');
                                    const cellInfo = {
                                        col: j,
                                        text: cell.textContent.trim().substring(0, 60),
                                        onclick: cell.getAttribute('onclick') || '',
                                        class: cell.getAttribute('class') || '',
                                        links: [],
                                        inputs: [],
                                        buttons: []
                                    };
                                    links.forEach(l => {
                                        cellInfo.links.push({
                                            href: l.getAttribute('href') || '',
                                            target: l.getAttribute('target') || '',
                                            onclick: l.getAttribute('onclick') || '',
                                            text: l.textContent.trim().substring(0, 40),
                                            outerHTML: l.outerHTML.substring(0, 200)
                                        });
                                    });
                                    inputs.forEach(inp => {
                                        cellInfo.inputs.push({
                                            type: inp.getAttribute('type') || '',
                                            name: inp.getAttribute('name') || '',
                                            value: inp.getAttribute('value') || '',
                                            onclick: inp.getAttribute('onclick') || ''
                                        });
                                    });
                                    buttons.forEach(btn => {
                                        cellInfo.buttons.push({
                                            text: btn.textContent.trim(),
                                            onclick: btn.getAttribute('onclick') || ''
                                        });
                                    });
                                    if (cellInfo.links.length > 0 || cellInfo.inputs.length > 0 || 
                                        cellInfo.buttons.length > 0 || cellInfo.onclick) {
                                        rowInfo.cells.push(cellInfo);
                                    }
                                }
                                info.push(rowInfo);
                            }
                            return JSON.stringify(info, null, 2);
                        }
                    }
                }
                return 'NOT_FOUND';
            }""")
            
            log(f"ONCLICK INFO:\n{onclick_info}")
            
            # Save onclick info
            with open(f"{OUTPUT_DIR}/onclick_info.json", "w") as f:
                f.write(onclick_info)
            
            # ── Check for sub-navigation links ──
            log("\n=== SUB-NAVIGATION LINKS ===")
            all_links = await table_frame.locator("a").all()
            log(f"Total links in frame: {len(all_links)}")
            for link in all_links[:30]:
                href = await link.get_attribute("href") or ""
                text = (await link.text_content() or "").strip()
                onclick = await link.get_attribute("onclick") or ""
                target = await link.get_attribute("target") or ""
                if text and len(text) < 80:
                    log(f"  LINK: '{text}' href='{href[:80]}' target='{target}' onclick='{onclick[:80]}'")
            
            # ── Also check all iframes within the frame ──
            log("\n=== NESTED IFRAMES ===")
            iframe_info = await table_frame.evaluate("""() => {
                const iframes = document.querySelectorAll('iframe');
                let info = [];
                for (const iframe of iframes) {
                    info.push({
                        id: iframe.id || '',
                        name: iframe.name || '',
                        src: iframe.src || '',
                        width: iframe.width || '',
                        height: iframe.height || ''
                    });
                }
                return JSON.stringify(info, null, 2);
            }""")
            log(f"Nested iframes: {iframe_info}")
            
            # ── Try alternative: Look for "Client Info" or "View" buttons/links ──
            log("\n=== SEARCHING FOR CLIENT ACCESS MECHANISM ===")
            
            # Check ALL frames for any "client info", "view", "open" buttons
            for fi, frame in enumerate(page.frames):
                url = frame.url or ""
                if not url or url == "about:blank" or "recaptcha" in url: continue
                fname = url.split('/')[-1].split('?')[0][:30]
                try:
                    # Look for ALL interactive elements
                    buttons = await frame.locator("input[type='button'],input[type='submit'],button").all()
                    for btn in buttons:
                        v = await btn.get_attribute("value") or await btn.text_content() or ""
                        onclick = await btn.get_attribute("onclick") or ""
                        if v.strip():
                            log(f"  F{fi}({fname}) BTN: '{v.strip()[:40]}' onclick='{onclick[:80]}'")
                except: pass
            
            # ── Try clicking directly on the row via JavaScript ──
            log("\n=== TRYING JS CLICK ON CLIENT ROW ===")
            popup_pages.clear()
            
            # Get the name text for identification
            result = await table_frame.evaluate("""() => {
                const tables = document.querySelectorAll('table');
                for (const t of tables) {
                    const rows = t.querySelectorAll('tr');
                    if (rows.length >= 3) {
                        const headerText = rows[0].textContent.toLowerCase();
                        if (headerText.includes('s.no')) {
                            // Find first row with a real name
                            for (let i = 1; i < rows.length; i++) {
                                const cells = rows[i].querySelectorAll('td');
                                if (cells.length >= 2) {
                                    const name = cells[1].textContent.trim();
                                    if (name && name !== ',') {
                                        // Try to find ANY clickable element
                                        const allElements = rows[i].querySelectorAll('*');
                                        let clickables = [];
                                        for (const el of allElements) {
                                            if (el.onclick || el.getAttribute('onclick') || 
                                                el.tagName === 'A' || el.tagName === 'BUTTON' ||
                                                (el.tagName === 'INPUT' && el.type !== 'hidden') ||
                                                el.style.cursor === 'pointer' ||
                                                window.getComputedStyle(el).cursor === 'pointer') {
                                                clickables.push({
                                                    tag: el.tagName,
                                                    text: el.textContent.trim().substring(0, 40),
                                                    onclick: el.getAttribute('onclick') || '',
                                                    href: el.getAttribute('href') || '',
                                                    class: el.className || '',
                                                    id: el.id || ''
                                                });
                                            }
                                        }
                                        return JSON.stringify({
                                            name: name,
                                            row_html: rows[i].innerHTML.substring(0, 500),
                                            clickables: clickables
                                        }, null, 2);
                                    }
                                }
                            }
                        }
                    }
                }
                return 'NOT_FOUND';
            }""")
            
            log(f"CLICKABLE ELEMENTS:\n{result}")
            
            with open(f"{OUTPUT_DIR}/clickable_elements.json", "w") as f:
                f.write(result)
            
            log("\n=== HTML DIAGNOSTIC COMPLETE ===")
            await page.screenshot(path=f"{OUTPUT_DIR}/diag_html_final.png")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback; traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/diag_html_error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
