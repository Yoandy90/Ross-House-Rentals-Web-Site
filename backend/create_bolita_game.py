"""
Crear juego de La Bolita Cubana activo
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

async def create_bolita():
    """Crear la bolita cubana activa"""
    
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🎲 Creando La Bolita Cubana...")
    
    try:
        # Calcular fecha de sorteo (hoy a las 8 PM)
        draw_date = datetime.utcnow().replace(hour=20, minute=0, second=0, microsecond=0)
        if draw_date < datetime.utcnow():
            # Si ya pasó, programar para mañana
            draw_date = draw_date + timedelta(days=1)
        
        # Crear la bolita cubana
        bolita_doc = {
            "title": "La Bolita Cubana",
            "description": "Juego tradicional cubano. Elige tu número de la suerte del 0 al 99. ¡Sorteo diario a las 8 PM!",
            "lottery_type": "bolita",
            "status": "active",
            "is_active": True,
            "entry_cost": 1.0,  # 1 crédito por jugada
            "prize_pool": 100.0,  # Premio inicial
            "max_winners": 1,
            "draw_date": draw_date,
            "bolita_number_range": 100,  # 0-99
            "rules": [
                "Selecciona un número del 0 al 99",
                "Cada jugada cuesta 1 crédito",
                "Sorteo diario a las 8:00 PM",
                "Gana si tu número coincide con el número ganador",
                "Premio acumulativo"
            ],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "total_tickets_sold": 0,
            "winning_number": None,
            "winners": []
        }
        
        # Insertar en la base de datos
        result = await db.lotteries.insert_one(bolita_doc)
        
        print(f"✅ La Bolita Cubana creada exitosamente")
        print(f"   ID: {result.inserted_id}")
        print(f"   Sorteo programado para: {draw_date}")
        print(f"   Costo por jugada: {bolita_doc['entry_cost']} créditos")
        print(f"   Rango de números: 0-99")
        
        # Verificar
        lottery = await db.lotteries.find_one({"_id": result.inserted_id})
        print(f"\n📊 Verificación:")
        print(f"   - Título: {lottery['title']}")
        print(f"   - Tipo: {lottery['lottery_type']}")
        print(f"   - Estado: {lottery['status']}")
        print(f"   - Activa: {lottery['is_active']}")
        
    except Exception as e:
        print(f"❌ Error creando bolita: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_bolita())
