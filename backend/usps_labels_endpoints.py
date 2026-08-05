"""
USPS Labels API Endpoints
Provides endpoints for creating and managing USPS shipping labels
AND address validation for clients
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import base64
from io import BytesIO
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
usps_labels_service = None
usps_validation_service = None  # For address validation (old USPS service)

def set_usps_labels_service(service):
    """Set the USPS Labels service instance"""
    global usps_labels_service
    usps_labels_service = service

def set_usps_validation_service(service):
    """Set the USPS Address Validation service instance"""
    global usps_validation_service
    usps_validation_service = service

# Pydantic models
class AddressModel(BaseModel):
    firstName: str
    lastName: str
    firm: Optional[str] = ""
    streetAddress: str
    city: str
    state: str
    ZIPCode: str
    ZIPPlus4: Optional[str] = ""

class DimensionsModel(BaseModel):
    length: float
    width: float
    height: float

class CreateLabelRequest(BaseModel):
    mailClass: str
    fromAddress: AddressModel
    toAddress: AddressModel
    weight: float  # in ounces
    dimensions: Optional[DimensionsModel] = None
    extraServices: Optional[List[int]] = None
    imageType: Optional[str] = "PDF"

class LabelResponse(BaseModel):
    trackingNumber: str
    mailClass: str
    weight: float
    status: str
    createdAt: str
    hasImage: bool = True

# ============================================
# ADDRESS VALIDATION MODELS
# ============================================

class AddressValidationRequest(BaseModel):
    """Request model for address validation - Client app use"""
    address1: Optional[str] = Field(None, description="Apartment or suite number")
    address2: str = Field(..., description="Street address")
    city: Optional[str] = Field(None, description="City name")
    state: Optional[str] = Field(None, description="Two-letter state code (e.g., FL)")
    zip5: Optional[str] = Field(None, description="5-digit ZIP code")
    
class ValidatedAddressResponse(BaseModel):
    """Response model for validated address"""
    address1: Optional[str] = None
    address2: str
    city: str
    state: str
    zip5: str
    zip4: str
    displayAddress: str
    isValid: bool = True
    
class ZipcodeLookupRequest(BaseModel):
    """Request to find ZIP code from address"""
    address: str = Field(..., description="Street address")
    city: str = Field(..., description="City name")
    state: str = Field(..., description="Two-letter state code")

@router.get('/test-connection')
async def test_usps_connection():
    """
    Test USPS API connection by obtaining an OAuth token
    
    Returns:
    - success: Connection status
    - message: Status message
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        # Try to get access token
        token = await usps_labels_service.get_access_token()
        
        return {
            'success': True,
            'message': 'USPS API connection successful',
            'test_mode': usps_labels_service.use_test,
            'api_url': usps_labels_service.api_url
        }
        
    except Exception as e:
        logger.error(f"Error testing USPS connection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/labels/rates', response_model=dict)
async def get_shipping_rates(request: dict):
    """
    Get USPS shipping rates for a package.
    
    Request body:
    - from_zip: Origin ZIP code
    - to_zip: Destination ZIP code
    - weight_oz: Package weight in ounces
    - mail_class: Optional specific mail class
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        from_zip = request.get('from_zip', '')
        to_zip = request.get('to_zip', '')
        weight_oz = float(request.get('weight_oz', 16))
        
        if not from_zip or not to_zip:
            raise HTTPException(status_code=400, detail="from_zip and to_zip are required")
        
        # Get token
        token = await usps_labels_service.get_access_token()
        if not token:
            raise HTTPException(status_code=503, detail="Failed to get USPS API token")
        
        import httpx
        from datetime import date
        
        # Call USPS Domestic Pricing API v3
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Get rates for different mail classes
        mail_classes = [
            ('USPS_GROUND_ADVANTAGE', 'DR', 'USPS Ground Advantage'),
            ('PRIORITY_MAIL', 'DR', 'Priority Mail'),
            ('PRIORITY_MAIL_EXPRESS', 'DR', 'Priority Mail Express'),
            ('FIRST_CLASS_PACKAGE_SERVICE', 'SP', 'First-Class Package'),
        ]
        rates = []
        mailing_date = date.today().isoformat()
        
        async with httpx.AsyncClient() as client:
            for mail_class, rate_indicator, display_name in mail_classes:
                try:
                    payload = {
                        "originZIPCode": from_zip,
                        "destinationZIPCode": to_zip,
                        "weight": weight_oz,
                        "length": 12,
                        "width": 9,
                        "height": 4,
                        "mailClass": mail_class,
                        "processingCategory": "MACHINABLE",
                        "destinationEntryFacilityType": "NONE",
                        "rateIndicator": rate_indicator,
                        "priceType": "RETAIL",
                        "mailingDate": mailing_date,
                    }
                    
                    resp = await client.post(
                        f"{usps_labels_service.api_url}/prices/v3/base-rates/search",
                        json=payload,
                        headers=headers,
                        timeout=10
                    )
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        total_price = data.get('totalBasePrice', 0)
                        rate_entries = data.get('rates', [])
                        
                        if total_price or rate_entries:
                            price = total_price
                            if not price and rate_entries:
                                price = rate_entries[0].get('price', 0)
                            
                            zone = rate_entries[0].get('zone', '') if rate_entries else ''
                            description = rate_entries[0].get('description', '') if rate_entries else ''
                            
                            rates.append({
                                'mailClass': mail_class,
                                'displayName': display_name,
                                'price': float(price),
                                'zone': zone,
                                'description': description,
                                'mailingDate': mailing_date,
                            })
                    else:
                        logger.debug(f"USPS rate {mail_class}: {resp.status_code} - {resp.text[:200]}")
                except Exception as rate_err:
                    logger.warning(f"Could not get rate for {mail_class}: {rate_err}")
                    continue
        
        # Sort by price
        rates.sort(key=lambda x: x.get('price', 999))
        
        return {
            'success': True,
            'from_zip': from_zip,
            'to_zip': to_zip,
            'weight_oz': weight_oz,
            'rates': rates,
            'total_options': len(rates)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shipping rates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/labels/passport-rates', response_model=dict)
async def get_passport_shipping_rates(request: dict):
    """
    Get shipping rates specifically for passport service.
    Uses Ross Tax address as origin, client ZIP as destination.
    Returns only envelope-appropriate rates with markup.
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        client_zip = request.get('client_zip', '')
        if not client_zip or len(client_zip) < 5:
            raise HTTPException(status_code=400, detail="Valid client_zip is required")
        
        ROSS_TAX_ZIP = "79029"  # Ross Tax, Dumas TX
        
        token = await usps_labels_service.get_access_token()
        if not token:
            raise HTTPException(status_code=503, detail="Failed to get USPS API token")
        
        import httpx
        from datetime import date
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Envelope specs for passport documents (~6oz)
        mail_classes = [
            ('USPS_GROUND_ADVANTAGE', 'DR', 'Ground Advantage', '2-5 días', '📦'),
            ('PRIORITY_MAIL', 'DR', 'Priority Mail', '1-3 días', '📬'),
            ('PRIORITY_MAIL_EXPRESS', 'DR', 'Priority Mail Express', '1-2 días', '⚡'),
        ]
        
        rates = []
        mailing_date = date.today().isoformat()
        
        async with httpx.AsyncClient() as client:
            for mail_class, rate_indicator, display_name, delivery_time, emoji in mail_classes:
                try:
                    payload = {
                        "originZIPCode": ROSS_TAX_ZIP,
                        "destinationZIPCode": client_zip,
                        "weight": 6,  # ~6oz for passport envelope
                        "length": 10,
                        "width": 7,
                        "height": 1,
                        "mailClass": mail_class,
                        "processingCategory": "MACHINABLE",
                        "destinationEntryFacilityType": "NONE",
                        "rateIndicator": rate_indicator,
                        "priceType": "COMMERCIAL",
                        "mailingDate": mailing_date,
                    }
                    
                    resp = await client.post(
                        f"{usps_labels_service.api_url}/prices/v3/base-rates/search",
                        json=payload, headers=headers, timeout=10
                    )
                    
                    if resp.status_code == 200:
                        data = resp.json()
                        price = data.get('totalBasePrice', 0)
                        rate_entries = data.get('rates', [])
                        if not price and rate_entries:
                            price = rate_entries[0].get('price', 0)
                        
                        rates.append({
                            'mailClass': mail_class,
                            'displayName': display_name,
                            'deliveryTime': delivery_time,
                            'emoji': emoji,
                            'uspsPrice': round(float(price), 2),
                            'clientPrice': 0 if mail_class == 'USPS_GROUND_ADVANTAGE' else round(float(price) * 1.2, 2),
                            'isFree': mail_class == 'USPS_GROUND_ADVANTAGE',
                        })
                except Exception as e:
                    logger.warning(f"Passport rate {mail_class}: {e}")
                    continue
        
        rates.sort(key=lambda x: x.get('uspsPrice', 999))
        
        return {
            'success': True,
            'rates': rates,
            'origin_zip': ROSS_TAX_ZIP,
            'client_zip': client_zip,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting passport shipping rates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/labels', response_model=dict)
async def create_shipping_label(request: CreateLabelRequest):
    """
    Create a new USPS shipping label
    
    Request body:
    - mailClass: Mail class (e.g., "PRIORITY_MAIL", "FIRST_CLASS_PACKAGE")
    - fromAddress: Sender address
    - toAddress: Recipient address  
    - weight: Package weight in ounces
    - dimensions: Optional package dimensions (length, width, height in inches)
    - extraServices: Optional list of extra service codes
    - imageType: Label format ("PDF", "PNG", "ZPL")
    
    Returns:
    - trackingNumber: USPS tracking number
    - labelImage: Base64 encoded label image
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        # Convert Pydantic models to dicts
        from_address = request.fromAddress.dict()
        to_address = request.toAddress.dict()
        dimensions = request.dimensions.dict() if request.dimensions else None
        
        # Create the label
        result = await usps_labels_service.create_domestic_label(
            mail_class=request.mailClass,
            from_address=from_address,
            to_address=to_address,
            weight=request.weight,
            dimensions=dimensions,
            extra_services=request.extraServices,
            image_type=request.imageType
        )
        
        # Convert binary image to base64 for JSON response
        if result.get('labelImage'):
            label_image_b64 = base64.b64encode(result['labelImage']).decode('utf-8')
            result['labelImageBase64'] = label_image_b64
            del result['labelImage']
        
        return {
            'success': True,
            'trackingNumber': result['trackingNumber'],
            'labelImageBase64': result.get('labelImageBase64'),
            'message': 'Label created successfully'
        }
        
    except Exception as e:
        logger.error(f"Error creating shipping label: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/labels', response_model=List[dict])
async def list_shipping_labels(limit: int = 50, skip: int = 0):
    """
    List all created shipping labels
    
    Query params:
    - limit: Maximum number of labels to return (default: 50)
    - skip: Number of labels to skip (default: 0)
    
    Returns:
    - List of label records
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        labels = await usps_labels_service.list_labels(limit=limit, skip=skip)
        
        return labels
        
    except Exception as e:
        logger.error(f"Error listing shipping labels: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/labels/{tracking_number}')
async def get_shipping_label(tracking_number: str):
    """
    Get a specific shipping label by tracking number
    
    Path params:
    - tracking_number: USPS tracking number
    
    Returns:
    - Label record with details
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        label = await usps_labels_service.get_label_by_tracking(tracking_number)
        
        if not label:
            raise HTTPException(status_code=404, detail="Label not found")
        
        # Don't return the full image in the get response
        if 'label_image' in label:
            label['has_image'] = True
            del label['label_image']
        
        return label
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shipping label: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/labels/{tracking_number}/download')
async def download_shipping_label(tracking_number: str):
    """
    Download the label image as a PDF file
    
    Path params:
    - tracking_number: USPS tracking number
    
    Returns:
    - PDF file stream
    """
    try:
        if not usps_labels_service:
            raise HTTPException(status_code=503, detail="USPS Labels service not initialized")
        
        label = await usps_labels_service.get_label_by_tracking(tracking_number)
        
        if not label:
            raise HTTPException(status_code=404, detail="Label not found")
        
        if not label.get('label_image'):
            raise HTTPException(status_code=404, detail="Label image not found")
        
        # Get the image type
        image_type = label.get('image_type', 'PDF')
        
        # Set content type based on image type
        content_type = {
            'PDF': 'application/pdf',
            'PNG': 'image/png',
            'ZPL': 'text/plain'
        }.get(image_type, 'application/pdf')
        
        # Create a file stream
        file_stream = BytesIO(label['label_image'])
        
        # Return as streaming response
        return StreamingResponse(
            file_stream,
            media_type=content_type,
            headers={
                'Content-Disposition': f'attachment; filename=label_{tracking_number}.{image_type.lower()}'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading shipping label: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# ADDRESS VALIDATION ENDPOINTS (For Clients)
# ============================================

@router.post('/address/validate', response_model=ValidatedAddressResponse)
async def validate_client_address(request: AddressValidationRequest):
    """
    Validate and standardize a US address for clients
    
    This endpoint is designed for use in the client app:
    - Validates address exists
    - Standardizes format (uppercase, abbreviations)  
    - Adds ZIP+4 code
    - Returns delivery point information
    
    Use cases:
    - Client profile address validation
    - Shipping address validation
    - Address autocomplete
    """
    try:
        # Use USPS Labels Service (API v3) for address validation
        logger.info(f"🔍 Address validation requested: {request.address2}, {request.city}, {request.state}")
        
        if not usps_labels_service:
            logger.error("❌ USPS Labels service not available")
            raise HTTPException(status_code=503, detail="Address validation service not available")
        
        logger.info("✅ USPS Labels service is available")
        
        # Prepare address dict for API v3
        address_dict = {
            'address1': request.address1,
            'address2': request.address2,
            'city': request.city,
            'state': request.state,
            'zip5': request.zip5
        }
        
        logger.info(f"📤 Calling USPS Addresses API v3 with request: {address_dict}")
        
        # Call Addresses API v3 validation
        validated = await usps_labels_service.validate_address(address_dict)
        
        logger.info(f"📥 USPS API response received: {validated}")
        
        if validated is None:
            logger.warning("⚠️ Address validation returned None")
            raise HTTPException(
                status_code=400,
                detail="La dirección no pudo ser validada. Por favor verifica e intenta nuevamente."
            )
        
        # Convert to client-friendly format
        response = ValidatedAddressResponse(
            address1=validated.address1,
            address2=validated.address2,
            city=validated.city,
            state=validated.state,
            zip5=validated.zip5,
            zip4=validated.zip4,
            displayAddress=validated.display_address,
            isValid=True
        )
        
        logger.info(f"✅ Address validated for client: {response.displayAddress}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Address validation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error al validar la dirección. Por favor intenta más tarde."
        )

@router.post('/zipcode/lookup')
async def lookup_zipcode_from_address(request: ZipcodeLookupRequest):
    """
    Look up ZIP code from street address, city, and state
    
    Use for address autocomplete:
    - User enters street address and city
    - Get ZIP code automatically
    """
    try:
        if not usps_validation_service:
            raise HTTPException(status_code=503, detail="ZIP code lookup service not available")
        
        from usps_models import AddressRequest
        
        address = AddressRequest(
            address2=request.address,
            city=request.city,
            state=request.state
        )
        
        result = await usps_validation_service.lookup_zipcode(address)
        
        if result is None:
            raise HTTPException(
                status_code=404,
                detail="No se encontró código postal para esta dirección"
            )
        
        return {
            "zip5": result.zip5,
            "zip4": result.zip4,
            "city": result.city,
            "state": result.state,
            "address": result.address2
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ZIP lookup error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error al buscar código postal"
        )

@router.get('/zipcode/citystate/{zip_code}')
async def lookup_citystate_from_zip(zip_code: str):
    """
    Look up city and state from ZIP code
    
    Use for quick address completion:
    - User enters ZIP code
    - Auto-fill city and state
    """
    if len(zip_code) != 5 or not zip_code.isdigit():
        raise HTTPException(
            status_code=400,
            detail="El código postal debe tener exactamente 5 dígitos"
        )
    
    try:
        if not usps_validation_service:
            raise HTTPException(status_code=503, detail="City/State lookup service not available")
        
        result = await usps_validation_service.lookup_citystate(zip_code)
        
        if result is None or not result.get("success", False):
            raise HTTPException(
                status_code=404,
                detail="No se encontró ciudad/estado para este código postal"
            )
        
        return {
            "zip5": result.get("ZIPCode", zip_code),
            "city": result.get("city", ""),
            "state": result.get("state", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"City/State lookup error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error al buscar ciudad y estado"
        )

logger.info("✅ USPS Labels and Address Validation endpoints initialized")
