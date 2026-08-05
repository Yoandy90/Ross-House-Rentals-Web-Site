import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AdminHeader from '../../components/admin/AdminHeader';
import { useTranslation } from 'react-i18next';

interface LegalDoc {
  id: string;
  type: 'terms' | 'privacy';
  version: string;
  is_published: boolean;
  effective_date: string;
  updated_at: string;
  content_preview?: string;
}

export default function LegalManagement() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [documents, setDocuments] = useState<LegalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Editor state
  const [editorType, setEditorType] = useState<'terms' | 'privacy'>('terms');
  const [editorContent, setEditorContent] = useState('');
  const [editorVersion, setEditorVersion] = useState('1.0');
  const [editorPublish, setEditorPublish] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/legal');
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error loading legal documents:', error);
      Alert.alert('Error', 'No se pudieron cargar los documentos legales');
    } finally {
      setLoading(false);
    }
  };

  const handleNewDocument = (type: 'terms' | 'privacy') => {
    setEditingDoc(null);
    setEditorType(type);
    setEditorContent(getDefaultContent(type));
    setEditorVersion('1.0');
    setEditorPublish(false);
    setShowEditor(true);
  };

  const handleEditDocument = async (docId: string) => {
    try {
      const response = await api.get(`/admin/legal/${docId}`);
      const doc = response.data;
      
      setEditingDoc(doc);
      setEditorType(doc.type);
      setEditorContent(doc.content);
      setEditorVersion(doc.version);
      setEditorPublish(doc.is_published);
      setShowEditor(true);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'No se pudo cargar el documento');
    }
  };

  const handleSave = async () => {
    if (!editorContent.trim()) {
      Alert.alert('Error', 'El contenido no puede estar vacío');
      return;
    }

    if (!editorVersion.trim()) {
      Alert.alert('Error', 'La versión es requerida');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: editorType,
        content: editorContent,
        version: editorVersion,
        is_published: editorPublish,
        effective_date: new Date().toISOString()
      };

      if (editingDoc) {
        await api.put(`/admin/legal/${editingDoc.id}`, payload);
        Alert.alert('Éxito', 'Documento actualizado correctamente');
      } else {
        await api.post('/admin/legal', payload);
        Alert.alert('Éxito', 'Documento creado correctamente');
      }

      setShowEditor(false);
      loadDocuments();
    } catch (error: any) {
      console.error('Error saving document:', error);
      const errorMsg = error.response?.data?.detail || 'No se pudo guardar el documento';
      Alert.alert('Error', errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string, docType: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Estás seguro de eliminar este documento de ${docType}?`)) {
        try {
          await api.delete(`/admin/legal/${docId}`);
          Alert.alert('Éxito', 'Documento eliminado');
          loadDocuments();
        } catch (error: any) {
          const errorMsg = error.response?.data?.detail || 'No se pudo eliminar';
          Alert.alert('Error', errorMsg);
        }
      }
    } else {
      Alert.alert(
        'Confirmar',
        `¿Eliminar este documento de ${docType}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(`/admin/legal/${docId}`);
                Alert.alert('Éxito', 'Documento eliminado');
                loadDocuments();
              } catch (error: any) {
                const errorMsg = error.response?.data?.detail || 'No se pudo eliminar';
                Alert.alert('Error', errorMsg);
              }
            }
          }
        ]
      );
    }
  };

  const getDefaultContent = (type: 'terms' | 'privacy'): string => {
    if (type === 'terms') {
      return `# Términos y Condiciones de Ross Tax Preparation

**Fecha de vigencia:** ${format(new Date(), 'd de MMMM, yyyy', { locale: es })}

**Ross Tax Preparation** - Preparación Profesional de Impuestos

Bienvenido a Ross Tax Preparation. Estos Términos y Condiciones rigen el uso de nuestros servicios de preparación de declaraciones de impuestos y nuestra aplicación móvil.

---

## 1. Aceptación de los Términos

Al contratar nuestros servicios o utilizar nuestra aplicación móvil, usted acepta expresamente estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.

## 2. Descripción de Servicios

Ross Tax Preparation proporciona servicios profesionales de preparación y presentación de declaraciones de impuestos, incluyendo:

### 2.1 Servicios Principales
- **Declaraciones de Impuestos Personales** - Federal y estatal (Formularios 1040, 1040-SR)
- **Declaraciones de Impuestos para Pequeñas Empresas** - Schedule C, LLC, S-Corp
- **Preparación de ITIN** - Solicitud y renovación de números de identificación fiscal
- **Enmiendas** - Corrección de declaraciones anteriores (Formulario 1040-X)
- **Consultoría Fiscal** - Asesoramiento y planificación tributaria

### 2.2 Servicios Digitales
- **Aplicación Móvil** - Acceso a tu información fiscal 24/7
- **Carga de Documentos** - Sube tus W-2, 1099 y recibos de forma segura
- **Seguimiento en Tiempo Real** - Monitorea el progreso de tu declaración
- **Notificaciones** - Alertas sobre el estado de tu reembolso
- **Chat en Vivo** - Comunicación directa con nuestro equipo

## 3. Responsabilidades del Cliente

### 3.1 Información y Documentación
El cliente se compromete a:
- ✅ Proporcionar información **precisa, completa y verificable**
- ✅ Entregar **todos los documentos fiscales** necesarios (W-2, 1099, recibos, etc.)
- ✅ Notificar cualquier **cambio en su situación fiscal**
- ✅ Responder a solicitudes de información adicional en **72 horas o menos**
- ✅ Revisar su declaración antes de la firma y presentación
- ✅ Mantener copias de todos los documentos por **7 años** (requisito del IRS)

### 3.2 Veracidad de la Información
El cliente es **legalmente responsable** de la exactitud de la información proporcionada. Ross Tax Preparation no asume responsabilidad por información falsa, incompleta o engañosa proporcionada por el cliente.

### 3.3 Pagos Puntuales
- Pagar las tarifas de servicio según lo acordado
- Completar el pago **antes** de la presentación final de la declaración
- Informar sobre cualquier dificultad de pago con anticipación

## 4. Responsabilidades de Ross Tax Preparation

### 4.1 Compromiso Profesional
Nos comprometemos a:
- 🎯 **Precisión Profesional** - Preparar declaraciones con el máximo cuidado y atención al detalle
- 🔒 **Confidencialidad Absoluta** - Proteger su información según las leyes federales (IRS Circular 230)
- 📋 **Cumplimiento Normativo** - Seguir todas las regulaciones del IRS y leyes estatales
- 💬 **Soporte Continuo** - Estar disponibles para preguntas durante todo el proceso
- 📱 **Tecnología Segura** - Mantener nuestra plataforma con los más altos estándares de seguridad
- ⚡ **Procesamiento Rápido** - Presentar declaraciones dentro de los plazos acordados

### 4.2 Representación ante el IRS
Como preparadores fiscales registrados, podemos representarle ante el IRS en auditorías relacionadas con declaraciones que hemos preparado.

## 5. Tarifas y Estructura de Pagos

### 5.1 Estructura de Precios
Las tarifas se determinan según:
- Complejidad de la declaración
- Número de formularios requeridos
- Tiempo estimado de preparación
- Servicios adicionales solicitados

### 5.2 Modalidades de Pago
Aceptamos:
- 💳 Tarjetas de crédito y débito (Visa, Mastercard, Discover, Amex)
- 🏦 Transferencias bancarias (ACH)
- 💵 Efectivo (en oficina)
- 📱 Pagos desde la app móvil

### 5.3 Política de Reembolso
**NO ofrecemos reembolsos** una vez que el trabajo ha comenzado. En caso de insatisfacción, trabajaremos para resolver el problema.

### 5.4 Servicios de Emergencia
Declaraciones de último momento (menos de 7 días antes del deadline) pueden tener un **cargo adicional del 50%**.

## 6. Confidencialidad y Seguridad de Datos

### 6.1 Compromiso de Confidencialidad
Toda la información fiscal y personal es tratada con **estricta confidencialidad** de acuerdo con:
- IRS Circular 230
- Gramm-Leach-Bliley Act (GLBA)
- Leyes estatales de privacidad

### 6.2 Medidas de Seguridad
- 🔐 Encriptación SSL/TLS de nivel bancario
- 🔑 Autenticación de dos factores (2FA)
- 🗄️ Almacenamiento seguro en servidores certificados
- 🚨 Monitoreo de seguridad 24/7
- 🔄 Copias de seguridad diarias automáticas

## 7. Limitación de Responsabilidad

### 7.1 Alcance de la Responsabilidad
Ross Tax Preparation **NO será responsable** por:
- Penalidades o intereses del IRS resultantes de **información inexacta** proporcionada por el cliente
- Cambios en leyes fiscales **después** de la presentación de la declaración
- Problemas con reembolsos depositados en **cuentas bancarias incorrectas** proporcionadas por el cliente
- Pérdida de documentos **antes** de ser entregados a nuestra oficina
- Auditorías del IRS no relacionadas con errores de preparación

### 7.2 Garantía de Precisión
Garantizamos la precisión de nuestro trabajo. Si cometemos un error, lo corregiremos **sin costo adicional** y cubriremos cualquier penalidad resultante de nuestro error.

## 8. Cancelaciones y Modificaciones

### 8.1 Cancelación por el Cliente
- ✅ **Antes de comenzar**: Reembolso completo
- ⚠️ **Trabajo en progreso**: Sin reembolso, pero recibirá los documentos preparados hasta ese momento
- ❌ **Después de la presentación**: No aplica cancelación

### 8.2 Cancelación por Ross Tax
Nos reservamos el derecho de cancelar el servicio si:
- El cliente no proporciona información requerida después de **3 solicitudes**
- Se detecta información fraudulenta o falsa
- El cliente muestra comportamiento abusivo hacia nuestro personal
- No se realiza el pago acordado

## 9. Plazo de Retención de Documentos

Mantenemos sus registros por **7 años** según lo requerido por el IRS. Después de este periodo, los documentos pueden ser destruidos de forma segura.

## 10. Uso de la Aplicación Móvil

### 10.1 Licencia de Uso
Le otorgamos una licencia **no exclusiva, no transferible** para usar nuestra aplicación móvil.

### 10.2 Prohibiciones
Está prohibido:
- ❌ Realizar ingeniería inversa de la aplicación
- ❌ Compartir sus credenciales de acceso
- ❌ Usar la app para fines ilegales
- ❌ Intentar acceder a datos de otros usuarios

### 10.3 Actualizaciones
La app puede actualizarse periódicamente. Las actualizaciones críticas de seguridad son **obligatorias**.

## 11. Modificaciones de los Términos

Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios importantes serán notificados por:
- 📧 Email a la dirección registrada
- 📱 Notificación push en la app
- 🌐 Publicación en nuestro sitio web

El uso continuo de nuestros servicios después de las modificaciones constituye aceptación de los nuevos términos.

## 12. Ley Aplicable y Jurisdicción

Estos términos se rigen por las leyes federales de los Estados Unidos y las leyes del estado donde opera Ross Tax Preparation. Cualquier disputa será resuelta en los tribunales competentes de dicha jurisdicción.

## 13. Contacto y Soporte

### 📞 Información de Contacto
- **Email**: info@rosstaxpreparation.com
- **Teléfono**: +1 (806) 934-2018
- **WhatsApp**: +1 (806) 934-2018
- **Sitio Web**: www.rosstaxpreparation.com
- **Horario**: Lunes a Viernes, 9:00 AM - 6:00 PM
- **Temporada Alta**: Lunes a Sábado, 9:00 AM - 8:00 PM (Enero - Abril)

### 📱 Soporte Técnico
- **App Móvil**: Chat en vivo dentro de la aplicación
- **Email Técnico**: support@rosstaxpreparation.com
- **Respuesta Promedio**: 24 horas

---

**Última actualización**: ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}

Al utilizar nuestros servicios, usted confirma que ha leído, entendido y aceptado estos Términos y Condiciones.

**© ${new Date().getFullYear()} Ross Tax Preparation. Todos los derechos reservados.**`;
    } else {
      return `# Política de Privacidad de Ross Tax Preparation

**Fecha de vigencia:** ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}

**Ross Tax Preparation** - Su privacidad es nuestra prioridad

Esta Política de Privacidad describe cómo Ross Tax Preparation ("nosotros", "nuestro" o "la empresa") recopila, usa, almacena y protege su información personal cuando utiliza nuestros servicios de preparación de impuestos y nuestra aplicación móvil.

---

## 1. Información que Recopilamos

### 1.1 Información Personal Identificable
Recopilamos la siguiente información necesaria para preparar sus declaraciones de impuestos:

**Información Básica:**
- Nombre completo legal
- Fecha de nacimiento
- Número de Seguro Social (SSN) o ITIN
- Dirección física y postal
- Número de teléfono
- Dirección de correo electrónico
- Estado civil y dependientes

**Información Financiera:**
- Ingresos (W-2, 1099-MISC, 1099-INT, 1099-DIV, etc.)
- Deducciones y créditos fiscales
- Información bancaria (para depósito directo de reembolsos)
- Historial de declaraciones anteriores
- Documentos de apoyo (recibos, facturas, estados de cuenta)

**Información del Empleador:**
- Nombre y EIN del empleador
- Historial laboral
- Beneficios y compensaciones

### 1.2 Información Técnica de la Aplicación
Cuando usa nuestra app móvil, también recopilamos:
- Tipo de dispositivo y sistema operativo
- Dirección IP
- ID único del dispositivo
- Datos de uso de la aplicación
- Registros de errores y rendimiento
- Preferencias y configuraciones

### 1.3 Información de Terceros
Podemos recibir información de:
- IRS (transcripciones de impuestos con su autorización)
- Empleadores (verificación de W-2)
- Instituciones financieras
- Bases de datos de verificación de identidad

## 2. Cómo Usamos su Información

### 2.1 Propósitos Principales
Utilizamos su información para:

✅ **Preparación de Impuestos**
- Preparar y presentar sus declaraciones federales y estatales
- Calcular deducciones y créditos aplicables
- Maximizar su reembolso legalmente
- Responder preguntas del IRS o autoridades estatales

✅ **Comunicación**
- Enviar actualizaciones sobre el estado de su declaración
- Notificar sobre cambios en leyes fiscales que le afecten
- Programar y recordar citas
- Solicitar documentación adicional necesaria
- Responder a sus consultas

✅ **Cumplimiento Legal**
- Cumplir con requisitos del IRS y leyes estatales
- Mantener registros según regulaciones
- Responder a órdenes judiciales o citaciones
- Prevenir fraude fiscal

✅ **Mejora de Servicios**
- Analizar tendencias para mejorar nuestros servicios
- Desarrollar nuevas funcionalidades en la app
- Capacitar a nuestro personal
- Realizar encuestas de satisfacción

### 2.2 Marketing y Promociones
Con su consentimiento, podemos usar su información para:
- Enviar promociones de temporada
- Informar sobre nuevos servicios
- Compartir consejos fiscales
- Enviar recordatorios de fechas límite

**Puede optar por no recibir estos mensajes en cualquier momento.**

## 3. Compartir y Divulgación de Información

### 3.1 NO Compartimos su Información, EXCEPTO:

❌ **NO vendemos** su información personal a terceros
❌ **NO alquilamos** su información a empresas de marketing
❌ **NO compartimos** sin su consentimiento, excepto como se describe a continuación:

### 3.2 Divulgaciones Permitidas

✅ **Con el IRS y Autoridades Fiscales**
- Presentación electrónica de declaraciones
- Respuesta a consultas o auditorías
- Cumplimiento de regulaciones fiscales

✅ **Proveedores de Servicios**
Compartimos información con proveedores que nos ayudan a operar, tales como:
- Servicios de almacenamiento en la nube (encriptados)
- Proveedores de software de preparación de impuestos
- Servicios de e-filing autorizados por el IRS
- Procesadores de pagos (para tarifas de servicio)

**Todos los proveedores están obligados contractualmente a proteger su información.**

✅ **Requerimientos Legales**
Podemos divulgar información cuando:
- Lo requiera una orden judicial o citación
- Sea necesario para proteger nuestros derechos legales
- Se sospeche fraude o actividad ilegal
- Lo exija una ley federal o estatal

✅ **Con su Consentimiento**
Con su autorización escrita explícita, podemos compartir información con:
- Asesores financieros
- Abogados
- Familiares designados
- Otros profesionales de su elección

### 3.3 Transferencias Comerciales
En caso de fusión, adquisición o venta de activos, su información puede transferirse, pero seguirá protegida bajo esta política.

## 4. Seguridad de los Datos

### 4.1 Medidas Técnicas de Seguridad

🔐 **Encriptación de Nivel Bancario**
- SSL/TLS 256-bit en todas las transmisiones
- Encriptación AES-256 para datos almacenados
- Certificados de seguridad actualizados

🔑 **Control de Acceso**
- Autenticación de dos factores (2FA)
- Contraseñas robustas requeridas
- Acceso limitado por rol (Role-Based Access Control)
- Sesiones seguras con expiración automática

🗄️ **Almacenamiento Seguro**
- Servidores certificados SOC 2
- Centros de datos con seguridad física 24/7
- Redundancia geográfica de datos
- Copias de seguridad automáticas diarias

🚨 **Monitoreo y Respuesta**
- Monitoreo de seguridad 24/7
- Detección de intrusiones
- Registro de auditoría de todos los accesos
- Plan de respuesta a incidentes

### 4.2 Medidas Organizacionales

👥 **Capacitación del Personal**
- Entrenamiento regular en seguridad y privacidad
- Acuerdos de confidencialidad firmados
- Verificación de antecedentes
- Principio de "menor privilegio"

📋 **Políticas y Procedimientos**
- Política de privacidad interna estricta
- Procedimientos de eliminación segura de datos
- Auditorías de seguridad regulares
- Actualizaciones de software programadas

### 4.3 Su Responsabilidad
Para mantener su información segura:
- ✅ Use contraseñas fuertes y únicas
- ✅ Active la autenticación de dos factores
- ✅ No comparta sus credenciales
- ✅ Cierre sesión en dispositivos compartidos
- ✅ Mantenga su dispositivo actualizado
- ✅ Reporte actividad sospechosa inmediatamente

## 5. Retención de Datos

### 5.1 Período de Retención
Mantenemos sus registros fiscales por **mínimo 7 años** desde la fecha de presentación, según lo requerido por:
- IRS (generalmente 3-7 años según el caso)
- Regulaciones estatales
- Mejores prácticas profesionales

### 5.2 Después del Período de Retención
Una vez transcurrido el período:
- Podemos eliminar sus datos de forma segura
- Puede solicitar extensión de retención
- Puede solicitar eliminación anticipada (sujeto a requisitos legales)

### 5.3 Eliminación Segura
Cuando eliminamos datos:
- Destrucción irreversible de archivos digitales
- Trituración segura de documentos físicos
- Certificación de destrucción disponible

## 6. Sus Derechos de Privacidad

### 6.1 Derechos que Tiene

🔍 **Derecho de Acceso**
- Solicitar copia de su información personal
- Revisar datos que tenemos sobre usted
- Obtener transcripciones de declaraciones anteriores

✏️ **Derecho de Corrección**
- Solicitar corrección de información inexacta
- Actualizar información desactualizada
- Completar información incompleta

🗑️ **Derecho de Eliminación**
- Solicitar eliminación de sus datos (sujeto a requisitos legales del IRS)
- Derecho a ser olvidado (con limitaciones legales)

🚫 **Derecho de Restricción**
- Limitar el procesamiento de ciertos datos
- Oponerse a ciertos usos de su información
- Optar por no recibir marketing

📤 **Derecho de Portabilidad**
- Recibir sus datos en formato electrónico
- Transferir datos a otro preparador de impuestos
- Obtener copias de declaraciones presentadas

❌ **Derecho de Revocación**
- Retirar consentimientos previamente otorgados
- Dejar de recibir comunicaciones promocionales

### 6.2 Cómo Ejercer sus Derechos
Para ejercer cualquier derecho:
📧 Email: privacy@rosstaxpreparation.com
📞 Teléfono: +1 (806) 934-2018
🏢 En persona en nuestra oficina

**Responderemos en un plazo de 30 días.**

## 7. Cookies y Tecnología de Seguimiento

### 7.1 Uso de Cookies
Nuestra aplicación móvil y sitio web utilizan:

**Cookies Esenciales:**
- Sesión de usuario (necesarias)
- Autenticación (necesarias)
- Seguridad (necesarias)

**Cookies Analíticas:**
- Análisis de uso de la app
- Mejoras de rendimiento
- Detección de errores

**Cookies de Funcionalidad:**
- Preferencias del usuario
- Idioma y región
- Configuraciones personalizadas

### 7.2 Control de Cookies
Puede:
- Configurar su navegador para rechazar cookies
- Eliminar cookies existentes
- Ajustar preferencias en la app

**Nota:** Rechazar cookies esenciales puede afectar la funcionalidad.

### 7.3 Tecnologías Similares
- Web beacons para analítica
- Local storage para rendimiento
- Push notifications (con su permiso)

## 8. Privacidad de Menores

**No recopilamos intencionalmente información de menores de 13 años** sin consentimiento parental. Si descubrimos que hemos recopilado información de un menor, la eliminaremos inmediatamente.

Para dependientes incluidos en declaraciones, solo recopilamos información necesaria para fines fiscales con autorización del padre/tutor.

## 9. Transferencias Internacionales

Sus datos se almacenan principalmente en servidores ubicados en Estados Unidos. Si viaja o reside fuera de EE.UU., sus datos pueden procesarse aquí, donde las leyes de privacidad pueden diferir de su país de origen.

## 10. Cambios a esta Política

### 10.1 Actualizaciones
Nos reservamos el derecho de actualizar esta política en cualquier momento.

### 10.2 Notificación de Cambios
Le notificaremos sobre cambios significativos mediante:
- 📧 Email a su dirección registrada
- 📱 Notificación push en la aplicación
- 🌐 Banner en nuestro sitio web
- 📞 Llamada telefónica (para cambios mayores)

### 10.3 Revisión
Le recomendamos revisar esta política periódicamente. El uso continuado de nuestros servicios después de cambios constituye aceptación.

## 11. Leyes de Privacidad Estatales

### 11.1 Residentes de California (CCPA)
Si es residente de California, tiene derechos adicionales bajo la California Consumer Privacy Act.

### 11.2 Otras Leyes Estatales
Cumplimos con todas las leyes estatales de privacidad aplicables.

## 12. Cumplimiento Regulatorio

### 12.1 Regulaciones Federales
Cumplimos estrictamente con:
- **IRS Circular 230** - Regulaciones para preparadores de impuestos
- **Gramm-Leach-Bliley Act (GLBA)** - Protección de información financiera
- **Federal Trade Commission (FTC) Safeguards Rule**
- **IRS Publication 4557** - Protección de información del contribuyente

### 12.2 Certificaciones
- Preparadores certificados por el IRS
- Miembros de asociaciones profesionales
- Cumplimiento de estándares de la industria

## 13. Contacto y Preguntas

### 📞 Información de Contacto

**Para preguntas sobre privacidad:**
- **Email**: privacy@rosstaxpreparation.com
- **Email General**: info@rosstaxpreparation.com
- **Teléfono**: +1 (806) 934-2018
- **WhatsApp**: +1 (806) 934-2018
- **Sitio Web**: www.rosstaxpreparation.com

**Horario de Atención:**
- **Regular**: Lunes a Viernes, 9:00 AM - 6:00 PM
- **Temporada Alta** (Enero-Abril): Lunes a Sábado, 9:00 AM - 8:00 PM

### 🛡️ Oficial de Privacidad
Para asuntos urgentes de privacidad, contacte a nuestro Oficial de Privacidad designado en privacy@rosstaxpreparation.com

### 📝 Quejas
Si tiene una queja sobre cómo manejamos su información personal, contáctenos primero. Si no está satisfecho, puede presentar una queja ante:
- Federal Trade Commission (FTC)
- IRS Office of Professional Responsibility
- Agencia de privacidad de su estado

---

## 14. Consentimiento y Aceptación

Al utilizar nuestros servicios o aplicación móvil, usted:
- ✅ Confirma que ha leído esta Política de Privacidad
- ✅ Entiende cómo recopilamos, usamos y protegemos su información
- ✅ Acepta las prácticas descritas en esta política
- ✅ Autoriza el procesamiento de su información según se describe

**Si no está de acuerdo con esta política, no utilice nuestros servicios.**

---

**Última actualización**: ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}

**© ${new Date().getFullYear()} Ross Tax Preparation. Todos los derechos reservados.**

Su privacidad es nuestra prioridad. Gracias por confiar en nosotros con su información fiscal.`;
    }
  };

  const renderDocumentCard = (doc: LegalDoc) => {
    const typeLabel = doc.type === 'terms' ? 'Términos y Condiciones' : 'Política de Privacidad';
    const typeIcon = doc.type === 'terms' ? 'document-text' : 'shield-checkmark';

    return (
      <View key={doc.id} style={styles.docCard}>
        <View style={styles.docHeader}>
          <View style={styles.docHeaderLeft}>
            <View style={[styles.docIcon, { backgroundColor: doc.type === 'terms' ? colors.primary + '20' : colors.info + '20' }]}>
              <Ionicons name={typeIcon as any} size={24} color={doc.type === 'terms' ? colors.primary : colors.info} />
            </View>
            <View>
              <Text style={styles.docTitle}>{typeLabel}</Text>
              <Text style={styles.docVersion}>Versión {doc.version}</Text>
            </View>
          </View>
          <View style={styles.docStatus}>
            {doc.is_published ? (
              <View style={styles.publishedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.publishedText}>Publicado</Text>
              </View>
            ) : (
              <View style={styles.draftBadge}>
                <Ionicons name="create-outline" size={16} color={colors.textGray} />
                <Text style={styles.draftText}>Borrador</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.docMeta}>
          <Text style={styles.docMetaText}>
            Actualizado: {format(new Date(doc.updated_at), "d 'de' MMM, yyyy", { locale: es })}
          </Text>
        </View>

        <View style={styles.docActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleEditDocument(doc.id)}>
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
          {!doc.is_published && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.deleteButton]} 
              onPress={() => handleDelete(doc.id, typeLabel)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>Eliminar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (showEditor) {
    return (
      <View style={styles.container}>
        <AdminHeader 
          title={`${editingDoc ? 'Editar' : 'Nuevo'} ${editorType === 'terms' ? 'Términos' : 'Privacidad'}`}
          rightAction={{
            icon: 'checkmark',
            onPress: handleSave,
            disabled: saving,
          }}
        />

        <ScrollView style={styles.editorBody}>
          <View style={styles.editorSection}>
            <Text style={styles.editorLabel}>Versión</Text>
            <TextInput
              style={styles.versionInput}
              value={editorVersion}
              onChangeText={setEditorVersion}
              placeholder="1.0"
              placeholderTextColor={colors.textLight}
            />
          </View>

          <View style={styles.editorSection}>
            <TouchableOpacity 
              style={styles.publishToggle}
              onPress={() => setEditorPublish(!editorPublish)}
            >
              <View style={[styles.publishCheckbox, editorPublish && styles.publishCheckboxActive]}>
                {editorPublish && <Ionicons name="checkmark" size={16} color={colors.textWhite} />}
              </View>
              <Text style={styles.publishLabel}>Publicar inmediatamente</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorSection}>
            <Text style={styles.editorLabel}>Contenido (Markdown)</Text>
            <TextInput
              style={styles.contentInput}
              value={editorContent}
              onChangeText={setEditorContent}
              placeholder={t('admin.legalContentPlaceholder', 'Escribe el contenido aquí...')}
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={20}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.markdownHelp}>
            <Text style={styles.markdownHelpTitle}>Ayuda de formato:</Text>
            <Text style={styles.markdownHelpText}>• # Título grande</Text>
            <Text style={styles.markdownHelpText}>• ## Título mediano</Text>
            <Text style={styles.markdownHelpText}>• **texto** = negrita</Text>
            <Text style={styles.markdownHelpText}>• *texto* = cursiva</Text>
            <Text style={styles.markdownHelpText}>• - item = lista</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Documentos Legales" subtitle="Gestiona términos y políticas" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando documentos...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Crear Nuevo Documento</Text>
            </View>
            <View style={styles.createButtons}>
              <TouchableOpacity 
                style={[styles.createButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => handleNewDocument('terms')}
              >
                <Ionicons name="document-text" size={32} color={colors.primary} />
                <Text style={[styles.createButtonText, { color: colors.primary }]}>
                  Términos y Condiciones
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.createButton, { backgroundColor: colors.info + '15' }]}
                onPress={() => handleNewDocument('privacy')}
              >
                <Ionicons name="shield-checkmark" size={32} color={colors.info} />
                <Text style={[styles.createButtonText, { color: colors.info }]}>
                  Política de Privacidad
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos Existentes</Text>
            {documents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={64} color={colors.textLight} />
                <Text style={styles.emptyTitle}>No hay documentos</Text>
                <Text style={styles.emptySubtitle}>Crea tu primer documento legal</Text>
              </View>
            ) : (
              documents.map(renderDocumentCard)
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  header: {
    padding: 20,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  createButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  docCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  docHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  docIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  docVersion: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  docStatus: {
    marginLeft: 12,
  },
  publishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  publishedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.backgroundGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  draftText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
  },
  docMeta: {
    marginBottom: 12,
  },
  docMetaText: {
    fontSize: 12,
    color: colors.textGray,
  },
  docActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.primary + '10',
    gap: 6,
  },
  deleteButton: {
    backgroundColor: colors.error + '10',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  editorHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textWhite,
  },
  editorBody: {
    flex: 1,
    padding: 20,
  },
  editorSection: {
    marginBottom: 20,
  },
  editorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  versionInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  publishToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  publishCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  publishLabel: {
    fontSize: 15,
    color: colors.text,
  },
  contentInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 400,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  markdownHelp: {
    backgroundColor: colors.info + '10',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  markdownHelpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.info,
    marginBottom: 8,
  },
  markdownHelpText: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});