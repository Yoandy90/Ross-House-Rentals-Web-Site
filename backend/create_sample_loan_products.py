"""
Create sample loan products for Ross Tax Preparation
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime
import uuid

load_dotenv()


async def create_sample_products():
    """Create sample loan products"""
    
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "Préstamo Personal Básico",
            "description": "Préstamo personal para gastos generales",
            "currency": "USD",
            "min_amount": 300.0,
            "max_amount": 3000.0,
            "term_type": "monthly",
            "term_count": 12,
            "apr": 0.24,  # 24% annual
            "opening_fee": {
                "type": "percent",
                "value": 2.0
            },
            "late_fee": {
                "type": "daily_percent",
                "value": 0.1  # 0.1% per day
            },
            "grace_days": 3,
            "interest_method": "price",
            "policy": {
                "dti_max": 0.45,
                "score_min": 600,
                "required_documents": ["id_front", "proof_of_income"]
            },
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": "system"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Préstamo Express",
            "description": "Préstamo rápido a corto plazo",
            "currency": "USD",
            "min_amount": 100.0,
            "max_amount": 1000.0,
            "term_type": "biweekly",
            "term_count": 12,  # 6 months
            "apr": 0.36,  # 36% annual
            "opening_fee": {
                "type": "fixed",
                "value": 25.0
            },
            "late_fee": {
                "type": "daily_percent",
                "value": 0.15
            },
            "grace_days": 2,
            "interest_method": "price",
            "policy": {
                "dti_max": 0.50,
                "score_min": 550,
                "required_documents": ["id_front"]
            },
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": "system"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Préstamo Plus",
            "description": "Préstamo de mayor monto con mejores tasas",
            "currency": "USD",
            "min_amount": 2000.0,
            "max_amount": 10000.0,
            "term_type": "monthly",
            "term_count": 24,
            "apr": 0.18,  # 18% annual
            "opening_fee": {
                "type": "percent",
                "value": 1.5
            },
            "late_fee": {
                "type": "daily_percent",
                "value": 0.08
            },
            "grace_days": 5,
            "interest_method": "price",
            "policy": {
                "dti_max": 0.40,
                "score_min": 650,
                "required_documents": ["id_front", "id_back", "proof_of_income", "bank_statement"]
            },
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": "system"
        }
    ]
    
    # Check if products already exist
    existing_count = await db.loan_products.count_documents({})
    
    if existing_count > 0:
        print(f"⚠️  {existing_count} loan products already exist. Skipping creation.")
        return
    
    # Insert products
    result = await db.loan_products.insert_many(products)
    
    print(f"✅ Created {len(result.inserted_ids)} loan products:")
    for product in products:
        print(f"   - {product['name']}: ${product['min_amount']}-${product['max_amount']}, {product['apr']*100}% APR")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_sample_products())
