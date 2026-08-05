#!/usr/bin/env python3
"""
Script de prueba para verificar la carga del logo base64
"""
import os
import sys

# Agregar el directorio backend al path
sys.path.insert(0, '/app/backend')

from notification_service_v2 import notification_service_v2

print("=" * 60)
print("TEST: Carga del Logo Base64")
print("=" * 60)

# Verificar si el logo se cargó
if notification_service_v2.logo_base64:
    logo_length = len(notification_service_v2.logo_base64)
    print(f"✅ Logo cargado exitosamente")
    print(f"   Longitud del base64: {logo_length} caracteres")
    print(f"   Primeros 100 caracteres: {notification_service_v2.logo_base64[:100]}...")
    print(f"   Últimos 50 caracteres: ...{notification_service_v2.logo_base64[-50:]}")
    
    # Verificar que es un base64 válido
    try:
        import base64
        decoded = base64.b64decode(notification_service_v2.logo_base64)
        print(f"✅ Base64 válido - {len(decoded)} bytes decodificados")
        
        # Verificar que es una imagen PNG
        if decoded.startswith(b'\x89PNG'):
            print("✅ Formato PNG válido detectado")
        else:
            print("⚠️  No parece ser un PNG válido")
            
    except Exception as e:
        print(f"❌ Error decodificando base64: {e}")
else:
    print("❌ Logo NO cargado - string vacío")

print("=" * 60)

# Probar la generación del header
print("\nTEST: Generación del Email Header")
print("=" * 60)

try:
    header = notification_service_v2._get_email_header("Test Title", "Test Subtitle")
    print("✅ Header generado exitosamente")
    print(f"   Longitud del HTML: {len(header)} caracteres")
    
    # Verificar que contiene el data URI del logo
    if 'data:image/png;base64,' in header:
        print("✅ Data URI del logo encontrado en el header")
    else:
        print("⚠️  Data URI del logo NO encontrado en el header")
        
except Exception as e:
    print(f"❌ Error generando header: {e}")
    import traceback
    traceback.print_exc()

print("=" * 60)
