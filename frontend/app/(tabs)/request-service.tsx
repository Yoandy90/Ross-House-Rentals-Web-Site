import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';
import CustomHeader from '../../components/CustomHeader';

interface ServicePrice {
  id: string;
  service_type: string;
  name: string;
  description: string;
  price_credits: number;
  is_active: boolean;
}

export default function RequestServiceScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServicePrice[]>([]);
  const [balance, setBalance] = useState(0);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServicePrice | null>(null);
  const [tempServiceId, setTempServiceId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load services
      const servicesRes = await api.get('/credits/service-prices');
      
      const servicesList = servicesRes.data.service_prices || [];
      setServices(servicesList);

      // Load balance
      const balanceRes = await api.get('/credits/balance');
      setBalance(balanceRes.data.balance || 0);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      Alert.alert(t('common.error'), t('requestService.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleServiceRequest = (service: ServicePrice) => {
    // In a real app, we would create the service request first
    // For now, we'll generate a temp ID
    const tempId = `temp_${Date.now()}`;
    
    setSelectedService(service);
    setTempServiceId(tempId);
    setPaymentModalVisible(true);
  };

  const handlePaymentSuccess = (result: any) => {
    Alert.alert(
      t('requestService.requestCreated'),
      t('requestService.requestCreatedDesc'),
      [
        {
          text: t('requestService.viewMyCredits'),
          onPress: () => router.push('/(tabs)/credits')
        },
        {
          text: 'OK',
          onPress: () => loadData() // Reload to update balance
        }
      ]
    );
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'tax_return': return 'document-text';
      case 'amendment': return 'create';
      case 'appointment': return 'calendar';
      case 'document_processing': return 'folder';
      case 'priority_support': return 'flash';
      default: return 'help-circle';
    }
  };

  const renderService = (service: ServicePrice) => {
    const canAfford = balance >= service.price_credits;
    
    return (
      <TouchableOpacity
        key={service.id}
        style={styles.serviceCard}
        onPress={() => handleServiceRequest(service)}
        activeOpacity={0.7}
      >
        <View style={[styles.serviceIcon, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons 
            name={getServiceIcon(service.service_type) as any} 
            size={32} 
            color={colors.primary} 
          />
        </View>

        <View style={styles.serviceContent}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {service.description}
          </Text>

          <View style={styles.serviceFooter}>
            <View style={styles.priceTag}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={styles.priceText}>{service.price_credits} {t('requestService.credits')}</Text>
            </View>

            {!canAfford && (
              <View style={styles.insufficientBadge}>
                <Ionicons name="alert-circle" size={14} color={colors.error} />
                <Text style={styles.insufficientText}>{t('requestService.insufficientBalance')}</Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('requestService.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('requestService.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader 
        title={t('requestService.title')}
        showBack
        onBackPress={() => router.back()}
      />

      {/* Balance Banner */}
      <View style={styles.balanceBanner}>
        <View style={styles.balanceContent}>
          <Ionicons name="wallet" size={24} color="#FFF" />
          <View style={styles.balanceTextContainer}>
            <Text style={styles.balanceLabel}>{t('requestService.yourBalance')}</Text>
            <Text style={styles.balanceAmount}>{balance.toFixed(0)} {t('requestService.credits')}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.buyCreditsButton}
          onPress={() => router.push('/(tabs)/credits')}
        >
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.buyCreditsText}>{t('requestService.buy')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>{t('requestService.availableServices')}</Text>
        <Text style={styles.sectionSubtitle}>
          {t('requestService.selectService')}
        </Text>

        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="file-tray-outline" size={64} color={colors.textGray} />
            <Text style={styles.emptyStateTitle}>{t('requestService.noServices')}</Text>
            <Text style={styles.emptyStateText}>
              {t('requestService.noServicesDesc')}
            </Text>
          </View>
        ) : (
          <>
            {services.map(service => renderService(service))}
          </>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{t('requestService.howItWorks')}</Text>
            <Text style={styles.infoText}>
              {t('requestService.step1')}{'\n'}
              {t('requestService.step2')}{'\n'}
              {t('requestService.step3')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Payment Modal */}
      {selectedService && tempServiceId && (
        <PaymentMethodSelector
          visible={paymentModalVisible}
          onClose={() => {
            setPaymentModalVisible(false);
            setSelectedService(null);
            setTempServiceId(null);
          }}
          servicePriceId={selectedService.id}
          serviceInstanceId={tempServiceId}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={handlePaymentError}
        />
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textGray,
  },
  balanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  balanceTextContainer: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  buyCreditsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buyCreditsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 20,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  serviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceContent: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 8,
  },
  serviceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  insufficientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insufficientText: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    maxWidth: 250,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 20,
  },
});