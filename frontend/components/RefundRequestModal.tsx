import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface RefundRequestModalProps {
  visible: boolean;
  onClose: () => void;
  transactionData: {
    id: string;
    type: 'purchase' | 'usage';
    amount: number;
    description: string;
    date: string;
  } | null;
  onSuccess: () => void;
}

export default function RefundRequestModal({
  visible,
  onClose,
  transactionData,
  onSuccess,
}: RefundRequestModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [selectedRefundType, setSelectedRefundType] = useState<'CREDITS' | 'ORIGINAL_PAYMENT'>('CREDITS');
  const [reason, setReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async () => {
    if (!transactionData) return;

    if (!reason.trim()) {
      Alert.alert('Campo Requerido', 'Por favor ingresa el motivo del reembolso');
      return;
    }

    Alert.alert(
      'Confirmar Solicitud',
      `¿Estás seguro de solicitar un reembolso ${selectedRefundType === 'CREDITS' ? 'en créditos' : 'al método de pago original'}?\n\nMotivo: ${reason}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Confirmar', 
          onPress: () => submitRefund(),
          style: 'default'
        }
      ]
    );
  };

  const submitRefund = async () => {
    if (!transactionData) return;

    try {
      setProcessing(true);

      const requestData: any = {
        refund_type: selectedRefundType,
        reason: reason.trim(),
      };

      // Add transaction reference based on type
      if (transactionData.type === 'purchase') {
        requestData.purchase_id = transactionData.id;
      } else {
        requestData.usage_id = transactionData.id;
      }

      await api.post('/credits/refund/request', requestData);

      Alert.alert(
        '¡Solicitud Enviada!',
        'Tu solicitud de reembolso ha sido enviada exitosamente. Un administrador la revisará pronto.',
        [
          {
            text: 'OK',
            onPress: () => {
              setReason('');
              setSelectedRefundType('CREDITS');
              onSuccess();
              onClose();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error submitting refund request:', error);
      const errorMsg = error.response?.data?.detail || 'Error al enviar la solicitud';
      Alert.alert('Error', errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setSelectedRefundType('CREDITS');
    onClose();
  };

  if (!transactionData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ScrollView>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Solicitar Reembolso</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Transaction Info */}
            <View style={styles.transactionCard}>
              <View style={styles.transactionHeader}>
                <Ionicons 
                  name={transactionData.type === 'purchase' ? 'add-circle' : 'remove-circle'} 
                  size={32} 
                  color={transactionData.type === 'purchase' ? colors.success : colors.error} 
                />
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionTitle}>{transactionData.description}</Text>
                  <Text style={styles.transactionDate}>{transactionData.date}</Text>
                </View>
              </View>
              <View style={styles.amountBadge}>
                <Text style={styles.amountText}>{transactionData.amount} créditos</Text>
              </View>
            </View>

            {/* Refund Type Selection */}
            <Text style={styles.sectionTitle}>Tipo de Reembolso:</Text>

            <TouchableOpacity
              style={[
                styles.refundTypeOption,
                selectedRefundType === 'CREDITS' && styles.refundTypeOptionSelected
              ]}
              onPress={() => setSelectedRefundType('CREDITS')}
              disabled={processing}
            >
              <View style={styles.refundTypeIcon}>
                <Ionicons 
                  name="sparkles" 
                  size={24} 
                  color={selectedRefundType === 'CREDITS' ? colors.primary : colors.textGray} 
                />
              </View>
              <View style={styles.refundTypeInfo}>
                <Text style={[
                  styles.refundTypeTitle,
                  selectedRefundType === 'CREDITS' && styles.refundTypeTitleSelected
                ]}>
                  Reembolso en Créditos
                </Text>
                <Text style={styles.refundTypeDesc}>
                  Recibirás {transactionData.amount} créditos en tu cuenta instantáneamente
                </Text>
              </View>
              {selectedRefundType === 'CREDITS' && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>

            {transactionData.type === 'purchase' && (
              <TouchableOpacity
                style={[
                  styles.refundTypeOption,
                  selectedRefundType === 'ORIGINAL_PAYMENT' && styles.refundTypeOptionSelected
                ]}
                onPress={() => setSelectedRefundType('ORIGINAL_PAYMENT')}
                disabled={processing}
              >
                <View style={styles.refundTypeIcon}>
                  <Ionicons 
                    name="card" 
                    size={24} 
                    color={selectedRefundType === 'ORIGINAL_PAYMENT' ? colors.primary : colors.textGray} 
                  />
                </View>
                <View style={styles.refundTypeInfo}>
                  <Text style={[
                    styles.refundTypeTitle,
                    selectedRefundType === 'ORIGINAL_PAYMENT' && styles.refundTypeTitleSelected
                  ]}>
                    Reembolso al Método Original
                  </Text>
                  <Text style={styles.refundTypeDesc}>
                    El dinero se devolverá a tu método de pago original (puede tardar 5-10 días)
                  </Text>
                </View>
                {selectedRefundType === 'ORIGINAL_PAYMENT' && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}

            {/* Reason Input */}
            <Text style={styles.sectionTitle}>Motivo del Reembolso: *</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Explica brevemente por qué solicitas este reembolso..."
              placeholderTextColor={colors.textGray}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!processing}
            />

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Ionicons name="information-circle" size={20} color={colors.info} />
              <Text style={styles.infoText}>
                Tu solicitud será revisada por un administrador. Recibirás una notificación cuando sea procesada.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  (!reason.trim() || processing) && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!reason.trim() || processing}
              >
                {processing ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Enviar Solicitud</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  transactionCard: {
    backgroundColor: colors.background,
    margin: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: colors.textGray,
  },
  amountBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  refundTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#FFF',
    gap: 12,
  },
  refundTypeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  refundTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundTypeInfo: {
    flex: 1,
  },
  refundTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  refundTypeTitleSelected: {
    color: colors.primary,
  },
  refundTypeDesc: {
    fontSize: 13,
    color: colors.textGray,
    lineHeight: 18,
  },
  reasonInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    fontSize: 15,
    color: colors.text,
    minHeight: 100,
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: colors.info + '10',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textGray,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});