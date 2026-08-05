import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface WithdrawalModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentBalance: number;
}

interface BankAccount {
  id: string;
  bank_name?: string;
  account_holder_name: string;
  last_four: string;
  account_type: string;
  status: string;
  is_default: boolean;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  visible,
  onClose,
  onSuccess,
  currentBalance,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState<'amount' | 'bank-account' | 'confirm'>('amount');
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(null);
  const [feeInfo, setFeeInfo] = useState<any>(null);
  const [loadingFee, setLoadingFee] = useState(false);

  useEffect(() => {
    if (visible) {
      loadBankAccounts();
    }
  }, [visible]);

  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      calculateFee();
    } else {
      setFeeInfo(null);
    }
  }, [amount]);

  const loadBankAccounts = async () => {
    try {
      const response = await api.get('/withdrawals/bank-accounts');
      setBankAccounts(response.data.bank_accounts || []);
      
      // Pre-select default account
      const defaultAccount = response.data.bank_accounts.find((acc: BankAccount) => acc.is_default);
      if (defaultAccount) {
        setSelectedBankAccount(defaultAccount.id);
      }
    } catch (error: any) {
      console.error('Error loading bank accounts:', error);
    }
  };

  const calculateFee = async () => {
    try {
      setLoadingFee(true);
      const response = await api.get(`/withdrawals/fees?amount=${parseFloat(amount)}`);
      setFeeInfo(response.data);
    } catch (error: any) {
      console.error('Error calculating fee:', error);
    } finally {
      setLoadingFee(false);
    }
  };

  const handleAddBankAccount = async () => {
    // TODO: Implement Plaid Link integration
    // For now, show alert
    Alert.alert(
      'Agregar Cuenta Bancaria',
      'La verificación con Plaid se implementará próximamente. Por favor, usa una cuenta ya registrada.',
      [{ text: 'OK' }]
    );
  };

  const handleAmountNext = () => {
    const numAmount = parseFloat(amount);
    
    if (!amount || numAmount <= 0) {
      Alert.alert('Error', 'Por favor ingresa un monto válido');
      return;
    }
    
    if (numAmount < 10) {
      Alert.alert('Error', 'El monto mínimo de retiro es $10 USD');
      return;
    }
    
    if (numAmount > currentBalance) {
      Alert.alert('Error', `Balance insuficiente. Disponible: $${currentBalance.toFixed(2)}`);
      return;
    }
    
    if (bankAccounts.length === 0) {
      Alert.alert(
        'Sin Cuenta Bancaria',
        'Necesitas registrar una cuenta bancaria para retirar fondos.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar Cuenta', onPress: handleAddBankAccount }
        ]
      );
      return;
    }
    
    setStep('confirm');
  };

  const handleConfirmWithdrawal = async () => {
    try {
      setLoading(true);
      
      const response = await api.post('/withdrawals/request', {
        amount: parseFloat(amount),
        bank_account_id: selectedBankAccount,
      });
      
      Alert.alert(
        'Solicitud Enviada',
        'Tu solicitud de retiro ha sido enviada. Recibirás el pago una vez que el administrador la apruebe.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess();
              handleClose();
            }
          }
        ]
      );
      
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'No se pudo procesar tu solicitud de retiro'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('amount');
    setAmount('');
    setFeeInfo(null);
    onClose();
  };

  const renderAmountStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>¿Cuánto deseas retirar?</Text>
      <Text style={styles.stepSubtitle}>
        Balance disponible: ${currentBalance.toFixed(2)}
      </Text>

      <View style={styles.amountInputContainer}>
        <Text style={styles.dollarSign}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textGray}
        />
        <Text style={styles.usdLabel}>USD</Text>
      </View>

      {feeInfo && (
        <View style={styles.feeInfoBox}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Monto solicitado:</Text>
            <Text style={styles.feeValue}>${feeInfo.gross_amount.toFixed(2)}</Text>
          </View>
          {feeInfo.fee > 0 && (
            <View style={styles.feeRow}>
              <Text style={styles.feeLabel}>Fee de procesamiento:</Text>
              <Text style={[styles.feeValue, { color: colors.error }]}>
                -${feeInfo.fee.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={[styles.feeRow, styles.feeRowTotal]}>
            <Text style={styles.feeLabelTotal}>Recibirás:</Text>
            <Text style={styles.feeValueTotal}>${feeInfo.net_amount.toFixed(2)}</Text>
          </View>
        </View>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.accent} />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoText}>
            • Mínimo: $10 USD{'\n'}
            • Los fondos se transfieren a tu cuenta bancaria{'\n'}
            • Tiempo de procesamiento: 1-3 días hábiles{'\n'}
            • El monto será descontado provisionalmente
          </Text>
        </View>
      </View>
    </View>
  );

  const renderConfirmStep = () => {
    const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccount);
    
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Confirmar Retiro</Text>
        
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Monto a retirar:</Text>
            <Text style={styles.summaryValue}>${feeInfo?.gross_amount.toFixed(2)}</Text>
          </View>
          
          {feeInfo && feeInfo.fee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fee:</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                -${feeInfo.fee.toFixed(2)}
              </Text>
            </View>
          )}
          
          <View style={[styles.summaryRow, styles.summaryRowTotal]}>
            <Text style={styles.summaryLabelTotal}>Recibirás:</Text>
            <Text style={styles.summaryValueTotal}>
              ${feeInfo?.net_amount.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.bankAccountBox}>
            <View style={styles.bankAccountIconContainer}>
              <Ionicons name="card" size={24} color={colors.primary} />
            </View>
            <View style={styles.bankAccountInfo}>
              <Text style={styles.bankAccountName}>
                {selectedAccount?.bank_name || 'Cuenta Bancaria'}
              </Text>
              <Text style={styles.bankAccountDetails}>
                {selectedAccount?.account_type} •••• {selectedAccount?.last_four}
              </Text>
              <Text style={styles.bankAccountHolder}>
                {selectedAccount?.account_holder_name}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.warningBox}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <Text style={styles.warningText}>
            El monto será descontado de tu balance mientras procesamos tu solicitud.
            Si la solicitud es rechazada, el monto será reembolsado.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.changeAccountButton}
          onPress={() => setStep('amount')}
        >
          <Text style={styles.changeAccountText}>Cambiar monto o cuenta</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Retirar Fondos</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, step === 'amount' && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
          </View>

          {/* Content */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {step === 'amount' && renderAmountStep()}
            {step === 'confirm' && renderConfirmStep()}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            {step === 'amount' ? (
              <TouchableOpacity
                style={[styles.primaryButton, loadingFee && styles.buttonDisabled]}
                onPress={handleAmountNext}
                disabled={loadingFee}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>Continuar</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleConfirmWithdrawal}
                disabled={loading}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Confirmar Retiro</Text>
                      <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

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
    maxHeight: '85%',
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundGray,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.backgroundGray,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.backgroundGray,
    marginHorizontal: 8,
  },
  modalBody: {
    flexGrow: 1,
    padding: 20,
  },
  stepContainer: {
    paddingBottom: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 24,
    textAlign: 'center',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  dollarSign: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    padding: 0,
  },
  usdLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textGray,
    marginLeft: 8,
  },
  feeInfoBox: {
    backgroundColor: colors.accent + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeRowTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.accent + '30',
  },
  feeLabel: {
    fontSize: 14,
    color: colors.text,
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  feeLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  feeValueTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.accent + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  summaryBox: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryRowTotal: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: colors.primary + '30',
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textGray,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  summaryValueTotal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  bankAccountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankAccountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankAccountInfo: {
    flex: 1,
  },
  bankAccountName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  bankAccountDetails: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 2,
  },
  bankAccountHolder: {
    fontSize: 12,
    color: colors.textGray,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '15',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 16,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  changeAccountButton: {
    padding: 12,
    alignItems: 'center',
  },
  changeAccountText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundGray,
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
