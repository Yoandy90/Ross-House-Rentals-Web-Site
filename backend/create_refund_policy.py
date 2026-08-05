#!/usr/bin/env python3
"""
Script para crear/actualizar la Política de Devoluciones y Reembolsos
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

REFUND_POLICY_CONTENT = """# Política de Devoluciones y Reembolsos de Ross Tax Preparation

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

async def create_refund_policy():
    """Crea o actualiza la política de reembolsos en la base de datos"""
    
    print("📄 Creando Política de Devoluciones y Reembolsos...")
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Despublicar versiones anteriores
        await db.legal_documents.update_many(
            {'type': 'refund', 'is_published': True},
            {'$set': {'is_published': False}}
        )
        
        # Crear nuevo documento
        refund_doc = {
            'type': 'refund',
            'title': 'Política de Devoluciones y Reembolsos',
            'content': REFUND_POLICY_CONTENT,
            'version': '1.0',
            'is_published': True,
            'effective_date': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = await db.legal_documents.insert_one(refund_doc)
        
        print(f"✅ Política de Reembolsos creada exitosamente")
        print(f"   - ID: {result.inserted_id}")
        print(f"   - Tipo: refund")
        print(f"   - Versión: 1.0")
        print(f"   - Estado: Publicado")
        print()
        print(f"🌐 Disponible en: GET /api/legal/refund")
        print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_refund_policy())
