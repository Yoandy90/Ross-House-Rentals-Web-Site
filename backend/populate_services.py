"""
Populate production database with services that clients can request
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RAILWAY_MONGO_URL = 'os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxportal')

async def populate_services():
    """Create services for Ross Tax"""
    
    try:
        logger.info("🚀 Connecting to Railway production MongoDB...")
        
        client = AsyncIOMotorClient(RAILWAY_MONGO_URL)
        db = client.taxportal
        
        services_collection = db.services
        
        # Delete old services
        await services_collection.delete_many({})
        
        # Create services
        services = [
            {
                '_id': str(uuid.uuid4()),
                'name': 'Preparación de Impuestos Personal',
                'description': 'Preparación completa de declaración de impuestos para individuos. Incluye revisión de documentos, maximización de deducciones y presentación electrónica.',
                'category': 'tax_preparation',
                'price': 180.00,
                'credits_cost': 3,
                'duration_minutes': 120,
                'icon': 'document-text',
                'popular': True,
                'status': 'active',
                'features': [
                    'Revisión de documentos W-2, 1099',
                    'Maximización de deducciones',
                    'Presentación electrónica',
                    'Copia digital de la declaración',
                ],
                'requirements': [
                    'W-2 o 1099 del año fiscal',
                    'Identificación válida',
                    'Número de Seguro Social',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Preparación de Impuestos para Negocios',
                'description': 'Declaración de impuestos para pequeños negocios, LLC, S-Corp. Incluye Schedule C, estados financieros y planificación fiscal.',
                'category': 'tax_preparation',
                'price': 350.00,
                'credits_cost': 7,
                'duration_minutes': 180,
                'icon': 'briefcase',
                'popular': True,
                'status': 'active',
                'features': [
                    'Schedule C completo',
                    'Estados financieros',
                    'Deducciones de negocio',
                    'Planificación fiscal',
                    'Consulta estratégica incluida',
                ],
                'requirements': [
                    'Registros financieros del negocio',
                    'Recibos de gastos',
                    'EIN del negocio',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Consultoría Fiscal',
                'description': 'Sesión de consulta con experto fiscal para planificación, estrategias de ahorro y resolución de dudas.',
                'category': 'consultation',
                'price': 75.00,
                'credits_cost': 2,
                'duration_minutes': 60,
                'icon': 'chatbubbles',
                'popular': True,
                'status': 'active',
                'features': [
                    'Sesión 1-on-1 con experto',
                    'Análisis de situación fiscal',
                    'Recomendaciones personalizadas',
                    'Resumen escrito de la consulta',
                ],
                'requirements': [
                    'Ninguno - solo trae tus preguntas',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'ITIN - Número de Identificación Fiscal',
                'description': 'Tramitación completa de ITIN (Individual Taxpayer Identification Number) para personas sin SSN.',
                'category': 'itin',
                'price': 200.00,
                'credits_cost': 4,
                'duration_minutes': 90,
                'icon': 'card',
                'popular': False,
                'status': 'active',
                'features': [
                    'Preparación de formulario W-7',
                    'Certificación de documentos',
                    'Envío al IRS',
                    'Seguimiento del trámite',
                ],
                'requirements': [
                    'Pasaporte vigente',
                    'Motivo válido para ITIN',
                    'Documentos de identidad',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Enmienda de Declaración (Amendment)',
                'description': 'Corrección de declaraciones de años anteriores mediante formulario 1040-X.',
                'category': 'amendment',
                'price': 120.00,
                'credits_cost': 3,
                'duration_minutes': 90,
                'icon': 'create',
                'popular': False,
                'status': 'active',
                'features': [
                    'Revisión de declaración original',
                    'Preparación de 1040-X',
                    'Documentación de cambios',
                    'Presentación al IRS',
                ],
                'requirements': [
                    'Copia de declaración original',
                    'Documentos de corrección',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Resolución de Cartas del IRS',
                'description': 'Asistencia para responder y resolver cartas, auditorías o avisos del IRS.',
                'category': 'irs_resolution',
                'price': 250.00,
                'credits_cost': 5,
                'duration_minutes': 120,
                'icon': 'mail',
                'popular': False,
                'status': 'active',
                'features': [
                    'Análisis de la carta del IRS',
                    'Preparación de respuesta',
                    'Representación ante el IRS',
                    'Negociación de acuerdos',
                ],
                'requirements': [
                    'Carta original del IRS',
                    'Documentación relacionada',
                    'Poder notarial (form 2848)',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Plan de Pago con el IRS',
                'description': 'Negociación y establecimiento de plan de pagos (Installment Agreement) con el IRS.',
                'category': 'payment_plan',
                'price': 180.00,
                'credits_cost': 4,
                'duration_minutes': 90,
                'icon': 'calendar',
                'popular': False,
                'status': 'active',
                'features': [
                    'Análisis de deuda fiscal',
                    'Cálculo de pagos mensuales',
                    'Negociación con el IRS',
                    'Establecimiento del acuerdo',
                ],
                'requirements': [
                    'Estado de cuenta del IRS',
                    'Información financiera',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'name': 'Notarización de Documentos',
                'description': 'Servicio de notario público para documentos legales, poderes, certificaciones.',
                'category': 'notary',
                'price': 25.00,
                'credits_cost': 1,
                'duration_minutes': 30,
                'icon': 'ribbon',
                'popular': False,
                'status': 'active',
                'features': [
                    'Notario público certificado',
                    'Hasta 3 documentos',
                    'Sello oficial',
                    'Certificado de notarización',
                ],
                'requirements': [
                    'Identificación válida con foto',
                    'Documentos a notarizar',
                ],
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
        ]
        
        await services_collection.insert_many(services)
        
        logger.info(f"✅ Created {len(services)} services")
        logger.info(f"\n{'='*60}")
        logger.info(f"🛠️ SERVICES CREATED:")
        logger.info(f"{'='*60}")
        
        for service in services:
            popular_badge = " ⭐" if service.get('popular') else ""
            logger.info(f"\n📦 {service['name']}{popular_badge}")
            logger.info(f"   Precio: ${service['price']} | {service['credits_cost']} créditos")
            logger.info(f"   Duración: {service['duration_minutes']} minutos")
            logger.info(f"   Categoría: {service['category']}")
        
        logger.info(f"\n{'='*60}\n")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(populate_services())
