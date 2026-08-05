"""
Advanced Dynamic Fields System for Ross Tax Preparation
Sistema avanzado de campos dinámicos con soporte para:
- Campos condicionales (dependsOn)
- Campos computados
- Validaciones avanzadas
- Templates predefinidos
- Multi-idioma
- Firmas digitales
- Archivos/imágenes con restricciones
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union, Literal
from datetime import datetime, timezone
from bson import ObjectId
from enum import Enum
import logging
import re
import json

logger = logging.getLogger(__name__)

# Router
dynamic_fields_router = APIRouter(prefix="/api/admin/dynamic-fields", tags=["Dynamic Fields"])

# ============== ENUMS ==============

class FieldType(str, Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    CURRENCY = "currency"
    EMAIL = "email"
    PHONE = "phone"
    SELECT = "select"
    MULTISELECT = "multiselect"
    CHECKBOX = "checkbox"
    CHECKBOX_GROUP = "checkbox_group"
    RADIO = "radio"
    DATE = "date"
    DATETIME = "datetime"
    TIME = "time"
    LOCATION = "location"
    COORDINATES = "coordinates"
    FILE = "file"
    IMAGE = "image"
    SIGNATURE = "signature"
    DURATION = "duration"
    USER = "user"
    ITEMS = "items"
    COMPUTED = "computed"
    JSON = "json"
    SSN = "ssn"
    EIN = "ein"
    ROUTING_NUMBER = "routing_number"
    ACCOUNT_NUMBER = "account_number"
    HEADER = "header"
    DIVIDER = "divider"
    INFO = "info"


class DependsOnOperator(str, Enum):
    EQUALS = "=="
    NOT_EQUALS = "!="
    IN = "in"
    NOT_IN = "not_in"
    GREATER = ">"
    LESS = "<"
    GREATER_EQUAL = ">="
    LESS_EQUAL = "<="
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    CONTAINS = "contains"


class FilingStatus(str, Enum):
    SINGLE = "single"
    MARRIED_JOINT = "married_joint"
    MARRIED_SEPARATE = "married_separate"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    WIDOW = "qualifying_widow"


# ============== MODELOS ==============

class FieldTranslations(BaseModel):
    """Traducciones para un campo"""
    es: Optional[str] = None
    en: Optional[str] = None


class FieldOption(BaseModel):
    """Opción para select/multiselect/radio"""
    value: str
    label: str
    translations: Optional[FieldTranslations] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    disabled: Optional[bool] = False


class FieldValidation(BaseModel):
    """Reglas de validación"""
    regex: Optional[str] = None
    pattern_message: Optional[str] = None
    min: Optional[float] = None
    max: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_items: Optional[int] = None
    max_items: Optional[int] = None
    custom_validator: Optional[str] = None  # Nombre de función de validación


class FieldDependsOn(BaseModel):
    """Condición de dependencia"""
    field_id: str
    operator: DependsOnOperator
    value: Any


class FieldMeta(BaseModel):
    """Metadata adicional del campo"""
    help_text: Optional[str] = None
    icon: Optional[str] = None
    placeholder: Optional[str] = None
    translations: Optional[Dict[str, FieldTranslations]] = None  # {label: {es, en}, helpText: {es, en}}
    max_size_mb: Optional[float] = None
    allowed_formats: Optional[List[str]] = None
    role_restrictions: Optional[List[str]] = None
    lat_field: Optional[str] = None
    lng_field: Optional[str] = None
    signature_type: Optional[str] = None  # draw, upload, typed
    currency_code: Optional[str] = "USD"
    date_format: Optional[str] = None
    mask: Optional[str] = None  # Input mask pattern
    autocomplete: Optional[str] = None
    width: Optional[str] = None  # full, half, third
    show_in_summary: Optional[bool] = True
    show_in_pdf: Optional[bool] = True
    default_value: Optional[Any] = None
    step: Optional[float] = None  # For number inputs
    permissions: Optional[Dict[str, List[str]]] = None  # {view: [], edit: [], delete: []}


class ComputedExpression(BaseModel):
    """Expresión para campos computados"""
    expression: str
    language: str = "formula"  # formula, javascript
    fallback: Any = None
    dependencies: Optional[List[str]] = None  # IDs de campos de los que depende


class DynamicField(BaseModel):
    """Campo dinámico completo"""
    id: str
    label: str
    type: FieldType
    required: bool = False
    read_only: bool = False
    visible: bool = True
    validation: Optional[FieldValidation] = None
    options: Optional[List[FieldOption]] = None
    depends_on: Optional[List[FieldDependsOn]] = None
    repeatable: bool = False
    min_items: Optional[int] = None
    max_items: Optional[int] = None
    fields: Optional[List['DynamicField']] = None  # Para type=items
    computed: Optional[ComputedExpression] = None
    meta: Optional[FieldMeta] = None
    order: int = 0
    group: Optional[str] = None


class FieldGroup(BaseModel):
    """Grupo de campos para UI"""
    id: str
    label: str
    icon: Optional[str] = None
    order: int = 0
    collapsible: bool = False
    default_collapsed: bool = False
    translations: Optional[FieldTranslations] = None


class UIHints(BaseModel):
    """Configuración de UI"""
    groups: List[FieldGroup] = []
    field_order: Optional[List[str]] = None
    columns: int = 1
    show_progress: bool = True
    show_summary: bool = True
    locales: List[str] = ["es", "en"]
    default_locale: str = "es"


class ServiceTemplate(BaseModel):
    """Plantilla de servicio predefinida"""
    id: str
    name: str
    description: str
    category: str
    icon: str = "document-text"
    color: str = "#10B981"
    fields: List[str]  # Lista de IDs de campos
    translations: Optional[Dict[str, Dict[str, str]]] = None
    

class ValidationRule(BaseModel):
    """Regla de validación reutilizable"""
    id: str
    name: str
    description: str
    type: str  # regex, range, comparison, custom
    config: Dict[str, Any]
    error_message: str
    translations: Optional[FieldTranslations] = None


class DynamicFieldSchema(BaseModel):
    """Schema completo de campos dinámicos"""
    schema_version: str = "1.0.0"
    fields: List[DynamicField]
    templates: List[ServiceTemplate] = []
    ui_hints: Optional[UIHints] = None
    validations: List[ValidationRule] = []
    computed_examples: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None


class DynamicFieldSchemaCreate(BaseModel):
    """Modelo para crear/actualizar schema"""
    fields: List[Dict[str, Any]]
    templates: Optional[List[Dict[str, Any]]] = []
    ui_hints: Optional[Dict[str, Any]] = None
    validations: Optional[List[Dict[str, Any]]] = []


# ============== CAMPOS PREDEFINIDOS PARA TAX ==============

def get_default_tax_fields() -> List[Dict[str, Any]]:
    """Retorna campos predefinidos para servicios de tax"""
    return [
        # ===== DATOS DEL CLIENTE =====
        {
            "id": "first-name",
            "label": "Nombre",
            "type": "text",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 1,
            "validation": {"min_length": 2, "max_length": 50},
            "meta": {
                "icon": "person-outline",
                "placeholder": "Juan",
                "autocomplete": "given-name",
                "width": "half",
                "translations": {
                    "label": {"es": "Nombre", "en": "First Name"},
                    "placeholder": {"es": "Juan", "en": "John"}
                }
            }
        },
        {
            "id": "last-name",
            "label": "Apellido",
            "type": "text",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 2,
            "validation": {"min_length": 2, "max_length": 50},
            "meta": {
                "icon": "person-outline",
                "placeholder": "Pérez",
                "autocomplete": "family-name",
                "width": "half",
                "translations": {
                    "label": {"es": "Apellido", "en": "Last Name"},
                    "placeholder": {"es": "Pérez", "en": "Smith"}
                }
            }
        },
        {
            "id": "email",
            "label": "Correo Electrónico",
            "type": "email",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 3,
            "validation": {
                "regex": r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
                "pattern_message": "Ingresa un correo válido"
            },
            "meta": {
                "icon": "mail-outline",
                "placeholder": "cliente@email.com",
                "autocomplete": "email",
                "width": "half",
                "translations": {
                    "label": {"es": "Correo Electrónico", "en": "Email"}
                }
            }
        },
        {
            "id": "phone",
            "label": "Teléfono",
            "type": "phone",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 4,
            "meta": {
                "icon": "call-outline",
                "placeholder": "(555) 123-4567",
                "mask": "(###) ###-####",
                "width": "half",
                "translations": {
                    "label": {"es": "Teléfono", "en": "Phone"}
                }
            }
        },
        {
            "id": "ssn",
            "label": "Número de Seguro Social (SSN)",
            "type": "ssn",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 5,
            "validation": {
                "regex": r"^\d{3}-?\d{2}-?\d{4}$",
                "pattern_message": "Formato: XXX-XX-XXXX"
            },
            "meta": {
                "icon": "card-outline",
                "placeholder": "XXX-XX-XXXX",
                "mask": "###-##-####",
                "width": "half",
                "help_text": "Tu SSN se mantiene encriptado y seguro",
                "translations": {
                    "label": {"es": "Número de Seguro Social", "en": "Social Security Number"}
                }
            }
        },
        {
            "id": "date-of-birth",
            "label": "Fecha de Nacimiento",
            "type": "date",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 6,
            "meta": {
                "icon": "calendar-outline",
                "width": "half",
                "translations": {
                    "label": {"es": "Fecha de Nacimiento", "en": "Date of Birth"}
                }
            }
        },
        {
            "id": "client-type",
            "label": "Tipo de Cliente",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "client-info",
            "order": 7,
            "options": [
                {"value": "individual", "label": "Individual", "translations": {"es": "Individual", "en": "Individual"}},
                {"value": "business", "label": "Negocio", "translations": {"es": "Negocio", "en": "Business"}},
                {"value": "self-employed", "label": "Autoempleado", "translations": {"es": "Autoempleado", "en": "Self-Employed"}}
            ],
            "meta": {
                "icon": "people-outline",
                "width": "half",
                "default_value": "individual"
            }
        },
        {
            "id": "filing-status",
            "label": "Estado Civil para Impuestos",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "tax-info",
            "order": 10,
            "options": [
                {"value": "single", "label": "Soltero(a)", "translations": {"es": "Soltero(a)", "en": "Single"}},
                {"value": "married_joint", "label": "Casado(a) - Declaración Conjunta", "translations": {"es": "Casado(a) - Declaración Conjunta", "en": "Married Filing Jointly"}},
                {"value": "married_separate", "label": "Casado(a) - Declaración Separada", "translations": {"es": "Casado(a) - Declaración Separada", "en": "Married Filing Separately"}},
                {"value": "head_of_household", "label": "Cabeza de Familia", "translations": {"es": "Cabeza de Familia", "en": "Head of Household"}},
                {"value": "qualifying_widow", "label": "Viudo(a) Calificado(a)", "translations": {"es": "Viudo(a) Calificado(a)", "en": "Qualifying Widow(er)"}}
            ],
            "meta": {
                "icon": "heart-outline",
                "help_text": "Tu estado civil al 31 de diciembre del año fiscal",
                "translations": {
                    "label": {"es": "Estado Civil para Impuestos", "en": "Filing Status"}
                }
            }
        },
        
        # ===== DIRECCIÓN =====
        {
            "id": "address-header",
            "label": "Dirección",
            "type": "header",
            "required": False,
            "read_only": True,
            "visible": True,
            "group": "address",
            "order": 20
        },
        {
            "id": "address-line1",
            "label": "Dirección",
            "type": "text",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "address",
            "order": 21,
            "meta": {
                "icon": "home-outline",
                "placeholder": "123 Main Street",
                "autocomplete": "address-line1"
            }
        },
        {
            "id": "address-line2",
            "label": "Apt, Suite, etc.",
            "type": "text",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "address",
            "order": 22,
            "meta": {
                "placeholder": "Apt 4B",
                "autocomplete": "address-line2",
                "width": "half"
            }
        },
        {
            "id": "city",
            "label": "Ciudad",
            "type": "text",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "address",
            "order": 23,
            "meta": {
                "placeholder": "El Paso",
                "autocomplete": "address-level2",
                "width": "half"
            }
        },
        {
            "id": "state",
            "label": "Estado",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "address",
            "order": 24,
            "options": [
                {"value": "TX", "label": "Texas"},
                {"value": "CA", "label": "California"},
                {"value": "FL", "label": "Florida"},
                {"value": "NY", "label": "New York"},
                {"value": "NM", "label": "New Mexico"},
                {"value": "AZ", "label": "Arizona"},
                # Add more states as needed
            ],
            "meta": {
                "width": "third",
                "autocomplete": "address-level1"
            }
        },
        {
            "id": "zip-code",
            "label": "Código Postal",
            "type": "text",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "address",
            "order": 25,
            "validation": {
                "regex": r"^\d{5}(-\d{4})?$",
                "pattern_message": "Código postal inválido"
            },
            "meta": {
                "placeholder": "79936",
                "mask": "#####",
                "width": "third",
                "autocomplete": "postal-code"
            }
        },
        
        # ===== INFORMACIÓN DEL SERVICIO =====
        {
            "id": "service-type",
            "label": "Tipo de Servicio",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "service-info",
            "order": 30,
            "options": [
                {"value": "individual_return", "label": "Declaración Individual (1040)", "icon": "person"},
                {"value": "business_return", "label": "Declaración de Negocio", "icon": "business"},
                {"value": "schedule_c", "label": "Schedule C (Autoempleado)", "icon": "briefcase"},
                {"value": "itin", "label": "Solicitud ITIN", "icon": "card"},
                {"value": "amended_return", "label": "Enmienda (1040-X)", "icon": "create"},
                {"value": "bookkeeping", "label": "Contabilidad", "icon": "calculator"},
                {"value": "payroll", "label": "Nómina", "icon": "people"}
            ],
            "meta": {
                "icon": "document-text-outline",
                "translations": {
                    "label": {"es": "Tipo de Servicio", "en": "Service Type"}
                }
            }
        },
        {
            "id": "tax-year",
            "label": "Año Fiscal",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "service-info",
            "order": 31,
            "options": [
                {"value": "2025", "label": "2025"},
                {"value": "2024", "label": "2024"},
                {"value": "2023", "label": "2023"},
                {"value": "2022", "label": "2022"},
                {"value": "2021", "label": "2021"}
            ],
            "meta": {
                "icon": "calendar-outline",
                "width": "half",
                "default_value": "2025"
            }
        },
        {
            "id": "prior-year-agi",
            "label": "AGI del Año Anterior",
            "type": "currency",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "service-info",
            "order": 32,
            "validation": {"min": 0},
            "meta": {
                "icon": "cash-outline",
                "width": "half",
                "help_text": "Necesario para e-file. Encuéntralo en tu declaración del año pasado línea 11",
                "currency_code": "USD"
            }
        },
        {
            "id": "irs-pin",
            "label": "PIN del IRS",
            "type": "text",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "service-info",
            "order": 33,
            "validation": {
                "regex": r"^\d{5}$",
                "pattern_message": "El PIN debe tener 5 dígitos"
            },
            "meta": {
                "icon": "key-outline",
                "width": "half",
                "mask": "#####",
                "help_text": "Si tienes un PIN de protección de identidad del IRS"
            }
        },
        
        # ===== DEPENDIENTES =====
        {
            "id": "dependents",
            "label": "Dependientes",
            "type": "items",
            "required": False,
            "read_only": False,
            "visible": True,
            "repeatable": True,
            "min_items": 0,
            "max_items": 10,
            "group": "dependents",
            "order": 40,
            "fields": [
                {
                    "id": "dependent-name",
                    "label": "Nombre Completo",
                    "type": "text",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "meta": {"width": "half"}
                },
                {
                    "id": "dependent-ssn",
                    "label": "SSN del Dependiente",
                    "type": "ssn",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "meta": {"width": "half", "mask": "###-##-####"}
                },
                {
                    "id": "dependent-relationship",
                    "label": "Relación",
                    "type": "select",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "options": [
                        {"value": "son", "label": "Hijo"},
                        {"value": "daughter", "label": "Hija"},
                        {"value": "stepchild", "label": "Hijastro(a)"},
                        {"value": "parent", "label": "Padre/Madre"},
                        {"value": "sibling", "label": "Hermano(a)"},
                        {"value": "other", "label": "Otro"}
                    ],
                    "meta": {"width": "half"}
                },
                {
                    "id": "dependent-dob",
                    "label": "Fecha de Nacimiento",
                    "type": "date",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "meta": {"width": "half"}
                },
                {
                    "id": "dependent-lived-with-you",
                    "label": "¿Vivió contigo todo el año?",
                    "type": "checkbox",
                    "required": False,
                    "read_only": False,
                    "visible": True,
                    "meta": {"default_value": True}
                }
            ],
            "meta": {
                "icon": "people-outline",
                "help_text": "Agrega dependientes que puedes reclamar en tu declaración",
                "translations": {
                    "label": {"es": "Dependientes", "en": "Dependents"}
                }
            }
        },
        
        # ===== INGRESOS =====
        {
            "id": "income-header",
            "label": "Información de Ingresos",
            "type": "header",
            "required": False,
            "read_only": True,
            "visible": True,
            "group": "income",
            "order": 50
        },
        {
            "id": "total-income",
            "label": "Ingresos Totales",
            "type": "currency",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "income",
            "order": 51,
            "validation": {"min": 0},
            "meta": {
                "icon": "trending-up-outline",
                "currency_code": "USD",
                "help_text": "Suma de todos tus W-2s y 1099s"
            }
        },
        {
            "id": "has-w2",
            "label": "¿Tienes W-2?",
            "type": "checkbox",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "income",
            "order": 52
        },
        {
            "id": "w2-count",
            "label": "¿Cuántos W-2?",
            "type": "number",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "income",
            "order": 53,
            "depends_on": [{"field_id": "has-w2", "operator": "==", "value": True}],
            "validation": {"min": 1, "max": 20},
            "meta": {"width": "half"}
        },
        {
            "id": "has-1099",
            "label": "¿Tienes 1099?",
            "type": "checkbox",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "income",
            "order": 54
        },
        {
            "id": "income-1099-types",
            "label": "Tipos de 1099",
            "type": "multiselect",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "income",
            "order": 55,
            "depends_on": [{"field_id": "has-1099", "operator": "==", "value": True}],
            "options": [
                {"value": "1099-NEC", "label": "1099-NEC (Contratista independiente)"},
                {"value": "1099-MISC", "label": "1099-MISC (Misceláneos)"},
                {"value": "1099-INT", "label": "1099-INT (Intereses)"},
                {"value": "1099-DIV", "label": "1099-DIV (Dividendos)"},
                {"value": "1099-G", "label": "1099-G (Desempleo)"},
                {"value": "1099-R", "label": "1099-R (Retiro)"},
                {"value": "1099-SSA", "label": "SSA-1099 (Seguro Social)"},
                {"value": "1099-K", "label": "1099-K (Pagos de terceros)"}
            ]
        },
        
        # ===== DEDUCCIONES =====
        {
            "id": "deductions",
            "label": "Deducciones",
            "type": "items",
            "required": False,
            "read_only": False,
            "visible": True,
            "repeatable": True,
            "group": "deductions",
            "order": 60,
            "fields": [
                {
                    "id": "deduction-type",
                    "label": "Tipo de Deducción",
                    "type": "select",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "options": [
                        {"value": "mortgage_interest", "label": "Intereses de Hipoteca"},
                        {"value": "property_tax", "label": "Impuesto de Propiedad"},
                        {"value": "medical", "label": "Gastos Médicos"},
                        {"value": "charitable", "label": "Donaciones Caritativas"},
                        {"value": "education", "label": "Gastos de Educación"},
                        {"value": "business_expense", "label": "Gastos de Negocio"},
                        {"value": "vehicle", "label": "Gastos de Vehículo"},
                        {"value": "home_office", "label": "Oficina en Casa"},
                        {"value": "other", "label": "Otro"}
                    ],
                    "meta": {"width": "half"}
                },
                {
                    "id": "deduction-amount",
                    "label": "Monto",
                    "type": "currency",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "validation": {"min": 0},
                    "meta": {"width": "half", "currency_code": "USD"}
                },
                {
                    "id": "deduction-description",
                    "label": "Descripción",
                    "type": "text",
                    "required": False,
                    "read_only": False,
                    "visible": True
                }
            ],
            "meta": {
                "icon": "remove-circle-outline",
                "help_text": "Agrega deducciones itemizadas si aplica"
            }
        },
        {
            "id": "total-deductions",
            "label": "Total Deducciones",
            "type": "computed",
            "required": False,
            "read_only": True,
            "visible": True,
            "group": "deductions",
            "order": 61,
            "computed": {
                "expression": "sum(deductions.deduction-amount)",
                "language": "formula",
                "fallback": 0,
                "dependencies": ["deductions"]
            },
            "meta": {
                "icon": "calculator-outline",
                "currency_code": "USD"
            }
        },
        
        # ===== DOCUMENTOS =====
        {
            "id": "documents",
            "label": "Documentos",
            "type": "items",
            "required": False,
            "read_only": False,
            "visible": True,
            "repeatable": True,
            "group": "documents",
            "order": 70,
            "fields": [
                {
                    "id": "doc-type",
                    "label": "Tipo de Documento",
                    "type": "select",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "options": [
                        {"value": "w2", "label": "W-2"},
                        {"value": "1099", "label": "1099"},
                        {"value": "id", "label": "Identificación"},
                        {"value": "ssn_card", "label": "Tarjeta de SSN"},
                        {"value": "prior_return", "label": "Declaración Anterior"},
                        {"value": "1095", "label": "1095 (Seguro Médico)"},
                        {"value": "other", "label": "Otro"}
                    ],
                    "meta": {"width": "half"}
                },
                {
                    "id": "doc-description",
                    "label": "Descripción",
                    "type": "text",
                    "required": False,
                    "read_only": False,
                    "visible": True,
                    "meta": {"width": "half"}
                },
                {
                    "id": "doc-file",
                    "label": "Archivo",
                    "type": "file",
                    "required": True,
                    "read_only": False,
                    "visible": True,
                    "meta": {
                        "max_size_mb": 10,
                        "allowed_formats": ["pdf", "jpg", "jpeg", "png", "heic"]
                    }
                }
            ],
            "meta": {
                "icon": "document-attach-outline",
                "help_text": "Sube todos los documentos necesarios"
            }
        },
        {
            "id": "documents-checklist",
            "label": "Lista de Verificación de Documentos",
            "type": "checkbox_group",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "documents",
            "order": 71,
            "options": [
                {"value": "id_front", "label": "ID (Frente)"},
                {"value": "id_back", "label": "ID (Reverso)"},
                {"value": "ssn_card", "label": "Tarjeta SSN"},
                {"value": "all_w2", "label": "Todos los W-2"},
                {"value": "all_1099", "label": "Todos los 1099"},
                {"value": "prior_return", "label": "Declaración del Año Anterior"},
                {"value": "bank_info", "label": "Información Bancaria para Depósito Directo"}
            ],
            "meta": {
                "help_text": "Marca los documentos que ya tienes listos"
            }
        },
        
        # ===== REEMBOLSO =====
        {
            "id": "refund-method",
            "label": "Método de Reembolso",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "refund",
            "order": 80,
            "options": [
                {"value": "direct_deposit", "label": "Depósito Directo", "icon": "card"},
                {"value": "check", "label": "Cheque por Correo", "icon": "mail"},
                {"value": "apply_next_year", "label": "Aplicar al Próximo Año", "icon": "refresh"}
            ],
            "meta": {
                "icon": "cash-outline",
                "translations": {
                    "label": {"es": "Método de Reembolso", "en": "Refund Method"}
                }
            }
        },
        {
            "id": "bank-routing",
            "label": "Número de Ruta (Routing)",
            "type": "routing_number",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "refund",
            "order": 81,
            "depends_on": [{"field_id": "refund-method", "operator": "==", "value": "direct_deposit"}],
            "validation": {
                "regex": r"^\d{9}$",
                "pattern_message": "El número de ruta debe tener 9 dígitos"
            },
            "meta": {
                "icon": "business-outline",
                "mask": "#########",
                "width": "half"
            }
        },
        {
            "id": "bank-account",
            "label": "Número de Cuenta",
            "type": "account_number",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "refund",
            "order": 82,
            "depends_on": [{"field_id": "refund-method", "operator": "==", "value": "direct_deposit"}],
            "validation": {"min_length": 4, "max_length": 17},
            "meta": {
                "icon": "card-outline",
                "width": "half"
            }
        },
        {
            "id": "account-type",
            "label": "Tipo de Cuenta",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "refund",
            "order": 83,
            "depends_on": [{"field_id": "refund-method", "operator": "==", "value": "direct_deposit"}],
            "options": [
                {"value": "checking", "label": "Cuenta de Cheques"},
                {"value": "savings", "label": "Cuenta de Ahorros"}
            ],
            "meta": {"width": "half"}
        },
        
        # ===== PAGO DEL SERVICIO =====
        {
            "id": "service-price",
            "label": "Precio del Servicio",
            "type": "currency",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "payment",
            "order": 90,
            "validation": {"min": 0},
            "meta": {
                "icon": "pricetag-outline",
                "currency_code": "USD",
                "translations": {
                    "label": {"es": "Precio del Servicio", "en": "Service Price"}
                }
            }
        },
        {
            "id": "payment-method",
            "label": "Método de Pago",
            "type": "select",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "payment",
            "order": 91,
            "options": [
                {"value": "card", "label": "Tarjeta de Crédito/Débito", "icon": "card"},
                {"value": "cash", "label": "Efectivo", "icon": "cash"},
                {"value": "check", "label": "Cheque", "icon": "document"},
                {"value": "refund_deduction", "label": "Descuento del Reembolso", "icon": "remove-circle"}
            ],
            "meta": {
                "icon": "wallet-outline",
                "width": "half"
            }
        },
        {
            "id": "invoice-required",
            "label": "¿Necesita Factura?",
            "type": "checkbox",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "payment",
            "order": 92,
            "meta": {"width": "half"}
        },
        {
            "id": "business-name",
            "label": "Nombre del Negocio",
            "type": "text",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "payment",
            "order": 93,
            "depends_on": [{"field_id": "invoice-required", "operator": "==", "value": True}],
            "meta": {"width": "half"}
        },
        {
            "id": "business-tax-id",
            "label": "EIN del Negocio",
            "type": "ein",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "payment",
            "order": 94,
            "depends_on": [{"field_id": "invoice-required", "operator": "==", "value": True}],
            "validation": {
                "regex": r"^\d{2}-?\d{7}$",
                "pattern_message": "Formato: XX-XXXXXXX"
            },
            "meta": {
                "mask": "##-#######",
                "width": "half"
            }
        },
        
        # ===== CITA =====
        {
            "id": "appointment-date",
            "label": "Fecha de Cita",
            "type": "date",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "appointment",
            "order": 100,
            "meta": {
                "icon": "calendar-outline",
                "width": "half"
            }
        },
        {
            "id": "appointment-time",
            "label": "Hora de Cita",
            "type": "time",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "appointment",
            "order": 101,
            "meta": {
                "icon": "time-outline",
                "width": "half"
            }
        },
        {
            "id": "office-location",
            "label": "Ubicación de Oficina",
            "type": "select",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "appointment",
            "order": 102,
            "options": [
                {"value": "main", "label": "Oficina Principal - El Paso"},
                {"value": "remote", "label": "Servicio Remoto"}
            ],
            "meta": {"icon": "location-outline"}
        },
        
        # ===== ASIGNACIÓN =====
        {
            "id": "assigned-preparer",
            "label": "Preparador Asignado",
            "type": "user",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "admin",
            "order": 110,
            "meta": {
                "icon": "person-circle-outline",
                "role_restrictions": ["admin", "preparer", "assistant"],
                "permissions": {
                    "view": ["admin", "preparer", "assistant"],
                    "edit": ["admin"]
                }
            }
        },
        {
            "id": "internal-notes",
            "label": "Notas Internas",
            "type": "textarea",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "admin",
            "order": 111,
            "meta": {
                "icon": "create-outline",
                "help_text": "Solo visible para el equipo",
                "permissions": {
                    "view": ["admin", "preparer", "assistant"],
                    "edit": ["admin", "preparer", "assistant"]
                }
            }
        },
        {
            "id": "client-notes",
            "label": "Notas del Cliente",
            "type": "textarea",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "notes",
            "order": 112,
            "meta": {
                "icon": "chatbubble-outline",
                "placeholder": "¿Hay algo más que debamos saber?"
            }
        },
        
        # ===== FIRMAS =====
        {
            "id": "consent-checkbox",
            "label": "Acepto los términos y autorizo a Ross Tax Preparation a preparar mi declaración de impuestos",
            "type": "checkbox",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "signatures",
            "order": 120,
            "meta": {
                "translations": {
                    "label": {
                        "es": "Acepto los términos y autorizo a Ross Tax Preparation a preparar mi declaración de impuestos",
                        "en": "I accept the terms and authorize Ross Tax Preparation to prepare my tax return"
                    }
                }
            }
        },
        {
            "id": "client-signature",
            "label": "Firma del Cliente",
            "type": "signature",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "signatures",
            "order": 121,
            "meta": {
                "icon": "pencil-outline",
                "signature_type": "draw",
                "max_size_mb": 2,
                "allowed_formats": ["png", "svg"],
                "help_text": "Firma con tu dedo o stylus",
                "translations": {
                    "label": {"es": "Firma del Cliente", "en": "Client Signature"}
                }
            }
        },
        {
            "id": "preparer-signature",
            "label": "Firma del Preparador",
            "type": "signature",
            "required": False,
            "read_only": False,
            "visible": True,
            "group": "signatures",
            "order": 122,
            "meta": {
                "icon": "pencil-outline",
                "signature_type": "draw",
                "max_size_mb": 2,
                "allowed_formats": ["png", "svg"],
                "role_restrictions": ["admin", "preparer"],
                "permissions": {
                    "view": ["admin", "preparer", "assistant"],
                    "edit": ["admin", "preparer"]
                }
            }
        },
        {
            "id": "id-proof-photo",
            "label": "Foto de Identificación",
            "type": "image",
            "required": True,
            "read_only": False,
            "visible": True,
            "group": "documents",
            "order": 72,
            "meta": {
                "icon": "camera-outline",
                "max_size_mb": 5,
                "allowed_formats": ["jpg", "jpeg", "png", "heic"],
                "help_text": "Foto clara de tu ID vigente"
            }
        },
        
        # ===== CAMPOS COMPUTADOS =====
        {
            "id": "estimated-refund",
            "label": "Reembolso Estimado",
            "type": "computed",
            "required": False,
            "read_only": True,
            "visible": True,
            "group": "summary",
            "order": 130,
            "computed": {
                "expression": "total-income * 0.15 + total-deductions * 0.22",
                "language": "formula",
                "fallback": 0,
                "dependencies": ["total-income", "total-deductions"]
            },
            "meta": {
                "icon": "trending-up",
                "currency_code": "USD",
                "help_text": "Estimación basada en los datos ingresados"
            }
        },
        {
            "id": "balance-due",
            "label": "Saldo Pendiente",
            "type": "computed",
            "required": False,
            "read_only": True,
            "visible": True,
            "group": "payment",
            "order": 95,
            "computed": {
                "expression": "service-price - payments-total",
                "language": "formula",
                "fallback": 0,
                "dependencies": ["service-price", "payments-total"]
            },
            "meta": {
                "icon": "wallet",
                "currency_code": "USD"
            }
        }
    ]


def get_default_templates() -> List[Dict[str, Any]]:
    """Retorna templates predefinidos"""
    return [
        {
            "id": "declaracion-individual",
            "name": "Declaración Individual (1040)",
            "description": "Declaración de impuestos para individuos",
            "category": "tax",
            "icon": "person",
            "color": "#10B981",
            "fields": [
                "first-name", "last-name", "email", "phone", "ssn", "date-of-birth",
                "filing-status", "address-line1", "address-line2", "city", "state", "zip-code",
                "has-w2", "w2-count", "has-1099", "income-1099-types", "total-income",
                "dependents", "deductions", "total-deductions",
                "refund-method", "bank-routing", "bank-account", "account-type",
                "documents", "documents-checklist",
                "service-price", "payment-method",
                "consent-checkbox", "client-signature", "client-notes"
            ],
            "translations": {
                "name": {"es": "Declaración Individual (1040)", "en": "Individual Tax Return (1040)"},
                "description": {"es": "Declaración de impuestos para individuos", "en": "Tax return for individuals"}
            }
        },
        {
            "id": "schedule-c-business",
            "name": "Schedule C (Autoempleado)",
            "description": "Para contratistas independientes y autoempleados",
            "category": "tax",
            "icon": "briefcase",
            "color": "#3B82F6",
            "fields": [
                "first-name", "last-name", "email", "phone", "ssn", "date-of-birth",
                "client-type", "filing-status",
                "address-line1", "address-line2", "city", "state", "zip-code",
                "business-name", "business-tax-id",
                "total-income", "deductions", "total-deductions",
                "refund-method", "bank-routing", "bank-account", "account-type",
                "documents", "documents-checklist",
                "service-price", "payment-method",
                "consent-checkbox", "client-signature", "client-notes"
            ],
            "translations": {
                "name": {"es": "Schedule C (Autoempleado)", "en": "Schedule C (Self-Employed)"},
                "description": {"es": "Para contratistas independientes y autoempleados", "en": "For independent contractors and self-employed"}
            }
        },
        {
            "id": "itin",
            "name": "Solicitud ITIN",
            "description": "Número de Identificación Personal del Contribuyente",
            "category": "itin",
            "icon": "card",
            "color": "#8B5CF6",
            "fields": [
                "first-name", "last-name", "email", "phone", "date-of-birth",
                "address-line1", "address-line2", "city", "state", "zip-code",
                "id-proof-photo", "documents",
                "service-price", "payment-method",
                "consent-checkbox", "client-signature", "client-notes"
            ],
            "translations": {
                "name": {"es": "Solicitud ITIN", "en": "ITIN Application"},
                "description": {"es": "Número de Identificación Personal del Contribuyente", "en": "Individual Taxpayer Identification Number"}
            }
        },
        {
            "id": "amended-return",
            "name": "Enmienda (1040-X)",
            "description": "Corrección de declaración presentada anteriormente",
            "category": "tax",
            "icon": "create",
            "color": "#F59E0B",
            "fields": [
                "first-name", "last-name", "email", "phone", "ssn",
                "filing-status", "tax-year", "prior-year-agi",
                "address-line1", "city", "state", "zip-code",
                "documents", "client-notes",
                "service-price", "payment-method",
                "consent-checkbox", "client-signature"
            ],
            "translations": {
                "name": {"es": "Enmienda (1040-X)", "en": "Amended Return (1040-X)"},
                "description": {"es": "Corrección de declaración presentada anteriormente", "en": "Correction of previously filed return"}
            }
        }
    ]


def get_default_ui_hints() -> Dict[str, Any]:
    """Retorna configuración de UI por defecto"""
    return {
        "groups": [
            {
                "id": "client-info",
                "label": "Datos del Cliente",
                "icon": "person-outline",
                "order": 1,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Datos del Cliente", "en": "Client Information"}
            },
            {
                "id": "address",
                "label": "Dirección",
                "icon": "home-outline",
                "order": 2,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Dirección", "en": "Address"}
            },
            {
                "id": "tax-info",
                "label": "Información Fiscal",
                "icon": "document-text-outline",
                "order": 3,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Información Fiscal", "en": "Tax Information"}
            },
            {
                "id": "service-info",
                "label": "Detalles del Servicio",
                "icon": "briefcase-outline",
                "order": 4,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Detalles del Servicio", "en": "Service Details"}
            },
            {
                "id": "dependents",
                "label": "Dependientes",
                "icon": "people-outline",
                "order": 5,
                "collapsible": True,
                "default_collapsed": True,
                "translations": {"es": "Dependientes", "en": "Dependents"}
            },
            {
                "id": "income",
                "label": "Ingresos",
                "icon": "trending-up-outline",
                "order": 6,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Ingresos", "en": "Income"}
            },
            {
                "id": "deductions",
                "label": "Deducciones",
                "icon": "remove-circle-outline",
                "order": 7,
                "collapsible": True,
                "default_collapsed": True,
                "translations": {"es": "Deducciones", "en": "Deductions"}
            },
            {
                "id": "documents",
                "label": "Documentos",
                "icon": "document-attach-outline",
                "order": 8,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Documentos", "en": "Documents"}
            },
            {
                "id": "refund",
                "label": "Reembolso",
                "icon": "cash-outline",
                "order": 9,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Reembolso", "en": "Refund"}
            },
            {
                "id": "payment",
                "label": "Pago del Servicio",
                "icon": "wallet-outline",
                "order": 10,
                "collapsible": True,
                "default_collapsed": False,
                "translations": {"es": "Pago del Servicio", "en": "Service Payment"}
            },
            {
                "id": "appointment",
                "label": "Cita",
                "icon": "calendar-outline",
                "order": 11,
                "collapsible": True,
                "default_collapsed": True,
                "translations": {"es": "Cita", "en": "Appointment"}
            },
            {
                "id": "admin",
                "label": "Administración",
                "icon": "settings-outline",
                "order": 12,
                "collapsible": True,
                "default_collapsed": True,
                "translations": {"es": "Administración", "en": "Administration"}
            },
            {
                "id": "notes",
                "label": "Notas",
                "icon": "chatbubble-outline",
                "order": 13,
                "collapsible": True,
                "default_collapsed": True,
                "translations": {"es": "Notas", "en": "Notes"}
            },
            {
                "id": "signatures",
                "label": "Firmas y Consentimiento",
                "icon": "pencil-outline",
                "order": 14,
                "collapsible": False,
                "default_collapsed": False,
                "translations": {"es": "Firmas y Consentimiento", "en": "Signatures & Consent"}
            },
            {
                "id": "summary",
                "label": "Resumen",
                "icon": "analytics-outline",
                "order": 15,
                "collapsible": False,
                "default_collapsed": False,
                "translations": {"es": "Resumen", "en": "Summary"}
            }
        ],
        "columns": 1,
        "show_progress": True,
        "show_summary": True,
        "locales": ["es", "en"],
        "default_locale": "es"
    }


def get_default_validations() -> List[Dict[str, Any]]:
    """Retorna reglas de validación predefinidas"""
    return [
        {
            "id": "ssn-format",
            "name": "Formato SSN",
            "description": "Valida formato de Número de Seguro Social",
            "type": "regex",
            "config": {
                "pattern": r"^\d{3}-?\d{2}-?\d{4}$",
                "flags": ""
            },
            "error_message": "El SSN debe tener formato XXX-XX-XXXX",
            "translations": {
                "es": "El SSN debe tener formato XXX-XX-XXXX",
                "en": "SSN must be in format XXX-XX-XXXX"
            }
        },
        {
            "id": "ein-format",
            "name": "Formato EIN",
            "description": "Valida formato de Employer Identification Number",
            "type": "regex",
            "config": {
                "pattern": r"^\d{2}-?\d{7}$",
                "flags": ""
            },
            "error_message": "El EIN debe tener formato XX-XXXXXXX",
            "translations": {
                "es": "El EIN debe tener formato XX-XXXXXXX",
                "en": "EIN must be in format XX-XXXXXXX"
            }
        },
        {
            "id": "max-file-size",
            "name": "Tamaño Máximo de Archivo",
            "description": "Valida que los archivos no excedan el límite",
            "type": "custom",
            "config": {
                "validator": "validate_file_size",
                "max_mb": 10
            },
            "error_message": "El archivo excede el tamaño máximo permitido",
            "translations": {
                "es": "El archivo excede el tamaño máximo permitido",
                "en": "File exceeds maximum allowed size"
            }
        },
        {
            "id": "deductions-limit",
            "name": "Límite de Deducciones",
            "description": "Valida que las deducciones no excedan los ingresos",
            "type": "comparison",
            "config": {
                "expression": "total-deductions <= total-income",
                "fields": ["total-deductions", "total-income"]
            },
            "error_message": "Las deducciones no pueden exceder los ingresos totales",
            "translations": {
                "es": "Las deducciones no pueden exceder los ingresos totales",
                "en": "Deductions cannot exceed total income"
            }
        }
    ]


# ============== ENDPOINTS ==============

@dynamic_fields_router.get("/schema")
async def get_dynamic_fields_schema(
    db=Depends(lambda: __import__('server').db)
):
    """Obtiene el schema completo de campos dinámicos"""
    try:
        schema = await db.dynamic_fields_schema.find_one({"_id": "current"})
        
        if not schema:
            # Crear schema por defecto
            default_schema = {
                "_id": "current",
                "schema_version": "1.0.0",
                "fields": get_default_tax_fields(),
                "templates": get_default_templates(),
                "ui_hints": get_default_ui_hints(),
                "validations": get_default_validations(),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            await db.dynamic_fields_schema.insert_one(default_schema)
            schema = default_schema
        
        schema["id"] = str(schema.pop("_id", "current"))
        return schema
        
    except Exception as e:
        logger.error(f"Error getting dynamic fields schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.put("/schema")
async def update_dynamic_fields_schema(
    schema_data: DynamicFieldSchemaCreate,
    authorization: str = Header(None),
    db=Depends(lambda: __import__('server').db)
):
    """Actualiza el schema de campos dinámicos"""
    try:
        # Validar admin
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        token = authorization.replace("Bearer ", "")
        from server import get_current_user
        user = await get_current_user(token)
        
        if user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        update_data = {
            "fields": schema_data.fields,
            "templates": schema_data.templates or [],
            "ui_hints": schema_data.ui_hints or get_default_ui_hints(),
            "validations": schema_data.validations or [],
            "updated_at": datetime.now(timezone.utc),
            "updated_by": user.get("id")
        }
        
        result = await db.dynamic_fields_schema.update_one(
            {"_id": "current"},
            {"$set": update_data},
            upsert=True
        )
        
        return {"success": True, "message": "Schema updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating dynamic fields schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.get("/templates")
async def get_service_templates(
    db=Depends(lambda: __import__('server').db)
):
    """Obtiene las plantillas de servicios disponibles"""
    try:
        schema = await db.dynamic_fields_schema.find_one({"_id": "current"})
        
        if not schema:
            return {"templates": get_default_templates()}
        
        return {"templates": schema.get("templates", [])}
        
    except Exception as e:
        logger.error(f"Error getting templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.get("/templates/{template_id}")
async def get_service_template(
    template_id: str,
    db=Depends(lambda: __import__('server').db)
):
    """Obtiene una plantilla específica con sus campos expandidos"""
    try:
        schema = await db.dynamic_fields_schema.find_one({"_id": "current"})
        
        if not schema:
            schema = {
                "fields": get_default_tax_fields(),
                "templates": get_default_templates()
            }
        
        # Buscar template
        template = None
        for t in schema.get("templates", []):
            if t.get("id") == template_id:
                template = t
                break
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Expandir campos
        all_fields = {f["id"]: f for f in schema.get("fields", [])}
        expanded_fields = []
        
        for field_id in template.get("fields", []):
            if field_id in all_fields:
                expanded_fields.append(all_fields[field_id])
        
        return {
            "template": template,
            "fields": expanded_fields,
            "ui_hints": schema.get("ui_hints", {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.post("/templates")
async def create_service_template(
    template_data: Dict[str, Any],
    authorization: str = Header(None),
    db=Depends(lambda: __import__('server').db)
):
    """Crea una nueva plantilla de servicio"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        token = authorization.replace("Bearer ", "")
        from server import get_current_user
        user = await get_current_user(token)
        
        if user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Agregar template al schema
        result = await db.dynamic_fields_schema.update_one(
            {"_id": "current"},
            {
                "$push": {"templates": template_data},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            upsert=True
        )
        
        return {"success": True, "template": template_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.post("/fields")
async def add_custom_field(
    field_data: Dict[str, Any],
    authorization: str = Header(None),
    db=Depends(lambda: __import__('server').db)
):
    """Agrega un nuevo campo personalizado al schema"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        token = authorization.replace("Bearer ", "")
        from server import get_current_user
        user = await get_current_user(token)
        
        if user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Verificar que el ID no exista
        schema = await db.dynamic_fields_schema.find_one({"_id": "current"})
        if schema:
            existing_ids = [f.get("id") for f in schema.get("fields", [])]
            if field_data.get("id") in existing_ids:
                raise HTTPException(status_code=400, detail="Field ID already exists")
        
        # Agregar campo
        result = await db.dynamic_fields_schema.update_one(
            {"_id": "current"},
            {
                "$push": {"fields": field_data},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            upsert=True
        )
        
        return {"success": True, "field": field_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding field: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.put("/fields/{field_id}")
async def update_custom_field(
    field_id: str,
    field_data: Dict[str, Any],
    authorization: str = Header(None),
    db=Depends(lambda: __import__('server').db)
):
    """Actualiza un campo existente"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        token = authorization.replace("Bearer ", "")
        from server import get_current_user
        user = await get_current_user(token)
        
        if user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Actualizar campo específico
        result = await db.dynamic_fields_schema.update_one(
            {"_id": "current", "fields.id": field_id},
            {
                "$set": {
                    "fields.$": field_data,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Field not found")
        
        return {"success": True, "field": field_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating field: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.delete("/fields/{field_id}")
async def delete_custom_field(
    field_id: str,
    authorization: str = Header(None),
    db=Depends(lambda: __import__('server').db)
):
    """Elimina un campo del schema"""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header")
        
        token = authorization.replace("Bearer ", "")
        from server import get_current_user
        user = await get_current_user(token)
        
        if user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        result = await db.dynamic_fields_schema.update_one(
            {"_id": "current"},
            {
                "$pull": {"fields": {"id": field_id}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {"success": True, "message": "Field deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting field: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@dynamic_fields_router.post("/validate")
async def validate_form_data(
    data: Dict[str, Any],
    db=Depends(lambda: __import__('server').db)
):
    """Valida datos de formulario contra el schema"""
    try:
        template_id = data.get("template_id")
        form_data = data.get("form_data", {})
        
        schema = await db.dynamic_fields_schema.find_one({"_id": "current"})
        if not schema:
            return {"valid": True, "errors": []}
        
        errors = []
        all_fields = {f["id"]: f for f in schema.get("fields", [])}
        
        # Obtener campos del template
        template_fields = []
        if template_id:
            for t in schema.get("templates", []):
                if t.get("id") == template_id:
                    template_fields = t.get("fields", [])
                    break
        
        # Validar cada campo
        for field_id in template_fields:
            field = all_fields.get(field_id)
            if not field:
                continue
            
            value = form_data.get(field_id)
            
            # Required validation
            if field.get("required") and not value:
                errors.append({
                    "field": field_id,
                    "message": f"{field.get('label')} es requerido"
                })
                continue
            
            # Skip if no value
            if not value:
                continue
            
            # Validation rules
            validation = field.get("validation", {})
            
            if validation.get("regex"):
                if not re.match(validation["regex"], str(value)):
                    errors.append({
                        "field": field_id,
                        "message": validation.get("pattern_message", "Formato inválido")
                    })
            
            if validation.get("min") is not None:
                if isinstance(value, (int, float)) and value < validation["min"]:
                    errors.append({
                        "field": field_id,
                        "message": f"El valor mínimo es {validation['min']}"
                    })
            
            if validation.get("max") is not None:
                if isinstance(value, (int, float)) and value > validation["max"]:
                    errors.append({
                        "field": field_id,
                        "message": f"El valor máximo es {validation['max']}"
                    })
            
            if validation.get("min_length") is not None:
                if isinstance(value, str) and len(value) < validation["min_length"]:
                    errors.append({
                        "field": field_id,
                        "message": f"Mínimo {validation['min_length']} caracteres"
                    })
            
            if validation.get("max_length") is not None:
                if isinstance(value, str) and len(value) > validation["max_length"]:
                    errors.append({
                        "field": field_id,
                        "message": f"Máximo {validation['max_length']} caracteres"
                    })
        
        return {
            "valid": len(errors) == 0,
            "errors": errors
        }
        
    except Exception as e:
        logger.error(f"Error validating form: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Función para inicializar el schema por defecto
async def initialize_dynamic_fields_schema(db):
    """Inicializa el schema de campos dinámicos si no existe"""
    try:
        existing = await db.dynamic_fields_schema.find_one({"_id": "current"})
        if not existing:
            default_schema = {
                "_id": "current",
                "schema_version": "1.0.0",
                "fields": get_default_tax_fields(),
                "templates": get_default_templates(),
                "ui_hints": get_default_ui_hints(),
                "validations": get_default_validations(),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            await db.dynamic_fields_schema.insert_one(default_schema)
            logger.info("✅ Dynamic fields schema initialized")
        else:
            logger.info("📋 Dynamic fields schema already exists")
    except Exception as e:
        logger.error(f"Error initializing dynamic fields schema: {e}")
