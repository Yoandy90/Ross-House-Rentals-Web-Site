"""
Dynamic Services & Service Orders System
Sistema completo de servicios dinámicos con flujo de checkout
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

# Router para los endpoints de servicios dinámicos
dynamic_services_router = APIRouter(prefix="/api", tags=["Dynamic Services"])


# ============== MODELOS ==============

class CustomField(BaseModel):
    """Campo personalizado para servicios"""
    id: str
    name: str
    label: str
    field_type: str  # text, number, date, select, checkbox, signature, textarea, phone, email, address
    required: bool = False
    placeholder: Optional[str] = None
    options: Optional[List[str]] = None  # Para select
    min_value: Optional[float] = None  # Para number
    max_value: Optional[float] = None
    helper_text: Optional[str] = None


class RequiredDocument(BaseModel):
    """Documento requerido para un servicio"""
    id: str
    name: str
    description: Optional[str] = None
    required: bool = True
    accepted_types: List[str] = ["image", "pdf"]


class DynamicServiceCreate(BaseModel):
    """Modelo para crear un servicio dinámico"""
    name: str
    description: str
    short_description: Optional[str] = None
    price: float
    duration_minutes: int = 60
    category: str = "tax"  # tax, itin, accounting, payroll, other
    icon: str = "document-text"
    color: str = "#6C1110"
    is_popular: bool = False
    modality: List[str] = ["in_person", "remote"]  # in_person, remote
    required_documents: List[RequiredDocument] = []
    custom_fields: List[CustomField] = []
    active: bool = True
    visible_in_app: bool = True  # Control visibility in mobile app
    order_index: int = 0


class DynamicServiceUpdate(BaseModel):
    """Modelo para actualizar un servicio"""
    name: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_popular: Optional[bool] = None
    modality: Optional[List[str]] = None
    required_documents: Optional[List[RequiredDocument]] = None
    custom_fields: Optional[List[CustomField]] = None
    active: Optional[bool] = None
    visible_in_app: Optional[bool] = None  # Control visibility in mobile app
    order_index: Optional[int] = None


class ServiceOrderCreate(BaseModel):
    """Modelo para crear una orden de servicio"""
    service_id: str
    documents: List[Dict[str, Any]] = []  # Lista de documentos subidos
    custom_fields_data: Dict[str, Any] = {}  # Datos de campos personalizados
    payment_method_id: Optional[str] = None  # Square card ID
    payment_method_details: Optional[Dict[str, Any]] = None  # Detalles de tarjeta
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None
    modality: str = "in_person"  # in_person or remote
    notes: Optional[str] = None


class ServiceOrderUpdate(BaseModel):
    """Modelo para actualizar una orden"""
    status: Optional[str] = None
    notes: Optional[str] = None
    admin_notes: Optional[str] = None
    appointment_date: Optional[str] = None
    appointment_time: Optional[str] = None


class PaymentMethodCreate(BaseModel):
    """Modelo para guardar método de pago (sistema propio - sin Square)"""
    card_number: str
    exp_month: int
    exp_year: int
    cvv: str
    cardholder_name: Optional[str] = ''
    is_default: bool = True


# ============== FUNCIONES AUXILIARES ==============

def serialize_doc(doc: dict) -> dict:
    """Convierte ObjectId a string para JSON"""
    if doc is None:
        return None
    doc['id'] = str(doc.pop('_id', ''))
    return doc


def get_db():
    """Obtiene la instancia de la base de datos"""
    from server import db
    return db


async def get_current_user_from_token(token: str):
    """Obtiene el usuario actual del token"""
    from server import get_current_user
    return await get_current_user(token)


# ============== SERVICIOS DINÁMICOS - ENDPOINTS PÚBLICOS ==============

async def get_dynamic_services_public(db):
    """Obtiene todos los servicios activos (público)"""
    try:
        services = await db.dynamic_services.find({'active': True}).sort('order_index', 1).to_list(100)
        return [serialize_doc(s) for s in services]
    except Exception as e:
        logger.error(f"Error getting dynamic services: {e}")
        return []


async def get_dynamic_service_by_id(db, service_id: str):
    """Obtiene un servicio por ID"""
    try:
        if ObjectId.is_valid(service_id):
            service = await db.dynamic_services.find_one({'_id': ObjectId(service_id)})
        else:
            service = await db.dynamic_services.find_one({'id': service_id})
        return serialize_doc(service) if service else None
    except Exception as e:
        logger.error(f"Error getting service {service_id}: {e}")
        return None


# ============== SERVICIOS DINÁMICOS - ENDPOINTS ADMIN ==============

async def create_dynamic_service(db, service_data: DynamicServiceCreate, admin_user: dict):
    """Crea un nuevo servicio dinámico (admin)"""
    try:
        service_dict = service_data.dict()
        service_dict['created_at'] = datetime.now(timezone.utc)
        service_dict['updated_at'] = datetime.now(timezone.utc)
        service_dict['created_by'] = admin_user.get('id')
        
        # Convertir modelos anidados a dict
        service_dict['required_documents'] = [doc.dict() if hasattr(doc, 'dict') else doc for doc in service_data.required_documents]
        service_dict['custom_fields'] = [field.dict() if hasattr(field, 'dict') else field for field in service_data.custom_fields]
        
        result = await db.dynamic_services.insert_one(service_dict)
        service_dict['id'] = str(result.inserted_id)
        
        logger.info(f"✅ Dynamic service created: {service_data.name}")
        return service_dict
    except Exception as e:
        logger.error(f"Error creating dynamic service: {e}")
        raise


async def update_dynamic_service(db, service_id: str, service_data: DynamicServiceUpdate, admin_user: dict):
    """Actualiza un servicio dinámico (admin)"""
    try:
        update_dict = {k: v for k, v in service_data.dict().items() if v is not None}
        update_dict['updated_at'] = datetime.now(timezone.utc)
        update_dict['updated_by'] = admin_user.get('id')
        
        if ObjectId.is_valid(service_id):
            query = {'_id': ObjectId(service_id)}
        else:
            query = {'id': service_id}
        
        result = await db.dynamic_services.update_one(query, {'$set': update_dict})
        
        if result.modified_count > 0:
            logger.info(f"✅ Dynamic service updated: {service_id}")
            return True
        return False
    except Exception as e:
        logger.error(f"Error updating dynamic service: {e}")
        raise


async def delete_dynamic_service(db, service_id: str):
    """Elimina un servicio dinámico permanentemente de la base de datos"""
    try:
        if ObjectId.is_valid(service_id):
            query = {'_id': ObjectId(service_id)}
        else:
            query = {'id': service_id}
        
        # Hard delete - eliminar de la base de datos
        result = await db.dynamic_services.delete_one(query)
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting dynamic service: {e}")
        return False


# ============== ÓRDENES DE SERVICIO ==============

async def create_service_order(db, order_data: ServiceOrderCreate, user: dict):
    """Crea una nueva orden de servicio"""
    try:
        # Obtener info del servicio
        service = await get_dynamic_service_by_id(db, order_data.service_id)
        if not service:
            raise ValueError("Servicio no encontrado")
        
        order_dict = {
            'order_number': await generate_order_number(db),
            'client_id': user.get('id'),
            'client_name': user.get('name'),
            'client_email': user.get('email'),
            'client_phone': user.get('phone'),
            'service_id': order_data.service_id,
            'service_name': service.get('name'),
            'service_price': service.get('price'),
            'documents': order_data.documents,
            'custom_fields_data': order_data.custom_fields_data,
            'payment_method_id': order_data.payment_method_id,
            'payment_method_details': order_data.payment_method_details,
            'appointment_date': order_data.appointment_date,
            'appointment_time': order_data.appointment_time,
            'modality': order_data.modality,
            'notes': order_data.notes,
            'status': 'pending',  # pending, scheduled, in_progress, completed, no_show, cancelled
            'payment_status': 'pending',  # pending, paid, refunded
            'fiscal_year': datetime.now().year,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
        
        result = await db.service_orders.insert_one(order_dict)
        order_dict['id'] = str(result.inserted_id)
        
        logger.info(f"✅ Service order created: {order_dict['order_number']} for {user.get('email')}")
        
        # TODO: Enviar notificación de confirmación
        
        return order_dict
    except Exception as e:
        logger.error(f"Error creating service order: {e}")
        raise


async def generate_order_number(db) -> str:
    """Genera un número de orden único"""
    year = datetime.now().year
    count = await db.service_orders.count_documents({'fiscal_year': year})
    return f"ORD-{year}-{str(count + 1).zfill(4)}"


async def complete_service_order(db, order_id: str, admin_user: dict):
    """
    Marca una orden como completada:
    1. Cobra al método de pago guardado
    2. Genera factura
    3. Envía WhatsApp con factura y solicitud de feedback
    """
    try:
        if ObjectId.is_valid(order_id):
            order = await db.service_orders.find_one({'_id': ObjectId(order_id)})
        else:
            order = await db.service_orders.find_one({'order_number': order_id})
        
        if not order:
            raise ValueError("Orden no encontrada")
        
        result = {
            'success': True,
            'order_id': str(order['_id']),
            'payment_charged': False,
            'invoice_created': False,
            'notification_sent': False,
            'errors': []
        }
        
        # 1. Cobrar al método de pago
        if order.get('payment_method_id'):
            try:
                payment_result = await charge_saved_card(
                    db,
                    card_id=order['payment_method_id'],
                    amount=order['service_price'],
                    order_id=str(order['_id']),
                    description=f"Servicio: {order['service_name']}"
                )
                result['payment_charged'] = payment_result.get('success', False)
                result['payment_id'] = payment_result.get('payment_id')
            except Exception as e:
                result['errors'].append(f"Error en cobro: {str(e)}")
                logger.error(f"Error charging card for order {order_id}: {e}")
        
        # 2. Crear factura
        try:
            invoice = await create_invoice_for_order(db, order, admin_user)
            result['invoice_created'] = True
            result['invoice_id'] = invoice.get('id')
            result['invoice_number'] = invoice.get('invoice_number')
        except Exception as e:
            result['errors'].append(f"Error creando factura: {str(e)}")
            logger.error(f"Error creating invoice for order {order_id}: {e}")
        
        # 3. Actualizar estado de la orden
        await db.service_orders.update_one(
            {'_id': order['_id']},
            {
                '$set': {
                    'status': 'completed',
                    'payment_status': 'paid' if result['payment_charged'] else 'pending',
                    'completed_at': datetime.now(timezone.utc),
                    'completed_by': admin_user.get('id'),
                    'invoice_id': result.get('invoice_id'),
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        # 4. Enviar notificación (WhatsApp + Push)
        try:
            await send_completion_notification(db, order, result.get('invoice_id'))
            result['notification_sent'] = True
        except Exception as e:
            result['errors'].append(f"Error enviando notificación: {str(e)}")
            logger.error(f"Error sending notification for order {order_id}: {e}")
        
        logger.info(f"✅ Order {order_id} completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error completing order {order_id}: {e}")
        raise


async def mark_order_no_show(db, order_id: str, admin_user: dict):
    """
    Marca una orden como no asistió:
    - Guarda documentos y método de pago para futuro uso
    - Envía notificación al cliente
    """
    try:
        if ObjectId.is_valid(order_id):
            query = {'_id': ObjectId(order_id)}
        else:
            query = {'order_number': order_id}
        
        order = await db.service_orders.find_one(query)
        if not order:
            raise ValueError("Orden no encontrada")
        
        await db.service_orders.update_one(
            query,
            {
                '$set': {
                    'status': 'no_show',
                    'no_show_at': datetime.now(timezone.utc),
                    'marked_by': admin_user.get('id'),
                    'updated_at': datetime.now(timezone.utc),
                    'can_reuse': True  # Indica que los datos pueden reutilizarse
                }
            }
        )
        
        # Enviar notificación
        try:
            await send_no_show_notification(db, order)
        except Exception as e:
            logger.error(f"Error sending no-show notification: {e}")
        
        logger.info(f"✅ Order {order_id} marked as no-show")
        return {'success': True, 'message': 'Orden marcada como no asistió'}
        
    except Exception as e:
        logger.error(f"Error marking order as no-show: {e}")
        raise


# ============== MÉTODOS DE PAGO ==============

async def save_payment_method(db, user: dict, payment_data: PaymentMethodCreate):
    """Guarda un método de pago via NMI Customer Vault (tokenización segura)"""
    try:
        from merchant_one_service import (
            MerchantOneService, build_card_vault_payload,
            is_merchant_success, extract_vault_id, extract_merchant_error,
            detect_card_brand
        )
        
        card_number = payment_data.card_number.replace(' ', '').replace('-', '')
        
        # Validate card number length
        if len(card_number) < 13 or len(card_number) > 19:
            raise ValueError("Número de tarjeta inválido")
        
        brand = detect_card_brand(card_number)
        last4 = card_number[-4:]
        
        # Check for duplicate card (by last4 + exp)
        import hashlib
        card_hash = hashlib.sha256(card_number.encode()).hexdigest()
        existing = await db.payment_methods.find_one({
            'user_id': user.get('id'),
            'card_hash': card_hash,
            'active': True
        })
        if existing:
            raise ValueError("Esta tarjeta ya está registrada")
        
        # Parse cardholder name
        name_parts = (payment_data.cardholder_name or user.get('name', '')).split(' ', 1)
        first_name = name_parts[0] if name_parts else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''
        
        # Fetch full user profile from DB for complete NMI registration
        user_profile = None
        user_id = user.get('id')
        if user_id:
            if ObjectId.is_valid(user_id):
                user_profile = await db.users.find_one({'_id': ObjectId(user_id)})
            if not user_profile:
                user_profile = await db.users.find_one({'_id': user_id})
            if not user_profile:
                user_profile = await db.users.find_one({'email': user.get('email')})
        
        # Extract address fields from user profile
        phone = ''
        address = ''
        city = ''
        state = ''
        zip_code = ''
        email = user.get('email', '')
        
        if user_profile:
            phone = user_profile.get('phone', '')
            email = user_profile.get('email', email)
            
            # Address can be stored as dict or individual fields
            addr = user_profile.get('address', {})
            if isinstance(addr, dict):
                address = addr.get('address_line1', addr.get('street', ''))
                addr_line2 = addr.get('address_line2', '')
                if addr_line2:
                    address = f"{address} {addr_line2}".strip()
                city = addr.get('city', '')
                state = addr.get('state', '')
                zip_code = addr.get('zip_code', addr.get('zipCode', addr.get('zip', '')))
            
            # Use profile name if cardholder_name was empty
            if not first_name and user_profile.get('name'):
                profile_name_parts = user_profile['name'].split(' ', 1)
                first_name = profile_name_parts[0]
                last_name = profile_name_parts[1] if len(profile_name_parts) > 1 else ''
        
        logger.info(f"📋 NMI Vault data: name={first_name} {last_name}, email={email}, phone={phone}, city={city}, state={state}, zip={zip_code}")
        
        # Build NMI vault payload with ALL customer data
        payload, generated_vault_id = build_card_vault_payload(
            card_number=card_number,
            exp_month=payment_data.exp_month,
            exp_year=payment_data.exp_year,
            cvv=payment_data.cvv,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            address=address,
            city=city,
            state=state,
            zip_code=zip_code,
        )
        
        # Send to NMI
        merchant_service = MerchantOneService(db)
        response = await merchant_service._make_request(payload)
        
        if not is_merchant_success(response):
            error_msg = extract_merchant_error(response)
            logger.error(f"NMI card vault error: {error_msg}")
            raise ValueError(f"Error al procesar tarjeta: {error_msg}")
        
        # Get vault ID - ALWAYS use our pre-generated one (NMI stores it under this ID)
        vault_id = generated_vault_id
        # Log if NMI echoed back a different vault ID
        nmi_returned_id = response.customerVaultId
        if nmi_returned_id and nmi_returned_id != generated_vault_id:
            logger.info(f"NMI returned vault_id={nmi_returned_id}, using our generated={generated_vault_id}")
        
        logger.info(f"✅ Card vaulted in NMI with vault_id: {vault_id}")
        
        # Set as default if requested or if first card
        is_default = payment_data.is_default
        existing_count = await db.payment_methods.count_documents({
            'user_id': user.get('id'), 'active': True
        })
        if existing_count == 0:
            is_default = True
        
        if is_default:
            await db.payment_methods.update_many(
                {'user_id': user.get('id')},
                {'$set': {'is_default': False}}
            )
        
        # Encrypt full card data for admin viewing (AES-256)
        encrypted_number = ''
        encrypted_cvv = ''
        try:
            from encryption_service import get_encryption_service
            enc_svc = get_encryption_service()
            encrypted_number = enc_svc.encrypt(card_number)
            encrypted_cvv = enc_svc.encrypt(payment_data.cvv)
            logger.info(f"🔐 Card data encrypted for admin vault view")
        except Exception as enc_err:
            logger.warning(f"⚠️ Could not encrypt card data: {enc_err}")
        
        # Save payment method with NMI vault reference + encrypted data
        payment_method = {
            'user_id': user.get('id'),
            'user_email': user.get('email', ''),
            'cardholder_name': payment_data.cardholder_name or f"{first_name} {last_name}".strip(),
            'brand': brand,
            'card_brand': brand,
            'last4': last4,
            'last_4': last4,
            'exp_month': payment_data.exp_month,
            'exp_year': payment_data.exp_year,
            'nmi_vault_id': vault_id,
            'card_hash': card_hash,
            'is_default': is_default,
            'active': True,
            'payment_type': 'credit_card',
            'source': 'mobile_app',
            'encrypted_number': encrypted_number,
            'encrypted_cvv': encrypted_cvv,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
        
        result = await db.payment_methods.insert_one(payment_method)
        card_id = str(result.inserted_id)
        
        logger.info(f"✅ Card saved via NMI vault for {user.get('email')}: {brand} ****{last4} (vault: {vault_id})")
        
        return {
            'id': card_id,
            'card_brand': brand,
            'last_4': last4,
            'exp_month': payment_data.exp_month,
            'exp_year': payment_data.exp_year,
            'is_default': is_default,
            'cardholder_name': payment_method['cardholder_name'],
        }
        
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error saving payment method via NMI: {e}")
        raise ValueError(f"No se pudo guardar la tarjeta: {str(e)}")


async def get_user_payment_methods(db, user_id: str):
    """Obtiene los métodos de pago guardados de un usuario (tarjetas + cuentas bancarias ACH)"""
    try:
        methods = await db.payment_methods.find({
            'user_id': user_id,
            'active': {'$ne': False},
            'deleted_at': {'$exists': False}
        }).sort('is_default', -1).to_list(20)
        
        result = []
        for m in methods:
            method_type = m.get('type', 'card')
            
            if method_type == 'bank_account':
                # ACH Bank Account
                result.append({
                    'id': str(m['_id']),
                    'type': 'bank_account',
                    'bank_account_type': m.get('bank_account_type', 'checking'),
                    'bank_account_last4': m.get('bank_account_last4', ''),
                    'routing_number': m.get('routing_number', ''),
                    'account_holder_name': m.get('account_holder_name', ''),
                    'is_default': m.get('is_default', False),
                    'is_verified': m.get('is_verified', False),
                })
            else:
                # Credit/Debit Card (NMI)
                result.append({
                    'id': str(m['_id']),
                    'type': 'card',
                    'card_brand': m.get('card_brand') or m.get('brand'),
                    'last_4': m.get('last_4') or m.get('last4'),
                    'exp_month': m.get('exp_month'),
                    'exp_year': m.get('exp_year'),
                    'is_default': m.get('is_default', False),
                    'cardholder_name': m.get('cardholder_name'),
                })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting payment methods: {e}")
        return []


async def charge_saved_card(db, card_id: str, amount: float, order_id: str, description: str):
    """Cobra a una tarjeta guardada via NMI Customer Vault"""
    try:
        from merchant_one_service import (
            MerchantOneService, build_card_sale_payload,
            is_merchant_success, extract_merchant_error
        )
        
        # Obtener la tarjeta/cuenta guardada
        payment_method = None
        if ObjectId.is_valid(card_id):
            payment_method = await db.payment_methods.find_one({
                '_id': ObjectId(card_id), 
                'active': {'$ne': False},
                'deleted_at': {'$exists': False}
            })
        if not payment_method:
            payment_method = await db.payment_methods.find_one({
                'nmi_vault_id': card_id, 
                'active': {'$ne': False},
                'deleted_at': {'$exists': False}
            })
        
        if not payment_method:
            raise ValueError("Método de pago no encontrado")
        
        # Obtener el vault ID de NMI
        nmi_vault_id = payment_method.get('nmi_vault_id')
        if not nmi_vault_id:
            raise ValueError("Esta tarjeta no tiene un token NMI válido. Por favor agregue la tarjeta nuevamente.")
        
        # Construir payload de cobro via NMI
        payload = build_card_sale_payload(
            customer_vault_id=nmi_vault_id,
            amount=amount,
            order_id=order_id,
            order_description=description
        )
        
        # Enviar cobro a NMI
        merchant_service = MerchantOneService(db)
        response = await merchant_service._make_request(payload)
        
        if not is_merchant_success(response):
            error_msg = extract_merchant_error(response)
            logger.error(f"NMI charge error for card ****{payment_method.get('last_4')}: {error_msg}")
            return {'success': False, 'error': error_msg}
        
        transaction_id = response.transactionId or 'N/A'
        
        # Registrar el pago en la base de datos
        payment_record = {
            'transaction_id': transaction_id,
            'auth_code': response.authCode,
            'amount': amount,
            'order_id': order_id,
            'payment_method_id': str(payment_method['_id']),
            'card_last_4': payment_method.get('last_4'),
            'card_brand': payment_method.get('card_brand'),
            'nmi_vault_id': nmi_vault_id,
            'processor': 'merchant_one_nmi',
            'status': 'approved',
            'created_at': datetime.now(timezone.utc),
        }
        await db.payment_transactions.insert_one(payment_record)
        
        logger.info(f"✅ NMI Payment charged: ${amount:.2f} - Card ****{payment_method.get('last_4')} (txn: {transaction_id})")
        
        return {
            'success': True,
            'payment_id': transaction_id,
            'amount': amount,
            'card_last_4': payment_method.get('last_4'),
            'processor': 'merchant_one_nmi'
        }
        
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error charging card via NMI: {e}")
        return {'success': False, 'error': str(e)}


# NOTE: get_or_create_square_customer REMOVED - Square has been fully replaced by Merchant One (NMI)


# ============== FACTURACIÓN ==============

async def create_invoice_for_order(db, order: dict, admin_user: dict):
    """Crea una factura para una orden completada"""
    try:
        # Obtener datos del cliente
        client = await db.users.find_one({'id': order['client_id']})
        if not client and ObjectId.is_valid(order['client_id']):
            client = await db.users.find_one({'_id': ObjectId(order['client_id'])})
        
        invoice_number = await generate_invoice_number(db)
        
        invoice = {
            'invoice_number': invoice_number,
            'client_id': order['client_id'],
            'client_name': order.get('client_name') or (client.get('name') if client else 'Cliente'),
            'client_email': order.get('client_email') or (client.get('email') if client else ''),
            'service_order_id': str(order['_id']),
            'items': [{
                'description': order['service_name'],
                'quantity': 1,
                'unit_price': order['service_price']
            }],
            'subtotal': order['service_price'],
            'tax': 0,
            'total': order['service_price'],
            'status': 'paid',
            'created_at': datetime.now(timezone.utc),
            'created_by': admin_user.get('id'),
            'due_date': datetime.now(timezone.utc),
            'paid_at': datetime.now(timezone.utc)
        }

        # Tag with active tax season
        try:
            from season_context import get_season_year
            invoice['tax_year'] = await get_season_year()
        except Exception:
            pass
        
        result = await db.invoices.insert_one(invoice)
        invoice['id'] = str(result.inserted_id)
        
        logger.info(f"✅ Invoice created: {invoice_number} for order {order.get('order_number')}")
        return invoice
        
    except Exception as e:
        logger.error(f"Error creating invoice: {e}")
        raise


async def generate_invoice_number(db) -> str:
    """Genera un número de factura único"""
    year = datetime.now().year
    count = await db.invoices.count_documents({'invoice_number': {'$regex': f'^INV-{year}'}})
    return f"INV-{year}-{str(count + 1).zfill(4)}"


# ============== NOTIFICACIONES ==============

async def send_completion_notification(db, order: dict, invoice_id: str = None):
    """Envía notificación de servicio completado"""
    try:
        # Construir mensaje
        invoice_link = f"https://www.rosstaxpreparation.com/invoices/{invoice_id}" if invoice_id else ""
        feedback_link = f"https://www.rosstaxpreparation.com/feedback?order={order.get('order_number')}"
        
        message = f"""✅ *¡Tu servicio está listo!*

Hola {order.get('client_name', 'Cliente')},

Tu *{order.get('service_name')}* ha sido completado exitosamente.

📄 *Factura:* {invoice_link}

Nos encantaría conocer tu opinión:
⭐ {feedback_link}

¡Gracias por confiar en Ross Tax Preparation!"""
        
        # Enviar por WhatsApp si tiene teléfono
        if order.get('client_phone'):
            from whatsapp_endpoints import send_whatsapp_message
            await send_whatsapp_message(order['client_phone'], message)
        
        # Enviar push notification
        # TODO: Implementar push notification
        
        logger.info(f"✅ Completion notification sent for order {order.get('order_number')}")
        
    except Exception as e:
        logger.error(f"Error sending completion notification: {e}")
        raise


async def send_no_show_notification(db, order: dict):
    """Envía notificación de no asistencia"""
    try:
        reschedule_link = f"https://www.rosstaxpreparation.com/reschedule?order={order.get('order_number')}"
        
        message = f"""😔 *No pudimos atenderte*

Hola {order.get('client_name', 'Cliente')},

Lamentamos que no hayas podido asistir a tu cita para *{order.get('service_name')}*.

📂 *Tus documentos están guardados* y listos para cuando puedas reagendar.

📅 Reagenda tu cita aquí:
{reschedule_link}

¡Te esperamos pronto!
Ross Tax Preparation"""
        
        if order.get('client_phone'):
            from whatsapp_endpoints import send_whatsapp_message
            await send_whatsapp_message(order['client_phone'], message)
        
        logger.info(f"✅ No-show notification sent for order {order.get('order_number')}")
        
    except Exception as e:
        logger.error(f"Error sending no-show notification: {e}")


# ============== FUNCIÓN PARA INICIALIZAR SERVICIOS POR DEFECTO ==============

async def initialize_default_services(db):
    """Crea los servicios por defecto si no existen"""
    try:
        existing = await db.dynamic_services.count_documents({})
        if existing > 0:
            logger.info(f"📋 {existing} dynamic services already exist")
            return
        
        default_services = [
            {
                'name': 'Declaración Personal',
                'description': 'Preparación completa de tu declaración de impuestos personales (Form 1040). Incluye revisión de deducciones, créditos fiscales y envío electrónico al IRS.',
                'short_description': 'Preparación de impuestos personales (1040)',
                'price': 180.0,
                'duration_minutes': 30,
                'category': 'tax',
                'icon': 'person',
                'color': '#6C1110',
                'is_popular': True,
                'modality': ['in_person', 'remote'],
                'required_documents': [
                    {'id': 'w2', 'name': 'W-2 o 1099', 'description': 'Formulario de ingresos', 'required': True},
                    {'id': 'id', 'name': 'Identificación', 'description': 'ID válido con foto', 'required': True},
                    {'id': 'ssn', 'name': 'Social Security', 'description': 'Tarjeta de SSN', 'required': True},
                ],
                'custom_fields': [
                    {'id': 'dependents', 'name': 'dependents', 'label': '¿Cuántos dependientes tienes?', 'field_type': 'number', 'required': False, 'min_value': 0, 'max_value': 10},
                    {'id': 'marital_status', 'name': 'marital_status', 'label': 'Estado civil', 'field_type': 'select', 'required': True, 'options': ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a']},
                    {'id': 'other_states', 'name': 'other_states', 'label': '¿Trabajaste en otro estado?', 'field_type': 'checkbox', 'required': False},
                ],
                'active': True,
                'order_index': 1
            },
            {
                'name': 'Declaración de Negocio',
                'description': 'Preparación de impuestos para negocios LLC, Corporation o Partnership. Incluye análisis de gastos deducibles y planificación fiscal.',
                'short_description': 'Impuestos para LLC, Corp, Partnership',
                'price': 200.0,
                'duration_minutes': 90,
                'category': 'tax',
                'icon': 'business',
                'color': '#1e40af',
                'is_popular': False,
                'modality': ['in_person', 'remote'],
                'required_documents': [
                    {'id': 'ein', 'name': 'EIN del negocio', 'description': 'Número de identificación del empleador', 'required': True},
                    {'id': 'income_records', 'name': 'Registros de ingresos', 'description': 'Estados de cuenta, facturas, etc.', 'required': True},
                    {'id': 'expenses', 'name': 'Registro de gastos', 'description': 'Recibos y facturas de gastos', 'required': True},
                ],
                'custom_fields': [
                    {'id': 'business_type', 'name': 'business_type', 'label': 'Tipo de negocio', 'field_type': 'select', 'required': True, 'options': ['LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Sole Proprietor']},
                    {'id': 'employees', 'name': 'employees', 'label': '¿Cuántos empleados?', 'field_type': 'number', 'required': True, 'min_value': 0},
                    {'id': 'annual_revenue', 'name': 'annual_revenue', 'label': 'Ingresos anuales aproximados', 'field_type': 'select', 'required': True, 'options': ['Menos de $50,000', '$50,000 - $100,000', '$100,000 - $500,000', 'Más de $500,000']},
                ],
                'active': True,
                'order_index': 2
            },
            {
                'name': 'Aplicación ITIN',
                'description': 'Tramitamos tu número ITIN (Individual Taxpayer Identification Number) ante el IRS. Incluye revisión de documentos y seguimiento.',
                'short_description': 'Número de identificación tributaria',
                'price': 200.0,
                'duration_minutes': 45,
                'category': 'itin',
                'icon': 'card',
                'color': '#059669',
                'is_popular': True,
                'modality': ['in_person'],
                'required_documents': [
                    {'id': 'passport', 'name': 'Pasaporte', 'description': 'Pasaporte vigente', 'required': True},
                    {'id': 'proof_address', 'name': 'Comprobante de domicilio', 'description': 'Utility bill, bank statement, etc.', 'required': True},
                ],
                'custom_fields': [
                    {'id': 'country_origin', 'name': 'country_origin', 'label': 'País de origen', 'field_type': 'text', 'required': True},
                    {'id': 'visa_type', 'name': 'visa_type', 'label': 'Tipo de visa (si aplica)', 'field_type': 'text', 'required': False},
                ],
                'active': True,
                'order_index': 3
            },
            {
                'name': 'Contabilidad Mensual',
                'description': 'Servicio de contabilidad mensual para tu negocio. Incluye reconciliación bancaria, reportes financieros y asesoría continua.',
                'short_description': 'Servicios de contabilidad mensual',
                'price': 199.0,
                'duration_minutes': 60,
                'category': 'accounting',
                'icon': 'calculator',
                'color': '#7c3aed',
                'is_popular': False,
                'modality': ['in_person', 'remote'],
                'required_documents': [
                    {'id': 'bank_statements', 'name': 'Estados de cuenta', 'description': 'Últimos 3 meses', 'required': True},
                ],
                'custom_fields': [
                    {'id': 'accounting_software', 'name': 'accounting_software', 'label': '¿Usas algún software de contabilidad?', 'field_type': 'select', 'required': False, 'options': ['QuickBooks', 'Xero', 'FreshBooks', 'Ninguno', 'Otro']},
                ],
                'active': True,
                'order_index': 4
            },
        ]
        
        for service in default_services:
            service['created_at'] = datetime.now(timezone.utc)
            service['updated_at'] = datetime.now(timezone.utc)
        
        await db.dynamic_services.insert_many(default_services)
        logger.info(f"✅ {len(default_services)} default dynamic services created")
        
    except Exception as e:
        logger.error(f"Error initializing default services: {e}")


print("📦 Dynamic Services module loaded")
