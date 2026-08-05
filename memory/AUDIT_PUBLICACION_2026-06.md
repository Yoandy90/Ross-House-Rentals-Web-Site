# 🔍 Auditoría de Publicación — Ross House Rentals
**Fecha**: 2026-06-20 · **Sesión**: Marketplace E2E

## ✅ Listo para publicar

### Frontend Next.js (Vercel)
| Ruta | Status | Notas |
|---|---|---|
| `/` (landing) | 200 ✅ | Landing pública |
| `/admin` | 200 ✅ | Login admin |
| `/tenant` | 200 ✅ | Login inquilino |
| `/inversor` | 200 ✅ | Login inversor |
| `/landlord/register` | 200 ✅ | Onboarding KYC |
| `/admin/marketplace` | 200 ✅ | Moderación listings |
| `/admin/marketplace/comisiones` | 200 ✅ | Dashboard comisiones |
| `/admin/syndication` | 200 ✅ | Inversor portal admin |
| `/privacy-policy` | 200 ✅ | Legal |

### Backend FastAPI (Railway)
- **276 endpoints** activos · `/api/health` → 200
- 14/14 pytest pass para Marketplace Landlord
- **Roles soportados:** admin, tenant, landlord, investor, guest (buyer marketplace)

### Mobile (Expo)
- App config: `Ross House v1.0.0`
- API apunta a `ross-house-backend-production.up.railway.app` ✅

---

## ⚠️ Issues no bloqueantes (recomendado limpiar)

| # | Issue | Severidad | Acción |
|---|---|---|---|
| 1 | `RAPIDAPI_KEY` con default hardcoded en `mashvisor_routes.py:RAPIDAPI_KEY` | 🟡 Media | Mover a env var sin fallback en producción |
| 2 | 2 referencias huérfanas a submódulos en index git (`.gitmodules` no existe) | 🟢 Cosmético | `git rm --cached ross-house-backend rosslending-app` |
| 3 | Test landlords (`qa.*`, `ui.test.*`) aparecen en dashboard comisiones | 🟢 Cosmético | Filtrar emails `qa.*` o añadir DELETE endpoint |
| 4 | Lint warnings (style, no functional) en `properties_router.py` (11 hints F541/E722/E741/F841) | 🟢 Cosmético | Limpieza opcional |
| 5 | Investor login solo acepta el `temp_password` generado al reset (no se puede setear password custom) | 🟡 Media | Cuando inversor logue por 1ra vez con temp_pass, debe poder cambiarla (endpoint `/api/investor/change-password` existe) |

---

## 🔴 Bloqueado externamente
- **Xcel Energy SAML SSO** → Esperando aprobación del vendor. NO afecta publicación.

---

## 📦 Pre-launch checklist

- [x] Backend desplegado en Railway
- [x] Frontend desplegado en Vercel (build #126)
- [x] HTTPS configurado
- [x] Variables de entorno cargadas (Stripe, SendGrid, Twilio, EMERGENT_LLM_KEY)
- [x] Privacy policy publicada
- [x] Login/registro para 4 roles funciona
- [x] Pagos Stripe operativos (verificado en sesiones previas)
- [x] PDFs (contratos + comisiones) generan correctamente
- [x] Marketplace público accesible
- [ ] Build móvil iOS/Android (sólo si quieres publicar app móvil — usar botón "Publish" de Emergent)

**Veredicto: ✅ APTA PARA PUBLICAR**

---

## 👥 Usuarios DEMO para testing por rol

### 🔧 ADMIN (gestiona toda la plataforma)
```
URL:      https://www.rosshouserentals.com/admin
Email:    yoandyross@gmail.com
Password: admin123
```
**Puede ver:** Propiedades, Inquilinos, Contratos, Pagos, Mantenimiento, Inspecciones, Calendario, Inversiones, Inversionistas, Marketplace, Comisiones, Syndication (LP/GP), Reportes, Configuración.

---

### 🏠 LANDLORD externo (publica propiedades en marketplace, cobra renta menos 10% comisión)
```
URL:      https://www.rosshouserentals.com/   (login marketplace)
Email:    demo.landlord@rosshouse.test
Password: Demo123!
Status:   active (KYC ya aprobado)
```
**Puede ver:** Sus propias propiedades publicadas, status de aprobación, inquilinos interesados, comisiones devengadas, payout history Stripe Connect.

---

### 🛏 TENANT (inquilino con contrato activo)
```
URL:      https://www.rosshouserentals.com/tenant
Email:    anaelisb88@gmail.com
Password: Admin.123
Status:   active (contrato firmado)
```
**Puede ver:** Su contrato + descargar PDF, próximos pagos, historial de invoices, autopagos, métodos de pago, lectura medidores, scan utility bills (OCR), bóveda PIN.

---

### 💰 INVESTOR (LP / GP del fondo de syndication)
```
URL:      https://www.rosshouserentals.com/inversor
Email:    demo.investor@rosshouse.test
Password: Inv2606202252   ⚠️ temp password — el inversor debe cambiarla en primer login
Investment: $50,000 LP en "Smoke Test Deal" (50% equity)
```
**Puede ver:** Cap table de su(s) deal(s), distribuciones recibidas, documentos de suscripción para firmar, dashboard de retorno (waterfall calc), forgot-password vía Twilio OTP.

---

### 🛒 GUEST/BUYER (browse marketplace, hacer ofertas)
```
URL:      https://www.rosshouserentals.com/
Email:    demo.tenant@rosshouse.test
Password: Demo123!
Role:     guest (puede solicitar tour de propiedades del marketplace)
```
**Puede ver:** Listings marketplace públicos, perfil propio, foto perfil, notificaciones, mandar inquiries.

---

## 🧪 Flujos sugeridos para testear

1. **Admin → Propiedades → Editar renta** → verificar reflejo en `/admin/contratos`
2. **Tenant (Anaelis) → Dashboard → Descargar PDF contrato** + Pagar próximo invoice (Stripe)
3. **Landlord → Publicar listing** → Admin aprueba → Verificar email landlord + listing aparece en marketplace público
4. **Admin → Comisiones → Send PDF report** a landlord → Verificar email llega con PDF adjunto
5. **Investor → Login con temp password → Cambiar password → Ver Cap Table del deal → Descargar PDF**
6. **Guest → Browse marketplace → Click listing → Solicitar info → Landlord recibe notificación**

---

## 🚀 Próximos pasos opcionales antes de marketing público

1. **Sembrar 3-5 listings reales aprobados** en el marketplace para que no esté vacío al lanzar
2. **Limpiar test users** (`qa.landlord.30599@test.com`, `ui.test.*`) → mejora estética del dashboard admin
3. **Configurar dominio personalizado custom** (si quieres `landlord.rosshouserentals.com` separado del admin)
4. **Tests de carga ligeros** (artillery / k6) sobre endpoints más usados antes del go-live público
5. **Hacer build móvil iOS/Android** vía botón "Publish" de Emergent (sólo si quieres distribuir la app móvil en stores)
