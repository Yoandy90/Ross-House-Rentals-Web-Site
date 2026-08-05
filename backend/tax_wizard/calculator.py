"""
Calculadora de Impuestos Estimados
Calcula reembolso/pago estimado en tiempo real
Valores actualizados para año fiscal 2025 (IRS Rev. Proc. 2024-40)
"""
from typing import Dict, Optional
from .models import (
    TaxWizardSession, FilingStatus, RefundEstimate,
    IncomeInfo, DeductionsCredits
)


# Tasas de impuestos federales 2025 (IRS Rev. Proc. 2024-40)
TAX_BRACKETS_2025 = {
    FilingStatus.SINGLE: [
        (11925, 0.10),
        (48475, 0.12),
        (103350, 0.22),
        (197300, 0.24),
        (250525, 0.32),
        (626350, 0.35),
        (float('inf'), 0.37)
    ],
    FilingStatus.MARRIED_JOINT: [
        (23850, 0.10),
        (96950, 0.12),
        (206700, 0.22),
        (394600, 0.24),
        (501050, 0.32),
        (751600, 0.35),
        (float('inf'), 0.37)
    ],
    FilingStatus.MARRIED_SEPARATE: [
        (11925, 0.10),
        (48475, 0.12),
        (103350, 0.22),
        (197300, 0.24),
        (250525, 0.32),
        (375800, 0.35),
        (float('inf'), 0.37)
    ],
    FilingStatus.HEAD_OF_HOUSEHOLD: [
        (17000, 0.10),
        (64850, 0.12),
        (103350, 0.22),
        (197300, 0.24),
        (250500, 0.32),
        (626350, 0.35),
        (float('inf'), 0.37)
    ]
}

# Deducciones estándar 2025 (IRS actualizadas)
STANDARD_DEDUCTION_2025 = {
    FilingStatus.SINGLE: 15000,
    FilingStatus.MARRIED_JOINT: 30000,
    FilingStatus.MARRIED_SEPARATE: 15000,
    FilingStatus.HEAD_OF_HOUSEHOLD: 22500,
    FilingStatus.WIDOW: 30000
}

# Créditos 2025 (IRS actualizados)
CHILD_TAX_CREDIT_2025 = 2000  # Por hijo calificado
CHILD_TAX_CREDIT_REFUNDABLE = 1700  # Porción reembolsable (ACTC)
EIC_MAX_2025 = {  # Máximo EITC por número de hijos calificados
    0: 649,    # Sin hijos
    1: 4328,   # 1 hijo
    2: 7152,   # 2 hijos
    3: 8046    # 3 o más hijos
}


class TaxCalculator:
    """Calculadora de impuestos estimados"""
    
    def __init__(self, session: TaxWizardSession):
        self.session = session
        self.tax_year = session.tax_year
    
    def calculate_estimate(self) -> RefundEstimate:
        """Calcula el reembolso/pago estimado"""
        estimate = RefundEstimate()
        
        # 1. Calcular ingreso total
        estimate.total_income = self._calculate_total_income()
        
        # 2. Calcular ajustes (above-the-line deductions)
        estimate.total_adjustments = self._calculate_adjustments()
        
        # 3. AGI (Adjusted Gross Income)
        estimate.adjusted_gross_income = max(0, estimate.total_income - estimate.total_adjustments)
        
        # 4. Determinar deducción (estándar vs detallada)
        estimate.standard_deduction = self._get_standard_deduction()
        estimate.itemized_deduction = self._calculate_itemized_deductions()
        
        if estimate.itemized_deduction > estimate.standard_deduction:
            estimate.deduction_used = "itemized"
            deduction = estimate.itemized_deduction
        else:
            estimate.deduction_used = "standard"
            deduction = estimate.standard_deduction
        
        # 5. Ingreso gravable
        estimate.taxable_income = max(0, estimate.adjusted_gross_income - deduction)
        
        # 6. Calcular impuesto
        estimate.estimated_tax = self._calculate_tax(estimate.taxable_income)
        
        # 7. Calcular créditos
        estimate.total_credits = self._calculate_credits()
        
        # 8. Impuesto después de créditos
        tax_after_credits = max(0, estimate.estimated_tax - estimate.total_credits)
        
        # 9. Total retenido
        estimate.total_withheld = self._calculate_total_withheld()
        
        # 10. Reembolso o pago
        estimate.estimated_refund = estimate.total_withheld - tax_after_credits
        estimate.is_refund = estimate.estimated_refund >= 0
        estimate.estimated_refund = abs(estimate.estimated_refund)
        
        estimate.confidence_level = "estimate"
        
        return estimate
    
    def _calculate_total_income(self) -> float:
        """Suma todos los ingresos"""
        income = self.session.income
        total = 0
        
        # W-2 income
        for w2 in income.w2_sources:
            total += w2.amount
        
        # 1099 income
        for f1099 in income.form_1099_sources:
            total += f1099.amount
        
        # Self-employment (net)
        if income.has_self_employment:
            net_se = income.self_employment_income - income.self_employment_expenses
            total += max(0, net_se)
        
        # Unemployment
        if income.has_unemployment:
            total += income.unemployment_amount
        
        # Other income
        if income.has_other_income:
            total += income.other_income_amount
        
        return total
    
    def _calculate_adjustments(self) -> float:
        """Calcula ajustes al ingreso"""
        adjustments = 0
        deductions = self.session.deductions_credits
        
        # Student loan interest (max $2,500)
        if deductions.has_student_loan_interest:
            adjustments += min(deductions.student_loan_interest, 2500)
        
        # Traditional IRA contributions (simplified)
        if deductions.has_retirement_contributions:
            if deductions.retirement_account_type in ['ira', '401k']:
                # Simplified - actual limits depend on many factors
                adjustments += min(deductions.retirement_contributions, 7000)
        
        # Self-employment tax deduction (half of SE tax)
        if self.session.income.has_self_employment:
            net_se = self.session.income.self_employment_income - self.session.income.self_employment_expenses
            if net_se > 0:
                se_tax = net_se * 0.9235 * 0.153
                adjustments += se_tax / 2
        
        return adjustments
    
    def _get_standard_deduction(self) -> float:
        """Obtiene la deducción estándar según estado civil"""
        status = self.session.filing_status or FilingStatus.SINGLE
        return STANDARD_DEDUCTION_2025.get(status, 14600)
    
    def _calculate_itemized_deductions(self) -> float:
        """Calcula deducciones detalladas"""
        deductions = self.session.deductions_credits
        total = 0
        
        # SALT (State and Local Taxes) - capped at $10,000
        salt = deductions.property_taxes + deductions.state_local_taxes
        total += min(salt, 10000)
        
        # Mortgage interest
        total += deductions.mortgage_interest
        
        # Charitable donations
        total += deductions.charitable_donations
        
        # Medical expenses (only amount exceeding 7.5% of AGI)
        agi = self.session.income.total_income
        medical_threshold = agi * 0.075
        if deductions.medical_expenses > medical_threshold:
            total += deductions.medical_expenses - medical_threshold
        
        return total
    
    def _calculate_tax(self, taxable_income: float) -> float:
        """Calcula el impuesto federal usando brackets"""
        status = self.session.filing_status or FilingStatus.SINGLE
        brackets = TAX_BRACKETS_2025.get(status, TAX_BRACKETS_2025[FilingStatus.SINGLE])
        
        tax = 0
        prev_bracket = 0
        
        for bracket_limit, rate in brackets:
            if taxable_income <= prev_bracket:
                break
            
            taxable_in_bracket = min(taxable_income, bracket_limit) - prev_bracket
            tax += taxable_in_bracket * rate
            prev_bracket = bracket_limit
        
        return tax
    
    def _calculate_credits(self) -> float:
        """Calcula créditos tributarios"""
        credits = 0
        deductions = self.session.deductions_credits
        
        # Child Tax Credit
        if deductions.eligible_for_ctc:
            num_children = deductions.ctc_qualifying_children or len(self.session.dependents)
            ctc = num_children * CHILD_TAX_CREDIT_2025
            credits += ctc
        
        # Earned Income Credit (simplified calculation)
        if deductions.eligible_for_eic:
            num_children = min(len(self.session.dependents), 3)
            max_eic = EIC_MAX_2025.get(num_children, 0)
            # Simplified - actual EIC calculation is complex
            credits += max_eic * 0.5  # Estimate at 50% of max
        
        # Child and Dependent Care Credit
        if deductions.has_childcare_expenses:
            # Max expenses: $3,000 for 1 child, $6,000 for 2+
            num_deps = len(self.session.dependents)
            max_expenses = 3000 if num_deps == 1 else 6000
            eligible_expenses = min(deductions.childcare_expenses, max_expenses)
            # Credit rate varies by income, using 20% as estimate
            credits += eligible_expenses * 0.20
        
        # Education Credits (simplified)
        if deductions.has_education_expenses:
            # American Opportunity Credit max $2,500
            credits += min(deductions.education_expenses * 0.25, 2500)
        
        return credits
    
    def _calculate_total_withheld(self) -> float:
        """Suma total de impuestos retenidos"""
        total = 0
        income = self.session.income
        
        for w2 in income.w2_sources:
            total += w2.federal_withheld
        
        for f1099 in income.form_1099_sources:
            total += f1099.federal_withheld
        
        return total


def calculate_refund_estimate(session: TaxWizardSession) -> RefundEstimate:
    """Helper function para calcular estimación"""
    calculator = TaxCalculator(session)
    return calculator.calculate_estimate()
