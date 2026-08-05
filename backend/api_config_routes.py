"""
API Configuration Routes - Unified Config Manager endpoints.
Provides GET/PUT for admin settings with MongoDB-first approach.
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from unified_config_manager import config_manager, SENSITIVE_KEYS, ENV_KEY_MAP

router = APIRouter()


class ConfigUpdateRequest(BaseModel):
    settings: Dict[str, Any]


@router.get('/admin/api-config')
async def get_api_config():
    """Get all API configuration with masked sensitive values and service status."""
    try:
        all_settings = await config_manager.get_all()
        masked = {}
        raw_status = {}
        
        for key, value in all_settings.items():
            val_str = str(value) if value else ''
            if key in SENSITIVE_KEYS and val_str and len(val_str) > 6:
                masked[key] = '****' + val_str[-4:]
            else:
                masked[key] = val_str
            raw_status[key] = bool(val_str and not val_str.startswith('****'))

        service_status = await config_manager.get_status()

        return {
            'success': True,
            'settings': masked,
            'configured': raw_status,
            'services': service_status,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/admin/api-config')
async def update_api_config(request: ConfigUpdateRequest):
    """Update API configuration. Saves to MongoDB (source of truth)."""
    try:
        updated_keys = []
        skipped_keys = []
        
        for key, value in request.settings.items():
            val_str = str(value).strip() if value else ''
            
            # Skip masked values (user didn't change them)
            if val_str.startswith('****') or not val_str:
                skipped_keys.append(key)
                continue
            
            await config_manager.set(key, val_str)
            
            # Also update os.environ so running services pick up changes immediately
            env_key = ENV_KEY_MAP.get(key, key.upper())
            os.environ[env_key] = val_str
            
            # Also write to admin_config for backward compatibility with legacy code
            if config_manager._db is not None:
                try:
                    await config_manager._db.admin_config.update_one(
                        {},
                        {'$set': {env_key: val_str, key: val_str}},
                        upsert=True
                    )
                except Exception:
                    pass
            
            updated_keys.append(key)
        
        # Invalidate cache so next reads get fresh data
        config_manager.invalidate_cache()
        
        return {
            'success': True,
            'updated': updated_keys,
            'skipped': skipped_keys,
            'message': f'{len(updated_keys)} claves actualizadas exitosamente'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/api-config/test/{service}')
async def test_service_connection(service: str):
    """Test if a service's API keys are valid by making a test call."""
    try:
        if service == 'twilio':
            sid = await config_manager.get('twilio_account_sid')
            token = await config_manager.get('twilio_auth_token')
            if not sid or not token:
                return {'success': False, 'message': 'Twilio SID o Auth Token no configurado'}
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f'https://api.twilio.com/2010-04-01/Accounts/{sid}.json',
                    auth=(sid, token)
                )
                if r.status_code == 200:
                    data = r.json()
                    return {'success': True, 'message': f'✅ Conectado: {data.get("friendly_name", sid)}'}
                return {'success': False, 'message': f'❌ Error {r.status_code}: Credenciales inválidas'}

        elif service == 'sendgrid':
            api_key = await config_manager.get('sendgrid_api_key')
            if not api_key:
                return {'success': False, 'message': 'SendGrid API Key no configurada'}
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    'https://api.sendgrid.com/v3/user/profile',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                if r.status_code == 200:
                    return {'success': True, 'message': '✅ SendGrid conectado correctamente'}
                return {'success': False, 'message': f'❌ Error {r.status_code}: API Key inválida'}

        elif service == 'vapi':
            api_key = await config_manager.get('vapi_api_key')
            if not api_key:
                return {'success': False, 'message': 'VAPI API Key no configurada'}
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    'https://api.vapi.ai/phone-number',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                if r.status_code == 200:
                    return {'success': True, 'message': '✅ VAPI conectado correctamente'}
                return {'success': False, 'message': f'❌ Error {r.status_code}: API Key inválida'}

        elif service == 'google_maps':
            api_key = await config_manager.get('google_maps_api_key')
            if not api_key:
                return {'success': False, 'message': 'Google Maps API Key no configurada'}
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    f'https://maps.googleapis.com/maps/api/geocode/json?address=Houston,TX&key={api_key}'
                )
                data = r.json()
                if data.get('status') == 'OK':
                    return {'success': True, 'message': '✅ Google Maps API conectada correctamente'}
                return {'success': False, 'message': f'❌ Error: {data.get("error_message", data.get("status"))}'}

        elif service == 'openai':
            api_key = await config_manager.get('openai_api_key')
            if not api_key:
                return {'success': False, 'message': 'OpenAI API Key no configurada'}
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': f'Bearer {api_key}'}
                )
                if r.status_code == 200:
                    return {'success': True, 'message': '✅ OpenAI API conectada correctamente'}
                elif r.status_code == 401:
                    return {'success': False, 'message': '❌ API Key inválida o expirada'}
                return {'success': False, 'message': f'❌ Error {r.status_code}: {r.text[:200]}'}

        else:
            return {'success': False, 'message': f'Test no disponible para: {service}'}

    except Exception as e:
        return {'success': False, 'message': f'Error de conexión: {str(e)}'}
