"""
Invoice Service - Servicio completo de gestión de facturas
"""
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timedelta
import logging
from bson import ObjectId

from invoice_models import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    InvoiceStatus, InvoicePaymentRequest
)

logger = logging.getLogger(__name__)

class InvoiceService:
    """Servicio de gestión de facturas"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.invoices_collection = db.invoices
        self.users_collection = db.users
        self.notifications_collection = db.notifications
        logger.info("✅ Invoice Service initialized")
    
    async def generate_invoice_number(self) -> str:
        """Genera número de factura único"""
        # Formato: INV-YYYYMM-0001
        now = datetime.utcnow()
        prefix = f"INV-{now.year}{now.month:02d}"
        
        # Contar facturas del mes actual
        count = await self.invoices_collection.count_documents({
            'invoice_number': {'$regex': f'^{prefix}'}
        })
        
        number = f"{prefix}-{count + 1:04d}"
        return number
    
    async def create_invoice(
        self,
        invoice_data: InvoiceCreate,
        admin_id: str,
        admin_name: str
    ) -> InvoiceResponse:
        """Crea una nueva factura"""
        
        # Verificar que el usuario existe (buscar por _id como ObjectId o string, o por id)
        user = None
        try:
            user = await self.users_collection.find_one({'_id': ObjectId(invoice_data.user_id)})
        except:
            pass
        
        if not user:
            user = await self.users_collection.find_one({'_id': invoice_data.user_id})
        
        if not user:
            user = await self.users_collection.find_one({'id': invoice_data.user_id})
        
        if not user:
            logger.error(f"❌ Usuario no encontrado con ID: {invoice_data.user_id}")
            raise ValueError(f"Usuario no encontrado con ID: {invoice_data.user_id}")
        
        # Generar número de factura
        invoice_number = await self.generate_invoice_number()
        
        # Calcular totales
        subtotal = sum(item.get_total() for item in invoice_data.items)
        tax = subtotal * 0.08  # 8% tax
        total = subtotal + tax
        
        # Crear documento de factura
        invoice_doc = {
            'invoice_number': invoice_number,
            'user_id': invoice_data.user_id,
            'service_name': invoice_data.service_name,
            'items': [{'description': item.description, 'quantity': item.quantity, 'unit_price': item.unit_price, 'total': item.get_total()} for item in invoice_data.items],
            'subtotal': subtotal,
            'tax': tax,
            'total': total,
            'status': InvoiceStatus.PENDING.value,
            'notes': invoice_data.notes,
            'created_at': datetime.utcnow(),
            'due_date': invoice_data.due_date or (datetime.utcnow() + timedelta(days=30)),
            'paid_at': None,
            'payment_method_id': None,
            'created_by_admin_id': admin_id,
            'created_by_admin_name': admin_name
        }

        # Tag with active tax season
        try:
            from season_context import get_season_year
            invoice_doc['tax_year'] = await get_season_year()
        except Exception:
            pass
        
        result = await self.invoices_collection.insert_one(invoice_doc)
        invoice_id = str(result.inserted_id)
        
        # Crear notificación para el usuario
        await self.create_invoice_notification(
            user_id=invoice_data.user_id,
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            service_name=invoice_data.service_name,
            total=total
        )
        
        # Enviar notificación WhatsApp
        try:
            from whatsapp_automation_service import get_whatsapp_automation
            wa_automation = get_whatsapp_automation()
            if wa_automation:
                wa_result = await wa_automation.send_invoice_created(invoice_id)
                if wa_result.get('success'):
                    logger.info(f"✅ WhatsApp notification sent for invoice {invoice_number}")
                else:
                    logger.debug(f"WhatsApp notification skipped: {wa_result.get('error')}")
        except Exception as wa_error:
            logger.error(f"❌ Error sending WhatsApp invoice notification: {str(wa_error)}")
        
        logger.info(f"✅ Factura creada: {invoice_number} para usuario {invoice_data.user_id}")
        
        # Retornar respuesta
        return InvoiceResponse(
            id=invoice_id,
            invoice_number=invoice_number,
            user_id=invoice_data.user_id,
            user_name=user.get('name'),
            user_email=user.get('email'),
            service_name=invoice_data.service_name,
            items=invoice_doc['items'],
            subtotal=subtotal,
            tax=tax,
            total=total,
            status=InvoiceStatus.PENDING,
            notes=invoice_data.notes,
            created_at=invoice_doc['created_at'],
            due_date=invoice_doc['due_date'],
            created_by_admin_id=admin_id,
            created_by_admin_name=admin_name
        )
    
    async def create_invoice_notification(
        self,
        user_id: str,
        invoice_id: str,
        invoice_number: str,
        service_name: str,
        total: float
    ):
        """Crea notificación de nueva factura para el usuario"""
        notification = {
            'user_id': user_id,
            'type': 'invoice_created',
            'title': '💳 Nueva Factura Creada',
            'message': f'Se ha creado una factura para {service_name}. Total: ${total:.2f}',
            'data': {
                'invoice_id': invoice_id,
                'invoice_number': invoice_number,
                'service_name': service_name,
                'total': total,
                'action': 'view_invoice'
            },
            'is_read': False,
            'created_at': datetime.utcnow(),
            'priority': 'high'
        }
        
        await self.notifications_collection.insert_one(notification)
        logger.info(f"📬 Notificación de factura creada para usuario {user_id}")
    
    async def get_user_invoices(
        self,
        user_id: str,
        status: Optional[InvoiceStatus] = None
    ) -> List[InvoiceResponse]:
        """Obtiene facturas de un usuario"""
        
        query = {'user_id': user_id}
        if status:
            query['status'] = status.value
        
        invoices = await self.invoices_collection.find(query).sort('created_at', -1).to_list(100)
        
        result = []
        for invoice in invoices:
            user = await self.users_collection.find_one({'_id': invoice['user_id']})
            result.append(InvoiceResponse(
                id=str(invoice['_id']),
                invoice_number=invoice['invoice_number'],
                user_id=invoice['user_id'],
                user_name=user.get('name') if user else None,
                user_email=user.get('email') if user else None,
                service_name=invoice['service_name'],
                items=invoice['items'],
                subtotal=invoice['subtotal'],
                tax=invoice['tax'],
                total=invoice['total'],
                status=InvoiceStatus(invoice['status']),
                notes=invoice.get('notes'),
                created_at=invoice['created_at'],
                due_date=invoice.get('due_date'),
                paid_at=invoice.get('paid_at'),
                payment_method_id=invoice.get('payment_method_id'),
                created_by_admin_id=invoice.get('created_by_admin_id'),
                created_by_admin_name=invoice.get('created_by_admin_name')
            ))
        
        return result
    
    async def get_all_invoices(
        self,
        status: Optional[InvoiceStatus] = None,
        limit: int = 100
    ) -> List[InvoiceResponse]:
        """Obtiene todas las facturas (admin)"""
        
        query = {}
        if status:
            query['status'] = status.value
        
        invoices = await self.invoices_collection.find(query).sort('created_at', -1).to_list(limit)
        
        result = []
        for invoice in invoices:
            user = await self.users_collection.find_one({'_id': invoice['user_id']})
            result.append(InvoiceResponse(
                id=str(invoice['_id']),
                invoice_number=invoice['invoice_number'],
                user_id=invoice['user_id'],
                user_name=user.get('name') if user else None,
                user_email=user.get('email') if user else None,
                service_name=invoice['service_name'],
                items=invoice['items'],
                subtotal=invoice['subtotal'],
                tax=invoice['tax'],
                total=invoice['total'],
                status=InvoiceStatus(invoice['status']),
                notes=invoice.get('notes'),
                created_at=invoice['created_at'],
                due_date=invoice.get('due_date'),
                paid_at=invoice.get('paid_at'),
                payment_method_id=invoice.get('payment_method_id'),
                created_by_admin_id=invoice.get('created_by_admin_id'),
                created_by_admin_name=invoice.get('created_by_admin_name')
            ))
        
        return result
    
    async def get_invoice_by_id(self, invoice_id: str) -> Optional[InvoiceResponse]:
        """Obtiene una factura por ID"""
        
        try:
            invoice = await self.invoices_collection.find_one({'_id': ObjectId(invoice_id)})
        except:
            invoice = await self.invoices_collection.find_one({'_id': invoice_id})
        
        if not invoice:
            return None
        
        user = await self.users_collection.find_one({'_id': invoice['user_id']})
        
        return InvoiceResponse(
            id=str(invoice['_id']),
            invoice_number=invoice['invoice_number'],
            user_id=invoice['user_id'],
            user_name=user.get('name') if user else None,
            user_email=user.get('email') if user else None,
            service_name=invoice['service_name'],
            items=invoice['items'],
            subtotal=invoice['subtotal'],
            tax=invoice['tax'],
            total=invoice['total'],
            status=InvoiceStatus(invoice['status']),
            notes=invoice.get('notes'),
            created_at=invoice['created_at'],
            due_date=invoice.get('due_date'),
            paid_at=invoice.get('paid_at'),
            payment_method_id=invoice.get('payment_method_id'),
            created_by_admin_id=invoice.get('created_by_admin_id'),
            created_by_admin_name=invoice.get('created_by_admin_name')
        )
    
    async def pay_invoice(
        self,
        invoice_id: str,
        user_id: str,
        payment_method_id: str
    ) -> InvoiceResponse:
        """Procesa el pago de una factura"""
        
        invoice = await self.get_invoice_by_id(invoice_id)
        if not invoice:
            raise ValueError("Factura no encontrada")
        
        if invoice.user_id != user_id:
            raise ValueError("Esta factura no pertenece a este usuario")
        
        if invoice.status != InvoiceStatus.PENDING:
            raise ValueError(f"La factura no puede ser pagada. Estado actual: {invoice.status}")
        
        # Aquí iría la lógica de procesamiento de pago
        # Por ahora solo actualizamos el estado
        
        try:
            invoice_oid = ObjectId(invoice_id)
        except:
            invoice_oid = invoice_id
        
        await self.invoices_collection.update_one(
            {'_id': invoice_oid},
            {
                '$set': {
                    'status': InvoiceStatus.PAID.value,
                    'paid_at': datetime.utcnow(),
                    'payment_method_id': payment_method_id
                }
            }
        )
        
        logger.info(f"✅ Factura {invoice.invoice_number} pagada por usuario {user_id}")
        
        # Retornar factura actualizada
        return await self.get_invoice_by_id(invoice_id)
    
    async def update_invoice(
        self,
        invoice_id: str,
        update_data: InvoiceUpdate
    ) -> InvoiceResponse:
        """Actualiza una factura"""
        
        update_dict = update_data.dict(exclude_unset=True)
        if 'status' in update_dict:
            update_dict['status'] = update_dict['status'].value
        
        update_dict['updated_at'] = datetime.utcnow()
        
        try:
            invoice_oid = ObjectId(invoice_id)
        except:
            invoice_oid = invoice_id
        
        await self.invoices_collection.update_one(
            {'_id': invoice_oid},
            {'$set': update_dict}
        )
        
        return await self.get_invoice_by_id(invoice_id)
    
    async def cancel_invoice(self, invoice_id: str) -> InvoiceResponse:
        """Cancela una factura"""
        
        try:
            invoice_oid = ObjectId(invoice_id)
        except:
            invoice_oid = invoice_id
        
        await self.invoices_collection.update_one(
            {'_id': invoice_oid},
            {
                '$set': {
                    'status': InvoiceStatus.CANCELLED.value,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return await self.get_invoice_by_id(invoice_id)
