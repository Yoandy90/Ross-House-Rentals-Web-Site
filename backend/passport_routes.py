"""
Passport Types and Applications Routes Router
Extracted from server.py for modularization.
Handles passport types CRUD, applications, pricing, and renewal tracking.
"""
import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body
from pydantic import BaseModel
from bson import ObjectId
from passlib.context import CryptContext
from dynamic_services import (
    DynamicServiceCreate, DynamicServiceUpdate,
    get_dynamic_service_by_id, create_dynamic_service, update_dynamic_service,
    delete_dynamic_service, create_service_order, complete_service_order,
    mark_order_no_show, save_payment_method, get_user_payment_methods,
    ServiceOrderCreate, PaymentMethodCreate, charge_saved_card
)

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

passport_router = APIRouter()
_db = None


def init_passport_router(db):
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

# ============== PASSPORT TYPES MANAGEMENT ==============

@passport_router.get('/admin/passport-types')
async def get_passport_types(request: Request):
    current_user = await _require_admin(request)
    """Get all passport types configuration"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        # Try to get from database
        config = await _db.app_config.find_one({'config_type': 'passport_types'})
        
        if config and config.get('passport_types'):
            return {'passport_types': config['passport_types']}
        
        # Return defaults if not configured
        default_types = [
            {
                'id': 'passport_cuban',
                'country_code': 'CU',
                'country_name': 'Cuba',
                'flag_emoji': '🇨🇺',
                'title': 'Pasaporte Cubano',
                'description': 'Solicitud o renovación de pasaporte cubano',
                'price': 260,
                'price_display': 'Desde $260',
                'available': True,
                'order_index': 1,
                'form_type': 'cuban_passport_form'
            },
            {
                'id': 'passport_venezuelan',
                'country_code': 'VE',
                'country_name': 'Venezuela',
                'flag_emoji': '🇻🇪',
                'title': 'Pasaporte Venezolano',
                'description': 'Próximamente disponible',
                'price': 0,
                'price_display': 'Próximamente',
                'available': False,
                'order_index': 2,
                'form_type': 'venezuelan_passport_form'
            },
            {
                'id': 'passport_colombian',
                'country_code': 'CO',
                'country_name': 'Colombia',
                'flag_emoji': '🇨🇴',
                'title': 'Pasaporte Colombiano',
                'description': 'Próximamente disponible',
                'price': 0,
                'price_display': 'Próximamente',
                'available': False,
                'order_index': 3,
                'form_type': 'colombian_passport_form'
            }
        ]
        return {'passport_types': default_types}
    except Exception as e:
        logging.error(f"Error getting passport types: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@passport_router.post('/admin/passport-types')
async def save_passport_types(request: Request):
    current_user = await _require_admin(request)
    """Save passport types configuration"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        data = await request.json()
        passport_types = data.get('passport_types', [])
        
        # Update or insert config
        await _db.app_config.update_one(
            {'config_type': 'passport_types'},
            {
                '$set': {
                    'config_type': 'passport_types',
                    'passport_types': passport_types,
                    'updated_at': datetime.utcnow(),
                    'updated_by': current_user['id']
                }
            },
            upsert=True
        )
        
        logging.info(f"✅ Passport types updated by {current_user.get('email')}")
        return {'success': True, 'message': 'Passport types saved successfully'}
    except Exception as e:
        logging.error(f"Error saving passport types: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@passport_router.get('/passport-types')
async def get_public_passport_types():
    """Get available passport types (public endpoint for mobile app)"""
    try:
        config = await _db.app_config.find_one({'config_type': 'passport_types'})
        
        if config and config.get('passport_types'):
            # Filter only available ones
            available = [p for p in config['passport_types'] if p.get('available', False)]
            return {'passport_types': available}
        
        # Return default Cuban passport
        return {
            'passport_types': [
                {
                    'id': 'passport_cuban',
                    'country_code': 'CU',
                    'country_name': 'Cuba',
                    'flag_emoji': '🇨🇺',
                    'title': 'Pasaporte Cubano',
                    'description': 'Solicitud o renovación de pasaporte cubano',
                    'price': 260,
                    'price_display': 'Desde $260',
                    'available': True,
                    'order_index': 1,
                    'form_type': 'cuban_passport_form'
                }
            ]
        }
    except Exception as e:
        logging.error(f"Error getting public passport types: {e}")
        return {'passport_types': []}

@passport_router.get('/dynamic-services')
async def get_all_dynamic_services(request: Request):
    current_user = await _auth_user(request)
    """Obtiene todos los servicios dinámicos activos y visibles (público) - Combina dynamic_services y services"""
    try:
        # Detect language
        lang = request.query_params.get('lang', '')
        if not lang:
            accept_lang = request.headers.get('Accept-Language', '')
            lang = 'en' if 'en' in accept_lang.lower() else 'es'
        
        all_services = []
        
        # 1. Get services from dynamic_services collection
        dynamic_services = await _db.dynamic_services.find({
            'active': True,
            'visible_in_app': {'$ne': False}
        }).sort('order_index', 1).to_list(100)
        
        for s in dynamic_services:
            s['id'] = str(s.pop('_id', ''))
            s['source'] = 'dynamic_services'
            # Localize if English
            if lang == 'en':
                if s.get('name_en'):
                    s['name'] = s['name_en']
                if s.get('short_description_en'):
                    s['short_description'] = s['short_description_en']
                if s.get('description_en'):
                    s['description'] = s['description_en']
            else:
                # Spanish: use name_es for required_documents if available
                pass
            # Localize required_documents based on language
            if s.get('required_documents'):
                for doc in s['required_documents']:
                    if lang == 'es' or lang != 'en':
                        if doc.get('name_es'):
                            doc['name'] = doc['name_es']
                        if doc.get('description_es'):
                            doc['description'] = doc['description_es']
            all_services.append(s)
        
        # 2. Get services from service_prices collection (webapp services)
        admin_services = await _db.service_prices.find({
            'is_active': {'$ne': False}
        }).to_list(100)
        
        for s in admin_services:
            service_id = str(s.pop('_id', ''))
            service_name = s.get('name', '')
            # Map to dynamic service format
            mapped_service = {
                'id': service_id,
                'name': s.get('name_en', service_name) if lang == 'en' and s.get('name_en') else service_name,
                'description': s.get('description_en', s.get('description', '')) if lang == 'en' and s.get('description_en') else s.get('description', ''),
                'short_description': (s.get('description_en', s.get('description', ''))[:100] if lang == 'en' and s.get('description_en') else s.get('description', '')[:100]) if s.get('description') else '',
                'price': s.get('base_price', s.get('price_credits', 0)),
                'price_credits': s.get('price_credits', s.get('base_price', 0)),
                'category': s.get('category', 'general'),
                'icon': 'briefcase',
                'color': '#6C1110',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'estimated_time': s.get('estimated_time', ''),
                'source': 'services',
                'order_index': 100
            }
            
            # Avoid duplicates by name
            is_duplicate = False
            for existing in all_services:
                existing_name = existing.get('name', '').lower()
                new_name = mapped_service['name'].lower()
                if existing_name in new_name or new_name in existing_name or existing_name == new_name:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                all_services.append(mapped_service)
        
        all_services.sort(key=lambda x: x.get('order_index', 999))
        
        return {'services': all_services, 'count': len(all_services)}
    except Exception as e:
        logging.error(f"Error getting dynamic services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/dynamic-services/{service_id}')
async def get_dynamic_service(service_id: str, request: Request):
    current_user = await _auth_user(request)
    """Obtiene un servicio dinámico por ID"""
    try:
        service = await get_dynamic_service_by_id(_db, service_id)
        if not service:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
        
        # Detect language
        lang = request.query_params.get('lang', '')
        if not lang:
            accept_lang = request.headers.get('Accept-Language', '')
            lang = 'en' if 'en' in accept_lang.lower() else 'es'
        
        # Localize required_documents
        if service.get('required_documents'):
            for doc in service['required_documents']:
                if lang == 'es' or lang != 'en':
                    if doc.get('name_es'):
                        doc['name'] = doc['name_es']
                    if doc.get('description_es'):
                        doc['description'] = doc['description_es']
        
        return service
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting service {service_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.post('/admin/dynamic-services')
async def admin_create_dynamic_service(
    service_data: DynamicServiceCreate,
    request: Request
):
    current_user = await _require_admin(request)

    """Crea un nuevo servicio dinámico (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        service = await create_dynamic_service(_db, service_data, current_user)
        return {'success': True, 'service': service}
    except Exception as e:
        logging.error(f"Error creating dynamic service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.put('/admin/dynamic-services/{service_id}')
async def admin_update_dynamic_service(
    service_id: str,
    service_data: DynamicServiceUpdate,
    request: Request
):
    current_user = await _require_admin(request)

    """Actualiza un servicio dinámico (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        success = await update_dynamic_service(_db, service_id, service_data, current_user)
        if not success:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating dynamic service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.delete('/admin/dynamic-services/{service_id}')
async def admin_delete_dynamic_service(
    service_id: str,
    request: Request
):
    current_user = await _require_admin(request)

    """Elimina (desactiva) un servicio dinámico (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        success = await delete_dynamic_service(_db, service_id)
        if not success:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting dynamic service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/admin/dynamic-services')
async def admin_get_all_dynamic_services(
    request: Request
):
    current_user = await _require_admin(request)

    """Obtiene todos los servicios dinámicos incluyendo inactivos (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        services = await _db.dynamic_services.find({}).sort('order_index', 1).to_list(100)
        for s in services:
            s['id'] = str(s.pop('_id', ''))
        return {'services': services, 'count': len(services)}
    except Exception as e:
        logging.error(f"Error getting all dynamic services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.post('/admin/seed-services-catalog')
async def seed_services_catalog(
    request: Request
):
    """Seed the standard services catalog (idempotent - skips existing services)"""
    try:
        from datetime import datetime
        
        catalog = [
            # ===== TAX SERVICES =====
            {
                'service_type': 'personal_tax_return',
                'name': 'Declaración Personal',
                'name_en': 'Personal Tax Return',
                'description': 'Preparación y presentación de declaración de impuestos personal',
                'description_en': 'Personal income tax return preparation and filing',
                'short_description': 'Impuestos personales',
                'short_description_en': 'Personal taxes',
                'price': 180.00,
                'duration_minutes': 30,
                'category': 'tax',
                'icon': 'document-text',
                'color': '#6C1110',
                'is_popular': True,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 1,
            },
            {
                'service_type': 'business_tax_return',
                'name': 'Declaración de Negocios',
                'name_en': 'Business Tax Return',
                'description': 'Preparación de declaración de impuestos para negocios (LLC, Corp, Partnership)',
                'description_en': 'Business tax return preparation (LLC, Corp, Partnership)',
                'short_description': 'Impuestos de negocio',
                'short_description_en': 'Business taxes',
                'price': 350.00,
                'duration_minutes': 60,
                'category': 'tax',
                'icon': 'briefcase',
                'color': '#1E40AF',
                'is_popular': True,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 2,
            },
            {
                'service_type': 'itin_application',
                'name': 'Solicitud ITIN',
                'name_en': 'ITIN Application',
                'description': 'Preparación y envío de solicitud de ITIN (Número de Identificación Personal del IRS)',
                'description_en': 'ITIN (Individual Taxpayer Identification Number) application preparation',
                'short_description': 'Número ITIN',
                'short_description_en': 'ITIN Number',
                'price': 200.00,
                'duration_minutes': 45,
                'category': 'tax',
                'icon': 'card',
                'color': '#059669',
                'is_popular': True,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person'],
                'order_index': 3,
            },
            {
                'service_type': 'tax_amendment',
                'name': 'Enmienda de Impuestos',
                'name_en': 'Tax Amendment',
                'description': 'Corrección o enmienda de declaración de impuestos ya presentada',
                'description_en': 'Correction or amendment of previously filed tax return',
                'short_description': 'Corrección de taxes',
                'short_description_en': 'Tax correction',
                'price': 150.00,
                'duration_minutes': 30,
                'category': 'tax',
                'icon': 'create',
                'color': '#D97706',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 4,
            },
            # ===== BUSINESS SERVICES =====
            {
                'service_type': 'llc_formation',
                'name': 'Formación de LLC',
                'name_en': 'LLC Formation',
                'description': 'Creación y registro de LLC (Compañía de Responsabilidad Limitada)',
                'description_en': 'LLC (Limited Liability Company) creation and registration',
                'short_description': 'Crear LLC',
                'short_description_en': 'Create LLC',
                'price': 350.00,
                'duration_minutes': 45,
                'category': 'business',
                'icon': 'business',
                'color': '#7C3AED',
                'is_popular': True,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 5,
            },
            {
                'service_type': 'monthly_bookkeeping',
                'name': 'Contabilidad Mensual',
                'name_en': 'Monthly Bookkeeping',
                'description': 'Servicio de contabilidad y registro de transacciones mensual',
                'description_en': 'Monthly bookkeeping and transaction recording service',
                'short_description': 'Contabilidad',
                'short_description_en': 'Bookkeeping',
                'price': 200.00,
                'duration_minutes': 30,
                'category': 'business',
                'icon': 'calculator',
                'color': '#0891B2',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 6,
            },
            # ===== DOCUMENT SERVICES =====
            {
                'service_type': 'translations',
                'name': 'Traducciones',
                'name_en': 'Translations',
                'description': 'Traducción certificada de documentos (por página)',
                'description_en': 'Certified document translations (per page)',
                'short_description': 'Traducir documentos',
                'short_description_en': 'Translate documents',
                'price': 25.00,
                'duration_minutes': 30,
                'category': 'documents',
                'icon': 'language',
                'color': '#2563EB',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 7,
            },
            {
                'service_type': 'notarizations',
                'name': 'Notarizaciones',
                'name_en': 'Notarizations',
                'description': 'Servicio de notarización de documentos',
                'description_en': 'Document notarization service',
                'short_description': 'Notarizar documentos',
                'short_description_en': 'Notarize documents',
                'price': 15.00,
                'duration_minutes': 15,
                'category': 'documents',
                'icon': 'stamp',
                'color': '#4B5563',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person'],
                'order_index': 8,
            },
            # ===== PASSPORT SERVICES =====
            {
                'service_type': 'passport_services',
                'name': 'Trámite de Pasaporte',
                'name_en': 'Passport Services',
                'description': 'Asistencia con trámites y renovación de pasaporte',
                'description_en': 'Passport processing and renewal assistance',
                'short_description': 'Pasaporte',
                'short_description_en': 'Passport',
                'price': 100.00,
                'duration_minutes': 30,
                'category': 'documents',
                'icon': 'airplane',
                'color': '#DC2626',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person'],
                'order_index': 9,
            },
            # ===== IMMIGRATION SERVICES =====
            {
                'service_type': 'immigration_consultation',
                'name': 'Consulta de Inmigración',
                'name_en': 'Immigration Consultation',
                'description': 'Consulta y orientación sobre trámites migratorios',
                'description_en': 'Immigration process consultation and guidance',
                'short_description': 'Inmigración',
                'short_description_en': 'Immigration',
                'price': 100.00,
                'duration_minutes': 30,
                'category': 'immigration',
                'icon': 'globe',
                'color': '#0D9488',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote'],
                'order_index': 10,
            },
            # ===== GENERAL =====
            {
                'service_type': 'general_consultation',
                'name': 'Consulta General',
                'name_en': 'General Consultation',
                'description': 'Consulta general sobre cualquier servicio que ofrecemos',
                'description_en': 'General consultation about any of our services',
                'short_description': 'Consulta',
                'short_description_en': 'Consultation',
                'price': 0.00,
                'duration_minutes': 30,
                'category': 'other',
                'icon': 'chatbubbles',
                'color': '#6B7280',
                'is_popular': False,
                'active': True,
                'visible_in_app': True,
                'modality': ['in_person', 'remote', 'video_call'],
                'order_index': 11,
            },
        ]
        
        created = 0
        updated = 0
        skipped = 0
        
        for svc in catalog:
            existing = await _db.dynamic_services.find_one({'service_type': svc['service_type']})
            if existing:
                # Update existing service with new data (preserve any custom changes)
                await _db.dynamic_services.update_one(
                    {'service_type': svc['service_type']},
                    {'$set': {**svc, 'updated_at': datetime.utcnow().isoformat()}}
                )
                updated += 1
            else:
                svc['created_at'] = datetime.utcnow().isoformat()
                svc['updated_at'] = datetime.utcnow().isoformat()
                await _db.dynamic_services.insert_one(svc)
                created += 1
        
        total = await _db.dynamic_services.count_documents({})
        
        return {
            'success': True,
            'message': f'Catálogo de servicios actualizado: {created} creados, {updated} actualizados',
            'created': created,
            'updated': updated,
            'total_services': total
        }
    except Exception as e:
        logging.error(f"Error seeding services catalog: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ============== SERVICE ORDERS ENDPOINTS ==============

@passport_router.post('/service-orders')
async def create_new_service_order(
    order_data: ServiceOrderCreate,
    request: Request
):
    current_user = await _auth_user(request)

    """Crea una nueva orden de servicio"""
    try:
        order = await create_service_order(_db, order_data, current_user)
        # Remove MongoDB ObjectId which can't be serialized
        if '_id' in order:
            order['id'] = str(order.pop('_id'))
        return {'success': True, 'order': order}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error creating service order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/service-orders/my')
async def get_my_service_orders(
    request: Request
):
    current_user = await _auth_user(request)

    """Obtiene las órdenes de servicio del usuario actual"""
    try:
        orders = await _db.service_orders.find({
            'client_id': current_user.get('id')
        }).sort('created_at', -1).to_list(50)
        
        for o in orders:
            o['id'] = str(o.pop('_id', ''))
        
        return {'orders': orders, 'count': len(orders)}
    except Exception as e:
        logging.error(f"Error getting user service orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/admin/service-orders/all')
async def admin_get_all_service_orders(
    request: Request,

    status: Optional[str] = None,
    limit: int = 100

):
    current_user = await _require_admin(request)

    """Obtiene todas las órdenes de servicio (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        query = {}
        if status:
            query['status'] = status
        
        orders = await _db.service_orders.find(query).sort('created_at', -1).to_list(limit)
        
        for o in orders:
            o['id'] = str(o.pop('_id', ''))
        
        # Get stats
        stats = {
            'total': await _db.service_orders.count_documents({}),
            'pending': await _db.service_orders.count_documents({'status': 'pending'}),
            'scheduled': await _db.service_orders.count_documents({'status': 'scheduled'}),
            'in_progress': await _db.service_orders.count_documents({'status': 'in_progress'}),
            'completed': await _db.service_orders.count_documents({'status': 'completed'}),
            'no_show': await _db.service_orders.count_documents({'status': 'no_show'})
        }
        
        return {'orders': orders, 'count': len(orders), 'stats': stats}
    except Exception as e:
        logging.error(f"Error getting all service orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.post('/admin/service-orders/{order_id}/complete')
async def admin_complete_service_order(
    order_id: str,
    request: Request
):
    current_user = await _require_admin(request)

    """Marca una orden como completada, cobra y genera factura (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        result = await complete_service_order(_db, order_id, current_user)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error completing service order: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.post('/admin/service-orders/{order_id}/no-show')
async def admin_mark_no_show(
    order_id: str,
    request: Request
):
    current_user = await _require_admin(request)

    """Marca una orden como no asistió (admin)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        result = await mark_order_no_show(_db, order_id, current_user)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error marking order as no-show: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== SERVICE ORDER PAYMENT ENDPOINT ==============

class ServiceOrderPaymentRequest(BaseModel):
    payment_method_id: str
    amount: float

@passport_router.post('/service-orders/{order_id}/pay')
async def pay_service_order(
    order_id: str,
    payment_request: ServiceOrderPaymentRequest,
    request: Request
):
    current_user = await _auth_user(request)

    """
    Procesar pago de una orden de servicio
    """
    try:
        # Buscar la orden - flexible lookup
        user_id = current_user.get('id') or str(current_user.get('_id', ''))
        
        order = await _db.service_orders.find_one({
            '$and': [
                {'$or': [
                    {'id': order_id},
                    {'_id': order_id},
                    {'_id': ObjectId(order_id)} if ObjectId.is_valid(order_id) else {'_id': order_id},
                    {'order_number': order_id}
                ]},
                {'$or': [
                    {'client_id': user_id},
                    {'client_id': str(user_id)},
                    {'user_id': user_id},
                    {'user_id': str(user_id)}
                ]}
            ]
        })
        
        if not order:
            # Try admin search (admin can pay on behalf of client)
            if current_user.get('role') == 'admin':
                order = await _db.service_orders.find_one({
                    '$or': [
                        {'id': order_id},
                        {'_id': order_id},
                        {'_id': ObjectId(order_id)} if ObjectId.is_valid(order_id) else {'_id': order_id},
                        {'order_number': order_id}
                    ]
                })
        
        if not order:
            raise HTTPException(status_code=404, detail="Orden no encontrada")
        
        # Verificar que el monto sea correcto
        if payment_request.amount <= 0:
            raise HTTPException(status_code=400, detail="Monto inválido")
        
        # Verificar que el estado de pago sea pendiente
        if order.get('payment_status') == 'paid':
            raise HTTPException(status_code=400, detail="Esta orden ya fue pagada")
        
        # Procesar el pago usando Merchant One (NMI)
        payment_result = await charge_saved_card(
            _db,
            payment_request.payment_method_id,
            payment_request.amount,
            order_id,
            f"Pago de orden {order.get('order_number', order_id)} - {order.get('service_type', 'Servicio')}"
        )
        
        if not payment_result.get('success'):
            error_msg = payment_result.get('error', 'Error procesando el pago')
            if isinstance(error_msg, dict):
                error_msg = error_msg.get('errors', [{}])[0].get('detail', 'Error procesando el pago')
            raise HTTPException(status_code=400, detail=str(error_msg))
        
        # Actualizar el estado de pago de la orden
        now = datetime.now(timezone.utc)
        update_data = {
            'payment_status': 'paid',
            'paid_at': now,
            'payment_id': payment_result.get('payment_id'),
            'payment_amount': payment_request.amount,
            'updated_at': now
        }
        
        await _db.service_orders.update_one(
            {'$or': [
                {'id': order_id},
                {'_id': order_id},
                {'_id': ObjectId(order_id)} if ObjectId.is_valid(order_id) else {'_id': order_id}
            ]},
            {'$set': update_data}
        )
        
        # ============ CREAR FACTURA PAGADA ============
        try:
            invoice_id = str(uuid.uuid4())
            invoice_number = f"INV-{now.strftime('%Y%m')}-{invoice_id[:8].upper()}"
            
            # Check if the order has generate_client_invoice flag
            show_to_client = order.get('generate_client_invoice', True)
            
            invoice = {
                'id': invoice_id,
                'invoice_number': invoice_number,
                'user_id': current_user.get('id'),
                'client_id': current_user.get('id'),
                'client_name': current_user.get('name', ''),
                'client_email': current_user.get('email', ''),
                'client_phone': current_user.get('phone', ''),
                'service_order_id': order_id,
                'order_number': order.get('order_number', ''),
                'service_type': order.get('service_type', 'Servicio'),
                'description': f"Pago de orden #{order.get('order_number', order_id)} - {order.get('service_type', 'Servicio')}",
                'items': [{
                    'description': order.get('service_type', 'Servicio'),
                    'quantity': 1,
                    'unit_price': payment_request.amount,
                    'total': payment_request.amount
                }],
                'subtotal': payment_request.amount,
                'tax': 0,
                'total': payment_request.amount,
                'amount': payment_request.amount,
                'status': 'paid',
                'payment_method': 'credit_card',
                'payment_id': payment_result.get('payment_id'),
                'payment_processor': 'merchant_one_nmi',
                'card_last4': payment_result.get('card_last_4', '****'),
                'card_brand': payment_result.get('card_brand', ''),
                'paid_at': now,
                'due_date': now,
                'created_by': 'system_auto',
                'visible_to_client': show_to_client,
                'created_at': now,
                'updated_at': now,
            }
            
            await _db.invoices.insert_one(invoice)
            logging.info(f"📄 Invoice {invoice_number} created (PAID) for order {order_id}: ${payment_request.amount:.2f}")
            
            # Link invoice to service order
            await _db.service_orders.update_one(
                {'$or': [
                    {'id': order_id},
                    {'_id': order_id},
                    {'_id': ObjectId(order_id)} if ObjectId.is_valid(order_id) else {'_id': order_id}
                ]},
                {'$set': {'invoice_id': invoice_id, 'invoice_number': invoice_number}}
            )
        except Exception as inv_error:
            logging.error(f"⚠️ Error creating invoice after payment: {inv_error}")
        # ============ FIN CREAR FACTURA ============
        
        # Crear notificación para el admin
        await _db.notifications.insert_one({
            'id': str(uuid.uuid4()),
            'user_id': None,  # Para admin
            'type': 'payment_received',
            'title': 'Pago Recibido',
            'message': f"Se recibió pago de ${payment_request.amount:.2f} para orden {order.get('order_number', order_id)}",
            'data': {
                'order_id': order_id,
                'amount': payment_request.amount,
                'client_id': current_user.get('id'),
                'client_name': current_user.get('name')
            },
            'read': False,
            'created_at': now
        })
        
        # ============ NOTIFICACIONES AL ADMIN (Email + SMS + Push) ============
        try:
            # Get admin user(s)
            admin_users = await _db.users.find({'role': 'admin'}).to_list(10)
            
            # Get notification service config
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            
            client_name = current_user.get('name', 'Cliente')
            order_number = order.get('order_number', order_id)
            service_type = order.get('service_type', 'Servicio')
            txn_id = payment_result.get('payment_id', 'N/A')
            card_last4 = payment_result.get('card_last_4', '****')
            processor = payment_result.get('processor', 'NMI')
            
            # === 1. EMAIL al Admin ===
            if config_doc:
                from notification_service import NotificationService
                notif_service = NotificationService(config_doc)
                
                for admin in admin_users:
                    admin_email = admin.get('email')
                    if admin_email and notif_service.sendgrid_client:
                        payment_email_html = f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f5f5f5;">
                            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">💰 Pago Recibido</h1>
                                <p style="margin: 10px 0 0; font-size: 36px; font-weight: bold;">${payment_request.amount:.2f}</p>
                            </div>
                            <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; width: 40%;">Cliente:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">{client_name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Email:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">{current_user.get('email', '')}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Orden #:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #333;">{order_number}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Servicio:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">{service_type}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Tarjeta:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">****{card_last4}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Transacción:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-family: monospace; color: #333;">{txn_id}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">Procesador:</td>
                                        <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #333;">Merchant One ({processor})</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #666;">Fecha:</td>
                                        <td style="padding: 12px 0; color: #333;">{now.strftime('%d/%m/%Y %I:%M %p')} UTC</td>
                                    </tr>
                                </table>
                                <div style="margin-top: 20px; padding: 15px; background-color: #ECFDF5; border-radius: 8px; border-left: 4px solid #10B981;">
                                    <p style="margin: 0; color: #065F46; font-weight: bold;">✅ Pago procesado exitosamente</p>
                                </div>
                            </div>
                        </body>
                        </html>
                        """
                        await notif_service.send_email(
                            admin_email,
                            f"💰 Pago Recibido: ${payment_request.amount:.2f} - {client_name} (Orden #{order_number})",
                            payment_email_html
                        )
                        logging.info(f"📧 Payment email sent to admin {admin_email}")
                
                # === 2. SMS al Admin ===
                for admin in admin_users:
                    admin_phone = admin.get('phone')
                    if admin_phone and notif_service.twilio_client:
                        sms_text = (
                            f"💰 PAGO RECIBIDO\n"
                            f"Cliente: {client_name}\n"
                            f"Monto: ${payment_request.amount:.2f}\n"
                            f"Orden: #{order_number}\n"
                            f"Servicio: {service_type}\n"
                            f"Tarjeta: ****{card_last4}\n"
                            f"TXN: {txn_id}\n"
                            f"- Ross Tax"
                        )
                        await notif_service.send_sms(admin_phone, sms_text)
                        logging.info(f"📱 Payment SMS sent to admin {admin_phone}")
            
            # === 3. PUSH NOTIFICATION al Admin ===
            from push_notification_service import send_push_notification
            for admin in admin_users:
                admin_id = str(admin.get('_id', ''))
                push_token = admin.get('push_token')
                if push_token:
                    await send_push_notification(
                        expo_push_token=push_token,
                        title=f"💰 Pago Recibido: ${payment_request.amount:.2f}",
                        body=f"{client_name} pagó orden #{order_number} ({service_type})",
                        data={
                            'type': 'payment_received',
                            'order_id': order_id,
                            'amount': payment_request.amount,
                            'screen': 'service-orders'
                        }
                    )
                    logging.info(f"🔔 Payment push notification sent to admin {admin.get('email')}")
        
        except Exception as notif_error:
            # Don't fail the payment if notifications fail
            logging.error(f"⚠️ Error sending admin payment notifications: {notif_error}")
        
        # ============ FIN NOTIFICACIONES ============
        
        logging.info(f"✅ Payment processed for order {order_id}: ${payment_request.amount}")
        
        return {
            'success': True,
            'message': 'Pago procesado exitosamente',
            'payment_id': payment_result.get('payment_id'),
            'amount': payment_request.amount,
            'order_id': order_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error processing order payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== PAYMENT METHODS ENDPOINTS ==============

@passport_router.post('/payment-methods')
async def add_payment_method(
    payment_data: PaymentMethodCreate,
    request: Request
):
    current_user = await _auth_user(request)

    """Guarda un nuevo método de pago para el usuario"""
    try:
        method = await save_payment_method(_db, current_user, payment_data)
        return {'success': True, 'payment_method': method}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error saving payment method: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/payment-methods')
async def get_payment_methods(
    request: Request
):
    current_user = await _auth_user(request)

    """Obtiene los métodos de pago guardados del usuario"""
    try:
        methods = await get_user_payment_methods(_db, current_user.get('id'))
        return {'payment_methods': methods, 'count': len(methods)}
    except Exception as e:
        logging.error(f"Error getting payment methods: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.delete('/payment-methods/{method_id}')
async def delete_payment_method(
    method_id: str,
    request: Request
):
    current_user = await _auth_user(request)

    """Elimina un método de pago guardado"""
    try:
        if ObjectId.is_valid(method_id):
            result = await _db.payment_methods.update_one(
                {'_id': ObjectId(method_id), 'user_id': current_user.get('id')},
                {'$set': {'active': False, 'deleted_at': datetime.now(timezone.utc)}}
            )
        else:
            # Buscar por nmi_vault_id como fallback
            result = await _db.payment_methods.update_one(
                {'nmi_vault_id': method_id, 'user_id': current_user.get('id')},
                {'$set': {'active': False, 'deleted_at': datetime.now(timezone.utc)}}
            )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Método de pago no encontrado")
        
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting payment method: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@passport_router.patch('/payment-methods/{method_id}/default')
async def set_default_payment_method(
    method_id: str,
    request: Request
):
    current_user = await _auth_user(request)

    """Establece un método de pago como predeterminado"""
    try:
        user_id = current_user.get('id')
        
        # First, unset all current defaults for this user
        await _db.payment_methods.update_many(
            {'user_id': user_id},
            {'$set': {'is_default': False}}
        )
        
        # Try to find the payment method by various ID formats
        result = None
        
        # Try ObjectId
        if ObjectId.is_valid(method_id):
            result = await _db.payment_methods.update_one(
                {'_id': ObjectId(method_id), 'user_id': user_id},
                {'$set': {'is_default': True, 'active': True}}
            )
        
        # Try nmi_vault_id
        if not result or result.modified_count == 0:
            result = await _db.payment_methods.update_one(
                {'nmi_vault_id': method_id, 'user_id': user_id},
                {'$set': {'is_default': True, 'active': True}}
            )
        
        # Try string ID match
        if not result or result.modified_count == 0:
            result = await _db.payment_methods.update_one(
                {'id': method_id, 'user_id': user_id},
                {'$set': {'is_default': True, 'active': True}}
            )
        
        if not result or result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Método de pago no encontrado")
        
        logging.info(f"✅ Default payment method set to {method_id} for user {user_id}")
        return {'success': True, 'message': 'Método de pago predeterminado actualizado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error setting default payment method: {e}")
        raise HTTPException(status_code=500, detail=str(e))




print("🛒 Dynamic Services & Orders endpoints initialized")


# ============== ADMIN PAYMENT METHODS (TARJETAS) ENDPOINTS ==============

@passport_router.get('/payments/admin/encrypted-cards')
async def get_admin_encrypted_cards(
    request: Request,

    search: Optional[str] = None

):
    """Get all saved payment methods for admin view (encrypted data only)"""
    try:
        query = {'active': {'$ne': False}}
        if search:
            query['$or'] = [
                {'cardholder_name': {'$regex': search, '$options': 'i'}},
                {'user_email': {'$regex': search, '$options': 'i'}},
                {'last4': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get payment methods with user info
        cards = await _db.payment_methods.find(query).sort('created_at', -1).to_list(500)
        
        result = []
        for card in cards:
            # Get user info
            user_info = {}
            if card.get('user_id'):
                user = await _db.users.find_one({'_id': ObjectId(card['user_id'])}) if ObjectId.is_valid(card['user_id']) else None
                if not user:
                    user = await _db.users.find_one({'id': card['user_id']})
                if user:
                    user_info = {
                        'user_name': user.get('full_name', user.get('name', 'Sin nombre')),
                        'user_email': user.get('email', '')
                    }
            
            result.append({
                'id': str(card.get('_id', card.get('id', ''))),
                'user_id': card.get('user_id', ''),
                'user_name': user_info.get('user_name', card.get('cardholder_name', 'Sin nombre')),
                'user_email': user_info.get('user_email', card.get('user_email', '')),
                'last4': card.get('last4', card.get('card_number', '')[-4:] if card.get('card_number') else '****'),
                'brand': card.get('brand', card.get('card_brand', 'Unknown')),
                'exp_month': card.get('exp_month', ''),
                'exp_year': card.get('exp_year', ''),
                'cardholder_name': card.get('cardholder_name', ''),
                'created_at': card.get('created_at').isoformat() if card.get('created_at') else '',
                'is_encrypted': bool(card.get('encrypted_number') or card.get('encrypted_cvv')),
                'has_address': bool(card.get('billing_address') or card.get('address'))
            })
        
        return {'cards': result, 'count': len(result)}
    except Exception as e:
        logging.error(f"Error getting admin cards: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/payments/admin/encrypted-cards/{card_id}')
async def get_admin_card_details(
    card_id: str,
    request: Request
):
    """Get encrypted card summary (admin only) - does NOT return decrypted data"""
    try:
        card = None
        if ObjectId.is_valid(card_id):
            card = await _db.payment_methods.find_one({'_id': ObjectId(card_id)})
        if not card:
            card = await _db.payment_methods.find_one({'id': card_id})
        
        if not card:
            raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
        
        # Get user info
        user_info = {}
        if card.get('user_id'):
            user = await _db.users.find_one({'_id': ObjectId(card['user_id'])}) if ObjectId.is_valid(card['user_id']) else None
            if not user:
                user = await _db.users.find_one({'id': card['user_id']})
            if user:
                user_info = {
                    'user_name': user.get('full_name', user.get('name', '')),
                    'user_email': user.get('email', ''),
                    'user_phone': user.get('phone', '')
                }
        
        result = {
            'id': str(card.get('_id', card.get('id', ''))),
            'user_id': card.get('user_id', ''),
            'user_name': user_info.get('user_name', card.get('cardholder_name', '')),
            'user_email': user_info.get('user_email', ''),
            'user_phone': user_info.get('user_phone', ''),
            'cardholder_name': card.get('cardholder_name', ''),
            'card_number': f"****-****-****-{card.get('last4', '****')}",
            'last4': card.get('last4', ''),
            'brand': card.get('brand', card.get('card_brand', 'Unknown')),
            'exp_month': card.get('exp_month', ''),
            'exp_year': card.get('exp_year', ''),
            'cvv': '***',
            'has_encrypted_data': bool(card.get('encrypted_number')),
            'billing_address': card.get('billing_address', card.get('address', {})),
            'created_at': card.get('created_at').isoformat() if card.get('created_at') else '',
        }
        
        return {'card': result}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting card details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class AdminDecryptRequest(BaseModel):
    security_pin: str


@passport_router.post('/payments/admin/encrypted-cards/{card_id}/decrypt')
async def decrypt_admin_card(
    card_id: str,
    pin_data: AdminDecryptRequest,
    request: Request
):
    current_user = await _require_admin(request)

    """
    Decrypt full card data - requires admin security PIN.
    Each access is logged in security_audit for compliance.
    """
    try:
        # Verify admin security PIN
        admin_settings = await _db.admin_security_settings.find_one({'admin_id': current_user.get('id')})
        if not admin_settings or not admin_settings.get('security_pin_hash'):
            # Check if a global PIN exists
            global_pin = await _db.admin_security_settings.find_one({'type': 'global_pin'})
            if not global_pin or not global_pin.get('security_pin_hash'):
                raise HTTPException(status_code=403, detail="No has configurado tu PIN de seguridad. Ve a Configuración para establecerlo.")
            admin_settings = global_pin
        
        pin_valid = pwd_context.verify(pin_data.security_pin, admin_settings['security_pin_hash'])
        
        if not pin_valid:
            # Log failed attempt
            await _db.security_audit.insert_one({
                'action': 'decrypt_card_FAILED_PIN',
                'card_id': card_id,
                'admin_id': current_user.get('id'),
                'admin_email': current_user.get('email'),
                'timestamp': datetime.now(timezone.utc),
            })
            raise HTTPException(status_code=403, detail="PIN de seguridad incorrecto")
        
        # Find the card - try multiple lookup strategies
        card = None
        if ObjectId.is_valid(card_id):
            card = await _db.payment_methods.find_one({'_id': ObjectId(card_id)})
        if not card:
            card = await _db.payment_methods.find_one({'id': card_id})
        if not card:
            card = await _db.payment_methods.find_one({'nmi_vault_id': card_id})
        if not card:
            # Try string match on _id for cases where _id was stored as string
            card = await _db.payment_methods.find_one({'_id': card_id})
        
        if not card:
            raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
        
        # Log successful decrypt access
        await _db.security_audit.insert_one({
            'action': 'decrypt_card_SUCCESS',
            'card_id': card_id,
            'admin_id': current_user.get('id'),
            'admin_email': current_user.get('email'),
            'timestamp': datetime.now(timezone.utc),
        })
        
        # Decrypt card data
        card_number = ''
        cvv = ''
        
        if card.get('encrypted_number'):
            try:
                from encryption_service import get_encryption_service
                enc_svc = get_encryption_service()
                card_number = enc_svc.decrypt(card['encrypted_number'])
            except Exception as dec_err:
                logging.error(f"Decryption error: {dec_err}")
                card_number = f"****-****-****-{card.get('last4', '****')}"
        else:
            card_number = card.get('card_number', f"****-****-****-{card.get('last4', '****')}")
        
        if card.get('encrypted_cvv'):
            try:
                from encryption_service import get_encryption_service
                enc_svc = get_encryption_service()
                cvv = enc_svc.decrypt(card['encrypted_cvv'])
            except Exception as dec_err:
                logging.error(f"CVV Decryption error: {dec_err}")
                cvv = '***'
        else:
            cvv = card.get('cvv', '***')
        
        # Get user info
        user_info = {}
        if card.get('user_id'):
            user = await _db.users.find_one({'_id': ObjectId(card['user_id'])}) if ObjectId.is_valid(card['user_id']) else None
            if not user:
                user = await _db.users.find_one({'id': card['user_id']})
            if user:
                user_info = {
                    'user_name': user.get('full_name', user.get('name', '')),
                    'user_email': user.get('email', ''),
                    'user_phone': user.get('phone', '')
                }
        
        result = {
            'id': str(card.get('_id', card.get('id', ''))),
            'user_id': card.get('user_id', ''),
            'user_name': user_info.get('user_name', card.get('cardholder_name', '')),
            'user_email': user_info.get('user_email', ''),
            'user_phone': user_info.get('user_phone', ''),
            'cardholder_name': card.get('cardholder_name', ''),
            'card_number': card_number or f"****-****-****-{card.get('last4', '****')}",
            'last4': card.get('last4', ''),
            'brand': card.get('brand', card.get('card_brand', 'Unknown')),
            'exp_month': card.get('exp_month', ''),
            'exp_year': card.get('exp_year', ''),
            'cvv': cvv or '***',
            'nmi_vault_id': card.get('nmi_vault_id', ''),
            'billing_address': card.get('billing_address', card.get('address', {})),
            'created_at': card.get('created_at').isoformat() if card.get('created_at') else '',
        }
        
        logging.info(f"🔐 Admin {current_user.get('email')} DECRYPTED card {card_id} (PIN verified)")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error decrypting card: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== ADMIN SECURITY PIN ==============

class SetSecurityPinRequest(BaseModel):
    new_pin: str
    current_password: str


@passport_router.post('/admin/security-pin')
async def set_admin_security_pin(
    pin_data: SetSecurityPinRequest,
    request: Request
):
    current_user = await _require_admin(request)

    """Set or update the admin security PIN for sensitive operations"""
    try:
        # Validate PIN format (4-8 digits)
        if not pin_data.new_pin.isdigit() or len(pin_data.new_pin) < 4 or len(pin_data.new_pin) > 8:
            raise HTTPException(status_code=400, detail="El PIN debe ser de 4 a 8 dígitos numéricos")
        
        # Verify current admin password first
        admin_user = await _db.users.find_one({'email': current_user.get('email')})
        if not admin_user:
            raise HTTPException(status_code=404, detail="Admin no encontrado")
        
        stored_hash = admin_user.get('password_hash', admin_user.get('password', ''))
        password_valid = pwd_context.verify(pin_data.current_password, stored_hash)
        if not password_valid:
            raise HTTPException(status_code=403, detail="Contraseña de administrador incorrecta")
        
        # Hash the new PIN using pwd_context (same as passwords)
        pin_hash = pwd_context.hash(pin_data.new_pin)
        
        # Save PIN (upsert)
        await _db.admin_security_settings.update_one(
            {'admin_id': current_user.get('id')},
            {'$set': {
                'admin_id': current_user.get('id'),
                'admin_email': current_user.get('email'),
                'security_pin_hash': pin_hash,
                'updated_at': datetime.now(timezone.utc),
            }},
            upsert=True
        )
        
        # Also save as global PIN for this admin
        await _db.admin_security_settings.update_one(
            {'type': 'global_pin'},
            {'$set': {
                'type': 'global_pin',
                'security_pin_hash': pin_hash,
                'set_by': current_user.get('email'),
                'updated_at': datetime.now(timezone.utc),
            }},
            upsert=True
        )
        
        logging.info(f"🔐 Admin {current_user.get('email')} set new security PIN")
        
        return {'success': True, 'message': 'PIN de seguridad actualizado correctamente'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error setting security PIN: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.get('/admin/security-pin/status')
async def check_security_pin_status(
    request: Request
):
    current_user = await _require_admin(request)

    """Check if admin has set a security PIN"""
    try:
        admin_settings = await _db.admin_security_settings.find_one({'admin_id': current_user.get('id')})
        if not admin_settings:
            admin_settings = await _db.admin_security_settings.find_one({'type': 'global_pin'})
        
        has_pin = bool(admin_settings and admin_settings.get('security_pin_hash'))
        
        return {
            'has_pin': has_pin,
            'set_by': admin_settings.get('set_by', admin_settings.get('admin_email', '')) if admin_settings else '',
            'updated_at': admin_settings.get('updated_at').isoformat() if admin_settings and admin_settings.get('updated_at') else ''
        }
    except Exception as e:
        logging.error(f"Error checking PIN status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@passport_router.delete('/payments/admin/encrypted-cards/{card_id}')
async def admin_delete_card(
    card_id: str,
    request: Request
):
    current_user = await _require_admin(request)

    """Delete a saved card (admin only)"""
    try:
        # Log the deletion
        await _db.security_audit.insert_one({
            'action': 'delete_card',
            'card_id': card_id,
            'admin_id': current_user.get('id'),
            'admin_email': current_user.get('email'),
            'timestamp': datetime.now(timezone.utc)
        })
        
        # Soft delete the card
        result = None
        if ObjectId.is_valid(card_id):
            result = await _db.payment_methods.update_one(
                {'_id': ObjectId(card_id)},
                {'$set': {'active': False, 'deleted_at': datetime.now(timezone.utc), 'deleted_by': current_user.get('email')}}
            )
        if not result or result.modified_count == 0:
            result = await _db.payment_methods.update_one(
                {'id': card_id},
                {'$set': {'active': False, 'deleted_at': datetime.now(timezone.utc), 'deleted_by': current_user.get('email')}}
            )
        
        if not result or result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Tarjeta no encontrada")
        
        logging.info(f"🗑️ Admin {current_user.get('email')} deleted card {card_id}")
        
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting card: {e}")
        raise HTTPException(status_code=500, detail=str(e))


