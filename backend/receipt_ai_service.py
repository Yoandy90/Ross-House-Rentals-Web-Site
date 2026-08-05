"""
Receipt AI Classification Service
Uses Google Gemini Vision to analyze receipt images and extract structured data
"""

import os
import json
import logging
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ReceiptAIService:
    """Service for AI-powered receipt analysis and classification"""
    
    CATEGORIES = [
        'Gastos Médicos',
        'Comida/Restaurantes', 
        'Transporte',
        'Oficina/Suministros',
        'Utilidades',
        'Vivienda',
        'Educación',
        'Donaciones',
        'Gastos de Negocio',
        'Otros'
    ]
    
    def __init__(self):
        self.api_key = os.getenv('EMERGENT_LLM_KEY')
        self._db = None
        if not self.api_key:
            logger.warning("⚠️ EMERGENT_LLM_KEY not found - will try OpenAI from DB")
        else:
            logger.info("✅ Receipt AI Service initialized with Emergent LLM key")
    
    def set_db(self, database):
        """Set the database reference for fetching API keys from DB"""
        self._db = database
    
    async def _get_openai_key(self) -> Optional[str]:
        """Get OpenAI API key from env or database config"""
        env_key = os.getenv('OPENAI_API_KEY', '')
        if env_key and len(env_key) > 10:
            return env_key
        
        db_ref = self._db
        
        # If _db not set, connect directly
        if db_ref is None:
            try:
                import motor.motor_asyncio
                mongo_url = os.getenv('MONGO_URL', '')
                if mongo_url:
                    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
                    db_name = os.getenv('DB_NAME', 'taxportal')
                    db_ref = client[db_name]
                    logger.info(f"📌 Receipt AI service connected directly to MongoDB ({db_name})")
            except Exception as e:
                logger.error(f"Could not connect to MongoDB: {e}")
        
        if db_ref is not None:
            try:
                # Check system_settings (unified config manager)
                sys_doc = await db_ref.system_settings.find_one({'_id': 'main'})
                if sys_doc and sys_doc.get('settings'):
                    db_key = sys_doc['settings'].get('openai_api_key', '')
                    if db_key and len(db_key) > 10:
                        return db_key
                # Fallback: admin_config (legacy)
                config = await db_ref.admin_config.find_one({})
                if config:
                    db_key = config.get('OPENAI_API_KEY', '') or config.get('openai_api_key', '')
                    if db_key and len(db_key) > 10:
                        return db_key
            except Exception as e:
                logger.error(f"Error reading API config: {e}")
        return None
    
    async def check_image_quality(self, image_base64: str) -> Dict[str, Any]:
        """
        Analyze the quality of a receipt image before processing
        
        Returns:
            Dict with quality assessment:
            - quality_score: 0-100 (overall quality)
            - is_acceptable: bool (can be processed)
            - issues: list of detected issues
            - suggestions: list of improvement suggestions
        """
        if not self.api_key:
            return {
                'success': True,
                'quality_score': 100,
                'is_acceptable': True,
                'issues': [],
                'suggestions': [],
                'message': 'Validación de calidad no disponible'
            }
        
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
            
            session_id = f"quality-check-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
            
            system_prompt = """Eres un experto en análisis de calidad de imágenes de recibos y facturas.
Tu tarea es evaluar si una foto de un recibo tiene la calidad suficiente para ser procesada correctamente.

CRITERIOS DE EVALUACIÓN (cada uno vale 20 puntos, total 100):
1. CLARIDAD: ¿La imagen está nítida o borrosa?
2. ILUMINACIÓN: ¿Hay suficiente luz? ¿No está sobreexpuesta ni oscura?
3. LEGIBILIDAD: ¿Se puede leer el texto, números y detalles del recibo?
4. COMPLETITUD: ¿El recibo está completo en la imagen o está cortado?
5. ORIENTACIÓN: ¿La imagen está derecha o muy inclinada/rotada?

RESPONDE ÚNICAMENTE con un JSON válido en este formato:
{
  "quality_score": 85,
  "is_receipt": true,
  "clarity": {"score": 18, "issue": null},
  "lighting": {"score": 20, "issue": null},
  "legibility": {"score": 17, "issue": "Algunos textos pequeños difíciles de leer"},
  "completeness": {"score": 15, "issue": "Esquina inferior ligeramente cortada"},
  "orientation": {"score": 15, "issue": "Imagen ligeramente inclinada"},
  "is_acceptable": true,
  "issues": ["Algunos textos pequeños difíciles de leer", "Esquina inferior ligeramente cortada"],
  "suggestions": ["Acerca más la cámara para capturar mejor los detalles", "Asegúrate de que todo el recibo esté visible"]
}

REGLAS:
- quality_score es la suma de los 5 criterios (máx 100)
- is_acceptable = true si quality_score >= 50
- is_receipt = false si la imagen NO es un recibo/factura
- issues: lista de problemas detectados (vacía si no hay)
- suggestions: consejos para mejorar la foto (vacía si calidad >= 80)

Si la imagen NO es un recibo, responde:
{
  "quality_score": 0,
  "is_receipt": false,
  "is_acceptable": false,
  "issues": ["La imagen no parece ser un recibo o factura"],
  "suggestions": ["Por favor toma una foto de un recibo o factura"]
}"""
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=system_prompt
            ).with_model("gemini", "gemini-2.5-flash")
            
            # Create file content for the image
            from emergentintegrations.llm.chat import FileContent
            image_content = FileContent(
                content_type="image/jpeg",
                file_content_base64=image_base64
            )
            
            user_message = UserMessage(
                text="Evalúa la calidad de esta imagen de recibo y responde con el JSON de evaluación.",
                file_contents=[image_content]
            )
            
            logger.info(f"🔍 Checking image quality...")
            
            response = await chat.send_message(user_message)
            
            logger.info(f"📊 Quality check response: {response[:200]}...")
            
            # Parse response
            result = self._parse_quality_response(response)
            result['success'] = True
            
            logger.info(f"✅ Quality score: {result.get('quality_score', 0)} - Acceptable: {result.get('is_acceptable', False)}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error checking image quality: {str(e)}")
            # En caso de error, permitir continuar
            return {
                'success': True,
                'quality_score': 70,
                'is_acceptable': True,
                'issues': [],
                'suggestions': [],
                'message': 'No se pudo verificar la calidad, pero puedes continuar'
            }
    
    def _parse_quality_response(self, response: str) -> Dict[str, Any]:
        """Parse the quality check AI response"""
        try:
            response = response.strip()
            
            # Extract JSON from response
            if '```' in response:
                start = response.find('```')
                end = response.rfind('```')
                if start != end:
                    json_str = response[start+3:end]
                    if json_str.startswith('json'):
                        json_str = json_str[4:]
                    response = json_str.strip()
            
            start_idx = response.find('{')
            end_idx = response.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = response[start_idx:end_idx + 1]
                data = json.loads(json_str)
                
                return {
                    'quality_score': data.get('quality_score', 50),
                    'is_receipt': data.get('is_receipt', True),
                    'is_acceptable': data.get('is_acceptable', True),
                    'issues': data.get('issues', []),
                    'suggestions': data.get('suggestions', []),
                    'details': {
                        'clarity': data.get('clarity', {}),
                        'lighting': data.get('lighting', {}),
                        'legibility': data.get('legibility', {}),
                        'completeness': data.get('completeness', {}),
                        'orientation': data.get('orientation', {})
                    }
                }
            else:
                raise ValueError("No JSON found")
                
        except Exception as e:
            logger.warning(f"Failed to parse quality response: {e}")
            return {
                'quality_score': 70,
                'is_receipt': True,
                'is_acceptable': True,
                'issues': [],
                'suggestions': []
            }
    
    async def classify_receipt(self, image_base64: str) -> Dict[str, Any]:
        """
        Analyze a receipt image and extract structured data
        
        Args:
            image_base64: Base64 encoded image of the receipt
            
        Returns:
            Dict with: category, merchant, amount, receipt_date, confidence, raw_response
        """
        # Try Emergent LLM first, then fall back to OpenAI
        if self.api_key:
            return await self._classify_with_emergent(image_base64)
        
        # Try OpenAI fallback
        openai_key = await self._get_openai_key()
        if openai_key:
            return await self._classify_with_openai(image_base64, openai_key)
        
        logger.warning("AI classification skipped - no API key (Emergent or OpenAI)")
        return {
            'success': False,
            'error': 'No AI service available. Configure OpenAI API key in admin settings.',
            'category': None,
            'merchant': None,
            'amount': None,
            'receipt_date': None,
            'confidence': 0
        }
    
    async def _classify_with_openai(self, image_base64: str, api_key: str) -> Dict[str, Any]:
        """Classify receipt using OpenAI GPT-4o Vision via httpx"""
        try:
            import httpx
            
            system_prompt = self._get_system_prompt()
            
            # Ensure proper base64 data URI
            if not image_base64.startswith('data:'):
                image_url = f"data:image/jpeg;base64,{image_base64}"
            else:
                image_url = image_base64
            
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analiza este recibo y extrae la información en formato JSON."},
                            {"type": "image_url", "image_url": {"url": image_url, "detail": "high"}}
                        ]
                    }
                ],
                "max_tokens": 1000,
                "temperature": 0.1,
            }
            
            logger.info("🔍 Analyzing business receipt with OpenAI GPT-4o Vision...")
            
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                
                if resp.status_code != 200:
                    logger.error(f"OpenAI error {resp.status_code}: {resp.text[:300]}")
                    return {
                        'success': False,
                        'error': f'OpenAI API error: {resp.status_code}',
                        'category': None, 'merchant': None, 'amount': None,
                        'receipt_date': None, 'confidence': 0
                    }
                
                data = resp.json()
                response_text = data['choices'][0]['message']['content']
                
                logger.info(f"📄 OpenAI response: {response_text[:200]}...")
                
                result = self._parse_ai_response(response_text)
                result['raw_response'] = response_text
                result['success'] = True
                result['ai_provider'] = 'openai'
                
                logger.info(f"✅ Business receipt classified (OpenAI): {result.get('category')} - ${result.get('amount')} - {result.get('merchant')}")
                return result
                
        except Exception as e:
            logger.error(f"❌ OpenAI receipt classification error: {e}")
            return {
                'success': False, 'error': str(e),
                'category': None, 'merchant': None, 'amount': None,
                'receipt_date': None, 'confidence': 0, 'raw_response': None
            }
    
    def _get_system_prompt(self) -> str:
        """Return the system prompt for receipt classification"""
        return """Eres un experto en análisis de recibos y facturas. Tu tarea es extraer información estructurada de imágenes de recibos.

INSTRUCCIONES:
1. Analiza la imagen del recibo cuidadosamente
2. Extrae la información solicitada
3. Si no puedes identificar algún dato con certeza, usa null
4. El monto debe ser un número decimal (ej: 45.99)
5. La fecha debe estar en formato YYYY-MM-DD
6. La categoría debe ser una de las siguientes opciones EXACTAMENTE:
   - Gastos Médicos
   - Comida/Restaurantes
   - Transporte
   - Oficina/Suministros
   - Utilidades
   - Vivienda
   - Educación
   - Donaciones
   - Gastos de Negocio
   - Otros

RESPONDE ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "category": "Categoría del gasto",
  "merchant": "Nombre del comercio/tienda",
  "amount": 123.45,
  "receipt_date": "2025-01-15",
  "confidence": 0.85,
  "description": "Breve descripción del gasto"
}

Si la imagen no es un recibo válido o no puedes extraer información, responde:
{
  "category": null,
  "merchant": null,
  "amount": null,
  "receipt_date": null,
  "confidence": 0,
  "description": "No se pudo identificar como recibo válido"
}"""
    
    async def _classify_with_emergent(self, image_base64: str) -> Dict[str, Any]:
        """Classify receipt using Emergent LLM (Gemini Vision)"""
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContent
            
            session_id = f"receipt-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
            system_prompt = self._get_system_prompt()
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=system_prompt
            ).with_model("gemini", "gemini-2.5-flash")
            
            image_content = FileContent(
                content_type="image/jpeg",
                file_content_base64=image_base64
            )
            
            user_message = UserMessage(
                text="Analiza este recibo y extrae la información en formato JSON.",
                file_contents=[image_content]
            )
            
            logger.info(f"🔍 Analyzing receipt with Gemini Vision...")
            response = await chat.send_message(user_message)
            logger.info(f"📄 AI Response received: {response[:200]}...")
            
            result = self._parse_ai_response(response)
            result['raw_response'] = response
            result['success'] = True
            result['ai_provider'] = 'emergent_gemini'
            
            logger.info(f"✅ Receipt classified: {result.get('category')} - ${result.get('amount')} - {result.get('merchant')}")
            return result
            
        except Exception as e:
            logger.error(f"❌ Emergent classification error: {str(e)}")
            # Try OpenAI as fallback
            openai_key = await self._get_openai_key()
            if openai_key:
                logger.info("🔄 Falling back to OpenAI for receipt classification")
                return await self._classify_with_openai(image_base64, openai_key)
            return {
                'success': False,
                'error': str(e),
                'category': None,
                'merchant': None,
                'amount': None,
                'receipt_date': None,
                'confidence': 0,
                'raw_response': None
            }
    
    def _parse_ai_response(self, response: str) -> Dict[str, Any]:
        """Parse the AI response to extract JSON data"""
        try:
            # Try to find JSON in the response
            # Sometimes the model adds extra text around the JSON
            response = response.strip()
            
            # If response starts with ``` json or similar, extract the JSON
            if '```' in response:
                # Find content between ``` markers
                start = response.find('```')
                end = response.rfind('```')
                if start != end:
                    json_str = response[start+3:end]
                    # Remove 'json' label if present
                    if json_str.startswith('json'):
                        json_str = json_str[4:]
                    response = json_str.strip()
            
            # Try to find JSON object in the response
            start_idx = response.find('{')
            end_idx = response.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = response[start_idx:end_idx + 1]
                data = json.loads(json_str)
                
                # Validate and normalize the data
                result = {
                    'category': data.get('category'),
                    'merchant': data.get('merchant'),
                    'amount': None,
                    'receipt_date': data.get('receipt_date'),
                    'confidence': data.get('confidence', 0),
                    'description': data.get('description', '')
                }
                
                # Normalize amount
                amount = data.get('amount')
                if amount is not None:
                    try:
                        result['amount'] = float(amount)
                    except (ValueError, TypeError):
                        pass
                
                # Normalize confidence
                try:
                    result['confidence'] = float(result['confidence'])
                    if result['confidence'] > 1:
                        result['confidence'] = result['confidence'] / 100
                except (ValueError, TypeError):
                    result['confidence'] = 0
                
                # Validate category
                if result['category'] and result['category'] not in self.CATEGORIES:
                    # Try to find closest match
                    result['category'] = self._find_closest_category(result['category'])
                
                return result
            else:
                raise ValueError("No JSON found in response")
                
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON: {e}")
            return {
                'category': None,
                'merchant': None,
                'amount': None,
                'receipt_date': None,
                'confidence': 0,
                'description': 'Error parsing AI response'
            }
    
    def _find_closest_category(self, category: str) -> str:
        """Find the closest matching category"""
        category_lower = category.lower()
        
        # Simple keyword matching
        mappings = {
            'médic': 'Gastos Médicos',
            'salud': 'Gastos Médicos',
            'farmacia': 'Gastos Médicos',
            'hospital': 'Gastos Médicos',
            'comida': 'Comida/Restaurantes',
            'restaurant': 'Comida/Restaurantes',
            'food': 'Comida/Restaurantes',
            'cafe': 'Comida/Restaurantes',
            'transport': 'Transporte',
            'gas': 'Transporte',
            'uber': 'Transporte',
            'lyft': 'Transporte',
            'taxi': 'Transporte',
            'oficina': 'Oficina/Suministros',
            'office': 'Oficina/Suministros',
            'papeler': 'Oficina/Suministros',
            'utilidad': 'Utilidades',
            'electric': 'Utilidades',
            'agua': 'Utilidades',
            'internet': 'Utilidades',
            'vivienda': 'Vivienda',
            'renta': 'Vivienda',
            'rent': 'Vivienda',
            'alquiler': 'Vivienda',
            'educación': 'Educación',
            'escuela': 'Educación',
            'libro': 'Educación',
            'curso': 'Educación',
            'donación': 'Donaciones',
            'caridad': 'Donaciones',
            'donation': 'Donaciones',
            'negocio': 'Gastos de Negocio',
            'business': 'Gastos de Negocio',
        }
        
        for keyword, cat in mappings.items():
            if keyword in category_lower:
                return cat
        
        return 'Otros'


# Singleton instance
receipt_ai_service = ReceiptAIService()


async def classify_receipt(image_base64: str) -> Dict[str, Any]:
    """Convenience function to classify a receipt"""
    return await receipt_ai_service.classify_receipt(image_base64)
