#!/usr/bin/env python3
"""
Script de prueba para enviar un email de prueba con el logo embebido
"""
import os
import sys
import asyncio
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Agregar el directorio backend al path
sys.path.insert(0, '/app/backend')

# Cargar variables de entorno
load_dotenv('/app/backend/.env')

from notification_service_v2 import notification_service_v2

async def test_invitation_email():
    """Prueba de envío de email de invitación"""
    print("=" * 60)
    print("TEST: Envío de Email de Invitación con Logo Embebido")
    print("=" * 60)
    
    # Datos de prueba
    test_email = os.getenv('TEST_EMAIL', 'yoandyross@gmail.com')
    
    print(f"\n📧 Enviando email de prueba a: {test_email}")
    print(f"   SendGrid configurado: {'✅' if notification_service_v2.sendgrid_client else '❌'}")
    
    if not notification_service_v2.sendgrid_client:
        print("\n⚠️  SendGrid no configurado - no se puede enviar email")
        print("   Configure SENDGRID_API_KEY en .env para probar")
        return
    
    # Datos de prueba
    result = await notification_service_v2.send_invitation_email(
        to_email=test_email,
        attendee_name="Usuario de Prueba",
        invited_by="Ross Tax Admin",
        appointment_date="15 de noviembre de 2025",
        appointment_time="10:00 AM",
        appointment_type="video_call",
        invitation_link="https://example.com/invitation/test123",
        expires_date="22 de noviembre de 2025"
    )
    
    print("\n" + "=" * 60)
    print("RESULTADO:")
    print("=" * 60)
    
    if result.get('success'):
        print(f"✅ Email enviado exitosamente!")
        print(f"   Status Code: {result.get('status_code')}")
        print(f"   Enviado a: {test_email}")
        print(f"\n📩 Por favor revisa tu bandeja de entrada para confirmar")
        print(f"   que el logo aparece correctamente en el email.")
    else:
        print(f"❌ Error enviando email:")
        print(f"   {result.get('error')}")
    
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_invitation_email())
