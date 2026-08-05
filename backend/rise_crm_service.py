import os
import httpx
import logging
import asyncio
from typing import Optional, Dict, List, Any
from datetime import datetime
from dotenv import load_dotenv
from rise_crm_models import (
    RiseCRMClient, RiseCRMProject, RiseCRMTask, 
    RiseCRMTicket, RiseCRMInvoice, RiseCRMPayment,
    RiseCRMSyncLog
)

load_dotenv()

logger = logging.getLogger(__name__)

class RiseCRMService:
    """Service for integrating with Rise CRM"""
    
    def __init__(self):
        self.base_url = os.getenv('RISE_CRM_URL', '')
        self.email = os.getenv('RISE_CRM_EMAIL', '')
        self.password = os.getenv('RISE_CRM_PASSWORD', '')
        self.api_token = os.getenv('RISE_CRM_API_TOKEN', '')
        self.sync_enabled = os.getenv('RISE_CRM_SYNC_ENABLED', 'false').lower() == 'true'
        
        self.session_cookie = None
        self.csrf_token = None
        
        # Custom User-Agent to avoid SiteGround ModSecurity blocking
        # SiteGround confirmed "Mozilla/5.0 (Windows NT" triggers CAPTCHA
        custom_headers = {
            'User-Agent': 'RossTaxApp/1.0 (Rise CRM Integration)'
        }
        self.client = httpx.AsyncClient(
            timeout=30.0, 
            follow_redirects=True,
            headers=custom_headers
        )
        
        auth_method = "API Token" if self.api_token else "Username/Password"
        logger.info(f"🔗 Rise CRM Service initialized - URL: {self.base_url}, Auth: {auth_method}")
    
    async def authenticate(self) -> bool:
        """Authenticate with Rise CRM and get session cookie"""
        try:
            logger.info("🔐 Authenticating with Rise CRM...")
            
            # Step 1: Get CSRF token from login page
            login_page_url = f"{self.base_url}/index.php/signin"
            response = await self.client.get(login_page_url)
            
            if response.status_code != 200:
                logger.error(f"❌ Failed to load login page: {response.status_code}")
                return False
            
            # Extract CSRF token from HTML (Rise CRM uses csrf_token)
            html_content = response.text
            csrf_start = html_content.find('name="csrf_token_name" value="')
            if csrf_start != -1:
                csrf_start += len('name="csrf_token_name" value="')
                csrf_end = html_content.find('"', csrf_start)
                csrf_token_name = html_content[csrf_start:csrf_end]
                
                csrf_val_start = html_content.find('name="csrf_test_name" value="')
                if csrf_val_start != -1:
                    csrf_val_start += len('name="csrf_test_name" value="')
                    csrf_val_end = html_content.find('"', csrf_val_start)
                    self.csrf_token = html_content[csrf_val_start:csrf_val_end]
                    logger.info(f"✅ CSRF token obtained: {self.csrf_token[:20]}...")
            
            # Step 2: Submit login form
            login_url = f"{self.base_url}/index.php/signin/authenticate"
            login_data = {
                "email": self.email,
                "password": self.password,
                "csrf_test_name": self.csrf_token if self.csrf_token else ""
            }
            
            response = await self.client.post(login_url, data=login_data)
            
            # Check if login was successful by looking at cookies or redirect
            if response.status_code in [200, 302]:
                # Store session cookies
                for cookie in response.cookies.jar:
                    if 'ci_session' in cookie.name or 'rise' in cookie.name.lower():
                        self.session_cookie = f"{cookie.name}={cookie.value}"
                        logger.info(f"✅ Session cookie obtained: {cookie.name}")
                
                if self.session_cookie:
                    logger.info("✅ Successfully authenticated with Rise CRM")
                    return True
                else:
                    logger.warning("⚠️ No session cookie found, but response was successful")
                    return True
            else:
                logger.error(f"❌ Login failed with status: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Authentication error: {str(e)}")
            return False
    
    async def ensure_authenticated(self):
        """Ensure we have a valid session, re-authenticate if needed"""
        # If we have API token, no need for session authentication
        if self.api_token:
            return True
        if not self.session_cookie:
            await self.authenticate()
    
    
    async def _call_rise_api(self, endpoint: str, method: str = "GET", data: dict = None, retry_count: int = 0) -> dict:
        """Call Rise CRM API with optimized authentication to avoid CAPTCHA triggers
        
        OPTIMIZATIONS TO AVOID SITEGROUND CAPTCHA:
        1. Uses ONLY Strategy 1 (authtoken header) - the one that works
        2. Adds delay between retries to avoid rate limiting
        3. Uses more legitimate headers
        4. Implements exponential backoff for network errors only
        5. Does NOT retry on 403 errors (CAPTCHA already triggered)
        """
        url = f"{self.base_url}{endpoint}"
        
        # Use RossTaxAPI plugin authentication (X-API-Token header)
        # The plugin uses its own token system stored in rosstax_api_tokens table
        headers = {
            'X-API-Token': self.api_token,
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'RossTaxApp/1.0 (Rise CRM Integration)',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
        
        timeout = httpx.Timeout(30.0, connect=10.0)
        
        try:
            # Add small delay between requests to avoid rate limiting
            if retry_count > 0:
                delay = min(2 ** retry_count, 10)  # Exponential backoff: 2, 4, 8, 10 seconds max
                logger.info(f"⏳ Waiting {delay}s before retry {retry_count}...")
                await asyncio.sleep(delay)
            
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
                logger.info(f"🔄 Calling Rise CRM API: {method} {endpoint}")
                
                if method == "GET":
                    response = await client.get(url, headers=headers)
                elif method == "POST":
                    response = await client.post(url, headers=headers, json=data)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, json=data)
                elif method == "DELETE":
                    response = await client.delete(url, headers=headers)
                
                # Check for CAPTCHA redirect (SiteGround specific)
                if 'sgcaptcha' in response.text.lower() or 'well-known/sgcaptcha' in response.text:
                    logger.error("🚫 CAPTCHA detected! SiteGround is blocking the request.")
                    logger.error("📋 Response preview: " + response.text[:200])
                    return {
                        'success': False, 
                        'error': 'CAPTCHA triggered - Too many requests or suspicious activity detected by SiteGround firewall',
                        'suggestion': 'Wait a few minutes before retrying, or contact SiteGround support'
                    }
                
                # Success!
                if 200 <= response.status_code < 300:
                    logger.info(f"✅ Request succeeded with status {response.status_code}")
                    try:
                        response_data = response.json()
                        logger.info(f"📋 Rise CRM response: {response_data}")
                        return {'success': True, 'data': response_data, 'status': response.status_code}
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to parse JSON: {str(e)}")
                        logger.info(f"📋 Raw text: {response.text[:500]}")
                        return {'success': True, 'data': {}, 'status': response.status_code}
                
                # 403 Forbidden - DO NOT RETRY (CAPTCHA likely triggered)
                if response.status_code == 403:
                    logger.error(f"❌ 403 Forbidden - CAPTCHA may be triggered or IP blocked")
                    logger.error(f"📋 Response: {response.text[:300]}")
                    return {
                        'success': False, 
                        'error': '403 Forbidden - Request blocked by firewall/CAPTCHA',
                        'suggestion': 'Contact SiteGround support to whitelist your IP or disable CAPTCHA for API routes'
                    }
                
                # Other client errors (400-499) - DO NOT RETRY
                if 400 <= response.status_code < 500:
                    logger.error(f"❌ Client error {response.status_code}: {response.text[:200]}")
                    return {'success': False, 'error': f'{response.status_code}: {response.text[:200]}'}
                
                # Server errors (500-599) - RETRY with backoff
                if response.status_code >= 500:
                    error_msg = f'{response.status_code}: {response.text[:200]}'
                    logger.error(f"❌ Server error: {error_msg}")
                    
                    # Retry up to 2 times for server errors
                    if retry_count < 2:
                        logger.info(f"🔄 Retrying due to server error (attempt {retry_count + 1}/2)...")
                        return await self._call_rise_api(endpoint, method, data, retry_count + 1)
                    
                    return {'success': False, 'error': error_msg}
                    
        except httpx.TimeoutException:
            error_msg = 'Request timeout'
            logger.error(f"❌ Timeout error")
            
            # Retry up to 2 times for timeouts
            if retry_count < 2:
                logger.info(f"🔄 Retrying due to timeout (attempt {retry_count + 1}/2)...")
                return await self._call_rise_api(endpoint, method, data, retry_count + 1)
            
            return {'success': False, 'error': error_msg}
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Unexpected error: {error_msg}")
            
            # Retry once for unexpected errors
            if retry_count < 1:
                logger.info(f"🔄 Retrying due to unexpected error (attempt {retry_count + 1}/1)...")
                return await self._call_rise_api(endpoint, method, data, retry_count + 1)
            
            return {'success': False, 'error': error_msg}
    
    # ============= CLIENT OPERATIONS =============
    
    async def search_clients(self, keyword: str = "") -> List[Dict]:
        """Search clients from Rise CRM by keyword"""
        logger.info(f"🔍 Searching clients with keyword: {keyword or 'all'}")
        # Use search endpoint as there's no list all endpoint
        result = await self._call_rise_api(f'/index.php/api/getClientsSearch/search/{keyword or "a"}', 'GET')
        if result and result.get('success'):
            data = result.get('data', {})
            logger.info(f"✅ Found clients")
            return [data] if isinstance(data, dict) else data if isinstance(data, list) else []
        return []
    
    async def get_client(self, client_id: int) -> Optional[Dict]:
        """Get a specific client by ID"""
        logger.info(f"👤 Fetching client ID: {client_id}")
        result = await self._call_rise_api(f'/index.php/api/clients/{client_id}', 'GET')
        if result and result.get('success'):
            return result.get('data')
        return None
    
    async def create_client(self, client: RiseCRMClient) -> Optional[Dict]:
        """Create a new client in Rise CRM using RossTaxAPI Plugin"""
        logger.info(f"➕ Creating client via RossTaxAPI: {client.email}")
        
        # RossTaxAPI format (from Api.php)
        client_data = {
            "company_name": client.company_name or f"{client.contact_firstname or ''} {client.contact_lastname or ''}".strip() or "Ross Tax Client",
            "type": "person",
            "phone": client.phone or "",
            "email": client.email or "",
            "address": client.address or "",
            "city": client.city or "",
            "state": client.state or "",
            "zip": client.zip or "",
            "country": client.country or "US",
        }
        
        # Use RossTaxAPI plugin endpoint instead of standard API
        result = await self._call_rise_api('/rosstax_api/api/create_client', 'POST', client_data)
        if result and result.get('success'):
            logger.info(f"✅ Client created successfully via RossTaxAPI: {client.email}")
            # Extract client ID from response
            if result.get('data') and result['data'].get('id'):
                result['rise_crm_id'] = result['data']['id']
        return result
    
    async def update_client(self, client_id: int, client: RiseCRMClient) -> Optional[Dict]:
        """Update an existing client in Rise CRM using Plugin REST API"""
        logger.info(f"🔄 Updating client ID: {client_id}")
        
        # Plugin API format
        client_data = {
            "company_name": client.company_name or f"{client.contact_firstname} {client.contact_lastname}",
            "owner_id": "1",
            "address": client.address or "",
            "city": client.city or "",
            "state": client.state or "",
            "zip": client.zip or "",
            "country": client.country or "US",
            "phone": client.phone or "",
            "website": "",
            "vat_number": client.tax_id or ""
        }
        
        result = await self._call_rise_api(f'/index.php/api/clients/{client_id}', 'PUT', client_data)
        if result and result.get('success'):
            logger.info(f"✅ Client updated successfully: {client_id}")
        return result
    
    # ============= PROJECT OPERATIONS =============
    
    async def create_project(self, project: RiseCRMProject) -> Optional[Dict]:
        """Create a project (Tax Season) for a client"""
        logger.info(f"📁 Creating project: {project.title}")
        
        project_data = {
            "title": project.title,
            "description": project.description,
            "client_id": str(project.client_id),
            "start_date": project.start_date.strftime("%Y-%m-%d") if project.start_date else None,
            "deadline": project.deadline.strftime("%Y-%m-%d") if project.deadline else None,
        }
        
        result = await self._call_rise_api('/index.php/api/projects', 'POST', project_data)
        if result and result.get('success'):
            logger.info(f"✅ Project created: {project.title}")
        return result
    
    # ============= TASK OPERATIONS =============
    
    async def create_task(self, title: str, project_id: int, description: str = "", assigned_to: int = 1, deadline: str = None) -> Optional[Dict]:
        """Create a task in Rise CRM"""
        logger.info(f"✅ Creating task: {title}")
        
        task_data = {
            "title": title,
            "description": description,
            "project_id": str(project_id),
            "assigned_to": str(assigned_to),
            "start_date": datetime.utcnow().strftime("%Y-%m-%d"),
        }
        
        if deadline:
            task_data["deadline"] = deadline
        
        result = await self._call_rise_api('/index.php/api/tasks', 'POST', task_data)
        if result and result.get('success'):
            logger.info(f"✅ Task created: {title}")
        return result
    
    # ============= TICKET OPERATIONS =============
    
    async def create_ticket(self, ticket: RiseCRMTicket) -> Optional[Dict]:
        """Create a support ticket"""
        logger.info(f"🎫 Creating ticket: {ticket.title}")
        
        ticket_data = {
            "title": ticket.title,
            "description": ticket.description,
            "client_id": ticket.client_id,
            "ticket_type_id": 1,  # General support
            "priority_id": 2 if ticket.priority == "medium" else 1,
            "status_id": 1  # New
        }
        
        result = await self._call_rise_api('/index.php/tickets/save', 'POST', ticket_data)
        if result and result.get('success'):
            logger.info(f"✅ Ticket created: {ticket.title}")
        return result
    
    # ============= INVOICE & PAYMENT OPERATIONS =============
    
    async def create_invoice(self, invoice: RiseCRMInvoice) -> Optional[Dict]:
        """Create an invoice for services"""
        logger.info(f"💰 Creating invoice for client: {invoice.client_id}")
        
        invoice_data = {
            "client_id": invoice.client_id,
            "bill_date": invoice.bill_date.strftime("%Y-%m-%d"),
            "due_date": invoice.due_date.strftime("%Y-%m-%d"),
            "invoice_value": invoice.invoice_value,
            "tax": invoice.tax,
            "total": invoice.total,
            "status": invoice.status,
            "note": invoice.note
        }
        
        result = await self._call_rise_api('/index.php/invoices/save', 'POST', invoice_data)
        if result and result.get('success'):
            logger.info(f"✅ Invoice created for client: {invoice.client_id}")
        return result
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

# Global instance
rise_crm_service = RiseCRMService()
