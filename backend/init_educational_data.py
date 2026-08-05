#!/usr/bin/env python3
"""
Script para inicializar datos de contenido educativo
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'taxportal')]

INITIAL_CATEGORIES = [
    {
        "id": "educat_tax_basics",
        "name": "Tax Basics",
        "name_es": "Conceptos Básicos de Impuestos",
        "description": "Essential tax concepts everyone should know",
        "description_es": "Conceptos fiscales esenciales que todos deben conocer",
        "icon": "📊",
        "order": 1,
        "active": True
    },
    {
        "id": "educat_deductions",
        "name": "Deductions & Credits",
        "name_es": "Deducciones y Créditos",
        "description": "Maximize your tax savings",
        "description_es": "Maximiza tus ahorros fiscales",
        "icon": "💰",
        "order": 2,
        "active": True
    },
    {
        "id": "educat_business",
        "name": "Business Taxes",
        "name_es": "Impuestos Empresariales",
        "description": "Tax guide for business owners",
        "description_es": "Guía fiscal para dueños de negocios",
        "icon": "🏢",
        "order": 3,
        "active": True
    },
    {
        "id": "educat_planning",
        "name": "Tax Planning",
        "name_es": "Planificación Fiscal",
        "description": "Long-term tax strategies",
        "description_es": "Estrategias fiscales a largo plazo",
        "icon": "📅",
        "order": 4,
        "active": True
    }
]

INITIAL_ARTICLES = [
    {
        "id": "eduart_001",
        "category_id": "educat_tax_basics",
        "title": "Understanding Your W-2 Form",
        "title_es": "Entendiendo tu Formulario W-2",
        "summary": "Learn what each box on your W-2 means and how it affects your tax return.",
        "summary_es": "Aprende qué significa cada casilla de tu W-2 y cómo afecta tu declaración.",
        "content": "Your W-2 form is one of the most important tax documents you'll receive each year. Box 1 shows your taxable wages, Box 2 shows federal income tax withheld, and Box 3 shows Social Security wages. Understanding these boxes helps you verify your tax return accuracy. Keep your W-2 forms for at least 3 years after filing.",
        "content_es": "Tu formulario W-2 es uno de los documentos fiscales más importantes que recibirás cada año. La casilla 1 muestra tus salarios gravables, la casilla 2 muestra el impuesto federal retenido, y la casilla 3 muestra los salarios del Seguro Social. Entender estas casillas te ayuda a verificar la precisión de tu declaración. Guarda tus formularios W-2 por al menos 3 años después de presentarlos.",
        "level": "beginner",
        "tags": ["W-2", "forms", "basics"],
        "estimated_read_time": 5,
        "views": 0,
        "likes": 0,
        "bookmarks": 0,
        "active": True,
        "published_at": datetime.utcnow()
    },
    {
        "id": "eduart_002",
        "category_id": "educat_deductions",
        "title": "Top 10 Tax Deductions You Shouldn't Miss",
        "title_es": "Las 10 Principales Deducciones Fiscales que No Debes Perder",
        "summary": "Discover common deductions that can significantly reduce your tax bill.",
        "summary_es": "Descubre deducciones comunes que pueden reducir significativamente tu factura fiscal.",
        "content": "1. Mortgage Interest: Deduct interest on up to $750,000 of mortgage debt. 2. State and Local Taxes: Up to $10,000 deduction. 3. Charitable Donations: Keep receipts for all donations. 4. Medical Expenses: Deduct expenses exceeding 7.5% of AGI. 5. Home Office: If you're self-employed. 6. Student Loan Interest: Up to $2,500. 7. IRA Contributions: Traditional IRA contributions may be deductible. 8. Health Savings Account: Triple tax advantage. 9. Business Expenses: If self-employed. 10. Education Credits: American Opportunity or Lifetime Learning.",
        "content_es": "1. Intereses Hipotecarios: Deduce intereses en hasta $750,000 de deuda hipotecaria. 2. Impuestos Estatales y Locales: Hasta $10,000 de deducción. 3. Donaciones Caritativas: Guarda recibos de todas las donaciones. 4. Gastos Médicos: Deduce gastos que excedan el 7.5% del AGI. 5. Oficina en Casa: Si eres autónomo. 6. Intereses de Préstamos Estudiantiles: Hasta $2,500. 7. Contribuciones IRA: Las contribuciones IRA tradicionales pueden ser deducibles. 8. Cuenta de Ahorros para la Salud: Triple ventaja fiscal. 9. Gastos de Negocio: Si eres autónomo. 10. Créditos Educativos: American Opportunity o Lifetime Learning.",
        "level": "intermediate",
        "tags": ["deductions", "tax savings", "credits"],
        "estimated_read_time": 8,
        "views": 0,
        "likes": 0,
        "bookmarks": 0,
        "active": True,
        "published_at": datetime.utcnow()
    },
    {
        "id": "eduart_003",
        "category_id": "educat_business",
        "title": "LLC vs S-Corp: Which is Right for Your Business?",
        "title_es": "LLC vs S-Corp: ¿Cuál es Correcto para tu Negocio?",
        "summary": "Compare business structures and their tax implications.",
        "summary_es": "Compara estructuras empresariales y sus implicaciones fiscales.",
        "content": "LLCs offer flexibility and pass-through taxation, meaning profits and losses pass through to your personal tax return. S-Corps also have pass-through taxation but allow you to split income between salary and distributions, potentially saving on self-employment taxes. However, S-Corps have more strict requirements including reasonable salary requirements and limited ownership restrictions. Choose LLC for simplicity and flexibility. Choose S-Corp when your business profits exceed $60,000-$80,000 annually.",
        "content_es": "Las LLC ofrecen flexibilidad e impuestos de traspaso, lo que significa que las ganancias y pérdidas pasan a tu declaración personal. Las S-Corps también tienen impuestos de traspaso pero te permiten dividir ingresos entre salario y distribuciones, ahorrando potencialmente en impuestos de autoempleo. Sin embargo, las S-Corps tienen requisitos más estrictos incluyendo requisitos de salario razonable y restricciones de propiedad limitadas. Elige LLC para simplicidad y flexibilidad. Elige S-Corp cuando las ganancias de tu negocio excedan $60,000-$80,000 anuales.",
        "level": "advanced",
        "tags": ["business", "LLC", "S-Corp", "entity selection"],
        "estimated_read_time": 10,
        "views": 0,
        "likes": 0,
        "bookmarks": 0,
        "active": True,
        "published_at": datetime.utcnow()
    },
    {
        "id": "eduart_004",
        "category_id": "educat_planning",
        "title": "Year-End Tax Planning Checklist",
        "title_es": "Lista de Verificación de Planificación Fiscal de Fin de Año",
        "summary": "Essential steps to take before December 31st to optimize your taxes.",
        "summary_es": "Pasos esenciales antes del 31 de diciembre para optimizar tus impuestos.",
        "content": "Before year-end: 1. Maximize retirement contributions (401k, IRA). 2. Harvest tax losses in investment accounts. 3. Make charitable donations. 4. Pay estimated taxes if needed. 5. Consider Roth conversions. 6. Review withholdings. 7. Bunch deductions into one year. 8. Use FSA/HSA balances. 9. Review business equipment purchases for Section 179. 10. Consult with a tax professional for personalized strategies.",
        "content_es": "Antes de fin de año: 1. Maximiza contribuciones de jubilación (401k, IRA). 2. Cosecha pérdidas fiscales en cuentas de inversión. 3. Haz donaciones caritativas. 4. Paga impuestos estimados si es necesario. 5. Considera conversiones Roth. 6. Revisa retenciones. 7. Agrupa deducciones en un año. 8. Usa saldos FSA/HSA. 9. Revisa compras de equipo empresarial para Sección 179. 10. Consulta con un profesional fiscal para estrategias personalizadas.",
        "level": "intermediate",
        "tags": ["planning", "year-end", "strategy"],
        "estimated_read_time": 7,
        "views": 0,
        "likes": 0,
        "bookmarks": 0,
        "active": True,
        "published_at": datetime.utcnow()
    }
]

async def init_educational_data():
    """Inicializa categorías y artículos educativos"""
    
    print("Initializing Educational categories...")
    
    for cat in INITIAL_CATEGORIES:
        existing = await db.educational_categories.find_one({"id": cat["id"]})
        if not existing:
            cat["created_by"] = "system"
            cat["created_at"] = datetime.utcnow()
            cat["updated_at"] = datetime.utcnow()
            await db.educational_categories.insert_one(cat)
            print(f"✅ Created category: {cat['name']}")
        else:
            print(f"⏭️  Category already exists: {cat['name']}")
    
    print("\nInitializing Educational articles...")
    
    for article in INITIAL_ARTICLES:
        existing = await db.educational_articles.find_one({"id": article["id"]})
        if not existing:
            article["created_by"] = "system"
            article["updated_by"] = "system"
            article["created_at"] = datetime.utcnow()
            article["updated_at"] = datetime.utcnow()
            await db.educational_articles.insert_one(article)
            print(f"✅ Created article: {article['title'][:50]}...")
        else:
            print(f"⏭️  Article already exists: {article['title'][:50]}...")
    
    print("\n✅ Educational content initialization complete!")
    print(f"Total categories: {await db.educational_categories.count_documents({})}")
    print(f"Total articles: {await db.educational_articles.count_documents({})}")

if __name__ == "__main__":
    print("🚀 Starting Educational content initialization...\n")
    asyncio.run(init_educational_data())
    print("\n✅ Done!")