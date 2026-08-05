"""
Landing page leads capture endpoint.
Saves leads from the 404 page and other landing pages.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional
import os

router = APIRouter(prefix="/api/landing", tags=["landing"])

# ─── MongoDB Setup ───
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client[os.getenv("DB_NAME", "taxportal")]

class LeadCreate(BaseModel):
    name: str
    phone: str
    source: Optional[str] = "website"
    page_url: Optional[str] = ""
    language: Optional[str] = "es"

@router.post("/leads")
async def create_lead(lead: LeadCreate):
    """Save a lead from the landing page / 404 page."""
    doc = {
        "name": lead.name.strip(),
        "phone": lead.phone.strip(),
        "source": lead.source,
        "page_url": lead.page_url,
        "language": lead.language,
        "status": "new",
        "created_at": datetime.now(timezone.utc),
        "contacted": False,
    }
    result = await db.landing_leads.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id)}
