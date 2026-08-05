"""
Email Inbox Service - IMAP/SMTP integration for reading and sending emails
with AI-powered categorization and response suggestions
"""
import imaplib
import smtplib
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import decode_header
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class EmailInboxService:
    def __init__(self):
        self.imap_host = os.getenv('EMAIL_IMAP_HOST', 'gtxm1016.siteground.biz')
        self.imap_port = int(os.getenv('EMAIL_IMAP_PORT', '993'))
        self.smtp_host = os.getenv('EMAIL_SMTP_HOST', 'gtxm1016.siteground.biz')
        self.smtp_port = int(os.getenv('EMAIL_SMTP_PORT', '465'))
        self.email_address = os.getenv('EMAIL_ADDRESS', '')
        self.email_password = os.getenv('EMAIL_PASSWORD', '')
        self.ai_brain = None
        self.db = None
        
        if self.email_address and self.email_password:
            logger.info(f"✅ Email Inbox Service initialized for {self.email_address}")
        else:
            logger.warning("⚠️ Email Inbox Service: Missing credentials")
    
    def set_dependencies(self, db, ai_brain):
        """Set database and AI brain dependencies"""
        self.db = db
        self.ai_brain = ai_brain
    
    def _decode_header_value(self, value):
        """Decode email header value"""
        if value is None:
            return ""
        
        decoded_parts = decode_header(value)
        result = ""
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                try:
                    result += part.decode(encoding or 'utf-8', errors='ignore')
                except:
                    result += part.decode('utf-8', errors='ignore')
            else:
                result += part
        return result
    
    def _get_email_body(self, msg) -> str:
        """Extract email body from message"""
        text_body = ""
        html_body = ""
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))
                
                # Skip attachments
                if "attachment" in content_disposition:
                    continue
                
                try:
                    payload = part.get_payload(decode=True)
                    if not payload:
                        continue
                    charset = part.get_content_charset() or 'utf-8'
                    decoded = payload.decode(charset, errors='ignore')
                except Exception:
                    continue
                
                if content_type == "text/plain" and not text_body:
                    text_body = decoded
                elif content_type == "text/html" and not html_body:
                    html_body = decoded
        else:
            try:
                payload = msg.get_payload(decode=True)
                if payload:
                    charset = msg.get_content_charset() or 'utf-8'
                    decoded = payload.decode(charset, errors='ignore')
                    if msg.get_content_type() == "text/html":
                        html_body = decoded
                    else:
                        text_body = decoded
            except Exception:
                text_body = str(msg.get_payload())
        
        # Prefer text/plain, fallback to cleaned HTML
        if text_body and text_body.strip():
            return text_body.strip()[:5000]
        
        if html_body:
            # Better HTML to text conversion
            import re as re_mod
            clean = html_body
            # Remove style and script blocks
            clean = re_mod.sub(r'<style[^>]*>.*?</style>', '', clean, flags=re_mod.DOTALL | re_mod.IGNORECASE)
            clean = re_mod.sub(r'<script[^>]*>.*?</script>', '', clean, flags=re_mod.DOTALL | re_mod.IGNORECASE)
            # Replace br/p/div/tr tags with newlines
            clean = re_mod.sub(r'<br\s*/?\s*>', '\n', clean, flags=re_mod.IGNORECASE)
            clean = re_mod.sub(r'</p>', '\n', clean, flags=re_mod.IGNORECASE)
            clean = re_mod.sub(r'</div>', '\n', clean, flags=re_mod.IGNORECASE)
            clean = re_mod.sub(r'</tr>', '\n', clean, flags=re_mod.IGNORECASE)
            clean = re_mod.sub(r'</li>', '\n', clean, flags=re_mod.IGNORECASE)
            # Remove remaining HTML tags
            clean = re_mod.sub(r'<[^>]+>', '', clean)
            # Decode HTML entities
            try:
                import html as html_mod
                clean = html_mod.unescape(clean)
            except Exception:
                pass
            # Clean up whitespace
            clean = re_mod.sub(r'[ \t]+', ' ', clean)
            clean = re_mod.sub(r'\n\s*\n+', '\n\n', clean)
            clean = clean.strip()
            if clean:
                return clean[:5000]
        
        return "(Sin contenido)"
    
    def _parse_email(self, msg, uid: str, flags: list = None) -> Dict[str, Any]:
        """Parse email message into dictionary"""
        # Get basic headers
        subject = self._decode_header_value(msg.get("Subject", ""))
        from_header = self._decode_header_value(msg.get("From", ""))
        to_header = self._decode_header_value(msg.get("To", ""))
        date_str = msg.get("Date", "")
        message_id = msg.get("Message-ID", "")
        
        # Parse from address
        from_match = re.search(r'<(.+?)>', from_header)
        from_email = from_match.group(1) if from_match else from_header
        from_name = from_header.split('<')[0].strip().strip('"') if '<' in from_header else ""
        
        # Parse date
        try:
            from email.utils import parsedate_to_datetime
            date = parsedate_to_datetime(date_str)
        except:
            date = datetime.now(timezone.utc)
        
        # Get body
        body = self._get_email_body(msg)
        
        # Check for attachments
        attachments = []
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_maintype() == 'multipart':
                    continue
                filename = part.get_filename()
                if filename:
                    attachments.append({
                        'filename': self._decode_header_value(filename),
                        'content_type': part.get_content_type(),
                        'size': len(part.get_payload(decode=True) or b'')
                    })
        
        # Check if read
        is_read = flags and b'\\Seen' in flags
        
        return {
            'uid': uid,
            'message_id': message_id,
            'subject': subject or "(Sin asunto)",
            'from_email': from_email.lower().strip(),
            'from_name': from_name or from_email.split('@')[0],
            'to': to_header,
            'date': date.isoformat(),
            'body': body,
            'body_preview': body[:200] + '...' if len(body) > 200 else body,
            'has_attachments': len(attachments) > 0,
            'attachments': attachments,
            'is_read': is_read
        }
    
    async def fetch_emails(self, folder: str = "INBOX", limit: int = 50, unread_only: bool = False) -> List[Dict]:
        """Fetch emails from IMAP server"""
        if not self.email_address or not self.email_password:
            logger.error("Email credentials not configured")
            return []
        
        emails = []
        
        try:
            # Connect to IMAP server
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.email_address, self.email_password)
            mail.select(folder)
            
            # Search for emails
            search_criteria = "UNSEEN" if unread_only else "ALL"
            status, messages = mail.search(None, search_criteria)
            
            if status != "OK":
                logger.error(f"Failed to search emails: {status}")
                return []
            
            # Get message UIDs
            message_nums = messages[0].split()
            
            # Get latest emails (reverse order, limit)
            message_nums = message_nums[-limit:] if len(message_nums) > limit else message_nums
            message_nums = list(reversed(message_nums))
            
            for num in message_nums:
                try:
                    # Fetch email with flags
                    status, data = mail.fetch(num, "(RFC822 FLAGS)")
                    if status != "OK":
                        continue
                    
                    raw_email = data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    
                    # Get flags
                    flags = []
                    if data[0][0]:
                        flags_match = re.search(rb'FLAGS \(([^)]*)\)', data[0][0])
                        if flags_match:
                            flags = flags_match.group(1).split()
                    
                    # Get UID
                    status, uid_data = mail.fetch(num, "(UID)")
                    uid_match = re.search(rb'UID (\d+)', uid_data[0])
                    uid = uid_match.group(1).decode() if uid_match else str(num.decode() if isinstance(num, bytes) else num)
                    
                    parsed = self._parse_email(msg, uid, flags)
                    emails.append(parsed)
                    
                except Exception as e:
                    logger.error(f"Error parsing email {num}: {e}")
                    continue
            
            mail.logout()
            logger.info(f"📧 Fetched {len(emails)} emails from {folder}")
            
        except Exception as e:
            logger.error(f"❌ Error fetching emails: {e}")
            import traceback
            traceback.print_exc()
        
        return emails
    
    async def get_email_by_uid(self, uid: str, folder: str = "INBOX") -> Optional[Dict]:
        """Fetch a single email by UID"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.email_address, self.email_password)
            mail.select(folder)
            
            status, data = mail.uid('fetch', uid, "(RFC822 FLAGS)")
            if status != "OK" or not data or not data[0]:
                return None
            
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Get flags
            flags = []
            if data[0][0]:
                flags_match = re.search(rb'FLAGS \(([^)]*)\)', data[0][0])
                if flags_match:
                    flags = flags_match.group(1).split()
            
            parsed = self._parse_email(msg, uid, flags)
            mail.logout()
            
            return parsed
            
        except Exception as e:
            logger.error(f"❌ Error fetching email {uid}: {e}")
            return None
    
    async def mark_as_read(self, uid: str, folder: str = "INBOX") -> bool:
        """Mark an email as read"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.email_address, self.email_password)
            mail.select(folder)
            
            # Mark as seen
            mail.uid('STORE', uid, '+FLAGS', '\\Seen')
            mail.logout()
            
            logger.info(f"✅ Marked email {uid} as read")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error marking email as read: {e}")
            return False
    
    async def send_email(self, to: str, subject: str, body: str, cc: str = None) -> bool:
        """Send a new email via SMTP"""
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f"Ross Tax Preparation <{self.email_address}>"
            msg['To'] = to
            msg['Subject'] = subject
            if cc:
                msg['Cc'] = cc
            
            # Create HTML version
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto;">
                    {body.replace(chr(10), '<br>')}
                    <br><br>
                    <div style="border-top: 1px solid #ccc; padding-top: 15px; margin-top: 20px; color: #666;">
                        <strong>Ross Tax Preparation</strong><br>
                        📍 305 Bruce Ave, Dumas, TX 79029<br>
                        📞 (806) 934-2018<br>
                        🌐 www.rosstaxpreparation.com
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.email_address, self.email_password)
                server.send_message(msg)
            
            logger.info(f"📤 Email sent to {to}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error sending email: {e}")
            return False

    async def send_reply(self, to: str, subject: str, body: str, in_reply_to: str = None) -> bool:
        """Send an email reply via SMTP"""
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = f"Ross Tax Preparation <{self.email_address}>"
            msg['To'] = to
            msg['Subject'] = subject if subject.startswith('Re:') else f"Re: {subject}"
            
            if in_reply_to:
                msg['In-Reply-To'] = in_reply_to
                msg['References'] = in_reply_to
            
            # Create HTML version
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto;">
                    {body.replace(chr(10), '<br>')}
                    <br><br>
                    <div style="border-top: 1px solid #ccc; padding-top: 15px; margin-top: 20px; color: #666;">
                        <strong>Ross Tax Preparation</strong><br>
                        📍 305 Bruce Ave, Dumas, TX 79029<br>
                        📞 (806) 934-2018<br>
                        🌐 www.rosstaxpreparation.com
                    </div>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.email_address, self.email_password)
                server.send_message(msg)
            
            logger.info(f"📤 Reply sent to {to}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error sending reply: {e}")
            return False
    
    async def categorize_email(self, email_data: Dict) -> Dict:
        """Use AI to categorize email and suggest response"""
        result = {
            'category': 'general',
            'priority': 'normal',
            'summary': '',
            'suggested_response': None,
            'linked_client': None
        }
        
        # Check if sender is a known client
        if self.db is not None:
            try:
                client = await self.db.users.find_one({
                    'email': {'$regex': f'^{re.escape(email_data.get("from_email", ""))}$', '$options': 'i'}
                })
                if client:
                    result['linked_client'] = {
                        'id': str(client.get('_id')),
                        'name': client.get('name', client.get('full_name', '')),
                        'email': client.get('email'),
                        'phone': client.get('phone', '')
                    }
            except Exception as e:
                logger.error(f"Error finding client: {e}")
        
        if not self.ai_brain:
            return result
        
        try:
            # AI categorization
            prompt = f"""Analiza este email recibido en Ross Tax Preparation (oficina de preparación de impuestos):

De: {email_data.get('from_name')} <{email_data.get('from_email')}>
Asunto: {email_data.get('subject')}
Mensaje: {email_data.get('body_preview')}

Responde SOLO con JSON válido (sin explicación adicional):
{{
    "category": "consulta_impuestos|cita|documento|factura|spam|promocion|otro",
    "priority": "alta|normal|baja",
    "summary": "resumen en 1 línea máximo 50 palabras",
    "suggested_response": "respuesta sugerida profesional en español, 2-3 oraciones"
}}"""

            response = await self.ai_brain.chat(prompt)
            
            # Parse JSON from response
            import json
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                ai_result = json.loads(json_match.group())
                result['category'] = ai_result.get('category', 'general')
                result['priority'] = ai_result.get('priority', 'normal')
                result['summary'] = ai_result.get('summary', '')
                result['suggested_response'] = ai_result.get('suggested_response')
            
        except Exception as e:
            logger.error(f"❌ Error categorizing email: {e}")
        
        return result

    async def download_attachment(self, uid: str, attachment_index: int = 0, folder: str = "INBOX") -> Optional[Dict]:
        """Download a specific attachment from an email by UID."""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.email_address, self.email_password)
            mail.select(folder)
            
            status, data = mail.uid('fetch', uid.encode(), '(RFC822)')
            if status != 'OK' or not data or not data[0]:
                mail.logout()
                return None
            
            msg = email.message_from_bytes(data[0][1])
            
            current_idx = 0
            for part in msg.walk():
                if part.get_content_maintype() == 'multipart':
                    continue
                filename = part.get_filename()
                if filename:
                    if current_idx == attachment_index:
                        decoded_filename = self._decode_header_value(filename)
                        file_data = part.get_payload(decode=True)
                        mail.logout()
                        
                        import base64
                        return {
                            'filename': decoded_filename,
                            'content_type': part.get_content_type(),
                            'size': len(file_data),
                            'data_base64': base64.b64encode(file_data).decode('utf-8'),
                            'data_bytes': file_data,
                        }
                    current_idx += 1
            
            mail.logout()
            return None
        except Exception as e:
            logger.error(f"Error downloading attachment: {e}")
            return None

    async def process_email_attachments_for_client(self, uid: str, folder: str = "INBOX") -> Dict:
        """Process all attachments from an email and save to client's documents."""
        import base64
        import uuid as _uuid
        
        result = {
            'processed': 0,
            'skipped': 0,
            'errors': [],
            'documents': [],
            'client': None,
        }
        
        if self.db is None:
            result['errors'].append("Database not configured")
            return result
        
        # Get the email details first
        email_data = await self.get_email_by_uid(uid, folder)
        if not email_data:
            result['errors'].append("Email not found")
            return result
        
        sender_email = email_data.get('from_email', '').lower().strip()
        sender_name = email_data.get('from_name', '')
        attachments = email_data.get('attachments', [])
        
        if not attachments:
            result['errors'].append("No attachments found in this email")
            return result
        
        # Find the client by email
        client = await self.db.users.find_one({
            'email': {'$regex': f'^{re.escape(sender_email)}$', '$options': 'i'}
        })
        
        if not client:
            # Try season_clients
            client = await self.db.season_clients.find_one({
                'email': {'$regex': f'^{re.escape(sender_email)}$', '$options': 'i'}
            })
        
        client_id = str(client['_id']) if client else None
        client_name = client.get('name', client.get('first_name', '') + ' ' + client.get('last_name', '')) if client else sender_name
        client_email = client.get('email', sender_email) if client else sender_email
        
        result['client'] = {
            'id': client_id,
            'name': client_name,
            'email': client_email,
            'found_in_db': client is not None,
        }
        
        # AI categorization of document types
        DOC_CATEGORIES = {
            'w2': 'W-2',
            'w-2': 'W-2',
            '1099': '1099',
            '1098': '1098',
            'ssa': 'SSA-1099',
            'social_security': 'SSA-1099',
            'id': 'Identificación',
            'license': 'Identificación',
            'passport': 'Pasaporte',
            'itin': 'ITIN Letter',
            'ssn': 'Social Security Card',
            'bank': 'Estado de Cuenta Bancario',
            'statement': 'Estado de Cuenta',
            'tax_return': 'Declaración Anterior',
            'receipt': 'Recibo',
        }
        
        # Download and save each attachment
        for idx, att in enumerate(attachments):
            try:
                filename = att.get('filename', f'attachment_{idx}')
                content_type = att.get('content_type', '')
                
                # Skip non-document types
                allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
                                'image/heic', 'image/heif', 'application/msword',
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
                
                if content_type and not any(t in content_type.lower() for t in ['pdf', 'image', 'word', 'excel', 'sheet', 'octet']):
                    result['skipped'] += 1
                    continue
                
                # Download the actual file
                file_data = await self.download_attachment(uid, idx, folder)
                if not file_data:
                    result['errors'].append(f"Failed to download: {filename}")
                    continue
                
                # Guess document category from filename
                fname_lower = filename.lower()
                doc_category = 'other'
                doc_category_label = 'Otro'
                for key, label in DOC_CATEGORIES.items():
                    if key in fname_lower:
                        doc_category = key
                        doc_category_label = label
                        break
                
                # If AI is available, use it for better categorization
                if self.ai_brain:
                    try:
                        ai_prompt = f"""Categoriza este documento fiscal adjunto a un email.
Nombre archivo: {filename}
Tipo: {content_type}
Email de: {sender_name} <{sender_email}>
Asunto email: {email_data.get('subject', '')}

Responde SOLO con JSON:
{{"category": "W-2|1099|1098|SSA-1099|Identificacion|ITIN|Bank_Statement|Tax_Return|Receipt|Other", "label": "etiqueta en español corta"}}"""
                        ai_resp = await self.ai_brain.chat(ai_prompt)
                        import json
                        json_match = re.search(r'\{[^{}]*\}', ai_resp, re.DOTALL)
                        if json_match:
                            ai_cat = json.loads(json_match.group())
                            doc_category = ai_cat.get('category', doc_category)
                            doc_category_label = ai_cat.get('label', doc_category_label)
                    except Exception as ai_err:
                        logger.warning(f"AI categorization failed: {ai_err}")
                
                # Save to documents collection
                doc_record = {
                    'id': str(_uuid.uuid4()),
                    'user_id': client_id or f'email_{sender_email}',
                    'name': filename,
                    'file_data': file_data['data_base64'],
                    'file_type': content_type or 'application/octet-stream',
                    'size': file_data['size'],
                    'category': doc_category,
                    'category_label': doc_category_label,
                    'uploaded_at': datetime.now(timezone.utc),
                    'source': 'email',
                    'source_email_uid': uid,
                    'source_email_subject': email_data.get('subject', ''),
                    'source_email_from': sender_email,
                    'client_name': client_name,
                    'client_email': client_email,
                    'reviewed': False,
                }
                
                await self.db.documents.insert_one(doc_record)
                
                result['processed'] += 1
                result['documents'].append({
                    'filename': filename,
                    'category': doc_category,
                    'category_label': doc_category_label,
                    'size_kb': round(file_data['size'] / 1024, 1),
                    'content_type': content_type,
                })
                
            except Exception as e:
                result['errors'].append(f"Error processing {att.get('filename', 'unknown')}: {str(e)}")
        
        return result


    
    async def get_folders(self) -> List[str]:
        """Get list of email folders"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.email_address, self.email_password)
            
            status, folders = mail.list()
            folder_list = []
            
            for folder in folders:
                # Parse folder name
                match = re.search(r'"[^"]*" "?([^"]+)"?$', folder.decode())
                if match:
                    folder_list.append(match.group(1))
            
            mail.logout()
            return folder_list
            
        except Exception as e:
            logger.error(f"❌ Error getting folders: {e}")
            return ["INBOX"]
    
    async def get_unread_count(self, folder: str = "INBOX") -> int:
        """Get count of unread emails"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.email_address, self.email_password)
            mail.select(folder)
            
            status, messages = mail.search(None, "UNSEEN")
            count = len(messages[0].split()) if messages[0] else 0
            
            mail.logout()
            return count
            
        except Exception as e:
            logger.error(f"❌ Error getting unread count: {e}")
            return 0

# Global instance
email_inbox_service = EmailInboxService()
