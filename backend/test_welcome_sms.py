#!/usr/bin/env python3
"""
Test Welcome SMS
Simula el envío de SMS de bienvenida al registrarse
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from notification_service import NotificationService
import os
from dotenv import load_dotenv

load_dotenv()

async def test_welcome_sms():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['ross_tax_db']
    
    print("🔗 Conectado a la base de datos\n")
    
    # Load API config
    config_doc = await db.api_config.find_one({'_id': 'main'})
    
    if not config_doc:
        print("❌ No se encontró configuración de API")
        return
    
    # Initialize notification service
    notif_service = NotificationService(config_doc)
    
    if not notif_service.twilio_client:
        print("❌ Twilio no está configurado")
        return
    
    print("✅ Twilio configurado correctamente\n")
    
    # Test data
    test_phone = "+18069307456"
    test_name = "Yoandy Ross"
    
    welcome_message = f"""¡Bienvenido a Ross Tax Preparation, {test_name}! 🎉

Tu cuenta ha sido creada exitosamente. Ahora puedes:
📅 Agendar citas
💰 Gestionar pagos
📄 Subir documentos
🎁 Participar en sorteos

¡Gracias por confiar en nosotros!

Ross Tax Preparation
806-934-2018"""
    
    print("📱 ENVIANDO SMS DE BIENVENIDA")
    print(f"   Destinatario: {test_phone}")
    print(f"   Nombre: {test_name}")
    print("\n" + "="*60)
    print("Mensaje:")
    print("="*60)
    print(welcome_message)
    print("="*60 + "\n")
    
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
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_welcome_sms())
