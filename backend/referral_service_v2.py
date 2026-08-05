"""
Referral System V2 - Complete Referral Management
Handles referral link generation, lead tracking, and reward notifications.
"""

import logging
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class ReferralServiceV2:
    """Complete referral management system"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        
    def _generate_referral_code(self, length: int = 8) -> str:
        """Generate a unique referral code"""
        chars = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    async def get_or_create_referral_code(self, user_id: str) -> Dict[str, Any]:
        """
        Get existing referral code for user or create a new one
        
        Args:
            user_id: The user's ID
            
        Returns:
            Dictionary with referral code info
        """
        try:
            # Check if user already has a referral code
            existing = await self.db.referral_codes.find_one({'user_id': user_id})
            
            if existing:
                return {
                    'success': True,
                    'code': existing['code'],
                    'referral_link': existing['referral_link'],
                    'created_at': existing['created_at'],
                    'total_referrals': existing.get('total_referrals', 0),
                    'successful_referrals': existing.get('successful_referrals', 0)
                }
            
            # Generate new code
            code = self._generate_referral_code()
            
            # Ensure uniqueness
            while await self.db.referral_codes.find_one({'code': code}):
                code = self._generate_referral_code()
            
            # Create referral link
            base_url = "https://www.rosstaxpreparation.com"
            referral_link = f"{base_url}/ref/{code}"
            
            # Store in database
            referral_doc = {
                'user_id': user_id,
                'code': code,
                'referral_link': referral_link,
                'created_at': datetime.utcnow(),
                'total_referrals': 0,
                'successful_referrals': 0,
                'pending_referrals': 0,
                'total_earnings': 0.0,
                'status': 'active'
            }
            
            await self.db.referral_codes.insert_one(referral_doc)
            logger.info(f"✅ Created referral code {code} for user {user_id}")
            
            return {
                'success': True,
                'code': code,
                'referral_link': referral_link,
                'created_at': referral_doc['created_at'],
                'total_referrals': 0,
                'successful_referrals': 0
            }
        except Exception as e:
            logger.error(f"Error creating referral code: {e}")
            return {'success': False, 'error': str(e)}
    
    async def create_lead(
        self,
        referrer_user_id: str,
        friend_name: str,
        friend_phone: str,
        friend_email: Optional[str] = None,
        message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new referral lead
        
        Args:
            referrer_user_id: ID of the user making the referral
            friend_name: Name of the referred friend
            friend_phone: Phone number of the friend
            friend_email: Optional email of the friend
            message: Optional custom message
            
        Returns:
            Lead creation result
        """
        try:
            # Get referrer info
            referrer = await self.db.users.find_one({'_id': referrer_user_id})
            if not referrer:
                return {'success': False, 'error': 'Referrer not found'}
            
            # Get or create referral code
            code_result = await self.get_or_create_referral_code(referrer_user_id)
            if not code_result['success']:
                return code_result
            
            referral_code = code_result['code']
            
            # Check if this phone already exists as a lead from this referrer
            existing_lead = await self.db.referral_leads.find_one({
                'referrer_user_id': referrer_user_id,
                'friend_phone': friend_phone
            })
            
            if existing_lead:
                return {
                    'success': False,
                    'error': 'Ya has referido a esta persona anteriormente',
                    'existing_lead_id': str(existing_lead['_id'])
                }
            
            # Create lead document
            lead_doc = {
                'referrer_user_id': referrer_user_id,
                'referrer_name': referrer.get('full_name') or referrer.get('name', 'Usuario'),
                'referrer_email': referrer.get('email'),
                'referrer_phone': referrer.get('phone'),
                'referral_code': referral_code,
                'friend_name': friend_name,
                'friend_phone': friend_phone,
                'friend_email': friend_email,
                'custom_message': message,
                'status': 'pending',  # pending, contacted, appointment_booked, service_completed, expired
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(days=90),  # 90 day validity
                'notifications_sent': [],
                'conversion_data': None
            }
            
            result = await self.db.referral_leads.insert_one(lead_doc)
            lead_id = str(result.inserted_id)
            
            # Update referral code stats
            await self.db.referral_codes.update_one(
                {'user_id': referrer_user_id},
                {
                    '$inc': {'total_referrals': 1, 'pending_referrals': 1},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            logger.info(f"✅ Created lead {lead_id} from referrer {referrer_user_id}")
            
            return {
                'success': True,
                'lead_id': lead_id,
                'referral_code': referral_code,
                'referral_link': code_result['referral_link'],
                'friend_name': friend_name,
                'status': 'pending'
            }
        except Exception as e:
            logger.error(f"Error creating lead: {e}")
            return {'success': False, 'error': str(e)}
    
    async def update_lead_status(
        self,
        lead_id: str,
        new_status: str,
        conversion_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Update lead status and notify referrer if needed
        
        Args:
            lead_id: The lead's ID
            new_status: New status (contacted, appointment_booked, service_completed)
            conversion_data: Optional data about the conversion
        """
        try:
            from bson import ObjectId
            
            if not ObjectId.is_valid(lead_id):
                return {'success': False, 'error': 'Invalid lead ID'}
            
            lead = await self.db.referral_leads.find_one({'_id': ObjectId(lead_id)})
            if not lead:
                return {'success': False, 'error': 'Lead not found'}
            
            old_status = lead.get('status')
            
            update_data = {
                'status': new_status,
                'updated_at': datetime.utcnow()
            }
            
            if conversion_data:
                update_data['conversion_data'] = conversion_data
            
            # Add notification record
            notification = {
                'type': f'status_changed_to_{new_status}',
                'timestamp': datetime.utcnow(),
                'old_status': old_status
            }
            
            await self.db.referral_leads.update_one(
                {'_id': ObjectId(lead_id)},
                {
                    '$set': update_data,
                    '$push': {'notifications_sent': notification}
                }
            )
            
            # If service completed, update successful referrals count and notify referrer
            if new_status == 'service_completed':
                await self.db.referral_codes.update_one(
                    {'user_id': lead['referrer_user_id']},
                    {
                        '$inc': {
                            'successful_referrals': 1,
                            'pending_referrals': -1,
                            'total_earnings': 25.0  # $25 credit per successful referral
                        },
                        '$set': {'updated_at': datetime.utcnow()}
                    }
                )
                
                # Add credit to referrer's account
                await self.db.credits_transactions.insert_one({
                    'user_id': lead['referrer_user_id'],
                    'amount': 25.0,
                    'type': 'referral_bonus',
                    'description': f"Bono de referido: {lead['friend_name']} completó un servicio",
                    'lead_id': lead_id,
                    'created_at': datetime.utcnow()
                })
                
                # Update user's credit balance
                await self.db.users.update_one(
                    {'id': lead['referrer_user_id']},
                    {'$inc': {'credit_balance': 25.0}}
                )
                
                logger.info(f"✅ Referral completed! Added $25 credit to user {lead['referrer_user_id']}")
            
            # Send notification to referrer about status change
            await self._notify_referrer(lead, new_status)
            
            return {
                'success': True,
                'lead_id': lead_id,
                'old_status': old_status,
                'new_status': new_status
            }
        except Exception as e:
            logger.error(f"Error updating lead status: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _notify_referrer(self, lead: Dict, new_status: str):
        """Send notification to referrer about referral status change"""
        try:
            referrer_id = lead['referrer_user_id']
            friend_name = lead['friend_name']
            
            messages = {
                'contacted': f"🎉 ¡{friend_name} recibió tu invitación! Te avisaremos cuando agende una cita.",
                'appointment_booked': f"📅 ¡{friend_name} agendó una cita! Estás cada vez más cerca de tu recompensa.",
                'service_completed': f"💰 ¡Felicidades! {friend_name} completó su servicio. ¡Has ganado $25 en créditos!"
            }
            
            message = messages.get(new_status)
            if not message:
                return
            
            # Create push notification
            await self.db.push_notifications.insert_one({
                'user_id': referrer_id,
                'title': 'Actualización de Referido',
                'body': message,
                'data': {
                    'type': 'referral_update',
                    'lead_id': str(lead['_id']),
                    'status': new_status
                },
                'created_at': datetime.utcnow(),
                'sent': False
            })
            
            logger.info(f"📨 Notification queued for referrer {referrer_id}: {new_status}")
        except Exception as e:
            logger.error(f"Error notifying referrer: {e}")
    
    async def get_user_referrals(self, user_id: str) -> Dict[str, Any]:
        """
        Get all referrals for a user
        
        Args:
            user_id: The user's ID
            
        Returns:
            List of referrals with stats
        """
        try:
            # Get referral code info
            code_info = await self.db.referral_codes.find_one({'user_id': user_id})
            
            if not code_info:
                # Create one if doesn't exist
                code_result = await self.get_or_create_referral_code(user_id)
                code_info = {
                    'code': code_result.get('code'),
                    'referral_link': code_result.get('referral_link'),
                    'total_referrals': 0,
                    'successful_referrals': 0,
                    'total_earnings': 0.0
                }
            
            # Get all leads
            leads_cursor = self.db.referral_leads.find({'referrer_user_id': user_id})
            leads = await leads_cursor.to_list(length=100)
            
            # Format leads
            formatted_leads = []
            for lead in leads:
                formatted_leads.append({
                    'id': str(lead['_id']),
                    'friend_name': lead['friend_name'],
                    'friend_phone': lead['friend_phone'][-4:] if lead.get('friend_phone') else None,  # Last 4 digits only
                    'status': lead['status'],
                    'created_at': lead['created_at'].isoformat() if lead.get('created_at') else None,
                    'updated_at': lead['updated_at'].isoformat() if lead.get('updated_at') else None
                })
            
            return {
                'success': True,
                'referral_code': code_info.get('code'),
                'referral_link': code_info.get('referral_link'),
                'stats': {
                    'total_referrals': code_info.get('total_referrals', 0),
                    'successful_referrals': code_info.get('successful_referrals', 0),
                    'pending_referrals': code_info.get('pending_referrals', 0),
                    'total_earnings': code_info.get('total_earnings', 0.0)
                },
                'referrals': formatted_leads
            }
        except Exception as e:
            logger.error(f"Error getting user referrals: {e}")
            return {'success': False, 'error': str(e)}
    
    async def process_referral_from_code(
        self,
        referral_code: str,
        new_user_id: str,
        new_user_name: str,
        new_user_phone: str
    ) -> Dict[str, Any]:
        """
        Process a referral when someone signs up using a referral code
        
        Args:
            referral_code: The referral code used
            new_user_id: The new user's ID
            new_user_name: The new user's name
            new_user_phone: The new user's phone
        """
        try:
            # Find the referral code
            code_doc = await self.db.referral_codes.find_one({'code': referral_code})
            if not code_doc:
                return {'success': False, 'error': 'Invalid referral code'}
            
            referrer_user_id = code_doc['user_id']
            
            # Check if this user was already referred
            existing_lead = await self.db.referral_leads.find_one({
                'friend_phone': new_user_phone,
                'referrer_user_id': referrer_user_id
            })
            
            if existing_lead:
                # Update existing lead with new user info
                await self.db.referral_leads.update_one(
                    {'_id': existing_lead['_id']},
                    {
                        '$set': {
                            'referred_user_id': new_user_id,
                            'status': 'contacted',
                            'updated_at': datetime.utcnow()
                        }
                    }
                )
                return {
                    'success': True,
                    'lead_id': str(existing_lead['_id']),
                    'referrer_user_id': referrer_user_id,
                    'message': 'Lead updated with new user ID'
                }
            
            # Create new lead
            result = await self.create_lead(
                referrer_user_id=referrer_user_id,
                friend_name=new_user_name,
                friend_phone=new_user_phone
            )
            
            if result['success']:
                # Update lead with new user ID
                from bson import ObjectId
                await self.db.referral_leads.update_one(
                    {'_id': ObjectId(result['lead_id'])},
                    {
                        '$set': {
                            'referred_user_id': new_user_id,
                            'status': 'contacted'
                        }
                    }
                )
            
            return result
        except Exception as e:
            logger.error(f"Error processing referral from code: {e}")
            return {'success': False, 'error': str(e)}
    
    async def check_and_convert_lead_on_appointment(
        self,
        user_phone: str,
        appointment_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Check if a user booking an appointment was referred and update status
        """
        try:
            # Find lead by phone
            lead = await self.db.referral_leads.find_one({
                'friend_phone': user_phone,
                'status': {'$in': ['pending', 'contacted']}
            })
            
            if lead:
                result = await self.update_lead_status(
                    str(lead['_id']),
                    'appointment_booked',
                    {'appointment_id': appointment_id, 'booked_at': datetime.utcnow().isoformat()}
                )
                return result
            
            return None
        except Exception as e:
            logger.error(f"Error checking lead on appointment: {e}")
            return None
    
    async def check_and_convert_lead_on_service_completion(
        self,
        user_phone: str,
        service_order_id: str,
        service_amount: float
    ) -> Optional[Dict[str, Any]]:
        """
        Check if a user completing a service was referred and reward referrer
        """
        try:
            # Find lead by phone
            lead = await self.db.referral_leads.find_one({
                'friend_phone': user_phone,
                'status': {'$in': ['pending', 'contacted', 'appointment_booked']}
            })
            
            if lead:
                result = await self.update_lead_status(
                    str(lead['_id']),
                    'service_completed',
                    {
                        'service_order_id': service_order_id,
                        'service_amount': service_amount,
                        'completed_at': datetime.utcnow().isoformat()
                    }
                )
                return result
            
            return None
        except Exception as e:
            logger.error(f"Error checking lead on service completion: {e}")
            return None


# Global instance (will be initialized with db)
referral_service_v2: Optional[ReferralServiceV2] = None


def init_referral_service_v2(db: AsyncIOMotorDatabase):
    """Initialize the referral service with database connection"""
    global referral_service_v2
    referral_service_v2 = ReferralServiceV2(db)
    logger.info("✅ Referral Service V2 initialized")
    return referral_service_v2
