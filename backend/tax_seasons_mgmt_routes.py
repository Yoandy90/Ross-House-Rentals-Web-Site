"""
Tax Seasons Management Routes Router
Extracted from server.py for modularization.
Handles tax seasons CRUD, tax tracking, invoices by year, dashboard stats,
declaration status updates, and relocation campaign endpoints.
"""
import os
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Request, Query, Body
from bson import ObjectId

logger = logging.getLogger(__name__)

tax_seasons_mgmt_router = APIRouter()
_db = None
_relocation_service = None


def init_tax_seasons_mgmt_router(db):
    global _db
    _db = db


def update_relocation_service(svc):
    global _relocation_service
    _relocation_service = svc


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


# ================== TAX SEASONS MANAGEMENT ==================

@tax_seasons_mgmt_router.get('/admin/tax-seasons')
async def get_tax_seasons(request: Request):
    current_user = await _require_admin(request)
    try:
        seasons = await _db.tax_seasons.find({}).sort('year', -1).to_list(20)
        return {
            'seasons': [{
                'year': s.get('year'),
                'name': s.get('name'),
                'start_date': s.get('start_date'),
                'end_date': s.get('end_date'),
                'is_active': s.get('is_active', False),
                'created_at': s.get('created_at')
            } for s in seasons]
        }
    except Exception as e:
        logging.error(f"Error getting tax seasons: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_seasons_mgmt_router.get('/admin/tax-seasons/active')
async def get_active_tax_season(request: Request):
    current_user = await _require_admin(request)
    try:
        season = await _db.tax_seasons.find_one({'is_active': True})
        if not season:
            season = {'year': '2025', 'name': 'Temporada Fiscal 2025', 'is_active': True}
        
        return {
            'year': season.get('year'),
            'name': season.get('name'),
            'start_date': season.get('start_date'),
            'end_date': season.get('end_date'),
            'is_active': season.get('is_active', True)
        }
    except Exception as e:
        logging.error(f"Error getting active tax season: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_seasons_mgmt_router.post('/admin/tax-seasons/start-new')
async def start_new_tax_season(
    request: Request,
    data: dict = Body(...)
):
    current_user = await _auth_user(request)
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        new_year = data.get('year')
        if not new_year:
            raise HTTPException(status_code=400, detail="Year is required")
        
        existing = await _db.tax_seasons.find_one({'year': new_year})
        if existing:
            raise HTTPException(status_code=400, detail=f"La temporada {new_year} ya existe")
        
        await _db.tax_seasons.update_many({}, {'$set': {'is_active': False}})
        
        year_int = int(new_year)
        new_season = {
            'year': new_year,
            'name': f'Temporada Fiscal {new_year}',
            'start_date': datetime(year_int + 1, 1, 1),
            'end_date': datetime(year_int + 1, 4, 15),
            'is_active': True,
            'created_at': datetime.utcnow()
        }
        await _db.tax_seasons.insert_one(new_season)
        
        await _db.users.update_many(
            {'role': 'client'},
            {'$set': {
                f'declaration_history.{new_year}': {
                    'status': 'pending',
                    'date': None,
                    'updated_at': datetime.utcnow()
                },
                'current_tax_year': new_year
            }}
        )
        
        clients_count = await _db.users.count_documents({'role': 'client'})
        
        # Invalidate season cache so all modules pick up the new season
        from season_context import invalidate_cache
        invalidate_cache()
        
        logging.info(f"New tax season {new_year} started by {current_user.get('email')}")
        
        return {
            'success': True,
            'message': f'Temporada fiscal {new_year} iniciada correctamente',
            'year': new_year,
            'clients_initialized': clients_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error starting new tax season: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_seasons_mgmt_router.get('/admin/tax-tracking')
async def get_tax_tracking(
    request: Request,
    year: str = Query(default=None)
):
    current_user = await _require_admin(request)
    try:
        if not year:
            active_season = await _db.tax_seasons.find_one({'is_active': True})
            year = active_season.get('year') if active_season else '2025'
        
        clients = await _db.users.find({'role': 'client'}).to_list(2000)
        
        year_int = int(year) if year and str(year).isdigit() else None
        year_variants = [year, str(year)]
        if year_int:
            year_variants.append(year_int)
        
        efiled_pipeline = [
            {'$match': {
                'tax_year': {'$in': year_variants},
                '$or': [
                    {'efiled': True},
                    {'status': 'paid'},
                    {'status': 'completed'}
                ]
            }},
            {'$group': {'_id': {'$toLower': {'$ifNull': ['$user_email', '$client_email']}}}}
        ]
        efiled_result = await _db.invoices.aggregate(efiled_pipeline).to_list(2000)
        efiled_emails = {r['_id'] for r in efiled_result if r.get('_id')}
        
        stats = {
            'total': len(clients),
            'pending': 0,
            'scheduled': 0,
            'in_progress': 0,
            'completed': 0,
            'year': year
        }
        
        clients_data = []
        for client in clients:
            client_email = (client.get('email') or '').lower()
            
            if client_email in efiled_emails:
                status = 'completed'
                stats['completed'] += 1
                clients_data.append({
                    'id': str(client.get('_id')),
                    'user_id': client.get('id'),
                    'name': client.get('full_name') or client.get('name'),
                    'email': client.get('email'),
                    'phone': client.get('phone'),
                    'status': status,
                    'year_status': status,
                    'last_visit': client.get('last_visit')
                })
                continue
            
            history = client.get('declaration_history', {})
            year_data = history.get(year, {})
            status = year_data.get('status', 'pending')
            
            if year == '2025' and not year_data:
                status = client.get('declaration_status', 'pending')
            
            if status == 'sent':
                status = 'completed'
            
            if status == 'pending':
                stats['pending'] += 1
            elif status == 'scheduled':
                stats['scheduled'] += 1
            elif status == 'in_progress':
                stats['in_progress'] += 1
            elif status == 'completed':
                stats['completed'] += 1
            else:
                stats['pending'] += 1
            
            clients_data.append({
                'id': str(client.get('_id')),
                'user_id': client.get('id'),
                'name': client.get('full_name') or client.get('name'),
                'email': client.get('email'),
                'phone': client.get('phone'),
                'status': status,
                'year_status': year_data.get('status'),
                'last_visit': year_data.get('date') or client.get('last_visit')
            })
        
        return {
            'stats': stats,
            'clients': clients_data,
            'year': year,
            'completion_rate': round((stats['completed'] / stats['total'] * 100) if stats['total'] > 0 else 0, 1)
        }
    except Exception as e:
        logging.error(f"Error getting tax tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_seasons_mgmt_router.get('/admin/invoices-by-year')
async def get_invoices_by_year(
    request: Request,
    year: str = Query(default=None),
    status: str = Query(default=None),
    limit: int = Query(default=1000)
):
    current_user = await _require_admin(request)
    try:
        if not year:
            active_season = await _db.tax_seasons.find_one({'is_active': True})
            year = active_season.get('year') if active_season else '2025'
        
        year_str = str(year)
        year_int = int(year) if year_str.isdigit() else None
        year_conditions = [{'tax_year': year_str}]
        if year_int is not None:
            year_conditions.append({'tax_year': year_int})
        
        query = {'$or': year_conditions}
        if status:
            query['status'] = status
        
        invoices = await _db.invoices.find(query).sort('created_at', -1).to_list(limit)
        
        total_amount = sum(inv.get('total', 0) for inv in invoices)
        paid_amount = sum(inv.get('total', 0) for inv in invoices if inv.get('status') == 'paid')
        pending_amount = total_amount - paid_amount
        
        return {
            'invoices': [{
                'id': str(inv.get('_id')),
                'invoice_number': inv.get('invoice_number'),
                'user_name': inv.get('user_name'),
                'user_email': inv.get('user_email'),
                'total': inv.get('total'),
                'status': inv.get('status'),
                'tax_year': inv.get('tax_year'),
                'efiled': inv.get('efiled'),
                'efiled_date': inv.get('efiled_date'),
                'created_at': inv.get('created_at')
            } for inv in invoices],
            'summary': {
                'total_invoices': len(invoices),
                'total_amount': total_amount,
                'paid_amount': paid_amount,
                'pending_amount': pending_amount,
                'paid_count': sum(1 for inv in invoices if inv.get('status') == 'paid'),
                'pending_count': sum(1 for inv in invoices if inv.get('status') != 'paid')
            },
            'year': year
        }
    except Exception as e:
        logging.error(f"Error getting invoices by year: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_seasons_mgmt_router.get('/admin/dashboard-stats')
async def get_dashboard_stats_by_year(
    request: Request,
    year: str = Query(default=None)
):
    current_user = await _require_admin(request)
    try:
        from season_context import get_season_summary, get_active_season

        if not year:
            active = await get_active_season()
            year = active['year']

        summary = await get_season_summary(year)

        # Get available years
        seasons = await _db.tax_seasons.find({}).sort('year', -1).to_list(10)
        available_years_set = set()
        for s in seasons:
            y = s.get('year')
            if y:
                available_years_set.add(str(y))
        # Always include current year
        available_years_set.add(str(datetime.now().year))
        available_years = sorted(list(available_years_set), reverse=True) if available_years_set else ['2025']

        return {
            'year': summary['year'],
            'available_years': available_years,
            'clients': summary['clients'],
            'invoices': summary['invoices'],
            'revenue': summary['revenue'],
            'appointments': summary['appointments'],
            'expenses': summary['expenses'],
            'profit': summary['profit'],
            'season_status': summary['status'],
        }
    except Exception as e:
        logging.error(f"Error getting dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@tax_seasons_mgmt_router.get('/admin/tax-seasons/summary/{year}')
async def get_season_full_summary(request: Request, year: str):
    """Full summary for a season – used by the Temporadas management page."""
    await _require_admin(request)
    from season_context import get_season_summary
    return await get_season_summary(year)


@tax_seasons_mgmt_router.get('/admin/tax-seasons/compare')
async def compare_seasons(request: Request, years: str = Query(default=None)):
    """Compare 2-3 seasons side by side. years=2025,2024"""
    await _require_admin(request)
    from season_context import get_season_summary
    year_list = [y.strip() for y in (years or '').split(',') if y.strip()]
    if not year_list:
        year_list = [str(datetime.now().year), str(datetime.now().year - 1)]
    results = []
    for y in year_list[:3]:
        results.append(await get_season_summary(y))
    return {'seasons': results}


@tax_seasons_mgmt_router.get('/admin/tax-seasons/ai-context')
async def get_ai_season_context_endpoint(request: Request):
    """Return rich text context about the active season for the AI Brain."""
    await _require_admin(request)
    from season_context import get_ai_season_context
    text = await get_ai_season_context()
    return {'context': text}


@tax_seasons_mgmt_router.post('/admin/tax-seasons/{year}/close')
async def close_tax_season(request: Request, year: str):
    """Close a season (mark as inactive, set end_date)."""
    current_user = await _require_admin(request)
    result = await _db.tax_seasons.update_one(
        {'year': year},
        {'$set': {
            'is_active': False,
            'end_date': datetime.utcnow(),
            'closed_by': current_user.get('email'),
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='Season not found')
    from season_context import invalidate_cache
    invalidate_cache()
    return {'success': True, 'message': f'Temporada {year} cerrada'}



@tax_seasons_mgmt_router.put('/admin/client/{client_id}/declaration-status')
async def update_client_declaration_status(
    client_id: str,
    request: Request,
    data: dict = Body(...)
):
    current_user = await _require_admin(request)
    try:
        status = data.get('status')
        year = data.get('year', '2025')
        
        if status not in ['pending', 'scheduled', 'in_progress', 'completed', 'sent']:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        client = await _db.users.find_one({
            '$or': [
                {'id': client_id},
                {'_id': ObjectId(client_id) if ObjectId.is_valid(client_id) else None}
            ]
        })
        
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        update_data = {
            f'declaration_history.{year}': {
                'status': status,
                'date': datetime.utcnow() if status in ['completed', 'sent'] else None,
                'updated_at': datetime.utcnow(),
                'updated_by': current_user.get('email')
            }
        }
        
        if year == '2025':
            update_data['declaration_status'] = status
        
        await _db.users.update_one(
            {'_id': client['_id']},
            {'$set': update_data}
        )
        
        return {'success': True, 'message': f'Status updated to {status} for year {year}'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating declaration status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== RELOCATION CAMPAIGN ENDPOINTS ==================

@tax_seasons_mgmt_router.get('/admin/relocation-campaigns/templates')
async def get_relocation_templates(
    request: Request,
    template_type: str = "all",
):
    current_user = await _require_admin(request)
    from relocation_campaign_service import RELOCATION_TEMPLATES, WHATSAPP_TEMPLATES
    
    if template_type == "email":
        return {"templates": list(RELOCATION_TEMPLATES.values())}
    elif template_type == "whatsapp":
        return {"templates": list(WHATSAPP_TEMPLATES.values())}
    else:
        return {
            "email_templates": list(RELOCATION_TEMPLATES.values()),
            "whatsapp_templates": list(WHATSAPP_TEMPLATES.values())
        }


@tax_seasons_mgmt_router.get('/admin/relocation-campaigns/clients')
async def get_relocated_clients(
    request: Request,
    filter_type: str = "all",
):
    current_user = await _require_admin(request)
    if _relocation_service:
        clients = await _relocation_service.get_relocated_clients(filter_type)
        return {"clients": clients, "count": len(clients), "filter": filter_type}
    return {"clients": [], "count": 0}


@tax_seasons_mgmt_router.post('/admin/relocation-campaigns/preview')
async def preview_relocation_template(
    request: Request,
    template_type: str = Body(...),
    template_id: str = Body(...),
    client_name: str = Body(default="Juan Pérez"),
):
    current_user = await _require_admin(request)
    if _relocation_service:
        return await _relocation_service.preview_template(template_type, template_id, client_name)
    raise HTTPException(status_code=500, detail="Service not available")


@tax_seasons_mgmt_router.post('/admin/relocation-campaigns/send-email')
async def send_relocation_email_campaign(
    request: Request,
    template_id: str = Body(...),
    client_ids: List[str] = Body(default=None),
    filter_type: str = Body(default=None),
    test_email: str = Body(default=None),
):
    current_user = await _require_admin(request)
    if _relocation_service:
        result = await _relocation_service.send_email_campaign(
            template_id=template_id,
            client_ids=client_ids,
            filter_type=filter_type,
            test_email=test_email
        )
        return result
    raise HTTPException(status_code=500, detail="Service not available")


@tax_seasons_mgmt_router.post('/admin/relocation-campaigns/send-whatsapp')
async def send_relocation_whatsapp_campaign(
    request: Request,
    template_id: str = Body(...),
    client_ids: List[str] = Body(default=None),
    filter_type: str = Body(default=None),
    test_phone: str = Body(default=None),
):
    current_user = await _require_admin(request)
    if _relocation_service:
        result = await _relocation_service.send_whatsapp_campaign(
            template_id=template_id,
            client_ids=client_ids,
            filter_type=filter_type,
            test_phone=test_phone
        )
        return result
    raise HTTPException(status_code=500, detail="Service not available")
