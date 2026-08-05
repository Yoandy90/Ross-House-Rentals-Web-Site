"""
Plaid Integration Routes - Bank account linking for bookkeeping module
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timedelta
import logging
import os
import jwt as pyjwt
import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plaid", tags=["plaid"])

db = None

def set_db(database):
    global db
    db = database

# Plaid client setup - reads env override from DB if available
async def get_plaid_env_from_db():
    """Get Plaid environment config from database (admin toggle)"""
    try:
        if db is not None:
            config = await db.admin_config.find_one({})
            if config:
                return (
                    config.get('PLAID_ENV', None),
                    config.get('PLAID_SECRET_OVERRIDE', None),
                    config.get('PLAID_CLIENT_ID_PRODUCTION', None),
                )
    except Exception as e:
        logger.error(f"Error reading Plaid config from DB: {e}")
    return None, None, None

def get_plaid_client(env_override=None, secret_override=None, client_id_override=None):
    plaid_env = env_override or os.getenv('PLAID_ENV', 'sandbox')
    
    # Choose the correct secret based on environment
    if plaid_env == 'production':
        host = plaid.Environment.Production
        secret = secret_override or os.getenv('PLAID_SECRET_PRODUCTION') or os.getenv('PLAID_SECRET')
        client_id = client_id_override or os.getenv('PLAID_CLIENT_ID')
    elif plaid_env == 'development':
        host = plaid.Environment.Sandbox  # SDK v20+ only has Sandbox/Production
        secret = os.getenv('PLAID_SECRET')
        client_id = os.getenv('PLAID_CLIENT_ID')
    else:
        host = plaid.Environment.Sandbox
        secret = os.getenv('PLAID_SECRET')
        client_id = os.getenv('PLAID_CLIENT_ID')

    configuration = plaid.Configuration(
        host=host,
        api_key={
            'clientId': client_id,
            'secret': secret,
        }
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)

async def get_smart_plaid_client():
    """Get Plaid client with DB config override support"""
    db_env, db_secret, db_client_id = await get_plaid_env_from_db()
    return get_plaid_client(env_override=db_env, secret_override=db_secret, client_id_override=db_client_id)


async def get_user_id(request: Request):
    """Get user ID from session token (DB lookup) with JWT fallback"""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth.replace('Bearer ', '')

    # Primary: session token lookup (used by mobile app)
    try:
        if db is not None:
            from bson import ObjectId
            session = await db.user_sessions.find_one({'session_token': token})
            if session:
                user_id = session.get('user_id')
                if user_id:
                    return str(user_id)
    except Exception as e:
        logger.debug(f"Session lookup failed: {e}")

    # Fallback: JWT decode (legacy)
    try:
        secret = os.getenv('JWT_SECRET_KEY', 'ross-tax-secret-key-2025-change-in-production')
        payload = pyjwt.decode(token, secret, algorithms=['HS256'])
        return payload.get('user_id') or payload.get('sub')
    except Exception:
        return None


@router.post('/create-link-token')
async def create_link_token(request: Request):
    """Create a Plaid Link token for the client to connect their bank"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        client = await get_smart_plaid_client()
        
        # Detect current Plaid environment for logging
        db_env, _, _ = await get_plaid_env_from_db()
        current_env = db_env or os.getenv('PLAID_ENV', 'sandbox')
        logger.info(f"🏦 Creating Plaid Link token for user {user_id} (env: {current_env})")

        # Webhook URL for automatic transaction updates from Plaid
        webhook_url = "https://app-nueva-production.up.railway.app/api/plaid/webhook"
        
        link_request = LinkTokenCreateRequest(
            products=[Products("transactions"), Products("auth")],
            client_name="Ross Tax Bookkeeping",
            country_codes=[CountryCode("US")],
            language="es",
            user=LinkTokenCreateRequestUser(client_user_id=str(user_id)),
            webhook=webhook_url,
        )

        response = client.link_token_create(link_request)
        logger.info(f"✅ Link token created successfully for user {user_id} (env: {current_env})")
        return {
            'success': True,
            'link_token': response['link_token'],
            'expiration': response['expiration'],
            'environment': current_env,
        }
    except plaid.ApiException as e:
        logger.error(f"Plaid link token error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")
    except Exception as e:
        logger.error(f"Link token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/update-link-token')
async def create_update_link_token(request: Request):
    """Create an update-mode Plaid Link token to request additional Auth consent"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        body = await request.json()
        context = body.get('context', 'personal')

        client = await get_smart_plaid_client()
        db_env, _, _ = await get_plaid_env_from_db()
        current_env = db_env or os.getenv('PLAID_ENV', 'sandbox')

        # Find the existing plaid item for this user and context
        item = await db['plaid_items'].find_one({
            'user_id': user_id,
            'context': context,
            'status': 'active'
        })

        if not item:
            raise HTTPException(status_code=404, detail="No active bank connection found")

        access_token = item['access_token']
        logger.info(f"🔄 Creating update link token for user {user_id} context={context} (env: {current_env})")

        # Create update-mode link token with access_token
        link_request = LinkTokenCreateRequest(
            access_token=access_token,
            client_name="Ross Tax Bookkeeping",
            country_codes=[CountryCode("US")],
            language="es",
            user=LinkTokenCreateRequestUser(client_user_id=str(user_id)),
        )

        response = client.link_token_create(link_request)
        logger.info(f"✅ Update link token created for user {user_id}")
        return {
            'success': True,
            'link_token': response['link_token'],
            'expiration': response['expiration'],
            'environment': current_env,
            'update_mode': True,
        }
    except plaid.ApiException as e:
        logger.error(f"Plaid update link token error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")
    except Exception as e:
        logger.error(f"Update link token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/fetch-my-auth')
async def fetch_my_auth(request: Request):
    """User endpoint: Fetch routing/account numbers for their own linked accounts and save to client_banking"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        from plaid.model.auth_get_request import AuthGetRequest
        client = await get_smart_plaid_client()
        
        body = await request.json()
        context = body.get('context', '')  # 'personal', 'business', or '' for all
        
        query = {'user_id': user_id, 'status': 'active'}
        if context:
            query['context'] = context
        
        items = []
        async for item in db['plaid_items'].find(query):
            items.append(item)
        
        if not items:
            return {'success': False, 'message': 'No hay cuentas bancarias conectadas'}
        
        user = await db['users'].find_one({'id': user_id})
        user_name = user.get('name', '') or user.get('full_name', '') if user else ''
        user_email = user.get('email', '') if user else ''
        
        total_saved = 0
        errors = []
        
        for item in items:
            try:
                auth_request = AuthGetRequest(access_token=item['access_token'])
                auth_response = client.auth_get(auth_request)
                
                numbers = auth_response.get('numbers', {})
                ach_numbers = numbers.get('ach', [])
                
                accounts = item.get('accounts', [])
                item_context = item.get('context', 'personal')
                
                # Get display name
                if item_context == 'business':
                    biz = await db['client_businesses'].find_one({'user_id': user_id})
                    display_name = biz.get('business_name', user_name) if biz else user_name
                else:
                    display_name = user_name
                
                for ach in ach_numbers:
                    routing = ach.get('routing', '')
                    account_num = ach.get('account', '')
                    acct_id = ach.get('account_id', '')
                    
                    if not routing or not account_num:
                        continue
                    
                    acct_name = ''
                    acct_type = 'checking'
                    for a in accounts:
                        if a.get('account_id') == acct_id:
                            acct_name = a.get('name', '') or a.get('official_name', '')
                            acct_type = a.get('subtype', 'checking')
                            a['routing_number'] = routing
                            a['account_number'] = account_num
                            a['wire_routing'] = ach.get('wire_routing', '')
                            break
                    
                    banking_record = {
                        'user_id': user_id,
                        'first_name': display_name.split(' ')[0] if display_name else '',
                        'last_name': ' '.join(display_name.split(' ')[1:]) if display_name and ' ' in display_name else '',
                        'full_name': display_name,
                        'email': user_email,
                        'routing_number': routing,
                        'account_number': account_num,
                        'account_type': str(acct_type),
                        'bank_name': item.get('institution_name', ''),
                        'account_name': acct_name,
                        'context': item_context,
                        'source': 'plaid_auto',
                        'plaid_item_id': item['item_id'],
                        'plaid_account_id': acct_id,
                        'status': 'complete',
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                    }
                    
                    await db['client_banking'].update_one(
                        {'user_id': user_id, 'plaid_account_id': acct_id},
                        {'$set': banking_record},
                        upsert=True
                    )
                    total_saved += 1
                
                await db['plaid_items'].update_one(
                    {'_id': item['_id']},
                    {'$set': {'accounts': accounts, 'auth_fetched_at': datetime.utcnow()}}
                )
            except plaid.ApiException as e:
                error_body = e.body if hasattr(e, 'body') else str(e)
                if 'ADDITIONAL_CONSENT_REQUIRED' in str(error_body):
                    errors.append(f"{item.get('institution_name', '')}: Se requiere actualizar permisos")
                else:
                    errors.append(f"{item.get('institution_name', '')}: {str(e)[:100]}")
            except Exception as e:
                errors.append(f"{item.get('institution_name', '')}: {str(e)[:100]}")
        
        return {
            'success': total_saved > 0,
            'saved_accounts': total_saved,
            'errors': errors if errors else None,
            'message': f'{total_saved} cuenta(s) guardadas' + (f' ({len(errors)} requieren permisos)' if errors else ''),
        }
    except Exception as e:
        logger.error(f"Fetch my auth error: {e}")
        raise HTTPException(status_code=500, detail=str(e))





@router.post('/exchange-token')
async def exchange_public_token(request: Request):
    """Exchange public token from Plaid Link for an access token"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        body = await request.json()
        public_token = body.get('public_token')
        institution = body.get('institution', {})
        context = body.get('context', 'personal')  # 'business' or 'personal'

        if not public_token:
            raise HTTPException(status_code=400, detail="public_token is required")

        # ── Verify business subscription if connecting for business ──
        if context == 'business':
            has_business_sub = False
            # Check user_subscriptions collection
            user_sub = await db['user_subscriptions'].find_one({
                'user_id': user_id,
                'status': {'$in': ['active', 'trialing']},
            })
            if user_sub:
                has_business_sub = True
            else:
                # Check client_businesses collection (legacy/office subscriptions)
                biz = await db['client_businesses'].find_one({
                    'user_id': user_id,
                    'subscription_status': {'$in': ['active', 'trial']},
                })
                if biz:
                    has_business_sub = True

            if not has_business_sub:
                raise HTTPException(
                    status_code=403,
                    detail="Se requiere una suscripción activa de negocio para conectar un banco en Mi Negocio"
                )

        client = await get_smart_plaid_client()

        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = client.item_public_token_exchange(exchange_request)

        access_token = response['access_token']
        item_id = response['item_id']

        # Get accounts
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request)

        accounts = []
        has_business_accounts = False
        business_subtypes = {'business_checking', 'business_savings', 'business_money_market', 'commercial'}
        for acct in accounts_response['accounts']:
            subtype_str = str(acct.get('subtype', '')).lower()
            name_str = (acct.get('name', '') + ' ' + acct.get('official_name', '')).lower()
            is_business_acct = subtype_str in business_subtypes or 'business' in name_str or 'commercial' in name_str or 'empresa' in name_str
            if is_business_acct:
                has_business_accounts = True
            accounts.append({
                'account_id': acct['account_id'],
                'name': acct['name'],
                'official_name': acct.get('official_name', ''),
                'type': str(acct['type']),
                'subtype': str(acct.get('subtype', '')),
                'mask': acct.get('mask', ''),
                'current_balance': acct['balances'].get('current'),
                'available_balance': acct['balances'].get('available'),
                'is_business_account': is_business_acct,
            })

        # ── Block business accounts in personal context ──
        if context == 'personal' and has_business_accounts:
            business_names = [a['name'] for a in accounts if a.get('is_business_account')]
            raise HTTPException(
                status_code=409,
                detail=f"BUSINESS_ACCOUNT_DETECTED|{', '.join(business_names)}"
            )

        # Save to database
        plaid_item = {
            'user_id': user_id,
            'item_id': item_id,
            'access_token': access_token,
            'institution_id': institution.get('institution_id', ''),
            'institution_name': institution.get('name', 'Unknown Bank'),
            'accounts': accounts,
            'context': context,  # 'business' or 'personal'
            'status': 'active',
            'transactions_cursor': '',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
        }

        await db['plaid_items'].update_one(
            {'user_id': user_id, 'item_id': item_id},
            {'$set': plaid_item},
            upsert=True
        )

        # ── AUTO-FETCH Auth (routing/account numbers) and save to client_banking ──
        try:
            from plaid.model.auth_get_request import AuthGetRequest
            auth_request = AuthGetRequest(access_token=access_token)
            auth_response = client.auth_get(auth_request)
            
            numbers = auth_response.get('numbers', {})
            ach_numbers = numbers.get('ach', [])
            
            # Get user info for client_banking
            user = await db['users'].find_one({'id': user_id})
            user_name = user.get('name', '') or user.get('full_name', '') if user else ''
            user_email = user.get('email', '') if user else ''
            
            for ach in ach_numbers:
                routing = ach.get('routing', '')
                account_num = ach.get('account', '')
                acct_id = ach.get('account_id', '')
                
                if not routing or not account_num:
                    continue
                
                # Find matching account for name/type
                acct_name = ''
                acct_type = 'checking'
                for a in accounts:
                    if a.get('account_id') == acct_id:
                        acct_name = a.get('name', '') or a.get('official_name', '')
                        acct_type = a.get('subtype', 'checking')
                        # Also update the plaid_items accounts array
                        a['routing_number'] = routing
                        a['account_number'] = account_num
                        a['wire_routing'] = ach.get('wire_routing', '')
                        break
                
                # Determine display name based on context
                if context == 'business':
                    # Try to get business name
                    biz = await db['client_businesses'].find_one({'user_id': user_id})
                    display_name = biz.get('business_name', user_name) if biz else user_name
                else:
                    display_name = user_name
                
                # Save to client_banking
                banking_record = {
                    'user_id': user_id,
                    'first_name': display_name.split(' ')[0] if display_name else '',
                    'last_name': ' '.join(display_name.split(' ')[1:]) if display_name and ' ' in display_name else '',
                    'full_name': display_name,
                    'email': user_email,
                    'routing_number': routing,
                    'account_number': account_num,
                    'account_type': str(acct_type),
                    'bank_name': plaid_item['institution_name'],
                    'account_name': acct_name,
                    'context': context,
                    'source': 'plaid_auto',
                    'plaid_item_id': item_id,
                    'plaid_account_id': acct_id,
                    'status': 'complete',
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                }
                
                # Upsert by user_id + plaid_account_id to avoid duplicates
                await db['client_banking'].update_one(
                    {'user_id': user_id, 'plaid_account_id': acct_id},
                    {'$set': banking_record},
                    upsert=True
                )
            
            # Update plaid_items with auth data
            await db['plaid_items'].update_one(
                {'user_id': user_id, 'item_id': item_id},
                {'$set': {'accounts': accounts, 'auth_fetched_at': datetime.utcnow()}}
            )
            
            logger.info(f"✅ Auto-saved {len(ach_numbers)} banking records for user {user_id} ({context})")
        except Exception as auth_err:
            # Auth might fail for some institutions (e.g., investment accounts)
            # Don't block the linking flow
            logger.warning(f"⚠️ Could not auto-fetch auth for {plaid_item['institution_name']}: {auth_err}")

        return {
            'success': True,
            'institution_name': plaid_item['institution_name'],
            'accounts': accounts,
        }
    except plaid.ApiException as e:
        logger.error(f"Plaid exchange error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Exchange token error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/accounts')
async def get_linked_accounts(request: Request):
    """Get linked bank accounts for the user, optionally filtered by context"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        context = request.query_params.get('context', '')  # 'business', 'personal', or '' for all
        query = {'user_id': user_id, 'status': 'active'}
        if context:
            query['context'] = context

        cursor = db['plaid_items'].find(
            query,
            {'_id': 0, 'access_token': 0, 'transactions_cursor': 0}
        )
        items = []
        async for item in cursor:
            items.append(item)

        return {'success': True, 'items': items}
    except Exception as e:
        logger.error(f"Get accounts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete('/accounts/{item_id}')
async def disconnect_account(item_id: str, request: Request):
    """Disconnect a bank account"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        result = await db['plaid_items'].update_one(
            {'user_id': user_id, 'item_id': item_id},
            {'$set': {'status': 'disconnected', 'updated_at': datetime.utcnow()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Account not found")

        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Disconnect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/sync-transactions')
async def sync_transactions(request: Request):
    """Sync transactions from linked accounts, optionally filtered by context.
    Handles added, modified, and removed transactions from Plaid Sync API.
    Supports force_refresh to reset cursor and re-fetch all transactions.
    """
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        context = body.get('context', '') or request.query_params.get('context', '')
        force_refresh = body.get('force_refresh', False)

        client = await get_smart_plaid_client()
        query = {'user_id': user_id, 'status': 'active'}
        if context:
            query['context'] = context

        items = []
        async for item in db['plaid_items'].find(query):
            items.append(item)

        if not items:
            return {'success': True, 'transactions_added': 0, 'transactions_modified': 0, 'transactions_removed': 0, 'message': 'No hay cuentas activas conectadas'}

        total_added = 0
        total_modified = 0
        total_removed = 0

        for item in items:
            access_token = item['access_token']
            # If force_refresh, reset cursor to re-fetch all transactions
            cursor_val = '' if force_refresh else item.get('transactions_cursor', '')
            has_more = True

            if force_refresh:
                logger.info(f"🔄 Force refresh: resetting cursor for item {item['item_id']}")

            while has_more:
                sync_req = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor_val or '',
                )
                response = client.transactions_sync(sync_req)

                # Process ADDED transactions
                for txn in response['added']:
                    txn_data = {
                        'user_id': user_id,
                        'item_id': item['item_id'],
                        'transaction_id': txn['transaction_id'],
                        'account_id': txn['account_id'],
                        'amount': txn['amount'],
                        'date': str(txn['date']),
                        'name': txn['name'],
                        'merchant_name': txn.get('merchant_name', ''),
                        'category': txn.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                        'category_detail': txn.get('personal_finance_category', {}).get('detailed', ''),
                        'pending': txn.get('pending', False),
                        'institution_name': item.get('institution_name', ''),
                        'context': item.get('context', 'personal'),
                        'synced_at': datetime.utcnow(),
                    }
                    await db['transactions'].update_one(
                        {'transaction_id': txn['transaction_id'], 'user_id': user_id},
                        {'$set': txn_data},
                        upsert=True
                    )
                    total_added += 1

                # Process MODIFIED transactions (pending->posted, amount changes, etc.)
                for txn in response.get('modified', []):
                    update_data = {
                        'amount': txn['amount'],
                        'date': str(txn['date']),
                        'name': txn['name'],
                        'merchant_name': txn.get('merchant_name', ''),
                        'category': txn.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                        'category_detail': txn.get('personal_finance_category', {}).get('detailed', ''),
                        'pending': txn.get('pending', False),
                        'synced_at': datetime.utcnow(),
                    }
                    result = await db['transactions'].update_one(
                        {'transaction_id': txn['transaction_id'], 'user_id': user_id},
                        {'$set': update_data}
                    )
                    if result.modified_count > 0:
                        total_modified += 1

                # Process REMOVED transactions
                for txn in response.get('removed', []):
                    txn_id = txn.get('transaction_id', '')
                    if txn_id:
                        result = await db['transactions'].delete_one(
                            {'transaction_id': txn_id, 'user_id': user_id}
                        )
                        if result.deleted_count > 0:
                            total_removed += 1

                has_more = response['has_more']
                cursor_val = response['next_cursor']

            await db['plaid_items'].update_one(
                {'_id': item['_id']},
                {'$set': {'transactions_cursor': cursor_val, 'updated_at': datetime.utcnow()}}
            )

        # Also refresh account balances from Plaid
        balances_updated = 0
        for item in items:
            try:
                accounts_req = AccountsGetRequest(access_token=item['access_token'])
                accounts_resp = client.accounts_get(accounts_req)
                updated_accounts = []
                for acct in accounts_resp['accounts']:
                    updated_accounts.append({
                        'account_id': acct['account_id'],
                        'name': acct['name'],
                        'official_name': acct.get('official_name', ''),
                        'type': str(acct['type']),
                        'subtype': str(acct.get('subtype', '')),
                        'mask': acct.get('mask', ''),
                        'current_balance': acct['balances'].get('current'),
                        'available_balance': acct['balances'].get('available'),
                    })
                await db['plaid_items'].update_one(
                    {'_id': item['_id']},
                    {'$set': {'accounts': updated_accounts, 'updated_at': datetime.utcnow()}}
                )
                balances_updated += len(updated_accounts)
            except Exception as bal_err:
                logger.warning(f"Could not refresh balances for item {item['item_id']}: {bal_err}")

        total_changes = total_added + total_modified + total_removed
        if total_changes > 0:
            msg = f"Sincronizado: {total_added} nuevas, {total_modified} actualizadas, {total_removed} eliminadas"
        else:
            msg = "No hay nuevas transacciones de Plaid. Los bancos pueden tardar 24-48h en reportar transacciones recientes."

        logger.info(f"📊 Plaid sync for user {user_id}: +{total_added} ~{total_modified} -{total_removed} (force={force_refresh})")

        return {
            'success': True,
            'transactions_added': total_added,
            'transactions_modified': total_modified,
            'transactions_removed': total_removed,
            'total_changes': total_changes,
            'message': msg,
            'force_refresh': force_refresh,
        }
    except plaid.ApiException as e:
        logger.error(f"Plaid sync error: {e.body}")
        raise HTTPException(status_code=500, detail=f"Plaid error: {e.body}")
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get('/dashboard-summary')
async def get_plaid_dashboard_summary(request: Request):
    """Get financial dashboard summary from Plaid transactions for a specific context"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        context = request.query_params.get('context', 'business')
        now = datetime.utcnow()
        target_year = now.year
        target_month = now.month

        # ── CHECK: Only show data if there's an active bank connection ──
        active_items = await db['plaid_items'].count_documents({
            'user_id': user_id,
            'context': context,
            'status': 'active'
        })

        empty_response = {
            'success': True,
            'month': target_month,
            'year': target_year,
            'month_income': 0, 'month_expenses': 0, 'month_net': 0,
            'total_transactions_month': 0,
            'ytd_income': 0, 'ytd_expenses': 0,
            'top_categories': [],
            'monthly_trend': [],
            'receipts_this_month': 0, 'pending_receipts': 0,
            'has_active_connection': False,
        }

        if active_items == 0:
            return empty_response

        # Get active item_ids to filter transactions (prevents duplicates from disconnected items)
        active_item_ids = []
        async for item in db['plaid_items'].find(
            {'user_id': user_id, 'context': context, 'status': 'active'},
            {'item_id': 1}
        ):
            active_item_ids.append(item['item_id'])

        # ── Category translation map ──
        CATEGORY_LABELS = {
            'TRANSFER_OUT': 'Transferencia enviada',
            'TRANSFER_IN': 'Transferencia recibida',
            'GENERAL_SERVICES': 'Servicios generales',
            'GENERAL_MERCHANDISE': 'Mercancía',
            'FOOD_AND_DRINK': 'Comida y bebida',
            'TRANSPORTATION': 'Transporte',
            'RENT_AND_UTILITIES': 'Renta y servicios',
            'ENTERTAINMENT': 'Entretenimiento',
            'LOAN_PAYMENTS': 'Pagos de préstamo',
            'GOVERNMENT_AND_NON_PROFIT': 'Gobierno',
            'TRAVEL': 'Viajes',
            'MEDICAL': 'Médico',
            'BANK_FEES': 'Cargos bancarios',
            'INCOME': 'Ingreso',
            'PERSONAL_CARE': 'Cuidado personal',
            'HOME_IMPROVEMENT': 'Hogar',
        }

        # Current month range
        month_start_str = f"{target_year}-{target_month:02d}-01"
        if target_month == 12:
            month_end_str = f"{target_year + 1}-01-01"
        else:
            month_end_str = f"{target_year}-{target_month + 1:02d}-01"
        
        # Year range
        year_start_str = f"{target_year}-01-01"
        year_end_str = f"{target_year + 1}-01-01"

        base_query = {'user_id': user_id, 'context': context, 'item_id': {'$in': active_item_ids}}

        # Monthly totals (Plaid: negative amount = income/credit, positive = expense/debit)
        month_pipeline = [
            {'$match': {**base_query, 'date': {'$gte': month_start_str, '$lt': month_end_str}}},
            {'$group': {
                '_id': None,
                'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }}
        ]
        month_data = {'income': 0, 'expenses': 0, 'count': 0}
        async for doc in db['transactions'].aggregate(month_pipeline):
            month_data = {'income': round(doc.get('income', 0), 2), 'expenses': round(doc.get('expenses', 0), 2), 'count': doc.get('count', 0)}

        # YTD totals
        ytd_pipeline = [
            {'$match': {**base_query, 'date': {'$gte': year_start_str, '$lt': year_end_str}}},
            {'$group': {
                '_id': None,
                'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }}
        ]
        ytd_data = {'income': 0, 'expenses': 0, 'count': 0}
        async for doc in db['transactions'].aggregate(ytd_pipeline):
            ytd_data = {'income': round(doc.get('income', 0), 2), 'expenses': round(doc.get('expenses', 0), 2), 'count': doc.get('count', 0)}

        # Top categories this month (with Spanish translation)
        cat_pipeline = [
            {'$match': {**base_query, 'date': {'$gte': month_start_str, '$lt': month_end_str}, 'amount': {'$gt': 0}}},
            {'$group': {'_id': '$category', 'amount': {'$sum': '$amount'}, 'count': {'$sum': 1}}},
            {'$sort': {'amount': -1}},
            {'$limit': 8},
        ]
        top_categories = []
        async for doc in db['transactions'].aggregate(cat_pipeline):
            raw_cat = doc['_id'] or 'OTHER'
            top_categories.append({
                'category': CATEGORY_LABELS.get(raw_cat, raw_cat.replace('_', ' ').title()),
                'category_raw': raw_cat,
                'amount': round(doc['amount'], 2),
                'count': doc['count'],
            })

        # Monthly trend (last 12 months)
        monthly_trend = []
        for i in range(12):
            m = target_month - i
            y = target_year
            while m <= 0:
                m += 12
                y -= 1
            m_start = f"{y}-{m:02d}-01"
            if m == 12:
                m_end = f"{y + 1}-01-01"
            else:
                m_end = f"{y}-{m + 1:02d}-01"

            trend_pipeline = [
                {'$match': {**base_query, 'date': {'$gte': m_start, '$lt': m_end}}},
                {'$group': {
                    '_id': None,
                    'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                    'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                }}
            ]
            trend_data = {'month': m, 'year': y, 'income': 0, 'expenses': 0}
            async for doc in db['transactions'].aggregate(trend_pipeline):
                trend_data['income'] = round(doc.get('income', 0), 2)
                trend_data['expenses'] = round(doc.get('expenses', 0), 2)
            monthly_trend.append(trend_data)

        monthly_trend.reverse()

        return {
            'success': True,
            'month': target_month,
            'year': target_year,
            'month_income': month_data['income'],
            'month_expenses': month_data['expenses'],
            'month_net': round(month_data['income'] - month_data['expenses'], 2),
            'total_transactions_month': month_data['count'],
            'ytd_income': ytd_data['income'],
            'ytd_expenses': ytd_data['expenses'],
            'top_categories': top_categories,
            'monthly_trend': monthly_trend,
            'receipts_this_month': 0,
            'pending_receipts': 0,
            'has_active_connection': True,
        }
    except Exception as e:
        logger.error(f"Dashboard summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get('/pnl-report')
async def get_pnl_report(request: Request):
    """Generate Profit & Loss report by category for a given period"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        context = request.query_params.get('context', 'business')
        year = int(request.query_params.get('year', datetime.utcnow().year))
        month = request.query_params.get('month', '')  # empty = full year

        # Category translation + IRS Schedule C mapping
        CATEGORY_META = {
            'TRANSFER_OUT': {'label': 'Transferencias enviadas', 'schedule_c': '', 'type': 'expense'},
            'TRANSFER_IN': {'label': 'Transferencias recibidas', 'schedule_c': '', 'type': 'income'},
            'GENERAL_SERVICES': {'label': 'Servicios generales', 'schedule_c': 'Line 17 (Legal/Professional)', 'type': 'expense'},
            'GENERAL_MERCHANDISE': {'label': 'Mercancía / Compras', 'schedule_c': 'Line 22 (Supplies)', 'type': 'expense'},
            'FOOD_AND_DRINK': {'label': 'Comida y bebida', 'schedule_c': 'Line 24b (Meals 50%)', 'type': 'expense'},
            'TRANSPORTATION': {'label': 'Transporte', 'schedule_c': 'Line 9 (Car/Truck)', 'type': 'expense'},
            'RENT_AND_UTILITIES': {'label': 'Renta y servicios', 'schedule_c': 'Line 20a (Rent) / Line 25 (Utilities)', 'type': 'expense'},
            'ENTERTAINMENT': {'label': 'Entretenimiento', 'schedule_c': '', 'type': 'expense'},
            'LOAN_PAYMENTS': {'label': 'Pagos de préstamo', 'schedule_c': 'Line 16a (Interest)', 'type': 'expense'},
            'GOVERNMENT_AND_NON_PROFIT': {'label': 'Gobierno / Impuestos', 'schedule_c': 'Line 23 (Taxes/Licenses)', 'type': 'expense'},
            'TRAVEL': {'label': 'Viajes de negocio', 'schedule_c': 'Line 24a (Travel)', 'type': 'expense'},
            'MEDICAL': {'label': 'Médico', 'schedule_c': '', 'type': 'expense'},
            'BANK_FEES': {'label': 'Cargos bancarios', 'schedule_c': 'Line 27a (Other - Bank Fees)', 'type': 'expense'},
            'INCOME': {'label': 'Ingreso', 'schedule_c': 'Line 1 (Gross Receipts)', 'type': 'income'},
            'PERSONAL_CARE': {'label': 'Cuidado personal', 'schedule_c': '', 'type': 'expense'},
            'HOME_IMPROVEMENT': {'label': 'Hogar', 'schedule_c': 'Line 30 (Business Use of Home)', 'type': 'expense'},
        }

        # Get active item_ids
        active_item_ids = []
        async for item in db['plaid_items'].find(
            {'user_id': user_id, 'context': context, 'status': 'active'}, {'item_id': 1}
        ):
            active_item_ids.append(item['item_id'])

        if not active_item_ids:
            return {'success': True, 'income_items': [], 'expense_items': [], 'totals': {}}

        # Build date filter
        if month:
            m = int(month)
            start_date = f"{year}-{m:02d}-01"
            end_date = f"{year}-{m + 1:02d}-01" if m < 12 else f"{year + 1}-01-01"
            period_label = f"{CATEGORY_META.get('INCOME', {}).get('label', '')} - {m}/{year}"
        else:
            start_date = f"{year}-01-01"
            end_date = f"{year + 1}-01-01"
            period_label = f"Año {year}"

        base_query = {
            'user_id': user_id, 'context': context,
            'item_id': {'$in': active_item_ids},
            'date': {'$gte': start_date, '$lt': end_date}
        }

        # Aggregate by category
        pipeline = [
            {'$match': base_query},
            {'$group': {
                '_id': '$category',
                'total': {'$sum': '$amount'},
                'count': {'$sum': 1},
                'avg': {'$avg': '$amount'},
            }},
            {'$sort': {'total': -1}},
        ]

        income_items = []
        expense_items = []
        total_income = 0
        total_expenses = 0

        async for doc in db['transactions'].aggregate(pipeline):
            raw_cat = doc['_id'] or 'OTHER'
            meta = CATEGORY_META.get(raw_cat, {'label': raw_cat.replace('_', ' ').title(), 'schedule_c': '', 'type': 'expense'})
            amount = round(doc['total'], 2)
            entry = {
                'category': raw_cat,
                'label': meta['label'],
                'schedule_c': meta['schedule_c'],
                'amount': abs(amount),
                'count': doc['count'],
                'avg_per_txn': round(abs(doc['avg']), 2),
            }

            # In Plaid: negative = credit/income, positive = debit/expense
            if amount < 0 or meta['type'] == 'income':
                income_items.append(entry)
                total_income += abs(amount)
            else:
                expense_items.append(entry)
                total_expenses += abs(amount)

        # Sort by amount descending
        income_items.sort(key=lambda x: x['amount'], reverse=True)
        expense_items.sort(key=lambda x: x['amount'], reverse=True)

        net_profit = round(total_income - total_expenses, 2)
        margin = round((net_profit / total_income * 100), 1) if total_income > 0 else 0

        # Month-over-month comparison
        prev_month_data = None
        if month:
            m = int(month)
            prev_m = m - 1 if m > 1 else 12
            prev_y = year if m > 1 else year - 1
            prev_start = f"{prev_y}-{prev_m:02d}-01"
            prev_end = f"{prev_y}-{prev_m + 1:02d}-01" if prev_m < 12 else f"{prev_y + 1}-01-01"

            prev_pipeline = [
                {'$match': {**base_query, 'date': {'$gte': prev_start, '$lt': prev_end}}},
                {'$group': {
                    '_id': None,
                    'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                    'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                }}
            ]
            async for doc in db['transactions'].aggregate(prev_pipeline):
                prev_income = round(doc.get('income', 0), 2)
                prev_expenses = round(doc.get('expenses', 0), 2)
                income_change = round(((total_income - prev_income) / prev_income * 100), 1) if prev_income > 0 else 0
                expense_change = round(((total_expenses - prev_expenses) / prev_expenses * 100), 1) if prev_expenses > 0 else 0
                prev_month_data = {
                    'prev_income': prev_income,
                    'prev_expenses': prev_expenses,
                    'income_change_pct': income_change,
                    'expense_change_pct': expense_change,
                }

        return {
            'success': True,
            'period': period_label,
            'year': year,
            'month': int(month) if month else None,
            'income_items': income_items,
            'expense_items': expense_items,
            'totals': {
                'income': round(total_income, 2),
                'expenses': round(total_expenses, 2),
                'net_profit': net_profit,
                'margin_pct': margin,
            },
            'comparison': prev_month_data,
        }
    except Exception as e:
        logger.error(f"P&L report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get('/transactions')
async def get_transactions(request: Request):
    """Get user transactions with optional date range and context filter"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        limit = int(request.query_params.get('limit', '50'))
        skip = int(request.query_params.get('skip', '0'))
        context = request.query_params.get('context', '')  # 'business' or 'personal'
        start_date = request.query_params.get('start_date', '')
        end_date = request.query_params.get('end_date', '')
        amount_min = request.query_params.get('amount_min', '')
        amount_max = request.query_params.get('amount_max', '')

        query: dict = {'user_id': user_id}
        if context:
            query['context'] = context
            # Only include transactions from active plaid_items
            active_item_ids = []
            async for item in db['plaid_items'].find(
                {'user_id': user_id, 'context': context, 'status': 'active'},
                {'item_id': 1}
            ):
                active_item_ids.append(item['item_id'])
            logger.info(f"📊 Transactions query - user: {user_id}, context: {context}, active_items: {len(active_item_ids)}, item_ids: {active_item_ids[:3]}")
            if active_item_ids:
                query['item_id'] = {'$in': active_item_ids}

        if start_date:
            query.setdefault('date', {})['$gte'] = start_date
        if end_date:
            query.setdefault('date', {})['$lt'] = end_date
        if amount_min:
            query.setdefault('amount', {})['$gte'] = float(amount_min)
        if amount_max:
            query.setdefault('amount', {})['$lte'] = float(amount_max)

        logger.info(f"📊 Final query: {query}")
        total_count = await db['transactions'].count_documents(query)
        logger.info(f"📊 Total count: {total_count}")

        cursor = db['transactions'].find(
            query,
            {'_id': 0}
        ).sort('date', -1).skip(skip).limit(limit)

        transactions = []
        async for txn in cursor:
            transactions.append(txn)

        # Get totals (filtered by same query)
        pipeline = [
            {'$match': query},
            {'$group': {
                '_id': None,
                'total_income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'total_expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }}
        ]
        totals = {'total_income': 0, 'total_expenses': 0, 'count': 0}
        async for doc in db['transactions'].aggregate(pipeline):
            totals = doc

        return {
            'success': True,
            'transactions': transactions,
            'total_count': total_count,
            'totals': {
                'income': round(totals.get('total_income', 0), 2),
                'expenses': round(totals.get('total_expenses', 0), 2),
                'count': totals.get('count', 0),
            }
        }
    except Exception as e:
        logger.error(f"Get transactions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))





# ─── Admin: Plaid Environment Toggle ─────────────────────────────────────────

@router.get('/admin/config')
async def get_plaid_config(request: Request):
    """Get current Plaid configuration (admin only)"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify admin
    user = await db.users.find_one({'_id': user_id}) or await db.users.find_one({'user_id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        config = await db.admin_config.find_one({}) or {}
        db_env = config.get('PLAID_ENV', None)
        current_env = db_env or os.getenv('PLAID_ENV', 'sandbox')
        
        # Check production credentials from DB or env
        has_prod_secret = bool(config.get('PLAID_SECRET_PRODUCTION') or os.getenv('PLAID_SECRET_PRODUCTION'))
        has_prod_client_id = bool(config.get('PLAID_CLIENT_ID_PRODUCTION'))
        
        # Test current credentials
        test_ok = False
        try:
            client = await get_smart_plaid_client()
            test_request = LinkTokenCreateRequest(
                products=[Products("transactions")],
                client_name="Ross Tax Bookkeeping",
                country_codes=[CountryCode("US")],
                language="es",
                user=LinkTokenCreateRequestUser(client_user_id="test-admin"),
            )
            resp = client.link_token_create(test_request)
            test_ok = bool(resp.get('link_token'))
        except Exception as e:
            logger.warning(f"Plaid config test failed: {e}")

        return {
            'success': True,
            'environment': current_env,
            'client_id': os.getenv('PLAID_CLIENT_ID', '')[:8] + '...',
            'has_sandbox_secret': bool(os.getenv('PLAID_SECRET')),
            'has_production_secret': has_prod_secret,
            'has_production_client_id': has_prod_client_id,
            'is_db_override': db_env is not None,
            'credentials_valid': test_ok,
            'linked_accounts': await db['plaid_items'].count_documents({'status': 'active'}),
        }
    except Exception as e:
        logger.error(f"Get Plaid config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/toggle-environment')
async def toggle_plaid_environment(request: Request):
    """Toggle Plaid between sandbox and production (admin only)"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify admin
    user = await db.users.find_one({'_id': user_id}) or await db.users.find_one({'user_id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        body = await request.json()
        new_env = body.get('environment', 'sandbox')
        prod_secret = body.get('production_secret', '').strip()
        prod_client_id = body.get('production_client_id', '').strip()
        
        if new_env not in ['sandbox', 'production']:
            raise HTTPException(status_code=400, detail="Environment must be 'sandbox' or 'production'")
        
        # If switching to production, need production credentials
        if new_env == 'production':
            # Check for secret: body > DB > env var
            existing_config = await db.admin_config.find_one({})
            secret_to_use = prod_secret or (existing_config or {}).get('PLAID_SECRET_PRODUCTION') or os.getenv('PLAID_SECRET_PRODUCTION')
            client_id_to_use = prod_client_id or (existing_config or {}).get('PLAID_CLIENT_ID_PRODUCTION') or os.getenv('PLAID_CLIENT_ID') or os.getenv('PLAID_CLIENT_ID')
            
            if not secret_to_use:
                raise HTTPException(
                    status_code=400,
                    detail="Se requiere el Production Secret de Plaid. Ingrésalo en el campo correspondiente."
                )
            
            # Test production credentials before switching
            try:
                test_config = plaid.Configuration(
                    host=plaid.Environment.Production,
                    api_key={
                        'clientId': client_id_to_use or os.getenv('PLAID_CLIENT_ID'),
                        'secret': secret_to_use,
                    }
                )
                test_api = plaid.ApiClient(test_config)
                test_client = plaid_api.PlaidApi(test_api)
                test_request = LinkTokenCreateRequest(
                    products=[Products("transactions")],
                    client_name="Ross Tax Bookkeeping",
                    country_codes=[CountryCode("US")],
                    language="es",
                    user=LinkTokenCreateRequestUser(client_user_id="test-admin"),
                )
                test_client.link_token_create(test_request)
            except Exception as e:
                error_msg = str(e)[:200]
                raise HTTPException(
                    status_code=400,
                    detail=f"Las credenciales de producción no son válidas: {error_msg}"
                )
            
            # Save production credentials to DB
            update_data = {
                'PLAID_ENV': new_env,
                'PLAID_ENV_CHANGED_AT': datetime.utcnow().isoformat(),
                'PLAID_ENV_CHANGED_BY': user_id,
                'PLAID_SECRET_PRODUCTION': secret_to_use,
                'PLAID_SECRET_OVERRIDE': secret_to_use,
            }
            if prod_client_id:
                update_data['PLAID_CLIENT_ID_PRODUCTION'] = prod_client_id
            
            await db.admin_config.update_one({}, {'$set': update_data}, upsert=True)
        else:
            # Switching to sandbox
            await db.admin_config.update_one(
                {},
                {'$set': {
                    'PLAID_ENV': new_env,
                    'PLAID_ENV_CHANGED_AT': datetime.utcnow().isoformat(),
                    'PLAID_ENV_CHANGED_BY': user_id,
                    'PLAID_SECRET_OVERRIDE': None,
                }},
                upsert=True
            )
        
        logger.info(f"🔗 Plaid environment switched to {new_env} by admin {user_id}")
        
        return {
            'success': True,
            'environment': new_env,
            'message': f'Plaid cambiado a {"🟢 Producción" if new_env == "production" else "🟡 Sandbox"} exitosamente.'
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle Plaid environment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Plaid Webhook Receiver ──────────────────────────────────────────────────

@router.post('/webhook')
async def plaid_webhook(request: Request):
    """
    Receive webhook events from Plaid.
    Handles: TRANSACTIONS, ITEM, AUTH webhook types.
    """
    try:
        body = await request.json()
        webhook_type = body.get('webhook_type', '')
        webhook_code = body.get('webhook_code', '')
        item_id = body.get('item_id', '')
        
        logger.info(f"📩 Plaid Webhook received: type={webhook_type}, code={webhook_code}, item_id={item_id}")

        # ── TRANSACTIONS webhooks ──
        if webhook_type == 'TRANSACTIONS':
            if webhook_code in ['INITIAL_UPDATE', 'HISTORICAL_UPDATE', 'DEFAULT_UPDATE', 'SYNC_UPDATES_AVAILABLE']:
                # New transactions available — auto-sync for the affected item
                new_transactions = body.get('new_transactions', 0)
                logger.info(f"🔄 Transaction update for item {item_id}: {new_transactions} new transactions (code={webhook_code})")
                
                # Find the plaid item and auto-sync
                if db is not None:
                    plaid_item = await db['plaid_items'].find_one({'item_id': item_id, 'status': 'active'})
                    if plaid_item:
                        try:
                            client = await get_smart_plaid_client()
                            access_token = plaid_item['access_token']
                            cursor_val = plaid_item.get('transactions_cursor', '')
                            user_id = plaid_item['user_id']
                            total_added = 0
                            has_more = True

                            while has_more:
                                sync_req = TransactionsSyncRequest(
                                    access_token=access_token,
                                    cursor=cursor_val or '',
                                )
                                response = client.transactions_sync(sync_req)

                                for txn in response['added']:
                                    txn_data = {
                                        'user_id': user_id,
                                        'item_id': item_id,
                                        'transaction_id': txn['transaction_id'],
                                        'account_id': txn['account_id'],
                                        'amount': txn['amount'],
                                        'date': str(txn['date']),
                                        'name': txn['name'],
                                        'merchant_name': txn.get('merchant_name', ''),
                                        'category': txn.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                                        'category_detail': txn.get('personal_finance_category', {}).get('detailed', ''),
                                        'pending': txn.get('pending', False),
                                        'institution_name': plaid_item.get('institution_name', ''),
                                        'context': plaid_item.get('context', 'personal'),
                                        'synced_at': datetime.utcnow(),
                                    }
                                    await db['transactions'].update_one(
                                        {'transaction_id': txn['transaction_id'], 'user_id': user_id},
                                        {'$set': txn_data},
                                        upsert=True
                                    )
                                    total_added += 1

                                # Handle removed transactions
                                for removed in response.get('removed', []):
                                    await db['transactions'].delete_one({
                                        'transaction_id': removed['transaction_id'],
                                        'user_id': user_id
                                    })

                                has_more = response['has_more']
                                cursor_val = response['next_cursor']

                            # Update cursor
                            await db['plaid_items'].update_one(
                                {'_id': plaid_item['_id']},
                                {'$set': {'transactions_cursor': cursor_val, 'updated_at': datetime.utcnow()}}
                            )
                            logger.info(f"✅ Auto-synced {total_added} transactions for item {item_id}")
                        except Exception as sync_err:
                            logger.error(f"❌ Auto-sync failed for item {item_id}: {sync_err}")

            elif webhook_code == 'TRANSACTIONS_REMOVED':
                removed_ids = body.get('removed_transactions', [])
                logger.info(f"🗑️ {len(removed_ids)} transactions removed for item {item_id}")
                if db is not None and removed_ids:
                    plaid_item = await db['plaid_items'].find_one({'item_id': item_id})
                    if plaid_item:
                        await db['transactions'].delete_many({
                            'transaction_id': {'$in': removed_ids},
                            'user_id': plaid_item['user_id']
                        })

        # ── ITEM webhooks ──
        elif webhook_type == 'ITEM':
            if webhook_code == 'ERROR':
                error_info = body.get('error', {})
                error_code = error_info.get('error_code', 'UNKNOWN')
                logger.warning(f"⚠️ Plaid Item ERROR for {item_id}: {error_code} - {error_info.get('error_message', '')}")
                
                if db is not None:
                    await db['plaid_items'].update_one(
                        {'item_id': item_id},
                        {'$set': {
                            'status': 'error',
                            'error_code': error_code,
                            'error_message': error_info.get('error_message', ''),
                            'updated_at': datetime.utcnow(),
                        }}
                    )

            elif webhook_code == 'PENDING_EXPIRATION':
                logger.warning(f"⏰ Plaid Item {item_id} pending expiration — user needs to re-authenticate")
                if db is not None:
                    await db['plaid_items'].update_one(
                        {'item_id': item_id},
                        {'$set': {
                            'status': 'pending_expiration',
                            'updated_at': datetime.utcnow(),
                        }}
                    )

            elif webhook_code == 'USER_PERMISSION_REVOKED':
                logger.warning(f"🚫 User revoked permissions for Plaid Item {item_id}")
                if db is not None:
                    await db['plaid_items'].update_one(
                        {'item_id': item_id},
                        {'$set': {
                            'status': 'revoked',
                            'updated_at': datetime.utcnow(),
                        }}
                    )

        # ── AUTH webhooks ──
        elif webhook_type == 'AUTH':
            logger.info(f"🔐 Auth webhook: {webhook_code} for item {item_id}")

        # Log webhook to DB for audit trail
        if db is not None:
            await db['plaid_webhooks'].insert_one({
                'webhook_type': webhook_type,
                'webhook_code': webhook_code,
                'item_id': item_id,
                'body': body,
                'received_at': datetime.utcnow(),
            })

        return {'success': True, 'received': True}

    except Exception as e:
        logger.error(f"❌ Plaid webhook processing error: {e}")
        # Always return 200 to Plaid so it doesn't retry endlessly
        return {'success': False, 'error': str(e)}



# ─── Admin: Client Banking Management ────────────────────────────────────────

@router.get('/admin/clients')
async def admin_list_plaid_clients(request: Request):
    """List all clients with connected bank accounts, separated by context"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verify admin role
    user = await db['users'].find_one({'id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        context_filter = request.query_params.get('context', '')  # 'business', 'personal', or '' for all
        search = request.query_params.get('search', '').strip()

        pipeline = [
            {'$match': {'status': {'$in': ['active', 'error', 'pending_expiration']}}},
        ]
        if context_filter:
            pipeline[0]['$match']['context'] = context_filter

        pipeline += [
            {'$lookup': {
                'from': 'users',
                'let': {'uid': '$user_id'},
                'pipeline': [
                    {'$match': {'$expr': {'$eq': ['$id', '$$uid']}}},
                    {'$project': {'_id': 0, 'id': 1, 'first_name': 1, 'last_name': 1, 'name': 1, 'email': 1, 'phone': 1}}
                ],
                'as': 'user_info'
            }},
            {'$unwind': {'path': '$user_info', 'preserveNullAndEmptyArrays': True}},
            {'$project': {
                '_id': 0,
                'access_token': 0,
                'transactions_cursor': 0,
            }},
            {'$sort': {'updated_at': -1}},
        ]

        clients = []
        async for item in db['plaid_items'].aggregate(pipeline):
            client_data = {
                'user_id': item.get('user_id', ''),
                'item_id': item.get('item_id', ''),
                'institution_name': item.get('institution_name', ''),
                'institution_id': item.get('institution_id', ''),
                'accounts': item.get('accounts', []),
                'context': item.get('context', 'personal'),
                'status': item.get('status', 'unknown'),
                'error_code': item.get('error_code', ''),
                'error_message': item.get('error_message', ''),
                'created_at': str(item.get('created_at', '')),
                'updated_at': str(item.get('updated_at', '')),
                'user': item.get('user_info', {}),
            }
            # Apply search filter on user name/email
            if search:
                user_info = client_data.get('user', {})
                full_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".lower().strip()
                display_name = user_info.get('name', '').lower()
                email = user_info.get('email', '').lower()
                institution = client_data['institution_name'].lower()
                search_lower = search.lower()
                if search_lower not in full_name and search_lower not in display_name and search_lower not in email and search_lower not in institution:
                    continue
            clients.append(client_data)

        # Get transaction counts per user
        for client in clients:
            uid = client['user_id']
            ctx = client['context']
            txn_count = await db['transactions'].count_documents({'user_id': uid, 'context': ctx})
            client['transaction_count'] = txn_count

        # Summary stats - count across ALL contexts (not filtered)
        all_business = await db['plaid_items'].count_documents({'context': 'business', 'status': {'$in': ['active', 'error', 'pending_expiration']}})
        all_personal = await db['plaid_items'].count_documents({'context': 'personal', 'status': {'$in': ['active', 'error', 'pending_expiration']}})

        return {
            'success': True,
            'clients': clients,
            'total': all_business + all_personal,
            'business_count': all_business,
            'personal_count': all_personal,
        }
    except Exception as e:
        logger.error(f"Admin list plaid clients error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/clients/{target_user_id}/transactions')
async def admin_get_client_transactions(target_user_id: str, request: Request):
    """Get transactions for a specific client (admin view)"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db['users'].find_one({'id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        context = request.query_params.get('context', '')
        year = request.query_params.get('year', '')
        month = request.query_params.get('month', '')
        category = request.query_params.get('category', '')
        limit = int(request.query_params.get('limit', '200'))
        skip = int(request.query_params.get('skip', '0'))

        query = {'user_id': target_user_id}
        if context:
            query['context'] = context
        if category:
            query['$or'] = [
                {'category': category},
                {'ai_category': category},
            ]

        # Date filters
        if year:
            query['date'] = {'$regex': f'^{year}'}
            if month:
                query['date'] = {'$regex': f'^{year}-{month.zfill(2)}'}

        cursor = db['transactions'].find(query, {'_id': 0}).sort('date', -1).skip(skip).limit(limit)
        transactions = []
        async for txn in cursor:
            transactions.append(txn)

        total = await db['transactions'].count_documents(query)

        # Summary
        summary_pipeline = [
            {'$match': query},
            {'$group': {
                '_id': None,
                'total_income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'total_expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }}
        ]
        summary = {'total_income': 0, 'total_expenses': 0, 'count': 0}
        async for doc in db['transactions'].aggregate(summary_pipeline):
            summary = doc

        # Category breakdown
        cat_pipeline = [
            {'$match': query},
            {'$group': {
                '_id': {'$ifNull': ['$ai_category', '$category']},
                'total': {'$sum': '$amount'},
                'count': {'$sum': 1},
            }},
            {'$sort': {'total': -1}},
        ]
        categories = []
        async for cat in db['transactions'].aggregate(cat_pipeline):
            categories.append({
                'category': cat['_id'],
                'total': round(cat['total'], 2),
                'count': cat['count'],
            })

        # Get user info
        target_user = await db['users'].find_one({'id': target_user_id}, {'_id': 0, 'password': 0})

        return {
            'success': True,
            'transactions': transactions,
            'total': total,
            'summary': {
                'income': round(summary.get('total_income', 0), 2),
                'expenses': round(summary.get('total_expenses', 0), 2),
                'count': summary.get('count', 0),
                'net': round(summary.get('total_income', 0) - summary.get('total_expenses', 0), 2),
            },
            'categories': categories,
            'user': target_user,
        }
    except Exception as e:
        logger.error(f"Admin get client transactions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/clients/{target_user_id}/classify')
async def admin_classify_transactions(target_user_id: str, request: Request):
    """AI-classify transactions for a client using GPT-4o"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db['users'].find_one({'id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        body = await request.json()
        context = body.get('context', 'business')
        year = body.get('year', str(datetime.utcnow().year))

        # Get unclassified transactions
        query = {
            'user_id': target_user_id,
            'context': context,
            'date': {'$regex': f'^{year}'},
            '$or': [
                {'ai_category': {'$exists': False}},
                {'ai_category': ''},
                {'ai_category': None},
            ]
        }
        unclassified = []
        async for txn in db['transactions'].find(query, {'_id': 0}).limit(100):
            unclassified.append(txn)

        if not unclassified:
            return {'success': True, 'classified': 0, 'message': 'Todas las transacciones ya están clasificadas'}

        # Build AI prompt
        if context == 'business':
            categories_list = (
                "advertising, car_truck, commissions, contract_labor, depreciation, "
                "employee_benefits, insurance, interest_mortgage, interest_other, "
                "legal_professional, office_expense, pension, rent_vehicles, rent_property, "
                "repairs, supplies, taxes_licenses, travel, meals, utilities, wages, "
                "cogs, other_expense, sales_income, services_income, rental_income, "
                "interest_income, refunds_income, other_income"
            )
            system_prompt = (
                "Eres un clasificador fiscal experto en IRS Schedule C para negocios en Estados Unidos. "
                "Clasifica cada transacción bancaria en una de las categorías del IRS Schedule C. "
                f"Categorías válidas: {categories_list}. "
                "Para ingresos (amounts negativos en Plaid = dinero entrando), usa las categorías que terminan en _income. "
                "Para gastos (amounts positivos en Plaid = dinero saliendo), usa las categorías de gasto. "
                "Responde SOLO con un JSON array donde cada elemento tiene: "
                '{"transaction_id": "...", "ai_category": "...", "ai_confidence": 0.0-1.0, "ai_note": "breve razón"}'
            )
        else:
            categories_list = (
                "housing, transportation, food_groceries, dining_out, utilities, "
                "healthcare, insurance, entertainment, shopping, education, "
                "personal_care, savings_investments, debt_payments, gifts_donations, "
                "subscriptions, income_salary, income_freelance, income_other, transfer, other"
            )
            system_prompt = (
                "Eres un clasificador de finanzas personales. "
                "Clasifica cada transacción bancaria en una categoría de finanzas personales. "
                f"Categorías válidas: {categories_list}. "
                "Responde SOLO con un JSON array donde cada elemento tiene: "
                '{"transaction_id": "...", "ai_category": "...", "ai_confidence": 0.0-1.0, "ai_note": "breve razón"}'
            )

        txn_list = []
        for txn in unclassified:
            txn_list.append({
                'transaction_id': txn['transaction_id'],
                'name': txn.get('name', ''),
                'merchant_name': txn.get('merchant_name', ''),
                'amount': txn.get('amount', 0),
                'date': txn.get('date', ''),
                'plaid_category': txn.get('category', ''),
            })

        # Process in batches of 25 to avoid token limits
        import json as json_module
        import httpx

        # Try to get OpenAI key from config
        openai_key = os.getenv('OPENAI_API_KEY', '')
        
        if not openai_key:
            # Check unified config (system_settings)
            sys_doc = await db['system_settings'].find_one({'_id': 'main'})
            if sys_doc and sys_doc.get('settings'):
                openai_key = sys_doc['settings'].get('openai_api_key', '')
        
        if not openai_key:
            # Fallback: legacy admin_config
            config_doc = await db['admin_config'].find_one({})
            if config_doc:
                openai_key = config_doc.get('OPENAI_API_KEY', '') or config_doc.get('openai_api_key', '')
        
        logger.info(f"🤖 Classify: OpenAI key found: {bool(openai_key and len(openai_key) > 10)}, {len(txn_list)} transactions to classify")

        BATCH_SIZE = 25
        classified_count = 0
        batch_errors = []

        for batch_start in range(0, len(txn_list), BATCH_SIZE):
            batch = txn_list[batch_start:batch_start + BATCH_SIZE]
            user_prompt = f"Clasifica estas {len(batch)} transacciones:\n{str(batch)}"

            ai_response_text = None

            if openai_key and len(openai_key) > 10:
                try:
                    payload = {
                        "model": "gpt-4o",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "max_tokens": 4000,
                        "temperature": 0.1,
                    }
                    async with httpx.AsyncClient(timeout=90.0) as http_client:
                        resp = await http_client.post(
                            "https://api.openai.com/v1/chat/completions",
                            headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                            json=payload,
                        )
                    if resp.status_code == 200:
                        ai_response_text = resp.json()["choices"][0]["message"]["content"]
                    else:
                        logger.error(f"OpenAI classify error {resp.status_code}: {resp.text[:200]}")
                        batch_errors.append(f"Batch {batch_start//BATCH_SIZE + 1}: OpenAI error {resp.status_code}")
                except Exception as oai_err:
                    logger.error(f"OpenAI direct call failed: {oai_err}")
                    batch_errors.append(f"Batch {batch_start//BATCH_SIZE + 1}: {str(oai_err)[:100]}")

            # Fallback to emergentintegrations
            if not ai_response_text:
                emergent_key = os.getenv("EMERGENT_LLM_KEY", "")
                if emergent_key:
                    try:
                        from emergentintegrations.llm.chat import LlmChat, UserMessage
                        chat = LlmChat(
                            api_key=emergent_key,
                            session_id=f"plaid-classify-{target_user_id}-{batch_start}",
                            system_message=system_prompt
                        )
                        chat.with_model("openai", "gpt-4o")
                        ai_response_text = await chat.send_async(UserMessage(text=user_prompt))
                    except Exception as em_err:
                        logger.error(f"Emergent classify fallback failed: {em_err}")

            if not ai_response_text:
                batch_errors.append(f"Batch {batch_start//BATCH_SIZE + 1}: No AI response")
                continue

            # Parse AI response
            try:
                json_start = ai_response_text.find('[')
                json_end = ai_response_text.rfind(']') + 1
                if json_start >= 0 and json_end > json_start:
                    classifications = json_module.loads(ai_response_text[json_start:json_end])
                else:
                    classifications = json_module.loads(ai_response_text)

                # Update transactions in DB
                for cls in classifications:
                    txn_id = cls.get('transaction_id')
                    ai_cat = cls.get('ai_category', '')
                    ai_conf = cls.get('ai_confidence', 0)
                    ai_note = cls.get('ai_note', '')

                    if txn_id and ai_cat:
                        await db['transactions'].update_one(
                            {'transaction_id': txn_id, 'user_id': target_user_id},
                            {'$set': {
                                'ai_category': ai_cat,
                                'ai_confidence': ai_conf,
                                'ai_note': ai_note,
                                'ai_classified_at': datetime.utcnow(),
                            }}
                        )
                        classified_count += 1

            except Exception as parse_err:
                logger.error(f"AI classification parse error batch {batch_start//BATCH_SIZE + 1}: {parse_err}")
                batch_errors.append(f"Batch {batch_start//BATCH_SIZE + 1}: Parse error")

        if classified_count == 0 and batch_errors:
            raise HTTPException(status_code=500, detail=f"No se pudo clasificar. Errores: {'; '.join(batch_errors)}")

        return {
            'success': True,
            'classified': classified_count,
            'total_unclassified_remaining': max(0, len(unclassified) - classified_count),
            'errors': batch_errors if batch_errors else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin classify transactions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/admin/clients/{target_user_id}/report')
async def admin_generate_client_report(target_user_id: str, request: Request):
    """Generate year-end financial report for a client"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db['users'].find_one({'id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        context = request.query_params.get('context', 'business')
        year = request.query_params.get('year', str(datetime.utcnow().year))

        query = {
            'user_id': target_user_id,
            'context': context,
            'date': {'$regex': f'^{year}'},
        }

        # Monthly breakdown
        monthly_pipeline = [
            {'$match': query},
            {'$addFields': {
                'month': {'$substr': ['$date', 5, 2]},
            }},
            {'$group': {
                '_id': '$month',
                'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }},
            {'$sort': {'_id': 1}},
        ]
        monthly = []
        async for doc in db['transactions'].aggregate(monthly_pipeline):
            monthly.append({
                'month': doc['_id'],
                'income': round(doc['income'], 2),
                'expenses': round(doc['expenses'], 2),
                'net': round(doc['income'] - doc['expenses'], 2),
                'count': doc['count'],
            })

        # Category breakdown (use ai_category if available)
        cat_pipeline = [
            {'$match': query},
            {'$addFields': {
                'final_category': {'$ifNull': ['$ai_category', '$category']},
            }},
            {'$group': {
                '_id': '$final_category',
                'income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'count': {'$sum': 1},
            }},
            {'$sort': {'expenses': -1}},
        ]
        categories = []
        async for cat in db['transactions'].aggregate(cat_pipeline):
            categories.append({
                'category': cat['_id'],
                'income': round(cat['income'], 2),
                'expenses': round(cat['expenses'], 2),
                'count': cat['count'],
            })

        # Totals
        total_pipeline = [
            {'$match': query},
            {'$group': {
                '_id': None,
                'total_income': {'$sum': {'$cond': [{'$lt': ['$amount', 0]}, {'$abs': '$amount'}, 0]}},
                'total_expenses': {'$sum': {'$cond': [{'$gt': ['$amount', 0]}, '$amount', 0]}},
                'total_transactions': {'$sum': 1},
            }},
        ]
        totals = {'total_income': 0, 'total_expenses': 0, 'total_transactions': 0}
        async for doc in db['transactions'].aggregate(total_pipeline):
            totals = doc

        # AI classification stats
        classified_count = await db['transactions'].count_documents({**query, 'ai_category': {'$exists': True, '$ne': ''}})
        total_count = await db['transactions'].count_documents(query)

        # Get user info
        target_user = await db['users'].find_one({'id': target_user_id}, {'_id': 0, 'password': 0})

        return {
            'success': True,
            'report': {
                'year': year,
                'context': context,
                'user': target_user,
                'totals': {
                    'income': round(totals.get('total_income', 0), 2),
                    'expenses': round(totals.get('total_expenses', 0), 2),
                    'net': round(totals.get('total_income', 0) - totals.get('total_expenses', 0), 2),
                    'transactions': totals.get('total_transactions', 0),
                },
                'monthly': monthly,
                'categories': categories,
                'ai_classification': {
                    'classified': classified_count,
                    'total': total_count,
                    'percentage': round((classified_count / total_count * 100) if total_count > 0 else 0, 1),
                },
            }
        }
    except Exception as e:
        logger.error(f"Admin generate report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/admin/clients/{target_user_id}/sync')
async def admin_sync_client_transactions(target_user_id: str, request: Request):
    """Admin: Force sync transactions for a specific client"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db['users'].find_one({'id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        client = await get_smart_plaid_client()
        items = []
        async for item in db['plaid_items'].find({'user_id': target_user_id, 'status': 'active'}):
            items.append(item)

        if not items:
            return {'success': False, 'error': 'No active bank connections for this client'}

        total_added = 0
        for item in items:
            access_token = item['access_token']
            cursor_val = item.get('transactions_cursor', '')
            has_more = True

            while has_more:
                sync_req = TransactionsSyncRequest(
                    access_token=access_token,
                    cursor=cursor_val or '',
                )
                response = client.transactions_sync(sync_req)

                for txn in response['added']:
                    txn_data = {
                        'user_id': target_user_id,
                        'item_id': item['item_id'],
                        'transaction_id': txn['transaction_id'],
                        'account_id': txn['account_id'],
                        'amount': txn['amount'],
                        'date': str(txn['date']),
                        'name': txn['name'],
                        'merchant_name': txn.get('merchant_name', ''),
                        'category': txn.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                        'category_detail': txn.get('personal_finance_category', {}).get('detailed', ''),
                        'pending': txn.get('pending', False),
                        'institution_name': item.get('institution_name', ''),
                        'context': item.get('context', 'personal'),
                        'synced_at': datetime.utcnow(),
                    }
                    await db['transactions'].update_one(
                        {'transaction_id': txn['transaction_id'], 'user_id': target_user_id},
                        {'$set': txn_data},
                        upsert=True
                    )
                    total_added += 1

                for removed in response.get('removed', []):
                    await db['transactions'].delete_one({
                        'transaction_id': removed['transaction_id'],
                        'user_id': target_user_id,
                    })

                has_more = response['has_more']
                cursor_val = response['next_cursor']

            await db['plaid_items'].update_one(
                {'_id': item['_id']},
                {'$set': {'transactions_cursor': cursor_val, 'updated_at': datetime.utcnow()}}
            )

        return {'success': True, 'transactions_added': total_added, 'items_synced': len(items)}
    except Exception as e:
        logger.error(f"Admin sync client transactions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get('/admin/clients/{target_user_id}/auth')
async def admin_get_client_auth(target_user_id: str, request: Request):
    """Admin: Get routing and account numbers for a client's linked banks"""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await db['users'].find_one({'id': user_id})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        from plaid.model.auth_get_request import AuthGetRequest
        client = await get_smart_plaid_client()
        
        items = []
        async for item in db['plaid_items'].find({'user_id': target_user_id, 'status': 'active'}):
            items.append(item)

        if not items:
            return {'success': False, 'error': 'No active bank connections'}

        auth_data = []
        for item in items:
            try:
                auth_request = AuthGetRequest(access_token=item['access_token'])
                response = client.auth_get(auth_request)
                
                numbers = response.get('numbers', {})
                ach_numbers = numbers.get('ach', [])
                
                for ach in ach_numbers:
                    # Find matching account info
                    matching_account = None
                    for acct in item.get('accounts', []):
                        if acct.get('account_id') == ach.get('account_id'):
                            matching_account = acct
                            break
                    
                    auth_data.append({
                        'institution_name': item.get('institution_name', ''),
                        'account_name': matching_account.get('name', '') if matching_account else '',
                        'account_mask': matching_account.get('mask', '') if matching_account else '',
                        'account_type': matching_account.get('subtype', '') if matching_account else '',
                        'routing_number': ach.get('routing', ''),
                        'account_number': ach.get('account', ''),
                        'wire_routing': ach.get('wire_routing', ''),
                        'context': item.get('context', 'personal'),
                    })
                    
            except plaid.ApiException as e:
                logger.warning(f"Plaid auth error for item {item.get('item_id')}: {e.body}")
                # Auth product may not be available for this item
                for acct in item.get('accounts', []):
                    auth_data.append({
                        'institution_name': item.get('institution_name', ''),
                        'account_name': acct.get('name', ''),
                        'account_mask': acct.get('mask', ''),
                        'account_type': acct.get('subtype', ''),
                        'routing_number': 'No disponible',
                        'account_number': 'No disponible',
                        'wire_routing': '',
                        'context': item.get('context', 'personal'),
                    })
            except Exception as e:
                logger.error(f"Auth data error: {e}")

        return {'success': True, 'auth_data': auth_data}
    except Exception as e:
        logger.error(f"Admin auth data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════
# AUTOMATIC TRANSACTION SYNC - Background Job
# ═══════════════════════════════════════════════════════════════════

import asyncio

_sync_task = None

async def auto_sync_all_plaid_items():
    """Background task that syncs all active Plaid items every 6 hours."""
    while True:
        try:
            await asyncio.sleep(6 * 60 * 60)  # Wait 6 hours
            if db is None:
                continue
            
            logger.info("🔄 [Auto-Sync] Starting periodic transaction sync for all active items...")
            
            items = []
            async for item in db['plaid_items'].find({'status': 'active'}):
                items.append(item)
            
            if not items:
                logger.info("🔄 [Auto-Sync] No active Plaid items found")
                continue
            
            client = await get_smart_plaid_client()
            total_synced = 0
            errors = 0
            
            for item in items:
                try:
                    access_token = item['access_token']
                    cursor_val = item.get('transactions_cursor', '')
                    user_id = item['user_id']
                    item_added = 0
                    has_more = True
                    
                    while has_more:
                        sync_req = TransactionsSyncRequest(
                            access_token=access_token,
                            cursor=cursor_val or '',
                        )
                        response = client.transactions_sync(sync_req)
                        
                        for txn in response['added']:
                            txn_data = {
                                'user_id': user_id,
                                'item_id': item['item_id'],
                                'transaction_id': txn['transaction_id'],
                                'account_id': txn['account_id'],
                                'amount': txn['amount'],
                                'date': str(txn['date']),
                                'name': txn['name'],
                                'merchant_name': txn.get('merchant_name', ''),
                                'category': txn.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                                'category_detail': txn.get('personal_finance_category', {}).get('detailed', ''),
                                'pending': txn.get('pending', False),
                                'institution_name': item.get('institution_name', ''),
                                'context': item.get('context', 'personal'),
                                'synced_at': datetime.utcnow(),
                            }
                            await db['transactions'].update_one(
                                {'transaction_id': txn['transaction_id'], 'user_id': user_id},
                                {'$set': txn_data},
                                upsert=True
                            )
                            item_added += 1
                        
                        for removed in response.get('removed', []):
                            await db['transactions'].delete_one({
                                'transaction_id': removed['transaction_id'],
                                'user_id': user_id
                            })
                        
                        has_more = response['has_more']
                        cursor_val = response['next_cursor']
                    
                    if item_added > 0 or cursor_val != item.get('transactions_cursor', ''):
                        await db['plaid_items'].update_one(
                            {'_id': item['_id']},
                            {'$set': {'transactions_cursor': cursor_val, 'updated_at': datetime.utcnow()}}
                        )
                    
                    total_synced += item_added
                except Exception as e:
                    errors += 1
                    logger.error(f"❌ [Auto-Sync] Error syncing item {item.get('item_id', '?')}: {e}")
            
            logger.info(f"✅ [Auto-Sync] Complete: {total_synced} new transactions across {len(items)} items ({errors} errors)")
        
        except Exception as e:
            logger.error(f"❌ [Auto-Sync] Fatal error in background sync: {e}")
            await asyncio.sleep(300)  # Wait 5 min on error before retrying


def start_auto_sync():
    """Call this after DB is set to start the background sync task."""
    global _sync_task
    if _sync_task is None or _sync_task.done():
        _sync_task = asyncio.create_task(auto_sync_all_plaid_items())
        logger.info("🟢 [Auto-Sync] Background transaction sync task started (every 6 hours)")


# ═══════════════════════════════════════════════════════════════════
# ADMIN: Force Sync All Items NOW
# ═══════════════════════════════════════════════════════════════════

@router.post('/admin/force-sync-all')
async def admin_force_sync_all(request: Request):
    """Admin endpoint to force-sync ALL active Plaid items immediately."""
    user_id = await get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify admin
    user = await db['users'].find_one({'_id': ObjectId(user_id)})
    if not user or user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        client = await get_smart_plaid_client()
        items = []
        async for item in db['plaid_items'].find({'status': 'active'}):
            items.append(item)
        
        if not items:
            return {'success': True, 'message': 'No hay items activos de Plaid', 'total_added': 0}
        
        total_added = 0
        total_items = 0
        errors = []
        
        for item in items:
            try:
                access_token = item['access_token']
                cursor_val = item.get('transactions_cursor', '')
                item_user_id = item['user_id']
                item_added = 0
                has_more = True
                
                while has_more:
                    sync_req = TransactionsSyncRequest(
                        access_token=access_token,
                        cursor=cursor_val or '',
                    )
                    response = client.transactions_sync(sync_req)
                    
                    for txn in response['added']:
                        txn_data = {
                            'user_id': item_user_id,
                            'item_id': item['item_id'],
                            'transaction_id': txn['transaction_id'],
                            'account_id': txn['account_id'],
                            'amount': txn['amount'],
                            'date': str(txn['date']),
                            'name': txn['name'],
                            'merchant_name': txn.get('merchant_name', ''),
                            'category': txn.get('personal_finance_category', {}).get('primary', 'UNCATEGORIZED'),
                            'category_detail': txn.get('personal_finance_category', {}).get('detailed', ''),
                            'pending': txn.get('pending', False),
                            'institution_name': item.get('institution_name', ''),
                            'context': item.get('context', 'personal'),
                            'synced_at': datetime.utcnow(),
                        }
                        await db['transactions'].update_one(
                            {'transaction_id': txn['transaction_id'], 'user_id': item_user_id},
                            {'$set': txn_data},
                            upsert=True
                        )
                        item_added += 1
                    
                    for removed in response.get('removed', []):
                        await db['transactions'].delete_one({
                            'transaction_id': removed['transaction_id'],
                            'user_id': item_user_id
                        })
                    
                    has_more = response['has_more']
                    cursor_val = response['next_cursor']
                
                await db['plaid_items'].update_one(
                    {'_id': item['_id']},
                    {'$set': {'transactions_cursor': cursor_val, 'updated_at': datetime.utcnow()}}
                )
                total_added += item_added
                total_items += 1
            except Exception as e:
                errors.append(f"{item.get('institution_name', '?')}: {str(e)}")
        
        return {
            'success': True,
            'message': f'Sincronización completa: {total_added} transacciones nuevas de {total_items} cuentas',
            'total_added': total_added,
            'total_items': total_items,
            'errors': errors if errors else None
        }
    except Exception as e:
        logger.error(f"Admin force sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
