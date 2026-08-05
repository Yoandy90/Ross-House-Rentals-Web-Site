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

interface RequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestModal({ visible, onClose, onSuccess }: RequestModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [recipientIdentifier, setRecipientIdentifier] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!recipientIdentifier.trim()) {
      Alert.alert('Error', 'Ingresa el email o teléfono del usuario');
      return;
    }

    const requestAmount = parseFloat(amount);
    if (isNaN(requestAmount) || requestAmount <= 0 || requestAmount > 500) {
      Alert.alert('Error', 'El monto debe ser entre 1 y 500 créditos');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      Alert.alert('Error', 'La razón debe tener al menos 10 caracteres');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/credits/request', {
        recipient_identifier: recipientIdentifier.trim(),
        amount: requestAmount,
        reason: reason.trim(),
      });

      Alert.alert(
        '¡Solicitud enviada!',
        response.data.message,
        [
          {
            text: 'OK',
            onPress: () => {
              setRecipientIdentifier('');
              setAmount('');
              setReason('');
              onSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Error al enviar la solicitud';
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
              <Ionicons name="hand-left" size={28} color={colors.accent} />
            </View>
            <Text style={styles.modalTitle}>Solicitar Créditos</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={colors.accent} />
              <Text style={styles.infoText}>
                El usuario recibirá una notificación y podrá aprobar o rechazar tu solicitud
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Solicitar a <Text style={styles.required}>*</Text>
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
                  placeholder="1 - 500"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                <Text style={styles.inputSuffix}>créditos</Text>
              </View>
              <Text style={styles.inputHint}>Máximo: 500 créditos por solicitud</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Razón <Text style={styles.required}>*</Text>
              </Text>
              <View style={[styles.inputContainer, styles.textAreaContainer]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej: Necesito créditos para mi declaración de impuestos"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  maxLength={200}
                />
              </View>
              <Text style={styles.inputHint}>
                {reason.length}/200 caracteres (mínimo 10)
              </Text>
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
              onPress={handleRequest}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#FFF" />
                  <Text style={styles.buttonTextPrimary}>Solicitar</Text>
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
    backgroundColor: colors.accent + '15',
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '10',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    lineHeight: 18,
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
    minHeight: 100,
  },
  textArea: {
    minHeight: 80,
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
    backgroundColor: colors.accent,
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
