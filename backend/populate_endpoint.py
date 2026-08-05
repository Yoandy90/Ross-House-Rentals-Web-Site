"""
Endpoint para poblar la base de datos de producción con juegos
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta, timezone
import uuid

populate_router = APIRouter()

@populate_router.post('/admin/populate-games')
async def populate_games_endpoint():
    """Poblar base de datos con sorteos, loterías y raspaditos"""
    from server import db
    
    try:
        # Contar juegos existentes
        existing_raffles = await db.raffles.count_documents({})
        existing_lotteries = await db.lotteries.count_documents({})
        
        if existing_raffles > 20:
            return {
                'success': True,
                'message': 'Ya existen juegos en la base de datos',
                'raffles': existing_raffles,
                'lotteries': existing_lotteries
            }
        
        # SORTEOS DE PRODUCTOS
        raffles = [
            {
                'title': '🚴 Bicicleta de Montaña Trek',
                'description': '¡Gana una increíble bicicleta de montaña Trek Marlin 7! Perfecta para aventuras al aire libre.',
                'prize_type': 'product',
                'prize_value': 'Bicicleta Trek Marlin 7 (valor $800)',
                'prize_credits': None,
                'ticket_price': 8,
                'max_tickets_per_user': 10,
                'total_tickets': 250,
                'end_date': datetime.now(timezone.utc) + timedelta(days=25),
                'image_url': 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800&q=80',
                'status': 'active',
                'tickets_sold': 0,
                'participants': [],
                'winner_id': None,
                'winner_name': None,
                'draw_date': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'terms': 'Bicicleta nueva en caja. Entrega en oficina o envío gratis.'
            },
            {
                'title': '📺 Smart TV Samsung 55" 4K',
                'description': 'Smart TV Samsung Crystal UHD 55 pulgadas con resolución 4K.',
                'prize_type': 'product',
                'prize_value': 'Samsung Smart TV 55" 4K (valor $650)',
                'prize_credits': None,
                'ticket_price': 7,
                'max_tickets_per_user': 15,
                'total_tickets': 300,
                'end_date': datetime.now(timezone.utc) + timedelta(days=35),
                'image_url': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
                'status': 'active',
                'tickets_sold': 0,
                'participants': [],
                'winner_id': None,
                'winner_name': None,
                'draw_date': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'terms': 'TV nueva sellada con garantía.'
            },
            {
                'title': '💻 Laptop Dell Inspiron 15',
                'description': 'Laptop Dell Inspiron 15 con Intel Core i7, 16GB RAM, 512GB SSD.',
                'prize_type': 'product',
                'prize_value': 'Dell Inspiron 15 - Core i7 (valor $900)',
                'prize_credits': None,
                'ticket_price': 9,
                'max_tickets_per_user': 10,
                'total_tickets': 280,
                'end_date': datetime.now(timezone.utc) + timedelta(days=32),
                'image_url': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
                'status': 'active',
                'tickets_sold': 0,
                'participants': [],
                'winner_id': None,
                'winner_name': None,
                'draw_date': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'terms': 'Laptop nueva en caja con Windows 11.'
            },
            {
                'title': '🎮 PlayStation 5 + 3 Juegos',
                'description': 'PlayStation 5 con 2 controles y 3 juegos AAA incluidos.',
                'prize_type': 'product',
                'prize_value': 'PS5 + 2 Controles + 3 Juegos (valor $700)',
                'prize_credits': None,
                'ticket_price': 7,
                'max_tickets_per_user': 15,
                'total_tickets': 320,
                'end_date': datetime.now(timezone.utc) + timedelta(days=22),
                'image_url': 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80',
                'status': 'active',
                'tickets_sold': 0,
                'participants': [],
                'winner_id': None,
                'winner_name': None,
                'draw_date': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'terms': 'PlayStation 5 nueva sellada.'
            },
            {
                'title': '🎁 Gran Sorteo - $500 Créditos',
                'description': '¡Gana $500 en créditos para tus servicios de impuestos!',
                'prize_type': 'credits',
                'prize_value': '$500 en Créditos Ross Tax',
                'prize_credits': 500,
                'ticket_price': 5,
                'max_tickets_per_user': 10,
                'total_tickets': 200,
                'end_date': datetime.now(timezone.utc) + timedelta(days=30),
                'image_url': 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800',
                'status': 'active',
                'tickets_sold': 0,
                'participants': [],
                'winner_id': None,
                'winner_name': None,
                'draw_date': None,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'terms': 'Ganador seleccionado aleatoriamente.'
            }
        ]
        
        # Insertar sorteos
        await db.raffles.insert_many(raffles)
        
        # LOTERÍAS
        lotteries = [
            {
                'title': '🔢 La Bolita Cubana Diaria',
                'description': 'Juega a la tradicional Bolita Cubana. Elige tu número de la suerte del 00 al 99 y gana hasta 80 veces tu apuesta.',
                'lottery_type': 'bolita',
                'prize_type': 'credits',
                'prize_value': 'Hasta 80x tu apuesta',
                'prize_credits': 160,
                'prize_pool': 160,
                'ticket_price': 2,
                'entry_cost': 2,
                'participants_count': 0,
                'numbers_to_pick': 1,
                'number_range_min': 0,
                'number_range_max': 99,
                'draw_frequency': 'daily',
                'next_draw': datetime.now(timezone.utc) + timedelta(hours=12),
                'status': 'active',
                'is_active': True,
                'total_pot': 0,
                'tickets_sold': 0,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'rules': ['Selecciona un número del 00 al 99', 'Si tu número coincide con el sorteo, ganas 80 veces tu apuesta', 'Sorteo diario a las 8 PM']
            }
        ]
        
        # Insertar loterías
        await db.lotteries.insert_many(lotteries)
        
        # RASPADITOS
        scratch_cards = [
            {
                'title': '💰 Raspadito Millonario',
                'description': '¡Raspa y gana al instante! Premios desde $10 hasta $1,000.',
                'lottery_type': 'scratch_card',
                'prize_type': 'credits',
                'prize_value': 'Hasta $1,000',
                'prize_credits': 1000,
                'ticket_price': 5,
                'win_probability': 0.25,
                'possible_prizes': [10, 25, 50, 100, 250, 500, 1000],
                'status': 'active',
                'is_active': True,
                'tickets_sold': 0,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'rules': '1 de cada 4 raspaditos gana un premio.'
            },
            {
                'title': '🍀 Raspadito de la Suerte',
                'description': 'Raspadito económico con premios garantizados.',
                'lottery_type': 'scratch_card',
                'prize_type': 'credits',
                'prize_value': 'Hasta $100',
                'prize_credits': 100,
                'ticket_price': 2,
                'win_probability': 0.30,
                'possible_prizes': [5, 10, 20, 50, 100],
                'status': 'active',
                'is_active': True,
                'tickets_sold': 0,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'rules': 'Premios pequeños pero más probabilidades.'
            }
        ]
        
        await db.lotteries.insert_many(scratch_cards)
        
        # Contar totales
        total_raffles = await db.raffles.count_documents({})
        total_lotteries = await db.lotteries.count_documents({'lottery_type': {'$ne': 'scratch_card'}})
        total_scratch = await db.lotteries.count_documents({'lottery_type': 'scratch_card'})
        
        return {
            'success': True,
            'message': 'Juegos poblados exitosamente',
            'raffles_created': len(raffles),
            'lotteries_created': len(lotteries),
            'scratch_cards_created': len(scratch_cards),
            'totals': {
                'raffles': total_raffles,
                'lotteries': total_lotteries,
                'scratch_cards': total_scratch
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@populate_router.get('/admin/games-count')
async def get_games_count():
    """Ver cantidad de juegos en la base de datos"""
    from server import db
    
    try:
        raffles = await db.raffles.count_documents({})
        lotteries = await db.lotteries.count_documents({'lottery_type': {'$ne': 'scratch_card'}})
        scratch = await db.lotteries.count_documents({'lottery_type': 'scratch_card'})
        
        return {
            'success': True,
            'counts': {
                'raffles': raffles,
                'lotteries': lotteries,
                'scratch_cards': scratch,
                'total': raffles + lotteries + scratch
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@populate_router.post('/admin/populate-services')
async def populate_services():
    """Poblar servicios y suscripciones en producción"""
    from server import db
    import uuid
    
    try:
        # Crear servicios
        services = [
            {
                'id': str(uuid.uuid4()),
                'name': 'Declaración de Impuestos Individual',
                'name_es': 'Declaración de Impuestos Individual',
                'description': 'Preparación completa de declaración de impuestos para individuos.',
                'description_es': 'Preparación completa de declaración de impuestos para individuos.',
                'price': 150,
                'category': 'tax_preparation',
                'duration_minutes': 90,
                'is_active': True,
                'icon': '📄',
                'features': ['Revisión de documentos W-2 y 1099', 'Optimización de deducciones', 'Presentación electrónica incluida'],
                'created_at': datetime.now(timezone.utc)
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Declaración de Impuestos de Negocio',
                'name_es': 'Declaración de Impuestos de Negocio',
                'description': 'Preparación de impuestos para pequeños negocios, LLC, S-Corp.',
                'description_es': 'Preparación de impuestos para pequeños negocios, LLC, S-Corp.',
                'price': 300,
                'category': 'tax_preparation',
                'duration_minutes': 120,
                'is_active': True,
                'icon': '💼',
                'features': ['Schedule C completo', 'Deducciones empresariales maximizadas', 'Análisis de gastos'],
                'created_at': datetime.now(timezone.utc)
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Consulta Fiscal 1 Hora',
                'name_es': 'Consulta Fiscal 1 Hora',
                'description': 'Sesión de consulta con experto fiscal certificado.',
                'description_es': 'Sesión de consulta con experto fiscal certificado.',
                'price': 100,
                'category': 'consultation',
                'duration_minutes': 60,
                'is_active': True,
                'icon': '💬',
                'features': ['Sesión de 1 hora con CPA', 'Respuestas a preguntas específicas', 'Planificación fiscal personalizada'],
                'created_at': datetime.now(timezone.utc)
            }
        ]
        
        await db.service_prices.insert_many(services)
        
        # Crear planes de suscripción
        plans = [
            {
                'id': str(uuid.uuid4()),
                'name': 'Plan Básico',
                'description': 'Perfecto para individuos que presentan impuestos simples',
                'price': 29.99,
                'billing_period': 'monthly',
                'features': ['1 declaración incluida', '10% descuento', 'Soporte por email'],
                'is_active': True,
                'is_popular': False,
                'credits_included': 30,
                'created_at': datetime.now(timezone.utc)
            },
            {
                'id': str(uuid.uuid4()),
                'name': 'Plan Profesional',
                'description': 'Ideal para freelancers y pequeños negocios',
                'price': 59.99,
                'billing_period': 'monthly',
                'features': ['1 individual + 1 negocio', '20% descuento', 'Consultas ilimitadas', 'Soporte prioritario'],
                'is_active': True,
                'is_popular': True,
                'credits_included': 60,
                'created_at': datetime.now(timezone.utc)
            }
        ]
        
        await db.subscription_plans.insert_many(plans)
        
        return {
            'success': True,
            'message': 'Servicios y suscripciones poblados',
            'services_created': len(services),
            'plans_created': len(plans)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@populate_router.post('/admin/fix-bolita')
async def fix_bolita():
    """Eliminar y recrear La Bolita Cubana con campos correctos"""
    from server import db
    
    try:
        # Eliminar La Bolita Cubana actual
        deleted = await db.lotteries.delete_many({'lottery_type': 'bolita'})
        
        # Crear nueva con todos los campos requeridos
        bolita = {
            'title': '🔢 La Bolita Cubana Diaria',
            'description': 'Juega a la tradicional Bolita Cubana. Elige tu número de la suerte del 00 al 99 y gana hasta 80 veces tu apuesta.',
            'lottery_type': 'bolita',
            'prize_type': 'credits',
            'prize_value': 'Hasta 80x tu apuesta',
            'prize_credits': 160,
            'prize_pool': 160,
            'ticket_price': 2,
            'entry_cost': 2,
            'participants_count': 0,
            'numbers_to_pick': 1,
            'number_range_min': 0,
            'number_range_max': 99,
            'draw_frequency': 'daily',
            'next_draw': datetime.now(timezone.utc) + timedelta(hours=12),
            'status': 'active',
            'is_active': True,
            'total_pot': 0,
            'tickets_sold': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'rules': ['Selecciona un número del 00 al 99', 'Si tu número coincide con el sorteo, ganas 80 veces tu apuesta', 'Sorteo diario a las 8 PM']
        }
        
        result = await db.lotteries.insert_one(bolita)
        
        return {
            'success': True,
            'message': 'La Bolita Cubana actualizada correctamente',
            'deleted_count': deleted.deleted_count,
            'new_id': str(result.inserted_id)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@populate_router.post('/admin/add-raffle-images')
async def add_raffle_images_endpoint():
    """Agregar múltiples imágenes a los sorteos de productos"""
    from server import db
    
    # Imágenes para cada producto
    PRODUCT_IMAGES = {
        "🚴 Bicicleta de Montaña Trek": [
            "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800",
            "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=800",
            "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800",
        ],
        "🏆 Mega Premio - iPhone 15 Pro": [
            "https://images.unsplash.com/photo-1696446702183-cbd2cb4c46f0?w=800",
            "https://images.unsplash.com/photo-1695048064860-20bc6fdcc105?w=800",
            "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800",
        ],
        "📺 Smart TV Samsung 55\" 4K": [
            "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
            "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800",
            "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
        ],
        "🍳 Cocina de Gas Whirlpool": [
            "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
            "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800",
            "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800",
        ],
        "❄️ Refrigerador Samsung French Door": [
            "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800",
            "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800",
            "https://images.unsplash.com/photo-1571175351749-61b1d79ba7e1?w=800",
        ],
        "💻 Laptop Dell Inspiron 15": [
            "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800",
            "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800",
            "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800",
        ],
        "🎮 PlayStation 5 + 3 Juegos": [
            "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800",
            "https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=800",
            "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800",
        ],
        "⌚ Apple Watch Series 9": [
            "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800",
            "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=800",
            "https://images.unsplash.com/photo-1510017098667-27dfc7150acb?w=800",
        ],
        "🎧 AirPods Pro + HomePod Mini": [
            "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800",
            "https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800",
            "https://images.unsplash.com/photo-1625323062545-e90c0c8e2c20?w=800",
        ],
        "🏠 Aspiradora Robot iRobot Roomba": [
            "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800",
            "https://images.unsplash.com/photo-1623050958582-bb72af90e87a?w=800",
            "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800",
        ],
        "🏋️ Kit Completo de Gimnasio en Casa": [
            "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800",
            "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
            "https://images.unsplash.com/photo-1623874228601-f4193c7b1818?w=800",
        ],
        "📷 Cámara Canon EOS Rebel T7i": [
            "https://images.unsplash.com/photo-1606980707891-1621c05604d7?w=800",
            "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800",
            "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800",
        ],
        "☕ Cafetera Espresso Nespresso": [
            "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800",
            "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800",
            "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
        ],
    }
    
    try:
        raffles = await db.raffles.find({'prize_type': 'product'}).to_list(100)
        updated_count = 0
        
        for raffle in raffles:
            raffle_title = raffle.get('title', '')
            
            if raffle_title in PRODUCT_IMAGES:
                images = PRODUCT_IMAGES[raffle_title]
                result = await db.raffles.update_one(
                    {'_id': raffle['_id']},
                    {'$set': {'images': images}}
                )
                
                if result.modified_count > 0:
                    updated_count += 1
        
        return {
            'success': True,
            'message': f'Actualizado {updated_count} sorteos con múltiples imágenes',
            'total_raffles': len(raffles),
            'updated': updated_count
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@populate_router.post('/admin/populate-faqs')
async def populate_faqs_endpoint():
    """Poblar base de datos con FAQs y categorías"""
    from server import db
    from faq_data import FAQ_CATEGORIES, FAQ_DATA
    
    try:
        # Verificar si ya existen categorías y FAQs en el formato correcto
        existing_faqs = await db.faqs.count_documents({})
        existing_categories = await db.faq_categories.count_documents({})
        
        # Si no hay categorías pero hay FAQs, limpiar y re-poblar
        if existing_categories == 0 and existing_faqs > 0:
            await db.faqs.delete_many({})
            existing_faqs = 0
        
        if existing_faqs > 15 and existing_categories > 0:
            return {
                'success': True,
                'message': 'Ya existen FAQs en la base de datos',
                'faqs': existing_faqs,
                'categories': existing_categories
            }
        
        # 1. Poblar categorías
        categories_inserted = 0
        for i, cat in enumerate(FAQ_CATEGORIES):
            category_data = {
                'id': cat['id'],
                'name': cat['name'],
                'name_es': cat['name_es'],
                'description': f"Questions about {cat['name']}",
                'description_es': f"Preguntas sobre {cat['name_es']}",
                'icon': cat['icon'],
                'order': i + 1,
                'active': True,
                'created_by': 'system',
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            
            # Upsert categoría
            await db.faq_categories.update_one(
                {'id': cat['id']},
                {'$set': category_data},
                upsert=True
            )
            categories_inserted += 1
        
        # 2. Poblar FAQs
        faqs_inserted = 0
        for i, faq in enumerate(FAQ_DATA):
            faq_data = {
                'id': faq['id'],
                'category_id': faq['category_id'],
                'question': faq['question'],
                'question_es': faq['question_es'],
                'answer': faq['answer'],
                'answer_es': faq['answer_es'],
                'tags': faq.get('tags', []),
                'views': faq.get('views', 0),
                'helpful_count': faq.get('helpful_count', 0),
                'not_helpful_count': faq.get('not_helpful_count', 0),
                'order': i + 1,
                'active': True,
                'created_by': 'system',
                'updated_by': 'system',
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            
            # Upsert FAQ
            await db.faqs.update_one(
                {'id': faq['id']},
                {'$set': faq_data},
                upsert=True
            )
            faqs_inserted += 1
        
        return {
            'success': True,
            'message': 'FAQs y categorías pobladas exitosamente',
            'categories_created': categories_inserted,
            'faqs_created': faqs_inserted,
            'total_categories': await db.faq_categories.count_documents({}),
            'total_faqs': await db.faqs.count_documents({})
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@populate_router.post('/admin/populate-loan-products')
async def populate_loan_products_endpoint():
    """Poblar base de datos con productos de préstamo"""
    from server import db
    import uuid
    
    try:
        # Verificar si ya existen productos
        existing_count = await db.loan_products.count_documents({})
        
        if existing_count > 0:
            return {
                'success': True,
                'message': 'Ya existen productos de préstamo en la base de datos',
                'count': existing_count
            }
        
        products = [
            {
                "id": str(uuid.uuid4()),
                "name": "Préstamo Personal Básico",
                "description": "Préstamo personal para gastos generales con aprobación rápida",
                "currency": "USD",
                "min_amount": 300.0,
                "max_amount": 3000.0,
                "term_type": "monthly",
                "term_count": 12,
                "apr": 0.24,  # 24% annual
                "opening_fee": {
                    "type": "percent",
                    "value": 2.0
                },
                "late_fee": {
                    "type": "daily_percent",
                    "value": 0.1
                },
                "grace_days": 3,
                "interest_method": "price",
                "policy": {
                    "dti_max": 0.45,
                    "score_min": 600,
                    "required_documents": ["id_front", "proof_of_income"]
                },
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "created_by": "system"
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Préstamo Express",
                "description": "Préstamo rápido a corto plazo con menos requisitos",
                "currency": "USD",
                "min_amount": 100.0,
                "max_amount": 1000.0,
                "term_type": "biweekly",
                "term_count": 12,  # 6 months
                "apr": 0.36,  # 36% annual
                "opening_fee": {
                    "type": "fixed",
                    "value": 25.0
                },
                "late_fee": {
                    "type": "daily_percent",
                    "value": 0.15
                },
                "grace_days": 2,
                "interest_method": "price",
                "policy": {
                    "dti_max": 0.50,
                    "score_min": 550,
                    "required_documents": ["id_front"]
                },
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "created_by": "system"
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Préstamo Plus",
                "description": "Préstamo de mayor monto con mejores tasas para clientes calificados",
                "currency": "USD",
                "min_amount": 2000.0,
                "max_amount": 10000.0,
                "term_type": "monthly",
                "term_count": 24,
                "apr": 0.18,  # 18% annual
                "opening_fee": {
                    "type": "percent",
                    "value": 1.5
                },
                "late_fee": {
                    "type": "daily_percent",
                    "value": 0.08
                },
                "grace_days": 5,
                "interest_method": "price",
                "policy": {
                    "dti_max": 0.40,
                    "score_min": 650,
                    "required_documents": ["id_front", "id_back", "proof_of_income", "bank_statement"]
                },
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "created_by": "system"
            }
        ]
        
        # Insert products
        result = await db.loan_products.insert_many(products)
        
        return {
            'success': True,
            'message': 'Productos de préstamo creados exitosamente',
            'count': len(result.inserted_ids),
            'products': [
                {
                    'name': p['name'],
                    'amount_range': f"${p['min_amount']}-${p['max_amount']}",
                    'apr': f"{p['apr']*100}%"
                }
                for p in products
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@populate_router.post('/admin/populate-yendo-link')
async def populate_yendo_link_endpoint():
    """Poblar link de Yendo en la base de datos"""
    from server import db
    
    try:
        # Check if link already exists
        existing = await db.affiliate_links.find_one({'service_name': 'Yendo'})
        
        if existing:
            return {
                'success': True,
                'message': 'Yendo affiliate link ya existe',
                'link_id': str(existing['_id'])
            }
        
        # Create Yendo link
        yendo_link = {
            'service_name': 'Yendo',
            'service_type': 'credit_card',
            'affiliate_url': 'https://apply.yendo.com/',
            'description_es': 'Yendo es la tarjeta de crédito respaldada por tu vehículo. Funciona como una Mastercard® normal, pero aprovecha el valor de tu auto para obtener límites más altos a tasas asequibles. Pre-aprobación en 1 minuto sin impacto en tu crédito.',
            'description_en': 'Yendo is the credit card powered by your car. It works like a regular Mastercard®, but taps into your vehicle equity to get higher limits at affordable rates. Get pre-approved in 1 minute with no impact to your credit score.',
            'benefits_es': [
                'Hasta $10,000 en crédito',
                'Pre-aprobación sin impacto en tu crédito',
                'Acepta SSN e ITIN para aplicar',
                '1.5% cashback ilimitado en todas las compras',
                'Construye tu historial crediticio reportando a las 3 agencias',
                'Todos los scores de crédito son bienvenidos',
                'Tarjeta virtual instantánea disponible',
                'Aprobación promedio de $4,400'
            ],
            'benefits_en': [
                'Up to $10,000 in credit',
                'Pre-approval with no impact to credit',
                'Accepts SSN and ITIN to apply',
                '1.5% unlimited cashback on all purchases',
                'Build credit history reporting to all 3 bureaus',
                'All credit scores welcome',
                'Instant virtual card available',
                'Average approval of $4,400'
            ],
            'requirements_es': [
                'Vehículo registrado a tu nombre',
                'Licencia de conducir válida',
                'Seguro de auto activo',
                'Ingresos verificables',
                'Cuenta bancaria activa'
            ],
            'requirements_en': [
                'Vehicle registered in your name',
                'Valid driver license',
                'Active auto insurance',
                'Verifiable income',
                'Active bank account'
            ],
            'icon_name': 'card',
            'is_active': True,
            'display_order': 1,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        result = await db.affiliate_links.insert_one(yendo_link)
        
        return {
            'success': True,
            'message': 'Yendo affiliate link creado exitosamente',
            'link_id': str(result.inserted_id),
            'service': 'Yendo Credit Card',
            'url': yendo_link['affiliate_url']
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

