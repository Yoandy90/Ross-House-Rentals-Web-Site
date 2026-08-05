"""
USPS Integration Models — Updated for OAuth2 API v3
Data models for the new USPS Developer Portal APIs
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


# ─── Address Models ──────────────────────────────────────────────

class AddressRequest(BaseModel):
    """Request model for address validation (supports both old and new field names)"""
    firm_name: Optional[str] = Field(None, description="Company name")
    # New API field names
    street_address: Optional[str] = Field(None, description="Street address (new API)")
    secondary_address: Optional[str] = Field(None, description="Apt/Suite (new API)")
    # Old field names for backward compatibility
    address1: Optional[str] = Field(None, description="Apartment or suite number (legacy)")
    address2: Optional[str] = Field(None, description="Street address (legacy)")
    city: Optional[str] = Field(None, description="City name")
    state: Optional[str] = Field(None, description="Two-letter state code")
    zip_code: Optional[str] = Field(None, description="ZIP code")
    zip5: Optional[str] = Field(None, description="5-digit ZIP code (legacy)")
    zip4: Optional[str] = Field(None, description="ZIP+4 code")

    @property
    def resolved_street(self) -> str:
        return self.street_address or self.address2 or ""

    @property
    def resolved_secondary(self) -> str:
        return self.secondary_address or self.address1 or ""

    @property
    def resolved_zip(self) -> str:
        return self.zip_code or self.zip5 or ""


class ValidatedAddress(BaseModel):
    """Response model for validated address"""
    valid: bool = True
    firm_name: Optional[str] = None
    street_address: Optional[str] = None
    secondary_address: Optional[str] = None
    # Legacy fields kept for backward compat
    address1: Optional[str] = None
    address2: Optional[str] = None
    city: str = ""
    state: str = ""
    zip_code: Optional[str] = None
    zip5: Optional[str] = None
    zip4: Optional[str] = None
    zip_plus4: Optional[str] = None
    delivery_point: Optional[str] = None
    carrier_route: Optional[str] = None
    dpv_confirmation: Optional[str] = None
    dpv_message: Optional[str] = None
    dpv_message_es: Optional[str] = None
    full_address: Optional[str] = None
    business: Optional[str] = None
    vacant: Optional[str] = None
    return_text: Optional[str] = None


# ─── ZIP / City-State Models ────────────────────────────────────

class ZipcodeLookupRequest(BaseModel):
    """Request model for ZIP code lookup from address"""
    street_address: Optional[str] = None
    address2: Optional[str] = None  # Legacy
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None

    @property
    def resolved_street(self) -> str:
        return self.street_address or self.address2 or ""


class ZipcodeLookupResult(BaseModel):
    """Result model for ZIP code lookup"""
    zip5: Optional[str] = None
    zip4: Optional[str] = None
    zip_code: Optional[str] = None
    zip_plus4: Optional[str] = None
    street_address: Optional[str] = None
    address2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class CityStateLookupRequest(BaseModel):
    """Request model for city/state lookup from ZIP code"""
    zip5: Optional[str] = None
    zip_code: Optional[str] = None

    @property
    def resolved_zip(self) -> str:
        return self.zip_code or self.zip5 or ""


class CityStateLookupResult(BaseModel):
    """Result model for city/state lookup"""
    zip5: Optional[str] = None
    zip_code: Optional[str] = None
    city: str = ""
    state: str = ""


# ─── Shipping / Package Models ──────────────────────────────────

class PackageSize(str, Enum):
    LETTER = "LETTER"
    FLAT = "FLAT"
    PARCEL = "PARCEL"
    LARGE_PARCEL = "LARGE PARCEL"


class ServiceType(str, Enum):
    PRIORITY = "PRIORITY_MAIL"
    EXPRESS = "PRIORITY_MAIL_EXPRESS"
    GROUND = "USPS_GROUND_ADVANTAGE"
    FIRST_CLASS = "FIRST_CLASS_MAIL"
    MEDIA_MAIL = "MEDIA_MAIL"


class ShippingLabelRequest(BaseModel):
    from_name: str
    from_address: AddressRequest
    to_name: str
    to_address: AddressRequest
    weight_ounces: float = Field(..., gt=0)
    package_size: PackageSize = PackageSize.PARCEL
    service_type: ServiceType = ServiceType.PRIORITY
    description: Optional[str] = "Tax Documents"
    reference_number: Optional[str] = None


class ShippingLabel(BaseModel):
    tracking_number: str
    label_image_url: Optional[str] = None
    label_pdf_data: Optional[str] = None
    postage_amount: Optional[float] = None
    delivery_date: Optional[str] = None
    created_at: datetime


# ─── Tracking Models ────────────────────────────────────────────

class TrackingEvent(BaseModel):
    timestamp: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    event_type: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    detail: Optional[str] = None


class TrackingStatus(str, Enum):
    IN_TRANSIT = "In Transit"
    OUT_FOR_DELIVERY = "Out for Delivery"
    DELIVERED = "Delivered"
    EXCEPTION = "Exception"
    ATTEMPTED = "Delivery Attempted"
    AVAILABLE_FOR_PICKUP = "Available for Pickup"
    UNKNOWN = "Unknown"


class TrackingRequest(BaseModel):
    tracking_id: str = Field(...)
    destination_zip: Optional[str] = None


class TrackingResponse(BaseModel):
    tracking_id: Optional[str] = None
    tracking_number: Optional[str] = None
    status: str = ""
    events: List[TrackingEvent] = []
    expected_delivery_date: Optional[str] = None
    delivery_status: Optional[str] = None
    last_updated: Optional[datetime] = None
    success: Optional[bool] = None
    error: Optional[str] = None


# ─── Database Models ────────────────────────────────────────────

class ShipmentDB(BaseModel):
    tracking_number: str
    user_id: str
    sent_by: str
    from_address: dict
    to_address: dict
    description: str
    service_type: str
    created_at: datetime
    delivered_at: Optional[datetime] = None
    current_status: str
