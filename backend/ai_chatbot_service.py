"""
Ross Tax AI Chatbot Service
Uses GPT-4o via Emergent LLM Key to provide intelligent responses
about tax preparation, services, appointments, and more.
"""
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("ai_chatbot_service")

# System prompt for the AI assistant
ROSS_TAX_SYSTEM_PROMPT = """Eres "Ross AI", el asistente virtual inteligente de Ross Tax Preparation LLC. 
Respondes SIEMPRE en español de manera amigable, profesional y concisa.

SOBRE LA EMPRESA:
- Ross Tax Preparation LLC es una empresa de preparación de impuestos ubicada en Estados Unidos
- Ofrecemos servicios para la comunidad hispana
- Horario: Lunes a Viernes 9AM-6PM, Sábados 10AM-2PM (Hora Central)
- Dirección: Consultar con la oficina directamente

SERVICIOS Y PRECIOS:
- Declaración Personal (Tax Return): desde $180
- Declaración de Negocios (Business Return): desde $350
- Solicitud ITIN: $200
- Formación LLC: $350
- Traducciones: $25-50 por página
- Notarizaciones: $15-25 por documento
- Inmigración (consulta): precio según caso

FUNCIONES DE LA APP:
- "Mi Reembolso": Wizard guiado para declarar impuestos 100% DIY o con asistencia
- Escaneo W-2 con cámara (OCR inteligente)
- Calculadora de reembolso IRS 2025
- Agendar citas presenciales o por videollamada
- Subir documentos de forma segura
- Escáner de recibos de gastos para maximizar deducciones
- Ver estado de declaraciones en tiempo real
- Pagar servicios con tarjeta o en persona

DOCUMENTOS NECESARIOS PARA DECLARACIÓN:
- W-2 o 1099 (formularios de ingresos)
- Identificación con foto (ID, pasaporte, matrícula)
- Número de Social Security o ITIN
- Información bancaria (para depósito directo del reembolso)
- Recibos de deducciones (gastos médicos, educación, donaciones)

REGLAS:
1. Sé breve y directo (máximo 3-4 oraciones por respuesta)
2. Si no sabes algo específico del caso del usuario, sugiérele contactar la oficina o agendar una cita
3. Nunca inventes números de reembolso o datos fiscales específicos
4. Si preguntan por el estado de su trámite, diles que pueden verlo en la sección "Mis Declaraciones" de la app
5. Siempre sugiere usar las funciones de la app cuando sea relevante
6. Usa emojis moderadamente para hacer la conversación amigable
7. Si el usuario está frustrado, muestra empatía y ofrece conectar con un agente humano
"""


async def get_ai_response(user_message: str, conversation_history: list = None, user_name: str = ""):
    """
    Get AI-powered response for user message using GPT-4o
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not found")
            return None
        
        # Create a unique session for this conversation
        session_id = f"ross-chat-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Build system message with context
        system_msg = ROSS_TAX_SYSTEM_PROMPT
        if user_name:
            system_msg += f"\n\nEl usuario se llama: {user_name}"
        
        # Add conversation context if available
        if conversation_history and len(conversation_history) > 0:
            recent_messages = conversation_history[-6:]  # Last 6 messages for context
            context = "\n\nCONTEXTO DE LA CONVERSACIÓN RECIENTE:\n"
            for msg in recent_messages:
                role = "Usuario" if msg.get("role") == "client" else "Asistente"
                context += f"{role}: {msg.get('content', '')}\n"
            system_msg += context
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_msg
        )
        
        # Use GPT-4o for fast, accurate responses
        chat.with_model("openai", "gpt-4o")
        
        msg = UserMessage(text=user_message)
        response = await chat.send_message(msg)
        
        logger.info(f"AI chatbot response generated for: {user_message[:50]}...")
        return response
        
    except Exception as e:
        logger.error(f"Error generating AI response: {str(e)}")
        return None
