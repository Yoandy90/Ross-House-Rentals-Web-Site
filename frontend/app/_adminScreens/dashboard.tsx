/**
 * Admin Dashboard
 * Main dashboard with metrics and overview
 */
import React, { useState, useEffect } from 'react';

import AdminHeader from '../../components/admin/AdminHeader';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MetricCard from '../../components/admin/MetricCard';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface DashboardStats {
  total_clients: number;
  active_clients: number;
  total_invoices: number;
  pending_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  total_revenue: number;
  pending_amount: number;
  monthly_revenue: number;
  total_shipments: number;
}

const AdminDashboard = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load multiple stats in parallel
      const [invoiceStats, clientsResponse] = await Promise.all([
        api.get('/admin/invoices/stats'),
        api.get('/admin/clients?limit=1'), // Only need pagination.total
      ]);

      const clientsTotal = clientsResponse.data.pagination?.total || clientsResponse.data.clients?.length || 0;
      const invoiceData = invoiceStats.data;

      setStats({
        total_clients: clientsTotal,
        active_clients: clientsTotal, // Use total as approximation
        total_invoices: invoiceData.total || 0,
        pending_invoices: invoiceData.pending || 0,
        paid_invoices: invoiceData.paid || 0,
        overdue_invoices: invoiceData.overdue || 0,
        total_revenue: invoiceData.total_revenue || 0,
        pending_amount: invoiceData.pending_amount || 0,
        monthly_revenue: invoiceData.monthly_revenue || 0,
        total_shipments: 0, // TODO: Get from shipments endpoint
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Dashboard" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4E79A7" />
          <Text style={styles.loadingText}>Cargando dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Dashboard" subtitle={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })} />
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bienvenido, Admin 👋</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications" size={24} color="#333" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stats?.pending_invoices || 0}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Primary Actions - Highlighted */}
        <View style={styles.primaryActionsSection}>
          <Text style={styles.primaryActionsTitle}>Acciones Principales</Text>
          <View style={styles.primaryActionsGrid}>
            <TouchableOpacity
              style={[styles.primaryActionCard, { backgroundColor: '#10b981' }]}
              onPress={() => router.push('/(admin)/create-client')}
            >
              <View style={styles.primaryActionIcon}>
                <Ionicons name="person-add" size={32} color="#fff" />
              </View>
              <Text style={styles.primaryActionTitle}>Crear Cliente</Text>
              <Text style={styles.primaryActionSubtitle}>Registrar nuevo cliente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionCard, { backgroundColor: '#3b82f6' }]}
              onPress={() => router.push('/(admin)/create-service')}
            >
              <View style={styles.primaryActionIcon}>
                <Ionicons name="document-text" size={32} color="#fff" />
              </View>
              <Text style={styles.primaryActionTitle}>Orden de Servicio</Text>
              <Text style={styles.primaryActionSubtitle}>Crear proyecto/trámite</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryActionCard, { backgroundColor: '#8b5cf6' }]}
              onPress={() => router.push('/(admin)/schedule-appointment')}
            >
              <View style={styles.primaryActionIcon}>
                <Ionicons name="calendar" size={32} color="#fff" />
              </View>
              <Text style={styles.primaryActionTitle}>Agendar Cita</Text>
              <Text style={styles.primaryActionSubtitle}>Programar reunión</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricRow}>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Total Clientes"
                value={stats?.total_clients || 0}
                icon="people"
                subtitle={`${stats?.active_clients || 0} activos`}
                colors={['#4E79A7', '#6B9BD1']}
              />
            </View>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Ingresos Mes"
                value={formatCurrency(stats?.monthly_revenue || 0)}
                icon="cash"
                trend={{ value: 12, isPositive: true }}
                colors={['#10b981', '#34d399']}
              />
            </View>
          </View>

          <MetricCard
            title="Ingresos Totales"
            value={formatCurrency(stats?.total_revenue || 0)}
            icon="trending-up"
            subtitle={`Pendiente: ${formatCurrency(stats?.pending_amount || 0)}`}
            colors={['#8b5cf6', '#a78bfa']}
          />

          <View style={styles.metricRow}>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Facturas Pendientes"
                value={stats?.pending_invoices || 0}
                icon="document-text"
                colors={['#f59e0b', '#fbbf24']}
              />
            </View>
            <View style={styles.metricHalf}>
              <MetricCard
                title="Facturas Vencidas"
                value={stats?.overdue_invoices || 0}
                icon="alert-circle"
                colors={['#ef4444', '#f87171']}
              />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/invoices')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="add-circle" size={32} color="#2563eb" />
              </View>
              <Text style={styles.actionTitle}>Nueva Factura</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/clients')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="person-add" size={32} color="#16a34a" />
              </View>
              <Text style={styles.actionTitle}>Nuevo Cliente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/shipments')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="cube" size={32} color="#d97706" />
              </View>
              <Text style={styles.actionTitle}>Enviar Documento</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/settings')}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#e9d5ff' }]}>
                <Ionicons name="settings" size={32} color="#9333ea" />
              </View>
              <Text style={styles.actionTitle}>Configuración</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actividad Reciente</Text>
          <View style={styles.activityCard}>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: '#10b981' }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Nueva factura creada</Text>
                <Text style={styles.activityTime}>Hace 2 horas</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: '#3b82f6' }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Cliente registrado</Text>
                <Text style={styles.activityTime}>Hace 5 horas</Text>
              </View>
            </View>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: '#f59e0b' }]} />
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Pago recibido</Text>
                <Text style={styles.activityTime}>Ayer</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  primaryActionsSection: {
    marginBottom: 32,
  },
  primaryActionsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  primaryActionsGrid: {
    gap: 12,
  },
  primaryActionCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryActionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryActionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  metricsGrid: {
    marginBottom: 24,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metricHalf: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 13,
    color: '#9ca3af',
  },
});

export default AdminDashboard;
