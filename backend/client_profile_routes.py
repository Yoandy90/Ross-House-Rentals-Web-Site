"""
Client Profile & Misc Routes Router
Extracted from server.py - Handles email tracking, KYC, client complete profile,
OCR scanning, legal documents, and group check-in.
"""
import os, logging, uuid, json, base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Literal
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

try:
    from kyc_models import KYCData, KYCSubmitRequest, KYCStatusResponse
except ImportError:
    pass


class LegalDocument(BaseModel):
    type: Literal["terms", "privacy"]
    content: str
    version: str
    is_published: bool = False
    effective_date: Optional[datetime] = None

logger = logging.getLogger(__name__)
router = APIRouter()
_db = None

def init_client_profile_router(db):
    global _db
    _db = db

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = str(authorization).replace('Bearer ', '') if str(authorization).startswith('Bearer ') else str(authorization)
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    user_id = session['user_id']
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

async def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await _get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user


# ================== EMAIL TRACKING SYSTEM ==================
# ================== EMAIL TRACKING SYSTEM ==================

class SendTrackedEmailRequest(BaseModel):
    to_email: str
    subject: str
    message: Optional[str] = None
    html_content: Optional[str] = None
    category: str = "general"  # birthday, campaign, reminder, notification, invoice
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    metadata: Optional[dict] = {}

@router.post('/admin/send-tracked-email')
async def admin_send_tracked_email(request: SendTrackedEmailRequest, current_user: dict = Depends(_require_admin)):
    """Send email with full tracking (opens, clicks, delivery)"""
    try:
        import uuid
        
        # Get config from database
        config_doc = await _db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=503, detail="Notification config not found")
        
        from notification_service import NotificationService
        notif_service = NotificationService(config_doc)
        
        if not notif_service.sendgrid_client:
            raise HTTPException(status_code=503, detail="Email service not configured")
        
        from sendgrid.helpers.mail import Mail, Email, To, TrackingSettings, OpenTracking, ClickTracking, CustomArg
        
        # Generate unique email ID for tracking
        email_id = str(uuid.uuid4())
        
        # Build email
        from_email = Email(config_doc.get('sendgrid_from_email', 'noreply@rosstaxpreparation.com'), "Ross Tax Preparation")
        to_email = To(request.to_email)
        
        # Use HTML content if provided, otherwise plain text
        if request.html_content:
            mail = Mail(from_email, to_email, request.subject, html_content=request.html_content)
        else:
            mail = Mail(from_email, to_email, request.subject, plain_text_content=request.message or "")
        
        # Enable tracking
        tracking_settings = TrackingSettings()
        tracking_settings.open_tracking = OpenTracking(enable=True)
        tracking_settings.click_tracking = ClickTracking(enable=True, enable_text=False)
        mail.tracking_settings = tracking_settings
        
        # Add custom args for webhook identification
        mail.custom_arg = CustomArg(key="email_id", value=email_id)
        
        # Store email record BEFORE sending
        email_record = {
            '_id': email_id,
            'to_email': request.to_email,
            'subject': request.subject,
            'category': request.category,
            'client_id': request.client_id,
            'client_name': request.client_name,
            'metadata': request.metadata,
            'sent_by': current_user.get('email'),
            'sent_at': datetime.now(timezone.utc),
            'status': 'sending',
            'events': [],
            'opened': False,
            'opened_at': None,
            'open_count': 0,
            'clicked': False,
            'clicked_at': None,
            'click_count': 0,
            'links_clicked': [],
            'delivered': False,
            'delivered_at': None,
            'bounced': False,
            'bounce_reason': None,
            'spam_reported': False
        }
        await _db.email_tracking.insert_one(email_record)
        
        # Send email
        response = notif_service.sendgrid_client.send(mail)
        
        # Update status to sent
        await _db.email_tracking.update_one(
            {'_id': email_id},
            {'$set': {'status': 'sent', 'sendgrid_status_code': response.status_code}}
        )
        
        logging.info(f"📧 Tracked email sent to {request.to_email} [ID: {email_id}] by {current_user.get('email')}")
        
        return {
            "success": True,
            "email_id": email_id,
            "status_code": response.status_code,
            "to": request.to_email
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error sending tracked email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/webhooks/sendgrid')
async def sendgrid_webhook(request: Request):
    """Receive SendGrid webhook events for email tracking"""
    try:
        events = await request.json()
        
        for event in events:
            email = event.get('email')
            event_type = event.get('event')
            timestamp = event.get('timestamp')
            email_id = event.get('email_id')  # From custom_arg
            
            # Try to find email by ID or email address
            query = {'_id': email_id} if email_id else {'to_email': email}
            
            event_record = {
                'type': event_type,
                'timestamp': datetime.fromtimestamp(timestamp, tz=timezone.utc) if timestamp else datetime.now(timezone.utc),
                'ip': event.get('ip'),
                'user_agent': event.get('useragent'),
                'url': event.get('url'),
                'sg_event_id': event.get('sg_event_id'),
                'sg_message_id': event.get('sg_message_id')
            }
            
            update_fields = {'$push': {'events': event_record}}
            
            if event_type == 'delivered':
                update_fields['$set'] = {
                    'delivered': True,
                    'delivered_at': event_record['timestamp'],
                    'status': 'delivered'
                }
            elif event_type == 'open':
                update_fields['$set'] = {
                    'opened': True,
                    'status': 'opened'
                }
                update_fields['$inc'] = {'open_count': 1}
                # Only set opened_at on first open
                await _db.email_tracking.update_one(
                    {**query, 'opened_at': None},
                    {'$set': {'opened_at': event_record['timestamp']}}
                )
            elif event_type == 'click':
                url_clicked = event.get('url', '')
                update_fields['$set'] = {
                    'clicked': True,
                    'status': 'clicked'
                }
                update_fields['$inc'] = {'click_count': 1}
                update_fields['$addToSet'] = {'links_clicked': url_clicked}
                # Only set clicked_at on first click
                await _db.email_tracking.update_one(
                    {**query, 'clicked_at': None},
                    {'$set': {'clicked_at': event_record['timestamp']}}
                )
            elif event_type == 'bounce':
                update_fields['$set'] = {
                    'bounced': True,
                    'bounce_reason': event.get('reason'),
                    'status': 'bounced'
                }
            elif event_type == 'spamreport':
                update_fields['$set'] = {
                    'spam_reported': True,
                    'status': 'spam'
                }
            elif event_type == 'dropped':
                update_fields['$set'] = {
                    'status': 'dropped',
                    'drop_reason': event.get('reason')
                }
            
            await _db.email_tracking.update_one(query, update_fields)
            logging.info(f"📬 Email event: {event_type} for {email}")
        
        return {"success": True, "processed": len(events)}
    except Exception as e:
        logging.error(f"Error processing SendGrid webhook: {e}")
        return {"success": False, "error": str(e)}



# ================== KYC ROUTES ==================
# ================== KYC ROUTES ==================

@router.get('/kyc/status', response_model=KYCStatusResponse)
async def get_kyc_status(current_user: dict = Depends(_get_current_user)):
    """Get KYC completion status for current user"""
    kyc_data = await _db.kyc_data.find_one({'user_id': current_user['id']})
    
    if not kyc_data:
        return KYCStatusResponse(
            has_kyc=False,
            completed=False,
            verified=False,
            priority_status=False,
            completion_percentage=0
        )
    
    # Calculate completion percentage
    required_fields = [
        'full_name', 'date_of_birth', 'ssn_last_four', 'address_street',
        'address_city', 'address_state', 'address_zip', 'marital_status',
        'primary_phone', 'preferred_contact_method', 'preferred_contact_time'
    ]
    completed_fields = sum(1 for field in required_fields if kyc_data.get(field))
    completion_percentage = int((completed_fields / len(required_fields)) * 100)
    
    return KYCStatusResponse(
        has_kyc=True,
        completed=kyc_data.get('completed', False),
        verified=kyc_data.get('verified', False),
        priority_status=kyc_data.get('priority_status', False),
        completed_at=kyc_data.get('completed_at'),
        completion_percentage=completion_percentage
    )

@router.post('/kyc/submit')
async def submit_kyc(kyc_request: KYCSubmitRequest, current_user: dict = Depends(_get_current_user)):
    """Submit KYC information"""
    try:
        # Process SSN/ITIN
        ssn_or_itin = kyc_request.ssn_or_itin.replace('-', '').replace(' ', '')
        
        # Validate SSN/ITIN format
        if not re.match(r'^\d{9}$', ssn_or_itin):
            raise HTTPException(status_code=400, detail='Invalid SSN/ITIN format. Must be 9 digits.')
        
        # Determine if SSN or ITIN (ITIN starts with 9)
        is_itin = ssn_or_itin.startswith('9')
        
        # Process spouse SSN if provided
        spouse_ssn_last_four = None
        spouse_ssn_full = None
        if kyc_request.spouse_ssn_or_itin:
            spouse_ssn = kyc_request.spouse_ssn_or_itin.replace('-', '').replace(' ', '')
            if re.match(r'^\d{9}$', spouse_ssn):
                spouse_ssn_last_four = spouse_ssn[-4:]
                spouse_ssn_full = spouse_ssn
        
        # Create KYC data
        kyc_data = KYCData(
            user_id=current_user['id'],
            full_name=kyc_request.full_name,
            date_of_birth=kyc_request.date_of_birth,
            ssn_last_four=ssn_or_itin[-4:],
            ssn_full=ssn_or_itin if not is_itin else None,
            itin=ssn_or_itin if is_itin else None,
            address_street=kyc_request.address_street,
            address_city=kyc_request.address_city,
            address_state=kyc_request.address_state,
            address_zip=kyc_request.address_zip,
            marital_status=kyc_request.marital_status,
            spouse_name=kyc_request.spouse_name,
            spouse_ssn_last_four=spouse_ssn_last_four,
            spouse_ssn_full=spouse_ssn_full,
            num_dependents=kyc_request.num_dependents,
            dependents=kyc_request.dependents or [],
            primary_phone=kyc_request.primary_phone,
            secondary_phone=kyc_request.secondary_phone,
            preferred_contact_method=kyc_request.preferred_contact_method,
            preferred_contact_time=kyc_request.preferred_contact_time,
            completed=True,
            priority_status=True,  # Grant priority for completing KYC
            completed_at=datetime.now(timezone.utc)
        )
        
        # Check if KYC already exists
        existing_kyc = await _db.kyc_data.find_one({'user_id': current_user['id']})
        
        if existing_kyc:
            # Update existing KYC
            kyc_dict = kyc_data.dict()
            kyc_dict['updated_at'] = datetime.now(timezone.utc)
            await _db.kyc_data.update_one(
                {'user_id': current_user['id']},
                {'$set': kyc_dict}
            )
        else:
            # Insert new KYC
            await _db.kyc_data.insert_one(kyc_data.dict())
        
        return {
            'message': 'KYC submitted successfully',
            'priority_status': True,
            'completed': True
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'KYC submission error: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/kyc/data')
async def get_kyc_data(current_user: dict = Depends(_get_current_user)):
    """Get KYC data for current user (masked sensitive data)"""
    kyc_data = await _db.kyc_data.find_one({'user_id': current_user['id']})
    
    if not kyc_data:
        raise HTTPException(status_code=404, detail='KYC data not found')
    
    # Remove sensitive full SSN/ITIN data
    kyc_data.pop('ssn_full', None)
    kyc_data.pop('itin', None)
    kyc_data.pop('spouse_ssn_full', None)
    kyc_data.pop('_id', None)
    
    return kyc_data



# ================== CLIENT COMPLETE PROFILE ==================
# ================== CLIENT COMPLETE PROFILE ==================

@router.get('/client-profile')
async def get_client_profile(current_user: dict = Depends(_get_current_user)):
    """Get unified client profile with all data for form pre-fill"""
    try:
        # Get user data
        user = await _db.users.find_one({'_id': current_user['id']})
        
        # Get KYC data
        kyc_data = await _db.kyc_data.find_one({'user_id': current_user['id']})
        
        # Get extended profile data
        extended_profile = await _db.client_profiles.find_one({'user_id': current_user['id']})
        
        # Build unified response
        profile = {
            # Basic user data
            'name': user.get('name', ''),
            'email': user.get('email', ''),
            'phone': user.get('phone', ''),
            'profile_picture': user.get('profile_picture'),
            
            # Address from user or KYC
            'address': {
                'street': user.get('address', {}).get('address_line1') or (kyc_data.get('address_street') if kyc_data else ''),
                'line2': user.get('address', {}).get('address_line2', ''),
                'city': user.get('address', {}).get('city') or (kyc_data.get('address_city') if kyc_data else ''),
                'state': user.get('address', {}).get('state') or (kyc_data.get('address_state') if kyc_data else ''),
                'zip_code': user.get('address', {}).get('zip_code') or (kyc_data.get('address_zip') if kyc_data else ''),
                'country': 'Estados Unidos',
            },
            
            # KYC data
            'kyc_completed': bool(kyc_data and kyc_data.get('completed')),
            'date_of_birth': kyc_data.get('date_of_birth', '') if kyc_data else '',
            'ssn_last_four': kyc_data.get('ssn_last_four', '') if kyc_data else '',
            'has_ssn': bool(kyc_data and kyc_data.get('ssn_full')) if kyc_data else False,
            'marital_status': kyc_data.get('marital_status', '') if kyc_data else '',
            'spouse_name': kyc_data.get('spouse_name', '') if kyc_data else '',
            'num_dependents': kyc_data.get('num_dependents', 0) if kyc_data else 0,
            
            # Extended profile data (for passport/services)
            'first_name': '',
            'middle_name': '',
            'last_name': '',
            'second_last_name': '',
            'sex': '',
            'eye_color': '',
            'skin_color': '',
            'hair_color': '',
            'height': '',
            'birth_country': '',
            'birth_state': '',
            'birth_city': '',
            'father_name': '',
            'mother_name': '',
            'occupation': '',
            'profession': '',
            'workplace': '',
            'workplace_address': '',
        }
        
        # Merge extended profile if exists
        if extended_profile:
            profile.update({
                'first_name': extended_profile.get('first_name', ''),
                'middle_name': extended_profile.get('middle_name', ''),
                'last_name': extended_profile.get('last_name', ''),
                'second_last_name': extended_profile.get('second_last_name', ''),
                'sex': extended_profile.get('sex', ''),
                'eye_color': extended_profile.get('eye_color', ''),
                'skin_color': extended_profile.get('skin_color', ''),
                'hair_color': extended_profile.get('hair_color', ''),
                'height': extended_profile.get('height', ''),
                'birth_country': extended_profile.get('birth_country', ''),
                'birth_state': extended_profile.get('birth_state', ''),
                'birth_city': extended_profile.get('birth_city', ''),
                'father_name': extended_profile.get('father_name', ''),
                'mother_name': extended_profile.get('mother_name', ''),
                'occupation': extended_profile.get('occupation', ''),
                'profession': extended_profile.get('profession', ''),
                'workplace': extended_profile.get('workplace', ''),
                'workplace_address': extended_profile.get('workplace_address', ''),
            })
        
        # Try to split name into parts if extended profile doesn't exist
        if not profile['first_name'] and profile['name']:
            name_parts = profile['name'].strip().split()
            if len(name_parts) == 1:
                profile['first_name'] = name_parts[0]
            elif len(name_parts) == 2:
                profile['first_name'] = name_parts[0]
                profile['last_name'] = name_parts[1]
            elif len(name_parts) == 3:
                profile['first_name'] = name_parts[0]
                profile['middle_name'] = name_parts[1]
                profile['last_name'] = name_parts[2]
            elif len(name_parts) >= 4:
                profile['first_name'] = name_parts[0]
                profile['middle_name'] = name_parts[1]
                profile['last_name'] = name_parts[2]
                profile['second_last_name'] = ' '.join(name_parts[3:])
        
        # Ensure no null values that could crash mobile app
        for key in ['filing_status', 'marital_status', 'occupation', 'profession', 'workplace', 
                     'workplace_address', 'first_name', 'middle_name', 'last_name', 'second_last_name',
                     'sex', 'eye_color', 'skin_color', 'hair_color', 'height',
                     'birth_country', 'birth_state', 'birth_city', 'father_name', 'mother_name',
                     'date_of_birth', 'ssn_last_four', 'spouse_name']:
            if profile.get(key) is None:
                profile[key] = ''
        
        # Ensure dependents is always a list
        if not isinstance(profile.get('dependents'), list):
            profile['dependents'] = []
        
        return profile
        
    except Exception as e:
        logging.error(f'Error getting client profile: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/profile/tax-prefill')
async def get_tax_prefill_data(current_user: dict = Depends(_get_current_user)):
    """Get profile data formatted for the tax wizard pre-fill.
    Returns only the fields relevant to the tax wizard.
    Now includes SSN lookup from previous wizard sessions and banking records."""
    try:
        user = await _db.users.find_one({'_id': current_user['id']})
        kyc_data = await _db.kyc_data.find_one({'user_id': current_user['id']})
        extended_profile = await _db.client_profiles.find_one({'user_id': current_user['id']})
        
        # Build pre-fill data
        prefill = {
            'has_profile_data': False,
            'first_name': '',
            'middle_name': '',
            'last_name': '',
            'ssn': '',
            'ssn_last_four': '',
            'ssn_source': '',
            'date_of_birth': '',
            'phone': '',
            'email': '',
            'address': {
                'street': '',
                'city': '',
                'state': '',
                'zip': '',
            },
            'filing_status': '',
            'occupation': '',
            'marital_status': '',
        }
        
        # Fill from extended profile (most structured data)
        if extended_profile:
            prefill['first_name'] = extended_profile.get('first_name', '')
            prefill['middle_name'] = extended_profile.get('middle_name', '')
            prefill['last_name'] = extended_profile.get('last_name', '')
            prefill['occupation'] = extended_profile.get('occupation', '')
            prefill['marital_status'] = extended_profile.get('marital_status', '')
            if extended_profile.get('date_of_birth'):
                prefill['date_of_birth'] = extended_profile['date_of_birth']
        
        # Fill from user data
        if user:
            if not prefill['phone']:
                prefill['phone'] = user.get('phone', '')
            if not prefill['email']:
                prefill['email'] = user.get('email', '')
            
            # Address from user
            addr = user.get('address', {})
            if addr:
                prefill['address']['street'] = addr.get('address_line1', '') or addr.get('street', '')
                prefill['address']['city'] = addr.get('city', '')
                prefill['address']['state'] = addr.get('state', '')
                prefill['address']['zip'] = addr.get('zip_code', '') or addr.get('zip', '')
            
            # Fallback name from user.name
            if not prefill['first_name'] and user.get('name'):
                parts = user['name'].strip().split()
                if len(parts) >= 1:
                    prefill['first_name'] = parts[0]
                if len(parts) >= 2:
                    prefill['last_name'] = parts[-1]
                if len(parts) == 3:
                    prefill['middle_name'] = parts[1]
        
        # Fill from KYC
        if kyc_data:
            if not prefill['date_of_birth']:
                prefill['date_of_birth'] = kyc_data.get('date_of_birth', '')
            if not prefill['ssn_last_four']:
                prefill['ssn_last_four'] = kyc_data.get('ssn_last_four', '')
            if not prefill['marital_status']:
                prefill['marital_status'] = kyc_data.get('marital_status', '')
            
            # Address from KYC
            if not prefill['address']['street']:
                prefill['address']['street'] = kyc_data.get('address_street', '')
                prefill['address']['city'] = kyc_data.get('address_city', '')
                prefill['address']['state'] = kyc_data.get('address_state', '')
                prefill['address']['zip'] = kyc_data.get('address_zip', '')
        
        # ====== SSN LOOKUP FOR RETURNING CLIENTS ======
        # Priority 1: Previous Tax Wizard session (user's own data)
        if not prefill['ssn']:
            try:
                prev_session = await _db.tax_wizard_sessions.find_one(
                    {
                        'user_id': current_user['id'],
                        'personal_info.ssn_encrypted': {'$exists': True, '$nin': ['', None]}
                    },
                    sort=[('updated_at', -1)]
                )
                if prev_session and prev_session.get('personal_info', {}).get('ssn_encrypted'):
                    prefill['ssn'] = prev_session['personal_info']['ssn_encrypted']
                    prefill['ssn_source'] = 'previous_wizard'
                    prefill['ssn_last_four'] = prefill['ssn'][-4:]
                    logging.info(f"SSN prefill from previous wizard for user {current_user['id']}")
            except Exception as e:
                logging.warning(f"SSN lookup from wizard sessions failed: {e}")
        
        # Priority 2: client_banking collection (match by email)
        if not prefill['ssn']:
            user_email = (prefill.get('email') or '').strip()
            if user_email:
                try:
                    banking = await _db.client_banking.find_one({
                        'email': {'$regex': f'^{user_email}$', '$options': 'i'},
                        'ssn': {'$exists': True, '$nin': ['', None]}
                    })
                    if banking and banking.get('ssn'):
                        prefill['ssn'] = banking['ssn']
                        prefill['ssn_source'] = 'banking_records'
                        if not prefill['ssn_last_four']:
                            prefill['ssn_last_four'] = banking.get('ssn_last4', banking['ssn'][-4:])
                        # Also fill banking data if missing
                        if not prefill['date_of_birth'] and banking.get('birthdate'):
                            prefill['date_of_birth'] = banking['birthdate']
                        logging.info(f"SSN prefill from client_banking for user {current_user['id']}")
                except Exception as e:
                    logging.warning(f"SSN lookup from client_banking failed: {e}")
        
        # Priority 3: season_clients collection (match by email)
        if not prefill['ssn']:
            user_email = (prefill.get('email') or '').strip()
            if user_email:
                try:
                    season = await _db.season_clients.find_one({
                        'email': {'$regex': f'^{user_email}$', '$options': 'i'},
                        'ssn': {'$exists': True, '$nin': ['', None]}
                    })
                    if season and season.get('ssn'):
                        prefill['ssn'] = season['ssn']
                        prefill['ssn_source'] = 'season_records'
                        if not prefill['ssn_last_four']:
                            prefill['ssn_last_four'] = season['ssn'][-4:]
                        # Fill other fields from season data
                        if not prefill['first_name'] and season.get('first_name'):
                            prefill['first_name'] = season['first_name']
                        if not prefill['last_name'] and season.get('last_name'):
                            prefill['last_name'] = season['last_name']
                        if not prefill['phone'] and season.get('phone'):
                            prefill['phone'] = season['phone']
                        if not prefill['date_of_birth'] and season.get('birthdate'):
                            prefill['date_of_birth'] = season['birthdate']
                        logging.info(f"SSN prefill from season_clients for user {current_user['id']}")
                except Exception as e:
                    logging.warning(f"SSN lookup from season_clients failed: {e}")
        
        # Priority 4: Match by name if email didn't match (client_banking)
        if not prefill['ssn'] and prefill.get('first_name') and prefill.get('last_name'):
            try:
                name_match = await _db.client_banking.find_one({
                    'first_name': {'$regex': f'^{prefill["first_name"]}$', '$options': 'i'},
                    'last_name': {'$regex': f'^{prefill["last_name"]}$', '$options': 'i'},
                    'ssn': {'$exists': True, '$nin': ['', None]}
                })
                if name_match and name_match.get('ssn'):
                    prefill['ssn'] = name_match['ssn']
                    prefill['ssn_source'] = 'banking_name_match'
                    if not prefill['ssn_last_four']:
                        prefill['ssn_last_four'] = name_match.get('ssn_last4', name_match['ssn'][-4:])
                    logging.info(f"SSN prefill from banking (name match) for user {current_user['id']}")
            except Exception as e:
                logging.warning(f"SSN name-match lookup failed: {e}")
        
        # Priority 5: Match by phone (critical for OTP login users)
        if not prefill['ssn']:
            user_phone = (prefill.get('phone') or user.get('phone', '') if user else '').strip().replace('-', '').replace('(', '').replace(')', '').replace(' ', '')
            if user_phone:
                # Try last 10 digits
                phone_digits = user_phone[-10:] if len(user_phone) >= 10 else user_phone
                try:
                    phone_patterns = [
                        phone_digits,
                        f"+1{phone_digits}",
                        phone_digits[-10:] if len(phone_digits) >= 10 else None,
                    ]
                    phone_patterns = [p for p in phone_patterns if p]
                    
                    banking_phone = await _db.client_banking.find_one({
                        'phone': {'$in': phone_patterns},
                        'ssn': {'$exists': True, '$nin': ['', None]}
                    })
                    if not banking_phone:
                        # Try regex match on last 10 digits
                        banking_phone = await _db.client_banking.find_one({
                            'phone': {'$regex': phone_digits[-10:]},
                            'ssn': {'$exists': True, '$nin': ['', None]}
                        })
                    
                    if banking_phone and banking_phone.get('ssn'):
                        prefill['ssn'] = banking_phone['ssn']
                        prefill['ssn_source'] = 'banking_phone_match'
                        if not prefill['ssn_last_four']:
                            prefill['ssn_last_four'] = banking_phone.get('ssn_last4', banking_phone['ssn'][-4:])
                        # Also fill missing fields from banking record
                        if not prefill['first_name'] and banking_phone.get('first_name'):
                            prefill['first_name'] = banking_phone['first_name']
                        if not prefill['last_name'] and banking_phone.get('last_name'):
                            prefill['last_name'] = banking_phone['last_name']
                        logging.info(f"SSN prefill from banking (phone match) for user {current_user['id']}")
                except Exception as e:
                    logging.warning(f"SSN phone-match lookup failed: {e}")
        
        # Determine if we have meaningful data to pre-fill
        prefill['has_profile_data'] = bool(
            prefill['first_name'] or prefill['last_name'] or 
            prefill['date_of_birth'] or prefill['address']['street'] or
            prefill['ssn']
        )
        
        return prefill
        
    except Exception as e:
        logging.error(f'Error getting tax prefill data: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/client-profile')
async def update_client_profile_extended(
    profile_data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Update extended client profile data"""
    try:
        now = datetime.now(timezone.utc)
        
        # Separate data into different collections
        user_update = {}
        extended_profile_data = {
            'user_id': current_user['id'],
            'updated_at': now,
        }
        
        # User collection fields
        if 'name' in profile_data:
            user_update['name'] = profile_data['name']
        if 'phone' in profile_data:
            user_update['phone'] = profile_data['phone']
        if 'address' in profile_data:
            addr = profile_data['address']
            user_update['address'] = {
                'address_line1': addr.get('street', ''),
                'address_line2': addr.get('line2', ''),
                'city': addr.get('city', ''),
                'state': addr.get('state', ''),
                'zip_code': addr.get('zip_code', ''),
            }
        
        # Extended profile fields
        extended_fields = [
            'first_name', 'middle_name', 'last_name', 'second_last_name',
            'sex', 'eye_color', 'skin_color', 'hair_color', 'height',
            'birth_country', 'birth_state', 'birth_city',
            'father_name', 'mother_name',
            'occupation', 'profession', 'workplace', 'workplace_address',
            'date_of_birth', 'marital_status'
        ]
        
        for field in extended_fields:
            if field in profile_data:
                extended_profile_data[field] = profile_data[field]
        
        # Handle full SSN securely
        ssn_raw = profile_data.get('ssn', '').replace('-', '').replace(' ', '')
        if ssn_raw and len(ssn_raw) == 9 and ssn_raw.isdigit():
            extended_profile_data['ssn_full'] = ssn_raw
            extended_profile_data['ssn_last_four'] = ssn_raw[-4:]
        elif profile_data.get('ssn_last_four'):
            extended_profile_data['ssn_last_four'] = profile_data['ssn_last_four']
        
        # Update user collection
        if user_update:
            await _db.users.update_one(
                {'_id': current_user['id']},
                {'$set': user_update}
            )
        
        # Update or create extended profile
        existing = await _db.client_profiles.find_one({'user_id': current_user['id']})
        if existing:
            await _db.client_profiles.update_one(
                {'user_id': current_user['id']},
                {'$set': extended_profile_data}
            )
        else:
            extended_profile_data['created_at'] = now
            await _db.client_profiles.insert_one(extended_profile_data)
        
        # Also update KYC if date_of_birth or marital_status changed
        kyc_update = {}
        if 'date_of_birth' in profile_data:
            kyc_update['date_of_birth'] = profile_data['date_of_birth']
        if 'marital_status' in profile_data:
            kyc_update['marital_status'] = profile_data['marital_status']
        if 'address' in profile_data:
            addr = profile_data['address']
            kyc_update['address_street'] = addr.get('street', '')
            kyc_update['address_city'] = addr.get('city', '')
            kyc_update['address_state'] = addr.get('state', '')
            kyc_update['address_zip'] = addr.get('zip_code', '')
        
        if kyc_update:
            kyc_update['updated_at'] = now
            # Also save SSN to kyc_data
            if ssn_raw and len(ssn_raw) == 9 and ssn_raw.isdigit():
                kyc_update['ssn_last_four'] = ssn_raw[-4:]
                kyc_update['ssn_full'] = ssn_raw
            await _db.kyc_data.update_one(
                {'user_id': current_user['id']},
                {'$set': kyc_update},
                upsert=True
            )
        elif ssn_raw and len(ssn_raw) == 9 and ssn_raw.isdigit():
            # Even if no other kyc fields changed, save SSN
            await _db.kyc_data.update_one(
                {'user_id': current_user['id']},
                {'$set': {'ssn_last_four': ssn_raw[-4:], 'ssn_full': ssn_raw, 'updated_at': now}},
                upsert=True
            )
        
        # Sync SSN to client_banking for admin search
        if ssn_raw and len(ssn_raw) == 9 and ssn_raw.isdigit():
            fname = profile_data.get('first_name', '') or (extended_profile_data.get('first_name', '') if 'first_name' in extended_profile_data else '')
            lname = profile_data.get('last_name', '') or (extended_profile_data.get('last_name', '') if 'last_name' in extended_profile_data else '')
            if fname or lname:
                await _db.client_banking.update_one(
                    {'$or': [
                        {'user_id': current_user['id']},
                        {'first_name': {'$regex': f'^{fname}$', '$options': 'i'}, 'last_name': {'$regex': f'^{lname}$', '$options': 'i'}}
                    ]},
                    {'$set': {'ssn': ssn_raw, 'ssn_last4': ssn_raw[-4:], 'updated_at': now}},
                )
        
        return {'message': 'Profile updated successfully'}
        
    except Exception as e:
        logging.error(f'Error updating client profile: {e}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== OCR DOCUMENT SCANNING ==================
# ================== OCR DOCUMENT SCANNING ==================

@router.post('/ocr/document')
async def scan_document_ocr(
    request: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Extract data from document image using AI vision"""
    try:
        image_base64 = request.get('image_base64')
        document_type = request.get('document_type', 'passport')
        
        if not image_base64:
            raise HTTPException(status_code=400, detail='No image provided')
        
        # Use OpenAI Vision API via Emergent LLM key
        try:
            from emergentintegrations.llm.chat import chat, UserMessage
            
            prompt = """Analiza esta imagen de un documento de identidad (pasaporte o licencia).
Extrae los siguientes datos si están visibles:
- first_name: Primer nombre
- last_name: Apellido
- date_of_birth: Fecha de nacimiento (formato YYYY-MM-DD)
- sex: Sexo (M o F)
- nationality: Nacionalidad/País de nacimiento

Responde SOLO en formato JSON válido, sin explicaciones adicionales.
Si no puedes leer algún campo, omítelo del JSON.
Ejemplo de respuesta: {"first_name": "Juan", "last_name": "Pérez", "date_of_birth": "1990-05-15", "sex": "M", "nationality": "Cuba"}
"""
            
            response = await chat(
                api_key=os.getenv('EMERGENT_LLM_KEY'),
                model="gpt-4o",
                messages=[
                    UserMessage(content=[
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                    ])
                ]
            )
            
            # Parse JSON response
            import json
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Try to extract JSON from response
            try:
                # Clean response - find JSON object
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = response_text[start:end]
                    extracted_data = json.loads(json_str)
                else:
                    extracted_data = {}
            except json.JSONDecodeError:
                extracted_data = {}
            
            logging.info(f"📷 OCR scan completed for user {current_user['id']}: {list(extracted_data.keys())}")
            
            return {
                'success': True,
                'extracted_data': extracted_data,
                'message': 'Document scanned successfully'
            }
            
        except ImportError:
            # Fallback if emergentintegrations not available
            logging.warning("emergentintegrations not available for OCR")
            return {
                'success': False,
                'extracted_data': {},
                'message': 'OCR service temporarily unavailable'
            }
            
    except Exception as e:
        logging.error(f'Error in OCR scan: {e}')
        return {
            'success': False,
            'extracted_data': {},
            'message': str(e)
        }



# ================== LEGAL DOCUMENTS ==================
# ================== LEGAL DOCUMENTS (TERMS & PRIVACY) ==================

@router.get('/legal/{doc_type}')
async def get_legal_document(
    doc_type: Literal["terms", "privacy", "refund"],
    lang: str = 'es'  # Default to Spanish
):
    """
    Get published legal document (terms, privacy policy, or refund policy)
    
    Parameters:
    - doc_type: Type of document (terms, privacy, refund)
    - lang: Language code (es, en). Default: es
    """
    # Try to find document in requested language
    doc = await _db.legal_documents.find_one({
        'type': doc_type,
        'language': lang,
        'is_published': True
    }, sort=[('effective_date', -1)])
    
    # Fallback to any language if specific language not found
    if not doc:
        doc = await _db.legal_documents.find_one({
            'type': doc_type,
            'is_published': True
        }, sort=[('effective_date', -1)])
    
    if not doc:
        raise HTTPException(status_code=404, detail=f'{doc_type.capitalize()} document not found')
    
    return {
        'type': doc['type'],
        'language': doc.get('language', 'es'),
        'title': doc.get('title', ''),
        'content': doc['content'],
        'version': doc['version'],
        'effective_date': doc.get('effective_date'),
        'updated_at': doc.get('updated_at')
    }

@router.get('/admin/legal')
async def get_all_legal_documents(current_user: dict = Depends(_require_admin)):
    """Get all legal documents including drafts (admin only)"""
    docs = await _db.legal_documents.find({}).sort('updated_at', -1).to_list(100)
    
    result = []
    for doc in docs:
        try:
            result.append({
                'id': str(doc.get('_id', '')),
                'type': doc.get('type', 'unknown'),
                'version': doc.get('version', '1.0'),
                'is_published': doc.get('is_published', False),
                'effective_date': doc.get('effective_date'),
                'updated_at': doc.get('updated_at'),
                'content_preview': doc.get('content', '')[:200] + '...' if len(doc.get('content', '')) > 200 else doc.get('content', '')
            })
        except Exception as e:
            logger.error(f"Error processing legal document: {e}")
            continue
    
    return result

@router.get('/admin/legal/{doc_id}')
async def get_legal_document_detail(doc_id: str, current_user: dict = Depends(_require_admin)):
    """Get specific legal document with full content (admin only)"""
    try:
        doc = await _db.legal_documents.find_one({'_id': ObjectId(doc_id)})
    except:
        doc = None
    
    if not doc:
        raise HTTPException(status_code=404, detail='Document not found')
    
    return {
        'id': str(doc['_id']),
        'type': doc['type'],
        'content': doc['content'],
        'version': doc['version'],
        'is_published': doc.get('is_published', False),
        'effective_date': doc.get('effective_date'),
        'updated_at': doc.get('updated_at'),
        'created_by': doc.get('created_by'),
        'created_at': doc.get('created_at')
    }

@router.post('/admin/legal')
async def create_legal_document(document: LegalDocument, current_user: dict = Depends(_require_admin)):
    """Create or update legal document (admin only)"""
    doc_data = {
        'type': document.type,
        'content': document.content,
        'version': document.version,
        'is_published': document.is_published,
        'effective_date': document.effective_date or datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc),
        'created_by': current_user['name'],
        'created_at': datetime.now(timezone.utc)
    }
    
    # If publishing, unpublish previous versions
    if document.is_published:
        await _db.legal_documents.update_many(
            {'type': document.type, 'is_published': True},
            {'$set': {'is_published': False}}
        )
    
    result = await _db.legal_documents.insert_one(doc_data)
    
    return {
        'message': 'Legal document created successfully',
        'id': str(result.inserted_id),
        'is_published': document.is_published
    }

@router.put('/admin/legal/{doc_id}')
async def update_legal_document(
    doc_id: str,
    document: LegalDocument,
    current_user: dict = Depends(_require_admin)
):
    """Update existing legal document (admin only)"""
    try:
        object_id = ObjectId(doc_id)
    except:
        raise HTTPException(status_code=400, detail='Invalid document ID')
    
    existing = await _db.legal_documents.find_one({'_id': object_id})
    if not existing:
        raise HTTPException(status_code=404, detail='Document not found')
    
    # If publishing, unpublish previous versions
    if document.is_published:
        await _db.legal_documents.update_many(
            {'type': document.type, 'is_published': True, '_id': {'$ne': object_id}},
            {'$set': {'is_published': False}}
        )
    
    update_data = {
        'content': document.content,
        'version': document.version,
        'is_published': document.is_published,
        'effective_date': document.effective_date or existing.get('effective_date', datetime.now(timezone.utc)),
        'updated_at': datetime.now(timezone.utc),
        'updated_by': current_user['name']
    }
    
    await _db.legal_documents.update_one(
        {'_id': object_id},
        {'$set': update_data}
    )
    
    return {
        'message': 'Legal document updated successfully',
        'is_published': document.is_published
    }

@router.delete('/admin/legal/{doc_id}')
async def delete_legal_document(doc_id: str, current_user: dict = Depends(_require_admin)):
    """Delete legal document (admin only)"""
    try:
        object_id = ObjectId(doc_id)
    except:
        raise HTTPException(status_code=400, detail='Invalid document ID')
    
    doc = await _db.legal_documents.find_one({'_id': object_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Document not found')
    
    if doc.get('is_published'):
        raise HTTPException(
            status_code=400,
            detail='Cannot delete published document. Unpublish it first.'
        )
    
    await _db.legal_documents.delete_one({'_id': object_id})
    
    return {'message': 'Legal document deleted successfully'}


# ================== GROUP CHECK-IN ==================
# ============ Group Check-in: Create Companion Account ============
@router.post('/admin/group-checkin/create-companion')
async def group_checkin_create_companion(
    data: dict,
    current_user: dict = Depends(_get_current_user)
):
    """Create account for companion who attended a group appointment, send welcome flow"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    try:
        import uuid
        from datetime import datetime, timezone
        
        full_name = data.get('full_name', '').strip()
        email = data.get('email', '').strip().lower()
        phone = data.get('phone', '').strip()
        address = data.get('address', '').strip()
        appointment_id = data.get('appointment_id', '')
        primary_user_id = data.get('primary_user_id', '')
        primary_user_name = data.get('primary_user_name', '')
        group_id = data.get('group_id', '')
        
        if not full_name or not email:
            raise HTTPException(status_code=400, detail='Nombre y email son requeridos')
        
        # Check if user already exists
        existing_user = await _db.users.find_one({'email': email})
        
        if existing_user:
            new_user_id = str(existing_user.get('id', existing_user.get('_id', '')))
            logging.info(f"👤 User {email} already exists, updating companion appointment")
        else:
            # Create new user account
            new_user_id = str(uuid.uuid4())
            temp_password = f"Ross{phone[-4:] if len(phone) >= 4 else '2025'}!"
            
            import bcrypt
            password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            new_user = {
                'id': new_user_id,
                'email': email,
                'password': password_hash,
                'name': full_name,
                'full_name': full_name,
                'phone': phone,
                'address': address,
                'role': 'client',
                'created_at': datetime.now(timezone.utc).isoformat(),
                'created_via': 'group_checkin',
                'referred_by': primary_user_id,
                'referred_by_name': primary_user_name,
                'group_id': group_id,
                'onboarding_complete': False,
                'is_active': True,
            }
            
            await _db.users.insert_one(new_user)
            logging.info(f"✅ New companion account created: {full_name} ({email})")
            
            # Also create client_profiles entry
            profile = {
                'user_id': new_user_id,
                'email': email,
                'full_name': full_name,
                'phone': phone,
                'address': address,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'source': 'group_appointment',
            }
            await _db.client_profiles.insert_one(profile)
        
        # Update the companion appointment with the new user_id
        if appointment_id:
            from bson import ObjectId
            update_filter = None
            try:
                update_filter = {'_id': ObjectId(appointment_id)}
                apt = await _db.appointments.find_one(update_filter)
            except:
                apt = None
            
            if not apt:
                update_filter = {'_id': appointment_id}
                apt = await _db.appointments.find_one(update_filter)
            if not apt:
                update_filter = {'id': appointment_id}
                apt = await _db.appointments.find_one(update_filter)
            
            if apt and update_filter:
                await _db.appointments.update_one(
                    update_filter,
                    {'$set': {
                        'user_id': new_user_id,
                        'user_name': full_name,
                        'user_email': email,
                        'user_phone': phone,
                        'status': 'completed',
                        'companion_registered': True,
                        'updated_at': datetime.now(timezone.utc).isoformat(),
                    }}
                )
        
        # Auto-create invoice for the companion
        try:
            # Get service price dynamically
            service_name = data.get('service_name', 'Preparación de Impuestos')
            service_price = 180  # default
            
            price_doc = await _db.service_prices.find_one({
                'name': {'$regex': service_name, '$options': 'i'},
                'is_active': True
            })
            if price_doc and price_doc.get('price'):
                service_price = float(price_doc.get('price', 180))
            
            count = await _db.invoices.count_documents({}) + 1
            invoice_number = f"INV-{datetime.now().strftime('%Y%m')}-{count:04d}"
            
            invoice = {
                'invoice_number': invoice_number,
                'user_id': new_user_id,
                'user_name': full_name,
                'user_email': email,
                'user_phone': phone,
                'service_name': service_name,
                'items': [{
                    'description': service_name,
                    'quantity': 1,
                    'unit_price': service_price
                }],
                'subtotal': service_price,
                'tax': round(service_price * 0.08, 2),
                'tax_percent': 8,
                'total': round(service_price * 1.08, 2),
                'status': 'pending',
                'due_date': (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                'notes': f'Factura grupal - Referido por {primary_user_name}',
                'created_at': datetime.now(timezone.utc),
                'created_via': 'group_checkin',
                'group_id': group_id,
            }

            # Tag with active tax season
            try:
                from season_context import get_season_year
                invoice['tax_year'] = await get_season_year()
            except Exception:
                pass
            
            result = await _db.invoices.insert_one(invoice)
            logging.info(f"💰 Invoice {invoice_number} created for companion {full_name}: ${service_price}")
            
        except Exception as inv_error:
            logging.error(f"Error creating companion invoice: {inv_error}")
        
        # Send welcome flow (email + SMS)
        try:
            config_doc = await _db.api_config.find_one({'_id': 'main'})
            if config_doc:
                from notification_service import NotificationService
                notif_svc = NotificationService(config_doc)
                
                # Send welcome email
                if notif_svc.sendgrid_client and email:
                    welcome_html = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #6C1110, #8B1A19); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0;">¡Bienvenido a Ross Tax!</h1>
                        </div>
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h2 style="color: #6C1110;">Hola {full_name} 👋</h2>
                            <p>Tu cuenta ha sido creada. Ahora puedes acceder a todos nuestros servicios.</p>
                            
                            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #6C1110;">
                                <p><strong>📧 Email:</strong> {email}</p>
                                <p><strong>🔑 Contraseña temporal:</strong> Ross{phone[-4:] if len(phone) >= 4 else '2025'}!</p>
                                <p style="color: #666; font-size: 12px;">Cambia tu contraseña después de iniciar sesión</p>
                            </div>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://apps.apple.com/us/app/ross-tax/id6745399825" style="display: inline-block; padding: 12px 30px; background: #6C1110; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">📱 Descargar App iOS</a>
                            </div>
                            
                            <p>Referido por: {primary_user_name}</p>
                            <p>¡Gracias por confiar en Ross Tax Preparation!</p>
                            <p>📍 305 Bruce Ave, Dumas, TX 79029</p>
                            <p>📞 (806) 934-2018</p>
                        </div>
                    </div>
                    """
                    
                    from sendgrid.helpers.mail import Mail
                    message = Mail(
                        from_email=notif_svc.sendgrid_from_email,
                        to_emails=email,
                        subject=f'¡Bienvenido a Ross Tax, {full_name}!',
                        html_content=welcome_html
                    )
                    notif_svc.sendgrid_client.send(message)
                    logging.info(f"✅ Welcome email sent to {email}")
                
                # Send welcome SMS
                if notif_svc.twilio_client and phone:
                    clean_phone = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                    if not clean_phone.startswith('+'):
                        clean_phone = '+1' + clean_phone
                    
                    sms_text = (
                        f"¡Bienvenido a Ross Tax, {full_name}! 🎉\n\n"
                        f"Tu cuenta ha sido creada.\n"
                        f"Email: {email}\n"
                        f"Contraseña: Ross{phone[-4:] if len(phone) >= 4 else '2025'}!\n\n"
                        f"📱 Descarga la app: https://apps.apple.com/us/app/ross-tax/id6745399825\n\n"
                        f"Ross Tax Preparation"
                    )
                    notif_svc.twilio_client.messages.create(
                        body=sms_text,
                        from_=notif_svc.twilio_phone_number,
                        to=clean_phone
                    )
                    logging.info(f"✅ Welcome SMS sent to {clean_phone}")
                    
                # Send feedback request
                try:
                    from feedback_service import FeedbackService
                    feedback_svc = FeedbackService(_db)
                    if appointment_id:
                        await feedback_svc.send_feedback_request(appointment_id)
                        logging.info(f"✅ Feedback request sent for companion {full_name}")
                except Exception as fe:
                    logging.error(f"Feedback error for companion: {fe}")
                    
        except Exception as notif_error:
            logging.error(f"Error sending welcome notifications: {notif_error}")
        
        return {
            'success': True,
            'user_id': new_user_id,
            'is_new': not existing_user,
            'message': f'Cuenta {"creada" if not existing_user else "actualizada"} para {full_name}. Flujo de bienvenida enviado.'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in group checkin: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.delete('/admin/appointments/{appointment_id}')
async def delete_appointment(
    appointment_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Delete appointment (admin only)"""
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    try:
        from bson import ObjectId
        
        result = await _db.appointments.delete_one({'_id': ObjectId(appointment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Appointment not found')
        
        return {'message': 'Appointment deleted successfully'}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))




# =============================================
# SERVICES ENDPOINTS

