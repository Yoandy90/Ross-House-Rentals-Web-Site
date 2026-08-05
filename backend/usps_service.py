"""
USPS Service Layer — OAuth2 API v3 (New Developer Portal)
==========================================================
Replaces the retired XML Web Tools API (retired Jan 25, 2026).
Uses OAuth2 Client Credentials flow for authentication.
Handles: Address Validation, ZIP Lookup, City/State Lookup, Tracking.
"""
import os
import logging
import time
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────
USPS_BASE_URL = "https://apis.usps.com"
USPS_TEST_URL = "https://apis-tem.usps.com"


class USPSService:
    """
    USPS API Service with OAuth2 token management.
    Compatible with the existing endpoint interface (usps_endpoints.py).
    
    Features:
    - Address Validation (CASS-certified)
    - ZIP Code Lookup
    - City/State Lookup
    - Package Tracking
    """

    def __init__(self, client_id: str = None, db=None):
        """Initialize USPS service with OAuth credentials."""
        self.client_id = client_id or os.getenv("USPS_CLIENT_ID") or os.getenv("USPS_CONSUMER_KEY", "")
        self.client_secret = os.getenv("USPS_CLIENT_SECRET") or os.getenv("USPS_CONSUMER_SECRET", "")
        self.crid = os.getenv("USPS_CRID", "")
        self.db = db

        # Token management
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0

        # Use production URL
        self.base_url = USPS_BASE_URL

        logger.info(f"✅ USPS Service initialized (OAuth2, CRID: {self.crid})")

    # ═══════════════════════════════════════════════════════════════
    # OAuth2 Token Management
    # ═══════════════════════════════════════════════════════════════

    async def _get_token(self) -> str:
        """Get or refresh OAuth2 access token."""
        if self._access_token and time.time() < (self._token_expires_at - 60):
            return self._access_token

        token_url = f"{USPS_BASE_URL}/oauth2/v3/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(token_url, json=payload, headers={"Content-Type": "application/json"})
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            self._token_expires_at = time.time() + data.get("expires_in", 3600)
            logger.info(f"🔑 USPS OAuth token obtained (expires in {data.get('expires_in', '?')}s)")
            return self._access_token

    async def _headers(self) -> Dict[str, str]:
        """Build authorization headers."""
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    # ═══════════════════════════════════════════════════════════════
    # Address Validation — Addresses API v3
    # ═══════════════════════════════════════════════════════════════

    async def validate_address(self, address_data) -> Dict[str, Any]:
        """
        Validate and standardize a US address.
        Accepts either a dict or an AddressRequest-like object.
        """
        # Handle both dict and object inputs
        if hasattr(address_data, 'street_address'):
            street = address_data.street_address
            secondary = getattr(address_data, 'secondary_address', '') or ''
            city = getattr(address_data, 'city', '') or ''
            state = getattr(address_data, 'state', '') or ''
            zip_code = getattr(address_data, 'zip_code', '') or ''
        elif isinstance(address_data, dict):
            street = address_data.get('street_address', address_data.get('streetAddress', ''))
            secondary = address_data.get('secondary_address', address_data.get('secondaryAddress', ''))
            city = address_data.get('city', '')
            state = address_data.get('state', '')
            zip_code = address_data.get('zip_code', address_data.get('ZIPCode', address_data.get('zip', '')))
        else:
            street = str(address_data)
            secondary = city = state = zip_code = ''

        headers = await self._headers()
        params = {"streetAddress": street}
        if secondary:
            params["secondaryAddress"] = secondary
        if city:
            params["city"] = city
        if state:
            params["state"] = state
        if zip_code:
            params["ZIPCode"] = zip_code

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}/addresses/v3/address",
                    params=params,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                address = data.get("address", {})

                # DPV Confirmation meanings
                dpv = address.get("DPVConfirmation", "")
                dpv_messages = {
                    "Y": ("Address confirmed — mail can be delivered", "Dirección confirmada — se puede entregar correo"),
                    "D": ("Primary confirmed, secondary not confirmed", "Principal confirmada, secundaria no"),
                    "S": ("Primary confirmed, secondary missing", "Principal confirmada, falta secundaria"),
                    "N": ("Address not confirmed — may not be deliverable", "Dirección no confirmada — puede no ser entregable"),
                }
                dpv_en, dpv_es = dpv_messages.get(dpv, ("No DPV data", "Sin datos DPV"))

                result = {
                    "valid": bool(address.get("streetAddress") and address.get("ZIPCode")),
                    "standardized": {
                        "streetAddress": address.get("streetAddress", ""),
                        "secondaryAddress": address.get("secondaryAddress", ""),
                        "city": address.get("city", ""),
                        "state": address.get("state", ""),
                        "ZIPCode": address.get("ZIPCode", ""),
                        "ZIPPlus4": address.get("ZIPPlus4", ""),
                    },
                    "deliveryPoint": address.get("deliveryPoint", ""),
                    "carrierRoute": address.get("carrierRoute", ""),
                    "DPVConfirmation": dpv,
                    "dpvMessage": dpv_en,
                    "dpvMessageEs": dpv_es,
                    "DPVCMRA": address.get("DPVCMRA", ""),
                    "business": address.get("business", ""),
                    "vacant": address.get("vacant", ""),
                    "fullAddress": self._format_full_address(address),
                    "raw": address,
                }

                # Save validation to DB if available
                if self.db is not None:
                    try:
                        await self.db.usps_address_validations.insert_one({
                            "input": {"street": street, "city": city, "state": state, "zip": zip_code},
                            "result": result["standardized"],
                            "valid": result["valid"],
                            "dpv": dpv,
                            "validated_at": datetime.now(timezone.utc),
                        })
                    except Exception:
                        pass

                logger.info(f"📍 Address validated: {result['fullAddress']} (DPV: {dpv})")
                return result

        except httpx.HTTPStatusError as e:
            logger.warning(f"⚠️ Address validation error: {e.response.status_code} — {e.response.text}")
            return {
                "valid": False,
                "error": f"USPS returned {e.response.status_code}",
                "details": e.response.text,
                "dpvMessage": "Address could not be validated",
                "dpvMessageEs": "La dirección no pudo ser validada",
            }
        except Exception as e:
            logger.error(f"❌ Address validation error: {e}")
            return {"valid": False, "error": str(e)}

    async def validate_address_simple(
        self, street: str, city: str = "", state: str = "", zip_code: str = ""
    ) -> Dict[str, Any]:
        """Simple address validation with string params."""
        return await self.validate_address({
            "street_address": street,
            "city": city,
            "state": state,
            "zip_code": zip_code,
        })

    # ═══════════════════════════════════════════════════════════════
    # ZIP Code / City-State Lookup
    # ═══════════════════════════════════════════════════════════════

    async def lookup_zipcode(self, zip_data) -> Dict[str, Any]:
        """Look up city and state by ZIP code."""
        if hasattr(zip_data, 'zip_code'):
            zip_code = zip_data.zip_code
        elif isinstance(zip_data, dict):
            zip_code = zip_data.get('zip_code', zip_data.get('ZIPCode', ''))
        else:
            zip_code = str(zip_data)

        headers = await self._headers()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}/addresses/v3/city-state",
                    params={"ZIPCode": zip_code},
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                return {
                    "success": True,
                    "city": data.get("city", ""),
                    "state": data.get("state", ""),
                    "ZIPCode": data.get("ZIPCode", zip_code),
                }
        except httpx.HTTPStatusError as e:
            return {"success": False, "error": f"ZIP lookup failed: {e.response.status_code}", "details": e.response.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def lookup_citystate(self, zip_code: str) -> Dict[str, Any]:
        """Alias for lookup_zipcode with string param."""
        return await self.lookup_zipcode(zip_code)

    # ═══════════════════════════════════════════════════════════════
    # Tracking — Tracking API v3
    # ═══════════════════════════════════════════════════════════════

    async def track_package(self, tracking_number: str) -> Dict[str, Any]:
        """Track a package by tracking number using USPS API v3."""
        headers = await self._headers()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}/tracking/v3/tracking/{tracking_number}",
                    params={"expand": "DETAIL"},
                    headers=headers,
                )
                
                # Handle USPS error responses (400, 403, 404, etc.)
                if resp.status_code != 200:
                    try:
                        err_data = resp.json()
                        err_msg = err_data.get("error", {}).get("message", "")
                        # Translate common USPS errors to Spanish
                        if resp.status_code == 403 or "not authorized" in err_msg.lower() or "access control" in err_msg.lower():
                            spanish_msg = (
                                "⚠️ USPS requiere autorización adicional para rastreo por API (nueva política desde Abril 2026). "
                                "Debe solicitar acceso al Tracking API contactando a USPS:\n"
                                "📧 https://emailus.usps.com/s/usps-APIs\n"
                                "📞 1-(877)-672-0007 opción #6 luego #2\n\n"
                                "Mientras tanto, puede rastrear directamente en USPS.com"
                            )
                        elif "not available" in err_msg.lower() or "invalid" in err_msg.lower():
                            spanish_msg = "El rastreo no está disponible para este número. Verifique que el número sea correcto y que USPS ya haya recibido el paquete."
                        elif "not found" in err_msg.lower():
                            spanish_msg = "Número de rastreo no encontrado en el sistema USPS."
                        else:
                            spanish_msg = f"Error USPS: {err_msg}" if err_msg else f"Error al rastrear (código {resp.status_code})"
                        return {
                            "success": False,
                            "trackingNumber": tracking_number,
                            "error": spanish_msg,
                            "usps_direct_url": f"https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}",
                            "requires_authorization": resp.status_code == 403,
                        }
                    except Exception:
                        return {"success": False, "trackingNumber": tracking_number, "error": f"Error al rastrear (código {resp.status_code})"}
                
                data = resp.json()

                # USPS v3 uses 'trackSummary' and 'trackDetail' (not 'trackingSummary' / 'trackingEvents')
                summary = data.get("trackSummary", {})
                details = data.get("trackDetail", [])
                
                # Build events from trackDetail array
                events = []
                for evt in details:
                    # Parse eventTimestamp if available, otherwise use separate fields
                    evt_date = ""
                    evt_time = ""
                    timestamp = evt.get("eventTimestamp", "")
                    if timestamp:
                        # Format: "2026-02-20T14:30:00Z" or similar
                        try:
                            from datetime import datetime as dt
                            ts = dt.fromisoformat(timestamp.replace("Z", "+00:00"))
                            evt_date = ts.strftime("%B %d, %Y")
                            evt_time = ts.strftime("%I:%M %p")
                        except Exception:
                            evt_date = evt.get("eventDate", timestamp)
                            evt_time = evt.get("eventTime", "")
                    else:
                        evt_date = evt.get("eventDate", "")
                        evt_time = evt.get("eventTime", "")
                    
                    events.append({
                        "date": evt_date,
                        "time": evt_time,
                        "description": evt.get("event", evt.get("eventDescription", "")),
                        "city": evt.get("eventCity", ""),
                        "state": evt.get("eventState", ""),
                        "zip": evt.get("eventZIPCode", ""),
                    })
                
                # Also add the summary event at the top
                if summary:
                    sum_date = ""
                    sum_time = ""
                    sum_ts = summary.get("eventTimestamp", "")
                    if sum_ts:
                        try:
                            from datetime import datetime as dt
                            ts = dt.fromisoformat(sum_ts.replace("Z", "+00:00"))
                            sum_date = ts.strftime("%B %d, %Y")
                            sum_time = ts.strftime("%I:%M %p")
                        except Exception:
                            sum_date = summary.get("eventDate", sum_ts)
                            sum_time = summary.get("eventTime", "")
                    else:
                        sum_date = summary.get("eventDate", "")
                        sum_time = summary.get("eventTime", "")
                    
                    summary_event = {
                        "date": sum_date,
                        "time": sum_time,
                        "description": summary.get("event", summary.get("eventDescription", "")),
                        "city": summary.get("eventCity", ""),
                        "state": summary.get("eventState", ""),
                        "zip": summary.get("eventZIPCode", ""),
                    }
                    events.insert(0, summary_event)

                return {
                    "success": True,
                    "trackingNumber": tracking_number,
                    "status": data.get("status", summary.get("event", "")),
                    "statusSummary": data.get("statusSummary", ""),
                    "statusCategory": data.get("statusCategory", ""),
                    "statusDate": summary.get("eventDate", ""),
                    "statusTime": summary.get("eventTime", ""),
                    "location": f"{summary.get('eventCity', '')}, {summary.get('eventState', '')} {summary.get('eventZIPCode', '')}".strip(", "),
                    "estimatedDelivery": data.get("expectedDeliveryDate", ""),
                    "mailClass": data.get("mailClass", ""),
                    "service": data.get("service", ""),
                    "events": events,
                }
        except httpx.HTTPStatusError as e:
            return {"success": False, "trackingNumber": tracking_number, "error": f"Error al rastrear: código {e.response.status_code}"}
        except Exception as e:
            return {"success": False, "trackingNumber": tracking_number, "error": f"Error de conexión: {str(e)}"}

    # ═══════════════════════════════════════════════════════════════
    # Helpers
    # ═══════════════════════════════════════════════════════════════

    def _format_full_address(self, addr: dict) -> str:
        """Format address into a single line."""
        parts = []
        if addr.get("streetAddress"):
            parts.append(addr["streetAddress"])
        if addr.get("secondaryAddress"):
            parts.append(addr["secondaryAddress"])
        city_state = []
        if addr.get("city"):
            city_state.append(addr["city"])
        if addr.get("state"):
            city_state.append(addr["state"])
        if city_state:
            parts.append(", ".join(city_state))
        zip_full = addr.get("ZIPCode", "")
        if addr.get("ZIPPlus4"):
            zip_full += f"-{addr['ZIPPlus4']}"
        if zip_full:
            parts.append(zip_full)
        return ", ".join(parts) if parts else ""
