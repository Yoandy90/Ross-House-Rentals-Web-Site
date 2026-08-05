#!/usr/bin/env python3
"""
Create sample pricing plans for testing
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys
sys.path.append('/app/backend')

from payment_models import PricingPlan, BillingInterval
from payment_service import get_stripe_service
from datetime import datetime
import uuid

async def create_sample_plans():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Initialize Stripe service
    stripe_service = get_stripe_service(db)
    await stripe_service.initialize()
    
    if not stripe_service.initialized:
        print("❌ Stripe no está inicializado. Verifica el API key.")
        return
    
    print("✅ Stripe inicializado correctamente")
    
    # Define sample plans
    plans_data = [
        {
            "name": "Plan Básico Semanal",
            "description": "Servicio básico de preparación de impuestos con soporte semanal",
            "price": 19.99,
            "interval": BillingInterval.WEEKLY,
            "features": [
                "Preparación de declaración básica",
                "Soporte por email",
                "1 revisión incluida"
            ]
        },
        {
            "name": "Plan Profesional Quincenal",
            "description": "Servicio completo con asesoría quincenal personalizada",
            "price": 49.99,
            "interval": BillingInterval.BIWEEKLY,
            "features": [
                "Preparación completa de impuestos",
                "Asesoría personalizada",
                "Revisiones ilimitadas",
                "Documentos organizados",
                "Soporte prioritario"
            ]
        },
        {
            "name": "Plan Estándar Mensual",
            "description": "Gestión mensual completa de documentación fiscal",
            "price": 79.99,
            "interval": BillingInterval.MONTHLY,
            "features": [
                "Todo en Plan Profesional",
                "Planificación fiscal mensual",
                "Alertas de vencimientos",
                "Almacenamiento ilimitado"
            ]
        },
        {
            "name": "Plan Premium Anual",
            "description": "Servicio VIP anual con máximo ahorro",
            "price": 799.99,
            "interval": BillingInterval.YEARLY,
            "features": [
                "Todo incluido",
                "Asesor fiscal dedicado",
                "Planificación estratégica anual",
                "Soporte 24/7",
                "Ahorro del 25%"
            ]
        }
    ]
    
    print("\n📋 Creando planes de ejemplo...")
    
    for plan_data in plans_data:
        try:
            # Check if plan already exists
            existing = await db.pricing_plans.find_one({'name': plan_data['name']})
            if existing:
                print(f"⏭️  Plan '{plan_data['name']}' ya existe, saltando...")
                continue
            
            # Create plan object
            plan = PricingPlan(
                id=str(uuid.uuid4()),
                name=plan_data['name'],
                description=plan_data['description'],
                price=plan_data['price'],
                interval=plan_data['interval'],
                features=plan_data['features'],
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # Create in Stripe
            print(f"   Creando en Stripe: {plan.name}...")
            stripe_ids = await stripe_service.create_product_and_price(plan)
            plan.stripe_product_id = stripe_ids['product_id']
            plan.stripe_price_id = stripe_ids['price_id']
            
            # Save to database
            await db.pricing_plans.insert_one(plan.dict())
            
            print(f"✅ Plan '{plan.name}' creado exitosamente")
            print(f"   💰 ${plan.price} / {plan.interval.value}")
            print(f"   🆔 Stripe Price ID: {plan.stripe_price_id}")
            
        except Exception as e:
            print(f"❌ Error creando plan '{plan_data['name']}': {e}")
    
    print("\n✨ ¡Planes creados exitosamente!")
    
    # List all plans
    all_plans = await db.pricing_plans.find({'is_active': True}).to_list(100)
    print(f"\n📊 Total de planes activos: {len(all_plans)}")
    for p in all_plans:
        print(f"   • {p['name']} - ${p['price']} / {p['interval']}")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(create_sample_plans())
