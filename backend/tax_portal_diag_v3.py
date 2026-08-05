"""
Tax Portal - Deep Diagnostic v3
Goal: Understand EXACTLY what happens when clicking a client name.
Compares frames before/after click, checks for popups, new frames, etc.
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
LOG_FILE = "/tmp/diag_v3_status.txt"

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
        text="Solve. Return ONLY ONE answer word or number. If it asks to identify a word from a list, return just that word. If math, return the number.",
        file_contents=[ImageContent(image_base64=b)]))
    return r.strip().strip('"').strip("'").lower()

async def do_login(page, ctx):
    """Full login flow with interactive SMS code via file."""
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
    
    # SMS
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
    
    await asyncio.sleep(8)
    log("WAITING_FOR_CODE")
    code = ""
    for _ in range(1800):
        if os.path.exists(CODE_FILE):
            with open(CODE_FILE) as f:
                code = f.read().strip()
            if code and len(code) >= 4:
                log(f"CODE: {code}")
                os.remove(CODE_FILE)
                break
        await asyncio.sleep(1)
    if not code:
        log("ERROR: No code")
        return False
    
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
    
    for frame in page.frames:
        try:
            nn = frame.locator("input[value='Not at this time']")
            if await nn.count() > 0:
                await nn.first.click(force=True)
                log("DISMISSED_SETUP")
        except:
            pass
    await asyncio.sleep(5)
    
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


async def dump_frames(page, ctx, label):
    """Dump all frames across all pages for debugging."""
    log(f"\n=== {label} ===")
    for pi, pg in enumerate(ctx.pages):
        log(f"  Page {pi}: {pg.url[:80]}")
        for fi, frame in enumerate(pg.frames):
            url = frame.url or ""
            if not url or url == "about:blank":
                continue
            fname = url.split('/')[-1].split('?')[0][:35]
            try:
                text = await frame.locator("body").text_content(timeout=3000)
                tc = " ".join(text.split())[:120] if text else "(empty)"
                log(f"    F{fi}({fname}): {tc}")
            except:
                log(f"    F{fi}({fname}): (timeout)")


async def main():
    for f in [CODE_FILE, LOG_FILE]:
        if os.path.exists(f):
            os.remove(f)
    
    log("=== DEEP DIAGNOSTIC V3 ===")
    
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
        
        # Track ALL popups
        popup_pages = []
        ctx.on("page", lambda p: popup_pages.append(p))
        
        try:
            if not await do_login(page, ctx):
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
            
            # Skip to page 2+ where real clients exist (page 1 has blank entries)
            log("Skipping to page with real clients...")
            for skip in range(2):
                for frame in page.frames:
                    url = frame.url or ""
                    if not url or url == "about:blank" or "recaptcha" in url:
                        continue
                    try:
                        nb = frame.locator("a:text-is('Next')")
                        if await nb.count() > 0:
                            await nb.first.click(force=True)
                            await asyncio.sleep(4)
                            break
                    except:
                        pass
            log("Skipped to page 3")
            
            # Dump frame structure BEFORE clicking
            await dump_frames(page, ctx, "FRAMES BEFORE CLIENT CLICK")
            
            # Find the table with client data in ANY frame
            table_frame = None
            client_table = None
            for frame in page.frames:
                url = frame.url or ""
                if not url or url == "about:blank" or "recaptcha" in url:
                    continue
                try:
                    tables = await frame.locator("table").all()
                    for t in tables:
                        rows = await t.locator("tr").all()
                        if len(rows) >= 3:
                            h = await rows[0].locator("th,td").all()
                            ht = " ".join([(await c.text_content() or "") for c in h]).lower()
                            if "s.no" in ht and "primary name" in ht:
                                table_frame = frame
                                client_table = t
                                fname = url.split('/')[-1].split('?')[0][:30]
                                log(f"★ Found client table in frame: {fname}")
                                break
                except:
                    pass
                if table_frame:
                    break
            
            if not table_frame:
                log("ERROR: No client table found in any frame!")
                # Dump more details about each frame
                for fi, frame in enumerate(page.frames):
                    url = frame.url or ""
                    if not url or url == "about:blank":
                        continue
                    fname = url.split('/')[-1].split('?')[0][:35]
                    try:
                        tables = await frame.locator("table").all()
                        log(f"  F{fi}({fname}): {len(tables)} tables")
                        for ti, t in enumerate(tables[:5]):
                            rows = await t.locator("tr").all()
                            if len(rows) > 0:
                                first_row = await rows[0].locator("th,td").all()
                                ht = " ".join([(await c.text_content() or "").strip()[:20] for c in first_row[:6]])
                                log(f"    T{ti}: {len(rows)}rows, headers: {ht}")
                    except Exception as e:
                        log(f"  F{fi}({fname}): error {str(e)[:50]}")
                await page.screenshot(path=f"{OUTPUT_DIR}/diag_v3_no_table.png")
                return
            
            # Get the first client with a real name
            data_rows = await client_table.locator("tr").all()
            log(f"Client table: {len(data_rows)} rows (including header)")
            
            target_row = None
            target_name = ""
            target_ssn = ""
            for row_idx in range(1, min(len(data_rows), 11)):
                cells = await data_rows[row_idx].locator("td").all()
                if len(cells) < 3:
                    continue
                name = (await cells[1].text_content() or "").strip()
                if name and name != ",":
                    target_row = data_rows[row_idx]
                    target_name = name
                    target_ssn = (await cells[2].text_content() or "").strip()
                    break
            
            if not target_row:
                log("ERROR: No valid client found")
                return
            
            log(f"TARGET CLIENT: {target_name} ({target_ssn})")
            
            # Get the link element and its attributes
            cells = await target_row.locator("td").all()
            link = cells[1].locator("a")
            
            if await link.count() > 0:
                href = await link.first.get_attribute("href") or ""
                target = await link.first.get_attribute("target") or ""
                onclick = await link.first.get_attribute("onclick") or ""
                link_html = await link.first.evaluate("el => el.outerHTML")
                log(f"LINK ATTRIBUTES:")
                log(f"  href={href[:200]}")
                log(f"  target='{target}'")
                log(f"  onclick='{onclick[:200]}'")
                log(f"  outerHTML={link_html[:300]}")
            else:
                log("NO <a> TAG in name cell")
            
            # Count resources before click
            num_pages_before = len(ctx.pages)
            num_frames_before = len(page.frames)
            frame_urls_before = set()
            for f in page.frames:
                if f.url and f.url != "about:blank":
                    frame_urls_before.add(f.url)
            
            popup_pages.clear()
            
            log(f"BEFORE CLICK: {num_pages_before} pages, {num_frames_before} frames")
            
            # === CLICK THE CLIENT ===
            log("CLICKING CLIENT...")
            
            # Try with popup detection
            popup_detected = False
            try:
                async with ctx.expect_page(timeout=15000) as popup_info:
                    if await link.count() > 0:
                        # Click normally (not force) to let JS handlers work
                        try:
                            await link.first.click(timeout=5000)
                        except:
                            await link.first.click(force=True)
                    else:
                        await cells[1].click(force=True)
                
                popup = await popup_info.value
                popup_detected = True
                log(f"★★★ POPUP DETECTED! URL: {popup.url[:150]}")
                
                # Wait for popup to load
                try:
                    await popup.wait_for_load_state("networkidle", timeout=20000)
                except:
                    await asyncio.sleep(8)
                
                log(f"Popup URL after load: {popup.url[:150]}")
                await popup.screenshot(path=f"{OUTPUT_DIR}/diag_v3_popup.png")
                
                # Dump ALL frames in popup
                log(f"\n=== POPUP PAGE ANALYSIS ({len(popup.frames)} frames) ===")
                for fi, frame in enumerate(popup.frames):
                    url = frame.url or ""
                    if not url or url == "about:blank":
                        continue
                    fname = url.split('/')[-1].split('?')[0][:35]
                    try:
                        # Scroll to bottom first
                        await frame.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(1)
                        
                        text = await frame.locator("body").text_content(timeout=10000)
                        tc = " ".join(text.split()) if text else ""
                        
                        log(f"\n  PopupF{fi}({fname}): len={len(tc)}")
                        log(f"    First 200: {tc[:200]}")
                        log(f"    Last 300: {tc[-300:]}")
                        
                        # Save to file if long
                        if len(tc) > 300:
                            with open(f"{OUTPUT_DIR}/popup_frame_{fi}_{fname[:20]}.txt", "w") as fout:
                                fout.write(tc)
                            log(f"    Saved to popup_frame_{fi}_{fname[:20]}.txt")
                        
                        # Check for bank keywords
                        tl = tc.lower()
                        bank_kw = ["routing", "bank name", "account number", "direct deposit",
                                   "checking", "savings", "refund method", "aba"]
                        found_kw = [k for k in bank_kw if k in tl]
                        if found_kw:
                            log(f"    ★★★ BANK KEYWORDS FOUND: {found_kw} ★★★")
                            # Dump inputs
                            inputs = await frame.locator("input").all()
                            log(f"    {len(inputs)} inputs:")
                            for inp in inputs[:60]:
                                n = (await inp.get_attribute("name") or "")
                                iid = (await inp.get_attribute("id") or "")
                                v = (await inp.get_attribute("value") or "")
                                t = (await inp.get_attribute("type") or "text")
                                if v or any(k in (n+iid).lower() for k in ["bank","routing","account","rtn","aba","deposit","refund"]):
                                    log(f"      INPUT: name={n} id={iid} type={t} value='{v[:60]}'")
                            
                            # Dump selects
                            selects = await frame.locator("select").all()
                            if selects:
                                log(f"    {len(selects)} selects:")
                                for sel in selects[:20]:
                                    sn = (await sel.get_attribute("name") or "")
                                    try:
                                        val = await sel.evaluate("el => el.options[el.selectedIndex]?.text || ''")
                                        log(f"      SELECT: name={sn} selected='{val}'")
                                    except:
                                        pass
                    except Exception as e:
                        log(f"  PopupF{fi}({fname}): error {str(e)[:60]}")
                
                # Close popup after analysis
                await popup.close()
                log("Popup closed")
                
            except Exception as e:
                log(f"No popup: {str(e)[:100]}")
            
            # If no popup, check frame changes
            if not popup_detected:
                await asyncio.sleep(8)
                
                num_pages_after = len(ctx.pages)
                num_frames_after = len(page.frames)
                
                log(f"AFTER CLICK: {num_pages_after} pages, {num_frames_after} frames")
                
                # Check for new pages via event
                if popup_pages:
                    log(f"★ New pages captured via event: {len(popup_pages)}")
                    for np in popup_pages:
                        log(f"  New page URL: {np.url[:100]}")
                
                # Compare frames
                frame_urls_after = set()
                for f in page.frames:
                    if f.url and f.url != "about:blank":
                        frame_urls_after.add(f.url)
                
                new_urls = frame_urls_after - frame_urls_before
                removed_urls = frame_urls_before - frame_urls_after
                
                if new_urls:
                    log(f"NEW frame URLs after click:")
                    for u in new_urls:
                        log(f"  + {u[:100]}")
                if removed_urls:
                    log(f"REMOVED frame URLs after click:")
                    for u in removed_urls:
                        log(f"  - {u[:100]}")
                if not new_urls and not removed_urls:
                    log("NO FRAME CHANGES after click!")
                
                # Dump all frames after click
                await dump_frames(page, ctx, "FRAMES AFTER CLIENT CLICK")
                
                await page.screenshot(path=f"{OUTPUT_DIR}/diag_v3_after_click.png")
            
            log("\n=== DIAGNOSTIC V3 COMPLETE ===")
            
        except Exception as e:
            log(f"FATAL: {e}")
            import traceback
            traceback.print_exc()
            await page.screenshot(path=f"{OUTPUT_DIR}/diag_v3_error.png")
        finally:
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
