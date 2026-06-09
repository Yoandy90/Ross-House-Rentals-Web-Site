import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from twilio.rest import Client as TwilioClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To
import random
import string
import time

# Configuración
MONGO_URL = "os.getenv("MONGO_URL", "mongodb://localhost:27017/taxportal")"
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

def generate_temp_password():
    """Genera una contraseña como Ross + 4 dígitos"""
    digits = ''.join(random.choices(string.digits, k=4))
    return f"Ross{digits}"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def get_config():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.taxportal
    config = await db.api_config.find_one({'_id': 'main'})
    return config, client, db

def send_sms(twilio_client, from_number, to_number, message):
    try:
        msg = twilio_client.messages.create(
            body=message,
            from_=from_number,
            to=to_number
        )
        return True, msg.sid
    except Exception as e:
        return False, str(e)

def send_email(sg_client, to_email, to_name, temp_password):
    try:
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #6C1110, #8B0000); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">📱 Ross Tax App</h1>
                    <p style="color: #ffcccc; margin-top: 10px;">¡Tu acceso está listo!</p>
                </div>
                
                <div style="padding: 30px;">
                    <p style="font-size: 16px;">Hola <strong>{to_name}</strong>,</p>
                    
                    <p style="font-size: 16px;">Hemos preparado tu acceso a la aplicación móvil de Ross Tax. Aquí están tus credenciales:</p>
                    
                    <div style="background: #f8f8f8; border-left: 4px solid #6C1110; padding: 20px; margin: 20px 0; border-radius: 5px;">
                        <p style="margin: 5px 0;"><strong>👤 Usuario:</strong> {to_email}</p>
                        <p style="margin: 5px 0;"><strong>🔑 Contraseña:</strong> <span style="background: #6C1110; color: white; padding: 3px 10px; border-radius: 3px; font-family: monospace;">{temp_password}</span></p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://apps.apple.com/us/app/ross-tax/id6755496120" style="background: #6C1110; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                            📲 Descargar App iOS
                        </a>
                    </div>
                    
                    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <p style="margin: 0; color: #856404;">
                            <strong>⚠️ Recomendación:</strong> Te sugerimos cambiar tu contraseña después de iniciar sesión por primera vez.
                        </p>
                    </div>
                    
                    <p style="margin-top: 30px; color: #666;">
                        Con la app puedes:
                    </p>
                    <ul style="color: #666;">
                        <li>📄 Subir documentos fiscales</li>
                        <li>💬 Chatear con tu preparador</li>
                        <li>📅 Agendar citas</li>
                        <li>🔔 Recibir notificaciones de tu declaración</li>
                    </ul>
                </div>
                
                <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                    <p style="margin: 0; color: #888; font-size: 14px;">
                        ¿Necesitas ayuda? Responde a este email o llámanos.
                    </p>
                    <p style="margin: 10px 0 0 0; color: #6C1110; font-weight: bold;">
                        Ross Tax Preparation Services
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=Email("notifications@rosstaxpreparation.com", "Ross Tax"),
            to_emails=To(to_email, to_name),
            subject="📱 Tu acceso a Ross Tax App está listo",
            html_content=html_content
        )
        
        response = sg_client.send(message)
        return True, response.status_code
    except Exception as e:
        return False, str(e)

async def main():
    config, client, db = await get_config()
    
    # Inicializar clientes
    twilio_client = TwilioClient(config['twilio_account_sid'], config['twilio_auth_token'])
    sg_client = SendGridAPIClient(config['sendgrid_api_key'])
    from_number = config['twilio_phone_number']
    
    # Obtener todos los clientes
    clients = await db.users.find({
        'phone': {'$exists': True, '$ne': None, '$ne': ''},
        'role': {'$in': ['client', 'inactive_client']}
    }).to_list(None)
    
    print(f"📊 Procesando {len(clients)} clientes...", flush=True)
    print("=" * 50, flush=True)
    
    sms_ok = 0
    sms_fail = 0
    email_ok = 0
    email_fail = 0
    
    for i, user in enumerate(clients):
        user_id = user['_id']
        email = user.get('email', '')
        name = user.get('name', 'Cliente')
        phone = user.get('phone', '')
        
        # Generar contraseña temporal
        temp_password = generate_temp_password()
        hashed = hash_password(temp_password)
        
        # Actualizar en DB
        await db.users.update_one(
            {'_id': user_id},
            {'$set': {'password_hash': hashed}}
        )
        
        # SMS
        sms_message = f"""📱 ¡Tu acceso a Ross Tax App!

👤 Usuario: {email}
🔑 Clave: {temp_password}

📲 iOS: apps.apple.com/app/ross-tax/id6755496120

⚠️ Te recomendamos cambiar tu clave.
- Ross Tax"""

        sms_success, sms_result = send_sms(twilio_client, from_number, phone, sms_message)
        if sms_success:
            sms_ok += 1
        else:
            sms_fail += 1
            print(f"  ❌ SMS falló para {phone}: {sms_result}", flush=True)
        
        # Email
        if email:
            email_success, email_result = send_email(sg_client, email, name, temp_password)
            if email_success:
                email_ok += 1
            else:
                email_fail += 1
                print(f"  ❌ Email falló para {email}: {email_result}", flush=True)
        
        # Progreso cada 25
        if (i + 1) % 25 == 0:
            print(f"  ✅ Procesados: {i + 1}/{len(clients)} | SMS: {sms_ok}✓ {sms_fail}✗ | Email: {email_ok}✓ {email_fail}✗", flush=True)
        
        # Pequeña pausa para no saturar APIs
        if (i + 1) % 5 == 0:
            await asyncio.sleep(0.3)
    
    print("=" * 50, flush=True)
    print(f"✅ COMPLETADO", flush=True)
    print(f"   📱 SMS: {sms_ok} enviados, {sms_fail} fallidos", flush=True)
    print(f"   📧 Email: {email_ok} enviados, {email_fail} fallidos", flush=True)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
