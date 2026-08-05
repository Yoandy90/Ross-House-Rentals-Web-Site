/**
 * My Motions Screen - Client View
 * Shows all motions requested by the client with their status
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Motion {
  id: string;
  motion_number: string;
  motion_type: string;
  motion_type_label: string;
  status: string;
  status_label: string;
  client_name: string;
  priority: string;
  deadline: string | null;
  documents_complete: boolean;
  created_at: string;
  updated_at: string | null;
}

const STATUS_COLORS: { [key: string]: { bg: string; text: string } } = {
  new: { bg: '#DBEAFE', text: '#1E40AF' },
  in_review: { bg: '#FEF3C7', text: '#92400E' },
  drafting: { bg: '#EDE9FE', text: '#5B21B6' },
  legal_review: { bg: '#FCE7F3', text: '#9D174D' },
  submitted: { bg: '#D1FAE5', text: '#065F46' },
  awaiting_response: { bg: '#E0E7FF', text: '#3730A3' },
  approved: { bg: '#D1FAE5', text: '#065F46' },
  denied: { bg: '#FEE2E2', text: '#991B1B' },
  cancelled: { bg: '#F3F4F6', text: '#374151' },
};

const STATUS_ICONS: { [key: string]: string } = {
  new: 'time-outline',
  in_review: 'search-outline',
  drafting: 'document-text-outline',
  legal_review: 'shield-checkmark-outline',
  submitted: 'send-outline',
  awaiting_response: 'hourglass-outline',
  approved: 'checkmark-circle-outline',
  denied: 'close-circle-outline',
  cancelled: 'ban-outline',
};

export default function MyMotionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [motions, setMotions] = useState<Motion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMotions = useCallback(async () => {
    try {
      const response = await api.get('/motions/my-motions');
      if (response.data?.motions) {
        setMotions(response.data.motions);
      }
    } catch (error) {
      console.error('Error loading motions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMotions();
  }, [loadMotions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMotions();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusInfo = (status: string) => {
    return STATUS_COLORS[status] || { bg: '#F3F4F6', text: '#374151' };
  };

  const renderMotionCard = (motion: Motion) => {
    const statusInfo = getStatusInfo(motion.status);
    
    return (
      <TouchableOpacity
        key={motion.id}
        style={styles.motionCard}
        onPress={() => router.push(`/(tabs)/motion-detail?id=${motion.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.motionNumber}>{motion.motion_number}</Text>
            <Text style={styles.motionType}>{motion.motion_type_label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons
              name={STATUS_ICONS[motion.status] as any || 'ellipse'}
              size={14}
              color={statusInfo.text}
            />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>
              {motion.status_label}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>Solicitado: {formatDate(motion.created_at)}</Text>
          </View>
          
          {!motion.documents_complete && (
            <View style={styles.warningRow}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>{t('myMotions.pendingDocs', 'Documentos pendientes')}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailText}>{t('myMotions.viewDetails', 'Ver detalles')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#6C1110" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6C1110" />
          <Text style={styles.loadingText}>Cargando mis mociones...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Mociones</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/motion-request')}
          style={styles.addButton}
        >
          <Ionicons name="add-circle" size={28} color="#6C1110" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6C1110']} />
        }
      >
        {/* Status Legend */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Estado de tu solicitud:</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>{t('myMotions.inProcess', 'En proceso')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>{t('myMotions.completed', 'Completado')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>{t('myMotions.requiresAction', 'Requiere acción')}</Text>
            </View>
          </View>
        </View>

        {/* Motions List */}
        {motions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>{t('myMotions.noMotions', 'No tienes mociones')}</Text>
            <Text style={styles.emptySubtitle}>
              Solicita una moción de cierre de corte para comenzar tu proceso de inmigración
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/motion-request')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Solicitar Moción</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.motionsList}>
            {motions.map(renderMotionCard)}
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Ionicons name="help-circle-outline" size={24} color="#6C1110" />
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>¿Tienes preguntas?</Text>
            <Text style={styles.helpText}>
              Contacta a nuestro equipo para más información sobre tu moción
            </Text>
          </View>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => router.push('/(tabs)/support')}
          >
            <Text style={styles.helpButtonText}>{t('myMotions.contact', 'Contactar')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  addButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  legendContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  motionsList: {
    paddingHorizontal: 16,
  },
  motionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  motionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  motionType: {
    fontSize: 13,
    color: '#6C1110',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 4,
  },
  viewDetailText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C1110',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C1110',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  helpContent: {
    flex: 1,
    marginLeft: 12,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  helpText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  helpButton: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  helpButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C1110',
  },
});
