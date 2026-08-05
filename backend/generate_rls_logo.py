#!/usr/bin/env python3
"""
Generate Logo and Icon for Ross Lending Solutions LLC
Uses OpenAI gpt-image-1 via Emergent Integrations
"""
import asyncio
import os
import base64
from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

API_KEY = os.getenv("EMERGENT_LLM_KEY")

async def generate_logo_and_icon():
    image_gen = OpenAIImageGeneration(api_key=API_KEY)
    
    # ─── LOGO (Full horizontal logo) ───
    print("🎨 Generating full logo...")
    logo_prompt = """Design a professional, modern, clean logo for a financial lending company called "ROSS LENDING SOLUTIONS LLC".

Style: Premium financial brand, clean modern minimalist design
Colors: Deep forest green (#0D4F3C) as primary, rich gold (#C8A951) as accent, on a white/transparent background
Elements: 
- The word "ROSS" should be large, bold, and prominent in dark green
- "LENDING SOLUTIONS" should be below in smaller elegant lettering
- Include a subtle geometric icon element: a stylized shield or upward arrow combined with a dollar sign, representing financial growth and security
- Clean sans-serif typography (similar to Montserrat or Gotham)
- Professional and trustworthy feel, suitable for a Texas-based lending company
- No gradients on text, flat clean design
- The icon should work separately as a standalone mark

Output: Logo on clean white background, high resolution, no mockups"""

    logo_images = await image_gen.generate_images(
        prompt=logo_prompt,
        model="gpt-image-1",
        number_of_images=1,
    )
    
    if logo_images and len(logo_images) > 0:
        with open("/app/memory/Ross_Lending_Solutions_Logo.png", "wb") as f:
            f.write(logo_images[0])
        print("✅ Logo saved: /app/memory/Ross_Lending_Solutions_Logo.png")
    else:
        print("❌ Failed to generate logo")
    
    # ─── ICON (Square app icon / favicon) ───
    print("🎨 Generating app icon...")
    icon_prompt = """Design a professional square app icon/favicon for a financial lending company called "Ross Lending Solutions".

Style: Modern, clean, minimal square icon suitable for app icon and favicon
Colors: Deep forest green (#0D4F3C) background with rich gold (#C8A951) accent
Elements:
- A stylized monogram "RLS" or just "R" in gold on green background
- OR a geometric shield/arrow icon representing financial growth and security
- Clean and recognizable at small sizes (16px to 512px)
- Rounded corners suitable for iOS/Android app icon
- No text smaller than the main letter/symbol
- Professional financial brand aesthetic
- Simple enough to be recognizable as a tiny favicon

Output: Square icon on solid green background, high resolution, clean edges"""

    icon_images = await image_gen.generate_images(
        prompt=icon_prompt,
        model="gpt-image-1",
        number_of_images=1,
    )
    
    if icon_images and len(icon_images) > 0:
        with open("/app/memory/Ross_Lending_Solutions_Icon.png", "wb") as f:
            f.write(icon_images[0])
        print("✅ Icon saved: /app/memory/Ross_Lending_Solutions_Icon.png")
    else:
        print("❌ Failed to generate icon")

    # ─── SEND VIA EMAIL ───
    print("📧 Sending logos via email...")
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
    
    msg = Mail(
        from_email='info@rosstaxpreparation.com',
        to_emails='yoandyross@gmail.com',
        subject='🏦 Ross Lending Solutions — Logo & Icon / Logo e Ícono',
        html_content="""
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
            <div style="background:linear-gradient(135deg, #0D4F3C, #16755A);padding:35px;text-align:center;border-radius:12px 12px 0 0;border-bottom:4px solid #C8A951">
                <h1 style="color:white;margin:0;font-size:28px;letter-spacing:2px">ROSS</h1>
                <h2 style="color:#C8A951;margin:4px 0 0 0;font-size:13px;letter-spacing:4px">LENDING SOLUTIONS LLC</h2>
            </div>
            <div style="padding:30px;background:#F8FAF9;border:1px solid #E2E8F0">
                <h3 style="color:#0D4F3C;margin-top:0">Logo & Icon / Logo e Ícono</h3>
                <p style="color:#4a5568;font-size:14px;line-height:1.6">
                    Hi Yoandy, here are the generated logo and icon for <b>Ross Lending Solutions LLC</b>:
                </p>
                <div style="background:white;padding:16px;border-radius:10px;margin:16px 0;border-left:5px solid #C8A951">
                    <p style="margin:0;font-size:13px;color:#0D4F3C;font-weight:bold">📎 Attachments:</p>
                    <p style="margin:8px 0 0 0;font-size:13px;color:#4a5568">
                        🎨 Ross_Lending_Solutions_Logo.png — Full horizontal logo<br/>
                        📱 Ross_Lending_Solutions_Icon.png — Square icon (app/favicon)
                    </p>
                </div>
                <p style="color:#718096;font-size:12px">
                    These are AI-generated designs. You can use them as-is or as a base for a professional graphic designer to refine.
                </p>
            </div>
            <div style="background:#0D4F3C;padding:12px;text-align:center;border-radius:0 0 12px 12px">
                <p style="color:#C8A951;font-size:11px;margin:0;font-style:italic">"Your Financial Partner in Every Step"</p>
            </div>
        </div>""")

    files_to_attach = [
        "/app/memory/Ross_Lending_Solutions_Logo.png",
        "/app/memory/Ross_Lending_Solutions_Icon.png",
    ]
    
    for fp in files_to_attach:
        if os.path.exists(fp):
            with open(fp, 'rb') as f:
                data = f.read()
            a = Attachment()
            a.file_content = FileContent(base64.b64encode(data).decode('utf-8'))
            a.file_name = FileName(os.path.basename(fp))
            a.file_type = FileType('image/png')
            a.disposition = Disposition('attachment')
            msg.add_attachment(a)

    sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
    r = sg.send(msg)
    print(f"📧 Email sent — Status: {r.status_code}")
    print("✅ Done!")


if __name__ == "__main__":
    asyncio.run(generate_logo_and_icon())
