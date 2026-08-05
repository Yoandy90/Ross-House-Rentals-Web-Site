"""
Script para crear niveles de recompensa por defecto
Ejecutar: python create_default_reward_tiers.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/ross_tax')


async def create_default_tiers():
    """Crea niveles de recompensa por defecto"""
    client = AsyncIOMotorClient(MONGO_URL)
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    
    # Verificar si ya existen niveles
    existing_count = await db.referral_reward_tiers.count_documents({})
    if existing_count > 0:
        print(f"⚠️  Ya existen {existing_count} niveles de recompensa")
        response = input("¿Deseas eliminarlos y crear nuevos? (s/n): ")
        if response.lower() != 's':
            print("Operación cancelada")
            return
        
        # Eliminar existentes
        result = await db.referral_reward_tiers.delete_many({})
        print(f"✅ Eliminados {result.deleted_count} niveles existentes")
    
    # Niveles por defecto (sistema escalonado)
    default_tiers = [
        {
            'min_referrals': 1,
            'max_referrals': 10,
            'reward_amount_usd': 10.0,
            'is_active': True
        },
        {
            'min_referrals': 11,
            'max_referrals': 20,
            'reward_amount_usd': 15.0,
            'is_active': True
        },
        {
            'min_referrals': 21,
            'max_referrals': 50,
            'reward_amount_usd': 20.0,
            'is_active': True
        },
        {
            'min_referrals': 51,
            'max_referrals': 100,
            'reward_amount_usd': 25.0,
            'is_active': True
        },
        {
            'min_referrals': 101,
            'max_referrals': 999,
            'reward_amount_usd': 30.0,
            'is_active': True
        }
    ]
    
    # Insertar niveles
    result = await db.referral_reward_tiers.insert_many(default_tiers)
    
    print(f"\n✅ Creados {len(result.inserted_ids)} niveles de recompensa:")
    print("\n┌─────────────────┬──────────────┬──────────────┐")
    print("│ Nivel Referidos │   Rango      │  Recompensa  │")
    print("├─────────────────┼──────────────┼──────────────┤")
    
    for tier in default_tiers:
        print(f"│ {tier['min_referrals']:3d} - {tier['max_referrals']:3d}      │              │   ${tier['reward_amount_usd']:.2f} USD  │")
    
    print("└─────────────────┴──────────────┴──────────────┘")
    
    print("\n💡 Sistema escalonado:")
    print("   - 1-10 referidos completados: $10 USD cada uno")
    print("   - 11-20 referidos completados: $15 USD cada uno")
    print("   - 21-50 referidos completados: $20 USD cada uno")
    print("   - 51-100 referidos completados: $25 USD cada uno")
    print("   - 101+ referidos completados: $30 USD cada uno")
    
    client.close()


if __name__ == '__main__':
    asyncio.run(create_default_tiers())
