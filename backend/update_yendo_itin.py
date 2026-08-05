#!/usr/bin/env python3
"""
Update Yendo affiliate link with ITIN benefit
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


async def update_yendo_link():
    """Update Yendo link to include ITIN benefit"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Find existing Yendo link
        existing = await db.affiliate_links.find_one({'service_name': 'Yendo'})
        
        if not existing:
            print("❌ Yendo affiliate link not found")
            return
        
        # Updated benefits with ITIN support
        updated_benefits_es = [
            'Hasta $10,000 en crédito',
            'Pre-aprobación sin impacto en tu crédito',
            'Acepta SSN e ITIN para aplicar',
            '1.5% cashback ilimitado en todas las compras',
            'Construye tu historial crediticio reportando a las 3 agencias',
            'Todos los scores de crédito son bienvenidos',
            'Tarjeta virtual instantánea disponible',
            'Aprobación promedio de $4,400'
        ]
        
        updated_benefits_en = [
            'Up to $10,000 in credit',
            'No credit impact for pre-approval decision',
            'Accepts SSN and ITIN to apply',
            'Unlimited 1.5% cashback on all purchases',
            'Build your credit reporting to all 3 bureaus',
            'All credit scores welcome to apply',
            'Instant virtual card available',
            'Average approval of $4,400'
        ]
        
        # Update the document
        result = await db.affiliate_links.update_one(
            {'service_name': 'Yendo'},
            {
                '$set': {
                    'benefits_es': updated_benefits_es,
                    'benefits_en': updated_benefits_en,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"✅ Yendo benefits updated successfully")
            print(f"   - Added ITIN acceptance benefit")
            print(f"   - Total benefits: {len(updated_benefits_es)}")
        else:
            print("ℹ️  No changes made (benefits may already be updated)")
        
    except Exception as e:
        print(f"❌ Error updating Yendo link: {e}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(update_yendo_link())
