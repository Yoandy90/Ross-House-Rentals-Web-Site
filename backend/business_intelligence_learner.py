"""
Business Intelligence Learner - Analiza datos reales del negocio y genera conocimiento para Ross AI
Procesa: facturas, citas, clientes, emails, pagos
"""
import logging
import os
from typing import Dict, List, Any
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class BusinessIntelligenceLearner:
    def __init__(self, db, rag_memory):
        self.db = db
        self.rag_memory = rag_memory
        logger.info("✅ Business Intelligence Learner initialized")
    
    async def analyze_all_and_learn(self) -> Dict[str, Any]:
        """Analiza TODOS los datos del negocio y genera conocimiento automático"""
        results = {
            "invoices": await self.analyze_invoices(),
            "appointments": await self.analyze_appointments(),
            "clients": await self.analyze_clients(),
            "emails": await self.analyze_emails(),
            "generated_at": datetime.utcnow().isoformat()
        }
        
        # Store comprehensive summary as memory
        summary = self._generate_business_summary(results)
        await self.rag_memory.store_memory(
            memory_type="business_analysis",
            content=summary,
            metadata={"type": "full_analysis", "date": datetime.utcnow().isoformat()},
            tags=["business", "analysis", "auto_learning"]
        )
        
        results["knowledge_generated"] = True
        results["summary"] = summary
        return results
    
    # ==================== INVOICES ====================
    
    async def analyze_invoices(self) -> Dict:
        """Analiza todas las facturas y genera conocimiento"""
        try:
            invoices = await self.db.invoices.find().to_list(5000)
            if not invoices:
                return {"total": 0, "message": "No invoices found"}
            
            total = len(invoices)
            total_revenue = sum(inv.get('total', 0) or 0 for inv in invoices)
            avg_invoice = total_revenue / max(total, 1)
            
            # Payment methods
            payment_methods = Counter()
            for inv in invoices:
                pm = (inv.get('payment_method') or 'unknown').lower()
                payment_methods[pm] += 1
            
            # Status breakdown
            statuses = Counter()
            for inv in invoices:
                statuses[inv.get('status', 'unknown')] += 1
            
            # Monthly revenue
            monthly_revenue = defaultdict(float)
            monthly_count = defaultdict(int)
            for inv in invoices:
                created = inv.get('created_at') or inv.get('paid_at')
                if created:
                    if isinstance(created, str):
                        try:
                            created = datetime.fromisoformat(created.replace('Z', '+00:00'))
                        except Exception:
                            continue
                    month_key = created.strftime('%Y-%m')
                    monthly_revenue[month_key] += inv.get('total', 0) or 0
                    monthly_count[month_key] += 1
            
            # Popular services
            services = Counter()
            for inv in invoices:
                items = inv.get('items', [])
                for item in items:
                    desc = (item.get('description') or '').strip()
                    if desc:
                        services[desc] += 1
            
            # Top price points
            prices = [inv.get('total', 0) or 0 for inv in invoices if inv.get('total')]
            prices.sort()
            
            # Tax year distribution and revenue per year
            tax_years = Counter()
            revenue_by_year = defaultdict(float)
            count_by_year = defaultdict(int)
            for inv in invoices:
                ty = inv.get('tax_year')
                if ty:
                    tax_years[str(ty)] += 1
                    if inv.get('status') == 'paid':
                        revenue_by_year[str(ty)] += inv.get('total', 0) or 0
                        count_by_year[str(ty)] += 1
            
            revenue_2024 = round(revenue_by_year.get('2024', 0), 2)
            revenue_2025 = round(revenue_by_year.get('2025', 0), 2)
            
            analysis = {
                "total_invoices": total,
                "total_revenue": round(total_revenue, 2),
                "revenue_2024": revenue_2024,
                "revenue_2025": revenue_2025,
                "invoices_2024": count_by_year.get('2024', 0),
                "invoices_2025": count_by_year.get('2025', 0),
                "average_invoice": round(avg_invoice, 2),
                "payment_methods": dict(payment_methods.most_common(10)),
                "status_breakdown": dict(statuses),
                "top_services": dict(services.most_common(10)),
                "monthly_revenue": dict(sorted(monthly_revenue.items())[-12:]),
                "monthly_count": dict(sorted(monthly_count.items())[-12:]),
                "tax_years": dict(tax_years),
                "price_range": {
                    "min": prices[0] if prices else 0,
                    "max": prices[-1] if prices else 0,
                    "median": prices[len(prices)//2] if prices else 0
                }
            }
            
            # Generate knowledge
            knowledge_items = []
            
            # Revenue summary
            knowledge_items.append({
                "title": f"Resumen de Ingresos - {datetime.utcnow().strftime('%B %Y')}",
                "content": f"Total de facturas: {total}. Ingreso total: ${total_revenue:,.2f}. Revenue Temporada 2024: ${revenue_2024:,.2f} ({count_by_year.get('2024', 0)} facturas). Revenue Temporada 2025: ${revenue_2025:,.2f} ({count_by_year.get('2025', 0)} facturas). Promedio por factura: ${avg_invoice:,.2f}. Métodos de pago más usados: {', '.join(f'{k}({v})' for k,v in payment_methods.most_common(3))}. Facturas pagadas: {statuses.get('paid', 0)}, pendientes: {statuses.get('pending', 0)}.",
                "category": "analytics",
                "tags": ["revenue", "invoices", "auto_analysis"]
            })
            
            # Top services
            if services:
                top_svcs = services.most_common(5)
                knowledge_items.append({
                    "title": "Servicios Más Vendidos",
                    "content": f"Los servicios más solicitados son: {'. '.join(f'{desc} ({count} veces)' for desc, count in top_svcs)}.",
                    "category": "analytics",
                    "tags": ["services", "popular", "auto_analysis"]
                })
            
            # Monthly trends
            if monthly_revenue:
                sorted_months = sorted(monthly_revenue.items())
                last_3 = sorted_months[-3:] if len(sorted_months) >= 3 else sorted_months
                knowledge_items.append({
                    "title": "Tendencia de Ingresos Mensuales",
                    "content": f"Ingresos recientes por mes: {', '.join(f'{m}: ${r:,.2f} ({monthly_count[m]} facturas)' for m, r in last_3)}.",
                    "category": "analytics",
                    "tags": ["trends", "monthly", "auto_analysis"]
                })
            
            # Store knowledge
            for item in knowledge_items:
                await self.rag_memory.add_knowledge(
                    title=item["title"],
                    content=item["content"],
                    category=item["category"],
                    source="auto_analysis",
                    tags=item["tags"]
                )
            
            analysis["knowledge_generated"] = len(knowledge_items)
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing invoices: {e}")
            return {"error": str(e)}
    
    # ==================== APPOINTMENTS ====================
    
    async def analyze_appointments(self) -> Dict:
        """Analiza citas y genera conocimiento"""
        try:
            appointments = await self.db.appointments.find().to_list(5000)
            if not appointments:
                return {"total": 0, "message": "No appointments found"}
            
            total = len(appointments)
            
            # Status breakdown
            statuses = Counter()
            for apt in appointments:
                statuses[apt.get('status', 'unknown')] += 1
            
            # Appointment types
            types = Counter()
            for apt in appointments:
                types[apt.get('appointment_type', 'unknown')] += 1
            
            # Services
            services = Counter()
            for apt in appointments:
                svc = apt.get('service_name') or apt.get('title') or 'General'
                services[svc] += 1
            
            # Duration analysis
            durations = [apt.get('duration_minutes', 30) for apt in appointments]
            avg_duration = sum(durations) / max(len(durations), 1)
            
            # Day of week analysis
            day_counts = Counter()
            hour_counts = Counter()
            for apt in appointments:
                scheduled = apt.get('scheduled_at') or apt.get('created_at')
                if scheduled:
                    if isinstance(scheduled, str):
                        try:
                            scheduled = datetime.fromisoformat(scheduled.replace('Z', '+00:00'))
                        except Exception:
                            continue
                    if hasattr(scheduled, 'strftime'):
                        day_counts[scheduled.strftime('%A')] += 1
                        hour_counts[scheduled.hour] += 1
            
            # Source analysis
            sources = Counter()
            for apt in appointments:
                sources[apt.get('source', 'unknown')] += 1
            
            analysis = {
                "total_appointments": total,
                "status_breakdown": dict(statuses),
                "types": dict(types),
                "services": dict(services),
                "avg_duration_minutes": round(avg_duration, 1),
                "busiest_days": dict(day_counts.most_common(7)),
                "busiest_hours": dict(hour_counts.most_common(10)),
                "sources": dict(sources)
            }
            
            # Generate knowledge
            knowledge_items = []
            
            knowledge_items.append({
                "title": "Análisis de Citas del Negocio",
                "content": f"Total de citas: {total}. Confirmadas: {statuses.get('confirmed', 0)}, Completadas: {statuses.get('completed', 0)}, Canceladas: {statuses.get('cancelled', 0)}. Tipo más común: {types.most_common(1)[0][0] if types else 'N/A'}. Duración promedio: {avg_duration:.0f} minutos. Días más ocupados: {', '.join(f'{d}({c})' for d,c in day_counts.most_common(3))}.",
                "category": "analytics",
                "tags": ["appointments", "patterns", "auto_analysis"]
            })
            
            if hour_counts:
                peak_hours = hour_counts.most_common(3)
                knowledge_items.append({
                    "title": "Horas Pico de Citas",
                    "content": f"Las horas con más citas son: {', '.join(f'{h}:00 ({c} citas)' for h,c in peak_hours)}. Se recomienda tener disponibilidad adicional en estos horarios.",
                    "category": "analytics",
                    "tags": ["appointments", "schedule", "auto_analysis"]
                })
            
            for item in knowledge_items:
                await self.rag_memory.add_knowledge(
                    title=item["title"],
                    content=item["content"],
                    category=item["category"],
                    source="auto_analysis",
                    tags=item["tags"]
                )
            
            analysis["knowledge_generated"] = len(knowledge_items)
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing appointments: {e}")
            return {"error": str(e)}
    
    # ==================== CLIENTS ====================
    
    async def analyze_clients(self) -> Dict:
        """Analiza clientes y genera conocimiento"""
        try:
            clients = await self.db.season_clients.find().to_list(5000)
            if not clients:
                return {"total": 0, "message": "No clients found"}
            
            total = len(clients)
            
            # E-filed analysis
            efiled = sum(1 for c in clients if (c.get('efiled') or '').upper() == 'YES')
            not_efiled = total - efiled
            
            # 2025 season (current) - separate analysis
            efiled_2025 = sum(1 for c in clients if (c.get('efiled_2025') or '').upper() == 'YES')
            pending_2025 = sum(1 for c in clients if (c.get('efiled_2025') or '').upper() == 'NO')
            not_returned_2025 = sum(1 for c in clients if not c.get('efiled_2025') and not c.get('tax_year_2025'))
            has_ty_2025 = sum(1 for c in clients if c.get('tax_year_2025') == 2025)
            
            # State distribution
            states = Counter()
            for c in clients:
                state = (c.get('state') or 'Unknown').strip().upper()
                if state:
                    states[state] += 1
            
            # City distribution
            cities = Counter()
            for c in clients:
                city = (c.get('city') or '').strip().upper()
                if city:
                    cities[city] += 1
            
            # Email coverage
            has_email = sum(1 for c in clients if c.get('email'))
            has_phone = sum(1 for c in clients if c.get('phone'))
            
            # Tax year coverage
            ty_2024 = sum(1 for c in clients if c.get('tax_year') == 2024 or str(c.get('tax_year')) == '2024')
            ty_2025 = sum(1 for c in clients if c.get('efiled_2025') or c.get('tax_year_2025'))
            
            # Returning clients (filed both years)
            returning = sum(1 for c in clients 
                          if (c.get('efiled') or '').upper() == 'YES' 
                          and (c.get('efiled_2025') or '').upper() == 'YES')
            
            # Monthly filing patterns - analyze BOTH seasons
            monthly_filings_2024 = Counter()
            monthly_filings_2025 = Counter()
            for c in clients:
                # 2024 e-file dates
                edate = c.get('efiled_date')
                if edate and isinstance(edate, str) and edate.strip():
                    try:
                        dt = datetime.fromisoformat(edate.replace('Z', '+00:00').strip())
                        monthly_filings_2024[dt.strftime('%Y-%m')] += 1
                    except Exception:
                        pass
                
                # 2025 e-file dates
                edate25 = c.get('efiled_date_2025')
                if edate25 and isinstance(edate25, str) and edate25.strip():
                    try:
                        dt25 = datetime.fromisoformat(edate25.replace('Z', '+00:00').strip())
                        monthly_filings_2025[dt25.strftime('%Y-%m')] += 1
                    except Exception:
                        pass
            
            analysis = {
                "total_clients": total,
                "season_2024": {
                    "efiled": efiled,
                    "not_efiled": not_efiled,
                    "efile_rate": round((efiled / max(total, 1)) * 100, 1)
                },
                "season_2025_current": {
                    "efiled": efiled_2025,
                    "pending": pending_2025,
                    "not_returned": not_returned_2025,
                    "started_process": has_ty_2025,
                    "efile_rate": round((efiled_2025 / max(total, 1)) * 100, 1)
                },
                "top_states": dict(states.most_common(10)),
                "top_cities": dict(cities.most_common(10)),
                "has_email": has_email,
                "has_phone": has_phone,
                "contact_coverage": round((has_email / max(total, 1)) * 100, 1),
                "returning_clients": returning,
                "retention_rate": round((returning / max(efiled, 1)) * 100, 1),
                "monthly_filings_2024": dict(sorted(monthly_filings_2024.items())),
                "monthly_filings_2025": dict(sorted(monthly_filings_2025.items()))
            }
            
            # Generate knowledge
            knowledge_items = []
            
            knowledge_items.append({
                "title": "Perfil de Clientes del Negocio",
                "content": f"Total de clientes: {total}. TEMPORADA 2024: {efiled} e-filed ({analysis['season_2024']['efile_rate']}%). TEMPORADA 2025 (ACTUAL): {efiled_2025} e-filed con fecha y hora, {pending_2025} pendientes de envío, {not_returned_2025} aún no han regresado. Retención (clientes que regresaron 2024→2025): {returning} ({analysis['retention_rate']}%). Con email: {has_email} ({analysis['contact_coverage']}%). Con teléfono: {has_phone}. Principales estados: {', '.join(f'{s}({c})' for s,c in states.most_common(5))}. Principales ciudades: {', '.join(f'{ci}({ct})' for ci,ct in cities.most_common(5))}.",
                "category": "analytics",
                "tags": ["clients", "demographics", "retention", "auto_analysis"]
            })
            
            # Clients needing follow-up (2024 e-filed but no 2025 activity)
            no_2025 = sum(1 for c in clients 
                        if (c.get('efiled') or '').upper() == 'YES' 
                        and not c.get('efiled_2025')
                        and not c.get('tax_year_2025'))
            if no_2025 > 0:
                knowledge_items.append({
                    "title": "Oportunidad: Clientes 2024 Sin Regresar para 2025",
                    "content": f"Hay {no_2025} clientes que declararon exitosamente en 2024 pero NO han regresado para la temporada 2025. Esto es una oportunidad importante de retención. Se recomienda campaña de follow-up por email, SMS y WhatsApp.",
                    "category": "oportunidades",
                    "tags": ["followup", "retention", "opportunity", "auto_analysis"]
                })
            
            # Monthly filing rhythm for 2025
            if monthly_filings_2025:
                knowledge_items.append({
                    "title": "Ritmo de E-filing Temporada 2025",
                    "content": f"Declaraciones enviadas por mes en temporada 2025: {', '.join(f'{m}: {c} declaraciones' for m,c in sorted(monthly_filings_2025.items()))}. Total e-filed 2025: {efiled_2025}.",
                    "category": "analytics",
                    "tags": ["efiling", "2025", "monthly", "auto_analysis"]
                })
            
            for item in knowledge_items:
                await self.rag_memory.add_knowledge(
                    title=item["title"],
                    content=item["content"],
                    category=item["category"],
                    source="auto_analysis",
                    tags=item["tags"]
                )
            
            analysis["knowledge_generated"] = len(knowledge_items)
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing clients: {e}")
            return {"error": str(e)}
    
    # ==================== EMAILS ====================
    
    async def analyze_emails(self) -> Dict:
        """Analiza el historial de emails enviados"""
        try:
            # Check if email_log collection exists
            emails = await self.db.email_log.find().sort("sent_at", -1).to_list(5000)
            
            if not emails:
                return {
                    "total": 0,
                    "message": "No email logs found yet. New emails will be tracked automatically.",
                    "knowledge_generated": 0
                }
            
            total = len(emails)
            
            # Type breakdown
            types = Counter()
            for e in emails:
                types[e.get('type', 'general')] += 1
            
            # Status
            statuses = Counter()
            for e in emails:
                statuses[e.get('status', 'sent')] += 1
            
            # Monthly
            monthly = Counter()
            for e in emails:
                sa = e.get('sent_at')
                if sa and hasattr(sa, 'strftime'):
                    monthly[sa.strftime('%Y-%m')] += 1
            
            analysis = {
                "total_emails": total,
                "types": dict(types.most_common(10)),
                "statuses": dict(statuses),
                "monthly": dict(sorted(monthly.items())[-6:])
            }
            
            # Generate knowledge
            if total > 0:
                await self.rag_memory.add_knowledge(
                    title="Análisis de Comunicación por Email",
                    content=f"Total de emails enviados: {total}. Tipos: {', '.join(f'{t}({c})' for t,c in types.most_common(5))}. Último mes más activo: {monthly.most_common(1)[0] if monthly else 'N/A'}.",
                    category="analytics",
                    source="auto_analysis",
                    tags=["email", "communication", "auto_analysis"]
                )
                analysis["knowledge_generated"] = 1
            else:
                analysis["knowledge_generated"] = 0
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing emails: {e}")
            return {"total": 0, "error": str(e), "knowledge_generated": 0}
    
    # ==================== EMAIL LOGGING ====================
    
    async def log_email(
        self,
        to_email: str,
        subject: str,
        email_type: str,
        status: str = "sent",
        client_name: str = "",
        metadata: Dict = None
    ):
        """Registra un email enviado para aprendizaje"""
        try:
            doc = {
                "to_email": to_email,
                "subject": subject,
                "type": email_type,
                "status": status,
                "client_name": client_name,
                "metadata": metadata or {},
                "sent_at": datetime.utcnow()
            }
            await self.db.email_log.insert_one(doc)
            logger.info(f"📧 Email logged: {email_type} to {to_email}")
        except Exception as e:
            logger.error(f"Error logging email: {e}")
    
    # ==================== BUSINESS SUMMARY ====================
    
    def _generate_business_summary(self, results: Dict) -> str:
        """Genera un resumen ejecutivo del negocio"""
        parts = ["📊 RESUMEN EJECUTIVO DEL NEGOCIO - Ross Tax Preparation\n"]
        parts.append(f"Fecha de análisis: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')}\n")
        
        # Invoices
        inv = results.get("invoices", {})
        if inv.get("total_invoices"):
            parts.append(f"\n💰 FACTURACIÓN:")
            parts.append(f"  - Total facturas: {inv['total_invoices']}")
            parts.append(f"  - Ingreso total: ${inv.get('total_revenue', 0):,.2f}")
            parts.append(f"  - Promedio por factura: ${inv.get('average_invoice', 0):,.2f}")
            parts.append(f"  - Precio mín: ${inv.get('price_range', {}).get('min', 0)}")
            parts.append(f"  - Precio máx: ${inv.get('price_range', {}).get('max', 0)}")
        
        # Clients
        cli = results.get("clients", {})
        if cli.get("total_clients"):
            s2024 = cli.get('season_2024', {})
            s2025 = cli.get('season_2025_current', {})
            parts.append(f"\n👥 CLIENTES:")
            parts.append(f"  - Total clientes en BD: {cli['total_clients']}")
            parts.append(f"  - TEMPORADA 2024: {s2024.get('efiled', 0)} e-filed ({s2024.get('efile_rate', 0)}%)")
            parts.append(f"  - TEMPORADA 2025 (ACTUAL):")
            parts.append(f"    • E-filed con fecha/hora: {s2025.get('efiled', 0)}")
            parts.append(f"    • Pendientes de envío: {s2025.get('pending', 0)}")
            parts.append(f"    • No han regresado: {s2025.get('not_returned', 0)}")
            parts.append(f"  - Retención (ambos años): {cli.get('returning_clients', 0)} ({cli.get('retention_rate', 0)}%)")
            parts.append(f"  - Con email: {cli.get('has_email', 0)} ({cli.get('contact_coverage', 0)}%)")
            parts.append(f"  - Con teléfono: {cli.get('has_phone', 0)}")
        
        # Appointments
        apt = results.get("appointments", {})
        if apt.get("total_appointments"):
            parts.append(f"\n📅 CITAS:")
            parts.append(f"  - Total citas: {apt['total_appointments']}")
            parts.append(f"  - Duración promedio: {apt.get('avg_duration_minutes', 0)} min")
        
        # Emails
        eml = results.get("emails", {})
        parts.append(f"\n📧 EMAILS:")
        parts.append(f"  - Total emails registrados: {eml.get('total_emails', 0)}")
        
        return "\n".join(parts)


logger.info("✅ Business Intelligence Learner module loaded")
