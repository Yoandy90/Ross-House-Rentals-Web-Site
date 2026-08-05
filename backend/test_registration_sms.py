#!/usr/bin/env python3
"""
Test Registration SMS
Simula el proceso de registro y verifica el SMS de bienvenida
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from notification_service import NotificationService
import os
from dotenv import load_dotenv

load_dotenv()

async def test_registration_sms():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['ross_tax_db']
    
    print("🔗 Conectado a la base de datos\n")
    
    # Load API config
    config_doc = await db.api_config.find_one({'_id': 'main'})
    
    if not config_doc:
        print("❌ No se encontró configuración de API")
        client.close()
        return
    
    print("✅ Configuración de API encontrada")
    
    # Check Twilio config
    if not config_doc.get('twilio_account_sid') or not config_doc.get('twilio_auth_token'):
        print("❌ Twilio NO está configurado en la base de datos")
        print(f"   Account SID: {config_doc.get('twilio_account_sid', 'N/A')}")
        print(f"   Auth Token: {config_doc.get('twilio_auth_token', 'N/A')}")
        print(f"   Phone: {config_doc.get('twilio_phone_number', 'N/A')}")
        client.close()
        return
    
    print("✅ Twilio configurado correctamente")
    print(f"   Phone Number: {config_doc.get('twilio_phone_number')}\n")
    
    # Initialize notification service
    notif_service = NotificationService(config_doc)
    
    if not notif_service.twilio_client:
        print("❌ Twilio client NO se inicializó correctamente")
        client.close()
        return
    
    print("✅ Twilio client inicializado\n")
    
    # Test data (usa tu número)
    test_phone = "+18069307456"
    test_name = "Usuario Prueba"
    
    welcome_message = f"""¡Bienvenido a Ross Tax Preparation, {test_name}! 🎉

Tu cuenta ha sido creada exitosamente. Ahora puedes:
📅 Agendar citas
💰 Gestionar pagos
📄 Subir documentos
🎁 Participar en sorteos

¡Gracias por confiar en nosotros!

Ross Tax Preparation
806-934-2018"""
    
    print("📱 ENVIANDO SMS DE BIENVENIDA DE PRUEBA")
    print(f"   Destinatario: {test_phone}")
    print(f"   Nombre: {test_name}\n")
    
    try:
        message = notif_service.twilio_client.messages.create(
            body=welcome_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"✅ SMS de bienvenida enviado exitosamente!")
        print(f"   SID: {message.sid}")
        print(f"   Status: {message.status}")
        print(f"\n🎉 ¡Revisa tu teléfono {test_phone}!")
        
    except Exception as e:
        print(f"❌ Error al enviar SMS: {e}")
        print(f"   Tipo de error: {type(e).__name__}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_registration_sms())
