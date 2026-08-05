import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useThemeColors } from '../constants/colors';

interface SignaturePadSimpleProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signature: string) => void;
  title?: string;
}

const { width: screenWidth } = Dimensions.get('window');
const SIGNATURE_WIDTH = screenWidth - 32;
const SIGNATURE_HEIGHT = 300;

export default function SignaturePadSimple({ 
  visible, 
  onClose, 
  onSave, 
  title 
}: SignaturePadSimpleProps) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const currentPathRef = useRef<{ x: number; y: number }[]>([]);
  
  console.log('📝 SignaturePadSimple rendered, visible:', visible);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        currentPathRef.current = [{ x: locationX, y: locationY }];
        setCurrentPath(`M ${locationX} ${locationY}`);
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        currentPathRef.current.push({ x: locationX, y: locationY });
        const path = currentPathRef.current
          .map((point, index) => {
            if (index === 0) return `M ${point.x} ${point.y}`;
            return `L ${point.x} ${point.y}`;
          })
          .join(' ');
        setCurrentPath(path);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          setPaths([...paths, currentPath]);
          setCurrentPath('');
          currentPathRef.current = [];
        }
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    currentPathRef.current = [];
  };

  const handleSave = () => {
    if (paths.length === 0) {
      Alert.alert('Firma Requerida', 'Por favor firma antes de guardar');
      return;
    }

    // Crear un SVG string simple como representación de la firma
    const svgString = `<svg width="${SIGNATURE_WIDTH}" height="${SIGNATURE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${paths.map(path => `<path d="${path}" stroke="${colors.text}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
    </svg>`;
    
    // Convertir a data URI
    const base64 = btoa(svgString);
    const dataUri = `data:image/svg+xml;base64,${base64}`;
    
    onSave(dataUri);
    handleClear();
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
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
          <View style={styles.gestureContainer} {...panResponder.panHandlers}>
            <View style={styles.canvas}>
              <Svg width={SIGNATURE_WIDTH} height={SIGNATURE_HEIGHT}>
                {paths.map((path, index) => (
                  <Path
                    key={index}
                    d={path}
                    stroke={colors.text}
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath && (
                  <Path
                    d={currentPath}
                    stroke={colors.text}
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </Svg>
              
              {/* Signature Line */}
              <View style={styles.signatureLine}>
                <View style={[styles.line, { backgroundColor: colors.border }]} />
                <Text style={[styles.lineText, { color: colors.textSecondary }]}>
                  Firma aquí
                </Text>
              </View>
            </View>
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
            style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            <Text style={styles.saveButtonText}>Guardar Firma</Text>
          </TouchableOpacity>
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
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.primary + '10',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
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
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  gestureContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureLine: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  line: {
    width: '100%',
    height: 2,
    marginBottom: 8,
  },
  lineText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#FEE2E2',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  saveButton: {
    // backgroundColor applied dynamically
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
