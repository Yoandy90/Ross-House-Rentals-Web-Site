/**
 * Services Screen - Client View with Premium Dark Mode
 * Shows all available services from the tax office
 * With quick access to "Mis Trámites" to track active services
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import PaymentMethodSelector from '../../components/PaymentMethodSelector';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '../../constants/colors';

const { width } = Dimensions.get('window');

// Cache keys
const CACHE_SERVICES = '@services_cache';
const CACHE_PASSPORT = '@passport_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  price?: string;
  popular?: boolean;
  isDynamic?: boolean;
  duration?: number;
}

interface BusinessPackage {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: string;
  badge?: string;
  savings?: number;
  features: string[];
  color: string;
}

interface MyTramitesStats {
  total: number;
  pending: number;
  in_progress: number;
}

export default function ServicesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [packages, setPackages] = useState<BusinessPackage[]>([]);
  const [myTramitesStats, setMyTramitesStats] = useState<MyTramitesStats>({
    total: 0,
    pending: 0,
    in_progress: 0,
  });
  
  // Estados para modal de pago
  const [balance, setBalance] = useState(0);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxWizardEnabled, setTaxWizardEnabled] = useState(true); // Feature flag for Mi Reembolso

  // Tax declaration types - loaded dynamically from all services
  const [taxDeclarationTypes, setTaxDeclarationTypes] = useState([
    {
      id: '69a65d90daeb0ad2ef3bc4a0', // Default fallback
      service_type: 'tax_personal',
      title: t('services.personalDeclaration'),
      description: t('services.personalTaxes1040'),
      icon: '👤',
      color: '#10B981',
      price: t('services.fromPrice180'),
      available: true,
    },
    {
      id: '69a65d90daeb0ad2ef3bc4a1', // Default fallback
      service_type: 'tax_business',
      title: t('services.businessDeclaration'),
      description: 'LLC, Corp, Partnership',
      icon: '🏢',
      color: '#3B82F6',
      price: t('services.fromPrice200'),
      available: true,
    },
  ]);

  // Passport types - will be loaded from backend
  const [passportTypes, setPassportTypes] = useState([
    {
      id: 'passport_cuban',
      title: t('services.cubanPassport'),
      description: t('services.cubanPassportDesc'),
      icon: 'flag',
      color: '#1a365d',
      flag: '🇨🇺',
      flag_emoji: '🇨🇺',
      price: t('services.fromPrice260'),
      price_display: t('services.fromPrice260'),
      available: true,
    },
    {
      id: 'passport_mexican',
      title: t('services.mexicanPassport'),
      description: t('services.comingSoonAvailable'),
      icon: 'flag',
      color: '#006847',
      flag: '🇲🇽',
      flag_emoji: '🇲🇽',
      price: t('services.comingSoonPrice'),
      price_display: t('services.comingSoonPrice'),
      available: false,
    },
    {
      id: 'passport_guatemalan',
      title: t('services.guatemalanPassport'),
      description: t('services.comingSoonAvailable'),
      icon: 'flag',
      color: '#4997D0',
      flag: '🇬🇹',
      flag_emoji: '🇬🇹',
      price: t('services.comingSoonPrice'),
      price_display: t('services.comingSoonPrice'),
      available: false,
    },
    {
      id: 'passport_venezuelan',
      title: t('services.venezuelanPassport'),
      description: t('services.comingSoonAvailable'),
      icon: 'flag',
      color: '#FFCC00',
      flag: '🇻🇪',
      flag_emoji: '🇻🇪',
      price: t('services.comingSoonPrice'),
      price_display: t('services.comingSoonPrice'),
      available: false,
    },
    {
      id: 'passport_colombian',
      title: t('services.colombianPassport'),
      description: t('services.comingSoonAvailable'),
      icon: 'flag',
      color: '#FCD116',
      flag: '🇨🇴',
      flag_emoji: '🇨🇴',
      price: t('services.comingSoonPrice'),
      price_display: t('services.comingSoonPrice'),
      available: false,
    },
  ]);

  useEffect(() => {
    loadCachedDataThenRefresh();
  }, []);

  // Load cached data instantly, then fetch fresh data in background
  const loadCachedDataThenRefresh = async () => {
    try {
      // Step 1: Load cached data INSTANTLY (no network wait)
      const cachedServices = await AsyncStorage.getItem(CACHE_SERVICES);
      const cachedPassport = await AsyncStorage.getItem(CACHE_PASSPORT);
      
      if (cachedServices) {
        try {
          const parsed = JSON.parse(cachedServices);
          if (parsed.services && parsed.services.length > 0) {
            setServices(parsed.services);
            if (parsed.taxDeclarationTypes) setTaxDeclarationTypes(parsed.taxDeclarationTypes);
            setLoading(false); // Immediately show cached data
          }
        } catch (e) { /* ignore parse errors */ }
      }
      if (cachedPassport) {
        try {
          const parsed = JSON.parse(cachedPassport);
          if (parsed.length > 0) setPassportTypes(parsed);
        } catch (e) { /* ignore parse errors */ }
      }
      
      // Step 2: Fetch fresh data in background
      await loadData(false);
    } catch (error) {
      // If cache fails, do normal full load
      await loadData(true);
    }
  };

  const loadData = async (showLoader = true) => {
    try {
      if (showLoader && services.length === 0) setLoading(true);
      await Promise.all([
        loadServicesFromAPI(),
        loadMyTramitesStats(),
        loadBalance(),
        loadPassportTypes(),
        loadFeatureFlags()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFeatureFlags = async () => {
    try {
      const response = await api.get('/feature-flags');
      if (response.data) {
        setTaxWizardEnabled(response.data.tax_wizard_enabled !== false);
      }
    } catch (error) {
      setTaxWizardEnabled(true);
    }
  };

  const loadServicesFromAPI = async (retryCount = 0) => {
    try {
      console.log('📋 Loading dynamic services... attempt', retryCount + 1);
      const dynamicResponse = await api.get(`/dynamic-services?lang=${i18n.language || 'es'}`);
      console.log('📋 Dynamic services response:', dynamicResponse.data?.services?.length || 0, 'services');
      
      if (dynamicResponse.data?.services && dynamicResponse.data.services.length > 0) {
        const allServices = dynamicResponse.data.services;
        
        const dynamicServices = allServices
          .filter((s: any) => s.visible_in_app !== false)
          .map((s: any) => ({
            id: s.id,
            title: s.name || s.title || 'Servicio',
            description: s.short_description || s.description || '',
            icon: s.icon || 'briefcase',
            color: s.color || '#6C1110',
            price: s.price > 0 ? `$${s.price}` : (s.service_type === 'tax_declarations' ? t('services.fromPrice180') : (s.service_type === 'passport_services' ? t('services.fromPrice260') : '')),
            popular: s.is_popular,
            isDynamic: true,
            duration: s.duration_minutes,
            service_type: s.service_type,
          }));
        
        console.log('📋 Setting', dynamicServices.length, 'visible services');
        if (dynamicServices.length > 0) {
          setServices(dynamicServices);
        }
        
        const taxServices = allServices
          .filter((s: any) => s.service_type === 'tax_personal' || s.service_type === 'tax_business')
          .map((s: any) => ({
            id: s.id,
            service_type: s.service_type,
            title: s.name,
            description: s.short_description || s.description,
            icon: s.service_type === 'tax_personal' ? '👤' : '🏢',
            color: s.color || (s.service_type === 'tax_personal' ? '#10B981' : '#3B82F6'),
            price: s.price > 0 ? `$${s.price}` : t('services.fromPrice180'),
            available: s.is_active !== false,
          }));
        
        if (taxServices.length > 0) {
          setTaxDeclarationTypes(taxServices);
        }
        
        try {
          await AsyncStorage.setItem(CACHE_SERVICES, JSON.stringify({
            services: dynamicServices,
            taxDeclarationTypes: taxServices.length > 0 ? taxServices : undefined,
            timestamp: Date.now(),
          }));
        } catch (e) { /* ignore cache write errors */ }
        
        return;
      } else {
        console.log('📋 No dynamic services, trying catalog fallback...');
        const response = await api.get('/services/catalog');
        if (response.data?.success) {
          const apiServices = (response.data.services || []).map((s: any) => ({
            id: s.id,
            title: s.title || s.name,
            description: s.description,
            icon: s.icon,
            color: s.color,
            price: s.price,
            popular: s.popular,
            isDynamic: false,
          }));
          setServices(apiServices);
          
          const apiPackages = (response.data.packages || []).map((p: any) => ({
            id: p.id,
            name: p.name || p.title,
            price: p.price_value || p.price || 0,
            description: p.description,
            icon: p.icon,
            badge: p.badge,
            color: p.color,
            savings: p.savings,
            features: p.features || [],
          }));
          setPackages(apiPackages);
          return;
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading services (attempt ' + (retryCount + 1) + '):', error?.message || error);
      
      if (retryCount < 2) {
        console.log('🔄 Retrying service load in 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
        return loadServicesFromAPI(retryCount + 1);
      }
    }
    
    console.log('⚠️ Using hardcoded fallback services');
    setServices([
      { id: 'fb-personal-tax', title: t('services.personalTaxReturn', 'Declaración Personal'), description: t('services.personalTaxDesc', 'Preparación de impuestos personales'), icon: 'document-text', color: '#6C1110', price: '$180', popular: true, isDynamic: true, duration: 30, service_type: 'personal_tax_return' } as any,
      { id: 'fb-business-tax', title: t('services.businessTaxReturn', 'Declaración de Negocios'), description: t('services.businessTaxDesc', 'Impuestos para LLC, Corp, Partnership'), icon: 'briefcase', color: '#1E40AF', price: '$350', popular: true, isDynamic: true, duration: 60, service_type: 'business_tax_return' } as any,
      { id: 'fb-itin', title: t('services.itinApplication', 'Solicitud ITIN'), description: t('services.itinDesc', 'Número de identificación del IRS'), icon: 'card', color: '#059669', price: '$200', popular: true, isDynamic: true, duration: 45, service_type: 'itin_application' } as any,
      { id: 'fb-amendment', title: t('services.taxAmendment', 'Enmienda de Impuestos'), description: t('services.taxAmendmentDesc', 'Corrección de declaración'), icon: 'create', color: '#D97706', price: '$150', popular: false, isDynamic: true, duration: 30, service_type: 'tax_amendment' } as any,
      { id: 'fb-llc', title: t('services.llcFormation', 'Formación de LLC'), description: t('services.llcDesc', 'Creación y registro de LLC'), icon: 'business', color: '#7C3AED', price: '$350', popular: true, isDynamic: true, duration: 45, service_type: 'llc_formation' } as any,
      { id: 'fb-bookkeeping', title: t('services.monthlyBookkeeping', 'Contabilidad Mensual'), description: t('services.bookkeepingDesc', 'Registro de transacciones mensual'), icon: 'calculator', color: '#0891B2', price: '$200', popular: false, isDynamic: true, duration: 30, service_type: 'monthly_bookkeeping' } as any,
      { id: 'fb-translations', title: t('services.translations', 'Traducciones'), description: t('services.translationsDesc', 'Traducción certificada de documentos'), icon: 'language', color: '#2563EB', price: '$25', popular: false, isDynamic: true, duration: 30, service_type: 'translations' } as any,
      { id: 'fb-notary', title: t('services.notarizations', 'Notarizaciones'), description: t('services.notaryDesc', 'Notarización de documentos'), icon: 'reader', color: '#4B5563', price: '$15', popular: false, isDynamic: true, duration: 15, service_type: 'notarizations' } as any,
      { id: 'fb-passport', title: t('services.passportServices', 'Trámite de Pasaporte'), description: t('services.passportDesc', 'Renovación y trámites de pasaporte'), icon: 'airplane', color: '#DC2626', price: '$100', popular: false, isDynamic: true, duration: 30, service_type: 'passport_services' } as any,
      { id: 'fb-immigration', title: t('services.immigrationConsultation', 'Consulta de Inmigración'), description: t('services.immigrationDesc', 'Orientación sobre trámites migratorios'), icon: 'globe', color: '#0D9488', price: '$100', popular: false, isDynamic: true, duration: 30, service_type: 'immigration_consultation' } as any,
      { id: 'fb-general', title: t('services.generalConsultation', 'Consulta General'), description: t('services.generalConsultDesc', 'Consulta sobre cualquier servicio'), icon: 'chatbubbles', color: '#6B7280', price: '', popular: false, isDynamic: true, duration: 30, service_type: 'general_consultation' } as any,
    ]);
  };

  const loadBalance = async () => {
    try {
      setLoadingBalance(true);
      const res = await api.get('/credits/balance');
      setBalance(res.data.balance || 0);
    } catch (error) {
      console.error('Error loading balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const loadMyTramitesStats = async () => {
    try {
      const response = await api.get('/my-projects');
      if (response.data?.stats) {
        setMyTramitesStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading tramites stats:', error);
    }
  };

  const loadPassportTypes = async () => {
    try {
      const response = await api.get('/passport-types');
      if (response.data?.passport_types) {
        const types = response.data.passport_types.map((p: any) => ({
          ...p,
          flag: p.flag_emoji || p.flag || '🏳️',
          price: p.price_display || `$${p.price}`,
        }));
        setPassportTypes(types);
        try {
          await AsyncStorage.setItem(CACHE_PASSPORT, JSON.stringify(types));
        } catch (e) { /* ignore cache write errors */ }
      }
    } catch (error) {
      console.error('Error loading passport types:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  };

  const handleServicePress = (service: ServiceItem) => {
    if ((service as any).service_type === 'passport_services' || 
        service.title?.toLowerCase().includes('trámites de pasaporte')) {
      setShowPassportModal(true);
      return;
    }
    
    if ((service as any).service_type === 'tax_declarations' || 
        service.title?.toLowerCase().includes('declaración de impuestos')) {
      setShowTaxModal(true);
      return;
    }
    
    if ((service as any).service_type === 'immigration_motion' || 
        service.title?.toLowerCase().includes('moción de cierre')) {
      router.push({
        pathname: '/(tabs)/motion-request',
        params: { 
          serviceId: service.id,
          requiresPayment: 'false',
          price: '250'
        }
      });
      return;
    }
    
    if ((service as any).service_type === 'passport_cuban' || 
        service.title?.toLowerCase().includes('pasaporte cubano')) {
      router.push('/passport-application');
      return;
    }
    
    if ((service as any).service_type === 'immigration_consultation' ||
        service.title?.toLowerCase().includes('inmigración')) {
      router.push('/immigration-cases');
      return;
    }
    
    if ((service as any).isDynamic) {
      router.push({
        pathname: '/(tabs)/service-checkout',
        params: { 
          serviceId: service.id,
          serviceType: (service as any).service_type || '',
          serviceName: service.title || '',
          servicePrice: String(service.price || '0').replace('$', ''),
          serviceDuration: String((service as any).duration || 30),
          serviceIcon: service.icon || 'briefcase',
          serviceColor: service.color || '#6C1110',
          serviceDesc: service.description || '',
        }
      });
      return;
    }
    
    const serviceData = {
      id: service.id,
      name: service.title,
      description: service.description,
      price_credits: parseInt(service.price?.replace(/\D/g, '') || '150'),
      icon: service.icon,
      color: service.color,
    };
    setSelectedService(serviceData);
    setDetailModalVisible(true);
  };

  const handlePackagePress = (pkg: BusinessPackage) => {
    const serviceData = {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price_credits: pkg.price,
      icon: pkg.icon,
      color: pkg.color,
      features: pkg.features,
      badge: pkg.badge,
      savings: pkg.savings,
    };
    setSelectedService(serviceData);
    setDetailModalVisible(true);
  };

  const handleRequestService = () => {
    if (!selectedService) return;
    
    setDetailModalVisible(false);
    
    Alert.alert(
      `📋 ${t('services.requestServiceTitle')}`,
      t('services.requestServiceDesc', { name: selectedService.name }),
      [
        { 
          text: t('services.bookAppointment'), 
          onPress: () => router.push('/(tabs)/book-appointment')
        },
        { 
          text: t('services.callNow'),
          onPress: () => {
            const { Linking } = require('react-native');
            Linking.openURL('tel:+18069342018');
          }
        },
        { 
          text: 'WhatsApp',
          onPress: () => {
            const { Linking } = require('react-native');
            Linking.openURL('https://wa.me/18069342018');
          }
        },
        { text: t('services.cancelLabel'), style: 'cancel' },
      ]
    );
  };

  const handlePayWithCredits = () => {
    if (!selectedService) return;
    
    const priceCredits = Number(selectedService.price_credits) || 0;
    const currentBalance = Number(balance) || 0;
    
    if (priceCredits <= 0) {
      Alert.alert(t('common.error'), t('services.priceNotAvailable'));
      return;
    }
    
    if (currentBalance < priceCredits) {
      const creditsNeeded = priceCredits - currentBalance;
      Alert.alert(
        t('services.insufficientCreditsTitle'),
        t('services.insufficientCreditsDesc', { needed: priceCredits, balance: currentBalance, missing: creditsNeeded }),
        [
          { text: t('services.cancelLabel'), style: 'cancel' },
          { 
            text: t('services.buyCredits'), 
            onPress: () => {
              setDetailModalVisible(false);
              router.push('/(tabs)/credits');
            }
          },
        ]
      );
      return;
    }
    
    const balanceAfter = currentBalance - priceCredits;
    Alert.alert(
      t('services.confirmPayment'),
      t('services.confirmPaymentDesc', { amount: priceCredits, current: currentBalance, after: balanceAfter }),
      [
        { text: t('services.cancelLabel'), style: 'cancel' },
        { 
          text: t('services.confirmPayment'), 
          onPress: async () => {
            try {
              await api.post('/services/request', {
                service_id: selectedService.id,
                payment_method: 'credits',
              });
              setDetailModalVisible(false);
              Alert.alert(
                `✅ ${t('services.serviceRequested')}`,
                t('services.serviceRequestedDesc'),
                [{ text: 'OK', onPress: () => loadData() }]
              );
            } catch (error: any) {
              Alert.alert(t('common.error'), error.response?.data?.detail || t('services.couldNotProcess'));
            }
          }
        },
      ]
    );
  };

  const handlePayWithCard = async () => {
    if (!selectedService) return;
    
    setDetailModalVisible(false);
    
    const servicePrice = selectedService.price_credits || selectedService.price || 0;
    
    if (servicePrice <= 0) {
      Alert.alert(t('common.error'), t('services.invalidPrice'));
      return;
    }
    
    router.push({
      pathname: '/payment-service',
      params: {
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        amount: servicePrice.toString(),
      }
    });
  };

  const handlePaymentSuccess = () => {
    Alert.alert(
      `✅ ${t('services.serviceRequested')}`,
      t('services.serviceCreatedSuccess'),
      [
        { text: t('services.viewMyServices'), onPress: () => router.push('/(tabs)/my-projects') },
        { text: 'OK', onPress: () => loadBalance() },
      ]
    );
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  const handleMyTramitesPress = () => {
    router.push('/(tabs)/my-projects');
  };

  const activeCount = myTramitesStats.pending + myTramitesStats.in_progress;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#064E3B', '#059669', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('services.title')}</Text>
            <Text style={styles.headerSubtitle}>Ross Tax Preparation LLC</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} tintColor="#059669" />
        }
      >
        {/* My Tramites Card */}
        <TouchableOpacity
          style={styles.myTramitesCard}
          onPress={handleMyTramitesPress}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#1E3A8A', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.myTramitesGradient}
          >
            <View style={styles.myTramitesContent}>
              <View style={styles.myTramitesLeft}>
                <View style={styles.myTramitesIconContainer}>
                  <Ionicons name="folder-open" size={32} color="#fff" />
                </View>
                <View style={styles.myTramitesText}>
                  <Text style={styles.myTramitesTitle}>{t('services.myProcesses')}</Text>
                  <Text style={styles.myTramitesSubtitle}>
                    {activeCount > 0
                      ? `${activeCount} ${t('services.inProgress')}`
                      : t('services.viewMyProcesses')}
                  </Text>
                </View>
              </View>
              <View style={styles.myTramitesRight}>
                {activeCount > 0 && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{activeCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Services Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('services.availableServices')}</Text>
          <Text style={styles.sectionSubtitle}>{t('services.selectServiceToRequest')}</Text>
        </View>

        {/* Loading State - Skeleton Loader */}
        {loading && services.length === 0 && (
          <View style={styles.skeletonContainer}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonAccent} />
                <View style={styles.skeletonBody}>
                  <View style={styles.skeletonIcon} />
                  <View style={styles.skeletonInfo}>
                    <View style={[styles.skeletonLine, { width: '60%' }]} />
                    <View style={[styles.skeletonLine, { width: '90%', height: 10 }]} />
                    <View style={[styles.skeletonLine, { width: '30%', height: 10, marginTop: 8 }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && services.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('services.noServicesAvailable')}</Text>
            <Text style={styles.emptySubtext}>{t('services.tryAgainLater')}</Text>
          </View>
        )}

        {/* Services List - Modern Design */}
        <View style={styles.servicesList}>
          {services.map((service, index) => (
            <TouchableOpacity
              key={service.id}
              style={styles.serviceCard}
              onPress={() => handleServicePress(service)}
              activeOpacity={0.7}
            >
              <View style={[styles.serviceCardAccent, { backgroundColor: service.color }]} />
              <View style={styles.serviceCardBody}>
                <View style={[styles.serviceIconContainer, { backgroundColor: service.color + '12' }]}>
                  <Ionicons name={service.icon as any} size={24} color={service.color} />
                </View>
                <View style={styles.serviceCardInfo}>
                  <View style={styles.serviceCardTopRow}>
                    <Text style={styles.serviceTitle} numberOfLines={1}>{service.title}</Text>
                    {service.popular && (
                      <View style={[styles.popularBadge, { backgroundColor: service.color + '15' }]}>
                        <Ionicons name="star" size={10} color={service.color} />
                        <Text style={[styles.popularText, { color: service.color }]}>{t('services.popular')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.serviceDescription} numberOfLines={2}>{service.description}</Text>
                  <View style={styles.serviceCardBottom}>
                    {service.price ? (
                      <View style={[styles.servicePriceBadge, { backgroundColor: service.color + '10' }]}>
                        <Text style={[styles.servicePrice, { color: service.color }]}>{service.price}</Text>
                      </View>
                    ) : <View />}
                    {service.duration ? (
                      <View style={styles.serviceDurationBadge}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.serviceDurationText}>{service.duration} min</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.serviceCardChevron}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <View style={styles.contactIconCircle}>
            <Ionicons name="headset-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.contactTitle}>{t('services.needHelp')}</Text>
          <Text style={styles.contactText}>
            {t('services.teamReadyToAssist')}
          </Text>
          <View style={styles.contactButtons}>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/support')}
            >
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.contactButtonText}>{t('services.chat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: '#064E3B' }]}
              onPress={() => router.push('/(tabs)/book-appointment')}
            >
              <Ionicons name="calendar" size={18} color="#fff" />
              <Text style={styles.contactButtonText}>{t('services.bookAppointment')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal de Selección de Pasaportes */}
      <Modal
        visible={showPassportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPassportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passportModalContent}>
            <View style={styles.passportModalHeader}>
              <View>
                <Text style={styles.passportModalTitle}>{t('services.passportServices')}</Text>
                <Text style={styles.passportModalSubtitle}>{t('services.selectPassportType')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPassportModal(false)}>
                <Ionicons name="close-circle" size={32} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.passportList}>
              {passportTypes.map((passport) => (
                <TouchableOpacity
                  key={passport.id}
                  style={[
                    styles.passportCard,
                    !passport.available && styles.passportCardDisabled
                  ]}
                  onPress={() => {
                    if (passport.available) {
                      setShowPassportModal(false);
                      if (passport.id === 'passport_cuban') {
                        router.push('/passport-application');
                      }
                    }
                  }}
                  activeOpacity={passport.available ? 0.7 : 1}
                >
                  <View style={styles.passportCardLeft}>
                    <Text style={styles.passportFlag}>{passport.flag}</Text>
                    <View style={styles.passportInfo}>
                      <Text style={[
                        styles.passportTitle,
                        !passport.available && styles.passportTitleDisabled
                      ]}>
                        {passport.title}
                      </Text>
                      <Text style={styles.passportDescription}>{passport.description}</Text>
                    </View>
                  </View>
                  <View style={styles.passportCardRight}>
                    <Text style={[
                      styles.passportPrice,
                      !passport.available && styles.passportPriceDisabled
                    ]}>
                      {passport.price}
                    </Text>
                    {passport.available ? (
                      <Ionicons name="chevron-forward" size={24} color={passport.color} />
                    ) : (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>{t('services.comingSoon')}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.passportModalFooter}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.passportModalFooterText}>
                {t('services.moreNationalitiesComingSoon')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalle del Servicio */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedService && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalHeaderTitle}>{t('services.serviceDetails')}</Text>
                    <TouchableOpacity 
                      style={styles.modalCloseButton}
                      onPress={() => setDetailModalVisible(false)}
                    >
                      <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.modalIconContainer, { backgroundColor: selectedService.color + '15' }]}>
                    <Ionicons name={selectedService.icon as any} size={48} color={selectedService.color} />
                  </View>
                  
                  {selectedService.badge && (
                    <View style={[styles.modalBadge, { backgroundColor: selectedService.color }]}>
                      <Text style={styles.modalBadgeText}>{selectedService.badge}</Text>
                    </View>
                  )}

                  <Text style={styles.modalTitle}>{selectedService.name}</Text>
                  
                  <View style={styles.modalPriceSection}>
                    <Text style={[styles.modalPrice, { color: selectedService.color }]}>
                      ${selectedService.price_credits?.toLocaleString()}
                    </Text>
                    {selectedService.savings && (
                      <View style={styles.savingsBadge}>
                        <Ionicons name="pricetag" size={14} color={colors.success} />
                        <Text style={styles.modalSavings}>
                          {t('services.savingsAmount', { amount: selectedService.savings.toLocaleString() })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionHeader}>
                      <Ionicons name="information-circle" size={20} color={selectedService.color} />
                      <Text style={styles.modalSectionTitle}>{t('services.descriptionLabel')}</Text>
                    </View>
                    <Text style={styles.modalDescription}>{selectedService.description}</Text>
                  </View>

                  {selectedService.features && selectedService.features.length > 0 && (
                    <View style={styles.modalSection}>
                      <View style={styles.modalSectionHeader}>
                        <Ionicons name="checkmark-done-circle" size={20} color={selectedService.color} />
                        <Text style={styles.modalSectionTitle}>{t('services.whatsIncluded')}</Text>
                      </View>
                      <View style={styles.modalFeatures}>
                        {selectedService.features.map((feature: string, idx: number) => (
                          <View key={idx} style={styles.modalFeatureRow}>
                            <View style={[styles.featureCheckIcon, { backgroundColor: selectedService.color }]}>
                              <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                            <Text style={styles.modalFeatureText}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.modalSection}>
                    <View style={styles.modalSectionHeader}>
                      <Ionicons name="time" size={20} color={selectedService.color} />
                      <Text style={styles.modalSectionTitle}>{t('services.additionalInfo')}</Text>
                    </View>
                    <View style={styles.infoGrid}>
                      <View style={styles.infoItem}>
                        <Ionicons name="timer-outline" size={24} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>{t('services.estimatedTime')}</Text>
                        <Text style={styles.infoValue}>{t('services.businessDays')}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="shield-checkmark-outline" size={24} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>{t('services.guarantee')}</Text>
                        <Text style={styles.infoValue}>{t('services.fullSatisfaction')}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="headset-outline" size={24} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>{t('services.supportLabel')}</Text>
                        <Text style={styles.infoValue}>{t('services.whatsappIncluded')}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="document-text-outline" size={24} color={colors.textMuted} />
                        <Text style={styles.infoLabel}>{t('services.documentsLabel')}</Text>
                        <Text style={styles.infoValue}>{t('services.digitalAndPhysical')}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalBalanceCard}>
                    <View style={styles.modalBalanceHeader}>
                      <Ionicons name="wallet" size={24} color={selectedService.color} />
                      <Text style={styles.modalBalanceTitle}>{t('services.yourBalance')}</Text>
                    </View>
                    <View style={styles.modalBalanceContent}>
                      <Text style={[
                        styles.modalBalanceAmount,
                        { color: balance >= selectedService.price_credits ? colors.success : colors.error }
                      ]}>
                        ${balance.toFixed(0)}
                      </Text>
                      <Text style={styles.modalBalanceLabel}>{t('services.creditsAvailable')}</Text>
                    </View>
                    {balance < (selectedService?.price_credits || 0) && (selectedService?.price_credits || 0) > 0 && (
                      <View style={styles.insufficientWarning}>
                        <Ionicons name="alert-circle" size={16} color={colors.error} />
                        <Text style={styles.modalInsufficientText}>
                          {t('services.needMoreCredits', { amount: ((selectedService?.price_credits || 0) - balance).toFixed(0) })}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.paymentOptionsSection}>
                    <Text style={styles.paymentOptionsTitle}>{t('services.paymentOptions')}</Text>
                    
                    <TouchableOpacity
                      style={styles.paymentOptionCard}
                      onPress={handlePayWithCard}
                    >
                      <View style={styles.paymentOptionLeft}>
                        <View style={[styles.paymentOptionIcon, { backgroundColor: colors.infoLight }]}>
                          <Ionicons name="card" size={24} color={colors.info} />
                        </View>
                        <View>
                          <Text style={styles.paymentOptionTitle}>{t('services.payWithCard')}</Text>
                          <Text style={styles.paymentOptionSubtitle}>{t('services.cardBrands')}</Text>
                        </View>
                      </View>
                      <View style={styles.paymentOptionRight}>
                        <Text style={styles.paymentOptionPrice}>${selectedService?.price_credits || selectedService?.price || 0}</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentOptionCard,
                        balance < (selectedService?.price_credits || 0) && styles.paymentOptionDisabled
                      ]}
                      onPress={handlePayWithCredits}
                      disabled={balance < (selectedService?.price_credits || 0)}
                    >
                      <View style={styles.paymentOptionLeft}>
                        <View style={[styles.paymentOptionIcon, { backgroundColor: colors.successLight }]}>
                          <Ionicons name="wallet" size={24} color={colors.success} />
                        </View>
                        <View>
                          <Text style={styles.paymentOptionTitle}>{t('services.payWithCredits')}</Text>
                          <Text style={styles.paymentOptionSubtitle}>
                            {balance >= selectedService.price_credits 
                              ? t('services.youHaveCredits', { amount: balance })
                              : t('services.insufficientBalanceLabel')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.paymentOptionRight}>
                        <Text style={[
                          styles.paymentOptionPrice,
                          balance < selectedService.price_credits && { color: colors.textMuted }
                        ]}>
                          {selectedService.price_credits} cr
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    {balance < selectedService.price_credits && (
                      <TouchableOpacity
                        style={styles.rechargeLink}
                        onPress={() => {
                          setDetailModalVisible(false);
                          router.push('/(tabs)/credits');
                        }}
                      >
                        <Ionicons name="add-circle" size={18} color={colors.primary} />
                        <Text style={styles.rechargeLinkText}>{t('services.rechargeCredits')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.modalCancelButtonFull}
                      onPress={() => setDetailModalVisible(false)}
                    >
                      <Text style={styles.modalCancelText}>{t('services.close')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Declaración de Impuestos */}
      <Modal
        visible={showTaxModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTaxModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passportModalContent}>
            <View style={styles.passportModalHeader}>
              <View>
                <Text style={styles.passportModalTitle}>{t('services.taxDeclaration')}</Text>
                <Text style={styles.passportModalSubtitle}>{t('services.selectDeclarationType')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTaxModal(false)}>
                <Ionicons name="close-circle" size={32} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.passportList}>
              {/* NEW: Mi Reembolso Featured Card */}
              <TouchableOpacity
                style={styles.taxWizardCard}
                onPress={() => {
                  setShowTaxModal(false);
                  router.push('/tax-wizard');
                }}
              >
                <LinearGradient
                  colors={['#065F46', '#10B981']}
                  style={styles.taxWizardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.taxWizardBadge}>
                    <Text style={styles.taxWizardBadgeText}>{t('services.newBadge')}</Text>
                  </View>
                  <View style={styles.taxWizardIcon}>
                    <Ionicons name="sparkles" size={32} color="#fff" />
                  </View>
                  <Text style={styles.taxWizardTitle}>{t('services.taxWizard')}</Text>
                  <Text style={styles.taxWizardSubtitle}>
                    {t('services.guidedPreparation')}
                  </Text>
                  <View style={styles.taxWizardFeatures}>
                    <View style={styles.taxWizardFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#86EFAC" />
                      <Text style={styles.taxWizardFeatureText}>{t('services.simpleSteps')}</Text>
                    </View>
                    <View style={styles.taxWizardFeature}>
                      <Ionicons name="checkmark-circle" size={16} color="#86EFAC" />
                      <Text style={styles.taxWizardFeatureText}>{t('services.liveEstimate')}</Text>
                    </View>
                  </View>
                  <View style={styles.taxWizardCTA}>
                    <Text style={styles.taxWizardCTAText}>{t('services.startNow')}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#065F46" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.orDivider}>{t('services.orChooseDirectService')}</Text>

              {taxDeclarationTypes.map((taxType) => (
                <TouchableOpacity
                  key={taxType.id}
                  style={[
                    styles.passportCard,
                    !taxType.available && styles.passportCardDisabled
                  ]}
                  onPress={() => {
                    if (taxType.available) {
                      setShowTaxModal(false);
                      router.push({
                        pathname: '/(tabs)/service-checkout',
                        params: { 
                          serviceId: taxType.id,
                          serviceType: taxType.service_type || '',
                          serviceName: taxType.name || taxType.title || '',
                          servicePrice: String(taxType.price || '0'),
                          serviceDuration: String(taxType.duration || 30),
                          serviceIcon: taxType.icon || 'briefcase',
                          serviceColor: taxType.color || '#6C1110',
                          serviceDesc: taxType.description || '',
                        }
                      });
                    }
                  }}
                  activeOpacity={taxType.available ? 0.7 : 1}
                >
                  <View style={styles.passportCardLeft}>
                    <Text style={styles.passportFlag}>{taxType.icon}</Text>
                    <View style={styles.passportInfo}>
                      <Text style={[
                        styles.passportTitle,
                        !taxType.available && styles.passportTitleDisabled
                      ]}>
                        {taxType.title}
                      </Text>
                      <Text style={styles.passportDescription}>{taxType.description}</Text>
                    </View>
                  </View>
                  <View style={styles.passportCardRight}>
                    <Text style={[
                      styles.passportPrice,
                      { color: taxType.color },
                      !taxType.available && styles.passportPriceDisabled
                    ]}>
                      {taxType.price}
                    </Text>
                    {taxType.available ? (
                      <Ionicons name="chevron-forward" size={24} color={taxType.color} />
                    ) : (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>{t('services.comingSoon')}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.passportModalFooter}>
              <Ionicons name="calculator-outline" size={16} color={colors.textMuted} />
              <Text style={styles.passportModalFooterText}>
                {t('services.preparedByProfessionals')}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      {selectedService && (
        <PaymentMethodSelector
          visible={paymentModalVisible}
          onClose={() => {
            setPaymentModalVisible(false);
            setSelectedService(null);
          }}
          servicePriceId={selectedService.id}
          serviceInstanceId={`service_${Date.now()}`}
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
    paddingBottom: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },
  // My Tramites Card - Premium
  myTramitesCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  myTramitesGradient: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  myTramitesContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myTramitesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  myTramitesIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  myTramitesText: {
    marginLeft: 16,
    flex: 1,
  },
  myTramitesTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  myTramitesSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  myTramitesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeBadge: {
    backgroundColor: '#FBBF24',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  activeBadgeText: {
    color: '#78350F',
    fontSize: 15,
    fontWeight: '800',
  },
  // Section Header - Premium
  sectionHeader: {
    marginBottom: 18,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },
  // Services List - Premium Design
  servicesList: {
    gap: 14,
  },
  serviceCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceCardAccent: {
    width: 5,
  },
  serviceCardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 14,
  },
  serviceIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  serviceCardInfo: {
    flex: 1,
  },
  serviceCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    letterSpacing: -0.3,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    marginLeft: 8,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  serviceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  serviceCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  servicePriceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  servicePrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  serviceDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.backgroundGray,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  serviceDurationText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  serviceCardChevron: {
    paddingLeft: 10,
    justifyContent: 'center',
  },
  // Contact Section
  contactSection: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 24,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  contactText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Skeleton Loading
  skeletonContainer: {
    gap: 14,
  },
  skeletonCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
  },
  skeletonAccent: {
    width: 5,
    backgroundColor: colors.skeleton,
  },
  skeletonBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingLeft: 14,
  },
  skeletonIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.skeleton,
    marginRight: 14,
  },
  skeletonInfo: {
    flex: 1,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: colors.skeleton,
    borderRadius: 7,
    marginBottom: 6,
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
  },
  modalBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  modalBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 16,
    marginHorizontal: 20,
  },
  modalPriceSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  modalPrice: {
    fontSize: 36,
    fontWeight: '800',
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  modalSavings: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  modalSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalFeatures: {
    gap: 10,
  },
  modalFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheckIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFeatureText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '47%',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  infoValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  modalBalanceCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalBalanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  modalBalanceContent: {
    marginTop: 12,
    alignItems: 'center',
  },
  modalBalanceAmount: {
    fontSize: 28,
    fontWeight: '800',
  },
  modalBalanceLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  insufficientWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalInsufficientText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
  },
  paymentOptionsSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  paymentOptionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  paymentOptionSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentOptionPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  rechargeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
  },
  rechargeLinkText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  modalCancelButtonFull: {
    backgroundColor: colors.backgroundGray,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Passport Modal
  passportModalContent: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  passportModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  passportModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  passportModalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  passportList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  passportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passportCardDisabled: {
    opacity: 0.6,
  },
  passportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passportFlag: {
    fontSize: 32,
    marginRight: 14,
  },
  passportInfo: {
    flex: 1,
  },
  passportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  passportTitleDisabled: {
    color: colors.textMuted,
  },
  passportDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  passportCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  passportPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  passportPriceDisabled: {
    color: colors.textMuted,
  },
  comingSoonBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
  },
  passportModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginHorizontal: 20,
  },
  passportModalFooterText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  // Tax Wizard Card
  taxWizardCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  taxWizardGradient: {
    padding: 20,
    position: 'relative',
  },
  taxWizardBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  taxWizardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  taxWizardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  taxWizardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  taxWizardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },
  taxWizardFeatures: {
    gap: 8,
    marginBottom: 16,
  },
  taxWizardFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxWizardFeatureText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  taxWizardCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
  },
  taxWizardCTAText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  orDivider: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
    marginVertical: 12,
    fontWeight: '500',
  },
});
