#!/usr/bin/env python3
"""
Test Appointment Notifications
Prueba el envío de email y SMS para confirmación de citas
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from notification_service import NotificationService
from datetime import datetime, timezone, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

async def test_notifications():
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['ross_tax_db']
    
    print("🔗 Conectado a la base de datos")
    print(f"📊 Base de datos: ross_tax_db\n")
    
    # Load API config
    config_doc = await db.api_config.find_one({'_id': 'main'})
    
    if not config_doc:
        print("❌ No se encontró configuración de API")
        return
    
    print("✅ Configuración de API encontrada\n")
    
    # Check SendGrid config
    if config_doc.get('sendgrid_api_key'):
        print(f"✅ SendGrid API Key configurado")
        print(f"   From Email: {config_doc.get('sendgrid_from_email', 'N/A')}")
        print(f"   From Name: {config_doc.get('sendgrid_from_name', 'N/A')}")
    else:
        print("❌ SendGrid API Key NO configurado")
    
    # Check Twilio config
    if config_doc.get('twilio_account_sid') and config_doc.get('twilio_auth_token'):
        print(f"✅ Twilio configurado")
        print(f"   Account SID: {config_doc.get('twilio_account_sid', 'N/A')[:10]}...")
        print(f"   Phone Number: {config_doc.get('twilio_phone_number', 'N/A')}")
    else:
        print("❌ Twilio NO configurado")
    
    print("\n" + "="*60)
    print("🧪 PROBANDO NOTIFICACIONES")
    print("="*60 + "\n")
    
    # Initialize notification service
    notification_service = NotificationService(config_doc)
    
    # Test data
    test_email = "yoandyross@gmail.com"
    test_phone = "+18069307456"  # Adding +1 for US country code
    test_name = "Yoandy Ross"
    test_date = datetime.now(timezone.utc) + timedelta(hours=24)
    
    # Test Email
    print("📧 PRUEBA 1: Envío de Email")
    print(f"   Destinatario: {test_email}")
    print(f"   Fecha de cita: {test_date.strftime('%Y-%m-%d %H:%M')}")
    
    try:
        email_result = await notification_service.send_appointment_confirmation_email(
            to_email=test_email,
            user_name=test_name,
            appointment_date=test_date,
            appointment_type="Consulta Fiscal",
            description="Revisión de documentos para declaración de impuestos"
        )
        
        if email_result:
            print("   ✅ Email enviado exitosamente")
        else:
            print("   ❌ No se pudo enviar el email")
    except Exception as e:
        print(f"   ❌ Error al enviar email: {e}")
    
    print()
    
    # Test SMS
    print("📱 PRUEBA 2: Envío de SMS")
    print(f"   Destinatario: {test_phone}")
    print(f"   Fecha de cita: {test_date.strftime('%Y-%m-%d %H:%M')}")
    
    try:
        sms_result = await notification_service.send_appointment_confirmation_sms(
            to_phone=test_phone,
            user_name=test_name,
            appointment_date=test_date,
            appointment_type="Consulta Fiscal"
        )
        
        if sms_result:
            print("   ✅ SMS enviado exitosamente")
        else:
            print("   ❌ No se pudo enviar el SMS")
    except Exception as e:
        print(f"   ❌ Error al enviar SMS: {e}")
    
    print("\n" + "="*60)
    print("✅ PRUEBAS COMPLETADAS")
    print("="*60)
    print("\nRevisa:")
    print(f"1. Email: {test_email}")
    print(f"2. SMS: {test_phone}")
    print("\nSi no recibes las notificaciones, verifica:")
    print("- Las credenciales de SendGrid están correctas")
    print("- Las credenciales de Twilio están correctas")
    print("- El número de teléfono de Twilio está verificado")
    print("- El email de SendGrid no está en spam")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_notifications())
