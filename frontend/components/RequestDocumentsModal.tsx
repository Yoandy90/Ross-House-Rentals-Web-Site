import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../constants/colors';
import api from '../services/api';

interface RequestDocumentsModalProps {
  visible: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

const DOCUMENT_TYPES = [
  { id: 'w2', label: 'Formulario W-2', icon: 'document-text' },
  { id: '1099', label: 'Formulario 1099', icon: 'document' },
  { id: '1098', label: 'Formulario 1098 (Interés hipotecario)', icon: 'home' },
  { id: 'id', label: 'Identificación oficial', icon: 'card' },
  { id: 'ssn', label: 'Tarjeta de Seguro Social', icon: 'shield-checkmark' },
  { id: 'bank_statements', label: 'Estados de cuenta bancarios', icon: 'wallet' },
  { id: 'receipts', label: 'Recibos de gastos', icon: 'receipt' },
  { id: 'medical', label: 'Gastos médicos', icon: 'medical' },
  { id: 'education', label: 'Gastos educativos', icon: 'school' },
  { id: 'business', label: 'Documentos de negocio', icon: 'briefcase' },
  { id: 'investment', label: 'Información de inversiones', icon: 'trending-up' },
  { id: 'other', label: 'Otros documentos', icon: 'folder' },
];

export default function RequestDocumentsModal({
  visible,
  onClose,
  clientId,
  clientName,
  onSuccess,
}: RequestDocumentsModalProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleDocument = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSubmit = async () => {
    if (selectedDocs.length === 0) {
      Alert.alert('Error', 'Selecciona al menos un documento');
      return;
    }

    console.log('📤 Enviando solicitud de documentos:', {
      clientId,
      endpoint: `/admin/clients/${clientId}/request-documents`,
      document_types: selectedDocs
    });

    setLoading(true);
    try {
      const response = await api.post(`/admin/clients/${clientId}/request-documents`, {
        document_types: selectedDocs,
        message: null,
        send_whatsapp: false,
        send_email: true
      });

      console.log('✅ Respuesta del servidor:', response.data);

      Alert.alert(
        'Éxito',
        `Se ha enviado la solicitud de documentos a ${clientName}`,
        [{ text: 'OK', onPress: () => {
          onSuccess?.();
          setSelectedDocs([]);
          onClose();
        }}]
      );
    } catch (error: any) {
      console.error('❌ Error requesting documents:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.detail || 'No se pudo enviar la solicitud';
      Alert.alert('Error', errorMessage);
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
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Solicitar Documentos</Text>
              <Text style={styles.modalSubtitle}>
                Cliente: {clientName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Document List */}
          <ScrollView style={styles.documentList} showsVerticalScrollIndicator={false}>
            <Text style={styles.instructionText}>
              Selecciona los documentos que necesitas del cliente:
            </Text>
            {DOCUMENT_TYPES.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={[
                  styles.documentItem,
                  selectedDocs.includes(doc.id) && styles.documentItemSelected,
                ]}
                onPress={() => toggleDocument(doc.id)}
                activeOpacity={0.7}
              >
                <View style={styles.documentItemLeft}>
                  <View
                    style={[
                      styles.iconContainer,
                      selectedDocs.includes(doc.id) && styles.iconContainerSelected,
                    ]}
                  >
                    <Ionicons
                      name={doc.icon as any}
                      size={20}
                      color={
                        selectedDocs.includes(doc.id)
                          ? colors.textWhite
                          : colors.primary
                      }
                    />
                  </View>
                  <Text
                    style={[
                      styles.documentLabel,
                      selectedDocs.includes(doc.id) && styles.documentLabelSelected,
                    ]}
                  >
                    {doc.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    selectedDocs.includes(doc.id) && styles.checkboxSelected,
                  ]}
                >
                  {selectedDocs.includes(doc.id) && (
                    <Ionicons name="checkmark" size={16} color={colors.textWhite} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <Text style={styles.selectedCount}>
              {selectedDocs.length} documento{selectedDocs.length !== 1 ? 's' : ''} seleccionado{selectedDocs.length !== 1 ? 's' : ''}
            </Text>
            <View style={styles.buttonRow}>
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
                  (selectedDocs.length === 0 || loading) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={selectedDocs.length === 0 || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color={colors.textWhite} />
                    <Text style={styles.submitButtonText}>Enviar Solicitud</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
  documentList: {
    padding: 20,
  },
  instructionText: {
    fontSize: 14,
    color: colors.textGray,
    marginBottom: 16,
    lineHeight: 20,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundGray,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  documentItemSelected: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  documentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerSelected: {
    backgroundColor: colors.primary,
  },
  documentLabel: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  documentLabelSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalFooter: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectedCount: {
    fontSize: 13,
    color: colors.textGray,
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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