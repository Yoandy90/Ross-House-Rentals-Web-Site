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
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import AdminHeader from '../../components/admin/AdminHeader';
import api from '../../services/api';

interface SyncStats {
  total_users: number;
  synced_users: number;
  sync_percentage: number;
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
}

interface SyncLog {
  _id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  status: string;
  sync_timestamp: string;
  error_message?: string;
}

interface ZapierLog {
  _id: string;
  entity_type: string;
  entity_id: string;
  direction: string;
  webhook_url?: string;
  response_status?: number;
  sent_at?: string;
  received_at?: string;
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

export default function RiseCRMSyncScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'zapier'>('dashboard');
  const [zapierLogs, setZapierLogs] = useState<ZapierLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [zapierWebhookUrl, setZapierWebhookUrl] = useState('');

  const loadData = async () => {
    try {
      const promises = [
        api.get('/api/rise-crm/sync/status'),
        api.get('/api/rise-crm/sync/logs?limit=20'),
      ];

      // Load Zapier logs if on Zapier tab
      if (activeTab === 'zapier') {
        promises.push(api.get('/api/rise-crm/zapier/webhook-logs?limit=30'));
      }

      // Load appointments if on appointments tab
      if (activeTab === 'appointments') {
        promises.push(api.get('/api/appointments?limit=50'));
      }

      const results = await Promise.allSettled(promises);

      // Stats
      if (results[0].status === 'fulfilled' && results[0].value.data.success) {
        setStats(results[0].value.data.statistics);
      }

      // Logs
      if (results[1].status === 'fulfilled' && results[1].value.data.success) {
        setLogs(results[1].value.data.logs);
      }

      // Zapier logs
      if (results[2] && results[2].status === 'fulfilled') {
        const zapierData = results[2].value.data;
        if (zapierData.logs) {
          setZapierLogs(zapierData.logs);
        }
      }

      // Appointments
      if (results[2] && results[2].status === 'fulfilled') {
        const appointmentsData = results[2].value.data;
        if (Array.isArray(appointmentsData)) {
          setAppointments(appointmentsData);
        }
      }
    } catch (error: any) {
      console.error('Error loading sync data:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to load sync data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSyncAll = async (type: string) => {
    setSyncing(type);
    try {
      let endpoint = '';
      switch (type) {
        case 'users':
          endpoint = '/api/rise-crm/sync/users/all?limit=100';
          break;
        case 'documents':
          endpoint = '/api/rise-crm/sync/documents/all?limit=100';
          break;
        case 'payments':
          endpoint = '/api/rise-crm/sync/payments/all?limit=100';
          break;
      }

      const response = await api.post(endpoint);
      Alert.alert(
        'Sync Complete',
        `Total: ${response.data.total}\nSuccess: ${response.data.success}\nFailed: ${response.data.failed}`,
        [{ text: 'OK', onPress: () => loadData() }]
      );
    } catch (error: any) {
      console.error('Sync error:', error);
      Alert.alert('Sync Failed', error.response?.data?.detail || 'Failed to sync');
    } finally {
      setSyncing(null);
    }
  };

  const handleTestConnection = async () => {
    setSyncing('connection');
    try {
      const response = await api.post('/api/rise-crm/test-connection');
      Alert.alert('Connection Successful', response.data.message);
    } catch (error: any) {
      Alert.alert('Connection Failed', error.response?.data?.detail || 'Failed to connect');
    } finally {
      setSyncing(null);
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'client':
        return 'person';
      case 'document':
        return 'document';
      case 'document_request':
        return 'document-text';
      case 'loan_application':
        return 'cash';
      case 'service_request':
        return 'help-circle';
      case 'payment':
        return 'card';
      default:
        return 'sync';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'success' ? '#4CAF50' : '#F44336';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AdminHeader title="Rise CRM Sync" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading sync data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AdminHeader title="Rise CRM Sync" showBack />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        style={styles.scrollView}
      >
        {/* Statistics Card */}
        {stats && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Sync Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total_users}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Users</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#4CAF50' }]}>{stats.synced_users}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Synced</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {stats.sync_percentage.toFixed(1)}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completion</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#F44336' }]}>{stats.failed_syncs}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Failed</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Quick Actions</Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleTestConnection}
            disabled={syncing === 'connection'}
          >
            {syncing === 'connection' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Test Connection</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={() => handleSyncAll('users')}
            disabled={!!syncing}
          >
            {syncing === 'users' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="people" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Sync All Users</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => handleSyncAll('documents')}
            disabled={!!syncing}
          >
            {syncing === 'documents' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="document" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Sync All Documents</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
            onPress={() => handleSyncAll('payments')}
            disabled={!!syncing}
          >
            {syncing === 'payments' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Sync All Payments</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent Logs */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Sync Logs</Text>
          {logs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No sync logs yet</Text>
          ) : (
            logs.map((log, index) => (
              <View
                key={log._id || index}
                style={[styles.logItem, { borderBottomColor: colors.border }]}
              >
                <View style={styles.logHeader}>
                  <Ionicons
                    name={getEntityIcon(log.entity_type) as any}
                    size={20}
                    color={getStatusColor(log.status)}
                  />
                  <Text style={[styles.logEntityType, { color: colors.text }]}>
                    {log.entity_type.replace('_', ' ').toUpperCase()}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(log.status) + '20' },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(log.status) }]}>
                      {log.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.logId, { color: colors.textSecondary }]}>
                  ID: {log.entity_id?.substring(0, 20)}...
                </Text>
                <Text style={[styles.logTime, { color: colors.textSecondary }]}>
                  {new Date(log.sync_timestamp).toLocaleString()}
                </Text>
                {log.error_message && (
                  <Text style={[styles.errorText, { color: '#F44336' }]}>{log.error_message}</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  card: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  logItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logEntityType: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
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
  logId: {
    fontSize: 12,
    marginTop: 2,
  },
  logTime: {
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
});
