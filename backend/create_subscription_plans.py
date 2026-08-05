"""
Script para crear los planes de suscripción en la base de datos
Ejecutar: python create_subscription_plans.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime

async def create_plans():
    # Connect to MongoDB
    mongo_url = 'mongodb://localhost:27017'
    client = AsyncIOMotorClient(mongo_url)
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    
    # Define los planes
    plans = [
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Básico Ross Tax",
            "description": "Perfecto para clientes que presentan declaraciones simples",
            "price": 29.99,
            "interval": "monthly",
            "features": [
                "Consulta telefónica ilimitada durante temporada de impuestos",
                "1 declaración federal incluida",
                "1 declaración estatal incluida",
                "Soporte vía chat en la app",
                "Acceso a recursos educativos",
                "Notificaciones de vencimientos importantes",
                "Almacenamiento seguro de documentos (hasta 50 archivos)"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Básico Anual",
            "description": "Plan Básico con pago anual (ahorra $60)",
            "price": 299.00,
            "interval": "yearly",
            "features": [
                "Consulta telefónica ilimitada durante temporada de impuestos",
                "1 declaración federal incluida",
                "1 declaración estatal incluida",
                "Soporte vía chat en la app",
                "Acceso a recursos educativos",
                "Notificaciones de vencimientos importantes",
                "Almacenamiento seguro de documentos (hasta 50 archivos)",
                "Ahorro de $60 vs plan mensual"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Estándar Ross Tax",
            "description": "Ideal para trabajadores independientes y pequeños negocios (MÁS POPULAR)",
            "price": 59.99,
            "interval": "monthly",
            "features": [
                "Todo lo del Plan Básico",
                "2 declaraciones federales incluidas",
                "2 declaraciones estatales incluidas",
                "Planificación fiscal trimestral",
                "Soporte prioritario (respuesta en 24 horas)",
                "Deducciones para trabajadores independientes",
                "Preparación de 1099 y Schedule C",
                "Almacenamiento ilimitado de documentos",
                "10% de descuento en servicios adicionales",
                "Recordatorios de pagos estimados trimestrales"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Estándar Anual",
            "description": "Plan Estándar con pago anual (ahorra $120)",
            "price": 599.00,
            "interval": "yearly",
            "features": [
                "Todo lo del Plan Básico",
                "2 declaraciones federales incluidas",
                "2 declaraciones estatales incluidas",
                "Planificación fiscal trimestral",
                "Soporte prioritario (respuesta en 24 horas)",
                "Deducciones para trabajadores independientes",
                "Preparación de 1099 y Schedule C",
                "Almacenamiento ilimitado de documentos",
                "10% de descuento en servicios adicionales",
                "Recordatorios de pagos estimados trimestrales",
                "Ahorro de $120 vs plan mensual"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Premium Ross Tax",
            "description": "Solución completa para negocios y situaciones fiscales complejas",
            "price": 99.99,
            "interval": "monthly",
            "features": [
                "Todo lo del Plan Estándar",
                "Declaraciones ilimitadas (federal y estatal)",
                "Representación ante IRS incluida",
                "Planificación fiscal personalizada mensual",
                "Preparación de impuestos corporativos (LLC, S-Corp, C-Corp)",
                "Soporte VIP (respuesta inmediata)",
                "Consultor fiscal dedicado",
                "Revisión de declaraciones pasadas (últimos 3 años)",
                "20% de descuento en todos los servicios adicionales",
                "Preparación de nómina (hasta 5 empleados)",
                "Acceso prioritario a citas presenciales"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Premium Anual",
            "description": "Plan Premium con pago anual (ahorra $200)",
            "price": 999.00,
            "interval": "yearly",
            "features": [
                "Todo lo del Plan Estándar",
                "Declaraciones ilimitadas (federal y estatal)",
                "Representación ante IRS incluida",
                "Planificación fiscal personalizada mensual",
                "Preparación de impuestos corporativos (LLC, S-Corp, C-Corp)",
                "Soporte VIP (respuesta inmediata)",
                "Consultor fiscal dedicado",
                "Revisión de declaraciones pasadas (últimos 3 años)",
                "20% de descuento en todos los servicios adicionales",
                "Preparación de nómina (hasta 5 empleados)",
                "Acceso prioritario a citas presenciales",
                "Ahorro de $200 vs plan mensual"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Empresarial Ross Tax",
            "description": "Solución integral para negocios establecidos con múltiples empleados",
            "price": 199.99,
            "interval": "monthly",
            "features": [
                "Todo lo del Plan Premium",
                "Servicios de contabilidad mensual",
                "Preparación de nómina ilimitada",
                "Gestión de cuentas por pagar/cobrar",
                "Estados financieros trimestrales",
                "Soporte para auditorías",
                "30% de descuento en todos los servicios adicionales",
                "Capacitación en manejo de registros contables",
                "Software de contabilidad incluido (QuickBooks)",
                "Reuniones presenciales mensuales",
                "Planificación de sucesión empresarial"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Empresarial Anual",
            "description": "Plan Empresarial con pago anual (ahorra $400)",
            "price": 1999.00,
            "interval": "yearly",
            "features": [
                "Todo lo del Plan Premium",
                "Servicios de contabilidad mensual",
                "Preparación de nómina ilimitada",
                "Gestión de cuentas por pagar/cobrar",
                "Estados financieros trimestrales",
                "Soporte para auditorías",
                "30% de descuento en todos los servicios adicionales",
                "Capacitación en manejo de registros contables",
                "Software de contabilidad incluido (QuickBooks)",
                "Reuniones presenciales mensuales",
                "Planificación de sucesión empresarial",
                "Ahorro de $400 vs plan mensual"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Facilito (Quincenal)",
            "description": "Pagos más pequeños sincronizados con tu nómina quincenal",
            "price": 29.99,
            "interval": "biweekly",
            "features": [
                "Equivalente al Plan Básico",
                "Consulta telefónica ilimitada durante temporada",
                "1 declaración federal incluida",
                "1 declaración estatal incluida",
                "Soporte vía chat en la app",
                "Pagos cada 15 días (~$60/mes)",
                "Perfecto para presupuestos ajustados",
                "Sin compromiso anual"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Plan Super Facilito (Semanal)",
            "description": "Pagos semanales ultra-flexibles",
            "price": 14.99,
            "interval": "weekly",
            "features": [
                "Equivalente al Plan Básico",
                "Consulta telefónica ilimitada durante temporada",
                "1 declaración federal incluida",
                "1 declaración estatal incluida",
                "Soporte vía chat en la app",
                "Pagos cada 7 días (~$60/mes)",
                "Máxima flexibilidad",
                "Ideal para ingresos semanales"
            ],
            "is_active": True,
            "stripe_price_id": None,
            "stripe_product_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    print("🚀 Creando planes de suscripción en MongoDB...")
    print()
    
    # Borrar planes existentes (opcional - comenta si no quieres borrar)
    deleted = await db.pricing_plans.delete_many({})
    print(f"🗑️  Planes existentes eliminados: {deleted.deleted_count}")
    print()
    
    # Insertar nuevos planes
    result = await db.pricing_plans.insert_many(plans)
    
    print(f"✅ {len(result.inserted_ids)} planes creados exitosamente!")
    print()
    print("📋 Planes creados:")
    print()
    
    for plan in plans:
        print(f"   • {plan['name']}")
        print(f"     Precio: ${plan['price']}")
        print(f"     Intervalo: {plan['interval']}")
        print(f"     Características: {len(plan['features'])} incluidas")
        print()
    
    # Estadísticas
    monthly_plans = [p for p in plans if p['interval'] == 'monthly']
    yearly_plans = [p for p in plans if p['interval'] == 'yearly']
    biweekly_plans = [p for p in plans if p['interval'] == 'biweekly']
    weekly_plans = [p for p in plans if p['interval'] == 'weekly']
    
    print("📊 Resumen:")
    print(f"   Total de planes: {len(plans)}")
    print(f"   Planes mensuales: {len(monthly_plans)}")
    print(f"   Planes anuales: {len(yearly_plans)}")
    print(f"   Planes quincenales: {len(biweekly_plans)}")
    print(f"   Planes semanales: {len(weekly_plans)}")
    print()
    print("💡 Nota: Los planes están listos para usar en la app.")
    print("💡 Los IDs de Stripe se generarán automáticamente cuando un cliente se suscriba.")
    print()
    
    client.close()

if __name__ == "__main__":
    print()
    print("=" * 60)
    print("  CREACIÓN DE PLANES DE SUSCRIPCIÓN - ROSS TAX PREPARATION")
    print("=" * 60)
    print()
    asyncio.run(create_plans())
    print("=" * 60)
    print()
