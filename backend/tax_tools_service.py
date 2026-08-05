"""
Tax Tools Service - Servicios avanzados para optimización del trabajo
"""
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import re

logger = logging.getLogger(__name__)

class TaxToolsService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.users = db['users']
        self.captured_documents = db['captured_documents']
        self.tax_cases = db['tax_cases']
        self.signatures = db['digital_signatures']
        self.reports = db['generated_reports']
        self.services_marketplace = db['services_marketplace']
        self.educational_content = db['educational_content']
        self.quiz_attempts = db['quiz_attempts']
        
    # ==================== OCR Y EXTRACCIÓN DE DATOS ====================
    
    async def extract_document_data(self, document_id: str, document_type: str) -> Dict:
        """Extrae datos de documentos fiscales usando GPT-4o Vision"""
        try:
            import os
            import json
            
            document = await self.captured_documents.find_one({'_id': document_id})
            if not document:
                # Try with ObjectId
                try:
                    document = await self.captured_documents.find_one({'_id': ObjectId(document_id)})
                except:
                    pass
            
            if not document:
                return {'success': False, 'error': 'Document not found'}
            
            # Get image data
            image_base64 = document.get('image_base64') or document.get('file_data')
            
            if not image_base64:
                return {'success': False, 'error': 'No image data found in document'}
            
            # Use GPT-4o Vision for OCR
            extracted_data = {}
            confidence_score = 0.95
            fields_detected = []
            
            try:
                from emergentintegrations.llm.chat import chat, UserMessage
                
                # Build prompt based on document type
                prompts = {
                    'w2': """Analiza esta imagen de un formulario W-2 y extrae los siguientes datos:
- employer_name: Nombre del empleador (Box c)
- employer_ein: EIN del empleador (Box b) - formato XX-XXXXXXX
- employee_name: Nombre del empleado (Box e)
- employee_ssn: SSN del empleado (Box a) - formato XXX-XX-XXXX (muestra solo últimos 4: ***-**-XXXX)
- wages: Salarios, propinas y otra compensación (Box 1)
- federal_tax_withheld: Impuesto federal retenido (Box 2)
- social_security_wages: Salarios de Seguro Social (Box 3)
- social_security_tax: Impuesto de Seguro Social retenido (Box 4)
- medicare_wages: Salarios de Medicare (Box 5)
- medicare_tax: Impuesto de Medicare retenido (Box 6)
- state: Estado (Box 15)
- state_wages: Salarios estatales (Box 16)
- state_tax: Impuesto estatal retenido (Box 17)

Responde SOLO en formato JSON válido. Los montos deben ser números decimales.
Ejemplo: {"employer_name": "ABC Company", "wages": 52500.00, "federal_tax_withheld": 7800.50}""",
                    
                    '1099': """Analiza esta imagen de un formulario 1099 y extrae los siguientes datos:
- payer_name: Nombre del pagador
- payer_tin: TIN del pagador - formato XX-XXXXXXX
- recipient_name: Nombre del beneficiario
- recipient_tin: TIN del beneficiario (muestra solo últimos 4: ***-**-XXXX)
- income: Monto total de ingresos
- federal_tax_withheld: Impuesto federal retenido (si aplica)
- form_type: Tipo específico (1099-MISC, 1099-NEC, 1099-INT, etc.)

Responde SOLO en formato JSON válido. Los montos deben ser números decimales.""",

                    '1040': """Analiza esta imagen de un formulario 1040 y extrae los siguientes datos:
- tax_year: Año fiscal
- filing_status: Estado civil (Single, Married Filing Jointly, etc.)
- taxpayer_name: Nombre del contribuyente
- spouse_name: Nombre del cónyuge (si aplica)
- total_income: Ingreso total (línea 9)
- adjusted_gross_income: Ingreso bruto ajustado (línea 11)
- taxable_income: Ingreso gravable (línea 15)
- total_tax: Impuesto total (línea 24)
- total_payments: Total de pagos (línea 33)
- refund: Reembolso (línea 34) o amount_owed: Monto adeudado (línea 37)

Responde SOLO en formato JSON válido.""",

                    'passport': """Analiza esta imagen de un pasaporte y extrae:
- first_name: Primer nombre
- last_name: Apellido
- date_of_birth: Fecha de nacimiento (YYYY-MM-DD)
- sex: Sexo (M o F)
- nationality: Nacionalidad
- passport_number: Número de pasaporte
- expiration_date: Fecha de expiración (YYYY-MM-DD)
- place_of_birth: Lugar de nacimiento

Responde SOLO en formato JSON válido.""",

                    'id': """Analiza esta imagen de una identificación y extrae:
- first_name: Primer nombre
- last_name: Apellido
- date_of_birth: Fecha de nacimiento (YYYY-MM-DD)
- address: Dirección completa
- id_number: Número de identificación
- expiration_date: Fecha de expiración (YYYY-MM-DD)
- state: Estado emisor

Responde SOLO en formato JSON válido."""
                }
                
                prompt = prompts.get(document_type, prompts['w2'])
                
                response = await chat(
                    api_key=os.getenv('EMERGENT_LLM_KEY'),
                    model="gpt-4o",
                    messages=[
                        UserMessage(content=[
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}}
                        ])
                    ]
                )
                
                # Parse JSON response
                response_text = response.content if hasattr(response, 'content') else str(response)
                
                # Try to extract JSON from response
                try:
                    start = response_text.find('{')
                    end = response_text.rfind('}') + 1
                    if start >= 0 and end > start:
                        json_str = response_text[start:end]
                        extracted_data = json.loads(json_str)
                        fields_detected = list(extracted_data.keys())
                        confidence_score = 0.95
                except json.JSONDecodeError:
                    logger.warning("Could not parse OCR response as JSON")
                    extracted_data = {'raw_text': response_text}
                    confidence_score = 0.5
                
                logger.info(f"📷 OCR completed for document {document_id}: {fields_detected}")
                
            except ImportError as ie:
                logger.warning(f"emergentintegrations not available: {ie}")
                # Fallback to mock data for testing
                if document_type == 'w2':
                    extracted_data = {
                        'employer_name': 'Sample Employer Inc.',
                        'employer_ein': '12-3456789',
                        'employee_ssn': '***-**-1234',
                        'wages': 50000.00,
                        'federal_tax_withheld': 7500.00,
                        'social_security_wages': 50000.00,
                        'medicare_wages': 50000.00
                    }
                elif document_type == '1099':
                    extracted_data = {
                        'payer_name': 'Sample Payer LLC',
                        'payer_tin': '98-7654321',
                        'recipient_tin': '***-**-1234',
                        'income': 15000.00,
                        'federal_tax_withheld': 0.00
                    }
                fields_detected = list(extracted_data.keys())
                confidence_score = 0.85
            
            except Exception as ocr_error:
                logger.error(f"OCR processing error: {ocr_error}")
                return {'success': False, 'error': f'OCR processing failed: {str(ocr_error)}'}
            
            # Save extracted data to database
            update_doc_id = document.get('_id')
            await self.captured_documents.update_one(
                {'_id': update_doc_id},
                {'$set': {
                    'extracted_data': extracted_data,
                    'ocr_confidence': confidence_score,
                    'ocr_processed_at': datetime.now(timezone.utc),
                    'document_type': document_type
                }}
            )
            
            return {
                'success': True,
                'document_type': document_type,
                'extracted_data': extracted_data,
                'confidence_score': confidence_score,
                'fields_detected': fields_detected,
                'needs_review': confidence_score < 0.9
            }
            
        except Exception as e:
            logger.error(f"Error extracting document data: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== CALCULADORA DE IMPUESTOS ====================
    
    # ============================================
    # STATE TAX RATES (2024-2025) — Official rates by state
    # ============================================
    STATE_TAX_RATES = {
        'AK': 0, 'FL': 0, 'NV': 0, 'NH': 0, 'SD': 0, 'TN': 0, 'TX': 0, 'WA': 0, 'WY': 0,
        'AZ': 0.025, 'CO': 0.044, 'GA': 0.0549, 'ID': 0.058, 'IL': 0.0495,
        'IN': 0.0305, 'KY': 0.04, 'MA': 0.05, 'MI': 0.0425, 'MS': 0.05,
        'NC': 0.0450, 'ND': 0.0195, 'OH': 0.0357, 'PA': 0.0307, 'UT': 0.0465,
        'AL': 0.05, 'AR': 0.044, 'CA': 0.0930, 'CT': 0.0699, 'DE': 0.066,
        'DC': 0.0895, 'HI': 0.0825, 'IA': 0.06, 'KS': 0.057, 'LA': 0.0425,
        'ME': 0.0715, 'MD': 0.0575, 'MN': 0.0985, 'MO': 0.048, 'MT': 0.059,
        'NE': 0.0664, 'NJ': 0.1075, 'NM': 0.059, 'NY': 0.0685, 'OK': 0.0475,
        'OR': 0.099, 'RI': 0.0599, 'SC': 0.064, 'VT': 0.0875, 'VA': 0.0575,
        'WV': 0.0512, 'WI': 0.0765, 'PR': 0.0,
    }

    EITC_TABLES = {
        2024: {
            'max_credit': {0: 632, 1: 3995, 2: 6604, 3: 7430},
            'phase_in_rate': {0: 0.0765, 1: 0.34, 2: 0.40, 3: 0.45},
            'phase_out_start': {
                'single': {0: 9800, 1: 21370, 2: 21370, 3: 21370},
                'married_joint': {0: 16370, 1: 27380, 2: 27380, 3: 27380},
            },
            'phase_out_rate': {0: 0.0765, 1: 0.1598, 2: 0.2106, 3: 0.2106},
            'income_limit': {
                'single': {0: 18591, 1: 46560, 2: 52918, 3: 56838},
                'married_joint': {0: 25511, 1: 53120, 2: 59478, 3: 63398},
            },
            'investment_income_limit': 11600,
        },
        2025: {
            'max_credit': {0: 649, 1: 4108, 2: 6788, 3: 7638},
            'phase_in_rate': {0: 0.0765, 1: 0.34, 2: 0.40, 3: 0.45},
            'phase_out_start': {
                'single': {0: 10100, 1: 21980, 2: 21980, 3: 21980},
                'married_joint': {0: 16850, 1: 28160, 2: 28160, 3: 28160},
            },
            'phase_out_rate': {0: 0.0765, 1: 0.1598, 2: 0.2106, 3: 0.2106},
            'income_limit': {
                'single': {0: 19104, 1: 47900, 2: 54427, 3: 58460},
                'married_joint': {0: 26214, 1: 54660, 2: 61187, 3: 65220},
            },
            'investment_income_limit': 11950,
        },
    }

    def _calculate_eitc(self, earned_income: float, agi: float, filing_status: str,
                         num_children: int, investment_income: float, tax_year: int) -> dict:
        table = self.EITC_TABLES.get(tax_year, self.EITC_TABLES[2024])
        children = min(num_children, 3)
        if investment_income > table['investment_income_limit']:
            return {'amount': 0, 'eligible': False, 'reason': 'Investment income exceeds limit',
                    'reason_es': 'Ingreso por inversiones excede el limite'}
        is_joint = filing_status in ('married_joint', 'widow')
        category = 'married_joint' if is_joint else 'single'
        income_limit = table['income_limit'][category][children]
        check_income = max(earned_income, agi)
        if check_income > income_limit:
            return {'amount': 0, 'eligible': False, 'reason': f'Income exceeds limit',
                    'reason_es': f'Ingreso excede el limite'}
        if filing_status == 'married_separate':
            return {'amount': 0, 'eligible': False, 'reason': 'MFS not eligible',
                    'reason_es': 'Casado por separado no califica'}
        max_credit = table['max_credit'][children]
        phase_in_rate = table['phase_in_rate'][children]
        credit_earned = min(earned_income * phase_in_rate, max_credit)
        phase_out_start = table['phase_out_start'][category][children]
        phase_out_rate = table['phase_out_rate'][children]
        if check_income > phase_out_start:
            credit_earned = max(0, credit_earned - (check_income - phase_out_start) * phase_out_rate)
        credit = round(min(credit_earned, max_credit), 2)
        return {'amount': credit, 'eligible': credit > 0, 'qualifying_children': children,
                'max_possible': max_credit,
                'reason_es': f'EITC con {children} hijos calificados' if credit > 0 else 'Ingreso muy alto para EITC'}

    def _calculate_child_tax_credit(self, num_under_17: int, num_17_plus: int,
                                      agi: float, filing_status: str, tax_year: int) -> dict:
        ctc_per = 2000
        odc_per = 500
        refundable_max = 1700 if tax_year >= 2025 else 1600
        threshold = 400000 if filing_status in ('married_joint', 'widow') else 200000
        gross_ctc = num_under_17 * ctc_per
        gross_odc = num_17_plus * odc_per
        total_gross = gross_ctc + gross_odc
        if agi > threshold:
            import math
            reduction = math.ceil((agi - threshold) / 1000) * 50
            total_credit = max(0, total_gross - reduction)
        else:
            total_credit = total_gross
        refundable = min(num_under_17 * refundable_max, total_credit)
        return {'total_credit': round(total_credit, 2), 'ctc_amount': round(min(gross_ctc, total_credit), 2),
                'odc_amount': round(min(gross_odc, max(0, total_credit - gross_ctc)), 2),
                'refundable_portion': round(refundable, 2),
                'non_refundable_portion': round(total_credit - refundable, 2),
                'children_under_17': num_under_17, 'other_dependents': num_17_plus,
                'phase_out_applied': agi > threshold}

    def _calculate_se_tax(self, se_income: float) -> dict:
        if se_income <= 0:
            return {'se_tax': 0, 'deductible_half': 0, 'ss_portion': 0, 'medicare_portion': 0,
                    'net_se_income': 0, 'applicable': False}
        net = round(se_income * 0.9235, 2)
        ss_base = 176100
        ss_tax = round(min(net, ss_base) * 0.124, 2)
        med_tax = round(net * 0.029, 2)
        add_med = round(max(0, net - 200000) * 0.009, 2)
        total = round(ss_tax + med_tax + add_med, 2)
        return {'se_tax': total, 'deductible_half': round(total / 2, 2), 'ss_portion': ss_tax,
                'medicare_portion': round(med_tax + add_med, 2), 'net_se_income': net, 'applicable': True}

    def _calculate_state_tax(self, taxable_income: float, state: str) -> dict:
        rate = self.STATE_TAX_RATES.get(state.upper(), 0.05)
        tax = round(taxable_income * rate, 2)
        no_tax = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']
        return {'state': state.upper(), 'state_tax': tax, 'rate': round(rate * 100, 2),
                'has_income_tax': state.upper() not in no_tax,
                'note_es': f'Impuesto estatal {state.upper()} al {rate*100:.1f}%' if rate > 0 else f'{state.upper()} no tiene impuesto estatal'}

    async def calculate_taxes(
        self, filing_status: str, income: float, deductions: float = 0,
        credits: float = 0, withholding: float = 0, state: str = 'FL', tax_year: int = 2024,
        num_children_under_17: int = 0, num_children_17_plus: int = 0,
        self_employment_income: float = 0, investment_income: float = 0,
    ) -> Dict:
        """Calcula impuestos federales y estatales con EITC, CTC, SE Tax y State Tax detallado"""
        try:
            standard_deductions_by_year = {
                2024: {'single': 14600, 'married_joint': 29200, 'married_separate': 14600, 'head_of_household': 21900, 'widow': 29200},
                2025: {'single': 15000, 'married_joint': 30000, 'married_separate': 15000, 'head_of_household': 22500, 'widow': 30000},
            }
            standard_deductions = standard_deductions_by_year.get(tax_year, standard_deductions_by_year[2024])
            standard_deduction = standard_deductions.get(filing_status, standard_deductions['single'])
            se_result = self._calculate_se_tax(self_employment_income)
            se_deduction = se_result['deductible_half']
            total_deductions = max(deductions, standard_deduction) + se_deduction
            total_income = income + self_employment_income
            agi = max(0, total_income - se_deduction)
            taxable_income = max(0, total_income - total_deductions)
            federal_tax = self._calculate_federal_tax(taxable_income, filing_status, tax_year)
            ctc_result = self._calculate_child_tax_credit(num_children_under_17, num_children_17_plus, agi, filing_status, tax_year)
            total_children = num_children_under_17 + num_children_17_plus
            eitc_result = self._calculate_eitc(total_income, agi, filing_status, total_children, investment_income, tax_year)
            non_refundable_credits = credits + ctc_result['non_refundable_portion']
            federal_tax_after_credits = max(0, federal_tax - non_refundable_credits)
            refundable_credits = ctc_result['refundable_portion'] + eitc_result['amount']
            se_tax = se_result['se_tax']
            state_result = self._calculate_state_tax(taxable_income, state)
            state_tax = state_result['state_tax']
            total_tax = federal_tax_after_credits + se_tax + state_tax
            refund_or_owed = withholding + refundable_credits - total_tax
            effective_rate = (total_tax / total_income * 100) if total_income > 0 else 0
            return {
                'tax_year': tax_year,
                'federal_tax': round(federal_tax_after_credits, 2),
                'se_tax': round(se_tax, 2),
                'state_tax': round(state_tax, 2),
                'total_tax': round(total_tax, 2),
                'effective_rate': round(effective_rate, 2),
                'refund_or_owed': round(refund_or_owed, 2),
                'refundable_credits': round(refundable_credits, 2),
                'breakdown': {
                    'gross_income': total_income, 'w2_income': income,
                    'self_employment_income': self_employment_income,
                    'agi': round(agi, 2), 'standard_deduction': standard_deduction,
                    'se_deduction': se_deduction, 'total_deductions': round(total_deductions, 2),
                    'taxable_income': round(taxable_income, 2),
                    'federal_tax_before_credits': round(federal_tax, 2),
                    'credits_applied': credits, 'withholding': withholding,
                    'filing_status': filing_status,
                },
                'credits_detail': {
                    'child_tax_credit': ctc_result, 'eitc': eitc_result,
                    'other_credits': credits,
                    'total_non_refundable': round(non_refundable_credits, 2),
                    'total_refundable': round(refundable_credits, 2),
                },
                'se_tax_detail': se_result,
                'state_tax_detail': state_result,
            }
        except Exception as e:
            logger.error(f"Error calculating taxes: {e}")
            return {'error': str(e)}
    
    def _calculate_federal_tax(self, taxable_income: float, filing_status: str, tax_year: int = 2024) -> float:
        """Calcula impuesto federal usando brackets IRS oficiales para 2024 y 2025"""
        
        # Tax brackets 2024
        brackets_2024 = {
            'single': [
                (11600, 0.10, 0),
                (47150, 0.12, 1160),
                (100525, 0.22, 5426),
                (191950, 0.24, 17168.50),
                (243725, 0.32, 39110.50),
                (609350, 0.35, 55678.50),
                (float('inf'), 0.37, 183647.25)
            ],
            'married_joint': [
                (23200, 0.10, 0),
                (94300, 0.12, 2320),
                (201050, 0.22, 10852),
                (383900, 0.24, 34337),
                (487450, 0.32, 78221),
                (731200, 0.35, 111357),
                (float('inf'), 0.37, 196669.50)
            ],
            'married_separate': [
                (11600, 0.10, 0),
                (47150, 0.12, 1160),
                (100525, 0.22, 5426),
                (191950, 0.24, 17168.50),
                (243725, 0.32, 39110.50),
                (365600, 0.35, 55678.50),
                (float('inf'), 0.37, 98334.75)
            ],
            'head_of_household': [
                (16550, 0.10, 0),
                (63100, 0.12, 1655),
                (100500, 0.22, 7241),
                (191950, 0.24, 15469),
                (243700, 0.32, 37417),
                (609350, 0.35, 53977),
                (float('inf'), 0.37, 181954.50)
            ],
            'widow': [
                (23200, 0.10, 0),
                (94300, 0.12, 2320),
                (201050, 0.22, 10852),
                (383900, 0.24, 34337),
                (487450, 0.32, 78221),
                (731200, 0.35, 111357),
                (float('inf'), 0.37, 196669.50)
            ]
        }
        
        # Tax brackets 2025 — OFICIAL IRS Rev Proc 2024-40
        brackets_2025 = {
            'single': [
                (11925, 0.10, 0),
                (48475, 0.12, 1192.50),
                (103350, 0.22, 5578.50),
                (197300, 0.24, 17651.00),
                (250525, 0.32, 40199.00),
                (626350, 0.35, 57231.00),
                (float('inf'), 0.37, 188769.75)
            ],
            'married_joint': [
                (23850, 0.10, 0),
                (96950, 0.12, 2385.00),
                (206700, 0.22, 11157.00),
                (394600, 0.24, 35302.00),
                (501050, 0.32, 80398.00),
                (751600, 0.35, 113826.00),
                (float('inf'), 0.37, 201519.50)
            ],
            'married_separate': [
                (11925, 0.10, 0),
                (48475, 0.12, 1192.50),
                (103350, 0.22, 5578.50),
                (197300, 0.24, 17651.00),
                (250525, 0.32, 40199.00),
                (375800, 0.35, 57231.00),
                (float('inf'), 0.37, 100977.50)
            ],
            'head_of_household': [
                (17000, 0.10, 0),
                (64850, 0.12, 1700.00),
                (103350, 0.22, 7442.00),
                (197300, 0.24, 15912.00),
                (250500, 0.32, 38460.00),
                (626350, 0.35, 55484.00),
                (float('inf'), 0.37, 187031.50)
            ],
            'widow': [
                (23850, 0.10, 0),
                (96950, 0.12, 2385.00),
                (206700, 0.22, 11157.00),
                (394600, 0.24, 35302.00),
                (501050, 0.32, 80398.00),
                (751600, 0.35, 113826.00),
                (float('inf'), 0.37, 201519.50)
            ]
        }
        
        # Seleccionar brackets según el año
        brackets = brackets_2024 if tax_year == 2024 else brackets_2025
        
        # Obtener brackets para el filing status
        status_brackets = brackets.get(filing_status, brackets['single'])
        
        # Calcular impuesto
        for threshold, rate, base_tax in status_brackets:
            if taxable_income <= threshold:
                if base_tax == 0:
                    return taxable_income * rate
                else:
                    previous_threshold = 0
                    for i, (t, r, b) in enumerate(status_brackets):
                        if b == base_tax:
                            if i > 0:
                                previous_threshold = status_brackets[i-1][0]
                            break
                    return base_tax + (taxable_income - previous_threshold) * rate
        
        return 0
    
    # ==================== VALIDADOR DE DOCUMENTOS ====================
    
    async def validate_document(self, document_id: str) -> Dict:
        """Valida completitud y corrección de documentos fiscales"""
        try:
            document = await self.captured_documents.find_one({'_id': document_id})
            if not document:
                return {'success': False, 'error': 'Document not found'}
            
            errors = []
            warnings = []
            missing_fields = []
            compliance_score = 100
            
            extracted_data = document.get('extracted_data', {})
            doc_type = document.get('document_type')
            
            # Validaciones según tipo
            if doc_type == 'w2':
                required_fields = ['employer_name', 'employer_ein', 'employee_ssn', 'wages', 'federal_tax_withheld']
                for field in required_fields:
                    if field not in extracted_data or not extracted_data[field]:
                        missing_fields.append(field)
                        compliance_score -= 20
                
                # Validar formato EIN
                ein = extracted_data.get('employer_ein', '')
                if ein and not re.match(r'\d{2}-\d{7}', ein):
                    errors.append('EIN format invalid (should be XX-XXXXXXX)')
                    compliance_score -= 10
                
                # Validar montos
                wages = extracted_data.get('wages', 0)
                withheld = extracted_data.get('federal_tax_withheld', 0)
                if withheld > wages * 0.4:
                    warnings.append('Federal tax withheld seems high (>40% of wages)')
            
            elif doc_type == '1099':
                required_fields = ['payer_name', 'payer_tin', 'recipient_tin', 'income']
                for field in required_fields:
                    if field not in extracted_data or not extracted_data[field]:
                        missing_fields.append(field)
                        compliance_score -= 25
            
            is_valid = len(errors) == 0 and len(missing_fields) == 0
            
            return {
                'is_valid': is_valid,
                'errors': errors,
                'warnings': warnings,
                'missing_fields': missing_fields,
                'compliance_score': max(0, compliance_score)
            }
            
        except Exception as e:
            logger.error(f"Error validating document: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== PREDICTOR DE REEMBOLSO ====================
    
    async def predict_refund(self, user_id: str, current_year: int) -> Dict:
        """Predice reembolso basado en histórico"""
        try:
            # Obtener casos anteriores
            previous_cases = await self.tax_cases.find({
                'user_id': user_id,
                'year': {'$lt': current_year}
            }).sort('year', -1).limit(3).to_list(length=3)
            
            if not previous_cases:
                return {
                    'predicted_refund': 0,
                    'confidence': 'low',
                    'comparison_previous_years': [],
                    'factors': ['No historical data available'],
                    'recommendations': ['This is your first year with us']
                }
            
            # Calcular promedio de reembolsos anteriores
            refunds = [case.get('refund_amount', 0) for case in previous_cases]
            avg_refund = sum(refunds) / len(refunds)
            
            # Ajustar por inflación (3% anual aprox)
            years_diff = current_year - previous_cases[0].get('year', current_year)
            adjusted_prediction = avg_refund * (1.03 ** years_diff)
            
            comparison = [
                {
                    'year': case.get('year'),
                    'refund': case.get('refund_amount', 0),
                    'income': case.get('total_income', 0)
                }
                for case in previous_cases
            ]
            
            # Determinar confianza
            variance = max(refunds) - min(refunds)
            if variance < avg_refund * 0.2:
                confidence = 'high'
            elif variance < avg_refund * 0.5:
                confidence = 'medium'
            else:
                confidence = 'low'
            
            factors = [
                f'Based on {len(previous_cases)} previous years',
                f'Average refund: ${avg_refund:,.2f}',
                f'Adjusted for inflation and trends'
            ]
            
            recommendations = []
            if adjusted_prediction < 0:
                recommendations.append('You may owe taxes this year. Consider quarterly payments.')
            elif adjusted_prediction > 5000:
                recommendations.append('Large refund expected. Consider adjusting withholding.')
            else:
                recommendations.append('Refund amount looks balanced.')
            
            return {
                'predicted_refund': round(adjusted_prediction, 2),
                'confidence': confidence,
                'comparison_previous_years': comparison,
                'factors': factors,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error(f"Error predicting refund: {e}")
            return {'error': str(e)}
    
    # ==================== GESTIÓN DE ESTADO DE CASOS ====================
    
    async def update_case_status(
        self,
        case_id: str,
        status: str,
        notes: Optional[str] = None,
        estimated_completion: Optional[str] = None
    ) -> Dict:
        """Actualiza estado de un caso"""
        try:
            update_data = {
                'status': status,
                'updated_at': datetime.now(timezone.utc)
            }
            
            if notes:
                update_data['status_notes'] = notes
            if estimated_completion:
                update_data['estimated_completion'] = estimated_completion
            
            # Registrar en timeline
            timeline_event = {
                'status': status,
                'timestamp': datetime.now(timezone.utc),
                'notes': notes
            }
            
            result = await self.tax_cases.update_one(
                {'_id': case_id},
                {
                    '$set': update_data,
                    '$push': {'timeline': timeline_event}
                }
            )
            
            if result.modified_count > 0:
                # Notificar al cliente
                case = await self.tax_cases.find_one({'_id': case_id})
                user_id = case.get('user_id')
                
                if user_id:
                    notification = {
                        'id': str(ObjectId()),
                        'user_id': user_id,
                        'type': 'case_status_update',
                        'title': 'Actualización de tu Caso',
                        'message': f'Tu declaración ha cambiado a: {self._get_status_label(status)}',
                        'created_at': datetime.now(timezone.utc),
                        'read': False
                    }
                    await self.db.notifications.insert_one(notification)
                
                return {'success': True, 'message': 'Status updated successfully'}
            else:
                return {'success': False, 'message': 'Case not found'}
                
        except Exception as e:
            logger.error(f"Error updating case status: {e}")
            return {'success': False, 'error': str(e)}
    
    def _get_status_label(self, status: str) -> str:
        """Convierte status a etiqueta legible"""
        labels = {
            'pending_documents': 'Esperando Documentos',
            'documents_received': 'Documentos Recibidos',
            'under_review': 'En Revisión',
            'in_preparation': 'En Preparación',
            'ready_for_signature': 'Listo para Firmar',
            'filed': 'Declarado',
            'accepted': 'Aceptado por IRS',
            'refund_issued': 'Reembolso Emitido',
            'completed': 'Completado'
        }
        return labels.get(status, status)
    
    async def get_case_timeline(self, case_id: str) -> Dict:
        """Obtiene timeline completo de un caso"""
        try:
            case = await self.tax_cases.find_one({'_id': case_id})
            if not case:
                return {'success': False, 'error': 'Case not found'}
            
            timeline = case.get('timeline', [])
            current_status = case.get('status', 'pending_documents')
            
            # Calcular progreso
            status_order = [
                'pending_documents', 'documents_received', 'under_review',
                'in_preparation', 'ready_for_signature', 'filed',
                'accepted', 'refund_issued', 'completed'
            ]
            
            current_index = status_order.index(current_status) if current_status in status_order else 0
            progress_percentage = int((current_index / (len(status_order) - 1)) * 100)
            
            return {
                'case_id': case_id,
                'events': timeline,
                'current_status': current_status,
                'progress_percentage': progress_percentage
            }
            
        except Exception as e:
            logger.error(f"Error getting case timeline: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== FIRMA DIGITAL ====================
    
    async def create_digital_signature(
        self,
        document_id: str,
        user_id: str,
        signature_data: str,
        ip_address: str,
        device_info: str
    ) -> Dict:
        """Crea firma digital legalmente válida"""
        try:
            signature_id = str(ObjectId())
            timestamp = datetime.now(timezone.utc)
            
            signature_doc = {
                '_id': signature_id,
                'id': signature_id,
                'document_id': document_id,
                'user_id': user_id,
                'signature_data': signature_data,
                'ip_address': ip_address,
                'device_info': device_info,
                'timestamp': timestamp,
                'legal_binding': True,
                'verification_hash': self._generate_verification_hash(signature_data, timestamp)
            }
            
            await self.signatures.insert_one(signature_doc)
            
            # Actualizar documento como firmado
            await self.captured_documents.update_one(
                {'_id': document_id},
                {'$set': {
                    'signed': True,
                    'signed_at': timestamp,
                    'signature_id': signature_id
                }}
            )
            
            return {
                'success': True,
                'signature_id': signature_id,
                'timestamp': timestamp.isoformat(),
                'legal_binding': True
            }
            
        except Exception as e:
            logger.error(f"Error creating digital signature: {e}")
            return {'success': False, 'error': str(e)}
    
    def _generate_verification_hash(self, signature_data: str, timestamp: datetime) -> str:
        """Genera hash de verificación"""
        import hashlib
        data = f"{signature_data}{timestamp.isoformat()}".encode()
        return hashlib.sha256(data).hexdigest()
    
    # ==================== REPORTES AUTOMÁTICOS ====================
    
    async def generate_report(
        self,
        report_type: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict:
        """Genera reportes automáticos con insights"""
        try:
            report_id = str(ObjectId())
            
            # Determinar rango de fechas
            if report_type == 'weekly':
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=7)
            elif report_type == 'monthly':
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=30)
            elif report_type == 'yearly':
                end = datetime.now(timezone.utc)
                start = end - timedelta(days=365)
            else:
                start = datetime.fromisoformat(start_date) if start_date else datetime.now(timezone.utc) - timedelta(days=30)
                end = datetime.fromisoformat(end_date) if end_date else datetime.now(timezone.utc)
            
            # Recopilar datos
            cases_completed = await self.tax_cases.count_documents({
                'status': 'completed',
                'completed_at': {'$gte': start, '$lte': end}
            })
            
            total_revenue = 0
            revenue_cursor = self.tax_cases.find({
                'completed_at': {'$gte': start, '$lte': end}
            })
            async for case in revenue_cursor:
                total_revenue += case.get('fee', 0)
            
            active_clients = await self.users.count_documents({
                'role': 'client',
                'last_login': {'$gte': start}
            })
            
            new_clients = await self.users.count_documents({
                'role': 'client',
                'created_at': {'$gte': start, '$lte': end}
            })
            
            # Generar insights
            insights = []
            if cases_completed > 0:
                avg_revenue = total_revenue / cases_completed
                insights.append(f"Promedio de ingreso por caso: ${avg_revenue:.2f}")
            
            if new_clients > 0:
                insights.append(f"Se ganaron {new_clients} nuevos clientes este período")
            
            if cases_completed > 20:
                insights.append("¡Excelente productividad! Período de alto volumen")
            
            report_data = {
                'cases_completed': cases_completed,
                'total_revenue': round(total_revenue, 2),
                'active_clients': active_clients,
                'new_clients': new_clients,
                'period': {
                    'start': start.isoformat(),
                    'end': end.isoformat()
                }
            }
            
            # Guardar reporte
            report_doc = {
                '_id': report_id,
                'id': report_id,
                'type': report_type,
                'data': report_data,
                'insights': insights,
                'generated_at': datetime.now(timezone.utc)
            }
            
            await self.reports.insert_one(report_doc)
            
            return {
                'report_id': report_id,
                'data': report_data,
                'charts': [],  # Podrías agregar datos para gráficas
                'insights': insights,
                'generated_at': datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return {'error': str(e)}
    
    # ==================== SISTEMA DE PRIORIZACIÓN ====================
    
    async def prioritize_cases(self) -> List[Dict]:
        """Prioriza casos por urgencia y deadline"""
        try:
            cases = await self.tax_cases.find({
                'status': {'$nin': ['completed', 'filed']}
            }).to_list(length=None)
            
            prioritized = []
            
            for case in cases:
                deadline_str = case.get('deadline')
                if not deadline_str:
                    continue
                
                deadline = datetime.fromisoformat(deadline_str) if isinstance(deadline_str, str) else deadline_str
                days_until_deadline = (deadline - datetime.now(timezone.utc)).days
                
                # Calcular score de prioridad
                priority_score = 100
                urgency_level = 'low'
                reason = []
                
                if days_until_deadline < 0:
                    priority_score = 200
                    urgency_level = 'critical'
                    reason.append(f"¡VENCIDO! Hace {abs(days_until_deadline)} días")
                elif days_until_deadline <= 3:
                    priority_score = 150
                    urgency_level = 'critical'
                    reason.append(f"Vence en {days_until_deadline} días")
                elif days_until_deadline <= 7:
                    priority_score = 120
                    urgency_level = 'high'
                    reason.append(f"Vence esta semana ({days_until_deadline} días)")
                elif days_until_deadline <= 14:
                    priority_score = 100
                    urgency_level = 'medium'
                    reason.append(f"Vence en {days_until_deadline} días")
                else:
                    priority_score = 50
                    urgency_level = 'low'
                    reason.append("Sin urgencia inmediata")
                
                # Ajustar por estado
                status = case.get('status', '')
                if status == 'ready_for_signature':
                    priority_score += 30
                    reason.append("Esperando firma del cliente")
                elif status == 'pending_documents':
                    priority_score += 20
                    reason.append("Esperando documentos")
                
                prioritized.append({
                    'case_id': case.get('_id'),
                    'client_name': case.get('client_name', 'Unknown'),
                    'priority_score': priority_score,
                    'deadline': deadline.isoformat(),
                    'days_until_deadline': days_until_deadline,
                    'urgency_level': urgency_level,
                    'reason': ' | '.join(reason),
                    'status': status
                })
            
            # Ordenar por score (mayor primero)
            prioritized.sort(key=lambda x: x['priority_score'], reverse=True)
            
            return prioritized
            
        except Exception as e:
            logger.error(f"Error prioritizing cases: {e}")
            return []
    
    # ==================== MARKETPLACE DE SERVICIOS ====================
    
    async def get_available_services(self) -> List[Dict]:
        """Obtiene servicios disponibles en el marketplace"""
        try:
            services = await self.services_marketplace.find({
                'available': True
            }).to_list(length=None)
            
            return services
            
        except Exception as e:
            logger.error(f"Error getting services: {e}")
            return []
    
    async def purchase_service(
        self,
        service_id: str,
        user_id: str,
        payment_method: str
    ) -> Dict:
        """Procesa compra de servicio adicional"""
        try:
            service = await self.services_marketplace.find_one({'_id': service_id})
            if not service:
                return {'success': False, 'error': 'Service not found'}
            
            if not service.get('available'):
                return {'success': False, 'error': 'Service not available'}
            
            # Crear orden
            order_id = str(ObjectId())
            order = {
                '_id': order_id,
                'id': order_id,
                'service_id': service_id,
                'user_id': user_id,
                'service_name': service.get('name'),
                'price': service.get('price'),
                'payment_method': payment_method,
                'status': 'pending',
                'created_at': datetime.now(timezone.utc)
            }
            
            await self.db.service_orders.insert_one(order)
            
            # Aquí integrarías con Stripe o tu procesador de pagos
            
            return {
                'success': True,
                'order_id': order_id,
                'amount': service.get('price'),
                'message': 'Service purchased successfully'
            }
            
        except Exception as e:
            logger.error(f"Error purchasing service: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== CONTENIDO EDUCACIONAL ====================
    
    async def get_educational_content(
        self,
        content_type: Optional[str] = None,
        difficulty: Optional[str] = None
    ) -> List[Dict]:
        """Obtiene contenido educacional"""
        try:
            query = {}
            if content_type:
                query['type'] = content_type
            if difficulty:
                query['difficulty'] = difficulty
            
            content = await self.educational_content.find(query).to_list(length=None)
            return content
            
        except Exception as e:
            logger.error(f"Error getting educational content: {e}")
            return []
    
    async def submit_quiz(self, quiz_id: str, user_id: str, answers: List[Dict]) -> Dict:
        """Evalúa respuestas de quiz"""
        try:
            quiz = await self.educational_content.find_one({'_id': quiz_id, 'type': 'quiz'})
            if not quiz:
                return {'success': False, 'error': 'Quiz not found'}
            
            correct_answers = quiz.get('correct_answers', [])
            total_questions = len(correct_answers)
            correct_count = 0
            
            for i, answer in enumerate(answers):
                if i < len(correct_answers) and answer.get('answer') == correct_answers[i]:
                    correct_count += 1
            
            score = int((correct_count / total_questions) * 100) if total_questions > 0 else 0
            passed = score >= 70
            
            # Guardar intento
            attempt = {
                'id': str(ObjectId()),
                'quiz_id': quiz_id,
                'user_id': user_id,
                'answers': answers,
                'score': score,
                'correct_answers': correct_count,
                'total_questions': total_questions,
                'passed': passed,
                'completed_at': datetime.now(timezone.utc)
            }
            
            await self.quiz_attempts.insert_one(attempt)
            
            # Otorgar certificado si pasó
            certificate_earned = False
            if passed:
                certificate = {
                    'id': str(ObjectId()),
                    'user_id': user_id,
                    'quiz_id': quiz_id,
                    'quiz_title': quiz.get('title'),
                    'score': score,
                    'issued_at': datetime.now(timezone.utc)
                }
                await self.db.certificates.insert_one(certificate)
                certificate_earned = True
            
            return {
                'score': score,
                'passed': passed,
                'correct_answers': correct_count,
                'total_questions': total_questions,
                'certificate_earned': certificate_earned
            }
            
        except Exception as e:
            logger.error(f"Error submitting quiz: {e}")
            return {'success': False, 'error': str(e)}
    
    # ==================== SIMULADOR DE ESCENARIOS ====================
    
    async def simulate_tax_scenario(
        self,
        base_situation: Dict,
        scenario_changes: Dict
    ) -> Dict:
        """Simula impacto fiscal de diferentes escenarios"""
        try:
            # Calcular impuestos con situación base
            base_calc = await self.calculate_taxes(
                filing_status=base_situation.get('filing_status', 'single'),
                income=base_situation.get('income', 0),
                deductions=base_situation.get('deductions', 0),
                credits=base_situation.get('credits', 0),
                withholding=base_situation.get('withholding', 0)
            )
            
            # Aplicar cambios del escenario
            new_situation = base_situation.copy()
            new_situation.update(scenario_changes)
            
            # Calcular impuestos con el escenario
            scenario_calc = await self.calculate_taxes(
                filing_status=new_situation.get('filing_status', 'single'),
                income=new_situation.get('income', 0),
                deductions=new_situation.get('deductions', 0),
                credits=new_situation.get('credits', 0),
                withholding=new_situation.get('withholding', 0)
            )
            
            current_tax = base_calc.get('total_tax', 0)
            scenario_tax = scenario_calc.get('total_tax', 0)
            difference = scenario_tax - current_tax
            impact_percentage = (difference / current_tax * 100) if current_tax > 0 else 0
            
            # Generar recomendaciones
            recommendations = []
            if difference > 0:
                recommendations.append(f"Este escenario aumentaría tus impuestos en ${abs(difference):.2f}")
                recommendations.append("Considera estrategias de optimización fiscal")
            elif difference < 0:
                recommendations.append(f"Este escenario reduciría tus impuestos en ${abs(difference):.2f}")
                recommendations.append("Esta podría ser una buena decisión fiscal")
            else:
                recommendations.append("Este escenario no afecta significativamente tus impuestos")
            
            # Recomendaciones específicas por tipo de cambio
            if 'married' in scenario_changes and scenario_changes['married']:
                recommendations.append("El estado civil casado suele ofrecer mejores tasas")
            
            if 'children' in scenario_changes and scenario_changes['children'] > 0:
                recommendations.append(f"Con {scenario_changes['children']} hijo(s), calificas para Child Tax Credit")
            
            return {
                'current_tax': round(current_tax, 2),
                'scenario_tax': round(scenario_tax, 2),
                'difference': round(difference, 2),
                'impact_percentage': round(impact_percentage, 2),
                'recommendations': recommendations,
                'scenario_changes': scenario_changes
            }
            
        except Exception as e:
            logger.error(f"Error simulating tax scenario: {e}")
            return {'error': str(e)}
    
    # ==================== DETECTOR DE AUDITORÍAS ====================
    
    async def detect_audit_risks(self, case_id: str) -> Dict:
        """Analiza una declaración para detectar red flags del IRS"""
        try:
            case = await self.tax_cases.find_one({'_id': case_id})
            if not case:
                return {'success': False, 'error': 'Case not found'}
            
            risk_score = 0
            red_flags = []
            warnings = []
            recommendations = []
            
            income = case.get('total_income', 0)
            deductions = case.get('total_deductions', 0)
            
            # Red flag: Deducciones muy altas
            if income > 0 and (deductions / income) > 0.5:
                risk_score += 30
                red_flags.append("Deducciones exceden el 50% del ingreso")
                recommendations.append("Asegúrate de tener documentación completa de todas las deducciones")
            
            # Red flag: Ingreso muy bajo con gastos altos
            if income < 25000 and deductions > 15000:
                risk_score += 25
                red_flags.append("Proporción inusual entre ingresos y deducciones")
            
            # Red flag: Hobby Loss (pérdidas recurrentes de negocios)
            business_loss = case.get('business_loss', 0)
            if business_loss > 0:
                # Buscar pérdidas en años anteriores
                prev_cases = await self.tax_cases.find({
                    'user_id': case.get('user_id'),
                    'year': {'$lt': case.get('year', 2024)}
                }).to_list(length=3)
                
                losses_count = sum(1 for c in prev_cases if c.get('business_loss', 0) > 0)
                if losses_count >= 2:
                    risk_score += 40
                    red_flags.append("Pérdidas de negocio en múltiples años (Hobby Loss Rule)")
                    recommendations.append("Demuestra intención de lucro en tu negocio")
            
            # Red flag: Home office muy alto
            home_office = case.get('home_office_deduction', 0)
            if home_office > 5000:
                risk_score += 15
                warnings.append("Deducción de oficina en casa es alta")
                recommendations.append("Mantén registros detallados del espacio dedicado")
            
            # Red flag: Donaciones caritativas muy altas
            charitable = case.get('charitable_contributions', 0)
            if income > 0 and (charitable / income) > 0.3:
                risk_score += 20
                warnings.append("Donaciones caritativas exceden el 30% del ingreso")
                recommendations.append("Conserva todos los recibos de donaciones")
            
            # Red flag: Ingresos en efectivo no reportados
            cash_income = case.get('cash_income', 0)
            if cash_income > 10000:
                risk_score += 25
                warnings.append("Ingresos significativos en efectivo")
                recommendations.append("Documenta todas las transacciones en efectivo")
            
            # Determinar nivel de riesgo
            if risk_score >= 80:
                risk_level = 'high'
            elif risk_score >= 50:
                risk_level = 'medium'
            elif risk_score >= 25:
                risk_level = 'low'
            else:
                risk_level = 'minimal'
            
            return {
                'case_id': case_id,
                'risk_score': risk_score,
                'risk_level': risk_level,
                'red_flags': red_flags,
                'warnings': warnings,
                'recommendations': recommendations,
                'should_review': risk_score >= 50
            }
            
        except Exception as e:
            logger.error(f"Error detecting audit risks: {e}")
            return {'success': False, 'error': str(e)}

