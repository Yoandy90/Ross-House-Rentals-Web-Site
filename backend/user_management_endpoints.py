"""
User Management Endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime
from passlib.context import CryptContext
import secrets

from user_management_models import (
    UserCreate, UserUpdate, PasswordReset, UserResponse, UserListResponse
)
from roles_permissions import UserRole, get_user_permissions, Permission, has_permission

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def init_user_management_endpoints(
    app,
    router: APIRouter,
    db: AsyncIOMotorDatabase,
    require_admin_func,
    get_current_user_func
):
    """Initialize user management endpoints"""
    
    # Helper function to check if user is admin
    async def require_admin_permission(current_user: dict = Depends(get_current_user_func)):
        if not has_permission(current_user.get('role'), Permission.MANAGE_USERS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can manage users"
            )
        return current_user
    
    
    @router.get("/admin/users", response_model=UserListResponse, tags=["User Management"])
    async def list_users(current_user: dict = Depends(require_admin_permission)):
        """List all admin and assistant users"""
        try:
            # Get all users with admin roles
            users = await db.users.find({
                "role": {"$in": [UserRole.ADMIN.value, UserRole.OFFICE_ASSISTANT.value]}
            }).to_list(length=None)
            
            # Convert to response format
            user_responses = []
            for user in users:
                user['id'] = str(user['_id'])
                user['permissions'] = get_user_permissions(user.get('role', ''))
                user_responses.append(UserResponse(**user))
            
            # Count by role
            admins_count = sum(1 for u in users if u.get('role') == UserRole.ADMIN.value)
            assistants_count = sum(1 for u in users if u.get('role') == UserRole.OFFICE_ASSISTANT.value)
            
            return UserListResponse(
                users=user_responses,
                total=len(users),
                admins_count=admins_count,
                assistants_count=assistants_count
            )
        except Exception as e:
            print(f"Error listing users: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    
    @router.post("/admin/users", response_model=UserResponse, tags=["User Management"])
    async def create_user(user_data: UserCreate, current_user: dict = Depends(require_admin_permission)):
        """Create a new admin or assistant user"""
        try:
            # Check if email already exists
            existing_user = await db.users.find_one({"email": user_data.email})
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Hash password
            hashed_password = pwd_context.hash(user_data.password)
            
            # Create user document
            user_doc = {
                "name": user_data.name,
                "email": user_data.email,
                "password_hash": hashed_password,
                "role": user_data.role.value,
                "phone": user_data.phone,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "created_by": current_user['id'],
                "last_login": None,
            }
            
            # Insert into database
            result = await db.users.insert_one(user_doc)
            user_doc['id'] = str(result.inserted_id)
            user_doc['permissions'] = get_user_permissions(user_data.role.value)
            
            print(f"✅ User created: {user_data.email} with role {user_data.role.value}")
            
            return UserResponse(**user_doc)
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error creating user: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    
    @router.get("/admin/users/{user_id}", response_model=UserResponse, tags=["User Management"])
    async def get_user(user_id: str, current_user: dict = Depends(require_admin_permission)):
        """Get a specific user"""
        try:
            from bson import ObjectId
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            user['id'] = str(user['_id'])
            user['permissions'] = get_user_permissions(user.get('role', ''))
            return UserResponse(**user)
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error getting user: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    
    @router.put("/admin/users/{user_id}", response_model=UserResponse, tags=["User Management"])
    async def update_user(
        user_id: str,
        user_data: UserUpdate,
        current_user: dict = Depends(require_admin_permission)
    ):
        """Update a user"""
        try:
            from bson import ObjectId
            
            # Don't allow user to change their own role
            if user_id == current_user['id'] and user_data.role is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change your own role"
                )
            
            # Find user - try string ID first, then ObjectId
            user = await db.users.find_one({'_id': user_id})
            if not user:
                try:
                    user = await db.users.find_one({'_id': ObjectId(user_id)})
                except Exception:
                    pass
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            actual_id = user['_id']
            
            # Build update dict
            update_data = {}
            if user_data.name is not None:
                update_data['name'] = user_data.name
            if user_data.email is not None:
                # Check if email already exists
                existing = await db.users.find_one({
                    "email": user_data.email,
                    "_id": {"$ne": actual_id}
                })
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email already in use"
                    )
                update_data['email'] = user_data.email
            if user_data.role is not None:
                update_data['role'] = user_data.role.value
            if user_data.phone is not None:
                update_data['phone'] = user_data.phone
            if user_data.is_active is not None:
                update_data['is_active'] = user_data.is_active
            
            if not update_data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update"
                )
            
            update_data['updated_at'] = datetime.utcnow()
            update_data['updated_by'] = current_user['id']
            
            # Update user
            result = await db.users.update_one(
                {"_id": actual_id},
                {"$set": update_data}
            )
            
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Get updated user
            user = await db.users.find_one({"_id": actual_id})
            user['id'] = str(user['_id'])
            user['permissions'] = get_user_permissions(user.get('role', ''))
            
            print(f"✅ User updated: {user_id}")
            
            return UserResponse(**user)
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error updating user: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    
    @router.delete("/admin/users/{user_id}", tags=["User Management"])
    async def delete_user(user_id: str, current_user: dict = Depends(require_admin_permission)):
        """Delete a user"""
        try:
            from bson import ObjectId
            
            # Don't allow user to delete themselves
            if user_id == current_user['id']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete your own account"
                )
            
            # Check if user exists
            user = await db.users.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Delete user
            await db.users.delete_one({"_id": ObjectId(user_id)})
            
            print(f"✅ User deleted: {user_id}")
            
            return {"success": True, "message": "User deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error deleting user: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    
    @router.post("/admin/users/{user_id}/reset-password", tags=["User Management"])
    async def reset_user_password(
        user_id: str,
        password_data: PasswordReset,
        current_user: dict = Depends(require_admin_permission)
    ):
        """Reset a user's password"""
        try:
            from bson import ObjectId
            
            # Check if user exists - try string ID first (UUID format)
            user = await db.users.find_one({"_id": user_id})
            
            # If not found, try ObjectId format
            if not user and len(user_id) == 24:
                try:
                    user = await db.users.find_one({"_id": ObjectId(user_id)})
                except:
                    pass
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Hash new password
            hashed_password = pwd_context.hash(password_data.new_password)
            
            # Update password using the actual _id from the found user
            actual_id = user.get('_id')
            await db.users.update_one(
                {"_id": actual_id},
                {"$set": {
                    "password_hash": hashed_password,  # FIXED: Use password_hash to match login verification
                    "password_reset_at": datetime.utcnow(),
                    "password_reset_by": current_user['id']
                }}
            )
            
            print(f"✅ Password reset for user: {user_id}")
            
            return {"success": True, "message": "Password reset successfully"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error resetting password: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    
    @router.get("/admin/users/me/permissions", tags=["User Management"])
    async def get_my_permissions(current_user: dict = Depends(get_current_user_func)):
        """Get current user's permissions"""
        try:
            permissions = get_user_permissions(current_user.get('role', ''))
            return {
                "user_id": current_user['id'],
                "role": current_user.get('role'),
                "permissions": permissions
            }
        except Exception as e:
            print(f"Error getting permissions: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    print("✅ User management endpoints initialized")
