#!/usr/bin/env python3
"""
Script para crear usuarios de prueba con teléfonos
"""
import asyncio
import sys
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime

load_dotenv()
sys.path.insert(0, '/app/backend')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_test_users():
    """Crea usuarios de prueba para testing de SMS"""
    try:
        # Conectar a MongoDB
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url)
        db = client.get_database('ross_tax')
        
        print("=" * 60)
        print("👥 CREANDO USUARIOS DE PRUEBA")
        print("=" * 60)
        
        # Lista de usuarios de prueba
        test_users = [
            {
                "name": "Cliente Prueba 1",
                "email": "cliente1@test.com",
                "phone": "+18065914974",  # Usar el número de Twilio
                "role": "client",
                "password": pwd_context.hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True
            },
            {
                "name": "Cliente Prueba 2",
                "email": "cliente2@test.com",
                "phone": "+18065914974",
                "role": "client",
                "password": pwd_context.hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True
            },
            {
                "name": "Cliente Prueba 3",
                "email": "cliente3@test.com",
                "phone": "+18065914974",
                "role": "client",
                "password": pwd_context.hash("password123"),
                "created_at": datetime.utcnow(),
                "is_active": True
            },
            {
                "name": "Admin Test",
                "email": "admin@test.com",
                "phone": "+18065914974",
                "role": "admin",
                "password": pwd_context.hash("admin123"),
                "created_at": datetime.utcnow(),
                "is_active": True
            }
        ]
        
        # Verificar si ya existen
        for user_data in test_users:
            existing = await db.users.find_one({"email": user_data["email"]})
            
            if existing:
                print(f"⚠️  Usuario {user_data['email']} ya existe, actualizando...")
                await db.users.update_one(
                    {"email": user_data["email"]},
                    {"$set": user_data}
                )
            else:
                print(f"✅ Creando usuario {user_data['email']}...")
                await db.users.insert_one(user_data)
        
        # Verificar
        total_users = await db.users.count_documents({})
        users_with_phone = await db.users.count_documents({"phone": {"$exists": True, "$ne": ""}})
        
        print("\n" + "=" * 60)
        print("📊 RESUMEN")
        print("=" * 60)
        print(f"Total usuarios: {total_users}")
        print(f"Usuarios con teléfono: {users_with_phone}")
        print("\n✅ Usuarios de prueba creados exitosamente")
        print("\n📝 CREDENCIALES:")
        print("   Cliente: cliente1@test.com / password123")
        print("   Cliente: cliente2@test.com / password123")
        print("   Cliente: cliente3@test.com / password123")
        print("   Admin: admin@test.com / admin123")
        print("\n📱 Todos tienen el teléfono: +18065914974")
        print("=" * 60)
        
        client.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_test_users())
