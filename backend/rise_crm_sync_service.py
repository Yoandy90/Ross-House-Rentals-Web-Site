import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from rise_crm_service import rise_crm_service
from rise_crm_models import (
    RiseCRMClient, RiseCRMProject, RiseCRMTicket,
    RiseCRMInvoice, RiseCRMSyncLog
)

logger = logging.getLogger(__name__)

class RiseCRMSyncService:
    """Service for bidirectional sync between Ross Tax and Rise CRM"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.rise_service = rise_crm_service
        logger.info("🔄 Rise CRM Sync Service initialized")
    
    # ============= MAPPING FUNCTIONS =============
    
    def map_user_to_rise_client(self, user: Dict) -> RiseCRMClient:
        """Map Ross Tax user to Rise CRM client"""
        name_parts = user.get('name', '').split(' ', 1)
        firstname = name_parts[0] if len(name_parts) > 0 else user.get('email', '').split('@')[0]
        lastname = name_parts[1] if len(name_parts) > 1 else ''
        
        # Handle address field - convert dict to string if needed
        address_str = ''
        city = ''
        state = ''
        zip_code = ''
        
        address_field = user.get('address')
        if isinstance(address_field, dict):
            # Extract from dictionary
            address_parts = []
            if address_field.get('address_line1'):
                address_parts.append(address_field.get('address_line1'))
            if address_field.get('address_line2'):
                address_parts.append(address_field.get('address_line2'))
            address_str = ', '.join(address_parts) if address_parts else ''
            
            city = address_field.get('city', '')
            state = address_field.get('state_code', '') or address_field.get('state', '')
            zip_code = address_field.get('zip_code', '') or address_field.get('zip', '')
        elif isinstance(address_field, str):
            address_str = address_field
            city = user.get('city', '')
            state = user.get('state', '')
            zip_code = user.get('zip_code', '') or user.get('zip', '')
        else:
            # Fallback to top-level fields
            address_str = user.get('address', '') if isinstance(user.get('address'), str) else ''
            city = user.get('city', '')
            state = user.get('state', '')
            zip_code = user.get('zip_code', '') or user.get('zip', '')
        
        return RiseCRMClient(
            contact_firstname=firstname or 'Client',
            contact_lastname=lastname or '',
            email=user.get('email', ''),
            phone=user.get('phone', '') or '',
            address=address_str or '',
            city=city or '',
            state=state or '',
            zip=zip_code or '',
            country='US',
            tax_id=user.get('ssn', '') or user.get('itin', '') or '',
            company_name=user.get('name', '') or f"{firstname} {lastname}".strip() or 'Ross Tax Client'
        )
    
    def map_rise_client_to_user(self, rise_client: Dict) -> Dict:
        """Map Rise CRM client to Ross Tax user format"""
        return {
            'name': f"{rise_client.get('contact_first_name', '')} {rise_client.get('contact_last_name', '')}".strip(),
            'email': rise_client.get('email', ''),
            'phone': rise_client.get('phone'),
            'address': rise_client.get('address'),
            'city': rise_client.get('city'),
            'state': rise_client.get('state'),
            'zip_code': rise_client.get('zip'),
            'ssn': rise_client.get('vat_number'),
            'rise_crm_id': rise_client.get('id')
        }
    
    # ============= CLIENT SYNC =============
    
    async def sync_user_to_rise(self, user_id: str, force: bool = False) -> Dict:
        """Sync a Ross Tax user to Rise CRM"""
        try:
            logger.info(f"🔄 Syncing user {user_id} to Rise CRM...")
            
            # Get user from Ross Tax
            user = await self.db.users.find_one({'_id': user_id})
            if not user:
                logger.error(f"❌ User not found: {user_id}")
                return {'success': False, 'error': 'User not found'}
            
            # Check if already synced
            existing_sync = await self.db.rise_sync_logs.find_one({
                'ross_tax_id': user_id,
                'entity_type': 'client',
                'status': 'success'
            })
            
            # Only skip if already synced AND has a valid rise_crm_id
            if existing_sync and existing_sync.get('rise_crm_id') and not force:
                logger.info(f"✅ User already synced. Rise CRM ID: {existing_sync.get('rise_crm_id')}")
                return {
                    'success': True,
                    'action': 'skipped',
                    'rise_crm_id': existing_sync.get('rise_crm_id'),
                    'message': 'Already synced'
                }
            
            # If no valid rise_crm_id, we need to re-sync
            if existing_sync and not existing_sync.get('rise_crm_id'):
                logger.warning(f"⚠️ User has sync record but no valid Rise CRM ID. Re-syncing...")
            
            # Map user to Rise client
            rise_client = self.map_user_to_rise_client(user)
            
            # Create or update in Rise CRM
            if existing_sync and existing_sync.get('rise_crm_id'):
                # Update existing client
                result = await self.rise_service.update_client(
                    existing_sync['rise_crm_id'],
                    rise_client
                )
                action = 'update'
            else:
                # Create new client
                result = await self.rise_service.create_client(rise_client)
                action = 'create'
            
            if result and result.get('success'):
                # Extract Rise CRM ID - try multiple possible locations
                logger.info(f"📊 Rise CRM API response: {result}")
                rise_crm_id = None
                
                # Try different response formats
                if 'data' in result and isinstance(result['data'], dict):
                    rise_crm_id = result['data'].get('id')
                if not rise_crm_id and 'id' in result:
                    rise_crm_id = result['id']
                if not rise_crm_id and existing_sync:
                    rise_crm_id = existing_sync.get('rise_crm_id')
                
                # Convert to int if it's a string
                if rise_crm_id:
                    try:
                        rise_crm_id = int(rise_crm_id) if isinstance(rise_crm_id, str) else rise_crm_id
                    except:
                        pass
                
                logger.info(f"🔑 Extracted Rise CRM ID: {rise_crm_id} (type: {type(rise_crm_id)})")
                
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'client',
                    'entity_id': user_id,
                    'ross_tax_id': user_id,
                    'rise_crm_id': rise_crm_id,
                    'action': action,
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow(),
                    'data': {'user': user.get('email'), 'rise_result': result}
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                # Update user with Rise CRM ID (try both _id and id fields)
                update_result = await self.db.users.update_one(
                    {'_id': user_id},
                    {'$set': {'rise_crm_id': rise_crm_id}}
                )
                if update_result.matched_count == 0:
                    # Try with id field
                    await self.db.users.update_one(
                        {'id': user_id},
                        {'$set': {'rise_crm_id': rise_crm_id}}
                    )
                
                logger.info(f"✅ User synced successfully. Rise CRM ID: {rise_crm_id}")
                return {
                    'success': True,
                    'action': action,
                    'rise_crm_id': rise_crm_id,
                    'message': f'Client {action}d successfully'
                }
            else:
                # Log failed sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'client',
                    'entity_id': user_id,
                    'ross_tax_id': user_id,
                    'action': action,
                    'direction': 'ross_to_rise',
                    'status': 'failed',
                    'error_message': str(result),
                    'sync_timestamp': datetime.utcnow()
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.error(f"❌ Failed to sync user: {result}")
                return {'success': False, 'error': 'Failed to sync to Rise CRM'}
                
        except Exception as e:
            logger.error(f"❌ Sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    async def sync_all_users(self, limit: int = 100) -> Dict:
        """Sync all Ross Tax users to Rise CRM"""
        logger.info(f"🔄 Starting bulk user sync (limit: {limit})...")
        
        users = await self.db.users.find({'role': 'client'}).limit(limit).to_list(length=limit)
        
        results = {
            'total': len(users),
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'details': []
        }
        
        for user in users:
            user_id = str(user.get('_id'))  # MongoDB uses _id, not id
            result = await self.sync_user_to_rise(user_id)
            
            if result['success']:
                if result.get('action') == 'skipped':
                    results['skipped'] += 1
                else:
                    results['success'] += 1
            else:
                results['failed'] += 1
            
            results['details'].append({
                'user_id': user_id,
                'email': user.get('email'),
                'result': result
            })
        
        logger.info(f"✅ Bulk sync complete: {results['success']} success, {results['failed']} failed, {results['skipped']} skipped")
        return results
    
    # ============= APPOINTMENT SYNC =============
    
    async def sync_appointment_to_rise(self, appointment_id: str) -> Dict:
        """Sync an appointment to Rise CRM as a project or task"""
        try:
            logger.info(f"🔄 Syncing appointment {appointment_id} to Rise CRM...")
            
            # Get appointment - try both 'id' field and '_id' field
            appointment = await self.db.appointments.find_one({'id': appointment_id})
            if not appointment:
                # Try with _id if id field doesn't exist
                from bson import ObjectId
                try:
                    appointment = await self.db.appointments.find_one({'_id': ObjectId(appointment_id)})
                except:
                    appointment = await self.db.appointments.find_one({'_id': appointment_id})
            
            if not appointment:
                logger.error(f"❌ Appointment {appointment_id} not found in database")
                return {'success': False, 'error': 'Appointment not found'}
            
            logger.info(f"✅ Found appointment: {appointment.get('id')} for user {appointment.get('user_id')}")
            
            # Get user and their Rise CRM ID - try both 'id' and '_id'
            user_id = appointment.get('user_id')
            user = await self.db.users.find_one({'id': user_id})
            if not user:
                # Try with _id
                from bson import ObjectId
                try:
                    user = await self.db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    user = await self.db.users.find_one({'_id': user_id})
            
            if not user:
                logger.error(f"❌ User {user_id} not found in database")
                return {'success': False, 'error': 'User not found'}
            
            logger.info(f"✅ Found user: {user.get('email')}")
            
            rise_crm_client_id = user.get('rise_crm_id')
            if not rise_crm_client_id:
                # Sync user first
                user_id_to_sync = user.get('id') or str(user.get('_id'))
                logger.info(f"📤 Syncing user {user_id_to_sync} to Rise CRM first...")
                sync_result = await self.sync_user_to_rise(user_id_to_sync)
                if not sync_result['success']:
                    logger.error(f"❌ Failed to sync user: {sync_result.get('error')}")
                    return {'success': False, 'error': 'Failed to sync user first'}
                rise_crm_client_id = sync_result['rise_crm_id']
                logger.info(f"✅ User synced with Rise CRM ID: {rise_crm_client_id}")
            
            # Validate Rise CRM client ID
            if not rise_crm_client_id:
                logger.error(f"❌ User {user.get('email')} does not have a valid Rise CRM ID")
                return {'success': False, 'error': 'User does not have a valid Rise CRM ID. Please sync user manually first.'}
            
            # Convert to int with validation
            try:
                rise_crm_client_id_int = int(rise_crm_client_id)
            except (ValueError, TypeError) as e:
                logger.error(f"❌ Invalid Rise CRM client ID format: {rise_crm_client_id} (type: {type(rise_crm_client_id)})")
                return {'success': False, 'error': f'Invalid Rise CRM client ID: {rise_crm_client_id}'}
            
            # Create project in Rise CRM for this tax season
            project = RiseCRMProject(
                title=f"Tax Return {appointment.get('tax_year', 2024)} - {user.get('name')}",
                description=f"Appointment scheduled for {appointment.get('date')} at {appointment.get('time')}",
                client_id=rise_crm_client_id_int,
                start_date=appointment.get('date'),
                status='open'
            )
            
            result = await self.rise_service.create_project(project)
            
            if result and result.get('success'):
                project_id = result.get('id')
                
                # Update appointment with Rise CRM project ID
                await self.db.appointments.update_one(
                    {'id': appointment_id},
                    {'$set': {'rise_crm_project_id': project_id}}
                )
                
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'appointment',
                    'entity_id': appointment_id,
                    'ross_tax_id': appointment_id,
                    'rise_crm_id': project_id,
                    'action': 'create',
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow()
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.info(f"✅ Appointment synced as project: {project_id}")
                return {'success': True, 'rise_crm_id': project_id, 'rise_crm_project_id': project_id}
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Appointment sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= TICKET SYNC =============
    
    async def create_rise_ticket_from_chat(self, user_id: str, message: str, title: str) -> Dict:
        """Create a Rise CRM ticket from a chat message"""
        try:
            logger.info(f"🎫 Creating Rise ticket for user {user_id}")
            
            # Get user and Rise CRM ID
            user = await self.db.users.find_one({'id': user_id})
            if not user:
                return {'success': False, 'error': 'User not found'}
            
            rise_crm_client_id = user.get('rise_crm_id')
            if not rise_crm_client_id:
                # Sync user first
                sync_result = await self.sync_user_to_rise(user['id'])
                if not sync_result['success']:
                    return {'success': False, 'error': 'Failed to sync user'}
                rise_crm_client_id = sync_result['rise_crm_id']
            
            # Create ticket
            ticket = RiseCRMTicket(
                title=title,
                description=message,
                client_id=int(rise_crm_client_id),
                priority='medium',
                status='new'
            )
            
            result = await self.rise_service.create_ticket(ticket)
            
            if result and result.get('success'):
                logger.info(f"✅ Ticket created: {result.get('id')}")
                return {'success': True, 'ticket_id': result.get('id')}
            else:
                return {'success': False, 'error': 'Failed to create ticket'}
                
        except Exception as e:
            logger.error(f"❌ Ticket creation error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= PAYMENT SYNC =============
    
    async def sync_payment_to_rise(self, payment_id: str) -> Dict:
        """Sync a payment to Rise CRM as Invoice"""
        try:
            logger.info(f"💰 Syncing payment {payment_id} to Rise CRM...")
            
            # Get payment/credit transaction
            transaction = await self.db.credit_transactions.find_one({'id': payment_id})
            if not transaction:
                return {'success': False, 'error': 'Payment not found'}
            
            # Get user
            user = await self.db.users.find_one({'id': transaction['user_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Create invoice in Rise CRM
            invoice = RiseCRMInvoice(
                client_id=int(user['rise_crm_id']),
                bill_date=transaction.get('created_at', datetime.utcnow()),
                due_date=transaction.get('created_at', datetime.utcnow()),
                invoice_value=transaction['amount'],
                tax=0.0,
                total=transaction['amount'],
                status='paid',
                note=f"Credit purchase - {transaction.get('description', '')}"
            )
            
            result = await self.rise_service.create_invoice(invoice)
            
            if result and result.get('success'):
                logger.info(f"✅ Payment synced as invoice")
                return {'success': True, 'invoice_id': result.get('data', {}).get('id')}
            else:
                return {'success': False, 'error': 'Failed to create invoice'}
                
        except Exception as e:
            logger.error(f"❌ Payment sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= DOCUMENT SYNC =============
    
    async def sync_document_to_rise(self, document_id: str) -> Dict:
        """Sync a document to Rise CRM as Task"""
        try:
            logger.info(f"📄 Syncing document {document_id} to Rise CRM...")
            
            # Get document
            document = await self.db.documents.find_one({'id': document_id})
            if not document:
                return {'success': False, 'error': 'Document not found'}
            
            # Get user
            user = await self.db.users.find_one({'id': document['user_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Get or create project for this user (Tax Season)
            project_title = f"Tax Return {datetime.utcnow().year} - {user.get('name')}"
            
            # Create project if not exists
            project = RiseCRMProject(
                title=project_title,
                description=f"Tax preparation for {user.get('name')}",
                client_id=int(user['rise_crm_id']),
                start_date=datetime.utcnow(),
                status='open'
            )
            
            project_result = await self.rise_service.create_project(project)
            
            if project_result and project_result.get('status'):
                project_id = project_result.get('id')
                
                # Create task for document
                task_title = f"Document Uploaded: {document.get('category', 'Document')}"
                task_desc = f"Category: {document.get('category')}\nDescription: {document.get('description', 'N/A')}"
                
                task_result = await self.rise_service.create_task(
                    title=task_title,
                    project_id=project_id,
                    description=task_desc
                )
                
                if task_result and task_result.get('success'):
                    logger.info(f"✅ Document synced as task")
                    return {'success': True, 'task_id': task_result.get('data', {}).get('id')}
                else:
                    return {'success': False, 'error': 'Failed to create task'}
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Document sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= SERVICE REQUEST SYNC =============
    
    async def sync_service_request_to_rise(self, service_request_id: str) -> Dict:
        """Sync a service request to Rise CRM as a ticket"""
        try:
            logger.info(f"🎫 Syncing service request {service_request_id} to Rise CRM...")
            
            # Get service request
            service_request = await self.db.service_requests.find_one({'id': service_request_id})
            if not service_request:
                return {'success': False, 'error': 'Service request not found'}
            
            # Get user
            user = await self.db.users.find_one({'id': service_request['user_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Create ticket
            ticket = RiseCRMTicket(
                title=f"Service Request: {service_request.get('service_type', 'General')}",
                description=service_request.get('description', '') or service_request.get('notes', ''),
                client_id=int(user['rise_crm_id']),
                priority=service_request.get('priority', 'medium'),
                status=service_request.get('status', 'new')
            )
            
            result = await self.rise_service.create_ticket(ticket)
            
            if result and result.get('success'):
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'service_request',
                    'entity_id': service_request_id,
                    'ross_tax_id': service_request_id,
                    'rise_crm_id': result.get('id'),
                    'action': 'create',
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow()
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.info(f"✅ Service request synced as ticket")
                return {'success': True, 'ticket_id': result.get('id')}
            else:
                return {'success': False, 'error': 'Failed to create ticket'}
                
        except Exception as e:
            logger.error(f"❌ Service request sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= LOAN APPLICATION SYNC =============
    
    async def sync_loan_application_to_rise(self, loan_app_id: str) -> Dict:
        """Sync a loan application to Rise CRM as a project with tasks"""
        try:
            logger.info(f"💰 Syncing loan application {loan_app_id} to Rise CRM...")
            
            # Get loan application
            loan_app = await self.db.loan_applications.find_one({'id': loan_app_id})
            if not loan_app:
                return {'success': False, 'error': 'Loan application not found'}
            
            # Get user
            user = await self.db.users.find_one({'id': loan_app['user_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Get product name
            product_name = "Personal Loan"
            if loan_app.get('product_id'):
                product = await self.db.loan_products.find_one({'id': loan_app['product_id']})
                if product:
                    product_name = product.get('name', 'Personal Loan')
            
            # Create project for loan
            project = RiseCRMProject(
                title=f"Loan Application: {product_name} - {user.get('name')}",
                description=f"Amount: ${loan_app.get('amount', 0)}\nStatus: {loan_app.get('status', 'pending')}\nPurpose: {loan_app.get('purpose', 'N/A')}",
                client_id=int(user['rise_crm_id']),
                start_date=loan_app.get('created_at', datetime.utcnow()),
                status='open' if loan_app.get('status') == 'pending' else 'completed'
            )
            
            result = await self.rise_service.create_project(project)
            
            if result and result.get('success'):
                project_id = result.get('id')
                
                # Create tasks for loan processing steps
                tasks_created = []
                loan_tasks = [
                    ("Verify Identity", "Verify applicant identity and documents"),
                    ("Credit Check", "Perform credit check and assess creditworthiness"),
                    ("Income Verification", "Verify income sources and employment"),
                    ("Loan Approval", "Review and approve/deny loan application")
                ]
                
                for task_title, task_desc in loan_tasks:
                    task_result = await self.rise_service.create_task(
                        title=task_title,
                        project_id=project_id,
                        description=task_desc
                    )
                    if task_result and task_result.get('status'):
                        tasks_created.append(task_result.get('id'))
                
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'loan_application',
                    'entity_id': loan_app_id,
                    'ross_tax_id': loan_app_id,
                    'rise_crm_id': project_id,
                    'action': 'create',
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow(),
                    'data': {'tasks_created': tasks_created}
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.info(f"✅ Loan application synced as project with {len(tasks_created)} tasks")
                return {
                    'success': True,
                    'project_id': project_id,
                    'tasks_created': len(tasks_created)
                }
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Loan application sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= DOCUMENT REQUEST SYNC =============
    
    async def sync_document_request_to_rise(self, doc_request_id: str) -> Dict:
        """Sync a document request to Rise CRM as a pending task"""
        try:
            logger.info(f"📋 Syncing document request {doc_request_id} to Rise CRM...")
            
            # Get document request
            doc_request = await self.db.document_requests.find_one({'id': doc_request_id})
            if not doc_request:
                return {'success': False, 'error': 'Document request not found'}
            
            # Get user
            user = await self.db.users.find_one({'id': doc_request['user_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Get or create project
            project_title = f"Tax Return {datetime.utcnow().year} - {user.get('name')}"
            project = RiseCRMProject(
                title=project_title,
                description=f"Tax preparation for {user.get('name')}",
                client_id=int(user['rise_crm_id']),
                start_date=datetime.utcnow(),
                status='open'
            )
            
            project_result = await self.rise_service.create_project(project)
            
            if project_result and project_result.get('status'):
                project_id = project_result.get('id')
                
                # Create task for document request
                document_type = doc_request.get('document_type', 'Document')
                task_title = f"PENDING: Client must upload {document_type}"
                task_desc = f"Document Type: {document_type}\nStatus: {doc_request.get('status', 'pending')}\nNotes: {doc_request.get('notes', 'N/A')}"
                
                # Set deadline if available
                deadline = None
                if doc_request.get('deadline'):
                    deadline = doc_request['deadline'].strftime("%Y-%m-%d") if hasattr(doc_request['deadline'], 'strftime') else doc_request['deadline']
                elif doc_request.get('due_date'):
                    deadline = doc_request['due_date'].strftime("%Y-%m-%d") if hasattr(doc_request['due_date'], 'strftime') else doc_request['due_date']
                else:
                    deadline = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
                
                task_result = await self.rise_service.create_task(
                    title=task_title,
                    project_id=project_id,
                    description=task_desc,
                    deadline=deadline
                )
                
                if task_result and task_result.get('status'):
                    # Log sync
                    sync_log = {
                        'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                        'entity_type': 'document_request',
                        'entity_id': doc_request_id,
                        'ross_tax_id': doc_request_id,
                        'rise_crm_id': task_result.get('id'),
                        'action': 'create',
                        'direction': 'ross_to_rise',
                        'status': 'success',
                        'sync_timestamp': datetime.utcnow()
                    }
                    await self.db.rise_sync_logs.insert_one(sync_log)
                    
                    logger.info(f"✅ Document request synced as pending task")
                    return {'success': True, 'task_id': task_result.get('id')}
                else:
                    return {'success': False, 'error': 'Failed to create task'}
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Document request sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= CHAT MESSAGE SYNC =============
    
    async def sync_chat_message_to_rise(self, message_id: str) -> Dict:
        """Sync important chat messages to Rise CRM as tickets"""
        try:
            logger.info(f"💬 Syncing chat message {message_id} to Rise CRM...")
            
            # Get chat message
            message = await self.db.chat_messages.find_one({'id': message_id})
            if not message:
                return {'success': False, 'error': 'Chat message not found'}
            
            # Only sync client messages (not admin responses)
            if message.get('sender_role') != 'client':
                return {'success': True, 'action': 'skipped', 'message': 'Only client messages are synced'}
            
            # Get user
            user = await self.db.users.find_one({'id': message['sender_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Create ticket for chat message
            ticket = RiseCRMTicket(
                title=f"Chat Message from {user.get('name')}",
                description=message.get('message', ''),
                client_id=int(user['rise_crm_id']),
                priority='medium',
                status='new'
            )
            
            result = await self.rise_service.create_ticket(ticket)
            
            if result and result.get('success'):
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'chat_message',
                    'entity_id': message_id,
                    'ross_tax_id': message_id,
                    'rise_crm_id': result.get('id'),
                    'action': 'create',
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow()
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.info(f"✅ Chat message synced as ticket")
                return {'success': True, 'ticket_id': result.get('id')}
            else:
                return {'success': False, 'error': 'Failed to create ticket'}
                
        except Exception as e:
            logger.error(f"❌ Chat message sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= REFERRAL SYNC =============
    
    async def sync_referral_to_rise(self, referral_id: str) -> Dict:
        """Sync referral to Rise CRM as client note"""
        try:
            logger.info(f"🤝 Syncing referral {referral_id} to Rise CRM...")
            
            # Get referral
            referral = await self.db.referrals.find_one({'id': referral_id})
            if not referral:
                return {'success': False, 'error': 'Referral not found'}
            
            # Get referrer (the person who referred)
            referrer = await self.db.users.find_one({'id': referral['referrer_id']})
            if not referrer or not referrer.get('rise_crm_id'):
                return {'success': False, 'error': 'Referrer not synced to Rise CRM'}
            
            # Get referred user
            referred = await self.db.users.find_one({'id': referral['referred_id']})
            referred_name = referred.get('name', 'Unknown') if referred else 'Unknown'
            referred_email = referred.get('email', '') if referred else ''
            
            # Create note about referral (Rise CRM doesn't have native referral tracking)
            note_content = f"Referral Program: {referrer.get('name')} referred {referred_name} ({referred_email})\n"
            note_content += f"Status: {referral.get('status', 'pending')}\n"
            note_content += f"Referral Code: {referral.get('code', 'N/A')}\n"
            note_content += f"Date: {referral.get('created_at', datetime.utcnow()).strftime('%Y-%m-%d')}"
            
            # Create project note (we'll use create_task as a workaround since notes API might differ)
            project_title = f"Client Profile - {referrer.get('name')}"
            project = RiseCRMProject(
                title=project_title,
                description=f"Client profile and activity for {referrer.get('name')}",
                client_id=int(referrer['rise_crm_id']),
                start_date=datetime.utcnow(),
                status='open'
            )
            
            project_result = await self.rise_service.create_project(project)
            
            if project_result and project_result.get('status'):
                project_id = project_result.get('id')
                
                # Create task as note
                task_result = await self.rise_service.create_task(
                    title=f"Referral: {referred_name}",
                    project_id=project_id,
                    description=note_content
                )
                
                if task_result and task_result.get('status'):
                    # Log sync
                    sync_log = {
                        'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                        'entity_type': 'referral',
                        'entity_id': referral_id,
                        'ross_tax_id': referral_id,
                        'rise_crm_id': task_result.get('id'),
                        'action': 'create',
                        'direction': 'ross_to_rise',
                        'status': 'success',
                        'sync_timestamp': datetime.utcnow()
                    }
                    await self.db.rise_sync_logs.insert_one(sync_log)
                    
                    logger.info(f"✅ Referral synced as note")
                    return {'success': True, 'task_id': task_result.get('id')}
                else:
                    return {'success': False, 'error': 'Failed to create note'}
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Referral sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= WHATSAPP MESSAGE SYNC =============
    
    async def sync_whatsapp_message_to_rise(self, message_id: str) -> Dict:
        """Sync WhatsApp message to Rise CRM as communication log"""
        try:
            logger.info(f"📱 Syncing WhatsApp message {message_id} to Rise CRM...")
            
            # Get WhatsApp message
            message = await self.db.whatsapp_messages.find_one({'id': message_id})
            if not message:
                return {'success': False, 'error': 'WhatsApp message not found'}
            
            # Get conversation to find user
            conversation = await self.db.whatsapp_conversations.find_one({
                'conversation_id': message.get('conversation_id')
            })
            
            if not conversation:
                return {'success': False, 'error': 'Conversation not found'}
            
            # Get user
            user = await self.db.users.find_one({'phone': conversation.get('phone_number')})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Create ticket for WhatsApp communication
            ticket = RiseCRMTicket(
                title=f"WhatsApp: {conversation.get('client_name', 'Client')}",
                description=f"Message: {message.get('message', '')}\nFrom: {message.get('from_number')}\nTimestamp: {message.get('timestamp')}",
                client_id=int(user['rise_crm_id']),
                priority='low',
                status='new'
            )
            
            result = await self.rise_service.create_ticket(ticket)
            
            if result and result.get('success'):
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'whatsapp_message',
                    'entity_id': message_id,
                    'ross_tax_id': message_id,
                    'rise_crm_id': result.get('id'),
                    'action': 'create',
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow()
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.info(f"✅ WhatsApp message synced as ticket")
                return {'success': True, 'ticket_id': result.get('id')}
            else:
                return {'success': False, 'error': 'Failed to create ticket'}
                
        except Exception as e:
            logger.error(f"❌ WhatsApp message sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= TAX RETURN SYNC =============
    
    async def sync_tax_return_to_rise(self, tax_return_id: str) -> Dict:
        """Sync completed tax return to Rise CRM as closed project"""
        try:
            logger.info(f"📊 Syncing tax return {tax_return_id} to Rise CRM...")
            
            # Get tax return
            tax_return = await self.db.completed_tax_returns.find_one({'id': tax_return_id})
            if not tax_return:
                return {'success': False, 'error': 'Tax return not found'}
            
            # Get user
            user = await self.db.users.find_one({'id': tax_return['user_id']})
            if not user or not user.get('rise_crm_id'):
                return {'success': False, 'error': 'User not synced to Rise CRM'}
            
            # Create project for completed tax return
            tax_year = tax_return.get('tax_year', datetime.utcnow().year)
            project = RiseCRMProject(
                title=f"Tax Return {tax_year} - {user.get('name')} (COMPLETED)",
                description=f"Status: {tax_return.get('status', 'completed')}\nFiling Status: {tax_return.get('filing_status', 'N/A')}\nCompleted Date: {tax_return.get('completed_date', 'N/A')}",
                client_id=int(user['rise_crm_id']),
                start_date=tax_return.get('start_date', datetime.utcnow()),
                deadline=tax_return.get('completed_date', datetime.utcnow()),
                status='completed'
            )
            
            result = await self.rise_service.create_project(project)
            
            if result and result.get('success'):
                # Log sync
                sync_log = {
                    'sync_id': f"sync_{datetime.utcnow().timestamp()}",
                    'entity_type': 'tax_return',
                    'entity_id': tax_return_id,
                    'ross_tax_id': tax_return_id,
                    'rise_crm_id': result.get('id'),
                    'action': 'create',
                    'direction': 'ross_to_rise',
                    'status': 'success',
                    'sync_timestamp': datetime.utcnow()
                }
                await self.db.rise_sync_logs.insert_one(sync_log)
                
                logger.info(f"✅ Tax return synced as completed project")
                return {'success': True, 'project_id': result.get('id')}
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Tax return sync error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= MISSING DOCUMENT TASK =============
    
    async def create_missing_document_task(self, user_id: str, document_type: str) -> Dict:
        """Create a task in Rise CRM for missing document"""
        try:
            logger.info(f"📝 Creating missing document task for {user_id}: {document_type}")
            
            # Get user
            user = await self.db.users.find_one({'id': user_id})
            if not user or not user.get('rise_crm_id'):
                # Sync user first
                sync_result = await self.sync_user_to_rise(user_id)
                if not sync_result['success']:
                    return {'success': False, 'error': 'Failed to sync user'}
                user = await self.db.users.find_one({'id': user_id})
            
            # Get or create project
            project_title = f"Tax Return {datetime.utcnow().year} - {user.get('name')}"
            project = RiseCRMProject(
                title=project_title,
                description=f"Tax preparation for {user.get('name')}",
                client_id=int(user['rise_crm_id']),
                start_date=datetime.utcnow(),
                status='open'
            )
            
            project_result = await self.rise_service.create_project(project)
            
            if project_result and project_result.get('status'):
                project_id = project_result.get('id')
                
                # Create task
                task_title = f"PENDING: Upload {document_type}"
                task_desc = f"Client needs to upload: {document_type}"
                
                task_result = await self.rise_service.create_task(
                    title=task_title,
                    project_id=project_id,
                    description=task_desc,
                    deadline=(datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
                )
                
                if task_result and task_result.get('status'):
                    logger.info(f"✅ Missing document task created")
                    return {'success': True, 'task_id': task_result.get('id')}
                else:
                    return {'success': False, 'error': 'Failed to create task'}
            else:
                return {'success': False, 'error': 'Failed to create project'}
                
        except Exception as e:
            logger.error(f"❌ Task creation error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    # ============= SYNC STATUS =============
    
    async def get_sync_status(self) -> Dict:
        """Get overall sync status"""
        try:
            # Count synced entities
            total_users = await self.db.users.count_documents({'role': 'client'})
            synced_users = await self.db.users.count_documents({'role': 'client', 'rise_crm_id': {'$exists': True}})
            
            # Get recent sync logs
            recent_syncs = await self.db.rise_sync_logs.find().sort('sync_timestamp', -1).limit(10).to_list(length=10)
            
            # Convert ObjectId to string for JSON serialization
            for sync in recent_syncs:
                if '_id' in sync:
                    sync['_id'] = str(sync['_id'])
                if 'sync_timestamp' in sync and hasattr(sync['sync_timestamp'], 'isoformat'):
                    sync['sync_timestamp'] = sync['sync_timestamp'].isoformat()
            
            # Count by status
            success_count = await self.db.rise_sync_logs.count_documents({'status': 'success'})
            failed_count = await self.db.rise_sync_logs.count_documents({'status': 'failed'})
            
            return {
                'success': True,
                'sync_enabled': self.rise_service.sync_enabled,
                'statistics': {
                    'total_users': total_users,
                    'synced_users': synced_users,
                    'sync_percentage': round((synced_users / total_users * 100) if total_users > 0 else 0, 2),
                    'total_syncs': success_count + failed_count,
                    'successful_syncs': success_count,
                    'failed_syncs': failed_count
                },
                'recent_syncs': recent_syncs
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting sync status: {str(e)}")
            return {'success': False, 'error': str(e)}

# This will be initialized in server.py with the database
rise_sync_service = None

def init_rise_sync_service(db: AsyncIOMotorDatabase):
    """Initialize the Rise CRM sync service with database"""
    global rise_sync_service
    rise_sync_service = RiseCRMSyncService(db)
    logger.info("✅ Rise CRM Sync Service initialized with database")
    return rise_sync_service
