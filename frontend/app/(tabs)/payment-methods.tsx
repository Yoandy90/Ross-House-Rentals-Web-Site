import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Image,
  Platform,
  KeyboardAvoidingView,
  Linking,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../constants/colors';
import api from '../../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import CustomHeader from '../../components/CustomHeader';
import { useTranslation } from 'react-i18next';
// SignaturePad removed - using text input instead

interface PaymentMethod {
  id: string;
  type: string; // 'card', 'us_bank_account', 'stripe', 'manual'
  last4: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  stripe_payment_method_id?: string;
  // ACH-specific fields
  bank_name?: string;
  account_holder_type?: string;
  account_type?: string; // 'checking' or 'savings'
  routing_number?: string;
}

export default function PaymentMethodsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const planIdFromRoute = params.planId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddACH, setShowAddACH] = useState(false);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Debug log
//   console.log('PaymentMethods component loaded - ACH support enabled');

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  
  // ACH form state - Authorize.net
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [achSignature, setAchSignature] = useState('');
  const [achTermsAccepted, setAchTermsAccepted] = useState(false);
  // showSignaturePad state removed - using text input for signature
  
  // Manual payment method state
  const [showManualOption, setShowManualOption] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [userConsent, setUserConsent] = useState(false);
  
  // Alternative payment methods settings (loaded from backend)
  const [altPaymentSettings, setAltPaymentSettings] = useState({
    zelle_email: 'yoandyross@gmail.com',
    venmo_username: '@RossTaxPrep',
    cashapp_username: '$RossTaxPrep',
    paypal_link: 'paypal.me/rosstaxprep'
  });

  useEffect(() => {
    loadPaymentMethods();
    loadAltPaymentSettings();
  }, []);
  
  const loadAltPaymentSettings = async () => {
    try {
      const response = await api.get('/app/settings');
      if (response.data?.settings) {
        const s = response.data.settings;
        setAltPaymentSettings(prev => ({
          zelle_email: s.zelle_email || prev.zelle_email,
          venmo_username: s.venmo_username || prev.venmo_username,
          cashapp_username: s.cashapp_username || prev.cashapp_username,
          paypal_link: s.paypal_link || prev.paypal_link
        }));
      }
    } catch (error) {
      // Use defaults
//       console.log('Using default payment settings');
    }
  };

  const loadPaymentMethods = async () => {
    try {
//       console.log('🔄 Loading payment methods...');
      setLoading(true);
      
      // Load from ALL sources: NMI (new), Stripe (legacy), and Manual
      const [nmiResponse, stripeResponse, manualResponse] = await Promise.all([
        api.get('/payment-methods').catch(() => ({ data: { payment_methods: [] } })),
        api.get('/payments/payment-methods').catch(() => ({ data: [] })),
        api.get('/payments/manual-payment-methods').catch(() => ({ data: [] }))
      ]);
      
      // NMI cards + bank accounts (new system)
      const nmiMethods = (nmiResponse.data.payment_methods || nmiResponse.data || []).map((m: any) => ({
        ...m,
        type: m.type || 'card',
        last4: m.last4 || m.last_4 || m.bank_account_last4 || '',
        brand: m.brand || m.card_brand || (m.type === 'bank_account' ? 'ACH' : 'Card'),
        account_type: m.account_type || m.bank_account_type || '',
        bank_name: m.bank_name || m.account_holder_name || '',
      }));
      
//       console.log('💳 NMI methods received:', nmiMethods.length);
//       console.log('💳 Stripe methods received:', stripeResponse.data?.length || 0);
//       console.log('📝 Manual methods received:', manualResponse.data?.length || 0);
      
      // Combine all types, NMI first
      const stripeMethods = (stripeResponse.data || []).map((m: any) => ({ ...m, type: 'stripe' }));
      const manualMethods = (manualResponse.data || []).map((m: any) => ({ ...m, type: 'manual' }));
      
      const allMethods = [...nmiMethods, ...stripeMethods, ...manualMethods];
      
//       console.log('✅ Total combined methods:', allMethods.length);
      
      setPaymentMethods(allMethods);
    } catch (error: any) {
      console.error('❌ Error loading payment methods:', error);
      if (error.response?.status !== 404) {
        Alert.alert(t('common.error'), t('payments.noMethodsDesc'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPaymentMethods();
  };

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').substr(0, 19);
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.substr(0, 2) + '/' + cleaned.substr(2, 2);
    }
    return cleaned;
  };

  const handleCardNumberChange = (text: string) => {
    const formatted = formatCardNumber(text);
    setCardNumber(formatted);
  };

  const handleExpiryChange = (text: string) => {
    const formatted = formatExpiryDate(text);
    setExpiryDate(formatted);
  };

  const validateCard = () => {
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    
    if (cleanCardNumber.length < 15) {
      Alert.alert(t('common.error'), t('paymentMethods.cardNumber') + ' ' + t('common.error').toLowerCase());
      return false;
    }

    if (!cardName.trim()) {
      Alert.alert(t('common.error'), t('paymentMethods.cardholderName'));
      return false;
    }

    const expiryParts = expiryDate.split('/');
    if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
      Alert.alert(t('common.error'), t('paymentMethods.expiryDate'));
      return false;
    }

    const month = parseInt(expiryParts[0]);
    if (month < 1 || month > 12) {
      Alert.alert(t('common.error'), t('paymentMethods.expiryDate'));
      return false;
    }

    if (cvv.length < 3) {
      Alert.alert(t('common.error'), 'CVV');
      return false;
    }

    return true;
  };

  const handleAddCard = async () => {
    if (!validateCard()) return;

    // SIEMPRE usar flujo Stripe + guardar datos encriptados
    setProcessing(true);
    try {
      const cleanCardNumber = cardNumber.replace(/\s/g, '');
      const expiryParts = expiryDate.split('/');
      
      const response = await api.post('/payment-methods', {
        card_number: cleanCardNumber,
        cardholder_name: cardName,
        exp_month: parseInt(expiryParts[0]),
        exp_year: parseInt('20' + expiryParts[1]),
        cvv: cvv,
        set_as_default: paymentMethods.length === 0
      });

//       console.log('✅ Payment method added successfully:', response.data);
      Alert.alert(t('common.success', 'Éxito'), t('payments.addMethod', 'Método de pago agregado correctamente'));
      setShowAddCard(false);
      resetForm();
      await loadPaymentMethods();

      if (planIdFromRoute) {
        const methodsResponse = await api.get('/payment-methods');
        const methods = methodsResponse.data.payment_methods || methodsResponse.data || [];
        if (methods.length > 0) {
          await handleCreateSubscription(methods[0].stripe_payment_method_id);
        }
      }
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('paymentMethods.addError', 'No se pudo agregar el método de pago'));
    } finally {
      setProcessing(false);
    }
  };

  const handleAddManualMethod = async () => {
    if (!userConsent) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.termsRequired', 'Debes aceptar los términos para continuar'));
      return;
    }

    setProcessing(true);
    setShowConsentModal(false);

    try {
      const cleanCardNumber = cardNumber.replace(/\s/g, '');
      const expiryParts = expiryDate.split('/');
      
      const response = await api.post('/payments/manual-payment-methods', {
        card_number: cleanCardNumber,
        cvv: cvv,
        cardholder_name: cardName,
        exp_month: parseInt(expiryParts[0]),
        exp_year: parseInt('20' + expiryParts[1]),
        user_consent: true,
        set_as_default: paymentMethods.length === 0
      });

      Alert.alert(
        t('common.success', 'Éxito'), 
        t('paymentMethods.savedSecurely', 'Método de pago guardado de forma segura con encriptación AES-256.\n\nEste método estará disponible para procesamiento manual de pagos.')
      );
      setShowAddCard(false);
      setShowManualOption(false);
      setUserConsent(false);
      resetForm();
      await loadPaymentMethods();
    } catch (error: any) {
      console.error('Error adding manual payment method:', error);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('paymentMethods.saveError', 'No se pudo guardar el método de pago'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateSubscription = async (paymentMethodId: string) => {
    try {
      await api.post('/payments/subscription', {
        plan_id: planIdFromRoute,
        payment_method_id: paymentMethodId
      });

      Alert.alert(t('paymentMethods.success', 'Éxito'), t('paymentMethods.subscriptionSuccess', '¡Suscripción creada exitosamente!'), [
        {
          text: 'Ver Suscripción',
          onPress: () => router.replace('/(tabs)/subscription')
        }
      ]);
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('paymentMethods.subscriptionError', 'No se pudo crear la suscripción'));
    }
  };

  const handleAddACH = async () => {
    // Validaciones
    if (!accountName.trim()) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.achNameRequired', 'Ingresa el nombre del titular de la cuenta'));
      return;
    }
    
    if (!routingNumber || routingNumber.length !== 9) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.achRoutingInvalid', 'Número de routing inválido (debe ser 9 dígitos)'));
      return;
    }
    
    if (!accountNumber || accountNumber.length < 4) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.achAccountInvalid', 'Número de cuenta inválido'));
      return;
    }

    if (!achTermsAccepted) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.achTermsRequired', 'Debes aceptar los términos de autorización ACH'));
      return;
    }

    setProcessing(true);
    
    try {
//       console.log('🏦 Iniciando autorización ACH con Authorize.net...');
      
      // Obtener datos del usuario actual desde el contexto
      const userResponse = await api.get('/auth/me');
      const currentUser = userResponse.data;
      
//       console.log('📋 Usuario actual:', currentUser);
      
      // Preparar request para el backend Authorize.net
      const achPaymentRequest = {
        customer_id: currentUser.id,
        invoice_id: null, // No hay invoice asociado en este flujo
        amount_cents: 0, // Monto 0 solo para autorización de método de pago
        
        // Información bancaria
        routing_number: routingNumber,
        account_number: accountNumber,
        account_type: accountType,
        
        // Información del cliente
        customer_name: accountName,
        customer_email: currentUser.email,
        
        // Firma electrónica (usar nombre de la cuenta)
        signature_type: 'typed',
        signature_data: accountName,
        
        // Metadata de autorización
        ip_address: '0.0.0.0', // En producción obtener la IP real
        user_agent: 'Ross Tax Mobile App - Expo',
        
        // Aceptación de términos
        terms_accepted: achTermsAccepted,
        authorization_version: 'v1.0-es'
      };
      
      // Llamar al endpoint ACH de Authorize.net
      const response = await api.post('/payments/ach/initiate-payment', achPaymentRequest);
      
//       console.log('✅ Respuesta ACH:', response.data);
      
      if (response.data.success) {
        Alert.alert(
          t('common.success', 'Éxito'),
          t('paymentMethods.achAuthorizedSuccess', 'Cuenta bancaria autorizada exitosamente con Authorize.net.\n\n✅ Autorización guardada\n✅ PDF de evidencia generado\n✅ Método de pago disponible\n\nID de Autorización: ') + response.data.authorization_id?.substring(0, 8) + '...'
        );
        
        setShowAddACH(false);
        resetACHForm();
        await loadPaymentMethods();
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          response.data.message || t('paymentMethods.achAuthorizeFailed', 'No se pudo autorizar la cuenta bancaria')
        );
      }
      
    } catch (error: any) {
      console.error('❌ Error en autorización ACH:', error);
      Alert.alert(t('common.error', 'Error'), error.response?.data?.detail || t('paymentMethods.achError', 'No se pudo procesar la autorización ACH'));
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setCardNumber('');
    setCardName('');
    setExpiryDate('');
    setCvv('');
  };
  
  const resetACHForm = () => {
    setRoutingNumber('');
    setAccountNumber('');
    setAccountName('');
    setAccountType('checking');
    setAchSignature('');
    setAchTermsAccepted(false);
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      // Try NMI endpoint first, then legacy
      try {
        await api.patch(`/payment-methods/${methodId}/default`);
      } catch {
        await api.patch(`/payments/payment-methods/${methodId}/default`);
      }
      Alert.alert(t('paymentMethods.success', 'Éxito'), t('paymentMethods.defaultUpdated', 'Método de pago predeterminado actualizado'));
      loadPaymentMethods();
    } catch (error) {
      Alert.alert(t('common.error', 'Error'), t('paymentMethods.defaultError', 'No se pudo actualizar el método predeterminado'));
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
//     console.log('🗑️ Deleting payment method ID:', methodId);
    
    // Función para confirmar eliminación
    const confirmDelete = async () => {
      try {
//         console.log('🚀 Sending DELETE request...');
        // Try NMI endpoint first, then legacy
        let response;
        try {
          response = await api.delete(`/payment-methods/${methodId}`);
        } catch {
          response = await api.delete(`/payments/payment-methods/${methodId}`);
        }
//         console.log('✅ Delete response:', response);
        
        if (Platform.OS === 'web') {
          alert('Éxito: Método de pago eliminado exitosamente');
        } else {
          Alert.alert(t('paymentMethods.success', 'Éxito'), t('paymentMethods.deleteSuccess', 'Método de pago eliminado exitosamente'));
        }
        
//         console.log('🔄 Reloading payment methods...');
        await loadPaymentMethods();
//         console.log('✅ Payment methods reloaded');
      } catch (error: any) {
        console.error('❌ Error deleting payment method:', error);
        console.error('Error response:', error.response?.data);
        
        const errorMessage = error.response?.data?.detail || 'No se pudo eliminar el método de pago';
        if (Platform.OS === 'web') {
          alert('Error: ' + errorMessage);
        } else {
          Alert.alert('Error', errorMessage);
        }
      }
    };
    
    // Confirmar en web o móvil
    if (Platform.OS === 'web') {
      if (window.confirm('¿Estás seguro que deseas eliminar este método de pago?')) {
        await confirmDelete();
      }
    } else {
      Alert.alert(
        'Eliminar Método de Pago',
        '¿Estás seguro que deseas eliminar este método de pago?',
        [
          {
            text: t('common.cancel', 'Cancelar'),
            style: 'cancel',
//             onPress: () => console.log('User cancelled deletion')
          },
          {
            text: t('common.delete', 'Eliminar'),
            style: 'destructive',
            onPress: confirmDelete
          }
        ]
      );
    }
  };

  const handleSelectAndSubscribe = async (methodId: string) => {
//     console.log('🎯 handleSelectAndSubscribe called with methodId:', methodId);
//     console.log('📋 planIdFromRoute:', planIdFromRoute);
    
    if (!planIdFromRoute) {
//       console.log('⚠️ No planId in route, cannot subscribe');
      return;
    }

    try {
      setProcessing(true);
//       console.log('🔍 Finding payment method...');

      // Find the payment method
      const method = paymentMethods.find(pm => pm.id === methodId);
//       console.log('💳 Found method:', method);
      
      if (!method) {
//         console.log('❌ Method not found!');
        Alert.alert('Error', 'Método de pago no encontrado');
        return;
      }

      // Check if it's a manual payment method
      if (method.type === 'manual') {
//         console.log('⚠️ Manual payment method cannot be used for subscriptions');
        Alert.alert('Error', 'Los métodos de pago manuales no pueden usarse para suscripciones. Por favor agrega una tarjeta.');
        return;
      }

      // Create subscription with Stripe payment method
      const response = await api.post('/payments/subscription', {
        plan_id: planIdFromRoute,
        payment_method_id: method.stripe_payment_method_id
      });

//       console.log('✅ Subscription created:', response.data);
      
      Alert.alert(t('common.success', 'Éxito'), '¡Suscripción creada exitosamente!');
      router.replace('/(tabs)/subscription');
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.detail || error.message || 'Error al crear la suscripción';
      Alert.alert('Error', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const getCardBrandIcon = (brand: string) => {
    const brandMap: Record<string, string> = {
      visa: 'card',
      mastercard: 'card',
      amex: 'card',
      discover: 'card',
    };
    return brandMap[brand.toLowerCase()] || 'card';
  };

  const renderPaymentMethodCard = (method: PaymentMethod) => {
    const isSelectableMode = !!planIdFromRoute;
    const isACH = method.type === 'us_bank_account' || method.type === 'bank_account';
    
    // Map ACH fields from backend
    const achLast4 = method.last4 || (method as any).bank_account_last4 || '';
    const achAccountType = method.account_type || (method as any).bank_account_type || 'checking';
    const achHolderName = (method as any).account_holder_name || method.bank_name || '';
    
    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.paymentMethodCard,
          isSelectableMode && styles.paymentMethodCardSelectable
        ]}
        onPress={isSelectableMode ? () => handleSelectAndSubscribe(method.id) : undefined}
        activeOpacity={isSelectableMode ? 0.7 : 1}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isACH ? '#059669' : '#1E3A5F', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons 
                name={isACH ? 'business' : getCardBrandIcon(method.brand || '')} 
                size={22} 
                color="#FFF" 
              />
            </View>
            <View style={styles.cardDetails}>
              {isACH ? (
                <>
                  <Text style={styles.cardBrand}>{achHolderName || 'CUENTA BANCARIA'}</Text>
                  <Text style={styles.cardNumber}>•••• {achLast4}</Text>
                  <Text style={[styles.cardExpiry, { color: '#059669' }]}>
                    🏦 {achAccountType === 'checking' ? 'Cuenta Corriente' : achAccountType === 'savings' ? 'Cuenta de Ahorros' : 'Cuenta Bancaria'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardBrand}>{method.brand?.toUpperCase() || 'TARJETA'}</Text>
                  <Text style={styles.cardNumber}>•••• {method.last4}</Text>
                  <Text style={styles.cardExpiry}>
                    Expira: {method.exp_month?.toString().padStart(2, '0')}/{method.exp_year}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.cardBadges}>
            {method.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t('paymentMethods.default', 'Predeterminada')}</Text>
              </View>
            )}
            {isSelectableMode && (
              <Ionicons name="chevron-forward" size={24} color={colors.textGray} />
            )}
          </View>
        </View>

        {!isSelectableMode && (
          <View style={styles.cardActions}>
            {!method.is_default && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
//                   console.log('🎯 Set default button pressed for:', method.id);
                  handleSetDefault(method.id);
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.actionButtonText}>{t('paymentMethods.default', 'Predeterminada')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => {
//                 console.log('🎯 🎯 🎯 Delete button pressed for:', method.id);
                handleDeleteMethod(method.id);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={[styles.actionButtonText, { color: colors.error }]}>{t('paymentMethods.delete', 'Eliminar')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <CustomHeader 
          title="Métodos de Pago"
          showBackButton={true}
          backRoute="/(tabs)/profile"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CustomHeader 
        title="Métodos de Pago"
        showBackButton={true}
        backRoute="/(tabs)/profile"
        rightIcon="add-circle"
        onRightIconPress={() => setShowPaymentTypeModal(true)}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {paymentMethods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color={colors.textLight} />
            <Text style={styles.emptyText}>{t('paymentMethods.noMethods', 'No tienes métodos de pago')}</Text>
            <Text style={styles.emptySubtext}>
              Agrega una tarjeta o cuenta bancaria para realizar pagos
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowPaymentTypeModal(true)}
            >
              <Text style={styles.addButtonText}>Agregar Método de Pago</Text>
            </TouchableOpacity>
          </View>
        ) : (
          paymentMethods.map(method => renderPaymentMethodCard(method))
        )}
      </ScrollView>

      {/* Add Card Modal */}
      <Modal
        visible={showAddCard}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddCard(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Agregar Tarjeta</Text>
                <TouchableOpacity onPress={() => setShowAddCard(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.securityNotice}>
                <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                <Text style={styles.securityText}>
                  Tus datos están protegidos con encriptación de nivel bancario
                </Text>
              </View>

              <View style={styles.testModeNotice}>
                <Ionicons name="information-circle" size={20} color={colors.info} />
                <Text style={styles.testModeText}>
                  <Text style={{ fontWeight: '700' }}>Modo de Prueba:</Text> Usa cualquier número de tarjeta de prueba. En producción se usará Stripe SDK para mayor seguridad.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Número de Tarjeta</Text>
              <TextInput
                style={styles.input}
                value={cardNumber}
                onChangeText={handleCardNumberChange}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={19}
              />

              <Text style={styles.inputLabel}>Nombre del Titular</Text>
              <TextInput
                style={styles.input}
                value={cardName}
                onChangeText={setCardName}
                placeholder="JUAN PEREZ"
                placeholderTextColor={colors.textLight}
                autoCapitalize="characters"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Expiración (MM/AA)</Text>
                  <TextInput
                    style={styles.input}
                    value={expiryDate}
                    onChangeText={handleExpiryChange}
                    placeholder="12/25"
                    placeholderTextColor={colors.textLight}
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>

                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    value={cvv}
                    onChangeText={setCvv}
                    placeholder="123"
                    placeholderTextColor={colors.textLight}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Manual Payment Option - DESHABILITADO TEMPORALMENTE */}
              {/* <View style={styles.manualOptionContainer}>
                <TouchableOpacity 
                  style={styles.checkboxContainer}
                  onPress={() => setShowManualOption(!showManualOption)}
                >
                  <View style={[styles.checkbox, showManualOption && styles.checkboxChecked]}>
                    {showManualOption && <Ionicons name="checkmark" size={18} color={colors.textWhite} />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Guardar para procesamiento manual de pagos
                  </Text>
                </TouchableOpacity>
                
                {showManualOption && (
                  <View style={styles.manualInfo}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                    <Text style={styles.manualInfoText}>
                      Esta opción guarda tu tarjeta de forma encriptada (AES-256) para que nuestro equipo pueda procesar pagos manualmente con tu banco.
                    </Text>
                  </View>
                )}
              </View> */}

              <TouchableOpacity
                style={[styles.saveButton, processing && styles.saveButtonDisabled]}
                onPress={handleAddCard}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    Agregar Tarjeta
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Al agregar tu tarjeta, aceptas que se guarde de forma segura para futuros pagos.
              </Text>
            </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Payment Type Selection Modal */}
      <Modal
        visible={showPaymentTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.typeSelectionContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('payments.selectMethod', 'Selecciona Método de Pago')}</Text>
              <TouchableOpacity onPress={() => setShowPaymentTypeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.typeOptionsContainer} showsVerticalScrollIndicator={false}>
              {/* Credit/Debit Card Option */}
              <TouchableOpacity
                style={styles.typeOption}
                onPress={() => {
                  setShowPaymentTypeModal(false);
                  setShowAddCard(true);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.typeIconContainer, { backgroundColor: '#1E3A5F' }]}>  
                    <Ionicons name="card" size={26} color="#FFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.typeOptionTitle}>{t('payments.creditDebit', 'Tarjeta de Crédito/Débito')}</Text>
                    <Text style={styles.typeOptionDescription}>{t('payments.creditDebitDesc', 'Pagos instantáneos • Visa, Mastercard, Amex')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textGray} />
                </View>
              </TouchableOpacity>

              {/* ACH Bank Account Option */}
              <TouchableOpacity
                style={styles.typeOption}
                onPress={() => {
                  setShowPaymentTypeModal(false);
                  setShowAddACH(true);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.typeIconContainer, { backgroundColor: '#059669' }]}>
                    <Ionicons name="business" size={26} color="#FFF" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.typeOptionTitle}>{t('payments.bankAccount', 'Cuenta Bancaria (ACH)')}</Text>
                    <Text style={styles.typeOptionDescription}>{t('payments.bankAccountDesc', 'Débito directo • Tarifas más bajas (0.8%)')}</Text>
                  </View>
                  <View style={{ backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>{t('payments.saves', 'AHORRA')}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Alternative Payment Methods Section */}
              <View style={styles.altPaymentSection}>
                <Text style={styles.altPaymentTitle}>{t('payments.altMethods', 'Métodos de Pago Alternativos')}</Text>
                <Text style={styles.altPaymentSubtitle}>{t('payments.altMethodsDesc', 'Envía pagos directamente desde tu app favorita')}</Text>
              </View>

              {/* Zelle */}
              <TouchableOpacity
                style={[styles.typeOption, styles.altPaymentOption]}
                onPress={() => {
                  setShowPaymentTypeModal(false);
                  Alert.alert(
                    '💵 Zelle',
                    `Envía tu pago a:\n\n${altPaymentSettings.zelle_email}\n\nIncluye tu nombre completo en el memo para identificar el pago.\n\nUna vez enviado, tu pago será confirmado en 1-2 horas.`,
                    [
                      { text: 'Copiar Email', onPress: () => {
                        if (Platform.OS !== 'web') {
                          Alert.alert(t('paymentMethods.emailCopied', 'Email copiado'), altPaymentSettings.zelle_email);
                        }
                      }},
                      { text: 'Entendido', style: 'default' }
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.typeIconContainer, { backgroundColor: '#6D1ED4' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFF' }}>Z</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.typeOptionTitle}>{t('payments.zelle', 'Zelle')}</Text>
                    <Text style={styles.typeOptionDescription}>{t('payments.zelleDesc', 'Transferencia bancaria instantánea • Sin cargos')}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textGray} />
                </View>
              </TouchableOpacity>

              {/* Venmo */}
              <TouchableOpacity
                style={[styles.typeOption, styles.altPaymentOption]}
                onPress={() => {
                  setShowPaymentTypeModal(false);
                  Alert.alert(
                    '💙 Venmo',
                    `Envía tu pago a:\n\n${altPaymentSettings.venmo_username}\n\nIncluye "Tax Services + Tu Nombre" en la nota.\n\nAsegúrate de que el pago sea privado.`,
                    [
                      { text: 'Abrir Venmo', onPress: () => Linking.openURL('venmo://') },
                      { text: 'Entendido', style: 'default' }
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.typeIconContainer, { backgroundColor: '#008CFF' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFF' }}>V</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.typeOptionTitle}>{t('payments.venmo', 'Venmo')}</Text>
                    <Text style={styles.typeOptionDescription}>{t('payments.venmoDesc', 'Pago rápido desde tu app Venmo')}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textGray} />
                </View>
              </TouchableOpacity>

              {/* Cash App */}
              <TouchableOpacity
                style={[styles.typeOption, styles.altPaymentOption]}
                onPress={() => {
                  setShowPaymentTypeModal(false);
                  Alert.alert(
                    '💚 Cash App',
                    `Envía tu pago a:\n\n${altPaymentSettings.cashapp_username}\n\nIncluye tu nombre completo en la nota.\n\nTu pago será confirmado en minutos.`,
                    [
                      { text: 'Abrir Cash App', onPress: () => Linking.openURL('cashapp://') },
                      { text: 'Entendido', style: 'default' }
                    ]
                  );
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.typeIconContainer, { backgroundColor: '#00D632' }]}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFF' }}>$</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.typeOptionTitle}>{t('payments.cashApp', 'Cash App')}</Text>
                    <Text style={styles.typeOptionDescription}>{t('payments.cashAppDesc', 'Envía dinero instantáneamente')}</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textGray} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.typeOption, styles.altPaymentOption]}
                onPress={() => {
                  setShowPaymentTypeModal(false);
                  const paypalUrl = altPaymentSettings.paypal_link.startsWith('http') 
                    ? altPaymentSettings.paypal_link 
                    : `https://${altPaymentSettings.paypal_link}`;
                  Alert.alert(
                    '💼 PayPal',
                    `Envía tu pago a:\n\n${altPaymentSettings.paypal_link}\n\nO al email: ${altPaymentSettings.zelle_email}\n\nSelecciona "Enviar a amigos y familiares" para evitar cargos.`,
                    [
                      { text: 'Abrir PayPal', onPress: () => Linking.openURL(paypalUrl) },
                      { text: 'Entendido', style: 'default' }
                    ]
                  );
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.typeIconContainer, { backgroundColor: '#003087' }]}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFF' }}>PP</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.typeOptionTitle}>PayPal</Text>
                    <Text style={styles.typeOptionDescription}>Paga con tu cuenta PayPal</Text>
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textGray} />
                </View>
              </TouchableOpacity>

              <View style={styles.altPaymentNote}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textGray} />
                <Text style={styles.altPaymentNoteText}>
                  Los pagos alternativos requieren confirmación manual y pueden tardar hasta 24 horas en reflejarse.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Consent Modal for Manual Payment */}
      <Modal
        visible={showConsentModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConsentModal(false)}
      >
        <View style={styles.consentOverlay}>
          <View style={styles.consentContent}>
            <View style={styles.consentHeader}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
              <Text style={styles.consentTitle}>Consentimiento de Almacenamiento</Text>
            </View>

            <ScrollView style={styles.consentBody}>
              <Text style={styles.consentText}>
                Acepto que <Text style={styles.boldText}>Ross Tax Preparation</Text> almacene mi información de pago de forma encriptada (AES-256) para procesamiento manual de pagos.
              </Text>

              <Text style={styles.consentSubtitle}>Entiendo que:</Text>

              <View style={styles.consentList}>
                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.consentItemText}>
                    Los datos se almacenan encriptados con cifrado AES-256
                  </Text>
                </View>

                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.consentItemText}>
                    Solo se usan para procesamiento manual con mi banco o procesador de pagos directo
                  </Text>
                </View>

                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.consentItemText}>
                    Los administradores autorizados pueden acceder a los datos completos bajo demanda
                  </Text>
                </View>

                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.consentItemText}>
                    Todos los accesos quedan registrados en un log de auditoría
                  </Text>
                </View>

                <View style={styles.consentItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.consentItemText}>
                    Puedo eliminar esta información en cualquier momento
                  </Text>
                </View>
              </View>

              <View style={styles.consentCheckbox}>
                <TouchableOpacity 
                  style={styles.checkboxContainer}
                  onPress={() => setUserConsent(!userConsent)}
                >
                  <View style={[styles.checkbox, userConsent && styles.checkboxChecked]}>
                    {userConsent && <Ionicons name="checkmark" size={18} color={colors.textWhite} />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Acepto los términos de almacenamiento
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.consentActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowConsentModal(false);
                  setUserConsent(false);
                }}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancelar')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.acceptButton, !userConsent && styles.acceptButtonDisabled]}
                onPress={handleAddManualMethod}
                disabled={!userConsent || processing}
              >
                {processing ? (
                  <ActivityIndicator color={colors.textWhite} size="small" />
                ) : (
                  <Text style={styles.acceptButtonText}>Aceptar y Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add ACH Bank Account Modal */}
      <Modal
        visible={showAddACH}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddACH(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Cuenta Bancaria</Text>
              <TouchableOpacity onPress={() => setShowAddACH(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.securityNotice}>
                <Ionicons name="shield-checkmark" size={24} color={colors.success} />
                <Text style={styles.securityText}>
                  Verificación segura mediante Plaid - Tarifas más bajas (0.8%)
                </Text>
              </View>

              <View style={styles.achInfoNotice}>
                <Ionicons name="information-circle" size={20} color={colors.info} />
                <Text style={styles.achInfoText}>
                  Los pagos ACH tardan 5-7 días hábiles pero tienen tarifas significativamente más bajas que las tarjetas de crédito.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Nombre del Titular</Text>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder={t('paymentMethods.achAccountHolder', 'Tu nombre completo')}
                placeholderTextColor={colors.textLight}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>Número de Routing (9 dígitos)</Text>
              <TextInput
                style={styles.input}
                value={routingNumber}
                onChangeText={(text) => setRoutingNumber(text.replace(/[^0-9]/g, ''))}
                placeholder="123456789"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={9}
              />

              <Text style={styles.inputLabel}>Número de Cuenta</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={(text) => setAccountNumber(text.replace(/[^0-9]/g, ''))}
                placeholder="123456789012"
                placeholderTextColor={colors.textLight}
                keyboardType="number-pad"
                maxLength={17}
              />

              <Text style={styles.inputLabel}>Tipo de Cuenta</Text>
              <View style={styles.accountTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.accountTypeButton,
                    accountType === 'checking' && styles.accountTypeButtonActive
                  ]}
                  onPress={() => setAccountType('checking')}
                >
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color={accountType === 'checking' ? (colors.textWhite || '#FFFFFF') : colors.textLight} 
                  />
                  <Text style={[
                    styles.accountTypeText,
                    accountType === 'checking' && styles.accountTypeTextActive
                  ]}>
                    Cuenta Corriente
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.accountTypeButton,
                    accountType === 'savings' && styles.accountTypeButtonActive
                  ]}
                  onPress={() => setAccountType('savings')}
                >
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color={accountType === 'savings' ? (colors.textWhite || '#FFFFFF') : colors.textLight} 
                  />
                  <Text style={[
                    styles.accountTypeText,
                    accountType === 'savings' && styles.accountTypeTextActive
                  ]}>
                    Cuenta de Ahorros
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Términos NACHA */}
              <View style={styles.achTermsContainer}>
                <TouchableOpacity 
                  style={styles.achCheckboxContainer}
                  onPress={() => setAchTermsAccepted(!achTermsAccepted)}
                >
                  <View style={[styles.checkbox, achTermsAccepted && styles.checkboxChecked]}>
                    {achTermsAccepted && <Ionicons name="checkmark" size={18} color={colors.textWhite} />}
                  </View>
                  <Text style={styles.achTermsLabel}>
                    Acepto los términos de autorización ACH/NACHA y autorizo débitos desde mi cuenta bancaria
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, processing && styles.saveButtonDisabled]}
                onPress={handleAddACH}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    Verificar y Agregar Cuenta
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Al agregar tu cuenta bancaria, aceptas la autorización ACH según estándares NACHA. Se generará un PDF de evidencia legal que será almacenado de forma segura.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
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
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 24,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textWhite,
  },
  paymentMethodCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentMethodCardSelectable: {
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  cardBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardDetails: {
    gap: 4,
  },
  cardBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textGray,
  },
  cardNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardExpiry: {
    fontSize: 12,
    color: colors.textGray,
  },
  defaultBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
    backgroundColor: colors.primary + '10',
    borderRadius: 6,
  },
  deleteButton: {
    backgroundColor: colors.error + '10',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 10,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  testModeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '10',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
  },
  testModeText: {
    flex: 1,
    fontSize: 12,
    color: colors.info,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.backgroundGray || '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text || '#000000',
    borderWidth: 1,
    borderColor: colors.border || '#E0E0E0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textWhite,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  manualOptionContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  manualInfo: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.info + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.info + '30',
  },
  manualInfoText: {
    flex: 1,
    fontSize: 12,
    color: colors.info,
    lineHeight: 18,
  },
  // Consent Modal Styles
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  consentContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  consentHeader: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  consentBody: {
    padding: 24,
  },
  consentText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
    color: colors.primary,
  },
  consentSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    marginBottom: 12,
  },
  consentList: {
    gap: 14,
    marginBottom: 24,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  consentItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textGray,
    lineHeight: 20,
  },
  consentCheckbox: {
    backgroundColor: colors.backgroundGray,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  consentActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textWhite,
  },
  // Payment Type Selection Modal Styles
  typeSelectionContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '75%',
    marginTop: 'auto',
  },
  typeOptionsContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  typeOption: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  typeOptionDescription: {
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 16,
  },
  // Alternative Payment Methods Styles
  altPaymentSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  altPaymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  altPaymentSubtitle: {
    fontSize: 13,
    color: colors.textGray,
    textAlign: 'center',
  },
  altPaymentOption: {
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  altPaymentNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.backgroundGray,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  altPaymentNoteText: {
    flex: 1,
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 16,
  },
  // ACH Modal Styles
  achInfoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.backgroundGray,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.info,
  },
  achInfoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  accountTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  accountTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  accountTypeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  accountTypeTextActive: {
    color: colors.textWhite || '#FFFFFF',
  },
  // ACH Términos y Firma
  achHintText: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 4,
    marginBottom: 12,
  },
  achTermsContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  achCheckboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  achTermsLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  // Signature Styles
  signaturePreviewContainer: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 12,
  },
  signaturePreview: {
    width: '100%',
    height: 120,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  changeSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
  },
  changeSignatureText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  signatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 12,
    flex: 1,
  },
  signatureInput: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
});