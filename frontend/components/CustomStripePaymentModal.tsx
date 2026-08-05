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
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface CustomStripePaymentModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
  stripePublishableKey: string;
}

export const CustomStripePaymentModal: React.FC<CustomStripePaymentModalProps> = ({
  visible,
  amount,
  onClose,
  onSuccess,
  stripePublishableKey,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible && amount > 0) {
      createPaymentIntent();
    }
  }, [visible, amount]);

  const createPaymentIntent = async () => {
    setLoading(true);
    setError('');
    console.log('🔄 Creating payment intent...');

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

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    body {
      background: #F9FAFB;
      padding: 20px;
    }
    
    .container {
      max-width: 500px;
      margin: 0 auto;
    }
    
    .amount-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      border-radius: 16px;
      text-align: center;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    
    .amount-label {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 8px;
      font-weight: 600;
    }
    
    .amount-value {
      font-size: 48px;
      color: white;
      font-weight: 800;
      margin-bottom: 4px;
    }
    
    .amount-subtext {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
    }
    
    .card-container {
      background: white;
      padding: 24px;
      border-radius: 16px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .field-label {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      display: block;
    }
    
    #card-element {
      padding: 14px;
      border: 2px solid #E5E7EB;
      border-radius: 12px;
      background: white;
      transition: border-color 0.2s;
      min-height: 50px;
    }
    
    #card-element.StripeElement--focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    #card-element.StripeElement--invalid {
      border-color: #EF4444;
    }
    
    #card-errors {
      color: #EF4444;
      font-size: 13px;
      margin-top: 8px;
      min-height: 20px;
    }
    
    .debug-info {
      background: #FEF3C7;
      color: #92400E;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 12px;
      display: none;
    }
    
    .security-info {
      display: flex;
      align-items: center;
      background: #DBEAFE;
      padding: 12px;
      border-radius: 12px;
      margin-bottom: 20px;
      gap: 8px;
    }
    
    .security-text {
      font-size: 12px;
      color: #1E40AF;
      font-weight: 500;
    }
    
    .pay-button {
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 18px;
      border-radius: 14px;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: transform 0.2s, opacity 0.2s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .pay-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
    }
    
    .pay-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    
    .spinner {
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .powered-by {
      text-align: center;
      margin-top: 16px;
      font-size: 12px;
      color: #9CA3AF;
    }
    
    .stripe-logo {
      color: #635BFF;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Debug info -->
    <div id="debug-info" class="debug-info"></div>
    
    <!-- Amount Display -->
    <div class="amount-card">
      <div class="amount-label">Total a pagar</div>
      <div class="amount-value">$${amount.toFixed(2)}</div>
      <div class="amount-subtext">${amount} créditos</div>
    </div>
    
    <!-- Card Form -->
    <div class="card-container">
      <label class="field-label">Información de Tarjeta</label>
      <div id="card-element"></div>
      <div id="card-errors"></div>
    </div>
    
    <!-- Security Info -->
    <div class="security-info">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="#1E40AF">
        <path d="M10 2L3 6v5c0 4.42 3.17 8.13 7 9 3.83-.87 7-4.58 7-9V6l-7-4z"/>
        <path d="M9 12l-2-2 1-1 1 1 3-3 1 1-4 4z" fill="white"/>
      </svg>
      <span class="security-text">Tu información está protegida con encriptación de nivel bancario</span>
    </div>
    
    <!-- Pay Button -->
    <button id="pay-button" class="pay-button">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
        <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v5H9V7zm0 6h2v2H9v-2z"/>
      </svg>
      <span>Pagar $${amount.toFixed(2)}</span>
    </button>
    
    <!-- Powered by Stripe -->
    <div class="powered-by">
      Powered by <span class="stripe-logo">Stripe</span>
    </div>
  </div>

  <script>
    const debugInfo = document.getElementById('debug-info');
    
    function showDebug(message) {
      console.log('🔍 DEBUG:', message);
      debugInfo.style.display = 'block';
      debugInfo.textContent = message;
    }
    
    try {
      // Check if Stripe is loaded
      if (typeof Stripe === 'undefined') {
        showDebug('❌ Error: Stripe.js no se cargó correctamente');
        throw new Error('Stripe.js not loaded');
      }
      
      const stripeKey = '${stripePublishableKey}';
      if (!stripeKey || stripeKey === '') {
        showDebug('❌ Error: No hay Stripe publishable key');
        throw new Error('No Stripe key provided');
      }
      
      showDebug('✅ Inicializando Stripe...');
      
      const stripe = Stripe(stripeKey);
      const elements = stripe.elements();
      
      const style = {
        base: {
          color: '#374151',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '16px',
          '::placeholder': {
            color: '#9CA3AF',
          },
        },
        invalid: {
          color: '#EF4444',
          iconColor: '#EF4444',
        },
      };
      
      const cardElement = elements.create('card', { 
        style,
        hidePostalCode: false,
      });
      
      cardElement.mount('#card-element');
      showDebug('✅ Stripe Elements montado correctamente');
      
      // Hide debug after 2 seconds if successful
      setTimeout(() => {
        debugInfo.style.display = 'none';
      }, 2000);
      
      const cardErrors = document.getElementById('card-errors');
      cardElement.on('change', (event) => {
        if (event.error) {
          cardErrors.textContent = event.error.message;
        } else {
          cardErrors.textContent = '';
        }
      });
      
      const payButton = document.getElementById('pay-button');
      payButton.addEventListener('click', async () => {
        payButton.disabled = true;
        payButton.innerHTML = '<div class="spinner"></div><span>Procesando...</span>';
        
        try {
          const result = await stripe.confirmCardPayment('${clientSecret}', {
            payment_method: {
              card: cardElement,
            },
          });
          
          if (result.error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_ERROR',
              error: result.error.message,
            }));
            payButton.disabled = false;
            payButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="white"><path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v5H9V7zm0 6h2v2H9v-2z"/></svg><span>Pagar $${amount.toFixed(2)}</span>';
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYMENT_SUCCESS',
              paymentIntent: result.paymentIntent,
            }));
          }
        } catch (error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_ERROR',
            error: error.message || 'Error al procesar el pago',
          }));
          payButton.disabled = false;
          payButton.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="white"><path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm-1-9h2v5H9V7zm0 6h2v2H9v-2z"/></svg><span>Pagar $${amount.toFixed(2)}</span>';
        }
      });
    } catch (error) {
      showDebug('❌ Error: ' + error.message);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PAYMENT_ERROR',
        error: 'Error al inicializar el formulario de pago: ' + error.message,
      }));
    }
  </script>
</body>
</html>
  `;

  if (!visible) {
    return null;
  }

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
          <Text style={styles.headerTitle}>Agregar Créditos</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Preparando formulario de pago...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={64} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={createPaymentIntent}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* WebView with Custom Stripe Form */}
        {clientSecret && !loading && !error && (
          <WebView
            source={{ html: htmlContent }}
            onMessage={handleWebViewMessage}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        )}
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
});
