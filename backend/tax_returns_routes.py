"""
Tax Returns Routes Router
Extracted from server.py for modularization.
Handles completed tax returns, admin tax returns management, and client declarations.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, BackgroundTasks
from pydantic import BaseModel, Field
from bson import ObjectId


class CompletedTaxReturn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ''
    tax_return_id: str = ''
    tax_year: int = 0
    filing_status: str = 'single'
    total_income: Optional[float] = None
    total_deductions: Optional[float] = None
    tax_owed: Optional[float] = None
    refund_amount: Optional[float] = None
    federal_return_pdf: Optional[str] = None
    state_return_pdf: Optional[str] = None
    filed_date: Optional[datetime] = None
    completed_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

logger = logging.getLogger(__name__)

tax_returns_router = APIRouter()
_db = None


def init_tax_returns_router(db):
    global _db
    _db = db

# ================== Auth helpers ==================

async def _auth_user(request: Request):
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        try:
            from bson import ObjectId as OID
            user = await _db.users.find_one({'_id': OID(session['user_id'])})
        except:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = user_dict.get('id', str(user_dict.get('_id', '')))
    if '_id' in user_dict:
        user_dict['_id'] = str(user_dict['_id'])
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

# ================== COMPLETED TAX RETURNS ROUTES ==================

@tax_returns_router.get('/tax-returns/completed')
async def get_completed_tax_returns(request: Request):
    """Get all completed tax returns for the current user"""
    current_user = await _auth_user(request)
    try:
        print(f'📋 GET completed tax returns for user: {current_user.get("email")} (ID: {current_user["id"]})')
        
        query = {'user_id': current_user['id']}
        completed = await _db.completed_tax_returns.find(query).sort('tax_year', -1).to_list(100)
        
        print(f'📋 Found {len(completed)} completed tax returns')
        
        # Serialize and remove PDF data from list view for performance
        result = []
        for item in completed:
            try:
                # Convert datetime objects to strings
                serialized = {
                    'id': item.get('id'),
                    'user_id': item.get('user_id'),
                    'tax_return_id': item.get('tax_return_id'),
                    'tax_year': item.get('tax_year'),
                    'filing_status': item.get('filing_status'),
                    'total_income': item.get('total_income'),
                    'tax_owed': item.get('tax_owed'),
                    'refund_amount': item.get('refund_amount'),
                    'completed_by': item.get('completed_by'),
                    'filed_date': item.get('filed_date').isoformat() if item.get('filed_date') else None,
                    'created_at': item.get('created_at').isoformat() if item.get('created_at') else None,
                    'updated_at': item.get('updated_at').isoformat() if item.get('updated_at') else None,
                    'has_federal_pdf': bool(item.get('federal_return_pdf')),
                    'has_state_pdf': bool(item.get('state_return_pdf'))
                }
                result.append(serialized)
            except Exception as e:
                print(f'❌ Error serializing item: {str(e)}')
                print(f'Item keys: {list(item.keys())}')
                continue
        
        print(f'📋 Returning {len(result)} serialized returns')
        return result
    except Exception as e:
        print(f'❌ Error in get_completed_tax_returns: {str(e)}')
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@tax_returns_router.get('/tax-returns/completed/{return_id}')
async def get_completed_tax_return(return_id: str, request: Request):
    """Get a specific completed tax return with all details"""
    current_user = await _auth_user(request)
    completed = await _db.completed_tax_returns.find_one({'id': return_id, 'user_id': current_user['id']})
    
    if not completed:
        raise HTTPException(status_code=404, detail='Tax return not found')
    
    # Remove PDF data, use download endpoint for that
    completed['has_federal_pdf'] = bool(completed.get('federal_return_pdf'))
    completed['has_state_pdf'] = bool(completed.get('state_return_pdf'))
    completed.pop('federal_return_pdf', None)
    completed.pop('state_return_pdf', None)
    
    return completed

@tax_returns_router.get('/tax-returns/completed/{return_id}/download/{doc_type}')
async def download_tax_return(return_id: str, doc_type: str, request: Request):
    """Download federal or state tax return PDF"""
    current_user = await _auth_user(request)
    print(f'📥 Download request: return_id={return_id}, doc_type={doc_type}, user={current_user.get("email")}')
    
    if doc_type not in ['federal', 'state']:
        raise HTTPException(status_code=400, detail='Invalid document type. Use federal or state')
    
    completed = await _db.completed_tax_returns.find_one({'id': return_id, 'user_id': current_user['id']})
    
    if not completed:
        print(f'❌ Tax return not found: {return_id} for user {current_user["id"]}')
        raise HTTPException(status_code=404, detail='Tax return not found')
    
    pdf_field = f'{doc_type}_return_pdf'
    pdf_data = completed.get(pdf_field)
    
    if not pdf_data:
        print(f'❌ PDF not available: {pdf_field}')
        raise HTTPException(status_code=404, detail=f'{doc_type.capitalize()} return not available')
    
    print(f'✅ PDF found, length: {len(pdf_data)} chars')
    
    # Clean the base64 data (remove data URI prefix if present)
    if pdf_data.startswith('data:'):
        pdf_data = pdf_data.split(',')[1]
        print(f'📄 Cleaned data URI prefix, new length: {len(pdf_data)}')
    
    return {
        'pdf_data': pdf_data,
        'filename': f'tax_return_{completed["tax_year"]}_{doc_type}.pdf',
        'tax_year': completed['tax_year']
    }

@tax_returns_router.post('/tax-returns/completed')
async def upload_completed_tax_return(
    completed: CompletedTaxReturn,
    request: Request
):
    current_user = await _auth_user(request)

    """Upload a completed tax return (Admin/Staff only for now)"""
    # In production, add role check: if current_user['role'] not in ['admin', 'staff']:
    
    # Check if tax return exists
    tax_return = await _db.tax_returns.find_one({'id': completed.tax_return_id})
    if not tax_return:
        raise HTTPException(status_code=404, detail='Tax return not found')
    
    # Set user_id from tax_return
    completed.user_id = tax_return['user_id']
    completed.completed_by = current_user['name']
    
    # Check if already exists
    existing = await _db.completed_tax_returns.find_one({
        'tax_return_id': completed.tax_return_id
    })
    
    if existing:
        # Update existing
        completed_dict = completed.dict()
        completed_dict['updated_at'] = datetime.now(timezone.utc)
        await _db.completed_tax_returns.update_one(
            {'id': existing['id']},
            {'$set': completed_dict}
        )
        return {'message': 'Tax return updated', 'id': existing['id']}
    else:
        # Insert new
        await _db.completed_tax_returns.insert_one(completed.dict())
        
        # Update tax return status
        await _db.tax_returns.update_one(
            {'id': completed.tax_return_id},
            {'$set': {'status': 'completed', 'updated_at': datetime.now(timezone.utc)}}
        )
        
        return {'message': 'Tax return uploaded successfully', 'id': completed.id}



@tax_returns_router.put('/admin/tax-returns/{return_id}/status')
async def update_tax_return_status(
    return_id: str,
    request: Request,
):
    """Update the status of a tax return across any of the 3 collections"""
    try:
        body = await request.json()
    except:
        body = {}
    
    new_status = body.get('status', 'completed')
    
    updated = False
    
    # Try completed_tax_returns first
    result = await _db.completed_tax_returns.update_one(
        {'id': return_id},
        {'$set': {'status': new_status, 'updated_at': datetime.utcnow()}}
    )
    if result.modified_count > 0:
        updated = True
    
    if not updated:
        # Try admin_tax_returns
        result = await _db.admin_tax_returns.update_one(
            {'id': return_id},
            {'$set': {'status': new_status, 'updated_at': datetime.utcnow()}}
        )
        if result.modified_count > 0:
            updated = True
    
    if not updated:
        # Try by ObjectId
        from bson import ObjectId
        if ObjectId.is_valid(return_id):
            for coll_name in ['completed_tax_returns', 'admin_tax_returns', 'tax_declarations']:
                coll = _db[coll_name]
                result = await coll.update_one(
                    {'_id': ObjectId(return_id)},
                    {'$set': {'status': new_status, 'updated_at': datetime.utcnow()}}
                )
                if result.modified_count > 0:
                    updated = True
                    break
    
    if not updated:
        raise HTTPException(status_code=404, detail='Tax return not found')
    
    return {'message': 'Status updated', 'status': new_status}



@tax_returns_router.get('/admin/completed-tax-returns')
async def get_admin_completed_tax_returns(
    request: Request,
    limit: int = Query(1000, ge=1, le=2000),
):
    """Get all tax returns from all 3 collections (unified view for admin)"""
    try:
        result = []
        seen_keys = set()  # Avoid duplicates by (user_id, tax_year)

        # ===== 1. completed_tax_returns =====
        completed = await _db.completed_tax_returns.find({}).sort('created_at', -1).to_list(limit)
        for r in completed:
            uid = r.get('user_id', '')
            key = f"{uid}_{r.get('tax_year')}_completed"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            result.append({
                'id': r.get('id', str(r.get('_id'))),
                'user_id': uid,
                'user_name': r.get('user_name', ''),
                'user_email': r.get('user_email', ''),
                'tax_year': r.get('tax_year'),
                'filing_status': r.get('filing_status'),
                'total_income': r.get('total_income'),
                'tax_owed': r.get('tax_owed'),
                'refund_amount': r.get('refund_amount'),
                'has_federal_pdf': bool(r.get('federal_return_pdf')),
                'has_state_pdf': bool(r.get('state_return_pdf')),
                'completed_by': r.get('completed_by', 'Admin'),
                'status': r.get('status', 'completed'),
                'source': 'completed_tax_returns',
                'filed_date': r.get('filed_date').isoformat() if r.get('filed_date') else None,
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
            })

        # ===== 2. admin_tax_returns (from complete-service flow) =====
        admin_returns = await _db.admin_tax_returns.find({}).sort('created_at', -1).to_list(limit)
        for r in admin_returns:
            uid = r.get('client_id', '')
            key = f"{uid}_{r.get('tax_year')}_admin"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            result.append({
                'id': r.get('id', str(r.get('_id'))),
                'user_id': uid,
                'user_name': r.get('client_name', ''),
                'user_email': r.get('client_email', ''),
                'tax_year': r.get('tax_year'),
                'filing_status': r.get('filing_status', ''),
                'total_income': r.get('total_income'),
                'tax_owed': r.get('tax_owed'),
                'refund_amount': r.get('refund_amount') or ((r.get('federal_refund') or 0) + (r.get('state_refund') or 0)),
                'has_federal_pdf': False,
                'has_state_pdf': False,
                'completed_by': r.get('created_by', 'Admin'),
                'status': r.get('status', 'submitted'),
                'source': 'admin_tax_returns',
                'filed_date': r.get('submitted_at', r.get('created_at')).isoformat() if r.get('submitted_at') or r.get('created_at') else None,
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
            })

        # ===== 3. tax_declarations (PDF uploads) =====
        declarations = await _db.tax_declarations.find({'status': 'active'}).sort('created_at', -1).to_list(limit)
        for r in declarations:
            uid = r.get('user_id', '')
            key = f"{uid}_{r.get('tax_year')}_decl"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            result.append({
                'id': r.get('id', str(r.get('_id'))),
                'user_id': uid,
                'user_name': '',
                'user_email': '',
                'tax_year': r.get('tax_year'),
                'filing_status': '',
                'total_income': None,
                'tax_owed': None,
                'refund_amount': None,
                'has_federal_pdf': bool(r.get('pdf_data')),
                'has_state_pdf': False,
                'completed_by': r.get('uploaded_by_name', 'Admin'),
                'status': 'completed',
                'source': 'tax_declarations',
                'filed_date': r.get('created_at').isoformat() if r.get('created_at') else None,
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
            })

        # Enrich all results with user names from users collection
        all_user_ids = list(set(r['user_id'] for r in result if r['user_id']))
        user_map = {}
        if all_user_ids:
            # Search by string _id
            async for user in _db.users.find({'_id': {'$in': all_user_ids}}, {'_id': 1, 'first_name': 1, 'last_name': 1, 'full_name': 1, 'name': 1, 'email': 1}):
                uid_str = str(user['_id'])
                user_map[uid_str] = {
                    'name': user.get('full_name') or user.get('name') or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                    'email': user.get('email', '')
                }
            # Also try by 'id' field
            async for user in _db.users.find({'id': {'$in': all_user_ids}}, {'id': 1, 'first_name': 1, 'last_name': 1, 'full_name': 1, 'name': 1, 'email': 1}):
                uid_str = user.get('id', str(user['_id']))
                if uid_str not in user_map:
                    user_map[uid_str] = {
                        'name': user.get('full_name') or user.get('name') or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        'email': user.get('email', '')
                    }
            # Also try ObjectId lookup
            from bson import ObjectId
            oid_list = []
            for uid in all_user_ids:
                if ObjectId.is_valid(uid):
                    oid_list.append(ObjectId(uid))
            if oid_list:
                async for user in _db.users.find({'_id': {'$in': oid_list}}, {'_id': 1, 'first_name': 1, 'last_name': 1, 'full_name': 1, 'name': 1, 'email': 1}):
                    uid_str = str(user['_id'])
                    if uid_str not in user_map:
                        user_map[uid_str] = {
                            'name': user.get('full_name') or user.get('name') or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                            'email': user.get('email', '')
                        }

        # Apply enriched names
        for r in result:
            uid = r['user_id']
            if uid in user_map:
                if not r['user_name']:
                    r['user_name'] = user_map[uid].get('name', 'N/A')
                if not r['user_email']:
                    r['user_email'] = user_map[uid].get('email', '')

        # Sort all results by created_at descending
        result.sort(key=lambda x: x.get('created_at') or '', reverse=True)

        return {'returns': result[:limit]}
    except Exception as e:
        logging.error(f'Error getting admin completed tax returns: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@tax_returns_router.post('/admin/tax-returns/upload')
async def admin_upload_tax_return(
    request: Request,
):
    current_user = await _require_admin(request)

    """Admin endpoint to upload tax return directly for a user"""
    request_data = await request.json()
    print(f'📥 ADMIN TAX RETURN UPLOAD - User: {current_user.get("email")}')
    print(f'📥 Request keys: {list(request_data.keys())}')
    print(f'📥 user_id: {request_data.get("user_id")}')
    print(f'📥 tax_year: {request_data.get("tax_year")}')
    print(f'📥 Has federal PDF: {request_data.get("federal_return_pdf") is not None}')
    print(f'📥 Has state PDF: {request_data.get("state_return_pdf") is not None}')
    
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    
    # Validate required fields
    if not request_data.get('user_id'):
        print('❌ Missing user_id')
        raise HTTPException(status_code=400, detail='user_id is required')
    if not request_data.get('tax_year'):
        print('❌ Missing tax_year')
        raise HTTPException(status_code=400, detail='tax_year is required')
    
    try:
        # Check if a completed tax return already exists for this user and year
        existing = await _db.completed_tax_returns.find_one({
            'user_id': request_data['user_id'],
            'tax_year': request_data['tax_year']
        })
        
        if existing:
            # Update existing return instead of creating new one
            print(f'⚠️ Tax return already exists for year {request_data["tax_year"]}, updating...')
            
            update_data = {
                'filing_status': request_data.get('filing_status', 'single'),
                'total_income': request_data.get('total_income'),
                'tax_owed': request_data.get('tax_owed'),
                'refund_amount': request_data.get('refund_amount'),
                'federal_return_pdf': request_data.get('federal_return_pdf'),
                'state_return_pdf': request_data.get('state_return_pdf'),
                'completed_by': current_user.get('name', 'Admin'),
                'filed_date': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            
            await _db.completed_tax_returns.update_one(
                {'id': existing['id']},
                {'$set': update_data}
            )
            
            print(f'✅ Tax return updated: {existing["id"]}')
            
            return {
                'message': 'Tax return updated successfully',
                'id': existing['id'],
                'tax_return_id': existing.get('tax_return_id')
            }
        
        # Create new tax return entry
        tax_return_id = str(uuid.uuid4())
        tax_return = {
            'id': tax_return_id,
            'user_id': request_data['user_id'],
            'tax_year': request_data['tax_year'],
            'status': 'completed',
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        await _db.tax_returns.insert_one(tax_return)
        print(f'✅ Tax return created: {tax_return_id}')
        
        # Create completed tax return
        completed_return = {
            'id': str(uuid.uuid4()),
            'user_id': request_data['user_id'],
            'tax_return_id': tax_return_id,
            'tax_year': request_data['tax_year'],
            'filing_status': request_data.get('filing_status', 'single'),
            'total_income': request_data.get('total_income'),
            'tax_owed': request_data.get('tax_owed'),
            'refund_amount': request_data.get('refund_amount'),
            'federal_return_pdf': request_data.get('federal_return_pdf'),
            'state_return_pdf': request_data.get('state_return_pdf'),
            'completed_by': current_user.get('name', 'Admin'),
            'filed_date': datetime.now(timezone.utc),
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        await _db.completed_tax_returns.insert_one(completed_return)
        print(f'✅ Completed return created: {completed_return["id"]}')
        
        # Send WhatsApp notification for tax return ready
        try:
            from whatsapp_automation_service import get_whatsapp_automation
            wa_automation = get_whatsapp_automation()
            if wa_automation:
                refund_amount = request_data.get('refund_amount')
                tax_owed = request_data.get('tax_owed')
                # Use refund or negative tax_owed
                final_amount = refund_amount if refund_amount else (-tax_owed if tax_owed else None)
                
                wa_result = await wa_automation.send_tax_return_ready(
                    user_id=request_data['user_id'],
                    tax_year=request_data['tax_year'],
                    refund_amount=final_amount
                )
                if wa_result.get('success'):
                    print(f"✅ WhatsApp notification sent for tax return {completed_return['id']}")
                else:
                    print(f"⚠️ WhatsApp notification failed: {wa_result.get('error')}")
        except Exception as wa_error:
            print(f"❌ Error sending WhatsApp tax return notification: {str(wa_error)}")
        
        return {
            'message': 'Tax return uploaded successfully',
            'id': completed_return['id'],
            'tax_return_id': tax_return_id
        }
    except Exception as e:
        print(f'❌ Error in admin_upload_tax_return: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN TAX RETURNS MANAGEMENT ==================

@tax_returns_router.get('/admin/tax-returns')
async def get_admin_tax_returns(
    request: Request,
    status: Optional[str] = Query(None),
    tax_year: Optional[str] = Query(None),
    limit: int = Query(100,
    ge=1,
    le=500)
):
    """Get all tax returns for admin management (Declaraciones)"""
    try:
        query = {}
        if status:
            query['status'] = status
        if tax_year:
            query['tax_year'] = tax_year
        
        returns = await _db.admin_tax_returns.find(query).sort('created_at', -1).to_list(limit)
        
        result = []
        for r in returns:
            item = {
                'id': str(r.get('_id', r.get('id'))),
                'client_id': r.get('client_id'),
                'client_name': r.get('client_name'),
                'client_email': r.get('client_email'),
                'client_phone': r.get('client_phone'),
                'tax_year': r.get('tax_year'),
                'status': r.get('status', 'pending'),
                'refund_amount': r.get('refund_amount'),
                'submitted_at': r.get('submitted_at').isoformat() if r.get('submitted_at') else None,
                'accepted_at': r.get('accepted_at').isoformat() if r.get('accepted_at') else None,
                'rejected_at': r.get('rejected_at').isoformat() if r.get('rejected_at') else None,
                'rejection_reason': r.get('rejection_reason'),
                'notes': r.get('notes'),
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
            }
            result.append(item)
        
        return {'tax_returns': result}
    except Exception as e:
        logging.error(f'Error getting admin tax returns: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@tax_returns_router.post('/admin/tax-returns')
async def create_admin_tax_return(
    request_data: dict = Body(...),
    request: Request = None
):
    current_user = await _require_admin(request)

    """Create a new tax return entry for client management"""
    try:
        tax_return_id = str(uuid.uuid4())
        
        tax_return = {
            'id': tax_return_id,
            'client_id': request_data.get('client_id'),
            'client_name': request_data.get('client_name'),
            'client_email': request_data.get('client_email'),
            'client_phone': request_data.get('client_phone'),
            'tax_year': request_data.get('tax_year', '2025'),
            'status': request_data.get('status', 'pending'),
            'refund_amount': request_data.get('refund_amount'),
            'notes': request_data.get('notes'),
            'created_by': current_user.get('name', 'Admin'),
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }
        
        await _db.admin_tax_returns.insert_one(tax_return)
        logging.info(f'✅ Admin tax return created: {tax_return_id} for client {request_data.get("client_name")}')
        
        return {'success': True, 'id': tax_return_id, 'tax_return': tax_return}
    except Exception as e:
        logging.error(f'Error creating admin tax return: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@tax_returns_router.patch('/admin/tax-returns/{return_id}')
async def update_admin_tax_return(
    return_id: str,
    request_data: dict = Body(...),
    request: Request = None
):
    """Update a tax return status"""
    try:
        # Find the return
        tax_return = await _db.admin_tax_returns.find_one({'id': return_id})
        if not tax_return:
            # Try with _id
            from bson import ObjectId
            if ObjectId.is_valid(return_id):
                tax_return = await _db.admin_tax_returns.find_one({'_id': ObjectId(return_id)})
        
        if not tax_return:
            raise HTTPException(status_code=404, detail='Tax return not found')
        
        update_data = {'updated_at': datetime.now(timezone.utc)}
        
        # Update allowed fields
        for field in ['status', 'refund_amount', 'notes', 'submitted_at']:
            if field in request_data:
                if field == 'submitted_at' and request_data[field]:
                    update_data[field] = datetime.now(timezone.utc)
                else:
                    update_data[field] = request_data[field]
        
        await _db.admin_tax_returns.update_one(
            {'id': return_id},
            {'$set': update_data}
        )
        
        logging.info(f'✅ Admin tax return updated: {return_id}')
        return {'success': True, 'message': 'Tax return updated'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error updating admin tax return: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@tax_returns_router.post('/admin/tax-returns/{return_id}/accept')
async def accept_tax_return(
    return_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    request_data: dict = Body(...)
):
    current_user = await _require_admin(request)

    """Mark tax return as accepted by IRS and send notifications to client"""
    try:
        logging.info(f'📋 Accept tax return request: {return_id}')
        
        # Find the return
        tax_return = await _db.admin_tax_returns.find_one({'id': return_id})
        if not tax_return:
            from bson import ObjectId
            if ObjectId.is_valid(return_id):
                tax_return = await _db.admin_tax_returns.find_one({'_id': ObjectId(return_id)})
        
        if not tax_return:
            raise HTTPException(status_code=404, detail='Tax return not found')
        
        # Update status
        await _db.admin_tax_returns.update_one(
            {'id': return_id},
            {'$set': {
                'status': 'accepted',
                'accepted_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'accepted_by': current_user.get('name', 'Admin')
            }}
        )
        
        client_name = tax_return.get('client_name', 'Cliente')
        client_email = tax_return.get('client_email')
        client_phone = tax_return.get('client_phone')
        tax_year = tax_return.get('tax_year', '2025')
        refund_amount = tax_return.get('refund_amount')
        
        # Get first name
        first_name = client_name.split()[0] if client_name else 'Cliente'
        
        # Format refund
        refund_text = f"${refund_amount:,.2f}" if refund_amount else "su reembolso"
        
        notifications_sent = {'sms': False, 'email': False}
        
        # Send notifications if requested
        if request_data.get('send_notifications', True):
            try:
                config_doc = await _db.api_config.find_one({'_id': 'main'})
                if config_doc:
                    from notification_service import NotificationService
                    notif_service = NotificationService(config_doc)
                    
                    # Send SMS
                    if client_phone and notif_service.twilio_client:
                        sms_message = f"""🎉 ¡Excelentes noticias, {first_name}!

Su declaración de impuestos {tax_year} ha sido ACEPTADA por el IRS.

💰 Reembolso estimado: {refund_text}
📅 Tiempo estimado de depósito: 10-21 días

Recibirá su depósito directo en la cuenta bancaria registrada.

¿Preguntas? Llámenos: (806) 934-2018

Ross Tax Preparation
¡Gracias por confiar en nosotros! 🙏"""
                        
                        try:
                            message = notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=client_phone
                            )
                            notifications_sent['sms'] = True
                            logging.info(f'✅ SMS de aceptación enviado a {client_phone}')
                        except Exception as sms_error:
                            logging.error(f'❌ Error enviando SMS: {sms_error}')
                    
                    # Send Email
                    if client_email and notif_service.sendgrid_client:
                        email_html = f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">🎉 ¡Felicidades!</h1>
                                <p style="margin: 10px 0 0 0; font-size: 18px;">Su declaración fue aceptada</p>
                            </div>
                            
                            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Hola {first_name},</h2>
                                
                                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                    Nos complace informarle que su declaración de impuestos del año fiscal <strong>{tax_year}</strong> 
                                    ha sido <strong style="color: #10B981;">ACEPTADA</strong> por el IRS.
                                </p>
                                
                                <div style="background-color: #D1FAE5; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
                                    <p style="margin: 0; color: #065F46; font-size: 14px;">Reembolso Estimado</p>
                                    <p style="margin: 10px 0 0 0; color: #047857; font-size: 32px; font-weight: bold;">{refund_text}</p>
                                </div>
                                
                                <div style="background-color: #fff; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
                                    <h3 style="color: #333; margin-top: 0;">📅 ¿Cuándo recibiré mi reembolso?</h3>
                                    <p style="color: #555; margin-bottom: 0;">
                                        El IRS generalmente procesa los reembolsos en <strong>10 a 21 días hábiles</strong> 
                                        si eligió depósito directo. Recibirá el dinero directamente en su cuenta bancaria registrada.
                                    </p>
                                </div>
                                
                                <div style="background-color: #EFF6FF; border-radius: 8px; padding: 15px; margin: 20px 0;">
                                    <h4 style="color: #1E40AF; margin-top: 0;">💡 Puede rastrear su reembolso</h4>
                                    <p style="color: #555; margin-bottom: 10px;">Visite el sitio oficial del IRS:</p>
                                    <a href="https://www.irs.gov/refunds" style="display: inline-block; background-color: #1E40AF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                                        Rastrear mi Reembolso
                                    </a>
                                </div>
                                
                                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                
                                <p style="color: #888; font-size: 14px; text-align: center;">
                                    ¿Preguntas? Llámenos al <strong>(806) 934-2018</strong><br>
                                    Ross Tax Preparation | 305 Bruce Ave, Dumas, TX 79029
                                </p>
                                
                                <p style="color: #10B981; text-align: center; font-size: 16px; margin-top: 20px;">
                                    ¡Gracias por confiar en Ross Tax! 🙏
                                </p>
                            </div>
                        </body>
                        </html>
                        """
                        
                        try:
                            await notif_service.send_email(
                                to_email=client_email,
                                subject=f"🎉 ¡Su declaración {tax_year} fue ACEPTADA por el IRS!",
                                html_content=email_html
                            )
                            notifications_sent['email'] = True
                            logging.info(f'✅ Email de aceptación enviado a {client_email}')
                        except Exception as email_error:
                            logging.error(f'❌ Error enviando email: {email_error}')
                            
            except Exception as notif_error:
                logging.error(f'❌ Error en notificaciones: {notif_error}')
        
        return {
            'success': True,
            'message': 'Declaración marcada como aceptada',
            'notifications_sent': notifications_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error accepting tax return: {e}')
        raise HTTPException(status_code=500, detail=str(e))


@tax_returns_router.post('/admin/tax-returns/{return_id}/reject')
async def reject_tax_return(
    return_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    request_data: dict = Body(...)
):
    current_user = await _require_admin(request)

    """Mark tax return as rejected by IRS and send notifications to client"""
    try:
        logging.info(f'📋 Reject tax return request: {return_id}')
        
        # Find the return
        tax_return = await _db.admin_tax_returns.find_one({'id': return_id})
        if not tax_return:
            from bson import ObjectId
            if ObjectId.is_valid(return_id):
                tax_return = await _db.admin_tax_returns.find_one({'_id': ObjectId(return_id)})
        
        if not tax_return:
            raise HTTPException(status_code=404, detail='Tax return not found')
        
        rejection_reason = {
            'reason_id': request_data.get('rejection_reason_id'),
            'title': request_data.get('rejection_reason_title'),
            'description': request_data.get('rejection_reason_description'),
            'action_required': request_data.get('rejection_action_required'),
            'custom_note': request_data.get('custom_note')
        }
        
        # Update status
        await _db.admin_tax_returns.update_one(
            {'id': return_id},
            {'$set': {
                'status': 'rejected',
                'rejected_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'rejected_by': current_user.get('name', 'Admin'),
                'rejection_reason': rejection_reason
            }}
        )
        
        client_name = tax_return.get('client_name', 'Cliente')
        client_email = tax_return.get('client_email')
        client_phone = tax_return.get('client_phone')
        tax_year = tax_return.get('tax_year', '2025')
        
        # Get first name
        first_name = client_name.split()[0] if client_name else 'Cliente'
        
        reason_title = rejection_reason.get('title', 'Razón no especificada')
        reason_description = rejection_reason.get('description', '')
        action_required = rejection_reason.get('action_required', 'Por favor contáctenos para más información.')
        
        notifications_sent = {'sms': False, 'email': False}
        
        # Send notifications if requested
        if request_data.get('send_notifications', True):
            try:
                config_doc = await _db.api_config.find_one({'_id': 'main'})
                if config_doc:
                    from notification_service import NotificationService
                    notif_service = NotificationService(config_doc)
                    
                    # Send SMS
                    if client_phone and notif_service.twilio_client:
                        sms_message = f"""⚠️ Aviso Importante, {first_name}

Su declaración {tax_year} fue RECHAZADA por el IRS.

📋 Motivo: {reason_title}

📞 ACCIÓN REQUERIDA:
{action_required}

Por favor contáctenos lo antes posible para resolverlo.

Ross Tax: (806) 934-2018"""
                        
                        try:
                            message = notif_service.twilio_client.messages.create(
                                body=sms_message,
                                from_=notif_service.twilio_phone_number,
                                to=client_phone
                            )
                            notifications_sent['sms'] = True
                            logging.info(f'✅ SMS de rechazo enviado a {client_phone}')
                        except Exception as sms_error:
                            logging.error(f'❌ Error enviando SMS: {sms_error}')
                    
                    # Send Email
                    if client_email and notif_service.sendgrid_client:
                        email_html = f"""
                        <html>
                        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 28px;">⚠️ Aviso Importante</h1>
                                <p style="margin: 10px 0 0 0; font-size: 18px;">Su declaración requiere atención</p>
                            </div>
                            
                            <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                                <h2 style="color: #333; margin-top: 0;">Hola {first_name},</h2>
                                
                                <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                    Le informamos que su declaración de impuestos del año fiscal <strong>{tax_year}</strong> 
                                    ha sido <strong style="color: #DC2626;">RECHAZADA</strong> por el IRS.
                                </p>
                                
                                <div style="background-color: #FEE2E2; border-radius: 10px; padding: 20px; margin: 20px 0;">
                                    <h3 style="color: #991B1B; margin-top: 0;">📋 Motivo del Rechazo</h3>
                                    <p style="color: #7F1D1D; font-weight: bold; font-size: 18px; margin: 10px 0;">{reason_title}</p>
                                    <p style="color: #991B1B; margin-bottom: 0;">{reason_description}</p>
                                </div>
                                
                                <div style="background-color: #FEF3C7; border-left: 4px solid #D97706; padding: 15px; margin: 20px 0;">
                                    <h3 style="color: #92400E; margin-top: 0;">🔔 ACCIÓN REQUERIDA</h3>
                                    <p style="color: #78350F; margin-bottom: 0; font-size: 15px;">
                                        {action_required}
                                    </p>
                                </div>
                                
                                <div style="background-color: #EFF6FF; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                                    <h4 style="color: #1E40AF; margin-top: 0;">¿Necesita ayuda?</h4>
                                    <p style="color: #555; margin-bottom: 15px;">Nuestro equipo está listo para asistirle</p>
                                    <a href="tel:+18069342018" style="display: inline-block; background-color: #1E40AF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        📞 Llamar: (806) 934-2018
                                    </a>
                                </div>
                                
                                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                
                                <p style="color: #888; font-size: 14px; text-align: center;">
                                    Ross Tax Preparation | 305 Bruce Ave, Dumas, TX 79029<br>
                                    <strong>Estamos aquí para ayudarle a resolver esto.</strong>
                                </p>
                            </div>
                        </body>
                        </html>
                        """
                        
                        try:
                            await notif_service.send_email(
                                to_email=client_email,
                                subject=f"⚠️ Atención Requerida: Su declaración {tax_year} fue rechazada",
                                html_content=email_html
                            )
                            notifications_sent['email'] = True
                            logging.info(f'✅ Email de rechazo enviado a {client_email}')
                        except Exception as email_error:
                            logging.error(f'❌ Error enviando email: {email_error}')
                            
            except Exception as notif_error:
                logging.error(f'❌ Error en notificaciones: {notif_error}')
        
        return {
            'success': True,
            'message': 'Declaración marcada como rechazada',
            'notifications_sent': notifications_sent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error rejecting tax return: {e}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== CLIENT TAX RETURNS (My Declarations) ==================

@tax_returns_router.get('/my-tax-returns')
async def get_my_tax_returns(
    request: Request
):
    current_user = await _auth_user(request)

    """Get tax returns for the currently logged in client"""
    try:
        user_id = str(current_user.get('_id', ''))
        user_email = current_user.get('email', '')
        user_phone = current_user.get('phone', '')
        
        # Search by multiple identifiers
        query = {
            '$or': [
                {'client_id': user_id},
                {'client_email': user_email},
            ]
        }
        
        # Add phone to query if available
        if user_phone:
            query['$or'].append({'client_phone': user_phone})
        
        returns = await _db.admin_tax_returns.find(query).sort('created_at', -1).to_list(50)
        
        result = []
        for r in returns:
            # Calculate total refund
            federal = r.get('federal_refund') or r.get('refund_amount') or 0
            state = r.get('state_refund') or 0
            total_refund = federal + state if state else federal
            
            # Format status for client view
            status = r.get('status', 'pending')
            status_display = {
                'pending': {'label': 'Pendiente', 'color': '#F59E0B'},
                'submitted': {'label': 'Enviada al IRS', 'color': '#3B82F6'},
                'processing': {'label': 'En Proceso', 'color': '#8B5CF6'},
                'accepted': {'label': 'Aceptada', 'color': '#10B981'},
                'rejected': {'label': 'Rechazada', 'color': '#EF4444'},
                'completed': {'label': 'Completada', 'color': '#059669'},
            }.get(status, {'label': status.capitalize(), 'color': '#6B7280'})
            
            item = {
                'id': str(r.get('_id', r.get('id'))),
                'tax_year': r.get('tax_year'),
                'status': status,
                'status_display': status_display,
                'federal_refund': federal,
                'state_refund': state,
                'total_refund': total_refund,
                'total_income': r.get('total_income'),
                'submitted_at': r.get('submitted_at').isoformat() if r.get('submitted_at') else None,
                'accepted_at': r.get('accepted_at').isoformat() if r.get('accepted_at') else None,
                'rejected_at': r.get('rejected_at').isoformat() if r.get('rejected_at') else None,
                'rejection_reason': r.get('rejection_reason'),
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
                'notes': r.get('notes'),
            }
            result.append(item)
        
        return {
            'success': True,
            'tax_returns': result,
            'total_refund': sum(r['total_refund'] for r in result if r['status'] == 'accepted'),
            'count': len(result)
        }
        
    except Exception as e:
        logging.error(f'Error getting client tax returns: {e}')
        raise HTTPException(status_code=500, detail=str(e))

