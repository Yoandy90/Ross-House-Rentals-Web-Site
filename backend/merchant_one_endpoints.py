"""
Merchant One ACH Endpoints
API routes for Customer Vault and Recurring subscriptions
"""

import logging
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Header, Query, Body, UploadFile, File
from typing import Optional, List
from pydantic import BaseModel

from merchant_one_models import (
    CreateVaultRequest,
    CreateSubscriptionRequest,
    CreateVaultAndSubscriptionRequest,
    CustomerInfo,
    BankInfo,
    SubscriptionInfo,
    CreateVaultResponse,
    MerchantOneResponse,
    ParsedClientInfo
)
from merchant_one_service import MerchantOneService, parse_client_text
from subscription_plans_service import (
    SubscriptionPlansService,
    CreatePlanRequest,
    UpdatePlanRequest
)

logger = logging.getLogger(__name__)

merchant_router = APIRouter(prefix='/merchant-one', tags=['Merchant One ACH'])

# Service instance - will be set by server.py
merchant_service: Optional[MerchantOneService] = None
plans_service: Optional[SubscriptionPlansService] = None
dunning_service = None  # Will be set by server.py


def set_merchant_service(service: MerchantOneService):
    """Set the merchant service instance"""
    global merchant_service
    merchant_service = service
    logger.info("\u2705 Merchant One endpoints initialized")


def set_dunning_service(service):
    """Set the dunning service instance"""
    global dunning_service
    dunning_service = service
    logger.info("\u2705 Dunning service connected to endpoints")


# ==================== HELPER ====================

async def _verify_admin(authorization: Optional[str]) -> dict:
    """Verify admin authorization"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    # Import here to avoid circular imports
    from server import get_current_user
    
    user = await get_current_user(authorization)
    
    if user.get('role') not in ['admin', 'office_assistant']:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user


# ==================== STATEMENT DESCRIPTOR ====================

class DescriptorConfig(BaseModel):
    descriptor: Optional[str] = None
    descriptor_phone: Optional[str] = None
    descriptor_address: Optional[str] = None
    descriptor_city: Optional[str] = None
    descriptor_state: Optional[str] = None
    descriptor_url: Optional[str] = None

@merchant_router.get('/descriptor')
async def get_descriptor(authorization: Optional[str] = Header(None)):
    """Get current statement descriptor configuration"""
    await _verify_admin(authorization)
    
    from server import db
    config = await db.settings.find_one({"key": "merchant_descriptor"})
    if not config:
        return {"descriptor": "", "descriptor_phone": "", "descriptor_address": "", "descriptor_city": "", "descriptor_state": "", "descriptor_url": ""}
    
    return {
        "descriptor": config.get("descriptor", ""),
        "descriptor_phone": config.get("descriptor_phone", ""),
        "descriptor_address": config.get("descriptor_address", ""),
        "descriptor_city": config.get("descriptor_city", ""),
        "descriptor_state": config.get("descriptor_state", ""),
        "descriptor_url": config.get("descriptor_url", ""),
    }

@merchant_router.put('/descriptor')
async def update_descriptor(
    config: DescriptorConfig,
    authorization: Optional[str] = Header(None)
):
    """Update statement descriptor - this name appears on client bank statements"""
    await _verify_admin(authorization)
    
    from server import db
    from merchant_one_service import set_descriptor_cache
    
    update_data = {
        "key": "merchant_descriptor",
        "descriptor": (config.descriptor or "").strip()[:60],
        "descriptor_phone": (config.descriptor_phone or "").strip()[:20],
        "descriptor_address": (config.descriptor_address or "").strip()[:60],
        "descriptor_city": (config.descriptor_city or "").strip()[:30],
        "descriptor_state": (config.descriptor_state or "").strip()[:2],
        "descriptor_url": (config.descriptor_url or "").strip()[:60],
        "updated_at": datetime.utcnow(),
    }
    
    await db.settings.update_one(
        {"key": "merchant_descriptor"},
        {"$set": update_data},
        upsert=True
    )
    
    # Update cache so it takes effect immediately
    set_descriptor_cache(update_data)
    
    logger.info(f"✅ Statement descriptor updated: {update_data['descriptor']}")
    
    return {"success": True, "message": f"Descriptor actualizado: {update_data['descriptor']}"}


# ==================== ENDPOINTS ====================

@merchant_router.post('/vault/create')
async def create_vault_customer(
    request: CreateVaultRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create ACH customer in Merchant One vault (WITHOUT subscription)
    
    Use this to add a customer to the vault for future charges.
    You can later add a subscription using /subscription/create
    
    SECURITY: Bank account information is sent to Merchant One but not stored locally.
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        response, vault_id = await merchant_service.create_vault_customer(
            request.customer,
            request.bank
        )
        
        # If successful, save to database
        if response.success and response.responseCode == '1' and merchant_service.db is not None:
            try:
                from datetime import datetime
                import uuid
                
                masked_account = f"****{request.bank.accountNumber[-4:]}" if request.bank.accountNumber else "****"
                
                record = {
                    'id': str(uuid.uuid4()),
                    'firstName': request.customer.firstName,
                    'lastName': request.customer.lastName,
                    'email': request.customer.email,
                    'phone': request.customer.phone,
                    'address1': request.customer.address1,
                    'city': request.customer.city,
                    'state': request.customer.state,
                    'postalCode': request.customer.postalCode,
                    'maskedAccount': masked_account,
                    'customerVaultId': vault_id,
                    'subscriptionId': None,
                    'subscriptionStatus': 'none',  # No subscription yet
                    'vaultStatus': 'active',
                    'planName': None,
                    'planAmount': None,
                    'dayFrequency': None,
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow()
                }
                
                await merchant_service.db.vault_customers.insert_one(record)
                logger.info(f"✅ Vault-only record saved: {vault_id}")
                
                return {
                    'success': True,
                    'vaultSuccess': True,
                    'subscriptionSuccess': False,
                    'customerVaultId': vault_id,
                    'maskedAccount': masked_account,
                    'summaryMessage': f'✅ Cliente {request.customer.firstName} {request.customer.lastName} agregado al vault. Puedes agregar una suscripción más tarde.',
                    'responseText': response.responseText
                }
                
            except Exception as e:
                logger.error(f"Failed to save vault record: {e}")
                # Return success anyway since vault was created in Merchant One
                return {
                    'success': True,
                    'vaultSuccess': True,
                    'subscriptionSuccess': False,
                    'customerVaultId': vault_id,
                    'summaryMessage': f'✅ Vault creado en Merchant One pero no se pudo guardar localmente',
                    'warning': str(e)
                }
        
        # Return error
        return {
            'success': False,
            'vaultSuccess': False,
            'subscriptionSuccess': False,
            'summaryMessage': f'Error: {response.responseText}',
            'error': response.responseText
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating vault customer: {e}")
        raise HTTPException(status_code=500, detail="Failed to create vault customer")


@merchant_router.post('/subscription/create', response_model=MerchantOneResponse)
async def create_subscription(
    request: CreateSubscriptionRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create recurring subscription for existing vault customer
    
    Requires an existing customer_vault_id from a previous vault creation.
    Updates the database record with subscription info.
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        response = await merchant_service.create_subscription(
            request.customerVaultId,
            request.subscription
        )
        
        # If successful, update the database record
        if response.success and response.responseCode == '1' and merchant_service.db is not None:
            try:
                from datetime import datetime
                update_data = {
                    'subscriptionId': response.transactionId,  # NMI returns transactionId for subscription
                    'subscriptionStatus': 'active',
                    'planName': request.subscription.planName,
                    'planAmount': float(request.subscription.amount),
                    'dayFrequency': int(request.subscription.dayFrequency),
                    'updatedAt': datetime.utcnow()
                }
                await merchant_service.db.vault_customers.update_one(
                    {'customerVaultId': request.customerVaultId},
                    {'$set': update_data}
                )
                logger.info(f"✅ Updated DB record with subscription for vault {request.customerVaultId}")
            except Exception as e:
                logger.error(f"Failed to update DB with subscription: {e}")
        
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription")


@merchant_router.post('/create-customer-and-subscription', response_model=CreateVaultResponse)
async def create_customer_and_subscription(
    request: CreateVaultAndSubscriptionRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create both vault customer and subscription in one flow
    
    This is the main endpoint for the office workflow:
    1. Creates ACH customer in vault
    2. If successful, creates recurring subscription
    3. Saves record to database
    4. Returns consolidated result
    
    SECURITY:
    - Bank account numbers are masked in stored records
    - Sensitive data is never logged
    - Only admins can access this endpoint
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        response = await merchant_service.create_vault_and_subscription(
            request.customer,
            request.bank,
            request.subscription
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in combined vault+subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to create vault and subscription")


@merchant_router.get('/vault/customers')
async def list_vault_customers(
    limit: int = Query(default=50, ge=1, le=2000),
    skip: int = Query(default=0, ge=0),
    authorization: Optional[str] = Header(None)
):
    """
    List vault customers from database
    
    Returns recent vault customer records with masked account numbers.
    Enriches customers with age data from user profiles when available.
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        customers = await merchant_service.get_vault_customers(limit=limit, skip=skip)
        
        # Enrich with age data from user profiles
        if merchant_service.db is not None:
            customers = await _enrich_customers_with_age(merchant_service.db, customers)
        
        return {
            'success': True,
            'customers': customers,
            'count': len(customers)
        }
    except Exception as e:
        logger.error(f"Error listing vault customers: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customers")


@merchant_router.get('/vault/customer/{vault_id}')
async def get_vault_customer(
    vault_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Get single vault customer by vault ID
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        customer = await merchant_service.get_vault_customer(vault_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {
            'success': True,
            'customer': customer
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching vault customer: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer")


class ParseTextRequest(BaseModel):
    text: str


@merchant_router.post('/parse-client-info', response_model=ParsedClientInfo)
async def parse_client_info(
    request: ParseTextRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Parse unstructured text to extract client information
    
    Uses regex patterns to extract name, address, phone, email,
    and bank information from pasted text.
    
    SECURITY: May extract sensitive bank data - never log full account numbers.
    """
    await _verify_admin(authorization)
    
    try:
        result = parse_client_text(request.text)
        return result
    except Exception as e:
        logger.error(f"Error parsing client info: {e}")
        raise HTTPException(status_code=400, detail="Failed to parse text")


@merchant_router.get('/health')
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'ok',
        'service': 'merchant-one',
        'initialized': merchant_service is not None
    }


# ==================== BATCH ENDPOINTS ====================

from typing import List
from pydantic import BaseModel


class BatchCustomerItem(BaseModel):
    """Single customer item for batch processing"""
    customer: CustomerInfo
    bank: BankInfo
    subscription: SubscriptionInfo
    useAchDefaults: bool = True


class BatchCreateRequest(BaseModel):
    """Batch create request with multiple customers"""
    customers: List[BatchCustomerItem]


class BatchItemResult(BaseModel):
    """Result for a single batch item"""
    index: int
    success: bool
    customerName: str
    customerVaultId: Optional[str] = None
    subscriptionId: Optional[str] = None
    maskedAccount: Optional[str] = None
    vaultSuccess: bool = False
    subscriptionSuccess: bool = False
    error: Optional[str] = None


class BatchCreateResponse(BaseModel):
    """Response for batch create operation"""
    success: bool
    totalProcessed: int
    successCount: int
    failCount: int
    vaultSuccessCount: int
    subscriptionSuccessCount: int
    results: List[BatchItemResult]
    summaryMessage: str


@merchant_router.post('/batch-create', response_model=BatchCreateResponse)
async def batch_create_customers(
    request: BatchCreateRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Batch create vault customers and subscriptions
    
    Processes multiple customers in sequence. Each customer is created
    independently - failures don't affect other customers.
    
    Returns detailed results for each customer including:
    - Success/failure status
    - Vault ID and Subscription ID if successful
    - Error message if failed
    
    SECURITY:
    - Bank account numbers are masked in responses
    - Only admins can access this endpoint
    - Each customer is validated before processing
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    if not request.customers:
        raise HTTPException(status_code=400, detail="No customers provided")
    
    if len(request.customers) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 customers per batch")
    
    results: List[BatchItemResult] = []
    success_count = 0
    fail_count = 0
    vault_success_count = 0
    subscription_success_count = 0
    
    for index, item in enumerate(request.customers):
        customer_name = f"{item.customer.firstName} {item.customer.lastName}"
        
        try:
            # Process this customer
            response = await merchant_service.create_vault_and_subscription(
                item.customer,
                item.bank,
                item.subscription
            )
            
            result = BatchItemResult(
                index=index,
                success=response.vaultSuccess,
                customerName=customer_name,
                customerVaultId=response.customerVaultId,
                subscriptionId=response.subscriptionId,
                maskedAccount=response.maskedAccount,
                vaultSuccess=response.vaultSuccess,
                subscriptionSuccess=response.subscriptionSuccess,
                error=response.vaultError or response.subscriptionError
            )
            
            if response.vaultSuccess:
                vault_success_count += 1
                success_count += 1
            else:
                fail_count += 1
            
            if response.subscriptionSuccess:
                subscription_success_count += 1
                
        except Exception as e:
            logger.error(f"Batch item {index} error: {e}")
            result = BatchItemResult(
                index=index,
                success=False,
                customerName=customer_name,
                error=str(e)
            )
            fail_count += 1
        
        results.append(result)
    
    total = len(request.customers)
    
    if fail_count == 0:
        summary = f"✅ Todos los {total} clientes procesados exitosamente"
    elif success_count == 0:
        summary = f"❌ Fallaron todos los {total} clientes"
    else:
        summary = f"⚠️ {success_count}/{total} clientes creados, {fail_count} fallaron"
    
    return BatchCreateResponse(
        success=fail_count == 0,
        totalProcessed=total,
        successCount=success_count,
        failCount=fail_count,
        vaultSuccessCount=vault_success_count,
        subscriptionSuccessCount=subscription_success_count,
        results=results,
        summaryMessage=summary
    )


class CSVParseRequest(BaseModel):
    """Request to parse CSV data"""
    csvData: str
    hasHeader: bool = True


class CSVParseResponse(BaseModel):
    """Response with parsed CSV data"""
    success: bool
    rowCount: int
    customers: List[dict]
    errors: List[str]


@merchant_router.post('/parse-csv', response_model=CSVParseResponse)
async def parse_csv_data(
    request: CSVParseRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Parse CSV data into customer objects
    
    Expected CSV columns (order matters):
    firstName, lastName, email, phone, address1, city, state, postalCode,
    checkName, routing, accountNumber, accountType, planName, amount, dayFrequency, startDate
    
    Returns parsed customer objects ready for batch creation.
    """
    await _verify_admin(authorization)
    
    import csv
    from io import StringIO
    
    customers = []
    errors = []
    
    try:
        reader = csv.reader(StringIO(request.csvData))
        rows = list(reader)
        
        if not rows:
            return CSVParseResponse(
                success=False,
                rowCount=0,
                customers=[],
                errors=["CSV vacío"]
            )
        
        # Skip header if present
        start_index = 1 if request.hasHeader else 0
        
        for i, row in enumerate(rows[start_index:], start=start_index):
            if len(row) < 16:
                errors.append(f"Fila {i+1}: Faltan columnas (tiene {len(row)}, necesita 16)")
                continue
            
            try:
                # Parse row into customer object
                customer = {
                    "customer": {
                        "firstName": row[0].strip(),
                        "lastName": row[1].strip(),
                        "email": row[2].strip() if row[2] else "",
                        "phone": row[3].strip() if row[3] else "",
                        "company": "",
                        "address1": row[4].strip(),
                        "address2": "",
                        "city": row[5].strip(),
                        "state": row[6].strip(),
                        "postalCode": row[7].strip(),
                        "country": "US"
                    },
                    "bank": {
                        "checkName": row[8].strip() if row[8] else f"{row[0]} {row[1]}",
                        "routing": row[9].strip().replace("-", "").replace(" ", ""),
                        "accountNumber": row[10].strip().replace("-", "").replace(" ", ""),
                        "accountHolderType": "personal",
                        "accountType": row[11].strip().lower() if row[11] else "checking",
                        "secCode": "PPD"
                    },
                    "subscription": {
                        "planName": row[12].strip(),
                        "amount": row[13].strip(),
                        "dayFrequency": row[14].strip(),
                        "startDate": row[15].strip(),
                        "planPayments": "0",
                        "productSku": "",
                        "orderDescription": ""
                    },
                    "useAchDefaults": True
                }
                
                # Basic validation
                if not customer["customer"]["firstName"]:
                    errors.append(f"Fila {i+1}: Falta nombre")
                    continue
                if not customer["customer"]["lastName"]:
                    errors.append(f"Fila {i+1}: Falta apellido")
                    continue
                if len(customer["bank"]["routing"]) != 9:
                    errors.append(f"Fila {i+1}: Routing debe ser 9 dígitos")
                    continue
                
                customers.append(customer)
                
            except Exception as e:
                errors.append(f"Fila {i+1}: Error de formato - {str(e)}")
        
        return CSVParseResponse(
            success=len(customers) > 0,
            rowCount=len(customers),
            customers=customers,
            errors=errors
        )
        
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        return CSVParseResponse(
            success=False,
            rowCount=0,
            customers=[],
            errors=[f"Error parseando CSV: {str(e)}"]
        )



# ==================== ENHANCED ENDPOINTS ====================

from merchant_one_enhanced import (
    smart_parse_csv,
    SmartParseResult,
    generate_csv_template,
    generate_excel_template_base64,
    pause_subscription,
    resume_subscription,
    cancel_subscription,
    update_subscription,
    delete_vault_customer,
    charge_vault_customer,
    update_vault_customer,
    query_transactions,
    get_subscription_info,
    generate_customers_csv,
    generate_customers_excel,
    bulk_pause_subscriptions,
    bulk_resume_subscriptions,
    bulk_cancel_subscriptions
)

class SmartParseRequest(BaseModel):
    """Request for smart CSV parsing"""
    csvData: str
    hasHeader: bool = True
    defaultRouting: Optional[str] = None
    defaultAmount: Optional[float] = None
    defaultFrequency: Optional[int] = None
    defaultPlanName: Optional[str] = None


class BatchSelectiveRequest(BaseModel):
    """Request for selective batch creation"""
    customers: List[dict]
    selectedIndices: List[int]
    subscriptionOverride: Optional[dict] = None
    mode: Optional[str] = 'vault_and_subscription'  # 'vault_only' or 'vault_and_subscription'


class SubscriptionActionRequest(BaseModel):
    """Request for subscription management"""
    action: str  # pause, resume, cancel, update
    subscriptionId: str
    vaultId: Optional[str] = None  # For database update
    newAmount: Optional[float] = None
    newFrequency: Optional[int] = None


class ChargeRequest(BaseModel):
    """Request for one-time charge"""
    customerVaultId: str
    amount: float
    orderDescription: Optional[str] = None


class UpdateVaultRequest(BaseModel):
    """Request for updating vault customer info"""
    customerVaultId: str
    # Customer info (all optional)
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    address1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postalCode: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    dateOfBirth: Optional[str] = None
    # Bank info (all optional)
    checkName: Optional[str] = None
    routing: Optional[str] = None
    accountNumber: Optional[str] = None
    accountType: Optional[str] = None  # checking/savings
    accountHolderType: Optional[str] = None  # personal/business


@merchant_router.post('/smart-parse')
async def smart_parse_endpoint(
    request: SmartParseRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Smart CSV parsing with auto-detection of columns
    
    Automatically detects column mappings from various formats.
    Supports common variations like 'first_name', 'firstName', 'nombre', etc.
    """
    await _verify_admin(authorization)
    
    result = smart_parse_csv(
        csv_data=request.csvData,
        has_header=request.hasHeader,
        default_routing=request.defaultRouting,
        default_amount=request.defaultAmount,
        default_frequency=request.defaultFrequency,
        default_plan_name=request.defaultPlanName
    )
    
    return {
        'success': result.success,
        'totalRows': result.totalRows,
        'parsedRows': result.parsedRows,
        'customers': result.customers,
        'errors': result.errors,
        'columnMapping': result.columnMapping,
        'warnings': result.warnings
    }


@merchant_router.post('/upload-file')
async def upload_file_for_parsing(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """
    Upload XLS/XLSX/CSV file and convert to text for smart parsing.
    Returns the extracted text data that can be fed into the smart parse endpoint.
    """
    await _verify_admin(authorization)
    
    filename = file.filename.lower() if file.filename else ''
    content = await file.read()
    
    logger.info(f"📤 File upload: {file.filename} ({len(content)} bytes)")
    
    try:
        if filename.endswith('.csv'):
            # CSV: just decode as text
            text_data = content.decode('utf-8', errors='ignore')
        elif filename.endswith('.xlsx'):
            # XLSX: use openpyxl
            try:
                import openpyxl
                from io import BytesIO
                wb = openpyxl.load_workbook(BytesIO(content), read_only=True)
                ws = wb.active
                rows = []
                for row in ws.iter_rows(values_only=True):
                    row_values = [str(cell) if cell is not None else '' for cell in row]
                    rows.append('\t'.join(row_values))
                text_data = '\n'.join(rows)
                wb.close()
            except ImportError:
                raise HTTPException(status_code=500, detail="openpyxl no instalado para archivos XLSX")
        elif filename.endswith('.xls'):
            # XLS: try reading as text first (many .xls exports are actually TSV/HTML)
            text_data = content.decode('utf-8', errors='ignore')
            
            # Check if it's actually HTML (some XLS exports are HTML tables)
            if '<html' in text_data.lower() or '<table' in text_data.lower():
                try:
                    import re
                    # Simple HTML table parser
                    rows = []
                    table_rows = re.findall(r'<tr[^>]*>(.*?)</tr>', text_data, re.DOTALL | re.IGNORECASE)
                    for tr in table_rows:
                        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.DOTALL | re.IGNORECASE)
                        cells = [re.sub(r'<[^>]+>', '', cell).strip() for cell in cells]
                        if any(cells):
                            rows.append('\t'.join(cells))
                    if rows:
                        text_data = '\n'.join(rows)
                except Exception as e:
                    logger.warning(f"HTML parsing failed, using raw text: {e}")
            
            # If it's not valid text data, try xlrd
            if not any(c.isalpha() for c in text_data[:200]):
                try:
                    import xlrd
                    from io import BytesIO
                    wb = xlrd.open_workbook(file_contents=content)
                    ws = wb.sheet_by_index(0)
                    rows = []
                    for row_idx in range(ws.nrows):
                        row_values = [str(ws.cell_value(row_idx, col)) for col in range(ws.ncols)]
                        rows.append('\t'.join(row_values))
                    text_data = '\n'.join(rows)
                except ImportError:
                    raise HTTPException(status_code=500, detail="xlrd no instalado para archivos XLS binarios")
        else:
            # Try as generic text
            text_data = content.decode('utf-8', errors='ignore')
        
        # Count lines with data
        data_lines = [l for l in text_data.split('\n') if l.strip()]
        
        return {
            'success': True,
            'filename': file.filename,
            'textData': text_data,
            'totalLines': len(data_lines),
            'message': f"✅ Archivo procesado: {len(data_lines)} líneas encontradas"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")


@merchant_router.post('/batch-selective')
async def batch_selective_create(
    request: BatchSelectiveRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create selected customers from a parsed list
    
    Supports two modes:
    - 'vault_and_subscription' (default): Creates vault + subscription for each customer
    - 'vault_only': Creates only vault entries (no subscriptions) - ideal for mass imports
    
    Handles up to 1500 customers with automatic chunking (25 per chunk).
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    if not request.selectedIndices:
        raise HTTPException(status_code=400, detail="No customers selected")
    
    # Validate mode
    is_vault_only = request.mode == 'vault_only'
    
    # Allow up to 1500 for vault_only, 200 for vault+subscription
    max_customers = 1500 if is_vault_only else 200
    if len(request.selectedIndices) > max_customers:
        raise HTTPException(
            status_code=400, 
            detail=f"Máximo {max_customers} clientes por lote en modo {'Solo Vault' if is_vault_only else 'Vault + Suscripción'}"
        )
    
    # Filter to selected customers
    selected_customers = []
    for idx in request.selectedIndices:
        if 0 <= idx < len(request.customers):
            customer = request.customers[idx].copy()
            
            # Apply subscription overrides if provided (only for non-vault-only)
            if not is_vault_only and request.subscriptionOverride:
                if 'subscription' not in customer:
                    customer['subscription'] = {}
                    
                override = request.subscriptionOverride
                if 'amount' in override and override['amount']:
                    customer['subscription']['amount'] = override['amount']
                if 'dayFrequency' in override and override['dayFrequency']:
                    customer['subscription']['dayFrequency'] = override['dayFrequency']
                if 'planName' in override and override['planName']:
                    customer['subscription']['planName'] = override['planName']
                if 'startDate' in override and override['startDate']:
                    customer['subscription']['startDate'] = override['startDate']
            
            selected_customers.append(customer)
    
    if not selected_customers:
        raise HTTPException(status_code=400, detail="No valid customers selected")
    
    from merchant_one_models import CustomerInfo, BankInfo, SubscriptionInfo
    import asyncio
    
    results = []
    success_count = 0
    fail_count = 0
    vault_success_count = 0
    subscription_success_count = 0
    
    # Chunk size: 25 for vault_only (fast), 10 for vault+subscription (slower due to 2 API calls)
    CHUNK_SIZE = 25 if is_vault_only else 10
    total_customers = len(selected_customers)
    
    logger.info(f"🚀 Starting batch {'vault-only' if is_vault_only else 'vault+subscription'} for {total_customers} customers (chunks of {CHUNK_SIZE})")
    
    for chunk_start in range(0, total_customers, CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, total_customers)
        chunk = selected_customers[chunk_start:chunk_end]
        chunk_num = (chunk_start // CHUNK_SIZE) + 1
        total_chunks = (total_customers + CHUNK_SIZE - 1) // CHUNK_SIZE
        
        logger.info(f"📦 Processing chunk {chunk_num}/{total_chunks} ({len(chunk)} customers)")
        
        for rel_index, item in enumerate(chunk):
            abs_index = chunk_start + rel_index
            customer_name = f"{item['customer']['firstName']} {item['customer']['lastName']}"
            
            try:
                customer = CustomerInfo(**item['customer'])
                bank = BankInfo(**item['bank'])
                
                if is_vault_only:
                    # === VAULT ONLY MODE ===
                    vault_response, vault_id = await merchant_service.create_vault_customer(
                        customer, bank
                    )
                    
                    vault_ok = vault_response.success and vault_response.responseCode == '1'
                    
                    # Save to DB if successful
                    if vault_ok and merchant_service.db is not None:
                        try:
                            from merchant_one_models import mask_account_number
                            masked_account = mask_account_number(bank.accountNumber)
                            
                            record = {
                                'id': str(uuid.uuid4()),
                                'firstName': customer.firstName,
                                'lastName': customer.lastName,
                                'email': customer.email,
                                'phone': customer.phone,
                                'address1': customer.address1,
                                'city': customer.city,
                                'state': customer.state,
                                'postalCode': customer.postalCode,
                                'maskedAccount': masked_account,
                                'customerVaultId': vault_id,
                                'subscriptionId': None,
                                'subscriptionStatus': 'none',
                                'vaultStatus': 'active',
                                'planName': None,
                                'planAmount': None,
                                'dayFrequency': None,
                                'createdAt': datetime.utcnow(),
                                'updatedAt': datetime.utcnow()
                            }
                            await merchant_service.db.vault_customers.insert_one(record)
                        except Exception as db_err:
                            logger.error(f"DB save error for vault-only {vault_id}: {db_err}")
                    
                    result = {
                        'index': abs_index,
                        'originalIndex': request.selectedIndices[abs_index] if abs_index < len(request.selectedIndices) else abs_index,
                        'success': vault_ok,
                        'customerName': customer_name,
                        'customerVaultId': vault_id if vault_ok else None,
                        'subscriptionId': None,
                        'maskedAccount': mask_account_number(bank.accountNumber) if vault_ok else None,
                        'vaultSuccess': vault_ok,
                        'subscriptionSuccess': False,
                        'error': vault_response.responseText if not vault_ok else None
                    }
                    
                    if vault_ok:
                        vault_success_count += 1
                        success_count += 1
                    else:
                        fail_count += 1
                else:
                    # === VAULT + SUBSCRIPTION MODE ===
                    subscription = SubscriptionInfo(**item['subscription'])
                    
                    response = await merchant_service.create_vault_and_subscription(
                        customer, bank, subscription
                    )
                    
                    result = {
                        'index': abs_index,
                        'originalIndex': request.selectedIndices[abs_index] if abs_index < len(request.selectedIndices) else abs_index,
                        'success': response.vaultSuccess,
                        'customerName': customer_name,
                        'customerVaultId': response.customerVaultId,
                        'subscriptionId': response.subscriptionId,
                        'maskedAccount': response.maskedAccount,
                        'vaultSuccess': response.vaultSuccess,
                        'subscriptionSuccess': response.subscriptionSuccess,
                        'error': response.vaultError or response.subscriptionError
                    }
                    
                    if response.vaultSuccess:
                        vault_success_count += 1
                        success_count += 1
                    else:
                        fail_count += 1
                    
                    if response.subscriptionSuccess:
                        subscription_success_count += 1
                    
            except Exception as e:
                logger.error(f"Batch selective item {abs_index} error: {e}")
                result = {
                    'index': abs_index,
                    'originalIndex': request.selectedIndices[abs_index] if abs_index < len(request.selectedIndices) else abs_index,
                    'success': False,
                    'customerName': customer_name,
                    'error': str(e)
                }
                fail_count += 1
            
            results.append(result)
        
        # Brief pause between chunks to avoid rate limiting
        if chunk_end < total_customers:
            await asyncio.sleep(0.5)
    
    total = len(selected_customers)
    mode_label = "Solo Vault" if is_vault_only else "Vault + Suscripción"
    
    if fail_count == 0:
        summary = f"✅ Todos los {total} clientes procesados exitosamente ({mode_label})"
    elif success_count == 0:
        summary = f"❌ Fallaron todos los {total} clientes ({mode_label})"
    else:
        summary = f"⚠️ {success_count}/{total} clientes creados, {fail_count} fallaron ({mode_label})"
    
    logger.info(f"✅ Batch complete: {summary}")
    
    return {
        'success': fail_count == 0,
        'totalProcessed': total,
        'successCount': success_count,
        'failCount': fail_count,
        'vaultSuccessCount': vault_success_count,
        'subscriptionSuccessCount': subscription_success_count,
        'results': results,
        'summaryMessage': summary,
        'mode': request.mode
    }



@merchant_router.post('/batch-vault-from-banking')
async def batch_vault_from_banking(
    authorization: Optional[str] = Header(None)
):
    """
    Bulk send client_banking records to NMI Customer Vault (vault-only, no subscriptions).
    
    Reads all client_banking records that have valid routing + account numbers
    and haven't been sent to vault yet. Creates vault entries in NMI and saves
    vault_customers records in MongoDB.
    
    Processes in chunks of 20 with 1-second delays between chunks.
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    if merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    import asyncio
    from merchant_one_models import mask_account_number
    
    # Fetch all banking records with valid routing + account that aren't already in vault
    query = {
        'routing_number': {'$exists': True, '$ne': ''},
        'account_number': {'$exists': True, '$ne': ''},
        'vault_customer_id': {'$exists': False}
    }
    
    records = await merchant_service.db.client_banking.find(query).to_list(2000)
    total = len(records)
    
    if total == 0:
        return {
            'success': True,
            'totalProcessed': 0,
            'successCount': 0,
            'failCount': 0,
            'summaryMessage': 'No hay registros bancarios pendientes de enviar al vault.',
            'results': []
        }
    
    logger.info(f"🚀 Starting batch vault-from-banking for {total} records")
    
    results = []
    success_count = 0
    fail_count = 0
    skip_count = 0
    CHUNK_SIZE = 20
    
    for chunk_start in range(0, total, CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, total)
        chunk = records[chunk_start:chunk_end]
        chunk_num = (chunk_start // CHUNK_SIZE) + 1
        total_chunks = (total + CHUNK_SIZE - 1) // CHUNK_SIZE
        
        logger.info(f"📦 Processing chunk {chunk_num}/{total_chunks} ({len(chunk)} records)")
        
        for rel_idx, rec in enumerate(chunk):
            abs_idx = chunk_start + rel_idx
            customer_name = f"{rec.get('first_name', '')} {rec.get('last_name', '')}".strip()
            banking_id = str(rec.get('_id', ''))
            
            try:
                # Validate required fields
                first_name = (rec.get('first_name') or '').strip()
                last_name = (rec.get('last_name') or '').strip()
                routing = (rec.get('routing_number') or '').strip()
                account = (rec.get('account_number') or '').strip()
                address = (rec.get('address') or '').strip()
                city = (rec.get('city') or '').strip()
                state = (rec.get('state') or '').strip()
                zip_code = (rec.get('zip_code') or '').strip()
                
                if not first_name or not last_name:
                    results.append({
                        'index': abs_idx,
                        'success': False,
                        'customerName': customer_name or 'Sin nombre',
                        'error': 'Nombre o apellido vacío',
                        'skipped': True
                    })
                    skip_count += 1
                    continue
                
                if len(routing) != 9 or not routing.isdigit():
                    results.append({
                        'index': abs_idx,
                        'success': False,
                        'customerName': customer_name,
                        'error': f'Routing inválido: {routing[:3]}***',
                        'skipped': True
                    })
                    skip_count += 1
                    continue
                
                if len(account) < 4 or not account.isdigit():
                    results.append({
                        'index': abs_idx,
                        'success': False,
                        'customerName': customer_name,
                        'error': 'Número de cuenta inválido',
                        'skipped': True
                    })
                    skip_count += 1
                    continue
                
                if not address:
                    address = 'N/A'
                if not city:
                    city = 'N/A'
                if not state or len(state) < 2:
                    state = 'TX'
                if not zip_code or len(zip_code) < 5:
                    zip_code = '00000'
                
                # Build CustomerInfo and BankInfo
                customer = CustomerInfo(
                    firstName=first_name,
                    lastName=last_name,
                    email=rec.get('email') or '',
                    phone=rec.get('phone') or '',
                    address1=address,
                    city=city,
                    state=state,
                    postalCode=zip_code,
                    country='US'
                )
                
                check_name = rec.get('check_name') or f"{first_name} {last_name}"
                account_type = (rec.get('account_type') or 'checking').lower()
                if account_type not in ['checking', 'savings']:
                    account_type = 'checking'
                
                bank = BankInfo(
                    checkName=check_name,
                    routing=routing,
                    accountNumber=account,
                    accountHolderType=(rec.get('account_holder_type') or 'personal').lower(),
                    accountType=account_type,
                    secCode='PPD'
                )
                
                # Create vault customer in NMI
                vault_response, vault_id = await merchant_service.create_vault_customer(
                    customer, bank
                )
                
                vault_ok = vault_response.success and vault_response.responseCode == '1'
                
                if vault_ok:
                    masked = mask_account_number(account)
                    
                    # Save to vault_customers collection
                    vault_record = {
                        'id': str(uuid.uuid4()),
                        'firstName': first_name,
                        'lastName': last_name,
                        'email': rec.get('email') or '',
                        'phone': rec.get('phone') or '',
                        'address1': address,
                        'city': city,
                        'state': state,
                        'postalCode': zip_code,
                        'maskedAccount': masked,
                        'customerVaultId': vault_id,
                        'subscriptionId': None,
                        'subscriptionStatus': 'none',
                        'vaultStatus': 'active',
                        'planName': None,
                        'planAmount': None,
                        'dayFrequency': None,
                        'bankName': rec.get('bank_name'),
                        'sourceCollection': 'client_banking',
                        'sourceBankingId': banking_id,
                        'createdAt': datetime.utcnow(),
                        'updatedAt': datetime.utcnow()
                    }
                    await merchant_service.db.vault_customers.insert_one(vault_record)
                    
                    # Mark banking record as sent to vault
                    await merchant_service.db.client_banking.update_one(
                        {'_id': rec['_id']},
                        {'$set': {
                            'vault_customer_id': vault_id,
                            'vault_sent_at': datetime.utcnow(),
                            'updated_at': datetime.utcnow()
                        }}
                    )
                    
                    success_count += 1
                    results.append({
                        'index': abs_idx,
                        'success': True,
                        'customerName': customer_name,
                        'customerVaultId': vault_id,
                        'maskedAccount': masked
                    })
                else:
                    error_msg = vault_response.responseText or vault_response.errorMessage or 'Error desconocido'
                    fail_count += 1
                    results.append({
                        'index': abs_idx,
                        'success': False,
                        'customerName': customer_name,
                        'error': error_msg
                    })
                    
            except Exception as e:
                logger.error(f"Batch vault-from-banking item {abs_idx} error: {e}")
                fail_count += 1
                results.append({
                    'index': abs_idx,
                    'success': False,
                    'customerName': customer_name,
                    'error': str(e)
                })
        
        # Pause between chunks to avoid NMI rate limiting
        if chunk_end < total:
            await asyncio.sleep(1)
    
    if fail_count == 0 and skip_count == 0:
        summary = f"✅ Los {success_count} clientes fueron enviados al vault exitosamente"
    elif success_count == 0:
        summary = f"❌ Fallaron todos. {skip_count} omitidos por datos incompletos, {fail_count} errores de NMI"
    else:
        summary = f"⚠️ {success_count} exitosos, {fail_count} fallaron, {skip_count} omitidos por datos incompletos"
    
    logger.info(f"✅ Batch vault-from-banking complete: {summary}")
    
    return {
        'success': fail_count == 0,
        'totalProcessed': total,
        'successCount': success_count,
        'failCount': fail_count,
        'skipCount': skip_count,
        'summaryMessage': summary,
        'results': results
    }



@merchant_router.get('/template/csv')
async def download_csv_template():
    """Download CSV template file"""
    from fastapi.responses import Response
    
    csv_content = generate_csv_template(include_example=True)
    
    return Response(
        content=csv_content,
        media_type='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename="merchant_one_template.csv"'
        }
    )


@merchant_router.get('/template/excel')
async def download_excel_template():
    """Download Excel template file"""
    from fastapi.responses import Response
    import base64
    
    excel_base64 = generate_excel_template_base64()
    
    if excel_base64:
        excel_bytes = base64.b64decode(excel_base64)
        return Response(
            content=excel_bytes,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                'Content-Disposition': 'attachment; filename="merchant_one_template.xlsx"'
            }
        )
    else:
        # Fallback to CSV
        csv_content = generate_csv_template(include_example=True)
        return Response(
            content=csv_content,
            media_type='text/csv',
            headers={
                'Content-Disposition': 'attachment; filename="merchant_one_template.csv"'
            }
        )


@merchant_router.post('/subscription/action')
async def subscription_action(
    request: SubscriptionActionRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Manage subscription: pause, resume, cancel, or update
    """
    await _verify_admin(authorization)
    
    if not request.subscriptionId:
        raise HTTPException(status_code=400, detail="Subscription ID required")
    
    action = request.action.lower()
    
    if action == 'pause':
        result = await pause_subscription(request.subscriptionId)
    elif action == 'resume':
        result = await resume_subscription(request.subscriptionId)
    elif action == 'cancel':
        result = await cancel_subscription(request.subscriptionId)
    elif action == 'update':
        result = await update_subscription(
            request.subscriptionId,
            new_amount=request.newAmount,
            new_frequency=request.newFrequency
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
    
    # Update local database if we have the vault ID
    if result.get('success') and request.vaultId and merchant_service is not None and merchant_service.db is not None:
        try:
            update_data = {'updatedAt': datetime.utcnow()}
            
            if action == 'pause':
                update_data['subscriptionStatus'] = 'paused'
            elif action == 'resume':
                update_data['subscriptionStatus'] = 'active'
            elif action == 'cancel':
                update_data['subscriptionStatus'] = 'cancelled'
                update_data['subscriptionId'] = None
            elif action == 'update':
                if request.newAmount:
                    update_data['planAmount'] = request.newAmount
                if request.newFrequency:
                    update_data['dayFrequency'] = request.newFrequency
            
            await merchant_service.db.vault_customers.update_one(
                {'customerVaultId': request.vaultId},
                {'$set': update_data}
            )
        except Exception as e:
            logger.error(f"Failed to update local DB: {e}")
    
    return {
        'success': result.get('success', False),
        'action': action,
        'subscriptionId': request.subscriptionId,
        'responseText': result.get('responseText', ''),
        'error': result.get('error') if not result.get('success') else None
    }


# ==================== SYNC FROM MERCHANT ONE ====================

@merchant_router.post('/vault/sync-from-merchant')
async def sync_from_merchant_one(
    authorization: Optional[str] = Header(None)
):
    """
    Sync ALL vault customers from Merchant One (NMI) into local MongoDB.
    
    - Queries Merchant One Query API for all vault records
    - New customers are inserted into local DB
    - Existing customers are updated with latest data
    - Returns sync statistics
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        result = await merchant_service.sync_vault_from_merchant_one()
        
        return {
            'success': True,
            'message': f"✅ Sincronización completada: {result['synced']} nuevos, {result['updated']} actualizados",
            'synced': result['synced'],
            'updated': result['updated'],
            'already_exists': result['already_exists'],
            'total_remote': result['total_remote'],
            'total_local_after': result.get('total_local_after', 0)
        }
    except Exception as e:
        logger.error(f"Sync from Merchant One failed: {e}")
        raise HTTPException(status_code=500, detail=f"Error en sincronización: {str(e)}")


@merchant_router.post('/vault/refresh-statuses')
async def refresh_subscription_statuses(
    authorization: Optional[str] = Header(None)
):
    """
    Refresh subscription statuses for all vault customers by querying NMI recurring data.
    Does not add new customers - only updates existing ones.
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=500, detail="Merchant service not initialized")
    
    try:
        result = await merchant_service.refresh_subscription_statuses()
        
        return {
            'success': True,
            'message': f"✅ Estados actualizados: {result['updated']} clientes, {result.get('newly_active', 0)} nuevos activos",
            'updated': result['updated'],
            'newly_active': result.get('newly_active', 0),
            'total_subscriptions': result.get('total_subscriptions', 0)
        }
    except Exception as e:
        logger.error(f"Refresh statuses failed: {e}")
        raise HTTPException(status_code=500, detail=f"Error actualizando estados: {str(e)}")


class DedupeRequest(BaseModel):
    """Request to compare parsed customers against existing DB"""
    customers: List[dict]


@merchant_router.post('/vault/dedupe-check')
async def dedupe_check(
    request: DedupeRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Compare a list of parsed customers against existing vault_customers and users collections.
    Returns which are new (not in DB) and which already exist (duplicates).
    Matches by: phone, email, firstName+lastName.
    """
    await _verify_admin(authorization)
    
    if not merchant_service or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    db = merchant_service.db
    
    try:
        # Load all existing customers from vault_customers AND users collections
        vault_cursor = db.vault_customers.find({}, {
            'firstName': 1, 'lastName': 1, 'email': 1, 'phone': 1, 'customerVaultId': 1
        })
        vault_records = await vault_cursor.to_list(length=50000)
        
        users_cursor = db.users.find({}, {
            'firstName': 1, 'lastName': 1, 'email': 1, 'phone': 1, 'name': 1
        })
        user_records = await users_cursor.to_list(length=50000)
        
        # Build lookup sets (normalized)
        def normalize_phone(p):
            if not p:
                return ''
            return ''.join(c for c in str(p) if c.isdigit())[-10:]  # Last 10 digits
        
        def normalize_name(first, last):
            f = (first or '').strip().upper()
            l = (last or '').strip().upper()
            return f"{f} {l}" if f and l else ''
        
        existing_phones = set()
        existing_emails = set()
        existing_names = set()
        
        for r in vault_records:
            ph = normalize_phone(r.get('phone', ''))
            if ph and len(ph) >= 7:
                existing_phones.add(ph)
            em = (r.get('email', '') or '').strip().lower()
            if em and '@' in em:
                existing_emails.add(em)
            nm = normalize_name(r.get('firstName', ''), r.get('lastName', ''))
            if nm:
                existing_names.add(nm)
        
        for r in user_records:
            ph = normalize_phone(r.get('phone', ''))
            if ph and len(ph) >= 7:
                existing_phones.add(ph)
            em = (r.get('email', '') or '').strip().lower()
            if em and '@' in em:
                existing_emails.add(em)
            # Handle both firstName/lastName and name fields
            first = r.get('firstName', '')
            last = r.get('lastName', '')
            if not first and r.get('name'):
                parts = r.get('name', '').split(' ', 1)
                first = parts[0] if parts else ''
                last = parts[1] if len(parts) > 1 else ''
            nm = normalize_name(first, last)
            if nm:
                existing_names.add(nm)
        
        logger.info(f"🔍 Dedupe check: {len(existing_phones)} phones, {len(existing_emails)} emails, {len(existing_names)} names in DB")
        
        # Compare each incoming customer
        new_customers = []
        duplicate_customers = []
        
        for idx, item in enumerate(request.customers):
            customer = item.get('customer', {})
            phone = normalize_phone(customer.get('phone', ''))
            email = (customer.get('email', '') or '').strip().lower()
            name = normalize_name(customer.get('firstName', ''), customer.get('lastName', ''))
            
            match_reason = None
            
            # Check phone match (strongest signal)
            if phone and len(phone) >= 7 and phone in existing_phones:
                match_reason = f"Teléfono: {phone}"
            # Check email match
            elif email and '@' in email and email in existing_emails:
                match_reason = f"Email: {email}"
            # Check name match (weaker signal, but useful)
            elif name and name in existing_names:
                match_reason = f"Nombre: {name}"
            
            entry = {
                'index': idx,
                'firstName': customer.get('firstName', ''),
                'lastName': customer.get('lastName', ''),
                'phone': customer.get('phone', ''),
                'email': customer.get('email', ''),
                'city': customer.get('city', ''),
                'state': customer.get('state', ''),
            }
            
            if match_reason:
                entry['matchReason'] = match_reason
                duplicate_customers.append(entry)
            else:
                new_customers.append(entry)
        
        total = len(request.customers)
        
        logger.info(f"✅ Dedupe result: {len(new_customers)} new, {len(duplicate_customers)} duplicates out of {total}")
        
        return {
            'success': True,
            'totalChecked': total,
            'newCount': len(new_customers),
            'duplicateCount': len(duplicate_customers),
            'newCustomers': new_customers,
            'duplicateCustomers': duplicate_customers,
            'summaryMessage': f"📊 De {total} clientes: {len(new_customers)} nuevos, {len(duplicate_customers)} ya existen"
        }
        
    except Exception as e:
        logger.error(f"Dedupe check error: {e}")
        raise HTTPException(status_code=500, detail=f"Error en verificación: {str(e)}")


class ImportNewRequest(BaseModel):
    """Import only new customers to local DB"""
    customers: List[dict]


@merchant_router.post('/vault/import-new-local')
async def import_new_to_local(
    request: ImportNewRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Import new customers to local MongoDB only (not to Merchant One).
    These are stored as 'pending' records that can later be pushed to Merchant One
    when bank data is available.
    """
    await _verify_admin(authorization)
    
    if not merchant_service or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    db = merchant_service.db
    imported = 0
    errors = []
    
    for idx, item in enumerate(request.customers):
        try:
            customer = item.get('customer', {})
            
            record = {
                'id': str(uuid.uuid4()),
                'firstName': customer.get('firstName', ''),
                'lastName': customer.get('lastName', ''),
                'email': customer.get('email', ''),
                'phone': customer.get('phone', ''),
                'address1': customer.get('address1', ''),
                'address2': customer.get('address2', ''),
                'city': customer.get('city', ''),
                'state': customer.get('state', ''),
                'postalCode': customer.get('postalCode', ''),
                'company': customer.get('company', ''),
                'customerVaultId': None,
                'subscriptionId': None,
                'subscriptionStatus': 'none',
                'vaultStatus': 'pending',
                'planName': None,
                'planAmount': None,
                'dayFrequency': None,
                'maskedAccount': None,
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow(),
                'importedFromCSV': True,
                'pendingBankData': True,
            }
            
            await db.vault_customers.insert_one(record)
            imported += 1
            
        except Exception as e:
            errors.append(f"Error fila {idx}: {str(e)}")
    
    logger.info(f"✅ Imported {imported} new customers to local DB")
    
    return {
        'success': True,
        'imported': imported,
        'errors': errors,
        'message': f"✅ {imported} clientes nuevos importados a la base de datos local"
    }


@merchant_router.post('/vault/update-bank-status')
async def update_vault_bank_status(
    request: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """Update a vault customer's bank data status after bank info is added"""
    await _verify_admin(authorization)
    
    if not merchant_service or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    customer_id = request.get('customerId')
    if not customer_id:
        raise HTTPException(status_code=400, detail="customerId required")
    
    try:
        update = {
            'pendingBankData': False,
            'vaultStatus': 'bank_added',
            'bankDataAdded': True,
            'updatedAt': datetime.utcnow(),
        }
        
        result = await merchant_service.db.vault_customers.update_one(
            {'id': customer_id},
            {'$set': update}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {'success': True, 'message': 'Bank status updated'}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update bank status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CLEANUP ENDPOINTS (before {vault_id} routes) ====================

@merchant_router.delete('/vault/cleanup-all')
async def cleanup_all_vault_customers(
    confirm: str = Query(..., description="Must be 'YES' to confirm"),
    authorization: Optional[str] = Header(None)
):
    """
    Delete ALL vault customers from local database
    Use with caution - this removes all local records
    """
    await _verify_admin(authorization)
    
    if confirm != 'YES':
        raise HTTPException(status_code=400, detail="Must confirm with 'YES'")
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        result = await merchant_service.db.vault_customers.delete_many({})
        
        # Also clean up authorizations
        await merchant_service.db.ach_authorizations.delete_many({})
        
        return {
            'success': True,
            'deletedCount': result.deleted_count,
            'message': f'Eliminados {result.deleted_count} clientes de la base de datos'
        }
    except Exception as e:
        logger.error(f"Error in cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.delete('/vault/{vault_id}')
async def delete_vault(
    vault_id: str,
    force: bool = Query(False, description="Force delete from local DB even if NMI fails"),
    authorization: Optional[str] = Header(None)
):
    """Delete customer from vault"""
    return await _delete_vault_impl(vault_id, force, authorization)


@merchant_router.post('/vault/{vault_id}/delete')
async def delete_vault_post(
    vault_id: str,
    force: bool = Query(False, description="Force delete from local DB even if NMI fails"),
    authorization: Optional[str] = Header(None)
):
    """Delete customer from vault (POST alternative to avoid CORS issues with DELETE)"""
    return await _delete_vault_impl(vault_id, force, authorization)


async def _delete_vault_impl(vault_id: str, force: bool, authorization: Optional[str]):
    """Shared delete logic"""
    try:
        await _verify_admin(authorization)
        
        result = await delete_vault_customer(vault_id)
        
        # Update local database if success OR if force delete
        nmi_success = result.get('success', False)
        should_update_db = nmi_success or force
        
        if should_update_db and merchant_service is not None and merchant_service.db is not None:
            try:
                if force and not nmi_success:
                    # Force delete: actually remove from local DB
                    delete_result = await merchant_service.db.vault_customers.delete_one(
                        {'customerVaultId': vault_id}
                    )
                    logger.info(f"Force deleted vault {vault_id} from local DB: {delete_result.deleted_count} removed")
                else:
                    # Normal delete: mark as deleted
                    await merchant_service.db.vault_customers.update_one(
                        {'customerVaultId': vault_id},
                        {'$set': {
                            'vaultStatus': 'deleted',
                            'updatedAt': datetime.utcnow()
                        }}
                    )
            except Exception as e:
                logger.error(f"Failed to update local DB: {e}")
        
        # If NMI failed but we have force, report partial success
        if not nmi_success and force:
            return {
                'success': True,
                'vaultId': str(vault_id),
                'responseText': 'Eliminado de base de datos local (cliente no encontrado en Merchant One)',
                'warning': str(result.get('responseText', 'Invalid Customer Vault Id'))
            }
        
        return {
            'success': nmi_success,
            'vaultId': str(vault_id),
            'responseText': str(result.get('responseText', '')),
            'error': str(result.get('error', '')) if not nmi_success else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in _delete_vault_impl for vault {vault_id}: {e}", exc_info=True)
        return {
            'success': False,
            'vaultId': str(vault_id),
            'error': str(e)
        }


@merchant_router.delete('/vault-local/{vault_id}')
async def delete_vault_local_only(
    vault_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Delete customer from LOCAL database only (does NOT call Merchant One)
    
    Use this when the customer was already deleted from Merchant One
    or was never successfully created there.
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        result = await merchant_service.db.vault_customers.delete_one(
            {'customerVaultId': vault_id}
        )
        
        if result.deleted_count > 0:
            return {
                'success': True,
                'vaultId': vault_id,
                'message': 'Cliente eliminado de la base de datos local'
            }
        else:
            return {
                'success': False,
                'vaultId': vault_id,
                'error': 'Cliente no encontrado en la base de datos local'
            }
    except Exception as e:
        logger.error(f"Error deleting from local DB: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@merchant_router.post('/charge')
async def charge_customer(
    request: ChargeRequest,
    authorization: Optional[str] = Header(None)
):
    """Process one-time charge for vault customer"""
    await _verify_admin(authorization)
    
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    result = await charge_vault_customer(
        request.customerVaultId,
        request.amount,
        request.orderDescription
    )
    
    return {
        'success': result.get('success', False),
        'customerVaultId': request.customerVaultId,
        'amount': request.amount,
        'transactionId': result.get('transactionId'),
        'responseText': result.get('responseText', ''),
        'error': result.get('error') if not result.get('success') else None
    }


@merchant_router.put('/vault/update')
async def update_vault(
    request: UpdateVaultRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Update customer vault information (address, bank details, etc.)
    
    All fields are optional - only send what you want to update.
    """
    await _verify_admin(authorization)
    
    result = await update_vault_customer(
        customer_vault_id=request.customerVaultId,
        first_name=request.firstName,
        last_name=request.lastName,
        address1=request.address1,
        city=request.city,
        state=request.state,
        zip_code=request.postalCode,
        email=request.email,
        phone=request.phone,
        check_name=request.checkName,
        check_aba=request.routing,
        check_account=request.accountNumber,
        account_type=request.accountType,
        account_holder_type=request.accountHolderType
    )
    
    # Update local database if successful
    if result.get('success') and merchant_service is not None and merchant_service.db is not None:
        try:
            update_data = {'updatedAt': datetime.utcnow()}
            
            # Add non-null fields to update
            if request.firstName:
                update_data['firstName'] = request.firstName
            if request.lastName:
                update_data['lastName'] = request.lastName
            if request.email:
                update_data['email'] = request.email
            if request.phone:
                update_data['phone'] = request.phone
            if request.address1:
                update_data['address1'] = request.address1
            if request.city:
                update_data['city'] = request.city
            if request.state:
                update_data['state'] = request.state
            if request.postalCode:
                update_data['postalCode'] = request.postalCode
            
            # Mask account number for storage
            if request.accountNumber:
                update_data['maskedAccount'] = f"****{request.accountNumber[-4:]}"
            
            # Save dateOfBirth and calculate age
            if request.dateOfBirth:
                update_data['dateOfBirth'] = request.dateOfBirth
                try:
                    dob_date = datetime.strptime(request.dateOfBirth, '%Y-%m-%d').date()
                    today = datetime.now().date()
                    age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
                    update_data['age'] = age
                except (ValueError, TypeError):
                    pass
            
            await merchant_service.db.vault_customers.update_one(
                {'customerVaultId': request.customerVaultId},
                {'$set': update_data}
            )
        except Exception as e:
            logger.error(f"Failed to update local DB: {e}")
    
    return {
        'success': result.get('success', False),
        'customerVaultId': request.customerVaultId,
        'responseText': result.get('responseText', ''),
        'error': result.get('error') if not result.get('success') else None
    }


@merchant_router.get('/stats')
async def get_vault_stats(
    authorization: Optional[str] = Header(None)
):
    """Get vault and subscription statistics"""
    await _verify_admin(authorization)
    
    if not merchant_service or merchant_service.db is None:
        return {
            'totalCustomers': 0,
            'activeVaults': 0,
            'activeSubscriptions': 0,
            'pausedSubscriptions': 0,
            'totalMonthlyRevenue': 0
        }
    
    try:
        db = merchant_service.db
        
        total = await db.vault_customers.count_documents({})
        active_vaults = await db.vault_customers.count_documents({'vaultStatus': 'active'})
        active_subs = await db.vault_customers.count_documents({'subscriptionStatus': 'active'})
        paused_subs = await db.vault_customers.count_documents({'subscriptionStatus': 'paused'})
        
        # Calculate monthly revenue from active subscriptions
        pipeline = [
            {'$match': {'subscriptionStatus': 'active', 'planAmount': {'$exists': True}}},
            {'$group': {
                '_id': None,
                'totalAmount': {'$sum': '$planAmount'},
                'avgAmount': {'$avg': '$planAmount'}
            }}
        ]
        
        revenue_result = await db.vault_customers.aggregate(pipeline).to_list(1)
        total_revenue = revenue_result[0]['totalAmount'] if revenue_result else 0
        avg_amount = revenue_result[0]['avgAmount'] if revenue_result else 0
        
        return {
            'totalCustomers': total,
            'activeVaults': active_vaults,
            'activeSubscriptions': active_subs,
            'pausedSubscriptions': paused_subs,
            'totalMonthlyRevenue': round(total_revenue, 2),
            'averageSubscriptionAmount': round(avg_amount, 2)
        }
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {
            'totalCustomers': 0,
            'activeVaults': 0,
            'activeSubscriptions': 0,
            'pausedSubscriptions': 0,
            'totalMonthlyRevenue': 0,
            'error': str(e)
        }



# ==================== SUBSCRIPTION PLANS ENDPOINTS ====================

def set_plans_service(service: SubscriptionPlansService):
    """Set the plans service instance"""
    global plans_service
    plans_service = service
    logger.info("✅ Subscription Plans service set")


@merchant_router.get('/plans')
async def get_plans(
    active_only: bool = Query(True, description="Only return active plans"),
    authorization: Optional[str] = Header(None)
):
    """Get all subscription plans"""
    await _verify_admin(authorization)
    
    if not plans_service:
        raise HTTPException(status_code=500, detail="Plans service not initialized")
    
    plans = await plans_service.get_plans(active_only=active_only)
    return {'success': True, 'plans': plans}


@merchant_router.post('/plans')
async def create_plan(
    request: CreatePlanRequest,
    authorization: Optional[str] = Header(None)
):
    """Create a new subscription plan"""
    await _verify_admin(authorization)
    
    if not plans_service:
        raise HTTPException(status_code=500, detail="Plans service not initialized")
    
    if not request.name or request.amount <= 0 or request.dayFrequency <= 0:
        raise HTTPException(status_code=400, detail="Name, amount and dayFrequency are required")
    
    plan = await plans_service.create_plan(request)
    return {'success': True, 'plan': plan}


@merchant_router.put('/plans/{plan_id}')
async def update_plan(
    plan_id: str,
    request: UpdatePlanRequest,
    authorization: Optional[str] = Header(None)
):
    """Update a subscription plan"""
    await _verify_admin(authorization)
    
    if not plans_service:
        raise HTTPException(status_code=500, detail="Plans service not initialized")
    
    plan = await plans_service.update_plan(plan_id, request)
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {'success': True, 'plan': plan}


@merchant_router.delete('/plans/{plan_id}')
async def delete_plan(
    plan_id: str,
    hard: bool = Query(False, description="Permanently delete instead of deactivate"),
    authorization: Optional[str] = Header(None)
):
    """Delete or deactivate a subscription plan"""
    await _verify_admin(authorization)
    
    if not plans_service:
        raise HTTPException(status_code=500, detail="Plans service not initialized")
    
    if hard:
        success = await plans_service.hard_delete_plan(plan_id)
    else:
        success = await plans_service.delete_plan(plan_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {'success': True, 'message': 'Plan deleted' if hard else 'Plan deactivated'}


@merchant_router.get('/plans/stats')
async def get_plans_stats(
    authorization: Optional[str] = Header(None)
):
    """Get subscription plans statistics"""
    await _verify_admin(authorization)
    
    if not plans_service:
        raise HTTPException(status_code=500, detail="Plans service not initialized")
    
    stats = await plans_service.get_plan_stats()
    return {'success': True, **stats}


@merchant_router.post('/plans/seed')
async def seed_default_plans(
    authorization: Optional[str] = Header(None)
):
    """Create default subscription plans"""
    await _verify_admin(authorization)
    
    if not plans_service:
        raise HTTPException(status_code=500, detail="Plans service not initialized")
    
    await plans_service.seed_default_plans()
    
    plans = await plans_service.get_plans()
    return {'success': True, 'message': 'Default plans seeded', 'plans': plans}



# ==================== ENHANCED FEATURES ENDPOINTS ====================

class BulkActionRequest(BaseModel):
    """Request for bulk subscription actions"""
    subscriptionIds: List[str]
    vaultIds: Optional[List[str]] = None  # For database updates


class QueryTransactionsRequest(BaseModel):
    """Request for transaction query"""
    customerVaultId: Optional[str] = None
    startDate: Optional[str] = None  # YYYYMMDD
    endDate: Optional[str] = None  # YYYYMMDD
    transactionType: Optional[str] = None
    condition: Optional[str] = None
    limit: int = 50


async def _enrich_customers_with_age(db, customers: list) -> list:
    """
    Enrich vault customers with age/DOB data from tax_wizard_sessions, client_profiles, and users.
    Cross-references by email, phone number, and name to find date_of_birth.
    """
    if not customers:
        return customers
    
    # Collect unique non-empty emails and phones
    emails = list(set(c.get('email', '').strip().lower() for c in customers if c.get('email')))
    phones = list(set(
        ''.join(filter(str.isdigit, c.get('phone', '')))
        for c in customers if c.get('phone') and ''.join(filter(str.isdigit, c.get('phone', '')))
    ))
    
    if not emails and not phones:
        return customers
    
    # key -> date_of_birth string (key can be email or phone)
    dob_by_email = {}
    dob_by_phone = {}
    
    try:
        # === 1. Check tax_wizard_sessions by email ===
        if emails:
            wizard_cursor = db.tax_wizard_sessions.find(
                {'personal_info.email': {'$in': emails}},
                {'personal_info.email': 1, 'personal_info.date_of_birth': 1, 'personal_info.phone': 1, '_id': 0}
            )
            async for doc in wizard_cursor:
                pi = doc.get('personal_info', {})
                email = (pi.get('email') or '').strip().lower()
                dob = pi.get('date_of_birth')
                phone = ''.join(filter(str.isdigit, pi.get('phone', '') or ''))
                if dob:
                    if email:
                        dob_by_email[email] = dob
                    if phone:
                        dob_by_phone[phone] = dob
        
        # === 2. Check users collection by email and phone ===
        or_conditions = []
        if emails:
            or_conditions.append({'email': {'$in': emails}})
        if phones:
            or_conditions.append({'phone': {'$in': phones}})
        
        if or_conditions:
            users_cursor = db.users.find(
                {'$or': or_conditions},
                {'email': 1, 'phone': 1, 'id': 1, 'date_of_birth': 1, '_id': 0}
            )
            email_to_uid = {}
            async for u in users_cursor:
                ue = (u.get('email') or '').strip().lower()
                uid = u.get('id')
                uphone = ''.join(filter(str.isdigit, u.get('phone', '') or ''))
                udob = u.get('date_of_birth')
                
                # If user has DOB directly, use it
                if udob:
                    dob_str = str(udob)[:10] if hasattr(udob, 'strftime') else str(udob)
                    if ue and ue not in dob_by_email:
                        dob_by_email[ue] = dob_str
                    if uphone and uphone not in dob_by_phone:
                        dob_by_phone[uphone] = dob_str
                
                # Map email/phone to user_id for profile lookup
                if uid:
                    if ue:
                        email_to_uid[ue] = uid
                    if uphone:
                        email_to_uid[f'phone:{uphone}'] = uid
            
            # Check client_profiles for remaining users
            remaining_uids = [uid for key, uid in email_to_uid.items() 
                            if (key.startswith('phone:') and key[6:] not in dob_by_phone) or
                               (not key.startswith('phone:') and key not in dob_by_email)]
            
            if remaining_uids:
                profiles_cursor = db.client_profiles.find(
                    {'user_id': {'$in': remaining_uids}},
                    {'user_id': 1, 'date_of_birth': 1, '_id': 0}
                )
                uid_to_dob = {}
                async for p in profiles_cursor:
                    uid = p.get('user_id')
                    dob = p.get('date_of_birth')
                    if uid and dob:
                        dob_str = str(dob)[:10] if hasattr(dob, 'strftime') else str(dob)
                        uid_to_dob[uid] = dob_str
                
                for key, uid in email_to_uid.items():
                    if uid in uid_to_dob:
                        if key.startswith('phone:'):
                            phone_key = key[6:]
                            if phone_key not in dob_by_phone:
                                dob_by_phone[phone_key] = uid_to_dob[uid]
                        else:
                            if key not in dob_by_email:
                                dob_by_email[key] = uid_to_dob[uid]
        
        # === 3. Calculate age and attach to customers ===
        today = datetime.now().date()
        for c in customers:
            c_email = (c.get('email') or '').strip().lower()
            c_phone = ''.join(filter(str.isdigit, c.get('phone', '') or ''))
            
            # Try email first, then phone
            dob_str = dob_by_email.get(c_email) or dob_by_phone.get(c_phone)
            
            if dob_str:
                try:
                    # Handle datetime objects
                    if hasattr(dob_str, 'strftime'):
                        dob_date = dob_str.date() if hasattr(dob_str, 'date') else dob_str
                    elif isinstance(dob_str, str):
                        dob_str = dob_str[:10]  # Take only date part
                        if '-' in dob_str:
                            dob_date = datetime.strptime(dob_str, '%Y-%m-%d').date()
                        elif '/' in dob_str:
                            dob_date = datetime.strptime(dob_str, '%m/%d/%Y').date()
                        else:
                            continue
                    else:
                        continue
                    
                    age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
                    c['dateOfBirth'] = str(dob_str)[:10]
                    c['age'] = age
                except (ValueError, TypeError):
                    pass
    
    except Exception as e:
        logger.error(f"Error enriching customers with age: {e}")
    
    return customers


@merchant_router.get('/vault/customers/age-stats')
async def get_age_stats(
    authorization: Optional[str] = Header(None)
):
    """
    Get age distribution statistics for vault customers.
    Returns count of customers in each age bracket.
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        # Get all customers
        cursor = merchant_service.db.vault_customers.find({}, {'email': 1, '_id': 0})
        all_customers = await cursor.to_list(length=5000)
        
        # Enrich with age
        enriched = await _enrich_customers_with_age(merchant_service.db, all_customers)
        
        brackets = {
            '18-25': 0,
            '26-40': 0,
            '41-55': 0,
            '56-65': 0,
            '65+': 0,
            'unknown': 0,
        }
        
        for c in enriched:
            age = c.get('age')
            if age is None:
                brackets['unknown'] += 1
            elif age <= 25:
                brackets['18-25'] += 1
            elif age <= 40:
                brackets['26-40'] += 1
            elif age <= 55:
                brackets['41-55'] += 1
            elif age <= 65:
                brackets['56-65'] += 1
            else:
                brackets['65+'] += 1
        
        return {
            'success': True,
            'brackets': brackets,
            'total': len(enriched),
            'withAge': sum(1 for c in enriched if c.get('age') is not None),
        }
    except Exception as e:
        logger.error(f"Age stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.get('/vault/customers/search')
async def search_customers(
    q: Optional[str] = Query(None, description="Search query (name, email, phone)"),
    status: Optional[str] = Query(None, description="Subscription status filter"),
    plan_id: Optional[str] = Query(None, description="Filter by plan ID"),
    age_min: Optional[int] = Query(None, description="Minimum age filter"),
    age_max: Optional[int] = Query(None, description="Maximum age filter"),
    limit: int = Query(100, le=2000),
    skip: int = Query(0),
    authorization: Optional[str] = Header(None)
):
    """
    Search and filter vault customers
    
    - q: Search by name, email, or phone
    - status: Filter by subscription status (active, paused, cancelled, none)
    - plan_id: Filter by plan ID
    - age_min: Minimum age (inclusive)
    - age_max: Maximum age (inclusive)
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        query = {}
        
        # Text search
        if q:
            query['$or'] = [
                {'firstName': {'$regex': q, '$options': 'i'}},
                {'lastName': {'$regex': q, '$options': 'i'}},
                {'email': {'$regex': q, '$options': 'i'}},
                {'phone': {'$regex': q, '$options': 'i'}},
            ]
        
        # Status filter
        if status:
            if status == 'none':
                query['subscriptionStatus'] = {'$in': [None, 'none', '']}
            elif status == 'pending':
                # Clients imported without bank data
                query['$and'] = query.get('$and', [])
                query['$and'].append({
                    '$or': [
                        {'pendingBankData': True},
                        {'vaultStatus': 'pending'},
                    ]
                })
            elif status == 'unknown':
                query['subscriptionStatus'] = 'unknown'
            else:
                query['subscriptionStatus'] = status
        
        # Plan filter
        if plan_id:
            # Get plan name first
            if plans_service:
                plan = await plans_service.get_plan_by_id(plan_id)
                if plan:
                    query['planName'] = plan['name']
        
        # When age filter is active, we need to fetch more and filter post-enrichment
        fetch_limit = limit
        if age_min is not None or age_max is not None:
            # Fetch all matching to apply age filter post-enrichment
            fetch_limit = 5000
        
        # Execute query
        cursor = merchant_service.db.vault_customers.find(query).skip(0 if (age_min or age_max) else skip).limit(fetch_limit).sort('createdAt', -1)
        customers = await cursor.to_list(fetch_limit)
        
        # Get total count (pre-age-filter)
        total = await merchant_service.db.vault_customers.count_documents(query)
        
        # Format results
        for c in customers:
            c['_id'] = str(c['_id'])
            c['id'] = c.get('id', str(c['_id']))
        
        # Enrich with age data
        customers = await _enrich_customers_with_age(merchant_service.db, customers)
        
        # Apply age filter if specified
        if age_min is not None or age_max is not None:
            filtered = []
            for c in customers:
                age = c.get('age')
                if age is None:
                    continue  # Skip customers without age data when filtering by age
                if age_min is not None and age < age_min:
                    continue
                if age_max is not None and age > age_max:
                    continue
                filtered.append(c)
            
            total = len(filtered)
            customers = filtered[skip:skip + limit]
        
        return {
            'success': True,
            'customers': customers,
            'total': total,
            'limit': limit,
            'skip': skip
        }
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.post('/transactions/query')
async def query_customer_transactions(
    request: QueryTransactionsRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Query transaction history from Merchant One
    
    Returns list of transactions for a customer or date range.
    """
    await _verify_admin(authorization)
    
    result = await query_transactions(
        customer_vault_id=request.customerVaultId,
        start_date=request.startDate,
        end_date=request.endDate,
        transaction_type=request.transactionType,
        condition=request.condition,
        limit=request.limit
    )
    
    return result


@merchant_router.get('/subscription/{subscription_id}/info')
async def get_subscription_details(
    subscription_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get detailed subscription info from Merchant One"""
    await _verify_admin(authorization)
    
    result = await get_subscription_info(subscription_id)
    return result


@merchant_router.get('/vault/customers/export/csv')
async def export_customers_csv(
    status: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Export customers to CSV file"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        query = {}
        if status and status != 'all':
            query['subscriptionStatus'] = status
        
        cursor = merchant_service.db.vault_customers.find(query).sort('createdAt', -1)
        customers = await cursor.to_list(1000)
        
        csv_content = generate_customers_csv(customers)
        
        from fastapi.responses import Response
        return Response(
            content=csv_content,
            media_type='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename="clientes_vault_{datetime.now().strftime("%Y%m%d")}.csv"'
            }
        )
        
    except Exception as e:
        logger.error(f"Export CSV error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.get('/vault/customers/export/excel')
async def export_customers_excel(
    status: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Export customers to Excel file"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        query = {}
        if status and status != 'all':
            query['subscriptionStatus'] = status
        
        cursor = merchant_service.db.vault_customers.find(query).sort('createdAt', -1)
        customers = await cursor.to_list(1000)
        
        excel_base64 = generate_customers_excel(customers)
        
        if excel_base64:
            import base64
            excel_bytes = base64.b64decode(excel_base64)
            
            from fastapi.responses import Response
            return Response(
                content=excel_bytes,
                media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers={
                    'Content-Disposition': f'attachment; filename="clientes_vault_{datetime.now().strftime("%Y%m%d")}.xlsx"'
                }
            )
        else:
            # Fallback to CSV
            csv_content = generate_customers_csv(customers)
            from fastapi.responses import Response
            return Response(
                content=csv_content,
                media_type='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename="clientes_vault_{datetime.now().strftime("%Y%m%d")}.csv"'
                }
            )
        
    except Exception as e:
        logger.error(f"Export Excel error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.post('/subscriptions/bulk/pause')
async def bulk_pause(
    request: BulkActionRequest,
    authorization: Optional[str] = Header(None)
):
    """Pause multiple subscriptions at once"""
    await _verify_admin(authorization)
    
    if not request.subscriptionIds:
        raise HTTPException(status_code=400, detail="No subscriptions provided")
    
    result = await bulk_pause_subscriptions(request.subscriptionIds)
    
    # Update local database
    if result.get('successCount', 0) > 0 and merchant_service is not None and merchant_service.db is not None:
        successful_ids = [r['subscriptionId'] for r in result.get('results', []) if r.get('success')]
        if successful_ids:
            await merchant_service.db.vault_customers.update_many(
                {'subscriptionId': {'$in': successful_ids}},
                {'$set': {'subscriptionStatus': 'paused', 'updatedAt': datetime.utcnow()}}
            )
    
    return result


@merchant_router.post('/subscriptions/bulk/resume')
async def bulk_resume(
    request: BulkActionRequest,
    authorization: Optional[str] = Header(None)
):
    """Resume multiple subscriptions at once"""
    await _verify_admin(authorization)
    
    if not request.subscriptionIds:
        raise HTTPException(status_code=400, detail="No subscriptions provided")
    
    result = await bulk_resume_subscriptions(request.subscriptionIds)
    
    # Update local database
    if result.get('successCount', 0) > 0 and merchant_service is not None and merchant_service.db is not None:
        successful_ids = [r['subscriptionId'] for r in result.get('results', []) if r.get('success')]
        if successful_ids:
            await merchant_service.db.vault_customers.update_many(
                {'subscriptionId': {'$in': successful_ids}},
                {'$set': {'subscriptionStatus': 'active', 'updatedAt': datetime.utcnow()}}
            )
    
    return result


@merchant_router.post('/subscriptions/bulk/cancel')
async def bulk_cancel(
    request: BulkActionRequest,
    authorization: Optional[str] = Header(None)
):
    """Cancel multiple subscriptions at once"""
    await _verify_admin(authorization)
    
    if not request.subscriptionIds:
        raise HTTPException(status_code=400, detail="No subscriptions provided")
    
    result = await bulk_cancel_subscriptions(request.subscriptionIds)
    
    # Update local database
    if result.get('successCount', 0) > 0 and merchant_service is not None and merchant_service.db is not None:
        successful_ids = [r['subscriptionId'] for r in result.get('results', []) if r.get('success')]
        if successful_ids:
            await merchant_service.db.vault_customers.update_many(
                {'subscriptionId': {'$in': successful_ids}},
                {'$set': {'subscriptionStatus': 'cancelled', 'subscriptionId': None, 'updatedAt': datetime.utcnow()}}
            )
    
    return result


@merchant_router.put('/subscription/{subscription_id}/amount')
async def update_subscription_amount(
    subscription_id: str,
    new_amount: float = Query(..., gt=0),
    vault_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Update the amount of an existing subscription"""
    await _verify_admin(authorization)
    
    result = await update_subscription(subscription_id, new_amount=new_amount)
    
    # Update local database
    if result.get('success') and vault_id and merchant_service is not None and merchant_service.db is not None:
        await merchant_service.db.vault_customers.update_one(
            {'customerVaultId': vault_id},
            {'$set': {'planAmount': new_amount, 'updatedAt': datetime.utcnow()}}
        )
    
    return {
        'success': result.get('success', False),
        'subscriptionId': subscription_id,
        'newAmount': new_amount,
        'responseText': result.get('responseText', ''),
        'error': result.get('error') if not result.get('success') else None
    }


@merchant_router.get('/plans/{plan_id}/customers')
async def get_plan_customers(
    plan_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all customers using a specific plan"""
    await _verify_admin(authorization)
    
    if not plans_service or not merchant_service or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Services not available")
    
    try:
        # Get plan
        plan = await plans_service.get_plan_by_id(plan_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        
        # Find customers with this plan
        cursor = merchant_service.db.vault_customers.find({
            'planName': plan['name']
        }).sort('createdAt', -1)
        
        customers = await cursor.to_list(500)
        
        for c in customers:
            c['_id'] = str(c['_id'])
        
        # Calculate stats
        total_customers = len(customers)
        active_count = sum(1 for c in customers if c.get('subscriptionStatus') == 'active')
        monthly_revenue = sum(
            c.get('planAmount', 0) 
            for c in customers 
            if c.get('subscriptionStatus') == 'active'
        )
        
        return {
            'success': True,
            'plan': plan,
            'customers': customers,
            'stats': {
                'totalCustomers': total_customers,
                'activeCustomers': active_count,
                'monthlyRevenue': round(monthly_revenue, 2)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get plan customers error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SCHEDULED BATCH ENDPOINTS ====================

from scheduled_batch_service import (
    ScheduledBatchService,
    ScheduledBatchProcessor,
    CreateScheduledBatchRequest,
    BatchStatus,
    init_scheduled_batch_service,
    get_scheduled_batch_service,
    get_scheduled_batch_processor
)

# Service instances - will be set by server.py
scheduled_batch_svc: Optional[ScheduledBatchService] = None
scheduled_batch_proc: Optional[ScheduledBatchProcessor] = None


def set_scheduled_batch_service(service: ScheduledBatchService, processor: Optional[ScheduledBatchProcessor] = None):
    """Set the scheduled batch service instances"""
    global scheduled_batch_svc, scheduled_batch_proc
    scheduled_batch_svc = service
    scheduled_batch_proc = processor
    logger.info("✅ Scheduled Batch service set")


class ScheduledBatchCreateRequest(BaseModel):
    """Request to create a scheduled batch"""
    name: str
    customers: List[dict]
    customersPerCycle: int = 3
    intervalMinutes: int = 60
    workingHoursOnly: bool = True
    workingHourStart: int = 8
    workingHourEnd: int = 18


class UpdateBatchScheduleRequest(BaseModel):
    """Request to update batch schedule settings"""
    customersPerCycle: Optional[int] = None
    intervalMinutes: Optional[int] = None
    workingHoursOnly: Optional[bool] = None
    workingHourStart: Optional[int] = None
    workingHourEnd: Optional[int] = None


@merchant_router.post('/scheduled-batch/create')
async def create_scheduled_batch(
    request: ScheduledBatchCreateRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Create a scheduled batch for gradual customer upload
    
    This allows uploading large numbers of customers while processing
    them slowly to avoid rate limits and fraud detection.
    """
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    if not request.customers:
        raise HTTPException(status_code=400, detail="No customers provided")
    
    if len(request.customers) > 1000:
        raise HTTPException(status_code=400, detail="Maximum 1000 customers per batch")
    
    result = await scheduled_batch_svc.create_batch(
        name=request.name,
        customers=request.customers,
        customers_per_cycle=request.customersPerCycle,
        interval_minutes=request.intervalMinutes,
        working_hours_only=request.workingHoursOnly,
        working_hour_start=request.workingHourStart,
        working_hour_end=request.workingHourEnd
    )
    
    return result


@merchant_router.get('/scheduled-batch/list')
async def list_scheduled_batches(
    status: Optional[str] = Query(None, description="Filter by status"),
    authorization: Optional[str] = Header(None)
):
    """Get list of all scheduled batches"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    batches = await scheduled_batch_svc.get_batches(status=status)
    stats = await scheduled_batch_svc.get_stats()
    
    return {
        'success': True,
        'batches': batches,
        'stats': stats
    }


@merchant_router.get('/scheduled-batch/{batch_id}')
async def get_scheduled_batch(
    batch_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get details of a specific batch"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    batch = await scheduled_batch_svc.get_batch(batch_id)
    
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Get customers
    customers = await scheduled_batch_svc.get_batch_customers(batch_id)
    
    return {
        'success': True,
        'batch': batch,
        'customers': customers
    }


@merchant_router.get('/scheduled-batch/{batch_id}/customers')
async def get_batch_customers(
    batch_id: str,
    status: Optional[str] = Query(None, description="Filter by customer status"),
    authorization: Optional[str] = Header(None)
):
    """Get customers in a batch with optional status filter"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    customers = await scheduled_batch_svc.get_batch_customers(batch_id, status=status)
    
    return {
        'success': True,
        'customers': customers,
        'count': len(customers)
    }


@merchant_router.post('/scheduled-batch/{batch_id}/pause')
async def pause_scheduled_batch(
    batch_id: str,
    authorization: Optional[str] = Header(None)
):
    """Pause a running batch"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    result = await scheduled_batch_svc.pause_batch(batch_id)
    return result


@merchant_router.post('/scheduled-batch/{batch_id}/resume')
async def resume_scheduled_batch(
    batch_id: str,
    authorization: Optional[str] = Header(None)
):
    """Resume a paused batch"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    result = await scheduled_batch_svc.resume_batch(batch_id)
    return result


@merchant_router.post('/scheduled-batch/{batch_id}/cancel')
async def cancel_scheduled_batch(
    batch_id: str,
    authorization: Optional[str] = Header(None)
):
    """Cancel a batch and remove pending customers"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    result = await scheduled_batch_svc.cancel_batch(batch_id)
    return result


@merchant_router.delete('/scheduled-batch/{batch_id}')
async def delete_scheduled_batch(
    batch_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a batch completely"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    result = await scheduled_batch_svc.delete_batch(batch_id)
    return result


@merchant_router.put('/scheduled-batch/{batch_id}/schedule')
async def update_batch_schedule(
    batch_id: str,
    request: UpdateBatchScheduleRequest,
    authorization: Optional[str] = Header(None)
):
    """Update the schedule settings of a batch"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    # Build update dict with non-null values
    update_data = {'updatedAt': datetime.utcnow()}
    
    if request.customersPerCycle is not None:
        update_data['customersPerCycle'] = request.customersPerCycle
    if request.intervalMinutes is not None:
        update_data['intervalMinutes'] = request.intervalMinutes
    if request.workingHoursOnly is not None:
        update_data['workingHoursOnly'] = request.workingHoursOnly
    if request.workingHourStart is not None:
        update_data['workingHourStart'] = request.workingHourStart
    if request.workingHourEnd is not None:
        update_data['workingHourEnd'] = request.workingHourEnd
    
    result = await scheduled_batch_svc.batches_collection.update_one(
        {'id': batch_id},
        {'$set': update_data}
    )
    
    if result.modified_count > 0:
        batch = await scheduled_batch_svc.get_batch(batch_id)
        return {'success': True, 'batch': batch}
    
    return {'success': False, 'error': 'Batch not found'}


@merchant_router.post('/scheduled-batch/{batch_id}/process-now')
async def process_batch_now(
    batch_id: str,
    authorization: Optional[str] = Header(None)
):
    """Manually trigger processing of a batch (for testing)"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_proc:
        raise HTTPException(status_code=500, detail="Batch processor not initialized")
    
    result = await scheduled_batch_proc.process_batch_now(batch_id)
    return result


@merchant_router.get('/scheduled-batch/stats')
async def get_scheduled_batch_stats(
    authorization: Optional[str] = Header(None)
):
    """Get overall scheduled batch statistics"""
    await _verify_admin(authorization)
    
    if not scheduled_batch_svc:
        raise HTTPException(status_code=500, detail="Scheduled batch service not initialized")
    
    stats = await scheduled_batch_svc.get_stats()
    return {'success': True, **stats}


# ==================== ACH AUTHORIZATION DOCUMENT ENDPOINTS ====================

from ach_authorization_service import (
    ACHAuthorizationService,
    init_ach_auth_service,
    get_ach_auth_service
)

# Service instance - will be set by server.py
ach_auth_svc: Optional[ACHAuthorizationService] = None


def set_ach_auth_service(service: ACHAuthorizationService):
    """Set the ACH authorization service instance"""
    global ach_auth_svc
    ach_auth_svc = service
    logger.info("✅ ACH Authorization service set")


class GenerateAuthorizationRequest(BaseModel):
    """Request to generate authorization document"""
    customerVaultId: str
    # Customer data - optional if we can get from DB
    customer: Optional[dict] = None
    # Bank data - optional, will use masked data
    bank: Optional[dict] = None
    # Subscription data
    subscription: Optional[dict] = None


@merchant_router.post('/authorization/generate')
async def generate_authorization_document(
    request: GenerateAuthorizationRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Generate ACH authorization/consent document for a customer
    
    Returns the document ID and download URL.
    The PDF contains customer info, bank details (masked), and subscription terms.
    """
    await _verify_admin(authorization)
    
    if not ach_auth_svc:
        raise HTTPException(status_code=500, detail="ACH authorization service not initialized")
    
    # Get customer data from database if not provided
    customer_data = request.customer
    bank_data = request.bank
    subscription_data = request.subscription
    
    if not customer_data and merchant_service and merchant_service.db is not None:
        customer = await merchant_service.db.vault_customers.find_one(
            {'customerVaultId': request.customerVaultId}
        )
        if customer:
            customer_data = {
                'firstName': customer.get('firstName', ''),
                'lastName': customer.get('lastName', ''),
                'email': customer.get('email', ''),
                'phone': customer.get('phone', ''),
                'address1': customer.get('address1', ''),
                'city': customer.get('city', ''),
                'state': customer.get('state', ''),
                'postalCode': customer.get('postalCode', ''),
            }
            bank_data = {
                'checkName': f"{customer.get('firstName', '')} {customer.get('lastName', '')}",
                'maskedAccount': customer.get('maskedAccount', '****'),
                'routing': '',  # Don't expose full routing
                'accountType': 'checking',
            }
            subscription_data = {
                'planName': customer.get('planName', 'Plan de Pago'),
                'amount': customer.get('planAmount', 0),
                'dayFrequency': customer.get('dayFrequency', 30),
                'subscriptionId': customer.get('subscriptionId'),
            }
    
    if not customer_data:
        raise HTTPException(status_code=400, detail="Customer data not found")
    
    if not bank_data:
        bank_data = {'checkName': '', 'maskedAccount': '****', 'accountType': 'checking'}
    
    if not subscription_data:
        subscription_data = {'planName': 'Plan de Pago', 'amount': 0, 'dayFrequency': 30}
    
    result = await ach_auth_svc.generate_and_save_authorization(
        customer_vault_id=request.customerVaultId,
        customer_data=customer_data,
        bank_data=bank_data,
        subscription_data=subscription_data
    )
    
    return result


@merchant_router.get('/authorization/{auth_id}/download')
async def download_authorization_document(
    auth_id: str,
    authorization: Optional[str] = Header(None)
):
    """Download an ACH authorization PDF document"""
    await _verify_admin(authorization)
    
    if not ach_auth_svc:
        raise HTTPException(status_code=500, detail="ACH authorization service not initialized")
    
    pdf_bytes = await ach_auth_svc.get_pdf_bytes(auth_id)
    
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Authorization document not found")
    
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={
            'Content-Disposition': f'attachment; filename="autorizacion_ach_{auth_id}.pdf"'
        }
    )


@merchant_router.get('/authorization/customer/{vault_id}')
async def get_customer_authorizations(
    vault_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all authorization documents for a customer"""
    await _verify_admin(authorization)
    
    if not ach_auth_svc:
        raise HTTPException(status_code=500, detail="ACH authorization service not initialized")
    
    authorizations = await ach_auth_svc.get_authorizations_for_customer(vault_id)
    
    # Format for response
    for auth in authorizations:
        if '_id' in auth:
            auth['_id'] = str(auth['_id'])
        auth['downloadUrl'] = f"/api/merchant-one/authorization/{auth['id']}/download"
    
    return {
        'success': True,
        'authorizations': authorizations,
        'count': len(authorizations)
    }


@merchant_router.post('/authorization/generate-preview')
async def generate_authorization_preview(
    customer: dict = Body(...),
    bank: dict = Body(...),
    subscription: dict = Body(...),
    authorization: Optional[str] = Header(None)
):
    """
    Generate a preview authorization PDF without saving
    
    Returns the PDF as base64 for immediate preview/download.
    """
    await _verify_admin(authorization)
    
    if not ach_auth_svc:
        raise HTTPException(status_code=500, detail="ACH authorization service not initialized")
    
    try:
        pdf_bytes = ach_auth_svc.generate_pdf_on_demand(
            customer_data=customer,
            bank_data=bank,
            subscription_data=subscription
        )
        
        import base64
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return {
            'success': True,
            'pdfBase64': pdf_base64,
            'mimeType': 'application/pdf'
        }
        
    except Exception as e:
        logger.error(f"Error generating preview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DATABASE SYNC ENDPOINTS ====================

@merchant_router.post('/vault/sync-from-merchant')
async def sync_from_merchant_one(
    authorization: Optional[str] = Header(None)
):
    """
    Sync customers from Merchant One to local database
    
    This queries Merchant One for all vault customers and imports them
    into the local database, updating existing records.
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Merchant service not available")
    
    try:
        # Query Merchant One for all customers
        import httpx
        import os
        
        api_url = "https://secure.nmi.com/api/query.php"
        security_key = os.environ.get('MERCHANT_ONE_SECURITY_KEY', '')
        
        if not security_key:
            return {'success': False, 'error': 'No se encontró MERCHANT_ONE_SECURITY_KEY'}
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(api_url, data={
                'security_key': security_key,
                'report_type': 'customer_vault',
            })
        
        if response.status_code != 200:
            return {'success': False, 'error': 'Failed to query Merchant One'}
        
        # Parse XML response
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        
        imported = 0
        updated = 0
        errors = []
        
        for customer in root.findall('.//customer_vault'):
            try:
                vault_id = customer.findtext('customer_vault_id')
                if not vault_id:
                    continue
                
                # Check if exists locally
                existing = await merchant_service.db.vault_customers.find_one(
                    {'customerVaultId': vault_id}
                )
                
                customer_data = {
                    'customerVaultId': vault_id,
                    'firstName': customer.findtext('first_name', ''),
                    'lastName': customer.findtext('last_name', ''),
                    'email': customer.findtext('email', ''),
                    'phone': customer.findtext('phone', ''),
                    'address1': customer.findtext('address_1', ''),
                    'city': customer.findtext('city', ''),
                    'state': customer.findtext('state', ''),
                    'postalCode': customer.findtext('postal_code', ''),
                    'country': customer.findtext('country', 'US'),
                    'vaultStatus': 'active',
                    'syncedFromMerchant': True,
                    'lastSyncAt': datetime.utcnow(),
                }
                
                # Check for active subscription
                billing = customer.find('.//billing')
                if billing is not None:
                    sub_id = billing.findtext('subscription_id')
                    if sub_id:
                        customer_data['subscriptionId'] = sub_id
                        customer_data['subscriptionStatus'] = 'active'
                
                if existing:
                    await merchant_service.db.vault_customers.update_one(
                        {'customerVaultId': vault_id},
                        {'$set': customer_data}
                    )
                    updated += 1
                else:
                    customer_data['createdAt'] = datetime.utcnow()
                    await merchant_service.db.vault_customers.insert_one(customer_data)
                    imported += 1
                    
            except Exception as e:
                errors.append(f"Error with vault {vault_id}: {str(e)}")
        
        return {
            'success': True,
            'imported': imported,
            'updated': updated,
            'errors': errors[:10] if errors else [],
            'totalErrors': len(errors)
        }
        
    except Exception as e:
        logger.error(f"Sync error: {e}")
        return {'success': False, 'error': str(e)}


@merchant_router.post('/vault/verify-with-merchant')
async def verify_customers_with_merchant(
    authorization: Optional[str] = Header(None)
):
    """
    Verify which local customers actually exist in Merchant One
    Returns list of valid and invalid customers
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Service not available")
    
    try:
        import os
        security_key = os.environ.get('MERCHANT_ONE_SECURITY_KEY', '')
        
        if not security_key:
            return {'success': False, 'error': 'No se encontró MERCHANT_ONE_SECURITY_KEY'}
        
        # Get all local customers
        cursor = merchant_service.db.vault_customers.find({})
        local_customers = await cursor.to_list(500)
        
        valid = []
        invalid = []
        
        import httpx
        api_url = "https://secure.nmi.com/api/query.php"
        
        async with httpx.AsyncClient(timeout=30) as client:
            for customer in local_customers:
                vault_id = customer.get('customerVaultId', '')
                
                # Skip obviously fake IDs
                if vault_id.startswith('MOCK_') or not vault_id:
                    invalid.append({
                        'vaultId': vault_id,
                        'name': f"{customer.get('firstName', '')} {customer.get('lastName', '')}",
                        'reason': 'Mock/Invalid ID'
                    })
                    continue
                
                # Query Merchant One
                try:
                    response = await client.post(api_url, data={
                        'security_key': security_key,
                        'report_type': 'customer_vault',
                        'customer_vault_id': vault_id,
                    })
                    
                    if 'customer_vault_id' in response.text and vault_id in response.text:
                        valid.append({
                            'vaultId': vault_id,
                            'name': f"{customer.get('firstName', '')} {customer.get('lastName', '')}"
                        })
                    else:
                        invalid.append({
                            'vaultId': vault_id,
                            'name': f"{customer.get('firstName', '')} {customer.get('lastName', '')}",
                            'reason': 'Not found in Merchant One'
                        })
                except:
                    invalid.append({
                        'vaultId': vault_id,
                        'name': f"{customer.get('firstName', '')} {customer.get('lastName', '')}",
                        'reason': 'Query failed'
                    })
        
        return {
            'success': True,
            'totalLocal': len(local_customers),
            'validInMerchant': len(valid),
            'invalidOrMissing': len(invalid),
            'valid': valid,
            'invalid': invalid
        }
        
    except Exception as e:
        logger.error(f"Verify error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CUSTOMER NOTES ENDPOINTS ====================

class CustomerNoteRequest(BaseModel):
    note: str
    noteType: Optional[str] = 'general'  # general, payment, communication, internal


@merchant_router.post('/vault/{vault_id}/notes')
async def add_customer_note(
    vault_id: str,
    request: CustomerNoteRequest,
    authorization: Optional[str] = Header(None)
):
    """Add a note to a customer"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        note = {
            'id': str(uuid.uuid4())[:8],
            'note': request.note,
            'noteType': request.noteType,
            'createdAt': datetime.utcnow(),
            'createdBy': 'admin'
        }
        
        result = await merchant_service.db.vault_customers.update_one(
            {'customerVaultId': vault_id},
            {'$push': {'notes': note}}
        )
        
        if result.modified_count > 0:
            return {'success': True, 'note': note}
        
        raise HTTPException(status_code=404, detail="Customer not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.get('/vault/{vault_id}/notes')
async def get_customer_notes(
    vault_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all notes for a customer"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        customer = await merchant_service.db.vault_customers.find_one(
            {'customerVaultId': vault_id},
            {'notes': 1}
        )
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        notes = customer.get('notes', [])
        # Sort by date descending
        notes.sort(key=lambda x: x.get('createdAt', datetime.min), reverse=True)
        
        return {'success': True, 'notes': notes}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.delete('/vault/{vault_id}/notes/{note_id}')
async def delete_customer_note(
    vault_id: str,
    note_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a specific note"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        result = await merchant_service.db.vault_customers.update_one(
            {'customerVaultId': vault_id},
            {'$pull': {'notes': {'id': note_id}}}
        )
        
        if result.modified_count > 0:
            return {'success': True, 'message': 'Note deleted'}
        
        return {'success': False, 'error': 'Note not found'}
        
    except Exception as e:
        logger.error(f"Error deleting note: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DUPLICATE/CLONE CUSTOMER ====================

@merchant_router.post('/vault/{vault_id}/duplicate')
async def duplicate_customer(
    vault_id: str,
    new_first_name: Optional[str] = Query(None),
    new_last_name: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """
    Create a copy of a customer (vault only, no subscription)
    Useful for family members or related accounts
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        # Get original customer
        original = await merchant_service.db.vault_customers.find_one(
            {'customerVaultId': vault_id}
        )
        
        if not original:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Prepare data for new vault (without bank details for security)
        customer_info = CustomerInfo(
            firstName=new_first_name or f"{original.get('firstName', '')} (Copia)",
            lastName=new_last_name or original.get('lastName', ''),
            email=original.get('email', ''),
            phone=original.get('phone', ''),
            company=original.get('company', ''),
            address1=original.get('address1', ''),
            address2=original.get('address2', ''),
            city=original.get('city', ''),
            state=original.get('state', ''),
            postalCode=original.get('postalCode', ''),
            country=original.get('country', 'US'),
        )
        
        return {
            'success': True,
            'message': 'Datos del cliente copiados. Complete la información bancaria para crear el nuevo vault.',
            'customerData': customer_info.dict(),
            'originalVaultId': vault_id,
            'requiresBankInfo': True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error duplicating: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CHANGE BILLING DATE ====================

class ChangeBillingDateRequest(BaseModel):
    newStartDate: str  # Format: YYYY-MM-DD
    
@merchant_router.post('/subscription/{subscription_id}/change-date')
async def change_subscription_billing_date(
    subscription_id: str,
    request: ChangeBillingDateRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Change the billing date of a subscription
    This updates the start_date in Merchant One
    """
    await _verify_admin(authorization)
    
    if merchant_service is None:
        raise HTTPException(status_code=500, detail="Merchant service not available")
    
    try:
        # Validate date format
        try:
            new_date = datetime.strptime(request.newStartDate, '%Y-%m-%d')
            formatted_date = new_date.strftime('%Y%m%d')
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
        # Call Merchant One to update
        import httpx
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://secure.nmi.com/api/transact.php",
                data={
                    'security_key': merchant_service.api_key,
                    'recurring': 'update_subscription',
                    'subscription_id': subscription_id,
                    'start_date': formatted_date,
                }
            )
        
        response_text = response.text
        
        if 'response=1' in response_text:
            # Update local database
            if merchant_service.db is not None:
                await merchant_service.db.vault_customers.update_one(
                    {'subscriptionId': subscription_id},
                    {'$set': {
                        'startDate': request.newStartDate,
                        'updatedAt': datetime.utcnow()
                    }}
                )
            
            return {
                'success': True,
                'message': f'Fecha de cobro cambiada a {request.newStartDate}',
                'subscriptionId': subscription_id,
                'newStartDate': request.newStartDate
            }
        else:
            return {
                'success': False,
                'error': 'Merchant One rejected the update',
                'responseText': response_text
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing date: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PAYMENT RETRY SYSTEM ====================

class RetryConfigRequest(BaseModel):
    enabled: bool = True
    maxRetries: int = 3
    retryIntervalDays: List[int] = [1, 3, 7]  # Retry after 1 day, 3 days, 7 days


@merchant_router.post('/vault/{vault_id}/retry-config')
async def set_retry_config(
    vault_id: str,
    request: RetryConfigRequest,
    authorization: Optional[str] = Header(None)
):
    """Configure automatic retry settings for a customer"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        retry_config = {
            'enabled': request.enabled,
            'maxRetries': request.maxRetries,
            'retryIntervalDays': request.retryIntervalDays,
            'currentRetryCount': 0,
            'lastFailedAt': None,
            'nextRetryAt': None,
        }
        
        result = await merchant_service.db.vault_customers.update_one(
            {'customerVaultId': vault_id},
            {'$set': {'retryConfig': retry_config}}
        )
        
        if result.modified_count > 0:
            return {'success': True, 'retryConfig': retry_config}
        
        raise HTTPException(status_code=404, detail="Customer not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting retry config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.post('/vault/{vault_id}/schedule-retry')
async def schedule_payment_retry(
    vault_id: str,
    retry_date: str = Query(..., description="Date for retry YYYY-MM-DD"),
    amount: Optional[float] = Query(None, description="Amount to charge"),
    authorization: Optional[str] = Header(None)
):
    """Schedule a manual payment retry for a failed payment"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        retry_dt = datetime.strptime(retry_date, '%Y-%m-%d')
        
        customer = await merchant_service.db.vault_customers.find_one(
            {'customerVaultId': vault_id}
        )
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        retry_record = {
            'id': str(uuid.uuid4())[:8],
            'scheduledFor': retry_dt,
            'amount': amount or customer.get('planAmount', 0),
            'status': 'pending',
            'createdAt': datetime.utcnow(),
        }
        
        await merchant_service.db.vault_customers.update_one(
            {'customerVaultId': vault_id},
            {
                '$push': {'scheduledRetries': retry_record},
                '$set': {'hasScheduledRetry': True}
            }
        )
        
        return {
            'success': True,
            'message': f'Reintento programado para {retry_date}',
            'retry': retry_record
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling retry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.get('/retries/pending')
async def get_pending_retries(
    authorization: Optional[str] = Header(None)
):
    """Get all pending payment retries"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        cursor = merchant_service.db.vault_customers.find(
            {'hasScheduledRetry': True},
            {'firstName': 1, 'lastName': 1, 'customerVaultId': 1, 'scheduledRetries': 1, 'planAmount': 1}
        )
        customers = await cursor.to_list(100)
        
        pending_retries = []
        for c in customers:
            for retry in c.get('scheduledRetries', []):
                if retry.get('status') == 'pending':
                    pending_retries.append({
                        'customerName': f"{c.get('firstName', '')} {c.get('lastName', '')}",
                        'vaultId': c.get('customerVaultId'),
                        'retryId': retry.get('id'),
                        'scheduledFor': retry.get('scheduledFor'),
                        'amount': retry.get('amount'),
                    })
        
        # Sort by date
        pending_retries.sort(key=lambda x: x.get('scheduledFor', datetime.max))
        
        return {
            'success': True,
            'pendingRetries': pending_retries,
            'count': len(pending_retries)
        }
        
    except Exception as e:
        logger.error(f"Error getting retries: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PAYMENT DASHBOARD ====================

@merchant_router.get('/payments/dashboard')
async def get_payments_dashboard(
    days: int = Query(30, le=365),
    authorization: Optional[str] = Header(None)
):
    """
    Get payment dashboard with statistics and recent activity
    """
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        db = merchant_service.db
        
        # Get date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get payment history from local records
        payments_cursor = db.payment_history.find({
            'createdAt': {'$gte': start_date}
        }).sort('createdAt', -1).limit(100)
        recent_payments = await payments_cursor.to_list(100)
        
        # Calculate stats
        total_collected = sum(p.get('amount', 0) for p in recent_payments if p.get('status') == 'success')
        total_failed = sum(p.get('amount', 0) for p in recent_payments if p.get('status') == 'failed')
        success_count = len([p for p in recent_payments if p.get('status') == 'success'])
        failed_count = len([p for p in recent_payments if p.get('status') == 'failed'])
        
        # Get upcoming charges (active subscriptions)
        active_subs = await db.vault_customers.find(
            {'subscriptionStatus': 'active'}
        ).to_list(500)
        
        upcoming_amount = sum(c.get('planAmount', 0) for c in active_subs)
        
        # Group by month for chart
        monthly_data = {}
        for p in recent_payments:
            if p.get('status') == 'success':
                month_key = p.get('createdAt', datetime.now()).strftime('%Y-%m')
                if month_key not in monthly_data:
                    monthly_data[month_key] = 0
                monthly_data[month_key] += p.get('amount', 0)
        
        return {
            'success': True,
            'period': f'Last {days} days',
            'stats': {
                'totalCollected': round(total_collected, 2),
                'totalFailed': round(total_failed, 2),
                'successCount': success_count,
                'failedCount': failed_count,
                'successRate': round(success_count / max(success_count + failed_count, 1) * 100, 1),
                'upcomingMonthlyRevenue': round(upcoming_amount, 2),
                'activeSubscriptions': len(active_subs),
            },
            'monthlyRevenue': monthly_data,
            'recentPayments': [{
                'id': str(p.get('_id', '')),
                'customerName': p.get('customerName', 'Unknown'),
                'amount': p.get('amount', 0),
                'status': p.get('status', 'unknown'),
                'date': p.get('createdAt'),
                'transactionId': p.get('transactionId', ''),
            } for p in recent_payments[:20]],
        }
        
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.post('/payments/record')
async def record_payment(
    vault_id: str = Body(...),
    amount: float = Body(...),
    status: str = Body(...),  # success, failed
    transaction_id: Optional[str] = Body(None),
    error_message: Optional[str] = Body(None),
    authorization: Optional[str] = Header(None)
):
    """Record a payment in the history"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        # Get customer info
        customer = await merchant_service.db.vault_customers.find_one(
            {'customerVaultId': vault_id}
        )
        
        payment_record = {
            'customerVaultId': vault_id,
            'customerName': f"{customer.get('firstName', '')} {customer.get('lastName', '')}" if customer else 'Unknown',
            'amount': amount,
            'status': status,
            'transactionId': transaction_id,
            'errorMessage': error_message,
            'createdAt': datetime.utcnow(),
        }
        
        await merchant_service.db.payment_history.insert_one(payment_record)
        
        return {'success': True, 'payment': payment_record}
        
    except Exception as e:
        logger.error(f"Error recording payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== REPORTS EXPORT ====================

@merchant_router.get('/reports/customers/csv')
async def export_customers_csv(
    status: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """Export customers to CSV"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        query = {}
        if status:
            query['subscriptionStatus'] = status
        
        cursor = merchant_service.db.vault_customers.find(query).sort('createdAt', -1)
        customers = await cursor.to_list(1000)
        
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            'Nombre', 'Apellido', 'Email', 'Teléfono', 'Dirección', 'Ciudad', 
            'Estado', 'CP', 'Plan', 'Monto', 'Estado Suscripción', 'Fecha Creación'
        ])
        
        for c in customers:
            writer.writerow([
                c.get('firstName', ''),
                c.get('lastName', ''),
                c.get('email', ''),
                c.get('phone', ''),
                c.get('address1', ''),
                c.get('city', ''),
                c.get('state', ''),
                c.get('postalCode', ''),
                c.get('planName', ''),
                c.get('planAmount', ''),
                c.get('subscriptionStatus', ''),
                c.get('createdAt', ''),
            ])
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type='text/csv',
            headers={'Content-Disposition': 'attachment; filename=clientes_merchant.csv'}
        )
        
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.get('/reports/payments/csv')
async def export_payments_csv(
    days: int = Query(30, le=365),
    authorization: Optional[str] = Header(None)
):
    """Export payment history to CSV"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        start_date = datetime.utcnow() - timedelta(days=days)
        
        cursor = merchant_service.db.payment_history.find({
            'createdAt': {'$gte': start_date}
        }).sort('createdAt', -1)
        payments = await cursor.to_list(5000)
        
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            'Fecha', 'Cliente', 'Monto', 'Estado', 'Transaction ID', 'Error'
        ])
        
        for p in payments:
            writer.writerow([
                p.get('createdAt', ''),
                p.get('customerName', ''),
                p.get('amount', ''),
                p.get('status', ''),
                p.get('transactionId', ''),
                p.get('errorMessage', ''),
            ])
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type='text/csv',
            headers={'Content-Disposition': f'attachment; filename=pagos_{days}dias.csv'}
        )
        
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@merchant_router.get('/reports/monthly-summary')
async def get_monthly_summary(
    year: int = Query(default=2026),
    month: int = Query(default=3, ge=1, le=12),
    authorization: Optional[str] = Header(None)
):
    """Get monthly summary report"""
    await _verify_admin(authorization)
    
    if merchant_service is None or merchant_service.db is None:
        raise HTTPException(status_code=500, detail="Database not available")
    
    try:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        db = merchant_service.db
        
        # Payments in period
        payments = await db.payment_history.find({
            'createdAt': {'$gte': start_date, '$lt': end_date}
        }).to_list(5000)
        
        # New customers in period
        new_customers = await db.vault_customers.count_documents({
            'createdAt': {'$gte': start_date, '$lt': end_date}
        })
        
        # Calculate stats
        successful = [p for p in payments if p.get('status') == 'success']
        failed = [p for p in payments if p.get('status') == 'failed']
        
        return {
            'success': True,
            'period': f'{year}-{month:02d}',
            'summary': {
                'totalRevenue': sum(p.get('amount', 0) for p in successful),
                'totalTransactions': len(payments),
                'successfulPayments': len(successful),
                'failedPayments': len(failed),
                'newCustomers': new_customers,
                'avgTransactionAmount': sum(p.get('amount', 0) for p in successful) / max(len(successful), 1),
            }
        }
        
    except Exception as e:
        logger.error(f"Summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TRANSACTION HISTORY ENDPOINTS ====================

@merchant_router.get('/transactions')
async def get_transactions(
    start_date: Optional[str] = Query(default=None, description="YYYYMMDD format"),
    end_date: Optional[str] = Query(default=None, description="YYYYMMDD format"),
    customer_vault_id: Optional[str] = Query(default=None),
    days: int = Query(default=90, ge=1, le=365),
    limit: int = Query(default=100, ge=1, le=500),
    authorization: Optional[str] = Header(None)
):
    """
    Get transaction history from NMI.
    Shows all payment charges with success/failure status.
    """
    await _verify_admin(authorization)
    
    if not merchant_service:
        raise HTTPException(status_code=503, detail="Merchant service not available")
    
    if not start_date:
        from datetime import datetime, timedelta
        start_date = (datetime.utcnow() - timedelta(days=days)).strftime('%Y%m%d')
    if not end_date:
        from datetime import datetime
        end_date = datetime.utcnow().strftime('%Y%m%d')
    
    transactions = await merchant_service.query_transactions(
        start_date=start_date,
        end_date=end_date,
        customer_vault_id=customer_vault_id,
        limit=limit,
    )
    
    # Compute summary stats
    successful = [t for t in transactions if t.get('status') == 'success']
    failed = [t for t in transactions if t.get('status') == 'failed']
    pending = [t for t in transactions if t.get('status') == 'pending']
    
    total_collected = sum(t.get('amount', 0) for t in successful)
    total_failed = sum(t.get('amount', 0) for t in failed)
    
    return {
        'transactions': transactions,
        'summary': {
            'total': len(transactions),
            'successful': len(successful),
            'failed': len(failed),
            'pending': len(pending),
            'totalCollected': round(total_collected, 2),
            'totalFailed': round(total_failed, 2),
            'successRate': round((len(successful) / max(len(transactions), 1)) * 100, 1),
        }
    }



# ==================== DUNNING ENDPOINTS ====================

@merchant_router.get('/dunning/events')
async def get_dunning_events(
    status: Optional[str] = Query(default='all'),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
    authorization: Optional[str] = Header(None)
):
    """Get dunning events with optional status filter."""
    await _verify_admin(authorization)
    
    if not dunning_service:
        raise HTTPException(status_code=503, detail="Dunning service not available")
    
    events = await dunning_service.get_events(status_filter=status, limit=limit, skip=skip)
    return {'events': events, 'total': len(events)}


@merchant_router.get('/dunning/stats')
async def get_dunning_stats(authorization: Optional[str] = Header(None)):
    """Get dunning statistics."""
    await _verify_admin(authorization)
    
    if not dunning_service:
        raise HTTPException(status_code=503, detail="Dunning service not available")
    
    stats = await dunning_service.get_stats()
    return stats


@merchant_router.post('/dunning/scan')
async def run_dunning_scan(authorization: Optional[str] = Header(None)):
    """Manually trigger a dunning detection scan."""
    await _verify_admin(authorization)
    
    if not dunning_service or not merchant_service:
        raise HTTPException(status_code=503, detail="Services not available")
    
    result = await dunning_service.detect_payment_issues(merchant_service)
    return result


@merchant_router.post('/dunning/{event_id}/dismiss')
async def dismiss_dunning_event(
    event_id: str,
    note: str = Body(default='', embed=True),
    authorization: Optional[str] = Header(None)
):
    """Dismiss a dunning event."""
    await _verify_admin(authorization)
    
    if not dunning_service:
        raise HTTPException(status_code=503, detail="Dunning service not available")
    
    success = await dunning_service.dismiss_event(event_id, note)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {'success': True, 'message': 'Evento descartado'}


@merchant_router.post('/dunning/{event_id}/note')
async def add_dunning_note(
    event_id: str,
    note: str = Body(..., embed=True),
    authorization: Optional[str] = Header(None)
):
    """Add a note to a dunning event."""
    await _verify_admin(authorization)
    
    if not dunning_service:
        raise HTTPException(status_code=503, detail="Dunning service not available")
    
    success = await dunning_service.add_note(event_id, note)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {'success': True, 'message': 'Nota agregada'}
