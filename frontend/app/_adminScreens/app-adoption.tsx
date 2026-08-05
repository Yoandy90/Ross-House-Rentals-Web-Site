import React, { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';

interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  has_app: boolean;
  last_app_access?: string;
  created_at: string;
}

export default function AppAdoption() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    with_app: 0,
    without_app: 0,
    adoption_rate: 0,
  });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.get('/admin/app-adoption');
      setClients(response.data.clients || []);
      setStats(response.data.stats || {
        total: 0,
        with_app: 0,
        without_app: 0,
        adoption_rate: 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAllWithoutApp = () => {
    const clientsWithoutApp = clients
      .filter(c => !c.has_app)
      .map(c => c.id);
    setSelectedClients(clientsWithoutApp);
  };

  const clearSelection = () => {
    setSelectedClients([]);
  };

  const sendNotification = async (method: 'email' | 'sms') => {
    if (selectedClients.length === 0) {
      Alert.alert('Atención', 'Por favor selecciona al menos un cliente');
      return;
    }

    const methodText = method === 'email' ? 'email' : 'SMS';
    Alert.alert(
      'Confirmar Envío',
      `¿Deseas enviar ${methodText} a ${selectedClients.length} cliente(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setSending(true);
            try {
              await api.post('/admin/send-app-invitation', {
                client_ids: selectedClients,
                method: method,
              });
              Alert.alert('Éxito', `${methodText} enviado(s) correctamente`);
              clearSelection();
            } catch (error: any) {
              console.error('Error sending notification:', error);
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la notificación');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: colors.backgroundGray}}>
        <AdminHeader title="Adopción de App" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando información...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: colors.backgroundGray}}>
      <AdminHeader title="Adopción de App" />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="people" size={32} color={colors.primary} />
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Clientes</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <Text style={styles.statNumber}>{stats.with_app}</Text>
            <Text style={styles.statLabel}>Con App</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.error + '15' }]}>
            <Ionicons name="close-circle" size={32} color={colors.error} />
            <Text style={styles.statNumber}>{stats.without_app}</Text>
            <Text style={styles.statLabel}>Sin App</Text>
          </View>
        </View>

        {/* Adoption Rate */}
        <View style={styles.adoptionCard}>
          <View style={styles.adoptionHeader}>
            <Text style={styles.adoptionTitle}>Tasa de Adopción</Text>
            <Text style={styles.adoptionPercentage}>{stats.adoption_rate}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${stats.adoption_rate}%` }]} />
          </View>
        </View>

        {/* Action Buttons */}
        {selectedClients.length > 0 && (
          <View style={styles.actionBar}>
            <View style={styles.selectionInfo}>
              <Text style={styles.selectionText}>
                {selectedClients.length} seleccionado(s)
              </Text>
              <TouchableOpacity onPress={clearSelection}>
                <Text style={styles.clearText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.emailButton]}
                onPress={() => sendNotification('email')}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="mail" size={20} color={colors.textWhite} />
                    <Text style={styles.actionButtonText}>Enviar Email</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.smsButton]}
                onPress={() => sendNotification('sms')}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="chatbubble" size={20} color={colors.textWhite} />
                    <Text style={styles.actionButtonText}>Enviar SMS</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Action */}
        <TouchableOpacity
          style={styles.quickSelectButton}
          onPress={selectAllWithoutApp}
        >
          <Ionicons name="people" size={20} color={colors.primary} />
          <Text style={styles.quickSelectText}>
            Seleccionar todos sin app ({stats.without_app})
          </Text>
        </TouchableOpacity>

        {/* Clients List */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Lista de Clientes</Text>
        </View>

        {clients.map((client) => (
          <TouchableOpacity
            key={client.id}
            style={[
              styles.clientCard,
              selectedClients.includes(client.id) && styles.clientCardSelected,
            ]}
            onPress={() => toggleClientSelection(client.id)}
            activeOpacity={0.7}
          >
            <View style={styles.checkbox}>
              {selectedClients.includes(client.id) && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </View>

            <View style={styles.clientInfo}>
              <View style={styles.clientHeader}>
                <Text style={styles.clientName}>{client.name}</Text>
                {client.has_app ? (
                  <View style={styles.badgeSuccess}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.badgeTextSuccess}>Con App</Text>
                  </View>
                ) : (
                  <View style={styles.badgeError}>
                    <Ionicons name="close-circle" size={16} color={colors.error} />
                    <Text style={styles.badgeTextError}>Sin App</Text>
                  </View>
                )}
              </View>

              <View style={styles.clientDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="mail-outline" size={14} color={colors.textGray} />
                  <Text style={styles.detailText}>{client.email}</Text>
                </View>
                {client.phone && (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={14} color={colors.textGray} />
                    <Text style={styles.detailText}>{client.phone}</Text>
                  </View>
                )}
                {client.has_app && client.last_app_access && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textGray} />
                    <Text style={styles.detailText}>
                      Último acceso: {new Date(client.last_app_access).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
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
    color: colors.textGray,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  adoptionCard: {
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  adoptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  adoptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  adoptionPercentage: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  actionBar: {
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  clearText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  emailButton: {
    backgroundColor: colors.primary,
  },
  smsButton: {
    backgroundColor: colors.accent,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textWhite,
  },
  quickSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '15',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  quickSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  listHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  clientCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  clientCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientInfo: {
    flex: 1,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeTextSuccess: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  badgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeTextError: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },
  clientDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: colors.textGray,
  },
  bottomSpacing: {
    height: 32,
  },
});