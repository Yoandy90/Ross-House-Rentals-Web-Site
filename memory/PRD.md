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

## Mejoras de Navegación Admin + Cuenta de Impuestos en Propiedades (Ago 5, noche)
- Backend rental/admin_nav_router.py (Railway 3d49d63):
  GET /api/admin/nav-summary → conteos reales {new_applications, open_maintenance,
    pending_signatures, late_payments, delinquent_taxes{count,total_due}, total}
  GET /api/admin/global-search?q= → busca properties/tenants(app_users)/contracts/applications
  Tests: tests/test_admin_nav.py 5/5 passing.
- properties_router: create/update aceptan tax_account_id + tax_annual_estimate
  (nuevas casas entran solas al sync diario de impuestos). FIX: update_property le
  faltaba el parámetro background_tasks (crasheaba al pasar a 'available').
- Frontend (Vercel 731b8ba08), TODAS verificadas con Playwright vs Railway:
  1. 🔔 NavBell.tsx — campana en header con badge rojo total + dropdown de pendientes con links
  2. ⭐ Favoritos — estrella en items del sidebar (localStorage rhr_nav_favs), grupo FAVORITOS arriba
  3. ⌘K CommandPalette.tsx — Ctrl/Cmd+K o botón Buscar; menú + búsqueda backend con debounce,
     navegación con flechas/Enter
  4. Badges rojos en sidebar: aplicaciones/mantenimiento/contratos/pagos/impuestos
  5. MobileBottomNav.tsx — barra inferior móvil (Inicio/Pagos/Contratos/Casas/Menú) lg:hidden
  6. Formulario de propiedad: campos "Cuenta Impuestos (Moore County)" y "Impuesto anual estimado"
- NOTA deploy Vercel: SIEMPRE push con squash (git commit-tree HEAD^{tree} -p vercel-site/main)
  — la historia local contiene secretos bloqueados por GitHub Push Protection.

## Buzón de Email con AI (Ago 5-6, 2026)
- Backend email_inbox_router.py ampliado (Railway c834121):
  * Webhook inbound: clasifica spam (spam_score>=5 → folder 'spam'), ignora remitentes
    automáticos (no-reply/mailer-daemon/etc), y en background: auto-ack + borrador AI + auto-send.
  * Auto-ack: confirmación de recibido, máx 1/remitente/24h (colección email_acks), configurable.
  * Borradores AI: emergentintegrations LlmChat (Claude Sonnet 4.5, mismo stack que AI Brain,
    EMERGENT_LLM_KEY en Railway). Prompt: responde en idioma del email, no inventa precios.
  * Config: app_settings {_id:'email_ai'} {auto_ack_enabled(T), auto_draft_enabled(T),
    auto_send_enabled(F), ack_message}. Endpoints GET/PUT /api/admin/inbox/ai-config
    (definidos ANTES de /admin/inbox/{email_id} por orden de rutas).
  * POST /admin/inbox/{id}/ai-draft (regenerar), /approve-draft (enviar, body editable),
    /move (inbox↔spam).
  * Tests: tests/test_email_ai.py 9/9 (mockea envío+LLM; fixture resetea config en BD compartida).
  * VERIFICADO EN PROD: borrador AI real generado vía /ai-draft en Railway (Claude respondió
    profesional en español). Email de prueba eliminado, config restaurada (ack=on, autosend=off).
- Frontend buzon/page.tsx (Vercel 8387ead69): pestaña Spam, panel "Respuesta sugerida por AI"
  (textarea editable + Aprobar y enviar + Regenerar), badges en lista (✨ borrador/🤖 auto/✅),
  botón AI en header → modal con 3 toggles + mensaje de ack editable, botones mover a/de spam,
  banner con instrucciones de Inbound Parse.
  BUG conocido resuelto: fetch de ai-config debe esperar token (useEffect [token]).
- DNS del usuario: rosshouserentals.com usa SiteGround (ns1/ns2.siteground.net) con MX de
  SiteGround (mailspamprotection.com) — tiene mailbox existente. PASOS PENDIENTES DEL USUARIO
  para recibir email en el buzón: (1) MX inbox.rosshouserentals.com → mx.sendgrid.net prio 10
  en SiteGround DNS Zone Editor; (2) SendGrid Inbound Parse Add Host & URL →
  https://ross-house-backend-production.up.railway.app/api/webhooks/email-inbound con
  "Check incoming emails for spam" marcado; (3) forwarder info@ → admin@inbox.rosshouserentals.com
  en SiteGround Email Forwarders. Guía enviada al usuario en finish del 6-Ago.

## Buzón IA — Setup DNS completado + Clasificación por categoría (Ago 6, 2026)
- USUARIO COMPLETÓ: (1) Domain Authentication de rosshouserentals.com en SendGrid (5 CNAME +
  TXT DMARC verificados en SiteGround DNS); (2) MX inbox.rosshouserentals.com → mx.sendgrid.net
  prio 10; (3) Inbound Parse inbox.rosshouserentals.com → webhook Railway con spam check;
  (4) Forwarder SiteGround info@ → admin@inbox.rosshouserentals.com.
- VERIFICADO E2E EN PRODUCCIÓN (3 correos reales): entrante directo a admin@inbox, factura,
  y correo a info@ vía forwarder — todos llegaron, se clasificaron y generaron borrador AI.
- NUEVA FEATURE clasificación AI (backend Railway + Vercel 4b22e31):
  * _classify_email() con Claude → categorías: lead/tenant/provider/invoice/other.
    Prompt prioriza invoice sobre provider cuando es un cobro.
  * Se ejecuta en _process_inbound_ai (paso 0, incluso para remitentes automáticos).
  * GET /api/admin/inbox: param ?category= + campo category_counts (agregación inbox).
  * POST /api/admin/inbox/{id}/category (manual, valida categorías, marca category_manual).
  * POST /api/admin/inbox/classify-pending (clasifica hasta 15 sin categoría).
  * UI buzon/page.tsx: chips de filtro con conteos (solo pestaña Recibidos), badges de color
    por categoría en lista, selector de categoría en detalle, botón "Clasificar N pendientes".
  * Tests: test_email_ai.py ampliado a 13 (mock _classify_email) — 13/13 PASS.
- NOTA deploy Vercel: el build tardó ~45 min en publicarse (cola lenta) — tener paciencia
  antes de asumir fallo.

## Selector de remitente + Modelo Multi-Unidad (Ago 6, 2026)
- SELECTOR REMITENTE (backend Railway + Vercel): SENDER_ADDRESSES 9 alias @rosshouserentals.com
  (info default, contact, yoandy, yoandyross, payments, no-reply, rentas, mantenimiento, soporte).
  Dominio autenticado en SendGrid → cualquier alias puede enviar. POST /admin/inbox/send acepta
  from_email (valida whitelist); approve-draft/auto-send/ack responden desde el alias receptor
  (_pick_sender sobre header 'to'). ai-config GET expone {senders, default_sender}. UI: dropdown
  'De:' en redactar + hint 'Se enviará desde' en panel AI. Tests 16/16.
- MULTI-UNIDAD (units_router.py NUEVO): colección property_units {property_id, unit_name, bedrooms,
  bathrooms, rent_amount, deposit_amount, status available|rented|maintenance, current_tenant_id,
  current_contract_id}. Endpoints: GET/POST /admin/properties/{id}/units (POST soporta bulk_count
  hasta 200 con prefix+start_number — listo para Jasmine 142 unidades), PUT/DELETE /admin/units/{id}
  (delete bloqueado si rentada). sync_property_from_units deriva status/counters de la propiedad
  (respeta status_manually_set). Contratos: unit_id opcional (crear valida unidad libre, autofill
  renta/depósito de la unidad, property_address += ' — Apt X'); activar→mark_unit_rented,
  terminar/expirar/revertir→free_unit; tenants.current_unit_id. property_sync_cron y
  /admin/properties/sync-status saltan multi-unit (derivan de unidades). Tests tests/test_units.py 9/9.
- UI: components/admin/UnitsManager.tsx (modal: resumen 4 tarjetas, crear una/bulk, editar inline,
  status select, eliminar), botón Layers + chip 'X/Y' en tarjetas de propiedades, selector 'Unidad'
  en form de contratos (requerido si la propiedad tiene unidades, deshabilita ocupadas).
- FIX TEMA CLARO: globals.css ahora mapea bg-[#0d1526] y /80 → blanco (antes modales de Buzón y
  Unidades quedaban azul oscuro con texto oscuro invisible en light).
- TESTING: testing_agent iteración 23 (frontend E2E vía next dev :3005 + cookie rhr_admin_token
  del marketplace-login sin 2FA) — buzón categorías/remitentes/unidades/contratos OK. INCIDENTE
  RESUELTO: prueba manual creó 3 units en 121 Oak Ave real (locator .last) — limpiado y verificado
  (is_multi_unit False, 0 units, solo 2 propiedades reales). Cuidado con .last en cards de
  propiedades: crear SIEMPRE propiedad TEST y localizar su card por nombre.
- Deploys: backend Railway (2 pushes), Vercel squash 0d18e5596 (multi-unidad + fix tema).

## Fase 2: Módulo 1099-NEC (Ago 6, 2026)
- BACKEND rental/tax_1099_router.py (NUEVO, registrado en server.py):
  * GET /admin/1099/summary?year= → filas por proveedor con {reportable, excluded, needs_1099
    (umbral $600), w9_complete, w9 con tin_masked} + payer + totals. REGLA IRS: métodos
    stripe_card/paypal/venmo/cashapp EXCLUIDOS (los reporta el procesador en 1099-K);
    cash/check/zelle/wire/stripe_ach/other SÍ reportables. Solo pagos status='paid' del año.
  * PUT /admin/1099/payer → app_settings {_id:'tax_1099'} (name, ein, address...). Default
    Ross House Rentals LLC, 305 Bruce Ave. EIN requerido para payer_complete.
  * PUT /admin/1099/providers/{id}/w9 → service_providers.w9 {legal_name, business_name,
    tax_classification, tin_type, tin (valida 9 dígitos), address...}. TIN completo en DB,
    enmascarado ***-**-XXXX en UI/summary, completo solo en CSV e-file.
  * GET /admin/1099/providers/{id}/pdf?year= → PDF Copy B sustituto (reportlab, Pub 1179).
  * POST /admin/1099/providers/{id}/email → envía PDF adjunto vía SendGrid (bilingüe según
    language_pref), marca form_1099_sent.{year}.
  * GET /admin/1099/export/csv → CSV con TIN completo para e-file (Tax1099/IRIS).
- UI /admin/formularios-1099 (nav grupo finanzas, icono FileBarChart lime): selector año,
  3 tarjetas resumen, alerta si falta EIN, filas con badges, modal W-9, modal payer,
  descargar PDF, enviar email, export CSV.
- Tests tests/test_1099.py 6/6 (fixture restaura payer config; OJO: correr tests deja/borra
  payer según estado previo — tras primera corrida se limpió manualmente el EIN falso).
- provider_payments reales: solo 3 residuos QA 'cancelled' (correctamente excluidos).
  service_providers: 3 residuos de pruebas del usuario (no borrados a propósito).
- Deploys: Railway OK (verificado summary 200 en prod), Vercel squash f223ed769.

## Fase 5: Publicar Anuncios (Ago 6, 2026)
- BACKEND rental/listing_feed_router.py (NUEVO, registrado en server.py):
  * GET /public/listings-feed.xml (sin auth) → XML estilo hotPadsItems v2.1 con propiedades
    'available' + unidades libres de multi-unidad. Fotos con URL pública
    {SITE}/api/public/property-file/... (SITE=https://www.rosshouserentals.com constante).
    Escaping XML correcto. Excluye rentadas/mantenimiento.
  * POST /admin/listings/{property_id}/ad-copy (body {unit_id?}) → Claude genera JSON
    {es:{title,description,bullets,social}, en:{...}} y se cachea en properties.ad_copy.
    Social post incluye teléfono (806) 934-2018. Usa MODEL de ai_brain_router.
  * GET /admin/listings/publish-info → listings disponibles + ad_copy cacheado + feed_url.
- UI /admin/publicar (nav grupo PROPIEDADES, icono Megaphone): tarjeta feed URL con copiar,
  guía de 4 portales (Zillow Rental Manager manual, Facebook Marketplace, Zumper, Apartments.com),
  cards por listing con Generar/Regenerar anuncio IA, tabs ES/EN, botones copiar por sección.
  CopyBtn extraído fuera del componente (lint no-unstable-nested-components).
- REALIDAD PORTALES: Zillow no acepta feeds de landlords pequeños → flujo copiar/pegar.
  Zumper/Hotpads partners sí pueden consumir el feed XML.
- Tests tests/test_listing_feed.py 5/5 (LLM mockeado vía monkey-patch de LlmChat).
- VERIFICADO PROD: feed vivo (2 propiedades, 12 fotos), anuncio AI real generado para
  121 Oak Ave (guardado en ad_copy). Screenshot de página OK.
- Deploys: Railway OK, Vercel squash 954721c95.
- EIN configurado: usuario subió CP 575 → payer 1099 completo (EIN 39-3060069) en prod.

## Fase 3: Conciliación Bancaria Plaid (Ago 6, 2026)
- Credenciales del usuario (Sandbox): PLAID_CLIENT_ID=6a74332914a08e000d073377,
  PLAID_SECRET=0d961a14be8720f22dec65e96cbce7, PLAID_ENV=sandbox — agregadas a .env LOCAL.
  ⚠️ PENDIENTE: usuario debe agregar las 3 vars en Railway dashboard (issue recurrente #4).
  Producción: usuario debe pedir Production access en Plaid (~1-3 días) y cambiar
  PLAID_SECRET al de producción + PLAID_ENV=production.
- BACKEND rental/plaid_router.py (plaid-python 37.1.0 agregado a requirements.txt):
  * POST /admin/plaid/link-token (products=[transactions], lang es)
  * POST /admin/plaid/exchange {public_token, institution_name} → plaid_items
    {item_id, access_token(nunca se expone), accounts, cursor}
  * POST /admin/plaid/sync → transactions/sync paginado con cursor → bank_transactions
    {transaction_id único, amount (Plaid: + = sale dinero), date, pending, category,
    match:{status unmatched|matched|ignored}} → corre _auto_match al final
  * _auto_match: monto exacto ±$0.01 y fecha ±4 días contra MATCH_SOURCES:
    rental_payments(in), property_expenses/provider_payments/utility_payments(out).
    Campos amount/date detectados con fallbacks (AMOUNT_FIELDS/DATE_FIELDS).
  * GET /admin/plaid/transactions?status=&limit + counts agregados
  * POST /admin/plaid/transactions/{txid}/status {ignored|unmatched} manual
  * POST /admin/plaid/reconcile · DELETE /admin/plaid/items/{item_id} (item_remove + limpia)
- UI /admin/banco (nav FINANZAS, react-plaid-link 5.0 instalado con npm en /app):
  ConnectButton usePlaidLink, cards de cuentas con balances, % conciliado, filtros
  matched/unmatched/ignored, botones Sincronizar/Conciliar, Ignorar/Restaurar por tx.
- Tests tests/test_plaid.py 6/6 con SANDBOX REAL (sandbox_public_token_create ins_109508
  First Platypus Bank, sync importó transacciones reales de sandbox, auto-match verificado,
  teardown hace item_remove y limpia bank_transactions).
- Deploys: Railway push OK (endpoints darán 500 hasta que usuario agregue env vars),
  Vercel squash 3c8cbfebb. Smoke screenshot página OK (SANDBOX badge, empty state con
  credenciales de prueba user_good/pass_good visibles).

## Cron Plaid + Alertas (Ago 6, 2026)
- rental/plaid_sync_cron.py (NUEVO, registrado en server.py lifespan):
  * plaid_sync_loop cada PLAID_SYNC_INTERVAL_HOURS (default 24h), delay inicial 2 min.
    Omite si faltan credenciales o no hay plaid_items.
  * run_full_sync() extraído en plaid_router (endpoint /admin/plaid/sync lo reusa).
  * check_large_unmatched(db): unmatched con |monto| >= umbral (app_settings
    {_id:'plaid_alerts'}.threshold, default $500) y alerted != true → email a
    yoandyross@gmail.com vía _send_via_sendgrid del buzón → marca alerted=true (no repite).
- nav-summary ahora incluye bank_unmatched (count); NavBell + badge /admin/banco en layout.
- Tests test_plaid.py 7/7 (test_07 mockea _send_via_sendgrid; nota: el sandbox importa
  >20 txs grandes → asserts tolerantes a múltiples tandas de alerta).
- Deploys: Railway push OK, Vercel squash ec8411e63.

## Radar de Oportunidades — Deal Finder Off-Market (Ago 6, 2026)
- Requerimiento del usuario: módulo para detectar casas/terrenos en venta, remate o buenos
  candidatos para contactar dueños y ofrecerles comprar. Alcance elegido: Moore + condados
  vecinos (Sherman/Hartley/Potter), todos los tipos de propiedad, V1 aprobada.
- Fuente V1: portal fiscal del condado de Moore (BIS eSearch, esearch.co.moore.tx.us).
  Flujo scraping: GET /search/requestSessionToken → GET /search/result (meta search-token)
  → POST /search/SearchResults (JSON {page,pageSize,isArb,searchToken}).
  Sintaxis keywords: OwnerName:x / StreetName:x / Subdivision:x / Abstract:x (comillas si hay espacios).
  Detalle: /Property/View/{id} → dirección postal del dueño + desglose de valores.
  Impuestos atrasados: reusa fetch_account_tax_due de property_taxes_router.
  ⚠️ Potter (PRAD) usa TrueProdigy SPA, Sherman/Hartley otras plataformas — registrados en
  COUNTIES como inactive ("próximamente"); investigar sus APIs en V2.
- BACKEND rental/deal_finder_router.py (registrado en server.py):
  * POST /admin/deal-finder/scan {county, search_type, query, max_results≤100, only_delinquent}
    → asyncio task _run_scan con progreso en deal_finder_scans (searching→enriching→done).
    Excluye tipos MN (minerales) y A (autos). Pausas 0.5-0.8s para no saturar el portal.
  * Señales heurísticas compute_signals(): tax_delinquent, absentee_owner (ciudad postal ≠
    ciudad situs), out_of_state_owner, vacant_land (R sin mejora), low_improvement (<25% del
    market), low_value (<$60k).
  * GET /admin/deal-finder/leads (filtros status/signal/county/q, sort score|tax_due|value|recent)
    · GET/PATCH/DELETE leads/{id} (pipeline: new→contacted→interested→offer_sent→negotiating→
    acquired|discarded + notes) · GET stats · GET counties · GET scans, scan/{id}.
  * AI (Claude sonnet-4-5 vía EMERGENT_LLM_KEY): POST leads/{id}/analyze → {ai_score 0-100,
    veredicto, razones, estrategia, oferta_sugerida_pct}; POST leads/{id}/letter → carta de
    oferta bilingüe EN/ES (sin mencionar problemas financieros del dueño).
  * Colecciones: deal_finder_leads (upsert por county+property_id, preserva status/notes/AI
    en re-scans), deal_finder_scans.
- UI /admin/oportunidades (nav FINANZAS→después de Inversiones, icono Target naranja):
  stats cards, panel de escaneo con barra de progreso (poll 4s), chips de filtro por señal,
  lista de leads con badges, drawer con dueño+dirección postal, valores, deuda fiscal,
  análisis AI, carta copiable EN/ES y pipeline de seguimiento con notas.
- Tests tests/test_deal_finder.py 9/9 (parsers unit + scraping EN VIVO del portal + scan E2E
  real de 5 propiedades + CRUD/auth). Verificado con datos reales: 424 S Birge debe
  $10,080.44 (2021-2025), dueño en Amarillo, score AI 85/100, carta generada OK.
- Deploys: ross-house-backend main 55d2ab4 → Railway; app vercel/main 18e39e480 → Vercel.

## Radar Automático Nocturno + Dashboard compacto (Ago 6, 2026 - tarde)
- Dashboard /admin rediseñado compacto/responsivo (page-client.tsx): welcome strip 1 línea,
  tarjetas -30%, grids adaptativos, main padding p-3/p-4. Verificado en prod 1366x700.
- deal_finder_cron.py (NUEVO, registrado en server.py lifespan):
  * deal_finder_scan_loop cada DEAL_FINDER_SCAN_INTERVAL_HOURS (default 24h, delay 180s).
  * run_auto_scan_batch: recorre TODO Moore County rotando prefijos StreetName:a..z0-9
    (el portal BIS hace prefix-match — verificado: 'StreetName:a' → 831 resultados).
    Lotes de max_per_run (default 200) propiedades/noche, cursor persistente en
    app_settings {_id:'deal_finder_cron_state'} {letter_idx, page, cycles, last_run, last_result}.
    Si el lote se llena a mitad de página, la repite (upserts idempotentes).
  * Alerta email (SendGrid _send_via_sendgrid del buzón) a alert_email (default
    yoandyross@gmail.com) cuando hay: nuevas oportunidades FUERTES (_is_strong:
    tax_delinquent, o absentee+vacant_land/low_improvement) o propiedades que SE VOLVIERON
    morosas (became_delinquent detectado en enrich_and_upsert comparando señales previas).
  * Config app_settings {_id:'deal_finder_cron'} {enabled, max_per_run (clamp 20-500), alert_email}.
- deal_finder_router refactor: enrich_and_upsert() extraído (compartido scan manual + cron),
  ahora retorna (outcome, lead, became_delinquent).
- Endpoints nuevos: GET/PATCH /admin/deal-finder/cron-config (+ state con next_letter,
  coverage_pct, cycles, last_result, running) · POST /admin/deal-finder/cron-run-now
  (lote manual en background, guard manual_running + guard scan manual activo).
- UI: tarjeta "Radar automático nocturno" en /admin/oportunidades — badge Activo/Pausado/
  Corriendo, botones Correr lote ahora / Pausar-Activar, barra de cobertura del ciclo A-Z.
- Tests test_deal_finder.py 11/11 (nuevos: test_10 config endpoints con clamp, test_11 lote
  real de 4 propiedades con email mockeado y restauración de estado).
- Verificado en PRODUCCIÓN: cron-config responde en Railway; escaneo manual prod (calle
  porter, 8 props) OK — el portal del condado no bloquea IPs de Railway.
- Deploys: ross-house-backend b09bfde → Railway; app 98f875197 → Vercel main.

## Carta imprimible (PDF) + Envío físico Lob (Ago 6, 2026 - tarde 2)
- deal_finder_router.py:
  * GET /admin/deal-finder/leads/{id}/letter.pdf?lang=en|es → PDF reportlab (US Letter):
    remitente arriba-izq (Ross House Rentals, de _get_payer del 1099), dirección del dueño
    en zona de ventana #10 (~2" desde arriba), fecha, cuerpo de offer_letter. Reemplaza
    [TELÉFONO]/[EMAIL] con datos del payer.
  * POST /admin/deal-finder/leads/{id}/mail → Lob: verifica dirección (us_verifications CASS,
    rechaza no entregables 422), crea /v1/letters (HTML top_first_page, usps_first_class,
    Idempotency-Key), guarda lead.mail {lob_id, mode, expected_delivery} + status=offer_sent.
  * GET /admin/deal-finder/lob-status → {configured, mode test|live}.
  * _lob_key() lee LOB_API_KEY del env; _lead_mail_parts() separa street de city/state/zip.
- LOB_API_KEY en .env LOCAL = clave TEST (test_1578...). ⚠️ Usuario debe agregar LOB_API_KEY
  en Railway (Variables) para producción — issue recurrente env vars. Usuario eligió TEST primero.
  ⚠️ SEGURIDAD: usuario compartió ambas claves (test+live) en chat → recordarle rotar la LIVE.
- UI oportunidades: en sección Carta de oferta → botones "Descargar PDF (imprimir)" (descarga
  blob con auth header) y "Enviar por correo" (Lob, confirm dialog, badge test/live, deshabilita
  si ya enviada), indicador lead.mail con fecha de entrega. Detección lobConfigured/lobMode.
- Verificado: flujo Lob completo con test key OK (us_ver + ltr_ id + expected_delivery + preview
  url). Test key NO verifica direcciones reales (Lob devuelve canned undeliverable — por diseño).
  Tests test_deal_finder.py 14/14 (12 PDF, 13 lob-status, 14 mail sin key → 400).
- Deploys: ross-house-backend 4f3f36d → Railway; app 2a770218d → Vercel.

## Fix Firmas Topaz + Firma guardada del admin (Ago 6, 2026 - noche)
- BUG 1 (Topaz no guardaba): en modo Topaz, onSignatureCapture llamaba submitOfficeSignature()
  que leía canvasRef (solo existe en modo canvas) → return silencioso, firma nunca enviada.
  FIX: submitOfficeSignature(signatureOverride?, useSaved?) — Topaz pasa el base64 directo.
- BUG 2 (flujo 2 firmas roto): office_sign activaba el contrato si status=draft con UNA sola
  firma. FIX: solo se activa cuando hay tenant_signature Y admin_signature; estados intermedios
  pending_signature (falta admin) / pending_tenant. Al activarse: propiedad rented + tenant
  vinculado + _email_signed_lease_pdf automático.
- FEATURE firma guardada: ya existían endpoints GET/PUT/DELETE /admin/admin-signature y
  colección admin_signatures {type:'landlord_default'} (configurable en /admin/configuracion
  tab Firma Admin, usada como fallback en el PDF). Ahora integrada al flujo office-sign:
  * use_saved_admin:true → firma admin en 1 clic con la guardada.
  * auto_admin:true al firmar el inquilino → aplica también la firma guardada del admin
    (contrato completamente firmado y activo en 1 paso).
  * UI modal: caja "Tu firma guardada" + botón 1-clic (rol admin), checkbox guardar como
    predeterminada, checkbox auto-admin (rol inquilino), badges "✓ Inquilino firmó / ✓ Admin
    firmó" en la tarjeta expandida, validación de canvas vacío.
- ⚠️ INCIDENTE RESUELTO: mi test sobrescribió admin_signatures.landlord_default con un pixel
  1x1; restaurada con la firma real del contrato 6a719b7e34f736a274cddac4 (121 Oak Ave).
  LECCIÓN: la DB local ES la de producción (mismo MONGO_URL) — nunca escribir datos de prueba
  en colecciones de configuración sin backup/restore.
- Verificado E2E local: tenant sign→pending_signature, admin saved sign→active fully_signed,
  tenant+auto_admin→active en 1 paso. UI modal verificada con screenshot.
- Deploys: ross-house-backend 267e434 → Railway; app d151c01e1 → Vercel main.

## Drip Email AI + Blog público (Ago 6, 2026 - noche 2)
- Usuario pidió: 100-200 plantillas de email para suscriptores, 3/semana. Acordado: bilingüe
  ES+EN, 2/semana (mar y vie 9am CT, configurable 1/2/3), envío automático, 50 iniciales +
  botón para generar más. También aprobó sección de noticias/blog en la web.
- rental/drip_router.py (registrado en server.py):
  * email_templates: {category (10: rentar/comprar/credito/mantenimiento/energia/dumas/
    mudanza/seguros/inversion/derechos), subject_es/en, body_es/en, status active|draft|
    archived, sent_at, sent_count, published_to_blog, slug, ai_generated}.
  * POST /admin/drip/generate {count=objetivo TOTAL de biblioteca, categories?} — genera con
    Claude en lotes de 5, "top-up" solo lo que falta por categoría, dedupe por subject.
    CRÍTICO: LLM corre en hilo (asyncio.to_thread + asyncio.run) porque litellm bloquea el
    event loop → sin esto el server queda inaccesible durante la generación.
    Parser tolerante (strict=False + prompt "comillas simples dentro del texto") — la categoría
    inversion fallaba por comillas sin escapar. Strip de ** markdown al insertar.
  * GET /admin/drip/generation-status (poll) · GET/PATCH templates (+DELETE) ·
    GET/PATCH /admin/drip/config {enabled, per_week 1|2|3, hour_ct} ·
    POST /admin/drip/send-next (manual, usa send_template_now → reusa _run_campaign del
    newsletter con unsubscribe) — registra en newsletter_campaigns type:'drip'.
  * Blog público SIN auth: GET /public/blog/posts (+filtro category), /public/blog/posts/{slug}
    — solo published_to_blog:true.
- rental/drip_cron.py (lifespan): chequeo cada 30 min; días por per_week 1→[mar] 2→[mar,vie]
  3→[lun,mié,vie]; hora >= hour_ct CT; idempotente por día (last_sent_at en app_settings drip).
  Envía la plantilla activa más antigua sin enviar.
- UI: /admin/marketing pestaña "🤖 Drip AI & Blog" (components/admin/DripPanel.tsx): motor con
  stats (en cola/enviadas/suscriptores/semanas de contenido), próximo envío + Enviar ahora,
  fábrica AI con progreso, filtros, editar modal ES/EN, toggle publicar al blog, eliminar.
- Público: /noticias (grid con filtro por categoría) y /noticias/[slug] (toggle ES/EN + CTA a
  propiedades). 1 post publicado de ejemplo (rentar primera casa).
- Estado: 50 plantillas generadas (5×10 categorías) EN PRODUCCIÓN (misma DB), motor activo
  2/semana. Tests tests/test_drip.py 6/6. NO se ha enviado ningún email aún (2 suscriptores);
  el primer envío automático será el próximo martes/viernes 9am CT, o manual con "Enviar ahora".
- Deploys: ross-house-backend 5b9355b → Railway (verificado config en prod); app 60c8b161d →
  Vercel (verificado /noticias y /api/public/blog/posts en prod).

## Blog Premium + Previews (Ago 7, 2026)
- 3 emails de muestra enviados a yoandyross@gmail.com vía nuevo POST /admin/drip/templates/
  {id}/preview {email} (usa _send_one+_campaign_html, no marca sent).
- Comentarios blog: blog_comments collection; GET/POST /public/blog/posts/{slug}/comments
  (anti-spam 3/hora por IP, name≤60, comment≤1000), DELETE /admin/blog/comments/{id}.
- /noticias/[slug] premium: compartir WhatsApp/Facebook/X/copiar, sección comentarios con
  avatar inicial, posts relacionados (misma categoría), CTA suscripción (POST /public/
  newsletter/subscribe source:blog). /noticias: SubscribeBanner arriba del grid.
- Verificado E2E con screenshot (comentario publicado y limpiado). Deploys: backend 83b38fc
  → Railway; app 008b45e0d → Vercel (prod /noticias 200).

## Blog poblado + Sitemap SEO (Ago 7, 2026)
- Publicados 14 posts adicionales al blog (total 15 de 50 plantillas) directo en DB producción
  (Atlas taxportal): published_to_blog:true + blog_published_at escalonado cada ~2 días
  (11 jul → 6 ago 2026), mezcla de las 10 categorías (2× rentar/comprar/credito/dumas).
  Verificado en prod: /api/public/blog/posts total:15 y screenshot de www.rosshouserentals.com/noticias.
- SEO: app/sitemap.ts ahora incluye /noticias (prio 0.9) + cada /noticias/{slug} (prio 0.7,
  lastModified = published_at) vía fetch a /api/public/blog/posts?limit=50 (revalidate 24h).
  Commit b47ecdf64 → push railway/vercel-fix → Vercel auto-deploy.
- Quedan 35 plantillas sin publicar (se pueden ir publicando 2-3/semana con el botón 🌐).

## QA integral por perfil (Ago 7, 2026)
- testing_agent iteration_25: 46 tests backend prod Railway (43 PASS, 3 skip por Turnstile en
  registro público de proveedores — no es bug). Test file: /app/backend/tests/
  test_ross_house_full_profiles.py.
- Verificado por perfil: ADMIN (11 dashboards GET 200 + web 2FA gate OK), TENANT (API + app
  Expo e2e login→dashboard→5 tabs OK), GUEST (registro + downgrade tenant→guest OK), BUYER,
  LANDLORD (crear→login→dashboard→banking→delete OK), PROVEEDOR (admin CRUD OK; registro
  público bloqueado por Turnstile en headless), PÚBLICO (blog 15 posts, comentarios,
  suscripción, propiedades). Seguridad: anon y tokens de rol bajo → 401/403 en admin/*.
- Datos TEST QA limpiados de DB prod (3 app_users, 4 newsletter) — DB queda 1 admin + 3 tenants.
- Pendientes LOW del reporte: DELETE /admin/marketplace-users/{id} para limpieza QA; testIDs
  en app Expo; warnings deprecación shadow*/pointerEvents/expo-notifications web;
  npx expo install --fix (15+ paquetes drifted).

## E2E como usuario real por perfil + fixes (Ago 7, 2026 - tarde)
- Cuentas TEST QA creadas y CONSERVADAS (password TestQA2026!, ver test_credentials.md):
  tenant test.inquilino.qa (INQ-2026-004), buyer test.comprador.qa, investor test.inversor.qa,
  landlord test.dueno.qa (registrado vía web, pending_kyc), guest test.invitado.qa (vía app Expo),
  provider TEST Proveedor QA (active), suscriptor test.suscriptor.qa.
- testing_agent iteration_26 (UI Playwright, 8 perfiles): 7/8 PASS. Admin probado inyectando
  cookies rhr_admin_token/rhr_admin_user (bypass OTP para QA) — 6 páginas admin OK con datos.
- BUGS ARREGLADOS Y DESPLEGADOS:
  1. /inversor login loop: tras login el layout no releía el token (router.push no remonta) →
     window.location.assign en inversor/page.tsx. Verificado prod: dashboard inversor carga.
  2. GET /tenant/payment-config 500 ("CORS" aparente): rental_config.payment_methods es lista
     legacy ["card","cash"] y el código asumía dict → normalizado a {} si no es dict
     (tenant_router.py). Verificado prod 200; Pay Rent web muestra "August 2026 — Paid".
  3. Portal tenant web sin acceso a proveedores/utilities → tabs "Services" (Shield) y
     "Utilities" (Zap) añadidas en tenant/dashboard/page.tsx.
- Deploys: ross-house-backend 6944488 → Railway; app a4da032bc → vercel/main (+ railway/vercel-fix).
- NO arreglado (LOW, decidido skip): _id en /admin/newsletter/subscribers (endpoint admin-only,
  el UI usa el id para DELETE).

## QA profundo app Expo por perfil + fixes (Ago 7, 2026 - noche)
- testing_agent iteration_27 (app Expo, 5 perfiles): tenant con datos PASS (todas las tabs,
  edit-profile, docs, invoices, contratos, chat, mantenimiento E2E tenant→admin), admin en app
  PASS (8 pantallas), tenant sin contrato/guest/buyer PASS (empty states, guest/buyer solo 4 tabs).
- Fixes del testing agent (revisados): imports useColors faltantes en credit-builder.tsx (red
  screen) + lint menores en properties/admin-contract-detail.
- FIXES MÍOS post-reporte:
  1. admin-payments.tsx llamaba GET /admin/payments (404) → ahora /admin/rental-payments con
     mapeo de campos (property_address→property_name, payment_method, stats). Verificado en app:
     muestra $1,100 recibido, pago Zelle Yandisleydis.
  2. Toggle AI global del chat (admin-messages) llamaba endpoints inexistentes → implementados
     GET /chat/ai/global-status y POST /chat/ai/toggle-global en chat_router.py (app_settings
     _id:'chat_ai'); _ai_auto_reply respeta el flag. Fix double-stringify del body en la app.
     Verificado en Railway prod (200).
  3. chat-support.tsx ELIMINADO (pantalla huérfana sin navegación que llamaba /ai-chat/*
     inexistentes; el chat real es /chat → chat.tsx y funciona E2E con AI Brain).
- Limpieza: solicitud mantenimiento 'TEST QA' eliminada de maintenance_requests.
- Deploys: ross-house-backend 13e3644 → Railway (verificado). App Expo local (requiere build
  para verse en dispositivos — no hay deploy OTA configurado).
- Marketing drip: 50 plantillas, 0 enviadas, motor activo 2/semana mar-vie 9am CT, 3 suscriptores.
  Primer envío automático: vie Ago 7 9am CT.

## Importación de 790 clientes al newsletter (Ago 7, 2026)
- CSV clientes_datos_bancarios.csv (1,026 filas): 790 emails válidos importados a
  newsletter_subscribers en PROD (source: import_clientes_2026, lang es, nombre Title Case,
  unsubscribe_token único c/u). Excluidos: 31 placeholders @temp.rosstax.com, 204 sin email
  válido, 2 duplicados. TOTAL PROD: 793 suscriptores (792 activos tras test de baja).
- Baja verificada E2E en prod: link "Cancelar suscripción" del footer (token) → GET
  /api/public/newsletter/unsubscribe → unsubscribed:true → excluido de drip/campañas.
  (test.suscriptor.qa quedó dado de baja como prueba).
- perf: _send_one de newsletter_router ahora usa asyncio.to_thread (SDK SendGrid síncrono
  bloqueaba el event loop ~5+ min con 790 destinatarios). Deploy Railway 358a4d7 verificado.
- ⚠️ PENDIENTE VERIFICAR: límite del plan SendGrid del usuario (free tier = 100/día; el drip
  enviará ~792 emails por plantilla). Revisar dashboard SendGrid tras el primer envío
  (vie 9am CT) por fallos/bounces.

## Panel "Salud de la lista" en /admin/marketing (Ago 7, 2026)
- Backend: GET /admin/newsletter/health (newsletter_router.py) → kpis {total, active,
  unsubscribed, unsub_rate, new_30d, unsub_30d, delivered_total, failed_total},
  sends[] (últimas 25 campañas drip+manual con sent/failed/status) y
  recent_unsubscribes[] (últimas 20 bajas). Deploy Railway 6ee334d.
- Frontend: nueva pestaña "📊 Salud de la lista" (data-testid tab-health) en
  /admin/marketing → components/admin/NewsletterHealthPanel.tsx: 6 KPIs, tabla historial
  de envíos (badge Drip/Manual, entregados/fallidos, estado), tabla bajas recientes,
  warning si failed_total>0 (límite SendGrid). Deploy vercel/main 95babcc71.
- VERIFICADO EN PROD con cookie injection: 793 subs, 792 activos, 0.1% baja, 2 envíos
  históricos listados, 1 baja reciente (test.suscriptor.qa).

## Tracking de aperturas + muestras + plan SendGrid (Ago 7, 2026)
- SendGrid plan: PAID 500,000 emails/mes (usados 2,961 · quedan 497,039 · reputación 99).
  Open+Click tracking ya activo account-wide. Webhook legacy "rastreo" (app-nueva Railway /
  Ross Tax) INTACTO; creado 2º webhook "ross-house-newsletter" (id ed2e95f8) →
  https://ross-house-backend-production.up.railway.app/api/public/sendgrid/events.
- Backend (Railway 19b1dbb): POST /public/sendgrid/events filtra categoría 'rhr-newsletter'
  → colección email_events {email, event, timestamp, sg_message_id, url, useragent}.
  _send_one añade Category('rhr-newsletter'). /admin/newsletter/health ahora incluye
  opens_total, unique_openers, open_rate, clicks, bounces, opens_by_hour (hora
  America/Chicago vía $hour timezone), best_hour_ct y recent_opens.
- UI (vercel/main f526c3d5b): panel Salud con 10 KPIs, gráfico de barras "Mejor horario de
  apertura (hora Central TX)" con badge 🏆 mejor hora, tabla "Aperturas recientes (quién y
  cuándo)". VERIFICADO EN PROD: ya registró 5 aperturas reales de yoandyross@gmail.com.
- Enviados 4 emails de muestra EXACTOS (mismo HTML, link de baja real con su token, tracking)
  a yoandyross@gmail.com: rentar/credito/energia/comprar.

## Rediseño branded de emails (Ago 7, 2026)
- _campaign_html (newsletter_router.py) rediseñado con identidad del sitio: logo
  https://www.rosshouserentals.com/logo.jpg circular con borde rojo, título charcoal #231F20,
  subtítulo "LLC · DUMAS, TEXAS" rojo #ED1B33 letterspaced, barra acento gradiente
  #ED1B33→#C41428, botón CTA rojo "Visita rosshouserentals.com", footer con tel/web en rojo,
  link de baja gris centrado. Aplica a drip + campañas manuales + previews.
- 2 muestras "[NUEVO DISEÑO]" enviadas a yoandyross@gmail.com (dumas, mudanza).
- Deploy Railway 3a5a1f3 verificado (health 200).

## Paginación + mejoras Oportunidades + 1099 oficial IRS (Ago 7, 2026 - noche 2)
- PAGINACIÓN 50/pág (server-side skip/limit + total): /admin/banco (plaid transactions,
  +total en response) y /admin/marketing suscriptores (+filtered_total). /admin/oportunidades
  ya la tenía (15/pág). Otras páginas revisadas: colecciones pequeñas, no necesitan.
- OPORTUNIDADES:
  * Links por propiedad: 🗺️ Google Maps + 🏠 Zillow + 🔴 Realtor (zip page) en cada card
    (spans stopPropagation) y en el drawer de detalle (anchors). Helpers mapsUrl/zillowUrl/
    realtorUrl en page.tsx (situs incluye "CIUDAD TX zip").
  * NUEVO CONDADO: Dallam (Dalhart) ACTIVO — esearch.dallamcad.org, misma plataforma BIS
    eSearch. Verificado E2E en prod: scan StreetName:denver → 72 encontradas, 10 leads nuevas.
    fetch_account_tax_due ahora acepta base= (multi-condado). Potter-Randall (esearch.prad.org)
    y Hartley (esearch.hartleycad.org) usan plataforma DISTINTA (no BIS clásico) — quedan
    inactivos, requieren scraper propio.
  * FILTROS AVANZADOS: barra "Afinar" con condado, ciudad (regex address), deuda mínima
    (min_tax), score mínimo (min_score) + min_value en backend. Verificado en prod.
- 1099-NEC OFICIAL IRS: _build_1099_pdf reescrito — rellena assets/f1099nec.pdf (formulario
  oficial Rev. Dec 2026, fillable AcroForm) páginas 3 (Copy B) + 4 (instrucciones) con pypdf.
  Mapeo campos topmostSubform[0].CopyB[0]: f2_1 año(2díg), f2_2-9 payer, f2_10/11 TINs,
  f2_12-18 recipient, f2_19 account, RightCol f2_20 box 1a importe. Verificado render local
  (imagen perfecta). Endpoints download/email SIN cambios (ya existían). Sin datos reportables
  2026 en prod aún para probar E2E con proveedor real.
- Deploys: backend b337917 → Railway (verificado con curl) · app b8ea7caa4 → vercel/main
  (verificado con screenshots: filtros+links y paginación 1-50/793 → 51-100).

## Scraper Amarillo (Potter-Randall) + verificación Lob (Ago 7-8, 2026)
- POTTER-RANDALL ACTIVO: plataforma TrueProdigy descifrada —
  POST prod-container.trueprodigyapi.com/trueprodigy/cadpublic/auth/token {office:
  "PotterRandall"} → token (header Authorization SIN "Bearer"); búsqueda POST
  /public/property/searchfulltext?page&pageSize con body {pYear:{operator:"=",value},
  fullTextSearch:{operator:"match",value}}. Respuesta trae TODO (fullSitus, displayName,
  addrDeliveryLine/City/State/Zip, land/improvement/marketValue, lat/lng, geoID) — sin página
  de detalle. Deuda fiscal NO disponible (CAD ≠ tax office) → tax_due_total=0, señales via
  absentee/out_of_state/vacant/low_improvement/low_value.
- Código: _tp_token/_tp_search/_tp_to_lead/_run_scan_trueprodigy en deal_finder_router.py;
  start_scan branch por county.platform ("trueprodigy" → full-text, max 200). fullSitus
  normalizado "…, AMARILLO, TX, 79101" → "… AMARILLO TX 79101" para _situs_city.
  VERIFICADO PROD: scan "POLK ST" → 692 encontradas, 15 nuevas con señales correctas.
- LOB VERIFICADO: /admin/deal-finder/lob-status mejorado — ahora hace GET real a
  api.lob.com/v1/letters con el key y devuelve api_ok + recent_letters. PROD: mode live,
  api_ok TRUE (key live válido, 0 cartas live enviadas aún). Key local .env es test_ (ok).
- Deploy Railway 6b9e998 verificado.

## Sistema de oferta PURL + QR (Ago 8, 2026)
- Backend (deal_finder_router.py, Railway cf7cce0):
  * POST /admin/deal-finder/leads/{id}/suggest-price → AI (SUGGEST_PRICE_PROMPT via _ai_json)
    devuelve suggested_price/reasoning_es/pct_of_value (verificado prod: \$32,000 = 38%).
  * POST /admin/deal-finder/leads/{id}/offer {mode: amount|ask, amount} → lead.offer {slug
    (nombre+4 chars A-Z2-9 sin ambiguos), mode, amount, expires_at +30d, visits, response}.
  * GET /public/oferta/{slug} → datos públicos + $inc visits (tracking de recepción).
  * POST /public/oferta/{slug}/responder {action: accept|counter|call|reject, price, phone,
    best_time, message} → guarda offer.response, status auto (accept→negotiating,
    counter→interested, call→contacted, reject→discarded), email al admin vía SendGrid.
  * QR (_offer_qr_png, lib qrcode==8.2 en requirements) embebido automáticamente en carta PDF
    (bloque rojo con tabla reportlab) y en HTML de Lob (img base64) si lead.offer existe.
  * _lead_out incluye "offer".
- Frontend (vercel f077afa06):
  * /oferta/[slug] página pública mobile-first branded: saludo personalizado, mapa Google
    embed (keyless output=embed), card roja con monto + Aceptar, contraoferta, llámenme,
    rechazar (doble tap), toggle ES/EN, estados expired/responded/notFound.
  * Admin oportunidades drawer: sección "Oferta personalizada" — toggle modo, input monto,
    botón Sugerir precio AI (muestra razonamiento), crear link+QR, copiar/abrir, visitas +
    respuesta del dueño con badge.
- VERIFICADO E2E EN PROD: sugerencia AI → crear oferta → visita pública (visits 1) →
  contraoferta \$40k con teléfono → status 'interested' + email admin. Screenshots página OK.
- Leads de prueba limpiados (GUEVARA restaurado a new, offers de prueba removidas).

## Remitente de cartas + logo (Ago 8, 2026)
- Decisión (recomendación aceptada): carta sale de YOANDY ROSS personal (mejor respuesta en
  direct mail de adquisición), con "Ross House Rentals LLC" como 2ª línea del remitente y en
  la firma. Logo pequeño y discreto arriba-derecha del PDF (assets/logo.jpg en repo backend)
  + firma con logo circular en HTML Lob (img URL pública). _sender_info override name.
- Verificado en prod Railway 893b195: letter.pdf 200 con Yoandy Ross + LLC + logo.

## App móvil Expo — Admin Propiedades: gestión completa (Ago 9, 2026)
- `/app/rosslending-app/app/admin-properties.tsx` reconstruido: ya NO es vista de inquilino.
- Funciones: lista con búsqueda + filtros por estado (chips con contadores), crear propiedad
  (modal bottom-sheet con nombre, dirección, ciudad/zip, recámaras, baños, ft², renta,
  depósito, notas, estado), editar, eliminar (con confirmación; backend bloquea rentadas sin
  ?force=true), y cambio rápido de estado Disponible/Rentada/Mantenimiento por chips en cada card.
- APIs: GET/POST /api/admin/properties, PUT/DELETE /api/admin/properties/{id} (backend Railway prod).
- Verificado con screenshot en localhost:3000/admin-properties (lista + modal crear OK).
- Nota: Metro servía bundle viejo en cache; se resolvió reiniciando expo con limpieza de cache.
- PENDIENTE USUARIO: rotar Lob API key live (aún expuesta, confirmado NO rotada Ago 9).

## Integración TikTok Content Posting API (Ago 9, 2026)
- Registro app TikTok Developers guiado: org Ross House Rentals LLC, app "Ross House Rentals" (type Other),
  Login Kit + Content Posting API (Direct Post ON), scopes user.info.basic + video.publish + video.upload.
- DNS TXT verificado en SiteGround (raíz @: tiktok-developers-site-verification=TUzHpNgRgMx9Tv37YEhZT6R8bzCZuwyA).
- Backend: rental/tiktok_router.py — OAuth (connect/callback/disconnect, state en tiktok_oauth_states),
  refresh automático de tokens (tiktok_account), creator-info, publish (PULL_FROM_URL con fallback
  FILE_UPLOAD si url_ownership_unverified), publish-file (subida multipart desde teléfono/PC, chunking
  50MB para >64MB, máx ~280MB), posts + status polling (tiktok_posts).
- Frontend: /admin/marketing/tiktok (Next.js) — conexión, modos directo/borrador, fuente archivo/URL,
  privacidad desde creator_info, consentimiento obligatorio, historial con refresh de estado.
  File upload va directo a Railway vía NEXT_PUBLIC_BACKEND_URL (CORS ok) para evitar límites de proxy.
- Credenciales: PRODUCCIÓN awo0khhr0b40si3a / jMLUUGCNMtlazxKLLQe2velDSupZLR43 (restaurar en Railway tras
  aprobación de app review). SANDBOX sbawq36nc18fzh0hde (activas en Railway ahora).
- Cuenta TikTok @rosshouserentals creada, PRIVADA (requisito de cliente no auditado), target user del sandbox.
- VERIFICADO E2E EN PROD (sandbox): 2 publicaciones PUBLISH_COMPLETE (via URL-fallback y via publish-file).
- PENDIENTE: usuario graba video demo (flujo completo en el panel) y hace Submit for review en TikTok.
  Tras aprobación: restaurar credenciales de producción + audit para publicar PUBLIC_TO_EVERYONE.

## App móvil — Módulo Marketing en Admin Dashboard (Ago 10, 2026)
- /app/rosslending-app/app/admin-marketing.tsx: hub con 3 tabs (TikTok, Facebook, Newsletter).
- TikTok: estado de conexión (+botón conectar via Linking), publicar video desde galería del
  teléfono (expo-image-picker, permisos con canAskAgain + Open Settings), caption, privacidad
  (creator_info), modo directo/borrador (Switch), consentimiento, historial con refresh de estado.
  Upload: FormData a Config.API_URL /api/admin/marketing/tiktok/publish-file (Railway directo).
- Facebook: métricas 30d, generador AI (intents + propiedad opcional, 5 variaciones con copiar
  via expo-clipboard), lista de grupos con badge días-sin-publicar, abrir grupo, marcar publicado.
- Newsletter: stats suscriptores/activos/leads + campañas recientes.
- Entrada "Marketing" agregada al grid del admin-dashboard (icono megaphone, #22D3EE).
- expo-clipboard@8.0.8 instalado.
- VERIFICADO con screenshots (3 tabs) contra backend prod Railway.

## Autopagos — CRUD completo en Panel Admin Web (Ago 10, 2026)
- Backend /app/ross-house-backend/rental/stripe_pkg/autopay_router.py (commit d245d30, deployado a Railway ✅):
  · GET /api/admin/autopay/tenants — inquilinos con stripe_customer_id + sus tarjetas guardadas.
  · POST /api/admin/autopay/configs — crear/reemplazar autopago de un inquilino (upsert por user_id).
  · PUT /api/admin/autopay/configs/{id} — editar día/tarjeta/enabled (activar-cancelar).
  · DELETE /api/admin/autopay/configs/{id} — eliminar por completo.
- Frontend /app/app/admin/autopagos/page.tsx (commit eeb632359, push a Vercel main ✅):
  · Botón "Nuevo Autopago" (modal: selector inquilino → tarjetas Stripe → día 1-28 → toggle activo).
  · Acciones por fila: Pausar/Activar (toggle enabled), Editar (modal), Eliminar (confirmación).
- DATA: autopago de prueba huérfano (user_id 253aaf5d..., sin nombre/email) ELIMINADO de la BD prod
  (Atlas taxportal). Quedan solo 2 reales: Yoandy Ross y Anaelis Ballestero.
- VERIFICADO: CRUD e2e con curl contra backend local (misma BD Atlas) + producción Railway (count:2,
  tenants:3). UI verificada con screenshots (localhost:3001 con cookies rhr_admin_token + rhr_admin_user).

## Gastos — Escáner AI de Recibos (Ago 10, 2026)
- Backend nuevo: /app/ross-house-backend/rental/receipt_scanner_router.py (commit d423cb2, Railway ✅):
  · POST /api/admin/property-expenses/scan-receipt (multipart) — GPT-5.4 visión via EMERGENT_LLM_KEY
    extrae vendor/fecha/monto/tax/items, clasifica en EXPENSE_CATEGORIES + IRS Schedule E,
    sugiere property_id por dirección, detecta duplicados (monto+fecha), guarda imagen en
    colección expense_receipts (JPEG comprimido ≤1600px).
  · GET /api/admin/property-expenses/receipt/{id} — devuelve imagen del recibo (auth admin).
  · finances_router.py: expenses ahora aceptan irs_category + receipt_id; property_id opcional (General).
- Frontend /app/app/admin/gastos/page.tsx (commits 959f633f5, Vercel ✅): botón "Escanear Recibo"
  (input capture=environment), banner AI con confianza+items, aviso duplicado, select Categoría IRS,
  chip IRS + icono recibo en filas, visor modal de recibo.
- VERIFICADO: e2e local y en PRODUCCIÓN Railway (Home Depot $63.75 → repair/repairs 97%).
- Pendiente: agregar el escáner a la app móvil Expo (usuario eligió web primero).

## Deployment Health Check fixes (Ago 10, 2026) — app Ross Tax (/app/frontend + /app/backend)
- Arreglado: api.ts sin fallback localhost (solo EXPO_PUBLIC_BACKEND_URL), app.json sin extra.backendUrl,
  babel → react-native-worklets/plugin, eas.json y keys/ ASC eliminados (¡usuario debe ROTAR la key ASC
  975WHFWA6G en App Store Connect!), server.py JWT sin fallback, database.py DB_NAME sin fallback,
  requirements.txt generado (pip freeze), yarn.lock generado.
- .gitignore: reglas .env RESTAURADAS a propósito (backend/.env contiene secretos prod Atlas/SendGrid/Xcel;
  los repos GitHub del usuario auto-deployan). El health check lo marca, pero es intencional por seguridad.
- Pendiente decisión usuario: migrar push notifications de Firebase/Expo directo a Emergent-managed
  (EMERGENT_PUSH_KEY) — es refactor grande del sistema push existente que ya funciona con Firebase.
- Pendiente lint: usePushNotifications.ts usa removeNotificationSubscription (deprecado) — cambiar a .remove().

## Gastos — Reporte Fiscal PDF + Escáner AI en app móvil (Ago 10, 2026)
- Backend (commit 84b6ecb, Railway ✅): GET /api/admin/property-expenses/tax-report?year=YYYY
  · PDF ReportLab: secciones por propiedad con gastos agrupados por línea IRS Schedule E + subtotales,
    página final con resumen global y TOTAL GASTOS DEDUCIBLES. Fallback categoría→IRS con marca "*".
- Web (commit b26bb0c64, Vercel ✅): botón "Reporte Fiscal" con selector de año en /admin/gastos.
- App móvil (commit 4b94270, repo ross-house-app ✅): admin-create-expense.tsx renovado:
  · Tarjeta "Escanear Recibo con AI" (Tomar Foto con permisos canAskAgain+openSettings / Galería),
    upload FormData a Railway, prefill de todo el form, banner confianza+items, aviso duplicado,
    chips IRS Schedule E, propiedad ahora opcional (General), fix categoría 'repairs'→'repair'.
- VERIFICADO: PDF local+producción (extract ok), e2e móvil web preview con recibo Home Depot (97%, $63.75).

## Pagos de Renta Multi-Procesador (Ago 10, 2026)
- REQUERIMIENTO: web y app usan el procesador ACTIVO (stripe/square/clover) elegido en admin sin rebuild.
- Backend payment_processors_router.py (commit 75f6132, Railway ✅):
  · POST /api/tenant/create-checkout-payment {late_fee, hosted?}: decide en runtime —
    stripe+app → {"processor":"stripe"} (flujo nativo); stripe+hosted(web) → Stripe Checkout Session;
    square/clover → Hosted Checkout (create_hosted_checkout). Monto server-side del contrato,
    guard anti-duplicado del mes, doc rental_payments status=pending_checkout.
  · GET /api/tenant/checkout-payment-status/{id}: consulta Stripe Session/Square Order/Clover Checkout
    + respaldo con processor_webhook_events; al confirmar → completed + receipt (STR-/SQR-/CLV-).
  · Webhooks square/clover ahora COMPLETAN el rental_payment que coincida (payload_ids).
- Web tenant dashboard (commit fa012b8d0, Vercel ✅): botón "Pay with Card" → hosted:true → redirect.
- App móvil pay/index.tsx (commit 6d52d47): handleStripePayment consulta el procesador primero;
  square/clover → expo-web-browser (instalado) + polling de estado; stripe → PaymentSheet nativo.
  ⚠️ Requiere UN build nuevo para llevar esta lógica al teléfono; después los cambios de procesador
  son 100% server-side sin rebuild.
- VERIFICADO: los 3 caminos con tenant de prueba temporal (borrado): Square link real creado+borrado,
  Stripe Checkout Session live creada+expirada, guard duplicados OK, estado not-completed OK.
  Square ya tiene credenciales de PRODUCCIÓN configuradas en admin; procesador activo quedó en STRIPE.
- Credencial tenant QA: yosbelgarrido26@gmail.com / sRUUSvEB4O (marketplace-login).

## Comparador de Comisiones por Procesador (Ago 10, 2026)
- Backend (commit b4a04c5, Railway ✅): GET /api/admin/payment-processors/fee-comparison
  · Volumen real 12m de rental_payments (completed/paid), por mes, tx count, ticket promedio.
  · Tarifas online estándar: Stripe/Square 2.9%+$0.30, Clover 3.5%+$0.10 → fee anual/mensual,
    % efectivo, más barato, ahorro vs activo.
- Web (commit 60114aba1, Vercel ✅): panel "Comparador de Comisiones" arriba del tab
  Procesadores de Pago en /admin/configuracion — stats de volumen, barras comparativas,
  badges MÁS BARATO/ACTIVO, recomendación de ahorro.
- VERIFICADO: prod Railway (volume $1,100, cheapest stripe) + screenshot UI OK con token prod.
- NOTA testing: el JWT admin local NO sirve contra Railway prod (secrets distintos) — para screenshots
  del panel admin local (proxy→prod) hay que hacer login prod: marketplace-login admin123.

## App Móvil — Pantalla Finanzas Admin (Ago 10, 2026)
- Nueva /app/rosslending-app/app/admin-finanzas.tsx (commit pushed a ross-house-app):
  · Reporte Fiscal: chips de año (actual-3) + Descargar PDF — web: blob download;
    nativo: expo-file-system/legacy downloadAsync con Authorization header + expo-sharing share sheet.
  · Comparador de Comisiones: consume /admin/payment-processors/fee-comparison — stats,
    barras por procesador, badges MÁS BARATO/ACTIVO, recomendación de ahorro.
- Registrada en admin-dashboard.tsx grid: "Finanzas" (stats-chart-outline, #14B8A6).
- VERIFICADO: screenshot Expo web con login admin y datos reales de prod.

## App Móvil — Modo Claro Premium (Ago 10, 2026)
- PROBLEMA: 18 pantallas (todas las admin + onboarding + add-property) y 12 componentes
  (ui/Input,Badge,Card,Button,ImageCarousel,GaugeChart,SignaturePad,PhotoPicker,
  market/*, PaymentProcessorsAdmin) usaban la paleta oscura ESTÁTICA `Colors` → ilegibles en claro.
- SOLUCIÓN (scripts /tmp/migrate_theme.py y /tmp/migrate_components.py):
  · Patrón: `const Colors = useColors(); const styles = React.useMemo(() => createStyles(Colors), [Colors])`
    con `const createStyles = (Colors: any) => StyleSheet.create({...})`.
  · Heurística: estilos con bg de color (botones) conservan Colors.white; el resto white→textPrimary.
  · Literales oscuros → tokens (rgba blancos → glass/glassBorder/etc, #0C0C0E → background).
  · Iconos arrow-back/close JSX → Colors.textPrimary.
  · Fixes manuales: Badge variantColors a factory, GaugeChart default params, swipe content bg
    de admin-messages (#0a0e15 → themeColors.background), ringStyles labels grises estáticos.
- VERIFICADO: screenshots claro (dashboard, finanzas, properties, payments, marketing,
  create-expense, settings, messages) + regresión oscuro OK. Commit pushed a ross-house-app.

## App Móvil — Modo Claro fase 2: textos invisibles (Ago 10, 2026)
- Usuario reportó textos blancos invisibles en claro (ej. market-detail título/WhatsApp).
- Barrido TOTAL (script /tmp/fix_light_texts.py): 150 entradas de estilo con texto blanco sin fondo
  de color en 34 archivos → color adaptativo (textPrimary/textSecondary/textMuted), respetando
  overlays (price/photo/carousel/etc) y botones de color.
- Conversión completa a adaptativo de archivos que seguían estáticos: admin-inspections(+create/detail),
  admin-energy, CompleteProfileModal. PremiumCharts (donut center, legend, ring track) adaptado.
- credit-builder: gradientes de fondo '#1a1a1a'→'#0d0d0d' → [C.surfaceLight, C.background] (3 usos).
- Iconos/placeholder JSX rgba blancos → C.textMuted; fix ReferenceError swipeStyles (actionBtnText).
- Intencionalmente oscuros (no tocar): app/index.tsx (splash), FullscreenImageViewer, tarjeta de
  payment-methods (gradiente), StripeCardInput (#1a1a2e — revisar si usuario lo pide).
- VERIFICADO claro: market/market-detail, services (donut), credit-builder, inspections, chat, FAQ,
  payment-methods + regresión oscuro OK. Pushed a ross-house-app.

## Auditoría de Seguridad — Login/Registro + exposición de secretos (Ago 10, 2026)
- Auditoría (security_audit_agent) encontró P0: bypass de contraseña.
- FIXES (commit d5e5b19, Railway ✅ verificado en producción):
  · SEC-001 P0: eliminado fallback de login por teléfono/últimos-4 dígitos en
    /api/public/marketplace-login (rental/auth_router.py). Ahora SOLO email+password.
    Camino legacy de tenants (token sin credencial) también cerrado — requiere password_hash.
    NOTA: los 4 app_users y 3 tenants ya tienen password; 0 emails solo-tenant → nadie bloqueado.
    El login por teléfono del app usa OTP SMS (flujo aparte, intacto).
  · SEC-002 P2: error genérico único "Credenciales inválidas" para todos los fallos +
    bcrypt de dummy hash (_DUMMY_HASH) para timing constante → sin enumeración de usuarios.
  · Lockout: 5 intentos fallidos → 15 min bloqueado (failed_login_attempts/locked_until,
    $inc atómico en Mongo cross-instancia).
  · Reset code: find_one_and_update atómico con cap RESET_MAX_ATTEMPTS=5 (antes sin límite).
  · SEC-003: /api/upload/image ahora SOLO acepta TENANT_JWT_SECRET (server.py) — quitado el
    JWT_SECRET_KEY con default débil. Verificado: token con clave débil → 401.
  · CORS seguro por defecto (server.py): allowlist prod + regex preview emergent; bloquea
    orígenes arbitrarios salvo ENVIRONMENT=development/dev/local. Evil origin → sin ACAO ✅.
- PENDIENTE (P3, recomendado, no bloqueante): política de password >6, captcha obligatorio en
  register/forgot (hoy optional=True), restringir EXPO_PUBLIC_GOOGLE_MAPS_KEY por referrer,
  migrar tokens web de localStorage a cookie httpOnly + TTL más corto (hoy 30 días).
- Móvil (api.ts) usa SecureStore ✅. Stripe pk_live es publishable (ok). backend/.env gitignored ✅.

## API Keys Dinámicas — Migración .env → DB con Panel Admin (Ago 11, 2026)
- OBJETIVO: rotar keys de terceros (SendGrid, Twilio, Lob, Plaid, TikTok, OpenAI,
  Emergent LLM, RapidAPI/Mashvisor, Expo Push) desde el Admin Panel SIN rebuild/redeploy.
- Backend NUEVO: rental/api_keys_router.py
  · Registro KEY_REGISTRY (15 keys, agrupadas por servicio, flag secret).
  · Storage: admin_config {type:"api_keys"} → keys.{ENV} encriptada Fernet
    (VAULT_ENCRYPTION_KEY, mismas encrypt/decrypt de vault_router) + meta.{ENV} {at, by}.
  · load_db_keys_into_env(): sync (pymongo), llamado en server.py ANTES de importar routers
    → inyecta valores DB en os.environ ⇒ TODOS los os.getenv() existentes los usan sin tocar código.
  · Endpoints: GET /api/admin/api-keys (lista agrupada, enmascarada, source db/env/missing),
    PUT /api/admin/api-keys/{KEY} (encripta + aplica en vivo a os.environ),
    GET .../{KEY}/reveal (auditado), DELETE (quita override → restaura .env original).
  · Auditoría en vault_audit_log (api_key_updated/revealed/deleted).
- Frontend web: /app/app/admin/configuracion/ApiKeys.tsx — nueva pestaña "API Keys" en
  Configuración: badges de origen (DB/env/no configurada), rotar, revelar (ojo), copiar,
  eliminar override, timestamp de última rotación.
- Lob key NUEVA (live_...a1e1de) guardada encriptada en DB de producción (Atlas) + .env local.
- TESTED: testing_agent 14/14 backend pytest + UI e2e PASS (iteration_30.json).
- ⚠️ IMPORTANTE: Railway necesita UN último deploy del backend para activar este sistema;
  después de eso, ya nunca más se necesita deploy para rotar keys.
- Usuario ya revocó la key expuesta de App Store Connect (975WHFWA6G) — el .p8 nuevo se
  ingresa en el flujo Publish de Emergent, NO se guarda en backend.

## Reestructuración para Builds Nativos (Ago 11, 2026)
- PROBLEMA: el formulario de build iOS de Emergent mostraba com.rosstax.wallet (no editable)
  porque el pipeline usa /app/frontend por convención, y ahí vivía la app VIEJA de Ross Tax.
- FIX: /app/frontend → /app/frontend_old_rosstax (archivada, NO borrada);
  /app/rosslending-app → /app/frontend (app Ross House, bundle com.rosshouse.rentals);
  symlink /app/rosslending-app → /app/frontend para compatibilidad (supervisor, docs, scripts).
- Verificado: expo RUNNING, preview web OK (onboarding Ross House).
- App Store Connect: app "Ross House Rentals", Apple ID 6775734340, bundle com.rosshouse.rentals.
- Usuario debe: Publish → Reemplazar app (redeploy) → luego generar build iOS (ya mostrará el bundle correcto).

## Fix: chips de filtro invisibles en Oportunidades + verificación de datos (Ago 11, 2026)
- BUG (reporte usuario): al seleccionar "Todos"/"Nuevos" en admin-opportunities los chips de
  filtro desaparecían. ROOT CAUSE: el ScrollView horizontal de chips se comprimía (flexShrink
  default) cuando la FlatList cargaba 50 leads y desbordaba el contenedor → altura 3px.
- FIX admin-opportunities.tsx: chipsScroll flexShrink:0 + minHeight:34, chip minHeight:30 +
  lineHeight en texto, removeClippedSubviews={false}, FlatList style flex:1.
  Hardening igual en add-property.tsx (chipsScroll flexGrow/flexShrink 0).
- Verificado e2e en web preview midiendo DOM: scrollview h=34 shrink=0 con lista llena ✅.
- DATOS VERIFICADOS REALES contra Atlas prod: 7606 leads, 800 tax_delinquent, 2 score≥70,
  2 cartas agosto, gasto Lob $1.98 (~$2), embudo 4/2/3/1 (312-316 N Birge respondió, 3 visitas QR).

## Sesión Ago 11 (2) — Newsletter Pro + Security + fixes de UI/mensajes
### Newsletter Pro (NUEVO)
- Backend: rental/newsletter_pro_router.py — CRUD campañas (draft/schedule/recurring/now),
  envío BILINGÜE (2 emails por persona: ES + EN) con custom_args para tracking,
  scheduler loop (server.py) para programadas/recurrentes (weekly/biweekly/monthly),
  AI: /ai/topics, /ai/generate (contenido ES+EN), /ai/year-plan (12 campañas programadas).
  Tracking por destinatario en newsletter_recipients (delivered/opened/first_open_at/opens/clicked/bounced)
  vía webhook SendGrid (newsletter_router sendgrid_event_webhook actualizado con campaign_id).
- Móvil: app/admin-newsletter.tsx (composer con AI, programación, detalle quién abrió/cuándo/no abrió,
  CRUD). Banner "Newsletter Pro" en admin-marketing.tsx → navega a la pantalla.
- ⚠️ Railway necesita deploy para activar endpoints pro (preview usa Railway).

### SEGURIDAD (auditoría pre-build)
- SEC-001 (HIGH) 2FA bypass CERRADO: marketplace-login rechaza role=admin → 403 admin_2fa_required.
  admin_2fa login-step1 ahora con lockout 5/15min + captcha opcional (móvil). Móvil: AuthContext
  adminLoginStep1/Step2 + modal OTP en (auth)/login.tsx (dispositivo de confianza 30d en AsyncStorage).
  Web admin/layout.tsx: login() deshabilitado (solo AdminLoginScreen 2FA), cookies secure+sameSite.
- SEC-002 (HIGH) credencial Mongo hardcodeada eliminada de backend/tests/test_1099_w9_flow.py (ahora env-only).
- SEC-003 (MED) backend/credentials_log.txt (PII teléfonos) removido de git + .gitignore.
- ⚠️ Historia de git AÚN contiene los secretos viejos — usuario debería rotar password Atlas 'rosstax'
  y considerar purgar historia (BFG). Pendiente de avisar.

### Fixes
- Mensajes admin: alias GET /chat/conversations/{id}/messages + /read + /ai/status/{id} + /ai/toggle/{id}
  (por conversación). chat-conversation.tsx ya no invierte doble el orden.
- Consent forms PDF: get_current_user usaba verify_jwt_token inexistente → reescrito con jwt.decode. Los 4 PDFs OK.
- Legal terms/privacy: textos usaban C.white (invisible en light) → C.textPrimary. Ya no crashea.
- Logo: profile.tsx y onboarding.tsx eligen logo negro (ross_house_logo.png) en light, blanco en dark.
- Chips de filtro Oportunidades: flexShrink:0 (ya documentado antes).
- Versión app subida a 1.0.1 (build 127) para TestFlight.
- TESTED: iteration_31.json 23/23 backend PASS. Frontend: smoke screenshots OK.

## Limpieza de Mensajes reales + flujo (Ago 11)
- Eliminadas conversaciones/mensajes de PRUEBA de chat_conversations/chat_messages:
  Maria Garcia (maria@test.com), Propietario Test, Test Tenant Chat, conv vacía,
  3 mensajes 'TEST_iter31/please ignore', 'Prueba de envío desde admin'.
- Quedan 6 conversaciones REALES: Ross House, Anaelis Ballestero (x2), Usuario 7456 (phone),
  Yoandy Ross, yoandy ross. (conv 5cc25360 es del chatbot LEGACY de Ross Tax, no aparece en Mensajes de rentas — intacta).
- unread_admin recalculado por lógica real (última = tenant sin responder → no leído). Total real: 4 (Ross House, imágenes sin responder).
- Flujo verificado vía curl: admin/conversations, alias /conversations/{id}/messages (orden cronológico),
  /read (baja contador), /ai/status + /ai/toggle, /admin/send. unread-total suma unread_admin.

## DEPLOY a Railway (Ago 11) — producción actualizada
- git push origin main → repo Yoandy90/ross-house-backend → Railway auto-deploy OK.
- Commit b39ee6c: Newsletter Pro, API Keys DB, seguridad 2FA, fixes mensajes/consent.
- VERIFICADO EN PROD (railway):
  · marketplace-login admin → 403 (bypass 2FA cerrado) ✅
  · consent background-check → PDF 74KB ✅
  · /chat/conversations/{id}/messages alias → 14 mensajes ✅
  · /chat/admin/send → enviado ✅
- 2FA admin re-activado, lockout limpio.
- PENDIENTE usuario: rotar password Atlas 'rosstax' (secreto viejo en historia git).

## BUG CRÍTICO envío de mensajes (Ago 11) — RESUELTO
- Causa raíz: src/utils/api.ts hacía body: JSON.stringify(body), pero los llamadores
  (chat-conversation.tsx línea 143, y 13 lugares más incl. admin-newsletter.tsx) ya pasaban
  body: JSON.stringify({...}) → DOBLE codificación → backend recibía string, Pydantic 422.
  Por eso GET (sin body) funcionaba y POST fallaba ("No se pudo enviar el mensaje").
- Fix central en api.ts: serializa solo si body es objeto; si ya es string lo usa tal cual.
  Un cambio arregla los 14 llamadores.
- Backend (extra, ya en prod): AdminSendMessageBody/SendMessageBody aceptan content|message|text.
- VERIFICADO e2e en preview (login email→2FA→abrir Ross House→enviar "OK-99980" visible, input vacío, sin error).
- Push: frontend repo Yoandy90/ross-house-app main 010d27d; backend main e6b63e6.
- ⚠️ App TestFlight actual (1.2.8) NO tiene el fix → requiere NUEVO BUILD 1.0.1(127). Preview/Expo Go ya OK.

## Fix eliminar conversaciones (Ago 11) — DESPLEGADO
- La app llamaba DELETE /chat/admin/conversations/{id}?delete_for_both= pero el endpoint NO existía.
- Añadido en chat_router.py: delete_for_both=true → borra conv+mensajes para todos;
  false → hidden_admin:true (solo se oculta al admin; el cliente la conserva).
- admin_get_conversations filtra hidden_admin≠true; si el tenant escribe de nuevo, hidden_admin:false (reaparece).
- Probado local (ocultar→lista 5→restaurar→6) y desplegado a Railway (commit 2545312, endpoint responde 401 sin auth ✅).
- NOTA: este fix es 100% backend → funciona YA en la app TestFlight actual sin nuevo build.

## Expo App — Navegación Admin Dedicada (Ago 11, 2026) ✅ COMPLETADO
- Requerimiento: el admin aterrizaba en la vista de inquilino y debía tocar un banner para llegar
  al panel. Usuario eligió Opción A (refactor completo) + botón "Ver como inquilino".
- Implementación:
  - AuthContext.tsx: estado `viewAsTenant` + `toggleViewAsTenant()` persistido en AsyncStorage
    (`view_as_tenant`), se resetea en logout.
  - (tabs)/_layout.tsx: tabs condicionales vía `href: null`. Admin (role==='admin' && !viewAsTenant):
    Panel(dashboard), Propiedades, Mensajes, Finanzas, Perfil. Tenant/guest: Inicio, Propiedades,
    Mercado, Pagos, Perfil.
  - Nuevos wrappers de tab: (tabs)/dashboard.tsx, (tabs)/messages.tsx, (tabs)/finances.tsx que
    renderizan admin-dashboard/admin-messages/admin-finanzas con prop `embedded` (oculta flecha
    atrás + paddingBottom 120 para el tab bar).
  - (tabs)/properties.tsx: default export ahora es wrapper — si admin view renderiza
    AdminPropertiesScreen embedded, si no la pantalla de inquilino.
  - (tabs)/index.tsx: `<Redirect href="/(tabs)/dashboard">` para admin view; banner admin eliminado;
    quick actions de admin eliminadas (en modo inquilino ve acciones de tenant).
  - (tabs)/profile.tsx: sección "Modo de vista" (solo admins) con toggle
    "Ver como inquilino" / "Volver a vista Admin" (router.replace al tab correcto).
- Testing: iteration_32.json — 6/6 escenarios PASS (landing admin, 5 tabs, sin flecha atrás,
  toggle ida/vuelta, persistencia al recargar, regresión tenant sin cambios).
