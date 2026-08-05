"""
Immigration Case Intelligence Engine
Advanced features for Mi Caso USA to beat the competition:
- RFE Deadline Calculator (87 days)
- Processing Time Estimates
- Document Checklists by Form Type
- Progress Stage Tracking
- Family Case Grouping
- Smart Polling Priority
"""

from datetime import datetime, timedelta
from typing import Optional, List

# ═══════════════════════════════════════════════════════════════════
# PROGRESS STAGES - Real case flow stages per form type
# ═══════════════════════════════════════════════════════════════════

CASE_STAGES = {
    'I-130': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'fees', 'name': 'Pago Procesado', 'name_en': 'Fee Processed', 'icon': 'card'},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'rfe', 'name': 'RFE (si aplica)', 'name_en': 'RFE (if applicable)', 'icon': 'document-text', 'optional': True},
        {'id': 'approved', 'name': 'Aprobado', 'name_en': 'Approved', 'icon': 'checkmark-circle'},
        {'id': 'nvc', 'name': 'Enviado al NVC', 'name_en': 'Sent to NVC', 'icon': 'airplane'},
    ],
    'I-485': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'biometrics', 'name': 'Biometría', 'name_en': 'Biometrics', 'icon': 'finger-print'},
        {'id': 'ead_combo', 'name': 'EAD/AP Combo', 'name_en': 'EAD/AP Combo Card', 'icon': 'card', 'optional': True},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'interview', 'name': 'Entrevista', 'name_en': 'Interview', 'icon': 'people'},
        {'id': 'decision', 'name': 'Decisión', 'name_en': 'Decision', 'icon': 'checkmark-circle'},
        {'id': 'card_produced', 'name': 'Green Card', 'name_en': 'Card Produced', 'icon': 'card'},
    ],
    'I-765': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'biometrics', 'name': 'Biometría', 'name_en': 'Biometrics', 'icon': 'finger-print'},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'approved', 'name': 'Aprobado', 'name_en': 'Approved', 'icon': 'checkmark-circle'},
        {'id': 'card_produced', 'name': 'EAD Producido', 'name_en': 'Card Produced', 'icon': 'card'},
        {'id': 'card_mailed', 'name': 'EAD Enviado', 'name_en': 'Card Mailed', 'icon': 'send'},
    ],
    'N-400': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'biometrics', 'name': 'Biometría', 'name_en': 'Biometrics', 'icon': 'finger-print'},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'interview', 'name': 'Entrevista/Examen', 'name_en': 'Interview/Test', 'icon': 'school'},
        {'id': 'approved', 'name': 'Aprobado', 'name_en': 'Approved', 'icon': 'checkmark-circle'},
        {'id': 'oath', 'name': 'Ceremonia Juramento', 'name_en': 'Oath Ceremony', 'icon': 'flag'},
    ],
    'I-131': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'biometrics', 'name': 'Biometría', 'name_en': 'Biometrics', 'icon': 'finger-print'},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'approved', 'name': 'Aprobado', 'name_en': 'Approved', 'icon': 'checkmark-circle'},
        {'id': 'document_produced', 'name': 'Documento Producido', 'name_en': 'Document Produced', 'icon': 'document'},
    ],
    'I-140': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'rfe', 'name': 'RFE (si aplica)', 'name_en': 'RFE (if applicable)', 'icon': 'document-text', 'optional': True},
        {'id': 'approved', 'name': 'Aprobado', 'name_en': 'Approved', 'icon': 'checkmark-circle'},
    ],
    'I-751': [
        {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
        {'id': 'biometrics', 'name': 'Biometría', 'name_en': 'Biometrics', 'icon': 'finger-print'},
        {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
        {'id': 'interview', 'name': 'Entrevista (si aplica)', 'name_en': 'Interview (if applicable)', 'icon': 'people', 'optional': True},
        {'id': 'approved', 'name': 'Condiciones Removidas', 'name_en': 'Conditions Removed', 'icon': 'checkmark-circle'},
        {'id': 'card_produced', 'name': 'Green Card 10 años', 'name_en': '10-year Card Produced', 'icon': 'card'},
    ],
}

# Default stages for unknown forms
DEFAULT_STAGES = [
    {'id': 'received', 'name': 'Recibido', 'name_en': 'Received', 'icon': 'mail'},
    {'id': 'review', 'name': 'En Revisión', 'name_en': 'Under Review', 'icon': 'search'},
    {'id': 'decision', 'name': 'Decisión', 'name_en': 'Decision', 'icon': 'checkmark-circle'},
]


# ═══════════════════════════════════════════════════════════════════
# STATUS TO STAGE MAPPING
# ═══════════════════════════════════════════════════════════════════

STATUS_TO_STAGE = {
    'Case Was Received': 'received',
    'Fingerprint Fee Was Received': 'biometrics',
    'Case Was Updated To Show Fingerprints Were Taken': 'biometrics',
    'Case Is Being Actively Reviewed': 'review',
    'Request for Evidence Was Sent': 'rfe',
    'Request for Evidence Was Received': 'review',
    'Interview Was Scheduled': 'interview',
    'Interview Was Completed': 'interview',
    'Case Was Approved': 'approved',
    'New Card Is Being Produced': 'card_produced',
    'Card Is Being Produced': 'card_produced',
    'Card Was Produced': 'card_produced',
    'Card Was Mailed To Me': 'card_mailed',
    'Card Was Picked Up By The United States Postal Service': 'card_mailed',
    'Card Was Delivered To Me By The Post Office': 'card_mailed',
    'Decision Was Mailed': 'decision',
    'Case Was Transferred': 'review',
    'Case Was Denied': 'decision',
    'Case Closed': 'decision',
    'Fee Waiver Was Approved': 'fees',
    'Name Was Updated': 'review',
    'Appeal Was Filed': 'review',
}


# ═══════════════════════════════════════════════════════════════════
# PROCESSING TIME ESTIMATES (2026 data)
# ═══════════════════════════════════════════════════════════════════

PROCESSING_TIMES = {
    'I-130': {'min_months': 12, 'max_months': 24, 'avg_months': 16},
    'I-485': {'min_months': 8, 'max_months': 14, 'avg_months': 11},
    'I-765': {'min_months': 3, 'max_months': 7, 'avg_months': 5},
    'N-400': {'min_months': 6, 'max_months': 12, 'avg_months': 9},
    'I-131': {'min_months': 4, 'max_months': 8, 'avg_months': 6},
    'I-140': {'min_months': 6, 'max_months': 18, 'avg_months': 10},
    'I-751': {'min_months': 12, 'max_months': 24, 'avg_months': 18},
    'I-90': {'min_months': 8, 'max_months': 14, 'avg_months': 10},
    'I-129': {'min_months': 2, 'max_months': 6, 'avg_months': 4},
    'I-539': {'min_months': 6, 'max_months': 14, 'avg_months': 10},
    'I-526': {'min_months': 24, 'max_months': 52, 'avg_months': 36},
    'I-360': {'min_months': 12, 'max_months': 30, 'avg_months': 18},
}


# ═══════════════════════════════════════════════════════════════════
# DOCUMENT CHECKLISTS
# ═══════════════════════════════════════════════════════════════════

DOCUMENT_CHECKLISTS = {
    'I-130': {
        'name': 'Petición Familiar',
        'documents': [
            {'id': 'form', 'name': 'Formulario I-130 firmado', 'required': True},
            {'id': 'fee', 'name': 'Pago de tarifa ($535)', 'required': True},
            {'id': 'petitioner_id', 'name': 'Copia de ciudadanía/residencia del peticionario', 'required': True},
            {'id': 'relationship', 'name': 'Prueba de relación (acta matrimonio/nacimiento)', 'required': True},
            {'id': 'photos', 'name': 'Fotos tipo pasaporte (2 por persona)', 'required': True},
            {'id': 'passport', 'name': 'Copia del pasaporte del beneficiario', 'required': True},
            {'id': 'birth_cert', 'name': 'Acta de nacimiento del beneficiario', 'required': True},
            {'id': 'divorce', 'name': 'Certificado de divorcio (si aplica)', 'required': False},
            {'id': 'evidence_bonafide', 'name': 'Evidencia de matrimonio genuino (si cónyuge)', 'required': False},
        ],
        'rfe_common': [
            'Evidencia adicional de relación genuina',
            'Traducción certificada de documentos',
            'Actas de nacimiento apostilladas',
            'Prueba de domicilio compartido',
        ]
    },
    'I-485': {
        'name': 'Ajuste de Estatus',
        'documents': [
            {'id': 'form', 'name': 'Formulario I-485 firmado', 'required': True},
            {'id': 'fee', 'name': 'Pago de tarifa ($1,225)', 'required': True},
            {'id': 'photos', 'name': 'Fotos tipo pasaporte (2)', 'required': True},
            {'id': 'birth_cert', 'name': 'Acta de nacimiento con traducción', 'required': True},
            {'id': 'passport', 'name': 'Copia de pasaporte completo', 'required': True},
            {'id': 'i94', 'name': 'Registro I-94 (entrada a EE.UU.)', 'required': True},
            {'id': 'medical', 'name': 'Examen médico I-693 (sellado)', 'required': True},
            {'id': 'affidavit', 'name': 'Declaración jurada de sostenimiento I-864', 'required': True},
            {'id': 'tax_returns', 'name': 'Declaraciones de impuestos (3 años)', 'required': True},
            {'id': 'police_cert', 'name': 'Certificado de antecedentes penales', 'required': True},
            {'id': 'i765', 'name': 'Formulario I-765 (EAD) si desea permiso de trabajo', 'required': False},
            {'id': 'i131', 'name': 'Formulario I-131 (Advance Parole) si desea viajar', 'required': False},
        ],
        'rfe_common': [
            'Examen médico actualizado (I-693 vence en 2 años)',
            'Evidencia de sostenimiento financiero adicional',
            'Certificado de antecedentes del país de origen',
            'Traducciones certificadas faltantes',
        ]
    },
    'I-765': {
        'name': 'Permiso de Trabajo (EAD)',
        'documents': [
            {'id': 'form', 'name': 'Formulario I-765 firmado', 'required': True},
            {'id': 'fee', 'name': 'Pago o exención de tarifa', 'required': True},
            {'id': 'photos', 'name': 'Fotos tipo pasaporte (2)', 'required': True},
            {'id': 'id_copy', 'name': 'Copia de identificación', 'required': True},
            {'id': 'i94', 'name': 'Registro I-94', 'required': True},
            {'id': 'eligibility', 'name': 'Prueba de elegibilidad (recibo I-485, etc.)', 'required': True},
            {'id': 'prev_ead', 'name': 'Copia de EAD anterior (si renovación)', 'required': False},
        ],
        'rfe_common': [
            'Prueba de elegibilidad actualizada',
            'Fotos nuevas',
        ]
    },
    'N-400': {
        'name': 'Ciudadanía (Naturalización)',
        'documents': [
            {'id': 'form', 'name': 'Formulario N-400 firmado', 'required': True},
            {'id': 'fee', 'name': 'Pago de tarifa ($710)', 'required': True},
            {'id': 'photos', 'name': 'Fotos tipo pasaporte (2)', 'required': True},
            {'id': 'green_card', 'name': 'Copia de Green Card (ambos lados)', 'required': True},
            {'id': 'tax_returns', 'name': 'Declaraciones de impuestos (5 años)', 'required': True},
            {'id': 'travel_records', 'name': 'Registro de viajes fuera de EE.UU.', 'required': True},
            {'id': 'marriage_cert', 'name': 'Acta de matrimonio (si aplica)', 'required': False},
            {'id': 'selective_service', 'name': 'Registro de Servicio Selectivo (hombres 18-26)', 'required': False},
        ],
        'rfe_common': [
            'Certificados de disposición de arrestos',
            'Evidencia de presencia física continua',
            'Traducciones certificadas',
        ]
    },
    'I-131': {
        'name': 'Documento de Viaje (Advance Parole)',
        'documents': [
            {'id': 'form', 'name': 'Formulario I-131 firmado', 'required': True},
            {'id': 'photos', 'name': 'Fotos tipo pasaporte (2)', 'required': True},
            {'id': 'id_copy', 'name': 'Copia de identificación', 'required': True},
            {'id': 'travel_reason', 'name': 'Carta explicando razón de viaje', 'required': True},
            {'id': 'flight_itinerary', 'name': 'Itinerario de vuelo (si disponible)', 'required': False},
        ],
        'rfe_common': [
            'Evidencia de emergencia familiar',
            'Prueba de empleo o estudios',
        ]
    },
    'I-140': {
        'name': 'Petición de Trabajador Inmigrante',
        'documents': [
            {'id': 'form', 'name': 'Formulario I-140 firmado', 'required': True},
            {'id': 'fee', 'name': 'Pago de tarifa ($700)', 'required': True},
            {'id': 'labor_cert', 'name': 'Certificación Laboral PERM (si aplica)', 'required': False},
            {'id': 'employer_letter', 'name': 'Carta del empleador', 'required': True},
            {'id': 'education', 'name': 'Credenciales académicas evaluadas', 'required': True},
            {'id': 'experience', 'name': 'Cartas de experiencia laboral', 'required': True},
            {'id': 'financials', 'name': 'Evidencia financiera del empleador', 'required': True},
        ],
        'rfe_common': [
            'Evaluación de credenciales actualizada',
            'Evidencia de capacidad de pago del empleador',
            'Cartas de experiencia más detalladas',
        ]
    },
    'I-751': {
        'name': 'Remover Condiciones de Residencia',
        'documents': [
            {'id': 'form', 'name': 'Formulario I-751 firmado por ambos', 'required': True},
            {'id': 'fee', 'name': 'Pago de tarifa ($750)', 'required': True},
            {'id': 'green_card', 'name': 'Copia de Green Card condicional', 'required': True},
            {'id': 'photos', 'name': 'Fotos tipo pasaporte (2)', 'required': True},
            {'id': 'marriage_evidence', 'name': 'Evidencia de matrimonio genuino (cuentas bancarias, propiedades, hijos)', 'required': True},
            {'id': 'tax_returns', 'name': 'Declaraciones de impuestos conjuntas', 'required': True},
            {'id': 'lease_deed', 'name': 'Contrato de arrendamiento/propiedad juntos', 'required': True},
            {'id': 'photos_together', 'name': 'Fotos juntos durante el matrimonio', 'required': False},
        ],
        'rfe_common': [
            'Más evidencia de matrimonio genuino',
            'Declaraciones juradas de amigos/familiares',
            'Evidencia financiera conjunta adicional',
        ]
    },
}


# ═══════════════════════════════════════════════════════════════════
# RFE DEADLINE CALCULATOR
# ═══════════════════════════════════════════════════════════════════

RFE_RESPONSE_DAYS = 87  # USCIS gives 87 days from RFE date to respond

def calculate_rfe_deadline(rfe_date: datetime) -> dict:
    """Calculate RFE response deadline and urgency"""
    deadline = rfe_date + timedelta(days=RFE_RESPONSE_DAYS)
    now = datetime.utcnow()
    days_remaining = (deadline - now).days
    
    if days_remaining < 0:
        urgency = 'expired'
        urgency_es = '¡VENCIDO!'
        color = '#EF4444'
    elif days_remaining <= 7:
        urgency = 'critical'
        urgency_es = '¡URGENTE! Menos de 1 semana'
        color = '#EF4444'
    elif days_remaining <= 14:
        urgency = 'high'
        urgency_es = 'Alta prioridad'
        color = '#F97316'
    elif days_remaining <= 30:
        urgency = 'medium'
        urgency_es = 'Prioridad media'
        color = '#F59E0B'
    else:
        urgency = 'low'
        urgency_es = 'Tiempo suficiente'
        color = '#10B981'
    
    return {
        'rfe_date': rfe_date.isoformat(),
        'deadline': deadline.isoformat(),
        'deadline_formatted': deadline.strftime('%d de %B, %Y'),
        'days_remaining': max(days_remaining, 0),
        'total_days': RFE_RESPONSE_DAYS,
        'days_elapsed': RFE_RESPONSE_DAYS - max(days_remaining, 0),
        'percentage_used': min(100, max(0, ((RFE_RESPONSE_DAYS - days_remaining) / RFE_RESPONSE_DAYS) * 100)),
        'urgency': urgency,
        'urgency_es': urgency_es,
        'color': color,
        'is_expired': days_remaining < 0,
        'tips': [
            'Reúne todos los documentos solicitados en la notificación RFE',
            'Envía tu respuesta por correo certificado con tracking',
            'Incluye una carta de presentación listando cada documento',
            'Guarda copia de todo lo que envíes',
        ] if days_remaining >= 0 else [
            'Tu plazo de RFE ha vencido',
            'USCIS puede tomar una decisión con la evidencia actual',
            'Consulta con un abogado de inmigración inmediatamente',
        ],
    }


# ═══════════════════════════════════════════════════════════════════
# PROGRESS CALCULATOR
# ═══════════════════════════════════════════════════════════════════

def calculate_progress(form_type: str, current_status: str, submitted_date: Optional[str] = None) -> dict:
    """Calculate case progress percentage and current stage"""
    # Extract form number (e.g., "Form I-130" -> "I-130")
    form_num = form_type.replace('Form ', '').strip() if form_type else ''
    
    stages = CASE_STAGES.get(form_num, DEFAULT_STAGES)
    current_stage_id = STATUS_TO_STAGE.get(current_status, 'received')
    
    # Find current stage index
    current_idx = 0
    for i, stage in enumerate(stages):
        if stage['id'] == current_stage_id:
            current_idx = i
            break
    
    # Calculate percentage (completed stages / total non-optional stages)
    total_stages = len([s for s in stages if not s.get('optional')])
    completed = min(current_idx + 1, total_stages)
    percentage = min(100, int((completed / total_stages) * 100))
    
    # Estimate remaining time
    processing = PROCESSING_TIMES.get(form_num, {'min_months': 6, 'max_months': 18, 'avg_months': 12})
    
    # If we have a submitted date, calculate elapsed time
    elapsed_months = 0
    estimated_remaining = None
    if submitted_date:
        try:
            if isinstance(submitted_date, str):
                # Handle formats like "09-05-2023 14:28:46" or "2023-09-05"
                for fmt in ['%m-%d-%Y %H:%M:%S', '%Y-%m-%d', '%m-%d-%Y', '%Y-%m-%dT%H:%M:%S']:
                    try:
                        sub_date = datetime.strptime(submitted_date.split('.')[0], fmt)
                        break
                    except Exception:
                        continue
                else:
                    sub_date = None
            else:
                sub_date = submitted_date
            
            if sub_date:
                elapsed_months = max(0, (datetime.utcnow() - sub_date).days / 30)
                remaining = max(0, processing['avg_months'] - elapsed_months)
                estimated_remaining = {
                    'months_min': max(0, int(processing['min_months'] - elapsed_months)),
                    'months_max': max(1, int(processing['max_months'] - elapsed_months)),
                    'months_avg': max(0, int(remaining)),
                    'text_es': f'{max(1, int(remaining))}-{max(2, int(processing["max_months"] - elapsed_months))} meses restantes' if remaining > 0 else 'Decisión pronto',
                }
        except Exception:
            pass
    
    if not estimated_remaining:
        estimated_remaining = {
            'months_min': processing['min_months'],
            'months_max': processing['max_months'],
            'months_avg': processing['avg_months'],
            'text_es': f'{processing["min_months"]}-{processing["max_months"]} meses estimados',
        }
    
    # Mark stages as completed, current, or pending
    stages_with_status = []
    for i, stage in enumerate(stages):
        stage_copy = dict(stage)
        if i < current_idx:
            stage_copy['status'] = 'completed'
        elif i == current_idx:
            stage_copy['status'] = 'current'
        else:
            stage_copy['status'] = 'pending'
        stages_with_status.append(stage_copy)
    
    return {
        'percentage': percentage,
        'current_stage': current_stage_id,
        'current_stage_name': stages[current_idx]['name'] if current_idx < len(stages) else 'Desconocido',
        'stages': stages_with_status,
        'total_stages': len(stages),
        'completed_stages': current_idx + 1,
        'estimated_remaining': estimated_remaining,
        'processing_times': processing,
        'elapsed_months': round(elapsed_months, 1),
    }


# ═══════════════════════════════════════════════════════════════════
# GET FORM INFO (checklist + progress + times)
# ═══════════════════════════════════════════════════════════════════

def get_form_intelligence(form_type: str, current_status: str = '', submitted_date: str = '') -> dict:
    """Get complete intelligence for a form type"""
    form_num = form_type.replace('Form ', '').strip() if form_type else ''
    
    checklist = DOCUMENT_CHECKLISTS.get(form_num, {})
    progress = calculate_progress(form_type, current_status, submitted_date)
    processing = PROCESSING_TIMES.get(form_num, {'min_months': 6, 'max_months': 18, 'avg_months': 12})
    
    # Check if case is in RFE status
    rfe_info = None
    if 'Request for Evidence' in current_status or 'RFE' in current_status:
        # Approximate RFE date as "now" if we don't have the exact date
        rfe_info = calculate_rfe_deadline(datetime.utcnow() - timedelta(days=5))
    
    return {
        'form_type': form_num,
        'form_name': checklist.get('name', form_num),
        'progress': progress,
        'processing_time': {
            'min_months': processing['min_months'],
            'max_months': processing['max_months'],
            'avg_months': processing['avg_months'],
            'text_es': f'{processing["min_months"]}-{processing["max_months"]} meses',
        },
        'checklist': {
            'documents': checklist.get('documents', []),
            'rfe_common': checklist.get('rfe_common', []),
            'total_required': len([d for d in checklist.get('documents', []) if d.get('required')]),
            'total_optional': len([d for d in checklist.get('documents', []) if not d.get('required')]),
        },
        'rfe_deadline': rfe_info,
    }


# ═══════════════════════════════════════════════════════════════════
# SMART POLLING PRIORITY
# ═══════════════════════════════════════════════════════════════════

# Priority levels for polling frequency
POLL_PRIORITY = {
    'Case Is Being Actively Reviewed': 'high',      # Check every 2 hours
    'Interview Was Scheduled': 'high',               # Check every 2 hours
    'Request for Evidence Was Received': 'high',     # Check every 2 hours
    'Case Was Approved': 'medium',                   # Check every 6 hours (waiting for card)
    'Card Is Being Produced': 'medium',              # Check every 6 hours
    'New Card Is Being Produced': 'medium',          # Check every 6 hours
    'Case Was Received': 'low',                      # Check every 12 hours
    'Fingerprint Fee Was Received': 'low',           # Check every 12 hours
    'Case Was Updated To Show Fingerprints Were Taken': 'low', # Check every 12 hours
    'Card Was Mailed To Me': 'low',                  # Check every 24 hours
    'Card Was Delivered To Me By The Post Office': 'done',  # No need to check
    'Case Was Denied': 'done',                       # No need to check
    'Case Closed': 'done',                           # No need to check
}

def get_poll_interval(current_status: str) -> int:
    """Get polling interval in seconds based on case priority"""
    priority = POLL_PRIORITY.get(current_status, 'low')
    intervals = {
        'high': 2 * 60 * 60,      # 2 hours
        'medium': 6 * 60 * 60,    # 6 hours
        'low': 12 * 60 * 60,      # 12 hours
        'done': 7 * 24 * 60 * 60, # 7 days (just in case of error corrections)
    }
    return intervals.get(priority, 6 * 60 * 60)


def get_poll_priority_label(current_status: str) -> dict:
    """Get human-readable polling priority"""
    priority = POLL_PRIORITY.get(current_status, 'low')
    labels = {
        'high': {'label': 'Alta', 'label_en': 'High', 'interval': 'Cada 2 horas', 'color': '#EF4444'},
        'medium': {'label': 'Media', 'label_en': 'Medium', 'interval': 'Cada 6 horas', 'color': '#F59E0B'},
        'low': {'label': 'Baja', 'label_en': 'Low', 'interval': 'Cada 12 horas', 'color': '#10B981'},
        'done': {'label': 'Completado', 'label_en': 'Done', 'interval': 'Semanal', 'color': '#6B7280'},
    }
    return labels.get(priority, labels['low'])
