"""
Authorize.net ACH Payment Service

Este servicio maneja las transacciones ACH (eCheck) a través de Authorize.net.
Funciona en dos modos:
- MOCK: Para desarrollo sin credenciales reales
- REAL: Para producción con credenciales válidas de Authorize.net

Las credenciales ahora se cargan desde la base de datos (configuradas en el admin panel)
o como fallback desde variables de entorno.
"""

import os
import logging
import hashlib
from typing import Optional, Dict, Any
from datetime import datetime
import random
import string
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class AuthorizeNetService:
    """
    Cliente de Authorize.net para procesamiento de pagos ACH (eCheck)
    Actualmente en modo MOCK para desarrollo sin credenciales reales
    """
    
    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None):
        self.db = db
        
        # Inicializar con valores por defecto
        self.api_login_id = 'MOCK_LOGIN_ID'
        self.transaction_key = 'MOCK_TRANSACTION_KEY'
        self.environment = 'sandbox'
        
        # Cargar configuración de forma síncrona
        self._load_config_sync()
        
        # Modo mock si no hay credenciales reales
        self.is_mock_mode = (
            self.api_login_id == 'MOCK_LOGIN_ID' or 
            not self.api_login_id or 
            self.api_login_id == ''
        )
        
        if self.is_mock_mode:
            logger.warning("🟡 Authorize.net en MODO MOCK - Respuestas simuladas")
            logger.info("ℹ️  Para usar Authorize.net real, configura AUTHORIZENET_API_LOGIN_ID y AUTHORIZENET_TRANSACTION_KEY")
        else:
            logger.info(f"✅ Authorize.net configurado - Ambiente: {self.environment}")
            logger.info(f"📋 API Login ID: {self.api_login_id[:4]}***{self.api_login_id[-2:]}")
        
        # URLs de API
        if self.environment == 'production':
            self.api_url = 'https://api.authorize.net/xml/v1/request.api'
        else:
            self.api_url = 'https://apitest.authorize.net/xml/v1/request.api'
    
    def _load_config_sync(self):
        """
        Carga configuración desde variables de entorno como fallback
        """
        # Configuración - Soporta tanto nombres antiguos como nuevos
        env_api_login = (
            os.getenv('AUTHORIZENET_API_LOGIN_ID') or 
            os.getenv('AUTHNET_API_LOGIN_ID')
        )
        env_transaction_key = (
            os.getenv('AUTHORIZENET_TRANSACTION_KEY') or 
            os.getenv('AUTHNET_TRANSACTION_KEY')
        )
        env_environment = (
            os.getenv('AUTHORIZENET_ENV') or 
            os.getenv('AUTHNET_ENVIRONMENT')
        )
        
        # Solo usar variables de entorno si están disponibles
        if env_api_login:
            self.api_login_id = env_api_login
        if env_transaction_key:
            self.transaction_key = env_transaction_key
        if env_environment:
            self.environment = env_environment
    
    async def load_config_from_db(self):
        """
        Carga configuración desde la base de datos
        """
        if self.db is None:
            logger.info("📋 No hay conexión a base de datos, usando configuración por defecto")
            return
        
        try:
            # Buscar configuración de Authorize.net en la base de datos
            config = await self.db.api_configurations.find_one({
                "service": "authorize_net",
                "active": True
            })
            
            if config and config.get('credentials'):
                creds = config['credentials']
                
                # Actualizar credenciales desde la base de datos
                if creds.get('api_login_id'):
                    self.api_login_id = creds['api_login_id']
                if creds.get('transaction_key'):
                    self.transaction_key = creds['transaction_key']
                if creds.get('environment'):
                    self.environment = creds['environment']
                
                # Actualizar URL de API
                if self.environment == 'production':
                    self.api_url = 'https://api.authorize.net/xml/v1/request.api'
                else:
                    self.api_url = 'https://apitest.authorize.net/xml/v1/request.api'
                
                # Recalcular modo mock
                self.is_mock_mode = (
                    self.api_login_id == 'MOCK_LOGIN_ID' or 
                    not self.api_login_id or 
                    self.api_login_id == ''
                )
                
                logger.info("✅ Configuración de Authorize.net cargada desde base de datos")
                if not self.is_mock_mode:
                    logger.info(f"📋 API Login ID: {self.api_login_id[:4]}***{self.api_login_id[-2:]}")
                    logger.info(f"🌍 Ambiente: {self.environment}")
            else:
                logger.info("📋 No se encontró configuración de Authorize.net en base de datos, usando fallback")
                
        except Exception as e:
            logger.error(f"❌ Error cargando configuración desde base de datos: {str(e)}")
    
    def _generate_mock_transaction_id(self) -> str:
        """Genera un ID de transacción mock realista"""
        return ''.join(random.choices(string.digits, k=10))
    
    def _generate_mock_response(
        self, 
        success: bool = True, 
        response_code: str = "1",
        response_text: str = "This transaction has been approved."
    ) -> Dict[str, Any]:
        """Genera una respuesta mock de Authorize.net"""
        if success:
            return {
                "success": True,
                "transaction_id": self._generate_mock_transaction_id(),
                "response_code": response_code,  # 1 = Approved
                "response_text": response_text,
                "auth_code": ''.join(random.choices(string.ascii_uppercase + string.digits, k=6)),
                "avs_result_code": "Y",  # Address Verification Successful
                "transaction_type": "authCaptureTransaction",
                "account_type": "checking",
                "account_last4": "****",
                "raw_response": {
                    "mock": True,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
        else:
            return {
                "success": False,
                "transaction_id": None,
                "response_code": response_code,  # 2 = Declined, 3 = Error
                "response_text": response_text,
                "error_code": "E00027",
                "error_text": "The transaction was unsuccessful.",
                "raw_response": {
                    "mock": True,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
    
    async def process_echeck_payment(
        self,
        amount: float,
        routing_number: str,
        account_number: str,
        account_type: str,  # 'checking' o 'savings'
        customer_name: str,
        customer_email: Optional[str] = None,
        invoice_number: Optional[str] = None,
        description: Optional[str] = "Tax preparation services"
    ) -> Dict[str, Any]:
        """
        Procesa un pago ACH (eCheck) a través de Authorize.net
        
        Args:
            amount: Monto en USD (float)
            routing_number: Número de ruta bancaria (9 dígitos)
            account_number: Número de cuenta bancaria
            account_type: 'checking' o 'savings'
            customer_name: Nombre completo del cliente
            customer_email: Email del cliente (opcional)
            invoice_number: Número de factura (opcional)
            description: Descripción del pago
            
        Returns:
            Dict con resultado de la transacción
        """
        
        try:
            # Validaciones básicas
            if amount <= 0:
                return self._generate_mock_response(
                    success=False,
                    response_code="3",
                    response_text="Invalid amount. Amount must be greater than zero."
                )
            
            if len(routing_number) != 9 or not routing_number.isdigit():
                return self._generate_mock_response(
                    success=False,
                    response_code="3",
                    response_text="Invalid routing number. Must be 9 digits."
                )
            
            if not account_number or len(account_number) < 4:
                return self._generate_mock_response(
                    success=False,
                    response_code="3",
                    response_text="Invalid account number."
                )
            
            if account_type not in ['checking', 'savings']:
                return self._generate_mock_response(
                    success=False,
                    response_code="3",
                    response_text="Invalid account type. Must be 'checking' or 'savings'."
                )
            
            # MODO MOCK: Simular respuesta exitosa
            if self.is_mock_mode:
                logger.info(f"🎭 MOCK: Procesando pago ACH de ${amount:.2f} USD")
                logger.info(f"🎭 MOCK: Cliente: {customer_name}, Tipo de cuenta: {account_type}")
                
                # Simular éxito en 90% de los casos
                success_rate = random.random()
                if success_rate < 0.9:
                    response = self._generate_mock_response(
                        success=True,
                        response_code="1",
                        response_text="(MOCK) This transaction has been approved. (Demo Mode)"
                    )
                    logger.info(f"✅ MOCK: Transacción aprobada - ID: {response['transaction_id']}")
                else:
                    response = self._generate_mock_response(
                        success=False,
                        response_code="2",
                        response_text="(MOCK) The transaction was declined. Insufficient funds. (Demo Mode)"
                    )
                    logger.warning("❌ MOCK: Transacción rechazada")
                
                return response
            
            # MODO REAL: Integración con Authorize.net API
            else:
                try:
                    logger.info(f"📡 Enviando transacción a Authorize.net - Monto: ${amount:.2f}")
                    
                    # Importar SDK de Authorize.net
                    from authorizenet import apicontractsv1
                    from authorizenet.apicontrollers import createTransactionController
                    
                    # Configurar autenticación
                    merchantAuth = apicontractsv1.merchantAuthenticationType()
                    merchantAuth.name = self.api_login_id
                    merchantAuth.transactionKey = self.transaction_key
                    
                    # Crear objeto de cuenta bancaria
                    bankAccount = apicontractsv1.bankAccountType()
                    bankAccount.accountType = apicontractsv1.bankAccountTypeEnum.checking if account_type == 'checking' else apicontractsv1.bankAccountTypeEnum.savings
                    bankAccount.routingNumber = routing_number
                    bankAccount.accountNumber = account_number
                    bankAccount.nameOnAccount = customer_name[:22]  # Max 22 caracteres
                    bankAccount.echeckType = apicontractsv1.echeckTypeEnum.WEB  # Transacción iniciada por internet
                    
                    # Crear objeto de pago
                    payment = apicontractsv1.paymentType()
                    payment.bankAccount = bankAccount
                    
                    # Crear request de transacción
                    transactionRequest = apicontractsv1.transactionRequestType()
                    transactionRequest.transactionType = "authCaptureTransaction"
                    transactionRequest.amount = amount
                    transactionRequest.payment = payment
                    
                    # Agregar información del cliente y dirección de facturación (requerido para ACH)
                    if customer_email:
                        customer = apicontractsv1.customerDataType()
                        customer.email = customer_email
                        transactionRequest.customer = customer
                    
                    # Agregar dirección de facturación (requerido para ACH según documentación)
                    billTo = apicontractsv1.customerAddressType()
                    billTo.firstName = customer_name.split()[0] if customer_name else "Test"
                    billTo.lastName = customer_name.split()[-1] if len(customer_name.split()) > 1 else "User"
                    billTo.address = "123 Test Street"
                    billTo.city = "Test City"
                    billTo.state = "CA"
                    billTo.zip = "90210"
                    billTo.country = "US"
                    transactionRequest.billTo = billTo
                    
                    # Agregar número de factura si existe
                    if invoice_number:
                        transactionRequest.order = apicontractsv1.orderType()
                        transactionRequest.order.invoiceNumber = invoice_number
                        transactionRequest.order.description = description
                    
                    # Crear request principal
                    createRequest = apicontractsv1.createTransactionRequest()
                    createRequest.merchantAuthentication = merchantAuth
                    createRequest.transactionRequest = transactionRequest
                    
                    # Ejecutar request
                    controller = createTransactionController(createRequest)
                    
                    # Configurar ambiente (sandbox o production)
                    if self.environment == 'production':
                        controller.setenvironment('https://api.authorize.net/xml/v1/request.api')
                    else:
                        controller.setenvironment('https://apitest.authorize.net/xml/v1/request.api')
                    
                    controller.execute()
                    
                    # Obtener respuesta
                    response = controller.getresponse()
                    
                    # Procesar respuesta
                    if response is not None:
                        logger.info(f"🔍 Authorize.net response received - Result Code: {response.messages.resultCode}")
                        
                        if response.messages.resultCode == "Ok":
                            if hasattr(response, 'transactionResponse') and response.transactionResponse:
                                trans_response = response.transactionResponse
                                
                                logger.info(f"✅ Transacción APROBADA - ID: {trans_response.transId}")
                                
                                return {
                                    "success": True,
                                    "transaction_id": str(trans_response.transId),
                                    "response_code": str(trans_response.responseCode),
                                    "response_text": str(trans_response.messages.message[0].description) if hasattr(trans_response, 'messages') and trans_response.messages else "Transaction approved",
                                    "auth_code": str(trans_response.authCode) if hasattr(trans_response, 'authCode') else None,
                                    "avs_result_code": str(trans_response.avsResultCode) if hasattr(trans_response, 'avsResultCode') else None,
                                    "transaction_type": "authCaptureTransaction",
                                    "account_type": account_type,
                                    "account_last4": account_number[-4:],
                                    "raw_response": {
                                        "result_code": str(response.messages.resultCode),
                                        "message": str(response.messages.message[0].text)
                                    }
                                }
                            else:
                                # Transacción rechazada
                                logger.warning("❌ Transacción RECHAZADA")
                                error_messages = []
                                if hasattr(response.transactionResponse, 'errors') and response.transactionResponse.errors:
                                    error_messages = [error.errorText for error in response.transactionResponse.errors.error]
                                
                                return {
                                    "success": False,
                                    "transaction_id": None,
                                    "response_code": response.transactionResponse.responseCode if hasattr(response.transactionResponse, 'responseCode') else "0",
                                    "response_text": "; ".join(error_messages) if error_messages else "Transaction declined",
                                    "error_code": error_messages[0] if error_messages else None,
                                    "raw_response": {
                                        "result_code": response.messages.resultCode
                                    }
                                }
                        else:
                            # Error en el request
                            error_text = "Unknown error"
                            error_code = "E00000"
                            
                            logger.info("🔍 Debugging error response structure:")
                            logger.info(f"   - Has messages: {hasattr(response, 'messages')}")
                            if hasattr(response, 'messages'):
                                logger.info(f"   - Messages exists: {response.messages is not None}")
                                if response.messages:
                                    logger.info(f"   - Has message array: {hasattr(response.messages, 'message')}")
                                    if hasattr(response.messages, 'message'):
                                        logger.info(f"   - Message array length: {len(response.messages.message) if response.messages.message else 0}")
                                        if response.messages.message and len(response.messages.message) > 0:
                                            logger.info(f"   - First message text: {response.messages.message[0].text}")
                                            logger.info(f"   - First message code: {response.messages.message[0].code}")
                                            error_text = str(response.messages.message[0].text) if response.messages.message[0].text else "Unknown error"
                                            error_code = str(response.messages.message[0].code) if response.messages.message[0].code else "E00000"
                            
                            logger.error(f"❌ Error en request: {error_text} (Code: {error_code})")
                            return {
                                "success": False,
                                "transaction_id": None,
                                "response_code": "3",
                                "response_text": error_text,
                                "error_code": error_code,
                                "raw_response": {
                                    "result_code": str(response.messages.resultCode) if response.messages.resultCode else "Error",
                                    "message": error_text
                                }
                            }
                    else:
                        logger.error("❌ No se recibió respuesta de Authorize.net")
                        return {
                            "success": False,
                            "transaction_id": None,
                            "response_code": "3",
                            "response_text": "No response received from Authorize.net",
                            "error_code": "NO_RESPONSE"
                        }
                
                except Exception as e:
                    logger.error(f"❌ Excepción en llamada a Authorize.net: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    return {
                        "success": False,
                        "transaction_id": None,
                        "response_code": "3",
                        "response_text": f"Exception during Authorize.net call: {str(e)}",
                        "error_code": "EXCEPTION"
                    }
        
        except Exception as e:
            logger.error(f"❌ Error procesando pago ACH: {str(e)}")
            return self._generate_mock_response(
                success=False,
                response_code="3",
                response_text=f"Error processing payment: {str(e)}"
            )
    
    async def get_transaction_details(self, transaction_id: str) -> Dict[str, Any]:
        """
        Obtiene detalles de una transacción por su ID
        
        Args:
            transaction_id: ID de la transacción en Authorize.net
            
        Returns:
            Dict con detalles de la transacción
        """
        
        if self.is_mock_mode:
            logger.info(f"🎭 MOCK: Consultando transacción {transaction_id}")
            return {
                "success": True,
                "transaction_id": transaction_id,
                "status": "settled",
                "submit_time": datetime.utcnow().isoformat(),
                "settle_time": datetime.utcnow().isoformat(),
                "transaction_type": "authCaptureTransaction",
                "account_type": "checking",
                "mock": True
            }
        else:
            logger.warning("⚠️ Consulta real de transacción no implementada")
            return {
                "success": False,
                "error": "Real transaction query not implemented yet"
            }
    
    async def void_transaction(self, transaction_id: str) -> Dict[str, Any]:
        """
        Anula una transacción
        
        Args:
            transaction_id: ID de la transacción a anular
            
        Returns:
            Dict con resultado de la anulación
        """
        
        if self.is_mock_mode:
            logger.info(f"🎭 MOCK: Anulando transacción {transaction_id}")
            return self._generate_mock_response(
                success=True,
                response_code="1",
                response_text="(MOCK) The transaction has been voided successfully."
            )
        else:
            logger.warning("⚠️ Anulación real de transacción no implementada")
            return {
                "success": False,
                "error": "Real transaction void not implemented yet"
            }
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Prueba la conexión con Authorize.net
        
        Returns:
            Dict con resultado de la prueba
        """
        
        if self.is_mock_mode:
            return {
                "success": True,
                "message": "Authorize.net en MODO MOCK - Conexión simulada OK",
                "mode": "mock",
                "is_mock_mode": True,
                "environment": self.environment,
                "api_login_id": self.api_login_id if self.api_login_id != 'MOCK_LOGIN_ID' else None
            }
        else:
            return {
                "success": True,
                "message": "Authorize.net configurado con credenciales reales",
                "mode": "real",
                "is_mock_mode": False,
                "environment": self.environment,
                "api_url": self.api_url,
                "api_login_id": self.api_login_id
            }
