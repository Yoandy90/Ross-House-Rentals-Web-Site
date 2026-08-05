"""
Clasificador de Complejidad de Casos
Analiza las respuestas del wizard para clasificar el caso
"""
from typing import Tuple, List
from .models import (
    TaxWizardSession, CaseComplexity, ServiceLevel,
    ServiceRecommendation
)


class CaseClassifier:
    """Clasifica la complejidad del caso y recomienda servicio"""
    
    def __init__(self, session: TaxWizardSession):
        self.session = session
        self.complexity_score = 0
        self.complexity_factors: List[str] = []
    
    def classify(self) -> Tuple[CaseComplexity, List[str]]:
        """Clasifica el caso y retorna complejidad + factores"""
        self.complexity_score = 0
        self.complexity_factors = []
        
        # Evaluar cada área
        self._evaluate_income()
        self._evaluate_dependents()
        self._evaluate_deductions()
        self._evaluate_filing_status()
        self._evaluate_special_situations()
        
        # Determinar complejidad basada en score
        if self.complexity_score <= 2:
            complexity = CaseComplexity.SIMPLE
        elif self.complexity_score <= 5:
            complexity = CaseComplexity.MEDIUM
        else:
            complexity = CaseComplexity.COMPLEX
        
        return complexity, self.complexity_factors
    
    def _evaluate_income(self):
        """Evalúa complejidad por tipo de ingresos"""
        income = self.session.income
        
        # W-2 es simple
        if income.has_w2 and income.w2_count <= 2:
            pass  # No añade complejidad
        elif income.w2_count > 2:
            self.complexity_score += 1
            self.complexity_factors.append("Múltiples empleadores (W-2)")
        
        # 1099 añade complejidad
        if income.has_1099:
            self.complexity_score += 1
            self.complexity_factors.append("Ingresos 1099")
            
            if len(income.form_1099_types) > 2:
                self.complexity_score += 1
                self.complexity_factors.append("Múltiples tipos de 1099")
        
        # Self-employment es complejo
        if income.has_self_employment:
            self.complexity_score += 3
            self.complexity_factors.append("Trabajo por cuenta propia")
            
            if income.self_employment_income > 50000:
                self.complexity_score += 1
                self.complexity_factors.append("Ingresos altos por cuenta propia")
        
        # Otros ingresos
        if income.has_other_income:
            self.complexity_score += 1
            self.complexity_factors.append("Otros ingresos adicionales")
    
    def _evaluate_dependents(self):
        """Evalúa complejidad por dependientes"""
        num_dependents = len(self.session.dependents)
        
        if num_dependents == 0:
            pass  # Simple
        elif num_dependents <= 2:
            self.complexity_score += 0.5
        elif num_dependents <= 4:
            self.complexity_score += 1
            self.complexity_factors.append(f"{num_dependents} dependientes")
        else:
            self.complexity_score += 2
            self.complexity_factors.append(f"Muchos dependientes ({num_dependents})")
        
        # Verificar situaciones especiales de dependientes
        for dep in self.session.dependents:
            if dep.is_disabled:
                self.complexity_score += 1
                self.complexity_factors.append("Dependiente con discapacidad")
            if not dep.lived_with_you:
                self.complexity_score += 0.5
    
    def _evaluate_deductions(self):
        """Evalúa complejidad por deducciones"""
        deductions = self.session.deductions_credits
        
        # Itemizar es más complejo
        if deductions.wants_itemize:
            self.complexity_score += 1
            self.complexity_factors.append("Deducciones detalladas")
        
        # Gastos de negocio
        if self.session.income.has_self_employment:
            if self.session.income.self_employment_expenses > 10000:
                self.complexity_score += 1
                self.complexity_factors.append("Gastos de negocio significativos")
        
        # Créditos educativos
        if deductions.has_education_expenses:
            self.complexity_score += 0.5
            self.complexity_factors.append("Créditos educativos")
        
        # Childcare
        if deductions.has_childcare_expenses:
            self.complexity_score += 0.5
    
    def _evaluate_filing_status(self):
        """Evalúa complejidad por estado civil"""
        status = self.session.filing_status
        
        # Casado pero declarando separado es más complejo
        if status and 'separate' in status.value:
            self.complexity_score += 1
            self.complexity_factors.append("Casado declarando por separado")
        
        # Head of household requiere verificación
        if status and status.value == 'head_of_household':
            self.complexity_score += 0.5
    
    def _evaluate_special_situations(self):
        """Evalúa situaciones especiales"""
        review = self.session.review
        
        # Cambios de vida importantes
        if review.major_life_changes:
            self.complexity_score += 1
            self.complexity_factors.append("Cambios de vida importantes")
        
        # Documentos pendientes
        if review.has_pending_documents:
            self.complexity_score += 0.5
        
        # ITIN en lugar de SSN
        if self.session.personal_info.has_itin:
            self.complexity_score += 0.5
            self.complexity_factors.append("Usa ITIN")
        
        # Primera vez declarando
        if not review.filed_last_year:
            self.complexity_score += 0.5
            self.complexity_factors.append("Primera declaración o no declaró el año pasado")


def get_service_recommendation(session: TaxWizardSession) -> ServiceRecommendation:
    """Genera recomendación de servicio basada en el caso"""
    classifier = CaseClassifier(session)
    complexity, factors = classifier.classify()
    
    # Guardar complejidad en sesión
    session.case_complexity = complexity
    
    # Determinar servicio recomendado
    if complexity == CaseComplexity.SIMPLE:
        recommended = ServiceLevel.DIY
        reason = "Your case is straightforward - perfect for our guided DIY service."
        reason_es = "Tu caso es sencillo - perfecto para nuestro servicio guiado."
        price = 49.99
        price_range = "$49 - $79"
        time = "15-30 minutos"
        features = [
            "Proceso guiado paso a paso",
            "Cálculo automático",
            "Revisión de errores",
            "Soporte por chat"
        ]
        next_steps = [
            "Completar el cuestionario",
            "Subir documentos W-2",
            "Revisar y firmar",
            "Recibir confirmación"
        ]
        
    elif complexity == CaseComplexity.MEDIUM:
        recommended = ServiceLevel.ASSISTED
        reason = "Your case has some complexity - we recommend professional review."
        reason_es = "Tu caso tiene algunas complejidades - recomendamos revisión profesional."
        price = 129.99
        price_range = "$129 - $179"
        time = "1-2 días hábiles"
        features = [
            "Tú llenas la información",
            "Ross Tax revisa todo",
            "Maximizamos tus deducciones",
            "Garantía de precisión",
            "Soporte prioritario"
        ]
        next_steps = [
            "Completar el cuestionario",
            "Subir todos los documentos",
            "Ross Tax revisa tu caso",
            "Aprobación y firma",
            "Envío al IRS"
        ]
        
    else:  # COMPLEX
        recommended = ServiceLevel.FULL_SERVICE
        reason = "Your case requires expert attention - let Ross Tax handle everything."
        reason_es = "Tu caso requiere atención experta - deja que Ross Tax se encargue de todo."
        price = 199.99
        price_range = "$199 - $349"
        time = "Cita personalizada"
        features = [
            "Ross Tax hace todo por ti",
            "Consulta personalizada",
            "Optimización máxima",
            "Manejo de situaciones complejas",
            "Representación ante IRS si es necesario",
            "Soporte VIP todo el año"
        ]
        next_steps = [
            "Agendar cita con Ross Tax",
            "Traer documentos a la cita",
            "Ross Tax prepara tu declaración",
            "Revisión y firma",
            "Seguimiento completo"
        ]
    
    # Si el usuario pidió revisión profesional, subir nivel
    if session.review.wants_professional_review and recommended == ServiceLevel.DIY:
        recommended = ServiceLevel.ASSISTED
        reason_es = "Solicitaste revisión profesional - te recomendamos nuestro servicio asistido."
        price = 129.99
        price_range = "$129 - $179"
    
    return ServiceRecommendation(
        recommended_service=recommended,
        reason=reason,
        reason_es=reason_es,
        case_complexity=complexity,
        price=price,
        price_range=price_range,
        estimated_time=time,
        features=features,
        next_steps=next_steps
    )


def get_required_documents(session: TaxWizardSession) -> List[str]:
    """Determina qué documentos se necesitan basado en las respuestas"""
    docs = []
    
    # Siempre necesarios
    docs.append("Identificación con foto (ID/Licencia/Pasaporte)")
    docs.append("Tarjeta de Seguro Social o ITIN")
    
    # Basado en ingresos
    if session.income.has_w2:
        docs.append(f"Formulario(s) W-2 ({session.income.w2_count} esperados)")
    
    if session.income.has_1099:
        for form_type in session.income.form_1099_types:
            docs.append(f"Formulario 1099-{form_type.upper()}")
    
    if session.income.has_self_employment:
        docs.append("Registro de ingresos de negocio")
        docs.append("Registro de gastos de negocio")
        docs.append("Formulario 1099-NEC (si aplica)")
    
    if session.income.has_unemployment:
        docs.append("Formulario 1099-G (desempleo)")
    
    # Basado en dependientes
    for dep in session.dependents:
        docs.append(f"Tarjeta de Seguro Social de {dep.first_name}")
    
    # Basado en deducciones
    deductions = session.deductions_credits
    
    if deductions.has_childcare_expenses:
        docs.append("Información del proveedor de cuidado infantil (nombre, dirección, EIN)")
    
    if deductions.has_education_expenses:
        docs.append("Formulario 1098-T (gastos educativos)")
    
    if deductions.mortgage_interest > 0:
        docs.append("Formulario 1098 (intereses hipotecarios)")
    
    if deductions.has_student_loan_interest:
        docs.append("Formulario 1098-E (intereses de préstamos estudiantiles)")
    
    if deductions.had_health_insurance and deductions.health_insurance_type == 'marketplace':
        docs.append("Formulario 1095-A (seguro del Marketplace)")
    
    # Declaración anterior
    if session.review.filed_last_year:
        docs.append("Copia de declaración del año anterior (recomendado)")
    
    return docs
