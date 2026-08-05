"""
Script para configurar el webhook de SendGrid automáticamente
"""
import requests
import os

# Cargar API key
api_key = None
with open('/app/backend/.env', 'r') as f:
    for line in f:
        if line.startswith('SENDGRID_API_KEY='):
            api_key = line.split('=', 1)[1].strip()
            break

if not api_key:
    print("❌ No se encontró SENDGRID_API_KEY en .env")
    exit(1)

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

# URL del webhook (cambia esto según tu entorno)

WEBHOOK_URL = "https://app-nueva-production.up.railway.app/api/webhooks/sendgrid"

WEBHOOK_URL = "https://app-nueva-production.up.railway.app/api/webhooks/sendgrid"


print("=" * 80)
print("⚙️  CONFIGURANDO WEBHOOK DE SENDGRID")
print("=" * 80)

# Configuración del webhook
webhook_config = {
    "enabled": True,
    "url": WEBHOOK_URL,
    "group_resubscribe": False,
    "delivered": True,  # Cuando el email se entrega
    "open": True,       # Cuando el usuario abre el email
    "click": True,      # Cuando el usuario hace clic en un link
    "bounce": True,     # Cuando el email rebota
    "deferred": True,   # Cuando el envío se retrasa
    "unsubscribe": True, # Cuando se da de baja
    "dropped": True,    # Cuando se descarta el email
    "spam_report": True, # Cuando se marca como spam
    "group_unsubscribe": False,
    "oauth_client_id": None,
    "oauth_token_url": None
}

print(f"\n📍 URL del webhook: {WEBHOOK_URL}")
print(f"\n📊 Eventos a rastrear:")
print(f"   ✅ Entregas (delivered)")
print(f"   ✅ Aperturas (open)")
print(f"   ✅ Clics (click)")
print(f"   ✅ Rebotes (bounce)")
print(f"   ✅ Descartados (dropped)")
print(f"   ✅ Reportes de spam (spam_report)")

# Configurar el webhook
response = requests.patch(
    "https://api.sendgrid.com/v3/user/webhooks/event/settings",
    headers=headers,
    json=webhook_config
)

if response.status_code in [200, 201]:
    print(f"\n✅ ¡Webhook configurado exitosamente!")
    print(f"\nRespuesta de SendGrid:")
    result = response.json()
    print(f"   Estado: {'✅ ACTIVO' if result.get('enabled') else '❌ INACTIVO'}")
    print(f"   URL: {result.get('url')}")
    
    events = []
    if result.get('open'): events.append('open')
    if result.get('click'): events.append('click')
    if result.get('delivered'): events.append('delivered')
    if result.get('bounce'): events.append('bounce')
    
    print(f"   Eventos: {', '.join(events)}")
    
    print(f"\n🎉 ¡TODO LISTO!")
    print(f"\nAhora SendGrid enviará eventos a tu backend automáticamente.")
    print(f"Los datos estarán disponibles para la IA en tiempo real.")
    
else:
    print(f"\n❌ Error al configurar webhook: {response.status_code}")
    print(f"   Respuesta: {response.text}")

print("\n" + "=" * 80)
