#!/usr/bin/env python3
"""
Script para poblar contenido legal y educativo en la base de datos
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Conexión a MongoDB
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.ross_tax

# Contenido para poblar
LEGAL_CONTENT = {
    "terms": {
        "type": "terms",
        "language": "es",
        "is_published": True,
        "title": "Términos y Condiciones",
        "content": """# Términos y Condiciones de Ross Tax Preparation

**Última actualización: Noviembre 2025**

## 1. Aceptación de los Términos

Al utilizar la aplicación Ross Tax y nuestros servicios de preparación de impuestos, usted acepta estos términos y condiciones en su totalidad.

## 2. Servicios Ofrecidos

Ross Tax Preparation ofrece:
- Preparación de declaraciones de impuestos federales y estatales
- Consultoría fiscal profesional
- Gestión de documentos fiscales
- Representación ante el IRS
- Asesoría financiera relacionada con impuestos

## 3. Responsabilidades del Cliente

El cliente se compromete a:
- Proporcionar información precisa y completa
- Entregar todos los documentos necesarios a tiempo
- Revisar y aprobar su declaración antes de presentarla
- Pagar los honorarios acordados

## 4. Confidencialidad

Toda la información proporcionada es estrictamente confidencial y protegida bajo las leyes de privacidad federales y estatales.

## 5. Honorarios y Pagos

- Los honorarios se establecen según la complejidad del caso
- El pago se puede realizar mediante tarjeta de crédito, débito o ACH
- Los créditos adquiridos no son reembolsables

## 6. Limitación de Responsabilidad

Ross Tax Preparation no será responsable por:
- Información incorrecta o incompleta proporcionada por el cliente
- Cambios en las leyes fiscales después de la presentación
- Penalidades del IRS por información fraudulenta del cliente

## 7. Modificaciones

Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la aplicación.

## 8. Ley Aplicable

Estos términos se rigen por las leyes del estado de Florida, Estados Unidos.

## 9. Contacto

Para preguntas sobre estos términos:
- Email: info@rosstaxpreparation.com
- Teléfono: (806) 934-2018
- Dirección: 305 Bruce Ave, Dumas, TX 79029

---

**Ross Tax Preparation LLC**
*Su socio de confianza en preparación de impuestos*
""",
        "version": "1.0",
        "effective_date": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    },
    "privacy": {
        "type": "privacy",
        "language": "es",
        "is_published": True,
        "title": "Política de Privacidad",
        "content": """# Política de Privacidad de Ross Tax Preparation

**Última actualización: Noviembre 2025**

## 1. Información que Recopilamos

### Información Personal
- Nombre completo y fecha de nacimiento
- Número de Seguro Social (SSN)
- Dirección postal y de email
- Número de teléfono
- Información financiera y fiscal

### Información Técnica
- Dirección IP y datos de dispositivo
- Cookies y datos de uso de la aplicación
- Ubicación geográfica (con su permiso)

## 2. Cómo Usamos su Información

Utilizamos su información para:
- Preparar y presentar sus declaraciones de impuestos
- Comunicarnos con usted sobre su caso
- Mejorar nuestros servicios
- Cumplir con requisitos legales y regulatorios
- Prevenir fraude y actividades ilegales

## 3. Protección de Datos

### Medidas de Seguridad
- Encriptación de extremo a extremo (TLS/SSL)
- Almacenamiento seguro con encriptación AES-256
- Acceso restringido solo a personal autorizado
- Auditorías de seguridad regulares
- Cumplimiento con estándares SOC 2

### Retención de Datos
- Mantenemos sus registros durante 7 años (requisito del IRS)
- Puede solicitar eliminación después de este período

## 4. Compartir Información

### NO Compartimos su Información con:
- Empresas de marketing
- Terceros no autorizados
- Vendedores de datos

### Compartimos SOLO Cuando es Necesario:
- Con el IRS y autoridades fiscales estatales
- Con instituciones financieras para procesar pagos
- Con proveedores de servicios bajo acuerdo de confidencialidad
- Cuando lo requiera la ley

## 5. Sus Derechos

Usted tiene derecho a:
- Acceder a su información personal
- Solicitar correcciones
- Solicitar eliminación de datos (con limitaciones legales)
- Optar por no recibir comunicaciones de marketing
- Revocar consentimientos

## 6. Cookies y Tecnologías de Seguimiento

Usamos cookies para:
- Mantener su sesión activa
- Recordar preferencias
- Analizar uso de la aplicación
- Mejorar la experiencia del usuario

Puede desactivar cookies en su navegador, pero esto puede afectar la funcionalidad.

## 7. Privacidad de Menores

No recopilamos intencionalmente información de menores de 13 años sin consentimiento parental.

## 8. Cambios en esta Política

Le notificaremos sobre cambios importantes a través de:
- Notificación en la aplicación
- Email
- Mensaje al iniciar sesión

## 9. Contacto

Para preguntas sobre privacidad:
- Email: privacy@rosstaxpreparation.com
- Teléfono: (806) 934-2018
- Dirección: 305 Bruce Ave, Dumas, TX 79029

---

**Ross Tax Preparation LLC**
*Comprometidos con su privacidad y seguridad*
""",
        "version": "1.0",
        "effective_date": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
}

FAQ_CONTENT = [
    {
        "question": "¿Cuánto tiempo toma preparar mi declaración de impuestos?",
        "answer": "El tiempo varía según la complejidad de su caso. Declaraciones simples (W-2 únicamente) pueden completarse en 1-2 días. Casos con negocios o inversiones pueden tomar 3-7 días.",
        "category": "general",
        "order": 1
    },
    {
        "question": "¿Qué documentos necesito para preparar mis impuestos?",
        "answer": """Documentos básicos necesarios:
- Formularios W-2 de todos sus empleadores
- Formularios 1099 (intereses, dividendos, freelance)
- Identificación con foto y SSN
- Recibos de deducciones (gastos médicos, donativos, etc.)
- Formulario 1098 si pagó intereses hipotecarios
- Declaración del año anterior (si es cliente nuevo)""",
        "category": "documentos",
        "order": 2
    },
    {
        "question": "¿Cuánto cuestan sus servicios?",
        "answer": """Nuestros precios varían según la complejidad:
- Declaración básica (W-2): $150-200
- Con deducciones itemizadas: $250-350
- Con negocio propio (Schedule C): $350-500
- Con propiedades de alquiler: $400-600
- Consulta inicial: GRATIS

Los precios exactos se determinan después de revisar su caso.""",
        "category": "precios",
        "order": 3
    },
    {
        "question": "¿Qué pasa si recibo una auditoría del IRS?",
        "answer": "Si es nuestro cliente y recibe una auditoría, lo representaremos ante el IRS sin costo adicional. Nuestro equipo de profesionales certificados manejará toda la comunicación y documentación necesaria.",
        "category": "legal",
        "order": 4
    },
    {
        "question": "¿Puedo agendar una cita desde la app?",
        "answer": "Sí, nuestra app permite agendar citas fácilmente. Vaya a la sección 'Citas', seleccione el tipo de servicio, fecha y hora que le convenga. Recibirá confirmación inmediata.",
        "category": "app",
        "order": 5
    },
    {
        "question": "¿Es segura mi información?",
        "answer": "Absolutamente. Usamos encriptación de nivel bancario (256-bit SSL), cumplimos con todas las regulaciones del IRS, y nuestros servidores están certificados SOC 2. Su información nunca se comparte sin su autorización.",
        "category": "seguridad",
        "order": 6
    },
    {
        "question": "¿Cuándo recibiré mi reembolso?",
        "answer": """Tiempos de reembolso típicos:
- E-file con depósito directo: 7-21 días
- E-file con cheque: 3-4 semanas
- Papel con depósito directo: 3-6 semanas
- Papel con cheque: 6-8 semanas

Puede rastrear su reembolso en IRS.gov usando "Where's My Refund".""",
        "category": "reembolsos",
        "order": 7
    },
    {
        "question": "¿Ofrecen servicios para negocios?",
        "answer": "Sí, ofrecemos servicios completos para negocios incluyendo: declaraciones corporativas, nómina, bookkeeping, planificación fiscal, y consultoría financiera. Contacte para una consulta personalizada.",
        "category": "negocios",
        "order": 8
    }
]

HELP_CONTENT = {
    "title": "Centro de Ayuda",
    "sections": [
        {
            "title": "Primeros Pasos",
            "icon": "rocket-outline",
            "content": """## Bienvenido a Ross Tax

### Crear tu Cuenta
1. Descarga la app desde App Store
2. Toca "Registrarse"
3. Ingresa tu información personal
4. Verifica tu email
5. ¡Listo para empezar!

### Tu Primer Servicio
1. Ve a "Agendar Cita"
2. Selecciona el tipo de servicio
3. Elige fecha y hora
4. Confirma tu cita
5. Recibirás un recordatorio 24 horas antes
"""
        },
        {
            "title": "Gestión de Documentos",
            "icon": "document-text-outline",
            "content": """## Documentos

### Subir Documentos
1. Toca el ícono "+" en Documentos
2. Selecciona "Tomar Foto" o "Cargar desde Galería"
3. Añade una descripción
4. Toca "Subir"

### Tipos de Documentos Aceptados
- PDF
- JPG/PNG
- DOCX
- XLSX

### Límites
- Tamaño máximo: 10MB por archivo
- Formatos soportados: todos los comunes
"""
        },
        {
            "title": "Sistema de Créditos",
            "icon": "wallet-outline",
            "content": """## Créditos Ross Tax

### ¿Qué son los Créditos?
Los créditos son nuestra moneda virtual que puedes usar para pagar servicios.

### Cómo Obtener Créditos
1. Comprar paquetes desde la app
2. Participar en promociones
3. Referir amigos
4. Bonos de bienvenida

### Usar tus Créditos
Los créditos se aplican automáticamente al pagar servicios.

### Valor
1 crédito = $1 USD
"""
        },
        {
            "title": "Citas y Consultas",
            "icon": "calendar-outline",
            "content": """## Agendar Citas

### Tipos de Citas
- Consulta Inicial (60 min) - GRATIS
- Preparación de Impuestos (90 min)
- Revisión de Documentos (45 min)
- Seguimiento (30 min)

### Cancelar o Reprogramar
- Hasta 24 horas antes: Sin cargo
- Menos de 24 horas: Cargo del 50%
- No show: Cargo del 100%

### Consultas Virtuales
Ofrecemos citas por videollamada para tu comodidad.
"""
        }
    ]
}

EDUCATIONAL_CONTENT = [
    {
        "title": "Guía Completa: Deducciones Fiscales para 2025",
        "category": "impuestos",
        "author": "Ross Tax Team",
        "content": """# Deducciones Fiscales 2025

## Deducciones Estándar vs. Itemizadas

### Deducción Estándar 2025
- Soltero: $14,600
- Casado conjunto: $29,200
- Jefe de familia: $21,900

### Cuándo Itemizar
Itemiza si tus deducciones superan la deducción estándar.

## Deducciones Comunes

### 1. Intereses Hipotecarios
- Hasta $750,000 en préstamo
- Debe ser residencia principal o secundaria

### 2. Impuestos Estatales y Locales (SALT)
- Límite: $10,000
- Incluye impuestos a la propiedad e impuestos estatales

### 3. Donaciones Caritativas
- Hasta 60% del AGI
- Organizaciones 501(c)(3) calificadas
- Requiere recibo

### 4. Gastos Médicos
- Solo si superan 7.5% del AGI
- Incluye seguros, medicamentos, tratamientos

### 5. Educación
- Crédito American Opportunity: hasta $2,500
- Crédito Lifetime Learning: hasta $2,000
- Intereses de préstamos estudiantiles: hasta $2,500

## Consejos
✅ Guarda todos los recibos
✅ Documenta todo
✅ Consulta con un profesional
❌ No inventes deducciones
❌ No exageres montos
""",
        "image_url": "",
        "published_at": datetime.utcnow(),
        "is_featured": True
    },
    {
        "title": "Impuestos para Trabajadores Independientes",
        "category": "freelance",
        "author": "Ross Tax Team",
        "content": """# Guía Fiscal para Freelancers

## Lo Básico

### ¿Quién es Trabajador Independiente?
- Freelancer
- Contractor
- Gig worker (Uber, DoorDash, etc.)
- Dueño de negocio unipersonal

## Impuestos que Debes Pagar

### 1. Impuesto sobre Ingresos (Income Tax)
- Tasas: 10% - 37%
- Basado en ingresos totales

### 2. Impuesto de Trabajo por Cuenta Propia (Self-Employment Tax)
- Tasa: 15.3%
- Cubre Social Security y Medicare
- Aplica si ganas más de $400

## Deducciones para Freelancers

### Home Office
- Porción de alquiler/hipoteca
- Servicios (luz, internet)
- Método simplificado: $5/pie cuadrado (máx $1,500)

### Equipos y Suministros
- Computadora
- Software
- Celular
- Materiales

### Transporte
- Millaje: $0.67 por milla (2025)
- Estacionamiento
- Peajes
- NO viaje al trabajo regular

### Marketing
- Sitio web
- Tarjetas de presentación
- Publicidad
- Redes sociales

## Pagos Estimados Trimestrales

### Fechas Importantes 2025
- Q1: 15 de abril
- Q2: 15 de junio  
- Q3: 15 de septiembre
- Q4: 15 de enero 2026

### Cómo Calcular
1. Estima ingresos anuales
2. Calcula impuestos (income + self-employment)
3. Divide entre 4
4. Paga cada trimestre

## Consejos Clave
✅ Separa cuentas personal y negocio
✅ Ahorra 25-30% de ingresos para impuestos
✅ Lleva registros detallados
✅ Considera un contador
✅ Paga impuestos estimados a tiempo
""",
        "image_url": "",
        "published_at": datetime.utcnow(),
        "is_featured": False
    }
]

NEWS_CONTENT = [
    {
        "title": "Cambios Importantes en las Leyes Fiscales 2025",
        "category": "actualizaciones",
        "excerpt": "El IRS anuncia actualizaciones significativas que afectan a millones de contribuyentes.",
        "content": """# Cambios Fiscales 2025

## Nuevos Límites y Tasas

El IRS ha anunciado ajustes importantes para el año fiscal 2025:

### Deducción Estándar
- Soltero: $14,600 (aumento de $300)
- Casado: $29,200 (aumento de $600)

### Contribuciones 401(k)
- Nuevo límite: $23,500 (aumento de $500)
- Catch-up (50+): $7,500 adicionales

### IRA Contributions
- Límite: $7,000
- Catch-up (50+): $1,000 adicional

## Créditos Ampliados

### Crédito por Hijo
- $2,000 por hijo calificado
- Requisitos de ingreso actualizados

### Earned Income Tax Credit
- Montos máximos aumentados
- Requisitos simplificados

## Fechas Importantes

- 15 de enero: Último pago estimado 2024
- 31 de enero: Fecha límite W-2 y 1099
- 15 de abril: Fecha límite declaración

¡Mantente informado con Ross Tax!
""",
        "image_url": "",
        "published_at": datetime.utcnow(),
        "author": "Ross Tax Team",
        "is_featured": True
    }
]

async def populate_legal_documents():
    """Poblar documentos legales"""
    print("📄 Poblando documentos legales...")
    
    for doc_type, content in LEGAL_CONTENT.items():
        # Verificar si ya existe
        existing = await db.legal_documents.find_one({"type": doc_type})
        
        if existing:
            print(f"   ⏭️  {content['title']} ya existe, actualizando...")
            # Actualizar con todos los campos
            update_data = content.copy()
            await db.legal_documents.update_one(
                {"type": doc_type},
                {"$set": update_data}
            )
        else:
            print(f"   ✅ Creando {content['title']}...")
            # Insertar nuevo documento con todos los campos
            insert_data = content.copy()
            await db.legal_documents.insert_one(insert_data)

async def populate_faq():
    """Poblar preguntas frecuentes"""
    print("\n❓ Poblando preguntas frecuentes...")
    
    # Limpiar FAQs existentes
    await db.faq.delete_many({})
    
    # Insertar nuevas FAQs
    await db.faq.insert_many(FAQ_CONTENT)
    print(f"   ✅ Creadas {len(FAQ_CONTENT)} preguntas frecuentes")

async def populate_help():
    """Poblar centro de ayuda"""
    print("\n🆘 Poblando centro de ayuda...")
    
    # Verificar si ya existe
    existing = await db.help_center.find_one({"title": HELP_CONTENT["title"]})
    
    if existing:
        print("   ⏭️  Centro de ayuda ya existe, actualizando...")
        await db.help_center.update_one(
            {"title": HELP_CONTENT["title"]},
            {"$set": HELP_CONTENT}
        )
    else:
        print("   ✅ Creando centro de ayuda...")
        await db.help_center.insert_one(HELP_CONTENT)

async def populate_educational_content():
    """Poblar contenido educativo"""
    print("\n📚 Poblando contenido educativo...")
    
    for content in EDUCATIONAL_CONTENT:
        # Verificar si ya existe
        existing = await db.educational_content.find_one({"title": content["title"]})
        
        if existing:
            print(f"   ⏭️  {content['title']} ya existe, actualizando...")
            await db.educational_content.update_one(
                {"title": content["title"]},
                {"$set": content}
            )
        else:
            print(f"   ✅ Creando {content['title']}...")
            await db.educational_content.insert_one(content)

async def populate_news():
    """Poblar noticias"""
    print("\n📰 Poblando noticias...")
    
    for news in NEWS_CONTENT:
        # Verificar si ya existe
        existing = await db.news.find_one({"title": news["title"]})
        
        if existing:
            print(f"   ⏭️  {news['title']} ya existe, actualizando...")
            await db.news.update_one(
                {"title": news["title"]},
                {"$set": news}
            )
        else:
            print(f"   ✅ Creando {news['title']}...")
            await db.news.insert_one(news)

async def main():
    """Función principal"""
    print("🚀 Iniciando población de contenido...")
    print(f"📊 Conectando a: {MONGO_URL}\n")
    
    try:
        # Verificar conexión
        await client.admin.command('ping')
        print("✅ Conexión a MongoDB exitosa\n")
        
        # Poblar contenido
        await populate_legal_documents()
        await populate_faq()
        await populate_help()
        await populate_educational_content()
        await populate_news()
        
        print("\n" + "="*50)
        print("✅ ¡Población de contenido completada exitosamente!")
        print("="*50)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
