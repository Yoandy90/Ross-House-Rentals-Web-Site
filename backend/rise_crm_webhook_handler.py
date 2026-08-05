import logging
from typing import Dict, Optional
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class RiseCRMWebhookHandler:
    """Handle webhooks from Rise CRM for bidirectional sync"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        logger.info("🔗 Rise CRM Webhook Handler initialized")
    
    async def handle_webhook(self, event_type: str, payload: Dict) -> Dict:
        """Route webhook to appropriate handler"""
        try:
            logger.info(f"📨 Received webhook: {event_type}")
            
            handlers = {
                'client.updated': self.handle_client_updated,
                'project.updated': self.handle_project_updated,
                'project.completed': self.handle_project_completed,
                'task.completed': self.handle_task_completed,
                'invoice.paid': self.handle_invoice_paid,
                'ticket.created': self.handle_ticket_created,
                'ticket.updated': self.handle_ticket_updated,
            }
            
            handler = handlers.get(event_type)
            if handler:
                result = await handler(payload)
                return {'success': True, 'result': result}
            else:
                logger.warning(f"⚠️ Unknown event type: {event_type}")
                return {'success': False, 'error': f'Unknown event: {event_type}'}
                
        except Exception as e:
            logger.error(f"❌ Webhook handling error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= CLIENT WEBHOOKS =============
    
    async def handle_client_updated(self, payload: Dict) -> Dict:
        """Handle client update from Rise CRM"""
        try:
            rise_client_id = payload.get('client_id')
            logger.info(f"👤 Handling client update: {rise_client_id}")
            
            # Find user by rise_crm_id
            user = await self.db.users.find_one({'rise_crm_id': str(rise_client_id)})
            if not user:
                return {'action': 'skipped', 'reason': 'User not found in Ross Tax'}
            
            # Update user data from Rise CRM
            updates = {}
            if payload.get('email'):
                updates['email'] = payload['email']
            if payload.get('phone'):
                updates['phone'] = payload['phone']
            if payload.get('address'):
                updates['address'] = payload['address']
            if payload.get('city'):
                updates['city'] = payload['city']
            if payload.get('state'):
                updates['state'] = payload['state']
            if payload.get('zip'):
                updates['zip_code'] = payload['zip']
            
            if updates:
                updates['updated_at'] = datetime.utcnow()
                await self.db.users.update_one(
                    {'_id': user['_id']},
                    {'$set': updates}
                )
                logger.info(f"✅ User updated from Rise CRM: {user['_id']}")
                return {'action': 'updated', 'user_id': user['_id'], 'fields': list(updates.keys())}
            
            return {'action': 'skipped', 'reason': 'No updates needed'}
            
        except Exception as e:
            logger.error(f"❌ Client update error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}
    
    # ============= PROJECT WEBHOOKS =============
    
    async def handle_project_updated(self, payload: Dict) -> Dict:
        """Handle project status update from Rise CRM"""
        try:
            project_id = payload.get('project_id')
            new_status = payload.get('status')
            logger.info(f"📁 Handling project update: {project_id} -> {new_status}")
            
            # Find corresponding entity (could be loan, appointment, or tax return)
            sync_log = await self.db.rise_sync_logs.find_one({
                'rise_crm_id': str(project_id),
                'entity_type': {'$in': ['loan_application', 'appointment', 'tax_return']}
            })
            
            if not sync_log:
                return {'action': 'skipped', 'reason': 'Project not linked to Ross Tax entity'}
            
            entity_type = sync_log['entity_type']
            entity_id = sync_log['ross_tax_id']
            
            # Update status based on entity type
            if entity_type == 'loan_application':
                status_map = {
                    'open': 'in_review',
                    'in_progress': 'processing',
                    'completed': 'approved',
                    'cancelled': 'denied'
                }
                new_status_mapped = status_map.get(new_status, 'pending')
                
                await self.db.loan_applications.update_one(
                    {'id': entity_id},
                    {'$set': {'status': new_status_mapped, 'updated_at': datetime.utcnow()}}
                )
                logger.info(f"✅ Loan application status updated: {entity_id} -> {new_status_mapped}")
                return {'action': 'updated', 'entity_type': entity_type, 'entity_id': entity_id}
            
            elif entity_type == 'appointment':
                await self.db.appointments.update_one(
                    {'id': entity_id},
                    {'$set': {'status': new_status, 'updated_at': datetime.utcnow()}}
                )
                logger.info(f"✅ Appointment status updated: {entity_id} -> {new_status}")
                return {'action': 'updated', 'entity_type': entity_type, 'entity_id': entity_id}
            
            return {'action': 'skipped', 'reason': f'Entity type {entity_type} not handled'}
            
        except Exception as e:
            logger.error(f"❌ Project update error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}
    
    async def handle_project_completed(self, payload: Dict) -> Dict:
        """Handle project completion from Rise CRM"""
        try:
            project_id = payload.get('project_id')
            logger.info(f"✅ Handling project completion: {project_id}")
            
            # Similar to handle_project_updated but specifically for completion
            result = await self.handle_project_updated({
                'project_id': project_id,
                'status': 'completed'
            })
            
            # Create notification for user
            sync_log = await self.db.rise_sync_logs.find_one({
                'rise_crm_id': str(project_id),
                'entity_type': {'$in': ['loan_application', 'appointment', 'tax_return']}
            })
            
            if sync_log and sync_log.get('entity_type') == 'loan_application':
                loan = await self.db.loan_applications.find_one({'id': sync_log['ross_tax_id']})
                if loan:
                    await self.db.notifications.insert_one({
                        'user_id': loan['user_id'],
                        'title': 'Loan Application Completed',
                        'body': f'Your loan application has been processed and completed.',
                        'type': 'loan',
                        'data': {'loan_id': loan['id']},
                        'read': False,
                        'created_at': datetime.utcnow()
                    })
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Project completion error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}
    
    # ============= TASK WEBHOOKS =============
    
    async def handle_task_completed(self, payload: Dict) -> Dict:
        """Handle task completion from Rise CRM"""
        try:
            task_id = payload.get('task_id')
            logger.info(f"✓ Handling task completion: {task_id}")
            
            # Find corresponding document or document request
            sync_log = await self.db.rise_sync_logs.find_one({
                'rise_crm_id': str(task_id),
                'entity_type': {'$in': ['document', 'document_request']}
            })
            
            if not sync_log:
                return {'action': 'skipped', 'reason': 'Task not linked to Ross Tax entity'}
            
            entity_type = sync_log['entity_type']
            entity_id = sync_log['ross_tax_id']
            
            if entity_type == 'document_request':
                # Mark document request as completed
                await self.db.document_requests.update_one(
                    {'_id': entity_id},
                    {'$set': {'status': 'completed', 'completed_at': datetime.utcnow()}}
                )
                logger.info(f"✅ Document request marked as completed: {entity_id}")
                return {'action': 'updated', 'entity_type': entity_type, 'entity_id': str(entity_id)}
            
            return {'action': 'skipped', 'reason': f'Entity type {entity_type} not handled'}
            
        except Exception as e:
            logger.error(f"❌ Task completion error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}
    
    # ============= INVOICE WEBHOOKS =============
    
    async def handle_invoice_paid(self, payload: Dict) -> Dict:
        """Handle invoice paid notification from Rise CRM"""
        try:
            invoice_id = payload.get('invoice_id')
            amount = payload.get('amount', 0)
            logger.info(f"💰 Handling invoice paid: {invoice_id} - ${amount}")
            
            # Find corresponding payment
            sync_log = await self.db.rise_sync_logs.find_one({
                'rise_crm_id': str(invoice_id),
                'entity_type': 'payment'
            })
            
            if not sync_log:
                return {'action': 'skipped', 'reason': 'Invoice not linked to Ross Tax payment'}
            
            # Payment already recorded in Ross Tax, just log confirmation
            logger.info(f"✅ Payment confirmation received from Rise CRM: {sync_log['ross_tax_id']}")
            return {'action': 'confirmed', 'payment_id': sync_log['ross_tax_id']}
            
        except Exception as e:
            logger.error(f"❌ Invoice paid error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}
    
    # ============= TICKET WEBHOOKS =============
    
    async def handle_ticket_created(self, payload: Dict) -> Dict:
        """Handle new ticket created in Rise CRM"""
        try:
            ticket_id = payload.get('ticket_id')
            logger.info(f"🎫 Handling new ticket: {ticket_id}")
            
            # Tickets created in Rise CRM should create notifications in Ross Tax
            client_id = payload.get('client_id')
            title = payload.get('title', 'New Support Ticket')
            description = payload.get('description', '')
            
            # Find user by rise_crm_id
            user = await self.db.users.find_one({'rise_crm_id': str(client_id)})
            if not user:
                return {'action': 'skipped', 'reason': 'Client not found in Ross Tax'}
            
            # Create notification for user
            await self.db.notifications.insert_one({
                'user_id': user['_id'],
                'title': title,
                'body': description[:200],
                'type': 'support',
                'data': {'rise_ticket_id': ticket_id},
                'read': False,
                'created_at': datetime.utcnow()
            })
            
            logger.info(f"✅ Notification created for new ticket: {user['_id']}")
            return {'action': 'created', 'notification_for': user['_id']}
            
        except Exception as e:
            logger.error(f"❌ Ticket creation error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}
    
    async def handle_ticket_updated(self, payload: Dict) -> Dict:
        """Handle ticket update from Rise CRM"""
        try:
            ticket_id = payload.get('ticket_id')
            new_status = payload.get('status')
            logger.info(f"🎫 Handling ticket update: {ticket_id} -> {new_status}")
            
            # If ticket is resolved/closed, notify user
            if new_status in ['resolved', 'closed']:
                client_id = payload.get('client_id')
                user = await self.db.users.find_one({'rise_crm_id': str(client_id)})
                
                if user:
                    await self.db.notifications.insert_one({
                        'user_id': user['_id'],
                        'title': 'Support Ticket Resolved',
                        'body': f'Your support ticket has been {new_status}.',
                        'type': 'support',
                        'data': {'rise_ticket_id': ticket_id, 'status': new_status},
                        'read': False,
                        'created_at': datetime.utcnow()
                    })
                    logger.info(f"✅ Notification sent for ticket resolution: {user['_id']}")
                    return {'action': 'notified', 'user_id': user['_id']}
            
            return {'action': 'skipped', 'reason': f'Status {new_status} does not require notification'}
            
        except Exception as e:
            logger.error(f"❌ Ticket update error: {str(e)}")
            return {'action': 'failed', 'error': str(e)}

# Global instance
webhook_handler = None

def init_webhook_handler(db: AsyncIOMotorDatabase):
    """Initialize webhook handler with database"""
    global webhook_handler
    webhook_handler = RiseCRMWebhookHandler(db)
    logger.info("✅ Rise CRM Webhook Handler initialized with database")
    return webhook_handler
