#!/usr/bin/env python3
"""
Script para generar y guardar el HTML del email para inspección
"""
import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

sys.path.insert(0, '/app/backend')
load_dotenv('/app/backend/.env')

from notification_service_v2 import notification_service_v2

# Generar el header
header = notification_service_v2._get_email_header("Tu Cita en Ross Tax", "Acción Requerida")

# Generar el footer
footer = notification_service_v2._get_email_footer()

# Generar el HTML completo del email de invitación
html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #2c3e50; margin: 0; padding: 0; background: #f0f2f5; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 20px rgba(0,0,0,0.1); }}
        .content {{ background: #ffffff; padding: 40px 30px; }}
        .greeting {{ font-size: 24px; font-weight: 600; color: #2c3e50; margin-bottom: 15px; }}
        .intro-text {{ font-size: 16px; color: #555; margin-bottom: 25px; line-height: 1.8; }}
        .appointment-card {{ background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); padding: 25px; border-radius: 15px; margin: 25px 0; border: 2px solid #8B1513; box-shadow: 0 4px 12px rgba(139,21,19,0.1); }}
        .action-section {{ background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center; }}
        .action-title {{ font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 15px; }}
        .checklist {{ text-align: left; display: inline-block; margin: 15px 0; }}
        .checklist-item {{ padding: 8px 0; font-size: 15px; color: #1a1a1a; font-weight: 500; }}
        .checklist-item::before {{ content: "✓"; color: #28a745; font-weight: bold; margin-right: 10px; font-size: 18px; }}
        .cta-button {{ display: inline-block; background: linear-gradient(135deg, #8B1513 0%, #A52A2A 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 16px; margin: 20px 0; box-shadow: 0 4px 15px rgba(139,21,19,0.3); }}
        .warning-box {{ background: linear-gradient(135deg, #fff3cd 0%, #fff8e1 100%); border-left: 4px solid #ffc107; padding: 18px 20px; border-radius: 10px; margin-top: 25px; }}
        .warning-text {{ color: #856404; font-size: 14px; margin: 0; font-weight: 500; }}
        .footer-note {{ color: #999; font-size: 13px; margin-top: 25px; text-align: center; font-style: italic; }}
    </style>
</head>
<body>
    <div class="container">
        {header}
        <div class="content">
            <div class="greeting">¡Hola Usuario de Prueba! 👋</div>
            <p class="intro-text">
                <strong>Ross Tax Admin</strong> ha reservado una cita para ti en Ross Tax Preparation. 
                Estamos listos para ayudarte con tus impuestos de manera profesional y eficiente.
            </p>
            
            <div class="appointment-card">
                <div style="font-weight: 700; color: #1a1a1a; font-size: 18px; margin-bottom: 15px; text-align: center; background: #8B1513; color: white; padding: 12px; border-radius: 10px; margin: -25px -25px 15px -25px;">
                    📋 Detalles de tu Cita
                </div>
                <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="font-size: 24px; margin-right: 15px; width: 30px;">📅</span>
                    <span style="font-weight: 700; color: #000000 !important; margin-right: 8px; font-size: 15px;">Fecha:</span>
                    <span style="color: #000000 !important; font-weight: 600 !important; font-size: 15px;">15 de noviembre de 2025</span>
                </div>
                <div style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #e9ecef;">
                    <span style="font-size: 24px; margin-right: 15px; width: 30px;">🕐</span>
                    <span style="font-weight: 700; color: #000000 !important; margin-right: 8px; font-size: 15px;">Hora:</span>
                    <span style="color: #000000 !important; font-weight: 600 !important; font-size: 15px;">10:00 AM</span>
                </div>
                <div style="display: flex; align-items: center; padding: 12px 0;">
                    <span style="font-size: 24px; margin-right: 15px; width: 30px;">💻</span>
                    <span style="font-weight: 700; color: #000000 !important; margin-right: 8px; font-size: 15px;">Modalidad:</span>
                    <span style="color: #000000 !important; font-weight: 600 !important; font-size: 15px;">Videollamada Virtual</span>
                </div>
            </div>
            
            <div class="action-section">
                <div class="action-title">🎯 Prepara tu Cita en 2 Pasos</div>
                <div class="checklist">
                    <div class="checklist-item">Completa tu información personal</div>
                    <div class="checklist-item">Sube tus documentos fiscales</div>
                </div>
                <a href="https://example.com/invitation/test123" class="cta-button">
                    🚀 Completar Ahora
                </a>
                <p style="font-size: 13px; color: #666; margin-top: 12px;">
                    Solo te tomará 5 minutos
                </p>
            </div>
            
            <div class="warning-box">
                <p class="warning-text">
                    <span style="font-size: 20px; margin-right: 8px;">⏰</span>
                    <strong>Importante:</strong> Este enlace es válido hasta el <strong>22 de noviembre de 2025</strong>
                </p>
            </div>
            
            <p class="footer-note">
                Si no solicitaste esta cita, puedes ignorar este mensaje de forma segura.
            </p>
        </div>
        {footer}
    </div>
</body>
</html>
"""

# Guardar el HTML en un archivo
output_path = '/app/backend/email_preview.html'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print("=" * 60)
print("HTML del Email Generado y Guardado")
print("=" * 60)
print(f"\n✅ Archivo guardado en: {output_path}")
print(f"\n📝 Puedes abrir este archivo en un navegador para ver el diseño")
print(f"\nTambién puedes ver el contenido con:")
print(f"   cat {output_path}")
print("\n" + "=" * 60)
