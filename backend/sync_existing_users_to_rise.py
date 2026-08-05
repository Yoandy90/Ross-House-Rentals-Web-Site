"""
Script to sync existing users to Rise CRM
Run this once to initialize rise_crm_id for all existing users
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from rise_crm_sync_service import RiseCRMSyncService
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def sync_all_users():
    """Sync all existing users to Rise CRM"""
    
    # Connect to MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    logger.info(f"🔗 Connected to MongoDB: {db_name}")
    
    # Initialize Rise CRM Sync Service
    sync_service = RiseCRMSyncService(db)
    
    # Get all users without rise_crm_id
    users_without_sync = await db.users.find({
        '$or': [
            {'rise_crm_id': {'$exists': False}},
            {'rise_crm_id': None}
        ]
    }).to_list(length=None)
    
    logger.info(f"📊 Found {len(users_without_sync)} users to sync")
    
    if len(users_without_sync) == 0:
        logger.info("✅ All users already synced!")
        client.close()
        return
    
    # Sync each user
    synced_count = 0
    failed_count = 0
    
    for user in users_without_sync:
        try:
            user_id = str(user['_id'])
            email = user.get('email', 'unknown')
            name = user.get('name', 'Unknown')
            
            logger.info(f"🔄 Syncing user: {name} ({email})")
            
            result = await sync_service.sync_user_to_rise(user_id)
            
            if result.get('success'):
                synced_count += 1
                logger.info(f"  ✅ Synced successfully - Rise CRM ID: {result.get('rise_crm_id')}")
            else:
                failed_count += 1
                logger.error(f"  ❌ Failed: {result.get('error', 'Unknown error')}")
        
        except Exception as e:
            failed_count += 1
            logger.error(f"  ❌ Exception: {str(e)}")
    
    logger.info(f"\n📊 Sync Summary:")
    logger.info(f"  ✅ Successfully synced: {synced_count}")
    logger.info(f"  ❌ Failed: {failed_count}")
    logger.info(f"  📝 Total: {len(users_without_sync)}")
    
    client.close()
    
    if synced_count > 0:
        logger.info(f"\n🎉 Rise CRM integration is now active for {synced_count} users!")
    else:
        logger.warning(f"\n⚠️ No users were synced. Please check Rise CRM credentials and connectivity.")

if __name__ == "__main__":
    asyncio.run(sync_all_users())
