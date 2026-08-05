import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '../../i18n/config';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../../services/api';
import CustomHeader from '../../components/CustomHeader';

export default function Profile() {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { user, signOut, refreshUser } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());
  const [uploadingImage, setUploadingImage] = useState(false);
  const [gamblingEnabled, setGamblingEnabled] = useState(false);

  // Fetch feature flags to check if gambling should be shown
  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await api.get('/api/feature-flags');
        setGamblingEnabled(response.data?.gambling_enabled || false);
      } catch (error) {
        console.log('Feature flags not available');
        setGamblingEnabled(false);
      }
    };
    fetchFlags();
  }, []);

  // Update currentLang when i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLang(lng);
    };
    
    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  const handleChangeProfilePicture = async () => {
    try {
      console.log('🎯 Iniciando cambio de foto de perfil...');
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📋 Permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert('Permiso Requerido', 'Necesitamos permiso para acceder a tus fotos');
        return;
      }

      // Launch image picker
      console.log('📱 Abriendo selector de imágenes...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      console.log('📸 Resultado del picker:', result.canceled ? 'cancelado' : 'seleccionado');

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        
        try {
          console.log('🔄 Optimizando imagen...');
          // Optimizar y redimensionar imagen
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            result.assets[0].uri,
            [{ resize: { width: 512 } }],
            {
              compress: 0.7,
              format: ImageManipulator.SaveFormat.JPEG,
            }
          );

          console.log('✅ Imagen optimizada:', manipulatedImage.width, 'x', manipulatedImage.height);

          // Convert to base64
          console.log('🔄 Convirtiendo a base64...');
          const response = await fetch(manipulatedImage.uri);
          const blob = await response.blob();
          
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result?.toString().split(',')[1];
              if (result) {
                resolve(result);
              } else {
                reject(new Error('No se pudo obtener base64'));
              }
            };
            reader.onerror = () => reject(new Error('Error al leer la imagen'));
            reader.readAsDataURL(blob);
          });

          const sizeInKB = (base64.length * 0.75) / 1024;
          console.log(`📦 Tamaño final: ${sizeInKB.toFixed(2)} KB`);
          
          if (sizeInKB > 1024) {
            Alert.alert('Advertencia', 'La imagen es muy grande. Puede tardar en subir.');
          }

          console.log('☁️ Subiendo imagen al servidor...');
          await api.put('/users/me', { profile_picture: base64 });
          
          console.log('🔄 Actualizando datos del usuario...');
          await refreshUser();
          
          console.log('✅ Foto de perfil actualizada exitosamente');
          Alert.alert('Éxito', 'Foto de perfil actualizada correctamente');
        } catch (error: any) {
          console.error('❌ Error en el proceso:', error);
          Alert.alert(
            'Error', 
            error.response?.data?.detail || error.message || 'No se pudo actualizar la foto. Intenta con una imagen más pequeña.'
          );
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error: any) {
      console.error('❌ Error general:', error);
      Alert.alert('Error', 'No se pudo iniciar el selector de imágenes');
      setUploadingImage(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
      if (confirmed) {
        signOut().catch((error) => {
          console.error('Error al cerrar sesión:', error);
          window.alert('Error al cerrar sesión. Intenta de nuevo.');
        });
      }
    } else {
      Alert.alert(
        t('profile.logoutConfirm'),
        t('profile.logoutMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.logout'),
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
                // Navigation is handled by signOut in AuthContext
              } catch (error) {
                console.error('Error al cerrar sesión:', error);
                Alert.alert('Error', 'No se pudo cerrar sesión');
              }
            },
          },
        ]
      );
    }
  };

  const handleLanguageChange = () => {
    Alert.alert(
      'Cambiar Idioma / Change Language',
      'Selecciona tu idioma / Select your language',
      [
        {
          text: 'Español',
          onPress: async () => {
            await changeLanguage('es');
            setCurrentLang('es');
            // Force re-render by triggering a state update
            setTimeout(() => {
              Alert.alert('Éxito', 'Idioma cambiado a Español. La aplicación se actualizará.');
            }, 100);
          },
        },
        {
          text: 'English',
          onPress: async () => {
            await changeLanguage('en');
            setCurrentLang('en');
            // Force re-render by triggering a state update
            setTimeout(() => {
              Alert.alert('Success', 'Language changed to English. The app will update.');
            }, 100);
          },
        },
        { text: 'Cancelar / Cancel', style: 'cancel' },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'card-outline',
      title: t('profile.subscriptionPayments'),
      subtitle: t('profile.subscriptionPaymentsSubtitle'),
      onPress: () => router.push('/(tabs)/subscription'),
      highlight: true,
    },
    {
      icon: 'cash-outline',
      title: t('wallet.myWallet', 'Mi Wallet'),
      subtitle: t('wallet.walletSubtitle', 'Balance, créditos y transacciones'),
      onPress: () => router.push('/(tabs)/credits'),
      highlight: false,
      showBadge: true,
    },
    // Games menu item - only show if gambling is enabled
    ...(gamblingEnabled ? [{
      icon: 'game-controller-outline' as keyof typeof Ionicons.glyphMap,
      title: t('games.menuTitle'),
      subtitle: t('games.menuSubtitle'),
      onPress: () => router.push('/(tabs)/games'),
      highlight: false,
    }] : []),
    {
      icon: 'wallet-outline',
      title: t('profile.paymentMethods'),
      subtitle: t('profile.manageCards'),
      onPress: () => router.push('/(tabs)/payment-methods'),
    },
    {
      icon: 'receipt-outline',
      title: t('tabs.invoices'),
      subtitle: t('invoices.subtitle'),
      onPress: () => router.push('/(tabs)/invoices'),
    },
    {
      icon: 'cube-outline',
      title: 'Envíos USPS',
      subtitle: 'Rastrear paquetes y documentos',
      onPress: () => router.push('/(tabs)/shipments'),
    },
    {
      icon: 'person-outline',
      title: t('profile.personalInfo'),
      subtitle: t('profile.accountInfo'),
      onPress: () => router.push('/(tabs)/personal-info'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: t('profile.privacy'),
      subtitle: 'Cambiar contraseña',
      onPress: () => router.push('/(tabs)/change-password'),
    },
    {
      icon: 'notifications-outline',
      title: t('profile.notifications'),
      subtitle: t('profile.notificationPreferences'),
      onPress: () => router.push('/(tabs)/notification-settings'),
    },
    {
      icon: 'language-outline',
      title: t('profile.language'),
      subtitle: currentLang === 'es' ? t('profile.spanish') : t('profile.english'),
      onPress: () => router.push('/(tabs)/language-settings'),
    },
    {
      icon: 'color-palette-outline',
      title: t('profile.appearance'),
      subtitle: t('profile.themeDescription'),
      onPress: () => router.push('/(tabs)/theme-settings'),
    },
    {
      icon: 'help-circle-outline',
      title: t('profile.help'),
      subtitle: t('profile.faqContact'),
      onPress: () => router.push('/(tabs)/help'),
    },
    {
      icon: 'time-outline',
      title: t('profile.officeHours'),
      subtitle: t('profile.officeHoursSubtitle'),
      onPress: () => router.push('/(tabs)/office-hours'),
    },
    {
      icon: 'calendar-outline',
      title: t('profile.bookAppointment'),
      subtitle: t('profile.bookAppointmentSubtitle'),
      onPress: () => router.push('/(tabs)/book-appointment'),
    },
    {
      icon: 'calendar-sharp',
      title: t('profile.myAppointments'),
      subtitle: t('profile.myAppointmentsSubtitle'),
      onPress: () => router.push('/(tabs)/my-appointments'),
    },
    {
      icon: 'construct-outline',
      title: t('profile.tools'),
      subtitle: t('profile.toolsSubtitle'),
      onPress: () => router.push('/(tabs)/tools'),
    },
    {
      icon: 'document-text-outline',
      title: t('profile.myTaxEstimates'),
      subtitle: t('profile.myTaxEstimatesSubtitle'),
      onPress: () => router.push('/(tabs)/my-tax-estimates'),
    },
    {
      icon: 'location-outline',
      title: t('profile.geolocation'),
      subtitle: t('profile.geolocationSubtitle'),
      onPress: () => router.push('/(tabs)/location-settings'),
    },
    {
      icon: 'information-circle-outline',
      title: t('profile.about'),
      subtitle: t('profile.version') + ' 1.0.0',
      onPress: () => Alert.alert('Ross Tax Preparation', 'Versión 1.0.0\n\n© 2025 Ross Tax Preparation. Todos los derechos reservados.'),
    },
  ];

  const legalItems = [
    {
      icon: 'book-outline',
      title: t('profile.education', 'Contenido Educativo'),
      subtitle: t('profile.educationSubtitle', 'Aprende sobre impuestos'),
      onPress: () => router.push('/(tabs)/education'),
    },
    {
      icon: 'newspaper-outline',
      title: t('profile.news', 'Noticias'),
      subtitle: t('profile.newsSubtitle', 'Mantente actualizado'),
      onPress: () => router.push('/(tabs)/news'),
    },
    {
      icon: 'help-circle-outline',
      title: t('profile.help', 'Help & FAQs'),
      subtitle: t('profile.helpSubtitle', 'Get answers to common questions'),
      onPress: () => router.push('/(tabs)/help'),
    },
    {
      icon: 'document-text-outline',
      title: t('profile.termsConditions'),
      onPress: () => router.push('/(tabs)/terms'),
    },
    {
      icon: 'shield-checkmark-outline',
      title: t('profile.privacyPolicy'),
      onPress: () => router.push('/(tabs)/privacy'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Custom Header */}
      <CustomHeader title="Menú" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Horizontal Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => {
              console.log('🖼️ TouchableOpacity presionado - Iniciando cambio de foto...');
              handleChangeProfilePicture();
            }}
            disabled={uploadingImage}
            activeOpacity={0.7}
          >
            {user?.profile_picture ? (
              <Image 
                source={{ uri: `data:image/jpeg;base64,${user.profile_picture}` }} 
                style={styles.avatar} 
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color={colors.textWhite} />
              </View>
            )}
            {uploadingImage ? (
              <View style={styles.cameraButton}>
                <ActivityIndicator size="small" color={colors.textWhite} />
              </View>
            ) : (
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={12} color={colors.textWhite} />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        {/* Compact Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.menuItem,
                item.highlight && styles.highlightedMenuItem
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[
                styles.menuIcon,
                item.highlight && styles.highlightedIcon
              ]}>
                <Ionicons 
                  name={item.icon as any} 
                  size={20} 
                  color={item.highlight ? colors.textWhite : colors.primary} 
                />
              </View>
              <View style={styles.menuContent}>
                <Text style={[
                  styles.menuTitle,
                  item.highlight && styles.highlightedTitle
                ]}>{item.title}</Text>
                {item.subtitle && (
                  <Text style={[
                    styles.menuSubtitle,
                    item.highlight && styles.highlightedSubtitle
                  ]}>{item.subtitle}</Text>
                )}
              </View>
              <Ionicons 
                name="chevron-forward" 
                size={16} 
                color={item.highlight ? colors.textWhite : colors.textLight} 
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal Section */}
        <View style={styles.legalSection}>
          <Text style={styles.sectionTitle}>⚖️ Legal</Text>
          {legalItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon as any} size={20} color={colors.info} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.menuSection}>
          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '20',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.accent,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: colors.textGray,
  },
  menuSection: {
    padding: 16,
  },
  legalSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 2,
  },
  highlightedMenuItem: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  highlightedIcon: {
    backgroundColor: colors.primary + '40',
  },
  highlightedTitle: {
    color: colors.textWhite,
    fontWeight: '700',
  },
  highlightedSubtitle: {
    color: colors.textWhite + 'CC',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.error + '30',
    elevation: 2,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },
});