# Guía de Instalación RossTax API Plugin v3.0

## 📋 Resumen Ejecutivo

**RossTax API v3.0** es la reimplementación completa del plugin de integración entre Rise CRM y la aplicación Ross Tax Preparation. Esta versión incluye:

- ✅ Arquitectura CodeIgniter 4 correcta
- ✅ Autenticación robusta por tokens API
- ✅ Panel administrativo completo
- ✅ Endpoints CRUD funcionales
- ✅ Sistema de logs detallado
- ✅ Compatible con Rise CRM 3.9.4

---

## 🎯 Diferencias con v2.0

### ❌ Problemas de v2.0 (CORREGIDOS)
- Estructura de carpetas incorrecta
- No se cargaba en Rise CRM (404 errors)
- Faltaba registro de hooks
- Rutas mal configuradas

### ✅ Mejoras en v3.0
- Estructura de plugin correcta según CodeIgniter 4
- Sistema de hooks implementado (`app_hook_after_setup`, `app_hook_menu_items`)
- Namespace apropiado: `RossTaxAPI\Controllers`
- Autenticación por tokens más robusta
- Panel administrativo funcional
- Logging automático de todas las solicitudes

---

## 📦 Contenido del Plugin

```
RossTaxAPI_v3/
├── index.php                      # Archivo principal - registra hooks
├── Config/
│   └── Routes.php                 # Definición de rutas API
├── Controllers/
│   ├── Api.php                    # Controlador API (CRUD endpoints)
│   └── Admin.php                  # Controlador panel admin
├── Views/
│   ├── admin.php                  # Panel administrativo
│   ├── logs.php                   # Vista de logs
│   ├── tabs.php                   # Navegación
│   ├── header.php                 # Header
│   └── footer.php                 # Footer
├── Helpers/
│   └── rosstax_helper.php         # Funciones auxiliares
└── README.md                      # Documentación técnica
```

---

## 🚀 Instalación Paso a Paso

### ✅ MÉTODO 1: Instalación via FTP (RECOMENDADO)

#### Paso 1: Descargar el Plugin

1. Descargar archivo: `RossTaxAPI_v3.0.zip`
2. Extraer localmente en tu computadora
3. Verificar que la carpeta se llame exactamente `RossTaxAPI`

#### Paso 2: Conectarse via FTP

**Credenciales FTP:**
- Host: `admin.rosstaxpreparation.com` o IP del servidor
- Usuario: (tu usuario FTP de SiteGround)
- Contraseña: (tu contraseña FTP)
- Puerto: 21 (o 22 para SFTP)

**Clientes FTP Recomendados:**
- FileZilla (gratuito): https://filezilla-project.org/
- WinSCP (Windows): https://winscp.net/
- Cyberduck (Mac): https://cyberduck.io/

#### Paso 3: Subir Plugin

1. Conectarse via FTP
2. Navegar a: `/public_html/plugins/`
3. Subir la carpeta completa `RossTaxAPI` a esta ubicación
4. La estructura final debe ser:
   ```
   /public_html/plugins/RossTaxAPI/
   ├── index.php
   ├── Config/
   ├── Controllers/
   ├── Views/
   ├── Helpers/
   └── README.md
   ```

#### Paso 4: Verificar Permisos

**Configurar permisos correctos:**
- Carpetas: `755` (drwxr-xr-x)
- Archivos: `644` (-rw-r--r--)

**Comando via SSH (si tienes acceso):**
```bash
find /home/usuario/public_html/plugins/RossTaxAPI -type d -exec chmod 755 {} \;
find /home/usuario/public_html/plugins/RossTaxAPI -type f -exec chmod 644 {} \;
```

O configurar desde el cliente FTP (botón derecho → File Permissions)

#### Paso 5: Activar Plugin en Rise CRM

1. Acceder a Rise CRM: https://admin.rosstaxpreparation.com
2. Login como administrador
3. Ir a: **Settings** → **Plugins**
4. Buscar "**RossTax API**"
5. Hacer clic en botón **"Activate"**
6. Verificar que el estado cambie a "Active"

#### Paso 6: Verificar Instalación

1. El plugin debe aparecer en el menú lateral como "**RossTax API**"
2. Hacer clic en "RossTax API" para abrir el panel
3. Debe mostrar el panel administrativo con:
   - Sección "API Tokens"
   - Sección "API Endpoints"
   - Sección "Recent API Activity"

---

### ✅ MÉTODO 2: Instalación via cPanel File Manager

#### Paso 1: Acceder a cPanel

1. Ir a: https://admin.rosstaxpreparation.com:2083
2. O acceder desde SiteGround → Site Tools → File Manager
3. Login con credenciales de cPanel

#### Paso 2: Subir ZIP

1. Navegar a: `/public_html/plugins/`
2. Hacer clic en **"Upload"**
3. Seleccionar archivo `RossTaxAPI_v3.0.zip`
4. Esperar a que suba completamente

#### Paso 3: Extraer ZIP

1. Buscar `RossTaxAPI_v3.0.zip` en File Manager
2. Botón derecho → **"Extract"**
3. Verificar que se cree carpeta `RossTaxAPI/`
4. Eliminar el archivo ZIP (opcional)

#### Paso 4: Verificar Estructura

La estructura debe quedar:
```
plugins/
└── RossTaxAPI/
    ├── index.php
    ├── Config/
    ├── Controllers/
    ├── Views/
    ├── Helpers/
    └── README.md
```

#### Paso 5: Activar en Rise CRM

Seguir **Paso 5 y 6 del Método 1**

---

### ✅ MÉTODO 3: Activación Manual via phpMyAdmin (EMERGENCIA)

**⚠️ Solo usar si los métodos anteriores fallan**

#### Paso 1: Acceder a phpMyAdmin

1. Acceder a cPanel → **phpMyAdmin**
2. O directamente: https://admin.rosstaxpreparation.com:2083/phpMyAdmin
3. Seleccionar base de datos de Rise CRM (generalmente `risecrmXXX`)

#### Paso 2: Verificar Plugin

```sql
SELECT * FROM rise_plugins WHERE name = 'RossTaxAPI';
```

#### Paso 3: Insertar o Actualizar Plugin

**Si no existe (resultado vacío):**
```sql
INSERT INTO rise_plugins (name, status, created_at) 
VALUES ('RossTaxAPI', 'activated', NOW());
```

**Si existe pero status = 'deactivated':**
```sql
UPDATE rise_plugins 
SET status = 'activated' 
WHERE name = 'RossTaxAPI';
```

#### Paso 4: Crear Tablas Manualmente (si no existen)

**Tabla de Tokens:**
```sql
CREATE TABLE IF NOT EXISTS `rise_rosstax_api_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token` varchar(255) NOT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Tabla de Logs:**
```sql
CREATE TABLE IF NOT EXISTS `rise_rosstax_api_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `endpoint` varchar(255) NOT NULL,
  `method` varchar(10) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `request_data` text,
  `response_code` int(3) NOT NULL,
  `response_message` text,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Paso 5: Limpiar Caché de Rise CRM

```sql
DELETE FROM rise_settings WHERE setting_name LIKE '%cache%';
```

O manualmente eliminar archivos de caché:
```bash
rm -rf /public_html/application/cache/*
```

---

## 🔐 Configuración Post-Instalación

### 1. Generar Token API

#### Paso 1: Acceder al Panel

1. En Rise CRM, buscar **"RossTax API"** en el menú lateral
2. Hacer clic para abrir el panel administrativo

#### Paso 2: Generar Token

1. En la sección "API Tokens", hacer clic en **"Generate New Token"**
2. Modal aparece solicitando descripción
3. Ingresar descripción: `"Ross Tax Production App"`
4. Hacer clic en **"Generate Token"**

#### Paso 3: Copiar Token

1. Aparece un campo con el token generado
2. **CRÍTICO**: Copiar y guardar este token de forma segura
3. **NO se podrá ver de nuevo** después de cerrar el modal
4. Hacer clic en **"Copy"** para copiar al portapapeles

Ejemplo de token:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 2. Configurar Token en Ross Tax App

#### Paso 1: Editar .env del Backend

```bash
# Ruta: /app/backend/.env

RISE_CRM_URL=https://admin.rosstaxpreparation.com
RISE_CRM_API_TOKEN=<PEGAR_TOKEN_AQUÍ>
```

Ejemplo:
```bash
RISE_CRM_URL=https://admin.rosstaxpreparation.com
RISE_CRM_API_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### Paso 2: Reiniciar Backend

```bash
sudo supervisorctl restart backend
```

O si estás en desarrollo:
```bash
cd /app/backend
python server.py
```

---

## ✅ Verificación de Funcionamiento

### 1. Test desde Rise CRM

Desde el navegador, acceder a:
```
https://admin.rosstaxpreparation.com/index.php/rosstax_api/test
```

**Debería redirigir a login** (401) porque no tiene token.

### 2. Test con cURL

```bash
curl -H "Authorization: Bearer <tu-token>" \
     https://admin.rosstaxpreparation.com/index.php/rosstax_api/test
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "data": {
    "message": "RossTax API v3.0 is working",
    "timestamp": "2025-11-06 10:30:00",
    "version": "3.0.0"
  }
}
```

### 3. Test desde Ross Tax Backend

En la aplicación Ross Tax, ejecutar:

```bash
curl -X POST http://localhost:8001/api/rise-crm/test-connection
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Successfully connected to Rise CRM API",
  "auth_method": "API Token"
}
```

### 4. Verificar Logs en Rise CRM

1. Ir al panel de RossTax API
2. Revisar sección **"Recent API Activity"**
3. Debe aparecer la solicitud de test con:
   - Método: GET
   - Endpoint: `/rosstax_api/test`
   - Status: 200 (éxito)
   - IP: La IP del servidor de Ross Tax

---

## 🔄 Sincronización de Datos

### Orden de Sincronización

1. **Usuarios/Clientes** (prerequisito para todo)
2. **Documentos** (requiere cliente existente)
3. **Proyectos** (requiere cliente existente)
4. **Tareas** (requiere proyecto)
5. **Tickets** (requiere cliente)
6. **Pagos** (requiere cliente)

### Comandos de Sincronización

**Sincronizar todos los usuarios:**
```bash
curl -X POST http://localhost:8001/api/rise-crm/sync/users/all
```

**Sincronizar usuario específico:**
```bash
curl -X POST http://localhost:8001/api/rise-crm/sync/user \
  -H "Content-Type: application/json" \
  -d '{"user_id": "<user-id>"}'
```

**Ver estado de sincronización:**
```bash
curl http://localhost:8001/api/rise-crm/sync/status
```

---

## 🔍 Troubleshooting

### ❌ Error: Plugin no aparece en Rise CRM

**Causa 1: Carpeta mal ubicada**
```bash
# Verificar ubicación correcta
ls -la /public_html/plugins/RossTaxAPI/index.php
```

**Causa 2: Permisos incorrectos**
```bash
# Corregir permisos
chmod 755 /public_html/plugins/RossTaxAPI
chmod 644 /public_html/plugins/RossTaxAPI/index.php
```

**Causa 3: Nombre de carpeta incorrecto**
- Debe ser exactamente `RossTaxAPI` (case-sensitive)
- NO `rosstaxapi`, `RossTaxAPI_v3`, `RossTaxAPI v3.0`

**Solución:**
1. Renombrar carpeta a `RossTaxAPI`
2. Limpiar caché: Settings → System Settings → Clear Cache
3. Refrescar página de Plugins

---

### ❌ Error 404: Endpoint not found

**Síntoma:**
```bash
curl https://admin.rosstaxpreparation.com/index.php/rosstax_api/test
# 404 Not Found
```

**Causas y Soluciones:**

1. **Plugin no activado**
   - Ir a Settings → Plugins
   - Verificar que "RossTax API" tenga status "Active"
   - Activar si está desactivado

2. **Rutas no cargadas**
   - Verificar archivo `/plugins/RossTaxAPI/Config/Routes.php` existe
   - Limpiar caché de Rise CRM
   - Reiniciar servidor web: `sudo service apache2 restart`

3. **.htaccess mal configurado**
   - Verificar que existe `/public_html/.htaccess`
   - Debe contener reglas de rewrite para CodeIgniter 4

---

### ❌ Error 401: Unauthorized

**Síntoma:**
```json
{
  "success": false,
  "error": "No API token provided"
}
```

**Solución:**
1. Verificar header de autorización:
   ```bash
   curl -H "Authorization: Bearer <token>" ...
   ```
2. Verificar que el token esté activo en la base de datos:
   ```sql
   SELECT * FROM rise_rosstax_api_tokens WHERE token = '<tu-token>';
   ```
3. Generar nuevo token si es necesario

---

### ❌ Error 500: Internal Server Error

**Causa 1: Tablas no creadas**

```sql
-- Verificar tablas
SHOW TABLES LIKE 'rise_rosstax_api_%';

-- Resultado esperado:
-- rise_rosstax_api_tokens
-- rise_rosstax_api_logs
```

**Solución:** Crear tablas manualmente (ver Método 3, Paso 4)

**Causa 2: Error de PHP**

1. Revisar logs de PHP:
   ```bash
   tail -f /var/log/apache2/error.log
   # o
   tail -f ~/logs/error.log
   ```

2. Activar debug en Rise CRM:
   ```php
   // /public_html/index.php
   define('ENVIRONMENT', 'development');
   ```

**Causa 3: Permisos de base de datos**

- Verificar que el usuario de MySQL tenga permisos de INSERT/UPDATE
- Verificar conexión a base de datos

---

### ❌ Plugin activado pero no funciona

**Síntoma:** Plugin aparece activo pero endpoints devuelven 404

**Solución 1: Limpiar caché**
```bash
# Via SSH
rm -rf /public_html/application/cache/*

# Via phpMyAdmin
DELETE FROM rise_settings WHERE setting_name LIKE '%cache%';
```

**Solución 2: Verificar hooks**

1. Editar `/plugins/RossTaxAPI/index.php`
2. Verificar que contenga:
   ```php
   public function register_actions() {
       return [
           "app_hook_after_setup" => "setup_rosstax_api",
           "app_hook_menu_items" => "add_rosstax_menu",
       ];
   }
   ```

**Solución 3: Reinstalar plugin**

1. Desactivar plugin en Rise CRM
2. Eliminar carpeta `/plugins/RossTaxAPI/`
3. Volver a subir plugin
4. Activar nuevamente

---

## 📊 Monitoreo y Mantenimiento

### Ver Logs de Actividad

**Desde Rise CRM:**
1. RossTax API → API Logs
2. Ver últimas 100 solicitudes
3. Filtrar por código de respuesta, método, fecha

**Desde Base de Datos:**
```sql
SELECT * FROM rise_rosstax_api_logs 
ORDER BY created_at DESC 
LIMIT 50;
```

**Logs de errores (solo 4xx y 5xx):**
```sql
SELECT * FROM rise_rosstax_api_logs 
WHERE response_code >= 400 
ORDER BY created_at DESC;
```

### Gestión de Tokens

**Ver todos los tokens:**
```sql
SELECT id, token, description, is_active, created_at, last_used_at 
FROM rise_rosstax_api_tokens;
```

**Desactivar token comprometido:**
```sql
UPDATE rise_rosstax_api_tokens 
SET is_active = 0 
WHERE token = '<token-comprometido>';
```

**Eliminar tokens antiguos (>90 días sin uso):**
```sql
DELETE FROM rise_rosstax_api_tokens 
WHERE last_used_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Limpieza de Logs

**Eliminar logs antiguos (>30 días):**
```sql
DELETE FROM rise_rosstax_api_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

## 🎯 Próximos Pasos

Una vez instalado y configurado:

1. ✅ Generar token API
2. ✅ Configurar token en Ross Tax backend
3. ✅ Probar endpoint de test
4. ✅ Sincronizar usuarios inicialmente
5. ✅ Configurar sincronización automática
6. ✅ Monitorear logs de actividad
7. ✅ Configurar webhooks (opcional)

---

## 📞 Soporte

**Contacto:**
- Email: yoandyross@gmail.com
- Website: https://rosstaxpreparation.com

**Documentación:**
- README técnico: `/plugins/RossTaxAPI/README.md`
- API Documentation: Panel de RossTax API en Rise CRM

---

## ✅ Checklist Final

### Pre-Instalación
- [ ] Backup de base de datos Rise CRM
- [ ] Backup de carpeta `/plugins/`
- [ ] Acceso FTP o cPanel confirmado
- [ ] Acceso phpMyAdmin confirmado

### Instalación
- [ ] Plugin subido a `/plugins/RossTaxAPI/`
- [ ] Permisos configurados (755/644)
- [ ] Plugin activado en Rise CRM
- [ ] Menú "RossTax API" visible

### Configuración
- [ ] Token API generado
- [ ] Token guardado de forma segura
- [ ] Token configurado en Ross Tax `.env`
- [ ] Backend de Ross Tax reiniciado

### Verificación
- [ ] Test endpoint devuelve 200
- [ ] Conexión desde Ross Tax funciona
- [ ] Logs registrando actividad
- [ ] Sincronización de usuarios funcional

### Post-Instalación
- [ ] Sincronización inicial completada
- [ ] Monitoreo de logs configurado
- [ ] Documentación revisada
- [ ] Equipo notificado

---

**🎉 ¡Instalación Completada!**

Si todos los checkpoints están completados, la integración RossTax API v3.0 está funcionando correctamente.
