"""
═══════════════════════════════════════════════════════════════════════════
Ross Lending — Admin Dashboard Router
Modular FastAPI router for dashboard statistics, alerts, and chart data.
═══════════════════════════════════════════════════════════════════════════
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Header
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/lending/dashboard", tags=["Admin-Dashboard"])

_db = None
_get_user = None


def init_admin_dashboard(db, get_current_user_fn):
    global _db, _get_user
    _db = db
    _get_user = get_current_user_fn
    logger.info("📊 Admin Dashboard router initialized")


async def _require_admin(authorization: Optional[str] = None):
    if not authorization:
        raise HTTPException(401, "Not authenticated")
    user = await _get_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/admin/lending/dashboard/stats — Key Performance Indicators
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_dashboard_stats(authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)

    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # All regulated loans
    loans = await _db.regulated_loans.find({}).to_list(None)

    active = [l for l in loans if l.get("status") == "active"]
    paid_off = [l for l in loans if l.get("status") == "paid_off"]
    delinquent = [l for l in loans if l.get("status") in ("delinquent", "default")]

    total_invested = sum(l.get("amount", 0) for l in loans)
    total_balance = sum(l.get("balance", 0) for l in active)
    total_interest = sum(l.get("total_interest", 0) for l in loans)
    total_admin_fees = sum(l.get("admin_fee", 0) for l in loans)
    total_profit = total_interest + total_admin_fees
    total_collected = sum((l.get("total_to_pay", 0) - l.get("balance", 0)) for l in loans)

    # This month's loans
    month_loans = []
    for l in loans:
        ca = l.get("created_at")
        if not ca:
            continue
        try:
            dt = datetime.fromisoformat(str(ca).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt >= start_of_month:
                month_loans.append(l)
        except:
            pass

    # Pending applications
    pending_apps = await _db.lending_applications.count_documents({"status": "pending"})

    # Total clients (unique)
    total_clients = await _db.users.count_documents({"role": "client"})

    # Delinquency rate
    delinquency_rate = (len(delinquent) / len(loans) * 100) if loans else 0

    # Collection rate
    total_expected = sum(l.get("total_to_pay", 0) for l in loans)
    collection_rate = (total_collected / total_expected * 100) if total_expected > 0 else 0

    return {
        "kpis": {
            "total_invested": total_invested,
            "total_profit": total_profit,
            "total_balance": total_balance,
            "total_collected": total_collected,
            "total_interest": total_interest,
            "total_admin_fees": total_admin_fees,
            "pending_applications": pending_apps,
            "total_clients": total_clients,
            "delinquency_rate": round(delinquency_rate, 1),
            "collection_rate": round(collection_rate, 1),
        },
        "counts": {
            "total": len(loans),
            "active": len(active),
            "paid_off": len(paid_off),
            "delinquent": len(delinquent),
            "this_month": len(month_loans),
        },
        "month_invested": sum(l.get("amount", 0) for l in month_loans),
        "month_profit": sum((l.get("total_interest", 0) + l.get("admin_fee", 0)) for l in month_loans),
    }


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/admin/lending/dashboard/charts — Chart Data
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/charts")
async def get_dashboard_charts(authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)

    loans = await _db.regulated_loans.find({}).to_list(None)

    # ─── Loan Type Distribution (Pie Chart) ───
    type_counts = {}
    type_amounts = {}
    for l in loans:
        lt = l.get("loan_type", "unknown")
        type_counts[lt] = type_counts.get(lt, 0) + 1
        type_amounts[lt] = type_amounts.get(lt, 0) + l.get("amount", 0)

    type_labels = {
        "subchapter_e": "Subcapítulo E",
        "subchapter_f": "Subcapítulo F",
        "tax_advance": "Tax Advance",
    }
    type_colors = {
        "subchapter_e": "#34D399",
        "subchapter_f": "#818CF8",
        "tax_advance": "#FBBF24",
    }

    loan_type_chart = [
        {
            "name": type_labels.get(k, k),
            "count": v,
            "amount": type_amounts.get(k, 0),
            "color": type_colors.get(k, "#6B7280"),
            "legendFontColor": "#9CA3AF",
        }
        for k, v in type_counts.items()
    ]

    # ─── Status Distribution (Pie Chart) ───
    status_map = {
        "active": {"label": "Activos", "color": "#10B981"},
        "paid_off": {"label": "Pagados", "color": "#3B82F6"},
        "delinquent": {"label": "En Mora", "color": "#F59E0B"},
        "default": {"label": "Incobrable", "color": "#EF4444"},
        "cancelled": {"label": "Cancelado", "color": "#6B7280"},
    }
    status_counts = {}
    for l in loans:
        s = l.get("status", "active")
        status_counts[s] = status_counts.get(s, 0) + 1

    status_chart = [
        {
            "name": status_map.get(k, {}).get("label", k),
            "count": v,
            "color": status_map.get(k, {}).get("color", "#6B7280"),
            "legendFontColor": "#9CA3AF",
        }
        for k, v in status_counts.items() if v > 0
    ]

    # ─── Monthly Trend (Bar Chart — last 6 months) ───
    now = datetime.now(timezone.utc)
    monthly_data = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0)
        if i > 0:
            month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        else:
            month_end = now

        month_loans = []
        for l in loans:
            ca = l.get("created_at")
            if not ca:
                continue
            try:
                dt = datetime.fromisoformat(str(ca).replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if month_start <= dt < month_end:
                    month_loans.append(l)
            except:
                pass

        month_names_es = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
        monthly_data.append({
            "month": month_names_es[month_start.month - 1],
            "invested": sum(l.get("amount", 0) for l in month_loans),
            "profit": sum((l.get("total_interest", 0) + l.get("admin_fee", 0)) for l in month_loans),
            "count": len(month_loans),
        })

    return {
        "loan_type_distribution": loan_type_chart,
        "status_distribution": status_chart,
        "monthly_trend": monthly_data,
    }


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/admin/lending/dashboard/alerts — Active Alerts
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/alerts")
async def get_dashboard_alerts(authorization: Optional[str] = Header(None)):
    await _require_admin(authorization)

    alerts = []

    # Pending loan applications
    pending_apps = await _db.lending_applications.find({"status": "pending"}).sort("created_at", -1).to_list(20)
    for app in pending_apps:
        alerts.append({
            "type": "pending_application",
            "severity": "warning",
            "icon": "📋",
            "title": f"Solicitud pendiente: {app.get('first_name', '')} {app.get('last_name', '')}",
            "subtitle": f"${app.get('amount', '0')} — {app.get('loan_type', 'N/A')}",
            "date": str(app.get("created_at", "")),
            "id": str(app.get("_id", "")),
        })

    # Delinquent loans
    delinquent = await _db.regulated_loans.find({"status": {"$in": ["delinquent", "default"]}}).to_list(20)
    for loan in delinquent:
        alerts.append({
            "type": "delinquent_loan",
            "severity": "error",
            "icon": "⚠️",
            "title": f"Pago atrasado: {loan.get('client_name', 'N/A')}",
            "subtitle": f"{loan.get('loan_number', '')} — Balance: ${loan.get('balance', 0):,.0f}",
            "date": str(loan.get("created_at", "")),
            "id": str(loan.get("_id", "")),
        })

    # Recent payments (last 7 days)
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_payments = await _db.loan_payments.find(
        {"created_at": {"$gte": seven_days_ago}}
    ).sort("created_at", -1).to_list(10)
    for p in recent_payments:
        alerts.append({
            "type": "recent_payment",
            "severity": "success",
            "icon": "💰",
            "title": f"Pago recibido: ${p.get('amount', 0):,.2f}",
            "subtitle": f"{p.get('loan_number', '')} — {p.get('payment_method', 'N/A')}",
            "date": str(p.get("created_at", "")),
            "id": str(p.get("_id", "")),
        })

    # Sort by severity: error > warning > info > success
    severity_order = {"error": 0, "warning": 1, "info": 2, "success": 3}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 4))

    return {"alerts": alerts, "total": len(alerts)}
