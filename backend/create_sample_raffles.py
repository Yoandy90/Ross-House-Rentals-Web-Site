"""
Crear sorteos de ejemplo para la página de lotería
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "taxportal")

async def create_sample_raffles():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 70)
    print("CREANDO SORTEOS DE EJEMPLO PARA LOTERÍA")
    print("=" * 70)
    
    # Limpiar sorteos anteriores de ejemplo
    await db.raffles.delete_many({"id": {"$regex": "^sample_"}})
    
    sample_raffles = [
        {
            "id": f"sample_raffle_{uuid.uuid4().hex[:8]}",
            "title": "🎉 Gran Sorteo de Año Nuevo",
            "title_es": "🎉 Gran Sorteo de Año Nuevo",
            "description": "Win $500 in Ross Tax Credits! Perfect for your next tax season.",
            "description_es": "¡Gana $500 en Créditos Ross Tax! Perfecto para tu próxima temporada de impuestos.",
            "prize_type": "credits",
            "prize_value": "$500 en Créditos Ross Tax",
            "prize_credits": 500,
            "ticket_price": 10,
            "max_tickets_per_user": 10,
            "total_tickets": 100,
            "tickets_sold": 45,
            "participants_count": 23,
            "status": "active",
            "start_date": datetime.utcnow(),
            "end_date": datetime.utcnow() + timedelta(days=15),
            "image_url": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "active": True
        },
        {
            "id": f"sample_raffle_{uuid.uuid4().hex[:8]}",
            "title": "💎 Sorteo Premium",
            "title_es": "💎 Sorteo Premium",
            "description": "Free complete tax preparation service + consultation ($300 value)",
            "description_es": "Servicio completo de preparación de impuestos GRATIS + consulta (valor $300)",
            "prize_type": "service",
            "prize_value": "Preparación de Impuestos Completa",
            "prize_credits": None,
            "ticket_price": 20,
            "max_tickets_per_user": 5,
            "total_tickets": 50,
            "tickets_sold": 32,
            "participants_count": 18,
            "status": "active",
            "start_date": datetime.utcnow(),
            "end_date": datetime.utcnow() + timedelta(days=10),
            "image_url": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "active": True
        },
        {
            "id": f"sample_raffle_{uuid.uuid4().hex[:8]}",
            "title": "🌟 Sorteo Flash",
            "title_es": "🌟 Sorteo Flash",
            "description": "Quick draw! 100 credits - Only 30 tickets available!",
            "description_es": "¡Sorteo rápido! 100 créditos - ¡Solo 30 tickets disponibles!",
            "prize_type": "credits",
            "prize_value": "100 Créditos Ross Tax",
            "prize_credits": 100,
            "ticket_price": 5,
            "max_tickets_per_user": 3,
            "total_tickets": 30,
            "tickets_sold": 18,
            "participants_count": 12,
            "status": "active",
            "start_date": datetime.utcnow(),
            "end_date": datetime.utcnow() + timedelta(days=3),
            "image_url": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "active": True
        },
        {
            "id": f"sample_raffle_{uuid.uuid4().hex[:8]}",
            "title": "🎁 Sorteo Especial Referidos",
            "title_es": "🎁 Sorteo Especial Referidos",
            "description": "50% discount on tax preparation + 200 credits bonus",
            "description_es": "50% descuento en preparación de impuestos + 200 créditos de bonificación",
            "prize_type": "discount",
            "prize_value": "50% Descuento + 200 Créditos",
            "prize_credits": 200,
            "ticket_price": 15,
            "max_tickets_per_user": 5,
            "total_tickets": 75,
            "tickets_sold": 28,
            "participants_count": 15,
            "status": "active",
            "start_date": datetime.utcnow(),
            "end_date": datetime.utcnow() + timedelta(days=20),
            "image_url": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "active": True
        },
        {
            "id": f"sample_raffle_{uuid.uuid4().hex[:8]}",
            "title": "🏆 Mega Sorteo Mensual",
            "title_es": "🏆 Mega Sorteo Mensual",
            "description": "Grand prize: $1,000 in credits + Free services for one year!",
            "description_es": "Premio mayor: ¡$1,000 en créditos + Servicios gratis por un año!",
            "prize_type": "credits",
            "prize_value": "$1,000 + Servicios Anuales",
            "prize_credits": 1000,
            "ticket_price": 25,
            "max_tickets_per_user": 20,
            "total_tickets": 200,
            "tickets_sold": 87,
            "participants_count": 45,
            "status": "active",
            "start_date": datetime.utcnow(),
            "end_date": datetime.utcnow() + timedelta(days=30),
            "image_url": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "active": True
        }
    ]
    
    # Insertar sorteos
    if sample_raffles:
        result = await db.raffles.insert_many(sample_raffles)
        print(f"\n✅ Creados {len(result.inserted_ids)} sorteos de ejemplo")
        
        print("\n📋 Sorteos creados:")
        for raffle in sample_raffles:
            print(f"   • {raffle['title']}")
            print(f"     - Premio: {raffle['prize_value']}")
            print(f"     - Precio: {raffle['ticket_price']} créditos")
            print(f"     - Vendidos: {raffle['tickets_sold']}/{raffle['total_tickets']}")
            print(f"     - Termina: {raffle['end_date'].strftime('%Y-%m-%d')}")
    
    print("\n" + "=" * 70)
    print("✅ SORTEOS DE EJEMPLO CREADOS EXITOSAMENTE")
    print("=" * 70)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_sample_raffles())
