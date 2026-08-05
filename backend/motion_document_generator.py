"""
Motion Document Generator Service
Generates bilingual (Spanish/English) immigration motion documents
Using AI for content generation and reportlab/python-docx for PDF/Word output
"""

import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from dotenv import load_dotenv
from io import BytesIO
import base64

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Motion document templates
COURT_CLOSURE_TEMPLATE_ES = """
INSTRUCCIONES PARA EL CLIENTE (ESPAÑOL):

MOCIÓN PARA EL CIERRE ADMINISTRATIVO DEL CASO

Antes el Tribunal de Inmigración de {court_name}
{court_address}

En el Asunto de:
{client_name}
Número A: {a_number}

Fecha: {date}

Motivo de la Moción:
El respondente, {client_name}, respetuosamente solicita a este Honorable Tribunal que conceda el cierre administrativo de los procedimientos de deportación.

Fundamentos de la Solicitud:
1. El respondente ha presentado una solicitud de ajuste de estatus (Formulario I-485) ante USCIS.
2. El recibo de dicha solicitud tiene número: {residence_receipt_number}
3. El respondente tiene un caso pendiente con USCIS que hace innecesario continuar con los procedimientos ante este Tribunal.
4. El cierre administrativo permitirá que USCIS adjudique la solicitud de ajuste de estatus del respondente.

Dirección Actual del Respondente:
{current_address}

{family_section}

Notas Adicionales:
{notes}

Por lo expuesto, el respondente solicita respetuosamente que este Tribunal:
1. Conceda el cierre administrativo del caso.
2. Otorgue cualquier otro alivio que el Tribunal considere justo y apropiado.

Respetuosamente sometido,

______________________________
{client_name}
Respondente, Pro Se
Dirección: {current_address}
Teléfono: {phone}
Email: {email}

Fecha: {date}
"""

COURT_CLOSURE_TEMPLATE_EN = """
MOTION FOR ADMINISTRATIVE CLOSURE

Before the Immigration Court at {court_name}
{court_address}

In the Matter of:
{client_name}
A-Number: {a_number}

Date: {date}

Motion for Administrative Closure

Respondent, {client_name}, respectfully moves this Honorable Court to grant administrative closure of removal proceedings.

Grounds for the Motion:
1. Respondent has filed an application for adjustment of status (Form I-485) with USCIS.
2. The receipt number for said application is: {residence_receipt_number}
3. Respondent has a pending case with USCIS that renders continuation of proceedings before this Court unnecessary.
4. Administrative closure will allow USCIS to adjudicate Respondent's adjustment of status application.

Respondent's Current Address:
{current_address}

{family_section}

Additional Notes:
{notes}

WHEREFORE, Respondent respectfully requests that this Court:
1. Grant administrative closure of the case.
2. Grant any other relief that the Court deems just and proper.

Respectfully submitted,

______________________________
{client_name}
Respondent, Pro Se
Address: {current_address}
Phone: {phone}
Email: {email}

Date: {date}
"""

COURT_TRANSFER_TEMPLATE_ES = """
INSTRUCCIONES PARA EL CLIENTE (ESPAÑOL):

MOCIÓN PARA CAMBIO DE SEDE

Antes el Tribunal de Inmigración de {current_court_name}
{current_court_address}

En el Asunto de:
{client_name}
Número A: {a_number}

Fecha: {date}

Motivo de la Moción:
El respondente, {client_name}, respetuosamente solicita a este Honorable Tribunal que conceda el cambio de sede de los procedimientos al Tribunal de Inmigración en:

{destination_court_name}
{destination_court_address}

Fundamentos de la Solicitud:
1. El respondente se ha mudado permanentemente a una nueva dirección fuera de la jurisdicción de este Tribunal.
2. Nueva Dirección del Respondente: {new_address}
3. Razón del traslado: {justification_reason}
4. Justificación detallada: {justification}

{host_section}

Dirección Anterior del Respondente:
{current_address}

{family_section}

Documentos Adjuntos:
- Comprobante de nueva dirección (bill de utilidades o licencia de conducir)
- Identificación con nueva dirección (si aplica)
{host_documents}

Notas Adicionales:
{notes}

Por lo expuesto, el respondente solicita respetuosamente que este Tribunal:
1. Conceda el cambio de sede al Tribunal de Inmigración en {destination_court_name}.
2. Otorgue cualquier otro alivio que el Tribunal considere justo y apropiado.

Respetuosamente sometido,

______________________________
{client_name}
Respondente, Pro Se
Nueva Dirección: {new_address}
Teléfono: {phone}
Email: {email}

Fecha: {date}
"""

COURT_TRANSFER_TEMPLATE_EN = """
MOTION FOR CHANGE OF VENUE

Before the Immigration Court at {current_court_name}
{current_court_address}

In the Matter of:
{client_name}
A-Number: {a_number}

Date: {date}

Motion for Change of Venue

Respondent, {client_name}, respectfully moves this Honorable Court to grant a change of venue of proceedings to the Immigration Court at:

{destination_court_name}
{destination_court_address}

Grounds for the Motion:
1. Respondent has permanently relocated to a new address outside the jurisdiction of this Court.
2. Respondent's New Address: {new_address}
3. Reason for relocation: {justification_reason}
4. Detailed justification: {justification}

{host_section}

Respondent's Previous Address:
{current_address}

{family_section}

Attached Documents:
- Proof of new address (utility bill or driver's license)
- ID with new address (if applicable)
{host_documents}

Additional Notes:
{notes}

WHEREFORE, Respondent respectfully requests that this Court:
1. Grant change of venue to the Immigration Court at {destination_court_name}.
2. Grant any other relief that the Court deems just and proper.

Respectfully submitted,

______________________________
{client_name}
Respondent, Pro Se
New Address: {new_address}
Phone: {phone}
Email: {email}

Date: {date}
"""


class MotionDocumentGenerator:
    """Service for generating immigration motion documents"""
    
    def __init__(self, db=None):
        self.db = db
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        self.pdfs_dir = "/app/backend/motion_pdfs"
        os.makedirs(self.pdfs_dir, exist_ok=True)
        logger.info("✅ Motion Document Generator initialized")
    
    def _format_date(self, date: datetime = None) -> str:
        """Format date for documents"""
        d = date or datetime.utcnow()
        return d.strftime("%B %d, %Y")
    
    def _format_date_es(self, date: datetime = None) -> str:
        """Format date for documents in Spanish"""
        d = date or datetime.utcnow()
        months_es = {
            1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
            5: "mayo", 6: "junio", 7: "julio", 8: "agosto",
            9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre"
        }
        return f"{d.day} de {months_es[d.month]} de {d.year}"
    
    def _format_family_section_es(self, family_members: list) -> str:
        """Format family members section in Spanish"""
        if not family_members:
            return ""
        
        section = "Miembros de la Familia Incluidos en Esta Moción:\n"
        for i, member in enumerate(family_members, 1):
            name = member.get("full_name", "")
            a_num = member.get("a_number", "")
            rel = member.get("relationship", "")
            section += f"{i}. {name} (A#: {a_num}) - Relación: {rel}\n"
        return section
    
    def _format_family_section_en(self, family_members: list) -> str:
        """Format family members section in English"""
        if not family_members:
            return ""
        
        section = "Family Members Included in This Motion:\n"
        for i, member in enumerate(family_members, 1):
            name = member.get("full_name", "")
            a_num = member.get("a_number", "")
            rel = member.get("relationship", "")
            section += f"{i}. {name} (A#: {a_num}) - Relationship: {rel}\n"
        return section
    
    def _format_host_section_es(self, host_info: dict) -> str:
        """Format host information section in Spanish"""
        if not host_info:
            return ""
        
        name = host_info.get("full_name", "")
        address = host_info.get("address", "")
        phone = host_info.get("phone", "")
        rel = host_info.get("relationship", "")
        
        section = f"""Información del Anfitrión:
El respondente vivirá con:
Nombre: {name}
Dirección: {address}
Teléfono: {phone}
Relación con el respondente: {rel}
"""
        return section
    
    def _format_host_section_en(self, host_info: dict) -> str:
        """Format host information section in English"""
        if not host_info:
            return ""
        
        name = host_info.get("full_name", "")
        address = host_info.get("address", "")
        phone = host_info.get("phone", "")
        rel = host_info.get("relationship", "")
        
        section = f"""Host Information:
Respondent will reside with:
Name: {name}
Address: {address}
Phone: {phone}
Relationship to Respondent: {rel}
"""
        return section
    
    def _get_justification_reason_text(self, reason: str, lang: str = "en") -> str:
        """Get human readable justification reason"""
        reasons_en = {
            "work": "Employment relocation",
            "family": "Family reunification",
            "housing": "Housing change",
            "other": "Other personal reasons"
        }
        reasons_es = {
            "work": "Mudanza por trabajo",
            "family": "Reunificación familiar",
            "housing": "Cambio de vivienda",
            "other": "Otras razones personales"
        }
        
        if lang == "es":
            return reasons_es.get(reason, reason or "No especificado")
        return reasons_en.get(reason, reason or "Not specified")
    
    def generate_court_closure_motion(self, motion_data: Dict[str, Any]) -> Tuple[str, str]:
        """Generate court closure motion in both languages"""
        
        # Extract data
        client_name = motion_data.get("client_name", "")
        a_number = motion_data.get("a_number", "N/A")
        current_address = motion_data.get("current_address", "")
        court_name = motion_data.get("current_court", "Immigration Court")
        court_address = motion_data.get("current_court_address", "")
        phone = motion_data.get("client_phone", "")
        email = motion_data.get("client_email", "")
        notes = motion_data.get("notes", "N/A")
        family_members = motion_data.get("family_members", [])
        
        # Get receipt number from documents or notes
        residence_receipt_number = "[PENDING - To be filled from uploaded documents]"
        
        # Format sections
        family_section_es = self._format_family_section_es(family_members)
        family_section_en = self._format_family_section_en(family_members)
        
        # Generate Spanish version
        content_es = COURT_CLOSURE_TEMPLATE_ES.format(
            court_name=court_name,
            court_address=court_address,
            client_name=client_name,
            a_number=a_number,
            date=self._format_date_es(),
            residence_receipt_number=residence_receipt_number,
            current_address=current_address,
            family_section=family_section_es,
            notes=notes or "Ninguna",
            phone=phone,
            email=email
        )
        
        # Generate English version
        content_en = COURT_CLOSURE_TEMPLATE_EN.format(
            court_name=court_name,
            court_address=court_address,
            client_name=client_name,
            a_number=a_number,
            date=self._format_date(),
            residence_receipt_number=residence_receipt_number,
            current_address=current_address,
            family_section=family_section_en,
            notes=notes or "None",
            phone=phone,
            email=email
        )
        
        return content_es, content_en
    
    def generate_court_transfer_motion(self, motion_data: Dict[str, Any]) -> Tuple[str, str]:
        """Generate court transfer motion in both languages"""
        
        # Extract data
        client_name = motion_data.get("client_name", "")
        a_number = motion_data.get("a_number", "N/A")
        current_address = motion_data.get("current_address", "")
        new_address = motion_data.get("new_address", "")
        
        current_court_name = motion_data.get("current_court", "Immigration Court")
        current_court_address = motion_data.get("current_court_address", "")
        destination_court_name = motion_data.get("destination_court", "Immigration Court")
        destination_court_address = motion_data.get("destination_court_address", "")
        
        phone = motion_data.get("client_phone", "")
        email = motion_data.get("client_email", "")
        notes = motion_data.get("notes", "N/A")
        
        justification_reason = motion_data.get("justification_reason", "")
        justification = motion_data.get("justification", "")
        
        family_members = motion_data.get("family_members", [])
        host_info = motion_data.get("host_info", None)
        
        # Format sections
        family_section_es = self._format_family_section_es(family_members)
        family_section_en = self._format_family_section_en(family_members)
        host_section_es = self._format_host_section_es(host_info) if host_info else ""
        host_section_en = self._format_host_section_en(host_info) if host_info else ""
        
        host_documents = "- Identificación del anfitrión\n- Bill del anfitrión\n- Declaración del anfitrión" if host_info else ""
        host_documents_en = "- Host's ID\n- Host's utility bill\n- Host's statement" if host_info else ""
        
        # Generate Spanish version
        content_es = COURT_TRANSFER_TEMPLATE_ES.format(
            current_court_name=current_court_name,
            current_court_address=current_court_address,
            destination_court_name=destination_court_name,
            destination_court_address=destination_court_address,
            client_name=client_name,
            a_number=a_number,
            date=self._format_date_es(),
            new_address=new_address,
            current_address=current_address,
            justification_reason=self._get_justification_reason_text(justification_reason, "es"),
            justification=justification or "No especificada",
            family_section=family_section_es,
            host_section=host_section_es,
            host_documents=host_documents,
            notes=notes or "Ninguna",
            phone=phone,
            email=email
        )
        
        # Generate English version  
        content_en = COURT_TRANSFER_TEMPLATE_EN.format(
            current_court_name=current_court_name,
            current_court_address=current_court_address,
            destination_court_name=destination_court_name,
            destination_court_address=destination_court_address,
            client_name=client_name,
            a_number=a_number,
            date=self._format_date(),
            new_address=new_address,
            current_address=current_address,
            justification_reason=self._get_justification_reason_text(justification_reason, "en"),
            justification=justification or "Not specified",
            family_section=family_section_en,
            host_section=host_section_en,
            host_documents=host_documents_en,
            notes=notes or "None",
            phone=phone,
            email=email
        )
        
        return content_es, content_en
    
    def generate_motion_content(self, motion_data: Dict[str, Any]) -> Tuple[str, str]:
        """Generate motion content based on type"""
        motion_type = motion_data.get("motion_type", "")
        
        if motion_type == "court_closure":
            return self.generate_court_closure_motion(motion_data)
        elif motion_type == "court_transfer":
            return self.generate_court_transfer_motion(motion_data)
        else:
            raise ValueError(f"Unknown motion type: {motion_type}")
    
    async def enhance_with_ai(self, content_es: str, content_en: str, motion_data: Dict[str, Any]) -> Tuple[str, str]:
        """Use AI to enhance the motion content with more professional language"""
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            motion_type = motion_data.get("motion_type", "")
            type_label = "cierre administrativo" if motion_type == "court_closure" else "cambio de sede"
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"motion-gen-{uuid.uuid4().hex[:8]}",
                system_message="""You are a legal document specialist who enhances immigration motion documents.
Your task is to improve the legal language while keeping all factual information intact.
Do not add fictional information. Only enhance the existing content with more professional legal phrasing.
Maintain the exact same structure and format of the document.
Respond with ONLY the enhanced document, no additional commentary."""
            ).with_model("openai", "gpt-5.2")
            
            # Enhance English version
            user_message_en = UserMessage(
                text=f"""Enhance this immigration motion for {type_label} with more professional legal language. 
Keep all factual information (names, addresses, numbers) exactly the same.
Only improve the legal phrasing and formality:

{content_en}"""
            )
            
            enhanced_en = await chat.send_message(user_message_en)
            
            logger.info(f"✅ Motion content enhanced with AI")
            return content_es, enhanced_en  # Keep Spanish as-is (client version), enhance English (court version)
            
        except Exception as e:
            logger.error(f"Error enhancing motion with AI: {e}")
            # Return original content if AI enhancement fails
            return content_es, content_en
    
    def generate_pdf(self, content: str, title: str, motion_number: str, lang: str = "en") -> str:
        """Generate PDF document from motion content"""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
            
            # Create PDF file
            filename = f"motion_{motion_number}_{lang}_{uuid.uuid4().hex[:6]}.pdf"
            filepath = os.path.join(self.pdfs_dir, filename)
            
            doc = SimpleDocTemplate(filepath, pagesize=letter,
                                   rightMargin=72, leftMargin=72,
                                   topMargin=72, bottomMargin=72)
            
            styles = getSampleStyleSheet()
            
            # Custom styles
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=14,
                textColor=colors.HexColor('#1a1a1a'),
                spaceAfter=20,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            body_style = ParagraphStyle(
                'CustomBody',
                parent=styles['Normal'],
                fontSize=11,
                textColor=colors.HexColor('#333333'),
                spaceAfter=12,
                leading=14,
                alignment=TA_JUSTIFY
            )
            
            # Build content
            story = []
            
            # Title
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 0.3*inch))
            
            # Content - split by newlines and create paragraphs
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if line:
                    # Escape special characters for reportlab
                    line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    try:
                        story.append(Paragraph(line, body_style))
                    except Exception:
                        # If paragraph fails, add as plain text
                        story.append(Paragraph(line.encode('ascii', 'ignore').decode('ascii'), body_style))
                else:
                    story.append(Spacer(1, 0.15*inch))
            
            # Build PDF
            doc.build(story)
            
            logger.info(f"📄 PDF generated: {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"Error generating PDF: {e}")
            raise
    
    async def generate_motion_documents(
        self,
        motion_id: str,
        use_ai_enhancement: bool = False
    ) -> Dict[str, Any]:
        """Generate complete motion documents (PDF in both languages)"""
        try:
            # Fetch motion from database
            motion = await self.db.immigration_motions.find_one({"id": motion_id})
            if not motion:
                raise ValueError(f"Motion not found: {motion_id}")
            
            motion_data = dict(motion)
            motion_number = motion_data.get("motion_number", motion_id[:8])
            motion_type = motion_data.get("motion_type", "")
            
            # Generate base content
            content_es, content_en = self.generate_motion_content(motion_data)
            
            # Optionally enhance with AI
            if use_ai_enhancement and self.api_key:
                content_es, content_en = await self.enhance_with_ai(content_es, content_en, motion_data)
            
            # Generate titles
            if motion_type == "court_closure":
                title_es = "MOCIÓN PARA EL CIERRE ADMINISTRATIVO DEL CASO"
                title_en = "MOTION FOR ADMINISTRATIVE CLOSURE"
            else:
                title_es = "MOCIÓN PARA CAMBIO DE SEDE"
                title_en = "MOTION FOR CHANGE OF VENUE"
            
            # Generate PDFs
            pdf_es_path = self.generate_pdf(content_es, title_es, motion_number, "es")
            pdf_en_path = self.generate_pdf(content_en, title_en, motion_number, "en")
            
            # Store the generated content in the motion document
            await self.db.immigration_motions.update_one(
                {"id": motion_id},
                {"$set": {
                    "motion_content_es": content_es,
                    "motion_content_en": content_en,
                    "generated_at": datetime.utcnow(),
                    "pdf_es_path": pdf_es_path,
                    "pdf_en_path": pdf_en_path,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            # Generate download URLs
            pdf_es_filename = os.path.basename(pdf_es_path)
            pdf_en_filename = os.path.basename(pdf_en_path)
            
            logger.info(f"✅ Motion documents generated for {motion_number}")
            
            return {
                "success": True,
                "motion_id": motion_id,
                "motion_number": motion_number,
                "content_es": content_es,
                "content_en": content_en,
                "pdf_es_url": f"/api/motions/documents/pdf/{pdf_es_filename}",
                "pdf_en_url": f"/api/motions/documents/pdf/{pdf_en_filename}",
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating motion documents: {e}")
            raise
    
    def get_pdf_file(self, filename: str) -> Optional[bytes]:
        """Get PDF file content by filename"""
        filepath = os.path.join(self.pdfs_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'rb') as f:
                return f.read()
        return None
