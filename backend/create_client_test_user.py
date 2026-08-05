"""
Crear usuario cliente de prueba con password_hash correcto
"""
import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Password context (mismo que usa el backend)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# URL de MongoDB de producción
PRODUCTION_MONGO_URL = "os.getenv("MONGO_URL", "mongodb://localhost:27017/taxportal")"

async def create_client_user():
    """Crea usuario cliente de prueba en producción"""
    
    try:
        logger.info("🚀 Conectando a MongoDB de producción...")
        
        client = AsyncIOMotorClient(PRODUCTION_MONGO_URL)
        db = client.taxpro_production
        users_collection = db.users
        
        # Datos del usuario de prueba
        email = "cliente.prueba@rosstax.com"
        password = "Cliente123!"
        name = "Cliente de Prueba"
        phone = "+1234567890"
        
        # Verificar si ya existe
        existing = await users_collection.find_one({'email': email})
        
        if existing:
            logger.info(f"ℹ️  Usuario {email} ya existe. Actualizando contraseña...")
            
            # Generar hash con bcrypt (mismo método del backend)
            password_hash = pwd_context.hash(password)
            
            await users_collection.update_one(
                {'email': email},
                {'$set': {
                    'password_hash': password_hash,
                    'name': name,
                    'phone': phone,
                    'type': 'client',
                    'status': 'active',
                    'kyc_completed': True,
                    'language': 'es',
                    'updated_at': datetime.utcnow(),
                    'password_change_required': False,
                }}
            )
            
            logger.info(f"✅ Usuario actualizado exitosamente")
        else:
            # Crear nuevo usuario
            user_id = str(uuid.uuid4())
            password_hash = pwd_context.hash(password)
            
            user_doc = {
                '_id': user_id,
                'email': email,
                'name': name,
                'full_name': name,
                'phone': phone,
                'password_hash': password_hash,
                'type': 'client',
                'status': 'active',
                'kyc_completed': True,
                'language': 'es',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'password_change_required': False,
                'profile': {
                    'address': '',
                    'city': '',
                    'state': '',
                    'zip_code': '',
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
                    'purpose': 'Testing app como cliente',
                }
            }
            
            await users_collection.insert_one(user_doc)
            
            logger.info(f"✅ Usuario creado exitosamente")
        
        logger.info(f"\n{'='*60}")
        logger.info(f"📧 Email: {email}")
        logger.info(f"🔑 Contraseña: {password}")
        logger.info(f"👤 Nombre: {name}")
        logger.info(f"📱 Tipo: Cliente")
        logger.info(f"{'='*60}\n")
        
        # Verificar login
        test_user = await users_collection.find_one({'email': email})
        if test_user and pwd_context.verify(password, test_user['password_hash']):
            logger.info("✅ Verificación de contraseña exitosa")
        else:
            logger.error("❌ Error en verificación de contraseña")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(create_client_user())
