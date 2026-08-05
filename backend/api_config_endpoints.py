"""
API Configuration Endpoints - Admin endpoints para gestionar credenciales
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from database import get_database
from server import require_admin
from api_config_service import APIConfigService
from api_config_models import (
    APIProvider, APIEnvironment, APIConfigCreate,
    APIConfigResponse, AuthorizeNetCredentials,
    AuthorizeNetConfigRequest, PaymentGatewayStatus
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/api-config", tags=["Admin - API Configuration"])

# Dependency para obtener el servicio
def get_api_config_service(db: AsyncIOMotorDatabase = Depends(get_database)) -> APIConfigService:
    return APIConfigService(db)

@router.post("/authorize-net", response_model=APIConfigResponse)
async def configure_authorize_net(
    config: AuthorizeNetConfigRequest,
    service: APIConfigService = Depends(get_api_config_service),
    admin = Depends(require_admin)
):
    """
    Configurar credenciales de Authorize.net (Admin only)
    
    - **environment**: 'production' o 'sandbox'
    - **credentials**: API Login ID, Transaction Key, etc.
    - **is_active**: Si es la configuración activa
    """
    
    # Convertir a formato genérico
    api_config = APIConfigCreate(
        provider=APIProvider.AUTHORIZE_NET,
        environment=config.environment,
        is_active=config.is_active,
        credentials={
            "api_login_id": config.credentials.api_login_id,
            "transaction_key": config.credentials.transaction_key,
            "signature_key": config.credentials.signature_key or "",
            "public_client_key": config.credentials.public_client_key or ""
        },
        metadata={
            "configured_by": admin.get("id"),
            "configured_at": str(config.environment)
        }
    )
    
    result = await service.create_or_update_config(APIProvider.AUTHORIZE_NET, api_config)
    logger.info(f"✅ Authorize.net configured by admin {admin.get('email')} - Environment: {config.environment.value}")
    
    return result

@router.get("/authorize-net", response_model=List[APIConfigResponse])
async def get_authorize_net_configs(
    service: APIConfigService = Depends(get_api_config_service),
    admin = Depends(require_admin)
):
    """
    Obtener todas las configuraciones de Authorize.net (Admin only)
    """
    configs = await service.list_configs(APIProvider.AUTHORIZE_NET)
    return configs

@router.get("/authorize-net/{environment}", response_model=APIConfigResponse)
async def get_authorize_net_config(
    environment: APIEnvironment,
    service: APIConfigService = Depends(get_api_config_service),
    admin = Depends(require_admin)
):
    """
    Obtener configuración específica de Authorize.net (Admin only)
    """
    config = await service.get_config(APIProvider.AUTHORIZE_NET, environment)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No configuration found for Authorize.net {environment.value}"
        )
    return config

@router.post("/authorize-net/{environment}/activate", response_model=dict)
async def activate_authorize_net_environment(
    environment: APIEnvironment,
    service: APIConfigService = Depends(get_api_config_service),
    admin = Depends(require_admin)
):
    """
    Activar un ambiente específico de Authorize.net (Admin only)
    Esto desactivará automáticamente los demás ambientes
    """
    success = await service.set_active_config(APIProvider.AUTHORIZE_NET, environment)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuration not found for {environment.value}"
        )
    
    logger.info(f"✅ Authorize.net {environment.value} activated by admin {admin.get('email')}")
    
    return {
        "success": True,
        "message": f"Authorize.net {environment.value} environment activated",
        "active_environment": environment.value
    }

@router.delete("/authorize-net/{environment}", response_model=dict)
async def delete_authorize_net_config(
    environment: APIEnvironment,
    service: APIConfigService = Depends(get_api_config_service),
    admin = Depends(require_admin)
):
    """
    Eliminar configuración de Authorize.net (Admin only)
    """
    success = await service.delete_config(APIProvider.AUTHORIZE_NET, environment)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuration not found for {environment.value}"
        )
    
    logger.info(f"🗑️ Authorize.net {environment.value} deleted by admin {admin.get('email')}")
    
    return {
        "success": True,
        "message": f"Configuration for {environment.value} deleted"
    }

@router.get("/payment-gateway/status", response_model=PaymentGatewayStatus)
async def get_payment_gateway_status(
    service: APIConfigService = Depends(get_api_config_service),
    db: AsyncIOMotorDatabase = Depends(get_database),
    admin = Depends(require_admin)
):
    """
    Obtener estado actual del gateway de pagos (Admin only)
    """
    # Obtener configuración activa
    active_config = await service.get_active_config(APIProvider.AUTHORIZE_NET)
    
    if not active_config:
        return PaymentGatewayStatus(
            provider=APIProvider.AUTHORIZE_NET,
            environment=APIEnvironment.SANDBOX,
            is_active=False,
            is_configured=False,
            last_transaction_at=None,
            total_transactions=0
        )
    
    environment, credentials = active_config
    
    # Contar transacciones
    total_transactions = await db.ach_authorizations.count_documents({})
    
    # Última transacción
    last_transaction = await db.ach_authorizations.find_one(
        {},
        sort=[("created_at", -1)]
    )
    
    return PaymentGatewayStatus(
        provider=APIProvider.AUTHORIZE_NET,
        environment=environment,
        is_active=True,
        is_configured=bool(credentials.get("api_login_id")),
        last_transaction_at=last_transaction.get("created_at") if last_transaction else None,
        total_transactions=total_transactions
    )

logger.info("✅ API Configuration endpoints initialized")
