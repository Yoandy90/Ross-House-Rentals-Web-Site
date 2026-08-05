"""
Document Capture Service - Sistema de captura de documentos con cámara guiada
"""
import logging
import base64
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class DocumentCaptureService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.captured_documents = db['captured_documents']
        self.users = db['users']
        
    async def upload_document(
        self,
        user_id: str,
        document_type: str,
        image_data: str,
        notes: Optional[str] = None,
        year: Optional[int] = None
    ) -> Dict:
        """Upload a captured document"""
        try:
            # Decode base64 to get file size
            try:
                image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
                file_size = len(image_bytes)
            except Exception as e:
                logger.error(f"Error decoding image: {e}")
                file_size = 0
            
            # Create document record
            doc_id = str(uuid.uuid4())
            document = {
                '_id': doc_id,
                'id': doc_id,
                'user_id': user_id,
                'document_type': document_type,
                'image_data': image_data,
                'status': 'pending',
                'uploaded_at': datetime.now(timezone.utc),
                'reviewed_at': None,
                'notes': notes,
                'admin_notes': None,
                'year': year,
                'file_size': file_size
            }
            
            await self.captured_documents.insert_one(document)
            
            # Remove image_data from response (too large)
            response_doc = document.copy()
            response_doc.pop('image_data')
            response_doc['uploaded_at'] = response_doc['uploaded_at'].isoformat()
            
            logger.info(f"Document uploaded: {doc_id} by user {user_id}, type: {document_type}")
            
            return {
                'success': True,
                'message': 'Documento subido exitosamente',
                'document': response_doc
            }
            
        except Exception as e:
            logger.error(f"Error uploading document: {e}")
            return {
                'success': False,
                'message': f'Error al subir documento: {str(e)}'
            }
    
    async def get_user_documents(
        self,
        user_id: str,
        document_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """Get documents for a user"""
        try:
            query = {'user_id': user_id}
            if document_type:
                query['document_type'] = document_type
            if status:
                query['status'] = status
            
            cursor = self.captured_documents.find(query).sort('uploaded_at', -1)
            documents = await cursor.to_list(length=100)
            
            # Remove image_data from response
            for doc in documents:
                doc.pop('image_data', None)
                doc.pop('_id', None)
                if doc.get('uploaded_at'):
                    doc['uploaded_at'] = doc['uploaded_at'].isoformat()
                if doc.get('reviewed_at'):
                    doc['reviewed_at'] = doc['reviewed_at'].isoformat()
            
            return documents
            
        except Exception as e:
            logger.error(f"Error getting user documents: {e}")
            return []
    
    async def get_document_by_id(self, document_id: str, include_image: bool = False) -> Optional[Dict]:
        """Get a specific document"""
        try:
            document = await self.captured_documents.find_one({'_id': document_id})
            if not document:
                return None
            
            if not include_image:
                document.pop('image_data', None)
            
            document.pop('_id', None)
            if document.get('uploaded_at'):
                document['uploaded_at'] = document['uploaded_at'].isoformat()
            if document.get('reviewed_at'):
                document['reviewed_at'] = document['reviewed_at'].isoformat()
            
            return document
            
        except Exception as e:
            logger.error(f"Error getting document: {e}")
            return None
    
    async def update_document_status(
        self,
        document_id: str,
        status: str,
        admin_notes: Optional[str] = None
    ) -> Dict:
        """Update document status (admin only)"""
        try:
            update_data = {
                'status': status,
                'reviewed_at': datetime.now(timezone.utc)
            }
            if admin_notes:
                update_data['admin_notes'] = admin_notes
            
            result = await self.captured_documents.update_one(
                {'_id': document_id},
                {'$set': update_data}
            )
            
            if result.modified_count > 0:
                return {
                    'success': True,
                    'message': 'Estado actualizado exitosamente'
                }
            else:
                return {
                    'success': False,
                    'message': 'Documento no encontrado'
                }
                
        except Exception as e:
            logger.error(f"Error updating document status: {e}")
            return {
                'success': False,
                'message': f'Error al actualizar: {str(e)}'
            }
    
    async def get_all_documents(
        self,
        status: Optional[str] = None,
        document_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get all documents (admin only)"""
        try:
            query = {}
            if status:
                query['status'] = status
            if document_type:
                query['document_type'] = document_type
            
            cursor = self.captured_documents.find(query).sort('uploaded_at', -1).limit(limit)
            documents = await cursor.to_list(length=limit)
            
            # Remove image_data and add user info
            for doc in documents:
                doc.pop('image_data', None)
                doc.pop('_id', None)
                if doc.get('uploaded_at'):
                    doc['uploaded_at'] = doc['uploaded_at'].isoformat()
                if doc.get('reviewed_at'):
                    doc['reviewed_at'] = doc['reviewed_at'].isoformat()
                
                # Add user info
                user = await self.users.find_one({'_id': doc['user_id']})
                if user:
                    doc['user_name'] = user.get('name', 'Unknown')
                    doc['user_email'] = user.get('email', 'Unknown')
            
            return documents
            
        except Exception as e:
            logger.error(f"Error getting all documents: {e}")
            return []
    
    async def get_document_stats(self, user_id: Optional[str] = None) -> Dict:
        """Get document statistics"""
        try:
            query = {}
            if user_id:
                query['user_id'] = user_id
            
            total = await self.captured_documents.count_documents(query)
            pending = await self.captured_documents.count_documents({**query, 'status': 'pending'})
            approved = await self.captured_documents.count_documents({**query, 'status': 'approved'})
            rejected = await self.captured_documents.count_documents({**query, 'status': 'rejected'})
            needs_revision = await self.captured_documents.count_documents({**query, 'status': 'needs_revision'})
            
            return {
                'total': total,
                'pending': pending,
                'approved': approved,
                'rejected': rejected,
                'needs_revision': needs_revision
            }
            
        except Exception as e:
            logger.error(f"Error getting document stats: {e}")
            return {
                'total': 0,
                'pending': 0,
                'approved': 0,
                'rejected': 0,
                'needs_revision': 0
            }
    
    async def delete_document(self, document_id: str) -> Dict:
        """Delete a document"""
        try:
            result = await self.captured_documents.delete_one({'_id': document_id})
            
            if result.deleted_count > 0:
                return {
                    'success': True,
                    'message': 'Documento eliminado exitosamente'
                }
            else:
                return {
                    'success': False,
                    'message': 'Documento no encontrado'
                }
                
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            return {
                'success': False,
                'message': f'Error al eliminar: {str(e)}'
            }
