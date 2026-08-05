"""
OCR Service for Tax Documents
Uses Tesseract for extracting data from W-2, 1099, and other tax forms
"""

import os
import re
import logging
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# Configure Tesseract path if needed
# pytesseract.pytesseract.tesseract_cmd = '/usr/bin/tesseract'


class OCRService:
    """Service for OCR processing of tax documents"""
    
    def __init__(self):
        self.supported_formats = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp']
        logger.info("OCR Service initialized with Tesseract")
    
    def process_document(self, file_path: str, document_type: str = 'auto') -> Dict[str, Any]:
        """
        Process a document and extract relevant tax information
        
        Args:
            file_path: Path to the document file
            document_type: Type of document ('W-2', '1099-NEC', '1099-MISC', 'auto')
        
        Returns:
            Dictionary with extracted fields and confidence scores
        """
        try:
            # Check file exists
            if not os.path.exists(file_path):
                return {'success': False, 'error': 'File not found'}
            
            # Get file extension
            _, ext = os.path.splitext(file_path.lower())
            
            if ext not in self.supported_formats:
                return {'success': False, 'error': f'Unsupported format: {ext}'}
            
            # Extract text from document
            if ext == '.pdf':
                text = self._extract_text_from_pdf(file_path)
            else:
                text = self._extract_text_from_image(file_path)
            
            if not text:
                return {
                    'success': False,
                    'error': 'Could not extract text from document',
                    'rawText': ''
                }
            
            # Auto-detect document type if needed
            if document_type == 'auto':
                document_type = self._detect_document_type(text)
            
            # Extract fields based on document type
            if document_type == 'W-2':
                fields = self._extract_w2_fields(text)
            elif document_type == '1099-NEC':
                fields = self._extract_1099_nec_fields(text)
            elif document_type == '1099-MISC':
                fields = self._extract_1099_misc_fields(text)
            else:
                fields = self._extract_generic_fields(text)
            
            # Calculate confidence
            confidence = self._calculate_confidence(fields)
            
            return {
                'success': True,
                'documentType': document_type,
                'fields': fields,
                'confidence': confidence,
                'needsReview': confidence < 0.85,
                'rawText': text[:2000],  # First 2000 chars for debugging
                'processedAt': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"OCR processing error: {e}")
            return {
                'success': False,
                'error': str(e),
                'rawText': ''
            }
    
    def _extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF using pdf2image and Tesseract"""
        try:
            # Convert PDF pages to images
            images = convert_from_path(file_path, dpi=300)
            
            all_text = []
            for i, image in enumerate(images):
                # Use Spanish and English for better recognition
                text = pytesseract.image_to_string(image, lang='eng+spa')
                all_text.append(text)
            
            return '\n'.join(all_text)
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            return ""
    
    def _extract_text_from_image(self, file_path: str) -> str:
        """Extract text from image using Tesseract"""
        try:
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image, lang='eng+spa')
            return text
        except Exception as e:
            logger.error(f"Image extraction error: {e}")
            return ""
    
    def _detect_document_type(self, text: str) -> str:
        """Auto-detect the type of tax document"""
        text_upper = text.upper()
        
        # Check for specific form indicators
        if 'W-2' in text_upper or 'WAGE AND TAX STATEMENT' in text_upper:
            return 'W-2'
        elif '1099-NEC' in text_upper or 'NONEMPLOYEE COMPENSATION' in text_upper:
            return '1099-NEC'
        elif '1099-MISC' in text_upper or 'MISCELLANEOUS INFORMATION' in text_upper:
            return '1099-MISC'
        elif '1099-INT' in text_upper or 'INTEREST INCOME' in text_upper:
            return '1099-INT'
        elif '1099-DIV' in text_upper or 'DIVIDENDS' in text_upper:
            return '1099-DIV'
        elif '1099-K' in text_upper:
            return '1099-K'
        elif '1095' in text_upper:
            return '1095'
        
        return 'unknown'
    
    def _extract_w2_fields(self, text: str) -> Dict[str, Any]:
        """Extract fields from W-2 form"""
        fields = {}
        
        # Employer EIN (Box b) - Format: XX-XXXXXXX
        ein_match = re.search(r'\b(\d{2}[-]?\d{7})\b', text)
        if ein_match:
            fields['employerEIN'] = ein_match.group(1)
        
        # Employer Name and Address (Box c)
        # This is tricky - look for patterns after EIN
        employer_pattern = re.search(r'employer.*?name.*?:?\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if employer_pattern:
            fields['employerName'] = employer_pattern.group(1).strip()
        
        # Employee SSN (Box a) - Format: XXX-XX-XXXX
        ssn_match = re.search(r'\b(\d{3}[-]?\d{2}[-]?\d{4})\b', text)
        if ssn_match:
            fields['employeeSSN'] = ssn_match.group(1)
        
        # Employee Name (Box e)
        employee_pattern = re.search(r'employee.*?name.*?:?\s*(.+?)(?:\n|$)', text, re.IGNORECASE)
        if employee_pattern:
            fields['employeeName'] = employee_pattern.group(1).strip()
        
        # Wages (Box 1)
        wages_patterns = [
            r'wages.*?tips.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*1.*?:?\s*\$?([\d,]+\.?\d*)',
            r'1\s+wages.*?\$?([\d,]+\.?\d*)',
        ]
        for pattern in wages_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['wages'] = self._parse_amount(match.group(1))
                break
        
        # Federal Tax Withheld (Box 2)
        fed_tax_patterns = [
            r'federal.*?income.*?tax.*?withheld.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*2.*?:?\s*\$?([\d,]+\.?\d*)',
            r'2\s+federal.*?\$?([\d,]+\.?\d*)',
        ]
        for pattern in fed_tax_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['federalTaxWithheld'] = self._parse_amount(match.group(1))
                break
        
        # Social Security Wages (Box 3)
        ss_wages_patterns = [
            r'social\s*security\s*wages.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*3.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in ss_wages_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['socialSecurityWages'] = self._parse_amount(match.group(1))
                break
        
        # Social Security Tax Withheld (Box 4)
        ss_tax_patterns = [
            r'social\s*security\s*tax\s*withheld.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*4.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in ss_tax_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['socialSecurityTaxWithheld'] = self._parse_amount(match.group(1))
                break
        
        # Medicare Wages (Box 5)
        medicare_wages_patterns = [
            r'medicare\s*wages.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*5.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in medicare_wages_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['medicareWages'] = self._parse_amount(match.group(1))
                break
        
        # Medicare Tax Withheld (Box 6)
        medicare_tax_patterns = [
            r'medicare\s*tax\s*withheld.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*6.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in medicare_tax_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['medicareTaxWithheld'] = self._parse_amount(match.group(1))
                break
        
        # State (Box 15)
        state_match = re.search(r'\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b', text)
        if state_match:
            fields['state'] = state_match.group(1)
        
        # State Wages (Box 16)
        state_wages_patterns = [
            r'state\s*wages.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*16.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in state_wages_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['stateWages'] = self._parse_amount(match.group(1))
                break
        
        # State Tax Withheld (Box 17)
        state_tax_patterns = [
            r'state\s*income\s*tax.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*17.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in state_tax_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['stateTaxWithheld'] = self._parse_amount(match.group(1))
                break
        
        return fields
    
    def _extract_1099_nec_fields(self, text: str) -> Dict[str, Any]:
        """Extract fields from 1099-NEC form"""
        fields = {}
        
        # Payer TIN
        payer_tin = re.search(r"payer'?s?\s*(?:tin|ein|identification).*?(\d{2}[-]?\d{7})", text, re.IGNORECASE)
        if payer_tin:
            fields['payerTIN'] = payer_tin.group(1)
        
        # Payer Name
        payer_name = re.search(r"payer'?s?\s*name.*?:?\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        if payer_name:
            fields['payerName'] = payer_name.group(1).strip()
        
        # Recipient TIN (SSN)
        recipient_tin = re.search(r"recipient'?s?\s*(?:tin|ssn|identification).*?(\d{3}[-]?\d{2}[-]?\d{4})", text, re.IGNORECASE)
        if recipient_tin:
            fields['recipientTIN'] = recipient_tin.group(1)
        
        # Recipient Name
        recipient_name = re.search(r"recipient'?s?\s*name.*?:?\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
        if recipient_name:
            fields['recipientName'] = recipient_name.group(1).strip()
        
        # Box 1 - Nonemployee Compensation
        nec_patterns = [
            r'nonemployee\s*compensation.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*1.*?:?\s*\$?([\d,]+\.?\d*)',
            r'1\s+nonemployee.*?\$?([\d,]+\.?\d*)',
        ]
        for pattern in nec_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['nonemployeeCompensation'] = self._parse_amount(match.group(1))
                break
        
        # Box 4 - Federal Tax Withheld
        fed_patterns = [
            r'federal\s*income\s*tax\s*withheld.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*4.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in fed_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['federalTaxWithheld'] = self._parse_amount(match.group(1))
                break
        
        # Box 5 - State Tax Withheld
        state_patterns = [
            r'state\s*tax\s*withheld.*?:?\s*\$?([\d,]+\.?\d*)',
            r'box\s*5.*?:?\s*\$?([\d,]+\.?\d*)',
        ]
        for pattern in state_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                fields['stateTaxWithheld'] = self._parse_amount(match.group(1))
                break
        
        # Tax Year
        year_match = re.search(r'\b(20\d{2})\b', text)
        if year_match:
            fields['taxYear'] = int(year_match.group(1))
        
        return fields
    
    def _extract_1099_misc_fields(self, text: str) -> Dict[str, Any]:
        """Extract fields from 1099-MISC form"""
        fields = {}
        
        # Similar structure to 1099-NEC
        # Payer/Recipient info
        payer_tin = re.search(r"payer'?s?\s*(?:tin|ein).*?(\d{2}[-]?\d{7})", text, re.IGNORECASE)
        if payer_tin:
            fields['payerTIN'] = payer_tin.group(1)
        
        recipient_tin = re.search(r"recipient'?s?\s*(?:tin|ssn).*?(\d{3}[-]?\d{2}[-]?\d{4})", text, re.IGNORECASE)
        if recipient_tin:
            fields['recipientTIN'] = recipient_tin.group(1)
        
        # Box 1 - Rents
        rents_match = re.search(r'rents.*?:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if rents_match:
            fields['rents'] = self._parse_amount(rents_match.group(1))
        
        # Box 2 - Royalties
        royalties_match = re.search(r'royalties.*?:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if royalties_match:
            fields['royalties'] = self._parse_amount(royalties_match.group(1))
        
        # Box 3 - Other Income
        other_match = re.search(r'other\s*income.*?:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if other_match:
            fields['otherIncome'] = self._parse_amount(other_match.group(1))
        
        # Box 4 - Federal Tax Withheld
        fed_match = re.search(r'federal.*?tax.*?withheld.*?:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if fed_match:
            fields['federalTaxWithheld'] = self._parse_amount(fed_match.group(1))
        
        # Box 6 - Medical Payments
        medical_match = re.search(r'medical.*?payments.*?:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if medical_match:
            fields['medicalPayments'] = self._parse_amount(medical_match.group(1))
        
        return fields
    
    def _extract_generic_fields(self, text: str) -> Dict[str, Any]:
        """Extract generic tax-related fields"""
        fields = {}
        
        # Find all EINs
        eins = re.findall(r'\b(\d{2}[-]?\d{7})\b', text)
        if eins:
            fields['eins_found'] = list(set(eins))
        
        # Find all SSNs
        ssns = re.findall(r'\b(\d{3}[-]?\d{2}[-]?\d{4})\b', text)
        if ssns:
            fields['ssns_found'] = list(set(ssns))
        
        # Find all dollar amounts
        amounts = re.findall(r'\$\s*([\d,]+\.?\d*)', text)
        if amounts:
            fields['amounts_found'] = [self._parse_amount(a) for a in amounts[:10]]
        
        # Find dates
        dates = re.findall(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', text)
        if dates:
            fields['dates_found'] = list(set(dates))
        
        # Find tax year
        year_match = re.search(r'\b(20\d{2})\b', text)
        if year_match:
            fields['taxYear'] = int(year_match.group(1))
        
        return fields
    
    def _parse_amount(self, amount_str: str) -> float:
        """Parse a dollar amount string to float"""
        try:
            # Remove commas and convert
            clean = amount_str.replace(',', '').strip()
            return float(clean)
        except:
            return 0.0
    
    def _calculate_confidence(self, fields: Dict[str, Any]) -> float:
        """Calculate confidence score based on extracted fields"""
        if not fields:
            return 0.0
        
        # Key fields that indicate good extraction
        key_fields = ['employerEIN', 'payerTIN', 'recipientTIN', 'wages', 
                      'nonemployeeCompensation', 'federalTaxWithheld']
        
        found = sum(1 for f in key_fields if f in fields and fields[f])
        
        # Base confidence on percentage of key fields found
        confidence = found / len(key_fields)
        
        # Boost confidence if we found amounts
        if 'amounts_found' in fields and fields['amounts_found']:
            confidence += 0.1
        
        # Cap at 0.95 (never 100% confident for OCR)
        return min(confidence, 0.95)


# Global instance
ocr_service: Optional[OCRService] = None


def get_ocr_service() -> OCRService:
    """Get or create OCR service instance"""
    global ocr_service
    if ocr_service is None:
        ocr_service = OCRService()
    return ocr_service
