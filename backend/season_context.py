"""
Season Context Service
Provides active tax season context to all modules (appointments, invoices, expenses, AI Brain).
Central place to get/set the active season so all operations are season-aware.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_db = None
_cached_active_season = None
_cache_ts = None
CACHE_TTL = 300  # 5 min


def init_season_context(db):
    global _db
    _db = db


async def get_active_season() -> dict:
    """Return the currently active tax season. Cached for 5 min."""
    global _cached_active_season, _cache_ts
    now = datetime.now(timezone.utc).timestamp()
    if _cached_active_season and _cache_ts and (now - _cache_ts) < CACHE_TTL:
        return _cached_active_season

    season = await _db.tax_seasons.find_one({'is_active': True})
    if not season:
        current_year = str(datetime.now(timezone.utc).year)
        season = {
            'year': current_year,
            'name': f'Temporada Fiscal {current_year}',
            'is_active': True,
        }
    result = {
        'year': str(season.get('year', '2025')),
        'name': season.get('name', ''),
        'is_active': True,
        'start_date': season.get('start_date'),
        'end_date': season.get('end_date'),
    }
    _cached_active_season = result
    _cache_ts = now
    return result


def invalidate_cache():
    """Call after starting/closing a season to bust the cache."""
    global _cached_active_season, _cache_ts
    _cached_active_season = None
    _cache_ts = None


async def get_season_year() -> str:
    """Shortcut that returns just the year string of the active season."""
    s = await get_active_season()
    return s['year']


async def get_all_seasons() -> list:
    """Return all seasons ordered by year descending."""
    seasons = await _db.tax_seasons.find({}).sort('year', -1).to_list(20)
    return seasons


async def get_season_summary(year: str) -> dict:
    """
    Comprehensive season summary for AI Brain and dashboards.
    IMPORTANT: Temporada X files taxes for fiscal year X-1.
    Example: Temporada 2026 (Jan-Apr 2026) files fiscal year 2025 taxes.
    So invoices for Temporada X have tax_year = X-1 in the database.
    """
    year_str = str(year)
    year_int = int(year) if year_str.isdigit() else None
    
    # Fiscal year = season year - 1 (Temporada 2026 → FY 2025)
    fiscal_year = str(year_int - 1) if year_int else year_str
    fiscal_year_int = year_int - 1 if year_int else None
    
    # Variants for querying (both string and int)
    fiscal_variants = [fiscal_year]
    if fiscal_year_int:
        fiscal_variants.append(fiscal_year_int)
    
    # Also keep season variants for declaration_history lookups
    season_variants = [year_str]
    if year_int:
        season_variants.append(year_int)

    # ─── Clients ───
    total_clients = await _db.users.count_documents({'role': 'client'})

    # Season-specific clients (have declaration_history for this year OR were created this year)
    season_clients_count = await _db.users.count_documents({
        'role': 'client',
        '$or': [
            {f'declaration_history.{year_str}': {'$exists': True}},
            {f'declaration_history.{year_str}.status': {'$exists': True}},
        ]
    })
    # If no one has history for this year, fall back to total
    if season_clients_count == 0:
        season_clients_count = total_clients

    # Completed/pending — check invoices by FISCAL year, declaration_history by SEASON year
    completed = 0
    pending = 0
    efiled_pipeline = [
        {'$match': {'tax_year': {'$in': fiscal_variants}, '$or': [
            {'efiled': True}, {'status': 'paid'}, {'status': 'completed'}
        ]}},
        {'$group': {'_id': {'$toLower': {'$ifNull': ['$user_email', '$client_email']}}}}
    ]
    efiled_result = await _db.invoices.aggregate(efiled_pipeline).to_list(5000)
    efiled_emails = {r['_id'] for r in efiled_result if r.get('_id')}

    clients = await _db.users.find({'role': 'client'}).to_list(5000)
    for c in clients:
        email = (c.get('email') or '').lower()
        if email in efiled_emails:
            completed += 1
            continue
        history = c.get('declaration_history', {})
        # Check both season year and fiscal year in declaration history
        year_data = history.get(year_str, {}) or history.get(fiscal_year, {})
        status = year_data.get('status') if isinstance(year_data, dict) else None
        if not status:
            status = c.get('declaration_status')
        if status in ['sent', 'completed']:
            completed += 1
        else:
            pending += 1

    # ─── Invoices (by FISCAL year) ───
    inv_query = {'tax_year': {'$in': fiscal_variants}}
    total_invoices = await _db.invoices.count_documents(inv_query)
    paid_invoices = await _db.invoices.count_documents({**inv_query, 'status': 'paid'})
    pending_invoices = total_invoices - paid_invoices

    rev_pipe = [{'$match': inv_query}, {'$group': {'_id': None, 'total': {'$sum': '$total'}}}]
    rev_result = await _db.invoices.aggregate(rev_pipe).to_list(1)
    total_revenue = rev_result[0]['total'] if rev_result else 0

    paid_pipe = [{'$match': {**inv_query, 'status': 'paid'}}, {'$group': {'_id': None, 'total': {'$sum': '$total'}}}]
    paid_result = await _db.invoices.aggregate(paid_pipe).to_list(1)
    paid_revenue = paid_result[0]['total'] if paid_result else 0

    # ─── Appointments (by FISCAL year or date range of the SEASON) ───
    # Appointments tagged with fiscal year, OR scheduled during the season period (Jan-Apr of season year)
    appt_query = {'$or': [
        {'tax_year': {'$in': fiscal_variants}},
    ]}
    if year_int:
        # Season runs Jan-Apr of the SEASON year (not fiscal year)
        season_start = datetime(year_int, 1, 1, tzinfo=timezone.utc)
        season_end = datetime(year_int, 4, 16, tzinfo=timezone.utc)
        appt_query['$or'].append({'scheduled_at': {'$gte': season_start, '$lt': season_end}})
    total_appointments = await _db.appointments.count_documents(appt_query)
    completed_appointments = await _db.appointments.count_documents({**appt_query, 'status': {'$in': ['completed', 'confirmed']}})

    # ─── Expenses (by FISCAL year) ───
    exp_query = {'tax_year': {'$in': fiscal_variants}}
    exp_pipe = [{'$match': exp_query}, {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}]
    try:
        exp_result = await _db.expenses.aggregate(exp_pipe).to_list(1)
        total_expenses = exp_result[0]['total'] if exp_result else 0
    except:
        total_expenses = 0

    # ─── Season record ───
    season_doc = await _db.tax_seasons.find_one({'year': year_str})
    if not season_doc:
        season_doc = await _db.tax_seasons.find_one({'year': year_int})

    return {
        'year': year_str,
        'fiscal_year': fiscal_year,
        'name': f'Temporada {year_str} (Año Fiscal {fiscal_year})',
        'is_active': bool(season_doc and season_doc.get('is_active')),
        'status': 'active' if (season_doc and season_doc.get('is_active')) else ('closed' if season_doc else 'not_started'),
        'start_date': season_doc.get('start_date') if season_doc else None,
        'end_date': season_doc.get('end_date') if season_doc else None,
        'created_at': season_doc.get('created_at') if season_doc else None,
        'clients': {
            'total': total_clients,
            'season_active': season_clients_count,
            'completed': completed,
            'pending': pending,
            'completion_rate': round((completed / total_clients * 100) if total_clients > 0 else 0, 1),
        },
        'invoices': {
            'total': total_invoices,
            'paid': paid_invoices,
            'pending': pending_invoices,
        },
        'revenue': {
            'total': total_revenue,
            'paid': paid_revenue,
            'pending': total_revenue - paid_revenue,
        },
        'appointments': {
            'total': total_appointments,
            'completed': completed_appointments,
        },
        'expenses': {
            'total': total_expenses,
        },
        'profit': {
            'net': paid_revenue - total_expenses,
        },
    }


async def get_ai_season_context() -> str:
    """
    Returns a formatted text summary of the current season for the AI Brain.
    This gives the AI full awareness of the business health per season.
    """
    active = await get_active_season()
    year = active['year']
    summary = await get_season_summary(year)

    # Also get previous year for comparison
    prev_year = str(int(year) - 1) if year.isdigit() else None
    prev_summary = await get_season_summary(prev_year) if prev_year else None

    lines = [
        f"=== TEMPORADA FISCAL ACTIVA: {year} (Año Fiscal {int(year)-1 if year.isdigit() else 'N/A'}) ===",
        f"Nota: Temporada {year} = Enero-Abril {year}, procesando impuestos del año fiscal {int(year)-1 if year.isdigit() else 'N/A'}",
        f"Estado: {'ACTIVA' if summary['is_active'] else 'NO INICIADA'}",
        f"",
        f"CLIENTES:",
        f"  Total en sistema: {summary['clients']['total']}",
        f"  Completados esta temporada: {summary['clients']['completed']}",
        f"  Pendientes: {summary['clients']['pending']}",
        f"  Tasa de completitud: {summary['clients']['completion_rate']}%",
        f"",
        f"FACTURACIÓN:",
        f"  Facturas emitidas: {summary['invoices']['total']}",
        f"  Pagadas: {summary['invoices']['paid']}",
        f"  Pendientes de pago: {summary['invoices']['pending']}",
        f"  Revenue total: ${summary['revenue']['total']:,.2f}",
        f"  Revenue cobrado: ${summary['revenue']['paid']:,.2f}",
        f"  Pendiente de cobro: ${summary['revenue']['pending']:,.2f}",
        f"",
        f"CITAS:",
        f"  Total citas: {summary['appointments']['total']}",
        f"  Completadas: {summary['appointments']['completed']}",
        f"",
        f"GASTOS: ${summary['expenses']['total']:,.2f}",
        f"GANANCIA NETA: ${summary['profit']['net']:,.2f}",
    ]

    if prev_summary and prev_year:
        prev_rate = prev_summary['clients']['completion_rate']
        curr_rate = summary['clients']['completion_rate']
        rate_diff = curr_rate - prev_rate
        prev_rev = prev_summary['revenue']['paid']
        curr_rev = summary['revenue']['paid']
        rev_change = ((curr_rev - prev_rev) / prev_rev * 100) if prev_rev > 0 else 0

        lines.extend([
            f"",
            f"=== COMPARACIÓN CON {prev_year} ===",
            f"  Completitud: {prev_rate}% → {curr_rate}% ({'↑' if rate_diff > 0 else '↓'}{abs(rate_diff):.1f}%)",
            f"  Revenue cobrado: ${prev_rev:,.2f} → ${curr_rev:,.2f} ({'↑' if rev_change > 0 else '↓'}{abs(rev_change):.1f}%)",
            f"  Facturas: {prev_summary['invoices']['total']} → {summary['invoices']['total']}",
            f"  Clientes completados: {prev_summary['clients']['completed']} → {summary['clients']['completed']}",
        ])

    return "\n".join(lines)
