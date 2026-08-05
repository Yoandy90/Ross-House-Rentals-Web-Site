import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { Colors, useThemeColors } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import api from '../../services/api';
import socketService from '../../services/socketService';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import CreditCardModal from '../../components/CreditCardModal';
import DocumentChecklistWidget from '../../components/DocumentChecklistWidget';
import TaxProgressWidget from '../../components/TaxProgressWidget';
import AnimatedCounter from '../../components/AnimatedCounter';

const { width } = Dimensions.get('window');

export default function Home() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : es;
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { totalUnread } = useNotifications();
  const [taxReturns, setTaxReturns] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [creditBalance, setCreditBalance] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const bannerScrollRef = useRef<ScrollView>(null);
  const [creditCardModalVisible, setCreditCardModalVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [dynamicBanners, setDynamicBanners] = useState<any[]>([]);
  const [carouselEnabled, setCarouselEnabled] = useState(false);
  const [wizardSession, setWizardSession] = useState<any>(null);
  const [featureFlags, setFeatureFlags] = useState({
    gambling_enabled: false,
    bolita_enabled: false,
    scratch_cards_enabled: false,
    raffles_enabled: false,
    loans_enabled: false,
    cab_enabled: false,
    my_business_enabled: false,
    personal_finance_enabled: false,
  });
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  // Animated values for header
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [-100, 0],
    extrapolate: 'clamp',
  });

  const headerShadow = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 8],
    extrapolate: 'clamp',
  });

  // Use ONLY dynamic banners from API - NO defaults
  const heroBanners = React.useMemo(() => {
    if (dynamicBanners.length > 0) {
      return dynamicBanners.map((banner, index) => ({
        id: banner.id || index + 1,
        title: banner.title,
        subtitle: banner.subtitle,
        color1: banner.gradient_colors?.[0] || Colors.primary,
        color2: banner.gradient_colors?.[1] || Colors.secondary,
        action: () => {
          if (banner.button_action) {
            router.push(banner.button_action as any);
          }
        },
        icon: banner.icon || 'gift-outline',
      }));
    }
    // Return empty array if no dynamic banners (carousel won't show)
    return [];
  }, [dynamicBanners, router]);

  // Load dynamic banners from API
  const loadDynamicBanners = async () => {
    try {
      const response = await api.get(`/carousel-banners?lang=${i18n.language}`);
      if (response.data?.success) {
        const banners = response.data.banners || [];
        setDynamicBanners(banners);
        // If API returns empty array, disable carousel (no active banners)
        setCarouselEnabled(banners.length > 0);
        console.log('📱 Loaded', banners.length, 'dynamic carousel banners, carousel enabled:', banners.length > 0);
      } else {
        setDynamicBanners([]);
        setCarouselEnabled(false);
      }
    } catch (error) {
      console.log('⚠️ Error loading banners, hiding carousel');
      setDynamicBanners([]);
      setCarouselEnabled(false);
    }
  };

  // Load feature flags to control visibility of features like loans, gambling, etc.
  const loadFeatureFlags = async () => {
    try {
      const response = await api.get('/feature-flags');
      if (response.data) {
        setFeatureFlags(response.data);
        console.log('🚩 Feature flags loaded:', response.data);
      }
    } catch (error) {
      console.log('⚠️ Error loading feature flags, using defaults');
    } finally {
      setFlagsLoaded(true);
    }
  };

  useEffect(() => {
    loadData();
    loadDynamicBanners();
    loadFeatureFlags();
    
    // Connect to Socket.IO for real-time notifications
    if (user?.id) {
      const socket = socketService.connect(user.id);
      
      const handleNewNotification = (notification: any) => {
        console.log('📩 New notification received:', notification);
      };
      
      socketService.on('new_notification', handleNewNotification);
      
      return () => {
        socketService.off('new_notification', handleNewNotification);
      };
    }
  }, [user]);

  // Auto-scroll banners - separate useEffect that depends on heroBanners
  useEffect(() => {
    if (heroBanners.length <= 1) return; // No need to scroll if only 1 or 0 banners
    
    const bannerInterval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    
    return () => clearInterval(bannerInterval);
  }, [heroBanners.length]);

  // Auto-scroll effect when currentBannerIndex changes
  useEffect(() => {
    if (bannerScrollRef.current) {
      bannerScrollRef.current.scrollTo({
        x: currentBannerIndex * width,
        animated: true,
      });
    }
  }, [currentBannerIndex]);

  // Reload data when screen comes into focus (including appointments)
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadDynamicBanners();
    }, [])
  );

  const loadData = async () => {
    try {
      const [returnsRes, docsRes, apptsRes, creditsRes, wizardRes] = await Promise.all([
        api.get('/tax-returns/completed'),
        api.get('/documents'),
        api.get('/appointments/my'),
        api.get('/credits/balance').catch(() => null),
        api.get('/tax-wizard/my-sessions').catch(() => ({ data: { sessions: [] } })),
      ]);
      
      setTaxReturns(returnsRes.data || []);
      setDocuments(docsRes.data || []);
      
      // Load wizard session
      const sessions = wizardRes.data?.sessions || [];
      const activeSession = sessions.find((s: any) => 
        s.status !== 'completed' && s.status !== 'cancelled'
      );
      setWizardSession(activeSession || null);
      
      // Handle both array response and object response with appointments property
      const appointmentsData = apptsRes.data;
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : (appointmentsData?.appointments || []));
      if (creditsRes) {
        setCreditBalance(creditsRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    loadDynamicBanners();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning');
    if (hour < 18) return t('home.goodAfternoon');
    return t('home.goodEvening');
  };

  // Only count UPCOMING appointments (not cancelled/completed and in the future)
  const now = new Date();
  const upcomingAppointments = (appointments || []).filter(a => 
    a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show' && new Date(a.scheduled_at) > now
  );
  const nextAppointment = upcomingAppointments
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];

  const renderHeroBanner = (banner: any, index: number) => (
    <TouchableOpacity
      key={banner.id}
      style={styles.heroBanner}
      onPress={banner.action}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={[banner.color1, banner.color2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBannerGradient}
      >
        <View style={styles.heroBannerContent}>
          <View style={styles.heroBannerIconContainer}>
            <Ionicons name={banner.icon as any} size={48} color="#FFF" />
          </View>
          <View style={styles.heroBannerText}>
            <Text style={styles.heroBannerTitle}>{banner.title}</Text>
            <Text style={styles.heroBannerSubtitle}>{banner.subtitle}</Text>
          </View>
          <Ionicons name="arrow-forward" size={28} color="#FFF" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Sticky Header - Aparece al hacer scroll */}
      <Animated.View
        style={[
          styles.stickyHeader,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
            shadowOpacity: headerShadow.interpolate({
              inputRange: [0, 8],
              outputRange: [0, 0.25],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={['#064E3B', '#065F46']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.stickyHeaderGradient, { paddingTop: insets.top }]}
        >
          <View style={styles.stickyHeaderContent}>
            {/* Profile Mini */}
            <TouchableOpacity 
              style={styles.stickyProfileContainer}
              onPress={() => router.push('/(tabs)/personal-info')}
            >
              {user?.profile_picture ? (
                <Image
                  source={{ 
                    uri: user.profile_picture.startsWith('data:image') 
                      ? user.profile_picture 
                      : `data:image/jpeg;base64,${user.profile_picture}`
                  }}
                  style={styles.stickyProfilePhoto}
                />
              ) : (
                <View style={styles.stickyProfilePhotoPlaceholder}>
                  <Ionicons name="person" size={20} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Logo and Name */}
            <View style={styles.stickyCenterSection}>
              <Text style={styles.stickyLogoText}>ROSS TAX</Text>
              <Text style={styles.stickyUserName}>{user?.name?.split(' ')[0]}</Text>
            </View>

            {/* Header Actions */}
            <View style={styles.stickyHeaderActions}>
              {/* Support */}
              <TouchableOpacity 
                style={styles.stickySupportButton}
                onPress={() => router.push('/(tabs)/support')}
              >
                <Ionicons name="chatbubbles-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              
              {/* Notifications */}
              <TouchableOpacity 
                style={styles.stickyNotificationButton}
                onPress={() => router.push('/(tabs)/notifications')}
              >
                <Ionicons name="notifications-outline" size={24} color="#FFF" />
                {totalUnread > 0 && (
                  <View style={styles.stickyNotificationBadge}>
                    <Text style={styles.stickyBadgeText}>{totalUnread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {/* Modern Header Section with Premium Gradient */}
        <LinearGradient
          colors={['#064E3B', '#065F46', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.unifiedHeader, { paddingTop: insets.top + 12, paddingBottom: 24 }]}
        >
          {/* Decorative Background Elements */}
          <View style={styles.headerDecoration}>
            <View style={[styles.decorCircle, styles.decorCircle1]} />
            <View style={[styles.decorCircle, styles.decorCircle2]} />
          </View>
          
          {/* Top Bar - Profile Photo, Logo centered, Notification */}
          <View style={styles.topBar}>
            {/* Profile Photo with Premium Ring */}
            <TouchableOpacity 
              style={styles.profilePhotoContainer}
              onPress={() => router.push('/(tabs)/personal-info')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FFFFFF', '#F0F0F0']}
                style={styles.profileRing}
              >
                {user?.profile_picture ? (
                  <Image
                    source={{ 
                      uri: user.profile_picture.startsWith('data:image') 
                        ? user.profile_picture 
                        : `data:image/jpeg;base64,${user.profile_picture}`
                    }}
                    style={styles.profilePhoto}
                  />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <Text style={styles.profileInitial}>
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
              </LinearGradient>
              <View style={styles.onlineIndicator} />
            </TouchableOpacity>

            {/* Center Section - Premium Logo with Brand Color */}
            <View style={styles.centerSection}>
              <View style={styles.logoContainer}>
                <View style={[styles.logoIconBg, { backgroundColor: 'rgba(108, 17, 16, 0.9)' }]}>
                  <Ionicons name="business" size={20} color="#FFF" />
                </View>
                <Text style={[styles.logoText, { color: '#FFF' }]}>ROSS TAX</Text>
              </View>
              <Text style={styles.greeting}>{getGreeting()}, {user?.name?.split(' ')[0]}</Text>
            </View>

            {/* Premium Action Buttons */}
            <View style={styles.headerActions}>
              {/* Support Button with Glassmorphism */}
              <TouchableOpacity 
                style={styles.supportButton}
                onPress={() => router.push('/(tabs)/support')}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubbles" size={22} color="#FFF" />
              </TouchableOpacity>
              
              {/* Notification Button with Animated Badge */}
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => router.push('/(tabs)/notifications')}
                activeOpacity={0.7}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons name="notifications" size={24} color="#FFF" />
                  {totalUnread > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.badgeText}>
                        {totalUnread > 99 ? '99+' : totalUnread}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Tax Summary Dashboard Card - First thing user sees */}
        <View style={styles.taxDashboardSection}>
          <View style={styles.taxDashboardCard}>
            {/* Header */}
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardTitle}>{t('home.taxSummary')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/taxes')}>
                <Text style={styles.dashboardLink}>{t('home.viewAll', 'Ver todo')}</Text>
              </TouchableOpacity>
            </View>

            {/* Refund from Tax Return */}
            <View style={styles.refundRow}>
              <View style={styles.refundInfo}>
                <Text style={styles.refundLabel}>{t('home.refund', 'Reembolso')}</Text>
                <Text style={styles.refundAmount}>
                  {(() => {
                    // Use REAL refund from the latest tax return (not wizard estimate)
                    const latestReturn = taxReturns[0] as any;
                    if (!latestReturn) return '—';
                    const refund = latestReturn.refund_amount || latestReturn.total_refund || 0;
                    return refund > 0 ? `$${Number(refund).toLocaleString()}` : '—';
                  })()}
                </Text>
              </View>
              <View style={[
                styles.refundStatus,
                { backgroundColor: taxReturns.length > 0 ? '#ECFDF5' : '#F3F4F6' }
              ]}>
                <Ionicons 
                  name={taxReturns.length > 0 ? 'checkmark-circle' : 'time-outline'} 
                  size={16} 
                  color={taxReturns.length > 0 ? '#059669' : '#9CA3AF'} 
                />
                <Text style={[
                  styles.refundStatusText,
                  { color: taxReturns.length > 0 ? '#059669' : '#9CA3AF' }
                ]}>
                  {taxReturns.length > 0 
                    ? t('taxes.statuses.submitted', 'Enviada')
                    : t('home.notStarted', 'Sin iniciar')}
                </Text>
              </View>
            </View>

            {/* Progress Metrics Row */}
            <View style={styles.metricsRow}>
              {/* Documents */}
              <TouchableOpacity 
                style={styles.metricItem}
                onPress={() => router.push('/(tabs)/documents')}
                activeOpacity={0.7}
              >
                <View style={styles.metricCircle}>
                  <View style={[styles.metricCircleProgress, { 
                    width: `${Math.min(100, documents.length > 0 ? Math.round((documents.length / 6) * 100) : 0)}%` 
                  }]} />
                  <Text style={styles.metricCircleText}>
                    {documents.length > 0 ? Math.min(100, Math.round((documents.length / 6) * 100)) : 0}%
                  </Text>
                </View>
                <Text style={styles.metricLabel}>{t('home.documents', 'Documentos')}</Text>
              </TouchableOpacity>

              {/* Declarations */}
              <TouchableOpacity 
                style={styles.metricItem}
                onPress={() => router.push('/(tabs)/tax-returns')}
                activeOpacity={0.7}
              >
                <View style={[styles.metricIconBg, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="document-text" size={20} color="#7C3AED" />
                </View>
                <Text style={styles.metricValue}>{taxReturns.length}</Text>
                <Text style={styles.metricLabel}>{t('home.declarations', 'Declaraciones')}</Text>
              </TouchableOpacity>

              {/* Next Appointment */}
              <TouchableOpacity 
                style={styles.metricItem}
                onPress={() => router.push('/(tabs)/appointments')}
                activeOpacity={0.7}
              >
                <View style={[styles.metricIconBg, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="calendar" size={20} color="#2563EB" />
                </View>
                <Text style={styles.metricValue}>{upcomingAppointments.length}</Text>
                <Text style={styles.metricLabel}>{t('home.appointments', 'Citas')}</Text>
              </TouchableOpacity>

              {/* Credits */}
              <TouchableOpacity 
                style={styles.metricItem}
                onPress={() => router.push('/(tabs)/credits')}
                activeOpacity={0.7}
              >
                <View style={[styles.metricIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="wallet" size={20} color="#D97706" />
                </View>
                <Text style={styles.metricValue}>${creditBalance?.balance || 0}</Text>
                <Text style={styles.metricLabel}>{t('home.credits', 'Créditos')}</Text>
              </TouchableOpacity>
            </View>

            {/* IRS Deadline Countdown */}
            {(() => {
              const deadline = new Date(2026, 3, 15); // April 15, 2026
              const today = new Date();
              const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
              if (daysLeft <= 0) return null;
              return (
                <View style={styles.deadlineBar}>
                  <Ionicons name="alarm-outline" size={16} color={daysLeft <= 30 ? '#DC2626' : '#059669'} />
                  <Text style={[styles.deadlineText, { color: daysLeft <= 30 ? '#DC2626' : '#374151' }]}>
                    {t('home.daysToDeadline', { days: daysLeft })}
                  </Text>
                  <View style={[styles.deadlineBadge, { backgroundColor: daysLeft <= 30 ? '#FEE2E2' : '#ECFDF5' }]}>
                    <Text style={[styles.deadlineBadgeText, { color: daysLeft <= 30 ? '#DC2626' : '#059669' }]}>
                      {daysLeft <= 30 ? t('home.urgent', '¡Urgente!') : t('home.onTime', 'A tiempo')}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>

        {/* Hero Banner Carousel - Only show if enabled */}
        {carouselEnabled && heroBanners.length > 0 && (
          <View style={styles.bannerWrapper}>
            <View style={styles.heroBannerContainer}>
              <ScrollView
                ref={bannerScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(event) => {
                  const slideIndex = Math.round(
                    event.nativeEvent.contentOffset.x / width
                  );
                  setCurrentBannerIndex(slideIndex);
                }}
              >
                {heroBanners.map(renderHeroBanner)}
              </ScrollView>
              <View style={styles.paginationDots}>
                {heroBanners.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === currentBannerIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* MI REEMBOLSO - Hidden until Tax API is connected (future feature) */}
        {/* <View style={styles.miReembolsoSection}>
          <TouchableOpacity
            style={styles.miReembolsoCard}
            onPress={() => router.push('/(tabs)/taxes')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#059669', '#10B981', '#34D399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.miReembolsoGradient}
            >
              <View style={styles.miReembolsoContent}>
                <View style={styles.miReembolsoIcon}>
                  <Text style={styles.miReembolsoIconText}>💰</Text>
                </View>
                <View style={styles.miReembolsoTextContainer}>
                  <Text style={styles.miReembolsoTitle}>{t('services.taxWizard')}</Text>
                  <Text style={styles.miReembolsoSubtitle}>
                    {wizardSession 
                      ? t('taxes.continueReturn', { year: wizardSession.tax_year })
                      : t('taxes.startReturn')}
                  </Text>
                </View>
                <View style={styles.miReemboolsoButton}>
                  <Ionicons name="arrow-forward" size={20} color="#059669" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View> */}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>{t('home.quickActions')}</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/documents')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="folder" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.documents')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/tax-returns')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="document-text" size={24} color="#2563EB" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.declarations')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/credits')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="wallet" size={24} color="#D97706" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.credits')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/referrals')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="gift" size={24} color="#DB2777" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.referrals', 'Referidos')}</Text>
            </TouchableOpacity>
          </View>
          {/* Second row of quick actions */}
          <View style={[styles.quickActionsRow, { marginTop: 10 }]}>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/dependents')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="people" size={24} color="#059669" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.dependents', 'Dependientes')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/tax-calculator')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDFA' }]}>
                <Ionicons name="calculator" size={24} color="#0D9488" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.calculator', 'Calculadora')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/appointments')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="calendar" size={24} color="#D97706" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.appointments')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/support')} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="chatbubbles" size={24} color="#2563EB" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.rossAI', 'Ross AI')}</Text>
            </TouchableOpacity>
          </View>
          {/* Third row - Business */}
          <View style={[styles.quickActionsRow, { marginTop: 10 }]}>
            {flagsLoaded && featureFlags.my_business_enabled && (
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/my-business' as any)} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="business" size={24} color="#10B981" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.myBusiness', 'Mi Negocio')}</Text>
            </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(tabs)/my-receipts' as any)} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="receipt" size={24} color="#EC4899" />
              </View>
              <Text style={styles.quickActionLabel}>{t('home.myReceipts', 'Recibos')}</Text>
            </TouchableOpacity>
            {flagsLoaded && featureFlags.personal_finance_enabled && (
            <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/my-finances' as any)} activeOpacity={0.7}>
              <View style={[styles.quickActionIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="wallet" size={24} color="#7C3AED" />
              </View>
              <Text style={styles.quickActionLabel}>Finanzas Personales</Text>
            </TouchableOpacity>
            )}
            <View style={styles.quickAction} />
          </View>
        </View>

        {/* CAB Loans - Only shown when cab_enabled */}
        {flagsLoaded && featureFlags.cab_enabled && (
          <View style={styles.section}>
            <TouchableOpacity
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                marginHorizontal: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
              onPress={() => router.push('/cab-loans')}
              activeOpacity={0.7}
            >
              <View style={{
                width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5',
                justifyContent: 'center', alignItems: 'center', marginRight: 12,
              }}>
                <Ionicons name="wallet" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a2e' }}>
                  {t('cabLoans.title', 'Mis Préstamos')}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  CAB - Credit Access Business
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Next Appointment */}
        {nextAppointment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.nextAppointment')}</Text>
            <TouchableOpacity
              style={styles.appointmentCard}
              onPress={() => router.push('/(tabs)/appointments')}
              activeOpacity={0.8}
            >
              <View style={styles.appointmentHeader}>
                <View style={styles.appointmentIconCircle}>
                  <Ionicons name="calendar" size={24} color={Colors.primary} />
                </View>
                <View style={styles.appointmentInfo}>
                  <Text style={styles.appointmentTitle}>{nextAppointment.title}</Text>
                  <Text style={styles.appointmentDate}>
                    {format(new Date(nextAppointment.scheduled_at), t('home.nextAppointmentDateFormat', "EEEE, d 'de' MMMM"), { locale: dateLocale })}
                  </Text>
                  <Text style={styles.appointmentTime}>
                    {format(new Date(nextAppointment.scheduled_at), 'h:mm a')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={Colors.textGray} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Spacer */}
        <View style={{ height: 40 }} />
      </Animated.ScrollView>

      {/* Credit Card Modal */}
      <CreditCardModal
        visible={creditCardModalVisible}
        onClose={() => setCreditCardModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  // Modern Header with Premium Gradient
  unifiedHeader: {
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  decorCircle1: {
    width: 200,
    height: 200,
    top: -60,
    right: -40,
  },
  decorCircle2: {
    width: 150,
    height: 150,
    bottom: -40,
    left: -30,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 1,
  },
  // Premium Profile Photo Styles
  profilePhotoContainer: {
    position: 'relative',
  },
  profileRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  profilePhotoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6C1110',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  // Center Section - Premium Logo
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftSection: {
    flex: 1,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 2,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  // Premium Header Actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supportButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  notificationButton: {
    position: 'relative',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#6C1110',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  // Banner Wrapper
  bannerWrapper: {
    marginTop: 20,
    paddingHorizontal: 0,
    marginBottom: 20,
  },
  // Hero Banner Styles - Compact and elevated
  heroBannerContainer: {
    marginBottom: 0,
  },
  heroBanner: {
    width: width,
    paddingHorizontal: 20,
    borderRadius: 0,
    overflow: 'visible',
  },
  heroBannerGradient: {
    padding: 16,
    minHeight: 110,
    borderRadius: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  heroBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBannerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBannerText: {
    flex: 1,
  },
  heroBannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  heroBannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 18,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(108, 17, 16, 0.3)',
  },
  dotActive: {
    backgroundColor: '#6C1110',
    width: 24,
  },
  // Premium Stats Cards
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statCardGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  statIconContainer: {
    marginBottom: 10,
  },
  statIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardFirst: {
    // No longer needed
  },
  statCardLast: {
    // No longer needed
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceCard: {
    width: '30.5%',
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    minHeight: 115,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
    textAlign: 'center',
    lineHeight: 15,
  },
  servicePrice: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '600',
  },
  appointmentCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  appointmentIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  appointmentDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  appointmentTime: {
    fontSize: 14,
    color: '#6C1110',
    fontWeight: '700',
  },
  featuredList: {
    gap: 12,
  },
  featuredItem: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  featuredLeft: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  featuredDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  featuredRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  featuredPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6C1110',
    marginBottom: 4,
  },
  // Sticky Header Styles
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  stickyHeaderGradient: {
    paddingBottom: 12,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  stickyProfileContainer: {
    width: 40,
    height: 40,
  },
  stickyProfilePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  stickyProfilePhotoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyCenterSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  stickyLogoText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1.5,
  },
  stickyUserName: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  stickyHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickySupportButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyNotificationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stickyNotificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  stickyBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  // IRS Refund Widget Styles - Modern Card Design
  refundWidget: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refundButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  refundGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  refundContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  refundIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  refundIconText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
  },
  refundTextContainer: {
    flex: 1,
  },
  refundTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  refundSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  refundArrow: {
    marginLeft: 8,
  },
  // Mi Reembolso Compact Banner Styles
  miReembolsoSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  miReembolsoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  miReembolsoGradient: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  miReembolsoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miReembolsoIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  miReembolsoIconText: {
    fontSize: 26,
  },
  miReembolsoTextContainer: {
    flex: 1,
  },
  miReembolsoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 2,
  },
  miReembolsoSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  refundEstimateBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  refundEstimateText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  miReembolsoAction: {
    alignItems: 'flex-end',
  },
  miReemboolsoButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  miReembolsoButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  miReembolsoFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
    marginTop: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featureText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
  // Quick Actions - Premium Design
  quickActionsSection: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: '23%',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    // Premium 3D effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    // Subtle border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  // Tax Dashboard Summary - Premium Card
  taxDashboardSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  taxDashboardCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    // Premium shadow
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    // Subtle border for depth
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  dashboardLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 16,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  refundInfo: {},
  refundLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refundAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: -1.5,
    // Add text shadow for depth
    textShadowColor: 'rgba(5, 150, 105, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  refundStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    // Glass effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  refundStatusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 4,
  },
  metricItem: {
    alignItems: 'center',
    width: '23%',
  },
  metricCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#D1FAE5',
  },
  metricCircleProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#A7F3D0',
    borderRadius: 24,
  },
  metricCircleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    zIndex: 1,
  },
  metricIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 2,
  },
  deadlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  deadlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  deadlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
