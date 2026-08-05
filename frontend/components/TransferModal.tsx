import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentBalance: number;
}

export function TransferModal({ visible, onClose, onSuccess, currentBalance }: TransferModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    if (!recipientIdentifier.trim()) {
      Alert.alert('Error', 'Ingresa el email o teléfono del destinatario');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0 || transferAmount > 1000) {
      Alert.alert('Error', 'El monto debe ser entre 1 y 1000 créditos');
      return;
    }

    if (transferAmount > currentBalance) {
      Alert.alert('Saldo insuficiente', `Solo tienes ${currentBalance} créditos disponibles`);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/credits/transfer', {
        recipient_identifier: recipientIdentifier.trim(),
        amount: transferAmount,
        note: note.trim() || null,
      });

      Alert.alert(
        '¡Transferencia exitosa!',
        response.data.message,
        [
          {
            text: 'OK',
            onPress: () => {
              setRecipientIdentifier('');
              setAmount('');
              setNote('');
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Error al transferir créditos';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="arrow-forward-circle" size={28} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Transferir Créditos</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.balanceDisplay}>
              <Text style={styles.balanceLabel}>Balance disponible</Text>
              <Text style={styles.balanceAmount}>{currentBalance} créditos</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Destinatario <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={colors.textGray} />
                <TextInput
                  style={styles.input}
                  placeholder="Email o número de teléfono"
                  value={recipientIdentifier}
                  onChangeText={setRecipientIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Monto <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="wallet-outline" size={20} color={colors.textGray} />
                <TextInput
                  style={styles.input}
                  placeholder="1 - 1000"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>créditos</Text>
              </View>
              <Text style={styles.inputHint}>Máximo: 1,000 créditos por transferencia</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nota (opcional)</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej: Gracias por tu ayuda"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>
              <Text style={styles.inputHint}>{note.length}/200 caracteres</Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonTextSecondary}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
              onPress={handleTransfer}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.buttonTextPrimary}>Transferir</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  balanceDisplay: {
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  inputSuffix: {
    fontSize: 14,
    color: colors.textGray,
    fontWeight: '600',
  },
  inputHint: {
    fontSize: 12,
    color: colors.textGray,
    marginTop: 6,
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    minHeight: 80,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  buttonSecondary: {
    backgroundColor: colors.backgroundGray,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonTextSecondary: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  buttonTextPrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
