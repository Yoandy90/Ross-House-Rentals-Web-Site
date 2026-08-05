"""
Tax Wizard Analytics Service
Provides conversion metrics and statistics for the admin dashboard
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from bson import ObjectId

logger = logging.getLogger(__name__)

class TaxWizardAnalyticsService:
    """Service for tax wizard analytics and metrics"""
    
    def __init__(self, db):
        self.db = db
        self.sessions = db["tax_wizard_sessions"]
        self.payments = db["tax_wizard_payments"]
    
    async def get_conversion_funnel(self, days: int = 30) -> dict:
        """Get conversion funnel metrics"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Total sessions started
        total_started = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff}
        })
        
        # Sessions with personal info
        with_personal = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff},
            "personal_info": {"$exists": True, "$ne": None}
        })
        
        # Sessions with income
        with_income = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff},
            "income": {"$exists": True, "$ne": None}
        })
        
        # Sessions reaching review
        reached_review = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff},
            "current_step": {"$in": ["review", "completed", "payment"]}
        })
        
        # Completed sessions
        completed = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff},
            "status": "completed"
        })
        
        # Paid sessions
        paid = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff},
            "payment_status": "completed"
        })
        
        def calc_rate(num, denom):
            return round((num / denom * 100), 1) if denom > 0 else 0
        
        return {
            "period_days": days,
            "funnel": [
                {
                    "step": "started",
                    "label": "Iniciaron Wizard",
                    "count": total_started,
                    "rate": 100
                },
                {
                    "step": "personal_info",
                    "label": "Info Personal",
                    "count": with_personal,
                    "rate": calc_rate(with_personal, total_started)
                },
                {
                    "step": "income",
                    "label": "Ingresos",
                    "count": with_income,
                    "rate": calc_rate(with_income, total_started)
                },
                {
                    "step": "review",
                    "label": "Llegaron a Revisión",
                    "count": reached_review,
                    "rate": calc_rate(reached_review, total_started)
                },
                {
                    "step": "completed",
                    "label": "Completados",
                    "count": completed,
                    "rate": calc_rate(completed, total_started)
                },
                {
                    "step": "paid",
                    "label": "Pagados",
                    "count": paid,
                    "rate": calc_rate(paid, total_started)
                }
            ],
            "conversion_rate": calc_rate(completed, total_started),
            "payment_rate": calc_rate(paid, completed) if completed > 0 else 0
        }
    
    async def get_daily_stats(self, days: int = 14) -> List[dict]:
        """Get daily session statistics"""
        results = []
        
        for i in range(days):
            day = datetime.utcnow() - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            started = await self.sessions.count_documents({
                "created_at": {"$gte": day_start, "$lt": day_end}
            })
            
            completed = await self.sessions.count_documents({
                "updated_at": {"$gte": day_start, "$lt": day_end},
                "status": "completed"
            })
            
            paid = await self.sessions.count_documents({
                "payment_completed_at": {"$gte": day_start, "$lt": day_end}
            })
            
            revenue = await self.payments.aggregate([
                {
                    "$match": {
                        "created_at": {"$gte": day_start, "$lt": day_end},
                        "status": "completed"
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total": {"$sum": "$amount"}
                    }
                }
            ]).to_list(1)
            
            results.append({
                "date": day_start.strftime("%Y-%m-%d"),
                "started": started,
                "completed": completed,
                "paid": paid,
                "revenue": revenue[0]["total"] if revenue else 0
            })
        
        return list(reversed(results))
    
    async def get_refund_distribution(self, days: int = 30) -> dict:
        """Get distribution of refund amounts"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        buckets = [
            {"min": 0, "max": 500, "label": "$0-$500"},
            {"min": 500, "max": 1000, "label": "$500-$1K"},
            {"min": 1000, "max": 2500, "label": "$1K-$2.5K"},
            {"min": 2500, "max": 5000, "label": "$2.5K-$5K"},
            {"min": 5000, "max": 10000, "label": "$5K-$10K"},
            {"min": 10000, "max": 999999, "label": "$10K+"}
        ]
        
        results = []
        
        for bucket in buckets:
            count = await self.sessions.count_documents({
                "created_at": {"$gte": cutoff},
                "refund_estimate.estimated_refund": {
                    "$gte": bucket["min"],
                    "$lt": bucket["max"]
                }
            })
            results.append({
                "label": bucket["label"],
                "count": count
            })
        
        return {
            "period_days": days,
            "distribution": results
        }
    
    async def get_complexity_breakdown(self, days: int = 30) -> dict:
        """Get breakdown by case complexity"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        pipeline = [
            {"$match": {"created_at": {"$gte": cutoff}}},
            {
                "$group": {
                    "_id": "$case_complexity",
                    "count": {"$sum": 1},
                    "completed": {
                        "$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}
                    }
                }
            }
        ]
        
        results = await self.sessions.aggregate(pipeline).to_list(10)
        
        return {
            "period_days": days,
            "breakdown": [
                {
                    "complexity": r["_id"] or "unknown",
                    "total": r["count"],
                    "completed": r["completed"],
                    "completion_rate": round(r["completed"] / r["count"] * 100, 1) if r["count"] > 0 else 0
                }
                for r in results
            ]
        }
    
    async def get_revenue_stats(self, days: int = 30) -> dict:
        """Get revenue statistics"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Total revenue
        total_pipeline = [
            {
                "$match": {
                    "created_at": {"$gte": cutoff},
                    "status": "completed"
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$amount"},
                    "count": {"$sum": 1}
                }
            }
        ]
        
        total_result = await self.payments.aggregate(total_pipeline).to_list(1)
        
        # Average payment
        avg_payment = 0
        if total_result and total_result[0]["count"] > 0:
            avg_payment = total_result[0]["total"] / total_result[0]["count"]
        
        # Pending (sessions completed but not paid)
        pending = await self.sessions.count_documents({
            "created_at": {"$gte": cutoff},
            "status": "completed",
            "payment_status": {"$ne": "completed"}
        })
        
        return {
            "period_days": days,
            "total_revenue": total_result[0]["total"] if total_result else 0,
            "total_transactions": total_result[0]["count"] if total_result else 0,
            "average_payment": round(avg_payment, 2),
            "pending_payments": pending
        }
    
    async def get_drop_off_analysis(self, days: int = 30) -> dict:
        """Analyze where users drop off in the wizard"""
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get incomplete sessions
        incomplete = await self.sessions.find({
            "created_at": {"$gte": cutoff},
            "status": {"$in": ["in_progress", "started"]}
        }).to_list(1000)
        
        drop_off_points = {}
        
        for session in incomplete:
            step = session.get("current_step", "unknown")
            drop_off_points[step] = drop_off_points.get(step, 0) + 1
        
        # Sort by count
        sorted_points = sorted(drop_off_points.items(), key=lambda x: x[1], reverse=True)
        
        return {
            "period_days": days,
            "total_incomplete": len(incomplete),
            "drop_off_points": [
                {"step": step, "count": count, "percentage": round(count / len(incomplete) * 100, 1) if incomplete else 0}
                for step, count in sorted_points
            ]
        }
    
    async def get_full_dashboard(self, days: int = 30) -> dict:
        """Get all dashboard metrics in one call"""
        return {
            "generated_at": datetime.utcnow().isoformat(),
            "period_days": days,
            "funnel": await self.get_conversion_funnel(days),
            "daily_stats": await self.get_daily_stats(min(days, 14)),
            "refund_distribution": await self.get_refund_distribution(days),
            "complexity_breakdown": await self.get_complexity_breakdown(days),
            "revenue": await self.get_revenue_stats(days),
            "drop_off": await self.get_drop_off_analysis(days)
        }


# Global instance
analytics_service: Optional[TaxWizardAnalyticsService] = None

def init_analytics_service(db):
    global analytics_service
    analytics_service = TaxWizardAnalyticsService(db)
    logger.info("✅ Tax Wizard Analytics Service initialized")
    return analytics_service
