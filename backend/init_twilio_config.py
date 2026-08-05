#!/usr/bin/env python3
"""
Script para inicializar configuración de Twilio en la base de datos
"""
import asyncio
import sys
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
sys.path.insert(0, '/app/backend')

async def init_twilio():
    """Inicializa configuración de Twilio en MongoDB"""
    try:
        # Obtener credenciales de .env
        twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
        twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        if not all([twilio_sid, twilio_token, twilio_phone]):
            print("❌ Error: Faltan credenciales de Twilio en .env")
            print("   Necesitas: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER")
            return
        
        # Conectar a MongoDB
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url)
        db = client.get_database('ross_tax')
        
        print("=" * 60)
        print("🔧 INICIALIZANDO CONFIGURACIÓN DE TWILIO")
        print("=" * 60)
        
        # Verificar si ya existe configuración
        existing_config = await db.api_config.find_one({})
        
        if existing_config:
            # Actualizar configuración existente
            await db.api_config.update_one(
                {},
                {
                    '$set': {
                        'twilio_account_sid': twilio_sid,
                        'twilio_auth_token': twilio_token,
                        'twilio_phone_number': twilio_phone
                    }
                }
            )
            print("✅ Configuración de Twilio actualizada")
        else:
            # Crear nueva configuración
            await db.api_config.insert_one({
                'twilio_account_sid': twilio_sid,
                'twilio_auth_token': twilio_token,
                'twilio_phone_number': twilio_phone
            })
            print("✅ Configuración de Twilio creada")
        
        print(f"\n📱 Twilio configurado:")
        print(f"   Account SID: {twilio_sid[:10]}...")
        print(f"   Phone Number: {twilio_phone}")
        print("\n✅ SMS a Clientes ahora funcionará correctamente")
        print("=" * 60)
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(init_twilio())
