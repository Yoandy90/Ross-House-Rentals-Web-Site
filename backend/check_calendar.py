import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient

async def check_calendar_tokens():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['taxportal']
    
    print("🔍 VERIFICANDO SISTEMA DE GOOGLE CALENDAR\n")
    print("=" * 60)
    
    # Check for calendar tokens
    tokens = await db.calendar_tokens.find_one({})
    
    print("\n1️⃣ TOKENS DE GOOGLE CALENDAR:")
    if tokens:
        print("   ✅ TOKENS ENCONTRADOS")
        print(f"      Admin ID: {tokens.get('admin_id')}")
        print(f"      Calendar ID: {tokens.get('calendar_id', 'primary')}")
        print(f"      Access Token: {'✅ Presente' if tokens.get('access_token') else '❌ Ausente'}")
        print(f"      Refresh Token: {'✅ Presente' if tokens.get('refresh_token') else '❌ Ausente'}")
        if tokens.get('created_at'):
            print(f"      Creado: {tokens.get('created_at')}")
    else:
        print("   ❌ NO HAY TOKENS GUARDADOS")
        print("      → El administrador debe conectar Google Calendar")
    
    # Check for admin users
    print("\n2️⃣ ADMINISTRADORES:")
    admin_count = await db.users.count_documents({'role': 'admin'})
    print(f"   Total: {admin_count} administrador(es)")
    
    if admin_count > 0:
        admin = await db.users.find_one({'role': 'admin'})
        print(f"   Email: {admin.get('email', 'N/A')}")
        print(f"   Nombre: {admin.get('name', 'N/A')}")
    
    # Check credentials
    print("\n3️⃣ CREDENCIALES DE GOOGLE:")
    google_client_id = os.getenv('GOOGLE_CLIENT_ID')
    google_client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    
    if google_client_id and google_client_secret:
        print(f"   ✅ Client ID: {google_client_id[:20]}...")
        print(f"   ✅ Client Secret: {google_client_secret[:15]}...")
    else:
        print("   ❌ Credenciales no configuradas")
    
    # Check recent appointments
    print("\n4️⃣ CITAS RECIENTES:")
    appointments_count = await db.appointments.count_documents({})
    print(f"   Total de citas: {appointments_count}")
    
    recent = await db.appointments.find_one(
        {},
        sort=[('created_at', -1)]
    )
    
    if recent:
        print(f"   Última cita creada: {recent.get('created_at', 'N/A')}")
        print(f"   ID de evento en calendario: {recent.get('calendar_event_id', '❌ No sincronizado')}")
    
    print("\n" + "=" * 60)
    print("\n✅ CONCLUSIÓN:")
    
    if tokens and google_client_id:
        print("   🟢 Sistema OPERATIVO - Google Calendar está conectado")
    elif not tokens and google_client_id:
        print("   🟡 Sistema LISTO - Falta conectar cuenta de Google")
        print("      → Ir a panel admin y conectar Google Calendar")
    else:
        print("   🔴 Sistema NO CONFIGURADO - Faltan credenciales")
    
    client.close()

asyncio.run(check_calendar_tokens())
