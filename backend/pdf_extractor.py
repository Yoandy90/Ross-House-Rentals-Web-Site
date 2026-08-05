"""
PDF Tax Document Extractor
Extracts client data from tax return PDFs using GPT-4o Vision
"""

import os
import base64
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO

from dotenv import load_dotenv
load_dotenv()

from PIL import Image

# Lazy import for PyMuPDF (requires system deps on Railway)
try:
    import fitz  # PyMuPDF
    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False
    fitz = None

# Lazy import for emergentintegrations (not available on Railway/PyPI)
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    HAS_EMERGENT = True
except ImportError:
    HAS_EMERGENT = False
    LlmChat = None
    UserMessage = None
    ImageContent = None

import re

# MongoDB setup
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client.tax_app

# Collections
pdf_batches_collection = db.pdf_batches
pdf_extractions_collection = db.pdf_extractions
contact_lists_collection = db.contact_lists
merged_records_collection = db.merged_records

EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

# Extraction prompt for tax documents - OPTIMIZED for Form 1040 Direct Deposit section
EXTRACTION_PROMPT = """You are an expert OCR system reading an IRS Form 1040 tax return image.

TASK 1 - NAME (top of form, page 1):
Find "Your first name and middle initial" and "Last name" fields at the top.

TASK 2 - BANK NUMBERS (refund section, usually page 2):
Find the "Refund" section with lines 35a through 35d.

For LINE 35b (Routing number) - there are EXACTLY 9 small boxes in a row:
- Point to box 1 (leftmost), read that digit
- Point to box 2, read that digit
- Continue for all 9 boxes
- Write them as: "box1 box2 box3 box4 box5 box6 box7 box8 box9"
- Then combine into routing_digits field

For LINE 35d (Account number) - there are up to 17 small boxes in a row:
- Point to box 1 (leftmost), read that digit
- Continue reading each box left to right
- STOP when you reach an empty/blank box
- Write them as: "box1 box2 box3 box4 ..."
- Then combine into account_digits field

CRITICAL: You MUST read EACH BOX INDIVIDUALLY. Do NOT try to read the whole number at once.
If two adjacent boxes contain the same digit (e.g., 8 8 or 0 0), you MUST report BOTH digits.
Count your digits: routing MUST have exactly 9. Recount if you get more or fewer.

Respond with ONLY this JSON (no markdown, no extra text):
{"nombre":"FIRST","apellido":"LAST","routing_boxes":"d1 d2 d3 d4 d5 d6 d7 d8 d9","routing_digits":"123456789","account_boxes":"d1 d2 d3 d4 ...","account_digits":"1234567890","total_account_boxes":12,"confianza":0.9}

If the refund section is not on this page, use empty strings for routing and account fields."""


# Second-pass verification prompt focused ONLY on bank numbers
VERIFICATION_PROMPT = """VERY IMPORTANT: Read this IRS Form 1040 image with EXTREME CARE.

Focus ONLY on the REFUND section (lines 35a-35d).

STEP 1 - ROUTING NUMBER (Line 35b):
There is a row of EXACTLY 9 small square boxes. Each box contains ONE digit.
Read them one at a time:
- Box 1 (far left): ?
- Box 2: ?
- Box 3: ?
- Box 4: ?
- Box 5: ?
- Box 6: ?
- Box 7: ?
- Box 8: ?
- Box 9 (far right): ?
List all 9 digits separated by spaces.

STEP 2 - ACCOUNT NUMBER (Line 35d):
There is a row of up to 17 small square boxes. Some may be empty.
Read filled boxes one at a time from left to right:
- Box 1 (far left): ?
- Box 2: ?
- Box 3: ?
- Continue until you reach an EMPTY box, then STOP.
List all digits separated by spaces.

WARNING: 
- Consecutive identical digits are COMMON (e.g., 1 1 1 or 8 8 or 0 0 0). Report ALL of them.
- Do NOT merge or skip repeated digits.
- RECOUNT your digits for routing - it MUST be exactly 9.

Respond with ONLY this JSON:
{"routing_by_box":"1 1 1 0 0 0 0 2 5","routing_number":"111000025","routing_count":9,"account_by_box":"4 8 8 1 3 0 4 9 6 8 7 6","account_number":"488130496876","account_count":12}

If the refund section is not on this page, return empty strings."""


def validate_routing_number(routing: str) -> dict:
    """Validate ABA routing number using checksum algorithm"""
    if not routing or routing == "NO_ENCONTRADO":
        return {"valid": False, "error": "No routing number provided"}
    
    # Remove any spaces or dashes
    routing = routing.replace(" ", "").replace("-", "")
    
    # Must be exactly 9 digits
    if not routing.isdigit() or len(routing) != 9:
        return {"valid": False, "error": f"Routing must be 9 digits, got {len(routing)}"}
    
    # ABA checksum validation
    # Formula: 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + (d3 + d6 + d9) mod 10 = 0
    digits = [int(d) for d in routing]
    checksum = (
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        (digits[2] + digits[5] + digits[8])
    ) % 10
    
    if checksum != 0:
        return {"valid": False, "error": "Invalid ABA checksum"}
    
    return {"valid": True, "routing": routing}


def validate_account_number(account: str) -> dict:
    """Validate account number format"""
    if not account or account == "NO_ENCONTRADO":
        return {"valid": False, "error": "No account number provided"}
    
    # Remove any spaces or dashes
    account = account.replace(" ", "").replace("-", "")
    
    # Must be 4-17 digits
    if not account.isdigit():
        return {"valid": False, "error": "Account must contain only digits"}
    
    if len(account) < 4 or len(account) > 17:
        return {"valid": False, "error": f"Account must be 4-17 digits, got {len(account)}"}
    
    return {"valid": True, "account": account}


async def extract_from_acroform(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    LAYER 1: Extract data from PDF AcroForm fields (form widgets).
    Tax software like Drake generates PDFs with form fields — this gives 100% accurate data.
    """
    result = {
        "nombre": "", "apellido": "", "routing_number": "", "account_number": "",
        "method": "acroform", "has_fields": False, "fields_found": {}, "ssn": "",
        "refund_amount": "", "account_type": ""
    }
    
    try:
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_fields = {}
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            for widget in page.widgets():
                name = (widget.field_name or "").strip()
                value = (widget.field_value or "").strip()
                if name and value:
                    all_fields[name] = value
                    # Also store lowercase version for easier lookup
                    all_fields[name.lower()] = value
        
        pdf_document.close()
        
        if not all_fields:
            print("  📋 No AcroForm fields found in PDF")
            return result
        
        result["has_fields"] = True
        result["fields_found"] = {k: v for k, v in all_fields.items() if not k.startswith("topmostSubform") or len(v) > 0}
        print(f"  📋 Found {len(all_fields)} AcroForm fields")
        
        # === IRS Form 1040 field name patterns ===
        # Drake uses: topmostSubform.Page1.f1_XX or similar
        # Other software may use: Line35b, RoutingNumber, etc.
        
        routing_field_names = [
            'routing', 'routingnumber', 'routing_number', 'line35b', '35b',
            'refund_routing', 'bankrouting', 'aba', 'rtn'
        ]
        account_field_names = [
            'account', 'accountnumber', 'account_number', 'line35d', '35d',
            'refund_account', 'bankaccount', 'acctno'
        ]
        firstname_field_names = [
            'firstname', 'first_name', 'fname', 'nombre', 'yourfirstname'
        ]
        lastname_field_names = [
            'lastname', 'last_name', 'lname', 'apellido', 'yourlastname'
        ]
        
        # Search through all fields
        for field_name_raw, field_value in all_fields.items():
            fn = field_name_raw.lower().replace(" ", "").replace("_", "").replace("-", "")
            fn_parts = fn.split(".")  # Handle hierarchical names like topmostSubform.Page1.f1_09
            fn_last = fn_parts[-1] if fn_parts else fn
            
            # Routing number
            if not result["routing_number"]:
                for pattern in routing_field_names:
                    if pattern in fn or pattern in fn_last:
                        clean_val = field_value.replace(" ", "").replace("-", "")
                        if clean_val.isdigit() and len(clean_val) == 9:
                            result["routing_number"] = clean_val
                            print(f"    ✅ Routing from field '{field_name_raw}': {clean_val}")
                            break
            
            # Account number
            if not result["account_number"]:
                for pattern in account_field_names:
                    if pattern in fn or pattern in fn_last:
                        clean_val = field_value.replace(" ", "").replace("-", "")
                        if clean_val.isdigit() and 4 <= len(clean_val) <= 17:
                            result["account_number"] = clean_val
                            print(f"    ✅ Account from field '{field_name_raw}': {clean_val}")
                            break
            
            # First name
            if not result["nombre"]:
                for pattern in firstname_field_names:
                    if pattern in fn or pattern in fn_last:
                        if field_value and not field_value.isdigit():
                            result["nombre"] = field_value.strip()
                            print(f"    ✅ First name from field '{field_name_raw}': {field_value}")
                            break
            
            # Last name
            if not result["apellido"]:
                for pattern in lastname_field_names:
                    if pattern in fn or pattern in fn_last:
                        if field_value and not field_value.isdigit():
                            result["apellido"] = field_value.strip()
                            print(f"    ✅ Last name from field '{field_name_raw}': {field_value}")
                            break
            
            # Account type (checking/savings)
            if 'checking' in fn or 'savings' in fn or '35c' in fn:
                if field_value and field_value.lower() in ['yes', 'on', 'true', '1', 'x', 'checked']:
                    result["account_type"] = "checking" if "checking" in fn else "savings"
            
            # Refund amount
            if ('35a' in fn or 'refund' in fn) and not result["refund_amount"]:
                clean_val = field_value.replace("$", "").replace(",", "").strip()
                try:
                    float(clean_val)
                    result["refund_amount"] = clean_val
                except ValueError:
                    pass
        
        # If no specific field names matched, try matching by value pattern
        # (some PDFs use generic field names like f1_01, f1_02, etc.)
        if not result["routing_number"] or not result["account_number"]:
            for field_name, field_value in all_fields.items():
                clean_val = field_value.replace(" ", "").replace("-", "")
                
                # Routing: exactly 9 digits that pass ABA checksum
                if not result["routing_number"] and clean_val.isdigit() and len(clean_val) == 9:
                    validation = validate_routing_number(clean_val)
                    if validation["valid"]:
                        result["routing_number"] = clean_val
                        print(f"    ✅ Routing via ABA validation from field '{field_name}': {clean_val}")
                
                # Account: 4-17 digits (but not SSN-length 9, and not routing)
                if not result["account_number"] and clean_val.isdigit() and 4 <= len(clean_val) <= 17:
                    if clean_val != result["routing_number"] and len(clean_val) != 9:
                        result["account_number"] = clean_val
                        print(f"    ✅ Account via pattern from field '{field_name}': {clean_val}")
        
        print(f"  📊 AcroForm results: nombre='{result['nombre']}', routing='{result['routing_number']}', account='{result['account_number']}'")
        return result
        
    except Exception as e:
        print(f"  ❌ AcroForm extraction error: {e}")
        return result


async def extract_with_pdfplumber(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    LAYER 2: Extract data using pdfplumber for structured text with coordinates.
    Better at handling complex PDF layouts than plain text extraction.
    """
    try:
        import pdfplumber
    except ImportError:
        print("  ⚠️ pdfplumber not installed, skipping Layer 2")
        return {"nombre": "", "apellido": "", "routing_number": "", "account_number": "", "method": "pdfplumber", "has_text": False, "pages_text": []}
    
    result = {
        "nombre": "", "apellido": "", "routing_number": "", "account_number": "",
        "method": "pdfplumber", "has_text": False, "pages_text": []
    }
    
    try:
        pdf = pdfplumber.open(BytesIO(pdf_bytes))
        all_text = ""
        pages_text = []
        
        # Try to get form fields via pdfplumber/pdfminer
        try:
            if hasattr(pdf, 'doc') and pdf.doc.catalog:
                catalog = pdf.doc.catalog
                if 'AcroForm' in catalog:
                    acroform = catalog['AcroForm'].resolve()
                    if 'Fields' in acroform:
                        fields = acroform['Fields']
                        for field_ref in fields:
                            try:
                                field = field_ref.resolve()
                                fname = str(field.get('T', ''))
                                fvalue = str(field.get('V', ''))
                                if fname and fvalue and fvalue != 'None':
                                    # Check for routing/account
                                    clean_val = fvalue.replace(" ", "").replace("-", "")
                                    fn_lower = fname.lower()
                                    
                                    if ('routing' in fn_lower or '35b' in fn_lower) and clean_val.isdigit() and len(clean_val) == 9:
                                        result["routing_number"] = clean_val
                                        print(f"    ✅ pdfplumber field routing: {clean_val}")
                                    elif ('account' in fn_lower or '35d' in fn_lower) and clean_val.isdigit() and 4 <= len(clean_val) <= 17:
                                        result["account_number"] = clean_val
                                        print(f"    ✅ pdfplumber field account: {clean_val}")
                                    elif 'first' in fn_lower and not fvalue.isdigit():
                                        result["nombre"] = fvalue.strip()
                                    elif 'last' in fn_lower and not fvalue.isdigit():
                                        result["apellido"] = fvalue.strip()
                            except Exception:
                                continue
        except Exception as e:
            print(f"    ⚠️ pdfplumber form fields error: {e}")
        
        # Extract text from each page
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages_text.append(text)
            all_text += text + "\n"
            
            # Also try extracting text with layout preservation
            text_layout = page.extract_text(layout=True) or ""
            if len(text_layout) > len(text):
                all_text += text_layout + "\n"
        
        pdf.close()
        result["pages_text"] = pages_text
        
        clean_text = all_text.strip()
        if len(clean_text) < 50:
            print(f"  📄 pdfplumber: minimal text ({len(clean_text)} chars)")
            return result
        
        result["has_text"] = True
        print(f"  📄 pdfplumber: {len(clean_text)} chars extracted")
        
        # Smart regex extraction on the full text
        if not result["routing_number"]:
            result["routing_number"] = _find_routing_in_text(all_text)
        if not result["account_number"]:
            result["account_number"] = _find_account_in_text(all_text, result["routing_number"])
        if not result["nombre"]:
            nombre, apellido = _find_name_in_text(all_text, pages_text)
            result["nombre"] = nombre
            result["apellido"] = apellido
        
        print(f"  📊 pdfplumber results: nombre='{result['nombre']}', routing='{result['routing_number']}', account='{result['account_number']}'")
        return result
        
    except Exception as e:
        print(f"  ❌ pdfplumber error: {e}")
        return result


async def extract_text_from_pdf(pdf_bytes: bytes) -> Dict[str, Any]:
    """
    LAYER 3 (Legacy): Extract text using PyMuPDF with improved regex.
    Kept as additional fallback.
    """
    result = {
        "nombre": "", "apellido": "", "routing_number": "", "account_number": "",
        "method": "text_extraction", "pages_text": [], "has_text": False
    }
    
    try:
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_text = ""
        pages_text = []
        
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            # Use multiple text extraction modes for best coverage
            text_plain = page.get_text("text")
            text_blocks = page.get_text("blocks")
            
            pages_text.append(text_plain)
            all_text += text_plain + "\n"
            
            # Also extract text from blocks (includes position info)
            for block in text_blocks:
                if block[6] == 0:  # text block (not image)
                    block_text = block[4].strip()
                    if block_text and block_text not in all_text:
                        all_text += block_text + "\n"
        
        pdf_document.close()
        result["pages_text"] = pages_text
        
        clean_text = all_text.strip()
        if len(clean_text) < 50:
            result["has_text"] = False
            return result
        
        result["has_text"] = True
        print(f"  📄 PyMuPDF: {len(clean_text)} chars extracted")
        
        result["routing_number"] = _find_routing_in_text(all_text)
        result["account_number"] = _find_account_in_text(all_text, result["routing_number"])
        nombre, apellido = _find_name_in_text(all_text, pages_text)
        result["nombre"] = nombre
        result["apellido"] = apellido
        
        return result
        
    except Exception as e:
        print(f"  ❌ PyMuPDF text extraction error: {e}")
        result["has_text"] = False
        return result


def _find_routing_in_text(text: str) -> str:
    """Find routing number in text using comprehensive patterns"""
    
    # Pattern priority list
    routing_patterns = [
        r'[Rr]outing\s*(?:number|#|num|no\.?)?\s*[:\.]?\s*(\d[\d\s]{7,10}\d)',
        r'35\s*b\s*[:\.]?\s*(\d[\d\s]{7,10}\d)',
        r'b\s+[Rr]outing.*?(\d[\d\s]{7,10}\d)',
        r'(?:[Rr]outing|35b|RTN)[\s\S]{0,80}?(\d{9})',
        r'(\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d)(?=\s*[cd\s]*[Aa]ccount)',
    ]
    
    for pattern in routing_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).replace(" ", "")
            if len(candidate) == 9 and candidate.isdigit():
                validation = validate_routing_number(candidate)
                if validation["valid"]:
                    print(f"    ✅ Routing found: {candidate}")
                    return candidate
    
    # Fallback: scan ALL 9-digit numbers for valid ABA
    all_9digit = re.findall(r'\b(\d{9})\b', text)
    for candidate in all_9digit:
        validation = validate_routing_number(candidate)
        if validation["valid"]:
            print(f"    ✅ Routing via ABA scan: {candidate}")
            return candidate
    
    return ""


def _find_account_in_text(text: str, routing: str) -> str:
    """Find account number in text"""
    
    account_patterns = [
        r'[Aa]ccount\s*(?:number|#|num|no\.?)?\s*[:\.]?\s*(\d[\d\s]{3,20}\d)',
        r'35\s*d\s*[:\.]?\s*(\d[\d\s]{3,20}\d)',
        r'd\s+[Aa]ccount.*?(\d[\d\s]{3,20}\d)',
        r'(?:[Aa]ccount|35d|Acct)[\s\S]{0,80}?(\d{4,17})',
    ]
    
    for pattern in account_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            candidate = match.group(1).replace(" ", "")
            if 4 <= len(candidate) <= 17 and candidate.isdigit() and candidate != routing:
                print(f"    ✅ Account found: {candidate}")
                return candidate
    
    return ""


def _find_name_in_text(text: str, pages_text: list) -> tuple:
    """Find name in text"""
    nombre, apellido = "", ""
    
    name_patterns = [
        r'(?:Your\s+)?[Ff]irst\s+name.*?(?:initial)?\s*\n?\s*([A-Z][A-Za-z]+(?:\s+[A-Z]\.?)?)\s*\n?\s*(?:Last\s+name)\s*\n?\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)',
        r'([A-Z][a-z]+(?:\s+[A-Z]\.?)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\n',
    ]
    
    for pattern in name_patterns:
        match = re.search(pattern, text)
        if match:
            nombre = match.group(1).strip()
            apellido = match.group(2).strip()
            return nombre, apellido
    
    # Scan lines near "first name" label
    if pages_text:
        lines = pages_text[0].split('\n')
        for idx, line in enumerate(lines):
            if 'first name' in line.lower() or 'nombre' in line.lower():
                for check_idx in range(idx, min(idx + 5, len(lines))):
                    candidate = lines[check_idx].strip()
                    if candidate and not any(kw in candidate.lower() for kw in ['first', 'last', 'name', 'initial', 'form', '1040', 'social', 'ssn', 'address']):
                        words = candidate.split()
                        if 2 <= len(words) <= 5 and all(w[0].isupper() for w in words if w):
                            return words[0], " ".join(words[1:])
                break
    
    return nombre, apellido


async def convert_pdf_to_images(pdf_bytes: bytes, max_pages: int = 40) -> List[str]:
    """Convert PDF pages to base64 images with high quality for OCR"""
    images_base64 = []
    
    try:
        # Open PDF with PyMuPDF
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page_num in range(min(len(pdf_document), max_pages)):
            page = pdf_document[page_num]
            
            # Render page to image (300 DPI - good balance of quality and size)
            pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
            
            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Convert to base64 JPEG (smaller than PNG, still high quality)
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=95)
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            images_base64.append(img_base64)
        
        pdf_document.close()
        
    except Exception as e:
        print(f"Error converting PDF: {e}")
        raise
    
    return images_base64


async def analyze_text_with_gpt(text: str, session_id: str) -> Dict[str, Any]:
    """Send extracted PDF text to GPT for structured parsing - MUCH more reliable than image OCR"""
    import litellm
    
    try:
        if not EMERGENT_LLM_KEY:
            return {"error": "No LLM key"}
        
        # Truncate text if too long (keep first 8000 chars which should cover Form 1040)
        text_to_send = text[:8000] if len(text) > 8000 else text
        
        prompt = f"""Extract the following data from this IRS Form 1040 tax return text:

1. First name (from "Your first name and middle initial")
2. Last name
3. Routing number (exactly 9 digits, from line 35b)
4. Account number (4-17 digits, from line 35d)

The text below was extracted directly from the PDF:
---
{text_to_send}
---

Respond with ONLY this JSON:
{{"nombre":"FIRST_NAME","apellido":"LAST_NAME","routing_number":"123456789","account_number":"1234567890"}}"""
        
        proxy_url = os.getenv("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com")
        
        response = litellm.completion(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Extract data from tax document text. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            api_key=EMERGENT_LLM_KEY,
            api_base=proxy_url + "/llm",
            custom_llm_provider="openai",
            max_tokens=500,
            temperature=0.0
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Clean markdown
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        data = json.loads(response_text.strip())
        
        # Clean results
        routing = (data.get("routing_number", "") or "").replace(" ", "").replace("-", "")
        account = (data.get("account_number", "") or "").replace(" ", "").replace("-", "")
        
        print(f"  📊 GPT text analysis: nombre='{data.get('nombre', '')}', routing='{routing}', account='{account}'")
        
        return {
            "nombre": data.get("nombre", ""),
            "apellido": data.get("apellido", ""),
            "routing_number": routing if routing.isdigit() and len(routing) == 9 else "",
            "account_number": account if account.isdigit() and 4 <= len(account) <= 17 else ""
        }
        
    except Exception as e:
        print(f"  ❌ GPT text analysis error: {e}")
        return {"nombre": "", "apellido": "", "routing_number": "", "account_number": ""}


async def extract_data_from_image(image_base64: str, session_id: str, prompt: str = None) -> Dict[str, Any]:
    """Use GPT-4o to extract data from tax document image using litellm directly"""
    import litellm
    
    try:
        print(f"🔍 Extracting data from image (session: {session_id})...")
        
        if not EMERGENT_LLM_KEY:
            print("❌ ERROR: EMERGENT_LLM_KEY not set!")
            return {"error": "EMERGENT_LLM_KEY not configured", "confianza": 0.0}
        
        use_prompt = prompt or EXTRACTION_PROMPT
        
        # Build the message with BOTH text and image in a SINGLE content array
        messages = [
            {
                "role": "system",
                "content": "You are an expert at reading IRS Form 1040 tax documents with extreme precision. You read every digit exactly as printed, one by one. You NEVER guess or infer numbers - only report what is clearly visible. You always respond with valid JSON only, no explanations."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": use_prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}",
                            "detail": "high"
                        }
                    }
                ]
            }
        ]
        
        # Use Emergent proxy for the API call
        proxy_url = os.getenv("INTEGRATION_PROXY_URL", "https://integrations.emergentagent.com")
        print(f"📡 Calling LLM at {proxy_url}/llm with model gpt-4o...")
        
        response = litellm.completion(
            model="gpt-4o",
            messages=messages,
            api_key=EMERGENT_LLM_KEY,
            api_base=proxy_url + "/llm",
            custom_llm_provider="openai",
            max_tokens=1000,
            temperature=0.0  # Zero temperature for maximum consistency
        )
        
        print(f"✅ LLM response received")
        
        # Extract response text
        response_text = response.choices[0].message.content
        print(f"📝 Raw response: {response_text[:200]}")
        
        # Parse JSON response
        try:
            clean_response = response_text.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3].strip()
            
            data = json.loads(clean_response)
            return data
        except json.JSONDecodeError as je:
            return {
                "error": f"Error parseando respuesta JSON: {str(je)}",
                "raw_response": response_text,
                "confianza": 0.0
            }
            
    except Exception as e:
        print(f"❌ Error in extract_data_from_image: {e}")
        return {
            "error": str(e),
            "confianza": 0.0
        }


async def verify_bank_numbers(image_base64: str, session_id: str, expected_routing: str = "", expected_account: str = "") -> Dict[str, Any]:
    """Second pass: verify bank numbers with a focused prompt"""
    print(f"🔄 Verification pass for bank numbers (session: {session_id})...")
    
    result = await extract_data_from_image(image_base64, f"{session_id}-verify", VERIFICATION_PROMPT)
    
    # Handle new format: routing_by_box + routing_number, account_by_box + account_number
    verified_routing = (result.get("routing_number", "") or "").replace(" ", "").replace("-", "")
    verified_account = (result.get("account_number", "") or "").replace(" ", "").replace("-", "")
    
    # Also try from box-by-box format
    routing_by_box = result.get("routing_by_box", "")
    account_by_box = result.get("account_by_box", "")
    
    if routing_by_box:
        box_routing = routing_by_box.replace(" ", "")
        if box_routing.isdigit() and len(box_routing) == 9:
            # Prefer box reading if it differs from combined
            if box_routing != verified_routing:
                print(f"  📦 Box routing differs: boxes='{box_routing}' vs combined='{verified_routing}' → using boxes")
                verified_routing = box_routing
    
    if account_by_box:
        box_account = account_by_box.replace(" ", "")
        if box_account.isdigit() and len(box_account) >= 4:
            if box_account != verified_account:
                print(f"  📦 Box account differs: boxes='{box_account}' vs combined='{verified_account}' → using boxes")
                verified_account = box_account
    
    print(f"  🔍 Verification result: routing='{verified_routing}', account='{verified_account}'")
    
    if expected_routing and expected_account:
        routing_match = verified_routing == expected_routing
        account_match = verified_account == expected_account
        print(f"  📊 Match: routing={'✅' if routing_match else '❌'} ({expected_routing} vs {verified_routing}), account={'✅' if account_match else '❌'} ({expected_account} vs {verified_account})")
    
    return {
        "routing_number": verified_routing,
        "account_number": verified_account,
        "digit_count_routing": result.get("routing_count", len(verified_routing)),
        "digit_count_account": result.get("account_count", len(verified_account))
    }


async def process_single_pdf(
    pdf_bytes: bytes,
    filename: str,
    batch_id: str
) -> Dict[str, Any]:
    """Process a single PDF using 3-LAYER extraction: AcroForm → pdfplumber → GPT-4o Vision"""
    
    extraction_id = str(uuid.uuid4())
    
    try:
        await pdf_extractions_collection.update_one(
            {"_id": extraction_id},
            {"$set": {"batch_id": batch_id, "filename": filename, "status": "processing", "started_at": datetime.utcnow()}},
            upsert=True
        )
        
        session_id = f"pdf-extract-{extraction_id}"
        extraction_method = "unknown"
        
        best_name = {"nombre": "", "apellido": ""}
        best_routing = ""
        best_account = ""
        
        # ============================================
        # LAYER 1: AcroForm fields (100% accurate for digital form PDFs)
        # ============================================
        print(f"\n{'='*60}")
        print(f"📄 Processing: {filename}")
        print(f"{'='*60}")
        print(f"  🔷 LAYER 1: AcroForm field extraction...")
        acroform_result = await extract_from_acroform(pdf_bytes)
        
        if acroform_result["has_fields"]:
            best_name["nombre"] = acroform_result.get("nombre", "")
            best_name["apellido"] = acroform_result.get("apellido", "")
            best_routing = acroform_result.get("routing_number", "")
            best_account = acroform_result.get("account_number", "")
            extraction_method = "acroform"
            
            if best_routing and best_account:
                print(f"  ✅ LAYER 1 SUCCESS — All data found via AcroForm fields")
            else:
                print(f"  ⚠️ LAYER 1 PARTIAL — Has fields but incomplete data")
        else:
            print(f"  ⏭️ LAYER 1 SKIP — No AcroForm fields found")
        
        # ============================================
        # LAYER 2: pdfplumber structured text extraction
        # ============================================
        if not (best_routing and best_account and best_name["nombre"]):
            print(f"  🔷 LAYER 2: pdfplumber structured extraction...")
            plumber_result = await extract_with_pdfplumber(pdf_bytes)
            
            if plumber_result.get("routing_number") and not best_routing:
                best_routing = plumber_result["routing_number"]
            if plumber_result.get("account_number") and not best_account:
                best_account = plumber_result["account_number"]
            if plumber_result.get("nombre") and not best_name["nombre"]:
                best_name["nombre"] = plumber_result["nombre"]
                best_name["apellido"] = plumber_result.get("apellido", "")
            
            if extraction_method == "unknown":
                extraction_method = "pdfplumber"
            elif best_routing and best_account:
                extraction_method = f"hybrid_acroform_pdfplumber"
            
            if best_routing and best_account:
                print(f"  ✅ LAYER 2 SUCCESS — Data complete")
            else:
                print(f"  ⚠️ LAYER 2 PARTIAL — Still missing data")
        
        # ============================================
        # LAYER 2.5: PyMuPDF text extraction (additional fallback)
        # ============================================
        if not (best_routing and best_account and best_name["nombre"]):
            print(f"  🔷 LAYER 2.5: PyMuPDF text extraction...")
            text_result = await extract_text_from_pdf(pdf_bytes)
            
            if text_result["has_text"]:
                if text_result.get("routing_number") and not best_routing:
                    best_routing = text_result["routing_number"]
                if text_result.get("account_number") and not best_account:
                    best_account = text_result["account_number"]
                if text_result.get("nombre") and not best_name["nombre"]:
                    best_name["nombre"] = text_result["nombre"]
                    best_name["apellido"] = text_result.get("apellido", "")
                
                if best_routing and best_account:
                    extraction_method = f"hybrid_text" if "hybrid" in extraction_method else "text_extraction"
                    print(f"  ✅ LAYER 2.5 SUCCESS — Data complete via text")
                else:
                    # Try GPT text analysis
                    print(f"  ⚠️ LAYER 2.5 PARTIAL — Trying GPT text analysis...")
                    all_text = "\n".join(text_result.get("pages_text", []))
                    if all_text:
                        text_analysis = await analyze_text_with_gpt(all_text, session_id)
                        if text_analysis.get("routing_number") and not best_routing:
                            best_routing = text_analysis["routing_number"]
                        if text_analysis.get("account_number") and not best_account:
                            best_account = text_analysis["account_number"]
                        if text_analysis.get("nombre") and not best_name["nombre"]:
                            best_name["nombre"] = text_analysis.get("nombre", "")
                            best_name["apellido"] = text_analysis.get("apellido", "")
                        extraction_method = "text_gpt_analysis"
        
        # ============================================
        # LAYER 3: GPT-4o Vision (last resort for scanned PDFs)
        # ============================================
        if not (best_routing and best_account and best_name["nombre"]):
            print(f"  🔷 LAYER 3: GPT-4o Vision OCR...")
            extraction_method = "gpt4o_vision" if extraction_method == "unknown" else f"hybrid_{extraction_method}_vision"
            
            images = await convert_pdf_to_images(pdf_bytes, max_pages=20)
            print(f"  📷 {len(images)} pages converted to images")
            
            if images:
                for i in range(len(images)):
                    img = images[i]
                    page_data = await extract_data_from_image(img, f"{session_id}-p{i}")
                    
                    found_routing = (page_data.get("routing_digits", "") or page_data.get("routing_number", ""))
                    found_account = (page_data.get("account_digits", "") or page_data.get("account_number", ""))
                    found_nombre = page_data.get("nombre", "")
                    
                    if not best_name["nombre"] and found_nombre and found_nombre not in ["", "NO_ENCONTRADO", "null", "N/A"]:
                        best_name["nombre"] = found_nombre
                        best_name["apellido"] = page_data.get("apellido", "")
                    
                    if not best_routing and found_routing and found_routing not in ["", "NO_ENCONTRADO", "null", "N/A"]:
                        clean_routing = found_routing.replace(" ", "").replace("-", "")
                        if clean_routing.isdigit() and len(clean_routing) == 9:
                            best_routing = clean_routing
                    
                    if not best_account and found_account and found_account not in ["", "NO_ENCONTRADO", "null", "N/A"]:
                        clean_account = found_account.replace(" ", "").replace("-", "")
                        if clean_account.isdigit() and len(clean_account) >= 4:
                            best_account = clean_account
                    
                    if best_routing and best_account and best_name["nombre"]:
                        print(f"  ✅ LAYER 3 SUCCESS at page {i+1}")
                        break
        
        # ============================================
        # FINAL VALIDATION AND RESULTS
        # ============================================
        print(f"\n  📊 Method: {extraction_method}")
        print(f"  📊 Final: name='{best_name['nombre']} {best_name['apellido']}', routing='{best_routing}', account='{best_account}'")
        
        extracted_data = {
            "nombre": best_name["nombre"],
            "apellido": best_name["apellido"],
            "routing_number": best_routing,
            "account_number": best_account,
            "extraction_method": extraction_method,
            "confianza": 0.99 if "acroform" in extraction_method else (0.95 if "pdfplumber" in extraction_method else (0.90 if "text" in extraction_method else 0.75))
        }
        
        validation_errors = []
        
        routing = extracted_data.get("routing_number", "")
        routing_validation = validate_routing_number(routing)
        if not routing_validation["valid"]:
            validation_errors.append(f"Routing: {routing_validation['error']}")
            extracted_data["routing_valid"] = False
        else:
            extracted_data["routing_valid"] = True
            extracted_data["routing_number"] = routing_validation["routing"]
        
        account = extracted_data.get("account_number", "")
        account_validation = validate_account_number(account)
        if not account_validation["valid"]:
            validation_errors.append(f"Account: {account_validation['error']}")
            extracted_data["account_valid"] = False
        else:
            extracted_data["account_valid"] = True
            extracted_data["account_number"] = account_validation["account"]
        
        needs_review = "acroform" not in extraction_method and "pdfplumber" not in extraction_method
        
        confidence = extracted_data.get("confianza", 0.5)
        if validation_errors:
            confidence = min(confidence, 0.6)
        if extracted_data.get("routing_valid") and extracted_data.get("account_valid"):
            confidence = max(confidence, 0.90)
        if "acroform" in extraction_method and extracted_data.get("routing_valid") and extracted_data.get("account_valid"):
            confidence = 0.99
        
        has_any_data = bool(extracted_data.get("nombre") or extracted_data.get("routing_number") or extracted_data.get("account_number"))
        has_complete_data = bool(extracted_data.get("routing_number") and extracted_data.get("account_number"))
        
        final_status = "error" if not has_any_data else "completed"
        if not has_any_data:
            confidence = 0.0
        elif not has_complete_data:
            confidence = min(confidence, 0.5)
        
        result = {
            "_id": extraction_id,
            "batch_id": batch_id,
            "filename": filename,
            "status": final_status,
            "extracted_data": {
                "nombre_completo": f"{extracted_data.get('nombre', '')} {extracted_data.get('apellido', '')}".strip(),
                "nombre": extracted_data.get("nombre", ""),
                "apellido": extracted_data.get("apellido", ""),
                "routing_number": extracted_data.get("routing_number", ""),
                "account_number": extracted_data.get("account_number", ""),
                "routing_valid": extracted_data.get("routing_valid", False),
                "account_valid": extracted_data.get("account_valid", False),
                "needs_review": needs_review,
                "validation_errors": validation_errors,
                "extraction_method": extraction_method,
            },
            "confianza": confidence,
            "notas": "; ".join(validation_errors) if validation_errors else "Validación exitosa",
            "error": extracted_data.get("error") or ("; ".join(validation_errors) if not has_any_data else None),
            "extraction_method": extraction_method,
            "completed_at": datetime.utcnow()
        }
        
        print(f"  🏁 FINAL [{filename}]: status={final_status}, method={extraction_method}, "
              f"routing={'✅' if extracted_data.get('routing_valid') else '❌'}, "
              f"account={'✅' if extracted_data.get('account_valid') else '❌'}, confidence={confidence:.0%}")
        print(f"{'='*60}\n")
        
        await pdf_extractions_collection.update_one(
            {"_id": extraction_id},
            {"$set": result},
            upsert=True
        )
        
        return result
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ CRITICAL ERROR processing {filename}: {str(e)}")
        print(f"❌ Traceback: {error_trace}")
        
        error_result = {
            "_id": extraction_id,
            "batch_id": batch_id,
            "filename": filename,
            "status": "error",
            "error": str(e),
            "error_trace": error_trace,
            "confianza": 0.0,
            "completed_at": datetime.utcnow()
        }
        
        await pdf_extractions_collection.update_one(
            {"_id": extraction_id},
            {"$set": error_result},
            upsert=True
        )
        
        return error_result


async def create_batch(user_id: str, batch_name: Optional[str] = None) -> str:
    """Create a new PDF processing batch"""
    batch_id = str(uuid.uuid4())
    
    await pdf_batches_collection.insert_one({
        "_id": batch_id,
        "name": batch_name or f"Lote {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "user_id": user_id,
        "status": "created",
        "total_files": 0,
        "processed_files": 0,
        "successful_files": 0,
        "failed_files": 0,
        "created_at": datetime.utcnow()
    })
    
    return batch_id


async def delete_batch(batch_id: str) -> Dict[str, Any]:
    """Delete a batch and all its extractions"""
    # First check if batch exists
    batch = await pdf_batches_collection.find_one({"_id": batch_id})
    
    if not batch:
        return {"success": False, "error": "Lote no encontrado"}
    
    # Delete all extractions for this batch
    extractions_result = await pdf_extractions_collection.delete_many({"batch_id": batch_id})
    
    # Delete the batch itself
    batch_result = await pdf_batches_collection.delete_one({"_id": batch_id})
    
    return {
        "success": True,
        "message": f"Lote eliminado correctamente",
        "deleted_extractions": extractions_result.deleted_count,
        "batch_deleted": batch_result.deleted_count > 0
    }


async def get_batch_status(batch_id: str) -> Dict[str, Any]:
    """Get batch processing status"""
    batch = await pdf_batches_collection.find_one({"_id": batch_id})
    
    if not batch:
        return None
    
    # Get extraction stats
    pipeline = [
        {"$match": {"batch_id": batch_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1}
        }}
    ]
    
    stats = {}
    async for doc in pdf_extractions_collection.aggregate(pipeline):
        stats[doc["_id"]] = doc["count"]
    
    batch["stats"] = stats
    batch["id"] = batch["_id"]
    
    return batch


async def get_batch_results(batch_id: str, include_low_confidence: bool = True) -> List[Dict]:
    """Get all extraction results for a batch"""
    
    query = {"batch_id": batch_id}
    
    if not include_low_confidence:
        query["confianza"] = {"$gte": 0.7}
    
    results = []
    async for doc in pdf_extractions_collection.find(query).sort("filename", 1):
        doc["id"] = doc["_id"]
        results.append(doc)
    
    return results


async def save_contact_list(
    user_id: str,
    contacts: List[Dict[str, str]],
    list_name: Optional[str] = None
) -> str:
    """Save a contact list for merging with PDF extractions"""
    
    list_id = str(uuid.uuid4())
    
    # Normalize contacts
    normalized_contacts = []
    for contact in contacts:
        normalized = {
            "nombre_completo": contact.get("nombre_completo", "").strip(),
            "nombre": contact.get("nombre", "").strip(),
            "apellido": contact.get("apellido", "").strip(),
            "direccion": contact.get("direccion", "").strip(),
            "email": contact.get("email", "").strip().lower(),
            "telefono": contact.get("telefono", "").strip().replace("-", "").replace(" ", ""),
        }
        
        # Build nombre_completo if not provided
        if not normalized["nombre_completo"]:
            normalized["nombre_completo"] = f"{normalized['nombre']} {normalized['apellido']}".strip()
        
        normalized_contacts.append(normalized)
    
    await contact_lists_collection.insert_one({
        "_id": list_id,
        "name": list_name or f"Lista {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "user_id": user_id,
        "contacts": normalized_contacts,
        "total_contacts": len(normalized_contacts),
        "created_at": datetime.utcnow()
    })
    
    return list_id


async def merge_pdf_and_contacts(
    batch_id: str,
    contact_list_id: str,
    user_id: str
) -> Dict[str, Any]:
    """Merge PDF extractions with contact list to create complete ACH records"""
    
    # Get PDF extractions
    extractions = await get_batch_results(batch_id)
    
    # Get contact list
    contact_list = await contact_lists_collection.find_one({"_id": contact_list_id})
    
    if not contact_list:
        raise Exception("Lista de contactos no encontrada")
    
    contacts = contact_list.get("contacts", [])
    
    # Create lookup by name (case insensitive)
    contact_lookup = {}
    for contact in contacts:
        # Create multiple keys for matching
        name_key = contact.get("nombre_completo", "").lower().strip()
        if name_key:
            contact_lookup[name_key] = contact
        
        # Also create key with apellido, nombre format
        if contact.get("apellido") and contact.get("nombre"):
            alt_key = f"{contact['apellido']} {contact['nombre']}".lower().strip()
            contact_lookup[alt_key] = contact
    
    # Merge records
    merged_records = []
    unmatched_pdfs = []
    unmatched_contacts = list(contacts)
    
    for extraction in extractions:
        if extraction.get("status") != "completed":
            continue
        
        extracted = extraction.get("extracted_data", {})
        name = extracted.get("nombre_completo", "").lower().strip()
        
        # Try to find matching contact
        matched_contact = contact_lookup.get(name)
        
        # Try alternate matching (apellido first)
        if not matched_contact:
            alt_name = f"{extracted.get('apellido', '')} {extracted.get('nombre', '')}".lower().strip()
            matched_contact = contact_lookup.get(alt_name)
        
        # Try partial matching by apellido
        if not matched_contact:
            apellido = extracted.get("apellido", "").lower()
            for key, contact in contact_lookup.items():
                if apellido and apellido in key:
                    matched_contact = contact
                    break
        
        merged_record = {
            "_id": str(uuid.uuid4()),
            "batch_id": batch_id,
            "contact_list_id": contact_list_id,
            "user_id": user_id,
            
            # From PDF
            "nombre": extracted.get("nombre", ""),
            "apellido": extracted.get("apellido", ""),
            "nombre_completo": extracted.get("nombre_completo", ""),
            "direccion_pdf": extracted.get("direccion", ""),
            "ciudad": extracted.get("ciudad", ""),
            "estado": extracted.get("estado", ""),
            "codigo_postal": extracted.get("codigo_postal", ""),
            "routing_number": extracted.get("routing_number", ""),
            "account_number": extracted.get("account_number", ""),
            "monto_reembolso": extracted.get("monto_reembolso", ""),
            
            # From contact list
            "email": matched_contact.get("email", "") if matched_contact else "",
            "telefono": matched_contact.get("telefono", "") if matched_contact else "",
            "direccion_contacto": matched_contact.get("direccion", "") if matched_contact else "",
            
            # Metadata
            "matched": bool(matched_contact),
            "confianza_pdf": extraction.get("confianza", 0),
            "archivo_origen": extraction.get("filename", ""),
            "created_at": datetime.utcnow()
        }
        
        # Use contact list address if PDF address is empty
        if not merged_record["direccion_pdf"] and matched_contact:
            merged_record["direccion_pdf"] = matched_contact.get("direccion", "")
        
        merged_records.append(merged_record)
        
        # Remove matched contact from unmatched list
        if matched_contact and matched_contact in unmatched_contacts:
            unmatched_contacts.remove(matched_contact)
        
        if not matched_contact:
            unmatched_pdfs.append(extraction.get("filename", ""))
    
    # Save merged records
    if merged_records:
        await merged_records_collection.insert_many(merged_records)
    
    return {
        "success": True,
        "total_merged": len(merged_records),
        "matched_records": len([r for r in merged_records if r["matched"]]),
        "unmatched_pdfs": len(unmatched_pdfs),
        "unmatched_contacts": len(unmatched_contacts),
        "unmatched_pdf_files": unmatched_pdfs[:10],  # First 10
        "merge_id": f"{batch_id}_{contact_list_id}"
    }


async def get_merged_records(
    batch_id: str,
    contact_list_id: str,
    only_matched: bool = False
) -> List[Dict]:
    """Get merged records ready for ACH export"""
    
    query = {
        "batch_id": batch_id,
        "contact_list_id": contact_list_id
    }
    
    if only_matched:
        query["matched"] = True
    
    records = []
    async for doc in merged_records_collection.find(query).sort("nombre_completo", 1):
        doc["id"] = doc["_id"]
        records.append(doc)
    
    return records


async def export_to_ach_format(
    batch_id: str,
    contact_list_id: str
) -> List[Dict]:
    """Export merged records in ACH Customer Vault format"""
    
    records = await get_merged_records(batch_id, contact_list_id, only_matched=False)
    
    ach_records = []
    for record in records:
        # Only include records with bank info
        if not record.get("routing_number") or record.get("routing_number") == "NO_ENCONTRADO":
            continue
        
        ach_record = {
            "firstName": record.get("nombre", ""),
            "lastName": record.get("apellido", ""),
            "email": record.get("email", ""),
            "phone": record.get("telefono", ""),
            "address1": record.get("direccion_pdf", "") or record.get("direccion_contacto", ""),
            "city": record.get("ciudad", ""),
            "state": record.get("estado", ""),
            "postalCode": record.get("codigo_postal", ""),
            "country": "US",
            "checkName": record.get("nombre_completo", ""),
            "routing": record.get("routing_number", ""),
            "accountNumber": record.get("account_number", ""),
            "accountType": "checking",
            "accountHolderType": "personal",
            "planAmount": record.get("monto_reembolso", ""),
            "archivo_origen": record.get("archivo_origen", ""),
            "confianza": record.get("confianza_pdf", 0)
        }
        
        ach_records.append(ach_record)
    
    return ach_records
