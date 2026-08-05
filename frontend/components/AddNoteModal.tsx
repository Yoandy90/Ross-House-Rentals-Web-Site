import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface AddNoteModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

export default function AddNoteModal({
  visible,
  onClose,
  clientId,
  clientName,
  onSuccess,
}: AddNoteModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (noteText.trim().length === 0) {
      Alert.alert('Error', 'La nota no puede estar vacía');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/admin/clients/${clientId}/notes`, {
        note: noteText.trim(),
      });

      Alert.alert(
        'Éxito',
        'Nota agregada correctamente',
        [{ text: 'OK', onPress: () => {
          onSuccess?.();
          setNoteText('');
          onClose();
        }}]
      );
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'No se pudo agregar la nota');
    } finally {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Agregar Nota</Text>
              <Text style={styles.modalSubtitle}>
                Cliente: {clientName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Note Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nota interna</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Escribe una nota sobre este cliente..."
              placeholderTextColor={colors.textGray}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>
              {noteText.length}/500 caracteres
            </Text>
          </View>

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
                styles.submitButton,
                (noteText.trim().length === 0 || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={noteText.trim().length === 0 || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textWhite} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={colors.textWhite} />
                  <Text style={styles.submitButtonText}>Guardar Nota</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textGray,
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  charCount: {
    fontSize: 12,
    color: colors.textGray,
    textAlign: 'right',
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundGray,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textWhite,
  },
});