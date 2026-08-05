#!/usr/bin/env python3
"""
Auditoría Completa - Ross Lending Solutions
Genera y envía un reporte HTML de auditoría por email vía SendGrid.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, HtmlContent

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com")
TO_EMAIL = "yoandyross@gmail.com"

html_content = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0f1a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 680px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #064E3B, #059669); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px; }
  .header h1 { color: #fff; font-size: 24px; margin: 0 0 8px; }
  .header p { color: rgba(255,255,255,0.75); font-size: 14px; margin: 0; }
  .header .date { color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 12px; }
  
  .section { background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 24px; margin-bottom: 16px; }
  .section-header { display: flex; align-items: center; margin-bottom: 16px; }
  .section h2 { font-size: 18px; color: #34D399; margin: 0; }
  .section h3 { font-size: 15px; color: #93c5fd; margin: 16px 0 8px; }
  
  .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .badge-ok { background: rgba(52,211,153,0.15); color: #34D399; }
  .badge-warn { background: rgba(245,158,11,0.15); color: #F59E0B; }
  .badge-error { background: rgba(239,68,68,0.15); color: #EF4444; }
  .badge-info { background: rgba(96,165,250,0.15); color: #93c5fd; }
  
  .item { padding: 12px 0; border-bottom: 1px solid #1f2937; }
  .item:last-child { border-bottom: none; }
  .item-title { font-weight: 600; color: #e2e8f0; font-size: 14px; }
  .item-desc { color: #9ca3af; font-size: 13px; margin-top: 4px; line-height: 1.5; }
  
  .score-card { text-align: center; padding: 20px; background: linear-gradient(135deg, rgba(5,150,105,0.1), rgba(52,211,153,0.05)); border-radius: 12px; margin: 16px 0; border: 1px solid rgba(52,211,153,0.2); }
  .score { font-size: 48px; font-weight: 800; color: #34D399; }
  .score-label { font-size: 13px; color: #9ca3af; margin-top: 4px; }
  
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .stat-card { background: #1a2332; border-radius: 10px; padding: 16px; text-align: center; border: 1px solid #1f2937; }
  .stat-value { font-size: 24px; font-weight: 800; color: #34D399; }
  .stat-label { font-size: 11px; color: #9ca3af; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  
  .checklist { list-style: none; padding: 0; margin: 0; }
  .checklist li { padding: 8px 0; font-size: 13px; color: #d1d5db; border-bottom: 1px solid rgba(31,41,55,0.5); }
  .checklist li:last-child { border-bottom: none; }
  
  .priority-box { padding: 16px; border-radius: 10px; margin: 12px 0; }
  .priority-critical { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
  .priority-high { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); }
  .priority-medium { background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); }
  
  .footer { text-align: center; padding: 24px; color: #6b7280; font-size: 12px; }
  .footer a { color: #34D399; text-decoration: none; }
  
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { text-align: left; padding: 8px 12px; background: #1a2332; color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1f2937; }
  td { padding: 10px 12px; border-bottom: 1px solid #1f2937; font-size: 13px; color: #d1d5db; }
</style>
</head>
<body>
<div class="container">

<!-- HEADER -->
<div class="header">
  <h1>🏦 Auditoría Completa</h1>
  <p>Ross Lending Solutions — Plataforma Integral</p>
  <div class="date">Generado: Mayo 2026 | Web + App + Admin + Backend</div>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="section">
  <h2>📊 Resumen Ejecutivo</h2>
  <p style="color: #9ca3af; font-size: 13px; line-height: 1.6;">
    Esta auditoría cubre la plataforma completa de Ross Lending Solutions: la web pública 
    (ross-lending-web.vercel.app), la app móvil iOS/Android (Expo), el panel de administración, 
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

<!-- ═══════════════════════════════════════ -->
<!-- WEB PÚBLICA -->
<!-- ═══════════════════════════════════════ -->
<div class="section">
  <h2>🌐 Web Pública (ross-lending-web.vercel.app)</h2>
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
    <li>✅ Formulario de solicitud multi-paso (3 pasos: Personal → Préstamo → Banco)</li>
    <li>✅ Portal del cliente con login por teléfono (OTP) y email</li>
    <li>✅ Página de registro independiente</li>
    <li>✅ Admin Panel con login protegido</li>
  </ul>

  <h3>🔴 Problemas Críticos</h3>
  <div class="priority-box" style="background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2);">
    <p class="item-title">1. ✅ DOMINIO ACTIVO: rosslending.com</p>
    <p class="item-desc">
      El dominio <strong>rosslending.com</strong> está correctamente configurado y resolviendo. 
      El sitio es accesible tanto vía el dominio personalizado como vía <strong>ross-lending-web.vercel.app</strong>.
    </p>
  </div>

  <h3>⚠️ Mejoras Recomendadas</h3>
  <ul class="checklist">
    <li>⚠️ <strong>SEO:</strong> Agregar meta description, Open Graph tags para compartir en redes sociales</li>
    <li>⚠️ <strong>SSL:</strong> Verificar que el dominio personalizado tenga certificado SSL activo al configurar DNS</li>
    <li>⚠️ <strong>Footer:</strong> Falta la sección de footer con links legales, redes sociales y disclaimers de TILA/Reg Z</li>
    <li>⚠️ <strong>Legal:</strong> Agregar disclaimer de "Equal Opportunity Lender" y licencia Cap. 342-F en la landing</li>
    <li>⚠️ <strong>Velocidad:</strong> Considerar comprimir imágenes y activar caching agresivo en Vercel</li>
  </ul>
</div>

<!-- ═══════════════════════════════════════ -->
<!-- APP MÓVIL -->
<!-- ═══════════════════════════════════════ -->
<div class="section">
  <h2>📱 App Móvil (iOS/Android - Expo)</h2>
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
    <li>✅ <strong>Dashboard inteligente:</strong> Saludo contextual, balance total, préstamos activos/pagados</li>
    <li>✅ <strong>Detalle de préstamo:</strong> Gráfico de progreso circular, calendario de pagos, historial</li>
    <li>✅ <strong>Pagar desde la app:</strong> Pago mensual, pago completo, o monto personalizado</li>
    <li>✅ <strong>AutoPay:</strong> Activar/desactivar pagos automáticos con confirmación</li>
    <li>✅ <strong>Solicitud completa:</strong> 4 pasos con pre-llenado del perfil, SSN enmascarado</li>
    <li>✅ <strong>Desembolso:</strong> Selección entre ACH, Visa Direct (instantáneo), Zelle, Efectivo</li>
    <li>✅ <strong>Stripe integrado:</strong> Wrapper para métodos de pago</li>
    <li>✅ <strong>Haptics:</strong> Feedback táctil en acciones importantes</li>
    <li>✅ <strong>Pull-to-refresh:</strong> En todas las pantallas principales</li>
    <li>✅ <strong>Cache inteligente:</strong> Sistema de cache para reducir llamadas API</li>
    <li>✅ <strong>i18n:</strong> Soporte bilingüe ES/EN con react-i18next</li>
    <li>✅ <strong>Tema oscuro:</strong> Consistente con la web</li>
    <li>✅ <strong>Network Status Banner:</strong> Indicador de conectividad</li>
    <li>✅ <strong>Onboarding:</strong> Pantalla de bienvenida en primer uso</li>
    <li>✅ <strong>Eliminar cuenta:</strong> Cumplimiento GDPR/CCPA con confirmación doble</li>
  </ul>

  <h3>⚠️ Problemas y Mejoras</h3>
  <div class="priority-box priority-high">
    <p class="item-title">1. Strings hardcodeados en español</p>
    <p class="item-desc">
      Varios textos como "pagado", "balance restante", "Préstamos Activos", "Préstamos Completados" 
      están directamente en español en el código en lugar de usar el sistema i18n. 
      Esto afecta a usuarios que prefieran inglés.<br>
      <strong>Archivos afectados:</strong> loans.tsx (líneas 69, 924, 959, 1001, 1019, 1037-1047)
    </p>
  </div>
  
  <div class="priority-box priority-medium">
    <p class="item-title">2. Pantallas de perfil sin navegación de retorno</p>
    <p class="item-desc">
      Las 13 sub-pantallas del perfil (calculator, contracts, documents, etc.) necesitan 
      ser verificadas para asegurar que todas tienen header con botón de retorno y funcionan correctamente.
    </p>
  </div>
  
  <div class="priority-box priority-medium">
    <p class="item-title">3. Push Notifications no configuradas</p>
    <p class="item-desc">
      La app tiene la estructura para notificaciones push pero el servicio no está integrado 
      con Expo Push Notifications. Esto es importante para recordatorios de pago.
    </p>
  </div>
  
  <ul class="checklist">
    <li>⚠️ <strong>Versión:</strong> Muestra "v1.0.0" — actualizar según el build actual de EAS</li>
    <li>⚠️ <strong>Plaid:</strong> Verificar si la app tiene Plaid Link integrado (solo se ve en la web)</li>
    <li>⚠️ <strong>Deep Links:</strong> Verificar que los deep links funcionen para notificaciones push futuras</li>
    <li>💡 <strong>Sugerencia:</strong> Agregar animaciones de skeleton loading en lugar de ActivityIndicator</li>
    <li>💡 <strong>Sugerencia:</strong> Biometric Auth (Face ID / Touch ID) para acceso rápido</li>
  </ul>
</div>

<!-- ═══════════════════════════════════════ -->
<!-- ADMIN PANEL -->
<!-- ═══════════════════════════════════════ -->
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
    <li>✅ <strong>Metro 2 Data Furnishing:</strong> Generador CDIA-compliant con formato fijo de 426 caracteres</li>
    <li>✅ <strong>Plaid Link:</strong> Integrado en el portal del cliente para vincular cuentas bancarias</li>
    <li>✅ <strong>Cobros automatizados:</strong> Sistema de dunning con escalamiento automático</li>
    <li>✅ <strong>Underwriting:</strong> Panel de evaluación de riesgo con credit check UI</li>
    <li>✅ <strong>Compliance:</strong> Módulo para rastrear cumplimiento regulatorio</li>
  </ul>

  <h3>⚠️ Mejoras Recomendadas</h3>
  <ul class="checklist">
    <li>⚠️ <strong>Credit Bureau API:</strong> Actualmente MOCKEADO — necesita integración real con CRS Credit, Equifax, o TransUnion</li>
    <li>⚠️ <strong>Dashboard de Admin:</strong> Se queda en "Loading statistics..." por mucho tiempo (optimizar queries)</li>
    <li>⚠️ <strong>Exportación:</strong> Agregar exportación a Excel/PDF en reportes y listas de clientes</li>
    <li>💡 <strong>Sugerencia:</strong> Panel de KPIs en tiempo real (préstamos emitidos hoy, cobros recibidos, mora, etc.)</li>
  </ul>
</div>

<!-- ═══════════════════════════════════════ -->
<!-- BACKEND -->
<!-- ═══════════════════════════════════════ -->
<div class="section">
  <h2>⚡ Backend (FastAPI + Railway)</h2>
  <span class="badge badge-ok">Producción</span>
  <span class="badge badge-warn">Refactorizar</span>
  
  <h3>Endpoints Principales de Lending</h3>
  <table>
    <tr><th>Endpoint</th><th>Método</th><th>Descripción</th></tr>
    <tr><td>/api/loans/apply</td><td>POST</td><td>Solicitar préstamo</td></tr>
    <tr><td>/api/loans/my-loans</td><td>GET</td><td>Préstamos del usuario</td></tr>
    <tr><td>/api/loans/{id}/make-payment</td><td>POST</td><td>Realizar pago</td></tr>
    <tr><td>/api/loans/{id}/autopay</td><td>POST/DELETE</td><td>Configurar/cancelar AutoPay</td></tr>
    <tr><td>/api/loans/{id}/payment-schedule</td><td>GET</td><td>Calendario de pagos</td></tr>
    <tr><td>/api/loans/plaid/create-link-token</td><td>POST</td><td>Iniciar Plaid Link</td></tr>
    <tr><td>/api/loans/plaid/exchange-token</td><td>POST</td><td>Intercambiar token Plaid</td></tr>
    <tr><td>/api/collections/metro2/generate</td><td>GET</td><td>Generar archivo Metro 2</td></tr>
    <tr><td>/api/auth/me</td><td>GET</td><td>Perfil del usuario</td></tr>
    <tr><td>/api/auth/delete-account</td><td>DELETE</td><td>Eliminar cuenta</td></tr>
  </table>

  <h3>🔴 Problemas Identificados</h3>
  <div class="priority-box priority-critical">
    <p class="item-title">1. server.py monolítico (~1,700 líneas)</p>
    <p class="item-desc">
      El archivo principal del backend contiene demasiada lógica en un solo archivo. 
      Esto dificulta el mantenimiento y aumenta el riesgo de conflictos al hacer cambios.<br>
      <strong>Acción:</strong> Modularizar en routers separados (auth, loans, payments, admin, etc.)
    </p>
  </div>
  
  <div class="priority-box priority-high">
    <p class="item-title">2. Seguridad de API Keys</p>
    <p class="item-desc">
      Verificar que todas las API keys (Plaid, Stripe, SendGrid, Twilio) estén correctamente 
      almacenadas en variables de entorno y no expuestas en el código fuente.
    </p>
  </div>
  
  <ul class="checklist">
    <li>⚠️ <strong>Rate Limiting:</strong> Verificar que los endpoints públicos tengan rate limiting</li>
    <li>⚠️ <strong>Validación SSN:</strong> El SSN se almacena — asegurar encriptación AES-256 en reposo</li>
    <li>⚠️ <strong>Logging:</strong> Agregar logging estructurado para audit trail completo</li>
    <li>⚠️ <strong>Health Check:</strong> Agregar endpoint /health para monitoreo de Railway</li>
    <li>💡 <strong>Sugerencia:</strong> Implementar background jobs con Celery o APScheduler para dunning automático</li>
  </ul>
</div>

<!-- ═══════════════════════════════════════ -->
<!-- INTEGRACIONES -->
<!-- ═══════════════════════════════════════ -->
<div class="section">
  <h2>🔗 Integraciones de Terceros</h2>
  
  <table>
    <tr><th>Servicio</th><th>Estado</th><th>Notas</th></tr>
    <tr><td>🏦 Plaid (Bank Linking)</td><td><span class="badge badge-warn">Sandbox</span></td><td>Funcional en sandbox, necesita keys de producción</td></tr>
    <tr><td>💳 Stripe (Payments)</td><td><span class="badge badge-ok">Producción</span></td><td>Keys de producción configuradas</td></tr>
    <tr><td>📱 Twilio (SMS OTP)</td><td><span class="badge badge-warn">Pendiente</span></td><td>Necesita verificar keys activas</td></tr>
    <tr><td>📧 SendGrid (Email)</td><td><span class="badge badge-ok">Activo</span></td><td>Funcionando desde info@rosstaxpreparation.com</td></tr>
    <tr><td>📊 Credit Bureau</td><td><span class="badge badge-error">Mockeado</span></td><td>Necesita contrato con proveedor (CRS, Equifax)</td></tr>
    <tr><td>📋 Metro 2 (CDIA)</td><td><span class="badge badge-ok">Implementado</span></td><td>Generador de archivo compliant listo</td></tr>
    <tr><td>🤖 OpenAI (GPT-4o)</td><td><span class="badge badge-ok">Activo</span></td><td>Para AI chatbot y extracción de PDF</td></tr>
  </table>
</div>

<!-- ═══════════════════════════════════════ -->
<!-- PLAN DE ACCIÓN -->
<!-- ═══════════════════════════════════════ -->
<div class="section">
  <h2>🎯 Plan de Acción Prioritario</h2>
  
  <div class="priority-box priority-critical">
    <p class="item-title">🔴 CRÍTICO (Esta Semana)</p>
    <ul class="checklist">
      <li>1. <strong>✅ DNS rosslending.com configurado</strong> — dominio activo y funcionando correctamente</li>
      <li>2. <strong>Agregar disclaimers legales</strong> — "Equal Opportunity Lender", licencia Cap. 342-F, TILA disclosures</li>
      <li>3. <strong>Verificar encriptación de SSN</strong> — cumplimiento PCI DSS / GLBA</li>
    </ul>
  </div>
  
  <div class="priority-box priority-high">
    <p class="item-title">🟠 ALTO (Próximas 2 Semanas)</p>
    <ul class="checklist">
      <li>4. <strong>Completar i18n en la app</strong> — traducir todos los strings hardcodeados</li>
      <li>5. <strong>Integrar Plaid en producción</strong> — solicitar keys de producción</li>
      <li>6. <strong>Optimizar carga del Admin Dashboard</strong> — agregar paginación y caching</li>
      <li>7. <strong>Push notifications</strong> — configurar recordatorios de pago con Expo Push</li>
    </ul>
  </div>
  
  <div class="priority-box priority-medium">
    <p class="item-title">🔵 MEDIO (Próximo Mes)</p>
    <ul class="checklist">
      <li>8. <strong>Refactorizar server.py</strong> — dividir en módulos por dominio</li>
      <li>9. <strong>Credit Bureau API real</strong> — integrar CRS Credit o similar</li>
      <li>10. <strong>Biometric Auth en la app</strong> — Face ID / Touch ID para login rápido</li>
      <li>11. <strong>SEO y meta tags</strong> — optimizar landing para buscadores</li>
      <li>12. <strong>Skeleton loading</strong> — mejorar UX con animaciones de carga</li>
    </ul>
  </div>
</div>

<!-- ═══════════════════════════════════════ -->
<!-- RESUMEN TÉCNICO -->
<!-- ═══════════════════════════════════════ -->
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
  <p>Reporte generado automáticamente por el sistema de auditoría de Ross Lending Solutions</p>
  <p>
    <a href="https://ross-lending-web.vercel.app">Web</a> · 
    <a href="https://app-nueva-production.up.railway.app/docs">API Docs</a>
  </p>
  <p style="margin-top: 12px;">© 2026 Ross Lending Solutions LLC · Dumas, TX</p>
</div>

</div>
</body>
</html>
"""

def send_audit_email():
    if not SENDGRID_API_KEY:
        print("❌ SENDGRID_API_KEY no encontrado en .env")
        return False
    
    message = Mail(
        from_email=FROM_EMAIL,
        to_emails=TO_EMAIL,
        subject="🏦 Auditoría Completa — Ross Lending Solutions (Web + App + Admin)",
        html_content=html_content,
    )
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"✅ Email enviado exitosamente!")
        print(f"   Status Code: {response.status_code}")
        print(f"   De: {FROM_EMAIL}")
        print(f"   Para: {TO_EMAIL}")
        return True
    except Exception as e:
        print(f"❌ Error enviando email: {e}")
        # Try with body attribute
        if hasattr(e, 'body'):
            print(f"   Detalle: {e.body}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("📧 Enviando Auditoría de Ross Lending Solutions")
    print("=" * 50)
    send_audit_email()
