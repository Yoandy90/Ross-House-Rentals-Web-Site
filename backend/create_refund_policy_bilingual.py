#!/usr/bin/env python3
"""
Script para crear/actualizar la Política de Devoluciones y Reembolsos (Bilingüe)
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# ENGLISH VERSION
REFUND_POLICY_EN = """# Ross Tax Preparation – Return & Refund Policy

At Ross Tax Preparation, customer satisfaction and service accuracy are our top priorities. However, due to the nature of tax preparation services, all sales are considered final once the return has been prepared, reviewed with the client, and delivered for signature.

## 1. Non-Refundable Services

All fees paid are non-refundable, including:

- Personal tax returns (1040)
- Business tax returns (LLC, S-Corp, C-Corp)
- Amendments
- ITIN services
- Bookkeeping or document processing
- Advisory and consulting services

## 2. Errors & Accuracy Guarantee

If Ross Tax Preparation makes an error:

- We will correct the mistake at no additional cost.
- If it results in penalties or interest caused exclusively by our preparation:
  - We will cover the cost of the amendment.
  - We will assist in communicating with the IRS or state.

This guarantee does NOT apply to errors caused by:

- Incorrect or incomplete information provided by the client
- Late documents
- Undisclosed income or deductions
- Fraudulent or altered documentation

## 3. Client Responsibility

Clients must:

- Provide accurate and truthful documents
- Review their return before signing
- Ensure personal information is correct
- Report discrepancies immediately

## 4. Payments & ACH Transactions

Payments made by ACH, debit/credit card, online invoice, in-office terminal, or refund transfer are final and non-refundable once services are delivered.

## 5. Refund Transfers (Bank Products)

Refund Transfer fees cannot be canceled or refunded once the return is filed.

## 6. Service Cancellation

Cancellation is only allowed before work begins. Once documents are reviewed or a draft is started, no refund is available.

## 7. Digital Goods

Digital products/services are non-refundable once accessed or submitted.

## 8. Contact Information

**Ross Tax Preparation**

- **Email:** info@rosstaxpreparation.com
- **Phone:** 806-934-2018
- **Office:** 305 Bruce Ave, Dumas, Texas 79029

---

*Last updated: November 2024*

By using our services, you agree to this Return & Refund Policy. Ross Tax Preparation reserves the right to update this policy at any time, with prior notice to our clients.
"""

# SPANISH VERSION
REFUND_POLICY_ES = """# Política de Devoluciones y Reembolsos de Ross Tax Preparation

En Ross Tax Preparation, la satisfacción del cliente y la precisión del servicio son nuestras principales prioridades. Sin embargo, debido a la naturaleza de los servicios de preparación de impuestos, todas las ventas se consideran finales una vez que la declaración ha sido preparada, revisada con el cliente y entregada para su firma.

## 1. Servicios No Reembolsables

Todas las tarifas pagadas no son reembolsables, incluyendo:

- Declaraciones de impuestos personales (1040)
- Declaraciones de impuestos comerciales (LLC, S-Corp, C-Corp)
- Enmiendas
- Servicios ITIN
- Contabilidad o procesamiento de documentos
- Servicios de asesoramiento y consultoría

## 2. Garantía de Errores y Precisión

Si Ross Tax Preparation comete un error:

- Corregiremos el error sin costo adicional.
- Si resulta en multas o intereses causados exclusivamente por nuestra preparación:
  - Cubriremos el costo de la enmienda.
  - Ayudaremos en la comunicación con el IRS o el estado.

Esta garantía NO aplica a errores causados por:

- Información incorrecta o incompleta proporcionada por el cliente
- Documentos tardíos
- Ingresos o deducciones no divulgados
- Documentación fraudulenta o alterada

## 3. Responsabilidad del Cliente

Los clientes deben:

- Proporcionar documentos precisos y veraces
- Revisar su declaración antes de firmar
- Asegurarse de que la información personal sea correcta
- Reportar discrepancias inmediatamente

## 4. Pagos y Transacciones ACH

Los pagos realizados mediante ACH, tarjeta de débito/crédito, factura en línea, terminal en la oficina o transferencia de reembolso son finales y no reembolsables una vez que se entregan los servicios.

## 5. Transferencias de Reembolso (Productos Bancarios)

Las tarifas de transferencia de reembolso no pueden cancelarse ni reembolsarse una vez que se presenta la declaración.

## 6. Cancelación del Servicio

La cancelación solo se permite antes de que comience el trabajo. Una vez que se revisan los documentos o se inicia un borrador, no hay reembolso disponible.

## 7. Productos Digitales

Los productos/servicios digitales no son reembolsables una vez que se accede a ellos o se envían.

## 8. Información de Contacto

**Ross Tax Preparation**

- **Email:** info@rosstaxpreparation.com
- **Teléfono:** 806-934-2018
- **Oficina:** 305 Bruce Ave, Dumas, Texas 79029

---

*Última actualización: Noviembre 2024*

Al utilizar nuestros servicios, usted acepta esta Política de Devoluciones y Reembolsos. Ross Tax Preparation se reserva el derecho de actualizar esta política en cualquier momento, con notificación previa a nuestros clientes.
"""

async def create_bilingual_refund_policy():
    """Crea políticas de reembolsos en inglés y español"""
    
    print("📄 Creando Políticas de Devoluciones y Reembolsos (Bilingüe)...")
    print()
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Despublicar versiones anteriores de refund
        await db.legal_documents.update_many(
            {'type': 'refund', 'is_published': True},
            {'$set': {'is_published': False}}
        )
        
        now = datetime.utcnow()
        
        # Crear versión en INGLÉS
        refund_doc_en = {
            'type': 'refund',
            'language': 'en',
            'title': 'Return & Refund Policy',
            'content': REFUND_POLICY_EN,
            'version': '1.0',
            'is_published': True,
            'effective_date': now,
            'created_at': now,
            'updated_at': now
        }
        
        result_en = await db.legal_documents.insert_one(refund_doc_en)
        
        print(f"✅ Política de Reembolsos (INGLÉS) creada exitosamente")
        print(f"   - ID: {result_en.inserted_id}")
        print(f"   - Idioma: English")
        print(f"   - Versión: 1.0")
        print()
        
        # Crear versión en ESPAÑOL
        refund_doc_es = {
            'type': 'refund',
            'language': 'es',
            'title': 'Política de Devoluciones y Reembolsos',
            'content': REFUND_POLICY_ES,
            'version': '1.0',
            'is_published': True,
            'effective_date': now,
            'created_at': now,
            'updated_at': now
        }
        
        result_es = await db.legal_documents.insert_one(refund_doc_es)
        
        print(f"✅ Política de Reembolsos (ESPAÑOL) creada exitosamente")
        print(f"   - ID: {result_es.inserted_id}")
        print(f"   - Idioma: Español")
        print(f"   - Versión: 1.0")
        print()
        
        print("=" * 70)
        print("✅ POLÍTICAS BILINGÜES CREADAS EXITOSAMENTE")
        print("=" * 70)
        print()
        print("🌐 Disponible en:")
        print("   - GET /api/legal/refund?lang=en (English)")
        print("   - GET /api/legal/refund?lang=es (Español)")
        print("   - GET /api/legal/refund (Default: Español)")
        print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_bilingual_refund_policy())
