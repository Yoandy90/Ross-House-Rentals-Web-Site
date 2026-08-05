/**
 * 📧 Email Analytics - Premium Dashboard 2025
 * Tracking de emails con métricas avanzadas y gráficos
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

const { width: screenWidth } = Dimensions.get('window');

interface EmailStats {
  total_delivered: number;
  total_opens: number;
  total_clicks: number;
  unique_openers: number;
  unique_clickers: number;
  engagement_rate: string;
  open_rate?: number;
  click_rate?: number;
  bounce_rate?: number;
}

interface RecentOpen {
  email: string;
  subject?: string;
  opened_at: string;
  campaign_name?: string;
}

type Period = 7 | 14 | 30 | 90;

export default function EmailAnalyticsPremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(7);
  const [stats, setStats] = useState<EmailStats>({
    total_delivered: 0,
    total_opens: 0,
    total_clicks: 0,
    unique_openers: 0,
    unique_clickers: 0,
    engagement_rate: '0%',
  });
  const [recentOpens, setRecentOpens] = useState<RecentOpen[]>([]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backendUrl = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8001';

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchAnalytics = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      
      const reportResponse = await fetch(
        `${backendUrl}/api/admin/email-analytics/report?days=${selectedPeriod}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        // Calculate rates
        const openRate = reportData.total_delivered > 0 
          ? Math.round((reportData.total_opens / reportData.total_delivered) * 100) 
          : 0;
        const clickRate = reportData.total_opens > 0 
          ? Math.round((reportData.total_clicks / reportData.total_opens) * 100) 
          : 0;
        setStats({ ...reportData, open_rate: openRate, click_rate: clickRate });
      }
      
      const opensResponse = await fetch(
        `${backendUrl}/api/admin/email-analytics/recent-opens?limit=20`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (opensResponse.ok) {
        const opensData = await opensResponse.json();
        setRecentOpens(opensData.opens || []);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchAnalytics();
  }, [selectedPeriod]);

  const exportData = async () => {
    const data = `
📧 Email Analytics Report
━━━━━━━━━━━━━━━━━━━━━━━━

📅 Período: Últimos ${selectedPeriod} días

📊 Métricas:
• Emails Enviados: ${stats.total_delivered.toLocaleString()}
• Aperturas: ${stats.total_opens.toLocaleString()}
• Clics: ${stats.total_clicks.toLocaleString()}
• Tasa de Apertura: ${stats.open_rate || 0}%
• Tasa de Clics: ${stats.click_rate || 0}%
• Engagement: ${stats.engagement_rate}

━━━━━━━━━━━━━━━━━━━━━━━━
Ross Tax App
    `.trim();
    await Share.share({ message: data });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
    });
  };

  const periodOptions: { value: Period; label: string }[] = [
    { value: 7, label: '7 días' },
    { value: 14, label: '14 días' },
    { value: 30, label: '30 días' },
    { value: 90, label: '90 días' },
  ];

  // Calculate bar heights for mini chart
  const getEngagementBars = () => {
    const delivered = stats.total_delivered || 1;
    return [
      { label: 'Enviados', value: stats.total_delivered, percent: 100, color: '#3B82F6' },
      { label: 'Abiertos', value: stats.total_opens, percent: Math.min((stats.total_opens / delivered) * 100, 100), color: '#10B981' },
      { label: 'Clics', value: stats.total_clicks, percent: Math.min((stats.total_clicks / delivered) * 100, 100), color: '#F59E0B' },
    ];
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📧 Email Analytics</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Cargando métricas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Premium Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>📧 Email Analytics</Text>
          <Text style={styles.headerSubtitle}>Métricas de campañas</Text>
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={exportData}>
          <Ionicons name="share-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Period Filter */}
      <View style={styles.filterContainer}>
        {periodOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.filterTab, selectedPeriod === option.value && styles.filterTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedPeriod(option.value);
            }}
          >
            <Text style={[styles.filterTabText, selectedPeriod === option.value && styles.filterTabTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Main Engagement Card */}
        <Animated.View style={[styles.engagementCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.engagementGradient}>
            <View style={styles.engagementHeader}>
              <View>
                <Text style={styles.engagementLabel}>Tasa de Engagement</Text>
                <Text style={styles.engagementValue}>{stats.engagement_rate || '0%'}</Text>
              </View>
              <View style={styles.engagementIcon}>
                <Ionicons name="trending-up" size={32} color="#fff" />
              </View>
            </View>
            <View style={styles.engagementMeta}>
              <View style={styles.engagementMetaItem}>
                <Text style={styles.engagementMetaValue}>{stats.unique_openers.toLocaleString()}</Text>
                <Text style={styles.engagementMetaLabel}>Usuarios únicos</Text>
              </View>
              <View style={styles.engagementMetaDivider} />
              <View style={styles.engagementMetaItem}>
                <Text style={styles.engagementMetaValue}>{stats.unique_clickers.toLocaleString()}</Text>
                <Text style={styles.engagementMetaLabel}>Hicieron clic</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Delivered */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="send" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.total_delivered.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Enviados</Text>
            </LinearGradient>
          </View>

          {/* Opens */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="mail-open" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.total_opens.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Abiertos</Text>
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>{stats.open_rate || 0}%</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Clicks */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="finger-print" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.total_clicks.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Clics</Text>
              <View style={styles.rateBadge}>
                <Text style={styles.rateBadgeText}>{stats.click_rate || 0}%</Text>
              </View>
            </LinearGradient>
          </View>

          {/* Bounce */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="close-circle" size={20} color="#fff" />
              </View>
              <Text style={styles.statValue}>{stats.bounce_rate || 0}%</Text>
              <Text style={styles.statLabel}>Rebote</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Funnel Chart */}
        <View style={styles.funnelCard}>
          <Text style={styles.sectionTitle}>📊 Embudo de Conversión</Text>
          <View style={styles.funnelContainer}>
            {getEngagementBars().map((bar, index) => (
              <View key={index} style={styles.funnelRow}>
                <Text style={styles.funnelLabel}>{bar.label}</Text>
                <View style={styles.funnelBarBg}>
                  <LinearGradient
                    colors={[bar.color, bar.color + '99']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.funnelBar, { width: `${bar.percent}%` }]}
                  />
                </View>
                <Text style={styles.funnelValue}>{bar.value.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Opens */}
        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>📬 Aperturas Recientes</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
          </View>
          
          {recentOpens.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>No hay aperturas recientes</Text>
            </View>
          ) : (
            recentOpens.slice(0, 10).map((open, index) => (
              <View key={index} style={styles.openRow}>
                <View style={styles.openAvatar}>
                  <Ionicons name="person" size={18} color="#6B7280" />
                </View>
                <View style={styles.openInfo}>
                  <Text style={styles.openEmail} numberOfLines={1}>{open.email}</Text>
                  <Text style={styles.openMeta}>
                    {open.campaign_name || 'Email'} • {formatDate(open.opened_at)}
                  </Text>
                </View>
                <View style={styles.openBadge}>
                  <Ionicons name="mail-open" size={16} color="#10B981" />
                </View>
              </View>
            ))
          )}
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <LinearGradient colors={['#3B82F615', '#1D4ED815']} style={styles.tipsGradient}>
            <Ionicons name="bulb" size={24} color="#3B82F6" />
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>💡 Tip para mejorar</Text>
              <Text style={styles.tipsText}>
                Los mejores horarios para enviar emails son martes y jueves entre 10am-2pm.
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  engagementCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  engagementGradient: {
    padding: 20,
  },
  engagementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  engagementLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  engagementValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  engagementIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  engagementMeta: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  engagementMetaItem: {
    flex: 1,
  },
  engagementMetaDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 16,
  },
  engagementMetaValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  engagementMetaLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: (screenWidth - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 16,
    minHeight: 110,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  rateBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rateBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  funnelCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  funnelContainer: {
    gap: 14,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  funnelLabel: {
    width: 70,
    fontSize: 13,
    color: '#6B7280',
  },
  funnelBarBg: {
    flex: 1,
    height: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    overflow: 'hidden',
  },
  funnelBar: {
    height: '100%',
    borderRadius: 6,
  },
  funnelValue: {
    width: 60,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  recentCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  openAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openInfo: {
    flex: 1,
    marginLeft: 12,
  },
  openEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  openMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  openBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tipsGradient: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
});
