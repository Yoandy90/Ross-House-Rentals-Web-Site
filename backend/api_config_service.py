"""
API Configuration Service - Gestión de credenciales de servicios externos
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging
from cryptography.fernet import Fernet
import os
import base64

from api_config_models import (
    APIProvider, APIEnvironment, APIConfigCreate, 
    APIConfigUpdate, APIConfigResponse, AuthorizeNetCredentials
)

logger = logging.getLogger(__name__)

class APIConfigService:
    """Servicio para gestionar configuraciones de APIs externas"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.api_configurations
        
        # Encriptación de credenciales
        # En producción, esta key debería venir de una variable de entorno segura
        encryption_key = os.getenv('API_CREDENTIALS_ENCRYPTION_KEY')
        if not encryption_key:
            # Generar una key temporal (en producción usar una key persistente)
            encryption_key = Fernet.generate_key().decode()
            logger.warning("⚠️ Usando encryption key temporal - Configurar API_CREDENTIALS_ENCRYPTION_KEY en producción")
        
        self.cipher = Fernet(encryption_key.encode() if isinstance(encryption_key, str) else encryption_key)
        
        logger.info("✅ API Configuration Service initialized")
    
    def _encrypt_credentials(self, credentials: Dict[str, str]) -> Dict[str, str]:
        """Encripta las credenciales"""
        encrypted = {}
        for key, value in credentials.items():
            if value:
                encrypted[key] = self.cipher.encrypt(value.encode()).decode()
        return encrypted
    
    def _decrypt_credentials(self, encrypted_credentials: Dict[str, str]) -> Dict[str, str]:
        """Desencripta las credenciales"""
        decrypted = {}
        for key, value in encrypted_credentials.items():
            if value:
                try:
                    decrypted[key] = self.cipher.decrypt(value.encode()).decode()
                except Exception as e:
                    logger.error(f"Error decrypting {key}: {str(e)}")
                    decrypted[key] = None
        return decrypted
    
    def _mask_credentials(self, credentials: Dict[str, str]) -> Dict[str, str]:
        """Enmascara las credenciales para mostrar en UI"""
        masked = {}
        for key, value in credentials.items():
            if value and len(value) > 8:
                masked[key] = f"{value[:4]}...{value[-4:]}"
            elif value:
                masked[key] = "***"
            else:
                masked[key] = None
        return masked
    
    async def create_or_update_config(
        self, 
        provider: APIProvider, 
        config: APIConfigCreate
    ) -> APIConfigResponse:
        """Crea o actualiza una configuración de API"""
        
        # Encriptar credenciales
        encrypted_credentials = self._encrypt_credentials(config.credentials)
        
        # Buscar configuración existente
        existing = await self.collection.find_one({
            "provider": provider.value,
            "environment": config.environment.value
        })
        
        now = datetime.utcnow()
        
        if existing:
            # Actualizar existente
            update_data = {
                "credentials": encrypted_credentials,
                "is_active": config.is_active,
                "metadata": config.metadata,
                "updated_at": now
            }
            
            await self.collection.update_one(
                {"_id": existing["_id"]},
                {"$set": update_data}
            )
            
            config_id = str(existing["_id"])
            logger.info(f"✅ Configuración actualizada: {provider.value} ({config.environment.value})")
        else:
            # Crear nueva
            config_data = {
                "provider": provider.value,
                "environment": config.environment.value,
                "credentials": encrypted_credentials,
                "is_active": config.is_active,
                "metadata": config.metadata,
                "created_at": now,
                "updated_at": now,
                "last_used_at": None
            }
            
            result = await self.collection.insert_one(config_data)
            config_id = str(result.inserted_id)
            logger.info(f"✅ Configuración creada: {provider.value} ({config.environment.value})")
        
        # Retornar configuración
        return await self.get_config(provider, config.environment)
    
    async def get_config(
        self, 
        provider: APIProvider, 
        environment: APIEnvironment
    ) -> Optional[APIConfigResponse]:
        """Obtiene una configuración específica"""
        
        config = await self.collection.find_one({
            "provider": provider.value,
            "environment": environment.value
        })
        
        if not config:
            return None
        
        # Desencriptar credenciales para uso interno (no se exponen en el response)
        decrypted = self._decrypt_credentials(config["credentials"])
        
        return APIConfigResponse(
            id=str(config["_id"]),
            provider=APIProvider(config["provider"]),
            environment=APIEnvironment(config["environment"]),
            is_active=config["is_active"],
            credentials_set=bool(config["credentials"]),
            masked_credentials=self._mask_credentials(decrypted),
            metadata=config.get("metadata", {}),
            created_at=config["created_at"],
            updated_at=config["updated_at"],
            last_used_at=config.get("last_used_at")
        )
    
    async def get_active_config(
        self, 
        provider: APIProvider
    ) -> Optional[tuple[APIEnvironment, Dict[str, str]]]:
        """Obtiene la configuración activa de un proveedor con credenciales desencriptadas"""
        
        config = await self.collection.find_one({
            "provider": provider.value,
            "is_active": True
        })
        
        if not config:
            logger.warning(f"⚠️ No hay configuración activa para {provider.value}")
            return None
        
        # Desencriptar credenciales
        decrypted = self._decrypt_credentials(config["credentials"])
        environment = APIEnvironment(config["environment"])
        
        # Actualizar last_used_at
        await self.collection.update_one(
            {"_id": config["_id"]},
            {"$set": {"last_used_at": datetime.utcnow()}}
        )
        
        logger.info(f"📋 Configuración activa: {provider.value} ({environment.value})")
        return (environment, decrypted)
    
    async def list_configs(
        self, 
        provider: Optional[APIProvider] = None
    ) -> List[APIConfigResponse]:
        """Lista todas las configuraciones"""
        
        query = {}
        if provider:
            query["provider"] = provider.value
        
        configs = await self.collection.find(query).to_list(None)
        
        result = []
        for config in configs:
            decrypted = self._decrypt_credentials(config["credentials"])
            result.append(APIConfigResponse(
                id=str(config["_id"]),
                provider=APIProvider(config["provider"]),
                environment=APIEnvironment(config["environment"]),
                is_active=config["is_active"],
                credentials_set=bool(config["credentials"]),
                masked_credentials=self._mask_credentials(decrypted),
                metadata=config.get("metadata", {}),
                created_at=config["created_at"],
                updated_at=config["updated_at"],
                last_used_at=config.get("last_used_at")
            ))
        
        return result
    
    async def set_active_config(
        self, 
        provider: APIProvider, 
        environment: APIEnvironment
    ) -> bool:
        """Activa una configuración específica (desactiva las demás del mismo proveedor)"""
        
        # Desactivar todas las configuraciones del proveedor
        await self.collection.update_many(
            {"provider": provider.value},
            {"$set": {"is_active": False}}
        )
        
        # Activar la configuración específica
        result = await self.collection.update_one(
            {
                "provider": provider.value,
                "environment": environment.value
            },
            {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count > 0:
            logger.info(f"✅ Configuración activada: {provider.value} ({environment.value})")
            return True
        
        return False
    
    async def delete_config(
        self, 
        provider: APIProvider, 
        environment: APIEnvironment
    ) -> bool:
        """Elimina una configuración"""
        
        result = await self.collection.delete_one({
            "provider": provider.value,
            "environment": environment.value
        })
        
        if result.deleted_count > 0:
            logger.info(f"🗑️ Configuración eliminada: {provider.value} ({environment.value})")
            return True
        
        return False
