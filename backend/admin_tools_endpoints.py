"""
Admin Tools Endpoints
Recordatorios, Búsqueda Global y Reportes PDF
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
from io import BytesIO
import jwt
import os
from bson import ObjectId

router = APIRouter()

# Database reference
db = None

def set_db(database):
    global db
    db = database


# JWT Secret
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "ross-tax-secret-key-2025-change-in-production")


async def get_current_admin(authorization: str = Header(None)):
    """Authenticate and verify admin user from token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Token no proporcionado')
    
    token = authorization.replace('Bearer ', '')
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('sub')
        
        if not user_id or db is None:
            raise HTTPException(status_code=401, detail='Token inválido')
        
        # Try with ObjectId first, then string
        try:
            user = await db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await db.users.find_one({'_id': user_id})
        
        if not user:
            raise HTTPException(status_code=401, detail='Usuario no encontrado')
        
        if user.get('role') not in ['admin', 'office_assistant']:
            raise HTTPException(status_code=403, detail='Acceso de admin requerido')
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expirado')
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f'Token inválido: {str(e)}')


# ============================================
# SISTEMA DE RECORDATORIOS AUTOMÁTICOS
# ============================================

@router.get('/reminders/pending')
async def get_pending_reminders(current_user: dict = Depends(get_current_admin)):
    """Get all pending reminders that need attention"""
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
        upcoming_appointments = await db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed']},
            'scheduled_at': {'$gte': now, '$lte': tomorrow}
        }).to_list(100)
        
        for appt in upcoming_appointments:
            client = await db.users.find_one({'_id': appt.get('user_id')})
            reminders['appointments_24h'].append({
                'id': appt['_id'],
                'client_name': client.get('name', 'Sin nombre') if client else 'Desconocido',
                'client_email': client.get('email', '') if client else '',
                'client_phone': client.get('phone', '') if client else '',
                'scheduled_at': appt['scheduled_at'].isoformat() if appt.get('scheduled_at') else None,
                'service': appt.get('service_type', 'Cita general'),
                'status': appt.get('status'),
                'notes': appt.get('notes', '')
            })
        
        # 2. FACTURAS VENCIDAS O POR VENCER
        overdue_invoices = await db.invoices.find({
            'status': 'pending',
            'due_date': {'$lte': now + timedelta(days=7)}
        }).to_list(100)
        
        for inv in overdue_invoices:
            client = await db.users.find_one({'_id': inv.get('user_id')})
            is_overdue = inv.get('due_date', now) < now if inv.get('due_date') else False
            reminders['overdue_invoices'].append({
                'id': inv['_id'],
                'invoice_number': inv.get('invoice_number', inv['_id'][:8]),
                'client_name': client.get('name', 'Sin nombre') if client else 'Desconocido',
                'client_email': client.get('email', '') if client else '',
                'total': inv.get('total', 0),
                'due_date': inv.get('due_date').isoformat() if inv.get('due_date') else None,
                'is_overdue': is_overdue,
                'days_overdue': (now - inv.get('due_date')).days if is_overdue and inv.get('due_date') else 0
            })
        
        # 3. PROYECTOS CON DOCUMENTOS FALTANTES
        active_projects = await db.service_orders.find({
            'status': {'$in': ['pending', 'in_progress']}
        }).to_list(100)
        
        for project in active_projects:
            recent_docs = await db.documents.count_documents({
                'user_id': project.get('client_id'),
                'uploaded_at': {'$gte': now - timedelta(days=30)}
            })
            
            if recent_docs == 0:
                reminders['missing_documents'].append({
                    'client_id': project.get('client_id'),
                    'client_name': project.get('client_name', 'Sin nombre'),
                    'project_number': project.get('order_number', ''),
                    'project_status': project.get('status'),
                    'service_type': project.get('service_type', '')
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


@router.post('/reminders/send-appointment')
async def send_appointment_reminders_endpoint(
    hours_before: int = 24,
    current_user: dict = Depends(get_current_admin)
):
    """Send reminders for upcoming appointments"""
    try:
        from server import create_notification
        
        now = datetime.now(timezone.utc)
        reminder_window = now + timedelta(hours=hours_before)
        
        appointments = await db.appointments.find({
            'status': {'$in': ['scheduled', 'confirmed']},
            'scheduled_at': {'$gte': now, '$lte': reminder_window},
            'reminder_sent': {'$ne': True}
        }).to_list(100)
        
        sent_count = 0
        errors = []
        
        for appt in appointments:
            try:
                client = await db.users.find_one({'_id': appt.get('user_id')})
                if not client:
                    continue
                
                scheduled_time = appt['scheduled_at'].strftime('%d/%m/%Y a las %I:%M %p')
                
                await create_notification(
                    user_id=client['_id'],
                    title='📅 Recordatorio de Cita',
                    body=f'Tu cita está programada para {scheduled_time}. ¡Te esperamos!',
                    type='appointment_reminder',
                    data={'appointment_id': appt['_id']}
                )
                
                await db.appointments.update_one(
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


@router.post('/reminders/send-invoice')
async def send_invoice_reminders_endpoint(
    current_user: dict = Depends(get_current_admin)
):
    """Send reminders for pending/overdue invoices"""
    try:
        from server import create_notification
        
        now = datetime.now(timezone.utc)
        
        invoices = await db.invoices.find({
            'status': 'pending',
            'due_date': {'$lte': now + timedelta(days=3)},
            'payment_reminder_sent': {'$ne': True}
        }).to_list(100)
        
        sent_count = 0
        errors = []
        
        for inv in invoices:
            try:
                client = await db.users.find_one({'_id': inv.get('user_id')})
                if not client:
                    continue
                
                is_overdue = inv.get('due_date', now) < now if inv.get('due_date') else False
                
                if is_overdue:
                    title = '⚠️ Factura Vencida'
                    body = f'Tu factura #{inv.get("invoice_number", inv["_id"][:8])} por ${inv.get("total", 0):.2f} está vencida.'
                else:
                    title = '📋 Recordatorio de Pago'
                    body = f'Tu factura #{inv.get("invoice_number", inv["_id"][:8])} por ${inv.get("total", 0):.2f} vence pronto.'
                
                await create_notification(
                    user_id=client['_id'],
                    title=title,
                    body=body,
                    type='invoice_reminder',
                    data={'invoice_id': inv['_id']}
                )
                
                await db.invoices.update_one(
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


# ============================================
# BÚSQUEDA GLOBAL
# ============================================

@router.get('/search')
async def global_search(
    q: str = Query(..., min_length=2),
    types: str = Query('all'),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_admin)
):
    """Global search across clients, invoices, projects, and appointments"""
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
            clients = await db.users.find({
                'role': 'client',
                '$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'email': {'$regex': query, '$options': 'i'}},
                    {'phone': {'$regex': query, '$options': 'i'}}
                ]
            }).limit(limit).to_list(limit)
            
            results['clients'] = [{
                'id': str(c['_id']),
                'type': 'client',
                'name': c.get('name', 'Sin nombre'),
                'email': c.get('email', ''),
                'phone': c.get('phone', '')
            } for c in clients]
        
        # BUSCAR FACTURAS
        if 'invoices' in search_types:
            invoices = await db.invoices.find({
                '$or': [
                    {'invoice_number': {'$regex': query, '$options': 'i'}},
                    {'service_name': {'$regex': query, '$options': 'i'}}
                ]
            }).limit(limit).to_list(limit)
            
            for inv in invoices:
                client = await db.users.find_one({'_id': inv.get('user_id')})
                results['invoices'].append({
                    'id': str(inv['_id']),
                    'type': 'invoice',
                    'invoice_number': inv.get('invoice_number', str(inv['_id'])[:8]),
                    'client_name': client.get('name', 'N/A') if client else 'N/A',
                    'total': inv.get('total', 0),
                    'status': inv.get('status')
                })
        
        # BUSCAR PROYECTOS
        if 'projects' in search_types:
            projects = await db.service_orders.find({
                '$or': [
                    {'order_number': {'$regex': query, '$options': 'i'}},
                    {'description': {'$regex': query, '$options': 'i'}},
                    {'client_name': {'$regex': query, '$options': 'i'}}
                ]
            }).limit(limit).to_list(limit)
            
            results['projects'] = [{
                'id': str(p['_id']),
                'type': 'project',
                'order_number': p.get('order_number', ''),
                'client_name': p.get('client_name', 'N/A'),
                'service_type': p.get('service_type', ''),
                'status': p.get('status')
            } for p in projects]
        
        # BUSCAR CITAS
        if 'appointments' in search_types:
            matching_clients = await db.users.find({
                'role': 'client',
                '$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'email': {'$regex': query, '$options': 'i'}}
                ]
            }).to_list(50)
            
            client_ids = [c['_id'] for c in matching_clients]
            
            if client_ids:
                appointments = await db.appointments.find({
                    'user_id': {'$in': client_ids}
                }).sort('scheduled_at', -1).limit(limit).to_list(limit)
                
                for appt in appointments:
                    client = next((c for c in matching_clients if c['_id'] == appt.get('user_id')), None)
                    results['appointments'].append({
                        'id': str(appt['_id']),
                        'type': 'appointment',
                        'client_name': client.get('name', 'N/A') if client else 'N/A',
                        'scheduled_at': appt.get('scheduled_at').isoformat() if appt.get('scheduled_at') else None,
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

@router.get('/reports/invoice-pdf/{invoice_id}')
async def generate_invoice_pdf(
    invoice_id: str,
    current_user: dict = Depends(get_current_admin)
):
    """Generate PDF for a specific invoice"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
        from fastapi.responses import StreamingResponse
        
        invoice = await db.invoices.find_one({'_id': invoice_id})
        if not invoice:
            raise HTTPException(status_code=404, detail='Factura no encontrada')
        
        client = await db.users.find_one({'_id': invoice.get('user_id')})
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#6C1110'))
        normal_style = styles['Normal']
        
        elements.append(Paragraph("ROSS TAX PREPARATION", title_style))
        elements.append(Paragraph("Servicios Profesionales de Impuestos", normal_style))
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>FACTURA #{invoice.get('invoice_number', invoice_id[:8])}</b>", styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        elements.append(Paragraph(f"<b>Cliente:</b> {client.get('name', 'N/A') if client else 'N/A'}", normal_style))
        elements.append(Paragraph(f"<b>Email:</b> {client.get('email', 'N/A') if client else 'N/A'}", normal_style))
        elements.append(Spacer(1, 15))
        
        created_at = invoice.get('created_at')
        elements.append(Paragraph(f"<b>Fecha:</b> {created_at.strftime('%d/%m/%Y') if created_at else 'N/A'}", normal_style))
        elements.append(Paragraph(f"<b>Estado:</b> {invoice.get('status', 'pending').upper()}", normal_style))
        elements.append(Spacer(1, 20))
        
        items_data = [['Descripción', 'Cant.', 'Precio', 'Total']]
        for item in invoice.get('items', []):
            items_data.append([
                item.get('description', 'Servicio')[:40],
                str(item.get('quantity', 1)),
                f"${item.get('unit_price', 0):.2f}",
                f"${item.get('quantity', 1) * item.get('unit_price', 0):.2f}"
            ])
        
        table = Table(items_data, colWidths=[3.5*inch, 0.8*inch, 1.1*inch, 1.1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cccccc')),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>TOTAL: ${invoice.get('total', 0):.2f}</b>", styles['Heading2']))
        elements.append(Spacer(1, 40))
        elements.append(Paragraph("Gracias por confiar en Ross Tax Preparation", ParagraphStyle('Footer', parent=normal_style, alignment=1)))
        
        doc.build(elements)
        buffer.seek(0)
        
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


@router.get('/reports/clients-pdf')
async def generate_clients_report_pdf(current_user: dict = Depends(get_current_admin)):
    """Generate PDF report of all clients"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
        from fastapi.responses import StreamingResponse
        
        clients = await db.users.find({'role': 'client'}).sort('name', 1).to_list(500)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        elements.append(Paragraph("REPORTE DE CLIENTES", ParagraphStyle('Title', parent=styles['Heading1'], textColor=colors.HexColor('#6C1110'))))
        elements.append(Paragraph(f"Ross Tax Preparation - {datetime.now().strftime('%d/%m/%Y')}", styles['Normal']))
        elements.append(Paragraph(f"Total: {len(clients)} clientes", styles['Normal']))
        elements.append(Spacer(1, 15))
        
        data = [['#', 'Nombre', 'Email', 'Teléfono']]
        for i, c in enumerate(clients[:100], 1):
            data.append([str(i), c.get('name', 'N/A')[:25], c.get('email', 'N/A')[:30], c.get('phone', 'N/A')])
        
        table = Table(data, colWidths=[0.4*inch, 2*inch, 2.5*inch, 1.5*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ]))
        elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        
        return StreamingResponse(buffer, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="clientes_{datetime.now().strftime("%Y%m%d")}.pdf"'})
        
    except Exception as e:
        logging.error(f'Error generating clients PDF: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/reports/revenue-pdf')
async def generate_revenue_report_pdf(
    period: str = Query('month'),
    current_user: dict = Depends(get_current_admin)
):
    """Generate PDF report of revenue"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
        from fastapi.responses import StreamingResponse
        
        now = datetime.now(timezone.utc)
        
        periods = {'week': 7, 'month': 30, 'quarter': 90, 'year': 365}
        days = periods.get(period, 30)
        start_date = now - timedelta(days=days)
        period_names = {'week': 'Última Semana', 'month': 'Último Mes', 'quarter': 'Último Trimestre', 'year': 'Último Año'}
        
        paid_invoices = await db.invoices.find({
            'status': 'paid',
            'paid_at': {'$gte': start_date}
        }).sort('paid_at', -1).to_list(200)
        
        total_revenue = sum(inv.get('total', 0) for inv in paid_invoices)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch)
        elements = []
        styles = getSampleStyleSheet()
        
        elements.append(Paragraph("REPORTE DE INGRESOS", ParagraphStyle('Title', parent=styles['Heading1'], textColor=colors.HexColor('#6C1110'))))
        elements.append(Paragraph(f"{period_names.get(period, 'Mes')} - {now.strftime('%d/%m/%Y')}", styles['Normal']))
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>Total Ingresos: ${total_revenue:,.2f}</b>", styles['Heading2']))
        elements.append(Paragraph(f"Facturas Pagadas: {len(paid_invoices)}", styles['Normal']))
        elements.append(Spacer(1, 20))
        
        if paid_invoices:
            data = [['Fecha', 'Factura', 'Cliente', 'Monto']]
            for inv in paid_invoices[:50]:
                client = await db.users.find_one({'_id': inv.get('user_id')})
                data.append([
                    inv.get('paid_at').strftime('%d/%m/%y') if inv.get('paid_at') else 'N/A',
                    inv.get('invoice_number', inv['_id'][:8]),
                    (client.get('name', 'N/A') if client else 'N/A')[:20],
                    f"${inv.get('total', 0):.2f}"
                ])
            
            table = Table(data, colWidths=[1*inch, 1.5*inch, 2.5*inch, 1.5*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C1110')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ]))
            elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        
        return StreamingResponse(buffer, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename="ingresos_{period}_{now.strftime("%Y%m%d")}.pdf"'})
        
    except Exception as e:
        logging.error(f'Error generating revenue PDF: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))
