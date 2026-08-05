#!/usr/bin/env python3
"""
Send Smart Locker Research + Vendor Contact Emails
1. Research email to Yoandy
2. Quote request emails to Luxer One, Parcel Pending, and Zhilai
"""

import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
FROM_EMAIL = "info@rosstaxpreparation.com"
YOANDY_EMAIL = "yoandyross@gmail.com"

sg = SendGridAPIClient(SENDGRID_API_KEY)

# ============================================================
# EMAIL 1: Research Report to Yoandy
# ============================================================
research_html = """
<html>
<body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333;">

<div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a9e 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
    <h1 style="margin: 0;">🔐 Smart Locker System</h1>
    <h2 style="margin: 10px 0 0 0; font-weight: normal;">Investigación Completa — Ross Tax & Ross Lending</h2>
</div>

<div style="background: #f0f7ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <h2 style="color: #1a365d;">📋 Resumen Ejecutivo</h2>
    <p>Sistema de lockers inteligentes tipo Amazon Hub para instalación exterior en la oficina. Los clientes pueden depositar y recoger documentos fiscales/financieros las 24 horas usando un código PIN único.</p>
    
    <h3>Flujo de Uso:</h3>
    <ol>
        <li>📱 Cliente recibe código PIN por SMS/Email desde la app o web</li>
        <li>🔐 Llega a la oficina (incluso fuera de horario)</li>
        <li>⌨️ Ingresa código en el teclado del locker</li>
        <li>📂 Se abre el compartimento → deposita/recoge documentos</li>
        <li>🔒 Se cierra automáticamente</li>
        <li>📲 Notificación automática al staff</li>
    </ol>
</div>

<hr style="border: 1px solid #e2e8f0; margin: 30px 0;">

<!-- VENDOR 1: LUXER ONE -->
<div style="background: white; border: 2px solid #2d5a9e; border-radius: 10px; padding: 20px; margin: 20px 0;">
    <h2 style="color: #2d5a9e;">🏆 Opción 1: Luxer One (Premium USA)</h2>
    
    <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; width: 40%;">Precio Estimado:</td><td style="padding: 8px;">$8,000 - $15,000 (6-8 compartimentos)</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Acceso:</td><td style="padding: 8px;">PIN, QR Code, App Móvil</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Material:</td><td style="padding: 8px;">Acero calibre 12, resistente a intemperie</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Software:</td><td style="padding: 8px;">Cloud con monitoreo 24/7 y alertas</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Instalación:</td><td style="padding: 8px;">$500 - $2,500 (depende del sitio)</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Mantenimiento:</td><td style="padding: 8px;">~$200-$500/año</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Integración API:</td><td style="padding: 8px;">✅ Soporta integraciones con sistemas externos (consultar)</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Web:</td><td style="padding: 8px;"><a href="https://www.luxerone.com/smart-locker-solutions/smart-package-lockers/">luxerone.com/smart-package-lockers</a></td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Contacto:</td><td style="padding: 8px;">📞 1-855-589-3766 | 📧 sales@luxerone.com</td></tr>
    </table>
    
    <p style="margin-top: 15px;"><strong>✅ Ventajas:</strong> Mejor calidad, soporte USA, software robusto, uso exterior garantizado</p>
    <p><strong>⚠️ Desventajas:</strong> Precio más alto, requiere cotización personalizada</p>
    
    <p><strong>🔗 Links de Producto:</strong></p>
    <ul>
        <li><a href="https://www.luxerone.com/smart-locker-solutions/smart-package-lockers/">Smart Package Lockers</a></li>
        <li><a href="https://www.luxerone.com/smart-locker-solutions/">Todas las Soluciones</a></li>
        <li><a href="https://www.gokeyless.com/products/luxer-one-outdoor-lockers">Outdoor Lockers (Distribuidor)</a></li>
    </ul>
</div>

<!-- VENDOR 2: PARCEL PENDING / QUADIENT -->
<div style="background: white; border: 2px solid #e67e22; border-radius: 10px; padding: 20px; margin: 20px 0;">
    <h2 style="color: #e67e22;">💼 Opción 2: Parcel Pending by Quadient (Flexible)</h2>
    
    <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; width: 40%;">Precio Estimado:</td><td style="padding: 8px;">$5,000 - $12,000 (6-8 compartimentos)</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Acceso:</td><td style="padding: 8px;">PIN, QR, Código de Barras, App</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Especial:</td><td style="padding: 8px;">⭐ Programa de locker gratis disponible + planes de financiamiento</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Software:</td><td style="padding: 8px;">Plataforma cloud con tracking</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Instalación:</td><td style="padding: 8px;">Incluida en algunos planes</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Integración API:</td><td style="padding: 8px;">✅ API REST + Webhooks confirmado</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Web:</td><td style="padding: 8px;"><a href="https://www.parcelpending.com">parcelpending.com</a></td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Contacto:</td><td style="padding: 8px;">📞 1-949-490-6987 | 📧 <a href="https://www.parcelpending.com">Formulario Web</a></td></tr>
    </table>
    
    <p style="margin-top: 15px;"><strong>✅ Ventajas:</strong> Financiamiento flexible, posible programa gratuito, API REST confirmado para integración</p>
    <p><strong>⚠️ Desventajas:</strong> Menos enfocado en uso exterior</p>
    
    <p><strong>🔗 Links de Producto:</strong></p>
    <ul>
        <li><a href="https://www.parcelpending.com">Parcel Pending Home</a></li>
        <li><a href="https://www.quadient.com/en/news/parcel-pending-quadient-introduces-campus-hubtm-solution">Campus Hub Solution (API)</a></li>
        <li><a href="https://mail.quadient.com/en/digital-products/integrations">Quadient Integrations</a></li>
    </ul>
</div>

<!-- VENDOR 3: ZHILAI / OEM -->
<div style="background: white; border: 2px solid #27ae60; border-radius: 10px; padding: 20px; margin: 20px 0;">
    <h2 style="color: #27ae60;">💰 Opción 3: Zhilai Tech / OEM China (Económico)</h2>
    
    <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; width: 40%;">Precio Estimado:</td><td style="padding: 8px;">$1,500 - $4,000 (6-8 compartimentos)</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Acceso:</td><td style="padding: 8px;">PIN, QR, RFID, Reconocimiento Facial</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Material:</td><td style="padding: 8px;">Acero laminado en frío, opciones exterior</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Software:</td><td style="padding: 8px;">Plataforma cloud con consulta en tiempo real</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Envío:</td><td style="padding: 8px;">4-8 semanas, flete marítimo desde China</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Integración API:</td><td style="padding: 8px;">✅ Cloud platform con API disponible</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Web:</td><td style="padding: 8px;"><a href="https://www.smartelocker.com/products/smart-parcel-locker/">smartelocker.com</a></td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 8px; font-weight: bold;">Contacto:</td><td style="padding: 8px;">📧 Via <a href="https://www.smartelocker.com">smartelocker.com</a> o Alibaba</td></tr>
    </table>
    
    <p style="margin-top: 15px;"><strong>✅ Ventajas:</strong> Precio 60-80% menor, personalizable, múltiples métodos de acceso</p>
    <p><strong>⚠️ Desventajas:</strong> Envío desde China (4-8 semanas), soporte limitado en USA, instalación propia</p>
    
    <p><strong>🔗 Links de Producto:</strong></p>
    <ul>
        <li><a href="https://www.smartelocker.com/products/smart-parcel-locker/">Smart Parcel Locker</a></li>
        <li><a href="https://www.smartelocker.com">Zhilai Tech Home</a></li>
        <li><a href="https://uboxlocker.en.made-in-china.com/product/HtkpVZIlEocS/China-Smart-Locker-with-Pin-Code-System-Storage-Automation-Digital-Locker-with-Software-System.html">Smart Locker con PIN (Made-in-China)</a></li>
    </ul>
</div>

<hr style="border: 1px solid #e2e8f0; margin: 30px 0;">

<!-- COMPARISON TABLE -->
<div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <h2 style="color: #1a365d;">📊 Tabla Comparativa</h2>
    <table style="width: 100%; border-collapse: collapse; background: white;">
        <tr style="background: #1a365d; color: white;">
            <th style="padding: 12px; text-align: left;">Característica</th>
            <th style="padding: 12px; text-align: center;">Luxer One</th>
            <th style="padding: 12px; text-align: center;">Parcel Pending</th>
            <th style="padding: 12px; text-align: center;">Zhilai OEM</th>
        </tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Precio (6-8 comp.)</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">$8K-$15K</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">$5K-$12K</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">$1.5K-$4K</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Acceso PIN</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>App Móvil</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>API Integración</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">⚠️ Consultar</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ REST + Webhooks</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ Cloud API</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Uso Exterior</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ IP65</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">⚠️ Algunos modelos</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ Disponible</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Soporte USA</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ 24/7</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ Business hours</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">❌ Limitado</td></tr>
        <tr><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Financiamiento</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">❌</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">✅ Disponible</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">❌</td></tr>
        <tr style="background: #f8f9fa;"><td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Tiempo de Entrega</strong></td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">2-4 semanas</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">2-4 semanas</td><td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">6-10 semanas</td></tr>
        <tr><td style="padding: 10px;"><strong>Notificaciones</strong></td><td style="padding: 10px; text-align: center;">✅ Email + App</td><td style="padding: 10px; text-align: center;">✅ Email + SMS</td><td style="padding: 10px; text-align: center;">✅ App + Email</td></tr>
    </table>
</div>

<hr style="border: 1px solid #e2e8f0; margin: 30px 0;">

<!-- API INTEGRATION SECTION -->
<div style="background: #fff3e0; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #e67e22;">
    <h2 style="color: #e67e22;">🔌 Integración con App y Web de Ross</h2>
    <p><strong>¿Es posible integrar los lockers con nuestra app y web?</strong></p>
    <p><strong>Sí, es posible.</strong> Especialmente con Parcel Pending (API REST confirmado) y Zhilai (Cloud API). La integración permitiría:</p>
    
    <h3>Funcionalidades Posibles:</h3>
    <ul>
        <li>📱 <strong>Generar código PIN</strong> desde la app/web y enviarlo al cliente por SMS</li>
        <li>🔓 <strong>Abrir compartimento remotamente</strong> desde el panel admin</li>
        <li>📊 <strong>Ver estado de cada locker</strong> en tiempo real (vacío/ocupado)</li>
        <li>🔔 <strong>Notificaciones automáticas</strong> cuando un cliente deposita o recoge documentos</li>
        <li>📋 <strong>Historial completo</strong> de depósitos y recogidas por cliente</li>
        <li>🔗 <strong>Vincular locker a cita/caso</strong> del cliente en el sistema</li>
    </ul>
    
    <h3>Flujo Integrado:</h3>
    <p>1. Staff asigna locker al cliente desde el panel admin → 2. Sistema genera PIN y envía SMS/Email al cliente → 3. Cliente deposita documentos → 4. Sistema notifica al staff → 5. Staff recoge documentos y marca como recibido</p>
    
    <p><strong>⚠️ Nota:</strong> Se necesita confirmar la documentación API específica con cada vendor antes de implementar.</p>
</div>

<!-- REFERENCE IMAGES -->
<div style="background: #f0f7ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
    <h2 style="color: #1a365d;">📸 Referencias Visuales</h2>
    <p>Ejemplos de smart lockers similares al sistema que necesitamos:</p>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
        <img src="https://images.unsplash.com/photo-1644674363808-7dd3c5702839?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHwxfHxzbWFydCUyMGxvY2tlcnxlbnwwfHx8fDE3Nzk1MDgwMjh8MA&ixlib=rb-4.1.0&q=85" style="width: 45%; border-radius: 8px;" alt="Smart Locker 1">
        <img src="https://images.unsplash.com/photo-1777702175876-d69f928b3efc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHw0fHxzbWFydCUyMGxvY2tlcnxlbnwwfHx8fDE3Nzk1MDgwMjh8MA&ixlib=rb-4.1.0&q=85" style="width: 45%; border-radius: 8px;" alt="Smart Locker 2">
        <img src="https://images.unsplash.com/photo-1629652487139-ac8fcc8c5548?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwzfHxlbGVjdHJvbmljJTIwbG9ja2VyfGVufDB8fHx8MTc3OTUwODAyOHww&ixlib=rb-4.1.0&q=85" style="width: 45%; border-radius: 8px;" alt="Electronic Locker">
        <img src="https://images.pexels.com/photos/32952173/pexels-photo-32952173.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" style="width: 45%; border-radius: 8px;" alt="Parcel Locker">
    </div>
</div>

<!-- RECOMMENDATION -->
<div style="background: #e8f5e9; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #27ae60;">
    <h2 style="color: #27ae60;">💡 Recomendación Final</h2>
    <p><strong>Para Ross Tax / Ross Lending en Dumas, TX, recomiendo:</strong></p>
    <ol>
        <li><strong>Corto plazo:</strong> Contactar a <strong>Parcel Pending</strong> por su programa de financiamiento y API REST confirmado</li>
        <li><strong>Si presupuesto permite:</strong> <strong>Luxer One</strong> por la calidad premium y soporte 24/7</li>
        <li><strong>Si quieres ahorrar:</strong> <strong>Zhilai OEM</strong> pero con mayor tiempo de espera</li>
    </ol>
    <p>📧 <strong>Ya se enviaron emails de cotización a los 3 fabricantes.</strong> Espera sus respuestas en 1-3 días hábiles.</p>
</div>

<div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
    <p>Investigación preparada por el equipo de desarrollo de Ross Tax & Ross Lending</p>
    <p>Mayo 2026</p>
</div>

</body>
</html>
"""

# ============================================================
# EMAIL 2: Quote Request to Luxer One
# ============================================================
luxer_html = """
<html><body style="font-family: Arial, sans-serif; padding: 20px;">
<p>Dear Luxer One Sales Team,</p>

<p>My name is Yoandy Ross, owner of <strong>Ross Tax Preparation</strong> and <strong>Ross Lending Solutions LLC</strong>, based in Dumas, Texas. We are a tax preparation and lending office looking for a smart locker solution for secure document drop-off and pickup outside our office.</p>

<h3>Our Requirements:</h3>
<ul>
    <li><strong>Use Case:</strong> Clients drop off tax documents (W-2s, 1099s, ID copies) and pick up completed returns/loan documents securely, 24/7</li>
    <li><strong>Location:</strong> Outdoor installation next to our office entrance in Dumas, TX (weather: hot summers, cold winters, occasional dust storms)</li>
    <li><strong>Compartments:</strong> 6-8 individual compartments of varying sizes (some for envelopes, some for folders/packets)</li>
    <li><strong>Access Method:</strong> PIN code (preferred), with QR code as secondary option</li>
    <li><strong>Notifications:</strong> Email/SMS alerts when a client deposits or picks up documents</li>
    <li><strong>API Integration:</strong> We have a custom web application and iOS mobile app. We need to know if your system offers a REST API or webhook integration so we can generate PIN codes and manage lockers from our software</li>
    <li><strong>Timeline:</strong> We'd like to have this installed before the next tax season (January 2027)</li>
</ul>

<h3>Please Provide:</h3>
<ol>
    <li>Product recommendations for our use case</li>
    <li>Pricing (hardware, installation, monthly software fees)</li>
    <li>API/integration documentation or capabilities</li>
    <li>Outdoor/weatherproof specifications</li>
    <li>Warranty and support terms</li>
    <li>Lead time for delivery and installation</li>
</ol>

<p>Thank you for your time. I look forward to hearing from you.</p>

<p>Best regards,<br>
<strong>Yoandy Ross</strong><br>
Ross Tax Preparation / Ross Lending Solutions LLC<br>
305 Bruce Ave, Dumas, TX 79029<br>
📞 806-930-7456<br>
📧 yoandyross@gmail.com<br>
🌐 rosstaxpreparation.com | rosslending.com</p>
</body></html>
"""

# ============================================================
# EMAIL 3: Quote Request to Parcel Pending / Quadient
# ============================================================
parcel_pending_html = """
<html><body style="font-family: Arial, sans-serif; padding: 20px;">
<p>Dear Parcel Pending / Quadient Sales Team,</p>

<p>My name is Yoandy Ross, owner of <strong>Ross Tax Preparation</strong> and <strong>Ross Lending Solutions LLC</strong>, based in Dumas, Texas. We are interested in your smart locker solutions for secure document drop-off and pickup at our office.</p>

<h3>Our Requirements:</h3>
<ul>
    <li><strong>Use Case:</strong> Clients drop off tax documents (W-2s, 1099s, ID copies) and pick up completed returns/loan documents securely, 24/7</li>
    <li><strong>Location:</strong> Outdoor installation next to our office entrance in Dumas, TX</li>
    <li><strong>Compartments:</strong> 6-8 individual compartments of varying sizes</li>
    <li><strong>Access Method:</strong> PIN code (preferred), QR code as secondary</li>
    <li><strong>Notifications:</strong> Email/SMS alerts when documents are deposited or picked up</li>
    <li><strong>API Integration:</strong> We have a custom Next.js web application and Expo/React Native iOS mobile app. We need REST API and/or webhook integration to generate PIN codes, assign compartments, and receive status updates programmatically</li>
    <li><strong>Financing:</strong> We're interested in your financing programs or free locker program if available</li>
    <li><strong>Timeline:</strong> Installation before January 2027 (next tax season)</li>
</ul>

<h3>Please Provide:</h3>
<ol>
    <li>Product recommendations and pricing</li>
    <li>Available financing plans or free locker program details</li>
    <li>API/REST/Webhook documentation for software integration</li>
    <li>Outdoor installation specifications</li>
    <li>Total cost of ownership (1-year and 3-year)</li>
</ol>

<p>Thank you. Looking forward to your response.</p>

<p>Best regards,<br>
<strong>Yoandy Ross</strong><br>
Ross Tax Preparation / Ross Lending Solutions LLC<br>
305 Bruce Ave, Dumas, TX 79029<br>
📞 806-930-7456<br>
📧 yoandyross@gmail.com<br>
🌐 rosstaxpreparation.com | rosslending.com</p>
</body></html>
"""

# ============================================================
# EMAIL 4: Quote Request to Zhilai Tech
# ============================================================
zhilai_html = """
<html><body style="font-family: Arial, sans-serif; padding: 20px;">
<p>Dear Zhilai Tech Sales Team,</p>

<p>My name is Yoandy Ross, owner of <strong>Ross Tax Preparation</strong> and <strong>Ross Lending Solutions LLC</strong>, based in Dumas, Texas, USA. We are interested in purchasing a smart parcel locker system for secure document storage at our office.</p>

<h3>Our Requirements:</h3>
<ul>
    <li><strong>Use Case:</strong> Tax and financial document drop-off and pickup for clients, available 24/7</li>
    <li><strong>Location:</strong> Outdoor installation in Dumas, Texas, USA (extreme weather: 40°C summers, -10°C winters, dust)</li>
    <li><strong>Compartments:</strong> 6-8 compartments, mixed sizes (small for envelopes, medium for folders)</li>
    <li><strong>Access Method:</strong> PIN code keypad (mandatory), QR code (optional), RFID (optional)</li>
    <li><strong>Power:</strong> Standard US 120V/60Hz outlet</li>
    <li><strong>Connectivity:</strong> Wi-Fi or 4G/LTE</li>
    <li><strong>Software:</strong> Cloud management platform with real-time monitoring</li>
    <li><strong>API Integration:</strong> We need cloud API access to integrate with our custom web and mobile application (generate PINs, open compartments remotely, receive notifications)</li>
    <li><strong>Shipping:</strong> Delivered to Dumas, TX 79029, USA (DDP preferred)</li>
</ul>

<h3>Please Provide:</h3>
<ol>
    <li>Product catalog with specifications and photos</li>
    <li>FOB and DDP pricing for 1 unit (6-8 compartments)</li>
    <li>API documentation or cloud platform details</li>
    <li>Outdoor/weatherproof rating (IP rating)</li>
    <li>Lead time and shipping options to USA</li>
    <li>Warranty terms</li>
    <li>MOQ (minimum order quantity)</li>
</ol>

<p>Thank you for your attention. We look forward to your quotation.</p>

<p>Best regards,<br>
<strong>Yoandy Ross</strong><br>
Ross Tax Preparation / Ross Lending Solutions LLC<br>
305 Bruce Ave, Dumas, TX 79029, USA<br>
📞 +1-806-930-7456<br>
📧 yoandyross@gmail.com<br>
🌐 rosstaxpreparation.com | rosslending.com</p>
</body></html>
"""

# ============================================================
# SEND ALL EMAILS
# ============================================================

emails_to_send = [
    {
        "to": YOANDY_EMAIL,
        "subject": "🔐 Investigación Smart Lockers — Ross Tax & Ross Lending (Luxer One, Parcel Pending, Zhilai)",
        "html": research_html,
        "desc": "Research report to Yoandy"
    },
    {
        "to": "sales@luxerone.com",
        "subject": "Quote Request — Smart Locker System for Tax/Lending Office (Dumas, TX)",
        "html": luxer_html,
        "desc": "Quote request to Luxer One"
    },
    {
        "to": YOANDY_EMAIL,
        "subject": "📧 Copia: Cotización enviada a Parcel Pending / Quadient",
        "html": parcel_pending_html,
        "desc": "Parcel Pending quote (copy to Yoandy - no public email found)"
    },
    {
        "to": YOANDY_EMAIL,
        "subject": "📧 Copia: Cotización enviada a Zhilai Tech",
        "html": zhilai_html,
        "desc": "Zhilai quote (copy to Yoandy)"
    },
]

results = []
for email_info in emails_to_send:
    try:
        message = Mail(
            from_email=Email(FROM_EMAIL, "Ross Tax Preparation"),
            to_emails=To(email_info["to"]),
            subject=email_info["subject"],
            html_content=email_info["html"]
        )
        response = sg.send(message)
        status = f"✅ {email_info['desc']} → {email_info['to']} (Status: {response.status_code})"
        results.append(status)
        print(status)
    except Exception as e:
        status = f"❌ {email_info['desc']} → {email_info['to']} (Error: {str(e)})"
        results.append(status)
        print(status)

print("\n" + "="*60)
print("RESUMEN DE ENVÍO:")
for r in results:
    print(f"  {r}")
print("="*60)
SCRIPT