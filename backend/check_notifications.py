"""
Script para verificar todas las notificaciones en el sistema
"""
import re

# Buscar en server.py todas las llamadas a notificaciones
with open('server.py', 'r') as f:
    content = f.read()

print("=" * 80)
print("📧 EMAIL NOTIFICATIONS EN EL SISTEMA")
print("=" * 80)

# Buscar emails
email_matches = re.findall(r'send_\w*email\w*\([^)]+\)', content, re.IGNORECASE)
print(f"\n✉️ Total de llamadas a envío de emails: {len(email_matches)}")

# Extraer contexto de cada email
lines = content.split('\n')
for i, line in enumerate(lines):
    if 'send_' in line.lower() and 'email' in line.lower() and '(' in line:
        # Buscar el nombre de la función que contiene esta llamada
        for j in range(i, max(0, i-50), -1):
            if 'async def ' in lines[j] or 'def ' in lines[j]:
                func_name = lines[j].strip()
                print(f"\n  📍 Línea {i+1}: {func_name}")
                print(f"     {line.strip()[:100]}")
                break

print("\n" + "=" * 80)
print("📱 SMS NOTIFICATIONS EN EL SISTEMA")
print("=" * 80)

# Buscar SMS
sms_matches = re.findall(r'send_\w*sms\w*\([^)]+\)|messages\.create\([^)]+\)', content, re.IGNORECASE)
print(f"\n📲 Total de llamadas a envío de SMS: {len(sms_matches)}")

# Extraer contexto de cada SMS
for i, line in enumerate(lines):
    if ('send_' in line.lower() and 'sms' in line.lower() and '(' in line) or 'messages.create' in line:
        # Buscar el nombre de la función que contiene esta llamada
        for j in range(i, max(0, i-50), -1):
            if 'async def ' in lines[j] or 'def ' in lines[j]:
                func_name = lines[j].strip()
                print(f"\n  📍 Línea {i+1}: {func_name}")
                print(f"     {line.strip()[:100]}")
                break

print("\n" + "=" * 80)
