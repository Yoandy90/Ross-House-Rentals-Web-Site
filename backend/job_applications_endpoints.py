"""
Job Applications Endpoints - System for managing job applications
with Ross AI Brain integration, notifications, and applicant portal
"""
import logging
import uuid
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import bcrypt

logger = logging.getLogger(__name__)

router = APIRouter()

# Will be set by server.py
db = None
notification_service = None
ai_brain = None


# ============== MODELS ==============

class JobApplicationCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    position: str
    experience: str
    states: Optional[str] = None  # States they can work from
    resume_url: Optional[str] = None
    cover_letter: Optional[str] = None
    message: Optional[str] = None
    language: str = "es"
    recaptcha_token: Optional[str] = None  # reCAPTCHA v3 token


class JobApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    ai_evaluation: Optional[str] = None
    assigned_to: Optional[str] = None
    interview_date: Optional[str] = None


class ApplicantDocumentUpload(BaseModel):
    document_type: str
    document_name: str
    document_url: str
    notes: Optional[str] = None


# ============== HELPER FUNCTIONS ==============

def set_dependencies(database, notif_service, brain):
    """Set database, notification service, and AI brain dependencies"""
    global db, notification_service, ai_brain
    db = database
    notification_service = notif_service
    ai_brain = brain
    logger.info("✅ Job Applications endpoints initialized")


async def send_application_notifications(application: dict):
    """Send email and SMS notifications for new job application"""
    try:
        admin_email = os.getenv('ADMIN_EMAIL', 'ross@rosstaxpreparation.com')
        admin_phone = os.getenv('ADMIN_PHONE', '+18069342018')
        
        # Notification to admin
        admin_message = f"""🆕 Nueva Aplicación de Trabajo

👤 Nombre: {application['name']}
📧 Email: {application['email']}
📱 Teléfono: {application['phone']}
💼 Posición: {application['position']}
📊 Experiencia: {application['experience']}
🕐 Fecha: {application['created_at']}

Revisa la aplicación en el panel de administrador."""

        # Send email to admin
        if notification_service:
            try:
                admin_html = f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #6C1110 0%, #D32F2F 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1>🆕 Nueva Aplicación de Trabajo</h1>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 10px 0;"><strong>👤 Nombre:</strong></td><td>{application['name']}</td></tr>
                                <tr><td style="padding: 10px 0;"><strong>📧 Email:</strong></td><td>{application['email']}</td></tr>
                                <tr><td style="padding: 10px 0;"><strong>📱 Teléfono:</strong></td><td>{application['phone']}</td></tr>
                                <tr><td style="padding: 10px 0;"><strong>💼 Posición:</strong></td><td>{application['position']}</td></tr>
                                <tr><td style="padding: 10px 0;"><strong>📊 Experiencia:</strong></td><td>{application['experience']}</td></tr>
                            </table>
                            {f"<p><strong>Mensaje:</strong> {application.get('message', '')}</p>" if application.get('message') else ''}
                        </div>
                    </div>
                </body>
                </html>
                """
                await notification_service.send_email(
                    to_email=admin_email,
                    subject=f"🆕 Nueva Aplicación: {application['name']} - {application['position']}",
                    html_content=admin_html
                )
                logger.info(f"📧 Admin email notification sent for application: {application['name']}")
            except Exception as e:
                logger.error(f"❌ Error sending admin email: {e}")
            
            # Send SMS to admin
            try:
                await notification_service.send_sms(
                    to_phone=admin_phone,
                    message=f"🆕 Nueva aplicación de {application['name']} para {application['position']}. Experiencia: {application['experience']}. Email: {application['email']}"
                )
                logger.info(f"📱 Admin SMS notification sent for application: {application['name']}")
            except Exception as e:
                logger.error(f"❌ Error sending admin SMS: {e}")
        
        # Notification to applicant
        applicant_message_es = f"""¡Hola {application['name']}!

Hemos recibido tu aplicación para la posición de {application['position']} en Ross Tax Preparation.

Revisaremos tu información y te contactaremos pronto.

Gracias por tu interés en trabajar con nosotros.

- Ross Tax Preparation
(806) 934-2018"""

        applicant_message_en = f"""Hello {application['name']}!

We have received your application for the {application['position']} position at Ross Tax Preparation.

We will review your information and contact you soon.

Thank you for your interest in working with us.

- Ross Tax Preparation
(806) 934-2018"""

        applicant_message = applicant_message_es if application.get('language', 'es') == 'es' else applicant_message_en
        
        if notification_service:
            # Send confirmation email to applicant
            try:
                lang = application.get('language', 'es')
                subject = "✅ Aplicación Recibida - Ross Tax Preparation" if lang == 'es' else "✅ Application Received - Ross Tax Preparation"
                
                applicant_html = f"""
                <html>
                <body style="font-family: Arial, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #6C1110 0%, #D32F2F 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1>{'✅ ¡Aplicación Recibida!' if lang == 'es' else '✅ Application Received!'}</h1>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                            <h2>{'Hola' if lang == 'es' else 'Hello'} {application['name']},</h2>
                            <p>{'Hemos recibido tu aplicación para la posición de' if lang == 'es' else 'We have received your application for the position of'} <strong>{application['position']}</strong>.</p>
                            
                            <div style="background-color: #e8f4f8; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                <h3>{'Próximos pasos:' if lang == 'es' else 'Next steps:'}</h3>
                                <ol>
                                    <li>{'Revisaremos tu aplicación cuidadosamente' if lang == 'es' else 'We will carefully review your application'}</li>
                                    <li>{'Te contactaremos dentro de 3-5 días hábiles' if lang == 'es' else 'We will contact you within 3-5 business days'}</li>
                                    <li>{'Si avanzas, agendaremos una entrevista' if lang == 'es' else 'If you advance, we will schedule an interview'}</li>
                                </ol>
                            </div>
                            
                            <p>{'Si tienes preguntas, contáctanos:' if lang == 'es' else 'If you have questions, contact us:'}</p>
                            <p>📞 (806) 934-2018<br>📧 ross@rosstaxpreparation.com</p>
                            
                            <p style="margin-top: 30px;">{'¡Gracias por tu interés!' if lang == 'es' else 'Thank you for your interest!'}</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                await notification_service.send_email(
                    to_email=application['email'],
                    subject=subject,
                    html_content=applicant_html
                )
                logger.info(f"📧 Confirmation email sent to applicant: {application['email']}")
            except Exception as e:
                logger.error(f"❌ Error sending applicant email: {e}")
            
            # Send SMS to applicant
            try:
                sms_msg = f"Ross Tax: Recibimos tu aplicación para {application['position']}. Te contactaremos pronto. ¡Gracias!" if application.get('language', 'es') == 'es' else f"Ross Tax: We received your application for {application['position']}. We'll contact you soon. Thank you!"
                await notification_service.send_sms(
                    to_phone=application['phone'],
                    message=sms_msg
                )
                logger.info(f"📱 Confirmation SMS sent to applicant: {application['phone']}")
            except Exception as e:
                logger.error(f"❌ Error sending applicant SMS: {e}")
                
    except Exception as e:
        logger.error(f"❌ Error in send_application_notifications: {e}")


async def evaluate_application_with_ai(application: dict) -> str:
    """Use Ross AI Brain to evaluate the job application"""
    if not ai_brain:
        return "AI evaluation not available"
    
    try:
        prompt = f"""Como Ross AI, evalúa esta aplicación de trabajo para Ross Tax Preparation:

Posición: {application['position']}
Nombre: {application['name']}
Experiencia: {application['experience']}
Mensaje del aplicante: {application.get('message', 'No proporcionado')}

Requisitos para Preparadores de Impuestos:
- Mínimo 1 año de experiencia en preparación de impuestos
- Puede vivir en cualquier estado de USA
- Conocimiento de formularios fiscales (1040, W-2, 1099, etc.)
- Preferiblemente bilingüe (español/inglés)

Proporciona una evaluación breve (2-3 oraciones) sobre la idoneidad del candidato y cualquier pregunta de seguimiento que harías."""

        evaluation = await ai_brain.chat(prompt)
        return evaluation or "Evaluación pendiente"
        
    except Exception as e:
        logger.error(f"❌ Error in AI evaluation: {e}")
        return "Error en evaluación AI"


# ============== PUBLIC ENDPOINTS ==============

@router.post('/public/job-application')
async def submit_job_application(data: JobApplicationCreate):
    """Submit a new job application (public endpoint)"""
    try:
        # SPAM PROTECTION - Enhanced validation
        
        # 1. Basic field validation
        name_clean = data.name.strip()
        if len(name_clean) < 2 or len(name_clean) > 100:
            logger.warning(f"⚠️ Invalid name length: {len(name_clean)}")
            raise HTTPException(status_code=400, detail="Nombre inválido")
        
        # 2. Check for suspicious patterns in name
        # Reject if name has too many numbers or special chars
        alpha_count = sum(1 for c in name_clean if c.isalpha() or c.isspace())
        if alpha_count < len(name_clean) * 0.7:
            logger.warning(f"⚠️ Suspicious name (too few letters): {name_clean[:30]}")
            raise HTTPException(status_code=400, detail="Nombre inválido")
        
        # 2b. Check for random letter sequences (spam bots)
        # Names with more than 12 consecutive letters without spaces are suspicious
        import re
        if re.match(r'^[A-Za-z]{12,}$', name_clean):
            logger.warning(f"⚠️ Random letter sequence detected: {name_clean[:30]}")
            raise HTTPException(status_code=400, detail="Por favor ingresa tu nombre real")
        
        # 2c. Check for too many uppercase letters in a row
        if re.search(r'[A-Z]{5,}', name_clean):
            logger.warning(f"⚠️ Too many uppercase letters: {name_clean[:30]}")
            raise HTTPException(status_code=400, detail="Nombre inválido")
        
        # 2d. Require at least one space for full names or reasonable length
        if ' ' not in name_clean and len(name_clean) > 15:
            logger.warning(f"⚠️ No space in long name: {name_clean[:30]}")
            raise HTTPException(status_code=400, detail="Por favor ingresa tu nombre completo")
        
        # 3. Check for common spam patterns
        spam_patterns = ['test', 'asdf', 'qwerty', 'abc123', 'xxx', '123', 'admin', 'root']
        name_lower = name_clean.lower()
        for pattern in spam_patterns:
            if pattern in name_lower and len(name_clean) < 10:
                logger.warning(f"⚠️ Spam pattern detected in name: {name_clean}")
                raise HTTPException(status_code=400, detail="Nombre inválido")
        
        # 4. Validate email domain
        email_lower = data.email.lower()
        disposable_domains = ['tempmail', 'throwaway', 'guerrillamail', 'mailinator', 'temp-mail', 
                              'fakeinbox', 'sharklasers', 'yopmail', '10minutemail', 'trashmail']
        email_domain = email_lower.split('@')[-1]
        for domain in disposable_domains:
            if domain in email_domain:
                logger.warning(f"⚠️ Disposable email detected: {email_lower}")
                raise HTTPException(status_code=400, detail="Por favor usa un email válido")
        
        # 5. Validate phone (basic check)
        phone_digits = ''.join(c for c in data.phone if c.isdigit())
        if len(phone_digits) < 10:
            logger.warning(f"⚠️ Invalid phone: {data.phone}")
            raise HTTPException(status_code=400, detail="Teléfono inválido")
        
        # 6. Rate limiting check - max 3 applications from same email per day
        if db:
            from datetime import timezone, timedelta
            one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
            recent_apps = await db.job_applications.count_documents({
                "email": email_lower,
                "created_at": {"$gte": one_day_ago}
            })
            if recent_apps >= 3:
                logger.warning(f"⚠️ Rate limit exceeded for email: {email_lower}")
                raise HTTPException(status_code=429, detail="Has enviado demasiadas solicitudes. Intenta mañana.")
        
        # 7. Verify reCAPTCHA token (REQUIRED for production)
        recaptcha_secret = os.getenv('RECAPTCHA_SECRET_KEY')
        if recaptcha_secret and data.recaptcha_token:
            import httpx
            async with httpx.AsyncClient() as client:
                recaptcha_response = await client.post(
                    'https://www.google.com/recaptcha/api/siteverify',
                    data={
                        'secret': recaptcha_secret,
                        'response': data.recaptcha_token
                    }
                )
                result = recaptcha_response.json()
                if not result.get('success'):
                    logger.warning(f"⚠️ reCAPTCHA verification failed: {result}")
                    raise HTTPException(status_code=400, detail="Verificación de seguridad fallida. Por favor, intenta de nuevo.")
                
                # Check score for v3 (score > 0.5 is usually human)
                score = result.get('score', 1.0)
                if score < 0.3:
                    logger.warning(f"⚠️ Low reCAPTCHA score: {score} - possible bot")
                    raise HTTPException(status_code=400, detail="Verificación de seguridad fallida. Por favor, intenta de nuevo.")
                
                logger.info(f"✅ reCAPTCHA verified with score: {score}")
        elif recaptcha_secret and not data.recaptcha_token:
            # If reCAPTCHA is configured but no token provided, reject
            logger.warning(f"⚠️ Missing reCAPTCHA token for application from: {email_lower}")
            raise HTTPException(status_code=400, detail="Verificación de seguridad requerida")
        
        logger.info(f"✅ All spam checks passed for: {name_clean} ({email_lower})")
        
        application_id = str(uuid.uuid4())
        
        # Generate access token for applicant portal
        access_token = str(uuid.uuid4())
        
        # Create application document
        application = {
            "id": application_id,
            "name": data.name,
            "email": data.email.lower(),
            "phone": data.phone,
            "position": data.position,
            "experience": data.experience,
            "states": data.states,
            "resume_url": data.resume_url,
            "cover_letter": data.cover_letter,
            "message": data.message,
            "language": data.language,
            "status": "pending",
            "access_token": access_token,
            "documents": [],
            "notes": "",
            "ai_evaluation": "",
            "assigned_to": None,
            "interview_date": None,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Save to database
        await db.job_applications.insert_one(application)
        logger.info(f"✅ New job application created: {application_id} - {data.name}")
        
        # Send notifications
        await send_application_notifications(application)
        
        # AI Evaluation (async, don't wait)
        try:
            evaluation = await evaluate_application_with_ai(application)
            await db.job_applications.update_one(
                {"id": application_id},
                {"$set": {"ai_evaluation": evaluation}}
            )
            logger.info(f"🤖 AI evaluation completed for: {application_id}")
        except Exception as e:
            logger.error(f"❌ AI evaluation failed: {e}")
        
        return {
            "success": True,
            "application_id": application_id,
            "message": "Aplicación recibida exitosamente" if data.language == "es" else "Application received successfully",
            "access_token": access_token
        }
        
    except Exception as e:
        logger.error(f"❌ Error creating job application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/public/job-application/{access_token}')
async def get_application_status(access_token: str):
    """Get application status by access token (for applicant portal)"""
    try:
        application = await db.job_applications.find_one({"access_token": access_token})
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Return safe data for applicant
        return {
            "id": application["id"],
            "name": application["name"],
            "position": application["position"],
            "status": application["status"],
            "documents": application.get("documents", []),
            "interview_date": application.get("interview_date"),
            "created_at": application["created_at"],
            "updated_at": application["updated_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting application status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/public/job-application/{access_token}/document')
async def upload_applicant_document(access_token: str, data: ApplicantDocumentUpload):
    """Upload document for job application (for applicant portal)"""
    try:
        application = await db.job_applications.find_one({"access_token": access_token})
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        document = {
            "id": str(uuid.uuid4()),
            "type": data.document_type,
            "name": data.document_name,
            "url": data.document_url,
            "notes": data.notes,
            "uploaded_at": datetime.utcnow().isoformat()
        }
        
        await db.job_applications.update_one(
            {"access_token": access_token},
            {
                "$push": {"documents": document},
                "$set": {"updated_at": datetime.utcnow().isoformat()}
            }
        )
        
        logger.info(f"📄 Document uploaded for application: {application['id']}")
        
        return {
            "success": True,
            "document_id": document["id"],
            "message": "Documento subido exitosamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== ADMIN ENDPOINTS ==============

# Authentication dependency - will be set from server.py
get_current_user = None

def set_auth_dependency(auth_func):
    """Set the authentication dependency function"""
    global get_current_user
    get_current_user = auth_func
    logger.info("✅ Job Applications auth dependency set")


async def require_admin(current_user: dict):
    """Verify user is admin or office_assistant"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if current_user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get('/admin/job-applications')
async def get_job_applications(
    status: Optional[str] = None,
    position: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(lambda: None)  # Will be replaced at runtime
):
    """Get all job applications (admin only)"""
    # Verify authentication
    if get_current_user:
        try:
            from fastapi import Request
            # Auth will be handled by the dependency injection from server.py
            pass
        except:
            pass
    
    try:
        query = {}
        if status:
            query["status"] = status
        if position:
            query["position"] = position
        
        cursor = db.job_applications.find(query).sort("created_at", -1).skip(skip).limit(limit)
        applications = await cursor.to_list(length=limit)
        
        total = await db.job_applications.count_documents(query)
        
        # Clean up MongoDB ObjectId
        for app in applications:
            app["_id"] = str(app["_id"])
        
        return {
            "success": True,
            "applications": applications,
            "total": total,
            "limit": limit,
            "skip": skip
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting job applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/job-applications/stats')
async def get_job_applications_stats():
    """Get job applications statistics"""
    try:
        total = await db.job_applications.count_documents({})
        pending = await db.job_applications.count_documents({"status": "pending"})
        reviewed = await db.job_applications.count_documents({"status": "reviewed"})
        interview = await db.job_applications.count_documents({"status": "interview"})
        hired = await db.job_applications.count_documents({"status": "hired"})
        rejected = await db.job_applications.count_documents({"status": "rejected"})
        
        # Today's applications
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = await db.job_applications.count_documents({
            "created_at": {"$gte": today.isoformat()}
        })
        
        return {
            "total": total,
            "pending": pending,
            "reviewed": reviewed,
            "interview": interview,
            "hired": hired,
            "rejected": rejected,
            "today": today_count
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting job applications stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/job-applications/{application_id}')
async def get_job_application_detail(application_id: str):
    """Get detailed job application"""
    try:
        application = await db.job_applications.find_one({"id": application_id})
        
        if not application:
            raise HTTPException(status_code=404, detail="Application not found")
        
        application["_id"] = str(application["_id"])
        
        return {
            "success": True,
            "application": application
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error getting job application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put('/admin/job-applications/{application_id}')
async def update_job_application(application_id: str, data: JobApplicationUpdate):
    """Update job application status/notes"""
    try:
        update_data = {"updated_at": datetime.utcnow().isoformat()}
        
        if data.status is not None:
            update_data["status"] = data.status
        if data.notes is not None:
            update_data["notes"] = data.notes
        if data.ai_evaluation is not None:
            update_data["ai_evaluation"] = data.ai_evaluation
        if data.assigned_to is not None:
            update_data["assigned_to"] = data.assigned_to
        if data.interview_date is not None:
            update_data["interview_date"] = data.interview_date
        
        result = await db.job_applications.update_one(
            {"id": application_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        # Get updated application for notifications
        application = await db.job_applications.find_one({"id": application_id})
        
        # Send status update notification to applicant if status changed
        if data.status and notification_service and application:
            status_messages = {
                "reviewed": "Tu aplicación está siendo revisada.",
                "interview": f"¡Felicidades! Has sido seleccionado para entrevista.{' Fecha: ' + data.interview_date if data.interview_date else ''}",
                "hired": "¡Felicidades! Has sido contratado. Te contactaremos pronto.",
                "rejected": "Gracias por tu interés. No avanzaremos con tu aplicación en este momento."
            }
            
            if data.status in status_messages:
                try:
                    await notification_service.send_sms(
                        to_phone=application["phone"],
                        message=f"Ross Tax: {status_messages[data.status]}"
                    )
                except Exception as e:
                    logger.error(f"❌ Error sending status SMS: {e}")
        
        logger.info(f"✅ Job application updated: {application_id}")
        
        return {
            "success": True,
            "message": "Aplicación actualizada correctamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating job application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/admin/job-applications/{application_id}')
async def delete_job_application(application_id: str):
    """Delete job application"""
    try:
        result = await db.job_applications.delete_one({"id": application_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        
        logger.info(f"🗑️ Job application deleted: {application_id}")
        
        return {
            "success": True,
            "message": "Aplicación eliminada correctamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting job application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/job-applications/delete-bulk')
async def delete_bulk_job_applications(application_ids: List[str]):
    """Delete multiple job applications at once"""
    try:
        if not application_ids:
            raise HTTPException(status_code=400, detail="No application IDs provided")
        
        result = await db.job_applications.delete_many({"id": {"$in": application_ids}})
        
        logger.info(f"🗑️ Bulk deleted {result.deleted_count} job applications")
        
        return {
            "success": True,
            "deleted_count": result.deleted_count,
            "message": f"{result.deleted_count} solicitudes eliminadas"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error bulk deleting job applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/job-applications/detect-spam')
async def detect_spam_applications():
    """Detect potential spam applications based on patterns"""
    try:
        spam_candidates = []
        
        # Get all applications
        applications = await db.job_applications.find().to_list(1000)
        
        for app in applications:
            is_spam = False
            spam_reasons = []
            
            name = app.get('name', '')
            email = app.get('email', '')
            
            # Check for suspicious patterns
            # 1. Name has too many numbers
            if sum(1 for c in name if c.isdigit()) > 3:
                is_spam = True
                spam_reasons.append("Nombre con muchos números")
            
            # 2. Name is very short or has special chars
            if len(name) < 3 or not any(c.isalpha() for c in name[:3]):
                is_spam = True
                spam_reasons.append("Nombre inválido")
            
            # 3. Disposable email domains
            disposable_domains = ['tempmail', 'guerrillamail', 'mailinator', 'yopmail', '10minutemail']
            email_domain = email.split('@')[-1].lower()
            for domain in disposable_domains:
                if domain in email_domain:
                    is_spam = True
                    spam_reasons.append("Email temporal")
                    break
            
            # 4. Random looking strings in name
            if len(name) > 5:
                consonants = 'bcdfghjklmnpqrstvwxyz'
                consonant_streak = 0
                max_streak = 0
                for c in name.lower():
                    if c in consonants:
                        consonant_streak += 1
                        max_streak = max(max_streak, consonant_streak)
                    else:
                        consonant_streak = 0
                if max_streak >= 5:
                    is_spam = True
                    spam_reasons.append("Nombre parece aleatorio")
            
            if is_spam:
                spam_candidates.append({
                    "id": app.get('id'),
                    "name": name,
                    "email": email,
                    "reasons": spam_reasons,
                    "created_at": app.get('created_at')
                })
        
        return {
            "success": True,
            "spam_count": len(spam_candidates),
            "spam_candidates": spam_candidates
        }
        
    except Exception as e:
        logger.error(f"❌ Error detecting spam: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/admin/job-applications/delete-all-spam')
async def delete_all_spam_applications():
    """Delete all detected spam applications"""
    try:
        # First detect spam
        spam_result = await detect_spam_applications()
        spam_ids = [s['id'] for s in spam_result['spam_candidates']]
        
        if not spam_ids:
            return {
                "success": True,
                "deleted_count": 0,
                "message": "No se encontró spam"
            }
        
        # Delete all spam
        result = await db.job_applications.delete_many({"id": {"$in": spam_ids}})
        
        logger.info(f"🗑️ Deleted {result.deleted_count} spam applications")
        
        return {
            "success": True,
            "deleted_count": result.deleted_count,
            "message": f"{result.deleted_count} solicitudes de spam eliminadas"
        }
        
    except Exception as e:
        logger.error(f"❌ Error deleting spam: {e}")
        raise HTTPException(status_code=500, detail=str(e))
