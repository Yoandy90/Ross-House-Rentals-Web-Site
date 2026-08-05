"""
Populate production database with FAQs
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RAILWAY_MONGO_URL = 'os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxportal')

async def populate_faqs():
    """Create FAQs for Ross Tax"""
    
    try:
        logger.info("🚀 Connecting to Railway production MongoDB...")
        
        client = AsyncIOMotorClient(RAILWAY_MONGO_URL)
        db = client.taxportal
        
        faqs_collection = db.faqs
        
        # Delete old FAQs
        await faqs_collection.delete_many({})
        
        # Create FAQs organized by categories
        faqs = [
            # General Questions
            {
                '_id': str(uuid.uuid4()),
                'category': 'general',
                'question': '¿Qué servicios ofrece Ross Tax Preparation?',
                'answer': 'Ofrecemos preparación de impuestos personal y de negocios, consultoría fiscal, tramitación de ITIN, enmiendas de declaraciones anteriores, resolución de problemas con el IRS, planes de pago, y servicios de notarización.',
                'order': 1,
                'language': 'es',
                'status': 'published',
                'helpful_count': 45,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'general',
                'question': '¿Cuál es el horario de atención?',
                'answer': 'Nuestro horario es de Lunes a Viernes de 9:00 AM a 5:00 PM. También ofrecemos citas fuera de horario con previa reserva.',
                'order': 2,
                'language': 'es',
                'status': 'published',
                'helpful_count': 32,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'general',
                'question': '¿Ofrecen consultas virtuales?',
                'answer': 'Sí, ofrecemos consultas virtuales por videollamada para tu comodidad. Puedes agendar una cita virtual desde la app.',
                'order': 3,
                'language': 'es',
                'status': 'published',
                'helpful_count': 28,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            
            # Tax Preparation
            {
                '_id': str(uuid.uuid4()),
                'category': 'tax_preparation',
                'question': '¿Qué documentos necesito para preparar mis impuestos?',
                'answer': 'Necesitas:\n• W-2 o 1099 de todos tus empleadores\n• Identificación con foto válida\n• Número de Seguro Social o ITIN\n• Documentos de deducciones (gastos médicos, donaciones, etc.)\n• Información bancaria para depósito directo',
                'order': 1,
                'language': 'es',
                'status': 'published',
                'helpful_count': 67,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'tax_preparation',
                'question': '¿Cuánto tarda el proceso de preparación de impuestos?',
                'answer': 'Una declaración personal básica toma aproximadamente 2 horas. Declaraciones más complejas o de negocios pueden tomar 3-4 horas. Te daremos un tiempo estimado al revisar tu documentación.',
                'order': 2,
                'language': 'es',
                'status': 'published',
                'helpful_count': 54,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'tax_preparation',
                'question': '¿Cuándo recibiré mi reembolso del IRS?',
                'answer': 'Si presentas electrónicamente con depósito directo, el IRS generalmente procesa reembolsos en 21 días. Presentaciones por correo pueden tomar 6-8 semanas. Puedes rastrear tu reembolso en IRS.gov/refund.',
                'order': 3,
                'language': 'es',
                'status': 'published',
                'helpful_count': 89,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            
            # ITIN
            {
                '_id': str(uuid.uuid4()),
                'category': 'itin',
                'question': '¿Qué es un ITIN y quién lo necesita?',
                'answer': 'El ITIN (Individual Taxpayer Identification Number) es un número de identificación fiscal para personas que necesitan presentar impuestos pero no califican para un SSN. Lo necesitan personas sin estatus migratorio que tienen obligaciones fiscales en EE.UU.',
                'order': 1,
                'language': 'es',
                'status': 'published',
                'helpful_count': 72,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'itin',
                'question': '¿Cuánto tiempo tarda obtener un ITIN?',
                'answer': 'El IRS tarda típicamente 7-11 semanas en procesar una solicitud de ITIN. Durante temporada alta (enero-abril) puede tomar más tiempo. Nosotros te ayudamos a completar el formulario W-7 correctamente para evitar retrasos.',
                'order': 2,
                'language': 'es',
                'status': 'published',
                'helpful_count': 61,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            
            # Payments & Pricing
            {
                '_id': str(uuid.uuid4()),
                'category': 'payments',
                'question': '¿Cuánto cuestan sus servicios?',
                'answer': 'Nuestros precios varían según el servicio:\n• Impuestos personales básicos: $180\n• Impuestos de negocios: $350\n• Consultoría: $75/hora\n• ITIN: $200\n• Notarización: $25\n\nOfrecemos planes de suscripción con descuentos.',
                'order': 1,
                'language': 'es',
                'status': 'published',
                'helpful_count': 78,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'payments',
                'question': '¿Qué métodos de pago aceptan?',
                'answer': 'Aceptamos:\n• Tarjetas de crédito/débito\n• Transferencias ACH\n• Efectivo\n• Cheques\n• Planes de pago flexibles disponibles',
                'order': 2,
                'language': 'es',
                'status': 'published',
                'helpful_count': 43,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            
            # IRS Issues
            {
                '_id': str(uuid.uuid4()),
                'category': 'irs_issues',
                'question': 'Recibí una carta del IRS, ¿qué hago?',
                'answer': 'No ignores cartas del IRS. Contáctanos inmediatamente. Analizaremos la carta, te explicaremos qué significa, y te ayudaremos a responder apropiadamente. El tiempo es crucial en estos casos.',
                'order': 1,
                'language': 'es',
                'status': 'published',
                'helpful_count': 91,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'irs_issues',
                'question': '¿Pueden ayudarme si debo impuestos atrasados?',
                'answer': 'Sí, podemos ayudarte a:\n• Negociar planes de pago con el IRS\n• Solicitar reducción de multas\n• Preparar ofertas de compromiso\n• Establecer acuerdos de pago a plazos\n• Representarte ante el IRS',
                'order': 2,
                'language': 'es',
                'status': 'published',
                'helpful_count': 85,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            
            # App Usage
            {
                '_id': str(uuid.uuid4()),
                'category': 'app',
                'question': '¿Cómo agendo una cita en la app?',
                'answer': 'Es fácil:\n1. Abre la app y haz login\n2. Ve a "Agendar Cita"\n3. Selecciona el tipo de servicio\n4. Escoge fecha y hora disponible\n5. Confirma tu cita\n\nRecibirás confirmación por email y SMS.',
                'order': 1,
                'language': 'es',
                'status': 'published',
                'helpful_count': 56,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'app',
                'question': '¿Cómo puedo subir mis documentos de forma segura?',
                'answer': 'La app usa encriptación de nivel bancario. Para subir documentos:\n1. Ve a "Mis Documentos"\n2. Toca el botón "+"\n3. Selecciona fotos o archivos\n4. Agrega una descripción\n5. Tus documentos se guardan cifrados',
                'order': 2,
                'language': 'es',
                'status': 'published',
                'helpful_count': 48,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
            {
                '_id': str(uuid.uuid4()),
                'category': 'app',
                'question': '¿Puedo cancelar o reprogramar una cita?',
                'answer': 'Sí, puedes cancelar o reprogramar hasta 24 horas antes de tu cita sin cargo. Simplemente ve a "Mis Citas" en la app y selecciona la opción correspondiente.',
                'order': 3,
                'language': 'es',
                'status': 'published',
                'helpful_count': 39,
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            },
        ]
        
        await faqs_collection.insert_many(faqs)
        
        logger.info(f"✅ Created {len(faqs)} FAQs")
        logger.info(f"\n{'='*60}")
        logger.info(f"❓ FAQs CREATED BY CATEGORY:")
        logger.info(f"{'='*60}")
        
        categories = {}
        for faq in faqs:
            cat = faq['category']
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(faq['question'])
        
        for cat, questions in categories.items():
            logger.info(f"\n📂 {cat.upper()} ({len(questions)} preguntas)")
            for q in questions:
                logger.info(f"   • {q[:60]}...")
        
        logger.info(f"\n{'='*60}\n")
        
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(populate_faqs())
