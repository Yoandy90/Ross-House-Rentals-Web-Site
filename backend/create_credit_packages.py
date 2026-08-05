"""
Script para crear los paquetes de créditos predeterminados de Ross Tax
Ejecutar una vez para inicializar el sistema de créditos

Configuración:
- Paquete $50: 50 créditos base + 10% bonus = 55 créditos
- Paquete $100: 100 créditos base + 15% bonus = 115 créditos
- Paquete $200: 200 créditos base + 15% bonus = 230 créditos (⭐ Cubre declaración)
- Paquete $400: 400 créditos base + 20% bonus = 480 créditos (⭐ Cubre 2+ declaraciones)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
from datetime import datetime

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def create_default_packages():
    """Crear paquetes de créditos predeterminados"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    packages = [
        {
            "id": "pkg_50",
            "name": "Paquete Básico",
            "description": "Ideal para consultas y servicios menores",
            "amount_usd": 50.0,
            "base_credits": 50.0,
            "bonus_percentage": 10.0,
            "bonus_credits": 5.0,
            "total_credits": 55.0,
            "is_active": True,
            "is_featured": False,
            "sort_order": 1,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "pkg_100",
            "name": "Paquete Estándar",
            "description": "Perfecto para servicios regulares",
            "amount_usd": 100.0,
            "base_credits": 100.0,
            "bonus_percentage": 15.0,
            "bonus_credits": 15.0,
            "total_credits": 115.0,
            "is_active": True,
            "is_featured": False,
            "sort_order": 2,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "pkg_200",
            "name": "Paquete Pro",
            "description": "Cubre una declaración de impuestos completa ($180+)",
            "amount_usd": 200.0,
            "base_credits": 200.0,
            "bonus_percentage": 15.0,
            "bonus_credits": 30.0,
            "total_credits": 230.0,
            "is_active": True,
            "is_featured": True,  # ⭐ Featured - cubre declaración
            "sort_order": 3,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "pkg_400",
            "name": "Paquete Premium",
            "description": "Cubre 2+ declaraciones con máximo ahorro (20% bonus)",
            "amount_usd": 400.0,
            "base_credits": 400.0,
            "bonus_percentage": 20.0,
            "bonus_credits": 80.0,
            "total_credits": 480.0,
            "is_active": True,
            "is_featured": True,  # ⭐ Featured - mejor valor
            "sort_order": 4,
            "stripe_product_id": None,
            "stripe_price_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    print("🚀 Creando paquetes de créditos predeterminados...")
    
    for package in packages:
        existing = await db.credit_packages.find_one({"id": package["id"]})
        
        if existing:
            print(f"⚠️  Paquete {package['name']} ya existe, actualizando...")
            await db.credit_packages.update_one(
                {"id": package["id"]},
                {"$set": package}
            )
        else:
            print(f"✅ Creando paquete: {package['name']} - ${package['amount_usd']} = {package['total_credits']} créditos")
            await db.credit_packages.insert_one(package)
    
    print("\n✨ Paquetes de créditos creados exitosamente!")
    print("\n📦 Paquetes disponibles:")
    all_packages = await db.credit_packages.find({"is_active": True}).sort("sort_order", 1).to_list(10)
    
    for pkg in all_packages:
        featured = "⭐" if pkg.get("is_featured") else "  "
        print(f"{featured} {pkg['name']}: ${pkg['amount_usd']} → {pkg['total_credits']} créditos ({pkg['bonus_percentage']}% bonus)")
    
    print("\n💡 Nota: Los clientes recibirán 10% adicional en su primera compra!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_default_packages())
