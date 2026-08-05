"""
Receipts Management Routes Router
Extracted from server.py for modularization.
Handles expense receipt upload, AI classification, admin CRUD, dashboard, and export.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Query, Body, Response
from bson import ObjectId

logger = logging.getLogger(__name__)

receipts_router = APIRouter()
_db = None


def init_receipts_router(db):
    global _db
    _db = db


# ================== Auth helpers ==================

async def _auth_user(request: Request):
    """Authenticate user from Bearer token"""
    auth = request.headers.get('Authorization', '')
    if not auth:
        raise HTTPException(status_code=401, detail="No autorizado")
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else auth
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    user = await _db.users.find_one({'id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return {
        'id': user.get('id', str(user.get('_id'))),
        'email': user.get('email'),
        'role': user.get('role'),
        'name': user.get('name', user.get('full_name', ''))
    }


async def _require_admin(request: Request):
    """Authenticate admin user"""
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


# ================== RECEIPT USAGE LIMITS ==================

RECEIPT_LIMITS = {
    "personal": 5,         # Personal clients: 5/month free
    "receipts_pro": 999999, # Recibos Pro subscription: unlimited
    "semilla": 20,         # Plan Semilla: 20/month
    "crecimiento": 999999, # Plan Crecimiento: unlimited
    "empresarial": 999999, # Plan Empresarial: unlimited
}

async def _get_user_receipt_plan(user_id: str) -> dict:
    """Determine user's receipt plan based on bookkeeping subscription or Recibos Pro IAP"""
    # Check if user has a bookkeeping business
    biz = await _db.bk_businesses.find_one({
        "$or": [
            {"linked_client_id": user_id},
            {"owner_email": (await _db.users.find_one({"id": user_id}, {"email": 1}) or {}).get("email", "")},
        ]
    })

    if biz:
        plan = biz.get("service_plan", biz.get("subscription_plan", "semilla"))
        limit = RECEIPT_LIMITS.get(plan, RECEIPT_LIMITS["semilla"])
        return {
            "plan": plan,
            "plan_label": {"semilla": "Plan Semilla", "crecimiento": "Plan Crecimiento", "empresarial": "Plan Empresarial"}.get(plan, plan),
            "limit": limit,
            "is_business": True,
            "business_name": biz.get("business_name", ""),
            "has_receipts_pro": False,
        }

    # Check if user has active "Recibos Pro" IAP subscription
    receipts_pro_sub = await _db.user_subscriptions.find_one({
        "user_id": user_id,
        "apple_product_id": "com.rosstax.plan.receipts.monthly",
        "status": "active",
    })

    if receipts_pro_sub:
        return {
            "plan": "receipts_pro",
            "plan_label": "📸 Recibos Pro",
            "limit": RECEIPT_LIMITS["receipts_pro"],
            "is_business": False,
            "business_name": "",
            "has_receipts_pro": True,
        }

    return {
        "plan": "personal",
        "plan_label": "Cliente Personal",
        "limit": RECEIPT_LIMITS["personal"],
        "is_business": False,
        "business_name": "",
        "has_receipts_pro": False,
    }


async def _get_monthly_receipt_count(user_id: str) -> int:
    """Count receipts uploaded this month by the user"""
    now = datetime.utcnow()
    first_of_month = datetime(now.year, now.month, 1)

    count_main = await _db.expense_receipts.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": first_of_month},
    })
    count_biz = await _db.receipts.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": first_of_month},
    })
    return count_main + count_biz


@receipts_router.get('/receipts/usage-limits')
async def get_receipt_usage_limits(request: Request):
    """Get current receipt usage and limits for the authenticated user"""
    current_user = await _auth_user(request)
    user_id = current_user['id']

    plan_info = await _get_user_receipt_plan(user_id)
    used = await _get_monthly_receipt_count(user_id)
    limit = plan_info["limit"]
    remaining = max(0, limit - used)
    is_unlimited = limit >= 999999

    return {
        "success": True,
        "plan": plan_info["plan"],
        "plan_label": plan_info["plan_label"],
        "is_business": plan_info["is_business"],
        "business_name": plan_info["business_name"],
        "has_receipts_pro": plan_info.get("has_receipts_pro", False),
        "limit": limit if not is_unlimited else None,
        "used": used,
        "remaining": remaining if not is_unlimited else None,
        "is_unlimited": is_unlimited,
        "can_upload": is_unlimited or used < limit,
        "month": datetime.utcnow().strftime("%B %Y"),
        "upgrade_options": {
            "receipts_pro": {
                "apple_product_id": "com.rosstax.plan.receipts.monthly",
                "label": "Recibos Pro",
                "price": 9.99,
                "receipts": "Ilimitados",
                "description": "Escaneo ilimitado de recibos con AI",
            },
            "bookkeeping_plans": [
                {"plan": "semilla", "label": "Plan Semilla", "price": 199, "receipts": 20},
                {"plan": "crecimiento", "label": "Plan Crecimiento", "price": 399, "receipts": "Ilimitados"},
                {"plan": "empresarial", "label": "Plan Empresarial", "price": 699, "receipts": "Ilimitados"},
            ],
        } if not plan_info["is_business"] and not plan_info.get("has_receipts_pro") else None,
    }


# ================== RECEIPT ENDPOINTS ==================

@receipts_router.post('/receipts/check-quality')
async def check_receipt_quality(
    request: Request,
    image: str = Body(..., description="Base64 encoded image"),
):
    current_user = await _auth_user(request)
    """Check the quality of a receipt image before uploading"""
    try:
        import base64
        
        if not image:
            raise HTTPException(status_code=400, detail="No image provided")
        
        clean_image = image
        if ',' in clean_image:
            clean_image = clean_image.split(',')[1]
        
        try:
            decoded = base64.b64decode(clean_image)
            if len(decoded) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Base64 decode error in quality check: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        from receipt_ai_service import receipt_ai_service
        quality_result = await receipt_ai_service.check_image_quality(clean_image)
        
        return quality_result
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error checking receipt quality: {str(e)}')
        return {
            'success': True,
            'quality_score': 70,
            'is_acceptable': True,
            'issues': [],
            'suggestions': [],
            'message': 'No se pudo verificar la calidad'
        }


@receipts_router.post('/receipts/upload')
async def upload_expense_receipt(
    request: Request,
    image: str = Body(..., description="Base64 encoded image"),
    notes: Optional[str] = Body(None, description="Optional notes from client"),
):
    current_user = await _auth_user(request)
    user_id = current_user['id']

    # ── Check receipt usage limits ──
    plan_info = await _get_user_receipt_plan(user_id)
    used = await _get_monthly_receipt_count(user_id)
    limit = plan_info["limit"]
    is_unlimited = limit >= 999999

    if not is_unlimited and used >= limit:
        plan_name = plan_info["plan_label"]
        raise HTTPException(
            status_code=429,
            detail={
                "message": f"Has alcanzado tu límite de {limit} recibos este mes ({plan_name}). Actualiza tu plan para escanear más.",
                "code": "receipt_limit_reached",
                "used": used,
                "limit": limit,
                "plan": plan_info["plan"],
            }
        )

    """Client uploads an expense receipt - AI will classify it automatically"""
    try:
        import base64
        
        if not image:
            raise HTTPException(status_code=400, detail="No image provided")
        
        clean_image = image
        if ',' in clean_image:
            clean_image = clean_image.split(',')[1]
        
        try:
            decoded = base64.b64decode(clean_image)
            if len(decoded) > 10 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Base64 decode error: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid image format")
        
        receipt_id = str(uuid.uuid4())
        
        receipt = {
            '_id': receipt_id,
            'user_id': current_user['id'],
            'user_name': current_user.get('name', ''),
            'user_email': current_user.get('email', ''),
            'image': clean_image,
            'notes': notes,
            'status': 'processing',
            'category': None,
            'merchant': None,
            'amount': None,
            'receipt_date': None,
            'ai_confidence': None,
            'ai_raw_response': None,
            'admin_notes': None,
            'reviewed_by': None,
            'reviewed_at': None,
            'created_at': datetime.utcnow(),
            'year': datetime.utcnow().year,
            'month': datetime.utcnow().month,
        }
        
        await _db.expense_receipts.insert_one(receipt)
        logging.info(f"📧 Receipt {receipt_id} created, starting AI classification...")
        
        ai_result = None
        try:
            from receipt_ai_service import classify_receipt
            ai_result = await classify_receipt(clean_image)
            
            if ai_result.get('success'):
                update_data = {
                    'status': 'classified',
                    'category': ai_result.get('category'),
                    'merchant': ai_result.get('merchant'),
                    'amount': ai_result.get('amount'),
                    'receipt_date': ai_result.get('receipt_date'),
                    'ai_confidence': ai_result.get('confidence'),
                    'ai_raw_response': ai_result.get('raw_response'),
                    'ai_classified_at': datetime.utcnow()
                }
                await _db.expense_receipts.update_one(
                    {'_id': receipt_id},
                    {'$set': update_data}
                )
                logging.info(f"✅ Receipt {receipt_id} classified: {ai_result.get('category')} - ${ai_result.get('amount')}")
            else:
                await _db.expense_receipts.update_one(
                    {'_id': receipt_id},
                    {'$set': {'status': 'pending', 'ai_error': ai_result.get('error')}}
                )
                logging.warning(f"⚠️ AI classification failed for receipt {receipt_id}: {ai_result.get('error')}")
        except Exception as ai_error:
            logging.error(f"❌ AI classification error for receipt {receipt_id}: {str(ai_error)}")
            await _db.expense_receipts.update_one(
                {'_id': receipt_id},
                {'$set': {'status': 'pending', 'ai_error': str(ai_error)}}
            )
        
        try:
            import requests
            admin_users = await _db.users.find({'role': 'admin', 'push_token': {'$exists': True, '$ne': None}}).to_list(10)
            for admin in admin_users:
                push_token = admin.get('push_token') or admin.get('fcm_token')
                if push_token and push_token.startswith('ExponentPushToken'):
                    ai_info = ""
                    if ai_result and ai_result.get('success'):
                        cat = ai_result.get('category', 'N/A')
                        amt = ai_result.get('amount')
                        ai_info = f" - {cat}" + (f" ${amt:.2f}" if amt else "")
                    
                    requests.post(
                        "https://exp.host/--/api/v2/push/send",
                        json={
                            "to": push_token,
                            "title": "📧 Nuevo Recibo" + (" ✨ Clasificado" if ai_result and ai_result.get('success') else ""),
                            "body": f"{current_user.get('name', 'Cliente')} subió un recibo{ai_info}",
                            "data": {"type": "new_receipt", "receipt_id": receipt_id}
                        },
                        headers={"Content-Type": "application/json"},
                        timeout=5
                    )
        except Exception as e:
            logging.warning(f"Could not send receipt notification: {e}")
        
        response = {
            'success': True,
            'message': 'Recibo subido y clasificado exitosamente' if (ai_result and ai_result.get('success')) else 'Recibo subido exitosamente (pendiente de clasificación)',
            'receipt_id': receipt_id,
            'ai_classified': ai_result.get('success') if ai_result else False
        }
        
        if ai_result and ai_result.get('success'):
            response['classification'] = {
                'category': ai_result.get('category'),
                'merchant': ai_result.get('merchant'),
                'amount': ai_result.get('amount'),
                'receipt_date': ai_result.get('receipt_date'),
                'confidence': ai_result.get('confidence')
            }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error uploading receipt: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/receipts/my-receipts')
async def get_my_receipts(
    request: Request,
    year: int = Query(None),
):
    current_user = await _auth_user(request)
    try:
        query = {'user_id': current_user['id']}
        if year:
            query['year'] = year
        
        receipts = await _db.expense_receipts.find(query).sort('created_at', -1).to_list(500)
        
        totals_by_category = {}
        total_amount = 0
        
        for receipt in receipts:
            if receipt.get('amount'):
                amount = float(receipt['amount'])
                total_amount += amount
                category = receipt.get('category') or 'Sin clasificar'
                totals_by_category[category] = totals_by_category.get(category, 0) + amount
        
        return {
            'receipts': [{
                'id': r['_id'],
                'image_preview': r.get('image', '')[:100] + '...' if r.get('image') else None,
                'category': r.get('category'),
                'merchant': r.get('merchant'),
                'amount': r.get('amount'),
                'receipt_date': r.get('receipt_date'),
                'status': r.get('status'),
                'notes': r.get('notes'),
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
                'year': r.get('year'),
                'month': r.get('month'),
            } for r in receipts],
            'summary': {
                'total_receipts': len(receipts),
                'total_amount': round(total_amount, 2),
                'by_category': totals_by_category,
                'current_year': year or datetime.utcnow().year
            }
        }
    except Exception as e:
        logging.error(f'Error getting receipts: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts')
async def get_all_receipts_admin(
    request: Request,
    user_id: str = Query(None),
    year: int = Query(None),
    category: str = Query(None),
    status: str = Query(None),
    limit: int = Query(100, le=500),
):
    current_user = await _require_admin(request)
    try:
        query = {}
        if user_id:
            query['user_id'] = user_id
        if year:
            query['year'] = year
        if category:
            query['category'] = category
        if status:
            query['status'] = status
        
        receipts = await _db.expense_receipts.find(query).sort('created_at', -1).limit(limit).to_list(limit)
        
        total_pending = await _db.expense_receipts.count_documents({'status': 'pending'})
        total_this_year = await _db.expense_receipts.count_documents({'year': datetime.utcnow().year})
        
        result_receipts = []
        for r in receipts:
            user_name = r.get('user_name', '')
            user_email = r.get('user_email', '')
            r_user_id = r.get('user_id')
            
            if r_user_id and (not user_name or user_name == 'Ross Tax Preparation' or user_name == 'Unknown'):
                user = await _db.users.find_one({'_id': r_user_id})
                if not user:
                    user = await _db.users.find_one({'_id': str(r_user_id)})
                if not user and len(str(r_user_id)) == 24:
                    try:
                        user = await _db.users.find_one({'_id': ObjectId(r_user_id)})
                    except Exception:
                        pass
                if not user:
                    if user_email:
                        user = await _db.users.find_one({'email': user_email})
                
                if user:
                    user_name = user.get('full_name') or user.get('name') or user_name
                    user_email = user.get('email') or user_email
            
            result_receipts.append({
                'id': r['_id'],
                'user_id': r_user_id,
                'user_name': user_name,
                'user_email': user_email,
                'has_image': bool(r.get('image')),
                'category': r.get('category'),
                'merchant': r.get('merchant'),
                'amount': r.get('amount'),
                'receipt_date': r.get('receipt_date'),
                'status': r.get('status', 'pending'),
                'notes': r.get('notes'),
                'admin_notes': r.get('admin_notes'),
                'ai_confidence': r.get('ai_confidence'),
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None,
                'reviewed_by': r.get('reviewed_by'),
                'reviewed_at': r.get('reviewed_at').isoformat() if r.get('reviewed_at') else None,
                'year': r.get('year'),
                'month': r.get('month'),
            })
        
        return {
            'receipts': result_receipts,
            'stats': {
                'total': len(result_receipts),
                'pending': total_pending,
                'classified': await _db.expense_receipts.count_documents({'status': {'$in': ['classified', 'reviewed']}}),
                'total_amount': sum([r.get('amount') or 0 for r in receipts]),
                'total_pending': total_pending,
                'total_this_year': total_this_year,
                'showing': len(result_receipts)
            }
        }
    except Exception as e:
        logging.error(f'Error getting admin receipts: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts/dashboard')
async def get_receipts_dashboard(
    request: Request,
    year: int = Query(None),
):
    current_user = await _require_admin(request)
    try:
        current_year = year or datetime.utcnow().year
        
        receipts = await _db.expense_receipts.find({'year': current_year}).to_list(10000)
        
        total_receipts = len(receipts)
        total_amount = sum(float(r.get('amount') or 0) for r in receipts)
        pending_count = sum(1 for r in receipts if r.get('status') == 'pending')
        classified_count = sum(1 for r in receipts if r.get('status') == 'classified')
        reviewed_count = sum(1 for r in receipts if r.get('status') == 'reviewed')
        
        by_category = {}
        for r in receipts:
            cat = r.get('category') or 'Sin clasificar'
            if cat not in by_category:
                by_category[cat] = {'count': 0, 'amount': 0}
            by_category[cat]['count'] += 1
            by_category[cat]['amount'] += float(r.get('amount') or 0)
        
        by_month = {}
        for r in receipts:
            month = r.get('month', 1)
            month_name = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][month - 1]
            if month not in by_month:
                by_month[month] = {'name': month_name, 'count': 0, 'amount': 0}
            by_month[month]['count'] += 1
            by_month[month]['amount'] += float(r.get('amount') or 0)
        
        by_client = {}
        for r in receipts:
            r_user_id = r.get('user_id')
            user_name = r.get('user_name', 'Desconocido')
            if r_user_id not in by_client:
                by_client[r_user_id] = {'name': user_name, 'count': 0, 'amount': 0}
            by_client[r_user_id]['count'] += 1
            by_client[r_user_id]['amount'] += float(r.get('amount') or 0)
        
        top_clients = sorted(by_client.items(), key=lambda x: x[1]['amount'], reverse=True)[:10]
        top_clients_list = [
            {'user_id': uid, 'name': data['name'], 'count': data['count'], 'amount': round(data['amount'], 2)}
            for uid, data in top_clients
        ]
        
        ai_classified = sum(1 for r in receipts if r.get('ai_confidence') is not None and r.get('ai_confidence') > 0)
        avg_confidence = 0
        if ai_classified > 0:
            confidences = [r.get('ai_confidence') for r in receipts if r.get('ai_confidence')]
            avg_confidence = sum(confidences) / len(confidences)
        
        categories_list = [
            {'category': cat, 'count': data['count'], 'amount': round(data['amount'], 2)}
            for cat, data in sorted(by_category.items(), key=lambda x: x[1]['amount'], reverse=True)
        ]
        
        months_list = [
            {'month': m, 'name': data['name'], 'count': data['count'], 'amount': round(data['amount'], 2)}
            for m, data in sorted(by_month.items())
        ]
        
        return {
            'year': current_year,
            'summary': {
                'total_receipts': total_receipts,
                'total_amount': round(total_amount, 2),
                'pending': pending_count,
                'classified': classified_count,
                'reviewed': reviewed_count,
                'ai_classified': ai_classified,
                'avg_ai_confidence': round(avg_confidence * 100, 1)
            },
            'by_category': categories_list,
            'by_month': months_list,
            'top_clients': top_clients_list,
            'available_years': list(range(2024, datetime.utcnow().year + 1))
        }
    except Exception as e:
        logging.error(f'Error getting receipts dashboard: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts/export')
async def export_receipts(
    request: Request,
    year: int = Query(None),
    format: str = Query('csv', description="Export format: csv or json"),
):
    current_user = await _require_admin(request)
    try:
        current_year = year or datetime.utcnow().year
        receipts = await _db.expense_receipts.find({'year': current_year}).to_list(10000)
        
        export_data = []
        for r in receipts:
            export_data.append({
                'ID': r.get('_id'),
                'Cliente': r.get('user_name', ''),
                'Email': r.get('user_email', ''),
                'Categoría': r.get('category') or 'Sin clasificar',
                'Comercio': r.get('merchant') or '',
                'Monto': r.get('amount') or 0,
                'Fecha Recibo': r.get('receipt_date') or '',
                'Estado': r.get('status', 'pending'),
                'Confianza IA': f"{(r.get('ai_confidence') or 0) * 100:.0f}%" if r.get('ai_confidence') else 'N/A',
                'Notas': r.get('notes') or '',
                'Notas Admin': r.get('admin_notes') or '',
                'Fecha Subida': r.get('created_at').strftime('%Y-%m-%d %H:%M') if r.get('created_at') else '',
                'Mes': r.get('month', ''),
                'Año': r.get('year', current_year)
            })
        
        if format == 'json':
            return {
                'year': current_year,
                'total': len(export_data),
                'data': export_data
            }
        else:
            import csv
            from io import StringIO
            
            if not export_data:
                return Response(
                    content="No hay datos para exportar",
                    media_type="text/plain"
                )
            
            output = StringIO()
            writer = csv.DictWriter(output, fieldnames=export_data[0].keys())
            writer.writeheader()
            writer.writerows(export_data)
            
            csv_content = output.getvalue()
            
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=recibos_{current_year}.csv"
                }
            )
    except Exception as e:
        logging.error(f'Error exporting receipts: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts/{receipt_id}')
async def get_receipt_detail(
    receipt_id: str,
    request: Request,
):
    current_user = await _require_admin(request)
    try:
        receipt = await _db.expense_receipts.find_one({'_id': receipt_id})
        if not receipt:
            raise HTTPException(status_code=404, detail='Receipt not found')
        
        return {
            'id': receipt['_id'],
            'user_id': receipt.get('user_id'),
            'user_name': receipt.get('user_name'),
            'user_email': receipt.get('user_email'),
            'image': receipt.get('image'),
            'category': receipt.get('category'),
            'merchant': receipt.get('merchant'),
            'amount': receipt.get('amount'),
            'receipt_date': receipt.get('receipt_date'),
            'status': receipt.get('status'),
            'notes': receipt.get('notes'),
            'admin_notes': receipt.get('admin_notes'),
            'ai_confidence': receipt.get('ai_confidence'),
            'ai_raw_response': receipt.get('ai_raw_response'),
            'created_at': receipt.get('created_at').isoformat() if receipt.get('created_at') else None,
            'reviewed_by': receipt.get('reviewed_by'),
            'reviewed_at': receipt.get('reviewed_at').isoformat() if receipt.get('reviewed_at') else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error getting receipt: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts/{receipt_id}/image')
async def get_receipt_image(
    receipt_id: str,
    request: Request,
):
    current_user = await _require_admin(request)
    try:
        receipt = await _db.expense_receipts.find_one({'_id': receipt_id})
        if not receipt:
            raise HTTPException(status_code=404, detail='Receipt not found')
        
        return {
            'image_data': receipt.get('image', ''),
            'merchant': receipt.get('merchant'),
            'category': receipt.get('category'),
            'amount': receipt.get('amount'),
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error getting receipt image: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.put('/admin/receipts/{receipt_id}')
async def update_receipt(
    receipt_id: str,
    request: Request,
    category: str = Body(None),
    merchant: str = Body(None),
    amount: float = Body(None),
    receipt_date: str = Body(None),
    admin_notes: str = Body(None),
    status: str = Body(None),
):
    current_user = await _require_admin(request)
    try:
        receipt = await _db.expense_receipts.find_one({'_id': receipt_id})
        if not receipt:
            raise HTTPException(status_code=404, detail='Receipt not found')
        
        update_data = {'updated_at': datetime.utcnow()}
        
        if category is not None:
            update_data['category'] = category
        if merchant is not None:
            update_data['merchant'] = merchant
        if amount is not None:
            update_data['amount'] = amount
        if receipt_date is not None:
            update_data['receipt_date'] = receipt_date
        if admin_notes is not None:
            update_data['admin_notes'] = admin_notes
        if status is not None:
            update_data['status'] = status
            if status == 'reviewed':
                update_data['reviewed_by'] = current_user.get('email')
                update_data['reviewed_at'] = datetime.utcnow()
        
        await _db.expense_receipts.update_one({'_id': receipt_id}, {'$set': update_data})
        
        return {'success': True, 'message': 'Recibo actualizado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error updating receipt: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.delete('/admin/receipts/{receipt_id}')
async def delete_receipt(
    receipt_id: str,
    request: Request,
):
    current_user = await _require_admin(request)
    try:
        result = await _db.expense_receipts.delete_one({'_id': receipt_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail='Receipt not found')
        
        return {'success': True, 'message': 'Recibo eliminado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f'Error deleting receipt: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts/client/{user_id}/summary')
async def get_client_receipts_summary(
    user_id: str,
    request: Request,
    year: int = Query(None),
):
    current_user = await _require_admin(request)
    try:
        query = {'user_id': user_id}
        if year:
            query['year'] = year
        else:
            query['year'] = datetime.utcnow().year
        
        receipts = await _db.expense_receipts.find(query).to_list(1000)
        
        by_category = {}
        by_month = {}
        total = 0
        
        for r in receipts:
            amount = float(r.get('amount') or 0)
            total += amount
            
            cat = r.get('category') or 'Sin clasificar'
            by_category[cat] = by_category.get(cat, 0) + amount
            
            month = r.get('month', 1)
            by_month[month] = by_month.get(month, 0) + amount
        
        client = await _db.users.find_one({'_id': user_id})
        
        return {
            'client': {
                'id': user_id,
                'name': client.get('name') if client else 'Desconocido',
                'email': client.get('email') if client else ''
            },
            'year': year or datetime.utcnow().year,
            'total_receipts': len(receipts),
            'total_amount': round(total, 2),
            'by_category': by_category,
            'by_month': by_month
        }
    except Exception as e:
        logging.error(f'Error getting client summary: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN: RECIBOS PRO SUBSCRIPTION MANAGEMENT ==================

@receipts_router.get('/admin/receipts-pro/subscribers')
async def list_receipts_pro_subscribers(request: Request):
    """List ALL Recibos Pro subscribers — active, cancelled, expired."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        status_filter = request.query_params.get('status', 'all')
        search = request.query_params.get('search', '').strip()
        
        query = {"apple_product_id": "com.rosstax.plan.receipts.monthly"}
        if status_filter and status_filter != 'all':
            query["status"] = status_filter
        
        subs = await _db.user_subscriptions.find(query).sort("activated_at", -1).to_list(1000)
        
        result = []
        total_revenue = 0
        active_count = 0
        cancelled_count = 0
        
        for sub in subs:
            user = await _db.users.find_one({"id": sub["user_id"]}, {"name": 1, "email": 1, "phone": 1})
            user_name = user.get("name", "—") if user else "—"
            user_email = user.get("email", "—") if user else "—"
            user_phone = user.get("phone", "—") if user else "—"
            
            # Search filter
            if search:
                search_lower = search.lower()
                if search_lower not in user_name.lower() and search_lower not in user_email.lower() and search_lower not in user_phone.lower():
                    continue
            
            # Calculate total paid (price * months active)
            price = sub.get("price", 9.99)
            activated_str = sub.get("activated_at", "")
            cancelled_str = sub.get("cancelled_at", "")
            months_active = 1
            try:
                if activated_str:
                    activated_dt = datetime.fromisoformat(activated_str.replace('Z', '+00:00')) if isinstance(activated_str, str) else activated_str
                    end_dt = datetime.fromisoformat(cancelled_str.replace('Z', '+00:00')) if cancelled_str and isinstance(cancelled_str, str) else datetime.utcnow()
                    diff = (end_dt - activated_dt.replace(tzinfo=None) if activated_dt.tzinfo and not end_dt.tzinfo else end_dt - activated_dt)
                    months_active = max(1, int(diff.days / 30) + 1)
            except:
                months_active = 1
            
            total_paid = round(price * months_active, 2)
            is_active = sub.get("status", "active") == "active"
            if is_active:
                active_count += 1
                total_revenue += total_paid
            else:
                cancelled_count += 1
            
            result.append({
                "subscription_id": str(sub["_id"]),
                "user_id": sub["user_id"],
                "user_name": user_name,
                "user_email": user_email,
                "user_phone": user_phone,
                "status": sub.get("status", "active"),
                "source": sub.get("source", "iap"),
                "price": price,
                "billing_period": sub.get("billing_period", "monthly"),
                "activated_at": activated_str,
                "cancelled_at": cancelled_str,
                "cancelled_by": sub.get("cancelled_by", ""),
                "activated_by": sub.get("activated_by", ""),
                "expires_at": sub.get("expires_at", ""),
                "months_active": months_active,
                "total_paid": total_paid,
                "merchant_one_id": sub.get("merchant_subscription_id", ""),
                "transaction_id": sub.get("transaction_id", ""),
            })

        return {
            "success": True,
            "subscribers": result,
            "total": len(result),
            "stats": {
                "total": len(result),
                "active": active_count,
                "cancelled": cancelled_count,
                "total_revenue": round(total_revenue, 2),
                "mrr": round(active_count * 9.99, 2),
            }
        }
    except Exception as e:
        logger.error(f"Error listing receipts pro subscribers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/receipts-pro/activate')
async def admin_activate_receipts_pro(request: Request):
    """Admin activates Recibos Pro for a client (manual/office subscription)."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    try:
        # Check if already active
        existing = await _db.user_subscriptions.find_one({
            "user_id": user_id,
            "apple_product_id": "com.rosstax.plan.receipts.monthly",
            "status": "active",
        })
        if existing:
            return {"success": True, "message": "Ya tiene Recibos Pro activo", "already_active": True}

        # Create subscription
        sub_doc = {
            "user_id": user_id,
            "apple_product_id": "com.rosstax.plan.receipts.monthly",
            "plan_name": "Recibos Pro",
            "price": 9.99,
            "billing_period": "monthly",
            "status": "active",
            "source": "admin_manual",
            "activated_at": datetime.utcnow().isoformat(),
            "activated_by": admin.get("id", admin.get("email", "admin")),
            "created_at": datetime.utcnow().isoformat(),
        }
        await _db.user_subscriptions.insert_one(sub_doc)

        # Get user info for confirmation
        user = await _db.users.find_one({"id": user_id}, {"name": 1, "email": 1})
        user_name = user.get("name", user_id) if user else user_id

        logger.info(f"✅ Admin activated Recibos Pro for {user_name} ({user_id})")

        return {
            "success": True,
            "message": f"Recibos Pro activado para {user_name}",
            "user_id": user_id,
            "user_name": user_name,
        }
    except Exception as e:
        logger.error(f"Error activating receipts pro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/receipts-pro/deactivate')
async def admin_deactivate_receipts_pro(request: Request):
    """Admin deactivates Recibos Pro for a client."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    try:
        result = await _db.user_subscriptions.update_many(
            {
                "user_id": user_id,
                "apple_product_id": "com.rosstax.plan.receipts.monthly",
                "status": "active",
            },
            {"$set": {
                "status": "cancelled",
                "cancelled_at": datetime.utcnow().isoformat(),
                "cancelled_by": admin.get("id", admin.get("email", "admin")),
            }}
        )

        user = await _db.users.find_one({"id": user_id}, {"name": 1})
        user_name = user.get("name", user_id) if user else user_id

        return {
            "success": True,
            "message": f"Recibos Pro desactivado para {user_name}",
            "modified": result.modified_count,
        }
    except Exception as e:
        logger.error(f"Error deactivating receipts pro: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@receipts_router.delete('/admin/receipts-pro/subscription/{subscription_id}')
async def delete_receipts_pro_subscription(request: Request, subscription_id: str):
    """Admin permanently deletes a Recibos Pro subscription record."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from bson import ObjectId
        result = await _db.user_subscriptions.delete_one({"_id": ObjectId(subscription_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        
        logger.info(f"🗑️ Admin deleted subscription {subscription_id}")
        return {"success": True, "message": "Suscripción eliminada permanentemente"}
    except Exception as e:
        logger.error(f"Error deleting subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@receipts_router.get('/admin/receipts-pro/search-clients')
async def search_clients_for_receipts_pro(request: Request, q: str = Query("", min_length=1)):
    """Search clients to add Recibos Pro subscription."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        query_filter = {
            "role": {"$ne": "admin"},
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}},
                {"phone": {"$regex": q, "$options": "i"}},
            ]
        }
        users = await _db.users.find(query_filter, {
            "name": 1, "email": 1, "phone": 1, "_id": 1
        }).limit(20).to_list(20)

        # Check subscription status for each
        for user in users:
            # Get user ID - try both 'id' field and '_id' field, convert ObjectId to string
            user_id = user.get("id") or str(user.get("_id", ""))
            user["id"] = user_id  # Ensure id field exists
            
            # Remove _id to avoid serialization issues
            if "_id" in user:
                del user["_id"]
            
            sub = await _db.user_subscriptions.find_one({
                "user_id": user_id,
                "apple_product_id": "com.rosstax.plan.receipts.monthly",
                "status": "active",
            })
            user["has_receipts_pro"] = sub is not None

        return {"success": True, "clients": users}
    except Exception as e:
        logger.error(f"Error searching clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/receipts-pro/client-payment-methods/{user_id}')
async def get_client_payment_methods_for_pro(request: Request, user_id: str):
    """Get a client's saved payment methods (cards + bank accounts) for charging."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from dynamic_services import get_user_payment_methods
        methods = await get_user_payment_methods(_db, user_id)
        user = await _db.users.find_one({"id": user_id}, {"name": 1, "email": 1})
        return {
            "success": True,
            "user_id": user_id,
            "user_name": user.get("name", "—") if user else "—",
            "payment_methods": methods,
        }
    except Exception as e:
        logger.error(f"Error getting payment methods for {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/receipts-pro/charge-and-activate')
async def charge_and_activate_receipts_pro(request: Request):
    """
    Charge client's saved card/bank via Merchant One and activate Recibos Pro.
    Body: { user_id, payment_method_id }
    """
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    body = await request.json()
    user_id = body.get("user_id")
    payment_method_id = body.get("payment_method_id")

    if not user_id or not payment_method_id:
        raise HTTPException(status_code=400, detail="user_id and payment_method_id required")

    try:
        # Check if already active
        existing = await _db.user_subscriptions.find_one({
            "user_id": user_id,
            "apple_product_id": "com.rosstax.plan.receipts.monthly",
            "status": "active",
        })
        if existing:
            return {"success": True, "message": "Ya tiene Recibos Pro activo", "already_active": True}

        # Charge via Merchant One (NMI)
        from dynamic_services import charge_saved_card
        import uuid as uuid_mod

        order_id = f"RPRO-{uuid_mod.uuid4().hex[:8].upper()}"
        charge_result = await charge_saved_card(
            _db,
            card_id=payment_method_id,
            amount=9.99,
            order_id=order_id,
            description="Recibos Pro - Escaneo Ilimitado de Recibos (Mensual)"
        )

        if not charge_result.get('success'):
            error_msg = charge_result.get('error', 'Error al procesar el cobro')
            return {"success": False, "message": f"Cobro fallido: {error_msg}"}

        # Charge successful — activate subscription
        sub_doc = {
            "user_id": user_id,
            "apple_product_id": "com.rosstax.plan.receipts.monthly",
            "plan_name": "Recibos Pro",
            "price": 9.99,
            "billing_period": "monthly",
            "status": "active",
            "source": "merchant_one",
            "payment_method_id": payment_method_id,
            "transaction_id": charge_result.get('transaction_id', ''),
            "order_id": order_id,
            "activated_at": datetime.utcnow().isoformat(),
            "activated_by": admin.get("id", admin.get("email", "admin")),
            "created_at": datetime.utcnow().isoformat(),
        }
        await _db.user_subscriptions.insert_one(sub_doc)

        user = await _db.users.find_one({"id": user_id}, {"name": 1, "email": 1})
        user_name = user.get("name", user_id) if user else user_id

        logger.info(f"✅ Recibos Pro charged & activated for {user_name} via Merchant One (order: {order_id})")

        return {
            "success": True,
            "message": f"Cobro de $9.99 exitoso y Recibos Pro activado para {user_name}",
            "transaction_id": charge_result.get('transaction_id', ''),
            "order_id": order_id,
            "user_name": user_name,
        }
    except Exception as e:
        logger.error(f"Error charging and activating receipts pro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/receipts-pro/create-recurring')
async def create_recurring_receipts_pro(request: Request):
    """
    Create a recurring $9.99/month subscription via Merchant One for Recibos Pro.
    Body: { user_id, payment_method_id }
    """
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    body = await request.json()
    user_id = body.get("user_id")
    payment_method_id = body.get("payment_method_id")

    if not user_id or not payment_method_id:
        raise HTTPException(status_code=400, detail="user_id and payment_method_id required")

    try:
        from bson import ObjectId as ObjId

        # Get payment method's NMI vault ID
        pm = None
        if ObjId.is_valid(payment_method_id):
            pm = await _db.payment_methods.find_one({"_id": ObjId(payment_method_id), "active": {"$ne": False}})
        if not pm:
            pm = await _db.payment_methods.find_one({"nmi_vault_id": payment_method_id, "active": {"$ne": False}})

        if not pm:
            return {"success": False, "message": "Método de pago no encontrado"}

        nmi_vault_id = pm.get("nmi_vault_id")
        if not nmi_vault_id:
            return {"success": False, "message": "Este método no tiene token NMI. Pida al cliente agregar la tarjeta desde la app."}

        # Create recurring subscription via NMI
        from merchant_one_service import MerchantOneService
        from merchant_one_models import SubscriptionInfo

        merchant_svc = MerchantOneService(_db)
        sub_info = SubscriptionInfo(
            planName="Recibos Pro",
            amount=9.99,
            dayFrequency=30,  # monthly
            startDate="",     # Will be calculated by get_valid_start_date()
            planPayments=0,   # until_cancelled
            orderDescription="Recibos Pro - Escaneo Ilimitado de Recibos ($9.99/mes)"
        )
        response = await merchant_svc.create_subscription(nmi_vault_id, sub_info)

        if not response.success or response.responseCode != '1':
            error_msg = response.errorMessage or response.responseText or 'Error desconocido'
            return {"success": False, "message": f"Error al crear suscripción recurrente: {error_msg}"}

        subscription_id = response.subscriptionId or response.transactionId or ''

        # Save subscription record
        sub_doc = {
            "user_id": user_id,
            "apple_product_id": "com.rosstax.plan.receipts.monthly",
            "plan_name": "Recibos Pro",
            "price": 9.99,
            "billing_period": "monthly",
            "status": "active",
            "source": "merchant_one_recurring",
            "payment_method_id": payment_method_id,
            "nmi_vault_id": nmi_vault_id,
            "nmi_subscription_id": subscription_id,
            "activated_at": datetime.utcnow().isoformat(),
            "activated_by": admin.get("id", admin.get("email", "admin")),
            "created_at": datetime.utcnow().isoformat(),
        }
        await _db.user_subscriptions.insert_one(sub_doc)

        user = await _db.users.find_one({"id": user_id}, {"name": 1})
        user_name = user.get("name", user_id) if user else user_id

        logger.info(f"✅ Recurring Recibos Pro created for {user_name} via NMI (sub: {subscription_id})")

        return {
            "success": True,
            "message": f"Suscripción recurrente de $9.99/mes creada para {user_name}. Se cobrará automáticamente cada mes.",
            "subscription_id": subscription_id,
            "user_name": user_name,
        }
    except Exception as e:
        logger.error(f"Error creating recurring receipts pro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/receipts-pro/create-client')
async def admin_create_client(request: Request):
    """
    Admin creates a new client quickly (for walk-ins or phone clients).
    Body: { name, email, phone? }
    """
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    phone = body.get("phone", "").strip()

    if not name or not email:
        raise HTTPException(status_code=400, detail="Nombre y email son requeridos")

    try:
        # Check if email already exists
        existing = await _db.users.find_one({"email": email})
        if existing:
            user_id = existing.get("id", str(existing.get("_id", "")))
            return {
                "success": True,
                "message": f"El cliente {name} ya existe con ese email",
                "already_exists": True,
                "client": {
                    "id": user_id,
                    "name": existing.get("name", name),
                    "email": email,
                    "phone": existing.get("phone", phone),
                    "has_receipts_pro": False,
                }
            }

        # Create new client
        import uuid as uuid_mod

        user_id = str(uuid_mod.uuid4())
        # Generate a temporary password
        import hashlib
        temp_password = f"Ross{phone[-4:] if len(phone) >= 4 else '2026'}!"
        password_hash = hashlib.sha256(temp_password.encode()).hexdigest()

        new_user = {
            "id": user_id,
            "name": name,
            "email": email,
            "phone": phone,
            "password": password_hash,
            "role": "client",
            "created_at": datetime.utcnow().isoformat(),
            "created_by": admin.get("id", admin.get("email", "admin")),
            "source": "admin_created",
            "receipt_scans_this_month": 0,
            "receipt_scan_month": datetime.utcnow().strftime("%Y-%m"),
        }
        await _db.users.insert_one(new_user)

        logger.info(f"✅ Admin created new client: {name} ({email})")

        return {
            "success": True,
            "message": f"Cliente {name} creado exitosamente",
            "already_exists": False,
            "client": {
                "id": user_id,
                "name": name,
                "email": email,
                "phone": phone,
                "has_receipts_pro": False,
            },
            "temp_password": temp_password,
        }
    except Exception as e:
        logger.error(f"Error creating client: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════
# MI NEGOCIO — ALL SUBSCRIPTIONS MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

@receipts_router.get('/admin/mi-negocio/subscriptions')
async def list_all_subscriptions(request: Request):
    """List ALL subscriptions across all plans with stats."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        status_filter = request.query_params.get('status', 'all')
        plan_filter = request.query_params.get('plan', 'all')
        search = request.query_params.get('search', '').strip()

        query = {}
        if status_filter and status_filter != 'all':
            query["status"] = status_filter
        if plan_filter and plan_filter != 'all':
            query["apple_product_id"] = plan_filter

        subs = await _db.user_subscriptions.find(query).sort("activated_at", -1).to_list(2000)

        # Get all plans for reference
        plans_list = await _db.subscription_plans.find({}).to_list(20)
        plans_map = {}
        for p in plans_list:
            plans_map[p.get('apple_product_id', '')] = {
                'name': p.get('name', 'Unknown'),
                'price': p.get('price', 0),
                'billing_period': p.get('billing_period', 'monthly'),
                'tier': p.get('tier', ''),
                'features': p.get('features', []),
            }

        result = []
        total_revenue = 0
        active_count = 0
        cancelled_count = 0
        plan_stats = {}

        for sub in subs:
            user = await _db.users.find_one({"id": sub["user_id"]}, {"name": 1, "email": 1, "phone": 1})
            user_name = user.get("name", "—") if user else "Eliminado"
            user_email = user.get("email", "—") if user else "—"
            user_phone = user.get("phone", "—") if user else "—"

            if search:
                sl = search.lower()
                if sl not in user_name.lower() and sl not in user_email.lower() and sl not in (user_phone or '').lower():
                    continue

            product_id = sub.get("apple_product_id", "unknown")
            plan_info = plans_map.get(product_id, {'name': product_id, 'price': sub.get('price', 0), 'billing_period': 'monthly', 'tier': '', 'features': []})
            price = sub.get("price", plan_info['price'])

            activated_str = sub.get("activated_at", "")
            cancelled_str = sub.get("cancelled_at", "")
            months_active = 1
            try:
                if activated_str:
                    act = datetime.fromisoformat(str(activated_str).replace('Z', '+00:00')) if isinstance(activated_str, str) else activated_str
                    end = datetime.fromisoformat(str(cancelled_str).replace('Z', '+00:00')) if cancelled_str and isinstance(cancelled_str, str) else datetime.utcnow()
                    act_naive = act.replace(tzinfo=None) if act.tzinfo else act
                    end_naive = end.replace(tzinfo=None) if end.tzinfo else end
                    months_active = max(1, int((end_naive - act_naive).days / 30) + 1)
            except:
                months_active = 1

            total_paid = round(price * months_active, 2)
            is_active = sub.get("status", "active") == "active"

            if is_active:
                active_count += 1
                total_revenue += total_paid
            else:
                cancelled_count += 1

            # Plan stats aggregation
            if product_id not in plan_stats:
                plan_stats[product_id] = {'name': plan_info['name'], 'price': price, 'active': 0, 'cancelled': 0, 'total': 0, 'revenue': 0}
            plan_stats[product_id]['total'] += 1
            if is_active:
                plan_stats[product_id]['active'] += 1
                plan_stats[product_id]['revenue'] += total_paid
            else:
                plan_stats[product_id]['cancelled'] += 1

            result.append({
                "subscription_id": str(sub["_id"]),
                "user_id": sub["user_id"],
                "user_name": user_name,
                "user_email": user_email,
                "user_phone": user_phone,
                "status": sub.get("status", "active"),
                "source": sub.get("source", "iap"),
                "plan_id": product_id,
                "plan_name": plan_info['name'],
                "plan_tier": plan_info.get('tier', ''),
                "price": price,
                "billing_period": sub.get("billing_period", plan_info['billing_period']),
                "activated_at": str(activated_str) if activated_str else "",
                "cancelled_at": str(cancelled_str) if cancelled_str else "",
                "cancelled_by": sub.get("cancelled_by", ""),
                "activated_by": sub.get("activated_by", ""),
                "expires_at": str(sub.get("expires_at", "")) if sub.get("expires_at") else "",
                "months_active": months_active,
                "total_paid": total_paid,
                "merchant_one_id": sub.get("merchant_subscription_id", ""),
                "transaction_id": sub.get("transaction_id", ""),
            })

        return {
            "success": True,
            "subscriptions": result,
            "total": len(result),
            "stats": {
                "total": len(result),
                "active": active_count,
                "cancelled": cancelled_count,
                "total_revenue": round(total_revenue, 2),
                "mrr": round(active_count * 9.99, 2),
            },
            "plan_stats": list(plan_stats.values()),
            "available_plans": [{"id": p.get("apple_product_id"), "name": p.get("name"), "price": p.get("price"), "billing_period": p.get("billing_period")} for p in plans_list],
        }
    except Exception as e:
        logger.error(f"Error listing all subscriptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.delete('/admin/mi-negocio/subscription/{subscription_id}')
async def delete_any_subscription(request: Request, subscription_id: str):
    """Admin permanently deletes any subscription record."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        from bson import ObjectId
        result = await _db.user_subscriptions.delete_one({"_id": ObjectId(subscription_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        return {"success": True, "message": "Suscripción eliminada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/mi-negocio/cancel/{subscription_id}')
async def cancel_any_subscription(request: Request, subscription_id: str):
    """Admin cancels any subscription."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        from bson import ObjectId
        result = await _db.user_subscriptions.update_one(
            {"_id": ObjectId(subscription_id)},
            {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow().isoformat(), "cancelled_by": admin.get("name", "admin")}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        return {"success": True, "message": "Suscripción cancelada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/mi-negocio/reactivate/{subscription_id}')
async def reactivate_any_subscription(request: Request, subscription_id: str):
    """Admin reactivates a cancelled subscription."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        from bson import ObjectId
        result = await _db.user_subscriptions.update_one(
            {"_id": ObjectId(subscription_id)},
            {"$set": {"status": "active", "cancelled_at": "", "cancelled_by": "", "activated_by": admin.get("name", "admin")}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Suscripción no encontrada")
        return {"success": True, "message": "Suscripción reactivada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.post('/admin/mi-negocio/add-subscription')
async def add_manual_subscription(request: Request):
    """Admin manually adds a client to a subscription plan."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        body = await request.json()
        user_email = body.get("user_email", "").strip().lower()
        user_name = body.get("user_name", "").strip()
        user_phone = body.get("user_phone", "").strip()
        plan_id = body.get("plan_id", "").strip()
        custom_price = body.get("custom_price")
        billing_period = body.get("billing_period", "monthly")
        notes = body.get("notes", "")

        if not user_email and not user_name:
            raise HTTPException(status_code=400, detail="Se requiere al menos nombre o email del cliente")
        if not plan_id and not custom_price:
            raise HTTPException(status_code=400, detail="Se requiere un plan o precio personalizado")

        # Try to find existing user by email
        user = None
        user_id = None
        if user_email:
            user = await _db.users.find_one({"email": user_email})
        if user:
            user_id = user.get("id", str(user["_id"]))
            user_name = user_name or user.get("name", user.get("first_name", ""))
            user_phone = user_phone or user.get("phone", "")
        else:
            # Create a lightweight user_id for tracking
            user_id = f"manual_{uuid.uuid4().hex[:12]}"

        # Get plan info if plan_id specified
        plan_info = None
        price = custom_price
        plan_name = "Plan Manual"
        if plan_id:
            plan_info = await _db.subscription_plans.find_one({"apple_product_id": plan_id})
            if not plan_info:
                plan_info = await _db.subscription_plans.find_one({"_id": ObjectId(plan_id)}) if len(plan_id) == 24 else None
            if plan_info:
                price = plan_info.get("price", custom_price or 0)
                plan_name = plan_info.get("name", "Plan")
                billing_period = plan_info.get("billing_period", billing_period)

        if price is None:
            price = 0

        # Create subscription record
        now = datetime.utcnow().isoformat()
        sub_doc = {
            "user_id": user_id,
            "apple_product_id": plan_id or "manual_plan",
            "plan_name": plan_name,
            "status": "active",
            "source": "admin_manual",
            "price": float(price),
            "billing_period": billing_period,
            "activated_at": now,
            "activated_by": admin.get("name", "admin"),
            "cancelled_at": "",
            "cancelled_by": "",
            "expires_at": "",
            "notes": notes,
            "email": user_email,
            "user_name_cache": user_name,
            "user_email_cache": user_email,
            "user_phone_cache": user_phone,
        }

        result = await _db.user_subscriptions.insert_one(sub_doc)

        return {
            "success": True,
            "message": f"Suscripción activada para {user_name or user_email}",
            "subscription_id": str(result.inserted_id),
            "plan_name": plan_name,
            "price": price,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding manual subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@receipts_router.get('/admin/mi-negocio/search-users')
async def search_users_for_subscription(request: Request):
    """Search users for manual subscription assignment."""
    admin = await _auth_user(request)
    if admin.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    try:
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return {"users": []}

        regex = {"$regex": q, "$options": "i"}
        users = await _db.users.find(
            {"$or": [{"name": regex}, {"email": regex}, {"phone": regex}, {"first_name": regex}, {"last_name": regex}]},
            {"id": 1, "name": 1, "first_name": 1, "last_name": 1, "email": 1, "phone": 1, "_id": 1}
        ).limit(10).to_list(10)

        result = []
        for u in users:
            name = u.get("name") or f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
            result.append({
                "id": u.get("id", str(u["_id"])),
                "name": name,
                "email": u.get("email", ""),
                "phone": u.get("phone", ""),
            })
        return {"users": result}
    except Exception as e:
        logger.error(f"Error searching users: {e}")
        raise HTTPException(status_code=500, detail=str(e))

