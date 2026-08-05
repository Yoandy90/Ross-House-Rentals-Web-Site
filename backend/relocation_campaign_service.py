"""
Relocation Campaign Service
Campañas específicas para clientes que se mudaron de estado o están fuera del país
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import logging
from bson import ObjectId

logger = logging.getLogger(__name__)

# ============== EMAIL TEMPLATES ==============

RELOCATION_TEMPLATES = {
    "moved_state": {
        "id": "relocation_moved_state",
        "name": "Campaña general - Temporada de Impuestos",
        "subject": "🌟 {{client_name}}, ¿listo para tu declaración de impuestos 2024?",
        "preview": "Preparamos impuestos en los 50 estados - 100% virtual",
        "html": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #6C1110 0%, #D32F2F 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Ross Tax Preparation</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Tu aliado fiscal de confianza</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">¡Hola {{client_name}}! 👋</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                ¡Espero que estés muy bien! Te escribo porque la <strong>temporada de impuestos del año fiscal 2025</strong> ya está aquí 
                y quiero asegurarme de que tu declaración esté lista a tiempo.
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                En <strong>Ross Tax Preparation</strong> seguimos comprometidos en ayudarte a maximizar tus deducciones 
                y ahorrar en impuestos. ¡No importa si estás en Texas, otro estado, o incluso fuera del país!
            </p>
            
            <!-- Benefits Box -->
            <div style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #6C1110; margin-top: 0;">¿Por qué elegirnos?</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 8px 0; color: #555;">✅ Servicio <strong>100% virtual</strong> - desde cualquier lugar</li>
                    <li style="padding: 8px 0; color: #555;">✅ Preparación rápida y confiable (30 min para individuos)</li>
                    <li style="padding: 8px 0; color: #555;">✅ Asesoría estratégica para minimizar tu carga fiscal</li>
                    <li style="padding: 8px 0; color: #555;">✅ Comunicación fácil por WhatsApp, email y teléfono</li>
                    <li style="padding: 8px 0; color: #555;">✅ Atención personalizada en español</li>
                </ul>
            </div>
            
            <!-- Urgency Box -->
            <div style="background: linear-gradient(135deg, #ff5722 0%, #ff9800 100%); border-radius: 10px; padding: 15px; margin: 25px 0; text-align: center;">
                <p style="color: white; margin: 0; font-size: 16px; font-weight: bold;">
                    📅 Fecha límite: 15 de Abril, 2025
                </p>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">
                    ¡No esperes hasta el último momento!
                </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{booking_link}}" style="background: linear-gradient(135deg, #6C1110 0%, #D32F2F 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
                    📅 Agenda tu cita hoy
                </a>
            </div>
            
            <!-- App Download Box -->
            <div style="background-color: #e8f5e9; border-radius: 10px; padding: 20px; margin: 25px 0; text-align: center;">
                <p style="color: #2e7d32; margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">
                    📱 ¡Descarga nuestra app para iPhone!
                </p>
                <p style="color: #555; margin: 0 0 15px 0; font-size: 14px;">
                    Agenda citas, sube documentos y recibe notificaciones desde tu celular
                </p>
                <a href="https://apps.apple.com/us/app/ross-tax/id6755496120" style="background: #000; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                    🍎 Descargar en App Store
                </a>
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                También puedes responder este email o escribirnos por WhatsApp al <strong>(806) 934-2018</strong>.
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                ¡Gracias por tu confianza! Estamos aquí para ayudarte.
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                ¡Saludos!
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #eee;">
            <img src="{{owner_photo}}" alt="Yoandy Ross" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px; object-fit: cover;">
            <p style="margin: 0; color: #333; font-weight: bold;">Yoandy Ross</p>
            <p style="margin: 5px 0; color: #6C1110; font-weight: bold;">Ross Tax Preparation</p>
            <p style="margin: 10px 0 5px 0; color: #555;">
                📞 +1 (806) 934-2018<br>
                📱 WhatsApp: +1 (806) 934-2018<br>
                ✉️ info@rosstaxpreparation.com<br>
                🌐 www.rosstaxpreparation.com
            </p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "mexico_abroad": {
        "id": "relocation_mexico_abroad",
        "name": "Cliente en México o el extranjero",
        "subject": "🇲🇽🇺🇸 ¿Estás en México? Tus impuestos de USA siguen siendo importantes",
        "preview": "El IRS no olvida - Servicio 100% remoto disponible",
        "html": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #006847 0%, #CE1126 50%, #FFFFFF 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">🇲🇽 Ross Tax Preparation 🇺🇸</h1>
            <p style="color: white; margin: 10px 0 0 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">Servicio sin fronteras</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">¡Hola {{client_name}}! 🌴</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                ¿Cómo estás? Esperamos que estés disfrutando tu tiempo en México.
            </p>
            
            <!-- Alert Box -->
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h4 style="color: #856404; margin: 0 0 10px 0;">⚠️ Recordatorio Importante</h4>
                <p style="color: #856404; margin: 0; font-size: 14px;">
                    Aunque estés fuera de Estados Unidos, si eres ciudadano o residente permanente, 
                    <strong>DEBES declarar tus impuestos al IRS</strong>.
                </p>
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                No te preocupes, estamos aquí para ayudarte. Nuestro servicio es <strong>100% remoto</strong> 
                y podemos preparar tus impuestos sin importar en qué parte del mundo te encuentres.
            </p>
            
            <!-- Benefits Box -->
            <div style="background-color: #e8f5e9; border-radius: 10px; padding: 20px; margin: 25px 0;">
                <h3 style="color: #2e7d32; margin-top: 0;">🌎 Ventajas de nuestro servicio internacional:</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="padding: 8px 0; color: #555;">✅ Videollamadas en tu horario (ajustamos a tu zona horaria)</li>
                    <li style="padding: 8px 0; color: #555;">✅ Documentos por email seguro o WhatsApp</li>
                    <li style="padding: 8px 0; color: #555;">✅ Experiencia con Foreign Earned Income Exclusion</li>
                    <li style="padding: 8px 0; color: #555;">✅ FBAR y reportes de cuentas extranjeras</li>
                    <li style="padding: 8px 0; color: #555;">✅ Evita multas por no declarar a tiempo</li>
                </ul>
            </div>
            
            <!-- Warning about penalties -->
            <div style="background-color: #ffebee; border-radius: 10px; padding: 15px; margin: 20px 0;">
                <p style="color: #c62828; margin: 0; font-size: 14px;">
                    <strong>⚡ Dato importante:</strong> Las multas por no declarar pueden ser de hasta 
                    $10,000+ por no reportar cuentas extranjeras. ¡Mejor prevenir!
                </p>
            </div>
            
            <!-- CTA Buttons -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{booking_link}}" style="background: linear-gradient(135deg, #006847 0%, #2e7d32 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block; margin: 5px;">
                    📅 Agenda tu cita virtual
                </a>
                <br><br>
                <a href="https://wa.me/18069342018?text=Hola! Estoy en México y necesito ayuda con mis impuestos de USA" style="background: #25D366; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 14px; display: inline-block; margin: 5px;">
                    💬 WhatsApp directo
                </a>
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                ¿Tienes preguntas? Responde este email o escríbenos por WhatsApp. 
                Estamos disponibles para ti.
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                ¡Saludos desde Texas!
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #eee;">
            <img src="{{owner_photo}}" alt="Yoandy Ross" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px; object-fit: cover;">
            <p style="margin: 0; color: #333; font-weight: bold;">Yoandy Ross</p>
            <p style="margin: 5px 0; color: #6C1110; font-weight: bold;">Ross Tax Preparation</p>
            <p style="margin: 10px 0 5px 0; color: #555;">
                📞 +1 (806) 934-2018<br>
                📱 WhatsApp: +1 (806) 934-2018<br>
                ✉️ info@rosstaxpreparation.com<br>
                🌐 www.rosstaxpreparation.com
            </p>
            <p style="margin: 15px 0 0 0; color: #888; font-size: 12px;">
                Preparamos impuestos para ciudadanos y residentes de USA en cualquier parte del mundo 🌍
            </p>
        </div>
    </div>
</body>
</html>
"""
    },
    
    "reactivation_general": {
        "id": "relocation_reactivation",
        "name": "Reactivación general - Sin importar ubicación",
        "subject": "🎯 {{client_name}}, ¿listo para tu declaración de impuestos 2024?",
        "preview": "Servicio 100% virtual disponible - Preparamos impuestos en los 50 estados",
        "html": """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Es Hora de Tu Declaración</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Ross Tax Preparation</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
            <h2 style="color: #333; margin-top: 0;">¡Hola {{client_name}}!</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                La temporada de impuestos 2024 está aquí, y queremos asegurarnos de que 
                tu declaración esté lista a tiempo.
            </p>
            
            <!-- Countdown/Urgency -->
            <div style="background: linear-gradient(135deg, #ff5722 0%, #ff9800 100%); border-radius: 10px; padding: 20px; margin: 25px 0; text-align: center;">
                <h3 style="color: white; margin: 0;">📅 Fecha límite: 15 de Abril, 2025</h3>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">¡No esperes hasta el último momento!</p>
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                <strong>¿Te mudaste o estás fuera del país?</strong> No hay problema. 
                Nuestro servicio es 100% virtual y preparamos impuestos para clientes en:
            </p>
            
            <ul style="color: #555; font-size: 16px; line-height: 1.8;">
                <li>Los 50 estados de USA 🇺🇸</li>
                <li>México 🇲🇽</li>
                <li>Centroamérica y Sudamérica 🌎</li>
                <li>Cualquier parte del mundo 🌍</li>
            </ul>
            
            <!-- Special Offer -->
            <div style="background-color: #e3f2fd; border: 2px dashed #1976d2; border-radius: 10px; padding: 20px; margin: 25px 0; text-align: center;">
                <h3 style="color: #1976d2; margin-top: 0;">🎁 Oferta Especial</h3>
                <p style="color: #555; margin: 0; font-size: 18px;">
                    <strong>10% de descuento</strong> si agendas esta semana
                </p>
                <p style="color: #888; margin: 10px 0 0 0; font-size: 12px;">
                    Menciona el código: REGRESO2024
                </p>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{booking_link}}" style="background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; display: inline-block;">
                    📅 Agenda tu cita ahora
                </a>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #333; font-weight: bold;">Ross Tax Preparation</p>
            <p style="margin: 10px 0 5px 0; color: #555;">
                📞 +1 (806) 934-2018 | 📱 WhatsApp disponible<br>
                ✉️ info@rosstaxpreparation.com<br>
                🌐 www.rosstaxpreparation.com
            </p>
        </div>
    </div>
</body>
</html>
"""
    }
}

# ============== WHATSAPP TEMPLATES ==============

WHATSAPP_TEMPLATES = {
    "moved_state": {
        "id": "wa_moved_state",
        "name": "WhatsApp - Cliente que se mudó",
        "message": """🌟 *ROSS TAX - Tu Aliado Fiscal Sin Fronteras* 🌟

¡Hola {client_name}! 👋

¿Cómo te va en tu nueva ciudad? 🏠

Quería recordarte que aunque te mudaste, *Ross Tax Preparation sigue aquí para ti*.

✅ Preparamos impuestos en los *50 estados*
✅ Todo *100% virtual* - sin visitas necesarias
✅ Conocemos tu historial fiscal
✅ Servicio rápido y confiable

📅 *¿Listo para tu declaración 2024?*

Responde a este mensaje o agenda aquí:
🔗 {booking_link}

¡Gracias por tu confianza!
- Yoandy Ross
📞 (806) 934-2018"""
    },
    
    "mexico_abroad": {
        "id": "wa_mexico_abroad", 
        "name": "WhatsApp - Cliente en México/Extranjero",
        "message": """🇲🇽🇺🇸 *¿Estás en México?* 

¡Hola {client_name}!

Aunque estés disfrutando el sol mexicano, el IRS no olvida 📋

⚠️ Si eres ciudadano o residente permanente, *DEBES declarar*

*Nuestro servicio 100% remoto incluye:*
✅ Videollamadas en tu horario
✅ Documentos por WhatsApp/Email
✅ Foreign Earned Income Exclusion
✅ FBAR y cuentas extranjeras

💰 Evita multas de hasta $10,000+

📅 *Agenda tu cita virtual:*
🔗 {booking_link}

O responde "CITA" y te ayudo 👇

- Ross Tax Preparation
📞 +1 (806) 934-2018"""
    },
    
    "broadcast_general": {
        "id": "wa_broadcast_general",
        "name": "WhatsApp Broadcast - General",
        "message": """🌟 *ROSS TAX - Servicio Sin Fronteras* 🌟

¿Te mudaste o estás fuera del país?

¡No te preocupes! Preparamos tus impuestos desde *CUALQUIER lugar*:

✈️ 50 estados de USA
🌎 México, Centroamérica, Sudamérica  
🇪🇺 Europa y más

*Todo virtual:*
📹 Videollamada
📧 Email seguro
📲 WhatsApp

🎁 *PROMO:* 10% descuento esta semana
Código: REGRESO2024

¿Listo para tu declaración 2024?
Responde "CITA" para agendar 👇

📞 (806) 934-2018
🌐 rosstaxpreparation.com"""
    }
}


class RelocationCampaignService:
    """Servicio para gestionar campañas de reubicación"""
    
    def __init__(self, db, notification_service=None, whatsapp_service=None):
        self.db = db
        self.notification_service = notification_service
        self.whatsapp_service = whatsapp_service
        
    async def get_templates(self, template_type: str = "all") -> Dict[str, Any]:
        """Obtiene los templates disponibles"""
        if template_type == "email":
            return {"templates": list(RELOCATION_TEMPLATES.values())}
        elif template_type == "whatsapp":
            return {"templates": list(WHATSAPP_TEMPLATES.values())}
        else:
            return {
                "email_templates": list(RELOCATION_TEMPLATES.values()),
                "whatsapp_templates": list(WHATSAPP_TEMPLATES.values())
            }
    
    async def get_relocated_clients(self, filter_type: str = "all") -> List[Dict]:
        """
        Obtiene clientes que potencialmente se mudaron
        filter_type: 'all', 'different_state', 'international', 'inactive'
        """
        clients = []
        
        try:
            # Get all clients
            all_clients = await self.db.users.find({
                'role': 'client',
                'email': {'$exists': True}
            }).to_list(1000)
            
            # Get clients with address info
            for client in all_clients:
                client_data = {
                    'id': str(client.get('_id', '')),
                    'name': client.get('full_name') or client.get('name', 'Cliente'),
                    'email': client.get('email', ''),
                    'phone': client.get('phone', ''),
                    'state': client.get('state', ''),
                    'country': client.get('country', 'US'),
                    'last_login': client.get('last_login'),
                    'created_at': client.get('created_at')
                }
                
                # Filter based on type
                if filter_type == 'different_state':
                    # Clients not in Texas
                    if client_data['state'] and client_data['state'].upper() != 'TX':
                        clients.append(client_data)
                elif filter_type == 'international':
                    # Clients outside US
                    if client_data['country'] and client_data['country'].upper() != 'US':
                        clients.append(client_data)
                elif filter_type == 'inactive':
                    # Clients who haven't logged in for 90+ days
                    if client_data['last_login']:
                        from datetime import timedelta
                        ninety_days_ago = datetime.now(timezone.utc) - timedelta(days=90)
                        if client_data['last_login'] < ninety_days_ago:
                            clients.append(client_data)
                    else:
                        clients.append(client_data)
                else:
                    clients.append(client_data)
            
            return clients
            
        except Exception as e:
            logger.error(f"Error getting relocated clients: {e}")
            return []
    
    async def send_email_campaign(
        self,
        template_id: str,
        client_ids: List[str] = None,
        filter_type: str = None,
        test_email: str = None
    ) -> Dict[str, Any]:
        """Envía campaña de email"""
        
        template = RELOCATION_TEMPLATES.get(template_id)
        if not template:
            return {"success": False, "error": "Template no encontrado"}
        
        # If test email, send only to that
        if test_email:
            recipients = [{"email": test_email, "name": "Test User"}]
        else:
            # Get recipients
            if client_ids:
                recipients = []
                for cid in client_ids:
                    client = await self.db.users.find_one({'_id': ObjectId(cid)})
                    if client:
                        recipients.append({
                            "email": client.get('email'),
                            "name": client.get('full_name') or client.get('name', 'Cliente')
                        })
            elif filter_type:
                clients = await self.get_relocated_clients(filter_type)
                recipients = [{"email": c['email'], "name": c['name']} for c in clients if c['email']]
            else:
                return {"success": False, "error": "Debe especificar client_ids o filter_type"}
        
        # Send emails
        sent = 0
        failed = 0
        errors = []
        
        booking_link = "https://rosstaxpreparation.com/agendar"
        owner_photo = "https://customer-assets.emergentagent.com/job_ross-tax-portal-1/artifacts/8t2xbxso_IMG_6476.jpeg"
        
        for recipient in recipients:
            try:
                # Personalize template
                html = template['html'].replace('{{client_name}}', recipient['name'])
                html = html.replace('{{booking_link}}', booking_link)
                html = html.replace('{{owner_photo}}', owner_photo)
                
                subject = template['subject'].replace('{{client_name}}', recipient['name'])
                
                if self.notification_service:
                    await self.notification_service.send_email(
                        to_email=recipient['email'],
                        subject=subject,
                        html_content=html
                    )
                    sent += 1
                    logger.info(f"📧 Email sent to {recipient['email']}")
                else:
                    errors.append(f"Notification service not available for {recipient['email']}")
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Error sending email to {recipient['email']}: {e}")
                errors.append(str(e))
                failed += 1
        
        return {
            "success": True,
            "template": template_id,
            "total_recipients": len(recipients),
            "sent": sent,
            "failed": failed,
            "errors": errors[:5] if errors else []
        }
    
    async def send_whatsapp_campaign(
        self,
        template_id: str,
        client_ids: List[str] = None,
        filter_type: str = None,
        test_phone: str = None
    ) -> Dict[str, Any]:
        """Envía campaña de WhatsApp"""
        
        template = WHATSAPP_TEMPLATES.get(template_id)
        if not template:
            return {"success": False, "error": "Template no encontrado"}
        
        # If test phone, send only to that
        if test_phone:
            recipients = [{"phone": test_phone, "name": "Test User"}]
        else:
            # Get recipients
            if client_ids:
                recipients = []
                for cid in client_ids:
                    client = await self.db.users.find_one({'_id': ObjectId(cid)})
                    if client and client.get('phone'):
                        recipients.append({
                            "phone": client.get('phone'),
                            "name": client.get('full_name') or client.get('name', 'Cliente')
                        })
            elif filter_type:
                clients = await self.get_relocated_clients(filter_type)
                recipients = [{"phone": c['phone'], "name": c['name']} for c in clients if c['phone']]
            else:
                return {"success": False, "error": "Debe especificar client_ids o filter_type"}
        
        # Send WhatsApp messages
        sent = 0
        failed = 0
        errors = []
        
        booking_link = "https://rosstaxpreparation.com/agendar"
        
        for recipient in recipients:
            try:
                # Personalize message
                message = template['message'].replace('{client_name}', recipient['name'])
                message = message.replace('{booking_link}', booking_link)
                
                if self.whatsapp_service:
                    await self.whatsapp_service.send_message(
                        to_phone=recipient['phone'],
                        message=message
                    )
                    sent += 1
                    logger.info(f"📱 WhatsApp sent to {recipient['phone']}")
                elif self.notification_service:
                    # Fallback to notification service SMS
                    await self.notification_service.send_sms(
                        to_phone=recipient['phone'],
                        message=message[:160]  # SMS limit
                    )
                    sent += 1
                    logger.info(f"📱 SMS sent to {recipient['phone']}")
                else:
                    errors.append(f"WhatsApp/SMS service not available for {recipient['phone']}")
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Error sending WhatsApp to {recipient['phone']}: {e}")
                errors.append(str(e))
                failed += 1
        
        return {
            "success": True,
            "template": template_id,
            "total_recipients": len(recipients),
            "sent": sent,
            "failed": failed,
            "errors": errors[:5] if errors else []
        }
    
    async def preview_template(self, template_type: str, template_id: str, client_name: str = "Juan Pérez") -> Dict[str, Any]:
        """Vista previa de un template"""
        
        booking_link = "https://rosstaxpreparation.com/agendar"
        owner_photo = "https://customer-assets.emergentagent.com/job_ross-tax-portal-1/artifacts/8t2xbxso_IMG_6476.jpeg"
        
        if template_type == "email":
            template = RELOCATION_TEMPLATES.get(template_id)
            if not template:
                return {"success": False, "error": "Template no encontrado"}
            
            html = template['html'].replace('{{client_name}}', client_name)
            html = html.replace('{{booking_link}}', booking_link)
            html = html.replace('{{owner_photo}}', owner_photo)
            
            return {
                "success": True,
                "type": "email",
                "subject": template['subject'].replace('{{client_name}}', client_name),
                "preview": template['preview'],
                "html": html
            }
            
        elif template_type == "whatsapp":
            template = WHATSAPP_TEMPLATES.get(template_id)
            if not template:
                return {"success": False, "error": "Template no encontrado"}
            
            message = template['message'].replace('{client_name}', client_name)
            message = message.replace('{booking_link}', booking_link)
            
            return {
                "success": True,
                "type": "whatsapp",
                "message": message
            }
        
        return {"success": False, "error": "Tipo de template inválido"}


# Global instance
relocation_campaign_service = None

def init_relocation_campaign_service(db, notification_service=None, whatsapp_service=None):
    """Initialize the relocation campaign service"""
    global relocation_campaign_service
    relocation_campaign_service = RelocationCampaignService(db, notification_service, whatsapp_service)
    logger.info("✅ Relocation Campaign Service initialized")
    return relocation_campaign_service
