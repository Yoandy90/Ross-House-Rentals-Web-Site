import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import CustomHeader from '../../components/CustomHeader';
import api from '../../services/api';

interface ZapierLog {
  _id: string;
  entity_type: string;
  entity_id: string;
  direction: string;
  webhook_url?: string;
  response_status?: number;
  sent_at?: string;
  received_at?: string;
  payload?: any;
}

interface Appointment {
  id: string;
  user_id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  rise_crm_project_id?: string;
  rise_synced_at?: string;
}

export default function RiseSyncPanelScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'zapier'>('dashboard');
  const [zapierLogs, setZapierLogs] = useState<ZapierLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState('');
  const [stats, setStats] = useState<any>(null);

  const loadData = async () => {
    try {
      if (activeTab === 'zapier') {
        const logsRes = await api.get('/api/rise-crm/zapier/webhook-logs?limit=30');
        if (logsRes.data.logs) {
          setZapierLogs(logsRes.data.logs);
        }
      } else if (activeTab === 'appointments') {
        const apptRes = await api.get('/api/appointments?limit=100');
        if (Array.isArray(apptRes.data)) {
          setAppointments(apptRes.data);
        }
      } else {
        // Dashboard - load stats
        try {
          const statsRes = await api.get('/api/rise-crm/sync/status');
          if (statsRes.data.success) {
            setStats(statsRes.data.statistics);
          }
        } catch (err) {
          console.log('Stats not available');
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSyncAppointment = async (appointmentId: string) => {
    if (!zapierWebhookUrl) {
      Alert.alert(
        'Webhook URL Requerida',
        'Por favor ingresa tu URL de webhook de Zapier primero',
        [{ text: 'OK' }]
      );
      return;
    }

    setSyncing(appointmentId);
    try {
      const response = await api.post('/api/rise-crm/zapier/send-appointment', {
        appointment_id: appointmentId,
        zapier_webhook_url: zapierWebhookUrl,
      });

      Alert.alert('Éxito', 'Cita enviada a Zapier correctamente', [
        { text: 'OK', onPress: () => loadData() },
      ]);
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Error al sincronizar');
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAllAppointments = async () => {
    if (!zapierWebhookUrl) {
      Alert.alert(
        'Webhook URL Requerida',
        'Por favor ingresa tu URL de webhook de Zapier primero',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirmar',
      `¿Sincronizar ${appointments.length} citas a Zapier?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sincronizar',
          onPress: async () => {
            setSyncing('all');
            let success = 0;
            let failed = 0;

            for (const appt of appointments) {
              if (!appt.rise_crm_project_id) {
                try {
                  await api.post('/api/rise-crm/zapier/send-appointment', {
                    appointment_id: appt.id,
                    zapier_webhook_url: zapierWebhookUrl,
                  });
                  success++;
                } catch (error) {
                  failed++;
                }
              }
            }

            setSyncing(null);
            Alert.alert(
              'Sincronización Completa',
              `Exitosas: ${success}\nFallidas: ${failed}`,
              [{ text: 'OK', onPress: () => loadData() }]
            );
          },
        },
      ]
    );
  };

  const renderTabBar = () => (
    <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'dashboard' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
        ]}
        onPress={() => setActiveTab('dashboard')}
      >
        <Ionicons
          name="stats-chart"
          size={20}
          color={activeTab === 'dashboard' ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'dashboard' ? colors.primary : colors.textSecondary },
          ]}
        >
          Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'appointments' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
        ]}
        onPress={() => setActiveTab('appointments')}
      >
        <Ionicons
          name="calendar"
          size={20}
          color={activeTab === 'appointments' ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'appointments' ? colors.primary : colors.textSecondary },
          ]}
        >
          Citas
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'zapier' && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
        ]}
        onPress={() => setActiveTab('zapier')}
      >
        <Ionicons
          name="flash"
          size={20}
          color={activeTab === 'zapier' ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.tabText,
            { color: activeTab === 'zapier' ? colors.primary : colors.textSecondary },
          ]}
        >
          Zapier Logs
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDashboard = () => (
    <View style={styles.content}>
      {stats ? (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>📊 Estadísticas de Sincronización</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total_users}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Usuarios</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.synced_users}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sincronizados</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F44336' }]}>{stats.failed_syncs}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fallidos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {stats.sync_percentage?.toFixed(1)}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completado</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🎯 Panel de Sincronización</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Gestiona la sincronización entre Ross Tax y Rise CRM usando Zapier.
          </Text>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Selecciona una pestaña arriba para comenzar a sincronizar citas o ver los logs de Zapier.
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>📚 Documentación</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Consulta las guías de configuración:
        </Text>
        <View style={styles.docLinks}>
          <Text style={[styles.docLink, { color: colors.primary }]}>
            • CONFIGURACION_ZAPIER_PASO_A_PASO.md
          </Text>
          <Text style={[styles.docLink, { color: colors.primary }]}>
            • ZAPIER_INTEGRATION_GUIDE.md
          </Text>
        </View>
      </View>
    </View>
  );

  const renderAppointments = () => (
    <View style={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>⚙️ Configuración Zapier</Text>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
          Webhook URL de Zapier:
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          placeholderTextColor={colors.textSecondary}
          value={zapierWebhookUrl}
          onChangeText={setZapierWebhookUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.syncAllButton, { backgroundColor: colors.primary }]}
          onPress={handleSyncAllAppointments}
          disabled={syncing === 'all' || !zapierWebhookUrl}
        >
          {syncing === 'all' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sync" size={20} color="#fff" />
              <Text style={styles.buttonText}>Sincronizar Todas las Citas</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          📅 Citas ({appointments.length})
        </Text>
        {appointments.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No hay citas para sincronizar
          </Text>
        ) : (
          appointments.map((appt) => (
            <View key={appt.id} style={[styles.appointmentItem, { borderBottomColor: colors.border }]}>
              <View style={styles.appointmentHeader}>
                <View style={styles.appointmentInfo}>
                  <Text style={[styles.appointmentDate, { color: colors.text }]}>
                    {appt.date} - {appt.time}
                  </Text>
                  <Text style={[styles.appointmentType, { color: colors.textSecondary }]}>
                    {appt.type || 'Tax Consultation'}
                  </Text>
                </View>
                {appt.rise_crm_project_id ? (
                  <View style={[styles.syncedBadge, { backgroundColor: '#4CAF50' + '20' }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={[styles.syncedText, { color: '#4CAF50' }]}>Sincronizada</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.syncButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleSyncAppointment(appt.id)}
                    disabled={syncing === appt.id || !zapierWebhookUrl}
                  >
                    {syncing === appt.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={16} color="#fff" />
                        <Text style={styles.syncButtonText}>Sincronizar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.appointmentId, { color: colors.textSecondary }]}>
                ID: {appt.id.substring(0, 20)}...
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderZapierLogs = () => (
    <View style={styles.content}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          ⚡ Logs de Zapier ({zapierLogs.length})
        </Text>
        {zapierLogs.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No hay logs de Zapier todavía
          </Text>
        ) : (
          zapierLogs.map((log, index) => (
            <View key={log._id || index} style={[styles.logItem, { borderBottomColor: colors.border }]}>
              <View style={styles.logHeader}>
                <Ionicons
                  name={log.direction === 'rosstax_to_zapier' ? 'arrow-forward' : 'arrow-back'}
                  size={20}
                  color={log.response_status === 200 ? '#4CAF50' : '#F44336'}
                />
                <Text style={[styles.logType, { color: colors.text }]}>
                  {log.entity_type?.toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        log.response_status === 200 ? '#4CAF50' + '20' : '#F44336' + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: log.response_status === 200 ? '#4CAF50' : '#F44336' },
                    ]}
                  >
                    {log.response_status || 'Pending'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.logDirection, { color: colors.textSecondary }]}>
                {log.direction === 'rosstax_to_zapier'
                  ? '📤 Ross Tax → Zapier'
                  : '📥 Zapier → Ross Tax'}
              </Text>
              <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                {log.sent_at
                  ? new Date(log.sent_at).toLocaleString('es-ES')
                  : log.received_at
                  ? new Date(log.received_at).toLocaleString('es-ES')
                  : 'N/A'}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <CustomHeader title="Rise CRM Sync" onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <CustomHeader title="Rise CRM Sync Panel" onBack={() => router.back()} />
      {renderTabBar()}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'appointments' && renderAppointments()}
        {activeTab === 'zapier' && renderZapierLogs()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  docLinks: {
    gap: 8,
  },
  docLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  syncAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  appointmentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  appointmentType: {
    fontSize: 14,
  },
  appointmentId: {
    fontSize: 12,
    marginTop: 4,
  },
  syncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    padding: 24,
  },
  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  logType: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  logDirection: {
    fontSize: 14,
    marginBottom: 4,
  },
  logTime: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
