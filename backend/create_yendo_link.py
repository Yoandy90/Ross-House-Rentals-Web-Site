#!/usr/bin/env python3
"""
Create default Yendo affiliate link in MongoDB
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


async def create_yendo_link():
    """Create default Yendo affiliate link"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Check if link already exists
        existing = await db.affiliate_links.find_one({'service_name': 'Yendo'})
        
        if existing:
            print("✅ Yendo affiliate link already exists")
            return
        
        # Create Yendo link
        yendo_link = {
            'service_name': 'Yendo',
            'service_type': 'credit_card',
            'affiliate_url': 'https://apply.yendo.com/',  # Admin will update with actual affiliate link
            'description_es': 'Yendo es la tarjeta de crédito respaldada por tu vehículo. Funciona como una Mastercard® normal, pero aprovecha el valor de tu auto para obtener límites más altos a tasas asequibles. Pre-aprobación en 1 minuto sin impacto en tu crédito.',
            'description_en': 'Yendo is the credit card powered by your car. It works like a regular Mastercard®, but taps into your vehicle equity to get higher limits at affordable rates. Get pre-approved in 1 minute with no impact to your credit score.',
            'benefits_es': [
                'Hasta $10,000 en crédito',
                'Pre-aprobación sin impacto en tu crédito',
                'Acepta SSN e ITIN para aplicar',
                '1.5% cashback ilimitado en todas las compras',
                'Construye tu historial crediticio reportando a las 3 agencias',
                'Todos los scores de crédito son bienvenidos',
                'Tarjeta virtual instantánea disponible',
                'Aprobación promedio de $4,400'
            ],
            'benefits_en': [
                'Up to $10,000 in credit',
                'No credit impact for pre-approval decision',
                'Accepts SSN and ITIN to apply',
                'Unlimited 1.5% cashback on all purchases',
                'Build your credit reporting to all 3 bureaus',
                'All credit scores welcome to apply',
                'Instant virtual card available',
                'Average approval of $4,400'
            ],
            'button_text_es': 'Aplicar Ahora',
            'button_text_en': 'Apply Now',
            'is_active': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = await db.affiliate_links.insert_one(yendo_link)
        print(f"✅ Yendo affiliate link created with ID: {result.inserted_id}")
        
    except Exception as e:
        print(f"❌ Error creating Yendo link: {e}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(create_yendo_link())
