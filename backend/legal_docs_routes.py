"""
Legal Documents API - Admin Only
Serves PDF legal documents stored in /legal_docs/ directory
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

LEGAL_DOCS_DIR = os.path.join(os.path.dirname(__file__), "legal_docs")

# Registry of all legal documents with metadata
# Format matches what the frontend (Ross Lending + Ross Tax admin panels) expect
LEGAL_DOCUMENTS = [
    # ═══ ROSS LENDING DOCUMENTS ═══
    {
        "id": "operating_agreement",
        "filename": "Ross_Lending_Solutions_LLC_Operating_Agreement.pdf",
        "title": "Operating Agreement - Ross Lending Solutions LLC",
        "description": "Acuerdo Operativo de LLC de Miembro Unico. Define la estructura de gobierno, responsabilidades del miembro unico, contribuciones de capital, distribuciones y disolucion.",
        "category": "OCCC / Regulatorio",
        "icon": "📜",
        "date_label": "Fecha del Certificate of Formation",
        "entity": "ross_lending",
    },
    {
        "id": "aml_bsa_en",
        "filename": "RossLending_AML_BSA_Compliance_Program_EN.pdf",
        "title": "AML/BSA Compliance Program (English)",
        "description": "Programa completo de cumplimiento Anti-Lavado de Dinero y Ley de Secreto Bancario. 17 secciones incluyendo CIP, CDD, EDD, OFAC, SAR, CTR y mas. Version en ingles.",
        "category": "OCCC / Regulatorio",
        "icon": "🛡️",
        "date_label": "May 8, 2026",
        "entity": "ross_lending",
    },
    {
        "id": "aml_bsa_es",
        "filename": "RossLending_Programa_AML_BSA_Espanol.pdf",
        "title": "Programa de Cumplimiento AML/BSA (Espanol)",
        "description": "Traduccion completa al espanol del programa AML/BSA. 17 secciones con politicas, procedimientos, tablas de retencion de registros y calendario de capacitacion.",
        "category": "OCCC / Regulatorio",
        "icon": "🛡️",
        "date_label": "8 de mayo de 2026",
        "entity": "ross_lending",
    },
    {
        "id": "capital_contribution_resolution",
        "filename": "Resolution_RossLending_Capital_Contribution.pdf",
        "title": "Member Resolution - Contribucion de Capital ($27,400)",
        "description": "Resolucion del Miembro documentando la contribucion de capital de $27,400 depositada en Happy State Bank el 8 de mayo de 2026. Referencia Art. III del Operating Agreement.",
        "category": "Due Diligence Bancario",
        "icon": "🏦",
        "date_label": "May 8, 2026",
        "entity": "ross_lending",
    },
    {
        "id": "business_plan",
        "filename": "Ross_Lending_Solutions_Business_Plan_2026_2028.pdf",
        "title": "Plan de Negocios 2026-2028 (Espanol)",
        "description": "Plan de negocios completo con analisis de mercado, tablas de precios de prestamos, proyecciones financieras a 3 anos, estrategia de marketing, plan operativo, cronograma de implementacion y estrategia de crecimiento.",
        "category": "OCCC / Regulatorio",
        "icon": "📊",
        "date_label": "Mayo 2026",
        "entity": "ross_lending",
    },
    {
        "id": "business_plan_en",
        "filename": "Ross_Lending_Solutions_Business_Plan_2026_2028_EN.pdf",
        "title": "Business Plan 2026-2028 (English)",
        "description": "Comprehensive business plan with market analysis, loan pricing tables, 3-year financial projections, marketing strategy, operations plan, implementation timeline and growth strategy. English version.",
        "category": "OCCC / Regulatorio",
        "icon": "📊",
        "date_label": "May 2026",
        "entity": "ross_lending",
    },
    {
        "id": "distribution_resolution",
        "filename": "Resolution_RossTax_Distribution.pdf",
        "title": "Member Resolution - Distribucion de Ganancias ($27,400)",
        "description": "Resolucion de Ross Tax Preparation LLC autorizando la distribucion de $27,400 de ganancias retenidas al miembro unico para ser usadas como capital de Ross Lending.",
        "category": "Due Diligence Bancario",
        "icon": "💰",
        "date_label": "May 7, 2026",
        "entity": "both",
    },
    # ═══ ROSS TAX DOCUMENTS ═══
    {
        "id": "ross_tax_operating_agreement",
        "filename": "Ross_Tax_Preparation_LLC_Operating_Agreement.pdf",
        "title": "Operating Agreement - Ross Tax Preparation LLC",
        "description": "Acuerdo Operativo de LLC de Miembro Unico. Define estructura de gobierno, servicios de preparacion de impuestos y bookkeeping, contribuciones de capital, distribuciones y disolucion. Vigente desde agosto 8, 2024.",
        "category": "Politicas Internas",
        "icon": "📜",
        "date_label": "August 8, 2024",
        "entity": "ross_tax",
    },
    {
        "id": "data_retention_policy",
        "filename": "Ross_Tax_Data_Retention_Disposal_Policy.pdf",
        "title": "Politica de Retencion y Eliminacion de Datos",
        "description": "Politica de retencion de registros y eliminacion segura de datos para Ross Tax Preparation LLC. Cumplimiento con regulaciones federales y estatales de proteccion de datos.",
        "category": "Politicas Internas",
        "icon": "📋",
        "date_label": "",
        "entity": "ross_tax",
    },
    {
        "id": "info_security_policy",
        "filename": "Ross_Tax_Information_Security_Policy.pdf",
        "title": "Politica de Seguridad de la Informacion",
        "description": "Politica integral de seguridad de la informacion para Ross Tax Preparation LLC. Controles de acceso, cifrado, respuesta a incidentes y capacitacion de empleados.",
        "category": "Politicas Internas",
        "icon": "🔒",
        "date_label": "",
        "entity": "ross_tax",
    },
]


@router.get("/api/admin/legal-documents")
async def list_legal_documents(request: Request, entity: str = None):
    """List all legal documents, optionally filtered by entity (ross_lending / ross_tax / both)"""
    from server import get_current_user
    user = await get_current_user(request.headers.get("Authorization", "").replace("Bearer ", ""))
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    docs = LEGAL_DOCUMENTS
    if entity:
        docs = [d for d in docs if d["entity"] == entity or d["entity"] == "both"]

    # Build response with file info
    result = []
    for doc in docs:
        filepath = os.path.join(LEGAL_DOCS_DIR, doc["filename"])
        exists = os.path.exists(filepath)
        size_bytes = os.path.getsize(filepath) if exists else 0
        size_kb = size_bytes / 1024

        result.append({
            "id": doc["id"],
            "filename": doc["filename"],
            "title": doc["title"],
            "description": doc["description"],
            "category": doc["category"],
            "icon": doc["icon"],
            "date_label": doc["date_label"],
            "entity": doc["entity"],
            "size_kb": round(size_kb, 1),
            "available": exists,
            "download_url": f"/api/admin/legal-documents/{doc['id']}/download",
        })

    return {"documents": result, "total": len(result)}


@router.get("/api/admin/legal-documents/{doc_id}/download")
async def download_legal_document(doc_id: str, request: Request):
    """Download a specific legal document PDF"""
    from server import get_current_user
    user = await get_current_user(request.headers.get("Authorization", "").replace("Bearer ", ""))
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    doc = next((d for d in LEGAL_DOCUMENTS if d["id"] == doc_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    filepath = os.path.join(LEGAL_DOCS_DIR, doc["filename"])
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=doc["filename"],
        headers={"Content-Disposition": f'attachment; filename="{doc["filename"]}"'},
    )
