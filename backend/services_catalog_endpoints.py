"""
Services Catalog Endpoints
Manage services and packages dynamically from the database
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import logging

router = APIRouter()
db = None

def set_db(database):
    global db
    db = database

# Models
class ServiceCreate(BaseModel):
    type: str = "service"  # service or package
    id: str
    title: Optional[str] = None
    name: Optional[str] = None
    description: str
    icon: str
    color: str = "#6C1110"
    price: Optional[str] = None
    price_value: Optional[float] = 0
    popular: Optional[bool] = False
    badge: Optional[str] = None
    savings: Optional[float] = 0
    features: Optional[List[str]] = []
    active: bool = True
    order: int = 0

class ServiceUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    price: Optional[str] = None
    price_value: Optional[float] = None
    popular: Optional[bool] = None
    badge: Optional[str] = None
    savings: Optional[float] = None
    features: Optional[List[str]] = None
    active: Optional[bool] = None
    order: Optional[int] = None

# Public endpoint - Get all active services
@router.get('/services/catalog')
async def get_services_catalog():
    """Get all active services and packages for clients"""
    try:
        services = await db.services_catalog.find(
            {'type': 'service', 'active': True}
        ).sort('order', 1).to_list(100)
        
        packages = await db.services_catalog.find(
            {'type': 'package', 'active': True}
        ).sort('order', 1).to_list(100)
        
        # Convert ObjectId to string
        for s in services:
            s['_id'] = str(s['_id'])
        for p in packages:
            p['_id'] = str(p['_id'])
        
        return {
            'success': True,
            'services': services,
            'packages': packages
        }
    except Exception as e:
        logging.error(f"Error getting services catalog: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin endpoints
@router.get('/admin/services/catalog')
async def admin_get_all_services():
    """Get all services and packages (including inactive) for admin"""
    try:
        services = await db.services_catalog.find(
            {'type': 'service'}
        ).sort('order', 1).to_list(100)
        
        packages = await db.services_catalog.find(
            {'type': 'package'}
        ).sort('order', 1).to_list(100)
        
        for s in services:
            s['_id'] = str(s['_id'])
        for p in packages:
            p['_id'] = str(p['_id'])
        
        return {
            'success': True,
            'services': services,
            'packages': packages
        }
    except Exception as e:
        logging.error(f"Error getting admin services: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/admin/services/catalog')
async def create_service(service: ServiceCreate):
    """Create a new service or package"""
    try:
        service_dict = service.dict()
        service_dict['created_at'] = datetime.utcnow()
        service_dict['updated_at'] = datetime.utcnow()
        
        # Check if ID already exists
        existing = await db.services_catalog.find_one({'id': service.id})
        if existing:
            raise HTTPException(status_code=400, detail="Service ID already exists")
        
        result = await db.services_catalog.insert_one(service_dict)
        
        return {
            'success': True,
            'id': str(result.inserted_id),
            'message': 'Service created successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating service: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put('/admin/services/catalog/{service_id}')
async def update_service(service_id: str, update: ServiceUpdate):
    """Update an existing service or package"""
    try:
        update_dict = {k: v for k, v in update.dict().items() if v is not None}
        update_dict['updated_at'] = datetime.utcnow()
        
        # Try to find by ObjectId first, then by string id
        query = None
        try:
            query = {'_id': ObjectId(service_id)}
            existing = await db.services_catalog.find_one(query)
        except:
            existing = None
        
        if not existing:
            query = {'id': service_id}
            existing = await db.services_catalog.find_one(query)
        
        if not existing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        await db.services_catalog.update_one(query, {'$set': update_dict})
        
        return {
            'success': True,
            'message': 'Service updated successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete('/admin/services/catalog/{service_id}')
async def delete_service(service_id: str):
    """Delete a service or package"""
    try:
        query = None
        try:
            query = {'_id': ObjectId(service_id)}
            existing = await db.services_catalog.find_one(query)
        except:
            existing = None
        
        if not existing:
            query = {'id': service_id}
            existing = await db.services_catalog.find_one(query)
        
        if not existing:
            raise HTTPException(status_code=404, detail="Service not found")
        
        await db.services_catalog.delete_one(query)
        
        return {
            'success': True,
            'message': 'Service deleted successfully'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting service: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/admin/services/catalog/reorder')
async def reorder_services(items: List[dict]):
    """Reorder services by updating their order field"""
    try:
        for item in items:
            service_id = item.get('id')
            new_order = item.get('order', 0)
            
            query = {'id': service_id}
            await db.services_catalog.update_one(
                query, 
                {'$set': {'order': new_order, 'updated_at': datetime.utcnow()}}
            )
        
        return {
            'success': True,
            'message': 'Services reordered successfully'
        }
    except Exception as e:
        logging.error(f"Error reordering services: {e}")
        raise HTTPException(status_code=500, detail=str(e))

print("📦 Services Catalog endpoints loaded")
