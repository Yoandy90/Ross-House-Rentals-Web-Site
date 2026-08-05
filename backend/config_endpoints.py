"""
Configuration Management Endpoints
Admin panel para gestionar todas las APIs y configuraciones
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel

from server import get_current_user, db
from config_manager import init_config_manager, get_config_manager

logger = logging.getLogger(__name__)

# Inicializar config manager
config_manager = init_config_manager(db)

router = APIRouter(prefix="/api/admin/config", tags=["config"])

# Models
class ConfigUpdate(BaseModel):
    key: str
    value: Any

class ConfigTest(BaseModel):
    service: str  # 'twilio' | 'sendgrid' | 'stripe'

@router.get("")
async def get_all_configurations(
    current_user: dict = Depends(get_current_user)
):
    """Obtiene todas las configuraciones (valores ofuscados)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        configs = await config_manager.get_all_configs()
        
        return {
            "success": True,
            "configs": configs
        }
    except Exception as e:
        logger.error(f"Error getting configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{key}")
async def get_configuration(
    key: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene una configuración específica"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        value = await config_manager.get_config(key)
        
        # Ofuscar si es sensible
        sensitive_keys = [
            'auth_token', 'api_key', 'secret_key', 'password', 
            'token', 'credentials'
        ]
        
        is_sensitive = any(s in key.lower() for s in sensitive_keys)
        
        if is_sensitive and value:
            value = str(value)
            if len(value) > 8:
                value = value[:4] + '****' + value[-4:]
        
        return {
            "success": True,
            "key": key,
            "value": value,
            "is_sensitive": is_sensitive
        }
    except Exception as e:
        logger.error(f"Error getting config {key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def update_configuration(
    config: ConfigUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Actualiza o crea una configuración"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        success = await config_manager.set_config(config.key, config.value)
        
        if success:
            return {
                "success": True,
                "message": f"Configuration '{config.key}' updated successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update configuration")
            
    except Exception as e:
        logger.error(f"Error updating config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{key}")
async def delete_configuration(
    key: str,
    current_user: dict = Depends(get_current_user)
):
    """Elimina una configuración"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        success = await config_manager.delete_config(key)
        
        if success:
            return {
                "success": True,
                "message": f"Configuration '{key}' deleted successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to delete configuration")
            
    except Exception as e:
        logger.error(f"Error deleting config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test")
async def test_service_configuration(
    test_data: ConfigTest,
    current_user: dict = Depends(get_current_user)
):
    """Prueba la configuración de un servicio"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        if test_data.service == 'twilio':
            result = await config_manager.test_twilio()
        elif test_data.service == 'sendgrid':
            result = await config_manager.test_sendgrid()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown service: {test_data.service}")
        
        return result
            
    except Exception as e:
        logger.error(f"Error testing service: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/initialize")
async def initialize_from_env(
    current_user: dict = Depends(get_current_user)
):
    """Inicializa configuraciones desde .env"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        await config_manager.initialize_from_env()
        
        return {
            "success": True,
            "message": "Configurations initialized from environment variables"
        }
    except Exception as e:
        logger.error(f"Error initializing configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch")
async def batch_update_configurations(
    configs: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Actualiza múltiples configuraciones a la vez"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access")
    
    try:
        results = []
        
        for key, value in configs.items():
            success = await config_manager.set_config(key, value)
            results.append({
                "key": key,
                "success": success
            })
        
        all_success = all(r['success'] for r in results)
        
        return {
            "success": all_success,
            "message": f"Updated {len(results)} configurations",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error batch updating configs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

logger.info("✅ Configuration endpoints initialized")
