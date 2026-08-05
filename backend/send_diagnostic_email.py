"""Send diagnostic report email"""
import asyncio
import os
import sys
import base64
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

import sendgrid
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

def send_report():
    sg = sendgrid.SendGridAPIClient(api_key=os.getenv('SENDGRID_API_KEY'))
    from_email = os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com')
    
    # Read PDF
    pdf_path = '/app/backend/static/ross_tax_diagnostic_report.pdf'
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()
    
    encoded_pdf = base64.b64encode(pdf_data).decode()
    
    message = Mail(
        from_email=from_email,
        to_emails='yoandyross@gmail.com',
        subject='📊 Diagnóstico Completo — Ross Tax Platform (App + Webapp)',
        html_content="""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#059669,#10b981);padding:30px;text-align:center;border-radius:16px 16px 0 0">
                <h1 style="color:white;margin:0;font-size:24px">📊 Diagnóstico Completo</h1>
                <p style="color:rgba(255,255,255,0.9);margin:8px 0 0">Ross Tax Platform — App + Webapp</p>
            </div>
            <div style="padding:30px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
                <p>Hola Yoandy,</p>
                <p>Adjunto encontrarás el <b>diagnóstico completo</b> de toda la plataforma Ross Tax, incluyendo:</p>
                <ul style="line-height:2">
                    <li>📋 Arquitectura general e integraciones</li>
                    <li>🔐 Autenticación y usuarios</li>
                    <li>💰 Módulo de impuestos + Tax Wizard (17 pasos)</li>
                    <li>📅 Citas y calendario</li>
                    <li>📊 Bookkeeping completo (7 reportes + AR/AP + Alertas)</li>
                    <li>💳 Pagos (NMI, Stripe, ACH)</li>
                    <li>💬 Chat, WhatsApp, Notificaciones</li>
                    <li>📱 120+ pantallas de app móvil</li>
                    <li>🌐 110+ páginas admin webapp</li>
                    <li>✅ Estado de cada flujo y función</li>
                    <li>❌ Lo que falta vs lo que funciona</li>
                    <li>🚀 Recomendaciones de optimización</li>
                </ul>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0">
                    <p style="margin:0;font-size:14px;color:#166534"><b>Score General: 92% Completo</b></p>
                    <p style="margin:4px 0 0;font-size:13px;color:#166534">883+ endpoints · 110+ páginas admin · 120+ pantallas móvil · 10 integraciones activas</p>
                </div>
                <p style="color:#6b7280;font-size:13px">— Equipo de Desarrollo Ross Tax</p>
            </div>
        </div>
        """
    )
    
    attachment = Attachment()
    attachment.file_content = FileContent(encoded_pdf)
    attachment.file_name = FileName('Ross_Tax_Diagnostico_Completo.pdf')
    attachment.file_type = FileType('application/pdf')
    attachment.disposition = Disposition('attachment')
    message.attachment = attachment
    
    response = sg.send(message)
    print(f"Email sent! Status: {response.status_code}")

send_report()
