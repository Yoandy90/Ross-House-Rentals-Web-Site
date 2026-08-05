"""
Quick Actions Endpoints - Gestión de acciones rápidas del home
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Models
class QuickAction(BaseModel):
    id: str
    title: str
    title_es: str
    subtitle: str
    subtitle_es: str
    icon: str  # Ionicons name
    colors: List[str]  # Gradient colors
    route: str  # Navigation route
    order: int
    visible: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class QuickActionCreate(BaseModel):
    title: str
    title_es: str
    subtitle: str
    subtitle_es: str
    icon: str
    colors: List[str]
    route: str
    order: int = 0
    visible: bool = True

class QuickActionUpdate(BaseModel):
    title: Optional[str] = None
    title_es: Optional[str] = None
    subtitle: Optional[str] = None
    subtitle_es: Optional[str] = None
    icon: Optional[str] = None
    colors: Optional[List[str]] = None
    route: Optional[str] = None
    order: Optional[int] = None
    visible: Optional[bool] = None

# Default quick actions
DEFAULT_QUICK_ACTIONS = [
    {
        "id": "appointments",
        "title": "Appointments",
        "title_es": "Citas",
        "subtitle": "Schedule",
        "subtitle_es": "Agendar",
        "icon": "calendar",
        "colors": ["#EC4899", "#EC4899CC"],
        "route": "/(tabs)/appointments",
        "order": 1,
        "visible": True
    },
    {
        "id": "documents",
        "title": "Documents",
        "title_es": "Documentos",
        "subtitle": "View files",
        "subtitle_es": "Ver archivos",
        "icon": "folder",
        "colors": ["#8B5CF6", "#8B5CF6CC"],
        "route": "/(tabs)/documents",
        "order": 2,
        "visible": True
    },
    {
        "id": "services",
        "title": "Services",
        "title_es": "Servicios",
        "subtitle": "From $50",
        "subtitle_es": "Desde $50",
        "icon": "add-circle",
        "colors": ["#FF6B35", "#FF6B35CC"],
        "route": "/(tabs)/request-service",
        "order": 3,
        "visible": True
    },
    {
        "id": "projects",
        "title": "My Projects",
        "title_es": "Mis Proyectos",
        "subtitle": "View status",
        "subtitle_es": "Ver estado",
        "icon": "briefcase",
        "colors": ["#6C1110", "#8B1A18"],
        "route": "/(tabs)/my-projects",
        "order": 4,
        "visible": True
    },
    {
        "id": "subscription",
        "title": "Subscription",
        "title_es": "Suscripción",
        "subtitle": "$15/month",
        "subtitle_es": "$15/mes",
        "icon": "card",
        "colors": ["#6C1110", "#6C1110CC"],
        "route": "/(tabs)/subscription",
        "order": 5,
        "visible": True
    },
    {
        "id": "tax_returns",
        "title": "Tax Returns",
        "title_es": "Declaraciones",
        "subtitle": "View history",
        "subtitle_es": "Ver historial",
        "icon": "document-text",
        "colors": ["#10B981", "#10B981CC"],
        "route": "/(tabs)/tax-returns",
        "order": 6,
        "visible": True
    },
    {
        "id": "referrals",
        "title": "Referrals",
        "title_es": "Referidos",
        "subtitle": "Earn $50",
        "subtitle_es": "Gana $50",
        "icon": "share-social",
        "colors": ["#9C27B0", "#7B1FA2"],
        "route": "/(tabs)/referrals",
        "order": 7,
        "visible": True
    },
    {
        "id": "credit_cards",
        "title": "Credit Cards",
        "title_es": "Tarjetas de Crédito",
        "subtitle": "Apply now",
        "subtitle_es": "Aplica ahora",
        "icon": "card",
        "colors": ["#1E90FF", "#0066CC"],
        "route": "credit-card-modal",
        "order": 8,
        "visible": True
    },
    {
        "id": "loans",
        "title": "Loans",
        "title_es": "Préstamos",
        "subtitle": "From $300",
        "subtitle_es": "Desde $300",
        "icon": "cash",
        "colors": ["#10B981", "#059669"],
        "route": "/loans",
        "order": 9,
        "visible": True
    },
    {
        "id": "shipments",
        "title": "USPS Shipping",
        "title_es": "Envíos USPS",
        "subtitle": "Track packages",
        "subtitle_es": "Rastrear paquetes",
        "icon": "cube",
        "colors": ["#3B82F6", "#3B82F6CC"],
        "route": "/(tabs)/shipments",
        "order": 10,
        "visible": True
    },
    {
        "id": "wallet",
        "title": "My Wallet",
        "title_es": "Mi Billetera",
        "subtitle": "Credits & Balance",
        "subtitle_es": "Créditos y Saldo",
        "icon": "wallet",
        "colors": ["#F59E0B", "#D97706"],
        "route": "/(tabs)/credits",
        "order": 11,
        "visible": False
    },
    {
        "id": "invoices",
        "title": "Invoices",
        "title_es": "Facturas",
        "subtitle": "View & Pay",
        "subtitle_es": "Ver y Pagar",
        "icon": "receipt",
        "colors": ["#EF4444", "#DC2626"],
        "route": "/(tabs)/invoices",
        "order": 12,
        "visible": False
    }
]

def init_quick_actions_endpoints(
    app,
    api_router: APIRouter,
    require_admin_func,
    get_database_func
):
    """Initialize quick actions endpoints"""
    
    db = get_database_func()
    
    async def ensure_default_actions():
        """Ensure default quick actions exist in database"""
        count = await db.quick_actions.count_documents({})
        if count == 0:
            logger.info("📱 Initializing default quick actions...")
            for action in DEFAULT_QUICK_ACTIONS:
                action['created_at'] = datetime.now(timezone.utc)
                action['updated_at'] = datetime.now(timezone.utc)
                await db.quick_actions.insert_one(action)
            logger.info(f"✅ Created {len(DEFAULT_QUICK_ACTIONS)} default quick actions")
    
    # Initialize on startup
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(ensure_default_actions())
        else:
            loop.run_until_complete(ensure_default_actions())
    except:
        pass
    
    # ================== PUBLIC ENDPOINTS ==================
    
    @app.get('/api/quick-actions')
    async def get_quick_actions(visible_only: bool = True):
        """Get all quick actions for home screen"""
        try:
            query = {'visible': True} if visible_only else {}
            actions = await db.quick_actions.find(query).sort('order', 1).to_list(100)
            
            # If no actions, initialize defaults
            if not actions:
                for action in DEFAULT_QUICK_ACTIONS:
                    action['created_at'] = datetime.now(timezone.utc)
                    action['updated_at'] = datetime.now(timezone.utc)
                    await db.quick_actions.insert_one(action)
                
                actions = await db.quick_actions.find(query).sort('order', 1).to_list(100)
            
            # Convert ObjectId to string
            result = []
            for action in actions:
                action['_id'] = str(action['_id'])
                result.append(action)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error getting quick actions: {e}")
            # Return defaults if database fails
            if visible_only:
                return [a for a in DEFAULT_QUICK_ACTIONS if a.get('visible', True)]
            return DEFAULT_QUICK_ACTIONS
    
    # ================== ADMIN ENDPOINTS ==================
    
    @app.get('/api/admin/quick-actions')
    async def admin_get_all_quick_actions(
        current_user: dict = Depends(require_admin_func)
    ):
        """Get all quick actions (admin only)"""
        try:
            actions = await db.quick_actions.find({}).sort('order', 1).to_list(100)
            
            # If no actions, initialize defaults
            if not actions:
                for action in DEFAULT_QUICK_ACTIONS:
                    action['created_at'] = datetime.now(timezone.utc)
                    action['updated_at'] = datetime.now(timezone.utc)
                    await db.quick_actions.insert_one(action)
                
                actions = await db.quick_actions.find({}).sort('order', 1).to_list(100)
            
            result = []
            for action in actions:
                action['_id'] = str(action['_id'])
                result.append(action)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error getting quick actions: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/quick-actions')
    async def admin_create_quick_action(
        action_data: QuickActionCreate,
        current_user: dict = Depends(require_admin_func)
    ):
        """Create a new quick action (admin only)"""
        try:
            # Generate ID from title
            action_id = action_data.title.lower().replace(' ', '_')
            
            # Check if ID already exists
            existing = await db.quick_actions.find_one({'id': action_id})
            if existing:
                action_id = f"{action_id}_{int(datetime.now().timestamp())}"
            
            new_action = {
                'id': action_id,
                'title': action_data.title,
                'title_es': action_data.title_es,
                'subtitle': action_data.subtitle,
                'subtitle_es': action_data.subtitle_es,
                'icon': action_data.icon,
                'colors': action_data.colors,
                'route': action_data.route,
                'order': action_data.order,
                'visible': action_data.visible,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            
            result = await db.quick_actions.insert_one(new_action)
            new_action['_id'] = str(result.inserted_id)
            
            logger.info(f"✅ Created quick action: {action_id}")
            return new_action
            
        except Exception as e:
            logger.error(f"❌ Error creating quick action: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.put('/api/admin/quick-actions/{action_id}')
    async def admin_update_quick_action(
        action_id: str,
        action_data: QuickActionUpdate,
        current_user: dict = Depends(require_admin_func)
    ):
        """Update a quick action (admin only)"""
        try:
            update_data = {k: v for k, v in action_data.dict().items() if v is not None}
            update_data['updated_at'] = datetime.now(timezone.utc)
            
            result = await db.quick_actions.update_one(
                {'id': action_id},
                {'$set': update_data}
            )
            
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="Quick action not found")
            
            updated = await db.quick_actions.find_one({'id': action_id})
            updated['_id'] = str(updated['_id'])
            
            logger.info(f"✅ Updated quick action: {action_id}")
            return updated
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error updating quick action: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.patch('/api/admin/quick-actions/{action_id}/toggle')
    async def admin_toggle_quick_action(
        action_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Toggle visibility of a quick action (admin only)"""
        try:
            action = await db.quick_actions.find_one({'id': action_id})
            if not action:
                raise HTTPException(status_code=404, detail="Quick action not found")
            
            new_visible = not action.get('visible', True)
            
            await db.quick_actions.update_one(
                {'id': action_id},
                {'$set': {'visible': new_visible, 'updated_at': datetime.now(timezone.utc)}}
            )
            
            logger.info(f"✅ Toggled quick action {action_id} to visible={new_visible}")
            return {'id': action_id, 'visible': new_visible}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error toggling quick action: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.delete('/api/admin/quick-actions/{action_id}')
    async def admin_delete_quick_action(
        action_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Delete a quick action (admin only)"""
        try:
            result = await db.quick_actions.delete_one({'id': action_id})
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Quick action not found")
            
            logger.info(f"✅ Deleted quick action: {action_id}")
            return {'message': f'Quick action {action_id} deleted successfully'}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error deleting quick action: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/quick-actions/reorder')
    async def admin_reorder_quick_actions(
        order_data: List[dict],  # [{"id": "appointments", "order": 1}, ...]
        current_user: dict = Depends(require_admin_func)
    ):
        """Reorder quick actions (admin only)"""
        try:
            for item in order_data:
                await db.quick_actions.update_one(
                    {'id': item['id']},
                    {'$set': {'order': item['order'], 'updated_at': datetime.now(timezone.utc)}}
                )
            
            logger.info(f"✅ Reordered {len(order_data)} quick actions")
            return {'message': 'Quick actions reordered successfully'}
            
        except Exception as e:
            logger.error(f"❌ Error reordering quick actions: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/quick-actions/reset')
    async def admin_reset_quick_actions(
        current_user: dict = Depends(require_admin_func)
    ):
        """Reset quick actions to defaults (admin only)"""
        try:
            await db.quick_actions.delete_many({})
            
            for action in DEFAULT_QUICK_ACTIONS:
                action['created_at'] = datetime.now(timezone.utc)
                action['updated_at'] = datetime.now(timezone.utc)
                await db.quick_actions.insert_one(action)
            
            logger.info(f"✅ Reset quick actions to defaults")
            return {'message': 'Quick actions reset to defaults'}
            
        except Exception as e:
            logger.error(f"❌ Error resetting quick actions: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("✅ Quick Actions endpoints initialized")
