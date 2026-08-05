"""
Real-time Analytics System for Ross Tax Website
Tracks visitors, pages, devices, locations and provides admin dashboard
"""
import logging
import uuid
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import httpx

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
db = None
notification_service = None

# ============== MODELS ==============

class PageViewEvent(BaseModel):
    page: str
    referrer: Optional[str] = None
    session_id: Optional[str] = None
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    user_agent: Optional[str] = None
    site: Optional[str] = "rosstax"  # "rosstax" or "micasousa"


# ============== HELPER FUNCTIONS ==============

def set_dependencies(database, notif_service=None):
    """Set database and notification service dependencies"""
    global db, notification_service
    db = database
    notification_service = notif_service
    logger.info("✅ Analytics endpoints initialized")


async def _verify_admin(request: Request):
    """Verify admin authentication for analytics endpoints"""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No autenticado")
    token = auth.replace('Bearer ', '')
    session = await db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    return True


async def get_geo_from_ip(ip: str) -> Dict[str, Any]:
    """Get geographic location from IP address"""
    if ip in ['127.0.0.1', 'localhost', '::1'] or ip.startswith('10.') or ip.startswith('192.168.'):
        return {
            'country': 'Local',
            'country_code': 'XX',
            'city': 'Development',
            'region': 'Local'
        }
    
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f'http://ip-api.com/json/{ip}?fields=status,country,countryCode,region,city')
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success':
                    return {
                        'country': data.get('country', 'Unknown'),
                        'country_code': data.get('countryCode', 'XX'),
                        'city': data.get('city', 'Unknown'),
                        'region': data.get('region', '')
                    }
    except Exception as e:
        logger.error(f"Error getting geo data: {e}")
    
    return {
        'country': 'Unknown',
        'country_code': 'XX',
        'city': 'Unknown',
        'region': ''
    }


def parse_user_agent(ua: str) -> Dict[str, str]:
    """Parse user agent to extract device info"""
    ua_lower = ua.lower() if ua else ''
    
    # Detect device type
    if 'mobile' in ua_lower or 'android' in ua_lower or 'iphone' in ua_lower:
        device_type = 'mobile'
    elif 'tablet' in ua_lower or 'ipad' in ua_lower:
        device_type = 'tablet'
    else:
        device_type = 'desktop'
    
    # Detect OS
    if 'windows' in ua_lower:
        os_name = 'Windows'
    elif 'mac' in ua_lower or 'iphone' in ua_lower or 'ipad' in ua_lower:
        os_name = 'iOS/macOS'
    elif 'android' in ua_lower:
        os_name = 'Android'
    elif 'linux' in ua_lower:
        os_name = 'Linux'
    else:
        os_name = 'Unknown'
    
    # Detect browser
    if 'chrome' in ua_lower and 'edg' not in ua_lower:
        browser = 'Chrome'
    elif 'firefox' in ua_lower:
        browser = 'Firefox'
    elif 'safari' in ua_lower and 'chrome' not in ua_lower:
        browser = 'Safari'
    elif 'edg' in ua_lower:
        browser = 'Edge'
    else:
        browser = 'Other'
    
    return {
        'device_type': device_type,
        'os': os_name,
        'browser': browser
    }


# ============== PUBLIC ENDPOINTS ==============

@router.post('/public/analytics/pageview')
async def track_pageview(data: PageViewEvent, request: Request):
    """Track a page view event (public endpoint for website)"""
    try:
        # Get client IP
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            ip = forwarded.split(',')[0].strip()
        else:
            ip = request.client.host if request.client else 'unknown'
        
        # Get user agent
        user_agent = data.user_agent or request.headers.get('user-agent', '')
        
        # Parse device info
        device_info = parse_user_agent(user_agent)
        
        # Get geo location
        geo = await get_geo_from_ip(ip)
        
        # Generate or use session ID
        session_id = data.session_id or str(uuid.uuid4())
        
        # Create pageview document
        pageview = {
            'id': str(uuid.uuid4()),
            'session_id': session_id,
            'page': data.page,
            'referrer': data.referrer,
            'site': data.site or 'rosstax',
            'ip': ip,
            'country': geo['country'],
            'country_code': geo['country_code'],
            'city': geo['city'],
            'region': geo['region'],
            'device_type': device_info['device_type'],
            'os': device_info['os'],
            'browser': device_info['browser'],
            'screen_width': data.screen_width,
            'screen_height': data.screen_height,
            'language': data.language,
            'timezone': data.timezone,
            'user_agent': user_agent,
            'timestamp': datetime.utcnow().isoformat(),
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
            'hour': datetime.utcnow().hour
        }
        
        # Save to database
        await db.analytics_pageviews.insert_one(pageview)
        
        # Update or create session
        await db.analytics_sessions.update_one(
            {'session_id': session_id},
            {
                '$set': {
                    'last_activity': datetime.utcnow().isoformat(),
                    'ip': ip,
                    'country': geo['country'],
                    'country_code': geo['country_code'],
                    'city': geo['city'],
                    'device_type': device_info['device_type'],
                    'os': device_info['os'],
                    'browser': device_info['browser'],
                    'site': data.site or 'rosstax',
                },
                '$inc': {'page_count': 1},
                '$setOnInsert': {
                    'session_id': session_id,
                    'started_at': datetime.utcnow().isoformat(),
                }
            },
            upsert=True
        )
        
        logger.debug(f"📊 Pageview tracked: {data.page} from {geo['country']}")
        
        return {'success': True, 'session_id': session_id}
        
    except Exception as e:
        logger.error(f"❌ Error tracking pageview: {e}")
        # Don't raise error to avoid breaking user experience
        return {'success': False}


# ============== ADMIN ENDPOINTS ==============

@router.get('/admin/analytics/realtime')
async def get_realtime_analytics(request: Request):
    """Get real-time analytics - visitors in last 5 minutes"""
    await _verify_admin(request)
    try:
        five_minutes_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        
        # Active sessions in last 5 minutes
        active_sessions = await db.analytics_sessions.find({
            'last_activity': {'$gte': five_minutes_ago}
        }).to_list(length=100)
        
        # Count by country
        countries = {}
        devices = {'mobile': 0, 'desktop': 0, 'tablet': 0}
        
        for session in active_sessions:
            country = session.get('country', 'Unknown')
            countries[country] = countries.get(country, 0) + 1
            device = session.get('device_type', 'desktop')
            devices[device] = devices.get(device, 0) + 1
        
        return {
            'online_now': len(active_sessions),
            'visitors': [{
                'session_id': s['session_id'][:8] + '...',
                'country': s.get('country', 'Unknown'),
                'country_code': s.get('country_code', 'XX'),
                'city': s.get('city', 'Unknown'),
                'device': s.get('device_type', 'desktop'),
                'browser': s.get('browser', 'Unknown'),
                'pages': s.get('page_count', 1),
                'last_activity': s.get('last_activity')
            } for s in active_sessions],
            'countries': countries,
            'devices': devices
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting realtime analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/analytics/dashboard')
async def get_analytics_dashboard(request: Request, site: Optional[str] = None):
    """Get analytics dashboard data. Filter by site: 'micasousa' or 'rosstax'"""
    await _verify_admin(request)
    try:
        now = datetime.utcnow()
        today = now.strftime('%Y-%m-%d')
        yesterday = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        week_ago = (now - timedelta(days=7)).strftime('%Y-%m-%d')
        month_ago = (now - timedelta(days=30)).strftime('%Y-%m-%d')
        
        # Base filter by site
        site_filter = {}
        if site:
            site_filter['site'] = site
        
        # Today's stats
        today_views = await db.analytics_pageviews.count_documents({**site_filter, 'date': today})
        today_sessions = await db.analytics_sessions.count_documents({
            **site_filter, 'started_at': {'$gte': f'{today}T00:00:00'}
        })
        
        # Yesterday's stats
        yesterday_views = await db.analytics_pageviews.count_documents({**site_filter, 'date': yesterday})
        
        # This week
        week_views = await db.analytics_pageviews.count_documents({**site_filter, 'date': {'$gte': week_ago}})
        
        # This month
        month_views = await db.analytics_pageviews.count_documents({**site_filter, 'date': {'$gte': month_ago}})
        
        # Views by hour today
        pipeline_hourly = [
            {'$match': {**site_filter, 'date': today}},
            {'$group': {'_id': '$hour', 'count': {'$sum': 1}}},
            {'$sort': {'_id': 1}}
        ]
        hourly_data = await db.analytics_pageviews.aggregate(pipeline_hourly).to_list(length=24)
        hourly = {str(h['_id']): h['count'] for h in hourly_data}
        
        # Views by day this week
        pipeline_daily = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}}},
            {'$group': {'_id': '$date', 'count': {'$sum': 1}}},
            {'$sort': {'_id': 1}}
        ]
        daily_data = await db.analytics_pageviews.aggregate(pipeline_daily).to_list(length=7)
        daily = [{'date': d['_id'], 'views': d['count']} for d in daily_data]
        
        # Top pages this week
        pipeline_pages = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}}},
            {'$group': {'_id': '$page', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        top_pages_data = await db.analytics_pageviews.aggregate(pipeline_pages).to_list(length=10)
        top_pages = [{'page': p['_id'], 'views': p['count']} for p in top_pages_data]
        
        # Countries this week
        pipeline_countries = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}}},
            {'$group': {'_id': {'country': '$country', 'code': '$country_code'}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        countries_data = await db.analytics_pageviews.aggregate(pipeline_countries).to_list(length=10)
        countries = [{'country': c['_id']['country'], 'code': c['_id'].get('code', ''), 'views': c['count']} for c in countries_data]
        
        # Top cities
        pipeline_cities = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}, 'city': {'$ne': ''}}},
            {'$group': {'_id': {'city': '$city', 'region': '$region', 'country': '$country'}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        cities_data = await db.analytics_pageviews.aggregate(pipeline_cities).to_list(length=10)
        top_cities = [{'city': c['_id']['city'], 'region': c['_id'].get('region', ''), 'country': c['_id'].get('country', ''), 'views': c['count']} for c in cities_data]
        
        # Top states/regions
        pipeline_regions = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}, 'region': {'$ne': ''}}},
            {'$group': {'_id': {'region': '$region', 'country': '$country'}, 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        regions_data = await db.analytics_pageviews.aggregate(pipeline_regions).to_list(length=10)
        top_regions = [{'region': r['_id']['region'], 'country': r['_id'].get('country', ''), 'views': r['count']} for r in regions_data]
        
        # Devices this week
        pipeline_devices = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}}},
            {'$group': {'_id': '$device_type', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        devices_data = await db.analytics_pageviews.aggregate(pipeline_devices).to_list(length=5)
        devices = {d['_id']: d['count'] for d in devices_data}
        
        # Browsers this week  
        pipeline_browsers = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}}},
            {'$group': {'_id': '$browser', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        browsers_data = await db.analytics_pageviews.aggregate(pipeline_browsers).to_list(length=5)
        browsers = {b['_id']: b['count'] for b in browsers_data}
        
        # Referrer sources this week
        pipeline_sources = [
            {'$match': {**site_filter, 'date': {'$gte': week_ago}, 'referrer': {'$ne': None}}},
            {'$group': {'_id': '$referrer', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        sources_data = await db.analytics_pageviews.aggregate(pipeline_sources).to_list(length=10)
        sources = [{'source': s['_id'] or 'Directo', 'views': s['count']} for s in sources_data]
        
        # Calculate growth
        growth = 0
        if yesterday_views > 0:
            growth = round(((today_views - yesterday_views) / yesterday_views) * 100, 1)
        
        return {
            'today': {
                'views': today_views,
                'sessions': today_sessions,
                'growth': growth
            },
            'week': {
                'views': week_views
            },
            'month': {
                'views': month_views
            },
            'hourly': hourly,
            'daily': daily,
            'top_pages': top_pages,
            'countries': countries,
            'top_cities': top_cities,
            'top_regions': top_regions,
            'devices': devices,
            'browsers': browsers,
            'sources': sources
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting analytics dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/analytics/pageviews')
async def get_pageviews(
    request: Request,
    date: Optional[str] = None,
    page: Optional[str] = None,
    country: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get detailed pageview logs"""
    await _verify_admin(request)
    try:
        query = {}
        if date:
            query['date'] = date
        if page:
            query['page'] = {'$regex': page, '$options': 'i'}
        if country:
            query['country'] = {'$regex': country, '$options': 'i'}
        
        cursor = db.analytics_pageviews.find(query).sort('timestamp', -1).skip(skip).limit(limit)
        pageviews = await cursor.to_list(length=limit)
        
        total = await db.analytics_pageviews.count_documents(query)
        
        # Clean up MongoDB ObjectId
        for pv in pageviews:
            pv['_id'] = str(pv['_id'])
        
        return {
            'success': True,
            'pageviews': pageviews,
            'total': total,
            'limit': limit,
            'skip': skip
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting pageviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))
