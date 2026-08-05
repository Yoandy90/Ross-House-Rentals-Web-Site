"""
Endpoints para ejecutar tareas programadas (cron jobs)
"""

from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, timezone, timedelta
import os
import logging

cron_router = APIRouter()

# Secret key para proteger los endpoints
CRON_SECRET = os.getenv('CRON_SECRET', 'change-this-secret-key-in-production')

@cron_router.post('/cron/send-appointment-reminders')
async def trigger_appointment_reminders(authorization: str = Header(None)):
    """
    Endpoint para enviar recordatorios de citas
    Debe ser llamado diariamente a las 9 AM
    
    Requiere header: Authorization: Bearer {CRON_SECRET}
    """
    # Verificar autorización
    if not authorization or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    from server import db
    from notification_service import NotificationService
    
    logging.info("🔔 Iniciando envío de recordatorios de citas")
    
    try:
        # Cargar configuración
        config_doc = await db.api_config.find_one({'_id': 'main'})
        if not config_doc:
            raise HTTPException(status_code=500, detail="API config not found")
        
        # Inicializar servicio de notificaciones
        notif_service = NotificationService(config_doc)
        if not notif_service.twilio_client:
            raise HTTPException(status_code=500, detail="Twilio not configured")
        
        # Calcular rango de fechas (mañana)
        now = datetime.now(timezone.utc)
        tomorrow_start = now + timedelta(hours=23)
        tomorrow_end = now + timedelta(hours=25)
        
        # Buscar citas para mañana
        appointments = await db.appointments.find({
            'scheduled_at': {
                '$gte': tomorrow_start,
                '$lte': tomorrow_end
            },
            'status': {'$in': ['scheduled', 'confirmed']}
        }).to_list(length=1000)
        
        reminders_sent = 0
        errors = 0
        
        for apt in appointments:
            try:
                # Obtener datos del usuario
                user = await db.users.find_one({'_id': apt['user_id']})
                if not user or not user.get('phone'):
                    logging.warning(f"Usuario {apt['user_id']} sin teléfono")
                    continue
                
                # Formatear fecha
                scheduled_time = apt['scheduled_at'].strftime('%I:%M %p')
                scheduled_date = apt['scheduled_at'].strftime('%d/%m/%Y')
                
                # Enviar SMS
                message = f"""
🔔 Recordatorio de Cita - Ross Tax Preparation

Hola {user.get('full_name', user.get('name', 'Cliente'))},

Te recordamos tu cita programada para MAÑANA:

📅 Fecha: {scheduled_date}
⏰ Hora: {scheduled_time}
📋 Servicio: {apt.get('title', 'Consulta')}

📍 Dirección: 305 Bruce Ave, Dumas, TX 79029

Si necesitas cancelar o reprogramar, contáctanos al (806) 934-2018

¡Te esperamos!
Ross Tax Preparation
                """.strip()
                
                notif_service.send_sms(user['phone'], message)
                reminders_sent += 1
                logging.info(f"✅ Recordatorio enviado a {user.get('full_name', 'Usuario')}")
                
            except Exception as e:
                errors += 1
                logging.error(f"❌ Error enviando recordatorio: {e}")
        
        result = {
            'success': True,
            'message': 'Recordatorios procesados',
            'appointments_found': len(appointments),
            'reminders_sent': reminders_sent,
            'errors': errors,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        logging.info(f"✅ Proceso completado: {reminders_sent} enviados, {errors} errores")
        return result
        
    except Exception as e:
        logging.error(f"❌ Error en proceso de recordatorios: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@cron_router.get('/cron/health')
async def cron_health():
    """Health check para el servicio de cron"""
    return {
        'status': 'ok',
        'service': 'cron',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }
