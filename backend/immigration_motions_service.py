"""
Immigration Motions Service
Business logic for managing immigration court motions
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

from immigration_motions_models import (
    MotionType, MotionStatus, MotionCreateRequest, MotionUpdateRequest,
    RequiredDocument, StatusHistoryEntry, MotionDocument,
    MOTION_STATUS_LABELS, MOTION_TYPE_LABELS, REQUIRED_DOCUMENTS_BY_TYPE
)

logger = logging.getLogger(__name__)


class ImmigrationMotionsService:
    def __init__(self, db: AsyncIOMotorDatabase, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        self.collection = db.immigration_motions
        logger.info("✅ Immigration Motions Service initialized")
    
    def _generate_motion_number(self) -> str:
        """Generate unique motion number"""
        timestamp = datetime.utcnow().strftime("%Y%m")
        unique_id = uuid.uuid4().hex[:6].upper()
        return f"MOT-{timestamp}-{unique_id}"
    
    async def create_motion(
        self,
        request: MotionCreateRequest,
        created_by: str,
        created_by_name: str
    ) -> Dict[str, Any]:
        """Create a new immigration motion"""
        try:
            motion_id = str(uuid.uuid4())
            motion_number = self._generate_motion_number()
            now = datetime.utcnow()
            
            # Get or create client info
            client_id = request.client_id
            client_name = request.client_name
            client_email = request.client_email
            client_phone = request.client_phone
            
            if client_id:
                # Fetch existing client
                client = await self.db.users.find_one({"id": client_id})
                if client:
                    client_name = client.get("full_name", client_name)
                    client_email = client.get("email", client_email)
                    client_phone = client.get("phone", client_phone)
            else:
                client_id = str(uuid.uuid4())
            
            # Get required documents for this motion type
            required_docs = []
            for doc in REQUIRED_DOCUMENTS_BY_TYPE.get(request.motion_type, []):
                required_docs.append({
                    "document_type": doc.document_type,
                    "name": doc.name,
                    "description": doc.description,
                    "required": doc.required,
                    "uploaded": False,
                    "file_url": None,
                    "file_name": None,
                    "uploaded_at": None
                })
            
            # Create motion document
            motion = {
                "id": motion_id,
                "motion_number": motion_number,
                "motion_type": request.motion_type.value,
                "status": MotionStatus.NEW.value,
                
                # Client info
                "client_id": client_id,
                "client_name": client_name,
                "client_email": client_email,
                "client_phone": client_phone,
                
                # Motion details
                "current_address": request.current_address,
                "a_number": request.a_number,
                "current_court_id": request.current_court_id,
                "current_court": request.current_court,
                "current_court_address": request.current_court_address,
                "new_address": request.new_address,
                "destination_court_id": request.destination_court_id,
                "destination_court": request.destination_court,
                "destination_court_address": request.destination_court_address,
                
                # Family motion
                "is_family_motion": request.is_family_motion,
                "family_members": [fm.dict() for fm in request.family_members] if request.family_members else [],
                
                # Justification and host info (for transfers)
                "justification": request.justification,
                "justification_reason": request.justification_reason,
                "host_info": request.host_info.dict() if request.host_info else None,
                
                # Generated document content (will be filled when motion is drafted)
                "motion_content_en": None,  # English version
                "motion_content_es": None,  # Spanish version
                "generated_at": None,
                
                # Metadata
                "notes": request.notes,
                "admin_notes": None,
                "priority": request.priority,
                "deadline": request.deadline,
                
                # Documents
                "required_documents": required_docs,
                "uploaded_documents": [],
                
                # History
                "status_history": [{
                    "status": MotionStatus.NEW.value,
                    "changed_at": now,
                    "changed_by": created_by,
                    "changed_by_name": created_by_name,
                    "notes": "Moción creada"
                }],
                
                # Timestamps
                "created_at": now,
                "created_by": created_by,
                "created_by_name": created_by_name,
                "updated_at": now,
                "submitted_at": None,
                "resolved_at": None
            }
            
            await self.collection.insert_one(motion)
            
            # Send notification to client if email available
            if self.notification_service and client_email:
                try:
                    await self._send_creation_notification(motion)
                except Exception as e:
                    logger.error(f"Error sending motion creation notification: {e}")
            
            logger.info(f"✅ Motion created: {motion_number} for {client_name}")
            return self._format_motion(motion)
            
        except Exception as e:
            logger.error(f"Error creating motion: {e}")
            raise
    
    async def get_motion(self, motion_id: str) -> Optional[Dict[str, Any]]:
        """Get a single motion by ID"""
        motion = await self.collection.find_one({"id": motion_id})
        if motion:
            return self._format_motion(motion)
        return None
    
    async def get_motion_by_number(self, motion_number: str) -> Optional[Dict[str, Any]]:
        """Get a single motion by motion number"""
        motion = await self.collection.find_one({"motion_number": motion_number})
        if motion:
            return self._format_motion(motion)
        return None
    
    async def get_motions_by_client(self, client_id: str) -> List[Dict[str, Any]]:
        """Get all motions for a specific client"""
        cursor = self.collection.find({"client_id": client_id}).sort("created_at", -1)
        motions = await cursor.to_list(length=100)
        return [self._format_motion_list_item(m) for m in motions]
    
    async def list_motions(
        self,
        status: Optional[str] = None,
        motion_type: Optional[str] = None,
        priority: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """List motions with filters"""
        query = {}
        
        if status:
            query["status"] = status
        if motion_type:
            query["motion_type"] = motion_type
        if priority:
            query["priority"] = priority
        if search:
            query["$or"] = [
                {"motion_number": {"$regex": search, "$options": "i"}},
                {"client_name": {"$regex": search, "$options": "i"}},
                {"client_email": {"$regex": search, "$options": "i"}},
                {"a_number": {"$regex": search, "$options": "i"}}
            ]
        
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(offset).limit(limit)
        motions = await cursor.to_list(length=limit)
        
        return {
            "motions": [self._format_motion_list_item(m) for m in motions],
            "total": total,
            "limit": limit,
            "offset": offset
        }
    
    async def update_motion(
        self,
        motion_id: str,
        request: MotionUpdateRequest,
        updated_by: str,
        updated_by_name: str
    ) -> Optional[Dict[str, Any]]:
        """Update a motion"""
        motion = await self.collection.find_one({"id": motion_id})
        if not motion:
            return None
        
        now = datetime.utcnow()
        update_data = {"updated_at": now}
        
        # Update fields if provided
        if request.notes is not None:
            update_data["notes"] = request.notes
        if request.admin_notes is not None:
            update_data["admin_notes"] = request.admin_notes
        if request.priority is not None:
            update_data["priority"] = request.priority
        if request.deadline is not None:
            update_data["deadline"] = request.deadline
        if request.current_address is not None:
            update_data["current_address"] = request.current_address
        if request.new_address is not None:
            update_data["new_address"] = request.new_address
        if request.current_court is not None:
            update_data["current_court"] = request.current_court
        if request.destination_court is not None:
            update_data["destination_court"] = request.destination_court
        if request.a_number is not None:
            update_data["a_number"] = request.a_number
        
        # Handle status change
        if request.status and request.status.value != motion["status"]:
            update_data["status"] = request.status.value
            
            # Add to status history
            history_entry = {
                "status": request.status.value,
                "changed_at": now,
                "changed_by": updated_by,
                "changed_by_name": updated_by_name,
                "notes": f"Estado cambiado a {MOTION_STATUS_LABELS.get(request.status, request.status.value)}"
            }
            
            await self.collection.update_one(
                {"id": motion_id},
                {"$push": {"status_history": history_entry}}
            )
            
            # Set timestamps for specific statuses
            if request.status == MotionStatus.SUBMITTED:
                update_data["submitted_at"] = now
            elif request.status in [MotionStatus.APPROVED, MotionStatus.DENIED]:
                update_data["resolved_at"] = now
            
            # Send notification for status change
            if self.notification_service:
                try:
                    await self._send_status_notification(motion, request.status)
                    # Also send push notification
                    await self._send_push_notification(motion, request.status)
                except Exception as e:
                    logger.error(f"Error sending status notification: {e}")
        
        await self.collection.update_one(
            {"id": motion_id},
            {"$set": update_data}
        )
        
        updated_motion = await self.collection.find_one({"id": motion_id})
        return self._format_motion(updated_motion)
    
    async def add_document(
        self,
        motion_id: str,
        document_type: str,
        file_url: str,
        file_name: str,
        uploaded_by: str,
        uploaded_by_name: str
    ) -> Optional[Dict[str, Any]]:
        """Add a document to a motion"""
        motion = await self.collection.find_one({"id": motion_id})
        if not motion:
            return None
        
        now = datetime.utcnow()
        doc_id = str(uuid.uuid4())
        
        # Create document entry
        document = {
            "id": doc_id,
            "document_type": document_type,
            "name": file_name,
            "file_url": file_url,
            "file_name": file_name,
            "uploaded_by": uploaded_by,
            "uploaded_by_name": uploaded_by_name,
            "uploaded_at": now,
            "verified": False,
            "verified_by": None,
            "verified_at": None
        }
        
        # Add to uploaded documents
        await self.collection.update_one(
            {"id": motion_id},
            {
                "$push": {"uploaded_documents": document},
                "$set": {"updated_at": now}
            }
        )
        
        # Update required documents status
        await self.collection.update_one(
            {"id": motion_id, "required_documents.document_type": document_type},
            {
                "$set": {
                    "required_documents.$.uploaded": True,
                    "required_documents.$.file_url": file_url,
                    "required_documents.$.file_name": file_name,
                    "required_documents.$.uploaded_at": now
                }
            }
        )
        
        logger.info(f"📄 Document added to motion {motion_id}: {document_type}")
        
        updated_motion = await self.collection.find_one({"id": motion_id})
        return self._format_motion(updated_motion)
    
    async def verify_document(
        self,
        motion_id: str,
        document_id: str,
        verified_by: str
    ) -> Optional[Dict[str, Any]]:
        """Mark a document as verified"""
        now = datetime.utcnow()
        
        result = await self.collection.update_one(
            {"id": motion_id, "uploaded_documents.id": document_id},
            {
                "$set": {
                    "uploaded_documents.$.verified": True,
                    "uploaded_documents.$.verified_by": verified_by,
                    "uploaded_documents.$.verified_at": now,
                    "updated_at": now
                }
            }
        )
        
        if result.modified_count > 0:
            motion = await self.collection.find_one({"id": motion_id})
            return self._format_motion(motion)
        return None
    
    async def delete_document(
        self,
        motion_id: str,
        document_id: str
    ) -> bool:
        """Delete a document from a motion"""
        # Get the document first to know its type
        motion = await self.collection.find_one({"id": motion_id})
        if not motion:
            return False
        
        doc_to_delete = None
        for doc in motion.get("uploaded_documents", []):
            if doc["id"] == document_id:
                doc_to_delete = doc
                break
        
        if not doc_to_delete:
            return False
        
        # Remove from uploaded documents
        await self.collection.update_one(
            {"id": motion_id},
            {
                "$pull": {"uploaded_documents": {"id": document_id}},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        # Reset required document status
        await self.collection.update_one(
            {"id": motion_id, "required_documents.document_type": doc_to_delete["document_type"]},
            {
                "$set": {
                    "required_documents.$.uploaded": False,
                    "required_documents.$.file_url": None,
                    "required_documents.$.file_name": None,
                    "required_documents.$.uploaded_at": None
                }
            }
        )
        
        return True
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get motion statistics"""
        now = datetime.utcnow()
        
        # Total count
        total = await self.collection.count_documents({})
        
        # By status
        by_status = {}
        for status in MotionStatus:
            count = await self.collection.count_documents({"status": status.value})
            by_status[status.value] = {
                "count": count,
                "label": MOTION_STATUS_LABELS.get(status, status.value)
            }
        
        # By type
        by_type = {}
        for motion_type in MotionType:
            count = await self.collection.count_documents({"motion_type": motion_type.value})
            by_type[motion_type.value] = {
                "count": count,
                "label": MOTION_TYPE_LABELS.get(motion_type, motion_type.value)
            }
        
        # Pending documents (motions with incomplete required docs)
        pipeline = [
            {"$match": {"status": {"$nin": [MotionStatus.APPROVED.value, MotionStatus.DENIED.value, MotionStatus.CANCELLED.value]}}},
            {"$project": {
                "incomplete_docs": {
                    "$size": {
                        "$filter": {
                            "input": "$required_documents",
                            "as": "doc",
                            "cond": {"$and": [
                                {"$eq": ["$$doc.required", True]},
                                {"$eq": ["$$doc.uploaded", False]}
                            ]}
                        }
                    }
                }
            }},
            {"$match": {"incomplete_docs": {"$gt": 0}}},
            {"$count": "total"}
        ]
        pending_docs_result = await self.collection.aggregate(pipeline).to_list(1)
        pending_documents = pending_docs_result[0]["total"] if pending_docs_result else 0
        
        # Approaching deadlines (within 7 days)
        week_from_now = now + timedelta(days=7)
        approaching_deadlines = await self.collection.count_documents({
            "deadline": {"$lte": week_from_now, "$gte": now},
            "status": {"$nin": [MotionStatus.APPROVED.value, MotionStatus.DENIED.value, MotionStatus.CANCELLED.value]}
        })
        
        # Overdue
        overdue = await self.collection.count_documents({
            "deadline": {"$lt": now},
            "status": {"$nin": [MotionStatus.APPROVED.value, MotionStatus.DENIED.value, MotionStatus.CANCELLED.value]}
        })
        
        return {
            "total": total,
            "by_status": by_status,
            "by_type": by_type,
            "pending_documents": pending_documents,
            "approaching_deadlines": approaching_deadlines,
            "overdue": overdue
        }
    
    async def _send_creation_notification(self, motion: Dict[str, Any]):
        """Send notification when motion is created"""
        if not self.notification_service:
            return
        
        client_email = motion.get("client_email")
        client_name = motion.get("client_name", "Cliente")
        motion_number = motion.get("motion_number")
        motion_type_label = MOTION_TYPE_LABELS.get(
            MotionType(motion.get("motion_type")),
            motion.get("motion_type")
        )
        
        subject = f"Nueva Moción Creada - {motion_number}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #6C1110;">Ross Tax Preparation</h2>
            <p>Hola {client_name},</p>
            <p>Se ha creado una nueva moción de inmigración para su caso:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Número de Moción:</strong> {motion_number}</p>
                <p><strong>Tipo:</strong> {motion_type_label}</p>
                <p><strong>Estado:</strong> Nuevo Caso</p>
            </div>
            <p>Por favor suba los documentos requeridos lo antes posible para procesar su caso.</p>
            <p>Puede ver el estado de su moción en la aplicación Ross Tax.</p>
            <br>
            <p>Saludos,<br>Ross Tax Preparation</p>
        </body>
        </html>
        """
        
        await self.notification_service.send_email(
            to_email=client_email,
            subject=subject,
            html_content=html_content
        )
    
    async def _send_status_notification(self, motion: Dict[str, Any], new_status: MotionStatus):
        """Send notification when motion status changes"""
        if not self.notification_service:
            return
        
        client_email = motion.get("client_email")
        client_name = motion.get("client_name", "Cliente")
        motion_number = motion.get("motion_number")
        status_label = MOTION_STATUS_LABELS.get(new_status, new_status.value)
        
        subject = f"Actualización de Moción - {motion_number}"
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #6C1110;">Ross Tax Preparation</h2>
            <p>Hola {client_name},</p>
            <p>El estado de su moción ha sido actualizado:</p>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Número de Moción:</strong> {motion_number}</p>
                <p><strong>Nuevo Estado:</strong> {status_label}</p>
            </div>
            <p>Puede ver más detalles en la aplicación Ross Tax.</p>
            <br>
            <p>Saludos,<br>Ross Tax Preparation</p>
        </body>
        </html>
        """
        
        await self.notification_service.send_email(
            to_email=client_email,
            subject=subject,
            html_content=html_content
        )
    
    async def _send_push_notification(self, motion: Dict[str, Any], new_status: MotionStatus):
        """Send push notification when motion status changes"""
        try:
            client_id = motion.get("client_id")
            motion_number = motion.get("motion_number")
            status_label = MOTION_STATUS_LABELS.get(new_status, new_status.value)
            
            # Get user's push tokens
            user = await self.db.users.find_one({"id": client_id})
            if not user:
                return
            
            push_tokens = user.get("push_tokens", [])
            if not push_tokens:
                return
            
            # Prepare notification message based on status
            title = "Actualización de Moción"
            body = f"Tu moción {motion_number} está ahora: {status_label}"
            
            if new_status == MotionStatus.APPROVED:
                title = "¡Moción Aprobada!"
                body = f"¡Felicidades! Tu moción {motion_number} ha sido aprobada."
            elif new_status == MotionStatus.DENIED:
                title = "Moción Denegada"
                body = f"Tu moción {motion_number} ha sido denegada. Contacta a soporte."
            elif new_status == MotionStatus.SUBMITTED:
                title = "Moción Presentada"
                body = f"Tu moción {motion_number} ha sido presentada ante el tribunal."
            
            # Send push notification using existing system
            for token in push_tokens:
                try:
                    await self.db.push_notifications.insert_one({
                        "user_id": client_id,
                        "token": token,
                        "title": title,
                        "body": body,
                        "data": {
                            "type": "motion_status_update",
                            "motion_id": motion.get("id"),
                            "motion_number": motion_number,
                            "status": new_status.value
                        },
                        "created_at": datetime.utcnow(),
                        "sent": False
                    })
                except Exception as e:
                    logger.error(f"Error queuing push notification: {e}")
            
            logger.info(f"📱 Push notification queued for motion {motion_number}")
            
        except Exception as e:
            logger.error(f"Error sending push notification: {e}")
    
    async def create_invoice_for_motion(
        self,
        motion_id: str,
        amount: float,
        description: str,
        created_by: str,
        created_by_name: str
    ) -> Optional[Dict[str, Any]]:
        """Create an invoice for a motion service"""
        motion = await self.collection.find_one({"id": motion_id})
        if not motion:
            return None
        
        # Generate invoice number
        invoice_number = f"INV-MOT-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        
        invoice = {
            "id": str(uuid.uuid4()),
            "invoice_number": invoice_number,
            "user_id": motion.get("client_id"),
            "user_name": motion.get("client_name"),
            "user_email": motion.get("client_email"),
            "type": "immigration_motion",
            "motion_id": motion_id,
            "motion_number": motion.get("motion_number"),
            "description": description or "Servicio de Moción de Inmigración",
            "items": [{
                "description": description or "Moción de Cierre de Corte de Inmigración",
                "quantity": 1,
                "unit_price": amount,
                "total": amount
            }],
            "subtotal": amount,
            "tax": 0,
            "total": amount,
            "status": "pending",
            "due_date": datetime.utcnow() + timedelta(days=7),
            "created_at": datetime.utcnow(),
            "created_by": created_by,
            "created_by_name": created_by_name,
            "tax_year": str(datetime.utcnow().year)
        }
        
        await self.db.invoices.insert_one(invoice)
        
        # Remove MongoDB _id for JSON serialization
        if "_id" in invoice:
            del invoice["_id"]
        
        # Convert datetime objects to ISO strings
        if invoice.get("due_date"):
            invoice["due_date"] = invoice["due_date"].isoformat()
        if invoice.get("created_at"):
            invoice["created_at"] = invoice["created_at"].isoformat()
        
        # Update motion with invoice reference
        await self.collection.update_one(
            {"id": motion_id},
            {"$set": {
                "invoice_id": invoice["id"],
                "invoice_number": invoice_number,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Send notification to client
        if self.notification_service and motion.get("client_email"):
            try:
                await self.notification_service.send_email(
                    to_email=motion.get("client_email"),
                    subject=f"Nueva Factura - {invoice_number}",
                    html_content=f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #6C1110;">Ross Tax Preparation</h2>
                        <p>Hola {motion.get('client_name')},</p>
                        <p>Se ha generado una factura para su servicio de moción de inmigración:</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Número de Factura:</strong> {invoice_number}</p>
                            <p><strong>Moción:</strong> {motion.get('motion_number')}</p>
                            <p><strong>Monto:</strong> ${amount:.2f}</p>
                            <p><strong>Vencimiento:</strong> 7 días</p>
                        </div>
                        <p>Puede pagar esta factura desde la aplicación Ross Tax en la sección "Mis Facturas".</p>
                        <br>
                        <p>Saludos,<br>Ross Tax Preparation</p>
                    </body>
                    </html>
                    """
                )
            except Exception as e:
                logger.error(f"Error sending invoice notification: {e}")
        
        logger.info(f"📄 Invoice {invoice_number} created for motion {motion.get('motion_number')}")
        
        return invoice
    
    def _format_motion(self, motion: Dict[str, Any]) -> Dict[str, Any]:
        """Format motion for API response"""
        motion_type = MotionType(motion.get("motion_type"))
        status = MotionStatus(motion.get("status"))
        
        return {
            "id": motion.get("id"),
            "motion_number": motion.get("motion_number"),
            "motion_type": motion_type.value,
            "motion_type_label": MOTION_TYPE_LABELS.get(motion_type, motion_type.value),
            "status": status.value,
            "status_label": MOTION_STATUS_LABELS.get(status, status.value),
            
            "client_id": motion.get("client_id"),
            "client_name": motion.get("client_name"),
            "client_email": motion.get("client_email"),
            "client_phone": motion.get("client_phone"),
            
            "current_address": motion.get("current_address"),
            "a_number": motion.get("a_number"),
            "current_court_id": motion.get("current_court_id"),
            "current_court": motion.get("current_court"),
            "current_court_address": motion.get("current_court_address"),
            "new_address": motion.get("new_address"),
            "destination_court_id": motion.get("destination_court_id"),
            "destination_court": motion.get("destination_court"),
            "destination_court_address": motion.get("destination_court_address"),
            
            # Family motion
            "is_family_motion": motion.get("is_family_motion", False),
            "family_members": motion.get("family_members", []),
            
            # Justification and host info
            "justification": motion.get("justification"),
            "justification_reason": motion.get("justification_reason"),
            "host_info": motion.get("host_info"),
            
            # Generated content
            "motion_content_en": motion.get("motion_content_en"),
            "motion_content_es": motion.get("motion_content_es"),
            "generated_at": motion.get("generated_at"),
            
            "notes": motion.get("notes"),
            "admin_notes": motion.get("admin_notes"),
            "priority": motion.get("priority"),
            "deadline": motion.get("deadline"),
            
            "required_documents": motion.get("required_documents", []),
            "uploaded_documents": motion.get("uploaded_documents", []),
            "status_history": motion.get("status_history", []),
            
            "created_at": motion.get("created_at"),
            "created_by": motion.get("created_by"),
            "created_by_name": motion.get("created_by_name"),
            "updated_at": motion.get("updated_at"),
            "submitted_at": motion.get("submitted_at"),
            "resolved_at": motion.get("resolved_at")
        }
    
    def _format_motion_list_item(self, motion: Dict[str, Any]) -> Dict[str, Any]:
        """Format motion for list view"""
        motion_type = MotionType(motion.get("motion_type"))
        status = MotionStatus(motion.get("status"))
        
        # Check if all required documents are uploaded
        required_docs = motion.get("required_documents", [])
        documents_complete = all(
            doc.get("uploaded", False) 
            for doc in required_docs 
            if doc.get("required", False)
        )
        
        return {
            "id": motion.get("id"),
            "motion_number": motion.get("motion_number"),
            "motion_type": motion_type.value,
            "motion_type_label": MOTION_TYPE_LABELS.get(motion_type, motion_type.value),
            "status": status.value,
            "status_label": MOTION_STATUS_LABELS.get(status, status.value),
            "client_name": motion.get("client_name"),
            "client_email": motion.get("client_email"),
            "priority": motion.get("priority"),
            "deadline": motion.get("deadline"),
            "documents_complete": documents_complete,
            "created_at": motion.get("created_at"),
            "updated_at": motion.get("updated_at")
        }
