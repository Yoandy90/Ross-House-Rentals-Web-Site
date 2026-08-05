"""
USPS API Endpoints — Updated for OAuth2 API v3
REST API endpoints for USPS address validation, ZIP lookup, tracking, and shipments
"""
from fastapi import APIRouter, HTTPException, Depends, status, Header, Request
from typing import List, Optional
import logging
from datetime import datetime, timezone

from usps_models import (
    AddressRequest, ValidatedAddress,
    ZipcodeLookupRequest, ZipcodeLookupResult,
    CityStateLookupRequest, CityStateLookupResult,
    TrackingRequest, TrackingResponse, TrackingEvent,
    ShipmentDB
)
from usps_service import USPSService

logger = logging.getLogger(__name__)
api_router = APIRouter()

# USPS Service instance
usps_service: Optional[USPSService] = None


def set_usps_service(service: USPSService):
    """Set the USPS service instance"""
    global usps_service
    usps_service = service


def get_usps_service() -> USPSService:
    """Dependency to get USPS service instance"""
    if usps_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="USPS service not initialized. Configure USPS_CLIENT_ID and USPS_CLIENT_SECRET."
        )
    return usps_service


# ═══════════════════════════════════════════════════════════════
# ADDRESS VALIDATION
# ═══════════════════════════════════════════════════════════════

@api_router.post('/address/validate', tags=['USPS'])
async def validate_address(address: AddressRequest, service: USPSService = Depends(get_usps_service)):
    """
    Validate and standardize a US address using USPS Addresses API v3.
    Returns the official USPS standardized address with ZIP+4.
    """
    try:
        result = await service.validate_address({
            "street_address": address.resolved_street,
            "secondary_address": address.resolved_secondary,
            "city": address.city or "",
            "state": address.state or "",
            "zip_code": address.resolved_zip,
        })

        if result.get("valid"):
            std = result.get("standardized", {})
            return ValidatedAddress(
                valid=True,
                street_address=std.get("streetAddress", ""),
                secondary_address=std.get("secondaryAddress", ""),
                address2=std.get("streetAddress", ""),
                address1=std.get("secondaryAddress", ""),
                city=std.get("city", ""),
                state=std.get("state", ""),
                zip_code=std.get("ZIPCode", ""),
                zip5=std.get("ZIPCode", ""),
                zip4=std.get("ZIPPlus4", ""),
                zip_plus4=std.get("ZIPPlus4", ""),
                delivery_point=result.get("deliveryPoint", ""),
                carrier_route=result.get("carrierRoute", ""),
                dpv_confirmation=result.get("DPVConfirmation", ""),
                dpv_message=result.get("dpvMessage", ""),
                dpv_message_es=result.get("dpvMessageEs", ""),
                full_address=result.get("fullAddress", ""),
                business=result.get("business", ""),
                vacant=result.get("vacant", ""),
            )
        else:
            return ValidatedAddress(
                valid=False,
                address2=address.resolved_street,
                city=address.city or "",
                state=address.state or "",
                zip5=address.resolved_zip,
                zip4="",
                dpv_message=result.get("dpvMessage", "Address not found"),
                dpv_message_es=result.get("dpvMessageEs", "Dirección no encontrada"),
                return_text=result.get("error", ""),
            )
    except Exception as e:
        logger.error(f"❌ Address validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post('/address/validate-batch', tags=['USPS'])
async def validate_addresses_batch(
    addresses: List[AddressRequest],
    service: USPSService = Depends(get_usps_service)
):
    """Validate multiple addresses in batch."""
    results = []
    for addr in addresses[:25]:  # Limit to 25
        try:
            result = await service.validate_address({
                "street_address": addr.resolved_street,
                "secondary_address": addr.resolved_secondary,
                "city": addr.city or "",
                "state": addr.state or "",
                "zip_code": addr.resolved_zip,
            })
            std = result.get("standardized", {})
            results.append({
                "input": {
                    "street": addr.resolved_street,
                    "city": addr.city,
                    "state": addr.state,
                    "zip": addr.resolved_zip,
                },
                "valid": result.get("valid", False),
                "standardized": {
                    "streetAddress": std.get("streetAddress", ""),
                    "city": std.get("city", ""),
                    "state": std.get("state", ""),
                    "zipCode": std.get("ZIPCode", ""),
                    "zipPlus4": std.get("ZIPPlus4", ""),
                },
                "fullAddress": result.get("fullAddress", ""),
                "dpvMessage": result.get("dpvMessage", ""),
            })
        except Exception as e:
            results.append({
                "input": {"street": addr.resolved_street},
                "valid": False,
                "error": str(e),
            })

    return {
        "total": len(results),
        "valid_count": sum(1 for r in results if r.get("valid")),
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════
# SIMPLE ADDRESS VALIDATION (for forms / autocomplete)
# ═══════════════════════════════════════════════════════════════

@api_router.post('/address/validate-simple', tags=['USPS'])
async def validate_address_simple(
    request: Request,
    service: USPSService = Depends(get_usps_service)
):
    """
    Simple address validation endpoint for form inputs.
    Accepts: { street, city, state, zip }
    Returns: standardized address or error
    """
    body = await request.json()
    street = body.get("street", body.get("street_address", body.get("address", "")))
    city = body.get("city", "")
    state = body.get("state", "")
    zip_code = body.get("zip", body.get("zip_code", body.get("zipCode", "")))

    result = await service.validate_address_simple(street, city, state, zip_code)

    return {
        "valid": result.get("valid", False),
        "standardized": result.get("standardized", {}),
        "fullAddress": result.get("fullAddress", ""),
        "dpvMessage": result.get("dpvMessage", ""),
        "dpvMessageEs": result.get("dpvMessageEs", ""),
    }


# ═══════════════════════════════════════════════════════════════
# ZIP CODE / CITY-STATE LOOKUP
# ═══════════════════════════════════════════════════════════════

@api_router.post('/zipcode/lookup', tags=['USPS'])
async def lookup_zipcode(
    request: ZipcodeLookupRequest,
    service: USPSService = Depends(get_usps_service)
):
    """Look up ZIP code from address."""
    result = await service.validate_address_simple(
        street=request.resolved_street,
        city=request.city or "",
        state=request.state or "",
    )
    if result.get("valid"):
        std = result.get("standardized", {})
        return ZipcodeLookupResult(
            zip5=std.get("ZIPCode", ""),
            zip4=std.get("ZIPPlus4", ""),
            zip_code=std.get("ZIPCode", ""),
            zip_plus4=std.get("ZIPPlus4", ""),
            street_address=std.get("streetAddress", ""),
            city=std.get("city", ""),
            state=std.get("state", ""),
        )
    raise HTTPException(status_code=404, detail="ZIP code not found for this address")


@api_router.get('/zipcode/citystate/{zip_code}', tags=['USPS'])
async def lookup_citystate(zip_code: str, service: USPSService = Depends(get_usps_service)):
    """Look up city and state by ZIP code."""
    result = await service.lookup_citystate(zip_code)
    if result.get("success"):
        return CityStateLookupResult(
            zip5=result.get("ZIPCode", zip_code),
            zip_code=result.get("ZIPCode", zip_code),
            city=result.get("city", ""),
            state=result.get("state", ""),
        )
    raise HTTPException(status_code=404, detail=f"City/state not found for ZIP: {zip_code}")


# ═══════════════════════════════════════════════════════════════
# TRACKING
# ═══════════════════════════════════════════════════════════════

@api_router.get('/tracking/{tracking_number}', tags=['USPS'])
async def track_package(tracking_number: str, service: USPSService = Depends(get_usps_service)):
    """Track a package by tracking number."""
    result = await service.track_package(tracking_number)

    if result.get("success"):
        events = [
            TrackingEvent(
                date=evt.get("date", ""),
                time=evt.get("time", ""),
                description=evt.get("description", ""),
                status=evt.get("description", ""),
                city=evt.get("city", ""),
                state=evt.get("state", ""),
                zip=evt.get("zip", ""),
                location=f"{evt.get('city', '')}, {evt.get('state', '')}".strip(", "),
            )
            for evt in result.get("events", [])
        ]
        return TrackingResponse(
            tracking_id=tracking_number,
            tracking_number=tracking_number,
            status=result.get("status", ""),
            events=events,
            expected_delivery_date=result.get("estimatedDelivery", ""),
            success=True,
        )

    return TrackingResponse(
        tracking_id=tracking_number,
        tracking_number=tracking_number,
        status="Error",
        events=[],
        success=False,
        error=result.get("error", "Tracking failed"),
    )


@api_router.post('/tracking/track', tags=['USPS'])
async def track_package_post(request: TrackingRequest, service: USPSService = Depends(get_usps_service)):
    """Track a package (POST version)."""
    return await track_package(request.tracking_id, service)


# ═══════════════════════════════════════════════════════════════
# SHIPMENTS (DB records)
# ═══════════════════════════════════════════════════════════════

@api_router.get('/shipments/all', tags=['USPS'])
async def get_all_shipments(
    limit: int = 50,
    skip: int = 0,
    service: USPSService = Depends(get_usps_service)
):
    """Get all shipment records (admin)."""
    if service.db is None:
        return {"shipments": [], "total": 0}

    total = await service.db.usps_shipments.count_documents({})
    cursor = service.db.usps_shipments.find({}).sort("created_at", -1).skip(skip).limit(limit)
    shipments = []
    async for s in cursor:
        s["_id"] = str(s["_id"])
        shipments.append(s)

    return {"shipments": shipments, "total": total}


@api_router.post('/shipments/create', tags=['USPS'])
async def create_shipment(request: Request, service: USPSService = Depends(get_usps_service)):
    """Create a shipment record."""
    if service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    body = await request.json()
    body["created_at"] = datetime.now(timezone.utc)
    body["current_status"] = body.get("current_status", "created")
    result = await service.db.usps_shipments.insert_one(body)
    return {"success": True, "id": str(result.inserted_id)}


@api_router.get('/stats', tags=['USPS'])
async def get_usps_stats(service: USPSService = Depends(get_usps_service)):
    """Get USPS usage statistics."""
    if service.db is None:
        return {
            "total_validations": 0,
            "total_shipments": 0,
            "recent_validations": [],
        }

    total_validations = await service.db.usps_address_validations.count_documents({})
    total_shipments = await service.db.usps_shipments.count_documents({})
    valid_count = await service.db.usps_address_validations.count_documents({"valid": True})
    invalid_count = await service.db.usps_address_validations.count_documents({"valid": False})

    # Recent validations
    cursor = service.db.usps_address_validations.find({}).sort("validated_at", -1).limit(10)
    recent = []
    async for v in cursor:
        v["_id"] = str(v["_id"])
        recent.append(v)

    return {
        "total_validations": total_validations,
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "validation_rate": round((valid_count / total_validations * 100) if total_validations > 0 else 0, 1),
        "total_shipments": total_shipments,
        "recent_validations": recent,
    }


@api_router.get('/test-connection', tags=['USPS'])
async def test_usps_connection(service: USPSService = Depends(get_usps_service)):
    """Test the USPS API connection by validating a known address."""
    try:
        result = await service.validate_address_simple(
            "305 Bruce Ave", "Dumas", "TX", "79029"
        )
        return {
            "connected": result.get("valid", False),
            "message": "USPS API connection successful" if result.get("valid") else "Connection issue",
            "test_address": result.get("fullAddress", ""),
            "api_version": "OAuth2 v3",
        }
    except Exception as e:
        return {
            "connected": False,
            "message": f"Connection failed: {str(e)}",
            "api_version": "OAuth2 v3",
        }


# ═══════════════════════════════════════════════════════════════
# ADDRESS BOOK — Saved Recipients & Government Offices
# ═══════════════════════════════════════════════════════════════

GOVERNMENT_PRESETS = [
    # USCIS Texas Service Center
    {"name": "USCIS Texas Service Center", "category": "USCIS", "street": "6046 N Belt Line Rd", "city": "Irving", "state": "TX", "zip": "75038", "notes": "General filings"},
    {"name": "USCIS TSC — I-129 Petitions", "category": "USCIS", "street": "6046 N Belt Line Rd, STE 129", "city": "Irving", "state": "TX", "zip": "75038", "notes": "I-129 petitions"},
    {"name": "USCIS TSC — Premium Processing", "category": "USCIS", "street": "6046 N Belt Line Rd, STE 907", "city": "Irving", "state": "TX", "zip": "75038", "notes": "I-129/I-140 Premium"},
    {"name": "USCIS TSC — I-140 Premium", "category": "USCIS", "street": "6046 N Belt Line Rd, STE 140", "city": "Irving", "state": "TX", "zip": "75038", "notes": "I-140 Premium Processing"},
    {"name": "USCIS TSC — RFE/ITD/ITR", "category": "USCIS", "street": "6046 N Belt Line Rd, STE 172", "city": "Irving", "state": "TX", "zip": "75038", "notes": "Responses to RFE"},
    # USCIS Lockbox
    {"name": "USCIS Dallas Lockbox", "category": "USCIS", "street": "P.O. Box 660867", "city": "Dallas", "state": "TX", "zip": "75266", "notes": "USCIS Lockbox facility"},
    {"name": "USCIS Mesquite Lockbox", "category": "USCIS", "street": "P.O. Box 851488", "city": "Mesquite", "state": "TX", "zip": "75185", "notes": "Premium processing lockbox"},
    # USCIS Field Offices
    {"name": "USCIS Field Office — Dallas", "category": "USCIS", "street": "8101 N Stemmons Fwy", "city": "Dallas", "state": "TX", "zip": "75247", "notes": "Interviews & InfoPass"},
    {"name": "USCIS Field Office — Houston", "category": "USCIS", "street": "126 Northpoint Dr", "city": "Houston", "state": "TX", "zip": "77060", "notes": "Interviews & InfoPass"},
    {"name": "USCIS Field Office — San Antonio", "category": "USCIS", "street": "20760 N US Highway 281", "city": "San Antonio", "state": "TX", "zip": "78258", "notes": "Covers 78 counties"},
    # Immigration Courts (EOIR)
    {"name": "Corte de Inmigración — Dallas", "category": "Immigration Court", "street": "1100 Commerce St, Suite 404", "city": "Dallas", "state": "TX", "zip": "75242", "notes": "EOIR Dallas"},
    {"name": "Corte de Inmigración — Houston (Jefferson)", "category": "Immigration Court", "street": "500 Jefferson St, Suite 300", "city": "Houston", "state": "TX", "zip": "77002", "notes": "EOIR Houston"},
    {"name": "Corte de Inmigración — Houston (Gessner)", "category": "Immigration Court", "street": "8701 S Gessner Rd, 10th Floor", "city": "Houston", "state": "TX", "zip": "77074", "notes": "EOIR Houston South"},
    {"name": "Corte de Inmigración — San Antonio", "category": "Immigration Court", "street": "800 Dolorosa, Suite 300", "city": "San Antonio", "state": "TX", "zip": "78207", "notes": "EOIR San Antonio"},
    {"name": "Corte de Inmigración — El Paso", "category": "Immigration Court", "street": "700 E San Antonio Ave, Suite 750", "city": "El Paso", "state": "TX", "zip": "79901", "notes": "EOIR El Paso"},
    {"name": "Corte de Inmigración — Laredo", "category": "Immigration Court", "street": "1406 Jacaman Rd, Suite B", "city": "Laredo", "state": "TX", "zip": "78041", "notes": "EOIR Laredo"},
    # ICE ERO Field Offices
    {"name": "ICE ERO — Dallas", "category": "ICE", "street": "1100 Commerce St, Suite 1060", "city": "Dallas", "state": "TX", "zip": "75242", "notes": "ICE Enforcement & Removal"},
    {"name": "ICE ERO — Houston", "category": "ICE", "street": "5520 Greens Rd", "city": "Houston", "state": "TX", "zip": "77032", "notes": "ICE Enforcement & Removal"},
    {"name": "ICE ERO — El Paso", "category": "ICE", "street": "6451 Boeing Dr", "city": "El Paso", "state": "TX", "zip": "79925", "notes": "ICE Enforcement & Removal"},
    {"name": "ICE ERO — San Antonio", "category": "ICE", "street": "3523 Crosspoint Dr", "city": "San Antonio", "state": "TX", "zip": "78217", "notes": "ICE Enforcement & Removal"},
    # IRS
    {"name": "IRS Austin Submission Center", "category": "IRS", "street": "3651 S Interregional Hwy 35", "city": "Austin", "state": "TX", "zip": "73301", "notes": "Tax return processing"},
    {"name": "IRS Ogden Service Center", "category": "IRS", "street": "1160 W 1200 S", "city": "Ogden", "state": "UT", "zip": "84201", "notes": "Tax return processing"},
    {"name": "IRS Kansas City", "category": "IRS", "street": "333 W Pershing Rd", "city": "Kansas City", "state": "MO", "zip": "64108", "notes": "Tax return processing"},
]


@api_router.get('/address-book', tags=['USPS Address Book'])
async def get_address_book(
    category: str = None,
    service: USPSService = Depends(get_usps_service)
):
    """Get all saved addresses from address book."""
    if service.db is None:
        return {"addresses": [], "presets": GOVERNMENT_PRESETS}

    query = {}
    if category:
        query["category"] = category

    cursor = service.db.usps_address_book.find(query).sort("name", 1)
    addresses = []
    async for a in cursor:
        a["_id"] = str(a["_id"])
        addresses.append(a)

    return {"addresses": addresses, "presets": GOVERNMENT_PRESETS}


@api_router.post('/address-book', tags=['USPS Address Book'])
async def save_address(request: Request, service: USPSService = Depends(get_usps_service)):
    """Save an address to the address book."""
    if service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    body = await request.json()
    body["created_at"] = datetime.now(timezone.utc)
    body["category"] = body.get("category", "Custom")

    result = await service.db.usps_address_book.insert_one(body)
    return {"success": True, "id": str(result.inserted_id)}


@api_router.put('/address-book/{address_id}', tags=['USPS Address Book'])
async def update_address(address_id: str, request: Request, service: USPSService = Depends(get_usps_service)):
    """Update an address in the address book."""
    if service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    from bson import ObjectId
    body = await request.json()
    body.pop("_id", None)
    body["updated_at"] = datetime.now(timezone.utc)
    await service.db.usps_address_book.update_one({"_id": ObjectId(address_id)}, {"$set": body})
    return {"success": True}


@api_router.delete('/address-book/{address_id}', tags=['USPS Address Book'])
async def delete_address(address_id: str, service: USPSService = Depends(get_usps_service)):
    """Delete an address from the address book."""
    if service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    from bson import ObjectId
    await service.db.usps_address_book.delete_one({"_id": ObjectId(address_id)})
    return {"success": True}


@api_router.get('/clients-for-sender', tags=['USPS Address Book'])
async def get_clients_for_sender(
    search: str = "",
    service: USPSService = Depends(get_usps_service)
):
    """Get clients list for sender selection."""
    if service.db is None:
        return {"clients": []}

    query = {"role": {"$ne": "admin"}}
    if search:
        query["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]

    cursor = service.db.users.find(query, {
        "full_name": 1, "name": 1, "first_name": 1, "last_name": 1,
        "email": 1, "phone": 1, "address": 1
    }).sort("name", 1).limit(50)

    clients = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        # Normalize name
        c["display_name"] = c.get("full_name") or c.get("name") or ""
        if not c["display_name"] and (c.get("first_name") or c.get("last_name")):
            c["display_name"] = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip()
        # Normalize address into consistent format
        addr = c.get("address", {})
        if isinstance(addr, dict):
            c["normalized_address"] = {
                "street": addr.get("street") or addr.get("address_line1") or "",
                "apt": addr.get("apt") or addr.get("address_line2") or "",
                "city": addr.get("city") or "",
                "state": addr.get("state") or "",
                "zip": addr.get("zip") or addr.get("zip_code") or "",
                "full": addr.get("full") or "",
            }
            if not c["normalized_address"]["full"]:
                parts = [c["normalized_address"]["street"]]
                if c["normalized_address"]["apt"]:
                    parts.append(c["normalized_address"]["apt"])
                parts.append(c["normalized_address"]["city"])
                parts.append(f"{c['normalized_address']['state']} {c['normalized_address']['zip']}")
                c["normalized_address"]["full"] = ", ".join(p for p in parts if p)
        else:
            c["normalized_address"] = {"street": "", "apt": "", "city": "", "state": "", "zip": "", "full": str(addr) if addr else ""}
        clients.append(c)

    return {"clients": clients}
