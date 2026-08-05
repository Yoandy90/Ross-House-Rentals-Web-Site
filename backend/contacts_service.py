"""
Contacts Service - Gestión de contactos guardados del usuario
"""
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from typing import List, Optional
from bson import ObjectId

logger = logging.getLogger(__name__)

class ContactsService:
    def __init__(self, db):
        self.db = db
        self.contacts_collection = db.user_contacts
        logger.info("✅ Contacts Service initialized")
    
    async def create_contact(self, user_id: str, name: str, phone: Optional[str], 
                            email: Optional[str], relationship: Optional[str]) -> dict:
        """Crea un nuevo contacto guardado"""
        try:
            # Validar que al menos tenga phone o email
            if not phone and not email:
                return {
                    'success': False,
                    'error': 'Se requiere al menos teléfono o email'
                }
            
            contact_doc = {
                'user_id': user_id,
                'name': name,
                'phone': phone,
                'email': email,
                'relationship': relationship,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            result = await self.contacts_collection.insert_one(contact_doc)
            
            contact_doc['id'] = str(result.inserted_id)
            contact_doc['_id'] = str(result.inserted_id)
            
            logger.info(f"✅ Contact created for user {user_id}: {name}")
            
            return {
                'success': True,
                'contact': contact_doc,
                'message': 'Contacto creado exitosamente'
            }
            
        except Exception as e:
            logger.error(f"❌ Error creating contact: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_user_contacts(self, user_id: str) -> List[dict]:
        """Obtiene todos los contactos del usuario"""
        try:
            cursor = self.contacts_collection.find({'user_id': user_id})
            contacts = await cursor.to_list(length=100)
            
            # Convertir ObjectId a string
            for contact in contacts:
                contact['id'] = str(contact['_id'])
                contact['_id'] = str(contact['_id'])
            
            logger.info(f"📋 Retrieved {len(contacts)} contacts for user {user_id}")
            return contacts
            
        except Exception as e:
            logger.error(f"❌ Error getting contacts: {e}")
            return []
    
    async def get_contact_by_id(self, contact_id: str, user_id: str) -> Optional[dict]:
        """Obtiene un contacto específico (solo si pertenece al usuario)"""
        try:
            contact = await self.contacts_collection.find_one({
                '_id': ObjectId(contact_id),
                'user_id': user_id
            })
            
            if contact:
                contact['id'] = str(contact['_id'])
                contact['_id'] = str(contact['_id'])
            
            return contact
            
        except Exception as e:
            logger.error(f"❌ Error getting contact: {e}")
            return None
    
    async def update_contact(self, contact_id: str, user_id: str, 
                           update_data: dict) -> dict:
        """Actualiza un contacto"""
        try:
            # Verificar que el contacto pertenece al usuario
            contact = await self.get_contact_by_id(contact_id, user_id)
            if not contact:
                return {'success': False, 'error': 'Contacto no encontrado'}
            
            # Preparar datos de actualización
            update_doc = {k: v for k, v in update_data.items() if v is not None}
            update_doc['updated_at'] = datetime.utcnow()
            
            result = await self.contacts_collection.update_one(
                {'_id': ObjectId(contact_id), 'user_id': user_id},
                {'$set': update_doc}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Contact {contact_id} updated")
                return {
                    'success': True,
                    'message': 'Contacto actualizado exitosamente'
                }
            else:
                return {
                    'success': False,
                    'error': 'No se realizaron cambios'
                }
            
        except Exception as e:
            logger.error(f"❌ Error updating contact: {e}")
            return {'success': False, 'error': str(e)}
    
    async def delete_contact(self, contact_id: str, user_id: str) -> dict:
        """Elimina un contacto"""
        try:
            result = await self.contacts_collection.delete_one({
                '_id': ObjectId(contact_id),
                'user_id': user_id
            })
            
            if result.deleted_count > 0:
                logger.info(f"✅ Contact {contact_id} deleted")
                return {
                    'success': True,
                    'message': 'Contacto eliminado exitosamente'
                }
            else:
                return {
                    'success': False,
                    'error': 'Contacto no encontrado'
                }
            
        except Exception as e:
            logger.error(f"❌ Error deleting contact: {e}")
            return {'success': False, 'error': str(e)}
    
    async def search_contacts(self, user_id: str, query: str) -> List[dict]:
        """Busca contactos por nombre, email o teléfono"""
        try:
            # Búsqueda case-insensitive
            cursor = self.contacts_collection.find({
                'user_id': user_id,
                '$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'email': {'$regex': query, '$options': 'i'}},
                    {'phone': {'$regex': query, '$options': 'i'}}
                ]
            })
            
            contacts = await cursor.to_list(length=50)
            
            for contact in contacts:
                contact['id'] = str(contact['_id'])
                contact['_id'] = str(contact['_id'])
            
            return contacts
            
        except Exception as e:
            logger.error(f"❌ Error searching contacts: {e}")
            return []
