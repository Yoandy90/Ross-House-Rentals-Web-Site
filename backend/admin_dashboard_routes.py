"""
Admin Dashboard Routes Router
Extracted from server.py for modularization.
Handles admin dashboard stats, realtime metrics, charts, API config, app adoption, and invitations.
"""
import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query, Body
from bson import ObjectId

logger = logging.getLogger(__name__)

admin_dashboard_router = APIRouter()
_db = None


def init_admin_dashboard_router(db):
    global _db
    _db = db


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
            user = await _db.users.find_one({'_id': ObjectId(session['user_id'])})
        except:
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


# ================== ADMIN DASHBOARD ==================

@admin_dashboard_router.get('/admin/dashboard')
async def get_admin_dashboard(request: Request):
    current_user = await _require_admin(request)
    
    total_users = await _db.users.count_documents({'role': {'$nin': ['admin', 'office_assistant']}})
    total_kyc_completed = await _db.kyc_data.count_documents({'completed': True})
    total_documents = await _db.documents.count_documents({})
    pending_documents = await _db.documents.count_documents({'reviewed': {'$ne': True}})
    total_appointments = await _db.appointments.count_documents({})
    total_tax_returns = await _db.tax_returns.count_documents({})
    total_completed_returns = await _db.completed_tax_returns.count_documents({})
    
    total_invoices = await _db.invoices.count_documents({})
    pending_invoices = await _db.invoices.count_documents({'status': 'pending'})
    paid_invoices = await _db.invoices.count_documents({'status': 'paid'})
    
    recent_users = await _db.users.find({'role': {'$nin': ['admin', 'office_assistant']}}).sort('created_at', -1).limit(5).to_list(5)
    recent_documents = await _db.documents.find({}).sort('uploaded_at', -1).limit(10).to_list(10)
    pending_review_docs = await _db.documents.find({'reviewed': {'$ne': True}}).sort('uploaded_at', -1).limit(5).to_list(5)
    upcoming_appointments = await _db.appointments.find({
        'scheduled_at': {'$gte': datetime.now(timezone.utc)},
        'status': 'scheduled'
    }).sort('scheduled_at', 1).limit(10).to_list(10)
    
    kyc_completion_rate = (total_kyc_completed / total_users * 100) if total_users > 0 else 0
    
    return {
        'statistics': {
            'total_users': total_users,
            'total_kyc_completed': total_kyc_completed,
            'kyc_completion_rate': round(kyc_completion_rate, 1),
            'total_documents': total_documents,
            'pending_documents': pending_documents,
            'total_appointments': total_appointments,
            'total_tax_returns': total_tax_returns,
            'total_completed_returns': total_completed_returns,
            'total_invoices': total_invoices,
            'pending_invoices': pending_invoices,
            'paid_invoices': paid_invoices,
        },
        'recent_users': [{
            'id': str(u['_id']),
            'name': u.get('full_name') or u.get('name', 'Sin nombre'),
            'email': u.get('email', ''),
            'created_at': u.get('created_at')
        } for u in recent_users],
        'recent_documents': [{
            'id': str(d['_id']),
            'user_id': str(d.get('user_id', '')),
            'name': d.get('name', 'Documento'),
            'category': d.get('category', 'other'),
            'uploaded_at': d.get('uploaded_at').isoformat() if d.get('uploaded_at') else None
        } for d in recent_documents],
        'pending_review_docs': [{
            'id': d.get('id'),
            'user_id': d.get('user_id'),
            'name': d.get('name', 'Documento'),
            'category': d.get('category', 'other'),
            'uploaded_at': d.get('uploaded_at').isoformat() if d.get('uploaded_at') else None
        } for d in pending_review_docs],
        'upcoming_appointments': [{
            'id': str(a['_id']),
            'title': a.get('appointment_type', 'Cita'),
            'scheduled_at': a.get('scheduled_at'),
            'status': a.get('status', 'scheduled')
        } for a in upcoming_appointments],
    }


@admin_dashboard_router.get('/admin/dashboard/realtime')
async def get_admin_realtime_metrics(request: Request):
    current_user = await _require_admin(request)
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    new_clients_today = await _db.users.count_documents({
        'role': {'$nin': ['admin', 'office_assistant']},
        'created_at': {'$gte': today_start}
    })
    
    docs_uploaded_today = await _db.documents.count_documents({
        'uploaded_at': {'$gte': today_start}
    })
    
    docs_pending_review = await _db.documents.count_documents({'reviewed': {'$ne': True}})
    
    appointments_today = await _db.appointments.count_documents({
        'scheduled_at': {
            '$gte': today_start,
            '$lt': today_start + timedelta(days=1)
        }
    })
    
    active_sessions_today = await _db.tax_wizard_sessions.count_documents({
        'updated_at': {'$gte': today_start}
    })
    
    messages_today = await _db.chat_messages.count_documents({
        'created_at': {'$gte': today_start}
    })
    
    paid_today_cursor = _db.invoices.find({
        'status': 'paid',
        'paid_at': {'$gte': today_start}
    })
    paid_today = await paid_today_cursor.to_list(100)
    revenue_today = sum(inv.get('amount', 0) for inv in paid_today)
    
    pending_declarations = await _db.tax_wizard_sessions.count_documents({
        'status': {'$in': ['in_progress', 'pending_review']}
    })
    
    new_dependents_today = await _db.dependents.count_documents({
        'created_at': {'$gte': today_start}
    })
    
    return {
        'today': {
            'new_clients': new_clients_today,
            'docs_uploaded': docs_uploaded_today,
            'docs_pending_review': docs_pending_review,
            'appointments': appointments_today,
            'active_sessions': active_sessions_today,
            'messages': messages_today,
            'revenue': revenue_today,
            'pending_declarations': pending_declarations,
            'new_dependents': new_dependents_today,
        },
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }


@admin_dashboard_router.get('/admin/dashboard/charts')
async def get_dashboard_charts(request: Request):
    current_user = await _require_admin(request)
    try:
        from dateutil.relativedelta import relativedelta
        
        months_data = []
        month_names_es = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        
        for i in range(5, -1, -1):
            target_date = datetime.now(timezone.utc) - relativedelta(months=i)
            month_start = target_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if i == 0:
                month_end = datetime.now(timezone.utc)
            else:
                month_end = (month_start + relativedelta(months=1)) - relativedelta(seconds=1)
            
            new_clients = await _db.users.count_documents({
                'role': {'$nin': ['admin', 'office_assistant']},
                'created_at': {'$gte': month_start, '$lte': month_end}
            })
            
            appointments = await _db.appointments.count_documents({
                'scheduled_at': {'$gte': month_start, '$lte': month_end}
            })
            
            completed_appointments = await _db.appointments.count_documents({
                'scheduled_at': {'$gte': month_start, '$lte': month_end},
                'status': 'completed'
            })
            
            revenue_pipeline = [
                {
                    '$match': {
                        'status': 'paid',
                        '$or': [
                            {'paid_at': {'$gte': month_start, '$lte': month_end}},
                            {'updated_at': {'$gte': month_start, '$lte': month_end}, 'status': 'paid'}
                        ]
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$amount'}
                    }
                }
            ]
            revenue_result = await _db.invoices.aggregate(revenue_pipeline).to_list(1)
            revenue = revenue_result[0]['total'] if revenue_result else 0
            
            documents = await _db.documents.count_documents({
                'uploaded_at': {'$gte': month_start, '$lte': month_end}
            })
            
            tax_returns = await _db.completed_tax_returns.count_documents({
                'created_at': {'$gte': month_start, '$lte': month_end}
            })
            
            months_data.append({
                'month': month_names_es[target_date.month - 1],
                'month_number': target_date.month,
                'year': target_date.year,
                'clients': new_clients,
                'appointments': appointments,
                'completed_appointments': completed_appointments,
                'revenue': round(revenue, 2),
                'documents': documents,
                'tax_returns': tax_returns,
            })
        
        lead_sources_pipeline = [
            {'$group': {'_id': '$source', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 6}
        ]
        lead_sources = await _db.leads.aggregate(lead_sources_pipeline).to_list(6)
        
        source_labels = {
            'whatsapp': 'WhatsApp', 'website': 'Sitio Web', 'referral': 'Referido',
            'facebook': 'Facebook', 'google': 'Google', 'instagram': 'Instagram',
            'call': 'Llamada', 'other': 'Otro'
        }
        
        lead_sources_data = [
            {'name': source_labels.get(s['_id'], s['_id'] or 'Desconocido'), 'value': s['count']}
            for s in lead_sources if s['_id']
        ]
        
        appointment_types_pipeline = [
            {'$group': {'_id': '$appointment_type', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        appointment_types_raw = await _db.appointments.aggregate(appointment_types_pipeline).to_list(10)
        
        type_names = {}
        types_cursor = await _db.appointment_types.find({}).to_list(100)
        for t in types_cursor:
            type_names[str(t.get('_id'))] = t.get('title', t.get('name', 'Sin tipo'))
            type_names[t.get('title', '')] = t.get('title', 'Sin tipo')
            type_names[t.get('name', '')] = t.get('title', t.get('name', 'Sin tipo'))
        
        type_mapping = {
            'consultation': 'Preparación de Impuestos', 'Consulta': 'Preparación de Impuestos',
            'ConsultaGeneral': 'Preparación de Impuestos', 'General': 'Preparación de Impuestos',
            'in_person': 'Presencial', 'video_call': 'Videollamada',
            'tax_preparation': 'Preparación de Impuestos', 'other': 'Otro', 'Otro': 'Otro',
        }
        
        aggregated = {}
        for a in appointment_types_raw:
            if a['_id']:
                raw_name = a['_id']
                mapped_name = type_names.get(raw_name) or type_mapping.get(raw_name) or raw_name
                if mapped_name in aggregated:
                    aggregated[mapped_name] += a['count']
                else:
                    aggregated[mapped_name] = a['count']
        
        appointment_types_data = [
            {'name': name, 'value': count}
            for name, count in sorted(aggregated.items(), key=lambda x: x[1], reverse=True)
        ][:5]
        
        return {
            'monthly_trends': months_data,
            'lead_sources': lead_sources_data,
            'appointment_types': appointment_types_data,
        }
    except Exception as e:
        logging.error(f'Error getting dashboard charts: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_dashboard_router.get('/admin/api-config')
async def get_api_config(request: Request):
    current_user = await _require_admin(request)
    
    try:
        from unified_config_manager import config_manager
        if not config_manager._initialized:
            config_manager.set_db(_db)
            await config_manager.seed_from_env()
        
        all_settings = await config_manager.get_all()
        masked = {}
        raw_status = {}
        
        from unified_config_manager import SENSITIVE_KEYS
        for key, value in all_settings.items():
            val_str = str(value) if value else ''
            if key in SENSITIVE_KEYS and val_str and len(val_str) > 6:
                masked[key] = '****' + val_str[-4:]
            else:
                masked[key] = val_str
            raw_status[key] = bool(val_str and not val_str.startswith('****'))

        service_status = await config_manager.get_status()

        return {
            'success': True,
            'settings': masked,
            'configured': raw_status,
            'services': service_status,
        }
    except Exception as e:
        # Fallback to old method
        config = await _db.api_config.find_one({'_id': 'main'})
        if not config:
            return {'success': True, 'settings': {}, 'configured': {}, 'services': {}}
        config.pop('_id', None)
        return {'success': True, 'settings': config, 'configured': {}, 'services': {}}


@admin_dashboard_router.post('/admin/api-config')
async def save_api_config(request: Request):
    current_user = await _require_admin(request)
    
    config_data = await request.json()
    
    try:
        from unified_config_manager import config_manager, ENV_KEY_MAP
        import os as _os
        if not config_manager._initialized:
            config_manager.set_db(_db)
        
        updated_keys = []
        settings_data = config_data.get('settings', config_data)
        
        for key, value in settings_data.items():
            val_str = str(value).strip() if value else ''
            if val_str.startswith('****') or not val_str:
                continue
            await config_manager.set(key, val_str)
            env_key = ENV_KEY_MAP.get(key, key.upper())
            _os.environ[env_key] = val_str
            updated_keys.append(key)
        
        config_manager.invalidate_cache()
        
        return {
            'success': True,
            'updated': updated_keys,
            'message': f'{len(updated_keys)} claves actualizadas exitosamente'
        }
    except Exception as e:
        # Fallback to old method
        existing_config = await _db.api_config.find_one({'_id': 'main'})
        final_config = {}
        sensitive_fields = ['twilio_auth_token', 'sendgrid_api_key', 'google_client_secret',
            'stripe_api_key', 'stripe_webhook_secret']
        
        for key, value in config_data.items():
            if value:
                if key in sensitive_fields and str(value).startswith('****'):
                    if existing_config and key in existing_config:
                        final_config[key] = existing_config[key]
                else:
                    final_config[key] = value
        
        final_config['_id'] = 'main'
        final_config['updated_at'] = datetime.now(timezone.utc).isoformat()
        final_config['updated_by'] = current_user['id']
        await _db.api_config.replace_one({'_id': 'main'}, final_config, upsert=True)
        return {'success': True, 'message': 'Configuration saved'}


@admin_dashboard_router.get('/admin/app-adoption')
async def get_app_adoption(request: Request):
    current_user = await _require_admin(request)
    try:
        users_clients = await _db.users.find({'role': 'client'}).to_list(None)
        clients_collection = await _db.clients.find({}).to_list(None)
        
        seen_emails = set()
        all_clients = []
        
        for c in users_clients:
            email = (c.get('email') or '').lower().strip()
            if email and email not in seen_emails:
                seen_emails.add(email)
                all_clients.append({
                    'id': str(c.get('_id', '')),
                    'name': c.get('name') or c.get('full_name') or 'Sin nombre',
                    'email': c.get('email', ''),
                    'phone': c.get('phone'),
                    'has_app': c.get('has_app', False),
                    'last_app_access': c.get('last_app_access'),
                    'created_at': str(c.get('created_at', '')) if c.get('created_at') else None,
                    'source': 'users'
                })
        
        for c in clients_collection:
            email = (c.get('email') or '').lower().strip()
            if email and email not in seen_emails:
                seen_emails.add(email)
                all_clients.append({
                    'id': str(c.get('_id', '')),
                    'name': c.get('name') or 'Sin nombre',
                    'email': c.get('email', ''),
                    'phone': c.get('phone'),
                    'has_app': c.get('has_app', False),
                    'last_app_access': c.get('last_app_access'),
                    'created_at': str(c.get('created_at', '')) if c.get('created_at') else None,
                    'source': 'clients'
                })
        
        total = len(all_clients)
        with_app = sum(1 for c in all_clients if c.get('has_app', False))
        without_app = total - with_app
        adoption_rate = round((with_app / total * 100) if total > 0 else 0, 1)
        
        all_clients.sort(key=lambda x: (x['has_app'], x.get('name') or 'zzz'))
        
        return {
            'stats': {
                'total': total, 'with_app': with_app,
                'without_app': without_app, 'adoption_rate': adoption_rate,
            },
            'clients': all_clients,
        }
    except Exception as e:
        logging.error(f"Error in app-adoption: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@admin_dashboard_router.post('/admin/send-app-invitation')
async def send_app_invitation(request: Request):
    current_user = await _require_admin(request)
    
    data = await request.json()
    client_ids = data.get('client_ids', [])
    method = data.get('method', 'email')
    
    if not client_ids:
        raise HTTPException(status_code=400, detail='No clients selected')
    
    api_config = await _db.api_config.find_one({'_id': 'main'})
    
    clients = await _db.users.find({
        '_id': {'$in': [ObjectId(cid) for cid in client_ids if ObjectId.is_valid(cid)]},
        'role': 'client'
    }).to_list(None)
    
    if not clients:
        raise HTTPException(status_code=404, detail='No clients found')
    
    success_count = 0
    failed_count = 0
    
    ios_link = "https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX"
    android_link = "https://play.google.com/store/apps/your-app-link"
    
    for client in clients:
        try:
            if method == 'email':
                subject = "¡Descarga nuestra App de ROSS Tax Preparation!"
                html_content = f"""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #8B0000;">¡Hola {client.get('name', 'Cliente')}!</h2>
                        <p>Te invitamos a descargar nuestra aplicación móvil de ROSS Tax Preparation para que puedas:</p>
                        <ul>
                            <li>✅ Ver el estado de tu declaración de impuestos</li>
                            <li>✅ Subir documentos de forma segura</li>
                            <li>✅ Agendar citas</li>
                            <li>✅ Recibir notificaciones en tiempo real</li>
                            <li>✅ Chatear con nuestro equipo</li>
                        </ul>
                        <div style="margin: 30px 0;">
                            <a href="{ios_link}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin-right: 10px;">📱 Descargar para iOS</a>
                            <a href="{android_link}" style="display: inline-block; padding: 12px 24px; background-color: #3DDC84; color: #fff; text-decoration: none; border-radius: 5px;">🤖 Descargar para Android</a>
                        </div>
                        <p>¡Gracias por confiar en nosotros!</p>
                        <p style="color: #666; font-size: 12px; margin-top: 30px;">ROSS Tax Preparation<br>Este es un correo automático, por favor no responder.</p>
                    </div>
                </body>
                </html>
                """
                try:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_svc = NotificationService(config_doc)
                        if notif_svc.sendgrid_client:
                            await notif_svc.send_email(client['email'], subject, html_content)
                            success_count += 1
                        else:
                            failed_count += 1
                    else:
                        failed_count += 1
                except Exception as email_error:
                    logging.error(f"Email failed for {client.get('email')}: {email_error}")
                    failed_count += 1
            
            elif method == 'sms':
                if not client.get('phone'):
                    failed_count += 1
                    continue
                
                sms_content = f"Hola {client.get('name', 'Cliente')}! Descarga la app de ROSS Tax Preparation para gestionar tus impuestos: {android_link} 📱"
                
                try:
                    config_doc = await _db.api_config.find_one({'_id': 'main'})
                    if config_doc:
                        from notification_service import NotificationService
                        notif_svc = NotificationService(config_doc)
                        if notif_svc.twilio_client:
                            notif_svc.twilio_client.messages.create(
                                body=sms_content,
                                from_=notif_svc.twilio_phone_number,
                                to=client['phone']
                            )
                            success_count += 1
                        else:
                            failed_count += 1
                    else:
                        failed_count += 1
                except Exception as sms_error:
                    logging.error(f"SMS failed for {client.get('phone')}: {sms_error}")
                    failed_count += 1
        except Exception as e:
            logging.error(f"Error sending to {client.get('email')}: {e}")
            failed_count += 1
    
    return {
        'message': 'Invitations sent successfully',
        'success': success_count,
        'failed': failed_count,
        'total': len(clients)
    }



# ================== ENHANCED DASHBOARD - CLOCK, TEAM, INVOICE OVERVIEW, TASKS ==================

@admin_dashboard_router.post('/admin/clock')
async def clock_in_out(request: Request):
    """Clock in or clock out for the current admin user."""
    user = await _require_admin(request)
    user_id = user.get('id') or str(user.get('_id', ''))
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Find today's active clock record
    active = await _db.clock_records.find_one({
        'user_id': user_id,
        'clock_in': {'$gte': today_start},
        'clock_out': None
    })

    if active:
        # Clock OUT
        elapsed = (now - active['clock_in']).total_seconds()
        await _db.clock_records.update_one(
            {'_id': active['_id']},
            {'$set': {'clock_out': now, 'total_seconds': elapsed}}
        )
        return {'status': 'clocked_out', 'clock_out': now.isoformat(), 'total_seconds': elapsed}
    else:
        # Clock IN
        await _db.clock_records.insert_one({
            'user_id': user_id,
            'user_name': user.get('full_name') or user.get('name', 'Admin'),
            'clock_in': now,
            'clock_out': None,
            'total_seconds': 0,
            'date': today_start
        })
        return {'status': 'clocked_in', 'clock_in': now.isoformat()}


@admin_dashboard_router.get('/admin/clock/status')
async def get_clock_status(request: Request):
    """Get clock status for current user."""
    user = await _require_admin(request)
    user_id = user.get('id') or str(user.get('_id', ''))
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    active = await _db.clock_records.find_one({
        'user_id': user_id,
        'clock_in': {'$gte': today_start},
        'clock_out': None
    })

    # Total hours worked today
    today_records = await _db.clock_records.find({
        'user_id': user_id,
        'date': today_start
    }).to_list(50)

    total_today = sum(r.get('total_seconds', 0) for r in today_records if r.get('clock_out'))

    if active:
        return {
            'is_clocked_in': True,
            'clock_in': active['clock_in'].isoformat(),
            'total_today_seconds': total_today,
        }
    return {
        'is_clocked_in': False,
        'clock_in': None,
        'total_today_seconds': total_today,
    }


@admin_dashboard_router.get('/admin/team/status')
async def get_team_status(request: Request):
    """Get all team members and their clock status."""
    await _require_admin(request)
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get all admin/staff users
    team = await _db.users.find({
        'role': {'$in': ['admin', 'office_assistant']}
    }).to_list(50)

    members = []
    clocked_in = 0
    clocked_out = 0

    for m in team:
        uid = str(m['_id'])
        active = await _db.clock_records.find_one({
            'user_id': uid,
            'clock_in': {'$gte': today_start},
            'clock_out': None
        })
        is_in = active is not None
        if is_in:
            clocked_in += 1
        else:
            clocked_out += 1

        members.append({
            'id': uid,
            'name': m.get('full_name') or m.get('name', 'Team Member'),
            'email': m.get('email', ''),
            'is_clocked_in': is_in,
            'clock_in': active['clock_in'].isoformat() if active else None,
        })

    return {
        'total': len(team),
        'clocked_in': clocked_in,
        'clocked_out': clocked_out,
        'on_leave': 0,
        'members': members
    }


@admin_dashboard_router.get('/admin/dashboard/invoice-overview')
async def get_invoice_overview(request: Request):
    """Detailed invoice breakdown by status with amounts."""
    await _require_admin(request)

    pipeline_statuses = ['pending', 'paid', 'overdue', 'partially_paid', 'draft', 'cancelled']
    result = {}
    total_invoiced = 0
    total_due = 0

    for status in pipeline_statuses:
        docs = await _db.invoices.find({'status': status}).to_list(10000)
        count = len(docs)
        amount = sum(d.get('amount', 0) or 0 for d in docs)
        result[status] = {'count': count, 'amount': round(amount, 2)}
        total_invoiced += amount
        if status in ['pending', 'overdue', 'partially_paid']:
            total_due += amount

    # Monthly revenue for last 12 months (mini chart)
    from dateutil.relativedelta import relativedelta
    now = datetime.now(timezone.utc)
    monthly_revenue = []
    for i in range(11, -1, -1):
        month_start = (now - relativedelta(months=i)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            month_end = (now - relativedelta(months=i - 1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            month_end = now

        paid_docs = await _db.invoices.find({
            'status': 'paid',
            'paid_at': {'$gte': month_start, '$lt': month_end}
        }).to_list(10000)
        rev = sum(d.get('amount', 0) or 0 for d in paid_docs)
        monthly_revenue.append({
            'month': month_start.strftime('%b'),
            'revenue': round(rev, 2)
        })

    return {
        'statuses': result,
        'total_invoiced': round(total_invoiced, 2),
        'total_due': round(total_due, 2),
        'monthly_revenue': monthly_revenue
    }


@admin_dashboard_router.get('/admin/dashboard/tasks-overview')
async def get_tasks_overview(request: Request):
    """Overview of all task-like items across the system."""
    await _require_admin(request)

    # Leads as "tasks"
    leads_new = await _db.leads.count_documents({'status': 'new'})
    leads_contacted = await _db.leads.count_documents({'status': 'contacted'})
    leads_qualified = await _db.leads.count_documents({'status': 'qualified'})
    leads_converted = await _db.leads.count_documents({'status': 'converted'})
    leads_lost = await _db.leads.count_documents({'status': 'lost'})

    # Documents pending review
    docs_pending = await _db.documents.count_documents({'reviewed': {'$ne': True}})
    docs_reviewed = await _db.documents.count_documents({'reviewed': True})

    # Invoices pending
    inv_pending = await _db.invoices.count_documents({'status': 'pending'})
    inv_paid = await _db.invoices.count_documents({'status': 'paid'})
    inv_overdue = await _db.invoices.count_documents({'status': 'overdue'})

    # Appointments
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    appt_upcoming = await _db.appointments.count_documents({
        'scheduled_at': {'$gte': now},
        'status': 'scheduled'
    })
    appt_completed = await _db.appointments.count_documents({'status': 'completed'})

    # Tax wizard sessions
    wizard_pending = await _db.tax_wizard_sessions.count_documents({
        'status': {'$in': ['in_progress', 'pending_review']}
    })
    wizard_complete = await _db.tax_wizard_sessions.count_documents({'status': 'completed'})

    # Aggregate into task categories
    to_do = leads_new + docs_pending + inv_pending
    in_progress = leads_contacted + leads_qualified + wizard_pending + appt_upcoming
    done = leads_converted + docs_reviewed + inv_paid + wizard_complete + appt_completed
    overdue = leads_lost + inv_overdue

    return {
        'summary': {
            'to_do': to_do,
            'in_progress': in_progress,
            'done': done,
            'overdue': overdue,
            'total': to_do + in_progress + done + overdue
        },
        'breakdown': {
            'leads': {'new': leads_new, 'contacted': leads_contacted, 'qualified': leads_qualified, 'converted': leads_converted, 'lost': leads_lost},
            'documents': {'pending': docs_pending, 'reviewed': docs_reviewed},
            'invoices': {'pending': inv_pending, 'paid': inv_paid, 'overdue': inv_overdue},
            'appointments': {'upcoming': appt_upcoming, 'completed': appt_completed},
            'tax_wizard': {'pending': wizard_pending, 'completed': wizard_complete}
        }
    }


@admin_dashboard_router.get('/admin/dashboard/income-expenses')
async def get_income_expenses(request: Request):
    """Income vs expenses overview for this year and last year."""
    await _require_admin(request)
    from dateutil.relativedelta import relativedelta
    now = datetime.now(timezone.utc)
    this_year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    last_year_start = this_year_start - relativedelta(years=1)
    last_year_end = this_year_start

    # This year income (paid invoices)
    this_year_paid = await _db.invoices.find({
        'status': 'paid',
        'paid_at': {'$gte': this_year_start}
    }).to_list(10000)
    this_year_income = sum(d.get('amount', 0) or 0 for d in this_year_paid)

    # Last year income
    last_year_paid = await _db.invoices.find({
        'status': 'paid',
        'paid_at': {'$gte': last_year_start, '$lt': last_year_end}
    }).to_list(10000)
    last_year_income = sum(d.get('amount', 0) or 0 for d in last_year_paid)

    # Expenses (from expenses collection or properties)
    this_year_expenses_docs = await _db.expenses.find({
        'date': {'$gte': this_year_start}
    }).to_list(10000) if 'expenses' in await _db.list_collection_names() else []
    this_year_expenses = sum(d.get('amount', 0) or 0 for d in this_year_expenses_docs)

    last_year_expenses_docs = await _db.expenses.find({
        'date': {'$gte': last_year_start, '$lt': last_year_end}
    }).to_list(10000) if 'expenses' in await _db.list_collection_names() else []
    last_year_expenses = sum(d.get('amount', 0) or 0 for d in last_year_expenses_docs)

    # Monthly breakdown this year
    monthly = []
    for i in range(12):
        m_start = this_year_start + relativedelta(months=i)
        m_end = m_start + relativedelta(months=1)
        if m_start > now:
            break
        m_paid = await _db.invoices.find({
            'status': 'paid',
            'paid_at': {'$gte': m_start, '$lt': m_end}
        }).to_list(10000)
        m_income = sum(d.get('amount', 0) or 0 for d in m_paid)
        monthly.append({
            'month': m_start.strftime('%b'),
            'income': round(m_income, 2),
            'expenses': 0  # will be populated when expenses module is active
        })

    return {
        'this_year': {'income': round(this_year_income, 2), 'expenses': round(this_year_expenses, 2)},
        'last_year': {'income': round(last_year_income, 2), 'expenses': round(last_year_expenses, 2)},
        'monthly': monthly
    }
