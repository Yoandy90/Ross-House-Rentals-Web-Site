"""
Generate PDF Report: Ross Tax / Mi Reembolso - Platform Capabilities Summary
"""
import os
import sys
from fpdf import FPDF
from datetime import datetime

class RossTaxPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=20)
    
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(30, 58, 95)
        self.cell(0, 8, 'Ross Tax Services / Mi Reembolso - Resumen de Plataforma', 0, 1, 'C')
        self.set_draw_color(30, 58, 95)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)
    
    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Pagina {self.page_no()}/{{nb}} | Generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}', 0, 0, 'C')

    def section_title(self, icon, title):
        self.ln(4)
        self.set_font('Helvetica', 'B', 14)
        self.set_fill_color(30, 58, 95)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, f'  {icon}  {title}', 0, 1, 'L', fill=True)
        self.ln(2)
        self.set_text_color(0, 0, 0)
    
    def subsection(self, title):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(30, 58, 95)
        self.cell(0, 7, f'  {title}', 0, 1, 'L')
        self.set_text_color(0, 0, 0)
    
    def feature_row(self, name, status, description=""):
        self.set_font('Helvetica', '', 9)
        x = self.get_x()
        y = self.get_y()
        
        # Status color
        if status == "ACTIVO":
            self.set_fill_color(209, 250, 229)
            self.set_text_color(21, 128, 61)
        elif status == "PARCIAL":
            self.set_fill_color(254, 243, 199)
            self.set_text_color(161, 98, 7)
        elif status == "PENDIENTE":
            self.set_fill_color(254, 226, 226)
            self.set_text_color(185, 28, 28)
        elif status == "BLOQUEADO":
            self.set_fill_color(229, 231, 235)
            self.set_text_color(107, 114, 128)
        else:
            self.set_fill_color(240, 240, 240)
            self.set_text_color(100, 100, 100)
        
        self.set_font('Helvetica', '', 9)
        self.set_text_color(55, 65, 81)
        self.cell(95, 6, f'    {name}', 0, 0, 'L')
        
        # Status badge
        status_w = self.get_string_width(status) + 6
        if status == "ACTIVO":
            self.set_fill_color(209, 250, 229)
            self.set_text_color(21, 128, 61)
        elif status == "PARCIAL":
            self.set_fill_color(254, 243, 199)
            self.set_text_color(161, 98, 7)
        elif status == "PENDIENTE":
            self.set_fill_color(254, 226, 226)
            self.set_text_color(185, 28, 28)
        else:
            self.set_fill_color(229, 231, 235)
            self.set_text_color(107, 114, 128)
        
        self.set_font('Helvetica', 'B', 8)
        self.cell(25, 6, status, 0, 0, 'C', fill=True)
        
        self.set_font('Helvetica', '', 8)
        self.set_text_color(100, 116, 139)
        self.cell(70, 6, f'  {description}', 0, 1, 'L')
        self.set_text_color(0, 0, 0)


def generate_report():
    pdf = RossTaxPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # ============================================
    # TITLE PAGE
    # ============================================
    pdf.ln(15)
    pdf.set_font('Helvetica', 'B', 28)
    pdf.set_text_color(30, 58, 95)
    pdf.cell(0, 15, 'Mi Reembolso', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 14)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 8, 'Ross Tax Preparation LLC', 0, 1, 'C')
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(30, 58, 95)
    pdf.cell(0, 10, 'Resumen Completo de la Plataforma', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 11)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(0, 7, f'Fecha: {datetime.now().strftime("%d de %B, %Y")}', 0, 1, 'C')
    pdf.ln(8)
    
    # Architecture summary
    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(55, 65, 81)
    pdf.multi_cell(0, 5, 
        'Plataforma completa de preparacion de impuestos y servicios financieros con:\n'
        '- App Movil iOS/Android (Expo React Native) con soporte bilingue ES/EN\n'
        '- Panel de Administracion Web (Next.js)\n'
        '- Backend API (FastAPI + MongoDB)\n'
        '- Integraciones: NMI Payments, SendGrid, Twilio, Plaid, IRS IRIS/TINM/TDS/SOR\n'
        '- EIN: 33-1240497 | IRS API Client ID: a039bcd6-2b92-4f70-9e92-758b0b26dc00'
    )
    
    pdf.ln(5)
    pdf.set_draw_color(30, 58, 95)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    
    # ============================================
    # LEGEND
    # ============================================
    pdf.ln(5)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(0, 6, 'Leyenda de Estados:', 0, 1)
    pdf.set_font('Helvetica', '', 9)
    pdf.set_fill_color(209, 250, 229); pdf.set_text_color(21, 128, 61)
    pdf.cell(25, 5, 'ACTIVO', 0, 0, 'C', fill=True)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(65, 5, ' = Funcionando completamente', 0, 0)
    
    pdf.set_fill_color(254, 243, 199); pdf.set_text_color(161, 98, 7)
    pdf.cell(25, 5, 'PARCIAL', 0, 0, 'C', fill=True)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(65, 5, ' = Funciona pero falta algo', 0, 1)
    
    pdf.set_fill_color(254, 226, 226); pdf.set_text_color(185, 28, 28)
    pdf.cell(25, 5, 'PENDIENTE', 0, 0, 'C', fill=True)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(65, 5, ' = En desarrollo / por hacer', 0, 0)
    
    pdf.set_fill_color(229, 231, 235); pdf.set_text_color(107, 114, 128)
    pdf.cell(25, 5, 'BLOQUEADO', 0, 0, 'C', fill=True)
    pdf.set_text_color(55, 65, 81)
    pdf.cell(65, 5, ' = Requiere accion externa', 0, 1)
    
    # ============================================
    # 1. DASHBOARD & REPORTES
    # ============================================
    pdf.add_page()
    pdf.section_title('1', 'DASHBOARD & REPORTES')
    pdf.feature_row('Dashboard Principal Admin', 'ACTIVO', 'Metricas, graficas, stats en tiempo real')
    pdf.feature_row('Metas Diarias', 'ACTIVO', 'Objetivos de ventas/citas por dia')
    pdf.feature_row('Reportes Financieros', 'ACTIVO', 'Ingresos, gastos, comparativas')
    pdf.feature_row('Comparativa Anual', 'ACTIVO', 'Comparar temporadas fiscales')
    pdf.feature_row('Analytics de Reembolsos', 'ACTIVO', 'Estadisticas de refunds')
    pdf.feature_row('Email Analytics', 'ACTIVO', 'Metricas de campanas email')
    
    # ============================================
    # 2. GESTION DE CLIENTES
    # ============================================
    pdf.section_title('2', 'GESTION DE CLIENTES')
    pdf.feature_row('CRUD Completo Clientes', 'ACTIVO', 'Crear, editar, buscar, eliminar')
    pdf.feature_row('Notas de Clientes', 'ACTIVO', 'Notas internas por cliente')
    pdf.feature_row('Leads / Prospectos', 'ACTIVO', 'Pipeline de prospectos')
    pdf.feature_row('Cumpleanos Automaticos', 'ACTIVO', 'Notificacion automatica')
    pdf.feature_row('Felicitaciones', 'ACTIVO', 'Mensajes de felicitacion')
    pdf.feature_row('Solicitudes de Empleo', 'ACTIVO', 'Modulo de carreras')
    pdf.feature_row('Opiniones / Feedbacks', 'ACTIVO', 'Recopilar opiniones clientes')
    pdf.feature_row('Resenas Google', 'ACTIVO', 'Integracion Google Reviews')
    pdf.feature_row('Referidos', 'ACTIVO', 'Sistema de referidos con recompensas')
    
    # ============================================
    # 3. CITAS & CALENDARIO
    # ============================================
    pdf.section_title('3', 'CITAS & CALENDARIO')
    pdf.feature_row('Calendario Interactivo', 'ACTIVO', 'Vista dia/semana/mes')
    pdf.feature_row('Sistema de Turnos', 'ACTIVO', 'Cola de espera en oficina')
    pdf.feature_row('Tipos de Cita', 'ACTIVO', 'Configurables con duracion/precio')
    pdf.feature_row('Horarios de Oficina', 'ACTIVO', 'Configuracion de disponibilidad')
    pdf.feature_row('Citas del Tax Wizard', 'ACTIVO', 'Citas generadas desde wizard movil')
    pdf.feature_row('Bloqueos de Horario', 'ACTIVO', 'Bloquear fechas especificas')
    pdf.feature_row('Lista de Espera', 'ACTIVO', 'Waitlist automatico')
    pdf.feature_row('Citas Recurrentes', 'ACTIVO', 'Programar citas periodicas')
    pdf.feature_row('Reglas de Calendario', 'ACTIVO', 'Reglas avanzadas de agenda')
    pdf.feature_row('Metricas de Citas', 'ACTIVO', 'No-shows, cancelaciones, stats')
    
    # ============================================
    # 4. ORDENES & SERVICIOS
    # ============================================
    pdf.section_title('4', 'ORDENES & SERVICIOS')
    pdf.feature_row('Ordenes de Servicio', 'ACTIVO', 'Ver/gestionar ordenes de clientes')
    pdf.feature_row('Servicios Dinamicos', 'ACTIVO', 'Crear servicios con precios/docs')
    pdf.feature_row('Checkout de Servicios', 'ACTIVO', 'Pago CC/ACH integrado NMI')
    pdf.feature_row('Documentos Requeridos', 'ACTIVO', 'Lista bilingue por servicio')
    pdf.feature_row('Modulo Inmigracion', 'ACTIVO', 'Casos, mociones, cotizaciones')
    pdf.feature_row('Pasaportes', 'ACTIVO', 'Solicitudes y seguimiento')
    
    # ============================================
    # 5. IMPUESTOS & IRS
    # ============================================
    pdf.add_page()
    pdf.section_title('5', 'IMPUESTOS & IRS')
    
    pdf.subsection('Tax Wizard (App Movil)')
    pdf.feature_row('Wizard Guiado Paso a Paso', 'ACTIVO', '19 pantallas interactivas')
    pdf.feature_row('Seleccion Filing Status', 'ACTIVO', 'Single, MFJ, MFS, HOH, Widow')
    pdf.feature_row('Informacion Personal', 'ACTIVO', 'Datos del contribuyente')
    pdf.feature_row('Ingresos (W-2, 1099)', 'ACTIVO', 'Entrada manual y scanner')
    pdf.feature_row('W-2 Scanner OCR', 'ACTIVO', 'Escaneo automatico con camara')
    pdf.feature_row('Deducciones', 'ACTIVO', 'Estandar e itemizadas')
    pdf.feature_row('Dependientes', 'ACTIVO', 'Agregar hijos/dependientes')
    pdf.feature_row('Verificacion ID', 'ACTIVO', 'Foto de ID del cliente')
    pdf.feature_row('Firma Electronica', 'ACTIVO', 'Firma digital en pantalla')
    pdf.feature_row('Recomendacion de Plan', 'ACTIVO', 'AI sugiere plan de servicio')
    pdf.feature_row('Seleccion de Plan', 'ACTIVO', 'Elegir plan y precio')
    pdf.feature_row('Pago en Wizard', 'ACTIVO', 'Pagar con CC/ACH al finalizar')
    pdf.feature_row('Agendar Cita', 'ACTIVO', 'Agendar desde el wizard')
    pdf.feature_row('Admin View Wizard', 'ACTIVO', 'Admin ve datos del wizard')
    
    pdf.subsection('Calculadora de Impuestos')
    pdf.feature_row('Estimado Preliminar', 'ACTIVO', 'Calculo basico de refund')
    pdf.feature_row('Brackets 2024 (IRS Oficial)', 'ACTIVO', 'Rev Proc 2023-34 exacto')
    pdf.feature_row('Brackets 2025 (IRS Oficial)', 'ACTIVO', 'Rev Proc 2024-40 actualizado')
    pdf.feature_row('EITC / Child Tax Credit', 'PENDIENTE', 'Creditos avanzados no incluidos')
    pdf.feature_row('Self-Employment Tax', 'PENDIENTE', 'Falta calculo SE Tax')
    pdf.feature_row('State Tax Detallado', 'PENDIENTE', 'Solo FL=0%, resto=5% estimado')
    
    pdf.subsection('IRS e-Services (API Autorizada)')
    pdf.feature_row('IRIS - Filing 1099', 'ACTIVO', 'A2A Filing 1099-NEC, MISC, 1042-S')
    pdf.feature_row('TINM - TIN Matching', 'ACTIVO', 'Verificacion SSN/EIN vs IRS')
    pdf.feature_row('TINM - Batch (25 max)', 'ACTIVO', 'Verificacion en lote')
    pdf.feature_row('TDS - Transcripciones', 'ACTIVO', '5 tipos: Return, Account, W&I...')
    pdf.feature_row('SOR - Buzon Desarrollador', 'ACTIVO', 'Alertas y schemas del IRS')
    pdf.feature_row('Form 4506-C', 'ACTIVO', 'Solicitud de transcripciones')
    pdf.feature_row('Auto-Populate W-2/1099', 'ACTIVO', 'Parser de transcripciones')
    
    pdf.subsection('Tax Engine (E-File al IRS)')
    pdf.feature_row('Form 1040 E-File', 'BLOQUEADO', 'Requiere API: FileYourTaxes.com')
    pdf.feature_row('Form 1120/1120S E-File', 'BLOQUEADO', 'Requiere API: FileYourTaxes.com')
    pdf.feature_row('Form 1065 E-File', 'BLOQUEADO', 'Requiere API: FileYourTaxes.com')
    pdf.feature_row('State Returns E-File', 'BLOQUEADO', 'Requiere API: FileYourTaxes.com')
    
    pdf.subsection('Otros Modulos Fiscales')
    pdf.feature_row('Tax Preparer IRS (PTIN)', 'ACTIVO', 'Datos del preparador')
    pdf.feature_row('Seguimiento Fiscal', 'ACTIVO', 'Tracking de declaraciones')
    pdf.feature_row('Rastreador de Reembolsos', 'ACTIVO', 'Where\'s My Refund')
    pdf.feature_row('Temporadas Fiscales', 'ACTIVO', 'Gestion de tax seasons')
    pdf.feature_row('Importar Temporada', 'ACTIVO', 'Importar datos prev season')
    
    # ============================================
    # 6. NOMINA / PAYROLL
    # ============================================
    pdf.add_page()
    pdf.section_title('6', 'NOMINA / PAYROLL')
    
    pdf.subsection('Empleados Familiares (Fase 1)')
    pdf.feature_row('CRUD Empleados Familiares', 'ACTIVO', 'Child, Spouse, Parent')
    pdf.feature_row('Calculos FICA/IRC', 'ACTIVO', 'Exenciones SS, Medicare, FUTA')
    pdf.feature_row('W-4 Calculator', 'ACTIVO', 'Calculo de retenciones')
    pdf.feature_row('Work Logs', 'ACTIVO', 'Registro de horas')
    pdf.feature_row('Payment Logs', 'ACTIVO', 'Historial de pagos')
    pdf.feature_row('Datos W-2/941/940', 'ACTIVO', 'Datos para formularios IRS')
    pdf.feature_row('Evidencia / Documentos', 'ACTIVO', 'Subir comprobantes')
    pdf.feature_row('PDF Export', 'ACTIVO', 'Exportar a PDF')
    
    pdf.subsection('Sistema de Nomina B2B (Fase 2) - NUEVO')
    pdf.feature_row('Multi-Negocio / Multi-Cliente', 'ACTIVO', 'CRUD negocios con EIN')
    pdf.feature_row('Empleados Genericos', 'ACTIVO', 'W-2, 1099, Family')
    pdf.feature_row('Payroll Runs (Nominas)', 'ACTIVO', 'Crear y procesar nominas')
    pdf.feature_row('Calculo Automatico Impuestos', 'ACTIVO', 'FIT, SS, Medicare, FUTA 2025')
    pdf.feature_row('Pay Stubs (Talones)', 'ACTIVO', 'Generacion e impresion PDF')
    pdf.feature_row('Dashboard Payroll', 'ACTIVO', 'Stats YTD, nominas recientes')
    pdf.feature_row('Reporte Form 941 Trimestral', 'ACTIVO', 'Datos listos para filing')
    pdf.feature_row('Reporte Form 940 Anual', 'ACTIVO', 'FUTA + datos W-2')
    pdf.feature_row('Resumen Mensual', 'ACTIVO', 'Bruto/Neto/Impuestos por mes')
    pdf.feature_row('Deposito Directo', 'PARCIAL', 'Datos guardados, no ejecuta ACH')
    pdf.feature_row('Notificacion Nomina', 'PENDIENTE', 'Email/SMS al procesar')
    
    # ============================================
    # 7. FACTURACION & PAGOS
    # ============================================
    pdf.section_title('7', 'FACTURACION & PAGOS')
    pdf.feature_row('Facturas PDF', 'ACTIVO', 'Generacion automatica')
    pdf.feature_row('Customer Vault NMI', 'ACTIVO', 'Tokenizacion CC y ACH')
    pdf.feature_row('Pagos con Tarjeta', 'ACTIVO', 'Via NMI gateway')
    pdf.feature_row('Pagos ACH', 'ACTIVO', 'Transferencia bancaria')
    pdf.feature_row('Links de Pago', 'ACTIVO', 'Enviar link al cliente')
    pdf.feature_row('Suscripciones NMI', 'ACTIVO', 'Crear/cancelar/gestionar')
    pdf.feature_row('Notificacion al Admin (Pago)', 'ACTIVO', 'Push + SMS + Email al recibir pago')
    pdf.feature_row('Plaid ACH Auth', 'ACTIVO', 'Verificacion bancaria')
    pdf.feature_row('Clover POS', 'ACTIVO', 'Integracion punto de venta')
    pdf.feature_row('Tarjetas con PIN', 'ACTIVO', 'Gift cards / tarjetas prepago')
    pdf.feature_row('Prestamos', 'ACTIVO', 'Modulo de prestamos a clientes')
    pdf.feature_row('Propiedades', 'ACTIVO', 'Gestion de propiedades')
    pdf.feature_row('Recibos AI', 'ACTIVO', 'Clasificacion con IA')
    pdf.feature_row('Facturacion 1099', 'ACTIVO', 'Para contratistas')
    pdf.feature_row('Calculadora General', 'ACTIVO', 'Herramienta de calculo')
    pdf.feature_row('Calculadora W-4', 'ACTIVO', 'Estimar retenciones')
    
    # ============================================
    # 8. COMUNICACION
    # ============================================
    pdf.add_page()
    pdf.section_title('8', 'COMUNICACION')
    pdf.feature_row('Chat en Tiempo Real', 'ACTIVO', 'Mensajeria con clientes')
    pdf.feature_row('WhatsApp Business API', 'ACTIVO', 'Mensajes automaticos')
    pdf.feature_row('WhatsApp Automation', 'ACTIVO', 'Flujos automatizados')
    pdf.feature_row('WhatsApp Bot Settings', 'ACTIVO', 'Config del chatbot')
    pdf.feature_row('Email SendGrid', 'ACTIVO', 'Envio de emails masivos')
    pdf.feature_row('Telefono AI', 'ACTIVO', 'Asistente telefonico IA')
    pdf.feature_row('Push Notifications', 'ACTIVO', 'Notificaciones movil')
    pdf.feature_row('Videollamadas', 'ACTIVO', 'Llamadas de video')
    pdf.feature_row('Mensajes Rapidos', 'ACTIVO', 'Templates rapidos')
    pdf.feature_row('Campanas de Clientes', 'ACTIVO', 'Marketing dirigido')
    pdf.feature_row('Campanas Masivas', 'ACTIVO', 'Email/SMS masivos')
    pdf.feature_row('Plantillas Email', 'ACTIVO', 'Templates personalizables')
    pdf.feature_row('Recordatorios', 'ACTIVO', 'Automaticos por cita/doc')
    
    # ============================================
    # 9. DOCUMENTOS
    # ============================================
    pdf.section_title('9', 'DOCUMENTOS')
    pdf.feature_row('Config. Documentos', 'ACTIVO', 'Tipos de docs requeridos')
    pdf.feature_row('Requisitos por Servicio', 'ACTIVO', 'Bilingue ES/EN')
    pdf.feature_row('PDF Extractor', 'ACTIVO', 'Extraer datos de PDFs')
    pdf.feature_row('Importar/Exportar', 'ACTIVO', 'CSV, Excel, datos')
    
    # ============================================
    # 10. IA & HERRAMIENTAS
    # ============================================
    pdf.section_title('10', 'IA & HERRAMIENTAS')
    pdf.feature_row('Ross AI (Asistente)', 'ACTIVO', 'Chat IA para preguntas fiscales')
    pdf.feature_row('Contenido Educativo', 'ACTIVO', 'Articulos y guias')
    pdf.feature_row('Juegos / Bolita Cubana', 'ACTIVO', 'Entretenimiento en la app')
    pdf.feature_row('Routing Lookup', 'ACTIVO', 'Buscar banco por routing #')
    pdf.feature_row('EIN Lookup', 'ACTIVO', 'Buscar empresa por EIN')
    pdf.feature_row('Campos Dinamicos', 'ACTIVO', 'Config formularios custom')
    
    # ============================================
    # 11. APP MOVIL (Expo)
    # ============================================
    pdf.add_page()
    pdf.section_title('11', 'APP MOVIL (iOS / Android)')
    pdf.feature_row('Home Dashboard', 'ACTIVO', 'Pantalla principal con accesos')
    pdf.feature_row('Soporte Bilingue ES/EN', 'ACTIVO', 'Toggle en tiempo real')
    pdf.feature_row('Tax Wizard Completo', 'ACTIVO', '19 pasos guiados')
    pdf.feature_row('Mis Servicios', 'ACTIVO', 'Ver servicios contratados')
    pdf.feature_row('Service Checkout', 'ACTIVO', 'Pagar servicios CC/ACH')
    pdf.feature_row('Metodos de Pago', 'ACTIVO', 'Gestionar tarjetas/bancos')
    pdf.feature_row('Mis Citas', 'ACTIVO', 'Ver y agendar citas')
    pdf.feature_row('Calendario', 'ACTIVO', 'Vista mensual bilingue')
    pdf.feature_row('Documentos', 'ACTIVO', 'Subir/ver documentos')
    pdf.feature_row('Calculadora Impuestos', 'ACTIVO', 'Estimado de refund')
    pdf.feature_row('Facturas', 'ACTIVO', 'Ver y pagar facturas')
    pdf.feature_row('Perfil / Personal Info', 'ACTIVO', 'Editar datos personales')
    pdf.feature_row('Notificaciones Push', 'ACTIVO', 'Recibir alertas')
    pdf.feature_row('Referidos', 'ACTIVO', 'Compartir codigo referido')
    pdf.feature_row('Educacion Financiera', 'ACTIVO', 'Tips y articulos')
    pdf.feature_row('Solicitar Prestamo', 'ACTIVO', 'Aplicar desde la app')
    pdf.feature_row('Noticias', 'ACTIVO', 'Feed de noticias')
    pdf.feature_row('Soporte / Ayuda', 'ACTIVO', 'Chat de soporte')
    pdf.feature_row('Videollamadas', 'ACTIVO', 'Desde la app')
    pdf.feature_row('Juegos', 'ACTIVO', 'Bolita, rifas, raspaditos')
    pdf.feature_row('OTA Updates', 'ACTIVO', 'Actualizaciones sin store')
    pdf.feature_row('Splash Screen Nativo', 'ACTIVO', 'Expo SDK 54 compatible')
    
    # ============================================
    # 12. SISTEMA & ADMIN
    # ============================================
    pdf.section_title('12', 'SISTEMA & ADMINISTRACION')
    pdf.feature_row('Usuarios & Roles', 'ACTIVO', 'Admin, Staff, Client')
    pdf.feature_row('Logs del Sistema', 'ACTIVO', 'Auditoria de acciones')
    pdf.feature_row('Backup de Datos', 'ACTIVO', 'Respaldo MongoDB')
    pdf.feature_row('Configuracion General', 'ACTIVO', 'Parametros del sistema')
    pdf.feature_row('Control de Versiones App', 'ACTIVO', 'Forzar actualizacion')
    
    # ============================================
    # 13. INTEGRACIONES
    # ============================================
    pdf.add_page()
    pdf.section_title('13', 'INTEGRACIONES DE TERCEROS')
    pdf.feature_row('NMI / Merchant One', 'ACTIVO', 'Pagos CC, ACH, Vault, Subs')
    pdf.feature_row('SendGrid', 'ACTIVO', 'Emails transaccionales/masivos')
    pdf.feature_row('Twilio', 'ACTIVO', 'SMS automaticos')
    pdf.feature_row('Plaid', 'ACTIVO', 'Verificacion bancaria ACH')
    pdf.feature_row('Clover', 'ACTIVO', 'Punto de venta')
    pdf.feature_row('OpenAI GPT-4o', 'ACTIVO', 'Ross AI, clasificacion, OCR')
    pdf.feature_row('Expo Push', 'ACTIVO', 'Notificaciones movil')
    pdf.feature_row('IRS IRIS A2A', 'ACTIVO', 'Filing 1099 electronico')
    pdf.feature_row('IRS TINM', 'ACTIVO', 'Verificacion SSN/EIN')
    pdf.feature_row('IRS TDS', 'ACTIVO', 'Transcripciones fiscales')
    pdf.feature_row('IRS SOR', 'ACTIVO', 'Buzon desarrollador IRS')
    pdf.feature_row('WhatsApp Business', 'ACTIVO', 'API de mensajeria')
    pdf.feature_row('Google Reviews', 'ACTIVO', 'Resenas')
    pdf.feature_row('FileYourTaxes.com API', 'BLOQUEADO', 'Email enviado, esperando resp.')
    pdf.feature_row('Column Tax API', 'BLOQUEADO', 'Email backup enviado')
    
    # ============================================
    # 14. PENDIENTES & PROXIMOS PASOS
    # ============================================
    pdf.section_title('14', 'PENDIENTES & PROXIMOS PASOS')
    pdf.feature_row('Tax Engine Integration', 'BLOQUEADO', 'Esperando FileYourTaxes.com')
    pdf.feature_row('E-File 1040 al IRS', 'BLOQUEADO', 'Depende de Tax Engine')
    pdf.feature_row('E-File Business Returns', 'BLOQUEADO', 'Depende de Tax Engine')
    pdf.feature_row('Deposito Directo Payroll', 'PENDIENTE', 'Ejecutar ACH automatico')
    pdf.feature_row('EITC Calculator', 'PENDIENTE', 'Credito ingreso del trabajo')
    pdf.feature_row('Child Tax Credit', 'PENDIENTE', 'Credito por hijos')
    pdf.feature_row('State Tax Detallado', 'PENDIENTE', 'Calculo por estado')
    pdf.feature_row('Modularizacion server.py', 'PENDIENTE', '44k+ lineas, necesita dividir')
    pdf.feature_row('IRS Refund Status Polling', 'PENDIENTE', 'Where\'s My Refund API')
    
    # ============================================
    # ESTADISTICAS
    # ============================================
    pdf.add_page()
    pdf.section_title('15', 'ESTADISTICAS DE LA PLATAFORMA')
    pdf.ln(4)
    pdf.set_font('Helvetica', 'B', 12)
    pdf.set_text_color(30, 58, 95)
    
    stats = [
        ('Paginas Admin Webapp', '100+'),
        ('Pantallas App Movil', '120+'),
        ('Endpoints API Backend', '500+'),
        ('Lineas de Codigo Backend', '44,000+'),
        ('Integraciones Activas', '13'),
        ('Servicios IRS Aprobados', '4 (IRIS, TINM, TDS, SOR)'),
        ('Idiomas Soportados', '2 (Espanol, Ingles)'),
        ('Plataformas', '3 (iOS, Android, Web)'),
    ]
    
    for label, value in stats:
        pdf.set_font('Helvetica', '', 11)
        pdf.set_text_color(55, 65, 81)
        pdf.cell(100, 7, f'  {label}:', 0, 0, 'L')
        pdf.set_font('Helvetica', 'B', 11)
        pdf.set_text_color(30, 58, 95)
        pdf.cell(90, 7, value, 0, 1, 'L')
    
    # Save
    output_path = '/app/memory/RossTax_Platform_Summary.pdf'
    pdf.output(output_path)
    print(f"PDF generated: {output_path}")
    return output_path

if __name__ == "__main__":
    path = generate_report()
    print(f"Done: {path}")
