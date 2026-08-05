"""
Script para inicializar precios de servicios en MongoDB
Ejecutar una vez para crear la configuración inicial
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def create_service_prices():
    """Crea la configuración inicial de precios de servicios"""
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Definir precios de servicios (en créditos) - Ross Tax Preparation
    service_prices = [
        # Declaraciones de Impuestos
        {
            '_id': 'tax_return_simple',
            'service_type': 'tax_return',
            'name': 'Declaración Simple (W-2)',
            'description': 'Para empleados con un solo W-2, sin deducciones complejas',
            'price_credits': 120.0,
            'estimated_time': '1-2 días hábiles',
            'is_active': True,
            'category': 'tax_returns',
            'icon': 'document-text',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'tax_return_standard',
            'service_type': 'tax_return',
            'name': 'Declaración Estándar',
            'description': 'Declaración federal y estatal con deducciones estándar',
            'price_credits': 180.0,
            'estimated_time': '2-3 días hábiles',
            'is_active': True,
            'category': 'tax_returns',
            'icon': 'document',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'tax_return_itemized',
            'service_type': 'tax_return',
            'name': 'Declaración con Deducciones Detalladas',
            'description': 'Incluye itemización de deducciones y créditos fiscales',
            'price_credits': 240.0,
            'estimated_time': '3-4 días hábiles',
            'is_active': True,
            'category': 'tax_returns',
            'icon': 'list',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'tax_return_complex',
            'service_type': 'tax_return',
            'name': 'Declaración Compleja',
            'description': 'Múltiples fuentes de ingreso, inversiones, propiedades de alquiler',
            'price_credits': 350.0,
            'estimated_time': '5-7 días hábiles',
            'is_active': True,
            'category': 'tax_returns',
            'icon': 'briefcase',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'business_tax_return',
            'service_type': 'business_tax',
            'name': 'Declaración de Negocio (Schedule C)',
            'description': 'Para trabajadores independientes y pequeños negocios',
            'price_credits': 280.0,
            'estimated_time': '4-5 días hábiles',
            'is_active': True,
            'category': 'business',
            'icon': 'business',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        
        # Enmiendas y Correcciones
        {
            '_id': 'amendment_simple',
            'service_type': 'amendment',
            'name': 'Enmienda Simple (1040-X)',
            'description': 'Corrección de errores menores en declaración presentada',
            'price_credits': 100.0,
            'estimated_time': '2-3 días hábiles',
            'is_active': True,
            'category': 'amendments',
            'icon': 'create',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'amendment_complex',
            'service_type': 'amendment',
            'name': 'Enmienda Compleja',
            'description': 'Corrección de múltiples errores o años anteriores',
            'price_credits': 180.0,
            'estimated_time': '4-5 días hábiles',
            'is_active': True,
            'category': 'amendments',
            'icon': 'construct',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        
        # Consultas y Asesoría
        {
            '_id': 'consultation_30min',
            'service_type': 'consultation',
            'name': 'Consulta Express (30 min)',
            'description': 'Consulta fiscal rápida con asesor experto',
            'price_credits': 40.0,
            'estimated_time': 'Inmediato - 24 hrs',
            'is_active': True,
            'category': 'consultations',
            'icon': 'time',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'consultation_1hour',
            'service_type': 'consultation',
            'name': 'Consulta Estándar (1 hora)',
            'description': 'Asesoría fiscal completa con estrategias personalizadas',
            'price_credits': 70.0,
            'estimated_time': 'Inmediato - 24 hrs',
            'is_active': True,
            'category': 'consultations',
            'icon': 'chatbubbles',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'tax_planning',
            'service_type': 'consultation',
            'name': 'Planificación Fiscal Anual',
            'description': 'Estrategia fiscal personalizada para todo el año',
            'price_credits': 150.0,
            'estimated_time': '3-5 días hábiles',
            'is_active': True,
            'category': 'consultations',
            'icon': 'calendar',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        
        # Revisión y Procesamiento
        {
            '_id': 'document_review',
            'service_type': 'document_processing',
            'name': 'Revisión de Documentos',
            'description': 'Verificación de documentos fiscales antes de presentación',
            'price_credits': 30.0,
            'estimated_time': '1 día hábil',
            'is_active': True,
            'category': 'services',
            'icon': 'checkmark-circle',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'document_organization',
            'service_type': 'document_processing',
            'name': 'Organización de Documentos',
            'description': 'Organización digital de todos tus documentos fiscales',
            'price_credits': 50.0,
            'estimated_time': '2-3 días hábiles',
            'is_active': True,
            'category': 'services',
            'icon': 'folder-open',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        
        # Servicios Especiales
        {
            '_id': 'itin_application',
            'service_type': 'special_service',
            'name': 'Solicitud de ITIN',
            'description': 'Asistencia completa con aplicación de número ITIN',
            'price_credits': 200.0,
            'estimated_time': '5-7 días hábiles',
            'is_active': True,
            'category': 'special',
            'icon': 'card',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'irs_representation',
            'service_type': 'special_service',
            'name': 'Representación ante el IRS',
            'description': 'Te representamos en comunicaciones con el IRS',
            'price_credits': 250.0,
            'estimated_time': 'Variable',
            'is_active': True,
            'category': 'special',
            'icon': 'shield-checkmark',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'prior_year_return',
            'service_type': 'tax_return',
            'name': 'Declaración de Año Anterior',
            'description': 'Preparación de declaración de años fiscales anteriores',
            'price_credits': 220.0,
            'estimated_time': '4-6 días hábiles',
            'is_active': True,
            'category': 'tax_returns',
            'icon': 'time-outline',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        },
        {
            '_id': 'priority_processing',
            'service_type': 'priority_support',
            'name': 'Procesamiento Prioritario',
            'description': 'Tu declaración se procesa primero - entrega en 24hrs',
            'price_credits': 80.0,
            'estimated_time': '24 horas',
            'is_active': True,
            'category': 'services',
            'icon': 'flash',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
    ]
    
    print("🚀 Inicializando precios de servicios...")
    
    # Insertar o actualizar cada precio
    for price in service_prices:
        result = await db.service_prices.replace_one(
            {'_id': price['_id']},
            price,
            upsert=True
        )
        
        if result.upserted_id:
            print(f"✅ Creado: {price['name']} - {price['price_credits']} créditos")
        else:
            print(f"🔄 Actualizado: {price['name']} - {price['price_credits']} créditos")
    
    print(f"\n✨ Configuración de precios completada: {len(service_prices)} servicios")
    
    # Verificar
    count = await db.service_prices.count_documents({})
    print(f"📊 Total de servicios en base de datos: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_service_prices())
