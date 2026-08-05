"""
Send the platform summary PDF to the admin via SendGrid
"""
import os
import base64
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
from dotenv import load_dotenv

load_dotenv()

def send_pdf_email():
    sg = SendGridAPIClient(os.getenv("SENDGRID_API_KEY"))
    
    # Read PDF
    pdf_path = "/app/memory/RossTax_Platform_Summary.pdf"
    with open(pdf_path, "rb") as f:
        pdf_data = f.read()
    
    encoded_pdf = base64.b64encode(pdf_data).decode("utf-8")
    
    message = Mail(
        from_email="noreply@rosstaxpreparation.com",
        to_emails="yoandyross@gmail.com",
        subject="Mi Reembolso - Resumen Completo de la Plataforma (PDF)",
        html_content="""
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Mi Reembolso</h1>
                <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Ross Tax Preparation LLC</p>
            </div>
            
            <h2 style="color: #1e3a5f; margin-bottom: 16px;">Resumen Completo de la Plataforma</h2>
            
            <p style="color: #374151; line-height: 1.6;">
                Adjunto encontrarás el PDF con el resumen detallado de todas las funcionalidades 
                de tu plataforma Mi Reembolso, incluyendo:
            </p>
            
            <ul style="color: #374151; line-height: 1.8;">
                <li><strong>15 secciones</strong> detalladas</li>
                <li><strong>100+ funcionalidades</strong> catalogadas</li>
                <li>Estado de cada función: ACTIVO, PARCIAL, PENDIENTE, BLOQUEADO</li>
                <li>Dashboard, Clientes, Citas, Servicios, Impuestos, Payroll, Pagos, Comunicación, IA y más</li>
                <li>Integraciones activas y próximos pasos</li>
            </ul>
            
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="color: #16a34a; margin: 0 0 8px;">Estadísticas Clave</h3>
                <p style="margin: 4px 0; color: #374151;">📱 100+ páginas Admin Webapp</p>
                <p style="margin: 4px 0; color: #374151;">📲 120+ pantallas App Móvil</p>
                <p style="margin: 4px 0; color: #374151;">🔌 13 integraciones activas</p>
                <p style="margin: 4px 0; color: #374151;">🏛️ 4 servicios IRS aprobados</p>
                <p style="margin: 4px 0; color: #374151;">🌐 Bilingüe ES/EN</p>
            </div>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 24px; text-align: center;">
                Este es un documento confidencial generado automáticamente por el sistema Mi Reembolso.
            </p>
        </div>
        """
    )
    
    # Attach PDF
    attachment = Attachment()
    attachment.file_content = FileContent(encoded_pdf)
    attachment.file_name = FileName("MiReembolso_Platform_Summary.pdf")
    attachment.file_type = FileType("application/pdf")
    attachment.disposition = Disposition("attachment")
    message.attachment = attachment
    
    try:
        response = sg.send(message)
        print(f"Email sent! Status: {response.status_code}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

if __name__ == "__main__":
    send_pdf_email()
