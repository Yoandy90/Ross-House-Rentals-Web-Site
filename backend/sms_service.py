"""
SMS Service using Twilio
For sending SMS messages to clients from admin panel
"""
import logging
from typing import List, Optional, Dict
from datetime import datetime
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

logger = logging.getLogger(__name__)

class SMSService:
    """Service for sending SMS messages via Twilio"""
    
    def __init__(self, account_sid: str, auth_token: str, phone_number: str):
        """
        Initialize SMS service with Twilio credentials
        
        Args:
            account_sid: Twilio Account SID
            auth_token: Twilio Auth Token
            phone_number: Twilio phone number (from)
        """
        self.client = Client(account_sid, auth_token)
        self.from_number = phone_number
    
    async def send_sms(
        self,
        to_number: str,
        message: str
    ) -> Dict:
        """
        Send SMS to a single phone number
        
        Args:
            to_number: Recipient phone number (E.164 format: +1234567890)
            message: SMS message content
        
        Returns:
            Dict with success status and message SID or error
        """
        try:
            # Validate phone number format
            if not to_number.startswith('+'):
                # Assume US number if no country code
                to_number = f'+1{to_number.replace("-", "").replace(" ", "").replace("(", "").replace(")", "")}'
            
            # Send SMS via Twilio
            twilio_message = self.client.messages.create(
                body=message,
                from_=self.from_number,
                to=to_number
            )
            
            logger.info(f"SMS sent successfully to {to_number} - SID: {twilio_message.sid}")
            
            return {
                'success': True,
                'message_sid': twilio_message.sid,
                'to': to_number,
                'status': twilio_message.status
            }
            
        except TwilioRestException as e:
            logger.error(f"Twilio error sending SMS to {to_number}: {e.msg}")
            return {
                'success': False,
                'error': e.msg,
                'error_code': e.code,
                'to': to_number
            }
        except Exception as e:
            logger.error(f"Error sending SMS to {to_number}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'to': to_number
            }
    
    async def send_bulk_sms(
        self,
        phone_numbers: List[str],
        message: str
    ) -> Dict:
        """
        Send SMS to multiple phone numbers
        
        Args:
            phone_numbers: List of recipient phone numbers
            message: SMS message content
        
        Returns:
            Dict with results including success count and errors
        """
        results = {
            'total': len(phone_numbers),
            'success_count': 0,
            'failed_count': 0,
            'results': [],
            'errors': []
        }
        
        for phone_number in phone_numbers:
            result = await self.send_sms(phone_number, message)
            
            if result['success']:
                results['success_count'] += 1
            else:
                results['failed_count'] += 1
                results['errors'].append({
                    'phone': phone_number,
                    'error': result.get('error')
                })
            
            results['results'].append(result)
        
        logger.info(f"Bulk SMS sent: {results['success_count']}/{results['total']} successful")
        
        return results
    
    async def send_to_users(
        self,
        db,
        message: str,
        user_ids: Optional[List[str]] = None,
        role: Optional[str] = None
    ) -> Dict:
        """
        Send SMS to users from database
        
        Args:
            db: Database connection
            message: SMS message content
            user_ids: Optional list of specific user IDs
            role: Optional role filter ('client', 'admin')
        
        Returns:
            Dict with results
        """
        try:
            # Build query
            if user_ids:
                query = {'_id': {'$in': user_ids}, 'phone': {'$exists': True, '$ne': None}}
            else:
                query = {'phone': {'$exists': True, '$ne': None}}
                if role:
                    query['role'] = role
            
            # Get users with phone numbers
            users = await db.users.find(query).to_list(10000)
            
            if not users:
                return {
                    'success': False,
                    'message': 'No users found with phone numbers'
                }
            
            # Extract phone numbers
            phone_numbers = [user.get('phone') for user in users if user.get('phone')]
            
            # Send bulk SMS
            result = await self.send_bulk_sms(phone_numbers, message)
            
            # Create SMS log records in database
            for user in users:
                sms_log = {
                    'user_id': user['_id'],
                    'phone': user.get('phone'),
                    'message': message,
                    'sent_at': datetime.utcnow(),
                    'status': 'sent' if user.get('phone') in [r['to'] for r in result['results'] if r['success']] else 'failed',
                    'type': 'admin_bulk'
                }
                await db.sms_logs.insert_one(sms_log)
            
            return result
            
        except Exception as e:
            logger.error(f"Error sending SMS to users: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


# Singleton instance
_sms_service = None

def get_sms_service(account_sid: str, auth_token: str, phone_number: str) -> SMSService:
    """Get or create SMS service singleton"""
    global _sms_service
    if _sms_service is None:
        _sms_service = SMSService(account_sid, auth_token, phone_number)
    return _sms_service
