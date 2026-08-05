"""
PDF Tax Document Extraction API Routes
Endpoints for extracting client data from tax return PDFs
"""

import os
import io
import csv
import zipfile
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pdf_extractor import (
    create_batch,
    process_single_pdf,
    get_batch_status,
    get_batch_results,
    save_contact_list,
    merge_pdf_and_contacts,
    get_merged_records,
    export_to_ach_format,
    pdf_batches_collection,
    pdf_extractions_collection,
    contact_lists_collection,
    merged_records_collection
)

router = APIRouter(prefix="/api/admin/pdf-extractor", tags=["PDF Extractor"])

# ==================== MODELS ====================

class ContactItem(BaseModel):
    nombre_completo: Optional[str] = ""
    nombre: Optional[str] = ""
    apellido: Optional[str] = ""
    direccion: Optional[str] = ""
    email: Optional[str] = ""
    telefono: Optional[str] = ""

class ContactListUpload(BaseModel):
    contacts: List[ContactItem]
    list_name: Optional[str] = None

class MergeRequest(BaseModel):
    batch_id: str
    contact_list_id: str

class ExtractionUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    estado: Optional[str] = None
    codigo_postal: Optional[str] = None
    routing_number: Optional[str] = None
    account_number: Optional[str] = None
    monto_reembolso: Optional[str] = None

# ==================== BATCH UPLOAD ENDPOINTS ====================

@router.post("/batch/upload")
async def upload_pdf_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    batch_name: Optional[str] = Form(None),
    user_id: str = Form("admin")
):
    """
    Upload multiple PDFs for batch processing.
    Accepts individual PDF files or a ZIP containing PDFs.
    """
    
    # Create batch
    batch_id = await create_batch(user_id, batch_name)
    
    pdf_files = []
    
    for file in files:
        content = await file.read()
        
        # Check if it's a ZIP file
        if file.filename.lower().endswith('.zip'):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    for name in zf.namelist():
                        if name.lower().endswith('.pdf') and not name.startswith('__MACOSX'):
                            pdf_content = zf.read(name)
                            pdf_files.append({
                                "filename": os.path.basename(name),
                                "content": pdf_content
                            })
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail=f"Archivo ZIP inválido: {file.filename}")
        
        elif file.filename.lower().endswith('.pdf'):
            pdf_files.append({
                "filename": file.filename,
                "content": content
            })
        else:
            # Skip non-PDF files
            continue
    
    if not pdf_files:
        raise HTTPException(status_code=400, detail="No se encontraron archivos PDF válidos")
    
    # Update batch with file count
    await pdf_batches_collection.update_one(
        {"_id": batch_id},
        {
            "$set": {
                "total_files": len(pdf_files),
                "status": "processing"
            }
        }
    )
    
    # Process files in background
    async def process_batch():
        processed = 0
        successful = 0
        failed = 0
        
        for pdf_file in pdf_files:
            try:
                result = await process_single_pdf(
                    pdf_file["content"],
                    pdf_file["filename"],
                    batch_id
                )
                
                if result.get("status") == "completed":
                    successful += 1
                else:
                    failed += 1
                    
            except Exception as e:
                failed += 1
                print(f"Error processing {pdf_file['filename']}: {e}")
            
            processed += 1
            
            # Update progress
            await pdf_batches_collection.update_one(
                {"_id": batch_id},
                {
                    "$set": {
                        "processed_files": processed,
                        "successful_files": successful,
                        "failed_files": failed
                    }
                }
            )
        
        # Mark batch as complete
        await pdf_batches_collection.update_one(
            {"_id": batch_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow()
                }
            }
        )
    
    background_tasks.add_task(process_batch)
    
    return {
        "success": True,
        "batch_id": batch_id,
        "total_files": len(pdf_files),
        "message": f"Procesando {len(pdf_files)} archivos PDF en segundo plano"
    }


@router.get("/batch/{batch_id}/status")
async def get_batch_processing_status(batch_id: str):
    """Get the processing status of a batch"""
    
    batch = await get_batch_status(batch_id)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    return batch


@router.get("/batch/{batch_id}/results")
async def get_batch_extraction_results(
    batch_id: str,
    include_low_confidence: bool = True
):
    """Get all extraction results for a batch"""
    
    results = await get_batch_results(batch_id, include_low_confidence)
    
    return {
        "success": True,
        "batch_id": batch_id,
        "total_results": len(results),
        "results": results
    }


@router.get("/debug/latest")
async def debug_latest_extractions():
    """Debug endpoint - get latest 10 extractions with all details including errors"""
    
    extractions = await pdf_extractions_collection.find().sort("completed_at", -1).limit(10).to_list(10)
    
    for e in extractions:
        if isinstance(e.get("_id"), str):
            e["id"] = e["_id"]
        else:
            e["id"] = str(e["_id"])
    
    return {
        "success": True,
        "count": len(extractions),
        "extractions": extractions
    }


@router.post("/extraction/{extraction_id}/reprocess")
async def reprocess_extraction(
    extraction_id: str,
    background_tasks: BackgroundTasks
):
    """Reprocess a single failed extraction"""
    
    # Get original extraction
    extraction = await pdf_extractions_collection.find_one({"_id": extraction_id})
    
    if not extraction:
        raise HTTPException(status_code=404, detail="Extracción no encontrada")
    
    # For reprocessing, we'd need the original PDF stored somewhere
    # For now, just mark it for manual review
    await pdf_extractions_collection.update_one(
        {"_id": extraction_id},
        {
            "$set": {
                "status": "pending_review",
                "reprocess_requested_at": datetime.utcnow()
            }
        }
    )
    
    return {
        "success": True,
        "message": "Marcado para revisión manual"
    }


@router.put("/extraction/{extraction_id}")
async def update_extraction(
    extraction_id: str,
    updates: ExtractionUpdate
):
    """Manually update extraction data"""
    
    update_data = {}
    
    for field, value in updates.dict(exclude_none=True).items():
        update_data[f"extracted_data.{field}"] = value
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    # Also update nombre_completo if nombre or apellido changed
    if "extracted_data.nombre" in update_data or "extracted_data.apellido" in update_data:
        extraction = await pdf_extractions_collection.find_one({"_id": extraction_id})
        if extraction:
            current_data = extraction.get("extracted_data", {})
            nombre = updates.nombre if updates.nombre else current_data.get("nombre", "")
            apellido = updates.apellido if updates.apellido else current_data.get("apellido", "")
            update_data["extracted_data.nombre_completo"] = f"{nombre} {apellido}".strip()
    
    update_data["manually_edited"] = True
    update_data["edited_at"] = datetime.utcnow()
    
    result = await pdf_extractions_collection.update_one(
        {"_id": extraction_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Extracción no encontrada")
    
    return {"success": True, "message": "Datos actualizados"}


@router.delete("/extraction/{extraction_id}")
async def delete_extraction(extraction_id: str):
    """Delete an extraction result"""
    
    result = await pdf_extractions_collection.delete_one({"_id": extraction_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Extracción no encontrada")
    
    return {"success": True, "message": "Extracción eliminada"}


# ==================== CONTACT LIST ENDPOINTS ====================

@router.post("/contacts/upload")
async def upload_contact_list(
    data: ContactListUpload,
    user_id: str = "admin"
):
    """Upload a contact list for merging with PDF extractions"""
    
    contacts = [c.dict() for c in data.contacts]
    
    if not contacts:
        raise HTTPException(status_code=400, detail="Lista de contactos vacía")
    
    list_id = await save_contact_list(user_id, contacts, data.list_name)
    
    return {
        "success": True,
        "list_id": list_id,
        "total_contacts": len(contacts),
        "message": f"Lista guardada con {len(contacts)} contactos"
    }


@router.post("/contacts/upload-csv")
async def upload_contact_csv(
    file: UploadFile = File(...),
    list_name: Optional[str] = Form(None),
    user_id: str = Form("admin")
):
    """Upload contacts from a CSV file"""
    
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe ser CSV")
    
    content = await file.read()
    
    try:
        # Try different encodings
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                text_content = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(status_code=400, detail="No se pudo decodificar el archivo")
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(text_content))
        contacts = []
        
        # Column mapping (flexible)
        column_map = {
            'nombre_completo': ['nombre_completo', 'nombre completo', 'full_name', 'fullname', 'name', 'nombre'],
            'nombre': ['nombre', 'first_name', 'firstname', 'first'],
            'apellido': ['apellido', 'apellidos', 'last_name', 'lastname', 'last'],
            'direccion': ['direccion', 'dirección', 'address', 'address1', 'domicilio'],
            'email': ['email', 'correo', 'e-mail', 'mail'],
            'telefono': ['telefono', 'teléfono', 'phone', 'tel', 'celular', 'movil']
        }
        
        for row in reader:
            contact = {}
            
            # Normalize column names (lowercase, strip)
            normalized_row = {k.lower().strip(): v for k, v in row.items()}
            
            for field, aliases in column_map.items():
                for alias in aliases:
                    if alias in normalized_row:
                        contact[field] = normalized_row[alias]
                        break
                else:
                    contact[field] = ""
            
            contacts.append(contact)
        
        if not contacts:
            raise HTTPException(status_code=400, detail="No se encontraron contactos en el CSV")
        
        list_id = await save_contact_list(user_id, contacts, list_name or file.filename)
        
        return {
            "success": True,
            "list_id": list_id,
            "total_contacts": len(contacts),
            "message": f"CSV procesado: {len(contacts)} contactos"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error procesando CSV: {str(e)}")


@router.get("/contacts/lists")
async def get_contact_lists(user_id: str = "admin"):
    """Get all contact lists"""
    
    lists = []
    async for doc in contact_lists_collection.find({"user_id": user_id}).sort("created_at", -1):
        doc["id"] = doc["_id"]
        lists.append(doc)
    
    return {"success": True, "lists": lists}


@router.get("/contacts/{list_id}")
async def get_contact_list(list_id: str):
    """Get a specific contact list"""
    
    doc = await contact_lists_collection.find_one({"_id": list_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    
    doc["id"] = doc["_id"]
    return doc


# ==================== MERGE & EXPORT ENDPOINTS ====================

@router.post("/merge")
async def merge_pdfs_and_contacts(request: MergeRequest, user_id: str = "admin"):
    """Merge PDF extractions with contact list"""
    
    try:
        result = await merge_pdf_and_contacts(
            request.batch_id,
            request.contact_list_id,
            user_id
        )
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/merged/{batch_id}/{contact_list_id}")
async def get_merged_data(
    batch_id: str,
    contact_list_id: str,
    only_matched: bool = False
):
    """Get merged records"""
    
    records = await get_merged_records(batch_id, contact_list_id, only_matched)
    
    return {
        "success": True,
        "total_records": len(records),
        "records": records
    }


@router.get("/export/csv/{batch_id}/{contact_list_id}")
async def export_csv(batch_id: str, contact_list_id: str):
    """Export merged data as CSV"""
    
    records = await get_merged_records(batch_id, contact_list_id)
    
    if not records:
        raise HTTPException(status_code=404, detail="No hay registros para exportar")
    
    # Create CSV
    output = io.StringIO()
    
    fieldnames = [
        'nombre_completo', 'nombre', 'apellido', 'email', 'telefono',
        'direccion_pdf', 'ciudad', 'estado', 'codigo_postal',
        'routing_number', 'account_number', 'monto_reembolso',
        'matched', 'confianza_pdf', 'archivo_origen'
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for record in records:
        writer.writerow(record)
    
    output.seek(0)
    
    filename = f"extraccion_clientes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/ach/{batch_id}/{contact_list_id}")
async def export_ach_format(batch_id: str, contact_list_id: str):
    """Export data in ACH Customer Vault format for direct import"""
    
    ach_records = await export_to_ach_format(batch_id, contact_list_id)
    
    if not ach_records:
        raise HTTPException(status_code=404, detail="No hay registros válidos para ACH")
    
    return {
        "success": True,
        "total_records": len(ach_records),
        "records": ach_records,
        "message": f"{len(ach_records)} registros listos para importar a Customer Vault"
    }


# ==================== BATCH LIST ENDPOINT ====================

@router.get("/batches")
async def list_batches(user_id: str = "admin"):
    """List all PDF processing batches"""
    
    batches = []
    async for doc in pdf_batches_collection.find({"user_id": user_id}).sort("created_at", -1).limit(50):
        doc["id"] = doc["_id"]
        batches.append(doc)
    
    return {"success": True, "batches": batches}


@router.delete("/batch/{batch_id}")
async def delete_batch(batch_id: str):
    """Delete a batch and all its extractions"""
    
    # Delete extractions
    await pdf_extractions_collection.delete_many({"batch_id": batch_id})
    
    # Delete merged records
    await merged_records_collection.delete_many({"batch_id": batch_id})
    
    # Delete batch
    result = await pdf_batches_collection.delete_one({"_id": batch_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    return {"success": True, "message": "Lote eliminado"}


# ============================================
# ROUTING NUMBER LOOKUP ENDPOINTS
# ============================================

from routing_lookup import lookup_routing_number, validate_routing_with_bank

@router.get("/routing-lookup/{routing_number}")
async def lookup_routing(routing_number: str):
    """
    Consulta información del banco por routing number
    
    Ejemplo: GET /api/admin/pdf-extractor/routing-lookup/091000019
    """
    result = await lookup_routing_number(routing_number)
    return result


@router.post("/routing-lookup")
async def lookup_routing_post(routing_number: str = Form(...)):
    """
    Consulta información del banco por routing number (POST)
    """
    result = await lookup_routing_number(routing_number)
    return result


@router.get("/routing-validate/{routing_number}")
async def validate_routing(routing_number: str):
    """
    Valida un routing number y devuelve info básica del banco
    """
    result = await validate_routing_with_bank(routing_number)
    return result
