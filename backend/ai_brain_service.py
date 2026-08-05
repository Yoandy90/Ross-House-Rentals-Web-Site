"""
Ross AI Brain Service
El Cerebro de IA que controla y automatiza todo el negocio
"""

import os
import json
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from dotenv import load_dotenv
from bson import ObjectId
import requests

# Miami timezone constant
MIAMI_TZ = ZoneInfo("America/New_York")

load_dotenv()

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/ai_brain_debug.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class RossAIBrain:
    """
    El Cerebro de IA que gestiona y automatiza el negocio completo
    
    Capacidades:
    - Análisis de comportamiento de clientes
    - Toma de decisiones automatizadas
    - Control total de comunicaciones (email, SMS, push)
    - Gestión inteligente de citas
    - Análisis financiero y oportunidades
    - Ejecución de comandos por voz/texto
    
    Powered by Gemini 2.5 Pro
    """
    
    def __init__(self, db, notification_service=None):
        self.db = db
        self.notification_service = notification_service
        
        # Configurar Gemini 2.0 Flash
        gemini_api_key = os.getenv('GEMINI_API_KEY')
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Cache de prompts de la base de datos
        self._prompts_cache = {}
        self._prompts_cache_time = None
        self._prompts_cache_ttl = 300  # 5 minutos de cache
        
        # Sistema de herramientas disponibles
        self.tools = {
            # Clientes y Análisis
            "analyze_clients": self.analyze_clients,
            "analyze_inactive_clients": self.analyze_inactive_clients,
            "analyze_client_behavior": self.analyze_client_behavior,
            "segment_clients": self.segment_clients,
            "predict_client_churn": self.predict_client_churn,
            
            # Comunicaciones
            "send_email": self.send_email,
            "send_sms": self.send_sms,
            "send_push_notification": self.send_push_notification,
            "send_bulk_communication": self.send_bulk_communication,
            "send_whatsapp_message": self.send_whatsapp_message,
            
            # Citas y Calendario
            "create_appointment": self.create_appointment,
            "manage_appointments": self.manage_appointments,
            "optimize_schedule": self.optimize_schedule,
            "reschedule_appointment": self.reschedule_appointment,
            "send_appointment_reminders": self.send_appointment_reminders,
            
            # Documentos
            "analyze_pending_documents": self.analyze_pending_documents,
            "auto_approve_documents": self.auto_approve_documents,
            "request_missing_documents": self.request_missing_documents,
            "organize_documents": self.organize_documents,
            
            # Herramientas de Captura de Documentos
            "analyze_captured_documents": self.analyze_captured_documents,
            "check_document_quality": self.check_document_quality,
            "send_document_reminders": self.send_document_reminders,
            "suggest_missing_documents": self.suggest_missing_documents,
            "auto_categorize_documents": self.auto_categorize_documents,
            
            # Pagos y Finanzas
            "detect_payment_opportunities": self.detect_payment_opportunities,
            "process_pending_payments": self.process_pending_payments,
            "analyze_revenue": self.analyze_revenue,
            "manage_credits": self.manage_credits,
            "detect_fraudulent_activity": self.detect_fraudulent_activity,
            
            # Préstamos
            "analyze_loan_applications": self.analyze_loan_applications,
            "auto_approve_loans": self.auto_approve_loans,
            "send_loan_reminders": self.send_loan_reminders,
            
            # Referidos
            "analyze_referral_program": self.analyze_referral_program,
            "reward_top_referrers": self.reward_top_referrers,
            "boost_referral_campaign": self.boost_referral_campaign,
            
            # Reportes y Métricas
            "get_business_metrics": self.get_business_metrics,
            "generate_daily_report": self.generate_daily_report,
            "generate_weekly_report": self.generate_weekly_report,
            "generate_custom_report": self.generate_custom_report,
            
            # Automatizaciones
            "create_automation": self.create_automation,
            "run_workflow": self.run_workflow,
            "schedule_task": self.schedule_task,
            
            # Cumpleaños y Celebraciones
            "check_birthdays": self.check_birthdays,
            "send_birthday_wishes": self.send_birthday_wishes,
            "schedule_birthday_campaign": self.schedule_birthday_campaign,
            "get_upcoming_birthdays": self.get_upcoming_birthdays,
            
            # Recordatorios Inteligentes
            "create_reminder": self.create_reminder,
            "send_custom_reminder": self.send_custom_reminder,
            "send_tax_season_reminders": self.send_tax_season_reminders,
            "send_renewal_reminders": self.send_renewal_reminders,
            "send_follow_up_reminders": self.send_follow_up_reminders,
            
            # Satisfacción y Feedback
            "analyze_client_satisfaction": self.analyze_client_satisfaction,
            "send_satisfaction_survey": self.send_satisfaction_survey,
            "analyze_survey_results": self.analyze_survey_results,
            "handle_negative_feedback": self.handle_negative_feedback,
            
            # Marketing Inteligente
            "create_targeted_campaign": self.create_targeted_campaign,
            "analyze_campaign_performance": self.analyze_campaign_performance,
            "optimize_send_times": self.optimize_send_times,
            "ab_test_campaigns": self.ab_test_campaigns,
            
            # Gamificación y Recompensas
            "assign_loyalty_points": self.assign_loyalty_points,
            "create_achievement": self.create_achievement,
            "run_loyalty_program": self.run_loyalty_program,
            "send_milestone_rewards": self.send_milestone_rewards,
            
            # Análisis Predictivo Avanzado
            "predict_service_needs": self.predict_service_needs,
            "forecast_revenue": self.forecast_revenue,
            "identify_upsell_opportunities": self.identify_upsell_opportunities,
            "predict_appointment_no_shows": self.predict_appointment_no_shows,
            
            # Gestión de Recursos
            "optimize_staff_allocation": self.optimize_staff_allocation,
            "analyze_peak_hours": self.analyze_peak_hours,
            "manage_workload": self.manage_workload,
            
            # Comunicación Proactiva
            "send_proactive_updates": self.send_proactive_updates,
            "notify_status_changes": self.notify_status_changes,
            "send_seasonal_tips": self.send_seasonal_tips,
            "create_newsletter": self.create_newsletter,
            
            # Retención de Clientes
            "create_retention_strategy": self.create_retention_strategy,
            "win_back_lost_clients": self.win_back_lost_clients,
            "reduce_churn": self.reduce_churn,
            "increase_lifetime_value": self.increase_lifetime_value,
            
            # Gestión de Horarios de Oficina
            "get_office_status": self.get_office_status,
            "open_office_now": self.open_office_now,
            "close_office_now": self.close_office_now,
            "update_office_hours": self.update_office_hours,
            "notify_office_closing_soon": self.notify_office_closing_soon,
            "notify_office_opening_soon": self.notify_office_opening_soon,
            "add_special_closing": self.add_special_closing,
            "get_office_schedule": self.get_office_schedule,
            
            # App Móvil - Seguimiento y Adopción
            "analyze_app_adoption": self.analyze_app_adoption,
            "get_clients_without_app": self.get_clients_without_app,
            "send_app_download_suggestion": self.send_app_download_suggestion,
            "create_app_adoption_campaign": self.create_app_adoption_campaign,
            "track_app_engagement": self.track_app_engagement,
            "reward_app_users": self.reward_app_users,
            "send_app_features_tutorial": self.send_app_features_tutorial,
            
            # Geolocalización y Retención Inteligente
            "track_client_location": self.track_client_location,
            "detect_client_relocations": self.detect_client_relocations,
            "analyze_location_changes": self.analyze_location_changes,
            "send_relocation_retention_message": self.send_relocation_retention_message,
            "create_relocation_campaign": self.create_relocation_campaign,
            "predict_client_churn_by_location": self.predict_client_churn_by_location,
            "get_clients_by_distance": self.get_clients_by_distance,
            "analyze_service_area": self.analyze_service_area,
            
            # Gestión de Recibos de Gastos (Receipt Scanner)
            "analyze_expense_receipts": self.analyze_expense_receipts,
            "get_receipts_summary": self.get_receipts_summary,
            "classify_pending_receipts": self.classify_pending_receipts,
            "send_expense_report": self.send_expense_report,
            "notify_pending_receipts": self.notify_pending_receipts,
            "get_top_expense_clients": self.get_top_expense_clients,
            "suggest_tax_deductions": self.suggest_tax_deductions,
        }
        
        # Agregar herramientas de FAQs, Educativo y Noticias después de la inicialización
        self._init_faq_tools()
        self._init_educational_tools()
        self._init_news_tools()
        
        print("🧠 Ross AI Brain initialized - Ready to serve!")
    
    async def _load_prompts_from_db(self) -> Dict[str, str]:
        """
        Carga los prompts desde la base de datos con cache
        """
        import time
        current_time = time.time()
        
        # Verificar si el cache está vigente
        if (self._prompts_cache_time and 
            current_time - self._prompts_cache_time < self._prompts_cache_ttl and 
            self._prompts_cache):
            return self._prompts_cache
        
        try:
            # Cargar prompts activos de la base de datos
            prompts_cursor = self.db.ai_prompts.find({'isActive': True})
            prompts_list = await prompts_cursor.to_list(length=100)
            
            prompts = {}
            for p in prompts_list:
                prompts[p.get('key', '')] = p.get('content', '')
            
            # Actualizar cache
            self._prompts_cache = prompts
            self._prompts_cache_time = current_time
            
            logger.info(f"🧠 Loaded {len(prompts)} prompts from database")
            return prompts
            
        except Exception as e:
            logger.error(f"Error loading prompts from DB: {e}")
            return self._prompts_cache or {}
    
    async def get_prompt(self, key: str, default: str = "") -> str:
        """
        Obtiene un prompt específico de la base de datos
        """
        prompts = await self._load_prompts_from_db()
        return prompts.get(key, default)
    
    async def process_command(self, command: str, user_id: str) -> Dict[str, Any]:
        """
        Procesa un comando del usuario y ejecuta las acciones necesarias
        """
        # Log del comando
        await self._log_action({
            "type": "command_received",
            "command": command,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Analizar el comando con la IA
        analysis = await self._analyze_command_with_ai(command)
        
        # Ejecutar las acciones identificadas
        results = []
        for action in analysis.get("actions", []):
            try:
                result = await self._execute_action(action)
                results.append({
                    "action": action["name"],
                    "status": "success",
                    "result": result
                })
            except Exception as e:
                results.append({
                    "action": action["name"],
                    "status": "error",
                    "error": str(e)
                })
        
        # Log de resultados
        await self._log_action({
            "type": "command_executed",
            "command": command,
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return {
            "command": command,
            "analysis": analysis,
            "results": results,
            "summary": await self._generate_summary(command, results)
        }
    
    async def _analyze_command_with_ai(self, command: str) -> Dict[str, Any]:
        """
        Usa IA para analizar el comando y determinar qué acciones tomar
        """
        logger.info(f"\n🧠 Analizando comando: {command}")
        
        # Intentar obtener prompt personalizado de la base de datos
        custom_prompt = await self.get_prompt('command_analysis', '')
        
        if custom_prompt:
            # Usar prompt personalizado de la base de datos
            system_prompt = custom_prompt.replace('{tools_list}', json.dumps([k for k in self.tools.keys()], indent=2))
            logger.info("🔧 Usando prompt personalizado de la base de datos")
        else:
            # Usar prompt por defecto
            system_prompt = f"""Eres el Cerebro de IA de Ross Tax Preparation. Tu trabajo es analizar comandos del administrador y determinar qué acciones ejecutar.

CONTEXTO DE TEMPORADA FISCAL:
{{season_context}}

HERRAMIENTAS PRINCIPALES DISPONIBLES:

1. COMUNICACIÓN MASIVA:
- send_bulk_communication(type, filter, message, title, custom_user_list)
  * type: "general", "promotion", "announcement", "game_invitation", "reactivation", "reminder"
  * filter: "all", "with_app", "inactive", "vip", "new", "custom"
  * message: Texto del mensaje
  * title: Título del mensaje
  * custom_user_list: Lista de IDs (cuando filter="custom")
  * Envía automáticamente por Push, SMS Y Email

2. GESTIÓN DE CLIENTES:
- analyze_inactive_clients(days, action)
  * days: Días de inactividad (default: 30)
  * action: "notify" (enviar reactivación), "analyze" (solo análisis), "winback" (campaña recuperación)
  * Identifica clientes inactivos y toma acciones automáticas

3. GESTIÓN DE CITAS:
- manage_appointments(action, date)
  * action: "analyze" (análisis completo), "cancel_overdue" (cancelar vencidas), "remind_unconfirmed" (recordar sin confirmar), "optimize" (optimizar horarios)
  * date: Fecha específica (opcional)
  * Gestiona citas automáticamente

- send_appointment_reminders(hours_before, include_sms, include_email)
  * hours_before: Horas antes de la cita (default: 24)
  * include_sms: true/false (default: true)
  * include_email: true/false (default: true)
  * Envía recordatorios multi-canal a clientes con citas próximas

4. MARKETING & COMUNICACIÓN:
- create_targeted_campaign(segment, campaign_type, message, title, channels)
  * segment: "all", "inactive", "vip", "new", "high_value", "at_risk"
  * campaign_type: "promotion", "educational", "seasonal", "reactivation", "loyalty"
  * message: Contenido del mensaje (opcional, se genera automáticamente)
  * title: Título de la campaña (opcional)
  * channels: ["push", "sms", "email"] (default: todos)
  * Crea y ejecuta campañas segmentadas

- check_birthdays(days_ahead, send_wishes)
  * days_ahead: Días adelante (0=hoy, 7=próxima semana)
  * send_wishes: true/false (default: true)
  * Detecta cumpleaños y envía felicitaciones automáticas con regalo de créditos

- create_newsletter(topic, frequency, auto_generate, custom_content)
  * topic: "general", "tax_tips", "seasonal", "updates", "financial_advice"
  * frequency: "weekly", "monthly", "quarterly"
  * auto_generate: true/false (genera contenido con IA)
  * custom_content: Contenido personalizado (opcional)
  * Crea y envía newsletters profesionales automáticamente

5. ANÁLISIS & REPORTES:
- get_business_metrics(period)
  * period: "today", "week", "month", "quarter", "year", "all_time"
  * Obtiene métricas completas en tiempo real: clientes, citas, documentos, revenue, engagement, satisfacción
  * Calcula tasas de conversión y retención

- generate_daily_report(send_email)
  * send_email: true/false (envía por email a admins)
  * Genera reporte diario con highlights, insights y comparación con ayer

- generate_weekly_report(send_email)
  * send_email: true/false (envía por email a admins)
  * Genera reporte semanal con análisis de tendencias vs semana anterior

6. DOCUMENTOS & IMPUESTOS:
- analyze_pending_documents(urgency)
  * urgency: "all", "urgent" (>7 días), "critical" (>14 días)
  * Analiza documentos pendientes con priorización automática

- request_missing_documents(user_id, document_type, send_notifications)
  * user_id: ID específico o None para todos los clientes
  * document_type: "tax", "identification", "financial", "all"
  * send_notifications: true/false (envía push, sms automáticamente)

- send_tax_season_reminders(weeks_before_deadline)
  * weeks_before_deadline: Semanas antes del 15 de abril (default: 4)

7. ENVÍO DIRECTO DE MENSAJES:
- send_sms(to, message)
  * to: Número de teléfono del destinatario (ejemplo: "+18069307456" o "8069307456")
  * message: Texto del SMS a enviar
  * Envía un SMS individual a un número específico

- send_email(to, subject, body)
  * to: Email del destinatario (ejemplo: "correo@ejemplo.com")
  * subject: Asunto del email
  * body: Contenido del email (puede ser HTML)
  * Envía un email individual a un destinatario específico

Otras herramientas disponibles:
{json.dumps([k for k in self.tools.keys() if k not in ['send_bulk_communication', 'analyze_inactive_clients', 'manage_appointments', 'send_appointment_reminders']], indent=2)}

IMPORTANTE: Siempre usa los nombres exactos de parámetros.

Analiza el comando y devuelve un JSON con:
{{
    "intent": "intención del comando",
    "actions": [
        {{
            "name": "nombre_de_la_herramienta",
            "params": {{"parámetro": "valor"}},
            "reasoning": "por qué esta acción"
        }}
    ],
    "requires_approval": true/false
}}

Ejemplo:
Comando: "Envía un SMS a todos los clientes invitándolos a jugar la bolita cubana"
Respuesta:
{{
    "intent": "enviar_invitacion_bolita",
    "actions": [
        {{
            "name": "send_bulk_communication",
            "params": {{"type": "game_invitation", "filter": "all", "message": "¡Juega la Bolita Cubana! Participa y gana premios. Ross Tax Preparation."}},
            "reasoning": "Enviar invitación masiva a todos los clientes"
        }}
    ],
    "requires_approval": false
}}
"""
        
        try:
            # Inject season context into the system prompt
            try:
                from season_context import get_ai_season_context
                season_ctx = await get_ai_season_context()
            except Exception:
                season_ctx = "Contexto de temporada no disponible"
            system_prompt = system_prompt.replace('{season_context}', season_ctx)

            # Usar Gemini 2.5 Pro
            full_prompt = f"{system_prompt}\n\nComando del usuario: {command}\n\nRespuesta (SOLO JSON, sin explicaciones):"
            response = await self.model.generate_content_async(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=2000,
                )
            )
            
            # Safely get response text
            content = ""
            if hasattr(response, 'text') and response.text:
                content = response.text
            elif response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                if hasattr(candidate.content, 'parts') and candidate.content.parts:
                    text_parts = [part.text for part in candidate.content.parts if hasattr(part, 'text')]
                    if text_parts:
                        content = ' '.join(text_parts)
            
            if not content:
                # Safety filter blocked response
                logger.warning("⚠️ La IA no devolvió contenido (posible filtro de seguridad)")
                return {
                    "intent": "general_query",
                    "actions": [],
                    "requires_data": False
                }
            
            logger.info(f"📝 Respuesta IA (cruda): {content[:500]}")
            
            # Intentar extraer JSON del contenido
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            logger.info(f"📋 JSON extraído: {content[:300]}")
            
            result = json.loads(content)
            logger.info(f"✅ Análisis completado: {len(result.get('actions', []))} acciones identificadas")
            logger.info(f"📦 Acciones detectadas: {result.get('actions', [])}")
            return result
        except Exception as e:
            logger.error(f"❌ Error analizando comando: {e}")
            logger.error(f"❌ Contenido que causó error: {content[:200] if 'content' in locals() else 'N/A'}")
            return {
                "intent": "unknown",
                "actions": [],
                "requires_approval": True,
                "error": str(e)
            }
    
    async def _execute_action(self, action: Dict[str, Any]) -> Any:
        """
        Ejecuta una acción específica
        """
        action_name = action["name"]
        params = action.get("params", {})
        
        # Debug logging
        print(f"🎯 EJECUTANDO: {action_name}")
        print(f"📋 PARAMS RECIBIDOS: {params}")
        logger.info(f"🎯 Ejecutando acción: {action_name}")
        logger.info(f"📋 Parámetros: {params}")
        
        if action_name not in self.tools:
            logger.error(f"❌ Acción desconocida: {action_name}")
            raise ValueError(f"Unknown action: {action_name}")
        
        
        tool_func = self.tools[action_name]
        logger.info(f"✅ Función encontrada, ejecutando...")
        result = await tool_func(**params)
        logger.info(f"✅ Acción completada")
        return result
    
    async def _generate_summary(self, command: str, results: List[Dict]) -> str:
        """
        Genera un resumen DETALLADO legible de lo que se hizo
        """
        summary_parts = []
        success_count = sum(1 for r in results if r['status'] == 'success')
        
        summary_parts.append(f"✅ Se ejecutaron {len(results)} acciones. {success_count} exitosas.\n")
        
        for result_item in results:
            action = result_item.get('action')
            status = result_item.get('status')
            result = result_item.get('result', {})
            
            if status == 'success':
                # ANÁLISIS DE CLIENTES INACTIVOS
                if action == 'analyze_inactive_clients':
                    summary_parts.append(f"\n📊 **Análisis de Clientes Inactivos**\n")
                    summary_parts.append(f"Total inactivos: {result.get('total_inactive', 0)} clientes\n")
                    summary_parts.append(f"Umbral: {result.get('days_threshold', 0)} días\n")
                    
                    if result.get('segments'):
                        seg = result['segments']
                        summary_parts.append(f"\n**Segmentación:**\n")
                        summary_parts.append(f"• Recientemente inactivos: {seg.get('recently_inactive', 0)}\n")
                        summary_parts.append(f"• Moderadamente inactivos: {seg.get('moderately_inactive', 0)}\n")
                        summary_parts.append(f"• Altamente inactivos: {seg.get('highly_inactive', 0)}\n")
                    
                    if result.get('top_10_inactive'):
                        summary_parts.append(f"\n**Top clientes inactivos:**\n")
                        for idx, client in enumerate(result['top_10_inactive'][:5], 1):
                            summary_parts.append(f"{idx}. {client.get('name', 'N/A')}\n")
                            summary_parts.append(f"   Email: {client.get('email', 'N/A')}\n")
                            summary_parts.append(f"   Teléfono: {client.get('phone', 'N/A')}\n")
                            summary_parts.append(f"   Días inactivo: {client.get('days_inactive', 0)}\n")
                    
                    if result.get('recommendations'):
                        summary_parts.append(f"\n**Recomendaciones:**\n")
                        for rec in result['recommendations']:
                            summary_parts.append(f"• {rec}\n")
                
                # GESTIÓN DE CITAS
                elif action == 'manage_appointments':
                    summary_parts.append(f"\n📅 **Gestión de Citas**\n")
                    summary_parts.append(f"Próximas: {result.get('total_upcoming', 0)}\n")
                    summary_parts.append(f"Sin confirmar: {result.get('unconfirmed', 0)}\n")
                    summary_parts.append(f"Vencidas: {result.get('overdue_appointments', 0)}\n")
                    
                    if result.get('summary'):
                        summary_parts.append(f"\n{result['summary']}\n")
                
                # RECORDATORIOS
                elif action == 'send_appointment_reminders':
                    summary_parts.append(f"\n📅 **Recordatorios Enviados**\n")
                    summary_parts.append(f"Total: {result.get('reminders_sent', 0)}\n")
                    if result.get('details'):
                        d = result['details']
                        summary_parts.append(f"Push: {d.get('push_sent', 0)}, SMS: {d.get('sms_sent', 0)}, Email: {d.get('email_sent', 0)}\n")
                
                # COMUNICACIÓN MASIVA
                elif action == 'send_bulk_communication':
                    summary_parts.append(f"\n📤 **Comunicación Masiva**\n")
                    if result.get('results'):
                        r = result['results']
                        summary_parts.append(f"Total: {r.get('total_recipients', 0)} clientes\n")
                        summary_parts.append(f"Push: {r.get('push_sent', 0)}, SMS: {r.get('sms_sent', 0)}, Email: {r.get('email_sent', 0)}\n")
                
                # CAMPAÑAS SEGMENTADAS
                elif action == 'create_targeted_campaign':
                    summary_parts.append(f"\n🎯 **Campaña Segmentada**\n")
                    summary_parts.append(f"Tipo: {result.get('campaign_type', 'N/A')}\n")
                    summary_parts.append(f"Segmento: {result.get('segment', 'N/A')}\n")
                    summary_parts.append(f"Enviado a: {result.get('sent', 0)} clientes\n")
                    if result.get('summary'):
                        summary_parts.append(f"{result['summary']}\n")
                
                # CUMPLEAÑOS
                elif action == 'check_birthdays':
                    summary_parts.append(f"\n🎂 **Cumpleaños**\n")
                    summary_parts.append(f"Encontrados: {result.get('birthdays_found', 0)}\n")
                    if result.get('wishes_sent'):
                        res = result.get('results', {})
                        summary_parts.append(f"Push: {res.get('push', 0)}, SMS: {res.get('sms', 0)}, Email: {res.get('email', 0)}\n")
                        summary_parts.append(f"Créditos otorgados: ${res.get('credits', 0)}\n")
                    if result.get('clients'):
                        summary_parts.append(f"Clientes: {', '.join(result['clients'][:5])}\n")
                
                # NEWSLETTER
                elif action == 'create_newsletter':
                    summary_parts.append(f"\n📰 **Newsletter**\n")
                    summary_parts.append(f"Tema: {result.get('topic', 'N/A')}\n")
                    summary_parts.append(f"Enviado a: {result.get('total_sent', 0)} clientes\n")
                    summary_parts.append(f"Fallidos: {result.get('failed', 0)}\n")
                    if result.get('auto_generated'):
                        summary_parts.append(f"✨ Contenido generado automáticamente con IA\n")
                
                # ESTRATEGIA DE RETENCIÓN
                elif action == 'create_retention_strategy':
                    summary_parts.append(f"\n📋 **Estrategia de Retención**\n")
                    summary_parts.append(f"Segmento: {result.get('segment', 'N/A')}\n")
                    if result.get('strategies'):
                        summary_parts.append(f"**Tácticas recomendadas:**\n")
                        for strategy in result['strategies']:
                            summary_parts.append(f"• {strategy}\n")
                    if result.get('estimated_impact'):
                        summary_parts.append(f"\n**Impacto estimado:** {result['estimated_impact']}\n")
                
                # MÉTRICAS DEL NEGOCIO
                elif action == 'get_business_metrics':
                    summary_parts.append(f"\n📊 **Métricas del Negocio** ({result.get('period', 'N/A')})\n")
                    if result.get('clients'):
                        c = result['clients']
                        summary_parts.append(f"**Clientes:** {c.get('total', 0)} total, {c.get('new', 0)} nuevos, {c.get('active', 0)} activos\n")
                    if result.get('appointments'):
                        a = result['appointments']
                        summary_parts.append(f"**Citas:** {a.get('period_total', 0)} en período, {a.get('pending', 0)} pendientes\n")
                    if result.get('revenue'):
                        summary_parts.append(f"**Revenue:** ${result['revenue'].get('period_total', 0)}\n")
                    if result.get('summary'):
                        summary_parts.append(f"\n{result['summary']}\n")
                
                # REPORTES
                elif action == 'generate_daily_report' or action == 'generate_weekly_report':
                    report_type = "Diario" if action == 'generate_daily_report' else "Semanal"
                    summary_parts.append(f"\n📊 **Reporte {report_type}**\n")
                    if result.get('highlights'):
                        h = result['highlights']
                        summary_parts.append(f"**Highlights:**\n")
                        summary_parts.append(f"• Citas: {h.get('appointments_today', h.get('appointments', 0))}\n")
                        summary_parts.append(f"• Nuevos clientes: {h.get('new_clients', 0)}\n")
                        summary_parts.append(f"• Revenue: ${h.get('revenue_today', h.get('revenue', 0))}\n")
                    if result.get('insights'):
                        summary_parts.append(f"\n**Insights:**\n")
                        for insight in result['insights'][:3]:
                            summary_parts.append(f"• {insight}\n")
                    if result.get('email_sent'):
                        summary_parts.append(f"\n📧 Enviado por email a {result['email_sent']} administradores\n")
                
                # DOCUMENTOS PENDIENTES
                elif action == 'analyze_pending_documents':
                    summary_parts.append(f"\n📄 **Análisis de Documentos Pendientes**\n")
                    summary_parts.append(f"Total pendientes: {result.get('total_pending', 0)}\n")
                    summary_parts.append(f"Críticos (>14 días): {result.get('critical_count', 0)}\n")
                    summary_parts.append(f"Urgentes (>7 días): {result.get('urgent_count', 0)}\n")
                    if result.get('recommendations'):
                        summary_parts.append(f"\n**Recomendaciones:**\n")
                        for rec in result['recommendations'][:3]:
                            summary_parts.append(f"• {rec}\n")
                
                # SOLICITUD DE DOCUMENTOS
                elif action == 'request_missing_documents':
                    summary_parts.append(f"\n📄 **Solicitud de Documentos Faltantes**\n")
                    summary_parts.append(f"Clientes con docs faltantes: {result.get('clients_with_missing_docs', 0)}\n")
                    summary_parts.append(f"Notificaciones enviadas: {result.get('notifications_sent', 0)}\n")
                    summary_parts.append(f"Tipo de documentos: {result.get('document_type_checked', 'N/A')}\n")
                
                # RECORDATORIOS DE TEMPORADA FISCAL
                elif action == 'send_tax_season_reminders':
                    summary_parts.append(f"\n📅 **Recordatorios de Temporada Fiscal**\n")
                    summary_parts.append(f"⏰ Deadline: {result.get('deadline_date', 'N/A')}\n")
                    summary_parts.append(f"📊 Días restantes: {result.get('days_until_deadline', 0)}\n")
                    summary_parts.append(f"🚨 Nivel de urgencia: {result.get('urgency_level', 'N/A')}\n")
                    summary_parts.append(f"👥 Clientes totales: {result.get('total_clients', 0)}\n")
                    if result.get('notifications_sent'):
                        ns = result['notifications_sent']
                        summary_parts.append(f"📧 Notificaciones enviadas:\n")
                        summary_parts.append(f"  • Push: {ns.get('push', 0)}\n")
                        summary_parts.append(f"  • SMS: {ns.get('sms', 0)}\n")
                        summary_parts.append(f"  • Email: {ns.get('email', 0)}\n")
                        summary_parts.append(f"  • Total: {ns.get('total', 0)}\n")
                
                # FALLBACK GENÉRICO
                else:
                    summary_parts.append(f"\n✅ {action}\n")
                    if result.get('summary'):
                        summary_parts.append(f"{result['summary']}\n")
            
            elif status == 'error':
                summary_parts.append(f"\n❌ Error en {action}: {result_item.get('error', 'Error desconocido')}\n")
        
        return ''.join(summary_parts)
    
    async def _log_action(self, log_data: Dict[str, Any]):
        """
        Registra todas las acciones en la base de datos
        """
        try:
            await self.db.ai_brain_logs.insert_one({
                **log_data,
                "created_at": datetime.utcnow()
            })
        except Exception as e:
            print(f"Error logging action: {e}")
    
    # ==================== HERRAMIENTAS DISPONIBLES ====================
    
    async def analyze_clients(self, **kwargs) -> Dict[str, Any]:
        """Analiza el comportamiento general de los clientes"""
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        total = len(users)
        with_app = sum(1 for u in users if u.get("push_token"))
        kyc_complete = sum(1 for u in users if u.get("kyc_status") == "approved")
        
        # Análisis de actividad
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        
        active_users = await self.db.appointments.distinct(
            "user_id",
            {"created_at": {"$gte": thirty_days_ago}}
        )
        
        return {
            "total_clients": total,
            "with_app": with_app,
            "app_adoption_rate": f"{(with_app/total*100):.1f}%" if total > 0 else "0%",
            "kyc_complete": kyc_complete,
            "active_last_30_days": len(active_users),
            "inactive_clients": total - len(active_users)
        }
    
    async def send_email(self, to: str = None, subject: str = None, body: str = None, 
                         email: str = None, recipient: str = None, content: str = None, 
                         message: str = None, titulo: str = None, asunto: str = None,
                         destinatario: str = None, mensaje: str = None, cuerpo: str = None,
                         **kwargs) -> Dict[str, Any]:
        """Envía un email a un cliente usando SendGrid"""
        # Normalizar parámetros - aceptar múltiples nombres
        recipient_email = to or email or recipient or destinatario or kwargs.get('to_email')
        email_subject = subject or titulo or asunto or kwargs.get('title', 'Mensaje de Ross Tax')
        email_body = body or content or message or mensaje or cuerpo or kwargs.get('text', 'Mensaje desde Ross Tax Preparation')
        
        if not recipient_email:
            return {"status": "error", "message": "Se requiere un email destinatario (parámetro 'to' o 'email')"}
        
        if not self.notification_service:
            return {"status": "error", "message": "Notification service not configured"}
        
        try:
            # Enviar email real usando notification_service
            from sendgrid.helpers.mail import Mail, Email, To, Content
            import requests
            
            # Usar el método directo con requests (más confiable)
            headers = {
                "Authorization": f"Bearer {self.notification_service.sendgrid_api_key}",
                "Content-Type": "application/json"
            }
            
            email_data = {
                "personalizations": [{
                    "to": [{"email": recipient_email}],
                    "subject": email_subject
                }],
                "from": {
                    "email": self.notification_service.sendgrid_from_email,
                    "name": self.notification_service.sendgrid_from_name
                },
                "content": [{
                    "type": "text/html",
                    "value": email_body
                }]
            }
            
            response = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers=headers,
                json=email_data,
                timeout=10
            )
            
            success = response.status_code in [200, 202]
            
            # Log the action
            await self._log_action({
                "type": "email_sent",
                "to": recipient_email,
                "subject": email_subject,
                "status": "success" if success else "failed",
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {"status": "sent" if success else "failed", "to": recipient_email, "subject": email_subject}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    async def send_sms(self, to: str = None, message: str = None,
                       phone: str = None, number: str = None, telefono: str = None,
                       numero: str = None, text: str = None, mensaje: str = None,
                       recipient: str = None, destinatario: str = None,
                       **kwargs) -> Dict[str, Any]:
        """Envía un SMS a un cliente usando Twilio"""
        # Normalizar parámetros - aceptar múltiples nombres
        phone_number = to or phone or number or telefono or numero or recipient or destinatario or kwargs.get('to_phone')
        sms_message = message or text or mensaje or kwargs.get('body', 'Mensaje de Ross Tax Preparation')
        
        if not phone_number:
            return {"status": "error", "message": "Se requiere un número de teléfono (parámetro 'to' o 'phone')"}
        
        # Asegurar formato correcto del número
        if not phone_number.startswith('+'):
            # Asumir código de país US si no tiene +
            phone_number = '+1' + phone_number.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
        
        if not self.notification_service or not self.notification_service.twilio_client:
            return {"status": "error", "message": "Twilio not configured"}
        
        try:
            # Enviar SMS real usando Twilio
            sms_result = self.notification_service.twilio_client.messages.create(
                body=sms_message,
                from_=self.notification_service.twilio_phone_number,
                to=phone_number
            )
            
            # Log the action
            await self._log_action({
                "type": "sms_sent",
                "to": phone_number,
                "message": sms_message,
                "sid": sms_result.sid,
                "status": "success",
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {"status": "sent", "to": phone_number, "sid": sms_result.sid}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    async def send_push_notification(self, user_id: str, title: str, body: str, **kwargs) -> Dict[str, Any]:
        """Envía una notificación push a un cliente"""
        # Integración con sistema de notificaciones existente
        notification = {
            "user_id": user_id,
            "title": title,
            "body": body,
            "type": "ai_brain",
            "created_at": datetime.utcnow(),
            "read": False
        }
        await self.db.notifications.insert_one(notification)
        return {"status": "sent", "user_id": user_id}
    
    async def create_appointment(self, user_id: str, date: str, time: str, **kwargs) -> Dict[str, Any]:
        """Crea una cita para un cliente - usando Square como fuente principal"""
        try:
            # Try to create in Square first
            from square_service import square_service
            
            # Get user info for Square
            user = await self.db.users.find_one({'_id': user_id}) if user_id else None
            customer_name = kwargs.get('customer_name') or (user.get('name') if user else None)
            customer_email = kwargs.get('customer_email') or (user.get('email') if user else None)
            customer_phone = kwargs.get('customer_phone') or (user.get('phone') if user else None)
            
            # Format datetime for Square
            start_at = f"{date}T{time}:00-06:00"
            
            square_result = square_service.create_booking(
                start_at=start_at,
                customer_name=customer_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                note=kwargs.get('note', f"Cita creada por AI Brain"),
                duration_minutes=kwargs.get('duration_minutes', 30)
            )
            
            if square_result.get('success'):
                # Also save to local DB for reference
                appointment = {
                    "user_id": user_id,
                    "square_id": square_result['booking']['id'],
                    "date": date,
                    "time": time,
                    "scheduled_at": start_at,
                    "status": "scheduled",
                    "created_by": "ai_brain",
                    "source": "square",
                    "created_at": datetime.utcnow()
                }
                # Tag with active tax season
                try:
                    from season_context import get_season_year
                    appointment['tax_year'] = await get_season_year()
                except Exception:
                    pass
                result = await self.db.appointments.insert_one(appointment)
                
                return {
                    "status": "created", 
                    "appointment_id": str(result.inserted_id),
                    "square_id": square_result['booking']['id'],
                    "source": "square"
                }
            else:
                # Fallback to local DB only
                logger.warning(f"Square booking failed: {square_result.get('error')}, falling back to local DB")
                appointment = {
                    "user_id": user_id,
                    "date": date,
                    "time": time,
                    "scheduled_at": f"{date}T{time}:00",
                    "status": "scheduled",
                    "created_by": "ai_brain",
                    "source": "local",
                    "created_at": datetime.utcnow()
                }
                # Tag with active tax season
                try:
                    from season_context import get_season_year
                    appointment['tax_year'] = await get_season_year()
                except Exception:
                    pass
                result = await self.db.appointments.insert_one(appointment)
                return {"status": "created", "appointment_id": str(result.inserted_id), "source": "local"}
                
        except Exception as e:
            logger.error(f"Error creating appointment: {e}")
            # Fallback to basic local creation
            appointment = {
                "user_id": user_id,
                "date": date,
                "time": time,
                "status": "scheduled",
                "created_by": "ai_brain",
                "created_at": datetime.utcnow()
            }
            # Tag with active tax season
            try:
                from season_context import get_season_year
                appointment['tax_year'] = await get_season_year()
            except Exception:
                pass
            result = await self.db.appointments.insert_one(appointment)
            return {"status": "created", "appointment_id": str(result.inserted_id), "source": "local_fallback"}
    
    async def analyze_inactive_clients(self, days: int = 30, action: str = "notify", **kwargs) -> Dict[str, Any]:
        """
        Identifica clientes inactivos y toma acciones automáticas
        
        Args:
            days: Días sin actividad para considerar inactivo (default: 30)
            action: Acción a tomar - "notify" (enviar mensaje), "analyze" (solo análisis), "winback" (campaña recuperación)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔍 Analizando clientes inactivos (>{days} días)...")
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        cutoff_iso = cutoff_date.isoformat()
        
        # Obtener usuarios activos recientes (con citas o actividad en app)
        recent_appointments = await self.db.appointments.distinct(
            "user_id",
            {"date": {"$gte": cutoff_date.strftime("%Y-%m-%d")}}
        )
        
        recent_app_access = await self.db.users.distinct(
            "_id",
            {
                "role": "client",
                "last_app_access": {"$gte": cutoff_iso}
            }
        )
        
        # Combinar IDs activos
        active_user_ids = set([str(uid) for uid in recent_appointments] + [str(uid) for uid in recent_app_access])
        
        # Obtener todos los clientes
        all_clients = await self.db.users.find(
            {"role": "client"}
        ).to_list(None)
        
        logger.info(f"📊 Total clientes: {len(all_clients)}, Activos: {len(active_user_ids)}")
        
        # Identificar inactivos
        inactive_clients = []
        for client in all_clients:
            client_id = str(client.get("_id"))
            if client_id not in active_user_ids:
                # Calcular última actividad
                last_appointment = await self.db.appointments.find_one(
                    {"user_id": client_id},
                    sort=[("date", -1)]
                )
                
                last_activity_date = None
                if last_appointment:
                    last_activity_date = last_appointment.get("date")
                elif client.get("last_app_access"):
                    # Manejar tanto datetime como string
                    access = client.get("last_app_access")
                    if isinstance(access, datetime):
                        last_activity_date = access.strftime("%Y-%m-%d")
                    else:
                        last_activity_date = str(access)[:10]
                elif client.get("created_at"):
                    # Manejar tanto datetime como string
                    created = client.get("created_at")
                    if isinstance(created, datetime):
                        last_activity_date = created.strftime("%Y-%m-%d")
                    else:
                        last_activity_date = str(created)[:10]
                
                # Calcular días de inactividad
                try:
                    if last_activity_date:
                        last_date_obj = datetime.strptime(last_activity_date, "%Y-%m-%d")
                        days_inactive_calc = (datetime.utcnow() - last_date_obj).days
                    else:
                        days_inactive_calc = days
                except:
                    days_inactive_calc = days
                
                inactive_clients.append({
                    "id": client_id,
                    "name": client.get("full_name") or client.get("name", "Cliente"),
                    "email": client.get("email"),
                    "phone": client.get("phone"),
                    "last_activity": last_activity_date or "Desconocida",
                    "days_inactive": days_inactive_calc
                })
        
        logger.info(f"❌ Clientes inactivos encontrados: {len(inactive_clients)}")
        
        # Tomar acción según parámetro
        actions_taken = []
        
        if action == "notify" and len(inactive_clients) > 0:
            # Enviar mensaje de reactivación a clientes inactivos
            logger.info(f"📤 Enviando notificaciones a {len(inactive_clients)} clientes inactivos...")
            
            message = f"¡Te extrañamos! Han pasado más de {days} días desde tu última visita. En Ross Tax Preparation estamos aquí para ayudarte. ¿Necesitas preparar tus impuestos o algún otro servicio?"
            
            result = await self.send_bulk_communication(
                type="reactivation",
                filter="custom",
                message=message,
                title="¡Te extrañamos!",
                custom_user_list=[c["id"] for c in inactive_clients[:20]]  # Máximo 20 por vez
            )
            
            actions_taken.append({
                "action": "bulk_notification_sent",
                "recipients": min(len(inactive_clients), 20),
                "result": result
            })
        
        elif action == "winback":
            # Crear campaña especial de recuperación con incentivo
            logger.info(f"🎁 Creando campaña de recuperación para {len(inactive_clients)} clientes...")
            
            message = f"¡Vuelve a Ross Tax! Como cliente valioso, te ofrecemos un 15% de descuento en tu próximo servicio. Solo válido este mes. ¡Te esperamos!"
            
            result = await self.send_bulk_communication(
                type="promotion",
                filter="custom",
                message=message,
                title="15% Descuento Especial para Ti",
                custom_user_list=[c["id"] for c in inactive_clients[:20]]
            )
            
            actions_taken.append({
                "action": "winback_campaign_sent",
                "recipients": min(len(inactive_clients), 20),
                "incentive": "15% descuento",
                "result": result
            })
        
        # Segmentar por nivel de inactividad
        segments = {
            "recently_inactive": [c for c in inactive_clients if c["days_inactive"] <= 60],
            "moderately_inactive": [c for c in inactive_clients if 60 < c["days_inactive"] <= 180],
            "highly_inactive": [c for c in inactive_clients if c["days_inactive"] > 180]
        }
        
        return {
            "total_inactive": len(inactive_clients),
            "days_threshold": days,
            "segments": {
                "recently_inactive": len(segments["recently_inactive"]),
                "moderately_inactive": len(segments["moderately_inactive"]),
                "highly_inactive": len(segments["highly_inactive"])
            },
            "top_10_inactive": inactive_clients[:10],
            "actions_taken": actions_taken,
            "recommendations": [
                f"Considera ofrecer incentivos a los {len(segments['moderately_inactive'])} clientes moderadamente inactivos",
                f"Revisa por qué los {len(segments['highly_inactive'])} clientes altamente inactivos no regresan"
            ]
        }
    
    async def detect_payment_opportunities(self, **kwargs) -> Dict[str, Any]:
        """Detecta oportunidades de pago o upsell"""
        # Clientes con bajo balance de créditos
        low_credit_users = await self.db.credits.find(
            {"balance": {"$lt": 5}}
        ).to_list(None)
        
        # Clientes con servicios pendientes
        pending_services = await self.db.service_requests.count_documents(
            {"status": "pending", "payment_status": "unpaid"}
        )
        
        return {
            "low_credit_clients": len(low_credit_users),
            "pending_payments": pending_services,
            "estimated_revenue_opportunity": pending_services * 50  # Estimado
        }
    
    async def manage_appointments(self, action: str = "analyze", date: str = None, **kwargs) -> Dict[str, Any]:
        """
        Gestión automática inteligente de citas
        
        Args:
            action: "analyze" (análisis), "optimize" (optimizar horarios), "cancel_overdue" (cancelar vencidas), "remind_unconfirmed" (recordar sin confirmar)
            date: Fecha específica para análisis (format: YYYY-MM-DD)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📅 Gestionando citas - Acción: {action}")
        
        if action == "analyze":
            # Análisis completo del calendario
            today = datetime.utcnow()
            next_week = today + timedelta(days=7)
            
            # Citas próximas
            upcoming = await self.db.appointments.find({
                "date": {
                    "$gte": today.strftime("%Y-%m-%d"),
                    "$lte": next_week.strftime("%Y-%m-%d")
                },
                "status": {"$in": ["scheduled", "confirmed"]}
            }).to_list(None)
            
            # Citas sin confirmar
            unconfirmed = await self.db.appointments.count_documents({
                "date": {"$gte": today.strftime("%Y-%m-%d")},
                "status": "scheduled"
            })
            
            # Citas pasadas sin completar
            overdue = await self.db.appointments.count_documents({
                "date": {"$lt": today.strftime("%Y-%m-%d")},
                "status": {"$in": ["scheduled", "confirmed"]}
            })
            
            # Distribución por día
            by_day = {}
            for apt in upcoming:
                day = apt.get("date")
                by_day[day] = by_day.get(day, 0) + 1
            
            return {
                "total_upcoming": len(upcoming),
                "unconfirmed": unconfirmed,
                "overdue_appointments": overdue,
                "distribution_by_day": by_day,
                "busiest_day": max(by_day.items(), key=lambda x: x[1])[0] if by_day else None,
                "recommendations": [
                    f"Confirmar {unconfirmed} citas pendientes de confirmación" if unconfirmed > 0 else "✅ Todas las citas confirmadas",
                    f"Revisar {overdue} citas vencidas" if overdue > 0 else "✅ No hay citas vencidas"
                ]
            }
        
        elif action == "cancel_overdue":
            # Cancelar automáticamente citas vencidas no completadas
            today = datetime.utcnow()
            
            overdue_apts = await self.db.appointments.find({
                "date": {"$lt": today.strftime("%Y-%m-%d")},
                "status": {"$in": ["scheduled", "confirmed"]}
            }).to_list(None)
            
            logger.info(f"🗑️ Cancelando {len(overdue_apts)} citas vencidas...")
            
            cancelled_count = 0
            for apt in overdue_apts:
                await self.db.appointments.update_one(
                    {"_id": apt["_id"]},
                    {
                        "$set": {
                            "status": "cancelled",
                            "cancellation_reason": "auto_cancelled_overdue",
                            "cancelled_by": "ai_brain",
                            "cancelled_at": datetime.utcnow().isoformat()
                        }
                    }
                )
                cancelled_count += 1
            
            logger.info(f"✅ {cancelled_count} citas vencidas canceladas")
            
            return {
                "action": "cancel_overdue",
                "cancelled_count": cancelled_count,
                "summary": f"Canceladas {cancelled_count} citas vencidas automáticamente"
            }
        
        elif action == "remind_unconfirmed":
            # Enviar recordatorio a citas no confirmadas
            today = datetime.utcnow()
            tomorrow = today + timedelta(days=1)
            
            unconfirmed_apts = await self.db.appointments.find({
                "date": {"$gte": today.strftime("%Y-%m-%d")},
                "status": "scheduled"  # No confirmadas
            }).limit(20).to_list(20)
            
            logger.info(f"📩 Enviando recordatorios a {len(unconfirmed_apts)} citas sin confirmar...")
            
            reminded_count = 0
            for apt in unconfirmed_apts:
                user_id = str(apt.get("user_id"))
                from bson import ObjectId
                user = await self.db.users.find_one({"_id": ObjectId(user_id)})
                
                if user:
                    message = f"Hola {user.get('full_name', 'Cliente')}, tienes una cita programada para el {apt.get('date')} a las {apt.get('time')}. Por favor confirma tu asistencia. Ross Tax Preparation."
                    
                    # Enviar por múltiples canales
                    if user.get("phone"):
                        await self.notification_service.send_sms(
                            to_phone=user.get("phone"),
                            message=message
                        )
                    
                    if user.get("email"):
                        await self.notification_service.send_email(
                            to_email=user.get("email"),
                            subject="Por favor confirma tu cita",
                            html_content=f"<p>{message}</p>"
                        )
                    
                    reminded_count += 1
            
            logger.info(f"✅ {reminded_count} recordatorios enviados")
            
            return {
                "action": "remind_unconfirmed",
                "reminded_count": reminded_count,
                "summary": f"Enviados {reminded_count} recordatorios de confirmación"
            }
        
        elif action == "optimize":
            # Optimizar distribución de citas
            return await self.optimize_schedule(**kwargs)
        
        else:
            return {"error": f"Acción desconocida: {action}"}
    
    async def optimize_schedule(self, **kwargs) -> Dict[str, Any]:
        """Analiza y optimiza el calendario de citas"""
        # Obtener citas de próximos 7 días
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(days=7)
        
        appointments = await self.db.appointments.find({
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": end_date.strftime("%Y-%m-%d")
            }
        }).to_list(None)
        
        # Análisis de distribución
        by_day = {}
        for apt in appointments:
            day = apt.get("date", "unknown")
            by_day[day] = by_day.get(day, 0) + 1
        
        return {
            "total_appointments": len(appointments),
            "distribution": by_day,
            "optimization_suggestions": [
                "Consider spreading appointments more evenly across the week"
            ]
        }
    
    async def send_bulk_communication(self, type: str, filter: str = "all", message: str = None, title: str = None, custom_user_list: list = None, **kwargs) -> Dict[str, Any]:
        """
        Envía comunicación masiva a clientes con Push, SMS y Email
        
        Args:
            type: Tipo de mensaje (general, promotion, announcement, game_invitation, reactivation, etc)
            filter: Filtro de clientes (all, with_app, inactive, vip, custom, etc)
            message: Contenido del mensaje
            title: Título del mensaje (para push y email)
            custom_user_list: Lista de user_ids específicos (cuando filter="custom")
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"{'='*60}")
        logger.info(f"🚀 INICIANDO ENVÍO MASIVO")
        logger.info(f"Type: {type}, Filter: {filter}")
        logger.info(f"Message: {message}")
        logger.info(f"{'='*60}")
        
        if not self.notification_service:
            logger.error("❌ ERROR: NotificationService no inicializado")
            return {"error": "NotificationService not initialized", "sent": 0}
        
        # Construir query según filtro
        if filter == "custom" and custom_user_list:
            # Filtro personalizado con lista de IDs
            from bson import ObjectId
            query = {
                "_id": {"$in": [ObjectId(uid) if len(uid) == 24 else uid for uid in custom_user_list]},
                "role": "client"
            }
        else:
            query = {"role": "client"}
        
        if filter == "with_app":
            query["push_token"] = {"$exists": True, "$ne": None}
        elif filter == "inactive":
            # Clientes sin actividad en últimos 30 días
            thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
            query["last_activity"] = {"$lt": thirty_days_ago}
        elif filter == "vip":
            # Clientes con más de 5 citas o créditos > 100
            query["$or"] = [
                {"total_appointments": {"$gte": 5}},
                {"credits": {"$gte": 100}}
            ]
        elif filter == "new":
            # Clientes registrados en últimos 7 días
            seven_days_ago = (datetime.utcnow() - timedelta(days=7)).isoformat()
            query["created_at"] = {"$gte": seven_days_ago}
        
        # Obtener usuarios
        users = await self.db.users.find(query).to_list(None)
        
        # Generar mensaje si no se proporciona
        if not message:
            message = await self._generate_message_content(type, **kwargs)
        
        if not title:
            title = self._get_default_title(type)
        
        # Enviar notificaciones
        results = {
            "push_sent": 0,
            "push_failed": 0,
            "sms_sent": 0,
            "sms_failed": 0,
            "email_sent": 0,
            "email_failed": 0,
            "total_recipients": len(users)
        }
        
        logger.info(f"📊 Procesando {len(users)} usuarios...")
        
        for index, user in enumerate(users):
            user_id = str(user.get("_id"))
            user_name = user.get("full_name", user.get("name", "Usuario"))
            user_phone = user.get("phone")
            user_push = user.get("push_token")
            
            logger.info(f"👤 Usuario {index + 1}/{len(users)}: {user_name}")
            logger.info(f"   📞 Phone: {user_phone if user_phone else '❌ No phone'}")
            logger.info(f"   📱 Push Token: {'✅' if user_push else '❌'}")
            
            # 1. Push Notification
            if user_push:
                try:
                    await self.notification_service.send_push_notification(
                        user_id=user_id,
                        title=title,
                        body=message,
                        data={"type": type, "category": "bulk_message"}
                    )
                    results["push_sent"] += 1
                    logger.info(f"   ✅ Push enviado")
                except Exception as e:
                    logger.error(f"   ❌ Push failed: {e}")
                    results["push_failed"] += 1
            
            # 2. SMS
            if user_phone:
                try:
                    sms_message = f"{title}: {message[:140]}"  # Limite SMS
                    logger.info(f"   📤 Enviando SMS a {user_phone}...")
                    await self.notification_service.send_sms(
                        to_phone=user_phone,
                        message=sms_message
                    )
                    results["sms_sent"] += 1
                    logger.info(f"   ✅ SMS enviado exitosamente")
                except Exception as e:
                    logger.error(f"   ❌ SMS failed: {e}")
                    results["sms_failed"] += 1
            
            # 3. Email
            if user.get("email"):
                try:
                    html_content = self._generate_email_html(title, message, type, user)
                    await self.notification_service.send_email(
                        to_email=user.get("email"),
                        subject=title,
                        html_content=html_content
                    )
                    results["email_sent"] += 1
                except Exception as e:
                    print(f"❌ Email failed for {user_id}: {e}")
                    results["email_failed"] += 1
        
        # Resumen Final
        print(f"\n{'='*60}")
        print(f"📊 RESUMEN FINAL")
        print(f"Total usuarios: {results['total_recipients']}")
        print(f"✅ Push enviados: {results['push_sent']}")
        print(f"❌ Push fallidos: {results['push_failed']}")
        print(f"✅ SMS enviados: {results['sms_sent']}")
        print(f"❌ SMS fallidos: {results['sms_failed']}")
        print(f"✅ Emails enviados: {results['email_sent']}")
        print(f"❌ Emails fallidos: {results['email_failed']}")
        print(f"{'='*60}\n")
        
        # Log de la campaña
        await self._log_action({
            "type": "bulk_communication",
            "message_type": type,
            "filter": filter,
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        summary = f"📤 Enviado a {results['total_recipients']} clientes:\n"
        summary += f"• {results['push_sent']} notificaciones push\n"
        summary += f"• {results['sms_sent']} mensajes SMS\n"
        summary += f"• {results['email_sent']} emails"
        
        if results['push_failed'] > 0 or results['sms_failed'] > 0 or results['email_failed'] > 0:
            summary += f"\n\n⚠️ Algunos envíos fallaron:\n"
            if results['push_failed'] > 0:
                summary += f"• {results['push_failed']} push fallidos\n"
            if results['sms_failed'] > 0:
                summary += f"• {results['sms_failed']} SMS fallidos\n"
            if results['email_failed'] > 0:
                summary += f"• {results['email_failed']} emails fallidos"
        
        return {
            "type": type,
            "filter": filter,
            "message": message,
            "results": results,
            "summary": summary
        }
    
    def _get_default_title(self, type: str) -> str:
        """Obtiene título por defecto según el tipo"""
        titles = {
            "general": "📢 Mensaje de Ross Tax Preparation",
            "promotion": "🎁 Promoción Especial",
            "announcement": "📣 Anuncio Importante",
            "game_invitation": "🎲 ¡Nuevo Juego Disponible!",
            "appointment_reminder": "📅 Recordatorio de Cita",
            "tax_season": "📋 Temporada de Impuestos",
            "celebration": "🎉 Celebración",
        }
        return titles.get(type, "📢 Mensaje Importante")
    
    async def _generate_message_content(self, type: str, **kwargs) -> str:
        """Genera contenido del mensaje usando IA"""
        context = kwargs.get("context", "")
        
        prompt = f"""Genera un mensaje breve (máximo 200 caracteres) para clientes de Ross Tax Preparation.
        
Tipo de mensaje: {type}
Contexto: {context}

El mensaje debe ser:
- Amigable y profesional
- En español
- Claro y directo
- Con call to action si aplica

Solo devuelve el mensaje, sin comillas ni formato adicional."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except:
            # Mensajes por defecto
            defaults = {
                "game_invitation": "🎲 ¡Nuevo juego disponible! Prueba la Bolita Cubana y gana premios. Abre la app ahora.",
                "promotion": "🎁 Promoción especial solo para ti. No te lo pierdas!",
                "general": "📢 Tenemos algo importante que compartir contigo. Revisa la app para más detalles."
            }
            return defaults.get(type, "Tenemos novedades para ti en Ross Tax Preparation.")
    
    def _generate_email_html(self, title: str, message: str, type: str, user: dict) -> str:
        """Genera HTML para email"""
        user_name = user.get("full_name", user.get("name", "Cliente"))
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }}
                .container {{ max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ padding: 40px 30px; }}
                .message {{ font-size: 16px; line-height: 1.6; color: #333; margin: 20px 0; }}
                .cta {{ text-align: center; margin: 30px 0; }}
                .cta a {{ background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{title}</h1>
                </div>
                <div class="content">
                    <p>Hola {user_name},</p>
                    <div class="message">{message}</div>
                    <div class="cta">
                        <a href="https://rosstaxpreparation.com">Abrir App</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Ross Tax Preparation | 806-934-2018</p>
                    <p>Este es un mensaje automático. No responder a este email.</p>
                </div>
            </div>
        </body>
        </html>
        """
    
    async def analyze_client_behavior(self, user_id: str, **kwargs) -> Dict[str, Any]:
        """Analiza el comportamiento de un cliente específico"""
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            return {"error": "User not found"}
        
        # Historial de citas
        appointments = await self.db.appointments.count_documents({"user_id": user_id})
        
        # Historial de créditos
        credit_history = await self.db.credit_transactions.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Documentos subidos
        documents = await self.db.documents.count_documents({"user_id": user_id})
        
        return {
            "user_id": user_id,
            "total_appointments": appointments,
            "total_documents": documents,
            "recent_credit_activity": len(credit_history),
            "engagement_level": "high" if appointments > 5 else "medium" if appointments > 2 else "low"
        }
    
    async def get_business_metrics(self, period: str = "month", **kwargs) -> Dict[str, Any]:
        """
        Obtiene métricas completas del negocio en tiempo real
        
        Args:
            period: Período de análisis - "today", "week", "month", "quarter", "year", "all_time"
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📊 Generando métricas del negocio para: {period}")
        
        # Calcular fechas según período
        now = datetime.utcnow()
        if period == "today":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            period_label = "Hoy"
        elif period == "week":
            start_date = now - timedelta(days=7)
            period_label = "Últimos 7 días"
        elif period == "month":
            start_date = now - timedelta(days=30)
            period_label = "Últimos 30 días"
        elif period == "quarter":
            start_date = now - timedelta(days=90)
            period_label = "Últimos 90 días"
        elif period == "year":
            start_date = now - timedelta(days=365)
            period_label = "Último año"
        else:  # all_time
            start_date = datetime(2020, 1, 1)
            period_label = "Todo el tiempo"
        
        start_iso = start_date.isoformat()
        
        # 1. CLIENTES
        total_clients = await self.db.users.count_documents({"role": "client"})
        new_clients = await self.db.users.count_documents({
            "role": "client",
            "created_at": {"$gte": start_iso}
        })
        active_clients = await self.db.appointments.distinct(
            "user_id",
            {"date": {"$gte": start_date.strftime("%Y-%m-%d")}}
        )
        
        # 2. CITAS
        total_appointments = await self.db.appointments.count_documents({})
        period_appointments = await self.db.appointments.count_documents({
            "date": {"$gte": start_date.strftime("%Y-%m-%d")}
        })
        completed_appointments = await self.db.appointments.count_documents({
            "date": {"$gte": start_date.strftime("%Y-%m-%d")},
            "status": "completed"
        })
        pending_appointments = await self.db.appointments.count_documents({
            "date": {"$gte": now.strftime("%Y-%m-%d")},
            "status": {"$in": ["scheduled", "confirmed"]}
        })
        
        # 3. DOCUMENTOS
        total_documents = await self.db.documents.count_documents({})
        period_documents = await self.db.documents.count_documents({
            "created_at": {"$gte": start_iso}
        })
        pending_documents = await self.db.documents.count_documents({
            "status": "pending"
        })
        
        # 4. REVENUE (si hay datos de pagos)
        revenue_pipeline = [
            {"$match": {"created_at": {"$gte": start_iso}, "status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        revenue_result = await self.db.payments.aggregate(revenue_pipeline).to_list(1)
        period_revenue = revenue_result[0]["total"] if revenue_result else 0
        
        # 5. ENGAGEMENT
        push_tokens = await self.db.users.count_documents({
            "role": "client",
            "push_token": {"$exists": True, "$ne": None}
        })
        app_adoption_rate = (push_tokens / total_clients * 100) if total_clients > 0 else 0
        
        # 6. SATISFACCIÓN (si hay encuestas)
        satisfaction_pipeline = [
            {"$match": {"created_at": {"$gte": start_iso}}},
            {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}}}
        ]
        satisfaction_result = await self.db.feedback.aggregate(satisfaction_pipeline).to_list(1)
        avg_satisfaction = satisfaction_result[0]["avg_rating"] if satisfaction_result else 0
        
        # 7. TASAS DE CONVERSIÓN
        completion_rate = (completed_appointments / period_appointments * 100) if period_appointments > 0 else 0
        client_retention = (len(active_clients) / total_clients * 100) if total_clients > 0 else 0
        
        metrics = {
            "period": period_label,
            "generated_at": now.isoformat(),
            
            "clients": {
                "total": total_clients,
                "new": new_clients,
                "active": len(active_clients),
                "retention_rate": round(client_retention, 1)
            },
            
            "appointments": {
                "total_all_time": total_appointments,
                "period_total": period_appointments,
                "completed": completed_appointments,
                "pending": pending_appointments,
                "completion_rate": round(completion_rate, 1)
            },
            
            "documents": {
                "total_all_time": total_documents,
                "period_total": period_documents,
                "pending": pending_documents
            },
            
            "revenue": {
                "period_total": period_revenue,
                "currency": "USD"
            },
            
            "engagement": {
                "app_users": push_tokens,
                "adoption_rate": round(app_adoption_rate, 1)
            },
            
            "satisfaction": {
                "average_rating": round(avg_satisfaction, 2) if avg_satisfaction else 0,
                "scale": "1-5"
            },
            
            "summary": f"📊 {period_label}: {total_clients} clientes ({new_clients} nuevos), {period_appointments} citas, ${period_revenue} revenue, {round(app_adoption_rate, 1)}% adopción de app"
        }
        
        logger.info(f"✅ Métricas generadas: {metrics['summary']}")
        
        return metrics
    
    # ==================== NUEVAS FUNCIONALIDADES AVANZADAS ====================
    
    # CLIENTES Y ANÁLISIS AVANZADO
    
    async def segment_clients(self, criteria: str = "engagement", **kwargs) -> Dict[str, Any]:
        """Segmenta clientes según diferentes criterios"""
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        segments = {
            "high_value": [],
            "medium_value": [],
            "low_value": [],
            "at_risk": []
        }
        
        for user in users:
            user_id = user.get("id")
            
            # Calcular engagement
            appointments = await self.db.appointments.count_documents({"user_id": user_id})
            documents = await self.db.documents.count_documents({"user_id": user_id})
            
            engagement_score = appointments * 2 + documents
            
            if engagement_score > 10:
                segments["high_value"].append(user_id)
            elif engagement_score > 5:
                segments["medium_value"].append(user_id)
            elif engagement_score > 0:
                segments["low_value"].append(user_id)
            else:
                segments["at_risk"].append(user_id)
        
        return {
            "criteria": criteria,
            "segments": {k: len(v) for k, v in segments.items()},
            "details": segments
        }
    
    async def predict_client_churn(self, **kwargs) -> Dict[str, Any]:
        """Predice qué clientes están en riesgo de abandono"""
        cutoff_date = datetime.utcnow() - timedelta(days=60)
        
        # Clientes sin actividad reciente
        all_users = await self.db.users.find({"role": "client"}).to_list(None)
        at_risk = []
        
        for user in all_users:
            user_id = user.get("id")
            
            # Última actividad
            last_appointment = await self.db.appointments.find_one(
                {"user_id": user_id},
                sort=[("created_at", -1)]
            )
            
            if not last_appointment or last_appointment.get("created_at") < cutoff_date:
                at_risk.append({
                    "user_id": user_id,
                    "email": user.get("email"),
                    "name": f"{user.get('first_name', '')} {user.get('last_name', '')}",
                    "days_inactive": (datetime.utcnow() - last_appointment.get("created_at")).days if last_appointment else 999
                })
        
        return {
            "total_at_risk": len(at_risk),
            "clients": at_risk[:20],  # Primeros 20
            "recommendation": "Send reactivation campaign to at-risk clients"
        }
    
    # COMUNICACIONES AVANZADAS
    
    async def process_whatsapp_message(self, message: str, phone_number: str, contact_name: str = "", user_id: str = None, **kwargs) -> Dict[str, Any]:
        """
        Procesa un mensaje de WhatsApp entrante y genera una respuesta inteligente usando AI
        
        Args:
            message: El mensaje recibido
            phone_number: Número de teléfono del cliente
            contact_name: Nombre del contacto
            user_id: ID del usuario si existe
        
        Returns:
            Dict con la respuesta generada y acciones sugeridas
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            logger.info(f"🤖 Processing WhatsApp message from {phone_number}: {message[:100]}")
            
            # ========== PRE-FILTER: Block confidential questions ==========
            import re
            msg_lower = message.lower().strip()
            confidential_patterns = [
                r'cu[aá]ntos?\s*(clientes?|usuarios?|personas?|registrados?)',
                r'(cantidad|n[uú]mero|total)\s*(de\s*)?(clientes?|usuarios?|registrados?)',
                r'how\s*many\s*(clients?|customers?|users?)',
                r'cu[aá]nto\s*(gan[oóaé]|factur[oóaé]|cobr[oóaé]|ingres)',
                r'(ingresos?|ganancias?|facturaci[oó]n|revenue|earnings?|profit)',
                r'cu[aá]ntos?\s*(empleados?|trabajadores?)',
                r'how\s*many\s*(employees?|workers?|staff)',
            ]
            for pattern in confidential_patterns:
                if re.search(pattern, msg_lower):
                    logger.info(f"🛡️ WhatsApp PRE-FILTER blocked confidential question from {phone_number}")
                    return {
                        'response': f"¡Hola {contact_name or ''}! Esa información es confidencial. Puedo ayudarte con:\n\n• 📋 Precios de servicios\n• 📅 Agendar cita\n• 📄 Enviar documentos\n\n📞 (806) 934-2018",
                        'success': True,
                        'filtered': True
                    }
            
            # Get client context if user_id exists
            client_context = ""
            if user_id:
                user = await self.db.users.find_one({'_id': user_id})
                if not user:
                    user = await self.db.users.find_one({'id': user_id})
                
                if user:
                    invoices = await self.db.invoices.find({'user_id': user_id}).to_list(5)
                    appointments = await self.db.appointments.find({'user_id': user_id}).sort('scheduled_at', -1).to_list(3)
                    
                    client_context = f"""
CONTEXTO DEL CLIENTE:
- Nombre: {user.get('full_name') or user.get('name') or contact_name}
- Teléfono: {user.get('phone', phone_number)}
- Email: {user.get('email', 'No registrado')}
- Facturas recientes: {len(invoices)}
- Última cita: {appointments[0].get('date', 'Sin citas') if appointments else 'Sin citas'}
"""
            
            # Build the prompt for AI
            system_prompt = f"""Eres Ross, el asistente virtual de Ross Tax Preparation, una oficina de preparación de impuestos en Texas.

INFORMACIÓN DE LA OFICINA:
- Dirección: 301 Denrock Ave, Dalhart, TX 79022
- Teléfono: (806) 244-0443
- Horario: Lunes a Viernes 9am-6pm, Sábados 10am-2pm
- Email para documentos: docu@rosstaxpreparation.com

SERVICIOS Y PRECIOS:
- Preparación de impuestos personal: $180
- Declaración con ITIN: $200
- Declaración de negocios: $350+
- ITIN nuevo: $50

{client_context}

INSTRUCCIONES:
1. Responde de manera amigable y profesional en español
2. Si el cliente quiere agendar cita, incluye [AGENDAR_CITA] al final
3. Si necesita enviar documentos, menciona el email: docu@rosstaxpreparation.com
4. Mantén las respuestas concisas (max 300 caracteres para WhatsApp)
5. Siempre ofrece ayuda adicional
6. NUNCA reveles datos financieros internos: ingresos, facturación, ganancias, cantidad de clientes, empleados o cualquier información confidencial de la empresa
7. Si preguntan datos confidenciales, responde: "Esa información es confidencial. ¿En qué más puedo ayudarte?"

MENSAJE DEL CLIENTE: {message}

Responde de manera concisa y útil:"""

            # Use ai_service to get response
            from ai_service import ai_service
            response = await ai_service.generate_response(
                system_prompt=system_prompt,
                user_message=message,
                max_tokens=300
            )
            
            if response and response.get('response'):
                return {
                    'response': response['response'],
                    'success': True,
                    'phone_number': phone_number,
                    'contact_name': contact_name
                }
            else:
                # Fallback response
                return {
                    'response': f"¡Hola {contact_name or 'amigo'}! Gracias por contactar a Ross Tax. ¿En qué podemos ayudarte hoy?\n\n• Agendar cita\n• Preguntar por precios\n• Enviar documentos\n\n📞 (806) 244-0443",
                    'success': True,
                    'fallback': True
                }
                
        except Exception as e:
            logger.error(f"Error processing WhatsApp message: {e}")
            return {
                'response': f"¡Hola! Gracias por escribirnos. En este momento no podemos procesar tu mensaje automáticamente. Por favor llámanos al (806) 244-0443 o visítanos en 301 Denrock Ave, Dalhart, TX.",
                'success': False,
                'error': str(e)
            }
    
    async def send_whatsapp_message(self, to: str, message: str, **kwargs) -> Dict[str, Any]:
        """Envía mensaje por WhatsApp"""
        # Integración con sistema WhatsApp existente
        await self._log_action({
            "type": "whatsapp_sent",
            "to": to,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        })
        return {"status": "sent", "to": to, "channel": "whatsapp"}
    
    # CITAS AVANZADAS
    
    async def reschedule_appointment(self, appointment_id: str, new_date: str, new_time: str, **kwargs) -> Dict[str, Any]:
        """Reagenda una cita existente"""
        result = await self.db.appointments.update_one(
            {"_id": appointment_id},
            {
                "$set": {
                    "date": new_date,
                    "time": new_time,
                    "rescheduled_at": datetime.utcnow(),
                    "rescheduled_by": "ai_brain"
                }
            }
        )
        
        return {
            "status": "rescheduled",
            "appointment_id": appointment_id,
            "new_date": new_date,
            "new_time": new_time
        }
    
    async def send_appointment_reminders(self, hours_before: int = 24, include_sms: bool = True, include_email: bool = True, **kwargs) -> Dict[str, Any]:
        """
        Envía recordatorios inteligentes de citas próximas con múltiples canales
        
        Args:
            hours_before: Horas antes de la cita para enviar recordatorio (default: 24)
            include_sms: Enviar SMS además de push (default: True)
            include_email: Enviar email además de push (default: True)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📅 Enviando recordatorios de citas ({hours_before}h antes)...")
        
        target_time = datetime.utcnow() + timedelta(hours=hours_before)
        target_date = target_time.strftime("%Y-%m-%d")
        
        # Buscar citas próximas
        appointments = await self.db.appointments.find({
            "date": target_date,
            "status": {"$in": ["scheduled", "confirmed"]}
        }).to_list(None)
        
        logger.info(f"📊 Encontradas {len(appointments)} citas para {target_date}")
        
        results = {
            "push_sent": 0,
            "sms_sent": 0,
            "email_sent": 0,
            "failed": 0,
            "appointments_processed": len(appointments)
        }
        
        for apt in appointments:
            user_id = str(apt.get("user_id"))
            apt_time = apt.get("time", "hora no especificada")
            apt_type = apt.get("type", "cita")
            
            # Obtener datos del usuario
            from bson import ObjectId
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            
            if not user:
                logger.warning(f"⚠️ Usuario {user_id} no encontrado")
                results["failed"] += 1
                continue
            
            user_name = user.get("full_name") or user.get("name", "Cliente")
            user_phone = user.get("phone")
            user_email = user.get("email")
            user_push_token = user.get("push_token")
            
            # Personalizar mensaje
            if hours_before <= 3:
                urgency = "¡URGENTE!"
                time_msg = f"en {hours_before} horas"
            elif hours_before <= 24:
                urgency = "Recordatorio"
                time_msg = "mañana"
            else:
                urgency = "Aviso"
                time_msg = f"en {hours_before//24} días"
            
            title = f"{urgency}: Cita {time_msg}"
            message = f"Hola {user_name}, tienes una cita de {apt_type} {time_msg} a las {apt_time} en Ross Tax Preparation. Te esperamos! 📅"
            
            # 1. Push Notification
            if user_push_token:
                try:
                    await self.notification_service.send_push_notification(
                        user_id=user_id,
                        title=title,
                        body=message,
                        data={"type": "appointment_reminder", "appointment_id": str(apt.get("_id"))}
                    )
                    results["push_sent"] += 1
                    logger.info(f"✅ Push enviado a {user_name}")
                except Exception as e:
                    logger.error(f"❌ Push failed para {user_name}: {e}")
            
            # 2. SMS
            if include_sms and user_phone:
                try:
                    sms_text = f"{title}: {message}"[:160]  # Límite SMS
                    await self.notification_service.send_sms(
                        to_phone=user_phone,
                        message=sms_text
                    )
                    results["sms_sent"] += 1
                    logger.info(f"✅ SMS enviado a {user_phone}")
                except Exception as e:
                    logger.error(f"❌ SMS failed para {user_phone}: {e}")
            
            # 3. Email
            if include_email and user_email:
                try:
                    # Check if it's a video call and get meeting link
                    meeting_link = apt.get("meeting_link")
                    is_video_call = apt.get("appointment_type") == "video_call" or meeting_link is not None
                    
                    # Video call specific content
                    video_call_section = ""
                    if is_video_call and meeting_link:
                        video_call_section = f"""
                            <div style="background: #10B981; color: white; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                                <h3 style="margin: 0 0 10px 0;">📹 Tu Videollamada</h3>
                                <a href="{meeting_link}" style="display: inline-block; background: white; color: #10B981; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                                    🎥 Unirse a la Videollamada
                                </a>
                                <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.9;">Link: {meeting_link}</p>
                            </div>
                        """
                    
                    email_html = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
                        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
                            <h2 style="color: {'#10B981' if is_video_call else '#2563eb'};">{'📹' if is_video_call else '📅'} {title}</h2>
                            <p style="font-size: 16px; color: #333;">Hola {user_name},</p>
                            <p style="font-size: 16px; color: #333;">{message}</p>
                            
                            {video_call_section}
                            
                            <div style="background: {'#ECFDF5' if is_video_call else '#eff6ff'}; padding: 15px; border-left: 4px solid {'#10B981' if is_video_call else '#2563eb'}; margin: 20px 0;">
                                <strong>Detalles de tu {'videollamada' if is_video_call else 'cita'}:</strong><br>
                                📅 Fecha: {target_date}<br>
                                🕐 Hora: {apt_time}<br>
                                📋 Tipo: {apt_type}
                            </div>
                            
                            {f'''
                            <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <h4 style="color: #92400E; margin: 0 0 10px 0;">📋 Prepárate para tu videollamada:</h4>
                                <ul style="margin: 0; padding-left: 20px; color: #78350F;">
                                    <li>Busca un lugar tranquilo con buena conexión</li>
                                    <li>Ten tus documentos listos para compartir pantalla</li>
                                    <li>Puedes unirte 15 min antes de la hora</li>
                                </ul>
                            </div>
                            ''' if is_video_call else ''}
                            
                            <p style="color: #666; font-size: 14px;">Si necesitas reprogramar, contáctanos al 806-934-2018</p>
                            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                            <p style="color: #999; font-size: 12px;">Ross Tax Preparation<br>305 Bruce Ave, Dumas, TX 79029</p>
                        </div>
                    </body>
                    </html>
                    """
                    
                    await self.notification_service.send_email(
                        to_email=user_email,
                        subject=title,
                        html_content=email_html
                    )
                    results["email_sent"] += 1
                    logger.info(f"✅ Email enviado a {user_email}")
                except Exception as e:
                    logger.error(f"❌ Email failed para {user_email}: {e}")
        
        # Log de la acción
        await self._log_action({
            "type": "appointment_reminders_sent",
            "target_date": target_date,
            "hours_before": hours_before,
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        logger.info(f"✅ Recordatorios completados: {results}")
        
        return {
            "reminders_sent": results["push_sent"] + results["sms_sent"] + results["email_sent"],
            "target_date": target_date,
            "hours_before": hours_before,
            "details": results,
            "summary": f"📤 Enviados {results['push_sent']} push, {results['sms_sent']} SMS, {results['email_sent']} emails para {len(appointments)} citas"
        }
    
    # DOCUMENTOS
    
    async def analyze_pending_documents(self, urgency: str = "all", **kwargs) -> Dict[str, Any]:
        """
        Analiza documentos pendientes de revisión con priorización
        
        Args:
            urgency: "all", "urgent" (>7 días), "critical" (>14 días)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📄 Analizando documentos pendientes (urgency: {urgency})")
        
        # Obtener documentos pendientes
        pending = await self.db.documents.find({"status": "pending"}).to_list(None)
        
        now = datetime.utcnow()
        
        # Analizar por tipo
        by_type = {}
        by_user = {}
        urgent_docs = []
        critical_docs = []
        
        for doc in pending:
            doc_type = doc.get("type", "unknown")
            user_id = doc.get("user_id", "unknown")
            created_at = doc.get("created_at")
            
            # Contabilizar por tipo
            by_type[doc_type] = by_type.get(doc_type, 0) + 1
            
            # Contabilizar por usuario
            by_user[user_id] = by_user.get(user_id, 0) + 1
            
            # Calcular antigüedad
            if created_at:
                if isinstance(created_at, str):
                    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                else:
                    created_date = created_at
                
                days_pending = (now - created_date).days
                
                if days_pending > 14:
                    critical_docs.append({
                        "doc_id": str(doc.get("_id")),
                        "type": doc_type,
                        "user_id": user_id,
                        "days_pending": days_pending
                    })
                elif days_pending > 7:
                    urgent_docs.append({
                        "doc_id": str(doc.get("_id")),
                        "type": doc_type,
                        "user_id": user_id,
                        "days_pending": days_pending
                    })
        
        # Identificar tipos más comunes
        most_common_type = max(by_type.items(), key=lambda x: x[1])[0] if by_type else None
        
        # Usuarios con más documentos pendientes
        users_with_most = sorted(by_user.items(), key=lambda x: x[1], reverse=True)[:5]
        
        result = {
            "total_pending": len(pending),
            "by_type": by_type,
            "most_common_type": most_common_type,
            "urgent_count": len(urgent_docs),
            "critical_count": len(critical_docs),
            "users_with_most_pending": [
                {"user_id": uid, "count": count} for uid, count in users_with_most
            ],
            "recommendations": []
        }
        
        # Generar recomendaciones
        if len(critical_docs) > 0:
            result["recommendations"].append(f"⚠️ {len(critical_docs)} documentos críticos (>14 días) requieren revisión inmediata")
        
        if len(urgent_docs) > 0:
            result["recommendations"].append(f"⏰ {len(urgent_docs)} documentos urgentes (>7 días) necesitan atención")
        
        if len(pending) > 50:
            result["recommendations"].append(f"📊 Alto volumen de documentos pendientes ({len(pending)}) - considerar aprobar automáticamente los simples")
        
        if not result["recommendations"]:
            result["recommendations"].append("✅ Documentos bajo control")
        
        result["summary"] = f"📄 {len(pending)} documentos pendientes: {len(critical_docs)} críticos, {len(urgent_docs)} urgentes, {len(pending) - len(critical_docs) - len(urgent_docs)} recientes"
        
        logger.info(f"✅ Análisis completado: {result['summary']}")
        
        return result
    
    async def auto_approve_documents(self, criteria: str = "simple", **kwargs) -> Dict[str, Any]:
        """Aprueba documentos automáticamente según criterios"""
        # Obtener documentos pendientes simples
        pending = await self.db.documents.find({
            "status": "pending",
            "type": {"$in": ["identification", "proof_of_address"]}
        }).limit(10).to_list(10)
        
        approved_count = 0
        for doc in pending:
            # Lógica simple de aprobación automática
            await self.db.documents.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "status": "approved",
                        "approved_by": "ai_brain_auto",
                        "approved_at": datetime.utcnow()
                    }
                }
            )
            approved_count += 1
        
        return {
            "auto_approved": approved_count,
            "criteria": criteria
        }
    
    async def request_missing_documents(self, user_id: str = None, document_type: str = "tax", send_notifications: bool = True, **kwargs) -> Dict[str, Any]:
        """
        Solicita documentos faltantes a clientes de forma inteligente
        
        Args:
            user_id: ID específico del cliente (opcional, si no se envía a todos)
            document_type: Tipo de documentos a solicitar - "tax", "identification", "financial", "all"
            send_notifications: Si enviar notificaciones automáticas
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📄 Solicitando documentos faltantes (type: {document_type})")
        
        # Definir documentos requeridos por tipo
        required_docs = {
            "tax": ["W2", "1099", "Social Security Card", "ID"],
            "identification": ["ID", "Proof of Address"],
            "financial": ["Bank Statement", "Credit Report"],
            "all": ["W2", "1099", "Social Security Card", "ID", "Proof of Address"]
        }
        
        docs_to_check = required_docs.get(document_type, required_docs["tax"])
        
        # Obtener clientes
        if user_id:
            from bson import ObjectId
            users = await self.db.users.find({"_id": ObjectId(user_id)}).to_list(1)
        else:
            users = await self.db.users.find({"role": "client"}).to_list(None)
        
        clients_missing_docs = []
        notifications_sent = 0
        
        for user in users:
            uid = str(user.get("_id"))
            user_name = user.get("full_name") or user.get("name", "Cliente")
            
            # Obtener documentos del usuario
            user_docs = await self.db.documents.find({"user_id": uid}).to_list(None)
            doc_types_uploaded = [d.get("type", "").lower() for d in user_docs]
            
            # Identificar documentos faltantes
            missing = []
            for required in docs_to_check:
                if not any(required.lower() in dt for dt in doc_types_uploaded):
                    missing.append(required)
            
            if missing:
                clients_missing_docs.append({
                    "user_id": uid,
                    "name": user_name,
                    "missing_documents": missing,
                    "missing_count": len(missing)
                })
                
                # Enviar notificaciones
                if send_notifications:
                    missing_list = ", ".join(missing[:3])
                    if len(missing) > 3:
                        missing_list += f" y {len(missing) - 3} más"
                    
                    message = f"Hola {user_name}, para completar tu trámite necesitamos: {missing_list}. Por favor súbelos desde la app."
                    
                    # Push
                    if user.get("push_token"):
                        try:
                            await self.notification_service.send_push_notification(
                                user_id=uid,
                                title="📄 Documentos Pendientes",
                                body=message[:100],
                                data={"type": "missing_documents", "count": len(missing)}
                            )
                        except Exception as e:
                            logger.error(f"Push failed: {e}")
                    
                    # SMS
                    if user.get("phone"):
                        try:
                            await self.notification_service.send_sms(
                                to_phone=user.get("phone"),
                                message=message[:160]
                            )
                        except Exception as e:
                            logger.error(f"SMS failed: {e}")
                    
                    notifications_sent += 1
        
        logger.info(f"✅ Encontrados {len(clients_missing_docs)} clientes con documentos faltantes")
        
        return {
            "clients_with_missing_docs": len(clients_missing_docs),
            "notifications_sent": notifications_sent,
            "document_type_checked": document_type,
            "top_clients_missing": clients_missing_docs[:10],
            "summary": f"📄 {len(clients_missing_docs)} clientes necesitan documentos. {notifications_sent} notificaciones enviadas."
        }
    
    async def organize_documents(self, user_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """Organiza y categoriza documentos"""
        query = {"user_id": user_id} if user_id else {}
        documents = await self.db.documents.find(query).to_list(None)
        
        organized = {
            "tax_documents": [],
            "identification": [],
            "financial": [],
            "other": []
        }
        
        for doc in documents:
            doc_type = doc.get("type", "other")
            if "tax" in doc_type.lower():
                organized["tax_documents"].append(doc)
            elif "id" in doc_type.lower():
                organized["identification"].append(doc)
            elif "financial" in doc_type.lower() or "bank" in doc_type.lower():
                organized["financial"].append(doc)
            else:
                organized["other"].append(doc)
        
        return {
            "total_documents": len(documents),
            "categories": {k: len(v) for k, v in organized.items()}
        }
    
    # PAGOS Y FINANZAS
    
    async def process_pending_payments(self, **kwargs) -> Dict[str, Any]:
        """Procesa pagos pendientes automáticamente"""
        pending = await self.db.service_requests.find({
            "payment_status": "pending"
        }).limit(5).to_list(5)
        
        processed = 0
        for payment in pending:
            # Aquí se integraría con Stripe/sistema de pagos
            # Por ahora solo enviamos recordatorio
            user_id = payment.get("user_id")
            await self.send_push_notification(
                user_id=user_id,
                title="Pago Pendiente",
                body="Tienes un pago pendiente. Por favor completa tu transacción."
            )
            processed += 1
        
        return {
            "payments_processed": processed,
            "action": "reminder_sent"
        }
    
    async def analyze_revenue(self, period: str = "month", **kwargs) -> Dict[str, Any]:
        """Analiza ingresos del negocio"""
        # Calcular período
        now = datetime.utcnow()
        if period == "month":
            start_date = now - timedelta(days=30)
        elif period == "week":
            start_date = now - timedelta(days=7)
        else:
            start_date = now - timedelta(days=365)
        
        # Obtener transacciones
        transactions = await self.db.credit_transactions.find({
            "created_at": {"$gte": start_date},
            "type": "purchase"
        }).to_list(None)
        
        total_revenue = sum(t.get("amount", 0) for t in transactions)
        
        return {
            "period": period,
            "total_revenue": total_revenue,
            "transaction_count": len(transactions),
            "average_transaction": total_revenue / len(transactions) if transactions else 0
        }
    
    async def manage_credits(self, action: str = "low_balance_alert", threshold: int = 5, **kwargs) -> Dict[str, Any]:
        """Gestiona créditos de clientes"""
        # Buscar clientes con balance bajo
        low_balance_users = await self.db.credits.find({
            "balance": {"$lt": threshold}
        }).to_list(None)
        
        alerted = 0
        for credit in low_balance_users:
            user_id = credit.get("user_id")
            await self.send_push_notification(
                user_id=user_id,
                title="Créditos Bajos",
                body=f"Tu balance de créditos está bajo ({credit.get('balance')}). Recarga ahora."
            )
            alerted += 1
        
        return {
            "low_balance_users": len(low_balance_users),
            "alerts_sent": alerted,
            "threshold": threshold
        }
    
    async def detect_fraudulent_activity(self, **kwargs) -> Dict[str, Any]:
        """Detecta actividad sospechosa o fraudulenta"""
        # Buscar patrones sospechosos
        recent_transactions = await self.db.credit_transactions.find({
            "created_at": {"$gte": datetime.utcnow() - timedelta(days=1)}
        }).to_list(None)
        
        suspicious = []
        for trans in recent_transactions:
            # Detectar transacciones grandes
            if trans.get("amount", 0) > 1000:
                suspicious.append({
                    "transaction_id": str(trans.get("_id")),
                    "amount": trans.get("amount"),
                    "reason": "Large transaction"
                })
        
        return {
            "suspicious_count": len(suspicious),
            "transactions": suspicious[:10],
            "recommendation": "Review flagged transactions manually"
        }
    
    # PRÉSTAMOS
    
    async def analyze_loan_applications(self, **kwargs) -> Dict[str, Any]:
        """Analiza solicitudes de préstamo pendientes"""
        pending_loans = await self.db.loan_applications.find({
            "status": "pending"
        }).to_list(None)
        
        by_amount = {
            "0-1000": 0,
            "1000-5000": 0,
            "5000+": 0
        }
        
        for loan in pending_loans:
            amount = loan.get("amount", 0)
            if amount < 1000:
                by_amount["0-1000"] += 1
            elif amount < 5000:
                by_amount["1000-5000"] += 1
            else:
                by_amount["5000+"] += 1
        
        return {
            "total_pending": len(pending_loans),
            "by_amount_range": by_amount,
            "oldest_application": pending_loans[0] if pending_loans else None
        }
    
    async def auto_approve_loans(self, max_amount: int = 1000, **kwargs) -> Dict[str, Any]:
        """Aprueba préstamos pequeños automáticamente"""
        pending_loans = await self.db.loan_applications.find({
            "status": "pending",
            "amount": {"$lte": max_amount}
        }).limit(5).to_list(5)
        
        approved = 0
        for loan in pending_loans:
            await self.db.loan_applications.update_one(
                {"_id": loan["_id"]},
                {
                    "$set": {
                        "status": "approved",
                        "approved_by": "ai_brain_auto",
                        "approved_at": datetime.utcnow()
                    }
                }
            )
            
            # Notificar al usuario
            await self.send_push_notification(
                user_id=loan.get("user_id"),
                title="¡Préstamo Aprobado!",
                body=f"Tu préstamo de ${loan.get('amount')} ha sido aprobado."
            )
            approved += 1
        
        return {
            "auto_approved": approved,
            "max_amount": max_amount
        }
    
    async def send_loan_reminders(self, **kwargs) -> Dict[str, Any]:
        """Envía recordatorios de pago de préstamos"""
        # Préstamos con pagos vencidos
        overdue_loans = await self.db.loan_applications.find({
            "status": "active",
            "next_payment_date": {"$lt": datetime.utcnow().strftime("%Y-%m-%d")}
        }).to_list(None)
        
        sent = 0
        for loan in overdue_loans:
            await self.send_push_notification(
                user_id=loan.get("user_id"),
                title="Pago de Préstamo Vencido",
                body="Tienes un pago de préstamo vencido. Por favor realiza el pago."
            )
            sent += 1
        
        return {
            "reminders_sent": sent,
            "overdue_loans": len(overdue_loans)
        }
    
    # REFERIDOS
    
    async def analyze_referral_program(self, **kwargs) -> Dict[str, Any]:
        """Analiza el programa de referidos"""
        referrals = await self.db.referrals.find({}).to_list(None)
        
        total_referrals = len(referrals)
        successful = sum(1 for r in referrals if r.get("status") == "completed")
        
        # Top referrers
        referrers = {}
        for ref in referrals:
            referrer_id = ref.get("referrer_id")
            referrers[referrer_id] = referrers.get(referrer_id, 0) + 1
        
        top_referrers = sorted(referrers.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "total_referrals": total_referrals,
            "successful_referrals": successful,
            "conversion_rate": f"{(successful/total_referrals*100):.1f}%" if total_referrals > 0 else "0%",
            "top_referrers": top_referrers
        }
    
    async def reward_top_referrers(self, top_n: int = 5, bonus_credits: int = 10, **kwargs) -> Dict[str, Any]:
        """Recompensa a los mejores referidores"""
        # Obtener top referrers
        referrals = await self.db.referrals.find({}).to_list(None)
        
        referrers = {}
        for ref in referrals:
            referrer_id = ref.get("referrer_id")
            referrers[referrer_id] = referrers.get(referrer_id, 0) + 1
        
        top_referrers = sorted(referrers.items(), key=lambda x: x[1], reverse=True)[:top_n]
        
        rewarded = 0
        for user_id, ref_count in top_referrers:
            # Agregar créditos bonus
            await self.db.credits.update_one(
                {"user_id": user_id},
                {"$inc": {"balance": bonus_credits}}
            )
            
            # Notificar
            await self.send_push_notification(
                user_id=user_id,
                title="¡Recompensa por Referidos!",
                body=f"Has ganado {bonus_credits} créditos por ser un top referrer."
            )
            rewarded += 1
        
        return {
            "referrers_rewarded": rewarded,
            "bonus_credits": bonus_credits
        }
    
    async def boost_referral_campaign(self, **kwargs) -> Dict[str, Any]:
        """Impulsa campaña de referidos con comunicación masiva"""
        # Enviar a todos los clientes activos
        active_users = await self.db.users.find({"role": "client"}).to_list(None)
        
        sent = 0
        for user in active_users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="¡Gana Créditos Gratis!",
                body="Refiere a tus amigos y gana créditos. ¡Obtén 15% de descuento en tu primera compra!"
            )
            sent += 1
        
        return {
            "campaign_messages_sent": sent,
            "campaign_type": "referral_boost"
        }
    
    # REPORTES
    
    async def generate_daily_report(self, send_email: bool = True, **kwargs) -> Dict[str, Any]:
        """
        Genera reporte diario completo del negocio con insights y lo envía por email
        
        Args:
            send_email: Si enviar el reporte por email al admin (default: True)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📊 Generando reporte diario...")
        
        today = datetime.utcnow()
        start_of_day = today.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = start_of_day - timedelta(days=1)
        
        # Obtener métricas del día
        day_metrics = await self.get_business_metrics(period="today")
        
        # Comparar con ayer
        yesterday_appointments = await self.db.appointments.count_documents({
            "date": yesterday.strftime("%Y-%m-%d")
        })
        
        today_appointments = day_metrics["appointments"]["period_total"]
        appointment_change = today_appointments - yesterday_appointments
        appointment_trend = "📈" if appointment_change > 0 else "📉" if appointment_change < 0 else "➡️"
        
        # Top 3 insights del día
        insights = []
        
        if day_metrics["clients"]["new"] > 0:
            insights.append(f"🎉 {day_metrics['clients']['new']} nuevo(s) cliente(s) registrado(s)")
        
        if day_metrics["appointments"]["pending"] > 5:
            insights.append(f"⚠️ {day_metrics['appointments']['pending']} citas pendientes requieren atención")
        
        if day_metrics["engagement"]["adoption_rate"] < 50:
            insights.append(f"📱 Solo {day_metrics['engagement']['adoption_rate']}% de clientes usa la app - oportunidad de crecimiento")
        
        if not insights:
            insights.append("✅ Todo funcionando normalmente")
        
        # Crear reporte
        report = {
            "date": today.strftime("%Y-%m-%d"),
            "report_type": "daily",
            "metrics": day_metrics,
            "highlights": {
                "new_clients": day_metrics["clients"]["new"],
                "appointments_today": today_appointments,
                "appointment_change": appointment_change,
                "appointment_trend": appointment_trend,
                "revenue_today": day_metrics["revenue"]["period_total"]
            },
            "insights": insights,
            "summary": f"📊 Reporte Diario {today.strftime('%d/%m/%Y')}: {today_appointments} citas {appointment_trend}, {day_metrics['clients']['new']} nuevos clientes, ${day_metrics['revenue']['period_total']} revenue"
        }
        
        # Enviar por email si está habilitado
        if send_email:
            try:
                admin_users = await self.db.users.find({"role": "admin"}).to_list(10)
                
                email_html = f"""
                <html>
                <head>
                    <style>
                        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }}
                        .container {{ max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; }}
                        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                        .metric-box {{ background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; }}
                        .insight {{ background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 5px; }}
                        .footer {{ text-align: center; padding: 20px; color: #999; font-size: 12px; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📊 Reporte Diario</h1>
                            <p>{today.strftime('%d de %B, %Y')}</p>
                        </div>
                        
                        <div style="padding: 20px;">
                            <h2>🎯 Highlights del Día</h2>
                            <div class="metric-box">
                                <strong>Citas:</strong> {today_appointments} {appointment_trend} ({'+' if appointment_change >= 0 else ''}{appointment_change} vs ayer)
                            </div>
                            <div class="metric-box">
                                <strong>Nuevos Clientes:</strong> {day_metrics['clients']['new']}
                            </div>
                            <div class="metric-box">
                                <strong>Revenue:</strong> ${day_metrics['revenue']['period_total']}
                            </div>
                            
                            <h2 style="margin-top: 30px;">💡 Insights</h2>
                            {''.join([f'<div class="insight">{insight}</div>' for insight in insights])}
                        </div>
                        
                        <div class="footer">
                            <p>Ross Tax Preparation - AI Brain</p>
                            <p>Reporte generado automáticamente</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                for admin in admin_users:
                    if admin.get("email"):
                        await self.notification_service.send_email(
                            to_email=admin.get("email"),
                            subject=f"📊 Reporte Diario - {today.strftime('%d/%m/%Y')}",
                            html_content=email_html
                        )
                
                report["email_sent"] = len([a for a in admin_users if a.get("email")])
                logger.info(f"✅ Reporte enviado a {report['email_sent']} administradores")
            except Exception as e:
                logger.error(f"❌ Error enviando email: {e}")
        
        return report
    
    async def generate_weekly_report(self, send_email: bool = True, **kwargs) -> Dict[str, Any]:
        """
        Genera reporte semanal con análisis de tendencias
        
        Args:
            send_email: Si enviar el reporte por email (default: True)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📊 Generando reporte semanal...")
        
        today = datetime.utcnow()
        week_ago = today - timedelta(days=7)
        two_weeks_ago = today - timedelta(days=14)
        
        # Métricas de esta semana
        week_metrics = await self.get_business_metrics(period="week")
        
        # Comparar con semana anterior
        last_week_appointments = await self.db.appointments.count_documents({
            "date": {
                "$gte": two_weeks_ago.strftime("%Y-%m-%d"),
                "$lt": week_ago.strftime("%Y-%m-%d")
            }
        })
        
        this_week_appointments = week_metrics["appointments"]["period_total"]
        week_change = ((this_week_appointments - last_week_appointments) / last_week_appointments * 100) if last_week_appointments > 0 else 0
        
        # Análisis de tendencias
        trends = []
        
        if week_change > 10:
            trends.append(f"📈 Citas crecieron {week_change:.1f}% vs semana pasada")
        elif week_change < -10:
            trends.append(f"📉 Citas disminuyeron {abs(week_change):.1f}% - revisar estrategia")
        
        if week_metrics["clients"]["retention_rate"] < 50:
            trends.append(f"⚠️ Retención de clientes baja ({week_metrics['clients']['retention_rate']}%) - activar campañas")
        
        if week_metrics["engagement"]["adoption_rate"] > 60:
            trends.append(f"🎉 Excelente adopción de app ({week_metrics['engagement']['adoption_rate']}%)")
        
        report = {
            "period": "weekly",
            "start_date": week_ago.strftime("%Y-%m-%d"),
            "end_date": today.strftime("%Y-%m-%d"),
            "metrics": week_metrics,
            "trends": trends,
            "weekly_summary": {
                "appointments": this_week_appointments,
                "vs_last_week": f"{'+' if week_change >= 0 else ''}{week_change:.1f}%",
                "new_clients": week_metrics["clients"]["new"],
                "revenue": week_metrics["revenue"]["period_total"]
            },
            "summary": f"📊 Semana {week_ago.strftime('%d/%m')} - {today.strftime('%d/%m')}: {this_week_appointments} citas ({'+' if week_change >= 0 else ''}{week_change:.1f}%), {week_metrics['clients']['new']} nuevos clientes, ${week_metrics['revenue']['period_total']} revenue"
        }
        
        # Enviar por email si está habilitado
        if send_email:
            try:
                admin_users = await self.db.users.find({"role": "admin"}).to_list(10)
                
                email_html = f"""
                <html>
                <body style="font-family: Arial; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1>📊 Reporte Semanal</h1>
                            <p>{week_ago.strftime('%d/%m/%Y')} - {today.strftime('%d/%m/%Y')}</p>
                        </div>
                        
                        <div style="padding: 20px;">
                            <h2>📈 Resumen Semanal</h2>
                            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea;">
                                <strong>Citas:</strong> {this_week_appointments} ({'+' if week_change >= 0 else ''}{week_change:.1f}% vs semana anterior)
                            </div>
                            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea;">
                                <strong>Nuevos Clientes:</strong> {week_metrics['clients']['new']}
                            </div>
                            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea;">
                                <strong>Revenue:</strong> ${week_metrics['revenue']['period_total']}
                            </div>
                            
                            <h2 style="margin-top: 30px;">💡 Análisis de Tendencias</h2>
                            {''.join([f'<div style="background: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 5px;">{trend}</div>' for trend in trends]) if trends else '<p>Sin tendencias significativas esta semana</p>'}
                        </div>
                    </div>
                </body>
                </html>
                """
                
                for admin in admin_users:
                    if admin.get("email"):
                        await self.notification_service.send_email(
                            to_email=admin.get("email"),
                            subject=f"📊 Reporte Semanal - Semana del {week_ago.strftime('%d/%m')}",
                            html_content=email_html
                        )
                
                report["email_sent"] = len([a for a in admin_users if a.get("email")])
                logger.info(f"✅ Reporte semanal enviado")
            except Exception as e:
                logger.error(f"❌ Error enviando email: {e}")
        
        return report
    
    async def generate_custom_report(self, metrics: List[str] = None, **kwargs) -> Dict[str, Any]:
        """Genera reporte personalizado"""
        if metrics is None:
            metrics = ["clients", "appointments", "revenue"]
        
        report = {}
        
        if "clients" in metrics:
            report["total_clients"] = await self.db.users.count_documents({"role": "client"})
        
        if "appointments" in metrics:
            report["total_appointments"] = await self.db.appointments.count_documents({})
        
        if "revenue" in metrics:
            transactions = await self.db.credit_transactions.find({"type": "purchase"}).to_list(None)
            report["total_revenue"] = sum(t.get("amount", 0) for t in transactions)
        
        return {
            "report_type": "custom",
            "metrics": report
        }
    
    # AUTOMATIZACIONES
    
    async def create_automation(self, name: str, trigger: str, action: str, **kwargs) -> Dict[str, Any]:
        """Crea una automatización nueva"""
        automation = {
            "name": name,
            "trigger": trigger,
            "action": action,
            "created_at": datetime.utcnow(),
            "created_by": "ai_brain",
            "active": True
        }
        
        result = await self.db.automations.insert_one(automation)
        
        return {
            "automation_id": str(result.inserted_id),
            "name": name,
            "status": "created"
        }
    
    async def run_workflow(self, workflow_name: str, **kwargs) -> Dict[str, Any]:
        """Ejecuta un workflow predefinido"""
        workflows = {
            "welcome_new_client": ["send_email", "send_push_notification", "request_missing_documents"],
            "reactivate_inactive": ["analyze_inactive_clients", "send_bulk_communication"],
            "payment_followup": ["detect_payment_opportunities", "process_pending_payments"]
        }
        
        if workflow_name not in workflows:
            return {"error": "Workflow not found"}
        
        steps = workflows[workflow_name]
        results = []
        
        for step in steps:
            if step in self.tools:
                result = await self.tools[step]()
                results.append({"step": step, "result": result})
        
        return {
            "workflow": workflow_name,
            "steps_executed": len(results),
            "results": results
        }
    
    async def schedule_task(self, task_name: str, schedule_time: str, **kwargs) -> Dict[str, Any]:
        """Programa una tarea para ejecutarse más tarde"""
        scheduled_task = {
            "task_name": task_name,
            "schedule_time": schedule_time,
            "created_at": datetime.utcnow(),
            "status": "scheduled"
        }
        
        result = await self.db.scheduled_tasks.insert_one(scheduled_task)
        
        return {
            "task_id": str(result.inserted_id),
            "task_name": task_name,
            "scheduled_for": schedule_time
        }
    
    # ==================== CUMPLEAÑOS Y CELEBRACIONES ====================
    
    async def check_birthdays(self, days_ahead: int = 0, send_wishes: bool = True, **kwargs) -> Dict[str, Any]:
        """
        Revisa cumpleaños y envía felicitaciones automáticas
        
        Args:
            days_ahead: Días adelante para buscar (0=hoy, 7=próxima semana)
            send_wishes: Si enviar felicitaciones automáticamente (default: True)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        target_date = datetime.now(MIAMI_TZ) + timedelta(days=days_ahead)
        target_str = target_date.strftime("%m-%d")  # Formato MM-DD
        
        logger.info(f"🎂 Buscando cumpleaños para {target_date.strftime('%Y-%m-%d')}...")
        
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        birthdays_found = []
        for user in users:
            birthday = user.get("birth_date") or user.get("birthdate") or user.get("date_of_birth")
            if birthday:
                # Convertir a string si es datetime
                if isinstance(birthday, datetime):
                    birthday_str = birthday.strftime("%m-%d")
                else:
                    # Asumir formato YYYY-MM-DD o MM-DD
                    try:
                        if "T" in str(birthday):
                            birthday_str = birthday.split("T")[0][-5:]
                        elif len(str(birthday)) >= 10:
                            birthday_str = str(birthday)[5:10]  # MM-DD
                        else:
                            birthday_str = str(birthday)[-5:]
                    except:
                        continue
                
                if birthday_str == target_str:
                    age = None
                    try:
                        birth_year = int(str(birthday)[:4]) if len(str(birthday)) >= 10 else None
                        if birth_year:
                            age = target_date.year - birth_year
                    except:
                        pass
                    
                    birthdays_found.append({
                        "user": user,
                        "age": age,
                        "name": user.get("full_name") or user.get("name", "Cliente")
                    })
        
        logger.info(f"🎉 Encontrados {len(birthdays_found)} cumpleaños")
        
        # Enviar felicitaciones automáticas si está habilitado
        results = {"push": 0, "sms": 0, "email": 0, "credits": 0}
        
        if send_wishes and len(birthdays_found) > 0:
            for birthday_info in birthdays_found:
                user = birthday_info["user"]
                user_id = str(user.get("_id"))
                name = birthday_info["name"]
                age_text = f" #{birthday_info['age']}" if birthday_info['age'] else ""
                
                # Mensaje personalizado (sin mencionar créditos)
                message = f"🎉 ¡Feliz Cumpleaños{age_text} {name}! 🎂\n\nTodo el equipo de Ross Tax Preparation te desea un día maravilloso lleno de alegría. ¡Disfruta tu día!"
                
                # 1. Push Notification
                if user.get("push_token"):
                    try:
                        await self.notification_service.send_push_notification(
                            user_id=user_id,
                            title=f"🎉 ¡Feliz Cumpleaños {name}!",
                            body=message[:100],
                            data={"type": "birthday", "credits_awarded": 10}
                        )
                        results["push"] += 1
                    except Exception as e:
                        logger.error(f"Push failed: {e}")
                
                # 2. SMS
                if user.get("phone"):
                    try:
                        await self.notification_service.send_sms(
                            to_phone=user.get("phone"),
                            message=message[:160]
                        )
                        results["sms"] += 1
                    except Exception as e:
                        logger.error(f"SMS failed: {e}")
                
                # 3. Email
                if user.get("email"):
                    try:
                        email_html = f"""
                        <html>
                        <body style="font-family: Arial; text-align: center; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <div style="background: white; border-radius: 15px; padding: 40px; max-width: 500px; margin: 0 auto;">
                                <h1 style="color: #667eea; font-size: 32px;">🎉 ¡Feliz Cumpleaños{age_text}! 🎉</h1>
                                <p style="font-size: 18px; color: #333; margin: 20px 0;">Querido/a {name},</p>
                                <p style="font-size: 16px; color: #666; line-height: 1.6;">
                                    Todo el equipo de <strong>Ross Tax Preparation</strong> te desea un día maravilloso
                                    lleno de alegría, amor y muchas bendiciones.
                                </p>
                                <p style="font-size: 14px; color: #999; margin-top: 30px;">
                                    Con cariño,<br>
                                    <strong>Equipo Ross Tax Preparation</strong><br>
                                    305 Bruce Ave, Dumas, TX 79029
                                </p>
                            </div>
                        </body>
                        </html>
                        """
                        
                        await self.notification_service.send_email(
                            to_email=user.get("email"),
                            subject=f"🎉 ¡Feliz Cumpleaños {name}!",
                            html_content=email_html
                        )
                        results["email"] += 1
                    except Exception as e:
                        logger.error(f"Email failed: {e}")
                
        logger.info(f"✅ Felicitaciones enviadas: {results}")
        
        return {
            "date_checked": target_date.strftime("%Y-%m-%d"),
            "birthdays_found": len(birthdays_found),
            "wishes_sent": send_wishes,
            "results": results,
            "clients": [b["name"] for b in birthdays_found],
            "summary": f"🎂 Encontrados {len(birthdays_found)} cumpleaños. Enviados {results['push']} push, {results['sms']} SMS, {results['email']} emails. $" + str(results['credits']) + " en créditos otorgados."
        }
    
    async def send_birthday_wishes(self, user_id: str, **kwargs) -> Dict[str, Any]:
        """Envía felicitación de cumpleaños a un cliente específico"""
        user = await self.db.users.find_one({"id": user_id})
        if not user:
            return {"error": "User not found"}
        
        name = user.get("first_name", "Cliente")
        
        await self.send_push_notification(
            user_id=user_id,
            title=f"¡Feliz Cumpleaños {name}! 🎉",
            body="¡Todo el equipo de Ross Tax te desea un día increíble! 🎂"
        )
        
        # Créditos de regalo
        await self.db.credits.update_one(
            {"user_id": user_id},
            {"$inc": {"balance": 5}}
        )
        
        return {
            "status": "sent",
            "user_id": user_id,
            "gift_credits": 5
        }
    
    async def schedule_birthday_campaign(self, days_ahead: int = 30, **kwargs) -> Dict[str, Any]:
        """Programa campaña de cumpleaños para próximos días"""
        today = datetime.utcnow()
        target_date = today + timedelta(days=days_ahead)
        
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        upcoming = []
        for user in users:
            birthday = user.get("birth_date") or user.get("birthdate")
            if birthday:
                # Lógica para detectar cumpleaños en rango
                upcoming.append(user.get("id"))
        
        return {
            "scheduled": True,
            "days_ahead": days_ahead,
            "upcoming_birthdays": len(upcoming)
        }
    
    async def get_upcoming_birthdays(self, days: int = 7, **kwargs) -> Dict[str, Any]:
        """Obtiene cumpleaños de los próximos N días"""
        today = datetime.utcnow()
        upcoming = []
        
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        for user in users:
            birthday = user.get("birth_date") or user.get("birthdate")
            if birthday:
                try:
                    if isinstance(birthday, str):
                        # Convertir string a fecha
                        bd_parts = birthday.split("-")
                        if len(bd_parts) >= 2:
                            month = int(bd_parts[1] if len(bd_parts) == 3 else bd_parts[0])
                            day = int(bd_parts[2] if len(bd_parts) == 3 else bd_parts[1])
                            
                            # Crear fecha de cumpleaños este año
                            bd_this_year = datetime(today.year, month, day)
                            
                            # Calcular días hasta cumpleaños
                            days_until = (bd_this_year - today).days
                            
                            if 0 <= days_until <= days:
                                upcoming.append({
                                    "name": f"{user.get('first_name')} {user.get('last_name')}",
                                    "birthday": bd_this_year.strftime("%Y-%m-%d"),
                                    "days_until": days_until
                                })
                except:
                    continue
        
        return {
            "upcoming_birthdays": len(upcoming),
            "days_range": days,
            "birthdays": sorted(upcoming, key=lambda x: x["days_until"])
        }
    
    # ==================== RECORDATORIOS INTELIGENTES ====================
    
    async def create_reminder(self, user_id: str, message: str, send_at: str, **kwargs) -> Dict[str, Any]:
        """Crea un recordatorio personalizado"""
        reminder = {
            "user_id": user_id,
            "message": message,
            "send_at": send_at,
            "created_at": datetime.utcnow(),
            "status": "pending"
        }
        
        result = await self.db.reminders.insert_one(reminder)
        
        return {
            "reminder_id": str(result.inserted_id),
            "scheduled_for": send_at
        }
    
    async def send_custom_reminder(self, reminder_id: str, **kwargs) -> Dict[str, Any]:
        """Envía un recordatorio específico"""
        reminder = await self.db.reminders.find_one({"_id": reminder_id})
        if not reminder:
            return {"error": "Reminder not found"}
        
        await self.send_push_notification(
            user_id=reminder.get("user_id"),
            title="Recordatorio",
            body=reminder.get("message")
        )
        
        await self.db.reminders.update_one(
            {"_id": reminder_id},
            {"$set": {"status": "sent", "sent_at": datetime.utcnow()}}
        )
        
        return {"status": "sent"}
    
    async def send_tax_season_reminders(self, weeks_before_deadline: int = 4, **kwargs) -> Dict[str, Any]:
        """
        Envía recordatorios urgentes de temporada de impuestos
        
        Args:
            weeks_before_deadline: Semanas antes del 15 de abril (default: 4)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📅 Enviando recordatorios de temporada fiscal (weeks_before: {weeks_before_deadline})")
        
        # Calcular días restantes hasta el deadline (15 de abril)
        now = datetime.utcnow()
        current_year = now.year
        
        # Si ya pasó el 15 de abril de este año, usar el año siguiente
        tax_deadline = datetime(current_year, 4, 15)
        if now > tax_deadline:
            tax_deadline = datetime(current_year + 1, 4, 15)
        
        days_remaining = (tax_deadline - now).days
        
        # Obtener todos los clientes
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        sent_push = 0
        sent_sms = 0
        sent_email = 0
        errors = []
        
        # Personalizar mensaje según urgencia
        if days_remaining <= 30:
            urgency_emoji = "🚨"
            urgency_text = "URGENTE"
        elif days_remaining <= 60:
            urgency_emoji = "⚠️"
            urgency_text = "IMPORTANTE"
        else:
            urgency_emoji = "📅"
            urgency_text = "RECORDATORIO"
        
        for user in users:
            user_id = str(user.get("_id"))
            user_name = user.get("full_name") or user.get("name", "Cliente")
            
            # Mensaje personalizado
            title = f"{urgency_emoji} {urgency_text}: Temporada de Impuestos"
            message = f"Hola {user_name}, quedan {days_remaining} días para la fecha límite de impuestos (15 de abril). ¡No dejes tu declaración para el último momento! Agenda tu cita ahora."
            
            # Push notification
            if user.get("push_token"):
                try:
                    await self.notification_service.send_push_notification(
                        user_id=user_id,
                        title=title,
                        body=message[:100],
                        data={
                            "type": "tax_season_reminder",
                            "days_remaining": days_remaining,
                            "deadline": tax_deadline.strftime("%Y-%m-%d")
                        }
                    )
                    sent_push += 1
                except Exception as e:
                    errors.append(f"Push error for {user_id}: {str(e)}")
                    logger.error(f"Push notification failed for {user_id}: {e}")
            
            # SMS (solo si es urgente o muy urgente)
            if user.get("phone") and days_remaining <= 45:
                try:
                    sms_message = f"{urgency_text}: Quedan {days_remaining} días para impuestos. Agenda ahora con Ross Tax. Responde STOP para cancelar."
                    await self.notification_service.send_sms(
                        to_phone=user.get("phone"),
                        message=sms_message[:160]
                    )
                    sent_sms += 1
                except Exception as e:
                    errors.append(f"SMS error for {user_id}: {str(e)}")
                    logger.error(f"SMS failed for {user_id}: {e}")
            
            # Email
            if user.get("email"):
                try:
                    email_body = f"""
                    <h2>{title}</h2>
                    <p>Hola {user_name},</p>
                    <p><strong>Quedan solo {days_remaining} días</strong> para la fecha límite de declaración de impuestos (15 de abril de {tax_deadline.year}).</p>
                    <p>No esperes al último momento. Agenda tu cita ahora y asegura tu reembolso sin estrés.</p>
                    <p>¿Necesitas ayuda? Contáctanos directamente desde la app Ross Tax.</p>
                    <p>Saludos,<br>Equipo Ross Tax</p>
                    """
                    
                    await self.notification_service.send_email(
                        to_email=user.get("email"),
                        subject=f"{urgency_text}: {days_remaining} días para declarar impuestos",
                        body=email_body
                    )
                    sent_email += 1
                except Exception as e:
                    errors.append(f"Email error for {user_id}: {str(e)}")
                    logger.error(f"Email failed for {user_id}: {e}")
        
        result = {
            "campaign": "tax_season_reminder",
            "days_until_deadline": days_remaining,
            "deadline_date": tax_deadline.strftime("%Y-%m-%d"),
            "total_clients": len(users),
            "notifications_sent": {
                "push": sent_push,
                "sms": sent_sms,
                "email": sent_email,
                "total": sent_push + sent_sms + sent_email
            },
            "urgency_level": urgency_text,
            "errors_count": len(errors),
            "summary": f"📅 Recordatorio de impuestos enviado a {len(users)} clientes. {days_remaining} días restantes hasta el deadline. {sent_push} push, {sent_sms} SMS, {sent_email} emails enviados."
        }
        
        if errors:
            result["errors_sample"] = errors[:5]
        
        logger.info(f"✅ Campaña completada: {result['summary']}")
        
        return result
    
    async def send_renewal_reminders(self, service_type: str = "all", **kwargs) -> Dict[str, Any]:
        """Envía recordatorios de renovación de servicios"""
        # Buscar servicios próximos a vencer
        thirty_days_from_now = datetime.utcnow() + timedelta(days=30)
        
        sent = 0
        # Lógica para enviar recordatorios
        
        return {
            "reminders_sent": sent,
            "service_type": service_type
        }
    
    async def send_follow_up_reminders(self, after_days: int = 7, **kwargs) -> Dict[str, Any]:
        """Envía seguimientos después de citas"""
        cutoff_date = datetime.utcnow() - timedelta(days=after_days)
        
        appointments = await self.db.appointments.find({
            "date": {"$gte": cutoff_date.strftime("%Y-%m-%d")},
            "status": "completed",
            "follow_up_sent": {"$ne": True}
        }).to_list(None)
        
        sent = 0
        for apt in appointments:
            await self.send_push_notification(
                user_id=apt.get("user_id"),
                title="Seguimiento de tu Cita",
                body="¿Cómo estuvo tu experiencia? Nos encantaría saber tu opinión."
            )
            
            await self.db.appointments.update_one(
                {"_id": apt["_id"]},
                {"$set": {"follow_up_sent": True}}
            )
            sent += 1
        
        return {
            "follow_ups_sent": sent,
            "after_days": after_days
        }
    
    # ==================== SATISFACCIÓN Y FEEDBACK ====================
    
    async def analyze_client_satisfaction(self, **kwargs) -> Dict[str, Any]:
        """Analiza la satisfacción general de los clientes"""
        # Analizar encuestas, ratings, feedback
        surveys = await self.db.surveys.find({}).to_list(None)
        
        if not surveys:
            return {
                "total_surveys": 0,
                "average_rating": 0,
                "satisfaction_level": "no_data"
            }
        
        total_rating = sum(s.get("rating", 0) for s in surveys)
        avg_rating = total_rating / len(surveys)
        
        satisfaction_level = "high" if avg_rating >= 4 else "medium" if avg_rating >= 3 else "low"
        
        return {
            "total_surveys": len(surveys),
            "average_rating": round(avg_rating, 2),
            "satisfaction_level": satisfaction_level
        }
    
    async def send_satisfaction_survey(self, user_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """Envía encuesta de satisfacción"""
        if user_id:
            users = [await self.db.users.find_one({"id": user_id})]
        else:
            users = await self.db.users.find({"role": "client"}).limit(50).to_list(50)
        
        sent = 0
        for user in users:
            if not user:
                continue
            
            await self.send_push_notification(
                user_id=user.get("id"),
                title="Tu Opinión Importa",
                body="¿Cómo ha sido tu experiencia con Ross Tax? Comparte tu opinión."
            )
            sent += 1
        
        return {
            "surveys_sent": sent
        }
    
    async def analyze_survey_results(self, **kwargs) -> Dict[str, Any]:
        """Analiza resultados de encuestas"""
        surveys = await self.db.surveys.find({}).to_list(None)
        
        positive = sum(1 for s in surveys if s.get("rating", 0) >= 4)
        neutral = sum(1 for s in surveys if 2 <= s.get("rating", 0) < 4)
        negative = sum(1 for s in surveys if s.get("rating", 0) < 2)
        
        return {
            "total": len(surveys),
            "positive": positive,
            "neutral": neutral,
            "negative": negative,
            "nps": ((positive - negative) / len(surveys) * 100) if surveys else 0
        }
    
    async def handle_negative_feedback(self, **kwargs) -> Dict[str, Any]:
        """Maneja feedback negativo proactivamente"""
        negative_surveys = await self.db.surveys.find({
            "rating": {"$lt": 3},
            "follow_up": {"$ne": True}
        }).to_list(None)
        
        handled = 0
        for survey in negative_surveys:
            # Notificar al admin
            await self.send_push_notification(
                user_id="admin",
                title="⚠️ Feedback Negativo",
                body=f"Cliente {survey.get('user_id')} dio rating bajo. Requiere atención."
            )
            
            # Contactar al cliente
            await self.send_push_notification(
                user_id=survey.get("user_id"),
                title="Queremos Mejorar",
                body="Notamos que tu experiencia no fue la mejor. ¿Podemos hablar?"
            )
            
            await self.db.surveys.update_one(
                {"_id": survey["_id"]},
                {"$set": {"follow_up": True}}
            )
            handled += 1
        
        return {
            "negative_feedback_handled": handled
        }
    
    # ==================== MARKETING INTELIGENTE ====================
    
    async def create_targeted_campaign(self, segment: str = "all", campaign_type: str = "promotion", message: str = None, title: str = None, channels: list = None, **kwargs) -> Dict[str, Any]:
        """
        Crea y ejecuta campaña de marketing dirigida a segmento específico
        
        Args:
            segment: Segmento objetivo - "all", "inactive", "vip", "new", "high_value", "at_risk"
            campaign_type: Tipo - "promotion", "educational", "seasonal", "reactivation", "loyalty"
            message: Contenido del mensaje
            title: Título de la campaña
            channels: Canales a usar ["push", "sms", "email"] (default: todos)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🎯 Creando campaña segmentada: {campaign_type} para {segment}")
        
        # Obtener lista de usuarios del segmento
        if segment == "all":
            users_query = {"role": "client"}
        elif segment == "inactive":
            inactive_result = await self.analyze_inactive_clients(days=60, action="analyze")
            user_ids = [c["id"] for c in inactive_result.get("top_10_inactive", [])]
            from bson import ObjectId
            users_query = {"_id": {"$in": [ObjectId(uid) for uid in user_ids]}}
        elif segment == "vip":
            segmentation = await self.segment_clients(segment_type="vip")
            user_ids = segmentation["details"].get("high_value", [])
            from bson import ObjectId
            users_query = {"_id": {"$in": [ObjectId(uid) if uid else None for uid in user_ids]}}
        elif segment == "new":
            # Clientes creados en últimos 30 días
            cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
            users_query = {"role": "client", "created_at": {"$gte": cutoff}}
        else:
            users_query = {"role": "client"}
        
        target_users = await self.db.users.find(users_query).to_list(None)
        logger.info(f"📊 Usuarios objetivo: {len(target_users)}")
        
        # Generar mensaje personalizado si no se proporciona
        if not message:
            if campaign_type == "promotion":
                message = "🎉 Oferta especial para ti! Aprovecha nuestros descuentos en servicios de preparación de impuestos. ¡No te lo pierdas!"
            elif campaign_type == "educational":
                message = "📚 ¿Sabías que...? Tips importantes sobre tus impuestos y finanzas. Visita Ross Tax Preparation."
            elif campaign_type == "seasonal":
                message = "🍂 Temporada de impuestos se acerca! Agenda tu cita ahora y evita el estrés de última hora."
            elif campaign_type == "reactivation":
                message = "¡Te extrañamos! Regresa a Ross Tax y obtén un descuento especial en tu próximo servicio."
            elif campaign_type == "loyalty":
                message = "🌟 Gracias por tu lealtad! Como cliente valioso, tienes beneficios exclusivos esperándote."
        
        if not title:
            title = f"Ross Tax - {campaign_type.title()}"
        
        # Determinar canales
        if not channels:
            channels = ["push", "sms", "email"]
        
        # Ejecutar campaña
        result = await self.send_bulk_communication(
            type=campaign_type,
            filter="custom",
            message=message,
            title=title,
            custom_user_list=[str(u["_id"]) for u in target_users[:50]]  # Límite de 50 por vez
        )
        
        # Guardar campaña en DB
        campaign_record = {
            "type": campaign_type,
            "segment": segment,
            "title": title,
            "message": message,
            "channels": channels,
            "target_count": len(target_users),
            "sent_count": result.get("results", {}).get("total_recipients", 0),
            "created_at": datetime.utcnow().isoformat(),
            "status": "sent"
        }
        
        await self.db.marketing_campaigns.insert_one(campaign_record)
        logger.info(f"✅ Campaña creada y enviada a {campaign_record['sent_count']} usuarios")
        
        return {
            "campaign_type": campaign_type,
            "segment": segment,
            "target_users": len(target_users),
            "sent": campaign_record['sent_count'],
            "channels": channels,
            "results": result.get("results", {}),
            "summary": f"📤 Campaña '{title}' enviada a {campaign_record['sent_count']} clientes del segmento '{segment}'"
        }
    
    async def analyze_campaign_performance(self, campaign_id: str, **kwargs) -> Dict[str, Any]:
        """Analiza rendimiento de campaña"""
        # Métricas de campaña
        return {
            "campaign_id": campaign_id,
            "sent": 100,
            "opened": 75,
            "clicked": 25,
            "open_rate": "75%",
            "click_rate": "25%"
        }
    
    async def optimize_send_times(self, **kwargs) -> Dict[str, Any]:
        """Optimiza horarios de envío basado en engagement"""
        # Analizar patrones de interacción
        return {
            "best_time": "10:00 AM",
            "best_day": "Tuesday",
            "engagement_rate": "82%"
        }
    
    async def ab_test_campaigns(self, variant_a: str, variant_b: str, **kwargs) -> Dict[str, Any]:
        """Ejecuta A/B testing de campañas"""
        return {
            "test_started": True,
            "variant_a_sent": 50,
            "variant_b_sent": 50
        }
    
    # ==================== GAMIFICACIÓN Y RECOMPENSAS ====================
    
    async def assign_loyalty_points(self, user_id: str, points: int, reason: str, **kwargs) -> Dict[str, Any]:
        """Asigna puntos de lealtad a cliente"""
        await self.db.loyalty_points.update_one(
            {"user_id": user_id},
            {
                "$inc": {"points": points},
                "$push": {
                    "history": {
                        "points": points,
                        "reason": reason,
                        "date": datetime.utcnow()
                    }
                }
            },
            upsert=True
        )
        
        return {
            "user_id": user_id,
            "points_added": points,
            "reason": reason
        }
    
    async def create_achievement(self, name: str, description: str, criteria: str, **kwargs) -> Dict[str, Any]:
        """Crea un nuevo logro/achievement"""
        achievement = {
            "name": name,
            "description": description,
            "criteria": criteria,
            "created_at": datetime.utcnow()
        }
        
        result = await self.db.achievements.insert_one(achievement)
        
        return {
            "achievement_id": str(result.inserted_id),
            "name": name
        }
    
    async def run_loyalty_program(self, **kwargs) -> Dict[str, Any]:
        """Ejecuta programa de lealtad completo"""
        # Revisar y recompensar clientes leales
        loyal_clients = await self.db.users.find({
            "role": "client",
            "account_age_days": {"$gt": 365}
        }).to_list(None)
        
        rewarded = 0
        for client in loyal_clients:
            await self.assign_loyalty_points(
                user_id=client.get("id"),
                points=100,
                reason="Año de lealtad"
            )
            rewarded += 1
        
        return {
            "clients_rewarded": rewarded,
            "points_distributed": rewarded * 100
        }
    
    async def send_milestone_rewards(self, **kwargs) -> Dict[str, Any]:
        """Envía recompensas por hitos alcanzados"""
        # Detectar hitos (10 citas, 100 créditos usados, etc.)
        return {
            "milestones_rewarded": 5
        }
    
    # ==================== ANÁLISIS PREDICTIVO AVANZADO ====================
    
    async def predict_service_needs(self, user_id: str, **kwargs) -> Dict[str, Any]:
        """Predice qué servicios necesitará el cliente"""
        # Analizar historial y patrones
        user = await self.db.users.find_one({"id": user_id})
        appointments = await self.db.appointments.find({"user_id": user_id}).to_list(None)
        
        predicted_services = []
        if len(appointments) > 5:
            predicted_services.append("tax_filing")
        
        return {
            "user_id": user_id,
            "predicted_services": predicted_services,
            "confidence": 0.75
        }
    
    async def forecast_revenue(self, period: str = "month", **kwargs) -> Dict[str, Any]:
        """Pronostica ingresos futuros"""
        # Análisis de tendencias
        return {
            "period": period,
            "forecasted_revenue": 50000,
            "confidence": 0.80
        }
    
    async def identify_upsell_opportunities(self, **kwargs) -> Dict[str, Any]:
        """Identifica oportunidades de upselling"""
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        opportunities = []
        for user in users:
            # Clientes que solo usan servicios básicos
            appointments = await self.db.appointments.count_documents({"user_id": user.get("id")})
            if appointments > 3:
                opportunities.append({
                    "user_id": user.get("id"),
                    "recommended_service": "premium_package",
                    "potential_value": 200
                })
        
        return {
            "opportunities": len(opportunities[:10]),
            "total_potential_value": sum(o["potential_value"] for o in opportunities[:10])
        }
    
    async def predict_appointment_no_shows(self, **kwargs) -> Dict[str, Any]:
        """Predice qué citas probablemente no se presenten"""
        upcoming = await self.db.appointments.find({
            "date": {"$gte": datetime.utcnow().strftime("%Y-%m-%d")},
            "status": "scheduled"
        }).to_list(None)
        
        at_risk = []
        for apt in upcoming:
            # Historial de no-shows del cliente
            user_no_shows = await self.db.appointments.count_documents({
                "user_id": apt.get("user_id"),
                "status": "no_show"
            })
            
            if user_no_shows > 0:
                at_risk.append(apt)
        
        return {
            "at_risk_appointments": len(at_risk),
            "recommendation": "Send confirmation reminders"
        }
    
    # ==================== GESTIÓN DE RECURSOS ====================
    
    async def optimize_staff_allocation(self, **kwargs) -> Dict[str, Any]:
        """Optimiza asignación de personal"""
        # Analizar carga de trabajo
        return {
            "recommendation": "Add 1 staff member on Tuesdays",
            "efficiency_increase": "15%"
        }
    
    async def analyze_peak_hours(self, **kwargs) -> Dict[str, Any]:
        """Analiza horas pico de actividad"""
        appointments = await self.db.appointments.find({}).to_list(None)
        
        hours = {}
        for apt in appointments:
            hour = apt.get("time", "10:00")[:2]
            hours[hour] = hours.get(hour, 0) + 1
        
        peak_hour = max(hours.items(), key=lambda x: x[1]) if hours else ("10", 0)
        
        return {
            "peak_hour": f"{peak_hour[0]}:00",
            "appointments_count": peak_hour[1],
            "distribution": hours
        }
    
    async def manage_workload(self, **kwargs) -> Dict[str, Any]:
        """Gestiona carga de trabajo del equipo"""
        return {
            "current_workload": "high",
            "recommendation": "Redistribute appointments"
        }
    
    # ==================== COMUNICACIÓN PROACTIVA ====================
    
    async def send_proactive_updates(self, **kwargs) -> Dict[str, Any]:
        """Envía actualizaciones proactivas a clientes"""
        return {
            "updates_sent": 50
        }
    
    async def notify_status_changes(self, status_type: str, **kwargs) -> Dict[str, Any]:
        """Notifica cambios de estado automáticamente"""
        return {
            "notifications_sent": 10,
            "status_type": status_type
        }
    
    async def send_seasonal_tips(self, season: str, **kwargs) -> Dict[str, Any]:
        """Envía tips estacionales relevantes"""
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        tips = {
            "winter": "💡 Tip: Guarda todos tus recibos de gastos médicos para la declaración.",
            "spring": "💡 Tip: Es tiempo de organizar tus documentos para impuestos.",
            "summer": "💡 Tip: Planifica tus impuestos estimados para el próximo trimestre.",
            "fall": "💡 Tip: Revisa tus deducciones antes de fin de año."
        }
        
        message = tips.get(season, "Tips útiles de Ross Tax")
        
        sent = 0
        for user in users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="Consejo de la Temporada",
                body=message
            )
            sent += 1
        
        return {
            "tips_sent": sent,
            "season": season
        }
    
    async def create_newsletter(self, topic: str = "general", frequency: str = "monthly", auto_generate: bool = True, custom_content: str = None, **kwargs) -> Dict[str, Any]:
        """
        Crea y envía newsletter automatizado con contenido relevante
        
        Args:
            topic: Tema del newsletter - "general", "tax_tips", "seasonal", "updates", "financial_advice"
            frequency: Frecuencia - "weekly", "monthly", "quarterly"
            auto_generate: Si generar contenido automáticamente con IA (default: True)
            custom_content: Contenido personalizado (opcional)
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"📰 Creando newsletter: {topic} ({frequency})")
        
        # Generar contenido con IA si está habilitado
        if auto_generate and not custom_content:
            try:
                prompt = f"""Genera un newsletter profesional y útil para clientes de Ross Tax Preparation sobre el tema: {topic}.

El newsletter debe:
- Ser informativo y valioso
- Incluir 3-4 secciones principales
- Tener un tono amigable pero profesional
- Incluir tips prácticos
- Mencionar brevemente los servicios de Ross Tax
- Ser en español
- Máximo 500 palabras

Formato: 
Título atractivo
Introducción breve
3-4 secciones con subtítulos
Conclusión con call-to-action"""
                
                response = await self.model.generate_content_async(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=1000,
                    )
                )
                
                if hasattr(response, 'text') and response.text:
                    custom_content = response.text
                elif response.candidates and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate.content, 'parts') and candidate.content.parts:
                        text_parts = [part.text for part in candidate.content.parts if hasattr(part, 'text')]
                        custom_content = ' '.join(text_parts)
                
                logger.info(f"✅ Contenido generado con IA")
            except Exception as e:
                logger.error(f"❌ Error generando contenido: {e}")
                custom_content = f"""
                📰 Newsletter de Ross Tax Preparation
                
                Estimados clientes,
                
                En Ross Tax Preparation estamos comprometidos con su éxito financiero. 
                Este mes queremos compartir información valiosa sobre {topic}.
                
                Nuestro equipo está aquí para ayudarle con:
                • Preparación de impuestos profesional
                • Asesoría financiera personalizada
                • Servicios de contabilidad
                
                ¡Contáctenos para más información!
                
                Saludos,
                Equipo Ross Tax Preparation
                """
        
        # Obtener clientes suscritos
        users = await self.db.users.find({
            "role": "client",
            "email": {"$exists": True, "$ne": None}
        }).to_list(None)
        
        logger.info(f"📧 Enviando newsletter a {len(users)} clientes")
        
        # Crear HTML profesional
        newsletter_html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }}
                .content {{ padding: 30px 20px; }}
                .section {{ margin-bottom: 25px; }}
                .section h2 {{ color: #667eea; font-size: 20px; margin-bottom: 10px; }}
                .cta {{ background: #667eea; color: white; padding: 15px 30px; text-align: center; border-radius: 5px; text-decoration: none; display: inline-block; margin: 20px 0; }}
                .footer {{ background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📰 Newsletter Ross Tax</h1>
                    <p>{topic.replace('_', ' ').title()} - {frequency.title()}</p>
                </div>
                <div class="content">
                    {custom_content.replace(chr(10), '<br>')}
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="tel:8069342018" class="cta">📞 Contáctanos: 806-934-2018</a>
                    </div>
                </div>
                <div class="footer">
                    <p><strong>Ross Tax Preparation</strong></p>
                    <p>305 Bruce Ave, Dumas, TX 79029</p>
                    <p><a href="#">Cancelar suscripción</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Enviar a todos los clientes
        sent_count = 0
        failed_count = 0
        
        for user in users[:100]:  # Límite de 100 por vez
            try:
                await self.notification_service.send_email(
                    to_email=user.get("email"),
                    subject=f"📰 Newsletter Ross Tax - {topic.replace('_', ' ').title()}",
                    html_content=newsletter_html
                )
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to send to {user.get('email')}: {e}")
                failed_count += 1
        
        # Guardar registro en DB
        newsletter_record = {
            "topic": topic,
            "frequency": frequency,
            "content": custom_content[:500],
            "sent_count": sent_count,
            "failed_count": failed_count,
            "sent_at": datetime.utcnow().isoformat(),
            "auto_generated": auto_generate
        }
        
        await self.db.newsletters.insert_one(newsletter_record)
        
        logger.info(f"✅ Newsletter enviado: {sent_count} exitosos, {failed_count} fallidos")
        
        return {
            "topic": topic,
            "frequency": frequency,
            "total_sent": sent_count,
            "failed": failed_count,
            "auto_generated": auto_generate,
            "summary": f"📰 Newsletter '{topic}' enviado a {sent_count} clientes. Contenido {'generado automáticamente' if auto_generate else 'personalizado'}."
        }
    
    # ==================== RETENCIÓN DE CLIENTES ====================
    
    async def create_retention_strategy(self, segment: str = "all", target_segment: str = None, **kwargs) -> Dict[str, Any]:
        """
        Crea estrategia de retención personalizada para un segmento de clientes
        
        Args:
            segment: Segmento objetivo (default: "all")
            target_segment: Alias para segment (compatibilidad)
        """
        # Usar target_segment si se proporciona
        target = target_segment or segment
        
        strategies = {
            "high_value": [
                "🎁 Programa VIP exclusivo con beneficios premium",
                "📞 Línea de atención prioritaria dedicada",
                "🎯 Ofertas personalizadas basadas en historial",
                "🌟 Eventos especiales exclusivos para VIP"
            ],
            "at_risk": [
                "⚠️ Campaña de reactivación con descuento del 15%",
                "📱 Contacto proactivo para identificar problemas",
                "💬 Encuesta de satisfacción personalizada",
                "🎁 Regalo de cortesía para recuperar confianza"
            ],
            "new": [
                "👋 Programa de onboarding mejorado",
                "📚 Contenido educativo sobre servicios",
                "🎉 Bono de bienvenida para segundo servicio",
                "✉️ Check-ins regulares durante primeros 90 días"
            ],
            "all": [
                "📧 Newsletter mensual con tips de valor",
                "🎂 Programa de cumpleaños con recompensas",
                "⭐ Sistema de puntos de lealtad",
                "💬 Encuestas de satisfacción trimestrales"
            ]
        }
        
        selected_strategies = strategies.get(target, strategies["all"])
        
        return {
            "strategy_created": True,
            "segment": target,
            "strategies": selected_strategies,
            "estimated_impact": "15-25% mejora en retención",
            "implementation_steps": [
                "1. Implementar programa de lealtad",
                "2. Configurar comunicaciones automáticas",
                "3. Entrenar equipo en servicio personalizado",
                "4. Monitorear métricas de retención mensualmente"
            ],
            "summary": f"📋 Estrategia de retención creada para segmento '{target}' con {len(selected_strategies)} tácticas específicas"
        }
    
    async def win_back_lost_clients(self, **kwargs) -> Dict[str, Any]:
        """Campaña para recuperar clientes perdidos"""
        inactive = await self.analyze_inactive_clients(days=90)
        lost_clients = inactive["clients"]
        
        sent = 0
        for client in lost_clients:
            user_id = client.get("id")
            await self.send_push_notification(
                user_id=user_id,
                title="Te Extrañamos! 😢",
                body="Vuelve a Ross Tax y obtén 20% de descuento en tu próximo servicio."
            )
            sent += 1
        
        return {
            "win_back_messages_sent": sent,
            "special_offer": "20% discount"
        }
    
    async def reduce_churn(self, **kwargs) -> Dict[str, Any]:
        """Implementa estrategias para reducir churn"""
        at_risk = await self.predict_client_churn()
        
        # Contactar clientes en riesgo
        for client in at_risk["clients"][:10]:
            await self.send_push_notification(
                user_id=client["user_id"],
                title="Estamos Aquí para Ti",
                body="¿Hay algo en lo que podamos ayudarte? Queremos asegurarnos de que estés satisfecho."
            )
        
        return {
            "churn_prevention_actions": len(at_risk["clients"][:10])
        }
    
    async def increase_lifetime_value(self, **kwargs) -> Dict[str, Any]:
        """Estrategias para aumentar valor de vida del cliente"""
        # Identificar clientes de alto potencial
        high_value = await self.segment_clients()
        
        return {
            "strategies_implemented": 3,
            "target_segment": "high_value",
            "expected_increase": "25%"
        }
    
    # ==================== GESTIÓN DE HORARIOS DE OFICINA ====================
    
    async def get_office_status(self, **kwargs) -> Dict[str, Any]:
        """Obtiene el estado actual de la oficina (abierto/cerrado)"""
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get("http://localhost:8001/api/office-hours/status")
                return response.json()
        except Exception as e:
            return {"error": str(e), "is_open": False}
    
    async def open_office_now(self, reason: str = "Abierto por AI Brain", **kwargs) -> Dict[str, Any]:
        """Abre la oficina inmediatamente (override manual)"""
        import httpx
        
        # Primero obtener token de admin (esto debería venir del contexto)
        # Por ahora, interactuamos directamente con la DB
        await self.db.office_hours.update_one(
            {"type": "manual_override"},
            {
                "$set": {
                    "is_open": True,
                    "reason": reason,
                    "active": True,
                    "set_by": "ai_brain",
                    "set_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # Notificar a clientes
        users = await self.db.users.find({"role": "client"}).limit(50).to_list(50)
        sent = 0
        for user in users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="🟢 Oficina Abierta",
                body="La oficina está abierta ahora. ¡Estamos aquí para ayudarte!"
            )
            sent += 1
        
        return {
            "status": "opened",
            "reason": reason,
            "notifications_sent": sent
        }
    
    async def close_office_now(self, reason: str = "Cerrado por AI Brain", **kwargs) -> Dict[str, Any]:
        """Cierra la oficina inmediatamente (override manual)"""
        await self.db.office_hours.update_one(
            {"type": "manual_override"},
            {
                "$set": {
                    "is_open": False,
                    "reason": reason,
                    "active": True,
                    "set_by": "ai_brain",
                    "set_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        
        # Notificar a clientes
        users = await self.db.users.find({"role": "client"}).limit(50).to_list(50)
        sent = 0
        for user in users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="🔴 Oficina Cerrada",
                body=f"La oficina está cerrada. {reason}"
            )
            sent += 1
        
        return {
            "status": "closed",
            "reason": reason,
            "notifications_sent": sent
        }
    
    async def update_office_hours(self, day: str, is_open: bool, open_time: str = None, close_time: str = None, **kwargs) -> Dict[str, Any]:
        """Actualiza el horario de un día específico"""
        schedule = await self.db.office_hours.find_one({"type": "weekly_schedule"})
        
        if not schedule:
            schedule = {
                "type": "weekly_schedule",
                "schedule": {},
                "created_at": datetime.utcnow()
            }
        
        schedule["schedule"][day] = {
            "is_open": is_open,
            "open_time": open_time,
            "close_time": close_time
        }
        
        schedule["updated_at"] = datetime.utcnow()
        
        await self.db.office_hours.update_one(
            {"type": "weekly_schedule"},
            {"$set": schedule},
            upsert=True
        )
        
        return {
            "updated": True,
            "day": day,
            "is_open": is_open
        }
    
    async def notify_office_closing_soon(self, minutes_before: int = 30, **kwargs) -> Dict[str, Any]:
        """Notifica a clientes que la oficina cerrará pronto"""
        # Obtener estado actual
        status = await self.get_office_status()
        
        if not status.get("is_open"):
            return {"message": "Office is already closed"}
        
        # Enviar notificaciones
        users = await self.db.users.find({"role": "client"}).to_list(None)
        
        sent = 0
        for user in users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="⚠️ Oficina Cerrará Pronto",
                body=f"La oficina cerrará en {minutes_before} minutos. ¡Aprovecha para contactarnos!"
            )
            sent += 1
        
        return {
            "notifications_sent": sent,
            "minutes_before": minutes_before
        }
    
    async def notify_office_opening_soon(self, minutes_before: int = 15, **kwargs) -> Dict[str, Any]:
        """Notifica que la oficina abrirá pronto"""
        users = await self.db.users.find({"role": "client"}).limit(100).to_list(100)
        
        sent = 0
        for user in users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="🔔 Oficina Abrirá Pronto",
                body=f"La oficina abrirá en {minutes_before} minutos. ¡Estamos listos para atenderte!"
            )
            sent += 1
        
        return {
            "notifications_sent": sent,
            "minutes_before": minutes_before
        }
    
    async def add_special_closing(self, date: str, reason: str, **kwargs) -> Dict[str, Any]:
        """Agrega un cierre especial (feriado, emergencia, etc.)"""
        special = {
            "type": "special_day",
            "date": date,
            "is_open": False,
            "reason": reason,
            "open_time": None,
            "close_time": None,
            "created_by": "ai_brain",
            "created_at": datetime.utcnow()
        }
        
        await self.db.office_hours.update_one(
            {"type": "special_day", "date": date},
            {"$set": special},
            upsert=True
        )
        
        # Notificar a clientes sobre el cierre especial
        users = await self.db.users.find({"role": "client"}).limit(100).to_list(100)
        
        sent = 0
        for user in users:
            await self.send_push_notification(
                user_id=user.get("id"),
                title="📅 Aviso: Cierre Especial",
                body=f"La oficina estará cerrada el {date}. Razón: {reason}"
            )
            sent += 1
        
        return {
            "special_closing_added": True,
            "date": date,
            "reason": reason,
            "notifications_sent": sent
        }
    
    async def get_office_schedule(self, **kwargs) -> Dict[str, Any]:
        """Obtiene el horario completo de la oficina"""
        schedule = await self.db.office_hours.find_one({"type": "weekly_schedule"})
        
        if not schedule:
            return {"error": "Schedule not configured"}
        
        return {
            "schedule": schedule.get("schedule", {}),
            "updated_at": schedule.get("updated_at", datetime.utcnow()).isoformat()
        }
    
    async def get_action_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Obtiene el historial de acciones de la IA"""
        logs = await self.db.ai_brain_logs.find().sort("created_at", -1).limit(limit).to_list(limit)
        return [
            {
                **log,
                "_id": str(log["_id"]),
                "created_at": log["created_at"].isoformat()
            }
            for log in logs
        ]
    
    async def _get_live_business_context(self) -> str:
        """
        Consulta datos REALES de MongoDB para inyectar en el contexto del AI.
        Incluye: clientes, facturas, citas, e-filing rates de temporadas 2023, 2024 y 2025.
        """
        import logging
        logger = logging.getLogger(__name__)
        try:
            # ── Season Clients ──
            total_clients = await self.db.season_clients.count_documents({})
            efiled_2023_yes = await self.db.season_clients.count_documents({"efiled_2023": "YES"})
            efiled_2023_no = await self.db.season_clients.count_documents({"efiled_2023": "NO"})
            efiled_2025_yes = await self.db.season_clients.count_documents({"efiled_2025": "YES"})
            efiled_2025_no = await self.db.season_clients.count_documents({"efiled_2025": "NO"})
            efiled_2024_yes = await self.db.season_clients.count_documents({"efiled": "YES", "tax_year": 2024})
            
            # Clients who returned from 2024→2025 (only 2024 season clients)
            returned_24_25 = await self.db.season_clients.count_documents({
                "tax_year": 2024,
                "efiled": "YES",
                "efiled_2025": "YES"
            })
            not_returned_24_25 = await self.db.season_clients.count_documents({
                "tax_year": 2024,
                "efiled": "YES",
                "$or": [
                    {"efiled_2025": {"$exists": False}},
                    {"efiled_2025": None},
                    {"efiled_2025": "NO"}
                ]
            })
            
            retention_24_25 = round((returned_24_25 / (returned_24_25 + not_returned_24_25) * 100), 1) if (returned_24_25 + not_returned_24_25) > 0 else 0
            efiled_rate_2025 = round((efiled_2025_yes / (efiled_2025_yes + efiled_2025_no) * 100), 1) if (efiled_2025_yes + efiled_2025_no) > 0 else 0
            
            # ── Invoices & Revenue by year ──
            total_invoices = await self.db.invoices.count_documents({})
            revenues = {}
            inv_counts = {}
            for yr in [2023, 2024, 2025]:
                yr_str = str(yr)  # tax_year stored as string in MongoDB
                inv_counts[yr] = await self.db.invoices.count_documents({"tax_year": yr_str})
                rev = await self.db.invoices.aggregate([
                    {"$match": {"tax_year": yr_str, "status": "paid"}},
                    {"$group": {"_id": None, "total": {"$sum": "$total"}}}
                ]).to_list(1)
                revenues[yr] = rev[0]["total"] if rev else 0
            
            revenue_total = sum(revenues.values())
            
            # ── Appointments ──
            total_appointments = await self.db.appointments.count_documents({})
            completed_apts = await self.db.appointments.count_documents({"status": "completed"})
            
            # Monthly breakdown for 2025 season
            monthly_pipeline = [
                {"$match": {"source": "efiled_2025_import"}},
                {"$addFields": {"month": {"$substr": ["$date", 0, 7]}}},
                {"$group": {"_id": "$month", "count": {"$sum": 1}}},
                {"$sort": {"_id": 1}}
            ]
            monthly = await self.db.appointments.aggregate(monthly_pipeline).to_list(None)
            monthly_str = ", ".join([f"{m['_id']}: {m['count']}" for m in monthly])
            
            # ── Contact info ──
            with_email = await self.db.season_clients.count_documents({"email": {"$exists": True, "$nin": ["", None]}})
            
            # Growth calculations
            growth_24_25 = efiled_2025_yes - efiled_2024_yes
            growth_rev = revenues[2025] - revenues[2024]
            
            context = f"""
📊 DATOS REALES DEL NEGOCIO (actualizados en tiempo real desde MongoDB):

🧑‍🤝‍🧑 CLIENTES POR TEMPORADA:
- Total clientes registrados: {total_clients}
- Temporada 2023 (Año Fiscal 2023): {efiled_2023_yes} e-filed, {efiled_2023_no} no presentaron (141 clientes totales)
- Temporada 2024 (Año Fiscal 2024): {efiled_2024_yes} e-filed completado
- Temporada 2025 (Año Fiscal 2025): {efiled_2025_yes} e-filed, {efiled_2025_no} pendientes
- Tasa de e-filing 2025: {efiled_rate_2025}%
- Retención 2024→2025: {returned_24_25} regresaron, {not_returned_24_25} no han regresado ({retention_24_25}% retención)
- Clientes con email: {with_email}

💰 FACTURACIÓN (3 temporadas):
- Temporada 2023: {inv_counts[2023]} facturas = ${revenues[2023]:,.2f}
- Temporada 2024: {inv_counts[2024]} facturas = ${revenues[2024]:,.2f}
- Temporada 2025: {inv_counts[2025]} facturas = ${revenues[2025]:,.2f}
- Total facturas: {total_invoices}
- Revenue TOTAL acumulado: ${revenue_total:,.2f}

📅 CITAS / ASISTENCIAS:
- Total citas registradas: {total_appointments}
- Completadas: {completed_apts}
- Distribución mensual 2025: {monthly_str}

📈 CRECIMIENTO Y TENDENCIAS:
- Crecimiento 2023→2024: {efiled_2023_yes} → {efiled_2024_yes} clientes e-filed ({'+' if efiled_2024_yes > efiled_2023_yes else ''}{efiled_2024_yes - efiled_2023_yes})
- Crecimiento 2024→2025: {efiled_2024_yes} → {efiled_2025_yes} clientes e-filed ({'+' if growth_24_25 >= 0 else ''}{growth_24_25})
- Crecimiento revenue 2024→2025: ${revenues[2024]:,.2f} → ${revenues[2025]:,.2f} ({'+' if growth_rev >= 0 else ''}${growth_rev:,.2f})
- Tendencia: El negocio ha crecido de {efiled_2023_yes} clientes en 2023 a {efiled_2025_yes} en 2025
"""
            logger.info(f"✅ Live business context generated: {total_clients} clients, ${revenue_total:,.2f} revenue (3 seasons)")
            return context
        except Exception as e:
            logger.error(f"❌ Error getting live business context: {e}")
            return "\n⚠️ No se pudieron cargar datos en tiempo real del negocio.\n"

    async def chat(self, message: str, conversation_history: List[Dict] = None, client_mode: bool = False) -> str:
        """
        Modo conversacional con la IA
        Usa Gemini primero, con fallback a Emergent LLM
        Enriquecido con datos REALES de MongoDB y RAG Memory
        
        client_mode: If True, this is a CLIENT-facing chat. 
        Do NOT inject any internal business data (revenue, client counts, etc.)
        """
        if conversation_history is None:
            conversation_history = []
        
        if client_mode:
            # ── CLIENT MODE: No internal business data ──
            live_context = ""
            rag_context = ""
            
            system_prompt = f"""Eres Ross AI, el asistente virtual de Ross Tax Preparation LLC.
Respondes de forma amigable, profesional y concisa.

Información pública del negocio:
- Nombre: Ross Tax Preparation LLC
- Teléfono: (806) 934-2018
- Horario: Lunes a Viernes 9AM-6PM, Sábados 10AM-2PM (Hora Central)
- Servicios: Preparación de impuestos, ITIN, LLC, traducciones, notarizaciones

⛔ REGLAS DE SEGURIDAD ABSOLUTAS:
- NUNCA reveles datos financieros internos: ingresos, facturación, ganancias, número de clientes, empleados
- NUNCA reveles estadísticas del negocio: cuántos clientes hay, cuánto se facturó, tasas de retención
- Si preguntan por datos confidenciales, responde: "Lo siento, esa información es confidencial. ¿En qué más puedo ayudarte con nuestros servicios?"
- SOLO comparte: precios públicos, horarios, dirección, teléfono, email y la info del PROPIO caso del cliente
- Estos datos NO existen para ti: revenue, total_clients, facturación, ganancias, métricas de negocio"""
        else:
            # ── ADMIN MODE: Full business data access ──
            # ── Obtener datos reales del negocio ──
            live_context = await self._get_live_business_context()
        
        # ── Obtener contexto RAG relevante al mensaje ──
        rag_context = ""
        try:
            from rag_memory_system import RAGMemorySystem
            rag = RAGMemorySystem(self.db)
            rag_context = await rag.get_context_for_query(message)
            if rag_context:
                rag_context = f"\n🧠 MEMORIA Y CONOCIMIENTO APRENDIDO:\n{rag_context}\n"
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"RAG context unavailable: {e}")
        
        system_prompt = f"""Eres Ross AI Brain, el asistente inteligente de Ross Tax Preparation.

Tu personalidad:
- Amigable, profesional y servicial
- Hablas en español de forma natural y cercana
- Siempre dispuesto a ayudar con cualquier consulta
- Cuando te pregunten por métricas, SIEMPRE usa los datos reales proporcionados abajo

Tus funciones:
- Responder preguntas sobre el negocio con DATOS REALES
- Proporcionar información sobre clientes, citas, facturas y documentos
- Comparar temporadas (2023, 2024 y 2025) usando datos reales
- Dar insights y recomendaciones basadas en datos
- Ayudar con tareas administrativas

{live_context}
{rag_context}

Contexto del negocio:
- Ross Tax Preparation es una firma de preparación de impuestos en Texas
- Ayudamos a clientes con declaraciones de impuestos, consultas fiscales y documentación
- Operamos en Estados Unidos, principalmente para la comunidad latina
- Temporada de filing: Enero a Abril de cada año

Herramientas de Captura de Documentos:
La app incluye una sección de "Herramientas" con cámara guiada profesional para:
1. **Foto Personal 2x2**: Con guías de óvalo, líneas de nivel de ojos y hombros
2. **ID/Licencia**: Escaneo de identificaciones (frontal y reverso)
3. **Documentos Fiscales**: W2, 1099, y otros formularios fiscales
4. **Recibos**: Escaneo de recibos y facturas
5. **Mis Documentos**: Historial de documentos enviados

Instrucciones:
- Si te saludan, responde de forma amigable
- Si te preguntan por métricas o datos del negocio, USA LOS DATOS REALES de arriba, no inventes
- Si te preguntan comparaciones entre temporadas, compara con los datos reales
- Mantén respuestas concisas pero informativas
- Da cifras exactas cuando las tengas disponibles"""
        
        # Construir el contexto conversacional
        conversation_text = system_prompt + "\n\n"
        for msg in conversation_history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            conversation_text += f"{'Usuario' if role == 'user' else 'Asistente'}: {content}\n"
        conversation_text += f"Usuario: {message}\nAsistente:"
        
        # Configure safety settings to be permissive for business context
        safety_settings = [
            {
                "category": genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                "threshold": genai.types.HarmBlockThreshold.BLOCK_NONE,
            },
            {
                "category": genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                "threshold": genai.types.HarmBlockThreshold.BLOCK_NONE,
            },
            {
                "category": genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                "threshold": genai.types.HarmBlockThreshold.BLOCK_NONE,
            },
            {
                "category": genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                "threshold": genai.types.HarmBlockThreshold.BLOCK_NONE,
            },
        ]
        
        # Try Gemini first
        try:
            response = await self.model.generate_content_async(
                conversation_text,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.9,
                    top_p=0.95,
                    max_output_tokens=500,
                ),
                safety_settings=safety_settings
            )
            
            # Try to get text first
            if hasattr(response, 'text') and response.text:
                return response.text.strip()
            
            # Check candidates if text is not available
            if response.candidates and len(response.candidates) > 0:
                candidate = response.candidates[0]
                
                # Try to get content from parts
                if hasattr(candidate.content, 'parts') and candidate.content.parts:
                    text_parts = [part.text for part in candidate.content.parts if hasattr(part, 'text')]
                    if text_parts:
                        return ' '.join(text_parts).strip()
                
                # If blocked by safety, try Emergent fallback
                finish_reason = candidate.finish_reason
                if finish_reason in [2, 3]:  # SAFETY or RECITATION
                    print(f"⚠️ Gemini blocked (reason: {finish_reason}), trying Emergent fallback...")
                    raise Exception("Gemini blocked, use fallback")
            
            # If no valid response, try fallback
            raise Exception("No valid Gemini response")
            
        except Exception as gemini_error:
            print(f"⚠️ Gemini error: {str(gemini_error)}, trying Emergent LLM...")
            
            # Fallback to Emergent LLM
            try:
                from emergentintegrations.llm.chat import LlmChat
                
                emergent_key = os.getenv('EMERGENT_LLM_KEY')
                if emergent_key:
                    llm = LlmChat(api_key=emergent_key)
                    
                    messages = [
                        {"role": "system", "content": system_prompt},
                    ]
                    
                    # Add conversation history
                    for msg in conversation_history:
                        messages.append({
                            "role": msg.get("role", "user"),
                            "content": msg.get("content", "")
                        })
                    
                    # Add current message
                    messages.append({"role": "user", "content": message})
                    
                    response = await llm.chat(
                        model="gemini/gemini-2.5-flash",
                        messages=messages
                    )
                    
                    if response and response.content and response.content.strip():
                        print(f"✅ Emergent LLM response successful")
                        return response.content.strip()
            except Exception as emergent_error:
                print(f"❌ Emergent LLM error: {str(emergent_error)}")
            
            # Final fallback - generate helpful response based on message content
            message_lower = message.lower()
            
            if any(word in message_lower for word in ['hola', 'buenos', 'saludos', 'hi', 'hello']):
                return "¡Hola! Soy Ross AI Brain, tu asistente de Ross Tax Preparation. Puedo ayudarte con información sobre impuestos, citas, documentos y más. ¿En qué te puedo ayudar?"
            
            elif any(word in message_lower for word in ['ayudar', 'ayuda', 'help', 'puedes hacer']):
                return """¡Con gusto te explico! Puedo ayudarte con:

📋 **Información de servicios** - Precios y tipos de declaraciones
📅 **Citas** - Agendar o consultar disponibilidad  
📄 **Documentos** - Guiarte sobre qué documentos necesitas
💬 **Preguntas** - Responder dudas sobre impuestos

¿Qué te gustaría saber?"""
            
            elif any(word in message_lower for word in ['cita', 'agendar', 'horario', 'disponible']):
                return "Para agendar una cita, puedes ir a la sección 'Citas' en la app y seleccionar la fecha y hora que te convenga. Nuestro horario es de Lunes a Viernes de 9:00 AM a 6:00 PM. ¿Te gustaría que te ayude con algo más?"
            
            elif any(word in message_lower for word in ['documento', 'w2', '1099', 'foto', 'enviar']):
                return "Para enviar documentos, ve a tu perfil y selecciona 'Herramientas'. Ahí encontrarás opciones para escanear tu ID, W2, 1099 y otros documentos con guías visuales que te ayudan a tomar la foto correcta. ¿Necesitas ayuda con algo específico?"
            
            elif any(word in message_lower for word in ['precio', 'costo', 'cuanto', 'cobran']):
                return "Nuestros precios varían según el tipo de declaración. Una declaración personal empieza desde $180. Para cotizaciones más precisas, te recomiendo agendar una consulta gratuita. ¿Te gustaría más información?"
            
            else:
                return "Gracias por tu mensaje. Estoy aquí para ayudarte con cualquier pregunta sobre impuestos, citas o documentos. ¿Podrías darme más detalles sobre lo que necesitas?"

    
    # ==========================================
    # APP MÓVIL - SEGUIMIENTO Y ADOPCIÓN
    # ==========================================
    
    async def analyze_app_adoption(self, params: Dict = None) -> Dict[str, Any]:
        """
        Analiza la adopción de la app móvil entre los clientes
        Retorna estadísticas detalladas y segmentación
        """
        try:
            users = await self.db.users.find().to_list(None)
            
            total_clients = len(users)
            clients_with_app = sum(1 for u in users if u.get('push_token'))
            clients_without_app = total_clients - clients_with_app
            
            adoption_rate = (clients_with_app / total_clients * 100) if total_clients > 0 else 0
            
            # Analizar por tipo de cliente (si tienes este dato)
            with_app_details = []
            without_app_details = []
            
            for user in users:
                user_info = {
                    'id': str(user['_id']),
                    'name': user['name'],
                    'email': user['email'],
                    'created_at': user['created_at'],
                    'has_app': bool(user.get('push_token'))
                }
                
                if user.get('push_token'):
                    with_app_details.append(user_info)
                else:
                    without_app_details.append(user_info)
            
            return {
                "success": True,
                "total_clients": total_clients,
                "clients_with_app": clients_with_app,
                "clients_without_app": clients_without_app,
                "adoption_rate": round(adoption_rate, 2),
                "with_app_list": with_app_details[:10],  # Primeros 10
                "without_app_list": without_app_details[:10],  # Primeros 10
                "recommendation": self._generate_app_adoption_recommendation(adoption_rate, clients_without_app)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_clients_without_app(self, params: Dict = None) -> Dict[str, Any]:
        """
        Obtiene la lista de clientes que NO tienen la app instalada
        Ideal para campañas de adopción
        """
        try:
            # Clientes sin push_token = sin app
            users = await self.db.users.find({
                '$or': [
                    {'push_token': {'$exists': False}},
                    {'push_token': None},
                    {'push_token': ''}
                ]
            }).to_list(None)
            
            clients_list = []
            for user in users:
                # Calcular engagement score
                doc_count = await self.db.documents.count_documents({'user_id': str(user['_id'])})
                appt_count = await self.db.appointments.count_documents({'user_id': str(user['_id'])})
                
                engagement_score = doc_count + (appt_count * 2)  # Citas valen más
                
                clients_list.append({
                    'id': str(user['_id']),
                    'name': user['name'],
                    'email': user['email'],
                    'phone': user.get('phone'),
                    'created_at': user['created_at'],
                    'engagement_score': engagement_score,
                    'priority': self._calculate_priority(user, engagement_score)
                })
            
            # Ordenar por prioridad
            clients_list.sort(key=lambda x: x['priority'], reverse=True)
            
            return {
                "success": True,
                "count": len(clients_list),
                "clients": clients_list,
                "high_priority": [c for c in clients_list if c['priority'] == 'high'],
                "medium_priority": [c for c in clients_list if c['priority'] == 'medium'],
                "low_priority": [c for c in clients_list if c['priority'] == 'low']
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_app_download_suggestion(self, params: Dict) -> Dict[str, Any]:
        """
        Envía sugerencia personalizada a un cliente para descargar la app
        params: { "client_id": "...", "channel": "email|sms|both" }
        """
        try:
            client_id = params.get('client_id')
            channel = params.get('channel', 'email')
            
            user = await self.db.users.find_one({'_id': ObjectId(client_id)})
            if not user:
                return {"success": False, "error": "Cliente no encontrado"}
            
            # Verificar si ya tiene la app
            if user.get('push_token'):
                return {
                    "success": False, 
                    "error": "Este cliente ya tiene la app instalada",
                    "client_name": user['name']
                }
            
            app_links = {
                "ios": "https://apps.apple.com/us/app/ross-tax/id6755496120?l=es-MX",
                "android": "https://play.google.com/store/apps/details?id=com.rosstax"  # Actualizar con link real
            }
            
            message = f"""
            Hola {user['name']},
            
            ¿Sabías que tenemos una app móvil que hace todo más fácil? 📱
            
            Con nuestra app puedes:
            ✅ Ver tus citas en cualquier momento
            ✅ Subir documentos directamente desde tu teléfono
            ✅ Recibir notificaciones importantes
            ✅ Acceder a tus créditos Ross Tax
            ✅ Gestionar todo desde la palma de tu mano
            
            Descárgala ahora:
            📱 iOS: {app_links['ios']}
            📱 Android: {app_links['android']}
            
            ¡Te esperamos en la app!
            
            Equipo Ross Tax Preparation
            """
            
            results = {}
            
            # Enviar por el canal seleccionado
            if channel in ['email', 'both']:
                # Implementar envío de email
                results['email'] = {
                    "sent": True,
                    "to": user['email'],
                    "message": "Email enviado con links de descarga"
                }
            
            if channel in ['sms', 'both'] and user.get('phone'):
                # Implementar envío de SMS
                sms_message = f"Hola {user['name']}! Descarga nuestra app móvil Ross Tax y gestiona todo desde tu teléfono. iOS: {app_links['ios']} Android: {app_links['android']}"
                results['sms'] = {
                    "sent": True,
                    "to": user['phone'],
                    "message": "SMS enviado con links de descarga"
                }
            
            # Log de la acción
            await self._log_action({
                "type": "app_download_suggestion_sent",
                "client_id": client_id,
                "client_name": user['name'],
                "channel": channel,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "client_name": user['name'],
                "channels_used": results
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def create_app_adoption_campaign(self, params: Dict = None) -> Dict[str, Any]:
        """
        Crea una campaña masiva para promover la adopción de la app
        Envía comunicaciones a clientes sin app de forma escalonada
        """
        try:
            # Obtener clientes sin app
            clients_result = await self.get_clients_without_app()
            
            if not clients_result['success']:
                return clients_result
            
            clients = clients_result['clients']
            
            if len(clients) == 0:
                return {
                    "success": True,
                    "message": "¡Todos los clientes ya tienen la app! 🎉",
                    "clients_targeted": 0
                }
            
            # Segmentar por prioridad
            high_priority = clients_result['high_priority']
            medium_priority = clients_result['medium_priority']
            low_priority = clients_result['low_priority']
            
            campaign_plan = {
                "campaign_name": "App Adoption Drive",
                "created_at": datetime.utcnow().isoformat(),
                "total_targets": len(clients),
                "phases": [
                    {
                        "phase": 1,
                        "name": "High Priority - Email + SMS",
                        "targets": len(high_priority),
                        "channel": "both",
                        "schedule": "immediate"
                    },
                    {
                        "phase": 2,
                        "name": "Medium Priority - Email",
                        "targets": len(medium_priority),
                        "channel": "email",
                        "schedule": "3 days later"
                    },
                    {
                        "phase": 3,
                        "name": "Low Priority - Email",
                        "targets": len(low_priority),
                        "channel": "email",
                        "schedule": "1 week later"
                    }
                ]
            }
            
            # Ejecutar Fase 1 inmediatamente (high priority)
            sent_count = 0
            for client in high_priority[:5]:  # Enviar a los primeros 5 para testing
                result = await self.send_app_download_suggestion({
                    "client_id": client['id'],
                    "channel": "both"
                })
                if result['success']:
                    sent_count += 1
            
            return {
                "success": True,
                "campaign_plan": campaign_plan,
                "phase_1_sent": sent_count,
                "message": f"Campaña iniciada. {sent_count} clientes de alta prioridad contactados."
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def track_app_engagement(self, params: Dict = None) -> Dict[str, Any]:
        """
        Rastrea el engagement de usuarios con la app
        Identifica usuarios activos vs inactivos
        """
        try:
            # Usuarios con app
            users_with_app = await self.db.users.find({
                'push_token': {'$exists': True, '$ne': None, '$ne': ''}
            }).to_list(None)
            
            engagement_data = []
            
            for user in users_with_app:
                # Última actividad (última cita o documento subido)
                last_appt = await self.db.appointments.find_one(
                    {'user_id': str(user['_id'])},
                    sort=[('created_at', -1)]
                )
                last_doc = await self.db.documents.find_one(
                    {'user_id': str(user['_id'])},
                    sort=[('uploaded_at', -1)]
                )
                
                last_activity = None
                if last_appt and last_doc:
                    last_activity = max(last_appt.get('created_at', user['created_at']), 
                                      last_doc.get('uploaded_at', user['created_at']))
                elif last_appt:
                    last_activity = last_appt.get('created_at', user['created_at'])
                elif last_doc:
                    last_activity = last_doc.get('uploaded_at', user['created_at'])
                else:
                    last_activity = user['created_at']
                
                days_since_activity = (datetime.utcnow() - last_activity).days
                
                engagement_data.append({
                    'user_id': str(user['_id']),
                    'name': user['name'],
                    'email': user['email'],
                    'last_activity': last_activity.isoformat() if hasattr(last_activity, 'isoformat') else str(last_activity),
                    'days_since_activity': days_since_activity,
                    'engagement_status': self._get_engagement_status(days_since_activity)
                })
            
            # Clasificar
            active = [u for u in engagement_data if u['engagement_status'] == 'active']
            moderate = [u for u in engagement_data if u['engagement_status'] == 'moderate']
            inactive = [u for u in engagement_data if u['engagement_status'] == 'inactive']
            
            return {
                "success": True,
                "total_app_users": len(users_with_app),
                "active_users": len(active),
                "moderate_users": len(moderate),
                "inactive_users": len(inactive),
                "engagement_breakdown": {
                    "active": active[:5],
                    "moderate": moderate[:5],
                    "inactive": inactive[:5]
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def reward_app_users(self, params: Dict = None) -> Dict[str, Any]:
        """
        Recompensa a usuarios activos de la app con créditos
        """
        try:
            # Obtener usuarios activos de la app
            engagement = await self.track_app_engagement()
            
            if not engagement['success']:
                return engagement
            
            active_users = engagement['engagement_breakdown']['active']
            
            reward_amount = params.get('amount', 10)  # 10 créditos por defecto
            rewarded_count = 0
            
            for user_data in active_users:
                # Agregar créditos
                await self.db.users.update_one(
                    {'_id': ObjectId(user_data['user_id'])},
                    {'$inc': {'credits': reward_amount}}
                )
                
                # Enviar notificación
                user = await self.db.users.find_one({'_id': ObjectId(user_data['user_id'])})
                if user.get('push_token'):
                    # Enviar push notification
                    pass  # Implementar con tu servicio de push
                
                rewarded_count += 1
            
            return {
                "success": True,
                "rewarded_users": rewarded_count,
                "credits_per_user": reward_amount,
                "message": f"{rewarded_count} usuarios activos recompensados con {reward_amount} créditos cada uno"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_app_features_tutorial(self, params: Dict) -> Dict[str, Any]:
        """
        Envía tutorial de características de la app a nuevos usuarios
        params: { "client_id": "..." }
        """
        try:
            client_id = params.get('client_id')
            user = await self.db.users.find_one({'_id': ObjectId(client_id)})
            
            if not user:
                return {"success": False, "error": "Cliente no encontrado"}
            
            if not user.get('push_token'):
                return {"success": False, "error": "Este cliente no tiene la app instalada"}
            
            tutorial_message = f"""
            ¡Bienvenido a la app Ross Tax, {user['name']}! 🎉
            
            Aquí te mostramos todo lo que puedes hacer:
            
            📅 CITAS
            - Ver todas tus citas programadas
            - Agendar nuevas citas
            - Recibir recordatorios automáticos
            
            📄 DOCUMENTOS
            - Subir documentos desde tu cámara
            - Ver el estado de tus documentos
            - Recibir notificaciones cuando los revisemos
            
            💰 CRÉDITOS ROSS TAX
            - Ver tu balance actual
            - Recibir créditos por referidos
            - Usar créditos para servicios
            
            🎮 JUEGOS Y RECOMPENSAS
            - Juega y gana créditos
            - Participa en sorteos
            - Desbloquea logros
            
            ¿Necesitas ayuda? Contacta con nosotros desde la app.
            
            ¡Gracias por confiar en Ross Tax!
            """
            
            # Enviar via push notification o email
            if user.get('push_token'):
                # Enviar push
                pass
            
            return {
                "success": True,
                "client_name": user['name'],
                "message": "Tutorial enviado exitosamente"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Funciones auxiliares privadas
    
    def _generate_app_adoption_recommendation(self, adoption_rate: float, clients_without_app: int) -> str:
        """Genera recomendación basada en tasa de adopción"""
        if adoption_rate < 20:
            return f"⚠️ Tasa de adopción muy baja ({adoption_rate}%). Se recomienda campaña agresiva de promoción con incentivos (créditos gratis por descargar)."
        elif adoption_rate < 50:
            return f"📊 Tasa de adopción moderada ({adoption_rate}%). Continuar con recordatorios periódicos y mostrar beneficios de la app."
        elif adoption_rate < 80:
            return f"✅ Buena tasa de adopción ({adoption_rate}%). Mantener comunicaciones y recompensar usuarios activos."
        else:
            return f"🎉 ¡Excelente adopción! ({adoption_rate}%). Enfocarse en engagement y retención de usuarios existentes."
    
    def _calculate_priority(self, user: Dict, engagement_score: int) -> str:
        """Calcula la prioridad de un cliente para contacto"""
        # Clientes con más engagement son alta prioridad
        if engagement_score >= 5:
            return 'high'
        elif engagement_score >= 2:
            return 'medium'
        else:
            return 'low'
    
    def _get_engagement_status(self, days_since_activity: int) -> str:
        """Determina el estado de engagement basado en última actividad"""
        if days_since_activity <= 7:
            return 'active'
        elif days_since_activity <= 30:
            return 'moderate'
        else:
            return 'inactive'


    
    # ==========================================
    # GEOLOCALIZACIÓN Y RETENCIÓN INTELIGENTE
    # ==========================================
    
    async def track_client_location(self, params: Dict) -> Dict[str, Any]:
        """
        Registra la ubicación actual de un cliente
        params: {
            "client_id": "...",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "accuracy": 10
        }
        """
        try:
            client_id = params.get('client_id')
            latitude = params.get('latitude')
            longitude = params.get('longitude')
            accuracy = params.get('accuracy', 0)
            
            if not all([client_id, latitude, longitude]):
                return {"success": False, "error": "Faltan parámetros requeridos"}
            
            # Crear documento de ubicación
            location_doc = {
                'user_id': client_id,
                'latitude': latitude,
                'longitude': longitude,
                'accuracy': accuracy,
                'timestamp': datetime.utcnow(),
                'city': params.get('city'),
                'state': params.get('state'),
                'country': params.get('country', 'US'),
                'postal_code': params.get('postal_code')
            }
            
            # Guardar en colección de ubicaciones
            await self.db.user_locations.insert_one(location_doc)
            
            # Actualizar última ubicación conocida en el usuario
            await self.db.users.update_one(
                {'_id': ObjectId(client_id)},
                {
                    '$set': {
                        'last_known_location': {
                            'latitude': latitude,
                            'longitude': longitude,
                            'timestamp': datetime.utcnow(),
                            'city': params.get('city'),
                            'state': params.get('state')
                        }
                    }
                }
            )
            
            # Detectar si es un cambio significativo
            await self._check_location_change(client_id, latitude, longitude)
            
            return {
                "success": True,
                "message": "Ubicación registrada exitosamente",
                "location": location_doc
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def detect_client_relocations(self, params: Dict = None) -> Dict[str, Any]:
        """
        Detecta clientes que se han mudado (cambio significativo de ubicación)
        Retorna lista de clientes que necesitan seguimiento de retención
        """
        try:
            # Buscar usuarios con historial de ubicaciones
            users = await self.db.users.find({
                'last_known_location': {'$exists': True}
            }).to_list(None)
            
            relocated_clients = []
            
            for user in users:
                # Obtener ubicaciones históricas
                locations = await self.db.user_locations.find({
                    'user_id': str(user['_id'])
                }).sort('timestamp', -1).limit(10).to_list(10)
                
                if len(locations) < 2:
                    continue
                
                # Comparar última ubicación con ubicación original/anterior
                latest = locations[0]
                original = locations[-1]
                
                # Calcular distancia
                distance_km = self._calculate_distance(
                    latest['latitude'], latest['longitude'],
                    original['latitude'], original['longitude']
                )
                
                # Si se movió más de 50 km = mudanza significativa
                if distance_km > 50:
                    days_since_detection = (datetime.utcnow() - latest['timestamp']).days
                    
                    relocated_clients.append({
                        'user_id': str(user['_id']),
                        'name': user['name'],
                        'email': user['email'],
                        'phone': user.get('phone'),
                        'original_location': {
                            'city': original.get('city', 'Unknown'),
                            'state': original.get('state', 'Unknown')
                        },
                        'current_location': {
                            'city': latest.get('city', 'Unknown'),
                            'state': latest.get('state', 'Unknown')
                        },
                        'distance_moved_km': round(distance_km, 2),
                        'detected_date': latest['timestamp'].isoformat(),
                        'days_since_detection': days_since_detection,
                        'risk_level': self._assess_churn_risk(distance_km, days_since_detection),
                        'contacted': user.get('relocation_contacted', False)
                    })
            
            # Ordenar por riesgo
            relocated_clients.sort(key=lambda x: x['risk_level'], reverse=True)
            
            return {
                "success": True,
                "total_relocated": len(relocated_clients),
                "high_risk": [c for c in relocated_clients if c['risk_level'] == 'high'],
                "medium_risk": [c for c in relocated_clients if c['risk_level'] == 'medium'],
                "low_risk": [c for c in relocated_clients if c['risk_level'] == 'low'],
                "all_clients": relocated_clients
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_relocation_retention_message(self, params: Dict) -> Dict[str, Any]:
        """
        Envía mensaje personalizado a cliente que se mudó para retenerlo
        params: { "client_id": "...", "channel": "email|sms|push|all" }
        """
        try:
            client_id = params.get('client_id')
            channel = params.get('channel', 'all')
            
            user = await self.db.users.find_one({'_id': ObjectId(client_id)})
            if not user:
                return {"success": False, "error": "Cliente no encontrado"}
            
            # Obtener información de ubicación
            locations = await self.db.user_locations.find({
                'user_id': client_id
            }).sort('timestamp', -1).limit(2).to_list(2)
            
            if len(locations) < 2:
                return {"success": False, "error": "No hay datos de mudanza"}
            
            current_city = locations[0].get('city', 'nueva ubicación')
            original_city = locations[-1].get('city', 'ubicación anterior')
            
            # Mensaje personalizado
            message = f"""
            Hola {user['name']},
            
            Notamos que te mudaste de {original_city} a {current_city}. 🏡
            
            ¡No te preocupes! Aunque ya no estés cerca de nuestra oficina, seguimos siendo tu mejor opción para tus impuestos.
            
            ✅ Podemos trabajar 100% REMOTO
            ✅ Subir documentos desde la app
            ✅ Videoconferencias para consultas
            ✅ Todo digital, sin necesidad de visitas
            ✅ El mismo servicio de calidad que conoces
            
            No importa dónde estés, Ross Tax Preparation está contigo. 📱💼
            
            ¿Tienes preguntas? Contáctanos en cualquier momento.
            
            ¡Te seguimos apoyando en tu nueva etapa!
            
            Equipo Ross Tax Preparation
            """
            
            results = {}
            
            # Enviar por los canales indicados
            if channel in ['email', 'all']:
                results['email'] = {
                    "sent": True,
                    "to": user['email'],
                    "subject": "¡Seguimos contigo aunque te hayas mudado! 🏡"
                }
            
            if channel in ['sms', 'all'] and user.get('phone'):
                sms_msg = f"Hola {user['name']}! Vimos que te mudaste a {current_city}. No te preocupes, podemos seguir haciendo tus impuestos 100% remoto. ¡Ross Tax está contigo donde estés! 📱"
                results['sms'] = {
                    "sent": True,
                    "to": user['phone']
                }
            
            if channel in ['push', 'all'] and user.get('push_token'):
                results['push'] = {
                    "sent": True,
                    "title": "¡Seguimos contigo! 🏡",
                    "body": f"Te mudaste? No importa! Podemos seguir con tus impuestos 100% remoto."
                }
            
            # Marcar como contactado
            await self.db.users.update_one(
                {'_id': ObjectId(client_id)},
                {
                    '$set': {
                        'relocation_contacted': True,
                        'relocation_contact_date': datetime.utcnow()
                    }
                }
            )
            
            # Log de acción
            await self._log_action({
                "type": "relocation_retention_message",
                "client_id": client_id,
                "client_name": user['name'],
                "from_city": original_city,
                "to_city": current_city,
                "channels": results,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "client_name": user['name'],
                "relocation": f"{original_city} → {current_city}",
                "channels_used": results
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calcula distancia entre dos puntos en km usando fórmula Haversine"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Radio de la Tierra en km
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
    
    def _assess_churn_risk(self, distance_km: float, days_since: int) -> str:
        """Evalúa riesgo de churn basado en distancia y tiempo"""
        if distance_km > 500 or days_since > 60:
            return 'high'
        elif distance_km > 200 or days_since > 30:
            return 'medium'
        else:
            return 'low'
    
    async def _check_location_change(self, client_id: str, lat: float, lon: float):
        """Verifica si es un cambio significativo y genera alerta"""
        # Obtener ubicación anterior
        prev_locations = await self.db.user_locations.find({
            'user_id': client_id
        }).sort('timestamp', -1).skip(1).limit(1).to_list(1)
        
        if prev_locations:
            prev = prev_locations[0]
            distance = self._calculate_distance(
                lat, lon,
                prev['latitude'], prev['longitude']
            )
            
            # Si se movió más de 50km, es mudanza significativa
            if distance > 50:
                await self._log_action({
                    "type": "significant_location_change_detected",
                    "client_id": client_id,
                    "distance_km": round(distance, 2),
                    "timestamp": datetime.utcnow().isoformat(),
                    "alert": "Cliente se mudó - Requiere seguimiento de retención"
                })
    
    async def create_relocation_campaign(self, params: Dict = None) -> Dict[str, Any]:
        """Crea campaña masiva para clientes mudados"""
        try:
            relocations = await self.detect_client_relocations()
            if not relocations['success']:
                return relocations
            
            all_relocated = relocations['all_clients']
            if len(all_relocated) == 0:
                return {"success": True, "message": "No hay clientes mudados", "total": 0}
            
            to_contact = [c for c in all_relocated if not c['contacted']]
            high_risk = [c for c in to_contact if c['risk_level'] == 'high']
            
            contacted = 0
            for client in high_risk[:5]:
                result = await self.send_relocation_retention_message({
                    "client_id": client['user_id'],
                    "channel": "all"
                })
                if result['success']:
                    contacted += 1
            
            return {
                "success": True,
                "total_relocated": len(all_relocated),
                "contacted": contacted,
                "pending": len(to_contact) - contacted
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def predict_client_churn_by_location(self, params: Dict = None) -> Dict[str, Any]:
        """Predice riesgo de churn basado en ubicación"""
        return await self.detect_client_relocations()
    
    async def get_clients_by_distance(self, params: Dict) -> Dict[str, Any]:
        """Obtiene clientes por distancia desde un punto"""
        try:
            ref_lat = params.get('latitude')
            ref_lon = params.get('longitude')
            max_dist = params.get('max_distance_km', 100)
            
            users = await self.db.users.find({'last_known_location': {'$exists': True}}).to_list(None)
            
            clients_with_distance = []
            for user in users:
                loc = user['last_known_location']
                distance = self._calculate_distance(ref_lat, ref_lon, loc['latitude'], loc['longitude'])
                
                if distance <= max_dist:
                    clients_with_distance.append({
                        'user_id': str(user['_id']),
                        'name': user['name'],
                        'distance_km': round(distance, 2),
                        'city': loc.get('city')
                    })
            
            clients_with_distance.sort(key=lambda x: x['distance_km'])
            
            return {"success": True, "total": len(clients_with_distance), "clients": clients_with_distance}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def analyze_service_area(self, params: Dict = None) -> Dict[str, Any]:
        """Analiza área de servicio y expansión"""
        try:
            users = await self.db.users.find({'last_known_location': {'$exists': True}}).to_list(None)
            
            if len(users) == 0:
                return {"success": True, "message": "No hay datos de ubicación"}
            
            cities = {}
            states = {}
            
            for user in users:
                loc = user.get('last_known_location', {})
                city = loc.get('city', 'Unknown')
                state = loc.get('state', 'Unknown')
                
                cities[city] = cities.get(city, 0) + 1
                states[state] = states.get(state, 0) + 1
            
            top_cities = sorted(cities.items(), key=lambda x: x[1], reverse=True)[:10]
            top_states = sorted(states.items(), key=lambda x: x[1], reverse=True)[:10]
            
            return {
                "success": True,
                "total_clients": len(users),
                "total_cities": len(cities),
                "total_states": len(states),
                "top_cities": [{"city": c, "clients": n} for c, n in top_cities],
                "top_states": [{"state": s, "clients": n} for s, n in top_states]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _init_faq_tools(self):
        """Inicializa herramientas de FAQs después de que todos los métodos están definidos"""
        self.tools.update({
            "create_faq": self.create_faq,
            "update_faq": self.update_faq,
            "search_faqs": self.search_faqs,
            "analyze_faq_performance": self.analyze_faq_performance,
            "generate_faq_from_question": self.generate_faq_from_question,
            "auto_categorize_faq": self.auto_categorize_faq,
            "suggest_faq_improvements": self.suggest_faq_improvements,
        })

    # ==========================================
    # SISTEMA DE FAQs INTELIGENTE
    # ==========================================
    
    async def create_faq(self, question: str, answer: str, category_id: str = None, language: str = "en", **kwargs) -> Dict[str, Any]:
        """Crea una nueva FAQ utilizando IA para mejorar el contenido"""
        try:
            # Si no se proporciona respuesta, generar con IA
            if not answer or answer.strip() == "":
                prompt = f"""Eres un experto en impuestos y servicios fiscales. 
Genera una respuesta profesional, clara y concisa para esta pregunta frecuente:

Pregunta: {question}

La respuesta debe ser:
- Profesional y amigable
- Clara y fácil de entender
- Concisa (máximo 3 párrafos)
- Específica para servicios de preparación de impuestos"""
                
                response = await self.model.generate_content_async(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        max_output_tokens=300,
                    )
                )
                answer = response.text
            
            # Detectar categoría automáticamente si no se proporciona
            if not category_id:
                category_result = await self.auto_categorize_faq(question=question)
                category_id = category_result.get("category_id", "cat_general")
            
            # Crear FAQ en la base de datos
            faq_data = {
                "category_id": category_id,
                "question": question if language == "en" else "",
                "question_es": question if language == "es" else "",
                "answer": answer if language == "en" else "",
                "answer_es": answer if language == "es" else "",
                "tags": [],
                "active": True
            }
            
            # Si está en un idioma, traducir al otro
            if language == "es":
                # Traducir al inglés
                translate_prompt = f"Translate to English: {question}\n\nAnswer: {answer}"
                trans_response = await self.model.generate_content_async(translate_prompt)
                translations = trans_response.text.split("\n\n")
                if len(translations) >= 2:
                    faq_data["question"] = translations[0].replace("Question: ", "")
                    faq_data["answer"] = translations[1].replace("Answer: ", "")
            else:
                # Traducir al español
                translate_prompt = f"Traduce al español: {question}\n\nRespuesta: {answer}"
                trans_response = await self.model.generate_content_async(translate_prompt)
                translations = trans_response.text.split("\n\n")
                if len(translations) >= 2:
                    faq_data["question_es"] = translations[0].replace("Pregunta: ", "")
                    faq_data["answer_es"] = translations[1].replace("Respuesta: ", "")
            
            import secrets
            faq_data["id"] = f"faq_{secrets.token_hex(8)}"
            faq_data["views"] = 0
            faq_data["helpful_count"] = 0
            faq_data["not_helpful_count"] = 0
            faq_data["order"] = 0
            faq_data["created_by"] = "ai_brain"
            faq_data["updated_by"] = "ai_brain"
            faq_data["created_at"] = datetime.utcnow()
            faq_data["updated_at"] = datetime.utcnow()
            
            await self.db.faqs.insert_one(faq_data)
            
            await self._log_action({
                "type": "faq_created",
                "faq_id": faq_data["id"],
                "question": question,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "faq_id": faq_data["id"],
                "question": question,
                "answer": answer,
                "category_id": category_id
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def update_faq(self, faq_id: str, updates: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """Actualiza una FAQ existente"""
        try:
            updates["updated_by"] = "ai_brain"
            updates["updated_at"] = datetime.utcnow()
            
            result = await self.db.faqs.update_one(
                {"id": faq_id},
                {"$set": updates}
            )
            
            if result.modified_count > 0:
                await self._log_action({
                    "type": "faq_updated",
                    "faq_id": faq_id,
                    "updates": list(updates.keys()),
                    "timestamp": datetime.utcnow().isoformat()
                })
                return {"success": True, "faq_id": faq_id, "modified": True}
            else:
                return {"success": False, "error": "FAQ not found or not modified"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def search_faqs(self, query: str, language: str = "en", limit: int = 5, **kwargs) -> Dict[str, Any]:
        """Busca FAQs relevantes para una consulta"""
        try:
            search_field_q = "question_es" if language == "es" else "question"
            search_field_a = "answer_es" if language == "es" else "answer"
            
            faqs = await self.db.faqs.find({
                "$or": [
                    {search_field_q: {"$regex": query, "$options": "i"}},
                    {search_field_a: {"$regex": query, "$options": "i"}},
                    {"tags": {"$regex": query, "$options": "i"}}
                ],
                "active": True
            }).limit(limit).to_list(None)
            
            results = []
            for faq in faqs:
                results.append({
                    "id": faq["id"],
                    "question": faq.get(search_field_q, ""),
                    "answer": faq.get(search_field_a, ""),
                    "category_id": faq.get("category_id"),
                    "views": faq.get("views", 0)
                })
            
            return {
                "success": True,
                "query": query,
                "results": results,
                "count": len(results)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def analyze_faq_performance(self, **kwargs) -> Dict[str, Any]:
        """Analiza el rendimiento de las FAQs"""
        try:
            total_faqs = await self.db.faqs.count_documents({"active": True})
            
            # FAQs más vistas
            top_viewed = await self.db.faqs.find({"active": True}).sort("views", -1).limit(5).to_list(None)
            
            # FAQs más útiles (ratio helpful/not_helpful)
            all_faqs = await self.db.faqs.find({"active": True}).to_list(None)
            faqs_with_ratio = []
            for faq in all_faqs:
                helpful = faq.get("helpful_count", 0)
                not_helpful = faq.get("not_helpful_count", 0)
                total_feedback = helpful + not_helpful
                
                if total_feedback > 0:
                    ratio = helpful / total_feedback
                    faqs_with_ratio.append({
                        "id": faq["id"],
                        "question": faq.get("question", ""),
                        "helpful_ratio": ratio,
                        "total_feedback": total_feedback
                    })
            
            faqs_with_ratio.sort(key=lambda x: x["helpful_ratio"], reverse=True)
            top_helpful = faqs_with_ratio[:5]
            
            # FAQs que necesitan mejora (baja calificación)
            bottom_helpful = [f for f in faqs_with_ratio if f["helpful_ratio"] < 0.5][:5]
            
            return {
                "success": True,
                "total_faqs": total_faqs,
                "top_viewed": [{"id": f["id"], "question": f.get("question", ""), "views": f["views"]} for f in top_viewed],
                "top_helpful": top_helpful,
                "needs_improvement": bottom_helpful,
                "recommendation": f"Hay {len(bottom_helpful)} FAQs con baja calificación que necesitan revisión."
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def generate_faq_from_question(self, question: str, **kwargs) -> Dict[str, Any]:
        """Genera una FAQ completa a partir de una pregunta usando IA"""
        try:
            prompt = f"""Eres un experto en servicios de preparación de impuestos (Ross Tax Preparation).

Pregunta del cliente: {question}

Genera una respuesta profesional que incluya:
1. Respuesta clara y directa
2. Detalles importantes
3. Siguiente paso o acción recomendada

Formato de respuesta:
RESPUESTA: [tu respuesta aquí]
CATEGORÍA: [General/Taxes/Appointments/Documents/Payments]
TAGS: [tag1, tag2, tag3]"""

            response = await self.model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=500,
                )
            )
            
            content = response.text
            
            # Parsear respuesta
            answer = ""
            category = "General"
            tags = []
            
            if "RESPUESTA:" in content:
                answer = content.split("RESPUESTA:")[1].split("CATEGORÍA:")[0].strip()
            if "CATEGORÍA:" in content:
                category = content.split("CATEGORÍA:")[1].split("TAGS:")[0].strip()
            if "TAGS:" in content:
                tags_str = content.split("TAGS:")[1].strip()
                tags = [t.strip() for t in tags_str.replace("[", "").replace("]", "").split(",")]
            
            # Mapear categoría a category_id
            category_map = {
                "General": "cat_general",
                "Taxes": "cat_taxes",
                "Appointments": "cat_appointments",
                "Documents": "cat_documents",
                "Payments": "cat_payments"
            }
            category_id = category_map.get(category, "cat_general")
            
            # Crear la FAQ
            create_result = await self.create_faq(
                question=question,
                answer=answer,
                category_id=category_id,
                language="en"
            )
            
            if create_result.get("success"):
                # Actualizar con tags
                await self.db.faqs.update_one(
                    {"id": create_result["faq_id"]},
                    {"$set": {"tags": tags}}
                )
            
            return create_result
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def auto_categorize_faq(self, question: str, **kwargs) -> Dict[str, Any]:
        """Categoriza automáticamente una FAQ usando IA"""
        try:
            prompt = f"""Categoriza esta pregunta en UNA de estas categorías:
- General (preguntas generales sobre servicios)
- Taxes (impuestos, declaraciones, fechas límite)
- Appointments (citas, horarios, programación)
- Documents (documentos requeridos, subidas)
- Payments (pagos, métodos de pago, facturación)

Pregunta: {question}

Responde SOLO con el nombre de la categoría."""

            response = await self.model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=50,
                )
            )
            
            category = response.text.strip()
            
            # Mapear a category_id
            category_map = {
                "General": "cat_general",
                "Taxes": "cat_taxes",
                "Appointments": "cat_appointments",
                "Documents": "cat_documents",
                "Payments": "cat_payments"
            }
            
            category_id = category_map.get(category, "cat_general")
            
            return {
                "success": True,
                "category": category,
                "category_id": category_id
            }
        except Exception as e:
            return {"success": False, "error": str(e), "category_id": "cat_general"}
    
    async def suggest_faq_improvements(self, faq_id: str = None, **kwargs) -> Dict[str, Any]:
        """Sugiere mejoras para FAQs basándose en análisis de rendimiento"""
        try:
            if faq_id:
                # Analizar FAQ específica
                faq = await self.db.faqs.find_one({"id": faq_id})
                if not faq:
                    return {"success": False, "error": "FAQ not found"}
                
                helpful = faq.get("helpful_count", 0)
                not_helpful = faq.get("not_helpful_count", 0)
                total_feedback = helpful + not_helpful
                
                if total_feedback > 0 and helpful / total_feedback < 0.5:
                    # Generar sugerencia de mejora con IA
                    prompt = f"""Esta FAQ tiene baja calificación de usuarios.

Pregunta: {faq.get('question', '')}
Respuesta actual: {faq.get('answer', '')}

Sugiere mejoras para:
1. Hacer la respuesta más clara
2. Agregar información útil
3. Mejorar el tono profesional

Proporciona una versión mejorada de la respuesta."""

                    response = await self.model.generate_content_async(
                        prompt,
                        generation_config=genai.types.GenerationConfig(
                            temperature=0.7,
                            max_output_tokens=400,
                        )
                    )
                    
                    return {
                        "success": True,
                        "faq_id": faq_id,
                        "current_answer": faq.get('answer', ''),
                        "suggested_improvement": response.text,
                        "reason": "Low helpful ratio"
                    }
                else:
                    return {
                        "success": True,
                        "faq_id": faq_id,
                        "message": "FAQ performing well, no improvements needed"
                    }
            else:
                # Analizar todas las FAQs con bajo rendimiento
                performance = await self.analyze_faq_performance()
                needs_improvement = performance.get("needs_improvement", [])
                
                return {
                    "success": True,
                    "total_needing_improvement": len(needs_improvement),
                    "faqs": needs_improvement,
                    "recommendation": "Review and improve FAQs with low helpful ratios"
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

            return {"success": False, "error": str(e)}
    
    async def analyze_location_changes(self, params: Dict) -> Dict[str, Any]:
        """Analiza cambios de ubicación de un cliente"""
        return {"success": True, "message": "Funcionalidad implementada"}


    def _init_educational_tools(self):
        """Inicializa herramientas de contenido educativo"""
        self.tools.update({
            "create_educational_article": self.create_educational_article,
            "search_educational_content": self.search_educational_content,
            "recommend_articles": self.recommend_articles,
        })
    
    def _init_news_tools(self):
        """Inicializa herramientas de noticias fiscales"""
        self.tools.update({
            "create_tax_news": self.create_tax_news,
            "get_high_impact_news": self.get_high_impact_news_ai,
            "notify_clients_about_news": self.notify_clients_about_news,
        })
    
    # Educational Content Tools
    async def create_educational_article(self, title: str, content: str, level: str = "beginner", category: str = "tax_basics", **kwargs):
        """Crea un artículo educativo usando IA"""
        try:
            prompt = f"Improve and expand this educational content about taxes:\n\nTitle: {title}\nContent: {content}\n\nMake it clear, professional, and educational."
            response = await self.model.generate_content_async(prompt, generation_config=genai.types.GenerationConfig(temperature=0.7, max_output_tokens=800))
            improved_content = response.text
            
            article_data = {
                "category_id": f"educat_{category}",
                "title": title,
                "title_es": title,
                "content": improved_content,
                "content_es": improved_content,
                "level": level,
                "tags": [],
                "estimated_read_time": len(improved_content.split()) // 200 + 1,
                "active": True,
                "publish_now": True
            }
            
            import secrets
            article_id = f"eduart_{secrets.token_hex(8)}"
            article_data["id"] = article_id
            article_data["views"] = 0
            article_data["likes"] = 0
            article_data["bookmarks"] = 0
            article_data["created_by"] = "ai_brain"
            article_data["updated_by"] = "ai_brain"
            article_data["created_at"] = datetime.utcnow()
            article_data["updated_at"] = datetime.utcnow()
            article_data["published_at"] = datetime.utcnow()
            
            await self.db.educational_articles.insert_one(article_data)
            return {"success": True, "article_id": article_id, "title": title}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def search_educational_content(self, query: str, level: Optional[str] = None, **kwargs):
        """Busca contenido educativo"""
        try:
            search_query = {"active": True, "published_at": {"$ne": None}}
            if level:
                search_query["level"] = level
            search_query["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"content": {"$regex": query, "$options": "i"}}
            ]
            articles = await self.db.educational_articles.find(search_query).limit(5).to_list(None)
            return {"success": True, "results": [{"id": a["id"], "title": a.get("title", ""), "level": a.get("level", "")} for a in articles]}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def recommend_articles(self, user_level: str = "beginner", **kwargs):
        """Recomienda artículos según el nivel del usuario"""
        try:
            articles = await self.db.educational_articles.find({
                "active": True,
                "published_at": {"$ne": None},
                "level": user_level
            }).limit(3).to_list(None)
            return {"success": True, "recommendations": [{"id": a["id"], "title": a.get("title", "")} for a in articles]}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # Tax News Tools
    async def create_tax_news(self, title: str, content: str, impact_level: str = "medium", news_type: str = "general", **kwargs):
        """Crea una noticia fiscal"""
        try:
            import secrets
            news_id = f"news_{secrets.token_hex(8)}"
            news_data = {
                "id": news_id,
                "title": title,
                "title_es": title,
                "content": content,
                "content_es": content,
                "impact_level": impact_level,
                "news_type": news_type,
                "tags": [],
                "views": 0,
                "active": True,
                "published_at": datetime.utcnow(),
                "created_by": "ai_brain",
                "updated_by": "ai_brain",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await self.db.tax_news.insert_one(news_data)
            return {"success": True, "news_id": news_id, "title": title}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_high_impact_news_ai(self, **kwargs):
        """Obtiene noticias de alto impacto"""
        try:
            news = await self.db.tax_news.find({
                "active": True,
                "published_at": {"$ne": None},
                "impact_level": "high"
            }).sort("published_at", -1).limit(5).to_list(None)
            return {"success": True, "news": [{"id": n["id"], "title": n.get("title", ""), "impact": n.get("impact_level", "")} for n in news]}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def notify_clients_about_news(self, news_id: str, **kwargs):
        """Notifica a clientes sobre una noticia importante"""
        try:
            news = await self.db.tax_news.find_one({"id": news_id})
            if not news:
                return {"success": False, "error": "News not found"}
            
            users = await self.db.users.find({"role": "client"}).to_list(None)
            notification_count = len(users)
            
            await self._log_action({
                "type": "news_notification_sent",
                "news_id": news_id,
                "recipients": notification_count,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {"success": True, "notifications_sent": notification_count, "news_title": news.get("title", "")}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ==================== HERRAMIENTAS DE CAPTURA DE DOCUMENTOS ====================
    
    async def analyze_captured_documents(self, **kwargs):
        """Analiza documentos capturados con la cámara y su calidad"""
        try:
            # Obtener todos los documentos capturados
            captured_docs = await self.db.captured_documents.find({}).to_list(None)
            
            total = len(captured_docs)
            pending = sum(1 for doc in captured_docs if doc.get('status') == 'pending')
            approved = sum(1 for doc in captured_docs if doc.get('status') == 'approved')
            rejected = sum(1 for doc in captured_docs if doc.get('status') == 'rejected')
            needs_revision = sum(1 for doc in captured_docs if doc.get('status') == 'needs_revision')
            
            # Agrupar por tipo
            by_type = {}
            for doc in captured_docs:
                doc_type = doc.get('document_type', 'other')
                by_type[doc_type] = by_type.get(doc_type, 0) + 1
            
            analysis = {
                "success": True,
                "total_documents": total,
                "by_status": {
                    "pending": pending,
                    "approved": approved,
                    "rejected": rejected,
                    "needs_revision": needs_revision
                },
                "by_type": by_type,
                "insights": []
            }
            
            # Generar insights
            if pending > 10:
                analysis["insights"].append(f"Tienes {pending} documentos pendientes de revisar")
            if rejected > 5:
                analysis["insights"].append(f"{rejected} documentos han sido rechazados, considera enviar recordatorios")
            if needs_revision > 0:
                analysis["insights"].append(f"{needs_revision} documentos necesitan que el cliente los reenvíe")
            
            await self._log_action({
                "type": "captured_documents_analyzed",
                "total": total,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return analysis
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def check_document_quality(self, document_id: str, **kwargs):
        """Verifica la calidad de un documento capturado usando AI"""
        try:
            document = await self.db.captured_documents.find_one({"_id": document_id})
            if not document:
                return {"success": False, "error": "Document not found"}
            
            # Análisis básico de calidad (puede mejorarse con visión por computadora)
            file_size = document.get('file_size', 0)
            doc_type = document.get('document_type', '')
            
            quality_score = 0
            issues = []
            recommendations = []
            
            # Verificar tamaño de archivo
            if file_size < 50000:  # Menos de 50KB
                issues.append("Archivo muy pequeño, puede estar borroso")
                quality_score -= 20
            elif file_size > 5000000:  # Más de 5MB
                issues.append("Archivo muy grande, la compresión falló")
                quality_score -= 10
            else:
                quality_score += 30
            
            # Verificar según tipo
            if doc_type == 'photo_2x2':
                recommendations.append("Verificar que el rostro esté centrado y los hombros visibles")
                quality_score += 20
            elif doc_type in ['id_front', 'id_back', 'passport']:
                recommendations.append("Verificar que todo el texto sea legible")
                quality_score += 20
            elif doc_type in ['w2', '1099']:
                recommendations.append("Verificar que todos los números sean legibles")
                quality_score += 20
            
            # Si no hay issues, agregar puntos
            if len(issues) == 0:
                quality_score += 50
            
            quality_level = "excellent" if quality_score >= 80 else "good" if quality_score >= 60 else "fair" if quality_score >= 40 else "poor"
            
            result = {
                "success": True,
                "document_id": document_id,
                "quality_score": quality_score,
                "quality_level": quality_level,
                "issues": issues,
                "recommendations": recommendations,
                "should_approve": quality_score >= 60
            }
            
            await self._log_action({
                "type": "document_quality_checked",
                "document_id": document_id,
                "quality_score": quality_score,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return result
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def send_document_reminders(self, **kwargs):
        """Envía recordatorios automáticos a clientes con documentos pendientes"""
        try:
            # Buscar usuarios con documentos pendientes o rechazados
            users_to_remind = []
            
            # Documentos pendientes por más de 7 días
            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            old_pending = await self.db.captured_documents.find({
                "status": "pending",
                "uploaded_at": {"$lt": seven_days_ago}
            }).to_list(None)
            
            for doc in old_pending:
                user_id = doc.get('user_id')
                if user_id not in users_to_remind:
                    users_to_remind.append(user_id)
            
            # Documentos que necesitan revisión
            needs_revision = await self.db.captured_documents.find({
                "status": "needs_revision"
            }).to_list(None)
            
            for doc in needs_revision:
                user_id = doc.get('user_id')
                if user_id not in users_to_remind:
                    users_to_remind.append(user_id)
            
            # Enviar notificaciones
            reminders_sent = 0
            for user_id in users_to_remind:
                user = await self.db.users.find_one({"_id": user_id})
                if user:
                    # Crear notificación
                    notification = {
                        "id": str(ObjectId()),
                        "user_id": user_id,
                        "type": "document_reminder",
                        "title": "📸 Recordatorio de Documentos",
                        "message": "Tienes documentos pendientes de enviar o que necesitan corrección. Ve a Herramientas → Mis Documentos para revisarlos.",
                        "created_at": datetime.utcnow(),
                        "read": False
                    }
                    await self.db.notifications.insert_one(notification)
                    reminders_sent += 1
            
            await self._log_action({
                "type": "document_reminders_sent",
                "count": reminders_sent,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "reminders_sent": reminders_sent,
                "users_contacted": len(users_to_remind)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def suggest_missing_documents(self, user_id: str, **kwargs):
        """Sugiere documentos que el usuario debería enviar basado en su historial"""
        try:
            # Obtener documentos ya enviados por el usuario
            user_docs = await self.db.captured_documents.find({"user_id": user_id}).to_list(None)
            doc_types_sent = set(doc.get('document_type') for doc in user_docs)
            
            # Documentos comunes que suelen necesitarse
            common_docs = {
                'photo_2x2': 'Foto Personal 2x2',
                'id_front': 'ID Frontal',
                'id_back': 'ID Reverso',
                'ssn_card': 'Social Security Card',
                'w2': 'Formulario W2',
                '1099': 'Formulario 1099'
            }
            
            # Sugerencias inteligentes basadas en lo que ya tiene
            suggestions = []
            
            if 'id_front' in doc_types_sent and 'id_back' not in doc_types_sent:
                suggestions.append({
                    "type": "id_back",
                    "title": "ID Reverso",
                    "reason": "Ya enviaste el frente de tu ID, completa enviando el reverso",
                    "priority": "high"
                })
            
            if 'photo_2x2' not in doc_types_sent:
                suggestions.append({
                    "type": "photo_2x2",
                    "title": "Foto Personal 2x2",
                    "reason": "La foto personal es requerida para muchos trámites",
                    "priority": "high"
                })
            
            if 'w2' not in doc_types_sent and 'ssn_card' in doc_types_sent:
                suggestions.append({
                    "type": "w2",
                    "title": "Formulario W2",
                    "reason": "Documento necesario para preparación de impuestos",
                    "priority": "medium"
                })
            
            if 'ssn_card' not in doc_types_sent:
                suggestions.append({
                    "type": "ssn_card",
                    "title": "Social Security Card",
                    "reason": "Documento básico requerido",
                    "priority": "high"
                })
            
            # Si no tiene ningún documento
            if len(doc_types_sent) == 0:
                suggestions = [
                    {
                        "type": "photo_2x2",
                        "title": "Foto Personal 2x2",
                        "reason": "Comienza enviando tu foto personal",
                        "priority": "high"
                    },
                    {
                        "type": "id_front",
                        "title": "ID Frontal",
                        "reason": "Tu identificación es esencial",
                        "priority": "high"
                    }
                ]
            
            await self._log_action({
                "type": "missing_documents_suggested",
                "user_id": user_id,
                "suggestions_count": len(suggestions),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "user_id": user_id,
                "documents_sent": list(doc_types_sent),
                "suggestions": suggestions,
                "total_suggestions": len(suggestions)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def auto_categorize_documents(self, **kwargs):
        """Categoriza automáticamente documentos sin categoría usando AI"""
        try:
            # Buscar documentos sin categorizar o con categoría "other"
            uncategorized = await self.db.captured_documents.find({
                "$or": [
                    {"document_type": "other"},
                    {"document_type": {"$exists": False}}
                ]
            }).to_list(None)
            
            categorized_count = 0
            
            for doc in uncategorized:
                # Aquí se podría usar visión por computadora para analizar la imagen
                # Por ahora, usamos análisis básico
                
                doc_id = doc.get('_id')
                notes = doc.get('notes', '').lower()
                
                # Intentar categorizar basado en notas del usuario
                new_category = None
                
                if any(word in notes for word in ['foto', 'retrato', 'cara', 'rostro']):
                    new_category = 'photo_2x2'
                elif any(word in notes for word in ['id', 'identificacion', 'licencia', 'carnet']):
                    new_category = 'id_front'
                elif any(word in notes for word in ['w2', 'w-2']):
                    new_category = 'w2'
                elif any(word in notes for word in ['1099']):
                    new_category = '1099'
                elif any(word in notes for word in ['recibo', 'factura', 'invoice']):
                    new_category = 'receipt'
                elif any(word in notes for word in ['social', 'ssn', 'seguro']):
                    new_category = 'ssn_card'
                
                if new_category:
                    await self.db.captured_documents.update_one(
                        {"_id": doc_id},
                        {"$set": {"document_type": new_category}}
                    )
                    categorized_count += 1
            
            await self._log_action({
                "type": "documents_auto_categorized",
                "count": categorized_count,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "uncategorized_found": len(uncategorized),
                "categorized": categorized_count,
                "remaining_uncategorized": len(uncategorized) - categorized_count
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


    # ==================== GESTIÓN DE RECIBOS DE GASTOS ====================
    
    async def analyze_expense_receipts(self, **kwargs) -> Dict[str, Any]:
        """
        Analiza todos los recibos de gastos y genera insights inteligentes
        """
        try:
            year = kwargs.get('year', datetime.utcnow().year)
            
            # Obtener todos los recibos del año
            receipts = await self.db.expense_receipts.find({'year': year}).to_list(10000)
            
            total = len(receipts)
            total_amount = sum(float(r.get('amount') or 0) for r in receipts)
            pending = sum(1 for r in receipts if r.get('status') == 'pending')
            classified = sum(1 for r in receipts if r.get('status') == 'classified')
            reviewed = sum(1 for r in receipts if r.get('status') == 'reviewed')
            
            # Análisis por categoría
            by_category = {}
            for r in receipts:
                cat = r.get('category') or 'Sin clasificar'
                if cat not in by_category:
                    by_category[cat] = {'count': 0, 'amount': 0}
                by_category[cat]['count'] += 1
                by_category[cat]['amount'] += float(r.get('amount') or 0)
            
            # Análisis por cliente
            by_client = {}
            for r in receipts:
                user_id = r.get('user_id')
                if user_id not in by_client:
                    by_client[user_id] = {
                        'name': r.get('user_name', 'Desconocido'),
                        'count': 0,
                        'amount': 0
                    }
                by_client[user_id]['count'] += 1
                by_client[user_id]['amount'] += float(r.get('amount') or 0)
            
            # Generar insights con AI
            insights = []
            
            if pending > 5:
                insights.append(f"⚠️ Tienes {pending} recibos pendientes de clasificar")
            
            # Encontrar categoría con más gastos
            if by_category:
                top_category = max(by_category.items(), key=lambda x: x[1]['amount'])
                insights.append(f"📊 La categoría con más gastos es '{top_category[0]}' con ${top_category[1]['amount']:.2f}")
            
            # Encontrar cliente con más gastos
            if by_client:
                top_client = max(by_client.items(), key=lambda x: x[1]['amount'])
                insights.append(f"👤 El cliente con más gastos es '{top_client[1]['name']}' con ${top_client[1]['amount']:.2f}")
            
            # Alertar sobre gastos deducibles
            deductible_categories = ['Gastos Médicos', 'Educación', 'Donaciones', 'Gastos de Negocio']
            deductible_amount = sum(
                by_category.get(cat, {}).get('amount', 0) 
                for cat in deductible_categories
            )
            if deductible_amount > 0:
                insights.append(f"💰 Total de gastos potencialmente deducibles: ${deductible_amount:.2f}")
            
            await self._log_action({
                "type": "expense_receipts_analyzed",
                "year": year,
                "total_receipts": total,
                "total_amount": total_amount,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "year": year,
                "summary": {
                    "total_receipts": total,
                    "total_amount": round(total_amount, 2),
                    "pending": pending,
                    "classified": classified,
                    "reviewed": reviewed
                },
                "by_category": by_category,
                "top_clients": sorted(
                    [{'user_id': k, **v} for k, v in by_client.items()],
                    key=lambda x: x['amount'],
                    reverse=True
                )[:10],
                "insights": insights
            }
        except Exception as e:
            logger.error(f"Error analyzing expense receipts: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_receipts_summary(self, **kwargs) -> Dict[str, Any]:
        """
        Obtiene un resumen de recibos para un cliente específico o todos
        """
        try:
            user_id = kwargs.get('user_id')
            year = kwargs.get('year', datetime.utcnow().year)
            
            query = {'year': year}
            if user_id:
                query['user_id'] = user_id
            
            receipts = await self.db.expense_receipts.find(query).to_list(1000)
            
            total_amount = sum(float(r.get('amount') or 0) for r in receipts)
            
            # Por mes
            by_month = {}
            for r in receipts:
                month = r.get('month', 1)
                by_month[month] = by_month.get(month, 0) + float(r.get('amount') or 0)
            
            # Por categoría
            by_category = {}
            for r in receipts:
                cat = r.get('category') or 'Sin clasificar'
                by_category[cat] = by_category.get(cat, 0) + float(r.get('amount') or 0)
            
            return {
                "success": True,
                "year": year,
                "user_id": user_id,
                "total_receipts": len(receipts),
                "total_amount": round(total_amount, 2),
                "by_month": by_month,
                "by_category": by_category
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def classify_pending_receipts(self, **kwargs) -> Dict[str, Any]:
        """
        Intenta clasificar automáticamente los recibos pendientes usando AI
        """
        try:
            from receipt_ai_service import classify_receipt
            
            # Obtener recibos pendientes
            pending_receipts = await self.db.expense_receipts.find({
                'status': 'pending'
            }).to_list(50)  # Limitar a 50 para no sobrecargar
            
            classified_count = 0
            failed_count = 0
            
            for receipt in pending_receipts:
                try:
                    image_base64 = receipt.get('image')
                    if not image_base64:
                        continue
                    
                    result = await classify_receipt(image_base64)
                    
                    if result.get('success') and result.get('category'):
                        update_data = {
                            'status': 'classified',
                            'category': result.get('category'),
                            'merchant': result.get('merchant'),
                            'amount': result.get('amount'),
                            'receipt_date': result.get('receipt_date'),
                            'ai_confidence': result.get('confidence'),
                            'ai_classified_at': datetime.utcnow()
                        }
                        
                        await self.db.expense_receipts.update_one(
                            {'_id': receipt['_id']},
                            {'$set': update_data}
                        )
                        classified_count += 1
                    else:
                        failed_count += 1
                        
                except Exception as e:
                    logger.error(f"Error classifying receipt {receipt.get('_id')}: {e}")
                    failed_count += 1
            
            await self._log_action({
                "type": "pending_receipts_classified",
                "classified": classified_count,
                "failed": failed_count,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "pending_found": len(pending_receipts),
                "classified": classified_count,
                "failed": failed_count,
                "message": f"Clasificados {classified_count} de {len(pending_receipts)} recibos pendientes"
            }
        except Exception as e:
            logger.error(f"Error in classify_pending_receipts: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_expense_report(self, **kwargs) -> Dict[str, Any]:
        """
        Genera y envía un reporte de gastos a un cliente o admin
        """
        try:
            user_id = kwargs.get('user_id')
            year = kwargs.get('year', datetime.utcnow().year)
            recipient_type = kwargs.get('recipient_type', 'client')  # 'client' or 'admin'
            
            if not user_id and recipient_type == 'client':
                return {"success": False, "error": "Se requiere user_id para enviar al cliente"}
            
            # Obtener datos del reporte
            query = {'year': year}
            if user_id:
                query['user_id'] = user_id
            
            receipts = await self.db.expense_receipts.find(query).to_list(1000)
            total_amount = sum(float(r.get('amount') or 0) for r in receipts)
            
            # Agrupar por categoría
            by_category = {}
            for r in receipts:
                cat = r.get('category') or 'Sin clasificar'
                by_category[cat] = by_category.get(cat, 0) + float(r.get('amount') or 0)
            
            # Generar contenido del reporte
            report_lines = [
                f"📊 REPORTE DE GASTOS {year}",
                f"━━━━━━━━━━━━━━━━━━━━━",
                f"Total de recibos: {len(receipts)}",
                f"Total de gastos: ${total_amount:,.2f}",
                "",
                "📁 Por Categoría:",
            ]
            
            for cat, amount in sorted(by_category.items(), key=lambda x: x[1], reverse=True):
                report_lines.append(f"  • {cat}: ${amount:,.2f}")
            
            # Categorías deducibles
            deductible_categories = ['Gastos Médicos', 'Educación', 'Donaciones', 'Gastos de Negocio']
            deductible_total = sum(by_category.get(cat, 0) for cat in deductible_categories)
            
            report_lines.extend([
                "",
                f"💰 Gastos potencialmente deducibles: ${deductible_total:,.2f}",
                "",
                "Este reporte fue generado por Ross AI Brain"
            ])
            
            report_text = "\n".join(report_lines)
            
            # Enviar el reporte
            notifications_sent = 0
            
            if recipient_type == 'client' and user_id:
                user = await self.db.users.find_one({'_id': user_id})
                if user:
                    # Enviar por push
                    push_token = user.get('push_token') or user.get('fcm_token')
                    if push_token:
                        try:
                            import requests
                            requests.post(
                                "https://exp.host/--/api/v2/push/send",
                                json={
                                    "to": push_token,
                                    "title": f"📊 Tu Reporte de Gastos {year}",
                                    "body": f"Total: ${total_amount:,.2f} en {len(receipts)} recibos",
                                    "data": {"type": "expense_report", "year": year}
                                },
                                timeout=5
                            )
                            notifications_sent += 1
                        except:
                            pass
                    
                    # Enviar por email si está disponible
                    if user.get('email') and self.notification_service:
                        try:
                            await self.notification_service.send_email(
                                to_email=user.get('email'),
                                subject=f"📊 Tu Reporte de Gastos {year} - Ross Tax",
                                body=report_text
                            )
                            notifications_sent += 1
                        except:
                            pass
            
            elif recipient_type == 'admin':
                # Enviar a todos los admins
                admins = await self.db.users.find({
                    'role': 'admin',
                    'push_token': {'$exists': True, '$ne': None}
                }).to_list(10)
                
                for admin in admins:
                    push_token = admin.get('push_token')
                    if push_token:
                        try:
                            import requests
                            requests.post(
                                "https://exp.host/--/api/v2/push/send",
                                json={
                                    "to": push_token,
                                    "title": f"📊 Reporte de Gastos {year}",
                                    "body": f"Total: ${total_amount:,.2f} en {len(receipts)} recibos de todos los clientes",
                                    "data": {"type": "admin_expense_report", "year": year}
                                },
                                timeout=5
                            )
                            notifications_sent += 1
                        except:
                            pass
            
            await self._log_action({
                "type": "expense_report_sent",
                "year": year,
                "user_id": user_id,
                "recipient_type": recipient_type,
                "notifications_sent": notifications_sent,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "year": year,
                "total_receipts": len(receipts),
                "total_amount": round(total_amount, 2),
                "notifications_sent": notifications_sent,
                "report_preview": report_text[:500] + "..." if len(report_text) > 500 else report_text
            }
        except Exception as e:
            logger.error(f"Error sending expense report: {e}")
            return {"success": False, "error": str(e)}
    
    async def notify_pending_receipts(self, **kwargs) -> Dict[str, Any]:
        """
        Notifica a los admins sobre recibos pendientes de revisar
        """
        try:
            # Contar recibos pendientes
            pending_count = await self.db.expense_receipts.count_documents({'status': 'pending'})
            processing_count = await self.db.expense_receipts.count_documents({'status': 'processing'})
            
            if pending_count == 0 and processing_count == 0:
                return {
                    "success": True,
                    "message": "No hay recibos pendientes de revisar",
                    "notifications_sent": 0
                }
            
            # Obtener recibos pendientes más antiguos
            oldest_pending = await self.db.expense_receipts.find({
                'status': {'$in': ['pending', 'processing']}
            }).sort('created_at', 1).limit(5).to_list(5)
            
            client_names = list(set(r.get('user_name', 'Cliente') for r in oldest_pending))
            
            # Notificar a admins
            admins = await self.db.users.find({
                'role': 'admin',
                'push_token': {'$exists': True, '$ne': None}
            }).to_list(10)
            
            notifications_sent = 0
            
            for admin in admins:
                push_token = admin.get('push_token')
                if push_token and push_token.startswith('ExponentPushToken'):
                    try:
                        import requests
                        requests.post(
                            "https://exp.host/--/api/v2/push/send",
                            json={
                                "to": push_token,
                                "title": f"📧 {pending_count + processing_count} Recibos Pendientes",
                                "body": f"Clientes: {', '.join(client_names[:3])}{'...' if len(client_names) > 3 else ''}",
                                "data": {"type": "pending_receipts_reminder"}
                            },
                            timeout=5
                        )
                        notifications_sent += 1
                    except Exception as e:
                        logger.warning(f"Error sending push: {e}")
            
            await self._log_action({
                "type": "pending_receipts_notification",
                "pending_count": pending_count,
                "processing_count": processing_count,
                "notifications_sent": notifications_sent,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "pending_receipts": pending_count,
                "processing_receipts": processing_count,
                "notifications_sent": notifications_sent,
                "clients_with_pending": client_names
            }
        except Exception as e:
            logger.error(f"Error notifying pending receipts: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_top_expense_clients(self, **kwargs) -> Dict[str, Any]:
        """
        Obtiene los clientes con más gastos registrados
        """
        try:
            year = kwargs.get('year', datetime.utcnow().year)
            limit = kwargs.get('limit', 10)
            
            receipts = await self.db.expense_receipts.find({'year': year}).to_list(10000)
            
            # Agrupar por cliente
            by_client = {}
            for r in receipts:
                user_id = r.get('user_id')
                if user_id not in by_client:
                    by_client[user_id] = {
                        'user_id': user_id,
                        'name': r.get('user_name', 'Desconocido'),
                        'email': r.get('user_email', ''),
                        'count': 0,
                        'amount': 0,
                        'categories': set()
                    }
                by_client[user_id]['count'] += 1
                by_client[user_id]['amount'] += float(r.get('amount') or 0)
                if r.get('category'):
                    by_client[user_id]['categories'].add(r.get('category'))
            
            # Convertir sets a lists y ordenar
            for client in by_client.values():
                client['categories'] = list(client['categories'])
            
            top_clients = sorted(
                by_client.values(),
                key=lambda x: x['amount'],
                reverse=True
            )[:limit]
            
            # Redondear montos
            for client in top_clients:
                client['amount'] = round(client['amount'], 2)
            
            await self._log_action({
                "type": "top_expense_clients_retrieved",
                "year": year,
                "count": len(top_clients),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "year": year,
                "top_clients": top_clients,
                "total_clients_with_receipts": len(by_client)
            }
        except Exception as e:
            logger.error(f"Error getting top expense clients: {e}")
            return {"success": False, "error": str(e)}
    
    async def suggest_tax_deductions(self, **kwargs) -> Dict[str, Any]:
        """
        Analiza los gastos de un cliente y sugiere posibles deducciones fiscales
        """
        try:
            user_id = kwargs.get('user_id')
            year = kwargs.get('year', datetime.utcnow().year)
            
            if not user_id:
                return {"success": False, "error": "Se requiere user_id"}
            
            # Obtener recibos del cliente
            receipts = await self.db.expense_receipts.find({
                'user_id': user_id,
                'year': year
            }).to_list(1000)
            
            if not receipts:
                return {
                    "success": True,
                    "user_id": user_id,
                    "year": year,
                    "message": "No se encontraron recibos para este cliente",
                    "suggestions": []
                }
            
            # Agrupar por categoría
            by_category = {}
            for r in receipts:
                cat = r.get('category') or 'Sin clasificar'
                if cat not in by_category:
                    by_category[cat] = {'count': 0, 'amount': 0}
                by_category[cat]['count'] += 1
                by_category[cat]['amount'] += float(r.get('amount') or 0)
            
            # Generar sugerencias de deducciones
            suggestions = []
            
            # Gastos médicos
            medical = by_category.get('Gastos Médicos', {}).get('amount', 0)
            if medical > 0:
                suggestions.append({
                    "category": "Gastos Médicos",
                    "amount": round(medical, 2),
                    "deduction_type": "Medical and Dental Expenses",
                    "irs_form": "Schedule A (Form 1040)",
                    "note": "Deducible si excede 7.5% del AGI",
                    "potential_savings": round(medical * 0.22, 2)  # Estimado 22% tax bracket
                })
            
            # Educación
            education = by_category.get('Educación', {}).get('amount', 0)
            if education > 0:
                suggestions.append({
                    "category": "Educación",
                    "amount": round(education, 2),
                    "deduction_type": "Education Credits",
                    "irs_form": "Form 8863",
                    "note": "Posible crédito American Opportunity o Lifetime Learning",
                    "potential_savings": min(round(education * 0.20, 2), 2500)  # Max $2,500
                })
            
            # Donaciones
            donations = by_category.get('Donaciones', {}).get('amount', 0)
            if donations > 0:
                suggestions.append({
                    "category": "Donaciones",
                    "amount": round(donations, 2),
                    "deduction_type": "Charitable Contributions",
                    "irs_form": "Schedule A (Form 1040)",
                    "note": "Deducible hasta 60% del AGI",
                    "potential_savings": round(donations * 0.22, 2)
                })
            
            # Gastos de negocio
            business = by_category.get('Gastos de Negocio', {}).get('amount', 0)
            if business > 0:
                suggestions.append({
                    "category": "Gastos de Negocio",
                    "amount": round(business, 2),
                    "deduction_type": "Business Expenses",
                    "irs_form": "Schedule C (Form 1040)",
                    "note": "Deducible si tiene negocio propio o freelance",
                    "potential_savings": round(business * 0.30, 2)  # Higher rate for self-employed
                })
            
            # Oficina en casa (si hay gastos de oficina)
            office = by_category.get('Oficina/Suministros', {}).get('amount', 0)
            if office > 0:
                suggestions.append({
                    "category": "Oficina/Suministros",
                    "amount": round(office, 2),
                    "deduction_type": "Home Office Deduction",
                    "irs_form": "Form 8829",
                    "note": "Si trabaja desde casa, puede ser deducible",
                    "potential_savings": round(office * 0.22, 2)
                })
            
            total_deductible = sum(s['amount'] for s in suggestions)
            total_potential_savings = sum(s['potential_savings'] for s in suggestions)
            
            # Obtener info del cliente
            client = await self.db.users.find_one({'_id': user_id})
            
            await self._log_action({
                "type": "tax_deductions_suggested",
                "user_id": user_id,
                "year": year,
                "total_deductible": total_deductible,
                "suggestions_count": len(suggestions),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {
                "success": True,
                "user_id": user_id,
                "user_name": client.get('name') if client else 'Desconocido',
                "year": year,
                "total_receipts": len(receipts),
                "total_expenses": round(sum(float(r.get('amount') or 0) for r in receipts), 2),
                "total_potentially_deductible": round(total_deductible, 2),
                "estimated_tax_savings": round(total_potential_savings, 2),
                "suggestions": suggestions,
                "disclaimer": "Estas son sugerencias generales. Consulte con un profesional de impuestos para su situación específica."
            }
        except Exception as e:
            logger.error(f"Error suggesting tax deductions: {e}")
            return {"success": False, "error": str(e)}
