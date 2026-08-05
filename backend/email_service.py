"""
Email Service - Professional Email Templates for Ross Tax
Centralized service for all email communications including invoices, reminders, etc.
"""
from datetime import datetime
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

# Get notification service instance (will be set at startup)
notification_service_instance = None

def set_notification_service(service):
    """Set the notification service instance"""
    global notification_service_instance
    notification_service_instance = service
    logger.info("✅ Email service connected to notification service")


class EmailService:
    """Professional email templates and sending service"""
    
    def __init__(self):
        self.company_name = "Ross Tax Preparation"
        self.company_phone = "(806) 934-2018"
        self.company_email = "info@rosstaxpreparation.com"
        self.company_address = "305 Bruce Ave, Dumas, TX 79029"
        self.company_website = "https://rosstaxpreparation.com"
    
    def _get_base_template(self, content: str, header_color: str = "#1E3A5F", header_emoji: str = "📄", header_title: str = "Ross Tax") -> str:
        """Get base email template wrapper"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
                <tr>
                    <td align="center">
                        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, {header_color} 0%, {self._lighten_color(header_color)} 100%); padding: 40px 30px; text-align: center;">
                                    <div style="font-size: 50px; margin-bottom: 10px;">{header_emoji}</div>
                                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">{header_title}</h1>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 40px 30px;">
                                    {content}
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #1E3A5F; padding: 25px 30px; text-align: center;">
                                    <p style="color: rgba(255,255,255,0.9); margin: 0 0 5px 0; font-size: 14px; font-weight: 500;">{self.company_name}</p>
                                    <p style="color: rgba(255,255,255,0.7); margin: 0 0 10px 0; font-size: 12px;">{self.company_address}</p>
                                    <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px;">© 2026 {self.company_name} LLC. Todos los derechos reservados.</p>
                                    <div style="margin-top: 15px;">
                                        <a href="{self.company_website}" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 12px; margin: 0 10px;">Sitio Web</a>
                                        <span style="color: rgba(255,255,255,0.4);">|</span>
                                        <a href="mailto:{self.company_email}" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 12px; margin: 0 10px;">Soporte</a>
                                        <span style="color: rgba(255,255,255,0.4);">|</span>
                                        <a href="tel:{self.company_phone}" style="color: rgba(255,255,255,0.7); text-decoration: none; font-size: 12px; margin: 0 10px;">{self.company_phone}</a>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
    
    def _lighten_color(self, hex_color: str) -> str:
        """Lighten a hex color for gradient"""
        # Simple lightening - add some blue
        if hex_color == "#1E3A5F":
            return "#2E5A8F"
        elif hex_color == "#6C1110":
            return "#8B2A28"
        elif hex_color == "#D97706":
            return "#F59E0B"
        elif hex_color == "#059669":
            return "#10B981"
        elif hex_color == "#DC2626":
            return "#EF4444"
        return "#4A7BC7"
    
    def get_invoice_created_email(
        self,
        client_name: str,
        invoice_number: str,
        service_name: str,
        items: list,
        subtotal: float,
        tax: float,
        total: float,
        due_date: Optional[datetime] = None,
        notes: Optional[str] = None
    ) -> str:
        """Generate professional invoice created email"""
        
        due_date_str = due_date.strftime('%d/%m/%Y') if due_date else "Por definir"
        created_date = datetime.utcnow().strftime('%d/%m/%Y')
        
        # Build items table
        items_html = ""
        for item in items:
            item_name = item.get('description', item.get('name', 'Servicio'))
            item_qty = item.get('quantity', 1)
            item_price = item.get('unit_price', item.get('price', 0))
            item_total = item.get('total', item_qty * item_price)
            items_html += f"""
            <tr>
                <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; color: #334155;">{item_name}</td>
                <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b;">{item_qty}</td>
                <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #64748b;">${item_price:.2f}</td>
                <td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #334155;">${item_total:.2f}</td>
            </tr>
            """
        
        content = f"""
        <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">Hola <strong style="color: #1E3A5F;">{client_name}</strong>,</p>
        <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 30px 0;">
            Se ha generado una nueva factura para ti. A continuación encontrarás todos los detalles.
        </p>
        
        <!-- Invoice Card -->
        <div style="background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); border-radius: 12px; padding: 25px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
            <!-- Invoice Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1E3A5F;">
                <div>
                    <span style="font-size: 24px; margin-right: 10px;">📄</span>
                    <span style="color: #1E3A5F; font-size: 20px; font-weight: 600;">Factura #{invoice_number}</span>
                </div>
                <span style="background: #FEF3C7; color: #D97706; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">PENDIENTE</span>
            </div>
            
            <!-- Invoice Info -->
            <table style="width: 100%; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 50%;">📅 Fecha de emisión:</td>
                    <td style="padding: 8px 0; color: #334155; font-weight: 500;">{created_date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">📆 Fecha de vencimiento:</td>
                    <td style="padding: 8px 0; color: #DC2626; font-weight: 600;">{due_date_str}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">🏷️ Servicio:</td>
                    <td style="padding: 8px 0; color: #334155; font-weight: 500;">{service_name}</td>
                </tr>
            </table>
            
            <!-- Items Table -->
            <div style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 12px 8px; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Descripción</th>
                            <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Cant.</th>
                            <th style="padding: 12px 8px; text-align: right; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Precio</th>
                            <th style="padding: 12px 8px; text-align: right; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                </table>
            </div>
            
            <!-- Totals -->
            <div style="background: #f8fafc; border-radius: 8px; padding: 15px;">
                <table style="width: 100%;">
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subtotal:</td>
                        <td style="padding: 6px 0; text-align: right; color: #334155;">${subtotal:.2f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Impuestos:</td>
                        <td style="padding: 6px 0; text-align: right; color: #334155;">${tax:.2f}</td>
                    </tr>
                    <tr style="border-top: 2px solid #1E3A5F;">
                        <td style="padding: 12px 0 6px 0; color: #1E3A5F; font-size: 18px; font-weight: 700;">TOTAL:</td>
                        <td style="padding: 12px 0 6px 0; text-align: right; color: #1E3A5F; font-size: 24px; font-weight: 700;">${total:.2f}</td>
                    </tr>
                </table>
            </div>
        </div>
        
        {f'<div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin-bottom: 25px;"><p style="margin: 0; color: #92400E; font-size: 14px;"><strong>📝 Notas:</strong> {notes}</p></div>' if notes else ''}
        
        <!-- Payment Methods -->
        <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h4 style="color: #0369A1; margin: 0 0 15px 0; font-size: 16px;">💳 Métodos de Pago Aceptados:</h4>
            <ul style="color: #0369A1; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Pago en línea con tarjeta de crédito/débito</li>
                <li>Transferencia bancaria (ACH)</li>
                <li>Créditos de la app</li>
                <li>Efectivo en nuestra oficina</li>
            </ul>
        </div>
        
        <!-- CTA -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="{self.company_website}" style="display: inline-block; background: linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 16px;">Ver y Pagar Factura</a>
        </div>
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 25px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Si tienes alguna pregunta sobre esta factura, no dudes en contactarnos. Estamos aquí para ayudarte.
        </p>
        """
        
        return self._get_base_template(content, "#1E3A5F", "📄", "Nueva Factura")
    
    def get_invoice_reminder_email(
        self,
        client_name: str,
        invoice_number: str,
        amount: float,
        due_date: Optional[datetime] = None,
        days_overdue: int = 0
    ) -> str:
        """Generate professional invoice reminder email"""
        
        due_date_str = due_date.strftime('%d/%m/%Y') if due_date else "Vencida"
        
        # Determine urgency level
        if days_overdue > 30:
            urgency_color = "#DC2626"
            urgency_bg = "#FEE2E2"
            urgency_text = "⚠️ URGENTE - Más de 30 días vencida"
            header_emoji = "🚨"
        elif days_overdue > 0:
            urgency_color = "#D97706"
            urgency_bg = "#FEF3C7"
            urgency_text = f"⏰ Vencida hace {days_overdue} días"
            header_emoji = "⏰"
        else:
            urgency_color = "#D97706"
            urgency_bg = "#FEF3C7"
            urgency_text = "📅 Próxima a vencer"
            header_emoji = "📋"
        
        content = f"""
        <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">Hola <strong style="color: #1E3A5F;">{client_name}</strong>,</p>
        
        <!-- Urgency Banner -->
        <div style="background: {urgency_bg}; border-left: 4px solid {urgency_color}; border-radius: 0 8px 8px 0; padding: 15px 20px; margin-bottom: 25px;">
            <p style="margin: 0; color: {urgency_color}; font-weight: 600; font-size: 16px;">{urgency_text}</p>
        </div>
        
        <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 30px 0;">
            Te recordamos que tienes una factura pendiente de pago. Por favor, realiza el pago lo antes posible para evitar cargos adicionales.
        </p>
        
        <!-- Invoice Summary Card -->
        <div style="background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); border-radius: 12px; padding: 25px; border: 1px solid #e2e8f0; margin-bottom: 25px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px;">📋</span>
                <h3 style="color: #1E3A5F; margin: 10px 0 0 0; font-size: 18px;">Factura #{invoice_number}</h3>
            </div>
            
            <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%); border-radius: 10px; padding: 25px; text-align: center; margin-bottom: 20px;">
                <p style="color: rgba(255,255,255,0.8); margin: 0 0 5px 0; font-size: 14px;">Monto Total a Pagar</p>
                <p style="color: white; margin: 0; font-size: 36px; font-weight: 700;">${amount:.2f}</p>
            </div>
            
            <table style="width: 100%;">
                <tr>
                    <td style="padding: 10px 0; color: #64748b; font-size: 14px;">📆 Fecha de vencimiento:</td>
                    <td style="padding: 10px 0; text-align: right; color: {urgency_color}; font-weight: 600;">{due_date_str}</td>
                </tr>
            </table>
        </div>
        
        <!-- CTA Buttons -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="{self.company_website}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 10px;">💳 Pagar Ahora</a>
        </div>
        
        <!-- Contact Info -->
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h4 style="color: #334155; margin: 0 0 15px 0; font-size: 14px;">¿Necesitas ayuda o tienes un plan de pago?</h4>
            <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.8;">
                📞 Llámanos: <a href="tel:{self.company_phone}" style="color: #1E3A5F; text-decoration: none;">{self.company_phone}</a><br>
                📧 Email: <a href="mailto:{self.company_email}" style="color: #1E3A5F; text-decoration: none;">{self.company_email}</a><br>
                📍 Visítanos: {self.company_address}
            </p>
        </div>
        
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 20px 0 0 0; font-style: italic;">
            Si ya realizaste el pago, por favor ignora este mensaje. Los pagos pueden tardar hasta 24 horas en reflejarse en nuestro sistema.
        </p>
        """
        
        return self._get_base_template(content, urgency_color, header_emoji, "Recordatorio de Pago")
    
    def get_invoice_paid_email(
        self,
        client_name: str,
        invoice_number: str,
        amount: float,
        payment_method: str,
        payment_date: Optional[datetime] = None
    ) -> str:
        """Generate professional invoice paid confirmation email"""
        
        payment_date_str = payment_date.strftime('%d/%m/%Y %H:%M') if payment_date else datetime.utcnow().strftime('%d/%m/%Y %H:%M')
        
        content = f"""
        <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">Hola <strong style="color: #059669;">{client_name}</strong>,</p>
        
        <!-- Success Banner -->
        <div style="background: #D1FAE5; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <span style="font-size: 50px;">✅</span>
            <h3 style="color: #059669; margin: 10px 0 0 0;">¡Pago Recibido Exitosamente!</h3>
        </div>
        
        <p style="font-size: 16px; color: #555; line-height: 1.6; margin: 0 0 30px 0;">
            Hemos recibido tu pago. Gracias por confiar en Ross Tax Preparation.
        </p>
        
        <!-- Payment Receipt Card -->
        <div style="background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%); border-radius: 12px; padding: 25px; border: 1px solid #d1fae5; margin-bottom: 25px;">
            <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #10B981; padding-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 10px;">🧾</span>
                <h3 style="color: #047857; margin: 0; font-size: 20px; font-weight: 600;">Recibo de Pago</h3>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 12px 0; color: #64748b; font-size: 14px;">📄 Factura:</td>
                    <td style="padding: 12px 0; text-align: right; color: #334155; font-weight: 500;">#{invoice_number}</td>
                </tr>
                <tr style="background-color: #f0fdf4;">
                    <td style="padding: 12px 8px; color: #64748b; font-size: 14px; border-radius: 6px 0 0 6px;">📅 Fecha de pago:</td>
                    <td style="padding: 12px 8px; text-align: right; color: #334155; font-weight: 500; border-radius: 0 6px 6px 0;">{payment_date_str}</td>
                </tr>
                <tr>
                    <td style="padding: 12px 0; color: #64748b; font-size: 14px;">💳 Método de pago:</td>
                    <td style="padding: 12px 0; text-align: right; color: #334155; font-weight: 500;">{payment_method}</td>
                </tr>
            </table>
            
            <!-- Amount Paid Highlight -->
            <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 10px; text-align: center;">
                <p style="color: rgba(255,255,255,0.8); margin: 0 0 5px 0; font-size: 14px;">Monto Pagado</p>
                <p style="color: white; margin: 0; font-size: 32px; font-weight: 700;">${amount:.2f}</p>
                <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 12px;">✓ Pagado completamente</p>
            </div>
        </div>
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 25px 0 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            Este correo sirve como confirmación de tu pago. Si necesitas una factura oficial o tienes alguna pregunta, no dudes en contactarnos.
        </p>
        """
        
        return self._get_base_template(content, "#059669", "✅", "Pago Confirmado")
    
    async def send_invoice_created(
        self,
        to_email: str,
        client_name: str,
        invoice_number: str,
        service_name: str,
        items: list,
        subtotal: float,
        tax: float,
        total: float,
        due_date: Optional[datetime] = None,
        notes: Optional[str] = None
    ) -> bool:
        """Send invoice created email"""
        global notification_service_instance
        
        if not notification_service_instance:
            logger.error("Notification service not initialized")
            return False
        
        html_content = self.get_invoice_created_email(
            client_name, invoice_number, service_name, items,
            subtotal, tax, total, due_date, notes
        )
        
        return await notification_service_instance.send_email(
            to_email=to_email,
            subject=f"📄 Nueva Factura #{invoice_number} - Ross Tax",
            html_content=html_content
        )
    
    async def send_invoice_reminder(
        self,
        to_email: str,
        client_name: str,
        invoice_number: str,
        amount: float,
        due_date: Optional[datetime] = None
    ) -> bool:
        """Send invoice reminder email"""
        global notification_service_instance
        
        if not notification_service_instance:
            logger.error("Notification service not initialized")
            return False
        
        # Calculate days overdue
        days_overdue = 0
        if due_date:
            delta = datetime.utcnow() - due_date
            days_overdue = max(0, delta.days)
        
        html_content = self.get_invoice_reminder_email(
            client_name, invoice_number, amount, due_date, days_overdue
        )
        
        subject = f"⏰ Recordatorio: Factura #{invoice_number} Pendiente - Ross Tax"
        if days_overdue > 30:
            subject = f"🚨 URGENTE: Factura #{invoice_number} Vencida - Ross Tax"
        
        return await notification_service_instance.send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content
        )
    
    async def send_invoice_paid(
        self,
        to_email: str,
        client_name: str,
        invoice_number: str,
        amount: float,
        payment_method: str = "Tarjeta"
    ) -> bool:
        """Send invoice paid confirmation email"""
        global notification_service_instance
        
        if not notification_service_instance:
            logger.error("Notification service not initialized")
            return False
        
        html_content = self.get_invoice_paid_email(
            client_name, invoice_number, amount, payment_method, datetime.utcnow()
        )
        
        return await notification_service_instance.send_email(
            to_email=to_email,
            subject=f"✅ Pago Recibido - Factura #{invoice_number} - Ross Tax",
            html_content=html_content
        )


# Global instance
email_service = EmailService()
