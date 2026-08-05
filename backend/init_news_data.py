#!/usr/bin/env python3
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'taxportal')]

INITIAL_NEWS = [
    {
        "id": "news_001",
        "title": "IRS Announces 2025 Tax Brackets and Standard Deductions",
        "title_es": "IRS Anuncia Tramos Fiscales 2025 y Deducciones Estándar",
        "summary": "Annual inflation adjustments increase tax brackets and standard deductions for 2025.",
        "summary_es": "Ajustes anuales por inflación aumentan tramos fiscales y deducciones estándar para 2025.",
        "content": "The IRS has announced inflation-adjusted tax brackets for 2025. The standard deduction increases to $15,000 for single filers and $30,000 for married couples filing jointly. Tax bracket thresholds have increased by approximately 5.4% to account for inflation. These changes will affect tax returns filed in 2026 for the 2025 tax year.",
        "content_es": "El IRS anunció los tramos fiscales ajustados por inflación para 2025. La deducción estándar aumenta a $15,000 para declarantes solteros y $30,000 para parejas casadas que declaran conjuntamente. Los umbrales de tramos fiscales aumentaron aproximadamente 5.4% para compensar la inflación. Estos cambios afectarán las declaraciones de impuestos presentadas en 2026 para el año fiscal 2025.",
        "source": "IRS",
        "source_url": "https://www.irs.gov",
        "impact_level": "high",
        "news_type": "federal",
        "tags": ["tax brackets", "standard deduction", "2025"],
        "views": 0,
        "active": True,
        "published_at": datetime.utcnow()
    },
    {
        "id": "news_002",
        "title": "New Clean Energy Tax Credits Available",
        "title_es": "Nuevos Créditos Fiscales de Energía Limpia Disponibles",
        "summary": "Expanded credits for solar panels, electric vehicles, and home energy improvements.",
        "summary_es": "Créditos ampliados para paneles solares, vehículos eléctricos y mejoras energéticas del hogar.",
        "content": "The Inflation Reduction Act provides enhanced tax credits for clean energy investments. Residential solar installations can receive up to 30% credit. Electric vehicle credits up to $7,500 for new vehicles and $4,000 for used EVs. Home energy efficiency upgrades including heat pumps and insulation qualify for credits up to $3,200 annually.",
        "content_es": "La Ley de Reducción de Inflación proporciona créditos fiscales mejorados para inversiones en energía limpia. Las instalaciones solares residenciales pueden recibir hasta 30% de crédito. Créditos de vehículos eléctricos hasta $7,500 para vehículos nuevos y $4,000 para VE usados. Las mejoras de eficiencia energética del hogar incluyendo bombas de calor y aislamiento califican para créditos hasta $3,200 anuales.",
        "source": "Department of Energy",
        "source_url": "https://www.energy.gov",
        "impact_level": "medium",
        "news_type": "federal",
        "tags": ["clean energy", "tax credits", "solar", "EV"],
        "views": 0,
        "active": True,
        "published_at": datetime.utcnow() - timedelta(days=5)
    },
    {
        "id": "news_003",
        "title": "Deadline Extension for Disaster-Affected Taxpayers",
        "title_es": "Extensión de Plazo para Contribuyentes Afectados por Desastres",
        "summary": "IRS provides automatic extensions for taxpayers in federally declared disaster areas.",
        "summary_es": "El IRS proporciona extensiones automáticas para contribuyentes en áreas de desastre declaradas federalmente.",
        "content": "Taxpayers in federally declared disaster areas receive automatic filing and payment deadline extensions. The extension typically provides an additional 6 months to file returns and pay taxes. Affected taxpayers don't need to contact the IRS to receive the extension. Check IRS.gov for a list of affected areas.",
        "content_es": "Los contribuyentes en áreas de desastre declaradas federalmente reciben extensiones automáticas de plazos de presentación y pago. La extensión típicamente proporciona 6 meses adicionales para presentar declaraciones y pagar impuestos. Los contribuyentes afectados no necesitan contactar al IRS para recibir la extensión. Consulte IRS.gov para lista de áreas afectadas.",
        "source": "IRS",
        "source_url": "https://www.irs.gov/newsroom",
        "impact_level": "high",
        "news_type": "federal",
        "tags": ["deadline", "disaster relief", "extension"],
        "views": 0,
        "active": True,
        "published_at": datetime.utcnow() - timedelta(days=2)
    }
]

async def init_news_data():
    print("Initializing Tax News...")
    for news in INITIAL_NEWS:
        existing = await db.tax_news.find_one({"id": news["id"]})
        if not existing:
            news["created_by"] = "system"
            news["updated_by"] = "system"
            news["created_at"] = datetime.utcnow()
            news["updated_at"] = datetime.utcnow()
            await db.tax_news.insert_one(news)
            print(f"✅ Created news: {news['title'][:50]}...")
        else:
            print(f"⏭️  News already exists: {news['title'][:50]}...")
    
    print(f"\n✅ Tax News initialization complete!")
    print(f"Total news: {await db.tax_news.count_documents({})}")

if __name__ == "__main__":
    print("🚀 Starting Tax News initialization...\n")
    asyncio.run(init_news_data())
    print("\n✅ Done!")
