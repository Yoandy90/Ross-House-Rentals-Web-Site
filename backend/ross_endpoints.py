"""
Ross AI Brain - Proactive Alerts Endpoints
API endpoints for Ross's intelligent alerts and dashboard
"""

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ross", tags=["Ross AI Brain"])


def init_ross_endpoints(app, api_router, require_admin, get_database, get_ross_alerts_func):
    """Initialize Ross proactive alerts endpoints"""
    
    @api_router.get('/ross/dashboard')
    async def get_ross_dashboard(
        current_user: dict = Depends(require_admin),
        db = Depends(get_database)
    ):
        """
        Get Ross AI Brain dashboard with alerts, insights, and recommendations
        """
        try:
            ross_alerts = get_ross_alerts_func()
            
            if not ross_alerts:
                return {
                    'success': False,
                    'error': 'Ross alerts service not initialized'
                }
            
            # Run fresh analysis
            result = await ross_alerts.run_full_analysis()
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting Ross dashboard: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get('/ross/alerts')
    async def get_ross_alerts(
        limit: int = 20,
        type: str = None,
        current_user: dict = Depends(require_admin),
        db = Depends(get_database)
    ):
        """
        Get current alerts from Ross
        """
        try:
            ross_alerts = get_ross_alerts_func()
            
            if not ross_alerts:
                return {'success': False, 'error': 'Ross not initialized'}
            
            # Get latest analysis
            latest = await ross_alerts.get_latest_analysis()
            
            if not latest:
                # Run fresh analysis if none exists
                result = await ross_alerts.run_full_analysis()
                alerts = result.get('alerts', [])
            else:
                alerts = latest.get('alerts', [])
            
            # Filter by type if specified
            if type:
                alerts = [a for a in alerts if a.get('type') == type]
            
            return {
                'success': True,
                'alerts': alerts[:limit],
                'total': len(alerts),
                'last_updated': latest.get('timestamp').isoformat() if latest else datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting Ross alerts: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get('/ross/insights')
    async def get_ross_insights(
        current_user: dict = Depends(require_admin),
        db = Depends(get_database)
    ):
        """
        Get business insights from Ross
        """
        try:
            ross_alerts = get_ross_alerts_func()
            
            if not ross_alerts:
                return {'success': False, 'error': 'Ross not initialized'}
            
            latest = await ross_alerts.get_latest_analysis()
            
            if not latest:
                result = await ross_alerts.run_full_analysis()
                return {
                    'success': True,
                    'insights': result.get('insights', []),
                    'recommendations': result.get('recommendations', []),
                    'metrics': result.get('metrics', {})
                }
            
            return {
                'success': True,
                'insights': latest.get('insights', []),
                'recommendations': latest.get('recommendations', []),
                'metrics': latest.get('metrics', {}),
                'last_updated': latest.get('timestamp').isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting Ross insights: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.post('/ross/analyze')
    async def trigger_ross_analysis(
        current_user: dict = Depends(require_admin),
        db = Depends(get_database)
    ):
        """
        Manually trigger a Ross analysis
        """
        try:
            ross_alerts = get_ross_alerts_func()
            
            if not ross_alerts:
                return {'success': False, 'error': 'Ross not initialized'}
            
            result = await ross_alerts.run_full_analysis()
            
            return result
            
        except Exception as e:
            logger.error(f"Error triggering Ross analysis: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get('/ross/history')
    async def get_ross_history(
        days: int = 7,
        current_user: dict = Depends(require_admin),
        db = Depends(get_database)
    ):
        """
        Get Ross alert history
        """
        try:
            ross_alerts = get_ross_alerts_func()
            
            if not ross_alerts:
                return {'success': False, 'error': 'Ross not initialized'}
            
            history = await ross_alerts.get_alert_history(days=days)
            
            # Summarize history
            summary = []
            for analysis in history:
                summary.append({
                    'timestamp': analysis.get('timestamp').isoformat() if analysis.get('timestamp') else None,
                    'total_alerts': analysis.get('alerts_count', 0),
                    'urgent': sum(1 for a in analysis.get('alerts', []) if a.get('type') == 'urgent'),
                    'warnings': sum(1 for a in analysis.get('alerts', []) if a.get('type') == 'warning'),
                })
            
            return {
                'success': True,
                'days': days,
                'analyses_count': len(history),
                'history': summary
            }
            
        except Exception as e:
            logger.error(f"Error getting Ross history: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get('/ross/status')
    async def get_ross_status(
        current_user: dict = Depends(require_admin)
    ):
        """
        Get Ross system status
        """
        try:
            ross_alerts = get_ross_alerts_func()
            
            return {
                'success': True,
                'status': 'active' if ross_alerts else 'inactive',
                'version': '2.0',
                'capabilities': [
                    'proactive_alerts',
                    'document_analysis',
                    'client_insights',
                    'appointment_monitoring',
                    'receipt_classification',
                    'birthday_tracking',
                    'business_metrics',
                    'smart_recommendations'
                ],
                'scheduled_tasks': [
                    {'name': 'Hourly Analysis', 'schedule': 'Every hour at :30'},
                    {'name': 'Urgent Alert Notifications', 'schedule': 'Real-time'}
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting Ross status: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("✅ Ross Proactive Alerts endpoints initialized")
