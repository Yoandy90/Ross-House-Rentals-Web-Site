"""
Tax Preparer API Endpoints
REST API for tax preparation, forms, and IRS integration
"""

import os
import logging
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, Query, UploadFile, File, Form, Body
from pydantic import BaseModel
from bson import ObjectId

from tax_preparer_models import (
    TaxpayerCreate, PayerCreate, Form1099NECCreate, Form1099MISCCreate,
    TINMatchRequest, DocumentUpload, ConsentCreate, SubmissionCreate,
    FormType, SubmissionStatus, DocumentType, ConsentType
)
from tax_preparer_service import (
    TaxPreparerService, init_tax_preparer_service, get_tax_preparer_service
)

logger = logging.getLogger(__name__)

# Router
tax_prep_router = APIRouter(prefix="/tax-preparer", tags=["Tax Preparer"])

# Service instance
tax_service: Optional[TaxPreparerService] = None


def set_tax_preparer_service(service: TaxPreparerService):
    """Set the tax preparer service instance"""
    global tax_service
    tax_service = service
    logger.info("✅ Tax Preparer endpoints initialized")


# Auth helper
async def _verify_admin(authorization: Optional[str]) -> str:
    """Verify admin authorization and return user ID"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No autorizado")
    
    # Simple token verification
    import jwt
    try:
        # Decode JWT without verification for getting user ID
        # In production, this would properly verify the token
        payload = jwt.decode(authorization, options={"verify_signature": False})
        user_id = payload.get('sub', 'admin')
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión inválida")


# ==================== PDF DATA ENRICHMENT ====================

async def _enrich_form_for_pdf(form: dict) -> dict:
    """
    Enrich a form record with decrypted SSN/EIN and full addresses
    for PDF generation.  Uses a 3-level fallback chain:
      1. Decrypt from einEncrypted / ssnEncrypted (Fernet)
      2. Look up the raw SSN from client_banking (by email match)
      3. Fall back to the masked value (XXX-XX-1234)
    """
    enriched = dict(form)
    db = tax_service.db

    # ---- PAYER (business) ----
    payer_id = form.get('payerId')
    if payer_id:
        payer = await db.tax_payers.find_one({"id": payer_id})
        if payer:
            enriched['payerName'] = payer.get('name', '')
            enriched['payerAddress'] = payer.get('address1', '')
            enriched['payerCity'] = payer.get('city', '')
            enriched['payerState'] = payer.get('state', '')
            enriched['payerZip'] = payer.get('zipCode', '')
            enriched['payerPhone'] = payer.get('phone', '')

            # Decrypt EIN — fallback to masked
            ein_resolved = ''
            ein_encrypted = payer.get('einEncrypted')
            if ein_encrypted:
                try:
                    ein_resolved = tax_service.decrypt_sensitive(ein_encrypted)
                except Exception:
                    logger.warning(f"⚠️ EIN decryption failed for payer {payer_id}")
            if not ein_resolved:
                ein_resolved = payer.get('einMasked', '')
            enriched['payerEIN'] = ein_resolved

    # ---- RECIPIENT (individual / taxpayer) ----
    recipient_id = form.get('recipientId')
    if recipient_id:
        recipient = await db.tax_taxpayers.find_one({"id": recipient_id})
        if recipient:
            enriched['recipientName'] = f"{recipient.get('firstName', '')} {recipient.get('lastName', '')}".strip()
            enriched['recipientAddress'] = recipient.get('address1', '')
            enriched['recipientCity'] = recipient.get('city', '')
            enriched['recipientState'] = recipient.get('state', '')
            enriched['recipientZip'] = recipient.get('zipCode', '')

            # Decrypt SSN — 3-level fallback
            ssn_resolved = ''
            ssn_encrypted = recipient.get('ssnEncrypted')
            if ssn_encrypted:
                try:
                    ssn_resolved = tax_service.decrypt_sensitive(ssn_encrypted)
                except Exception:
                    logger.warning(f"⚠️ SSN decryption failed for recipient {recipient_id}, trying client_banking fallback")

            # Fallback: look up raw SSN from client_banking by email
            if not ssn_resolved:
                recipient_email = (recipient.get('email') or '').strip().lower()
                if recipient_email:
                    banking = await db.client_banking.find_one({
                        "email": {"$regex": f"^{recipient_email}$", "$options": "i"}
                    })
                    if banking and banking.get('ssn'):
                        ssn_resolved = banking['ssn']
                        logger.info(f"✅ SSN recovered from client_banking for {recipient_email}")
                        # Re-encrypt with the correct key for future use
                        try:
                            new_encrypted = tax_service.encrypt_sensitive(ssn_resolved)
                            await db.tax_taxpayers.update_one(
                                {"id": recipient_id},
                                {"$set": {
                                    "ssnEncrypted": new_encrypted,
                                    "ssnMasked": tax_service.mask_ssn(ssn_resolved)
                                }}
                            )
                            logger.info(f"✅ SSN re-encrypted for recipient {recipient_id}")
                        except Exception as re_err:
                            logger.error(f"Failed to re-encrypt SSN: {re_err}")

            if not ssn_resolved:
                ssn_resolved = recipient.get('ssnMasked', '')
            enriched['recipientSSN'] = ssn_resolved

    # ---- FORM-TYPE SPECIFIC ALIASES ----
    form_type = form.get('formType', '')

    if form_type == 'W-2G':
        # W-2G uses winnerSSN / winnerName / winnerAddress instead of recipient*
        enriched.setdefault('winnerSSN', enriched.get('recipientSSN', ''))
        enriched.setdefault('winnerName', enriched.get('recipientName', ''))
        enriched.setdefault('winnerAddress', enriched.get('recipientAddress', ''))
        enriched.setdefault('winnerCity', enriched.get('recipientCity', ''))
        enriched.setdefault('winnerState', enriched.get('recipientState', ''))
        enriched.setdefault('winnerZip', enriched.get('recipientZip', ''))

    elif form_type == '1098':
        # 1098 uses borrowerSSN / borrowerName and lenderEIN / lenderName
        enriched.setdefault('borrowerSSN', enriched.get('recipientSSN', ''))
        enriched.setdefault('borrowerName', enriched.get('recipientName', ''))
        enriched.setdefault('borrowerAddress', enriched.get('recipientAddress', ''))
        enriched.setdefault('borrowerCity', enriched.get('recipientCity', ''))
        enriched.setdefault('borrowerState', enriched.get('recipientState', ''))
        enriched.setdefault('borrowerZip', enriched.get('recipientZip', ''))
        enriched.setdefault('lenderEIN', enriched.get('payerEIN', ''))
        enriched.setdefault('lenderName', enriched.get('payerName', ''))
        enriched.setdefault('lenderAddress', enriched.get('payerAddress', ''))
        enriched.setdefault('lenderCity', enriched.get('payerCity', ''))
        enriched.setdefault('lenderState', enriched.get('payerState', ''))
        enriched.setdefault('lenderZip', enriched.get('payerZip', ''))
        enriched.setdefault('lenderPhone', enriched.get('payerPhone', ''))

    return enriched


# ==================== DASHBOARD ====================

@tax_prep_router.get("/dashboard")
async def get_dashboard(authorization: Optional[str] = Header(None)):
    """Get dashboard statistics"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    stats = await tax_service.get_dashboard_stats()
    return {"success": True, **stats}


@tax_prep_router.get("/activities")
async def get_activities(
    limit: int = Query(50, le=200),
    authorization: Optional[str] = Header(None)
):
    """Get recent activities for audit log"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    activities = await tax_service.get_activities(limit)
    return {"success": True, "activities": activities}


# ==================== TAXPAYERS ====================

@tax_prep_router.post("/taxpayers")
async def create_taxpayer(
    data: TaxpayerCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a new taxpayer/client"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        taxpayer = await tax_service.create_taxpayer(data.dict(), user_id)
        return {"success": True, "taxpayer": taxpayer}
    except Exception as e:
        logger.error(f"Error creating taxpayer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/taxpayers")
async def get_taxpayers(
    search: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    skip: int = Query(0),
    authorization: Optional[str] = Header(None)
):
    """Get list of taxpayers"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    taxpayers = await tax_service.get_taxpayers(search, limit, skip)
    return {"success": True, "taxpayers": taxpayers, "count": len(taxpayers)}


@tax_prep_router.get("/taxpayers/{taxpayer_id}")
async def get_taxpayer(
    taxpayer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get taxpayer by ID"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    taxpayer = await tax_service.get_taxpayer(taxpayer_id)
    if not taxpayer:
        raise HTTPException(status_code=404, detail="Taxpayer not found")
    
    return {"success": True, "taxpayer": taxpayer}


@tax_prep_router.put("/taxpayers/{taxpayer_id}")
async def update_taxpayer(
    taxpayer_id: str,
    data: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Update taxpayer information"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        taxpayer = await tax_service.update_taxpayer(taxpayer_id, data, user_id)
        return {"success": True, "taxpayer": taxpayer}
    except Exception as e:
        logger.error(f"Error updating taxpayer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PAYERS ====================

@tax_prep_router.post("/payers")
async def create_payer(
    data: PayerCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a new payer (business)"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        payer = await tax_service.create_payer(data.dict(), user_id)
        return {"success": True, "payer": payer}
    except Exception as e:
        logger.error(f"Error creating payer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/payers")
async def get_payers(
    limit: int = Query(100, le=500),
    authorization: Optional[str] = Header(None)
):
    """Get list of payers"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    payers = await tax_service.get_payers(limit)
    return {"success": True, "payers": payers}


@tax_prep_router.get("/payers/{payer_id}/payroll")
async def get_payer_payroll(
    payer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all recipients (employees/contractors) for a specific payer with form counts"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    db = tax_service.db
    
    # Get payer info
    payer = await db.tax_payers.find_one({"id": payer_id})
    if not payer:
        raise HTTPException(status_code=404, detail="Payer not found")
    
    # Get all forms for this payer
    forms = await db.tax_forms.find({"payerId": payer_id}).to_list(length=10000)
    
    # Group forms by recipient
    recipients_map = {}
    for form in forms:
        rid = form.get('recipientId', '')
        if rid not in recipients_map:
            recipients_map[rid] = {
                'recipientId': rid,
                'recipientName': form.get('recipientName', ''),
                'recipientSSN': form.get('recipientSSN', ''),
                'forms': [],
                'totalAmount': 0,
            }
        form_summary = {
            'formId': form.get('id'),
            'formType': form.get('formType'),
            'taxYear': form.get('taxYear'),
            'amount': 0,
            'status': form.get('status', 'draft'),
            'createdAt': str(form.get('createdAt', '')),
        }
        # Sum key amount fields
        for amt_field in ['box1Amount', 'box2Amount', 'box3Amount', 'box4Amount',
                          'nonemployeeCompensation', 'rents', 'royalties',
                          'otherIncome', 'grossWinnings', 'mortgageInterest',
                          'interestIncome']:
            val = form.get(amt_field)
            if val:
                try:
                    form_summary['amount'] += float(val)
                except (ValueError, TypeError):
                    pass
        recipients_map[rid]['forms'].append(form_summary)
        recipients_map[rid]['totalAmount'] += form_summary['amount']
    
    # Enrich with taxpayer details
    for rid, rdata in recipients_map.items():
        if rid:
            taxpayer = await db.tax_taxpayers.find_one({"id": rid})
            if taxpayer:
                rdata['recipientName'] = f"{taxpayer.get('firstName', '')} {taxpayer.get('lastName', '')}".strip()
                rdata['email'] = taxpayer.get('email', '')
                rdata['phone'] = taxpayer.get('phone', '')
                rdata['address'] = f"{taxpayer.get('address1', '')}, {taxpayer.get('city', '')} {taxpayer.get('state', '')} {taxpayer.get('zipCode', '')}".strip(', ')
    
    recipients_list = sorted(recipients_map.values(), key=lambda x: x.get('recipientName', ''))
    
    return {
        "success": True,
        "payer": tax_service._format_payer(payer),
        "payroll": {
            "totalRecipients": len(recipients_list),
            "totalForms": len(forms),
            "totalAmount": sum(r['totalAmount'] for r in recipients_list),
            "recipients": recipients_list
        }
    }


@tax_prep_router.get("/payroll-summary")
async def get_payroll_summary(
    authorization: Optional[str] = Header(None)
):
    """Get payroll summary for ALL payers - how many recipients each payer has"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    db = tax_service.db
    
    # Get all active payers
    payers = await db.tax_payers.find({"status": {"$ne": "deleted"}}).to_list(length=1000)
    
    summary = []
    for payer in payers:
        payer_id = payer.get('id')
        
        # Count unique recipients and forms
        pipeline = [
            {"$match": {"payerId": payer_id}},
            {"$group": {
                "_id": "$recipientId",
                "formCount": {"$sum": 1},
                "formTypes": {"$addToSet": "$formType"},
                "totalAmount": {"$sum": {"$toDouble": {"$ifNull": ["$box1Amount", "0"]}}}
            }}
        ]
        
        results = await db.tax_forms.aggregate(pipeline).to_list(length=10000)
        
        total_forms = sum(r.get('formCount', 0) for r in results)
        form_types = set()
        for r in results:
            form_types.update(r.get('formTypes', []))
        
        summary.append({
            "payerId": payer_id,
            "payerName": payer.get('name', ''),
            "einMasked": payer.get('einMasked', ''),
            "city": payer.get('city', ''),
            "state": payer.get('state', ''),
            "recipientCount": len(results),
            "formCount": total_forms,
            "formTypes": list(form_types),
            "totalAmount": sum(r.get('totalAmount', 0) for r in results),
        })
    
    summary.sort(key=lambda x: x['recipientCount'], reverse=True)
    
    return {
        "success": True,
        "summary": summary,
        "totalPayers": len(summary),
        "totalRecipients": sum(s['recipientCount'] for s in summary),
        "totalForms": sum(s['formCount'] for s in summary),
    }




@tax_prep_router.put("/payers/{payer_id}")
async def update_payer(
    payer_id: str,
    data: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Update payer information"""
    user_id = await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        result = await tax_service.db.tax_payers.update_one(
            {"id": payer_id},
            {"$set": {**{k: v for k, v in data.items() if k not in ['id', '_id']}, "updatedAt": datetime.utcnow()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Payer not found")
        payer = await tax_service.db.tax_payers.find_one({"id": payer_id})
        return {"success": True, "payer": tax_service._format_payer(payer)}
    except Exception as e:
        logger.error(f"Error updating payer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.delete("/payers/{payer_id}")
async def delete_payer(
    payer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a payer"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        result = await tax_service.db.tax_payers.delete_one({"id": payer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Payer not found")
        return {"success": True, "message": "Payer deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.delete("/taxpayers/{taxpayer_id}")
async def delete_taxpayer(
    taxpayer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a taxpayer"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        result = await tax_service.db.tax_taxpayers.delete_one({"id": taxpayer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Taxpayer not found")
        return {"success": True, "message": "Taxpayer deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.delete("/forms/{form_id}")
async def delete_form(
    form_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a tax form"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        result = await tax_service.db.tax_forms.delete_one({"id": form_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Form not found")
        return {"success": True, "message": "Form deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.post("/taxpayers/import-csv")
async def import_taxpayers_csv(
    data: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Import taxpayers from CSV data (array of objects)"""
    user_id = await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        rows = data.get('rows', [])
        if not rows:
            raise HTTPException(status_code=400, detail="No rows provided")
        
        imported = 0
        errors = []
        for i, row in enumerate(rows):
            try:
                first_name = row.get('firstName', row.get('first_name', row.get('nombre', '')))
                last_name = row.get('lastName', row.get('last_name', row.get('apellido', '')))
                ssn = row.get('ssn', row.get('SSN', row.get('socialSecurity', '')))
                
                if not first_name or not last_name or not ssn:
                    errors.append(f"Row {i+1}: Missing required fields (firstName, lastName, ssn)")
                    continue
                
                taxpayer_data = {
                    'firstName': first_name,
                    'lastName': last_name,
                    'ssn': str(ssn).replace('-', '').replace(' ', ''),
                    'email': row.get('email', ''),
                    'phone': row.get('phone', row.get('telefono', '')),
                    'address1': row.get('address1', row.get('address', row.get('direccion', ''))),
                    'city': row.get('city', row.get('ciudad', '')),
                    'state': row.get('state', row.get('estado', '')),
                    'zipCode': row.get('zipCode', row.get('zip', row.get('codigoPostal', ''))),
                    'tinType': row.get('tinType', 'SSN'),
                }
                await tax_service.create_taxpayer(taxpayer_data, user_id)
                imported += 1
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "total": len(rows),
            "errors": errors[:20]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.post("/payers/import-csv")
async def import_payers_csv(
    data: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Import payers from CSV data (array of objects)"""
    user_id = await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        rows = data.get('rows', [])
        if not rows:
            raise HTTPException(status_code=400, detail="No rows provided")
        
        imported = 0
        errors = []
        for i, row in enumerate(rows):
            try:
                name = row.get('name', row.get('nombre', row.get('companyName', '')))
                ein = row.get('ein', row.get('EIN', ''))
                
                if not name or not ein:
                    errors.append(f"Row {i+1}: Missing required fields (name, ein)")
                    continue
                
                payer_data = {
                    'name': name,
                    'ein': str(ein).replace('-', '').replace(' ', ''),
                    'address1': row.get('address1', row.get('address', '')),
                    'city': row.get('city', ''),
                    'state': row.get('state', ''),
                    'zipCode': row.get('zipCode', row.get('zip', '')),
                    'phone': row.get('phone', ''),
                    'type': row.get('type', 'business'),
                }
                await tax_service.create_payer(payer_data, user_id)
                imported += 1
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "total": len(rows),
            "errors": errors[:20]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@tax_prep_router.post("/taxpayers/import-clients")
async def import_clients_as_taxpayers(
    authorization: Optional[str] = Header(None)
):
    """Import registered platform clients into the tax preparer taxpayers list, enriched with banking data (SSN)"""
    user_id = await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        db = tax_service.db
        
        # Get all banking records (primary source — has the most complete data including SSN)
        banking_records = await db.client_banking.find({}).to_list(length=10000)
        
        # Build a lookup map by email (lowercase) and client_id
        banking_by_email: dict = {}
        banking_by_client_id: dict = {}
        for br in banking_records:
            email = (br.get('email') or '').strip().lower()
            if email:
                banking_by_email[email] = br
            client_id = br.get('client_id')
            if client_id:
                banking_by_client_id[str(client_id)] = br
        
        # Get all clients
        clients = await db.users.find({'role': 'client'}).to_list(length=5000)
        
        # Get existing taxpayer emails to avoid duplicates
        existing_taxpayers = await db.tax_taxpayers.find(
            {'status': {'$ne': 'deleted'}},
            {'email': 1}
        ).to_list(length=10000)
        existing_emails = set(tp.get('email', '').lower() for tp in existing_taxpayers if tp.get('email'))
        
        imported = 0
        skipped = 0
        with_ssn = 0
        errors = []
        
        # First, process all banking records (they have the most complete data)
        processed_emails = set()
        
        for br in banking_records:
            try:
                email = (br.get('email') or '').strip().lower()
                if not email or email in existing_emails or email in processed_emails:
                    skipped += 1
                    continue
                
                first_name = (br.get('first_name') or '').strip()
                last_name = (br.get('last_name') or '').strip()
                if not first_name:
                    skipped += 1
                    continue
                
                ssn_raw = (br.get('ssn') or '').strip()
                
                taxpayer_data = {
                    'firstName': first_name,
                    'lastName': last_name,
                    'ssn': ssn_raw,
                    'email': email,
                    'phone': br.get('phone', ''),
                    'address1': br.get('address', ''),
                    'city': br.get('city', ''),
                    'state': br.get('state', ''),
                    'zipCode': br.get('zip_code', ''),
                }
                await tax_service.create_taxpayer(taxpayer_data, user_id)
                imported += 1
                if ssn_raw:
                    with_ssn += 1
                existing_emails.add(email)
                processed_emails.add(email)
                
            except Exception as e:
                errors.append(f"Banking {br.get('email', 'unknown')}: {str(e)}")
        
        # Then, process remaining clients that weren't in banking records
        for client in clients:
            try:
                email = (client.get('email') or '').strip().lower()
                if not email or email in existing_emails or email in processed_emails:
                    skipped += 1
                    continue
                
                full_name = (client.get('name') or client.get('full_name') or '').strip()
                if not full_name:
                    skipped += 1
                    continue
                
                name_parts = full_name.split(' ', 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ''
                
                # Try to find banking data for this client
                banking = banking_by_email.get(email) or banking_by_client_id.get(str(client.get('_id', '')))
                ssn_raw = ''
                if banking:
                    ssn_raw = (banking.get('ssn') or '').strip()
                
                address = client.get('address', {})
                if isinstance(address, dict):
                    addr1 = address.get('address_line1', '')
                    city = address.get('city', '')
                    state = address.get('state', '')
                    zip_code = address.get('zip_code', '')
                else:
                    addr1 = city = state = zip_code = ''
                
                # If banking data has better address, use it
                if banking:
                    addr1 = banking.get('address', '') or addr1
                    city = banking.get('city', '') or city
                    state = banking.get('state', '') or state
                    zip_code = banking.get('zip_code', '') or zip_code
                
                taxpayer_data = {
                    'firstName': first_name,
                    'lastName': last_name,
                    'ssn': ssn_raw,
                    'email': email,
                    'phone': client.get('phone', ''),
                    'address1': addr1,
                    'city': city,
                    'state': state,
                    'zipCode': zip_code,
                }
                await tax_service.create_taxpayer(taxpayer_data, user_id)
                imported += 1
                if ssn_raw:
                    with_ssn += 1
                existing_emails.add(email)
                processed_emails.add(email)
                
            except Exception as e:
                errors.append(f"Client {client.get('email', 'unknown')}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "with_ssn": with_ssn,
            "total_banking": len(banking_records),
            "total_clients": len(clients),
            "errors": errors[:20]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.put("/taxpayers/{taxpayer_id}")
async def update_taxpayer(
    taxpayer_id: str,
    data: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Update an existing taxpayer"""
    user_id = await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        # Fields allowed to update
        allowed_fields = ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'zipCode', 'middleName', 'suffix', 'dateOfBirth']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        # Handle SSN separately — encrypt and mask
        if 'ssn' in data and data['ssn']:
            ssn_raw = data['ssn'].strip()
            if ssn_raw and ssn_raw != '***':  # Don't update if masked placeholder
                update_data['ssnEncrypted'] = tax_service.encrypt_sensitive(ssn_raw)
                update_data['ssnMasked'] = tax_service.mask_ssn(ssn_raw)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        update_data['updatedAt'] = datetime.utcnow()
        
        result = await tax_service.db.tax_taxpayers.update_one(
            {"id": taxpayer_id},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Taxpayer not found")
        return {"success": True, "message": "Taxpayer updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.put("/payers/{payer_id}")
async def update_payer(
    payer_id: str,
    data: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Update an existing payer"""
    user_id = await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        allowed_fields = ['name', 'address1', 'city', 'state', 'zipCode', 'phone']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        update_data['updatedAt'] = datetime.utcnow()
        
        result = await tax_service.db.tax_payers.update_one(
            {"id": payer_id},
            {"$set": update_data}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Payer not found")
        return {"success": True, "message": "Payer updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/taxpayers/export-csv")
async def export_taxpayers_csv(authorization: Optional[str] = Header(None)):
    """Export taxpayers as CSV"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        taxpayers = await tax_service.db.tax_taxpayers.find(
            {'status': {'$ne': 'deleted'}}
        ).to_list(length=10000)
        
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'zipCode', 'ssnMasked', 'tinVerified'])
        for tp in taxpayers:
            writer.writerow([
                tp.get('firstName', ''), tp.get('lastName', ''), tp.get('email', ''),
                tp.get('phone', ''), tp.get('address1', ''), tp.get('city', ''),
                tp.get('state', ''), tp.get('zipCode', ''), tp.get('ssnMasked', ''),
                'Sí' if tp.get('tinVerified') else 'No'
            ])
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=contribuyentes.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/payers/export-csv")
async def export_payers_csv(authorization: Optional[str] = Header(None)):
    """Export payers as CSV"""
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    try:
        payers = await tax_service.db.tax_payers.find(
            {'status': {'$ne': 'deleted'}}
        ).to_list(length=10000)
        
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['name', 'einMasked', 'address1', 'city', 'state', 'zipCode', 'tinVerified'])
        for p in payers:
            writer.writerow([
                p.get('name', ''), p.get('einMasked', ''), p.get('address1', ''),
                p.get('city', ''), p.get('state', ''), p.get('zipCode', ''),
                'Sí' if p.get('tinVerified') else 'No'
            ])
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=pagadores.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ==================== FORMS ====================

@tax_prep_router.post("/forms/1099-nec")
async def create_form_1099_nec(
    data: Form1099NECCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a 1099-NEC form"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        form = await tax_service.create_form_1099_nec(data.dict(), user_id)
        # Convert to JSON-safe format
        import json
        form_json = json.loads(json.dumps(form, default=str))
        return {"success": True, "form": form_json}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating 1099-NEC: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.post("/forms/1099-misc")
async def create_form_1099_misc(
    data: Form1099MISCCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a 1099-MISC form"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        form = await tax_service.create_form_1099_misc(data.dict(), user_id)
        return {"success": True, "form": form}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating 1099-MISC: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/forms")
async def get_forms(
    form_type: Optional[str] = Query(None),
    tax_year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    authorization: Optional[str] = Header(None)
):
    """Get list of forms"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    forms = await tax_service.get_forms(form_type, tax_year, status, limit)
    return {"success": True, "forms": forms, "count": len(forms)}


@tax_prep_router.get("/forms/{form_id}")
async def get_form(
    form_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get form by ID"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    form = await tax_service.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    return {"success": True, "form": form}


# ==================== TIN MATCHING ====================

@tax_prep_router.post("/tin-match")
async def check_tin(
    data: TINMatchRequest,
    authorization: Optional[str] = Header(None)
):
    """Check TIN with IRS TIN Matching service"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        result = await tax_service.check_tin(
            data.tin, data.name, data.tinType, user_id
        )
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"Error checking TIN: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.post("/tin-match/batch")
async def check_tin_batch(
    items: List[TINMatchRequest] = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Check multiple TINs in batch"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    if len(items) > 25:
        raise HTTPException(status_code=400, detail="Maximum 25 TINs per batch")
    
    results = []
    for item in items:
        try:
            result = await tax_service.check_tin(
                item.tin, item.name, item.tinType, user_id
            )
            results.append(result)
        except Exception as e:
            results.append({
                'tin': item.tin,
                'name': item.name,
                'matched': False,
                'error': str(e)
            })
    
    return {"success": True, "results": results}


# ==================== DOCUMENTS ====================

@tax_prep_router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    taxpayer_id: str = Form(...),
    document_type: str = Form(...),
    tax_year: Optional[int] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """Upload a document for OCR processing"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    # Validate file type
    allowed_types = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and images allowed")
    
    # Save file
    upload_dir = "/app/backend/tax_documents"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    file_name = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(upload_dir, file_name)
    
    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Save metadata
    doc = await tax_service.save_document(
        taxpayer_id=taxpayer_id,
        document_type=document_type,
        filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        uploaded_by=user_id,
        tax_year=tax_year
    )
    
    return {"success": True, "document": doc}


@tax_prep_router.get("/documents/{taxpayer_id}")
async def get_documents(
    taxpayer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get documents for a taxpayer"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    documents = await tax_service.get_documents(taxpayer_id)
    return {"success": True, "documents": documents}


@tax_prep_router.post("/documents/{document_id}/ocr")
async def process_document_ocr(
    document_id: str,
    document_type: Optional[str] = Query('auto', description="Document type: W-2, 1099-NEC, 1099-MISC, or auto"),
    authorization: Optional[str] = Header(None)
):
    """Process document with real OCR using Tesseract"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    # Get document from database
    doc = await tax_service.documents.find_one({'id': document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = doc.get('filePath')
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    
    # Use real OCR service
    try:
        from ocr_service import get_ocr_service
        ocr = get_ocr_service()
        result = ocr.process_document(file_path, document_type)
        
        if result.get('success'):
            await tax_service.update_ocr_result(
                document_id, 
                result.get('fields', {}), 
                result.get('confidence', 0.5)
            )
            
            return {
                "success": True, 
                "ocrResult": {
                    'documentType': result.get('documentType', 'unknown'),
                    'fields': result.get('fields', {}),
                    'confidence': result.get('confidence', 0.5),
                    'needsReview': result.get('needsReview', True),
                    'rawTextPreview': result.get('rawText', '')[:500]
                }
            }
        else:
            return {
                "success": False,
                "error": result.get('error', 'OCR processing failed'),
                "ocrResult": None
            }
            
    except Exception as e:
        logger.error(f"OCR processing error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR error: {str(e)}")


# ==================== CONSENTS ====================

@tax_prep_router.post("/consents")
async def create_consent(
    data: ConsentCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a consent/authorization record"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        consent = await tax_service.create_consent(data.dict(), user_id)
        return {"success": True, "consent": consent}
    except Exception as e:
        logger.error(f"Error creating consent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/consents/{taxpayer_id}")
async def get_consents(
    taxpayer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get consents for a taxpayer"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    consents = await tax_service.get_consents(taxpayer_id)
    return {"success": True, "consents": consents}


# ==================== SUBMISSIONS ====================

@tax_prep_router.post("/submissions")
async def create_submission(
    data: SubmissionCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a submission to IRS"""
    user_id = await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    try:
        submission = await tax_service.create_submission(
            data.formId, data.submissionType, user_id
        )
        return {"success": True, "submission": submission}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating submission: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/submissions")
async def get_submissions(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    authorization: Optional[str] = Header(None)
):
    """Get submissions"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    submissions = await tax_service.get_submissions(status, limit)
    return {"success": True, "submissions": submissions}


@tax_prep_router.post("/submissions/{submission_id}/simulate-response")
async def simulate_submission_response(
    submission_id: str,
    status: str = Query(..., description="accepted or rejected"),
    authorization: Optional[str] = Header(None)
):
    """Simulate IRS response (for testing)"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    if status == 'accepted':
        await tax_service.update_submission_response(
            submission_id,
            status='accepted',
            ack_code='A01',
            ack_message='Submission accepted by IRS'
        )
    else:
        await tax_service.update_submission_response(
            submission_id,
            status='rejected',
            ack_code='R01',
            ack_message='Submission rejected',
            errors=[{
                'code': 'IND-123',
                'field': 'recipientTIN',
                'message': 'TIN does not match IRS records'
            }]
        )
    
    return {"success": True, "status": status}


# ==================== XML GENERATION ====================

@tax_prep_router.get("/forms/{form_id}/xml")
async def generate_form_xml(
    form_id: str,
    authorization: Optional[str] = Header(None)
):
    """Generate IRS-compliant XML for a form using the professional generator"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    form = await tax_service.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    try:
        from irs_xml_generator import get_xml_generator
        
        # Get transmitter info from credentials (if configured)
        transmitter_info = {
            'name': 'Ross Tax Preparation LLC',
            'ein': '',
            'tcc': '',
            'contactName': 'Yoandy Ross',
            'contactPhone': '(806) 934-2018',
            'contactEmail': 'info@rosstaxpreparation.com'
        }
        
        xml_gen = get_xml_generator(transmitter_info)
        xml = xml_gen.generate_xml(form)
        
        return {
            "success": True, 
            "xml": xml, 
            "formType": form.get('formType'),
            "note": "XML generado siguiendo el esquema IRS IRIS. Requiere TCC para envío real."
        }
        
    except Exception as e:
        logger.error(f"Error generating XML: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.post("/forms/batch-xml")
async def generate_batch_xml(
    form_ids: List[str] = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Generate batch XML for multiple forms (for bulk FIRE/IRIS submission)"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    if len(form_ids) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 forms per batch")
    
    # Get all forms
    forms = []
    for form_id in form_ids:
        form = await tax_service.get_form(form_id)
        if form:
            forms.append(form)
    
    if not forms:
        raise HTTPException(status_code=404, detail="No valid forms found")
    
    try:
        from irs_xml_generator import get_xml_generator
        
        transmitter_info = {
            'name': 'Ross Tax Preparation LLC',
            'ein': '',
            'tcc': '',
            'contactName': 'Yoandy Ross',
            'contactPhone': '(806) 934-2018',
            'contactEmail': 'info@rosstaxpreparation.com'
        }
        
        xml_gen = get_xml_generator(transmitter_info)
        
        # Determine form type from first form
        form_type = forms[0].get('formType', '1099-NEC')
        
        batch_xml = xml_gen.generate_batch_xml(forms, form_type)
        
        return {
            "success": True,
            "xml": batch_xml,
            "formType": form_type,
            "totalForms": len(forms),
            "note": "Batch XML para envío masivo. Requiere TCC para transmisión FIRE/IRIS."
        }
        
    except Exception as e:
        logger.error(f"Error generating batch XML: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PDF GENERATION ====================

@tax_prep_router.get("/forms/{form_id}/pdf")
async def generate_form_pdf(
    form_id: str,
    copy_type: str = "B",
    authorization: Optional[str] = Header(None)
):
    """Generate official IRS PDF for a form using real IRS fillable templates"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    form = await tax_service.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    try:
        from irs_official_pdf_generator import get_official_pdf_generator
        
        enriched = await _enrich_form_for_pdf(form)
        
        pdf_gen = get_official_pdf_generator()
        pdf_base64 = pdf_gen.generate_form_pdf_base64(enriched, copy_type)
        
        form_type = form.get('formType', '1099-NEC')
        tax_year = form.get('taxYear', '2025')
        
        return {
            "success": True,
            "pdf": pdf_base64,
            "filename": f"IRS_Form_{form_type}_Copy{copy_type}_{tax_year}_{form_id[:8]}.pdf",
            "formType": form_type,
            "copyType": copy_type,
            "official": True
        }
        
    except FileNotFoundError as e:
        logger.error(f"IRS template not found: {e}")
        raise HTTPException(status_code=404, detail=f"IRS template not found: {str(e)}")
    except ValueError as e:
        logger.error(f"Unsupported form type: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating official IRS PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/forms/{form_id}/pdf/all-copies")
async def generate_form_all_copies(
    form_id: str,
    authorization: Optional[str] = Header(None)
):
    """Generate all copies (A, 1, B, 2, etc.) of an IRS form"""
    await _verify_admin(authorization)
    
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    form = await tax_service.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    try:
        import base64
        from irs_official_pdf_generator import get_official_pdf_generator
        
        enriched = await _enrich_form_for_pdf(form)
        
        pdf_gen = get_official_pdf_generator()
        all_copies = pdf_gen.generate_all_copies(enriched)
        
        form_type = form.get('formType', '1099-NEC')
        tax_year = form.get('taxYear', '2025')
        
        result = {}
        for copy_type, pdf_bytes in all_copies.items():
            result[copy_type] = {
                "pdf": base64.b64encode(pdf_bytes).decode('utf-8'),
                "filename": f"IRS_Form_{form_type}_Copy{copy_type}_{tax_year}_{form_id[:8]}.pdf"
            }
        
        return {
            "success": True,
            "formType": form_type,
            "copies": result,
            "official": True
        }
        
    except Exception as e:
        logger.error(f"Error generating all PDF copies: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@tax_prep_router.post("/forms/test-pdf")
async def generate_test_pdf(
    form_data: dict = Body(...),
    copy_type: str = "B",
    authorization: Optional[str] = Header(None)
):
    """Generate a test IRS PDF with provided form data (no DB required)"""
    await _verify_admin(authorization)
    
    try:
        from irs_official_pdf_generator import get_official_pdf_generator
        
        pdf_gen = get_official_pdf_generator()
        pdf_base64 = pdf_gen.generate_form_pdf_base64(form_data, copy_type)
        
        form_type = form_data.get('formType', '1099-NEC')
        tax_year = form_data.get('taxYear', '2025')
        
        return {
            "success": True,
            "pdf": pdf_base64,
            "filename": f"IRS_Test_{form_type}_Copy{copy_type}_{tax_year}.pdf",
            "formType": form_type,
            "copyType": copy_type,
            "official": True,
            "availableForms": pdf_gen.get_available_forms()
        }
        
    except Exception as e:
        logger.error(f"Error generating test PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_prep_router.get("/available-forms")
async def get_available_irs_forms():
    """List available official IRS form templates"""
    try:
        from irs_official_pdf_generator import get_official_pdf_generator
        
        pdf_gen = get_official_pdf_generator()
        forms = pdf_gen.get_available_forms()
        
        return {
            "success": True,
            "forms": forms,
            "copies": {
                '1099-NEC': ['A', '1', 'B', '2'],
                '1099-MISC': ['A', '1', 'B', '2'],
                '1099-INT': ['A', '1', 'B', '2'],
                '1098': ['A', 'B'],
                'W-2G': ['A', '1', 'B', 'C', '2', 'D'],
                '4506-T': ['original'],
                '8821': ['original'],
                '2848': ['original'],
            },
            "categories": {
                "tax_forms": ['1099-NEC', '1099-MISC', '1099-INT', '1098', 'W-2G'],
                "transcript_auth": ['4506-T', '8821', '2848'],
            },
            "descriptions": {
                '4506-T': 'Solicitud de Transcripción de Declaración de Impuestos',
                '8821': 'Autorización de Información Tributaria',
                '2848': 'Poder Notarial y Declaración de Representante',
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@tax_prep_router.get("/ives/form-13803")
async def generate_ives_application(
    authorization: Optional[str] = Header(None)
):
    """Generate pre-filled Form 13803 IVES Application for Ross Tax Preparation LLC"""
    await _verify_admin(authorization)
    
    try:
        from pypdf import PdfReader, PdfWriter
        import base64, os
        
        template_path = os.path.join(os.path.dirname(__file__), 'irs_templates', 'f13803.pdf')
        reader = PdfReader(template_path)
        writer = PdfWriter()
        writer.clone_reader_document_root(reader)
        
        p1 = 'form1[0].page1[0]'
        p2 = 'form1[0].page2[0]'
        
        fields = {
            f'{p1}.TypeOfApplication[0].New[0]': '/Yes',
            f'{p1}.OrganizationStatus[0].LLC[0]': '/Yes',
            f'{p1}.ReasonsForUsing[0].Otherspecify[0]': '/Yes',
            f'{p1}.ReasonsForUsing[0].Otherspec[0]': 'Tax Preparation Services',
            f'{p1}.Legal[0]': 'Ross Tax Preparation LLC',
            f'{p1}.EIN[0]': '33-1240497',
            f'{p1}.Streetaddress[0]': '305 Bruce Ave',
            f'{p1}.City[0]': 'Dumas',
            f'{p1}.State[0]': 'TX',
            f'{p1}.Zip[0]': '79029',
            f'{p1}.Businessemail[0]': 'yoandyross@rosstaxpreparation.com',
            f'{p1}.Company[0]': 'Yoandy Ross',
            f'{p1}.Title[0]': 'Managing Member / Owner',
            f'{p1}.Email[0]': 'yoandyross@rosstaxpreparation.com',
            f'{p1}.State[2]': 'TX',
            f'{p1}.no[0]': '/Yes',
            f'{p1}.CurrentWithTaxes[0].yes[0]': '/Yes',
            f'{p1}.Estimated[0]': '500',
            f'{p2}.Responsible[0]': 'Yoandy Ross',
            f'{p2}.Title[0]': 'Managing Member / Owner',
            f'{p2}.Email[0]': 'yoandyross@rosstaxpreparation.com',
            f'{p2}.State[0]': 'TX',
            f'{p2}.CheckBox12[0]': '/Yes',
            f'{p2}.Name[0]': 'Yoandy Ross, Managing Member',
        }
        
        for page in writer.pages:
            writer.update_page_form_field_values(page, fields, auto_regenerate=False)
        
        from io import BytesIO
        buffer = BytesIO()
        writer.write(buffer)
        pdf_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "success": True,
            "pdf": pdf_b64,
            "filename": "Form_13803_IVES_Application_RossTax.pdf",
            "note": "SSN, fecha de nacimiento, dirección personal, teléfono y firma deben completarse manualmente por seguridad. Enviar por fax firmado al 844-251-8254."
        }
    except Exception as e:
        logger.error(f"Error generating Form 13803: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ==================== DATA MIGRATION / RE-ENCRYPTION ====================

@tax_prep_router.post("/admin/re-encrypt-all")
async def re_encrypt_all_sensitive_data(
    authorization: Optional[str] = Header(None)
):
    """
    Re-encrypt all taxpayer SSNs and payer EINs using the current persistent
    encryption key.  Recovers raw SSNs from client_banking when decryption
    of the old value fails.
    """
    await _verify_admin(authorization)
    if not tax_service:
        raise HTTPException(status_code=500, detail="Service not initialized")

    db = tax_service.db
    stats = {"taxpayers_fixed": 0, "taxpayers_skipped": 0, "payers_fixed": 0, "payers_skipped": 0, "errors": []}

    # Build client_banking lookup by email
    banking_records = await db.client_banking.find({}).to_list(length=10000)
    banking_by_email = {}
    for br in banking_records:
        email = (br.get('email') or '').strip().lower()
        if email:
            banking_by_email[email] = br

    # ---- Fix taxpayers ----
    taxpayers = await db.tax_taxpayers.find({"status": {"$ne": "deleted"}}).to_list(length=10000)
    for tp in taxpayers:
        tp_id = tp.get('id', str(tp.get('_id', '')))
        try:
            # Try to decrypt with current key
            ssn_encrypted = tp.get('ssnEncrypted', '')
            raw_ssn = ''
            if ssn_encrypted:
                try:
                    raw_ssn = tax_service.decrypt_sensitive(ssn_encrypted)
                except Exception:
                    pass

            # Fallback to client_banking
            if not raw_ssn:
                email = (tp.get('email') or '').strip().lower()
                banking = banking_by_email.get(email)
                if banking and banking.get('ssn'):
                    raw_ssn = banking['ssn']

            if raw_ssn and len(raw_ssn.replace('-', '').replace(' ', '')) >= 4:
                new_encrypted = tax_service.encrypt_sensitive(raw_ssn)
                new_masked = tax_service.mask_ssn(raw_ssn)
                await db.tax_taxpayers.update_one(
                    {"id": tp_id},
                    {"$set": {"ssnEncrypted": new_encrypted, "ssnMasked": new_masked}}
                )
                stats["taxpayers_fixed"] += 1
            else:
                stats["taxpayers_skipped"] += 1
        except Exception as e:
            stats["errors"].append(f"Taxpayer {tp_id}: {str(e)}")

    # ---- Fix payers ----
    payers = await db.tax_payers.find({"status": {"$ne": "deleted"}}).to_list(length=10000)
    for p in payers:
        p_id = p.get('id', str(p.get('_id', '')))
        try:
            ein_encrypted = p.get('einEncrypted', '')
            raw_ein = ''
            if ein_encrypted:
                try:
                    raw_ein = tax_service.decrypt_sensitive(ein_encrypted)
                except Exception:
                    pass

            if raw_ein and len(raw_ein.replace('-', '').replace(' ', '')) >= 4:
                new_encrypted = tax_service.encrypt_sensitive(raw_ein)
                new_masked = tax_service.mask_ein(raw_ein)
                await db.tax_payers.update_one(
                    {"id": p_id},
                    {"$set": {"einEncrypted": new_encrypted, "einMasked": new_masked}}
                )
                stats["payers_fixed"] += 1
            else:
                stats["payers_skipped"] += 1
        except Exception as e:
            stats["errors"].append(f"Payer {p_id}: {str(e)}")

    return {
        "success": True,
        "message": "Re-encryption complete",
        "stats": stats
    }
