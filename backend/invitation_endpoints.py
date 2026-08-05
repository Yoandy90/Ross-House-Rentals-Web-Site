"""
Invitation Endpoints - API endpoints para sistema de invitaciones
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from contacts_models import UserContactCreate, UserContactUpdate, UserContactResponse
from invitation_models import (
    GroupAppointmentCreate, 
    AttendeeComplete, 
    InvitationPublicResponse,
    DocumentUpload
)
import logging
import os
from datetime import datetime

logger = logging.getLogger(__name__)

def init_invitation_endpoints(app, router, contacts_service, invitation_service, get_current_user, require_admin):
    """Inicializa endpoints de invitaciones y contactos"""
    
    # ==================== CONTACTOS ENDPOINTS ====================
    
    @app.post('/api/contacts')
    async def create_contact(
        contact: UserContactCreate,
        current_user: dict = Depends(get_current_user)
    ):
        """Crea un nuevo contacto guardado"""
        result = await contacts_service.create_contact(
            user_id=current_user['id'],
            name=contact.name,
            phone=contact.phone,
            email=contact.email,
            relationship=contact.relationship
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result['contact']
    
    @app.get('/api/contacts')
    async def get_contacts(
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene todos los contactos del usuario"""
        contacts = await contacts_service.get_user_contacts(current_user['id'])
        return {'contacts': contacts, 'total': len(contacts)}
    
    @app.get('/api/contacts/{contact_id}')
    async def get_contact(
        contact_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Obtiene un contacto específico"""
        contact = await contacts_service.get_contact_by_id(contact_id, current_user['id'])
        if not contact:
            raise HTTPException(status_code=404, detail="Contacto no encontrado")
        return contact
    
    @app.put('/api/contacts/{contact_id}')
    async def update_contact(
        contact_id: str,
        contact: UserContactUpdate,
        current_user: dict = Depends(get_current_user)
    ):
        """Actualiza un contacto"""
        result = await contacts_service.update_contact(
            contact_id=contact_id,
            user_id=current_user['id'],
            update_data=contact.dict(exclude_none=True)
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return result
    
    @app.delete('/api/contacts/{contact_id}')
    async def delete_contact(
        contact_id: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Elimina un contacto"""
        result = await contacts_service.delete_contact(contact_id, current_user['id'])
        
        if not result['success']:
            raise HTTPException(status_code=404, detail=result['error'])
        
        return result
    
    @app.get('/api/contacts/search/{query}')
    async def search_contacts(
        query: str,
        current_user: dict = Depends(get_current_user)
    ):
        """Busca contactos"""
        contacts = await contacts_service.search_contacts(current_user['id'], query)
        return {'contacts': contacts, 'total': len(contacts)}
    
    # ==================== GROUP APPOINTMENTS ENDPOINTS ====================
    
    @app.post('/api/appointments/group')
    async def create_group_appointments(
        group_data: GroupAppointmentCreate,
        current_user: dict = Depends(get_current_user)
    ):
        """
        Crea múltiples citas para un grupo y envía invitaciones
        """
        try:
            # Preparar datos de asistentes
            attendees_data = []
            for attendee in group_data.attendees:
                attendees_data.append({
                    'name': attendee.name,
                    'phone': attendee.phone,
                    'email': attendee.email,
                    'user_contact_id': attendee.user_contact_id,
                    'is_primary_user': attendee.is_primary_user
                })
            
            # Preparar datos de cita
            appointment_data = {
                'title': group_data.title,
                'description': group_data.description,
                'scheduled_at': group_data.scheduled_at,
                'duration_minutes': group_data.duration_minutes,
                'appointment_type': group_data.appointment_type
            }
            
            # Crear citas e invitaciones
            result = await invitation_service.create_group_appointments(
                user_id=current_user['id'],
                attendees_data=attendees_data,
                appointment_data=appointment_data
            )
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['error'])
            
            return {
                'success': True,
                'appointments_created': len(result['appointments']),
                'invitations_sent': len(result['invitations']),
                'appointments': result['appointments'],
                'message': result['message']
            }
            
        except Exception as e:
            logger.error(f"Error creating group appointments: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ==================== PUBLIC INVITATION ENDPOINTS (No Auth) ====================
    
    @app.get('/api/invitation/{token}', response_model=InvitationPublicResponse)
    async def get_invitation(token: str):
        """Obtiene información de invitación (pública, sin autenticación)"""
        invitation_data = await invitation_service.get_invitation_by_token(token)
        
        if not invitation_data:
            raise HTTPException(status_code=404, detail="Invitación no encontrada")
        
        return invitation_data
    
    @app.post('/api/invitation/{token}/complete')
    async def complete_invitation(
        token: str,
        phone: Optional[str] = Form(None),
        email: Optional[str] = Form(None),
        address: Optional[str] = Form(None),
        ssn_itin: Optional[str] = Form(None),
        birthdate: Optional[str] = Form(None)
    ):
        """
        Completa una invitación, crea usuario automáticamente y envía credenciales
        (Endpoint público - no requiere autenticación)
        """
        try:
            attendee_data = {
                'phone': phone,
                'email': email,
                'address': address,
                'ssn_itin': ssn_itin,
                'birthdate': birthdate
            }
            
            # Por ahora, documentos vacíos (se subirán después)
            uploaded_documents = []
            
            result = await invitation_service.complete_invitation(
                token=token,
                attendee_data=attendee_data,
                uploaded_documents=uploaded_documents
            )
            
            if not result['success']:
                raise HTTPException(status_code=400, detail=result['error'])
            
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error completing invitation: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/invitation/{token}/upload')
    async def upload_document_to_invitation(
        token: str,
        file: UploadFile = File(...),
        document_type: str = Form(...)
    ):
        """
        Sube un documento a una invitación
        (Endpoint público - no requiere autenticación)
        """
        try:
            # Verificar que la invitación existe y no ha expirado
            invitation_data = await invitation_service.get_invitation_by_token(token)
            if not invitation_data:
                raise HTTPException(status_code=404, detail="Invitación no encontrada")
            
            if invitation_data['is_expired']:
                raise HTTPException(status_code=400, detail="Invitación expirada")
            
            # Crear directorio de documentos si no existe
            upload_dir = f"/app/backend/uploads/invitations/{invitation_data['attendee_id']}"
            os.makedirs(upload_dir, exist_ok=True)
            
            # Guardar archivo
            file_path = f"{upload_dir}/{file.filename}"
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Guardar metadata en BD
            doc_metadata = {
                'attendee_id': invitation_data['attendee_id'],
                'document_type': document_type,
                'file_path': file_path,
                'file_name': file.filename,
                'file_size': len(content),
                'uploaded_at': datetime.utcnow(),
                'uploaded_via': 'invitation'
            }
            
            await invitation_service.documents_collection.insert_one(doc_metadata)
            
            logger.info(f"✅ Document uploaded for invitation {token}")
            
            return {
                'success': True,
                'message': 'Documento subido exitosamente',
                'file_name': file.filename
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading document: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ==================== ADMIN TRACKING ENDPOINTS ====================
    
    @app.get('/api/admin/appointments/{appointment_id}/attendees')
    async def get_appointment_attendees(
        appointment_id: str,
        current_user: dict = Depends(require_admin)
    ):
        """Obtiene todos los asistentes de una cita (admin)"""
        attendees = await invitation_service.get_appointment_attendees([appointment_id])
        return {'attendees': attendees, 'total': len(attendees)}
    
    @app.get('/api/admin/group-appointments/tracking')
    async def track_group_appointments(
        date: Optional[str] = None,
        current_user: dict = Depends(require_admin)
    ):
        """
        Tracking de citas grupales para admin
        Muestra todas las citas con sus asistentes y status de invitaciones
        """
        try:
            # Obtener citas grupales
            query = {'is_group_appointment': True}
            if date:
                # Filtrar por fecha
                pass
            
            appointments = await invitation_service.appointments_collection.find(query).limit(50).to_list(length=50)
            
            # Agrupar por grupo (mismo created_by + scheduled_at similar)
            groups = {}
            for app in appointments:
                group_key = f"{app['created_by']}_{app['scheduled_at'].date()}"
                if group_key not in groups:
                    groups[group_key] = []
                
                app['id'] = str(app['_id'])
                app['_id'] = str(app['_id'])
                groups[group_key].append(app)
            
            # Para cada grupo, obtener attendees
            result = []
            for group_key, group_apps in groups.items():
                app_ids = [app['id'] for app in group_apps]
                attendees = await invitation_service.get_appointment_attendees(app_ids)
                
                result.append({
                    'group_date': group_apps[0]['scheduled_at'],
                    'total_appointments': len(group_apps),
                    'created_by': group_apps[0]['created_by'],
                    'appointments': group_apps,
                    'attendees': attendees
                })
            
            return {'groups': result, 'total_groups': len(result)}
            
        except Exception as e:
            logger.error(f"Error tracking group appointments: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # Registrar el router
    
    logger.info("✅ Invitation and Contacts endpoints initialized")
