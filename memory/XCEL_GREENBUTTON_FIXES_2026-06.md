# Xcel Green Button — Errores corregidos (Junio 2026)

Basado en el análisis del PDF oficial **GBC Vendor Startup Guide** vs el código en
`/app/ross-house-backend/rental/xcel_energy_router.py`.

## 🔴 Errores que estaban bloqueando la aprobación

### 1. Batch sync era SÍNCRONO (debe ser ASÍNCRONO)
- **Antes**: `GET /Batch/Subscription/{sub_id}` esperando XML inmediato.
- **Spec**: POST → `202 Accepted` → Xcel manda los datos por Notification webhook con un `file_id`.
- **Fix**: `xcel_sync_connection` ahora usa POST, acepta 202, registra la `Location` y notifica que los datos llegarán async.

### 2. Notification webhook no procesaba el `file_id`
- **Antes**: `/xcel/notify` solo guardaba el body en Mongo.
- **Spec**: Parsear `<resources>URL</resources>` del Atom feed, descargar el XML con `client_credentials` token, parsear ESPI e insertar en `xcel_usage_daily` + `xcel_usage_summaries`.
- **Fix**: nuevo flujo completo de ingesta en `_ingest_espi_xml()` + parsing de URLs en el body de la notificación.

### 3. Sin token `client_credentials` para endpoints administrativos
- **Antes**: No teníamos forma de llamar a `ReadServiceStatus` ni a `Authorization`.
- **Spec**: Estos endpoints requieren `grant_type=client_credentials` con `scope=FB=34_35`.
- **Fix**: `_get_client_credentials_token()` con caché en memoria + nueva env `XCEL_ADMIN_SCOPE=FB=34_35`.

### 4. Falta endpoint de prueba `ReadServiceStatus`
- **Spec**: Xcel requiere que un Service Provider pueda llamar `ReadServiceStatus` antes de aprobar.
- **Fix**: nuevo `GET /api/admin/xcel/read-service-status` para diagnosticar la integración.

## 🟡 Variables de entorno requeridas en Railway

```env
XCEL_CLIENT_ID=...           # Que te envíen al aprobarte
XCEL_CLIENT_SECRET=...       # Que te envíen al aprobarte
XCEL_REDIRECT_URI=https://rosshouserentals.com/tenant/utilities?callback=greenbutton
XCEL_SCOPE=                  # Opcional — scope para customer flow (te lo da Xcel)
XCEL_ADMIN_SCOPE=FB=34_35    # Default ya seteado en el código
PUBLIC_BACKEND_URL=https://ross-house-backend-production.up.railway.app
```

## 🟢 Rutas finales del router

| Método | Ruta | Quién la usa |
|---|---|---|
| GET | `/api/admin/xcel/status` | Admin — diagnóstico |
| GET | `/api/admin/xcel/read-service-status` | **NUEVO** — test de aprobación Xcel |
| GET | `/api/admin/xcel/audit-log` | Admin — debug |
| GET | `/api/admin/xcel/connections` | Admin — listar conexiones |
| DELETE | `/api/admin/xcel/connections/{id}` | Admin — borrar conexión |
| POST | `/api/admin/xcel/connections/{id}/sync` | Admin — dispara Batch async |
| GET | `/api/admin/xcel/connect-url?property_id=…` | Admin — autorizar a una propiedad |
| GET | `/api/admin/xcel/usage/{property_id}` | Admin — dashboard kWh |
| GET | `/api/tenant/xcel/connect-url` | Tenant móvil — autorizar |
| GET | `/api/tenant/xcel/usage` | Tenant móvil — gráficas |
| GET | `/api/tenant/xcel/saving-tips` | Tenant móvil — tips AI |
| GET | `/api/xcel/oauth/callback` | **Xcel** — callback OAuth |
| POST | `/api/greenbutton/exchange` | Web — exchange code (web fallback) |
| POST/GET/HEAD | `/api/greenbutton/notify` | **Xcel** — notification URL |
| POST/GET/HEAD | `/api/xcel/notify` | Alias del anterior |

## 📋 Próximos pasos

1. **Deploy backend**: `cd /app/ross-house-backend && git add . && git commit -m "Fix Xcel Green Button: async batch + notification ingestion" && git push`.
2. **Registrar la Notification URL en el portal Xcel**: `https://ross-house-backend-production.up.railway.app/api/greenbutton/notify`.
3. **Registrar el Redirect URI**: `https://rosshouserentals.com/tenant/utilities?callback=greenbutton`.
4. Tras aprobación de Xcel, validar la integración con `GET /api/admin/xcel/read-service-status`.
5. Una vez que un tenant autorice, ejecutar `POST /api/admin/xcel/connections/{id}/sync` y verificar que la notificación llega a `/greenbutton/notify`.
