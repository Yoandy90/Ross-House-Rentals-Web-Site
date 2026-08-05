from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel
from typing import Optional
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rise-crm", tags=["Rise CRM Integration"])

# Import auth functions directly
try:
    from server import require_admin, get_current_user
    require_admin_func = require_admin
    get_current_user_func = get_current_user
except ImportError:
    # Fallback placeholders if server not available yet
    async def require_admin_func(authorization: Optional[str] = Header(None)):
        raise HTTPException(status_code=500, detail="Auth not initialized")
    
    async def get_current_user_func(authorization: Optional[str] = Header(None)):
        raise HTTPException(status_code=500, detail="Auth not initialized")

# Request models
class SyncUserRequest(BaseModel):
    user_id: str
    force: Optional[bool] = False

class SyncAppointmentRequest(BaseModel):
    appointment_id: str

class CreateTicketRequest(BaseModel):
    title: str
    message: str

class TestConnectionRequest(BaseModel):
    pass

# ============= ADMIN ENDPOINTS =============

@router.post("/test-connection")
async def test_rise_crm_connection(current_user: dict = Depends(require_admin_func)):
    """Test connection to Rise CRM API"""
    try:
        from rise_crm_service import rise_crm_service
        
        logger.info("🔍 Testing Rise CRM API connection...")
        
        # Test API connection using ticket_type endpoint (simple GET that exists)
        result = await rise_crm_service._call_rise_api('/index.php/api/ticket_types', 'GET')
        
        if result is not None:
            return {
                'success': True,
                'message': 'Successfully connected to Rise CRM API',
                'url': rise_crm_service.base_url,
                'auth_method': 'API Token' if rise_crm_service.api_token else 'Session',
                'api_response': result
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to connect to Rise CRM API - no response")
            
    except Exception as e:
        logger.error(f"❌ Connection test failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection test failed: {str(e)}")

@router.get("/sync/status")
async def get_sync_status(current_user: dict = Depends(require_admin_func)):
    """Get sync status and statistics"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        status = await rise_sync_service.get_sync_status()
        return status
        
    except Exception as e:
        logger.error(f"❌ Error getting sync status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/user")
async def sync_user(
    request: SyncUserRequest,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a specific user to Rise CRM"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        result = await rise_sync_service.sync_user_to_rise(request.user_id, request.force)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ User sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/users/all")
async def sync_all_users(
    limit: int = 100,
    current_user: dict = Depends(require_admin_func)
):
    """Sync all users to Rise CRM"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        result = await rise_sync_service.sync_all_users(limit)
        return result
        
    except Exception as e:
        logger.error(f"❌ Bulk sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/appointment")
async def sync_appointment(
    request: SyncAppointmentRequest,
    current_user: dict = Depends(require_admin_func)
):
    """Sync an appointment to Rise CRM"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        result = await rise_sync_service.sync_appointment_to_rise(request.appointment_id)
        
        if result['success']:
            return result
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Appointment sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/document")
async def sync_document(
    request: Request,
    document_id: str = None,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a document to Rise CRM as a task
    Accepts document_id as query parameter or in JSON body"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        # Try to get document_id from query param first, then from body
        if not document_id:
            try:
                body = await request.json()
                document_id = body.get('document_id')
            except:
                pass
        
        if not document_id:
            raise HTTPException(status_code=400, detail="document_id is required (query param or JSON body)")
        
        logger.info(f"📄 Syncing document {document_id} to Rise CRM...")
        result = await rise_sync_service.sync_document_to_rise(document_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Document synced successfully as task',
                'task_id': result.get('task_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Document sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/payment")
async def sync_payment(
    payment_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a payment to Rise CRM as an invoice"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"💰 Syncing payment {payment_id} to Rise CRM...")
        result = await rise_sync_service.sync_payment_to_rise(payment_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Payment synced successfully as invoice',
                'invoice_id': result.get('invoice_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Payment sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/documents/all")
async def sync_all_documents(
    user_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_admin_func)
):
    """Sync all documents (or all documents for a specific user) to Rise CRM"""
    try:
        from rise_crm_sync_service import rise_sync_service
        from server import db
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        # Build query
        query = {}
        if user_id:
            query['user_id'] = user_id
        
        # Get documents
        documents = await db.documents.find(query).limit(limit).to_list(length=limit)
        
        results = {
            'total': len(documents),
            'success': 0,
            'failed': 0,
            'details': []
        }
        
        for doc in documents:
            try:
                result = await rise_sync_service.sync_document_to_rise(doc['id'])
                if result['success']:
                    results['success'] += 1
                else:
                    results['failed'] += 1
                
                results['details'].append({
                    'document_id': doc['id'],
                    'category': doc.get('category'),
                    'result': result
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'document_id': doc['id'],
                    'error': str(e)
                })
        
        return results
        
    except Exception as e:
        logger.error(f"❌ Bulk document sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/payments/all")
async def sync_all_payments(
    user_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(require_admin_func)
):
    """Sync all payments (or all payments for a specific user) to Rise CRM"""
    try:
        from rise_crm_sync_service import rise_sync_service
        from server import db
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        # Build query for successful credit transactions (payments)
        query = {
            'transaction_type': 'purchase',
            'status': 'completed'
        }
        if user_id:
            query['user_id'] = user_id
        
        # Get transactions
        transactions = await db.credit_transactions.find(query).limit(limit).to_list(length=limit)
        
        results = {
            'total': len(transactions),
            'success': 0,
            'failed': 0,
            'details': []
        }
        
        for txn in transactions:
            try:
                result = await rise_sync_service.sync_payment_to_rise(txn['id'])
                if result['success']:
                    results['success'] += 1
                else:
                    results['failed'] += 1
                
                results['details'].append({
                    'transaction_id': txn['id'],
                    'amount': txn.get('amount'),
                    'result': result
                })
            except Exception as e:
                results['failed'] += 1
                results['details'].append({
                    'transaction_id': txn['id'],
                    'error': str(e)
                })
        
        return results
        
    except Exception as e:
        logger.error(f"❌ Bulk payment sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/service-request")
async def sync_service_request(
    service_request_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a service request to Rise CRM as a ticket"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"🎫 Syncing service request {service_request_id} to Rise CRM...")
        result = await rise_sync_service.sync_service_request_to_rise(service_request_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Service request synced successfully as ticket',
                'ticket_id': result.get('ticket_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Service request sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/loan-application")
async def sync_loan_application(
    loan_app_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a loan application to Rise CRM as a project with tasks"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"💰 Syncing loan application {loan_app_id} to Rise CRM...")
        result = await rise_sync_service.sync_loan_application_to_rise(loan_app_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Loan application synced successfully as project',
                'project_id': result.get('project_id'),
                'tasks_created': result.get('tasks_created', 0)
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Loan application sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/document-request")
async def sync_document_request(
    doc_request_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a document request to Rise CRM as a pending task"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"📋 Syncing document request {doc_request_id} to Rise CRM...")
        result = await rise_sync_service.sync_document_request_to_rise(doc_request_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Document request synced successfully as task',
                'task_id': result.get('task_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Document request sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/chat-message")
async def sync_chat_message(
    message_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a chat message to Rise CRM as a ticket"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"💬 Syncing chat message {message_id} to Rise CRM...")
        result = await rise_sync_service.sync_chat_message_to_rise(message_id)
        
        if result['success']:
            return {
                'success': True,
                'message': result.get('message', 'Chat message synced successfully as ticket'),
                'ticket_id': result.get('ticket_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Chat message sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/referral")
async def sync_referral(
    referral_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a referral to Rise CRM as a client note"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"🤝 Syncing referral {referral_id} to Rise CRM...")
        result = await rise_sync_service.sync_referral_to_rise(referral_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Referral synced successfully as note',
                'task_id': result.get('task_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Referral sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/whatsapp-message")
async def sync_whatsapp_message(
    message_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a WhatsApp message to Rise CRM as communication log"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"📱 Syncing WhatsApp message {message_id} to Rise CRM...")
        result = await rise_sync_service.sync_whatsapp_message_to_rise(message_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'WhatsApp message synced successfully as ticket',
                'ticket_id': result.get('ticket_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ WhatsApp message sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync/tax-return")
async def sync_tax_return(
    tax_return_id: str,
    current_user: dict = Depends(require_admin_func)
):
    """Sync a completed tax return to Rise CRM as closed project"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        logger.info(f"📊 Syncing tax return {tax_return_id} to Rise CRM...")
        result = await rise_sync_service.sync_tax_return_to_rise(tax_return_id)
        
        if result['success']:
            return {
                'success': True,
                'message': 'Tax return synced successfully as completed project',
                'project_id': result.get('project_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Sync failed'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Tax return sync error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sync/logs")
async def get_sync_logs(
    limit: int = 50,
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(require_admin_func)
):
    """Get sync logs"""
    try:
        from server import db
        
        query = {}
        if entity_type:
            query['entity_type'] = entity_type
        if status:
            query['status'] = status
        
        logs = await db.rise_sync_logs.find(query).sort('sync_timestamp', -1).limit(limit).to_list(length=limit)
        
        # Convert ObjectId to string for JSON serialization
        for log in logs:
            if '_id' in log:
                log['_id'] = str(log['_id'])
            if 'sync_timestamp' in log and hasattr(log['sync_timestamp'], 'isoformat'):
                log['sync_timestamp'] = log['sync_timestamp'].isoformat()
        
        return {
            'success': True,
            'logs': logs,
            'count': len(logs)
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= CLIENT ENDPOINTS =============

@router.post("/ticket/create")
async def create_support_ticket(
    request: CreateTicketRequest,
    current_user: dict = Depends(get_current_user_func)
):
    """Create a support ticket in Rise CRM from client"""
    try:
        from rise_crm_sync_service import rise_sync_service
        
        if not rise_sync_service:
            raise HTTPException(status_code=500, detail="Sync service not initialized")
        
        result = await rise_sync_service.create_rise_ticket_from_chat(
            user_id=current_user['id'],
            message=request.message,
            title=request.title
        )
        
        if result['success']:
            return {
                'success': True,
                'message': 'Support ticket created successfully',
                'ticket_id': result.get('ticket_id')
            }
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Failed to create ticket'))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ticket creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-sync-status")
async def get_my_sync_status(current_user: dict = Depends(get_current_user_func)):
    """Get sync status for current user"""
    try:
        from server import db
        
        # Check if user is synced
        user = await db.users.find_one({'id': current_user['id']})
        
        is_synced = user.get('rise_crm_id') is not None
        
        # Get sync logs for this user
        logs = await db.rise_sync_logs.find({
            'ross_tax_id': current_user['id']
        }).sort('sync_timestamp', -1).limit(5).to_list(length=5)
        
        return {
            'success': True,
            'is_synced': is_synced,
            'rise_crm_id': user.get('rise_crm_id'),
            'sync_logs': logs
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting user sync status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============= WEBHOOK ENDPOINT (for Rise CRM to notify us of changes) =============

@router.post("/webhook")
async def rise_crm_webhook(payload: dict):
    """Receive webhooks from Rise CRM about changes - BIDIRECTIONAL SYNC"""
    try:
        event_type = payload.get('event') or payload.get('event_type')
        logger.info(f"📨 Received Rise CRM webhook: {event_type}")
        
        # Log webhook
        from server import db
        await db.rise_webhooks.insert_one({
            'event_type': event_type,
            'payload': payload,
            'received_at': datetime.utcnow(),
            'processed': False
        })
        
        # Process webhook with handler
        from rise_crm_webhook_handler import webhook_handler
        if webhook_handler:
            result = await webhook_handler.handle_webhook(event_type, payload)
            
            # Update webhook log with result
            await db.rise_webhooks.update_one(
                {'_id': (await db.rise_webhooks.find_one({'event_type': event_type}, sort=[('_id', -1)]))['_id']},
                {'$set': {'processed': True, 'result': result}}
            )
            
            return {'success': True, 'message': 'Webhook processed', 'result': result}
        else:
            logger.warning("⚠️ Webhook handler not initialized")
            return {'success': False, 'message': 'Webhook handler not available'}
        
    except Exception as e:
        logger.error(f"❌ Webhook processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= ZAPIER WEBHOOK ENDPOINTS =============

class ZapierWebhookSecret(BaseModel):
    secret: Optional[str] = None

@router.post("/zapier/send-appointment")
async def send_appointment_to_zapier(
    appointment_id: str,
    zapier_webhook_url: str,
    current_user: dict = Depends(require_admin_func)
):
    """
    Send appointment data to Zapier webhook
    This endpoint formats appointment data and sends it to a Zapier webhook URL
    which can then create the appointment in Rise CRM
    """
    try:
        import httpx
        from server import db
        
        logger.info(f"📤 Sending appointment {appointment_id} to Zapier...")
        
        # Get appointment from database
        appointment = await db.appointments.find_one({'id': appointment_id})
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Get user info
        user_id = appointment.get('user_id')
        user = await db.users.find_one({'_id': user_id})
        if not user:
            user = await db.users.find_one({'id': user_id})
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Format data for Zapier
        zapier_data = {
            'appointment_id': appointment.get('id'),
            'user_email': user.get('email'),
            'user_name': user.get('name'),
            'user_phone': user.get('phone', ''),
            'appointment_date': appointment.get('date'),
            'appointment_time': appointment.get('time'),
            'appointment_type': appointment.get('type', 'Tax Consultation'),
            'tax_year': appointment.get('tax_year', 2024),
            'notes': appointment.get('notes', ''),
            'status': appointment.get('status', 'scheduled'),
            'created_at': appointment.get('created_at').isoformat() if appointment.get('created_at') else datetime.utcnow().isoformat(),
            'project_title': f"Tax Return {appointment.get('tax_year', 2024)} - {user.get('name')}",
            'project_description': f"Appointment scheduled for {appointment.get('date')} at {appointment.get('time')}"
        }
        
        # Send to Zapier webhook
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                zapier_webhook_url,
                json=zapier_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code in [200, 201, 202]:
                logger.info(f"✅ Appointment sent to Zapier successfully")
                
                # Log the webhook send
                await db.zapier_webhook_logs.insert_one({
                    'entity_type': 'appointment',
                    'entity_id': appointment_id,
                    'direction': 'rosstax_to_zapier',
                    'webhook_url': zapier_webhook_url,
                    'payload': zapier_data,
                    'response_status': response.status_code,
                    'response_body': response.text,
                    'sent_at': datetime.utcnow()
                })
                
                return {
                    'success': True,
                    'message': 'Appointment sent to Zapier',
                    'zapier_response_status': response.status_code
                }
            else:
                logger.error(f"❌ Zapier webhook returned {response.status_code}: {response.text}")
                raise HTTPException(status_code=500, detail=f"Zapier webhook failed: {response.text}")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error sending appointment to Zapier: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/zapier/receive-from-rise")
async def receive_rise_data_from_zapier(
    request: Request,
    x_zapier_secret: Optional[str] = Header(None)
):
    """
    Receive data from Rise CRM via Zapier webhook
    This endpoint receives appointments, clients, or other data from Rise CRM through Zapier
    """
    try:
        from server import db
        
        # Get JSON payload
        payload = await request.json()
        
        logger.info(f"📥 Received data from Zapier: {payload.get('entity_type', 'unknown')}")
        
        # Validate Zapier secret if configured
        expected_secret = os.getenv('ZAPIER_WEBHOOK_SECRET')
        if expected_secret and x_zapier_secret != expected_secret:
            logger.warning("⚠️ Invalid Zapier webhook secret")
            raise HTTPException(status_code=401, detail="Invalid webhook secret")
        
        # Log the webhook receipt
        await db.zapier_webhook_logs.insert_one({
            'direction': 'zapier_to_rosstax',
            'payload': payload,
            'received_at': datetime.utcnow(),
            'processed': False
        })
        
        # Determine entity type and process accordingly
        entity_type = payload.get('entity_type', 'unknown')
        
        if entity_type == 'appointment':
            # Process appointment from Rise CRM
            rise_project_id = payload.get('rise_project_id')
            appointment_id = payload.get('appointment_id')
            
            if appointment_id:
                # Update existing appointment with Rise CRM project ID
                result = await db.appointments.update_one(
                    {'id': appointment_id},
                    {'$set': {
                        'rise_crm_project_id': rise_project_id,
                        'rise_synced_at': datetime.utcnow()
                    }}
                )
                
                logger.info(f"✅ Updated appointment {appointment_id} with Rise project {rise_project_id}")
                return {'success': True, 'message': 'Appointment updated with Rise CRM data'}
            else:
                logger.warning("⚠️ No appointment_id in payload")
                return {'success': False, 'message': 'No appointment_id provided'}
                
        elif entity_type == 'client':
            # Process client from Rise CRM
            rise_client_id = payload.get('rise_client_id')
            user_email = payload.get('user_email')
            
            if user_email and rise_client_id:
                # Update user with Rise CRM client ID
                result = await db.users.update_one(
                    {'email': user_email},
                    {'$set': {
                        'rise_crm_id': rise_client_id,
                        'rise_synced_at': datetime.utcnow()
                    }}
                )
                
                logger.info(f"✅ Updated user {user_email} with Rise client {rise_client_id}")
                return {'success': True, 'message': 'User updated with Rise CRM data'}
            else:
                logger.warning("⚠️ Missing user_email or rise_client_id in payload")
                return {'success': False, 'message': 'Missing required fields'}
        
        else:
            logger.info(f"ℹ️ Unknown entity type: {entity_type}, storing for later processing")
            return {'success': True, 'message': 'Data received and logged'}
            
    except Exception as e:
        logger.error(f"❌ Error processing Zapier webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zapier/webhook-logs")
async def get_zapier_webhook_logs(
    limit: int = 50,
    direction: Optional[str] = None,
    current_user: dict = Depends(require_admin_func)
):
    """Get Zapier webhook logs for debugging"""
    try:
        from server import db
        
        query = {}
        if direction:
            query['direction'] = direction
        
        logs = await db.zapier_webhook_logs.find(query).sort('received_at', -1).limit(limit).to_list(limit)
        
        # Convert ObjectId to string for JSON serialization
        for log in logs:
            log['_id'] = str(log['_id'])
            if 'received_at' in log:
                log['received_at'] = log['received_at'].isoformat()
            if 'sent_at' in log:
                log['sent_at'] = log['sent_at'].isoformat()
        
        return {'logs': logs, 'count': len(logs)}
        
    except Exception as e:
        logger.error(f"❌ Error getting webhook logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
