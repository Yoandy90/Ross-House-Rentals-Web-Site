"""
Startup Migrations
One-time data migrations that run on server boot.
Extracted from server.py for cleanliness.
"""
import asyncio
import logging
import os
import subprocess


async def migrate_immigration_users(db):
    """Auto-migrate Mi Caso USA users to independent collection on startup (idempotent)."""
    try:
        existing = await db["immigration_users"].count_documents({})
        if existing > 0:
            print(f"✅ immigration_users already has {existing} records (skip migration)")
            return

        from bson import ObjectId as _ObjId
        case_uids = await db["immigration_cases"].distinct("user_id")
        case_oids = []
        case_str_ids = []
        for uid in case_uids:
            if uid:
                case_str_ids.append(str(uid))
                try:
                    case_oids.append(_ObjId(uid))
                except:
                    pass

        imm_filter = {"$or": [
            {"source": "micasousa"}, {"source": "immigration"},
            {"auth_method": "phone_otp"},
        ]}
        if case_oids:
            imm_filter["$or"].append({"_id": {"$in": case_oids}})
        if case_str_ids:
            imm_filter["$or"].append({"_id": {"$in": case_str_ids}})

        users = await db["users"].find(imm_filter).to_list(length=None)
        if not users:
            print("⚠️  No Mi Caso USA users found to migrate")
            return

        migrated = 0
        for u in users:
            try:
                if not u.get("source"):
                    u["source"] = "micasousa"
                await db["immigration_users"].insert_one(u)
                migrated += 1
            except:
                pass

        await db["immigration_users"].create_index("phone", sparse=True)
        await db["immigration_users"].create_index("email", sparse=True)
        print(f"✅ Migrated {migrated} Mi Caso USA users to immigration_users")
    except Exception as e:
        print(f"⚠️  immigration_users migration skipped: {e}")


async def import_asylum_stats(db):
    """Auto-import asylum judge stats on startup (idempotent — skips if data exists)."""
    try:
        count = await db["asylum_judge_stats"].count_documents({})
        if count > 0:
            print(f"✅ asylum_judge_stats already has {count} records (skip import)")
            return

        result = subprocess.run(
            ["python", "scripts/import_asylum_stats.py"],
            cwd="/app/backend" if os.path.exists("/app/backend/scripts") else ".",
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            print(f"✅ Asylum judge stats imported successfully")
        else:
            print(f"⚠️  Asylum import failed: {result.stderr[:200]}")
    except Exception as e:
        print(f"⚠️  Asylum stats import skipped: {e}")


def schedule_startup_migrations(db):
    """Schedule all one-time migrations as async tasks."""
    asyncio.get_event_loop().create_task(migrate_immigration_users(db))
    asyncio.get_event_loop().create_task(import_asylum_stats(db))
