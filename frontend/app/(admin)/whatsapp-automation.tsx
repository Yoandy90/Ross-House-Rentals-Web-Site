import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';

const COLORS = {
  primary: '#6C1110',
  secondary: '#D4AF37',
  background: '#1a1a1a',
  surface: '#2a2a2a',
  surfaceLight: '#3a3a3a',
  text: '#FFFFFF',
  textSecondary: '#888',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#f44336',
  info: '#2196F3',
};

interface AutomationStatus {
  service_available: boolean;
  pending_24h_reminders: number;
  pending_1h_reminders: number;
  pending_invoices: number;
  recent_notifications: any[];
}

export default function WhatsAppAutomationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  // Automation toggles
  const [automations, setAutomations] = useState({
    appointmentConfirmation: true,
    appointmentReminder24h: true,
    appointmentReminder1h: true,
    documentReceived: true,
    taxReturnReady: true,
    invoiceCreated: true,
    paymentReceived: true,
  });

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get('/admin/whatsapp/automation-status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error loading automation status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStatus();
  };

  const runAppointmentReminders = async () => {
    setRunningJob('reminders');
    try {
      const response = await api.post('/admin/whatsapp/run-appointment-reminders');
      const results = response.data.results;
      Alert.alert(
        '✅ Recordatorios Enviados',
        `24h: ${results['24h_sent']} enviados, ${results['24h_failed']} fallidos\n` +
        `1h: ${results['1h_sent']} enviados, ${results['1h_failed']} fallidos`
      );
      loadStatus();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Error ejecutando recordatorios');
    } finally {
      setRunningJob(null);
    }
  };

  const runBulkPaymentReminders = async () => {
    Alert.alert(
      'Confirmar',
      '¿Enviar recordatorios de pago a todas las facturas vencidas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          style: 'destructive',
          onPress: async () => {
            setRunningJob('payments');
            try {
              const response = await api.post('/admin/whatsapp/send-bulk-payment-reminders');
              const results = response.data.results;
              Alert.alert(
                '✅ Recordatorios de Pago',
                `Enviados: ${results.sent}\nFallidos: ${results.failed}\nOmitidos: ${results.skipped}`
              );
              loadStatus();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Error enviando recordatorios');
            } finally {
              setRunningJob(null);
            }
          }
        }
      ]
    );
  };

  const sendTestMessage = async () => {
    Alert.prompt(
      'Mensaje de Prueba',
      'Ingresa el número de teléfono (10 dígitos):',
      async (phone) => {
        if (phone && phone.length >= 10) {
          try {
            const response = await api.post('/whatsapp/send', {
              phone_number: phone,
              message: '🧪 Este es un mensaje de prueba de Ross Tax App.'
            });
            if (response.data.success) {
              Alert.alert('✅ Éxito', 'Mensaje de prueba enviado');
            } else {
              Alert.alert('Error', response.data.error || 'No se pudo enviar');
            }
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Error enviando mensaje');
          }
        }
      },
      'plain-text'
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Automatización WhatsApp</Text>
      <TouchableOpacity onPress={sendTestMessage} style={styles.testButton}>
        <Ionicons name="flask" size={20} color={COLORS.secondary} />
      </TouchableOpacity>
    </View>
  );

  const renderStatusCard = () => (
    <View style={styles.statusCard}>
      <View style={styles.statusHeader}>
        <View style={[styles.statusIndicator, { backgroundColor: status?.service_available ? COLORS.success : COLORS.error }]} />
        <Text style={styles.statusTitle}>
          {status?.service_available ? 'Servicio Activo' : 'Servicio Inactivo'}
        </Text>
      </View>
      
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{status?.pending_24h_reminders || 0}</Text>
          <Text style={styles.statLabel}>Recordatorios 24h</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{status?.pending_1h_reminders || 0}</Text>
          <Text style={styles.statLabel}>Recordatorios 1h</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{status?.pending_invoices || 0}</Text>
          <Text style={styles.statLabel}>Facturas Pendientes</Text>
        </View>
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionsSection}>
      <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.primaryAction]}
        onPress={runAppointmentReminders}
        disabled={runningJob !== null}
      >
        {runningJob === 'reminders' ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <>
            <Ionicons name="alarm" size={24} color={COLORS.text} />
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Ejecutar Recordatorios de Citas</Text>
              <Text style={styles.actionSubtitle}>Envía recordatorios pendientes (24h y 1h)</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, styles.warningAction]}
        onPress={runBulkPaymentReminders}
        disabled={runningJob !== null}
      >
        {runningJob === 'payments' ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <>
            <Ionicons name="cash" size={24} color={COLORS.text} />
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Recordatorios de Pago Masivos</Text>
              <Text style={styles.actionSubtitle}>Envía a facturas vencidas</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderAutomationToggles = () => (
    <View style={styles.togglesSection}>
      <Text style={styles.sectionTitle}>🤖 Flujos Automáticos</Text>
      
      {[
        { key: 'appointmentConfirmation', icon: 'checkmark-circle', label: 'Confirmación de Citas', desc: 'Al agendar una cita' },
        { key: 'appointmentReminder24h', icon: 'alarm', label: 'Recordatorio 24h', desc: 'Un día antes de la cita' },
        { key: 'appointmentReminder1h', icon: 'time', label: 'Recordatorio 1h', desc: 'Una hora antes de la cita' },
        { key: 'documentReceived', icon: 'document', label: 'Documento Recibido', desc: 'Al subir un documento' },
        { key: 'taxReturnReady', icon: 'ribbon', label: 'Declaración Lista', desc: 'Al completar el tax return' },
        { key: 'invoiceCreated', icon: 'receipt', label: 'Factura Creada', desc: 'Al crear una factura' },
        { key: 'paymentReceived', icon: 'card', label: 'Pago Recibido', desc: 'Al procesar un pago' },
      ].map((item) => (
        <View key={item.key} style={styles.toggleItem}>
          <View style={styles.toggleLeft}>
            <Ionicons name={item.icon as any} size={24} color={COLORS.secondary} />
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleLabel}>{item.label}</Text>
              <Text style={styles.toggleDesc}>{item.desc}</Text>
            </View>
          </View>
          <Switch
            value={automations[item.key as keyof typeof automations]}
            onValueChange={(value) => setAutomations({ ...automations, [item.key]: value })}
            trackColor={{ false: COLORS.surfaceLight, true: COLORS.primary }}
            thumbColor={COLORS.text}
          />
        </View>
      ))}
    </View>
  );

  const renderRecentNotifications = () => (
    <View style={styles.recentSection}>
      <Text style={styles.sectionTitle}>📬 Notificaciones Recientes</Text>
      
      {status?.recent_notifications && status.recent_notifications.length > 0 ? (
        status.recent_notifications.map((notif, index) => (
          <View key={index} style={styles.notifItem}>
            <View style={[styles.notifIndicator, { backgroundColor: notif.status === 'sent' ? COLORS.success : COLORS.error }]} />
            <View style={styles.notifContent}>
              <Text style={styles.notifType}>{notif.notification_type}</Text>
              <Text style={styles.notifTime}>
                {notif.sent_at ? new Date(notif.sent_at).toLocaleString() : 'N/A'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No hay notificaciones recientes</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {renderStatusCard()}
        {renderActionButtons()}
        {renderAutomationToggles()}
        {renderRecentNotifications()}
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  testButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryAction: {
    backgroundColor: COLORS.primary,
  },
  warningAction: {
    backgroundColor: COLORS.warning,
  },
  actionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  togglesSection: {
    marginBottom: 24,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  toggleDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  recentSection: {
    marginBottom: 24,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  notifIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifType: {
    fontSize: 13,
    color: COLORS.text,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
});
