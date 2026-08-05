"""
═══════════════════════════════════════════════════════════════════════════════
 Automated Collections Service — Ross Lending Solutions LLC
 Auto-sends SMS/Email reminders before & after payment due dates.
 Configurable triggers by days relative to due date.
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request, Query, Body
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

auto_collections_router = APIRouter()
_db = None
_get_current_user = None

REMINDER_CONFIG_COL = "collection_reminder_config"
REMINDER_LOG_COL = "collection_reminder_log"

# Default reminder schedule
DEFAULT_REMINDERS = [
    {
        "name": "Recordatorio 5 días antes",
        "trigger_days": -5,
        "trigger_type": "before_due",
        "channels": ["sms", "push"],
        "active": True,
        "sms_template": "Hola {name}, te recordamos que tu pago de {amount} vence el {due_date}. Puedes pagar desde tu app Ross Lending. Gracias.",
        "email_subject": "Recordatorio de Pago — Ross Lending",
        "email_template": "reminder_before",
        "push_title": "📅 Pago Próximo",
        "push_body": "Tu pago de {amount} vence el {due_date}",
    },
    {
        "name": "Recordatorio 1 día antes",
        "trigger_days": -1,
        "trigger_type": "before_due",
        "channels": ["sms", "push"],
        "active": True,
        "sms_template": "Hola {name}, mañana vence tu pago de {amount}. Evita cargos por mora pagando hoy. App: Ross Lending.",
        "email_subject": "Tu Pago Vence Mañana",
        "email_template": "reminder_tomorrow",
        "push_title": "⚠️ Pago Mañana",
        "push_body": "Tu pago de {amount} vence mañana. Paga ahora para evitar cargos.",
    },
    {
        "name": "Día de vencimiento",
        "trigger_days": 0,
        "trigger_type": "due_date",
        "channels": ["sms", "push"],
        "active": True,
        "sms_template": "Hola {name}, hoy vence tu pago de {amount}. Paga ahora para mantener tu cuenta al corriente. Ross Lending.",
        "email_subject": "Pago Vence Hoy",
        "email_template": "reminder_today",
        "push_title": "🔔 Pago Vence Hoy",
        "push_body": "Tu pago de {amount} vence hoy",
    },
    {
        "name": "1 día de mora",
        "trigger_days": 1,
        "trigger_type": "after_due",
        "channels": ["sms", "email", "push"],
        "active": True,
        "sms_template": "Hola {name}, tu pago de {amount} está vencido desde ayer. Paga hoy para evitar cargos adicionales. Ross Lending.",
        "email_subject": "⚠️ Pago Vencido — Acción Requerida",
        "email_template": "late_notice_1",
        "push_title": "⚠️ Pago Vencido",
        "push_body": "Tu pago está 1 día vencido. Paga ahora.",
    },
    {
        "name": "7 días de mora",
        "trigger_days": 7,
        "trigger_type": "after_due",
        "channels": ["sms", "email", "push"],
        "active": True,
        "sms_template": "AVISO: {name}, tu pago de {amount} tiene 7 días de atraso. Contacta a Ross Lending al (713) XXX-XXXX para evitar acciones adicionales.",
        "email_subject": "🔴 Aviso de Mora — 7 Días",
        "email_template": "late_notice_7",
        "push_title": "🔴 7 Días de Mora",
        "push_body": "Tu cuenta tiene 7 días de atraso. Contáctanos.",
    },
    {
        "name": "15 días de mora",
        "trigger_days": 15,
        "trigger_type": "after_due",
        "channels": ["sms", "email"],
        "active": True,
        "sms_template": "URGENTE: {name}, tu cuenta con Ross Lending tiene 15 días de atraso ({amount}). Llama al (713) XXX-XXXX para establecer un plan de pago.",
        "email_subject": "🚨 Aviso Urgente de Mora — 15 Días",
        "email_template": "late_notice_15",
        "push_title": "🚨 15 Días de Mora",
        "push_body": "Contacta a Ross Lending para evitar acciones legales.",
    },
    {
        "name": "30 días de mora",
        "trigger_days": 30,
        "trigger_type": "after_due",
        "channels": ["sms", "email"],
        "active": True,
        "sms_template": "AVISO FINAL: {name}, tu cuenta con Ross Lending está severamente atrasada (30+ días). Se reportará a bureaus de crédito. Llama AHORA.",
        "email_subject": "⛔ Aviso Final — 30 Días de Mora",
        "email_template": "late_notice_30",
        "push_title": "⛔ 30 Días de Mora",
        "push_body": "Tu cuenta será reportada a bureaus de crédito.",
    },
]


def init_auto_collections(db_instance, get_user_func):
    global _db, _get_current_user
    _db = db_instance
    _get_current_user = get_user_func
    logger.info("Automated Collections Service initialized")


async def _auth_admin(request: Request):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "") if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(401, "No autorizado")
    user = await _get_current_user(token)
    if not user or user.get("role") not in ["admin", "office_assistant"]:
        raise HTTPException(403, "Acceso denegado")
    return user


def _fill_template(template: str, loan: dict) -> str:
    """Fill template variables with loan data."""
    name = loan.get("client_name", "Cliente")
    amount = f"${loan.get('payment_amount', 0):,.2f}"
    balance = f"${loan.get('balance', 0):,.2f}"
    due_date = loan.get("next_payment_date", "")
    if due_date:
        try:
            dt = datetime.fromisoformat(str(due_date).replace("Z", ""))
            due_date = dt.strftime("%d/%m/%Y")
        except Exception:
            pass
    loan_number = loan.get("loan_number", "")

    return template.format(
        name=name, amount=amount, balance=balance,
        due_date=due_date, loan_number=loan_number,
    )


async def _send_sms(phone: str, message: str):
    """Send SMS via Twilio."""
    try:
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_PHONE_NUMBER")

        if not all([account_sid, auth_token, from_number]):
            logger.warning("Twilio not configured, skipping SMS")
            return False

        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        client.messages.create(body=message, from_=from_number, to=phone)
        return True
    except Exception as e:
        logger.error(f"SMS error: {e}")
        return False


async def _send_push(user_email: str, title: str, body: str, db):
    """Send push notification via Expo Push."""
    try:
        user = await db["users"].find_one({"email": user_email})
        if not user or not user.get("push_token"):
            return False
        import httpx
        async with httpx.AsyncClient() as client:
            await client.post("https://exp.host/--/api/v2/push/send", json={
                "to": user["push_token"],
                "title": title,
                "body": body,
                "sound": "default",
            })
        return True
    except Exception as e:
        logger.error(f"Push error: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@auto_collections_router.get("/admin/auto-collections/config")
async def get_reminder_config(request: Request):
    """Get all reminder configurations."""
    await _auth_admin(request)
    db = _db

    configs = []
    async for c in db[REMINDER_CONFIG_COL].find().sort("trigger_days", 1):
        c["_id"] = str(c["_id"])
        configs.append(c)

    # Seed defaults if empty
    if not configs:
        for reminder in DEFAULT_REMINDERS:
            reminder["created_at"] = datetime.utcnow().isoformat()
            await db[REMINDER_CONFIG_COL].insert_one(reminder)
        configs = []
        async for c in db[REMINDER_CONFIG_COL].find().sort("trigger_days", 1):
            c["_id"] = str(c["_id"])
            configs.append(c)

    return {"reminders": configs, "total": len(configs)}


@auto_collections_router.post("/admin/auto-collections/config")
async def create_reminder(request: Request, body: dict = Body(...)):
    """Create a new reminder configuration."""
    admin = await _auth_admin(request)
    db = _db

    reminder = {
        "name": body.get("name", ""),
        "trigger_days": body.get("trigger_days", 0),
        "trigger_type": body.get("trigger_type", "before_due"),
        "channels": body.get("channels", ["sms"]),
        "active": body.get("active", True),
        "sms_template": body.get("sms_template", ""),
        "email_subject": body.get("email_subject", ""),
        "email_template": body.get("email_template", ""),
        "push_title": body.get("push_title", ""),
        "push_body": body.get("push_body", ""),
        "created_at": datetime.utcnow().isoformat(),
        "created_by": admin.get("email", ""),
    }

    result = await db[REMINDER_CONFIG_COL].insert_one(reminder)
    reminder["_id"] = str(result.inserted_id)
    return {"success": True, "reminder": reminder}


@auto_collections_router.put("/admin/auto-collections/config/{config_id}")
async def update_reminder(request: Request, config_id: str, body: dict = Body(...)):
    """Update a reminder configuration."""
    admin = await _auth_admin(request)
    db = _db

    update = {}
    for field in ["name", "trigger_days", "trigger_type", "channels", "active",
                   "sms_template", "email_subject", "email_template",
                   "push_title", "push_body"]:
        if field in body:
            update[field] = body[field]

    update["updated_at"] = datetime.utcnow().isoformat()
    update["updated_by"] = admin.get("email", "")

    try:
        result = await db[REMINDER_CONFIG_COL].update_one(
            {"_id": ObjectId(config_id)}, {"$set": update}
        )
    except Exception:
        raise HTTPException(400, "ID inválido")

    if result.modified_count == 0:
        raise HTTPException(404, "Configuración no encontrada")

    return {"success": True, "message": "Configuración actualizada"}


@auto_collections_router.delete("/admin/auto-collections/config/{config_id}")
async def delete_reminder(request: Request, config_id: str):
    """Delete a reminder configuration."""
    await _auth_admin(request)
    db = _db
    try:
        await db[REMINDER_CONFIG_COL].delete_one({"_id": ObjectId(config_id)})
    except Exception:
        raise HTTPException(400, "ID inválido")
    return {"success": True}


@auto_collections_router.post("/admin/auto-collections/run")
async def run_reminders_manual(request: Request):
    """Manually trigger the reminder engine (checks all loans and sends due notifications)."""
    admin = await _auth_admin(request)
    db = _db
    now = datetime.utcnow()

    # Get active configs
    configs = []
    async for c in db[REMINDER_CONFIG_COL].find({"active": True}).sort("trigger_days", 1):
        c["_id"] = str(c["_id"])
        configs.append(c)

    if not configs:
        return {"success": True, "message": "No hay recordatorios activos configurados", "sent": 0}

    # Get all active/delinquent loans
    loans = []
    async for loan in db["regulated_loans"].find({"status": {"$in": ["active", "disbursed", "delinquent"]}}):
        loan["_id"] = str(loan["_id"])
        loans.append(loan)

    total_sent = 0
    results = []

    for loan in loans:
        npd_str = loan.get("next_payment_date", "")
        if not npd_str:
            continue

        try:
            npd = datetime.fromisoformat(str(npd_str).replace("Z", ""))
        except Exception:
            continue

        days_diff = (now - npd).days  # positive = overdue, negative = upcoming

        for config in configs:
            trigger_days = config.get("trigger_days", 0)

            # Check if this trigger matches today
            if trigger_days < 0:
                # Before due: trigger_days=-5 means 5 days before due
                target_date = npd + timedelta(days=trigger_days)
                should_trigger = target_date.date() == now.date()
            elif trigger_days == 0:
                should_trigger = npd.date() == now.date()
            else:
                # After due: trigger_days=7 means 7 days after due
                target_date = npd + timedelta(days=trigger_days)
                should_trigger = target_date.date() == now.date()

            if not should_trigger:
                continue

            # Check if already sent today for this loan + config
            already_sent = await db[REMINDER_LOG_COL].find_one({
                "loan_id": loan["_id"],
                "config_name": config.get("name"),
                "sent_date": now.strftime("%Y-%m-%d"),
            })
            if already_sent:
                continue

            # Send notifications
            channels = config.get("channels", [])
            sent_channels = []

            phone = loan.get("client_phone", "")
            email = loan.get("client_email", "")

            if "sms" in channels and phone:
                sms_text = _fill_template(config.get("sms_template", ""), loan)
                success = await _send_sms(phone, sms_text)
                if success:
                    sent_channels.append("sms")

            if "push" in channels and email:
                push_title = _fill_template(config.get("push_title", ""), loan)
                push_body = _fill_template(config.get("push_body", ""), loan)
                success = await _send_push(email, push_title, push_body, db)
                if success:
                    sent_channels.append("push")

            if "email" in channels and email:
                # Email sending via SendGrid
                try:
                    from email_sender import send_template_email
                    await send_template_email(
                        config.get("email_template", "payment_reminder"),
                        email,
                        {
                            "client_name": loan.get("client_name", ""),
                            "amount": f"${loan.get('payment_amount', 0):,.2f}",
                            "due_date": npd.strftime("%d/%m/%Y"),
                            "loan_number": loan.get("loan_number", ""),
                        }
                    )
                    sent_channels.append("email")
                except Exception as e:
                    logger.error(f"Email send error: {e}")

            # Log the reminder
            if sent_channels:
                log_entry = {
                    "loan_id": loan["_id"],
                    "loan_number": loan.get("loan_number", ""),
                    "client_name": loan.get("client_name", ""),
                    "client_phone": phone,
                    "client_email": email,
                    "config_name": config.get("name"),
                    "trigger_days": trigger_days,
                    "channels_sent": sent_channels,
                    "sent_date": now.strftime("%Y-%m-%d"),
                    "sent_at": now.isoformat(),
                    "triggered_by": admin.get("email", "manual"),
                }
                await db[REMINDER_LOG_COL].insert_one(log_entry)
                total_sent += 1
                results.append({
                    "client": loan.get("client_name"),
                    "loan": loan.get("loan_number"),
                    "reminder": config.get("name"),
                    "channels": sent_channels,
                })

    return {
        "success": True,
        "message": f"Proceso completado. {total_sent} recordatorios enviados.",
        "sent": total_sent,
        "details": results,
    }


@auto_collections_router.get("/admin/auto-collections/log")
async def reminder_log(request: Request, limit: int = Query(50)):
    """Get reminder sending log."""
    await _auth_admin(request)
    db = _db

    logs = []
    async for entry in db[REMINDER_LOG_COL].find().sort("sent_at", -1).limit(limit):
        entry["_id"] = str(entry["_id"])
        logs.append(entry)

    # Stats
    today = datetime.utcnow().strftime("%Y-%m-%d")
    sent_today = await db[REMINDER_LOG_COL].count_documents({"sent_date": today})
    total_ever = await db[REMINDER_LOG_COL].count_documents({})

    return {
        "logs": logs,
        "total": len(logs),
        "stats": {
            "sent_today": sent_today,
            "total_ever": total_ever,
        },
    }
