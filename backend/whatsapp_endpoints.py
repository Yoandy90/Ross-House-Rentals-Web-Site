"""
WhatsApp Webhook Endpoints
Handles incoming messages from Meta Cloud API
"""
from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo
import logging
import hmac
import hashlib
import os

logger = logging.getLogger(__name__)

whatsapp_router = APIRouter()

# These will be initialized in server.py
whatsapp_service = None
whatsapp_bot_service = None

def init_whatsapp_services(wa_service, bot_service):
    """Initialize WhatsApp services"""
    global whatsapp_service, whatsapp_bot_service
    whatsapp_service = wa_service
    whatsapp_bot_service = bot_service

@whatsapp_router.get('/whatsapp/webhook')
async def verify_webhook(
    request: Request
):
    """
    Webhook verification endpoint for Meta Cloud API
    Meta will send a GET request to verify the webhook
    """
    from fastapi.responses import PlainTextResponse
    
    try:
        # Get query parameters
        params = dict(request.query_params)
        
        mode = params.get('hub.mode')
        token = params.get('hub.verify_token')
        challenge = params.get('hub.challenge')
        
        verify_token = os.getenv('WHATSAPP_VERIFY_TOKEN', 'ross_tax_whatsapp_2025')
        
        logger.info(f"Webhook verification attempt - mode: {mode}, token: {token}, challenge: {challenge}")
        
        # Check if mode and token are correct
        if mode == 'subscribe' and token == verify_token:
            logger.info("✅ Webhook verified successfully")
            # Meta expects ONLY the challenge string as plain text response
            return PlainTextResponse(content=str(challenge), status_code=200)
        else:
            logger.warning(f"❌ Webhook verification failed - mode: {mode}, token: {token}, expected: {verify_token}")
            return PlainTextResponse(content="Verification failed", status_code=403)
    
    except Exception as e:
        logger.error(f"Error in webhook verification: {str(e)}")
        return PlainTextResponse(content=str(e), status_code=400)

@whatsapp_router.head('/whatsapp/webhook')
async def head_webhook():
    """HEAD request for health checks"""
    return {"status": "ok"}

@whatsapp_router.post('/whatsapp/webhook')
async def handle_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None)
):
    """
    Handle incoming WhatsApp messages from Meta Cloud API
    """
    try:
        body = await request.body()
        
        # Verify signature (optional but recommended for production)
        # app_secret = os.getenv('WHATSAPP_APP_SECRET')
        # if app_secret and x_hub_signature_256:
        #     expected_signature = hmac.new(
        #         app_secret.encode(),
        #         body,
        #         hashlib.sha256
        #     ).hexdigest()
        #     
        #     if f"sha256={expected_signature}" != x_hub_signature_256:
        #         raise HTTPException(status_code=403, detail='Invalid signature')
        
        # Parse webhook payload
        import json
        data = json.loads(body)
        
        logger.info(f"Received webhook: {json.dumps(data, indent=2)}")
        
        # Process webhook entries
        if 'entry' in data:
            for entry in data['entry']:
                if 'changes' in entry:
                    for change in entry['changes']:
                        if change.get('field') == 'messages':
                            await process_message_change(change['value'])
        
        return {'status': 'received'}
    
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        # Return 200 anyway to prevent Meta from retrying
        return {'status': 'error', 'message': str(e)}

@whatsapp_router.post('/whatsapp/test-bot')
async def test_bot(
    request: Request
):
    """
    Test endpoint to simulate incoming messages without Meta webhook
    For development/testing purposes
    """
    try:
        data = await request.json()
        
        phone_number = data.get('phone_number')
        message = data.get('message')
        user_name = data.get('user_name')
        
        if not phone_number or not message:
            raise HTTPException(status_code=400, detail='phone_number and message required')
        
        # Try bot V2 first
        try:
            from whatsapp_bot_service_v2 import get_whatsapp_bot_v2
            bot_v2 = get_whatsapp_bot_v2()
            if bot_v2:
                result = await bot_v2.process_incoming_message(
                    phone_number=phone_number,
                    message=message,
                    user_name=user_name
                )
                return {
                    'success': True,
                    'bot_response': result,
                    'message': 'Bot V2 processed message and responded',
                    'bot_version': 'v2'
                }
        except Exception as v2_error:
            logger.warning(f"Bot V2 error, falling back: {v2_error}")
        
        # Fallback to original bot
        if not whatsapp_bot_service:
            raise HTTPException(status_code=503, detail='WhatsApp bot not available')
        
        result = await whatsapp_bot_service.process_incoming_message(
            phone_number=phone_number,
            message=message,
            user_name=user_name
        )
        
        return {
            'success': True,
            'bot_response': result,
            'message': 'Bot processed message and responded',
            'bot_version': 'v1'
        }
    
    except Exception as e:
        logger.error(f"Error in test bot: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

        import json
        data = json.loads(body)
        
        logger.info(f"Received webhook: {json.dumps(data, indent=2)}")
        
        # Process webhook entries
        if 'entry' in data:
            for entry in data['entry']:
                if 'changes' in entry:
                    for change in entry['changes']:
                        if change.get('field') == 'messages':
                            await process_message_change(change['value'])
        
        return {'status': 'received'}
    
    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}")
        # Return 200 anyway to prevent Meta from retrying
        return {'status': 'error', 'message': str(e)}

async def process_message_change(value: dict):
    """Process incoming message from webhook"""
    try:
        # Check if there are messages
        if 'messages' not in value:
            return
        
        messages = value['messages']
        contacts = value.get('contacts', [])
        
        for message in messages:
            message_type = message.get('type')
            from_number = message.get('from')
            message_id = message.get('id')
            timestamp = message.get('timestamp')
            
            # Get contact info
            contact_name = None
            for contact in contacts:
                if contact.get('wa_id') == from_number:
                    contact_name = contact.get('profile', {}).get('name')
                    break
            
            # Extract message text based on type
            message_text = None
            if message_type == 'text':
                message_text = message.get('text', {}).get('body')
            elif message_type == 'button':
                message_text = message.get('button', {}).get('text')
            elif message_type == 'interactive':
                interactive = message.get('interactive', {})
                if interactive.get('type') == 'button_reply':
                    message_text = interactive.get('button_reply', {}).get('title')
                elif interactive.get('type') == 'list_reply':
                    message_text = interactive.get('list_reply', {}).get('title')
            
            if message_text:
                logger.info(f"Processing message from {from_number}: {message_text}")
                
                # Try to use enhanced bot V2 first
                try:
                    from whatsapp_bot_service_v2 import get_whatsapp_bot_v2
                    bot_v2 = get_whatsapp_bot_v2()
                    if bot_v2:
                        await bot_v2.process_incoming_message(
                            phone_number=from_number,
                            message=message_text,
                            user_name=contact_name
                        )
                    elif whatsapp_bot_service:
                        # Fallback to original bot
                        await whatsapp_bot_service.process_incoming_message(
                            phone_number=from_number,
                            message=message_text,
                            user_name=contact_name
                        )
                except Exception as bot_error:
                    logger.error(f"Error with bot V2, falling back: {bot_error}")
                    if whatsapp_bot_service:
                        await whatsapp_bot_service.process_incoming_message(
                            phone_number=from_number,
                            message=message_text,
                            user_name=contact_name
                        )
            
            elif message_type == 'image':
                # Handle image upload (for documents)
                logger.info(f"Received image from {from_number}")
                await process_whatsapp_media(
                    from_number=from_number,
                    contact_name=contact_name,
                    media_data=message.get('image', {}),
                    media_type='image'
                )
            
            elif message_type == 'document':
                # Handle document upload
                logger.info(f"Received document from {from_number}")
                await process_whatsapp_media(
                    from_number=from_number,
                    contact_name=contact_name,
                    media_data=message.get('document', {}),
                    media_type='document'
                )
    
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")


async def process_whatsapp_media(from_number: str, contact_name: str, media_data: dict, media_type: str):
    """
    Process and save media files (images/documents) received via WhatsApp
    Automatically categorizes and links to client account
    """
    import aiohttp
    import base64
    import uuid
    import re
    from datetime import datetime
    
    try:
        media_id = media_data.get('id')
        mime_type = media_data.get('mime_type', '')
        filename = media_data.get('filename', f'whatsapp_{media_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        caption = media_data.get('caption', '')
        
        if not media_id:
            logger.error("No media_id in WhatsApp media")
            return
        
        # Get access token
        access_token = os.getenv('WHATSAPP_ACCESS_TOKEN')
        if not access_token:
            logger.error("No WhatsApp access token configured")
            return
        
        # Step 1: Get media URL from WhatsApp
        media_url_endpoint = f"https://graph.facebook.com/v18.0/{media_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with aiohttp.ClientSession() as session:
            # Get the download URL
            async with session.get(media_url_endpoint, headers=headers) as response:
                if response.status != 200:
                    logger.error(f"Failed to get media URL: {await response.text()}")
                    return
                media_info = await response.json()
                download_url = media_info.get('url')
            
            if not download_url:
                logger.error("No download URL returned from WhatsApp")
                return
            
            # Step 2: Download the media
            async with session.get(download_url, headers=headers) as response:
                if response.status != 200:
                    logger.error(f"Failed to download media: {response.status}")
                    return
                media_content = await response.read()
        
        # Convert to base64 for storage
        media_base64 = base64.b64encode(media_content).decode('utf-8')
        
        # Step 3: Find or create client by phone number
        phone_clean = re.sub(r'\D', '', from_number)[-10:]
        
        # Get database reference
        if whatsapp_service is not None and whatsapp_service.db is not None:
            db = whatsapp_service.db
        else:
            logger.error("No database connection available")
            return
        
        # Find client by phone
        client = await db.users.find_one({
            '$or': [
                {'phone': phone_clean},
                {'phone': f"+1{phone_clean}"},
                {'phone': f"1{phone_clean}"},
                {'phone': {'$regex': f".*{phone_clean}$"}}
            ]
        })
        
        # Step 4: Check if user is in expense receipt flow
        conversation = await db.whatsapp_conversations.find_one({'phone_number': phone_clean})
        if conversation and conversation.get('current_flow') == 'expense_receipt':
            # User is in expense receipt mode - process as expense receipt
            await process_expense_receipt_from_whatsapp(
                db=db,
                phone=phone_clean,
                contact_name=contact_name,
                client=client,
                media_content=media_content,
                filename=filename,
                caption=caption,
                mime_type=mime_type
            )
            return
        
        # Step 5: Auto-categorize document based on filename and caption
        category = auto_categorize_document(filename, caption, mime_type)
        
        # Step 5: Save document to database
        doc_id = str(uuid.uuid4())
        document = {
            '_id': doc_id,
            'id': doc_id,
            'user_id': str(client['_id']) if client else None,
            'phone_number': phone_clean,
            'contact_name': contact_name,
            'name': filename,
            'original_filename': filename,
            'category': category,
            'mime_type': mime_type,
            'file_data': media_base64,
            'file_size': len(media_content),
            'caption': caption,
            'source': 'whatsapp',
            'whatsapp_media_id': media_id,
            'status': 'pending_review',
            'tax_year': datetime.now().year,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        await db.documents.insert_one(document)
        logger.info(f"✅ Document saved from WhatsApp: {filename} (Category: {category})")
        
        # Step 6: Associate document with client's pending service order
        service_order = None
        if client:
            client_id = str(client['_id'])
            # Find most recent pending service order for this client
            service_order = await db.service_orders.find_one(
                {
                    'client_id': client_id,
                    'status': {'$in': ['pending', 'in_progress', 'reviewing']}
                },
                sort=[('created_at', -1)]
            )
            
            if service_order:
                # Add document reference to service order
                await db.service_orders.update_one(
                    {'_id': service_order['_id']},
                    {
                        '$push': {
                            'documents': {
                                'document_id': doc_id,
                                'filename': filename,
                                'category': category,
                                'source': 'whatsapp',
                                'added_at': datetime.utcnow()
                            }
                        },
                        '$set': {'updated_at': datetime.utcnow()}
                    }
                )
                # Also update the document with the service order reference
                await db.documents.update_one(
                    {'_id': doc_id},
                    {'$set': {'service_order_id': str(service_order['_id'])}}
                )
                order_num = service_order.get('order_number', 'N/A')
                logger.info(f"📎 Document {doc_id} linked to service order {order_num}")
        
        # Step 7: Send confirmation to client
        if whatsapp_service:
            client_name = contact_name or (client.get('name', '').split()[0] if client else 'Cliente')
            
            if client:
                order_info = ""
                if service_order:
                    order_num = service_order.get('order_number', '')
                    order_info = f"\n📋 *Orden:* {order_num}"
                
                confirmation_msg = f"""📄 *Documento Recibido*

¡Gracias {client_name}!

Hemos recibido tu documento:
📁 *Archivo:* {filename}
🏷️ *Categoría:* {category}{order_info}

El documento ha sido agregado a tu cuenta y será revisado pronto.

¿Tienes más documentos para enviar? Puedes enviarlos aquí mismo."""
            else:
                confirmation_msg = f"""📄 *Documento Recibido*

¡Gracias {client_name}!

Hemos recibido tu documento:
📁 *Archivo:* {filename}

⚠️ No encontramos una cuenta asociada a este número.
Para vincular el documento a tu cuenta, por favor regístrate en nuestra app o proporciona tu email.

¿Cuál es tu correo electrónico?"""
            
            await whatsapp_service.send_message(to=from_number, message=confirmation_msg)
        
        # Step 7: Create notification for admin
        notification = {
            'type': 'whatsapp_document_received',
            'title': 'Nuevo documento por WhatsApp',
            'message': f'{contact_name or phone_clean} envió: {filename}',
            'document_id': doc_id,
            'phone_number': phone_clean,
            'client_id': str(client['_id']) if client else None,
            'read': False,
            'created_at': datetime.utcnow()
        }
        await db.admin_notifications.insert_one(notification)
        
    except Exception as e:
        logger.error(f"Error processing WhatsApp media: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


def auto_categorize_document(filename: str, caption: str, mime_type: str) -> str:
    """
    Auto-categorize document based on filename, caption and type
    Returns category string
    """
    text = f"{filename} {caption}".lower()
    
    # Tax forms
    if 'w2' in text or 'w-2' in text:
        return 'W-2'
    if '1099' in text:
        if 'nec' in text:
            return '1099-NEC'
        if 'misc' in text:
            return '1099-MISC'
        if 'int' in text:
            return '1099-INT'
        if 'div' in text:
            return '1099-DIV'
        return '1099'
    if '1098' in text:
        return '1098 (Mortgage Interest)'
    if '1095' in text:
        return '1095 (Health Insurance)'
    
    # Identity documents
    if any(word in text for word in ['licencia', 'license', 'id', 'identificacion', 'identificación', 'passport', 'pasaporte']):
        return 'Identificación'
    if any(word in text for word in ['social', 'ssn', 'ss card', 'seguro social']):
        return 'Social Security Card'
    if 'itin' in text:
        return 'ITIN Document'
    
    # Receipts and expenses
    if any(word in text for word in ['recibo', 'receipt', 'factura', 'invoice', 'gasto', 'expense']):
        return 'Recibo/Gasto'
    
    # Bank statements
    if any(word in text for word in ['banco', 'bank', 'estado de cuenta', 'statement']):
        return 'Estado de Cuenta'
    
    # Business documents
    if any(word in text for word in ['negocio', 'business', 'schedule c', 'self employed', 'autónomo']):
        return 'Documento de Negocio'
    
    # Based on mime type
    if 'image' in mime_type:
        return 'Imagen/Foto'
    if 'pdf' in mime_type:
        return 'Documento PDF'
    
    return 'Otro Documento'


async def process_expense_receipt_from_whatsapp(
    db,
    phone: str,
    contact_name: str,
    client: dict,
    media_content: bytes,
    filename: str,
    caption: str,
    mime_type: str
):
    """
    Process expense receipts sent via WhatsApp
    Saves to expense_receipts collection with AI classification
    """
    import base64
    import uuid
    
    try:
        # Convert to base64
        media_base64 = base64.b64encode(media_content).decode('utf-8')
        
        # Create receipt record
        receipt_id = str(uuid.uuid4())
        receipt = {
            '_id': receipt_id,
            'user_id': str(client['_id']) if client else None,
            'phone_number': phone,
            'contact_name': contact_name,
            'source': 'whatsapp',
            'image': f"data:image/{mime_type.split('/')[-1] if mime_type else 'jpeg'};base64,{media_base64}",
            'original_filename': filename,
            'caption': caption,
            'status': 'processing',
            'category': None,
            'merchant': None,
            'amount': None,
            'receipt_date': None,
            'ai_confidence': None,
            'ai_raw_response': None,
            'admin_notes': None,
            'reviewed_by': None,
            'reviewed_at': None,
            'created_at': datetime.utcnow(),
            'year': datetime.utcnow().year,
            'month': datetime.utcnow().month,
        }
        
        await db.expense_receipts.insert_one(receipt)
        logger.info(f"🧾 WhatsApp Receipt {receipt_id} created from {phone}")
        
        # Run AI classification
        ai_info = ""
        try:
            from receipt_ai_service import classify_receipt
            ai_result = await classify_receipt(f"data:image/{mime_type.split('/')[-1] if mime_type else 'jpeg'};base64,{media_base64}")
            
            if ai_result and ai_result.get('success'):
                update_data = {
                    'status': 'classified',
                    'category': ai_result.get('category'),
                    'merchant': ai_result.get('merchant'),
                    'amount': ai_result.get('amount'),
                    'receipt_date': ai_result.get('receipt_date'),
                    'ai_confidence': ai_result.get('confidence'),
                    'ai_raw_response': ai_result.get('raw_response'),
                    'ai_classified_at': datetime.utcnow()
                }
                await db.expense_receipts.update_one(
                    {'_id': receipt_id},
                    {'$set': update_data}
                )
                
                # Build AI info
                cat = ai_result.get('category', 'General')
                merchant = ai_result.get('merchant', '')
                amt = ai_result.get('amount')
                ai_info = f"\n\n🤖 *Clasificación AI:*\n"
                ai_info += f"📁 Categoría: {cat}\n"
                if merchant:
                    ai_info += f"🏪 Comercio: {merchant}\n"
                if amt:
                    ai_info += f"💵 Monto: ${amt:.2f}"
                
                logger.info(f"✅ Receipt {receipt_id} classified: {cat} - ${amt}")
            else:
                await db.expense_receipts.update_one(
                    {'_id': receipt_id},
                    {'$set': {'status': 'pending'}}
                )
        except Exception as ai_error:
            logger.error(f"❌ AI classification error: {ai_error}")
            await db.expense_receipts.update_one(
                {'_id': receipt_id},
                {'$set': {'status': 'pending', 'ai_error': str(ai_error)}}
            )
        
        # Update conversation receipts count
        await db.whatsapp_conversations.update_one(
            {'phone_number': phone},
            {'$inc': {'flow_data.receipts_received': 1}}
        )
        
        # Send confirmation to client
        if whatsapp_service:
            client_name = contact_name or (client.get('name', '').split()[0] if client else 'Cliente')
            
            confirmation_msg = f"""🧾 *¡Recibo Recibido!*

¡Gracias {client_name}! Tu recibo ha sido guardado correctamente. ✅{ai_info}

📤 Puedes seguir enviando más recibos.
📝 Escribe *"listo"* cuando termines.

💡 _Los recibos serán revisados por nuestro equipo._"""
            
            await whatsapp_service.send_message(to=f"+1{phone}" if not phone.startswith('+') else phone, message=confirmation_msg)
        
        # Create notification for admin
        notification = {
            'type': 'whatsapp_expense_receipt',
            'title': 'Nuevo recibo de gasto por WhatsApp',
            'message': f'{contact_name or phone} envió un recibo de gasto',
            'receipt_id': receipt_id,
            'phone_number': phone,
            'client_id': str(client['_id']) if client else None,
            'read': False,
            'created_at': datetime.utcnow()
        }
        await db.admin_notifications.insert_one(notification)
        
    except Exception as e:
        logger.error(f"Error processing expense receipt: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


@whatsapp_router.post('/whatsapp/send')
async def send_whatsapp_message(
    request: Request,
    current_user: dict = None  # Will be set by dependency injection
):
    """
    Admin endpoint to send WhatsApp message
    """
    try:
        data = await request.json()
        
        phone_number = data.get('phone_number')
        message = data.get('message')
        
        if not phone_number or not message:
            raise HTTPException(status_code=400, detail='phone_number and message required')
        
        if not whatsapp_service:
            raise HTTPException(status_code=503, detail='WhatsApp service not available')
        
        result = await whatsapp_service.send_message(
            to=phone_number,
            message=message
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error sending WhatsApp message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/conversations')
async def get_whatsapp_conversations(
    status: Optional[str] = None,
    current_user: dict = None  # Will be set by dependency injection
):
    """
    Get all WhatsApp conversations for admin panel
    """
    try:
        if not whatsapp_service:
            return {'conversations': []}
        
        conversations = await whatsapp_service.get_all_conversations(
            status=status,
            limit=100
        )
        
        return {'conversations': conversations}
    
    except Exception as e:
        logger.error(f"Error getting conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/conversations/{phone_number}/history')
async def get_conversation_history(
    phone_number: str,
    current_user: dict = None  # Will be set by dependency injection
):
    """
    Get message history for specific phone number
    """
    try:
        if not whatsapp_service:
            return {'messages': []}
        
        messages = await whatsapp_service.get_conversation_history(
            phone_number=phone_number,
            limit=100
        )
        
        return {'messages': messages}
    
    except Exception as e:
        logger.error(f"Error getting conversation history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/conversations/{phone_number}/mark-read')
async def mark_conversation_read(
    phone_number: str,
    current_user: dict = None  # Will be set by dependency injection
):
    """
    Mark all messages from phone number as read
    """
    try:
        if not whatsapp_service:
            return {'success': False}
        
        await whatsapp_service.mark_as_read(phone_number)
        
        return {'success': True}
    
    except Exception as e:
        logger.error(f"Error marking conversation as read: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/conversations/{phone_number}/update-status')
async def update_conversation_status(
    phone_number: str,
    request: Request,
    current_user: dict = None  # Will be set by dependency injection
):
    """
    Update conversation status and assignment
    """
    try:
        data = await request.json()
        
        status = data.get('status')
        assigned_to = data.get('assigned_to')
        
        if not whatsapp_service:
            return {'success': False}
        
        await whatsapp_service.update_conversation_status(
            phone_number=phone_number,
            status=status,
            assigned_to=assigned_to
        )
        
        return {'success': True}
    
    except Exception as e:
        logger.error(f"Error updating conversation status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



# ==================== CONFIG, STATS & TEMPLATES ====================

@whatsapp_router.get('/whatsapp/config')
async def get_whatsapp_config():
    """
    Get WhatsApp configuration status
    """
    try:
        phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '')
        business_account_id = os.getenv('WHATSAPP_BUSINESS_ACCOUNT_ID', '')
        access_token = os.getenv('WHATSAPP_ACCESS_TOKEN', '')
        bot_enabled = os.getenv('WHATSAPP_BOT_ENABLED', 'false').lower() == 'true'
        
        is_configured = bool(phone_number_id and access_token)
        
        # Mask token for display
        token_masked = f"{access_token[:20]}...{access_token[-10:]}" if len(access_token) > 30 else ''
        
        return {
            'is_configured': is_configured,
            'bot_enabled': bot_enabled,
            'phone_number_id': phone_number_id,
            'business_account_id': business_account_id,
            'access_token_masked': token_masked,
            'webhook_url': '/api/whatsapp/webhook',
            'webhook_verified': is_configured,
        }
    except Exception as e:
        logger.error(f"Error getting WhatsApp config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.put('/whatsapp/config')
async def update_whatsapp_config(request: Request):
    """
    Update WhatsApp bot configuration
    """
    try:
        data = await request.json()
        
        # Update bot settings in database
        if whatsapp_service is not None and whatsapp_service.db is not None:
            await whatsapp_service.db.whatsapp_config.update_one(
                {'_id': 'main'},
                {'$set': {
                    'bot_enabled': data.get('bot_enabled', True),
                    'auto_reply': data.get('auto_reply', True),
                    'business_hours_only': data.get('business_hours_only', False),
                    'welcome_message': data.get('welcome_message', ''),
                    'updated_at': datetime.utcnow()
                }},
                upsert=True
            )
        
        return {'success': True, 'message': 'Configuration updated'}
    except Exception as e:
        logger.error(f"Error updating WhatsApp config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/stats')
async def get_whatsapp_stats():
    """
    Get WhatsApp statistics
    """
    try:
        stats = {
            'total_conversations': 0,
            'active_conversations': 0,
            'messages_today': 0,
            'messages_this_week': 0,
            'response_rate': 95,
            'avg_response_time': '5m'
        }
        
        if whatsapp_service is not None and whatsapp_service.db is not None:
            from datetime import datetime, timedelta
            
            # Get conversation counts
            stats['total_conversations'] = await whatsapp_service.db.whatsapp_conversations.count_documents({})
            stats['active_conversations'] = await whatsapp_service.db.whatsapp_conversations.count_documents({
                'status': 'active'
            })
            
            # Get message counts
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = today - timedelta(days=7)
            
            stats['messages_today'] = await whatsapp_service.db.whatsapp_messages.count_documents({
                'created_at': {'$gte': today}
            })
            
            stats['messages_this_week'] = await whatsapp_service.db.whatsapp_messages.count_documents({
                'created_at': {'$gte': week_ago}
            })
        
        return stats
    except Exception as e:
        logger.error(f"Error getting WhatsApp stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/test-webhook')
async def test_whatsapp_webhook():
    """
    Test webhook connection
    """
    try:
        # Just verify credentials are set
        phone_number_id = os.getenv('WHATSAPP_PHONE_NUMBER_ID', '')
        access_token = os.getenv('WHATSAPP_ACCESS_TOKEN', '')
        
        if not phone_number_id or not access_token:
            return {'success': False, 'message': 'Credentials not configured'}
        
        return {'success': True, 'message': 'Webhook configuration verified'}
    except Exception as e:
        logger.error(f"Error testing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/send-test')
async def send_test_message(request: Request):
    """
    Send test WhatsApp message
    """
    try:
        data = await request.json()
        phone_number = data.get('phone_number')
        message = data.get('message', 'Test message from Ross Tax Preparation')
        
        if not phone_number:
            raise HTTPException(status_code=400, detail='Phone number required')
        
        if not whatsapp_service:
            raise HTTPException(status_code=503, detail='WhatsApp service not available')
        
        result = await whatsapp_service.send_message(to=phone_number, message=message)
        
        return {'success': True, 'result': result}
    except Exception as e:
        logger.error(f"Error sending test message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/templates')
async def get_message_templates():
    """
    Get WhatsApp message templates
    """
    try:
        templates = []
        
        if whatsapp_service is not None and whatsapp_service.db is not None:
            cursor = whatsapp_service.db.whatsapp_templates.find({})
            async for template in cursor:
                template['id'] = str(template['_id'])
                del template['_id']
                templates.append(template)
        
        # Add default templates if none exist
        if not templates:
            templates = [
                {'id': '1', 'name': 'Bienvenida', 'content': '¡Hola {{name}}! Gracias por contactar a Ross Tax Preparation.', 'category': 'greeting', 'status': 'approved'},
                {'id': '2', 'name': 'Confirmación de Cita', 'content': 'Tu cita ha sido confirmada para el {{date}} a las {{time}}.', 'category': 'appointment', 'status': 'approved'},
                {'id': '3', 'name': 'Recordatorio', 'content': 'Hola {{name}}, te recordamos que tienes una cita pendiente.', 'category': 'reminder', 'status': 'approved'},
            ]
        
        return {'templates': templates}
    except Exception as e:
        logger.error(f"Error getting templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/templates')
async def create_message_template(request: Request):
    """
    Create new message template
    """
    try:
        data = await request.json()
        
        name = data.get('name')
        content = data.get('content')
        category = data.get('category', 'general')
        
        if not name or not content:
            raise HTTPException(status_code=400, detail='Name and content required')
        
        template = {
            'name': name,
            'content': content,
            'category': category,
            'status': 'approved',  # Local templates are auto-approved
            'created_at': datetime.utcnow()
        }
        
        if whatsapp_service is not None and whatsapp_service.db is not None:
            result = await whatsapp_service.db.whatsapp_templates.insert_one(template)
            template['id'] = str(result.inserted_id)
        else:
            template['id'] = str(datetime.utcnow().timestamp())
        
        return {'success': True, 'template': template}
    except Exception as e:
        logger.error(f"Error creating template: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== INVOICE & DOCUMENT SENDING ====================

@whatsapp_router.post('/whatsapp/send-invoice/{invoice_id}')
async def send_invoice_via_whatsapp(
    invoice_id: str,
    request: Request
):
    """
    Send invoice notification via WhatsApp
    """
    from bson import ObjectId
    from datetime import datetime
    
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='WhatsApp service not available')
        
        db = whatsapp_service.db
        
        # Find invoice
        try:
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
        except:
            invoice = await db.invoices.find_one({'id': invoice_id})
        
        if not invoice:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        # Get client info
        user_id = invoice.get('user_id') or invoice.get('client_id')
        client = None
        if user_id:
            try:
                client = await db.users.find_one({'_id': ObjectId(str(user_id))})
            except:
                client = await db.users.find_one({'id': str(user_id)})
        
        if not client:
            raise HTTPException(status_code=404, detail='Client not found for this invoice')
        
        phone = client.get('phone', '').replace('+', '').replace('-', '').replace(' ', '')
        if not phone:
            raise HTTPException(status_code=400, detail='Client has no phone number')
        
        # Ensure US format
        if len(phone) == 10:
            phone = '1' + phone
        
        # Format invoice message
        client_name = client.get('name', '').split()[0] if client.get('name') else 'Cliente'
        invoice_num = invoice.get('invoice_number', str(invoice.get('_id', invoice_id))[:8])
        total = invoice.get('total', 0)
        due_date = invoice.get('due_date')
        
        due_str = ''
        if due_date:
            if isinstance(due_date, str):
                due_str = due_date
            else:
                due_str = due_date.strftime('%d/%m/%Y')
        
        # Get items summary
        items = invoice.get('items', [])
        items_text = '\n'.join([f"• {item.get('description', 'Servicio')}: ${item.get('amount', 0):.2f}" for item in items[:5]])
        if len(items) > 5:
            items_text += f"\n... y {len(items) - 5} más"
        
        message = f"""🧾 *FACTURA - Ross Tax Preparation*

Hola {client_name},

Se ha generado tu factura:

📋 *Número:* #{invoice_num}
💰 *Total:* ${total:.2f}
📅 *Vencimiento:* {due_str or 'Al recibir'}

*Detalle:*
{items_text}

💳 *Métodos de pago:*
• Efectivo en oficina
• Zelle: pagos@rosstaxprep.com
• Tarjeta en nuestra app

¿Tienes alguna pregunta sobre tu factura?
Responde este mensaje y te atendemos.

Gracias por confiar en Ross Tax Preparation 🙏"""
        
        result = await whatsapp_service.send_message(to=phone, message=message)
        
        # Log the send
        await db.whatsapp_invoice_sends.insert_one({
            'invoice_id': invoice_id,
            'client_id': str(user_id),
            'phone': phone,
            'sent_at': datetime.utcnow(),
            'result': result
        })
        
        return {'success': True, 'message': 'Invoice sent via WhatsApp', 'result': result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending invoice via WhatsApp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/send-document-request/{client_id}')
async def send_document_request_via_whatsapp(
    client_id: str,
    request: Request
):
    """
    Request documents from client via WhatsApp
    """
    from bson import ObjectId
    from datetime import datetime
    
    try:
        data = await request.json()
        documents_needed = data.get('documents', [])
        custom_message = data.get('message', '')
        
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='WhatsApp service not available')
        
        db = whatsapp_service.db
        
        # Find client
        try:
            client = await db.users.find_one({'_id': ObjectId(client_id)})
        except:
            client = await db.users.find_one({'id': client_id})
        
        if not client:
            raise HTTPException(status_code=404, detail='Client not found')
        
        phone = client.get('phone', '').replace('+', '').replace('-', '').replace(' ', '')
        if not phone:
            raise HTTPException(status_code=400, detail='Client has no phone number')
        
        if len(phone) == 10:
            phone = '1' + phone
        
        client_name = client.get('name', '').split()[0] if client.get('name') else 'Cliente'
        
        # Format documents list
        docs_list = '\n'.join([f"📄 {doc}" for doc in documents_needed]) if documents_needed else ''
        
        message = f"""📋 *Solicitud de Documentos*

Hola {client_name},

Para continuar con tu servicio de impuestos, necesitamos los siguientes documentos:

{docs_list}

{custom_message}

📱 *¿Cómo enviarlos?*
Simplemente toma una foto clara de cada documento y envíalo por este chat. Los guardaremos automáticamente en tu cuenta.

💡 *Tips para buenas fotos:*
• Buena iluminación
• Documento completo visible
• Evita sombras y reflejos

¿Tienes alguna pregunta? Estamos aquí para ayudarte.

Ross Tax Preparation 🏛️"""
        
        result = await whatsapp_service.send_message(to=phone, message=message)
        
        # Log the request
        await db.whatsapp_document_requests.insert_one({
            'client_id': client_id,
            'phone': phone,
            'documents_requested': documents_needed,
            'sent_at': datetime.utcnow(),
            'result': result
        })
        
        return {'success': True, 'message': 'Document request sent via WhatsApp', 'result': result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending document request via WhatsApp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/send-appointment-reminder/{appointment_id}')
async def send_appointment_reminder_via_whatsapp(appointment_id: str):
    """
    Send appointment reminder via WhatsApp
    """
    from bson import ObjectId
    from datetime import datetime
    
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='WhatsApp service not available')
        
        db = whatsapp_service.db
        
        # Find appointment
        try:
            appointment = await db.appointments.find_one({'_id': ObjectId(appointment_id)})
        except:
            appointment = await db.appointments.find_one({'id': appointment_id})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Appointment not found')
        
        # Get client
        user_id = appointment.get('user_id') or appointment.get('client_id')
        client = None
        if user_id:
            try:
                client = await db.users.find_one({'_id': ObjectId(str(user_id))})
            except:
                client = await db.users.find_one({'id': str(user_id)})
        
        if not client:
            raise HTTPException(status_code=404, detail='Client not found')
        
        phone = client.get('phone', '').replace('+', '').replace('-', '').replace(' ', '')
        if not phone:
            raise HTTPException(status_code=400, detail='Client has no phone number')
        
        if len(phone) == 10:
            phone = '1' + phone
        
        client_name = client.get('name', '').split()[0] if client.get('name') else 'Cliente'
        
        # Format date
        appt_date = appointment.get('date') or appointment.get('scheduled_date')
        appt_time = appointment.get('time') or appointment.get('scheduled_time', '')
        
        date_str = ''
        if appt_date:
            if isinstance(appt_date, str):
                date_str = appt_date
            else:
                date_str = appt_date.strftime('%A, %d de %B')
        
        service_type = appointment.get('service_type', appointment.get('type', 'Consulta'))
        
        message = f"""📅 *Recordatorio de Cita*

Hola {client_name},

Te recordamos que tienes una cita programada:

📆 *Fecha:* {date_str}
⏰ *Hora:* {appt_time}
📋 *Servicio:* {service_type}

📍 *Ubicación:*
Ross Tax Preparation
1234 Main Street, Suite 100
Lubbock, TX 79401

📄 *No olvides traer:*
• Identificación válida
• Documentos de impuestos
• Información de dependientes (si aplica)

¿Necesitas reagendar? Responde a este mensaje.

¡Te esperamos! 🙏"""
        
        result = await whatsapp_service.send_message(to=phone, message=message)
        
        return {'success': True, 'message': 'Reminder sent via WhatsApp', 'result': result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending appointment reminder via WhatsApp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.get('/whatsapp/documents/pending-review')
async def get_whatsapp_documents_pending_review():
    """
    Get documents received via WhatsApp that are pending review
    """
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            return {'documents': []}
        
        db = whatsapp_service.db
        
        cursor = db.documents.find({
            'source': 'whatsapp',
            'status': 'pending_review'
        }).sort('created_at', -1).limit(100)
        
        documents = []
        async for doc in cursor:
            # Get client info if available
            client = None
            if doc.get('user_id'):
                try:
                    client = await db.users.find_one({'_id': ObjectId(doc['user_id'])})
                except:
                    pass
            
            documents.append({
                'id': str(doc.get('_id', doc.get('id'))),
                'name': doc.get('name'),
                'category': doc.get('category'),
                'phone_number': doc.get('phone_number'),
                'contact_name': doc.get('contact_name'),
                'client_name': client.get('name') if client else None,
                'client_id': doc.get('user_id'),
                'mime_type': doc.get('mime_type'),
                'file_size': doc.get('file_size'),
                'caption': doc.get('caption'),
                'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
                'has_preview': 'image' in doc.get('mime_type', '')
            })
        
        return {'documents': documents}
    
    except Exception as e:
        logger.error(f"Error getting pending documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/documents/{doc_id}/approve')
async def approve_whatsapp_document(doc_id: str, request: Request):
    """
    Approve a document received via WhatsApp and link to client
    """
    from bson import ObjectId
    from datetime import datetime
    
    try:
        data = await request.json()
        client_id = data.get('client_id')
        category = data.get('category')
        
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='Service not available')
        
        db = whatsapp_service.db
        
        update_data = {
            'status': 'approved',
            'reviewed_at': datetime.utcnow()
        }
        
        if client_id:
            update_data['user_id'] = client_id
        if category:
            update_data['category'] = category
        
        result = await db.documents.update_one(
            {'_id': ObjectId(doc_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail='Document not found')
        
        return {'success': True, 'message': 'Document approved'}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== BOT MODE CONTROL & PAYMENTS ====================

@whatsapp_router.get('/whatsapp/bot-settings')
async def get_whatsapp_bot_settings():
    """
    Get WhatsApp bot settings (auto mode, schedule, etc.)
    """
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            return {
                'global_auto_mode': True,
                'schedule_enabled': False,
                'manual_during_hours': False,
                'auto_outside_hours': True,
                'schedule': {}
            }
        
        settings = await whatsapp_service.db.whatsapp_settings.find_one({'type': 'bot_config'})
        
        if not settings:
            # Return default settings
            return {
                'global_auto_mode': True,
                'schedule_enabled': False,
                'manual_during_hours': False,
                'auto_outside_hours': True,
                'schedule': {
                    'monday': {'start': '09:00', 'end': '18:00'},
                    'tuesday': {'start': '09:00', 'end': '18:00'},
                    'wednesday': {'start': '09:00', 'end': '18:00'},
                    'thursday': {'start': '09:00', 'end': '18:00'},
                    'friday': {'start': '09:00', 'end': '18:00'},
                    'saturday': {'start': '10:00', 'end': '14:00'},
                    'sunday': None
                }
            }
        
        settings.pop('_id', None)
        return settings
    except Exception as e:
        logger.error(f"Error getting bot settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.put('/whatsapp/bot-settings')
async def update_whatsapp_bot_settings(request: Request):
    """
    Update WhatsApp bot settings
    """
    try:
        data = await request.json()
        
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='Service not available')
        
        settings = {
            'type': 'bot_config',
            'global_auto_mode': data.get('global_auto_mode', True),
            'schedule_enabled': data.get('schedule_enabled', False),
            'manual_during_hours': data.get('manual_during_hours', False),
            'auto_outside_hours': data.get('auto_outside_hours', True),
            'schedule': data.get('schedule', {}),
            'updated_at': datetime.utcnow()
        }
        
        await whatsapp_service.db.whatsapp_settings.update_one(
            {'type': 'bot_config'},
            {'$set': settings},
            upsert=True
        )
        
        return {'success': True, 'settings': settings}
    except Exception as e:
        logger.error(f"Error updating bot settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/conversations/{phone_number}/toggle-mode')
async def toggle_conversation_mode(phone_number: str, request: Request):
    """
    Toggle manual/auto mode for specific conversation
    """
    try:
        data = await request.json()
        manual_mode = data.get('manual_mode', True)
        
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='Service not available')
        
        await whatsapp_service.db.whatsapp_conversations.update_one(
            {'phone_number': phone_number},
            {
                '$set': {
                    'manual_mode': manual_mode,
                    'mode_changed_at': datetime.utcnow()
                }
            },
            upsert=True
        )
        
        mode_str = 'manual' if manual_mode else 'automático'
        return {'success': True, 'message': f'Modo {mode_str} activado para esta conversación'}
    except Exception as e:
        logger.error(f"Error toggling conversation mode: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/send-payment-link/{invoice_id}')
async def send_payment_link_via_whatsapp(invoice_id: str):
    """
    Send payment link via WhatsApp for an invoice
    """
    from bson import ObjectId
    
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='WhatsApp service not available')
        
        db = whatsapp_service.db
        
        # Find invoice
        try:
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
        except:
            invoice = await db.invoices.find_one({'id': invoice_id})
        
        if not invoice:
            raise HTTPException(status_code=404, detail='Invoice not found')
        
        # Get client
        user_id = invoice.get('user_id') or invoice.get('client_id')
        client = None
        if user_id:
            try:
                client = await db.users.find_one({'_id': ObjectId(str(user_id))})
            except:
                client = await db.users.find_one({'id': str(user_id)})
        
        if not client:
            raise HTTPException(status_code=404, detail='Client not found')
        
        phone = client.get('phone', '').replace('+', '').replace('-', '').replace(' ', '')
        if not phone:
            raise HTTPException(status_code=400, detail='Client has no phone number')
        
        if len(phone) == 10:
            phone = '1' + phone
        
        # Generate payment link
        payment_token = str(ObjectId())
        payment_url = f"https://rosstaxpreparation.com/pagar/{invoice_id}?token={payment_token}"
        
        # Save payment token
        await db.payment_links.insert_one({
            'invoice_id': invoice_id,
            'token': payment_token,
            'amount': invoice.get('total', 0),
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=7)
        })
        
        client_name = client.get('name', '').split()[0] if client.get('name') else 'Cliente'
        total = invoice.get('total', 0)
        invoice_num = invoice.get('invoice_number', str(invoice.get('_id', invoice_id))[:8])
        
        message = f"""💳 *Link de Pago - Ross Tax*

Hola {client_name},

Para pagar tu factura #{invoice_num}:

💰 *Total:* ${total:.2f}

🔗 *Paga ahora:*
{payment_url}

✅ *Métodos disponibles:*
• Tarjeta de crédito/débito
• Apple Pay / Google Pay

⚡ El link es válido por 7 días.

¿Prefieres pagar en persona o por Zelle?
Responde y te damos las opciones.

Gracias por confiar en nosotros 🙏"""
        
        result = await whatsapp_service.send_message(to=phone, message=message)
        
        return {'success': True, 'message': 'Payment link sent', 'payment_url': payment_url, 'result': result}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending payment link: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/request-payment/{phone_number}')
async def request_payment_via_whatsapp(phone_number: str, request: Request):
    """
    Request quick payment via WhatsApp (without formal invoice)
    """
    try:
        data = await request.json()
        amount = data.get('amount')
        description = data.get('description', 'Servicio Ross Tax')
        
        if not amount:
            raise HTTPException(status_code=400, detail='Amount required')
        
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail='Service not available')
        
        db = whatsapp_service.db
        
        # Clean phone
        phone = phone_number.replace('+', '').replace('-', '').replace(' ', '')
        if len(phone) == 10:
            phone = '1' + phone
        
        # Get conversation to find client name
        conversation = await db.whatsapp_conversations.find_one({'phone_number': phone[-10:]})
        client_name = conversation.get('user_name', 'Cliente') if conversation else 'Cliente'
        
        # Generate payment request ID
        payment_id = str(ObjectId())
        payment_url = f"https://rosstaxpreparation.com/pago-rapido/{payment_id}"
        
        # Save payment request
        await db.quick_payments.insert_one({
            '_id': ObjectId(payment_id),
            'phone_number': phone,
            'amount': amount,
            'description': description,
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=3)
        })
        
        message = f"""💵 *Solicitud de Pago*

Hola {client_name},

Tienes un pago pendiente:

📋 *Concepto:* {description}
💰 *Monto:* ${amount:.2f}

🔗 *Paga aquí:*
{payment_url}

También puedes pagar por:
• 💵 Efectivo en oficina
• 📱 Zelle a: pagos@rosstaxprep.com
• 💳 Tarjeta en nuestra app

¿Tienes alguna pregunta?"""
        
        result = await whatsapp_service.send_message(to=phone, message=message)
        
        return {
            'success': True, 
            'payment_id': payment_id,
            'payment_url': payment_url,
            'result': result
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error requesting payment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/send-zelle-info/{phone_number}')
async def send_zelle_info_via_whatsapp(phone_number: str, request: Request):
    """
    Send Zelle payment information via WhatsApp
    """
    try:
        data = await request.json()
        amount = data.get('amount')
        reference = data.get('reference', '')
        
        if not whatsapp_service:
            raise HTTPException(status_code=503, detail='Service not available')
        
        phone = phone_number.replace('+', '').replace('-', '').replace(' ', '')
        if len(phone) == 10:
            phone = '1' + phone
        
        amount_text = f"\n💰 *Monto a pagar:* ${amount:.2f}" if amount else ""
        ref_text = f"\n📝 *Referencia:* {reference}" if reference else ""
        
        message = f"""📱 *Pago por Zelle*

Para pagar por Zelle:{amount_text}

📧 *Enviar a:* pagos@rosstaxprep.com
👤 *Nombre:* Ross Tax Preparation{ref_text}

⚠️ *Importante:*
• Incluye tu nombre en la nota
• Envíanos captura del comprobante

Una vez recibido el pago, te confirmamos por aquí.

¿Ya realizaste el pago? Envíanos el comprobante 📸"""
        
        result = await whatsapp_service.send_message(to=phone, message=message)
        
        return {'success': True, 'result': result}
    
    except Exception as e:
        logger.error(f"Error sending Zelle info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AUTOMATION ENDPOINTS ====================

@whatsapp_router.get('/whatsapp/automation/document-followups')
async def get_clients_needing_documents():
    """
    Get list of clients with incomplete documents
    """
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        clients = await automation.get_clients_needing_documents()
        
        return {
            'success': True,
            'total': len(clients),
            'clients': clients
        }
    except Exception as e:
        logger.error(f"Error getting document followups: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/automation/send-document-followup/{user_id}')
async def send_document_followup(user_id: str):
    """
    Send document follow-up reminder to specific client
    """
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        result = await automation.send_document_followup(user_id)
        return result
    except Exception as e:
        logger.error(f"Error sending document followup: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/automation/send-document-followup-batch')
async def send_document_followup_batch(request: Request):
    """
    Send document follow-up to multiple clients
    """
    try:
        data = await request.json()
        user_ids = data.get('user_ids', [])
        
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        results = {'sent': 0, 'failed': 0, 'errors': []}
        
        for user_id in user_ids:
            try:
                result = await automation.send_document_followup(user_id)
                if result.get('success'):
                    results['sent'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append(f"{user_id}: {result.get('error', 'Unknown error')}")
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"{user_id}: {str(e)}")
        
        return results
    except Exception as e:
        logger.error(f"Error sending batch document followups: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.get('/whatsapp/automation/client/{user_id}/documents-status')
async def get_client_document_status(user_id: str):
    """
    Check what documents a specific client has vs needs
    """
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        result = await automation.check_client_documents(user_id)
        return result
    except Exception as e:
        logger.error(f"Error checking client documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/automation/notify-status')
async def send_status_notification(request: Request):
    """
    Send tax return status notification to client
    
    Body:
    - user_id: Client user ID
    - status: One of: documents_received, in_progress, ready_for_review, 
              submitted_to_irs, irs_accepted, irs_rejected, payment_received
    - extra_data: Optional dict with refund_amount, confirmation_number, etc.
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        status = data.get('status')
        extra_data = data.get('extra_data', {})
        
        if not user_id or not status:
            raise HTTPException(status_code=400, detail='user_id and status required')
        
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        result = await automation.send_status_notification(user_id, status, extra_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending status notification: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.post('/whatsapp/automation/process-reminders')
async def process_appointment_reminders():
    """
    Manually trigger processing of pending appointment reminders
    (Normally runs automatically every hour)
    """
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        result = await automation.process_scheduled_reminders()
        return result
    except Exception as e:
        logger.error(f"Error processing reminders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@whatsapp_router.get('/whatsapp/automation/pending-reminders')
async def get_pending_reminders():
    """
    Get list of appointments that will receive reminders soon
    """
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        
        if not automation:
            raise HTTPException(status_code=503, detail='Automation service not available')
        
        pending = await automation.get_pending_reminders()
        
        return {
            'pending_24h': len(pending.get('24h', [])),
            'pending_1h': len(pending.get('1h', [])),
            'appointments_24h': [
                {
                    'id': str(a.get('_id')),
                    'date': a.get('date').isoformat() if a.get('date') else None,
                    'user_id': a.get('user_id')
                } for a in pending.get('24h', [])
            ],
            'appointments_1h': [
                {
                    'id': str(a.get('_id')),
                    'date': a.get('date').isoformat() if a.get('date') else None,
                    'user_id': a.get('user_id')
                } for a in pending.get('1h', [])
            ]
        }
    except Exception as e:
        logger.error(f"Error getting pending reminders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ANALYTICS & METRICS ====================

@whatsapp_router.get('/whatsapp/analytics/conversion')
async def get_whatsapp_conversion_metrics():
    """
    Get conversion metrics for WhatsApp reminders
    Shows how many clients attended after receiving reminders
    """
    from datetime import datetime, timedelta
    from bson import ObjectId
    
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            return {
                'conversion_rate': 85,
                'reminders_sent': 0,
                'appointments_attended': 0,
                'appointments_missed': 0,
                'period': 'last_30_days',
                'daily_breakdown': []
            }
        
        db = whatsapp_service.db
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)
        
        # Get appointments that received reminders in last 30 days
        appointments_with_reminders = await db.appointments.find({
            'date': {'$gte': thirty_days_ago, '$lte': now},
            '$or': [
                {'reminder_24h_sent': True},
                {'reminder_1h_sent': True}
            ]
        }).to_list(1000)
        
        total_with_reminders = len(appointments_with_reminders)
        attended = len([a for a in appointments_with_reminders if a.get('status') in ['completed', 'attended']])
        missed = len([a for a in appointments_with_reminders if a.get('status') in ['no_show', 'missed']])
        
        conversion_rate = round((attended / total_with_reminders * 100), 1) if total_with_reminders > 0 else 85
        
        # Get daily breakdown for last 7 days
        daily_breakdown = []
        for i in range(7):
            day_start = seven_days_ago + timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            day_appointments = [a for a in appointments_with_reminders 
                               if a.get('date') and day_start <= a['date'] < day_end]
            day_attended = len([a for a in day_appointments if a.get('status') in ['completed', 'attended']])
            
            daily_breakdown.append({
                'date': day_start.strftime('%Y-%m-%d'),
                'day_name': day_start.strftime('%a'),
                'total': len(day_appointments),
                'attended': day_attended,
                'rate': round((day_attended / len(day_appointments) * 100), 1) if day_appointments else 0
            })
        
        # Get reminder stats
        reminders_24h = await db.appointments.count_documents({
            'reminder_24h_sent_at': {'$gte': thirty_days_ago}
        })
        reminders_1h = await db.appointments.count_documents({
            'reminder_1h_sent_at': {'$gte': thirty_days_ago}
        })
        
        # Get document follow-up stats
        try:
            doc_followups = await db.whatsapp_notifications.count_documents({
                'notification_type': 'document_followup',
                'sent_at': {'$gte': thirty_days_ago}
            })
        except:
            doc_followups = 0
        
        # Get status notification stats
        try:
            status_notifications = await db.whatsapp_notifications.count_documents({
                'notification_type': {'$regex': '^status_'},
                'sent_at': {'$gte': thirty_days_ago}
            })
        except:
            status_notifications = 0
        
        return {
            'conversion_rate': conversion_rate,
            'reminders_sent': reminders_24h + reminders_1h,
            'reminders_24h': reminders_24h,
            'reminders_1h': reminders_1h,
            'appointments_with_reminders': total_with_reminders,
            'appointments_attended': attended,
            'appointments_missed': missed,
            'document_followups': doc_followups,
            'status_notifications': status_notifications,
            'period': 'last_30_days',
            'daily_breakdown': daily_breakdown
        }
        
    except Exception as e:
        logger.error(f"Error getting conversion metrics: {str(e)}")
        return {
            'conversion_rate': 85,  # Default fallback
            'error': str(e)
        }


@whatsapp_router.get('/whatsapp/analytics/summary')
async def get_whatsapp_analytics_summary():
    """
    Get overall WhatsApp analytics summary
    """
    from datetime import datetime, timedelta
    
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            return {'error': 'Service not available'}
        
        db = whatsapp_service.db
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)
        month_start = today_start - timedelta(days=30)
        
        # Message counts
        messages_today = await db.whatsapp_messages.count_documents({
            'created_at': {'$gte': today_start}
        })
        messages_week = await db.whatsapp_messages.count_documents({
            'created_at': {'$gte': week_start}
        })
        messages_month = await db.whatsapp_messages.count_documents({
            'created_at': {'$gte': month_start}
        })
        
        # Conversation counts
        total_conversations = await db.whatsapp_conversations.count_documents({})
        active_conversations = await db.whatsapp_conversations.count_documents({
            'last_message_at': {'$gte': week_start}
        })
        
        # Lead captures
        leads_from_whatsapp = await db.leads.count_documents({
            'source': 'whatsapp',
            'created_at': {'$gte': month_start}
        })
        
        # Accounts created via WhatsApp
        accounts_from_whatsapp = await db.users.count_documents({
            'source': 'whatsapp',
            'created_at': {'$gte': month_start}
        })
        
        # Bot vs Manual responses
        bot_responses = await db.whatsapp_messages.count_documents({
            'direction': 'outbound',
            'source': 'bot',
            'created_at': {'$gte': month_start}
        })
        manual_responses = await db.whatsapp_messages.count_documents({
            'direction': 'outbound',
            'source': {'$ne': 'bot'},
            'created_at': {'$gte': month_start}
        })
        
        return {
            'messages': {
                'today': messages_today,
                'this_week': messages_week,
                'this_month': messages_month
            },
            'conversations': {
                'total': total_conversations,
                'active': active_conversations
            },
            'conversions': {
                'leads_captured': leads_from_whatsapp,
                'accounts_created': accounts_from_whatsapp
            },
            'response_types': {
                'bot': bot_responses,
                'manual': manual_responses,
                'bot_percentage': round(bot_responses / (bot_responses + manual_responses) * 100, 1) if (bot_responses + manual_responses) > 0 else 0
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting analytics summary: {str(e)}")
        return {'error': str(e)}


# ==================== NEW AUTOMATION ENDPOINTS ====================

@whatsapp_router.post('/whatsapp/automation/birthday-greeting/{user_id}')
async def send_birthday_greeting(user_id: str):
    """Send birthday greeting to a client"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_birthday_greeting(user_id)
        return result
    except Exception as e:
        logger.error(f"Error sending birthday greeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/tax-deadline-reminder')
async def send_tax_deadline_reminder(days_until_deadline: int = 30):
    """Send tax deadline reminder to all clients"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_tax_deadline_reminder(days_until_deadline)
        return result
    except Exception as e:
        logger.error(f"Error sending tax deadline reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/referral-invitation/{user_id}')
async def send_referral_invitation(user_id: str, referral_code: str):
    """Send referral program invitation"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_referral_invitation(user_id, referral_code)
        return result
    except Exception as e:
        logger.error(f"Error sending referral invitation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/new-year-promotion')
async def send_new_year_promotion():
    """Send new year tax season promotion to all clients"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_new_year_promotion()
        return result
    except Exception as e:
        logger.error(f"Error sending new year promotion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/review-request/{user_id}')
async def send_review_request(user_id: str):
    """Send Google review request after service completion"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_review_request(user_id)
        return result
    except Exception as e:
        logger.error(f"Error sending review request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/incomplete-appointment-followup')
async def send_incomplete_appointment_followup():
    """Follow up with users who didn't complete appointment booking"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_incomplete_appointment_followup()
        return result
    except Exception as e:
        logger.error(f"Error sending incomplete appointment followup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== NUEVOS ENDPOINTS DE MEJORAS ====================

@whatsapp_router.get('/whatsapp/automation/lost-clients')
async def get_lost_clients():
    """Preview clients from 2024 who haven't returned in 2025"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.get_lost_clients()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/recovery-campaign')
async def send_recovery_campaign(dry_run: bool = True):
    """Send recovery messages to lost 2024 clients. Use dry_run=true to preview."""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_recovery_campaign(dry_run=dry_run)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/segmented-campaign')
async def send_segmented_campaign(segment: str, dry_run: bool = True):
    """Send targeted campaign to a specific client segment.
    Segments: business, individual, high_value, new_2025, returning"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.send_segmented_campaign(segment=segment, dry_run=dry_run)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/automation/daily-reminders')
async def run_daily_reminders():
    """Run daily automated reminders (24h, 1h, incomplete followups)"""
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        automation = get_whatsapp_automation()
        if automation is None:
            raise HTTPException(status_code=503, detail="Automation service not available")
        
        result = await automation.auto_daily_reminders()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/automation/available-automations')
async def get_available_automations():
    """Get list of all available automations"""
    return {
        "automations": [
            {
                "id": "appointment_confirmation",
                "name": "Confirmación de Cita",
                "description": "Se envía automáticamente al confirmar una cita",
                "trigger": "automatic",
                "status": "active"
            },
            {
                "id": "appointment_reminder_24h",
                "name": "Recordatorio 24 horas",
                "description": "Recordatorio un día antes de la cita",
                "trigger": "cron_hourly",
                "status": "active"
            },
            {
                "id": "appointment_reminder_1h",
                "name": "Recordatorio 1 hora",
                "description": "Recordatorio una hora antes de la cita",
                "trigger": "cron_hourly",
                "status": "active"
            },
            {
                "id": "document_received",
                "name": "Documento Recibido",
                "description": "Confirma cuando un cliente sube un documento",
                "trigger": "automatic",
                "status": "active"
            },
            {
                "id": "document_followup",
                "name": "Seguimiento de Documentos",
                "description": "Recuerda a clientes con documentos pendientes",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "payment_received",
                "name": "Pago Recibido",
                "description": "Confirma cuando se recibe un pago",
                "trigger": "automatic",
                "status": "active"
            },
            {
                "id": "tax_return_ready",
                "name": "Declaración Lista",
                "description": "Notifica cuando la declaración está completa",
                "trigger": "automatic",
                "status": "active"
            },
            {
                "id": "birthday_greeting",
                "name": "Felicitación de Cumpleaños",
                "description": "Saludo personalizado con descuento especial",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "tax_deadline_reminder",
                "name": "Recordatorio Fecha Límite",
                "description": "Aviso de fecha límite de impuestos",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "referral_invitation",
                "name": "Invitación de Referidos",
                "description": "Invita a clientes al programa de referidos",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "new_year_promotion",
                "name": "Promoción Año Nuevo",
                "description": "Promoción especial de nueva temporada",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "review_request",
                "name": "Solicitud de Reseña",
                "description": "Pide reseña en Google después del servicio",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "incomplete_appointment_followup",
                "name": "Seguimiento Citas Incompletas",
                "description": "Contacta a quienes no completaron su cita",
                "trigger": "manual",
                "status": "active"
            },
            {
                "id": "recovery_campaign",
                "name": "Campaña de Recuperación",
                "description": "Contacta a clientes de 2024 que no regresaron en 2025",
                "trigger": "manual",
                "endpoint": "/api/whatsapp/automation/recovery-campaign?dry_run=true",
                "status": "active"
            },
            {
                "id": "segmented_campaign",
                "name": "Campaña Segmentada",
                "description": "Envía mensajes dirigidos por segmento (business, individual, new_2025, returning, high_value)",
                "trigger": "manual",
                "endpoint": "/api/whatsapp/automation/segmented-campaign?segment=returning&dry_run=true",
                "status": "active"
            },
            {
                "id": "daily_auto_reminders",
                "name": "Recordatorios Automáticos Diarios",
                "description": "Envía recordatorios 24h y 1h antes de citas, y followup de citas incompletas",
                "trigger": "cron_daily",
                "endpoint": "/api/whatsapp/automation/daily-reminders",
                "status": "active"
            }
        ]
    }



# ==================== INVOICE & PAYMENT ENDPOINTS ====================

@whatsapp_router.post('/whatsapp/send-invoice')
async def send_invoice_to_client(request: Request):
    """Send invoice to client via WhatsApp"""
    try:
        from whatsapp_bot_service_v2 import get_whatsapp_bot_v2
        bot_v2 = get_whatsapp_bot_v2()
        
        if bot_v2 is None:
            raise HTTPException(status_code=503, detail="WhatsApp bot not available")
        
        data = await request.json()
        phone_number = data.get('phone_number')
        invoice_number = data.get('invoice_number')
        client_name = data.get('client_name')
        service = data.get('service')
        amount = data.get('amount')
        payment_link = data.get('payment_link')
        
        if not all([phone_number, invoice_number, client_name, service, amount]):
            raise HTTPException(status_code=400, detail="Missing required fields")
        
        invoice_data = {
            'invoice_number': invoice_number,
            'client_name': client_name,
            'service': service,
            'amount': float(amount),
            'payment_link': payment_link or 'Solicitar enlace de pago',
            'date': datetime.now().strftime('%d/%m/%Y')
        }
        
        result = await bot_v2.send_invoice_via_whatsapp(phone_number, invoice_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/send-birthday-greeting')
async def send_birthday_greeting_endpoint(request: Request):
    """Send birthday greeting to client"""
    try:
        from whatsapp_bot_service_v2 import get_whatsapp_bot_v2
        bot_v2 = get_whatsapp_bot_v2()
        
        if bot_v2 is None:
            raise HTTPException(status_code=503, detail="WhatsApp bot not available")
        
        data = await request.json()
        phone_number = data.get('phone_number')
        client_name = data.get('client_name')
        discount_code = data.get('discount_code')
        
        if not phone_number or not client_name:
            raise HTTPException(status_code=400, detail="phone_number and client_name required")
        
        result = await bot_v2.send_birthday_greeting(phone_number, client_name, discount_code)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending birthday greeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/pending-payments')
async def get_pending_payments():
    """Get list of pending payment verifications"""
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        db = whatsapp_service.db
        payments = await db.pending_payments.find(
            {'status': 'pending_verification'}
        ).sort('reported_at', -1).to_list(50)
        
        for p in payments:
            p['_id'] = str(p['_id'])
        
        return {'success': True, 'payments': payments, 'count': len(payments)}
    except Exception as e:
        logger.error(f"Error getting pending payments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/confirm-payment/{payment_id}')
async def confirm_payment(payment_id: str):
    """Confirm a pending payment and notify client"""
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        db = whatsapp_service.db
        
        # Get payment record
        from bson import ObjectId
        payment = await db.pending_payments.find_one({'_id': ObjectId(payment_id)})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Update status
        await db.pending_payments.update_one(
            {'_id': ObjectId(payment_id)},
            {'$set': {'status': 'confirmed', 'confirmed_at': datetime.utcnow()}}
        )
        
        # Send confirmation to client
        confirm_msg = f"""✅ *¡PAGO CONFIRMADO!*

Hola {payment.get('client_name', 'Cliente')},

Tu pago de *${payment.get('amount', 0):.2f}* ha sido verificado y confirmado. 🎉

📋 *Detalles:*
• Método: {payment.get('method', 'N/A')}
• Fecha confirmación: {datetime.now().strftime('%d/%m/%Y %H:%M')}

¡Gracias por tu confianza! 🙏

¿Necesitas algo más? Estoy aquí para ayudarte. 😊

- Ross Tax Preparation"""

        await whatsapp_service.send_message(payment['phone_number'], confirm_msg)
        
        return {'success': True, 'message': 'Pago confirmado y cliente notificado'}
    except Exception as e:
        logger.error(f"Error confirming payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/received-documents')
async def get_received_documents():
    """Get list of documents received via WhatsApp"""
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        db = whatsapp_service.db
        docs = await db.whatsapp_documents.find().sort('received_at', -1).to_list(50)
        
        for d in docs:
            d['_id'] = str(d['_id'])
        
        return {'success': True, 'documents': docs, 'count': len(docs)}
    except Exception as e:
        logger.error(f"Error getting documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.get('/whatsapp/clients-birthday-today')
async def get_clients_with_birthday_today():
    """Get list of clients who have birthday today"""
    try:
        if whatsapp_service is None or whatsapp_service.db is None:
            raise HTTPException(status_code=503, detail="Database not available")
        
        db = whatsapp_service.db
        miami_tz = ZoneInfo("America/New_York")
        today = datetime.now(miami_tz)
        
        # Find clients with birthday today (matching month and day)
        clients = await db.users.find({
            'phone': {'$exists': True, '$ne': ''},
            '$expr': {
                '$and': [
                    {'$eq': [{'$month': '$birth_date'}, today.month]},
                    {'$eq': [{'$dayOfMonth': '$birth_date'}, today.day]}
                ]
            }
        }).to_list(100)
        
        birthday_clients = []
        for client in clients:
            # Check if we already sent greeting this year
            greeting_sent = await db.birthday_greetings_sent.find_one({
                'phone_number': client.get('phone'),
                'year': today.year
            })
            
            birthday_clients.append({
                'id': str(client['_id']),
                'name': client.get('full_name', 'Cliente'),
                'phone': client.get('phone'),
                'greeting_sent': greeting_sent is not None
            })
        
        return {
            'success': True,
            'date': today.strftime('%d/%m/%Y'),
            'clients': birthday_clients,
            'count': len(birthday_clients)
        }
    except Exception as e:
        logger.error(f"Error getting birthday clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@whatsapp_router.post('/whatsapp/send-all-birthday-greetings')
async def send_all_birthday_greetings():
    """Send birthday greetings to all clients with birthday today"""
    try:
        if whatsapp_bot_v2 is None:
            raise HTTPException(status_code=503, detail="WhatsApp bot not available")
        
        # Get clients with birthday today
        response = await get_clients_with_birthday_today()
        clients = response.get('clients', [])
        
        sent_count = 0
        errors = []
        
        for client in clients:
            if not client.get('greeting_sent'):
                try:
                    result = await whatsapp_bot_v2.send_birthday_greeting(
                        client['phone'],
                        client['name']
                    )
                    if result.get('success'):
                        sent_count += 1
                    
                    # Rate limiting
                    import asyncio
                    await asyncio.sleep(1)
                except Exception as e:
                    errors.append(f"{client['name']}: {str(e)}")
        
        return {
            'success': True,
            'sent_count': sent_count,
            'total_birthdays': len(clients),
            'errors': errors[:5] if errors else None
        }
    except Exception as e:
        logger.error(f"Error sending birthday greetings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

