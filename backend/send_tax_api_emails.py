#!/usr/bin/env python3
"""
Send follow-up emails to Column Tax and April Tax
Requesting API partnership for Ross Tax Preparation
"""

import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
FROM_EMAIL = "info@rosstaxpreparation.com"
YOANDY_EMAIL = "yoandyross@gmail.com"

sg = SendGridAPIClient(SENDGRID_API_KEY)

# ============================================================
# EMAIL 1: Column Tax
# ============================================================
column_tax_html = """
<html><body style="font-family: Arial, sans-serif; padding: 20px; max-width: 700px;">

<p>Dear Column Tax Partnership Team,</p>

<p>My name is Yoandy Ross, founder and CEO of <strong>Ross Tax Preparation LLC</strong> (Texas SOS File Number: 805654732), a tax preparation firm based in Dumas, Texas. We serve over <strong>900 clients annually</strong> and are actively expanding our digital platform.</p>

<h3>Why We're Reaching Out</h3>
<p>We have built a custom tax preparation platform (iOS mobile app + Next.js web application) that includes:</p>
<ul>
    <li>A <strong>Tax Wizard</strong> — guided interview that collects all client tax data (W-2, 1099, dependents, deductions, etc.)</li>
    <li>An <strong>AI-powered PDF Extractor</strong> — automatically reads and extracts data from uploaded W-2s, 1099s, and other tax documents</li>
    <li>A <strong>Client Portal</strong> — where clients can track their return status, upload documents, and communicate with our office</li>
</ul>

<p><strong>What we're missing is the tax calculation engine and IRS e-file transmission.</strong> That's where Column Tax comes in.</p>

<h3>What We Need</h3>
<ul>
    <li>API access to embed <strong>1040 tax calculation and e-filing</strong> into our existing platform</li>
    <li>Support for <strong>federal and Texas state returns</strong></li>
    <li>Ability to <strong>pass structured client data via API</strong> and receive calculated returns + IRS acknowledgments</li>
    <li>White-label or embedded solution that integrates with our React Native (Expo) mobile app and Next.js web app</li>
</ul>

<h3>Our Platform Details</h3>
<ul>
    <li><strong>Tech Stack:</strong> React Native (Expo/iOS), Next.js, FastAPI, MongoDB</li>
    <li><strong>Active Clients:</strong> 900+ (2024-2025 tax season)</li>
    <li><strong>EFIN:</strong> Active Electronic Filing Identification Number</li>
    <li><strong>Timeline:</strong> We need this integration ready for the <strong>January 2027 tax season</strong></li>
</ul>

<h3>About Our Firm</h3>
<ul>
    <li><strong>Company:</strong> Ross Tax Preparation LLC</li>
    <li><strong>Location:</strong> 305 Bruce Ave, Dumas, TX 79029</li>
    <li><strong>Website:</strong> rosstaxpreparation.com</li>
    <li><strong>Years in operation:</strong> 5+ years serving the Dumas/Amarillo, TX community</li>
</ul>

<p>We are very serious about this partnership and ready to move forward immediately. We have the development team and infrastructure in place — we just need the tax engine.</p>

<p>Could we schedule a call this week to discuss partnership options, API access, and pricing?</p>

<p>Thank you for your time. I look forward to hearing from you.</p>

<p>Best regards,<br>
<strong>Yoandy Ross Rodriguez</strong><br>
Founder & CEO, Ross Tax Preparation LLC<br>
305 Bruce Ave, Dumas, TX 79029<br>
📞 806-930-7456<br>
📧 yoandyross@gmail.com<br>
🌐 rosstaxpreparation.com</p>

</body></html>
"""

# ============================================================
# EMAIL 2: April Tax
# ============================================================
april_tax_html = """
<html><body style="font-family: Arial, sans-serif; padding: 20px; max-width: 700px;">

<p>Dear April Tax Partnership Team,</p>

<p>My name is Yoandy Ross, founder and CEO of <strong>Ross Tax Preparation LLC</strong> (Texas SOS File Number: 805654732), a tax preparation firm based in Dumas, Texas serving over <strong>900 clients annually</strong>.</p>

<h3>Why April is the Perfect Fit</h3>
<p>We've been following April's embedded tax platform closely, and it's exactly what we need. Your API-first architecture, adaptive SDK, and support for React Native / iOS are a perfect match for our existing platform.</p>

<h3>Our Existing Platform</h3>
<p>We have already built:</p>
<ul>
    <li>📱 <strong>iOS Mobile App</strong> (React Native / Expo) — with a guided Tax Wizard for data collection</li>
    <li>🌐 <strong>Web Portal</strong> (Next.js) — client dashboard, admin panel, document management</li>
    <li>🤖 <strong>AI PDF Extractor</strong> — automatically reads W-2s, 1099s, and other tax documents using OCR + GPT-4</li>
    <li>💾 <strong>Database</strong> — 900+ client records with demographic, banking, and tax data</li>
</ul>

<p><strong>The only piece we're missing is the tax calculation and IRS e-file transmission.</strong> We want to embed April's tax engine directly into our app so clients can file their returns seamlessly.</p>

<h3>What We Need from April</h3>
<ul>
    <li>✅ <strong>Embedded tax filing SDK/API</strong> for our React Native iOS app</li>
    <li>✅ <strong>1040 calculation engine</strong> — we pass client data, you calculate the return</li>
    <li>✅ <strong>IRS e-file transmission</strong> — direct submission and acknowledgment tracking</li>
    <li>✅ <strong>Federal + Texas state returns</strong></li>
    <li>✅ <strong>White-label</strong> — branded as Ross Tax, not April</li>
</ul>

<h3>Business Details</h3>
<table style="border-collapse: collapse; width: 100%;">
    <tr><td style="padding: 5px; font-weight: bold;">Company:</td><td style="padding: 5px;">Ross Tax Preparation LLC</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Location:</td><td style="padding: 5px;">305 Bruce Ave, Dumas, TX 79029</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Active Clients:</td><td style="padding: 5px;">900+ per tax season</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">EFIN:</td><td style="padding: 5px;">Active</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Tech Stack:</td><td style="padding: 5px;">React Native (Expo), Next.js, FastAPI, MongoDB</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Website:</td><td style="padding: 5px;">rosstaxpreparation.com</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Timeline:</td><td style="padding: 5px;">Integration needed for January 2027 tax season</td></tr>
</table>

<p>We previously reached out but haven't received a response. We are a serious partner with an existing platform, active client base, and development resources ready to integrate immediately.</p>

<p><strong>Can we schedule a 15-minute call this week?</strong> I'm available any time that works for your team.</p>

<p>Thank you,</p>

<p><strong>Yoandy Ross Rodriguez</strong><br>
Founder & CEO, Ross Tax Preparation LLC<br>
305 Bruce Ave, Dumas, TX 79029<br>
📞 806-930-7456<br>
📧 yoandyross@gmail.com<br>
🌐 rosstaxpreparation.com</p>

</body></html>
"""

# ============================================================
# SEND ALL EMAILS
# ============================================================

emails_to_send = [
    # Column Tax - to CEO directly + contact form email
    {
        "to": "gavin@columntax.com",
        "subject": "API Partnership Request — Ross Tax Preparation (900+ Clients, Custom Platform Ready)",
        "html": column_tax_html,
        "desc": "Column Tax - CEO Gavin Nachbar"
    },
    # April Tax - support + general
    {
        "to": "support@getapril.com",
        "subject": "Embedded Tax API Partnership — Ross Tax Preparation (900+ Clients, React Native Platform Ready)",
        "html": april_tax_html,
        "desc": "April Tax - Support/General"
    },
    # April Tax - press/partnerships
    {
        "to": "april@avenuez.com",
        "subject": "Partnership Inquiry — Ross Tax Preparation (900+ Clients, Embedded Tax Filing Integration)",
        "html": april_tax_html,
        "desc": "April Tax - PR/Partnerships (AvenueZ)"
    },
    # Copy to Yoandy
    {
        "to": YOANDY_EMAIL,
        "subject": "📧 Copia: Emails enviados a Column Tax y April Tax (Solicitud de API Partnership)",
        "html": f"""
        <html><body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>📧 Emails Enviados — Solicitud de API Partnership</h2>
        <p>Se enviaron los siguientes emails:</p>
        <ol>
            <li><strong>Column Tax</strong> → gavin@columntax.com (CEO Gavin Nachbar)</li>
            <li><strong>April Tax</strong> → support@getapril.com</li>
            <li><strong>April Tax</strong> → april@avenuez.com (PR/Partnerships)</li>
        </ol>
        <p>También puedes enviar directamente desde el formulario web:</p>
        <ul>
            <li><strong>Column Tax:</strong> <a href="https://www.columntax.com/contact-us">columntax.com/contact-us</a></li>
            <li><strong>April Tax:</strong> <a href="https://www.getapril.com/contact">getapril.com/contact</a></li>
        </ul>
        <hr>
        <h3>Email enviado a Column Tax:</h3>
        {column_tax_html}
        <hr>
        <h3>Email enviado a April Tax:</h3>
        {april_tax_html}
        </body></html>
        """,
        "desc": "Copy to Yoandy"
    },
]

results = []
for email_info in emails_to_send:
    try:
        message = Mail(
            from_email=Email(FROM_EMAIL, "Ross Tax Preparation"),
            to_emails=To(email_info["to"]),
            subject=email_info["subject"],
            html_content=email_info["html"]
        )
        response = sg.send(message)
        status = f"✅ {email_info['desc']} → {email_info['to']} (Status: {response.status_code})"
        results.append(status)
        print(status)
    except Exception as e:
        status = f"❌ {email_info['desc']} → {email_info['to']} (Error: {str(e)})"
        results.append(status)
        print(status)

print("\n" + "="*60)
print("RESUMEN DE ENVÍO:")
for r in results:
    print(f"  {r}")
print("="*60)
