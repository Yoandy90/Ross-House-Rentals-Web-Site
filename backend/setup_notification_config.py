#!/usr/bin/env python3
"""
Setup Notification Configuration
Configura las credenciales de SendGrid y Twilio para notificaciones
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def setup_config():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['ross_tax_db']
    
    print("🔗 Conectado a la base de datos")
    print(f"📊 Base de datos: ross_tax_db\n")
    
    # Check if config exists
    existing_config = await db.api_config.find_one({'_id': 'main'})
    
    if existing_config:
        print("⚠️  Ya existe una configuración de API")
        print(f"   SendGrid configurado: {'✅' if existing_config.get('sendgrid_api_key') else '❌'}")
        print(f"   Twilio configurado: {'✅' if existing_config.get('twilio_account_sid') else '❌'}")
        print("\n¿Deseas actualizar? La configuración actual se actualizará.")
    
    # Get credentials from environment variables or use placeholders
    sendgrid_api_key = os.getenv('SENDGRID_API_KEY', '')
    twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
    twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
    twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER', '')
    
    # Create or update config
    config = {
        '_id': 'main',
        # SendGrid Configuration
        'sendgrid_api_key': sendgrid_api_key,
        'sendgrid_from_email': 'noreply@rosstaxpreparation.com',
        'sendgrid_from_name': 'Ross Tax Preparation',
        
        # Twilio Configuration
        'twilio_account_sid': twilio_account_sid,
        'twilio_auth_token': twilio_auth_token,
        'twilio_phone_number': twilio_phone_number,
        
        # Company Information
        'company_name': 'Ross Tax Preparation',
        'company_phone': '806-934-2018',
        'company_address': '305 Bruce Ave, Dumas, TX 79029',
        'company_email': 'info@rosstaxpreparation.com',
    }
    
    # Upsert (update or insert)
    await db.api_config.update_one(
        {'_id': 'main'},
        {'$set': config},
        upsert=True
    )
    
    print("\n✅ Configuración de API creada/actualizada:")
    print(f"\n📧 SendGrid:")
    print(f"   API Key: {'✅ Configurado' if sendgrid_api_key else '❌ NO configurado (agrega SENDGRID_API_KEY al .env)'}")
    print(f"   From Email: {config['sendgrid_from_email']}")
    print(f"   From Name: {config['sendgrid_from_name']}")
    
    print(f"\n📱 Twilio:")
    print(f"   Account SID: {'✅ Configurado' if twilio_account_sid else '❌ NO configurado (agrega TWILIO_ACCOUNT_SID al .env)'}")
    print(f"   Auth Token: {'✅ Configurado' if twilio_auth_token else '❌ NO configurado (agrega TWILIO_AUTH_TOKEN al .env)'}")
    print(f"   Phone Number: {twilio_phone_number if twilio_phone_number else '❌ NO configurado (agrega TWILIO_PHONE_NUMBER al .env)'}")
    
    print(f"\n🏢 Información de la Empresa:")
    print(f"   Nombre: {config['company_name']}")
    print(f"   Teléfono: {config['company_phone']}")
    print(f"   Dirección: {config['company_address']}")
    print(f"   Email: {config['company_email']}")
    
    if not sendgrid_api_key:
        print("\n⚠️  IMPORTANTE: Para habilitar notificaciones por email:")
        print("   1. Ve a https://sendgrid.com")
        print("   2. Crea una cuenta o inicia sesión")
        print("   3. Crea un API Key en Settings → API Keys")
        print("   4. Agrega al .env: SENDGRID_API_KEY=tu_api_key_aqui")
        print("   5. Ejecuta este script de nuevo")
    
    if not twilio_account_sid or not twilio_auth_token:
        print("\n⚠️  IMPORTANTE: Para habilitar notificaciones por SMS:")
        print("   1. Ve a https://twilio.com")
        print("   2. Crea una cuenta o inicia sesión")
        print("   3. Obtén tu Account SID y Auth Token del Dashboard")
        print("   4. Obtén o compra un número de teléfono de Twilio")
        print("   5. Agrega al .env:")
        print("      TWILIO_ACCOUNT_SID=tu_account_sid")
        print("      TWILIO_AUTH_TOKEN=tu_auth_token")
        print("      TWILIO_PHONE_NUMBER=+1234567890")
        print("   6. Ejecuta este script de nuevo")
    
    print("\n✅ Configuración completada")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_config())
