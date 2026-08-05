"""
Email Processing Engine
Handles:
- Sent email logging
- Auto-processing incoming emails with AI
- Appointment scheduling via email conversations
- SMS notifications via Twilio
- Service order creation
"""
import asyncio
import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)

_db = None


def init_email_engine(db):
    global _db
    _db = db
    logger.info("✅ Email Engine initialized")


# ═══════════════════════════════════════════════
# PHASE 1: Sent Email Logging
# ═══════════════════════════════════════════════

async def log_sent_email(
    to_email: str,
    subject: str,
    html_body: str,
    from_email: str = None,
    from_name: str = "Ross Tax Preparation",
    category: str = "general",
    related_to: str = None,
    client_id: str = None,
    attachments: list = None,
):
    """Log every outgoing email to sent_emails collection."""
    if _db is None:
        return None

    record = {
        "id": str(uuid.uuid4()),
        "to_email": to_email,
        "from_email": from_email or os.getenv("SENDGRID_FROM_EMAIL", "info@rosstaxpreparation.com"),
        "from_name": from_name,
        "subject": subject,
        "html_body": html_body,
        "category": category,
        "related_to": related_to,
        "client_id": client_id,
        "has_attachments": bool(attachments),
        "attachment_names": [a.get("filename", "") for a in (attachments or [])],
        "status": "sent",
        "sent_at": datetime.now(timezone.utc),
    }

    try:
        await _db.sent_emails.insert_one(record)
        return record["id"]
    except Exception as e:
        logger.error(f"Error logging sent email: {e}")
        return None


async def get_sent_emails(
    limit: int = 20,
    skip: int = 0,
    category: str = None,
    search: str = None,
):
    """Get sent emails with optional filters."""
    if _db is None:
        return {"emails": [], "total": 0}

    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"to_email": {"$regex": search, "$options": "i"}},
            {"subject": {"$regex": search, "$options": "i"}},
            {"from_name": {"$regex": search, "$options": "i"}},
        ]

    total = await _db.sent_emails.count_documents(query)
    emails = await _db.sent_emails.find(
        query, {"html_body": 0}
    ).sort("sent_at", -1).skip(skip).limit(limit).to_list(limit)

    for e in emails:
        e["_id"] = str(e["_id"])

    return {"emails": emails, "total": total}


async def get_sent_email_detail(email_id: str):
    """Get full detail of a sent email including HTML body."""
    if _db is None:
        return None
    email = await _db.sent_emails.find_one({"id": email_id})
    if email:
        email["_id"] = str(email["_id"])
    return email


# ═══════════════════════════════════════════════
# PHASE 2: Incoming Email AI Processing
# ═══════════════════════════════════════════════

async def find_or_create_client(sender_email: str, sender_name: str):
    """Find existing client or create a new one from email sender."""
    if _db is None:
        return None, False

    # Search in users
    client = await _db.users.find_one(
        {"email": {"$regex": f"^{re.escape(sender_email)}$", "$options": "i"}}
    )
    if client:
        client["_id"] = str(client["_id"])
        return client, False

    # Search in season_clients
    season = await _db.season_clients.find_one(
        {"email": {"$regex": f"^{re.escape(sender_email)}$", "$options": "i"}}
    )
    if season:
        season["_id"] = str(season["_id"])
        return season, False

    # Create new client
    from auth_helpers import hash_password
    temp_password = f"Ross{uuid.uuid4().hex[:6]}!"
    new_id = str(uuid.uuid4())

    new_user = {
        "id": new_id,
        "email": sender_email.lower().strip(),
        "name": sender_name or sender_email.split("@")[0],
        "password_hash": hash_password(temp_password),
        "role": "client",
        "phone": "",
        "created_at": datetime.now(timezone.utc),
        "source": "email_auto",
        "temp_password": temp_password,
    }

    result = await _db.users.insert_one(new_user)
    new_user["_id"] = str(result.inserted_id)
    return new_user, True


async def get_available_slots(days_ahead: int = 5) -> List[Dict]:
    """Get available appointment slots for the next N business days."""
    if _db is None:
        return []

    config = await _db.availability_config.find_one({})

    default_schedule = {
        "monday": [("10:00", "14:30")],
        "tuesday": [("10:00", "14:30")],
        "wednesday": [("10:00", "14:30")],
        "thursday": [("10:00", "14:30")],
        "friday": [("10:00", "14:30")],
    }

    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    slot_duration = 30

    if config and config.get("weekly_schedule"):
        schedule = {}
        for day_cfg in config["weekly_schedule"]:
            if day_cfg.get("enabled") and day_cfg.get("slots"):
                day = day_cfg["day"]
                schedule[day] = [(s["start_time"], s["end_time"]) for s in day_cfg["slots"]]
        slot_duration = config.get("slot_duration_minutes", 30)
    else:
        schedule = default_schedule

    blocked_dates = set()
    if config and config.get("blocked_dates"):
        blocked_dates = set(config["blocked_dates"])

    available = []
    now = datetime.now(timezone.utc) - timedelta(hours=5)  # CDT offset
    current_date = now.date() + timedelta(days=1)

    days_checked = 0
    while len(available) < days_ahead * 4 and days_checked < 14:
        date_str = current_date.isoformat()
        day_name = day_names[current_date.weekday()]

        if date_str not in blocked_dates and day_name in schedule:
            for start_str, end_str in schedule[day_name]:
                start_h, start_m = map(int, start_str.split(":"))
                end_h, end_m = map(int, end_str.split(":"))

                slot_time = datetime(current_date.year, current_date.month, current_date.day, start_h, start_m)
                end_time = datetime(current_date.year, current_date.month, current_date.day, end_h, end_m)

                while slot_time + timedelta(minutes=slot_duration) <= end_time:
                    slot_dt = slot_time.replace(tzinfo=timezone.utc)
                    existing = await _db.appointments.find_one({
                        "scheduled_at": {
                            "$gte": slot_dt - timedelta(minutes=5),
                            "$lte": slot_dt + timedelta(minutes=5)
                        },
                        "status": {"$ne": "cancelled"}
                    })

                    if not existing:
                        available.append({
                            "date": date_str,
                            "time": slot_time.strftime("%I:%M %p"),
                            "time_24h": slot_time.strftime("%H:%M"),
                            "datetime_iso": slot_dt.isoformat(),
                            "day_name_es": {
                                "monday": "Lunes", "tuesday": "Martes", "wednesday": "Miércoles",
                                "thursday": "Jueves", "friday": "Viernes", "saturday": "Sábado",
                                "sunday": "Domingo"
                            }.get(day_name, day_name),
                        })

                    slot_time += timedelta(minutes=slot_duration)

        current_date += timedelta(days=1)
        days_checked += 1

    return available[:20]


def _build_slots_email_html(client_name: str, slots: List[Dict]) -> str:
    """Build the HTML email for available appointment slots."""
    from utils import MESES_ES

    by_date = {}
    for s in slots:
        d = s["date"]
        if d not in by_date:
            by_date[d] = {"day_name": s["day_name_es"], "times": []}
        by_date[d]["times"].append(s["time"])

    slots_html = ""
    for date_str, info in list(by_date.items())[:5]:
        parts = date_str.split("-")
        month = MESES_ES.get(int(parts[1]), "")
        day = int(parts[2])
        date_label = f"{info['day_name']} {day} de {month}"

        times_html = "".join(
            f'<span style="display:inline-block;background:#ffffff;border:1px solid #dc2626;color:#dc2626;padding:6px 14px;border-radius:20px;margin:4px;font-size:13px;font-weight:600;">{t}</span>'
            for t in info["times"][:6]
        )

        slots_html += f"""
        <div style="margin-bottom:16px;background:#f8fafc;border-radius:10px;padding:16px;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;font-weight:700;color:#1e293b;font-size:15px;">{date_label}</p>
            <div>{times_html}</div>
        </div>"""

    year = datetime.now().year
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <div style="background:#1a1a2e;padding:32px 30px 28px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">ROSS TAX PREPARATION</h1>
            <div style="width:50px;height:3px;background:#dc2626;margin:12px auto 0;border-radius:2px;"></div>
        </div>
        <div style="background:#059669;padding:12px 30px;text-align:center;">
            <p style="color:#ffffff;margin:0;font-size:13px;font-weight:600;">📅 HORARIOS DISPONIBLES PARA TU CITA</p>
        </div>
        <div style="padding:30px;">
            <p style="font-size:18px;color:#1e293b;margin:0 0 6px;font-weight:700;">Hola {client_name},</p>
            <p style="font-size:15px;color:#475569;line-height:1.7;margin:12px 0 20px;">
                Recibimos tu solicitud de cita. Aquí están los horarios disponibles — 
                <strong>responde a este email</strong> con el día y hora que prefieras:
            </p>
            {slots_html}
            <div style="margin-top:24px;background:#fffbeb;border-radius:10px;padding:16px;border:1px solid #fbbf24;">
                <p style="margin:0;color:#92400e;font-size:14px;">
                    <strong>📝 Responde a este email</strong> indicando el día y hora que te convenga, 
                    o llámanos al <a href="tel:+18069342018" style="color:#dc2626;font-weight:700;">(806) 934-2018</a>
                </p>
            </div>
            <div style="margin-top:20px;text-align:center;">
                <a href="https://wa.me/18069342018?text=Hola%20quiero%20agendar%20una%20cita" style="display:inline-block;background:#25D366;color:#ffffff;padding:12px 30px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">💬 Agendar por WhatsApp</a>
            </div>
        </div>
        <div style="background:#1a1a2e;padding:24px 30px;text-align:center;">
            <p style="color:#ffffff;margin:0 0 4px;font-size:14px;font-weight:700;">ROSS TAX PREPARATION</p>
            <div style="width:30px;height:2px;background:#dc2626;margin:8px auto;border-radius:2px;"></div>
            <p style="color:#64748b;margin:8px 0 0;font-size:11px;">305 Bruce Ave, Dumas, TX 79029<br>&copy; {year} Ross Tax Preparation LLC</p>
        </div>
    </div>"""
    return html


async def send_available_slots_email(
    to_email: str,
    client_name: str,
    slots: List[Dict],
):
    """Send email with available appointment slots to client."""
    import sendgrid
    from sendgrid.helpers.mail import Mail, Email, To, Content

    SG_KEY = os.getenv("SENDGRID_API_KEY", "")
    if not SG_KEY:
        return False

    html = _build_slots_email_html(client_name, slots)

    try:
        sg = sendgrid.SendGridAPIClient(api_key=SG_KEY)
        msg = Mail(
            from_email=Email("info@rosstaxpreparation.com", "Ross Tax Preparation"),
            to_emails=To(to_email),
            subject="📅 Horarios disponibles para tu cita — Ross Tax Preparation",
            html_content=Content("text/html", html)
        )
        sg.client.mail.send.post(request_body=msg.get())

        await log_sent_email(
            to_email=to_email,
            subject="Horarios disponibles para tu cita",
            html_body=html,
            category="appointment_slots",
            client_id=None,
        )
        return True
    except Exception as e:
        logger.error(f"Error sending slots email: {e}")
        return False


def _build_confirmation_email_html(client_name: str, appointment_date: str, appointment_time: str) -> str:
    """Build the HTML email for appointment confirmation."""
    year = datetime.now().year
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
        <div style="background:#1a1a2e;padding:32px 30px 28px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">ROSS TAX PREPARATION</h1>
            <div style="width:50px;height:3px;background:#dc2626;margin:12px auto 0;border-radius:2px;"></div>
        </div>
        <div style="background:#059669;padding:12px 30px;text-align:center;">
            <p style="color:#ffffff;margin:0;font-size:13px;font-weight:600;">✅ CITA CONFIRMADA</p>
        </div>
        <div style="padding:30px;">
            <p style="font-size:18px;color:#1e293b;margin:0 0 16px;font-weight:700;">Hola {client_name},</p>
            <p style="font-size:15px;color:#475569;line-height:1.7;">Tu cita ha sido confirmada con los siguientes detalles:</p>
            
            <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin:20px 0;border:2px solid #22c55e;text-align:center;">
                <p style="font-size:13px;color:#16a34a;margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Fecha y Hora</p>
                <p style="font-size:24px;color:#1e293b;margin:0;font-weight:800;">{appointment_date}</p>
                <p style="font-size:20px;color:#dc2626;margin:4px 0 0;font-weight:700;">{appointment_time}</p>
            </div>
            
            <div style="background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                            <span style="color:#64748b;font-size:12px;font-weight:600;">📍 DIRECCIÓN</span><br>
                            <a href="https://maps.google.com/?q=305+Bruce+Ave+Dumas+TX+79029" style="color:#1e293b;font-size:15px;text-decoration:none;">305 Bruce Ave, Dumas, TX 79029</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                            <span style="color:#64748b;font-size:12px;font-weight:600;">📞 TELÉFONO</span><br>
                            <a href="tel:+18069342018" style="color:#dc2626;font-size:15px;text-decoration:none;font-weight:700;">(806) 934-2018</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;">
                            <span style="color:#64748b;font-size:12px;font-weight:600;">📋 QUÉ LLEVAR</span><br>
                            <span style="color:#1e293b;font-size:14px;">W-2, 1099, ID con foto, SSN/ITIN, recibos</span>
                        </td>
                    </tr>
                </table>
            </div>
            
            <div style="margin-top:20px;background:#fffbeb;border-radius:10px;padding:14px;border:1px solid #fbbf24;">
                <p style="margin:0;color:#92400e;font-size:13px;">
                    <strong>¿Necesitas cambiar la cita?</strong> Responde a este email o llámanos al (806) 934-2018
                </p>
            </div>
        </div>
        <div style="background:#1a1a2e;padding:24px 30px;text-align:center;">
            <p style="color:#ffffff;margin:0 0 4px;font-size:14px;font-weight:700;">ROSS TAX PREPARATION</p>
            <div style="width:30px;height:2px;background:#dc2626;margin:8px auto;border-radius:2px;"></div>
            <p style="color:#64748b;margin:8px 0 0;font-size:11px;">&copy; {year} Ross Tax Preparation LLC — Dumas, TX</p>
        </div>
    </div>"""
    return html


async def send_appointment_confirmation(
    to_email: str,
    client_name: str,
    appointment_date: str,
    appointment_time: str,
    phone: str = None,
):
    """Send appointment confirmation via email + SMS."""
    import sendgrid
    from sendgrid.helpers.mail import Mail, Email, To, Content

    html = _build_confirmation_email_html(client_name, appointment_date, appointment_time)

    # Send Email
    try:
        SG_KEY = os.getenv("SENDGRID_API_KEY", "")
        if SG_KEY:
            sg = sendgrid.SendGridAPIClient(api_key=SG_KEY)
            msg = Mail(
                from_email=Email("info@rosstaxpreparation.com", "Ross Tax Preparation"),
                to_emails=To(to_email),
                subject=f"✅ Cita confirmada: {appointment_date} {appointment_time} — Ross Tax",
                html_content=Content("text/html", html)
            )
            sg.client.mail.send.post(request_body=msg.get())

            await log_sent_email(
                to_email=to_email,
                subject=f"Cita confirmada: {appointment_date} {appointment_time}",
                html_body=html,
                category="appointment_confirmation",
            )
    except Exception as e:
        logger.error(f"Error sending confirmation email: {e}")

    # Send SMS via Twilio
    if phone:
        await _send_sms(
            phone,
            f"✅ Ross Tax Preparation — Cita Confirmada\n\n"
            f"Hola {client_name},\n"
            f"📅 {appointment_date}\n"
            f"🕐 {appointment_time}\n"
            f"📍 305 Bruce Ave, Dumas, TX 79029\n\n"
            f"📋 Llevar: W-2, 1099, ID, SSN/ITIN\n"
            f"📞 (806) 934-2018"
        )


async def _send_sms(phone: str, body: str):
    """Send SMS via Twilio."""
    try:
        from twilio.rest import Client
        twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
        twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
        twilio_from = os.getenv("TWILIO_PHONE_NUMBER")

        if twilio_sid and twilio_token and twilio_from:
            tw = Client(twilio_sid, twilio_token)
            clean_phone = re.sub(r'\D', '', phone)
            if len(clean_phone) == 10:
                clean_phone = f"+1{clean_phone}"
            elif not clean_phone.startswith("+"):
                clean_phone = f"+{clean_phone}"

            tw.messages.create(body=body, from_=twilio_from, to=clean_phone)
            logger.info(f"SMS sent to {clean_phone}")
    except Exception as e:
        logger.error(f"Error sending SMS: {e}")


# ═══════════════════════════════════════════════
# PHASE 3: AI Classification + Appointment Booking
# ═══════════════════════════════════════════════

async def _classify_email_intent(sender_name, sender_email, subject, body, has_attachments):
    """Use GPT-4o to classify email intent."""
    intent = "general"
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
        if EMERGENT_KEY:
            llm = LlmChat(
                api_key=EMERGENT_KEY,
                session_id=str(uuid.uuid4()),
                system_message="Eres un clasificador de emails para una oficina de preparación de impuestos. Clasifica el intent del email."
            )
            llm = llm.with_model("openai", "gpt-4o")

            prompt = f"""Clasifica este email recibido en una oficina de taxes:

De: {sender_name} <{sender_email}>
Asunto: {subject}
Tiene adjuntos: {'Sí' if has_attachments else 'No'}
Mensaje: {body[:500]}

Responde SOLO con una de estas palabras:
- appointment (quiere agendar cita o preguntar disponibilidad)
- documents (envía documentos fiscales W-2, 1099, etc.)
- appointment_reply (responde confirmando día/hora de cita previamente ofrecida)
- general (consulta general, pregunta, otro)
- spam (publicidad, no relevante)"""

            response = await llm.send_message(UserMessage(text=prompt))
            resp_text = str(response).strip().lower()
            for option in ["appointment_reply", "appointment", "documents", "general", "spam"]:
                if option in resp_text:
                    intent = option
                    break
    except Exception as e:
        logger.error(f"AI classification error: {e}")
        # Fallback: keyword detection
        text = f"{subject} {body}".lower()
        if any(w in text for w in ["cita", "appointment", "agendar", "schedule", "disponib", "horario"]):
            intent = "appointment"
        elif has_attachments and any(w in text for w in ["w2", "w-2", "1099", "document", "tax", "impuesto"]):
            intent = "documents"

    return intent


async def _parse_appointment_choice(body: str, available_slots: List[Dict] = None):
    """Use GPT-4o to parse which appointment slot the client chose."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        EMERGENT_KEY = os.getenv("EMERGENT_LLM_KEY", "")
        if not EMERGENT_KEY:
            return None

        slots_text = ""
        if available_slots:
            for s in available_slots:
                slots_text += f"- {s['day_name_es']} {s['date']} a las {s['time']}\n"

        llm = LlmChat(
            api_key=EMERGENT_KEY,
            session_id=str(uuid.uuid4()),
            system_message="Eres un parser de citas. Extrae la fecha y hora elegida por el cliente."
        )
        llm = llm.with_model("openai", "gpt-4o")

        prompt = f"""El cliente respondió a un email con horarios disponibles para una cita en una oficina de taxes.

Mensaje del cliente:
{body[:500]}

Horarios que se le ofrecieron:
{slots_text if slots_text else '(No disponibles, intenta deducir del mensaje)'}

Extrae la fecha y hora que el cliente eligió. Responde SOLO con JSON válido:
{{"date": "YYYY-MM-DD", "time": "HH:MM AM/PM", "time_24h": "HH:MM", "confidence": "high/medium/low"}}

Si no puedes determinar claramente, responde:
{{"date": null, "time": null, "time_24h": null, "confidence": "low"}}"""

        response = await llm.send_message(UserMessage(text=prompt))
        resp_text = str(response).strip()
        json_match = re.search(r'\{[^{}]*\}', resp_text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            if parsed.get("date") and parsed.get("confidence") != "low":
                return parsed
    except Exception as e:
        logger.error(f"Error parsing appointment choice: {e}")

    return None


async def _book_appointment(client: dict, date_str: str, time_str: str, time_24h: str):
    """Book an appointment in the DB."""
    if _db is None:
        return None

    try:
        # Parse the date and time
        h, m = map(int, time_24h.split(":"))
        year, month, day = map(int, date_str.split("-"))
        scheduled_dt = datetime(year, month, day, h, m, tzinfo=timezone.utc)

        # Check if slot is still available
        existing = await _db.appointments.find_one({
            "scheduled_at": {
                "$gte": scheduled_dt - timedelta(minutes=5),
                "$lte": scheduled_dt + timedelta(minutes=5)
            },
            "status": {"$ne": "cancelled"}
        })
        if existing:
            return None  # Slot taken

        appt_id = str(uuid.uuid4())
        client_name = client.get("name", client.get("first_name", "")) 
        if not client_name and client.get("first_name"):
            client_name = f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()

        appointment = {
            "id": appt_id,
            "user_id": client.get("id", str(client.get("_id", ""))),
            "user_name": client_name or "Cliente",
            "user_email": client.get("email", ""),
            "user_phone": client.get("phone", ""),
            "title": "Preparación de Impuestos",
            "service_name": "Preparación de Impuestos",
            "date": date_str,
            "time": time_24h,
            "scheduled_at": scheduled_dt,
            "status": "confirmed",
            "type": "tax_preparation",
            "notes": "Cita agendada automáticamente vía email",
            "source": "email_ai",
            "quantity": 1,
            "attendees": [{
                "name": client_name or "Cliente",
                "phone": client.get("phone", ""),
                "email": client.get("email", ""),
                "relationship": "self"
            }],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        await _db.appointments.insert_one(appointment)
        logger.info(f"✅ Appointment booked: {appt_id} for {client_name} on {date_str} at {time_str}")
        return appointment
    except Exception as e:
        logger.error(f"Error booking appointment: {e}")
        return None


async def _create_service_order(client: dict, appointment: dict):
    """Create a service order linked to the appointment."""
    if _db is None:
        return None

    try:
        order_id = str(uuid.uuid4())
        client_name = client.get("name", client.get("first_name", "Cliente"))
        order_doc = {
            "_id": order_id,
            "order_number": f"ORD-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:8].upper()}",
            "client_id": client.get("id", str(client.get("_id", ""))),
            "client_name": client_name,
            "client_email": client.get("email"),
            "client_phone": client.get("phone", ""),
            "service_type": "tax_preparation",
            "description": f"Preparación de Impuestos — Cita {appointment.get('date', '')} {appointment.get('time', '')}",
            "tax_year": datetime.now().year,
            "status": "pending",
            "priority": "medium",
            "estimated_amount": 0,
            "notes": "Orden creada automáticamente desde solicitud por email",
            "created_by": "email_engine",
            "created_by_name": "Sistema Automático",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "appointment_id": appointment.get("id"),
            "source": "email_ai",
        }

        await _db.service_orders.insert_one(order_doc)
        logger.info(f"✅ Service order created: {order_id}")
        return order_doc
    except Exception as e:
        logger.error(f"Error creating service order: {e}")
        return None


async def process_incoming_email_ai(email_data: dict):
    """AI processes an incoming email to determine action and execute it.

    Flow:
    - appointment_request → send available slots
    - appointment_reply → parse choice → book → create profile → create order → confirm
    - document_submission → save documents to client
    - general_inquiry → forward to contact system
    """
    if _db is None:
        return {"action": "none", "reason": "DB not configured"}

    sender_email = email_data.get("from_email", "").lower().strip()
    sender_name = email_data.get("from_name", "")
    subject = email_data.get("subject", "")
    body = email_data.get("body_text", email_data.get("body", ""))
    has_attachments = bool(email_data.get("attachments", []))

    # Check if this is a reply to a slots email we sent (conversation tracking)
    is_reply_to_slots = False
    if subject and any(kw in subject.lower() for kw in ["horarios disponibles", "re: horarios", "re: 📅"]):
        is_reply_to_slots = True

    # Check conversation history
    prev_conversation = await _db.email_processing_log.find_one(
        {"sender_email": sender_email, "intent": "appointment", "action_taken.slots_sent": True},
        sort=[("processed_at", -1)]
    )
    if prev_conversation:
        is_reply_to_slots = True

    # Classify intent
    if is_reply_to_slots:
        intent = "appointment_reply"
    else:
        intent = await _classify_email_intent(sender_name, sender_email, subject, body[:500], has_attachments)

    result = {"action": intent, "sender_email": sender_email, "sender_name": sender_name}

    # ─── APPOINTMENT REQUEST ───
    if intent == "appointment":
        client, is_new = await find_or_create_client(sender_email, sender_name)
        slots = await get_available_slots(5)
        if slots:
            sent = await send_available_slots_email(sender_email, sender_name or "Cliente", slots)
            result["slots_sent"] = sent
            result["slots_count"] = len(slots)
        result["client_created"] = is_new
        result["client_id"] = client.get("_id") if client else None

    # ─── APPOINTMENT REPLY (client chose a slot) ───
    elif intent == "appointment_reply":
        client, is_new = await find_or_create_client(sender_email, sender_name)
        result["client_created"] = is_new
        result["client_id"] = client.get("_id") if client else None

        # Get recently offered slots
        recent_slots = await get_available_slots(5)
        
        # Parse the chosen slot
        parsed = await _parse_appointment_choice(body[:500], recent_slots)

        if parsed and parsed.get("date"):
            date_str = parsed["date"]
            time_str = parsed.get("time", "")
            time_24h = parsed.get("time_24h", "10:00")

            # Book the appointment
            appointment = await _book_appointment(client, date_str, time_str, time_24h)

            if appointment:
                # Format date for display
                from utils import MESES_ES
                parts = date_str.split("-")
                month_name = MESES_ES.get(int(parts[1]), "")
                day_names_es = {
                    0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
                    4: "Viernes", 5: "Sábado", 6: "Domingo"
                }
                appt_date_obj = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                day_name = day_names_es.get(appt_date_obj.weekday(), "")
                display_date = f"{day_name} {int(parts[2])} de {month_name}"
                display_time = time_str or time_24h

                # Create service order
                order = await _create_service_order(client, appointment)
                result["order_id"] = order.get("_id") if order else None
                result["order_number"] = order.get("order_number") if order else None

                # Send confirmation email + SMS
                phone = client.get("phone", "")
                await send_appointment_confirmation(
                    to_email=sender_email,
                    client_name=sender_name or client.get("name", "Cliente"),
                    appointment_date=display_date,
                    appointment_time=display_time,
                    phone=phone if phone else None,
                )

                result["appointment_booked"] = True
                result["appointment_id"] = appointment.get("id")
                result["appointment_date"] = display_date
                result["appointment_time"] = display_time
                result["confirmation_sent"] = True
            else:
                # Slot taken, send new available slots
                new_slots = await get_available_slots(5)
                if new_slots:
                    await send_available_slots_email(
                        sender_email,
                        sender_name or "Cliente",
                        new_slots
                    )
                result["appointment_booked"] = False
                result["reason"] = "Slot no disponible, se enviaron nuevos horarios"
        else:
            # Could not parse choice, notify admin
            result["appointment_booked"] = False
            result["needs_manual_scheduling"] = True
            result["reason"] = "No se pudo determinar el horario elegido por el cliente"

    # ─── DOCUMENT SUBMISSION ───
    elif intent == "documents" and has_attachments:
        client, is_new = await find_or_create_client(sender_email, sender_name)
        result["client_created"] = is_new
        result["client_id"] = client.get("_id") if client else None

    # ─── SPAM ───
    elif intent == "spam":
        result["action"] = "spam"
        result["reason"] = "Classified as spam, no action taken"

    # Log the processing
    try:
        await _db.email_processing_log.insert_one({
            "email_uid": email_data.get("uid", ""),
            "sender_email": sender_email,
            "sender_name": sender_name,
            "subject": subject,
            "intent": intent,
            "action_taken": result,
            "processed_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.error(f"Error logging email processing: {e}")

    return result
