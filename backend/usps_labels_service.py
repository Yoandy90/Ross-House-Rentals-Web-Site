"""
USPS Labels Service
Handles USPS Labels API v3 for creating shipping labels
Documentation: https://github.com/USPS/api-examples
"""
import os
import requests
import logging
from typing import Dict, Optional, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)

class USPSLabelsService:
    """
    Service for USPS Labels API v3
    
    Features:
    - Create domestic shipping labels
    - Create international shipping labels
    - Generate tracking numbers
    - Get label images (PDF, PNG)
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize USPS Labels service"""
        self.db = db
        
        # OAuth credentials
        self.client_id = os.getenv('USPS_CLIENT_ID')
        self.client_secret = os.getenv('USPS_CLIENT_SECRET')
        self.crid = os.getenv('USPS_CRID')  # Customer Registration ID
        self.mid = os.getenv('USPS_MAILER_ID') or os.getenv('USPS_MID')    # Mailer ID
        self.eps_account = os.getenv('USPS_EPS_ACCOUNT')  # Enterprise Payment System
        
        # API endpoints
        self.base_url = "https://apis.usps.com"
        self.test_base_url = "https://apis-cat.usps.com"
        
        # Use production when EPS account is configured
        self.use_test = os.getenv('USPS_USE_TEST', 'false').lower() == 'true'
        self.api_url = self.test_base_url if self.use_test else self.base_url
        
        # Access token
        self.access_token = None
        self.token_expires_at = None
        
        logger.info(f"✅ USPS Labels Service initialized (Test mode: {self.use_test})")
    
    async def get_access_token(self) -> str:
        """
        Get OAuth 2.0 access token using client credentials
        
        Returns:
            Access token string
        """
        # Check if token is still valid
        if self.access_token and self.token_expires_at:
            if datetime.now(timezone.utc).timestamp() < self.token_expires_at:
                return self.access_token
        
        # Request new token - OAuth endpoint is always production URL
        url = f"{self.base_url}/oauth2/v3/token"
        
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            self.access_token = data['access_token']
            expires_in = int(data['expires_in'])
            
            # Set expiration time (subtract 5 minutes for safety)
            self.token_expires_at = datetime.now(timezone.utc).timestamp() + expires_in - 300
            
            logger.info("✅ USPS OAuth token obtained successfully")
            return self.access_token
            
        except Exception as e:
            logger.error(f"❌ Error obtaining USPS OAuth token: {str(e)}")
            raise Exception(f"Failed to obtain USPS access token: {str(e)}")
    
    async def create_domestic_label(
        self,
        mail_class: str,
        from_address: Dict,
        to_address: Dict,
        weight: float,
        dimensions: Dict = None,
        extra_services: List[int] = None,
        image_type: str = "PDF"
    ) -> Dict:
        """
        Create a domestic shipping label
        
        Args:
            mail_class: Mail class (e.g., "PRIORITY_MAIL", "FIRST_CLASS_PACKAGE")
            from_address: Sender address dict
            to_address: Recipient address dict
            weight: Package weight in ounces
            dimensions: Optional dimensions (length, width, height in inches)
            extra_services: Optional list of extra service codes
            image_type: Label format ("PDF", "PNG", "ZPL")
            
        Returns:
            Dict with label data including tracking number and label image
        """
        token = await self.get_access_token()
        url = f"{self.api_url}/labels/v3/label"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Build request payload
        payload = {
            "imageInfo": {
                "imageType": image_type,
                "labelType": "6X4LABEL"
            },
            "fromAddress": {
                "firstName": from_address.get('firstName', ''),
                "lastName": from_address.get('lastName', ''),
                "firm": from_address.get('firm', 'Ross Tax Preparation'),
                "streetAddress": from_address.get('streetAddress'),
                "secondaryAddress": from_address.get('secondaryAddress', from_address.get('suite', '')),
                "city": from_address.get('city'),
                "state": from_address.get('state'),
                "ZIPCode": from_address.get('ZIPCode'),
                "ZIPPlus4": from_address.get('ZIPPlus4', '')
            },
            "toAddress": {
                "firstName": to_address.get('firstName', ''),
                "lastName": to_address.get('lastName', ''),
                "firm": to_address.get('firm', ''),
                "streetAddress": to_address.get('streetAddress'),
                "secondaryAddress": to_address.get('secondaryAddress', to_address.get('suite', '')),
                "city": to_address.get('city'),
                "state": to_address.get('state'),
                "ZIPCode": to_address.get('ZIPCode'),
                "ZIPPlus4": to_address.get('ZIPPlus4', '')
            },
            "weight": weight,
            "mailClass": mail_class,
            "processingCategory": "MACHINABLE",
            "rateIndicator": "DR",  # Dimensional/Rectangular
            "priceType": "COMMERCIAL"
        }
        
        # Add EPS payment account if configured
        if self.eps_account:
            payload["paymentAccount"] = {
                "accountType": "EPS",
                "accountNumber": self.eps_account
            }
        
        # Add sender info (CRID/MID) if configured
        if self.crid or self.mid:
            payload["senderInfo"] = {}
            if self.crid:
                payload["senderInfo"]["CRID"] = self.crid
            if self.mid:
                payload["senderInfo"]["MID"] = self.mid
        
        # Add dimensions if provided
        if dimensions:
            payload["dimensions"] = {
                "length": dimensions.get('length'),
                "width": dimensions.get('width'),
                "height": dimensions.get('height')
            }
        
        # Add extra services if provided
        if extra_services:
            payload["extraServices"] = extra_services
        
        try:
            import httpx as httpx_client
            async with httpx_client.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=60)
                response.raise_for_status()
                
                # Parse multipart response
                result = self._parse_label_response(response)
            
            # Save to database
            label_record = {
                "tracking_number": result['trackingNumber'],
                "mail_class": mail_class,
                "from_address": from_address,
                "to_address": to_address,
                "weight": weight,
                "label_image": result['labelImage'],
                "image_type": image_type,
                "created_at": datetime.now(timezone.utc),
                "status": "created"
            }
            
            await self.db.usps_labels.insert_one(label_record)
            
            logger.info(f"✅ Domestic label created: {result['trackingNumber']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Error creating domestic label: {str(e)}")
            raise Exception(f"Failed to create domestic label: {str(e)}")
    
    def _parse_label_response(self, response) -> Dict:
        """
        Parse multipart/mixed response from Labels API
        
        Returns:
            Dict with tracking number and label image
        """
        # The response is multipart/mixed with JSON metadata and PDF/image
        content_type = response.headers.get('Content-Type', '')
        
        if 'multipart' in content_type:
            # Parse multipart response
            parts = response.content.split(b'--')
            
            tracking_number = None
            label_image = None
            
            for part in parts:
                if b'trackingNumber' in part:
                    # Extract JSON metadata
                    try:
                        json_start = part.find(b'{')
                        json_end = part.rfind(b'}') + 1
                        if json_start != -1 and json_end > json_start:
                            import json
                            metadata = json.loads(part[json_start:json_end])
                            tracking_number = metadata.get('trackingNumber')
                    except:
                        pass
                
                elif b'PDF' in part or b'PNG' in part:
                    # Extract label image
                    # Find the start of binary data (after headers)
                    header_end = part.find(b'\r\n\r\n')
                    if header_end != -1:
                        label_image = part[header_end + 4:]
            
            return {
                'trackingNumber': tracking_number,
                'labelImage': label_image
            }
        else:
            # Simple JSON response
            return response.json()
    
    async def get_label_by_tracking(self, tracking_number: str) -> Optional[Dict]:
        """
        Get label record from database by tracking number
        
        Args:
            tracking_number: USPS tracking number
            
        Returns:
            Label record dict or None
        """
        label = await self.db.usps_labels.find_one(
            {"tracking_number": tracking_number}
        )
        
        if label:
            label['_id'] = str(label['_id'])
            return label
        
        return None
    
    async def list_labels(self, limit: int = 50, skip: int = 0) -> List[Dict]:
        """
        List all created labels
        
        Args:
            limit: Maximum number of records
            skip: Number of records to skip
            
        Returns:
            List of label records
        """
        cursor = self.db.usps_labels.find().sort('created_at', -1).skip(skip).limit(limit)
        labels = await cursor.to_list(length=limit)
        
        for label in labels:
            label['_id'] = str(label['_id'])
            # Don't return the full image data in list view
            if 'label_image' in label:
                label['has_image'] = True
                del label['label_image']
        
        return labels
    
    async def validate_address(self, address: Dict) -> Optional[Dict]:
        """
        Validate an address using USPS Address API v3
        Specification: addresses-v3r2_2.yaml
        
        Args:
            address: Dict with address2 (streetAddress), city, state, zip5 fields
            
        Returns:
            Validated address dict or None if validation fails
        """
        token = await self.get_access_token()
        url = f"{self.api_url}/addresses/v3/address"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        # Per specification: Must specify streetAddress, state, and either city or ZIPCode
        params = {
            "streetAddress": address.get('address2', ''),
            "state": address.get('state', '')
        }
        
        # Must have at least city OR ZIP code
        if address.get('city'):
            params["city"] = address.get('city')
        if address.get('zip5'):
            params["ZIPCode"] = address.get('zip5')
            
        # Add optional parameters
        if address.get('address1'):
            params["secondaryAddress"] = address.get('address1')
        if address.get('zip4'):
            params["ZIPPlus4"] = address.get('zip4')
        
        try:
            logger.info(f"📤 USPS API v3 Request: {url} with params: {params}")
            
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=30
            )
            
            logger.info(f"📥 USPS API v3 Status: {response.status_code}")
            
            if response.status_code == 401:
                logger.error("❌ USPS API authentication failed - API access to 'addresses' scope not granted")
                logger.error("📋 Action required: Enable 'Addresses API v3' in your USPS Developer Portal")
                return None
                
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"📥 USPS API v3 Response: {data}")
            
            # Extract validated address from response (per specification schema)
            address_data = data.get('address', {})
            additional_info = data.get('additionalInfo', {})
            
            validated = {
                'address1': address_data.get('secondaryAddress', ''),
                'address2': address_data.get('streetAddress', ''),
                'city': address_data.get('city', ''),
                'state': address_data.get('state', ''),
                'zip5': address_data.get('ZIPCode', ''),
                'zip4': address_data.get('ZIPPlus4', ''),
                'deliveryPoint': additional_info.get('deliveryPoint'),
                'carrierRoute': additional_info.get('carrierRoute'),
                'dpvConfirmation': additional_info.get('DPVConfirmation')
            }
            
            logger.info(f"✅ Address validated via API v3: {validated['address2']}, {validated['city']}, {validated['state']}")
            return validated
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                logger.warning("⚠️ Address not found in USPS database")
            elif e.response.status_code == 401:
                logger.error("❌ USPS API authentication failed - 'addresses' scope not enabled")
            elif e.response.status_code == 403:
                logger.error("❌ USPS API access forbidden - check API permissions")
            else:
                logger.error(f"❌ Address validation HTTP error ({e.response.status_code}): {str(e)}")
                if e.response.text:
                    logger.error(f"Response: {e.response.text[:500]}")
            return None
        except Exception as e:
            logger.error(f"❌ Address validation error: {str(e)}")
            return None
