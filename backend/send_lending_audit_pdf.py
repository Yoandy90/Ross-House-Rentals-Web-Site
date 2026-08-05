#!/usr/bin/env python3
"""
Genera PDF de auditoría y lo envía por email como adjunto via SendGrid.
"""
import os
import base64
from dotenv import load_dotenv
load_dotenv()

from weasyprint import HTML
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com")
TO_EMAIL = "yoandyross@gmail.com"
PDF_PATH = "/app/backend/audit_ross_lending_2026.pdf"

html_content = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  body { font-family: Helvetica, Arial, sans-serif; background: #0a0f1a; color: #e2e8f0; margin: 0; padding: 0; font-size: 11px; line-height: 1.5; }
  .container { max-width: 100%; padding: 0; }
  
  .header { background: linear-gradient(135deg, #064E3B, #059669); border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 20px; }
  .header h1 { color: #fff; font-size: 22px; margin: 0 0 6px; }
  .header p { color: rgba(255,255,255,0.75); font-size: 12px; margin: 0; }
  .header .date { color: rgba(255,255,255,0.5); font-size: 10px; margin-top: 10px; }
  
  .section { background: #111827; border: 1px solid #1f2937; border-radius: 10px; padding: 18px; margin-bottom: 14px; page-break-inside: avoid; }
  .section h2 { font-size: 16px; color: #34D399; margin: 0 0 12px; }
  .section h3 { font-size: 13px; color: #93c5fd; margin: 14px 0 6px; }
  
  .badge { display: inline-block; padding: 3px 8px; border-radius: 5px; font-size: 9px; font-weight: 700; margin-right: 4px; }
  .badge-ok { background: rgba(52,211,153,0.15); color: #34D399; }
  .badge-warn { background: rgba(245,158,11,0.15); color: #F59E0B; }
  .badge-error { background: rgba(239,68,68,0.15); color: #EF4444; }
  .badge-info { background: rgba(96,165,250,0.15); color: #93c5fd; }
  
  .score-card { text-align: center; padding: 16px; background: linear-gradient(135deg, rgba(5,150,105,0.1), rgba(52,211,153,0.05)); border-radius: 10px; margin: 12px 0; border: 1px solid rgba(52,211,153,0.2); }
  .score { font-size: 42px; font-weight: 800; color: #34D399; }
  .score-label { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  
  .stats-grid { display: flex; gap: 10px; margin: 12px 0; }
  .stat-card { flex: 1; background: #1a2332; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #1f2937; }
  .stat-value { font-size: 20px; font-weight: 800; color: #34D399; }
  .stat-label { font-size: 9px; color: #9ca3af; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { padding: 5px 0; font-size: 11px; color: #d1d5db; border-bottom: 1px solid rgba(31,41,55,0.5); }
  .checklist li:last-child { border-bottom: none; }
  
  .priority-box { padding: 12px; border-radius: 8px; margin: 10px 0; }
  .priority-critical { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
  .priority-high { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); }
  .priority-medium { background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); }
  .priority-ok { background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2); }
  
  .item-title { font-weight: 700; color: #e2e8f0; font-size: 12px; margin: 0 0 4px; }
  .item-desc { color: #9ca3af; font-size: 11px; margin: 4px 0 0; line-height: 1.5; }
  
  .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 10px; }
  
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
  th { text-align: left; padding: 6px 8px; background: #1a2332; color: #9ca3af; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1f2937; }
  td { padding: 6px 8px; border-bottom: 1px solid #1f2937; color: #d1d5db; }
</style>
</head>
<body>
<div class="container">

<!-- HEADER -->
<div class="header">
  <h1>Auditoría Completa</h1>
  <p>Ross Lending Solutions LLC — Plataforma Integral</p>
  <div class="date">Generado: Mayo 2026 | Web + App + Admin + Backend | rosslending.com</div>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="section">
  <h2>📊 Resumen Ejecutivo</h2>
  <p style="color: #9ca3af; font-size: 11px; line-height: 1.6;">
    Esta auditoría cubre la plataforma completa de Ross Lending Solutions: la web pública 
    (rosslending.com), la app móvil iOS/Android (Expo), el panel de administración, 
    y el backend (FastAPI en Railway).
  </p>
  
  <div class="score-card">
    <div class="score">82/100</div>
    <div class="score-label">Puntuación General de la Plataforma</div>
  </div>
  
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">20</div>
      <div class="stat-label">Rutas Web</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">29</div>
      <div class="stat-label">Pantallas App</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">16</div>
      <div class="stat-label">Módulos Admin</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">150+</div>
      <div class="stat-label">Endpoints API</div>
    </div>
  </div>
</div>

<!-- WEB PÚBLICA -->
<div class="section">
  <h2>🌐 Web Pública (rosslending.com)</h2>
  <span class="badge badge-ok">Desplegada</span>
  <span class="badge badge-ok">DNS Activo</span>
  
  <h3>✅ Lo que funciona bien</h3>
  <ul class="checklist">
    <li>✅ Landing page moderna con tema oscuro profesional</li>
    <li>✅ Hero section con tarjeta de préstamo aprobado (genera confianza)</li>
    <li>✅ Sección de servicios: Personal, Adelanto de Taxes, Plan de Pago, Consultoría</li>
    <li>✅ Calculadora interactiva integrada en la landing</li>
    <li>✅ Testimonios de clientes con 5 estrellas</li>
    <li>✅ FAQ expandible con 6 preguntas frecuentes</li>
    <li>✅ Sección "Cómo Funciona" con flujo de 3 pasos</li>
    <li>✅ Formulario de solicitud multi-paso (Personal → Préstamo → Banco)</li>
    <li>✅ Portal del cliente con login por teléfono (OTP) y email</li>
    <li>✅ Página de registro independiente</li>
    <li>✅ Admin Panel con login protegido</li>
    <li>✅ Dominio rosslending.com activo y resolviendo correctamente</li>
  </ul>

  <h3>⚠️ Mejoras Recomendadas</h3>
  <ul class="checklist">
    <li>⚠️ <b>SEO:</b> Agregar meta description, Open Graph tags para compartir en redes sociales</li>
    <li>⚠️ <b>Footer:</b> Agregar sección de footer con links legales, redes sociales y disclaimers de TILA/Reg Z</li>
    <li>⚠️ <b>Legal:</b> Agregar disclaimer de "Equal Opportunity Lender" y licencia Cap. 342-F en la landing</li>
    <li>⚠️ <b>Velocidad:</b> Considerar comprimir imágenes y activar caching agresivo en Vercel</li>
  </ul>
</div>

<!-- APP MÓVIL -->
<div class="section">
  <h2>📱 App Móvil (iOS/Android — Expo)</h2>
  <span class="badge badge-ok">Funcionando</span>
  <span class="badge badge-info">29 Pantallas</span>
  
  <h3>Arquitectura de la App</h3>
  <table>
    <tr><th>Módulo</th><th>Pantallas</th><th>Estado</th></tr>
    <tr><td>🏠 Home (Dashboard)</td><td>1</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>💰 Mis Préstamos</td><td>1 (con sub-tabs)</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>📝 Solicitar Préstamo</td><td>1 (4 pasos)</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>👤 Perfil</td><td>1</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>🔐 Auth (Login/Register)</td><td>2</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>💳 Desembolso</td><td>1</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>✍️ Firma de Contrato</td><td>1</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>⚙️ Sub-pantallas Perfil</td><td>13</td><td><span class="badge badge-ok">OK</span></td></tr>
    <tr><td>🎉 Onboarding</td><td>1</td><td><span class="badge badge-ok">OK</span></td></tr>
  </table>

  <h3>✅ Características Implementadas</h3>
  <ul class="checklist">
    <li>✅ <b>Dashboard inteligente:</b> Saludo contextual, balance total, préstamos activos/pagados</li>
    <li>✅ <b>Detalle de préstamo:</b> Gráfico de progreso circular, calendario de pagos, historial</li>
    <li>✅ <b>Pagar desde la app:</b> Pago mensual, pago completo, o monto personalizado</li>
    <li>✅ <b>AutoPay:</b> Activar/desactivar pagos automáticos con confirmación</li>
    <li>✅ <b>Solicitud completa:</b> 4 pasos con pre-llenado del perfil, SSN enmascarado</li>
    <li>✅ <b>Desembolso:</b> Selección entre ACH, Visa Direct (instantáneo), Zelle, Efectivo</li>
    <li>✅ <b>Stripe integrado:</b> Wrapper para métodos de pago</li>
    <li>✅ <b>Haptics:</b> Feedback táctil en acciones importantes</li>
    <li>✅ <b>Pull-to-refresh:</b> En todas las pantallas principales</li>
    <li>✅ <b>Cache inteligente:</b> Sistema de cache para reducir llamadas API</li>
    <li>✅ <b>i18n:</b> Soporte bilingüe ES/EN con react-i18next</li>
    <li>✅ <b>Tema oscuro:</b> Consistente con la web</li>
    <li>✅ <b>Network Status Banner:</b> Indicador de conectividad</li>
    <li>✅ <b>Eliminar cuenta:</b> Cumplimiento GDPR/CCPA con confirmación doble</li>
  </ul>

  <h3>⚠️ Problemas y Mejoras</h3>
  <div class="priority-box priority-high">
    <p class="item-title">1. Strings hardcodeados en español</p>
    <p class="item-desc">
      Varios textos como "pagado", "balance restante", "Préstamos Activos" están directamente 
      en español en lugar de usar el sistema i18n. Afecta a usuarios que prefieran inglés.<br>
      <b>Archivos afectados:</b> loans.tsx (líneas 69, 924, 959, 1001, 1019)
    </p>
  </div>
  
  <div class="priority-box priority-medium">
    <p class="item-title">2. Push Notifications no configuradas</p>
    <p class="item-desc">
      La app tiene la estructura para notificaciones push pero el servicio no está integrado 
      con Expo Push Notifications. Importante para recordatorios de pago.
    </p>
  </div>
  
  <ul class="checklist">
    <li>⚠️ <b>Versión:</b> Muestra "v1.0.0" — actualizar según el build actual de EAS</li>
    <li>💡 <b>Sugerencia:</b> Agregar animaciones de skeleton loading en lugar de ActivityIndicator</li>
    <li>💡 <b>Sugerencia:</b> Biometric Auth (Face ID / Touch ID) para acceso rápido</li>
  </ul>
</div>

<!-- ADMIN PANEL -->
<div class="section">
  <h2>🔧 Panel de Administración</h2>
  <span class="badge badge-ok">16 Módulos</span>
  
  <h3>Módulos Disponibles</h3>
  <table>
    <tr><th>Módulo</th><th>Ruta</th><th>Descripción</th></tr>
    <tr><td>📊 Dashboard</td><td>/admin</td><td>Vista general con métricas</td></tr>
    <tr><td>👥 Clientes</td><td>/admin/clientes</td><td>Gestión de clientes</td></tr>
    <tr><td>💰 Préstamos</td><td>/admin/prestamos</td><td>Administrar préstamos activos</td></tr>
    <tr><td>📋 Solicitudes</td><td>/admin/solicitudes</td><td>Aprobar/rechazar solicitudes</td></tr>
    <tr><td>💳 Pagos</td><td>/admin/pagos</td><td>Historial de pagos y cobros</td></tr>
    <tr><td>📑 Cobros (Metro 2)</td><td>/admin/cobros</td><td>Collections + CDIA Metro 2</td></tr>
    <tr><td>📈 Reportes</td><td>/admin/reportes</td><td>Análisis financiero</td></tr>
    <tr><td>🏦 Underwriting</td><td>/admin/underwriting</td><td>Evaluación de riesgo</td></tr>
    <tr><td>✅ Compliance</td><td>/admin/compliance</td><td>Cumplimiento regulatorio</td></tr>
    <tr><td>📄 Documentos</td><td>/admin/documentos</td><td>Gestión documental</td></tr>
    <tr><td>🧮 Calculadora</td><td>/admin/calculadora</td><td>Simulador de préstamos</td></tr>
    <tr><td>🔔 Notificaciones</td><td>/admin/notificaciones</td><td>Push y SMS</td></tr>
    <tr><td>📊 Auditoría</td><td>/admin/auditoria</td><td>Trail de auditoría</td></tr>
    <tr><td>⚙️ Configuración</td><td>/admin/configuracion</td><td>Settings generales</td></tr>
    <tr><td>🔒 Seguridad</td><td>/admin/seguridad</td><td>Roles y permisos</td></tr>
    <tr><td>👁️ Visitantes</td><td>/admin/visitantes</td><td>Analytics de web</td></tr>
  </table>

  <h3>✅ Funcionalidades Clave</h3>
  <ul class="checklist">
    <li>✅ <b>Metro 2 Data Furnishing:</b> Generador CDIA-compliant con formato fijo de 426 caracteres</li>
    <li>✅ <b>Plaid Link:</b> Integrado en el portal del cliente para vincular cuentas bancarias</li>
    <li>✅ <b>Cobros automatizados:</b> Sistema de dunning con escalamiento automático</li>
    <li>✅ <b>Underwriting:</b> Panel de evaluación de riesgo con credit check UI</li>
    <li>✅ <b>Compliance:</b> Módulo para rastrear cumplimiento regulatorio</li>
  </ul>

  <h3>⚠️ Mejoras Recomendadas</h3>
  <ul class="checklist">
    <li>⚠️ <b>Credit Bureau API:</b> Actualmente MOCKEADO — necesita integración real con CRS Credit, Equifax, o TransUnion</li>
    <li>⚠️ <b>Dashboard de Admin:</b> Optimizar queries para carga más rápida de estadísticas</li>
    <li>⚠️ <b>Exportación:</b> Agregar exportación a Excel/PDF en reportes y listas de clientes</li>
    <li>💡 <b>Sugerencia:</b> Panel de KPIs en tiempo real (préstamos emitidos hoy, cobros recibidos, mora, etc.)</li>
  </ul>
</div>

<!-- BACKEND -->
<div class="section">
  <h2>⚡ Backend (FastAPI + Railway)</h2>
  <span class="badge badge-ok">Producción</span>
  <span class="badge badge-warn">Refactorizar</span>
  
  <h3>Endpoints Principales</h3>
  <table>
    <tr><th>Endpoint</th><th>Método</th><th>Descripción</th></tr>
    <tr><td>/api/loans/apply</td><td>POST</td><td>Solicitar préstamo</td></tr>
    <tr><td>/api/loans/my-loans</td><td>GET</td><td>Préstamos del usuario</td></tr>
    <tr><td>/api/loans/{id}/make-payment</td><td>POST</td><td>Realizar pago</td></tr>
    <tr><td>/api/loans/{id}/autopay</td><td>POST/DEL</td><td>Configurar/cancelar AutoPay</td></tr>
    <tr><td>/api/loans/{id}/payment-schedule</td><td>GET</td><td>Calendario de pagos</td></tr>
    <tr><td>/api/loans/plaid/create-link-token</td><td>POST</td><td>Iniciar Plaid Link</td></tr>
    <tr><td>/api/loans/plaid/exchange-token</td><td>POST</td><td>Intercambiar token Plaid</td></tr>
    <tr><td>/api/collections/metro2/generate</td><td>GET</td><td>Generar archivo Metro 2</td></tr>
    <tr><td>/api/auth/me</td><td>GET</td><td>Perfil del usuario</td></tr>
    <tr><td>/api/auth/delete-account</td><td>DELETE</td><td>Eliminar cuenta</td></tr>
  </table>

  <h3>⚠️ Problemas Identificados</h3>
  <div class="priority-box priority-critical">
    <p class="item-title">1. server.py monolítico (~1,700 líneas)</p>
    <p class="item-desc">
      El archivo principal del backend contiene demasiada lógica en un solo archivo.
      Dificulta mantenimiento y aumenta riesgo de conflictos.<br>
      <b>Acción:</b> Modularizar en routers separados (auth, loans, payments, admin, etc.)
    </p>
  </div>
  
  <ul class="checklist">
    <li>⚠️ <b>Rate Limiting:</b> Verificar que endpoints públicos tengan rate limiting</li>
    <li>⚠️ <b>Validación SSN:</b> Asegurar encriptación AES-256 en reposo (cumplimiento PCI DSS / GLBA)</li>
    <li>⚠️ <b>Logging:</b> Agregar logging estructurado para audit trail completo</li>
    <li>💡 <b>Sugerencia:</b> Implementar background jobs para dunning automático</li>
  </ul>
</div>

<!-- INTEGRACIONES -->
<div class="section">
  <h2>🔗 Integraciones de Terceros</h2>
  <table>
    <tr><th>Servicio</th><th>Estado</th><th>Notas</th></tr>
    <tr><td>🏦 Plaid (Bank Linking)</td><td><span class="badge badge-warn">Sandbox</span></td><td>Funcional, necesita keys de producción</td></tr>
    <tr><td>💳 Stripe (Payments)</td><td><span class="badge badge-ok">Producción</span></td><td>Keys de producción configuradas</td></tr>
    <tr><td>📱 Twilio (SMS OTP)</td><td><span class="badge badge-warn">Pendiente</span></td><td>Verificar keys activas</td></tr>
    <tr><td>📧 SendGrid (Email)</td><td><span class="badge badge-ok">Activo</span></td><td>Funcionando desde info@rosstaxpreparation.com</td></tr>
    <tr><td>📊 Credit Bureau</td><td><span class="badge badge-error">Mockeado</span></td><td>Necesita contrato con proveedor</td></tr>
    <tr><td>📋 Metro 2 (CDIA)</td><td><span class="badge badge-ok">Implementado</span></td><td>Generador compliant listo</td></tr>
    <tr><td>🤖 OpenAI (GPT-4o)</td><td><span class="badge badge-ok">Activo</span></td><td>Para AI chatbot y extracción PDF</td></tr>
  </table>
</div>

<!-- PLAN DE ACCIÓN -->
<div class="section">
  <h2>🎯 Plan de Acción Prioritario</h2>
  
  <div class="priority-box priority-critical">
    <p class="item-title">🔴 CRÍTICO (Esta Semana)</p>
    <ul class="checklist">
      <li>1. <b>Agregar disclaimers legales</b> — "Equal Opportunity Lender", licencia Cap. 342-F, TILA disclosures</li>
      <li>2. <b>Verificar encriptación de SSN</b> — cumplimiento PCI DSS / GLBA</li>
      <li>3. <b>Seguridad de API Keys</b> — verificar que ninguna esté expuesta en código fuente</li>
    </ul>
  </div>
  
  <div class="priority-box priority-high">
    <p class="item-title">🟠 ALTO (Próximas 2 Semanas)</p>
    <ul class="checklist">
      <li>4. <b>Completar i18n en la app</b> — traducir todos los strings hardcodeados</li>
      <li>5. <b>Integrar Plaid en producción</b> — solicitar keys de producción</li>
      <li>6. <b>Push notifications</b> — configurar recordatorios de pago con Expo Push</li>
      <li>7. <b>Optimizar carga del Admin Dashboard</b> — paginación y caching</li>
    </ul>
  </div>
  
  <div class="priority-box priority-medium">
    <p class="item-title">🔵 MEDIO (Próximo Mes)</p>
    <ul class="checklist">
      <li>8. <b>Refactorizar server.py</b> — dividir en módulos por dominio</li>
      <li>9. <b>Credit Bureau API real</b> — integrar CRS Credit o similar</li>
      <li>10. <b>Biometric Auth en la app</b> — Face ID / Touch ID</li>
      <li>11. <b>SEO y meta tags</b> — optimizar landing para buscadores</li>
      <li>12. <b>Skeleton loading</b> — mejorar UX con animaciones de carga</li>
    </ul>
  </div>
</div>

<!-- STACK TÉCNICO -->
<div class="section">
  <h2>🔧 Stack Técnico</h2>
  <table>
    <tr><th>Componente</th><th>Tecnología</th><th>Hosting</th></tr>
    <tr><td>Web Frontend</td><td>Next.js 14 + Tailwind CSS</td><td>Vercel</td></tr>
    <tr><td>App Móvil</td><td>Expo (React Native) + TypeScript</td><td>App Store / TestFlight</td></tr>
    <tr><td>Backend API</td><td>FastAPI (Python 3.11)</td><td>Railway</td></tr>
    <tr><td>Base de Datos</td><td>MongoDB Atlas (taxportal)</td><td>MongoDB Cloud</td></tr>
    <tr><td>Pagos</td><td>Stripe + Plaid</td><td>—</td></tr>
    <tr><td>Email</td><td>SendGrid</td><td>—</td></tr>
    <tr><td>SMS</td><td>Twilio</td><td>—</td></tr>
    <tr><td>AI</td><td>OpenAI GPT-4o</td><td>—</td></tr>
  </table>
</div>

<!-- FOOTER -->
<div class="footer">
  <p>Reporte generado automáticamente | Ross Lending Solutions LLC</p>
  <p>rosslending.com | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018</p>
  <p>© 2026 Ross Lending Solutions LLC — Todos los derechos reservados</p>
</div>

</div>
</body>
</html>
"""

def generate_and_send():
    # 1. Generate PDF
    print("📄 Generando PDF...")
    html = HTML(string=html_content)
    html.write_pdf(PDF_PATH)
    print(f"   ✅ PDF generado: {PDF_PATH}")
    
    # 2. Read PDF and encode as base64
    with open(PDF_PATH, "rb") as f:
        pdf_data = f.read()
    encoded_pdf = base64.b64encode(pdf_data).decode()
    pdf_size_kb = len(pdf_data) / 1024
    print(f"   📦 Tamaño: {pdf_size_kb:.1f} KB")
    
    # 3. Send via SendGrid with attachment
    if not SENDGRID_API_KEY:
        print("❌ SENDGRID_API_KEY no encontrado")
        return False
    
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=TO_EMAIL,
        subject="📄 Auditoría PDF — Ross Lending Solutions (Mayo 2026)",
        html_content="""
        <div style="font-family: Arial, sans-serif; background: #0a0f1a; color: #e2e8f0; padding: 32px; text-align: center;">
          <div style="max-width: 500px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #064E3B, #059669); border-radius: 16px; padding: 32px; margin-bottom: 20px;">
              <h1 style="color: #fff; margin: 0 0 8px; font-size: 22px;">Auditoría Completa</h1>
              <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 14px;">Ross Lending Solutions LLC</p>
            </div>
            <div style="background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 24px;">
              <p style="color: #34D399; font-size: 42px; font-weight: 800; margin: 0;">82/100</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 16px;">Puntuación General</p>
              <p style="color: #d1d5db; font-size: 13px; line-height: 1.6;">
                Adjunto encontrarás el reporte PDF completo con el análisis de la web (rosslending.com), 
                la app móvil (29 pantallas), el panel admin (16 módulos), y el backend.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 11px; margin-top: 20px;">
              © 2026 Ross Lending Solutions LLC · rosslending.com
            </p>
          </div>
        </div>
        """,
    )
    
    # Attach PDF
    attachment = Attachment(
        FileContent(encoded_pdf),
        FileName("Auditoria_Ross_Lending_Solutions_2026.pdf"),
        FileType("application/pdf"),
        Disposition("attachment"),
    )
    message.attachment = attachment
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"\n✅ Email con PDF enviado exitosamente!")
        print(f"   Status Code: {response.status_code}")
        print(f"   De: {FROM_EMAIL}")
        print(f"   Para: {TO_EMAIL}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        if hasattr(e, 'body'):
            print(f"   Detalle: {e.body}")
        return False

if __name__ == "__main__":
    print("=" * 55)
    print("📧 Auditoría PDF — Ross Lending Solutions")
    print("=" * 55)
    generate_and_send()
