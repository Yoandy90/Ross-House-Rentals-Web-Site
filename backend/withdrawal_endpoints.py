"""
Withdrawal Requests Management Endpoints
Handles user withdrawal requests and admin approval/rejection
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import logging

logger = logging.getLogger(__name__)

withdrawal_router = APIRouter()

# Will be injected from server.py
db = None

def init_withdrawal_endpoints(database):
    """Initialize withdrawal endpoints with db"""
    global db
    db = database

# ===================================
# AUTHENTICATION
# ===================================

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current authenticated user from session token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='No autorizado')
    
    token = authorization.replace('Bearer ', '')
    session = await db.user_sessions.find_one({'session_token': token})
    
    if not session:
        raise HTTPException(status_code=401, detail='Sesión inválida')
    
    # Check if session expired
    if session.get('expires_at'):
        from datetime import datetime
        if datetime.fromisoformat(session['expires_at']) < datetime.utcnow():
            await db.user_sessions.delete_one({'session_token': token})
            raise HTTPException(status_code=401, detail='Sesión expirada')
    
    user = await db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=404, detail='Usuario no encontrado')
    
    return {
        'user_id': str(user['_id']),
        'email': user.get('email'),
        'name': user.get('name'),
        'role': user.get('role', 'user'),
        'ross_credits': user.get('ross_credits', 0)
    }
# MODELS
# ===================================

class BankDetails(BaseModel):
    account_name: str
    account_number: str
    routing_number: str
    bank_name: str

class WithdrawalRequestCreate(BaseModel):
    amount: float
    method: str  # bank_transfer, check, paypal, cash
    bank_details: Optional[BankDetails] = None
    paypal_email: Optional[str] = None
    notes: Optional[str] = None

class WithdrawalRequestResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    amount: float
    method: str
    status: str
    bank_details: Optional[dict] = None
    paypal_email: Optional[str] = None
    requested_at: str
    processed_at: Optional[str] = None
    completed_at: Optional[str] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class ApproveWithdrawalRequest(BaseModel):
    admin_notes: Optional[str] = None

class RejectWithdrawalRequest(BaseModel):
    rejection_reason: str
    admin_notes: Optional[str] = None

# ===================================
# USER ENDPOINTS
# ===================================

@withdrawal_router.post('/withdrawal-requests')
async def create_withdrawal_request(
    request: WithdrawalRequestCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new withdrawal request"""
    try:
        # Validate amount
        if request.amount <= 0:
            raise HTTPException(status_code=400, detail='El monto debe ser mayor a 0')
        
        if request.amount < 10:
            raise HTTPException(status_code=400, detail='El monto mínimo de retiro es $10')
        
        # Check user balance (assuming credits service)
        user_balance = current_user.get('ross_credits', 0)
        if user_balance < request.amount:
            raise HTTPException(
                status_code=400,
                detail=f'Saldo insuficiente. Tienes ${user_balance:.2f} disponibles'
            )
        
        # Validate method-specific details
        if request.method == 'bank_transfer' and not request.bank_details:
            raise HTTPException(status_code=400, detail='Detalles bancarios requeridos')
        
        if request.method == 'paypal' and not request.paypal_email:
            raise HTTPException(status_code=400, detail='Email de PayPal requerido')
        
        # Create withdrawal request
        withdrawal_id = str(uuid.uuid4())
        withdrawal_data = {
            'id': withdrawal_id,
            'user_id': current_user['user_id'],
            'user_name': current_user.get('name', current_user.get('email', 'Usuario')),
            'user_email': current_user.get('email', ''),
            'amount': request.amount,
            'method': request.method,
            'status': 'pending',
            'requested_at': datetime.utcnow().isoformat(),
            'notes': request.notes
        }
        
        if request.bank_details:
            withdrawal_data['bank_details'] = request.bank_details.dict()
        
        if request.paypal_email:
            withdrawal_data['paypal_email'] = request.paypal_email
        
        # Save to database
        await db.withdrawal_requests.insert_one(withdrawal_data)
        
        logger.info(f"💰 Withdrawal request created: {withdrawal_id} for user {current_user['user_id']}")
        
        # Remove _id for response
        withdrawal_data.pop('_id', None)
        
        return {
            'success': True,
            'request': withdrawal_data,
            'message': 'Solicitud de retiro creada exitosamente'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating withdrawal request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@withdrawal_router.get('/withdrawal-requests/my-requests')
async def get_my_withdrawal_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's withdrawal requests"""
    try:
        query = {'user_id': current_user['user_id']}
        if status:
            query['status'] = status
        
        requests = await db.withdrawal_requests.find(query).sort('requested_at', -1).to_list(100)
        
        # Remove MongoDB _id
        for req in requests:
            req.pop('_id', None)
        
        return {
            'success': True,
            'requests': requests,
            'total': len(requests)
        }
        
    except Exception as e:
        logger.error(f"Error fetching user withdrawal requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================================
# ADMIN ENDPOINTS
# ===================================

@withdrawal_router.get('/admin/withdrawal-requests')
async def get_all_withdrawal_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all withdrawal requests (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        query = {}
        if status:
            query['status'] = status
        
        requests = await db.withdrawal_requests.find(query).sort('requested_at', -1).to_list(1000)
        
        # Remove MongoDB _id
        for req in requests:
            req.pop('_id', None)
        
        return {
            'success': True,
            'requests': requests,
            'total': len(requests)
        }
        
    except Exception as e:
        logger.error(f"Error fetching withdrawal requests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@withdrawal_router.get('/admin/withdrawal-requests/{request_id}')
async def get_withdrawal_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get specific withdrawal request details (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        request = await db.withdrawal_requests.find_one({'id': request_id})
        if not request:
            raise HTTPException(status_code=404, detail='Solicitud no encontrada')
        
        request.pop('_id', None)
        
        return {
            'success': True,
            'request': request
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching withdrawal request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@withdrawal_router.post('/admin/withdrawal-requests/{request_id}/approve')
async def approve_withdrawal_request(
    request_id: str,
    approval: ApproveWithdrawalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Approve a withdrawal request (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        # Find request
        request = await db.withdrawal_requests.find_one({'id': request_id})
        if not request:
            raise HTTPException(status_code=404, detail='Solicitud no encontrada')
        
        if request['status'] != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f'Solo se pueden aprobar solicitudes pendientes. Estado actual: {request["status"]}'
            )
        
        # Update request status
        update_data = {
            'status': 'approved',
            'processed_at': datetime.utcnow().isoformat(),
            'processed_by': current_user['user_id'],
            'admin_notes': approval.admin_notes
        }
        
        await db.withdrawal_requests.update_one(
            {'id': request_id},
            {'$set': update_data}
        )
        
        # TODO: Deduct amount from user's credit balance
        # This should be integrated with credit_service
        
        # TODO: Send notification to user
        # await notification_service.send_withdrawal_approved_email(...)
        
        logger.info(f"✅ Withdrawal request {request_id} approved by admin {current_user['user_id']}")
        
        return {
            'success': True,
            'message': 'Solicitud aprobada exitosamente'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving withdrawal request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@withdrawal_router.post('/admin/withdrawal-requests/{request_id}/reject')
async def reject_withdrawal_request(
    request_id: str,
    rejection: RejectWithdrawalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reject a withdrawal request (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        # Find request
        request = await db.withdrawal_requests.find_one({'id': request_id})
        if not request:
            raise HTTPException(status_code=404, detail='Solicitud no encontrada')
        
        if request['status'] != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f'Solo se pueden rechazar solicitudes pendientes. Estado actual: {request["status"]}'
            )
        
        # Update request status
        update_data = {
            'status': 'rejected',
            'processed_at': datetime.utcnow().isoformat(),
            'processed_by': current_user['user_id'],
            'rejection_reason': rejection.rejection_reason,
            'admin_notes': rejection.admin_notes
        }
        
        await db.withdrawal_requests.update_one(
            {'id': request_id},
            {'$set': update_data}
        )
        
        # TODO: Send notification to user
        # await notification_service.send_withdrawal_rejected_email(...)
        
        logger.info(f"❌ Withdrawal request {request_id} rejected by admin {current_user['user_id']}")
        
        return {
            'success': True,
            'message': 'Solicitud rechazada'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting withdrawal request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@withdrawal_router.post('/admin/withdrawal-requests/{request_id}/complete')
async def complete_withdrawal_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark withdrawal as completed after payment sent (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        # Find request
        request = await db.withdrawal_requests.find_one({'id': request_id})
        if not request:
            raise HTTPException(status_code=404, detail='Solicitud no encontrada')
        
        if request['status'] != 'approved':
            raise HTTPException(
                status_code=400,
                detail=f'Solo se pueden completar solicitudes aprobadas. Estado actual: {request["status"]}'
            )
        
        # Update request status
        update_data = {
            'status': 'completed',
            'completed_at': datetime.utcnow().isoformat(),
            'completed_by': current_user['user_id']
        }
        
        await db.withdrawal_requests.update_one(
            {'id': request_id},
            {'$set': update_data}
        )
        
        logger.info(f"✅ Withdrawal request {request_id} marked as completed")
        
        return {
            'success': True,
            'message': 'Solicitud marcada como completada'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing withdrawal request: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@withdrawal_router.get('/admin/withdrawal-requests/stats/summary')
async def get_withdrawal_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get withdrawal statistics (admin only)"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        # Count by status
        pending_count = await db.withdrawal_requests.count_documents({'status': 'pending'})
        approved_count = await db.withdrawal_requests.count_documents({'status': 'approved'})
        completed_count = await db.withdrawal_requests.count_documents({'status': 'completed'})
        rejected_count = await db.withdrawal_requests.count_documents({'status': 'rejected'})
        
        # Calculate total amounts
        pipeline = [
            {
                '$group': {
                    '_id': '$status',
                    'total_amount': {'$sum': '$amount'},
                    'count': {'$sum': 1}
                }
            }
        ]
        
        amounts = await db.withdrawal_requests.aggregate(pipeline).to_list(100)
        amounts_by_status = {item['_id']: item['total_amount'] for item in amounts}
        
        return {
            'success': True,
            'stats': {
                'counts': {
                    'pending': pending_count,
                    'approved': approved_count,
                    'completed': completed_count,
                    'rejected': rejected_count,
                    'total': pending_count + approved_count + completed_count + rejected_count
                },
                'amounts': {
                    'pending': amounts_by_status.get('pending', 0),
                    'approved': amounts_by_status.get('approved', 0),
                    'completed': amounts_by_status.get('completed', 0),
                    'rejected': amounts_by_status.get('rejected', 0),
                    'total': sum(amounts_by_status.values())
                }
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching withdrawal stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
