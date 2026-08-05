"""
Script para agregar múltiples imágenes a los sorteos existentes
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# Imágenes de ejemplo para diferentes productos
PRODUCT_IMAGES = {
    "🚴 Bicicleta de Montaña Trek": [
        "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800",
        "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=800",
        "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800",
    ],
    "🏆 Mega Premio - iPhone 15 Pro": [
        "https://images.unsplash.com/photo-1696446702183-cbd2cb4c46f0?w=800",
        "https://images.unsplash.com/photo-1695048064860-20bc6fdcc105?w=800",
        "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800",
    ],
    "📺 Smart TV Samsung 55\" 4K": [
        "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
        "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800",
        "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
    ],
    "🍳 Cocina de Gas Whirlpool": [
        "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
        "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800",
        "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=800",
    ],
    "❄️ Refrigerador Samsung French Door": [
        "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800",
        "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800",
        "https://images.unsplash.com/photo-1571175351749-61b1d79ba7e1?w=800",
    ],
    "💻 Laptop Dell Inspiron 15": [
        "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800",
        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800",
        "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=800",
    ],
    "🎮 PlayStation 5 + 3 Juegos": [
        "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800",
        "https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?w=800",
        "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=800",
    ],
    "⌚ Apple Watch Series 9": [
        "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800",
        "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=800",
        "https://images.unsplash.com/photo-1510017098667-27dfc7150acb?w=800",
    ],
    "🎧 AirPods Pro + HomePod Mini": [
        "https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?w=800",
        "https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800",
        "https://images.unsplash.com/photo-1625323062545-e90c0c8e2c20?w=800",
    ],
    "🏠 Aspiradora Robot iRobot Roomba": [
        "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800",
        "https://images.unsplash.com/photo-1623050958582-bb72af90e87a?w=800",
        "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800",
    ],
    "🏋️ Kit Completo de Gimnasio en Casa": [
        "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800",
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
        "https://images.unsplash.com/photo-1623874228601-f4193c7b1818?w=800",
    ],
    "📷 Cámara Canon EOS Rebel T7i": [
        "https://images.unsplash.com/photo-1606980707891-1621c05604d7?w=800",
        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800",
        "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800",
    ],
    "☕ Cafetera Espresso Nespresso": [
        "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800",
        "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800",
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800",
    ],
}

async def add_images_to_raffles():
    """Agregar array de imágenes a sorteos existentes"""
    
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Obtener todos los sorteos de tipo 'product'
        raffles = await db.raffles.find({'prize_type': 'product'}).to_list(100)
        
        print(f"📦 Encontrados {len(raffles)} sorteos de tipo producto")
        
        for raffle in raffles:
            raffle_title = raffle.get('title', '')
            
            # Si el sorteo tiene imágenes predefinidas
            if raffle_title in PRODUCT_IMAGES:
                images = PRODUCT_IMAGES[raffle_title]
                
                # Actualizar el sorteo con el array de imágenes
                result = await db.raffles.update_one(
                    {'_id': raffle['_id']},
                    {'$set': {'images': images}}
                )
                
                if result.modified_count > 0:
                    print(f"✅ Actualizado: {raffle_title} con {len(images)} imágenes")
                else:
                    print(f"⚠️  Ya tenía imágenes: {raffle_title}")
            else:
                # Si no hay imágenes predefinidas pero tiene image_url, crear variaciones
                if raffle.get('image_url'):
                    # Por ahora solo usamos la imagen principal
                    images = []
                    
                    result = await db.raffles.update_one(
                        {'_id': raffle['_id']},
                        {'$set': {'images': images}}
                    )
                    
                    print(f"ℹ️  Inicializado array vacío para: {raffle_title}")
        
        print("\n✅ Proceso completado")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(add_images_to_raffles())
