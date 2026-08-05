# Ross Tax Expo — PRD / Memoria del Proyecto

## Problema original
Plataforma fiscal completa: app móvil Expo (React Native), backend FastAPI, web Next.js.
Sesión actual: arreglar crash nativo de iOS (SIGABRT/TurboModule) en la pestaña "Citas" (appointments.tsx)
tras la actualización de UI Premium con Dark Mode.

## Idioma del usuario
Español — SIEMPRE responder en español.

## Arquitectura
- `/app/frontend/` — App móvil Expo (tabs: Inicio, Impuestos, Citas, Servicios, Menú)
- `/app/backend/` — FastAPI (server.py monolítico >42k líneas), MongoDB `taxportal`
- `/app/webapp/` — Next.js web admin
- Repos: Vercel ← `Yoandy90/ross-tax-website`; Railway ← `Yoandy90/app-nueva`. Push a AMBOS para web/backend.
- NOTA: la versión WEB del proyecto Expo es otra app ("Ross House Rentals") — los tabs de impuestos son nativos.

## Crash iOS — Resolución (12 Jun 2026)
- Builds 1164-1173 crasheaban en pestaña Citas (TurboModule performVoidMethodInvocation).
- Build #1174 (appointments.tsx ultra-simplificado) ✅ NO crashea — confirmado por usuario.
- Causa aislada al código del appointments.tsx original (1,316 líneas). Sospechosos únicos vs tabs sanos:
  `expo-clipboard` (módulo nativo) y lógica de pagos/modales inline.
- `expo-calendar` desinstalado; `expo-updates` deshabilitado en app.json; push notifications deshabilitadas en _layout.tsx.
- 12 Jun 2026: appointments.tsx RECONSTRUIDO (~750 líneas): hero próxima cita, countdown, cancelar,
  unirse a video, historial, estado de oficina, Dark Mode (useThemeColors), caché AsyncStorage,
  CTA → book-appointment.tsx. SIN expo-clipboard / expo-calendar. Backup: `appointments.tsx.backup`.
- Build #1176 verificado por usuario: ✅ NO crashea.
- 12 Jun 2026 (Build #1178): UX consolidada — calendario duplicado ELIMINADO de la pestaña Citas
  (book-appointment.tsx es la ÚNICA pantalla de agendado, con En Persona/Videollamada).
  Tarjeta "Horario de Oficina" ahora DINÁMICA desde GET /api/local/office-hours (agrupa días:
  "Lunes - Viernes: 10:00 AM - 2:00 PM", "Sábado - Domingo: Cerrado"; soporta tax season schedule).
  Horario validado server-side: /public/available-slots (domingo=0 slots, lunes=8 slots).
- Build #1178 verificado por usuario: pestaña Citas OK, pantalla única de agendado OK.
- 12 Jun 2026 (Build #1179): redirección inteligente — al tocar la pestaña Citas, si el usuario NO tiene
  citas próximas se abre directamente "Reservar Cita" (router.replace a book-appointment). Si tiene citas,
  muestra el resumen (hero + lista + historial). Usa useFocusEffect para recargar al enfocar la pestaña
  (lista fresca tras agendar). Estado vacío eliminado (ya inalcanzable).
- Build #1179 (EAS id 4caa016a) enviado a TestFlight — PENDIENTE verificación usuario.
- 12 Jun 2026 (auditoría P1): se verificó que AMBAS tareas P1 de SSN YA ESTABAN implementadas:
  · Búsqueda SSN web admin: backend `banking_data_routes.py` soporta search por last4/SSN completo + has_ssn
    (verificado curl). UI con input de búsqueda SSN existe en GitHub (commit 361814c46, Vercel).
    NOTA: la página datos-bancarios NO está en el working tree de este pod (solo en git history / GitHub).
  · Pre-llenado SSN Tax Wizard: GET /api/profile/tax-prefill con 4 prioridades (wizard previo,
    client_banking por email, season_clients por email, banking por nombre). El móvil personal-info.tsx ya lo llama.
  · Recordatorios WhatsApp 24h/1h con confirmación SÍ/NO/CAMBIAR ya existen (whatsapp_scheduler + bot v2).
- BUG CORREGIDO: en /profile/tax-prefill, ssn_last_four venía del KYC y podía no coincidir con el SSN
  encontrado (7895 vs 3123). Ahora siempre se deriva del SSN hallado. ⚠️ Desplegar a Railway (push GitHub).
- Tests de regresión creados: /app/backend/tests/test_appointments_ssn.py (9 tests, todos en verde):
  login, citas, horario oficina (config + status), slots respetan días cerrados/horas, búsqueda SSN admin,
  filtro has_ssn, prefill SSN consistente, prefill requiere auth.
- NOTA: aparece esporádicamente un archivo corrupto vacío con nombre binario en /app/frontend/
  que rompe el upload de EAS. Si `eas build` falla con ENOENT lstat: eliminarlo con
  `find . -maxdepth 1 -type f -empty ! -name ".*" -delete` y relanzar.

## Implementado (sesiones previas)
- Dark Mode dinámico en services.tsx, support.tsx, notifications.tsx, y demás tabs.
- EXPO_TOKEN renovado (en /app/frontend/.env).
- Builds EAS: `eas build --platform ios --profile production` + `eas submit --platform ios --latest`.

## Integración Xcel Energy Green Button (12 Jun 2026)
- Programa aprobado por Xcel para Ross House Rentals LLC. Credenciales en /app/ross-house-backend/.env
  (XCEL_CLIENT_ID, XCEL_CLIENT_SECRET, XCEL_REGISTRATION_TOKEN, XCEL_APPLICATION_INFO_ID + URLs).
- Backend: /app/ross-house-backend/rental/xcel_energy_router.py (registrado en server.py):
  · GET /api/admin/xcel/status|connect-url|connections|usage/{property_id}
  · POST /api/admin/xcel/connections/{id}/sync (Batch/Subscription ESPI fetch + parseo XML → kWh diarios)
  · GET /api/xcel/oauth/callback (público, intercambio de tokens, HTML resultado en español)
  · POST /api/xcel/notify (público, Notification URL)
  · Colecciones: xcel_connections, xcel_oauth_states, xcel_usage_daily, xcel_usage_summaries, xcel_notifications
- Web admin: /app/app/admin/energia/page.tsx + entrada nav "Energía" (Zap) en admin/layout.tsx
- Móvil: /app/rosslending-app/app/admin-energy.tsx + entrada "Energía" en admin-dashboard.tsx
- Tests: /app/ross-house-backend/tests/test_xcel_energy.py (7 unit parser ESPI ✅) + 7 pruebas curl E2E ✅
- ADAPTACIÓN URLs portal Xcel (12 Jun 2026, ya estaban registradas así):
  · Notification URL real: /api/greenbutton/notify → alias agregado al router (junto a /api/xcel/notify)
  · Redirect URL real: https://www.rosshouserentals.com/tenant/utilities?callback=greenbutton
    → XCEL_REDIRECT_URI actualizado en .env; creada página web /app/app/tenant/utilities/page.tsx
    que captura ?code&state y llama a POST /api/greenbutton/exchange (endpoint público nuevo, valida state).
  · Lógica de intercambio refactorizada en _exchange_code_and_save() (compartida por callback GET y exchange POST).
  · Probado E2E local: connect-url genera redirect_uri correcto, notify ok, exchange valida state, 7 unit tests verdes.
- Dashboard de gastos del inquilino YA EXISTENTE: móvil rosslending-app/app/services.tsx ("Mis Servicios",
  usa /api/tenant/utilities + /summary, registra gastos por proveedor incl. Xcel manualmente).
  FUTURO: alimentar kWh de Green Button automáticamente en esa vista por inquilino/propiedad.
- PENDIENTE USUARIO (portal Xcel + Railway):
  · Redirect URL: https://ross-house-backend-production.up.railway.app/api/xcel/oauth/callback
  · Notification URL: https://ross-house-backend-production.up.railway.app/api/xcel/notify
  · Agregar las 8 vars XCEL_* en Railway (el .env no se sube a GitHub)
  · Save to GitHub para desplegar backend (Railway) y web (Vercel)
- NOTA: useAuth() en rosslending-app NO expone `token` — usar getToken() de src/utils/api
  (admin-contract-detail.tsx tiene ese bug latente, no corregido por estar fuera de alcance).

## Facturación y pago de utilidades (12 Jun 2026)
- Decisión usuario: modo mixto por propiedad; pago en app (Stripe) + portal proveedor; facturas auto (Green Button kWh × tarifa) + ajuste manual.
- Backend: /app/ross-house-backend/rental/utility_billing_router.py (registrado en server.py):
  · PUT /admin/properties/{id}/utility-config (billing_mode landlord|provider|mixed, tarifa $/kWh, base_fee, provider_payment_url)
  · POST /admin/utility-bills/generate (suma xcel_usage_daily del mes × tarifa → factura al inquilino activo del contrato; no sobrescribe pagadas)
  · POST/GET/PUT/DELETE /admin/utility-bills (manual, ajustes, marcar pagada con payment_method)
  · GET /tenant/utility-bills (facturas + pending_total + billing_mode + provider_payment_url)
  · POST /tenant/utility-bills/{id}/create-payment (Stripe PaymentIntent, usa rental_config como la renta)
  · POST /tenant/utility-bills/{id}/confirm-payment (verifica intent succeeded + metadata bill_id, idempotente)
  · Colecciones: tenant_utility_bills, utility_bill_payments, properties.utility_billing
- Móvil (rosslending-app): services.tsx "Mis Servicios" ahora muestra sección "Facturas por pagar" con botón
  Pagar → Stripe PaymentSheet REAL (hook src/components/useStripeSheet.ts + .web.ts fallback; StripeWrapper ya
  estaba en _layout). Botón "Pagar mi luz directo en el portal de Xcel" si billing_mode provider/mixed.
- Web admin energia/page.tsx: formulario "Facturar al inquilino" por propiedad conectada (mes + tarifa → Generar factura).
- E2E local verificado: config, generate (255 kWh × $0.14 = $35.70, tenant asignado), tenant lista facturas,
  manual bill, marcar pagada, no regenerar sobre pagada (400), auth 401, Stripe sin config → 400 claro.
- NOTA: el pago de RENTA en app/pay/index.tsx sigue semi-MOCKED (crea intent pero no abre PaymentSheet) — el de
  utilidades SÍ usa PaymentSheet real. Considerar arreglar el de renta igual (reusar useStripeSheet).
- Requisito producción: rental_config (type company) debe tener stripe_enabled + stripe_secret_key + publishable.
- auth_tenant usa JWT (TENANT_JWT_SECRET en shared.py), NO sesiones en DB.

- Build #91 de Ross House Rentals (EAS id 9b16b971, proyecto ross-house-rentals) enviado a TestFlight
  el 12 Jun 2026 con: sección "Facturas por pagar" + Stripe PaymentSheet + botón portal Xcel + pantalla
  admin Energía. PENDIENTE verificación usuario.
- Usuario actualizó variables XCEL_* en Railway ✅. Falta que presione "Save to GitHub" para desplegar
  backend (Railway) y web (Vercel) — los endpoints nuevos darán 404 en producción hasta ese push.

## SMS automático + Pago de renta real (12 Jun 2026, Build #92)
- SMS Twilio al inquilino al generar factura (auto o manual): _notify_tenant_sms() en utility_billing_router
  (best-effort, no bloquea; usa TWILIO_* env; normaliza teléfono +1; respuesta incluye sms_sent).
  Web admin muestra "📲 SMS enviado" en el mensaje de confirmación.
- Pago de RENTA arreglado en app/pay/index.tsx: ya NO está mocked — usa useStripeSheet
  (initPaymentSheet + presentPaymentSheet) + POST /tenant/confirm-stripe-payment. Igual que utilidades.
- Build #92 de Ross House Rentals (EAS id 419a39ee) enviado a TestFlight — PENDIENTE verificación usuario.
- Probado: TSC limpio, bundle iOS 1,518 módulos OK, generate/manual bill devuelven sms_sent (false local sin
  Twilio creds — graceful; en Railway con TWILIO_* sí envía).

## Navegación "Mis Servicios" para inquilinos + Build #93 (12 Jun 2026)
- Verificado UI: "Mis Servicios" en Home Quick Actions (index.tsx), menú Perfil (profile.tsx) y
  pantalla services.tsx (resumen, gráficos, facturas, botón "Conectar Xcel") — capturas OK con login maria@test.com.
- FIX: expo-secure-store no funciona en web → agregado fallback localStorage en src/utils/api.ts
  (getToken/setToken/removeToken con Platform.OS === 'web'). Solo afecta preview web; iOS nativo usa SecureStore.
  Nota: requirió `supervisorctl restart expo` (caché Metro servía bundle viejo).
- Tarjeta "Conectar Xcel" solo aparece si backend devuelve xcel_connected:false en /tenant/utility-bills.
  Railway producción AÚN NO tiene los endpoints nuevos (utility-bills, xcel) → usuario debe presionar "Save to GitHub".
- Build #93 Ross House Rentals (EAS id 92140cdc) compilado y ENVIADO a TestFlight — PENDIENTE verificación usuario.

## Backlog priorizado
- P0: Verificar Build #1179 en TestFlight (usuario): tocar Citas sin citas → abre Reservar Cita directo; con citas → muestra resumen.
- P1: Búsqueda/filtro por SSN en web admin `datos-bancarios` (backend `banking_data_routes.py` list_banking_data + UI Next.js `/app/webapp/src/app/admin/datos-bancarios/page.tsx`).
- P1: Pre-llenar SSN guardado en Tax Wizard para clientes recurrentes (app iOS).
- P1: Integración "April Tax" API para e-file 1040 (esperando credenciales del usuario). MOCKED actualmente.
- P2: Refactor backend server.py en routers modulares.
- P2: Refactor customer-vault/page.tsx (fase 2) y frontend index.tsx (1700+ líneas).
- P2: Re-habilitar push notifications (expo-notifications) cuando se resuelva compatibilidad iOS 18.3.

## Credenciales de prueba
Ver /app/memory/test_credentials.md
- Admin: yoandyross@gmail.com / admin123
- Cliente: yoandyross2025@icloud.com / Interface@123

## Endpoints clave
- GET /api/appointments/my (auth Bearer session_token)
- GET /api/office-hours/status
- DELETE /api/appointments/{id}
- POST /api/auth/login → { session_token, user }

## Refactor Global de Temas Claro/Oscuro — App Móvil (Rondas 2-6) — COMPLETADO (Jun 2026)
- Migradas ~40 pantallas de /app/rosslending-app/app de colores dark hardcodeados a tema dinámico:
  patrón `const C = useColors(); const styles = React.useMemo(() => createStyles(C), [C]);`
  con StyleSheets convertidos a factorías `createStyles = (C: any) => StyleSheet.create({...})`.
- Batch A (tabs + tenant core): (tabs)/index, payments, properties, market, profile, _layout, chat,
  chat-conversation, notifications, documents, maintenance (index/new), emergency, pay, payment-methods,
  invoices, contracts, edit-profile, change-password, faq, services.
- Batch B: property-detail, market-detail, my-listings, scan-bill, add-utility, chat-support,
  forgot-password, lease-signing, section8-wizard, stripe-connect, tenant-inspections,
  tenant-inspection-sign, owner-dashboard, (auth)/login, (auth)/register, add-bank-account,
  legal/privacy, legal/terms, credit-builder, signing-center.
- Textos C.white/'#fff' clasificados: títulos/inputs/back-icons → C.textPrimary; textos sobre botones
  rojos/badges/overlays de fotos → se mantienen blancos.
- Logo login cambia según tema (ross_house_logo.png claro / _white.png oscuro).
- Verificado por testing_agent (iteration_21.json): PASS, 0 errores runtime, ambos temas legibles.
- PENDIENTE (baja prioridad): pantallas admin-* siguen en dark fijo (consistente, no roto);
  nit cosmético: contraste del pill de bandera en header Perfil modo oscuro;
  warnings web-only (shadow*, pointerEvents, transform-origin) — opcionales.

## Procesadores de Pago Multi-Gateway (Stripe/Square/Clover) — COMPLETADO (Jun 2026)
- Backend: /app/ross-house-backend/rental/payment_processors_router.py (registrado en server.py)
  - GET/PUT /api/admin/payment-processors[/{name}] — credenciales con secretos enmascarados (••••),
    valores enmascarados nunca sobreescriben; Stripe sincroniza con rental_config type=company.
  - POST /api/admin/payment-processors/{name}/activate — valida credenciales mínimas; setea
    active_processor y stripe_enabled legacy. /{name}/test — prueba conexión real
    (Stripe Account.retrieve, Square GET /locations, Clover GET /v3/merchants/{mid}).
  - GET /api/public/payment-processor — app/web consultan procesador activo (campos públicos).
  - Webhooks: POST /api/webhooks/square (HMAC-SHA256 base64 URL+body) y /api/webhooks/clover
    (Clover-Signature t=..,v1=.. + verificationCode) con dedupe → colección processor_webhook_events.
  - create_hosted_checkout(): Square Payment Links API / Clover Hosted Checkout.
  - payment_links_router: crear link de pago ahora RUTEA por el procesador activo (square/clover/stripe).
- Config en Mongo: rental_config { type: "payment_processors", active_processor, processors:{...} }.
- Web admin: /app/app/admin/configuracion/ProcesadoresPago.tsx — nuevo tab "Procesadores de Pago"
  en Configuración (3 tarjetas con campos, Guardar/Probar/Activar, badge ACTIVO, copiar webhook URL).
- App móvil: /app/rosslending-app/src/components/PaymentProcessorsAdmin.tsx montado en
  admin-settings.tsx (sección "Procesadores de Pago", tarjetas expandibles, Guardar/Probar/Activar).
- TESTEADO E2E: backend con curl (11 casos + firmas HMAC válidas/inválidas/duplicados/timestamp),
  web con Playwright (guardar Square → Configurado → Activar → ACTIVO), móvil render OK.
- NOTA: requiere deploy (push GitHub → Railway/Vercel) para verse en producción. Sin keys reales de
  Square/Clover aún — el usuario las pondrá cuando abra esas cuentas.

## Mejora Página Analytics (velocidad + datos reales) — COMPLETADO (Jun 2026)
- CAUSA de lentitud: (1) 11 requests separados del navegador; (2) el caché de ai-insights
  usaba hash del contexto → cualquier pageview lo invalidaba y forzaba llamada LLM (5-15s) al abrir.
- FIX velocidad: nuevo GET /api/admin/analytics/dashboard (todas las sub-consultas con
  asyncio.gather + caché en memoria 45s, ~30ms). Frontend usa dashboard con fallback a los 11.
  ai-insights ahora cachea por rango (TTL 30min) → sin LLM en cada carga.
- CAUSA de datos dudosos: el filtro polymeta/searchezee/simmani NUNCA se implementó (afirmación
  errónea de agente previo); avg_duration inflado (heartbeats de pestañas abiertas → 4.7h).
- FIX datos reales: SPAM_REF_RE en visitor_analytics_router (polymeta, searchezee, simmani,
  boardreader, semalt, etc.) → sesiones marcadas is_bot con bot_reason='spam_referrer';
  track_page/event/heartbeat ignoran sesiones bot; duración cap 30min/sesión;
  POST /api/admin/analytics/cleanup-bots (retroactivo, dry_run opcional);
  badge de calidad en la UI: "X sesiones reales / Y bots excluidos".
- Índices nuevos: sessions(is_bot,first_seen), sessions(first_seen), events(type,ts).
- LIMPIEZA PRODUCCIÓN EJECUTADA (Atlas directo): 4 sesiones spam marcadas + 4 eventos borrados;
  78 sesiones reales restantes.
- TESTEADO E2E local: tracking real vs spam vs bot-UA, dashboard combinado + caché, cleanup
  dry-run/real, y UI con Playwright (badge + KPIs correctos excluyendo spam).
- PENDIENTE: push a GitHub → deploy Railway/Vercel para que llegue a producción.

## Buzón de Email Admin + Seguimiento Impuestos — COMPLETADO (Jun/Ago 2026)
- Verificación SendGrid Activity API: emails de impuestos (waiver cta 13572 → taxoffice@moore-tx.com;
  cambio dirección → crivera@moore-tx.com + janie@mcountycad.com) ENTREGADOS 8/1, sin aperturas
  registradas (gobierno bloquea trackers).
- Follow-up PROGRAMADO vía SendGrid send_at para Mié 5 Ago 9:00 AM CT (batch_id cancelable, con CC
  al usuario), registrado en email_inbox de producción.
- NUEVO módulo Buzón: backend /app/ross-house-backend/rental/email_inbox_router.py
  (GET/POST /api/admin/inbox*, POST /api/admin/inbox/send con send_at programable máx 72h +
  cancel-scheduled/{batch_id}, webhook POST /api/webhooks/email-inbound para SendGrid Inbound Parse,
  colección email_inbox con folders inbox/sent, hilos por thread_key, read/unread/delete).
- UI: /app/app/admin/buzon/page.tsx (2 paneles, Recibidos/Enviados, búsqueda, responder, redactar,
  programar envío, cancelar programados, badge no-leídos) + link en sidebar (grupo Sistema).
- PARA RECIBIR correos (pendiente usuario): MX inbox.rosshouserentals.com → mx.sendgrid.net +
  SendGrid Inbound Parse apuntando al webhook. El ENVÍO ya funciona sin ese paso.
- TESTEADO E2E: webhook entrante, listar/leer/no-leído, envío real, programado+cancelación, 401,
  y UI completa con Playwright.
- Boom rechazó partnership (mínimo 75 unidades) → alternativas investigadas: Credit Rent Boost /
  auto-inscripción del inquilino (Boom consumer, Self) / Avail CreditBoost. Screening: cuenta normal
  SmartMove sin mínimo. Investigación completa enviada por PDF al email del usuario.
- Square: usuario ya tiene cuenta; esperando que pegue las 4 keys (Application ID, Access Token,
  Location ID, Webhook Signature Key) para guardarlas en producción.

## Verificación Completa Procesadores de Pago + 3DS + Buzón — COMPLETADO (Ago 2026)
- TESTEADO E2E backend local (uvicorn puerto temporal + DB de prueba, 36/36 escenarios PASS):
  CRUD payment-processors (defaults, guardado por entorno sandbox/production, secretos enmascarados
  y round-trip sin sobreescribir, switch de entorno con validación de credenciales, activate con
  sync legacy stripe_enabled/company, endpoint público sin secretos, toggle 3DS con sync
  stripe_3ds_enabled), webhooks Square (HMAC válida/inválida/duplicado) y Clover
  (verificationCode, firma t=..,v1=..), buzón email (inbound webhook, listar, leer/no-leído,
  búsqueda, borrar, validación send), /api/admin/analytics/dashboard combinado.
- BUG ARREGLADO: webhook Clover leía webhook_signing_secret del esquema plano viejo →
  la verificación de firma se saltaba silenciosamente. Ahora usa _active_creds() (credentials[env]).
- BUG ARREGLADO: PaymentProcessorsAdmin.tsx (app móvil) usaba el esquema plano viejo y hacía doble
  JSON.stringify en save(). REESCRITO con esquema anidado credentials[sandbox|production], pestañas
  de entorno, botón cambiar entorno activo, switches 3DS (Stripe/Square) y badges de entorno.
  Verificado con screenshot (login admin → Configuración → Procesadores de Pago).
- UI web (ProcesadoresPago.tsx, buzon/page.tsx): lint OK, sin errores TS nuevos.
- SQUARE PRODUCCIÓN CONFIGURADO: usuario dio Application ID (sq0idp-KYDjsY...) y Access Token;
  validados contra API de Square (cuenta "Ross House Rentals LLC", Dumas TX, ACTIVA); Location ID
  L0FXV515QT88E obtenido automáticamente. Guardados en Atlas producción
  (rental_config.payment_processors → square.credentials.production, environment=production).
  Stripe sigue como procesador ACTIVO hasta que el usuario active Square.
- PENDIENTE usuario: (1) push a GitHub → deploy Railway/Vercel; (2) Webhook Signature Key de Square
  (registrar https://ross-house-backend-production.up.railway.app/api/webhooks/square en Square
  Developer Dashboard); (3) rotar token ghp_ expuesto; (4) vars de entorno en Railway.

## Square: cuenta DESACTIVADA para pagos por Square (Ago 3, 2026)
- Square rescindió los servicios de pago (Sección 36) tras su revisión de riesgo automática:
  giro rentas/bienes raíces (MCC 6513) + cuenta nueva sin verificación completada.
- API sigue viva (merchant ACTIVE, crea payment links) pero el checkout muestra
  "Por el momento, este negocio no acepta pagos" — verificado con link real de $1 (borrado después).
- Credenciales de producción guardadas en rental_config.payment_processors quedan por si el
  usuario apela y reactivan. STRIPE SIGUE COMO PROCESADOR ACTIVO (3DS obligatorio) — sin impacto.
- Apelación posible: squareup.com/help con docs de la LLC (Certificate of Formation, EIN, ID).

## 121 Oak Ave rentada a hermana + contrato creado (Ago 4, 2026)
- Inquilina: Yandisleydis Ross Sanchez (INQ-2026-003, yosbelgarrido26@gmail.com, 305-784-3297).
  Cuenta de app creada, welcome email+SMS enviados.
- Contrato CONT-2026-001 (id 6a719b7e34f736a274cddac4, DRAFT pendiente de firma): $1,100/mes,
  01-Ago-2026→31-Jul-2027, depósito exonerado, pago con tarjeta/autopay, renovación anual
  automática (aviso 60 días, renta ajustable), cláusulas 4.2 (autopay) y 7.1 (renters insurance
  $100K) verificadas en PDF.
- Pago agosto 2026 registrado: REC-2026-0002, $1,100 vía Zelle, completed.
- Cláusula 7.1 renters insurance agregada al template (requisito de la atestación de Obie/Evanston).
- SEGURO 121 Oak: Obie/Evanston $1,804.37/año (aprobado por usuario), efectivo 12-Ago-2026,
  Named Insured = LLC, Additional Insured = Yoandy Ross ✓, casa OCUPADA desde 01-Ago ✓.
- Pendiente: firmar contrato (admin+hermana), hermana guarda tarjeta+autopay en app, su renters
  insurance $100K, cotizar seguro de 812 NE 2nd, umbrella $1M.
- NOTA: 121 Oak impuestos 2025 en CAD aparecen SIN PAGAR $4,736.38 (waiver de penalidades en trámite).

## Solicitud formal + flujo completo hermana (Ago 4, 2026)
- Solicitud formal en rental_applications (id 6a71a083ed7fe20123166aa1): fechada 30-Jul-2026,
  aprobada 31-Jul, DOB 1986-02-17, SSN ENCRIPTADO con VAULT_ENCRYPTION_KEY (solo last4 "2267"
  visible), screening exonerado (familiar, ID verificada en persona), ligada a tenant+contrato.
- BUG ARREGLADO (signatures_router.py): TODOS los endpoints usaban llamadas síncronas contra
  Motor (500 en /signatures/pending, /sign, /history, overview). Reescrito async + matching de
  tenant vía colección tenants (email), check de propiedad al firmar, landlord opcional en
  all_signed, propiedad→rented al completar firmas. Desplegado y verificado e2e en prod.
- Contrato CONT-2026-001 → status pending_signatures. Verificado con login real de la inquilina:
  aparece en /signatures/pending con needs_my_signature=true. Recibo PDF (REC-2026-0002) descarga OK.
- Email de invitación enviado (SendGrid 202, BCC a Yoandy): credenciales, App Store link
  (id6775734340), web, 4 pasos (firmar, autopay, renters insurance, recibo).
- Falta: Yoandy firma como admin (admin panel o app signing-center), hermana firma en app.

## Sesión Jun 2026 (fork): Health check + Módulo Screening (Ago 5, 2026)
- Lint frontend COMPLETO (rosslending-app + Next.js admin): todos los errores ESLint corregidos
  (unescaped entities, display-name, empty blocks, target=_blank, directivas de reglas desconocidas).
- test_credentials.md actualizado y verificado contra prod: admin móvil/API SIN 2FA vía
  POST /api/public/marketplace-login (yoandyross@gmail.com/admin123); tenant 121 Oak
  (yosbelgarrido26@gmail.com/sRUUSvEB4O). Panel web admin SÍ tiene 2FA (login-step1/2 + Turnstile).
- testing_agent (iteration_22): verificados e2e los fixes de admin-contract-detail.tsx (token de
  secure storage) y signatures_router (200 en /pending). Sin regresiones.
- DEPLOYMENT HEALTH CHECK: el deployment_agent inspecciona /app/frontend + /app/backend que son
  la app LEGACY "Ross Tax" (otro producto). USUARIO CONFIRMÓ: Ross Tax ya no se publica desde
  este workspace — IGNORAR esos bloqueadores. Ross House se deploya: backend→Railway (git push
  en /app/ross-house-backend), admin web→push a remote vercel-site (squash con git commit-tree
  porque la historia intermedia contiene secretos y GitHub Push Protection la bloquea),
  app móvil→rosslending-app (EAS).
- SEGURIDAD: untracked .git-credentials (contiene ghp_ token — RECORDAR AL USUARIO ROTARLO),
  frontend/google-play-service-account.json y memory/test_credentials.md; removidos fallbacks
  hardcodeados de SendGrid API key en backend/send_locker_research.py y send_tax_api_emails.py.
- NUEVO MÓDULO: Screening de crédito/antecedentes provider-agnostic en Aplicaciones.
  Backend rental/screening_router.py (desplegado en Railway):
    POST /api/admin/rental-applications/{id}/screening/request (SmartMove/BoomScreen/otro,
      email brandeado al aplicante con enlace, auto new→reviewing)
    PATCH .../screening (status: requested/in_progress/completed/cancelled; results: credit_score
      300-850, income_verified, criminal/eviction_records clean|found, recommendation
      approve/conditional/reject, notes)
    POST/GET .../screening/report (PDF base64 ≤10MB en colección screening_reports)
  Soporta esquema legacy {type:'waived', reason} → status 'waived' (Exonerado) con opción de
  solicitar de todas formas. Serializado en GET rental-applications.
  Frontend: app/components/admin/ScreeningPanel.tsx + badge en fila (page aplicaciones).
  Tests: tests/test_screening_flow.py — 11/11 passing (app FastAPI mínima + Atlas, sin crons).
  Verificado visualmente en Next dev local (cookie rhr_admin_token inyectada, tema claro OK).
  Cuando el usuario obtenga API de SmartMove/Boom, sustituir el paso request por llamada real.
- PENDIENTE del usuario: rotar token ghp_, vars de entorno prod (STRIPE_WEBHOOK_SECRET,
  VAULT_ENCRYPTION_KEY), resultado visita Moore County; esperando a Obie (coinsurance) y
  Joe Kuruvila (Jasmine). Sin respuestas aún al 5-Ago.

## Moore County Tax Office — RESPUESTA RECIBIDA (Ago 5, 2026)
- Chris A. Rivera (Tax Assessor Collector, 806-935-2175, crivera@moore-tx.com):
  1) ✅ Cambio de dirección postal CONFIRMADO a 305 Bruce, Dumas TX 79029 (cuentas 13572 y 12973).
  2) ❌ Waiver de P&I DENEGADO por la oficina: el bill 2025 se envió a Yoandy Ross en
     2108 Bonfoy Ave, Colorado Springs CO 80909 conforme al warranty deed de junio 2025.
     El deed a Ross House Rentals LLC (dirección Bruce) no se registró hasta el 8-Jul-2026,
     por lo que NO califica como error de la oficina (Tax Code 33.011 no aplica).
  3) Única vía restante: pedir a las TAXING UNITS con jurisdicción (Moore County, Dumas ISD,
     City of Dumas, Moore County Hospital District, etc.) ser agregado a sus agendas y que
     sus órganos de gobierno VOTEN el waiver.
- Estado cuenta 13572: impuestos 2025 $4,736.38 sin pagar + penalidad ~$630 + attorney fees
  ~$789. Interés sigue corriendo ~1%/mes mientras no se pague.
- PENDIENTE: decisión del usuario — pagar ya (detiene intereses) y/o solicitar agenda a las
  taxing units (pueden reembolsar P&I después si votan a favor, Tax Code 31.11).

## Módulo Impuestos + Header Admin (Ago 5, 2026 - tarde)
- NUEVO: rental/property_taxes_router.py — sync en vivo de deuda con Moore County via
  GET esearch.co.moore.tx.us/Property/GetPropertyTaxDueModalResult?id={acct}&year={yr}
  (sin captcha server-side). Endpoints: GET /api/admin/property-taxes,
  POST /api/admin/property-taxes/sync. Cron diario property_tax_sync_loop en server.py.
  Colección: property_tax_status. tax_reminder_cron ahora usa montos REALES sincronizados.
  Tests: tests/test_property_taxes.py 4/4 passing (incluye sync en vivo).
  Datos reales verificados: 13572 (121 Oak) VENCIDO $4,736.38 (base $3,316.80 + P&I $630.18
  + abogado $789.40, año 2025); 12973 (812 NE 2nd) al día. Usuario pagará EN LÍNEA.
- NUEVO: /admin/impuestos page (Next.js) con banner deuda total, cards por propiedad,
  desglose por año, botones Pagar en línea / Ver en portal. Link en sidebar FINANZAS.
- HEADER ADMIN REDISEÑADO (pedido del usuario): widget QR de la app y toggle de tema
  MOVIDOS del fondo del sidebar al header superior (AppHeaderButton nuevo en
  AppPromoBanner.tsx + ThemeToggle icon-only). Sidebar más limpio.
- Deploys: backend Railway e917164; web Vercel 0c5c31a2a (squash).
- PENDIENTE: usuario pagará $4,736.38 en línea (portal → carrito Certified Payments).
  Ofrecidas más mejoras de UI del menú (esperando decisión).
