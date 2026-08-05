"""
Endpoint temporal para configurar notificaciones en producción
ELIMINAR DESPUÉS DE USAR
"""
from fastapi import APIRouter
from motor.motor_asyncio import AsyncIOMotorClient
import os

setup_router = APIRouter()

@setup_router.post('/admin/setup-notifications')
@setup_router.get('/admin/setup-notifications')
async def setup_notifications():
    """
    Endpoint temporal para configurar api_config en producción
    Soporta tanto GET como POST
    """
    mongo_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME', 'taxportal')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get env variables
    sendgrid_api_key = os.getenv('SENDGRID_API_KEY', '')
    twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
    twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
    twilio_phone_number = os.getenv('TWILIO_PHONE_NUMBER', '')
    
    # Create or update config
    config = {
        '_id': 'main',
        'sendgrid_api_key': sendgrid_api_key,
        'sendgrid_from_email': 'noreply@rosstaxpreparation.com',
        'sendgrid_from_name': 'Ross Tax Preparation',
        'twilio_account_sid': twilio_account_sid,
        'twilio_auth_token': twilio_auth_token,
        'twilio_phone_number': twilio_phone_number,
        'company_name': 'Ross Tax Preparation',
        'company_phone': '806-934-2018',
        'company_address': '305 Bruce Ave, Dumas, TX 79029',
        'company_email': 'info@rosstaxpreparation.com',
    }
    
    await db.api_config.update_one(
        {'_id': 'main'},
        {'$set': config},
        upsert=True
    )
    
    client.close()
    
    return {
        'success': True,
        'message': 'API config created/updated',
        'sendgrid_configured': bool(sendgrid_api_key),
        'twilio_configured': bool(twilio_account_sid and twilio_auth_token),
        'twilio_phone': twilio_phone_number,
        'mongo_url_configured': bool(mongo_url),
        'mongo_url_preview': mongo_url[:30] + '...' if mongo_url else None
    }

@setup_router.get('/admin/verify-notifications')
async def verify_notifications():
    """
    Verificar si la configuración existe en la base de datos
    """
    mongo_url = os.getenv('MONGO_URL')
    db_name = os.getenv('DB_NAME', 'taxportal')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Try to read config
    config_doc = await db.api_config.find_one({'_id': 'main'})
    
    client.close()
    
    if config_doc:
        return {
            'success': True,
            'config_found': True,
            'has_twilio': bool(config_doc.get('twilio_account_sid')),
            'has_sendgrid': bool(config_doc.get('sendgrid_api_key')),
            'twilio_phone': config_doc.get('twilio_phone_number', 'Not set')
        }
    else:
        return {
            'success': False,
            'config_found': False,
            'message': 'No config found in database'
        }
