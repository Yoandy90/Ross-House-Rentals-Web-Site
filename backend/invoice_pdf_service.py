"""
Invoice PDF Service - Generación de PDFs profesionales para facturas
Diseño compacto optimizado para una sola página con logo pequeño
"""
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.graphics.shapes import Drawing, Rect, Line
from reportlab.graphics import renderPDF
from datetime import datetime
from io import BytesIO
import logging
import os
import qrcode
from PIL import Image as PILImage
import barcode
from barcode.writer import ImageWriter

logger = logging.getLogger(__name__)

# Colores corporativos de Ross Lending
ROSS_RED = rl_colors.HexColor('#6C1110')  # Rojo oscuro/granate
ROSS_RED_LIGHT = rl_colors.HexColor('#8B1A18')  # Rojo más claro
ROSS_GOLD = rl_colors.HexColor('#D4AF37')  # Dorado para acentos
DARK_TEXT = rl_colors.HexColor('#1f2937')
GRAY_TEXT = rl_colors.HexColor('#6b7280')
LIGHT_GRAY = rl_colors.HexColor('#f3f4f6')
BORDER_COLOR = rl_colors.HexColor('#e5e7eb')
GREEN_SUCCESS = rl_colors.HexColor('#10b981')


class InvoicePDFService:
    """Servicio para generar PDFs profesionales de facturas"""
    
    @staticmethod
    def generate_qr_code(payment_url: str, invoice_number: str) -> BytesIO:
        """
        Genera un código QR para el pago de la factura
        
        Args:
            payment_url: URL de pago
            invoice_number: Número de factura
            
        Returns:
            BytesIO: Buffer con la imagen QR
        """
        try:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=2,
            )
            qr.add_data(payment_url)
            qr.make(fit=True)
            
            # Crear imagen con colores de la marca
            qr_image = qr.make_image(fill_color='#6C1110', back_color='white')
            
            # Convertir a BytesIO
            qr_buffer = BytesIO()
            qr_image.save(qr_buffer, format='PNG')
            qr_buffer.seek(0)
            
            return qr_buffer
        except Exception as e:
            logger.error(f"Error generando QR: {e}")
            return None

    @staticmethod
    def generate_barcode(data: str, barcode_type: str = 'code128') -> BytesIO:
        """
        Genera un código de barras Code128 compatible con escáneres Clover POS
        
        Args:
            data: Texto a codificar (charge_id, order_id, etc.)
            barcode_type: Tipo de barcode (code128, ean13, etc.)
            
        Returns:
            BytesIO: Buffer con la imagen PNG del barcode
        """
        try:
            # Limpiar data para barcode (Code128 acepta ASCII)
            clean_data = str(data).strip()
            if not clean_data:
                logger.warning("Barcode data vacío")
                return None
            
            # Crear writer con opciones de estilo
            writer = ImageWriter()
            
            # Generar barcode Code128
            barcode_class = barcode.get_barcode_class(barcode_type)
            barcode_instance = barcode_class(clean_data, writer=writer)
            
            # Renderizar a buffer
            barcode_buffer = BytesIO()
            barcode_instance.write(barcode_buffer, options={
                'module_width': 0.3,
                'module_height': 12,
                'font_size': 8,
                'text_distance': 3,
                'quiet_zone': 4,
                'write_text': True,
                'foreground': '#1f2937',
                'background': '#ffffff',
            })
            barcode_buffer.seek(0)
            
            logger.info(f"✅ Barcode generado: {clean_data[:20]}...")
            return barcode_buffer
        except Exception as e:
            logger.error(f"Error generando barcode: {e}")
            return None

    @staticmethod
    def generate_barcode_base64(data: str, barcode_type: str = 'code128') -> str:
        """
        Genera un código de barras y lo devuelve como string Base64
        
        Args:
            data: Texto a codificar
            barcode_type: Tipo de barcode
            
        Returns:
            str: Imagen en base64
        """
        import base64
        try:
            buffer = InvoicePDFService.generate_barcode(data, barcode_type)
            if buffer:
                return base64.b64encode(buffer.read()).decode('utf-8')
            return None
        except Exception as e:
            logger.error(f"Error generando barcode base64: {e}")
            return None
    
    @staticmethod
    def generate_invoice_pdf(invoice_data: dict, user_data: dict) -> BytesIO:
        """
        Genera un PDF profesional para una factura - Optimizado para 1 página
        
        Args:
            invoice_data: Datos de la factura
            user_data: Datos del usuario/cliente
            
        Returns:
            BytesIO: Buffer con el PDF generado
        """
        try:
            invoice_number = invoice_data.get('invoice_number', 'N/A')
            logger.info(f"📄 Generando PDF para factura {invoice_number}")
            
            # Crear buffer para el PDF
            buffer = BytesIO()
            
            # Crear documento con márgenes reducidos
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                rightMargin=0.4*inch,
                leftMargin=0.4*inch,
                topMargin=0.3*inch,
                bottomMargin=0.3*inch
            )
            
            # Contenedor de elementos
            elements = []
            
            # Estilos base
            styles = getSampleStyleSheet()
            
            # ========== ESTILOS PERSONALIZADOS - MÁS COMPACTOS ==========
            
            # Título FACTURA
            invoice_title_style = ParagraphStyle(
                'InvoiceTitle',
                parent=styles['Heading1'],
                fontSize=32,
                textColor=ROSS_RED,
                spaceAfter=0,
                alignment=TA_RIGHT,
                fontName='Helvetica-Bold'
            )
            
            # Número de factura
            invoice_number_style = ParagraphStyle(
                'InvoiceNumber',
                parent=styles['Normal'],
                fontSize=11,
                textColor=GRAY_TEXT,
                alignment=TA_RIGHT,
                spaceAfter=2
            )
            
            # Estilo para texto normal - más pequeño
            normal_style = ParagraphStyle(
                'CustomNormal',
                parent=styles['Normal'],
                fontSize=9,
                textColor=DARK_TEXT,
                leading=11
            )
            
            # Estilo para valores
            value_style = ParagraphStyle(
                'Value',
                parent=styles['Normal'],
                fontSize=10,
                textColor=DARK_TEXT,
                fontName='Helvetica-Bold'
            )
            
            # ========== HEADER CON LOGO PEQUEÑO ==========
            
            # Buscar logo
            logo_paths = [
                os.path.join(os.path.dirname(__file__), 'assets', 'ross_logo.png'),
                os.path.join(os.path.dirname(__file__), '..', 'frontend', 'assets', 'ross-logo.png'),
                os.path.join(os.path.dirname(__file__), 'static', 'ross_logo.png'),
            ]
            logo_element = None
            
            for logo_path in logo_paths:
                if os.path.exists(logo_path):
                    try:
                        # Logo MÁS PEQUEÑO - 0.9 pulgadas (mantiene proporciones)
                        logo_element = Image(logo_path, width=0.9*inch, height=0.9*inch)
                        logger.info(f"✅ Logo encontrado en: {logo_path}")
                        break
                    except Exception as logo_error:
                        logger.warning(f"⚠️ Error cargando logo de {logo_path}: {logo_error}")
            
            # Crear texto de empresa junto al logo
            company_text = Paragraph(
                "<font color='#6C1110' size='14'><b>ROSS</b></font><br/>"
                "<font size='8'>Tax Preparation LLC</font>",
                ParagraphStyle('CompanyText', fontSize=14, textColor=ROSS_RED, leading=14)
            )
            
            # Header: Logo + Nombre a la izquierda, FACTURA a la derecha
            header_right_content = [
                [Paragraph("<font color='#6C1110'>FACTURA</font>", invoice_title_style)],
                [Paragraph(f"#{invoice_number}", invoice_number_style)],
            ]
            header_right_table = Table(header_right_content, colWidths=[2.8*inch])
            
            if logo_element:
                # Logo con texto de empresa
                logo_with_text = Table([[logo_element, company_text]], colWidths=[1*inch, 1.5*inch])
                logo_with_text.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('ALIGN', (0, 0), (0, 0), 'LEFT'),
                    ('LEFTPADDING', (1, 0), (1, 0), 8),
                ]))
                header_data = [[logo_with_text, '', header_right_table]]
                header_widths = [2.6*inch, 1.8*inch, 3*inch]
            else:
                # Sin logo - solo mostrar nombre de empresa
                company_name = Paragraph("<font color='#6C1110' size='20'><b>ROSS TAX</b></font>", 
                    ParagraphStyle('Company', fontSize=20, textColor=ROSS_RED, fontName='Helvetica-Bold'))
                header_data = [[company_name, '', header_right_table]]
                header_widths = [2.5*inch, 2*inch, 3*inch]
            
            header_table = Table(header_data, colWidths=header_widths)
            header_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
            ]))
            
            elements.append(header_table)
            elements.append(Spacer(1, 0.15*inch))
            
            # Línea decorativa roja - más delgada
            line_drawing = Drawing(7.6*inch, 3)
            line_drawing.add(Rect(0, 0, 7.6*inch, 3, fillColor=ROSS_RED, strokeColor=None))
            elements.append(line_drawing)
            elements.append(Spacer(1, 0.15*inch))
            
            # ========== INFORMACIÓN DE FACTURA Y CLIENTE - COMPACTO ==========
            
            # Formatear fechas
            created_date = "N/A"
            due_date = "N/A"
            try:
                created_at = invoice_data.get('created_at')
                if created_at:
                    if isinstance(created_at, str):
                        created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00')).strftime('%d/%m/%Y')
                    else:
                        created_date = created_at.strftime('%d/%m/%Y')
                
                due_at = invoice_data.get('due_date')
                if due_at:
                    if isinstance(due_at, str):
                        due_date = datetime.fromisoformat(due_at.replace('Z', '+00:00')).strftime('%d/%m/%Y')
                    else:
                        due_date = due_at.strftime('%d/%m/%Y')
            except Exception as e:
                logger.warning(f"Error formateando fechas: {e}")
            
            # Estado de la factura con color
            status = invoice_data.get('status', 'pending').upper()
            if status == 'PENDING':
                status_color = '#f59e0b'
                status_text = '⏳ PENDIENTE'
            elif status == 'PAID':
                status_color = '#10b981'
                status_text = '✅ PAGADA'
            else:
                status_color = '#ef4444'
                status_text = '❌ VENCIDA'
            
            # Info de empresa (izquierda) - MÁS COMPACTO
            company_info = [
                [Paragraph("<b>ROSS TAX PREPARATION</b>", ParagraphStyle('Header', fontSize=10, textColor=ROSS_RED, fontName='Helvetica-Bold'))],
                [Paragraph("305 Bruce Ave<br/>Dumas, TX 79029<br/>Tel: (806) 934-2018<br/>info@rosslending.com", normal_style)],
            ]
            
            # Info de factura (centro) - MÁS COMPACTO
            invoice_info = [
                [Paragraph("<b>DETALLES</b>", ParagraphStyle('Header', fontSize=10, textColor=ROSS_RED, fontName='Helvetica-Bold'))],
                [Paragraph(f"<b>Fecha:</b> {created_date}<br/><b>Vence:</b> {due_date}", normal_style)],
                [Paragraph(f"<font color='{status_color}'><b>{status_text}</b></font>", 
                    ParagraphStyle('Status', fontSize=11, textColor=rl_colors.HexColor(status_color), fontName='Helvetica-Bold'))],
            ]
            
            # Info del cliente (derecha) - MÁS COMPACTO
            client_name = user_data.get('name', 'Cliente')
            client_email = user_data.get('email', 'N/A')
            client_phone = user_data.get('phone', '')
            client_details = f"<b>{client_name}</b><br/>{client_email}"
            if client_phone:
                client_details += f"<br/>Tel: {client_phone}"
            
            client_info = [
                [Paragraph("<b>FACTURADO A</b>", ParagraphStyle('Header', fontSize=10, textColor=ROSS_RED, fontName='Helvetica-Bold'))],
                [Paragraph(client_details, normal_style)],
            ]
            
            company_info_table = Table(company_info, colWidths=[2.4*inch])
            invoice_info_table = Table(invoice_info, colWidths=[2.4*inch])
            client_info_table = Table(client_info, colWidths=[2.4*inch])
            
            # Estilo compacto para las tablas de info
            info_table_style = TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ])
            company_info_table.setStyle(info_table_style)
            invoice_info_table.setStyle(info_table_style)
            client_info_table.setStyle(info_table_style)
            
            info_row = Table([[company_info_table, invoice_info_table, client_info_table]], colWidths=[2.5*inch, 2.5*inch, 2.6*inch])
            info_row.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            
            elements.append(info_row)
            elements.append(Spacer(1, 0.2*inch))
            
            # ========== TABLA DE ITEMS - COMPACTA ==========
            
            # Encabezado de items
            header_style = ParagraphStyle('ItemHeader', fontSize=9, textColor=rl_colors.white, fontName='Helvetica-Bold')
            items_header = [
                Paragraph("<b>DESCRIPCIÓN</b>", header_style),
                Paragraph("<b>CANT.</b>", ParagraphStyle('ItemHeader', fontSize=9, textColor=rl_colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)),
                Paragraph("<b>PRECIO</b>", ParagraphStyle('ItemHeader', fontSize=9, textColor=rl_colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
                Paragraph("<b>TOTAL</b>", ParagraphStyle('ItemHeader', fontSize=9, textColor=rl_colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)),
            ]
            
            items_data = [items_header]
            
            # Agregar items
            item_style = ParagraphStyle('ItemText', fontSize=9, textColor=DARK_TEXT)
            for i, item in enumerate(invoice_data.get('items', [])):
                qty = item.get('quantity', 1)
                unit_price = item.get('unit_price', 0.0)
                line_total = qty * unit_price
                
                items_data.append([
                    Paragraph(item.get('description', 'N/A'), item_style),
                    Paragraph(str(qty), ParagraphStyle('Centered', fontSize=9, alignment=TA_CENTER)),
                    Paragraph(f"${unit_price:,.2f}", ParagraphStyle('Right', fontSize=9, alignment=TA_RIGHT)),
                    Paragraph(f"<b>${line_total:,.2f}</b>", ParagraphStyle('Right', fontSize=9, alignment=TA_RIGHT, fontName='Helvetica-Bold')),
                ])
            
            items_table = Table(items_data, colWidths=[3.6*inch, 0.7*inch, 1.3*inch, 1.4*inch])
            
            # Estilo base - padding reducido
            table_style = [
                # Header
                ('BACKGROUND', (0, 0), (-1, 0), ROSS_RED),
                ('TEXTCOLOR', (0, 0), (-1, 0), rl_colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                # Alignment
                ('ALIGN', (1, 0), (1, -1), 'CENTER'),
                ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                # Body padding - reducido
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                # Border bottom
                ('LINEBELOW', (0, -1), (-1, -1), 1.5, ROSS_RED),
            ]
            
            # Agregar filas alternadas
            for i in range(1, len(items_data)):
                if i % 2 == 0:
                    table_style.append(('BACKGROUND', (0, i), (-1, i), LIGHT_GRAY))
                else:
                    table_style.append(('BACKGROUND', (0, i), (-1, i), rl_colors.white))
            
            items_table.setStyle(TableStyle(table_style))
            
            elements.append(items_table)
            elements.append(Spacer(1, 0.15*inch))
            
            # ========== TOTALES Y QR - EN UNA FILA COMPACTA ==========
            
            subtotal = invoice_data.get('subtotal', 0.0)
            tax = invoice_data.get('tax', 0.0)
            total = invoice_data.get('total', 0.0)
            
            # Generar QR para pago - más pequeño
            invoice_id = invoice_data.get('_id') or invoice_data.get('id', '')
            payment_url = f"https://www.rosslending.com/pay/{invoice_id}?amount={total}&invoice={invoice_number}"
            
            qr_buffer = InvoicePDFService.generate_qr_code(payment_url, invoice_number)
            qr_element = None
            if qr_buffer:
                try:
                    qr_element = Image(qr_buffer, width=1*inch, height=1*inch)
                except Exception as e:
                    logger.warning(f"Error creando imagen QR: {e}")
            
            # Estilos para totales - más compactos
            totals_style_label = ParagraphStyle('TotalsLabel', fontSize=10, textColor=GRAY_TEXT, alignment=TA_RIGHT)
            totals_style_value = ParagraphStyle('TotalsValue', fontSize=10, textColor=DARK_TEXT, alignment=TA_RIGHT)
            totals_style_total_label = ParagraphStyle('TotalLabel', fontSize=12, textColor=rl_colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)
            totals_style_total_value = ParagraphStyle('TotalValue', fontSize=14, textColor=rl_colors.white, fontName='Helvetica-Bold', alignment=TA_RIGHT)
            
            totals_data = [
                [Paragraph("Subtotal:", totals_style_label), Paragraph(f"${subtotal:,.2f}", totals_style_value)],
                [Paragraph("Impuesto:", totals_style_label), Paragraph(f"${tax:,.2f}", totals_style_value)],
                [Paragraph("<b>TOTAL A<br/>PAGAR:</b>", totals_style_total_label), Paragraph(f"<b>${total:,.2f}</b>", totals_style_total_value)],
            ]
            
            totals_table = Table(totals_data, colWidths=[1.3*inch, 1.2*inch])
            totals_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                # Total row styling
                ('BACKGROUND', (0, -1), (-1, -1), ROSS_RED),
                ('TOPPADDING', (0, -1), (-1, -1), 8),
                ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
                # Regular rows
                ('TOPPADDING', (0, 0), (-1, -2), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -2), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ]))
            
            # QR Section - más compacto
            if qr_element:
                qr_section = [
                    [Paragraph("<b>ESCANEA PARA<br/>PAGAR</b>", ParagraphStyle('QRTitle', fontSize=8, textColor=ROSS_RED, fontName='Helvetica-Bold', alignment=TA_CENTER, leading=10))],
                    [qr_element],
                    [Paragraph("Escanea con tu cámara", ParagraphStyle('QRHelp', fontSize=7, textColor=GRAY_TEXT, alignment=TA_CENTER))],
                ]
                qr_table = Table(qr_section, colWidths=[1.2*inch])
                qr_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 2),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ]))
                
                # Combinar QR y totales
                combined_row = Table([[qr_table, '', totals_table]], colWidths=[1.5*inch, 3*inch, 2.6*inch])
                combined_row.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
                ]))
                elements.append(combined_row)
            else:
                # Sin QR, solo totales alineados a la derecha
                totals_row = Table([['', totals_table]], colWidths=[4.5*inch, 2.6*inch])
                totals_row.setStyle(TableStyle([
                    ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
                ]))
                elements.append(totals_row)
            
            elements.append(Spacer(1, 0.15*inch))
            
            # ========== CÓDIGO DE BARRAS CLOVER - ESCANEABLE POR POS ==========
            
            # Generar barcode con el número de factura para búsqueda rápida en Clover
            barcode_ref = invoice_data.get('clover_charge_id') or invoice_data.get('charge_id') or invoice_number
            barcode_buffer = InvoicePDFService.generate_barcode(barcode_ref)
            
            if barcode_buffer:
                try:
                    barcode_img = Image(barcode_buffer, width=3*inch, height=0.7*inch)
                    
                    barcode_section = [
                        [Paragraph("<b>▪ CÓDIGO DE BARRAS - ESCANEAR EN CLOVER POS</b>", 
                            ParagraphStyle('BarcodeTitle', fontSize=8, textColor=ROSS_RED, fontName='Helvetica-Bold', alignment=TA_CENTER))],
                        [barcode_img],
                        [Paragraph(f"Ref: {barcode_ref}", 
                            ParagraphStyle('BarcodeRef', fontSize=7, textColor=GRAY_TEXT, alignment=TA_CENTER))],
                    ]
                    barcode_table = Table(barcode_section, colWidths=[7.6*inch])
                    barcode_table.setStyle(TableStyle([
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                        ('TOPPADDING', (0, 0), (-1, -1), 4),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
                        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                    ]))
                    elements.append(barcode_table)
                    elements.append(Spacer(1, 0.1*inch))
                except Exception as bc_err:
                    logger.warning(f"⚠️ Error insertando barcode en PDF: {bc_err}")
            
            # ========== INFORMACIÓN DE PAGO - COMPACTA ==========
            
            payment_info_style = ParagraphStyle('PaymentInfo', fontSize=8, textColor=DARK_TEXT, leading=11)
            payment_header_style = ParagraphStyle('PaymentHeader', fontSize=9, textColor=ROSS_RED, fontName='Helvetica-Bold', spaceAfter=4)
            
            elements.append(Paragraph("▪ MÉTODOS DE PAGO:", payment_header_style))
            
            payment_methods = [
                [
                    Paragraph("<b>Zelle</b><br/>info@rosslending.com", payment_info_style),
                    Paragraph("<b>Cash App</b><br/>$RossTaxPrep", payment_info_style),
                    Paragraph("<b>Tarjeta</b><br/>En la app Ross Lending", payment_info_style),
                    Paragraph("<b>Efectivo</b><br/>En nuestra oficina", payment_info_style),
                ]
            ]
            
            payment_table = Table(payment_methods, colWidths=[1.9*inch, 1.9*inch, 1.9*inch, 1.9*inch])
            payment_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
                ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            elements.append(payment_table)
            elements.append(Spacer(1, 0.12*inch))
            
            # ========== NOTAS - COMPACTAS ==========
            
            if invoice_data.get('notes'):
                notes_style = ParagraphStyle('Notes', fontSize=8, textColor=GRAY_TEXT, spaceAfter=6, leading=10)
                elements.append(Paragraph(f"<b>Notas:</b> {invoice_data['notes']}", notes_style))
                elements.append(Spacer(1, 0.08*inch))
            
            # ========== FOOTER - COMPACTO ==========
            
            # Línea decorativa
            footer_line = Drawing(7.6*inch, 2)
            footer_line.add(Rect(0, 0, 7.6*inch, 2, fillColor=ROSS_RED, strokeColor=None))
            elements.append(footer_line)
            elements.append(Spacer(1, 0.06*inch))
            
            footer_style = ParagraphStyle(
                'Footer',
                parent=styles['Normal'],
                fontSize=7,
                textColor=GRAY_TEXT,
                alignment=TA_CENTER,
                leading=10
            )
            
            elements.append(Paragraph(
                "<b>Ross Lending Solutions LLC</b> | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018",
                footer_style
            ))
            elements.append(Paragraph(
                "www.rosslending.com | info@rosslending.com",
                footer_style
            ))
            elements.append(Paragraph(
                "<b>¡Gracias por confiar en nosotros!</b> ▪",
                ParagraphStyle('FooterThanks', fontSize=8, textColor=ROSS_RED, alignment=TA_CENTER, fontName='Helvetica-Bold')
            ))
            
            # Construir PDF
            doc.build(elements)
            
            # Resetear el buffer al inicio
            buffer.seek(0)
            
            logger.info(f"✅ PDF generado exitosamente para factura {invoice_number}")
            return buffer
            
        except Exception as e:
            logger.error(f"❌ Error generando PDF de factura: {str(e)}")
            raise
