"""
Admin Clients Export and Analytics Routes Router
Extracted from server.py for modularization.
Handles client CSV export, analytics, client notes, and batch operations.
"""
import logging
import csv
import uuid
import pandas as pd
from io import StringIO
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Response
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias='_id')
    email: EmailStr
    name: str
    password_hash: Optional[str] = None
    picture: Optional[str] = None
    role: str = 'client'
    phone: Optional[str] = None
    address: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class ClientUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    profile_picture: Optional[str] = None

logger = logging.getLogger(__name__)

admin_clients_export_router = APIRouter()
_db = None
_notification_service = None


def init_admin_clients_export_router(db):
    global _db
    _db = db


def update_admin_clients_export_notification_service(notif_svc):
    global _notification_service
    _notification_service = notif_svc

# ================== Auth helpers ==================

async def _auth_user(request: Request):
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        try:
            from bson import ObjectId as OID
            user = await _db.users.find_one({'_id': OID(session['user_id'])})
        except:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = user_dict.get('id', str(user_dict.get('_id', '')))
    if '_id' in user_dict:
        user_dict['_id'] = str(user_dict['_id'])
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

# ================== SERVICE ORDERS (Extracted to service_orders_routes.py) ==================

@admin_clients_export_router.get('/admin/clients/export-csv')
async def export_clients_csv(request: Request):
    """Export all clients to CSV"""
    current_user = await _require_admin(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Get all clients with KYC info
        users = await _db.users.find({'role': 'client'}).to_list(10000)
        
        clients_data = []
        for user in users:
            kyc = await _db.kyc_data.find_one({'user_id': user['_id']})
            
            client_row = {
                'id': user['_id'],
                'name': user['name'],
                'email': user['email'],
                'phone': user.get('phone', ''),
                'created_at': user['created_at'].isoformat() if isinstance(user['created_at'], datetime) else user['created_at'],
                'kyc_completed': kyc.get('completed', False) if kyc else False,
                'kyc_verified': kyc.get('verified', False) if kyc else False,
                'priority_status': kyc.get('priority_status', False) if kyc else False,
                'has_app': bool(user.get('push_token')),  # Indicates if user has mobile app installed
            }
            
            # Add KYC data if exists (masked)
            if kyc and kyc.get('completed'):
                client_row.update({
                    'ssn_last_four': kyc.get('ssn_last_four', ''),
                    'date_of_birth': kyc.get('date_of_birth', ''),
                    'marital_status': kyc.get('marital_status', ''),
                    'address_street': kyc.get('address_street', ''),
                    'address_city': kyc.get('address_city', ''),
                    'address_state': kyc.get('address_state', ''),
                    'address_zip': kyc.get('address_zip', ''),
                    'num_dependents': kyc.get('num_dependents', 0),
                    'preferred_contact_method': kyc.get('preferred_contact_method', ''),
                })
            
            clients_data.append(client_row)
        
        # Create DataFrame
        df = pd.DataFrame(clients_data)
        
        # Generate CSV
        output = StringIO()
        df.to_csv(output, index=False, encoding='utf-8')
        output.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=ross_tax_clients_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
        )
    
    except Exception as e:
        logging.error(f'Error exporting clients: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

class ImportCSVRequest(BaseModel):
    file: str  # Base64 encoded CSV content

@admin_clients_export_router.post('/admin/clients/import-csv')
async def import_clients_csv(
    request_data: dict = Body(...),
    request: Request = None
):
    current_user = await _require_admin(request)

    """Import clients from CSV"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Get CSV content - support both formats
        csv_content = None
        
        # Try direct CSV content first
        if request_data.get('csv_content'):
            csv_content = request_data['csv_content']
        # Then try base64 encoded file
        elif request_data.get('file'):
            import base64
            csv_content = base64.b64decode(request_data['file']).decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail='No CSV content provided')
        
        # Read CSV
        df = pd.read_csv(StringIO(csv_content))
        
        imported_count = 0
        updated_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Check required fields
                if pd.isna(row.get('email')) or pd.isna(row.get('name')):
                    errors.append(f'Row {index + 2}: Missing required fields (name or email)')
                    continue
                
                email = str(row['email']).strip()
                name = str(row['name']).strip()
                
                # Check if user exists
                existing_user = await _db.users.find_one({'email': email})
                
                if existing_user:
                    # Update existing user
                    update_data = {
                        'name': name,
                        'phone': str(row.get('phone', '')) if not pd.isna(row.get('phone')) else None,
                    }
                    await _db.users.update_one(
                        {'_id': existing_user['_id']},
                        {'$set': update_data}
                    )
                    updated_count += 1
                else:
                    # Create new user
                    new_user = User(
                        email=email,
                        name=name,
                        phone=str(row.get('phone', '')) if not pd.isna(row.get('phone')) else None,
                        role='client',
                        password_hash=None  # Will need to set password on first login
                    )
                    user_dict = new_user.dict(by_alias=True)
                    await _db.users.insert_one(user_dict)
                    imported_count += 1
                    
                    # If KYC data exists in CSV, create KYC record
                    if not pd.isna(row.get('date_of_birth')):
                        kyc_data = {
                            'user_id': user_dict['_id'],
                            'full_name': name,
                            'date_of_birth': str(row.get('date_of_birth', '')),
                            'ssn_last_four': str(row.get('ssn_last_four', '')),
                            'address_street': str(row.get('address_street', '')),
                            'address_city': str(row.get('address_city', '')),
                            'address_state': str(row.get('address_state', '')),
                            'address_zip': str(row.get('address_zip', '')),
                            'marital_status': str(row.get('marital_status', 'single')),
                            'num_dependents': int(row.get('num_dependents', 0)),
                            'primary_phone': str(row.get('phone', '')),
                            'preferred_contact_method': str(row.get('preferred_contact_method', 'email')),
                            'preferred_contact_time': 'afternoon',
                            'completed': bool(row.get('kyc_completed', False)),
                            'verified': bool(row.get('kyc_verified', False)),
                            'priority_status': bool(row.get('priority_status', False)),
                            'created_at': datetime.now(timezone.utc),
                            'updated_at': datetime.now(timezone.utc),
                        }
                        await _db.kyc_data.insert_one(kyc_data)
            
            except Exception as e:
                errors.append(f'Row {index + 2}: {str(e)}')
                continue
        
        return {
            'success': True,
            'imported': imported_count,
            'updated': updated_count,
            'errors': errors,
            'total_processed': len(df)
        }
    
    except Exception as e:
        logging.error(f'Error importing clients: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@admin_clients_export_router.get('/admin/clients/{user_id}')
async def get_client_details(user_id: str, request: Request):
    """Get detailed client information"""
    current_user = await _require_admin(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    logging.info(f"🔍 Looking for client with ID: {user_id}")
    
    # Convert string to ObjectId for MongoDB query
    user = None
    
    # Try as string _id first (most common for UUIDs)
    user = await _db.users.find_one({'_id': user_id})
    logging.info(f"  Search by _id string: {user is not None}")
    
    # If not found, try ObjectId
    if not user:
        try:
            if len(user_id) == 24 and ObjectId.is_valid(user_id):
                user = await _db.users.find_one({'_id': ObjectId(user_id)})
                logging.info(f"  Search by ObjectId: {user is not None}")
        except Exception as e:
            logging.info(f"  ObjectId conversion failed: {e}")
    
    # If still not found, try 'id' field
    if not user:
        user = await _db.users.find_one({'id': user_id})
        logging.info(f"  Search by id field: {user is not None}")
    
    if not user:
        logging.warning(f"❌ Client not found: {user_id}")
        raise HTTPException(status_code=404, detail='Client not found')
    
    logging.info(f"✅ Client found: {user.get('name')}")
    
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')
    
    # Use both the string representation and original _id for querying
    user_id_str = str(user['_id'])
    
    # Query documents with both possible user_id formats
    documents = await _db.documents.find({
        '$or': [{'user_id': user_id_str}, {'user_id': user['_id']}]
    }).sort('uploaded_at', -1).to_list(100)
    
    # Query appointments with both possible user_id formats
    appointments = await _db.appointments.find({
        '$or': [{'user_id': user_id_str}, {'user_id': user['_id']}]
    }).sort('scheduled_at', -1).to_list(100)
    
    # Query KYC data
    kyc = await _db.kyc_data.find_one({
        '$or': [{'user_id': user_id_str}, {'user_id': user['_id']}]
    })
    
    # Query tax returns
    tax_returns = await _db.tax_returns.find({
        '$or': [{'user_id': user_id_str}, {'user_id': user['_id']}]
    }).sort('tax_year', -1).to_list(100)
    
    # Query completed returns
    completed_returns = await _db.completed_tax_returns.find({
        '$or': [{'user_id': user_id_str}, {'user_id': user['_id']}]
    }).sort('tax_year', -1).to_list(100)
    
    # Remove full SSN from KYC data
    if kyc:
        kyc.pop('ssn_full', None)
        kyc.pop('itin', None)
        kyc.pop('spouse_ssn_full', None)
    
    # Convert ObjectIds to strings for JSON serialization
    def serialize_doc(doc):
        if not doc:
            return None
        if isinstance(doc, dict):
            result = {}
            for key, value in doc.items():
                if isinstance(value, ObjectId):
                    result[key] = str(value)
                elif isinstance(value, dict):
                    result[key] = serialize_doc(value)
                elif isinstance(value, list):
                    result[key] = [serialize_doc(item) if isinstance(item, dict) else (str(item) if isinstance(item, ObjectId) else item) for item in value]
                else:
                    result[key] = value
            return result
        return doc
    
    # Query client notes
    notes = await _db.client_notes.find({
        '$or': [{'user_id': user_id_str}, {'user_id': user_id}]
    }).sort('created_at', -1).to_list(50)
    
    # Query payment history (invoices)
    payments = await _db.invoices.find({
        '$or': [
            {'user_id': user_id_str}, 
            {'user_id': user_id},
            {'user_id': str(user.get('id', ''))}
        ]
    }).sort('created_at', -1).to_list(50)
    
    return {
        'user': {
            'id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'phone': user.get('phone'),
            'picture': user.get('picture'),
            'created_at': user['created_at'],
            'address': user.get('address'),
            'city': user.get('city'),
            'state': user.get('state'),
            'zipcode': user.get('zipcode'),
            'date_of_birth': user.get('date_of_birth'),
            'ssn_last4': user.get('ssn_last4'),
            'has_app': user.get('has_app', False),
            'last_app_access': user.get('last_app_access'),
            'role': user.get('role'),
            'push_token': bool(user.get('push_token') or user.get('expo_push_token')),
        },
        'kyc': serialize_doc(kyc) if kyc else None,
        'documents': [serialize_doc(doc) for doc in documents],
        'appointments': [serialize_doc(apt) for apt in appointments],
        'tax_returns': [serialize_doc(tr) for tr in tax_returns],
        'completed_returns': [
            serialize_doc({**cr, 'has_federal_pdf': bool(cr.get('federal_return_pdf')), 
             'has_state_pdf': bool(cr.get('state_return_pdf'))})
            for cr in completed_returns
        ],
        'notes': [{
            'id': str(note['_id']),
            'admin_name': note.get('admin_name', 'Sistema'),
            'content': note.get('content', ''),
            'category': note.get('category', 'general'),
            'created_at': note.get('created_at')
        } for note in notes],
        'payments': [{
            'id': str(payment['_id']),
            'invoice_number': payment.get('invoice_number', ''),
            'service_name': payment.get('service_name', 'Servicio'),
            'total': payment.get('total', 0),
            'status': payment.get('status', 'pending'),
            'created_at': payment.get('created_at'),
            'paid_at': payment.get('paid_at'),
        } for payment in payments],
    }


@admin_clients_export_router.get('/admin/clients/{user_id}/timeline')
async def get_client_timeline(user_id: str, request: Request):
    """Get complete activity timeline for a client"""
    current_user = await _require_admin(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    from bson import ObjectId
    
    # Find user
    user = None
    user_id_str = user_id
    
    if ObjectId.is_valid(user_id):
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')
    
    timeline = []
    
    # Get user creation event
    timeline.append({
        'type': 'account_created',
        'icon': '👤',
        'title': 'Cuenta creada',
        'description': f'Cliente registrado: {user.get("name", "Sin nombre")}',
        'date': user.get('created_at'),
        'color': 'blue'
    })
    
    # Get appointments
    appointments = await _db.appointments.find({
        '$or': [{'user_id': user_id_str}, {'user_id': str(user['_id'])}, {'client_id': user_id_str}]
    }).sort('scheduled_at', -1).to_list(100)
    
    for apt in appointments:
        status_labels = {
            'scheduled': 'Cita programada',
            'completed': 'Cita completada',
            'cancelled': 'Cita cancelada',
            'no_show': 'No se presentó'
        }
        status_icons = {
            'scheduled': '📅',
            'completed': '✅',
            'cancelled': '❌',
            'no_show': '⚠️'
        }
        status_colors = {
            'scheduled': 'blue',
            'completed': 'green',
            'cancelled': 'red',
            'no_show': 'yellow'
        }
        status = apt.get('status', 'scheduled')
        timeline.append({
            'type': 'appointment',
            'icon': status_icons.get(status, '📅'),
            'title': status_labels.get(status, 'Cita'),
            'description': f'{apt.get("appointment_type", "Cita")} - {apt.get("time_slot", "")}',
            'date': apt.get('scheduled_at') or apt.get('created_at'),
            'color': status_colors.get(status, 'blue'),
            'metadata': {'appointment_id': str(apt.get('_id', ''))}
        })
    
    # Get documents
    documents = await _db.documents.find({
        '$or': [{'user_id': user_id_str}, {'user_id': str(user['_id'])}]
    }).sort('uploaded_at', -1).to_list(100)
    
    for doc in documents:
        source = doc.get('source', '')
        source_label = ' (WhatsApp)' if source == 'whatsapp' else ''
        timeline.append({
            'type': 'document',
            'icon': '📄',
            'title': f'Documento recibido{source_label}',
            'description': doc.get('name', doc.get('original_filename', 'Documento')) + f' - {doc.get("category", "general")}',
            'date': doc.get('uploaded_at') or doc.get('created_at'),
            'color': 'purple',
            'metadata': {'document_id': doc.get('id', str(doc.get('_id', '')))}
        })
    
    # Get invoices
    invoices = await _db.invoices.find({
        '$or': [{'user_id': user_id_str}, {'user_id': str(user['_id'])}, {'client_id': user_id_str}]
    }).sort('created_at', -1).to_list(100)
    
    for inv in invoices:
        status = inv.get('status', 'pending')
        status_labels = {'pending': 'Factura creada', 'paid': 'Factura pagada', 'overdue': 'Factura vencida', 'cancelled': 'Factura cancelada'}
        status_icons = {'pending': '📋', 'paid': '💰', 'overdue': '⚠️', 'cancelled': '❌'}
        status_colors = {'pending': 'yellow', 'paid': 'green', 'overdue': 'red', 'cancelled': 'gray'}
        
        timeline.append({
            'type': 'invoice',
            'icon': status_icons.get(status, '📋'),
            'title': status_labels.get(status, 'Factura'),
            'description': f'${inv.get("amount", 0):,.2f} - {inv.get("description", "Servicio")}',
            'date': inv.get('paid_at') if status == 'paid' else inv.get('created_at'),
            'color': status_colors.get(status, 'yellow'),
            'metadata': {'invoice_id': str(inv.get('_id', ''))}
        })
    
    # Get tax returns
    completed_returns = await _db.completed_tax_returns.find({
        '$or': [{'user_id': user_id_str}, {'user_id': str(user['_id'])}]
    }).sort('created_at', -1).to_list(100)
    
    for tr in completed_returns:
        timeline.append({
            'type': 'tax_return',
            'icon': '📊',
            'title': f'Declaración completada {tr.get("tax_year", "")}',
            'description': f'Reembolso: ${tr.get("refund_amount", 0):,.2f}' if tr.get('refund_amount') else f'Impuesto: ${tr.get("tax_owed", 0):,.2f}',
            'date': tr.get('filed_date') or tr.get('created_at'),
            'color': 'green',
            'metadata': {'tax_return_id': tr.get('id', str(tr.get('_id', '')))}
        })
    
    # Get WhatsApp messages (recent 20)
    phone = user.get('phone', '')
    if phone:
        phone_clean = phone.replace('+', '').replace(' ', '').replace('-', '')
        messages = await _db.whatsapp_messages.find({
            'phone_number': {'$regex': phone_clean[-10:]}
        }).sort('created_at', -1).limit(20).to_list(20)
        
        for msg in messages:
            direction = msg.get('direction', 'inbound')
            timeline.append({
                'type': 'whatsapp',
                'icon': '💬' if direction == 'inbound' else '📤',
                'title': 'Mensaje WhatsApp ' + ('recibido' if direction == 'inbound' else 'enviado'),
                'description': (msg.get('message', '')[:100] + '...') if len(msg.get('message', '')) > 100 else msg.get('message', ''),
                'date': msg.get('created_at'),
                'color': 'green' if direction == 'inbound' else 'blue',
            })
    
    # Get notes
    notes = await _db.client_notes.find({
        '$or': [{'user_id': user_id_str}, {'user_id': str(user['_id'])}, {'client_id': user_id_str}]
    }).sort('created_at', -1).to_list(50)
    
    for note in notes:
        timeline.append({
            'type': 'note',
            'icon': '📝',
            'title': 'Nota añadida',
            'description': (note.get('content', '')[:100] + '...') if len(note.get('content', '')) > 100 else note.get('content', ''),
            'date': note.get('created_at'),
            'color': 'gray',
            'metadata': {'created_by': note.get('created_by_name', 'Admin')}
        })
    
    # Sort timeline by date (most recent first)
    def get_date(item):
        d = item.get('date')
        if d is None:
            return datetime.min
        if isinstance(d, str):
            try:
                return datetime.fromisoformat(d.replace('Z', '+00:00'))
            except:
                return datetime.min
        return d
    
    timeline.sort(key=get_date, reverse=True)
    
    # Convert dates to ISO strings
    for item in timeline:
        if item.get('date') and not isinstance(item['date'], str):
            item['date'] = item['date'].isoformat() if hasattr(item['date'], 'isoformat') else str(item['date'])
    
    return {
        'timeline': timeline[:100],  # Limit to 100 most recent events
        'total_events': len(timeline)
    }


@admin_clients_export_router.post('/admin/clients/{user_id}/tags')
async def update_client_tags(
    user_id: str,
    tags_data: dict,
    request: Request
):
    current_user = await _require_admin(request)

    """Update client tags/labels"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    from bson import ObjectId
    
    # Find user
    user = None
    if ObjectId.is_valid(user_id):
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        user = await _db.users.find_one({'id': user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')
    
    tags = tags_data.get('tags', [])
    
    # Validate tags - must be from predefined list
    valid_tags = ['vip', 'nuevo', 'recurrente', 'preferido', 'potencial', 'inactivo', 'moroso', 'referido']
    tags = [t for t in tags if t in valid_tags]
    
    # Update user with tags
    await _db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'tags': tags, 'updated_at': datetime.now(timezone.utc)}}
    )
    
    return {'success': True, 'tags': tags}


@admin_clients_export_router.get('/admin/tags')
async def get_available_tags(request: Request):
    """Get all available tags for clients"""
    current_user = await _require_admin(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    tags = [
        {'id': 'vip', 'label': '⭐ VIP', 'color': 'yellow'},
        {'id': 'nuevo', 'label': '🆕 Nuevo', 'color': 'green'},
        {'id': 'recurrente', 'label': '🔄 Recurrente', 'color': 'blue'},
        {'id': 'preferido', 'label': '❤️ Preferido', 'color': 'red'},
        {'id': 'potencial', 'label': '🎯 Potencial', 'color': 'purple'},
        {'id': 'inactivo', 'label': '😴 Inactivo', 'color': 'gray'},
        {'id': 'moroso', 'label': '⚠️ Moroso', 'color': 'orange'},
        {'id': 'referido', 'label': '👥 Referido', 'color': 'teal'},
    ]
    return {'tags': tags}


class MassMessageRequest(BaseModel):
    client_ids: List[str]
    message: str
    channels: List[str] = ['whatsapp', 'email']


@admin_clients_export_router.post('/admin/mass-message')
async def send_mass_message(
    request_data: MassMessageRequest,
    request: Request
):
    current_user = await _require_admin(request)

    """Send mass message to multiple clients via WhatsApp and/or Email"""
    from bson import ObjectId
    import re
    
    if not request_data.client_ids or not request_data.message:
        raise HTTPException(status_code=400, detail='client_ids and message are required')
    
    sent_count = 0
    failed_count = 0
    results = []
    
    for client_id in request_data.client_ids:
        try:
            # Find user
            user = None
            if ObjectId.is_valid(client_id):
                user = await _db.users.find_one({'_id': ObjectId(client_id)})
            if not user:
                user = await _db.users.find_one({'_id': client_id})
            if not user:
                user = await _db.users.find_one({'id': client_id})
            
            if not user:
                results.append({'client_id': client_id, 'status': 'not_found'})
                failed_count += 1
                continue
            
            client_name = user.get('full_name') or user.get('name', 'Cliente')
            client_email = user.get('email')
            client_phone = user.get('phone')
            
            # Personalize message
            personalized_message = request_data.message.replace('{nombre}', client_name)
            
            sent_whatsapp = False
            sent_email = False
            
            # Send WhatsApp
            if 'whatsapp' in request_data.channels and client_phone and whatsapp_service:
                try:
                    phone_clean = re.sub(r'\D', '', client_phone)
                    if len(phone_clean) == 10:
                        phone_clean = f"1{phone_clean}"
                    
                    result = await whatsapp_service.send_message(
                        to=phone_clean,
                        message=personalized_message
                    )
                    if result.get('success'):
                        sent_whatsapp = True
                except Exception as wa_error:
                    logging.error(f"WhatsApp error for {client_id}: {wa_error}")
            
            # Send Email
            if 'email' in request_data.channels and client_email and _notification_service:
                try:
                    await _notification_service.send_email(
                        to_email=client_email,
                        to_name=client_name,
                        subject=f"Mensaje de Ross Tax Preparation",
                        html_content=f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #6C1110;">Ross Tax Preparation</h2>
                            <p>Hola {client_name},</p>
                            <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                {personalized_message.replace(chr(10), '<br>')}
                            </div>
                            <p>Saludos,<br>Ross Tax Preparation</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">📞 (806) 934-2018</p>
                        </div>
                        """
                    )
                    sent_email = True
                except Exception as email_error:
                    logging.error(f"Email error for {client_id}: {email_error}")
            
            if sent_whatsapp or sent_email:
                sent_count += 1
                results.append({
                    'client_id': client_id,
                    'name': client_name,
                    'status': 'sent',
                    'whatsapp': sent_whatsapp,
                    'email': sent_email
                })
            else:
                failed_count += 1
                results.append({
                    'client_id': client_id,
                    'name': client_name,
                    'status': 'failed',
                    'reason': 'No contact info or service unavailable'
                })
                
        except Exception as e:
            logging.error(f"Error sending to {client_id}: {e}")
            failed_count += 1
            results.append({'client_id': client_id, 'status': 'error', 'error': str(e)})
    
    # Log the mass message
    await _db.mass_messages.insert_one({
        'sent_by': current_user.get('email'),
        'message': request_data.message,
        'channels': request_data.channels,
        'sent_count': sent_count,
        'failed_count': failed_count,
        'results': results,
        'created_at': datetime.now(timezone.utc)
    })
    
    return {
        'status': 'completed',
        'sent_count': sent_count,
        'failed_count': failed_count,
        'total': len(request_data.client_ids),
        'results': results
    }


# ================== NEW CLIENT MODULE ENDPOINTS ==================

@admin_clients_export_router.patch('/admin/clients/{user_id}')
async def update_client(
    user_id: str,
    update_data: ClientUpdateRequest,
    request: Request
):
    current_user = await _require_admin(request)

    """Update client information"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    # Check if user exists - try both ObjectId and string formats
    from bson import ObjectId
    user = None
    
    # Try with ObjectId first
    if ObjectId.is_valid(user_id):
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    
    # Try with string _id
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    
    # Try with 'id' field (UUID format)
    if not user:
        user = await _db.users.find_one({'id': user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')
    
    # Update user fields (name, email, phone, profile_picture)
    user_update_dict = {}
    if update_data.name:
        user_update_dict['name'] = update_data.name
    if update_data.email:
        # Check if email is already taken by another user
        existing = await _db.users.find_one({'email': update_data.email, '_id': {'$ne': user_id}})
        if existing:
            raise HTTPException(status_code=400, detail='Email already in use')
        user_update_dict['email'] = update_data.email
    if update_data.phone:
        user_update_dict['phone'] = update_data.phone
    if update_data.profile_picture is not None:  # Allow empty string to remove photo
        user_update_dict['profile_picture'] = update_data.profile_picture
    
    if user_update_dict:
        await _db.users.update_one(
            {'_id': user_id},
            {'$set': user_update_dict}
        )
    
    # Update client metadata (status, type)
    metadata_update_dict = {}
    if update_data.status:
        metadata_update_dict['status'] = update_data.status
    if update_data.type:
        metadata_update_dict['type'] = update_data.type
    
    if metadata_update_dict:
        metadata_update_dict['last_update'] = datetime.now(timezone.utc)
        await _db.client_metadata.update_one(
            {'user_id': user_id},
            {'$set': metadata_update_dict},
            upsert=True
        )
    
    return {
        'message': 'Client updated successfully', 
        'updated_fields': {**user_update_dict, **metadata_update_dict}
    }

@admin_clients_export_router.delete('/admin/clients/{user_id}')
async def delete_client(
    user_id: str,
    request: Request
):
    current_user = await _require_admin(request)

    """Delete a client and all associated data"""
    from bson import ObjectId
    from bson.errors import InvalidId
    
    print(f'🗑️ DELETE request for user_id: {user_id}')
    
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    # Allow deleting clients with various client-related roles
    client_roles = ['client', 'inactive_client', 'pending', 'lead']
    
    # Try to find user with string ID first, then with ObjectId
    user = await _db.users.find_one({'_id': user_id, 'role': {'$in': client_roles}})
    
    if not user:
        # Try with ObjectId if string looks like an ObjectId
        try:
            if len(user_id) == 24:  # ObjectId length
                user = await _db.users.find_one({'_id': ObjectId(user_id), 'role': {'$in': client_roles}})
                if user:
                    user_id = ObjectId(user_id)  # Use ObjectId for deletion
                    print(f'Found user with ObjectId conversion')
        except InvalidId:
            pass
    
    # Also try without role filter if user not found (for imported clients without role)
    if not user:
        user = await _db.users.find_one({'_id': user_id})
        if not user and len(str(user_id)) == 24:
            try:
                user = await _db.users.find_one({'_id': ObjectId(user_id)})
                if user:
                    user_id = ObjectId(user_id)
            except:
                pass
        
        # Check if this user is an admin - don't allow deleting admins
        if user and user.get('role') in ['admin', 'office_assistant']:
            raise HTTPException(status_code=400, detail='No se puede eliminar usuarios administrativos')
    
    print(f'User found: {user is not None}')
    
    if not user:
        print(f'User with id {user_id} does not exist')
        raise HTTPException(status_code=404, detail='Client not found')
    
    print(f'Deleting client: {user.get("name")} ({user.get("email")})')
    
    # Delete all associated data (use appropriate ID format)
    await _db.users.delete_one({'_id': user_id})
    
    # For associated data, use string version of user_id
    user_id_str = str(user_id) if isinstance(user_id, ObjectId) else user_id
    await _db.client_metadata.delete_many({'user_id': user_id_str})
    await _db.kyc_data.delete_many({'user_id': user_id_str})
    await _db.documents.delete_many({'user_id': user_id_str})
    await _db.appointments.delete_many({'user_id': user_id_str})
    await _db.tax_returns.delete_many({'user_id': user_id_str})
    await _db.completed_tax_returns.delete_many({'user_id': user_id_str})
    await _db.chat_messages.delete_many({'user_id': user_id_str})
    
    print(f'✅ Client deleted successfully')
    return {'message': 'Client and all associated data deleted successfully'}


# ================== WHATSAPP ROUTES (Extracted to whatsapp_routes.py) ==================