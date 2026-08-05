import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  features: string[];
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface SubscriptionConfirmModalProps {
  visible: boolean;
  plan: Plan | null;
  paymentMethod: PaymentMethod | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onChangePaymentMethod: () => void;
  onAddPaymentMethod: () => void;
}

export default function SubscriptionConfirmModal({
  visible,
  plan,
  paymentMethod,
  loading,
  onClose,
  onConfirm,
  onChangePaymentMethod,
  onAddPaymentMethod,
}: SubscriptionConfirmModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  if (!plan) return null;

  const getIntervalText = (interval: string) => {
    const map: Record<string, string> = {
      weekly: 'Semanal',
      biweekly: 'Quincenal',
      monthly: 'Mensual',
      yearly: 'Anual'
    };
    return map[interval] || interval;
  };

  const getIntervalColor = (interval: string) => {
    const colorMap: Record<string, string> = {
      weekly: '#4CAF50',
      biweekly: '#2196F3',
      monthly: '#9C27B0',
      yearly: '#FF9800'
    };
    return colorMap[interval] || colors.primary;
  };

  const intervalColor = getIntervalColor(plan.interval);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Confirmar Suscripción</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Plan Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalles del Plan</Text>
              <View style={[styles.planCard, { borderColor: intervalColor + '30' }]}>
                <View style={[styles.planHeader, { backgroundColor: intervalColor + '15' }]}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <View style={[styles.intervalBadge, { backgroundColor: intervalColor }]}>
                    <Text style={styles.intervalText}>{getIntervalText(plan.interval)}</Text>
                  </View>
                </View>
                
                <View style={styles.planBody}>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                  
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAmount}>${plan.price}</Text>
                    <Text style={styles.priceInterval}>/ {getIntervalText(plan.interval)}</Text>
                  </View>

                  <View style={styles.featuresContainer}>
                    <Text style={styles.featuresTitle}>Características incluidas:</Text>
                    {plan.features.map((feature, index) => (
                      <View key={index} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={18} color={intervalColor} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Método de Pago</Text>
              
              {paymentMethod ? (
                <View style={styles.paymentCard}>
                  <View style={styles.paymentInfo}>
                    <Ionicons name="card" size={32} color={colors.primary} />
                    <View style={styles.paymentDetails}>
                      <Text style={styles.paymentBrand}>{paymentMethod.brand.toUpperCase()}</Text>
                      <Text style={styles.paymentNumber}>•••• {paymentMethod.last4}</Text>
                      <Text style={styles.paymentExpiry}>
                        Expira: {paymentMethod.exp_month.toString().padStart(2, '0')}/{paymentMethod.exp_year}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.changeButton}
                    onPress={onChangePaymentMethod}
                    disabled={loading}
                  >
                    <Text style={styles.changeButtonText}>Cambiar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noPaymentCard}>
                  <Ionicons name="card-outline" size={48} color={colors.textLight} />
                  <Text style={styles.noPaymentText}>No tienes métodos de pago</Text>
                  <TouchableOpacity 
                    style={styles.addPaymentButton}
                    onPress={onAddPaymentMethod}
                    disabled={loading}
                  >
                    <Ionicons name="add-circle" size={20} color={colors.textWhite} />
                    <Text style={styles.addPaymentButtonText}>Agregar Método de Pago</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Summary */}
            {paymentMethod && (
              <View style={styles.summarySection}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>${plan.price}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Frecuencia</Text>
                  <Text style={styles.summaryValue}>{getIntervalText(plan.interval)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total a Pagar</Text>
                  <Text style={[styles.totalValue, { color: intervalColor }]}>${plan.price}</Text>
                </View>
              </View>
            )}

            {/* Terms */}
            {paymentMethod && (
              <View style={styles.termsContainer}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textGray} />
                <Text style={styles.termsText}>
                  Al confirmar, aceptas que se te cobrará ${plan.price} de forma {getIntervalText(plan.interval).toLowerCase()} hasta que canceles tu suscripción.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          {paymentMethod && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: intervalColor }]}
                onPress={onConfirm}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color={colors.textWhite} />
                    <Text style={styles.confirmButtonText}>Confirmar Suscripción</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  intervalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  intervalText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textWhite,
  },
  planBody: {
    padding: 16,
    paddingTop: 0,
  },
  planDescription: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  priceInterval: {
    fontSize: 14,
    color: colors.textGray,
    marginLeft: 6,
  },
  featuresContainer: {
    gap: 8,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: colors.textGray,
    flex: 1,
  },
  paymentCard: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentDetails: {
    gap: 2,
  },
  paymentBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textGray,
  },
  paymentNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  paymentExpiry: {
    fontSize: 12,
    color: colors.textGray,
  },
  changeButton: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  noPaymentCard: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  noPaymentText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textGray,
    marginTop: 12,
    marginBottom: 16,
  },
  addPaymentButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addPaymentButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textWhite,
  },
  summarySection: {
    marginTop: 20,
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  termsContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.info + '10',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: colors.textGray,
    lineHeight: 18,
  },
  actions: {
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
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textWhite,
  },
});