"""
Admin Finance & Operations Routes Router
Extracted from server.py for modularization.
Handles admin client creation, invoice management, revenue reports,
activity logs, data backup, notifications bell, leads, tasks, and job applications.
"""
import os
import io
import csv
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from passlib.context import CryptContext

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

admin_finance_ops_router = APIRouter()
_db = None


def init_admin_finance_ops_router(db):
    global _db
    _db = db


# ================== Auth Helpers ==================

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    auth_str = str(authorization) if authorization else None
    if not auth_str:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = auth_str.replace('Bearer ', '') if auth_str.startswith('Bearer ') else auth_str
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    user_id = session['user_id']
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except Exception as e:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

async def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await _get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user

# ================== ADMIN - CREATE CLIENT ==================

@admin_finance_ops_router.post('/admin/clients')
async def create_client(
    client_data: dict,
    current_user: dict = Depends(_require_admin)
):
    """
    Admin: Create a new client account with welcome notification
    """
    try:
        print(f"📝 Creating new client: {client_data.get('email')}")
        
        # Validate required fields
        if not client_data.get('full_name'):
            raise HTTPException(status_code=400, detail='El nombre completo es requerido')
        
        if not client_data.get('phone'):
            raise HTTPException(status_code=400, detail='El teléfono es requerido')
        
        # Email is optional - generate one if not provided
        client_email = client_data.get('email')
        if not client_email:
            # Generate email from phone
            clean_phone = ''.join(filter(str.isdigit, client_data.get('phone', '')))
            client_email = f"cliente{clean_phone}@rosstax.app"
        
        # Check if email already exists
        existing_user = await _db.users.find_one({'email': client_email})
        if existing_user:
            raise HTTPException(status_code=400, detail='Este email ya está registrado')
        
        # Generate temporary password
        import secrets
        import string
        temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
        password_hash = pwd_context.hash(temp_password)
        
        # Create client user
        client_id = str(uuid.uuid4())
        user_doc = {
            '_id': client_id,
            'email': client_email,
            'password_hash': password_hash,
            'name': client_data['full_name'],
            'full_name': client_data['full_name'],
            'phone': client_data.get('phone'),
            'role': 'client',
            'address': client_data.get('address'),
            'created_at': datetime.now(timezone.utc),
            'is_active': True,
            'kyc_completed': False,
            'has_app': False,
            'needs_password_change': True  # Flag for first login
        }
        
        # Add optional fields
        if client_data.get('ssn'):
            user_doc['ssn'] = client_data['ssn']
        
        if client_data.get('date_of_birth'):
            user_doc['date_of_birth'] = client_data['date_of_birth']
        
        await _db.users.insert_one(user_doc)
        
        # Send welcome notification to client via SMS
        client_phone = client_data.get('phone')
        client_name = client_data['full_name'].split()[0]  # First name
        
        # Load config for notifications
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        
        if client_phone and config_doc:
            try:
                from notification_service import NotificationService
                notif_service = NotificationService(config_doc)
                
                # Welcome SMS with credentials and app download links
                welcome_sms = f"""🎉 ¡Bienvenido/a {client_name} a Ross Tax Preparation!

📱 Tu cuenta ha sido creada:
📧 Usuario: {client_email}
🔑 Contraseña: {temp_password}

📲 Descarga nuestra app:
🍎 iOS: https://apps.apple.com/app/ross-tax/id6740539874
🤖 Android: https://play.google.com/store/apps/details?id=com.rosstax.app

🌐 O accede en: www.rosstaxpreparation.com/login

📞 ¿Dudas? Llámanos: (806) 934-2018"""

                if notif_service.twilio_client:
                    notif_service.twilio_client.messages.create(
                        body=welcome_sms,
                        from_=notif_service.twilio_phone_number,
                        to=client_phone
                    )
                    print(f'✅ Welcome SMS sent to {client_phone}')
                    
            except Exception as sms_err:
                print(f'⚠️ Could not send welcome SMS: {sms_err}')
        
        # Send welcome email if email provided
        if client_data.get('email') and config_doc:
            try:
                from notification_service import NotificationService
                notif_service = NotificationService(config_doc)
                
                email_subject = f"🎉 ¡Bienvenido/a a Ross Tax Preparation, {client_name}!"
                email_body = f'''
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1515 100%); padding: 30px; border-radius: 15px 15px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0;">🎉 ¡Bienvenido/a!</h1>
                        <p style="color: #f0f0f0; margin-top: 10px;">Ross Tax Preparation</p>
                    </div>
                    
                    <div style="background: white; padding: 30px; border: 1px solid #eee; border-radius: 0 0 15px 15px;">
                        <p style="font-size: 16px;">Hola <strong>{client_name}</strong>,</p>
                        
                        <p>¡Tu cuenta ha sido creada exitosamente! Ahora puedes acceder a todos nuestros servicios.</p>
                        
                        <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #6C1110;">📋 Tus Credenciales de Acceso</h3>
                            <p><strong>📧 Usuario:</strong> {client_email}</p>
                            <p><strong>🔑 Contraseña:</strong> {temp_password}</p>
                            <p style="font-size: 12px; color: #666;">* Te recomendamos cambiar tu contraseña después del primer inicio de sesión</p>
                        </div>
                        
                        <div style="background: #e8f5e9; border-radius: 10px; padding: 20px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #2e7d32;">📲 Descarga Nuestra App</h3>
                            <p>Gestiona tus documentos, citas y más desde tu teléfono:</p>
                            <p>
                                <a href="https://apps.apple.com/app/ross-tax/id6740539874" style="display: inline-block; background: #000; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">🍎 App Store</a>
                                <a href="https://play.google.com/store/apps/details?id=com.rosstax.app" style="display: inline-block; background: #3ddc84; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; margin: 5px;">🤖 Google Play</a>
                            </p>
                        </div>
                        
                        <p style="text-align: center; margin-top: 30px;">
                            <a href="https://www.rosstaxpreparation.com/login" style="background: #6C1110; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; display: inline-block;">Iniciar Sesión en la Web</a>
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        
                        <p style="color: #666; font-size: 14px;">
                            ¿Tienes preguntas? Estamos aquí para ayudarte:<br>
                            📞 <a href="tel:+18069342018">(806) 934-2018</a><br>
                            📧 <a href="mailto:yoandyross@gmail.com">yoandyross@gmail.com</a><br>
                            📍 305 Bruce Ave, Dumas, TX 79029
                        </p>
                    </div>
                </div>
                '''
                
                await notif_service.send_email(client_email, email_subject, email_body)
                print(f'✅ Welcome email sent to {client_email}')
                
            except Exception as email_err:
                print(f'⚠️ Could not send welcome email: {email_err}')
        
        # Create notification for admin/assistant
        try:
            admin_user_id = current_user.get('id') or current_user.get('_id') or ''
            await create_notification(
                user_id=str(admin_user_id),
                title='✅ Cliente Creado',
                body=f'Nuevo cliente registrado: {client_data["full_name"]} - Credenciales enviadas',
                type='admin',
                data={'client_id': client_id}
            )
        except Exception as e:
            print(f'⚠️ Could not create notification: {str(e)}')
        
        # Auto-sync to Rise CRM (non-blocking)
        try:
            from rise_crm_sync_service import rise_sync_service
            if rise_sync_service and rise_sync_service.rise_service.sync_enabled:
                import asyncio
                asyncio.create_task(rise_sync_service.sync_user_to_rise(client_id))
                print(f"🔄 Auto-sync triggered for new client: {client_id}")
        except Exception as e:
            print(f"⚠️ Auto-sync failed (non-critical): {str(e)}")
        
        # Auto-create banking data record (sync with datos-bancarios)
        try:
            name_parts = client_data['full_name'].strip().split(' ', 1)
            first_name = name_parts[0].upper()
            last_name = name_parts[1].upper() if len(name_parts) > 1 else ''
            
            # Check if already exists in client_banking
            existing_banking = await _db.client_banking.find_one({
                'first_name': first_name,
                'last_name': last_name
            })
            
            if not existing_banking:
                banking_doc = {
                    'client_id': client_id,
                    'first_name': first_name,
                    'last_name': last_name,
                    'email': client_email.strip() if client_email else '',
                    'phone': (client_data.get('phone') or '').strip(),
                    'address': (client_data.get('address') or '').strip(),
                    'city': '',
                    'state': '',
                    'zip_code': '',
                    'routing_number': '',
                    'account_number': '',
                    'account_type': 'checking',
                    'account_holder_type': 'personal',
                    'check_name': client_data['full_name'].strip().upper(),
                    'notes': '',
                    'ssn': (client_data.get('ssn') or '').replace('-', '').replace(' ', ''),
                    'ssn_last4': (client_data.get('ssn') or '').replace('-', '').replace(' ', '')[-4:] if client_data.get('ssn') else '',
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc),
                }
                await _db.client_banking.insert_one(banking_doc)
                print(f"🏦 Banking data record created for: {client_data['full_name']}")
            else:
                # Link existing banking record to this client
                if not existing_banking.get('client_id'):
                    await _db.client_banking.update_one(
                        {'_id': existing_banking['_id']},
                        {'$set': {'client_id': client_id, 'updated_at': datetime.now(timezone.utc)}}
                    )
                    print(f"🔗 Banking record linked to client: {client_data['full_name']}")
        except Exception as e:
            print(f"⚠️ Banking data sync failed (non-critical): {str(e)}")
        
        print(f"✅ Client created successfully: {client_id}")
        
        return {
            'success': True,
            'message': 'Cliente creado exitosamente. Credenciales enviadas por SMS y Email.',
            'client_id': client_id,
            'client': {
                'id': client_id,
                'name': user_doc['name'],
                'email': client_email,
                'phone': user_doc.get('phone'),
                'address': user_doc.get('address')
            },
            'credentials_sent': True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error creating client: {str(e)}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN - INVOICE STATS ==================

@admin_finance_ops_router.get('/admin/invoices/stats')
async def get_invoice_stats(current_user: dict = Depends(_get_current_user)):
    """Get invoice statistics for admin dashboard"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Get all invoices
        invoices = await _db.invoices.find().to_list(1000)
        
        # Also get paid service orders for complete revenue picture
        paid_orders = await _db.service_orders.find({
            'payment_status': 'paid',
            'invoice_id': {'$exists': False}  # Only orders without linked invoice to avoid double counting
        }).to_list(500)
        
        logging.info(f"📊 Invoice stats: Found {len(invoices)} invoices + {len(paid_orders)} paid orders (no invoice) in database")
        
        total_invoices = len(invoices)
        pending_invoices = sum(1 for inv in invoices if inv.get('status') == 'pending')
        paid_invoices = sum(1 for inv in invoices if inv.get('status') == 'paid')
        overdue_invoices = sum(1 for inv in invoices if inv.get('status') == 'overdue')
        
        # Use 'total' field first, fallback to 'amount'
        total_amount = sum(inv.get('total', inv.get('amount', 0)) or 0 for inv in invoices)
        total_revenue = sum(inv.get('total', inv.get('amount', 0)) or 0 for inv in invoices if inv.get('status') == 'paid')
        pending_amount = sum(inv.get('total', inv.get('amount', 0)) or 0 for inv in invoices if inv.get('status') in ['pending', 'overdue'])
        
        # Add revenue from paid service orders without invoices (avoid double counting)
        for order in paid_orders:
            order_amount = order.get('payment_amount', order.get('price', order.get('total', 0))) or 0
            total_amount += order_amount
            total_revenue += order_amount
            paid_invoices += 1  # Count as paid
        
        # Monthly revenue (current month)
        now = datetime.now(timezone.utc)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        monthly_revenue = 0
        for inv in invoices:
            if inv.get('status') == 'paid':
                # Get the date to compare (paid_at or created_at)
                date_to_check = inv.get('paid_at', inv.get('created_at'))
                if date_to_check:
                    # Ensure timezone awareness
                    if isinstance(date_to_check, datetime):
                        if date_to_check.tzinfo is None:
                            date_to_check = date_to_check.replace(tzinfo=timezone.utc)
                        if date_to_check >= first_of_month:
                            monthly_revenue += inv.get('total', inv.get('amount', 0)) or 0
        
        # Also count paid service orders without invoices for monthly revenue
        for order in paid_orders:
            date_to_check = order.get('paid_at', order.get('created_at'))
            if date_to_check:
                if isinstance(date_to_check, datetime):
                    if date_to_check.tzinfo is None:
                        date_to_check = date_to_check.replace(tzinfo=timezone.utc)
                    if date_to_check >= first_of_month:
                        monthly_revenue += order.get('payment_amount', order.get('price', order.get('total', 0))) or 0
        
        result = {
            'total_invoices': total_invoices,
            'pending_invoices': pending_invoices,
            'paid_invoices': paid_invoices,
            'overdue_invoices': overdue_invoices,
            'total_amount': total_amount,
            'total_revenue': total_revenue,
            'pending_amount': pending_amount,
            'monthly_revenue': monthly_revenue
        }
        
        logging.info(f"📊 Invoice stats result: {result}")
        
        return result
    except Exception as e:
        logging.error(f'Error getting invoice stats: {e}')
        return {
            'total_invoices': 0,
            'pending_invoices': 0,
            'paid_invoices': 0,
            'overdue_invoices': 0,
            'total_revenue': 0,
            'pending_amount': 0,
            'monthly_revenue': 0
        }


# ================== ADMIN - REVENUE REPORTS ==================

@admin_finance_ops_router.get('/admin/reports/revenue')
async def get_revenue_reports(
    period: str = Query('month', description='week, month, quarter, year, all'),
    current_user: dict = Depends(_require_admin)
):
    """
    Get comprehensive revenue reports with breakdowns by:
    - Time period (daily/weekly/monthly)
    - Service type
    - Client
    - Payment method
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Determine date range based on period
        if period == 'week':
            start_date = now - timedelta(days=7)
            group_format = '%Y-%m-%d'
            period_label = 'Última Semana'
        elif period == 'month':
            start_date = now - timedelta(days=30)
            group_format = '%Y-%m-%d'
            period_label = 'Último Mes'
        elif period == 'quarter':
            start_date = now - timedelta(days=90)
            group_format = '%Y-%W'
            period_label = 'Último Trimestre'
        elif period == 'year':
            start_date = now - timedelta(days=365)
            group_format = '%Y-%m'
            period_label = 'Último Año'
        else:
            start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
            group_format = '%Y-%m'
            period_label = 'Todo el Tiempo'
        
        # Get all paid invoices in the period
        invoices = await _db.invoices.find({
            'status': 'paid',
            '$or': [
                {'paid_at': {'$gte': start_date}},
                {'created_at': {'$gte': start_date}}
            ]
        }).to_list(5000)
        
        # Also get pending/overdue for comparison
        pending_invoices = await _db.invoices.find({
            'status': {'$in': ['pending', 'overdue']},
            'created_at': {'$gte': start_date}
        }).to_list(5000)
        
        # Calculate totals
        total_revenue = sum(inv.get('total', inv.get('amount', 0)) or 0 for inv in invoices)
        total_pending = sum(inv.get('total', inv.get('amount', 0)) or 0 for inv in pending_invoices)
        total_invoices = len(invoices) + len(pending_invoices)
        
        # Revenue by date (for chart)
        revenue_by_date = {}
        for inv in invoices:
            date_key = inv.get('paid_at') or inv.get('created_at')
            if date_key:
                if isinstance(date_key, str):
                    try:
                        date_key = datetime.fromisoformat(date_key.replace('Z', '+00:00'))
                    except:
                        continue
                formatted_date = date_key.strftime(group_format)
                amount = inv.get('total', inv.get('amount', 0)) or 0
                revenue_by_date[formatted_date] = revenue_by_date.get(formatted_date, 0) + amount
        
        # Sort by date
        chart_data = [
            {'date': k, 'revenue': round(v, 2)}
            for k, v in sorted(revenue_by_date.items())
        ]
        
        # Revenue by service - NORMALIZED to avoid duplicates (accent variations)
        import unicodedata
        def normalize_service_name(name: str) -> str:
            """Normalize service names to group duplicates with/without accents"""
            if not name:
                return 'Sin especificar'
            # Remove accents
            normalized = unicodedata.normalize('NFD', name)
            normalized = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
            normalized = normalized.strip().lower()
            
            # Map common variations to canonical names
            if 'preparacion de impuestos' in normalized or 'preparacion de impuesto' in normalized:
                return 'Preparación de Impuestos'
            if 'declaracion de impuestos' in normalized or 'declaracion de impuesto' in normalized:
                if '2024' in name:
                    return 'Declaración de Impuestos 2024'
                elif '2025' in name:
                    return 'Declaración de Impuestos 2025'
                elif '2023' in name:
                    return 'Declaración de Impuestos 2023'
                return 'Declaración de Impuestos'
            return name.strip()
        
        revenue_by_service = {}
        for inv in invoices:
            service = inv.get('service_name') or inv.get('description') or 'Sin especificar'
            # Also check items for service names
            if inv.get('items'):
                for item in inv['items']:
                    service = item.get('description') or item.get('name') or service
                    break
            service = normalize_service_name(service)
            amount = inv.get('total', inv.get('amount', 0)) or 0
            revenue_by_service[service] = revenue_by_service.get(service, 0) + amount
        
        services_data = [
            {'service': k, 'revenue': round(v, 2), 'percentage': round(v / total_revenue * 100, 1) if total_revenue > 0 else 0}
            for k, v in sorted(revenue_by_service.items(), key=lambda x: x[1], reverse=True)
        ][:10]  # Top 10 services
        
        # Revenue by client (top 10)
        revenue_by_client = {}
        # Cache for user names to avoid multiple DB queries
        user_name_cache = {}
        
        for inv in invoices:
            client_id = inv.get('user_id') or inv.get('client_id')
            client_name = inv.get('user_name') or inv.get('client_name')
            
            # Handle imported invoices without user linkage
            if not client_id or client_id == 'unknown':
                # Group imported invoices by tax_year
                tax_year = inv.get('tax_year', '')
                notes = inv.get('notes', '')
                if 'importada' in notes.lower() or 'imported' in notes.lower():
                    group_key = f'imported_{tax_year}'
                    if group_key not in revenue_by_client:
                        revenue_by_client[group_key] = {
                            'name': f'Clientes Temporada {tax_year}' if tax_year else 'Clientes Importados',
                            'revenue': 0, 'invoices': 0
                        }
                    amount = inv.get('total', inv.get('amount', 0)) or 0
                    revenue_by_client[group_key]['revenue'] += amount
                    revenue_by_client[group_key]['invoices'] += 1
                    continue
                # For other invoices without client, use a generic key
                client_id = 'no_client'
                if not client_name:
                    client_name = 'Sin asignar'
            
            # If no name in invoice, try to get from user collection
            if not client_name and client_id and client_id != 'no_client':
                if client_id not in user_name_cache:
                    try:
                        # Try string _id first (UUID format)
                        user = await _db.users.find_one({'_id': client_id})
                        if not user:
                            try:
                                user = await _db.users.find_one({'_id': ObjectId(client_id)})
                            except:
                                pass
                        if user:
                            user_name_cache[client_id] = user.get('name') or user.get('full_name') or 'Sin nombre'
                        else:
                            user_name_cache[client_id] = 'Cliente'
                    except:
                        user_name_cache[client_id] = 'Cliente'
                
                client_name = user_name_cache.get(client_id, 'Cliente')
            
            if not client_name:
                client_name = 'Sin nombre'
            
            amount = inv.get('total', inv.get('amount', 0)) or 0
            if client_id not in revenue_by_client:
                revenue_by_client[client_id] = {'name': client_name, 'revenue': 0, 'invoices': 0}
            revenue_by_client[client_id]['revenue'] += amount
            revenue_by_client[client_id]['invoices'] += 1
        
        top_clients = sorted(
            [{'client_id': k, **v} for k, v in revenue_by_client.items()],
            key=lambda x: x['revenue'],
            reverse=True
        )[:10]
        
        # Calculate comparison with previous period
        if period != 'all':
            prev_start = start_date - (now - start_date)
            prev_invoices = await _db.invoices.find({
                'status': 'paid',
                '$or': [
                    {'paid_at': {'$gte': prev_start, '$lt': start_date}},
                    {'created_at': {'$gte': prev_start, '$lt': start_date}}
                ]
            }).to_list(5000)
            prev_revenue = sum(inv.get('total', inv.get('amount', 0)) or 0 for inv in prev_invoices)
            
            if prev_revenue > 0:
                growth_percentage = round((total_revenue - prev_revenue) / prev_revenue * 100, 1)
            else:
                growth_percentage = 100 if total_revenue > 0 else 0
        else:
            prev_revenue = 0
            growth_percentage = 0
        
        # Monthly breakdown for the period
        monthly_breakdown = {}
        for inv in invoices:
            date_key = inv.get('paid_at') or inv.get('created_at')
            if date_key:
                if isinstance(date_key, str):
                    try:
                        date_key = datetime.fromisoformat(date_key.replace('Z', '+00:00'))
                    except:
                        continue
                month_key = date_key.strftime('%Y-%m')
                amount = inv.get('total', inv.get('amount', 0)) or 0
                if month_key not in monthly_breakdown:
                    monthly_breakdown[month_key] = {'revenue': 0, 'count': 0}
                monthly_breakdown[month_key]['revenue'] += amount
                monthly_breakdown[month_key]['count'] += 1
        
        monthly_data = [
            {'month': k, 'revenue': round(v['revenue'], 2), 'invoices': v['count']}
            for k, v in sorted(monthly_breakdown.items())
        ]
        
        return {
            'success': True,
            'period': period,
            'period_label': period_label,
            'summary': {
                'total_revenue': round(total_revenue, 2),
                'total_pending': round(total_pending, 2),
                'total_invoices': total_invoices,
                'paid_invoices': len(invoices),
                'pending_invoices': len(pending_invoices),
                'average_invoice': round(total_revenue / len(invoices), 2) if invoices else 0,
                'growth_percentage': growth_percentage,
                'previous_period_revenue': round(prev_revenue, 2) if period != 'all' else None,
            },
            'chart_data': chart_data,
            'by_service': services_data,
            'top_clients': top_clients,
            'monthly_breakdown': monthly_data,
            'generated_at': now.isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error generating revenue report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ACTIVITY LOGS SYSTEM ==================

async def log_activity(
    action: str,
    actor_id: str = None,
    actor_name: str = None,
    actor_email: str = None,
    target_type: str = None,
    target_id: str = None,
    target_name: str = None,
    details: dict = None,
    ip_address: str = None
):
    """
    Log an activity for audit trail.
    
    Args:
        action: Action performed (e.g., 'client_created', 'invoice_paid', 'document_uploaded')
        actor_id: ID of the user performing the action
        actor_name: Name of the user performing the action
        actor_email: Email of the user performing the action
        target_type: Type of entity affected (e.g., 'client', 'invoice', 'document')
        target_id: ID of the entity affected
        target_name: Name/description of the entity affected
        details: Additional details about the action
        ip_address: IP address of the request
    """
    try:
        log_entry = {
            '_id': str(uuid.uuid4()),
            'action': action,
            'actor': {
                'id': actor_id,
                'name': actor_name,
                'email': actor_email
            },
            'target': {
                'type': target_type,
                'id': target_id,
                'name': target_name
            },
            'details': details or {},
            'ip_address': ip_address,
            'timestamp': datetime.now(timezone.utc)
        }
        await _db.activity_logs.insert_one(log_entry)
    except Exception as e:
        logging.error(f"Error logging activity: {e}")


@admin_finance_ops_router.get('/admin/activity-logs')
async def get_activity_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: str = Query(None),
    actor_email: str = Query(None),
    target_type: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    current_user: dict = Depends(_require_admin)
):
    """Get paginated activity logs with filters"""
    try:
        # Build query
        query = {}
        
        if action:
            query['action'] = {'$regex': action, '$options': 'i'}
        if actor_email:
            query['actor.email'] = {'$regex': actor_email, '$options': 'i'}
        if target_type:
            query['target.type'] = target_type
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query['timestamp'] = {'$gte': start}
            except:
                pass
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                if 'timestamp' in query:
                    query['timestamp']['$lte'] = end
                else:
                    query['timestamp'] = {'$lte': end}
            except:
                pass
        
        # Get total count
        total = await _db.activity_logs.count_documents(query)
        
        # Get logs with pagination
        skip = (page - 1) * limit
        logs = await _db.activity_logs.find(query).sort('timestamp', -1).skip(skip).limit(limit).to_list(limit)
        
        # Format logs
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                'id': log['_id'],
                'action': log.get('action'),
                'actor': log.get('actor', {}),
                'target': log.get('target', {}),
                'details': log.get('details', {}),
                'ip_address': log.get('ip_address'),
                'timestamp': log.get('timestamp').isoformat() if log.get('timestamp') else None
            })
        
        # Get action types for filter dropdown
        action_types = await _db.activity_logs.distinct('action')
        target_types = await _db.activity_logs.distinct('target.type')
        
        return {
            'success': True,
            'logs': formatted_logs,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit,
            'filters': {
                'action_types': action_types,
                'target_types': [t for t in target_types if t]
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting activity logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.get('/admin/activity-logs/stats')
async def get_activity_stats(current_user: dict = Depends(_require_admin)):
    """Get activity statistics for the dashboard"""
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)
        
        # Today's count
        today_count = await _db.activity_logs.count_documents({'timestamp': {'$gte': today_start}})
        
        # Week's count
        week_count = await _db.activity_logs.count_documents({'timestamp': {'$gte': week_start}})
        
        # Month's count
        month_count = await _db.activity_logs.count_documents({'timestamp': {'$gte': month_start}})
        
        # Most active users (last 7 days)
        pipeline = [
            {'$match': {'timestamp': {'$gte': week_start}}},
            {'$group': {'_id': '$actor.email', 'name': {'$first': '$actor.name'}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 5}
        ]
        active_users = await _db.activity_logs.aggregate(pipeline).to_list(5)
        
        # Most common actions (last 7 days)
        action_pipeline = [
            {'$match': {'timestamp': {'$gte': week_start}}},
            {'$group': {'_id': '$action', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        common_actions = await _db.activity_logs.aggregate(action_pipeline).to_list(10)
        
        return {
            'success': True,
            'today_count': today_count,
            'week_count': week_count,
            'month_count': month_count,
            'active_users': [{'email': u['_id'], 'name': u.get('name'), 'count': u['count']} for u in active_users],
            'common_actions': [{'action': a['_id'], 'count': a['count']} for a in common_actions]
        }
        
    except Exception as e:
        logging.error(f"Error getting activity stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN - DATA BACKUP ==================

@admin_finance_ops_router.get('/admin/backup/export')
async def export_full_backup(
    include_users: bool = Query(True),
    include_appointments: bool = Query(True),
    include_documents: bool = Query(True),
    include_invoices: bool = Query(True),
    include_tax_returns: bool = Query(True),
    current_user: dict = Depends(_require_admin)
):
    """
    Export full database backup as JSON.
    Only accessible by admin users.
    """
    def safe_date(val):
        """Safely convert date to ISO string"""
        if val is None:
            return None
        if isinstance(val, str):
            return val
        try:
            return val.isoformat()
        except:
            return str(val)
    
    try:
        backup_data = {
            'metadata': {
                'exported_at': datetime.now(timezone.utc).isoformat(),
                'exported_by': current_user.get('email'),
                'version': '1.0'
            },
            'counts': {},
            'data': {}
        }
        
        # Export users (without password hashes)
        if include_users:
            users = await _db.users.find({}).to_list(10000)
            backup_data['data']['users'] = []
            for user in users:
                try:
                    user_data = {
                        'id': str(user.get('_id')),
                        'full_name': user.get('full_name') or user.get('name'),
                        'email': user.get('email'),
                        'phone': user.get('phone'),
                        'role': user.get('role'),
                        'status': user.get('status'),
                        'source': user.get('source'),
                        'tags': user.get('tags', []),
                        'created_at': safe_date(user.get('created_at')),
                        'updated_at': safe_date(user.get('updated_at')),
                    }
                    backup_data['data']['users'].append(user_data)
                except Exception as e:
                    logging.warning(f"Error exporting user {user.get('_id')}: {e}")
            backup_data['counts']['users'] = len(backup_data['data']['users'])
        
        # Export appointments
        if include_appointments:
            appointments = await _db.appointments.find({}).to_list(50000)
            backup_data['data']['appointments'] = []
            for apt in appointments:
                try:
                    apt_data = {
                        'id': str(apt.get('_id')),
                        'user_id': str(apt.get('user_id')) if apt.get('user_id') else None,
                        'client_name': apt.get('client_name'),
                        'client_email': apt.get('client_email'),
                        'client_phone': apt.get('client_phone'),
                        'service_name': apt.get('service_name'),
                        'date': apt.get('date'),
                        'time': apt.get('time') or apt.get('time_slot'),
                        'status': apt.get('status'),
                        'notes': apt.get('notes'),
                        'source': apt.get('source'),
                        'created_at': safe_date(apt.get('created_at')),
                    }
                    backup_data['data']['appointments'].append(apt_data)
                except Exception as e:
                    logging.warning(f"Error exporting appointment {apt.get('_id')}: {e}")
            backup_data['counts']['appointments'] = len(backup_data['data']['appointments'])
        
        # Export documents metadata (not the actual files)
        if include_documents:
            documents = await _db.documents.find({}).to_list(50000)
            backup_data['data']['documents'] = []
            for doc in documents:
                try:
                    doc_data = {
                        'id': str(doc.get('_id')),
                        'user_id': str(doc.get('user_id')) if doc.get('user_id') else None,
                        'filename': doc.get('filename') or doc.get('original_filename'),
                        'document_type': doc.get('document_type') or doc.get('type'),
                        'category': doc.get('category'),
                        'status': doc.get('status'),
                        'source': doc.get('source'),
                        'created_at': safe_date(doc.get('created_at')),
                    }
                    backup_data['data']['documents'].append(doc_data)
                except Exception as e:
                    logging.warning(f"Error exporting document {doc.get('_id')}: {e}")
            backup_data['counts']['documents'] = len(backup_data['data']['documents'])
        
        # Export invoices
        if include_invoices:
            invoices = await _db.invoices.find({}).to_list(50000)
            backup_data['data']['invoices'] = []
            for inv in invoices:
                try:
                    inv_data = {
                        'id': str(inv.get('_id')),
                        'invoice_number': inv.get('invoice_number'),
                        'user_id': str(inv.get('user_id')) if inv.get('user_id') else None,
                        'user_name': inv.get('user_name'),
                        'items': inv.get('items', []),
                        'subtotal': inv.get('subtotal'),
                        'tax': inv.get('tax'),
                        'total': inv.get('total'),
                        'status': inv.get('status'),
                        'due_date': safe_date(inv.get('due_date')),
                        'paid_at': safe_date(inv.get('paid_at')),
                        'created_at': safe_date(inv.get('created_at')),
                    }
                    backup_data['data']['invoices'].append(inv_data)
                except Exception as e:
                    logging.warning(f"Error exporting invoice {inv.get('_id')}: {e}")
            backup_data['counts']['invoices'] = len(backup_data['data']['invoices'])
        
        # Export tax returns
        if include_tax_returns:
            tax_returns = await _db.tax_returns.find({}).to_list(50000)
            backup_data['data']['tax_returns'] = []
            for tr in tax_returns:
                try:
                    tr_data = {
                        'id': str(tr.get('_id')),
                        'user_id': str(tr.get('user_id')) if tr.get('user_id') else None,
                        'year': tr.get('year'),
                        'status': tr.get('status'),
                        'type': tr.get('type'),
                        'filing_status': tr.get('filing_status'),
                        'created_at': safe_date(tr.get('created_at')),
                        'updated_at': safe_date(tr.get('updated_at')),
                    }
                    backup_data['data']['tax_returns'].append(tr_data)
                except Exception as e:
                    logging.warning(f"Error exporting tax return {tr.get('_id')}: {e}")
            backup_data['counts']['tax_returns'] = len(backup_data['data']['tax_returns'])
        
        # Log the backup activity
        await log_activity(
            action='backup_exported',
            actor_id=str(current_user.get('_id', current_user.get('id'))),
            actor_name=current_user.get('full_name') or current_user.get('name'),
            actor_email=current_user.get('email'),
            target_type='system',
            target_name='Full Backup',
            details={'counts': backup_data['counts']}
        )
        
        return backup_data
        
    except Exception as e:
        logging.error(f"Error exporting backup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.get('/admin/backup/stats')
async def get_backup_stats(current_user: dict = Depends(_require_admin)):
    """Get database statistics for backup planning"""
    try:
        stats = {
            'users': await _db.users.count_documents({}),
            'appointments': await _db.appointments.count_documents({}),
            'documents': await _db.documents.count_documents({}),
            'invoices': await _db.invoices.count_documents({}),
            'tax_returns': await _db.tax_returns.count_documents({}),
            'chat_messages': await _db.chat_messages.count_documents({}),
            'activity_logs': await _db.activity_logs.count_documents({}),
        }
        
        # Calculate estimated size
        total_records = sum(stats.values())
        estimated_size_kb = total_records * 2  # Rough estimate: 2KB per record avg
        
        return {
            'success': True,
            'collections': stats,
            'total_records': total_records,
            'estimated_size_kb': estimated_size_kb,
            'estimated_size_mb': round(estimated_size_kb / 1024, 2)
        }
        
    except Exception as e:
        logging.error(f"Error getting backup stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN - INVOICES CRUD ==================

@admin_finance_ops_router.get('/admin/invoices')
async def get_admin_invoices(
    status: Optional[str] = None,
    tax_year: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(_get_current_user)
):
    """Get all invoices for admin"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        query = {}
        if status and status != 'all':
            query['status'] = status
        if tax_year:
            # Support both string and int variants
            year_int = int(tax_year) if tax_year.isdigit() else None
            variants = [tax_year]
            if year_int:
                variants.append(year_int)
            query['tax_year'] = {'$in': variants}
        
        invoices = await _db.invoices.find(query).sort('created_at', -1).limit(limit).to_list(limit)
        
        # Enrich invoices with client data
        for inv in invoices:
            inv['id'] = str(inv['_id'])
            del inv['_id']
            
            # If no client_name but has user_id, look up the user/client
            if not inv.get('user_name') and not inv.get('client_name'):
                user_id = inv.get('user_id') or inv.get('client_id')
                if user_id:
                    try:
                        # Try to find user
                        if len(user_id) == 24:
                            user = await _db.users.find_one({'_id': ObjectId(user_id)})
                        else:
                            user = await _db.users.find_one({'_id': user_id})
                        
                        if user:
                            inv['client_name'] = user.get('name') or user.get('full_name') or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                            inv['client_email'] = user.get('email')
                            inv['client_phone'] = user.get('phone')
                    except Exception as lookup_err:
                        logging.warning(f"Could not lookup user {user_id}: {lookup_err}")
            
            # Normalize field names
            if inv.get('user_name') and not inv.get('client_name'):
                inv['client_name'] = inv.get('user_name')
            if inv.get('user_email') and not inv.get('client_email'):
                inv['client_email'] = inv.get('user_email')
        
        return {'invoices': invoices}
    except Exception as e:
        print(f'Error getting invoices: {e}')
        return {'invoices': []}


@admin_finance_ops_router.post('/admin/invoices')
async def create_admin_invoice(invoice_data: dict, current_user: dict = Depends(_get_current_user)):
    """Create new invoice"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        count = await _db.invoices.count_documents({}) + 1
        invoice_number = f"INV-{datetime.now().strftime('%Y%m')}-{count:04d}"
        
        # Calculate totals from items if provided
        items = invoice_data.get('items', [])
        subtotal = sum(item.get('quantity', 1) * item.get('unit_price', 0) for item in items) if items else invoice_data.get('subtotal', 0)
        tax = subtotal * 0.08  # 8% tax
        total = subtotal + tax
        
        invoice = {
            'invoice_number': invoice_number,
            'user_id': invoice_data.get('user_id'),
            'user_name': invoice_data.get('user_name'),
            'user_email': invoice_data.get('user_email'),
            'user_phone': invoice_data.get('user_phone'),
            'service_name': invoice_data.get('service_name', 'Servicio'),
            'items': items,
            'subtotal': subtotal,
            'tax': tax,
            'tax_percent': invoice_data.get('tax_percent', 8),
            'total': total,
            'status': invoice_data.get('status', 'pending'),
            'due_date': invoice_data.get('due_date') or (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            'notes': invoice_data.get('notes', ''),
            'created_at': datetime.now(timezone.utc),
            'created_by': current_user.get('id')
        }

        # Tag with active tax season
        try:
            from season_context import get_season_year
            invoice['tax_year'] = invoice_data.get('tax_year') or await get_season_year()
        except Exception:
            pass
        
        result = await _db.invoices.insert_one(invoice)
        invoice_id = str(result.inserted_id)
        
        # Send push notification to the client if invoice is pending
        if invoice.get('status') == 'pending' and invoice_data.get('user_id'):
            try:
                user_id = invoice_data.get('user_id')
                # Find the user to get their push token
                user = None
                if ObjectId.is_valid(str(user_id)):
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                if not user:
                    user = await _db.users.find_one({'id': user_id})
                if not user:
                    user = await _db.clients.find_one({'_id': ObjectId(user_id)}) if ObjectId.is_valid(str(user_id)) else None
                
                if user:
                    push_tokens = []
                    # Check for FCM token
                    if user.get('fcm_token'):
                        push_tokens.append(user.get('fcm_token'))
                    # Check for Expo push token
                    if user.get('expo_push_token'):
                        push_tokens.append(user.get('expo_push_token'))
                    # Check for push_token field
                    if user.get('push_token'):
                        push_tokens.append(user.get('push_token'))
                    
                    if push_tokens:
                        from push_notification_service import get_push_service
                        push_service = get_push_service()
                        
                        await push_service.send_push_notification(
                            push_tokens=push_tokens,
                            title="💰 Nueva Factura Pendiente",
                            body=f"Tienes una factura por ${total:.2f} - {invoice.get('service_name')}",
                            data={
                                'type': 'invoice',
                                'action': 'new_invoice',
                                'invoice_id': invoice_id,
                                'invoice_number': invoice_number,
                                'amount': str(total),
                                'screen': 'invoices'
                            }
                        )
                        logging.info(f"📱 Push notification sent for new invoice {invoice_number} to user {user_id}")
            except Exception as push_error:
                logging.error(f"Error sending invoice push notification: {push_error}")
                # Don't fail the invoice creation if push fails
        
        # Return clean dict without ObjectId
        return {
            'success': True,
            'id': invoice_id,
            'invoice_number': invoice_number,
            'user_id': invoice.get('user_id'),
            'service_name': invoice.get('service_name'),
            'items': items,
            'subtotal': subtotal,
            'tax': tax,
            'total': total,
            'status': invoice.get('status'),
            'due_date': invoice.get('due_date'),
            'notes': invoice.get('notes'),
            'created_at': invoice.get('created_at').isoformat() if invoice.get('created_at') else None
        }
    except Exception as e:
        print(f'Error creating invoice: {e}')
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.get('/admin/invoices/{invoice_id}')
async def get_admin_invoice_details(invoice_id: str, current_user: dict = Depends(_get_current_user)):
    """Get single invoice details"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from bson import ObjectId
        
        # Try to find invoice with different ID formats
        invoice = None
        if len(invoice_id) == 24:
            try:
                invoice = await _db.invoices.find_one({'_id': ObjectId(invoice_id)})
            except:
                pass
        
        if not invoice:
            invoice = await _db.invoices.find_one({'_id': invoice_id})
        
        if not invoice:
            raise HTTPException(status_code=404, detail='Factura no encontrada')
        
        # Convert _id to string
        invoice['id'] = str(invoice['_id'])
        del invoice['_id']
        
        # If no client_name but has user_id, look up the user/client
        if not invoice.get('user_name') and not invoice.get('client_name'):
            user_id = invoice.get('user_id') or invoice.get('client_id')
            if user_id:
                try:
                    # Try to find user
                    user = None
                    if len(str(user_id)) == 24:
                        try:
                            user = await _db.users.find_one({'_id': ObjectId(user_id)})
                        except:
                            pass
                    if not user:
                        user = await _db.users.find_one({'_id': user_id})
                    if not user:
                        user = await _db.users.find_one({'id': user_id})
                    
                    if user:
                        invoice['user_name'] = user.get('name') or user.get('full_name') or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                        invoice['user_email'] = user.get('email')
                        invoice['user_phone'] = user.get('phone')
                except Exception as lookup_err:
                    logging.warning(f"Could not lookup user {user_id}: {lookup_err}")
        
        # Normalize field names
        if invoice.get('client_name') and not invoice.get('user_name'):
            invoice['user_name'] = invoice.get('client_name')
        if invoice.get('client_email') and not invoice.get('user_email'):
            invoice['user_email'] = invoice.get('client_email')
        if invoice.get('client_phone') and not invoice.get('user_phone'):
            invoice['user_phone'] = invoice.get('client_phone')
        
        return invoice
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error getting invoice: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.put('/admin/invoices/{invoice_id}')
async def update_admin_invoice(invoice_id: str, invoice_data: dict, current_user: dict = Depends(_get_current_user)):
    """Update existing invoice"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        update_data = {
            'user_id': invoice_data.get('user_id'),
            'user_name': invoice_data.get('user_name'),
            'user_email': invoice_data.get('user_email'),
            'user_phone': invoice_data.get('user_phone'),
            'items': invoice_data.get('items', []),
            'subtotal': invoice_data.get('subtotal', 0),
            'tax': invoice_data.get('tax', 0),
            'tax_percent': invoice_data.get('tax_percent', 0),
            'total': invoice_data.get('total', 0),
            'status': invoice_data.get('status'),
            'due_date': invoice_data.get('due_date'),
            'notes': invoice_data.get('notes', ''),
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('id')
        }
        
        result = await _db.invoices.update_one(
            {'_id': ObjectId(invoice_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        return {'success': True, 'message': 'Invoice updated'}
    except Exception as e:
        print(f'Error updating invoice: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.delete('/admin/invoices/{invoice_id}')
async def delete_admin_invoice(invoice_id: str, current_user: dict = Depends(_get_current_user)):
    """Delete invoice"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        result = await _db.invoices.delete_one({'_id': ObjectId(invoice_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        return {'success': True, 'message': 'Invoice deleted'}
    except Exception as e:
        print(f'Error deleting invoice: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.post('/admin/invoices/{invoice_id}/mark-paid')
async def mark_invoice_paid(invoice_id: str, payment_data: dict, current_user: dict = Depends(_get_current_user)):
    """Mark invoice as paid"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        update_data = {
            'status': 'paid',
            'paid_at': datetime.now(timezone.utc),
            'payment_method': payment_data.get('payment_method', 'cash'),
            'payment_date': payment_data.get('payment_date'),
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('id')
        }
        
        result = await _db.invoices.update_one(
            {'_id': ObjectId(invoice_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        return {'success': True, 'message': 'Invoice marked as paid'}
    except Exception as e:
        print(f'Error marking invoice as paid: {e}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN - NOTIFICATIONS BELL ==================

@admin_finance_ops_router.get('/admin/notifications/summary')
async def get_admin_notifications_summary(current_user: dict = Depends(_get_current_user)):
    """Get summary of unread notifications for admin header bell"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Count unread from conversations collection (more reliable)
        chat_unread = 0
        conversations_with_unread = await _db.conversations.find({
            'unread_count_admin': {'$gt': 0}
        }).to_list(100)
        chat_unread = sum(c.get('unread_count_admin', 0) for c in conversations_with_unread)
        
        # Fallback: Count from chat_messages if conversations has none
        if chat_unread == 0:
            chat_unread = await _db.chat_messages.count_documents({
                '$or': [{'read': False}, {'is_read': False}],
                'sender_role': {'$nin': ['admin', 'assistant']}
            })
        
        # Count unread WhatsApp messages
        whatsapp_unread = await _db.whatsapp_messages.count_documents({
            'is_incoming': True,
            'read': {'$ne': True}
        })
        
        # Get recent unread items for preview - prioritize conversations collection
        recent_items = []
        
        # Get recent conversations with unread messages
        recent_convs = await _db.conversations.find({
            'unread_count_admin': {'$gt': 0}
        }).sort('updated_at', -1).limit(5).to_list(5)
        
        for conv in recent_convs:
            display_name = conv.get('client_name') or conv.get('user_name') or 'Cliente'
            
            # If no name, try to look up user
            if display_name == 'Cliente':
                user_id = conv.get('client_id') or conv.get('user_id')
                if user_id:
                    try:
                        user = None
                        if ObjectId.is_valid(str(user_id)):
                            user = await _db.users.find_one({'_id': ObjectId(user_id)})
                        if not user:
                            user = await _db.users.find_one({'id': user_id})
                        if user:
                            display_name = user.get('name') or user.get('full_name') or 'Cliente'
                    except:
                        pass
            
            recent_items.append({
                'type': 'chat',
                'from_name': display_name,
                'message': (conv.get('last_message', '') or '')[:50] + ('...' if len(conv.get('last_message', '') or '') > 50 else ''),
                'time': conv.get('updated_at') or conv.get('last_message_at'),
                'id': str(conv.get('_id', conv.get('conversation_id', '')))
            })
        
        # If no conversations found, fallback to chat_messages
        if not recent_items:
            recent_chats = await _db.chat_messages.find({
                '$or': [{'read': False}, {'is_read': False}],
                'sender_role': {'$nin': ['admin', 'assistant']}
            }).sort('created_at', -1).limit(3).to_list(3)
            
            for msg in recent_chats:
                user_id = msg.get('user_id') or msg.get('client_id')
                sender_name = msg.get('sender_name', '')
                user = None
                
                if user_id:
                    if ObjectId.is_valid(str(user_id)):
                        user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    if not user:
                        user = await _db.users.find_one({'id': user_id})
                
                display_name = 'Cliente'
                if user:
                    display_name = user.get('name') or user.get('full_name') or 'Cliente'
                elif sender_name:
                    display_name = sender_name
                
                recent_items.append({
                    'type': 'chat',
                    'from_name': display_name,
                    'message': msg.get('message', '')[:50] + '...' if len(msg.get('message', '')) > 50 else msg.get('message', ''),
                    'time': msg.get('created_at'),
                    'id': str(msg.get('_id'))
                })
        
        # Recent WhatsApp messages
        recent_whatsapps = await _db.whatsapp_messages.find({
            'is_incoming': True,
            'read': {'$ne': True}
        }).sort('created_at', -1).limit(3).to_list(3)
        
        for msg in recent_whatsapps:
            phone = msg.get('from_number', msg.get('phone', ''))
            user = None
            display_name = phone
            
            if phone and len(phone) >= 10:
                phone_suffix = phone[-10:]
                user = await _db.users.find_one({'phone': {'$regex': phone_suffix}})
                if not user:
                    user = await _db.clients.find_one({'phone': {'$regex': phone_suffix}})
            
            if user:
                display_name = user.get('name') or user.get('full_name') or phone
            
            message_content = msg.get('body', msg.get('message', ''))
            
            recent_items.append({
                'type': 'whatsapp',
                'from_name': display_name,
                'message': message_content[:50] + '...' if len(message_content) > 50 else message_content,
                'time': msg.get('created_at'),
                'id': str(msg.get('_id'))
            })
        
        # Sort by time
        recent_items.sort(key=lambda x: x.get('time', '') or '', reverse=True)
        
        return {
            'total': chat_unread + whatsapp_unread,
            'chat_unread': chat_unread,
            'whatsapp_unread': whatsapp_unread,
            'recent_items': recent_items[:5]
        }
        
    except Exception as e:
        logging.error(f'Error getting admin notifications summary: {e}')
        return {
            'total': 0,
            'chat_unread': 0,
            'whatsapp_unread': 0,
            'recent_items': []
        }


# ================== ADMIN CHAT (Extracted to chat_routes.py) ==================

# ================== CLIENT CHAT (Extracted to chat_routes.py) ==================

# ================== ADMIN - LEADS ==================

@admin_finance_ops_router.get('/admin/leads')
async def get_all_leads(current_user: dict = Depends(_get_current_user)):
    """Get all leads for admin"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        leads = await _db.leads.find().sort('created_at', -1).to_list(100)
        
        return {
            'leads': [{
                'id': str(lead['_id']),
                'name': lead.get('name', lead.get('full_name', '')),
                'email': lead.get('email', ''),
                'phone': lead.get('phone', ''),
                'source': lead.get('source', 'website'),
                'status': lead.get('status', 'new'),
                'notes': lead.get('notes', ''),
                'created_at': lead.get('created_at'),
                'last_contact': lead.get('last_contact')
            } for lead in leads]
        }
    except Exception as e:
        print(f'Error getting leads: {e}')
        return {'leads': []}


@admin_finance_ops_router.put('/admin/leads/{lead_id}')
async def update_lead(
    lead_id: str,
    lead_data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Update a lead's status or info"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        update_fields = {}
        if 'status' in lead_data:
            update_fields['status'] = lead_data['status']
        if 'notes' in lead_data:
            update_fields['notes'] = lead_data['notes']
        
        update_fields['updated_at'] = datetime.now(timezone.utc)
        update_fields['updated_by'] = current_user['id']
        
        await _db.leads.update_one(
            {'_id': ObjectId(lead_id)},
            {'$set': update_fields}
        )
        
        return {'success': True, 'message': 'Lead actualizado'}
    except Exception as e:
        print(f'Error updating lead: {e}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== LEADS (Assistant Portal) ==================

@admin_finance_ops_router.get('/leads')
async def get_leads(status: str = None, current_user: dict = Depends(_get_current_user)):
    """Get leads - accessible from assistant portal"""
    try:
        query = {}
        if status:
            query['status'] = status
        leads = await _db.leads.find(query).sort('created_at', -1).to_list(200)
        return {
            'leads': [{
                'id': str(lead['_id']),
                '_id': str(lead['_id']),
                'name': lead.get('name', ''),
                'phone': lead.get('phone', ''),
                'email': lead.get('email', ''),
                'source': lead.get('source', 'unknown'),
                'status': lead.get('status', 'new'),
                'notes': lead.get('notes', ''),
                'follow_ups': lead.get('follow_ups', []),
                'created_at': lead.get('created_at', ''),
                'updated_at': lead.get('updated_at', ''),
            } for lead in leads]
        }
    except Exception as e:
        logging.error(f'Error getting leads: {e}')
        return {'leads': []}


@admin_finance_ops_router.put('/leads/{lead_id}')
async def update_lead(lead_id: str, request: Request, current_user: dict = Depends(_get_current_user)):
    """Update a lead"""
    try:
        body = await request.json()
        update_data = {k: v for k, v in body.items() if k not in ['_id', 'id']}
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        await _db.leads.update_one(
            {'_id': ObjectId(lead_id)},
            {'$set': update_data}
        )
        return {'success': True, 'message': 'Lead actualizado'}
    except Exception as e:
        logging.error(f'Error updating lead: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.post('/leads/{lead_id}/follow-up')
async def add_lead_follow_up(lead_id: str, request: Request, current_user: dict = Depends(_get_current_user)):
    """Add a follow-up note to a lead"""
    try:
        body = await request.json()
        follow_up = {
            'note': body.get('note', ''),
            'type': body.get('type', 'call'),
            'created_by': current_user.get('name', current_user.get('email', '')),
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        
        await _db.leads.update_one(
            {'_id': ObjectId(lead_id)},
            {
                '$push': {'follow_ups': follow_up},
                '$set': {
                    'status': body.get('new_status', 'contacted'),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {'success': True, 'message': 'Seguimiento agregado'}
    except Exception as e:
        logging.error(f'Error adding follow-up: {e}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== TASKS (Assistant Portal) ==================

@admin_finance_ops_router.get('/tasks')
async def get_tasks(limit: int = 100, current_user: dict = Depends(_get_current_user)):
    """Get tasks for assistant portal"""
    try:
        tasks = await _db.tasks.find().sort('created_at', -1).to_list(limit)
        return {
            'tasks': [{
                '_id': str(task['_id']),
                'titulo': task.get('titulo', task.get('title', '')),
                'descripcion': task.get('descripcion', task.get('description', '')),
                'cliente': task.get('cliente', task.get('assigned_to', '')),
                'cliente_phone': task.get('cliente_phone', ''),
                'prioridad': task.get('prioridad', task.get('priority', 'media')),
                'estado': task.get('estado', task.get('status', 'pendiente')),
                'fecha_vencimiento': task.get('fecha_vencimiento', task.get('due_date', '')),
                'created_by': task.get('created_by', ''),
                'created_at': task.get('created_at', ''),
            } for task in tasks]
        }
    except Exception as e:
        logging.error(f'Error getting tasks: {e}')
        return {'tasks': []}


@admin_finance_ops_router.post('/tasks')
async def create_task(request: Request, current_user: dict = Depends(_get_current_user)):
    """Create a new task"""
    try:
        body = await request.json()
        task_data = {
            'titulo': body.get('titulo', body.get('title', '')),
            'descripcion': body.get('descripcion', body.get('description', '')),
            'cliente': body.get('cliente', body.get('assigned_to', '')),
            'cliente_phone': body.get('cliente_phone', ''),
            'prioridad': body.get('prioridad', body.get('priority', 'media')),
            'estado': body.get('estado', body.get('status', 'pendiente')),
            'fecha_vencimiento': body.get('fecha_vencimiento', body.get('due_date', '')),
            'created_by': current_user.get('name', current_user.get('email', '')),
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }
        result = await _db.tasks.insert_one(task_data)
        return {'success': True, 'id': str(result.inserted_id), 'message': 'Tarea creada'}
    except Exception as e:
        logging.error(f'Error creating task: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.put('/tasks/{task_id}')
async def update_task(task_id: str, request: Request, current_user: dict = Depends(_get_current_user)):
    """Update a task"""
    try:
        body = await request.json()
        update_data = {k: v for k, v in body.items() if k not in ['_id', 'id']}
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        if body.get('estado') == 'completada':
            update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
        
        await _db.tasks.update_one(
            {'_id': ObjectId(task_id)},
            {'$set': update_data}
        )
        return {'success': True, 'message': 'Tarea actualizada'}
    except Exception as e:
        logging.error(f'Error updating task: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@admin_finance_ops_router.delete('/tasks/{task_id}')
async def delete_task(task_id: str, current_user: dict = Depends(_get_current_user)):
    """Delete a task"""
    try:
        await _db.tasks.delete_one({'_id': ObjectId(task_id)})
        return {'success': True, 'message': 'Tarea eliminada'}
    except Exception as e:
        logging.error(f'Error deleting task: {e}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== ADMIN - JOB APPLICATIONS ==================

@admin_finance_ops_router.get('/admin/job-applications')
async def get_job_applications(current_user: dict = Depends(_get_current_user)):
    """Get all job applications for admin"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        applications = await _db.job_applications.find().sort('created_at', -1).to_list(100)
        
        return {
            'applications': [{
                'id': str(app['_id']),
                'name': app.get('name', app.get('full_name', '')),
                'email': app.get('email', ''),
                'phone': app.get('phone', ''),
                'position': app.get('position', 'General'),
                'experience': app.get('experience', ''),
                'status': app.get('status', 'pending'),
                'resume_url': app.get('resume_url', ''),
                'notes': app.get('notes', ''),
                'created_at': app.get('created_at')
            } for app in applications]
        }
    except Exception as e:
        print(f'Error getting applications: {e}')
        return {'applications': []}


@admin_finance_ops_router.put('/admin/job-applications/{application_id}')
async def update_job_application(
    application_id: str,
    app_data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Update a job application's status"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        update_fields = {}
        if 'status' in app_data:
            update_fields['status'] = app_data['status']
        if 'notes' in app_data:
            update_fields['notes'] = app_data['notes']
        
        update_fields['updated_at'] = datetime.now(timezone.utc)
        update_fields['updated_by'] = current_user['id']
        
        await _db.job_applications.update_one(
            {'_id': ObjectId(application_id)},
            {'$set': update_fields}
        )
        
        return {'success': True, 'message': 'Solicitud actualizada'}
    except Exception as e:
        print(f'Error updating application: {e}')
        raise HTTPException(status_code=500, detail=str(e))

@admin_finance_ops_router.delete('/admin/job-applications/{application_id}')
async def delete_job_application(
    application_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Delete a job application"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        # Try with ObjectId first
        try:
            result = await _db.job_applications.delete_one({'_id': ObjectId(application_id)})
        except:
            # Fallback to string id
            result = await _db.job_applications.delete_one({'id': application_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Solicitud no encontrada')
        
        return {'success': True, 'message': 'Solicitud eliminada'}
    except HTTPException:
        raise
    except Exception as e:
        print(f'Error deleting application: {e}')
        raise HTTPException(status_code=500, detail=str(e))




