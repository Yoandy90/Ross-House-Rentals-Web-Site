"""
Update Terms and Conditions and Privacy Policy to cover all app features
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "taxportal")

COMPREHENSIVE_TERMS = """# Términos y Condiciones de Ross Tax Preparation

**Fecha de vigencia:** 1 de enero de 2025
**Versión:** 2.0

## 1. Aceptación de los Términos

Al acceder o utilizar la aplicación móvil de Ross Tax Preparation ("la App"), el sitio web, o cualquiera de nuestros servicios, usted acepta estar legalmente vinculado por estos Términos y Condiciones. Si no está de acuerdo con estos términos, no utilice nuestros servicios.

## 2. Descripción de Servicios

Ross Tax Preparation ofrece los siguientes servicios a través de nuestra plataforma:

### 2.1 Servicios de Preparación de Impuestos
- Preparación profesional de declaraciones federales y estatales
- Revisión de documentos fiscales
- Asesoría fiscal personalizada
- Representación ante el IRS (según disponibilidad)

### 2.2 Asistente de IA (Ross AI Brain)
- Asistencia automatizada 24/7 para consultas fiscales generales
- Generación de respuestas usando inteligencia artificial (Gemini 2.5 Pro)
- Recomendaciones personalizadas basadas en su perfil
- **IMPORTANTE:** Las respuestas del AI Brain son informativas y NO constituyen asesoría fiscal profesional oficial

### 2.3 Sistema de Créditos Ross Tax
- Programa de recompensas interno ("Ross Tax Credits")
- 1 crédito = $1 USD para servicios de Ross Tax
- Los créditos NO son reembolsables en efectivo
- Los créditos NO expiran
- Pueden transferirse entre usuarios registrados
- Pueden obtenerse mediante: referidos, promociones, o compra directa

### 2.4 Sistema de Pagos
- Aceptamos: tarjetas de crédito/débito, ACH, Ross Tax Credits
- Procesamiento seguro a través de Stripe
- Todos los pagos están sujetos a verificación
- Las tarifas deben pagarse antes de la presentación de declaraciones

### 2.5 Gestión de Documentos
- Carga segura de documentos fiscales
- Almacenamiento encriptado por 7 años (requisito IRS)
- Acceso 24/7 a sus documentos
- Límite de 10MB por archivo

### 2.6 Sistema de Citas
- Programación de citas presenciales y virtuales
- Recordatorios automáticos
- Cancelación hasta 24 horas antes sin penalización
- Cancelaciones tardías pueden incurrir en cargos

### 2.7 Contenido Educativo
- Acceso a artículos, guías y recursos fiscales
- Noticias fiscales actualizadas
- FAQs interactivas
- Contenido bilingüe (inglés/español)

### 2.8 Programa de Referencias
- Gane créditos por cada cliente referido exitoso
- El cliente referido debe completar al menos un servicio
- Los créditos se acreditan después de la confirmación del servicio

### 2.9 Servicios Adicionales
- Verificación de identidad (KYC)
- Notificaciones push
- Soporte por WhatsApp
- Integración con Rise CRM

## 3. Elegibilidad y Cuenta de Usuario

### 3.1 Requisitos
- Debe tener al menos 18 años de edad
- Debe proporcionar información precisa y actual
- Debe mantener la seguridad de su contraseña
- Es responsable de todas las actividades en su cuenta

### 3.2 Verificación de Identidad
- Podemos requerir verificación de identidad (KYC) para ciertos servicios
- Debe proporcionar documentos válidos cuando se soliciten
- El incumplimiento puede resultar en suspensión de servicios

## 4. Responsabilidades del Cliente

Usted se compromete a:

- **Información Precisa:** Proporcionar información veraz, precisa y completa
- **Documentos Completos:** Entregar todos los documentos necesarios oportunamente
- **Cooperación:** Responder a solicitudes de información adicional
- **Pagos Puntuales:** Pagar las tarifas acordadas según los términos
- **Uso Apropiado:** No usar la App para actividades ilegales o no autorizadas
- **Seguridad:** Mantener confidenciales sus credenciales de acceso
- **Actualización:** Mantener su información de contacto actualizada

## 5. Responsabilidades de Ross Tax Preparation

Nos comprometemos a:

- Mantener la confidencialidad de su información
- Preparar declaraciones con precisión profesional
- Cumplir con todas las regulaciones del IRS y estatales
- Proporcionar soporte durante todo el proceso
- Mantener seguros sus datos con encriptación de grado bancario
- Notificarle sobre cualquier cambio material en nuestros servicios

## 6. Tarifas, Pagos y Reembolsos

### 6.1 Estructura de Tarifas
- Las tarifas se comunican claramente antes de iniciar cualquier servicio
- Las tarifas varían según la complejidad de la declaración
- Pueden aplicarse cargos adicionales por servicios especiales

### 6.2 Métodos de Pago
- Tarjetas de crédito/débito (Visa, Mastercard, Amex, Discover)
- ACH/Transferencia bancaria directa
- Ross Tax Credits (para servicios seleccionados)

### 6.3 Política de Reembolsos
- Los servicios de preparación de impuestos NO son reembolsables una vez completados
- Puede solicitar reembolso si cancela ANTES de que comience el trabajo
- Los Ross Tax Credits NO son reembolsables en efectivo
- Las compras de créditos son finales

### 6.4 Suscripciones
- Algunas funciones pueden requerir suscripción
- Las suscripciones se renuevan automáticamente
- Puede cancelar en cualquier momento
- No se otorgan reembolsos prorrateados

## 7. Uso del AI Brain

### 7.1 Naturaleza del Servicio
- El AI Brain utiliza inteligencia artificial (Gemini 2.5 Pro de Google)
- Proporciona información general y orientación
- NO reemplaza la asesoría de un profesional fiscal certificado
- Las respuestas son generadas automáticamente y pueden contener errores

### 7.2 Limitaciones
- No nos responsabilizamos por decisiones basadas únicamente en el AI Brain
- Siempre debe consultar a un profesional para decisiones fiscales importantes
- El AI Brain no tiene acceso a cambios fiscales en tiempo real
- Las leyes fiscales cambian; verifique la información actual

### 7.3 Uso Apropiado
- No utilice el AI Brain para actividades ilegales
- No intente manipular o "hackear" el sistema
- No comparta información de identificación sensible (SSN completo, números de cuenta)

## 8. Propiedad Intelectual

### 8.1 Contenido de Ross Tax
- Todo el contenido de la App (texto, gráficos, logos, software) es propiedad de Ross Tax Preparation
- No puede copiar, reproducir, distribuir o crear obras derivadas
- Se otorga una licencia limitada para uso personal

### 8.2 Contenido del Usuario
- Usted mantiene la propiedad de los documentos que carga
- Nos otorga una licencia para usar sus documentos para proporcionar servicios
- Podemos usar datos agregados (anónimos) para mejorar servicios

## 9. Privacidad y Seguridad de Datos

### 9.1 Recopilación de Datos
- Recopilamos información necesaria para proporcionar servicios fiscales
- Consulte nuestra Política de Privacidad para detalles completos

### 9.2 Seguridad
- Utilizamos encriptación SSL/TLS para proteger datos en tránsito
- Los datos en reposo están encriptados con AES-256
- Realizamos auditorías de seguridad regulares
- Cumplimos con estándares de la industria

### 9.3 Retención
- Mantenemos registros por 7 años (requisito IRS)
- Después, los datos pueden ser eliminados de forma segura
- Puede solicitar eliminación (sujeto a requisitos legales)

## 10. Notificaciones y Comunicaciones

### 10.1 Consentimiento para Comunicaciones
Al usar nuestros servicios, acepta recibir:
- Notificaciones push en la App
- Emails sobre su cuenta y servicios
- SMS/mensajes de texto (si proporcionó número)
- Mensajes de WhatsApp (si se registró en ese servicio)

### 10.2 Opt-Out
- Puede desactivar notificaciones push en configuración de la App
- Puede cancelar suscripción de emails (excepto notificaciones transaccionales)
- Los mensajes transaccionales (confirmaciones, estados) no pueden desactivarse

## 11. Geolocalización

- La App puede solicitar acceso a su ubicación para:
  - Encontrar oficinas cercanas
  - Optimizar servicios según jurisdicción fiscal local
  - Mejorar funcionalidades de la App
- Puede denegar permisos de ubicación en cualquier momento
- Algunas funciones pueden requerir ubicación para funcionar

## 12. Programa de Referencias

### 12.1 Cómo Funciona
- Comparta su código de referencia único
- Cuando alguien se registre y complete un servicio, ambos reciben créditos
- Los créditos se acreditan dentro de 7 días hábiles

### 12.2 Restricciones
- No puede crear múltiples cuentas para auto-referirse
- Las referencias deben ser clientes genuinos
- Nos reservamos el derecho de invalidar referencias fraudulentas
- Los créditos de referencias fraudulentas serán eliminados

## 13. Limitación de Responsabilidad

### 13.1 Servicios "Como Están"
- Los servicios se proporcionan "como están" y "según disponibilidad"
- No garantizamos resultados específicos
- No somos responsables por interrupciones del servicio

### 13.2 Límites
En la medida máxima permitida por la ley:
- Nuestra responsabilidad total no excederá las tarifas pagadas por usted
- No somos responsables por daños indirectos, incidentales o consecuentes
- No garantizamos que la App esté libre de errores o virus

### 13.3 Excepciones
No limitamos la responsabilidad por:
- Muerte o lesiones personales causadas por nuestra negligencia
- Fraude o tergiversación fraudulenta
- Cualquier responsabilidad que no pueda limitarse legalmente

## 14. Indemnización

Usted acepta indemnizar y mantener indemne a Ross Tax Preparation, sus oficiales, directores, empleados y agentes de cualquier reclamo, daño, pérdida o gasto (incluyendo honorarios legales) que surjan de:
- Su uso de nuestros servicios
- Su violación de estos Términos
- Su violación de derechos de terceros
- Información falsa o engañosa que proporcione

## 15. Suspensión y Terminación

### 15.1 Por Nuestra Parte
Podemos suspender o terminar su acceso si:
- Viola estos Términos
- Proporciona información falsa
- Participa en actividades fraudulentas
- No paga las tarifas adeudadas
- Por cualquier razón con aviso de 30 días

### 15.2 Por Su Parte
- Puede cerrar su cuenta en cualquier momento
- Debe pagar todas las tarifas pendientes antes del cierre
- Sus datos se mantendrán según los requisitos legales

### 15.3 Efectos de la Terminación
- Pierde acceso inmediato a la App
- Sus datos se mantendrán según requisitos de retención
- Las obligaciones financieras sobreviven a la terminación

## 16. Resolución de Disputas

### 16.1 Ley Aplicable
Estos Términos se rigen por las leyes del Estado de Texas, EE.UU.

### 16.2 Arbitraje
- Cualquier disputa se resolverá mediante arbitraje vinculante
- El arbitraje se llevará a cabo en Dumas, Texas
- Cada parte paga sus propios costos legales
- Se exceptúan: reclamos de propiedad intelectual y medidas cautelares

### 16.3 Renuncia a Demanda Colectiva
- Acepta resolver disputas individualmente
- Renuncia al derecho de participar en demandas colectivas

## 17. Modificaciones a los Términos

- Podemos modificar estos Términos en cualquier momento
- Los cambios materiales se notificarán con 30 días de anticipación
- El uso continuado después de cambios constituye aceptación
- Si no está de acuerdo, debe dejar de usar la App

## 18. Disposiciones Generales

### 18.1 Acuerdo Completo
Estos Términos constituyen el acuerdo completo entre usted y Ross Tax Preparation.

### 18.2 Divisibilidad
Si alguna disposición es inválida, las demás permanecen en vigor.

### 18.3 Renuncia
La falta de ejercicio de un derecho no constituye renuncia.

### 18.4 Cesión
No puede transferir sus derechos bajo estos Términos sin nuestro consentimiento.

### 18.5 Idioma
En caso de conflicto entre versiones en inglés y español, prevalece la versión en inglés.

## 19. Cumplimiento Regulatorio

Cumplimos con:
- IRS Circular 230
- Gramm-Leach-Bliley Act (GLBA)
- Texas State Tax Code
- FTC Safeguards Rule
- TCPA (Telephone Consumer Protection Act)
- CAN-SPAM Act

## 20. Información de Contacto

Para preguntas sobre estos Términos:

**Ross Tax Preparation**
- **Dirección:** 305 Bruce Ave, Dumas, TX 79029
- **Teléfono:** (806) 930-7456
- **Email:** info@rosstaxpreparation.com
- **Horario:** Lunes a Viernes, 9:00 AM - 6:00 PM CST

**Soporte Técnico:**
- **Email:** support@rosstaxpreparation.com
- **WhatsApp:** (806) 930-7456

---

**Última actualización:** 1 de enero de 2025

Al utilizar nuestros servicios, usted reconoce que ha leído, entendido y acepta estar vinculado por estos Términos y Condiciones."""

COMPREHENSIVE_PRIVACY = """# Política de Privacidad de Ross Tax Preparation

**Fecha de vigencia:** 1 de enero de 2025
**Versión:** 2.0

## Introducción

En Ross Tax Preparation ("nosotros", "nuestro", "la empresa"), nos comprometemos a proteger su privacidad y manejar su información personal con el más alto nivel de cuidado y confidencialidad. Esta Política de Privacidad explica qué información recopilamos, cómo la usamos, con quién la compartimos, y sus derechos respecto a sus datos.

**IMPORTANTE:** Como preparadores fiscales profesionales, estamos sujetos a estrictas leyes federales y estatales que protegen la privacidad de su información fiscal.

## 1. Información que Recopilamos

### 1.1 Información Personal de Identificación
- **Información básica:** Nombre completo, fecha de nacimiento, dirección, número de teléfono, email
- **Información fiscal:** Número de Seguro Social (SSN), ITIN, EIN
- **Información financiera:** Ingresos, deducciones, información bancaria, números de tarjeta (tokenizados)
- **Información familiar:** Estado civil, dependientes, información del cónyuge

### 1.2 Documentos Fiscales
- W-2, 1099s, 1098s (formularios de ingresos e intereses)
- Recibos de gastos deducibles
- Estados de cuenta bancarios y financieros
- Documentos de bienes raíces
- Registros de negocios (si aplica)
- Declaraciones de impuestos anteriores

### 1.3 Información de Cuenta
- Credenciales de inicio de sesión (contraseña hasheada)
- Preferencias de usuario
- Historial de servicios
- Saldo de Ross Tax Credits
- Historial de transacciones y pagos

### 1.4 Información Técnica
- **Dispositivo:** Modelo, sistema operativo, versión de App
- **Uso:** Páginas visitadas, funciones utilizadas, tiempo en la App
- **Ubicación:** Ubicación aproximada (ciudad/estado) basada en IP o GPS (con su permiso)
- **Logs:** Direcciones IP, timestamps, errores de la App

### 1.5 Información de Comunicaciones
- Mensajes enviados a través del chat de la App
- Interacciones con el AI Brain
- Emails y llamadas con nuestro equipo
- Mensajes de WhatsApp (si utiliza ese servicio)
- Notificaciones push

### 1.6 Información de Terceros
- Información de verificación de identidad (KYC) de proveedores como Plaid
- Datos de procesamiento de pagos de Stripe
- Sincronización con Rise CRM

## 2. Cómo Usamos su Información

### 2.1 Proporcionar Servicios Fiscales
- Preparar y presentar sus declaraciones de impuestos
- Analizar su situación fiscal
- Calcular créditos y deducciones aplicables
- Representarle ante el IRS (si contratado)
- Proporcionar asesoría fiscal personalizada

### 2.2 Gestión de Cuenta
- Crear y mantener su cuenta
- Autenticar su identidad
- Procesar pagos y gestionar Ross Tax Credits
- Gestionar suscripciones y renovaciones
- Procesar retiros y transferencias

### 2.3 Comunicaciones
- Enviar confirmaciones de servicio y recibos
- Proporcionar actualizaciones sobre el estado de su declaración
- Enviar recordatorios de citas
- Notificar cambios importantes en leyes fiscales
- Responder a sus consultas y proporcionar soporte
- Enviar notificaciones push sobre su cuenta

### 2.4 Mejorar Servicios
- Analizar uso de la App para mejorar funcionalidad
- Entrenar y mejorar el AI Brain (datos anonimizados)
- Desarrollar nuevas funciones
- Realizar encuestas de satisfacción
- Detectar y prevenir fraude

### 2.5 AI Brain (Asistente Virtual)
- Generar respuestas personalizadas a sus consultas
- Analizar su perfil fiscal para recomendaciones
- Aprender de interacciones para mejorar respuestas (datos agregados)
- **NOTA:** El AI Brain NO tiene acceso a su SSN completo o información bancaria completa

### 2.6 Marketing (Con su Consentimiento)
- Enviar newsletters con contenido educativo
- Informar sobre nuevos servicios y promociones
- Programa de referencias y recompensas
- **PUEDE OPT-OUT** en cualquier momento

### 2.7 Cumplimiento Legal
- Cumplir con obligaciones legales y regulatorias
- Responder a órdenes judiciales y solicitudes legales
- Proteger nuestros derechos legales
- Prevenir fraude y actividades ilegales

## 3. Compartir Información con Terceros

### 3.1 Agencias Gubernamentales
**IRS (Internal Revenue Service):**
- Compartimos su información fiscal para presentar declaraciones
- Requerido por ley federal

**Agencias Estatales de Impuestos:**
- Compartimos información para declaraciones estatales
- Requerido por leyes estatales

**Otras Agencias:**
- Solo con órdenes judiciales válidas o citaciones

### 3.2 Proveedores de Servicios (Procesadores de Datos)
Trabajamos con terceros de confianza que procesan datos en nuestro nombre:

**Stripe (Procesamiento de Pagos):**
- Información de tarjetas y transacciones
- Sujeto a PCI DSS (estándares de seguridad)

**Google Cloud (Gemini AI):**
- Consultas generales al AI Brain (sin SSN ni información sensible)
- Datos anonimizados para procesamiento

**Rise CRM:**
- Información de gestión de clientes
- Para optimizar servicios

**MongoDB Atlas:**
- Almacenamiento de base de datos
- Servidores en EE.UU., encriptación en reposo

**Plaid (Verificación Bancaria):**
- Solo si utiliza servicios que requieren verificación
- Conexiones bancarias seguras

**Twilio/SendGrid:**
- Envío de notificaciones y emails
- No tienen acceso a información fiscal

**Proveedores de Notificaciones Push:**
- Tokens de dispositivo para enviar notificaciones
- No incluyen información sensible

### 3.3 Con su Consentimiento Explícito
- Podemos compartir con terceros que usted específicamente autorice
- Siempre solicitaremos su permiso antes de compartir

### 3.4 Transferencias Corporativas
- En caso de fusión, adquisición o venta de activos
- Los nuevos propietarios estarán sujetos a esta Política de Privacidad

### 3.5 NO Compartimos Con
❌ **NUNCA** vendemos su información personal
❌ **NUNCA** compartimos con agregadores de datos
❌ **NUNCA** compartimos con anunciantes externos
❌ **NUNCA** compartimos con competidores

## 4. Seguridad de Datos

### 4.1 Medidas Técnicas
**Encriptación:**
- SSL/TLS para datos en tránsito (conexiones)
- AES-256 para datos en reposo (almacenamiento)
- Encriptación end-to-end para comunicaciones sensibles

**Seguridad de Contraseñas:**
- Hash con bcrypt (no almacenamos contraseñas en texto plano)
- Requisitos de contraseña fuerte
- Autenticación de dos factores (opcional)

**Seguridad de Red:**
- Firewalls y sistemas de detección de intrusos
- Monitoreo 24/7 de actividades sospechosas
- Auditorías de seguridad regulares

**Acceso Restringido:**
- Principio de menor privilegio
- Solo personal autorizado accede a datos sensibles
- Logs de auditoría de todos los accesos

### 4.2 Medidas Organizacionales
**Capacitación del Personal:**
- Entrenamiento regular en privacidad y seguridad
- Acuerdos de confidencialidad firmados
- Verificación de antecedentes de empleados

**Políticas y Procedimientos:**
- Plan de respuesta a incidentes
- Procedimientos de eliminación segura de datos
- Políticas de retención y destrucción

**Cumplimiento:**
- Auditorías internas regulares
- Evaluaciones de riesgo anuales
- Cumplimiento con IRS Circular 230 y FTC Safeguards Rule

### 4.3 Limitaciones
**IMPORTANTE:** Ningún sistema es 100% seguro. Aunque implementamos medidas robustas, no podemos garantizar seguridad absoluta. Usted también es responsable de mantener seguras sus credenciales.

## 5. Retención de Datos

### 5.1 Registros Fiscales
**Período Mínimo:** 7 años desde la presentación de la declaración
- Requerido por regulaciones del IRS
- Necesario en caso de auditoría
- Protege tanto a usted como a nosotros

**Después de 7 Años:**
- Podemos eliminar datos de forma segura
- Puede solicitar eliminación anticipada (sujeto a restricciones legales)

### 5.2 Información de Cuenta
- Mientras su cuenta esté activa
- Hasta 90 días después del cierre de cuenta
- Logs de auditoría: hasta 7 años

### 5.3 Comunicaciones
- Emails y mensajes: hasta 3 años
- Logs de chat con AI Brain: hasta 2 años (anonimizados después)
- Llamadas grabadas: hasta 3 años (con su consentimiento)

### 5.4 Datos Técnicos
- Logs de servidor: hasta 1 año
- Análisis de uso: indefinidamente (anonimizado)

## 6. Sus Derechos de Privacidad

### 6.1 Derecho de Acceso
- Puede solicitar copia de su información personal
- Responderemos dentro de 30 días
- Primera solicitud: gratuita
- Solicitudes adicionales: pueden aplicar tarifas razonables

### 6.2 Derecho de Corrección
- Puede solicitar corrección de datos inexactos
- Actualizaremos información dentro de 14 días

### 6.3 Derecho de Eliminación ("Derecho al Olvido")
- Puede solicitar eliminación de datos
- **LIMITACIONES:** No podemos eliminar si:
  - Requerido por ley (registros fiscales de 7 años)
  - Necesario para cumplir obligaciones legales
  - Necesario para establecer, ejercer o defender reclamos legales

### 6.4 Derecho de Portabilidad
- Puede recibir sus datos en formato estructurado, comúnmente usado
- Puede transmitir datos a otro servicio (formato JSON o CSV)

### 6.5 Derecho de Oposición
- Puede oponerse al procesamiento de datos para marketing
- Puede oponerse al procesamiento basado en intereses legítimos

### 6.6 Derecho de Restricción
- Puede solicitar restricción de procesamiento en ciertas circunstancias

### 6.7 Cómo Ejercer sus Derechos
**Email:** privacy@rosstaxpreparation.com
**Teléfono:** (806) 930-7456
**Correo:** 305 Bruce Ave, Dumas, TX 79029, Attn: Privacy Officer

Necesitaremos verificar su identidad antes de procesar solicitudes.

## 7. Privacidad de Menores

- Nuestros servicios NO están dirigidos a menores de 18 años
- No recopilamos información de menores conscientemente
- Si descubrimos información de menores, la eliminaremos inmediatamente
- Los padres pueden ser clientes y proporcionar información de dependientes para fines fiscales

## 8. Cookies y Tecnologías de Seguimiento

### 8.1 Cookies
**Cookies Esenciales:**
- Mantienen sesión activa
- Recuerdan preferencias de idioma
- **NO PUEDEN DESACTIVARSE** (necesarios para funcionamiento)

**Cookies Analíticas:**
- Rastrean uso de la App para mejoras
- Google Analytics (anonimizado)
- **PUEDEN DESACTIVARSE** en configuración

### 8.2 Tecnologías Móviles
**Tokens de Push:**
- Para enviar notificaciones
- Puede desactivar en configuración del dispositivo

**Identificadores de Dispositivo:**
- Para prevenir fraude
- Para autenticación

### 8.3 Sus Opciones
- Configuración > Privacidad > Cookies y Seguimiento
- Puede rechazar cookies no esenciales
- Algunas funciones pueden no funcionar sin cookies

## 9. Transferencias Internacionales de Datos

- Sus datos se almacenan principalmente en servidores en Estados Unidos
- Algunos proveedores pueden tener servidores en otras jurisdicciones
- Todas las transferencias cumplen con leyes aplicables
- Utilizamos cláusulas contractuales estándar para protección

## 10. Privacidad en California (CCPA)

Si es residente de California, tiene derechos adicionales bajo CCPA:

### 10.1 Derecho a Saber
- Categorías de información personal recopilada
- Fuentes de información
- Propósitos comerciales
- Terceros con quienes se comparte

### 10.2 Derecho a Eliminar
- Sujeto a excepciones legales (registros fiscales)

### 10.3 Derecho a Optar por No Venta
- **NO VENDEMOS** su información personal
- Este derecho no aplica ya que no vendemos datos

### 10.4 No Discriminación
- No discriminaremos por ejercer sus derechos CCPA

### 10.5 Agente Autorizado
- Puede designar un agente para hacer solicitudes
- Necesitaremos autorización escrita

## 11. Cambios a esta Política

- Podemos actualizar esta Política periódicamente
- Cambios materiales se notificarán con 30 días de anticipación
- Notificaciones por: email, notificación en la App, banner en sitio web
- Última actualización se indica al inicio del documento
- Uso continuado después de cambios constituye aceptación

## 12. Cumplimiento Regulatorio

Esta Política cumple con:

**Federal:**
- Gramm-Leach-Bliley Act (GLBA)
- IRS Circular 230
- FTC Safeguards Rule
- CAN-SPAM Act
- TCPA (Telephone Consumer Protection Act)

**Estatal:**
- California Consumer Privacy Act (CCPA)
- Texas Identity Theft Enforcement and Protection Act
- Otras leyes estatales aplicables

**Internacional (si aplica):**
- GDPR (para residentes de la UE/EEA)

## 13. Privacidad del AI Brain

### 13.1 Qué Información Usa
- Su nombre y perfil general
- Historial de consultas previas (para contexto)
- Información fiscal agregada (sin detalles sensibles)

### 13.2 Qué NO Usa
- Su SSN completo (solo últimos 4 dígitos si es necesario)
- Números de cuenta bancaria completos
- Información de tarjetas de crédito
- Documentos fiscales completos

### 13.3 Mejora del Modelo
- Usamos interacciones agregadas y anonimizadas para mejorar respuestas
- Nunca entrenamos el modelo con su información personal identificable
- Puede solicitar exclusión del entrenamiento

### 13.4 Retención
- Consultas específicas: 2 años
- Después se anonimizan completamente

## 14. Violaciones de Datos

### 14.1 Notificación
En caso de violación que afecte su información personal:
- Le notificaremos dentro de 72 horas del descubrimiento
- Descripción de la violación
- Tipos de información afectada
- Medidas tomadas para mitigar
- Pasos que debe tomar para protegerse

### 14.2 Respuesta
- Investigación inmediata
- Notificación a autoridades cuando sea requerido
- Oferta de servicios de monitoreo de crédito (si aplica)

## 15. Información de Contacto

### 15.1 Preguntas sobre Privacidad
**Privacy Officer**
- **Email:** privacy@rosstaxpreparation.com
- **Teléfono:** (806) 930-7456
- **Correo:** 305 Bruce Ave, Dumas, TX 79029

### 15.2 Información General
- **Email:** info@rosstaxpreparation.com
- **Teléfono:** (806) 930-7456
- **Horario:** Lunes a Viernes, 9:00 AM - 6:00 PM CST

### 15.3 Soporte Técnico
- **Email:** support@rosstaxpreparation.com
- **WhatsApp:** (806) 930-7456

### 15.4 Quejas
Si no está satisfecho con nuestra respuesta a una solicitud de privacidad:
- Puede presentar queja ante la FTC (ftc.gov)
- Texas Attorney General (texasattorneygeneral.gov)
- California Attorney General (si residente de CA)

---

**Última actualización:** 1 de enero de 2025
**Versión:** 2.0

Al utilizar nuestros servicios, usted reconoce que ha leído y comprendido esta Política de Privacidad y consiente al procesamiento de su información personal según se describe aquí."""

async def update_legal_documents():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 70)
    print("ACTUALIZANDO DOCUMENTOS LEGALES")
    print("=" * 70)
    
    # Update Terms and Conditions
    print("\n📄 Actualizando Términos y Condiciones...")
    terms_result = await db.legal_documents.update_one(
        {"type": "terms"},
        {
            "$set": {
                "content": COMPREHENSIVE_TERMS,
                "version": "2.0",
                "effective_date": datetime(2025, 1, 1),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    if terms_result.upserted_id:
        print("   ✅ Términos creados exitosamente")
    else:
        print("   ✅ Términos actualizados exitosamente")
    
    # Update Privacy Policy
    print("\n🔒 Actualizando Política de Privacidad...")
    privacy_result = await db.legal_documents.update_one(
        {"type": "privacy"},
        {
            "$set": {
                "content": COMPREHENSIVE_PRIVACY,
                "version": "2.0",
                "effective_date": datetime(2025, 1, 1),
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    if privacy_result.upserted_id:
        print("   ✅ Política de Privacidad creada exitosamente")
    else:
        print("   ✅ Política de Privacidad actualizada exitosamente")
    
    print("\n" + "=" * 70)
    print("✅ DOCUMENTOS LEGALES ACTUALIZADOS CORRECTAMENTE")
    print("=" * 70)
    print("\n📋 Resumen:")
    print("   - Términos y Condiciones: Versión 2.0")
    print("   - Política de Privacidad: Versión 2.0")
    print("   - Fecha efectiva: 1 de enero de 2025")
    print("\n✨ Características cubiertas:")
    print("   ✓ Preparación de impuestos")
    print("   ✓ AI Brain (Gemini 2.5 Pro)")
    print("   ✓ Sistema de Créditos Ross Tax")
    print("   ✓ Pagos (Stripe, ACH, tarjetas)")
    print("   ✓ Gestión de documentos")
    print("   ✓ Sistema de citas")
    print("   ✓ Contenido educativo y noticias")
    print("   ✓ Programa de referencias")
    print("   ✓ Geolocalización")
    print("   ✓ Notificaciones push")
    print("   ✓ Verificación KYC")
    print("   ✓ WhatsApp integration")
    print("   ✓ Rise CRM integration")
    print("   ✓ Cumplimiento CCPA, GLBA, IRS Circular 230")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_legal_documents())
