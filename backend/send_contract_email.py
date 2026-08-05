"""Script to generate a sample loan contract and email it."""
import asyncio
import os
import sys
import base64
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

# Load env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    from bson import ObjectId
    from loan_pdf_service import generate_loan_contract_pdf
    from loan_shared_service import build_pdf_loan_data, generate_schedule_for_loan

    client = AsyncIOMotorClient(os.getenv('MONGO_URL', 'mongodb://localhost:27017'))
    db = client['taxportal']

    # Get SMTP config - try unified_config first, fallback to .env
    configs = {}
    keys = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password',
            'smtp_encryption', 'email_from_address', 'email_from_name']
    for key in keys:
        doc = await db['unified_config'].find_one({"key": key})
        if doc:
            configs[key] = doc['value']

    smtp_host = configs.get('smtp_host') or os.getenv('EMAIL_SMTP_HOST')
    smtp_port = int(configs.get('smtp_port') or os.getenv('EMAIL_SMTP_PORT', '465'))
    smtp_user = configs.get('smtp_username') or os.getenv('EMAIL_ADDRESS')
    smtp_pass = configs.get('smtp_password') or os.getenv('EMAIL_PASSWORD')
    smtp_enc = configs.get('smtp_encryption', 'SSL')
    from_name = configs.get('email_from_name', 'Ross Lending Solutions')
    from_addr = configs.get('email_from_address') or os.getenv('EMAIL_ADDRESS') or smtp_user

    print(f"SMTP: {smtp_host}:{smtp_port} ({smtp_enc})")
    print(f"From: {from_name} <{from_addr}>")
    print(f"User: {smtp_user}")
    print(f"Pass set: {bool(smtp_pass)}")

    if not smtp_host or not smtp_user or not smtp_pass:
        print("ERROR: SMTP not configured!")
        client.close()
        return

    # Get loan from DB
    loan = await db['regulated_loans'].find_one({"_id": ObjectId("6a09796b00153c9dda42bc75")})
    if not loan:
        print("Loan not found, using sample data")
        client.close()
        return

    print(f"\nLoan: {loan.get('loan_number')} - {loan.get('client_name')}")
    print(f"Amount: ${loan.get('amount')}")

    # Generate bilingual PDFs
    pdf_loan = build_pdf_loan_data(loan)
    schedule = generate_schedule_for_loan(loan)

    pdf_es_b64 = generate_loan_contract_pdf(pdf_loan, schedule, lang='es')
    pdf_en_b64 = generate_loan_contract_pdf(pdf_loan, schedule, lang='en')

    pdf_es_bytes = base64.b64decode(pdf_es_b64)
    pdf_en_bytes = base64.b64decode(pdf_en_b64)

    print(f"ES PDF: {len(pdf_es_bytes)} bytes")
    print(f"EN PDF: {len(pdf_en_bytes)} bytes")

    # Build email
    to_email = "yoandyross@gmail.com"
    loan_number = loan.get('loan_number', 'SAMPLE')

    msg = MIMEMultipart()
    msg['From'] = f"{from_name} <{from_addr}>"
    msg['To'] = to_email
    msg['Subject'] = f"Contrato de Préstamo {loan_number} — Ross Lending Solutions"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a5632, #2d8a56); padding: 25px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Ross Lending Solutions LLC</h1>
            <p style="color: #bbf7d0; margin: 8px 0 0; font-size: 13px;">Contrato de Préstamo Regulado — OCCC Texas</p>
        </div>
        <div style="padding: 25px; background: #ffffff; border: 1px solid #e2e8f0;">
            <p style="color: #334155; font-size: 15px;">Adjunto encontrará los contratos del préstamo <strong>{loan_number}</strong> en ambos idiomas:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f1f5f9;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Prestatario</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155;">{loan.get('client_name', 'N/A')}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Monto del Préstamo</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155;">${loan.get('amount', 0):,.2f}</td>
                </tr>
                <tr style="background: #f1f5f9;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Pago Semanal</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155;">${loan.get('weekly_payment', 0):,.2f}</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Plazo</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; color: #334155;">{loan.get('term_months', 0)} meses</td>
                </tr>
                <tr style="background: #f1f5f9;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Estado</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; color: #16a34a; font-weight: bold;">✓ {loan.get('status', 'N/A').upper()}</td>
                </tr>
            </table>

            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; border-radius: 4px; margin: 15px 0;">
                <p style="color: #166534; margin: 0; font-size: 13px;">
                    <strong>📎 Archivos adjuntos:</strong><br>
                    1. Contrato en Español (PDF)<br>
                    2. Contrato en Inglés (PDF)<br><br>
                    <em>Ambos contratos incluyen: cuadro TILA, tabla de amortización semanal, 
                    divulgación MLA, autorización de pagos ACH/automáticos, y términos legales completos.</em>
                </p>
            </div>
        </div>
        <div style="padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                Ross Lending Solutions LLC · 305 Bruce Ave, Dumas TX 79029 · (806) 934-2018<br>
                Este es un documento confidencial. No lo comparta con terceros no autorizados.
            </p>
        </div>
    </div>
    """
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    # Attach ES PDF
    part_es = MIMEBase('application', 'pdf')
    part_es.set_payload(pdf_es_bytes)
    encoders.encode_base64(part_es)
    part_es.add_header('Content-Disposition', f'attachment; filename="Contrato_{loan_number}_ES.pdf"')
    msg.attach(part_es)

    # Attach EN PDF
    part_en = MIMEBase('application', 'pdf')
    part_en.set_payload(pdf_en_bytes)
    encoders.encode_base64(part_en)
    part_en.add_header('Content-Disposition', f'attachment; filename="Contract_{loan_number}_EN.pdf"')
    msg.attach(part_en)

    # Send
    print(f"\nSending to {to_email}...")
    try:
        if smtp_enc.upper() == 'SSL':
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
            server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)
        server.quit()
        print(f"✅ Email enviado exitosamente a {to_email}")
    except Exception as e:
        print(f"❌ Error enviando email: {e}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
