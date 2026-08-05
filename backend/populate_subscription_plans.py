"""
Populate production database with subscription plans
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RAILWAY_MONGO_URL = 'os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxportal')

async def populate_plans():
    """Create subscription plans for Ross Tax"""
    
    try:
        logger.info("🚀 Connecting to Railway production MongoDB...")
        
        client = AsyncIOMotorClient(RAILWAY_MONGO_URL)
        db = client.taxportal
        
        plans_collection = db.subscription_plans
        
        # Delete old plans
        await plans_collection.delete_many({})
        
        # Create subscription plans
        plans = [
            {
                '_id': str(uuid.uuid4()),
                'name': 'Plan Básico',
                'description': 'Ideal para preparación básica de impuestos',
                'price': 49.99,
                'billing_cycle': 'monthly',
                'features': [
                    'Preparación de declaración básica',
                    'Soporte por email',
                    'Acceso a calculadora de impuestos',
                    '1 consulta incluida',
                ],
                'tax_preparation_included': 1,
                'consultations_included': 1,
                'priority_support': False,
                'document_storage_gb': 5,
                'status': 'active',
                'sort_order': 1,
                'popular': False,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Plan Premium',
                'description': 'El más popular para familias y pequeños negocios',
                'price': 99.99,
                'billing_cycle': 'monthly',
                'features': [
                    'Preparación completa de impuestos',
                    'Soporte prioritario 24/7',
                    'Calculadora avanzada',
                    '3 consultas incluidas',
                    'Revisión de declaraciones anteriores',
                    'Alertas de fechas límite',
                ],
                'tax_preparation_included': 3,
                'consultations_included': 3,
                'priority_support': True,
                'document_storage_gb': 20,
                'status': 'active',
                'sort_order': 2,
                'popular': True,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Plan Anual',
                'description': 'Mejor valor - Ahorra 20% con plan anual',
                'price': 959.88,  # ~$80/mes
                'original_price': 1199.88,
                'billing_cycle': 'yearly',
                'features': [
                    'Todo lo del Plan Premium',
                    'Preparación ilimitada de impuestos',
                    'Consultas ilimitadas',
                    'Representación ante IRS',
                    'Planificación fiscal personalizada',
                    'Descuento en servicios adicionales',
                ],
                'tax_preparation_included': 999,  # Unlimited
                'consultations_included': 999,  # Unlimited
                'priority_support': True,
                'document_storage_gb': 100,
                'status': 'active',
                'sort_order': 3,
                'popular': False,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
        ]
        
        await plans_collection.insert_many(plans)
        
        logger.info(f"✅ Created {len(plans)} subscription plans")
        logger.info(f"\n{'='*60}")
        logger.info(f"📦 SUBSCRIPTION PLANS CREATED:")
        logger.info(f"{'='*60}")
        
        for plan in plans:
            logger.info(f"\n💎 {plan['name']}")
            logger.info(f"   Precio: ${plan['price']}/{'mes' if plan['billing_cycle'] == 'monthly' else 'año'}")
            logger.info(f"   Popular: {'Sí' if plan.get('popular') else 'No'}")
            logger.info(f"   Features: {len(plan['features'])} incluidas")
        
        logger.info(f"\n{'='*60}\n")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(populate_plans())
