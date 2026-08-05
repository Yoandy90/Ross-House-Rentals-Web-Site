"""
Fix availability configuration with correct structure
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RAILWAY_MONGO_URL = 'os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxportal')

async def fix_availability():
    """Create correct availability configuration"""
    
    try:
        logger.info("🚀 Connecting to Railway production MongoDB...")
        
        client = AsyncIOMotorClient(RAILWAY_MONGO_URL)
        db = client.taxportal
        
        availability_collection = db.availability_configs
        
        # Delete old config
        await availability_collection.delete_many({})
        
        # Create correct structure
        correct_availability = {
            '_id': str(uuid.uuid4()),
            'admin_id': 'default',
            'slot_duration_minutes': 60,
            'buffer_time_minutes': 0,
            'max_advance_days': 60,
            'weekly_schedule': [
                {
                    'day': 'monday',
                    'enabled': True,
                    'slots': [
                        {
                            'start_time': '09:00',
                            'end_time': '17:00',
                        }
                    ]
                },
                {
                    'day': 'tuesday',
                    'enabled': True,
                    'slots': [
                        {
                            'start_time': '09:00',
                            'end_time': '17:00',
                        }
                    ]
                },
                {
                    'day': 'wednesday',
                    'enabled': True,
                    'slots': [
                        {
                            'start_time': '09:00',
                            'end_time': '17:00',
                        }
                    ]
                },
                {
                    'day': 'thursday',
                    'enabled': True,
                    'slots': [
                        {
                            'start_time': '09:00',
                            'end_time': '17:00',
                        }
                    ]
                },
                {
                    'day': 'friday',
                    'enabled': True,
                    'slots': [
                        {
                            'start_time': '09:00',
                            'end_time': '17:00',
                        }
                    ]
                },
                {
                    'day': 'saturday',
                    'enabled': False,
                    'slots': []
                },
                {
                    'day': 'sunday',
                    'enabled': False,
                    'slots': []
                },
            ],
            'blocked_dates': [],
            'google_calendar_connected': False,
            'google_calendar_id': None,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
        }
        
        await availability_collection.insert_one(correct_availability)
        
        logger.info(f"✅ Created correct availability configuration")
        logger.info(f"\n{'='*60}")
        logger.info(f"⏰ Availability Configuration:")
        logger.info(f"   Lunes-Viernes: 9:00-17:00")
        logger.info(f"   Duración de slots: 60 minutos")
        logger.info(f"   Buffer: 0 minutos")
        logger.info(f"   Anticipación máxima: 60 días")
        logger.info(f"{'='*60}\n")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(fix_availability())
