"""
Money Request Endpoints
Handles API routes for requesting and managing money requests between users
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from money_request_models import (
    MoneyRequest,
    CreateMoneyRequestRequest,
    RespondMoneyRequestRequest,
    MoneyRequestResponse,
    RequestStatus
)
from money_request_service import MoneyRequestService
from datetime import datetime

router = APIRouter()
money_request_service = None


def init_money_request_endpoints(db, get_current_user_func, notification_service=None):
    """Initialize money request endpoints with database, auth dependencies, and notification service"""
    global money_request_service
    money_request_service = MoneyRequestService(db, notification_service)
    
    @router.post('/money-requests', response_model=MoneyRequestResponse)
    async def create_money_request(
        request_data: CreateMoneyRequestRequest,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Create a new money request"""
        try:
            print(f"📨 Creating money request: {current_user['email']} requesting ${request_data.amount} from {request_data.recipient_identifier}")
            
            # Verify sender is authenticated
            sender_id = current_user['id']
            sender_email = current_user['email']
            sender_name = current_user.get('name', sender_email)
            
            # Create the money request
            result = await money_request_service.create_request(
                sender_id=sender_id,
                sender_email=sender_email,
                sender_name=sender_name,
                receiver_email=request_data.recipient_identifier,
                amount=request_data.amount,
                message=request_data.note
            )
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['message'])
            
            print(f"✅ Money request created successfully: {result['request_id']}")
            return MoneyRequestResponse(
                success=True,
                message=result['message'],
                request=result['request']
            )
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error creating money request: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error creating money request: {str(e)}")
    
    
    @router.get('/money-requests/sent', response_model=List[MoneyRequest])
    async def get_sent_requests(
        current_user: dict = Depends(get_current_user_func)
    ):
        """Get all money requests sent by the current user"""
        try:
            sender_id = current_user['id']
            print(f"📋 Getting sent money requests for user: {current_user['email']}")
            
            requests = await money_request_service.get_sent_requests(sender_id)
            print(f"✅ Found {len(requests)} sent requests")
            
            return requests
            
        except Exception as e:
            print(f"❌ Error getting sent requests: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error retrieving sent requests: {str(e)}")
    
    
    @router.get('/money-requests/received', response_model=List[MoneyRequest])
    async def get_received_requests(
        current_user: dict = Depends(get_current_user_func)
    ):
        """Get all money requests received by the current user"""
        try:
            receiver_id = current_user['id']
            print(f"📋 Getting received money requests for user: {current_user['email']}")
            
            requests = await money_request_service.get_received_requests(receiver_id)
            print(f"✅ Found {len(requests)} received requests")
            
            return requests
            
        except Exception as e:
            print(f"❌ Error getting received requests: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error retrieving received requests: {str(e)}")
    
    
    @router.post('/money-requests/{request_id}/approve', response_model=MoneyRequestResponse)
    async def approve_request(
        request_id: str,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Approve a money request (receiver action)"""
        try:
            receiver_id = current_user['id']
            print(f"✅ Approving money request: {request_id} by {current_user['email']}")
            
            result = await money_request_service.approve_request(
                request_id=request_id,
                receiver_id=receiver_id
            )
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['message'])
            
            print(f"✅ Money request approved successfully")
            return MoneyRequestResponse(
                success=True,
                message=result['message'],
                request=result['request']
            )
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error approving request: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error approving request: {str(e)}")
    
    
    @router.post('/money-requests/{request_id}/reject', response_model=MoneyRequestResponse)
    async def reject_request(
        request_id: str,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Reject a money request (receiver action)"""
        try:
            receiver_id = current_user['id']
            print(f"❌ Rejecting money request: {request_id} by {current_user['email']}")
            
            result = await money_request_service.reject_request(
                request_id=request_id,
                receiver_id=receiver_id
            )
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['message'])
            
            print(f"✅ Money request rejected successfully")
            return MoneyRequestResponse(
                success=True,
                message=result['message'],
                request=result['request']
            )
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error rejecting request: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error rejecting request: {str(e)}")
    
    
    @router.delete('/money-requests/{request_id}')
    async def cancel_request(
        request_id: str,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Cancel a money request (sender action)"""
        try:
            sender_id = current_user['id']
            print(f"🚫 Canceling money request: {request_id} by {current_user['email']}")
            
            result = await money_request_service.cancel_request(
                request_id=request_id,
                requester_id=sender_id
            )
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['message'])
            
            print(f"✅ Money request canceled successfully")
            return {"success": True, "message": result['message']}
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error canceling request: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error canceling request: {str(e)}")


# Export router and init function
__all__ = ['router', 'init_money_request_endpoints']
