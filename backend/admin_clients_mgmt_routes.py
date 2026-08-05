"""
Admin Client Management Routes
Extracted from server.py — Birthday greetings, Client listing, Urgent cases,
Client notes, Document requests, KYC verification, Admin documents.
"""
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from bson import ObjectId
import logging
import asyncio

logger = logging.getLogger(__name__)

admin_clients_mgmt_router = APIRouter()

_db = None
_notification_service = None
_whatsapp_service = None


def init_admin_clients_mgmt_router(db):
    global _db
    _db = db


def update_admin_clients_mgmt_services(notification_service=None, whatsapp_service=None):
    global _notification_service, _whatsapp_service
    if notification_service is not None:
        _notification_service = notification_service
    if whatsapp_service is not None:
        _whatsapp_service = whatsapp_service


# ── Auth helpers (self-contained) ──

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
            user = await _db.users.find_one({'_id': ObjectId(session['user_id'])})
        except Exception:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


# ── Pydantic models ──

class RecordBirthdayGreetingRequest(BaseModel):
    client_id: str
    client_name: str
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    method: str
    included_gift: bool = False
    gift_amount: Optional[float] = 0


class ClientNoteRequest(BaseModel):
    content: str
    category: str = "general"


class RequestDocumentsRequest(BaseModel):
    document_types: list
    message: Optional[str] = None


# ───────────── Birthday Greetings ─────────────

@admin_clients_mgmt_router.post('/admin/birthday-greetings/record')
async def record_birthday_greeting(request: Request):
    """Record that a birthday greeting was sent"""
    current_user = await _require_admin(request)
    try:
        body = await request.json()
        req = RecordBirthdayGreetingRequest(**body)
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        year = datetime.now(timezone.utc).year

        record = {
            'client_id': req.client_id,
            'client_name': req.client_name,
            'client_email': req.client_email,
            'client_phone': req.client_phone,
            'method': req.method,
            'included_gift': req.included_gift,
            'gift_amount': req.gift_amount,
            'sent_by': current_user.get('email'),
            'sent_at': datetime.now(timezone.utc),
            'date': today,
            'year': year
        }

        await _db.birthday_greetings.insert_one(record)
        logger.info(f"🎂 Birthday greeting recorded for {req.client_name}")

        return {"success": True, "message": "Greeting recorded"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording birthday greeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_clients_mgmt_router.get('/admin/birthday-greetings/sent-today')
async def get_sent_birthday_greetings(request: Request):
    """Get list of clients who received birthday greetings today"""
    await _require_admin(request)
    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        greetings = await _db.birthday_greetings.find({'date': today}).to_list(100)
        sent_client_ids = [g.get('client_id') for g in greetings]

        return {
            "success": True,
            "sent_client_ids": sent_client_ids,
            "greetings": [{
                'client_id': g.get('client_id'),
                'client_name': g.get('client_name'),
                'method': g.get('method'),
                'included_gift': g.get('included_gift'),
                'gift_amount': g.get('gift_amount'),
                'sent_at': g.get('sent_at').isoformat() if g.get('sent_at') else None,
                'sent_by': g.get('sent_by')
            } for g in greetings]
        }
    except Exception as e:
        logger.error(f"Error getting sent greetings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_clients_mgmt_router.get('/admin/birthdays')
async def get_birthdays(request: Request):
    """Get birthday statistics and lists for admin dashboard"""
    await _auth_user(request)
    try:
        users = await _db.users.find({'role': 'client'}).to_list(5000)

        clients_list = await _db.clients.find({}).to_list(5000)
        user_emails = set(u.get('email', '').lower() for u in users if u.get('email'))
        for cl in clients_list:
            cl_email = (cl.get('email') or '').lower()
            if cl_email and cl_email not in user_emails and '@temp.' not in cl_email:
                cl['role'] = 'client'
                users.append(cl)

        miami_tz = ZoneInfo("America/New_York")
        today = datetime.now(miami_tz)
        today_str = today.strftime('%Y-%m-%d')

        sent_greetings = await _db.birthday_greetings.find({'date': today_str}).to_list(500)
        sent_client_ids = set(g.get('client_id') for g in sent_greetings)
        sent_at_map = {}
        for g in sent_greetings:
            cid = g.get('client_id')
            if cid and g.get('sent_at'):
                sent_at_map[cid] = g['sent_at'].isoformat() if hasattr(g['sent_at'], 'isoformat') else str(g['sent_at'])

        month_names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

        today_birthdays = []
        upcoming_birthdays = []
        all_birthdays = []
        stats_by_month = {m: 0 for m in month_names}

        for user in users:
            birthday = user.get('birthdate') or user.get('birthday') or user.get('date_of_birth')
            if not birthday:
                continue

            if isinstance(birthday, str):
                try:
                    birthday = datetime.fromisoformat(birthday.replace('Z', '+00:00'))
                except Exception:
                    import re as _re
                    _m = _re.match(r'^(\d{1,2})\s*/?\s*(\d{1,2})\s*/?\s*(\d{4})$', birthday.strip())
                    if _m:
                        try:
                            birthday = datetime(int(_m.group(3)), int(_m.group(1)), int(_m.group(2)))
                        except ValueError:
                            continue
                    else:
                        continue

            month = birthday.month - 1
            day = birthday.day

            try:
                birthday_this_year = datetime(today.year, month + 1, day)
            except ValueError:
                continue
            if birthday_this_year.date() < today.date():
                try:
                    birthday_this_year = datetime(today.year + 1, month + 1, day)
                except ValueError:
                    continue

            days_until = (birthday_this_year.date() - today.date()).days
            age = today.year - birthday.year

            client_id = str(user.get('_id', user.get('id', '')))

            client_data = {
                'id': client_id,
                'name': user.get('name', user.get('full_name', 'Sin nombre')),
                'email': user.get('email', ''),
                'phone': user.get('phone', user.get('phone_number', '')),
                'birthdate': birthday.isoformat(),
                'age': age,
                'daysUntil': days_until,
                'congratsSent': client_id in sent_client_ids,
                'congratsSentAt': sent_at_map.get(client_id)
            }

            stats_by_month[month_names[month]] += 1
            all_birthdays.append(client_data)

            if days_until == 0:
                today_birthdays.append(client_data)
            elif 0 < days_until <= 30:
                upcoming_birthdays.append(client_data)

        all_birthdays.sort(key=lambda x: x['daysUntil'])
        upcoming_birthdays.sort(key=lambda x: x['daysUntil'])

        stats = [{'month': m, 'count': c} for m, c in stats_by_month.items()]

        return {
            'today': today_birthdays,
            'upcoming': upcoming_birthdays,
            'all': all_birthdays,
            'stats': stats,
            'summary': {
                'total_with_birthday': len(all_birthdays),
                'today_count': len(today_birthdays),
                'this_week': len([b for b in all_birthdays if 0 <= b['daysUntil'] <= 7]),
                'this_month': len([b for b in all_birthdays if 0 <= b['daysUntil'] <= 30])
            }
        }
    except Exception as e:
        logger.error(f'Error getting birthdays: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ───────────── Admin Clients Listing ─────────────

@admin_clients_mgmt_router.get('/admin/clients')
async def get_all_clients(
    request: Request,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
):
    """Get all clients with search, filters and pagination"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')

    query = {'role': {'$nin': ['admin', 'office_assistant']}}

    if search:
        search_clean = search.strip()
        search_query = {
            '$or': [
                {'name': {'$regex': search_clean, '$options': 'i'}},
                {'full_name': {'$regex': search_clean, '$options': 'i'}},
                {'email': {'$regex': search_clean, '$options': 'i'}},
                {'phone': {'$regex': search_clean, '$options': 'i'}}
            ]
        }

        ssn_search = search_clean.replace('-', '').replace(' ', '')
        if ssn_search.isdigit() and len(ssn_search) in (4, 9):
            try:
                ssn_filter = {'ssn_last4': ssn_search} if len(ssn_search) == 4 else {'ssn': ssn_search}
                banking_matches = await _db.client_banking.find(ssn_filter).to_list(100)
                if banking_matches:
                    ssn_name_queries = []
                    for bm in banking_matches:
                        fn = bm.get('first_name', '').strip()
                        ln = bm.get('last_name', '').strip()
                        if fn and ln:
                            ssn_name_queries.append({
                                '$or': [
                                    {'full_name': {'$regex': f'{fn}.*{ln}', '$options': 'i'}},
                                    {'name': {'$regex': f'{fn}.*{ln}', '$options': 'i'}},
                                ]
                            })
                        elif fn:
                            ssn_name_queries.append({
                                '$or': [
                                    {'full_name': {'$regex': fn, '$options': 'i'}},
                                    {'name': {'$regex': fn, '$options': 'i'}},
                                ]
                            })
                    if ssn_name_queries:
                        search_query['$or'].extend(ssn_name_queries)
            except Exception as e:
                print(f"SSN search error (non-critical): {e}")

        query = {'$and': [query, search_query]}

    if type and type in ['individual', 'business']:
        if '$and' in query:
            query['$and'].append({'client_type': type})
        else:
            query['client_type'] = type

    skip = (page - 1) * limit
    total = await _db.users.count_documents(query)
    users = await _db.users.find(query).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)

    banking_lookup = {}
    try:
        all_banking = await _db.client_banking.find(
            {'ssn_last4': {'$ne': '', '$exists': True}},
            {'first_name': 1, 'last_name': 1, 'ssn_last4': 1}
        ).to_list(10000)
        for b in all_banking:
            key = (b.get('first_name', '').strip().upper() + '|' + b.get('last_name', '').strip().upper())
            banking_lookup[key] = b.get('ssn_last4', '')
    except Exception:
        pass

    clients = []
    for user in users:
        user_name = user.get("full_name") or user.get("name", "")
        name_parts = user_name.strip().upper().split(' ', 1)
        name_key = name_parts[0] + '|' + (name_parts[1] if len(name_parts) > 1 else '')
        ssn_last4 = banking_lookup.get(name_key, '')

        clients.append({
            "id": str(user.get("_id", user.get("id", ""))),
            "name": user.get("full_name") or user.get("name", ""),
            "email": user.get("email", ""),
            "phone": user.get("phone", ""),
            "type": user.get("client_type", "individual"),
            "status": user.get("status", "new"),
            "last_update": user.get("updated_at", user.get("created_at")),
            "created_at": user.get("created_at"),
            "metrics": {"documents": 0, "appointments": 0, "next_appointment": None},
            "kyc_completed": user.get("kyc_complete", False),
            "has_app": bool(
                user.get("push_token") or
                user.get("expo_push_token") or
                user.get("device_token") or
                user.get("has_app") or
                user.get("fcm_token") or
                user.get("app_version")
            ),
            "app_version": user.get("app_version", ""),
            "last_app_activity": user.get("last_app_activity", user.get("last_login")),
            "tags": user.get("tags", []),
            "ssn_last4": ssn_last4,
        })

    return {
        'clients': clients,
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
            'total_pages': (total + limit - 1) // limit
        }
    }


# ───────────── Urgent Cases ─────────────

@admin_clients_mgmt_router.get('/admin/urgent-cases/count')
async def get_urgent_cases_count(request: Request):
    """Get count of urgent cases (deadline <= 7 days and not completed)"""
    await _require_admin(request)
    try:
        seven_days_from_now = datetime.utcnow() + timedelta(days=7)
        urgent_count = await _db.users.count_documents({
            'role': 'client',
            '$or': [
                {
                    'tax_deadline': {
                        '$exists': True,
                        '$lte': seven_days_from_now,
                        '$gte': datetime.utcnow()
                    },
                    'tax_status': {'$nin': ['completed', 'filed', 'approved']}
                },
                {
                    'appointment_deadline': {
                        '$exists': True,
                        '$lte': seven_days_from_now,
                        '$gte': datetime.utcnow()
                    }
                }
            ]
        })
        return {'count': urgent_count}
    except Exception as e:
        logger.error(f"Error getting urgent cases count: {str(e)}")
        return {'count': 0}


@admin_clients_mgmt_router.get('/admin/urgent-cases')
async def get_urgent_cases(request: Request):
    """Get list of urgent cases with details"""
    await _require_admin(request)
    try:
        seven_days_from_now = datetime.utcnow() + timedelta(days=7)
        now = datetime.utcnow()

        urgent_clients = await _db.users.find({
            'role': 'client',
            '$or': [
                {
                    'tax_deadline': {
                        '$exists': True,
                        '$lte': seven_days_from_now,
                        '$gte': now
                    },
                    'tax_status': {'$nin': ['completed', 'filed', 'approved']}
                }
            ]
        }).to_list(100)

        cases = []
        for client in urgent_clients:
            deadline = client.get('tax_deadline', now)
            if isinstance(deadline, str):
                try:
                    deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                except Exception:
                    deadline = now

            days_until_deadline = (deadline - now).days

            client_docs = await _db.documents.find({
                'user_id': client.get('id', client.get('_id'))
            }).to_list(None)

            required_docs = ['W-2', '1099', 'ID', 'Social Security Card']
            uploaded_categories = set()
            for doc in client_docs:
                category = doc.get('category', '').upper()
                if 'W-2' in category or 'W2' in category:
                    uploaded_categories.add('W-2')
                elif '1099' in category:
                    uploaded_categories.add('1099')
                elif 'ID' in category:
                    uploaded_categories.add('ID')
                elif 'SOCIAL' in category:
                    uploaded_categories.add('Social Security Card')

            missing_items = [d for d in required_docs if d not in uploaded_categories]

            cases.append({
                'id': client.get('id', str(client.get('_id'))),
                'client_name': client.get('full_name', client.get('name', 'N/A')),
                'client_email': client.get('email', 'N/A'),
                'status': client.get('tax_status', 'pending'),
                'deadline': deadline.isoformat() if deadline else None,
                'days_until_deadline': max(0, days_until_deadline),
                'missing_items': missing_items
            })

        cases.sort(key=lambda x: x['days_until_deadline'])
        return {'cases': cases}

    except Exception as e:
        logger.error(f"Error getting urgent cases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ───────────── Client Notes ─────────────

@admin_clients_mgmt_router.post('/admin/clients/{user_id}/notes')
async def add_client_note(user_id: str, request: Request):
    """Add a note to client history"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')

    body = await request.json()
    note_data = ClientNoteRequest(**body)

    user = None
    if ObjectId.is_valid(user_id):
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        user = await _db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')

    note = {
        'user_id': user_id,
        'admin_id': current_user['id'],
        'admin_name': current_user.get('name', current_user.get('full_name', 'Admin')),
        'content': note_data.content,
        'category': note_data.category,
        'created_at': datetime.now(timezone.utc)
    }

    result = await _db.client_notes.insert_one(note)
    return {'message': 'Note added successfully', 'note_id': str(result.inserted_id)}


@admin_clients_mgmt_router.get('/admin/clients/{user_id}/notes')
async def get_client_notes(user_id: str, request: Request):
    """Get all notes for a client"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')

    notes = await _db.client_notes.find({'user_id': user_id}).sort('created_at', -1).to_list(100)

    return [{
        'id': str(note['_id']),
        'admin_name': note.get('admin_name', 'System'),
        'content': note['content'],
        'category': note.get('category', 'general'),
        'created_at': note['created_at']
    } for note in notes]


# ───────────── Request Documents ─────────────

@admin_clients_mgmt_router.post('/admin/clients/{user_id}/request-documents')
async def request_documents_from_client(user_id: str, request: Request):
    """Send document request to client"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')

    body = await request.json()
    request_data = RequestDocumentsRequest(**body)

    user = None
    if ObjectId.is_valid(user_id):
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        user = await _db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail='Client not found')

    doc_request = {
        'user_id': user_id,
        'admin_id': current_user['id'],
        'admin_name': current_user.get('name', current_user.get('full_name', 'Admin')),
        'document_types': request_data.document_types,
        'message': request_data.message,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc),
        'expires_at': datetime.now(timezone.utc) + timedelta(days=7)
    }

    result = await _db.document_requests.insert_one(doc_request)
    request_id = str(result.inserted_id)

    try:
        from rise_crm_sync_service import rise_sync_service
        if rise_sync_service and rise_sync_service.rise_service.sync_enabled:
            asyncio.create_task(rise_sync_service.sync_document_request_to_rise(request_id))
    except Exception as sync_error:
        print(f"⚠️ Auto-sync failed (non-critical): {str(sync_error)}")

    secure_link = f"https://rosstaxpreparation.com/upload-documents?request_id={request_id}"

    note_content = f"Solicitud de documentos enviada: {', '.join(request_data.document_types)}"
    await _db.client_notes.insert_one({
        'user_id': user_id,
        'admin_id': current_user['id'],
        'admin_name': current_user.get('name', current_user.get('full_name', 'Admin')),
        'content': note_content,
        'category': 'document_request',
        'created_at': datetime.now(timezone.utc)
    })

    notifications_sent = {'email': False, 'sms': False, 'whatsapp': False}
    client_email = user.get('email')
    client_phone = user.get('phone')
    client_name = user.get('name', 'Cliente')
    documents_text = ', '.join(request_data.document_types)

    if _notification_service:
        if client_email:
            try:
                await _notification_service.send_document_request_email(
                    to_email=client_email, user_name=client_name,
                    document_name=documents_text, priority="normal"
                )
                notifications_sent['email'] = True
            except Exception as email_error:
                print(f"❌ Failed to send email: {email_error}")

        if client_phone:
            try:
                await _notification_service.send_document_request_sms(
                    to_phone=client_phone, user_name=client_name,
                    document_name=documents_text
                )
                notifications_sent['sms'] = True
            except Exception as sms_error:
                print(f"❌ Failed to send SMS: {sms_error}")

    if client_phone:
        try:
            import re
            phone_clean = re.sub(r'\D', '', client_phone)
            if len(phone_clean) == 10:
                phone_clean = f"1{phone_clean}"

            whatsapp_message = f"""📋 *Solicitud de Documentos*

Hola {client_name},

Para continuar con tu proceso de impuestos, necesitamos los siguientes documentos:

📄 *Documentos solicitados:*
{chr(10).join([f"• {doc}" for doc in request_data.document_types])}

{f"💬 *Mensaje del asesor:* {request_data.message}" if request_data.message else ""}

📲 *¿Cómo enviar tus documentos?*
1. Puedes enviarlos directamente por este WhatsApp
2. Subirlos desde nuestra app móvil
3. Enviarlos por email a docu@rosstaxpreparation.com

⏰ Esta solicitud expira en 7 días.

¿Tienes alguna pregunta? ¡Responde a este mensaje!

*Ross Tax Preparation*
📞 (806) 934-2018"""

            if _whatsapp_service:
                send_result = await _whatsapp_service.send_message(to=phone_clean, message=whatsapp_message)
                if send_result.get('success'):
                    notifications_sent['whatsapp'] = True
        except Exception as whatsapp_error:
            print(f"❌ Failed to send WhatsApp: {whatsapp_error}")

    return {
        'message': 'Document request created successfully',
        'request_id': request_id,
        'secure_link': secure_link,
        'expires_at': doc_request['expires_at'],
        'notifications_sent': notifications_sent
    }


# ───────────── KYC Verification ─────────────

@admin_clients_mgmt_router.patch('/admin/kyc/{user_id}/verify')
async def verify_client_kyc(user_id: str, request: Request):
    """Mark client KYC as verified"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')

    result = await _db.kyc_data.update_one(
        {'user_id': user_id},
        {'$set': {'verified': True, 'updated_at': datetime.now(timezone.utc)}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='KYC data not found')
    return {'message': 'KYC verified successfully'}


# ───────────── Admin Documents ─────────────

@admin_clients_mgmt_router.get('/admin/documents')
async def get_all_documents(request: Request):
    """Get all documents for admin review"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')

    docs = await _db.documents.find({}).sort('uploaded_at', -1).limit(100).to_list(100)

    result = []
    for doc in docs:
        user = None
        doc_user_id = doc.get('user_id')

        if doc_user_id:
            user = await _db.users.find_one({'_id': doc_user_id})
            if not user:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(doc_user_id)})
                except Exception:
                    pass
            if not user:
                user = await _db.users.find_one({'id': doc_user_id})

        user_name = 'Cliente'
        user_email = 'Sin email'
        if user:
            user_name = user.get('full_name') or user.get('name') or user.get('email', 'Cliente')
            user_email = user.get('email', 'Sin email')

        uploaded_at = doc.get('uploaded_at')
        uploaded_at_str = uploaded_at.isoformat() if isinstance(uploaded_at, datetime) else str(uploaded_at) if uploaded_at else None

        doc_data = {
            'id': doc.get('id', str(doc.get('_id', ''))),
            'user_id': doc.get('user_id', ''),
            'user_name': user_name,
            'user_email': user_email,
            'name': doc.get('name', 'Sin nombre'),
            'category': doc.get('category', 'other'),
            'file_type': doc.get('file_type', 'unknown'),
            'size': doc.get('size', 0),
            'uploaded_at': uploaded_at_str,
            'reviewed': doc.get('reviewed', False),
        }
        result.append(doc_data)

    return result
