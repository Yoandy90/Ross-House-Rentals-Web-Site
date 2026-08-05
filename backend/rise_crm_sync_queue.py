import logging
import asyncio
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from collections import defaultdict

logger = logging.getLogger(__name__)

class SyncQueue:
    """Queue system for Rise CRM sync with retry logic and batch processing"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.queue = asyncio.Queue()
        self.processing = False
        self.stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'retries': 0
        }
        self.failed_items = defaultdict(int)  # Track retry counts
        self.max_retries = 3
        self.retry_delay = 60  # seconds
        logger.info("🔄 Sync Queue initialized")
    
    async def add_to_queue(self, entity_type: str, entity_id: str, priority: int = 5):
        """Add item to sync queue"""
        item = {
            'entity_type': entity_type,
            'entity_id': entity_id,
            'priority': priority,
            'added_at': datetime.utcnow(),
            'retries': 0
        }
        
        await self.queue.put(item)
        logger.info(f"➕ Added to queue: {entity_type}/{entity_id} (priority: {priority})")
        
        # Store in database for persistence
        await self.db.sync_queue.insert_one({
            **item,
            'status': 'queued'
        })
    
    async def process_queue(self):
        """Process sync queue continuously"""
        if self.processing:
            logger.warning("⚠️ Queue processor already running")
            return
        
        self.processing = True
        logger.info("▶️  Starting queue processor...")
        
        try:
            while True:
                try:
                    # Get item from queue with timeout
                    item = await asyncio.wait_for(self.queue.get(), timeout=5.0)
                    
                    # Process item
                    success = await self._process_item(item)
                    
                    if success:
                        self.stats['successful'] += 1
                        await self.db.sync_queue.update_one(
                            {'entity_id': item['entity_id'], 'entity_type': item['entity_type']},
                            {'$set': {'status': 'completed', 'completed_at': datetime.utcnow()}}
                        )
                    else:
                        self.stats['failed'] += 1
                        item['retries'] += 1
                        
                        # Retry logic
                        if item['retries'] < self.max_retries:
                            self.stats['retries'] += 1
                            logger.warning(f"⚠️ Retry {item['retries']}/{self.max_retries} for {item['entity_type']}/{item['entity_id']}")
                            
                            # Re-queue with delay
                            await asyncio.sleep(self.retry_delay)
                            await self.queue.put(item)
                            
                            await self.db.sync_queue.update_one(
                                {'entity_id': item['entity_id'], 'entity_type': item['entity_type']},
                                {'$set': {'status': 'retrying', 'retries': item['retries']}}
                            )
                        else:
                            logger.error(f"❌ Max retries reached for {item['entity_type']}/{item['entity_id']}")
                            await self.db.sync_queue.update_one(
                                {'entity_id': item['entity_id'], 'entity_type': item['entity_type']},
                                {'$set': {'status': 'failed', 'failed_at': datetime.utcnow(), 'retries': item['retries']}}
                            )
                    
                    self.stats['total_processed'] += 1
                    
                except asyncio.TimeoutError:
                    # No items in queue, continue waiting
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"❌ Queue processing error: {str(e)}")
                    await asyncio.sleep(5)
                
        except Exception as e:
            logger.error(f"❌ Fatal queue processor error: {str(e)}")
        finally:
            self.processing = False
            logger.info("⏹️  Queue processor stopped")
    
    async def _process_item(self, item: Dict) -> bool:
        """Process a single queue item"""
        try:
            entity_type = item['entity_type']
            entity_id = item['entity_id']
            
            logger.info(f"🔄 Processing: {entity_type}/{entity_id}")
            
            # Get sync service
            from rise_crm_sync_service import rise_sync_service
            if not rise_sync_service:
                logger.error("❌ Sync service not available")
                return False
            
            # Route to appropriate sync method
            sync_methods = {
                'user': rise_sync_service.sync_user_to_rise,
                'document': rise_sync_service.sync_document_to_rise,
                'payment': rise_sync_service.sync_payment_to_rise,
                'loan_application': rise_sync_service.sync_loan_application_to_rise,
                'document_request': rise_sync_service.sync_document_request_to_rise,
                'service_request': rise_sync_service.sync_service_request_to_rise,
                'referral': rise_sync_service.sync_referral_to_rise,
                'chat_message': rise_sync_service.sync_chat_message_to_rise,
                'whatsapp_message': rise_sync_service.sync_whatsapp_message_to_rise,
                'tax_return': rise_sync_service.sync_tax_return_to_rise,
            }
            
            sync_method = sync_methods.get(entity_type)
            if not sync_method:
                logger.error(f"❌ No sync method for entity type: {entity_type}")
                return False
            
            # Execute sync
            result = await sync_method(entity_id)
            
            if result.get('success'):
                logger.info(f"✅ Successfully synced: {entity_type}/{entity_id}")
                return True
            else:
                logger.warning(f"⚠️ Sync failed: {entity_type}/{entity_id} - {result.get('error')}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Item processing error: {str(e)}")
            return False
    
    async def batch_process(self, entity_type: str, limit: int = 100):
        """Add multiple entities to queue for batch processing"""
        try:
            logger.info(f"📦 Starting batch process for {entity_type} (limit: {limit})")
            
            # Get entities based on type
            collection_map = {
                'user': 'users',
                'document': 'documents',
                'payment': 'credit_transactions',
                'loan_application': 'loan_applications',
                'document_request': 'document_requests',
            }
            
            collection_name = collection_map.get(entity_type)
            if not collection_name:
                logger.error(f"❌ Unknown entity type for batch: {entity_type}")
                return {'success': False, 'error': 'Unknown entity type'}
            
            # Query entities
            query = {}
            if entity_type == 'user':
                query = {'role': 'client'}
            elif entity_type == 'payment':
                query = {'transaction_type': 'purchase', 'status': 'completed'}
            
            entities = await self.db[collection_name].find(query).limit(limit).to_list(length=limit)
            
            # Add to queue
            added = 0
            for entity in entities:
                entity_id = entity.get('id') or entity.get('_id')
                await self.add_to_queue(entity_type, str(entity_id), priority=5)
                added += 1
            
            logger.info(f"✅ Added {added} items to batch queue")
            return {'success': True, 'added': added}
            
        except Exception as e:
            logger.error(f"❌ Batch process error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_stats(self) -> Dict:
        """Get queue statistics"""
        return {
            'queue_size': self.queue.qsize(),
            'is_processing': self.processing,
            'stats': self.stats,
            'failed_items_count': len(self.failed_items)
        }
    
    async def get_failed_items(self) -> List[Dict]:
        """Get list of failed items from database"""
        failed = await self.db.sync_queue.find({
            'status': 'failed'
        }).sort('failed_at', -1).limit(50).to_list(length=50)
        
        # Clean up ObjectIds
        for item in failed:
            if '_id' in item:
                item['_id'] = str(item['_id'])
            if 'added_at' in item and hasattr(item['added_at'], 'isoformat'):
                item['added_at'] = item['added_at'].isoformat()
            if 'failed_at' in item and hasattr(item['failed_at'], 'isoformat'):
                item['failed_at'] = item['failed_at'].isoformat()
        
        return failed
    
    async def retry_failed_items(self):
        """Retry all failed items"""
        try:
            failed = await self.db.sync_queue.find({'status': 'failed'}).to_list(length=1000)
            
            logger.info(f"🔄 Retrying {len(failed)} failed items...")
            
            for item in failed:
                # Reset retry count and re-queue
                item['retries'] = 0
                await self.add_to_queue(
                    item['entity_type'],
                    item['entity_id'],
                    priority=1  # High priority for retries
                )
            
            return {'success': True, 'retried': len(failed)}
            
        except Exception as e:
            logger.error(f"❌ Retry failed items error: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    async def clear_queue(self):
        """Clear all items from queue"""
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
            except:
                break
        
        await self.db.sync_queue.delete_many({'status': {'$in': ['queued', 'retrying']}})
        logger.info("🗑️  Queue cleared")
        return {'success': True, 'message': 'Queue cleared'}

# Global instance
sync_queue = None

def init_sync_queue(db: AsyncIOMotorDatabase):
    """Initialize sync queue with database"""
    global sync_queue
    sync_queue = SyncQueue(db)
    
    # Start queue processor in background
    asyncio.create_task(sync_queue.process_queue())
    
    logger.info("✅ Sync Queue initialized and processor started")
    return sync_queue
