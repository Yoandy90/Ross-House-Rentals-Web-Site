"""
Script de prueba directo para SendGrid
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

async def test_sendgrid():
    # Connect to MongoDB
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['ross_tax_db']
    
    # Get config from MongoDB
    config = await db.api_config.find_one({'_id': 'main'})
    
    if not config:
        print("❌ No se encontró configuración en MongoDB")
        return
    
    api_key = config.get('sendgrid_api_key', '')
    from_email = config.get('sendgrid_from_email', 'noreply@rosstaxpreparation.com')
    
    print(f"📧 Configuración de MongoDB:")
    print(f"   API Key: {api_key[:15]}...{api_key[-10:] if len(api_key) > 25 else 'INVALID'}")
    print(f"   From Email: {from_email}")
    print(f"   Longitud de la clave: {len(api_key)}")
    
    # Try to send email
    try:
        sg = SendGridAPIClient(api_key)
        
        message = Mail(
            from_email=from_email,
            to_emails='yoandyross@gmail.com',
            subject='✅ Prueba SendGrid - Ross Tax (desde MongoDB)',
            html_content='''
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h1 style="color: #6C1110;">¡SendGrid Funciona!</h1>
                <p>Este email se envió exitosamente usando la configuración de MongoDB.</p>
                <p><strong>Ross Tax Preparation</strong></p>
            </body>
            </html>
            '''
        )
        
        response = sg.send(message)
        
        print(f"\n✅ ¡EMAIL ENVIADO EXITOSAMENTE!")
        print(f"   Status Code: {response.status_code}")
        print(f"   Message ID: {response.headers.get('X-Message-Id', 'N/A')}")
        print(f"\n📬 Revisa tu email: yoandyross@gmail.com")
        
    except Exception as e:
        print(f"\n❌ Error al enviar email: {e}")
        print(f"   Tipo de error: {type(e).__name__}")
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_sendgrid())
