"""
Endpoint temporal para probar notificaciones push
"""
from fastapi import APIRouter, HTTPException
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
db = None
notification_service = None

def set_database(database):
    global db
    db = database

def set_notification_service(service):
    global notification_service
    notification_service = service

@router.post('/test-push')
async def send_test_push_to_all_users():
    """
    Envía una notificación push de prueba a todos los usuarios con push_token
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        if notification_service is None:
            raise HTTPException(status_code=503, detail="Notification service not available")
        
        # Buscar todos los usuarios con push_token
        users = await db.users.find({'push_token': {'$exists': True, '$ne': None}}).to_list(length=100)
        
        if not users:
            return {
                'success': False,
                'message': 'No se encontraron usuarios con push_token',
                'sent': 0
            }
        
        sent_count = 0
        failed_count = 0
        
        for user in users:
            try:
                push_token = user.get('push_token')
                if push_token:
                    await notification_service.send_push_notification(
                        push_token,
                        '🇨🇺 Prueba de Notificación',
                        '¡Esta es una notificación de prueba de La Bolita Cubana! Si la ves, el sistema funciona correctamente. 🎉'
                    )
                    sent_count += 1
                    logger.info(f"✅ Push enviado a: {user.get('email', 'unknown')}")
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Error enviando push a {user.get('email')}: {str(e)}")
        
        return {
            'success': True,
            'message': f'Notificaciones enviadas correctamente',
            'sent': sent_count,
            'failed': failed_count,
            'total_users': len(users)
        }
        
    except Exception as e:
        logger.error(f"Error en test push: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/my-push-token')
async def get_my_push_token(email: str):
    """
    Obtiene el push token de un usuario específico por email
    """
    try:
        if db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        user = await db.users.find_one({'email': email})
        
        if not user:
            return {
                'found': False,
                'message': 'Usuario no encontrado'
            }
        
        push_token = user.get('push_token')
        
        return {
            'found': True,
            'email': email,
            'has_push_token': push_token is not None,
            'push_token': push_token[:50] + '...' if push_token and len(push_token) > 50 else push_token
        }
        
    except Exception as e:
        logger.error(f"Error obteniendo push token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

logger.info("✅ Test Push endpoints initialized")
