"""
Fix services - Set all services as active
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def fix_services():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    print(f"🔍 Usando base de datos: {db_name}")
    
    # Update all services to be active and have valid price
    result = await db.service_prices.update_many(
        {},
        {
            "$set": {
                "is_active": True
            }
        }
    )
    
    print(f"✅ Actualizados {result.modified_count} servicios")
    
    # Show all services
    all_services = await db.service_prices.find({}).to_list(100)
    print(f"\n📊 Total servicios en DB: {len(all_services)}")
    
    services = await db.service_prices.find({"is_active": True}).to_list(100)
    print(f"📊 Total servicios activos: {len(services)}")
    
    for service in services[:10]:
        print(f"  - {service.get('name', 'N/A')}: {service.get('price_credits', 0)} créditos (active: {service.get('is_active', False)})")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_services())
