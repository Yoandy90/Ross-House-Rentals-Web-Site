"""
Receipt Classifier Service - AI-powered receipt analysis
Uses GPT-4o Vision to extract: amount, date, vendor, category, description
Works with both emergentintegrations (Emergent env) and standard OpenAI SDK (Railway/production)
"""
import os
import json
import re
import logging
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# ═══ Expense Categories for tax deduction classification ═══
EXPENSE_CATEGORIES = {
    'fuel': {'name_es': 'Combustible', 'name_en': 'Fuel', 'icon': '⛽'},
    'auto_repair': {'name_es': 'Mecánico/Auto', 'name_en': 'Auto Repair', 'icon': '🔧'},
    'medical': {'name_es': 'Médico', 'name_en': 'Medical', 'icon': '🏥'},
    'home_office': {'name_es': 'Oficina en Casa', 'name_en': 'Home Office', 'icon': '🏠'},
    'phone_communication': {'name_es': 'Teléfono', 'name_en': 'Phone', 'icon': '📱'},
    'business_meals': {'name_es': 'Comidas de Negocio', 'name_en': 'Business Meals', 'icon': '🍽️'},
    'travel': {'name_es': 'Viajes', 'name_en': 'Travel', 'icon': '✈️'},
    'education': {'name_es': 'Educación', 'name_en': 'Education', 'icon': '📚'},
    'rent': {'name_es': 'Renta/Alquiler', 'name_en': 'Rent', 'icon': '🏢'},
    'utilities': {'name_es': 'Servicios', 'name_en': 'Utilities', 'icon': '💡'},
    'supplies': {'name_es': 'Suministros', 'name_en': 'Supplies', 'icon': '📦'},
    'other': {'name_es': 'Otros', 'name_en': 'Other', 'icon': '📋'},
}

# DB reference for fetching OpenAI key
_db = None

def set_classifier_db(db):
    global _db
    _db = db

SYSTEM_PROMPT = """Eres un asistente experto en análisis de recibos y facturas para propósitos fiscales.
Tu tarea es extraer información de recibos/facturas y clasificarlos en categorías de gastos deducibles.

IMPORTANTE:
- Extrae el MONTO TOTAL del recibo (el total a pagar, no subtotales)
- Extrae la FECHA del recibo
- Identifica el VENDEDOR o nombre del negocio
- Clasifica el gasto en UNA de estas categorías EXACTAS:
  * fuel - Combustible (gasolina, diésel)
  * auto_repair - Mecánico/Auto (reparaciones, mantenimiento)
  * medical - Médico (facturas médicas, medicamentos)
  * home_office - Oficina en Casa (suministros, internet)
  * phone_communication - Teléfono/Comunicación
  * business_meals - Comidas de Negocio
  * travel - Viajes (transporte, hospedaje)
  * education - Educación (cursos, materiales)
  * rent - Renta/Alquiler
  * utilities - Servicios Públicos (luz, agua, gas)
  * supplies - Suministros
  * other - Otros (si no encaja en ninguna)

Responde SOLO en formato JSON válido, sin explicaciones adicionales."""

USER_PROMPT = """Analiza este recibo/factura y extrae la información en formato JSON:
{
    "amount": <número decimal del monto total, sin símbolo de moneda>,
    "currency": "USD" o "MXN" según lo que veas,
    "date": "YYYY-MM-DD" o null si no es legible,
    "vendor": "<nombre del negocio/tienda>",
    "category": "<una de las categorías válidas>",
    "description": "<breve descripción del gasto>",
    "confidence": <0.0 a 1.0 qué tan seguro estás de la clasificación>
}

Si no puedes leer algún campo, usa null. Si la imagen no es un recibo, indica category: "invalid"."""


class ReceiptClassifierService:
    """Service for AI-powered receipt classification"""

    def __init__(self):
        self._openai_key = None
        self._emergent_key = os.getenv('EMERGENT_LLM_KEY')
        logger.info("✅ Receipt Classifier Service initialized")

    async def _get_openai_key(self) -> Optional[str]:
        """Get OpenAI API key from database config or environment"""
        # First check env
        env_key = os.getenv('OPENAI_API_KEY', '')
        if env_key and len(env_key) > 10:
            return env_key

        # Then check database config (unified config manager / system_settings)
        db_ref = _db
        
        # If _db is not set, try to connect directly
        if db_ref is None:
            try:
                import motor.motor_asyncio
                mongo_url = os.getenv('MONGO_URL', '')
                if mongo_url:
                    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
                    db_name = os.getenv('DB_NAME', 'taxportal')
                    db_ref = client[db_name]
                    logger.info(f"📌 Receipt classifier connected directly to MongoDB ({db_name})")
            except Exception as e:
                logger.error(f"Could not connect to MongoDB directly: {e}")
        
        if db_ref is not None:
            try:
                # Check system_settings (unified config manager format)
                sys_doc = await db_ref.system_settings.find_one({'_id': 'main'})
                if sys_doc and sys_doc.get('settings'):
                    db_key = sys_doc['settings'].get('openai_api_key', '')
                    if db_key and len(db_key) > 10:
                        logger.info("✅ Found OpenAI key in system_settings")
                        return db_key

                # Fallback: check legacy admin_config collection
                config = await db_ref.admin_config.find_one({})
                if config:
                    db_key = config.get('OPENAI_API_KEY', '') or config.get('openai_api_key', '')
                    if db_key and len(db_key) > 10:
                        logger.info("✅ Found OpenAI key in admin_config")
                        return db_key
            except Exception as e:
                logger.error(f"Error fetching API config: {e}")

        logger.warning("⚠️ No OpenAI key found in env or database")
        return None

    async def classify_receipt(self, image_base64: str, filename: str = "") -> Dict[str, Any]:
        """Analyze a receipt image using GPT-4o Vision"""

        # Method 1: Try standard OpenAI SDK (works on Railway/production)
        openai_key = await self._get_openai_key()
        if openai_key:
            result = await self._classify_with_openai(image_base64, openai_key)
            if result and result.get('success'):
                return result

        # Method 2: Try emergentintegrations (works in Emergent environment)
        if self._emergent_key:
            result = await self._classify_with_emergent(image_base64)
            if result and result.get('success'):
                return result

        return {
            "success": False,
            "error": "No AI service available. Configure OpenAI API key in admin settings."
        }

    async def _classify_with_openai(self, image_base64: str, api_key: str) -> Optional[Dict]:
        """Classify using standard OpenAI SDK"""
        try:
            import httpx

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }

            payload = {
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": USER_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 500,
                "temperature": 0.1,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

            if response.status_code != 200:
                logger.error(f"OpenAI API error {response.status_code}: {response.text[:300]}")
                return None

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            logger.info(f"📄 OpenAI Receipt Response: {content[:300]}...")

            return self._parse_ai_response(content)

        except Exception as e:
            logger.error(f"OpenAI classify error: {e}")
            return None

    async def _classify_with_emergent(self, image_base64: str) -> Optional[Dict]:
        """Classify using emergentintegrations (Emergent environment only)"""
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

            chat = LlmChat(
                api_key=self._emergent_key,
                session_id=f"receipt-{datetime.now().timestamp()}",
                system_message=SYSTEM_PROMPT
            ).with_model("openai", "gpt-4o")

            image_content = ImageContent(image_base64=image_base64)
            user_message = UserMessage(
                text=USER_PROMPT,
                image_contents=[image_content]
            )

            response = await chat.send_message(user_message)
            logger.info(f"📄 Emergent Receipt Response: {response[:300]}...")

            return self._parse_ai_response(response)

        except ImportError:
            logger.warning("emergentintegrations not available")
            return None
        except Exception as e:
            logger.error(f"Emergent classify error: {e}")
            return None

    def _parse_ai_response(self, response: str) -> Optional[Dict]:
        """Parse AI response JSON and validate"""
        try:
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                result = json.loads(json_match.group())

                # Validate category
                if result.get('category') not in EXPENSE_CATEGORIES:
                    result['category'] = 'other'

                # Add category metadata
                category_info = EXPENSE_CATEGORIES.get(result['category'], EXPENSE_CATEGORIES['other'])
                result['category_name_es'] = category_info['name_es']
                result['category_name_en'] = category_info['name_en']
                result['category_icon'] = category_info['icon']

                return {
                    "success": True,
                    "data": result,
                }
            else:
                logger.error(f"Could not parse AI response: {response[:200]}")
                return None

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e} - Response: {response[:200]}")
            return None


# ═══ Singleton ═══
_classifier_instance = None

def get_receipt_classifier() -> ReceiptClassifierService:
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = ReceiptClassifierService()
    return _classifier_instance
