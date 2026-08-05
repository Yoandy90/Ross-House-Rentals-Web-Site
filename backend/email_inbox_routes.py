"""
Email Inbox Integration for Admin Dashboard
IMAP/SMTP connection to info@rosstaxpreparation.com (Namecheap Private Email)
"""

import os
import imaplib
import smtplib
import email as email_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
from datetime import datetime, timezone
from typing import Optional, List
import re
import logging
import traceback

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from bson import ObjectId

logger = logging.getLogger("email_inbox")

router = APIRouter(prefix="/admin/email", tags=["Email Inbox"])

# ─── Config ───
IMAP_HOST = os.getenv("EMAIL_IMAP_HOST", "mail.privateemail.com")
IMAP_PORT = int(os.getenv("EMAIL_IMAP_PORT", "993"))
SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "mail.privateemail.com")
SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "465"))
EMAIL_ADDR = os.getenv("EMAIL_ADDRESS", "info@rosstaxpreparation.com")
EMAIL_PASS = os.getenv("EMAIL_PASSWORD", "")

# ─── MongoDB (lazy import) ───
_db = None
def get_db():
    global _db
    if _db is None:
        from pymongo import MongoClient
        MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        client = MongoClient(MONGO_URL)
        _db = client[os.getenv("DB_NAME", "taxportal")]
    return _db

# ─── Helpers ───
def decode_mime_header(header_value):
    """Decode MIME encoded header to string."""
    if not header_value:
        return ""
    decoded_parts = decode_header(header_value)
    result = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            try:
                result.append(part.decode(charset or "utf-8", errors="replace"))
            except (LookupError, UnicodeDecodeError):
                result.append(part.decode("utf-8", errors="replace"))
        else:
            result.append(str(part))
    return " ".join(result)


def get_email_body(msg):
    """Extract text body from email message."""
    body_html = ""
    body_text = ""
    
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in content_disposition:
                continue
            try:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    text = payload.decode(charset, errors="replace")
                    if content_type == "text/html":
                        body_html = text
                    elif content_type == "text/plain":
                        body_text = text
            except Exception:
                continue
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    body_html = text
                else:
                    body_text = text
        except Exception:
            pass
    
    return body_html, body_text


def get_attachments_info(msg):
    """Get list of attachments info (name, size)."""
    attachments = []
    if msg.is_multipart():
        for part in msg.walk():
            content_disposition = str(part.get("Content-Disposition", ""))
            if "attachment" in content_disposition:
                filename = part.get_filename()
                if filename:
                    filename = decode_mime_header(filename)
                    payload = part.get_payload(decode=True)
                    size = len(payload) if payload else 0
                    attachments.append({
                        "filename": filename,
                        "size": size,
                        "content_type": part.get_content_type()
                    })
    return attachments


def connect_imap():
    """Create IMAP connection."""
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(EMAIL_ADDR, EMAIL_PASS)
        return mail
    except Exception as e:
        logger.error(f"IMAP connection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Error al conectar al servidor de email: {str(e)}")


def parse_email_date(date_str):
    """Parse email date string to datetime."""
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        return parsedate_to_datetime(date_str)
    except Exception:
        return datetime.now(timezone.utc)


# ─── Pydantic Models ───
class SendEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    is_html: bool = False
    cc: Optional[str] = None
    bcc: Optional[str] = None

class ReplyEmailRequest(BaseModel):
    folder: str = "INBOX"
    uid: str
    body: str
    is_html: bool = False
    reply_all: bool = False

class TagEmailRequest(BaseModel):
    client_name: Optional[str] = None
    client_id: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None


# ─── Routes ───

@router.get("/test-connection")
async def test_connection():
    """Test IMAP connection."""
    try:
        mail = connect_imap()
        mail.select("INBOX", readonly=True)
        status, data = mail.search(None, "ALL")
        count = len(data[0].split()) if data[0] else 0
        mail.logout()
        return {"success": True, "message": f"Conectado exitosamente. {count} emails en inbox.", "email": EMAIL_ADDR}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/folders")
async def list_folders():
    """List all email folders."""
    try:
        mail = connect_imap()
        status, folders = mail.list()
        mail.logout()
        
        folder_list = []
        if status == "OK":
            for f in folders:
                decoded = f.decode() if isinstance(f, bytes) else str(f)
                # Parse folder name from IMAP response like: (\HasNoChildren) "." "INBOX"
                match = re.search(r'"([^"]*)"$', decoded)
                if match:
                    name = match.group(1)
                else:
                    parts = decoded.split('" ')
                    name = parts[-1].strip('"') if parts else decoded
                
                # Map common folder names
                display_name = name
                icon = "📁"
                if name.upper() == "INBOX":
                    display_name = "Bandeja de Entrada"
                    icon = "📥"
                elif "sent" in name.lower():
                    display_name = "Enviados"
                    icon = "📤"
                elif "draft" in name.lower():
                    display_name = "Borradores"
                    icon = "📝"
                elif "trash" in name.lower() or "deleted" in name.lower():
                    display_name = "Papelera"
                    icon = "🗑️"
                elif "spam" in name.lower() or "junk" in name.lower():
                    display_name = "Spam"
                    icon = "⚠️"
                elif "archive" in name.lower():
                    display_name = "Archivo"
                    icon = "📦"
                
                folder_list.append({
                    "name": name,
                    "display_name": display_name,
                    "icon": icon
                })
        
        return {"success": True, "folders": folder_list}
    except Exception as e:
        logger.error(f"Error listing folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/messages")
async def get_messages(
    folder: str = Query("INBOX"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None)
):
    """Fetch emails from a folder with pagination."""
    try:
        mail = connect_imap()
        
        # Select folder
        status, data = mail.select(folder, readonly=True)
        if status != "OK":
            mail.logout()
            raise HTTPException(status_code=400, detail=f"No se pudo abrir la carpeta: {folder}")
        
        total_in_folder = int(data[0])
        
        # Search
        if search:
            search_criteria = f'(OR (SUBJECT "{search}") (FROM "{search}") (TO "{search}"))'
            status, msg_ids = mail.search(None, search_criteria)
        else:
            status, msg_ids = mail.search(None, "ALL")
        
        if status != "OK" or not msg_ids[0]:
            mail.logout()
            return {"success": True, "emails": [], "total": 0, "page": page, "pages": 0}
        
        all_ids = msg_ids[0].split()
        all_ids.reverse()  # newest first
        
        total = len(all_ids)
        pages = (total + limit - 1) // limit
        start = (page - 1) * limit
        end = min(start + limit, total)
        page_ids = all_ids[start:end]
        
        # Fetch emails for this page
        emails = []
        
        # Get tags from DB
        db = get_db()
        tags_map = {}
        try:
            tags = list(db.email_tags.find({"folder": folder}))
            tags_map = {t["uid"]: t for t in tags}
        except Exception:
            pass
        
        if page_ids:
            uid_list = b",".join(page_ids)
            status, msg_data = mail.fetch(uid_list, "(BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)] FLAGS)")
            
            if status == "OK":
                i = 0
                while i < len(msg_data):
                    if isinstance(msg_data[i], tuple):
                        raw_header = msg_data[i][1]
                        response_part = msg_data[i][0].decode() if isinstance(msg_data[i][0], bytes) else str(msg_data[i][0])
                        
                        # Extract UID from response
                        uid_match = re.search(r'(\d+)', response_part)
                        uid = uid_match.group(1) if uid_match else str(i)
                        
                        # Parse flags
                        flags_str = response_part if "FLAGS" in response_part else ""
                        is_read = "\\Seen" in flags_str
                        is_flagged = "\\Flagged" in flags_str
                        
                        # Check next item for flags
                        if i + 1 < len(msg_data) and isinstance(msg_data[i + 1], bytes):
                            flag_data = msg_data[i + 1].decode()
                            if "FLAGS" in flag_data:
                                is_read = is_read or "\\Seen" in flag_data
                                is_flagged = is_flagged or "\\Flagged" in flag_data
                        
                        # Parse header
                        msg = email_lib.message_from_bytes(raw_header)
                        
                        from_raw = msg.get("From", "")
                        from_name, from_email = parseaddr(decode_mime_header(from_raw))
                        to_raw = msg.get("To", "")
                        to_name, to_email = parseaddr(decode_mime_header(to_raw))
                        subject = decode_mime_header(msg.get("Subject", "(Sin asunto)"))
                        date_str = msg.get("Date", "")
                        date = parse_email_date(date_str)
                        
                        # Get tag info
                        tag_info = tags_map.get(uid, {})
                        
                        emails.append({
                            "uid": uid,
                            "from_name": from_name or from_email.split("@")[0] if from_email else "Desconocido",
                            "from_email": from_email or from_raw,
                            "to_email": to_email or to_raw,
                            "subject": subject,
                            "date": date.isoformat(),
                            "is_read": is_read,
                            "is_flagged": is_flagged,
                            "tag_client": tag_info.get("client_name"),
                            "tag_label": tag_info.get("label"),
                            "tag_color": tag_info.get("color"),
                        })
                    i += 1
        
        mail.logout()
        
        return {
            "success": True,
            "emails": emails,
            "total": total,
            "page": page,
            "pages": pages,
            "folder": folder,
            "total_in_folder": total_in_folder
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error al obtener emails: {str(e)}")


@router.get("/message/{uid}")
async def get_message_detail(uid: str, folder: str = Query("INBOX")):
    """Get full email message by UID."""
    try:
        mail = connect_imap()
        mail.select(folder)
        
        # Fetch full message
        status, msg_data = mail.fetch(uid.encode(), "(RFC822)")
        
        if status != "OK" or not msg_data or not msg_data[0]:
            mail.logout()
            raise HTTPException(status_code=404, detail="Email no encontrado")
        
        raw_email = msg_data[0][1] if isinstance(msg_data[0], tuple) else None
        if not raw_email:
            mail.logout()
            raise HTTPException(status_code=404, detail="Email no encontrado")
        
        # Mark as read
        mail.store(uid.encode(), "+FLAGS", "\\Seen")
        mail.logout()
        
        # Parse
        msg = email_lib.message_from_bytes(raw_email)
        
        from_raw = msg.get("From", "")
        from_name, from_email = parseaddr(decode_mime_header(from_raw))
        to_raw = msg.get("To", "")
        cc_raw = msg.get("Cc", "")
        subject = decode_mime_header(msg.get("Subject", "(Sin asunto)"))
        date_str = msg.get("Date", "")
        date = parse_email_date(date_str)
        message_id = msg.get("Message-ID", "")
        in_reply_to = msg.get("In-Reply-To", "")
        
        body_html, body_text = get_email_body(msg)
        attachments = get_attachments_info(msg)
        
        # Get tag from DB
        db = get_db()
        tag_info = db.email_tags.find_one({"uid": uid, "folder": folder}) or {}
        
        return {
            "success": True,
            "email": {
                "uid": uid,
                "message_id": message_id,
                "in_reply_to": in_reply_to,
                "from_name": from_name or (from_email.split("@")[0] if from_email else "Desconocido"),
                "from_email": from_email or from_raw,
                "to": decode_mime_header(to_raw),
                "cc": decode_mime_header(cc_raw),
                "subject": subject,
                "date": date.isoformat(),
                "body_html": body_html,
                "body_text": body_text,
                "attachments": attachments,
                "tag_client": tag_info.get("client_name"),
                "tag_label": tag_info.get("label"),
                "tag_color": tag_info.get("color"),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching message {uid}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_email(req: SendEmailRequest):
    """Send a new email."""
    try:
        msg = MIMEMultipart("alternative") if req.is_html else MIMEMultipart()
        msg["From"] = f"Ross Tax Preparation <{EMAIL_ADDR}>"
        msg["To"] = req.to
        msg["Subject"] = req.subject
        if req.cc:
            msg["Cc"] = req.cc
        
        if req.is_html:
            msg.attach(MIMEText(req.body, "html", "utf-8"))
        else:
            msg.attach(MIMEText(req.body, "plain", "utf-8"))
        
        # Send via SMTP SSL
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(EMAIL_ADDR, EMAIL_PASS)
            recipients = [req.to]
            if req.cc:
                recipients.extend([e.strip() for e in req.cc.split(",")])
            if req.bcc:
                recipients.extend([e.strip() for e in req.bcc.split(",")])
            server.sendmail(EMAIL_ADDR, recipients, msg.as_string())
        
        # Save to Sent folder via IMAP
        try:
            imap = connect_imap()
            # Try common Sent folder names
            for sent_folder in ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages"]:
                status, _ = imap.select(sent_folder)
                if status == "OK":
                    imap.append(sent_folder, "\\Seen", None, msg.as_bytes())
                    break
            imap.logout()
        except Exception as e:
            logger.warning(f"Could not save to Sent folder: {e}")
        
        return {"success": True, "message": "Email enviado exitosamente"}
    except Exception as e:
        logger.error(f"Error sending email: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error al enviar email: {str(e)}")


@router.post("/reply")
async def reply_email(req: ReplyEmailRequest):
    """Reply to an email."""
    try:
        # Fetch original message to get headers
        mail = connect_imap()
        mail.select(req.folder)
        status, msg_data = mail.fetch(req.uid.encode(), "(RFC822)")
        mail.logout()
        
        if status != "OK" or not msg_data or not msg_data[0]:
            raise HTTPException(status_code=404, detail="Email original no encontrado")
        
        original = email_lib.message_from_bytes(msg_data[0][1])
        
        from_raw = original.get("From", "")
        _, reply_to_email = parseaddr(decode_mime_header(original.get("Reply-To", from_raw)))
        if not reply_to_email:
            _, reply_to_email = parseaddr(decode_mime_header(from_raw))
        
        original_subject = decode_mime_header(original.get("Subject", ""))
        subject = f"Re: {original_subject}" if not original_subject.lower().startswith("re:") else original_subject
        
        message_id = original.get("Message-ID", "")
        
        # Build reply
        msg = MIMEMultipart("alternative")
        msg["From"] = f"Ross Tax Preparation <{EMAIL_ADDR}>"
        msg["To"] = reply_to_email
        msg["Subject"] = subject
        if message_id:
            msg["In-Reply-To"] = message_id
            msg["References"] = message_id
        
        if req.reply_all:
            cc_addresses = []
            for field in ["To", "Cc"]:
                raw = original.get(field, "")
                if raw:
                    decoded = decode_mime_header(raw)
                    for addr in decoded.split(","):
                        _, email_addr = parseaddr(addr.strip())
                        if email_addr and email_addr.lower() != EMAIL_ADDR.lower() and email_addr.lower() != reply_to_email.lower():
                            cc_addresses.append(email_addr)
            if cc_addresses:
                msg["Cc"] = ", ".join(cc_addresses)
        
        if req.is_html:
            msg.attach(MIMEText(req.body, "html", "utf-8"))
        else:
            msg.attach(MIMEText(req.body, "plain", "utf-8"))
        
        # Send
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(EMAIL_ADDR, EMAIL_PASS)
            recipients = [reply_to_email]
            if msg.get("Cc"):
                recipients.extend([e.strip() for e in msg["Cc"].split(",")])
            server.sendmail(EMAIL_ADDR, recipients, msg.as_string())
        
        # Save to Sent
        try:
            imap = connect_imap()
            for sent_folder in ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages"]:
                status, _ = imap.select(sent_folder)
                if status == "OK":
                    imap.append(sent_folder, "\\Seen", None, msg.as_bytes())
                    break
            imap.logout()
        except Exception:
            pass
        
        return {"success": True, "message": "Respuesta enviada exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replying: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error al responder: {str(e)}")


@router.patch("/message/{uid}/read")
async def mark_as_read(uid: str, folder: str = Query("INBOX"), unread: bool = Query(False)):
    """Mark email as read or unread."""
    try:
        mail = connect_imap()
        mail.select(folder)
        if unread:
            mail.store(uid.encode(), "-FLAGS", "\\Seen")
        else:
            mail.store(uid.encode(), "+FLAGS", "\\Seen")
        mail.logout()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/message/{uid}/flag")
async def toggle_flag(uid: str, folder: str = Query("INBOX"), flagged: bool = Query(True)):
    """Toggle flagged/starred status."""
    try:
        mail = connect_imap()
        mail.select(folder)
        if flagged:
            mail.store(uid.encode(), "+FLAGS", "\\Flagged")
        else:
            mail.store(uid.encode(), "-FLAGS", "\\Flagged")
        mail.logout()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/message/{uid}")
async def delete_message(uid: str, folder: str = Query("INBOX")):
    """Move email to Trash."""
    try:
        mail = connect_imap()
        mail.select(folder)
        # Try to move to Trash
        for trash_folder in ["Trash", "INBOX.Trash", "Deleted Items", "Deleted"]:
            try:
                mail.copy(uid.encode(), trash_folder)
                mail.store(uid.encode(), "+FLAGS", "\\Deleted")
                mail.expunge()
                mail.logout()
                return {"success": True, "message": "Email movido a papelera"}
            except Exception:
                continue
        
        # If no trash folder found, just mark as deleted
        mail.store(uid.encode(), "+FLAGS", "\\Deleted")
        mail.expunge()
        mail.logout()
        return {"success": True, "message": "Email eliminado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message/{uid}/tag")
async def tag_message(uid: str, req: TagEmailRequest, folder: str = Query("INBOX")):
    """Tag an email with client info or label."""
    try:
        db = get_db()
        update_data = {"uid": uid, "folder": folder, "updated_at": datetime.now(timezone.utc)}
        if req.client_name is not None:
            update_data["client_name"] = req.client_name
        if req.client_id is not None:
            update_data["client_id"] = req.client_id
        if req.label is not None:
            update_data["label"] = req.label
        if req.color is not None:
            update_data["color"] = req.color
        
        db.email_tags.update_one(
            {"uid": uid, "folder": folder},
            {"$set": update_data},
            upsert=True
        )
        return {"success": True, "message": "Etiqueta actualizada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def email_stats():
    """Get email inbox stats."""
    try:
        mail = connect_imap()
        
        # Inbox count
        mail.select("INBOX", readonly=True)
        _, all_data = mail.search(None, "ALL")
        total = len(all_data[0].split()) if all_data[0] else 0
        
        _, unseen_data = mail.search(None, "UNSEEN")
        unread = len(unseen_data[0].split()) if unseen_data[0] else 0
        
        # Flagged
        _, flagged_data = mail.search(None, "FLAGGED")
        flagged = len(flagged_data[0].split()) if flagged_data[0] else 0
        
        mail.logout()
        
        return {
            "success": True,
            "total": total,
            "unread": unread,
            "flagged": flagged,
            "read": total - unread
        }
    except Exception as e:
        return {"success": False, "total": 0, "unread": 0, "flagged": 0, "read": 0, "error": str(e)}
