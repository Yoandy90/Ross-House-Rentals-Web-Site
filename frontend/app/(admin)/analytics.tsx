/**
 * 📊 Analytics Web - Premium Dashboard 2025
 * Real-time visitor tracking with charts and insights
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Animated,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import * as Haptics from 'expo-haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width: screenWidth } = Dimensions.get('window');

interface RealtimeData {
  online_now: number;
  visitors: Array<{
    session_id: string;
    country: string;
    country_code: string;
    city: string;
    device: string;
    browser: string;
    pages: number;
    last_activity: string;
  }>;
  countries: Record<string, number>;
  devices: Record<string, number>;
}

interface DashboardData {
  today: {
    views: number;
    sessions: number;
    growth: number;
  };
  week: { views: number };
  month: { views: number };
  hourly: Record<string, number>;
  daily: Array<{ date: string; views: number }>;
  top_pages: Array<{ page: string; views: number }>;
  countries: Array<{ country: string; code: string; views: number }>;
  devices: Record<string, number>;
  browsers: Record<string, number>;
}

type DateFilter = 'today' | 'week' | 'month' | 'year';

const FLAG_EMOJIS: Record<string, string> = {
  'US': '🇺🇸', 'MX': '🇲🇽', 'ES': '🇪🇸', 'AR': '🇦🇷', 'CO': '🇨🇴',
  'PE': '🇵🇪', 'CL': '🇨🇱', 'VE': '🇻🇪', 'EC': '🇪🇨', 'GT': '🇬🇹',
  'CU': '🇨🇺', 'DO': '🇩🇴', 'HN': '🇭🇳', 'SV': '🇸🇻', 'NI': '🇳🇮',
  'CR': '🇨🇷', 'PA': '🇵🇦', 'PR': '🇵🇷', 'BR': '🇧🇷', 'CA': '🇨🇦',
  'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'IT': '🇮🇹', 'XX': '🌍',
  'Local': '🏠', 'Unknown': '🌍'
};

const AnalyticsPremiumScreen = () => {
  const { token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [showVisitors, setShowVisitors] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for live indicator
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const fetchRealtime = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/analytics/realtime`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRealtime(data);
      }
    } catch (error) {
      console.error('Error fetching realtime:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/analytics/dashboard?period=${dateFilter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRealtime();
    fetchDashboard();
    
    // Refresh realtime every 30 seconds
    const interval = setInterval(fetchRealtime, 30000);
    return () => clearInterval(interval);
  }, [dateFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchRealtime();
    fetchDashboard();
  }, [dateFilter]);

  const getFlag = (code: string) => FLAG_EMOJIS[code] || FLAG_EMOJIS['Unknown'];

  const getDeviceIcon = (device: string): keyof typeof Ionicons.glyphMap => {
    switch (device?.toLowerCase()) {
      case 'mobile': return 'phone-portrait';
      case 'tablet': return 'tablet-portrait';
      default: return 'desktop';
    }
  };

  const exportData = async () => {
    try {
      const data = `
📊 Ross Tax Analytics Report
━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Período: ${dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Esta Semana' : dateFilter === 'month' ? 'Este Mes' : 'Este Año'}

📈 Métricas Principales:
• Visitas Hoy: ${dashboard?.today.views || 0}
• Sesiones Hoy: ${dashboard?.today.sessions || 0}
• Crecimiento: ${dashboard?.today.growth || 0}%
• Visitas Semana: ${dashboard?.week.views || 0}
• Visitas Mes: ${dashboard?.month.views || 0}

🌍 Visitantes en Vivo: ${realtime?.online_now || 0}

📱 Dispositivos:
• Desktop: ${dashboard?.devices?.desktop || 0}
• Mobile: ${dashboard?.devices?.mobile || 0}
• Tablet: ${dashboard?.devices?.tablet || 0}

📄 Top Páginas:
${dashboard?.top_pages?.slice(0, 5).map((p, i) => `${i + 1}. ${p.page}: ${p.views} visitas`).join('\n') || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
Generado por Ross Tax App
      `.trim();

      await Share.share({ message: data, title: 'Analytics Report' });
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Calculate chart data for mini bar chart
  const getHourlyChartData = () => {
    if (!dashboard?.hourly) return [];
    const hours = Object.entries(dashboard.hourly).slice(-12);
    const maxValue = Math.max(...hours.map(([_, v]) => v), 1);
    return hours.map(([hour, value]) => ({
      hour: hour.split(':')[0],
      value,
      height: (value / maxValue) * 100,
    }));
  };

  // Calculate device percentages
  const getDevicePercentages = () => {
    if (!dashboard?.devices) return { desktop: 33, mobile: 34, tablet: 33 };
    const total = Object.values(dashboard.devices).reduce((a, b) => a + b, 0) || 1;
    return {
      desktop: Math.round((dashboard.devices.desktop || 0) / total * 100),
      mobile: Math.round((dashboard.devices.mobile || 0) / total * 100),
      tablet: Math.round((dashboard.devices.tablet || 0) / total * 100),
    };
  };

  const devicePercentages = getDevicePercentages();
  const hourlyData = getHourlyChartData();

  // Filter tabs
  const filterTabs: { key: DateFilter; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: '7 días' },
    { key: 'month', label: '30 días' },
    { key: 'year', label: 'Año' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📊 Analytics</Text>
          <View style={{ width: 40 }} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando analytics...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>📊 Analytics Web</Text>
          <Text style={styles.headerSubtitle}>Tráfico en tiempo real</Text>
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={exportData}>
          <Ionicons name="share-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Date Filter Tabs */}
      <View style={styles.filterContainer}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, dateFilter === tab.key && styles.filterTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setDateFilter(tab.key);
            }}
          >
            <Text style={[styles.filterTabText, dateFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#667eea" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Live Visitors Card */}
        <Animated.View style={[styles.liveCard, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.liveGradient}
          >
            <View style={styles.liveHeader}>
              <View style={styles.liveBadge}>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.liveText}>EN VIVO</Text>
              </View>
              <TouchableOpacity 
                style={styles.expandButton}
                onPress={() => setShowVisitors(!showVisitors)}
              >
                <Ionicons 
                  name={showVisitors ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.liveNumber}>{realtime?.online_now || 0}</Text>
            <Text style={styles.liveSubtext}>visitantes activos ahora</Text>

            {/* Active Visitors Expandable */}
            {showVisitors && realtime && realtime.visitors.length > 0 && (
              <View style={styles.visitorsList}>
                {realtime.visitors.slice(0, 5).map((visitor, index) => (
                  <View key={index} style={styles.visitorRow}>
                    <Text style={styles.visitorFlag}>{getFlag(visitor.country_code)}</Text>
                    <View style={styles.visitorInfo}>
                      <Text style={styles.visitorLocation}>{visitor.city || 'Desconocido'}</Text>
                      <Text style={styles.visitorMeta}>{visitor.browser} • {visitor.pages} pág</Text>
                    </View>
                    <Ionicons name={getDeviceIcon(visitor.device)} size={18} color="#9CA3AF" />
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Main Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Today Views */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="eye-outline" size={22} color="#fff" />
              </View>
              <Text style={styles.statValue}>{(dashboard?.today.views || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Visitas</Text>
              {dashboard?.today.growth !== undefined && (
                <View style={[
                  styles.growthBadge,
                  { backgroundColor: dashboard.today.growth >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }
                ]}>
                  <Ionicons 
                    name={dashboard.today.growth >= 0 ? 'trending-up' : 'trending-down'} 
                    size={14} 
                    color="#fff" 
                  />
                  <Text style={styles.growthText}>{Math.abs(dashboard.today.growth)}%</Text>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Sessions */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="people-outline" size={22} color="#fff" />
              </View>
              <Text style={styles.statValue}>{(dashboard?.today.sessions || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Sesiones</Text>
            </LinearGradient>
          </View>

          {/* Week */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="calendar-outline" size={22} color="#fff" />
              </View>
              <Text style={styles.statValue}>{(dashboard?.week.views || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Semana</Text>
            </LinearGradient>
          </View>

          {/* Month */}
          <View style={styles.statCard}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.statGradient}>
              <View style={styles.statIconBg}>
                <Ionicons name="bar-chart-outline" size={22} color="#fff" />
              </View>
              <Text style={styles.statValue}>{(dashboard?.month.views || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Mes</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Hourly Chart */}
        {hourlyData.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>📈 Visitas por Hora</Text>
              <Text style={styles.chartSubtitle}>Últimas 12 horas</Text>
            </View>
            <View style={styles.chartContainer}>
              {hourlyData.map((item, index) => (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={[styles.bar, { height: `${Math.max(item.height, 5)}%` }]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{item.hour}</Text>
                  <Text style={styles.barValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Devices Card */}
        <View style={styles.devicesCard}>
          <Text style={styles.sectionTitle}>📱 Dispositivos</Text>
          <View style={styles.devicesGrid}>
            {/* Desktop */}
            <View style={styles.deviceItem}>
              <View style={[styles.deviceIconBg, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="desktop-outline" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.deviceLabel}>Desktop</Text>
              <Text style={styles.deviceValue}>{devicePercentages.desktop}%</Text>
              <View style={styles.deviceBar}>
                <View style={[styles.deviceBarFill, { width: `${devicePercentages.desktop}%`, backgroundColor: '#3B82F6' }]} />
              </View>
            </View>

            {/* Mobile */}
            <View style={styles.deviceItem}>
              <View style={[styles.deviceIconBg, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="phone-portrait-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.deviceLabel}>Móvil</Text>
              <Text style={styles.deviceValue}>{devicePercentages.mobile}%</Text>
              <View style={styles.deviceBar}>
                <View style={[styles.deviceBarFill, { width: `${devicePercentages.mobile}%`, backgroundColor: '#10B981' }]} />
              </View>
            </View>

            {/* Tablet */}
            <View style={styles.deviceItem}>
              <View style={[styles.deviceIconBg, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="tablet-portrait-outline" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.deviceLabel}>Tablet</Text>
              <Text style={styles.deviceValue}>{devicePercentages.tablet}%</Text>
              <View style={styles.deviceBar}>
                <View style={[styles.deviceBarFill, { width: `${devicePercentages.tablet}%`, backgroundColor: '#F59E0B' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Top Pages */}
        <View style={styles.pagesCard}>
          <Text style={styles.sectionTitle}>📄 Páginas Más Visitadas</Text>
          {dashboard?.top_pages?.slice(0, 8).map((page, index) => (
            <View key={index} style={styles.pageRow}>
              <View style={styles.pageRank}>
                <Text style={styles.pageRankText}>#{index + 1}</Text>
              </View>
              <Text style={styles.pageName} numberOfLines={1}>
                {page.page === '/' ? 'Inicio' : page.page}
              </Text>
              <View style={styles.pageViews}>
                <Ionicons name="eye-outline" size={14} color="#6B7280" />
                <Text style={styles.pageViewsText}>{page.views.toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Countries */}
        {dashboard?.countries && dashboard.countries.length > 0 && (
          <View style={styles.countriesCard}>
            <Text style={styles.sectionTitle}>🌍 Países</Text>
            <View style={styles.countriesGrid}>
              {dashboard.countries.slice(0, 6).map((country, index) => (
                <View key={index} style={styles.countryItem}>
                  <Text style={styles.countryFlag}>{getFlag(country.code)}</Text>
                  <Text style={styles.countryName}>{country.country}</Text>
                  <Text style={styles.countryViews}>{country.views}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Browsers */}
        {dashboard?.browsers && Object.keys(dashboard.browsers).length > 0 && (
          <View style={styles.browsersCard}>
            <Text style={styles.sectionTitle}>🌐 Navegadores</Text>
            <View style={styles.browsersList}>
              {Object.entries(dashboard.browsers)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([browser, count], index) => (
                <View key={index} style={styles.browserRow}>
                  <View style={styles.browserIcon}>
                    <Ionicons 
                      name={browser.toLowerCase().includes('chrome') ? 'logo-chrome' : 
                            browser.toLowerCase().includes('safari') ? 'logo-apple' :
                            browser.toLowerCase().includes('firefox') ? 'logo-firefox' : 'globe-outline'} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </View>
                  <Text style={styles.browserName}>{browser}</Text>
                  <Text style={styles.browserCount}>{count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Auto-refresh indicator */}
        <View style={styles.refreshIndicator}>
          <Ionicons name="sync-outline" size={16} color="#9CA3AF" />
          <Text style={styles.refreshText}>Auto-actualización cada 30 segundos</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  
  // Header
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

  // Filter Tabs
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
    backgroundColor: '#667eea',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#fff',
  },

  // Content
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
    fontSize: 14,
  },

  // Live Card
  liveCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  liveGradient: {
    padding: 20,
    alignItems: 'center',
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 1,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveNumber: {
    fontSize: 64,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 72,
  },
  liveSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  visitorsList: {
    width: '100%',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 16,
  },
  visitorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  visitorFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  visitorInfo: {
    flex: 1,
  },
  visitorLocation: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  visitorMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Stats Grid
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
    minHeight: 120,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  growthBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Chart
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  chartHeader: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    width: '70%',
    height: 80,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 6,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },

  // Devices
  devicesCard: {
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
  devicesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  deviceItem: {
    flex: 1,
    alignItems: 'center',
  },
  deviceIconBg: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  deviceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  deviceBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  deviceBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Pages
  pagesCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pageRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pageRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  pageName: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  pageViews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageViewsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Countries
  countriesCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  countriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  countryItem: {
    width: (screenWidth - 76) / 3,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  countryFlag: {
    fontSize: 28,
    marginBottom: 6,
  },
  countryName: {
    fontSize: 12,
    color: '#6B7280',
  },
  countryViews: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },

  // Browsers
  browsersCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  browsersList: {},
  browserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  browserIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  browserName: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  browserCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },

  // Refresh
  refreshIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  refreshText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default AnalyticsPremiumScreen;
