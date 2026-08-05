"""
Password Reset Endpoints
Public endpoints for password recovery flow
"""
from fastapi import APIRouter, HTTPException
from password_reset_models import (
    ForgotPasswordRequest,
    VerifyResetCodeRequest,
    ResetPasswordRequest,
    PasswordResetResponse
)
import password_reset_service as prs_module
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/auth/forgot-password', response_model=PasswordResetResponse, tags=['Authentication'])
async def forgot_password(request: ForgotPasswordRequest):
    """
    Initiate password reset process
    - Sends a 6-digit code to user's email or phone (SMS)
    - Code expires in 15 minutes
    """
    try:
        if not prs_module.password_reset_service:
            raise HTTPException(
                status_code=500,
                detail='Password reset service not initialized'
            )
        
        result = await prs_module.password_reset_service.initiate_password_reset(
            email=request.email,
            phone_number=request.phone_number
        )
        
        return PasswordResetResponse(
            success=result['success'],
            message=result['message'],
            code_sent=result.get('code_sent', False),
            method=result.get('method', 'email')
        )
        
    except Exception as e:
        logger.error(f"❌ Error in forgot_password endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail='Error al procesar la solicitud de recuperación'
        )


@router.post('/auth/verify-reset-code', response_model=PasswordResetResponse, tags=['Authentication'])
async def verify_reset_code(request: VerifyResetCodeRequest):
    """
    Verify password reset code
    - Validates the 6-digit code
    - Checks if code has expired
    """
    try:
        if not prs_module.password_reset_service:
            raise HTTPException(
                status_code=500,
                detail='Password reset service not initialized'
            )
        
        # Use email or phone to find the reset request
        identifier = request.email if request.email else request.phone_number
        
        result = await prs_module.password_reset_service.verify_reset_code(
            identifier,
            request.code
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=400,
                detail=result['message']
            )
        
        return PasswordResetResponse(
            success=result['success'],
            message=result['message']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in verify_reset_code endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail='Error al verificar el código'
        )


@router.post('/auth/reset-password', response_model=PasswordResetResponse, tags=['Authentication'])
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password with verified code
    - Updates user password
    - Invalidates all existing sessions
    """
    try:
        if not prs_module.password_reset_service:
            raise HTTPException(
                status_code=500,
                detail='Password reset service not initialized'
            )
        
        # Use email or phone to find the reset request
        identifier = request.email if request.email else request.phone_number
        
        result = await prs_module.password_reset_service.reset_password(
            identifier,
            request.code,
            request.new_password
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=400,
                detail=result['message']
            )
        
        return PasswordResetResponse(
            success=result['success'],
            message=result['message']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in reset_password endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail='Error al restablecer la contraseña'
        )


logger.info("✅ Password Reset endpoints initialized")
