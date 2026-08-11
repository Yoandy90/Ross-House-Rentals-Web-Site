import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, useColors } from '../src/constants/theme';

export default function StripeConnectScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, payoutsRes] = await Promise.all([
        apiCall('/owner/connect/status'),
        apiCall('/owner/payouts'),
      ]);
      if (statusRes.success) setConnectStatus(statusRes);
      if (payoutsRes.success) {
        setPayouts(payoutsRes.payouts || []);
        setStats(payoutsRes.stats || {});
      }
    } catch (err) {
      console.log('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOnboard = async () => {
    setOnboarding(true);
    try {
      const result = await apiCall('/owner/connect/onboard', {
        method: 'POST',
        body: {
          return_url: 'rosshouserentals://owner/connect/complete',
          refresh_url: 'rosshouserentals://owner/connect/refresh',
        },
      });

      if (result.success && result.onboarding_url) {
        await Linking.openURL(result.onboarding_url);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar el proceso');
    } finally {
      setOnboarding(false);
    }
  };

  const getStatusIcon = () => {
    if (!connectStatus) return { icon: 'link-outline', color: C.textMuted, bg: 'rgba(156,163,175,0.1)' };
    switch (connectStatus.status) {
      case 'active': return { icon: 'checkmark-circle', color: C.success, bg: 'rgba(34,197,94,0.1)' };
      case 'pending_verification': return { icon: 'time', color: C.warmGold, bg: 'rgba(245,158,11,0.1)' };
      case 'incomplete': return { icon: 'alert-circle', color: C.warning, bg: 'rgba(245,158,11,0.1)' };
      default: return { icon: 'link-outline', color: C.textMuted, bg: 'rgba(156,163,175,0.1)' };
    }
  };

  const formatCurrency = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatDate = (d: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-US', { month: 'short', day: 'numeric' }); } catch { return d; }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.brandRed} />
      </View>
    );
  }

  const isConnected = connectStatus?.connected && connectStatus?.status === 'active';
  const statusInfo = getStatusIcon();

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={C.brandRed} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stripe Connect</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Connection Status Card */}
      <View style={[styles.statusCard, { borderColor: isConnected ? 'rgba(34,197,94,0.3)' : C.border }]}>
        <View style={[styles.statusIcon, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon as any} size={32} color={statusInfo.color} />
        </View>

        {!connectStatus?.connected ? (
          <>
            <Text style={styles.statusTitle}>Conecta tu cuenta bancaria</Text>
            <Text style={styles.statusDesc}>
              Recibe automáticamente tus pagos de renta directamente en tu cuenta bancaria. 
              Ross House Rentals deduce la comisión de administración y te deposita el resto.
            </Text>
            <TouchableOpacity
              style={styles.connectBtn}
              onPress={handleOnboard}
              disabled={onboarding}
              activeOpacity={0.7}
            >
              {onboarding ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Ionicons name="link" size={20} color={C.white} />
                  <Text style={styles.connectBtnText}>Conectar con Stripe</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : connectStatus.status === 'active' ? (
          <>
            <Text style={styles.statusTitle}>Cuenta Activa</Text>
            <Text style={styles.statusDesc}>Tu cuenta está verificada y puede recibir pagos automáticamente.</Text>
            <View style={styles.activeBadge}>
              <Ionicons name="shield-checkmark" size={14} color={C.success} />
              <Text style={styles.activeBadgeText}>Verificada</Text>
            </View>
          </>
        ) : connectStatus.status === 'pending_verification' ? (
          <>
            <Text style={styles.statusTitle}>Verificación en progreso</Text>
            <Text style={styles.statusDesc}>Stripe está verificando tu información. Esto puede tomar 1-2 días hábiles.</Text>
          </>
        ) : (
          <>
            <Text style={styles.statusTitle}>Configuración incompleta</Text>
            <Text style={styles.statusDesc}>Necesitas completar la verificación de tu cuenta.</Text>
            <TouchableOpacity style={styles.connectBtn} onPress={handleOnboard} disabled={onboarding}>
              <Ionicons name="refresh" size={20} color={C.white} />
              <Text style={styles.connectBtnText}>Completar verificación</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Stats Cards */}
      {isConnected && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(stats.total_earned)}</Text>
            <Text style={styles.statLabel}>Total Recibido</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: C.warmGold }]}>{formatCurrency(stats.total_commission)}</Text>
            <Text style={styles.statLabel}>Comisiones</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: C.textSecondary }]}>{stats.total_payouts || 0}</Text>
            <Text style={styles.statLabel}>Pagos</Text>
          </View>
        </View>
      )}

      {/* How it works (for non-connected) */}
      {!isConnected && (
        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>¿Cómo funciona?</Text>
          {[
            { icon: 'person-add', text: 'El inquilino paga su renta por la app' },
            { icon: 'calculator', text: 'Ross House descuenta la comisión de administración (10%)' },
            { icon: 'cash', text: 'El resto se deposita automáticamente en tu banco' },
            { icon: 'notifications', text: 'Recibes notificación de cada depósito' },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{i + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Ionicons name={step.icon as any} size={18} color={C.brandRed} />
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Payout History */}
      {payouts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de Pagos</Text>
          {payouts.map((p, i) => (
            <View key={p.id || i} style={styles.payoutRow}>
              <View style={styles.payoutLeft}>
                <Ionicons
                  name={p.status === 'completed' ? 'checkmark-circle' : 'time'}
                  size={20}
                  color={p.status === 'completed' ? C.success : C.warmGold}
                />
                <View>
                  <Text style={styles.payoutAddress} numberOfLines={1}>{p.property_address || 'Propiedad'}</Text>
                  <Text style={styles.payoutMeta}>{p.tenant_name} • {p.period || formatDate(p.created_at)}</Text>
                </View>
              </View>
              <View style={styles.payoutRight}>
                <Text style={styles.payoutAmount}>{formatCurrency(p.net_amount)}</Text>
                <Text style={styles.payoutCommission}>-{formatCurrency(p.commission)} comisión</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },

  statusCard: {
    marginHorizontal: Spacing.base,
    marginBottom: 16,
    padding: 24,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary, marginBottom: 8 },
  statusDesc: { fontSize: FontSizes.sm, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#635BFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.md,
    width: '100%',
  },
  connectBtnText: { fontSize: FontSizes.md, color: C.white, fontWeight: '700' },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  activeBadgeText: { fontSize: FontSizes.sm, color: C.success, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    padding: 14,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSizes.md, fontWeight: '700', color: C.success },
  statLabel: { fontSize: 10, color: C.textMuted, marginTop: 4, textTransform: 'uppercase' },

  howItWorks: {
    marginHorizontal: Spacing.base,
    marginBottom: 16,
    padding: Spacing.base,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.brandRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: { fontSize: FontSizes.xs, color: C.white, fontWeight: '700' },
  stepContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepText: { flex: 1, fontSize: FontSizes.sm, color: C.textSecondary, lineHeight: 18 },

  section: {
    marginHorizontal: Spacing.base,
    marginBottom: 16,
    padding: Spacing.base,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  payoutLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  payoutAddress: { fontSize: FontSizes.sm, fontWeight: '600', color: C.textPrimary },
  payoutMeta: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  payoutRight: { alignItems: 'flex-end' },
  payoutAmount: { fontSize: FontSizes.sm, fontWeight: '700', color: C.success },
  payoutCommission: { fontSize: 10, color: C.textMuted, marginTop: 2 },
});
