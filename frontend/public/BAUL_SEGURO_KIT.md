# 🔐 KIT COMPLETO: Módulo "Baúl Seguro" (Vault de Métodos de Pago con PIN)

> **INSTRUCCIÓN PARA EL AGENTE:** Implementa este módulo tal cual en este proyecto. Es un baúl **propio e independiente de este proyecto**: genera llaves de encriptación NUEVAS (nunca reutilices llaves de otro sistema) y usa la base de datos de ESTE proyecto. Adapta únicamente los helpers de autenticación (`auth_admin`, `auth_user`, `useAdminAuth`) a los que ya existan aquí. NO se comparte ningún dato de tarjetas ni llaves con ningún otro proyecto.

## 1. Concepto

Módulo de admin que centraliza todos los métodos de pago guardados por los clientes (tarjetas y cuentas bancarias ACH):

- El listado muestra siempre datos **enmascarados** (last4).
- Para ver los números completos, el admin ingresa un **PIN** (4-8 dígitos) → recibe un token de sesión de 30 min.
- Los datos sensibles se guardan **encriptados con Fernet (AES-128)** en la BD.
- Todo acceso (unlock, revelar, borrar) queda registrado en una **auditoría**.
- 5 intentos fallidos de PIN → bloqueo de 15 minutos.
- Los datos revelados en pantalla se auto-ocultan a los 30 segundos.
- Eliminar un método requiere PIN, hace soft-delete (archiva antes de borrar) y desactiva el autopago del cliente si aplicaba.

## 2. Variables de entorno (generar NUEVAS para este proyecto)

```bash
# Generar con: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
VAULT_ENCRYPTION_KEY=<llave Fernet nueva>
# Cualquier string aleatorio largo:
VAULT_JWT_SECRET=<secreto nuevo>
```

⚠️ Generar UNA sola vez. Si `VAULT_ENCRYPTION_KEY` cambia después de guardar datos, los registros viejos no se podrán desencriptar.

## 3. Dependencias

Backend (Python/FastAPI): `pip install bcrypt PyJWT cryptography stripe`
Frontend (Next.js): `lucide-react` + Tailwind CSS.

## 4. Esquema de datos — colección MongoDB `payment_methods`

```
{
  type: "card" | "bank",
  user_id, user_name, user_email,
  // Tarjeta:
  card_brand, card_last4, card_exp,
  card_number_encrypted,   // Fernet (opcional, solo si se captura directo)
  cvv_encrypted,           // Fernet (opcional)
  // Banco:
  bank_name, account_holder_name, account_type ("checking"|"savings"),
  account_last4,
  routing_encrypted,       // Fernet
  account_encrypted,       // Fernet
  // Integraciones:
  stripe_payment_method_id, stripe_customer_id,
  is_default, is_active_for_autopay,
  needs_verification, verified,
  source, created_at
}
```

Colecciones auxiliares: `vault_config` (PIN hash + intentos fallidos), `vault_audit_log` (auditoría), `payment_methods_deleted` (archivo de soft-delete).

## 5. Endpoints (todos con prefijo `/api`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/vault/pin-status` | Admin | `{has_pin, configured_at}` |
| POST | `/admin/vault/set-pin` | Admin | `{new_pin, current_pin?}` — 4-8 dígitos |
| POST | `/admin/vault/unlock` | Admin | `{pin}` → `{vault_token, expires_in: 1800}` |
| GET | `/admin/vault/payment-methods` | Admin | Lista enmascarada (last4) |
| GET | `/admin/vault/payment-methods/{id}/reveal` | Admin + header `X-Vault-Token` | Números completos + auditoría |
| DELETE | `/admin/vault/payment-methods/{id}` | Admin + header `X-Vault-Token` | Soft-delete |
| GET | `/admin/vault/audit-log?limit=100` | Admin | Eventos de auditoría |
| POST | `/tenant/bank-accounts/add` | Usuario | Cliente agrega cuenta ACH (encriptada + Stripe opcional) |

## 6. Backend — `vault_router.py` (FastAPI + Motor/MongoDB)

```python
"""Admin Vault (Baúl Seguro) — Acceso PIN-protegido a métodos de pago de clientes.

Arquitectura:
  1. El admin configura un PIN una vez (hash bcrypt, guardado en vault_config).
  2. Para ver números completos, el admin POSTea el PIN → recibe un token de
     sesión de baúl (JWT, 30 min TTL) con {vault_unlocked: true}.
  3. El listado devuelve datos enmascarados (last4) — no requiere token.
  4. El endpoint de revelar requiere el token (header X-Vault-Token).
  5. Todos los accesos se auditan en `vault_audit_log`.

Los datos sensibles se guardan encriptados en reposo con Fernet (AES-128).
La llave (VAULT_ENCRYPTION_KEY) vive en env vars.
"""
import os
import logging
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
import bcrypt
from cryptography.fernet import Fernet
from fastapi import APIRouter, Request, HTTPException
from bson import ObjectId

# ══ ADAPTAR A ESTE PROYECTO ═══════════════════════════════════════════════
# - get_db(): debe devolver la instancia de Motor AsyncIOMotorDatabase.
# - auth_admin(request): valida el JWT/sesión del admin y devuelve el
#   documento del admin (dict con al menos "_id" y "email"), o lanza 401.
from .shared import get_db, auth_admin
# ═══════════════════════════════════════════════════════════════════════════

router = APIRouter()
logger = logging.getLogger(__name__)

VAULT_JWT_SECRET = os.environ.get("VAULT_JWT_SECRET") or os.environ.get("JWT_SECRET", "vault-dev-secret")
VAULT_TOKEN_TTL_MIN = 30
VAULT_AUDIT_COLL = "vault_audit_log"


def _get_fernet() -> Fernet:
    """Fernet estable desde VAULT_ENCRYPTION_KEY (o derivada de SECRET_KEY en dev)."""
    raw_key = os.environ.get("VAULT_ENCRYPTION_KEY")
    if not raw_key:
        seed = os.environ.get("SECRET_KEY") or os.environ.get("JWT_SECRET") or "vault-dev-2026"
        digest = hashlib.sha256(seed.encode()).digest()
        raw_key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(raw_key.encode() if isinstance(raw_key, str) else raw_key)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except Exception:
        return ""


def mask(value: str, visible: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * (len(value) - visible) + value[-visible:]


async def _audit(db, admin_email: str, action: str, target: str = "", meta: Optional[dict] = None):
    try:
        await db[VAULT_AUDIT_COLL].insert_one({
            "admin_email": admin_email,
            "action": action,
            "target": target,
            "meta": meta or {},
            "timestamp": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.warning(f"vault audit failed: {e}")


async def _require_vault_session(request: Request):
    """Valida el header X-Vault-Token (emitido por /admin/vault/unlock)."""
    token = request.headers.get("X-Vault-Token") or request.query_params.get("vault_token")
    if not token:
        raise HTTPException(status_code=403, detail="Vault session required. Unlock with PIN first.")
    try:
        payload = jwt.decode(token, VAULT_JWT_SECRET, algorithms=["HS256"])
        if not payload.get("vault_unlocked"):
            raise HTTPException(status_code=403, detail="Invalid vault token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=403, detail="Vault session expired — re-enter PIN")
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid vault token")


# ════════════════════════════════════════════════════════════════════════════
# Gestión del PIN
# ════════════════════════════════════════════════════════════════════════════

@router.get("/admin/vault/pin-status")
async def vault_pin_status(request: Request):
    """Si ya hay PIN configurado (para mostrar UI 'configurar' vs 'desbloquear')."""
    await auth_admin(request)
    config = await get_db().vault_config.find_one({"type": "vault"}) or {}
    return {
        "has_pin": bool(config.get("vault_pin_hash")),
        "configured_at": config.get("vault_pin_set_at"),
    }


@router.post("/admin/vault/set-pin")
async def vault_set_pin(request: Request):
    """Configura o cambia el PIN. Si ya existe, se exige el actual como `current_pin`."""
    admin = await auth_admin(request)
    data = await request.json()

    new_pin = (data.get("new_pin") or "").strip()
    current_pin = (data.get("current_pin") or "").strip()

    if not new_pin or not new_pin.isdigit() or not (4 <= len(new_pin) <= 8):
        raise HTTPException(status_code=400, detail="El PIN debe tener entre 4 y 8 dígitos numéricos")

    db = get_db()
    config = await db.vault_config.find_one({"type": "vault"}) or {}

    if config.get("vault_pin_hash"):
        if not current_pin:
            raise HTTPException(status_code=400, detail="Debes proveer el PIN actual para cambiarlo")
        try:
            ok = bcrypt.checkpw(current_pin.encode(), config["vault_pin_hash"].encode())
        except Exception:
            ok = False
        if not ok:
            await _audit(db, admin.get("email", ""), "set_pin_failed", meta={"reason": "wrong_current"})
            raise HTTPException(status_code=403, detail="PIN actual incorrecto")

    new_hash = bcrypt.hashpw(new_pin.encode(), bcrypt.gensalt()).decode()
    await db.vault_config.update_one(
        {"type": "vault"},
        {"$set": {
            "vault_pin_hash": new_hash,
            "vault_pin_set_at": datetime.now(timezone.utc),
            "vault_pin_set_by": admin.get("email", ""),
        }},
        upsert=True,
    )
    await _audit(db, admin.get("email", ""), "pin_set_or_changed")
    return {"success": True, "message": "PIN configurado exitosamente"}


@router.post("/admin/vault/unlock")
async def vault_unlock(request: Request):
    """Intercambia el PIN por un token de sesión de baúl (X-Vault-Token)."""
    admin = await auth_admin(request)
    data = await request.json()
    pin = (data.get("pin") or "").strip()
    if not pin:
        raise HTTPException(status_code=400, detail="PIN requerido")

    db = get_db()
    config = await db.vault_config.find_one({"type": "vault"}) or {}
    pin_hash = config.get("vault_pin_hash")
    if not pin_hash:
        raise HTTPException(status_code=400, detail="No hay PIN configurado. Configúralo primero.")

    # Chequeo de bloqueo por intentos fallidos
    locked_until = config.get("vault_locked_until")
    if locked_until and locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=429, detail=f"Demasiados intentos fallidos. Espera hasta {locked_until.strftime('%H:%M')}")

    try:
        ok = bcrypt.checkpw(pin.encode(), pin_hash.encode())
    except Exception:
        ok = False

    if not ok:
        await _audit(db, admin.get("email", ""), "unlock_failed", meta={"ip": request.client.host if request.client else ""})
        attempts = config.get("vault_failed_attempts", 0) + 1
        update = {"vault_failed_attempts": attempts}
        if attempts >= 5:
            update["vault_locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.vault_config.update_one({"type": "vault"}, {"$set": update})
        raise HTTPException(status_code=403, detail="PIN incorrecto")

    payload = {
        "vault_unlocked": True,
        "admin_id": str(admin.get("_id", "")),
        "admin_email": admin.get("email", ""),
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=VAULT_TOKEN_TTL_MIN)).timestamp()),
    }
    token = jwt.encode(payload, VAULT_JWT_SECRET, algorithm="HS256")
    await _audit(db, admin.get("email", ""), "unlock_success")
    await db.vault_config.update_one(
        {"type": "vault"},
        {"$set": {"vault_failed_attempts": 0, "vault_locked_until": None}},
    )
    return {"success": True, "vault_token": token, "expires_in": VAULT_TOKEN_TTL_MIN * 60}


# ════════════════════════════════════════════════════════════════════════════
# Datos del baúl — listar y revelar
# ════════════════════════════════════════════════════════════════════════════

@router.get("/admin/vault/payment-methods")
async def vault_list_payment_methods(request: Request):
    """Lista todos los métodos de pago (tarjetas + bancos) de todos los usuarios.
    Los campos sensibles van enmascarados (last4). No requiere sesión de baúl."""
    await auth_admin(request)
    db = get_db()
    items = []

    async for pm in db.payment_methods.find({}).sort("created_at", -1):
        items.append({
            "id": str(pm["_id"]),
            "type": pm.get("type", "card"),
            "user_id": str(pm.get("user_id", "")),
            "user_name": pm.get("user_name", ""),
            "user_email": pm.get("user_email", ""),
            "card_brand": pm.get("card_brand", ""),
            "card_last4": pm.get("card_last4", ""),
            "card_exp": pm.get("card_exp", ""),
            "bank_name": pm.get("bank_name", ""),
            "account_type": pm.get("account_type", ""),
            "account_last4": pm.get("account_last4", ""),
            "routing_masked": mask(decrypt(pm.get("routing_encrypted", "")), visible=4) if pm.get("routing_encrypted") else "",
            "is_default": bool(pm.get("is_default", False)),
            "is_active_for_autopay": bool(pm.get("is_active_for_autopay", False)),
            "stripe_payment_method_id": pm.get("stripe_payment_method_id", ""),
            "created_at": pm.get("created_at"),
            "source": pm.get("source", ""),
        })

    return {"success": True, "items": items, "count": len(items)}


@router.get("/admin/vault/payment-methods/{method_id}/reveal")
async def vault_reveal_method(method_id: str, request: Request):
    """Revela routing + account (y tarjeta/CVV si fueron guardados encriptados).
    Requiere el token de sesión de baúl. Cada lectura queda auditada."""
    admin = await auth_admin(request)
    await _require_vault_session(request)
    db = get_db()

    pm = await db.payment_methods.find_one({"_id": ObjectId(method_id)})
    if not pm:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado")

    routing_full = decrypt(pm.get("routing_encrypted", ""))
    account_full = decrypt(pm.get("account_encrypted", ""))
    card_full = decrypt(pm.get("card_number_encrypted", ""))
    cvv_full = decrypt(pm.get("cvv_encrypted", ""))

    await _audit(db, admin.get("email", ""), "reveal", target=method_id, meta={
        "user_id": str(pm.get("user_id", "")),
        "type": pm.get("type"),
        "had_routing": bool(routing_full),
        "had_account": bool(account_full),
        "had_card_full": bool(card_full),
    })

    return {
        "success": True,
        "id": str(pm["_id"]),
        "type": pm.get("type", "card"),
        "routing_full": routing_full,
        "account_full": account_full,
        "card_full": card_full,
        "cvv_full": cvv_full,
        "card_last4": pm.get("card_last4", ""),
        "card_brand": pm.get("card_brand", ""),
        "card_exp": pm.get("card_exp", ""),
        "bank_name": pm.get("bank_name", ""),
        "account_type": pm.get("account_type", ""),
        "account_last4": pm.get("account_last4", ""),
        "user_name": pm.get("user_name", ""),
        "user_email": pm.get("user_email", ""),
        "message": None if (card_full or routing_full or account_full) else
            "⚠️ Este método no tiene datos completos guardados (ej: tarjeta tokenizada en Stripe — Stripe no expone el número completo).",
    }


@router.delete("/admin/vault/payment-methods/{method_id}")
async def vault_delete_method(method_id: str, request: Request):
    """Elimina un método de pago del baúl (soft-delete con archivo).
    Requiere el token de sesión de baúl (PIN)."""
    admin = await auth_admin(request)
    await _require_vault_session(request)
    db = get_db()

    pm = await db.payment_methods.find_one({"_id": ObjectId(method_id)})
    if not pm:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado")

    user_id = str(pm.get("user_id", ""))
    pm_type = pm.get("type", "card")
    last4 = pm.get("card_last4") or pm.get("account_last4", "")

    # Soft-delete: archivar para poder recuperar, luego borrar
    await db.payment_methods_deleted.insert_one({
        **pm,
        "_original_id": pm["_id"],
        "deleted_at": datetime.now(timezone.utc),
        "deleted_by": admin.get("email", ""),
    })
    await db.payment_methods.delete_one({"_id": ObjectId(method_id)})

    # Si era el método de autopago del usuario, desactivar su autopago
    if user_id and pm.get("stripe_payment_method_id"):
        await db.autopay_config.update_many(
            {"payment_method_id": pm.get("stripe_payment_method_id", "")},
            {"$set": {"enabled": False, "disabled_reason": "payment_method_deleted_by_admin"}}
        )

    await _audit(db, admin.get("email", ""), "delete", target=method_id, meta={
        "user_id": user_id, "type": pm_type, "last4": last4,
    })

    return {"success": True, "message": f"Método de pago eliminado ({pm_type} ····{last4})"}


@router.get("/admin/vault/audit-log")
async def vault_audit_log(request: Request, limit: int = 100):
    """Últimos N eventos de acceso al baúl."""
    await auth_admin(request)
    db = get_db()
    cursor = db[VAULT_AUDIT_COLL].find({}).sort("timestamp", -1).limit(limit)
    items = []
    async for ev in cursor:
        items.append({
            "id": str(ev["_id"]),
            "admin_email": ev.get("admin_email", ""),
            "action": ev.get("action", ""),
            "target": ev.get("target", ""),
            "meta": ev.get("meta", {}),
            "timestamp": ev.get("timestamp"),
        })
    return {"success": True, "items": items}


# ════════════════════════════════════════════════════════════════════════════
# Captura de cuenta bancaria (ACH) — lado cliente
# ════════════════════════════════════════════════════════════════════════════

@router.post("/tenant/bank-accounts/add")
async def tenant_add_bank_account(request: Request):
    """Cliente: agrega una cuenta bancaria (ACH).

    Body:
      account_holder_name: str
      routing_number: string de 9 dígitos
      account_number: string numérico (4-17 dígitos)
      account_type: 'checking' | 'savings'
      bank_name: str (opcional)
      make_default: bool (opcional)

    Guarda:
      - Números completos ENCRIPTADOS en `payment_methods` (para el baúl)
      - Opcionalmente crea PaymentMethod ACH en Stripe para poder cobrar
    """
    # ══ ADAPTAR: usar el auth de usuario/cliente de ESTE proyecto ══
    from .shared import auth_user
    user = await auth_user(request)
    data = await request.json()

    holder = (data.get("account_holder_name") or "").strip()
    routing = (data.get("routing_number") or "").strip()
    account = (data.get("account_number") or "").strip()
    acc_type = (data.get("account_type") or "checking").lower()

    if not holder or not routing or not account:
        raise HTTPException(status_code=400, detail="Faltan datos del banco")
    if not routing.isdigit() or len(routing) != 9:
        raise HTTPException(status_code=400, detail="Routing number debe tener 9 dígitos")
    if not account.isdigit() or not (4 <= len(account) <= 17):
        raise HTTPException(status_code=400, detail="Account number inválido")
    if acc_type not in ("checking", "savings"):
        acc_type = "checking"

    db = get_db()
    stripe_sk = os.environ.get("STRIPE_SECRET_KEY", "")
    stripe_pm_id = ""
    stripe_customer_id = (user.get("stripe_customer_id") or "")

    # Stripe es opcional — si no está configurado, solo guardar encriptado
    if stripe_sk:
        try:
            import stripe as stripe_lib
            stripe_lib.api_key = stripe_sk
            if not stripe_customer_id:
                cust = stripe_lib.Customer.create(
                    email=user.get("email"), name=holder,
                    metadata={"user_id": str(user["_id"])},
                )
                stripe_customer_id = cust.id
                await db.users.update_one(
                    {"_id": ObjectId(str(user["_id"]))},
                    {"$set": {"stripe_customer_id": stripe_customer_id}}
                )
            pm = stripe_lib.PaymentMethod.create(
                type="us_bank_account",
                us_bank_account={
                    "routing_number": routing,
                    "account_number": account,
                    "account_holder_type": "individual",
                    "account_type": acc_type,
                },
                billing_details={"name": holder, "email": user.get("email")},
            )
            stripe_lib.PaymentMethod.attach(pm.id, customer=stripe_customer_id)
            stripe_pm_id = pm.id
        except Exception as e:
            logger.warning(f"Stripe ACH attach failed: {e} — guardando solo encriptado")

    doc = {
        "type": "bank",
        "user_id": str(user["_id"]),
        "user_name": holder or user.get("name", ""),
        "user_email": user.get("email", ""),
        "bank_name": data.get("bank_name", ""),
        "account_holder_name": holder,
        "account_type": acc_type,
        "account_last4": account[-4:],
        "routing_encrypted": encrypt(routing),
        "account_encrypted": encrypt(account),
        "stripe_payment_method_id": stripe_pm_id,
        "stripe_customer_id": stripe_customer_id,
        "is_default": bool(data.get("make_default", False)),
        "is_active_for_autopay": False,
        "needs_verification": bool(stripe_pm_id),
        "verified": False,
        "source": "user_ach",
        "created_at": datetime.now(timezone.utc),
    }
    if doc["is_default"]:
        await db.payment_methods.update_many(
            {"user_id": str(user["_id"]), "type": "bank"},
            {"$set": {"is_default": False}}
        )
    res = await db.payment_methods.insert_one(doc)

    return {
        "success": True,
        "id": str(res.inserted_id),
        "stripe_payment_method_id": stripe_pm_id,
        "needs_verification": doc["needs_verification"],
        "message": (
            "Cuenta bancaria guardada. Stripe enviará 2 micro-depósitos en 2-3 días para verificarla."
            if stripe_pm_id else "Cuenta bancaria guardada (verificación manual)."
        ),
    }
```

**Registro del router** (en el `server.py`/`main.py` del proyecto):

```python
from vault_router import router as vault_router
app.include_router(vault_router, prefix="/api")
```

## 7. Frontend — Página Admin `/admin/baul/page.tsx` (Next.js App Router)

> **ADAPTAR (3 puntos):**
> 1. Reemplaza `import { useAdminAuth } from '../layout'` por el mecanismo de auth de admin de ESTE proyecto. Solo se necesita una función `headers()` que devuelva los headers autenticados, ej: `{ Authorization: 'Bearer ...', 'Content-Type': 'application/json' }`.
> 2. Los campos `is_legacy` y `has_nmi_vault` en el tipo `Method` son opcionales del proyecto original — puedes eliminarlos, no afectan nada.
> 3. Renombra las keys de localStorage (`ross_vault_token` → el nombre que prefieras).

El código completo de la página está a continuación (copiar tal cual, es funcional):

```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuth } from '../layout';
import {
  Lock, Unlock, Shield, KeyRound, Eye, EyeOff, CreditCard, Building2,
  RefreshCw, Search, AlertTriangle, CheckCircle2, Copy, ClipboardCheck,
  ScrollText, Sparkles, X, User, ShieldAlert, Clock, Trash2,
} from 'lucide-react';

type Method = {
  id: string;
  type: 'card' | 'bank';
  user_id: string;
  user_name: string;
  user_email: string;
  card_brand?: string;
  card_last4?: string;
  card_exp?: string;
  bank_name?: string;
  account_type?: string;
  account_last4?: string;
  routing_masked?: string;
  is_default?: boolean;
  is_active_for_autopay?: boolean;
  stripe_payment_method_id?: string;
  created_at?: string;
  source?: string;
  is_legacy?: boolean;
  has_nmi_vault?: boolean;
};

type Revealed = {
  id: string;
  routing_full?: string;
  account_full?: string;
  card_full?: string;
  cvv_full?: string;
  exp_month?: string;
  exp_year?: string;
  expires_at: number;  // epoch ms
};

const VAULT_TOKEN_KEY = 'ross_vault_token';
const VAULT_TOKEN_EXP_KEY = 'ross_vault_token_exp';

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
};

export default function BaulPage() {
  const { headers } = useAdminAuth();
  const [pinStatus, setPinStatus] = useState<{ has_pin: boolean; configured_at?: string } | null>(null);
  const [vaultToken, setVaultToken] = useState<string>('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPinModal, setShowPinModal] = useState<'unlock' | 'set' | 'change' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'card' | 'bank'>('all');
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [confirmDelete, setConfirmDelete] = useState<Method | null>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const [copiedKey, setCopiedKey] = useState('');

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3500);
  };

  // Load token from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = window.localStorage.getItem(VAULT_TOKEN_KEY);
    const e = parseInt(window.localStorage.getItem(VAULT_TOKEN_EXP_KEY) || '0', 10);
    if (t && e > Date.now()) {
      setVaultToken(t);
      setTokenExpiresAt(e);
    }
  }, []);

  const persistToken = (token: string, ttlSeconds: number) => {
    const exp = Date.now() + ttlSeconds * 1000;
    setVaultToken(token);
    setTokenExpiresAt(exp);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VAULT_TOKEN_KEY, token);
      window.localStorage.setItem(VAULT_TOKEN_EXP_KEY, String(exp));
    }
  };

  const clearToken = () => {
    setVaultToken('');
    setTokenExpiresAt(0);
    setRevealed({});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(VAULT_TOKEN_KEY);
      window.localStorage.removeItem(VAULT_TOKEN_EXP_KEY);
    }
  };

  const fetchAll = useCallback(async () => {
    try {
      const [pinRes, methodsRes] = await Promise.all([
        fetch('/api/admin/vault/pin-status', { headers: headers() }),
        fetch('/api/admin/vault/payment-methods', { headers: headers() }),
      ]);
      if (pinRes.ok) setPinStatus(await pinRes.json());
      if (methodsRes.ok) {
        const d = await methodsRes.json();
        setMethods(d.items || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchAudit = async () => {
    try {
      const res = await fetch('/api/admin/vault/audit-log?limit=50', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setAudit(d.items || []);
        setShowAudit(true);
      }
    } catch (e) { console.error(e); }
  };

  // ─── PIN actions ────────────────────────────────────────
  const handleUnlock = async () => {
    if (!pinInput || pinInput.length < 4) {
      showToast('PIN debe tener al menos 4 dígitos', 'err');
      return;
    }
    setPinSubmitting(true);
    try {
      const res = await fetch('/api/admin/vault/unlock', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ pin: pinInput }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        persistToken(d.vault_token, d.expires_in);
        showToast('🔓 Baúl desbloqueado por 30 min');
        setShowPinModal(null);
        setPinInput('');
      } else {
        showToast(`❌ ${d.detail || 'PIN incorrecto'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setPinSubmitting(false);
  };

  const handleSetPin = async () => {
    if (!pinNew || pinNew.length < 4 || pinNew.length > 8) {
      showToast('PIN debe tener 4-8 dígitos', 'err');
      return;
    }
    setPinSubmitting(true);
    try {
      const body: any = { new_pin: pinNew };
      if (pinStatus?.has_pin) body.current_pin = pinCurrent;
      const res = await fetch('/api/admin/vault/set-pin', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast('🔐 PIN configurado exitosamente');
        setShowPinModal(null);
        setPinNew(''); setPinCurrent('');
        await fetchAll();
      } else {
        showToast(`❌ ${d.detail || 'Error'}`, 'err');
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
    setPinSubmitting(false);
  };

  // ─── Reveal action ────────────────────────────────────
  const handleReveal = async (m: Method) => {
    if (!vaultToken) {
      setShowPinModal('unlock');
      return;
    }
    try {
      const res = await fetch(`/api/admin/vault/payment-methods/${m.id}/reveal`, {
        headers: { ...headers(), 'X-Vault-Token': vaultToken },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setRevealed(r => ({
          ...r,
          [m.id]: {
            id: m.id,
            routing_full: d.routing_full,
            account_full: d.account_full,
            card_full: d.card_full,
            cvv_full: d.cvv_full,
            exp_month: d.exp_month,
            exp_year: d.exp_year,
            expires_at: Date.now() + 30 * 1000,
          },
        }));
        if (!d.card_full && !d.routing_full && !d.account_full) {
          showToast(d.message || '⚠️ No hay datos completos para mostrar', 'err');
        }
        setTimeout(() => {
          setRevealed(r => {
            const next = { ...r };
            delete next[m.id];
            return next;
          });
        }, 30 * 1000);
      } else {
        if (res.status === 403) {
          clearToken();
          showToast('Sesión expirada, ingresa el PIN nuevamente', 'err');
          setShowPinModal('unlock');
        } else {
          showToast(`❌ ${d.detail || 'Error'}`, 'err');
        }
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
  };

  // ─── Delete action ──────────────────────────────────
  const handleDelete = async (m: Method) => {
    if (!vaultToken) {
      setShowPinModal('unlock');
      return;
    }
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/vault/payment-methods/${m.id}`, {
        method: 'DELETE',
        headers: { ...headers(), 'X-Vault-Token': vaultToken },
      });
      const d = await res.json();
      if (res.ok && d.success) {
        showToast(`🗑️ ${d.message || 'Eliminado'}`);
        setRevealed(r => { const n = { ...r }; delete n[m.id]; return n; });
        await fetchAll();
      } else {
        if (res.status === 403) {
          clearToken();
          showToast('Sesión expirada, ingresa el PIN', 'err');
          setShowPinModal('unlock');
        } else {
          showToast(`❌ ${d.detail || 'Error'}`, 'err');
        }
      }
    } catch (e: any) {
      showToast(`❌ ${e?.message || 'Error'}`, 'err');
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
    });
  };

  const timeRemaining = vaultToken && tokenExpiresAt
    ? Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 60000))
    : 0;

  const filtered = useMemo(() => {
    return methods.filter(m => {
      if (filter !== 'all' && m.type !== filter) return false;
      if (search) {
        const h = `${m.user_name} ${m.user_email} ${m.card_brand} ${m.bank_name} ${m.card_last4} ${m.account_last4}`.toLowerCase();
        if (!h.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [methods, search, filter]);

  const stats = useMemo(() => ({
    total: methods.length,
    cards: methods.filter(m => m.type === 'card').length,
    banks: methods.filter(m => m.type === 'bank').length,
    users: new Set(methods.map(m => m.user_id)).size,
  }), [methods]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 relative pb-32">
      <div className="fixed top-0 right-1/3 w-96 h-96 bg-amber-500/[0.025] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/4 w-96 h-96 bg-red-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.20)]">
            {vaultToken ? <Unlock className="w-6 h-6 text-amber-300" /> : <Lock className="w-6 h-6 text-amber-300" />}
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Baúl Seguro</h2>
            <p className="text-sm text-gray-500">
              {stats.total} método(s) · {stats.users} cliente(s) ·{' '}
              {vaultToken
                ? <span className="text-emerald-400 font-bold">🔓 Desbloqueado ({timeRemaining} min)</span>
                : <span className="text-amber-400 font-bold">🔒 Bloqueado</span>
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={fetchAll} className="p-2.5 border border-white/[0.08] rounded-xl text-gray-400 hover:bg-white/[0.04] transition" title="Refrescar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={fetchAudit} className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm font-bold text-gray-300 hover:bg-white/[0.04] transition">
            <ScrollText className="w-4 h-4" /> Auditoría
          </button>
          {pinStatus?.has_pin ? (
            <button onClick={() => setShowPinModal('change')} className="flex items-center gap-2 px-4 py-2.5 border border-amber-500/30 bg-amber-500/10 rounded-xl text-sm font-bold text-amber-300 hover:bg-amber-500/20 transition">
              <KeyRound className="w-4 h-4" /> Cambiar PIN
            </button>
          ) : (
            <button onClick={() => setShowPinModal('set')} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_22px_rgba(245,158,11,0.35)]">
              <KeyRound className="w-4 h-4" /> Configurar PIN
            </button>
          )}
          {vaultToken ? (
            <button onClick={clearToken} className="flex items-center gap-2 px-4 py-2.5 border border-red-500/30 bg-red-500/10 rounded-xl text-sm font-bold text-red-300 hover:bg-red-500/20 transition">
              <Lock className="w-4 h-4" /> Bloquear ahora
            </button>
          ) : (
            <button onClick={() => setShowPinModal('unlock')} disabled={!pinStatus?.has_pin} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_22px_rgba(16,185,129,0.35)] disabled:opacity-30">
              <Unlock className="w-4 h-4" /> Desbloquear
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className={`rounded-2xl border p-4 ${vaultToken ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-amber-500/[0.05] border-amber-500/20'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 shrink-0 ${vaultToken ? 'bg-emerald-500/15 ring-emerald-500/30' : 'bg-amber-500/15 ring-amber-500/30'}`}>
            <Shield className={`w-5 h-5 ${vaultToken ? 'text-emerald-300' : 'text-amber-300'}`} />
          </div>
          <div className="text-sm text-gray-300 space-y-1 flex-1">
            <div className="font-bold text-white">{vaultToken ? '🔓 Baúl Desbloqueado' : '🔒 Baúl Bloqueado — Solo datos enmascarados visibles'}</div>
            <p className="text-xs text-gray-400">
              Por seguridad, todos los routing/account numbers están <strong>encriptados</strong> en la base de datos.
              Para ver los números completos, ingresa el PIN. La sesión dura 30 min y cada lectura queda registrada en la auditoría.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<CreditCard className="w-4 h-4 text-violet-400" />} value={String(stats.cards)} label="Tarjetas" tone="violet" />
        <StatCard icon={<Building2 className="w-4 h-4 text-blue-400" />} value={String(stats.banks)} label="Bancos" tone="blue" />
        <StatCard icon={<User className="w-4 h-4 text-emerald-400" />} value={String(stats.users)} label="Clientes" tone="emerald" />
        <StatCard icon={<ShieldAlert className="w-4 h-4 text-amber-400" />} value={String(stats.total)} label="Total métodos" tone="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, banco, last4..." className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-amber-500 focus:outline-none placeholder:text-gray-600" />
        </div>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterPill>
        <FilterPill active={filter === 'card'} onClick={() => setFilter('card')} tone="violet">Tarjetas</FilterPill>
        <FilterPill active={filter === 'bank'} onClick={() => setFilter('bank')} tone="blue">Bancos</FilterPill>
      </div>

      {/* Method list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-amber-500/20">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-gray-300 text-sm font-semibold">Sin métodos guardados aún</p>
          <p className="text-gray-500 text-xs mt-1">Los clientes pueden agregar tarjeta o banco desde la app</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const isBank = m.type === 'bank';
            const rev = revealed[m.id];
            const meta = isBank
              ? { Icon: Building2, color: 'text-blue-300', bg: 'bg-blue-500/15', ring: 'ring-blue-500/30' }
              : { Icon: CreditCard, color: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/30' };

            return (
              <div key={m.id} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm rounded-xl border border-white/[0.06] p-4 hover:border-amber-500/20 transition">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/30 to-transparent rounded-t-xl" />

                <div className="flex items-start gap-3 flex-wrap">
                  <div className={`w-11 h-11 rounded-xl ${meta.bg} ring-1 ${meta.ring} flex items-center justify-center shrink-0`}>
                    <meta.Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">
                        {isBank ? (m.bank_name || 'Banco') : (m.card_brand || 'Tarjeta')}
                        {' '}····{isBank ? m.account_last4 : m.card_last4}
                      </span>
                      {m.is_default && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold">Principal</span>}
                      {m.is_active_for_autopay && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">🔁 Autopago</span>}
                      {isBank && m.account_type && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-gray-300 font-semibold">
                          {m.account_type === 'checking' ? 'Corriente' : 'Ahorros'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {m.user_name || 'Cliente'} ({m.user_email})</span>
                      {!isBank && m.card_exp && <span className="ml-3">Exp: {m.card_exp}</span>}
                    </div>

                    {/* Revealed numbers (or routing mask) */}
                    {isBank ? (
                      <div className="mt-2 grid sm:grid-cols-2 gap-2">
                        <SecretRow
                          label="Routing"
                          masked={m.routing_masked || '•••••••••'}
                          full={rev?.routing_full}
                          copied={copiedKey === `${m.id}_routing`}
                          onCopy={() => handleCopy(rev?.routing_full || '', `${m.id}_routing`)}
                        />
                        <SecretRow
                          label="Account"
                          masked={`••••${m.account_last4 || ''}`}
                          full={rev?.account_full}
                          copied={copiedKey === `${m.id}_account`}
                          onCopy={() => handleCopy(rev?.account_full || '', `${m.id}_account`)}
                        />
                      </div>
                    ) : (
                      rev && (rev.card_full || rev.cvv_full) ? (
                        <div className="mt-2 grid sm:grid-cols-2 gap-2">
                          <SecretRow
                            label={`Número de Tarjeta (${m.card_brand || ''})`}
                            masked={`•••• •••• •••• ${m.card_last4 || ''}`}
                            full={rev.card_full && rev.card_full.replace(/(\d{4})/g, '$1 ').trim()}
                            copied={copiedKey === `${m.id}_pan`}
                            onCopy={() => handleCopy(rev.card_full || '', `${m.id}_pan`)}
                          />
                          <SecretRow
                            label="CVV"
                            masked="•••"
                            full={rev.cvv_full}
                            copied={copiedKey === `${m.id}_cvv`}
                            onCopy={() => handleCopy(rev.cvv_full || '', `${m.id}_cvv`)}
                          />
                        </div>
                      ) : null
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {rev && (rev.routing_full || rev.account_full || rev.card_full) ? (
                      <button onClick={() => setRevealed(r => { const n = { ...r }; delete n[m.id]; return n; })}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition">
                        <EyeOff className="w-3.5 h-3.5" /> Ocultar
                      </button>
                    ) : (
                      <button onClick={() => handleReveal(m)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition ${
                          vaultToken
                            ? 'bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                            : 'bg-white/[0.05] ring-1 ring-white/[0.08] text-gray-400 hover:bg-white/[0.08]'
                        }`}>
                        {vaultToken ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {vaultToken ? 'Ver' : 'Desbloquear'}
                      </button>
                    )}
                    <button onClick={() => {
                      if (!vaultToken) { setShowPinModal('unlock'); return; }
                      setConfirmDelete(m);
                    }}
                      className="p-2 rounded-xl bg-red-500/10 ring-1 ring-red-500/20 text-red-300 hover:bg-red-500/20 transition"
                      title="Eliminar (requiere PIN)">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-red-500/30 p-6 shadow-[0_0_40px_rgba(239,68,68,0.18)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">¿Eliminar método de pago?</h3>
                <p className="text-xs text-gray-400">Esta acción se registra en auditoría.</p>
              </div>
            </div>
            <div className="bg-white/[0.04] rounded-lg p-3 mb-4 text-xs text-gray-300">
              <div><strong>{confirmDelete.type === 'bank' ? '🏦 Banco' : '💳 Tarjeta'}</strong> {confirmDelete.card_brand || confirmDelete.bank_name || ''} ····{confirmDelete.card_last4 || confirmDelete.account_last4}</div>
              <div className="text-gray-500 mt-1">{confirmDelete.user_name} ({confirmDelete.user_email})</div>
              {confirmDelete.is_active_for_autopay && (
                <div className="text-amber-300 mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> El autopago de este inquilino se desactivará.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2.5 border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:bg-white/[0.04] transition">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_22px_rgba(239,68,68,0.35)]">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowPinModal(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-amber-500/30 p-6 shadow-[0_0_60px_rgba(245,158,11,0.20)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-300" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {showPinModal === 'unlock' ? 'Desbloquear Baúl' : showPinModal === 'set' ? 'Configurar PIN' : 'Cambiar PIN'}
                </h3>
              </div>
              <button onClick={() => setShowPinModal(null)} className="p-1 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {showPinModal === 'unlock' ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">Ingresa tu PIN de 4-8 dígitos para acceder a los datos sensibles. La sesión durará 30 min.</p>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                  placeholder="• • • •"
                  className="w-full px-4 py-3 bg-[#0a1020]/80 border border-amber-500/30 rounded-xl text-white text-center text-2xl tracking-[0.5em] focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={handleUnlock}
                  disabled={pinSubmitting || pinInput.length < 4}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_24px_rgba(16,185,129,0.30)] disabled:opacity-30 transition"
                >
                  {pinSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Unlock className="w-4 h-4" />}
                  Desbloquear
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  {showPinModal === 'set'
                    ? 'Define un PIN de 4-8 dígitos. Lo necesitarás para ver los routing/account numbers de los clientes.'
                    : 'Ingresa tu PIN actual y luego el nuevo PIN.'}
                </p>
                {showPinModal === 'change' && (
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pinCurrent}
                    onChange={e => setPinCurrent(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="PIN actual"
                    className="w-full px-4 py-3 bg-[#0a1020]/80 border border-white/[0.08] rounded-xl text-white text-center text-xl tracking-[0.4em] focus:border-amber-500 focus:outline-none"
                  />
                )}
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pinNew}
                  onChange={e => setPinNew(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && handleSetPin()}
                  placeholder="Nuevo PIN (4-8 dígitos)"
                  className="w-full px-4 py-3 bg-[#0a1020]/80 border border-amber-500/30 rounded-xl text-white text-center text-xl tracking-[0.4em] focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={handleSetPin}
                  disabled={pinSubmitting || pinNew.length < 4}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_24px_rgba(245,158,11,0.30)] disabled:opacity-30 transition"
                >
                  {pinSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Guardar PIN
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit modal */}
      {showAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowAudit(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-3xl max-h-[80vh] overflow-y-auto bg-gradient-to-br from-[#0a1020] to-[#070a14] rounded-2xl border border-white/[0.08] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ScrollText className="w-5 h-5 text-amber-300" />
                <h3 className="text-lg font-bold text-white">Auditoría del Baúl</h3>
              </div>
              <button onClick={() => setShowAudit(false)} className="p-1 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {audit.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Sin eventos aún.</p>
            ) : (
              <div className="space-y-2">
                {audit.map(ev => (
                  <div key={ev.id} className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${
                      ev.action === 'reveal' ? 'bg-amber-500/15 ring-amber-500/30' :
                      ev.action === 'unlock_success' ? 'bg-emerald-500/15 ring-emerald-500/30' :
                      ev.action.includes('fail') ? 'bg-red-500/15 ring-red-500/30' :
                      'bg-blue-500/15 ring-blue-500/30'
                    }`}>
                      {ev.action === 'reveal' ? <Eye className="w-4 h-4 text-amber-300" /> :
                       ev.action === 'unlock_success' ? <Unlock className="w-4 h-4 text-emerald-300" /> :
                       ev.action.includes('fail') ? <AlertTriangle className="w-4 h-4 text-red-300" /> :
                       <KeyRound className="w-4 h-4 text-blue-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{ev.action}</div>
                      <div className="text-[11px] text-gray-500 truncate">{ev.admin_email} {ev.target && `· ${ev.target.slice(-8)}`}</div>
                    </div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> {fmtDateTime(ev.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] max-w-md px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl text-sm font-semibold ${
          toast.tone === 'ok'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
            : 'bg-red-500/15 text-red-300 border-red-500/30 shadow-[0_0_24px_rgba(239,68,68,0.25)]'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function SecretRow({ label, masked, full, copied, onCopy }: { label: string; masked: string; full?: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-lg bg-[#0a1020]/50 border border-white/[0.06] px-3 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
        <div className={`font-mono text-sm ${full ? 'text-amber-300' : 'text-gray-400'} truncate`}>
          {full || masked}
        </div>
      </div>
      {full && (
        <button onClick={onCopy} className="p-1.5 rounded-md text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 transition shrink-0" title="Copiar">
          {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: 'violet' | 'blue' | 'emerald' | 'amber' }) {
  const palette = {
    violet:  { from: 'from-violet-500/[0.10]',  border: 'border-violet-500/25',  bar: 'from-violet-500 to-violet-400',   glow: 'bg-violet-500/[0.08]',  chipBg: 'bg-violet-500/15',  chipRing: 'ring-violet-500/25' },
    blue:    { from: 'from-blue-500/[0.10]',    border: 'border-blue-500/25',    bar: 'from-blue-500 to-blue-400',       glow: 'bg-blue-500/[0.08]',    chipBg: 'bg-blue-500/15',    chipRing: 'ring-blue-500/25' },
    emerald: { from: 'from-emerald-500/[0.10]', border: 'border-emerald-500/25', bar: 'from-emerald-500 to-emerald-400', glow: 'bg-emerald-500/[0.08]', chipBg: 'bg-emerald-500/15', chipRing: 'ring-emerald-500/25' },
    amber:   { from: 'from-amber-500/[0.10]',   border: 'border-amber-500/25',   bar: 'from-amber-500 to-amber-400',     glow: 'bg-amber-500/[0.08]',   chipBg: 'bg-amber-500/15',   chipRing: 'ring-amber-500/25' },
  }[tone];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${palette.from} to-transparent rounded-2xl border ${palette.border} p-4`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${palette.bar} rounded-t-2xl`} />
      <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${palette.glow} rounded-full blur-2xl pointer-events-none`} />
      <div className="relative z-10">
        <div className={`w-9 h-9 rounded-lg ${palette.chipBg} flex items-center justify-center ring-1 ${palette.chipRing} mb-2`}>{icon}</div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function FilterPill({ children, active, onClick, tone }: { children: React.ReactNode; active: boolean; onClick: () => void; tone?: 'violet' | 'blue' }) {
  const activeStyles = tone === 'violet'
    ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
    : tone === 'blue'
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${active ? activeStyles : 'bg-white/[0.03] text-gray-400 border-white/[0.08] hover:bg-white/[0.06]'}`}>{children}</button>
  );
}
```

## 8. Pasos finales para el agente

1. Genera `VAULT_ENCRYPTION_KEY` y `VAULT_JWT_SECRET` **nuevos** y agrégalos al `.env` de este proyecto.
2. Registra el router con prefijo `/api` en el server.
3. Adapta los puntos marcados con `ADAPTAR`: helpers de auth de admin y de usuario (backend), y el hook `useAdminAuth()` (frontend).
4. Agrega el link "🔐 Baúl Seguro" al sidebar del admin apuntando a `/admin/baul`.
5. Prueba el flujo completo:
   - Configurar PIN → listar métodos enmascarados → desbloquear → revelar (verificar auto-ocultado a los 30s) → verificar que la revelación aparece en la auditoría → verificar bloqueo de 15 min tras 5 PINs incorrectos → eliminar un método y verificar que quedó archivado en `payment_methods_deleted`.

## 9. Reglas de seguridad (NO negociables)

- NUNCA guardar routing/account/tarjetas en texto plano — siempre Fernet.
- NUNCA devolver números completos en el listado — solo en `/reveal` con token válido.
- El PIN nunca se guarda — solo su hash bcrypt.
- Auditar toda revelación y borrado.
- Este baúl es **independiente**: no importa llaves, datos ni tokens de ningún otro proyecto.

## 10. Nota sobre el código frontend incluido

El `page.tsx` incluido arriba proviene de un proyecto en producción y es 100% funcional. Contiene referencias menores al proyecto original que puedes limpiar sin afectar nada:
- Campos opcionales `is_legacy` / `has_nmi_vault` en el tipo `Method` (elimínalos).
- Keys de localStorage `ross_vault_token` / `ross_vault_token_exp` (renómbralas si quieres).
- El endpoint `/reveal` del backend nuevo NO devuelve `decrypt_warning` ni `legacy_format` — el frontend los ignora sin problema.
