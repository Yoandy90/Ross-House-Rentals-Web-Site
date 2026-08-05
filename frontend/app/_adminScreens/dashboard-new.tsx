import React, { useEffect, useState } from 'react';

import AdminHeader from '../../components/admin/AdminHeader';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RiseColors } from '../../constants/riseTheme';
import StatCard from '../../components/admin/StatCard';
import MetricCard from '../../components/admin/MetricCard';

export default function DashboardNew() {
  const router = useRouter();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setDashboard(response.data);
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading || !dashboard) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Dashboard Avanzado" subtitle="Cargando..." />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RiseColors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  const { statistics, recent_users, upcoming_appointments } = dashboard;

  return (
    <View style={styles.container}>
      <AdminHeader title="Dashboard Avanzado" subtitle={format(new Date(), "EEEE, dd 'de' MMMM", { locale: es })} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RiseColors.primary} />
        }
      >
        {/* Rise CRM Style Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#00BCD4', '#E91E63', '#FFC107']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoText}>ROSS</Text>
            </LinearGradient>
            <View style={styles.headerInfo}>
              <Text style={styles.headerGreeting}>Buenos días, {user?.name}</Text>
              <Text style={styles.headerDate}>
                {format(new Date(), "EEEE, dd 'de' MMMM", { locale: es })}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="search-outline" size={22} color={RiseColors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={22} color={RiseColors.text} />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Clock In/Out Card - Rise CRM Style */}
        <View style={styles.clockCard}>
          <LinearGradient
            colors={[RiseColors.secondary, RiseColors.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.clockCardGradient}
          >
            <View style={styles.clockCardLeft}>
              <View style={styles.clockIconContainer}>
                <Ionicons name="time" size={32} color={RiseColors.white} />
              </View>
              <View>
                <Text style={styles.clockCardTitle}>Estás fuera del sistema</Text>
                <Text style={styles.clockCardSubtitle}>You are currently clocked out</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.clockInButton}>
              <Ionicons name="log-in-outline" size={20} color={RiseColors.secondary} />
              <Text style={styles.clockInButtonText}>Clock In</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Quick Stats Cards - Rise Style */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={styles.statsCol}>
              <MetricCard
                icon="document-text-outline"
                iconColor={RiseColors.secondary}
                iconBgColor={RiseColors.secondaryLight}
                label="Tareas abiertas"
                value={statistics.total_documents || 0}
                description="My open tasks"
              />
            </View>
            <View style={styles.statsCol}>
              <MetricCard
                icon="calendar-outline"
                iconColor={RiseColors.info}
                iconBgColor={RiseColors.infoLight}
                label="Eventos hoy"
                value={statistics.total_appointments || 0}
                description="Events today"
              />
            </View>
          </View>
        </View>

        {/* Projects Overview - Rise Style */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="grid-outline" size={20} color={RiseColors.text} />
              <Text style={styles.sectionTitle}>Projects Overview</Text>
            </View>
          </View>

          <View style={styles.projectsCard}>
            <LinearGradient
              colors={[RiseColors.secondary, RiseColors.secondaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.projectsDueCard}
            >
              <View style={styles.projectsDueContent}>
                <View style={styles.projectsDueIcon}>
                  <Ionicons name="document-text" size={40} color={RiseColors.white} />
                </View>
                <View style={styles.projectsDueRight}>
                  <Text style={styles.projectsDueAmount}>$0.00</Text>
                  <Text style={styles.projectsDueLabel}>Due</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.projectsStatsRow}>
              <View style={styles.projectStat}>
                <Text style={styles.projectStatNumber}>{statistics.total_users || 0}</Text>
                <Text style={styles.projectStatLabel}>Open</Text>
              </View>
              <View style={styles.projectStatDivider} />
              <View style={styles.projectStat}>
                <Text style={styles.projectStatNumber}>0</Text>
                <Text style={styles.projectStatLabel}>Completed</Text>
              </View>
              <View style={styles.projectStatDivider} />
              <View style={styles.projectStat}>
                <Text style={styles.projectStatNumber}>0</Text>
                <Text style={styles.projectStatLabel}>Hold</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>Progression 0%</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: '0%' }]} />
              </View>
            </View>

            {/* Reminders */}
            <View style={styles.remindersRow}>
              <View style={styles.reminderItem}>
                <Text style={styles.reminderNumber}>0</Text>
                <Text style={styles.reminderLabel}>Reminder Today</Text>
              </View>
              <View style={styles.reminderItem}>
                <Ionicons name="notifications-outline" size={20} color={RiseColors.secondary} />
                <Text style={styles.reminderLabel}>Next reminder</Text>
                <Text style={styles.reminderValue}>No reminder</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Invoice Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="receipt-outline" size={20} color={RiseColors.text} />
              <Text style={styles.sectionTitle}>Invoice Overview</Text>
            </View>
          </View>

          <View style={styles.invoiceList}>
            {[
              { status: 'Overdue', count: 0, amount: '$0.00', color: RiseColors.error },
              { status: 'Not paid', count: 0, amount: '$0.00', color: RiseColors.warning },
              { status: 'Partially paid', count: 0, amount: '$0.00', color: RiseColors.info },
            ].map((item, index) => (
              <View key={index} style={styles.invoiceItem}>
                <View style={styles.invoiceLeft}>
                  <View style={[styles.invoiceDot, { backgroundColor: item.color }]} />
                  <Text style={styles.invoiceStatus}>{item.status}</Text>
                </View>
                <View style={styles.invoiceRight}>
                  <View style={styles.invoiceBar} />
                  <Text style={styles.invoiceCount}>{item.count}</Text>
                  <Text style={styles.invoiceAmount}>{item.amount}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Income vs Expenses Chart Placeholder */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="pie-chart-outline" size={20} color={RiseColors.text} />
              <Text style={styles.sectionTitle}>Income vs Expenses</Text>
            </View>
          </View>
          <View style={styles.chartPlaceholder}>
            <Ionicons name="bar-chart-outline" size={64} color={RiseColors.borderDark} />
            <Text style={styles.chartPlaceholderText}>Gráfico próximamente</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="time-outline" size={20} color={RiseColors.text} />
              <Text style={styles.sectionTitle}>Actividad Reciente</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todo</Text>
            </TouchableOpacity>
          </View>

          {recent_users.slice(0, 5).map((user: any) => (
            <View key={user.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: RiseColors.primaryLight }]}>
                <Ionicons name="person-add" size={20} color={RiseColors.primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Nuevo cliente registrado</Text>
                <Text style={styles.activitySubtitle}>{user.name}</Text>
                <Text style={styles.activityTime}>
                  {format(new Date(user.created_at), "dd MMM 'a las' HH:mm", { locale: es })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: RiseColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: RiseColors.background,
  },
  loadingText: {
    fontSize: 16,
    color: RiseColors.textGray,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: RiseColors.white,
    borderBottomWidth: 1,
    borderBottomColor: RiseColors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: RiseColors.white,
    letterSpacing: 1,
  },
  headerInfo: {
    gap: 2,
  },
  headerGreeting: {
    fontSize: 16,
    fontWeight: '700',
    color: RiseColors.text,
  },
  headerDate: {
    fontSize: 13,
    color: RiseColors.textGray,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: RiseColors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: RiseColors.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: RiseColors.white,
  },
  clockCard: {
    margin: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(233, 30, 99, 0.15)',
      },
      default: {
        shadowColor: RiseColors.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 5,
      },
    }),
  },
  clockCardGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  clockCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  clockIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: RiseColors.white,
  },
  clockCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  clockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: RiseColors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clockInButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: RiseColors.secondary,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statsCol: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: RiseColors.text,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: RiseColors.primary,
  },
  projectsCard: {
    backgroundColor: RiseColors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  projectsDueCard: {
    padding: 24,
  },
  projectsDueContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectsDueIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectsDueRight: {
    alignItems: 'flex-end',
  },
  projectsDueAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: RiseColors.white,
    letterSpacing: -1,
  },
  projectsDueLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontWeight: '600',
  },
  projectsStatsRow: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  projectStat: {
    flex: 1,
    alignItems: 'center',
  },
  projectStatDivider: {
    width: 1,
    backgroundColor: RiseColors.border,
  },
  projectStatNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: RiseColors.text,
    letterSpacing: -0.5,
  },
  projectStatLabel: {
    fontSize: 13,
    color: RiseColors.textGray,
    marginTop: 4,
    fontWeight: '600',
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  progressLabel: {
    fontSize: 14,
    color: RiseColors.textGray,
    marginBottom: 8,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: RiseColors.backgroundGray,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: RiseColors.success,
    borderRadius: 4,
  },
  remindersRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: RiseColors.border,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 32,
  },
  reminderItem: {
    flex: 1,
    gap: 4,
  },
  reminderNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: RiseColors.secondary,
    letterSpacing: -0.5,
  },
  reminderLabel: {
    fontSize: 12,
    color: RiseColors.textGray,
    fontWeight: '600',
  },
  reminderValue: {
    fontSize: 13,
    color: RiseColors.text,
    fontWeight: '600',
    marginTop: 2,
  },
  invoiceList: {
    backgroundColor: RiseColors.white,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  invoiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invoiceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  invoiceStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: RiseColors.text,
  },
  invoiceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  invoiceBar: {
    width: 100,
    height: 8,
    backgroundColor: RiseColors.backgroundGray,
    borderRadius: 4,
  },
  invoiceCount: {
    fontSize: 14,
    fontWeight: '700',
    color: RiseColors.text,
    minWidth: 20,
    textAlign: 'right',
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: RiseColors.text,
    minWidth: 60,
    textAlign: 'right',
  },
  chartPlaceholder: {
    backgroundColor: RiseColors.white,
    borderRadius: 16,
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: RiseColors.textGray,
    marginTop: 12,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: RiseColors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: RiseColors.text,
  },
  activitySubtitle: {
    fontSize: 13,
    color: RiseColors.textGray,
    fontWeight: '500',
  },
  activityTime: {
    fontSize: 12,
    color: RiseColors.textLight,
    marginTop: 2,
  },
});
