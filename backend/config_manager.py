"""
Configuration Manager - Sistema centralizado de configuración
Gestiona todas las APIs y configuraciones desde MongoDB
"""
import logging
import os
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

logger = logging.getLogger(__name__)

class ConfigManager:
    """Gestor centralizado de configuraciones"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.config_collection = db.api_config
        self._cache = {}
        self._cache_timestamp = None
        logger.info("✅ Config Manager initialized")
    
    async def get_config(self, key: str, default: Any = None) -> Any:
        """
        Obtiene una configuración
        Prioridad: MongoDB > .env > default
        """
        try:
            # Intentar de MongoDB primero
            config_doc = await self.config_collection.find_one({})
            
            if config_doc and key in config_doc:
                return config_doc[key]
            
            # Fallback a .env
            env_value = os.getenv(key.upper())
            if env_value:
                return env_value
            
            # Fallback a default
            return default
            
        except Exception as e:
            logger.error(f"Error getting config {key}: {e}")
            return default
    
    async def set_config(self, key: str, value: Any) -> bool:
        """Guarda una configuración en MongoDB"""
        try:
            # Actualizar o crear configuración
            result = await self.config_collection.update_one(
                {},
                {
                    '$set': {
                        key: value,
                        f'{key}_updated_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            
            logger.info(f"✅ Config {key} guardada")
            return True
            
        except Exception as e:
            logger.error(f"Error saving config {key}: {e}")
            return False
    
    async def get_all_configs(self) -> Dict[str, Any]:
        """Obtiene todas las configuraciones (sin valores sensibles completos)"""
        try:
            config_doc = await self.config_collection.find_one({})
            
            if not config_doc:
                return {}
            
            # Remover _id y ofuscar valores sensibles
            config_doc.pop('_id', None)
            
            # Ofuscar credenciales sensibles
            sensitive_keys = [
                'twilio_auth_token',
                'sendgrid_api_key',
                'emergent_llm_key',
                'stripe_secret_key',
                'openai_api_key'
            ]
            
            for key in sensitive_keys:
                if key in config_doc and config_doc[key]:
                    value = str(config_doc[key])
                    if len(value) > 8:
                        config_doc[key] = value[:4] + '****' + value[-4:]
            
            return config_doc
            
        except Exception as e:
            logger.error(f"Error getting all configs: {e}")
            return {}
    
    async def delete_config(self, key: str) -> bool:
        """Elimina una configuración"""
        try:
            await self.config_collection.update_one(
                {},
                {'$unset': {key: ""}}
            )
            logger.info(f"🗑️ Config {key} eliminada")
            return True
        except Exception as e:
            logger.error(f"Error deleting config {key}: {e}")
            return False
    
    async def initialize_from_env(self):
        """Inicializa configuraciones desde .env si no existen en DB"""
        try:
            config_doc = await self.config_collection.find_one({})
            
            # Lista de configuraciones a inicializar
            env_configs = {
                # Twilio
                'twilio_account_sid': 'TWILIO_ACCOUNT_SID',
                'twilio_auth_token': 'TWILIO_AUTH_TOKEN',
                'twilio_phone_number': 'TWILIO_PHONE_NUMBER',
                
                # SendGrid
                'sendgrid_api_key': 'SENDGRID_API_KEY',
                'sendgrid_from_email': 'SENDGRID_FROM_EMAIL',
                
                # OpenAI / Emergent
                'emergent_llm_key': 'EMERGENT_LLM_KEY',
                'openai_api_key': 'OPENAI_API_KEY',
                
                # Stripe
                'stripe_secret_key': 'STRIPE_SECRET_KEY',
                'stripe_publishable_key': 'STRIPE_PUBLISHABLE_KEY',
                
                # URLs
                'backend_url': 'BACKEND_URL',
                'frontend_url': 'FRONTEND_URL',
                
                # Google Calendar
                'google_calendar_credentials': 'GOOGLE_CALENDAR_CREDENTIALS',
                
                # Rise CRM
                'rise_crm_url': 'RISE_CRM_URL',
                'rise_crm_api_token': 'RISE_CRM_API_TOKEN'
            }
            
            updates = {}
            
            for db_key, env_key in env_configs.items():
                # Solo copiar si existe en .env y no existe en DB
                if not config_doc or db_key not in config_doc:
                    env_value = os.getenv(env_key)
                    if env_value:
                        updates[db_key] = env_value
            
            if updates:
                await self.config_collection.update_one(
                    {},
                    {'$set': updates},
                    upsert=True
                )
                logger.info(f"✅ Inicializadas {len(updates)} configuraciones desde .env")
            
        except Exception as e:
            logger.error(f"Error initializing from env: {e}")
    
    async def test_twilio(self) -> Dict[str, Any]:
        """Prueba la configuración de Twilio"""
        try:
            account_sid = await self.get_config('twilio_account_sid')
            auth_token = await self.get_config('twilio_auth_token')
            phone_number = await self.get_config('twilio_phone_number')
            
            if not all([account_sid, auth_token, phone_number]):
                return {
                    'success': False,
                    'message': 'Credenciales incompletas'
                }
            
            # Intentar inicializar cliente Twilio
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            
            # Verificar cuenta
            account = client.api.accounts(account_sid).fetch()
            
            return {
                'success': True,
                'message': 'Twilio configurado correctamente',
                'details': {
                    'account_name': account.friendly_name,
                    'status': account.status,
                    'phone_number': phone_number
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }
    
    async def test_sendgrid(self) -> Dict[str, Any]:
        """Prueba la configuración de SendGrid"""
        try:
            api_key = await self.get_config('sendgrid_api_key')
            
            if not api_key:
                return {
                    'success': False,
                    'message': 'API Key no configurada'
                }
            
            # Intentar inicializar SendGrid
            from sendgrid import SendGridAPIClient
            sg = SendGridAPIClient(api_key)
            
            # Verificar API key
            response = sg.client.api_keys.get()
            
            return {
                'success': True,
                'message': 'SendGrid configurado correctamente'
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error: {str(e)}'
            }

# Instancia global
config_manager = None

def init_config_manager(db: AsyncIOMotorDatabase):
    global config_manager
    config_manager = ConfigManager(db)
    return config_manager

def get_config_manager():
    return config_manager

logger.info("✅ Config Manager module loaded")
