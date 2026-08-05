"""
Cuban Passport Application PDF Generator Service
Generates the official consular form (Planilla para Trámites Consulares) 
filled with the applicant's data.
"""

import io
import base64
import logging
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import black, HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Configure logging
logger = logging.getLogger(__name__)

# Colors
HEADER_COLOR = HexColor('#1a365d')  # Dark blue for headers
TEXT_COLOR = black

class PassportPDFGenerator:
    """Generates Cuban passport application PDF forms"""
    
    def __init__(self):
        self.page_width, self.page_height = letter
        self.margin = 0.5 * inch
        
    def generate_application_pdf(self, form_data: dict, application_id: str = None) -> bytes:
        """
        Generate a filled PDF form for Cuban passport application
        
        Args:
            form_data: Dictionary containing all form fields
            application_id: Optional application ID for reference
            
        Returns:
            PDF file as bytes
        """
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        try:
            self._draw_page_1(c, form_data, application_id)
            c.showPage()
            self._draw_page_2(c, form_data)
            c.showPage()
            c.save()
            
            buffer.seek(0)
            return buffer.getvalue()
        except Exception as e:
            logger.error(f"Error generating passport PDF: {e}")
            raise
    
    def _draw_header(self, c, y_position):
        """Draw the form header"""
        # Republic of Cuba header
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(HEADER_COLOR)
        c.drawCentredString(self.page_width / 2, y_position, "REPÚBLICA DE CUBA")
        
        y_position -= 18
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(self.page_width / 2, y_position, "MINISTERIO DE RELACIONES EXTERIORES")
        
        y_position -= 16
        c.setFont("Helvetica", 10)
        c.drawCentredString(self.page_width / 2, y_position, "Dirección de Asuntos Consulares y de Cubanos Residentes en el Exterior")
        
        y_position -= 25
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(TEXT_COLOR)
        c.drawCentredString(self.page_width / 2, y_position, "PLANILLA PARA TRÁMITES CONSULARES")
        
        y_position -= 16
        c.setFont("Helvetica", 9)
        c.drawCentredString(self.page_width / 2, y_position, "(Solicitud de Pasaporte)")
        
        return y_position - 20
    
    def _draw_field(self, c, label, value, x, y, width=200, label_width=100):
        """Draw a labeled field"""
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(HEADER_COLOR)
        c.drawString(x, y, f"{label}:")
        
        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_COLOR)
        
        # Draw value with underline
        value_x = x + label_width
        c.drawString(value_x, y, str(value or ""))
        
        # Underline
        c.setStrokeColor(HexColor('#cccccc'))
        c.line(value_x, y - 2, x + width, y - 2)
        
        return y - 18
    
    def _draw_section_header(self, c, title, y_position):
        """Draw a section header"""
        c.setFillColor(HexColor('#f0f4f8'))
        c.rect(self.margin, y_position - 5, self.page_width - 2 * self.margin, 18, fill=1, stroke=0)
        
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(HEADER_COLOR)
        c.drawString(self.margin + 5, y_position, title)
        
        return y_position - 25
    
    def _draw_page_1(self, c, form_data: dict, application_id: str = None):
        """Draw page 1 of the application form"""
        y = self.page_height - self.margin
        
        # Header
        y = self._draw_header(c, y)
        
        # Application info
        c.setFont("Helvetica", 8)
        c.setFillColor(HexColor('#666666'))
        today = datetime.now().strftime("%d/%m/%Y")
        c.drawString(self.margin, y, f"Fecha de Solicitud: {today}")
        if application_id:
            c.drawRightString(self.page_width - self.margin, y, f"No. Solicitud: {application_id[:8].upper()}")
        
        y -= 20
        
        # Type of process
        tramite_type = form_data.get('tramite_type', '')
        tramite_label = "Pasaporte por Primera Vez" if tramite_type == 'pasaporte_primera_vez' else "Renovación de Pasaporte"
        y = self._draw_section_header(c, f"TIPO DE TRÁMITE: {tramite_label}", y)
        
        # Personal Data Section
        y = self._draw_section_header(c, "I. DATOS PERSONALES", y)
        
        col1_x = self.margin
        col2_x = self.page_width / 2 + 10
        field_width = (self.page_width - 2 * self.margin - 20) / 2
        
        # Names
        y = self._draw_field(c, "Primer Nombre", form_data.get('primer_nombre', ''), col1_x, y, field_width, 80)
        self._draw_field(c, "Segundo Nombre", form_data.get('segundo_nombre', ''), col2_x, y + 18, field_width, 90)
        
        y = self._draw_field(c, "Primer Apellido", form_data.get('primer_apellido', ''), col1_x, y, field_width, 85)
        self._draw_field(c, "Segundo Apellido", form_data.get('segundo_apellido', ''), col2_x, y + 18, field_width, 95)
        
        # Birth info
        y = self._draw_field(c, "Fecha de Nacimiento", form_data.get('fecha_nacimiento', ''), col1_x, y, field_width, 105)
        self._draw_field(c, "Sexo", form_data.get('sexo', ''), col2_x, y + 18, field_width, 35)
        
        # Physical characteristics
        y = self._draw_field(c, "Color de Ojos", form_data.get('color_ojos', ''), col1_x, y, field_width, 75)
        self._draw_field(c, "Color de Piel", form_data.get('color_piel', ''), col2_x, y + 18, field_width, 75)
        
        y = self._draw_field(c, "Color de Cabello", form_data.get('color_cabello', ''), col1_x, y, field_width, 95)
        self._draw_field(c, "Estatura (cm)", form_data.get('estatura', ''), col2_x, y + 18, field_width, 75)
        
        y = self._draw_field(c, "Estado Civil", form_data.get('estado_civil', ''), col1_x, y, field_width, 70)
        
        # Special characteristics
        y -= 5
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(HEADER_COLOR)
        c.drawString(col1_x, y, "Características Especiales:")
        y -= 12
        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_COLOR)
        c.drawString(col1_x, y, form_data.get('caracteristicas_especiales', 'Ninguna'))
        
        y -= 25
        
        # Parents Section
        y = self._draw_section_header(c, "II. DATOS DE LOS PADRES", y)
        
        y = self._draw_field(c, "Nombre del Padre", form_data.get('nombre_padre', ''), col1_x, y, self.page_width - 2 * self.margin, 100)
        y = self._draw_field(c, "Nombre de la Madre", form_data.get('nombre_madre', ''), col1_x, y, self.page_width - 2 * self.margin, 110)
        
        y -= 10
        
        # Birthplace Section
        y = self._draw_section_header(c, "III. LUGAR DE NACIMIENTO", y)
        
        y = self._draw_field(c, "País", form_data.get('pais_nacimiento', 'Cuba'), col1_x, y, field_width, 30)
        self._draw_field(c, "Provincia", form_data.get('provincia_nacimiento', ''), col2_x, y + 18, field_width, 55)
        
        y = self._draw_field(c, "Municipio/Ciudad", form_data.get('municipio_nacimiento', ''), col1_x, y, self.page_width - 2 * self.margin, 100)
        
        y -= 10
        
        # Migration Classification
        y = self._draw_section_header(c, "IV. CLASIFICACIÓN MIGRATORIA", y)
        
        clasificacion = form_data.get('clasificacion_migratoria', '')
        clasificacion_labels = {
            'pve': 'PVE - Permiso de Viaje al Exterior',
            'pre': 'PRE - Permiso de Residencia en el Exterior',
            'pvt': 'PVT - Permiso de Viaje Temporal',
            'psi': 'PSI - Permiso de Salida Indefinido',
            'residente_exterior': 'Residente en el Exterior',
            'salida_ilegal': 'Salida Ilegal'
        }
        clasificacion_text = clasificacion_labels.get(clasificacion, clasificacion)
        
        y = self._draw_field(c, "Clasificación", clasificacion_text, col1_x, y, self.page_width - 2 * self.margin, 70)
        y = self._draw_field(c, "Fecha de Salida de Cuba", form_data.get('fecha_salida_cuba', ''), col1_x, y, field_width, 120)
        
        # Photo placeholder
        photo_x = self.page_width - self.margin - 1.2 * inch
        photo_y = self.page_height - 1.5 * inch
        photo_width = 1 * inch
        photo_height = 1.3 * inch
        
        # Draw photo frame
        c.setStrokeColor(HEADER_COLOR)
        c.setLineWidth(1)
        c.rect(photo_x, photo_y - photo_height, photo_width, photo_height)
        
        # If photo exists, try to embed it
        foto_data = form_data.get('foto_pasaporte')
        if foto_data and foto_data.startswith('data:image'):
            try:
                # Extract base64 data
                header, encoded = foto_data.split(',', 1)
                image_data = base64.b64decode(encoded)
                image_buffer = io.BytesIO(image_data)
                
                from reportlab.lib.utils import ImageReader
                img = ImageReader(image_buffer)
                c.drawImage(img, photo_x + 2, photo_y - photo_height + 2, 
                           width=photo_width - 4, height=photo_height - 4,
                           preserveAspectRatio=True)
            except Exception as e:
                logger.warning(f"Could not embed photo: {e}")
                c.setFont("Helvetica", 7)
                c.drawCentredString(photo_x + photo_width/2, photo_y - photo_height/2, "FOTO")
        else:
            c.setFont("Helvetica", 8)
            c.setFillColor(HexColor('#999999'))
            c.drawCentredString(photo_x + photo_width/2, photo_y - photo_height/2, "FOTO")
            c.drawCentredString(photo_x + photo_width/2, photo_y - photo_height/2 - 10, "PASAPORTE")
        
        # Footer
        c.setFont("Helvetica", 7)
        c.setFillColor(HexColor('#666666'))
        c.drawCentredString(self.page_width / 2, self.margin / 2, "Página 1 de 2")
    
    def _draw_page_2(self, c, form_data: dict):
        """Draw page 2 of the application form"""
        y = self.page_height - self.margin
        
        # Mini header
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(HEADER_COLOR)
        c.drawCentredString(self.page_width / 2, y, "PLANILLA PARA TRÁMITES CONSULARES (Continuación)")
        
        y -= 30
        
        col1_x = self.margin
        col2_x = self.page_width / 2 + 10
        field_width = (self.page_width - 2 * self.margin - 20) / 2
        
        # Current Residence Section
        y = self._draw_section_header(c, "V. RESIDENCIA ACTUAL", y)
        
        y = self._draw_field(c, "Dirección", form_data.get('direccion_actual', ''), col1_x, y, self.page_width - 2 * self.margin, 55)
        
        y = self._draw_field(c, "Ciudad", form_data.get('ciudad_actual', ''), col1_x, y, field_width, 45)
        self._draw_field(c, "Estado", form_data.get('estado_actual', ''), col2_x, y + 18, field_width, 45)
        
        y = self._draw_field(c, "Código Postal", form_data.get('codigo_postal', ''), col1_x, y, field_width, 80)
        self._draw_field(c, "País", form_data.get('pais_actual', 'Estados Unidos'), col2_x, y + 18, field_width, 30)
        
        y = self._draw_field(c, "Teléfono", form_data.get('telefono', ''), col1_x, y, field_width, 55)
        self._draw_field(c, "Email", form_data.get('email', ''), col2_x, y + 18, field_width, 40)
        
        y -= 10
        
        # Work Data Section
        y = self._draw_section_header(c, "VI. DATOS LABORALES", y)
        
        y = self._draw_field(c, "Centro de Trabajo", form_data.get('centro_trabajo', ''), col1_x, y, self.page_width - 2 * self.margin, 100)
        
        y = self._draw_field(c, "Profesión", form_data.get('profesion', ''), col1_x, y, field_width, 60)
        self._draw_field(c, "Ocupación", form_data.get('ocupacion', ''), col2_x, y + 18, field_width, 65)
        
        y = self._draw_field(c, "Dirección del Trabajo", form_data.get('direccion_trabajo', ''), col1_x, y, self.page_width - 2 * self.margin, 115)
        
        y -= 10
        
        # Reference in Cuba Section
        y = self._draw_section_header(c, "VII. REFERENCIA EN CUBA", y)
        
        y = self._draw_field(c, "Nombre Completo", form_data.get('nombre_referencia', ''), col1_x, y, self.page_width - 2 * self.margin, 100)
        y = self._draw_field(c, "Teléfono", form_data.get('telefono_referencia', ''), col1_x, y, field_width, 55)
        y = self._draw_field(c, "Dirección", form_data.get('direccion_referencia', ''), col1_x, y, self.page_width - 2 * self.margin, 55)
        
        y -= 10
        
        # Previous Documents Section
        y = self._draw_section_header(c, "VIII. DOCUMENTOS ANTERIORES", y)
        
        y = self._draw_field(c, "No. Pasaporte Anterior", form_data.get('numero_pasaporte_anterior', ''), col1_x, y, field_width, 115)
        self._draw_field(c, "Fecha Expedición", form_data.get('fecha_expedicion_anterior', ''), col2_x, y + 18, field_width, 95)
        
        y = self._draw_field(c, "Carné de Identidad", form_data.get('numero_carnet_identidad', ''), col1_x, y, field_width, 100)
        
        y = self._draw_field(c, "Tomo", form_data.get('tomo_acta', ''), col1_x, y, 100, 35)
        self._draw_field(c, "Folio", form_data.get('folio_acta', ''), col1_x + 120, y + 18, 100, 35)
        
        y -= 25
        
        # Declaration Section
        y = self._draw_section_header(c, "IX. DECLARACIÓN JURADA", y)
        
        c.setFont("Helvetica", 8)
        c.setFillColor(TEXT_COLOR)
        declaration_text = """Declaro bajo juramento que todos los datos consignados en esta planilla son verídicos 
y que me comprometo a presentar los documentos que me sean requeridos para la tramitación 
de mi solicitud. Conozco que cualquier falsedad en esta declaración puede acarrear 
la anulación del trámite solicitado y las consecuencias legales correspondientes."""
        
        text_object = c.beginText(col1_x, y)
        text_object.setFont("Helvetica", 8)
        for line in declaration_text.split('\n'):
            text_object.textLine(line.strip())
        c.drawText(text_object)
        
        y -= 60
        
        # Signature area
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(HEADER_COLOR)
        c.drawString(col1_x, y, "Firma del Solicitante:")
        
        # Signature box
        sig_x = col1_x
        sig_y = y - 60
        sig_width = 2.5 * inch
        sig_height = 50
        
        c.setStrokeColor(HexColor('#cccccc'))
        c.rect(sig_x, sig_y, sig_width, sig_height)
        
        # Embed signature if available
        firma_data = form_data.get('firma_digital')
        if firma_data and firma_data.startswith('data:image'):
            try:
                header, encoded = firma_data.split(',', 1)
                image_data = base64.b64decode(encoded)
                image_buffer = io.BytesIO(image_data)
                
                from reportlab.lib.utils import ImageReader
                img = ImageReader(image_buffer)
                c.drawImage(img, sig_x + 5, sig_y + 5, 
                           width=sig_width - 10, height=sig_height - 10,
                           preserveAspectRatio=True)
            except Exception as e:
                logger.warning(f"Could not embed signature: {e}")
        
        # Date
        c.setFont("Helvetica", 9)
        c.setFillColor(TEXT_COLOR)
        today = datetime.now().strftime("%d/%m/%Y")
        c.drawString(col2_x, y, f"Fecha: {today}")
        
        # Official use section
        y = sig_y - 30
        c.setStrokeColor(HexColor('#cccccc'))
        c.setLineWidth(0.5)
        c.line(self.margin, y, self.page_width - self.margin, y)
        
        y -= 15
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(HexColor('#666666'))
        c.drawString(col1_x, y, "PARA USO OFICIAL:")
        
        y -= 15
        c.setFont("Helvetica", 8)
        c.drawString(col1_x, y, "Recibido por: _______________________")
        c.drawString(col2_x, y, "Fecha: _______________________")
        
        y -= 15
        c.drawString(col1_x, y, "No. de Recibo: _______________________")
        c.drawString(col2_x, y, "Monto: $_______________________")
        
        # Footer
        c.setFont("Helvetica", 7)
        c.setFillColor(HexColor('#666666'))
        c.drawCentredString(self.page_width / 2, self.margin / 2, "Página 2 de 2")


# Singleton instance
passport_pdf_generator = PassportPDFGenerator()


def generate_passport_pdf(form_data: dict, application_id: str = None) -> bytes:
    """
    Convenience function to generate passport application PDF
    
    Args:
        form_data: Dictionary containing all form fields
        application_id: Optional application ID
        
    Returns:
        PDF file as bytes
    """
    return passport_pdf_generator.generate_application_pdf(form_data, application_id)
