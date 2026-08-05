"""
Script para poblar servicios y planes de suscripción
"""

import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import uuid

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'taxportal')

async def create_service_prices(db):
    """Crear precios de servicios"""
    print("💼 Creando servicios...")
    
    services = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Declaración de Impuestos Individual',
            'name_es': 'Declaración de Impuestos Individual',
            'description': 'Preparación completa de declaración de impuestos para individuos, incluye revisión de documentos y optimización de deducciones.',
            'description_es': 'Preparación completa de declaración de impuestos para individuos, incluye revisión de documentos y optimización de deducciones.',
            'price': 150,
            'category': 'tax_preparation',
            'category_es': 'Preparación de Impuestos',
            'duration_minutes': 90,
            'is_active': True,
            'icon': '📄',
            'features': [
                'Revisión de documentos W-2 y 1099',
                'Optimización de deducciones',
                'Presentación electrónica incluida',
                'Soporte post-presentación'
            ],
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Declaración de Impuestos de Negocio',
            'name_es': 'Declaración de Impuestos de Negocio',
            'description': 'Preparación de impuestos para pequeños negocios, LLC, S-Corp, incluye Schedule C y deducciones empresariales.',
            'description_es': 'Preparación de impuestos para pequeños negocios, LLC, S-Corp, incluye Schedule C y deducciones empresariales.',
            'price': 300,
            'category': 'tax_preparation',
            'category_es': 'Preparación de Impuestos',
            'duration_minutes': 120,
            'is_active': True,
            'icon': '💼',
            'features': [
                'Schedule C completo',
                'Deducciones empresariales maximizadas',
                'Análisis de gastos',
                'Planificación fiscal trimestral'
            ],
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Consulta Fiscal 1 Hora',
            'name_es': 'Consulta Fiscal 1 Hora',
            'description': 'Sesión de consulta con experto fiscal certificado para resolver dudas, planificación o revisión de situación fiscal.',
            'description_es': 'Sesión de consulta con experto fiscal certificado para resolver dudas, planificación o revisión de situación fiscal.',
            'price': 100,
            'category': 'consultation',
            'category_es': 'Consultoría',
            'duration_minutes': 60,
            'is_active': True,
            'icon': '💬',
            'features': [
                'Sesión de 1 hora con CPA',
                'Respuestas a preguntas específicas',
                'Planificación fiscal personalizada',
                'Recomendaciones escritas'
            ],
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Enmienda de Declaración',
            'name_es': 'Enmienda de Declaración',
            'description': 'Corrección y re-presentación de declaraciones de años anteriores con errores o información faltante.',
            'description_es': 'Corrección y re-presentación de declaraciones de años anteriores con errores o información faltante.',
            'price': 200,
            'category': 'amendment',
            'category_es': 'Enmiendas',
            'duration_minutes': 90,
            'is_active': True,
            'icon': '📝',
            'features': [
                'Revisión de declaración original',
                'Preparación de Form 1040-X',
                'Presentación electrónica',
                'Seguimiento con IRS'
            ],
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Representación ante IRS',
            'name_es': 'Representación ante IRS',
            'description': 'Representación profesional en auditorías, cartas del IRS, planes de pago y resolución de problemas fiscales.',
            'description_es': 'Representación profesional en auditorías, cartas del IRS, planes de pago y resolución de problemas fiscales.',
            'price': 400,
            'category': 'representation',
            'category_es': 'Representación',
            'duration_minutes': 180,
            'is_active': True,
            'icon': '⚖️',
            'features': [
                'Representación completa ante IRS',
                'Manejo de auditorías',
                'Negociación de planes de pago',
                'Resolución de problemas complejos'
            ],
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Planificación Fiscal Anual',
            'name_es': 'Planificación Fiscal Anual',
            'description': 'Plan fiscal completo para el año, estrategias de ahorro, estimados trimestrales y optimización de impuestos.',
            'description_es': 'Plan fiscal completo para el año, estrategias de ahorro, estimados trimestrales y optimización de impuestos.',
            'price': 250,
            'category': 'planning',
            'category_es': 'Planificación',
            'duration_minutes': 120,
            'is_active': True,
            'icon': '📊',
            'features': [
                'Análisis fiscal completo',
                'Estrategias de optimización',
                'Cálculo de pagos estimados',
                'Seguimiento trimestral'
            ],
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
    ]
    
    result = await db.service_prices.insert_many(services)
    print(f"✅ {len(result.inserted_ids)} servicios creados")
    return result.inserted_ids

async def create_subscription_plans(db):
    """Crear planes de suscripción"""
    print("📋 Creando planes de suscripción...")
    
    plans = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Plan Básico',
            'name_es': 'Plan Básico',
            'description': 'Perfecto para individuos que presentan impuestos simples',
            'description_es': 'Perfecto para individuos que presentan impuestos simples',
            'price': 29.99,
            'billing_period': 'monthly',
            'billing_period_es': 'mensual',
            'features': [
                '1 declaración de impuestos incluida',
                '10% descuento en servicios adicionales',
                'Soporte por email',
                'Acceso a recursos educativos'
            ],
            'is_active': True,
            'is_popular': False,
            'sort_order': 1,
            'credits_included': 30,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Plan Profesional',
            'name_es': 'Plan Profesional',
            'description': 'Ideal para freelancers y pequeños negocios',
            'description_es': 'Ideal para freelancers y pequeños negocios',
            'price': 59.99,
            'billing_period': 'monthly',
            'billing_period_es': 'mensual',
            'features': [
                '1 declaración individual + 1 de negocio',
                '20% descuento en servicios adicionales',
                'Consultas ilimitadas',
                'Soporte prioritario',
                'Planificación fiscal trimestral'
            ],
            'is_active': True,
            'is_popular': True,
            'sort_order': 2,
            'credits_included': 60,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Plan Premium',
            'name_es': 'Plan Premium',
            'description': 'Solución completa para negocios establecidos',
            'description_es': 'Solución completa para negocios establecidos',
            'price': 99.99,
            'billing_period': 'monthly',
            'billing_period_es': 'mensual',
            'features': [
                'Declaraciones ilimitadas',
                '30% descuento en servicios adicionales',
                'CPA dedicado',
                'Soporte 24/7',
                'Planificación fiscal completa',
                'Representación ante IRS incluida'
            ],
            'is_active': True,
            'is_popular': False,
            'sort_order': 3,
            'credits_included': 100,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
    ]
    
    result = await db.subscription_plans.insert_many(plans)
    print(f"✅ {len(result.inserted_ids)} planes de suscripción creados")
    return result.inserted_ids

async def main():
    """Función principal"""
    print("🚀 Poblando servicios y suscripciones...")
    print(f"📊 Base de datos: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        await create_service_prices(db)
        await create_subscription_plans(db)
        
        print("\n🎉 ¡Servicios y suscripciones creados exitosamente!")
        print(f"\n📋 Resumen:")
        print(f"   - Servicios: {await db.service_prices.count_documents({})}")
        print(f"   - Planes: {await db.subscription_plans.count_documents({})}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
