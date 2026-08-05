import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

// Only import Stripe on native platforms
let useStripe: any = () => ({ createPaymentMethod: null });
let CardField: any = View;

if (Platform.OS !== 'web') {
  const StripeModule = require('@stripe/stripe-react-native');
  useStripe = StripeModule.useStripe;
  CardField = StripeModule.CardField;
}

interface CreditPackage {
  id: string;
  name: string;
  description: string;
  amount_usd: number;
  base_credits: number;
  bonus_percentage: number;
  bonus_credits: number;
  total_credits: number;
  is_featured: boolean;
}

interface PurchaseModalProps {
  visible: boolean;
  package: CreditPackage | null;
  isFirstPurchase: boolean;
  firstPurchaseBonus: number;
  stripePublishableKey: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreditPurchaseModal({
  visible,
  package: pkg,
  isFirstPurchase,
  firstPurchaseBonus,
  stripePublishableKey,
  onClose,
  onSuccess,
}: PurchaseModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { createPaymentMethod } = useStripe();
  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  if (!pkg) return null;

  const extraBonus = isFirstPurchase ? pkg.total_credits * (firstPurchaseBonus / 100) : 0;
  const totalCredits = pkg.total_credits + extraBonus;

  const handlePurchase = async () => {
    console.log('🚀 handlePurchase CALLED');
    console.log('📦 Package:', pkg);
    console.log('🌍 Platform:', Platform.OS);
    console.log('🔑 Stripe Key Available:', !!stripePublishableKey);
    
    if (!pkg) {
      console.log('❌ No package selected');
      Alert.alert('Error', 'No se ha seleccionado un paquete');
      return;
    }

    if (Platform.OS === 'web') {
      try {
        console.log('🌐 Creating checkout session for package:', pkg.id);
        setLoading(true);
        
        // Create checkout session
        const requestBody: any = {
          package_id: pkg.id,
        };
        
        // Include custom_amount if it's a custom package
        if (pkg.id === 'custom') {
          requestBody.custom_amount = pkg.amount_usd;
          console.log('💰 Custom amount:', pkg.amount_usd);
        }
        
        console.log('📤 Request body:', requestBody);
        
        const response = await api.post('/credits/create-checkout-session', requestBody);
        
        console.log('✅ Checkout response:', response.data);
        
        if (response.data.checkout_url) {
          console.log('🚀 Redirecting to:', response.data.checkout_url);
          // Redirect to Stripe Checkout at TOP LEVEL (not in iframe)
          if (typeof window !== 'undefined') {
            // Use window.top to break out of any iframe
            if (window.top) {
              window.top.location.href = response.data.checkout_url;
            } else {
              window.location.href = response.data.checkout_url;
            }
          }
        } else {
          console.error('❌ No checkout_url in response');
          Alert.alert('Error', 'No se pudo crear la sesión de pago');
          setLoading(false);
        }
      } catch (error: any) {
        console.error('❌ Checkout error:', error);
        const errorMessage = error.response?.data?.detail || error.message || 'Error al crear sesión de pago';
        Alert.alert('Error', errorMessage);
        setLoading(false);
      }
      return;
    }
    
    // For mobile (iOS/Android), also use Stripe Checkout via browser
    try {
      console.log('📱 Creating checkout session for package (mobile):', pkg.id);
      setLoading(true);
      
      const requestBody: any = {
        package_id: pkg.id,
      };
      
      // Include custom_amount if it's a custom package
      if (pkg.id === 'custom') {
        requestBody.custom_amount = pkg.amount_usd;
      }
      
      const response = await api.post('/credits/create-checkout-session', requestBody);
      
      console.log('✅ Checkout response:', response.data);
      
      if (response.data.checkout_url) {
        console.log('🚀 Opening URL:', response.data.checkout_url);
        
        try {
          const supported = await Linking.canOpenURL(response.data.checkout_url);
          console.log('🔍 Can open URL:', supported);
          
          if (supported) {
            console.log('📤 Calling Linking.openURL...');
            await Linking.openURL(response.data.checkout_url);
            console.log('✅ URL opened successfully');
            
            // Close modal after a short delay
            setTimeout(() => {
              setLoading(false);
              onClose();
            }, 1000);
          } else {
            console.error('❌ URL not supported');
            Alert.alert('Error', 'No se puede abrir el navegador');
            setLoading(false);
          }
        } catch (linkError: any) {
          console.error('❌ Linking error:', linkError);
          Alert.alert('Error', 'No se pudo abrir el navegador: ' + linkError.message);
          setLoading(false);
        }
      } else {
        console.error('❌ No checkout_url in response');
        Alert.alert('Error', 'No se pudo crear la sesión de pago');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('❌ Checkout error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error al crear sesión de pago';
      Alert.alert('Error', errorMessage);
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comprar Créditos</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Package Info */}
            <View style={styles.packageInfo}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              <Text style={styles.packagePrice}>${pkg.amount_usd} USD</Text>
            </View>

            {/* Credits Breakdown */}
            <View style={styles.creditsBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Créditos base:</Text>
                <Text style={styles.breakdownValue}>{pkg.base_credits}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Bonus del paquete ({pkg.bonus_percentage}%):</Text>
                <Text style={styles.breakdownValueBonus}>+{pkg.bonus_credits}</Text>
              </View>
              {isFirstPurchase && extraBonus > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, styles.specialLabel]}>
                    🎁 Bonus 1ª compra ({firstPurchaseBonus}%):
                  </Text>
                  <Text style={styles.breakdownValueSpecial}>+{extraBonus.toFixed(0)}</Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelTotal}>Total créditos:</Text>
                <Text style={styles.breakdownValueTotal}>{totalCredits.toFixed(0)}</Text>
              </View>
            </View>

            {/* Payment Section */}
            {Platform.OS === 'web' ? (
              <View style={styles.webInfo}>
                <Ionicons name="card-outline" size={48} color={colors.primary} />
                <Text style={styles.webInfoTitle}>
                  Pago Seguro con Stripe
                </Text>
                <Text style={styles.webInfoText}>
                  Al hacer clic en "Continuar al Pago", serás redirigido a la página segura de Stripe para completar tu compra.
                  {'\n\n'}
                  Aceptamos todas las tarjetas de crédito y débito principales.
                </Text>
              </View>
            ) : (
              <View style={styles.paymentSection}>
                <Text style={styles.sectionTitle}>Información de Pago</Text>
                <Text style={styles.sectionSubtitle}>
                  Ingresa los datos de tu tarjeta
                </Text>

                <View style={styles.cardFieldContainer}>
                  <CardField
                    postalCodeEnabled={false}
                    placeholder={{
                      number: '4242 4242 4242 4242',
                    }}
                    cardStyle={styles.cardStyle}
                    style={styles.cardField}
                    onCardChange={(cardDetails) => {
                      setCardComplete(cardDetails.complete);
                    }}
                  />
                </View>

                {/* Security Info */}
                <View style={styles.securityInfo}>
                  <Ionicons name="lock-closed" size={16} color={colors.success} />
                  <Text style={styles.securityText}>
                    Pago seguro procesado por Stripe
                  </Text>
                </View>
              </View>
            )}

            {/* Terms */}
            <Text style={styles.termsText}>
              Al completar esta compra, aceptas nuestros términos y condiciones.
              Los créditos no expiran y pueden usarse en todos los servicios de Ross Tax.
            </Text>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.purchaseButton,
                (Platform.OS !== 'web' && !cardComplete) && styles.purchaseButtonDisabled,
                loading && styles.purchaseButtonDisabled,
              ]}
              onPress={handlePurchase}
              disabled={(Platform.OS !== 'web' && !cardComplete) || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="card" size={20} color="#FFF" />
                  <Text style={styles.purchaseButtonText}>
                    {Platform.OS === 'web' ? 'Continuar al Pago' : `Pagar $${pkg.amount_usd}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  packageInfo: {
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  creditsBreakdown: {
    backgroundColor: colors.backgroundGray,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  specialLabel: {
    fontWeight: '600',
    color: colors.primary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  breakdownValueBonus: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  breakdownValueSpecial: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  breakdownLabelTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  breakdownValueTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentSection: {
    marginBottom: 20,
  },
  webInfo: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.success + '10',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  webInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  webInfoText: {
    fontSize: 14,
    color: colors.textGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 16,
  },
  cardFieldContainer: {
    height: 50,
    marginBottom: 12,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  cardStyle: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    textColor: colors.text,
    placeholderColor: colors.textGray,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  securityText: {
    fontSize: 12,
    color: colors.textGray,
  },
  termsText: {
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  purchaseButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  purchaseButtonDisabled: {
    opacity: 0.5,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
