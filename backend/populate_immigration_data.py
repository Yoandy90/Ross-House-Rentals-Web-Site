"""
Script to populate immigration services and case types for Ross Tax CRM
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")

# Immigration Case Categories
IMMIGRATION_CATEGORIES = {
    "residencia": {"name": "Residencia Permanente", "color": "#10B981", "icon": "🏠"},
    "trabajo": {"name": "Permisos de Trabajo", "color": "#3B82F6", "icon": "💼"},
    "ciudadania": {"name": "Ciudadanía", "color": "#8B5CF6", "icon": "🇺🇸"},
    "asilo": {"name": "Asilo y Refugio", "color": "#EF4444", "icon": "🛡️"},
    "familiar": {"name": "Peticiones Familiares", "color": "#EC4899", "icon": "👨‍👩‍👧‍👦"},
    "viajes": {"name": "Documentos de Viaje", "color": "#F59E0B", "icon": "✈️"},
    "visas": {"name": "Visas y Extensiones", "color": "#06B6D4", "icon": "📋"},
    "daca": {"name": "DACA", "color": "#84CC16", "icon": "🎓"},
    "otros": {"name": "Otros Trámites", "color": "#6B7280", "icon": "📁"}
}

# Immigration Case Types with USCIS forms and fees
IMMIGRATION_CASE_TYPES = [
    # RESIDENCIA
    {
        "code": "ajuste_estatus_i485",
        "name": "Ajuste de Estatus (Green Card)",
        "name_en": "Adjustment of Status (Green Card)",
        "description": "Solicitud de residencia permanente para personas que ya están en EE.UU.",
        "category": "residencia",
        "uscis_form": "I-485",
        "uscis_fee": 1225,
        "biometrics_fee": 85,
        "our_fee": 1500,
        "estimated_duration_days": 365,
        "documents_required": [
            "Pasaporte válido",
            "Acta de nacimiento con apostilla",
            "Certificado de antecedentes penales",
            "Examen médico I-693",
            "Fotos tamaño pasaporte",
            "Evidencia de estatus legal actual",
            "Declaración jurada de manutención I-864",
            "Comprobantes de ingresos del patrocinador",
            "Certificado de matrimonio (si aplica)"
        ],
        "steps": [
            "Consulta inicial y evaluación",
            "Recopilación de documentos",
            "Preparación de formularios",
            "Envío del paquete a USCIS",
            "Recibo de USCIS (Notice of Action)",
            "Cita de biométricos",
            "Entrevista (si se requiere)",
            "Decisión de USCIS"
        ],
        "is_active": True
    },
    {
        "code": "remocion_condiciones_i751",
        "name": "Remoción de Condiciones",
        "name_en": "Removal of Conditions",
        "description": "Para residentes condicionales que necesitan remover las condiciones de su green card.",
        "category": "residencia",
        "uscis_form": "I-751",
        "uscis_fee": 595,
        "biometrics_fee": 85,
        "our_fee": 800,
        "estimated_duration_days": 365,
        "documents_required": [
            "Green Card condicional",
            "Acta de matrimonio",
            "Evidencia de relación genuina",
            "Declaraciones de impuestos conjuntas",
            "Cuentas bancarias conjuntas",
            "Contrato de arrendamiento o hipoteca",
            "Fotos juntos",
            "Actas de nacimiento de hijos (si aplica)"
        ],
        "steps": [
            "Evaluación del caso",
            "Recopilación de evidencia",
            "Preparación del formulario I-751",
            "Envío dentro de los 90 días antes del vencimiento",
            "Extensión automática de 24 meses",
            "Cita de biométricos",
            "Entrevista (si se requiere)",
            "Green Card permanente de 10 años"
        ],
        "is_active": True
    },
    
    # TRABAJO
    {
        "code": "permiso_trabajo_i765",
        "name": "Permiso de Trabajo (EAD)",
        "name_en": "Employment Authorization Document",
        "description": "Autorización para trabajar legalmente en Estados Unidos.",
        "category": "trabajo",
        "uscis_form": "I-765",
        "uscis_fee": 410,
        "biometrics_fee": 85,
        "our_fee": 350,
        "estimated_duration_days": 120,
        "documents_required": [
            "Pasaporte válido",
            "Fotos tamaño pasaporte",
            "Documento que establece elegibilidad",
            "Copia del I-94",
            "EAD anterior (si es renovación)"
        ],
        "steps": [
            "Determinar categoría de elegibilidad",
            "Preparar formulario I-765",
            "Reunir documentos de soporte",
            "Envío a USCIS",
            "Recibo y cita de biométricos",
            "Recibir EAD por correo"
        ],
        "is_active": True
    },
    {
        "code": "renovacion_ead",
        "name": "Renovación de Permiso de Trabajo",
        "name_en": "EAD Renewal",
        "description": "Renovación del permiso de trabajo antes de su vencimiento.",
        "category": "trabajo",
        "uscis_form": "I-765",
        "uscis_fee": 410,
        "biometrics_fee": 85,
        "our_fee": 300,
        "estimated_duration_days": 120,
        "documents_required": [
            "EAD actual",
            "Pasaporte válido",
            "Fotos tamaño pasaporte",
            "Documento que mantiene elegibilidad"
        ],
        "steps": [
            "Verificar fecha de vencimiento",
            "Preparar solicitud de renovación",
            "Envío 180 días antes del vencimiento",
            "Extensión automática de 180 días",
            "Recibir nuevo EAD"
        ],
        "is_active": True
    },
    
    # CIUDADANÍA
    {
        "code": "naturalizacion_n400",
        "name": "Naturalización (Ciudadanía)",
        "name_en": "Naturalization",
        "description": "Proceso para convertirse en ciudadano estadounidense.",
        "category": "ciudadania",
        "uscis_form": "N-400",
        "uscis_fee": 725,
        "biometrics_fee": 85,
        "our_fee": 1000,
        "estimated_duration_days": 300,
        "documents_required": [
            "Green Card",
            "Pasaporte",
            "Acta de nacimiento",
            "Declaraciones de impuestos (5 años)",
            "Historial de viajes",
            "Certificado de matrimonio (si aplica)",
            "Decretos de divorcio (si aplica)",
            "Registros de arresto (si aplica)"
        ],
        "steps": [
            "Verificar elegibilidad (5 años residencia)",
            "Preparar formulario N-400",
            "Estudiar para el examen cívico",
            "Envío a USCIS",
            "Cita de biométricos",
            "Entrevista y examen",
            "Ceremonia de juramento",
            "Recibir certificado de ciudadanía"
        ],
        "is_active": True
    },
    {
        "code": "certificado_ciudadania_n600",
        "name": "Certificado de Ciudadanía",
        "name_en": "Certificate of Citizenship",
        "description": "Para personas que adquirieron ciudadanía automáticamente.",
        "category": "ciudadania",
        "uscis_form": "N-600",
        "uscis_fee": 1170,
        "biometrics_fee": 0,
        "our_fee": 600,
        "estimated_duration_days": 180,
        "documents_required": [
            "Acta de nacimiento",
            "Prueba de ciudadanía del padre/madre",
            "Certificado de naturalización del padre",
            "Prueba de residencia del padre en EE.UU.",
            "Acta de matrimonio de los padres"
        ],
        "steps": [
            "Determinar si califica",
            "Reunir evidencia de ciudadanía derivada",
            "Preparar formulario N-600",
            "Envío a USCIS",
            "Entrevista (si se requiere)",
            "Recibir certificado"
        ],
        "is_active": True
    },
    
    # FAMILIAR
    {
        "code": "peticion_familiar_i130",
        "name": "Petición Familiar",
        "name_en": "Family Petition",
        "description": "Petición de ciudadano o residente para familiar.",
        "category": "familiar",
        "uscis_form": "I-130",
        "uscis_fee": 535,
        "biometrics_fee": 0,
        "our_fee": 800,
        "estimated_duration_days": 540,
        "documents_required": [
            "Prueba de ciudadanía/residencia del peticionario",
            "Acta de nacimiento del beneficiario",
            "Acta de matrimonio (para cónyuge)",
            "Fotos del peticionario y beneficiario",
            "Prueba de relación familiar"
        ],
        "steps": [
            "Determinar categoría de preferencia",
            "Preparar formulario I-130",
            "Reunir evidencia de relación",
            "Envío a USCIS",
            "Esperar aprobación",
            "Proceso consular o ajuste de estatus"
        ],
        "is_active": True
    },
    {
        "code": "declaracion_manutencion_i864",
        "name": "Declaración de Manutención",
        "name_en": "Affidavit of Support",
        "description": "Declaración jurada de apoyo financiero para inmigrante.",
        "category": "familiar",
        "uscis_form": "I-864",
        "uscis_fee": 0,
        "biometrics_fee": 0,
        "our_fee": 200,
        "estimated_duration_days": 14,
        "documents_required": [
            "Declaraciones de impuestos (3 años)",
            "Carta de empleo",
            "Talones de pago recientes",
            "Estados de cuenta bancarios",
            "Prueba de estatus migratorio del patrocinador"
        ],
        "steps": [
            "Verificar ingresos del patrocinador",
            "Reunir documentos financieros",
            "Calcular si cumple con 125% de pobreza",
            "Buscar co-patrocinador si es necesario",
            "Preparar formulario I-864"
        ],
        "is_active": True
    },
    
    # ASILO
    {
        "code": "asilo_i589",
        "name": "Solicitud de Asilo",
        "name_en": "Asylum Application",
        "description": "Protección para personas que huyen de persecución.",
        "category": "asilo",
        "uscis_form": "I-589",
        "uscis_fee": 0,
        "biometrics_fee": 0,
        "our_fee": 3000,
        "estimated_duration_days": 365,
        "documents_required": [
            "Pasaporte",
            "I-94",
            "Declaración personal detallada",
            "Evidencia de persecución",
            "Reportes de país",
            "Cartas de testigos",
            "Documentos médicos (si aplica)",
            "Fotos de lesiones (si aplica)"
        ],
        "steps": [
            "Consulta inicial confidencial",
            "Preparar declaración personal",
            "Reunir evidencia de persecución",
            "Envío dentro de 1 año de llegada",
            "Cita de biométricos",
            "Entrevista en oficina de asilo",
            "Decisión (aprobación/referido a corte)"
        ],
        "is_active": True
    },
    {
        "code": "ead_asilo_c8",
        "name": "Permiso de Trabajo (Asilado)",
        "name_en": "Asylum-Based EAD",
        "description": "Permiso de trabajo para solicitantes de asilo después de 180 días.",
        "category": "asilo",
        "uscis_form": "I-765 (c)(8)",
        "uscis_fee": 0,
        "biometrics_fee": 85,
        "our_fee": 300,
        "estimated_duration_days": 90,
        "documents_required": [
            "Recibo del I-589",
            "Pasaporte o documento de identidad",
            "Fotos tamaño pasaporte",
            "Prueba de que han pasado 180 días"
        ],
        "steps": [
            "Esperar 150 días después de enviar I-589",
            "Verificar que caso no ha sido denegado",
            "Preparar I-765 categoría (c)(8)",
            "Envío a USCIS",
            "Recibir EAD"
        ],
        "is_active": True
    },
    
    # VIAJES
    {
        "code": "advance_parole_i131",
        "name": "Permiso de Viaje (Advance Parole)",
        "name_en": "Advance Parole",
        "description": "Documento para viajar mientras hay una solicitud pendiente.",
        "category": "viajes",
        "uscis_form": "I-131",
        "uscis_fee": 575,
        "biometrics_fee": 85,
        "our_fee": 350,
        "estimated_duration_days": 90,
        "documents_required": [
            "Pasaporte",
            "Recibo de solicitud pendiente",
            "Fotos tamaño pasaporte",
            "Prueba de necesidad de viaje"
        ],
        "steps": [
            "Verificar elegibilidad",
            "Preparar formulario I-131",
            "Explicar razón del viaje",
            "Envío a USCIS",
            "Esperar aprobación antes de viajar"
        ],
        "is_active": True
    },
    {
        "code": "documento_viaje_refugiado",
        "name": "Documento de Viaje para Refugiado",
        "name_en": "Refugee Travel Document",
        "description": "Documento de viaje para refugiados y asilados.",
        "category": "viajes",
        "uscis_form": "I-131",
        "uscis_fee": 135,
        "biometrics_fee": 85,
        "our_fee": 300,
        "estimated_duration_days": 120,
        "documents_required": [
            "Prueba de estatus de asilo/refugio",
            "Fotos tamaño pasaporte",
            "Green Card (si tiene)"
        ],
        "steps": [
            "Verificar estatus de refugiado/asilado",
            "Preparar formulario I-131",
            "Cita de biométricos",
            "Recibir documento de viaje"
        ],
        "is_active": True
    },
    
    # VISAS
    {
        "code": "extension_visa_i539",
        "name": "Extensión de Visa",
        "name_en": "Visa Extension",
        "description": "Extensión del período de estadía autorizado.",
        "category": "visas",
        "uscis_form": "I-539",
        "uscis_fee": 370,
        "biometrics_fee": 85,
        "our_fee": 450,
        "estimated_duration_days": 120,
        "documents_required": [
            "Pasaporte válido",
            "I-94 actual",
            "Visa actual",
            "Prueba de fondos suficientes",
            "Carta explicando razón de extensión",
            "Prueba de lazos con país de origen"
        ],
        "steps": [
            "Verificar elegibilidad para extensión",
            "Preparar formulario I-539",
            "Envío antes de vencimiento del I-94",
            "Cita de biométricos",
            "Esperar decisión"
        ],
        "is_active": True
    },
    {
        "code": "cambio_estatus_i539",
        "name": "Cambio de Estatus",
        "name_en": "Change of Status",
        "description": "Cambiar de una categoría de visa a otra.",
        "category": "visas",
        "uscis_form": "I-539",
        "uscis_fee": 370,
        "biometrics_fee": 85,
        "our_fee": 500,
        "estimated_duration_days": 150,
        "documents_required": [
            "Pasaporte válido",
            "I-94 actual",
            "Documentos que apoyan nuevo estatus",
            "Prueba de fondos",
            "Carta de aceptación (si estudiante)"
        ],
        "steps": [
            "Determinar nueva categoría de visa",
            "Preparar formulario I-539",
            "Reunir evidencia para nuevo estatus",
            "Envío a USCIS",
            "Cita de biométricos",
            "Esperar aprobación"
        ],
        "is_active": True
    },
    
    # DACA
    {
        "code": "renovacion_daca",
        "name": "Renovación de DACA",
        "name_en": "DACA Renewal",
        "description": "Renovación del estatus de Acción Diferida.",
        "category": "daca",
        "uscis_form": "I-821D",
        "uscis_fee": 410,
        "biometrics_fee": 85,
        "our_fee": 500,
        "estimated_duration_days": 120,
        "documents_required": [
            "EAD de DACA anterior",
            "Pasaporte o ID",
            "Fotos tamaño pasaporte",
            "Prueba de presencia continua",
            "Registros escolares o de empleo"
        ],
        "steps": [
            "Verificar elegibilidad para renovación",
            "Preparar formularios I-821D, I-765, I-765WS",
            "Envío 150 días antes del vencimiento",
            "Cita de biométricos",
            "Recibir nuevo EAD"
        ],
        "is_active": True
    },
    
    # OTROS
    {
        "code": "reemplazo_green_card_i90",
        "name": "Reemplazo de Green Card",
        "name_en": "Green Card Replacement",
        "description": "Reemplazo de tarjeta perdida, robada o dañada.",
        "category": "otros",
        "uscis_form": "I-90",
        "uscis_fee": 455,
        "biometrics_fee": 85,
        "our_fee": 300,
        "estimated_duration_days": 180,
        "documents_required": [
            "Green Card actual (si está disponible)",
            "Pasaporte",
            "Fotos tamaño pasaporte",
            "Reporte de policía (si fue robada)"
        ],
        "steps": [
            "Determinar razón del reemplazo",
            "Preparar formulario I-90",
            "Envío a USCIS",
            "Cita de biométricos",
            "Recibir nueva Green Card"
        ],
        "is_active": True
    },
    {
        "code": "permiso_reentrada_i131",
        "name": "Permiso de Reentrada",
        "name_en": "Reentry Permit",
        "description": "Para residentes que planean estar fuera de EE.UU. por más de 1 año.",
        "category": "otros",
        "uscis_form": "I-131",
        "uscis_fee": 575,
        "biometrics_fee": 85,
        "our_fee": 400,
        "estimated_duration_days": 120,
        "documents_required": [
            "Green Card",
            "Pasaporte",
            "Fotos tamaño pasaporte",
            "Carta explicando razón del viaje"
        ],
        "steps": [
            "Verificar necesidad del permiso",
            "Preparar formulario I-131",
            "Cita de biométricos (antes de salir)",
            "Recibir permiso de reentrada"
        ],
        "is_active": True
    }
]

# USCIS Fee Schedule 2024-2025
USCIS_FEES = {
    "I-130": {"name": "Petición de Familiar Extranjero", "fee": 535},
    "I-131": {"name": "Documento de Viaje", "fee": 575},
    "I-140": {"name": "Petición de Trabajador Inmigrante", "fee": 700},
    "I-485": {"name": "Ajuste de Estatus", "fee": 1225},
    "I-539": {"name": "Extensión/Cambio de Estatus", "fee": 370},
    "I-589": {"name": "Asilo", "fee": 0},
    "I-751": {"name": "Remoción de Condiciones", "fee": 595},
    "I-765": {"name": "Permiso de Trabajo", "fee": 410},
    "I-821D": {"name": "DACA", "fee": 410},
    "I-864": {"name": "Declaración de Manutención", "fee": 0},
    "I-90": {"name": "Renovar/Reemplazar Green Card", "fee": 455},
    "N-400": {"name": "Naturalización", "fee": 725},
    "N-600": {"name": "Certificado de Ciudadanía", "fee": 1170},
    "biometrics": {"name": "Cita de Biométricos", "fee": 85}
}

async def populate_immigration_data():
    """Populate immigration categories, case types, and fee schedule"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.rosstax
    
    print("🌎 Iniciando población de datos de inmigración...")
    
    # 1. Save categories
    print("\n📁 Guardando categorías...")
    await db.immigration_categories.delete_many({})
    for code, data in IMMIGRATION_CATEGORIES.items():
        await db.immigration_categories.update_one(
            {"code": code},
            {"$set": {**data, "code": code, "updated_at": datetime.utcnow()}},
            upsert=True
        )
    print(f"   ✅ {len(IMMIGRATION_CATEGORIES)} categorías guardadas")
    
    # 2. Save case types
    print("\n📋 Guardando tipos de casos...")
    for case_type in IMMIGRATION_CASE_TYPES:
        existing = await db.immigration_case_types.find_one({"code": case_type["code"]})
        if existing:
            await db.immigration_case_types.update_one(
                {"code": case_type["code"]},
                {"$set": {**case_type, "updated_at": datetime.utcnow()}}
            )
            print(f"   📝 Actualizado: {case_type['name']}")
        else:
            await db.immigration_case_types.insert_one({
                **case_type,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            print(f"   ✅ Creado: {case_type['name']}")
    print(f"   Total: {len(IMMIGRATION_CASE_TYPES)} tipos de casos")
    
    # 3. Save USCIS fees
    print("\n💰 Guardando tarifas USCIS...")
    await db.uscis_fees.delete_many({})
    for form, data in USCIS_FEES.items():
        await db.uscis_fees.insert_one({
            "form": form,
            **data,
            "updated_at": datetime.utcnow()
        })
    print(f"   ✅ {len(USCIS_FEES)} tarifas guardadas")
    
    # 4. Create indexes
    print("\n🔍 Creando índices...")
    await db.immigration_case_types.create_index("code", unique=True)
    await db.immigration_case_types.create_index("category")
    await db.immigration_case_types.create_index("is_active")
    await db.immigration_cases.create_index("client_id")
    await db.immigration_cases.create_index("case_type")
    await db.immigration_cases.create_index("status")
    await db.immigration_cases.create_index("created_at")
    print("   ✅ Índices creados")
    
    print("\n🎉 ¡Datos de inmigración poblados exitosamente!")
    
    # Summary
    total_types = await db.immigration_case_types.count_documents({})
    active_types = await db.immigration_case_types.count_documents({"is_active": True})
    print(f"\n📊 Resumen:")
    print(f"   - Categorías: {len(IMMIGRATION_CATEGORIES)}")
    print(f"   - Tipos de casos: {total_types} ({active_types} activos)")
    print(f"   - Tarifas USCIS: {len(USCIS_FEES)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(populate_immigration_data())
