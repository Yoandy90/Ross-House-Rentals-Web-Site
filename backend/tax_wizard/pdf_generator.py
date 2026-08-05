"""
Tax Wizard PDF Summary Generator
Generates a professional PDF summary of the tax declaration for clients
"""
import io
import base64
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

class TaxWizardPDFGenerator:
    """Generates PDF summaries for tax wizard sessions"""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        self.styles.add(ParagraphStyle(
            name='TitleGreen',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#065F46'),
            spaceAfter=20,
            alignment=TA_CENTER
        ))
        self.styles.add(ParagraphStyle(
            name='SubtitleGreen',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#10B981'),
            spaceAfter=10,
            alignment=TA_CENTER
        ))
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#065F46'),
            spaceBefore=20,
            spaceAfter=10,
            borderPadding=5
        ))
        self.styles.add(ParagraphStyle(
            name='RefundAmount',
            parent=self.styles['Heading1'],
            fontSize=36,
            textColor=colors.HexColor('#10B981'),
            alignment=TA_CENTER,
            spaceAfter=5
        ))
        self.styles.add(ParagraphStyle(
            name='OwedAmount',
            parent=self.styles['Heading1'],
            fontSize=36,
            textColor=colors.HexColor('#DC2626'),
            alignment=TA_CENTER,
            spaceAfter=5
        ))
        self.styles.add(ParagraphStyle(
            name='SmallText',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.gray
        ))
        self.styles.add(ParagraphStyle(
            name='Disclaimer',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=colors.gray,
            alignment=TA_CENTER,
            spaceBefore=20
        ))
    
    def generate_summary_pdf(self, session_data: dict) -> bytes:
        """
        Generate a PDF summary of the tax wizard session
        Returns the PDF as bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.5*inch,
            bottomMargin=0.5*inch
        )
        
        story = []
        
        # Header
        story.append(Paragraph("💰 Mi Reembolso", self.styles['TitleGreen']))
        story.append(Paragraph("Resumen de tu Declaración de Impuestos", self.styles['SubtitleGreen']))
        story.append(Spacer(1, 10))
        
        # Tax Year
        tax_year = session_data.get('tax_year', datetime.now().year)
        story.append(Paragraph(f"Año Fiscal: {tax_year}", self.styles['Normal']))
        story.append(Paragraph(f"Fecha de Generación: {datetime.now().strftime('%d/%m/%Y %H:%M')}", self.styles['SmallText']))
        story.append(Spacer(1, 20))
        
        # Refund Estimate Box
        refund_estimate = session_data.get('refund_estimate', {})
        estimated_refund = refund_estimate.get('estimated_refund', 0)
        is_refund = refund_estimate.get('is_refund', True)
        
        refund_data = [
            ['REEMBOLSO ESTIMADO' if is_refund else 'IMPUESTO A PAGAR'],
            [f"${abs(estimated_refund):,.2f}"]
        ]
        
        refund_color = colors.HexColor('#ECFDF5') if is_refund else colors.HexColor('#FEF2F2')
        border_color = colors.HexColor('#10B981') if is_refund else colors.HexColor('#DC2626')
        
        refund_table = Table(refund_data, colWidths=[5*inch])
        refund_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), refund_color),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#065F46')),
            ('TEXTCOLOR', (0, 1), (-1, 1), border_color),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('FONTSIZE', (0, 1), (-1, 1), 28),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('BOX', (0, 0), (-1, -1), 2, border_color),
            ('ROUNDEDCORNERS', [10, 10, 10, 10]),
        ]))
        story.append(refund_table)
        story.append(Spacer(1, 20))
        
        # Personal Information
        personal_info = session_data.get('personal_info', {})
        if personal_info:
            story.append(Paragraph("👤 Información Personal", self.styles['SectionHeader']))
            
            pi_data = [
                ['Nombre Completo:', f"{personal_info.get('first_name', '')} {personal_info.get('middle_name', '')} {personal_info.get('last_name', '')}".strip()],
                ['SSN:', f"***-**-{personal_info.get('ssn_last_four', '****')}"],
                ['Fecha de Nacimiento:', personal_info.get('date_of_birth', 'N/A')],
                ['Teléfono:', personal_info.get('phone', 'N/A')],
                ['Email:', personal_info.get('email', 'N/A')],
            ]
            
            address_parts = []
            if personal_info.get('address'):
                address_parts.append(personal_info.get('address'))
            if personal_info.get('city'):
                address_parts.append(personal_info.get('city'))
            if personal_info.get('state'):
                address_parts.append(personal_info.get('state'))
            if personal_info.get('zip_code'):
                address_parts.append(personal_info.get('zip_code'))
            
            if address_parts:
                pi_data.append(['Dirección:', ', '.join(address_parts)])
            
            pi_table = Table(pi_data, colWidths=[2*inch, 4.5*inch])
            pi_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#374151')),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(pi_table)
        
        # Filing Status
        filing_status = session_data.get('filing_status', '')
        if filing_status:
            story.append(Paragraph("💍 Estado Civil", self.styles['SectionHeader']))
            
            status_labels = {
                'single': 'Soltero/a',
                'married_filing_jointly': 'Casado/a - Declaración Conjunta',
                'married_filing_separately': 'Casado/a - Declaración Separada',
                'head_of_household': 'Cabeza de Familia',
                'qualifying_widow': 'Viudo/a Calificado/a'
            }
            
            story.append(Paragraph(f"Estado: <b>{status_labels.get(filing_status, filing_status)}</b>", self.styles['Normal']))
        
        # Income
        income = session_data.get('income', {})
        if income:
            story.append(Paragraph("💼 Ingresos", self.styles['SectionHeader']))
            
            income_data = []
            
            # W-2 Sources
            w2_sources = income.get('w2_sources', [])
            total_w2 = 0
            total_withheld = 0
            
            for w2 in w2_sources:
                employer = w2.get('employer_name', 'Empleador')
                amount = float(w2.get('amount', 0))
                withheld = float(w2.get('federal_withheld', 0))
                total_w2 += amount
                total_withheld += withheld
                income_data.append([f"W-2: {employer}", f"${amount:,.2f}", f"Fed. Retenido: ${withheld:,.2f}"])
            
            if income.get('has_unemployment'):
                unemp = float(income.get('unemployment_amount', 0))
                income_data.append(["Desempleo", f"${unemp:,.2f}", ""])
            
            if income.get('has_self_employment'):
                se_income = float(income.get('self_employment_income', 0))
                se_expenses = float(income.get('self_employment_expenses', 0))
                income_data.append(["Negocio Propio (Ingresos)", f"${se_income:,.2f}", f"Gastos: ${se_expenses:,.2f}"])
            
            if income.get('has_other_income'):
                other = float(income.get('other_income_amount', 0))
                income_data.append(["Otros Ingresos", f"${other:,.2f}", ""])
            
            if income_data:
                income_table = Table(income_data, colWidths=[2.5*inch, 1.5*inch, 2.5*inch])
                income_table.setStyle(TableStyle([
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#065F46')),
                    ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
                ]))
                story.append(income_table)
            
            # Total Income
            total_income = float(income.get('total_income', 0)) or total_w2
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"<b>Ingreso Total: ${total_income:,.2f}</b>", self.styles['Normal']))
            story.append(Paragraph(f"<b>Total Impuestos Retenidos: ${total_withheld:,.2f}</b>", self.styles['Normal']))
        
        # Dependents
        dependents = session_data.get('dependents', [])
        if dependents:
            story.append(Paragraph("👨‍👩‍👧 Dependientes", self.styles['SectionHeader']))
            
            dep_data = [['Nombre', 'Parentesco', 'Fecha de Nac.']]
            for dep in dependents:
                relationship_labels = {
                    'child': 'Hijo/a',
                    'stepchild': 'Hijastro/a',
                    'grandchild': 'Nieto/a',
                    'parent': 'Padre/Madre',
                    'sibling': 'Hermano/a',
                    'other': 'Otro'
                }
                dep_data.append([
                    f"{dep.get('first_name', '')} {dep.get('last_name', '')}",
                    relationship_labels.get(dep.get('relationship', ''), dep.get('relationship', '')),
                    dep.get('date_of_birth', 'N/A')
                ])
            
            dep_table = Table(dep_data, colWidths=[2.5*inch, 2*inch, 2*inch])
            dep_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F3F4F6')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ]))
            story.append(dep_table)
        
        # Deductions
        deductions = session_data.get('deductions_credits', {})
        if deductions:
            story.append(Paragraph("📋 Deducciones y Créditos", self.styles['SectionHeader']))
            
            if deductions.get('use_standard_deduction', True):
                story.append(Paragraph("Tipo de Deducción: <b>Estándar ($14,600)</b>", self.styles['Normal']))
            else:
                story.append(Paragraph("Tipo de Deducción: <b>Detallada</b>", self.styles['Normal']))
                
                itemized_data = []
                if deductions.get('mortgage_interest'):
                    itemized_data.append(['Interés Hipotecario:', f"${float(deductions.get('mortgage_interest', 0)):,.2f}"])
                if deductions.get('property_taxes'):
                    itemized_data.append(['Impuestos de Propiedad:', f"${float(deductions.get('property_taxes', 0)):,.2f}"])
                if deductions.get('charitable_donations'):
                    itemized_data.append(['Donaciones Caritativas:', f"${float(deductions.get('charitable_donations', 0)):,.2f}"])
                
                if itemized_data:
                    itemized_table = Table(itemized_data, colWidths=[3*inch, 2*inch])
                    itemized_table.setStyle(TableStyle([
                        ('FONTSIZE', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 3),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                    ]))
                    story.append(itemized_table)
            
            # Credits
            credits_text = []
            if deductions.get('eligible_for_ctc'):
                credits_text.append("Child Tax Credit")
            if deductions.get('eligible_for_eic'):
                credits_text.append("Earned Income Credit (EITC)")
            if deductions.get('has_childcare_expenses'):
                credits_text.append(f"Crédito por Childcare (${float(deductions.get('childcare_expenses', 0)):,.2f})")
            if deductions.get('has_education_expenses'):
                credits_text.append(f"Crédito Educación (${float(deductions.get('education_expenses', 0)):,.2f})")
            
            if credits_text:
                story.append(Spacer(1, 10))
                story.append(Paragraph(f"Créditos Aplicados: <b>{', '.join(credits_text)}</b>", self.styles['Normal']))
        
        # Summary Box
        story.append(Spacer(1, 20))
        story.append(Paragraph("📊 Resumen del Cálculo", self.styles['SectionHeader']))
        
        summary_data = [
            ['Ingreso Total:', f"${float(refund_estimate.get('total_income', 0)):,.2f}"],
            ['(-) Deducciones:', f"${float(refund_estimate.get('total_deductions', 14600)):,.2f}"],
            ['(=) Ingreso Gravable:', f"${float(refund_estimate.get('taxable_income', 0)):,.2f}"],
            ['Impuesto Calculado:', f"${float(refund_estimate.get('tax_liability', 0)):,.2f}"],
            ['(-) Impuestos Retenidos:', f"${float(refund_estimate.get('total_withheld', 0)):,.2f}"],
            ['(-) Créditos Fiscales:', f"${float(refund_estimate.get('total_credits', 0)):,.2f}"],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#065F46')),
        ]))
        story.append(summary_table)
        
        # Final refund line
        final_data = [[
            'RESULTADO FINAL:' if is_refund else 'IMPUESTO A PAGAR:',
            f"${abs(estimated_refund):,.2f}"
        ]]
        final_table = Table(final_data, colWidths=[3*inch, 2*inch])
        final_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 14),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (1, 0), (1, 0), border_color),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        story.append(final_table)
        
        # Disclaimer
        story.append(Spacer(1, 30))
        story.append(Paragraph(
            "Este es un estimado preliminar basado en la información proporcionada. "
            "El monto final puede variar después de la revisión profesional por Ross Tax Preparation. "
            "Este documento no constituye una declaración de impuestos oficial.",
            self.styles['Disclaimer']
        ))
        
        # Footer
        story.append(Spacer(1, 20))
        story.append(Paragraph(
            "<b>Ross Tax Preparation</b><br/>"
            "305 Bruce Ave, Dumas, TX 79029<br/>"
            "(806) 934-2018 | yoandyross@gmail.com<br/>"
            "EFIN #759071",
            self.styles['Disclaimer']
        ))
        
        # Build PDF
        doc.build(story)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    def generate_summary_pdf_base64(self, session_data: dict) -> str:
        """Generate PDF and return as base64 string"""
        pdf_bytes = self.generate_summary_pdf(session_data)
        return base64.b64encode(pdf_bytes).decode('utf-8')


# Singleton instance
pdf_generator = TaxWizardPDFGenerator()
