/**
 * Admin Shipments Management
 * Manage USPS shipments to clients
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import uspsService, { Shipment } from '../../services/usps';
import AdminHeader from '../../components/admin/AdminHeader';

const AdminShipments = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      const data = await uspsService.getAllShipments();
      setShipments(data);
    } catch (error) {
      console.error('Error loading shipments:', error);
      Alert.alert('Error', 'No se pudieron cargar los envíos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadShipments();
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Delivered')) return '#10b981';
    if (status.includes('Transit') || status.includes('Out for Delivery'))
      return '#3b82f6';
    if (status.includes('Exception')) return '#ef4444';
    return '#6b7280';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderShipmentCard = ({ item }: { item: Shipment }) => (
    <TouchableOpacity
      style={styles.shipmentCard}
      onPress={() => {
        Alert.alert(
          `📦 ${item.description}`,
          `Tracking: ${item.tracking_number}\n\nEstado: ${item.current_status}\n\nCreado: ${formatDate(
            item.created_at
          )}`
        );
      }}
    >
      <View style={styles.shipmentHeader}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube" size={28} color="#4E79A7" />
        </View>
        <View style={styles.shipmentInfo}>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.trackingNumber}>
            📋 {item.tracking_number}
          </Text>
          <Text style={styles.serviceType}>{item.service_type}</Text>
        </View>
      </View>

      <View
        style={[
          styles.statusBadge,
          { backgroundColor: `${getStatusColor(item.current_status)}20` },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(item.current_status) },
          ]}
        />
        <Text
          style={[
            styles.statusText,
            { color: getStatusColor(item.current_status) },
          ]}
        >
          {item.current_status}
        </Text>
      </View>

      <View style={styles.shipmentFooter}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.footerText}>
            Enviado: {formatDate(item.created_at)}
          </Text>
        </View>
        {item.delivered_at && (
          <View style={styles.footerItem}>
            <Ionicons name="checkmark-done" size={14} color="#10b981" />
            <Text style={[styles.footerText, { color: '#10b981' }]}>
              Entregado: {formatDate(item.delivered_at)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4E79A7" />
        <Text style={styles.loadingText}>Cargando envíos...</Text>
      </View>
    );
  }

  const insets = useSafeAreaInsets();

  return (
    <View style={{flex: 1, backgroundColor: '#f5f5f5'}}>
      <AdminHeader title="USPS - Configuración" />
    <SafeAreaView style={styles.container} edges={['bottom']}>


      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{shipments.length}</Text>
          <Text style={styles.statLabel}>Total Envíos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {
              shipments.filter((s) => s.current_status.includes('Transit'))
                .length
            }
          </Text>
          <Text style={styles.statLabel}>En Tránsito</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {
              shipments.filter((s) => s.current_status.includes('Delivered'))
                .length
            }
          </Text>
          <Text style={styles.statLabel}>Entregados</Text>
        </View>
      </View>

      <FlatList
        data={shipments}
        renderItem={renderShipmentCard}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No hay envíos</Text>
            <Text style={styles.emptyText}>
              Crea un nuevo envío usando el botón +
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerGradient: {
    paddingBottom: 0,
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
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4E79A7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4E79A7',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  shipmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shipmentHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shipmentInfo: {
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  serviceType: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  shipmentFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default AdminShipments;
