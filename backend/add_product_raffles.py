"""
Script para agregar sorteos de productos físicos con imágenes
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'taxportal')

async def add_product_raffles(db):
    """Agregar sorteos de productos físicos"""
    print("🎁 Creando sorteos de productos...")
    
    raffles = [
        {
            'title': '🚴 Bicicleta de Montaña Trek',
            'description': '¡Gana una increíble bicicleta de montaña Trek Marlin 7! Perfecta para aventuras al aire libre. Incluye casco y accesorios.',
            'prize_type': 'product',
            'prize_value': 'Bicicleta Trek Marlin 7 con accesorios (valor $800)',
            'prize_credits': None,
            'ticket_price': 8,
            'max_tickets_per_user': 10,
            'total_tickets': 250,
            'end_date': datetime.now(timezone.utc) + timedelta(days=25),
            'image_url': 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Bicicleta nueva en caja. Entrega en oficina o envío gratis. Incluye garantía del fabricante.'
        },
        {
            'title': '📺 Smart TV Samsung 55" 4K',
            'description': 'Smart TV Samsung Crystal UHD 55 pulgadas con resolución 4K. Disfruta de tus películas y series favoritas con calidad excepcional.',
            'prize_type': 'product',
            'prize_value': 'Samsung Smart TV 55" 4K Crystal UHD (valor $650)',
            'prize_credits': None,
            'ticket_price': 7,
            'max_tickets_per_user': 15,
            'total_tickets': 300,
            'end_date': datetime.now(timezone.utc) + timedelta(days=35),
            'image_url': 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'TV nueva sellada con garantía. Soporte incluido. Entrega o envío gratis.'
        },
        {
            'title': '🍳 Cocina de Gas Whirlpool',
            'description': '¡Renueva tu cocina! Estufa de gas Whirlpool de 6 quemadores con horno y asador. Nueva y con garantía de fábrica.',
            'prize_type': 'product',
            'prize_value': 'Cocina Whirlpool 6 quemadores (valor $750)',
            'prize_credits': None,
            'ticket_price': 6,
            'max_tickets_per_user': 12,
            'total_tickets': 200,
            'end_date': datetime.now(timezone.utc) + timedelta(days=28),
            'image_url': 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Cocina nueva en caja. Instalación no incluida. Garantía de 1 año.'
        },
        {
            'title': '❄️ Refrigerador Samsung French Door',
            'description': 'Refrigerador Samsung French Door de acero inoxidable con dispensador de agua y hielo. 28 pies cúbicos de capacidad.',
            'prize_type': 'product',
            'prize_value': 'Refrigerador Samsung 28 cu ft French Door (valor $1,800)',
            'prize_credits': None,
            'ticket_price': 12,
            'max_tickets_per_user': 8,
            'total_tickets': 350,
            'end_date': datetime.now(timezone.utc) + timedelta(days=40),
            'image_url': 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Refrigerador nuevo sellado. Entrega coordinada. Garantía completa incluida.'
        },
        {
            'title': '💻 Laptop Dell Inspiron 15',
            'description': 'Laptop Dell Inspiron 15 con Intel Core i7, 16GB RAM, 512GB SSD. Perfecta para trabajo y entretenimiento.',
            'prize_type': 'product',
            'prize_value': 'Dell Inspiron 15 - Core i7 (valor $900)',
            'prize_credits': None,
            'ticket_price': 9,
            'max_tickets_per_user': 10,
            'total_tickets': 280,
            'end_date': datetime.now(timezone.utc) + timedelta(days=32),
            'image_url': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Laptop nueva en caja con Windows 11. Garantía del fabricante de 1 año.'
        },
        {
            'title': '🎮 PlayStation 5 + 3 Juegos',
            'description': '¡La consola más deseada! PlayStation 5 con 2 controles y 3 juegos AAA incluidos. Entretenimiento garantizado.',
            'prize_type': 'product',
            'prize_value': 'PS5 + 2 Controles + 3 Juegos (valor $700)',
            'prize_credits': None,
            'ticket_price': 7,
            'max_tickets_per_user': 15,
            'total_tickets': 320,
            'end_date': datetime.now(timezone.utc) + timedelta(days=22),
            'image_url': 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'PlayStation 5 nueva sellada. Juegos seleccionados entre los más populares.'
        },
        {
            'title': '⌚ Apple Watch Series 9',
            'description': 'Smartwatch Apple Watch Series 9 de 45mm con GPS y cellular. Monitorea tu salud y mantente conectado.',
            'prize_type': 'product',
            'prize_value': 'Apple Watch Series 9 GPS + Cellular (valor $500)',
            'prize_credits': None,
            'ticket_price': 6,
            'max_tickets_per_user': 12,
            'total_tickets': 220,
            'end_date': datetime.now(timezone.utc) + timedelta(days=18),
            'image_url': 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Apple Watch nuevo sellado. Color a elección del ganador (sujeto a disponibilidad).'
        },
        {
            'title': '🎧 AirPods Pro + HomePod Mini',
            'description': 'Combo perfecto de Apple: AirPods Pro (2da Gen) con cancelación de ruido + HomePod Mini para tu hogar.',
            'prize_type': 'product',
            'prize_value': 'AirPods Pro 2 + HomePod Mini (valor $400)',
            'prize_credits': None,
            'ticket_price': 5,
            'max_tickets_per_user': 15,
            'total_tickets': 200,
            'end_date': datetime.now(timezone.utc) + timedelta(days=15),
            'image_url': 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Productos Apple nuevos sellados. Garantía oficial de Apple incluida.'
        },
        {
            'title': '🏠 Aspiradora Robot iRobot Roomba',
            'description': 'Dile adiós a la limpieza manual. iRobot Roomba con mapeo inteligente y vaciado automático.',
            'prize_type': 'product',
            'prize_value': 'iRobot Roomba i7+ con base de vaciado (valor $600)',
            'prize_credits': None,
            'ticket_price': 6,
            'max_tickets_per_user': 12,
            'total_tickets': 240,
            'end_date': datetime.now(timezone.utc) + timedelta(days=26),
            'image_url': 'https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Aspiradora nueva en caja. Incluye base de vaciado automático y accesorios.'
        },
        {
            'title': '🏋️ Kit Completo de Gimnasio en Casa',
            'description': '¡Entrena desde casa! Kit completo con pesas ajustables (hasta 50 lbs), banda elástica, tapete de yoga y más.',
            'prize_type': 'product',
            'prize_value': 'Kit de Gimnasio Completo (valor $450)',
            'prize_credits': None,
            'ticket_price': 5,
            'max_tickets_per_user': 15,
            'total_tickets': 180,
            'end_date': datetime.now(timezone.utc) + timedelta(days=20),
            'image_url': 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Kit completo para ejercicio en casa. Productos de marcas reconocidas.'
        },
        {
            'title': '📷 Cámara Canon EOS Rebel T7i',
            'description': 'Captura momentos increíbles. Cámara DSLR Canon con lente 18-55mm, perfecta para fotografía y video.',
            'prize_type': 'product',
            'prize_value': 'Canon EOS Rebel T7i + Lente (valor $850)',
            'prize_credits': None,
            'ticket_price': 8,
            'max_tickets_per_user': 10,
            'total_tickets': 260,
            'end_date': datetime.now(timezone.utc) + timedelta(days=30),
            'image_url': 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Cámara nueva sellada con lente incluido. Bolso y tarjeta SD de regalo.'
        },
        {
            'title': '☕ Cafetera Espresso Nespresso',
            'description': 'Café de calidad profesional en tu casa. Cafetera Nespresso Vertuo con espumador de leche incluido.',
            'prize_type': 'product',
            'prize_value': 'Nespresso Vertuo + Espumador (valor $280)',
            'prize_credits': None,
            'ticket_price': 4,
            'max_tickets_per_user': 20,
            'total_tickets': 150,
            'end_date': datetime.now(timezone.utc) + timedelta(days=14),
            'image_url': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
            'status': 'active',
            'tickets_sold': 0,
            'participants': [],
            'winner_id': None,
            'winner_name': None,
            'draw_date': None,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
            'terms': 'Cafetera nueva con 20 cápsulas de cortesía. Espumador incluido.'
        }
    ]
    
    result = await db.raffles.insert_many(raffles)
    print(f"✅ {len(result.inserted_ids)} sorteos de productos creados")
    return result.inserted_ids

async def main():
    """Función principal"""
    print("🚀 Agregando sorteos de productos físicos...")
    print(f"📊 Base de datos: {DB_NAME}")
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        await add_product_raffles(db)
        
        print("\n🎉 ¡Sorteos de productos agregados exitosamente!")
        print(f"\n📋 Total de sorteos en BD: {await db.raffles.count_documents({})}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
