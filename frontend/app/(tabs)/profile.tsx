import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '../../i18n/config';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../../services/api';

interface MenuItemType {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  badge?: string;
  badgeColor?: string;
}

interface MenuSectionType {
  title: string;
  icon: string;
  items: MenuItemType[];
  hidden?: boolean;
}

export default function Profile() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { user, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [featureFlags, setFeatureFlags] = useState<any>({});
  const [subscriptionStatus, setSubscriptionStatus] = useState<{receiptsPro: boolean, financesPro: boolean}>({receiptsPro: false, financesPro: false});

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLang(lng);
    };
    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  // Load wallet balance and feature flags
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const creditsResponse = await api.get('/credits/balance');
          if (creditsResponse.data?.balance !== undefined) {
            setWalletBalance(creditsResponse.data.balance);
          }
        } catch (error) {
//           console.log('Error loading balance:', error);
        }
        
        try {
          const flagsResponse = await api.get('/feature-flags');
          setFeatureFlags(flagsResponse.data || {});
        } catch (error) {
//           console.log('Error loading feature flags:', error);
        }
        
        try {
          // Load profile completion
          const profileResponse = await api.get('/client-profile');
          const profile = profileResponse.data;
          const fields = [
            profile.first_name, profile.last_name, profile.phone,
            profile.date_of_birth, profile.sex,
            profile.address?.street, profile.address?.city,
          ];
          const filled = fields.filter(f => f && f.trim && f.trim() !== '').length;
          setProfileCompletion(Math.round((filled / fields.length) * 100));
        } catch {
          setProfileCompletion(0);
        }

        // Load subscription status
        try {
          const subRes = await api.get('/receipts/usage-limits');
          if (subRes.data) {
            setSubscriptionStatus(prev => ({
              ...prev,
              receiptsPro: subRes.data.has_receipts_pro || subRes.data.is_unlimited || false,
            }));
          }
        } catch {
          // Subscription check failed, keep defaults
        }
      };
      loadData();
    }, [])
  );

  const handleChangeProfilePicture = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('profile.permissionRequired'), t('profile.permissionRequiredDesc'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        try {
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            result.assets[0].uri,
            [{ resize: { width: 512 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );

          const response = await fetch(manipulatedImage.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            const base64Image = base64data.split(',')[1];
            
            try {
              await api.put('/users/profile-picture', { profile_picture: base64Image });
              await refreshUser();
              Alert.alert(t('profileScreen.success', '✅ Éxito'), t('profileScreen.photoUpdated', 'Foto de perfil actualizada'));
            } catch (error: any) {
              Alert.alert(t('common.error', 'Error'), t('profileScreen.photoError', 'No se pudo actualizar la foto'));
            } finally {
              setUploadingImage(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          setUploadingImage(false);
          Alert.alert(t('common.error', 'Error'), t('profileScreen.imageError', 'No se pudo procesar la imagen'));
        }
      }
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), t('profileScreen.galleryError', 'No se pudo abrir la galería'));
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logout'), style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const navigateToCredits = () => {
    router.push('/(tabs)/credits');
  };

  // Menu sections
  const menuSections: MenuSectionType[] = [
    {
      title: t('profile.subscriptionPayments', 'FINANZAS').toUpperCase(),
      icon: 'wallet',
      items: [
        {
          icon: 'wallet',
          title: t('profile.myWallet'),
          subtitle: t('profile.walletSubtitle'),
          onPress: navigateToCredits,
          badge: walletBalance > 0 ? `$${walletBalance.toFixed(2)}` : undefined,
          badgeColor: colors.success,
        },
        {
          icon: 'card',
          title: t('profile.paymentMethods'),
          subtitle: t('profile.manageCards'),
          onPress: () => router.push('/(tabs)/payment-methods'),
        },
        {
          icon: 'receipt',
          title: t('profile.invoices'),
          subtitle: t('profile.invoicesSubtitle'),
          onPress: () => router.push('/(tabs)/invoices'),
        },
      ],
    },
    {
      title: t('profile.subscriptions', 'SUSCRIPCIONES').toUpperCase(),
      icon: 'diamond',
      items: [
        {
          icon: 'camera',
          title: t('profile.receiptsPro', 'Recibos Pro'),
          subtitle: subscriptionStatus.receiptsPro
            ? t('profile.activeSubscription', '✅ Suscripción activa — $9.99/mes')
            : t('profile.inactiveSubscription', 'Escaneos ilimitados de recibos'),
          onPress: () => router.push('/finance-subscription' as any),
          badge: subscriptionStatus.receiptsPro ? 'PRO' : undefined,
          badgeColor: subscriptionStatus.receiptsPro ? '#6366F1' : undefined,
        },
        {
          icon: 'settings',
          title: t('profile.manageAppStoreSubscriptions', 'Gestionar en App Store'),
          subtitle: t('profile.cancelOrChangePlan', 'Cancelar o cambiar plan'),
          onPress: () => {
            Linking.openURL('https://apps.apple.com/account/subscriptions');
          },
        },
      ],
    },
    {
      title: t('home.documents', 'MIS DOCUMENTOS').toUpperCase(),
      icon: 'folder',
      items: [
        {
          icon: 'document-text',
          title: t('profile.taxReturns'),
          subtitle: t('profile.taxReturnsSubtitle'),
          onPress: () => router.push('/(tabs)/tax-returns'),
        },
        {
          icon: 'camera',
          title: t('profile.expenseReceipts'),
          subtitle: t('profile.expenseReceiptsSubtitle'),
          onPress: () => router.push('/(tabs)/my-receipts'),
        },
        {
          icon: 'cube',
          title: t('profile.myShipments'),
          subtitle: t('profile.myShipmentsSubtitle'),
          onPress: () => router.push('/(tabs)/shipments'),
        },
      ],
    },
    {
      title: t('profile.accountInfo', 'MI CUENTA').toUpperCase(),
      icon: 'person-circle',
      items: [
        {
          icon: 'person-circle',
          title: t('profile.personalInfo', 'Mi Perfil'),
          subtitle: profileCompletion > 0 ? `${profileCompletion}% ${t('profile.completed', 'completado')}` : t('profile.fullProfileSubtitle', 'Completa tu información'),
          onPress: () => router.push('/(tabs)/personal-info'),
          badge: profileCompletion < 100 ? '⭐' : '✓',
          badgeColor: profileCompletion < 100 ? colors.warning : colors.success,
        },
        {
          icon: 'shield-checkmark',
          title: t('profile.security'),
          subtitle: t('profile.securitySubtitle'),
          onPress: () => router.push('/(tabs)/security-settings'),
        },
      ],
    },
    {
      title: t('home.appointments', 'CITAS').toUpperCase(),
      icon: 'calendar',
      items: [
        {
          icon: 'calendar',
          title: t('profile.bookAppointment'),
          subtitle: t('profile.bookAppointmentSubtitle'),
          onPress: () => router.push('/(tabs)/appointments'),
        },
        {
          icon: 'time',
          title: t('profile.myAppointments'),
          subtitle: t('profile.myAppointmentsSubtitle'),
          onPress: () => router.push('/(tabs)/appointments'),
        },
      ],
    },
    {
      title: t('home.games', 'ENTRETENIMIENTO').toUpperCase(),
      icon: 'game-controller',
      hidden: !(featureFlags.gambling_enabled || featureFlags.raffles_enabled),
      items: [
        {
          icon: 'game-controller',
          title: t('home.games'),
          subtitle: t('home.winPrizes'),
          onPress: () => router.push('/(tabs)/games'),
          badge: '🎁',
          badgeColor: '#6C1110',
        },
        {
          icon: 'share-social',
          title: t('home.referrals'),
          subtitle: t('home.earnCredits'),
          onPress: () => router.push('/(tabs)/referrals'),
          badge: '$$$',
          badgeColor: '#10B981',
        },
      ],
    },
    {
      title: t('profile.settings', 'PREFERENCIAS').toUpperCase(),
      icon: 'settings',
      items: [
        {
          icon: 'notifications',
          title: t('profile.notifications'),
          subtitle: t('profile.notificationPreferences'),
          onPress: () => router.push('/(tabs)/notification-settings'),
        },
        {
          icon: 'language',
          title: t('profile.language'),
          subtitle: currentLang === 'es' ? t('profile.spanish') : t('profile.english'),
          onPress: () => router.push('/(tabs)/language-settings'),
        },
      ],
    },
    {
      title: t('profile.help', 'AYUDA').toUpperCase(),
      icon: 'help-circle',
      items: [
        {
          icon: 'help-circle',
          title: t('profile.help'),
          subtitle: t('profile.helpSubtitle'),
          onPress: () => router.push('/(tabs)/help'),
        },
        {
          icon: 'book',
          title: t('profile.education'),
          subtitle: t('profile.educationSubtitle'),
          onPress: () => router.push('/(tabs)/education'),
        },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItemType, isLast: boolean) => (
    <TouchableOpacity
      key={item.title}
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIconContainer}>
        <Ionicons name={item.icon as any} size={20} color="#10B981" />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{item.title}</Text>
        {item.subtitle && <Text style={styles.menuSubtitle}>{item.subtitle}</Text>}
      </View>
      {item.badge && (
        <View style={[styles.badge, { backgroundColor: item.badgeColor || '#10B981' }]}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
    </TouchableOpacity>
  );

  const renderSection = (section: MenuSectionType) => (
    <View key={section.title} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={section.icon as any} size={16} color={colors.textGray} />
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {section.items.map((item, index) => 
          renderMenuItem(item, index === section.items.length - 1)
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* FIXED HEADER */}
      <LinearGradient
        colors={['#064E3B', '#065F46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.headerContent}>
            {/* Avatar and Info */}
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleChangeProfilePicture}
              disabled={uploadingImage}
            >
              {user?.profile_picture ? (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${user.profile_picture}` }} 
                  style={styles.avatar} 
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={28} color="#fff" />
                </View>
              )}
              <View style={styles.cameraButton}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={12} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
            
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>

            {/* Quick Stats - All clickable */}
            <View style={styles.quickStats}>
              <TouchableOpacity 
                style={styles.quickStatItem}
                onPress={navigateToCredits}
                activeOpacity={0.7}
              >
                <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.quickStatValue}>${walletBalance.toFixed(2)}</Text>
                <Text style={styles.quickStatLabel}>{t('profileScreen.balance', 'Balance')}</Text>
              </TouchableOpacity>
              
              <View style={styles.quickStatDivider} />
              
              <TouchableOpacity 
                style={styles.quickStatItem}
                onPress={() => router.push('/complete-profile')}
                activeOpacity={0.7}
              >
                <Ionicons name="person-circle-outline" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.quickStatValue}>{profileCompletion}%</Text>
                <Text style={styles.quickStatLabel}>{t('profileScreen.profile', 'Perfil')}</Text>
              </TouchableOpacity>
              
              <View style={styles.quickStatDivider} />
              
              <TouchableOpacity 
                style={styles.quickStatItem}
                onPress={() => router.push('/(tabs)/appointments')}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.9)" />
                <Text style={styles.quickStatValue}>{t('profileScreen.view', 'Ver')}</Text>
                <Text style={styles.quickStatLabel}>{t('profileScreen.appointments', 'Citas')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* SCROLLABLE MENU */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Menu Sections */}
        {menuSections.filter(s => !s.hidden).map(renderSection)}

        {/* Legal Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={16} color={colors.textGray} />
            <Text style={styles.sectionTitle}>LEGAL</Text>
          </View>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemBorder]}
              onPress={() => Linking.openURL('https://www.rosstaxpreparation.com/terms')}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="document" size={20} color={colors.info} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.termsConditions', 'Términos y Condiciones')}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textLight} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => Linking.openURL('https://www.rosstaxpreparation.com/privacy')}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="shield" size={20} color={colors.info} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{t('profile.privacyPolicy', 'Política de Privacidad')}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Government Disclaimer & IRS Sources */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={16} color={colors.textGray} />
            <Text style={styles.sectionTitle}>{t('profile.disclaimer', 'AVISO LEGAL')}</Text>
          </View>
          <View style={[styles.sectionContent, { padding: 16 }]}>
            <Text style={{ fontSize: 13, color: colors.textGray, lineHeight: 20, marginBottom: 12 }}>
              {t('profile.disclaimerText', 'Ross Tax Preparation es un servicio independiente de preparación de impuestos. Esta aplicación NO está afiliada, respaldada ni asociada con el Servicio de Impuestos Internos (IRS) ni con ninguna agencia gubernamental.')}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 }}>
              {t('profile.officialSources', 'Fuentes oficiales del gobierno:')}
            </Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              onPress={() => Linking.openURL('https://www.irs.gov')}
            >
              <Ionicons name="globe-outline" size={18} color="#0066CC" />
              <Text style={{ fontSize: 14, color: '#0066CC', marginLeft: 8 }}>{t('profile.irsOfficial', 'IRS.gov — Servicio de Impuestos Internos')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              onPress={() => Linking.openURL('https://www.irs.gov/refunds')}
            >
              <Ionicons name="globe-outline" size={18} color="#0066CC" />
              <Text style={{ fontSize: 14, color: '#0066CC', marginLeft: 8 }}>{t('profile.irsRefunds', 'IRS.gov/refunds — Estado de reembolso')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              onPress={() => Linking.openURL('https://www.irs.gov/individuals/individual-taxpayer-identification-number')}
            >
              <Ionicons name="globe-outline" size={18} color="#0066CC" />
              <Text style={{ fontSize: 14, color: '#0066CC', marginLeft: 8 }}>{t('profile.irsItin', 'IRS.gov — Información de ITIN')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              onPress={() => Linking.openURL('https://www.irs.gov/forms-instructions')}
            >
              <Ionicons name="globe-outline" size={18} color="#0066CC" />
              <Text style={{ fontSize: 14, color: '#0066CC', marginLeft: 8 }}>{t('profile.irsForms', 'IRS.gov — Formularios e instrucciones')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info with Brand Color */}
        <View style={styles.appInfo}>
          <View style={{ 
            width: 64, 
            height: 64, 
            borderRadius: 16, 
            backgroundColor: '#6C1110', 
            justifyContent: 'center', 
            alignItems: 'center',
            marginBottom: 12,
            shadowColor: '#6C1110',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}>
            <Ionicons name="business" size={32} color="#FFF" />
          </View>
          <Text style={[styles.appVersion, { color: '#6C1110', fontWeight: '700', fontSize: 16 }]}>Ross Tax Preparation</Text>
          <Text style={styles.appVersion}>v1.2.2</Text>
          <Text style={styles.appCopyright}>© 2025 Todos los derechos reservados</Text>
          <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 4, textAlign: 'center' }}>
            {t('profile.notGovernment', 'Servicio independiente — No afiliado al gobierno')}
          </Text>
        </View>

        {/* Logout & Delete */}
        <View style={styles.dangerZone}>
          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#6C111015', borderColor: '#6C1110' }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#6C1110" />
            <Text style={[styles.logoutText, { color: '#6C1110' }]}>Cerrar Sesión</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => Alert.alert(t('profileScreen.deleteAccount', 'Eliminar Cuenta'), t('profileScreen.deleteAccountMessage', 'Contacta a soporte para eliminar tu cuenta.'))}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textGray} />
            <Text style={styles.deleteText}>Eliminar Cuenta</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  // Fixed Header
  headerGradient: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 28,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 10,
  },
  safeHeader: {
    paddingBottom: 24,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    // Premium shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 18,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  // Quick Stats - Premium Glass Effect
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  quickStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 6,
  },
  // Scrollable Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 30,
  },
  // Sections - Premium Design
  section: {
    marginHorizontal: 16,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionContent: {
    backgroundColor: colors.background,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border + '20',
  },
  // Menu Items - Premium
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  // App Info - Premium
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appLogo: {
    width: 56,
    height: 56,
    marginBottom: 10,
    borderRadius: 14,
  },
  appVersion: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '600',
  },
  appCopyright: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
  },
  // Danger Zone - Premium
  dangerZone: {
    marginHorizontal: 16,
    gap: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.error + '10',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.error + '25',
    // Premium shadow
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '500',
  },
});
