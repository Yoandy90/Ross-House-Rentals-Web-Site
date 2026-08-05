"""
Crear usuario de prueba Yoandy Ross para testing completo del sistema
"""
import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import hashlib
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxpro')

async def create_test_user():
    """Crea usuario de prueba Yoandy Ross"""
    
    try:
        logger.info("🚀 Creando usuario de prueba Yoandy Ross...")
        
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.get_database()
        users_collection = db.users
        
        # Datos del usuario de prueba
        email = "yoandyross@rosstaxpreparation.com"
        phone = "+18069307456"
        name = "Yoandy Ross"
        password = "Testing2025!"
        
        # Verificar si ya existe
        existing = await users_collection.find_one({'email': email})
        
        if existing:
            logger.info(f"ℹ️  Usuario {email} ya existe, actualizando...")
            
            # Actualizar datos
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            await users_collection.update_one(
                {'_id': existing['_id']},
                {'$set': {
                    'name': name,
                    'phone': phone,
                    'password': password_hash,
                    'type': 'client',
                    'status': 'active',
                    'kyc_completed': True,
                    'language': 'es',
                    'updated_at': datetime.utcnow(),
                    'password_change_required': False,
                    'metadata': {
                        'test_user': True,
                        'notifications_enabled': True,
                        'can_receive_sms': True,
                        'can_receive_email': True,
                        'purpose': 'Testing completo del sistema',
                        'updated_at': datetime.utcnow().isoformat()
                    }
                }}
            )
            
            logger.info(f"✅ Usuario actualizado exitosamente")
            logger.info(f"   Email: {email}")
            logger.info(f"   Phone: {phone}")
            logger.info(f"   Password: {password}")
            logger.info(f"   ✅ NOTIFICACIONES HABILITADAS (SMS + Email)")
        else:
            # Crear nuevo usuario
            user_id = str(uuid.uuid4())
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            user_doc = {
                '_id': user_id,
                'email': email,
                'name': name,
                'phone': phone,
                'password': password_hash,
                'type': 'client',
                'status': 'active',
                'kyc_completed': True,
                'language': 'es',
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'password_change_required': False,
                'metadata': {
                    'test_user': True,
                    'notifications_enabled': True,
                    'can_receive_sms': True,
                    'can_receive_email': True,
                    'purpose': 'Testing completo del sistema',
                    'created_at': datetime.utcnow().isoformat()
                }
            }
            
            await users_collection.insert_one(user_doc)
            
            logger.info(f"✅ Usuario creado exitosamente")
            logger.info(f"   Email: {email}")
            logger.info(f"   Phone: {phone}")
            logger.info(f"   Password: {password}")
            logger.info(f"   ✅ NOTIFICACIONES HABILITADAS (SMS + Email)")
        
        logger.info("\n" + "="*70)
        logger.info("🎯 USUARIO DE PRUEBA LISTO PARA TESTING")
        logger.info("="*70)
        logger.info(f"📧 Email: {email}")
        logger.info(f"📱 Phone: {phone}")
        logger.info(f"🔑 Password: {password}")
        logger.info(f"✅ Recibirá SMS y Emails para todas las pruebas")
        logger.info("="*70 + "\n")
        
        client.close()
    
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_test_user())
