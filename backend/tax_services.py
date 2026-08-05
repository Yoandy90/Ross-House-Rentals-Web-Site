"""
Tax Services Module - Four key features:
1. Auto-Populate from Transcripts (parse W-2/1099 data)
2. Refund Status Tracker (timeline + manual updates)
3. 1099 Service Pricing & Billing
4. Client 1099 Dashboard API
"""

import os
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from zoneinfo import ZoneInfo
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
MIAMI_TZ = ZoneInfo("America/New_York")


# ═══════════════════════════════════════════════════════════════
# Feature 1: Transcript Auto-Populate / Parser
# ═══════════════════════════════════════════════════════════════

class TranscriptParser:
    """Parse IRS transcript data to extract W-2, 1099, and other tax information"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def parse_wage_income_transcript(self, client_id: str, transcript_text: str, tax_year: str = "") -> Dict:
        """
        Parse a Wage & Income transcript and extract all W-2s, 1099s, etc.
        The transcript text can be from PDF extraction or manual paste.
        """
        if not tax_year:
            tax_year = str(datetime.now(MIAMI_TZ).year - 1)
        
        # Resolve client email from client_id
        client_email = ""
        if client_id:
            user = await self.db.users.find_one(
                {"_id": ObjectId(client_id)} if ObjectId.is_valid(client_id) else {"email": client_id}
            )
            if user:
                client_email = user.get("email", "")
        
        parsed_data = {
            "client_id": client_id,
            "client_email": client_email,
            "tax_year": tax_year,
            "w2s": [],
            "1099_nec": [],
            "1099_misc": [],
            "1099_int": [],
            "1099_div": [],
            "1099_r": [],
            "1099_g": [],
            "1099_ssa": [],
            "1098": [],
            "other_forms": [],
            "total_wages": 0,
            "total_federal_withheld": 0,
            "total_state_withheld": 0,
            "total_1099_income": 0,
            "parsed_at": datetime.now(MIAMI_TZ),
            "raw_text_length": len(transcript_text)
        }
        
        lines = transcript_text.split('\n')
        current_form = None
        current_employer = {}
        
        def _save_current():
            """Save current employer/payer to the appropriate category"""
            nonlocal current_employer
            if current_employer and (current_employer.get('employer_name') or current_employer.get('payer_name')):
                if current_employer.get('form_type') == 'W-2':
                    parsed_data["w2s"].append(current_employer)
                else:
                    self._add_to_category(parsed_data, current_employer)
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            line_upper = line.upper()
            
            # ── Form Header Detection (only match clear form headers) ──
            # These must be "header-like" lines, not amount/detail lines
            is_new_form = False
            
            # W-2: "W-2 WAGE AND TAX STATEMENT" or "FORM W-2"
            if ('W-2' in line_upper) and ('STATEMENT' in line_upper or 'FORM W-2' in line_upper or ('WAGE' in line_upper and 'TAX' in line_upper)):
                _save_current()
                current_form = 'W-2'
                current_employer = {"form_type": "W-2"}
                is_new_form = True
            
            # 1099-NEC: "1099-NEC" in header context
            elif '1099-NEC' in line_upper or ('NONEMPLOYEE' in line_upper and 'COMPENSATION' in line_upper and 'BOX' not in line_upper):
                _save_current()
                current_form = '1099-NEC'
                current_employer = {"form_type": "1099-NEC"}
                is_new_form = True
            
            # 1099-MISC
            elif '1099-MISC' in line_upper:
                _save_current()
                current_form = '1099-MISC'
                current_employer = {"form_type": "1099-MISC"}
                is_new_form = True
            
            # 1099-INT: Only match the form code explicitly, NOT generic "INTEREST" amounts
            elif '1099-INT' in line_upper:
                _save_current()
                current_form = '1099-INT'
                current_employer = {"form_type": "1099-INT"}
                is_new_form = True
            
            # 1099-DIV: Only match the form code explicitly, NOT generic "DIVIDEND" amounts
            elif '1099-DIV' in line_upper:
                _save_current()
                current_form = '1099-DIV'
                current_employer = {"form_type": "1099-DIV"}
                is_new_form = True
            
            # 1099-R: Only match the form code explicitly
            elif '1099-R' in line_upper and ('DISTRIBUTION' in line_upper or 'RETIREMENT' in line_upper or 'STATEMENT' in line_upper or line_upper.startswith('1099-R')):
                _save_current()
                current_form = '1099-R'
                current_employer = {"form_type": "1099-R"}
                is_new_form = True
            
            # 1099-G
            elif '1099-G' in line_upper:
                _save_current()
                current_form = '1099-G'
                current_employer = {"form_type": "1099-G"}
                is_new_form = True
            
            # SSA-1099: Must have "SSA-1099" or "SSA 1099" — NOT just "SOCIAL SECURITY"
            elif 'SSA-1099' in line_upper or 'SSA 1099' in line_upper or ('SOCIAL SECURITY' in line_upper and ('BENEFIT' in line_upper or 'ADMINISTRATION' in line_upper)):
                _save_current()
                current_form = '1099-SSA'
                current_employer = {"form_type": "SSA-1099"}
                is_new_form = True
            
            # 1098: Must have "1098" with "MORTGAGE" 
            elif '1098' in line and 'MORTGAGE' in line_upper:
                _save_current()
                current_form = '1098'
                current_employer = {"form_type": "1098"}
                is_new_form = True
            
            # ── Parse detail fields within current form ──
            if current_form and not is_new_form:
                # Parse employer/payer name
                name_match = re.search(r'(?:EMPLOYER|PAYER|FROM)[:\s]+(.+)', line, re.IGNORECASE)
                if name_match:
                    name = name_match.group(1).strip()
                    if current_form == 'W-2':
                        current_employer['employer_name'] = name
                    else:
                        current_employer['payer_name'] = name
                
                # Parse EIN
                ein_match = re.search(r'EIN[:\s]*(\d{2}-?\d{7})', line, re.IGNORECASE)
                if ein_match:
                    current_employer['ein'] = ein_match.group(1)
                
                # Parse dollar amounts
                amount_patterns = [
                    (r'WAGES.*?[\$]?([\d,]+\.?\d*)', 'wages'),
                    (r'FEDERAL.*?TAX.*?WITHHELD.*?[\$]?([\d,]+\.?\d*)', 'federal_withheld'),
                    (r'STATE.*?TAX.*?WITHHELD.*?[\$]?([\d,]+\.?\d*)', 'state_withheld'),
                    (r'SOCIAL SECURITY.*?WAGES.*?[\$]?([\d,]+\.?\d*)', 'ss_wages'),
                    (r'MEDICARE.*?WAGES.*?[\$]?([\d,]+\.?\d*)', 'medicare_wages'),
                    (r'COMPENSATION.*?[\$]?([\d,]+\.?\d*)', 'compensation'),
                    (r'INTEREST.*?[\$]?([\d,]+\.?\d*)', 'interest'),
                    (r'DIVIDENDS?.*?[\$]?([\d,]+\.?\d*)', 'dividends'),
                    (r'GROSS.*?DISTRIBUTION.*?[\$]?([\d,]+\.?\d*)', 'gross_distribution'),
                    (r'BOX\s*1.*?[\$]?([\d,]+\.?\d*)', 'box1'),
                    (r'BOX\s*2.*?[\$]?([\d,]+\.?\d*)', 'box2'),
                ]
                
                for pattern, field in amount_patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        try:
                            amount = float(match.group(1).replace(',', ''))
                            current_employer[field] = amount
                        except ValueError:
                            pass
        
        # Add last form
        if current_employer and (current_employer.get('employer_name') or current_employer.get('payer_name')):
            self._add_to_category(parsed_data, current_employer)
        
        # Calculate totals
        for w2 in parsed_data["w2s"]:
            # Use box1 if present, otherwise wages — don't double count
            wage_amount = w2.get("box1", 0) or w2.get("wages", 0)
            fed_withheld = w2.get("box2", 0) or w2.get("federal_withheld", 0)
            parsed_data["total_wages"] += wage_amount
            parsed_data["total_federal_withheld"] += fed_withheld
            parsed_data["total_state_withheld"] += w2.get("state_withheld", 0)
        
        for category in ["1099_nec", "1099_misc", "1099_int", "1099_div", "1099_r"]:
            for form in parsed_data[category]:
                parsed_data["total_1099_income"] += form.get("compensation", 0) + form.get("interest", 0) + form.get("dividends", 0) + form.get("box1", 0)
        
        # Save to DB
        result = await self.db.parsed_transcripts.insert_one(parsed_data)
        parsed_data["_id"] = str(result.inserted_id)
        
        # Also update client record with income summary
        if client_id:
            await self.db.users.update_one(
                {"_id": ObjectId(client_id)} if ObjectId.is_valid(client_id) else {"email": client_id},
                {"$set": {
                    f"tax_data.{tax_year}": {
                        "total_wages": parsed_data["total_wages"],
                        "total_federal_withheld": parsed_data["total_federal_withheld"],
                        "total_1099_income": parsed_data["total_1099_income"],
                        "w2_count": len(parsed_data["w2s"]),
                        "form_1099_count": sum(len(parsed_data[k]) for k in ["1099_nec", "1099_misc", "1099_int", "1099_div", "1099_r", "1099_g", "1099_ssa"]),
                        "parsed_at": parsed_data["parsed_at"]
                    }
                }}
            )
        
        logger.info(f"📊 Parsed transcript for {client_id}: {len(parsed_data['w2s'])} W-2s, "
                     f"${parsed_data['total_wages']:,.2f} wages, ${parsed_data['total_1099_income']:,.2f} 1099 income")
        
        return {
            "id": str(result.inserted_id),
            "tax_year": tax_year,
            "w2_count": len(parsed_data["w2s"]),
            "total_wages": parsed_data["total_wages"],
            "total_federal_withheld": parsed_data["total_federal_withheld"],
            "total_state_withheld": parsed_data["total_state_withheld"],
            "total_1099_income": parsed_data["total_1099_income"],
            "forms_found": {
                "W-2": len(parsed_data["w2s"]),
                "1099-NEC": len(parsed_data["1099_nec"]),
                "1099-MISC": len(parsed_data["1099_misc"]),
                "1099-INT": len(parsed_data["1099_int"]),
                "1099-DIV": len(parsed_data["1099_div"]),
                "1099-R": len(parsed_data["1099_r"]),
                "1099-G": len(parsed_data["1099_g"]),
                "SSA-1099": len(parsed_data["1099_ssa"]),
                "1098": len(parsed_data["1098"])
            },
            "w2s": parsed_data["w2s"],
            "all_1099s": parsed_data["1099_nec"] + parsed_data["1099_misc"] + parsed_data["1099_int"] + parsed_data["1099_div"] + parsed_data["1099_r"]
        }
    
    def _add_to_category(self, parsed_data: Dict, form: Dict):
        ft = form.get("form_type", "")
        cat_map = {
            "W-2": "w2s", "1099-NEC": "1099_nec", "1099-MISC": "1099_misc",
            "1099-INT": "1099_int", "1099-DIV": "1099_div", "1099-R": "1099_r",
            "1099-G": "1099_g", "SSA-1099": "1099_ssa", "1098": "1098"
        }
        cat = cat_map.get(ft, "other_forms")
        parsed_data[cat].append(form)
    
    async def get_parsed_data(self, client_id: str, tax_year: str = "") -> Optional[Dict]:
        """Get previously parsed transcript data for a client"""
        query = {"client_id": client_id}
        if tax_year:
            query["tax_year"] = tax_year
        
        result = await self.db.parsed_transcripts.find_one(query, sort=[("parsed_at", -1)])
        if result:
            result["_id"] = str(result["_id"])
            result["parsed_at"] = result["parsed_at"].isoformat() if result.get("parsed_at") else None
        return result


# ═══════════════════════════════════════════════════════════════
# Feature 2: Refund Status Tracker
# ═══════════════════════════════════════════════════════════════

REFUND_STAGES = [
    {"stage": "return_prepared", "label": "Declaración Preparada", "label_en": "Return Prepared", "icon": "📝"},
    {"stage": "return_filed", "label": "Declaración Enviada al IRS", "label_en": "Return Filed with IRS", "icon": "📤"},
    {"stage": "return_received", "label": "Declaración Recibida por IRS", "label_en": "Return Received by IRS", "icon": "✅"},
    {"stage": "return_processing", "label": "En Procesamiento", "label_en": "Being Processed", "icon": "⚙️"},
    {"stage": "refund_approved", "label": "Reembolso Aprobado", "label_en": "Refund Approved", "icon": "👍"},
    {"stage": "refund_sent", "label": "Reembolso Enviado", "label_en": "Refund Sent", "icon": "💰"},
    {"stage": "refund_received", "label": "Reembolso Recibido", "label_en": "Refund Received", "icon": "🎉"}
]


class RefundTracker:
    """Track refund status for clients with timeline and estimates"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def create_refund_tracker(
        self,
        client_id: str,
        client_name: str,
        client_email: str,
        tax_year: str,
        filing_type: str,  # "e-file" or "paper"
        filing_status: str,  # "single", "married_joint", etc.
        refund_amount: float,
        filed_date: str = "",
        refund_method: str = "direct_deposit"  # "direct_deposit" or "check"
    ) -> Dict:
        """Create a new refund status tracker for a client"""
        now = datetime.now(MIAMI_TZ)
        
        if filed_date:
            try:
                filed_dt = datetime.strptime(filed_date, "%Y-%m-%d").replace(tzinfo=MIAMI_TZ)
            except ValueError:
                filed_dt = now
        else:
            filed_dt = now
        
        # Estimate refund date based on filing type
        if filing_type == "e-file":
            if refund_method == "direct_deposit":
                estimated_days = 21
            else:
                estimated_days = 42  # 6 weeks for check
        else:
            # Paper filing
            if refund_method == "direct_deposit":
                estimated_days = 42
            else:
                estimated_days = 56  # 8 weeks
        
        estimated_refund_date = filed_dt + timedelta(days=estimated_days)
        
        tracker = {
            "client_id": client_id,
            "client_name": client_name,
            "client_email": client_email,
            "tax_year": tax_year,
            "filing_type": filing_type,
            "filing_status": filing_status,
            "refund_amount": refund_amount,
            "refund_method": refund_method,
            "filed_date": filed_dt,
            "estimated_refund_date": estimated_refund_date,
            "estimated_days": estimated_days,
            "current_stage": "return_filed",
            "stage_history": [
                {"stage": "return_prepared", "date": now, "note": "Tax return prepared by Ross Tax Preparation"},
                {"stage": "return_filed", "date": filed_dt, "note": f"Filed via {filing_type}"}
            ],
            "irs_check_url": "https://sa.www4.irs.gov/wmr/",
            "notes": [],
            "is_amended": False,
            "status": "active",
            "created_at": now,
            "updated_at": now
        }
        
        result = await self.db.refund_trackers.insert_one(tracker)
        tracker_id = str(result.inserted_id)
        
        logger.info(f"📋 Refund tracker created for {client_name} - ${refund_amount:,.2f} (est. {estimated_refund_date.strftime('%m/%d/%Y')})")
        
        return {
            "tracker_id": tracker_id,
            "client_name": client_name,
            "tax_year": tax_year,
            "refund_amount": refund_amount,
            "current_stage": "return_filed",
            "estimated_refund_date": estimated_refund_date.strftime("%m/%d/%Y"),
            "estimated_days": estimated_days,
            "irs_check_url": "https://sa.www4.irs.gov/wmr/"
        }
    
    async def update_stage(self, tracker_id: str, new_stage: str, note: str = "") -> Dict:
        """Update the refund stage"""
        valid_stages = [s["stage"] for s in REFUND_STAGES]
        if new_stage not in valid_stages:
            raise ValueError(f"Invalid stage. Valid stages: {valid_stages}")
        
        tracker = await self.db.refund_trackers.find_one({"_id": ObjectId(tracker_id)})
        if not tracker:
            raise ValueError("Tracker not found")
        
        now = datetime.now(MIAMI_TZ)
        
        update = {
            "$set": {
                "current_stage": new_stage,
                "updated_at": now
            },
            "$push": {
                "stage_history": {
                    "stage": new_stage,
                    "date": now,
                    "note": note or f"Status updated to {new_stage}"
                }
            }
        }
        
        if new_stage == "refund_received":
            update["$set"]["status"] = "completed"
            update["$set"]["completed_at"] = now
        
        await self.db.refund_trackers.update_one({"_id": ObjectId(tracker_id)}, update)
        
        logger.info(f"📋 Refund tracker {tracker_id} updated to: {new_stage}")
        return {"tracker_id": tracker_id, "new_stage": new_stage, "updated_at": now.isoformat()}
    
    async def get_client_trackers(self, client_id: str = "", client_email: str = "") -> List[Dict]:
        """Get all refund trackers for a client"""
        query = {}
        if client_id:
            query["client_id"] = client_id
        elif client_email:
            query["client_email"] = client_email
        
        trackers = await self.db.refund_trackers.find(query).sort("created_at", -1).to_list(20)
        
        results = []
        for t in trackers:
            now = datetime.now(MIAMI_TZ)
            filed_date = t.get("filed_date")
            est_date = t.get("estimated_refund_date")
            
            # Make dates timezone-aware if they're naive (from MongoDB)
            if filed_date and filed_date.tzinfo is None:
                filed_date = filed_date.replace(tzinfo=MIAMI_TZ)
            if est_date and est_date.tzinfo is None:
                est_date = est_date.replace(tzinfo=MIAMI_TZ)
            
            if not filed_date:
                filed_date = now
            if not est_date:
                est_date = now
            
            days_since_filed = (now - filed_date).days if filed_date else 0
            days_until_estimate = (est_date - now).days if est_date else 0
            
            # Calculate progress percentage
            total_days = t.get("estimated_days", 21)
            progress = min(100, int((days_since_filed / total_days) * 100)) if total_days > 0 else 0
            
            stage_idx = next((i for i, s in enumerate(REFUND_STAGES) if s["stage"] == t.get("current_stage")), 0)
            
            results.append({
                "id": str(t["_id"]),
                "tax_year": t.get("tax_year", ""),
                "refund_amount": t.get("refund_amount", 0),
                "current_stage": t.get("current_stage", ""),
                "current_stage_label": REFUND_STAGES[stage_idx]["label"],
                "current_stage_label_en": REFUND_STAGES[stage_idx]["label_en"],
                "current_stage_icon": REFUND_STAGES[stage_idx]["icon"],
                "stage_index": stage_idx,
                "total_stages": len(REFUND_STAGES),
                "progress_percent": progress,
                "filing_type": t.get("filing_type", ""),
                "refund_method": t.get("refund_method", ""),
                "filed_date": filed_date.strftime("%m/%d/%Y") if filed_date else "",
                "estimated_refund_date": est_date.strftime("%m/%d/%Y") if est_date else "",
                "days_since_filed": days_since_filed,
                "days_until_estimate": max(0, days_until_estimate),
                "status": t.get("status", "active"),
                "stages": [{
                    "stage": s["stage"],
                    "label": s["label"],
                    "label_en": s["label_en"],
                    "icon": s["icon"],
                    "completed": stage_idx >= i,
                    "date": next((
                        h["date"].strftime("%m/%d/%Y") if isinstance(h.get("date"), datetime) else str(h.get("date", ""))
                        for h in t.get("stage_history", []) if h["stage"] == s["stage"]
                    ), None)
                } for i, s in enumerate(REFUND_STAGES)],
                "irs_check_url": t.get("irs_check_url", "https://sa.www4.irs.gov/wmr/")
            })
        
        return results
    
    async def list_all_trackers(self, page: int = 1, limit: int = 20, status: str = "") -> Dict:
        """List all refund trackers (admin view)"""
        query = {}
        if status:
            query["status"] = status
        
        total = await self.db.refund_trackers.count_documents(query)
        trackers = await self.db.refund_trackers.find(query).sort("updated_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
        
        return {
            "trackers": [{
                "id": str(t["_id"]),
                "client_name": t.get("client_name", ""),
                "client_email": t.get("client_email", ""),
                "tax_year": t.get("tax_year", ""),
                "refund_amount": t.get("refund_amount", 0),
                "current_stage": t.get("current_stage", ""),
                "filing_type": t.get("filing_type", ""),
                "status": t.get("status", "active"),
                "filed_date": t.get("filed_date", "").strftime("%m/%d/%Y") if t.get("filed_date") else "",
                "estimated_refund_date": t.get("estimated_refund_date", "").strftime("%m/%d/%Y") if t.get("estimated_refund_date") else "",
                "updated_at": t.get("updated_at", "").isoformat() if t.get("updated_at") else ""
            } for t in trackers],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    
    async def get_dashboard(self) -> Dict:
        """Get refund tracking dashboard stats"""
        total = await self.db.refund_trackers.count_documents({})
        active = await self.db.refund_trackers.count_documents({"status": "active"})
        completed = await self.db.refund_trackers.count_documents({"status": "completed"})
        
        # Total refund amounts
        pipeline = [
            {"$group": {
                "_id": "$status",
                "total_amount": {"$sum": "$refund_amount"},
                "count": {"$sum": 1}
            }}
        ]
        by_status = {}
        async for doc in self.db.refund_trackers.aggregate(pipeline):
            by_status[doc["_id"]] = {
                "count": doc["count"],
                "total_amount": doc["total_amount"]
            }
        
        # By stage
        pipeline2 = [
            {"$match": {"status": "active"}},
            {"$group": {
                "_id": "$current_stage",
                "count": {"$sum": 1}
            }}
        ]
        by_stage = {}
        async for doc in self.db.refund_trackers.aggregate(pipeline2):
            by_stage[doc["_id"]] = doc["count"]
        
        return {
            "total": total,
            "active": active,
            "completed": completed,
            "by_status": by_status,
            "by_stage": by_stage
        }


# ═══════════════════════════════════════════════════════════════
# Feature 3: 1099 Service Pricing & Billing
# ═══════════════════════════════════════════════════════════════

DEFAULT_PRICING = {
    "1099-NEC": {"price": 10.00, "description": "1099-NEC Filing per form"},
    "1099-MISC": {"price": 10.00, "description": "1099-MISC Filing per form"},
    "1099-INT": {"price": 8.00, "description": "1099-INT Filing per form"},
    "1099-DIV": {"price": 8.00, "description": "1099-DIV Filing per form"},
    "1099-R": {"price": 10.00, "description": "1099-R Filing per form"},
    "correction": {"price": 5.00, "description": "Form correction per form"},
    "copy_b_email": {"price": 2.00, "description": "Copy B email delivery per recipient"},
    "tin_matching": {"price": 1.00, "description": "TIN verification per TIN"},
    "transcript_request": {"price": 15.00, "description": "IRS transcript request per request"},
    "bulk_discount_10": {"discount": 0.10, "description": "10% discount for 10+ forms"},
    "bulk_discount_50": {"discount": 0.20, "description": "20% discount for 50+ forms"},
    "bulk_discount_100": {"discount": 0.30, "description": "30% discount for 100+ forms"},
}


class ServiceBilling:
    """1099 Service Pricing and Invoice Generation"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_pricing(self) -> Dict:
        """Get current pricing table"""
        # Check for custom pricing in DB
        custom = await self.db.iris_settings.find_one({"type": "pricing"})
        if custom:
            custom.pop("_id", None)
            custom.pop("type", None)
            return custom
        return DEFAULT_PRICING
    
    async def update_pricing(self, pricing: Dict) -> Dict:
        """Update pricing table"""
        pricing["type"] = "pricing"
        pricing["updated_at"] = datetime.now(MIAMI_TZ)
        await self.db.iris_settings.update_one(
            {"type": "pricing"},
            {"$set": pricing},
            upsert=True
        )
        return {"message": "Pricing updated", "pricing": pricing}
    
    async def create_service_invoice(
        self,
        client_id: str,
        client_name: str,
        client_email: str,
        items: List[Dict],
        notes: str = ""
    ) -> Dict:
        """
        Create an invoice for 1099 filing services.
        items: [{"service": "1099-NEC", "quantity": 5, "description": "optional"}]
        """
        pricing = await self.get_pricing()
        now = datetime.now(MIAMI_TZ)
        
        invoice_items = []
        subtotal = 0
        
        for item in items:
            service = item.get("service", "")
            quantity = item.get("quantity", 1)
            
            price_info = pricing.get(service, {})
            unit_price = item.get("unit_price", price_info.get("price", 0))
            
            line_total = unit_price * quantity
            subtotal += line_total
            
            invoice_items.append({
                "service": service,
                "description": item.get("description", price_info.get("description", service)),
                "quantity": quantity,
                "unit_price": unit_price,
                "total": line_total
            })
        
        # Apply bulk discount
        total_forms = sum(i["quantity"] for i in invoice_items if i["service"].startswith("1099"))
        discount = 0
        discount_label = ""
        
        if total_forms >= 100:
            discount = subtotal * pricing.get("bulk_discount_100", {}).get("discount", 0.30)
            discount_label = "30% bulk discount (100+ forms)"
        elif total_forms >= 50:
            discount = subtotal * pricing.get("bulk_discount_50", {}).get("discount", 0.20)
            discount_label = "20% bulk discount (50+ forms)"
        elif total_forms >= 10:
            discount = subtotal * pricing.get("bulk_discount_10", {}).get("discount", 0.10)
            discount_label = "10% bulk discount (10+ forms)"
        
        total = subtotal - discount
        
        # Generate invoice number
        count = await self.db.service_invoices.count_documents({})
        invoice_number = f"IRIS-{now.strftime('%Y%m')}-{count + 1:04d}"
        
        invoice = {
            "invoice_number": invoice_number,
            "client_id": client_id,
            "client_name": client_name,
            "client_email": client_email,
            "items": invoice_items,
            "subtotal": round(subtotal, 2),
            "discount": round(discount, 2),
            "discount_label": discount_label,
            "total": round(total, 2),
            "status": "pending",
            "notes": notes,
            "due_date": (now + timedelta(days=30)).strftime("%m/%d/%Y"),
            "created_at": now,
            "updated_at": now
        }
        
        result = await self.db.service_invoices.insert_one(invoice)
        
        logger.info(f"💰 Service invoice {invoice_number} created: ${total:,.2f} for {client_name}")
        
        return {
            "invoice_id": str(result.inserted_id),
            "invoice_number": invoice_number,
            "client_name": client_name,
            "items": invoice_items,
            "subtotal": invoice["subtotal"],
            "discount": invoice["discount"],
            "discount_label": discount_label,
            "total": invoice["total"],
            "due_date": invoice["due_date"],
            "status": "pending"
        }
    
    async def list_invoices(self, client_id: str = "", status: str = "", page: int = 1, limit: int = 20) -> Dict:
        """List service invoices"""
        query = {}
        if client_id:
            query["client_id"] = client_id
        if status:
            query["status"] = status
        
        total = await self.db.service_invoices.count_documents(query)
        invoices = await self.db.service_invoices.find(query).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
        
        return {
            "invoices": [{
                "id": str(inv["_id"]),
                "invoice_number": inv.get("invoice_number", ""),
                "client_name": inv.get("client_name", ""),
                "total": inv.get("total", 0),
                "status": inv.get("status", ""),
                "items_count": len(inv.get("items", [])),
                "due_date": inv.get("due_date", ""),
                "created_at": inv.get("created_at", "").isoformat() if inv.get("created_at") else ""
            } for inv in invoices],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
    
    async def update_invoice_status(self, invoice_id: str, status: str) -> Dict:
        """Update invoice status (pending, paid, cancelled)"""
        result = await self.db.service_invoices.update_one(
            {"_id": ObjectId(invoice_id)},
            {"$set": {"status": status, "updated_at": datetime.now(MIAMI_TZ)}}
        )
        return {"invoice_id": invoice_id, "status": status, "updated": result.modified_count > 0}
    
    async def get_billing_dashboard(self) -> Dict:
        """Get billing dashboard statistics"""
        pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total": {"$sum": "$total"}
            }}
        ]
        
        by_status = {}
        async for doc in self.db.service_invoices.aggregate(pipeline):
            by_status[doc["_id"]] = {"count": doc["count"], "total": round(doc["total"], 2)}
        
        return {
            "total_invoices": sum(s["count"] for s in by_status.values()),
            "total_revenue": sum(s["total"] for s in by_status.values()),
            "by_status": by_status,
            "pending_amount": by_status.get("pending", {}).get("total", 0),
            "paid_amount": by_status.get("paid", {}).get("total", 0)
        }


# ═══════════════════════════════════════════════════════════════
# Feature 4: Client 1099 Dashboard API
# ═══════════════════════════════════════════════════════════════

class ClientDashboardService:
    """API for client-facing 1099 dashboard in mobile app"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_client_dashboard(self, client_email: str) -> Dict:
        """Get complete dashboard data for a client"""
        now = datetime.now(MIAMI_TZ)
        
        # Find 1099 forms for this client
        forms = await self.db.iris_1099_forms.find({
            "$or": [
                {"payer_info.email": client_email},
                {"recipient_email": client_email}
            ]
        }).sort("created_at", -1).to_list(50)
        
        # Find refund trackers
        refund_tracker = RefundTracker(self.db)
        refund_data = await refund_tracker.get_client_trackers(client_email=client_email)
        
        # Find service invoices
        invoices = await self.db.service_invoices.find({
            "client_email": client_email
        }).sort("created_at", -1).to_list(10)
        
        # Find parsed transcripts (search by email or client_id)
        transcripts = await self.db.parsed_transcripts.find({
            "$or": [
                {"client_id": client_email},
                {"client_email": client_email}
            ]
        }).sort("parsed_at", -1).to_list(5)
        
        return {
            "forms": [{
                "id": str(f["_id"]),
                "form_type": f.get("form_type", ""),
                "tax_year": f.get("tax_year", ""),
                "status": f.get("status", ""),
                "total_amount": f.get("total_amount", 0),
                "payer_name": f.get("payer_info", {}).get("name", ""),
                "copy_b_available": f.get("status") in ["submitted", "accepted"],
                "copy_b_emailed": f.get("copy_b_emailed", False),
                "created_at": f.get("created_at", "").isoformat() if f.get("created_at") else ""
            } for f in forms],
            "forms_count": len(forms),
            "refund_trackers": refund_data,
            "invoices": [{
                "id": str(inv["_id"]),
                "invoice_number": inv.get("invoice_number", ""),
                "total": inv.get("total", 0),
                "status": inv.get("status", ""),
                "due_date": inv.get("due_date", "")
            } for inv in invoices],
            "tax_summary": [{
                "tax_year": t.get("tax_year", ""),
                "total_wages": t.get("total_wages", 0),
                "total_federal_withheld": t.get("total_federal_withheld", 0),
                "total_1099_income": t.get("total_1099_income", 0),
                "w2_count": len(t.get("w2s", [])),
                "parsed_at": t.get("parsed_at", "").isoformat() if isinstance(t.get("parsed_at"), datetime) else t.get("parsed_at")
            } for t in transcripts]
        }
    
    async def get_client_forms(self, client_email: str, tax_year: str = "") -> List[Dict]:
        """Get 1099 forms for a client"""
        query = {
            "$or": [
                {"payer_info.email": client_email},
                {"recipient_email": client_email}
            ]
        }
        if tax_year:
            query["tax_year"] = tax_year
        
        forms = await self.db.iris_1099_forms.find(query).sort("created_at", -1).to_list(100)
        
        return [{
            "id": str(f["_id"]),
            "form_type": f.get("form_type", ""),
            "tax_year": f.get("tax_year", ""),
            "status": f.get("status", ""),
            "total_amount": f.get("total_amount", 0),
            "amounts": f.get("amounts", {}),
            "payer_name": f.get("payer_info", {}).get("name", ""),
            "recipient_name": f.get("recipient_name", ""),
            "copy_b_available": f.get("status") in ["submitted", "accepted"],
            "submitted_at": f.get("submitted_at", "").isoformat() if f.get("submitted_at") else None,
            "created_at": f.get("created_at", "").isoformat() if f.get("created_at") else ""
        } for f in forms]
