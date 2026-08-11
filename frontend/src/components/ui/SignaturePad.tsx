import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { useColors, FontSizes, BorderRadius, Spacing } from '../../constants/theme';

export interface SignaturePadRef {
  clear: () => void;
  getSignature: () => void;
}

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onClear?: () => void;
  title?: string;
  description?: string;
  height?: number;
  penColor?: string;
  savedSignature?: string | null;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  function SignaturePad({ onSave, onClear, title = 'Firma Digital', description, height = 200, penColor = '#000000', savedSignature }, ref) {
  const Colors = useColors();
  const styles = React.useMemo(() => create_styles(Colors), [Colors]);
    const sigRef = useRef<SignatureViewRef>(null);

    useImperativeHandle(ref, () => ({
      clear: () => sigRef.current?.clearSignature(),
      getSignature: () => sigRef.current?.readSignature(),
    }));

    const handleClear = () => {
      sigRef.current?.clearSignature();
      onClear?.();
    };

    const handleEnd = () => {
      sigRef.current?.readSignature();
    };

    const handleOK = (signature: string) => {
      if (signature && signature !== 'data:image/png;base64,') {
        onSave(signature);
      }
    };

    const webStyle = `.m-signature-pad {
      box-shadow: none;
      border: none;
      margin: 0;
      padding: 0;
    }
    .m-signature-pad--body {
      border: none;
      margin: 0;
    }
    .m-signature-pad--body canvas {
      border-radius: 12px;
      background-color: #FAFAFA;
    }
    .m-signature-pad--footer {
      display: none;
    }`;

    if (savedSignature) {
      return (
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <View style={styles.signedBadge}>
              <Text style={styles.signedText}>Firmado</Text>
            </View>
          </View>
          <View style={[styles.signatureBox, { height: height * 0.6 }]}>
            {Platform.OS === 'web' ? (
              <View style={styles.signedPlaceholder}>
                <Ionicons name="document-text" size={32} color={Colors.success} />
                <Text style={styles.signedMessage}>Documento firmado digitalmente</Text>
              </View>
            ) : (
              <View style={styles.signedPlaceholder}>
                <Ionicons name="document-text" size={32} color={Colors.success} />
                <Text style={styles.signedMessage}>Documento firmado digitalmente</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Ionicons name="finger-print" size={20} color={Colors.brandRed} />
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        {description && <Text style={styles.description}>{description}</Text>}

        <View style={[styles.signatureBox, { height }]}>
          <SignatureScreen
            ref={sigRef}
            onOK={handleOK}
            onEnd={handleEnd}
            webStyle={webStyle}
            backgroundColor="transparent"
            penColor={penColor}
            minWidth={1.5}
            maxWidth={3}
            dotSize={2}
            trimWhitespace
            imageType="image/png"
          />
          <View style={styles.signHereLine}>
            <View style={styles.signLine} />
            <Text style={styles.signHereText}>Firma aquí</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
            <Text style={styles.clearText}>Limpiar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => sigRef.current?.readSignature()}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
            <Text style={styles.confirmText}>Confirmar Firma</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

const create_styles = (Colors: any) => StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  description: {
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    marginBottom: 10,
    lineHeight: 18,
  },
  signatureBox: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: BorderRadius.card,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#FAFAFA',
    position: 'relative',
  },
  signHereLine: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  signLine: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.textMuted,
    opacity: 0.3,
  },
  signHereText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
    opacity: 0.5,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  clearText: {
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.brandRed,
  },
  confirmText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  signedBadge: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  signedText: {
    fontSize: FontSizes.xs,
    color: Colors.success,
    fontWeight: '600',
  },
  signedPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  signedMessage: {
    fontSize: FontSizes.sm,
    color: Colors.success,
    fontWeight: '500',
  },
});
