"""
Tax Preparer Service
Business logic for tax preparation, form generation, and IRS integration
"""

import os
import uuid
import logging
import hashlib
import base64
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Use the SAME persistent encryption key as the rest of the system
# Falls back to ENCRYPTION_KEY (the main key set in .env)
_raw_key = os.environ.get('TAX_ENCRYPTION_KEY') or os.environ.get('ENCRYPTION_KEY')
if not _raw_key:
    _raw_key = Fernet.generate_key()
    logger.warning("⚠️  No ENCRYPTION_KEY found in .env — generated transient key. Data will NOT survive restarts!")
ENCRYPTION_KEY = _raw_key
cipher = Fernet(ENCRYPTION_KEY if isinstance(ENCRYPTION_KEY, bytes) else ENCRYPTION_KEY.encode())


class TaxPreparerService:
    """Service for tax preparation operations"""
    
    def __init__(self, db):
        self.db = db
        self.taxpayers = db.tax_taxpayers
        self.payers = db.tax_payers
        self.forms = db.tax_forms
        self.submissions = db.tax_submissions
        self.documents = db.tax_documents
        self.consents = db.tax_consents
        self.tin_checks = db.tax_tin_checks
        self.credentials = db.tax_credentials
        self.activities = db.tax_activities
        logger.info("✅ Tax Preparer Service initialized")
    
    # ==================== ENCRYPTION ====================
    
    def encrypt_sensitive(self, data: str) -> str:
        """Encrypt sensitive data like SSN"""
        if not data:
            return ""
        return cipher.encrypt(data.encode()).decode()
    
    def decrypt_sensitive(self, encrypted: str) -> str:
        """Decrypt sensitive data. Raises ValueError on failure."""
        if not encrypted:
            return ""
        try:
            return cipher.decrypt(encrypted.encode()).decode()
        except Exception as e:
            logger.error(f"❌ Decryption failed: {e}")
            raise ValueError(f"Decryption failed: {e}")
    
    def mask_ssn(self, ssn: str) -> str:
        """Mask SSN to XXX-XX-1234"""
        if not ssn or len(ssn) < 4:
            return "XXX-XX-XXXX"
        clean = ssn.replace("-", "").replace(" ", "")
        return f"XXX-XX-{clean[-4:]}"
    
    def mask_ein(self, ein: str) -> str:
        """Mask EIN to XX-XXX1234"""
        if not ein or len(ein) < 4:
            return "XX-XXXXXXX"
        clean = ein.replace("-", "")
        return f"XX-XXX{clean[-4:]}"
    
    # ==================== TAXPAYERS ====================
    
    async def create_taxpayer(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Create a new taxpayer/client"""
        taxpayer_id = str(uuid.uuid4())
        
        # Encrypt sensitive data
        ssn_encrypted = self.encrypt_sensitive(data.get('ssn', ''))
        ein_encrypted = self.encrypt_sensitive(data.get('ein', ''))
        spouse_ssn_encrypted = self.encrypt_sensitive(data.get('spouseSSN', ''))
        
        taxpayer = {
            'id': taxpayer_id,
            'taxpayerType': data.get('taxpayerType', 'individual'),
            'firstName': data.get('firstName'),
            'lastName': data.get('lastName'),
            'middleName': data.get('middleName'),
            'suffix': data.get('suffix'),
            'ssnEncrypted': ssn_encrypted,
            'ssnMasked': self.mask_ssn(data.get('ssn', '')),
            'einEncrypted': ein_encrypted,
            'einMasked': self.mask_ein(data.get('ein', '')) if data.get('ein') else None,
            'dateOfBirth': data.get('dateOfBirth'),
            'email': data.get('email'),
            'phone': data.get('phone'),
            'address1': data.get('address1'),
            'address2': data.get('address2'),
            'city': data.get('city'),
            'state': data.get('state'),
            'zipCode': data.get('zipCode'),
            'country': data.get('country', 'US'),
            # Spouse
            'spouseFirstName': data.get('spouseFirstName'),
            'spouseLastName': data.get('spouseLastName'),
            'spouseSSNEncrypted': spouse_ssn_encrypted,
            'spouseSSNMasked': self.mask_ssn(data.get('spouseSSN', '')) if data.get('spouseSSN') else None,
            'spouseDOB': data.get('spouseDOB'),
            # Status
            'tinVerified': False,
            'tinVerifiedAt': None,
            'status': 'active',
            'createdBy': created_by,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        
        await self.taxpayers.insert_one(taxpayer)
        await self.log_activity(created_by, 'taxpayer_created', {'taxpayerId': taxpayer_id})
        
        return self._format_taxpayer(taxpayer)
    
    async def get_taxpayer(self, taxpayer_id: str) -> Optional[Dict[str, Any]]:
        """Get taxpayer by ID"""
        taxpayer = await self.taxpayers.find_one({'id': taxpayer_id})
        if taxpayer:
            return self._format_taxpayer(taxpayer)
        return None
    
    async def get_taxpayers(
        self, 
        search: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Get list of taxpayers with optional search"""
        query = {'status': {'$ne': 'deleted'}}
        
        if search:
            query['$or'] = [
                {'firstName': {'$regex': search, '$options': 'i'}},
                {'lastName': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'ssnMasked': {'$regex': search, '$options': 'i'}},
            ]
        
        cursor = self.taxpayers.find(query).sort('createdAt', -1).skip(skip).limit(limit)
        taxpayers = await cursor.to_list(limit)
        
        return [self._format_taxpayer(t) for t in taxpayers]
    
    async def update_taxpayer(self, taxpayer_id: str, data: Dict[str, Any], updated_by: str) -> Dict[str, Any]:
        """Update taxpayer information"""
        update = {'updatedAt': datetime.utcnow()}
        
        # Handle sensitive field updates
        if 'ssn' in data and data['ssn']:
            update['ssnEncrypted'] = self.encrypt_sensitive(data['ssn'])
            update['ssnMasked'] = self.mask_ssn(data['ssn'])
            update['tinVerified'] = False  # Need to re-verify
        
        if 'ein' in data and data['ein']:
            update['einEncrypted'] = self.encrypt_sensitive(data['ein'])
            update['einMasked'] = self.mask_ein(data['ein'])
        
        # Non-sensitive fields
        for field in ['firstName', 'lastName', 'middleName', 'email', 'phone', 
                      'address1', 'address2', 'city', 'state', 'zipCode', 'dateOfBirth']:
            if field in data:
                update[field] = data[field]
        
        await self.taxpayers.update_one({'id': taxpayer_id}, {'$set': update})
        await self.log_activity(updated_by, 'taxpayer_updated', {'taxpayerId': taxpayer_id})
        
        return await self.get_taxpayer(taxpayer_id)
    
    def _format_taxpayer(self, taxpayer: Dict[str, Any]) -> Dict[str, Any]:
        """Format taxpayer for response (exclude encrypted data)"""
        return {
            'id': taxpayer.get('id'),
            'taxpayerType': taxpayer.get('taxpayerType'),
            'firstName': taxpayer.get('firstName'),
            'lastName': taxpayer.get('lastName'),
            'middleName': taxpayer.get('middleName'),
            'suffix': taxpayer.get('suffix'),
            'ssnMasked': taxpayer.get('ssnMasked'),
            'einMasked': taxpayer.get('einMasked'),
            'dateOfBirth': taxpayer.get('dateOfBirth'),
            'email': taxpayer.get('email'),
            'phone': taxpayer.get('phone'),
            'address1': taxpayer.get('address1'),
            'address2': taxpayer.get('address2'),
            'city': taxpayer.get('city'),
            'state': taxpayer.get('state'),
            'zipCode': taxpayer.get('zipCode'),
            'country': taxpayer.get('country'),
            'spouseFirstName': taxpayer.get('spouseFirstName'),
            'spouseLastName': taxpayer.get('spouseLastName'),
            'spouseSSNMasked': taxpayer.get('spouseSSNMasked'),
            'tinVerified': taxpayer.get('tinVerified', False),
            'tinVerifiedAt': taxpayer.get('tinVerifiedAt'),
            'status': taxpayer.get('status'),
            'createdAt': taxpayer.get('createdAt'),
            'updatedAt': taxpayer.get('updatedAt'),
        }
    
    # ==================== PAYERS ====================
    
    async def create_payer(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Create a payer (business that issues 1099s)"""
        payer_id = str(uuid.uuid4())
        
        payer = {
            'id': payer_id,
            'name': data.get('name'),
            'einEncrypted': self.encrypt_sensitive(data.get('ein', '')),
            'einMasked': self.mask_ein(data.get('ein', '')),
            'address1': data.get('address1'),
            'address2': data.get('address2'),
            'city': data.get('city'),
            'state': data.get('state'),
            'zipCode': data.get('zipCode'),
            'country': data.get('country', 'US'),
            'phone': data.get('phone'),
            'contactName': data.get('contactName'),
            'contactEmail': data.get('contactEmail'),
            'tinVerified': False,
            'status': 'active',
            'createdBy': created_by,
            'createdAt': datetime.utcnow(),
        }
        
        await self.payers.insert_one(payer)
        return self._format_payer(payer)
    
    async def get_payers(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get list of payers"""
        cursor = self.payers.find({'status': 'active'}).sort('name', 1).limit(limit)
        payers = await cursor.to_list(limit)
        return [self._format_payer(p) for p in payers]
    
    def _format_payer(self, payer: Dict[str, Any]) -> Dict[str, Any]:
        """Format payer for response"""
        return {
            'id': payer.get('id'),
            'name': payer.get('name'),
            'einMasked': payer.get('einMasked'),
            'address1': payer.get('address1'),
            'city': payer.get('city'),
            'state': payer.get('state'),
            'zipCode': payer.get('zipCode'),
            'phone': payer.get('phone'),
            'contactName': payer.get('contactName'),
            'contactEmail': payer.get('contactEmail'),
            'tinVerified': payer.get('tinVerified', False),
            'createdAt': payer.get('createdAt'),
        }
    
    # ==================== FORMS ====================
    
    async def create_form_1099_nec(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Create a 1099-NEC form"""
        form_id = str(uuid.uuid4())
        
        # Get payer and recipient info
        payer = await self.payers.find_one({'id': data.get('payerId')})
        recipient = await self.taxpayers.find_one({'id': data.get('recipientId')})
        
        if not payer or not recipient:
            raise ValueError("Payer or recipient not found")
        
        form = {
            'id': form_id,
            'formType': '1099-NEC',
            'taxYear': data.get('taxYear', datetime.now().year),
            'payerId': data.get('payerId'),
            'payerName': payer.get('name'),
            'payerEIN': payer.get('einMasked'),
            'recipientId': data.get('recipientId'),
            'recipientName': f"{recipient.get('firstName')} {recipient.get('lastName')}",
            'recipientSSN': recipient.get('ssnMasked'),
            # Box values
            'box1_nonemployeeCompensation': data.get('nonemployeeCompensation', 0),
            'box4_federalTaxWithheld': data.get('federalTaxWithheld', 0),
            'box5_stateTaxWithheld': data.get('stateTaxWithheld', 0),
            'box6_statePayerNumber': data.get('statePayerNumber'),
            'box7_stateIncome': data.get('stateIncome', 0),
            'accountNumber': data.get('accountNumber'),
            'secondTinNotice': data.get('secondTinNotice', False),
            'directSalesIndicator': data.get('directSalesIndicator', False),
            # Status
            'status': 'draft',
            'validated': False,
            'validationErrors': [],
            'createdBy': created_by,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        
        # Validate
        errors = self._validate_1099_nec(form)
        form['validationErrors'] = errors
        form['validated'] = len(errors) == 0
        if form['validated']:
            form['status'] = 'validated'
        
        await self.forms.insert_one(form)
        await self.log_activity(created_by, 'form_created', {'formId': form_id, 'formType': '1099-NEC'})
        
        # Remove MongoDB _id for response
        if '_id' in form:
            del form['_id']
        
        return form
    
    async def create_form_1099_misc(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Create a 1099-MISC form"""
        form_id = str(uuid.uuid4())
        
        payer = await self.payers.find_one({'id': data.get('payerId')})
        recipient = await self.taxpayers.find_one({'id': data.get('recipientId')})
        
        if not payer or not recipient:
            raise ValueError("Payer or recipient not found")
        
        form = {
            'id': form_id,
            'formType': '1099-MISC',
            'taxYear': data.get('taxYear', datetime.now().year),
            'payerId': data.get('payerId'),
            'payerName': payer.get('name'),
            'payerEIN': payer.get('einMasked'),
            'recipientId': data.get('recipientId'),
            'recipientName': f"{recipient.get('firstName')} {recipient.get('lastName')}",
            'recipientSSN': recipient.get('ssnMasked'),
            # Box values
            'box1_rents': data.get('rents', 0),
            'box2_royalties': data.get('royalties', 0),
            'box3_otherIncome': data.get('otherIncome', 0),
            'box4_federalTaxWithheld': data.get('federalTaxWithheld', 0),
            'box5_fishingBoatProceeds': data.get('fishingBoatProceeds', 0),
            'box6_medicalPayments': data.get('medicalPayments', 0),
            'box8_substitutePayments': data.get('substitutePayments', 0),
            'box9_cropInsurance': data.get('cropInsurance', 0),
            'box10_grossProceeds': data.get('grossProceeds', 0),
            'box11_fishPurchased': data.get('fishPurchased', 0),
            'box12_section409ADeferrals': data.get('section409ADeferrals', 0),
            'box13_excessGoldenParachute': data.get('excessGoldenParachute', 0),
            'box14_nonqualifiedDeferred': data.get('nonqualifiedDeferred', 0),
            'box15_stateTaxWithheld': data.get('stateTaxWithheld', 0),
            'box16_statePayerNumber': data.get('statePayerNumber'),
            'box17_stateIncome': data.get('stateIncome', 0),
            'accountNumber': data.get('accountNumber'),
            'fatcaFiling': data.get('fatcaFiling', False),
            'secondTinNotice': data.get('secondTinNotice', False),
            'status': 'draft',
            'validated': False,
            'validationErrors': [],
            'createdBy': created_by,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
        }
        
        await self.forms.insert_one(form)
        return form
    
    async def get_forms(
        self,
        form_type: Optional[str] = None,
        tax_year: Optional[int] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get list of forms"""
        query = {}
        if form_type:
            query['formType'] = form_type
        if tax_year:
            query['taxYear'] = tax_year
        if status:
            query['status'] = status
        
        cursor = self.forms.find(query).sort('createdAt', -1).limit(limit)
        forms = await cursor.to_list(limit)
        return [self._format_form(f) for f in forms]
    
    async def get_form(self, form_id: str) -> Optional[Dict[str, Any]]:
        """Get form by ID"""
        form = await self.forms.find_one({'id': form_id})
        if form:
            return self._format_form(form)
        return None
    
    def _format_form(self, form: Dict[str, Any]) -> Dict[str, Any]:
        """Format form for JSON response - remove MongoDB _id and convert datetime"""
        if '_id' in form:
            del form['_id']
        
        # Convert datetime fields to ISO strings
        for key in ['createdAt', 'updatedAt', 'submittedAt', 'acceptedAt']:
            if key in form and form[key] is not None:
                if hasattr(form[key], 'isoformat'):
                    form[key] = form[key].isoformat()
        
        return form
    
    def _validate_1099_nec(self, form: Dict[str, Any]) -> List[Dict[str, str]]:
        """Validate 1099-NEC form"""
        errors = []
        
        # Check required amounts
        compensation = form.get('box1_nonemployeeCompensation', 0)
        if compensation < 600:
            errors.append({
                'field': 'box1_nonemployeeCompensation',
                'code': 'AMOUNT_BELOW_THRESHOLD',
                'message': 'El pago es menor a $600. No se requiere 1099-NEC para pagos menores a $600.'
            })
        
        if compensation > 10000000:
            errors.append({
                'field': 'box1_nonemployeeCompensation',
                'code': 'AMOUNT_TOO_HIGH',
                'message': 'El monto parece inusualmente alto. Verifique el valor.'
            })
        
        # Check withholding
        withheld = form.get('box4_federalTaxWithheld', 0)
        if withheld > compensation:
            errors.append({
                'field': 'box4_federalTaxWithheld',
                'code': 'WITHHOLDING_EXCEEDS_PAYMENT',
                'message': 'La retención federal no puede ser mayor al pago.'
            })
        
        return errors
    
    # ==================== TIN MATCHING ====================
    
    async def check_tin(self, tin: str, name: str, tin_type: str, checked_by: str) -> Dict[str, Any]:
        """Check TIN with IRS (mock for now, real integration later)"""
        check_id = str(uuid.uuid4())
        
        # Mock TIN matching logic - in production, this would call IRS e-Services
        # For now, we do basic validation
        clean_tin = tin.replace("-", "").replace(" ", "")
        
        is_valid_format = False
        if tin_type == 'SSN':
            is_valid_format = len(clean_tin) == 9 and clean_tin.isdigit()
        elif tin_type == 'EIN':
            is_valid_format = len(clean_tin) == 9 and clean_tin.isdigit()
        
        # Simulate match codes
        # 0 = Match, 1 = TIN mismatch, 2 = TIN not issued, etc.
        match_code = '0' if is_valid_format else '1'
        match_descriptions = {
            '0': 'TIN y nombre coinciden con los registros del IRS',
            '1': 'TIN no coincide con el nombre proporcionado',
            '2': 'TIN no ha sido emitido',
            '3': 'TIN no es válido',
            '4': 'Nombre no coincide',
            '5': 'Error en el sistema - reintentar',
        }
        
        checked_at = datetime.utcnow()
        
        result = {
            'id': check_id,
            'tin': tin,
            'tinMasked': self.mask_ssn(tin) if tin_type == 'SSN' else self.mask_ein(tin),
            'tinType': tin_type,
            'name': name,
            'matched': match_code == '0',
            'matchCode': match_code,
            'matchDescription': match_descriptions.get(match_code, 'Código desconocido'),
            'checkedBy': checked_by,
            'checkedAt': checked_at,
            'source': 'mock'  # Will be 'irs_eservices' in production
        }
        
        await self.tin_checks.insert_one(result.copy())  # Use copy to avoid MongoDB modifying original
        await self.log_activity(checked_by, 'tin_check', {'checkId': check_id, 'matched': result['matched']})
        
        # Convert datetime to ISO string for JSON serialization
        result['checkedAt'] = checked_at.isoformat()
        
        return result
    
    # ==================== DOCUMENTS ====================
    
    async def save_document(
        self,
        taxpayer_id: str,
        document_type: str,
        filename: str,
        file_path: str,
        file_size: int,
        uploaded_by: str,
        tax_year: Optional[int] = None
    ) -> Dict[str, Any]:
        """Save document metadata"""
        doc_id = str(uuid.uuid4())
        
        doc = {
            'id': doc_id,
            'taxpayerId': taxpayer_id,
            'documentType': document_type,
            'filename': filename,
            'filePath': file_path,
            'fileSize': file_size,
            'taxYear': tax_year,
            'ocrProcessed': False,
            'ocrData': None,
            'needsReview': True,
            'uploadedBy': uploaded_by,
            'uploadedAt': datetime.utcnow(),
        }
        
        await self.documents.insert_one(doc)
        return doc
    
    async def get_documents(self, taxpayer_id: str) -> List[Dict[str, Any]]:
        """Get documents for a taxpayer"""
        cursor = self.documents.find({'taxpayerId': taxpayer_id}).sort('uploadedAt', -1)
        return await cursor.to_list(100)
    
    async def update_ocr_result(self, document_id: str, ocr_data: Dict[str, Any], confidence: float):
        """Update document with OCR results"""
        await self.documents.update_one(
            {'id': document_id},
            {'$set': {
                'ocrProcessed': True,
                'ocrData': ocr_data,
                'ocrConfidence': confidence,
                'needsReview': confidence < 0.9,
                'ocrProcessedAt': datetime.utcnow(),
            }}
        )
    
    # ==================== CONSENTS ====================
    
    async def create_consent(self, data: Dict[str, Any], created_by: str) -> Dict[str, Any]:
        """Create a consent/authorization record"""
        consent_id = str(uuid.uuid4())
        
        # Hash the signature for integrity
        signature_hash = None
        if data.get('signatureData'):
            signature_hash = hashlib.sha256(data['signatureData'].encode()).hexdigest()
        
        consent = {
            'id': consent_id,
            'taxpayerId': data.get('taxpayerId'),
            'consentType': data.get('consentType'),
            'taxYears': data.get('taxYears', []),
            'description': data.get('description'),
            'signatureData': data.get('signatureData'),
            'signatureHash': signature_hash,
            'ipAddress': data.get('ipAddress'),
            'userAgent': data.get('userAgent'),
            'signedAt': datetime.utcnow(),
            'expiresAt': None,  # Could add expiration logic
            'revoked': False,
            'createdBy': created_by,
        }
        
        await self.consents.insert_one(consent)
        await self.log_activity(created_by, 'consent_created', {
            'consentId': consent_id,
            'taxpayerId': data.get('taxpayerId'),
            'consentType': data.get('consentType')
        })
        
        return consent
    
    async def get_consents(self, taxpayer_id: str) -> List[Dict[str, Any]]:
        """Get consents for a taxpayer"""
        cursor = self.consents.find({
            'taxpayerId': taxpayer_id,
            'revoked': False
        }).sort('signedAt', -1)
        return await cursor.to_list(100)
    
    # ==================== SUBMISSIONS ====================
    
    async def create_submission(self, form_id: str, submission_type: str, submitted_by: str) -> Dict[str, Any]:
        """Create a submission to IRS"""
        form = await self.get_form(form_id)
        if not form:
            raise ValueError("Form not found")
        
        submission_id = str(uuid.uuid4())
        
        submission = {
            'id': submission_id,
            'formId': form_id,
            'formType': form.get('formType'),
            'taxYear': form.get('taxYear'),
            'recipientName': form.get('recipientName'),
            'submissionType': submission_type,  # original, corrected, void
            'status': 'pending',
            'submittedAt': datetime.utcnow(),
            'submittedBy': submitted_by,
            'ackCode': None,
            'ackMessage': None,
            'errors': [],
            'responseAt': None,
            'xmlGenerated': False,
            'xmlPath': None,
        }
        
        await self.submissions.insert_one(submission)
        
        # Update form status
        await self.forms.update_one(
            {'id': form_id},
            {'$set': {'status': 'submitted', 'lastSubmissionId': submission_id}}
        )
        
        await self.log_activity(submitted_by, 'submission_created', {
            'submissionId': submission_id,
            'formId': form_id
        })
        
        return submission
    
    async def get_submissions(self, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get submissions"""
        query = {}
        if status:
            query['status'] = status
        
        cursor = self.submissions.find(query).sort('submittedAt', -1).limit(limit)
        return await cursor.to_list(limit)
    
    async def update_submission_response(
        self,
        submission_id: str,
        status: str,
        ack_code: Optional[str] = None,
        ack_message: Optional[str] = None,
        errors: Optional[List[Dict]] = None
    ):
        """Update submission with IRS response"""
        update = {
            'status': status,
            'ackCode': ack_code,
            'ackMessage': ack_message,
            'errors': errors or [],
            'responseAt': datetime.utcnow(),
        }
        
        await self.submissions.update_one({'id': submission_id}, {'$set': update})
        
        # Update form status
        submission = await self.submissions.find_one({'id': submission_id})
        if submission:
            form_status = 'accepted' if status == 'accepted' else 'rejected' if status == 'rejected' else 'submitted'
            await self.forms.update_one(
                {'id': submission['formId']},
                {'$set': {'status': form_status}}
            )
    
    # ==================== DASHBOARD ====================
    
    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get dashboard statistics"""
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)
        
        # Count taxpayers
        total_clients = await self.taxpayers.count_documents({'status': 'active'})
        new_clients = await self.taxpayers.count_documents({
            'status': 'active',
            'createdAt': {'$gte': month_start}
        })
        
        # Count forms by type
        forms_pipeline = [
            {'$match': {'status': {'$ne': 'deleted'}}},
            {'$group': {'_id': '$formType', 'count': {'$sum': 1}}}
        ]
        forms_by_type = {}
        async for doc in self.forms.aggregate(forms_pipeline):
            forms_by_type[doc['_id']] = doc['count']
        
        total_forms = sum(forms_by_type.values())
        
        # Submission stats
        pending = await self.submissions.count_documents({'status': 'pending'})
        accepted = await self.submissions.count_documents({'status': 'accepted'})
        rejected = await self.submissions.count_documents({'status': 'rejected'})
        
        total_submissions = pending + accepted + rejected
        acceptance_rate = (accepted / total_submissions * 100) if total_submissions > 0 else 0
        
        # Documents needing review
        docs_review = await self.documents.count_documents({'needsReview': True})
        
        return {
            'totalClients': total_clients,
            'newClientsThisMonth': new_clients,
            'totalForms': total_forms,
            'formsByType': forms_by_type,
            'pendingSubmissions': pending,
            'acceptedSubmissions': accepted,
            'rejectedSubmissions': rejected,
            'acceptanceRate': round(acceptance_rate, 1),
            'documentsNeedingReview': docs_review,
        }
    
    # ==================== ACTIVITY LOGGING ====================
    
    async def log_activity(self, user_id: str, action: str, details: Dict[str, Any] = None):
        """Log an activity for audit trail"""
        activity = {
            'id': str(uuid.uuid4()),
            'userId': user_id,
            'action': action,
            'details': details or {},
            'timestamp': datetime.utcnow(),
        }
        await self.activities.insert_one(activity)
    
    async def get_activities(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent activities"""
        cursor = self.activities.find().sort('timestamp', -1).limit(limit)
        return await cursor.to_list(limit)


# Global instance
tax_preparer_service: Optional[TaxPreparerService] = None


def init_tax_preparer_service(db) -> TaxPreparerService:
    """Initialize the tax preparer service"""
    global tax_preparer_service
    tax_preparer_service = TaxPreparerService(db)
    return tax_preparer_service


def get_tax_preparer_service() -> Optional[TaxPreparerService]:
    """Get the tax preparer service instance"""
    return tax_preparer_service
