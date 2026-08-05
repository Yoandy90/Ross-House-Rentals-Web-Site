"""
Ross Tax - Tax Wizard Module
Sistema tipo TurboTax para declaraciones de impuestos guiadas
"""

from .models import *
from .service import TaxWizardService
from .endpoints import tax_wizard_router

__all__ = ['TaxWizardService', 'tax_wizard_router']
