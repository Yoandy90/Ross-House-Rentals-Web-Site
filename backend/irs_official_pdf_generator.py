"""
Official IRS Form PDF Generator
Uses REAL IRS fillable PDF templates downloaded from irs.gov
Fills AcroForm fields programmatically with pypdf.
Supports: 1099-NEC, 1099-MISC, 1099-INT, W-2G, 1098
"""

import os
import logging
from io import BytesIO
from typing import Dict, Any, Optional, List
import base64
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'irs_templates')


# ==================== HELPERS ====================

def safe_str(value: Any, default: str = '') -> str:
    if value is None:
        return default
    return str(value)


def format_amount(value: Any) -> str:
    try:
        val = float(value)
        if val == 0:
            return ''
        return f"{val:,.2f}"
    except (ValueError, TypeError):
        return ''


def format_ein(ein: str) -> str:
    ein = ein.replace('-', '').replace(' ', '')
    if len(ein) == 9:
        return f"{ein[:2]}-{ein[2:]}"
    return ein


def format_ssn(ssn: str) -> str:
    ssn = ssn.replace('-', '').replace(' ', '')
    if len(ssn) == 9:
        return f"{ssn[:3]}-{ssn[3:5]}-{ssn[5:]}"
    return ssn


def _build_payer_block(form_data: Dict[str, Any]) -> str:
    """Build multi-line payer info string"""
    parts = [safe_str(form_data.get('payerName', ''))]
    addr = safe_str(form_data.get('payerAddress', ''))
    if addr:
        parts.append(addr)
    city = safe_str(form_data.get('payerCity', ''))
    state = safe_str(form_data.get('payerState', ''))
    zipcode = safe_str(form_data.get('payerZip', ''))
    phone = safe_str(form_data.get('payerPhone', ''))
    csz = f"{city}, {state} {zipcode}".strip().strip(',').strip()
    if csz:
        parts.append(csz)
    if phone:
        parts.append(phone)
    return '\n'.join(parts)


def _build_recipient_csz(form_data: Dict[str, Any], prefix: str = 'recipient') -> str:
    city = safe_str(form_data.get(f'{prefix}City', ''))
    state = safe_str(form_data.get(f'{prefix}State', ''))
    zipcode = safe_str(form_data.get(f'{prefix}Zip', ''))
    return f"{city}, {state} {zipcode}".strip()


# ==================== CORE FILL ENGINE ====================

class IRSOfficialPDFGenerator:
    """Generate IRS forms using official fillable PDF templates from irs.gov"""

    # Page indices for each copy type per form
    PAGE_MAP = {
        '1099-NEC': {
            'A': 1, '1': 2, 'B': 3, '2': 5,
        },
        '1099-MISC': {
            'A': 1, '1': 2, 'B': 3, '2': 5,
        },
        '1099-INT': {
            'A': 1, '1': 2, 'B': 3, '2': 5,
        },
        '1098': {
            'A': 1, 'B': 2,
        },
        'W-2G': {
            'A': 0, '1': 1, 'B': 2, 'C': 3, '2': 5, 'D': 6,
        },
    }

    def __init__(self):
        self.templates = {}
        self._load_templates()
        logger.info("IRS Official PDF Generator initialized")

    def _load_templates(self):
        template_files = {
            '1099-NEC': 'f1099nec.pdf',
            '1099-MISC': 'f1099msc.pdf',
            'W-2G': 'fw2g.pdf',
            '1098': 'f1098.pdf',
            '1099-INT': 'f1099int.pdf',
            '4506-T': 'f4506t.pdf',
            '8821': 'f8821.pdf',
            '2848': 'f2848.pdf',
        }
        for form_type, filename in template_files.items():
            path = os.path.join(TEMPLATES_DIR, filename)
            if os.path.exists(path):
                self.templates[form_type] = path
                logger.info(f"  Template loaded: {form_type} -> {filename}")
            else:
                logger.warning(f"  Template missing: {form_type} -> {filename}")

    def _fill_and_extract(self, template_path: str, field_mapping: Dict[str, str],
                          page_index: int) -> bytes:
        """
        Clone the full PDF, fill AcroForm fields, extract single page.
        Uses clone_reader_document_root to preserve AcroForm dictionary.
        """
        reader = PdfReader(template_path)
        writer = PdfWriter()
        writer.clone_reader_document_root(reader)

        # Fill fields on the target page
        if page_index < len(writer.pages):
            writer.update_page_form_field_values(
                writer.pages[page_index],
                field_mapping,
                auto_regenerate=False
            )

        # Remove all pages except the target (iterate from end)
        total = len(writer.pages)
        for i in range(total - 1, -1, -1):
            if i != page_index:
                writer.remove_page(i)

        buffer = BytesIO()
        writer.write(buffer)
        return buffer.getvalue()

    # ==================== 1099-NEC ====================
    def generate_1099_nec(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """
        Generate official IRS 1099-NEC PDF.
        copy_type: 'A' (IRS), '1' (State), 'B' (Recipient), '2' (Recipient file copy)
        """
        template_path = self.templates.get('1099-NEC')
        if not template_path:
            raise FileNotFoundError("1099-NEC template not found")

        page_index = self.PAGE_MAP['1099-NEC'].get(copy_type, 3)

        # Determine field prefix based on copy type
        copy_names = {'A': 'CopyA', '1': 'Copy1', 'B': 'CopyB', '2': 'Copy2'}
        copy_name = copy_names.get(copy_type, 'CopyB')
        base = f'topmostSubform[0].{copy_name}[0]'

        # Field number prefix: CopyA uses f1_, others use f2_
        f = 'f1' if copy_type == 'A' else 'f2'

        tax_year = safe_str(form_data.get('taxYear', '2025'))
        payer_info = _build_payer_block(form_data)
        payer_tin = format_ein(safe_str(form_data.get('payerEIN', '')))
        recipient_tin = format_ssn(safe_str(form_data.get('recipientSSN', '')))
        recipient_name = safe_str(form_data.get('recipientName', ''))
        recipient_address = safe_str(form_data.get('recipientAddress', ''))
        recipient_csz = _build_recipient_csz(form_data)
        account_number = safe_str(form_data.get('accountNumber', ''))

        box1 = format_amount(form_data.get('box1_nonemployeeCompensation', 0))
        box4 = format_amount(form_data.get('box4_federalTaxWithheld', 0))
        box5_1 = format_amount(form_data.get('box5_stateTaxWithheld', 0))
        box5_2 = format_amount(form_data.get('box5_stateTaxWithheld2', 0))
        box6_1 = safe_str(form_data.get('box6_statePayerNumber', ''))
        box6_2 = safe_str(form_data.get('box6_statePayerNumber2', ''))
        box7_1 = format_amount(form_data.get('box7_stateIncome', 0))
        box7_2 = format_amount(form_data.get('box7_stateIncome2', 0))

        field_mapping = {
            # Calendar Year
            f'{base}.PgHeader[0].CalendarYear[0].{f}_1[0]': tax_year,
            # Left Column
            f'{base}.LeftCol[0].{f}_2[0]': payer_info,
            f'{base}.LeftCol[0].{f}_3[0]': payer_tin,
            f'{base}.LeftCol[0].{f}_4[0]': recipient_tin,
            f'{base}.LeftCol[0].{f}_5[0]': recipient_name,
            f'{base}.LeftCol[0].{f}_6[0]': recipient_address,
            f'{base}.LeftCol[0].{f}_7[0]': recipient_csz,
            f'{base}.LeftCol[0].{f}_8[0]': account_number,
            # Right Column
            f'{base}.RightCol[0].{f}_9[0]': box1,       # Box 1 NEC
            f'{base}.RightCol[0].{f}_10[0]': box4,      # Box 4 Fed tax withheld
            # Box 5 - State tax withheld (2 lines for 2 states)
            f'{base}.RightCol[0].Box5_ReadOrder[0].{f}_12[0]': box5_1,
            f'{base}.RightCol[0].Box5_ReadOrder[0].{f}_13[0]': box5_2,
            # Box 6 - State/Payer's state no. (2 lines)
            f'{base}.RightCol[0].Box6_ReadOrder[0].{f}_14[0]': box6_1,
            f'{base}.RightCol[0].Box6_ReadOrder[0].{f}_15[0]': box6_2,
            # Box 7 - State income (2 lines)
            f'{base}.RightCol[0].Box7_ReadOrder[0].{f}_16[0]': box7_1,
            f'{base}.RightCol[0].Box7_ReadOrder[0].{f}_17[0]': box7_2,
        }

        return self._fill_and_extract(template_path, field_mapping, page_index)

    # ==================== 1099-MISC ====================
    def generate_1099_misc(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """Generate official IRS 1099-MISC PDF"""
        template_path = self.templates.get('1099-MISC')
        if not template_path:
            raise FileNotFoundError("1099-MISC template not found")

        page_index = self.PAGE_MAP['1099-MISC'].get(copy_type, 3)
        copy_names = {'A': 'CopyA', '1': 'Copy1', 'B': 'CopyB', '2': 'Copy2'}
        copy_name = copy_names.get(copy_type, 'CopyB')
        base = f'topmostSubform[0].{copy_name}[0]'
        f = 'f1' if copy_type == 'A' else 'f2'

        tax_year = safe_str(form_data.get('taxYear', '2025'))
        payer_info = _build_payer_block(form_data)
        payer_tin = format_ein(safe_str(form_data.get('payerEIN', '')))
        recipient_tin = format_ssn(safe_str(form_data.get('recipientSSN', '')))
        recipient_name = safe_str(form_data.get('recipientName', ''))
        recipient_address = safe_str(form_data.get('recipientAddress', ''))
        recipient_csz = _build_recipient_csz(form_data)
        account_number = safe_str(form_data.get('accountNumber', ''))

        field_mapping = {
            # Calendar Year - 1099-MISC uses CopyHeader
            f'{base}.CopyHeader[0].CalendarYear[0].{f}_1[0]': tax_year,
            # Left Column - 1099-MISC uses LeftColumn (not LeftCol)
            f'{base}.LeftColumn[0].{f}_2[0]': payer_info,
            f'{base}.LeftColumn[0].{f}_3[0]': payer_tin,
            f'{base}.LeftColumn[0].{f}_4[0]': recipient_tin,
            f'{base}.LeftColumn[0].{f}_5[0]': recipient_name,
            f'{base}.LeftColumn[0].{f}_6[0]': recipient_address,
            f'{base}.LeftColumn[0].{f}_7[0]': recipient_csz,
            f'{base}.LeftColumn[0].{f}_8[0]': account_number,
            # Right Column - 1099-MISC uses RightColumn (not RightCol)
            f'{base}.RightColumn[0].{f}_9[0]': format_amount(form_data.get('box1_rents', 0)),
            f'{base}.RightColumn[0].{f}_10[0]': format_amount(form_data.get('box2_royalties', 0)),
            f'{base}.RightColumn[0].{f}_11[0]': format_amount(form_data.get('box3_otherIncome', 0)),
            f'{base}.RightColumn[0].{f}_12[0]': format_amount(form_data.get('box4_federalTaxWithheld', 0)),
            f'{base}.RightColumn[0].{f}_13[0]': format_amount(form_data.get('box5_fishingBoat', 0)),
            f'{base}.RightColumn[0].{f}_14[0]': format_amount(form_data.get('box6_medicalPayments', 0)),
            f'{base}.RightColumn[0].{f}_15[0]': format_amount(form_data.get('box8_substitutePayments', 0)),
            f'{base}.RightColumn[0].{f}_16[0]': format_amount(form_data.get('box10_cropInsurance', 0)),
            f'{base}.RightColumn[0].{f}_17[0]': format_amount(form_data.get('box11_foreignTax', 0)),
            f'{base}.RightColumn[0].{f}_18[0]': safe_str(form_data.get('box12_foreignCountry', '')),
            f'{base}.RightColumn[0].{f}_19[0]': format_amount(form_data.get('box14_grossProceeds', 0)),
            f'{base}.RightColumn[0].{f}_21[0]': format_amount(form_data.get('box15_section409A', 0)),
            # Boxes 16-17 (State) - uses ReadOrder containers
            f'{base}.Box16_ReadOrder[0].{f}_22[0]': format_amount(form_data.get('box16_stateTaxWithheld', 0)),
            f'{base}.Box16_ReadOrder[0].{f}_23[0]': format_amount(form_data.get('box16_stateTaxWithheld2', 0)),
            f'{base}.Box17_ReadOrder[0].{f}_24[0]': safe_str(form_data.get('box17_statePayerNumber', '')),
            f'{base}.Box17_ReadOrder[0].{f}_25[0]': safe_str(form_data.get('box17_statePayerNumber2', '')),
            # Box 18 (State income) - directly under Copy
            f'{base}.{f}_26[0]': format_amount(form_data.get('box18_stateIncome', 0)),
            f'{base}.{f}_27[0]': format_amount(form_data.get('box18_stateIncome2', 0)),
        }

        return self._fill_and_extract(template_path, field_mapping, page_index)

    # ==================== 1099-INT ====================
    def generate_1099_int(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """Generate official IRS 1099-INT PDF (Interest Income)"""
        template_path = self.templates.get('1099-INT')
        if not template_path:
            raise FileNotFoundError("1099-INT template not found")

        page_index = self.PAGE_MAP['1099-INT'].get(copy_type, 3)
        copy_names = {'A': 'CopyA', '1': 'Copy1', 'B': 'CopyB', '2': 'Copy2'}
        copy_name = copy_names.get(copy_type, 'CopyB')
        base = f'topmostSubform[0].{copy_name}[0]'
        f = 'f1' if copy_type == 'A' else 'f2'

        tax_year = safe_str(form_data.get('taxYear', '2025'))
        payer_info = _build_payer_block(form_data)

        # 1099-INT structure varies by copy:
        # CopyA: LeftColumn, RightColumn, CopyHeader.CalendarYear1_1[0]
        # Copy1: LftColumn, RghtCol, CopyHeader.CalendarYear2_1[0]
        # CopyB: LeftColumn, RghtColumn, CopyBHeader.CalendarYear2_1[0]
        # Copy2: LeftColumn, RghtColumn, CopyHeader.CalendarYear2_1[0]

        if copy_type == 'A':
            year_field = f'{base}.CopyHeader[0].CalendarYear1_1[0]'
            lcol = f'{base}.LeftColumn[0]'
            rcol_box = lambda box, fld: f'{base}.RightColumn[0].Box{box}[0].{fld}'
            rcol = f'{base}.RightColumn[0]'
            state_base = f'{base}.RightColumn[0].Boxes15_16_17[0]'
        elif copy_type == '1':
            year_field = f'{base}.CopyHeader[0].CalendarYear2_1[0]'
            lcol = f'{base}.LftColumn[0]'
            rcol_box = lambda box, fld: f'{base}.RghtCol[0].Box{box}[0].{fld}'
            rcol = f'{base}.RghtCol[0]'
            state_base = f'{base}.RghtCol[0].Boxes15_16_17[0]'
        elif copy_type == 'B':
            year_field = f'{base}.CopyBHeader[0].CalendarYear2_1[0]'
            lcol = f'{base}.LeftColumn[0]'
            rcol_box = lambda box, fld: f'{base}.RghtColumn[0].Box{box}[0].{fld}'
            rcol = f'{base}.RghtColumn[0]'
            state_base = f'{base}.RghtColumn[0].Boxes15_16_17[0]'
        else:  # '2'
            year_field = f'{base}.CopyHeader[0].CalendarYear2_1[0]'
            lcol = f'{base}.LeftColumn[0]'
            rcol_box = lambda box, fld: f'{base}.RghtColumn[0].Box{box}[0].{fld}'
            rcol = f'{base}.RghtColumn[0]'
            state_base = f'{base}.RghtColumn[0].Boxes15_16_17[0]'

        # For 1099-INT, CopyA left column starts with f1_1 (payer info)
        # Others start with f2_1
        field_mapping = {
            year_field: tax_year,
            # Left Column - payer/recipient info
            f'{lcol}.{f}_1[0]': payer_info,
            f'{lcol}.{f}_2[0]': format_ein(safe_str(form_data.get('payerEIN', ''))),
            f'{lcol}.{f}_3[0]': format_ssn(safe_str(form_data.get('recipientSSN', ''))),
            f'{lcol}.{f}_4[0]': safe_str(form_data.get('recipientName', '')),
            f'{lcol}.{f}_5[0]': safe_str(form_data.get('recipientAddress', '')),
            f'{lcol}.{f}_6[0]': _build_recipient_csz(form_data),
            f'{lcol}.{f}_7[0]': safe_str(form_data.get('accountNumber', '')),
            # Right Column - numbered boxes
            rcol_box('1', f'{f}_9[0]'): format_amount(form_data.get('box1_interestIncome', 0)),
            rcol_box('2', f'{f}_10[0]'): format_amount(form_data.get('box2_earlyWithdrawal', 0)),
            rcol_box('3', f'{f}_11[0]'): format_amount(form_data.get('box3_savingsBondInterest', 0)),
            rcol_box('4', f'{f}_12[0]'): format_amount(form_data.get('box4_federalTaxWithheld', 0)),
            rcol_box('5', f'{f}_13[0]'): format_amount(form_data.get('box5_investmentExpenses', 0)),
            rcol_box('6', f'{f}_14[0]'): format_amount(form_data.get('box6_foreignTax', 0)),
            f'{rcol}.{f}_15[0]': safe_str(form_data.get('box7_foreignCountry', '')),
            rcol_box('8', f'{f}_16[0]'): format_amount(form_data.get('box8_taxExemptInterest', 0)),
            rcol_box('9', f'{f}_17[0]'): format_amount(form_data.get('box9_specifiedBondInterest', 0)),
            f'{rcol}.{f}_8[0]': safe_str(form_data.get('box7_foreignCountry', '')),
            rcol_box('10', f'{f}_18[0]'): format_amount(form_data.get('box10_marketDiscount', 0)),
            rcol_box('11', f'{f}_19[0]'): format_amount(form_data.get('box11_bondPremium', 0)),
            rcol_box('12', f'{f}_20[0]'): format_amount(form_data.get('box12_bondPremiumTreasury', 0)),
            rcol_box('13', f'{f}_21[0]'): format_amount(form_data.get('box13_bondPremiumTaxExempt', 0)),
            rcol_box('14', f'{f}_22[0]'): safe_str(form_data.get('box14_cusipNumber', '')),
            # State info (Boxes 15-17)
            f'{state_base}.{f}_23[0]': format_amount(form_data.get('box15_stateTaxWithheld', 0)),
            f'{state_base}.{f}_24[0]': format_amount(form_data.get('box15_stateTaxWithheld2', 0)),
            f'{state_base}.{f}_25[0]': safe_str(form_data.get('box16_statePayerNumber', '')),
            f'{state_base}.{f}_26[0]': safe_str(form_data.get('box16_statePayerNumber2', '')),
            f'{state_base}.{f}_27[0]': format_amount(form_data.get('box17_stateIncome', 0)),
            f'{state_base}.{f}_28[0]': format_amount(form_data.get('box17_stateIncome2', 0)),
        }

        return self._fill_and_extract(template_path, field_mapping, page_index)

    # ==================== W-2G ====================
    def generate_w2g(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """Generate official IRS W-2G PDF (Certain Gambling Winnings)"""
        template_path = self.templates.get('W-2G')
        if not template_path:
            raise FileNotFoundError("W-2G template not found")

        page_index = self.PAGE_MAP['W-2G'].get(copy_type, 2)
        copy_names = {
            'A': 'CopyA', '1': 'Copy1', 'B': 'CopyB',
            'C': 'CopyC', '2': 'Copy2', 'D': 'CopyD'
        }
        copy_name = copy_names.get(copy_type, 'CopyB')
        base = f'topmostSubform[0].{copy_name}[0]'

        # W-2G header field varies by copy
        header_names = {
            'A': 'CopyA_Header', '1': 'Copy1Header', 'B': 'CopyBHeader',
            'C': 'CopyCHeader', '2': 'Copy2Header', 'D': 'CopyDHeader'
        }
        header = header_names.get(copy_type, 'CopyBHeader')

        tax_year = safe_str(form_data.get('taxYear', '2025'))

        payer_info = (
            f"{safe_str(form_data.get('payerName', ''))}\n"
            f"{safe_str(form_data.get('payerAddress', ''))}\n"
            f"{safe_str(form_data.get('payerCity', ''))}, "
            f"{safe_str(form_data.get('payerState', ''))} "
            f"{safe_str(form_data.get('payerZip', ''))}"
        )

        field_mapping = {
            # Calendar Year
            f'{base}.{header}[0].f1_01[0]': tax_year,
            # Left Column
            f'{base}.Col_Left[0].f1_02[0]': payer_info,
            f'{base}.Col_Left[0].f1_03[0]': format_ein(safe_str(form_data.get('payerEIN', ''))),
            f'{base}.Col_Left[0].f1_04[0]': safe_str(form_data.get('payerPhone', '')),
            f'{base}.Col_Left[0].f1_05[0]': format_ssn(safe_str(form_data.get('winnerSSN', ''))),
            f'{base}.Col_Left[0].f1_06[0]': safe_str(form_data.get('winnerName', '')),
            f'{base}.Col_Left[0].f1_07[0]': safe_str(form_data.get('winnerAddress', '')),
            f'{base}.Col_Left[0].f1_08[0]': (
                f"{safe_str(form_data.get('winnerCity', ''))}, "
                f"{safe_str(form_data.get('winnerState', ''))} "
                f"{safe_str(form_data.get('winnerZip', ''))}"
            ),
            # Additional left column fields
            f'{base}.Col_Left[0].f1_09[0]': safe_str(form_data.get('winnerID', '')),
            f'{base}.Col_Left[0].f1_10[0]': safe_str(form_data.get('windowNumber', '')),
            f'{base}.Col_Left[0].f1_11[0]': safe_str(form_data.get('firstID', '')),
            f'{base}.Col_Left[0].f1_12[0]': safe_str(form_data.get('secondID', '')),
            # Payer's state id
            f'{base}.Col_Left[0].f1_16[0]': safe_str(form_data.get('payerStateId', '')),
            f'{base}.Col_Left[0].f1_17[0]': safe_str(form_data.get('payerStateId2', '')),
            # Right Column
            f'{base}.Col_Right[0].Box1_ReadOrder[0].f1_18[0]': format_amount(form_data.get('box1_grossWinnings', 0)),
            f'{base}.Col_Right[0].f1_19[0]': safe_str(form_data.get('box2_dateWon', '')),
            f'{base}.Col_Right[0].f1_20[0]': safe_str(form_data.get('box3_typeOfWager', '')),
            f'{base}.Col_Right[0].f1_21[0]': format_amount(form_data.get('box4_federalTaxWithheld', 0)),
            f'{base}.Col_Right[0].f1_22[0]': safe_str(form_data.get('box5_transaction', '')),
            f'{base}.Col_Right[0].f1_23[0]': safe_str(form_data.get('box6_race', '')),
            f'{base}.Col_Right[0].Box7_ReadOrder[0].f1_24[0]': format_amount(form_data.get('box7_identicalWinnings', 0)),
            f'{base}.Col_Right[0].f1_25[0]': safe_str(form_data.get('box8_cashier', '')),
            # Boxes 13-14 (state info)
            f'{base}.Col_Right[0].f1_30[0]': format_amount(form_data.get('box14_stateTaxWithheld', 0)),
            f'{base}.Col_Right[0].f1_31[0]': format_amount(form_data.get('box14_stateTaxWithheld2', 0)),
            f'{base}.Col_Right[0].Box15_ReadOrder[0].f1_32[0]': safe_str(form_data.get('box15_stateId', '')),
            f'{base}.Col_Right[0].f1_33[0]': safe_str(form_data.get('box15_stateId2', '')),
            f'{base}.Col_Right[0].Box17_ReadOrder[0].f1_34[0]': format_amount(form_data.get('box16_stateWinnings', 0)),
            f'{base}.Col_Right[0].f1_35[0]': format_amount(form_data.get('box16_stateWinnings2', 0)),
        }

        return self._fill_and_extract(template_path, field_mapping, page_index)

    # ==================== 1098 ====================
    def generate_1098(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """Generate official IRS 1098 PDF (Mortgage Interest Statement)"""
        template_path = self.templates.get('1098')
        if not template_path:
            raise FileNotFoundError("1098 template not found")

        page_index = self.PAGE_MAP['1098'].get(copy_type, 2)
        copy_names = {'A': 'CopyA', 'B': 'CopyB'}
        copy_name = copy_names.get(copy_type, 'CopyB')
        base = f'topmostSubform[0].{copy_name}[0]'
        f = 'f1' if copy_type == 'A' else 'f2'

        tax_year = safe_str(form_data.get('taxYear', '2025'))

        lender_info = (
            f"{safe_str(form_data.get('lenderName', ''))}\n"
            f"{safe_str(form_data.get('lenderAddress', ''))}\n"
            f"{safe_str(form_data.get('lenderCity', ''))}, "
            f"{safe_str(form_data.get('lenderState', ''))} "
            f"{safe_str(form_data.get('lenderZip', ''))}"
        )

        field_mapping = {
            # Calendar Year
            f'{base}.CopyHeader[0].CalendarYear[0].{f}_1[0]': tax_year,
            # Left Column
            f'{base}.LeftCol[0].{f}_2[0]': lender_info,
            f'{base}.LeftCol[0].{f}_3[0]': format_ein(safe_str(form_data.get('lenderEIN', ''))),
            f'{base}.LeftCol[0].{f}_4[0]': format_ssn(safe_str(form_data.get('borrowerSSN', ''))),
            f'{base}.LeftCol[0].{f}_5[0]': safe_str(form_data.get('borrowerName', '')),
            f'{base}.LeftCol[0].{f}_6[0]': safe_str(form_data.get('borrowerAddress', '')),
            f'{base}.LeftCol[0].{f}_7[0]': _build_recipient_csz(form_data, 'borrower'),
            f'{base}.LeftCol[0].{f}_10[0]': safe_str(form_data.get('accountNumber', '')),
            # Right Column - uses TagCorrectingSubform for some fields
            f'{base}.RightCol[0].TagCorrectingSubform[0].{f}_8[0]': safe_str(form_data.get('box0_lenderAccountNumber', '')),
            f'{base}.RightCol[0].TagCorrectingSubform[0].{f}_9[0]': safe_str(form_data.get('box0a_lenderAccountNumber2', '')),
            f'{base}.RightCol[0].{f}_11[0]': format_amount(form_data.get('box1_mortgageInterest', 0)),
            f'{base}.RightCol[0].{f}_12[0]': format_amount(form_data.get('box2_pointsPaid', 0)),
            f'{base}.RightCol[0].{f}_13[0]': format_amount(form_data.get('box3_originationDate', '')),
            f'{base}.RightCol[0].{f}_14[0]': format_amount(form_data.get('box4_refundOverpaid', 0)),
            f'{base}.RightCol[0].{f}_15[0]': format_amount(form_data.get('box5_mortgageInsurance', 0)),
            f'{base}.RightCol[0].{f}_16[0]': format_amount(form_data.get('box6_outstandingPrincipal', 0)),
            f'{base}.RightCol[0].{f}_17[0]': safe_str(form_data.get('box7_originationDate', '')),
            f'{base}.RightCol[0].{f}_18[0]': safe_str(form_data.get('box8_propertyAddress', '')),
        }

        return self._fill_and_extract(template_path, field_mapping, page_index)

    # ==================== 4506-T (Request for Transcript) ====================
    def generate_4506t(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """
        Generate official IRS Form 4506-T (Request for Transcript of Tax Return).
        Pre-fills taxpayer info and preparer info from form_data.
        """
        template_path = self.templates.get('4506-T')
        if not template_path:
            raise FileNotFoundError("4506-T template not found")

        base = 'topmostSubform[0].Page1[0]'

        # Build address block
        taxpayer_addr = (
            f"{safe_str(form_data.get('taxpayerAddress', ''))}\n"
            f"{safe_str(form_data.get('taxpayerCity', ''))}, "
            f"{safe_str(form_data.get('taxpayerState', ''))} "
            f"{safe_str(form_data.get('taxpayerZip', ''))}"
        )

        # Third party address (preparer receiving the transcript)
        third_party = safe_str(form_data.get('thirdPartyName', ''))
        if form_data.get('thirdPartyAddress'):
            third_party += f"\n{safe_str(form_data.get('thirdPartyAddress', ''))}"
            third_party += f"\n{safe_str(form_data.get('thirdPartyCity', ''))}, "
            third_party += f"{safe_str(form_data.get('thirdPartyState', ''))} "
            third_party += f"{safe_str(form_data.get('thirdPartyZip', ''))}"

        # Transcript type: 'return', 'account', 'record', 'nonfiling', 'w2_1099'
        transcript_type = safe_str(form_data.get('transcriptType', 'return')).lower()

        field_mapping = {
            # Line 1a - Name on tax return
            f'{base}.f1_1[0]': safe_str(form_data.get('taxpayerName', '')),
            # Line 1b - SSN/EIN
            f'{base}.f1_2[0]': format_ssn(safe_str(form_data.get('taxpayerSSN', ''))),
            # Line 2a - Spouse name
            f'{base}.f1_3[0]': safe_str(form_data.get('spouseName', '')),
            # Line 2b - Spouse SSN
            f'{base}.f1_4[0]': format_ssn(safe_str(form_data.get('spouseSSN', ''))) if form_data.get('spouseSSN') else '',
            # Line 3 - Current address
            f'{base}.f1_5[0]': taxpayer_addr,
            # Line 4 - Previous address
            f'{base}.f1_6[0]': safe_str(form_data.get('previousAddress', '')),
            # Line 5 - Customer file number
            f'{base}.customer_file_number[0]': safe_str(form_data.get('customerFileNumber', '')),
            # Line 6 - Tax form number (1040, 1065, etc.)
            f'{base}.f1_8[0]': safe_str(form_data.get('taxFormNumber', '1040')),
            # Phone
            f'{base}.f1_13[0]': safe_str(form_data.get('taxpayerPhone', '')),
            # Title
            f'{base}.f1_14[0]': safe_str(form_data.get('title', '')),
        }

        # Transcript type checkboxes (Line 6a-8)
        checkbox_map = {
            'return': f'{base}.c1_1[0]',      # 6a Return Transcript
            'account': f'{base}.c1_1[1]',     # 6b Account Transcript
            'record': f'{base}.c1_1[2]',      # 6c Record of Account
            'nonfiling': f'{base}.c1_1[3]',   # 7 Verification of Nonfiling
            'w2_1099': f'{base}.c1_1[4]',     # 8 W-2/1099 series
        }
        if transcript_type in checkbox_map:
            field_mapping[checkbox_map[transcript_type]] = '/Yes'

        # Line 9 - Years requested (up to 4 entries, each mm/dd/yyyy)
        years = form_data.get('yearsRequested', [])
        year_fields = [
            (f'{base}.f1_15[0]', f'{base}.f1_16[0]', f'{base}.f1_17[0]'),
            (f'{base}.f1_18[0]', f'{base}.f1_19[0]', f'{base}.f1_20[0]'),
            (f'{base}.f1_21[0]', f'{base}.f1_22[0]', f'{base}.f1_23[0]'),
            (f'{base}.f1_24[0]', f'{base}.f1_25[0]', f'{base}.f1_26[0]'),
        ]
        for i, year_entry in enumerate(years[:4]):
            yr = safe_str(year_entry)
            # Parse mm/dd/yyyy or just year
            if '/' in yr:
                parts = yr.split('/')
                if len(parts) == 3:
                    field_mapping[year_fields[i][0]] = parts[0]  # mm
                    field_mapping[year_fields[i][1]] = parts[1]  # dd
                    field_mapping[year_fields[i][2]] = parts[2]  # yyyy
            elif len(yr) == 4:
                # Just a year, use 12/31/YYYY format
                field_mapping[year_fields[i][0]] = '12'
                field_mapping[year_fields[i][1]] = '31'
                field_mapping[year_fields[i][2]] = yr

        return self._fill_and_extract(template_path, field_mapping, 0)

    # ==================== 8821 (Tax Information Authorization) ====================
    def generate_8821(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """
        Generate official IRS Form 8821 (Tax Information Authorization).
        Authorizes the preparer to receive tax info from IRS on behalf of client.
        """
        template_path = self.templates.get('8821')
        if not template_path:
            raise FileNotFoundError("8821 template not found")

        base = 'topmostSubform[0].Page1[0]'

        # Line 1 - Taxpayer info
        taxpayer_info = safe_str(form_data.get('taxpayerName', ''))
        addr = safe_str(form_data.get('taxpayerAddress', ''))
        city = safe_str(form_data.get('taxpayerCity', ''))
        state = safe_str(form_data.get('taxpayerState', ''))
        zipcode = safe_str(form_data.get('taxpayerZip', ''))
        if addr:
            taxpayer_info += f"\n{addr}"
        csz = f"{city}, {state} {zipcode}".strip()
        if csz.strip(',').strip():
            taxpayer_info += f"\n{csz}"

        # Line 2 - Appointee (the preparer)
        appointee_info = safe_str(form_data.get('appointeeName', ''))
        appt_addr = safe_str(form_data.get('appointeeAddress', ''))
        appt_city = safe_str(form_data.get('appointeeCity', ''))
        appt_state = safe_str(form_data.get('appointeeState', ''))
        appt_zip = safe_str(form_data.get('appointeeZip', ''))
        if appt_addr:
            appointee_info += f"\n{appt_addr}"
        appt_csz = f"{appt_city}, {appt_state} {appt_zip}".strip()
        if appt_csz.strip(',').strip():
            appointee_info += f"\n{appt_csz}"

        field_mapping = {
            # Line 1 - Taxpayer
            f'{base}.f1_6[0]': taxpayer_info,
            f'{base}.f1_7[0]': format_ssn(safe_str(form_data.get('taxpayerSSN', ''))),
            f'{base}.f1_8[0]': safe_str(form_data.get('taxpayerPhone', '')),
            f'{base}.f1_9[0]': safe_str(form_data.get('planNumber', '')),
            # Line 2 - Appointee 1
            f'{base}.f1_10[0]': appointee_info,
            f'{base}.f1_11[0]': safe_str(form_data.get('cafNumber', '')),
            f'{base}.f1_12[0]': safe_str(form_data.get('appointeePhone', '')),
            f'{base}.f1_13[0]': safe_str(form_data.get('appointeeFax', '')),
            f'{base}.f1_14[0]': safe_str(form_data.get('appointeePTIN', '')),
        }

        # Line 3 - Tax matters table (up to 3 rows)
        # Each row: Tax form number, Years/periods, Specific tax matters, Specific use
        tax_matters = form_data.get('taxMatters', [])
        table_base = f'{base}.Table_Line3[0]'
        rows = ['BodyRow1[0]', 'BodyRow2[0]', 'BodyRow3[0]']
        row_fields = [
            ['f1_20[0]', 'f1_21[0]', 'f1_22[0]', 'f1_23[0]'],
            ['f1_24[0]', 'f1_25[0]', 'f1_26[0]', 'f1_27[0]'],
            ['f1_28[0]', 'f1_29[0]', 'f1_30[0]', 'f1_31[0]'],
        ]

        for i, matter in enumerate(tax_matters[:3]):
            field_mapping[f'{table_base}.{rows[i]}.{row_fields[i][0]}'] = safe_str(matter.get('taxForm', '1040'))
            field_mapping[f'{table_base}.{rows[i]}.{row_fields[i][1]}'] = safe_str(matter.get('years', ''))
            field_mapping[f'{table_base}.{rows[i]}.{row_fields[i][2]}'] = safe_str(matter.get('description', ''))
            field_mapping[f'{table_base}.{rows[i]}.{row_fields[i][3]}'] = safe_str(matter.get('specificUse', ''))

        # Signature fields
        field_mapping[f'{base}.f1_32[0]'] = safe_str(form_data.get('taxpayerPrintName', form_data.get('taxpayerName', '')))
        field_mapping[f'{base}.f1_33[0]'] = safe_str(form_data.get('signatureDate', ''))

        return self._fill_and_extract(template_path, field_mapping, 0)

    # ==================== 2848 (Power of Attorney) ====================
    def generate_2848(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """
        Generate official IRS Form 2848 (Power of Attorney and Declaration of Representative).
        """
        template_path = self.templates.get('2848')
        if not template_path:
            raise FileNotFoundError("2848 template not found")

        base = 'topmostSubform[0].Page1[0]'
        base2 = 'topmostSubform[0].Page2[0]'

        # Taxpayer address block
        taxpayer_addr = safe_str(form_data.get('taxpayerAddress', ''))
        city = safe_str(form_data.get('taxpayerCity', ''))
        state = safe_str(form_data.get('taxpayerState', ''))
        zipcode = safe_str(form_data.get('taxpayerZip', ''))
        csz = f"{city}, {state} {zipcode}".strip()
        full_addr = taxpayer_addr
        if csz.strip(',').strip():
            full_addr += f"\n{csz}"

        # Representative address block
        rep_addr = safe_str(form_data.get('representativeAddress', ''))
        rep_city = safe_str(form_data.get('representativeCity', ''))
        rep_state = safe_str(form_data.get('representativeState', ''))
        rep_zip = safe_str(form_data.get('representativeZip', ''))
        rep_csz = f"{rep_city}, {rep_state} {rep_zip}".strip()
        rep_full_addr = rep_addr
        if rep_csz.strip(',').strip():
            rep_full_addr += f"\n{rep_csz}"

        field_mapping = {
            # Line 1 - Taxpayer
            f'{base}.TaxpayerName[0]': safe_str(form_data.get('taxpayerName', '')),
            f'{base}.TaxpayerIDSSN[0]': format_ssn(safe_str(form_data.get('taxpayerSSN', ''))),
            f'{base}.TaxpayerAddress[0]': full_addr,
            f'{base}.TaxpayerTelephone[0]': safe_str(form_data.get('taxpayerPhone', '')),
            # Line 2 - Representative 1
            f'{base}.RepresentativesName1[0]': safe_str(form_data.get('representativeName', '')),
            f'{base}.RepresentativesAddress1[0]': rep_full_addr,
            f'{base}.CAFNumber1[0]': safe_str(form_data.get('cafNumber', '')),
            f'{base}.PTIN1[0]': safe_str(form_data.get('ptin', '')),
            f'{base}.TelephoneNo1[0]': safe_str(form_data.get('representativePhone', '')),
            f'{base}.FaxNo1[0]': safe_str(form_data.get('representativeFax', '')),
        }

        # Line 3 - Tax matters table
        tax_matters = form_data.get('taxMatters', [])
        table_base = f'{base}.Table_Line3[0]'
        row_configs = [
            ('BodyRow1[0]', 'TaxForm1[0]', 'Years1[0]', 'Description1[0]'),
            ('BodyRow2[0]', 'TaxForm2[0]', 'Years2[0]', 'Description2[0]'),
            ('BodyRow3[0]', 'TaxForm3[0]', 'Years3[0]', 'Description3[0]'),
        ]

        for i, matter in enumerate(tax_matters[:3]):
            row, tf, yr, desc = row_configs[i]
            field_mapping[f'{table_base}.{row}.{tf}'] = safe_str(matter.get('taxForm', '1040'))
            field_mapping[f'{table_base}.{row}.{yr}'] = safe_str(matter.get('years', ''))
            field_mapping[f'{table_base}.{row}.{desc}'] = safe_str(matter.get('description', ''))

        # Page 2 - Declaration of Representative
        field_mapping[f'{base2}.PrintNameTaxpayer[0]'] = safe_str(form_data.get('taxpayerName', ''))
        field_mapping[f'{base2}.PrintName[0]'] = safe_str(form_data.get('representativeName', ''))

        # Part II - Declaration (first representative)
        part2 = f'{base2}.Table_PartII[0].BodyRow1[0]'
        field_mapping[f'{part2}.Designation1[0]'] = safe_str(form_data.get('designation', ''))
        field_mapping[f'{part2}.Jurisdiction1[0]'] = safe_str(form_data.get('jurisdiction', ''))
        field_mapping[f'{part2}.Bar1[0]'] = safe_str(form_data.get('barNumber', ''))
        field_mapping[f'{part2}.Date1[0]'] = safe_str(form_data.get('signatureDate', ''))

        # For 2848, we output both pages
        reader = PdfReader(template_path)
        writer = PdfWriter()
        writer.clone_reader_document_root(reader)

        for page in writer.pages:
            writer.update_page_form_field_values(page, field_mapping, auto_regenerate=False)

        buffer = BytesIO()
        writer.write(buffer)
        return buffer.getvalue()

    # ==================== GENERIC DISPATCHER ====================
    def generate_form_pdf(self, form_data: Dict[str, Any], copy_type: str = 'B') -> bytes:
        """Generate any supported form PDF"""
        form_type = form_data.get('formType', '1099-NEC').upper()

        generators = {
            '1099-NEC': self.generate_1099_nec,
            '1099-MISC': self.generate_1099_misc,
            '1099-INT': self.generate_1099_int,
            'W-2G': self.generate_w2g,
            '1098': self.generate_1098,
            '4506-T': self.generate_4506t,
            '8821': self.generate_8821,
            '2848': self.generate_2848,
        }

        generator = generators.get(form_type)
        if not generator:
            raise ValueError(f"Unsupported form type: {form_type}. Supported: {list(generators.keys())}")

        return generator(form_data, copy_type)

    def generate_form_pdf_base64(self, form_data: Dict[str, Any], copy_type: str = 'B') -> str:
        """Generate form PDF and return as base64"""
        pdf_bytes = self.generate_form_pdf(form_data, copy_type)
        return base64.b64encode(pdf_bytes).decode('utf-8')

    def generate_all_copies(self, form_data: Dict[str, Any]) -> Dict[str, bytes]:
        """Generate all copies of a form"""
        form_type = form_data.get('formType', '1099-NEC').upper()
        copies = list(self.PAGE_MAP.get(form_type, {'B': 0}).keys())

        result = {}
        for copy in copies:
            try:
                result[copy] = self.generate_form_pdf(form_data, copy)
            except Exception as e:
                logger.error(f"Error generating Copy {copy} for {form_type}: {e}")

        return result

    def get_available_forms(self) -> list:
        """Return list of available form types"""
        return list(self.templates.keys())


# Singleton
_pdf_generator = None


def get_official_pdf_generator() -> IRSOfficialPDFGenerator:
    global _pdf_generator
    if _pdf_generator is None:
        _pdf_generator = IRSOfficialPDFGenerator()
    return _pdf_generator
