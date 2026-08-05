"""
Script para crear/actualizar documentos legales completos
Ross Tax Preparation - Términos y Condiciones, Política de Privacidad, FAQs
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

async def create_legal_documents():
    """Crea documentos legales actualizados con todos los servicios"""
    
    # Conectar a MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'taxportal')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # ================= TÉRMINOS Y CONDICIONES =================
    terms_content = """
# TÉRMINOS Y CONDICIONES DE SERVICIO

**Última actualización: 3 de noviembre de 2025**

Bienvenido a Ross Tax Preparation ("nosotros", "nuestro" o la "Empresa"). Estos Términos y Condiciones ("Términos") rigen su acceso y uso de nuestra aplicación móvil, sitio web y servicios relacionados (colectivamente, los "Servicios").

## 1. ACEPTACIÓN DE LOS TÉRMINOS

Al acceder o utilizar nuestros Servicios, usted acepta estar legalmente vinculado por estos Términos. Si no está de acuerdo con alguna parte de estos Términos, no debe usar nuestros Servicios.

## 2. DESCRIPCIÓN DE LOS SERVICIOS

Ross Tax Preparation ofrece los siguientes servicios:

### 2.1 Servicios de Preparación de Impuestos
- Preparación de declaraciones de impuestos federales y estatales
- Declaraciones simples (W-2)
- Declaraciones con deducciones detalladas
- Declaraciones de negocios (Schedule C)
- Enmiendas y correcciones (1040-X)
- Declaraciones de años anteriores
- Servicios ITIN
- Representación ante el IRS

### 2.2 Servicios de Consultoría
- Consultas fiscales express (30 minutos)
- Consultas estándares (1 hora)
- Planificación fiscal anual
- Revisión de documentos

### 2.3 Sistema de Créditos Ross Tax
- Compra de créditos prepagados
- Uso de créditos para pagar servicios
- Transferencias peer-to-peer (P2P) entre usuarios
- Solicitudes de dinero
- Sistema de reembolsos

### 2.4 Servicios Financieros
- Préstamos personales
- Adelantos de reembolso de impuestos
- Programas de financiamiento

### 2.5 Programas de Incentivos
- Programa de referidos
- Sorteos y promociones
- Sistema de recompensas

## 3. ELEGIBILIDAD Y REGISTRO

### 3.1 Requisitos de Edad
Debe tener al menos 18 años de edad para usar nuestros Servicios. Al registrarse, usted declara y garantiza que:
- Tiene al menos 18 años de edad
- Tiene capacidad legal para celebrar un contrato vinculante
- No está prohibido de usar los Servicios bajo las leyes de Estados Unidos u otras jurisdicciones aplicables

### 3.2 Cuenta de Usuario
Para acceder a ciertos Servicios, debe crear una cuenta. Usted se compromete a:
- Proporcionar información precisa, actual y completa
- Mantener la seguridad de su contraseña
- Notificar inmediatamente cualquier uso no autorizado de su cuenta
- Aceptar responsabilidad por todas las actividades bajo su cuenta

## 4. SISTEMA DE CRÉDITOS ROSS TAX

### 4.1 Compra de Créditos
- Los créditos se compran mediante tarjeta de crédito/débito a través de Stripe
- 1 crédito = 1 dólar estadounidense (USD)
- Los créditos son prepagados y no caducan
- Las compras de créditos son no reembolsables, excepto según lo requerido por ley

### 4.2 Uso de Créditos
- Los créditos se pueden usar para pagar cualquier servicio ofrecido por Ross Tax Preparation
- Los precios de los servicios están claramente indicados en créditos
- Los créditos se deducen automáticamente al confirmar un servicio

### 4.3 Transferencias P2P
- Los usuarios pueden transferir créditos a otros usuarios registrados
- Las transferencias son inmediatas e irreversibles
- Debe tener saldo suficiente para completar una transferencia
- No nos hacemos responsables de transferencias erróneas

### 4.4 Solicitudes de Dinero
- Los usuarios pueden solicitar créditos a otros usuarios
- Las solicitudes expiran después de 48 horas
- El receptor puede aprobar o rechazar solicitudes
- Las solicitudes aprobadas resultan en transferencia inmediata

### 4.5 Reembolsos de Créditos
- Los reembolsos están sujetos a aprobación del administrador
- Los reembolsos se procesan en 5-10 días hábiles
- Se aplica una tarifa administrativa del 3% a los reembolsos

## 5. PAGOS Y FACTURACIÓN

### 5.1 Métodos de Pago
Aceptamos:
- Tarjetas de crédito/débito (Visa, Mastercard, American Express)
- Créditos Ross Tax prepagados

### 5.2 Procesamiento de Pagos
- Todos los pagos se procesan de forma segura a través de Stripe
- No almacenamos información completa de tarjetas de crédito
- Los pagos son en dólares estadounidenses (USD)

### 5.3 Impuestos
- Los precios mostrados no incluyen impuestos aplicables
- Los impuestos se agregarán según corresponda según su ubicación

## 6. PRÉSTAMOS Y SERVICIOS FINANCIEROS

### 6.1 Elegibilidad para Préstamos
- Sujeto a verificación de crédito
- Debe cumplir con requisitos de ingresos mínimos
- Los términos y tasas varían según el perfil del solicitante

### 6.2 Términos de Préstamos
- Los términos específicos se proporcionan en el acuerdo de préstamo
- Las tasas de interés (APR) se divulgan antes de la aceptación
- El incumplimiento puede resultar en acciones de cobranza
- Puede afectar su puntaje crediticio

## 7. PROGRAMA DE REFERIDOS

### 7.1 Estructura del Programa
- Reciba créditos por referir nuevos usuarios
- Los bonos se acreditan cuando el referido completa su primera transacción
- Los términos del programa pueden cambiar con previo aviso

### 7.2 Prohibiciones
Está prohibido:
- Crear cuentas falsas para generar referidos
- Usar métodos de spam o engañosos
- Manipular el sistema de referidos

## 8. PROPIEDAD INTELECTUAL

### 8.1 Derechos de la Empresa
- Todos los contenidos, marcas, logotipos y software son propiedad de Ross Tax Preparation
- No puede copiar, modificar o distribuir nuestro contenido sin permiso escrito

### 8.2 Licencia de Uso
Le otorgamos una licencia limitada, no exclusiva, intransferible para usar nuestros Servicios según estos Términos.

## 9. DECLARACIONES FISCALES Y RESPONSABILIDAD PROFESIONAL

### 9.1 Precisión de la Información
Usted se compromete a:
- Proporcionar información precisa y completa
- Entregar todos los documentos necesarios a tiempo
- Notificar cambios que puedan afectar su declaración

### 9.2 Responsabilidad del Usuario
- Usted es responsable final de la precisión de su declaración
- Debe revisar y aprobar su declaración antes de la presentación
- Conservar copias de todos los documentos por al menos 7 años

### 9.3 Garantías del Servicio
- Nuestros preparadores están certificados y capacitados
- Garantizamos precisión en cálculos según la información proporcionada
- En caso de error de nuestra parte, corregiremos sin costo adicional

## 10. PRIVACIDAD Y PROTECCIÓN DE DATOS

Sus datos personales se procesan según nuestra Política de Privacidad. Al usar nuestros Servicios, acepta la recopilación y uso de información según esa política.

## 11. LIMITACIÓN DE RESPONSABILIDAD

### 11.1 Exención de Garantías
LOS SERVICIOS SE PROPORCIONAN "TAL CUAL" Y "SEGÚN DISPONIBILIDAD". NO GARANTIZAMOS QUE LOS SERVICIOS SEAN ININTERRUMPIDOS O LIBRES DE ERRORES.

### 11.2 Limitación de Daños
EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, ROSS TAX PREPARATION NO SERÁ RESPONSABLE POR DAÑOS INDIRECTOS, INCIDENTALES, ESPECIALES O CONSECUENTES.

### 11.3 Límite Máximo
Nuestra responsabilidad total no excederá el monto pagado por usted en los últimos 12 meses.

## 12. RESOLUCIÓN DE DISPUTAS

### 12.1 Arbitraje
Cualquier disputa se resolverá mediante arbitraje vinculante, excepto que usted pueda presentar reclamaciones en tribunales de reclamaciones menores.

### 12.2 Renuncia a Demanda Colectiva
Usted renuncia a participar en demandas colectivas contra Ross Tax Preparation.

### 12.3 Ley Aplicable
Estos Términos se rigen por las leyes del Estado de Florida, Estados Unidos.

## 13. CANCELACIÓN Y TERMINACIÓN

### 13.1 Su Derecho a Cancelar
Puede cancelar su cuenta en cualquier momento desde la configuración de la app.

### 13.2 Nuestro Derecho a Terminar
Podemos suspender o terminar su cuenta si:
- Viola estos Términos
- Usa los Servicios de manera fraudulenta
- No paga servicios contratados

### 13.3 Efecto de la Terminación
- Pierde acceso a su cuenta
- Los créditos no utilizados pueden ser reembolsados según nuestra política
- Mantiene acceso a declaraciones fiscales previamente presentadas

## 14. MODIFICACIONES

Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios significativos se notificarán con 30 días de anticipación.

## 15. DISPOSICIONES GENERALES

### 15.1 Acuerdo Completo
Estos Términos constituyen el acuerdo completo entre usted y Ross Tax Preparation.

### 15.2 Divisibilidad
Si alguna disposición es inválida, las demás permanecen en efecto.

### 15.3 Renuncia
La falta de hacer cumplir algún derecho no constituye renuncia a ese derecho.

## 16. CONTACTO

Para preguntas sobre estos Términos:
- **Email:** legal@rosstaxpreparation.com
- **Teléfono:** (806) 934-2018
- **Dirección:** Miami, Florida

---

**Al usar nuestros Servicios, usted reconoce que ha leído, entendido y acepta estar vinculado por estos Términos y Condiciones.**
    """
    
    # ================= POLÍTICA DE PRIVACIDAD =================
    privacy_content = """
# POLÍTICA DE PRIVACIDAD

**Última actualización: 3 de noviembre de 2025**

Ross Tax Preparation ("nosotros", "nuestro" o la "Empresa") se compromete a proteger su privacidad. Esta Política de Privacidad explica cómo recopilamos, usamos, compartimos y protegemos su información personal.

## 1. INFORMACIÓN QUE RECOPILAMOS

### 1.1 Información que Usted Proporciona

**Información de Cuenta:**
- Nombre completo
- Dirección de correo electrónico
- Número de teléfono
- Dirección postal
- Fecha de nacimiento
- Número de Seguro Social (SSN) o ITIN

**Información Fiscal:**
- Formularios W-2, 1099, y otros documentos fiscales
- Información sobre ingresos, deducciones y créditos
- Información sobre dependientes
- Documentos de identificación (licencia, pasaporte)

**Información Financiera:**
- Información de tarjetas de crédito/débito (procesada por Stripe)
- Información bancaria (para depósitos directos)
- Historial de transacciones y pagos

**Información de Préstamos:**
- Historial crediticio
- Información de empleo
- Referencias bancarias y financieras

### 1.2 Información Recopilada Automáticamente

**Información del Dispositivo:**
- Tipo de dispositivo y sistema operativo
- Identificadores únicos del dispositivo
- Dirección IP
- Información de ubicación (con su permiso)

**Información de Uso:**
- Páginas visitadas y funciones utilizadas
- Tiempo de uso de la aplicación
- Interacciones con servicios
- Registros de errores y rendimiento

### 1.3 Información de Terceros

Podemos recibir información de:
- Bureaus de crédito (para préstamos)
- IRS y agencias fiscales (para verificación)
- Servicios de verificación de identidad
- Usuarios que lo refieren a través del programa de referidos

## 2. CÓMO USAMOS SU INFORMACIÓN

### 2.1 Proporcionar Servicios
- Preparar y presentar sus declaraciones de impuestos
- Procesar pagos y transacciones de créditos
- Gestionar su cuenta y preferencias
- Proporcionar atención al cliente

### 2.2 Comunicaciones
- Enviar confirmaciones y recibos
- Notificaciones sobre el estado de su declaración
- Actualizaciones sobre cambios fiscales relevantes
- Ofertas promocionales (con su consentimiento)

### 2.3 Mejora de Servicios
- Analizar patrones de uso
- Desarrollar nuevas funciones
- Personalizar su experiencia
- Realizar investigación y análisis

### 2.4 Cumplimiento Legal
- Cumplir con obligaciones fiscales y regulatorias
- Prevenir fraude y actividades ilegales
- Responder a solicitudes legales
- Proteger nuestros derechos y propiedad

### 2.5 Marketing (Con Consentimiento)
- Enviar información sobre nuevos servicios
- Ofertas especiales y promociones
- Newsletters y contenido educativo

## 3. CÓMO COMPARTIMOS SU INFORMACIÓN

### 3.1 Compartimos Su Información Con:

**IRS y Agencias Fiscales:**
- Obligatorio para la presentación de declaraciones
- Según lo requerido por ley

**Procesadores de Pagos:**
- Stripe para procesamiento de tarjetas
- Información mínima necesaria para transacciones

**Proveedores de Servicios:**
- Servicios de almacenamiento en la nube (encriptados)
- Servicios de verificación de identidad
- Proveedores de análisis (datos anonimizados)

**Instituciones Financieras:**
- Para préstamos y servicios financieros
- Bureaus de crédito (con su consentimiento)

**Socios de Marketing:**
- Plataformas de email (con su consentimiento)
- Servicios de análisis de marketing

### 3.2 NO Vendemos Su Información
Nunca vendemos su información personal a terceros con fines de marketing.

### 3.3 Transferencias Corporativas
En caso de fusión, adquisición o venta de activos, su información puede transferirse al nuevo propietario.

## 4. SEGURIDAD DE LA INFORMACIÓN

### 4.1 Medidas de Seguridad Técnicas
- **Encriptación SSL/TLS:** Todas las transmisiones de datos
- **Encriptación en Reposo:** Datos almacenados encriptados
- **Autenticación Multifactor:** Disponible para cuentas
- **Firewalls y Sistemas de Detección:** Protección de servidores

### 4.2 Medidas Organizacionales
- Acceso limitado a información personal (need-to-know basis)
- Capacitación regular del personal en seguridad
- Auditorías de seguridad periódicas
- Políticas estrictas de retención de datos

### 4.3 Cumplimiento de Estándares
- **IRS Publication 1075:** Lineamientos de seguridad de datos fiscales
- **PCI DSS:** Estándar de seguridad de datos de la industria de tarjetas de pago
- **SOC 2:** Controles de seguridad certificados

### 4.4 Notificación de Brechas
En caso de brecha de seguridad, notificaremos a los usuarios afectados dentro de 72 horas.

## 5. SUS DERECHOS DE PRIVACIDAD

### 5.1 Derechos de Acceso y Portabilidad
- Solicitar copia de su información personal
- Descargar sus datos en formato portátil
- Acceso gratuito una vez al año

### 5.2 Derecho de Corrección
- Actualizar información inexacta
- Completar información incompleta

### 5.3 Derecho de Eliminación
- Solicitar eliminación de su información
- Sujeto a obligaciones de retención legal (7 años para registros fiscales)

### 5.4 Derecho de Restricción
- Limitar cómo usamos su información
- Oponerse a ciertos tipos de procesamiento

### 5.5 Derecho de Portabilidad
- Recibir sus datos en formato estructurado y común
- Transferir datos a otro servicio

### 5.6 Derecho de Objeción
- Oponerse a marketing directo
- Oponerse a procesamiento basado en intereses legítimos

## 6. RETENCIÓN DE DATOS

### 6.1 Períodos de Retención

**Registros Fiscales:**
- Mínimo 7 años (requerimiento del IRS)
- Permanente para declaraciones presentadas

**Información de Cuenta:**
- Mientras su cuenta esté activa
- 3 años después del cierre de cuenta

**Transacciones Financieras:**
- 7 años para cumplimiento fiscal y legal

**Comunicaciones:**
- 3 años para soporte al cliente

### 6.2 Eliminación Segura
Cuando eliminamos datos, usamos métodos seguros que previenen recuperación.

## 7. PRIVACIDAD DE MENORES

Nuestros Servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información de menores.

## 8. COOKIES Y TECNOLOGÍAS DE RASTREO

### 8.1 Tipos de Cookies

**Cookies Esenciales:**
- Necesarias para funcionamiento del sitio
- Gestión de sesión y autenticación

**Cookies de Análisis:**
- Comprenden cómo usa nuestros servicios
- Google Analytics (anonimizado)

**Cookies de Marketing:**
- Solo con su consentimiento
- Publicidad personalizada

### 8.2 Control de Cookies
Puede controlar cookies a través de:
- Configuración del navegador
- Configuración de la aplicación
- Herramientas de opt-out

## 9. TRANSFERENCIAS INTERNACIONALES

Sus datos se almacenan en servidores ubicados en Estados Unidos. Al usar nuestros Servicios, consiente la transferencia de datos a EE.UU.

## 10. PRIVACIDAD DE CALIFORNIA (CCPA)

Si es residente de California, tiene derechos adicionales:
- Conocer qué información personal recopilamos
- Conocer si vendemos o compartimos información (no lo hacemos)
- Optar por no vender información
- No discriminación por ejercer derechos

## 11. CAMBIOS A ESTA POLÍTICA

Notificaremos cambios significativos mediante:
- Email a su dirección registrada
- Notificación en la aplicación
- Publicación en nuestro sitio web

## 12. CONTACTO

Para preguntas sobre privacidad o ejercer sus derechos:

**Oficial de Privacidad:**
- **Email:** privacy@rosstaxpreparation.com
- **Teléfono:** (806) 934-2018
- **Dirección:** Miami, Florida

**Tiempo de Respuesta:**
- Responderemos a solicitudes dentro de 30 días

---

**Al usar nuestros Servicios, usted reconoce que ha leído y entendido esta Política de Privacidad.**
    """
    
    # ================= PREGUNTAS FRECUENTES (FAQs) =================
    faqs = [
        {
            'category': 'Servicios de Impuestos',
            'question': '¿Cuánto tiempo tarda en prepararse mi declaración de impuestos?',
            'answer': 'El tiempo varía según la complejidad:\n- Declaración simple (W-2): 1-2 días hábiles\n- Declaración estándar: 2-3 días hábiles\n- Declaración compleja: 5-7 días hábiles\n\nOfrecemos servicio prioritario para entrega en 24 horas por 80 créditos adicionales.',
            'order': 1
        },
        {
            'category': 'Servicios de Impuestos',
            'question': '¿Qué documentos necesito para preparar mis impuestos?',
            'answer': 'Documentos básicos:\n- Formularios W-2 de todos los empleadores\n- Formularios 1099 (intereses, dividendos, freelance)\n- Recibos de deducciones (médicos, donaciones, educación)\n- SSN o ITIN de usted y dependientes\n- Declaración del año anterior\n\nSuba sus documentos directamente en la app para comenzar.',
            'order': 2
        },
        {
            'category': 'Servicios de Impuestos',
            'question': '¿Puedo corregir una declaración ya presentada?',
            'answer': 'Sí, ofrecemos servicio de enmienda (1040-X) para corregir declaraciones presentadas. El costo es de 100 créditos para enmiendas simples y 180 créditos para enmiendas complejas. El IRS tarda generalmente 16 semanas en procesar enmiendas.',
            'order': 3
        },
        {
            'category': 'Sistema de Créditos',
            'question': '¿Qué son los créditos Ross Tax y cómo funcionan?',
            'answer': 'Los créditos Ross Tax son nuestra moneda prepagada:\n- 1 crédito = $1 USD\n- Cómprelos con tarjeta de crédito/débito\n- Úselos para pagar cualquier servicio\n- No caducan nunca\n- Transfiéralos a otros usuarios\n- Solicite reembolso si es necesario',
            'order': 4
        },
        {
            'category': 'Sistema de Créditos',
            'question': '¿Cómo compro créditos?',
            'answer': '1. Ve a "Mi Wallet" en la app\n2. Toca "Añadir Dinero"\n3. Ingresa el monto deseado o elige un paquete\n4. Selecciona método de pago (tarjeta)\n5. Confirma la compra\n\nLos créditos se agregan instantáneamente a tu wallet.',
            'order': 5
        },
        {
            'category': 'Sistema de Créditos',
            'question': '¿Puedo transferir créditos a otra persona?',
            'answer': 'Sí, las transferencias P2P son instantáneas:\n1. Ve a "Enviar" en tu wallet\n2. Ingresa el email del destinatario\n3. Especifica el monto\n4. Confirma la transferencia\n\nLas transferencias son inmediatas e irreversibles. Verifica el email antes de enviar.',
            'order': 6
        },
        {
            'category': 'Sistema de Créditos',
            'question': '¿Cómo funciona el sistema de solicitud de dinero?',
            'answer': 'Para solicitar créditos:\n1. Ve a "Recibir" en tu wallet\n2. Pestaña "Solicitar"\n3. Ingresa email del pagador y monto\n4. Envía la solicitud\n\nEl destinatario recibe notificación y tiene 48 horas para aprobar o rechazar. Si aprueba, los créditos se transfieren instantáneamente.',
            'order': 7
        },
        {
            'category': 'Sistema de Créditos',
            'question': '¿Puedo obtener un reembolso de créditos?',
            'answer': 'Sí, los reembolsos están disponibles:\n- Solicítelos desde "Mi Wallet" → "Reembolso"\n- Se aplica tarifa administrativa del 3%\n- Procesamiento en 5-10 días hábiles\n- Sujeto a aprobación del administrador\n\nLos créditos usados en servicios no son reembolsables.',
            'order': 8
        },
        {
            'category': 'Pagos',
            'question': '¿Qué métodos de pago aceptan?',
            'answer': 'Aceptamos:\n- Tarjetas de crédito (Visa, Mastercard, Amex)\n- Tarjetas de débito\n- Créditos Ross Tax prepagados\n\nTodos los pagos se procesan de forma segura a través de Stripe.',
            'order': 9
        },
        {
            'category': 'Pagos',
            'question': '¿Es seguro guardar mi tarjeta en la app?',
            'answer': 'Absolutamente seguro:\n- Usamos Stripe, líder en procesamiento de pagos\n- Cumplimos con PCI DSS (estándar de seguridad de tarjetas)\n- No almacenamos números completos de tarjetas\n- Encriptación de extremo a extremo\n- Autenticación 3D Secure disponible',
            'order': 10
        },
        {
            'category': 'Préstamos',
            'question': '¿Qué tipos de préstamos ofrecen?',
            'answer': 'Ofrecemos:\n- Préstamos personales hasta $5,000\n- Adelantos de reembolso de impuestos\n- Financiamiento de servicios fiscales\n\nLos términos varían según perfil crediticio. Aprobación en 24-48 horas.',
            'order': 11
        },
        {
            'category': 'Préstamos',
            'question': '¿Qué requisitos necesito para un préstamo?',
            'answer': 'Requisitos básicos:\n- Tener 18+ años\n- Ingreso verificable mínimo\n- Cuenta bancaria activa\n- SSN o ITIN válido\n- Historial crediticio (verificación blanda)\n\nCompletaría solicitud en la app en menos de 5 minutos.',
            'order': 12
        },
        {
            'category': 'Programa de Referidos',
            'question': '¿Cómo funciona el programa de referidos?',
            'answer': 'Gana créditos por referir amigos:\n1. Comparte tu código único desde "Referidos"\n2. Tu amigo se registra con tu código\n3. Cuando completa su primera transacción, ambos reciben bonus\n\nBonificaciones típicas: 10-25 créditos por referido exitoso.',
            'order': 13
        },
        {
            'category': 'Cuenta y Seguridad',
            'question': '¿Cómo protejo mi cuenta?',
            'answer': 'Recomendaciones de seguridad:\n- Use contraseña fuerte y única\n- Active autenticación de dos factores\n- No comparta su contraseña\n- Cierre sesión en dispositivos compartidos\n- Revise actividad de cuenta regularmente\n- Reporte actividad sospechosa inmediatamente',
            'order': 14
        },
        {
            'category': 'Cuenta y Seguridad',
            'question': '¿Qué hago si olvido mi contraseña?',
            'answer': '1. Toca "Olvidé mi contraseña" en pantalla de login\n2. Ingresa tu email registrado\n3. Revisa tu email para link de recuperación\n4. Crea una nueva contraseña segura\n\nSi no recibes el email, revisa spam o contacta soporte.',
            'order': 15
        },
        {
            'category': 'Soporte',
            'question': '¿Cómo contacto con soporte?',
            'answer': 'Múltiples canales de soporte:\n- Chat en vivo en la app (Lu-Vi 9am-6pm CST)\n- Email: info@rosstaxpreparation.com\n- Teléfono: (806) 934-2018\n- Centro de ayuda en la app\n\nTiempo de respuesta típico: 24 horas.',
            'order': 16
        },
        {
            'category': 'Soporte',
            'question': '¿Dónde veo el estado de mi declaración?',
            'answer': 'Rastrea tu declaración:\n1. Ve a "Mis Declaraciones" en el menú\n2. Selecciona la declaración del año actual\n3. Ve el estado actual (Preparando, Revisión, Presentada)\n4. Activa notificaciones para actualizaciones automáticas\n\nTambién puedes usar la herramienta "Where\'s My Refund" del IRS.',
            'order': 17
        }
    ]
    
    # Insertar Términos y Condiciones
    try:
        # Despublicar versiones anteriores de términos
        await db.legal_documents.update_many(
            {'document_type': 'terms', 'is_published': True},
            {'$set': {'is_published': False}}
        )
        
        terms_doc = {
            'document_type': 'terms',
            'title': 'Términos y Condiciones de Servicio',
            'content': terms_content,
            'version': '2.0',
            'is_published': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'effective_date': datetime.utcnow()
        }
        
        result = await db.legal_documents.insert_one(terms_doc)
        print(f"✅ Términos y Condiciones creados (ID: {result.inserted_id})")
        
    except Exception as e:
        print(f"❌ Error creando términos: {e}")
    
    # Insertar Política de Privacidad
    try:
        # Despublicar versiones anteriores de privacy
        await db.legal_documents.update_many(
            {'document_type': 'privacy', 'is_published': True},
            {'$set': {'is_published': False}}
        )
        
        privacy_doc = {
            'document_type': 'privacy',
            'title': 'Política de Privacidad',
            'content': privacy_content,
            'version': '2.0',
            'is_published': True,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'effective_date': datetime.utcnow()
        }
        
        result = await db.legal_documents.insert_one(privacy_doc)
        print(f"✅ Política de Privacidad creada (ID: {result.inserted_id})")
        
    except Exception as e:
        print(f"❌ Error creando política: {e}")
    
    # Insertar FAQs
    try:
        # Limpiar FAQs anteriores
        await db.faqs.delete_many({})
        
        for faq in faqs:
            faq['created_at'] = datetime.utcnow()
            faq['updated_at'] = datetime.utcnow()
            faq['is_published'] = True
        
        result = await db.faqs.insert_many(faqs)
        print(f"✅ {len(result.inserted_ids)} FAQs creadas")
        
    except Exception as e:
        print(f"❌ Error creando FAQs: {e}")
    
    print("\n🎉 Documentos legales actualizados exitosamente!")
    print("📋 Total de documentos:")
    print(f"   - 1 Términos y Condiciones (v2.0)")
    print(f"   - 1 Política de Privacidad (v2.0)")
    print(f"   - {len(faqs)} Preguntas Frecuentes")

if __name__ == "__main__":
    asyncio.run(create_legal_documents())
