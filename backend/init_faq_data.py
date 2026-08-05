#!/usr/bin/env python3
"""
Script para inicializar datos de FAQs
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Conectar a la base de datos
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'taxportal')]

# Categorías iniciales
INITIAL_CATEGORIES = [
    {
        "id": "cat_general",
        "name": "General",
        "name_es": "General",
        "description": "General questions about our services",
        "description_es": "Preguntas generales sobre nuestros servicios",
        "icon": "ℹ️",
        "order": 1,
        "active": True
    },
    {
        "id": "cat_taxes",
        "name": "Taxes",
        "name_es": "Impuestos",
        "description": "Tax-related questions",
        "description_es": "Preguntas relacionadas con impuestos",
        "icon": "💼",
        "order": 2,
        "active": True
    },
    {
        "id": "cat_appointments",
        "name": "Appointments",
        "name_es": "Citas",
        "description": "Scheduling and appointments",
        "description_es": "Programación y citas",
        "icon": "📅",
        "order": 3,
        "active": True
    },
    {
        "id": "cat_documents",
        "name": "Documents",
        "name_es": "Documentos",
        "description": "Document requirements and uploads",
        "description_es": "Requisitos de documentos y subidas",
        "icon": "📄",
        "order": 4,
        "active": True
    },
    {
        "id": "cat_payments",
        "name": "Payments",
        "name_es": "Pagos",
        "description": "Payment methods and billing",
        "description_es": "Métodos de pago y facturación",
        "icon": "💳",
        "order": 5,
        "active": True
    }
]

# FAQs iniciales
INITIAL_FAQS = [
    {
        "id": "faq_001",
        "category_id": "cat_general",
        "question": "What services do you offer?",
        "question_es": "¿Qué servicios ofrecen?",
        "answer": "We offer comprehensive tax preparation services including individual tax returns, business taxes, tax planning, and IRS representation.",
        "answer_es": "Ofrecemos servicios completos de preparación de impuestos incluyendo declaraciones individuales, impuestos comerciales, planificación fiscal y representación ante el IRS.",
        "tags": ["services", "general"],
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "order": 1,
        "active": True
    },
    {
        "id": "faq_002",
        "category_id": "cat_general",
        "question": "What are your business hours?",
        "question_es": "¿Cuáles son sus horarios de atención?",
        "answer": "We are open Monday to Friday from 9:00 AM to 6:00 PM, and Saturdays from 10:00 AM to 2:00 PM. We are closed on Sundays and major holidays.",
        "answer_es": "Estamos abiertos de lunes a viernes de 9:00 AM a 6:00 PM, y sábados de 10:00 AM a 2:00 PM. Cerramos los domingos y días festivos principales.",
        "tags": ["hours", "schedule"],
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "order": 2,
        "active": True
    },
    {
        "id": "faq_003",
        "category_id": "cat_taxes",
        "question": "When should I file my taxes?",
        "question_es": "¿Cuándo debo presentar mis impuestos?",
        "answer": "The tax filing deadline is typically April 15th. However, we recommend starting early to ensure accuracy and maximize your refund.",
        "answer_es": "La fecha límite para presentar impuestos es típicamente el 15 de abril. Sin embargo, recomendamos comenzar temprano para asegurar precisión y maximizar su reembolso.",
        "tags": ["deadline", "filing"],
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "order": 1,
        "active": True
    },
    {
        "id": "faq_004",
        "category_id": "cat_taxes",
        "question": "What documents do I need for tax filing?",
        "question_es": "¿Qué documentos necesito para presentar impuestos?",
        "answer": "You'll need your W-2 forms, 1099 forms, ID, Social Security card, and any documents related to deductions like mortgage interest, charitable donations, or business expenses.",
        "answer_es": "Necesitará sus formularios W-2, formularios 1099, identificación, tarjeta de Seguro Social y cualquier documento relacionado con deducciones como intereses hipotecarios, donaciones caritativas o gastos comerciales.",
        "tags": ["documents", "requirements"],
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "order": 2,
        "active": True
    },
    {
        "id": "faq_005",
        "category_id": "cat_appointments",
        "question": "How do I schedule an appointment?",
        "question_es": "¿Cómo programo una cita?",
        "answer": "You can schedule an appointment through our mobile app, by calling us, or by visiting our office. Online scheduling is available 24/7.",
        "answer_es": "Puede programar una cita a través de nuestra aplicación móvil, llamándonos o visitando nuestra oficina. La programación en línea está disponible 24/7.",
        "tags": ["scheduling", "appointment"],
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "order": 1,
        "active": True
    },
    {
        "id": "faq_006",
        "category_id": "cat_payments",
        "question": "What payment methods do you accept?",
        "question_es": "¿Qué métodos de pago aceptan?",
        "answer": "We accept cash, credit cards (Visa, MasterCard, American Express), debit cards, and ACH transfers. Payment plans are available for larger services.",
        "answer_es": "Aceptamos efectivo, tarjetas de crédito (Visa, MasterCard, American Express), tarjetas de débito y transferencias ACH. Planes de pago están disponibles para servicios más grandes.",
        "tags": ["payment", "methods"],
        "views": 0,
        "helpful_count": 0,
        "not_helpful_count": 0,
        "order": 1,
        "active": True
    }
]

async def init_faq_data():
    """Inicializa categorías y FAQs"""
    from datetime import datetime
    
    print("Initializing FAQ categories...")
    
    # Insertar categorías
    for cat in INITIAL_CATEGORIES:
        existing = await db.faq_categories.find_one({"id": cat["id"]})
        if not existing:
            cat["created_by"] = "system"
            cat["created_at"] = datetime.utcnow()
            cat["updated_at"] = datetime.utcnow()
            await db.faq_categories.insert_one(cat)
            print(f"✅ Created category: {cat['name']}")
        else:
            print(f"⏭️  Category already exists: {cat['name']}")
    
    print("\nInitializing FAQs...")
    
    # Insertar FAQs
    for faq in INITIAL_FAQS:
        existing = await db.faqs.find_one({"id": faq["id"]})
        if not existing:
            faq["created_by"] = "system"
            faq["updated_by"] = "system"
            faq["created_at"] = datetime.utcnow()
            faq["updated_at"] = datetime.utcnow()
            await db.faqs.insert_one(faq)
            print(f"✅ Created FAQ: {faq['question'][:50]}...")
        else:
            print(f"⏭️  FAQ already exists: {faq['question'][:50]}...")
    
    print("\n✅ FAQ initialization complete!")
    print(f"Total categories: {await db.faq_categories.count_documents({})}")
    print(f"Total FAQs: {await db.faqs.count_documents({})}")

if __name__ == "__main__":
    print("🚀 Starting FAQ data initialization...\n")
    asyncio.run(init_faq_data())
    print("\n✅ Done!")