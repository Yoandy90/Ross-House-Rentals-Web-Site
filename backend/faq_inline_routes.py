"""
FAQ Inline Routes Router
Extracted from server.py for modularization.
Handles FAQ categories, entries, voting, search, admin management.
"""
import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from pydantic import BaseModel, Field
from bson import ObjectId
try:
    from faq_data import FAQ_CATEGORIES, FAQ_DATA
except ImportError:
    FAQ_CATEGORIES = []
    FAQ_DATA = {}

logger = logging.getLogger(__name__)

faq_inline_router = APIRouter()
_db = None
_notification_service = None

def init_faq_inline_router(db):
    global _db
    _db = db


def update_faq_notification_service(notif_svc):
    global _notification_service
    _notification_service = notif_svc

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = str(authorization).replace('Bearer ', '') if str(authorization).startswith('Bearer ') else str(authorization)
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
    except:
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

# ================== FAQ ENDPOINTS ==================

from faq_data import FAQ_CATEGORIES, FAQ_DATA

@faq_inline_router.get('/faqs/grouped')
async def get_grouped_faqs():
    """Get all FAQs grouped by category"""
    try:
        grouped_faqs = []
        
        for category in FAQ_CATEGORIES:
            # Get FAQs for this category
            category_faqs = [faq for faq in FAQ_DATA if faq['category_id'] == category['id']]
            
            if category_faqs:
                grouped_faqs.append({
                    "category": category,
                    "faqs": category_faqs,
                    "count": len(category_faqs)
                })
        
        return grouped_faqs
        
    except Exception as e:
        logging.error(f"Error getting grouped FAQs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/faqs/search')
async def search_faqs(search_data: dict):
    """Search FAQs by query"""
    try:
        query = search_data.get('query', '').lower()
        language = search_data.get('language', 'en')
        limit = search_data.get('limit', 10)
        
        if len(query) < 2:
            return []
        
        results = []
        for faq in FAQ_DATA:
            # Search in question and answer based on language
            if language == 'es':
                searchable_text = f"{faq['question_es']} {faq['answer_es']}".lower()
            else:
                searchable_text = f"{faq['question']} {faq['answer']}".lower()
            
            if query in searchable_text:
                results.append(faq)
                
            if len(results) >= limit:
                break
        
        return results
        
    except Exception as e:
        logging.error(f"Error searching FAQs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/faqs/{faq_id}')
async def get_faq_detail(faq_id: str):
    """Get specific FAQ details and increment view count"""
    try:
        faq = next((f for f in FAQ_DATA if f['id'] == faq_id), None)
        
        if not faq:
            raise HTTPException(status_code=404, detail="FAQ not found")
        
        # Increment view count (in-memory for now)
        faq['views'] += 1
        
        return faq
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting FAQ detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/faqs/feedback')
async def submit_faq_feedback(feedback_data: dict):
    """Submit feedback on FAQ helpfulness"""
    try:
        faq_id = feedback_data.get('faq_id')
        helpful = feedback_data.get('helpful', True)
        
        faq = next((f for f in FAQ_DATA if f['id'] == faq_id), None)
        
        if not faq:
            raise HTTPException(status_code=404, detail="FAQ not found")
        
        # Update feedback count (in-memory for now)
        if helpful:
            faq['helpful_count'] += 1
        else:
            faq['not_helpful_count'] += 1
        
        return {"success": True, "message": "Feedback recorded"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error submitting FAQ feedback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# Temporary endpoint to download app icon
@faq_inline_router.get('/download-icon')
async def download_icon():
    """Temporary endpoint to download the app icon"""
    from fastapi.responses import FileResponse
    icon_path = '/app/frontend/assets/images/icon.png'
    return FileResponse(
        icon_path,
        media_type='image/png',
        filename='ross-tax-icon.png'
    )


# ============================================
# SISTEMA DE RECORDATORIOS AUTOMÁTICOS
# ============================================

@faq_inline_router.get('/admin/reminders/pending')
async def get_pending_reminders(current_user: dict = Depends(_get_current_user)):
    """Get all pending reminders that need attention"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        now = datetime.now(timezone.utc)
        tomorrow = now + timedelta(hours=24)
        
        reminders = {
            'appointments_24h': [],
            'overdue_invoices': [],
            'missing_documents': [],
            'summary': {}
        }
        
        # 1. CITAS EN LAS PRÓXIMAS 24 HORAS
        upcoming_appointments = await _db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed']},
            'scheduled_at': {'$gte': now, '$lte': tomorrow}
        }).to_list(100)
        
        for appt in upcoming_appointments:
            client = await _db.users.find_one({'_id': appt.get('user_id')})
            reminders['appointments_24h'].append({
                'id': appt['_id'],
                'client_name': client.get('name', 'Sin nombre') if client else 'Cliente desconocido',
                'client_email': client.get('email', '') if client else '',
                'client_phone': client.get('phone', '') if client else '',
                'scheduled_at': appt['scheduled_at'].isoformat(),
                'service': appt.get('service_type', 'Cita general'),
                'status': appt.get('status'),
                'notes': appt.get('notes', '')
            })
        
        # 2. FACTURAS VENCIDAS O POR VENCER
        overdue_invoices = await _db.invoices.find({
            'status': 'pending',
            'due_date': {'$lte': now + timedelta(days=7)}
        }).to_list(100)
        
        for inv in overdue_invoices:
            client = await _db.users.find_one({'_id': inv.get('user_id')})
            is_overdue = inv.get('due_date', now) < now
            reminders['overdue_invoices'].append({
                'id': inv['_id'],
                'invoice_number': inv.get('invoice_number', inv['_id'][:8]),
                'client_name': client.get('name', 'Sin nombre') if client else 'Cliente desconocido',
                'client_email': client.get('email', '') if client else '',
                'total': inv.get('total', 0),
                'due_date': inv.get('due_date').isoformat() if inv.get('due_date') else None,
                'is_overdue': is_overdue,
                'days_overdue': (now - inv.get('due_date')).days if is_overdue else 0
            })
        
        # 3. DOCUMENTOS FALTANTES (clientes activos sin documentos recientes)
        active_clients = await _db.users.find({
            'role': 'client',
            'is_active': {'$ne': False}
        }).to_list(500)
        
        for client in active_clients:
            # Verificar si tiene documentos en los últimos 90 días
            recent_docs = await _db.documents.count_documents({
                'user_id': client['_id'],
                'uploaded_at': {'$gte': now - timedelta(days=90)}
            })
            
            if recent_docs == 0:
                # Verificar si tiene proyecto activo
                active_project = await _db.service_orders.find_one({
                    'client_id': client['_id'],
                    'status': {'$in': ['pending', 'in_progress']}
                })
                
                if active_project:
                    reminders['missing_documents'].append({
                        'client_id': client['_id'],
                        'client_name': client.get('name', 'Sin nombre'),
                        'client_email': client.get('email', ''),
                        'project_number': active_project.get('order_number', ''),
                        'project_status': active_project.get('status'),
                        'last_doc_uploaded': None
                    })
        
        # RESUMEN
        reminders['summary'] = {
            'appointments_count': len(reminders['appointments_24h']),
            'overdue_invoices_count': len(reminders['overdue_invoices']),
            'missing_documents_count': len(reminders['missing_documents']),
            'total_overdue_amount': sum(inv['total'] for inv in reminders['overdue_invoices'] if inv.get('is_overdue')),
            'generated_at': now.isoformat()
        }
        
        return reminders
        
    except Exception as e:
        logging.error(f'Error getting reminders: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/admin/reminders/send-appointment-reminders')
async def send_appointment_reminders_endpoint(
    hours_before: int = 24,
    current_user: dict = Depends(_get_current_user)
):
    """Send reminders for upcoming appointments"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        now = datetime.now(timezone.utc)
        reminder_window = now + timedelta(hours=hours_before)
        
        # Buscar citas en la ventana de tiempo
        appointments = await _db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed']},
            'scheduled_at': {'$gte': now, '$lte': reminder_window},
            'reminder_sent': {'$ne': True}
        }).to_list(100)
        
        sent_count = 0
        errors = []
        
        for appt in appointments:
            try:
                client = await _db.users.find_one({'_id': appt.get('user_id')})
                if not client:
                    continue
                
                scheduled_time = appt['scheduled_at'].strftime('%d/%m/%Y a las %I:%M %p')
                
                # Enviar notificación push
                await create_notification(
                    user_id=client['_id'],
                    title='📅 Recordatorio de Cita',
                    body=f'Tu cita está programada para {scheduled_time}. ¡Te esperamos!',
                    type='appointment_reminder',
                    data={'appointment_id': appt['_id']}
                )
                
                # Marcar como enviado
                await _db.appointments.update_one(
                    {'_id': appt['_id']},
                    {'$set': {'reminder_sent': True, 'reminder_sent_at': now}}
                )
                
                sent_count += 1
                
            except Exception as e:
                errors.append({'appointment_id': appt['_id'], 'error': str(e)})
        
        return {
            'success': True,
            'sent_count': sent_count,
            'total_found': len(appointments),
            'errors': errors
        }
        
    except Exception as e:
        logging.error(f'Error sending appointment reminders: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/admin/reminders/send-invoice-reminders')
async def send_invoice_reminders_endpoint(
    current_user: dict = Depends(_get_current_user)
):
    """Send reminders for pending/overdue invoices"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        now = datetime.now(timezone.utc)
        
        # Buscar facturas pendientes que vencen en 3 días o ya vencidas
        invoices = await _db.invoices.find({
            'status': 'pending',
            'due_date': {'$lte': now + timedelta(days=3)},
            'payment_reminder_sent': {'$ne': True}
        }).to_list(100)
        
        sent_count = 0
        errors = []
        
        for inv in invoices:
            try:
                client = await _db.users.find_one({'_id': inv.get('user_id')})
                if not client:
                    continue
                
                is_overdue = inv.get('due_date', now) < now
                
                if is_overdue:
                    title = '⚠️ Factura Vencida'
                    body = f'Tu factura #{inv.get("invoice_number", inv["_id"][:8])} por ${inv.get("total", 0):.2f} está vencida. Por favor realiza el pago.'
                else:
                    title = '📋 Recordatorio de Pago'
                    body = f'Tu factura #{inv.get("invoice_number", inv["_id"][:8])} por ${inv.get("total", 0):.2f} vence pronto.'
                
                # Enviar notificación push
                await create_notification(
                    user_id=client['_id'],
                    title=title,
                    body=body,
                    type='invoice_reminder',
                    data={'invoice_id': inv['_id']}
                )
                
                # Marcar como enviado
                await _db.invoices.update_one(
                    {'_id': inv['_id']},
                    {'$set': {'payment_reminder_sent': True, 'reminder_sent_at': now}}
                )
                
                sent_count += 1
                
            except Exception as e:
                errors.append({'invoice_id': inv['_id'], 'error': str(e)})
        
        return {
            'success': True,
            'sent_count': sent_count,
            'total_found': len(invoices),
            'errors': errors
        }
        
    except Exception as e:
        logging.error(f'Error sending invoice reminders: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/admin/reminders/send-document-reminders')
async def send_document_reminders_endpoint(
    current_user: dict = Depends(_get_current_user)
):
    """Send intelligent document reminders to clients with missing documents"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        from document_reminders_service import get_document_reminders_service
        doc_service = get_document_reminders_service()
        
        if not doc_service:
            raise HTTPException(status_code=500, detail='Document reminders service not initialized')
        
        result = await doc_service.send_document_reminders()
        
        return {
            'success': True,
            'message': f'Se enviaron {result["reminders_sent"]} recordatorios de documentos',
            **result
        }
        
    except Exception as e:
        logging.error(f'Error sending document reminders: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/admin/reminders/missing-documents/{user_id}')
async def get_user_missing_documents(
    user_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Get list of missing documents for a specific user"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        from document_reminders_service import get_document_reminders_service
        doc_service = get_document_reminders_service()
        
        if not doc_service:
            raise HTTPException(status_code=500, detail='Document reminders service not initialized')
        
        missing = await doc_service.get_missing_documents(user_id)
        
        return {
            'success': True,
            'user_id': user_id,
            'missing_count': len(missing),
            'documents': missing
        }
        
    except Exception as e:
        logging.error(f'Error getting missing documents: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# BÚSQUEDA GLOBAL
# ============================================

@faq_inline_router.get('/admin/search')
async def global_search(
    q: str = Query(..., min_length=2),
    types: str = Query('all'),  # 'all', 'clients', 'invoices', 'projects', 'appointments'
    limit: int = Query(50, ge=1, le=1000),
    current_user: dict = Depends(_get_current_user)
):
    """Global search across clients, invoices, projects, and appointments"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        query = q.strip().lower()
        search_types = types.split(',') if types != 'all' else ['clients', 'invoices', 'projects', 'appointments']
        
        results = {
            'query': q,
            'clients': [],
            'invoices': [],
            'projects': [],
            'appointments': [],
            'total_count': 0
        }
        
        # BUSCAR CLIENTES
        if 'clients' in search_types:
            clients = await _db.users.find({
                'role': 'client',
                '$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'email': {'$regex': query, '$options': 'i'}},
                    {'phone': {'$regex': query, '$options': 'i'}}
                ]
            }).limit(limit).to_list(limit)
            
            results['clients'] = [{
                'id': c['_id'],
                'type': 'client',
                'name': c.get('name', 'Sin nombre'),
                'email': c.get('email', ''),
                'phone': c.get('phone', ''),
                'match_field': 'name' if query in c.get('name', '').lower() else 'email' if query in c.get('email', '').lower() else 'phone'
            } for c in clients]
        
        # BUSCAR FACTURAS
        if 'invoices' in search_types:
            invoices = await _db.invoices.find({
                '$or': [
                    {'invoice_number': {'$regex': query, '$options': 'i'}},
                    {'service_name': {'$regex': query, '$options': 'i'}}
                ]
            }).limit(limit).to_list(limit)
            
            for inv in invoices:
                client = await _db.users.find_one({'_id': inv.get('user_id')})
                results['invoices'].append({
                    'id': inv['_id'],
                    'type': 'invoice',
                    'invoice_number': inv.get('invoice_number', inv['_id'][:8]),
                    'client_name': client.get('name', 'Sin nombre') if client else 'N/A',
                    'total': inv.get('total', 0),
                    'status': inv.get('status'),
                    'created_at': inv.get('created_at').isoformat() if inv.get('created_at') else None
                })
        
        # BUSCAR PROYECTOS
        if 'projects' in search_types:
            projects = await _db.service_orders.find({
                '$or': [
                    {'order_number': {'$regex': query, '$options': 'i'}},
                    {'description': {'$regex': query, '$options': 'i'}},
                    {'client_name': {'$regex': query, '$options': 'i'}}
                ]
            }).limit(limit).to_list(limit)
            
            results['projects'] = [{
                'id': p['_id'],
                'type': 'project',
                'order_number': p.get('order_number', ''),
                'client_name': p.get('client_name', 'N/A'),
                'service_type': p.get('service_type', ''),
                'status': p.get('status'),
                'created_at': p.get('created_at').isoformat() if p.get('created_at') else None
            } for p in projects]
        
        # BUSCAR CITAS
        if 'appointments' in search_types:
            # Primero buscar clientes que coincidan, luego sus citas
            matching_clients = await _db.users.find({
                'role': 'client',
                '$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'email': {'$regex': query, '$options': 'i'}}
                ]
            }).to_list(50)
            
            client_ids = [c['_id'] for c in matching_clients]
            
            if client_ids:
                appointments = await _db.appointments.find({
                    'user_id': {'$in': client_ids}
                }).sort('scheduled_at', -1).limit(limit).to_list(limit)
                
                for appt in appointments:
                    client = next((c for c in matching_clients if c['_id'] == appt.get('user_id')), None)
                    results['appointments'].append({
                        'id': appt['_id'],
                        'type': 'appointment',
                        'client_name': client.get('name', 'N/A') if client else 'N/A',
                        'scheduled_at': appt.get('scheduled_at').isoformat() if appt.get('scheduled_at') else None,
                        'service_type': appt.get('service_type', 'Cita'),
                        'status': appt.get('status')
                    })
        
        results['total_count'] = (
            len(results['clients']) + 
            len(results['invoices']) + 
            len(results['projects']) + 
            len(results['appointments'])
        )
        
        return results
        
    except Exception as e:
        logging.error(f'Error in global search: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))



# ============================================
# REPORTES EN PDF
# ============================================

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch
from io import BytesIO


@faq_inline_router.get('/admin/reports/invoice-pdf/{invoice_id}')
async def generate_invoice_pdf(
    invoice_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Generate PDF for a specific invoice"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Obtener factura
        invoice = await _db.invoices.find_one({'_id': invoice_id})
        if not invoice:
            raise HTTPException(status_code=404, detail='Factura no encontrada')
        
        # Obtener cliente
        client = await _db.users.find_one({'_id': invoice.get('user_id')})
        
        # Crear PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        # Estilo personalizado
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#6C1110'))
        header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#1a1a2e'))
        normal_style = styles['Normal']
        
        # Encabezado
        elements.append(Paragraph("ROSS TAX PREPARATION", title_style))
        elements.append(Paragraph("Servicios Profesionales de Impuestos", normal_style))
        elements.append(Spacer(1, 20))
        
        # Número de factura
        elements.append(Paragraph(f"<b>FACTURA #{invoice.get('invoice_number', invoice_id[:8])}</b>", header_style))
        elements.append(Spacer(1, 10))
        
        # Info del cliente
        elements.append(Paragraph("<b>Cliente:</b>", normal_style))
        elements.append(Paragraph(f"Nombre: {client.get('name', 'N/A') if client else 'N/A'}", normal_style))
        elements.append(Paragraph(f"Email: {client.get('email', 'N/A') if client else 'N/A'}", normal_style))
        elements.append(Paragraph(f"Teléfono: {client.get('phone', 'N/A') if client else 'N/A'}", normal_style))
        elements.append(Spacer(1, 15))
        
        # Fechas
        created_at = invoice.get('created_at')
        due_date = invoice.get('due_date')
        elements.append(Paragraph(f"<b>Fecha:</b> {created_at.strftime('%d/%m/%Y') if created_at else 'N/A'}", normal_style))
        elements.append(Paragraph(f"<b>Vencimiento:</b> {due_date.strftime('%d/%m/%Y') if due_date else 'N/A'}", normal_style))
        elements.append(Paragraph(f"<b>Estado:</b> {invoice.get('status', 'pending').upper()}", normal_style))
        elements.append(Spacer(1, 20))
        
        # Tabla de items
        items_data = [['Descripción', 'Cantidad', 'Precio', 'Total']]
        items = invoice.get('items', [])
        
        for item in items:
            items_data.append([
                item.get('description', 'Servicio'),
                str(item.get('quantity', 1)),
                f"${item.get('unit_price', 0):.2f}",
                f"${item.get('quantity', 1) * item.get('unit_price', 0):.2f}"
            ])
        
        table = Table(items_data, colWidths=[3.5*inch, 1*inch, 1.25*inch, 1.25*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 20))
        
        # Total
        total_data = [
            ['Subtotal:', f"${invoice.get('subtotal', invoice.get('total', 0)):.2f}"],
            ['Impuesto:', f"${invoice.get('tax_amount', 0):.2f}"],
            ['TOTAL:', f"${invoice.get('total', 0):.2f}"]
        ]
        total_table = Table(total_data, colWidths=[5*inch, 2*inch])
        total_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#6C1110')),
            ('LINEABOVE', (0, -1), (-1, -1), 2, colors.HexColor('#6C1110')),
        ]))
        elements.append(total_table)
        elements.append(Spacer(1, 30))
        
        # Notas
        if invoice.get('notes'):
            elements.append(Paragraph("<b>Notas:</b>", normal_style))
            elements.append(Paragraph(invoice.get('notes', ''), normal_style))
        
        # Footer
        elements.append(Spacer(1, 40))
        elements.append(Paragraph("Gracias por confiar en Ross Tax Preparation", ParagraphStyle('Footer', parent=normal_style, alignment=1)))
        
        # Generar PDF
        doc.build(elements)
        buffer.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            buffer,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="factura_{invoice.get("invoice_number", invoice_id)}.pdf"'}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error generating invoice PDF: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/admin/reports/clients-pdf')
async def generate_clients_report_pdf(
    current_user: dict = Depends(_get_current_user)
):
    """Generate PDF report of all clients"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        clients = await _db.users.find({'role': 'client'}).sort('name', 1).to_list(1000)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor('#6C1110'))
        
        # Título
        elements.append(Paragraph("REPORTE DE CLIENTES", title_style))
        elements.append(Paragraph(f"Ross Tax Preparation - {datetime.now().strftime('%d/%m/%Y')}", styles['Normal']))
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"Total de clientes: {len(clients)}", styles['Normal']))
        elements.append(Spacer(1, 15))
        
        # Tabla
        data = [['#', 'Nombre', 'Email', 'Teléfono', 'Registrado']]
        for i, client in enumerate(clients[:100], 1):  # Limitar a 100 para el PDF
            created = client.get('created_at')
            data.append([
                str(i),
                client.get('name', 'N/A')[:25],
                client.get('email', 'N/A')[:30],
                client.get('phone', 'N/A'),
                created.strftime('%d/%m/%y') if created else 'N/A'
            ])
        
        table = Table(data, colWidths=[0.4*inch, 1.8*inch, 2.2*inch, 1.3*inch, 0.8*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f8f8')]),
        ]))
        elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            buffer,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="reporte_clientes_{datetime.now().strftime("%Y%m%d")}.pdf"'}
        )
        
    except Exception as e:
        logging.error(f'Error generating clients PDF: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# EXPENSE RECEIPTS (Extracted to receipts_routes.py)
# ============================================

# ============================================
# ADMIN USER MANAGEMENT (Extracted to admin_users_routes.py)
# ============================================

@faq_inline_router.get('/admin/reports/revenue-pdf')
async def generate_revenue_report_pdf(
    period: str = Query('month'),  # 'week', 'month', 'quarter', 'year'
    current_user: dict = Depends(_get_current_user)
):
    """Generate PDF report of revenue"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        now = datetime.now(timezone.utc)
        
        # Determinar rango de fechas
        if period == 'week':
            start_date = now - timedelta(days=7)
            period_name = 'Última Semana'
        elif period == 'month':
            start_date = now - timedelta(days=30)
            period_name = 'Último Mes'
        elif period == 'quarter':
            start_date = now - timedelta(days=90)
            period_name = 'Último Trimestre'
        else:
            start_date = now - timedelta(days=365)
            period_name = 'Último Año'
        
        # Obtener facturas pagadas
        paid_invoices = await _db.invoices.find({
            'status': 'paid',
            'paid_at': {'$gte': start_date}
        }).sort('paid_at', -1).to_list(500)
        
        total_revenue = sum(inv.get('total', 0) for inv in paid_invoices)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor('#6C1110'))
        
        # Título
        elements.append(Paragraph("REPORTE DE INGRESOS", title_style))
        elements.append(Paragraph(f"Ross Tax Preparation - {period_name}", styles['Normal']))
        elements.append(Paragraph(f"Generado: {now.strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Resumen
        summary_style = ParagraphStyle('Summary', parent=styles['Heading2'], fontSize=16)
        elements.append(Paragraph(f"<b>Total Ingresos: ${total_revenue:,.2f}</b>", summary_style))
        elements.append(Paragraph(f"Facturas Pagadas: {len(paid_invoices)}", styles['Normal']))
        elements.append(Paragraph(f"Promedio por Factura: ${(total_revenue/len(paid_invoices)) if paid_invoices else 0:,.2f}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        # Tabla detallada
        if paid_invoices:
            data = [['Fecha', 'Factura #', 'Cliente', 'Servicio', 'Monto']]
            for inv in paid_invoices[:50]:
                client = await _db.users.find_one({'_id': inv.get('user_id')})
                data.append([
                    inv.get('paid_at').strftime('%d/%m/%y') if inv.get('paid_at') else 'N/A',
                    inv.get('invoice_number', inv['_id'][:8]),
                    (client.get('name', 'N/A') if client else 'N/A')[:20],
                    inv.get('service_name', 'Servicio')[:20],
                    f"${inv.get('total', 0):.2f}"
                ])
            
            table = Table(data, colWidths=[0.8*inch, 1.2*inch, 1.8*inch, 1.8*inch, 1*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f8f8')]),
            ]))
            elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            buffer,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="reporte_ingresos_{period}_{now.strftime("%Y%m%d")}.pdf"'}
        )
        
    except Exception as e:
        logging.error(f'Error generating revenue PDF: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ROSS AI BRAIN - PROACTIVE ALERTS ENDPOINTS
# ============================================

@faq_inline_router.get('/ross/status')
async def get_ross_status_endpoint(
    current_user: dict = Depends(_require_admin)
):
    """Get Ross system status"""
    from ross_proactive_alerts import get_ross_alerts
    ross_alerts = get_ross_alerts()
    
    return {
        'success': True,
        'status': 'active' if ross_alerts else 'inactive',
        'version': '2.0',
        'capabilities': [
            'proactive_alerts',
            'document_analysis',
            'client_insights',
            'appointment_monitoring',
            'receipt_classification',
            'birthday_tracking',
            'business_metrics',
            'smart_recommendations'
        ],
        'scheduled_tasks': [
            {'name': 'Hourly Analysis', 'schedule': 'Every hour at :30'},
            {'name': 'Urgent Alert Notifications', 'schedule': 'Real-time'}
        ]
    }


@faq_inline_router.get('/ross/dashboard')
async def get_ross_dashboard_endpoint(
    current_user: dict = Depends(_require_admin)
):
    """Get Ross AI Brain dashboard with alerts, insights, and recommendations"""
    try:
        from ross_proactive_alerts import get_ross_alerts
        ross_alerts = get_ross_alerts()
        
        if not ross_alerts:
            return {
                'success': False,
                'error': 'Ross alerts service not initialized'
            }
        
        result = await ross_alerts.run_full_analysis()
        return result
        
    except Exception as e:
        logging.error(f"Error getting Ross dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/ross/alerts')
async def get_ross_alerts_endpoint(
    limit: int = 20,
    alert_type: str = None,
    current_user: dict = Depends(_require_admin)
):
    """Get current alerts from Ross"""
    try:
        from ross_proactive_alerts import get_ross_alerts
        ross_alerts = get_ross_alerts()
        
        if not ross_alerts:
            return {'success': False, 'error': 'Ross not initialized'}
        
        latest = await ross_alerts.get_latest_analysis()
        
        if not latest:
            result = await ross_alerts.run_full_analysis()
            alerts = result.get('alerts', [])
        else:
            alerts = latest.get('alerts', [])
        
        if alert_type:
            alerts = [a for a in alerts if a.get('type') == alert_type]
        
        return {
            'success': True,
            'alerts': alerts[:limit],
            'total': len(alerts),
            'last_updated': latest.get('timestamp').isoformat() if latest and latest.get('timestamp') else datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logging.error(f"Error getting Ross alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/ross/analyze')
async def trigger_ross_analysis_endpoint(
    current_user: dict = Depends(_require_admin)
):
    """Manually trigger a Ross analysis"""
    try:
        from ross_proactive_alerts import get_ross_alerts
        ross_alerts = get_ross_alerts()
        
        if not ross_alerts:
            return {'success': False, 'error': 'Ross not initialized'}
        
        result = await ross_alerts.run_full_analysis()
        return result
        
    except Exception as e:
        logging.error(f"Error triggering Ross analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/ross/insights')
async def get_ross_insights_endpoint(
    current_user: dict = Depends(_require_admin)
):
    """Get business insights from Ross"""
    try:
        from ross_proactive_alerts import get_ross_alerts
        ross_alerts = get_ross_alerts()
        
        if not ross_alerts:
            return {'success': False, 'error': 'Ross not initialized'}
        
        latest = await ross_alerts.get_latest_analysis()
        
        if not latest:
            result = await ross_alerts.run_full_analysis()
            return {
                'success': True,
                'insights': result.get('insights', []),
                'recommendations': result.get('recommendations', []),
                'metrics': result.get('metrics', {})
            }
        
        return {
            'success': True,
            'insights': latest.get('insights', []),
            'recommendations': latest.get('recommendations', []),
            'metrics': latest.get('metrics', {}),
            'last_updated': latest.get('timestamp').isoformat() if latest.get('timestamp') else None
        }
        
    except Exception as e:
        logging.error(f"Error getting Ross insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# CUSTOMER FEEDBACK SYSTEM
# ============================================

@faq_inline_router.post('/appointments/{appointment_id}/complete')
async def mark_appointment_complete(
    appointment_id: str,
    attended: bool = True,
    current_user: dict = Depends(_require_admin)
):
    """Mark appointment as completed and optionally send feedback request"""
    logging.info(f"📋 Marking appointment {appointment_id} as {'attended' if attended else 'no-show'}")
    try:
        # Try to find appointment with multiple ID formats
        appointment = None
        query_id = None
        is_square_appointment = False
        
        # First try as ObjectId if it's 24 hex chars
        if len(appointment_id) == 24:
            try:
                query_id = ObjectId(appointment_id)
                appointment = await _db.appointments.find_one({'_id': query_id})
            except:
                pass
        
        # Try as string ID (UUID format)
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
            if appointment:
                query_id = appointment_id
        
        # Try with 'id' field
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
            if appointment:
                query_id = appointment.get('_id')
        
        # Try with square_id field
        if not appointment:
            appointment = await _db.appointments.find_one({'square_id': appointment_id})
            if appointment:
                query_id = appointment.get('_id')
        
        # If still not found, try to get from Square API
        if not appointment:
            try:
                from square_service import SquareService
                square_svc = SquareService()
                square_booking = square_svc.get_booking(appointment_id)
                
                if square_booking:
                    is_square_appointment = True
                    # Create a virtual appointment object from Square data
                    appointment = {
                        '_id': appointment_id,
                        'square_id': appointment_id,
                        'user_name': square_booking.get('user_name', 'Cliente'),
                        'user_email': square_booking.get('user_email'),
                        'user_phone': square_booking.get('user_phone'),
                        'customer_id': square_booking.get('customer_id'),
                        'service_name': square_booking.get('service_name', 'Cita'),
                        'scheduled_at': square_booking.get('scheduled_at'),
                        'status': square_booking.get('status'),
                        'source': 'square'
                    }
                    query_id = appointment_id
                    logging.info(f"📦 Found Square appointment: {appointment_id}")
            except Exception as e:
                logging.warning(f"Could not fetch from Square: {e}")
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Appointment not found in local DB or Square')
        
        # Update appointment status (only for local appointments)
        if not is_square_appointment and query_id:
            update_data = {
                'status': 'completed' if attended else 'no_show',
                'completed_at': datetime.now(timezone.utc),
                'attended': attended
            }
            
            await _db.appointments.update_one(
                {'_id': query_id},
                {'$set': update_data}
            )
        elif is_square_appointment:
            # For Square appointments, create a local record to track completion
            completion_record = {
                'square_id': appointment_id,
                'status': 'completed' if attended else 'no_show',
                'completed_at': datetime.now(timezone.utc),
                'attended': attended,
                'customer_name': appointment.get('user_name'),
                'customer_email': appointment.get('user_email'),
                'customer_phone': appointment.get('user_phone'),
                'service_name': appointment.get('service_name'),
                'scheduled_at': appointment.get('scheduled_at')
            }
            await _db.appointment_completions.update_one(
                {'square_id': appointment_id},
                {'$set': completion_record},
                upsert=True
            )
            logging.info(f"✅ Square appointment completion recorded: {appointment_id}")
        
        # Update associated service order to completed (if attended) or cancelled (if no-show)
        try:
            service_order_status = 'completed' if attended else 'cancelled'
            result = await _db.service_orders.update_many(
                {'appointment_id': appointment_id},
                {'$set': {
                    'status': service_order_status,
                    'completed_at': datetime.now(timezone.utc) if attended else None,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            if result.modified_count > 0:
                logging.info(f"✅ Service order(s) marked as {service_order_status} for appointment {appointment_id}")
        except Exception as so_err:
            logging.warning(f"Could not update service order: {so_err}")
        
        # If attended, create feedback request and send notification
        if attended:
            # Get user info - try multiple ID formats
            user_id = appointment.get('user_id')
            user = None
            
            if user_id:
                # Try as string first
                user = await _db.users.find_one({'_id': user_id})
                if not user:
                    # Try as ObjectId
                    try:
                        user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    except:
                        pass
                if not user:
                    # Try with 'id' field
                    user = await _db.users.find_one({'id': user_id})
            
            # Create feedback token
            import secrets
            feedback_token = secrets.token_urlsafe(32)
            
            # Get user info from appointment if user not found
            user_name = 'Cliente'
            user_email = None
            user_phone = None
            
            if user:
                user_name = user.get('full_name') or user.get('name', 'Cliente')
                user_email = user.get('email')
                user_phone = user.get('phone')
            else:
                # Use appointment data as fallback
                user_name = appointment.get('user_name', 'Cliente')
                user_email = appointment.get('user_email')
                user_phone = appointment.get('user_phone')
                logging.warning(f"⚠️ User not found for appointment {appointment_id}, using appointment data")
            
            # Create feedback request
            feedback_request = {
                'appointment_id': appointment_id,
                'user_id': str(user_id) if user_id else '',
                'user_name': user_name,
                'user_email': user_email,
                'user_phone': user_phone,
                'service': appointment.get('service_name') or appointment.get('service', 'Consulta'),
                'token': feedback_token,
                'status': 'pending',
                'created_at': datetime.now(timezone.utc),
                'expires_at': datetime.now(timezone.utc) + timedelta(days=7)
            }
            
            await _db.feedback_requests.insert_one(feedback_request)
            logging.info(f"✅ Feedback request created with token: {feedback_token[:20]}...")
            
            # Send notification (email and/or WhatsApp)
            feedback_url = f"https://www.rosstaxpreparation.com/feedback/{feedback_token}"
            
            message = f"""¡Hola {user_name}! 👋

Gracias por visitarnos hoy en Ross Tax Preparation.

Nos encantaría conocer tu opinión sobre el servicio que recibiste. Tu feedback nos ayuda a mejorar.

👉 Deja tu opinión aquí: {feedback_url}

¡Gracias por confiar en nosotros! 🙏

- El equipo de Ross Tax"""

            # Try to send via WhatsApp
            try:
                if user_phone:
                    from whatsapp_service import WhatsAppService
                    ws = WhatsAppService(_db)
                    if ws.phone_number_id and ws.access_token:
                        phone = user_phone.replace('+', '').replace(' ', '').replace('-', '')
                        await ws.send_message(phone, message)
                        logging.info(f"✅ WhatsApp feedback request sent to {phone}")
            except Exception as e:
                logging.warning(f"Could not send WhatsApp feedback request: {e}")
            
            # Try to send via SMS - Include Google Review link
            try:
                if user_phone:
                    from twilio.rest import Client as TwilioClient
                    twilio_sid = os.getenv('TWILIO_ACCOUNT_SID')
                    twilio_token = os.getenv('TWILIO_AUTH_TOKEN')
                    twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
                    
                    if twilio_sid and twilio_token and twilio_phone:
                        twilio_client = TwilioClient(twilio_sid, twilio_token)
                        google_review_url = "https://g.page/r/Ca-92RHBZeMzEBM/review"
                        sms_message = f"¡Hola {user_name.split()[0]}! 👋 Gracias por tu visita a Ross Tax. ¿Nos regalas 2 min para una reseña? Tu opinión nos ayuda mucho ⭐ {google_review_url} ¡Gracias!"
                        phone = user_phone.replace(' ', '').replace('-', '')
                        if not phone.startswith('+'):
                            phone = '+1' + phone.replace('+', '')
                        twilio_client.messages.create(
                            body=sms_message,
                            from_=twilio_phone,
                            to=phone
                        )
                        logging.info(f"✅ SMS Google review request sent to {phone}")
            except Exception as e:
                logging.warning(f"Could not send SMS feedback request: {e}")
            
            # Try to send via email - Include Google Review link
            try:
                if user_email:
                    from sendgrid import SendGridAPIClient
                    from sendgrid.helpers.mail import Mail, Email, To
                    
                    sendgrid_key = os.getenv('SENDGRID_API_KEY')
                    google_review_url = "https://g.page/r/Ca-92RHBZeMzEBM/review"
                    
                    if sendgrid_key:
                        sg = SendGridAPIClient(sendgrid_key)
                        first_name = user_name.split()[0] if user_name else 'Cliente'
                        
                        email_html = f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: Segoe UI, Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 50%, #A52422 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: 700;">⭐ ¡Tu Opinión Vale Oro! ⭐</h1>
                            <p style="color: rgba(255,255,255,0.9); font-size: 16px; margin: 0;">Queremos saber cómo fue tu experiencia</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #333; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">¡Hola {first_name}! 👋</p>
                            <p style="color: #333; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">Gracias por visitarnos hoy en <strong>Ross Tax Preparation</strong>. Fue un placer ayudarte.</p>
                            <p style="color: #333; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">Tu opinión es muy importante para nosotros. Si tuviste una buena experiencia, ¿podrías regalarnos <strong>2 minutos</strong> para dejarnos una reseña en Google? 🙏</p>
                            <div style="text-align: center; margin: 30px 0;"><span style="font-size: 36px;">⭐⭐⭐⭐⭐</span></div>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="{google_review_url}" style="display: inline-block; background: linear-gradient(135deg, #6C1110, #A52422); color: #ffffff; text-decoration: none; padding: 18px 45px; border-radius: 50px; font-size: 18px; font-weight: 700; box-shadow: 0 4px 15px rgba(108,17,16,0.4);">📝 Dejar Mi Reseña en Google</a>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #FFF5F5; border-left: 4px solid #6C1110; padding: 20px; margin: 30px 0; border-radius: 0 12px 12px 0;">
                                <p style="color: #6C1110; font-weight: 700; margin: 0 0 10px 0; font-size: 15px;">💝 ¿Por qué tu reseña importa?</p>
                                <ul style="color: #555; margin: 0; padding-left: 20px; line-height: 1.8;">
                                    <li>Ayuda a otras familias a encontrar un servicio confiable</li>
                                    <li>Nos motiva a seguir mejorando cada día</li>
                                    <li>Fortalece nuestra comunidad hispana en Dumas</li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9f9f9; padding: 30px; text-align: center; border-top: 1px solid #eee;">
                            <p style="color: #6C1110; font-weight: 700; font-size: 18px; margin: 0 0 10px 0;">Ross Tax Preparation LLC</p>
                            <p style="color: #666; font-size: 14px; margin: 0 0 5px 0;">📍 305 Bruce Ave, Dumas, TX 79029</p>
                            <p style="color: #666; font-size: 14px; margin: 0 0 5px 0;">📞 (806) 934-2018 | 💬 WhatsApp: (806) 934-2018</p>
                            <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">Con gratitud, <strong>El equipo de Ross Tax</strong> ❤️</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
                        message = Mail(
                            from_email=Email('info@rosstaxpreparation.com', 'Ross Tax Preparation'),
                            to_emails=To(user_email),
                            subject='⭐ ¡Tu Opinión Vale Oro! - Ross Tax Preparation',
                            html_content=email_html
                        )
                        sg.send(message)
                        logging.info(f"✅ Email Google review request sent to {user_email}")
            except Exception as e:
                logging.warning(f"Could not send email feedback request: {e}")
            
            return {
                'success': True,
                'message': 'Appointment completed and feedback request sent',
                'feedback_token': feedback_token
            }
        
        # If NOT attended (no-show), send a gentle follow-up message
        else:
            # Get user info - try multiple ID formats
            user_id = appointment.get('user_id')
            user = None
            
            if user_id:
                user = await _db.users.find_one({'_id': user_id})
                if not user:
                    try:
                        user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    except:
                        pass
                if not user:
                    user = await _db.users.find_one({'id': user_id})
            
            # Get user info from appointment if user not found
            user_name = 'Cliente'
            user_email = None
            user_phone = None
            
            if user:
                user_name = user.get('full_name') or user.get('name', 'Cliente')
                user_email = user.get('email')
                user_phone = user.get('phone')
            else:
                user_name = appointment.get('user_name', 'Cliente')
                user_email = appointment.get('user_email')
                user_phone = appointment.get('user_phone')
            
            # Get appointment date for message
            appointment_date = appointment.get('scheduled_at')
            if appointment_date:
                if isinstance(appointment_date, str):
                    try:
                        appointment_date = datetime.fromisoformat(appointment_date.replace('Z', '+00:00'))
                    except:
                        appointment_date = None
                
                if appointment_date:
                    formatted_date = appointment_date.strftime('%d/%m/%Y a las %H:%M')
                else:
                    formatted_date = 'programada'
            else:
                formatted_date = 'programada'
            
            # Booking URL
            booking_url = "https://www.rosstaxpreparation.com/cita"
            
            # Build gentle no-show message
            no_show_message = f"""Hola {user_name.split()[0]} 👋

Notamos que no pudiste asistir a tu cita del {formatted_date}. Esperamos que todo esté bien contigo y los tuyos. 🙏

Entendemos que a veces surgen imprevistos. Si deseas reagendar tu cita, estaremos encantados de atenderte.

📅 Agenda una nueva cita aquí: {booking_url}

Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.

¡Te esperamos pronto!
- El equipo de Ross Tax Preparation 💼"""

            # Send via WhatsApp
            try:
                if user_phone and whatsapp_service:
                    phone = user_phone.replace('+', '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                    if not phone.startswith('1') and len(phone) == 10:
                        phone = '1' + phone
                    await whatsapp_service.send_message(phone, no_show_message)
                    logging.info(f"✅ WhatsApp no-show message sent to {phone}")
            except Exception as e:
                logging.warning(f"Could not send WhatsApp no-show message: {e}")
            
            # Send via SMS
            try:
                if user_phone and _notification_service and _notification_service.twilio_client:
                    sms_message = f"Hola {user_name.split()[0]}, lamentamos que no pudieras asistir a tu cita. Esperamos que estés bien. Reagenda aquí: {booking_url} - Ross Tax"
                    phone = user_phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                    if not phone.startswith('+'):
                        phone = '+1' + phone
                    await _notification_service.send_sms(phone, sms_message)
                    logging.info(f"✅ SMS no-show message sent to {phone}")
            except Exception as e:
                logging.warning(f"Could not send SMS no-show message: {e}")
            
            # Send via Email
            try:
                if user_email and _notification_service:
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0;">Ross Tax Preparation</h1>
                        </div>
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h2 style="color: #333;">Hola {user_name} 👋</h2>
                            <p style="color: #555; font-size: 16px;">
                                Notamos que no pudiste asistir a tu cita del <strong>{formatted_date}</strong>.
                            </p>
                            <p style="color: #555; font-size: 16px;">
                                Esperamos que todo esté bien contigo y los tuyos. Entendemos que a veces surgen imprevistos.
                            </p>
                            <p style="color: #555; font-size: 16px;">
                                Si deseas reagendar tu cita, estaremos encantados de atenderte:
                            </p>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="{booking_url}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                    📅 Agendar Nueva Cita
                                </a>
                            </p>
                            <p style="color: #555; font-size: 16px;">
                                Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
                            </p>
                            <p style="color: #555; font-size: 16px;">¡Te esperamos pronto!</p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="color: #666; font-size: 12px;">
                                📍 305 Bruce Ave, Dumas, TX 79029<br>
                                📞 (806) 934-2018 | (786) 505-5070<br>
                                📧 info@rosstaxpreparation.com
                            </p>
                            <p><strong>- El equipo de Ross Tax Preparation 💼</strong></p>
                        </div>
                    </div>
                    """
                    await _notification_service.send_email(user_email, '📅 Te extrañamos en tu cita - Ross Tax', email_html)
                    logging.info(f"✅ Email no-show message sent to {user_email}")
            except Exception as e:
                logging.warning(f"Could not send email no-show message: {e}")
            
            return {
                'success': True,
                'message': 'Cita marcada como no asistida. Se envió mensaje de seguimiento al cliente.',
                'notifications_sent': True
            }
        
        return {
            'success': True,
            'message': 'Appointment marked as ' + ('completed' if attended else 'no-show')
        }
        
    except Exception as e:
        logging.error(f"Error completing appointment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# APPOINTMENT CHARGE ENDPOINT
# ============================================

class AppointmentChargeRequest(BaseModel):
    amount: float
    payment_method_id: Optional[str] = None  # If not provided, uses the one saved on appointment
    description: Optional[str] = None

@faq_inline_router.post('/admin/appointments/{appointment_id}/charge')
async def charge_appointment(
    appointment_id: str,
    charge_request: AppointmentChargeRequest,
    current_user: dict = Depends(_require_admin)
):
    """
    Cobra al método de pago guardado de una cita.
    Se usa cuando el admin marca asistencia y quiere cobrar al cliente.
    Genera factura y envía recibo.
    """
    try:
        logging.info(f"💳 Charging appointment {appointment_id}: ${charge_request.amount:.2f}")
        
        # Find appointment
        appointment = None
        query_id = None
        
        if len(appointment_id) == 24:
            try:
                query_id = ObjectId(appointment_id)
                appointment = await _db.appointments.find_one({'_id': query_id})
            except:
                pass
        
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
            if appointment:
                query_id = appointment_id
        
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
            if appointment:
                query_id = appointment.get('_id')
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        # Check if already charged
        if appointment.get('payment_status') == 'paid':
            raise HTTPException(status_code=400, detail='Esta cita ya fue cobrada')
        
        # Determine payment method
        pm_id = charge_request.payment_method_id or appointment.get('payment_method_id')
        if not pm_id:
            raise HTTPException(status_code=400, detail='No hay método de pago asociado a esta cita')
        
        if charge_request.amount <= 0:
            raise HTTPException(status_code=400, detail='El monto debe ser mayor a 0')
        
        # Get client info
        user_id = appointment.get('user_id')
        client_name = appointment.get('user_name', 'Cliente')
        client_email = appointment.get('user_email', '')
        client_phone = appointment.get('user_phone', '')
        
        # Try to get full user info
        user = None
        if user_id:
            user = await _db.users.find_one({'_id': user_id})
            if not user:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            if not user:
                user = await _db.users.find_one({'id': user_id})
        
        if user:
            client_name = user.get('full_name') or user.get('name', client_name)
            client_email = user.get('email', client_email)
            client_phone = user.get('phone', client_phone)
        
        # Charge the card
        from dynamic_services import charge_saved_card
        service_name = appointment.get('service_name') or appointment.get('title', 'Consulta')
        description = charge_request.description or f"Servicio: {service_name}"
        
        payment_result = await charge_saved_card(
            _db,
            card_id=pm_id,
            amount=charge_request.amount,
            order_id=str(query_id or appointment_id),
            description=description
        )
        
        if not payment_result.get('success'):
            error_msg = payment_result.get('error', 'Error procesando el cobro')
            logging.error(f"❌ Charge failed for appointment {appointment_id}: {error_msg}")
            raise HTTPException(status_code=400, detail=str(error_msg))
        
        now = datetime.now(timezone.utc)
        transaction_id = payment_result.get('payment_id', 'N/A')
        card_last4 = payment_result.get('card_last_4', '****')
        
        # Update appointment with payment info
        payment_update = {
            'payment_status': 'paid',
            'paid_at': now,
            'payment_id': transaction_id,
            'payment_amount': charge_request.amount,
            'charged_by': current_user.get('name', 'Admin'),
            'updated_at': now
        }
        
        if query_id:
            await _db.appointments.update_one(
                {'_id': query_id},
                {'$set': payment_update}
            )
        
        # Create invoice
        invoice_id = str(uuid.uuid4())
        invoice_number = f"INV-{now.strftime('%Y%m')}-{invoice_id[:8].upper()}"
        
        invoice = {
            'id': invoice_id,
            'invoice_number': invoice_number,
            'appointment_id': appointment_id,
            'user_id': user_id or '',
            'client_id': user_id or '',
            'client_name': client_name,
            'client_email': client_email,
            'client_phone': client_phone,
            'service_type': service_name,
            'description': description,
            'items': [{
                'description': service_name,
                'quantity': 1,
                'unit_price': charge_request.amount,
                'total': charge_request.amount
            }],
            'subtotal': charge_request.amount,
            'tax': 0,
            'total': charge_request.amount,
            'amount': charge_request.amount,
            'status': 'paid',
            'payment_method': 'credit_card',
            'payment_id': transaction_id,
            'payment_processor': 'merchant_one_nmi',
            'card_last4': card_last4,
            'paid_at': now,
            'due_date': now,
            'created_by': current_user.get('name', 'Admin'),
            'visible_to_client': True,
            'created_at': now,
            'updated_at': now,
        }
        
        await _db.invoices.insert_one(invoice)
        logging.info(f"📄 Invoice {invoice_number} created for appointment {appointment_id}: ${charge_request.amount:.2f}")
        
        # Link invoice to appointment
        if query_id:
            await _db.appointments.update_one(
                {'_id': query_id},
                {'$set': {'invoice_id': invoice_id, 'invoice_number': invoice_number}}
            )
        
        # ===== SEND RECEIPT NOTIFICATIONS =====
        try:
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            
            # 1. Push notification to client
            if user and user.get('expo_push_token'):
                try:
                    from push_notification_service import send_push_notification
                    await send_push_notification(
                        expo_push_token=user['expo_push_token'],
                        title=f'✅ Recibo de Pago: ${charge_request.amount:.2f}',
                        body=f'Tu pago de ${charge_request.amount:.2f} por {service_name} fue procesado exitosamente.',
                        data={'type': 'payment_receipt', 'invoice_id': invoice_id, 'screen': 'invoices'}
                    )
                    logging.info(f"🔔 Payment receipt push sent to client")
                except Exception as push_err:
                    logging.warning(f"Could not send push receipt: {push_err}")
            
            # 2. SMS receipt to client
            if client_phone and config_doc:
                try:
                    from notification_service import NotificationService
                    notif_svc = NotificationService(config_doc)
                    if notif_svc.twilio_client:
                        sms_text = (
                            f"✅ Ross Tax - Recibo de Pago\n"
                            f"Monto: ${charge_request.amount:.2f}\n"
                            f"Servicio: {service_name}\n"
                            f"Tarjeta: ****{card_last4}\n"
                            f"Factura: {invoice_number}\n"
                            f"¡Gracias por tu confianza! 🙏\n"
                            f"- Ross Tax (806) 934-2018"
                        )
                        phone = client_phone.replace(' ', '').replace('-', '')
                        if not phone.startswith('+'):
                            phone = '+1' + phone
                        await notif_svc.send_sms(phone, sms_text)
                        logging.info(f"📱 Receipt SMS sent to {phone}")
                except Exception as sms_err:
                    logging.warning(f"Could not send SMS receipt: {sms_err}")
            
            # 3. Email receipt to client
            if client_email and config_doc:
                try:
                    from notification_service import NotificationService
                    notif_svc = NotificationService(config_doc)
                    if notif_svc.sendgrid_client:
                        first_name = client_name.split()[0] if client_name else 'Cliente'
                        receipt_email_html = f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
                            <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                                <h1 style="margin: 0; font-size: 24px;">✅ Recibo de Pago</h1>
                                <p style="margin: 10px 0 0; font-size: 14px; opacity: 0.9;">Ross Tax Preparation</p>
                            </div>
                            <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px;">
                                <p style="color: #333; font-size: 16px;">¡Hola {first_name}! 👋</p>
                                <p style="color: #555; font-size: 15px;">Tu pago ha sido procesado exitosamente.</p>
                                
                                <div style="background-color: #ECFDF5; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #10B981;">
                                    <p style="margin: 0; font-size: 32px; font-weight: bold; color: #065F46; text-align: center;">
                                        ${charge_request.amount:.2f}
                                    </p>
                                </div>
                                
                                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Servicio:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333; font-weight: bold; text-align: right;">{service_name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Tarjeta:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333; text-align: right;">****{card_last4}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Factura:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333; font-family: monospace; text-align: right;">{invoice_number}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Transacción:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #333; font-family: monospace; text-align: right;">{transaction_id}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; color: #666;">Fecha:</td>
                                        <td style="padding: 10px 0; color: #333; text-align: right;">{now.strftime('%d/%m/%Y %I:%M %p')}</td>
                                    </tr>
                                </table>
                                
                                <p style="color: #555; font-size: 14px; margin-top: 20px;">
                                    Puedes ver tu factura completa en la sección de Facturas de tu app.
                                </p>
                                
                                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                                <p style="color: #999; font-size: 12px; text-align: center;">
                                    Ross Tax Preparation<br>
                                    📍 305 Bruce Ave, Dumas, TX 79029<br>
                                    📞 (806) 934-2018
                                </p>
                            </div>
                        </body>
                        </html>
                        """
                        await notif_svc.send_email(
                            client_email,
                            f"✅ Recibo de Pago: ${charge_request.amount:.2f} - Ross Tax",
                            receipt_email_html
                        )
                        logging.info(f"📧 Receipt email sent to {client_email}")
                except Exception as email_err:
                    logging.warning(f"Could not send email receipt: {email_err}")
            
            # 4. Notify admin
            admin_users = await _db.users.find({'role': 'admin'}).to_list(10)
            for admin in admin_users:
                if admin.get('expo_push_token'):
                    try:
                        from push_notification_service import send_push_notification
                        await send_push_notification(
                            expo_push_token=admin['expo_push_token'],
                            title=f'💰 Cobro Exitoso: ${charge_request.amount:.2f}',
                            body=f'{client_name} - {service_name} (****{card_last4})',
                            data={'type': 'payment_charged', 'appointment_id': appointment_id, 'screen': 'appointments'}
                        )
                    except Exception:
                        pass
        except Exception as notif_error:
            logging.warning(f"⚠️ Error sending charge notifications: {notif_error}")
        
        logging.info(f"✅ Appointment {appointment_id} charged: ${charge_request.amount:.2f} (TXN: {transaction_id})")
        
        return {
            'success': True,
            'message': f'Cobro exitoso: ${charge_request.amount:.2f}',
            'payment_id': transaction_id,
            'amount': charge_request.amount,
            'card_last4': card_last4,
            'invoice_number': invoice_number,
            'invoice_id': invoice_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error charging appointment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# GET APPOINTMENT PAYMENT INFO
# ============================================

@faq_inline_router.get('/admin/appointments/{appointment_id}/payment-info')
async def get_appointment_payment_info(
    appointment_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Obtiene la información de pago de una cita"""
    try:
        # Find appointment
        appointment = None
        if len(appointment_id) == 24:
            try:
                appointment = await _db.appointments.find_one({'_id': ObjectId(appointment_id)})
            except:
                pass
        if not appointment:
            appointment = await _db.appointments.find_one({'_id': appointment_id})
        if not appointment:
            appointment = await _db.appointments.find_one({'id': appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Cita no encontrada')
        
        pm_id = appointment.get('payment_method_id')
        payment_info = {
            'has_payment_method': bool(pm_id),
            'payment_method_id': pm_id,
            'payment_status': appointment.get('payment_status', 'pending'),
            'payment_amount': appointment.get('payment_amount'),
            'payment_id': appointment.get('payment_id'),
            'paid_at': str(appointment.get('paid_at')) if appointment.get('paid_at') else None,
            'invoice_number': appointment.get('invoice_number'),
            'payment_method_details': appointment.get('payment_method_details'),
        }
        
        # If there's a payment method, get its current details
        if pm_id:
            pm = None
            if ObjectId.is_valid(pm_id):
                pm = await _db.payment_methods.find_one({'_id': ObjectId(pm_id), 'active': {'$ne': False}})
            if not pm:
                pm = await _db.payment_methods.find_one({'nmi_vault_id': pm_id, 'active': {'$ne': False}})
            
            if pm:
                payment_info['card_details'] = {
                    'card_brand': pm.get('card_brand', ''),
                    'last_4': pm.get('last_4', '****'),
                    'type': pm.get('type', 'card'),
                    'cardholder_name': pm.get('cardholder_name', ''),
                }
            else:
                payment_info['card_details'] = appointment.get('payment_method_details')
        
        # Get service price if available
        service_id = appointment.get('service_id')
        if service_id:
            try:
                service = await _db.dynamic_services.find_one({'id': service_id})
                if service:
                    payment_info['service_price'] = service.get('price', 0)
                    payment_info['service_name'] = service.get('name', '')
            except:
                pass
        
        return payment_info
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting appointment payment info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/admin/feedback-requests')
async def create_manual_feedback_request(data: dict, current_user: dict = Depends(_get_current_user)):
    """Create a manual feedback request for any client (admin only)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        import secrets
        
        user_name = data.get('user_name', 'Cliente')
        user_email = data.get('user_email')
        user_phone = data.get('user_phone')
        service = data.get('service', 'Servicios de Impuestos')
        send_via = data.get('send_via', ['whatsapp', 'sms', 'email'])  # Options to send
        
        if not user_phone and not user_email:
            raise HTTPException(status_code=400, detail='Se requiere al menos un teléfono o email')
        
        # Create feedback token
        feedback_token = secrets.token_urlsafe(32)
        
        # Create feedback request
        feedback_request = {
            'appointment_id': None,  # No appointment - manual request
            'user_id': data.get('user_id', ''),
            'user_name': user_name,
            'user_email': user_email,
            'user_phone': user_phone,
            'service': service,
            'token': feedback_token,
            'status': 'pending',
            'source': 'manual',  # Mark as manual request
            'created_by': str(current_user.get('_id', '')),
            'created_at': datetime.now(timezone.utc),
            'expires_at': datetime.now(timezone.utc) + timedelta(days=30)  # 30 days for manual
        }
        
        await _db.feedback_requests.insert_one(feedback_request)
        logging.info(f"✅ Manual feedback request created for {user_name}")
        
        # Build feedback URL
        feedback_url = f"https://www.rosstaxpreparation.com/feedback/{feedback_token}"
        
        message = f"""¡Hola {user_name}! 👋

Gracias por ser cliente de Ross Tax Preparation.

Nos encantaría conocer tu opinión sobre nuestro servicio. Tu feedback nos ayuda a mejorar.

👉 Deja tu opinión aquí: {feedback_url}

¡Gracias por confiar en nosotros! 🙏

- El equipo de Ross Tax"""

        notifications_sent = []
        
        # Get notification config (with fallback to env vars)
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        
        # Fallback to environment variables if no config in DB
        if not config_doc:
            config_doc = {
                'sendgrid_api_key': os.getenv('SENDGRID_API_KEY'),
                'sendgrid_from_email': os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com'),
                'sendgrid_from_name': 'Ross Tax Preparation',
                'twilio_account_sid': os.getenv('TWILIO_ACCOUNT_SID'),
                'twilio_auth_token': os.getenv('TWILIO_AUTH_TOKEN'),
                'twilio_phone_number': os.getenv('TWILIO_PHONE_NUMBER'),
            }
            logging.info("📧 Using env vars for notification config (no api_config in DB)")
        
        # Send via WhatsApp
        if 'whatsapp' in send_via and user_phone:
            try:
                from whatsapp_service import WhatsAppService
                ws = WhatsAppService(_db)
                if ws.phone_number_id and ws.access_token:
                    phone = user_phone.replace('+', '').replace(' ', '').replace('-', '')
                    await ws.send_message(phone, message)
                    notifications_sent.append('whatsapp')
                    logging.info(f"✅ WhatsApp feedback request sent to {phone}")
            except Exception as e:
                logging.warning(f"Could not send WhatsApp: {e}")
        
        # Send via SMS
        if 'sms' in send_via and user_phone and config_doc:
            try:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                if notif_svc.twilio_client:
                    sms_message = f"¡Gracias por ser cliente de Ross Tax! 🎉 Nos encantaría conocer tu opinión: {feedback_url}"
                    phone = user_phone.replace(' ', '').replace('-', '')
                    if not phone.startswith('+'):
                        phone = '+1' + phone
                    notif_svc.twilio_client.messages.create(
                        body=sms_message,
                        from_=notif_svc.twilio_phone_number,
                        to=phone
                    )
                    notifications_sent.append('sms')
                    logging.info(f"✅ SMS feedback request sent to {phone}")
            except Exception as e:
                logging.warning(f"Could not send SMS: {e}")
        
        # Send via Email
        if 'email' in send_via and user_email and config_doc:
            try:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                if notif_svc.sendgrid_client:
                    email_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0;">Ross Tax Preparation</h1>
                        </div>
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h2 style="color: #6C1110;">¡Tu opinión es importante! ⭐</h2>
                            <p>Hola {user_name},</p>
                            <p>Gracias por ser cliente de Ross Tax Preparation. Nos encantaría conocer tu experiencia con nuestro servicio.</p>
                            <p style="text-align: center; margin: 30px 0;">
                                <a href="{feedback_url}" style="background-color: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                    ⭐ Dejar mi opinión
                                </a>
                            </p>
                            <p>Tu feedback nos ayuda a mejorar y ofrecer un mejor servicio.</p>
                            <p>¡Gracias por confiar en nosotros!</p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="color: #666; font-size: 12px;">
                                📍 305 Bruce Ave, Dumas, TX 79029<br>
                                📞 (806) 934-2018<br>
                                📧 yoandyross@gmail.com
                            </p>
                            <p><strong>- El equipo de Ross Tax Preparation</strong></p>
                        </div>
                    </div>
                    """
                    await notif_svc.send_email(user_email, '⭐ ¿Cómo fue tu experiencia en Ross Tax?', email_html)
                    notifications_sent.append('email')
                    logging.info(f"✅ Email feedback request sent to {user_email}")
            except Exception as e:
                logging.warning(f"Could not send email: {e}")
        
        return {
            'success': True,
            'message': f'Solicitud de feedback enviada',
            'token': feedback_token,
            'feedback_url': feedback_url,
            'notifications_sent': notifications_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating manual feedback request: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class BulkFeedbackRequest(BaseModel):
    client_ids: List[str]
    send_via: List[str] = ['email', 'sms']
    service: str = 'Servicios de Impuestos'


@faq_inline_router.post('/admin/feedback-requests/bulk')
async def send_bulk_feedback_requests(
    data: BulkFeedbackRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Send feedback requests to multiple clients at once"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        logging.info(f"📢 Bulk feedback request for {len(data.client_ids)} clients")
        
        # Get clients
        from bson import ObjectId
        clients = []
        
        # Try string IDs first
        string_clients = await _db.users.find({'_id': {'$in': data.client_ids}}).to_list(1000)
        clients.extend(string_clients)
        
        # Try ObjectIds if needed
        if not clients:
            object_ids = []
            for cid in data.client_ids:
                try:
                    object_ids.append(ObjectId(cid))
                except:
                    pass
            if object_ids:
                obj_clients = await _db.users.find({'_id': {'$in': object_ids}}).to_list(1000)
                clients.extend(obj_clients)
        
        logging.info(f"📊 Found {len(clients)} clients")
        
        results = {
            'success': 0,
            'failed': 0,
            'details': []
        }
        
        # Get notification config (with fallback to env vars)
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        
        # Fallback to environment variables if no config in DB
        if not config_doc:
            config_doc = {
                'sendgrid_api_key': os.getenv('SENDGRID_API_KEY'),
                'sendgrid_from_email': os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com'),
                'sendgrid_from_name': 'Ross Tax Preparation',
                'twilio_account_sid': os.getenv('TWILIO_ACCOUNT_SID'),
                'twilio_auth_token': os.getenv('TWILIO_AUTH_TOKEN'),
                'twilio_phone_number': os.getenv('TWILIO_PHONE_NUMBER'),
            }
            logging.info("📧 Bulk feedback: Using env vars for notification config")
        
        notif_svc = None
        if config_doc:
            from notification_service import NotificationService
            notif_svc = NotificationService(config_doc)
        
        # Process each client
        for client in clients:
            client_name = client.get('full_name') or client.get('name') or 'Cliente'
            client_email = client.get('email')
            client_phone = str(client.get('phone') or '')
            client_id = str(client.get('_id'))
            
            try:
                # Create feedback request token
                token = str(uuid.uuid4())
                feedback_request = {
                    'token': token,
                    'user_id': client_id,
                    'user_name': client_name,
                    'user_email': client_email,
                    'user_phone': client_phone,
                    'service': data.service,
                    'status': 'pending',
                    'sent_via': data.send_via,
                    'sent_at': datetime.now(timezone.utc),
                    'expires_at': datetime.now(timezone.utc) + timedelta(days=7),
                    'created_by': current_user.get('id') or str(current_user.get('_id')),
                    'source': 'bulk_request'
                }
                
                await _db.feedback_requests.insert_one(feedback_request)
                
                # Build feedback URL
                feedback_url = f"https://www.rosstaxpreparation.com/feedback/{token}"
                
                sent_any = False
                
                # Send Email
                if 'email' in data.send_via and client_email and notif_svc and notif_svc.sendgrid_client:
                    try:
                        email_html = f"""
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="color: white; margin: 0;">⭐ ¿Cómo fue tu experiencia?</h1>
                            </div>
                            <div style="padding: 30px; background: #f9f9f9;">
                                <p style="font-size: 18px;">Hola <strong>{client_name}</strong>,</p>
                                <p>Nos encantaría conocer tu opinión sobre nuestros servicios.</p>
                                <p style="text-align: center; margin: 30px 0;">
                                    <a href="{feedback_url}" style="background-color: #6C1110; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                                        ⭐ Dejar mi Opinión
                                    </a>
                                </p>
                                <p style="color: #666; text-align: center; font-size: 14px;">
                                    Tu opinión nos ayuda a mejorar
                                </p>
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                                <p style="text-align: center; color: #888; font-size: 13px;">
                                    Ross Tax Preparation<br>
                                    📍 305 Bruce Ave, Dumas, TX 79029<br>
                                    📞 (806) 934-2018
                                </p>
                            </div>
                        </div>
                        """
                        await notif_svc.send_email(client_email, '⭐ ¿Cómo fue tu experiencia? - Ross Tax', email_html)
                        sent_any = True
                    except Exception as e:
                        logging.warning(f"Email error for {client_email}: {e}")
                
                # Send SMS
                if 'sms' in data.send_via and client_phone and notif_svc and notif_svc.twilio_client:
                    try:
                        phone = client_phone.replace(' ', '').replace('-', '')
                        if not phone.startswith('+'):
                            phone = '+1' + phone
                        
                        sms_msg = f"⭐ Hola {client_name}! Nos encantaría conocer tu opinión sobre Ross Tax. Deja tu reseña aquí: {feedback_url}"
                        
                        notif_svc.twilio_client.messages.create(
                            body=sms_msg,
                            from_=notif_svc.twilio_phone_number,
                            to=phone
                        )
                        sent_any = True
                    except Exception as e:
                        logging.warning(f"SMS error for {client_phone}: {e}")
                
                if sent_any:
                    results['success'] += 1
                else:
                    results['failed'] += 1
                    
            except Exception as e:
                logging.error(f"Error processing client {client_id}: {e}")
                results['failed'] += 1
        
        logging.info(f"✅ Bulk feedback: {results['success']} sent, {results['failed']} failed")
        
        return {
            'success': True,
            'results': results
        }
        
    except Exception as e:
        logging.error(f"Error in bulk feedback request: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@faq_inline_router.get('/admin/feedback-requests')
async def get_feedback_requests(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(_get_current_user)
):
    """Get all feedback requests (admin only)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        query = {}
        if status:
            query['status'] = status
        
        skip = (page - 1) * limit
        total = await _db.feedback_requests.count_documents(query)
        
        requests = await _db.feedback_requests.find(query).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
        
        result = []
        for r in requests:
            result.append({
                'id': str(r['_id']),
                'user_name': r.get('user_name', 'Cliente'),
                'user_email': r.get('user_email'),
                'user_phone': r.get('user_phone'),
                'service': r.get('service'),
                'status': r.get('status', 'pending'),
                'source': r.get('source', 'appointment'),
                'token': r.get('token'),
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
                'expires_at': r.get('expires_at').isoformat() if r.get('expires_at') else None,
            })
        
        return {
            'success': True,
            'requests': result,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'total_pages': (total + limit - 1) // limit
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting feedback requests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/feedback/{token}')
async def get_feedback_form(token: str):
    """Get feedback form data (public endpoint)"""
    try:
        request = await _db.feedback_requests.find_one({'token': token})
        
        if not request:
            raise HTTPException(status_code=404, detail='Feedback request not found')
        
        if request.get('status') == 'submitted':
            return {'success': False, 'error': 'Feedback already submitted', 'already_submitted': True}
        
        # Check expiration with timezone-aware comparison
        expires_at = request.get('expires_at')
        if expires_at:
            # Ensure expires_at has timezone info
            if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                return {'success': False, 'error': 'Feedback request expired', 'expired': True}
        
        return {
            'success': True,
            'user_name': request.get('user_name'),
            'service': request.get('service'),
            'created_at': request.get('created_at').isoformat() if request.get('created_at') else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting feedback form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.post('/feedback/{token}')
async def submit_feedback(token: str, data: dict = Body(...)):
    """Submit customer feedback (public endpoint)"""
    try:
        request = await _db.feedback_requests.find_one({'token': token})
        
        if not request:
            raise HTTPException(status_code=404, detail='Feedback request not found')
        
        if request.get('status') == 'submitted':
            raise HTTPException(status_code=400, detail='Feedback already submitted')
        
        # Create feedback entry
        feedback = {
            'request_id': str(request['_id']),
            'appointment_id': request.get('appointment_id'),
            'user_id': request.get('user_id'),
            'user_name': request.get('user_name'),
            'user_email': request.get('user_email'),
            'service': request.get('service'),
            'rating': data.get('rating', 5),
            'comment': data.get('comment', ''),
            'would_recommend': data.get('would_recommend', True),
            'status': 'pending',  # pending, approved, rejected
            'created_at': datetime.now(timezone.utc),
            'published': False
        }
        
        result = await _db.feedbacks.insert_one(feedback)
        
        # Update request status
        await _db.feedback_requests.update_one(
            {'_id': request['_id']},
            {'$set': {'status': 'submitted', 'submitted_at': datetime.now(timezone.utc)}}
        )
        
        return {
            'success': True,
            'message': '¡Gracias por tu opinión!'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error submitting feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/admin/feedbacks')
async def get_admin_feedbacks(
    status: Optional[str] = None,
    current_user: dict = Depends(_require_admin)
):
    """Get all feedbacks for admin"""
    try:
        query = {}
        if status:
            query['status'] = status
        
        feedbacks = await _db.feedbacks.find(query).sort('created_at', -1).to_list(500)
        
        # Convert ObjectIds
        for f in feedbacks:
            f['id'] = str(f.pop('_id'))
        
        # Get stats
        all_feedbacks = await _db.feedbacks.find().to_list(1000)
        stats = {
            'total': len(all_feedbacks),
            'pending': sum(1 for f in all_feedbacks if f.get('status') == 'pending'),
            'approved': sum(1 for f in all_feedbacks if f.get('status') == 'approved'),
            'rejected': sum(1 for f in all_feedbacks if f.get('status') == 'rejected'),
            'average_rating': sum(f.get('rating', 0) for f in all_feedbacks) / len(all_feedbacks) if all_feedbacks else 0
        }
        
        return {
            'success': True,
            'feedbacks': feedbacks,
            'stats': stats
        }
        
    except Exception as e:
        logging.error(f"Error getting feedbacks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.put('/admin/feedbacks/{feedback_id}')
async def update_feedback_status(
    feedback_id: str,
    data: dict = Body(...),
    current_user: dict = Depends(_require_admin)
):
    """Update feedback status (approve/reject)"""
    try:
        status = data.get('status')
        if status not in ['pending', 'approved', 'rejected']:
            raise HTTPException(status_code=400, detail='Invalid status')
        
        update_data = {
            'status': status,
            'reviewed_by': current_user.get('email'),
            'reviewed_at': datetime.now(timezone.utc),
            'published': status == 'approved'
        }
        
        result = await _db.feedbacks.update_one(
            {'_id': ObjectId(feedback_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Feedback not found')
        
        return {'success': True, 'message': f'Feedback {status}'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.delete('/admin/feedbacks/{feedback_id}')
async def delete_feedback(
    feedback_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Delete a feedback"""
    try:
        result = await _db.feedbacks.delete_one({'_id': ObjectId(feedback_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Feedback not found')
        
        return {'success': True, 'message': 'Feedback deleted'}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@faq_inline_router.get('/public/testimonials')
async def get_public_testimonials():
    """Get approved testimonials for public display"""
    try:
        feedbacks = await _db.feedbacks.find({
            'status': 'approved',
            'published': True
        }).sort('created_at', -1).limit(20).to_list(20)
        
        testimonials = []
        for f in feedbacks:
            # Only show first name for privacy
            name_parts = (f.get('user_name') or 'Cliente').split()
            display_name = name_parts[0] if name_parts else 'Cliente'
            if len(name_parts) > 1:
                display_name += f" {name_parts[1][0]}."
            
            testimonials.append({
                'id': str(f['_id']),
                'name': display_name,
                'rating': f.get('rating', 5),
                'comment': f.get('comment', ''),
                'service': f.get('service', 'Servicios de impuestos'),
                'date': f.get('created_at').isoformat() if f.get('created_at') else None
            })
        
        return {
            'success': True,
            'testimonials': testimonials
        }
        
    except Exception as e:
        logging.error(f"Error getting testimonials: {e}")
        return {'success': True, 'testimonials': []}


