"""
Scheduled Batch Upload Service
Allows scheduling customer uploads to be processed gradually over time
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from enum import Enum

logger = logging.getLogger(__name__)


# ==================== MODELS ====================

class BatchStatus(str, Enum):
    PENDING = "pending"      # Waiting to start
    RUNNING = "running"      # Currently processing
    PAUSED = "paused"        # Manually paused
    COMPLETED = "completed"  # All customers processed
    CANCELLED = "cancelled"  # Manually cancelled
    ERROR = "error"          # Stopped due to errors


class ScheduledBatch(BaseModel):
    """A scheduled batch of customers to upload"""
    id: Optional[str] = None
    name: str  # Batch name for reference
    
    # Schedule configuration
    customersPerCycle: int = 3  # How many customers per cycle
    intervalMinutes: int = 60   # Minutes between cycles
    workingHoursOnly: bool = True  # Only process during 8am-6pm
    workingHourStart: int = 8   # Start hour (24h format)
    workingHourEnd: int = 18    # End hour (24h format)
    
    # Progress tracking
    totalCustomers: int = 0
    processedCount: int = 0
    successCount: int = 0
    failCount: int = 0
    
    # Status
    status: BatchStatus = BatchStatus.PENDING
    lastProcessedAt: Optional[datetime] = None
    nextProcessAt: Optional[datetime] = None
    estimatedCompletionAt: Optional[datetime] = None
    
    # Metadata
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    createdBy: Optional[str] = None
    
    # Error tracking
    lastError: Optional[str] = None
    consecutiveErrors: int = 0


class PendingCustomer(BaseModel):
    """A customer waiting to be created"""
    id: Optional[str] = None
    batchId: str
    
    # Customer data (same structure as batch create)
    customerData: Dict[str, Any]
    
    # Status
    status: str = "pending"  # pending, processing, completed, failed
    attempts: int = 0
    lastAttemptAt: Optional[datetime] = None
    error: Optional[str] = None
    
    # Result
    customerVaultId: Optional[str] = None
    subscriptionId: Optional[str] = None
    
    # Order in queue
    queuePosition: int = 0
    createdAt: Optional[datetime] = None


class CreateScheduledBatchRequest(BaseModel):
    """Request to create a scheduled batch"""
    name: str
    customers: List[Dict[str, Any]]  # List of customer data objects
    customersPerCycle: int = 3
    intervalMinutes: int = 60
    workingHoursOnly: bool = True
    workingHourStart: int = 8
    workingHourEnd: int = 18
    startImmediately: bool = True


# ==================== SERVICE ====================

class ScheduledBatchService:
    """Service for managing scheduled batch uploads"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.batches_collection = db.scheduled_batches
        self.pending_collection = db.pending_customers
        self.vault_collection = db.vault_customers
        logger.info("✅ Scheduled Batch Service initialized")
    
    async def create_batch(
        self,
        name: str,
        customers: List[Dict[str, Any]],
        customers_per_cycle: int = 3,
        interval_minutes: int = 60,
        working_hours_only: bool = True,
        working_hour_start: int = 8,
        working_hour_end: int = 18,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new scheduled batch"""
        
        batch_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        # Calculate estimated completion
        total = len(customers)
        cycles_needed = (total + customers_per_cycle - 1) // customers_per_cycle
        
        if working_hours_only:
            # Rough estimate considering working hours
            working_hours_per_day = working_hour_end - working_hour_start
            cycles_per_day = (working_hours_per_day * 60) // interval_minutes
            days_needed = (cycles_needed + cycles_per_day - 1) // cycles_per_day if cycles_per_day > 0 else cycles_needed
            estimated_completion = now + timedelta(days=days_needed)
        else:
            total_minutes = cycles_needed * interval_minutes
            estimated_completion = now + timedelta(minutes=total_minutes)
        
        # Calculate next process time
        next_process = self._calculate_next_process_time(
            now, interval_minutes, working_hours_only, working_hour_start, working_hour_end
        )
        
        # Create batch document
        batch_doc = {
            'id': batch_id,
            'name': name,
            'customersPerCycle': customers_per_cycle,
            'intervalMinutes': interval_minutes,
            'workingHoursOnly': working_hours_only,
            'workingHourStart': working_hour_start,
            'workingHourEnd': working_hour_end,
            'totalCustomers': total,
            'processedCount': 0,
            'successCount': 0,
            'failCount': 0,
            'status': BatchStatus.RUNNING.value,
            'lastProcessedAt': None,
            'nextProcessAt': next_process,
            'estimatedCompletionAt': estimated_completion,
            'createdAt': now,
            'updatedAt': now,
            'createdBy': created_by,
            'lastError': None,
            'consecutiveErrors': 0
        }
        
        await self.batches_collection.insert_one(batch_doc)
        
        # Create pending customer documents
        pending_docs = []
        for i, customer_data in enumerate(customers):
            pending_doc = {
                'id': str(uuid.uuid4()),
                'batchId': batch_id,
                'customerData': customer_data,
                'status': 'pending',
                'attempts': 0,
                'lastAttemptAt': None,
                'error': None,
                'customerVaultId': None,
                'subscriptionId': None,
                'queuePosition': i,
                'createdAt': now
            }
            pending_docs.append(pending_doc)
        
        if pending_docs:
            await self.pending_collection.insert_many(pending_docs)
        
        logger.info(f"✅ Created scheduled batch '{name}' with {total} customers, processing {customers_per_cycle} every {interval_minutes} min")
        
        return {
            'success': True,
            'batch': batch_doc,
            'message': f'Batch creado: {total} clientes, {customers_per_cycle} cada {interval_minutes} minutos'
        }
    
    def _calculate_next_process_time(
        self,
        from_time: datetime,
        interval_minutes: int,
        working_hours_only: bool,
        working_hour_start: int,
        working_hour_end: int
    ) -> datetime:
        """Calculate the next processing time considering working hours"""
        next_time = from_time + timedelta(minutes=interval_minutes)
        
        if not working_hours_only:
            return next_time
        
        # Adjust for working hours
        hour = next_time.hour
        
        if hour < working_hour_start:
            # Before working hours, move to start
            next_time = next_time.replace(hour=working_hour_start, minute=0, second=0)
        elif hour >= working_hour_end:
            # After working hours, move to next day
            next_time = next_time + timedelta(days=1)
            next_time = next_time.replace(hour=working_hour_start, minute=0, second=0)
        
        # Skip weekends (optional - can be configured)
        while next_time.weekday() >= 5:  # Saturday=5, Sunday=6
            next_time = next_time + timedelta(days=1)
            next_time = next_time.replace(hour=working_hour_start, minute=0, second=0)
        
        return next_time
    
    async def get_batches(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all scheduled batches"""
        query = {}
        if status:
            query['status'] = status
        
        cursor = self.batches_collection.find(query).sort('createdAt', -1)
        batches = await cursor.to_list(100)
        
        for batch in batches:
            batch['_id'] = str(batch['_id'])
        
        return batches
    
    async def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific batch"""
        batch = await self.batches_collection.find_one({'id': batch_id})
        if batch:
            batch['_id'] = str(batch['_id'])
        return batch
    
    async def get_batch_customers(self, batch_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get customers in a batch"""
        query = {'batchId': batch_id}
        if status:
            query['status'] = status
        
        cursor = self.pending_collection.find(query).sort('queuePosition', 1)
        customers = await cursor.to_list(1000)
        
        for c in customers:
            c['_id'] = str(c['_id'])
        
        return customers
    
    async def pause_batch(self, batch_id: str) -> Dict[str, Any]:
        """Pause a running batch"""
        result = await self.batches_collection.update_one(
            {'id': batch_id, 'status': BatchStatus.RUNNING.value},
            {'$set': {
                'status': BatchStatus.PAUSED.value,
                'updatedAt': datetime.utcnow()
            }}
        )
        
        if result.modified_count > 0:
            logger.info(f"⏸️ Paused batch {batch_id}")
            return {'success': True, 'message': 'Batch pausado'}
        
        return {'success': False, 'error': 'Batch not found or not running'}
    
    async def resume_batch(self, batch_id: str) -> Dict[str, Any]:
        """Resume a paused batch"""
        now = datetime.utcnow()
        batch = await self.get_batch(batch_id)
        
        if not batch:
            return {'success': False, 'error': 'Batch not found'}
        
        next_process = self._calculate_next_process_time(
            now,
            batch['intervalMinutes'],
            batch['workingHoursOnly'],
            batch['workingHourStart'],
            batch['workingHourEnd']
        )
        
        result = await self.batches_collection.update_one(
            {'id': batch_id, 'status': BatchStatus.PAUSED.value},
            {'$set': {
                'status': BatchStatus.RUNNING.value,
                'nextProcessAt': next_process,
                'updatedAt': now
            }}
        )
        
        if result.modified_count > 0:
            logger.info(f"▶️ Resumed batch {batch_id}")
            return {'success': True, 'message': 'Batch reanudado'}
        
        return {'success': False, 'error': 'Batch not found or not paused'}
    
    async def cancel_batch(self, batch_id: str) -> Dict[str, Any]:
        """Cancel a batch and remove pending customers"""
        result = await self.batches_collection.update_one(
            {'id': batch_id},
            {'$set': {
                'status': BatchStatus.CANCELLED.value,
                'updatedAt': datetime.utcnow()
            }}
        )
        
        # Remove pending customers
        await self.pending_collection.delete_many({
            'batchId': batch_id,
            'status': 'pending'
        })
        
        if result.modified_count > 0:
            logger.info(f"❌ Cancelled batch {batch_id}")
            return {'success': True, 'message': 'Batch cancelado'}
        
        return {'success': False, 'error': 'Batch not found'}
    
    async def get_next_customers_to_process(self, batch_id: str, count: int) -> List[Dict[str, Any]]:
        """Get the next customers to process from a batch"""
        cursor = self.pending_collection.find({
            'batchId': batch_id,
            'status': 'pending'
        }).sort('queuePosition', 1).limit(count)
        
        customers = await cursor.to_list(count)
        return customers
    
    async def mark_customer_processing(self, customer_id: str):
        """Mark a customer as being processed"""
        await self.pending_collection.update_one(
            {'id': customer_id},
            {'$set': {
                'status': 'processing',
                'lastAttemptAt': datetime.utcnow()
            },
            '$inc': {'attempts': 1}}
        )
    
    async def mark_customer_completed(
        self,
        customer_id: str,
        vault_id: Optional[str] = None,
        subscription_id: Optional[str] = None
    ):
        """Mark a customer as successfully processed"""
        await self.pending_collection.update_one(
            {'id': customer_id},
            {'$set': {
                'status': 'completed',
                'customerVaultId': vault_id,
                'subscriptionId': subscription_id
            }}
        )
    
    async def mark_customer_failed(self, customer_id: str, error: str):
        """Mark a customer as failed"""
        await self.pending_collection.update_one(
            {'id': customer_id},
            {'$set': {
                'status': 'failed',
                'error': error
            }}
        )
    
    async def update_batch_progress(
        self,
        batch_id: str,
        success_count: int,
        fail_count: int
    ):
        """Update batch progress after processing a cycle"""
        batch = await self.get_batch(batch_id)
        if not batch:
            return
        
        now = datetime.utcnow()
        new_processed = batch['processedCount'] + success_count + fail_count
        new_success = batch['successCount'] + success_count
        new_fail = batch['failCount'] + fail_count
        
        # Check if completed
        if new_processed >= batch['totalCustomers']:
            status = BatchStatus.COMPLETED.value
            next_process = None
            logger.info(f"✅ Batch {batch_id} completed: {new_success} success, {new_fail} failed")
        else:
            status = batch['status']
            next_process = self._calculate_next_process_time(
                now,
                batch['intervalMinutes'],
                batch['workingHoursOnly'],
                batch['workingHourStart'],
                batch['workingHourEnd']
            )
        
        await self.batches_collection.update_one(
            {'id': batch_id},
            {'$set': {
                'processedCount': new_processed,
                'successCount': new_success,
                'failCount': new_fail,
                'status': status,
                'lastProcessedAt': now,
                'nextProcessAt': next_process,
                'updatedAt': now,
                'consecutiveErrors': 0 if success_count > 0 else batch['consecutiveErrors'] + 1
            }}
        )
    
    async def get_batches_ready_to_process(self) -> List[Dict[str, Any]]:
        """Get all batches that are ready to process (running and past nextProcessAt)"""
        now = datetime.utcnow()
        
        cursor = self.batches_collection.find({
            'status': BatchStatus.RUNNING.value,
            'nextProcessAt': {'$lte': now}
        })
        
        batches = await cursor.to_list(100)
        return batches
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get overall scheduled batch statistics"""
        pipeline = [
            {'$group': {
                '_id': '$status',
                'count': {'$sum': 1},
                'totalCustomers': {'$sum': '$totalCustomers'},
                'processedCount': {'$sum': '$processedCount'},
                'successCount': {'$sum': '$successCount'},
                'failCount': {'$sum': '$failCount'}
            }}
        ]
        
        results = await self.batches_collection.aggregate(pipeline).to_list(10)
        
        stats = {
            'running': 0,
            'paused': 0,
            'completed': 0,
            'cancelled': 0,
            'totalCustomers': 0,
            'processedCount': 0,
            'pendingCount': 0
        }
        
        for r in results:
            status = r['_id']
            if status == 'running':
                stats['running'] = r['count']
            elif status == 'paused':
                stats['paused'] = r['count']
            elif status == 'completed':
                stats['completed'] = r['count']
            elif status == 'cancelled':
                stats['cancelled'] = r['count']
            
            stats['totalCustomers'] += r.get('totalCustomers', 0)
            stats['processedCount'] += r.get('processedCount', 0)
        
        stats['pendingCount'] = stats['totalCustomers'] - stats['processedCount']
        
        return stats
    
    async def delete_batch(self, batch_id: str) -> Dict[str, Any]:
        """Delete a batch and all its pending customers"""
        # Delete pending customers
        await self.pending_collection.delete_many({'batchId': batch_id})
        
        # Delete batch
        result = await self.batches_collection.delete_one({'id': batch_id})
        
        if result.deleted_count > 0:
            logger.info(f"🗑️ Deleted batch {batch_id}")
            return {'success': True, 'message': 'Batch eliminado'}
        
        return {'success': False, 'error': 'Batch no encontrado'}


# ==================== BACKGROUND PROCESSOR ====================

class ScheduledBatchProcessor:
    """Background processor for scheduled batches"""
    
    def __init__(
        self,
        batch_service: ScheduledBatchService,
        merchant_service,  # MerchantOneService
        check_interval_seconds: int = 60
    ):
        self.batch_service = batch_service
        self.merchant_service = merchant_service
        self.check_interval = check_interval_seconds
        self.is_running = False
        self._task = None
        logger.info(f"✅ Scheduled Batch Processor initialized (interval: {check_interval_seconds}s)")
    
    async def start(self):
        """Start the background processor"""
        if self.is_running:
            logger.warning("Processor already running")
            return
        
        self.is_running = True
        logger.info("▶️ Starting Scheduled Batch Processor")
        
        import asyncio
        self._task = asyncio.create_task(self._process_loop())
    
    async def stop(self):
        """Stop the background processor"""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("⏹️ Scheduled Batch Processor stopped")
    
    async def _process_loop(self):
        """Main processing loop"""
        import asyncio
        
        while self.is_running:
            try:
                await self._process_ready_batches()
            except Exception as e:
                logger.error(f"Error in batch processor loop: {e}")
            
            await asyncio.sleep(self.check_interval)
    
    async def _process_ready_batches(self):
        """Process all batches that are ready"""
        batches = await self.batch_service.get_batches_ready_to_process()
        
        for batch in batches:
            try:
                await self._process_batch_cycle(batch)
            except Exception as e:
                logger.error(f"Error processing batch {batch['id']}: {e}")
                # Update batch with error
                await self.batch_service.batches_collection.update_one(
                    {'id': batch['id']},
                    {'$set': {
                        'lastError': str(e),
                        'updatedAt': datetime.utcnow()
                    },
                    '$inc': {'consecutiveErrors': 1}}
                )
    
    async def _process_batch_cycle(self, batch: Dict[str, Any]):
        """Process one cycle of a batch (N customers)"""
        batch_id = batch['id']
        customers_per_cycle = batch['customersPerCycle']
        
        logger.info(f"🔄 Processing batch {batch_id}: up to {customers_per_cycle} customers")
        
        # Get next customers to process
        pending_customers = await self.batch_service.get_next_customers_to_process(
            batch_id, customers_per_cycle
        )
        
        if not pending_customers:
            logger.info(f"✅ No pending customers for batch {batch_id}")
            # Mark as completed
            await self.batch_service.batches_collection.update_one(
                {'id': batch_id},
                {'$set': {
                    'status': BatchStatus.COMPLETED.value,
                    'updatedAt': datetime.utcnow()
                }}
            )
            return
        
        success_count = 0
        fail_count = 0
        
        for pending in pending_customers:
            customer_id = pending['id']
            customer_data = pending['customerData']
            
            try:
                # Mark as processing
                await self.batch_service.mark_customer_processing(customer_id)
                
                # Import models
                from merchant_one_models import CustomerInfo, BankInfo, SubscriptionInfo
                
                # Build request objects
                customer_info = CustomerInfo(**customer_data['customer'])
                bank_info = BankInfo(**customer_data['bank'])
                subscription_info = SubscriptionInfo(**customer_data['subscription'])
                
                # Create vault and subscription
                response = await self.merchant_service.create_vault_and_subscription(
                    customer_info, bank_info, subscription_info
                )
                
                if response.vaultSuccess:
                    await self.batch_service.mark_customer_completed(
                        customer_id,
                        vault_id=response.customerVaultId,
                        subscription_id=response.subscriptionId
                    )
                    success_count += 1
                    logger.info(f"✅ Batch customer created: {customer_data['customer']['firstName']} {customer_data['customer']['lastName']}")
                else:
                    error_msg = response.vaultError or response.subscriptionError or 'Unknown error'
                    await self.batch_service.mark_customer_failed(customer_id, error_msg)
                    fail_count += 1
                    logger.warning(f"❌ Batch customer failed: {error_msg}")
                    
            except Exception as e:
                await self.batch_service.mark_customer_failed(customer_id, str(e))
                fail_count += 1
                logger.error(f"❌ Error processing customer {customer_id}: {e}")
        
        # Update batch progress
        await self.batch_service.update_batch_progress(batch_id, success_count, fail_count)
        
        logger.info(f"📊 Batch {batch_id} cycle complete: {success_count} success, {fail_count} failed")
    
    async def process_batch_now(self, batch_id: str) -> Dict[str, Any]:
        """Manually trigger processing of a specific batch (for testing)"""
        batch = await self.batch_service.get_batch(batch_id)
        
        if not batch:
            return {'success': False, 'error': 'Batch not found'}
        
        if batch['status'] != BatchStatus.RUNNING.value:
            return {'success': False, 'error': f'Batch is not running (status: {batch["status"]})'}
        
        await self._process_batch_cycle(batch)
        
        # Refresh batch data
        updated_batch = await self.batch_service.get_batch(batch_id)
        
        return {
            'success': True,
            'message': 'Cycle processed',
            'batch': updated_batch
        }


# Global instances
scheduled_batch_service: Optional[ScheduledBatchService] = None
scheduled_batch_processor: Optional[ScheduledBatchProcessor] = None


def init_scheduled_batch_service(db, merchant_service=None) -> ScheduledBatchService:
    """Initialize the scheduled batch service"""
    global scheduled_batch_service, scheduled_batch_processor
    
    scheduled_batch_service = ScheduledBatchService(db)
    
    if merchant_service:
        scheduled_batch_processor = ScheduledBatchProcessor(
            scheduled_batch_service,
            merchant_service,
            check_interval_seconds=60  # Check every minute
        )
    
    return scheduled_batch_service


def get_scheduled_batch_service() -> Optional[ScheduledBatchService]:
    """Get the scheduled batch service instance"""
    return scheduled_batch_service


def get_scheduled_batch_processor() -> Optional[ScheduledBatchProcessor]:
    """Get the scheduled batch processor instance"""
    return scheduled_batch_processor
