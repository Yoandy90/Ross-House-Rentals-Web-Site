import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def fix():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    print(f"🔍 Usando base de datos: {db_name}")
    
    # Rest of the script...
    pass

if __name__ == "__main__":
    asyncio.run(fix())