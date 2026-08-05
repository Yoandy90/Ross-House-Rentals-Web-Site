"""
Invoice Endpoints - Endpoints completos para sistema de facturación
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
import logging
from datetime import datetime
from bson import ObjectId

from invoice_models import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    InvoiceStatus, InvoicePaymentRequest
)
from invoice_service import InvoiceService
from invoice_pdf_service import InvoicePDFService
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

def init_invoice_endpoints(
    app,
    api_router: APIRouter,
    get_current_user_func,
    require_admin_func,
    get_database_func,
    ach_payment_service
):
    """
    Inicializa los endpoints de facturas
    
    Args:
        app: Instancia de FastAPI app
        api_router: Router de FastAPI
        get_current_user_func: Función para obtener usuario actual
        require_admin_func: Función para requerir admin
        get_database_func: Función para obtener instancia de base de datos
        ach_payment_service: Servicio de ACH para procesar pagos
    """
    
    # Crear instancia del servicio de facturas
    db = get_database_func()
    invoice_service = InvoiceService(db)
    
    # ================== CLIENT ENDPOINTS ==================
    
    @app.get('/api/invoices/my-invoices', response_model=List[InvoiceResponse])
    async def get_my_invoices(
        status: Optional[InvoiceStatus] = Query(None),
        current_user: dict = Depends(get_current_user_func)
    ):
        """Obtiene las facturas del usuario actual (admins ven todas)"""
        try:
            logger.info(f"📋 Usuario {current_user['email']} (rol: {current_user.get('role', 'client')}) solicitando facturas")
            
            # Si es admin, mostrar todas las facturas
            if current_user.get('role') in ['admin', 'office_assistant']:
                invoices = await invoice_service.get_all_invoices(status=status)
                logger.info(f"✅ Admin: Devolviendo {len(invoices)} facturas (todas)")
            else:
                invoices = await invoice_service.get_user_invoices(
                    user_id=current_user['id'],
                    status=status
                )
                logger.info(f"✅ Cliente: Devolviendo {len(invoices)} facturas para usuario {current_user['id']}")
            
            return invoices
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo facturas del usuario: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get('/api/invoices/{invoice_id}', response_model=InvoiceResponse)
    async def get_invoice(
        invoice_id: str,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Obtiene una factura específica"""
        try:
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Verificar que el usuario tiene acceso a esta factura
            if current_user['role'] not in ['admin', 'office_assistant']:
                if invoice.user_id != current_user['id']:
                    raise HTTPException(status_code=403, detail="No tienes acceso a esta factura")
            
            return invoice
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error obteniendo factura: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get('/api/invoices/{invoice_id}/pdf')
    async def download_invoice_pdf(
        invoice_id: str,
        token: Optional[str] = Query(None)
    ):
        """Descarga el PDF de una factura - acepta token en query param para descarga directa"""
        try:
            current_user = None
            
            # Validar token del query param
            if token:
                try:
                    from bson import ObjectId
                    # Buscar sesión por token (en user_sessions, la colección correcta)
                    session = await db.user_sessions.find_one({"session_token": token})
                    
                    if not session:
                        logger.warning(f"⚠️ Sesión no encontrada para token: {token[:20]}...")
                        raise HTTPException(status_code=401, detail="Sesión no encontrada o expirada")
                    
                    # Intentar buscar usuario por ObjectId o string
                    user_id = session["user_id"]
                    user = None
                    try:
                        user = await db.users.find_one({"_id": ObjectId(user_id)})
                    except Exception:
                        pass
                    if not user:
                        user = await db.users.find_one({"_id": user_id})
                    
                    if not user:
                        logger.warning(f"⚠️ Usuario no encontrado para user_id: {user_id}")
                        raise HTTPException(status_code=401, detail="Usuario no encontrado")
                    
                    current_user = {
                        'id': str(user['_id']),
                        'email': user.get('email', ''),
                        'role': user.get('role', 'client'),
                        'name': user.get('name', '')
                    }
                except HTTPException:
                    raise
                except Exception as e:
                    logger.error(f"Error validando token: {e}")
                    raise HTTPException(status_code=401, detail="Token inválido o expirado")
            
            if not current_user:
                raise HTTPException(status_code=401, detail="Token requerido. Proporciona ?token=TU_TOKEN")
            logger.info(f"📄 Usuario {current_user['email']} descargando PDF de factura {invoice_id}")
            
            # Obtener la factura
            logger.info(f"🔍 Buscando factura con ID: {invoice_id} (tipo: {type(invoice_id).__name__}, longitud: {len(invoice_id)})")
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                logger.error(f"❌ Factura no encontrada para ID: {invoice_id}")
                # Intentar buscar directamente en la colección para debug
                from bson import ObjectId
                try:
                    direct_search = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
                    logger.info(f"🔍 Búsqueda directa por ObjectId: {'Encontrada' if direct_search else 'No encontrada'}")
                except Exception as e:
                    logger.info(f"🔍 Error en búsqueda directa: {e}")
                raise HTTPException(status_code=404, detail=f"Factura no encontrada (ID: {invoice_id})")
            
            # Verificar que el usuario tiene acceso a esta factura
            if current_user['role'] not in ['admin', 'office_assistant']:
                if invoice.user_id != current_user['id']:
                    raise HTTPException(status_code=403, detail="No tienes acceso a esta factura")
            
            # Obtener datos del usuario de la factura
            user = None
            # Intentar buscar por _id como ObjectId
            try:
                from bson import ObjectId
                user = await db.users.find_one({'_id': ObjectId(invoice.user_id)})
            except:
                pass
            
            # Si no se encuentra, buscar por _id como string
            if not user:
                user = await db.users.find_one({'_id': invoice.user_id})
            
            # Si aún no se encuentra, buscar por campo id
            if not user:
                user = await db.users.find_one({'id': invoice.user_id})
            
            if not user:
                # Si no encontramos el usuario, usar datos genéricos
                logger.warning(f"⚠️ Usuario {invoice.user_id} no encontrado, usando datos genéricos")
                user = {'name': 'Cliente', 'email': 'N/A', 'phone': ''}
            
            # Convertir invoice a dict
            # Los items pueden ser objetos o diccionarios dependiendo de cómo se creó la factura
            items_list = []
            for item in invoice.items:
                if isinstance(item, dict):
                    items_list.append({
                        'description': item.get('description', ''),
                        'quantity': item.get('quantity', 1),
                        'unit_price': item.get('unit_price', 0)
                    })
                else:
                    items_list.append({
                        'description': item.description,
                        'quantity': item.quantity,
                        'unit_price': item.unit_price
                    })
            
            invoice_dict = {
                'invoice_number': invoice.invoice_number,
                'created_at': invoice.created_at.isoformat() if hasattr(invoice.created_at, 'isoformat') else str(invoice.created_at),
                'due_date': invoice.due_date.isoformat() if invoice.due_date and hasattr(invoice.due_date, 'isoformat') else str(invoice.due_date) if invoice.due_date else None,
                'status': invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status),
                'items': items_list,
                'subtotal': invoice.subtotal,
                'tax': invoice.tax,
                'total': invoice.total,
                'notes': invoice.notes
            }
            
            user_dict = {
                'name': user.get('name', 'Cliente'),
                'email': user.get('email', 'N/A'),
                'phone': user.get('phone', '')
            }
            
            # Generar PDF
            pdf_buffer = InvoicePDFService.generate_invoice_pdf(invoice_dict, user_dict)
            
            # Retornar como descarga
            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=Factura_{invoice.invoice_number}.pdf"
                }
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error descargando PDF de factura: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/invoices/{invoice_id}/pay')
    async def pay_invoice(
        invoice_id: str,
        payment_request: InvoicePaymentRequest,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Paga una factura usando un método de pago guardado"""
        try:
            logger.info(f"💳 Usuario {current_user['email']} pagando factura {invoice_id}")
            
            # Obtener la factura
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            if invoice.user_id != current_user['id']:
                raise HTTPException(status_code=403, detail="Esta factura no te pertenece")
            
            if invoice.status != InvoiceStatus.PENDING:
                raise HTTPException(
                    status_code=400,
                    detail=f"Esta factura no puede ser pagada. Estado actual: {invoice.status}"
                )
            
            # Obtener el método de pago
            payment_method = await db.ach_payment_methods.find_one({
                '_id': payment_request.payment_method_id,
                'user_id': current_user['id']
            })
            
            if not payment_method:
                raise HTTPException(status_code=404, detail="Método de pago no encontrado")
            
            # Procesar el pago con el servicio ACH
            payment_result = await ach_payment_service.process_invoice_payment(
                invoice_id=invoice_id,
                user_id=current_user['id'],
                payment_method_id=payment_request.payment_method_id,
                amount=invoice.total
            )
            
            if not payment_result.get('success'):
                raise HTTPException(
                    status_code=400,
                    detail=f"Error procesando el pago: {payment_result.get('error', 'Unknown error')}"
                )
            
            # Actualizar el estado de la factura
            updated_invoice = await invoice_service.pay_invoice(
                invoice_id=invoice_id,
                user_id=current_user['id'],
                payment_method_id=payment_request.payment_method_id
            )
            
            logger.info(f"✅ Factura {invoice.invoice_number} pagada exitosamente")
            
            # Crear notificación
            await invoice_service.create_invoice_notification(
                user_id=current_user['id'],
                invoice_id=invoice_id,
                invoice_number=invoice.invoice_number,
                service_name=f"Pago de {invoice.service_name}",
                total=invoice.total
            )
            
            return {
                'success': True,
                'message': 'Factura pagada exitosamente',
                'invoice': updated_invoice,
                'transaction_id': payment_result.get('transaction_id')
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error pagando factura: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/invoices/{invoice_id}/create-payment-intent')
    async def create_invoice_payment_intent(
        invoice_id: str,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Crea un Payment Intent de Stripe para pagar una factura"""
        import stripe
        import os
        
        try:
            logger.info(f"💳 Creando Payment Intent para factura {invoice_id}")
            
            # Obtener la factura
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Verificar que el usuario tiene acceso a esta factura
            if invoice.user_id != current_user['id']:
                raise HTTPException(status_code=403, detail="No tienes acceso a esta factura")
            
            if invoice.status not in ['pending', 'overdue']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Esta factura no puede ser pagada. Estado: {invoice.status}"
                )
            
            # Configurar Stripe
            stripe_key = os.getenv('STRIPE_SECRET_KEY')
            if not stripe_key:
                # Intentar obtener de la configuración
                config = await db.app_config.find_one({'key': 'settings'})
                if config:
                    stripe_key = config.get('stripe_api_key')
            
            if not stripe_key:
                raise HTTPException(status_code=500, detail="Stripe no está configurado")
            
            stripe.api_key = stripe_key
            
            # Obtener o crear cliente de Stripe
            # Try to find user by _id (as string or ObjectId)
            user_data = await db.users.find_one({'_id': current_user['id']})
            if not user_data:
                try:
                    user_data = await db.users.find_one({'_id': ObjectId(current_user['id'])})
                except:
                    pass
            
            stripe_customer_id = None
            
            if user_data and user_data.get('stripe_customer_id'):
                stripe_customer_id = user_data['stripe_customer_id']
            else:
                # Crear cliente de Stripe
                customer = stripe.Customer.create(
                    email=current_user['email'],
                    name=current_user.get('name', ''),
                    metadata={'user_id': current_user['id']}
                )
                stripe_customer_id = customer.id
                
                # Guardar el ID del cliente de Stripe
                await db.users.update_one(
                    {'_id': current_user['id']},
                    {'$set': {'stripe_customer_id': stripe_customer_id}}
                )
            
            # Crear Payment Intent
            amount_cents = int(invoice.total * 100)  # Stripe usa centavos
            
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='usd',
                customer=stripe_customer_id,
                metadata={
                    'invoice_id': invoice_id,
                    'invoice_number': invoice.invoice_number,
                    'user_id': current_user['id']
                },
                description=f"Pago de Factura #{invoice.invoice_number} - Ross Tax Preparation"
            )
            
            logger.info(f"✅ Payment Intent creado: {payment_intent.id}")
            
            return {
                'client_secret': payment_intent.client_secret,
                'payment_intent_id': payment_intent.id,
                'amount': invoice.total,
                'invoice_number': invoice.invoice_number
            }
            
        except HTTPException:
            raise
        except stripe.error.StripeError as e:
            logger.error(f"❌ Error de Stripe: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error de pago: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Error creando Payment Intent: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/invoices/{invoice_id}/create-checkout-session')
    async def create_invoice_checkout_session(
        invoice_id: str,
        current_user: dict = Depends(get_current_user_func)
    ):
        """Crea una sesión de Stripe Checkout para pagar una factura"""
        import stripe
        import os
        
        try:
            logger.info(f"📝 Creando checkout session para factura {invoice_id}")
            
            # Obtener la factura
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            if invoice.user_id != current_user['id']:
                raise HTTPException(status_code=403, detail="No tienes acceso a esta factura")
            
            if invoice.status not in ['pending', 'overdue']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Esta factura no puede ser pagada. Estado: {invoice.status}"
                )
            
            # Configurar Stripe
            stripe_key = os.getenv('STRIPE_API_KEY')
            if not stripe_key:
                stripe_key = os.getenv('STRIPE_SECRET_KEY')
            if not stripe_key:
                config = await db.app_config.find_one({'key': 'settings'})
                if config:
                    stripe_key = config.get('stripe_api_key')
            
            if not stripe_key:
                raise HTTPException(status_code=500, detail="Stripe no está configurado")
            
            stripe.api_key = stripe_key
            
            # Get backend URL for redirects
            backend_url = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://app-nueva-production-e876.up.railway.app')
            
            # Crear Stripe Checkout Session
            amount_cents = int(invoice.total * 100)
            
            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': f'Factura #{invoice.invoice_number}',
                            'description': f'Pago de factura - Ross Tax Preparation',
                        },
                        'unit_amount': amount_cents,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=f"{backend_url}/api/payment-success?session_id={{CHECKOUT_SESSION_ID}}&type=invoice&invoice_id={invoice_id}",
                cancel_url=f"{backend_url}/api/payment-cancel?type=invoice",
                metadata={
                    'invoice_id': invoice_id,
                    'invoice_number': invoice.invoice_number,
                    'user_id': current_user['id'],
                    'payment_type': 'invoice'
                }
            )
            
            logger.info(f"✅ Checkout session creada: {session.id}")
            
            return {
                'success': True,
                'checkout_url': session.url,
                'session_id': session.id
            }
            
        except HTTPException:
            raise
        except stripe.error.StripeError as e:
            logger.error(f"❌ Error de Stripe: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error de pago: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Error creando checkout session: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/invoices/{invoice_id}/confirm-payment')
    async def confirm_invoice_payment(
        invoice_id: str,
        payment_intent_id: str = Query(...),
        current_user: dict = Depends(get_current_user_func)
    ):
        """Confirma que el pago de una factura fue exitoso"""
        import stripe
        import os
        
        try:
            logger.info(f"✅ Confirmando pago de factura {invoice_id}")
            
            # Obtener la factura
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            if invoice.user_id != current_user['id']:
                raise HTTPException(status_code=403, detail="No tienes acceso a esta factura")
            
            # Verificar el pago en Stripe
            stripe_key = os.getenv('STRIPE_SECRET_KEY')
            if not stripe_key:
                config = await db.app_config.find_one({'key': 'settings'})
                if config:
                    stripe_key = config.get('stripe_api_key')
            
            stripe.api_key = stripe_key
            
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if payment_intent.status != 'succeeded':
                raise HTTPException(
                    status_code=400,
                    detail=f"El pago no fue exitoso. Estado: {payment_intent.status}"
                )
            
            # Actualizar la factura como pagada
            from datetime import datetime
            await db.invoices.update_one(
                {'_id': invoice_id},
                {
                    '$set': {
                        'status': 'paid',
                        'paid_at': datetime.utcnow(),
                        'payment_method': 'stripe',
                        'stripe_payment_intent_id': payment_intent_id,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            # Crear registro de pago
            await db.payments.insert_one({
                'invoice_id': invoice_id,
                'user_id': current_user['id'],
                'amount': invoice.total,
                'payment_method': 'stripe',
                'stripe_payment_intent_id': payment_intent_id,
                'status': 'completed',
                'created_at': datetime.utcnow()
            })
            
            logger.info(f"✅ Factura {invoice.invoice_number} marcada como pagada")
            
            return {
                'success': True,
                'message': 'Pago confirmado exitosamente',
                'invoice_number': invoice.invoice_number
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error confirmando pago: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # ================== ADMIN ENDPOINTS ==================
    
    @app.post('/api/admin/invoices')
    async def create_invoice(
        invoice_data: InvoiceCreate,
        current_user: dict = Depends(require_admin_func)
    ):
        """Crea una nueva factura (solo admin)"""
        try:
            logger.info(f"📝 Admin {current_user['email']} creando factura para usuario {invoice_data.user_id}")
            
            invoice = await invoice_service.create_invoice(
                invoice_data=invoice_data,
                admin_id=current_user['id'],
                admin_name=current_user.get('name', 'Admin')
            )
            
            logger.info(f"✅ Factura {invoice.invoice_number} creada exitosamente")
            
            # Return dict to avoid serialization issues with response_model
            status_value = invoice.status
            if hasattr(status_value, 'value'):
                status_value = status_value.value
            elif hasattr(status_value, 'name'):
                status_value = status_value.name.lower()
            else:
                status_value = str(status_value)
                
            return {
                'id': str(invoice.id) if invoice.id else None,
                'invoice_number': str(invoice.invoice_number) if invoice.invoice_number else None,
                'user_id': str(invoice.user_id) if invoice.user_id else None,
                'user_name': str(invoice.user_name) if invoice.user_name else None,
                'user_email': str(invoice.user_email) if invoice.user_email else None,
                'service_name': str(invoice.service_name) if invoice.service_name else None,
                'items': list(invoice.items) if invoice.items else [],
                'subtotal': float(invoice.subtotal) if invoice.subtotal else 0,
                'tax': float(invoice.tax) if invoice.tax else 0,
                'total': float(invoice.total) if invoice.total else 0,
                'status': status_value,
                'notes': str(invoice.notes) if invoice.notes else None,
                'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
                'due_date': invoice.due_date.isoformat() if invoice.due_date else None,
                'success': True
            }
            
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"❌ Error creando factura: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get('/api/admin/invoices', response_model=List[InvoiceResponse])
    async def get_all_invoices(
        status: Optional[InvoiceStatus] = Query(None),
        limit: int = Query(100, le=500),
        current_user: dict = Depends(require_admin_func)
    ):
        """Obtiene todas las facturas (solo admin)"""
        try:
            logger.info(f"📋 Admin {current_user['email']} solicitando todas las facturas")
            
            invoices = await invoice_service.get_all_invoices(
                status=status,
                limit=limit
            )
            
            logger.info(f"✅ Devolviendo {len(invoices)} facturas")
            return invoices
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo facturas: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get('/api/admin/invoices/stats')
    async def get_invoice_stats(
        current_user: dict = Depends(require_admin_func)
    ):
        """Obtiene estadísticas de facturas (solo admin)"""
        try:
            # Contar facturas por estado
            total = await db.invoices.count_documents({})
            pending = await db.invoices.count_documents({'status': InvoiceStatus.PENDING.value})
            paid = await db.invoices.count_documents({'status': InvoiceStatus.PAID.value})
            overdue = await db.invoices.count_documents({'status': InvoiceStatus.OVERDUE.value})
            cancelled = await db.invoices.count_documents({'status': InvoiceStatus.CANCELLED.value})
            
            # Calcular total de ingresos
            pipeline = [
                {'$match': {'status': InvoiceStatus.PAID.value}},
                {'$group': {'_id': None, 'total_revenue': {'$sum': '$total'}}}
            ]
            revenue_result = await db.invoices.aggregate(pipeline).to_list(1)
            total_revenue = revenue_result[0]['total_revenue'] if revenue_result else 0
            
            # Calcular pendiente de cobro
            pipeline = [
                {'$match': {'status': InvoiceStatus.PENDING.value}},
                {'$group': {'_id': None, 'pending_amount': {'$sum': '$total'}}}
            ]
            pending_result = await db.invoices.aggregate(pipeline).to_list(1)
            pending_amount = pending_result[0]['pending_amount'] if pending_result else 0
            
            return {
                'total': total,
                'pending': pending,
                'paid': paid,
                'overdue': overdue,
                'cancelled': cancelled,
                'total_revenue': total_revenue,
                'pending_amount': pending_amount
            }
            
        except Exception as e:
            logger.error(f"❌ Error obteniendo estadísticas: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get('/api/admin/invoices/{invoice_id}', response_model=InvoiceResponse)
    async def get_invoice_admin(
        invoice_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Obtiene una factura específica (solo admin)"""
        try:
            logger.info(f"📋 Admin {current_user['email']} solicitando factura {invoice_id}")
            
            invoice = await invoice_service.get_invoice_by_id(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            logger.info(f"✅ Factura {invoice.invoice_number} obtenida")
            return invoice
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error obteniendo factura: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.put('/api/admin/invoices/{invoice_id}/status')
    async def update_invoice_status(
        invoice_id: str,
        status_update: dict,
        current_user: dict = Depends(require_admin_func)
    ):
        """Actualiza el estado de una factura (solo admin)"""
        try:
            new_status = status_update.get('status')
            if not new_status:
                raise HTTPException(status_code=400, detail="Se requiere el campo 'status'")
            
            logger.info(f"📝 Admin {current_user['email']} cambiando estado de factura {invoice_id} a {new_status}")
            
            # Get invoice first to get user info
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Buscar y actualizar la factura
            update_data = {'status': new_status}
            if new_status == 'paid':
                from datetime import datetime
                update_data['paid_at'] = datetime.utcnow()
            
            result = await db.invoices.update_one(
                {'_id': ObjectId(invoice_id)},
                {'$set': update_data}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Send push notification to client
            try:
                user_id = invoice.get('user_id') or invoice.get('client_id')
                if user_id:
                    user = await db.users.find_one({'_id': user_id})
                    if not user:
                        user = await db.users.find_one({'_id': ObjectId(user_id)})
                    
                    if user and user.get('expo_push_token'):
                        from push_notification_service import send_push_notification
                        
                        invoice_number = invoice.get('invoice_number', invoice_id[:8])
                        total = invoice.get('total', 0)
                        
                        status_messages = {
                            'paid': ('💰 Pago Confirmado', f'Tu pago de ${total:,.2f} para la factura #{invoice_number} ha sido confirmado. ¡Gracias!'),
                            'pending': ('📄 Factura Pendiente', f'Tienes una factura pendiente #{invoice_number} por ${total:,.2f}'),
                            'overdue': ('⚠️ Factura Vencida', f'Tu factura #{invoice_number} por ${total:,.2f} está vencida. Por favor realiza el pago.'),
                            'cancelled': ('❌ Factura Cancelada', f'La factura #{invoice_number} ha sido cancelada.'),
                        }
                        
                        title, body = status_messages.get(new_status, ('📄 Actualización', f'El estado de tu factura #{invoice_number} ha sido actualizado.'))
                        
                        await send_push_notification(
                            expo_push_token=user.get('expo_push_token'),
                            title=title,
                            body=body,
                            data={'type': 'invoice_status', 'invoice_id': invoice_id, 'status': new_status}
                        )
                        logger.info(f"📱 Push notification sent for invoice status update")
            except Exception as push_error:
                logger.error(f"Error sending push for invoice status: {push_error}")
            
            logger.info(f"✅ Estado de factura {invoice_id} actualizado a {new_status}")
            return {'success': True, 'message': f'Estado actualizado a {new_status}'}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error actualizando estado: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/invoices/{invoice_id}/mark-paid')
    async def mark_invoice_paid(
        invoice_id: str,
        payment_info: dict = {},
        current_user: dict = Depends(require_admin_func)
    ):
        """Marca una factura como pagada (solo admin) - para pagos en efectivo u otros"""
        try:
            from datetime import datetime
            
            logger.info(f"💰 Admin {current_user['email']} marcando factura {invoice_id} como pagada")
            
            # Get invoice first
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            payment_method = payment_info.get('payment_method', 'cash')
            
            # Update invoice
            result = await db.invoices.update_one(
                {'_id': ObjectId(invoice_id)},
                {'$set': {
                    'status': 'paid',
                    'paid_at': datetime.utcnow(),
                    'payment_method': payment_method,
                    'marked_paid_by': current_user.get('id')
                }}
            )
            
            if result.modified_count == 0:
                raise HTTPException(status_code=404, detail="No se pudo actualizar la factura")
            
            # Send push notification to client
            try:
                user_id = invoice.get('user_id') or invoice.get('client_id')
                if user_id:
                    user = await db.users.find_one({'_id': user_id})
                    if not user:
                        user = await db.users.find_one({'_id': ObjectId(user_id)})
                    
                    if user and user.get('expo_push_token'):
                        from push_notification_service import send_push_notification
                        
                        invoice_number = invoice.get('invoice_number', invoice_id[:8])
                        total = invoice.get('total', 0)
                        
                        await send_push_notification(
                            expo_push_token=user.get('expo_push_token'),
                            title='💰 Pago Confirmado',
                            body=f'Tu pago de ${total:,.2f} para la factura #{invoice_number} ha sido confirmado. ¡Gracias!',
                            data={'type': 'invoice_paid', 'invoice_id': invoice_id}
                        )
                        logger.info(f"📱 Push notification sent for payment confirmation")
            except Exception as push_error:
                logger.error(f"Error sending push for payment: {push_error}")
            
            logger.info(f"✅ Factura {invoice_id} marcada como pagada")
            return {'success': True, 'message': 'Factura marcada como pagada'}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error marcando factura como pagada: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/invoices/{invoice_id}/send-reminder')
    async def send_invoice_reminder(
        invoice_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Envía un recordatorio de factura al cliente (solo admin)"""
        try:
            logger.info(f"📧 Admin {current_user['email']} enviando recordatorio de factura {invoice_id}")
            
            # Buscar la factura
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Obtener el user_id (es un UUID string, no ObjectId)
            user_id = invoice.get('user_id') or invoice.get('client_id')
            if not user_id:
                raise HTTPException(status_code=404, detail="La factura no tiene cliente asignado")
            
            # Buscar el cliente por su _id (que es un UUID string)
            client = await db.users.find_one({'_id': user_id})
            if not client:
                # Intentar como ObjectId si es un ID antiguo
                try:
                    client = await db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            
            if not client:
                raise HTTPException(status_code=404, detail=f"Cliente no encontrado (ID: {user_id})")
            
            # Enviar email de recordatorio
            try:
                from email_service import email_service
                await email_service.send_invoice_reminder(
                    to_email=client.get('email'),
                    client_name=client.get('full_name', client.get('name', 'Cliente')),
                    invoice_number=invoice.get('invoice_number', str(invoice['_id'])[:8]),
                    amount=invoice.get('total', 0),
                    due_date=invoice.get('due_date')
                )
                logger.info(f"✅ Recordatorio enviado a {client.get('email')}")
            except Exception as email_error:
                logger.warning(f"⚠️ No se pudo enviar email: {email_error}")
                # No falla si el email no se envía, solo logea
            
            # Registrar el recordatorio
            await db.invoices.update_one(
                {'_id': ObjectId(invoice_id)},
                {'$push': {'reminders_sent': {'sent_at': datetime.utcnow(), 'sent_by': current_user['email']}}}
            )
            
            return {'success': True, 'message': f'Recordatorio enviado a {client.get("email")}'}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error enviando recordatorio: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/invoices/{invoice_id}/send-email')
    async def send_invoice_email(
        invoice_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Envía una factura por Email al cliente"""
        try:
            logger.info(f"📧 Admin {current_user['email']} enviando factura {invoice_id} por email")
            
            # Buscar la factura
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Obtener datos del cliente
            user_id = invoice.get('user_id') or invoice.get('client_id')
            client = await db.users.find_one({'_id': user_id})
            if not client:
                try:
                    client = await db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            
            if not client or not client.get('email'):
                raise HTTPException(status_code=404, detail="Cliente no encontrado o sin email")
            
            # Generar PDF
            invoice_dict = {
                'invoice_number': invoice.get('invoice_number', str(invoice['_id'])[:8]),
                'created_at': invoice.get('created_at'),
                'due_date': invoice.get('due_date'),
                'status': invoice.get('status', 'pending'),
                'items': invoice.get('items', []),
                'subtotal': invoice.get('subtotal', 0),
                'tax': invoice.get('tax', 0),
                'total': invoice.get('total', 0),
                'notes': invoice.get('notes', '')
            }
            
            user_dict = {
                'name': client.get('full_name', client.get('name', 'Cliente')),
                'email': client.get('email', ''),
                'phone': client.get('phone', '')
            }
            
            pdf_buffer = InvoicePDFService.generate_invoice_pdf(invoice_dict, user_dict)
            pdf_base64 = None
            try:
                import base64
                pdf_base64 = base64.b64encode(pdf_buffer.getvalue()).decode('utf-8')
            except Exception as pdf_error:
                logger.warning(f"⚠️ No se pudo generar PDF para adjuntar: {pdf_error}")
            
            # Enviar email con factura
            try:
                from email_service import email_service
                from notification_service import notification_service
                
                # Preparar contenido del email
                invoice_number = invoice.get('invoice_number', str(invoice['_id'])[:8])
                total = invoice.get('total', 0)
                due_date = invoice.get('due_date')
                due_date_str = due_date.strftime('%d/%m/%Y') if due_date else 'No especificada'
                
                html_content = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #6C1110 0%, #8B1A19 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">📄 Su Factura</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Ross Tax Preparation</p>
                    </div>
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                        <p style="font-size: 16px; color: #333;">Estimado/a <strong>{user_dict['name']}</strong>,</p>
                        <p style="color: #666;">Adjunto encontrará su factura con los siguientes detalles:</p>
                        
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6C1110;">
                            <p style="margin: 5px 0;"><strong>Número de Factura:</strong> #{invoice_number}</p>
                            <p style="margin: 5px 0;"><strong>Total:</strong> <span style="color: #6C1110; font-size: 18px;">${total:,.2f}</span></p>
                            <p style="margin: 5px 0;"><strong>Fecha de Vencimiento:</strong> {due_date_str}</p>
                        </div>
                        
                        <p style="color: #666;">Puede realizar el pago a través de nuestra aplicación móvil o usando los siguientes métodos:</p>
                        <ul style="color: #666;">
                            <li><strong>Zelle:</strong> payments@rosstax.com</li>
                            <li><strong>Cash App:</strong> $RossTaxPrep</li>
                        </ul>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://www.rosstaxpreparation.com" style="background: #6C1110; color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">
                                Ver en la App
                            </a>
                        </div>
                        
                        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
                            ¿Preguntas? Contáctenos en info@rosstaxpreparation.com
                        </p>
                    </div>
                </div>
                """
                
                # Enviar usando notification_service o email_service directamente
                if notification_service and hasattr(notification_service, 'send_email'):
                    await notification_service.send_email(
                        to_email=client['email'],
                        subject=f"📄 Factura #{invoice_number} - Ross Tax Preparation",
                        html_content=html_content
                    )
                elif email_service:
                    await email_service.send_custom_email(
                        to_email=client['email'],
                        subject=f"📄 Factura #{invoice_number} - Ross Tax Preparation",
                        html_content=html_content
                    )
                
                logger.info(f"✅ Factura {invoice_number} enviada por email a {client['email']}")
                
                # Registrar envío
                await db.invoices.update_one(
                    {'_id': ObjectId(invoice_id)},
                    {'$push': {'emails_sent': {'sent_at': datetime.utcnow(), 'sent_by': current_user['email'], 'sent_to': client['email']}}}
                )
                
                return {
                    'success': True,
                    'message': f'Factura enviada por email a {client["email"]}',
                    'sent_to': client['email']
                }
                
            except Exception as email_error:
                logger.error(f"❌ Error enviando email: {email_error}")
                raise HTTPException(status_code=500, detail=f"Error enviando email: {str(email_error)}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error enviando factura por email: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.post('/api/admin/invoices/{invoice_id}/send-whatsapp')
    async def send_invoice_whatsapp(
        invoice_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Envía una factura por WhatsApp al cliente"""
        try:
            logger.info(f"📱 Admin {current_user['email']} enviando factura {invoice_id} por WhatsApp")
            
            # Buscar la factura
            invoice = await db.invoices.find_one({'_id': ObjectId(invoice_id)})
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            # Obtener datos del cliente
            user_id = invoice.get('user_id') or invoice.get('client_id')
            client = await db.users.find_one({'_id': user_id})
            if not client:
                try:
                    client = await db.users.find_one({'_id': ObjectId(user_id)})
                except:
                    pass
            
            if not client or not client.get('phone'):
                raise HTTPException(status_code=404, detail="Cliente no encontrado o sin teléfono")
            
            # Preparar mensaje
            invoice_number = invoice.get('invoice_number', str(invoice['_id'])[:8])
            total = invoice.get('total', 0)
            due_date = invoice.get('due_date')
            due_date_str = due_date.strftime('%d/%m/%Y') if due_date else 'No especificada'
            client_name = client.get('full_name', client.get('name', 'Cliente'))
            
            message = f"""📄 *FACTURA #{invoice_number}*

Estimado/a {client_name},

Le enviamos su factura con los siguientes detalles:

💰 *Total a Pagar:* ${total:,.2f}
📅 *Fecha de Vencimiento:* {due_date_str}

*Métodos de Pago:*
• Zelle: payments@rosstax.com
• Cash App: $RossTaxPrep
• Tarjeta en la App

Para ver su factura completa y pagar en línea, acceda a la app Ross Tax.

¿Preguntas? Responda a este mensaje o llame al (806) 934-2018.

_Ross Tax Preparation_
www.rosstaxpreparation.com"""

            # Enviar por WhatsApp
            try:
                from whatsapp_service import whatsapp_service
                
                phone = client.get('phone', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '')
                if not phone.startswith('+'):
                    if not phone.startswith('1'):
                        phone = '1' + phone
                    phone = '+' + phone
                
                result = await whatsapp_service.send_message(phone, message)
                
                if result.get('success'):
                    logger.info(f"✅ Factura {invoice_number} enviada por WhatsApp a {phone}")
                    
                    # Registrar envío
                    await db.invoices.update_one(
                        {'_id': ObjectId(invoice_id)},
                        {'$push': {'whatsapp_sent': {'sent_at': datetime.utcnow(), 'sent_by': current_user['email'], 'sent_to': phone}}}
                    )
                    
                    return {
                        'success': True,
                        'message': f'Factura enviada por WhatsApp a {phone}',
                        'sent_to': phone,
                        'message_id': result.get('message_id')
                    }
                else:
                    raise HTTPException(status_code=500, detail=f"Error de WhatsApp: {result.get('error', 'Unknown error')}")
                    
            except ImportError:
                raise HTTPException(status_code=500, detail="Servicio de WhatsApp no disponible")
            except Exception as wa_error:
                logger.error(f"❌ Error enviando WhatsApp: {wa_error}")
                raise HTTPException(status_code=500, detail=f"Error enviando WhatsApp: {str(wa_error)}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error enviando factura por WhatsApp: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.put('/api/admin/invoices/{invoice_id}', response_model=InvoiceResponse)
    async def update_invoice(
        invoice_id: str,
        update_data: InvoiceUpdate,
        current_user: dict = Depends(require_admin_func)
    ):
        """Actualiza una factura (solo admin)"""
        try:
            logger.info(f"📝 Admin {current_user['email']} actualizando factura {invoice_id}")
            
            invoice = await invoice_service.update_invoice(
                invoice_id=invoice_id,
                update_data=update_data
            )
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            logger.info(f"✅ Factura {invoice.invoice_number} actualizada")
            return invoice
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error actualizando factura: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.delete('/api/admin/invoices/{invoice_id}')
    async def cancel_invoice(
        invoice_id: str,
        current_user: dict = Depends(require_admin_func)
    ):
        """Cancela una factura (solo admin)"""
        try:
            logger.info(f"🗑️ Admin {current_user['email']} cancelando factura {invoice_id}")
            
            invoice = await invoice_service.cancel_invoice(invoice_id)
            
            if not invoice:
                raise HTTPException(status_code=404, detail="Factura no encontrada")
            
            logger.info(f"✅ Factura {invoice.invoice_number} cancelada")
            return {
                'success': True,
                'message': 'Factura cancelada exitosamente',
                'invoice': invoice
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Error cancelando factura: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
    
    logger.info("✅ Invoice endpoints inicializados")
