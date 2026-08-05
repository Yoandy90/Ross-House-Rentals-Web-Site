# 🔌 Flujo del Inquilino: Conexión con Green Button / Xcel Energy

> Documento técnico que explica **paso a paso** cómo un inquilino (tenant) conecta su cuenta de electricidad Xcel y ve sus kWh reales dentro de la app **Ross House Rentals**.

---

## 📱 1. Acceso desde la App Móvil

El inquilino abre la app **Ross House Rentals** (TestFlight Build #93) e inicia sesión con sus credenciales.

### 📍 Tres maneras de llegar a "Mis Servicios":

| # | Pantalla origen | Ruta de navegación |
|---|----------------|-------------------|
| 1️⃣ | **Home / Quick Actions** | Tap en la tarjeta **⚡ "Mis Servicios"** |
| 2️⃣ | **Perfil (avatar arriba-der.)** | Menú → **"Mis Servicios"** |
| 3️⃣ | **Tab inferior (en algunas configs)** | Tap directo en el icono |

→ Todas llevan a la ruta `/services` que abre **`/app/rosslending-app/app/services.tsx`**.

---

## ⚡ 2. Pantalla "Mis Servicios" — Lo que ve el inquilino

Al cargar `services.tsx`, la app hace **4 llamadas paralelas al backend**:

```
GET /api/tenant/utilities          → Historial de facturas escaneadas
GET /api/tenant/utilities/summary  → Totales, tendencia, por servicio
GET /api/tenant/utility-bills      → Facturas pendientes de Ross House (Stripe)
GET /api/tenant/xcel/usage         → Consumo Green Button (kWh)  🆕
```

### 🎨 Bloques de UI (de arriba hacia abajo):

1. **Header** con back-button + "Mis Servicios" + botón cámara para escanear recibos.
2. **⚡ Tarjeta "Mi Consumo Eléctrico" (Green Button)** 🆕 — la pieza clave:
   - kWh del mes actual (cifra grande naranja)
   - % vs mes anterior (con flecha ↑↓)
   - Costo estimado en USD
   - **Gráfico de barras** de los últimos 6 meses
   - Badge de estado: **Conectado / Sin conectar**
   - Si **NO está conectado** → botón CTA naranja: **"Conectar mi cuenta de Xcel Energy"**
   - Si **SÍ está conectado** → footnote con disclaimer del costo estimado
3. **💳 Facturas por pagar** (de Ross House Rentals — botón "Pagar" con Stripe PaymentSheet).
4. **📊 Resumen mensual** + dona por tipo de servicio + cards horizontales.
5. **📈 Tendencia** de gastos (otro gráfico de barras).
6. **📋 Historial** de facturas escaneadas.
7. **➕ FAB "Escanear"** flotante para subir recibos con GPT-4o Vision.

---

## 🔐 3. Proceso de Conexión OAuth con Xcel (Green Button Connect)

Cuando el inquilino toca **"Conectar mi cuenta de Xcel Energy"**:

```
┌─────────────────────────────────────────────────────────────────┐
│  PASO 1: APP MÓVIL                                              │
│  services.tsx → connectXcel() → apiCall('/tenant/xcel/connect-url') │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 2: BACKEND (FastAPI)                                       │
│  /api/tenant/xcel/connect-url                                    │
│  - Verifica que el tenant tenga contrato activo + property_id    │
│  - Genera un `state` aleatorio y lo guarda en MongoDB            │
│  - Construye URL de autorización Xcel:                           │
│    https://myenergy.xcelenergy.com/greenbutton-connect/gbc/      │
│    espi/1_1/oauth/authorize?                                     │
│      response_type=code                                          │
│      &client_id=...                                              │
│      &redirect_uri=...                                           │
│      &state=...                                                  │
│      &scope=...                                                  │
│  Retorna {authorization_url: "https://..."}                      │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 3: BROWSER NATIVO                                          │
│  Linking.openURL(authorization_url)                              │
│  - Se abre Safari/Chrome en el iPhone del inquilino              │
│  - El inquilino entra a la página de login de Xcel Energy        │
│  - Ingresa su email + password de su cuenta Xcel                 │
│  - Xcel muestra: "Ross House Rentals quiere acceder a tus datos  │
│    de consumo eléctrico de la propiedad XYZ. ¿Autorizar?"        │
│  - El inquilino tap "Permitir" / "Authorize"                     │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 4: CALLBACK OAUTH                                          │
│  Xcel redirige a: GET /api/xcel/oauth/callback?code=XXX&state=YY │
│  Backend:                                                        │
│  - Valida el `state` contra MongoDB (anti-CSRF)                  │
│  - Intercambia `code` por `access_token` + `refresh_token`       │
│    (POST a https://.../oauth/token)                              │
│  - Extrae `subscription_id` del response                         │
│  - Guarda en MongoDB `xcel_connections`:                         │
│    {                                                             │
│      property_id, access_token, refresh_token,                   │
│      subscription_id, status: "active", last_sync: null          │
│    }                                                             │
│  - Muestra HTML de confirmación: "¡Conexión exitosa!"            │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 5: SINCRONIZACIÓN DE DATOS                                 │
│  Dos formas de obtener los kWh:                                  │
│                                                                  │
│  A) MANUAL (Admin):                                              │
│     Admin tap "Sincronizar" en /admin-energy.tsx                 │
│     POST /api/admin/xcel/connections/{id}/sync                   │
│                                                                  │
│  B) AUTOMÁTICO (Xcel Push):                                      │
│     Xcel POSTea a /api/greenbutton/notify cuando hay datos       │
│     nuevos. Backend descarga el XML ESPI y lo parsea.            │
│                                                                  │
│  Backend:                                                        │
│  - GET https://.../resource/Batch/Subscription/{subscription_id} │
│  - Recibe XML ESPI (NAESB Energy Services Provider Interface)    │
│  - Parsea IntervalReading → kWh diarios                          │
│  - Parsea UsageSummary → períodos facturables                    │
│  - Guarda en `xcel_usage_daily` y `xcel_usage_summaries`         │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PASO 6: VISUALIZACIÓN (EL INQUILINO YA VE SU CONSUMO)           │
│  El inquilino regresa a la app → services.tsx                    │
│  La tarjeta Green Button ahora muestra:                          │
│  - Badge verde "● Conectado"                                     │
│  - kWh reales del mes                                            │
│  - % vs mes anterior                                             │
│  - Costo estimado (kWh × $0.14/kWh promedio)                     │
│  - Gráfico de barras con los últimos 6 meses reales              │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⏱️ 4. Tiempos esperados

| Acción | Tiempo |
|--------|--------|
| Apretar "Conectar" → URL OAuth | < 1 segundo |
| Login + autorización en Xcel | 30s – 2 min (depende del usuario) |
| Callback + guardado del token | < 3 segundos |
| **Primera sincronización de datos** | **24–48 horas** (Xcel actualiza una vez al día) |
| Refresco de la pantalla con datos nuevos | Instantáneo después del sync |

---

## ❓ 5. ¿Qué tipos de "bills" soporta Green Button?

**Green Button es un estándar de la industria ENERGÉTICA** creado por la Casa Blanca en 2012 (NAESB ESPI). Solo cubre:

| Servicio | ¿Soportado por Green Button? |
|----------|------------------------------|
| ⚡ **Electricidad** | ✅ Sí (Xcel, Pacific Gas, ConEd, etc.) |
| 🔥 **Gas natural** | ✅ Sí (Xcel también, Atmos Energy, SoCalGas, etc.) |
| 💧 Agua | ❌ NO (algunas utilities tienen apps propias) |
| 🌐 Internet | ❌ NO |
| 📺 TV / Cable | ❌ NO |
| ☎️ Teléfono | ❌ NO |

> Para los servicios NO soportados (agua, internet, etc.), el inquilino puede **escanear el recibo con la cámara** (GPT-4o Vision extrae el monto automáticamente) y se almacena como registro manual en `/api/tenant/utilities`.

---

## 🔧 6. Endpoints del Backend

### Para el Inquilino (autenticación: JWT marketplace/tenant):
- `GET  /api/tenant/xcel/connect-url` → Genera URL OAuth para conectar.
- `GET  /api/tenant/xcel/usage` 🆕 → Devuelve kWh mensuales + diarios + costo estimado.

### Para el Admin:
- `GET    /api/admin/xcel/status` → Estado global de la integración.
- `GET    /api/admin/xcel/connect-url?property_id=X` → URL OAuth para una propiedad.
- `GET    /api/admin/xcel/connections` → Lista todas las conexiones.
- `POST   /api/admin/xcel/connections/{id}/sync` → Forzar sincronización.
- `DELETE /api/admin/xcel/connections/{id}` → Eliminar conexión.
- `GET    /api/admin/xcel/usage/{property_id}` → Datos de consumo de una propiedad.

### Públicos (Xcel los llama):
- `GET  /api/xcel/oauth/callback` → Recibe el `code` del OAuth.
- `POST /api/greenbutton/exchange` → Intercambio JSON desde la web.
- `POST /api/greenbutton/notify` → Notificación cuando hay datos nuevos.

---

## 💾 7. Modelo de Datos (MongoDB - `taxportal`)

### `xcel_connections`
```js
{
  _id: ObjectId,
  property_id: "60abc...",        // FK a properties
  access_token: "...",
  refresh_token: "...",
  access_token_expires_at: 1718999999,
  subscription_id: "12345",       // ID Xcel para descargar datos
  scope: "FB=4_5_15;IntervalDuration=3600;...",
  status: "active",               // active | needs_reauth
  last_sync: ISODate,
  last_error: null,
  created_at: ISODate,
  updated_at: ISODate
}
```

### `xcel_usage_daily`
```js
{
  property_id: "60abc...",
  date: "2026-02-12",             // YYYY-MM-DD
  kwh: 38.5,
  updated_at: ISODate
}
```

### `xcel_usage_summaries` (períodos de facturación)
```js
{
  property_id: "60abc...",
  period_start: ISODate,
  period_days: 30,
  total_kwh: 1124.3,
  cost: 157.40,                   // En USD
  currency: "USD",
  updated_at: ISODate
}
```

---

## 🚀 8. Estado actual del despliegue

- ✅ Backend (`/app/ross-house-backend/rental/xcel_energy_router.py`) — Endpoint `/tenant/xcel/usage` añadido.
- ✅ Frontend (`/app/rosslending-app/app/services.tsx`) — Card visual de consumo con gráfico de barras.
- ⚠️ **Pendiente:** Push a GitHub → Railway desplegará automáticamente el backend nuevo.
- ⚠️ **Pendiente:** Generar **Build #94 de EAS** para que el inquilino vea la nueva pantalla en TestFlight.

---

## 🧪 9. Cómo probarlo (Sandbox)

1. **En desarrollo local (web):** abrir `http://localhost:3000/services` → la tarjeta aparece con datos DEMO (`Sin conectar`, mostrando 1,124 kWh con tendencia +14.1%).
2. **En producción (Real):**
   - Login como tenant: `maria@test.com` / `Test123!`
   - Tap "Conectar mi cuenta de Xcel Energy" → completa OAuth en sandbox de Xcel.
   - Esperar 24–48h → ver datos reales en la app.

---

*Última actualización: 13 jun 2026 · Versión 1.0*
