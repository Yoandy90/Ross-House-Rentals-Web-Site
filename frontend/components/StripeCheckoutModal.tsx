import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';

interface StripeCheckoutModalProps {
  visible: boolean;
  checkoutUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  visible,
  checkoutUrl,
  onClose,
  onSuccess,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = React.useState(true);
  const iframeRef = React.useRef<any>(null);

  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      // Listen for messages from Stripe iframe
      const handleMessage = (event: MessageEvent) => {
        // Check if message is from Stripe
        if (event.origin.includes('stripe.com') || event.origin.includes('checkout.stripe.com')) {
          console.log('📨 Message from Stripe:', event.data);
          
          // Handle different Stripe events
          if (event.data === 'stripe-checkout-success' || 
              event.data?.type === 'success' ||
              (typeof event.data === 'string' && event.data.includes('success'))) {
            console.log('✅ Payment successful!');
            onSuccess();
            onClose();
          }
        }
      };

      window.addEventListener('message', handleMessage);
      
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [visible, onSuccess, onClose]);

  const handleIframeLoad = () => {
    console.log('✅ Stripe iframe loaded');
    setLoading(false);
  };

  if (Platform.OS !== 'web') {
    return null; // Only works on web
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Proceso de Pago</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando pago seguro...</Text>
            </View>
          )}

          {/* Stripe iframe */}
          <View style={styles.iframeContainer}>
            {Platform.OS === 'web' && (
              <iframe
                ref={iframeRef}
                src={checkoutUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: '12px',
                }}
                onLoad={handleIframeLoad}
                title="Stripe Checkout"
                allow="payment"
              />
            )}
          </View>

          {/* Footer info */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
            <Text style={styles.footerText}>
              Pago seguro procesado por Stripe
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: Math.min(width - 40, 800),
    height: Math.min(height - 100, 700),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 20,
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
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textGray,
  },
  iframeContainer: {
    flex: 1,
    backgroundColor: colors.backgroundGray,
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
