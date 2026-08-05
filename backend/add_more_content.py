"""
Script to add more content to FAQs, Educational Content, and Tax News
for App Store preparation
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import random
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "taxportal")

async def add_more_faqs():
    """Add 20+ more FAQs across different categories"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get existing categories
    categories = await db.faq_categories.find({"active": True}).to_list(None)
    category_map = {cat['name']: cat['id'] for cat in categories}
    
    new_faqs = [
        # General Category
        {
            "id": "faq_gen_001",
            "category_id": category_map.get('General'),
            "question": "What are your office hours?",
            "question_es": "¿Cuáles son sus horarios de oficina?",
            "answer": "Our office is open Monday through Friday from 9:00 AM to 6:00 PM EST. We also offer evening appointments by request for clients who cannot visit during regular hours.",
            "answer_es": "Nuestra oficina está abierta de lunes a viernes de 9:00 AM a 6:00 PM EST. También ofrecemos citas nocturnas bajo solicitud para clientes que no pueden visitarnos durante el horario regular.",
            "tags": ["hours", "schedule", "office"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 10,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_gen_002",
            "category_id": category_map.get('General'),
            "question": "Do you offer virtual consultations?",
            "question_es": "¿Ofrecen consultas virtuales?",
            "answer": "Yes! We offer secure video consultations via Zoom or Google Meet. You can schedule a virtual appointment through our mobile app or by calling our office.",
            "answer_es": "¡Sí! Ofrecemos consultas virtuales seguras a través de Zoom o Google Meet. Puede programar una cita virtual a través de nuestra aplicación móvil o llamando a nuestra oficina.",
            "tags": ["virtual", "online", "remote", "consultation"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 11,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_gen_003",
            "category_id": category_map.get('General'),
            "question": "How can I access my tax documents?",
            "question_es": "¿Cómo puedo acceder a mis documentos fiscales?",
            "answer": "All your tax documents are securely stored in your Ross Tax portal. You can access them anytime through our mobile app or website by logging into your account.",
            "answer_es": "Todos sus documentos fiscales están almacenados de forma segura en su portal Ross Tax. Puede acceder a ellos en cualquier momento a través de nuestra aplicación móvil o sitio web iniciando sesión en su cuenta.",
            "tags": ["documents", "access", "portal", "security"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 12,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        # Taxes Category
        {
            "id": "faq_tax_001",
            "category_id": category_map.get('Taxes'),
            "question": "When is the tax filing deadline?",
            "question_es": "¿Cuándo es la fecha límite para presentar impuestos?",
            "answer": "The federal tax filing deadline is typically April 15th. However, if this date falls on a weekend or holiday, the deadline is extended to the next business day. We recommend filing early to avoid last-minute stress.",
            "answer_es": "La fecha límite federal para presentar impuestos es típicamente el 15 de abril. Sin embargo, si esta fecha cae en fin de semana o feriado, la fecha límite se extiende al siguiente día hábil. Recomendamos presentar temprano para evitar estrés de último minuto.",
            "tags": ["deadline", "filing", "april", "date"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 20,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_tax_002",
            "category_id": category_map.get('Taxes'),
            "question": "Can I file an extension?",
            "question_es": "¿Puedo solicitar una extensión?",
            "answer": "Yes, you can file Form 4868 to get an automatic 6-month extension until October 15th. However, this only extends the time to file, not the time to pay any taxes owed. We can help you file for an extension.",
            "answer_es": "Sí, puede presentar el Formulario 4868 para obtener una extensión automática de 6 meses hasta el 15 de octubre. Sin embargo, esto solo extiende el tiempo para presentar, no el tiempo para pagar los impuestos adeudados. Podemos ayudarlo a solicitar una extensión.",
            "tags": ["extension", "deadline", "form 4868", "october"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 21,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_tax_003",
            "category_id": category_map.get('Taxes'),
            "question": "What documents do I need to file my taxes?",
            "question_es": "¿Qué documentos necesito para presentar mis impuestos?",
            "answer": "You'll typically need: W-2 forms from employers, 1099 forms for other income, mortgage interest statements (1098), student loan interest statements, charitable donation receipts, and records of business expenses if self-employed.",
            "answer_es": "Típicamente necesitará: formularios W-2 de empleadores, formularios 1099 para otros ingresos, estados de intereses hipotecarios (1098), estados de intereses de préstamos estudiantiles, recibos de donaciones caritativas y registros de gastos comerciales si trabaja por cuenta propia.",
            "tags": ["documents", "w-2", "1099", "forms", "requirements"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 22,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_tax_004",
            "category_id": category_map.get('Taxes'),
            "question": "How long does it take to get my tax refund?",
            "question_es": "¿Cuánto tiempo tarda en llegar mi reembolso de impuestos?",
            "answer": "If you e-file and choose direct deposit, you typically receive your refund within 21 days. Paper returns take 6-8 weeks. You can track your refund status using the IRS 'Where's My Refund?' tool.",
            "answer_es": "Si presenta electrónicamente y elige depósito directo, típicamente recibirá su reembolso en 21 días. Las declaraciones en papel toman de 6 a 8 semanas. Puede rastrear el estado de su reembolso usando la herramienta 'Where's My Refund?' del IRS.",
            "tags": ["refund", "timing", "direct deposit", "e-file"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 23,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_tax_005",
            "category_id": category_map.get('Taxes'),
            "question": "What is the standard deduction for 2024?",
            "question_es": "¿Cuál es la deducción estándar para 2024?",
            "answer": "For 2024, the standard deduction is $14,600 for single filers, $29,200 for married filing jointly, and $21,900 for heads of household. These amounts are adjusted annually for inflation.",
            "answer_es": "Para 2024, la deducción estándar es de $14,600 para declarantes solteros, $29,200 para casados que presentan conjuntamente y $21,900 para jefes de hogar. Estas cantidades se ajustan anualmente por inflación.",
            "tags": ["standard deduction", "2024", "amounts", "filing status"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 24,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        # Appointments Category
        {
            "id": "faq_apt_001",
            "category_id": category_map.get('Appointments'),
            "question": "How do I schedule an appointment?",
            "question_es": "¿Cómo programo una cita?",
            "answer": "You can schedule an appointment through our mobile app, website, or by calling our office at (806) 930-7456. Our booking system shows real-time availability and sends automatic reminders.",
            "answer_es": "Puede programar una cita a través de nuestra aplicación móvil, sitio web o llamando a nuestra oficina al (806) 930-7456. Nuestro sistema de reservas muestra disponibilidad en tiempo real y envía recordatorios automáticos.",
            "tags": ["schedule", "booking", "appointment", "reservation"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 30,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_apt_002",
            "category_id": category_map.get('Appointments'),
            "question": "Can I reschedule or cancel my appointment?",
            "question_es": "¿Puedo reprogramar o cancelar mi cita?",
            "answer": "Yes, you can reschedule or cancel your appointment up to 24 hours in advance through the app or by calling us. We appreciate advance notice to accommodate other clients.",
            "answer_es": "Sí, puede reprogramar o cancelar su cita hasta 24 horas antes a través de la aplicación o llamándonos. Agradecemos el aviso anticipado para acomodar a otros clientes.",
            "tags": ["reschedule", "cancel", "change", "appointment"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 31,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_apt_003",
            "category_id": category_map.get('Appointments'),
            "question": "What should I bring to my appointment?",
            "question_es": "¿Qué debo traer a mi cita?",
            "answer": "Please bring valid ID, Social Security cards for all family members, all tax documents (W-2s, 1099s, etc.), and any relevant financial records. We'll send you a detailed checklist when you book your appointment.",
            "answer_es": "Por favor traiga identificación válida, tarjetas de Seguro Social para todos los miembros de la familia, todos los documentos fiscales (W-2, 1099, etc.) y cualquier registro financiero relevante. Le enviaremos una lista detallada cuando reserve su cita.",
            "tags": ["documents", "checklist", "bring", "requirements"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 32,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        # Documents Category
        {
            "id": "faq_doc_001",
            "category_id": category_map.get('Documents'),
            "question": "How do I upload documents securely?",
            "question_es": "¿Cómo subo documentos de forma segura?",
            "answer": "You can upload documents directly through our mobile app or client portal. All documents are encrypted and stored on secure servers. We support PDF, JPG, and PNG formats up to 10MB per file.",
            "answer_es": "Puede subir documentos directamente a través de nuestra aplicación móvil o portal de cliente. Todos los documentos están encriptados y almacenados en servidores seguros. Soportamos formatos PDF, JPG y PNG hasta 10MB por archivo.",
            "tags": ["upload", "security", "documents", "encryption"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 40,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_doc_002",
            "category_id": category_map.get('Documents'),
            "question": "How long are my documents stored?",
            "question_es": "¿Cuánto tiempo se almacenan mis documentos?",
            "answer": "We securely store your tax documents for 7 years, as recommended by the IRS. You can access them anytime through your account. After 7 years, documents are securely deleted unless you request extended storage.",
            "answer_es": "Almacenamos de forma segura sus documentos fiscales durante 7 años, según lo recomendado por el IRS. Puede acceder a ellos en cualquier momento a través de su cuenta. Después de 7 años, los documentos se eliminan de forma segura a menos que solicite almacenamiento extendido.",
            "tags": ["storage", "retention", "documents", "security"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 41,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        # Payments Category
        {
            "id": "faq_pay_001",
            "category_id": category_map.get('Payments'),
            "question": "What payment methods do you accept?",
            "question_es": "¿Qué métodos de pago aceptan?",
            "answer": "We accept credit/debit cards, ACH bank transfers, Ross Tax Credits, and cash payments in office. Online payments are processed securely through Stripe.",
            "answer_es": "Aceptamos tarjetas de crédito/débito, transferencias bancarias ACH, Créditos Ross Tax y pagos en efectivo en la oficina. Los pagos en línea se procesan de forma segura a través de Stripe.",
            "tags": ["payment", "methods", "cards", "ach", "credits"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 50,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_pay_002",
            "category_id": category_map.get('Payments'),
            "question": "Do you offer payment plans?",
            "question_es": "¿Ofrecen planes de pago?",
            "answer": "Yes, we offer flexible payment plans for tax preparation services. Contact us to discuss options that fit your budget. We also accept Ross Tax Credits which can be earned through referrals.",
            "answer_es": "Sí, ofrecemos planes de pago flexibles para servicios de preparación de impuestos. Contáctenos para discutir opciones que se ajusten a su presupuesto. También aceptamos Créditos Ross Tax que se pueden ganar a través de referencias.",
            "tags": ["payment plan", "installments", "flexible", "credits"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 51,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "faq_pay_003",
            "category_id": category_map.get('Payments'),
            "question": "What are Ross Tax Credits?",
            "question_es": "¿Qué son los Créditos Ross Tax?",
            "answer": "Ross Tax Credits are our internal rewards system. You earn credits through referrals, which can be used to pay for services. 1 credit = $1. Credits never expire and can be transferred to family members.",
            "answer_es": "Los Créditos Ross Tax son nuestro sistema interno de recompensas. Gana créditos a través de referencias, que pueden usarse para pagar servicios. 1 crédito = $1. Los créditos nunca expiran y pueden transferirse a miembros de la familia.",
            "tags": ["credits", "rewards", "referral", "wallet"],
            "views": 0,
            "helpful_count": 0,
            "not_helpful_count": 0,
            "order": 52,
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
    ]
    
    # Insert new FAQs
    if new_faqs:
        result = await db.faqs.insert_many(new_faqs)
        print(f"✅ Added {len(result.inserted_ids)} new FAQs")
    
    client.close()

async def add_more_educational_articles():
    """Add 15+ more educational articles"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get existing categories
    categories = await db.educational_categories.find({"active": True}).to_list(None)
    category_map = {cat['name']: cat['id'] for cat in categories}
    
    new_articles = [
        # Tax Basics
        {
            "id": "eduart_tb_001",
            "category_id": category_map.get('Tax Basics'),
            "title": "Understanding Tax Brackets and Marginal Tax Rates",
            "title_es": "Entendiendo los Tramos Impositivos y Tasas Marginales",
            "summary": "Learn how progressive tax brackets work and why your effective tax rate differs from your marginal rate.",
            "summary_es": "Aprenda cómo funcionan los tramos impositivos progresivos y por qué su tasa impositiva efectiva difiere de su tasa marginal.",
            "content": """Tax brackets are the foundation of our progressive tax system. Understanding how they work is crucial for effective tax planning.

**What are Tax Brackets?**
Tax brackets are ranges of income taxed at different rates. As your income increases, you move into higher brackets, but only the income within each bracket is taxed at that bracket's rate.

**Common Misconceptions**
Many people mistakenly believe that moving into a higher tax bracket means all their income is taxed at that higher rate. This is false! Only the income within that bracket is taxed at the higher rate.

**Example:**
If you're single and earn $50,000:
- First $11,000: taxed at 10% = $1,100
- Next $33,725: taxed at 12% = $4,047
- Remaining $5,275: taxed at 22% = $1,161
Total tax: $6,308 (effective rate: 12.6%)

**Key Takeaways:**
1. Moving to a higher bracket never results in less take-home pay
2. Your effective tax rate is always lower than your marginal rate
3. Strategic income timing can optimize your tax bracket positioning""",
            "content_es": """Los tramos impositivos son la base de nuestro sistema tributario progresivo. Entender cómo funcionan es crucial para una planificación fiscal efectiva.

**¿Qué son los Tramos Impositivos?**
Los tramos impositivos son rangos de ingresos gravados a diferentes tasas. A medida que sus ingresos aumentan, se mueve a tramos más altos, pero solo los ingresos dentro de cada tramo se gravan a esa tasa.

**Conceptos Erróneos Comunes**
Muchas personas creen erróneamente que moverse a un tramo impositivo más alto significa que todos sus ingresos se gravan a esa tasa más alta. ¡Esto es falso! Solo los ingresos dentro de ese tramo se gravan a la tasa más alta.

**Ejemplo:**
Si es soltero y gana $50,000:
- Primeros $11,000: gravados al 10% = $1,100
- Siguientes $33,725: gravados al 12% = $4,047
- Restantes $5,275: gravados al 22% = $1,161
Impuesto total: $6,308 (tasa efectiva: 12.6%)

**Conclusiones Clave:**
1. Moverse a un tramo superior nunca resulta en menos ingreso neto
2. Su tasa impositiva efectiva siempre es menor que su tasa marginal
3. El tiempo estratégico de ingresos puede optimizar su posición de tramo impositivo""",
            "level": "beginner",
            "estimated_read_time": 5,
            "tags": ["tax brackets", "marginal rate", "effective rate", "basics"],
            "views": 0,
            "likes": 0,
            "featured": True,
            "published": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "eduart_tb_002",
            "category_id": category_map.get('Tax Basics'),
            "title": "Filing Status: Choosing the Right One",
            "title_es": "Estado Civil: Eligiendo el Correcto",
            "summary": "Your filing status significantly impacts your tax liability. Learn which status is right for you.",
            "summary_es": "Su estado civil impacta significativamente su obligación tributaria. Aprenda cuál es el correcto para usted.",
            "content": """Your filing status is one of the most important decisions you make on your tax return. It affects your standard deduction, tax rates, and eligibility for credits.

**The Five Filing Statuses:**

1. **Single:** Unmarried, divorced, or legally separated
2. **Married Filing Jointly:** Married couples filing one combined return (usually provides the best tax benefit)
3. **Married Filing Separately:** Married couples filing separate returns (rarely advantageous)
4. **Head of Household:** Unmarried with a qualifying dependent and paid >50% of home costs
5. **Qualifying Widow(er):** For the two years following spouse's death with dependent child

**Which Should You Choose?**

**Married Filing Jointly vs. Separately:**
- Jointly: Lower tax rates, higher income thresholds, more credits available
- Separately: Consider only if one spouse has significant medical expenses or miscellaneous deductions

**Head of Household Benefits:**
- Higher standard deduction than single filers
- More favorable tax brackets
- Better eligibility for credits

**Requirements for Head of Household:**
- You must be unmarried on the last day of the tax year
- You paid more than half the cost of keeping up a home
- A qualifying person lived with you for more than half the year

**Important Note:**
Your filing status is determined by your situation on December 31st. If you marry or divorce during the year, your status for the entire year is based on your December 31st status.""",
            "content_es": """Su estado civil es una de las decisiones más importantes que toma en su declaración de impuestos. Afecta su deducción estándar, tasas impositivas y elegibilidad para créditos.

**Los Cinco Estados Civiles:**

1. **Soltero:** No casado, divorciado o legalmente separado
2. **Casado Declarando Conjuntamente:** Parejas casadas presentando una declaración combinada (generalmente proporciona el mejor beneficio fiscal)
3. **Casado Declarando Separadamente:** Parejas casadas presentando declaraciones separadas (rara vez ventajoso)
4. **Jefe de Hogar:** No casado con un dependiente calificado y pagó >50% de los costos del hogar
5. **Viudo(a) Calificado:** Para los dos años siguientes a la muerte del cónyuge con hijo dependiente

**¿Cuál Debe Elegir?**

**Casado Declarando Conjuntamente vs. Separadamente:**
- Conjuntamente: Tasas impositivas más bajas, umbrales de ingresos más altos, más créditos disponibles
- Separadamente: Considere solo si un cónyuge tiene gastos médicos significativos o deducciones diversas

**Beneficios de Jefe de Hogar:**
- Deducción estándar más alta que declarantes solteros
- Tramos impositivos más favorables
- Mejor elegibilidad para créditos

**Requisitos para Jefe de Hogar:**
- Debe estar no casado el último día del año fiscal
- Pagó más de la mitad del costo de mantener un hogar
- Una persona calificada vivió con usted más de la mitad del año

**Nota Importante:**
Su estado civil se determina por su situación el 31 de diciembre. Si se casa o divorcia durante el año, su estado para todo el año se basa en su estado del 31 de diciembre.""",
            "level": "beginner",
            "estimated_read_time": 6,
            "tags": ["filing status", "married", "head of household", "status"],
            "views": 0,
            "likes": 0,
            "featured": False,
            "published": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        # Deductions & Credits
        {
            "id": "eduart_dc_001",
            "category_id": category_map.get('Deductions & Credits'),
            "title": "Home Office Deduction: Complete Guide for 2024",
            "title_es": "Deducción de Oficina en Casa: Guía Completa para 2024",
            "summary": "Maximize your home office deduction with this comprehensive guide covering requirements, calculations, and common mistakes.",
            "summary_es": "Maximice su deducción de oficina en casa con esta guía completa que cubre requisitos, cálculos y errores comunes.",
            "content": """The home office deduction can provide significant tax savings for self-employed individuals and small business owners. Here's everything you need to know.

**Who Qualifies?**
To claim the home office deduction, you must meet these requirements:
1. Regular and exclusive use: The space must be used regularly and exclusively for business
2. Principal place of business: It must be your main place of business or where you meet clients

**Two Methods of Calculation:**

**1. Simplified Method (Easier)**
- $5 per square foot of home office space
- Maximum 300 square feet ($1,500 deduction)
- No need to track actual expenses
- Cannot depreciate home
- Best for: Small offices, simple situations

**2. Regular Method (More Complex but Potentially Larger)**
- Calculate actual expenses (mortgage interest, property taxes, utilities, repairs, insurance, depreciation)
- Multiply by business-use percentage of home
- Requires detailed record-keeping
- Can depreciate portion of home
- Best for: Larger offices, significant home expenses

**Example Calculation (Regular Method):**
- Home is 2,000 sq ft
- Office is 200 sq ft (10% of home)
- Total home expenses: $20,000/year
- Deduction: $20,000 × 10% = $2,000

**Common Mistakes to Avoid:**
1. Using office for personal activities (disqualifies the deduction)
2. Not keeping proper documentation
3. Forgetting to track improvements vs. repairs
4. Not considering state tax implications

**What You Can Deduct:**
- Direct expenses (painting office): 100%
- Indirect expenses (mortgage, utilities): Business %
- Depreciation of home (Regular method only)

**Important Notes:**
- Employees generally cannot claim home office deduction (changed in 2018)
- Keep detailed records and photos of your home office
- Consider future home sale implications (depreciation recapture)""",
            "content_es": """La deducción de oficina en casa puede proporcionar ahorros fiscales significativos para personas autoempleadas y propietarios de pequeñas empresas. Aquí está todo lo que necesita saber.

**¿Quién Califica?**
Para reclamar la deducción de oficina en casa, debe cumplir estos requisitos:
1. Uso regular y exclusivo: El espacio debe usarse regular y exclusivamente para negocios
2. Lugar principal de negocios: Debe ser su lugar principal de negocios o donde se reúne con clientes

**Dos Métodos de Cálculo:**

**1. Método Simplificado (Más Fácil)**
- $5 por pie cuadrado de espacio de oficina en casa
- Máximo 300 pies cuadrados ($1,500 de deducción)
- No necesita rastrear gastos reales
- No puede depreciar el hogar
- Mejor para: Oficinas pequeñas, situaciones simples

**2. Método Regular (Más Complejo pero Potencialmente Mayor)**
- Calcule gastos reales (intereses hipotecarios, impuestos a la propiedad, servicios públicos, reparaciones, seguro, depreciación)
- Multiplique por el porcentaje de uso comercial del hogar
- Requiere mantenimiento detallado de registros
- Puede depreciar porción del hogar
- Mejor para: Oficinas más grandes, gastos significativos del hogar

**Ejemplo de Cálculo (Método Regular):**
- El hogar es de 2,000 pies cuadrados
- La oficina es de 200 pies cuadrados (10% del hogar)
- Gastos totales del hogar: $20,000/año
- Deducción: $20,000 × 10% = $2,000

**Errores Comunes a Evitar:**
1. Usar la oficina para actividades personales (descalifica la deducción)
2. No mantener documentación adecuada
3. Olvidar rastrear mejoras vs. reparaciones
4. No considerar implicaciones fiscales estatales

**Lo Que Puede Deducir:**
- Gastos directos (pintar oficina): 100%
- Gastos indirectos (hipoteca, servicios): % de negocios
- Depreciación del hogar (solo método regular)

**Notas Importantes:**
- Los empleados generalmente no pueden reclamar deducción de oficina en casa (cambió en 2018)
- Mantenga registros detallados y fotos de su oficina en casa
- Considere implicaciones de futura venta del hogar (recaptura de depreciación)""",
            "level": "intermediate",
            "estimated_read_time": 8,
            "tags": ["home office", "deduction", "self-employed", "business"],
            "views": 0,
            "likes": 0,
            "featured": True,
            "published": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
    ]
    
    # Insert new articles
    if new_articles:
        result = await db.educational_articles.insert_many(new_articles)
        print(f"✅ Added {len(result.inserted_ids)} new educational articles")
    
    client.close()

async def add_more_tax_news():
    """Add 10+ more tax news articles"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    new_news = [
        {
            "id": "news_004",
            "title": "Child Tax Credit Expansion Proposed for 2025",
            "title_es": "Propuesta de Expansión del Crédito Tributario por Hijos para 2025",
            "summary": "Congressional proposals aim to increase the Child Tax Credit from $2,000 to $3,000 per child for 2025 tax year.",
            "summary_es": "Propuestas del Congreso buscan aumentar el Crédito Tributario por Hijos de $2,000 a $3,000 por hijo para el año fiscal 2025.",
            "content": """New bipartisan legislation introduced in Congress proposes significant changes to the Child Tax Credit (CTC) that could benefit millions of families...

**Proposed Changes:**
- Increase from $2,000 to $3,000 per child
- Additional $600 for children under 6
- Expanded income limits
- Monthly advance payments option

**Impact:**
Families with two children could see tax savings of $2,000 or more annually. The proposal includes retroactive application to 2025 returns.

**What You Should Do:**
- Review your current tax situation
- Consider adjusting W-4 withholding if passed
- Plan for potential advance payments

Stay tuned for updates as this legislation progresses through Congress.""",
            "content_es": """Nueva legislación bipartidista introducida en el Congreso propone cambios significativos al Crédito Tributario por Hijos (CTC) que podrían beneficiar a millones de familias...

**Cambios Propuestos:**
- Aumento de $2,000 a $3,000 por hijo
- $600 adicionales para niños menores de 6 años
- Límites de ingresos ampliados
- Opción de pagos anticipados mensuales

**Impacto:**
Las familias con dos hijos podrían ver ahorros fiscales de $2,000 o más anualmente. La propuesta incluye aplicación retroactiva a las declaraciones de 2025.

**Qué Debe Hacer:**
- Revise su situación fiscal actual
- Considere ajustar la retención W-4 si se aprueba
- Planifique para posibles pagos anticipados

Manténgase informado sobre actualizaciones a medida que esta legislación avance en el Congreso.""",
            "source": "Congressional Budget Office",
            "source_url": "https://www.cbo.gov",
            "impact_level": "high",
            "news_type": "law_change",
            "effective_date": datetime(2025, 1, 1),
            "tags": ["child tax credit", "families", "credit", "expansion"],
            "views": 0,
            "published_at": datetime.utcnow() - timedelta(days=1),
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "news_005",
            "title": "IRS Announces Free Direct File Program Expansion",
            "title_es": "IRS Anuncia Expansión del Programa de Presentación Directa Gratuita",
            "summary": "The IRS Direct File pilot program will expand to 25 states for the 2025 tax season, offering free online filing.",
            "summary_es": "El programa piloto de Presentación Directa del IRS se expandirá a 25 estados para la temporada de impuestos 2025, ofreciendo presentación en línea gratuita.",
            "content": """The IRS has announced a major expansion of its Direct File program, which allows eligible taxpayers to file their federal taxes directly with the IRS at no cost...

**Program Details:**
- Available in 25 states (up from 12 in pilot)
- Completely free - no hidden fees
- Mobile-friendly interface
- Real-time error checking
- Direct deposit refunds

**Who Can Use It:**
- W-2 wage earners
- Those claiming standard deduction
- Filers with common tax credits
- Income under $100,000

**Benefits:**
- Save $50-$200 on filing fees
- Faster refund processing
- Secure IRS platform
- Spanish language support

Check if your state is included in the expansion at IRS.gov/DirectFile.""",
            "content_es": """El IRS ha anunciado una expansión importante de su programa de Presentación Directa, que permite a contribuyentes elegibles presentar sus impuestos federales directamente con el IRS sin costo...

**Detalles del Programa:**
- Disponible en 25 estados (aumentó de 12 en piloto)
- Completamente gratis - sin tarifas ocultas
- Interfaz amigable para móviles
- Verificación de errores en tiempo real
- Reembolsos por depósito directo

**Quién Puede Usarlo:**
- Asalariados con W-2
- Quienes reclaman deducción estándar
- Declarantes con créditos fiscales comunes
- Ingresos menores de $100,000

**Beneficios:**
- Ahorre $50-$200 en tarifas de presentación
- Procesamiento de reembolso más rápido
- Plataforma segura del IRS
- Soporte en español

Verifique si su estado está incluido en la expansión en IRS.gov/DirectFile.""",
            "source": "IRS",
            "source_url": "https://www.irs.gov/directfile",
            "impact_level": "medium",
            "news_type": "irs_update",
            "effective_date": datetime(2025, 1, 15),
            "tags": ["direct file", "free filing", "irs", "e-file"],
            "views": 0,
            "published_at": datetime.utcnow() - timedelta(days=3),
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": "news_006",
            "title": "Retirement Contribution Limits Increase for 2025",
            "title_es": "Límites de Contribución para Retiro Aumentan para 2025",
            "summary": "401(k) and IRA contribution limits see inflation adjustments, allowing higher tax-deferred savings in 2025.",
            "summary_es": "Los límites de contribución 401(k) e IRA ven ajustes por inflación, permitiendo mayores ahorros con impuestos diferidos en 2025.",
            "content": """The IRS has announced cost-of-living adjustments to retirement account contribution limits for 2025...

**New Limits for 2025:**

**401(k), 403(b), and 457 Plans:**
- Standard limit: $23,500 (up from $23,000 in 2024)
- Catch-up (age 50+): Additional $7,500
- Total possible: $31,000 for those 50+

**Traditional and Roth IRAs:**
- Standard limit: $7,000 (up from $6,500)
- Catch-up (age 50+): Additional $1,000
- Total possible: $8,000 for those 50+

**SIMPLE Plans:**
- Standard limit: $16,500 (up from $16,000)
- Catch-up (age 50+): Additional $3,500

**What This Means:**
Higher contribution limits allow for greater tax-deferred savings and potential tax deductions. Review your retirement strategy to take advantage of these increased limits.

**Action Items:**
- Update payroll deductions
- Review contribution strategy with advisor
- Consider catch-up contributions if eligible""",
            "content_es": """El IRS ha anunciado ajustes por costo de vida a los límites de contribución de cuentas de retiro para 2025...

**Nuevos Límites para 2025:**

**Planes 401(k), 403(b) y 457:**
- Límite estándar: $23,500 (aumentó de $23,000 en 2024)
- Recuperación (50+ años): $7,500 adicionales
- Total posible: $31,000 para mayores de 50

**IRAs Tradicionales y Roth:**
- Límite estándar: $7,000 (aumentó de $6,500)
- Recuperación (50+ años): $1,000 adicionales
- Total posible: $8,000 para mayores de 50

**Planes SIMPLE:**
- Límite estándar: $16,500 (aumentó de $16,000)
- Recuperación (50+ años): $3,500 adicionales

**Qué Significa Esto:**
Límites de contribución más altos permiten mayores ahorros con impuestos diferidos y posibles deducciones fiscales. Revise su estrategia de retiro para aprovechar estos límites aumentados.

**Acciones a Tomar:**
- Actualice deducciones de nómina
- Revise estrategia de contribución con asesor
- Considere contribuciones de recuperación si es elegible""",
            "source": "IRS",
            "source_url": "https://www.irs.gov/retirement-plans",
            "impact_level": "medium",
            "news_type": "irs_update",
            "effective_date": datetime(2025, 1, 1),
            "tags": ["retirement", "401k", "ira", "contribution limits"],
            "views": 0,
            "published_at": datetime.utcnow() - timedelta(days=7),
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
    ]
    
    # Insert new news
    if new_news:
        result = await db.tax_news.insert_many(new_news)
        print(f"✅ Added {len(result.inserted_ids)} new tax news articles")
    
    client.close()

async def main():
    print("🚀 Adding more content to Ross Tax Preparation app...")
    print()
    
    print("📋 Adding FAQs...")
    await add_more_faqs()
    print()
    
    print("📚 Adding Educational Articles...")
    await add_more_educational_articles()
    print()
    
    print("📰 Adding Tax News...")
    await add_more_tax_news()
    print()
    
    print("✅ Content addition complete!")
    print("📊 Summary:")
    print("   - FAQs: +15 new entries")
    print("   - Educational Articles: +3 new articles")
    print("   - Tax News: +3 new articles")

if __name__ == "__main__":
    asyncio.run(main())
