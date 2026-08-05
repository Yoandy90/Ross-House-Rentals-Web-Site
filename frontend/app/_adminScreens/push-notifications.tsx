import React, { useState, useEffect, useCallback } from 'react';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { forceRegisterPushToken } from '../../services/notificationService';
import { useTranslation } from 'react-i18next';

// Notification Templates
const NOTIFICATION_TEMPLATES = [
  {
    id: 'document_reminder',
    name: 'Recordatorio de Documentos',
    icon: 'document-text',
    color: '#3b82f6',
    title: '📄 Documentos Pendientes',
    body: 'Recuerda subir tus documentos fiscales para preparar tu declaración. ¡Te esperamos!',
    category: 'reminder'
  },
  {
    id: 'payment_reminder',
    name: 'Recordatorio de Pago',
    icon: 'card',
    color: '#ef4444',
    title: '💳 Pago Pendiente',
    body: 'Tienes un pago pendiente en Ross Tax. Completa tu pago para continuar con tu servicio.',
    category: 'payment'
  },
  {
    id: 'appointment_reminder',
    name: 'Recordatorio de Cita',
    icon: 'calendar',
    color: '#8b5cf6',
    title: '📅 Cita Próxima',
    body: 'Tu cita en Ross Tax es pronto. ¡Te esperamos!',
    category: 'appointment'
  },
  {
    id: 'tax_deadline',
    name: 'Fecha Límite de Impuestos',
    icon: 'alarm',
    color: '#f59e0b',
    title: '⚠️ Fecha Límite Cercana',
    body: 'La fecha límite para declarar impuestos se acerca. Agenda tu cita hoy mismo.',
    category: 'deadline'
  },
  {
    id: 'refund_ready',
    name: 'Reembolso Listo',
    icon: 'cash',
    color: '#10b981',
    title: '💰 ¡Tu Reembolso está Listo!',
    body: 'Buenas noticias: tu reembolso de impuestos ha sido procesado. Revisa tu cuenta bancaria.',
    category: 'good_news'
  },
  {
    id: 'new_service',
    name: 'Nuevo Servicio',
    icon: 'star',
    color: '#ec4899',
    title: '✨ Nuevo Servicio Disponible',
    body: 'Descubre nuestros nuevos servicios en Ross Tax. ¡Visítanos para más información!',
    category: 'promo'
  },
  {
    id: 'office_hours',
    name: 'Horario de Oficina',
    icon: 'time',
    color: '#6366f1',
    title: '🏢 Cambio de Horario',
    body: 'Te informamos sobre nuestro horario de atención. Consulta la app para más detalles.',
    category: 'info'
  },
  {
    id: 'promo_offer',
    name: 'Oferta Especial',
    icon: 'pricetag',
    color: '#14b8a6',
    title: '🎉 ¡Oferta Especial!',
    body: 'Aprovecha nuestra promoción exclusiva por tiempo limitado. ¡No te la pierdas!',
    category: 'promo'
  },
];

// Quick Actions
const QUICK_ACTIONS = [
  { id: 'all_clients', name: 'Todos los Clientes', icon: 'people', color: '#3b82f6' },
  { id: 'active_clients', name: 'Clientes Activos', icon: 'checkmark-circle', color: '#10b981' },
  { id: 'pending_docs', name: 'Docs Pendientes', icon: 'document-attach', color: '#f59e0b' },
  { id: 'pending_payment', name: 'Pagos Pendientes', icon: 'card-outline', color: '#ef4444' },
];

interface NotificationStats {
  total_sent: number;
  total_users: number;
  push_enabled: number;
  last_sent: string | null;
}

interface HistoryItem {
  id: string;
  title: string;
  body: string;
  sent_at: string;
  recipients_count: number;
  success_count: number;
  segment?: string;
}

export default function PushNotificationsAdmin() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [stats, setStats] = useState<NotificationStats>({
    total_sent: 0,
    total_users: 0,
    push_enabled: 0,
    last_sent: null
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Modal states
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // Compose form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all_clients');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof NOTIFICATION_TEMPLATES[0] | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        api.get('/admin/push-notifications/segments').catch(() => ({ data: {} })),
        api.get('/admin/push-notifications/history').catch(() => ({ data: { history: [] } })),
      ]);
      
      setStats({
        total_sent: historyRes.data.history?.length || 0,
        total_users: statsRes.data.total_push_enabled || 0,
        push_enabled: statsRes.data.total_push_enabled || 0,
        last_sent: historyRes.data.history?.[0]?.sent_at || null
      });
      setHistory(historyRes.data.history || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSelectTemplate = (template: typeof NOTIFICATION_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setTitle(template.title);
    setMessage(template.body);
    setShowTemplatesModal(false);
    setShowComposeModal(true);
  };

  const handleQuickAction = (actionId: string) => {
    setSelectedSegment(actionId);
    setShowComposeModal(true);
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Por favor completa el título y mensaje');
      return;
    }

    const segmentNames: { [key: string]: string } = {
      'all_clients': 'todos los clientes',
      'active_clients': 'clientes activos',
      'pending_docs': 'clientes con documentos pendientes',
      'pending_payment': 'clientes con pagos pendientes',
    };

    Alert.alert(
      '📤 Confirmar Envío',
      `¿Enviar notificación a ${segmentNames[selectedSegment] || selectedSegment}?\n\nTítulo: ${title}\n\nMensaje: ${message}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'default',
          onPress: async () => {
            setSending(true);
            try {
              const params = new URLSearchParams();
              params.append('segment_id', selectedSegment);
              params.append('title', title.trim());
              params.append('body', message.trim());

              await api.post(`/admin/push-notifications/send-to-segment?${params.toString()}`);
              
              Alert.alert('✅ Enviado', 'La notificación se envió correctamente');
              
              // Reset form
              setTitle('');
              setMessage('');
              setSelectedTemplate(null);
              setShowComposeModal(false);
              
              // Reload data
              loadData();
            } catch (error: any) {
              console.error('Error sending:', error);
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la notificación');
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };

  const handleSendTest = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Por favor completa el título y mensaje primero');
      return;
    }

    setSending(true);
    try {
      await api.post('/notifications/send-test');
      Alert.alert('✅ Prueba Enviada', 'Revisa tu dispositivo para ver la notificación');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la prueba');
    } finally {
      setSending(false);
    }
  };

  // Force register push token
  const handleActivateNotifications = async () => {
    setSending(true);
    try {
      const success = await forceRegisterPushToken();
      if (success) {
        // Reload stats after registration
        loadData();
      }
    } catch (error) {
      console.error('Error activating notifications:', error);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Notificaciones Push" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Notificaciones Push" showBack />
      
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Stats Card */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroIconContainer}>
              <Ionicons name="notifications" size={32} color="#FFF" />
            </View>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle}>Centro de Notificaciones</Text>
              <Text style={styles.heroSubtitle}>Mantén informados a tus clientes</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.push_enabled}</Text>
              <Text style={styles.statLabel}>Usuarios Activos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total_sent}</Text>
              <Text style={styles.statLabel}>Enviadas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>100%</Text>
              <Text style={styles.statLabel}>Entregadas</Text>
            </View>
          </View>

          {/* Activate Notifications Button */}
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivateNotifications}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="notifications-outline" size={20} color="#FFF" />
                <Text style={styles.activateButtonText}>Activar Notificaciones en Este Dispositivo</Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionCard}
                onPress={() => handleQuickAction(action.id)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={styles.quickActionText}>{action.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Main Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📤 Enviar Notificación</Text>
          
          <TouchableOpacity
            style={styles.mainActionCard}
            onPress={() => setShowTemplatesModal(true)}
          >
            <View style={styles.mainActionLeft}>
              <View style={[styles.mainActionIcon, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="copy" size={24} color="#8b5cf6" />
              </View>
              <View>
                <Text style={styles.mainActionTitle}>Usar Plantilla</Text>
                <Text style={styles.mainActionSubtitle}>Mensajes predefinidos listos para enviar</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainActionCard}
            onPress={() => {
              setSelectedTemplate(null);
              setTitle('');
              setMessage('');
              setShowComposeModal(true);
            }}
          >
            <View style={styles.mainActionLeft}>
              <View style={[styles.mainActionIcon, { backgroundColor: '#3b82f620' }]}>
                <Ionicons name="create" size={24} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.mainActionTitle}>Mensaje Personalizado</Text>
                <Text style={styles.mainActionSubtitle}>Crea tu propio mensaje</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
          </TouchableOpacity>
        </View>

        {/* Recent History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📋 Historial Reciente</Text>
            {history.length > 3 && (
              <TouchableOpacity onPress={() => setShowHistoryModal(true)}>
                <Text style={styles.seeAllText}>Ver todo</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textGray} />
              <Text style={styles.emptyStateText}>No hay notificaciones enviadas</Text>
            </View>
          ) : (
            history.slice(0, 3).map((item, index) => (
              <View key={item.id || index} style={styles.historyItem}>
                <View style={styles.historyIconContainer}>
                  <Ionicons name="send" size={20} color={colors.primary} />
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.historyBody} numberOfLines={1}>{item.body}</Text>
                  <View style={styles.historyMeta}>
                    <Text style={styles.historyDate}>
                      {item.sent_at ? formatDate(item.sent_at) : 'Fecha no disponible'}
                    </Text>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>
                        {item.recipients_count || 0} enviados
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Templates Modal */}
      <Modal
        visible={showTemplatesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTemplatesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Plantillas de Notificación</Text>
            <TouchableOpacity onPress={() => setShowTemplatesModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {NOTIFICATION_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleSelectTemplate(template)}
              >
                <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                  <Ionicons name={template.icon as any} size={28} color={template.color} />
                </View>
                <View style={styles.templateContent}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateTitle}>{template.title}</Text>
                  <Text style={styles.templateBody} numberOfLines={2}>{template.body}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Compose Modal */}
      <Modal
        visible={showComposeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowComposeModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowComposeModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Componer Notificación</Text>
            <TouchableOpacity
              onPress={handleSendNotification}
              disabled={sending || !title.trim() || !message.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[
                  styles.sendButtonText,
                  (!title.trim() || !message.trim()) && styles.sendButtonDisabled
                ]}>{t('admin.sendButton', 'Enviar')}</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Segment Selector */}
            <Text style={styles.inputLabel}>Audiencia</Text>
            <View style={styles.segmentSelector}>
              {QUICK_ACTIONS.map((segment) => (
                <TouchableOpacity
                  key={segment.id}
                  style={[
                    styles.segmentOption,
                    selectedSegment === segment.id && styles.segmentOptionActive
                  ]}
                  onPress={() => setSelectedSegment(segment.id)}
                >
                  <Ionicons
                    name={segment.icon as any}
                    size={18}
                    color={selectedSegment === segment.id ? '#FFF' : colors.text}
                  />
                  <Text style={[
                    styles.segmentOptionText,
                    selectedSegment === segment.id && styles.segmentOptionTextActive
                  ]}>{segment.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Title Input */}
            <Text style={styles.inputLabel}>Título</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: 📄 Recordatorio de Documentos"
              placeholderTextColor={colors.textGray}
              maxLength={50}
            />
            <Text style={styles.charCount}>{title.length}/50</Text>

            {/* Message Input */}
            <Text style={styles.inputLabel}>Mensaje</Text>
            <TextInput
              style={[styles.textInput, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder={t('admin.messagePlaceholder', 'Escribe tu mensaje aquí...')}
              placeholderTextColor={colors.textGray}
              multiline
              numberOfLines={4}
              maxLength={200}
            />
            <Text style={styles.charCount}>{message.length}/200</Text>

            {/* Preview */}
            <Text style={styles.inputLabel}>Vista Previa</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewAppIcon}>
                  <Text style={styles.previewAppIconText}>RT</Text>
                </View>
                <Text style={styles.previewAppName}>Ross Tax</Text>
                <Text style={styles.previewTime}>ahora</Text>
              </View>
              <Text style={styles.previewTitle}>{title || 'Título de la notificación'}</Text>
              <Text style={styles.previewBody}>{message || 'El mensaje aparecerá aquí...'}</Text>
            </View>

            {/* Test Button */}
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleSendTest}
              disabled={sending || !title.trim() || !message.trim()}
            >
              <Ionicons name="flask" size={20} color={colors.primary} />
              <Text style={styles.testButtonText}>Enviar Prueba a Mi Dispositivo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Historial Completo</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {history.map((item, index) => (
              <View key={item.id || index} style={styles.historyItemFull}>
                <View style={styles.historyItemHeader}>
                  <Text style={styles.historyItemTitle}>{item.title}</Text>
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{item.recipients_count || 0}</Text>
                  </View>
                </View>
                <Text style={styles.historyItemBody}>{item.body}</Text>
                <Text style={styles.historyItemDate}>
                  {item.sent_at ? formatDate(item.sent_at) : 'Fecha no disponible'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textGray,
  },
  content: {
    flex: 1,
  },
  
  // Hero Card
  heroCard: {
    margin: 16,
    borderRadius: 20,
    padding: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Activate Button
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  activateButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },

  // Main Actions
  mainActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  mainActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mainActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  mainActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  mainActionSubtitle: {
    fontSize: 13,
    color: colors.textGray,
  },

  // History
  historyItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  historyBody: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  historyDate: {
    fontSize: 12,
    color: colors.textGray,
  },
  historyBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 12,
  },

  // Modals
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },

  // Templates
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  templateBody: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },

  // Compose Form
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'right',
    marginTop: 4,
  },

  // Segment Selector
  segmentSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  segmentOptionTextActive: {
    color: '#FFF',
  },

  // Preview
  previewCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewAppIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  previewAppIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  previewAppName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
  },
  previewTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
  },

  // Test Button
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    marginBottom: 40,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // History Modal
  historyItemFull: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  historyItemBody: {
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
    marginBottom: 10,
  },
  historyItemDate: {
    fontSize: 12,
    color: colors.textGray,
  },
});
