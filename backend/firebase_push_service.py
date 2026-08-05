"""
Firebase Cloud Messaging Service for Push Notifications
"""
import firebase_admin
from firebase_admin import credentials, messaging
import logging
import os
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

class FirebasePushService:
    """Service for sending push notifications via Firebase Cloud Messaging"""
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not FirebasePushService._initialized:
            self._initialize()
            FirebasePushService._initialized = True
    
    def _initialize(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check for credentials file
            cred_path = os.path.join(os.path.dirname(__file__), 'firebase_config.json')
            
            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                logger.info("✅ Firebase Admin SDK initialized successfully")
                self.is_initialized = True
            else:
                logger.warning("⚠️ Firebase credentials file not found")
                self.is_initialized = False
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firebase: {e}")
            self.is_initialized = False
    
    async def send_to_device(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None,
        badge: Optional[int] = None,
        sound: str = "default",
        is_apns_token: bool = False
    ) -> Dict[str, Any]:
        """
        Send push notification to a single device
        
        Args:
            token: FCM device token or APNs token
            title: Notification title
            body: Notification body
            data: Optional data payload
            image_url: Optional image URL
            badge: iOS badge count
            sound: Notification sound
            is_apns_token: If True, treat token as APNs token for iOS
            
        Returns:
            Dict with success status and message ID or error
        """
        if not self.is_initialized:
            return {"success": False, "error": "Firebase not initialized"}
        
        if not token:
            return {"success": False, "error": "No FCM token provided"}
        
        try:
            # Build the message
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            # iOS specific config with APNs token support
            apns = messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        badge=badge,
                        sound=sound,
                        content_available=True,
                        mutable_content=True
                    )
                ),
                headers={
                    'apns-priority': '10',
                    'apns-push-type': 'alert'
                }
            )
            
            # Android specific config
            android = messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound=sound,
                    default_sound=True,
                    priority='high'
                )
            )
            
            # If using APNs token directly, we need to use a different approach
            if is_apns_token and len(token) == 64:
                # For APNs tokens, use the APNS token field
                message = messaging.Message(
                    notification=notification,
                    data=data or {},
                    apns=apns,
                    android=android,
                    token=token  # FCM can route APNs tokens if properly configured
                )
            else:
                message = messaging.Message(
                    notification=notification,
                    data=data or {},
                    token=token,
                    apns=apns,
                    android=android
                )
            
            # Send the message
            response = messaging.send(message)
            
            logger.info(f"✅ Push notification sent successfully: {response}")
            return {"success": True, "message_id": response}
            
        except messaging.UnregisteredError:
            logger.warning(f"⚠️ Device token is no longer valid: {token[:20]}...")
            return {"success": False, "error": "Token expired or invalid", "should_remove_token": True}
        except messaging.SenderIdMismatchError:
            logger.error("❌ Sender ID mismatch - check Firebase project configuration")
            return {"success": False, "error": "Sender ID mismatch"}
        except Exception as e:
            logger.error(f"❌ Failed to send push notification: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_to_multiple_devices(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to multiple devices
        
        Args:
            tokens: List of FCM device tokens
            title: Notification title
            body: Notification body
            data: Optional data payload
            image_url: Optional image URL
            
        Returns:
            Dict with success count, failure count, and details
        """
        if not self.is_initialized:
            return {"success": False, "error": "Firebase not initialized"}
        
        if not tokens:
            return {"success": False, "error": "No tokens provided"}
        
        try:
            # Build the multicast message
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            message = messaging.MulticastMessage(
                notification=notification,
                data=data or {},
                tokens=tokens,
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", content_available=True)
                    )
                ),
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound="default",
                        default_sound=True
                    )
                )
            )
            
            # Send to all devices
            response = messaging.send_each_for_multicast(message)
            
            # Process results
            success_count = response.success_count
            failure_count = response.failure_count
            failed_tokens = []
            
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    failed_tokens.append({
                        "token": tokens[idx][:20] + "...",
                        "error": str(resp.exception)
                    })
            
            logger.info(f"✅ Multicast sent: {success_count} success, {failure_count} failed")
            
            return {
                "success": True,
                "success_count": success_count,
                "failure_count": failure_count,
                "failed_tokens": failed_tokens
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to send multicast push: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_to_topic(
        self,
        topic: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None,
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a topic
        
        Args:
            topic: FCM topic name
            title: Notification title
            body: Notification body
            data: Optional data payload
            image_url: Optional image URL
            
        Returns:
            Dict with success status and message ID
        """
        if not self.is_initialized:
            return {"success": False, "error": "Firebase not initialized"}
        
        try:
            notification = messaging.Notification(
                title=title,
                body=body,
                image=image_url
            )
            
            message = messaging.Message(
                notification=notification,
                data=data or {},
                topic=topic
            )
            
            response = messaging.send(message)
            
            logger.info(f"✅ Topic notification sent to '{topic}': {response}")
            return {"success": True, "message_id": response}
            
        except Exception as e:
            logger.error(f"❌ Failed to send topic notification: {e}")
            return {"success": False, "error": str(e)}
    
    async def subscribe_to_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Subscribe devices to a topic"""
        if not self.is_initialized:
            return {"success": False, "error": "Firebase not initialized"}
        
        try:
            response = messaging.subscribe_to_topic(tokens, topic)
            logger.info(f"✅ Subscribed {response.success_count} devices to topic '{topic}'")
            return {
                "success": True,
                "success_count": response.success_count,
                "failure_count": response.failure_count
            }
        except Exception as e:
            logger.error(f"❌ Failed to subscribe to topic: {e}")
            return {"success": False, "error": str(e)}
    
    async def unsubscribe_from_topic(self, tokens: List[str], topic: str) -> Dict[str, Any]:
        """Unsubscribe devices from a topic"""
        if not self.is_initialized:
            return {"success": False, "error": "Firebase not initialized"}
        
        try:
            response = messaging.unsubscribe_from_topic(tokens, topic)
            logger.info(f"✅ Unsubscribed {response.success_count} devices from topic '{topic}'")
            return {
                "success": True,
                "success_count": response.success_count,
                "failure_count": response.failure_count
            }
        except Exception as e:
            logger.error(f"❌ Failed to unsubscribe from topic: {e}")
            return {"success": False, "error": str(e)}


# Global instance
firebase_push_service = FirebasePushService()
