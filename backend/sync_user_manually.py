#!/usr/bin/env python3
"""
Script to manually sync a user to Rise CRM
Usage: python sync_user_manually.py <user_id>
"""
import asyncio
import sys
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from rise_crm_sync_service import RiseCRMSyncService

load_dotenv()

async def sync_user(user_id: str):
    """Manually sync a user to Rise CRM"""
    # Connect to database
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Initialize sync service
    sync_service = RiseCRMSyncService(db)
    
    print(f"🔄 Syncing user {user_id} to Rise CRM (force=True)...")
    
    # Sync user with force=True to bypass the "already synced" check
    result = await sync_service.sync_user_to_rise(user_id, force=True)
    
    print(f"\n📊 Result:")
    print(f"  Success: {result.get('success')}")
    print(f"  Rise CRM ID: {result.get('rise_crm_id')}")
    print(f"  Action: {result.get('action')}")
    
    if not result.get('success'):
        print(f"  Error: {result.get('error')}")
    
    client.close()
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python sync_user_manually.py <user_id>")
        print("\nExample:")
        print("  python sync_user_manually.py 7c7f00c4-ae81-4e01-936c-4b13e291a887")
        sys.exit(1)
    
    user_id = sys.argv[1]
    result = asyncio.run(sync_user(user_id))
    
    if result.get('success') and result.get('rise_crm_id'):
        print(f"\n✅ User successfully synced to Rise CRM!")
        print(f"   You can now sync appointments for this user.")
    else:
        print(f"\n❌ Failed to sync user. Check the logs above.")
