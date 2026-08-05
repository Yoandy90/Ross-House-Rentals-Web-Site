"""
W-2 OCR Service using GPT-4 Vision
Extracts structured data from W-2 images
"""
import os
import json
import logging
import base64
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Import emergent integrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    EMERGENT_AVAILABLE = True
except ImportError:
    logger.warning("emergentintegrations not available, OCR will be disabled")
    EMERGENT_AVAILABLE = False


W2_EXTRACTION_PROMPT = """You are a tax document data extractor. Analyze this W-2 form image and extract ALL the following fields.

Return ONLY a valid JSON object with these exact keys (use null for missing values):

{
    "employer_name": "string - Box c: Employer's name",
    "employer_ein": "string - Box b: Employer's EIN (XX-XXXXXXX format)",
    "employer_address": "string - Box c: Employer's full address",
    "employee_ssn": "string - Box a: Employee's SSN (XXX-XX-XXXX format, mask middle digits as XXX-XX-####)",
    "employee_name": "string - Box e: Employee's name",
    "employee_address": "string - Box f: Employee's address",
    "box1_wages": "number - Box 1: Wages, tips, other compensation",
    "box2_federal_withheld": "number - Box 2: Federal income tax withheld",
    "box3_ss_wages": "number - Box 3: Social security wages",
    "box4_ss_withheld": "number - Box 4: Social security tax withheld",
    "box5_medicare_wages": "number - Box 5: Medicare wages and tips",
    "box6_medicare_withheld": "number - Box 6: Medicare tax withheld",
    "box7_ss_tips": "number - Box 7: Social security tips",
    "box8_allocated_tips": "number - Box 8: Allocated tips",
    "box10_dependent_care": "number - Box 10: Dependent care benefits",
    "box11_nonqualified_plans": "number - Box 11: Nonqualified plans",
    "box12_codes": "array - Box 12: Array of {code, amount} objects",
    "box13_statutory": "boolean - Box 13: Statutory employee checkbox",
    "box13_retirement": "boolean - Box 13: Retirement plan checkbox",
    "box13_sick_pay": "boolean - Box 13: Third-party sick pay checkbox",
    "box14_other": "string - Box 14: Other (description and amounts)",
    "box15_state": "string - Box 15: State",
    "box15_state_id": "string - Box 15: Employer's state ID number",
    "box16_state_wages": "number - Box 16: State wages, tips, etc.",
    "box17_state_withheld": "number - Box 17: State income tax",
    "box18_local_wages": "number - Box 18: Local wages, tips, etc.",
    "box19_local_withheld": "number - Box 19: Local income tax",
    "box20_locality": "string - Box 20: Locality name",
    "tax_year": "number - Tax year from the form",
    "confidence_score": "number - Your confidence in the extraction (0-100)",
    "needs_review": "boolean - True if any values are unclear or potentially incorrect",
    "review_notes": "string - Notes about any unclear or potentially incorrect values"
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Use null for any fields you cannot find or read
- For numbers, return the numeric value without $ signs or commas
- Set needs_review to true if the image is blurry or values are hard to read
"""


class W2OcrService:
    """Service for extracting W-2 data using GPT-4 Vision"""
    
    def __init__(self):
        self.api_key = os.getenv('EMERGENT_LLM_KEY')
        if not self.api_key:
            logger.warning("EMERGENT_LLM_KEY not found in environment")
    
    async def extract_w2_data(self, image_base64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
        """
        Extract W-2 data from a base64 encoded image
        
        Args:
            image_base64: Base64 encoded image string
            mime_type: MIME type of the image (image/jpeg, image/png, image/webp)
            
        Returns:
            Dictionary with extracted W-2 data
        """
        if not EMERGENT_AVAILABLE:
            return {
                "success": False,
                "error": "OCR service not available - emergentintegrations not installed"
            }
        
        if not self.api_key:
            return {
                "success": False,
                "error": "API key not configured"
            }
        
        try:
            # Validate mime type
            valid_mimes = ["image/jpeg", "image/png", "image/webp"]
            if mime_type not in valid_mimes:
                return {
                    "success": False,
                    "error": f"Invalid image type. Supported: {valid_mimes}"
                }
            
            # Create chat instance
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"w2-ocr-{os.urandom(8).hex()}",
                system_message="You are a precise tax document data extractor. Extract data exactly as shown on the form."
            ).with_model("openai", "gpt-4o")
            
            # Create image content
            image_content = ImageContent(image_base64=image_base64)
            
            # Create message with image
            user_message = UserMessage(
                text=W2_EXTRACTION_PROMPT,
                file_contents=[image_content]
            )
            
            # Send message and get response
            response = await chat.send_message(user_message)
            
            # Parse JSON response
            try:
                # Clean up response if needed
                response_text = response.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                extracted_data = json.loads(response_text.strip())
                
                return {
                    "success": True,
                    "data": extracted_data,
                    "raw_response": response
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse OCR response as JSON: {e}")
                return {
                    "success": False,
                    "error": "Failed to parse extracted data",
                    "raw_response": response
                }
                
        except Exception as e:
            logger.error(f"W-2 OCR extraction failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def convert_to_income_info(self, w2_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert extracted W-2 data to the format expected by the Tax Wizard
        
        Args:
            w2_data: Extracted W-2 data from OCR
            
        Returns:
            Dictionary formatted for Tax Wizard income input
        """
        return {
            "employer_name": w2_data.get("employer_name") or "",
            "employer_ein": w2_data.get("employer_ein") or "",
            "amount": w2_data.get("box1_wages") or 0,
            "federal_withheld": w2_data.get("box2_federal_withheld") or 0,
            "state_withheld": w2_data.get("box17_state_withheld") or 0,
            "social_security_withheld": w2_data.get("box4_ss_withheld") or 0,
            "medicare_withheld": w2_data.get("box6_medicare_withheld") or 0,
            "state": w2_data.get("box15_state") or "",
            "needs_review": w2_data.get("needs_review", False),
            "confidence_score": w2_data.get("confidence_score", 0),
        }


# Singleton instance
w2_ocr_service = W2OcrService()
