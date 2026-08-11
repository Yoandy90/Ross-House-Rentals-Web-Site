import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

interface SignaturePadProps {
  onSave: (signatureBase64: string) => void;
  onCancel: () => void;
  signerName: string;
  signerRole: 'admin' | 'tenant';
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAD_WIDTH = SCREEN_WIDTH - 48;
const PAD_HEIGHT = 200;

export default function SignaturePad({ onSave, onCancel, signerName, signerRole }: SignaturePadProps) {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isSigning, setIsSigning] = useState(false);

  const handleTouchStart = useCallback((event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath(`M${locationX},${locationY}`);
    setIsSigning(true);
  }, []);

  const handleTouchMove = useCallback((event: any) => {
    if (!isSigning) return;
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPath(prev => `${prev} L${locationX},${locationY}`);
  }, [isSigning]);

  const handleTouchEnd = useCallback(() => {
    if (currentPath) {
      setPaths(prev => [...prev, currentPath]);
      setCurrentPath('');
    }
    setIsSigning(false);
  }, [currentPath]);

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const saveSignature = async () => {
    if (paths.length === 0) {
      return;
    }
    
    // Create SVG string and convert to base64
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAD_WIDTH}" height="${PAD_HEIGHT}" viewBox="0 0 ${PAD_WIDTH} ${PAD_HEIGHT}"><rect width="100%" height="100%" fill="white"/>${paths.map(p => `<path d="${p}" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
    
    // Convert to base64 using a cross-platform method
    let base64: string;
    if (Platform.OS === 'web') {
      base64 = btoa(unescape(encodeURIComponent(svgContent)));
    } else {
      // For React Native, use a simple base64 encoding
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let result = '';
      const bytes = new TextEncoder().encode(svgContent);
      let i = 0;
      while (i < bytes.length) {
        const byte1 = bytes[i++] || 0;
        const byte2 = bytes[i++] || 0;
        const byte3 = bytes[i++] || 0;
        result += chars[byte1 >> 2];
        result += chars[((byte1 & 3) << 4) | (byte2 >> 4)];
        result += chars[i - 2 < bytes.length ? ((byte2 & 15) << 2) | (byte3 >> 6) : 64];
        result += chars[i - 1 < bytes.length ? byte3 & 63 : 64];
      }
      base64 = result;
    }
    
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    onSave(dataUrl);
  };

  const roleColors = {
    admin: { primary: '#C8102E', secondary: '#9B1B30' },
    tenant: { primary: '#0ea5e9', secondary: '#0284c7' },
  };

  const colors = roleColors[signerRole];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Firma Digital</Text>
          <Text style={styles.headerSubtitle}>
            {signerRole === 'admin' ? '👨‍💼 Inspector' : '🏠 Inquilino'}: {signerName}
          </Text>
        </View>
      </View>

      {/* Signature Pad */}
      <View style={styles.padContainer}>
        <View
          style={styles.signaturePad}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Svg width={PAD_WIDTH} height={PAD_HEIGHT} style={StyleSheet.absoluteFill}>
            {paths.map((path, index) => (
              <Path
                key={index}
                d={path}
                stroke="#1a1a2e"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath && (
              <Path
                d={currentPath}
                stroke="#1a1a2e"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
          
          {paths.length === 0 && !currentPath && (
            <View style={styles.placeholder}>
              <Ionicons name="finger-print-outline" size={40} color="rgba(0,0,0,0.1)" />
              <Text style={styles.placeholderText}>Firme aquí con su dedo</Text>
            </View>
          )}
        </View>
        
        {/* Signature Line */}
        <View style={styles.signatureLine}>
          <View style={styles.line} />
          <Text style={styles.signatureLabel}>Firma de {signerRole === 'admin' ? 'Inspector' : 'Inquilino'}</Text>
        </View>
      </View>

      {/* Legal Text */}
      <Text style={styles.legalText}>
        Al firmar, confirmo que he revisado esta inspección y estoy de acuerdo con los hallazgos documentados.
      </Text>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearButton} onPress={clearSignature}>
          <Ionicons name="refresh-outline" size={18} color="#888" />
          <Text style={styles.clearButtonText}>Limpiar</Text>
        </TouchableOpacity>

        <View style={styles.mainActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.saveButton, paths.length === 0 && styles.saveButtonDisabled]} 
            onPress={saveSignature}
            disabled={paths.length === 0}
          >
            <LinearGradient
              colors={paths.length > 0 ? [colors.primary, colors.secondary] : ['#444', '#333']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Confirmar Firma</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(200,16,46,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  padContainer: {
    marginBottom: 16,
  },
  signaturePad: {
    width: PAD_WIDTH,
    height: PAD_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: 'rgba(0,0,0,0.3)',
  },
  signatureLine: {
    marginTop: 12,
    alignItems: 'center',
  },
  line: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  signatureLabel: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  legalText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  actions: {
    gap: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#888',
  },
  mainActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  saveButton: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
