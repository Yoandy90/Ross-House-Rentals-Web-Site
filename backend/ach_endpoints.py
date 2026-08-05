"""
ACH Payment Endpoints - Authorize.net Integration
Ross Tax Preparation
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import logging
import hashlib

from ach_models import (
    ACHPaymentRequest,
    ACHPaymentResponse,
    ACHAuthorizationResponse,
    ACHTransactionStatusRequest,
    ACHEventResponse
)
from ach_service import ACHPaymentService

logger = logging.getLogger(__name__)

async def save_ach_as_payment_method(
    db,
    user_id: str,
    routing_number: str,
    account_number: str,
    account_type: str,
    account_holder_name: str,
    authorization_id: str
):
    """
    Guarda información bancaria ACH como método de pago del usuario
    """
    try:
        # Verificar si ya existe este método de pago
        account_last4 = account_number[-4:]
        existing = await db.payment_methods.find_one({
            'user_id': user_id,
            'type': 'bank_account',
            'bank_account_last4': account_last4,
            'routing_number': routing_number
        })
        
        if existing:
            logger.info(f"⚠️ Método de pago ACH ya existe para usuario {user_id}")
            return
        
        # Crear hash único para el método de pago
        unique_string = f"{user_id}:{routing_number}:{account_number}"
        payment_method_id = hashlib.sha256(unique_string.encode()).hexdigest()[:24]
        
        # Verificar si hay otros métodos de pago
        existing_methods = await db.payment_methods.count_documents({'user_id': user_id})
        is_default = existing_methods == 0  # Es default si es el primero
        
        # Crear documento de método de pago
        payment_method = {
            'payment_method_id': payment_method_id,
            'user_id': user_id,
            'type': 'bank_account',
            'bank_account_type': account_type,
            'bank_account_last4': account_last4,
            'routing_number': routing_number,
            'account_holder_name': account_holder_name,
            'is_default': is_default,
            'is_verified': True,  # Ya verificado por ACH
            'ach_authorization_id': authorization_id,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'metadata': {
                'source': 'ach_payment',
                'authorization_date': datetime.utcnow().isoformat()
            }
        }
        
        await db.payment_methods.insert_one(payment_method)
        logger.info(f"✅ Método de pago ACH guardado para usuario {user_id} - ID: {payment_method_id}")
        
    except Exception as e:
        logger.error(f"❌ Error guardando método de pago ACH: {str(e)}")
        raise

ach_router = APIRouter()

# Will be injected from server.py
ach_service: Optional[ACHPaymentService] = None

def init_ach_endpoints(ach_payment_service: ACHPaymentService):
    """Initialize ACH endpoints with service"""
    global ach_service
    ach_service = ach_payment_service
    logger.info("✅ ACH endpoints initialized")

# ===================================
# AUTHENTICATION
# ===================================

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current authenticated user from session token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='No autorizado')
    
    token = authorization.replace('Bearer ', '')
    
    # Obtener sesión y usuario desde el servicio ACH
    if not ach_service or ach_service.db is None:
        raise HTTPException(status_code=500, detail='Servicio no disponible')
    
    session = await ach_service.db.user_sessions.find_one({'session_token': token})
    
    if not session:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    
    from bson import ObjectId
    user = await ach_service.db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    return {
        'user_id': str(user['_id']),
        'email': user.get('email'),
        'name': user.get('name'),
        'phone': user.get('phone')
    }

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin role"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado - Solo administradores')
    return current_user

# ===================================
# NEW ACH ENDPOINTS - Authorize.net Integration
# ===================================

@ach_router.post('/ach/initiate-payment')
async def initiate_ach_payment(
    payment_request: ACHPaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Inicia un pago ACH completo con Authorize.net
    
    Este endpoint maneja todo el flujo:
    1. Validación de datos bancarios
    2. Firma electrónica NACHA
    3. Procesamiento del pago
    4. Generación de PDF de evidencia
    5. Auditoría completa
    """
    logger.info(f"🔍 ACH Payment Request recibido para user: {current_user.get('email', 'unknown')}")
    logger.info(f"📋 Request data: customer_id={payment_request.customer_id}, amount={payment_request.amount_cents}")
    try:
        if not ach_service:
            raise HTTPException(status_code=500, detail='Servicio ACH no disponible')
        
        # Verificar que el customer_id coincida con el usuario autenticado
        # current_user['user_id'] es el user_id correcto del diccionario
        if payment_request.customer_id != current_user['user_id']:
            raise HTTPException(status_code=403, detail='Customer ID no coincide con usuario autenticado')
        
        # Si amount es 0, solo guardar método de pago sin hacer cargo
        if payment_request.amount_cents == 0:
            logger.info("💾 Amount is 0 - Solo guardando método de pago sin cargo")
            
            # Simplemente guardar como método de pago sin crear autorización completa
            try:
                await save_ach_as_payment_method(
                    db=ach_service.db,
                    user_id=current_user['user_id'],
                    routing_number=payment_request.routing_number,
                    account_number=payment_request.account_number,
                    account_type=payment_request.account_type,
                    account_holder_name=payment_request.customer_name,
                    authorization_id=None  # Sin autorización de pago
                )
                logger.info("✅ Método de pago ACH guardado exitosamente sin cargo")
                
                # Retornar resultado exitoso
                from ach_models import ACHPaymentResponse
                return ACHPaymentResponse(
                    success=True,
                    authorization_id=None,
                    transaction_id=None,
                    message="Método de pago ACH guardado exitosamente",
                    amount_cents=0,
                    pdf_url=None
                )
            except Exception as e:
                logger.error(f"❌ Error guardando método de pago: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error guardando método de pago: {str(e)}")
        
        # Si amount > 0, procesar el pago normal
        result = await ach_service.initiate_ach_payment(payment_request)
        
        if result.success:
            logger.info(f"✅ Pago ACH iniciado exitosamente - Auth ID: {result.authorization_id}")
            
            # Guardar como método de pago si no existe
            try:
                await save_ach_as_payment_method(
                    db=ach_service.db,
                    user_id=current_user['user_id'],
                    routing_number=payment_request.routing_number,
                    account_number=payment_request.account_number,
                    account_type=payment_request.account_type,
                    account_holder_name=payment_request.customer_name,
                    authorization_id=result.authorization_id
                )
            except Exception as e:
                logger.error(f"⚠️ Error guardando método de pago ACH: {str(e)}")
                # No falla el flujo principal
        else:
            logger.warning(f"❌ Pago ACH fallido: {result.message}")
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error en endpoint de pago ACH: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error procesando pago: {str(e)}")

@ach_router.get('/ach/authorization/{authorization_id}')
async def get_ach_authorization(
    authorization_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene los detalles de una autorización ACH
    """
    try:
        if not ach_service:
            raise HTTPException(status_code=500, detail='Servicio ACH no disponible')
        
        authorization = await ach_service.get_authorization(authorization_id)
        
        if not authorization:
            raise HTTPException(status_code=404, detail='Autorización no encontrada')
        
        # Verificar que el usuario tenga permiso para ver esta autorización
        if authorization.customer_id != current_user['user_id']:
            raise HTTPException(status_code=403, detail='No autorizado para ver esta autorización')
        
        return {
            'success': True,
            'authorization': authorization
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error obteniendo autorización: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ach_router.get('/ach/authorization/{authorization_id}/events')
async def get_authorization_events(
    authorization_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene el historial de eventos de auditoría de una autorización ACH
    """
    try:
        if not ach_service:
            raise HTTPException(status_code=500, detail='Servicio ACH no disponible')
        
        # Primero verificar que el usuario tenga acceso a esta autorización
        authorization = await ach_service.get_authorization(authorization_id)
        if not authorization:
            raise HTTPException(status_code=404, detail='Autorización no encontrada')
        
        if authorization.customer_id != current_user['user_id']:
            raise HTTPException(status_code=403, detail='No autorizado')
        
        # Obtener eventos
        events = await ach_service.get_authorization_events(authorization_id)
        
        return {
            'success': True,
            'authorization_id': authorization_id,
            'events': events,
            'total': len(events)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error obteniendo eventos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ach_router.get('/ach/test-connection')
async def test_authorizenet_connection():
    """
    Prueba la conexión con Authorize.net
    Endpoint público para verificar configuración
    """
    try:
        if not ach_service:
            raise HTTPException(status_code=500, detail='Servicio ACH no disponible')
        
        result = ach_service.authorize_net.test_connection()
        return result
    
    except Exception as e:
        logger.error(f"❌ Error en test de conexión: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin endpoints
@ach_router.get('/admin/ach/authorizations')
async def admin_get_all_authorizations(
    status: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_admin)
):
    """
    Obtiene todas las autorizaciones ACH (solo admin)
    """
    try:
        if not ach_service:
            raise HTTPException(status_code=500, detail='Servicio ACH no disponible')
        
        query = {}
        if status:
            query['status'] = status
        
        authorizations = await ach_service.authorizations_collection.find(query).sort('created_at', -1).limit(limit).to_list(limit)
        
        # Convertir ObjectId a string
        for auth in authorizations:
            auth['id'] = str(auth.pop('_id'))
        
        return {
            'success': True,
            'authorizations': authorizations,
            'total': len(authorizations)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error obteniendo autorizaciones: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@ach_router.get('/admin/ach/authorization/{authorization_id}/pdf')
async def admin_download_authorization_pdf(
    authorization_id: str,
    current_user: dict = Depends(require_admin)
):
    """
    Descarga el PDF de evidencia de una autorización (solo admin)
    """
    try:
        if not ach_service:
            raise HTTPException(status_code=500, detail='Servicio ACH no disponible')
        
        from fastapi.responses import FileResponse
        import os
        
        authorization = await ach_service.get_authorization(authorization_id)
        
        if not authorization:
            raise HTTPException(status_code=404, detail='Autorización no encontrada')
        
        if not authorization.evidence_pdf_path or not os.path.exists(authorization.evidence_pdf_path):
            raise HTTPException(status_code=404, detail='PDF no encontrado')
        
        return FileResponse(
            path=authorization.evidence_pdf_path,
            filename=f"ach_authorization_{authorization_id}.pdf",
            media_type="application/pdf"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error descargando PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
