"""
Script para identificar todas las notificaciones en el sistema
"""
import re

print("=" * 80)
print("📋 INVENTARIO COMPLETO DE NOTIFICACIONES EN EL SISTEMA")
print("=" * 80)

with open('server.py', 'r') as f:
    content = f.read()
    lines = content.split('\n')

# Buscar todos los eventos que envían notificaciones
events = {}

# Buscar envíos de email
email_pattern = r'send_.*email|sendgrid|Mail\('
for i, line in enumerate(lines):
    if re.search(email_pattern, line, re.IGNORECASE) and 'def ' not in line and 'import' not in line:
        # Buscar el contexto (función contenedora)
        for j in range(i, max(0, i-100), -1):
            if 'async def ' in lines[j] or 'def ' in lines[j]:
                func_name = lines[j].strip()
                if func_name not in events:
                    events[func_name] = {'email': [], 'sms': []}
                events[func_name]['email'].append(i+1)
                break

# Buscar envíos de SMS
sms_pattern = r'send_.*sms|twilio|messages\.create'
for i, line in enumerate(lines):
    if re.search(sms_pattern, line, re.IGNORECASE) and 'def ' not in line and 'import' not in line:
        # Buscar el contexto
        for j in range(i, max(0, i-100), -1):
            if 'async def ' in lines[j] or 'def ' in lines[j]:
                func_name = lines[j].strip()
                if func_name not in events:
                    events[func_name] = {'email': [], 'sms': []}
                events[func_name]['sms'].append(i+1)
                break

print("\n📊 EVENTOS ENCONTRADOS:\n")

for func_name, notifs in events.items():
    has_email = len(notifs['email']) > 0
    has_sms = len(notifs['sms']) > 0
    
    status = ""
    if has_email and has_sms:
        status = "✅ COMPLETO (Email + SMS)"
    elif has_email:
        status = "⚠️ SOLO EMAIL"
    elif has_sms:
        status = "⚠️ SOLO SMS"
    
    print(f"{status}")
    print(f"   Función: {func_name}")
    if has_email:
        print(f"   📧 Email en línea(s): {notifs['email']}")
    if has_sms:
        print(f"   📱 SMS en línea(s): {notifs['sms']}")
    print()

print("=" * 80)
