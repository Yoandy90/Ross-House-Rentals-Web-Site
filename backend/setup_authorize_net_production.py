#!/usr/bin/env python3
"""
Script para configurar las credenciales de PRODUCCIÓN de Authorize.net
Ejecuta esto una sola vez para guardar las credenciales en la base de datos
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

async def setup_production_credentials():
    """Guarda las credenciales de producción en la base de datos"""
    
    # Credenciales de PRODUCCIÓN proporcionadas por el usuario
    PRODUCTION_CREDENTIALS = {
        "api_login_id": "67TuhP8ar",
        "transaction_key": "5e6A3L7fNez42H7q",
        "signature_key": "4E07D73865B3DD40BC86FF8B781964C4CCFA0F95A873488CD3BCC547C4CE878A85024ED0EF342B38924F40E959EC4F4C237E66002134ECD54D630F862C2AAD39",
        "public_client_key": "3mH7JmE8L52rSa4tm2s8969G2NRqzYu2kxkc6s32VK6F4pr3FCsMagd87ms6j58m",
        "environment": "production"
    }
    
    print("🔧 Configurando credenciales de PRODUCCIÓN de Authorize.net...")
    print("⚠️  ADVERTENCIA: Estas son credenciales de PRODUCCIÓN - Procesará transacciones REALES")
    print()
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Verificar si ya existe una configuración de producción
        existing = await db.api_configurations.find_one({
            "service": "authorize_net",
            "credentials.environment": "production"
        })
        
        now = datetime.utcnow()
        
        if existing:
            print(f"✅ Configuración de producción ya existe (ID: {existing['_id']})")
            print("🔄 Actualizando credenciales...")
            
            await db.api_configurations.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "credentials": PRODUCTION_CREDENTIALS,
                        "updated_at": now,
                        "active": False  # NO activar por defecto para seguridad
                    }
                }
            )
            print("✅ Credenciales de producción actualizadas")
        else:
            print("📝 Creando nueva configuración de producción...")
            
            config = {
                "service": "authorize_net",
                "credentials": PRODUCTION_CREDENTIALS,
                "active": False,  # NO activar por defecto para seguridad
                "created_at": now,
                "updated_at": now
            }
            
            result = await db.api_configurations.insert_one(config)
            print(f"✅ Configuración de producción creada (ID: {result.inserted_id})")
        
        print()
        print("=" * 70)
        print("✅ CONFIGURACIÓN COMPLETADA")
        print("=" * 70)
        print()
        print("📋 Credenciales guardadas:")
        print(f"   - API Login ID: {PRODUCTION_CREDENTIALS['api_login_id'][:4]}***{PRODUCTION_CREDENTIALS['api_login_id'][-2:]}")
        print(f"   - Transaction Key: ****{PRODUCTION_CREDENTIALS['transaction_key'][-4:]}")
        print(f"   - Ambiente: {PRODUCTION_CREDENTIALS['environment'].upper()}")
        print()
        print("⚠️  Estado: INACTIVO (por seguridad)")
        print()
        print("📌 Para ACTIVAR estas credenciales:")
        print("   1. Ve al Admin Panel > API Configuration")
        print("   2. Selecciona 'Production' y haz clic en 'Activate'")
        print()
        print("🔒 IMPORTANTE:")
        print("   - Estas credenciales procesarán transacciones REALES")
        print("   - Se cobrarán tarifas reales de procesamiento")
        print("   - Se moverá dinero real de las cuentas bancarias")
        print("   - Úsalas solo cuando estés listo para producción")
        print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(setup_production_credentials())
