/**
 * Shipments Screen - Enhanced Version
 * Shows USPS shipments with modern design and full functionality
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import uspsService, { Shipment, ServiceOrder } from '../../services/usps';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useThemeColors } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrackingEvent {
  date: string;
  location: string;
  description: string;
  status: string;
}

const ShipmentsScreen = () => {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'transit' | 'delivered'>('all');
  const [viewMode, setViewMode] = useState<'orders' | 'shipments'>('orders');
  const fadeAnim = useState(new Animated.Value(0))[0];

  const categoryIcons: Record<string, { icon: string; color: string }> = {
    taxes: { icon: 'receipt-outline', color: '#3B82F6' },
    itin: { icon: 'card-outline', color: '#8B5CF6' },
    immigration: { icon: 'earth-outline', color: '#10B981' },
    passport: { icon: 'book-outline', color: '#F59E0B' },
    legal: { icon: 'briefcase-outline', color: '#EF4444' },
    other: { icon: 'cube-outline', color: '#6B7280' },
  };

  useEffect(() => {
    loadShipments();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadShipments = async () => {
    try {
      const [shipmentsData, ordersData] = await Promise.all([
        uspsService.getMyShipments().catch(() => []),
        uspsService.getMyServiceOrders().catch(() => []),
      ]);
      setShipments(shipmentsData);
      setServiceOrders(ordersData);
    } catch (error: any) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShipments();
  }, []);

  const getStatusInfo = (status: string) => {
    if (status.includes('Delivered')) {
      return { color: '#10B981', icon: 'checkmark-circle', label: t('shipments.delivered'), bg: '#10B98115' };
    }
    if (status.includes('Out for Delivery')) {
      return { color: '#F59E0B', icon: 'car', label: t('shipments.outForDelivery'), bg: '#F59E0B15' };
    }
    if (status.includes('Transit')) {
      return { color: '#3B82F6', icon: 'airplane', label: t('shipments.inTransit'), bg: '#3B82F615' };
    }
    if (status.includes('Exception') || status.includes('Alert')) {
      return { color: '#EF4444', icon: 'alert-circle', label: t('shipments.attention'), bg: '#EF444415' };
    }
    if (status.includes('Processing') || status.includes('Accepted')) {
      return { color: '#8B5CF6', icon: 'cube', label: t('shipments.processing'), bg: '#8B5CF615' };
    }
    return { color: '#6B7280', icon: 'cube-outline', label: t('common.pending', 'Pendiente'), bg: '#6B728015' };
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "d 'de' MMMM, yyyy", {
        locale: i18n.language === 'es' ? es : undefined,
      });
    } catch {
      return dateString;
    }
  };

  const formatRelativeDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: i18n.language === 'es' ? es : undefined,
      });
    } catch {
      return dateString;
    }
  };

  const openUSPSTracking = (trackingNumber: string) => {
    const url = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    Linking.openURL(url);
  };

  // Service Order status info
  const getOrderStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { color: '#F59E0B', icon: 'time-outline' as const, label: i18n.language === 'es' ? 'Pendiente' : 'Pending', bg: '#F59E0B15' };
      case 'processing': return { color: '#3B82F6', icon: 'construct-outline' as const, label: i18n.language === 'es' ? 'En Proceso' : 'Processing', bg: '#3B82F615' };
      case 'shipped': return { color: '#8B5CF6', icon: 'send-outline' as const, label: i18n.language === 'es' ? 'Enviado' : 'Shipped', bg: '#8B5CF615' };
      case 'in_transit': return { color: '#3B82F6', icon: 'airplane-outline' as const, label: i18n.language === 'es' ? 'En Tránsito' : 'In Transit', bg: '#3B82F615' };
      case 'delivered': return { color: '#10B981', icon: 'checkmark-circle-outline' as const, label: i18n.language === 'es' ? 'Entregado' : 'Delivered', bg: '#10B98115' };
      case 'completed': return { color: '#059669', icon: 'checkmark-done-circle-outline' as const, label: i18n.language === 'es' ? 'Completado' : 'Completed', bg: '#05966915' };
      default: return { color: '#6B7280', icon: 'help-circle-outline' as const, label: status, bg: '#6B728015' };
    }
  };

  const getProgressWidth = (status: string) => {
    switch (status) {
      case 'pending': return '10%';
      case 'processing': return '25%';
      case 'shipped': return '45%';
      case 'in_transit': return '65%';
      case 'delivered': return '90%';
      case 'completed': return '100%';
      default: return '10%';
    }
  };

  const renderServiceOrderCard = ({ item }: { item: ServiceOrder }) => {
    const statusInfo = getOrderStatusInfo(item.status);
    const catInfo = categoryIcons[item.service_category] || categoryIcons.other;

    return (
      <Animated.View style={[styles.shipmentCard, { opacity: fadeAnim }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { setSelectedOrder(item); setShowOrderModal(true); }}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusIcon, { backgroundColor: catInfo.color + '15' }]}>
              <Ionicons name={catInfo.icon as any} size={24} color={catInfo.color} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.shipmentTitle} numberOfLines={1}>
                {item.service_name}
              </Text>
              <Text style={styles.shipmentDate}>
                {i18n.language === 'es' ? 'Creado' : 'Created'} {formatRelativeDate(item.created_at)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* Tracking Number */}
          {item.tracking_number ? (
            <TouchableOpacity
              style={styles.trackingRow}
              onPress={() => openUSPSTracking(item.tracking_number)}
            >
              <Ionicons name="barcode-outline" size={18} color={colors.primary} />
              <Text style={styles.trackingNumber}>{item.tracking_number}</Text>
              <Ionicons name="open-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.trackingRow, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time-outline" size={18} color="#D97706" />
              <Text style={[styles.trackingNumber, { color: '#D97706' }]}>
                {i18n.language === 'es' ? 'Pendiente de envío' : 'Pending shipment'}
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: getProgressWidth(item.status),
                    backgroundColor: statusInfo.color,
                  }
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{i18n.language === 'es' ? 'Pendiente' : 'Pending'}</Text>
              <Text style={styles.progressLabel}>{i18n.language === 'es' ? 'En tránsito' : 'Transit'}</Text>
              <Text style={styles.progressLabel}>{i18n.language === 'es' ? 'Entregado' : 'Delivered'}</Text>
            </View>
          </View>

          {/* Return label indicator */}
          {item.requires_return_label && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 4, gap: 6 }}>
              <Ionicons name="swap-horizontal-outline" size={16} color="#8B5CF6" />
              <Text style={{ fontSize: 12, color: '#8B5CF6', fontWeight: '600' }}>
                {i18n.language === 'es' ? 'Incluye label de retorno' : 'Includes return label'}
              </Text>
              {item.return_tracking_number && (
                <Text style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>
                  ({item.return_tracking_number})
                </Text>
              )}
            </View>
          )}

          {/* Tracking status */}
          {item.tracking_status ? (
            <View style={styles.deliveryEstimate}>
              <Ionicons name="navigate-outline" size={18} color="#3B82F6" />
              <Text style={[styles.deliveryEstimateText, { color: '#3B82F6' }]}>
                {item.tracking_status}
              </Text>
            </View>
          ) : null}

          {/* Delivered Date */}
          {item.status === 'delivered' && item.delivered_at && (
            <View style={styles.deliveredBadge}>
              <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
              <Text style={styles.deliveredText}>
                {i18n.language === 'es' ? 'Entregado el' : 'Delivered on'} {formatDate(item.delivered_at)}
              </Text>
            </View>
          )}

          {/* Destination Info */}
          {item.to_address?.city && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 4, gap: 6 }}>
              <Ionicons name="location-outline" size={14} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                {item.to_address.name ? `${item.to_address.name} — ` : ''}{item.to_address.city}, {item.to_address.state}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Service Order Detail Modal
  const renderOrderModal = () => (
    <Modal
      visible={showOrderModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowOrderModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {i18n.language === 'es' ? 'Detalles del Servicio' : 'Service Details'}
              </Text>
              <Text style={styles.modalSubtitle}>{selectedOrder?.service_name}</Text>
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowOrderModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {selectedOrder && (
              <>
                {/* Status Card */}
                <View style={styles.modalStatusCard}>
                  <View style={[styles.modalStatusIcon, { backgroundColor: getOrderStatusInfo(selectedOrder.status).bg }]}>
                    <Ionicons name={getOrderStatusInfo(selectedOrder.status).icon as any} size={32} color={getOrderStatusInfo(selectedOrder.status).color} />
                  </View>
                  <Text style={styles.modalStatusText}>{getOrderStatusInfo(selectedOrder.status).label}</Text>
                </View>

                {/* Info Cards */}
                <View style={styles.modalInfoCards}>
                  {selectedOrder.tracking_number ? (
                    <View style={styles.modalInfoCard}>
                      <Ionicons name="barcode" size={20} color={colors.primary} />
                      <Text style={styles.modalInfoLabel}>Tracking</Text>
                      <Text style={[styles.modalInfoValue, { fontSize: 12, fontFamily: 'monospace' }]}>{selectedOrder.tracking_number}</Text>
                    </View>
                  ) : (
                    <View style={[styles.modalInfoCard, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="time-outline" size={20} color="#D97706" />
                      <Text style={[styles.modalInfoLabel, { color: '#D97706' }]}>
                        {i18n.language === 'es' ? 'Sin tracking' : 'No tracking'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalInfoCard}>
                    <Ionicons name="pricetag" size={20} color={colors.primary} />
                    <Text style={styles.modalInfoLabel}>{i18n.language === 'es' ? 'Precio' : 'Price'}</Text>
                    <Text style={styles.modalInfoValue}>${selectedOrder.price?.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Addresses */}
                {selectedOrder.from_address?.street && (
                  <View style={{ backgroundColor: '#F0FFF4', padding: 14, borderRadius: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, color: '#276749', fontWeight: '700', marginBottom: 4 }}>
                      {i18n.language === 'es' ? '📤 REMITENTE' : '📤 FROM'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#2D3748' }}>
                      {selectedOrder.from_address.name}{'\n'}
                      {selectedOrder.from_address.street}{'\n'}
                      {selectedOrder.from_address.city}, {selectedOrder.from_address.state} {selectedOrder.from_address.zip}
                    </Text>
                  </View>
                )}

                {selectedOrder.to_address?.street && (
                  <View style={{ backgroundColor: '#FFF5F5', padding: 14, borderRadius: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, color: '#C53030', fontWeight: '700', marginBottom: 4 }}>
                      {i18n.language === 'es' ? '📥 DESTINATARIO' : '📥 TO'}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#2D3748' }}>
                      {selectedOrder.to_address.name}{'\n'}
                      {selectedOrder.to_address.street}{'\n'}
                      {selectedOrder.to_address.city}, {selectedOrder.to_address.state} {selectedOrder.to_address.zip}
                    </Text>
                  </View>
                )}

                {/* Return label info */}
                {selectedOrder.requires_return_label && (
                  <View style={{ backgroundColor: '#FAF5FF', padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E9D8FD' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="swap-horizontal" size={18} color="#805AD5" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#553C9A' }}>
                        {i18n.language === 'es' ? 'Label de Retorno' : 'Return Label'}
                      </Text>
                    </View>
                    {selectedOrder.return_tracking_number ? (
                      <Text style={{ fontSize: 12, color: '#805AD5', fontFamily: 'monospace', marginTop: 4 }}>
                        {selectedOrder.return_tracking_number}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: '#A0AEC0', marginTop: 4 }}>
                        {i18n.language === 'es' ? 'Pendiente de asignar' : 'Pending assignment'}
                      </Text>
                    )}
                  </View>
                )}

                {/* Tracking History Timeline */}
                {selectedOrder.tracking_history?.length > 0 && (
                  <View style={styles.timelineContainer}>
                    <Text style={styles.timelineTitle}>
                      {i18n.language === 'es' ? 'Historial de Rastreo' : 'Tracking History'}
                    </Text>
                    {selectedOrder.tracking_history.map((evt, idx) => (
                      <View key={idx} style={styles.timelineItem}>
                        <View style={styles.timelineDot}>
                          {idx === 0 && <Ionicons name="ellipse" size={12} color={colors.primary} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStatus}>{evt.description || evt.status}</Text>
                          <Text style={styles.timelineLocation}>{evt.location}</Text>
                          <Text style={styles.timelineDate}>{evt.date} {evt.time}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Track on USPS.com */}
                {selectedOrder.tracking_number && (
                  <TouchableOpacity
                    style={styles.modalAction}
                    onPress={() => openUSPSTracking(selectedOrder.tracking_number)}
                  >
                    <Ionicons name="globe-outline" size={20} color="#fff" />
                    <Text style={styles.modalActionText}>
                      {i18n.language === 'es' ? 'Ver en USPS.com' : 'View on USPS.com'}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const filteredOrders = serviceOrders.filter(o => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'delivered') return o.status === 'delivered' || o.status === 'completed';
    if (activeFilter === 'transit') return o.status !== 'delivered' && o.status !== 'completed';
    return true;
  });

  const filteredShipments = shipments.filter(s => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'delivered') return s.current_status?.includes('Delivered');
    if (activeFilter === 'transit') return !s.current_status?.includes('Delivered');
    return true;
  });

  const stats = {
    total: shipments.length,
    inTransit: shipments.filter(s => !s.current_status?.includes('Delivered')).length,
    delivered: shipments.filter(s => s.current_status?.includes('Delivered')).length,
  };

  const orderStats = {
    total: serviceOrders.length,
    inTransit: serviceOrders.filter(o => !['delivered', 'completed'].includes(o.status)).length,
    delivered: serviceOrders.filter(o => ['delivered', 'completed'].includes(o.status)).length,
  };

  const activeStats = viewMode === 'orders' ? orderStats : stats;

  const renderShipmentCard = ({ item, index }: { item: Shipment; index: number }) => {
    const statusInfo = getStatusInfo(item.current_status);
    
    return (
      <Animated.View
        style={[
          styles.shipmentCard,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            setSelectedShipment(item);
            setShowTrackingModal(true);
          }}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusIcon, { backgroundColor: statusInfo.bg }]}>
              <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.shipmentTitle} numberOfLines={1}>
                {item.description || 'Documento'}
              </Text>
              <Text style={styles.shipmentDate}>
                Enviado {formatRelativeDate(item.created_at)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* Tracking Number */}
          <TouchableOpacity 
            style={styles.trackingRow}
            onPress={() => openUSPSTracking(item.tracking_number)}
          >
            <Ionicons name="barcode-outline" size={18} color={colors.primary} />
            <Text style={styles.trackingNumber}>{item.tracking_number}</Text>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </TouchableOpacity>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: item.current_status.includes('Delivered') ? '100%' : 
                           item.current_status.includes('Out for Delivery') ? '80%' :
                           item.current_status.includes('Transit') ? '50%' : '20%',
                    backgroundColor: statusInfo.color,
                  }
                ]} 
              />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{t('shipments.sent', 'Enviado')}</Text>
              <Text style={styles.progressLabel}>{t('shipments.inTransit')}</Text>
              <Text style={styles.progressLabel}>{t('shipments.delivered')}</Text>
            </View>
          </View>

          {/* Expected Delivery */}
          {item.current_tracking?.expected_delivery_date && !item.current_status.includes('Delivered') && (
            <View style={styles.deliveryEstimate}>
              <Ionicons name="calendar-outline" size={18} color="#F59E0B" />
              <Text style={styles.deliveryEstimateText}>
                Entrega estimada: {item.current_tracking.expected_delivery_date}
              </Text>
            </View>
          )}

          {/* Delivered Badge */}
          {item.current_status.includes('Delivered') && item.delivered_at && (
            <View style={styles.deliveredBadge}>
              <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
              <Text style={styles.deliveredText}>
                Entregado el {formatDate(item.delivered_at)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
      <View style={styles.emptyIconContainer}>
        <LinearGradient
          colors={[colors.primary + '20', colors.primary + '05']}
          style={styles.emptyIconBg}
        >
          <Ionicons name="cube-outline" size={64} color={colors.primary} />
        </LinearGradient>
      </View>
      
      <Text style={styles.emptyTitle}>{t('shipments.noShipmentsTitle', 'Sin envíos por ahora')}</Text>
      <Text style={styles.emptyText}>
        Cuando Ross Tax te envíe documentos importantes, aparecerán aquí con seguimiento en tiempo real.
      </Text>

      <View style={styles.emptyFeatures}>
        <View style={styles.emptyFeatureItem}>
          <View style={[styles.emptyFeatureIcon, { backgroundColor: '#3B82F615' }]}>
            <Ionicons name="location" size={20} color="#3B82F6" />
          </View>
          <Text style={styles.emptyFeatureText}>{t('shipments.liveTracking', 'Seguimiento en vivo')}</Text>
        </View>
        <View style={styles.emptyFeatureItem}>
          <View style={[styles.emptyFeatureIcon, { backgroundColor: '#10B98115' }]}>
            <Ionicons name="notifications" size={20} color="#10B981" />
          </View>
          <Text style={styles.emptyFeatureText}>{t('shipments.notificationsFeature', 'Notificaciones')}</Text>
        </View>
        <View style={styles.emptyFeatureItem}>
          <View style={[styles.emptyFeatureIcon, { backgroundColor: '#F59E0B15' }]}>
            <Ionicons name="time" size={20} color="#F59E0B" />
          </View>
          <Text style={styles.emptyFeatureText}>{t('shipments.deliveryDate', 'Fecha de entrega')}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.emptyAction} onPress={onRefresh}>
        <Ionicons name="refresh" size={20} color={colors.primary} />
        <Text style={styles.emptyActionText}>{t('shipments.refresh', 'Actualizar')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTrackingModal = () => (
    <Modal
      visible={showTrackingModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowTrackingModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Detalles del Envío</Text>
              <Text style={styles.modalSubtitle}>{selectedShipment?.description}</Text>
            </View>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setShowTrackingModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {selectedShipment && (
              <>
                {/* Status Card */}
                <View style={styles.modalStatusCard}>
                  <View style={[
                    styles.modalStatusIcon, 
                    { backgroundColor: getStatusInfo(selectedShipment.current_status).bg }
                  ]}>
                    <Ionicons 
                      name={getStatusInfo(selectedShipment.current_status).icon as any} 
                      size={32} 
                      color={getStatusInfo(selectedShipment.current_status).color} 
                    />
                  </View>
                  <Text style={styles.modalStatusText}>
                    {getStatusInfo(selectedShipment.current_status).label}
                  </Text>
                  <Text style={styles.modalStatusDate}>
                    Actualizado {formatRelativeDate(selectedShipment.updated_at || selectedShipment.created_at)}
                  </Text>
                </View>

                {/* Info Cards */}
                <View style={styles.modalInfoCards}>
                  <View style={styles.modalInfoCard}>
                    <Ionicons name="barcode" size={20} color={colors.primary} />
                    <Text style={styles.modalInfoLabel}>{t('shipments.tracking', 'Tracking')}</Text>
                    <Text style={styles.modalInfoValue}>{selectedShipment.tracking_number}</Text>
                  </View>
                  <View style={styles.modalInfoCard}>
                    <Ionicons name="mail" size={20} color={colors.primary} />
                    <Text style={styles.modalInfoLabel}>{t('shipments.serviceLabel', 'Servicio')}</Text>
                    <Text style={styles.modalInfoValue}>{selectedShipment.service_type || 'USPS'}</Text>
                  </View>
                </View>

                {/* Timeline */}
                <View style={styles.timelineContainer}>
                  <Text style={styles.timelineTitle}>{t('shipments.trackingHistory', 'Historial de seguimiento')}</Text>
                  
                  {selectedShipment.current_tracking?.tracking_events?.length > 0 ? (
                    selectedShipment.current_tracking.tracking_events.map((event: TrackingEvent, idx: number) => (
                      <View key={idx} style={styles.timelineItem}>
                        <View style={styles.timelineDot}>
                          {idx === 0 && <Ionicons name="ellipse" size={12} color={colors.primary} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineStatus}>{event.description || event.status}</Text>
                          <Text style={styles.timelineLocation}>{event.location}</Text>
                          <Text style={styles.timelineDate}>{formatDate(event.date)}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.noTimelineData}>
                      <Ionicons name="time-outline" size={24} color="#ccc" />
                      <Text style={styles.noTimelineText}>
                        No hay eventos de seguimiento disponibles aún
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <TouchableOpacity 
                  style={styles.modalAction}
                  onPress={() => openUSPSTracking(selectedShipment.tracking_number)}
                >
                  <Ionicons name="globe-outline" size={20} color="#fff" />
                  <Text style={styles.modalActionText}>Ver en USPS.com</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('shipments.loading', 'Cargando envíos...')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Modern Gradient Header */}
      <LinearGradient
        colors={['#6C1110', '#8B1515', '#6C1110']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View style={styles.headerIconBg}>
                <Ionicons name="cube" size={28} color="#fff" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>{t('shipments.title', 'Mis Envíos')}</Text>
                <Text style={styles.headerSubtitle}>{t('shipments.trackingSubtitle', 'Seguimiento de documentos')}</Text>
              </View>
            </View>

            {/* View Mode Toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginBottom: 12, padding: 3 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: viewMode === 'orders' ? 'rgba(255,255,255,0.25)' : 'transparent' }}
                onPress={() => setViewMode('orders')}
              >
                <Text style={{ color: '#fff', fontWeight: viewMode === 'orders' ? '700' : '400', fontSize: 13 }}>
                  {i18n.language === 'es' ? '📋 Servicios' : '📋 Services'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: viewMode === 'shipments' ? 'rgba(255,255,255,0.25)' : 'transparent' }}
                onPress={() => setViewMode('shipments')}
              >
                <Text style={{ color: '#fff', fontWeight: viewMode === 'shipments' ? '700' : '400', fontSize: 13 }}>
                  📦 {i18n.language === 'es' ? 'Envíos' : 'Shipments'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <TouchableOpacity 
                style={[styles.statCard, activeFilter === 'all' && styles.statCardActive]}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={[styles.statNumber, activeFilter === 'all' && styles.statNumberActive]}>
                  {activeStats.total}
                </Text>
                <Text style={[styles.statLabel, activeFilter === 'all' && styles.statLabelActive]}>
                  Total
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.statCard, activeFilter === 'transit' && styles.statCardActive]}
                onPress={() => setActiveFilter('transit')}
              >
                <Text style={[styles.statNumber, activeFilter === 'transit' && styles.statNumberActive]}>
                  {activeStats.inTransit}
                </Text>
                <Text style={[styles.statLabel, activeFilter === 'transit' && styles.statLabelActive]}>
                  {i18n.language === 'es' ? 'En tránsito' : 'In transit'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.statCard, activeFilter === 'delivered' && styles.statCardActive]}
                onPress={() => setActiveFilter('delivered')}
              >
                <Text style={[styles.statNumber, activeFilter === 'delivered' && styles.statNumberActive]}>
                  {activeStats.delivered}
                </Text>
                <Text style={[styles.statLabel, activeFilter === 'delivered' && styles.statLabelActive]}>
                  {i18n.language === 'es' ? 'Entregados' : 'Delivered'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Service Orders List */}
      {viewMode === 'orders' ? (
        <FlatList
          data={filteredOrders}
          renderItem={renderServiceOrderCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filteredShipments}
          renderItem={renderShipmentCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Tracking Modal (old shipments) */}
      {renderTrackingModal()}

      {/* Service Order Detail Modal */}
      {renderOrderModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  // Header
  header: {
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 14,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statCardActive: {
    backgroundColor: '#fff',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  statNumberActive: {
    color: '#6C1110',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statLabelActive: {
    color: '#6C1110',
  },
  // List
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  // Shipment Card
  shipmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  shipmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  shipmentDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  trackingNumber: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#374151',
  },
  // Progress
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  // Delivery
  deliveryEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  deliveryEstimateText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  deliveredText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '500',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyFeatures: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  emptyFeatureItem: {
    alignItems: 'center',
    gap: 8,
  },
  emptyFeatureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyFeatureText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  emptyActionText: {
    fontSize: 15,
    color: '#6C1110',
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    padding: 20,
  },
  modalStatusCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  modalStatusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalStatusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  modalStatusDate: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  modalInfoCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modalInfoCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  // Timeline
  timelineContainer: {
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineContent: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: '#E5E7EB',
    paddingLeft: 16,
    paddingBottom: 16,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  timelineLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  noTimelineData: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  noTimelineText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  modalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6C1110',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ShipmentsScreen;
