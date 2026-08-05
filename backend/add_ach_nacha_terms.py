#!/usr/bin/env python3
"""
Script para agregar términos y condiciones ACH/NACHA a los términos existentes
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

ACH_NACHA_TERMS_ES = """

## 8. Pagos ACH y Autorización de Débito Bancario

### 8.1 Autorización de Débito ACH (NACHA)

Al proporcionar información de su cuenta bancaria para pagos ACH (Automated Clearing House), usted autoriza a Ross Tax Preparation a:

- Iniciar débitos electrónicos desde su cuenta bancaria
- Procesar pagos según los términos acordados
- Corregir cualquier error de procesamiento mediante crédito o débito
- Mantener su información bancaria de forma segura y confidencial

### 8.2 Requisitos y Validación

Para procesar pagos ACH, necesitamos:

- **Routing Number**: Número de enrutamiento bancario de 9 dígitos
- **Número de Cuenta**: Su número de cuenta bancaria
- **Tipo de Cuenta**: Cuenta corriente (checking) o de ahorros (savings)
- **Nombre del Titular**: Nombre completo del titular de la cuenta
- **Firma Electrónica**: Su firma autoriza los débitos ACH

### 8.3 Firma Electrónica

Su firma electrónica (capturada digitalmente o mediante firma manuscrita) constituye su consentimiento legal para:

- Autorizar débitos ACH desde su cuenta bancaria
- Aceptar los términos de la regla NACHA Operating Rules
- Confirmar que es el titular autorizado de la cuenta
- Aceptar los términos de este acuerdo

Esta firma tiene la misma validez legal que una firma manuscrita en papel.

### 8.4 Estándares NACHA

Cumplimos con todas las reglas y regulaciones de NACHA (National Automated Clearing House Association), incluyendo:

- **Regla de Autorización**: Mantenemos evidencia de su autorización
- **Regla de Notificación**: Le notificamos sobre débitos programados
- **Regla de Revocación**: Puede revocar la autorización según términos
- **Regla de Privacidad**: Protegemos su información bancaria

### 8.5 Timing de Débitos

- Los débitos ACH se procesan en **5-7 días hábiles**
- Recibirá notificación antes de cada débito programado
- Los débitos no se procesan en fines de semana o días festivos bancarios
- El monto será debitado de su cuenta según lo autorizado

### 8.6 Cancelación y Revocación

Puede revocar esta autorización en cualquier momento mediante:

1. **Notificación por escrito**: Enviar email a info@rosstaxpreparation.com
2. **Llamada telefónica**: Contactar al 806-934-2018
3. **En persona**: Visitar nuestra oficina en 305 Bruce Ave, Dumas, TX

**Importante**: La revocación debe hacerse al menos **3 días hábiles** antes del débito programado.

### 8.7 Disputas y Errores

Si cree que un débito es incorrecto:

1. Contacte a Ross Tax Preparation dentro de **60 días**
2. También puede contactar a su banco directamente
3. Investigaremos y resolveremos dentro de **10 días hábiles**
4. Si encontramos un error, haremos un crédito inmediato

Sus derechos de disputa están protegidos bajo:
- **Regulation E** (Electronic Fund Transfer Act)
- **NACHA Operating Rules**
- Políticas de su institución bancaria

### 8.8 Tarifas ACH

- **Tarifa de Procesamiento**: 0.8% por transacción ACH
- **Sin Tarifas de Configuración**: No cobramos por agregar cuenta bancaria
- **Sin Tarifas de Cancelación**: No hay cargo por cancelar autorización
- **Tarifas NSF**: Su banco puede cobrar si hay fondos insuficientes

### 8.9 Seguridad y Privacidad

Su información bancaria está protegida mediante:

- **Encriptación**: Datos encriptados en tránsito y en reposo
- **Cumplimiento PCI**: Estándares de seguridad de datos de pago
- **Acceso Limitado**: Solo personal autorizado accede a sus datos
- **Auditoría**: Registros completos de todas las transacciones

### 8.10 Responsabilidades del Cliente

Usted es responsable de:

- Proporcionar información bancaria precisa y actualizada
- Mantener fondos suficientes para débitos autorizados
- Notificar cambios de cuenta bancaria inmediatamente
- Revisar sus estados de cuenta bancarios regularmente
- Reportar transacciones no autorizadas dentro de 60 días

### 8.11 Limitación de Responsabilidad

Ross Tax Preparation no es responsable por:

- Tarifas de sobregiro o fondos insuficientes de su banco
- Demoras causadas por su institución financiera
- Errores en información proporcionada por usted
- Problemas técnicos fuera de nuestro control

### 8.12 Evidencia de Autorización

Mantenemos evidencia de su autorización incluyendo:

- Copia digital de su firma electrónica
- Registro de fecha y hora de autorización
- Dirección IP y dispositivo utilizado
- PDF de autorización con todos los términos
- Historial completo de transacciones

Esta documentación está disponible a solicitud y se mantiene según requerimientos legales.
"""

ACH_NACHA_TERMS_EN = """

## 8. ACH Payments and Bank Debit Authorization

### 8.1 ACH Debit Authorization (NACHA)

By providing your bank account information for ACH (Automated Clearing House) payments, you authorize Ross Tax Preparation to:

- Initiate electronic debits from your bank account
- Process payments according to agreed terms
- Correct any processing errors through credit or debit
- Maintain your banking information securely and confidentially

### 8.2 Requirements and Validation

To process ACH payments, we need:

- **Routing Number**: 9-digit bank routing number
- **Account Number**: Your bank account number
- **Account Type**: Checking or savings account
- **Account Holder Name**: Full name of account holder
- **Electronic Signature**: Your signature authorizes ACH debits

### 8.3 Electronic Signature

Your electronic signature (captured digitally or through handwritten signature) constitutes your legal consent to:

- Authorize ACH debits from your bank account
- Accept the terms of NACHA Operating Rules
- Confirm you are the authorized account holder
- Accept the terms of this agreement

This signature has the same legal validity as a handwritten signature on paper.

### 8.4 NACHA Standards

We comply with all NACHA (National Automated Clearing House Association) rules and regulations, including:

- **Authorization Rule**: We maintain evidence of your authorization
- **Notification Rule**: We notify you about scheduled debits
- **Revocation Rule**: You can revoke authorization per terms
- **Privacy Rule**: We protect your banking information

### 8.5 Debit Timing

- ACH debits process in **5-7 business days**
- You'll receive notification before each scheduled debit
- Debits don't process on weekends or bank holidays
- Amount will be debited from your account as authorized

### 8.6 Cancellation and Revocation

You can revoke this authorization at any time by:

1. **Written Notice**: Send email to info@rosstaxpreparation.com
2. **Phone Call**: Contact 806-934-2018
3. **In Person**: Visit our office at 305 Bruce Ave, Dumas, TX

**Important**: Revocation must be made at least **3 business days** before scheduled debit.

### 8.7 Disputes and Errors

If you believe a debit is incorrect:

1. Contact Ross Tax Preparation within **60 days**
2. You can also contact your bank directly
3. We'll investigate and resolve within **10 business days**
4. If we find an error, we'll make an immediate credit

Your dispute rights are protected under:
- **Regulation E** (Electronic Fund Transfer Act)
- **NACHA Operating Rules**
- Your banking institution's policies

### 8.8 ACH Fees

- **Processing Fee**: 0.8% per ACH transaction
- **No Setup Fees**: No charge to add bank account
- **No Cancellation Fees**: No charge to cancel authorization
- **NSF Fees**: Your bank may charge for insufficient funds

### 8.9 Security and Privacy

Your banking information is protected through:

- **Encryption**: Data encrypted in transit and at rest
- **PCI Compliance**: Payment card data security standards
- **Limited Access**: Only authorized personnel access your data
- **Audit Trail**: Complete records of all transactions

### 8.10 Customer Responsibilities

You are responsible for:

- Providing accurate and current banking information
- Maintaining sufficient funds for authorized debits
- Notifying changes to bank account immediately
- Reviewing your bank statements regularly
- Reporting unauthorized transactions within 60 days

### 8.11 Limitation of Liability

Ross Tax Preparation is not responsible for:

- Overdraft or insufficient funds fees from your bank
- Delays caused by your financial institution
- Errors in information provided by you
- Technical issues beyond our control

### 8.12 Authorization Evidence

We maintain evidence of your authorization including:

- Digital copy of your electronic signature
- Record of authorization date and time
- IP address and device used
- PDF authorization with all terms
- Complete transaction history

This documentation is available upon request and maintained per legal requirements.
"""

async def add_ach_terms():
    """Agrega términos ACH/NACHA a los términos existentes"""
    
    print("📄 Agregando términos ACH/NACHA a Términos y Condiciones...")
    print()
    
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Obtener términos actuales en español
        terms_es = await db.legal_documents.find_one({
            'type': 'terms',
            'language': 'es',
            'is_published': True
        })
        
        if terms_es and 'NACHA' not in terms_es.get('content', ''):
            # Agregar términos ACH al final (antes del contacto si existe)
            content = terms_es['content']
            
            # Insertar antes de la sección de contacto si existe
            if '## Información de Contacto' in content or '## Contacto' in content:
                parts = content.split('## Información de Contacto')
                if len(parts) == 1:
                    parts = content.split('## Contacto')
                new_content = parts[0] + ACH_NACHA_TERMS_ES + '\n\n## Información de Contacto' + parts[1]
            else:
                new_content = content + '\n' + ACH_NACHA_TERMS_ES
            
            await db.legal_documents.update_one(
                {'_id': terms_es['_id']},
                {'$set': {'content': new_content, 'updated_at': datetime.utcnow()}}
            )
            print("✅ Términos ACH/NACHA agregados en ESPAÑOL")
        else:
            print("ℹ️  Términos en español ya tienen sección ACH/NACHA o no existen")
        
        # Obtener términos actuales en inglés
        terms_en = await db.legal_documents.find_one({
            'type': 'terms',
            'language': 'en',
            'is_published': True
        })
        
        if terms_en and 'NACHA' not in terms_en.get('content', ''):
            content = terms_en['content']
            
            # Insertar antes de la sección de contacto si existe
            if '## Contact Information' in content or '## Contact' in content:
                parts = content.split('## Contact Information')
                if len(parts) == 1:
                    parts = content.split('## Contact')
                new_content = parts[0] + ACH_NACHA_TERMS_EN + '\n\n## Contact Information' + parts[1]
            else:
                new_content = content + '\n' + ACH_NACHA_TERMS_EN
            
            await db.legal_documents.update_one(
                {'_id': terms_en['_id']},
                {'$set': {'content': new_content, 'updated_at': datetime.utcnow()}}
            )
            print("✅ Términos ACH/NACHA agregados en INGLÉS")
        else:
            print("ℹ️  Términos en inglés ya tienen sección ACH/NACHA o no existen")
        
        print()
        print("=" * 70)
        print("✅ TÉRMINOS ACH/NACHA ACTUALIZADOS")
        print("=" * 70)
        print()
        print("📋 Sección agregada:")
        print("   - 8. Pagos ACH y Autorización de Débito Bancario")
        print("   - 12 subsecciones detalladas")
        print("   - Cumplimiento NACHA completo")
        print("   - Derechos y responsabilidades claros")
        print()
        print("🌐 Disponible en:")
        print("   - GET /api/legal/terms?lang=es")
        print("   - GET /api/legal/terms?lang=en")
        print()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(add_ach_terms())
