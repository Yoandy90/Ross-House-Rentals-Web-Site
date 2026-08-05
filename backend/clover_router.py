"""
Clover POS Integration Router
Extracted from server.py for modularization.
Handles Clover payments, customers, orders, sync, and ecommerce.
"""
import os
import logging
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, Query
from bson import ObjectId
from typing import Optional

load_dotenv()
logger = logging.getLogger(__name__)

clover_router = APIRouter()
_db = None
_get_current_user = None

# Clover config — read from environment
CLOVER_API_URL = os.getenv("CLOVER_API_URL", "https://api.clover.com")
CLOVER_MERCHANT_ID = os.getenv("CLOVER_MERCHANT_ID", "")
CLOVER_API_TOKEN = os.getenv("CLOVER_API_TOKEN", "")
CLOVER_ECOMMERCE_PRIVATE = os.getenv("CLOVER_ECOMMERCE_PRIVATE", "")

def get_clover_headers():
    return {"Authorization": f"Bearer {CLOVER_API_TOKEN}", "Accept": "application/json"}

def init_clover_router(db, get_current_user_func):
    global _db, _get_current_user
    _db = db
    _get_current_user = get_current_user_func

async def _auth_user(request: Request):
    """Authenticate user from Bearer token — mirrors server.py get_current_user"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    # Handle both "Bearer <token>" and raw "<token>" formats
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Sesión expirada')
    # Get user — handle both ObjectId and UUID string IDs (matches server.py)
    user_id = session['user_id']
    user = None
    try:
        user = await _db.users.find_one({'_id': ObjectId(user_id)})
    except Exception:
        pass
    if not user:
        user = await _db.users.find_one({'_id': user_id})
    if not user:
        raise HTTPException(status_code=401, detail='Usuario no encontrado')
    user['id'] = str(user['_id'])
    return user

def _require_admin(current_user):
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')

# CLOVER CARD-ON-FILE (Saved Cards System)
# ==========================================

@clover_router.get("/admin/clover/saved-cards")
async def get_clover_saved_cards(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str = Query(""),
):
    """Get all Clover customers with their saved cards"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers"
            f"?limit={limit}&offset={offset}&expand=cards,emailAddresses,phoneNumbers"
            f"&orderBy=customerSince+DESC",
            headers=get_clover_headers()
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Clover API error")
        
        data = r.json()
        customers_with_cards = []
        
        for c in data.get("elements", []):
            cards = c.get("cards", {}).get("elements", [])
            if not cards:
                continue
            
            name = f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if search_lower not in name.lower():
                    continue
            
            email = ""
            emails = c.get("emailAddresses", {}).get("elements", [])
            if emails:
                email = emails[0].get("emailAddress", "")
            
            phone = ""
            phones = c.get("phoneNumbers", {}).get("elements", [])
            if phones:
                phone = phones[0].get("phoneNumber", "")
            
            card_list = []
            for card in cards:
                card_list.append({
                    "card_id": card.get("id"),
                    "last4": card.get("last4"),
                    "first6": card.get("first6"),
                    "card_type": card.get("cardType"),
                    "token_type": card.get("tokenType"),
                    "exp_month": card.get("expirationDate", "")[:2] if card.get("expirationDate") else "",
                    "exp_year": card.get("expirationDate", "")[2:] if card.get("expirationDate") else "",
                    "cardholder_name": f"{card.get('firstName', '')} {card.get('lastName', '')}".strip(),
                })
            
            # Check if linked to internal client
            linked_client = await _db.clover_linked_clients.find_one({"clover_customer_id": c.get("id")})
            
            # Check if this POS customer has a saved ecommerce token for online charges
            ecom_link = await _db.clover_ecommerce_customers.find_one({"clover_pos_customer_id": c.get("id")})
            
            # Convert customerSince timestamp
            since_ts = c.get("customerSince")
            since_iso = datetime.fromtimestamp(since_ts / 1000).isoformat() if since_ts else ""
            
            customers_with_cards.append({
                "clover_id": c.get("id"),
                "name": name,
                "email": email,
                "phone": phone,
                "since": since_iso,
                "cards": card_list,
                "linked_client_id": str(linked_client.get("internal_client_id", "")) if linked_client else None,
                "linked_client_name": linked_client.get("internal_client_name") if linked_client else None,
                "has_ecommerce_token": ecom_link is not None,
                "ecommerce_customer_id": str(ecom_link.get("ecommerce_customer_id", "")) if ecom_link else None,
                "ecommerce_card_last4": ecom_link.get("card_last4") if ecom_link else None,
                "ecommerce_card_type": ecom_link.get("card_type") if ecom_link else None,
            })
        
        return {
            "success": True,
            "customers": customers_with_cards,
            "total": len(customers_with_cards)
        }

@clover_router.post("/admin/clover/link-client")
async def link_clover_to_internal_client(request: Request):
    """Link a Clover customer to an internal client"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    data = await request.json()
    clover_id = data.get("clover_customer_id")
    internal_id = data.get("internal_client_id")
    internal_name = data.get("internal_client_name", "")
    
    if not clover_id or not internal_id:
        raise HTTPException(status_code=400, detail="Both IDs are required")
    
    await _db.clover_linked_clients.update_one(
        {"clover_customer_id": clover_id},
        {"$set": {
            "clover_customer_id": clover_id,
            "internal_client_id": internal_id,
            "internal_client_name": internal_name,
            "linked_at": datetime.utcnow().isoformat(),
            "linked_by": current_user.get("email", "admin")
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Cliente vinculado exitosamente"}

@clover_router.get("/admin/clover/client-cards/{client_id}")
async def get_cards_for_internal_client(client_id: str, request: Request):
    """Get saved Clover cards for an internal client"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    link = await _db.clover_linked_clients.find_one({"internal_client_id": client_id})
    if not link:
        return {"success": True, "cards": [], "linked": False}
    
    clover_id = link["clover_customer_id"]
    
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{clover_id}?expand=cards",
            headers=get_clover_headers()
        )
        if r.status_code != 200:
            return {"success": True, "cards": [], "linked": True, "error": "Could not fetch from Clover"}
        
        data = r.json()
        cards = []
        for card in data.get("cards", {}).get("elements", []):
            cards.append({
                "card_id": card.get("id"),
                "last4": card.get("last4"),
                "first6": card.get("first6"),
                "card_type": card.get("cardType"),
                "cardholder_name": f"{card.get('firstName', '')} {card.get('lastName', '')}".strip(),
            })
        
        return {
            "success": True,
            "cards": cards,
            "linked": True,
            "clover_customer_id": clover_id,
            "clover_customer_name": f"{data.get('firstName', '')} {data.get('lastName', '')}".strip()
        }

@clover_router.get("/admin/clover/payment-history/{clover_customer_id}")
async def get_clover_customer_payment_history(clover_customer_id: str, request: Request):
    """Get payment history for a specific Clover customer"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    async with httpx.AsyncClient(timeout=15) as client:
        # Get payments filtered by customer
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/payments"
            f"?expand=tender,cardTransaction&limit=50&orderBy=createdTime+DESC",
            headers=get_clover_headers()
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Clover API error")
        
        # Filter payments by customer's card last4/name (Clover doesn't filter by customer directly on payments)
        # Get customer info first
        cr = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{clover_customer_id}?expand=cards",
            headers=get_clover_headers()
        )
        customer_cards = set()
        if cr.status_code == 200:
            cdata = cr.json()
            for card in cdata.get("cards", {}).get("elements", []):
                customer_cards.add(card.get("last4", ""))
        
        all_payments = r.json().get("elements", [])
        customer_payments = []
        for p in all_payments:
            ct = p.get("cardTransaction", {})
            if ct.get("last4") in customer_cards:
                customer_payments.append({
                    "id": p.get("id"),
                    "amount": p.get("amount", 0) / 100,
                    "tip": p.get("tipAmount", 0) / 100,
                    "total": (p.get("amount", 0) + p.get("tipAmount", 0)) / 100,
                    "result": p.get("result"),
                    "created_at": datetime.fromtimestamp(p.get("createdTime", 0) / 1000, tz=timezone.utc).isoformat() if p.get("createdTime") else "",
                    "card_type": ct.get("cardType", ""),
                    "card_last4": ct.get("last4", ""),
                    "cardholder_name": ct.get("cardholderName", ""),
                })
        
        return {"success": True, "payments": customer_payments, "total": len(customer_payments)}

@clover_router.post("/admin/clover/charge")
async def charge_clover_card(request: Request):
    """Charge via Clover Ecommerce API using a token from the iFrame or an ecommerce customer ID"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    data = await request.json()
    token = data.get("token")  # Single-pay token from Clover iFrame (clv_...)
    ecommerce_customer_id = data.get("ecommerce_customer_id")  # Multi-pay customer
    amount_dollars = data.get("amount")  # Amount in dollars
    description = data.get("description", "Ross Tax Preparation")
    customer_name = data.get("customer_name", "Cliente")
    save_card = data.get("save_card", False)  # Whether to save as multi-pay customer
    customer_email = data.get("email", "")
    clover_pos_customer_id = data.get("clover_pos_customer_id", "")  # Link to POS customer
    
    if not amount_dollars:
        raise HTTPException(status_code=400, detail="amount is required")
    
    if not token and not ecommerce_customer_id:
        raise HTTPException(status_code=400, detail="Either token (from iFrame) or ecommerce_customer_id is required")
    
    if amount_dollars <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    amount_cents = int(float(amount_dollars) * 100)
    
    ecommerce_headers = {
        "Authorization": f"Bearer {CLOVER_ECOMMERCE_PRIVATE}",
        "Content-Type": "application/json"
    }
    
    charge_source = None
    card_last4 = ""
    card_type = ""
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Determine charge source
            if ecommerce_customer_id:
                # Charge existing ecommerce customer (multi-pay)
                charge_source = ecommerce_customer_id
                ecom_record = await _db.clover_ecommerce_customers.find_one({"ecommerce_customer_id": ecommerce_customer_id})
                if ecom_record:
                    customer_name = f"{ecom_record.get('first_name', '')} {ecom_record.get('last_name', '')}".strip() or customer_name
                    card_last4 = ecom_record.get("card_last4", "")
                    card_type = ecom_record.get("card_type", "")
            elif token:
                if save_card:
                    # Create ecommerce customer first (generates multi-pay token)
                    cust_payload = {"source": token, "email": customer_email}
                    cust_resp = await client.post(
                        "https://scl.clover.com/v1/customers",
                        headers=ecommerce_headers,
                        json=cust_payload
                    )
                    cust_data = cust_resp.json()
                    if cust_resp.status_code in [200, 201]:
                        charge_source = cust_data.get("id")
                        sources = cust_data.get("sources", {}).get("data", [])
                        if sources:
                            card_last4 = sources[0].get("last4", "")
                            card_type = sources[0].get("brand", "")
                        # Save to DB
                        ecom_save_data = {
                                "ecommerce_customer_id": charge_source,
                                "first_name": customer_name.split(" ")[0] if customer_name else "",
                                "last_name": " ".join(customer_name.split(" ")[1:]) if customer_name else "",
                                "email": customer_email,
                                "card_last4": card_last4,
                                "card_type": card_type,
                                "created_by": current_user.get("email", "admin"),
                                "created_at": datetime.utcnow().isoformat(),
                        }
                        if clover_pos_customer_id:
                            ecom_save_data["clover_pos_customer_id"] = clover_pos_customer_id
                        await _db.clover_ecommerce_customers.update_one(
                            {"ecommerce_customer_id": charge_source},
                            {"$set": ecom_save_data},
                            upsert=True
                        )
                    else:
                        error_msg = cust_data.get("error", {}).get("message", "Failed to create customer")
                        raise HTTPException(status_code=400, detail=f"Error creando cliente: {error_msg}")
                else:
                    # Direct single-pay charge with token
                    charge_source = token
            
            # Create charge via Clover Ecommerce API
            charge_payload = {
                "amount": amount_cents,
                "currency": "usd",
                "source": charge_source,
                "description": description,
                "capture": True,
            }
            
            # Add x-forwarded-for header for risk analysis
            ecommerce_headers["x-forwarded-for"] = "76.185.73.100"
            
            charge_response = await client.post(
                "https://scl.clover.com/v1/charges",
                headers=ecommerce_headers,
                json=charge_payload
            )
            
            charge_data = charge_response.json()
            
            if charge_response.status_code in [200, 201] and charge_data.get("paid"):
                # Extract card info from charge response
                source_info = charge_data.get("source", {})
                resp_last4 = source_info.get("last4", card_last4)
                resp_brand = source_info.get("brand", card_type)
                
                # Generate barcode for Clover POS scanning
                from invoice_pdf_service import InvoicePDFService
                charge_barcode_id = charge_data.get("id", "")
                barcode_base64 = InvoicePDFService.generate_barcode_base64(charge_barcode_id) if charge_barcode_id else None
                
                # Log successful charge
                await _db.clover_charges.insert_one({
                    "charge_source": charge_source,
                    "customer_name": customer_name,
                    "amount": amount_dollars,
                    "amount_cents": amount_cents,
                    "charge_id": charge_data.get("id"),
                    "card_last4": resp_last4,
                    "card_type": resp_brand,
                    "status": "SUCCESS",
                    "description": description,
                    "has_barcode": True,
                    "charged_by": current_user.get("email", "admin"),
                    "created_at": datetime.utcnow().isoformat(),
                })
                
                response_data = {
                    "success": True,
                    "charge_id": charge_data.get("id"),
                    "amount": amount_dollars,
                    "customer_name": customer_name,
                    "card_last4": resp_last4,
                    "card_type": resp_brand,
                    "message": f"Cobro de ${amount_dollars:.2f} exitoso"
                }
                
                # Incluir barcode en la respuesta si se generó
                if barcode_base64:
                    response_data["barcode_base64"] = barcode_base64
                    response_data["barcode_data"] = charge_barcode_id
                
                return response_data
            else:
                error_msg = charge_data.get("error", {}).get("message", charge_data.get("message", "Charge failed"))
                # Log failed charge
                await _db.clover_charges.insert_one({
                    "charge_source": charge_source,
                    "customer_name": customer_name,
                    "amount": amount_dollars,
                    "status": "FAILED",
                    "error": error_msg,
                    "description": description,
                    "charged_by": current_user.get("email", "admin"),
                    "created_at": datetime.utcnow().isoformat(),
                })
                raise HTTPException(status_code=400, detail=f"Cobro fallido: {error_msg}")
    
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout conectando con Clover")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@clover_router.post("/admin/clover/create-ecommerce-customer")
async def create_clover_ecommerce_customer(request: Request):
    """Create a Clover Ecommerce customer from a card token (from iframe tokenization)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    data = await request.json()
    card_token = data.get("token")  # Single-pay token from Clover iframe
    email = data.get("email", "")
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")
    internal_client_id = data.get("internal_client_id", "")
    
    if not card_token:
        raise HTTPException(status_code=400, detail="Card token is required")
    
    ecommerce_headers = {
        "Authorization": f"Bearer {CLOVER_ECOMMERCE_PRIVATE}",
        "Content-Type": "application/json",
        "idempotency-key": str(ObjectId()),
        "x-forwarded-for": "76.185.73.100"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Create Ecommerce customer with card token (generates multipay token)
            payload = {
                "source": card_token,
                "email": email,
            }
            
            r = await client.post(
                "https://scl.clover.com/v1/customers",
                headers=ecommerce_headers,
                json=payload
            )
            
            response_data = r.json()
            
            if r.status_code in [200, 201]:
                ecom_customer_id = response_data.get("id")
                # Get the default source (multipay token)
                sources = response_data.get("sources", {}).get("data", [])
                multipay_token = sources[0].get("id") if sources else None
                card_info = sources[0] if sources else {}
                
                # Save to our DB
                await _db.clover_ecommerce_customers.update_one(
                    {"ecommerce_customer_id": ecom_customer_id},
                    {"$set": {
                        "ecommerce_customer_id": ecom_customer_id,
                        "multipay_token": multipay_token,
                        "first_name": first_name,
                        "last_name": last_name,
                        "email": email,
                        "card_last4": card_info.get("last4", ""),
                        "card_first6": card_info.get("first6", ""),
                        "card_type": card_info.get("brand", ""),
                        "card_exp_month": card_info.get("exp_month", ""),
                        "card_exp_year": card_info.get("exp_year", ""),
                        "internal_client_id": internal_client_id,
                        "created_by": current_user.get("email", "admin"),
                        "created_at": datetime.utcnow().isoformat(),
                    }},
                    upsert=True
                )
                
                return {
                    "success": True,
                    "ecommerce_customer_id": ecom_customer_id,
                    "multipay_token": multipay_token,
                    "card_last4": card_info.get("last4"),
                    "card_type": card_info.get("brand"),
                    "message": f"Tarjeta guardada para {first_name} {last_name}"
                }
            else:
                error_msg = response_data.get("error", {}).get("message", response_data.get("message", "Failed"))
                raise HTTPException(status_code=400, detail=f"Error: {error_msg}")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@clover_router.get("/admin/clover/ecommerce-customers")
async def get_clover_ecommerce_customers(request: Request):
    """Get all Clover Ecommerce customers with saved cards"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    customers = await _db.clover_ecommerce_customers.find().sort("created_at", -1).to_list(500)
    for c in customers:
        c["_id"] = str(c["_id"])
    
    return {"success": True, "customers": customers}


# ==========================================
# CLOVER POS INTEGRATION
# ==========================================



@clover_router.get("/admin/clover/merchant")
async def get_clover_merchant(request: Request):
    """Get Clover merchant info"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}?expand=address",
            headers=get_clover_headers()
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Clover API error")
        return {"success": True, "merchant": r.json()}

@clover_router.get("/admin/clover/payments")
async def get_clover_payments(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    date_from: str = Query(None, description="Start date YYYY-MM-DD"),
    date_to: str = Query(None, description="End date YYYY-MM-DD"),
    search: str = Query(None, description="Search by cardholder name"),
    card_type: str = Query(None, description="Filter by card type: VISA, MC, AMEX, DISCOVER"),
    entry_type: str = Query(None, description="Filter by entry: EMV_CONTACT, SWIPED, KEYED, EMV_CONTACTLESS"),
    result_filter: str = Query(None, description="Filter by result: SUCCESS, DECLINED, REFUND"),
):
    """Get Clover payments with filters"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    # Build filter string for Clover API
    filters = []
    if date_from:
        try:
            from zoneinfo import ZoneInfo
            cst = ZoneInfo("America/Chicago")
            dt_from = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=cst)
            filters.append(f"createdTime>={int(dt_from.timestamp() * 1000)}")
        except Exception:
            pass
    if date_to:
        try:
            from zoneinfo import ZoneInfo
            cst = ZoneInfo("America/Chicago")
            dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=cst)
            filters.append(f"createdTime<={int(dt_to.timestamp() * 1000)}")
        except Exception:
            pass
    
    filter_str = "&".join([f"filter={f}" for f in filters]) if filters else ""
    
    # Fetch more data to allow client-side filtering
    fetch_limit = min(limit * 3, 500) if (search or card_type or entry_type or result_filter) else limit
    
    async with httpx.AsyncClient(timeout=20) as client:
        url = (
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/payments"
            f"?limit={fetch_limit}&offset={offset}&expand=tender,cardTransaction,order"
            f"&orderBy=createdTime+DESC"
        )
        if filter_str:
            url += f"&{filter_str}"
        
        r = await client.get(url, headers=get_clover_headers())
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Clover API error")
        data = r.json()
        
        payments = []
        total_amount = 0
        total_tips = 0
        total_count = 0
        
        for p in data.get("elements", []):
            ct = p.get("cardTransaction", {})
            payment = {
                "id": p.get("id"),
                "amount": p.get("amount", 0) / 100,
                "tip": p.get("tipAmount", 0) / 100,
                "tax": p.get("taxAmount", 0) / 100,
                "total": (p.get("amount", 0) + p.get("tipAmount", 0)) / 100,
                "result": p.get("result"),
                "created_at": datetime.fromtimestamp(p.get("createdTime", 0) / 1000, tz=timezone.utc).isoformat() if p.get("createdTime") else "",
                "card_type": ct.get("cardType", ""),
                "card_last4": ct.get("last4", ""),
                "card_first6": ct.get("first6", ""),
                "entry_type": ct.get("entryType", ""),
                "cardholder_name": ct.get("cardholderName", ""),
                "auth_code": ct.get("authCode", ""),
                "tender_label": p.get("tender", {}).get("label", ""),
                "order_id": p.get("order", {}).get("id", ""),
            }
            
            # Apply client-side filters
            if search:
                if search.upper() not in (payment["cardholder_name"] or "").upper():
                    continue
            if card_type:
                if payment["card_type"] != card_type:
                    continue
            if entry_type:
                if payment["entry_type"] != entry_type:
                    continue
            if result_filter:
                if payment["result"] != result_filter:
                    continue
            
            payments.append(payment)
            if payment["result"] == "SUCCESS":
                total_amount += payment["amount"]
                total_tips += payment["tip"]
                total_count += 1
        
        # Trim to requested limit
        has_more = len(payments) > limit
        payments = payments[:limit]
        
        return {
            "success": True,
            "payments": payments,
            "total": len(payments),
            "has_more": has_more,
            "summary": {
                "total_amount": round(total_amount, 2),
                "total_tips": round(total_tips, 2),
                "total_grand": round(total_amount + total_tips, 2),
                "successful_count": total_count
            }
        }

@clover_router.get("/admin/clover/customers")
async def get_clover_customers(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get Clover customers"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers"
            f"?limit={limit}&offset={offset}&expand=cards,emailAddresses,phoneNumbers"
            f"&orderBy=customerSince+DESC",
            headers=get_clover_headers()
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Clover API error")
        data = r.json()
        customers = []
        
        # Build a lookup from our local DB for fallback email/phone
        linked_docs = await _db.clover_linked_clients.find({}).to_list(5000)
        local_lookup = {}
        for doc in linked_docs:
            cid = doc.get("clover_customer_id")
            if cid:
                local_lookup[cid] = doc
        
        for c in data.get("elements", []):
            clover_id = c.get("id")
            
            # Get email from Clover expand or local DB
            email = next((e.get("emailAddress") for e in c.get("emailAddresses", {}).get("elements", [])), "")
            phone = next((p.get("phoneNumber") for p in c.get("phoneNumbers", {}).get("elements", [])), "")
            
            # Fallback to local DB
            if (not email or not phone) and clover_id in local_lookup:
                local = local_lookup[clover_id]
                if not email:
                    email = local.get("internal_client_email", "")
                if not phone:
                    # Look up phone from users collection
                    internal_id = local.get("internal_client_id")
                    if internal_id:
                        try:
                            from bson import ObjectId as BsonOId
                            user_query = {"_id": BsonOId(internal_id)} if BsonOId.is_valid(internal_id) else {"_id": internal_id}
                            user = await _db.users.find_one(user_query, {"phone": 1})
                            if user:
                                phone = user.get("phone", "")
                        except Exception:
                            pass
            
            # Convert customerSince timestamp
            since_ts = c.get("customerSince")
            since_iso = datetime.fromtimestamp(since_ts / 1000).isoformat() if since_ts else ""
            
            customers.append({
                "id": clover_id,
                "first_name": c.get("firstName", ""),
                "last_name": c.get("lastName", ""),
                "email": email,
                "phone": phone,
                "since": since_iso,
                "cards": [{"last4": card.get("last4"), "first6": card.get("first6"), "type": card.get("cardType")} for card in c.get("cards", {}).get("elements", [])]
            })
        return {"success": True, "customers": customers, "total": len(customers)}

@clover_router.get("/admin/clover/orders")
async def get_clover_orders(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Get Clover orders with line items and customers"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders"
            f"?limit={limit}&offset={offset}&expand=lineItems,customers"
            f"&orderBy=createdTime+DESC",
            headers=get_clover_headers()
        )
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail="Clover API error")
        data = r.json()
        orders = []
        for o in data.get("elements", []):
            items = [{"name": li.get("name"), "price": li.get("price", 0) / 100}
                     for li in o.get("lineItems", {}).get("elements", [])]
            
            # Get customers - try from expand first, then from note/title
            custs = []
            cust_elements = o.get("customers", {}).get("elements", [])
            if cust_elements:
                # Fetch full customer details for each
                for ce in cust_elements:
                    cid = ce.get("id")
                    if cid and (ce.get("firstName") or ce.get("lastName")):
                        custs.append({"id": cid, "first_name": ce.get("firstName", ""), "last_name": ce.get("lastName", "")})
                    elif cid:
                        # Fetch customer details
                        try:
                            cr = await client.get(
                                f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{cid}",
                                headers=get_clover_headers()
                            )
                            if cr.status_code == 200:
                                cd = cr.json()
                                custs.append({"id": cid, "first_name": cd.get("firstName", ""), "last_name": cd.get("lastName", "")})
                        except Exception:
                            custs.append({"id": cid, "first_name": "", "last_name": ""})
            
            # If no customers found, try to get from our local DB
            if not custs:
                clover_order_id = o.get("id")
                local_order = await _db.clover_appointment_orders.find_one({"clover_order_id": clover_order_id})
                if local_order:
                    full_name = local_order.get("client_name", "")
                    name_parts = full_name.split(" ", 1)
                    custs.append({
                        "id": str(local_order.get("clover_customer_id", "")),
                        "first_name": name_parts[0] if name_parts else "",
                        "last_name": name_parts[1] if len(name_parts) > 1 else ""
                    })
            
            # Convert timestamp to ISO date
            created_ms = o.get("createdTime", 0)
            created_iso = datetime.fromtimestamp(created_ms / 1000, tz=timezone.utc).isoformat() if created_ms else ""
            
            orders.append({
                "id": o.get("id"),
                "total": o.get("total", 0) / 100,
                "state": o.get("state"),
                "payment_state": o.get("paymentState"),
                "created_at": created_iso,
                "note": o.get("note", ""),
                "title": o.get("title", ""),
                "line_items": items,
                "customers": custs,
            })
        return {"success": True, "orders": orders, "total": len(orders)}

@clover_router.get("/admin/clover/stats")
async def get_clover_stats(
    request: Request,
    date_from: str = Query(None, description="Start date YYYY-MM-DD"),
    date_to: str = Query(None, description="End date YYYY-MM-DD"),
):
    """Get Clover summary stats for a date range (defaults to today)"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from zoneinfo import ZoneInfo
    cst = ZoneInfo("America/Chicago")
    now_cst = datetime.now(cst)
    
    # Default to today if no dates provided
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=cst)
        except Exception:
            dt_from = now_cst.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        dt_from = now_cst.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=cst)
        except Exception:
            dt_to = now_cst
    else:
        dt_to = now_cst
    
    from_ms = int(dt_from.timestamp() * 1000)
    to_ms = int(dt_to.timestamp() * 1000)
    
    async with httpx.AsyncClient(timeout=20) as client:
        # Fetch payments in range
        r = await client.get(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/payments"
            f"?filter=createdTime>={from_ms}&filter=createdTime<={to_ms}"
            f"&expand=cardTransaction&limit=500",
            headers=get_clover_headers()
        )
        period_payments = r.json().get("elements", []) if r.status_code == 200 else []
        
        successful = [p for p in period_payments if p.get("result") == "SUCCESS"]
        declined = [p for p in period_payments if p.get("result") == "DECLINED"]
        refunds = [p for p in period_payments if p.get("result") == "REFUND"]
        
        period_total = sum(p.get("amount", 0) + p.get("tipAmount", 0) for p in successful) / 100
        period_tips = sum(p.get("tipAmount", 0) for p in successful) / 100
        period_subtotal = sum(p.get("amount", 0) for p in successful) / 100
        period_count = len(successful)
        
        # Card type breakdown
        card_types = {}
        entry_types = {}
        # Daily breakdown for chart
        daily_totals = {}
        
        for p in successful:
            ct = p.get("cardTransaction", {}).get("cardType", "OTHER")
            card_types[ct] = card_types.get(ct, 0) + 1
            
            et = p.get("cardTransaction", {}).get("entryType", "OTHER")
            entry_types[et] = entry_types.get(et, 0) + 1
            
            # Daily breakdown
            created_ms = p.get("createdTime", 0)
            if created_ms:
                day_str = datetime.fromtimestamp(created_ms / 1000, tz=cst).strftime("%Y-%m-%d")
                if day_str not in daily_totals:
                    daily_totals[day_str] = {"amount": 0, "tips": 0, "count": 0}
                daily_totals[day_str]["amount"] += (p.get("amount", 0) + p.get("tipAmount", 0)) / 100
                daily_totals[day_str]["tips"] += p.get("tipAmount", 0) / 100
                daily_totals[day_str]["count"] += 1
        
        # Sort daily totals by date
        daily_chart = [
            {"date": k, "amount": round(v["amount"], 2), "tips": round(v["tips"], 2), "count": v["count"]}
            for k, v in sorted(daily_totals.items())
        ]
        
        # Top clients
        client_totals = {}
        for p in successful:
            name = p.get("cardTransaction", {}).get("cardholderName", "Desconocido") or "Desconocido"
            if name not in client_totals:
                client_totals[name] = {"amount": 0, "count": 0}
            client_totals[name]["amount"] += (p.get("amount", 0) + p.get("tipAmount", 0)) / 100
            client_totals[name]["count"] += 1
        
        top_clients = sorted(
            [{"name": k, "amount": round(v["amount"], 2), "count": v["count"]} for k, v in client_totals.items()],
            key=lambda x: x["amount"], reverse=True
        )[:10]
        
        return {
            "success": True,
            "period": {
                "from": date_from or dt_from.strftime("%Y-%m-%d"),
                "to": date_to or dt_to.strftime("%Y-%m-%d"),
            },
            "today": {
                "total": round(period_total, 2),
                "subtotal": round(period_subtotal, 2),
                "tips": round(period_tips, 2),
                "transactions": period_count,
                "declined": len(declined),
                "refunds": len(refunds),
                "avg_transaction": round(period_total / period_count, 2) if period_count > 0 else 0,
                "card_types": card_types,
                "entry_types": entry_types,
            },
            "daily_chart": daily_chart,
            "top_clients": top_clients,
        }


@clover_router.get("/admin/clover/annual-summary")
async def get_clover_annual_summary(request: Request):
    """Get annual totals for the current year — aggregate all transactions"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from zoneinfo import ZoneInfo
    cst = ZoneInfo("America/Chicago")
    now_cst = datetime.now(cst)
    
    # Year start
    year_start = now_cst.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    from_ms = int(year_start.timestamp() * 1000)
    to_ms = int(now_cst.timestamp() * 1000)
    
    # Today range
    today_start = now_cst.replace(hour=0, minute=0, second=0, microsecond=0)
    today_from_ms = int(today_start.timestamp() * 1000)
    
    all_payments = []
    offset = 0
    
    async with httpx.AsyncClient(timeout=30) as client:
        # Paginate through all payments in the year
        while True:
            r = await client.get(
                f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/payments"
                f"?filter=createdTime>={from_ms}&filter=createdTime<={to_ms}"
                f"&expand=cardTransaction&limit=1000&offset={offset}",
                headers=get_clover_headers()
            )
            if r.status_code != 200:
                break
            elements = r.json().get("elements", [])
            if not elements:
                break
            all_payments.extend(elements)
            if len(elements) < 1000:
                break
            offset += 1000
    
    successful = [p for p in all_payments if p.get("result") == "SUCCESS"]
    
    year_total = sum(p.get("amount", 0) + p.get("tipAmount", 0) for p in successful) / 100
    year_tips = sum(p.get("tipAmount", 0) for p in successful) / 100
    year_count = len(successful)
    
    # Today's totals
    today_payments = [p for p in successful if p.get("createdTime", 0) >= today_from_ms]
    today_total = sum(p.get("amount", 0) + p.get("tipAmount", 0) for p in today_payments) / 100
    today_count = len(today_payments)
    
    # This month
    month_start = now_cst.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_from_ms = int(month_start.timestamp() * 1000)
    month_payments = [p for p in successful if p.get("createdTime", 0) >= month_from_ms]
    month_total = sum(p.get("amount", 0) + p.get("tipAmount", 0) for p in month_payments) / 100
    month_count = len(month_payments)
    
    # This week
    from datetime import timedelta as _td
    week_start = now_cst - _td(days=now_cst.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_from_ms = int(week_start.timestamp() * 1000)
    week_payments = [p for p in successful if p.get("createdTime", 0) >= week_from_ms]
    week_total = sum(p.get("amount", 0) + p.get("tipAmount", 0) for p in week_payments) / 100
    week_count = len(week_payments)
    
    # Monthly breakdown for mini chart
    monthly_breakdown = {}
    for p in successful:
        ts = p.get("createdTime", 0)
        if ts:
            dt = datetime.fromtimestamp(ts / 1000, tz=cst)
            month_key = dt.strftime("%Y-%m")
            month_label = dt.strftime("%b")
            if month_key not in monthly_breakdown:
                monthly_breakdown[month_key] = {"label": month_label, "amount": 0, "count": 0}
            monthly_breakdown[month_key]["amount"] += (p.get("amount", 0) + p.get("tipAmount", 0)) / 100
            monthly_breakdown[month_key]["count"] += 1
    
    monthly_chart = [
        {"month": v["label"], "amount": round(v["amount"], 2), "count": v["count"]}
        for k, v in sorted(monthly_breakdown.items())
    ]
    
    return {
        "success": True,
        "year": now_cst.year,
        "today": {"total": round(today_total, 2), "count": today_count},
        "week": {"total": round(week_total, 2), "count": week_count},
        "month": {"total": round(month_total, 2), "count": month_count},
        "year_totals": {"total": round(year_total, 2), "tips": round(year_tips, 2), "count": year_count},
        "monthly_chart": monthly_chart,
    }



# ==========================================
# CLOVER CLIENT SYNC & CALENDAR INTEGRATION
# ==========================================

@clover_router.get("/admin/clover/sync-status")
async def get_clover_sync_status(request: Request):
    """Get sync status: how many internal clients are linked to Clover"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    total_clients = await _db.users.count_documents({"role": "client"})
    linked_count = await _db.clover_linked_clients.count_documents({})
    
    return {
        "success": True,
        "total_clients": total_clients,
        "synced_to_clover": linked_count,
        "pending_sync": total_clients - linked_count,
        "sync_percentage": round((linked_count / total_clients * 100) if total_clients > 0 else 0, 1)
    }

@clover_router.post("/admin/clover/sync-all-clients")
async def sync_all_clients_to_clover(request: Request):
    """Start background batch sync of all internal clients to Clover"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    # Check if sync is already running
    existing = await _db.clover_sync_progress.find_one({"status": "running"})
    if existing:
        return {
            "success": True,
            "already_running": True,
            "message": "Sincronización ya está en progreso",
            "progress": {
                "synced": existing.get("synced", 0),
                "total": existing.get("total", 0),
                "errors": existing.get("errors", 0),
                "percent": existing.get("percent", 0)
            }
        }
    
    # Count unlinked clients
    linked_ids = set()
    linked_docs = await _db.clover_linked_clients.find({}, {"internal_client_id": 1}).to_list(5000)
    for doc in linked_docs:
        linked_ids.add(doc.get("internal_client_id"))
    
    clients = await _db.users.find({"role": "client"}).to_list(5000)
    unlinked = [c for c in clients if str(c.get("id") or c.get("_id")) not in linked_ids and c.get("name", "").strip()]
    
    total = len(unlinked)
    if total == 0:
        return {"success": True, "synced": 0, "message": "Todos los clientes ya están sincronizados"}
    
    # Create progress tracker
    await _db.clover_sync_progress.delete_many({})
    await _db.clover_sync_progress.insert_one({
        "status": "running",
        "total": total,
        "synced": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
        "percent": 0,
        "started_at": datetime.utcnow().isoformat(),
        "started_by": current_user.get("email", "admin")
    })
    
    # Launch background task
    import asyncio as aio
    aio.create_task(_background_sync_clients(unlinked, current_user.get("email", "admin")))
    
    return {
        "success": True,
        "already_running": False,
        "message": f"Sincronización iniciada para {total} clientes",
        "progress": {"synced": 0, "total": total, "errors": 0, "percent": 0}
    }

async def _background_sync_clients(clients: list, admin_email: str):
    """Background task to sync clients to Clover in batches"""
    import asyncio as aio
    
    total = len(clients)
    synced = 0
    errors_count = 0
    error_details = []
    BATCH_SIZE = 3  # Reduced to avoid rate limits
    
    async with httpx.AsyncClient(timeout=20) as client_http:
        for i in range(0, total, BATCH_SIZE):
            batch = clients[i:i + BATCH_SIZE]
            tasks = [_sync_single_client(client_http, user, admin_email) for user in batch]
            results = await aio.gather(*tasks, return_exceptions=True)
            
            retry_clients = []
            for idx, result in enumerate(results):
                if isinstance(result, Exception):
                    errors_count += 1
                    error_details.append(str(result)[:100])
                elif result.get("success"):
                    synced += 1
                elif result.get("rate_limited"):
                    retry_clients.append(batch[idx])
                else:
                    errors_count += 1
                    error_details.append(result.get("error", "Unknown")[:100])
            
            # Retry rate-limited clients with longer delay
            if retry_clients:
                await aio.sleep(3)
                for user in retry_clients:
                    result = await _sync_single_client(client_http, user, admin_email)
                    if isinstance(result, Exception) or not result.get("success"):
                        errors_count += 1
                        err_msg = str(result) if isinstance(result, Exception) else result.get("error", "Unknown")
                        error_details.append(err_msg[:100])
                    else:
                        synced += 1
                    await aio.sleep(1)
            
            # Update progress
            percent = round((i + len(batch)) / total * 100)
            await _db.clover_sync_progress.update_one(
                {"status": "running"},
                {"$set": {
                    "synced": synced,
                    "errors": errors_count,
                    "error_details": error_details[:20],
                    "percent": percent,
                    "last_batch": i + len(batch)
                }}
            )
            
            # Delay between batches to respect Clover rate limits
            await aio.sleep(1.5)
    
    # Mark as completed
    await _db.clover_sync_progress.update_one(
        {"status": "running"},
        {"$set": {
            "status": "completed",
            "synced": synced,
            "errors": errors_count,
            "percent": 100,
            "completed_at": datetime.utcnow().isoformat()
        }}
    )
    logging.info(f"✅ Clover sync completed: {synced}/{total} synced, {errors_count} errors")

async def _sync_single_client(client_http, user: dict, admin_email: str) -> dict:
    """Sync a single client to Clover"""
    user_id = str(user.get("id") or user.get("_id"))
    name = user.get("name", "").strip()
    name_parts = name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    email = user.get("email", "")
    phone = user.get("phone", "")
    
    try:
        r = await client_http.post(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers",
            headers={**get_clover_headers(), "Content-Type": "application/json"},
            json={"firstName": first_name, "lastName": last_name}
        )
        
        if r.status_code in [200, 201]:
            clover_data = r.json()
            clover_customer_id = clover_data.get("id")
            
            # Add email and phone in parallel
            sub_tasks = []
            if email:
                sub_tasks.append(client_http.post(
                    f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{clover_customer_id}/email_addresses",
                    headers={**get_clover_headers(), "Content-Type": "application/json"},
                    json={"emailAddress": email}
                ))
            if phone:
                clean_phone = ''.join(filter(str.isdigit, phone))
                if clean_phone:
                    sub_tasks.append(client_http.post(
                        f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{clover_customer_id}/phone_numbers",
                        headers={**get_clover_headers(), "Content-Type": "application/json"},
                        json={"phoneNumber": clean_phone}
                    ))
            
            if sub_tasks:
                import asyncio as aio
                await aio.gather(*sub_tasks, return_exceptions=True)
            
            # Save link
            await _db.clover_linked_clients.update_one(
                {"internal_client_id": user_id},
                {"$set": {
                    "clover_customer_id": clover_customer_id,
                    "internal_client_id": user_id,
                    "internal_client_name": name,
                    "internal_client_email": email,
                    "linked_at": datetime.utcnow().isoformat(),
                    "linked_by": admin_email,
                    "auto_synced": True
                }},
                upsert=True
            )
            return {"success": True}
        elif r.status_code == 429:
            return {"success": False, "rate_limited": True, "error": f"{name}: Rate limited"}
        else:
            return {"success": False, "error": f"{name}: HTTP {r.status_code}"}
    except Exception as e:
        return {"success": False, "error": f"{name}: {str(e)}"}

@clover_router.get("/admin/clover/sync-progress")
async def get_clover_sync_progress(request: Request):
    """Get current sync progress"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    progress = await _db.clover_sync_progress.find_one({})
    if not progress:
        return {"status": "idle", "synced": 0, "total": 0, "errors": 0, "percent": 0}
    
    return {
        "status": progress.get("status", "idle"),
        "synced": progress.get("synced", 0),
        "total": progress.get("total", 0),
        "errors": progress.get("errors", 0),
        "error_details": progress.get("error_details", []),
        "percent": progress.get("percent", 0),
        "started_at": progress.get("started_at"),
        "completed_at": progress.get("completed_at")
    }

@clover_router.get("/admin/clover/todays-appointments")
async def get_todays_appointments_for_clover(request: Request):
    """Get today's appointments with Clover sync status"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    # Get today's date range (CST timezone - Texas)
    from zoneinfo import ZoneInfo
    cst = ZoneInfo("America/Chicago")
    now_cst = datetime.now(cst)
    today_str = now_cst.strftime('%Y-%m-%d')
    
    today_start = datetime(now_cst.year, now_cst.month, now_cst.day, 0, 0, 0, tzinfo=cst)
    today_end = datetime(now_cst.year, now_cst.month, now_cst.day, 23, 59, 59, tzinfo=cst)
    
    # Find today's appointments
    appointments = await _db.appointments.find({
        "status": {"$ne": "cancelled"},
        "$or": [
            {"scheduled_at": {"$gte": today_start, "$lte": today_end}},
            {"date": today_str}
        ]
    }).sort("scheduled_at", 1).to_list(100)
    
    result = []
    for apt in appointments:
        apt_id = str(apt.get("id") or apt.get("_id"))
        user_id = str(apt.get("user_id", ""))
        
        # Check if client is linked to Clover
        link = await _db.clover_linked_clients.find_one({"internal_client_id": user_id})
        
        # Check if a Clover order has been created for this appointment
        clover_order = await _db.clover_appointment_orders.find_one({"appointment_id": apt_id})
        
        result.append({
            "appointment_id": apt_id,
            "user_id": user_id,
            "client_name": apt.get("user_name") or apt.get("client_name", "Sin nombre"),
            "client_email": apt.get("user_email", ""),
            "client_phone": apt.get("user_phone", ""),
            "service": apt.get("service_name") or apt.get("title", "Servicio"),
            "time": apt.get("time", ""),
            "scheduled_at": apt.get("scheduled_at").isoformat() if isinstance(apt.get("scheduled_at"), datetime) else str(apt.get("scheduled_at", "")),
            "status": apt.get("status", "scheduled"),
            "duration_minutes": apt.get("duration_minutes", 60),
            "clover_customer_id": link.get("clover_customer_id") if link else None,
            "client_synced_to_clover": link is not None,
            "clover_order_id": clover_order.get("clover_order_id") if clover_order else None,
            "clover_order_status": clover_order.get("status") if clover_order else None,
        })
    
    return {"success": True, "appointments": result, "date": today_str, "total": len(result)}

@clover_router.post("/admin/clover/prepare-appointment/{appointment_id}")
async def prepare_clover_appointment(appointment_id: str, request: Request):
    """Sync client to Clover + create an order for a specific appointment"""
    current_user = await _auth_user(request)
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    
    # Find the appointment
    from bson import ObjectId as BsonObjectId
    query_filter = {"$or": [{"id": appointment_id}]}
    if BsonObjectId.is_valid(appointment_id):
        query_filter["$or"].append({"_id": BsonObjectId(appointment_id)})
    else:
        query_filter["$or"].append({"_id": appointment_id})
    
    appointment = await _db.appointments.find_one(query_filter)
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    user_id = str(appointment.get("user_id", ""))
    client_name = appointment.get("user_name") or appointment.get("client_name", "Cliente")
    client_email = appointment.get("user_email", "")
    client_phone = appointment.get("user_phone", "")
    service_name = appointment.get("service_name") or appointment.get("title", "Servicio")
    apt_time = appointment.get("time", "")
    
    async with httpx.AsyncClient(timeout=15) as client_http:
        # Step 1: Ensure client exists in Clover
        link = await _db.clover_linked_clients.find_one({"internal_client_id": user_id})
        clover_customer_id = link.get("clover_customer_id") if link else None
        
        if not clover_customer_id:
            # Create client in Clover
            name_parts = client_name.split(" ", 1)
            payload = {
                "firstName": name_parts[0],
                "lastName": name_parts[1] if len(name_parts) > 1 else "",
            }
            
            r = await client_http.post(
                f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers",
                headers={**get_clover_headers(), "Content-Type": "application/json"},
                json=payload
            )
            
            if r.status_code not in [200, 201]:
                raise HTTPException(status_code=400, detail=f"Error creando cliente en Clover: {r.status_code}")
            
            clover_data = r.json()
            clover_customer_id = clover_data.get("id")
            
            # Add email
            if client_email:
                try:
                    await client_http.post(
                        f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{clover_customer_id}/email_addresses",
                        headers={**get_clover_headers(), "Content-Type": "application/json"},
                        json={"emailAddress": client_email}
                    )
                except Exception:
                    pass
            
            # Add phone
            if client_phone:
                clean_phone = ''.join(filter(str.isdigit, client_phone))
                if clean_phone:
                    try:
                        await client_http.post(
                            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers/{clover_customer_id}/phone_numbers",
                            headers={**get_clover_headers(), "Content-Type": "application/json"},
                            json={"phoneNumber": clean_phone}
                        )
                    except Exception:
                        pass
            
            # Save link
            await _db.clover_linked_clients.update_one(
                {"internal_client_id": user_id},
                {"$set": {
                    "clover_customer_id": clover_customer_id,
                    "internal_client_id": user_id,
                    "internal_client_name": client_name,
                    "internal_client_email": client_email,
                    "linked_at": datetime.utcnow().isoformat(),
                    "linked_by": current_user.get("email", "admin"),
                    "auto_synced": True
                }},
                upsert=True
            )
        
        # Step 2: Check if order already exists for this appointment
        existing_order = await _db.clover_appointment_orders.find_one({"appointment_id": str(appointment.get("id") or appointment.get("_id"))})
        if existing_order:
            return {
                "success": True,
                "clover_customer_id": clover_customer_id,
                "clover_order_id": existing_order.get("clover_order_id"),
                "message": "La orden de Clover ya existe para esta cita",
                "already_exists": True
            }
        
        # Step 3: Create order in Clover
        order_title = f"{client_name} — {service_name}"
        order_note = f"📅 Cita {apt_time} — {service_name} — {client_name}"
        
        order_r = await client_http.post(
            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders",
            headers={**get_clover_headers(), "Content-Type": "application/json"},
            json={
                "state": "open",
                "title": order_title,
                "note": order_note,
            }
        )
        
        if order_r.status_code not in [200, 201]:
            raise HTTPException(status_code=400, detail=f"Error creando orden en Clover: {order_r.status_code}")
        
        order_data = order_r.json()
        clover_order_id = order_data.get("id")
        
        # Step 3b: Associate customer to order via POST (Clover API requires id in body)
        try:
            await client_http.post(
                f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders/{clover_order_id}",
                headers={**get_clover_headers(), "Content-Type": "application/json"},
                json={"id": clover_order_id, "customer": {"id": clover_customer_id}}
            )
        except Exception as e:
            logger.warning(f"Could not associate customer {clover_customer_id} to order {clover_order_id}: {e}")
        
        # Step 4: Add line item (service)
        try:
            await client_http.post(
                f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders/{clover_order_id}/line_items",
                headers={**get_clover_headers(), "Content-Type": "application/json"},
                json={
                    "name": service_name,
                    "price": 0,  # Price will be set at POS when charging
                    "unitQty": 1,
                    "note": f"Cliente: {client_name} | Hora: {apt_time}"
                }
            )
        except Exception:
            pass
        
        # Save to our DB
        apt_id = str(appointment.get("id") or appointment.get("_id"))
        await _db.clover_appointment_orders.update_one(
            {"appointment_id": apt_id},
            {"$set": {
                "appointment_id": apt_id,
                "clover_order_id": clover_order_id,
                "clover_customer_id": clover_customer_id,
                "client_name": client_name,
                "service_name": service_name,
                "appointment_time": apt_time,
                "status": "open",
                "created_at": datetime.utcnow().isoformat(),
                "created_by": current_user.get("email", "admin")
            }},
            upsert=True
        )
        
        return {
            "success": True,
            "clover_customer_id": clover_customer_id,
            "clover_order_id": clover_order_id,
            "client_name": client_name,
            "message": f"Orden creada en Clover para {client_name} ({service_name})",
            "already_exists": False
        }

@clover_router.post("/admin/clover/prepare-all-today")
async def prepare_all_todays_appointments(request: Request):
    """Sync all today's appointments to Clover (clients + orders)"""
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    from zoneinfo import ZoneInfo
    cst = ZoneInfo("America/Chicago")
    now_cst = datetime.now(cst)
    today_str = now_cst.strftime('%Y-%m-%d')
    today_start = datetime(now_cst.year, now_cst.month, now_cst.day, 0, 0, 0, tzinfo=cst)
    today_end = datetime(now_cst.year, now_cst.month, now_cst.day, 23, 59, 59, tzinfo=cst)
    
    appointments = await _db.appointments.find({
        "status": {"$ne": "cancelled"},
        "$or": [
            {"scheduled_at": {"$gte": today_start, "$lte": today_end}},
            {"date": today_str}
        ]
    }).sort("scheduled_at", 1).to_list(100)
    
    prepared = 0
    already_existed = 0
    errors_list = []
    
    for apt in appointments:
        apt_id = str(apt.get("id") or apt.get("_id"))
        try:
            # Use the same prepare logic via internal call
            from starlette.testclient import TestClient
            # Direct DB logic instead of calling endpoint
            existing_order = await _db.clover_appointment_orders.find_one({"appointment_id": apt_id})
            if existing_order:
                already_existed += 1
                continue
            
            user_id = str(apt.get("user_id", ""))
            client_name = apt.get("user_name") or apt.get("client_name", "Cliente")
            client_email = apt.get("user_email", "")
            client_phone = apt.get("user_phone", "")
            service_name = apt.get("service_name") or apt.get("title", "Servicio")
            apt_time = apt.get("time", "")
            
            async with httpx.AsyncClient(timeout=15) as client_http:
                # Ensure client in Clover
                link = await _db.clover_linked_clients.find_one({"internal_client_id": user_id})
                clover_customer_id = link.get("clover_customer_id") if link else None
                
                if not clover_customer_id:
                    name_parts = client_name.split(" ", 1)
                    r = await client_http.post(
                        f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/customers",
                        headers={**get_clover_headers(), "Content-Type": "application/json"},
                        json={"firstName": name_parts[0], "lastName": name_parts[1] if len(name_parts) > 1 else ""}
                    )
                    if r.status_code in [200, 201]:
                        clover_customer_id = r.json().get("id")
                        await _db.clover_linked_clients.update_one(
                            {"internal_client_id": user_id},
                            {"$set": {
                                "clover_customer_id": clover_customer_id,
                                "internal_client_id": user_id,
                                "internal_client_name": client_name,
                                "linked_at": datetime.utcnow().isoformat(),
                                "auto_synced": True
                            }},
                            upsert=True
                        )
                    else:
                        errors_list.append(f"{client_name}: Error {r.status_code}")
                        continue
                
                # Create order
                order_title = f"{client_name} — {service_name}"
                order_note = f"📅 Cita {apt_time} — {service_name} — {client_name}"
                order_r = await client_http.post(
                    f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders",
                    headers={**get_clover_headers(), "Content-Type": "application/json"},
                    json={"state": "open", "title": order_title, "note": order_note}
                )
                
                if order_r.status_code in [200, 201]:
                    clover_order_id = order_r.json().get("id")
                    
                    # Associate customer with order via POST (Clover requires id in body)
                    try:
                        await client_http.post(
                            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders/{clover_order_id}",
                            headers={**get_clover_headers(), "Content-Type": "application/json"},
                            json={"id": clover_order_id, "customer": {"id": clover_customer_id}}
                        )
                    except Exception as e:
                        logger.warning(f"Could not associate customer to order: {e}")
                    
                    # Add line item
                    try:
                        await client_http.post(
                            f"{CLOVER_API_URL}/v3/merchants/{CLOVER_MERCHANT_ID}/orders/{clover_order_id}/line_items",
                            headers={**get_clover_headers(), "Content-Type": "application/json"},
                            json={"name": service_name, "price": 0, "unitQty": 1, "note": f"{client_name} | {apt_time}"}
                        )
                    except Exception:
                        pass
                    
                    await _db.clover_appointment_orders.update_one(
                        {"appointment_id": apt_id},
                        {"$set": {
                            "appointment_id": apt_id,
                            "clover_order_id": clover_order_id,
                            "clover_customer_id": clover_customer_id,
                            "client_name": client_name,
                            "service_name": service_name,
                            "appointment_time": apt_time,
                            "status": "open",
                            "created_at": datetime.utcnow().isoformat(),
                            "created_by": current_user.get("email", "admin")
                        }},
                        upsert=True
                    )
                    prepared += 1
                else:
                    errors_list.append(f"{client_name}: Order error {order_r.status_code}")
            
            import asyncio
            await asyncio.sleep(0.3)
        except Exception as e:
            errors_list.append(f"{apt_id}: {str(e)}")
    
    return {
        "success": True,
        "prepared": prepared,
        "already_existed": already_existed,
        "errors": len(errors_list),
        "error_details": errors_list[:10],
        "message": f"Preparadas {prepared} citas del día en Clover"
    }


# ==========================================
# BARCODE GENERATION FOR CLOVER POS
# ==========================================

@clover_router.get("/admin/clover/barcode/{charge_id}")
async def get_charge_barcode(charge_id: str, request: Request):
    """
    Genera un código de barras Code128 para un cargo de Clover.
    El código puede escanearse con el dispositivo Clover POS para encontrar la operación.
    Retorna la imagen en base64.
    """
    from invoice_pdf_service import InvoicePDFService
    
    current_user = await _auth_user(request)
    _require_admin(current_user)
    
    # Verificar que el charge existe
    charge = await _db.clover_charges.find_one({"charge_id": charge_id})
    if not charge:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    
    # Generar barcode con el charge_id
    barcode_base64 = InvoicePDFService.generate_barcode_base64(charge_id)
    if not barcode_base64:
        raise HTTPException(status_code=500, detail="Error generando código de barras")
    
    return {
        "success": True,
        "charge_id": charge_id,
        "barcode_base64": barcode_base64,
        "barcode_data": charge_id,
        "customer_name": charge.get("customer_name", ""),
        "amount": charge.get("amount", 0),
        "card_last4": charge.get("card_last4", ""),
        "created_at": charge.get("created_at", ""),
    }


@clover_router.post("/admin/clover/barcode/generate")
async def generate_custom_barcode(request: Request):
    """
    Genera un código de barras personalizado.
    Acepta cualquier texto/referencia y devuelve la imagen en base64.
    Útil para generar barcodes para órdenes, facturas, etc.
    """
    from invoice_pdf_service import InvoicePDFService
    
    current_user = await _auth_user(request)
    _require_admin(current_user)
    
    data = await request.json()
    barcode_data = data.get("data", "")
    barcode_type = data.get("type", "code128")
    label = data.get("label", "")
    
    if not barcode_data:
        raise HTTPException(status_code=400, detail="'data' es requerido")
    
    barcode_base64 = InvoicePDFService.generate_barcode_base64(barcode_data, barcode_type)
    if not barcode_base64:
        raise HTTPException(status_code=500, detail="Error generando código de barras")
    
    # Guardar registro del barcode generado
    barcode_record = {
        "barcode_data": barcode_data,
        "barcode_type": barcode_type,
        "label": label,
        "generated_by": current_user.get("email", "admin"),
        "created_at": datetime.utcnow().isoformat(),
    }
    await _db.generated_barcodes.insert_one(barcode_record)
    
    return {
        "success": True,
        "barcode_base64": barcode_base64,
        "barcode_data": barcode_data,
        "barcode_type": barcode_type,
        "label": label,
    }


@clover_router.get("/admin/clover/barcode/search/{barcode_data}")
async def search_by_barcode(barcode_data: str, request: Request):
    """
    Busca un cargo/orden por el dato del código de barras.
    Permite encontrar rápidamente una transacción escaneando el barcode.
    """
    current_user = await _auth_user(request)
    _require_admin(current_user)
    
    results = []
    
    # Buscar en charges de Clover
    charge = await _db.clover_charges.find_one({"charge_id": barcode_data})
    if charge:
        charge['_id'] = str(charge['_id'])
        results.append({
            "type": "clover_charge",
            "data": charge,
        })
    
    # Buscar en órdenes de Clover
    order = await _db.clover_orders.find_one({"order_id": barcode_data})
    if order:
        order['_id'] = str(order['_id'])
        results.append({
            "type": "clover_order",
            "data": order,
        })
    
    # Buscar en facturas
    invoice = await _db.invoices.find_one({"invoice_number": barcode_data})
    if invoice:
        invoice['_id'] = str(invoice['_id'])
        results.append({
            "type": "invoice",
            "data": invoice,
        })
    
    # Buscar en barcodes generados
    generated = await _db.generated_barcodes.find_one({"barcode_data": barcode_data})
    if generated:
        generated['_id'] = str(generated['_id'])
        results.append({
            "type": "generated_barcode",
            "data": generated,
        })
    
    if not results:
        raise HTTPException(status_code=404, detail="No se encontró ningún registro con ese código")
    
    return {
        "success": True,
        "barcode_data": barcode_data,
        "results_count": len(results),
        "results": results,
    }


@clover_router.get("/admin/clover/barcode/image/{charge_id}")
async def get_barcode_image(charge_id: str, request: Request):
    """
    Devuelve la imagen del código de barras directamente como PNG.
    Útil para descargar o imprimir directamente.
    """
    from invoice_pdf_service import InvoicePDFService
    from fastapi.responses import StreamingResponse
    
    current_user = await _auth_user(request)
    _require_admin(current_user)
    
    barcode_buffer = InvoicePDFService.generate_barcode(charge_id)
    if not barcode_buffer:
        raise HTTPException(status_code=500, detail="Error generando código de barras")
    
    return StreamingResponse(
        barcode_buffer,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=barcode_{charge_id}.png"}
    )

