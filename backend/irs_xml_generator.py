"""
IRS XML Generator for FIRE/IRIS Submission
Generates compliant XML schemas for information returns (1099-NEC, 1099-MISC, etc.)
"""

import os
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

logger = logging.getLogger(__name__)


class IRSXMLGenerator:
    """Generate IRS-compliant XML for FIRE/IRIS submission"""
    
    # IRS Namespaces
    IRS_NAMESPACE = "urn:us:gov:treasury:irs:ir"
    IRS_COMMON_NS = "urn:us:gov:treasury:irs:common"
    
    def __init__(self, transmitter_info: Dict[str, Any] = None):
        """
        Initialize XML generator with transmitter information
        
        Args:
            transmitter_info: Dictionary with TCC, EFIN, etc.
        """
        self.transmitter_info = transmitter_info or {}
        logger.info("IRS XML Generator initialized")
    
    def prettify(self, elem: Element) -> str:
        """Return a pretty-printed XML string"""
        rough_string = tostring(elem, encoding='unicode')
        reparsed = minidom.parseString(rough_string)
        return reparsed.toprettyxml(indent="  ")
    
    def generate_1099_nec_xml(self, form_data: Dict[str, Any]) -> str:
        """
        Generate 1099-NEC XML following IRS Publication 1220 format
        
        This is a simplified version. The actual FIRE format uses fixed-width
        text records, but IRIS uses XML. This generates IRIS-style XML.
        """
        # Root element with namespace
        root = Element('Form1099NEC')
        root.set('xmlns', self.IRS_NAMESPACE)
        root.set('taxYear', str(form_data.get('taxYear', datetime.now().year)))
        root.set('documentId', form_data.get('id', ''))
        
        # Transmitter record (T record equivalent)
        transmitter = SubElement(root, 'TransmitterInfo')
        SubElement(transmitter, 'TransmitterControlCode').text = self.transmitter_info.get('tcc', '')
        SubElement(transmitter, 'TransmitterName').text = self.transmitter_info.get('name', 'Ross Tax Preparation LLC')
        SubElement(transmitter, 'TransmitterEIN').text = self.transmitter_info.get('ein', '')
        SubElement(transmitter, 'ContactName').text = self.transmitter_info.get('contactName', '')
        SubElement(transmitter, 'ContactPhone').text = self.transmitter_info.get('contactPhone', '')
        SubElement(transmitter, 'ContactEmail').text = self.transmitter_info.get('contactEmail', '')
        
        # Payer record (A record equivalent)
        payer = SubElement(root, 'Payer')
        SubElement(payer, 'PayerTIN').text = form_data.get('payerEIN', '').replace('-', '')
        SubElement(payer, 'PayerName').text = form_data.get('payerName', '')
        
        payer_address = SubElement(payer, 'PayerAddress')
        SubElement(payer_address, 'AddressLine1').text = form_data.get('payerAddress1', '')
        SubElement(payer_address, 'AddressLine2').text = form_data.get('payerAddress2', '')
        SubElement(payer_address, 'City').text = form_data.get('payerCity', '')
        SubElement(payer_address, 'State').text = form_data.get('payerState', '')
        SubElement(payer_address, 'ZIPCode').text = form_data.get('payerZip', '')
        SubElement(payer_address, 'Country').text = form_data.get('payerCountry', 'US')
        
        SubElement(payer, 'PayerPhone').text = form_data.get('payerPhone', '')
        
        # Payee/Recipient record (B record equivalent)
        recipient = SubElement(root, 'Recipient')
        SubElement(recipient, 'RecipientTIN').text = form_data.get('recipientSSN', '').replace('-', '')
        SubElement(recipient, 'RecipientTINType').text = 'SSN'  # SSN, EIN, ITIN, ATIN
        SubElement(recipient, 'RecipientName').text = form_data.get('recipientName', '')
        
        recipient_address = SubElement(recipient, 'RecipientAddress')
        SubElement(recipient_address, 'AddressLine1').text = form_data.get('recipientAddress1', '')
        SubElement(recipient_address, 'AddressLine2').text = form_data.get('recipientAddress2', '')
        SubElement(recipient_address, 'City').text = form_data.get('recipientCity', '')
        SubElement(recipient_address, 'State').text = form_data.get('recipientState', '')
        SubElement(recipient_address, 'ZIPCode').text = form_data.get('recipientZip', '')
        
        SubElement(recipient, 'AccountNumber').text = form_data.get('accountNumber', '')
        SubElement(recipient, 'SecondTINNotice').text = 'X' if form_data.get('secondTinNotice') else ''
        
        # Form data (payment amounts)
        form_amounts = SubElement(root, 'FormData')
        
        # Box 1 - Nonemployee Compensation (Required)
        box1 = form_data.get('box1_nonemployeeCompensation', 0)
        SubElement(form_amounts, 'NonemployeeCompensation').text = f"{box1:.2f}"
        
        # Box 2 - Payer made direct sales (checkbox)
        SubElement(form_amounts, 'DirectSalesIndicator').text = '1' if form_data.get('directSalesIndicator') else '0'
        
        # Box 4 - Federal income tax withheld
        box4 = form_data.get('box4_federalTaxWithheld', 0)
        SubElement(form_amounts, 'FederalIncomeTaxWithheld').text = f"{box4:.2f}"
        
        # State information
        state_info = SubElement(root, 'StateInformation')
        SubElement(state_info, 'StateCode').text = form_data.get('stateCode', '')
        SubElement(state_info, 'StatePayerNumber').text = form_data.get('box6_statePayerNumber', '')
        
        box5 = form_data.get('box5_stateTaxWithheld', 0)
        SubElement(state_info, 'StateTaxWithheld').text = f"{box5:.2f}"
        
        box7 = form_data.get('box7_stateIncome', 0)
        SubElement(state_info, 'StateIncome').text = f"{box7:.2f}"
        
        # Metadata
        metadata = SubElement(root, 'SubmissionMetadata')
        SubElement(metadata, 'CreatedAt').text = datetime.utcnow().isoformat()
        SubElement(metadata, 'SubmissionType').text = form_data.get('submissionType', 'original')
        SubElement(metadata, 'FormStatus').text = form_data.get('status', 'draft')
        
        return self.prettify(root)
    
    def generate_1099_misc_xml(self, form_data: Dict[str, Any]) -> str:
        """Generate 1099-MISC XML following IRS format"""
        root = Element('Form1099MISC')
        root.set('xmlns', self.IRS_NAMESPACE)
        root.set('taxYear', str(form_data.get('taxYear', datetime.now().year)))
        root.set('documentId', form_data.get('id', ''))
        
        # Transmitter info
        transmitter = SubElement(root, 'TransmitterInfo')
        SubElement(transmitter, 'TransmitterControlCode').text = self.transmitter_info.get('tcc', '')
        SubElement(transmitter, 'TransmitterName').text = self.transmitter_info.get('name', 'Ross Tax Preparation LLC')
        
        # Payer
        payer = SubElement(root, 'Payer')
        SubElement(payer, 'PayerTIN').text = form_data.get('payerEIN', '').replace('-', '')
        SubElement(payer, 'PayerName').text = form_data.get('payerName', '')
        
        # Recipient
        recipient = SubElement(root, 'Recipient')
        SubElement(recipient, 'RecipientTIN').text = form_data.get('recipientSSN', '').replace('-', '')
        SubElement(recipient, 'RecipientName').text = form_data.get('recipientName', '')
        
        # Form amounts - All 1099-MISC boxes
        form_amounts = SubElement(root, 'FormData')
        
        # Box 1 - Rents
        SubElement(form_amounts, 'Rents').text = f"{form_data.get('box1_rents', 0):.2f}"
        
        # Box 2 - Royalties
        SubElement(form_amounts, 'Royalties').text = f"{form_data.get('box2_royalties', 0):.2f}"
        
        # Box 3 - Other income
        SubElement(form_amounts, 'OtherIncome').text = f"{form_data.get('box3_otherIncome', 0):.2f}"
        
        # Box 4 - Federal tax withheld
        SubElement(form_amounts, 'FederalIncomeTaxWithheld').text = f"{form_data.get('box4_federalTaxWithheld', 0):.2f}"
        
        # Box 5 - Fishing boat proceeds
        SubElement(form_amounts, 'FishingBoatProceeds').text = f"{form_data.get('box5_fishingBoatProceeds', 0):.2f}"
        
        # Box 6 - Medical and health care payments
        SubElement(form_amounts, 'MedicalPayments').text = f"{form_data.get('box6_medicalPayments', 0):.2f}"
        
        # Box 8 - Substitute payments
        SubElement(form_amounts, 'SubstitutePayments').text = f"{form_data.get('box8_substitutePayments', 0):.2f}"
        
        # Box 9 - Crop insurance proceeds
        SubElement(form_amounts, 'CropInsuranceProceeds').text = f"{form_data.get('box9_cropInsurance', 0):.2f}"
        
        # Box 10 - Gross proceeds paid to attorney
        SubElement(form_amounts, 'GrossProceeds').text = f"{form_data.get('box10_grossProceeds', 0):.2f}"
        
        # Box 11 - Fish purchased for resale
        SubElement(form_amounts, 'FishPurchased').text = f"{form_data.get('box11_fishPurchased', 0):.2f}"
        
        # Box 12 - Section 409A deferrals
        SubElement(form_amounts, 'Section409ADeferrals').text = f"{form_data.get('box12_section409ADeferrals', 0):.2f}"
        
        # Box 13 - Excess golden parachute payments
        SubElement(form_amounts, 'ExcessGoldenParachute').text = f"{form_data.get('box13_excessGoldenParachute', 0):.2f}"
        
        # Box 14 - Nonqualified deferred compensation
        SubElement(form_amounts, 'NonqualifiedDeferred').text = f"{form_data.get('box14_nonqualifiedDeferred', 0):.2f}"
        
        # FATCA filing requirement
        SubElement(form_amounts, 'FATCAFilingRequirement').text = '1' if form_data.get('fatcaFiling') else '0'
        
        # State information (Boxes 15-17)
        state_info = SubElement(root, 'StateInformation')
        SubElement(state_info, 'StateTaxWithheld').text = f"{form_data.get('box15_stateTaxWithheld', 0):.2f}"
        SubElement(state_info, 'StatePayerNumber').text = form_data.get('box16_statePayerNumber', '')
        SubElement(state_info, 'StateIncome').text = f"{form_data.get('box17_stateIncome', 0):.2f}"
        
        return self.prettify(root)
    
    def generate_batch_xml(self, forms: List[Dict[str, Any]], form_type: str = '1099-NEC') -> str:
        """
        Generate batch XML for multiple forms (for bulk submission)
        
        Args:
            forms: List of form data dictionaries
            form_type: Type of forms in the batch
        
        Returns:
            XML string with all forms
        """
        # Root batch element
        root = Element('InformationReturnBatch')
        root.set('xmlns', self.IRS_NAMESPACE)
        root.set('batchId', datetime.utcnow().strftime('%Y%m%d%H%M%S'))
        root.set('formType', form_type)
        root.set('taxYear', str(forms[0].get('taxYear', datetime.now().year)) if forms else str(datetime.now().year))
        root.set('totalRecords', str(len(forms)))
        
        # Transmitter header
        transmitter = SubElement(root, 'TransmitterInfo')
        SubElement(transmitter, 'TransmitterControlCode').text = self.transmitter_info.get('tcc', '')
        SubElement(transmitter, 'TransmitterName').text = self.transmitter_info.get('name', 'Ross Tax Preparation LLC')
        SubElement(transmitter, 'TransmitterEIN').text = self.transmitter_info.get('ein', '')
        SubElement(transmitter, 'ContactName').text = self.transmitter_info.get('contactName', '')
        SubElement(transmitter, 'ContactPhone').text = self.transmitter_info.get('contactPhone', '')
        SubElement(transmitter, 'ContactEmail').text = self.transmitter_info.get('contactEmail', '')
        SubElement(transmitter, 'SubmissionDate').text = datetime.utcnow().isoformat()
        
        # Forms container
        forms_container = SubElement(root, 'Forms')
        
        # Calculate totals
        total_amount = 0
        total_withheld = 0
        
        for i, form in enumerate(forms, 1):
            form_elem = SubElement(forms_container, 'Form')
            form_elem.set('sequence', str(i))
            form_elem.set('documentId', form.get('id', ''))
            
            # Payer
            payer = SubElement(form_elem, 'Payer')
            SubElement(payer, 'PayerTIN').text = form.get('payerEIN', '').replace('-', '')
            SubElement(payer, 'PayerName').text = form.get('payerName', '')
            
            # Recipient
            recipient = SubElement(form_elem, 'Recipient')
            SubElement(recipient, 'RecipientTIN').text = form.get('recipientSSN', '').replace('-', '')
            SubElement(recipient, 'RecipientName').text = form.get('recipientName', '')
            
            # Amounts
            amounts = SubElement(form_elem, 'Amounts')
            
            if form_type == '1099-NEC':
                amount = form.get('box1_nonemployeeCompensation', 0)
                withheld = form.get('box4_federalTaxWithheld', 0)
                SubElement(amounts, 'NonemployeeCompensation').text = f"{amount:.2f}"
                SubElement(amounts, 'FederalTaxWithheld').text = f"{withheld:.2f}"
                total_amount += amount
                total_withheld += withheld
            elif form_type == '1099-MISC':
                rents = form.get('box1_rents', 0)
                other = form.get('box3_otherIncome', 0)
                withheld = form.get('box4_federalTaxWithheld', 0)
                SubElement(amounts, 'Rents').text = f"{rents:.2f}"
                SubElement(amounts, 'OtherIncome').text = f"{other:.2f}"
                SubElement(amounts, 'FederalTaxWithheld').text = f"{withheld:.2f}"
                total_amount += rents + other
                total_withheld += withheld
        
        # Batch totals
        totals = SubElement(root, 'BatchTotals')
        SubElement(totals, 'TotalForms').text = str(len(forms))
        SubElement(totals, 'TotalAmount').text = f"{total_amount:.2f}"
        SubElement(totals, 'TotalFederalWithheld').text = f"{total_withheld:.2f}"
        
        return self.prettify(root)
    
    def generate_xml(self, form_data: Dict[str, Any]) -> str:
        """
        Generate XML based on form type
        
        Args:
            form_data: Form data dictionary with formType field
        
        Returns:
            XML string
        """
        form_type = form_data.get('formType', '1099-NEC')
        
        if form_type == '1099-NEC':
            return self.generate_1099_nec_xml(form_data)
        elif form_type == '1099-MISC':
            return self.generate_1099_misc_xml(form_data)
        else:
            # Default to 1099-NEC format
            return self.generate_1099_nec_xml(form_data)


# Global instance
xml_generator: Optional[IRSXMLGenerator] = None


def get_xml_generator(transmitter_info: Dict[str, Any] = None) -> IRSXMLGenerator:
    """Get or create XML generator instance"""
    global xml_generator
    if xml_generator is None or transmitter_info:
        xml_generator = IRSXMLGenerator(transmitter_info)
    return xml_generator
