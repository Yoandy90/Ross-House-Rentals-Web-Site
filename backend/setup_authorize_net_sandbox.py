#!/usr/bin/env python3
"""
Script para configurar las credenciales de SANDBOX de Authorize.net
Estas son credenciales de PRUEBAS - Seguras para testing
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

async def setup_sandbox_credentials():
    """Guarda las credenciales de sandbox en la base de datos"""
    
    # Credenciales de SANDBOX proporcionadas por el usuario
    SANDBOX_CREDENTIALS = {
        "api_login_id": "bizdev05",
        "transaction_key": "4kJd237rZu59qAZd",
        "signature_key": "",  # No proporcionada para sandbox
        "public_client_key": "",  # No proporcionada para sandbox
        "environment": "sandbox"
    }
    
    print("🔧 Configurando credenciales de SANDBOX de Authorize.net...")
    print("✅ Estas son credenciales de PRUEBAS - Seguras para testing")
    print()
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Verificar si ya existe una configuración de sandbox
        existing = await db.api_configurations.find_one({
            "service": "authorize_net",
            "credentials.environment": "sandbox"
        })
        
        now = datetime.utcnow()
        
        if existing:
            print(f"✅ Configuración de sandbox ya existe (ID: {existing['_id']})")
            print("🔄 Actualizando credenciales...")
            
            await db.api_configurations.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "credentials": SANDBOX_CREDENTIALS,
                        "updated_at": now,
                        "active": True  # ACTIVAR automáticamente para testing
                    }
                }
            )
            print("✅ Credenciales de sandbox actualizadas y ACTIVADAS")
        else:
            print("📝 Creando nueva configuración de sandbox...")
            
            config = {
                "service": "authorize_net",
                "credentials": SANDBOX_CREDENTIALS,
                "active": True,  # ACTIVAR automáticamente para testing
                "created_at": now,
                "updated_at": now
            }
            
            result = await db.api_configurations.insert_one(config)
            print(f"✅ Configuración de sandbox creada y ACTIVADA (ID: {result.inserted_id})")
        
        # Desactivar configuración de producción si existe
        prod_result = await db.api_configurations.update_many(
            {
                "service": "authorize_net",
                "credentials.environment": "production"
            },
            {"$set": {"active": False}}
        )
        
        if prod_result.modified_count > 0:
            print(f"🔒 Configuración de PRODUCCIÓN desactivada (por seguridad)")
        
        print()
        print("=" * 70)
        print("✅ CONFIGURACIÓN COMPLETADA Y ACTIVADA")
        print("=" * 70)
        print()
        print("📋 Credenciales guardadas:")
        print(f"   - API Login ID: {SANDBOX_CREDENTIALS['api_login_id']}")
        print(f"   - Transaction Key: ****{SANDBOX_CREDENTIALS['transaction_key'][-4:]}")
        print(f"   - Ambiente: {SANDBOX_CREDENTIALS['environment'].upper()}")
        print()
        print("✅ Estado: ACTIVO")
        print("✅ Listo para pruebas seguras")
        print()
        print("🎯 PRÓXIMO PASO:")
        print("   - El sistema ya está configurado con Sandbox")
        print("   - Puedes hacer pruebas de pagos ACH sin riesgo")
        print("   - No se procesará dinero real")
        print()
        print("📌 Números de prueba para ACH:")
        print("   - Routing Number: 121042882")
        print("   - Account Number: cualquier número de 9-17 dígitos")
        print("   - Amount: cualquier monto (ej: $10.00)")
        print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(setup_sandbox_credentials())
