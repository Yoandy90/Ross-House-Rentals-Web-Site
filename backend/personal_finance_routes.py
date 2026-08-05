"""
Personal Finance Routes - Dashboard financiero personal para clientes individuales
Usa las cuentas de Plaid ya conectadas para mostrar resumen de finanzas personales
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta
import logging
import jwt as pyjwt
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

finance_router = APIRouter(prefix="/my-finances", tags=["personal-finance"])

_db = None

def set_finance_db(database):
    global _db
    _db = database


# ─── Auth Helper ─────────────────────────────────────────────────────────────
async def _get_user_id(request: Request):
    """Get user ID from session token (DB lookup) with JWT fallback"""
    auth_header = request.headers.get('authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]

    # Primary: session token lookup (used by mobile app)
    try:
        if _db is not None:
            session = await _db.user_sessions.find_one({'session_token': token})
            if session:
                user_id = session.get('user_id')
                if user_id:
                    return str(user_id)
    except Exception as e:
        logger.debug(f"Session lookup failed: {e}")

    # Fallback: JWT decode (legacy)
    try:
        payload = pyjwt.decode(token, os.getenv('JWT_SECRET_KEY', os.getenv('JWT_SECRET', '')), algorithms=['HS256'])
        return payload.get('user_id') or payload.get('sub') or payload.get('id')
    except Exception:
        return None


# ─── Category Mapping ────────────────────────────────────────────────────────
CATEGORY_CONFIG = {
    'FOOD_AND_DRINK': {'label': 'Comida', 'emoji': '🍔', 'color': '#FF6B6B'},
    'TRANSPORTATION': {'label': 'Transporte', 'emoji': '🚗', 'color': '#4ECDC4'},
    'RENT_AND_UTILITIES': {'label': 'Renta y Servicios', 'emoji': '🏠', 'color': '#45B7D1'},
    'ENTERTAINMENT': {'label': 'Entretenimiento', 'emoji': '🎬', 'color': '#96CEB4'},
    'GENERAL_MERCHANDISE': {'label': 'Compras', 'emoji': '🛍️', 'color': '#FFEAA7'},
    'MEDICAL': {'label': 'Salud', 'emoji': '🏥', 'color': '#DDA0DD'},
    'PERSONAL_CARE': {'label': 'Cuidado Personal', 'emoji': '💇', 'color': '#FFB6C1'},
    'GENERAL_SERVICES': {'label': 'Servicios', 'emoji': '🔧', 'color': '#87CEEB'},
    'GOVERNMENT_AND_NON_PROFIT': {'label': 'Gobierno', 'emoji': '🏛️', 'color': '#778899'},
    'INCOME': {'label': 'Ingresos', 'emoji': '💰', 'color': '#2ECC71'},
    'TRANSFER_IN': {'label': 'Transferencia Recibida', 'emoji': '📥', 'color': '#27AE60'},
    'TRANSFER_OUT': {'label': 'Transferencia Enviada', 'emoji': '📤', 'color': '#E67E22'},
    'LOAN_PAYMENTS': {'label': 'Préstamos', 'emoji': '🏦', 'color': '#E74C3C'},
    'BANK_FEES': {'label': 'Cargos Bancarios', 'emoji': '🏧', 'color': '#95A5A6'},
    'TRAVEL': {'label': 'Viajes', 'emoji': '✈️', 'color': '#3498DB'},
    'HOME_IMPROVEMENT': {'label': 'Hogar', 'emoji': '🔨', 'color': '#D2691E'},
    'UNCATEGORIZED': {'label': 'Otros', 'emoji': '📋', 'color': '#BDC3C7'},
}

# Detailed category mapping for precise Spanish labels
DETAIL_CATEGORY_CONFIG = {
    # Food & Drink
    'FOOD_AND_DRINK_COFFEE': {'label': 'Café', 'emoji': '☕', 'color': '#8B4513'},
    'FOOD_AND_DRINK_FAST_FOOD': {'label': 'Comida rápida', 'emoji': '🍟', 'color': '#FF6B6B'},
    'FOOD_AND_DRINK_GROCERIES': {'label': 'Supermercado', 'emoji': '🛒', 'color': '#FF6B6B'},
    'FOOD_AND_DRINK_RESTAURANT': {'label': 'Restaurantes', 'emoji': '🍽️', 'color': '#FF6B6B'},
    'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR': {'label': 'Licores', 'emoji': '🍷', 'color': '#722F37'},
    'FOOD_AND_DRINK_VENDING_MACHINES': {'label': 'Máquinas expendedoras', 'emoji': '🥤', 'color': '#FF6B6B'},
    'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK': {'label': 'Comida y bebida', 'emoji': '🍔', 'color': '#FF6B6B'},
    # Transportation
    'TRANSPORTATION_GAS': {'label': 'Gasolina', 'emoji': '⛽', 'color': '#4ECDC4'},
    'TRANSPORTATION_PARKING': {'label': 'Estacionamiento', 'emoji': '🅿️', 'color': '#4ECDC4'},
    'TRANSPORTATION_PUBLIC_TRANSIT': {'label': 'Transporte público', 'emoji': '🚌', 'color': '#4ECDC4'},
    'TRANSPORTATION_TAXIS_AND_RIDE_SHARES': {'label': 'Uber / Taxi', 'emoji': '🚕', 'color': '#4ECDC4'},
    'TRANSPORTATION_TOLLS': {'label': 'Peajes', 'emoji': '🛣️', 'color': '#4ECDC4'},
    'TRANSPORTATION_OTHER_TRANSPORTATION': {'label': 'Otro transporte', 'emoji': '🚗', 'color': '#4ECDC4'},
    # Rent & Utilities
    'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY': {'label': 'Gas y electricidad', 'emoji': '💡', 'color': '#45B7D1'},
    'RENT_AND_UTILITIES_INTERNET_AND_CABLE': {'label': 'Internet y cable', 'emoji': '🌐', 'color': '#45B7D1'},
    'RENT_AND_UTILITIES_RENT': {'label': 'Renta', 'emoji': '🏠', 'color': '#45B7D1'},
    'RENT_AND_UTILITIES_TELEPHONE': {'label': 'Teléfono', 'emoji': '📱', 'color': '#45B7D1'},
    'RENT_AND_UTILITIES_WATER': {'label': 'Agua', 'emoji': '💧', 'color': '#45B7D1'},
    'RENT_AND_UTILITIES_OTHER_UTILITIES': {'label': 'Otros servicios', 'emoji': '🏠', 'color': '#45B7D1'},
    # Entertainment
    'ENTERTAINMENT_TV_AND_MOVIES': {'label': 'Streaming / TV', 'emoji': '📺', 'color': '#96CEB4'},
    'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS': {'label': 'Eventos y parques', 'emoji': '🎢', 'color': '#96CEB4'},
    'ENTERTAINMENT_OTHER_ENTERTAINMENT': {'label': 'Entretenimiento', 'emoji': '🎬', 'color': '#96CEB4'},
    'ENTERTAINMENT_MUSIC_AND_AUDIO': {'label': 'Música / Audio', 'emoji': '🎵', 'color': '#96CEB4'},
    'ENTERTAINMENT_GAMES': {'label': 'Juegos', 'emoji': '🎮', 'color': '#96CEB4'},
    # General Merchandise
    'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES': {'label': 'Ropa y accesorios', 'emoji': '👕', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_CONVENIENCE_STORES': {'label': 'Tiendas de conveniencia', 'emoji': '🏪', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_DEPARTMENT_STORES': {'label': 'Tiendas departamentales', 'emoji': '🏬', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_DISCOUNT_STORES': {'label': 'Tiendas de descuento', 'emoji': '🏷️', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_ELECTRONICS': {'label': 'Electrónica', 'emoji': '📱', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES': {'label': 'Compras en línea', 'emoji': '📦', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_SUPERSTORES': {'label': 'Walmart / Superstores', 'emoji': '🛒', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_SPORTING_GOODS': {'label': 'Artículos deportivos', 'emoji': '⚽', 'color': '#FFEAA7'},
    'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE': {'label': 'Compras generales', 'emoji': '🛍️', 'color': '#FFEAA7'},
    # General Services
    'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING': {'label': 'Contabilidad', 'emoji': '📊', 'color': '#87CEEB'},
    'GENERAL_SERVICES_AUTOMOTIVE': {'label': 'Servicios de auto', 'emoji': '🔧', 'color': '#87CEEB'},
    'GENERAL_SERVICES_CONSULTING_AND_LEGAL': {'label': 'Legal / Consultoría', 'emoji': '⚖️', 'color': '#87CEEB'},
    'GENERAL_SERVICES_INSURANCE': {'label': 'Seguros', 'emoji': '🛡️', 'color': '#87CEEB'},
    'GENERAL_SERVICES_POSTAGE_AND_SHIPPING': {'label': 'Correo y envíos', 'emoji': '📬', 'color': '#87CEEB'},
    'GENERAL_SERVICES_OTHER_GENERAL_SERVICES': {'label': 'Otros servicios', 'emoji': '🔧', 'color': '#87CEEB'},
    # Government
    'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES': {'label': 'Gobierno / Impuestos', 'emoji': '🏛️', 'color': '#778899'},
    'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT': {'label': 'Pago de impuestos', 'emoji': '🧾', 'color': '#778899'},
    'GOVERNMENT_AND_NON_PROFIT_DONATIONS': {'label': 'Donaciones', 'emoji': '🤝', 'color': '#778899'},
    # Home Improvement
    'HOME_IMPROVEMENT_HARDWARE': {'label': 'Ferretería', 'emoji': '🔩', 'color': '#D2691E'},
    'HOME_IMPROVEMENT_SECURITY': {'label': 'Seguridad del hogar', 'emoji': '🔒', 'color': '#D2691E'},
    'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT': {'label': 'Mejoras del hogar', 'emoji': '🔨', 'color': '#D2691E'},
    # Income
    'INCOME_CONTRACTOR': {'label': 'Ingreso (Contratista)', 'emoji': '💼', 'color': '#2ECC71'},
    'INCOME_INTEREST_EARNED': {'label': 'Intereses ganados', 'emoji': '📈', 'color': '#2ECC71'},
    'INCOME_SALARY': {'label': 'Salario / Nómina', 'emoji': '💵', 'color': '#2ECC71'},
    'INCOME_TAX_REFUND': {'label': 'Reembolso de impuestos', 'emoji': '🎉', 'color': '#2ECC71'},
    'INCOME_OTHER_INCOME': {'label': 'Otros ingresos', 'emoji': '💰', 'color': '#2ECC71'},
    # Loan Payments
    'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT': {'label': 'Pago tarjeta de crédito', 'emoji': '💳', 'color': '#E74C3C'},
    'LOAN_PAYMENTS_BNPL': {'label': 'Compra a plazos', 'emoji': '🛒', 'color': '#E74C3C'},
    'LOAN_PAYMENTS_OTHER_PAYMENT': {'label': 'Pago de préstamo', 'emoji': '🏦', 'color': '#E74C3C'},
    'LOAN_PAYMENTS_CAR_PAYMENT': {'label': 'Pago de auto', 'emoji': '🚗', 'color': '#E74C3C'},
    'LOAN_PAYMENTS_MORTGAGE_PAYMENT': {'label': 'Hipoteca', 'emoji': '🏡', 'color': '#E74C3C'},
    'LOAN_PAYMENTS_STUDENT_LOAN': {'label': 'Préstamo estudiantil', 'emoji': '🎓', 'color': '#E74C3C'},
    # Medical
    'MEDICAL_EYE_CARE': {'label': 'Oftalmología', 'emoji': '👁️', 'color': '#DDA0DD'},
    'MEDICAL_PRIMARY_CARE': {'label': 'Consulta médica', 'emoji': '🩺', 'color': '#DDA0DD'},
    'MEDICAL_DENTAL_CARE': {'label': 'Dentista', 'emoji': '🦷', 'color': '#DDA0DD'},
    'MEDICAL_PHARMACIES_AND_SUPPLEMENTS': {'label': 'Farmacia', 'emoji': '💊', 'color': '#DDA0DD'},
    'MEDICAL_OTHER_MEDICAL': {'label': 'Gastos médicos', 'emoji': '🏥', 'color': '#DDA0DD'},
    # Bank Fees
    'BANK_FEES_ATM_FEES': {'label': 'Cargo de cajero ATM', 'emoji': '🏧', 'color': '#95A5A6'},
    'BANK_FEES_OTHER_BANK_FEES': {'label': 'Cargos bancarios', 'emoji': '🏧', 'color': '#95A5A6'},
    'BANK_FEES_OVERDRAFT': {'label': 'Sobregiro', 'emoji': '⚠️', 'color': '#95A5A6'},
    # Travel
    'TRAVEL_LODGING': {'label': 'Hospedaje', 'emoji': '🏨', 'color': '#3498DB'},
    'TRAVEL_FLIGHTS': {'label': 'Vuelos', 'emoji': '✈️', 'color': '#3498DB'},
    'TRAVEL_RENTAL_CARS': {'label': 'Auto rentado', 'emoji': '🚙', 'color': '#3498DB'},
    'TRAVEL_OTHER_TRAVEL': {'label': 'Gastos de viaje', 'emoji': '🧳', 'color': '#3498DB'},
    # Transfers
    'TRANSFER_IN_ACCOUNT_TRANSFER': {'label': 'Transferencia recibida', 'emoji': '📥', 'color': '#27AE60'},
    'TRANSFER_IN_DEPOSIT': {'label': 'Depósito', 'emoji': '🏦', 'color': '#27AE60'},
    'TRANSFER_IN_OTHER_TRANSFER_IN': {'label': 'Otra transferencia recibida', 'emoji': '📥', 'color': '#27AE60'},
    'TRANSFER_IN_TRANSFER_IN_FROM_APPS': {'label': 'Recibido (Zelle/Apps)', 'emoji': '📲', 'color': '#27AE60'},
    'TRANSFER_OUT_ACCOUNT_TRANSFER': {'label': 'Transferencia enviada', 'emoji': '📤', 'color': '#E67E22'},
    'TRANSFER_OUT_SAVINGS': {'label': 'Transferencia a ahorros', 'emoji': '🐷', 'color': '#E67E22'},
    'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS': {'label': 'Enviado (Zelle/Apps)', 'emoji': '📲', 'color': '#E67E22'},
    'TRANSFER_OUT_WITHDRAWAL': {'label': 'Retiro de efectivo', 'emoji': '💵', 'color': '#E67E22'},
    # Other
    'OTHER_OTHER': {'label': 'Otros', 'emoji': '📋', 'color': '#BDC3C7'},
}

def get_category_info(category_key: str, detail_key: str = ''):
    """Get category info - prefers detailed category when available."""
    if detail_key and detail_key in DETAIL_CATEGORY_CONFIG:
        return DETAIL_CATEGORY_CONFIG[detail_key]
    return CATEGORY_CONFIG.get(category_key, CATEGORY_CONFIG['UNCATEGORIZED'])


# ─── Dashboard Endpoint ──────────────────────────────────────────────────────
@finance_router.get('/dashboard')
async def get_finance_dashboard(request: Request):
    """Main personal finance dashboard - balances, income, expenses, categories"""
    user_id = await _get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        # Get current month range
        now = datetime.utcnow()
        first_of_month = datetime(now.year, now.month, 1)
        
        # Previous month for comparison
        if now.month == 1:
            first_prev_month = datetime(now.year - 1, 12, 1)
        else:
            first_prev_month = datetime(now.year, now.month - 1, 1)

        # ── Check if user has linked accounts (personal context) ──
        linked_count = await _db['plaid_items'].count_documents({'user_id': user_id, 'status': 'active', 'context': 'personal'})
        
        # Also count accounts without context set (legacy)
        if linked_count == 0:
            linked_count = await _db['plaid_items'].count_documents({'user_id': user_id, 'status': 'active', 'context': {'$exists': False}})
        
        if linked_count == 0:
            return {
                'success': True,
                'has_accounts': False,
                'accounts': [],
                'summary': None,
                'categories': [],
                'recent_transactions': [],
                'trend': None,
            }

        # ── Get account balances (personal only) ──
        accounts = []
        query = {'user_id': user_id, 'status': 'active', '$or': [{'context': 'personal'}, {'context': {'$exists': False}}]}
        async for item in _db['plaid_items'].find(query):
            for acct in item.get('accounts', []):
                accounts.append({
                    'name': acct.get('name', ''),
                    'mask': acct.get('mask', ''),
                    'type': acct.get('type', ''),
                    'subtype': acct.get('subtype', ''),
                    'current_balance': acct.get('current_balance', 0),
                    'available_balance': acct.get('available_balance'),
                    'institution': item.get('institution_name', ''),
                    'item_id': item.get('item_id', ''),
                    'account_id': acct.get('account_id', ''),
                })

        total_balance = sum(a.get('current_balance', 0) or 0 for a in accounts)

        # Context filter for personal transactions (includes legacy items without context)
        txn_context_filter = {'$or': [{'context': 'personal'}, {'context': {'$exists': False}}]}

        # ── Current month aggregation ──
        current_month_pipeline = [
            {'$match': {
                'user_id': user_id,
                'date': {'$gte': first_of_month.strftime('%Y-%m-%d')},
                'pending': {'$ne': True},
                **txn_context_filter,
            }},
            {'$group': {
                '_id': None,
                'total_income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'total_expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }}
        ]
        
        current_totals = {'total_income': 0, 'total_expenses': 0, 'count': 0}
        async for doc in _db['transactions'].aggregate(current_month_pipeline):
            current_totals = doc

        # ── Previous month aggregation (for trend) ──
        prev_month_pipeline = [
            {'$match': {
                'user_id': user_id,
                'date': {
                    '$gte': first_prev_month.strftime('%Y-%m-%d'),
                    '$lt': first_of_month.strftime('%Y-%m-%d'),
                },
                'pending': {'$ne': True},
                **txn_context_filter,
            }},
            {'$group': {
                '_id': None,
                'total_income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'total_expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
            }}
        ]
        
        prev_totals = {'total_income': 0, 'total_expenses': 0}
        async for doc in _db['transactions'].aggregate(prev_month_pipeline):
            prev_totals = doc

        # ── Category breakdown (current month) ──
        category_pipeline = [
            {'$match': {
                'user_id': user_id,
                'date': {'$gte': first_of_month.strftime('%Y-%m-%d')},
                'amount': {'$gt': 0},  # Only expenses
                'pending': {'$ne': True},
                **txn_context_filter,
            }},
            {'$group': {
                '_id': '$category',
                'total': {'$sum': '$amount'},
                'count': {'$sum': 1},
            }},
            {'$sort': {'total': -1}},
            {'$limit': 10},
        ]

        categories = []
        total_cat_expenses = 0
        async for doc in _db['transactions'].aggregate(category_pipeline):
            cat_key = doc['_id'] or 'UNCATEGORIZED'
            info = get_category_info(cat_key)
            total_cat_expenses += doc['total']
            categories.append({
                'key': cat_key,
                'label': info['label'],
                'emoji': info['emoji'],
                'color': info['color'],
                'amount': round(doc['total'], 2),
                'count': doc['count'],
            })

        # Add percentage to categories
        for cat in categories:
            cat['percentage'] = round((cat['amount'] / total_cat_expenses * 100) if total_cat_expenses > 0 else 0, 1)

        # ── Recent transactions ──
        recent = []
        async for txn in _db['transactions'].find(
            {'user_id': user_id, 'pending': {'$ne': True}, **txn_context_filter},
            {'_id': 0}
        ).sort('date', -1).limit(15):
            cat_info = get_category_info(txn.get('category', 'UNCATEGORIZED'), txn.get('category_detail', ''))
            txn['category_label'] = cat_info['label']
            txn['category_emoji'] = cat_info['emoji']
            txn['category_color'] = cat_info['color']
            recent.append(txn)

        # ── Trend calculation ──
        prev_expenses = prev_totals.get('total_expenses', 0)
        curr_expenses = current_totals.get('total_expenses', 0)
        expense_change = 0
        if prev_expenses > 0:
            expense_change = round(((curr_expenses - prev_expenses) / prev_expenses) * 100, 1)

        prev_income = prev_totals.get('total_income', 0)
        curr_income = current_totals.get('total_income', 0)
        income_change = 0
        if prev_income > 0:
            income_change = round(((curr_income - prev_income) / prev_income) * 100, 1)

        return {
            'success': True,
            'has_accounts': True,
            'accounts': accounts,
            'total_balance': round(total_balance, 2),
            'summary': {
                'income': round(curr_income, 2),
                'expenses': round(curr_expenses, 2),
                'net': round(curr_income - curr_expenses, 2),
                'transaction_count': current_totals.get('count', 0),
            },
            'categories': categories,
            'recent_transactions': recent,
            'trend': {
                'expense_change': expense_change,
                'income_change': income_change,
                'expense_direction': 'up' if expense_change > 0 else 'down' if expense_change < 0 else 'flat',
                'income_direction': 'up' if income_change > 0 else 'down' if income_change < 0 else 'flat',
            },
            'month': now.strftime('%B %Y'),
            'linked_accounts': linked_count,
        }

    except Exception as e:
        logger.error(f"Finance dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── All Transactions with Filters ───────────────────────────────────────────
@finance_router.get('/transactions')
async def get_finance_transactions(request: Request):
    """Get transactions with filtering by category, date, search"""
    user_id = await _get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        limit = int(request.query_params.get('limit', '50'))
        skip = int(request.query_params.get('skip', '0'))
        category = request.query_params.get('category', None)
        search = request.query_params.get('search', None)
        month = request.query_params.get('month', None)  # Format: 2026-01

        query: dict = {'user_id': user_id, 'pending': {'$ne': True}, 'context': 'personal'}

        if category:
            query['category'] = category

        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'merchant_name': {'$regex': search, '$options': 'i'}},
            ]

        if month:
            try:
                year, mon = month.split('-')
                start = f"{year}-{mon}-01"
                if int(mon) == 12:
                    end = f"{int(year)+1}-01-01"
                else:
                    end = f"{year}-{int(mon)+1:02d}-01"
                query['date'] = {'$gte': start, '$lt': end}
            except Exception:
                pass

        transactions = []
        async for txn in _db['transactions'].find(query, {'_id': 0}).sort('date', -1).skip(skip).limit(limit):
            cat_info = get_category_info(txn.get('category', 'UNCATEGORIZED'), txn.get('category_detail', ''))
            txn['category_label'] = cat_info['label']
            txn['category_emoji'] = cat_info['emoji']
            txn['category_color'] = cat_info['color']
            transactions.append(txn)

        total_count = await _db['transactions'].count_documents(query)

        return {
            'success': True,
            'transactions': transactions,
            'total': total_count,
            'has_more': (skip + limit) < total_count,
        }

    except Exception as e:
        logger.error(f"Finance transactions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Monthly Summary (for chart) ─────────────────────────────────────────────
@finance_router.get('/monthly-summary')
async def get_monthly_summary(request: Request):
    """Get 6-month income vs expenses summary for chart"""
    user_id = await _get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        now = datetime.utcnow()
        months_data = []

        for i in range(5, -1, -1):
            month = now.month - i
            year = now.year
            while month <= 0:
                month += 12
                year -= 1

            start = f"{year}-{month:02d}-01"
            if month == 12:
                end = f"{year+1}-01-01"
            else:
                end = f"{year}-{month+1:02d}-01"

            pipeline = [
                {'$match': {
                    'user_id': user_id,
                    'date': {'$gte': start, '$lt': end},
                    'pending': {'$ne': True},
                }},
                {'$group': {
                    '_id': None,
                    'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                    'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                }}
            ]

            totals = {'income': 0, 'expenses': 0}
            async for doc in _db['transactions'].aggregate(pipeline):
                totals = {'income': round(doc.get('income', 0), 2), 'expenses': round(doc.get('expenses', 0), 2)}

            month_names_es = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
            months_data.append({
                'month': month_names_es[month - 1],
                'year': year,
                'income': totals['income'],
                'expenses': totals['expenses'],
                'net': round(totals['income'] - totals['expenses'], 2),
            })

        return {'success': True, 'months': months_data}

    except Exception as e:
        logger.error(f"Monthly summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
