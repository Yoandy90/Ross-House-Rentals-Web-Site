import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import {
  plaidCreate, plaidOpen, isPlaidAvailable, PlaidIOSPresentation, PlaidLogLevel,
} from '../utils/plaidLink';

const W = Dimensions.get('window').width;

// ─── Types ───
interface Account { name: string; mask: string; type: string; subtype: string; current_balance: number; available_balance: number | null; institution: string; item_id?: string; account_id?: string; }
interface Category { key: string; label: string; emoji: string; color: string; amount: number; count: number; percentage: number; }
interface Transaction { transaction_id: string; name: string; merchant_name: string; amount: number; date: string; category: string; category_label: string; category_emoji: string; category_color: string; institution_name: string; }
interface DashboardData { has_accounts: boolean; accounts: Account[]; total_balance: number; summary: { income: number; expenses: number; net: number; transaction_count: number } | null; categories: Category[]; recent_transactions: Transaction[]; trend: { expense_change: number; income_change: number; expense_direction: string; income_direction: string } | null; month: string; linked_accounts: number; }

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1000) return '$' + (abs / 1000).toFixed(1) + 'k';
  return '$' + abs.toFixed(0);
};

const CATEGORY_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#84CC16'];

export default function MyFinancesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);

  const FREE_TXN_LIMIT = 5;
  const FREE_CAT_LIMIT = 3;

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, subRes, monthRes] = await Promise.all([
        api.get('/my-finances/dashboard'),
        api.get('/payments/subscription').catch(() => ({ data: null })),
        api.get('/my-finances/monthly-summary').catch(() => ({ data: null })),
      ]);
      if (dashRes.data.success) setData(dashRes.data);
      if (monthRes.data?.success) setMonthlyData(monthRes.data.months || []);
      const sub = subRes.data;
      setIsPro(!!(sub && (sub.status === 'active' || sub.subscription?.status === 'active' || sub.has_subscription)));
    } catch (e) { console.error('Finance dashboard error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const onRefresh = async () => { setRefreshing(true); await loadDashboard(); setRefreshing(false); };

  const syncTransactions = async (forceRefresh = false) => {
    setSyncing(true);
    try {
      const res = await api.post('/plaid/sync-transactions', { context: 'personal', force_refresh: forceRefresh });
      const d = res.data;
      const total = d.total_changes || d.transactions_added || 0;
      if (total > 0) {
        const parts = [];
        if (d.transactions_added > 0) parts.push(`${d.transactions_added} nuevas`);
        if (d.transactions_modified > 0) parts.push(`${d.transactions_modified} actualizadas`);
        if (d.transactions_removed > 0) parts.push(`${d.transactions_removed} eliminadas`);
        Alert.alert('✅ Sincronizado', parts.join(', '));
        await loadDashboard();
      } else {
        Alert.alert('✅ Al día', d.message || 'No hay transacciones nuevas. Los bancos pueden tardar 24-48h en reportar transacciones recientes.');
      }
    } catch { Alert.alert('Error', 'No se pudieron sincronizar'); }
    setSyncing(false);
  };

  const handleSyncLongPress = () => {
    Alert.alert(
      '🔄 Forzar Sincronización',
      'Esto reinicia el cursor de Plaid y vuelve a descargar todas las transacciones. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Forzar Sync', style: 'destructive', onPress: () => syncTransactions(true) }
      ]
    );
  };

  const connectBank = async () => {
    if (!isPlaidAvailable) { Alert.alert('📱 Solo en iOS/Android', 'La conexión bancaria solo está disponible en la app nativa.'); return; }
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('💰 Cuenta Personal', 'Finanzas Personales es para tus cuentas bancarias personales.\n\n¿Esta es tu cuenta personal?',
        [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) }, { text: 'Sí, es personal', onPress: () => resolve(true) }]);
    });
    if (!confirmed) return;
    setPlaidLoading(true);
    try {
      const res = await api.post('/plaid/create-link-token');
      if (!res.data.link_token) { setPlaidLoading(false); return; }
      await plaidCreate({ token: res.data.link_token, noLoadingState: false, logLevel: PlaidLogLevel.ERROR });
      plaidOpen({
        onSuccess: async (success: any) => {
          setPlaidLoading(false);
          try {
            await api.post('/plaid/exchange-token', { public_token: success.publicToken, institution: success.metadata?.institution, context: 'personal' });
            Alert.alert('✅ ¡Conectado!', 'Tu cuenta bancaria fue vinculada exitosamente.');
            await syncTransactions(); await loadDashboard();
          } catch (e: any) {
            const detail = e?.response?.data?.detail || '';
            if (detail.startsWith('BUSINESS_ACCOUNT_DETECTED')) {
              Alert.alert('🏢 Cuenta de Negocio Detectada', 'Para cuentas de negocio, usa "Mi Negocio".');
            } else Alert.alert('Error', 'No se pudo vincular la cuenta.');
          }
        },
        onExit: () => { setPlaidLoading(false); },
        iOSPresentationStyle: PlaidIOSPresentation.MODAL, logLevel: PlaidLogLevel.ERROR,
      });
    } catch { setPlaidLoading(false); Alert.alert('Error', 'No se pudo iniciar la conexión.'); }
  };

  const disconnectAccount = async (acct: Account) => {
    Alert.alert(
      '⚠️ Desconectar Cuenta',
      `¿Estás seguro que deseas desconectar "${acct.name}" de ${acct.institution}?\n\nSe eliminarán las transacciones asociadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar', style: 'destructive',
          onPress: async () => {
            try {
              // Find the plaid item_id for this account
              const res = await api.delete(`/plaid/accounts/${acct.item_id || acct.account_id}`);
              if (res.data.success !== false) {
                Alert.alert('✅ Desconectada', 'La cuenta ha sido desconectada.');
                await loadDashboard();
              }
            } catch (e: any) {
              Alert.alert('Error', 'No se pudo desconectar la cuenta.');
            }
          },
        },
      ]
    );
  };

  const updateBankAuth = async () => {
    if (!isPlaidAvailable) { Alert.alert('📱 Solo en iOS/Android', 'Esta función solo está disponible en la app nativa.'); return; }
    setPlaidLoading(true);
    try {
      const res = await api.post('/plaid/update-link-token', { context: 'personal' });
      if (!res.data.link_token) { setPlaidLoading(false); return; }
      await plaidCreate({ token: res.data.link_token, noLoadingState: false, logLevel: PlaidLogLevel.ERROR });
      plaidOpen({
        onSuccess: async () => {
          // After re-auth, fetch and save banking data
          try {
            await api.post('/plaid/fetch-my-auth', { context: 'personal' });
          } catch {}
          setPlaidLoading(false);
          Alert.alert('✅ Actualizado', 'Permisos y datos bancarios guardados.');
          await loadDashboard();
        },
        onExit: () => { setPlaidLoading(false); },
        iOSPresentationStyle: PlaidIOSPresentation.MODAL, logLevel: PlaidLogLevel.ERROR,
      });
    } catch { setPlaidLoading(false); Alert.alert('Error', 'No se pudo actualizar.'); }
  };

  // ── Loading ──
  if (loading) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={{ marginTop: 12, color: '#94A3B8', fontSize: 14 }}>Cargando tus finanzas...</Text>
    </View>
  );

  // ── Empty State ──
  if (!data?.has_accounts) return (
    <View style={s.container}>
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} style={[s.emptyHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.emptyHeaderTitle}>Finanzas Personales</Text>
        <View style={{ width: 22 }} />
      </LinearGradient>
      <ScrollView contentContainerStyle={s.emptyContent}>
        <LinearGradient colors={['#EEF2FF', '#E0E7FF']} style={s.emptyIconWrap}>
          <Text style={{ fontSize: 56 }}>💰</Text>
        </LinearGradient>
        <Text style={s.emptyTitle}>Tu Centro Financiero</Text>
        <Text style={s.emptySubtitle}>Conecta tu banco para ver ingresos, gastos y a dónde va tu dinero cada mes.</Text>
        {[{ icon: '📊', text: 'Dashboard de ingresos y gastos' }, { icon: '🏷️', text: 'Categorización automática' }, { icon: '📈', text: 'Tendencias mensuales' }, { icon: '🔒', text: 'Cifrado bancario de nivel enterprise' }].map((f, i) => (
          <View key={i} style={s.emptyFeature}>
            <Text style={{ fontSize: 18 }}>{f.icon}</Text>
            <Text style={s.emptyFeatureText}>{f.text}</Text>
          </View>
        ))}
        <TouchableOpacity style={s.emptyConnectBtn} onPress={connectBank} disabled={plaidLoading}>
          {plaidLoading ? <ActivityIndicator color="#fff" /> : (<>
            <Ionicons name="link-outline" size={20} color="#fff" />
            <Text style={s.emptyConnectText}>Conectar Mi Banco</Text>
          </>)}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // ── Dashboard ──
  const d = data!;
  const income = d.summary?.income || 0;
  const expenses = d.summary?.expenses || 0;
  const net = d.summary?.net || 0;
  const healthScore = income > 0 ? Math.min(Math.round(((income - expenses) / income) * 100), 100) : 0;
  const healthLabel = healthScore >= 20 ? 'Excelente' : healthScore >= 0 ? 'Buena' : healthScore >= -20 ? 'Regular' : 'Necesita Atención';
  const healthColor = healthScore >= 20 ? '#10B981' : healthScore >= 0 ? '#F59E0B' : '#EF4444';
  const maxCat = d.categories.length > 0 ? d.categories[0].amount : 1;

  return (
    <View style={s.container}>
      {/* ── Premium Header ── */}
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.headerTitle}>Finanzas Personales</Text>
            <Text style={s.headerMonth}>{d.month}</Text>
          </View>
          <TouchableOpacity onPress={() => syncTransactions(false)} onLongPress={handleSyncLongPress} disabled={syncing} style={s.headerBtn}>
            {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <View style={s.balanceSection}>
          <Text style={s.balanceLabel}>Balance Total</Text>
          <Text style={s.balanceAmount}>{fmt(d.total_balance)}</Text>
          <Text style={s.balanceAccts}>{d.linked_accounts} cuenta{d.linked_accounts !== 1 ? 's' : ''} conectada{d.linked_accounts !== 1 ? 's' : ''}</Text>
        </View>

        {/* Health Indicator */}
        {d.summary && (
          <View style={s.healthRow}>
            <View style={[s.healthBadge, { backgroundColor: healthColor + '30' }]}>
              <View style={[s.healthDot, { backgroundColor: healthColor }]} />
              <Text style={[s.healthText, { color: healthColor }]}>{healthLabel}</Text>
            </View>
            <Text style={s.healthScore}>Ahorro: {healthScore}%</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Accounts Strip ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.acctStrip} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          {d.accounts.map((acct, i) => (
            <TouchableOpacity key={i} onLongPress={() => disconnectAccount(acct)} activeOpacity={0.9} delayLongPress={600}>
              <LinearGradient colors={i % 2 === 0 ? ['#1E293B', '#334155'] : ['#1E3A5F', '#1E40AF']} style={s.acctCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={s.acctInst} numberOfLines={1}>{acct.institution}</Text>
                <Text style={s.acctBal}>{fmt(acct.current_balance)}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.acctMask}>{acct.name} ···{acct.mask}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Mantener para opciones</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={s.addAcctCard} onPress={connectBank}>
            <Ionicons name="add-circle-outline" size={28} color="#6366F1" />
            <Text style={s.addAcctText}>Agregar Cuenta</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Quick Actions ── */}
        <View style={s.actionsRow}>
          {[
            { icon: 'list-outline' as const, label: 'Transacciones', color: '#3B82F6', onPress: () => router.push('/finance-transactions' as any) },
            { icon: 'star-outline' as const, label: 'Suscripción', color: '#8B5CF6', onPress: () => router.push('/finance-subscription' as any) },
            { icon: 'shield-checkmark-outline' as const, label: 'Permisos', color: '#10B981', onPress: updateBankAuth },
            { icon: 'refresh-outline' as const, label: 'Sincronizar', color: '#F59E0B', onPress: syncTransactions },
          ].map((a, i) => (
            <TouchableOpacity key={i} style={s.actionItem} onPress={a.onPress} disabled={syncing || plaidLoading}>
              <View style={[s.actionIcon, { backgroundColor: a.color + '15' }]}>
                <Ionicons name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={s.actionLabel} numberOfLines={1}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Income / Expenses Cards ── */}
        {d.summary && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={s.statHeader}>
                <View style={[s.statDot, { backgroundColor: '#10B981' }]} />
                <Text style={s.statLabel}>Ingresos</Text>
              </View>
              <Text style={[s.statAmount, { color: '#10B981' }]}>{fmt(income)}</Text>
              {isPro && d.trend && (
                <View style={s.trendChip}>
                  <Ionicons name={d.trend.income_direction === 'up' ? 'trending-up' : 'trending-down'} size={12} color={d.trend.income_direction === 'up' ? '#10B981' : '#EF4444'} />
                  <Text style={[s.trendText, { color: d.trend.income_direction === 'up' ? '#10B981' : '#EF4444' }]}>{Math.abs(d.trend.income_change)}%</Text>
                </View>
              )}
            </View>
            <View style={s.statCard}>
              <View style={s.statHeader}>
                <View style={[s.statDot, { backgroundColor: '#EF4444' }]} />
                <Text style={s.statLabel}>Gastos</Text>
              </View>
              <Text style={[s.statAmount, { color: '#EF4444' }]}>{fmt(expenses)}</Text>
              {isPro && d.trend && (
                <View style={s.trendChip}>
                  <Ionicons name={d.trend.expense_direction === 'up' ? 'trending-up' : 'trending-down'} size={12} color={d.trend.expense_direction === 'down' ? '#10B981' : '#EF4444'} />
                  <Text style={[s.trendText, { color: d.trend.expense_direction === 'down' ? '#10B981' : '#EF4444' }]}>{Math.abs(d.trend.expense_change)}%</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Net Result ── */}
        {d.summary && (
          <View style={[s.netCard, { backgroundColor: net >= 0 ? '#F0FDF4' : '#FEF2F2', borderColor: net >= 0 ? '#BBF7D0' : '#FECACA' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.netLabel, { color: net >= 0 ? '#166534' : '#991B1B' }]}>
                {net >= 0 ? '✅ Estás ahorrando' : '⚠️ Gastas más de lo que ganas'}
              </Text>
              <Text style={[s.netSub, { color: net >= 0 ? '#15803D' : '#DC2626' }]}>
                {net >= 0 ? 'Sigue así, tu salud financiera es positiva' : 'Revisa tus gastos y busca oportunidades de ahorro'}
              </Text>
            </View>
            <Text style={[s.netAmount, { color: net >= 0 ? '#16A34A' : '#DC2626' }]}>{net >= 0 ? '+' : '-'}{fmt(net)}</Text>
          </View>
        )}

        {/* ── 6 Month Chart ── */}
        {isPro && monthlyData.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Últimos 6 Meses</Text>
            <View style={s.chartWrap}>
              <View style={s.chartBars}>
                {(() => {
                  const maxVal = Math.max(...monthlyData.map(m => Math.max(m.income, m.expenses)), 1);
                  return monthlyData.map((m, i) => {
                    const incH = Math.max((m.income / maxVal) * 90, 4);
                    const expH = Math.max((m.expenses / maxVal) * 90, 4);
                    return (
                      <View key={i} style={s.chartCol}>
                        <View style={s.chartBarGroup}>
                          <LinearGradient colors={['#10B981', '#059669']} style={[s.chartBar, { height: incH }]} />
                          <LinearGradient colors={['#EF4444', '#DC2626']} style={[s.chartBar, { height: expH }]} />
                        </View>
                        <Text style={s.chartLabel}>{m.month}</Text>
                      </View>
                    );
                  });
                })()}
              </View>
              <View style={s.chartLegend}>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#10B981' }]} /><Text style={s.legendText}>Ingresos</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={s.legendText}>Gastos</Text></View>
              </View>
            </View>
          </View>
        )}
        {!isPro && monthlyData.length > 0 && (
          <TouchableOpacity style={s.lockedSection} onPress={() => router.push('/finance-subscription' as any)}>
            <Ionicons name="lock-closed" size={18} color="#6366F1" />
            <Text style={s.lockedText}>Gráfica de tendencias — disponible con Pro</Text>
          </TouchableOpacity>
        )}

        {/* ── Category Breakdown ── */}
        {d.categories.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>¿En qué gastas?</Text>
            {(isPro ? d.categories : d.categories.slice(0, FREE_CAT_LIMIT)).map((cat, i) => (
              <View key={cat.key} style={s.catRow}>
                <View style={[s.catIcon, { backgroundColor: (CATEGORY_COLORS[i % CATEGORY_COLORS.length]) + '18' }]}>
                  <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.catTop}>
                    <Text style={s.catLabel}>{cat.label}</Text>
                    <Text style={s.catAmount}>{fmt(cat.amount)}</Text>
                  </View>
                  <View style={s.catBarBg}>
                    <LinearGradient colors={[CATEGORY_COLORS[i % CATEGORY_COLORS.length], CATEGORY_COLORS[i % CATEGORY_COLORS.length] + 'AA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.catBarFill, { width: `${Math.max((cat.amount / maxCat) * 100, 8)}%` }]} />
                  </View>
                  <Text style={s.catMeta}>{cat.percentage}% · {cat.count} transacción{cat.count !== 1 ? 'es' : ''}</Text>
                </View>
              </View>
            ))}
            {!isPro && d.categories.length > FREE_CAT_LIMIT && (
              <TouchableOpacity style={s.lockedSection} onPress={() => router.push('/finance-subscription' as any)}>
                <Ionicons name="lock-closed" size={16} color="#6366F1" />
                <Text style={s.lockedText}>+{d.categories.length - FREE_CAT_LIMIT} categorías con Pro</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Recent Transactions ── */}
        {d.recent_transactions.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Últimas Transacciones</Text>
              <Text style={s.sectionBadge}>{d.summary?.transaction_count || 0}</Text>
            </View>
            {(isPro ? d.recent_transactions.slice(0, 8) : d.recent_transactions.slice(0, FREE_TXN_LIMIT)).map((txn) => (
              <View key={txn.transaction_id} style={s.txnRow}>
                <View style={[s.txnIcon, { backgroundColor: txn.category_color + '18' }]}>
                  <Text style={{ fontSize: 16 }}>{txn.category_emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txnName} numberOfLines={1}>{txn.merchant_name || txn.name}</Text>
                  <Text style={s.txnMeta}>{txn.date} · {txn.category_label}</Text>
                </View>
                <Text style={[s.txnAmount, { color: txn.amount < 0 ? '#10B981' : '#1E293B' }]}>{txn.amount < 0 ? '+' : '-'}{fmt(txn.amount)}</Text>
              </View>
            ))}
            {isPro && (
              <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/finance-transactions' as any)}>
                <Ionicons name="list-outline" size={18} color="#6366F1" />
                <Text style={s.viewAllText}>Ver Todas las Transacciones</Text>
                <Ionicons name="chevron-forward" size={16} color="#6366F1" />
              </TouchableOpacity>
            )}
            {!isPro && d.recent_transactions.length > FREE_TXN_LIMIT && (
              <TouchableOpacity style={s.lockedSection} onPress={() => router.push('/finance-subscription' as any)}>
                <Ionicons name="lock-closed" size={16} color="#6366F1" />
                <Text style={s.lockedText}>+{d.recent_transactions.length - FREE_TXN_LIMIT} transacciones con Pro</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Upgrade Banner ── */}
        {!isPro && d.has_accounts && (
          <LinearGradient colors={['#4338CA', '#6366F1', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.upgradeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 36 }}>⭐</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.upgradeTitle}>Finanzas Pro</Text>
                <Text style={s.upgradeSub}>Categorías ilimitadas, tendencias mensuales y más.</Text>
              </View>
            </View>
            <TouchableOpacity style={s.upgradeBtn} onPress={() => router.push('/finance-subscription' as any)}>
              <Text style={s.upgradeBtnText}>Ver Planes</Text>
              <Ionicons name="arrow-forward" size={16} color="#4338CA" />
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* ── Empty Transactions ── */}
        {d.recent_transactions.length === 0 && d.has_accounts && (
          <View style={s.emptyTxn}>
            <Text style={{ fontSize: 40 }}>📭</Text>
            <Text style={s.emptyTxnTitle}>Sin transacciones aún</Text>
            <Text style={s.emptyTxnSub}>Sincroniza tu cuenta para importar transacciones</Text>
            <TouchableOpacity style={s.syncBtn} onPress={syncTransactions} disabled={syncing}>
              {syncing ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sync" size={18} color="#fff" />}
              <Text style={s.syncBtnText}>Sincronizar Ahora</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header
  header: { paddingBottom: 20, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerMonth: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  headerBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },

  balanceSection: { marginTop: 20, alignItems: 'center' },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.5 },
  balanceAmount: { fontSize: 38, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -1 },
  balanceAccts: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 },

  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 },
  healthBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthText: { fontSize: 12, fontWeight: '700' },
  healthScore: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  // Accounts
  acctStrip: { marginTop: -4, paddingTop: 14 },
  acctCard: { width: 170, padding: 14, borderRadius: 16, marginRight: 0 },
  acctInst: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  acctBal: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 8 },
  acctMask: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  addAcctCard: { width: 120, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 6 },
  addAcctText: { fontSize: 11, color: '#6366F1', fontWeight: '600' },

  // Quick Actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 18, gap: 8 },
  actionItem: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', textAlign: 'center' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 18, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  statAmount: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  trendChip: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  trendText: { fontSize: 11, fontWeight: '700' },

  // Net Card
  netCard: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  netLabel: { fontSize: 14, fontWeight: '700' },
  netSub: { fontSize: 11, marginTop: 2, opacity: 0.8 },
  netAmount: { fontSize: 20, fontWeight: '800', marginLeft: 12 },

  // Sections
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
  sectionBadge: { fontSize: 11, fontWeight: '700', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 12 },

  // Chart
  chartWrap: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 110 },
  chartCol: { alignItems: 'center', gap: 6 },
  chartBarGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  chartBar: { width: 16, borderRadius: 4, minHeight: 4 },
  chartLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  // Categories
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  catIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  catAmount: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  catBarBg: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  catBarFill: { height: 6, borderRadius: 3 },
  catMeta: { fontSize: 10, color: '#94A3B8', marginTop: 3 },

  // Transactions
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#F1F5F9' },
  txnIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txnName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  txnMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 8, backgroundColor: '#EEF2FF', borderRadius: 14 },
  viewAllText: { fontSize: 13, fontWeight: '700', color: '#6366F1' },

  // Locked
  lockedSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, backgroundColor: '#EEF2FF', borderRadius: 14, marginTop: 8 },
  lockedText: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

  // Upgrade
  upgradeCard: { marginHorizontal: 16, marginTop: 24, padding: 20, borderRadius: 20 },
  upgradeTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  upgradeSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 18 },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 14, marginTop: 14 },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#4338CA' },

  // Empty states
  emptyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  emptyHeaderTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  emptyContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 40 },
  emptyIconWrap: { width: 110, height: 110, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginTop: 8 },
  emptyFeature: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, width: '100%' },
  emptyFeatureText: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  emptyConnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366F1', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, marginTop: 32, width: '100%' },
  emptyConnectText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  emptyTxn: { alignItems: 'center', marginTop: 30, padding: 20 },
  emptyTxnTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 10 },
  emptyTxnSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366F1', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 16 },
  syncBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
