"""
Campaign & App Announcement Routes
Extracted from server.py — Debug endpoints, campaign sending, email templates.
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from datetime import datetime, timezone
from bson import ObjectId
import logging
import asyncio
import uuid

logger = logging.getLogger(__name__)

campaign_routes_router = APIRouter()

_db = None


def init_campaign_routes_router(db):
    global _db
    _db = db


# ── Auth helpers ──

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


# ───────────── Debug Endpoints ─────────────

@campaign_routes_router.get('/debug/campaign-clients')
async def debug_campaign_clients():
    """DEBUG: Get campaign clients without auth"""
    try:
        total_users = await _db.users.count_documents({})
        non_admin = await _db.users.count_documents({'role': {'$nin': ['admin', 'office_assistant']}})

        sample = await _db.users.find({}).limit(5).to_list(5)
        sample_data = []
        for u in sample:
            sample_data.append({
                'id': str(u.get('_id')),
                'name': u.get('full_name') or u.get('name'),
                'email': u.get('email'),
                'role': u.get('role')
            })

        return {
            'total_users': total_users,
            'non_admin_users': non_admin,
            'sample': sample_data
        }
    except Exception as e:
        return {'error': str(e)}


@campaign_routes_router.get('/debug/invoices')
async def debug_invoices():
    """DEBUG: Check invoice collection"""
    try:
        total_invoices = await _db.invoices.count_documents({})
        pending_invoices = await _db.invoices.count_documents({'status': 'pending'})
        paid_invoices = await _db.invoices.count_documents({'status': 'paid'})

        sample = await _db.invoices.find({}).limit(5).to_list(5)
        sample_data = []
        for inv in sample:
            sample_data.append({
                'id': str(inv.get('_id')),
                'invoice_number': inv.get('invoice_number'),
                'user_name': inv.get('user_name'),
                'total': inv.get('total'),
                'status': inv.get('status'),
                'created_at': str(inv.get('created_at')) if inv.get('created_at') else None
            })

        collections = await _db.list_collection_names()

        return {
            'total_invoices': total_invoices,
            'pending_invoices': pending_invoices,
            'paid_invoices': paid_invoices,
            'sample': sample_data,
            'collections': collections
        }
    except Exception as e:
        return {'error': str(e)}


# ───────────── Campaign Sending ─────────────

def generate_app_announcement_email(name, ios_link):
    """Generate HTML email for app announcement"""
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📱 ¡Nuestra App ya está disponible!</h1>
        </div>
        <div style="padding: 30px; background: white;">
            <p style="font-size: 18px;">Hola <strong>{name}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.6;">
                ¡Tenemos excelentes noticias! La aplicación móvil de <strong>Ross Tax Preparation</strong>
                ya está disponible para descargar.
            </p>
            <div style="background: #f0f7ff; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #6C1110; margin-top: 0;">✨ Con nuestra app puedes:</h3>
                <ul style="line-height: 1.8;">
                    <li>📅 Agendar citas fácilmente</li>
                    <li>📄 Subir tus documentos de forma segura</li>
                    <li>💬 Chatear directamente con nosotros</li>
                    <li>🔔 Recibir notificaciones importantes</li>
                </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{ios_link}" style="display: inline-block; background: #000; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; margin: 5px; font-weight: bold;">
                    🍎 Descargar en App Store
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #888; font-size: 12px; text-align: center;">
                📍 305 Bruce Ave, Dumas, TX 79029 | 📞 (806) 934-2018<br>
                <strong>Ross Tax Preparation</strong>
            </p>
        </div>
    </div>
    """


async def process_campaign_immediate(db, clients, send_email, send_sms, ios_link, android_link):
    """Process campaign immediately for small batches"""
    results = {
        'total_clients': len(clients),
        'emails_sent': 0,
        'emails_failed': 0,
        'emails_skipped_no_email': 0,
        'emails_skipped_invalid': 0,
        'sms_sent': 0,
        'sms_failed': 0,
        'sms_skipped_no_phone': 0,
        'sms_skipped_invalid': 0
    }

    config_doc = await db.api_config.find_one({'_id': 'main'})
    if not config_doc:
        return results

    from notification_service import NotificationService
    notif_svc = NotificationService(config_doc)

    for client in clients:
        name = client.get('full_name') or client.get('name') or 'Cliente'
        email = client.get('email', '')
        phone = str(client.get('phone') or '')

        if send_email:
            if not email:
                results['emails_skipped_no_email'] += 1
            elif '@' not in email:
                results['emails_skipped_invalid'] += 1
            else:
                try:
                    email_html = generate_app_announcement_email(name, ios_link)
                    await notif_svc.send_email(email, '📱 ¡La App de Ross Tax ya está disponible!', email_html)
                    results['emails_sent'] += 1
                except Exception as e:
                    logger.error(f"Error sending email to {email}: {e}")
                    results['emails_failed'] += 1

        if send_sms:
            clean_phone = phone.replace('+', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
            if not phone:
                results['sms_skipped_no_phone'] += 1
            elif len(clean_phone) < 10:
                results['sms_skipped_invalid'] += 1
            else:
                try:
                    if notif_svc.twilio_client:
                        sms_msg = f"🎉 ¡Hola {name}! La app de Ross Tax ya está disponible. Descárgala GRATIS: {ios_link} - Ross Tax (806) 934-2018"
                        if not clean_phone.startswith('1'):
                            clean_phone = '1' + clean_phone
                        clean_phone = '+' + clean_phone
                        notif_svc.twilio_client.messages.create(
                            body=sms_msg,
                            from_=notif_svc.twilio_phone_number,
                            to=clean_phone
                        )
                        results['sms_sent'] += 1
                except Exception as e:
                    logger.error(f"Error sending SMS to {phone}: {e}")
                    results['sms_failed'] += 1

        await asyncio.sleep(0.02)

    return results


async def process_campaign_batch(db, campaign_id, clients, send_email, send_sms, ios_link, android_link):
    """Process large campaign in background"""
    try:
        results = await process_campaign_immediate(db, clients, send_email, send_sms, ios_link, android_link)

        await db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {
                'status': 'completed',
                'results': results,
                'completed_at': datetime.now(timezone.utc)
            }}
        )
        logger.info(f"✅ Campaign {campaign_id} completed: {results}")

    except Exception as e:
        logger.error(f"❌ Campaign {campaign_id} failed: {e}")
        await db.marketing_campaigns.update_one(
            {'id': campaign_id},
            {'$set': {
                'status': 'failed',
                'error': str(e),
                'completed_at': datetime.now(timezone.utc)
            }}
        )


@campaign_routes_router.post('/admin/campaigns/app-announcement/send')
async def send_campaign_to_selected(request: Request, background_tasks: BackgroundTasks):
    """Send app announcement to selected clients - processes in background"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')

    try:
        data = await request.json()
        client_ids = data.get('client_ids', [])
        send_email = data.get('send_email', True)
        send_sms = data.get('send_sms', True)

        if not client_ids:
            raise HTTPException(status_code=400, detail='No clients selected')

        settings_doc = await _db.system_settings.find_one({'_id': 'main'})
        settings = settings_doc.get('settings', {}) if settings_doc else {}
        ios_link = settings.get('app_store_url', 'https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX')
        android_link = settings.get('play_store_url', 'https://play.google.com/store/apps/details?id=com.rosstax.app')

        string_ids = []
        object_ids = []
        for cid in client_ids:
            string_ids.append(cid)
            try:
                object_ids.append(ObjectId(cid))
            except Exception:
                pass

        clients = []
        if string_ids:
            string_clients = await _db.users.find({'_id': {'$in': string_ids}}).to_list(None)
            clients.extend(string_clients)

        if object_ids:
            found_ids = set(str(c.get('_id', '')) for c in clients)
            obj_clients = await _db.users.find({'_id': {'$in': object_ids}}).to_list(None)
            for oc in obj_clients:
                if str(oc.get('_id', '')) not in found_ids:
                    clients.append(oc)

        logger.info(f"📊 Campaign: Found {len(clients)} total clients from {len(client_ids)} IDs")

        if len(clients) > 50:
            campaign_id = str(uuid.uuid4())
            await _db.marketing_campaigns.insert_one({
                'id': campaign_id,
                'type': 'app_announcement',
                'status': 'processing',
                'total_clients': len(clients),
                'created_at': datetime.now(timezone.utc),
                'created_by': current_user.get('id'),
                'send_email': send_email,
                'send_sms': send_sms
            })

            background_tasks.add_task(
                process_campaign_batch,
                _db,
                campaign_id,
                clients,
                send_email,
                send_sms,
                ios_link,
                android_link
            )

            return {
                'success': True,
                'message': f'Campaña iniciada para {len(clients)} clientes. Se procesará en segundo plano.',
                'campaign_id': campaign_id,
                'processing': True,
                'results': {
                    'total_clients': len(clients),
                    'total_requested': len(client_ids),
                    'emails_sent': 0,
                    'sms_sent': 0,
                    'status': 'processing'
                }
            }

        results = await process_campaign_immediate(_db, clients, send_email, send_sms, ios_link, android_link)

        await _db.marketing_campaigns.insert_one({
            'type': 'app_announcement',
            'clients_count': len(clients),
            'emails_sent': results['emails_sent'],
            'sms_sent': results['sms_sent'],
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.get('id')
        })

        return {'success': True, 'results': results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))
