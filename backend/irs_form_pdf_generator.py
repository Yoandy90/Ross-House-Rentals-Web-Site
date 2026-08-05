"""
Professional IRS Form PDF Generator
Generates properly formatted IRS tax forms (1099-NEC, 1099-MISC, W-2)
"""

import os
import logging
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, Optional
import base64

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import black, red, HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph

logger = logging.getLogger(__name__)


def safe_str(value: Any, default: str = '') -> str:
    """Safely convert value to string, handling None"""
    if value is None:
        return default
    return str(value)


class IRSFormPDFGenerator:
    """Generate IRS-compliant tax form PDFs"""
    
    def __init__(self):
        self.page_width, self.page_height = letter
        logger.info("IRS Form PDF Generator initialized")
    
    def generate_1099_nec(self, form_data: Dict[str, Any]) -> bytes:
        """Generate a professional 1099-NEC PDF"""
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # IRS form colors
        red_color = HexColor('#CC0000')
        
        # ===== HEADER =====
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.5*inch, 10.5*inch, "CORRECTED (if checked)")
        c.rect(1.8*inch, 10.45*inch, 0.15*inch, 0.15*inch)  # Checkbox
        
        # Form title
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(red_color)
        c.drawString(5.5*inch, 10.5*inch, "1099-NEC")
        c.setFillColor(black)
        
        c.setFont("Helvetica", 8)
        c.drawString(5.5*inch, 10.3*inch, "Nonemployee")
        c.drawString(5.5*inch, 10.15*inch, "Compensation")
        
        # Tax year
        c.setFont("Helvetica-Bold", 16)
        c.drawString(7*inch, 10.5*inch, str(form_data.get('taxYear', 2025)))
        
        # OMB number
        c.setFont("Helvetica", 7)
        c.drawString(0.5*inch, 10.2*inch, "OMB No. 1545-0116")
        
        # Copy indicator
        c.setFont("Helvetica", 8)
        c.drawString(7*inch, 10.2*inch, "Copy B")
        c.drawString(7*inch, 10.05*inch, "For Recipient")
        
        # ===== PAYER SECTION (Left side) =====
        # Box for payer info
        c.rect(0.5*inch, 8.5*inch, 4*inch, 1.5*inch)
        
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 9.85*inch, "PAYER'S name, street address, city or town, state or province, country, ZIP")
        c.drawString(0.55*inch, 9.7*inch, "or foreign postal code, and telephone no.")
        
        c.setFont("Helvetica-Bold", 10)
        payer_name = form_data.get('payerName', '')
        c.drawString(0.6*inch, 9.4*inch, payer_name[:40])
        
        c.setFont("Helvetica", 9)
        payer_address = form_data.get('payerAddress', '')
        c.drawString(0.6*inch, 9.15*inch, payer_address[:45])
        
        payer_city_state = f"{form_data.get('payerCity', '')}, {form_data.get('payerState', '')} {form_data.get('payerZip', '')}"
        c.drawString(0.6*inch, 8.9*inch, payer_city_state[:45])
        
        # Payer TIN box
        c.rect(0.5*inch, 7.9*inch, 2*inch, 0.5*inch)
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 8.25*inch, "PAYER'S TIN")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0.6*inch, 8.0*inch, form_data.get('payerEIN', 'XX-XXXXXXX'))
        
        # Recipient TIN box
        c.rect(2.5*inch, 7.9*inch, 2*inch, 0.5*inch)
        c.setFont("Helvetica", 7)
        c.drawString(2.55*inch, 8.25*inch, "RECIPIENT'S TIN")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2.6*inch, 8.0*inch, form_data.get('recipientSSN', 'XXX-XX-XXXX'))
        
        # ===== RECIPIENT SECTION =====
        c.rect(0.5*inch, 6.4*inch, 4*inch, 1.4*inch)
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 7.65*inch, "RECIPIENT'S name")
        
        c.setFont("Helvetica-Bold", 10)
        recipient_name = form_data.get('recipientName', '')
        c.drawString(0.6*inch, 7.35*inch, recipient_name[:40])
        
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 7.1*inch, "Street address (including apt. no.)")
        c.setFont("Helvetica", 9)
        c.drawString(0.6*inch, 6.85*inch, safe_str(form_data.get('recipientAddress'), '')[:45])
        
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 6.6*inch, "City or town, state or province, country, and ZIP or foreign postal code")
        
        # Account number box
        c.rect(0.5*inch, 5.9*inch, 2.5*inch, 0.4*inch)
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 6.15*inch, "Account number (see instructions)")
        c.setFont("Helvetica", 9)
        c.drawString(0.6*inch, 5.95*inch, safe_str(form_data.get('accountNumber'), '')[:20])
        
        # ===== AMOUNT BOXES (Right side) =====
        box_x = 4.6*inch
        box_width = 1.5*inch
        box_height = 0.6*inch
        
        # Box 1 - Nonemployee compensation
        c.rect(box_x, 9*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 9.45*inch, "1 Nonemployee compensation")
        c.setFont("Helvetica-Bold", 12)
        amount = form_data.get('box1_nonemployeeCompensation', 0)
        c.drawString(box_x + 0.1*inch, 9.1*inch, f"${amount:,.2f}")
        
        # Box 2 - Payer made direct sales
        c.rect(box_x + box_width + 0.1*inch, 9*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + box_width + 0.15*inch, 9.45*inch, "2 Payer made direct sales")
        c.drawString(box_x + box_width + 0.15*inch, 9.3*inch, "totaling $5,000 or more")
        if form_data.get('directSalesIndicator'):
            c.rect(box_x + box_width + 0.5*inch, 9.05*inch, 0.15*inch, 0.15*inch)
            c.drawString(box_x + box_width + 0.52*inch, 9.07*inch, "X")
        
        # Box 4 - Federal income tax withheld
        c.rect(box_x, 8.3*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 8.75*inch, "4 Federal income tax withheld")
        c.setFont("Helvetica-Bold", 12)
        fed_withheld = form_data.get('box4_federalTaxWithheld', 0)
        c.drawString(box_x + 0.1*inch, 8.4*inch, f"${fed_withheld:,.2f}")
        
        # Box 5 - State tax withheld
        c.rect(box_x, 7.6*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 8.05*inch, "5 State tax withheld")
        c.setFont("Helvetica-Bold", 12)
        state_withheld = form_data.get('box5_stateTaxWithheld', 0)
        c.drawString(box_x + 0.1*inch, 7.7*inch, f"${state_withheld:,.2f}")
        
        # Box 6 - State/Payer's state no.
        c.rect(box_x + box_width + 0.1*inch, 7.6*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + box_width + 0.15*inch, 8.05*inch, "6 State/Payer's state no.")
        c.setFont("Helvetica", 10)
        c.drawString(box_x + box_width + 0.2*inch, 7.7*inch, safe_str(form_data.get('box6_statePayerNumber'), '')[:15])
        
        # Box 7 - State income
        c.rect(box_x, 6.9*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 7.35*inch, "7 State income")
        c.setFont("Helvetica-Bold", 12)
        state_income = form_data.get('box7_stateIncome', 0)
        c.drawString(box_x + 0.1*inch, 7.0*inch, f"${state_income:,.2f}")
        
        # ===== FOOTER =====
        c.setFont("Helvetica", 7)
        c.drawString(0.5*inch, 5.5*inch, "Form 1099-NEC")
        c.drawString(0.5*inch, 5.35*inch, "(Rev. January 2024)")
        c.drawString(0.5*inch, 5.2*inch, "Cat. No. 72590N")
        
        c.setFont("Helvetica", 6)
        c.drawString(0.5*inch, 4.9*inch, "Department of the Treasury - Internal Revenue Service")
        
        # Instructions section
        c.setFont("Helvetica-Bold", 9)
        c.drawString(0.5*inch, 4.5*inch, "Instructions for Recipient")
        
        c.setFont("Helvetica", 7)
        instructions = [
            "Box 1. Shows nonemployee compensation. If you are in the trade or business of being a payee,",
            "report this amount on Schedule C or Schedule F (Form 1040). You received this form instead of",
            "Form W-2 because the payer did not consider you an employee and did not withhold income tax",
            "or social security and Medicare tax.",
            "",
            "Box 4. Shows backup withholding. Generally, a payer must backup withhold if you did not",
            "furnish your TIN or you did not furnish the correct TIN to the payer."
        ]
        
        y_pos = 4.3*inch
        for line in instructions:
            c.drawString(0.5*inch, y_pos, line)
            y_pos -= 0.12*inch
        
        # ===== WATERMARK if draft =====
        if form_data.get('status') == 'draft':
            c.saveState()
            c.setFillColor(HexColor('#CCCCCC'))
            c.setFont("Helvetica-Bold", 60)
            c.translate(4*inch, 5*inch)
            c.rotate(45)
            c.drawCentredString(0, 0, "DRAFT")
            c.restoreState()
        
        # Form status indicator
        c.setFont("Helvetica-Bold", 8)
        status = form_data.get('status', 'draft').upper()
        if status == 'VALIDATED':
            c.setFillColor(HexColor('#006600'))
        elif status == 'SUBMITTED':
            c.setFillColor(HexColor('#0066CC'))
        elif status == 'ACCEPTED':
            c.setFillColor(HexColor('#006600'))
        elif status == 'REJECTED':
            c.setFillColor(red_color)
        else:
            c.setFillColor(HexColor('#666666'))
        
        c.drawString(6.5*inch, 0.5*inch, f"Status: {status}")
        c.setFillColor(black)
        
        # Generated timestamp
        c.setFont("Helvetica", 6)
        c.drawString(0.5*inch, 0.3*inch, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Ross Tax Preparation LLC")
        
        c.save()
        return buffer.getvalue()
    
    def generate_1099_misc(self, form_data: Dict[str, Any]) -> bytes:
        """Generate a professional 1099-MISC PDF"""
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        red_color = HexColor('#CC0000')
        
        # ===== HEADER =====
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.5*inch, 10.5*inch, "CORRECTED (if checked)")
        c.rect(1.8*inch, 10.45*inch, 0.15*inch, 0.15*inch)
        
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(red_color)
        c.drawString(5.3*inch, 10.5*inch, "1099-MISC")
        c.setFillColor(black)
        
        c.setFont("Helvetica", 8)
        c.drawString(5.3*inch, 10.3*inch, "Miscellaneous")
        c.drawString(5.3*inch, 10.15*inch, "Information")
        
        c.setFont("Helvetica-Bold", 16)
        c.drawString(7*inch, 10.5*inch, str(form_data.get('taxYear', 2025)))
        
        # ===== PAYER SECTION =====
        c.rect(0.5*inch, 8.5*inch, 4*inch, 1.5*inch)
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 9.85*inch, "PAYER'S name, street address, city or town, state or province,")
        c.drawString(0.55*inch, 9.7*inch, "country, ZIP or foreign postal code, and telephone no.")
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.6*inch, 9.4*inch, form_data.get('payerName', '')[:40])
        
        # Payer and Recipient TINs
        c.rect(0.5*inch, 7.9*inch, 2*inch, 0.5*inch)
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 8.25*inch, "PAYER'S TIN")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(0.6*inch, 8.0*inch, form_data.get('payerEIN', 'XX-XXXXXXX'))
        
        c.rect(2.5*inch, 7.9*inch, 2*inch, 0.5*inch)
        c.setFont("Helvetica", 7)
        c.drawString(2.55*inch, 8.25*inch, "RECIPIENT'S TIN")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(2.6*inch, 8.0*inch, form_data.get('recipientSSN', 'XXX-XX-XXXX'))
        
        # ===== RECIPIENT SECTION =====
        c.rect(0.5*inch, 6.4*inch, 4*inch, 1.4*inch)
        c.setFont("Helvetica", 7)
        c.drawString(0.55*inch, 7.65*inch, "RECIPIENT'S name")
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.6*inch, 7.35*inch, form_data.get('recipientName', '')[:40])
        
        # ===== AMOUNT BOXES =====
        box_x = 4.6*inch
        box_width = 1.4*inch
        box_height = 0.5*inch
        
        # Box 1 - Rents
        c.rect(box_x, 9.2*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 9.55*inch, "1 Rents")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(box_x + 0.1*inch, 9.25*inch, f"${form_data.get('box1_rents', 0):,.2f}")
        
        # Box 2 - Royalties
        c.rect(box_x + box_width + 0.1*inch, 9.2*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + box_width + 0.15*inch, 9.55*inch, "2 Royalties")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(box_x + box_width + 0.2*inch, 9.25*inch, f"${form_data.get('box2_royalties', 0):,.2f}")
        
        # Box 3 - Other income
        c.rect(box_x, 8.6*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 8.95*inch, "3 Other income")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(box_x + 0.1*inch, 8.65*inch, f"${form_data.get('box3_otherIncome', 0):,.2f}")
        
        # Box 4 - Federal tax withheld
        c.rect(box_x + box_width + 0.1*inch, 8.6*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + box_width + 0.15*inch, 8.95*inch, "4 Federal tax withheld")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(box_x + box_width + 0.2*inch, 8.65*inch, f"${form_data.get('box4_federalTaxWithheld', 0):,.2f}")
        
        # Box 6 - Medical payments
        c.rect(box_x, 8*inch, box_width, box_height)
        c.setFont("Helvetica", 7)
        c.drawString(box_x + 0.05*inch, 8.35*inch, "6 Medical payments")
        c.setFont("Helvetica-Bold", 11)
        c.drawString(box_x + 0.1*inch, 8.05*inch, f"${form_data.get('box6_medicalPayments', 0):,.2f}")
        
        # ===== FOOTER =====
        c.setFont("Helvetica", 7)
        c.drawString(0.5*inch, 5.5*inch, "Form 1099-MISC (Rev. January 2024)")
        
        # Status and timestamp
        c.setFont("Helvetica-Bold", 8)
        status = form_data.get('status', 'draft').upper()
        c.drawString(6.5*inch, 0.5*inch, f"Status: {status}")
        
        c.setFont("Helvetica", 6)
        c.drawString(0.5*inch, 0.3*inch, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Ross Tax Preparation LLC")
        
        c.save()
        return buffer.getvalue()
    
    def generate_form_pdf(self, form_data: Dict[str, Any]) -> bytes:
        """Generate PDF based on form type"""
        form_type = form_data.get('formType', '1099-NEC')
        
        if form_type == '1099-NEC':
            return self.generate_1099_nec(form_data)
        elif form_type == '1099-MISC':
            return self.generate_1099_misc(form_data)
        else:
            # Default to 1099-NEC format
            return self.generate_1099_nec(form_data)
    
    def generate_form_pdf_base64(self, form_data: Dict[str, Any]) -> str:
        """Generate PDF and return as base64 string"""
        pdf_bytes = self.generate_form_pdf(form_data)
        return base64.b64encode(pdf_bytes).decode('utf-8')


# Global instance
pdf_generator: Optional[IRSFormPDFGenerator] = None


def get_pdf_generator() -> IRSFormPDFGenerator:
    """Get or create PDF generator instance"""
    global pdf_generator
    if pdf_generator is None:
        pdf_generator = IRSFormPDFGenerator()
    return pdf_generator
