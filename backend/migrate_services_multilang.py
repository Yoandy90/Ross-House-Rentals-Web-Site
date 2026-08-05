"""
Script para migrar servicios existentes al formato multiidioma
Agrega campos name_en, name_es, description_en, description_es
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# Traducciones predefinidas
TRANSLATIONS = {
    'Declaración Simple (W-2)': {
        'name_en': 'Simple Tax Return (W-2)',
        'name_es': 'Declaración Simple (W-2)',
        'description_en': 'For employees with a single W-2, no complex deductions',
        'description_es': 'Para empleados con un solo W-2, sin deducciones complejas'
    },
    'Declaración Estándar': {
        'name_en': 'Standard Tax Return',
        'name_es': 'Declaración Estándar',
        'description_en': 'Federal and state return with standard deductions',
        'description_es': 'Declaración federal y estatal con deducciones estándar'
    },
    'Declaración con Deducciones Detalladas': {
        'name_en': 'Itemized Deductions Tax Return',
        'name_es': 'Declaración con Deducciones Detalladas',
        'description_en': 'Includes itemized deductions and tax credits',
        'description_es': 'Incluye itemización de deducciones y créditos fiscales'
    },
    'Declaración Compleja': {
        'name_en': 'Complex Tax Return',
        'name_es': 'Declaración Compleja',
        'description_en': 'Multiple income sources, investments, rental properties',
        'description_es': 'Múltiples fuentes de ingreso, inversiones, propiedades de alquiler'
    },
    'Declaración de Negocio (Schedule C)': {
        'name_en': 'Business Tax Return (Schedule C)',
        'name_es': 'Declaración de Negocio (Schedule C)',
        'description_en': 'For self-employed and small business owners',
        'description_es': 'Para trabajadores independientes y pequeños negocios'
    },
    'Enmienda Simple (1040-X)': {
        'name_en': 'Simple Amendment (1040-X)',
        'name_es': 'Enmienda Simple (1040-X)',
        'description_en': 'Correction of minor errors in filed return',
        'description_es': 'Corrección de errores menores en declaración presentada'
    },
    'Enmienda Compleja': {
        'name_en': 'Complex Amendment',
        'name_es': 'Enmienda Compleja',
        'description_en': 'Correction of multiple errors or prior years',
        'description_es': 'Corrección de múltiples errores o años anteriores'
    },
    'Consulta Express (30 min)': {
        'name_en': 'Express Consultation (30 min)',
        'name_es': 'Consulta Express (30 min)',
        'description_en': 'Quick tax consultation with expert advisor',
        'description_es': 'Consulta fiscal rápida con asesor experto'
    },
    'Consulta Estándar (1 hora)': {
        'name_en': 'Standard Consultation (1 hour)',
        'name_es': 'Consulta Estándar (1 hora)',
        'description_en': 'Complete tax advisory with personalized strategies',
        'description_es': 'Asesoría fiscal completa con estrategias personalizadas'
    },
    'Planificación Fiscal Anual': {
        'name_en': 'Annual Tax Planning',
        'name_es': 'Planificación Fiscal Anual',
        'description_en': 'Personalized tax strategy for the entire year',
        'description_es': 'Estrategia fiscal personalizada para todo el año'
    },
    'Revisión de Documentos': {
        'name_en': 'Document Review',
        'name_es': 'Revisión de Documentos',
        'description_en': 'Verification of tax documents before filing',
        'description_es': 'Verificación de documentos fiscales antes de presentación'
    },
    'Organización de Documentos': {
        'name_en': 'Document Organization',
        'name_es': 'Organización de Documentos',
        'description_en': 'Digital organization of all your tax documents',
        'description_es': 'Organización digital de todos tus documentos fiscales'
    },
    'Solicitud de ITIN': {
        'name_en': 'ITIN Application',
        'name_es': 'Solicitud de ITIN',
        'description_en': 'Complete assistance with ITIN number application',
        'description_es': 'Asistencia completa con aplicación de número ITIN'
    },
    'Representación ante el IRS': {
        'name_en': 'IRS Representation',
        'name_es': 'Representación ante el IRS',
        'description_en': 'We represent you in communications with the IRS',
        'description_es': 'Te representamos en comunicaciones con el IRS'
    },
    'Declaración de Año Anterior': {
        'name_en': 'Prior Year Tax Return',
        'name_es': 'Declaración de Año Anterior',
        'description_en': 'Preparation of prior fiscal year returns',
        'description_es': 'Preparación de declaración de años fiscales anteriores'
    },
    'Procesamiento Prioritario': {
        'name_en': 'Priority Processing',
        'name_es': 'Procesamiento Prioritario',
        'description_en': 'Your return is processed first - delivered in 24hrs',
        'description_es': 'Tu declaración se procesa primero - entrega en 24hrs'
    }
}

async def migrate_services():
    """Migra servicios existentes a formato multiidioma"""
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🔄 Iniciando migración de servicios a formato multiidioma...")
    
    # Obtener todos los servicios
    services = await db.service_prices.find({}).to_list(None)
    
    print(f"📋 Encontrados {len(services)} servicios para migrar")
    
    migrated_count = 0
    
    for service in services:
        service_name = service.get('name', '')
        
        # Si ya tiene campos multiidioma, skip
        if 'name_en' in service and 'name_es' in service:
            print(f"⏭️  Saltando {service_name} (ya migrado)")
            continue
        
        # Buscar traducción predefinida
        if service_name in TRANSLATIONS:
            translation = TRANSLATIONS[service_name]
            
            update_data = {
                'name_en': translation['name_en'],
                'name_es': translation['name_es'],
                'description_en': translation['description_en'],
                'description_es': translation['description_es']
            }
            
            # Actualizar en base de datos
            await db.service_prices.update_one(
                {'_id': service['_id']},
                {'$set': update_data}
            )
            
            print(f"✅ Migrado: {service_name}")
            print(f"   EN: {translation['name_en']}")
            print(f"   ES: {translation['name_es']}")
            migrated_count += 1
        else:
            # Si no hay traducción predefinida, usar el mismo texto para ambos idiomas
            update_data = {
                'name_en': service_name,
                'name_es': service_name,
                'description_en': service.get('description', ''),
                'description_es': service.get('description', '')
            }
            
            await db.service_prices.update_one(
                {'_id': service['_id']},
                {'$set': update_data}
            )
            
            print(f"⚠️  Migrado (sin traducción): {service_name}")
            migrated_count += 1
    
    print(f"\n✨ Migración completada: {migrated_count} servicios migrados")
    
    # Verificar
    sample = await db.service_prices.find_one({})
    if sample:
        print(f"\n🔍 Ejemplo de servicio migrado:")
        print(f"   ID: {sample.get('_id')}")
        print(f"   Name EN: {sample.get('name_en', 'N/A')}")
        print(f"   Name ES: {sample.get('name_es', 'N/A')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_services())
