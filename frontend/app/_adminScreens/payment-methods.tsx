import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useRouter } from 'expo-router';
import AdminHeader from '../../components/admin/AdminHeader';
import { useTranslation } from 'react-i18next';

interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  created_at: string;
  // Additional Stripe data (when available)
  cardholder_name?: string;
  country?: string;
  funding?: string; // credit, debit, prepaid
}

interface PaymentMethodWithUser extends PaymentMethod {
  user_email?: string;
  user_name?: string;
}

export default function AdminPaymentMethodsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodWithUser[]>([]);
  const [manualMethods, setManualMethods] = useState<any[]>([]);
  const [filteredMethods, setFilteredMethods] = useState<PaymentMethodWithUser[]>([]);
  const [filteredManualMethods, setFilteredManualMethods] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [decryptedData, setDecryptedData] = useState<Map<string, any>>(new Map());
  const [decrypting, setDecrypting] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    total: 0,
    active_customers: 0,
    manual_total: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterMethods();
  }, [searchQuery, paymentMethods]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load both Stripe and Manual payment methods from admin endpoints
      const [methodsResponse, manualResponse] = await Promise.all([
        api.get('/api/payments/admin/payment-methods').catch(() => ({ data: [] })),
        api.get('/api/payments/admin/manual-payment-methods').catch(() => ({ data: [] }))
      ]);
      
      const allMethods: PaymentMethodWithUser[] = methodsResponse.data || [];
      const allManualMethods: any[] = manualResponse.data || [];
      
      // Calculate stats
      const uniqueUsers = new Set([
        ...allMethods.map(m => m.user_id),
        ...allManualMethods.map(m => m.user_id)
      ]).size;
      
      setStats({
        total: allMethods.length,
        active_customers: uniqueUsers,
        manual_total: allManualMethods.length,
      });
      
      setPaymentMethods(allMethods);
      setManualMethods(allManualMethods);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los métodos de pago');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterMethods = () => {
    if (!searchQuery.trim()) {
      setFilteredMethods(paymentMethods);
      setFilteredManualMethods(manualMethods);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    
    const filtered = paymentMethods.filter(method => 
      method.user_email?.toLowerCase().includes(query) ||
      method.user_name?.toLowerCase().includes(query) ||
      method.last4.includes(query) ||
      method.brand.toLowerCase().includes(query)
    );
    
    const filteredManual = manualMethods.filter(method =>
      method.user_email?.toLowerCase().includes(query) ||
      method.user_name?.toLowerCase().includes(query) ||
      method.last4.includes(query) ||
      method.brand.toLowerCase().includes(query)
    );
    
    setFilteredMethods(filtered);
    setFilteredManualMethods(filteredManual);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleCardExpansion = (methodId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(methodId)) {
        newSet.delete(methodId);
      } else {
        newSet.add(methodId);
      }
      return newSet;
    });
  };

  const getCardBrandIcon = (brand: string): any => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return 'card';
    if (brandLower.includes('mastercard')) return 'card';
    if (brandLower.includes('amex') || brandLower.includes('american')) return 'card';
    if (brandLower.includes('discover')) return 'card';
    return 'card';
  };

  const getCardBrandColor = (brand: string): string => {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes('visa')) return '#1A1F71';
    if (brandLower.includes('mastercard')) return '#EB001B';
    if (brandLower.includes('amex') || brandLower.includes('american')) return '#006FCF';
    if (brandLower.includes('discover')) return '#FF6000';
    return colors.primary;
  };

  const formatCardType = (funding?: string): string => {
    if (!funding) return 'Tipo desconocido';
    return funding === 'credit' ? 'Crédito' : funding === 'debit' ? 'Débito' : 'Prepago';
  };

  const isCardExpired = (expMonth: number, expYear: number): boolean => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    if (expYear < currentYear) return true;
    if (expYear === currentYear && expMonth < currentMonth) return true;
    return false;
  };

  const renderMethodCard = (method: PaymentMethodWithUser) => {
    const isExpanded = expandedCards.has(method.id);
    const expired = isCardExpired(method.exp_month, method.exp_year);
    const brandColor = getCardBrandColor(method.brand);

    return (
      <View key={method.id} style={styles.methodCard}>
        {/* Card Header - Always Visible */}
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={[styles.cardIconContainer, { backgroundColor: brandColor + '15' }]}>
              <Ionicons 
                name={getCardBrandIcon(method.brand)} 
                size={28} 
                color={brandColor} 
              />
            </View>
            <View style={styles.cardDetails}>
              <Text style={styles.userName}>{method.user_name || 'Sin nombre'}</Text>
              <Text style={styles.userEmail}>{method.user_email}</Text>
              <View style={styles.cardRow}>
                <Text style={[styles.cardBrand, { color: brandColor }]}>
                  {method.brand.toUpperCase()}
                </Text>
                <Text style={styles.cardNumber}>•••• {method.last4}</Text>
              </View>
            </View>
          </View>
          
          {/* Toggle Button */}
          <TouchableOpacity 
            onPress={() => toggleCardExpansion(method.id)}
            style={styles.toggleButton}
          >
            <Ionicons 
              name={isExpanded ? "eye-off" : "eye"} 
              size={24} 
              color={colors.primary} 
            />
          </TouchableOpacity>
        </View>

        {/* Collapsed View - Basic Info */}
        {!isExpanded && (
          <View style={styles.collapsedInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textGray} />
              <Text style={[styles.infoText, expired && styles.expiredText]}>
                {expired ? '⚠️ Expirada' : 'Expira'}: {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
              </Text>
            </View>
            {method.is_default && (
              <View style={styles.defaultBadge}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={styles.defaultBadgeText}>Predeterminada</Text>
              </View>
            )}
          </View>
        )}

        {/* Expanded View - All Details */}
        {isExpanded && (
          <View style={styles.expandedInfo}>
            {/* Divider */}
            <View style={styles.divider} />
            
            {/* Detailed Information Grid */}
            <View style={styles.detailsGrid}>
              {/* Expiration */}
              <View style={styles.detailItem}>
                <View style={styles.detailLabel}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textGray} />
                  <Text style={styles.detailLabelText}>Fecha de Expiración</Text>
                </View>
                <Text style={[styles.detailValue, expired && styles.expiredText]}>
                  {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                  {expired && ' ⚠️ EXPIRADA'}
                </Text>
              </View>

              {/* Card Type */}
              <View style={styles.detailItem}>
                <View style={styles.detailLabel}>
                  <Ionicons name="card-outline" size={18} color={colors.textGray} />
                  <Text style={styles.detailLabelText}>Tipo de Tarjeta</Text>
                </View>
                <Text style={styles.detailValue}>
                  {formatCardType(method.funding)}
                </Text>
              </View>

              {/* Cardholder Name */}
              {method.cardholder_name && (
                <View style={styles.detailItem}>
                  <View style={styles.detailLabel}>
                    <Ionicons name="person-outline" size={18} color={colors.textGray} />
                    <Text style={styles.detailLabelText}>Nombre del Titular</Text>
                  </View>
                  <Text style={styles.detailValue}>{method.cardholder_name}</Text>
                </View>
              )}

              {/* Country */}
              {method.country && (
                <View style={styles.detailItem}>
                  <View style={styles.detailLabel}>
                    <Ionicons name="globe-outline" size={18} color={colors.textGray} />
                    <Text style={styles.detailLabelText}>País Emisor</Text>
                  </View>
                  <Text style={styles.detailValue}>{method.country}</Text>
                </View>
              )}

              {/* Payment Method ID */}
              <View style={styles.detailItem}>
                <View style={styles.detailLabel}>
                  <Ionicons name="key-outline" size={18} color={colors.textGray} />
                  <Text style={styles.detailLabelText}>ID de Pago</Text>
                </View>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {method.stripe_payment_method_id}
                </Text>
              </View>

              {/* Date Added */}
              <View style={styles.detailItem}>
                <View style={styles.detailLabel}>
                  <Ionicons name="time-outline" size={18} color={colors.textGray} />
                  <Text style={styles.detailLabelText}>Fecha de Registro</Text>
                </View>
                <Text style={styles.detailValue}>
                  {new Date(method.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            </View>

            {/* Status Badges */}
            <View style={styles.statusRow}>
              {method.is_default && (
                <View style={styles.statusBadge}>
                  <Ionicons name="star" size={14} color={colors.warning} />
                  <Text style={[styles.statusBadgeText, { color: colors.warning }]}>
                    Predeterminada
                  </Text>
                </View>
              )}
              
              <View style={[
                styles.statusBadge,
                { backgroundColor: method.stripe_payment_method_id.startsWith('pm_test_') ? colors.warning + '15' : colors.success + '15' }
              ]}>
                <Ionicons 
                  name={method.stripe_payment_method_id.startsWith('pm_test_') ? "flask" : "checkmark-circle"} 
                  size={14} 
                  color={method.stripe_payment_method_id.startsWith('pm_test_') ? colors.warning : colors.success} 
                />
                <Text style={[
                  styles.statusBadgeText,
                  { color: method.stripe_payment_method_id.startsWith('pm_test_') ? colors.warning : colors.success }
                ]}>
                  {method.stripe_payment_method_id.startsWith('pm_test_') ? 'Modo Prueba' : 'Modo Live'}
                </Text>
              </View>

              {expired && (
                <View style={[styles.statusBadge, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={[styles.statusBadgeText, { color: colors.error }]}>
                    Tarjeta Expirada
                  </Text>
                </View>
              )}
            </View>

            {/* Security Notice */}
            <View style={styles.securityNotice}>
              <Ionicons name="shield-checkmark" size={16} color={colors.success} />
              <Text style={styles.securityText}>
                Por seguridad PCI DSS, solo se muestran los últimos 4 dígitos. Los datos completos están protegidos por Stripe.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AdminHeader title="Métodos de Pago" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando métodos de pago...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminHeader title="Métodos de Pago" />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="card" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Métodos Guardados</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color={colors.success} />
            <Text style={styles.statValue}>{stats.active_customers}</Text>
            <Text style={styles.statLabel}>Clientes con Pago</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin.paymentSearchPlaceholder', 'Buscar por cliente, marca o últimos 4 dígitos...')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textGray}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textGray} />
            </TouchableOpacity>
          )}
        </View>

        {/* Info Notice */}
        <View style={styles.infoNotice}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={styles.infoText}>
            Vista de métodos de pago de clientes. Para ver métodos de pago específicos, ve a la sección de Suscripciones.
          </Text>
        </View>

        {/* Methods List */}
        <View style={styles.methodsSection}>
          {filteredMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={64} color={colors.textLight} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No se encontraron métodos de pago' : 'No hay métodos de pago registrados'}
              </Text>
              <Text style={styles.emptySubtext}>
                Los métodos de pago aparecerán aquí cuando los clientes agreguen tarjetas
              </Text>
            </View>
          ) : (
            filteredMethods.map(method => renderMethodCard(method))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textGray,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '10',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.info,
    lineHeight: 18,
  },
  methodsSection: {
    padding: 16,
  },
  methodCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border + '40',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDetails: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardBrand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapsedInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border + '60',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '500',
  },
  expiredText: {
    color: colors.error,
    fontWeight: '700',
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warning + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
  },
  expandedInfo: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border + '60',
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 14,
  },
  detailItem: {
    gap: 6,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabelText: {
    fontSize: 13,
    color: colors.textGray,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
    marginLeft: 26,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.warning + '15',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.success + '08',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: colors.success,
    lineHeight: 16,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textGray,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});