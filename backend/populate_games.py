"""
Script para poblar la base de datos de producción con juegos de ejemplo
Sorteos, Loterías y Raspaditos
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Configuración de MongoDB
MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'taxportal')

async def populate_raffles(db):
    """Crear sorteos de ejemplo"""
    print("📦 Creando sorteos...")
    
    raffles = [
        {
            'title': '🎁 Gran Sorteo de Navidad',
            'description': '¡Participa y gana $500 en créditos para tus servicios de impuestos! Sorteo especial de temporada.',
            'prize_type': 'credits',
            'prize_value': '$500 en Créditos Ross Tax',
            'prize_credits': 500,
            'ticket_price': 5,
            'max_tickets_per_user': 10,
            'total_tickets': 200,
            'end_date': datetime.now(timezone.utc) + timedelta(days=30),
            'image_url': 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=800',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'El ganador será seleccionado aleatoriamente. Se notificará por SMS y email.'
        },
        {
            'title': '💼 Consulta Gratis de Impuestos',
            'description': 'Gana una consulta completa de impuestos totalmente gratis con nuestros expertos certificados.',
            'prize_type': 'service',
            'prize_value': 'Consulta de Impuestos Completa (valor $150)',
            'prize_credits': None,
            'ticket_price': 3,
            'max_tickets_per_user': 15,
            'total_tickets': 150,
            'end_date': datetime.now(timezone.utc) + timedelta(days=20),
            'image_url': 'https://images.unsplash.com/photo-1554224311-beee460c201f?w=800',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Válido para consultas de hasta 90 minutos.'
        },
        {
            'title': '🎉 Sorteo Semanal - $100',
            'description': 'Sorteo semanal de $100 en créditos. ¡Participa cada semana y aumenta tus posibilidades!',
            'prize_type': 'credits',
            'prize_value': '$100 en Créditos',
            'prize_credits': 100,
            'ticket_price': 2,
            'max_tickets_per_user': 20,
            'total_tickets': 100,
            'end_date': datetime.now(timezone.utc) + timedelta(days=7),
            'image_url': 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Sorteo realizado cada domingo a las 8 PM.'
        },
        {
            'title': '🏆 Mega Premio - iPhone 15 Pro',
            'description': '¡Gana el último iPhone 15 Pro! Un premio increíble por solo 10 créditos el boleto.',
            'prize_type': 'product',
            'prize_value': 'iPhone 15 Pro 256GB (valor $1,200)',
            'prize_credits': None,
            'ticket_price': 10,
            'max_tickets_per_user': 5,
            'total_tickets': 300,
            'end_date': datetime.now(timezone.utc) + timedelta(days=45),
            'image_url': 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Entrega del premio en nuestra oficina o envío gratis a tu domicilio.'
        }
    ]
    
    result = await db.raffles.insert_many(raffles)
    print(f"✅ {len(result.inserted_ids)} sorteos creados")
    return result.inserted_ids

async def populate_lotteries(db):
    """Crear loterías de ejemplo"""
    print("🎲 Creando loterías...")
    
    lotteries = [
        {
            'title': '🔢 La Bolita Cubana Diaria',
            'description': 'Juega a la tradicional Bolita Cubana. Elige tu número de la suerte del 00 al 99 y gana hasta 80 veces tu apuesta.',
            'lottery_type': 'bolita',
            'prize_type': 'credits',
            'prize_value': 'Hasta 80x tu apuesta',
            'prize_credits': None,
            'ticket_price': 2,
            'numbers_to_pick': 1,
            'number_range_min': 0,
            'number_range_max': 99,
            'draw_frequency': 'daily',
            'next_draw': datetime.now(timezone.utc) + timedelta(hours=12),
            'status': 'active',
            'is_active': True,
            'total_pot': 0,
            'tickets_sold': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'rules': 'Selecciona un número del 00 al 99. Si tu número coincide con el sorteo, ganas 80 veces tu apuesta.'
        },
        {
            'title': '🎰 Lotería Tradicional 6/49',
            'description': 'Lotería tradicional estilo Powerball. Elige 6 números del 1 al 49 y gana el jackpot acumulado.',
            'lottery_type': 'traditional',
            'prize_type': 'credits',
            'prize_value': 'Jackpot Acumulado',
            'prize_credits': 5000,
            'ticket_price': 5,
            'numbers_to_pick': 6,
            'number_range_min': 1,
            'number_range_max': 49,
            'draw_frequency': 'weekly',
            'next_draw': datetime.now(timezone.utc) + timedelta(days=5),
            'status': 'active',
            'is_active': True,
            'jackpot': 5000,
            'total_pot': 0,
            'tickets_sold': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'rules': 'Selecciona 6 números únicos. Gana si coinciden todos (jackpot) o al menos 3 números (premio menor).'
        }
    ]
    
    result = await db.lotteries.insert_many(lotteries)
    print(f"✅ {len(result.inserted_ids)} loterías creadas")
    return result.inserted_ids

async def populate_scratch_cards(db):
    """Crear raspaditos de ejemplo"""
    print("🎟️ Creando raspaditos...")
    
    # Los raspaditos son del tipo lottery con lottery_type='scratch_card'
    scratch_cards = [
        {
            'title': '💰 Raspadito Millonario',
            'description': '¡Raspa y gana al instante! Premios desde $10 hasta $1,000 en créditos.',
            'lottery_type': 'scratch_card',
            'prize_type': 'credits',
            'prize_value': 'Hasta $1,000',
            'prize_credits': 1000,
            'ticket_price': 5,
            'win_probability': 0.25,  # 25% de probabilidad de ganar
            'possible_prizes': [10, 25, 50, 100, 250, 500, 1000],
            'status': 'active',
            'is_active': True,
            'tickets_sold': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'rules': 'Compra tu raspadito y descubre al instante si ganaste. 1 de cada 4 raspaditos gana un premio.'
        },
        {
            'title': '🍀 Raspadito de la Suerte',
            'description': 'Raspadito económico con premios garantizados. ¡Prueba tu suerte por solo 2 créditos!',
            'lottery_type': 'scratch_card',
            'prize_type': 'credits',
            'prize_value': 'Hasta $100',
            'prize_credits': 100,
            'ticket_price': 2,
            'win_probability': 0.30,  # 30% de probabilidad
            'possible_prizes': [5, 10, 20, 50, 100],
            'status': 'active',
            'is_active': True,
            'tickets_sold': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'rules': 'Descubre al instante si ganaste. Premios pequeños pero más probabilidades de ganar.'
        },
        {
            'title': '🎁 Raspadito Premium',
            'description': 'El raspadito de los grandes premios. Mayor inversión, mayores recompensas.',
            'lottery_type': 'scratch_card',
            'prize_type': 'credits',
            'prize_value': 'Hasta $2,500',
            'prize_credits': 2500,
            'ticket_price': 10,
            'win_probability': 0.20,  # 20% de probabilidad
            'possible_prizes': [25, 50, 100, 250, 500, 1000, 2500],
            'status': 'active',
            'is_active': True,
            'tickets_sold': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'rules': 'Raspadito premium con los mejores premios. Menor probabilidad pero mayores ganancias.'
        }
    ]
    
    result = await db.lotteries.insert_many(scratch_cards)
    print(f"✅ {len(result.inserted_ids)} raspaditos creados")
    return result.inserted_ids

async def main():
    """Función principal"""
    print("🚀 Iniciando población de base de datos...")
    print(f"📊 Base de datos: {DB_NAME}")
    
    # Conectar a MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Poblar cada tipo de juego
        await populate_raffles(db)
        await populate_lotteries(db)
        await populate_scratch_cards(db)
        
        print("\n🎉 ¡Base de datos poblada exitosamente!")
        print("\n📋 Resumen:")
        print(f"   - Sorteos: {await db.raffles.count_documents({})}")
        print(f"   - Loterías: {await db.lotteries.count_documents({'lottery_type': {'$ne': 'scratch_card'}})}")
        print(f"   - Raspaditos: {await db.lotteries.count_documents({'lottery_type': 'scratch_card'})}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
