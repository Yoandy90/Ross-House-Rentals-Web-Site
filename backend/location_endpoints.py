"""
Location Tracking Endpoints
Endpoints para rastrear ubicación de clientes
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Callable
from bson import ObjectId
from datetime import datetime

router = APIRouter(prefix="/location", tags=["location"])

# Placeholders - will be set by init_dependencies
get_current_user_func: Callable = None
get_database_func: Callable = None

# Wrapper functions for dependencies
async def get_current_user_dep():
    """Wrapper for get_current_user dependency"""
    if get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Dependencies not initialized")
    return await get_current_user_func()

def get_database_dep():
    """Wrapper for get_database dependency"""
    if get_database_func is None:
        raise HTTPException(status_code=500, detail="Dependencies not initialized")
    return get_database_func()

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = "US"
    postal_code: Optional[str] = None

@router.post("/update")
async def update_location(
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user_dep),
    db = Depends(get_database_dep)
):
    """
    Actualiza la ubicación del usuario autenticado
    La app móvil envía periódicamente su ubicación
    """
    try:
        user_id = str(current_user['_id'])
        
        # Crear documento de ubicación
        location_doc = {
            'user_id': user_id,
            'latitude': location.latitude,
            'longitude': location.longitude,
            'accuracy': location.accuracy,
            'timestamp': datetime.utcnow(),
            'city': location.city,
            'state': location.state,
            'country': location.country,
            'postal_code': location.postal_code
        }
        
        # Guardar en historial
        await db.user_locations.insert_one(location_doc)
        
        # Actualizar última ubicación conocida
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'last_known_location': {
                        'latitude': location.latitude,
                        'longitude': location.longitude,
                        'timestamp': datetime.utcnow(),
                        'city': location.city,
                        'state': location.state
                    },
                    'location_tracking_enabled': True,
                    'last_location_update': datetime.utcnow()
                }
            }
        )
        
        # Detectar cambios significativos usando AI Brain
        try:
            from server import ai_brain_instance
            await ai_brain_instance._check_location_change(
                user_id,
                location.latitude,
                location.longitude
            )
        except:
            pass  # No fallar si AI Brain no está disponible
        
        return {
            "success": True,
            "message": "Ubicación actualizada exitosamente",
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_location_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user_dep),
    db = Depends(get_database_dep)
):
    """
    Obtiene historial de ubicaciones del usuario
    """
    try:
        user_id = str(current_user['_id'])
        
        locations = await db.user_locations.find({
            'user_id': user_id
        }).sort('timestamp', -1).limit(limit).to_list(limit)
        
        # Convertir ObjectId a string
        for loc in locations:
            loc['_id'] = str(loc['_id'])
            if isinstance(loc.get('timestamp'), datetime):
                loc['timestamp'] = loc['timestamp'].isoformat()
        
        return {
            "success": True,
            "total": len(locations),
            "locations": locations
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/toggle-tracking")
async def toggle_location_tracking(
    enabled: bool,
    current_user: dict = Depends(get_current_user_dep),
    db = Depends(get_database_dep)
):
    """
    Permite al usuario habilitar/deshabilitar tracking de ubicación
    """
    try:
        user_id = str(current_user['_id'])
        
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'location_tracking_enabled': enabled,
                    'location_tracking_updated_at': datetime.utcnow()
                }
            }
        )
        
        return {
            "success": True,
            "tracking_enabled": enabled,
            "message": f"Tracking de ubicación {'habilitado' if enabled else 'deshabilitado'}"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/current")
async def get_current_location(
    current_user: dict = Depends(get_current_user_dep),
    db = Depends(get_database_dep)
):
    """
    Obtiene la última ubicación conocida del usuario
    """
    try:
        user = await db.users.find_one({'_id': current_user['_id']})
        
        last_location = user.get('last_known_location')
        
        if not last_location:
            return {
                "success": True,
                "has_location": False,
                "message": "No hay ubicación registrada"
            }
        
        if isinstance(last_location.get('timestamp'), datetime):
            last_location['timestamp'] = last_location['timestamp'].isoformat()
        
        return {
            "success": True,
            "has_location": True,
            "location": last_location,
            "tracking_enabled": user.get('location_tracking_enabled', False)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def init_dependencies(get_user_func, get_db_func):
    """Initialize dependency functions"""
    global get_current_user_func, get_database_func
    get_current_user_func = get_user_func
    get_database_func = get_db_func
