"""
ACH Payment Service - Servicio completo de pagos ACH con NACHA compliance
Ross Tax Preparation
"""
import os
import logging
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from io import BytesIO
import base64

from ach_models import (
    ACHPaymentRequest,
    ACHAuthorizationResponse,
    ACHPaymentResponse,
    ACHEventCreate,
    ACHEventResponse,
    EventType,
    ACHAuthorizationDocument,
    ACHEventDocument,
    AuthorizationStatus
)
from authorize_net_service import AuthorizeNetService
from encryption_service import EncryptionService

logger = logging.getLogger(__name__)

class ACHPaymentService:
    """
    Servicio completo de pagos ACH con:
    - Procesamiento de pagos vía Authorize.net
    - Gestión de firmas electrónicas NACHA compliant
    - Generación de PDFs de autorización
    - Sistema de auditoría completo
    - Encriptación de datos sensibles
    """
    
    def __init__(self, db_client: AsyncIOMotorClient):
        self.db = db_client
        self.authorizations_collection = self.db.ach_authorizations
        self.events_collection = self.db.ach_events
        self.nacha_versions_collection = self.db.ach_nacha_versions
        
        # Servicios
        self.authorize_net = AuthorizeNetService(self.db)
        self.encryption = EncryptionService()
        
        # Configuración
        self.business_name = os.getenv('BUSINESS_LEGAL_NAME', 'Ross Lending Solutions LLC')
        self.pdf_storage_path = os.getenv('ACH_PDF_STORAGE_PATH', '/app/backend/ach_pdfs')
        
        # Crear directorio para PDFs si no existe
        os.makedirs(self.pdf_storage_path, exist_ok=True)
        
        logger.info("✅ ACH Payment Service initialized")
    
    async def initialize_async(self):
        """
        Inicialización asíncrona para cargar configuración desde base de datos
        """
        await self.authorize_net.load_config_from_db()
        logger.info("✅ ACH Payment Service async initialization completed")
    
    async def _log_event(
        self,
        authorization_id: str,
        event_type: EventType,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Registra un evento de auditoría"""
        try:
            event = ACHEventDocument(
                authorization_id=authorization_id,
                event_type=event_type.value,
                event_timestamp=datetime.utcnow(),
                ip_address=ip_address,
                user_agent=user_agent,
                metadata=metadata
            )
            
            await self.events_collection.insert_one(event.dict())
            logger.info(f"📝 Evento registrado: {event_type.value} para autorización {authorization_id}")
        
        except Exception as e:
            logger.error(f"❌ Error registrando evento: {str(e)}")
    
    async def _get_nacha_text(self, version: str = "v1.0-es") -> Optional[str]:
        """Obtiene el texto NACHA de la versión especificada"""
        try:
            nacha_doc = await self.nacha_versions_collection.find_one({
                "version": version,
                "is_active": True
            })
            
            if nacha_doc:
                return nacha_doc['authorization_text']
            
            logger.warning(f"⚠️ Versión NACHA {version} no encontrada")
            return None
        
        except Exception as e:
            logger.error(f"❌ Error obteniendo texto NACHA: {str(e)}")
            return None
    
    def _hash_text(self, text: str) -> str:
        """Genera hash SHA256 de un texto"""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
    
    def _mask_account_number(self, account_number: str) -> str:
        """Enmascara número de cuenta, dejando solo los últimos 4 dígitos"""
        return account_number[-4:] if len(account_number) >= 4 else account_number
    
    async def _generate_authorization_pdf(
        self,
        authorization: ACHAuthorizationDocument,
        customer_name: str,
        nacha_text: str
    ) -> str:
        """
        Genera PDF de autorización ACH con toda la información legal
        
        Returns:
            Path del archivo PDF generado
        """
        try:
            # Preparar texto NACHA con datos del cliente
            formatted_nacha = nacha_text.format(
                customer_full_name=customer_name,
                business_legal_name=self.business_name,
                amount_usd=f"${authorization.amount_cents / 100:.2f} USD",
                authorization_date=authorization.signed_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
                account_last4=authorization.account_last4,
                routing_last4=authorization.routing_last4,
                ip_address=authorization.ip_address
            )
            
            # Crear documento PDF
            filename = f"ach_auth_{authorization.customer_id}_{uuid.uuid4().hex[:8]}.pdf"
            filepath = os.path.join(self.pdf_storage_path, filename)
            
            doc = SimpleDocTemplate(filepath, pagesize=letter)
            story = []
            styles = getSampleStyleSheet()
            
            # Título
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#8B1513'),
                spaceAfter=30,
                alignment=1  # Center
            )
            story.append(Paragraph("AUTORIZACIÓN DE DÉBITO ACH", title_style))
            story.append(Paragraph(f"{self.business_name}", styles['Normal']))
            story.append(Spacer(1, 0.3 * inch))
            
            # Información de la transacción
            info_data = [
                ['ID de Autorización:', str(authorization.customer_id)],
                ['Fecha:', authorization.signed_at.strftime("%Y-%m-%d %H:%M:%S UTC")],
                ['Monto:', f"${authorization.amount_cents / 100:.2f} USD"],
                ['Cliente:', customer_name],
                ['Tipo de Cuenta:', authorization.account_type.upper()],
                ['Últimos 4 dígitos - Cuenta:', authorization.account_last4],
                ['Últimos 4 dígitos - Routing:', authorization.routing_last4],
            ]
            
            info_table = Table(info_data, colWidths=[2.5 * inch, 4 * inch])
            info_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(info_table)
            story.append(Spacer(1, 0.3 * inch))
            
            # Texto legal NACHA
            story.append(Paragraph("<b>TÉRMINOS DE AUTORIZACIÓN</b>", styles['Heading2']))
            story.append(Spacer(1, 0.1 * inch))
            
            # Dividir texto NACHA en párrafos
            for paragraph in formatted_nacha.split('\n\n'):
                if paragraph.strip():
                    story.append(Paragraph(paragraph.strip(), styles['Normal']))
                    story.append(Spacer(1, 0.1 * inch))
            
            # Información de firma
            story.append(Spacer(1, 0.2 * inch))
            story.append(Paragraph("<b>FIRMA ELECTRÓNICA</b>", styles['Heading2']))
            story.append(Spacer(1, 0.1 * inch))
            
            signature_data = [
                ['Tipo de Firma:', authorization.signature_type.upper()],
                ['Fecha de Firma:', authorization.signed_at.strftime("%Y-%m-%d %H:%M:%S UTC")],
                ['Dirección IP:', authorization.ip_address],
                ['Hash de Verificación:', authorization.authorization_text_hash[:32] + '...'],
            ]
            
            sig_table = Table(signature_data, colWidths=[2.5 * inch, 4 * inch])
            sig_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(sig_table)
            
            # Footer
            story.append(Spacer(1, 0.3 * inch))
            footer_text = f"Este documento fue generado electrónicamente el {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} y constituye evidencia legal de la autorización ACH otorgada por el cliente."
            story.append(Paragraph(footer_text, styles['Italic']))
            
            # Construir PDF
            doc.build(story)
            
            logger.info(f"📄 PDF generado: {filename}")
            return filepath
        
        except Exception as e:
            logger.error(f"❌ Error generando PDF: {str(e)}")
            raise
    
    async def initiate_ach_payment(
        self,
        payment_request: ACHPaymentRequest
    ) -> ACHPaymentResponse:
        """
        Inicia un pago ACH completo con todos los pasos:
        1. Validación de datos
        2. Obtención de texto NACHA
        3. Encriptación de datos sensibles
        4. Creación de autorización en BD
        5. Procesamiento del pago con Authorize.net
        6. Generación de PDF de evidencia
        7. Registro de eventos de auditoría
        
        Args:
            payment_request: Datos del pago ACH
            
        Returns:
            ACHPaymentResponse con resultado del pago
        """
        
        authorization_id = None
        
        try:
            logger.info(f"🚀 Iniciando pago ACH - Cliente: {payment_request.customer_name}, Monto: ${payment_request.amount_cents / 100:.2f}")
            
            # 1. Obtener texto NACHA
            nacha_text = await self._get_nacha_text(payment_request.authorization_version)
            if not nacha_text:
                return ACHPaymentResponse(
                    success=False,
                    message="Versión de autorización NACHA no disponible",
                    error_code="NACHA_VERSION_NOT_FOUND"
                )
            
            # 2. Generar hash del texto NACHA
            nacha_hash = self._hash_text(nacha_text)
            
            # 3. Enmascarar números de cuenta
            account_last4 = self._mask_account_number(payment_request.account_number)
            routing_last4 = self._mask_account_number(payment_request.routing_number)
            
            # 4. Encriptar firma electrónica
            encrypted_signature = self.encryption.encrypt(payment_request.signature_data)
            
            # 5. Crear documento de autorización
            authorization = ACHAuthorizationDocument(
                customer_id=payment_request.customer_id,
                invoice_id=payment_request.invoice_id,
                amount_cents=payment_request.amount_cents,
                currency="USD",
                routing_last4=routing_last4,
                account_last4=account_last4,
                account_type=payment_request.account_type.value,
                authorization_text_hash=nacha_hash,
                authorization_version=payment_request.authorization_version,
                ip_address=payment_request.ip_address,
                user_agent=payment_request.user_agent,
                signature_type=payment_request.signature_type.value,
                signature_data=encrypted_signature,
                signed_at=datetime.utcnow(),
                status=AuthorizationStatus.PENDING.value,
                raw_payload=payment_request.dict()
            )
            
            # 6. Guardar en BD
            result = await self.authorizations_collection.insert_one(authorization.dict())
            authorization_id = str(result.inserted_id)
            logger.info(f"✅ Autorización creada: {authorization_id}")
            
            # 7. Registrar evento: Firma capturada
            await self._log_event(
                authorization_id=authorization_id,
                event_type=EventType.SIGNATURE_CAPTURED,
                ip_address=payment_request.ip_address,
                user_agent=payment_request.user_agent,
                metadata={
                    "signature_type": payment_request.signature_type.value,
                    "amount_cents": payment_request.amount_cents
                }
            )
            
            # 8. Procesar pago con Authorize.net
            logger.info("💳 Procesando pago con Authorize.net...")
            await self._log_event(
                authorization_id=authorization_id,
                event_type=EventType.PAYMENT_REQUESTED,
                ip_address=payment_request.ip_address,
                metadata={"amount_cents": payment_request.amount_cents}
            )
            
            payment_result = await self.authorize_net.process_echeck_payment(
                amount=payment_request.amount_cents / 100.0,  # Convertir a USD
                routing_number=payment_request.routing_number,
                account_number=payment_request.account_number,
                account_type=payment_request.account_type.value,
                customer_name=payment_request.customer_name,
                customer_email=payment_request.customer_email,
                invoice_number=payment_request.invoice_id,
                description="Tax preparation services - ACH payment"
            )
            
            # 9. Actualizar autorización con resultado del pago
            update_data = {
                "authnet_transaction_id": payment_result.get('transaction_id'),
                "authnet_response_code": payment_result.get('response_code'),
                "authnet_response_text": payment_result.get('response_text'),
                "updated_at": datetime.utcnow()
            }
            
            if payment_result['success']:
                update_data["status"] = AuthorizationStatus.APPROVED.value
                logger.info(f"✅ Pago aprobado - Transaction ID: {payment_result.get('transaction_id')}")
                
                # Registrar evento de aprobación
                await self._log_event(
                    authorization_id=authorization_id,
                    event_type=EventType.PAYMENT_APPROVED,
                    metadata={
                        "transaction_id": payment_result.get('transaction_id'),
                        "response_code": payment_result.get('response_code')
                    }
                )
            else:
                update_data["status"] = AuthorizationStatus.FAILED.value
                logger.warning(f"❌ Pago fallido: {payment_result.get('response_text')}")
                
                # Registrar evento de fallo
                await self._log_event(
                    authorization_id=authorization_id,
                    event_type=EventType.PAYMENT_FAILED,
                    metadata={
                        "response_code": str(payment_result.get('response_code', '')),
                        "response_text": str(payment_result.get('response_text', '')),
                        "error_code": str(payment_result.get('error_code', ''))
                    }
                )
            
            await self.authorizations_collection.update_one(
                {"_id": result.inserted_id},
                {"$set": update_data}
            )
            
            # 10. Generar PDF de evidencia (solo si pago fue aprobado)
            if payment_result['success']:
                try:
                    logger.info("📄 Generando PDF de autorización...")
                    pdf_path = await self._generate_authorization_pdf(
                        authorization=authorization,
                        customer_name=payment_request.customer_name,
                        nacha_text=nacha_text
                    )
                    
                    # Actualizar con path del PDF
                    await self.authorizations_collection.update_one(
                        {"_id": result.inserted_id},
                        {"$set": {"evidence_pdf_path": pdf_path}}
                    )
                    
                    # Registrar evento de PDF generado
                    await self._log_event(
                        authorization_id=authorization_id,
                        event_type=EventType.PDF_GENERATED,
                        metadata={"pdf_path": pdf_path}
                    )
                    
                    logger.info(f"✅ PDF generado: {pdf_path}")
                
                except Exception as pdf_error:
                    logger.error(f"⚠️ Error generando PDF (pago ya procesado): {str(pdf_error)}")
            
            # 11. Obtener autorización actualizada
            final_auth = await self.authorizations_collection.find_one({"_id": result.inserted_id})
            final_auth['id'] = str(final_auth.pop('_id'))
            
            # 12. Preparar respuesta
            return ACHPaymentResponse(
                success=payment_result['success'],
                message=payment_result['response_text'],
                authorization_id=authorization_id,
                transaction_id=payment_result.get('transaction_id'),
                status=update_data["status"],
                authorization_details=ACHAuthorizationResponse(**final_auth)
            )
        
        except Exception as e:
            logger.error(f"❌ Error procesando pago ACH: {str(e)}")
            
            # Registrar evento de error si tenemos authorization_id
            if authorization_id:
                try:
                    await self._log_event(
                        authorization_id=authorization_id,
                        event_type=EventType.PAYMENT_FAILED,
                        metadata={"error": str(e)}
                    )
                    
                    # Actualizar estado a failed
                    await self.authorizations_collection.update_one(
                        {"_id": authorization_id},
                        {"$set": {"status": AuthorizationStatus.FAILED.value}}
                    )
                except:
                    pass
            
            return ACHPaymentResponse(
                success=False,
                message=f"Error procesando pago: {str(e)}",
                error_code="INTERNAL_ERROR"
            )
    
    async def get_authorization(self, authorization_id: str) -> Optional[ACHAuthorizationResponse]:
        """Obtiene una autorización por su ID"""
        try:
            from bson import ObjectId
            auth = await self.authorizations_collection.find_one({"_id": ObjectId(authorization_id)})
            
            if auth:
                auth['id'] = str(auth.pop('_id'))
                return ACHAuthorizationResponse(**auth)
            
            return None
        
        except Exception as e:
            logger.error(f"❌ Error obteniendo autorización: {str(e)}")
            return None
    
    async def get_authorization_events(self, authorization_id: str) -> List[ACHEventResponse]:
        """Obtiene todos los eventos de una autorización"""
        try:
            events = await self.events_collection.find({"authorization_id": authorization_id}).sort("event_timestamp", -1).to_list(100)
            
            result = []
            for event in events:
                event['id'] = str(event.pop('_id'))
                result.append(ACHEventResponse(**event))
            
            return result
        
        except Exception as e:
            logger.error(f"❌ Error obteniendo eventos: {str(e)}")
            return []
    
    async def initialize_nacha_versions(self):
        """Inicializa las versiones del texto NACHA si no existen"""
        try:
            existing = await self.nacha_versions_collection.count_documents({})
            
            if existing == 0:
                logger.info("📝 Inicializando versiones NACHA...")
                
                nacha_text_es = """Autorización de Débito ACH – Pago Único

Yo, {customer_full_name}, por medio de la presente autorizo a {business_legal_name} ("el Comerciante") a debitar electrónicamente de mi cuenta bancaria indicada a continuación, a través de la red ACH (Automated Clearing House), el monto de {amount_usd}, correspondiente al pago de servicios de preparación de impuestos y/o servicios relacionados.

Confirmo que soy el titular autorizado de la cuenta bancaria cuyos datos he proporcionado y que tengo autoridad legal para otorgar esta autorización.

Entiendo y acepto que:
- Esta autorización aplica a un solo pago (transacción única).
- El débito puede reflejarse en mi cuenta bancaria dentro de 1 a 2 días hábiles después de completar esta autorización.
- Es mi responsabilidad asegurar que existan fondos suficientes en la cuenta para cubrir el monto autorizado.
- Podré solicitar una copia de esta autorización en cualquier momento.
- En caso de error en el cargo, tengo derecho a disputar la transacción directamente con mi institución financiera, de acuerdo con las normas aplicables de la red ACH y las leyes vigentes.

Al proporcionar mis datos bancarios, marcar la casilla de aceptación y/o firmar electrónicamente en este formulario, reconozco que:
- He leído y entendido los términos de esta autorización ACH.
- Acepto que mi firma electrónica tiene la misma validez legal que una firma manuscrita.

Fecha de autorización: {authorization_date}
Nombre del cliente: {customer_full_name}
Últimos 4 dígitos de la cuenta bancaria: {account_last4}
Últimos 4 dígitos del número de ruta (routing): {routing_last4}
IP del dispositivo: {ip_address}"""
                
                version_doc = {
                    "version": "v1.0-es",
                    "language_code": "es",
                    "authorization_text": nacha_text_es,
                    "text_hash": self._hash_text(nacha_text_es),
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await self.nacha_versions_collection.insert_one(version_doc)
                logger.info("✅ Versión NACHA v1.0-es creada")
        
        except Exception as e:
            logger.error(f"❌ Error inicializando versiones NACHA: {str(e)}")
    
    async def process_invoice_payment(
        self,
        invoice_id: str,
        user_id: str,
        payment_method_id: str,
        amount: float
    ) -> Dict[str, Any]:
        """
        Procesa el pago de una factura usando un método de pago ACH guardado
        
        Args:
            invoice_id: ID de la factura a pagar
            user_id: ID del usuario
            payment_method_id: ID del método de pago ACH
            amount: Monto a cobrar
        
        Returns:
            Dict con success, transaction_id, y detalles del pago
        """
        try:
            logger.info(f"💳 Procesando pago de factura {invoice_id} con método {payment_method_id}")
            
            # Obtener el método de pago
            payment_method = await self.db.ach_payment_methods.find_one({
                '_id': payment_method_id,
                'user_id': user_id
            })
            
            if not payment_method:
                return {
                    'success': False,
                    'error': 'Método de pago no encontrado'
                }
            
            # Obtener datos del usuario
            user = await self.db.users.find_one({'_id': user_id})
            if not user:
                return {
                    'success': False,
                    'error': 'Usuario no encontrado'
                }
            
            # Desencriptar datos bancarios
            try:
                routing_number = self.encryption.decrypt(payment_method['routing_number_encrypted'])
                account_number = self.encryption.decrypt(payment_method['account_number_encrypted'])
            except Exception as decrypt_error:
                logger.error(f"❌ Error desencriptando datos bancarios: {str(decrypt_error)}")
                return {
                    'success': False,
                    'error': 'Error al procesar el método de pago'
                }
            
            # Procesar el pago con Authorize.net
            payment_result = await self.authorize_net.process_echeck_payment(
                routing_number=routing_number,
                account_number=account_number,
                account_type=payment_method['account_type'],
                bank_name=payment_method.get('bank_name', 'Bank'),
                account_holder_name=payment_method['account_holder_name'],
                amount=amount,
                invoice_number=invoice_id,
                description=f"Pago de factura {invoice_id}",
                customer_id=user_id,
                customer_email=user.get('email', ''),
                customer_phone=user.get('phone', '')
            )
            
            if payment_result['success']:
                logger.info(f"✅ Pago de factura {invoice_id} procesado exitosamente")
                return {
                    'success': True,
                    'transaction_id': payment_result.get('transaction_id'),
                    'response_text': payment_result.get('response_text', 'Pago procesado')
                }
            else:
                logger.error(f"❌ Error procesando pago de factura: {payment_result.get('response_text')}")
                return {
                    'success': False,
                    'error': payment_result.get('response_text', 'Error procesando pago'),
                    'error_code': payment_result.get('error_code')
                }
        
        except Exception as e:
            logger.error(f"❌ Error en process_invoice_payment: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

