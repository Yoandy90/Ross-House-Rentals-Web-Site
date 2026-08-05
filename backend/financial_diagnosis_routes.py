"""
Financial Diagnosis Router - Free financial health check for potential bookkeeping clients.
Analyzes Plaid transactions to show spending patterns, potential tax deductions, and savings.
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

diagnosis_router = APIRouter(prefix="/api/financial-diagnosis", tags=["Financial Diagnosis"])

# DB connection
_client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
_db = _client[os.getenv("DB_NAME", "taxportal")]

# Tax deduction categories for self-employed / small business
DEDUCTIBLE_CATEGORIES = {
    'Transportation': {'label': 'Transporte / Gasolina', 'icon': '🚗', 'deduction_rate': 1.0},
    'Travel': {'label': 'Viajes de negocio', 'icon': '✈️', 'deduction_rate': 1.0},
    'Gas Stations': {'label': 'Gasolina', 'icon': '⛽', 'deduction_rate': 1.0},
    'Automotive': {'label': 'Mantenimiento vehicular', 'icon': '🔧', 'deduction_rate': 1.0},
    'Insurance': {'label': 'Seguros', 'icon': '🛡️', 'deduction_rate': 1.0},
    'Utilities': {'label': 'Servicios (agua, luz, internet)', 'icon': '💡', 'deduction_rate': 0.5},
    'Phone': {'label': 'Teléfono / Celular', 'icon': '📱', 'deduction_rate': 0.75},
    'Telecommunications': {'label': 'Telecomunicaciones', 'icon': '📡', 'deduction_rate': 0.75},
    'Office Supplies': {'label': 'Suministros de oficina', 'icon': '📎', 'deduction_rate': 1.0},
    'Software': {'label': 'Software / Apps', 'icon': '💻', 'deduction_rate': 1.0},
    'Subscriptions': {'label': 'Suscripciones', 'icon': '📦', 'deduction_rate': 0.5},
    'Food and Drink': {'label': 'Comidas de negocio', 'icon': '🍽️', 'deduction_rate': 0.5},
    'Restaurants': {'label': 'Restaurantes', 'icon': '🍽️', 'deduction_rate': 0.5},
    'Shops': {'label': 'Compras / Materiales', 'icon': '🛒', 'deduction_rate': 0.5},
    'Home Improvement': {'label': 'Mejoras (home office)', 'icon': '🏠', 'deduction_rate': 0.3},
    'Medical': {'label': 'Gastos médicos', 'icon': '🏥', 'deduction_rate': 1.0},
    'Education': {'label': 'Educación / Cursos', 'icon': '📚', 'deduction_rate': 1.0},
    'Professional Services': {'label': 'Servicios profesionales', 'icon': '👔', 'deduction_rate': 1.0},
    'Advertising': {'label': 'Publicidad / Marketing', 'icon': '📣', 'deduction_rate': 1.0},
}

# Human-readable category names (Plaid raw -> Spanish)
CATEGORY_LABELS = {
    # New Plaid format (personal_finance_category.primary - UPPERCASE)
    'TRANSFER_OUT': 'Transferencias',
    'TRANSFER_IN': 'Transferencias recibidas',
    'LOAN_PAYMENTS': 'Pagos de préstamos',
    'GOVERNMENT_AND_NON_PROFIT': 'Gobierno / Impuestos',
    'GENERAL_MERCHANDISE': 'Compras generales',
    'GENERAL_SERVICES': 'Servicios generales',
    'RENT_AND_UTILITIES': 'Renta y servicios',
    'TRANSPORTATION': 'Transporte',
    'FOOD_AND_DRINK': 'Comida y bebida',
    'TRAVEL': 'Viajes',
    'ENTERTAINMENT': 'Entretenimiento',
    'PERSONAL_CARE': 'Cuidado personal',
    'MEDICAL': 'Gastos médicos',
    'BANK_FEES': 'Cargos bancarios',
    'INCOME': 'Ingresos',
    'HOME_IMPROVEMENT': 'Mejoras del hogar',
    'RECREATION': 'Recreación',
    'AUTOMOTIVE': 'Automóvil',
    'EDUCATION': 'Educación',
    'SUBSCRIPTION': 'Suscripciones',
    'OTHER': 'Otros',
    'PERSONAL_FINANCE_CATEGORY': 'Finanzas personales',
    'MERCHANDISE': 'Compras',
    # Old Plaid format (category array first element - Title Case)
    'Transfer': 'Transferencias',
    'Transfer Out': 'Transferencias',
    'Transfer In': 'Transferencias recibidas',
    'Loan Payments': 'Pagos de préstamos',
    'Loan': 'Préstamos',
    'Bank Fees': 'Cargos bancarios',
    'Interest': 'Intereses',
    'Tax': 'Impuestos',
    'Recreation': 'Recreación',
    'Service': 'Servicios',
    'Community': 'Comunidad',
    'Government': 'Gobierno',
    'Healthcare': 'Salud',
    'Rent': 'Renta',
    'Utilities': 'Servicios (agua, luz, gas)',
    'Gas Stations': 'Gasolina',
    'Restaurants': 'Restaurantes',
    'Groceries': 'Supermercado',
    'Insurance': 'Seguros',
    'Phone': 'Teléfono',
    'Internet': 'Internet',
    'Cable': 'Cable/Streaming',
    'Gyms and Fitness Centers': 'Gimnasio',
    'Clothing': 'Ropa',
    'Electronics': 'Electrónicos',
    'Home Improvement': 'Mejoras del hogar',
    'Automotive': 'Automóvil',
    'Public Transportation': 'Transporte público',
    'Taxi': 'Taxi/Uber',
    'Airlines': 'Aerolíneas',
    'Hotels': 'Hoteles',
    'Fast Food': 'Comida rápida',
    'Coffee Shops': 'Cafeterías',
    'Pharmacies': 'Farmacias',
    'Supermarkets': 'Supermercados',
    'Department Stores': 'Tiendas departamentales',
    'Discount Stores': 'Tiendas de descuento',
    'Digital Purchase': 'Compras digitales',
    'Shops': 'Tiendas',
    'Payment': 'Pagos',
    'Credit Card': 'Tarjeta de crédito',
    'Debit': 'Débito',
    'Deposit': 'Depósito',
    'ATM': 'Cajero ATM',
    'Wire': 'Transferencia wire',
    'Third Party': 'Terceros (Zelle, Venmo)',
    'Software': 'Software',
    'Advertising': 'Publicidad',
    'Office Supplies': 'Oficina',
}

# Average tax rate for self-employed (federal + self-employment tax)
SELF_EMPLOYED_TAX_RATE = 0.30  # ~15.3% SE + ~15% federal income

# Emoji icons for expense categories
CATEGORY_ICONS = {
    'TRANSFER_OUT': '💸', 'TRANSFER_IN': '💰', 'LOAN_PAYMENTS': '🏦',
    'GOVERNMENT_AND_NON_PROFIT': '🏛️', 'GENERAL_MERCHANDISE': '🛒',
    'GENERAL_SERVICES': '🔧', 'RENT_AND_UTILITIES': '🏠', 'TRANSPORTATION': '🚗',
    'FOOD_AND_DRINK': '🍽️', 'TRAVEL': '✈️', 'ENTERTAINMENT': '🎬',
    'PERSONAL_CARE': '💇', 'MEDICAL': '🏥', 'BANK_FEES': '🏦',
    'INCOME': '💵', 'HOME_IMPROVEMENT': '🔨', 'RECREATION': '🎯',
    'AUTOMOTIVE': '🚙', 'EDUCATION': '📚', 'SUBSCRIPTION': '📦',
    'OTHER': '📌', 'MERCHANDISE': '🛍️',
    'Transfer': '💸', 'Transfer Out': '💸', 'Transfer In': '💰',
    'Loan Payments': '🏦', 'Loan': '🏦', 'Bank Fees': '🏦',
    'Interest': '📈', 'Tax': '🏛️', 'Recreation': '🎯',
    'Service': '🔧', 'Community': '🤝', 'Government': '🏛️',
    'Healthcare': '🏥', 'Rent': '🏠', 'Utilities': '💡',
    'Gas Stations': '⛽', 'Restaurants': '🍽️', 'Groceries': '🛒',
    'Insurance': '🛡️', 'Phone': '📱', 'Internet': '🌐',
    'Cable': '📺', 'Gyms and Fitness Centers': '🏋️', 'Clothing': '👕',
    'Electronics': '📱', 'Home Improvement': '🔨', 'Automotive': '🚙',
    'Public Transportation': '🚌', 'Taxi': '🚕', 'Airlines': '✈️',
    'Hotels': '🏨', 'Fast Food': '🍔', 'Coffee Shops': '☕',
    'Pharmacies': '💊', 'Supermarkets': '🛒', 'Department Stores': '🏬',
    'Shops': '🛍️', 'Payment': '💳', 'Credit Card': '💳',
    'Debit': '💳', 'Deposit': '💰', 'ATM': '🏧',
    'Wire': '🔄', 'Third Party': '📲', 'Software': '💻',
    'Advertising': '📣', 'Office Supplies': '📎',
}


async def _get_user_id(request: Request) -> str:
    """Extract user_id from auth token"""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No auth token")
    token = auth_header.replace('Bearer ', '')
    session = await _db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    return session["user_id"]


@diagnosis_router.get("/generate")
async def generate_financial_diagnosis(request: Request):
    """
    Generate a free financial diagnosis from the user's Plaid transactions.
    Analyzes last 3 months of data to show spending patterns and potential savings.
    """
    user_id = await _get_user_id(request)
    
    # Check if user has connected a bank account
    plaid_item = await _db.plaid_items.find_one({
        'user_id': user_id, 'status': 'active'
    })
    
    if not plaid_item:
        return {
            "success": False,
            "has_bank_connected": False,
            "message": "Conecta tu cuenta bancaria para recibir tu diagnóstico financiero gratuito."
        }
    
    # Get transactions from last 3 months
    three_months_ago = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Get all active item_ids for this user
    active_items = []
    async for item in _db.plaid_items.find({'user_id': user_id, 'status': 'active'}, {'item_id': 1}):
        active_items.append(item['item_id'])
    
    if not active_items:
        return {
            "success": False,
            "has_bank_connected": True,
            "message": "No se encontraron cuentas activas. Reconecta tu banco."
        }
    
    # Query transactions
    query = {
        'user_id': user_id,
        'item_id': {'$in': active_items},
        'date': {'$gte': three_months_ago, '$lte': today}
    }
    
    transactions = []
    async for txn in _db.transactions.find(query, {'_id': 0}):
        transactions.append(txn)
    
    if len(transactions) < 5:
        return {
            "success": False,
            "has_bank_connected": True,
            "transaction_count": len(transactions),
            "message": "Necesitamos al menos 5 transacciones para generar tu diagnóstico. Sincroniza tu banco primero."
        }
    
    # === ANALYZE TRANSACTIONS ===
    total_income = 0
    total_expenses = 0
    categories = {}
    deductible_expenses = {}
    monthly_data = {}
    
    for txn in transactions:
        amount = txn.get('amount', 0)
        # Extract category - prefer personal_finance_category.primary (new Plaid format)
        pfc = txn.get('personal_finance_category')
        if isinstance(pfc, dict) and pfc.get('primary'):
            category = pfc['primary']
            detail = pfc.get('detailed', '')
        else:
            raw_cat = txn.get('category', ['Other'])
            category = raw_cat[0] if isinstance(raw_cat, list) else (raw_cat or 'Other')
            detail = txn.get('category_detail', '')
        date = txn.get('date', '')
        month_key = date[:7] if date else 'unknown'
        
        # Initialize monthly bucket
        if month_key not in monthly_data:
            monthly_data[month_key] = {'income': 0, 'expenses': 0}
        
        # In Plaid: positive = expense (money out), negative = income (money in)
        if amount < 0:
            total_income += abs(amount)
            monthly_data[month_key]['income'] += abs(amount)
        else:
            total_expenses += amount
            monthly_data[month_key]['expenses'] += amount
            
            # Categorize
            if category not in categories:
                categories[category] = {'total': 0, 'count': 0}
            categories[category]['total'] += amount
            categories[category]['count'] += 1
            
            # Check if deductible
            if category in DEDUCTIBLE_CATEGORIES:
                deduction_info = DEDUCTIBLE_CATEGORIES[category]
                deductible_amount = amount * deduction_info['deduction_rate']
                if category not in deductible_expenses:
                    deductible_expenses[category] = {
                        'total': 0,
                        'deductible': 0,
                        'count': 0,
                        'label': deduction_info['label'],
                        'icon': deduction_info['icon'],
                    }
                deductible_expenses[category]['total'] += amount
                deductible_expenses[category]['deductible'] += deductible_amount
                deductible_expenses[category]['count'] += 1
    
    # Calculate key metrics
    total_deductible = sum(d['deductible'] for d in deductible_expenses.values())
    estimated_tax_savings = total_deductible * SELF_EMPLOYED_TAX_RATE
    months_analyzed = max(len(monthly_data), 1)
    avg_monthly_income = total_income / months_analyzed
    avg_monthly_expenses = total_expenses / months_analyzed
    
    # Sort categories by amount
    top_expenses = sorted(categories.items(), key=lambda x: x[1]['total'], reverse=True)[:8]
    top_deductions = sorted(deductible_expenses.items(), key=lambda x: x[1]['deductible'], reverse=True)[:6]
    
    # Annual projections
    annual_income_projection = avg_monthly_income * 12
    annual_expense_projection = avg_monthly_expenses * 12
    annual_deduction_projection = total_deductible * (12 / months_analyzed)
    annual_tax_savings_projection = annual_deduction_projection * SELF_EMPLOYED_TAX_RATE
    
    # Determine financial health score (1-100)
    expense_ratio = total_expenses / max(total_income, 1)
    if expense_ratio < 0.5:
        health_score = 85
        health_label = "Excelente"
        health_color = "#34C759"
    elif expense_ratio < 0.7:
        health_score = 70
        health_label = "Bueno"
        health_color = "#007AFF"
    elif expense_ratio < 0.9:
        health_score = 50
        health_label = "Regular"
        health_color = "#FF9500"
    else:
        health_score = 30
        health_label = "Necesita atención"
        health_color = "#FF3B30"
    
    # Build response
    diagnosis = {
        "success": True,
        "has_bank_connected": True,
        "generated_at": datetime.now().isoformat(),
        "period": {
            "start": three_months_ago,
            "end": today,
            "months_analyzed": months_analyzed,
            "transaction_count": len(transactions),
        },
        "summary": {
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "net_profit": round(total_income - total_expenses, 2),
            "avg_monthly_income": round(avg_monthly_income, 2),
            "avg_monthly_expenses": round(avg_monthly_expenses, 2),
            "expense_ratio": round(expense_ratio * 100, 1),
        },
        "health": {
            "score": health_score,
            "label": health_label,
            "color": health_color,
        },
        "deductions": {
            "total_deductible_found": round(total_deductible, 2),
            "estimated_tax_savings": round(estimated_tax_savings, 2),
            "annual_projection_savings": round(annual_tax_savings_projection, 2),
            "categories": [
                {
                    "category": cat,
                    "label": info['label'],
                    "icon": info['icon'],
                    "total_spent": round(info['total'], 2),
                    "deductible_amount": round(info['deductible'], 2),
                    "transaction_count": info['count'],
                }
                for cat, info in top_deductions
            ],
        },
        "top_expenses": [
            {
                "category": CATEGORY_LABELS.get(cat, cat.replace('_', ' ').title()),
                "icon": CATEGORY_ICONS.get(cat, '📌'),
                "total": round(info['total'], 2),
                "count": info['count'],
                "percentage": round(info['total'] / max(total_expenses, 1) * 100, 1),
            }
            for cat, info in top_expenses
        ],
        "monthly_breakdown": [
            {
                "month": month,
                "income": round(data['income'], 2),
                "expenses": round(data['expenses'], 2),
                "net": round(data['income'] - data['expenses'], 2),
            }
            for month, data in sorted(monthly_data.items())
        ],
        "annual_projection": {
            "income": round(annual_income_projection, 2),
            "expenses": round(annual_expense_projection, 2),
            "net_profit": round(annual_income_projection - annual_expense_projection, 2),
            "potential_deductions": round(annual_deduction_projection, 2),
            "potential_tax_savings": round(annual_tax_savings_projection, 2),
        },
        "recommendations": _generate_recommendations(
            expense_ratio, total_deductible, estimated_tax_savings, avg_monthly_income
        ),
        "cta": {
            "plan_name": "Bookkeeping Pro",
            "monthly_price": 149,
            "first_month_price": 1,
            "includes_taxes": True,
            "tagline": "Bookkeeping profesional + Taxes GRATIS",
            "value_proposition": f"Con bookkeeping profesional podrías ahorrar ~${round(annual_tax_savings_projection)} al año en impuestos.",
        }
    }
    
    # Save diagnosis for reference
    await _db.financial_diagnoses.update_one(
        {'user_id': user_id},
        {'$set': {**diagnosis, 'user_id': user_id}},
        upsert=True
    )
    
    logger.info(f"Financial diagnosis generated for user {user_id}: "
                f"income=${total_income:.0f}, expenses=${total_expenses:.0f}, "
                f"deductions=${total_deductible:.0f}, savings=${estimated_tax_savings:.0f}")
    
    return diagnosis


def _generate_recommendations(expense_ratio, total_deductible, tax_savings, avg_income):
    """Generate personalized recommendations based on financial data"""
    recs = []
    
    if total_deductible > 500:
        recs.append({
            "icon": "💰",
            "title": "Deducciones sin reclamar",
            "message": f"Encontramos ${total_deductible:,.0f} en gastos potencialmente deducibles en solo 3 meses. Con bookkeeping profesional, podrías ahorrar ~${tax_savings:,.0f} en impuestos.",
            "priority": "high"
        })
    
    if expense_ratio > 0.8:
        recs.append({
            "icon": "⚠️",
            "title": "Gastos elevados",
            "message": f"Tus gastos representan el {expense_ratio*100:.0f}% de tus ingresos. Un contador puede ayudarte a identificar gastos innecesarios.",
            "priority": "high"
        })
    
    if avg_income > 3000:
        quarterly_estimate = avg_income * 3 * 0.25
        recs.append({
            "icon": "📅",
            "title": "Pagos trimestrales estimados",
            "message": f"Con tus ingresos, el IRS espera pagos trimestrales de ~${quarterly_estimate:,.0f}. Sin estos, podrías recibir penalidades.",
            "priority": "medium"
        })
    
    recs.append({
        "icon": "📊",
        "title": "Organización = Ahorro",
        "message": "Los negocios con bookkeeping profesional ahorran un promedio de $3,000-$5,000 al año en deducciones que no sabían que podían reclamar.",
        "priority": "medium"
    })
    
    recs.append({
        "icon": "🎯",
        "title": "Todo en un solo lugar",
        "message": "Con nuestro plan de $149/mes, tu contabilidad se mantiene al día automáticamente y tus taxes al final del año son GRATIS.",
        "priority": "low"
    })
    
    return recs


@diagnosis_router.get("/status")
async def get_diagnosis_status(request: Request):
    """Check if user already has a diagnosis or needs to generate one"""
    user_id = await _get_user_id(request)
    
    existing = await _db.financial_diagnoses.find_one({'user_id': user_id}, {'_id': 0, 'generated_at': 1, 'summary': 1, 'health': 1})
    has_plaid = await _db.plaid_items.find_one({'user_id': user_id, 'status': 'active'})
    txn_count = await _db.transactions.count_documents({'user_id': user_id})
    
    return {
        "has_diagnosis": existing is not None,
        "has_bank_connected": has_plaid is not None,
        "transaction_count": txn_count,
        "last_diagnosis": existing.get('generated_at') if existing else None,
        "summary": existing.get('summary') if existing else None,
        "health": existing.get('health') if existing else None,
    }
