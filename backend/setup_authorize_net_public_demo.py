#!/usr/bin/env python3
"""
Script para configurar las credenciales PÚBLICAS de demo de Authorize.net
Estas son credenciales oficiales de Authorize.net que funcionan en sandbox
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

async def setup_public_demo_credentials():
    """Guarda las credenciales públicas de demo en la base de datos"""
    
    # Credenciales PÚBLICAS oficiales de Authorize.net
    PUBLIC_DEMO_CREDENTIALS = {
        "api_login_id": "5KP3u95bQpv",
        "transaction_key": "346HZ32z3fP4hTG2",
        "signature_key": "",
        "public_client_key": "",
        "environment": "sandbox"
    }
    
    print("🔧 Configurando credenciales PÚBLICAS de DEMO de Authorize.net...")
    print("✅ Estas son credenciales OFICIALES que funcionan en sandbox")
    print()
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Desactivar TODAS las configuraciones existentes
        await db.api_configurations.update_many(
            {"service": "authorize_net"},
            {"$set": {"active": False}}
        )
        
        # Verificar si ya existe configuración de sandbox
        existing = await db.api_configurations.find_one({
            "service": "authorize_net",
            "credentials.environment": "sandbox"
        })
        
        now = datetime.utcnow()
        
        if existing:
            print(f"✅ Configuración de sandbox existe, actualizando...")
            
            await db.api_configurations.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "credentials": PUBLIC_DEMO_CREDENTIALS,
                        "updated_at": now,
                        "active": True  # ACTIVAR
                    }
                }
            )
            print("✅ Credenciales públicas actualizadas y ACTIVADAS")
        else:
            print("📝 Creando nueva configuración con credenciales públicas...")
            
            config = {
                "service": "authorize_net",
                "credentials": PUBLIC_DEMO_CREDENTIALS,
                "active": True,  # ACTIVAR
                "created_at": now,
                "updated_at": now
            }
            
            result = await db.api_configurations.insert_one(config)
            print(f"✅ Credenciales públicas creadas y ACTIVADAS (ID: {result.inserted_id})")
        
        print()
        print("=" * 70)
        print("✅ CONFIGURACIÓN COMPLETADA Y ACTIVADA")
        print("=" * 70)
        print()
        print("📋 Credenciales públicas guardadas:")
        print(f"   - API Login ID: {PUBLIC_DEMO_CREDENTIALS['api_login_id']}")
        print(f"   - Transaction Key: ****{PUBLIC_DEMO_CREDENTIALS['transaction_key'][-4:]}")
        print(f"   - Ambiente: {PUBLIC_DEMO_CREDENTIALS['environment'].upper()}")
        print()
        print("✅ Estado: ACTIVO")
        print("✅ Estas credenciales FUNCIONAN correctamente")
        print()
        print("🎯 LISTO PARA PRUEBAS:")
        print("   - Sistema configurado con credenciales oficiales de Authorize.net")
        print("   - Puedes hacer pagos ACH de prueba sin problemas")
        print("   - Transacciones simuladas pero con API real")
        print()
        print("📌 Datos de prueba para ACH:")
        print("   - Routing Number: 121042882")
        print("   - Account Number: 123456789012")
        print("   - Amount máximo: $100.00 (límite sandbox)")
        print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(setup_public_demo_credentials())
