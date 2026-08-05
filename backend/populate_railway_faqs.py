"""
Script para poblar FAQs en Railway Production
Ejecuta esto desde tu máquina local
"""
import requests

RAILWAY_URL = "https://app-nueva-production.up.railway.app"

print("🚀 Poblando FAQs en Railway...")

try:
    response = requests.post(f"{RAILWAY_URL}/api/admin/populate-faqs")
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ ¡Éxito!")
        print(f"📚 Categorías creadas: {data.get('categories_created', 0)}")
        print(f"❓ FAQs creadas: {data.get('faqs_created', 0)}")
        print(f"📊 Total en base de datos:")
        print(f"   - Categorías: {data.get('total_categories', 0)}")
        print(f"   - FAQs: {data.get('total_faqs', 0)}")
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"❌ Error: {str(e)}")
    print("\n⚠️  Asegúrate de que Railway esté desplegado con los últimos cambios")
