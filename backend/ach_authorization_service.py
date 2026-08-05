"""
ACH Authorization Document Service
Generates PDF consent/authorization documents for ACH recurring payments
"""

import os
import uuid
import base64
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from io import BytesIO

logger = logging.getLogger(__name__)

# Try to import ReportLab for PDF generation
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("ReportLab not available. PDF generation disabled.")


# ==================== PDF STYLES ====================

def get_styles():
    """Get custom PDF styles"""
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        name='DocumentTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=HexColor('#1a1a2e'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='SectionTitle',
        parent=styles['Heading2'],
        fontSize=12,
        spaceBefore=15,
        spaceAfter=8,
        textColor=HexColor('#2d3748'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='ACHBodyText',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
        leading=14
    ))
    
    styles.add(ParagraphStyle(
        name='SmallText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor('#666666'),
        spaceAfter=4
    ))
    
    styles.add(ParagraphStyle(
        name='FieldLabel',
        parent=styles['Normal'],
        fontSize=9,
        textColor=HexColor('#4a5568'),
        fontName='Helvetica-Bold'
    ))
    
    styles.add(ParagraphStyle(
        name='FieldValue',
        parent=styles['Normal'],
        fontSize=10,
        textColor=HexColor('#1a202c')
    ))
    
    styles.add(ParagraphStyle(
        name='FooterText',
        parent=styles['Normal'],
        fontSize=8,
        textColor=HexColor('#718096'),
        alignment=TA_CENTER
    ))
    
    return styles


# ==================== DOCUMENT GENERATOR ====================

class ACHAuthorizationGenerator:
    """Generates ACH authorization/consent documents"""
    
    def __init__(self, company_name: str = "Ross Lending Solutions LLC"):
        self.company_name = company_name
        self.company_address = "1234 Main Street, Houston, TX 77001"
        self.company_phone = "(806) 934-2018"
        self.company_email = "info@rosslending.com"
        
    def generate_authorization_pdf(
        self,
        customer_data: Dict[str, Any],
        bank_data: Dict[str, Any],
        subscription_data: Dict[str, Any],
        authorization_id: Optional[str] = None
    ) -> bytes:
        """
        Generate ACH authorization PDF document
        
        Args:
            customer_data: Customer information (name, address, etc.)
            bank_data: Bank account information (masked account, routing)
            subscription_data: Subscription details (amount, frequency, plan name)
            authorization_id: Optional unique authorization ID
            
        Returns:
            PDF file as bytes
        """
        if not REPORTLAB_AVAILABLE:
            raise RuntimeError("ReportLab is not installed. Cannot generate PDF.")
        
        # Generate authorization ID if not provided
        if not authorization_id:
            authorization_id = f"ACH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        
        # Create PDF buffer
        buffer = BytesIO()
        
        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )
        
        styles = get_styles()
        elements = []
        
        # ====== HEADER ======
        elements.append(Paragraph(self.company_name.upper(), styles['DocumentTitle']))
        elements.append(Paragraph(
            f"{self.company_address}<br/>{self.company_phone} | {self.company_email}",
            styles['SmallText']
        ))
        elements.append(Spacer(1, 10))
        elements.append(HRFlowable(width="100%", thickness=2, color=HexColor('#8B0000')))
        elements.append(Spacer(1, 15))
        
        # ====== DOCUMENT TITLE ======
        elements.append(Paragraph(
            "AUTORIZACIÓN DE DÉBITO BANCARIO ACH<br/><i>ACH Debit Authorization</i>",
            styles['DocumentTitle']
        ))
        elements.append(Spacer(1, 5))
        
        # Authorization ID and Date
        auth_date = datetime.now().strftime("%d de %B, %Y")
        elements.append(Paragraph(
            f"<b>ID de Autorización:</b> {authorization_id}<br/><b>Fecha:</b> {auth_date}",
            ParagraphStyle('AuthInfo', parent=styles['SmallText'], alignment=TA_CENTER)
        ))
        elements.append(Spacer(1, 20))
        
        # ====== CUSTOMER INFORMATION ======
        elements.append(Paragraph("INFORMACIÓN DEL CLIENTE / Customer Information", styles['SectionTitle']))
        
        customer_name = f"{customer_data.get('firstName', '')} {customer_data.get('lastName', '')}".strip()
        customer_address = f"{customer_data.get('address1', '')}, {customer_data.get('city', '')}, {customer_data.get('state', '')} {customer_data.get('postalCode', '')}"
        
        customer_table_data = [
            ['Nombre / Name:', customer_name],
            ['Dirección / Address:', customer_address],
            ['Teléfono / Phone:', customer_data.get('phone', 'N/A')],
            ['Email:', customer_data.get('email', 'N/A')],
        ]
        
        customer_table = Table(customer_table_data, colWidths=[2*inch, 4.5*inch])
        customer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#4a5568')),
            ('TEXTCOLOR', (1, 0), (1, -1), HexColor('#1a202c')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(customer_table)
        elements.append(Spacer(1, 15))
        
        # ====== BANK ACCOUNT INFORMATION ======
        elements.append(Paragraph("INFORMACIÓN BANCARIA / Bank Account Information", styles['SectionTitle']))
        
        # Mask sensitive data for display
        masked_account = bank_data.get('maskedAccount', '****')
        masked_routing = bank_data.get('routing', '')
        if masked_routing and len(masked_routing) == 9:
            masked_routing = f"****{masked_routing[-4:]}"
        
        bank_table_data = [
            ['Nombre en Cuenta / Account Name:', bank_data.get('checkName', customer_name)],
            ['Número de Ruta / Routing Number:', masked_routing],
            ['Número de Cuenta / Account Number:', masked_account],
            ['Tipo de Cuenta / Account Type:', bank_data.get('accountType', 'checking').title()],
        ]
        
        bank_table = Table(bank_table_data, colWidths=[2.5*inch, 4*inch])
        bank_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#4a5568')),
            ('TEXTCOLOR', (1, 0), (1, -1), HexColor('#1a202c')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BACKGROUND', (0, 0), (-1, -1), HexColor('#f7fafc')),
            ('BOX', (0, 0), (-1, -1), 1, HexColor('#e2e8f0')),
        ]))
        elements.append(bank_table)
        elements.append(Spacer(1, 15))
        
        # ====== SUBSCRIPTION DETAILS ======
        elements.append(Paragraph("DETALLES DE LA SUSCRIPCIÓN / Subscription Details", styles['SectionTitle']))
        
        frequency_map = {
            7: 'Semanal / Weekly',
            14: 'Quincenal / Bi-weekly',
            30: 'Mensual / Monthly',
            60: 'Bimestral / Bi-monthly',
            90: 'Trimestral / Quarterly',
        }
        frequency = subscription_data.get('dayFrequency', 30)
        frequency_text = frequency_map.get(int(frequency), f'Cada {frequency} días / Every {frequency} days')
        
        amount = subscription_data.get('amount', 0)
        if isinstance(amount, str):
            amount = float(amount)
        
        sub_table_data = [
            ['Plan:', subscription_data.get('planName', 'Plan de Pago')],
            ['Monto / Amount:', f"${amount:.2f} USD"],
            ['Frecuencia / Frequency:', frequency_text],
            ['Fecha de Inicio / Start Date:', subscription_data.get('startDate', 'Por definir')],
        ]
        
        if subscription_data.get('subscriptionId'):
            sub_table_data.append(['ID de Suscripción:', subscription_data.get('subscriptionId')])
        
        sub_table = Table(sub_table_data, colWidths=[2.5*inch, 4*inch])
        sub_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), HexColor('#4a5568')),
            ('TEXTCOLOR', (1, 0), (1, -1), HexColor('#1a202c')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(sub_table)
        elements.append(Spacer(1, 20))
        
        # ====== AUTHORIZATION TEXT ======
        elements.append(Paragraph("AUTORIZACIÓN Y CONSENTIMIENTO / Authorization and Consent", styles['SectionTitle']))
        
        authorization_text = f"""
        Por medio de la presente, autorizo a <b>{self.company_name}</b> a iniciar 
        débitos electrónicos (ACH) de mi cuenta bancaria indicada arriba, de acuerdo 
        con los términos de servicio acordados. Esta autorización permanecerá vigente 
        hasta que yo la revoque por escrito.
        <br/><br/>
        <i>I hereby authorize <b>{self.company_name}</b> to initiate electronic debit 
        entries (ACH) from my bank account indicated above, in accordance with the 
        agreed terms of service. This authorization will remain in effect until I 
        revoke it in writing.</i>
        """
        elements.append(Paragraph(authorization_text, styles['ACHBodyText']))
        elements.append(Spacer(1, 15))
        
        # Terms and Conditions
        terms_text = """
        <b>Términos y Condiciones / Terms and Conditions:</b><br/>
        1. Entiendo que este autorización es para pagos recurrentes según la frecuencia indicada.<br/>
        2. Puedo cancelar esta autorización en cualquier momento contactando a la empresa.<br/>
        3. Los cargos aparecerán en mi estado de cuenta bancario como "{company}".<br/>
        4. Si un pago es devuelto por fondos insuficientes, puedo estar sujeto a cargos adicionales.<br/>
        5. Recibiré confirmación de cada transacción por email (si se proporcionó).<br/>
        <br/>
        <i>1. I understand this authorization is for recurring payments as indicated.<br/>
        2. I may cancel this authorization at any time by contacting the company.<br/>
        3. Charges will appear on my bank statement as "{company}".<br/>
        4. If a payment is returned for insufficient funds, I may be subject to additional fees.<br/>
        5. I will receive confirmation of each transaction via email (if provided).</i>
        """.format(company=self.company_name)
        
        elements.append(Paragraph(terms_text, styles['SmallText']))
        elements.append(Spacer(1, 25))
        
        # ====== SIGNATURE SECTION ======
        elements.append(Paragraph("FIRMA DEL TITULAR / Account Holder Signature", styles['SectionTitle']))
        
        # Signature line
        sig_table_data = [
            ['_' * 50, '_' * 30],
            ['Firma del Titular / Account Holder Signature', 'Fecha / Date'],
            ['', ''],
            [customer_name, datetime.now().strftime('%m/%d/%Y')],
        ]
        
        sig_table = Table(sig_table_data, colWidths=[3.5*inch, 2.5*inch])
        sig_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 1), (-1, 1), HexColor('#718096')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(sig_table)
        elements.append(Spacer(1, 30))
        
        # ====== FOOTER ======
        elements.append(HRFlowable(width="100%", thickness=1, color=HexColor('#e2e8f0')))
        elements.append(Spacer(1, 10))
        
        footer_text = f"""
        Este documento fue generado electrónicamente el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC<br/>
        ID de Documento: {authorization_id}<br/>
        <b>{self.company_name}</b> - Todos los derechos reservados
        """
        elements.append(Paragraph(footer_text, styles['FooterText']))
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def generate_authorization_base64(
        self,
        customer_data: Dict[str, Any],
        bank_data: Dict[str, Any],
        subscription_data: Dict[str, Any],
        authorization_id: Optional[str] = None
    ) -> str:
        """Generate ACH authorization PDF and return as base64 string"""
        pdf_bytes = self.generate_authorization_pdf(
            customer_data, bank_data, subscription_data, authorization_id
        )
        return base64.b64encode(pdf_bytes).decode('utf-8')


# ==================== SERVICE CLASS ====================

class ACHAuthorizationService:
    """Service for managing ACH authorization documents"""
    
    def __init__(self, db=None, storage_path: str = "/app/backend/ach_pdfs"):
        self.db = db
        self.storage_path = storage_path
        self.generator = ACHAuthorizationGenerator()
        
        # Ensure storage directory exists
        os.makedirs(storage_path, exist_ok=True)
        logger.info(f"✅ ACH Authorization Service initialized. Storage: {storage_path}")
    
    async def generate_and_save_authorization(
        self,
        customer_vault_id: str,
        customer_data: Dict[str, Any],
        bank_data: Dict[str, Any],
        subscription_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate authorization PDF and save to filesystem + database
        
        Returns dict with file path, URL, and authorization ID
        """
        # Generate unique authorization ID
        auth_id = f"ACH-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        
        try:
            # Generate PDF
            pdf_bytes = self.generator.generate_authorization_pdf(
                customer_data, bank_data, subscription_data, auth_id
            )
            
            # Save to filesystem
            filename = f"ach_auth_{customer_vault_id}_{uuid.uuid4().hex[:8]}.pdf"
            filepath = os.path.join(self.storage_path, filename)
            
            with open(filepath, 'wb') as f:
                f.write(pdf_bytes)
            
            logger.info(f"✅ Authorization PDF saved: {filepath}")
            
            # Save record to database if available
            if self.db is not None:
                auth_record = {
                    'id': auth_id,
                    'customerVaultId': customer_vault_id,
                    'customerName': f"{customer_data.get('firstName', '')} {customer_data.get('lastName', '')}".strip(),
                    'filename': filename,
                    'filepath': filepath,
                    'planName': subscription_data.get('planName'),
                    'amount': subscription_data.get('amount'),
                    'frequency': subscription_data.get('dayFrequency'),
                    'createdAt': datetime.utcnow(),
                    'downloadCount': 0
                }
                await self.db.ach_authorizations.insert_one(auth_record)
            
            return {
                'success': True,
                'authorizationId': auth_id,
                'filename': filename,
                'filepath': filepath,
                'downloadUrl': f"/api/merchant-one/authorization/{auth_id}/download"
            }
            
        except Exception as e:
            logger.error(f"Error generating authorization: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_authorization(self, auth_id: str) -> Optional[Dict[str, Any]]:
        """Get authorization record by ID"""
        if self.db is None:
            return None
        
        return await self.db.ach_authorizations.find_one({'id': auth_id})
    
    async def get_authorizations_for_customer(self, customer_vault_id: str) -> List[Dict[str, Any]]:
        """Get all authorizations for a customer"""
        if self.db is None:
            return []
        
        cursor = self.db.ach_authorizations.find(
            {'customerVaultId': customer_vault_id}
        ).sort('createdAt', -1)
        
        return await cursor.to_list(100)
    
    async def get_pdf_bytes(self, auth_id: str) -> Optional[bytes]:
        """Get PDF file bytes for download"""
        auth = await self.get_authorization(auth_id)
        if not auth:
            return None
        
        filepath = auth.get('filepath')
        if not filepath or not os.path.exists(filepath):
            return None
        
        # Update download count
        if self.db is not None:
            await self.db.ach_authorizations.update_one(
                {'id': auth_id},
                {'$inc': {'downloadCount': 1}}
            )
        
        with open(filepath, 'rb') as f:
            return f.read()
    
    def generate_pdf_on_demand(
        self,
        customer_data: Dict[str, Any],
        bank_data: Dict[str, Any],
        subscription_data: Dict[str, Any]
    ) -> bytes:
        """Generate PDF without saving (for immediate download)"""
        return self.generator.generate_authorization_pdf(
            customer_data, bank_data, subscription_data
        )


# Singleton instance
ach_auth_service: Optional[ACHAuthorizationService] = None


def init_ach_auth_service(db) -> ACHAuthorizationService:
    """Initialize the ACH authorization service"""
    global ach_auth_service
    ach_auth_service = ACHAuthorizationService(db)
    return ach_auth_service


def get_ach_auth_service() -> Optional[ACHAuthorizationService]:
    """Get the ACH authorization service instance"""
    return ach_auth_service
