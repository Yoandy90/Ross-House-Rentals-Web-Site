import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'taxportal')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# FAQs data
faqs_data = [
    {
        'question': '¿Cuándo es la fecha límite para presentar impuestos?',
        'answer': 'La fecha límite federal para presentar impuestos en Estados Unidos es generalmente el 15 de abril de cada año. Si cae en fin de semana o día festivo, se extiende al siguiente día hábil. Para impuestos estatales, las fechas pueden variar según el estado.',
        'icon': 'calendar-outline',
        'order': 1,
    },
    {
        'question': '¿Qué documentos necesito para preparar mis impuestos?',
        'answer': 'Necesitarás: W-2 de tu empleador, 1099 si eres independiente, recibos de deducciones (gastos médicos, donaciones, intereses hipotecarios), información bancaria, SSN o ITIN, y declaraciones del año anterior. También cualquier documento relacionado con ingresos adicionales o inversiones.',
        'icon': 'document-text-outline',
        'order': 2,
    },
    {
        'question': '¿Puedo deducir gastos de mi negocio?',
        'answer': 'Sí, si eres autónomo o tienes un negocio, puedes deducir gastos ordinarios y necesarios como suministros de oficina, viajes de negocios, publicidad, seguro, equipos, y una porción de tu vivienda si trabajas desde casa. Mantén buenos registros y recibos.',
        'icon': 'briefcase-outline',
        'order': 3,
    },
    {
        'question': '¿Qué es el Crédito Tributario por Ingreso del Trabajo (EITC)?',
        'answer': 'El EITC es un crédito tributario reembolsable para trabajadores de ingresos bajos a moderados. El monto varía según ingresos, estado civil y número de hijos. Puede resultar en un reembolso incluso si no debes impuestos.',
        'icon': 'cash-outline',
        'order': 4,
    },
    {
        'question': '¿Qué hago si no puedo pagar mis impuestos?',
        'answer': 'Si no puedes pagar, presenta tu declaración de todos modos para evitar multas por presentación tardía. El IRS ofrece planes de pago, puedes solicitar una extensión de pago, o en casos extremos, un acuerdo de oferta de compromiso. Contacta al IRS o a un profesional tributario.',
        'icon': 'help-circle-outline',
        'order': 5,
    },
    {
        'question': '¿Necesito declarar ingresos de trabajos ocasionales (gig economy)?',
        'answer': 'Sí, todos los ingresos deben declararse, incluyendo trabajos de Uber, DoorDash, freelancing, etc. Recibirás un 1099 si ganaste más de $600 con una empresa. Incluso sin 1099, debes reportar tus ingresos.',
        'icon': 'card-outline',
        'order': 6,
    },
    {
        'question': '¿Qué es una auditoría del IRS y cómo evitarla?',
        'answer': 'Una auditoría es una revisión de tus declaraciones de impuestos. Para evitarla: reporta todos tus ingresos, no exageres deducciones, mantén registros precisos, y presenta a tiempo. Las auditorías son aleatorias, pero ciertos factores aumentan el riesgo.',
        'icon': 'search-outline',
        'order': 7,
    },
    {
        'question': '¿Puedo modificar una declaración ya presentada?',
        'answer': 'Sí, puedes presentar una declaración enmendada usando el Formulario 1040-X hasta 3 años después de la fecha de presentación original. Es común enmendar si olvidaste ingresos, deducciones, o cometiste errores.',
        'icon': 'create-outline',
        'order': 8,
    },
]

# Articles data
articles_data = [
    {
        'title': 'Guía Completa de Deducciones Fiscales 2024',
        'description': 'Todo lo que necesitas saber sobre deducciones estándar e itemizadas',
        'read_time': '15 min',
        'category': 'Deducciones',
        'content': '''Las deducciones fiscales son uno de los aspectos más importantes de la planificación tributaria, ya que reducen directamente tu ingreso imponible y, por lo tanto, la cantidad de impuestos que debes pagar.

¿QUÉ SON LAS DEDUCCIONES FISCALES?

Una deducción fiscal es un gasto permitido por el IRS que puedes restar de tu ingreso bruto ajustado (AGI) para reducir tu ingreso imponible. Existen dos tipos principales de deducciones:

1. DEDUCCIÓN ESTÁNDAR
La deducción estándar es una cantidad fija que puedes deducir sin necesidad de documentar gastos específicos. Para 2024, las cantidades son:
- Soltero o Casado presentando por separado: $14,600
- Jefe de familia: $21,900
- Casado presentando en conjunto: $29,200
- Personas mayores de 65 años o ciegas: deducción adicional de $1,550-$1,950

La mayoría de los contribuyentes optan por la deducción estándar porque es más simple y, en muchos casos, más beneficiosa.

2. DEDUCCIONES ITEMIZADAS
Las deducciones itemizadas requieren que documentes cada gasto deducible. Solo debes itemizar si el total de tus deducciones supera la deducción estándar. Las deducciones itemizadas principales incluyen:

GASTOS MÉDICOS Y DENTALES
Puedes deducir gastos médicos y dentales que excedan el 7.5% de tu AGI. Esto incluye:
- Primas de seguro médico
- Visitas al médico, dentista, especialistas
- Medicamentos recetados
- Equipos médicos (anteojos, audífonos)
- Transporte a citas médicas
- Cirugías y hospitalizaciones
- Tratamientos de salud mental

IMPUESTOS ESTATALES Y LOCALES (SALT)
Puedes deducir hasta $10,000 ($5,000 si casado presentando por separado) en:
- Impuestos sobre la renta estatales y locales
- Impuestos sobre ventas (en lugar de impuestos sobre la renta)
- Impuestos sobre la propiedad

INTERESES HIPOTECARIOS
Puedes deducir intereses pagados en:
- Hipoteca principal (hasta $750,000 de deuda)
- Segunda vivienda
- Refinanciamiento
- Líneas de crédito sobre el valor de la vivienda (si se usaron para mejorar la propiedad)

DONACIONES CARITATIVAS
Las donaciones a organizaciones calificadas son deducibles:
- Efectivo o cheque: deducible hasta el 60% de tu AGI
- Propiedad: deducible al valor justo de mercado
- Millas conducidas para caridad: $0.14 por milla
- Asegúrate de obtener recibos para donaciones superiores a $250

PÉRDIDAS POR ROBO O DESASTRE
Puedes deducir pérdidas no reembolsadas por:
- Desastres declarados federalmente
- Robo documentado
- Sujeto a limitaciones y umbrales específicos

GASTOS DE NEGOCIO NO REEMBOLSADOS
Si eres empleado y tienes gastos de trabajo no reembolsados, algunas categorías pueden ser deducibles:
- Educación requerida por el empleador
- Uso del automóvil para trabajo (no viaje al trabajo)
- Materiales y suministros de trabajo
- Espacio de oficina en casa (bajo condiciones estrictas)

CONSEJOS PARA MAXIMIZAR TUS DEDUCCIONES

1. Mantén registros detallados
   - Guarda todos los recibos y documentos
   - Usa aplicaciones de seguimiento de gastos
   - Organiza por categoría

2. Planifica estratégicamente
   - Agrupa gastos médicos en un año si es posible
   - Programa donaciones caritativas de manera estratégica
   - Considera el timing de pagos de impuestos

3. No te olvides de deducciones comunes
   - Intereses de préstamos estudiantiles (hasta $2,500)
   - Contribuciones a HSA o FSA
   - Contribuciones a cuentas de retiro (IRA tradicional)
   - Gastos de educación (créditos y deducciones)

4. Consulta con un profesional
   - Un preparador de impuestos puede identificar deducciones que podrías pasar por alto
   - Las leyes cambian frecuentemente
   - Situaciones complejas requieren experiencia

DEDUCCIONES ESPECIALES PARA TRABAJADORES AUTÓNOMOS

Si eres trabajador independiente o tienes un negocio, tienes acceso a deducciones adicionales:
- Oficina en casa (basada en metraje cuadrado)
- Seguro de salud para autónomos
- Contribuciones a planes de retiro SEP o Solo 401(k)
- Mitad del impuesto de trabajo por cuenta propia
- Gastos de vehículo comercial
- Equipos y suministros de negocio
- Marketing y publicidad
- Viajes de negocios
- Educación relacionada con el negocio

ERRORES COMUNES A EVITAR

1. No guardar documentación adecuada
2. Exagerar deducciones
3. Olvidar deducciones legítimas
4. No considerar si itemizar sería mejor que la deducción estándar
5. Mezclar gastos personales y comerciales

CAMBIOS RECIENTES Y TENDENCIAS

El panorama de las deducciones fiscales cambia regularmente. Mantente informado sobre:
- Nuevas leyes tributarias
- Cambios en límites de deducción
- Deducciones temporales o créditos especiales
- Requisitos de documentación actualizados

CONCLUSIÓN

Las deducciones fiscales son herramientas poderosas para reducir tu obligación tributaria. Ya sea que elijas la deducción estándar o itemices, entender tus opciones te ayuda a tomar decisiones informadas. Mantén buenos registros durante todo el año y considera trabajar con un profesional de impuestos para asegurarte de aprovechar todas las deducciones disponibles.

Recuerda: el objetivo no es solo pagar menos impuestos este año, sino desarrollar una estrategia fiscal a largo plazo que funcione para tu situación financiera única.''',
        'order': 1,
    },
    {
        'title': 'Cómo Prepararse para la Temporada de Impuestos',
        'description': 'Checklist esencial para organizar tus documentos tributarios',
        'read_time': '10 min',
        'category': 'Preparación',
        'content': '''La preparación adecuada es la clave para una temporada de impuestos sin estrés y para maximizar tu reembolso. Esta guía te ayudará a organizarte eficientemente.

CALENDARIO DE LA TEMPORADA DE IMPUESTOS

ENERO
- El IRS comienza a aceptar declaraciones (generalmente a finales de enero)
- Los empleadores deben enviar formularios W-2 antes del 31 de enero
- Las instituciones financieras comienzan a enviar formularios 1099

FEBRERO-MARZO
- Período pico de presentación
- Mejor momento para presentar si esperas un reembolso
- Menos demora en el procesamiento del IRS

ABRIL
- Fecha límite de presentación: 15 de abril (o siguiente día hábil)
- Último día para contribuir a IRA para el año fiscal anterior
- Puedes solicitar extensión automática de 6 meses (no extiende el pago)

OCTUBRE
- Fecha límite si solicitaste extensión: 15 de octubre

DOCUMENTOS QUE NECESITARÁS

INFORMACIÓN PERSONAL BÁSICA
□ Número de Seguro Social (SSN) o ITIN tuyo y de dependientes
□ Fecha de nacimiento de todos los miembros del hogar
□ Números de cuenta bancaria para depósito directo
□ Declaración de impuestos del año anterior
□ PIN del IRS (si tienes uno)

DOCUMENTOS DE INGRESOS
□ W-2: Salarios y compensación de empleadores
□ 1099-NEC: Ingresos de trabajo independiente
□ 1099-MISC: Ingresos diversos
□ 1099-INT: Intereses ganados
□ 1099-DIV: Dividendos e distribuciones de capital
□ 1099-B: Ganancias/pérdidas de inversiones
□ 1099-R: Distribuciones de pensiones y retiro
□ 1099-G: Reembolso de impuestos estatales
□ 1099-K: Pagos de tarjetas de crédito y terceros
□ SSA-1099: Beneficios del Seguro Social
□ Registros de ingresos de alquiler
□ Ingresos de negocios o actividades secundarias

DOCUMENTOS DE DEDUCCIONES
□ Recibos de gastos médicos y dentales
□ Formulario 1098: Intereses hipotecarios pagados
□ Recibos de impuestos sobre la propiedad
□ Comprobantes de donaciones caritativas
□ Recibos de cuidado infantil o de dependientes
□ Formulario 1098-E: Intereses de préstamos estudiantiles
□ Formulario 1098-T: Matrícula universitaria
□ Comprobantes de contribuciones IRA
□ Gastos de oficina en casa
□ Registros de millaje comercial

DOCUMENTOS DE SEGURO DE SALUD
□ Formulario 1095-A (si compraste seguro a través del Marketplace)
□ Formulario 1095-B o 1095-C (cobertura de empleador)
□ Registros de contribuciones HSA

SISTEMA DE ORGANIZACIÓN EN 5 PASOS

PASO 1: CREAR UN CENTRO DE DOCUMENTOS FISCALES
- Designa una carpeta física o digital
- Organiza por categorías
- Guarda todo en un solo lugar
- Usa subcarpetas para ingresos, deducciones, créditos

PASO 2: DIGITALIZAR DOCUMENTOS
- Escanea o fotografía todos los recibos
- Usa aplicaciones de gestión de documentos
- Almacena copias en la nube
- Mantén copias de respaldo

PASO 3: VERIFICAR INFORMACIÓN
- Revisa que todos los W-2 y 1099 sean correctos
- Compara con tus registros personales
- Contacta al emisor si encuentras errores
- No presentes con información incorrecta

PASO 4: CALCULAR ESTIMACIONES
- Usa calculadoras en línea del IRS
- Estima si deberás pagar o recibirás reembolso
- Prepara fondos si debes pagar
- Decide qué hacer con el reembolso

PASO 5: ELEGIR MÉTODO DE PRESENTACIÓN
- Software de impuestos (TurboTax, H&R Block)
- Preparador profesional
- CPA o Agente Registrado
- Free File del IRS (si calificas por ingresos)

ESTRATEGIAS PARA AHORRAR TIEMPO

1. Mantén un archivo fiscal todo el año
   - No esperes hasta marzo
   - Guarda documentos a medida que llegan
   - Actualiza información trimestralmente

2. Usa tecnología
   - Apps de seguimiento de gastos
   - Software de contabilidad
   - Escaneo automático de recibos
   - Recordatorios en calendario

3. Automatiza cuando sea posible
   - Configurar recordatorios de fechas límite
   - Alertas cuando lleguen formularios fiscales
   - Auto-categorización de gastos

4. Crea un checklist personalizado
   - Basado en tu situación específica
   - Actualiza cada año
   - Marca ítems conforme completas

SITUACIONES ESPECIALES QUE REQUIEREN DOCUMENTACIÓN EXTRA

SI TE CASASTE O DIVORCIASTE
- Certificado de matrimonio o decreto de divorcio
- Acuerdos de custodia de hijos
- Documentos de pensión alimenticia

SI COMPRASTE O VENDISTE CASA
- Declaración de cierre (HUD-1 o formulario de liquidación)
- Formulario 1098 de intereses hipotecarios
- Recibos de mejoras al hogar
- Documentos de refinanciamiento

SI TUVISTE UN BEBÉ O ADOPTASTE
- Certificado de nacimiento
- Número de Seguro Social del bebé
- Gastos de adopción
- Gastos de cuidado infantil

SI EMPEZASTE UN NEGOCIO
- Número de Identificación del Empleador (EIN)
- Registros de ingresos y gastos
- Recibos de compras de activos
- Registros de millaje

ERRORES COMUNES EN LA PREPARACIÓN

1. No verificar que toda la información esté completa
2. Mezclar gastos personales y comerciales
3. No guardar copias de la declaración presentada
4. Olvidar firmar la declaración
5. Errores en números de cuenta bancaria
6. No reportar todos los ingresos

CONSEJOS DE ÚLTIMO MINUTO

□ Revisa dos veces todos los números
□ Verifica nombres y números de Seguro Social
□ Confirma el estado civil correcto
□ Asegúrate de reclamar todos los dependientes
□ No olvides firmar y fechar
□ Guarda copias de todo
□ Usa depósito directo para reembolsos más rápidos

DESPUÉS DE PRESENTAR

- Guarda copias de tu declaración por al menos 7 años
- Mantén documentación de respaldo
- Revisa el estado de tu reembolso en IRS.gov
- Planifica para el próximo año
- Ajusta retenciones si es necesario

HERRAMIENTAS ÚTILES

□ IRS2Go App: Seguimiento de reembolsos
□ IRS Free File: Si ganas menos de $73,000
□ Calculadoras del IRS: Estimación de impuestos
□ E-file: Presentación electrónica rápida
□ Direct Deposit: Reembolsos en 21 días o menos

CONCLUSIÓN

La preparación adecuada transforma la temporada de impuestos de una carga estresante a un proceso manejable. Comienza temprano, mantente organizado durante todo el año, y no dudes en buscar ayuda profesional cuando la necesites. 

Una buena preparación no solo hace el proceso más fácil, sino que también te ayuda a identificar todas las deducciones y créditos disponibles, potencialmente ahorrándote cientos o miles de dólares.

¡Empieza hoy mismo y haz de esta tu temporada de impuestos más organizada hasta ahora!''',
        'order': 2,
    },
    {
        'title': 'Impuestos para Trabajadores Independientes',
        'description': 'Obligaciones fiscales especiales para freelancers y contratistas',
        'read_time': '12 min',
        'category': 'Autónomos',
        'content': '''Ser trabajador independiente ofrece libertad y flexibilidad, pero también conlleva responsabilidades fiscales únicas. Esta guía te ayudará a navegar el complejo mundo de los impuestos para autónomos.

¿QUIÉN ES CONSIDERADO TRABAJADOR INDEPENDIENTE?

Eres trabajador independiente si:
- Operas un negocio como propietario único
- Eres contratista independiente
- Trabajas como freelancer
- Eres socio de una sociedad
- Tienes un negocio a tiempo parcial
- Eres conductor de Uber, DoorDash, etc.
- Vendes productos en línea (Etsy, Amazon, etc.)

La regla general: si recibes un 1099-NEC en lugar de un W-2, probablemente eres trabajador independiente.

IMPUESTO DE TRABAJO POR CUENTA PROPIA (SELF-EMPLOYMENT TAX)

Esta es la diferencia más importante entre empleados y trabajadores independientes.

¿QUÉ ES?
El impuesto de trabajo por cuenta propia cubre tu Seguro Social y Medicare. Como empleado, tu empleador paga la mitad (7.65%) y tú pagas la otra mitad. Como trabajador independiente, pagas ambas partes (15.3%).

CÓMO SE CALCULA
- 12.4% para Seguro Social (sobre los primeros $160,200 de ingresos netos)
- 2.9% para Medicare (sin límite)
- 0.9% adicional de Medicare si ganas más de $200,000 (soltero) o $250,000 (casado)

BUENAS NOTICIAS
Puedes deducir la mitad del impuesto de trabajo por cuenta propia de tu ingreso imponible.

FORMULARIOS QUE NECESITARÁS

SCHEDULE C (FORMULARIO 1040)
- Reporta ingresos y gastos de negocio
- Calcula tu ganancia o pérdida neta
- Adjunto a tu declaración personal

SCHEDULE SE (FORMULARIO 1040)
- Calcula el impuesto de trabajo por cuenta propia
- Determina cuánto debes en Seguro Social y Medicare

FORMULARIO 1040-ES
- Para pagos de impuestos estimados trimestrales
- Incluye hojas de trabajo para calcular pagos

FORMULARIO 1099-NEC
- Recibirás uno de cada cliente que te pagó $600 o más
- Reporta tus ingresos de no-empleado

DEDUCCIONES ESENCIALES PARA TRABAJADORES INDEPENDIENTES

1. OFICINA EN CASA
Dos métodos para calcular:

MÉTODO SIMPLIFICADO
- $5 por pie cuadrado
- Máximo 300 pies cuadrados ($1,500)
- Fácil de calcular

MÉTODO REGULAR
- Porcentaje de tu casa usado exclusivamente para negocio
- Deduce renta/hipoteca, servicios, seguro, reparaciones
- Requiere más documentación pero puede ser más beneficioso

Requisitos:
- Uso regular y exclusivo
- Principal lugar de negocio
- Espacio definido

2. VEHÍCULO Y TRANSPORTE

MÉTODO DE MILLAJE ESTÁNDAR
- $0.67 por milla (2024)
- Mantén registro detallado de:
  * Fecha
  * Millas recorridas
  * Propósito del viaje
  * Destino

MÉTODO DE GASTOS REALES
- Gasolina, aceite, reparaciones
- Seguro de auto
- Registro y licencias
- Depreciación
- Proporción basada en uso comercial

3. EQUIPO Y SUMINISTROS
- Computadoras y software
- Teléfono y servicio de internet
- Muebles de oficina
- Herramientas y equipos
- Suministros de oficina

SECCIÓN 179
- Deduce el costo completo de equipos en el año de compra
- Hasta $1,160,000 en 2024
- Alternativa a depreciar durante varios años

4. SEGURO DE SALUD
- Deducción "above-the-line"
- 100% de las primas pagadas
- Para ti, tu cónyuge y dependientes
- No puedes tomar si eres elegible para un plan del empleador de tu cónyuge

5. CONTRIBUCIONES A PLAN DE RETIRO
- SEP IRA: hasta 25% de ingresos netos o $66,000
- Solo 401(k): hasta $66,000 total ($69,000 si eres mayor de 50)
- IRA tradicional: $7,000 ($8,000 si eres mayor de 50)

6. GASTOS DE VIAJE DE NEGOCIOS
- Boletos de avión
- Hotel
- 50% de comidas de negocio
- Transporte local
- Lavandería durante viaje

7. EDUCACIÓN Y DESARROLLO PROFESIONAL
- Cursos y talleres
- Conferencias de la industria
- Certificaciones profesionales
- Libros y publicaciones
- Membresías profesionales

8. MARKETING Y PUBLICIDAD
- Diseño de sitio web
- Hosting y dominio
- Publicidad en redes sociales
- Tarjetas de presentación
- Materiales promocionales

9. SERVICIOS PROFESIONALES
- Contador o preparador de impuestos
- Abogado
- Consultor de negocios
- Diseñador gráfico
- Asistente virtual

10. TELÉFONO E INTERNET
- Proporción de uso comercial
- Segunda línea dedicada es 100% deducible
- Servicio de internet si trabajas desde casa

IMPUESTOS ESTIMADOS TRIMESTRALES

Si esperas deber $1,000 o más en impuestos, debes hacer pagos trimestrales.

FECHAS LÍMITE 2024
- Q1 (enero-marzo): 15 de abril
- Q2 (abril-mayo): 17 de junio
- Q3 (junio-agosto): 16 de septiembre
- Q4 (septiembre-diciembre): 15 de enero 2025

CÓMO CALCULAR
1. Estima tus ingresos anuales
2. Resta deducciones comerciales
3. Calcula impuesto sobre la renta
4. Añade impuesto de trabajo por cuenta propia
5. Divide entre 4 para pagos trimestrales

SAFE HARBOR
Paga al menos:
- 90% del impuesto del año actual, O
- 100% del impuesto del año anterior (110% si AGI > $150,000)

MÉTODOS DE PAGO
- IRS Direct Pay (gratis)
- EFTPS (Electronic Federal Tax Payment System)
- Tarjeta de crédito/débito (con cargo)
- Cheque con voucher 1040-ES

LLEVAR REGISTROS EFECTIVOS

SISTEMAS DE CONTABILIDAD
- Software: QuickBooks, FreshBooks, Wave
- Hojas de cálculo: para negocios simples
- Apps móviles: para seguimiento en tiempo real

QUÉ REGISTRAR
□ Todos los ingresos (incluso si no recibes 1099)
□ Todos los gastos con recibos
□ Millaje de vehículo
□ Reuniones de negocio
□ Horas trabajadas en proyectos
□ Facturas enviadas y pagadas

MANTENER POR 7 AÑOS
- Declaraciones de impuestos
- Recibos y facturas
- Estados bancarios
- Registros de millaje
- Contratos y acuerdos

ERRORES COMUNES A EVITAR

1. NO SEPARAR FINANZAS PERSONALES Y COMERCIALES
   Solución: Abre cuenta bancaria y tarjeta de crédito separadas para el negocio

2. NO HACER PAGOS ESTIMADOS
   Resultado: Multas e intereses del IRS
   Solución: Configura pagos automáticos trimestrales

3. EXAGERAR DEDUCCIONES
   Resultado: Auditoría del IRS
   Solución: Deduce solo gastos legítimos con documentación

4. NO GUARDAR RECIBOS
   Resultado: Deducciones perdidas
   Solución: Escanea recibos inmediatamente con app

5. MEZCLAR USO PERSONAL Y COMERCIAL
   Resultado: Deducciones incorrectas
   Solución: Calcula proporciones precisas

6. NO REPORTAR TODOS LOS INGRESOS
   Resultado: Problemas graves con el IRS
   Solución: Reporta todo, incluso efectivo y PayPal

ESTRUCTURA DE NEGOCIO: ¿CUÁL ES MEJOR?

PROPIETARIO ÚNICO (SOLE PROPRIETORSHIP)
Pros: Simple, sin papeleo especial
Contras: Responsabilidad personal ilimitada

LLC (LIMITED LIABILITY COMPANY)
Pros: Protección de responsabilidad, flexibilidad fiscal
Contras: Costos de formación y mantenimiento

S-CORPORATION
Pros: Ahorro en impuestos de trabajo por cuenta propia
Contras: Más complejo, requiere nómina

CONSULTA CON UN CONTADOR
La estructura correcta depende de:
- Nivel de ingresos
- Tolerancia al riesgo
- Planes de crecimiento
- Complejidad deseada

RECURSOS ÚTILES

IRS.GOV/SELF-EMPLOYED
- Guías y publicaciones
- Calculadoras
- Formularios descargables

SCORE.ORG
- Mentoría gratuita de negocios
- Talleres y recursos

SMALL BUSINESS ADMINISTRATION (SBA)
- Recursos de inicio
- Información de financiamiento
- Ayuda con planes de negocio

CONCLUSIÓN

Ser trabajador independiente requiere disciplina fiscal, pero con el conocimiento y las herramientas correctas, puedes manejar tus obligaciones tributarias con confianza. 

Puntos clave para recordar:
✓ Separa finanzas personales y comerciales
✓ Haz pagos estimados trimestrales
✓ Mantén registros meticulosos
✓ Aprovecha todas las deducciones legítimas
✓ Considera trabajar con un profesional de impuestos

Tu libertad como trabajador independiente vale la organización extra que requieren los impuestos. ¡Toma control de tus obligaciones fiscales hoy!''',
        'order': 3,
    },
    {
        'title': 'Entendiendo los Créditos Tributarios',
        'description': 'Diferencias entre créditos y deducciones, y cuáles puedes reclamar',
        'read_time': '8 min',
        'category': 'Créditos',
        'content': '''Los créditos tributarios son herramientas poderosas que pueden reducir significativamente tu obligación fiscal. A diferencia de las deducciones, los créditos reducen directamente el monto de impuestos que debes, dólar por dólar.

CRÉDITOS VS DEDUCCIONES: LA DIFERENCIA CRUCIAL

DEDUCCIONES
- Reducen tu ingreso imponible
- El beneficio depende de tu tasa impositiva
- Ejemplo: Deducción de $1,000 en el tramo del 22% = ahorro de $220

CRÉDITOS
- Reducen directamente los impuestos adeudados
- Beneficio completo independientemente de tu tasa
- Ejemplo: Crédito de $1,000 = ahorro de $1,000

Los créditos son generalmente más valiosos que las deducciones del mismo monto.

TIPOS DE CRÉDITOS TRIBUTARIOS

1. CRÉDITOS REEMBOLSABLES
Si el crédito excede tus impuestos adeudados, recibes la diferencia como reembolso.

2. CRÉDITOS NO REEMBOLSABLES
Solo pueden reducir tu obligación fiscal a cero. No recibes reembolso del excedente.

3. CRÉDITOS PARCIALMENTE REEMBOLSABLES
Combinan características de ambos tipos.

PRINCIPALES CRÉDITOS TRIBUTARIOS

1. EARNED INCOME TAX CREDIT (EITC)
El crédito reembolsable más importante para trabajadores de ingresos bajos a moderados.

REQUISITOS
- Debes tener ingresos del trabajo
- Cumplir límites de ingresos
- Tener número de Seguro Social válido
- Ser ciudadano o residente de EE.UU.

MONTOS MÁXIMOS 2024
- Sin hijos: $600
- 1 hijo: $3,995
- 2 hijos: $6,604
- 3+ hijos: $7,430

LÍMITES DE INGRESOS
Varían según estado civil y número de hijos:
- Soltero sin hijos: $17,640
- Casado con 3+ hijos: $63,398

BENEFICIOS
- Completamente reembolsable
- Puede resultar en reembolso grande
- Ayuda a familias trabajadoras

2. CHILD TAX CREDIT (CTC)
Crédito para cada hijo calificado menor de 17 años.

MONTO
- $2,000 por hijo calificado
- Hasta $1,700 es reembolsable (Additional Child Tax Credit)

REQUISITOS DEL HIJO
- Menor de 17 años al final del año
- Relación de parentesco
- Vivió contigo más de 6 meses
- No proveyó más de la mitad de su propio sustento
- Ciudadano, nacional o residente de EE.UU.

LÍMITES DE INGRESOS
El crédito comienza a reducirse cuando el AGI modificado excede:
- $200,000 (soltero)
- $400,000 (casados presentando en conjunto)

3. CHILD AND DEPENDENT CARE CREDIT
Para gastos de cuidado de niños o dependientes mientras trabajas.

GASTOS ELEGIBLES
- Guardería o preescolar
- Niñera o nanny
- Campamentos de día
- Cuidado después de la escuela

MONTO DEL CRÉDITO
- 20-35% de hasta $3,000 de gastos (un dependiente)
- 20-35% de hasta $6,000 de gastos (dos o más dependientes)
- El porcentaje depende de tu ingreso

REQUISITOS
- Cuidado debe ser para trabajar o buscar trabajo
- Proveedor debe reportar información fiscal
- Hijo debe ser menor de 13 años

4. AMERICAN OPPORTUNITY TAX CREDIT (AOTC)
Para gastos de educación superior en los primeros 4 años.

MONTO
- Hasta $2,500 por estudiante
- 100% de primeros $2,000 de gastos
- 25% de siguientes $2,000
- 40% es reembolsable (hasta $1,000)

GASTOS ELEGIBLES
- Matrícula y cuotas
- Libros de texto requeridos
- Materiales del curso
- Equipos necesarios

REQUISITOS
- Estudiante debe estar al menos medio tiempo
- Primeros 4 años de educación superior
- No haber completado 4 años antes del año fiscal
- Sin condenas por drogas

LÍMITES
El crédito se reduce si el AGI modificado excede:
- $80,000-$90,000 (soltero)
- $160,000-$180,000 (casado conjunto)

5. LIFETIME LEARNING CREDIT (LLC)
Para cualquier nivel de educación post-secundaria.

MONTO
- 20% de hasta $10,000 de gastos
- Máximo $2,000 por declaración (no por estudiante)
- No reembolsable

VENTAJAS SOBRE AOTC
- Sin límite de años
- Estudiantes de medio tiempo o tiempo completo
- Cursos para mejorar habilidades laborales
- Educación de posgrado

LÍMITES
Se reduce cuando AGI modificado excede:
- $80,000-$90,000 (soltero)
- $160,000-$180,000 (casado conjunto)

6. RETIREMENT SAVINGS CONTRIBUTIONS CREDIT (SAVER'S CREDIT)
Incentivo para ahorrar para el retiro.

MONTO
- 10%, 20% o 50% de contribuciones
- Hasta $2,000 de contribuciones ($4,000 si casado)
- Máximo $1,000 ($2,000 si casado)

CONTRIBUCIONES ELEGIBLES
- IRA tradicional o Roth
- 401(k), 403(b), 457
- SIMPLE IRA
- SEP IRA

LÍMITES DE INGRESOS 2024
El porcentaje del crédito depende de tu AGI:
- 50%: hasta $23,000 (soltero)
- 20%: $23,001-$25,000
- 10%: $25,001-$38,000

7. RESIDENTIAL ENERGY CREDITS
Para mejoras de eficiencia energética en tu hogar.

CRÉDITO PARA PROPIEDAD DE ENERGÍA (ENERGY EFFICIENT HOME IMPROVEMENT CREDIT)
- 30% del costo
- Hasta $1,200 anual para calefacción, enfriamiento, agua caliente
- Hasta $2,000 para bomba de calor
- Puertas exteriores, ventanas, aislamiento

CRÉDITO SOLAR RESIDENCIAL
- 30% del costo (2024)
- Paneles solares
- Calentadores de agua solares
- Sin límite en el crédito

8. PREMIUM TAX CREDIT (PTC)
Para seguro de salud comprado a través del Marketplace.

QUÉ CUBRE
- Reduce el costo de primas mensuales
- Basado en ingreso estimado
- Puede tomarse por adelantado o al presentar impuestos

RECONCILIACIÓN
Debes reconciliar el crédito adelantado con tu ingreso real:
- Si ganaste menos: podrías recibir crédito adicional
- Si ganaste más: podrías deber reembolso

LÍMITES
Generalmente disponible si tu ingreso está entre 100-400% del nivel federal de pobreza.

9. ELECTRIC VEHICLE CREDIT
Para vehículos eléctricos nuevos y usados.

VEHÍCULOS NUEVOS
- Hasta $7,500
- Vehículo debe cumplir requisitos de ensamblaje
- Restricciones de precio del vehículo
- Límites de ingresos del comprador

VEHÍCULOS USADOS
- Hasta $4,000
- Vehículo debe tener al menos 2 años
- Precio de venta no puede exceder $25,000
- Límites de ingresos más bajos

CÓMO MAXIMIZAR TUS CRÉDITOS

1. CONOCE TUS OPCIONES
   - Investiga todos los créditos disponibles
   - Algunos son pasados por alto comúnmente
   - Usa el Asistente Interactivo de Impuestos del IRS

2. MANTÉN DOCUMENTACIÓN
   - Recibos de gastos elegibles
   - Formularios de proveedores de cuidado
   - Constancias de matrícula (1098-T)
   - Certificaciones de eficiencia energética

3. PLANIFICA ESTRATÉGICAMENTE
   - Timing de gastos de educación
   - Contribuciones a retiro antes del 15 de abril
   - Compras de eficiencia energética

4. VERIFICA ELEGIBILIDAD
   - Revisa límites de ingresos
   - Confirma que cumples todos los requisitos
   - Algunos créditos no se pueden combinar

5. NO DEJES DINERO SOBRE LA MESA
   - Reclama todos los créditos que califiques
   - Incluso créditos pequeños suman
   - Algunos son reembolsables

ERRORES COMUNES

1. NO RECLAMAR EITC
   Millones de trabajadores elegibles no lo reclaman.

2. ELEGIR DEDUCCIÓN SOBRE CRÉDITO
   Ejemplo: Deducción de matrícula vs AOTC
   Generalmente el crédito es mejor.

3. NO ACTUALIZAR INFORMACIÓN DEL MARKETPLACE
   Resulta en sorpresas al presentar impuestos.

4. OLVIDAR CRÉDITOS ESTATALES
   Muchos estados ofrecen créditos adicionales.

5. NO GUARDAR DOCUMENTACIÓN
   Sin recibos, podrías perder el crédito en auditoría.

RECURSOS ÚTILES

IRS.GOV/CREDITS-DEDUCTIONS
- Lista completa de créditos
- Calculadoras de elegibilidad
- Formularios e instrucciones

PUBLICACIÓN 17 DEL IRS
- Guía comprensiva de impuestos individuales
- Capítulos sobre cada crédito
- Ejemplos y hojas de trabajo

TAX PROFESSIONALS
- Pueden identificar créditos que podrías pasar por alto
- Especialmente útil para situaciones complejas
- Vale la inversión para maximizar reembolso

CONCLUSIÓN

Los créditos tributarios son herramientas poderosas que pueden ahorrar significativamente en impuestos. A diferencia de las deducciones que solo reducen tu ingreso imponible, los créditos reducen directamente tus impuestos adeudados.

PUNTOS CLAVE PARA RECORDAR:
✓ Los créditos son más valiosos que las deducciones
✓ Algunos créditos son reembolsables
✓ Hay créditos para educación, familia, retiro, energía y más
✓ Los límites de ingresos aplican a muchos créditos
✓ La documentación apropiada es esencial

Tómate el tiempo para entender qué créditos están disponibles para ti. El dinero que ahorres vale el esfuerzo de investigación. Y recuerda, trabajar con un profesional de impuestos puede ayudarte a asegurar que no dejes ningún crédito sin reclamar.

¡Tu obligación fiscal podría ser significativamente menor de lo que piensas cuando aprovechas todos los créditos disponibles!''',
        'order': 4,
    },
]

# Videos data
videos_data = [
    {
        'title': 'Introducción a los Impuestos en EE.UU.',
        'description': 'Conceptos básicos del sistema tributario estadounidense',
        'duration': '8:45',
        'url': 'https://www.youtube.com/watch?v=example1',
        'thumbnail': 'https://img.youtube.com/vi/example1/hqdefault.jpg',
        'order': 1,
    },
    {
        'title': 'Cómo Llenar el Formulario W-4',
        'description': 'Paso a paso para completar tu formulario de retención',
        'duration': '12:30',
        'url': 'https://www.youtube.com/watch?v=example2',
        'thumbnail': 'https://img.youtube.com/vi/example2/hqdefault.jpg',
        'order': 2,
    },
    {
        'title': 'Maximiza tu Reembolso Tributario',
        'description': 'Estrategias legales para aumentar tu reembolso',
        'duration': '15:20',
        'url': 'https://www.youtube.com/watch?v=example3',
        'thumbnail': 'https://img.youtube.com/vi/example3/hqdefault.jpg',
        'order': 3,
    },
]

async def populate_education_resources():
    """Populate education resources in MongoDB"""
    
    print("🚀 Starting education resources population...")
    now = datetime.utcnow().isoformat()
    
    try:
        # Check if already populated
        existing_faqs = await db.education_faqs.count_documents({})
        existing_articles = await db.education_articles.count_documents({})
        existing_videos = await db.education_videos.count_documents({})
        
        print(f"📊 Current state:")
        print(f"   - FAQs: {existing_faqs}")
        print(f"   - Articles: {existing_articles}")
        print(f"   - Videos: {existing_videos}")
        
        # Populate FAQs
        if existing_faqs == 0:
            print("\n📝 Populating FAQs...")
            for faq in faqs_data:
                faq_doc = {
                    '_id': str(uuid.uuid4()),
                    'question': faq['question'],
                    'answer': faq['answer'],
                    'icon': faq['icon'],
                    'order': faq['order'],
                    'active': True,
                    'created_at': now,
                    'updated_at': now,
                }
                await db.education_faqs.insert_one(faq_doc)
                print(f"   ✅ Created FAQ: {faq['question'][:50]}...")
            print(f"✅ Created {len(faqs_data)} FAQs")
        else:
            print(f"⏭️  Skipping FAQs - {existing_faqs} already exist")
        
        # Populate Articles
        if existing_articles == 0:
            print("\n📰 Populating Articles...")
            for article in articles_data:
                article_doc = {
                    '_id': str(uuid.uuid4()),
                    'title': article['title'],
                    'description': article['description'],
                    'read_time': article['read_time'],
                    'category': article['category'],
                    'content': article['content'],
                    'order': article['order'],
                    'active': True,
                    'created_at': now,
                    'updated_at': now,
                }
                await db.education_articles.insert_one(article_doc)
                print(f"   ✅ Created Article: {article['title']}")
            print(f"✅ Created {len(articles_data)} Articles")
        else:
            print(f"⏭️  Skipping Articles - {existing_articles} already exist")
        
        # Populate Videos
        if existing_videos == 0:
            print("\n🎥 Populating Videos...")
            for video in videos_data:
                video_doc = {
                    '_id': str(uuid.uuid4()),
                    'title': video['title'],
                    'description': video['description'],
                    'duration': video['duration'],
                    'url': video['url'],
                    'thumbnail': video.get('thumbnail'),
                    'order': video['order'],
                    'active': True,
                    'created_at': now,
                    'updated_at': now,
                }
                await db.education_videos.insert_one(video_doc)
                print(f"   ✅ Created Video: {video['title']}")
            print(f"✅ Created {len(videos_data)} Videos")
        else:
            print(f"⏭️  Skipping Videos - {existing_videos} already exist")
        
        # Final count
        final_faqs = await db.education_faqs.count_documents({})
        final_articles = await db.education_articles.count_documents({})
        final_videos = await db.education_videos.count_documents({})
        
        print("\n" + "="*50)
        print("✅ POPULATION COMPLETE!")
        print("="*50)
        print(f"📊 Final state:")
        print(f"   - FAQs: {final_faqs}")
        print(f"   - Articles: {final_articles}")
        print(f"   - Videos: {final_videos}")
        print("="*50)
        
    except Exception as e:
        print(f"\n❌ Error populating education resources: {e}")
        raise
    finally:
        client.close()

if __name__ == '__main__':
    asyncio.run(populate_education_resources())
