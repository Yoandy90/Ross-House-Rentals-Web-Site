"""
Populate production database with test CLIENT users and appointments
"""
import asyncio
import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Railway production MongoDB URL
RAILWAY_MONGO_URL = 'os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxportal')

async def populate_test_data():
    """Populate production with test client users and data"""
    
    try:
        logger.info("🚀 Connecting to Railway production MongoDB...")
        
        client = AsyncIOMotorClient(RAILWAY_MONGO_URL)
        db = client.taxportal
        
        # Create test client user
        users_collection = db.users
        appointments_collection = db.appointments
        
        # Test client data
        test_client = {
            '_id': str(uuid.uuid4()),
            'email': 'cliente.test@rosstax.com',
            'name': 'Cliente de Prueba',
            'full_name': 'Cliente de Prueba Ross',
            'phone': '+1234567890',
            'password_hash': pwd_context.hash('Cliente123!'),
            'role': 'client',
            'type': 'client',
            'status': 'active',
            'kyc_completed': True,
            'language': 'es',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'password_change_required': False,
            'profile': {
                'address': '123 Test Street',
                'city': 'Dallas',
                'state': 'TX',
                'zip_code': '75001',
            },
            'preferences': {
                'notifications': {
                    'email': True,
                    'sms': True,
                    'push': True,
                }
            },
            'metadata': {
                'test_user': True,
            }
        }
        
        # Check if user exists
        existing = await users_collection.find_one({'email': test_client['email']})
        
        if existing:
            logger.info(f"✅ User {test_client['email']} already exists")
            client_id = existing['_id']
        else:
            await users_collection.insert_one(test_client)
            logger.info(f"✅ Created test client user")
            client_id = test_client['_id']
        
        # Create sample appointments for this client
        now = datetime.utcnow()
        
        sample_appointments = [
            {
                '_id': str(uuid.uuid4()),
                'user_id': client_id,
                'client_id': client_id,
                'title': 'Consulta Inicial',
                'description': 'Primera consulta sobre declaración de impuestos',
                'appointment_type': 'consultation',
                'scheduled_at': (now + timedelta(days=3)).isoformat(),
                'appointment_datetime': (now + timedelta(days=3)).isoformat(),
                'duration_minutes': 60,
                'status': 'scheduled',
                'location': 'office',
                'created_at': now.isoformat(),
                'updated_at': now.isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'user_id': client_id,
                'client_id': client_id,
                'title': 'Preparación de Impuestos',
                'description': 'Sesión de preparación de declaración 2024',
                'appointment_type': 'tax_preparation',
                'scheduled_at': (now + timedelta(days=7)).isoformat(),
                'appointment_datetime': (now + timedelta(days=7)).isoformat(),
                'duration_minutes': 120,
                'status': 'scheduled',
                'location': 'office',
                'created_at': now.isoformat(),
                'updated_at': now.isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'user_id': client_id,
                'client_id': client_id,
                'title': 'Seguimiento',
                'description': 'Revisión de documentos adicionales',
                'appointment_type': 'follow_up',
                'scheduled_at': (now - timedelta(days=5)).isoformat(),
                'appointment_datetime': (now - timedelta(days=5)).isoformat(),
                'duration_minutes': 30,
                'status': 'completed',
                'location': 'virtual',
                'created_at': (now - timedelta(days=10)).isoformat(),
                'updated_at': now.isoformat(),
            },
        ]
        
        # Delete existing appointments for this user
        await appointments_collection.delete_many({'user_id': client_id})
        
        # Insert new appointments
        await appointments_collection.insert_many(sample_appointments)
        logger.info(f"✅ Created {len(sample_appointments)} test appointments")
        
        # Create availability config if doesn't exist
        availability_collection = db.availability_configs
        
        default_availability = {
            '_id': str(uuid.uuid4()),
            'admin_id': 'default',
            'timezone': 'America/Chicago',
            'days': {
                'monday': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '17:00',
                    'slot_duration': 60,
                },
                'tuesday': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '17:00',
                    'slot_duration': 60,
                },
                'wednesday': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '17:00',
                    'slot_duration': 60,
                },
                'thursday': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '17:00',
                    'slot_duration': 60,
                },
                'friday': {
                    'enabled': True,
                    'start_time': '09:00',
                    'end_time': '17:00',
                    'slot_duration': 60,
                },
                'saturday': {
                    'enabled': False,
                },
                'sunday': {
                    'enabled': False,
                },
            },
            'created_at': now.isoformat(),
            'updated_at': now.isoformat(),
        }
        
        existing_config = await availability_collection.find_one({})
        if not existing_config:
            await availability_collection.insert_one(default_availability)
            logger.info(f"✅ Created default availability configuration")
        else:
            logger.info(f"✅ Availability configuration already exists")
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ TEST DATA CREATED SUCCESSFULLY")
        logger.info(f"{'='*60}")
        logger.info(f"\n📧 Test Client Credentials:")
        logger.info(f"   Email: cliente.test@rosstax.com")
        logger.info(f"   Password: Cliente123!")
        logger.info(f"   Role: client")
        logger.info(f"\n📅 Appointments Created: {len(sample_appointments)}")
        logger.info(f"   - 2 upcoming appointments")
        logger.info(f"   - 1 completed appointment")
        logger.info(f"\n⏰ Availability: Mon-Fri 9:00-17:00 (60min slots)")
        logger.info(f"\n{'='*60}\n")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(populate_test_data())
