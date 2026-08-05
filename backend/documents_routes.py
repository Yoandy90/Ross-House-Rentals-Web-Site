"""
Documents Routes Router
Extracted from server.py for modularization.
Handles dependents CRUD, admin document management, document capture (OCR),
and public document upload system.
"""
import os
import logging
import uuid
import json
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any
from fastapi import APIRouter, HTTPException, Request, Depends, Query, Body, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId

logger = logging.getLogger(__name__)

# Import models from their source modules
try:
    from document_capture_models import UploadDocumentRequest, UpdateDocumentStatusRequest
except ImportError:
    pass

try:
    from document_capture_service import DocumentCaptureService
except ImportError:
    pass

documents_router = APIRouter()
_db = None
document_capture_service = None


class DocumentUploadRequest(BaseModel):
    """Request model for document upload (no id required from client)"""
    name: str
    file_data: str  # base64 encoded
    file_type: str
    size: int
    category: Optional[str] = 'other'
    tax_year: Optional[int] = None


def init_documents_router(db):
    global _db, document_capture_service
    _db = db
    try:
        document_capture_service = DocumentCaptureService(_db)
    except Exception:
        document_capture_service = None


# ================== Auth Helpers ==================

async def _get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    auth_str = str(authorization) if authorization else None
    if not auth_str:
        raise HTTPException(status_code=401, detail='No authorization header')
    token = auth_str.replace('Bearer ', '') if auth_str.startswith('Bearer ') else auth_str
    session = await _db.user_sessions.find_one({'session_token': token})
    if not session:
        raise HTTPException(status_code=401, detail='Invalid session token')
    expires_at = session['expires_at']
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        await _db.user_sessions.delete_one({'session_token': token})
        raise HTTPException(status_code=401, detail='Session expired')
    user_id = session['user_id']
    try:
        try:
            user = await _db.users.find_one({'_id': ObjectId(user_id)})
        except:
            user = await _db.users.find_one({'_id': user_id})
    except Exception as e:
        raise HTTPException(status_code=401, detail='Invalid user ID')
    if not user:
        raise HTTPException(status_code=401, detail='User not found')
    user_dict = dict(user)
    user_dict['id'] = str(user_dict.pop('_id'))
    return user_dict

async def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    user = await _get_current_user(authorization)
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail='Admin panel access required')
    return user


# ================== DEPENDENTS ==================
# ================== DEPENDENTS ENDPOINTS ==================
class DependentRequest(BaseModel):
    first_name: str
    last_name: str
    relationship: str = 'child'
    date_of_birth: str = ''
    ssn_last4: str = ''  # Full SSN/ITIN (XXX-XX-XXXX format)
    is_student: bool = False
    is_disabled: bool = False


@documents_router.get('/dependents')
async def get_dependents(current_user: dict = Depends(_get_current_user)):
    """Get user's dependents"""
    query = {'user_id': current_user['id']}
    deps = await _db.dependents.find(query).sort('created_at', -1).to_list(20)
    result = []
    for d in deps:
        result.append({
            'id': d.get('id', str(d.get('_id', ''))),
            'first_name': d.get('first_name', ''),
            'last_name': d.get('last_name', ''),
            'relationship': d.get('relationship', 'child'),
            'date_of_birth': d.get('date_of_birth', ''),
            'ssn_last4': d.get('ssn_last4', ''),
            'is_student': d.get('is_student', False),
            'is_disabled': d.get('is_disabled', False),
            'created_at': d.get('created_at', datetime.now(timezone.utc)).isoformat() if d.get('created_at') else None,
        })
    return {'dependents': result}


@documents_router.post('/dependents')
async def create_dependent(dep: DependentRequest, current_user: dict = Depends(_get_current_user)):
    """Create a new dependent"""
    dep_id = str(uuid4())
    doc = {
        'id': dep_id,
        'user_id': current_user['id'],
        'first_name': dep.first_name,
        'last_name': dep.last_name,
        'relationship': dep.relationship,
        'date_of_birth': dep.date_of_birth,
        'ssn_last4': dep.ssn_last4,
        'is_student': dep.is_student,
        'is_disabled': dep.is_disabled,
        'created_at': datetime.now(timezone.utc),
    }
    await _db.dependents.insert_one(doc)
    return {'message': 'Dependent created', 'id': dep_id}


@documents_router.put('/dependents/{dep_id}')
async def update_dependent(dep_id: str, dep: DependentRequest, current_user: dict = Depends(_get_current_user)):
    """Update a dependent"""
    result = await _db.dependents.update_one(
        {'id': dep_id, 'user_id': current_user['id']},
        {'$set': {
            'first_name': dep.first_name,
            'last_name': dep.last_name,
            'relationship': dep.relationship,
            'date_of_birth': dep.date_of_birth,
            'ssn_last4': dep.ssn_last4,
            'is_student': dep.is_student,
            'is_disabled': dep.is_disabled,
            'updated_at': datetime.now(timezone.utc),
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='Dependent not found')
    return {'message': 'Dependent updated'}


@documents_router.delete('/dependents/{dep_id}')
async def delete_dependent(dep_id: str, current_user: dict = Depends(_get_current_user)):
    """Delete a dependent"""
    result = await _db.dependents.delete_one({'id': dep_id, 'user_id': current_user['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Dependent not found')
    return {'message': 'Dependent deleted'}


@documents_router.get('/documents/years')
async def get_document_years(current_user: dict = Depends(_get_current_user)):
    """Get list of tax years that have documents for the current user"""
    query = {'user_id': current_user['id']} if current_user['role'] == 'client' else {}
    
    # Get distinct tax_years from user's documents
    pipeline = [
        {'$match': query},
        {'$group': {'_id': '$tax_year'}},
        {'$sort': {'_id': -1}}
    ]
    
    results = await _db.documents.aggregate(pipeline).to_list(20)
    years = [r['_id'] for r in results if r['_id'] is not None]
    
    # Always include default years
    current_year = datetime.now().year
    current_month = datetime.now().month
    default_year = current_year - 1 if current_month <= 4 else current_year
    default_years = [default_year, default_year - 1, default_year - 2]
    
    # Merge and sort
    all_years = sorted(set(years + default_years), reverse=True)
    
    return {
        'years': all_years,
        'default_year': default_year,
        'counts': {year: await _db.documents.count_documents({**query, 'tax_year': year}) for year in all_years}
    }


@documents_router.get('/documents')
async def get_documents(current_user: dict = Depends(_get_current_user), tax_year: Optional[int] = Query(None)):
    query = {'user_id': current_user['id']} if current_user['role'] == 'client' else {}
    # Filter by tax_year if provided
    if tax_year:
        query['tax_year'] = tax_year
    # Exclude file_data from the query to improve performance
    projection = {'file_data': 0}
    docs = await _db.documents.find(query, projection).sort('uploaded_at', -1).to_list(100)
    
    # Convert MongoDB documents to response format (without file_data for performance)
    result = []
    for d in docs:
        doc_id = d.get('id') or str(d.get('_id', ''))
        result.append({
            'id': doc_id,
            'user_id': d.get('user_id', ''),
            'tax_return_id': d.get('tax_return_id'),
            'name': d.get('name', 'Unknown'),
            'file_data': '',  # Empty for list view - fetch individually if needed
            'file_type': d.get('file_type', 'application/octet-stream'),
            'size': d.get('size', 0),
            'category': d.get('category'),
            'tax_year': d.get('tax_year'),
            'uploaded_at': d.get('uploaded_at', datetime.now(timezone.utc)).isoformat() if d.get('uploaded_at') else datetime.now(timezone.utc).isoformat()
        })
    
    return result

@documents_router.post('/documents')
async def upload_document(document: DocumentUploadRequest, current_user: dict = Depends(_get_current_user)):
    logging.info(f"📄 POST /documents - User: {current_user.get('id')}, Name: {document.name}, Category: {document.category}")
    
    # Generate document ID
    document_id = str(uuid.uuid4())
    category = document.category or 'other'
    
    # Determine tax_year: use provided value, or default to current tax season
    current_year = datetime.now().year
    # Tax season: if it's Jan-Apr, we're filing for previous year; otherwise current year
    current_month = datetime.now().month
    default_tax_year = current_year - 1 if current_month <= 4 else current_year
    tax_year = document.tax_year or default_tax_year
    
    # Create full document
    full_document = {
        'id': document_id,
        'user_id': current_user['id'],
        'name': document.name,
        'file_data': document.file_data,
        'file_type': document.file_type,
        'size': document.size,
        'category': category,
        'tax_year': tax_year,
        'uploaded_at': datetime.now(timezone.utc),
        'reviewed': False
    }
    
    # Add document to database
    result = await _db.documents.insert_one(full_document)
    logging.info(f"✅ Document saved to DB with ID: {document_id}, MongoDB ID: {result.inserted_id}")
    
    # Send WhatsApp notification for document received
    try:
        from whatsapp_automation_service import get_whatsapp_automation
        wa_automation = get_whatsapp_automation()
        if wa_automation and current_user.get('phone'):
            wa_result = await wa_automation.send_document_received(document_id)
            if wa_result.get('success'):
                logging.info(f"✅ WhatsApp notification sent for document {document_id}")
            else:
                logging.debug(f"WhatsApp notification skipped: {wa_result.get('error')}")
    except Exception as wa_error:
        logging.error(f"❌ Error sending WhatsApp document notification: {str(wa_error)}")
    
    # Auto-sync to Rise CRM (non-blocking)
    try:
        from rise_crm_sync_service import rise_sync_service
        if rise_sync_service and rise_sync_service.rise_service.sync_enabled:
            import asyncio
            asyncio.create_task(rise_sync_service.sync_document_to_rise(document_id))
            print(f"🔄 Auto-sync triggered for document: {document_id}")
    except Exception as sync_error:
        print(f"⚠️ Auto-sync failed (non-critical): {str(sync_error)}")
    
    # Create notification for document upload
    try:
        await create_notification(
            user_id=current_user['id'],
            title='Documento Subido',
            body=f'Tu documento ha sido subido exitosamente y categorizado como {category}',
            data={'document_id': document_id, 'category': category},
            type='documents'
        )
    except Exception as e:
        print(f'Warning: Could not create notification: {str(e)}')
    
    return {
        'message': 'Document uploaded successfully', 
        'document_id': document_id,
        'category': category,
        'tax_year': tax_year,
        'name': document.name,
        'uploaded_at': datetime.now(timezone.utc).isoformat()
    }

@documents_router.delete('/documents/{document_id}')
async def delete_document(document_id: str, current_user: dict = Depends(_get_current_user)):
    result = await _db.documents.delete_one({'id': document_id, 'user_id': current_user['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Document not found')
    return {'message': 'Document deleted'}


@documents_router.get('/documents/checklist')
async def get_documents_checklist(current_user: dict = Depends(_get_current_user)):
    """Get checklist of required vs uploaded documents for current user"""
    try:
        # Define required documents - MUST match frontend REQUIRED_DOCUMENTS categories
        # Frontend categories: w2, ssn_card, id_document, medical, other
        required_documents = [
            'Comprobante de Ingresos',  # w2 category (includes W-2, 1099)
            'Tarjeta de Social Security',  # ssn_card category
            'Documento de Identificación',  # id_document category
            'Seguro Médico 1095-A',  # medical category
            'Otros Documentos'  # other category
        ]
        
        # Get user's uploaded documents
        user_documents = await _db.documents.find({
            'user_id': current_user['id']
        }).to_list(None)
        
        # Extract categories from uploaded documents - map to display names
        uploaded_categories = set()
        for doc in user_documents:
            category = (doc.get('category', '') or '').lower()
            logging.info(f"📋 Checking document category: '{category}'")
            
            # Map frontend categories to display names
            if category == 'w2' or 'w2' in category or 'w-2' in category or '1099' in category:
                uploaded_categories.add('Comprobante de Ingresos')
            elif category == 'ssn_card' or 'ssn' in category or 'social' in category:
                uploaded_categories.add('Tarjeta de Social Security')
            elif category == 'id_document' or 'id' in category or 'identification' in category:
                uploaded_categories.add('Documento de Identificación')
            elif category == 'medical' or 'health' in category or '1095' in category:
                uploaded_categories.add('Seguro Médico 1095-A')
            elif category == 'other' or category == 'otros':
                uploaded_categories.add('Otros Documentos')
        
        logging.info(f"📋 User {current_user['email']} - Uploaded categories: {uploaded_categories}")
        
        uploaded = list(uploaded_categories)
        missing = [doc for doc in required_documents if doc not in uploaded]
        completion_percentage = int((len(uploaded) / len(required_documents)) * 100)
        
        # Check if checklist was just completed (100%)
        if completion_percentage == 100:
            # Check if user already received the reward
            reward_check = await _db.credit_transactions.find_one({
                'user_id': current_user['id'],
                'type': 'documents_completion_bonus',
                'description': 'Bonus por completar documentos requeridos'
            })
            
            if not reward_check:
                # Award 2 credits for completing all documents
                await _db.credit_transactions.insert_one({
                    'user_id': current_user['id'],
                    'amount': 2,
                    'type': 'documents_completion_bonus',
                    'description': 'Bonus por completar documentos requeridos',
                    'created_at': datetime.now(timezone.utc),
                    'status': 'completed'
                })
                
                # Update user's credit balance
                await _db.users.update_one(
                    {'_id': ObjectId(current_user['id'])},
                    {'$inc': {'credit_balance': 2}}
                )
                
                logging.info(f"✅ User {current_user['email']} completed all documents - awarded 2 credits")
                
                # Send notification to admins
                try:
                    admin_users = await _db.users.find({'role': 'admin'}).to_list(None)
                    for admin in admin_users:
                        # Send push notification if they have a token
                        if admin.get('expo_push_token'):
                            try:
                                from push_notification_service import send_push_notification
                                await send_push_notification(
                                    user_id=str(admin.get('_id')),
                                    title='📄 Documentos Completados',
                                    body=f"{current_user.get('name', 'Un cliente')} ha completado todos los documentos requeridos",
                                    data={'type': 'documents_completed', 'user_id': current_user['id']}
                                )
                            except Exception as push_error:
                                logging.error(f"Error sending push notification: {str(push_error)}")
                    
                    logging.info(f"✅ Admin notifications sent for user {current_user['email']} document completion")
                except Exception as notif_error:
                    logging.error(f"Error sending admin notifications: {str(notif_error)}")
        
        return {
            'required': required_documents,
            'uploaded': uploaded,
            'missing': missing,
            'completion_percentage': completion_percentage
        }
    
    except Exception as e:
        logging.error(f"Error getting documents checklist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ================== ADMIN_DOCUMENTS ==================
# ================== ADMIN DOCUMENT ROUTES ==================

@documents_router.get('/admin/documents')
async def get_admin_documents(
    current_user: dict = Depends(_require_admin),
    client_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    reviewed: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, le=500)
):
    """Get all documents with filters (admin only)"""
    try:
        # Build query
        query = {}
        
        if client_id:
            query['user_id'] = client_id
        
        if category:
            query['category'] = category
        
        if reviewed is not None:
            query['reviewed'] = reviewed
        
        if search:
            query['name'] = {'$regex': search, '$options': 'i'}
        
        if start_date or end_date:
            date_query = {}
            if start_date:
                date_query['$gte'] = datetime.fromisoformat(start_date)
            if end_date:
                date_query['$lte'] = datetime.fromisoformat(end_date)
            if date_query:
                query['uploaded_at'] = date_query
        
        # Get documents
        docs = await _db.documents.find(query).sort('uploaded_at', -1).limit(limit).to_list(limit)
        
        # Enrich with user data
        result = []
        for doc in docs:
            user = None
            user_id = doc.get('user_id')
            
            # Try to find user with different ID formats
            if user_id:
                user = await _db.users.find_one({'_id': user_id})
                if not user:
                    try:
                        user = await _db.users.find_one({'_id': ObjectId(user_id)})
                    except:
                        pass
                if not user:
                    user = await _db.users.find_one({'id': user_id})
                if not user:
                    user = await _db.users.find_one({'email': user_id})
            
            # Get user name with fallbacks
            user_name = 'Cliente'
            user_email = 'Sin email'
            if user:
                user_name = user.get('full_name') or user.get('name') or user.get('email', 'Cliente')
                user_email = user.get('email', 'Sin email')
            
            # Handle uploaded_at safely - some documents may not have this field
            uploaded_at = doc.get('uploaded_at')
            if uploaded_at:
                uploaded_at_str = uploaded_at.isoformat() if isinstance(uploaded_at, datetime) else str(uploaded_at)
            else:
                # Fallback to created_at or current time
                uploaded_at_str = doc.get('created_at', datetime.now(timezone.utc)).isoformat() if isinstance(doc.get('created_at'), datetime) else None
            
            doc_data = {
                'id': doc.get('id', str(doc.get('_id', ''))),
                'user_id': doc.get('user_id', ''),
                'user_name': user_name,
                'user_email': user_email,
                'name': doc.get('name', 'Sin nombre'),
                'category': doc.get('category', 'other'),
                'file_type': doc.get('file_type', 'unknown'),
                'size': doc.get('size', 0),
                'uploaded_at': uploaded_at_str,
                'reviewed': doc.get('reviewed', False),
                'reviewed_at': doc.get('reviewed_at').isoformat() if doc.get('reviewed_at') else None,
                'reviewed_by': doc.get('reviewed_by')
            }
            result.append(doc_data)
        
        return result
    except Exception as e:
        print(f'❌ Error in get_admin_documents: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@documents_router.get('/admin/documents/stats')
async def get_admin_documents_stats(current_user: dict = Depends(_require_admin)):
    """Get document statistics (admin only)"""
    try:
        total = await _db.documents.count_documents({})
        reviewed = await _db.documents.count_documents({'reviewed': True})
        pending = total - reviewed
        
        # Get counts by category
        pipeline = [
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}}
        ]
        category_counts = await _db.documents.aggregate(pipeline).to_list(None)
        
        by_category = {item['_id'] or 'other': item['count'] for item in category_counts}
        
        return {
            'total': total,
            'reviewed': reviewed,
            'pending': pending,
            'by_category': by_category
        }
    except Exception as e:
        print(f'❌ Error in get_admin_documents_stats: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@documents_router.get('/admin/documents/{document_id}')
async def get_admin_document(
    document_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Get specific document with file data (admin only)"""
    try:
        # Try multiple ID formats
        doc = await _db.documents.find_one({'id': document_id})
        if not doc:
            doc = await _db.documents.find_one({'_id': document_id})
        if not doc:
            try:
                doc = await _db.documents.find_one({'_id': ObjectId(document_id)})
            except:
                pass
        
        if not doc:
            raise HTTPException(status_code=404, detail='Document not found')
        
        # Get user info with enhanced lookup
        user = None
        user_id = doc.get('user_id')
        if user_id:
            user = await _db.users.find_one({'_id': user_id})
            if not user:
                try:
                    user = await _db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            if not user:
                user = await _db.users.find_one({'id': user_id})
        
        user_name = 'Cliente'
        user_email = 'Sin email'
        if user:
            user_name = user.get('full_name') or user.get('name') or user.get('email', 'Cliente')
            user_email = user.get('email', 'Sin email')
        
        result = {
            'id': doc.get('id', str(doc.get('_id', ''))),
            'user_id': doc.get('user_id', ''),
            'user_name': user_name,
            'user_email': user_email,
            'name': doc.get('name', 'Sin nombre'),
            'category': doc.get('category', 'other'),
            'file_type': doc.get('file_type', 'unknown'),
            'file_data': doc.get('file_data'),
            'size': doc.get('size', 0),
            'uploaded_at': doc['uploaded_at'].isoformat() if isinstance(doc.get('uploaded_at'), datetime) else doc.get('uploaded_at'),
            'reviewed': doc.get('reviewed', False),
            'reviewed_at': doc.get('reviewed_at').isoformat() if doc.get('reviewed_at') else None,
            'reviewed_by': doc.get('reviewed_by')
        }
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error in get_admin_document: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@documents_router.get('/admin/documents/{document_id}/file')
async def get_document_file(
    document_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Get document file for viewing/download (admin only) - Serves base64 as downloadable file"""
    from fastapi.responses import Response
    import base64
    from bson import ObjectId
    
    try:
        doc = None
        
        # Try multiple search strategies
        # 1. Try to find by id field first (UUID format)
        doc = await _db.documents.find_one({'id': document_id})
        
        # 2. If not found, try by _id as string
        if not doc:
            doc = await _db.documents.find_one({'_id': document_id})
        
        # 3. Try by _id as ObjectId
        if not doc:
            try:
                if len(document_id) == 24 and ObjectId.is_valid(document_id):
                    doc = await _db.documents.find_one({'_id': ObjectId(document_id)})
            except:
                pass
        
        # 4. Try searching in whatsapp_documents collection
        if not doc:
            doc = await _db.whatsapp_documents.find_one({'id': document_id})
        
        if not doc:
            try:
                if len(document_id) == 24 and ObjectId.is_valid(document_id):
                    doc = await _db.whatsapp_documents.find_one({'_id': ObjectId(document_id)})
            except:
                pass
        
        if not doc:
            logging.warning(f"Document not found: {document_id}")
            raise HTTPException(status_code=404, detail='Document not found')
        
        # Get the base64 file data - check multiple possible field names
        file_data = doc.get('file_data') or doc.get('data') or doc.get('content') or doc.get('base64')
        
        # If file_data is a URL, try to fetch it
        if not file_data and doc.get('url'):
            # Return redirect to URL
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=doc.get('url'))
        
        if not file_data:
            logging.warning(f"Document {document_id} has no file data. Fields: {list(doc.keys())}")
            raise HTTPException(status_code=404, detail='Document has no file data')
        
        # Decode base64
        try:
            # Remove data URL prefix if present
            if isinstance(file_data, str) and ',' in file_data:
                file_data = file_data.split(',')[1]
            file_bytes = base64.b64decode(file_data)
        except Exception as decode_error:
            print(f"❌ Error decoding base64: {decode_error}")
            raise HTTPException(status_code=500, detail='Failed to decode document data')
        
        # Determine mime type
        mime_type = doc.get('mime_type', doc.get('file_type', doc.get('type', 'application/octet-stream')))
        if not mime_type or mime_type == 'unknown':
            # Try to determine from filename
            filename = doc.get('name', doc.get('original_filename', doc.get('filename', 'document')))
            if filename.lower().endswith('.pdf'):
                mime_type = 'application/pdf'
            elif filename.lower().endswith(('.jpg', '.jpeg')):
                mime_type = 'image/jpeg'
            elif filename.lower().endswith('.png'):
                mime_type = 'image/png'
            else:
                mime_type = 'application/octet-stream'
        
        filename = doc.get('name', doc.get('original_filename', doc.get('filename', 'document')))
        
        return Response(
            content=file_bytes,
            media_type=mime_type,
            headers={
                'Content-Disposition': f'inline; filename="{filename}"',
                'Content-Length': str(len(file_bytes))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error in get_document_file: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))

@documents_router.patch('/admin/documents/{document_id}/mark-reviewed')
async def mark_document_reviewed(
    document_id: str,
    reviewed: bool,
    current_user: dict = Depends(_require_admin)
):
    """Mark document as reviewed/unreviewed (admin only)"""
    try:
        doc = await _db.documents.find_one({'id': document_id})
        
        if not doc:
            raise HTTPException(status_code=404, detail='Document not found')
        
        update_data = {
            'reviewed': reviewed,
            'reviewed_at': datetime.now(timezone.utc) if reviewed else None,
            'reviewed_by': current_user['name'] if reviewed else None
        }
        
        await _db.documents.update_one(
            {'id': document_id},
            {'$set': update_data}
        )
        
        return {
            'message': f'Document marked as {"reviewed" if reviewed else "unreviewed"}',
            'document_id': document_id,
            'reviewed': reviewed
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f'❌ Error in mark_document_reviewed: {str(e)}')
        raise HTTPException(status_code=500, detail=str(e))



# ================== DOCUMENT_CAPTURE ==================
# ==================== DOCUMENT CAPTURE ENDPOINTS ====================

@documents_router.post('/document-capture/upload')
async def upload_document(
    request: UploadDocumentRequest,
    current_user: dict = Depends(_get_current_user)
):
    """Upload a captured document"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    result = await document_capture_service.upload_document(
        user_id=current_user['id'],
        document_type=request.document_type,
        image_data=request.image_data,
        notes=request.notes,
        year=request.year
    )
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    return result

@documents_router.get('/document-capture/my-documents')
async def get_my_documents(
    document_type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(_get_current_user)
):
    """Get user's captured documents"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    documents = await document_capture_service.get_user_documents(
        user_id=current_user['id'],
        document_type=document_type,
        status=status
    )
    
    return {'documents': documents}

@documents_router.get('/document-capture/my-documents/{document_id}')
async def get_my_document(
    document_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Get a specific document"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    document = await document_capture_service.get_document_by_id(document_id, include_image=True)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return document

@documents_router.get('/document-capture/stats')
async def get_my_document_stats(
    current_user: dict = Depends(_get_current_user)
):
    """Get user's document statistics"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    stats = await document_capture_service.get_document_stats(user_id=current_user['id'])
    return stats

@documents_router.delete('/document-capture/my-documents/{document_id}')
async def delete_my_document(
    document_id: str,
    current_user: dict = Depends(_get_current_user)
):
    """Delete a document"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    # Verify ownership
    document = await document_capture_service.get_document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if document['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await document_capture_service.delete_document(document_id)
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    return result

# Admin endpoints
@documents_router.get('/admin/document-capture/documents')
async def admin_get_all_documents(
    status: Optional[str] = None,
    document_type: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(_require_admin)
):
    """Get all captured documents (admin only)"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    documents = await document_capture_service.get_all_documents(
        status=status,
        document_type=document_type,
        limit=limit
    )
    
    return {'documents': documents}

@documents_router.get('/admin/document-capture/documents/{document_id}')
async def admin_get_document(
    document_id: str,
    current_user: dict = Depends(_require_admin)
):
    """Get a specific document with image (admin only)"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    document = await document_capture_service.get_document_by_id(document_id, include_image=True)
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return document

@documents_router.put('/admin/document-capture/documents/{document_id}/status')
async def admin_update_document_status(
    document_id: str,
    request: UpdateDocumentStatusRequest,
    current_user: dict = Depends(_require_admin)
):
    """Update document status (admin only)"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    result = await document_capture_service.update_document_status(
        document_id=document_id,
        status=request.status,
        admin_notes=request.admin_notes
    )
    
    if not result['success']:
        raise HTTPException(status_code=400, detail=result['message'])
    
    # Send push notification to the client
    try:
        doc = await _db.documents.find_one({'_id': document_id})
        if not doc:
            doc = await _db.documents.find_one({'_id': ObjectId(document_id)})
        
        if doc and doc.get('user_id'):
            user_id = doc.get('user_id')
            user = await _db.users.find_one({'_id': user_id})
            if not user:
                user = await _db.users.find_one({'_id': ObjectId(user_id)})
            
            if user and user.get('expo_push_token'):
                from push_notification_service import send_push_notification
                
                # Determine message based on status
                status_messages = {
                    'approved': ('✅ Documento Aprobado', 'Tu documento ha sido revisado y aprobado.'),
                    'rejected': ('❌ Documento Rechazado', 'Tu documento necesita corrección. Revisa los comentarios.'),
                    'reviewed': ('📋 Documento Revisado', 'Hemos revisado tu documento.'),
                    'pending': ('📎 Documento Recibido', 'Hemos recibido tu documento y lo revisaremos pronto.'),
                }
                
                title, body = status_messages.get(request.status, ('📄 Actualización', 'El estado de tu documento ha sido actualizado.'))
                
                await send_push_notification(
                    expo_push_token=user.get('expo_push_token'),
                    title=title,
                    body=body,
                    data={'type': 'document_status', 'document_id': document_id, 'status': request.status}
                )
                logging.info(f"📱 Push notification sent for document status update")
    except Exception as push_error:
        logging.error(f"Error sending push for document status: {push_error}")
    
    return result

@documents_router.get('/admin/document-capture/stats')
async def admin_get_document_stats(
    current_user: dict = Depends(_require_admin)
):
    """Get overall document statistics (admin only)"""
    if not document_capture_service:
        raise HTTPException(status_code=503, detail="Document capture service not available")
    
    stats = await document_capture_service.get_document_stats()
    return stats



# ================== PUBLIC_DOCUMENT_UPLOAD ==================
# ==================== PUBLIC DOCUMENT UPLOAD SYSTEM ====================

# Default document requirements configuration
DEFAULT_DOCUMENT_REQUIREMENTS = [
    {"id": "ssn", "name": "Social Security Card", "description": "Tarjeta de Seguro Social", "required": True, "order": 1},
    {"id": "id", "name": "ID/Licencia/Pasaporte", "description": "Identificación válida con foto", "required": True, "order": 2},
    {"id": "w2", "name": "W2", "description": "Formulario W2 de tu empleador", "required": False, "order": 3},
    {"id": "1099", "name": "1099", "description": "Formularios 1099 (si aplica)", "required": False, "order": 4},
    {"id": "bank_info", "name": "Información Bancaria", "description": "Número de Ruta y Cuenta para depósito", "required": False, "order": 5},
    {"id": "last_paycheck", "name": "Último Cheque de Pago", "description": "Último talón de pago de diciembre del año fiscal", "required": False, "order": 6},
    {"id": "otros", "name": "Otros Documentos", "description": "Cualquier otro documento relevante para tu declaración", "required": False, "order": 7},
]

@documents_router.get('/admin/document-requirements')
async def get_document_requirements(current_user: dict = Depends(_require_admin)):
    """Get the current document requirements configuration"""
    try:
        config = await _db.settings.find_one({'_id': 'document_requirements'})
        
        if not config:
            # Initialize with defaults
            config = {
                '_id': 'document_requirements',
                'tax_year': 2025,
                'requirements': DEFAULT_DOCUMENT_REQUIREMENTS,
                'updated_at': datetime.now(timezone.utc)
            }
            await _db.settings.insert_one(config)
        
        return {
            'tax_year': config.get('tax_year', 2025),
            'requirements': config.get('requirements', DEFAULT_DOCUMENT_REQUIREMENTS),
            'updated_at': config.get('updated_at')
        }
    except Exception as e:
        logging.error(f"Error getting document requirements: {e}")
        return {
            'tax_year': 2025,
            'requirements': DEFAULT_DOCUMENT_REQUIREMENTS
        }

@documents_router.put('/admin/document-requirements')
async def update_document_requirements(data: dict, current_user: dict = Depends(_require_admin)):
    """Update document requirements configuration"""
    try:
        update_data = {
            'tax_year': data.get('tax_year', 2025),
            'requirements': data.get('requirements', DEFAULT_DOCUMENT_REQUIREMENTS),
            'updated_at': datetime.now(timezone.utc),
            'updated_by': current_user.get('email')
        }
        
        await _db.settings.update_one(
            {'_id': 'document_requirements'},
            {'$set': update_data},
            upsert=True
        )
        
        logging.info(f"✅ Document requirements updated by {current_user.get('email')}")
        return {'success': True, 'message': 'Configuración actualizada'}
    except Exception as e:
        logging.error(f"Error updating document requirements: {e}")
        raise HTTPException(status_code=500, detail='Error al actualizar configuración')

@documents_router.post('/admin/document-requirements/add')
async def add_document_requirement(data: dict, current_user: dict = Depends(_require_admin)):
    """Add a new document requirement"""
    try:
        config = await _db.settings.find_one({'_id': 'document_requirements'})
        requirements = config.get('requirements', []) if config else DEFAULT_DOCUMENT_REQUIREMENTS.copy()
        
        new_req = {
            'id': data.get('id', str(uuid.uuid4())[:8]),
            'name': data.get('name'),
            'description': data.get('description', ''),
            'required': data.get('required', False),
            'order': len(requirements) + 1
        }
        
        requirements.append(new_req)
        
        await _db.settings.update_one(
            {'_id': 'document_requirements'},
            {'$set': {'requirements': requirements, 'updated_at': datetime.now(timezone.utc)}},
            upsert=True
        )
        
        return {'success': True, 'requirement': new_req}
    except Exception as e:
        logging.error(f"Error adding document requirement: {e}")
        raise HTTPException(status_code=500, detail='Error al agregar documento')

@documents_router.delete('/admin/document-requirements/{req_id}')
async def delete_document_requirement(req_id: str, current_user: dict = Depends(_require_admin)):
    """Remove a document requirement"""
    try:
        config = await _db.settings.find_one({'_id': 'document_requirements'})
        requirements = config.get('requirements', []) if config else []
        
        requirements = [r for r in requirements if r.get('id') != req_id]
        
        await _db.settings.update_one(
            {'_id': 'document_requirements'},
            {'$set': {'requirements': requirements, 'updated_at': datetime.now(timezone.utc)}},
            upsert=True
        )
        
        return {'success': True, 'message': 'Documento eliminado'}
    except Exception as e:
        logging.error(f"Error deleting document requirement: {e}")
        raise HTTPException(status_code=500, detail='Error al eliminar documento')

# PUBLIC endpoints for document upload (no auth required, uses token)

@documents_router.get('/public/documents/{token}')
async def get_public_document_upload_page(token: str):
    """Get document upload page data by appointment token"""
    try:
        # Find appointment by management token
        appointment = await _db.appointments.find_one({'management_token': token})
        
        if not appointment:
            raise HTTPException(status_code=404, detail='Enlace no válido o expirado')
        
        # Get document requirements config
        config = await _db.settings.find_one({'_id': 'document_requirements'})
        requirements = config.get('requirements', DEFAULT_DOCUMENT_REQUIREMENTS) if config else DEFAULT_DOCUMENT_REQUIREMENTS
        tax_year = config.get('tax_year', 2025) if config else 2025
        
        # Get already uploaded documents for this appointment
        uploaded_docs = await _db.public_documents.find({
            'appointment_token': token
        }).to_list(100)
        
        uploaded_ids = [d.get('requirement_id') for d in uploaded_docs]
        
        # Build requirements with upload status
        requirements_with_status = []
        for req in requirements:
            requirements_with_status.append({
                **req,
                'uploaded': req.get('id') in uploaded_ids,
                'document_id': next((d.get('_id') for d in uploaded_docs if d.get('requirement_id') == req.get('id')), None)
            })
        
        # Calculate progress
        total_required = len([r for r in requirements if r.get('required')])
        uploaded_required = len([r for r in requirements_with_status if r.get('required') and r.get('uploaded')])
        progress = int((uploaded_required / total_required) * 100) if total_required > 0 else 0
        
        return {
            'success': True,
            'client_name': appointment.get('user_name', 'Cliente'),
            'appointment_date': appointment.get('scheduled_at'),
            'tax_year': tax_year,
            'requirements': requirements_with_status,
            'progress': progress,
            'total_uploaded': len(uploaded_docs),
            'total_required': total_required
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting public document page: {e}")
        raise HTTPException(status_code=500, detail='Error al cargar la página')

@documents_router.post('/public/documents/{token}/upload')
async def upload_public_document(token: str, data: dict):
    """Upload a document for an appointment (public, no auth)"""
    try:
        # Verify token
        appointment = await _db.appointments.find_one({'management_token': token})
        if not appointment:
            raise HTTPException(status_code=404, detail='Enlace no válido')
        
        requirement_id = data.get('requirement_id')
        image_data = data.get('image_data')  # Base64 encoded
        file_name = data.get('file_name', 'documento.jpg')
        
        if not requirement_id or not image_data:
            raise HTTPException(status_code=400, detail='Datos incompletos')
        
        # Find the service order associated with this appointment
        service_order = await _db.service_orders.find_one({
            'appointment_id': str(appointment.get('_id'))
        })
        service_order_id = str(service_order['_id']) if service_order else None
        
        # Check if already uploaded
        existing = await _db.public_documents.find_one({
            'appointment_token': token,
            'requirement_id': requirement_id
        })
        
        if existing:
            # Update existing document
            await _db.public_documents.update_one(
                {'_id': existing['_id']},
                {'$set': {
                    'image_data': image_data,
                    'file_name': file_name,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            doc_id = existing['_id']
        else:
            # Create new document
            doc_id = str(uuid.uuid4())
            document = {
                '_id': doc_id,
                'appointment_token': token,
                'appointment_id': str(appointment.get('_id')),
                'service_order_id': service_order_id,
                'user_id': appointment.get('user_id'),
                'user_name': appointment.get('user_name'),
                'user_email': appointment.get('user_email'),
                'requirement_id': requirement_id,
                'file_name': file_name,
                'image_data': image_data,
                'status': 'pending',
                'created_at': datetime.now(timezone.utc)
            }
            await _db.public_documents.insert_one(document)
        
        logging.info(f"✅ Public document uploaded: {requirement_id} for {appointment.get('user_email')}")
        
        # Also save to main documents collection for the user
        try:
            user_id = appointment.get('user_id')
            if user_id:
                main_doc = {
                    '_id': str(uuid.uuid4()),
                    'user_id': user_id,
                    'name': file_name,
                    'category': requirement_id,
                    'file_type': 'image/jpeg',
                    'file_data': image_data,
                    'source': 'public_upload',
                    'appointment_token': token,
                    'service_order_id': service_order_id,
                    'uploaded_at': datetime.now(timezone.utc)
                }
                await _db.documents.insert_one(main_doc)
        except Exception as e:
            logging.warning(f"Could not save to main documents: {e}")
        
        # Update service order with document count
        if service_order_id:
            try:
                doc_count = await _db.public_documents.count_documents({
                    'appointment_token': token
                })
                await _db.service_orders.update_one(
                    {'_id': service_order_id},
                    {'$set': {
                        'documents_count': doc_count,
                        'updated_at': datetime.now(timezone.utc)
                    }}
                )
            except Exception as e:
                logging.warning(f"Could not update service order doc count: {e}")
        
        return {
            'success': True,
            'document_id': doc_id,
            'message': 'Documento subido exitosamente'
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error uploading public document: {e}")
        raise HTTPException(status_code=500, detail='Error al subir documento')

@documents_router.delete('/public/documents/{token}/{doc_id}')
async def delete_public_document(token: str, doc_id: str):
    """Delete a document (public, uses token for auth)"""
    try:
        # Verify token owns this document
        document = await _db.public_documents.find_one({
            '_id': doc_id,
            'appointment_token': token
        })
        
        if not document:
            raise HTTPException(status_code=404, detail='Documento no encontrado')
        
        await _db.public_documents.delete_one({'_id': doc_id})
        
        return {'success': True, 'message': 'Documento eliminado'}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting public document: {e}")
        raise HTTPException(status_code=500, detail='Error al eliminar')

@documents_router.get('/admin/client-documents/{user_id}')
async def get_client_public_documents(user_id: str, current_user: dict = Depends(_require_admin)):
    """Get all public documents uploaded by a client"""
    try:
        documents = await _db.public_documents.find({
            'user_id': user_id
        }).sort('created_at', -1).to_list(100)
        
        # Get requirements config for names
        config = await _db.settings.find_one({'_id': 'document_requirements'})
        requirements = config.get('requirements', DEFAULT_DOCUMENT_REQUIREMENTS) if config else DEFAULT_DOCUMENT_REQUIREMENTS
        req_names = {r.get('id'): r.get('name') for r in requirements}
        
        for doc in documents:
            doc['_id'] = str(doc['_id'])
            doc['requirement_name'] = req_names.get(doc.get('requirement_id'), doc.get('requirement_id'))
            # Don't send image_data in list view
            doc.pop('image_data', None)
        
        return {'documents': documents}
    except Exception as e:
        logging.error(f"Error getting client documents: {e}")
        raise HTTPException(status_code=500, detail='Error al obtener documentos')

@documents_router.get('/admin/public-documents/{doc_id}')
async def get_public_document_detail(doc_id: str, current_user: dict = Depends(_require_admin)):
    """Get a specific public document with image data"""
    try:
        document = await _db.public_documents.find_one({'_id': doc_id})
        
        if not document:
            raise HTTPException(status_code=404, detail='Documento no encontrado')
        
        document['_id'] = str(document['_id'])
        return document
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting document detail: {e}")
        raise HTTPException(status_code=500, detail='Error al obtener documento')



