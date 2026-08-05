"""
Script to create sample lotteries for Ross Tax Preparation
Run this to populate the database with example lottery games
"""
import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/')
DATABASE_NAME = 'ross_tax_prep'

async def create_sample_lotteries():
    """Create sample lottery games"""
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    lotteries_collection = db['lotteries']
    
    print("🎰 Creating sample lotteries...")
    
    # Clear existing lotteries (optional - comment out to keep existing)
    # await lotteries_collection.delete_many({})
    # print("   Cleared existing lotteries")
    
    # Get admin user
    admin_user = await db['users'].find_one({'role': 'admin'})
    admin_id = str(admin_user['_id']) if admin_user else 'admin'
    
    current_date = datetime.now(timezone.utc)
    
    sample_lotteries = [
        {
            '_id': f'lottery_raspadito_{datetime.now().timestamp()}',
            'title': '🎫 Raspaditos Dorados',
            'description': 'Rasca y gana hasta 500 créditos al instante. Cada tarjeta tiene 3 símbolos ocultos.',
            'lottery_type': 'scratch_card',
            'prize_type': 'credits',
            'prize_value': 'Hasta 500 créditos',
            'prize_credits': 500,
            'ticket_price': 10,
            'max_tickets_per_user': 20,
            'status': 'active',
            'total_cards': 1000,
            'scratch_card_prizes': {
                '500_credits': 2,    # 2 tarjetas con 500 créditos
                '250_credits': 10,   # 10 tarjetas con 250 créditos
                '100_credits': 50,   # 50 tarjetas con 100 créditos
                '50_credits': 100,   # 100 tarjetas con 50 créditos
                '25_credits': 200,   # 200 tarjetas con 25 créditos
                'no_prize': 638      # El resto sin premio
            },
            'admin_id': admin_id,
            'created_at': current_date,
            'updated_at': current_date,
        },
        {
            '_id': f'lottery_bolita_{datetime.now().timestamp()}',
            'title': '🇨🇺 La Bolita Cubana',
            'description': 'Juego tradicional cubano. Elige tu número de la suerte del 00 al 99 y gana hasta 1000 créditos.',
            'lottery_type': 'bolita',
            'prize_type': 'credits',
            'prize_value': '1000 créditos',
            'prize_credits': 1000,
            'ticket_price': 5,
            'max_tickets_per_user': 50,
            'status': 'active',
            'bolita_number_range': 100,
            'draw_date': (current_date + timedelta(days=7)).isoformat(),
            'admin_id': admin_id,
            'created_at': current_date,
            'updated_at': current_date,
        },
        {
            '_id': f'lottery_traditional_{datetime.now().timestamp()}',
            'title': '🎰 Mega Lotería - Gran Premio',
            'description': 'Lotería clásica estilo PowerBall. Elige 6 números del 1 al 49. Gran premio de 5000 créditos.',
            'lottery_type': 'traditional',
            'prize_type': 'credits',
            'prize_value': '5000 créditos',
            'prize_credits': 5000,
            'ticket_price': 20,
            'max_tickets_per_user': 10,
            'status': 'active',
            'numbers_to_pick': 6,
            'number_range_min': 1,
            'number_range_max': 49,
            'draw_date': (current_date + timedelta(days=14)).isoformat(),
            'admin_id': admin_id,
            'created_at': current_date,
            'updated_at': current_date,
        },
        {
            '_id': f'lottery_scratch_instant_{datetime.now().timestamp()}',
            'title': '💎 Raspaditos Premium',
            'description': 'Raspaditos premium con premios más grandes. Hasta 1000 créditos al instante.',
            'lottery_type': 'scratch_card',
            'prize_type': 'credits',
            'prize_value': 'Hasta 1000 créditos',
            'prize_credits': 1000,
            'ticket_price': 25,
            'max_tickets_per_user': 10,
            'status': 'active',
            'total_cards': 500,
            'scratch_card_prizes': {
                '1000_credits': 1,    # 1 tarjeta con 1000 créditos
                '500_credits': 5,     # 5 tarjetas con 500 créditos
                '250_credits': 20,    # 20 tarjetas con 250 créditos
                '100_credits': 50,    # 50 tarjetas con 100 créditos
                '50_credits': 100,    # 100 tarjetas con 50 créditos
                'no_prize': 324       # El resto sin premio
            },
            'admin_id': admin_id,
            'created_at': current_date,
            'updated_at': current_date,
        },
        {
            '_id': f'lottery_bolita_daily_{datetime.now().timestamp()}',
            'title': '🎯 Bolita Diaria',
            'description': 'Juega todos los días. Nuevo sorteo cada 24 horas. Premio de 300 créditos.',
            'lottery_type': 'bolita',
            'prize_type': 'credits',
            'prize_value': '300 créditos',
            'prize_credits': 300,
            'ticket_price': 3,
            'max_tickets_per_user': 100,
            'status': 'active',
            'bolita_number_range': 100,
            'draw_date': (current_date + timedelta(days=1)).isoformat(),
            'admin_id': admin_id,
            'created_at': current_date,
            'updated_at': current_date,
        },
    ]
    
    # Insert lotteries
    for lottery in sample_lotteries:
        try:
            # Check if lottery already exists
            existing = await lotteries_collection.find_one({'_id': lottery['_id']})
            if existing:
                print(f"   ⚠️  Lottery '{lottery['title']}' already exists, skipping...")
                continue
            
            await lotteries_collection.insert_one(lottery)
            print(f"   ✅ Created: {lottery['title']} ({lottery['lottery_type']})")
        except Exception as e:
            print(f"   ❌ Error creating {lottery['title']}: {str(e)}")
    
    print(f"\n✅ Sample lotteries created successfully!")
    print(f"   Total active lotteries: {await lotteries_collection.count_documents({'status': 'active'})}")
    
    # Show summary
    print("\n📊 Lottery Summary:")
    for lottery_type in ['scratch_card', 'bolita', 'traditional']:
        count = await lotteries_collection.count_documents({
            'lottery_type': lottery_type,
            'status': 'active'
        })
        type_name = {
            'scratch_card': 'Raspaditos',
            'bolita': 'La Bolita',
            'traditional': 'Lotería Clásica'
        }.get(lottery_type, lottery_type)
        print(f"   {type_name}: {count} active")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(create_sample_lotteries())
