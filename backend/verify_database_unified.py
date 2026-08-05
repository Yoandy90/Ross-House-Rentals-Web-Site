"""
Verify all data is in the same database
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def verify():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    
    print(f"\n{'='*60}")
    print(f"🔍 VERIFICACIÓN DE BASE DE DATOS UNIFICADA")
    print(f"{'='*60}")
    print(f"📊 Base de datos: {db_name}")
    print(f"🔗 URL: {os.environ['MONGO_URL'].split('@')[0]}@***\n")
    
    # Check each collection
    collections_to_check = [
        'users',
        'service_prices',
        'conversations',
        'appointments',
        'documents',
        'notifications',
        'credits_transactions',
        'tax_returns'
    ]
    
    total_documents = 0
    
    for collection_name in collections_to_check:
        try:
            count = await db[collection_name].count_documents({})
            total_documents += count
            icon = "✅" if count > 0 else "⚠️ "
            print(f"{icon} {collection_name:25} {count:6} documentos")
        except Exception as e:
            print(f"❌ {collection_name:25} ERROR: {e}")
    
    print(f"\n{'='*60}")
    print(f"📊 Total de documentos: {total_documents}")
    print(f"{'='*60}\n")
    
    # Verify services
    services = await db.service_prices.find({"is_active": True}).to_list(100)
    print(f"✅ Servicios activos: {len(services)}")
    
    if services:
        print("\n📋 Primeros 5 servicios:")
        for service in services[:5]:
            print(f"   • {service.get('name', 'N/A')}: {service.get('price_credits', 0)} créditos")
    
    # Verify users
    users = await db.users.count_documents({})
    print(f"\n👥 Total de usuarios: {users}")
    
    client.close()
    print("\n✅ Verificación completada\n")

if __name__ == "__main__":
    asyncio.run(verify())
