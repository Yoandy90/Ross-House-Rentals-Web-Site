import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureCanvas from 'react-native-signature-canvas';
import { useThemeColors } from '../constants/colors';

interface SignaturePadProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
  title?: string;
}

export default function SignaturePad({ visible, onClose, onSave, title }: SignaturePadProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const signatureRef = useRef<any>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const handleSignature = (signature: string) => {
    onSave(signature);
    onClose();
    setHasSignature(false);
  };

  const handleClear = () => {
    signatureRef.current?.clearSignature();
    setHasSignature(false);
  };

  const handleSave = () => {
    if (!hasSignature) {
      Alert.alert('Firma Requerida', 'Por favor firma antes de guardar');
      return;
    }
    signatureRef.current?.readSignature();
  };

  const handleBegin = () => {
    setHasSignature(true);
  };

  const style = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
    }
    .m-signature-pad--body {
      border: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body,html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{title || 'Firma Electrónica'}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
          <Text style={styles.instructionsText}>
            Firma con tu dedo en el espacio de abajo
          </Text>
        </View>

        {/* Signature Canvas */}
        <View style={styles.signatureContainer}>
          <SignatureCanvas
            ref={signatureRef}
            onOK={handleSignature}
            onBegin={handleBegin}
            descriptionText=""
            clearText="Limpiar"
            confirmText="Guardar"
            webStyle={style}
            autoClear={false}
            backgroundColor={colors.card || '#FFFFFF'}
            penColor={colors.text || '#000000'}
            minWidth={2}
            maxWidth={4}
          />
          
          {/* Signature Line */}
          <View style={styles.signatureLine}>
            <View style={styles.line} />
            <Text style={styles.lineText}>Firma aquí</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
            <Text style={styles.clearButtonText}>Limpiar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Guardar Firma</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
          <Text style={styles.footerText}>
            Tu firma será guardada de forma segura y tendrá validez legal
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border || '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: colors.primaryLight || colors.primary + '15',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  signatureContainer: {
    flex: 1,
    margin: 16,
    backgroundColor: colors.card || '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
  },
  signatureLine: {
    position: 'absolute',
    bottom: 80,
    left: 40,
    right: 40,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  line: {
    width: '100%',
    height: 2,
    backgroundColor: colors.border || '#E5E7EB',
  },
  lineText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  clearButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.backgroundGray,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
