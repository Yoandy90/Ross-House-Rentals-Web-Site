"""
Send Audit Report PDF via Email
"""
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from dotenv import load_dotenv

load_dotenv()

def send_audit_email():
    smtp_host = os.getenv("EMAIL_SMTP_HOST", "gtxm1016.siteground.biz")
    smtp_port = int(os.getenv("EMAIL_SMTP_PORT", "465"))
    email_address = os.getenv("EMAIL_ADDRESS", "info@rosstaxpreparation.com")
    email_password = os.getenv("EMAIL_PASSWORD", "")
    to_email = "yoandyross@gmail.com"

    msg = MIMEMultipart()
    msg["From"] = email_address
    msg["To"] = to_email
    msg["Subject"] = "🏛️ Auditoría Completa — Ross Lending Solutions LLC"

    body = """
    <html>
    <body style="font-family: Arial, sans-serif; color: #334155;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0F172A, #1E293B); padding: 30px; border-radius: 16px; text-align: center;">
                <h1 style="color: #10B981; margin: 0; font-size: 24px;">🏛️ Auditoría Completa</h1>
                <p style="color: #94A3B8; margin-top: 8px;">Ross Lending Solutions LLC</p>
            </div>

            <div style="padding: 24px 0;">
                <h2 style="color: #0F172A; font-size: 18px;">Hola Yoandy,</h2>
                <p>Adjunto encontrarás el reporte de auditoría completa de la plataforma Ross Lending Solutions.</p>

                <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 12px; padding: 16px; margin: 16px 0;">
                    <h3 style="color: #059669; margin: 0 0 8px;">✅ Resumen Ejecutivo</h3>
                    <ul style="color: #334155; padding-left: 20px; margin: 0;">
                        <li><strong>Backend:</strong> 25/25 endpoints funcionando (100%)</li>
                        <li><strong>Admin Panel:</strong> 15 módulos operativos</li>
                        <li><strong>App iOS:</strong> 28 pantallas en TestFlight</li>
                        <li><strong>Integraciones:</strong> 8 en producción, 3 sandbox, 3 pendientes</li>
                    </ul>
                </div>

                <div style="background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 12px; padding: 16px; margin: 16px 0;">
                    <h3 style="color: #D97706; margin: 0 0 8px;">🆕 Nuevos Módulos Implementados</h3>
                    <ul style="color: #334155; padding-left: 20px; margin: 0;">
                        <li><strong>Credit Check:</strong> Soft/Hard Pull con reporte FICO, tradelines, DTI</li>
                        <li><strong>Collections:</strong> Dashboard de aging, acciones de cobro, planes de pago</li>
                        <li><strong>Metro 2 Data Furnishing:</strong> Exportación CSV para bureaus de crédito</li>
                    </ul>
                </div>

                <p>El PDF incluye detalle completo de cada endpoint, integración, problema detectado y mejora recomendada.</p>
            </div>

            <div style="text-align: center; padding: 16px; background: #F8FAFC; border-radius: 12px; color: #64748B; font-size: 12px;">
                <p>Ross Lending Solutions LLC — Texas OCCC Regulated Lender</p>
                <p>Reporte generado automáticamente</p>
            </div>
        </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(body, "html"))

    # Attach PDF
    pdf_path = "/app/backend/audit_report_rls.pdf"
    with open(pdf_path, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename=Auditoria_RossLending_{__import__('datetime').datetime.now().strftime('%Y%m%d')}.pdf")
        msg.attach(part)

    # Send
    try:
        server = smtplib.SMTP_SSL(smtp_host, smtp_port)
        server.login(email_address, email_password)
        server.sendmail(email_address, to_email, msg.as_string())
        server.quit()
        print(f"✅ Email enviado a {to_email}")
    except Exception as e:
        print(f"❌ Error enviando email: {e}")
        # Try SendGrid as fallback
        try:
            import sendgrid
            from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
            import base64

            sg_key = os.getenv("SENDGRID_API_KEY")
            if sg_key:
                sg = sendgrid.SendGridAPIClient(api_key=sg_key)
                message = Mail(
                    from_email=os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com"),
                    to_emails=to_email,
                    subject="🏛️ Auditoría Completa — Ross Lending Solutions LLC",
                    html_content=body,
                )
                with open(pdf_path, "rb") as f:
                    file_data = f.read()
                    encoded = base64.b64encode(file_data).decode()
                attachment = Attachment(
                    FileContent(encoded),
                    FileName(f"Auditoria_RossLending_{__import__('datetime').datetime.now().strftime('%Y%m%d')}.pdf"),
                    FileType("application/pdf"),
                    Disposition("attachment"),
                )
                message.attachment = attachment
                response = sg.send(message)
                print(f"✅ Email enviado via SendGrid (status: {response.status_code})")
            else:
                print("❌ No SendGrid API key available")
        except Exception as e2:
            print(f"❌ SendGrid fallback also failed: {e2}")


if __name__ == "__main__":
    send_audit_email()
