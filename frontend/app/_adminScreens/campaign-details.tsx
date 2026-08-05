import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';

const { width } = Dimensions.get('window');

const colors = {
  primary: '#6C1110',
  secondary: '#4682B4',
  success: '#4CAF50',
  warning: '#FFA726',
  danger: '#EF5350',
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#2C3E50',
  textGray: '#7F8C8D',
  border: '#E0E0E0',
};

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: 'Borrador', color: colors.textGray, icon: 'document-outline' },
  scheduled: { label: 'Programada', color: colors.secondary, icon: 'time-outline' },
  sending: { label: 'Enviando', color: colors.warning, icon: 'send-outline' },
  sent: { label: 'Enviada', color: colors.success, icon: 'checkmark-circle' },
  completed: { label: 'Completada', color: colors.success, icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelada', color: colors.danger, icon: 'close-circle' },
};

interface Campaign {
  _id: string;
  name: string;
  subject: string;
  preheader?: string;
  from_name?: string;
  from_email?: string;
  html_template?: string;
  html_content?: string;
  status: string;
  segment?: string;
  scheduled_at?: string;
  sent_at?: string;
  recipients_count?: number;
  sent_count?: number;
  opened_count?: number;
  clicked_count?: number;
  created_at?: string;
  updated_at?: string;
}

export default function CampaignDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCampaign();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/campaigns/${id}`);
      // The API returns { success: true, campaign: {...} }
      const campaignData = response.data.campaign || response.data;
      setCampaign(campaignData);
    } catch (error: any) {
      console.error('Error fetching campaign:', error);
      Alert.alert('Error', 'No se pudo cargar la campaña');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!campaign) return;
    
    Alert.alert(
      'Confirmar Envío',
      `¿Estás seguro de enviar la campaña "${campaign.name}" a todos los destinatarios?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar Ahora',
          style: 'destructive',
          onPress: async () => {
            try {
              setSending(true);
              await api.post(`/admin/campaigns/${id}/send`);
              Alert.alert('Éxito', 'La campaña se está enviando');
              fetchCampaign();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo enviar la campaña');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelCampaign = async () => {
    if (!campaign) return;
    
    Alert.alert(
      'Cancelar Campaña',
      `¿Estás seguro de cancelar "${campaign.name}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/admin/campaigns/${id}/cancel`);
              Alert.alert('Éxito', 'Campaña cancelada');
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'No se pudo cancelar');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando campaña...</Text>
      </View>
    );
  }

  if (!campaign) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color={colors.danger} />
        <Text style={styles.loadingText}>Campaña no encontrada</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = statusConfig[campaign.status] || statusConfig.draft;
  const canSend = ['draft', 'scheduled'].includes(campaign.status);
  const canCancel = !['sent', 'completed', 'cancelled'].includes(campaign.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[colors.primary, '#8B1A19']} style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>Detalles de Campaña</Text>
            </View>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Campaign Name & Status */}
        <View style={styles.card}>
          <Text style={styles.campaignName}>{campaign.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon as any} size={16} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Subject & Preheader */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Asunto</Text>
          <Text style={styles.cardValue}>{campaign.subject}</Text>
          
          {campaign.preheader && (
            <>
              <Text style={[styles.cardLabel, { marginTop: 16 }]}>Preheader</Text>
              <Text style={styles.cardValueSmall}>{campaign.preheader}</Text>
            </>
          )}
        </View>

        {/* From Info */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Remitente</Text>
          <Text style={styles.cardValue}>{campaign.from_name || 'Ross Tax'}</Text>
          <Text style={styles.cardValueSmall}>{campaign.from_email || 'info@rosstaxpreparation.com'}</Text>
        </View>

        {/* Stats */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color={colors.secondary} />
              <Text style={styles.statValue}>{campaign.recipients_count || 0}</Text>
              <Text style={styles.statLabel}>Destinatarios</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="send" size={24} color={colors.success} />
              <Text style={styles.statValue}>{campaign.sent_count || 0}</Text>
              <Text style={styles.statLabel}>Enviados</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="mail-open" size={24} color={colors.warning} />
              <Text style={styles.statValue}>{campaign.opened_count || 0}</Text>
              <Text style={styles.statLabel}>Abiertos</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="hand-left" size={24} color={colors.primary} />
              <Text style={styles.statValue}>{campaign.clicked_count || 0}</Text>
              <Text style={styles.statLabel}>Clicks</Text>
            </View>
          </View>
        </View>

        {/* Dates */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fechas</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.textGray} />
            <Text style={styles.dateLabel}>Creada:</Text>
            <Text style={styles.dateValue}>{formatDate(campaign.created_at)}</Text>
          </View>
          {campaign.scheduled_at && (
            <View style={styles.dateRow}>
              <Ionicons name="time-outline" size={18} color={colors.secondary} />
              <Text style={styles.dateLabel}>Programada:</Text>
              <Text style={styles.dateValue}>{formatDate(campaign.scheduled_at)}</Text>
            </View>
          )}
          {campaign.sent_at && (
            <View style={styles.dateRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
              <Text style={styles.dateLabel}>Enviada:</Text>
              <Text style={styles.dateValue}>{formatDate(campaign.sent_at)}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          {canSend && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.sendButton]}
              onPress={handleSendCampaign}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Enviar Ahora</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {canCancel && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleCancelCampaign}
            >
              <Ionicons name="close-circle" size={20} color={colors.danger} />
              <Text style={[styles.actionButtonText, { color: colors.danger }]}>Cancelar Campaña</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  header: {
    paddingBottom: 16,
  },
  headerSafe: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  campaignName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardValueSmall: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
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
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textGray,
    width: 90,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  actionsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  sendButton: {
    backgroundColor: colors.success,
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
