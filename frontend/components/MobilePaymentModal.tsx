import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface MobilePaymentModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
  stripePublishableKey: string;
}

export const MobilePaymentModal: React.FC<MobilePaymentModalProps> = ({
  visible,
  amount,
  onClose,
  onSuccess,
  stripePublishableKey,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  
  // Get custom payment form URL from env (for when you have SSL)
  const customFormUrl = Constants.expoConfig?.extra?.stripeFormUrl || 
                        process.env.EXPO_PUBLIC_STRIPE_FORM_URL;
  
  const useCustomForm = !!customFormUrl && customFormUrl.startsWith('https://');

  React.useEffect(() => {
    if (visible && amount > 0) {
      if (useCustomForm) {
        console.log('🎨 Using custom payment form with SSL:', customFormUrl);
        createPaymentIntent();
      } else {
        console.log('💳 Using Stripe Checkout (no custom form URL configured)');
        createCheckoutSession();
      }
    }
  }, [visible, amount]);

  const createPaymentIntent = async () => {
    setLoading(true);
    setError('');
    console.log('🔄 Creating payment intent for custom form...');

    try {
      const response = await api.post('/credits/create-payment-intent', {
        package_id: 'custom',
        custom_amount: amount,
      });

      console.log('✅ Payment intent created:', response.data);
      
      if (response.data.client_secret) {
        setClientSecret(response.data.client_secret);
        setLoading(false);
      } else {
        throw new Error('No client_secret received');
      }
    } catch (error: any) {
      console.error('❌ Error creating payment intent:', error);
      setError(error.response?.data?.detail || 'Error al crear intención de pago');
      setLoading(false);
      Alert.alert('Error', 'No se pudo iniciar el pago. Por favor intenta de nuevo.');
    }
  };

  const createCheckoutSession = async () => {
    setLoading(true);
    setError('');
    console.log('🔄 Creating checkout session for mobile...');

    try {
      const response = await api.post('/credits/create-checkout-session', {
        package_id: 'custom',
        custom_amount: amount,
      });

      console.log('✅ Checkout session created:', response.data);
      
      if (response.data.checkout_url) {
        setCheckoutUrl(response.data.checkout_url);
        setLoading(false);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('❌ Error creating checkout:', error);
      setError(error.response?.data?.detail || 'Error al crear sesión de pago');
      setLoading(false);
      Alert.alert('Error', 'No se pudo crear la sesión de pago. Por favor intenta de nuevo.');
    }
  };

  const handleNavigationStateChange = async (navState: any) => {
    console.log('🌐 Navigation changed:', navState.url);

    // Check if user completed payment (redirected to success URL)
    if (navState.url.includes('/success') || navState.url.includes('payment_intent')) {
      console.log('✅ Payment successful! Closing modal...');
      
      // Wait a bit for the payment to be processed
      setTimeout(() => {
        Alert.alert(
          '¡Pago Exitoso!',
          `Se han agregado ${amount} créditos a tu cuenta`,
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
      }, 1000);
    }

    // Check if user canceled payment
    if (navState.url.includes('/cancel') || navState.url.includes('canceled')) {
      console.log('❌ Payment canceled by user');
      Alert.alert('Pago Cancelado', 'El pago fue cancelado');
      onClose();
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📨 WebView message:', data);

      if (data.type === 'PAYMENT_SUCCESS') {
        console.log('✅ Payment successful!');
        Alert.alert(
          '¡Pago Exitoso!',
          `Se han agregado ${amount} créditos a tu cuenta`,
          [
            {
              text: 'OK',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
      } else if (data.type === 'PAYMENT_ERROR') {
        console.error('❌ Payment error:', data.error);
        Alert.alert('Error de Pago', data.error || 'No se pudo procesar el pago');
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  if (!visible) {
    return null;
  }

  // Build URL for custom form with parameters
  const customFormFullUrl = customFormUrl && clientSecret
    ? `${customFormUrl}?amount=${amount}&stripeKey=${stripePublishableKey}&clientSecret=${clientSecret}`
    : null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {useCustomForm ? 'Agregar Créditos' : 'Pago Seguro'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {useCustomForm ? 'Preparando formulario de pago...' : 'Preparando pago seguro...'}
            </Text>
            <Text style={styles.amountText}>${amount.toFixed(2)} USD</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={() => useCustomForm ? createPaymentIntent() : createCheckoutSession()}
            >
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView with Custom Form (if SSL URL configured) */}
        {customFormFullUrl && !loading && !error && (
          <WebView
            source={{ uri: customFormFullUrl }}
            onMessage={handleWebViewMessage}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        )}

        {/* WebView with Stripe Checkout (fallback) */}
        {checkoutUrl && !loading && !error && !useCustomForm && (
          <WebView
            source={{ uri: checkoutUrl }}
            onNavigationStateChange={handleNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
          />
        )}

        {/* Security Footer */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
          <Text style={styles.footerText}>
            {useCustomForm ? 'Formulario personalizado seguro' : 'Pago seguro procesado por Stripe'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: colors.textGray,
    textAlign: 'center',
  },
  amountText: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    marginTop: 20,
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.accent + '10',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
});
