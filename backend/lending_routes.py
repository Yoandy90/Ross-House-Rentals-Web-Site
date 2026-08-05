"""
Ross Lending Solutions - Loan API Routes
Handles: payments, invoices, contracts, payment methods, recurring settings, Plaid Link
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import os
import logging

logger = logging.getLogger(__name__)

lending_router = APIRouter(prefix="/api/loans", tags=["Lending"])

_db = None
_plaid_client = None

def _get_plaid_client():
    """Lazy-load Plaid client."""
    global _plaid_client
    if _plaid_client:
        return _plaid_client
    try:
        import plaid
        from plaid.api import plaid_api

        plaid_env = os.getenv('PLAID_ENV', 'sandbox')
        if plaid_env == 'production':
            host = plaid.Environment.Production
        elif plaid_env == 'development':
            host = plaid.Environment.Sandbox
        else:
            host = plaid.Environment.Sandbox

        configuration = plaid.Configuration(
            host=host,
            api_key={
                'clientId': os.getenv('PLAID_CLIENT_ID'),
                'secret': os.getenv('PLAID_SECRET'),
            }
        )
        api_client = plaid.ApiClient(configuration)
        _plaid_client = plaid_api.PlaidApi(api_client)
        return _plaid_client
    except Exception as e:
        logger.error(f"Plaid client init failed: {e}")
        return None


def init_lending_router(db):
    global _db
    _db = db
    print("💰 Ross Lending routes initialized")


async def _get_current_user_from_token(authorization: str = None):
    """Simple token verification - reuses the session logic from auth_routes"""
    from fastapi import Header
    return None  # Will be overridden below


from fastapi import Header

async def get_lending_user(authorization: str = Header(None)):
    """Get current user from Bearer token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    token = authorization.replace('Bearer ', '')
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    
    user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    user['id'] = user.pop('_id')
    return user


# ═══════════════════════════════════════
# MY LOANS (Client Portal)
# ═══════════════════════════════════════

@lending_router.get('/my-loans')
async def get_my_loans(user=Depends(get_lending_user)):
    """Get all loans belonging to the current user (matched by email or phone)"""
    try:
        user_email = user.get('email', '')
        user_phone = user.get('phone', '')
        user_id_str = str(user.get('id', ''))

        or_conditions = []
        if user_email:
            or_conditions.append({'client_email': {'$regex': f'^{user_email}$', '$options': 'i'}})
        if user_phone:
            phone_digits = ''.join(c for c in user_phone if c.isdigit())
            if phone_digits:
                or_conditions.append({'client_phone': {'$regex': phone_digits[-10:]}})
        if user_id_str:
            or_conditions.append({'user_id': user_id_str})

        if not or_conditions:
            return {"loans": [], "total": 0}

        query = {'$or': or_conditions}
        loans = []
        async for loan in _db.regulated_loans.find(query).sort('created_at', -1):
            loan['_id'] = str(loan['_id'])
            loans.append(loan)

        return {"loans": loans, "total": len(loans)}
    except Exception as e:
        logger.error(f"My loans error: {e}")
        return {"loans": [], "total": 0}


@lending_router.get('/my-dashboard')
async def get_my_dashboard(user=Depends(get_lending_user)):
    """Get comprehensive dashboard data for the client portal"""
    try:
        user_email = user.get('email', '')
        user_phone = user.get('phone', '')
        user_id_str = str(user.get('id', ''))

        or_conditions = []
        if user_email:
            or_conditions.append({'client_email': {'$regex': f'^{user_email}$', '$options': 'i'}})
        if user_phone:
            phone_digits = ''.join(c for c in user_phone if c.isdigit())
            if phone_digits:
                or_conditions.append({'client_phone': {'$regex': phone_digits[-10:]}})
        if user_id_str:
            or_conditions.append({'user_id': user_id_str})

        if not or_conditions:
            return {
                "loans": [], "total_loans": 0, "active_loans": 0,
                "total_balance": 0, "total_paid": 0, "paid_off_count": 0,
                "next_payment": None, "recent_payments": [],
                "payment_methods_count": 0,
            }

        query = {'$or': or_conditions}

        # Fetch loans
        loans = []
        async for loan in _db.regulated_loans.find(query).sort('created_at', -1):
            loan['_id'] = str(loan['_id'])
            loans.append(loan)

        active_loans = [l for l in loans if l.get('status') in ('active', 'disbursed', 'current', 'delinquent')]
        paid_off = [l for l in loans if l.get('status') == 'paid_off']

        total_balance = sum(l.get('balance', 0) for l in active_loans)
        total_paid = sum((l.get('total_to_pay', 0) - l.get('balance', 0)) for l in loans)
        total_original = sum(l.get('amount', 0) for l in loans)

        # Find next payment due
        next_payment = None
        from datetime import datetime as dt
        now_str = dt.now().isoformat()
        for loan in active_loans:
            npd = loan.get('next_payment_date')
            if npd:
                if not next_payment or npd < next_payment.get('date', '9999'):
                    next_payment = {
                        'date': npd,
                        'amount': loan.get('monthly_payment', 0),
                        'loan_number': loan.get('loan_number', ''),
                        'loan_id': loan['_id'],
                    }

        # Recent payments (last 10)
        loan_ids = [l['_id'] for l in loans]
        recent_payments = []
        if loan_ids:
            async for p in _db.regulated_loan_payments.find(
                {'loan_id': {'$in': loan_ids}}
            ).sort('payment_date', -1).limit(10):
                p['_id'] = str(p['_id'])
                recent_payments.append(p)

        # Payment methods count
        pm_count = await _db.payment_methods.count_documents({'user_id': user_id_str})

        return {
            "loans": loans,
            "total_loans": len(loans),
            "active_loans": len(active_loans),
            "total_balance": round(total_balance, 2),
            "total_paid": round(total_paid, 2),
            "total_original": round(total_original, 2),
            "paid_off_count": len(paid_off),
            "next_payment": next_payment,
            "recent_payments": recent_payments,
            "payment_methods_count": pm_count,
            "user": {
                "first_name": user.get('first_name', ''),
                "last_name": user.get('last_name', ''),
                "email": user.get('email', ''),
                "phone": user.get('phone', ''),
            }
        }
    except Exception as e:
        logger.error(f"My dashboard error: {e}")
        return {
            "loans": [], "total_loans": 0, "active_loans": 0,
            "total_balance": 0, "total_paid": 0, "paid_off_count": 0,
            "next_payment": None, "recent_payments": [],
            "payment_methods_count": 0,
        }


# ═══════════════════════════════════════
# PAYMENT HISTORY
# ═══════════════════════════════════════

@lending_router.get('/my-payments')
async def get_my_payments(user=Depends(get_lending_user)):
    """Get payment history for the current user"""
    try:
        payments = await _db.regulated_loan_payments.find({
            '$or': [
                {'user_id': user['id']},
                {'client_email': user.get('email')},
            ]
        }).sort('payment_date', -1).to_list(100)
        
        for p in payments:
            p['_id'] = str(p['_id'])
        
        return {"payments": payments}
    except Exception:
        return {"payments": []}


# ═══════════════════════════════════════
# PAYMENT METHODS
# ═══════════════════════════════════════

class PaymentMethodCreate(BaseModel):
    type: str  # 'bank' or 'card'
    bank_name: Optional[str] = None
    account_last4: Optional[str] = None
    routing_number: Optional[str] = None
    account_number_encrypted: Optional[str] = None
    account_type: Optional[str] = None  # checking / savings
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    card_exp: Optional[str] = None
    stripe_payment_method_id: Optional[str] = None
    plaid_access_token: Optional[str] = None
    is_default: bool = False

@lending_router.get('/payment-methods')
async def get_payment_methods(user=Depends(get_lending_user)):
    """Get saved payment methods"""
    try:
        methods = await _db.payment_methods.find({
            'user_id': user['id']
        }).to_list(20)
        
        for m in methods:
            m['_id'] = str(m['_id'])
            # Never expose sensitive data
            m.pop('plaid_access_token', None)
            m.pop('account_number_encrypted', None)
            m.pop('routing_number', None)
        
        return {"methods": methods}
    except:
        return {"methods": []}

@lending_router.post('/payment-methods')
async def add_payment_method(data: PaymentMethodCreate, user=Depends(get_lending_user)):
    """Add a payment method (bank or card)"""
    method = {
        'user_id': user['id'],
        'type': data.type,
        'created_at': datetime.now(timezone.utc),
        'is_default': data.is_default,
    }

    if data.type == 'bank':
        if not data.bank_name or not data.account_last4:
            raise HTTPException(status_code=400, detail="Nombre del banco y últimos 4 dígitos requeridos")
        method.update({
            'bank_name': data.bank_name,
            'account_last4': data.account_last4,
            'routing_number': data.routing_number,
            'account_number_encrypted': data.account_number_encrypted,
            'account_type': data.account_type or 'checking',
        })
    elif data.type == 'card':
        if not data.card_last4:
            raise HTTPException(status_code=400, detail="Últimos 4 dígitos de tarjeta requeridos")
        method.update({
            'card_brand': data.card_brand or 'Visa',
            'card_last4': data.card_last4,
            'account_last4': data.card_last4,  # unified field for display
            'card_exp': data.card_exp,
            'bank_name': f"{data.card_brand or 'Visa'} ····{data.card_last4}",
            'stripe_payment_method_id': data.stripe_payment_method_id,
        })
    else:
        method.update({
            'bank_name': data.bank_name,
            'account_last4': data.account_last4,
        })

    if data.plaid_access_token:
        method['plaid_access_token'] = data.plaid_access_token

    # If setting as default, unset other defaults
    if data.is_default:
        await _db.payment_methods.update_many(
            {'user_id': user['id']},
            {'$set': {'is_default': False}}
        )
    
    result = await _db.payment_methods.insert_one(method)
    return {"success": True, "id": str(result.inserted_id)}


@lending_router.delete('/payment-methods/{method_id}')
async def delete_payment_method(method_id: str, user=Depends(get_lending_user)):
    """Delete a saved payment method — blocked if linked to active loan without replacement"""
    try:
        # 1. Verify the method exists and belongs to user
        method = await _db.payment_methods.find_one({
            '_id': ObjectId(method_id),
            'user_id': user['id']
        })
        if not method:
            raise HTTPException(status_code=404, detail="Método no encontrado")

        # 2. Check if method is linked to active loans (autopay or last used)
        active_loans_using = await _db.regulated_loans.find({
            'user_id': user['id'],
            'status': {'$in': ['active', 'current', 'approved']},
            '$or': [
                {'payment_method_id': method_id},
                {'default_payment_method_id': method_id},
            ]
        }).to_list(50)

        # Also check autopay associations
        autopay_links = await _db.autopay_settings.find({
            'user_id': user['id'],
            'payment_method_id': method_id,
            'active': True,
        }).to_list(50)

        linked_loan_ids = set()
        for loan in active_loans_using:
            linked_loan_ids.add(str(loan['_id']))
        for ap in autopay_links:
            linked_loan_ids.add(ap.get('loan_id', ''))

        if linked_loan_ids:
            # 3. Check if user has at least one OTHER method to replace
            other_methods = await _db.payment_methods.count_documents({
                'user_id': user['id'],
                '_id': {'$ne': ObjectId(method_id)},
            })
            if other_methods == 0:
                raise HTTPException(
                    status_code=409,
                    detail="Este método está asociado a un préstamo activo. Agrega un nuevo método de pago antes de eliminar este."
                )

            # 4. If there are other methods, still warn but allow with confirmation
            # The frontend sends ?force=true to bypass after user confirms
            # (For now, we block and require the user to reassign first)
            loan_numbers = []
            for lid in linked_loan_ids:
                try:
                    loan = await _db.regulated_loans.find_one({'_id': ObjectId(lid)})
                    if loan:
                        loan_numbers.append(loan.get('loan_number', lid))
                except:
                    pass

            raise HTTPException(
                status_code=409,
                detail=f"Este método está vinculado a préstamo(s) activo(s): {', '.join(loan_numbers) if loan_numbers else 'Préstamo activo'}. Primero agrega un nuevo método, asócialo al préstamo, y luego podrás eliminar este."
            )

        # 5. Safe to delete — not linked to any active loan
        result = await _db.payment_methods.delete_one({
            '_id': ObjectId(method_id),
            'user_id': user['id']
        })
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Método no encontrado")

        # If this was the default, set another as default
        if method.get('is_default'):
            next_method = await _db.payment_methods.find_one({'user_id': user['id']})
            if next_method:
                await _db.payment_methods.update_one(
                    {'_id': next_method['_id']},
                    {'$set': {'is_default': True}}
                )

        return {"success": True, "message": "Método de pago eliminado"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.put('/payment-methods/{method_id}')
async def update_payment_method(method_id: str, request: Request, user=Depends(get_lending_user)):
    """Update a payment method's editable fields (bank name, account type, nickname)"""
    try:
        body = await request.json()
        method = await _db.payment_methods.find_one({
            '_id': ObjectId(method_id),
            'user_id': user['id']
        })
        if not method:
            raise HTTPException(status_code=404, detail="Método no encontrado")

        update_fields = {}
        if 'bank_name' in body and body['bank_name']:
            update_fields['bank_name'] = body['bank_name'].strip()
        if 'account_type' in body and body['account_type'] in ('checking', 'savings'):
            update_fields['account_type'] = body['account_type']
        if 'nickname' in body:
            update_fields['nickname'] = body['nickname'].strip() if body['nickname'] else ''

        if not update_fields:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")

        update_fields['updated_at'] = datetime.now(timezone.utc)

        await _db.payment_methods.update_one(
            {'_id': ObjectId(method_id)},
            {'$set': update_fields}
        )
        return {"success": True, "message": "Método actualizado"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.get('/payment-methods/{method_id}/linked-loans')
async def get_linked_loans(method_id: str, user=Depends(get_lending_user)):
    """Check if a payment method is linked to any active loans"""
    try:
        linked = []

        # Check regulated_loans
        loans = await _db.regulated_loans.find({
            'user_id': user['id'],
            'status': {'$in': ['active', 'current', 'approved']},
            '$or': [
                {'payment_method_id': method_id},
                {'default_payment_method_id': method_id},
            ]
        }).to_list(50)

        for loan in loans:
            linked.append({
                'loan_id': str(loan['_id']),
                'loan_number': loan.get('loan_number', ''),
                'amount': loan.get('amount', 0),
                'status': loan.get('status', ''),
            })

        # Check autopay
        autopays = await _db.autopay_settings.find({
            'user_id': user['id'],
            'payment_method_id': method_id,
            'active': True,
        }).to_list(50)

        for ap in autopays:
            if not any(l['loan_id'] == ap.get('loan_id') for l in linked):
                linked.append({
                    'loan_id': ap.get('loan_id', ''),
                    'loan_number': f"Autopago #{ap.get('loan_id', '')[-4:]}",
                    'amount': 0,
                    'status': 'autopay',
                })

        return {"linked_loans": linked, "has_active_links": len(linked) > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.patch('/payment-methods/{method_id}/default')
async def set_default_payment_method(method_id: str, user=Depends(get_lending_user)):
    """Set a payment method as default"""
    try:
        # Unset all
        await _db.payment_methods.update_many(
            {'user_id': user['id']},
            {'$set': {'is_default': False}}
        )
        # Set the chosen one
        result = await _db.payment_methods.update_one(
            {'_id': ObjectId(method_id), 'user_id': user['id']},
            {'$set': {'is_default': True}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Método no encontrado")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════
# ADMIN — BAÚL SEGURO (Payment Methods Vault)
# ═══════════════════════════════════════

async def _require_admin(authorization: str = Header(None)):
    """Verify the user is an admin"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autorizado")
    token = authorization.replace('Bearer ', '')
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'_id': session['user_id']})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Solo administradores")
    user['id'] = str(user.pop('_id'))
    return user


@lending_router.get('/admin/vault')
async def admin_list_vault(
    search: str = '',
    type_filter: str = '',
    page: int = 1,
    limit: int = 50,
    admin=Depends(_require_admin)
):
    """Admin: List ALL payment methods from all users with search"""
    try:
        query: dict = {}

        # Search by name, last4, or email
        if search:
            search_regex = {'$regex': search, '$options': 'i'}
            query['$or'] = [
                {'bank_name': search_regex},
                {'account_last4': search_regex},
                {'card_last4': search_regex},
                {'card_brand': search_regex},
            ]

        # Filter by type
        if type_filter in ('bank', 'card'):
            query['type'] = type_filter

        total = await _db.payment_methods.count_documents(query)
        skip = (page - 1) * limit

        methods = await _db.payment_methods.find(query).sort(
            'created_at', -1
        ).skip(skip).limit(limit).to_list(limit)

        # Enrich with user info and linked loans
        enriched = []
        for m in methods:
            m['_id'] = str(m['_id'])
            method_id = m['_id']
            user_id = m.get('user_id', '')

            # Get user info
            user_info = None
            try:
                from bson import ObjectId as OID
                user = await _db.users.find_one({'_id': OID(user_id)}) if user_id else None
                if user:
                    user_info = {
                        'name': f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or user.get('email', ''),
                        'email': user.get('email', ''),
                        'phone': user.get('phone', ''),
                    }
            except:
                pass

            # Check linked loans
            linked_loans = []
            try:
                loans = await _db.regulated_loans.find({
                    'user_id': user_id,
                    'status': {'$in': ['active', 'current', 'approved']},
                    '$or': [
                        {'payment_method_id': method_id},
                        {'default_payment_method_id': method_id},
                    ]
                }).to_list(10)
                for loan in loans:
                    linked_loans.append({
                        'loan_id': str(loan['_id']),
                        'loan_number': loan.get('loan_number', ''),
                        'amount': loan.get('amount', 0),
                        'status': loan.get('status', ''),
                    })
            except:
                pass

            # Never expose sensitive data to admin either
            m.pop('plaid_access_token', None)
            # But keep routing/account for admin
            m['user_info'] = user_info
            m['linked_loans'] = linked_loans
            m['has_active_links'] = len(linked_loans) > 0
            enriched.append(m)

        return {
            "methods": enriched,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin vault list error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.put('/admin/vault/{method_id}')
async def admin_update_vault_method(method_id: str, request: Request, admin=Depends(_require_admin)):
    """Admin: Update any payment method"""
    try:
        body = await request.json()
        method = await _db.payment_methods.find_one({'_id': ObjectId(method_id)})
        if not method:
            raise HTTPException(status_code=404, detail="Método no encontrado")

        update_fields = {}
        if 'bank_name' in body and body['bank_name']:
            update_fields['bank_name'] = body['bank_name'].strip()
        if 'account_type' in body and body['account_type'] in ('checking', 'savings'):
            update_fields['account_type'] = body['account_type']
        if 'routing_number' in body and body['routing_number']:
            update_fields['routing_number'] = body['routing_number'].strip()
        if 'account_number_encrypted' in body and body['account_number_encrypted']:
            update_fields['account_number_encrypted'] = body['account_number_encrypted'].strip()
            update_fields['account_last4'] = body['account_number_encrypted'].strip()[-4:]
        if 'is_default' in body:
            if body['is_default']:
                await _db.payment_methods.update_many(
                    {'user_id': method['user_id']},
                    {'$set': {'is_default': False}}
                )
            update_fields['is_default'] = body['is_default']

        if not update_fields:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")

        update_fields['updated_at'] = datetime.now(timezone.utc)
        update_fields['updated_by'] = admin['id']

        await _db.payment_methods.update_one(
            {'_id': ObjectId(method_id)},
            {'$set': update_fields}
        )
        return {"success": True, "message": "Método actualizado por admin"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.delete('/admin/vault/{method_id}')
async def admin_delete_vault_method(method_id: str, force: bool = False, admin=Depends(_require_admin)):
    """Admin: Delete a payment method with active loan protection"""
    try:
        method = await _db.payment_methods.find_one({'_id': ObjectId(method_id)})
        if not method:
            raise HTTPException(status_code=404, detail="Método no encontrado")

        user_id = method.get('user_id', '')

        # Check linked loans
        linked = await _db.regulated_loans.find({
            'user_id': user_id,
            'status': {'$in': ['active', 'current', 'approved']},
            '$or': [
                {'payment_method_id': method_id},
                {'default_payment_method_id': method_id},
            ]
        }).to_list(10)

        if linked and not force:
            loan_nums = [l.get('loan_number', str(l['_id'])) for l in linked]
            raise HTTPException(
                status_code=409,
                detail=f"Vinculado a préstamo(s) activo(s): {', '.join(loan_nums)}. El cliente debe agregar un nuevo método primero. Use force=true para forzar eliminación."
            )

        await _db.payment_methods.delete_one({'_id': ObjectId(method_id)})

        # If was default, promote next one
        if method.get('is_default'):
            next_m = await _db.payment_methods.find_one({'user_id': user_id})
            if next_m:
                await _db.payment_methods.update_one(
                    {'_id': next_m['_id']},
                    {'$set': {'is_default': True}}
                )

        return {"success": True, "message": "Método eliminado por admin"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.get('/admin/vault/stats')
async def admin_vault_stats(admin=Depends(_require_admin)):
    """Admin: Get vault statistics"""
    try:
        total = await _db.payment_methods.count_documents({})
        banks = await _db.payment_methods.count_documents({'type': 'bank'})
        cards = await _db.payment_methods.count_documents({'type': 'card'})

        # Unique users with payment methods
        pipeline = [
            {'$group': {'_id': '$user_id'}},
            {'$count': 'total'}
        ]
        user_count_result = await _db.payment_methods.aggregate(pipeline).to_list(1)
        unique_users = user_count_result[0]['total'] if user_count_result else 0

        return {
            "total_methods": total,
            "bank_accounts": banks,
            "cards": cards,
            "unique_users": unique_users,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════
# INVOICES
# ═══════════════════════════════════════

@lending_router.get('/my-invoices')
async def get_my_invoices(user=Depends(get_lending_user)):
    """Get invoices for the current user"""
    try:
        invoices = await _db.loan_invoices.find({
            '$or': [
                {'user_id': user['id']},
                {'client_email': user.get('email')},
            ]
        }).sort('created_at', -1).to_list(50)
        
        for inv in invoices:
            inv['_id'] = str(inv['_id'])
        
        return {"invoices": invoices}
    except:
        return {"invoices": []}


# ═══════════════════════════════════════
# CONTRACTS
# ═══════════════════════════════════════

@lending_router.get('/my-contracts')
async def get_my_contracts(user=Depends(get_lending_user)):
    """Get loan contracts for the current user"""
    try:
        contracts = await _db.loan_contracts.find({
            '$or': [
                {'user_id': user['id']},
                {'client_email': user.get('email')},
            ]
        }).sort('created_at', -1).to_list(20)
        
        for c in contracts:
            c['_id'] = str(c['_id'])
        
        return {"contracts": contracts}
    except:
        return {"contracts": []}


# ═══════════════════════════════════════
# RECURRING PAYMENTS SETTINGS
# ═══════════════════════════════════════

class RecurringSettings(BaseModel):
    autopay_enabled: bool = False
    frequency: str = 'monthly'  # weekly, biweekly, monthly

@lending_router.get('/recurring-settings')
async def get_recurring_settings(user=Depends(get_lending_user)):
    """Get recurring payment settings"""
    try:
        settings = await _db.recurring_settings.find_one({'user_id': user['id']})
        if settings:
            settings['_id'] = str(settings['_id'])
            return settings
        return {"autopay_enabled": False, "frequency": "monthly"}
    except:
        return {"autopay_enabled": False, "frequency": "monthly"}

@lending_router.put('/recurring-settings')
async def update_recurring_settings(data: RecurringSettings, user=Depends(get_lending_user)):
    """Update recurring payment settings"""
    try:
        await _db.recurring_settings.update_one(
            {'user_id': user['id']},
            {'$set': {
                'user_id': user['id'],
                'autopay_enabled': data.autopay_enabled,
                'frequency': data.frequency,
                'updated_at': datetime.now(timezone.utc),
            }},
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════
# PLAID LINK INTEGRATION (ACH)
# ═══════════════════════════════════════

class PlaidPublicTokenExchange(BaseModel):
    public_token: str
    account_id: Optional[str] = None


@lending_router.post('/plaid/create-link-token')
async def create_plaid_link_token(user=Depends(get_lending_user)):
    """Create a Plaid Link token for the mobile app"""
    client = _get_plaid_client()
    if not client:
        raise HTTPException(status_code=503, detail="Plaid no configurado")

    try:
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
        from plaid.model.products import Products
        from plaid.model.country_code import CountryCode

        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(client_user_id=str(user['id'])),
            client_name="Ross Lending Solutions",
            products=[Products("auth"), Products("transactions")],
            country_codes=[CountryCode("US")],
            language="es",
        )
        response = client.link_token_create(request)
        return {"link_token": response['link_token'], "expiration": response['expiration']}
    except Exception as e:
        logger.error(f"Plaid link token error: {e}")
        raise HTTPException(status_code=500, detail=f"Error creando link token: {str(e)}")


@lending_router.post('/plaid/exchange-token')
async def exchange_plaid_public_token(data: PlaidPublicTokenExchange, user=Depends(get_lending_user)):
    """Exchange Plaid public token for access token and save bank account"""
    client = _get_plaid_client()
    if not client:
        raise HTTPException(status_code=503, detail="Plaid no configurado")

    try:
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
        from plaid.model.accounts_get_request import AccountsGetRequest

        # Exchange public token
        exchange_request = ItemPublicTokenExchangeRequest(public_token=data.public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        access_token = exchange_response['access_token']
        item_id = exchange_response['item_id']

        # Get account details
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request)
        accounts = accounts_response['accounts']

        # Find the selected account or use first
        account = None
        if data.account_id:
            account = next((a for a in accounts if a['account_id'] == data.account_id), None)
        if not account and accounts:
            account = accounts[0]

        if not account:
            raise HTTPException(status_code=400, detail="No se encontró cuenta bancaria")

        # Save payment method
        bank_name = account.get('name', '') or account.get('official_name', 'Cuenta Bancaria')
        last4 = account.get('mask', '0000')

        method = {
            'user_id': user['id'],
            'type': 'bank',
            'bank_name': bank_name,
            'account_last4': last4,
            'plaid_access_token': access_token,
            'plaid_item_id': item_id,
            'plaid_account_id': account['account_id'],
            'account_type': account.get('subtype', 'checking'),
            'is_default': True,
            'created_at': datetime.now(timezone.utc),
        }

        # Set all existing as non-default
        await _db.payment_methods.update_many(
            {'user_id': user['id']},
            {'$set': {'is_default': False}}
        )

        result = await _db.payment_methods.insert_one(method)

        return {
            "success": True,
            "method_id": str(result.inserted_id),
            "bank_name": bank_name,
            "last4": last4,
            "account_type": account.get('subtype', 'checking'),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Plaid exchange error: {e}")
        raise HTTPException(status_code=500, detail=f"Error conectando cuenta: {str(e)}")



# ═══════════════════════════════════════
# PAYMENT SCHEDULE & LOAN PAYMENTS
# ═══════════════════════════════════════

from datetime import timedelta
from dateutil.relativedelta import relativedelta
from bson import ObjectId


@lending_router.get('/{loan_id}/payment-schedule')
async def get_payment_schedule(loan_id: str, user=Depends(get_lending_user)):
    """Get the full payment schedule for a loan"""
    try:
        loan = await _db.regulated_loans.find_one({'_id': ObjectId(loan_id)})
        if not loan:
            raise HTTPException(status_code=404, detail="Préstamo no encontrado")

        # Get existing payments made
        payments_made = await _db.regulated_loan_payments.find(
            {'loan_id': loan_id}
        ).sort('payment_number', 1).to_list(100)

        # Generate full schedule from loan terms
        schedule = []
        start_date = loan.get('start_date') or loan.get('created_at') or datetime.now(timezone.utc)
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))

        term_months = loan.get('term_months', 12)
        monthly_payment = loan.get('monthly_payment', 0)
        payment_day = loan.get('payment_day', start_date.day if hasattr(start_date, 'day') else 15)

        payments_paid_nums = {p.get('payment_number') for p in payments_made}

        for i in range(1, term_months + 1):
            due_date = start_date + relativedelta(months=i)
            # Adjust to the correct payment day
            try:
                due_date = due_date.replace(day=payment_day)
            except ValueError:
                # Handle months with fewer days (e.g., Feb 30 -> Feb 28)
                import calendar
                last_day = calendar.monthrange(due_date.year, due_date.month)[1]
                due_date = due_date.replace(day=min(payment_day, last_day))

            # Check if this payment was already made
            paid_payment = next((p for p in payments_made if p.get('payment_number') == i), None)

            schedule.append({
                'payment_number': i,
                'due_date': due_date.isoformat(),
                'amount': monthly_payment,
                'status': 'paid' if i in payments_paid_nums else ('overdue' if due_date < datetime.now(timezone.utc) else 'upcoming'),
                'paid_date': paid_payment.get('payment_date') if paid_payment else None,
                'paid_amount': paid_payment.get('amount') if paid_payment else None,
            })

        # Get autopay config
        autopay = await _db.autopay_config.find_one({
            'loan_id': loan_id,
            'user_id': str(user['id']),
            'active': True,
        })

        return {
            "schedule": schedule,
            "loan": {
                "id": str(loan['_id']),
                "loan_number": loan.get('loan_number'),
                "amount": loan.get('amount', 0),
                "balance": loan.get('balance', 0),
                "monthly_payment": monthly_payment,
                "term_months": term_months,
                "payment_day": payment_day,
                "next_payment_date": loan.get('next_payment_date'),
                "status": loan.get('status', 'active'),
            },
            "autopay": {
                "active": bool(autopay),
                "payment_method_id": autopay.get('payment_method_id') if autopay else None,
                "payment_date_preference": autopay.get('payment_date_preference', 'on_due_date') if autopay else None,
                "amount_type": autopay.get('amount_type', 'monthly') if autopay else None,
            } if autopay else {"active": False},
            "payments_completed": len(payments_paid_nums),
            "payments_remaining": term_months - len(payments_paid_nums),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment schedule error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class MakePaymentRequest(BaseModel):
    payment_method_id: str
    amount: Optional[float] = None  # None = use monthly_payment
    note: Optional[str] = None


async def _get_stripe_client():
    """Get Stripe client using keys from config manager (admin panel)."""
    try:
        from unified_config_manager import config_manager
        secret_key = await config_manager.get('stripe_secret_key')
        if not secret_key:
            return None
        import stripe
        stripe.api_key = secret_key
        return stripe
    except Exception as e:
        logger.warning(f"Stripe not available: {e}")
        return None


@lending_router.get('/stripe-status')
async def get_stripe_status(user=Depends(get_lending_user)):
    """Check if Stripe is configured and ready for payments"""
    stripe = await _get_stripe_client()
    return {
        "configured": stripe is not None,
        "message": "Stripe está listo para procesar pagos" if stripe else "Stripe no configurado. Configure las API keys en el panel de administración."
    }


@lending_router.post('/{loan_id}/make-payment')
async def make_loan_payment(loan_id: str, data: MakePaymentRequest, background_tasks: BackgroundTasks, user=Depends(get_lending_user)):
    """Process a loan payment — uses Stripe if configured, otherwise records locally"""
    try:
        loan = await _db.regulated_loans.find_one({'_id': ObjectId(loan_id)})
        if not loan:
            raise HTTPException(status_code=404, detail="Préstamo no encontrado")

        # Verify payment method belongs to user
        method = await _db.payment_methods.find_one({
            '_id': ObjectId(data.payment_method_id),
            'user_id': str(user['id']),
        })
        if not method:
            raise HTTPException(status_code=400, detail="Método de pago no encontrado")

        payment_amount = data.amount or loan.get('monthly_payment', 0)
        if payment_amount <= 0:
            raise HTTPException(status_code=400, detail="Monto inválido")
        if payment_amount > loan.get('balance', 0):
            payment_amount = loan.get('balance', 0)

        # Determine payment number
        last_payment = await _db.regulated_loan_payments.find_one(
            {'loan_id': loan_id},
            sort=[('payment_number', -1)]
        )
        next_payment_num = (last_payment.get('payment_number', 0) + 1) if last_payment else 1

        # ═══ STRIPE PROCESSING (if configured) ═══
        stripe_payment_intent_id = None
        payment_status = 'processing'
        stripe_client = await _get_stripe_client()

        if stripe_client and method.get('plaid_access_token'):
            try:
                # Create Stripe PaymentIntent for ACH
                intent = stripe_client.PaymentIntent.create(
                    amount=int(payment_amount * 100),  # Stripe uses cents
                    currency='usd',
                    payment_method_types=['us_bank_account'],
                    metadata={
                        'loan_id': loan_id,
                        'loan_number': loan.get('loan_number', ''),
                        'payment_number': next_payment_num,
                        'user_id': str(user['id']),
                    },
                    description=f"Ross Lending - Pago #{next_payment_num} - {loan.get('loan_number', '')}",
                )
                stripe_payment_intent_id = intent.id
                payment_status = 'pending_confirmation'
                logger.info(f"Stripe PaymentIntent created: {intent.id}")
            except Exception as stripe_err:
                logger.error(f"Stripe payment error: {stripe_err}")
                # Fall back to local processing
                payment_status = 'processing'

        # Create payment record
        payment_record = {
            'loan_id': loan_id,
            'user_id': str(user['id']),
            'payment_number': next_payment_num,
            'amount': payment_amount,
            'payment_method_id': str(data.payment_method_id),
            'payment_method_type': method.get('type', 'bank'),
            'payment_method_name': method.get('bank_name') or method.get('name', 'N/A'),
            'payment_method_last4': method.get('account_last4') or method.get('last4', ''),
            'status': payment_status,
            'stripe_payment_intent_id': stripe_payment_intent_id,
            'payment_date': datetime.now(timezone.utc),
            'note': data.note,
            'created_at': datetime.now(timezone.utc),
        }

        result = await _db.regulated_loan_payments.insert_one(payment_record)

        # Update loan balance
        new_balance = max(0, loan.get('balance', 0) - payment_amount)
        update_data = {'balance': new_balance}

        # Calculate next payment date
        current_next = loan.get('next_payment_date')
        if current_next:
            if isinstance(current_next, str):
                current_next = datetime.fromisoformat(current_next.replace('Z', '+00:00'))
            next_date = current_next + relativedelta(months=1)
            update_data['next_payment_date'] = next_date.isoformat()

        # Check if loan is paid off
        if new_balance <= 0:
            update_data['status'] = 'paid_off'
            update_data['paid_off_date'] = datetime.now(timezone.utc).isoformat()

        await _db.regulated_loans.update_one(
            {'_id': ObjectId(loan_id)},
            {'$set': update_data}
        )

        # ═══ TRIGGER EMAIL NOTIFICATIONS (Background) ═══
        async def _send_payment_email():
            try:
                from email_sender import send_payment_confirmation, send_loan_paid_off
                client_email = user.get('email', '')
                client_name = user.get('name', '')
                loan_number = loan.get('loan_number', '')
                method_name = f"{method.get('bank_name', 'Cuenta')} ****{method.get('account_last4', '0000')}"

                await send_payment_confirmation(
                    client_email=client_email,
                    client_name=client_name,
                    amount=payment_amount,
                    payment_number=next_payment_num,
                    loan_number=loan_number,
                    payment_method=method_name,
                    new_balance=new_balance
                )

                # If loan is now paid off, send congratulations email
                if new_balance <= 0:
                    total_paid = loan.get('amount', 0) + loan.get('total_interest', 0)
                    await send_loan_paid_off(
                        client_email=client_email,
                        client_name=client_name,
                        loan_number=loan_number,
                        total_paid=total_paid
                    )
            except Exception as email_err:
                logger.error(f"Email notification error: {email_err}")

        background_tasks.add_task(_send_payment_email)

        return {
            "success": True,
            "payment_id": str(result.inserted_id),
            "amount": payment_amount,
            "new_balance": new_balance,
            "payment_number": next_payment_num,
            "status": payment_status,
            "stripe_configured": stripe_client is not None,
            "message": f"Pago #{next_payment_num} de ${payment_amount:.2f} procesado correctamente",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Make payment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════
# AUTOPAY CONFIGURATION
# ═══════════════════════════════════════

class AutoPayRequest(BaseModel):
    payment_method_id: str
    payment_date_preference: str = 'on_due_date'  # 'on_due_date', '3_days_before', 'custom'
    custom_day: Optional[int] = None
    amount_type: str = 'monthly'  # 'monthly', 'total_balance'


@lending_router.post('/{loan_id}/autopay')
async def configure_autopay(loan_id: str, data: AutoPayRequest, background_tasks: BackgroundTasks, user=Depends(get_lending_user)):
    """Configure or update autopay for a loan"""
    try:
        loan = await _db.regulated_loans.find_one({'_id': ObjectId(loan_id)})
        if not loan:
            raise HTTPException(status_code=404, detail="Préstamo no encontrado")

        # Verify payment method
        method = await _db.payment_methods.find_one({
            '_id': ObjectId(data.payment_method_id),
            'user_id': str(user['id']),
        })
        if not method:
            raise HTTPException(status_code=400, detail="Método de pago no encontrado")

        # Generate confirmation code
        import random
        import string
        confirmation_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

        # Deactivate any existing autopay for this loan
        await _db.autopay_config.update_many(
            {'loan_id': loan_id, 'user_id': str(user['id'])},
            {'$set': {'active': False}}
        )

        # Create new autopay config
        autopay_config = {
            'loan_id': loan_id,
            'user_id': str(user['id']),
            'payment_method_id': data.payment_method_id,
            'payment_method_name': method.get('bank_name') or method.get('name', 'N/A'),
            'payment_method_last4': method.get('account_last4') or method.get('last4', ''),
            'payment_date_preference': data.payment_date_preference,
            'custom_day': data.custom_day,
            'amount_type': data.amount_type,
            'amount': loan.get('monthly_payment', 0),
            'active': True,
            'confirmation_code': confirmation_code,
            'created_at': datetime.now(timezone.utc),
        }

        await _db.autopay_config.insert_one(autopay_config)

        # ═══ TRIGGER AUTOPAY EMAIL (Background) ═══
        async def _send_autopay_email():
            try:
                from email_sender import send_autopay_enabled
                client_email = user.get('email', '')
                client_name = user.get('name', '')
                loan_number = loan.get('loan_number', '')
                amount = loan.get('monthly_payment', 0)
                method_name = f"{method.get('bank_name', 'Cuenta')} ****{method.get('account_last4', '0000')}"
                next_date = loan.get('next_payment_date', 'Pendiente')
                if hasattr(next_date, 'strftime'):
                    next_date = next_date.strftime('%d %b %Y')

                await send_autopay_enabled(
                    client_email=client_email,
                    client_name=client_name,
                    loan_number=loan_number,
                    amount=amount,
                    payment_method=method_name,
                    next_charge=str(next_date)
                )
            except Exception as email_err:
                logger.error(f"AutoPay email error: {email_err}")

        background_tasks.add_task(_send_autopay_email)

        return {
            "success": True,
            "confirmation_code": confirmation_code,
            "message": "AutoPay configurado correctamente",
            "config": {
                "payment_method": f"{method.get('bank_name', 'Cuenta')} ****{method.get('account_last4', '0000')}",
                "frequency": "Mensual",
                "date_preference": data.payment_date_preference,
                "amount": loan.get('monthly_payment', 0),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AutoPay config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@lending_router.get('/{loan_id}/autopay')
async def get_autopay_config(loan_id: str, user=Depends(get_lending_user)):
    """Get autopay configuration for a loan"""
    try:
        autopay = await _db.autopay_config.find_one({
            'loan_id': loan_id,
            'user_id': str(user['id']),
            'active': True,
        })

        if not autopay:
            return {"active": False}

        return {
            "active": True,
            "payment_method_id": autopay.get('payment_method_id'),
            "payment_method_name": autopay.get('payment_method_name'),
            "payment_method_last4": autopay.get('payment_method_last4'),
            "payment_date_preference": autopay.get('payment_date_preference'),
            "custom_day": autopay.get('custom_day'),
            "amount_type": autopay.get('amount_type'),
            "amount": autopay.get('amount'),
            "confirmation_code": autopay.get('confirmation_code'),
            "created_at": autopay.get('created_at'),
        }
    except Exception as e:
        logger.error(f"Get autopay error: {e}")
        return {"active": False}


@lending_router.delete('/{loan_id}/autopay')
async def cancel_autopay(loan_id: str, user=Depends(get_lending_user)):
    """Cancel autopay for a loan"""
    try:
        result = await _db.autopay_config.update_many(
            {'loan_id': loan_id, 'user_id': str(user['id']), 'active': True},
            {'$set': {'active': False, 'cancelled_at': datetime.now(timezone.utc)}}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="No hay AutoPay activo")

        return {"success": True, "message": "AutoPay cancelado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel autopay error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
