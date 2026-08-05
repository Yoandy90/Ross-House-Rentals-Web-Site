import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    count = await db.service_prices.count_documents({})
    services = await db.service_prices.find({}).to_list(10)
    print(f'Total servicios: {count}')
    for s in services:
        print(f"  - {s.get('name', 'Sin nombre')}: ${s.get('price', 0)}")
    client.close()

asyncio.run(check())
