"""
Carousel Banners Endpoints
"""
from fastapi import HTTPException, Depends, Request
from typing import List
import uuid
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def init_carousel_endpoints(app, api_router, db, get_current_user):
    """Initialize carousel banner endpoints"""
    
    # ========== CLIENT ENDPOINTS ==========
    
    @api_router.get('/carousel-banners')
    async def get_active_carousel_banners(request: Request):
        """Get all active carousel banners (client view) - supports ?lang=en or Accept-Language header"""
        try:
            banners = await db.carousel_banners.find({
                'is_active': True
            }).sort('order', 1).to_list(length=100)
            
            # Detect language from query param or Accept-Language header
            language = request.query_params.get('lang', '')
            if not language:
                accept_lang = request.headers.get('Accept-Language', '')
                if 'en' in accept_lang.lower():
                    language = 'en'
                else:
                    language = 'es'
            
            # Localize banners
            for banner in banners:
                banner.pop('_id', None)
                if language == 'en':
                    if banner.get('title_en'):
                        original = banner.get('title', '')
                        emoji = ''
                        if original and not original[0].isalpha():
                            parts = original.split(' ', 1)
                            if len(parts) > 1:
                                emoji = parts[0] + ' '
                        banner['title'] = emoji + banner['title_en']
                    if banner.get('subtitle_en'):
                        banner['subtitle'] = banner['subtitle_en']
            
            return {
                'success': True,
                'banners': banners,
                'total': len(banners)
            }
        except Exception as e:
            logger.error(f"Error getting active carousel banners: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ========== ADMIN ENDPOINTS ==========
    
    @api_router.get('/admin/carousel-banners')
    async def get_all_carousel_banners(
        current_user: dict = Depends(get_current_user)
    ):
        """Get all carousel banners (admin only)"""
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        try:
            banners = await db.carousel_banners.find({}).sort('order', 1).to_list(length=100)
            
            # Remove MongoDB _id
            for banner in banners:
                banner.pop('_id', None)
            
            logger.info(f"🔧 Admin retrieved {len(banners)} carousel banners")
            
            return {
                'success': True,
                'banners': banners,
                'total': len(banners)
            }
        except Exception as e:
            logger.error(f"Error getting all carousel banners: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.post('/admin/carousel-banners')
    async def create_carousel_banner(
        request: dict,
        current_user: dict = Depends(get_current_user)
    ):
        """Create a new carousel banner (admin only)"""
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        try:
            banner_id = f"banner_{uuid.uuid4().hex[:12]}"
            
            new_banner = {
                'id': banner_id,
                'title': request.get('title'),
                'subtitle': request.get('subtitle'),
                'description': request.get('description'),
                'gradient_colors': request.get('gradient_colors', ['#6C1110', '#ED201D']),
                'icon': request.get('icon', 'gift-outline'),
                'button_text': request.get('button_text'),
                'button_action': request.get('button_action'),
                'order': request.get('order', 0),
                'is_active': request.get('is_active', True),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            await db.carousel_banners.insert_one(new_banner)
            
            # Remove MongoDB _id
            new_banner.pop('_id', None)
            
            logger.info(f"✅ Created carousel banner: {banner_id} - {new_banner['title']}")
            
            return {
                'success': True,
                'message': 'Banner created successfully',
                'banner': new_banner
            }
        except Exception as e:
            logger.error(f"Error creating carousel banner: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.put('/admin/carousel-banners/{banner_id}')
    async def update_carousel_banner(
        banner_id: str,
        request: dict,
        current_user: dict = Depends(get_current_user)
    ):
        """Update a carousel banner (admin only)"""
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        try:
            # Check if banner exists
            existing_banner = await db.carousel_banners.find_one({'id': banner_id})
            if not existing_banner:
                raise HTTPException(status_code=404, detail="Banner not found")
            
            # Build update dict
            update_data = {'updated_at': datetime.utcnow()}
            
            if 'title' in request:
                update_data['title'] = request['title']
            if 'subtitle' in request:
                update_data['subtitle'] = request['subtitle']
            if 'description' in request:
                update_data['description'] = request['description']
            if 'gradient_colors' in request:
                update_data['gradient_colors'] = request['gradient_colors']
            if 'icon' in request:
                update_data['icon'] = request['icon']
            if 'button_text' in request:
                update_data['button_text'] = request['button_text']
            if 'button_action' in request:
                update_data['button_action'] = request['button_action']
            if 'order' in request:
                update_data['order'] = request['order']
            if 'is_active' in request:
                update_data['is_active'] = request['is_active']
            
            # Update banner
            await db.carousel_banners.update_one(
                {'id': banner_id},
                {'$set': update_data}
            )
            
            # Get updated banner
            updated_banner = await db.carousel_banners.find_one({'id': banner_id})
            updated_banner.pop('_id', None)
            
            logger.info(f"🔄 Updated carousel banner: {banner_id}")
            
            return {
                'success': True,
                'message': 'Banner updated successfully',
                'banner': updated_banner
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating carousel banner: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.delete('/admin/carousel-banners/{banner_id}')
    async def delete_carousel_banner(
        banner_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Delete a carousel banner (admin only)"""
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        try:
            result = await db.carousel_banners.delete_one({'id': banner_id})
            
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Banner not found")
            
            logger.info(f"🗑️ Deleted carousel banner: {banner_id}")
            
            return {
                'success': True,
                'message': 'Banner deleted successfully'
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting carousel banner: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.patch('/admin/carousel-banners/{banner_id}/toggle')
    async def toggle_carousel_banner(
        banner_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Toggle banner active status (admin only)"""
        if current_user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        try:
            # Get current banner
            banner = await db.carousel_banners.find_one({'id': banner_id})
            if not banner:
                raise HTTPException(status_code=404, detail="Banner not found")
            
            # Toggle is_active
            new_status = not banner.get('is_active', True)
            
            await db.carousel_banners.update_one(
                {'id': banner_id},
                {'$set': {'is_active': new_status, 'updated_at': datetime.utcnow()}}
            )
            
            status_text = "activated" if new_status else "deactivated"
            logger.info(f"🔀 {status_text.capitalize()} carousel banner: {banner_id}")
            
            return {
                'success': True,
                'message': f'Banner {status_text}',
                'is_active': new_status
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error toggling carousel banner: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("✅ Carousel banner endpoints initialized")
