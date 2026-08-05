"""
Tax Wizard Export Service
Exports wizard data to CSV, XML, and JSON formats for integration with tax software
"""
import csv
import json
import io
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom

logger = logging.getLogger(__name__)


class TaxWizardExportService:
    """Service for exporting Tax Wizard data in various formats"""
    
    def export_to_csv(self, sessions: List[Dict[str, Any]]) -> str:
        """
        Export multiple sessions to CSV format
        
        Args:
            sessions: List of session dictionaries
            
        Returns:
            CSV string
        """
        output = io.StringIO()
        
        # Define CSV columns
        fieldnames = [
            'session_id', 'user_id', 'tax_year', 'status', 'service_level',
            'case_complexity', 'created_at', 'completed_at',
            # Personal Info
            'first_name', 'middle_name', 'last_name', 'ssn', 'date_of_birth',
            'phone', 'email', 'street', 'city', 'state', 'zip',
            # Filing Status
            'filing_status', 'spouse_first_name', 'spouse_last_name', 'spouse_ssn',
            # Income
            'total_income', 'total_w2_wages', 'total_federal_withheld',
            'total_state_withheld', 'has_self_employment', 'self_employment_income',
            # Dependents
            'num_dependents', 'dependent_names',
            # Deductions
            'use_standard_deduction', 'itemized_total', 'mortgage_interest',
            'property_taxes', 'charitable_donations',
            # Estimate
            'estimated_refund', 'is_refund', 'total_credits',
            # Pricing
            'total_price', 'recommended_service'
        ]
        
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        
        for session in sessions:
            row = self._flatten_session_for_csv(session)
            writer.writerow(row)
        
        return output.getvalue()
    
    def _flatten_session_for_csv(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """Flatten a session object for CSV export"""
        personal = session.get('personal_info') or {}
        
        # Handle address field - it can be a string or dict
        if isinstance(personal.get('address'), str):
            # If address is a string, use it as street
            address = {"street": personal.get('address', ''), "city": personal.get('city', ''), "state": personal.get('state', ''), "zip": personal.get('zip_code', '')}
        else:
            address = personal.get('address') or {}
            
        income = session.get('income') or {}
        deductions = session.get('deductions_credits') or {}
        estimate = session.get('refund_estimate') or {}
        spouse = session.get('spouse_info') or {}
        dependents = session.get('dependents') or []
        
        # Calculate totals from W-2 sources
        w2_sources = income.get('w2_sources') or []
        total_w2 = sum(w.get('amount', 0) or 0 for w in w2_sources)
        total_fed_withheld = sum(w.get('federal_withheld', 0) or 0 for w in w2_sources)
        total_state_withheld = sum(w.get('state_withheld', 0) or 0 for w in w2_sources)
        
        # Calculate itemized total
        itemized = (
            (deductions.get('mortgage_interest') or 0) +
            (deductions.get('property_taxes') or 0) +
            (deductions.get('state_taxes_paid') or 0) +
            (deductions.get('charitable_donations') or 0) +
            (deductions.get('medical_expenses') or 0)
        )
        
        return {
            'session_id': session.get('id', ''),
            'user_id': session.get('user_id', ''),
            'tax_year': session.get('tax_year', 2025),
            'status': session.get('status', ''),
            'service_level': session.get('service_level', ''),
            'case_complexity': session.get('case_complexity', ''),
            'created_at': session.get('created_at', ''),
            'completed_at': session.get('completed_at', ''),
            # Personal Info
            'first_name': personal.get('first_name', ''),
            'middle_name': personal.get('middle_name', ''),
            'last_name': personal.get('last_name', ''),
            'ssn': personal.get('ssn', ''),
            'date_of_birth': personal.get('date_of_birth', ''),
            'phone': personal.get('phone', ''),
            'email': personal.get('email', ''),
            'street': address.get('street', ''),
            'city': address.get('city', ''),
            'state': address.get('state', ''),
            'zip': address.get('zip', ''),
            # Filing Status
            'filing_status': session.get('filing_status', ''),
            'spouse_first_name': spouse.get('first_name', ''),
            'spouse_last_name': spouse.get('last_name', ''),
            'spouse_ssn': spouse.get('ssn', ''),
            # Income
            'total_income': income.get('total_income', 0),
            'total_w2_wages': total_w2,
            'total_federal_withheld': total_fed_withheld,
            'total_state_withheld': total_state_withheld,
            'has_self_employment': income.get('has_self_employment', False),
            'self_employment_income': income.get('self_employment_income', 0),
            # Dependents
            'num_dependents': len(dependents),
            'dependent_names': '; '.join([f"{d.get('first_name', '')} {d.get('last_name', '')}" for d in dependents]),
            # Deductions
            'use_standard_deduction': deductions.get('use_standard_deduction', True),
            'itemized_total': itemized if not deductions.get('use_standard_deduction', True) else 0,
            'mortgage_interest': deductions.get('mortgage_interest', 0),
            'property_taxes': deductions.get('property_taxes', 0),
            'charitable_donations': deductions.get('charitable_donations', 0),
            # Estimate
            'estimated_refund': estimate.get('estimated_refund', 0),
            'is_refund': estimate.get('is_refund', True),
            'total_credits': estimate.get('total_credits', 0),
            # Pricing
            'total_price': session.get('total_price', 0),
            'recommended_service': session.get('recommended_service', ''),
        }
    
    def export_to_xml(self, session: Dict[str, Any]) -> str:
        """
        Export a single session to XML format (Drake-compatible structure)
        
        Args:
            session: Session dictionary
            
        Returns:
            XML string
        """
        root = ET.Element('TaxReturn')
        root.set('xmlns', 'http://www.irs.gov/efile')
        root.set('taxYear', str(session.get('tax_year', 2025)))
        root.set('generatedBy', 'RossTaxWizard')
        root.set('generatedAt', datetime.utcnow().isoformat())
        
        # Return Header
        header = ET.SubElement(root, 'ReturnHeader')
        ET.SubElement(header, 'SessionId').text = session.get('id', '')
        ET.SubElement(header, 'ServiceLevel').text = session.get('service_level', '')
        ET.SubElement(header, 'Status').text = session.get('status', '')
        
        # Filer (Taxpayer)
        filer = ET.SubElement(root, 'Filer')
        personal = session.get('personal_info') or {}
        
        # Handle address field - it can be a string or dict
        if isinstance(personal.get('address'), str):
            # If address is a string, use it as street
            address = {"street": personal.get('address', ''), "city": personal.get('city', ''), "state": personal.get('state', ''), "zip": personal.get('zip_code', '')}
        else:
            address = personal.get('address') or {}
        
        name = ET.SubElement(filer, 'Name')
        ET.SubElement(name, 'FirstName').text = personal.get('first_name', '')
        ET.SubElement(name, 'MiddleName').text = personal.get('middle_name', '')
        ET.SubElement(name, 'LastName').text = personal.get('last_name', '')
        
        ET.SubElement(filer, 'SSN').text = personal.get('ssn', '')
        ET.SubElement(filer, 'DateOfBirth').text = personal.get('date_of_birth', '')
        ET.SubElement(filer, 'Phone').text = personal.get('phone', '')
        ET.SubElement(filer, 'Email').text = personal.get('email', '')
        
        addr = ET.SubElement(filer, 'Address')
        ET.SubElement(addr, 'Street').text = address.get('street', '')
        ET.SubElement(addr, 'City').text = address.get('city', '')
        ET.SubElement(addr, 'State').text = address.get('state', '')
        ET.SubElement(addr, 'ZipCode').text = address.get('zip', '')
        
        ET.SubElement(filer, 'FilingStatus').text = session.get('filing_status', '')
        
        # Spouse (if applicable)
        spouse_info = session.get('spouse_info')
        if spouse_info:
            spouse = ET.SubElement(root, 'Spouse')
            spouse_name = ET.SubElement(spouse, 'Name')
            ET.SubElement(spouse_name, 'FirstName').text = spouse_info.get('first_name', '')
            ET.SubElement(spouse_name, 'LastName').text = spouse_info.get('last_name', '')
            ET.SubElement(spouse, 'SSN').text = spouse_info.get('ssn', '')
            ET.SubElement(spouse, 'DateOfBirth').text = spouse_info.get('date_of_birth', '')
        
        # Income
        income_section = ET.SubElement(root, 'Income')
        income = session.get('income') or {}
        
        # W-2 Sources
        w2_sources = income.get('w2_sources') or []
        for i, w2 in enumerate(w2_sources):
            w2_elem = ET.SubElement(income_section, 'W2')
            w2_elem.set('sequence', str(i + 1))
            ET.SubElement(w2_elem, 'EmployerName').text = w2.get('employer_name', '')
            ET.SubElement(w2_elem, 'EmployerEIN').text = w2.get('employer_ein', '')
            ET.SubElement(w2_elem, 'WagesTipsOtherComp').text = str(w2.get('amount', 0))
            ET.SubElement(w2_elem, 'FederalWithheld').text = str(w2.get('federal_withheld', 0))
            ET.SubElement(w2_elem, 'StateWithheld').text = str(w2.get('state_withheld', 0))
        
        ET.SubElement(income_section, 'TotalIncome').text = str(income.get('total_income', 0))
        
        if income.get('has_self_employment'):
            se = ET.SubElement(income_section, 'SelfEmployment')
            ET.SubElement(se, 'GrossIncome').text = str(income.get('self_employment_income', 0))
            ET.SubElement(se, 'Expenses').text = str(income.get('self_employment_expenses', 0))
        
        # Dependents
        dependents = session.get('dependents') or []
        if dependents:
            deps_section = ET.SubElement(root, 'Dependents')
            for i, dep in enumerate(dependents):
                dep_elem = ET.SubElement(deps_section, 'Dependent')
                dep_elem.set('sequence', str(i + 1))
                dep_name = ET.SubElement(dep_elem, 'Name')
                ET.SubElement(dep_name, 'FirstName').text = dep.get('first_name', '')
                ET.SubElement(dep_name, 'LastName').text = dep.get('last_name', '')
                ET.SubElement(dep_elem, 'SSN').text = dep.get('ssn', '')
                ET.SubElement(dep_elem, 'DateOfBirth').text = dep.get('date_of_birth', '')
                ET.SubElement(dep_elem, 'Relationship').text = dep.get('relationship', '')
                ET.SubElement(dep_elem, 'MonthsLived').text = str(dep.get('months_lived', 12))
        
        # Deductions
        deductions = session.get('deductions_credits') or {}
        ded_section = ET.SubElement(root, 'Deductions')
        ET.SubElement(ded_section, 'UseStandardDeduction').text = str(deductions.get('use_standard_deduction', True)).lower()
        
        if not deductions.get('use_standard_deduction', True):
            itemized = ET.SubElement(ded_section, 'Itemized')
            ET.SubElement(itemized, 'MortgageInterest').text = str(deductions.get('mortgage_interest', 0))
            ET.SubElement(itemized, 'PropertyTaxes').text = str(deductions.get('property_taxes', 0))
            ET.SubElement(itemized, 'StateTaxesPaid').text = str(deductions.get('state_taxes_paid', 0))
            ET.SubElement(itemized, 'CharitableDonations').text = str(deductions.get('charitable_donations', 0))
            ET.SubElement(itemized, 'MedicalExpenses').text = str(deductions.get('medical_expenses', 0))
        
        # Credits
        credits_section = ET.SubElement(root, 'Credits')
        ET.SubElement(credits_section, 'ClaimsEITC').text = str(deductions.get('claims_eitc', False)).lower()
        if deductions.get('has_childcare_expenses'):
            ET.SubElement(credits_section, 'ChildcareExpenses').text = str(deductions.get('childcare_amount', 0))
        if deductions.get('has_education_expenses'):
            ET.SubElement(credits_section, 'EducationExpenses').text = str(deductions.get('education_amount', 0))
        
        # Estimate
        estimate = session.get('refund_estimate') or {}
        est_section = ET.SubElement(root, 'Estimate')
        ET.SubElement(est_section, 'EstimatedRefund').text = str(estimate.get('estimated_refund', 0))
        ET.SubElement(est_section, 'IsRefund').text = str(estimate.get('is_refund', True)).lower()
        ET.SubElement(est_section, 'TotalWithheld').text = str(estimate.get('total_withheld', 0))
        ET.SubElement(est_section, 'TotalCredits').text = str(estimate.get('total_credits', 0))
        
        # Pretty print
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent='  ')
    
    def export_to_json(self, sessions: List[Dict[str, Any]]) -> str:
        """
        Export sessions to JSON format
        
        Args:
            sessions: List of session dictionaries
            
        Returns:
            JSON string
        """
        export_data = {
            "export_info": {
                "generated_at": datetime.utcnow().isoformat(),
                "generated_by": "Ross Tax Wizard",
                "version": "1.0",
                "count": len(sessions)
            },
            "sessions": sessions
        }
        
        return json.dumps(export_data, indent=2, default=str)
    
    def export_for_drake(self, session: Dict[str, Any]) -> Dict[str, Any]:
        """
        Export session data in Drake Software import format
        
        Args:
            session: Session dictionary
            
        Returns:
            Dictionary formatted for Drake import
        """
        personal = session.get('personal_info') or {}
        address = personal.get('address') or {}
        income = session.get('income') or {}
        deductions = session.get('deductions_credits') or {}
        dependents = session.get('dependents') or []
        spouse = session.get('spouse_info')
        
        # Handle address field - it can be a string or dict
        if isinstance(address, str):
            # If address is a string, use it as address1
            address_dict = {"street": address, "city": "", "state": "", "zip": ""}
        else:
            address_dict = address or {}
        
        # Drake format structure
        drake_data = {
            "client": {
                "ssn": personal.get('ssn', ''),
                "first_name": personal.get('first_name', ''),
                "middle_initial": (personal.get('middle_name', '') or '')[:1],
                "last_name": personal.get('last_name', ''),
                "dob": personal.get('date_of_birth', ''),
                "phone": personal.get('phone', ''),
                "email": personal.get('email', ''),
                "address1": address_dict.get('street', ''),
                "city": address_dict.get('city', ''),
                "state": address_dict.get('state', ''),
                "zip": address_dict.get('zip', ''),
                "filing_status": self._map_filing_status_to_drake(session.get('filing_status', '')),
            },
            "spouse": None,
            "w2s": [],
            "dependents": [],
            "deductions": {
                "standard": deductions.get('use_standard_deduction', True),
            }
        }
        
        # Add spouse if applicable
        if spouse:
            drake_data["spouse"] = {
                "ssn": spouse.get('ssn', ''),
                "first_name": spouse.get('first_name', ''),
                "last_name": spouse.get('last_name', ''),
                "dob": spouse.get('date_of_birth', ''),
            }
        
        # Add W-2s
        for w2 in income.get('w2_sources') or []:
            drake_data["w2s"].append({
                "employer_name": w2.get('employer_name', ''),
                "employer_ein": w2.get('employer_ein', ''),
                "box1": w2.get('amount', 0),
                "box2": w2.get('federal_withheld', 0),
                "box17": w2.get('state_withheld', 0),
            })
        
        # Add dependents
        for dep in dependents:
            drake_data["dependents"].append({
                "ssn": dep.get('ssn', ''),
                "first_name": dep.get('first_name', ''),
                "last_name": dep.get('last_name', ''),
                "dob": dep.get('date_of_birth', ''),
                "relationship": dep.get('relationship', ''),
                "months": dep.get('months_lived', 12),
            })
        
        # Add itemized deductions if not using standard
        if not deductions.get('use_standard_deduction', True):
            drake_data["deductions"].update({
                "mortgage_interest": deductions.get('mortgage_interest', 0),
                "property_taxes": deductions.get('property_taxes', 0),
                "state_taxes": deductions.get('state_taxes_paid', 0),
                "charity": deductions.get('charitable_donations', 0),
                "medical": deductions.get('medical_expenses', 0),
            })
        
        return drake_data
    
    def _map_filing_status_to_drake(self, status: str) -> str:
        """Map Tax Wizard filing status to Drake code"""
        mapping = {
            'single': '1',
            'married_filing_jointly': '2',
            'married_filing_separately': '3',
            'head_of_household': '4',
            'qualifying_widow': '5',
        }
        return mapping.get(status, '1')


# Singleton instance
export_service = TaxWizardExportService()
