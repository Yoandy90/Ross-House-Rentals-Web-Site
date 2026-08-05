"""
Service Orders Router
Extracted from server.py for modularization.
Handles service order CRUD, status updates, assignment, client projects, and CSV export.
"""
import logging
import uuid
from io import StringIO
import csv
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Body, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger(__name__)

service_orders_router = APIRouter()
_db = None
_notification_service = None


def init_service_orders_router(db, notification_service=None):
    global _db, _notification_service
    _db = db
    _notification_service = notification_service


def update_service_orders_notification(service):
    global _notification_service
    _notification_service = service


async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    now = datetime.now(tz=expires_at.tzinfo if expires_at.tzinfo else timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


async def _require_admin(request: Request):
    """Require admin role"""
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ================== ADMIN - SERVICE ORDERS ==================

@service_orders_router.post('/admin/service-orders')
async def admin_create_service_order(
    order_data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Admin: Create a new service order/project for a client
    """
    try:
        print(f"📋 Creating service order for client: {order_data.get('client_id')}")
        
        # Validate required fields
        if not order_data.get('client_id'):
            raise HTTPException(status_code=400, detail='El ID del cliente es requerido')
        
        if not order_data.get('description'):
            raise HTTPException(status_code=400, detail='La descripción es requerida')
        
        # Verify client exists (allow any role that's not admin)
        client = await _db.users.find_one({'_id': order_data['client_id']})
        if not client:
            # Try with ObjectId
            try:
                client = await _db.users.find_one({'_id': ObjectId(order_data['client_id'])})
            except:
                pass
        
        if not client:
            raise HTTPException(status_code=404, detail='Cliente no encontrado')
        
        # Create service order
        order_id = str(uuid.uuid4())
        client_name = client.get('full_name') or client.get('name') or client.get('email', 'Cliente')
        order_doc = {
            '_id': order_id,
            'order_number': f"ORD-{datetime.now().strftime('%Y%m')}-{str(uuid.uuid4())[:8].upper()}",
            'client_id': order_data['client_id'],
            'client_name': client_name,
            'client_email': client.get('email'),
            'client_phone': client.get('phone'),
            'service_type': order_data.get('service_type', 'tax_preparation'),
            'description': order_data['description'],
            'tax_year': order_data.get('tax_year', datetime.now().year),
            'status': 'pending',  # pending, in_progress, completed, cancelled
            'priority': order_data.get('priority', 'medium'),  # low, medium, high, urgent
            'estimated_amount': order_data.get('estimated_amount', 0),
            'notes': order_data.get('notes', ''),
            'created_by': current_user['id'],
            'created_by_name': current_user.get('name', 'Admin'),
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'assigned_to': order_data.get('assigned_to'),
            'due_date': order_data.get('due_date'),
            'generate_client_invoice': order_data.get('generate_client_invoice', True),
        }
        
        await _db.service_orders.insert_one(order_doc)
        
        # Create notification for client
        try:
            await create_notification(
                user_id=order_data['client_id'],
                title='📋 Nueva Orden de Servicio',
                body=f'Se ha creado una orden de servicio: {order_data["description"]}',
                type='service',
                data={'order_id': order_id, 'order_number': order_doc['order_number']}
            )
        except Exception as e:
            print(f'⚠️ Could not create notification: {str(e)}')
        
        print(f"✅ Service order created: {order_id}")
        
        return {
            'success': True,
            'message': 'Orden de servicio creada exitosamente',
            'order_id': order_id,
            'order_number': order_doc['order_number'],
            'order': {
                'id': order_id,
                'order_number': order_doc['order_number'],
                'client_name': order_doc['client_name'],
                'service_type': order_doc['service_type'],
                'status': order_doc['status'],
                'created_at': order_doc['created_at'].isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error creating service order: {str(e)}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@service_orders_router.get('/admin/service-orders')
async def get_service_orders(
    client_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(_require_admin)
):
    """
    Admin: Get all service orders with filters
    """
    try:
        query = {}
        
        if client_id:
            query['client_id'] = client_id
        
        if status:
            query['status'] = status
        
        if service_type:
            query['service_type'] = service_type
        
        if priority:
            query['priority'] = priority
        
        orders = await _db.service_orders.find(query).sort('created_at', -1).limit(limit).to_list(limit)
        
        # Format orders with document info and ensure client names
        formatted_orders = []
        for order in orders:
            # Get client name if not stored in order
            client_name = order.get('client_name')
            client_email = order.get('client_email')
            client_phone = order.get('client_phone')
            
            # If client_name is missing or generic, fetch from users collection
            if not client_name or client_name in ['Cliente', 'Unknown', '']:
                client_id = order.get('client_id') or order.get('user_id')
                if client_id:
                    client = await _db.users.find_one({'_id': client_id})
                    if not client:
                        try:
                            client = await _db.users.find_one({'_id': ObjectId(client_id)})
                        except:
                            pass
                    if client:
                        client_name = client.get('full_name') or client.get('name') or client.get('email', 'Cliente')
                        client_email = client.get('email')
                        client_phone = client.get('phone')
                        
                        # Update the order in database with correct name
                        await _db.service_orders.update_one(
                            {'_id': order['_id']},
                            {'$set': {
                                'client_name': client_name,
                                'client_email': client_email,
                                'client_phone': client_phone
                            }}
                        )
            
            order_data = {
                'id': str(order['_id']),
                'order_number': order.get('order_number'),
                'client_id': str(order.get('client_id') or order.get('user_id') or ''),
                'user_id': str(order.get('client_id') or order.get('user_id') or ''),  # For frontend compatibility
                'client_name': client_name,
                'user_name': client_name,  # For frontend compatibility
                'client_email': client_email,
                'user_email': client_email,  # For frontend compatibility
                'client_phone': client_phone,
                'service_type': order.get('service_type') or order.get('service_name', ''),
                'description': order.get('description', ''),
                'tax_year': order.get('tax_year') or order.get('fiscal_year', ''),
                'status': order.get('status'),
                'priority': order.get('priority'),
                'estimated_amount': order.get('estimated_amount') or order.get('service_price', 0),
                'notes': order.get('notes'),
                'appointment_id': str(order.get('appointment_id')) if order.get('appointment_id') else None,
                'appointment_date': order.get('appointment_date').isoformat() if isinstance(order.get('appointment_date'), datetime) else order.get('appointment_date'),
                'created_at': order['created_at'].isoformat() if isinstance(order['created_at'], datetime) else str(order.get('created_at', '')),
                'updated_at': order['updated_at'].isoformat() if isinstance(order.get('updated_at'), datetime) else str(order.get('updated_at', ''))
            }
            
            # Get document upload link if appointment exists
            if order.get('appointment_id'):
                appointment = await _db.appointments.find_one({'_id': order['appointment_id']})
                if appointment and appointment.get('management_token'):
                    order_data['documents_url'] = f"https://www.rosstaxpreparation.com/documentos/{appointment['management_token']}"
                    order_data['management_token'] = appointment['management_token']
            
            formatted_orders.append(order_data)
        
        # Calculate stats
        total_count = await _db.service_orders.count_documents({})
        pending_count = await _db.service_orders.count_documents({'status': {'$in': ['pending', 'pending_payment']}})
        in_progress_count = await _db.service_orders.count_documents({'status': {'$in': ['in_progress', 'processing', 'review', 'under_review']}})
        completed_count = await _db.service_orders.count_documents({'status': {'$in': ['completed', 'done']}})
        
        return {
            'success': True,
            'total': len(formatted_orders),
            'orders': formatted_orders,
            'stats': {
                'total': total_count,
                'pending': pending_count,
                'in_progress': in_progress_count,
                'completed': completed_count
            }
        }
        
    except Exception as e:
        print(f'❌ Error getting service orders: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@service_orders_router.patch('/admin/service-orders/{order_id}')
async def update_service_order(
    order_id: str,
    update_data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Admin: Update a service order (status, assignment, payment, timeline, etc.)
    """
    try:
        print(f"📝 Updating service order {order_id}")
        
        # Check order exists - try multiple ID formats
        order = None
        order_filter = None
        try:
            order = await _db.service_orders.find_one({'_id': ObjectId(order_id)})
            if order:
                order_filter = {'_id': ObjectId(order_id)}
        except Exception:
            pass
        if not order:
            order = await _db.service_orders.find_one({'_id': order_id})
            if order:
                order_filter = {'_id': order_id}
        if not order:
            order = await _db.service_orders.find_one({'id': order_id})
            if order:
                order_filter = {'id': order_id}
        if not order:
            raise HTTPException(status_code=404, detail='Orden no encontrada')
        
        # Build update document
        update_doc = {'updated_at': datetime.now(timezone.utc)}
        
        # Allowed fields to update (including new enhanced fields)
        allowed_fields = [
            'status', 'priority', 'assigned_to', 'assigned_to_name', 'notes', 
            'estimated_amount', 'due_date',
            # New enhanced tracking fields
            'payment_status', 'estimated_completion', 'documents_count', 'documents_required',
            # Invoice visibility control
            'generate_client_invoice'
        ]
        for field in allowed_fields:
            if field in update_data:
                update_doc[field] = update_data[field]
        
        # Handle timeline entry addition
        if 'timeline_entry' in update_data:
            timeline_entry = update_data['timeline_entry']
            # Add to existing timeline or create new one
            await _db.service_orders.update_one(
                order_filter,
                {'$push': {'timeline': timeline_entry}}
            )
        
        await _db.service_orders.update_one(
            order_filter,
            {'$set': update_doc}
        )
        
        # Send notification to client on status change
        if 'status' in update_data:
            new_status = update_data['status']
            status_messages = {
                'in_progress': '🔄 Tu proyecto está en progreso',
                'completed': '✅ Tu proyecto ha sido completado',
                'cancelled': '❌ Tu proyecto ha sido cancelado',
            }
            
            if new_status in status_messages:
                try:
                    await create_notification(
                        user_id=order['client_id'],
                        title='Actualización de Proyecto',
                        body=status_messages[new_status],
                        type='service',
                        data={'order_id': order_id, 'status': new_status}
                    )
                except Exception as e:
                    print(f'⚠️ Could not send status notification: {str(e)}')
        
        print(f"✅ Service order {order_id} updated")
        
        return {
            'success': True,
            'message': 'Orden actualizada exitosamente',
            'order_id': order_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error updating service order: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@service_orders_router.delete('/admin/service-orders/{order_id}')
async def delete_service_order(
    order_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Admin: Delete a service order"""
    try:
        # Try ObjectId lookup first (safely), then string lookup
        order = None
        try:
            order = await _db.service_orders.find_one({'_id': ObjectId(order_id)})
        except Exception:
            pass
        if not order:
            order = await _db.service_orders.find_one({'_id': order_id})
        if not order:
            order = await _db.service_orders.find_one({'id': order_id})
        if not order:
            raise HTTPException(status_code=404, detail='Orden no encontrada')
        
        await _db.service_orders.delete_one({'_id': order['_id']})
        print(f"🗑️ Service order {order_id} deleted by {current_user.get('email')}")
        
        return {
            'success': True,
            'message': 'Orden eliminada exitosamente',
            'order_id': order_id
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error deleting service order: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))



@service_orders_router.get('/admin/service-orders/{order_id}/details')
async def get_service_order_details(
    order_id: str,
    current_user: dict = Depends(_require_admin)
):
    """
    Admin: Get full service order details including documents and document upload link
    """
    try:
        order = None
        try:
            order = await _db.service_orders.find_one({'_id': ObjectId(order_id)})
        except Exception:
            pass
        if not order:
            order = await _db.service_orders.find_one({'_id': order_id})
        if not order:
            order = await _db.service_orders.find_one({'id': order_id})
        if not order:
            raise HTTPException(status_code=404, detail='Orden no encontrada')
        
        order_data = {
            'id': str(order['_id']),
            'order_number': order.get('order_number'),
            'client_id': order.get('client_id'),
            'client_name': order.get('client_name'),
            'client_email': order.get('client_email'),
            'client_phone': order.get('client_phone'),
            'service_type': order.get('service_type'),
            'description': order.get('description'),
            'tax_year': order.get('tax_year'),
            'status': order.get('status'),
            'priority': order.get('priority'),
            'estimated_amount': order.get('estimated_amount'),
            'notes': order.get('notes'),
            'appointment_id': order.get('appointment_id'),
            'appointment_date': order.get('appointment_date').isoformat() if isinstance(order.get('appointment_date'), datetime) else order.get('appointment_date'),
            'created_at': order['created_at'].isoformat() if isinstance(order['created_at'], datetime) else order['created_at'],
            'updated_at': order['updated_at'].isoformat() if isinstance(order['updated_at'], datetime) else order['updated_at']
        }
        
        # Get client info
        client = await _db.users.find_one({'_id': order.get('client_id')})
        if client:
            order_data['client_phone'] = client.get('phone')
            order_data['client_address'] = client.get('address')
        
        # Get documents uploaded by client (from main documents collection)
        client_documents = await _db.documents.find({
            'user_id': order.get('client_id')
        }).sort('uploaded_at', -1).to_list(50)
        
        # Also get documents uploaded via public link
        public_documents = []
        if order.get('appointment_id'):
            appointment = await _db.appointments.find_one({'_id': order['appointment_id']})
            if appointment and appointment.get('management_token'):
                public_docs = await _db.public_documents.find({
                    'appointment_token': appointment['management_token']
                }).to_list(50)
                public_documents = [{
                    'id': doc['_id'],
                    'name': doc.get('file_name'),
                    'type': 'public_upload',
                    'category': doc.get('requirement_id'),
                    'tax_year': order.get('tax_year'),
                    'status': doc.get('status', 'pending'),
                    'uploaded_at': doc['created_at'].isoformat() if isinstance(doc.get('created_at'), datetime) else doc.get('created_at'),
                    'source': 'public_link'
                } for doc in public_docs]
        
        # Combine all documents
        all_documents = [{
            'id': doc['_id'],
            'name': doc.get('name'),
            'type': doc.get('type'),
            'category': doc.get('category'),
            'tax_year': doc.get('tax_year'),
            'status': doc.get('status', 'pending'),
            'uploaded_at': doc['uploaded_at'].isoformat() if isinstance(doc.get('uploaded_at'), datetime) else doc.get('uploaded_at'),
            'file_url': doc.get('file_url'),
            'source': doc.get('source', 'app')
        } for doc in client_documents]
        
        # Add public documents if not already in main collection
        existing_ids = {d['id'] for d in all_documents}
        for pub_doc in public_documents:
            if pub_doc['id'] not in existing_ids:
                all_documents.append(pub_doc)
        
        order_data['documents'] = all_documents
        order_data['documents_count'] = len(all_documents)
        
        # Get document upload link if appointment exists
        if order.get('appointment_id'):
            appointment = await _db.appointments.find_one({'_id': order['appointment_id']})
            if appointment and appointment.get('management_token'):
                order_data['documents_url'] = f"https://www.rosstaxpreparation.com/documentos/{appointment['management_token']}"
                order_data['management_token'] = appointment['management_token']
                order_data['manage_url'] = f"https://www.rosstaxpreparation.com/mi-cita/{appointment['management_token']}"
        
        # Get required documents config
        config = await _db.settings.find_one({'key': 'document_requirements'})
        if config:
            order_data['required_documents'] = config.get('documents', [])
        else:
            # Default required documents for tax preparation
            order_data['required_documents'] = [
                {'id': 'w2', 'name': 'W-2 (Formulario de Salarios)', 'required': True},
                {'id': 'id', 'name': 'Identificación con foto', 'required': True},
                {'id': 'ssn', 'name': 'Tarjeta de Seguro Social', 'required': True},
                {'id': '1099', 'name': '1099 (Ingresos adicionales)', 'required': False},
                {'id': 'bank', 'name': 'Información bancaria para depósito', 'required': False},
            ]
        
        return {
            'success': True,
            'order': order_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error getting service order details: {str(e)}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@service_orders_router.post('/admin/service-orders/{order_id}/request-documents')
async def request_missing_documents(
    order_id: str,
    data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Admin: Request missing documents from client via SMS/Email/WhatsApp
    Send notification to client about missing documents
    """
    try:
        order = None
        try:
            order = await _db.service_orders.find_one({'_id': ObjectId(order_id)})
        except Exception:
            pass
        if not order:
            order = await _db.service_orders.find_one({'_id': order_id})
        if not order:
            order = await _db.service_orders.find_one({'id': order_id})
        if not order:
            raise HTTPException(status_code=404, detail='Orden no encontrada')
        
        missing_documents = data.get('missing_documents', [])
        notification_method = data.get('method', 'all')  # 'sms', 'email', 'whatsapp', 'all'
        custom_message = data.get('message', '')
        
        if not missing_documents:
            raise HTTPException(status_code=400, detail='Debe especificar los documentos faltantes')
        
        client_id = order.get('client_id')
        client_name = order.get('client_name', 'Cliente')
        client_email = order.get('client_email')
        
        # Get client phone
        client = await _db.users.find_one({'_id': client_id})
        client_phone = client.get('phone') if client else None
        
        # Build document list for message
        docs_list = '\n'.join([f"• {doc}" for doc in missing_documents])
        
        # Get document upload URL
        documents_url = ''
        if order.get('appointment_id'):
            appointment = await _db.appointments.find_one({'_id': order['appointment_id']})
            if appointment and appointment.get('management_token'):
                documents_url = f"https://www.rosstaxpreparation.com/documentos/{appointment['management_token']}"
        
        # Build messages
        sms_message = f"""Ross Tax: Hola {client_name.split()[0]}, necesitamos los siguientes documentos para completar tu declaración:

{docs_list}

{custom_message}

Súbelos aquí: {documents_url}

¿Preguntas? Responde a este mensaje."""

        email_subject = f"📋 Documentos Faltantes - Orden #{order.get('order_number')}"
        email_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #6C1110; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Ross Tax Preparation</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #333;">Hola {client_name},</h2>
                <p style="color: #555; font-size: 16px;">Para completar tu declaración de impuestos, necesitamos los siguientes documentos:</p>
                
                <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0;">
                    <h3 style="color: #6C1110; margin-top: 0;">📋 Documentos Faltantes:</h3>
                    <ul style="color: #333; font-size: 15px;">
                        {''.join([f'<li style="margin: 10px 0;">{doc}</li>' for doc in missing_documents])}
                    </ul>
                </div>
                
                {f'<p style="color: #555; font-style: italic;">{custom_message}</p>' if custom_message else ''}
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{documents_url}" style="background: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block;">
                        📤 Subir Documentos
                    </a>
                </div>
                
                <p style="color: #777; font-size: 14px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
            </div>
            <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">Ross Tax Preparation Services</p>
                <p style="margin: 5px 0;">📞 (786) 505-5070 | ✉️ info@rosstaxpreparation.com</p>
            </div>
        </div>
        """
        
        results = {'sms': False, 'email': False, 'whatsapp': False}
        
        # Send SMS
        if notification_method in ['sms', 'all'] and client_phone:
            try:
                sms_result = await notification_service.send_sms(client_phone, sms_message)
                results['sms'] = sms_result
                print(f"✅ SMS sent to {client_phone}: {sms_result}")
            except Exception as e:
                print(f"⚠️ SMS failed: {e}")
                import traceback
                traceback.print_exc()
        
        # Send Email
        if notification_method in ['email', 'all'] and client_email:
            try:
                email_result = await notification_service.send_email(
                    to_email=client_email,
                    subject=email_subject,
                    html_content=email_body
                )
                results['email'] = email_result
                print(f"✅ Email sent to {client_email}: {email_result}")
            except Exception as e:
                print(f"⚠️ Email failed: {e}")
                import traceback
                traceback.print_exc()
        
        # Send WhatsApp using whatsapp_service
        if notification_method in ['whatsapp', 'all'] and client_phone:
            try:
                whatsapp_message = f"""*Ross Tax Preparation* 📋

Hola {client_name.split()[0]}, necesitamos los siguientes documentos:

{docs_list}

{custom_message}

👉 Súbelos aquí: {documents_url}

_Responde si tienes preguntas._"""
                
                # Use whatsapp_service if available
                if whatsapp_service:
                    # Format phone number for WhatsApp (needs country code)
                    formatted_phone = client_phone
                    if not formatted_phone.startswith('+'):
                        formatted_phone = '+1' + formatted_phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
                    
                    wa_result = await whatsapp_service.send_message(
                        to=formatted_phone,
                        message=whatsapp_message
                    )
                    results['whatsapp'] = wa_result.get('success', False)
                    print(f"✅ WhatsApp sent to {formatted_phone}: {wa_result}")
                else:
                    print("⚠️ WhatsApp service not initialized")
            except Exception as e:
                print(f"⚠️ WhatsApp failed: {e}")
                import traceback
                traceback.print_exc()
        
        # Log the request
        await _db.document_requests.insert_one({
            '_id': str(uuid.uuid4()),
            'order_id': order_id,
            'client_id': client_id,
            'missing_documents': missing_documents,
            'method': notification_method,
            'custom_message': custom_message,
            'results': results,
            'requested_by': current_user['id'],
            'requested_by_name': current_user.get('name', 'Admin'),
            'created_at': datetime.now(timezone.utc)
        })
        
        # Create in-app notification
        await create_notification(
            user_id=client_id,
            title='📋 Documentos Requeridos',
            body=f'Necesitamos documentos adicionales para tu declaración: {", ".join(missing_documents[:3])}...',
            type='document_request',
            data={'order_id': order_id, 'documents_url': documents_url}
        )
        
        return {
            'success': True,
            'message': 'Solicitud de documentos enviada',
            'results': results,
            'documents_url': documents_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error requesting documents: {str(e)}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CLIENT: My Service Orders/Projects
# ============================================

@service_orders_router.get('/my-projects')
async def get_my_projects(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(_auth_user)
):
    """
    Client: Get my service orders/projects
    """
    try:
        user_id = current_user['id']
        print(f"📋 Getting projects for client: {user_id}")
        
        query = {'client_id': user_id}
        if status:
            query['status'] = status
        
        orders = await _db.service_orders.find(query).sort('created_at', -1).to_list(100)
        
        formatted_orders = []
        for order in orders:
            formatted_orders.append({
                'id': str(order['_id']),
                'order_number': order.get('order_number'),
                'service_type': order.get('service_type') or order.get('service_name', ''),
                'description': order.get('description', ''),
                'tax_year': order.get('tax_year') or order.get('fiscal_year', ''),
                'status': order.get('status'),
                'priority': order.get('priority'),
                'estimated_amount': order.get('estimated_amount') or order.get('service_price', 0),
                'notes': order.get('notes', ''),
                'assigned_to_name': order.get('assigned_to_name'),
                'payment_status': order.get('payment_status'),
                'created_at': order['created_at'].isoformat() if isinstance(order.get('created_at'), datetime) else str(order.get('created_at', '')),
                'updated_at': order['updated_at'].isoformat() if isinstance(order.get('updated_at'), datetime) else str(order.get('updated_at', '')),
                'timeline': order.get('timeline', []),
            })
        
        # Calculate stats - include all related statuses
        all_orders = await _db.service_orders.find({'client_id': user_id}).to_list(100)
        stats = {
            'total': len(all_orders),
            'pending': len([o for o in all_orders if o.get('status') in ('pending', 'pending_payment')]),
            'in_progress': len([o for o in all_orders if o.get('status') in ('in_progress', 'processing', 'review', 'under_review')]),
            'completed': len([o for o in all_orders if o.get('status') in ('completed', 'done')]),
        }
        
        return {
            'success': True,
            'projects': formatted_orders,
            'stats': stats
        }
        
    except Exception as e:
        print(f'❌ Error getting client projects: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@service_orders_router.get('/my-projects/{project_id}')
async def get_my_project_detail(
    project_id: str,
    current_user: dict = Depends(_auth_user)
):
    """
    Client: Get detail of a specific project
    """
    try:
        user_id = current_user['id']
        
        order = await _db.service_orders.find_one({
            '_id': project_id,
            'client_id': user_id
        })
        
        if not order:
            raise HTTPException(status_code=404, detail='Proyecto no encontrado')
        
        return {
            'success': True,
            'project': {
                'id': order['_id'],
                'order_number': order.get('order_number'),
                'service_type': order.get('service_type'),
                'description': order.get('description'),
                'tax_year': order.get('tax_year'),
                'status': order.get('status'),
                'priority': order.get('priority'),
                'estimated_amount': order.get('estimated_amount', 0),
                'notes': order.get('notes', ''),
                'assigned_to_name': order.get('assigned_to_name'),
                'created_at': order['created_at'].isoformat() if isinstance(order.get('created_at'), datetime) else order.get('created_at'),
                'updated_at': order['updated_at'].isoformat() if isinstance(order.get('updated_at'), datetime) else order.get('updated_at'),
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error getting project detail: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


