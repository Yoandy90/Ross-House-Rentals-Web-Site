"""
Email Campaign Service
Sistema completo de gestión de campañas de email
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import logging
from bson import ObjectId
import requests

logger = logging.getLogger(__name__)

class EmailCampaignService:
    """Servicio para gestionar campañas de email marketing"""
    
    def __init__(self, db, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        self.campaigns = db.email_campaigns
        self.templates = db.email_templates
        self.campaign_logs = db.campaign_logs
        self.campaign_stats = db.campaign_stats
    
    async def create_campaign(
        self,
        name: str,
        subject: str,
        from_name: str,
        from_email: str,
        template_id: Optional[str] = None,
        html_content: Optional[str] = None,
        audience_filter: Dict[str, Any] = None,
        scheduled_at: Optional[datetime] = None,
        created_by: str = None
    ) -> Dict[str, Any]:
        """Crea una nueva campaña de email"""
        
        campaign = {
            'name': name,
            'subject': subject,
            'from_name': from_name,
            'from_email': from_email,
            'template_id': template_id,
            'html_content': html_content,
            'audience_filter': audience_filter or {},
            'scheduled_at': scheduled_at,
            'status': 'draft',  # draft, scheduled, sending, completed, cancelled
            'created_by': created_by,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'stats': {
                'total_recipients': 0,
                'sent': 0,
                'delivered': 0,
                'opened': 0,
                'clicked': 0,
                'bounced': 0,
                'failed': 0
            }
        }
        
        result = await self.campaigns.insert_one(campaign)
        campaign['_id'] = str(result.inserted_id)
        
        logger.info(f"📧 Campaign created: {name} (ID: {campaign['_id']})")
        return campaign
    
    async def update_campaign(
        self,
        campaign_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Actualiza una campaña existente"""
        
        updates['updated_at'] = datetime.utcnow()
        
        result = await self.campaigns.update_one(
            {'_id': ObjectId(campaign_id)},
            {'$set': updates}
        )
        
        return result.modified_count > 0
    
    async def get_campaign(self, campaign_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una campaña por ID"""
        campaign = await self.campaigns.find_one({'_id': ObjectId(campaign_id)})
        if campaign:
            campaign['_id'] = str(campaign['_id'])
        return campaign
    
    async def list_campaigns(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Lista campañas con filtros opcionales"""
        
        query = {}
        if status:
            query['status'] = status
        
        campaigns = await self.campaigns.find(query)\
            .sort('created_at', -1)\
            .skip(skip)\
            .limit(limit)\
            .to_list(length=limit)
        
        for campaign in campaigns:
            campaign['_id'] = str(campaign['_id'])
        
        return campaigns
    
    async def get_audience(self, audience_filter: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Obtiene la audiencia basada en filtros"""
        
        query = {}
        
        # Filtro por rol
        if audience_filter.get('role'):
            query['role'] = audience_filter['role']
        
        # Filtro por estado activo
        if audience_filter.get('active_only'):
            query['active'] = True
        
        # Filtro por fecha de registro
        if audience_filter.get('registered_after'):
            query['created_at'] = {'$gte': audience_filter['registered_after']}
        
        # Filtro por tiene email
        query['email'] = {'$exists': True, '$ne': '', '$ne': None}
        
        # Excluir usuarios de prueba
        query['email'] = {'$not': {'$regex': 'test|demo|prueba'}}
        
        # Obtener usuarios
        users = await self.db.users.find(query).to_list(length=None)
        
        return users
    
    async def schedule_campaign(
        self,
        campaign_id: str,
        scheduled_at: datetime
    ) -> bool:
        """Programa una campaña para envío futuro"""
        
        # Calcular audiencia
        campaign = await self.get_campaign(campaign_id)
        if not campaign:
            return False
        
        audience = await self.get_audience(campaign['audience_filter'])
        
        # Actualizar campaña
        result = await self.campaigns.update_one(
            {'_id': ObjectId(campaign_id)},
            {
                '$set': {
                    'status': 'scheduled',
                    'scheduled_at': scheduled_at,
                    'stats.total_recipients': len(audience),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        logger.info(f"📅 Campaign scheduled: {campaign_id} for {scheduled_at}")
        return result.modified_count > 0
    
    async def send_campaign(self, campaign_id: str) -> Dict[str, Any]:
        """Envía una campaña inmediatamente o según programación"""
        
        campaign = await self.get_campaign(campaign_id)
        if not campaign:
            return {'success': False, 'error': 'Campaign not found'}
        
        if campaign['status'] not in ['draft', 'scheduled']:
            return {'success': False, 'error': f'Campaign is {campaign["status"]}'}
        
        # Marcar como "enviando"
        await self.campaigns.update_one(
            {'_id': ObjectId(campaign_id)},
            {'$set': {'status': 'sending', 'started_at': datetime.utcnow()}}
        )
        
        # Obtener audiencia
        audience = await self.get_audience(campaign['audience_filter'])
        
        if not audience:
            await self.campaigns.update_one(
                {'_id': ObjectId(campaign_id)},
                {'$set': {'status': 'failed', 'error': 'No recipients found'}}
            )
            return {'success': False, 'error': 'No recipients found'}
        
        # Enviar emails
        sent_count = 0
        failed_count = 0
        
        for user in audience:
            success = await self._send_email_to_user(campaign, user)
            if success:
                sent_count += 1
            else:
                failed_count += 1
            
            # Log individual
            await self.campaign_logs.insert_one({
                'campaign_id': campaign_id,
                'user_id': str(user['_id']),
                'email': user['email'],
                'status': 'sent' if success else 'failed',
                'sent_at': datetime.utcnow()
            })
        
        # Actualizar estadísticas
        await self.campaigns.update_one(
            {'_id': ObjectId(campaign_id)},
            {
                '$set': {
                    'status': 'completed',
                    'completed_at': datetime.utcnow(),
                    'stats.sent': sent_count,
                    'stats.failed': failed_count,
                    'stats.total_recipients': len(audience)
                }
            }
        )
        
        logger.info(f"✅ Campaign sent: {campaign_id} - {sent_count} sent, {failed_count} failed")
        
        return {
            'success': True,
            'sent': sent_count,
            'failed': failed_count,
            'total': len(audience)
        }
    
    async def _send_email_to_user(
        self,
        campaign: Dict[str, Any],
        user: Dict[str, Any]
    ) -> bool:
        """Envía un email a un usuario específico"""
        
        if not self.notification_service or not self.notification_service.sendgrid_api_key:
            logger.error("SendGrid not configured")
            return False
        
        try:
            # Personalizar contenido
            html_content = campaign['html_content']
            subject = campaign['subject']
            
            # Variables de personalización
            personalization_vars = {
                '{nombre}': user.get('name', 'Cliente'),
                '{email}': user.get('email', ''),
                '{firstName}': user.get('name', 'Cliente').split()[0] if user.get('name') else 'Cliente',
            }
            
            for var, value in personalization_vars.items():
                html_content = html_content.replace(var, value)
                subject = subject.replace(var, value)
            
            # Enviar con SendGrid
            headers = {
                "Authorization": f"Bearer {self.notification_service.sendgrid_api_key}",
                "Content-Type": "application/json"
            }
            
            email_data = {
                "personalizations": [{
                    "to": [{"email": user['email']}],
                    "subject": subject
                }],
                "from": {
                    "email": campaign.get('from_email', self.notification_service.sendgrid_from_email),
                    "name": campaign.get('from_name', 'Ross Tax Preparation')
                },
                "content": [{
                    "type": "text/html",
                    "value": html_content
                }],
                "categories": [f"campaign-{campaign['_id']}"],
                "custom_args": {
                    "campaign_id": str(campaign['_id']),
                    "user_id": str(user['_id'])
                }
            }
            
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers=headers,
                json=email_data,
                timeout=10
            )
            
            return response.status_code in [200, 202]
            
        except Exception as e:
            logger.error(f"Error sending campaign email: {e}")
            return False
    
    async def cancel_campaign(self, campaign_id: str) -> bool:
        """Cancela una campaña programada"""
        
        result = await self.campaigns.update_one(
            {'_id': ObjectId(campaign_id), 'status': 'scheduled'},
            {'$set': {'status': 'cancelled', 'cancelled_at': datetime.utcnow()}}
        )
        
        return result.modified_count > 0
    
    async def get_campaign_stats(self, campaign_id: str) -> Dict[str, Any]:
        """Obtiene estadísticas detalladas de una campaña"""
        
        campaign = await self.get_campaign(campaign_id)
        if not campaign:
            return None
        
        # Obtener eventos de SendGrid relacionados
        events = await self.db.email_events.find({
            'category': f"campaign-{campaign_id}"
        }).to_list(length=None)
        
        # Contar por tipo
        stats = {
            'delivered': 0,
            'opened': 0,
            'clicked': 0,
            'bounced': 0,
            'unique_opens': set(),
            'unique_clicks': set()
        }
        
        for event in events:
            event_type = event.get('event_type')
            email = event.get('email')
            
            if event_type == 'delivered':
                stats['delivered'] += 1
            elif event_type == 'open':
                stats['opened'] += 1
                stats['unique_opens'].add(email)
            elif event_type == 'click':
                stats['clicked'] += 1
                stats['unique_clicks'].add(email)
            elif event_type == 'bounce':
                stats['bounced'] += 1
        
        # Calcular rates
        total_sent = campaign['stats']['sent']
        
        return {
            'campaign_id': campaign_id,
            'name': campaign['name'],
            'status': campaign['status'],
            'total_recipients': campaign['stats']['total_recipients'],
            'sent': total_sent,
            'delivered': stats['delivered'],
            'opened': stats['opened'],
            'unique_opens': len(stats['unique_opens']),
            'clicked': stats['clicked'],
            'unique_clicks': len(stats['unique_clicks']),
            'bounced': stats['bounced'],
            'failed': campaign['stats']['failed'],
            'open_rate': f"{(len(stats['unique_opens']) / total_sent * 100):.1f}%" if total_sent > 0 else "0%",
            'click_rate': f"{(len(stats['unique_clicks']) / total_sent * 100):.1f}%" if total_sent > 0 else "0%",
            'bounce_rate': f"{(stats['bounced'] / total_sent * 100):.1f}%" if total_sent > 0 else "0%",
        }
    
    async def duplicate_campaign(self, campaign_id: str) -> Optional[str]:
        """Duplica una campaña existente"""
        
        campaign = await self.get_campaign(campaign_id)
        if not campaign:
            return None
        
        # Remover campos que no se deben duplicar
        campaign.pop('_id', None)
        campaign.pop('created_at', None)
        campaign.pop('updated_at', None)
        campaign.pop('started_at', None)
        campaign.pop('completed_at', None)
        campaign.pop('cancelled_at', None)
        
        # Modificar nombre
        campaign['name'] = f"{campaign['name']} (Copia)"
        campaign['status'] = 'draft'
        campaign['stats'] = {
            'total_recipients': 0,
            'sent': 0,
            'delivered': 0,
            'opened': 0,
            'clicked': 0,
            'bounced': 0,
            'failed': 0
        }
        
        result = await self.campaigns.insert_one(campaign)
        
        return str(result.inserted_id)
    
    # PLANTILLAS DE EMAIL
    
    async def create_template(
        self,
        name: str,
        description: str,
        html_content: str,
        category: str = 'general',
        variables: List[str] = None
    ) -> str:
        """Crea una plantilla de email"""
        
        template = {
            'name': name,
            'description': description,
            'html_content': html_content,
            'category': category,
            'variables': variables or ['{nombre}', '{email}'],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = await self.templates.insert_one(template)
        logger.info(f"📝 Template created: {name}")
        
        return str(result.inserted_id)
    
    async def list_templates(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lista plantillas disponibles"""
        
        query = {}
        if category:
            query['category'] = category
        
        templates = await self.templates.find(query).to_list(length=None)
        
        for template in templates:
            template['_id'] = str(template['_id'])
        
        return templates
    
    async def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una plantilla por ID"""
        
        template = await self.templates.find_one({'_id': ObjectId(template_id)})
        if template:
            template['_id'] = str(template['_id'])
        
        return template


# Instancia global
email_campaign_service = None

def init_email_campaign_service(db, notification_service=None):
    """Inicializa el servicio de campañas"""
    global email_campaign_service
    email_campaign_service = EmailCampaignService(db, notification_service)
    logger.info("✅ Email Campaign Service initialized")
    return email_campaign_service
