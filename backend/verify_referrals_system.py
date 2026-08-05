"""
Verify Referrals System - Complete Check
Verifica todo el sistema de referidos: base de datos, código, recompensas
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

async def verify_referrals():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db_name = os.getenv('DB_NAME', 'taxportal')
    db = client[db_name]
    
    print(f"\n{'='*60}")
    print(f"🔍 VERIFICACIÓN COMPLETA DEL SISTEMA DE REFERIDOS")
    print(f"{'='*60}")
    print(f"📊 Base de datos: {db_name}\n")
    
    # 1. Verify users have referral codes
    print("1️⃣ Verificando códigos de referidos...")
    total_users = await db.users.count_documents({"role": "client"})
    users_with_code = await db.users.count_documents({
        "role": "client",
        "referral_code": {"$exists": True, "$ne": ""}
    })
    
    print(f"   Total clientes: {total_users}")
    print(f"   Con código de referido: {users_with_code}")
    
    if users_with_code < total_users:
        print(f"   ⚠️  {total_users - users_with_code} clientes sin código de referido")
        print("   Generando códigos faltantes...")
        
        # Generate missing codes
        users_without_code = await db.users.find({
            "role": "client",
            "$or": [
                {"referral_code": {"$exists": False}},
                {"referral_code": ""}
            ]
        }).to_list(100)
        
        for user in users_without_code:
            import random
            import string
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"referral_code": code}}
            )
            print(f"   ✅ Código generado para {user.get('full_name', 'Usuario')}: {code}")
    else:
        print("   ✅ Todos los clientes tienen código de referido")
    
    # 2. Verify referrals collection
    print(f"\n2️⃣ Verificando colección de referidos...")
    referrals_count = await db.referrals.count_documents({})
    print(f"   Total referidos registrados: {referrals_count}")
    
    if referrals_count > 0:
        # Breakdown by status
        pending = await db.referrals.count_documents({"status": "pending"})
        completed = await db.referrals.count_documents({"status": "completed"})
        cancelled = await db.referrals.count_documents({"status": "cancelled"})
        
        print(f"   📊 Por estado:")
        print(f"      • Pendientes: {pending}")
        print(f"      • Completados: {completed}")
        print(f"      • Cancelados: {cancelled}")
        
        # Show sample referrals
        print(f"\n   📋 Últimos 3 referidos:")
        recent = await db.referrals.find().sort("created_at", -1).limit(3).to_list(3)
        for ref in recent:
            referrer = await db.users.find_one({"_id": ref.get("referrer_id")})
            referred = await db.users.find_one({"_id": ref.get("referred_id")})
            
            referrer_name = referrer.get('full_name', 'N/A') if referrer else 'Usuario Eliminado'
            referred_name = referred.get('full_name', 'N/A') if referred else 'Usuario Eliminado'
            
            print(f"      • {referrer_name} → {referred_name}")
            print(f"        Estado: {ref.get('status')} | Recompensa: ${ref.get('reward_amount_usd', 0)}")
    else:
        print("   ℹ️  No hay referidos registrados aún")
    
    # 3. Verify reward tiers
    print(f"\n3️⃣ Verificando niveles de recompensa...")
    tiers = await db.referral_reward_tiers.find().sort("min_referrals", 1).to_list(100)
    
    if tiers:
        print(f"   Total niveles configurados: {len(tiers)}")
        print(f"   📊 Configuración de recompensas:")
        for tier in tiers:
            min_ref = tier.get("min_referrals", 0)
            max_ref = tier.get("max_referrals", "∞")
            reward = tier.get("reward_amount_usd", 0)
            print(f"      • {min_ref}-{max_ref} referidos: ${reward} USD por referido")
    else:
        print("   ⚠️  No hay niveles de recompensa configurados")
        print("   Creando niveles por defecto...")
        
        default_tiers = [
            {"min_referrals": 1, "max_referrals": 5, "reward_amount_usd": 10.0},
            {"min_referrals": 6, "max_referrals": 10, "reward_amount_usd": 15.0},
            {"min_referrals": 11, "max_referrals": 999, "reward_amount_usd": 20.0},
        ]
        
        for tier in default_tiers:
            tier["created_at"] = datetime.utcnow()
            tier["updated_at"] = datetime.utcnow()
            await db.referral_reward_tiers.insert_one(tier)
            print(f"   ✅ Nivel creado: {tier['min_referrals']}-{tier['max_referrals']} → ${tier['reward_amount_usd']}")
    
    # 4. Verify payouts
    print(f"\n4️⃣ Verificando pagos de referidos...")
    payouts = await db.referral_payouts.count_documents({})
    pending_payouts = await db.referral_payouts.count_documents({"status": "pending"})
    paid_payouts = await db.referral_payouts.count_documents({"status": "paid"})
    
    print(f"   Total pagos: {payouts}")
    print(f"   • Pendientes: {pending_payouts}")
    print(f"   • Pagados: {paid_payouts}")
    
    # 5. Calculate statistics
    print(f"\n5️⃣ Estadísticas generales...")
    
    # Total earned by all users
    pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": None,
            "total_earned": {"$sum": "$reward_amount_usd"}
        }}
    ]
    result = await db.referrals.aggregate(pipeline).to_list(1)
    total_earned = result[0]["total_earned"] if result else 0
    
    print(f"   💰 Total ganado por todos los usuarios: ${total_earned:.2f} USD")
    
    # Top referrers
    top_referrers_pipeline = [
        {"$match": {"status": "completed"}},
        {"$group": {
            "_id": "$referrer_id",
            "total_referrals": {"$sum": 1},
            "total_earned": {"$sum": "$reward_amount_usd"}
        }},
        {"$sort": {"total_referrals": -1}},
        {"$limit": 3}
    ]
    
    top_referrers = await db.referrals.aggregate(top_referrers_pipeline).to_list(3)
    
    if top_referrers:
        print(f"\n   🏆 Top 3 referidores:")
        for i, referrer in enumerate(top_referrers, 1):
            user = await db.users.find_one({"_id": referrer["_id"]})
            if user:
                print(f"      {i}. {user.get('full_name', 'N/A')}")
                print(f"         Referidos: {referrer['total_referrals']} | Ganado: ${referrer['total_earned']:.2f}")
    
    print(f"\n{'='*60}")
    print("✅ Verificación completada")
    print(f"{'='*60}\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(verify_referrals())
