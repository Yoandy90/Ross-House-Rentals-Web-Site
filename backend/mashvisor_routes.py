"""
Mashvisor API Integration Routes
Real estate market data, property analysis, and investment metrics via RapidAPI
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import httpx
import os

router = APIRouter(prefix="/admin/market-data", tags=["Market Data"])

MASHVISOR_BASE = "https://mashvisor-api.p.rapidapi.com"
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "21ea9bf87bmsh34cf3a650404000p1365f9jsn9af040d3e196")
RAPIDAPI_HOST = "mashvisor-api.p.rapidapi.com"

HEADERS = {
    "x-rapidapi-host": RAPIDAPI_HOST,
    "x-rapidapi-key": RAPIDAPI_KEY,
}


async def _mashvisor_get(path: str, params: dict = None) -> dict:
    """Helper to make GET requests to Mashvisor API via RapidAPI."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{MASHVISOR_BASE}{path}"
        resp = await client.get(url, headers=HEADERS, params=params)
        data = resp.json()
        if resp.status_code != 200 or data.get("status") == "error":
            raise HTTPException(
                status_code=resp.status_code or 500,
                detail=data.get("message", "Mashvisor API error"),
            )
        return data


@router.get("/city/{state}/{city}")
async def get_city_market_data(state: str, city: str):
    """Get city-level investment performance metrics."""
    data = await _mashvisor_get(f"/city/investment/{state.upper()}/{city}")
    return {
        "status": "success",
        "market_data": data.get("content", {}),
        "city": city,
        "state": state.upper(),
    }


@router.get("/neighborhoods/{state}/{city}")
async def get_top_neighborhoods(
    state: str, city: str, items: int = Query(default=10, le=20)
):
    """Get top neighborhoods with investment metrics."""
    data = await _mashvisor_get(
        f"/trends/neighborhoods",
        params={"city": city, "state": state.upper(), "items": items},
    )
    content = data.get("content", {})
    return {
        "status": "success",
        "neighborhoods": content.get("neighborhoods", []),
        "total": content.get("total_results", 0),
        "city": city,
        "state": state.upper(),
    }


@router.get("/listings/{state}/{city}")
async def get_city_listings(
    state: str,
    city: str,
    page: int = Query(default=1, ge=1),
    page_limit: int = Query(default=12, le=50),
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    beds: Optional[int] = None,
    baths: Optional[int] = None,
    property_type: Optional[str] = None,
    address: Optional[str] = None,
):
    """Get active property listings in a city, with optional address search."""
    params: dict = {
        "city": city,
        "state": state.upper(),
        "page": page,
        "page_limit": page_limit,
    }
    if min_price:
        params["min_price"] = min_price
    if max_price:
        params["max_price"] = max_price
    if beds:
        params["beds"] = beds
    if baths:
        params["baths"] = baths
    if property_type:
        params["property_type"] = property_type

    data = await _mashvisor_get("/city/listings", params=params)
    content = data.get("content", {})
    properties = content.get("properties", [])
    
    # Filter by address if provided (local filtering)
    if address:
        address_lower = address.lower().strip()
        properties = [
            p for p in properties 
            if address_lower in (p.get("address", "") or "").lower()
            or address_lower in (p.get("neighborhood", "") or "").lower()
            or address_lower in (p.get("zip_code", "") or "").lower()
        ]
    
    return {
        "status": "success",
        "listings": properties,
        "total": len(properties) if address else content.get("total_results", 0),
        "page": content.get("page", page),
        "total_pages": content.get("total_pages", 0),
        "address_filter": address,
    }


@router.get("/search-by-address")
async def search_property_by_address(
    address: str = Query(..., description="Street address to search"),
    city: str = Query(default="Dumas"),
    state: str = Query(default="TX"),
):
    """
    Search for a specific property by address.
    Returns property details and investment analysis if found.
    """
    try:
        # First try to get property analysis for exact address
        params: dict = {
            "address": address,
            "city": city,
            "state": state.upper(),
        }
        
        data = await _mashvisor_get("/property", params=params)
        content = data.get("content", {})
        
        if content:
            return {
                "status": "success",
                "found": True,
                "property": {
                    "id": content.get("id"),
                    "address": address,
                    "city": city,
                    "state": state.upper(),
                    "zip": content.get("zip"),
                    "beds": content.get("beds"),
                    "baths": content.get("baths"),
                    "sqft": content.get("sqft"),
                    "home_type": content.get("homeType"),
                    "year_built": content.get("yearBuilt"),
                    "list_price": content.get("listPrice") or content.get("lastSalePrice"),
                    "last_sale_price": content.get("lastSalePrice"),
                    "last_sale_date": content.get("lastSaleDate"),
                    "image": content.get("image", {}).get("image"),
                    "extra_images": content.get("extra_images", []),
                    "latitude": content.get("latitude"),
                    "longitude": content.get("longitude"),
                    "traditional_rental": content.get("ROI", {}).get("traditional_rental"),
                    "airbnb_rental": content.get("ROI", {}).get("airbnb_rental"),
                },
            }
        
        return {"status": "success", "found": False, "message": "Property not found"}
        
    except HTTPException:
        return {"status": "success", "found": False, "message": "Property not found"}


@router.get("/property-analysis")
async def analyze_property(
    address: str = Query(...),
    city: str = Query(...),
    state: str = Query(...),
    zip_code: Optional[str] = None,
):
    """Get detailed property analysis including valuation, ROI, and neighborhood data."""
    params: dict = {
        "address": address,
        "city": city,
        "state": state.upper(),
    }
    if zip_code:
        params["zip_code"] = zip_code

    data = await _mashvisor_get("/property", params=params)
    content = data.get("content", {})

    # Extract key investment metrics
    roi = content.get("ROI", {})
    neighborhood = content.get("neighborhood", {})

    return {
        "status": "success",
        "property": {
            "id": content.get("id"),
            "address": address,
            "city": city,
            "state": state.upper(),
            "zip": content.get("zip"),
            "beds": content.get("beds"),
            "baths": content.get("baths"),
            "sqft": content.get("sqft"),
            "home_type": content.get("homeType"),
            "year_built": content.get("yearBuilt"),
            "last_sale_price": content.get("lastSalePrice"),
            "last_sale_date": content.get("lastSaleDate"),
            "tax": content.get("tax"),
            "image": content.get("image", {}).get("image"),
            "extra_images": content.get("extra_images", []),
        },
        "investment": {
            "traditional_ROI": roi.get("traditional_ROI"),
            "airbnb_ROI": roi.get("airbnb_ROI"),
            "traditional_rental": roi.get("traditional_rental"),
            "airbnb_rental": roi.get("airbnb_rental"),
            "traditional_cap_rate": roi.get("traditional_cap_rate"),
            "airbnb_cap_rate": roi.get("airbnb_cap_rate"),
        },
        "neighborhood": {
            "name": neighborhood.get("name"),
            "median_value": neighborhood.get("singleHomeValue"),
            "median_value_formatted": neighborhood.get("singleHomeValue_formatted"),
            "mashMeter": neighborhood.get("mashMeter"),
            "walkscore": neighborhood.get("walkscore"),
            "airbnb_count": neighborhood.get("airbnb_properties_count"),
            "traditional_count": neighborhood.get("traditional_properties_count"),
        },
        "mortgage_rates": {
            "thirty_year_fixed": content.get("stateInterest", {}).get("thirtyYearFixed"),
            "fifteen_year_fixed": content.get("stateInterest", {}).get("fifteenYearFixed"),
            "five_one_arm": content.get("stateInterest", {}).get("fiveOneARM"),
        },
    }


@router.get("/top-properties/{state}/{city}")
async def get_top_properties(state: str, city: str):
    """Get top investment properties in a city."""
    data = await _mashvisor_get(f"/city/properties/{state.upper()}/{city}")
    content = data.get("content", {})
    properties = content.get("properties", [])

    # Format for frontend
    formatted = []
    for p in properties[:20]:
        formatted.append({
            "id": p.get("id"),
            "address": p.get("address"),
            "zip_code": p.get("zip_code"),
            "city": p.get("city"),
            "state": p.get("state"),
            "type": p.get("type"),
            "beds": p.get("beds"),
            "baths": p.get("baths"),
            "sqft": p.get("sqft"),
            "list_price": p.get("list_price"),
            "list_price_formatted": p.get("list_price_formatted"),
            "image": p.get("image") or p.get("image_url"),
            "traditional_ROI": p.get("traditional_ROI"),
            "airbnb_ROI": p.get("airbnb_ROI"),
            "traditional_rental": p.get("traditional_rental"),
            "airbnb_rental": p.get("airbnb_rental"),
            "traditional_cap": p.get("traditional_cap"),
            "airbnb_cap": p.get("airbnb_cap"),
            "days_on_market": p.get("days_on_market"),
            "neighborhood": p.get("neighborhood"),
        })

    return {
        "status": "success",
        "properties": formatted,
        "total": len(formatted),
    }
