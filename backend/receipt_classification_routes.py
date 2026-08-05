"""
Receipt Classification Routes
Extracted from server.py — Receipt AI classification, classified receipts CRUD, stats.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from datetime import datetime
from bson import ObjectId
import logging
import math

logger = logging.getLogger(__name__)

receipt_classification_router = APIRouter()

_db = None


def init_receipt_classification_router(db):
    global _db
    _db = db
    # Pass DB to classifier so it can read OpenAI key from config
    try:
        from receipt_classifier_service import set_classifier_db
        set_classifier_db(db)
        logger.info("✅ Receipt classifier DB connection set")
    except Exception as e:
        logger.warning(f"Could not set classifier DB: {e}")


# ── Auth helpers ──

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
            user = await _db.users.find_one({'_id': ObjectId(session['user_id'])})
        except Exception:
            pass
    if not user:
        user = await _db.users.find_one({'_id': session['user_id']})
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict


async def _require_admin(request: Request):
    user = await _auth_user(request)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin access required')
    return user


# ── Lazy-load receipt classifier to avoid import issues ──
_receipt_classifier = None
_expense_categories = None


def _get_receipt_classifier():
    global _receipt_classifier
    if _receipt_classifier is None:
        from receipt_classifier_service import get_receipt_classifier
        _receipt_classifier = get_receipt_classifier()
    return _receipt_classifier


def _get_expense_categories():
    global _expense_categories
    if _expense_categories is None:
        from receipt_classifier_service import EXPENSE_CATEGORIES
        _expense_categories = EXPENSE_CATEGORIES
    return _expense_categories


# ───────────── Receipt Categories ─────────────

@receipt_classification_router.get('/admin/receipts/categories')
async def get_expense_categories(request: Request):
    """Get all available expense categories for receipts"""
    await _require_admin(request)
    cats = _get_expense_categories()
    return {"categories": [
        {"key": k, "name_es": v["name_es"], "name_en": v["name_en"], "icon": v["icon"]}
        for k, v in cats.items()
    ]}


@receipt_classification_router.get('/admin/receipts/ai-diagnostic')
async def ai_diagnostic(request: Request):
    """Diagnostic endpoint to check AI service configuration"""
    await _require_admin(request)
    import os
    results = {
        'emergent_key_set': bool(os.getenv('EMERGENT_LLM_KEY')),
        'openai_key_env': bool(os.getenv('OPENAI_API_KEY', '')),
        'db_ref_set': _db is not None,
        'mongo_url_set': bool(os.getenv('MONGO_URL', '')),
        'db_name_env': os.getenv('DB_NAME', 'NOT SET'),
    }
    
    # Check database for key
    try:
        if _db is not None:
            sys_doc = await _db.system_settings.find_one({'_id': 'main'})
            if sys_doc and sys_doc.get('settings'):
                k = sys_doc['settings'].get('openai_api_key', '')
                results['system_settings_key'] = f'{k[:10]}...' if k else 'EMPTY'
            else:
                results['system_settings_key'] = 'NO DOC'
            
            config = await _db.admin_config.find_one({})
            if config:
                k = config.get('OPENAI_API_KEY', '') or config.get('openai_api_key', '')
                results['admin_config_key'] = f'{k[:10]}...' if k else 'EMPTY'
            else:
                results['admin_config_key'] = 'NO DOC'
            results['db_name'] = _db.name
        else:
            results['db_check'] = 'SKIPPED (_db is None)'
            # Try direct connection
            import motor.motor_asyncio
            mongo_url = os.getenv('MONGO_URL', '')
            if mongo_url:
                client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
                db_name = os.getenv('DB_NAME', 'taxportal')
                db = client[db_name]
                sys_doc = await db.system_settings.find_one({'_id': 'main'})
                if sys_doc and sys_doc.get('settings'):
                    k = sys_doc['settings'].get('openai_api_key', '')
                    results['direct_system_settings_key'] = f'{k[:10]}...' if k else 'EMPTY'
                config = await db.admin_config.find_one({})
                if config:
                    k = config.get('OPENAI_API_KEY', '') or config.get('openai_api_key', '')
                    results['direct_admin_config_key'] = f'{k[:10]}...' if k else 'EMPTY'
                results['direct_db_name'] = db_name
    except Exception as e:
        results['db_error'] = str(e)
    
    # Check classifier service
    try:
        classifier = _get_receipt_classifier()
        openai_key = await classifier._get_openai_key()
        results['classifier_found_key'] = bool(openai_key)
        if openai_key:
            results['classifier_key_prefix'] = openai_key[:10] + '...'
    except Exception as e:
        results['classifier_error'] = str(e)
    
    return results


# ───────────── Classify Receipt ─────────────

@receipt_classification_router.post('/receipts/classify')
async def classify_receipt_endpoint(request: Request):
    """Classify a receipt using AI"""
    current_user = await _auth_user(request)
    try:
        body = await request.json()
        image_base64 = body.get('image_base64', '')
        filename = body.get('filename', '')

        if not image_base64:
            raise HTTPException(status_code=400, detail="image_base64 is required")

        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]

        result = await _get_receipt_classifier().classify_receipt(image_base64, filename)

        if result['success']:
            receipt_type = body.get('receipt_type', 'personal')  # 'business' or 'personal'
            receipt_data = {
                'user_id': current_user['id'],
                'user_name': current_user.get('full_name', current_user.get('name', '')),
                'user_email': current_user.get('email', ''),
                'filename': filename,
                'image_base64': image_base64[:100] + '...',
                'classification': result['data'],
                'amount': result['data'].get('amount'),
                'currency': result['data'].get('currency', 'USD'),
                'date': result['data'].get('date'),
                'vendor': result['data'].get('vendor'),
                'category': result['data'].get('category'),
                'category_name_es': result['data'].get('category_name_es'),
                'description': result['data'].get('description'),
                'confidence': result['data'].get('confidence'),
                'receipt_type': receipt_type,
                'status': 'classified',
                'created_at': datetime.utcnow(),
                'reviewed': False
            }

            db_result = await _db.classified_receipts.insert_one(receipt_data)
            result['receipt_id'] = str(db_result.inserted_id)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error classifying receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ───────────── Get Classified Receipts ─────────────

@receipt_classification_router.get('/admin/classified-receipts')
async def get_classified_receipts(
    request: Request,
    category: Optional[str] = None,
    user_id: Optional[str] = None,
    reviewed: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get all classified receipts for admin review"""
    await _require_admin(request)
    try:
        query = {}
        if category and category != 'all':
            query['category'] = category
        if user_id:
            query['user_id'] = user_id
        if reviewed is not None:
            query['reviewed'] = reviewed

        receipts = await _db.classified_receipts.find(query).sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
        total = await _db.classified_receipts.count_documents(query)

        formatted = []
        for r in receipts:
            confidence = r.get('confidence')
            if confidence is not None:
                try:
                    confidence = float(confidence)
                    if math.isnan(confidence) or math.isinf(confidence):
                        confidence = None
                except (ValueError, TypeError):
                    confidence = None

            formatted.append({
                'id': str(r['_id']),
                'user_id': r.get('user_id'),
                'user_name': r.get('user_name', 'Unknown'),
                'user_email': r.get('user_email', ''),
                'filename': r.get('filename', ''),
                'amount': r.get('amount') if r.get('amount') is not None else None,
                'currency': r.get('currency', 'USD'),
                'date': r.get('date'),
                'vendor': r.get('vendor'),
                'category': r.get('category', 'sin_categoria'),
                'category_name_es': r.get('category_name_es', 'Sin Categoría'),
                'description': r.get('description'),
                'confidence': confidence,
                'status': r.get('status', 'pending'),
                'reviewed': r.get('reviewed', False),
                'admin_notes': r.get('admin_notes', ''),
                'created_at': r.get('created_at').isoformat() if r.get('created_at') else None
            })

        return {
            "receipts": formatted,
            "total": total,
            "categories": _get_receipt_classifier().get_categories()
        }

    except Exception as e:
        logger.error(f"Error getting receipts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ───────────── Update Classified Receipt ─────────────

@receipt_classification_router.put('/admin/classified-receipts/{receipt_id}')
async def update_classified_receipt(receipt_id: str, request: Request):
    """Update a classified receipt (admin review, change category, add notes)"""
    current_user = await _require_admin(request)
    try:
        body = await request.json()

        update_data = {
            'updated_at': datetime.utcnow(),
            'reviewed_by': current_user.get('email', current_user.get('id'))
        }

        allowed_fields = ['category', 'amount', 'date', 'vendor', 'description', 'admin_notes', 'reviewed', 'status']
        for field in allowed_fields:
            if field in body:
                update_data[field] = body[field]

        EXPENSE_CATEGORIES = _get_expense_categories()
        if 'category' in body and body['category'] in EXPENSE_CATEGORIES:
            cat_info = EXPENSE_CATEGORIES[body['category']]
            update_data['category_name_es'] = cat_info['name_es']
            update_data['category_name_en'] = cat_info['name_en']

        result = await _db.classified_receipts.update_one(
            {'_id': ObjectId(receipt_id)},
            {'$set': update_data}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Receipt not found")

        return {"success": True, "message": "Receipt updated"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating receipt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ───────────── Receipt Stats ─────────────

@receipt_classification_router.get('/admin/classified-receipts/stats')
async def get_receipt_stats(
    request: Request,
    user_id: Optional[str] = None
):
    """Get receipt statistics by category"""
    await _require_admin(request)
    try:
        match_query = {}
        if user_id:
            match_query['user_id'] = user_id

        pipeline = [
            {'$match': match_query},
            {'$group': {
                '_id': '$category',
                'count': {'$sum': 1},
                'total_amount': {'$sum': {'$ifNull': ['$amount', 0]}},
                'category_name_es': {'$first': '$category_name_es'}
            }},
            {'$sort': {'total_amount': -1}}
        ]

        stats = await _db.classified_receipts.aggregate(pipeline).to_list(100)

        EXPENSE_CATEGORIES = _get_expense_categories()
        for stat in stats:
            cat_id = stat['_id']
            if cat_id in EXPENSE_CATEGORIES:
                stat['icon'] = EXPENSE_CATEGORIES[cat_id]['icon']
            else:
                stat['icon'] = '📋'

        total_receipts = await _db.classified_receipts.count_documents(match_query)
        reviewed_count = await _db.classified_receipts.count_documents({**match_query, 'reviewed': True})

        return {
            "by_category": stats,
            "total_receipts": total_receipts,
            "reviewed": reviewed_count,
            "pending_review": total_receipts - reviewed_count
        }

    except Exception as e:
        logger.error(f"Error getting receipt stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
