"""
Authorize.net ACH Client
Cliente para procesamiento de pagos ACH vía Authorize.net
"""
import logging
import os
import json
import hashlib
import requests
from typing import Dict, Any, Optional
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

class AuthorizeNetClient:
    """Cliente para Authorize.net ACH/eCheck"""
    
    def __init__(self):
        # Cargar credenciales desde variables de entorno
        self.api_login_id = os.getenv('AUTHNET_API_LOGIN_ID')
        self.transaction_key = os.getenv('AUTHNET_TRANSACTION_KEY')
        self.environment = os.getenv('AUTHNET_ENVIRONMENT', 'sandbox')
        
        # Endpoints
        if self.environment == 'production':
            self.api_url = 'https://api.authorize.net/xml/v1/request.api'
        else:
            self.api_url = 'https://apitest.authorize.net/xml/v1/request.api'
        
        if not self.api_login_id or not self.transaction_key:
            logger.warning("⚠️ Authorize.net credentials not configured")
        else:
            logger.info(f"✅ Authorize.net client initialized ({self.environment})")
    
    def validate_routing_number(self, routing_number: str) -> bool:
        """
        Valida formato de routing number (9 dígitos)
        Implementa algoritmo de checksum ABA
        """
        # Limpiar routing number
        routing = routing_number.replace('-', '').replace(' ', '')
        
        # Debe tener exactamente 9 dígitos
        if not routing.isdigit() or len(routing) != 9:
            return False
        
        # Validar checksum ABA
        try:
            digits = [int(d) for d in routing]
            checksum = (
                3 * (digits[0] + digits[3] + digits[6]) +
                7 * (digits[1] + digits[4] + digits[7]) +
                (digits[2] + digits[5] + digits[8])
            )
            return checksum % 10 == 0
        except Exception as e:
            logger.error(f"Error validating routing number: {e}")
            return False
    
    def mask_account_number(self, account_number: str) -> str:
        """Enmascara número de cuenta, muestra solo últimos 4"""
        if len(account_number) <= 4:
            return account_number
        return '*' * (len(account_number) - 4) + account_number[-4:]
    
    def get_last_four(self, number: str) -> str:
        """Obtiene últimos 4 dígitos de cualquier número"""
        clean_number = number.replace('-', '').replace(' ', '')
        return clean_number[-4:] if len(clean_number) >= 4 else clean_number
    
    async def create_ach_transaction(
        self,
        amount: Decimal,
        customer_data: Dict[str, Any],
        bank_account_data: Dict[str, Any],
        invoice_id: Optional[str] = None,
        authorization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Crea transacción ACH en Authorize.net
        
        Args:
            amount: Monto en USD (Decimal)
            customer_data: {
                'first_name': str,
                'last_name': str,
                'email': str,
                'address': str (opcional),
                'city': str (opcional),
                'state': str (opcional),
                'zip': str (opcional)
            }
            bank_account_data: {
                'routing_number': str,
                'account_number': str,
                'account_type': 'checking' | 'savings',
                'name_on_account': str
            }
            invoice_id: ID de factura (opcional)
            authorization_id: ID de autorización NACHA (opcional)
        
        Returns:
            {
                'success': bool,
                'transaction_id': str,
                'response_code': str,
                'response_text': str,
                'auth_code': str (opcional),
                'error': str (opcional)
            }
        """
        try:
            if not self.api_login_id or not self.transaction_key:
                return {
                    'success': False,
                    'error': 'Authorize.net credentials not configured'
                }
            
            # Validar routing number
            if not self.validate_routing_number(bank_account_data['routing_number']):
                return {
                    'success': False,
                    'error': 'Invalid routing number'
                }
            
            # Construir payload de Authorize.net
            payload = {
                "createTransactionRequest": {
                    "merchantAuthentication": {
                        "name": self.api_login_id,
                        "transactionKey": self.transaction_key
                    },
                    "refId": authorization_id or f"ACH-{datetime.utcnow().timestamp()}",
                    "transactionRequest": {
                        "transactionType": "authCaptureTransaction",
                        "amount": str(amount),
                        "payment": {
                            "bankAccount": {
                                "accountType": bank_account_data['account_type'],
                                "routingNumber": bank_account_data['routing_number'],
                                "accountNumber": bank_account_data['account_number'],
                                "nameOnAccount": bank_account_data['name_on_account'],
                                "echeckType": "WEB",  # WEB para pagos por internet
                                "bankName": ""  # Opcional
                            }
                        },
                        "billTo": {
                            "firstName": customer_data.get('first_name', ''),
                            "lastName": customer_data.get('last_name', ''),
                            "email": customer_data.get('email', '')
                        },
                        "order": {
                            "invoiceNumber": invoice_id or '',
                            "description": "Tax Preparation Services - Ross Tax"
                        },
                        "customerIP": customer_data.get('ip_address', ''),
                        "transactionSettings": {
                            "setting": [
                                {
                                    "settingName": "emailCustomer",
                                    "settingValue": "false"  # Manejamos emails nosotros
                                }
                            ]
                        }
                    }
                }
            }
            
            # Agregar dirección si está disponible
            if customer_data.get('address'):
                payload["createTransactionRequest"]["transactionRequest"]["billTo"].update({
                    "address": customer_data.get('address', ''),
                    "city": customer_data.get('city', ''),
                    "state": customer_data.get('state', ''),
                    "zip": customer_data.get('zip', ''),
                    "country": "US"
                })
            
            # Hacer request a Authorize.net
            logger.info(f"🔐 Creating ACH transaction for amount: ${amount}")
            
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            response = requests.post(
                self.api_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            # Procesar respuesta
            return self.handle_transaction_response(result)
            
        except requests.RequestException as e:
            logger.error(f"❌ Authorize.net request error: {e}")
            return {
                'success': False,
                'error': f'Network error: {str(e)}'
            }
        except Exception as e:
            logger.error(f"❌ Error creating ACH transaction: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def handle_transaction_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Procesa respuesta de Authorize.net
        
        Response codes:
        1 = Approved
        2 = Declined
        3 = Error
        4 = Held for Review
        """
        try:
            trans_response = response.get('transactionResponse', {})
            
            response_code = trans_response.get('responseCode', '3')
            
            result = {
                'success': response_code == '1',
                'transaction_id': trans_response.get('transId', ''),
                'response_code': response_code,
                'response_text': trans_response.get('messages', [{}])[0].get('description', '') if trans_response.get('messages') else '',
                'auth_code': trans_response.get('authCode', ''),
                'account_number_masked': trans_response.get('accountNumber', ''),
                'raw_response': response
            }
            
            # Procesar errores
            if response_code != '1':
                errors = trans_response.get('errors', [])
                if errors:
                    error_messages = [f"{e.get('errorCode', '')}: {e.get('errorText', '')}" for e in errors]
                    result['error'] = '; '.join(error_messages)
                else:
                    result['error'] = result['response_text']
            
            # Log resultado
            if result['success']:
                logger.info(f"✅ ACH transaction approved: {result['transaction_id']}")
            else:
                logger.warning(f"❌ ACH transaction failed: {result.get('error', 'Unknown error')}")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error handling transaction response: {e}")
            return {
                'success': False,
                'error': f'Error processing response: {str(e)}',
                'raw_response': response
            }
    
    async def get_transaction_details(self, transaction_id: str) -> Dict[str, Any]:
        """
        Obtiene detalles de una transacción
        """
        try:
            payload = {
                "getTransactionDetailsRequest": {
                    "merchantAuthentication": {
                        "name": self.api_login_id,
                        "transactionKey": self.transaction_key
                    },
                    "transId": transaction_id
                }
            }
            
            response = requests.post(
                self.api_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            return {
                'success': True,
                'transaction': result.get('transaction', {})
            }
            
        except Exception as e:
            logger.error(f"Error getting transaction details: {e}")
            return {
                'success': False,
                'error': str(e)
            }

# Instancia global
authorize_net_client = AuthorizeNetClient()

logger.info("✅ Authorize.net ACH Client module loaded")
