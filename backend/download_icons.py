"""
Servidor temporal para descargar iconos de Ross Tax
Ejecutar con: python download_icons.py
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

os.chdir('/app/frontend/assets/images')

class IconHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

port = 9999
print(f"\n🌐 Servidor de descarga iniciado en puerto {port}")
print(f"📥 Descarga los archivos desde:")
print(f"   - http://localhost:{port}/icon.png")
print(f"   - http://localhost:{port}/adaptive-icon.png")
print(f"   - http://localhost:{port}/splash-icon.png")
print(f"\n⚠️  Presiona Ctrl+C para detener\n")

HTTPServer(('0.0.0.0', port), IconHandler).serve_forever()
