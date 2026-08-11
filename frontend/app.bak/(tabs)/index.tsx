import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Linking, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n, { setLanguage } from '../../src/i18n';
import { useAuth } from '../../src/contexts/AuthContext';
import { Colors, Gradients, API_URL } from '../../src/constants/theme';
import { cachedFetch, invalidateCache } from '../../src/utils/apiCache';
import { HomeSkeleton } from '../../src/components/SkeletonLoading';
import { registerForPushNotificationsAsync, savePushTokenToServer } from '../../src/utils/pushNotifications';
import NMLSFooter from '../../src/components/NMLSFooter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingApp, setPendingApp] = useState<any>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fetchLoans = useCallback(async (force = false) => {
    if (!token) return;
    try {
      if (force) invalidateCache('my-loans');
      const data = await cachedFetch(
        `${API_URL}/api/loans/my-loans`,
        { headers: { 'Authorization': `Bearer ${token}` } },
        60_000 // Cache for 60 seconds
      );
      setLoans(data.loans || []);
    } catch (e) {
      console.log('Error fetching loans:', e);
    }
    setLoading(false);
  }, [token, user]);

  // Fetch pending applications
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/loans/my-applications`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const apps = data.applications || [];
          // Priority: info_requested > docs_submitted > pending > approved (most recent)
          const active = apps.find((a: any) => a.status === 'info_requested')
            || apps.find((a: any) => a.status === 'docs_submitted')
            || apps.find((a: any) => a.status === 'pending')
            || apps.find((a: any) => a.status === 'approved');
          setPendingApp(active || null);
        }
      } catch (e) { console.log('Error fetching apps:', e); }
    })();
  }, [token]);

  // Fetch unread notification count for badge
  useEffect(() => {
    if (!token) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_URL}/api/notifications?app=ross_lending`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : (data.notifications || []);
          const unread = items.filter((n: any) => !n.is_read && !n.read).length;
          setUnreadNotifCount(unread);
        }
      } catch (e) { console.log('Error fetching notification count:', e); }
    };
    fetchUnread();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  // Register push notifications on first load
  useEffect(() => {
    if (token) {
      registerForPushNotificationsAsync().then((pushToken) => {
        if (pushToken) {
          savePushTokenToServer(pushToken, token);
        }
      });
    }
  }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLoans(true); // Force refresh
    setRefreshing(false);
  };

  const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'delinquent');
  const paidLoans = loans.filter(l => l.status === 'paid_off');
  const totalBalance = loans.reduce((sum, l) => sum + (l.balance || 0), 0);
  const totalPaid = loans.reduce((sum, l) => sum + ((l.total_to_pay || 0) - (l.balance || 0)), 0);
  const nextPayment = activeLoans.length > 0 ? activeLoans[0] : null;
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const fmtShort = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  // Greeting based on time
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? t('home.goodMorning') : hour < 18 ? t('home.goodAfternoon') : t('home.goodEvening');
  const userName = user?.first_name || user?.name?.split(' ')[0] || 'Cliente';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primaryLight} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingKey},</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {user?.role === 'admin' && (
              <TouchableOpacity
                onPress={() => router.push('/(admin)/dashboard')}
                activeOpacity={0.7}
                style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.12)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="stats-chart" size={18} color={Colors.primaryLight} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              activeOpacity={0.7}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/chat' as any)}
              activeOpacity={0.7}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const newLang = i18n.language === 'es' ? 'en' : 'es';
                setLanguage(newLang);
              }}
              activeOpacity={0.7}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 20 }}>{i18n.language === 'es' ? '🇲🇽' : '🇺🇸'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── HERO BALANCE CARD ─── */}
        <View style={styles.heroCardOuter}>
          <LinearGradient
            colors={['#064E3B', '#0E4A6F', '#1E1B4B', '#312E81']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Aurora decorative blobs */}
            <View style={styles.heroDecor1} />
            <View style={styles.heroDecor2} />
            <View style={styles.heroDecor3} />

            <View style={styles.heroContent}>
              <Text style={styles.heroLabel}>{t('home.totalBalance')}</Text>
              <Text style={styles.heroAmount}>{fmt(totalBalance)}</Text>

              {/* Stats Row */}
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <View style={[styles.heroStatDot, { backgroundColor: '#34D399' }]} />
                  <Text style={styles.heroStatValue}>{activeLoans.length}</Text>
                  <Text style={styles.heroStatLabel}>{t('home.active')}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <View style={[styles.heroStatDot, { backgroundColor: '#60A5FA' }]} />
                  <Text style={styles.heroStatValue}>{paidLoans.length}</Text>
                  <Text style={styles.heroStatLabel}>{t('home.paidOff')}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <View style={[styles.heroStatDot, { backgroundColor: '#FBBF24' }]} />
                  <Text style={styles.heroStatValue}>{fmt(totalPaid)}</Text>
                  <Text style={styles.heroStatLabel}>{t('home.totalPaid')}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ─── NEXT PAYMENT CARD ─── */}
        {nextPayment && (
          <View style={styles.nextPayCard}>
            <View style={styles.nextPayLeft}>
              <View style={styles.nextPayIconWrap}>
                <Ionicons name="time-outline" size={20} color={Colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextPayLabel}>{t('home.nextPayment')}</Text>
                <Text style={styles.nextPayAmount}>{fmt(nextPayment.monthly_payment)}</Text>
                <Text style={styles.nextPayDate}>
                  {nextPayment.next_payment_date
                    ? new Date(nextPayment.next_payment_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                    : t('home.datePending')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/loans')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={Gradients.primary as any}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.payNowBtn}
              >
                <Ionicons name="card-outline" size={14} color="#fff" />
                <Text style={styles.payNowText}>{t('home.pay')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── QUICK ACTIONS ─── */}
        <View style={styles.actionsGrid}>
          {/* Row 1 */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/loans')} activeOpacity={0.7}>
            <LinearGradient colors={['rgba(5,150,105,0.15)', 'rgba(5,150,105,0.05)']} style={styles.actionGradient}>
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(5,150,105,0.2)' }]}>
                <Ionicons name="wallet-outline" size={22} color={Colors.primaryLight} />
              </View>
              <Text style={styles.actionTitle}>{t('home.viewLoans')}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={styles.actionArrow} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/apply')} activeOpacity={0.7}>
            <LinearGradient colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)']} style={styles.actionGradient}>
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <Ionicons name="add-circle-outline" size={22} color="#F59E0B" />
              </View>
              <Text style={styles.actionTitle}>{t('home.applyNew')}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={styles.actionArrow} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Row 2 */}
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/profile/calculator')} activeOpacity={0.7}>
            <LinearGradient colors={['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)']} style={styles.actionGradient}>
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
                <Ionicons name="calculator-outline" size={22} color="#3B82F6" />
              </View>
              <Text style={styles.actionTitle}>{t('home.calculateLoan')}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={styles.actionArrow} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/chat')} activeOpacity={0.7}>
            <LinearGradient colors={['rgba(16,185,129,0.15)', 'rgba(16,185,129,0.05)']} style={styles.actionGradient}>
              <View style={[styles.actionIconCircle, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                <Ionicons name="chatbubbles-outline" size={22} color="#10B981" />
              </View>
              <Text style={styles.actionTitle}>{i18n.language === 'es' ? 'Chat Soporte' : 'Support Chat'}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={styles.actionArrow} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ─── AI ASSISTANT BANNER ─── */}
        <TouchableOpacity
          style={styles.aiBanner}
          activeOpacity={0.8}
          onPress={() => router.push('/contact-advisor')}
        >
          <LinearGradient
            colors={['#1E1B4B', '#312E81', '#4338CA']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.aiBannerGradient}
          >
            <View style={styles.aiBannerDecor} />
            <View style={styles.aiBannerContent}>
              <View style={styles.aiBannerIconWrap}>
                <Text style={{ fontSize: 28 }}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiBannerTitle}>
                  {i18n.language === 'es' ? 'Asistente AI 24/7' : 'AI Assistant 24/7'}
                </Text>
                <Text style={styles.aiBannerDesc}>
                  {i18n.language === 'es' 
                    ? 'Pregunta sobre préstamos, pagos o tu cuenta'
                    : 'Ask about loans, payments, or your account'}
                </Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={28} color="rgba(255,255,255,0.6)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ─── LOAN HEALTH ─── */}
        {activeLoans.length > 0 && (
          <View style={styles.healthCard}>
            <View style={styles.healthHeader}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primaryLight} />
              <Text style={styles.healthTitle}>{t('home.loanHealth')}</Text>
            </View>
            {activeLoans.map(loan => {
              const progress = loan.total_to_pay > 0 ? ((loan.total_to_pay - loan.balance) / loan.total_to_pay) * 100 : 0;
              const isGood = loan.status === 'active';
              return (
                <TouchableOpacity key={loan._id} onPress={() => router.push('/(tabs)/loans')} activeOpacity={0.7}>
                  <View style={styles.healthRow}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.healthLoanTop}>
                        <Text style={styles.healthLoanNum}>{loan.loan_number}</Text>
                        <Text style={[styles.healthStatusText, { color: isGood ? Colors.primaryLight : '#EF4444' }]}>
                          {isGood ? t('home.onTrack') : t('home.behind')}
                        </Text>
                      </View>
                      <View style={styles.healthProgressBg}>
                        <LinearGradient
                          colors={isGood ? ['#059669', '#34D399'] : ['#EF4444', '#F87171']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={[styles.healthProgressFill, { width: `${Math.min(progress, 100)}%` }] as any}
                        />
                      </View>
                      <View style={styles.healthProgressLabels}>
                        <Text style={styles.healthProgressText}>{progress.toFixed(0)}% {t('home.completed')}</Text>
                        <Text style={styles.healthProgressText}>{t('home.remaining')}: {fmt(loan.balance)}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── PENDING APPLICATION BANNER ─── */}
        {pendingApp && (
          <TouchableOpacity
            onPress={() => router.push(`/loan/application-status?appId=${pendingApp._id}`)}
            activeOpacity={0.8}
            style={{
              backgroundColor: pendingApp.status === 'approved' ? '#059669' + '15'
                : pendingApp.status === 'info_requested' ? '#6366F115'
                : Colors.surface,
              borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1,
              borderColor: pendingApp.status === 'approved' ? '#059669' + '30'
                : pendingApp.status === 'info_requested' ? '#6366F130'
                : Colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: pendingApp.status === 'approved' ? '#059669' + '20'
                  : pendingApp.status === 'info_requested' ? '#6366F120'
                  : Colors.accent + '15',
              }}>
                <Ionicons
                  name={pendingApp.status === 'approved' ? 'checkmark-circle-outline'
                    : pendingApp.status === 'info_requested' ? 'document-attach-outline'
                    : 'time-outline'}
                  size={24}
                  color={pendingApp.status === 'approved' ? '#10B981'
                    : pendingApp.status === 'info_requested' ? '#818CF8'
                    : Colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: pendingApp.status === 'approved' ? '#10B981' : Colors.text }}>
                  {pendingApp.status === 'approved'
                    ? `✅ ${t('home.appApproved', '¡Solicitud Aprobada!')}`
                    : pendingApp.status === 'info_requested'
                      ? `📋 ${t('home.docsRequired')}`
                      : pendingApp.status === 'docs_submitted'
                        ? `📎 ${t('home.docsInReview')}`
                        : `⏳ ${t('home.appInProgress')}`}
                </Text>
                <Text style={{ fontSize: 12, color: pendingApp.status === 'approved' ? '#6EE7B7' : Colors.textSecondary, marginTop: 2 }}>
                  {pendingApp.status === 'approved'
                    ? t('home.appApprovedDesc', { amount: pendingApp.amount_requested || pendingApp.amount || '?' }, `Solicitud de $${pendingApp.amount_requested || pendingApp.amount || '?'} aprobada`)
                    : pendingApp.status === 'info_requested'
                      ? t('home.uploadDocs', { count: (pendingApp.required_documents || []).filter((d: any) => d.status === 'pending').length })
                      : pendingApp.status === 'docs_submitted'
                        ? t('home.reviewingDocs')
                        : t('home.appInReview', { amount: pendingApp.amount_requested || pendingApp.amount || '?' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={pendingApp.status === 'approved' ? '#10B981' : Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}

        {/* ─── RECENT ACTIVITY ─── */}
        {loans.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <Text style={styles.sectionTitle}>{t('home.recentActivity')}</Text>
              <TouchableOpacity onPress={() => router.push('/profile/payment-history')}>
                <Text style={styles.seeAllText}>{t('home.viewAll')}</Text>
              </TouchableOpacity>
            </View>
            {loans.slice(0, 3).map(loan => {
              const isActive = loan.status === 'active';
              const isPaid = loan.status === 'paid_off';
              return (
                <TouchableOpacity
                  key={loan._id}
                  style={styles.activityItem}
                  onPress={() => router.push('/(tabs)/loans')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityIconWrap, {
                    backgroundColor: isActive ? 'rgba(5,150,105,0.12)' : isPaid ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)',
                  }]}>
                    <Ionicons
                      name={isActive ? 'trending-up' : isPaid ? 'checkmark-circle' : 'alert-circle'}
                      size={18}
                      color={isActive ? Colors.primaryLight : isPaid ? '#60A5FA' : '#F59E0B'}
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>
                      {loan.loan_type === 'tax_advance' ? t('home.taxAdvance') : t('home.personalLoan')}
                    </Text>
                    <Text style={styles.activitySub}>#{loan.loan_number} • {fmt(loan.amount)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.activityAmount, {
                      color: isActive ? Colors.primaryLight : isPaid ? '#60A5FA' : '#F59E0B',
                    }]}>
                      {isActive ? fmt(loan.balance) : t('home.statusPaid')}
                    </Text>
                    <Text style={styles.activityDate}>
                      {loan.created_at ? new Date(loan.created_at).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── PROMO BANNER ─── */}
        {loans.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/(tabs)/apply')} activeOpacity={0.8}>
            <LinearGradient
              colors={['#1E3A5F', '#2563EB']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.promoBanner}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.promoTitle}>{t('home.promoTitle')}</Text>
                <Text style={styles.promoSub}>{t('home.promoSub')}</Text>
              </View>
              <View style={styles.promoIcon}>
                <Ionicons name="arrow-forward-circle" size={32} color="rgba(255,255,255,0.9)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ─── EMPTY STATE ─── */}
        {loans.length === 0 && (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['rgba(5,150,105,0.12)', 'rgba(5,150,105,0.03)']}
              style={styles.emptyIconWrap}
            >
              <Ionicons name="diamond-outline" size={48} color={Colors.primaryLight} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>{t('home.welcomeTitle')}</Text>
            <Text style={styles.emptySub}>
              {t('home.welcomeSub')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/apply')} activeOpacity={0.8}>
              <LinearGradient
                colors={Gradients.primary as any}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.emptyBtn}
              >
                <Ionicons name="rocket-outline" size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>{t('home.applyLoan')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <NMLSFooter />

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  userName: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 2 },

  // Notification badge
  notifBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10, minWidth: 18, height: 18,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.bg,
  },
  notifBadgeText: {
    fontSize: 10, fontWeight: '800', color: '#fff',
  },

  // Hero Card
  heroCardOuter: {
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
    // Subtle glow shadow
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  heroCard: {
    borderRadius: 24, padding: 24, overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute', top: -40, right: -20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(99,102,241,0.15)',
  },
  heroDecor2: {
    position: 'absolute', bottom: -30, left: -30,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(52,211,153,0.12)',
  },
  heroDecor3: {
    position: 'absolute', top: 20, left: '40%' as any,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(96,165,250,0.08)',
  },
  heroContent: { alignItems: 'center', zIndex: 1 },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  heroAmount: { fontSize: 42, fontWeight: '800', color: '#fff', marginTop: 4, marginBottom: 20 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  heroStat: { alignItems: 'center', paddingHorizontal: 12, flexDirection: 'row', gap: 6 },
  heroStatDot: { width: 6, height: 6, borderRadius: 3 },
  heroStatValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginLeft: 2 },
  heroStatDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Next Payment
  nextPayCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: 18, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  nextPayLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  nextPayIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  nextPayLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextPayAmount: { fontSize: 22, fontWeight: '800', color: Colors.primaryLight, marginTop: 2 },
  nextPayDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  payNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  payNowText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Quick Actions Grid
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20,
  },
  actionCard: { width: (SCREEN_WIDTH - 52) / 2, borderRadius: 18, overflow: 'hidden' },
  actionGradient: {
    padding: 16, borderRadius: 18, borderWidth: 1, borderColor: Colors.border,
    minHeight: 100, justifyContent: 'center',
  },
  actionIconCircle: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    marginBottom: 10,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, lineHeight: 18 },
  actionArrow: { position: 'absolute', top: 16, right: 0 },

  // Loan Health
  healthCard: {
    backgroundColor: Colors.card, borderRadius: 18, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  healthTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  healthRow: { flexDirection: 'row', alignItems: 'center' },
  healthLoanTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  healthLoanNum: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, fontFamily: 'monospace' },
  healthStatusText: { fontSize: 12, fontWeight: '700' },
  healthProgressBg: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden',
  },
  healthProgressFill: { height: 8, borderRadius: 4 },
  healthProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  healthProgressText: { fontSize: 10, color: Colors.textMuted },

  // Activity
  activitySection: { marginBottom: 20 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  seeAllText: { fontSize: 13, fontWeight: '600', color: Colors.primaryLight },
  activityItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
  },
  activityIconWrap: {
    width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  activitySub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  activityAmount: { fontSize: 14, fontWeight: '700' },
  activityDate: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  // Promo Banner
  promoBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, padding: 20, marginBottom: 8,
  },
  promoTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  promoSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  promoIcon: { marginLeft: 12 },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 40, padding: 20 },
  emptyIconWrap: {
    width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // AI Banner
  aiBanner: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  aiBannerGradient: {
    borderRadius: 18, padding: 18, overflow: 'hidden',
  },
  aiBannerDecor: {
    position: 'absolute', top: -20, right: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  aiBannerContent: {
    flexDirection: 'row', alignItems: 'center', gap: 14, zIndex: 1,
  },
  aiBannerIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  aiBannerTitle: {
    fontSize: 15, fontWeight: '700', color: '#fff',
  },
  aiBannerDesc: {
    fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2,
  },
});
