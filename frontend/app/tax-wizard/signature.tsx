/**
 * Mi Reembolso - E-Signature Screen (Form 8879)
 * IRS e-file Signature Authorization
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 80;
const CANVAS_HEIGHT = 150;

export default function SignatureScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [agreed, setAgreed] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const response = await api.get(`/tax-wizard/session/${sessionId}`);
      if (response.data) {
        setSessionData(response.data);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      setCurrentPath(`M${e.x},${e.y}`);
    })
    .onUpdate((e) => {
      setCurrentPath((prev) => `${prev} L${e.x},${e.y}`);
    })
    .onEnd(() => {
      if (currentPath) {
        setPaths((prev) => [...prev, currentPath]);
        setCurrentPath('');
      }
    })
    .minDistance(1);

  const clearSignature = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  const handleSubmit = async () => {
    if (!agreed) {
      Alert.alert(t('common.error'), t('wizard.signature.acceptTerms'));
      return;
    }
    
    if (!hasSignature) {
      Alert.alert(t('common.error'), t('wizard.signature.pleaseSign'));
      return;
    }

    setSigning(true);
    try {
      // Create SVG signature data
      const svgData = `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        ${[...paths, currentPath].filter(p => p).map(p => 
          `<path d="${p}" stroke="#1F2937" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        ).join('')}
      </svg>`;

      // Save signature
      await api.post(`/tax-wizard/session/${sessionId}/signature`, {
        signature_data: svgData,
        agreed_to_terms: agreed,
        signed_at: new Date().toISOString(),
        ip_address: '',
      });

      // Go to payment
      router.push({
        pathname: '/tax-wizard/payment',
        params: { sessionId }
      });
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'No se pudo guardar la firma. Intenta de nuevo.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1E40AF" />
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const personalInfo = sessionData?.personal_info || {};
  const fullName = `${personalInfo.first_name || ''} ${personalInfo.last_name || ''}`.trim();
  const taxYear = sessionData?.tax_year || 2025;

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E40AF" />
      
      {/* Header */}
      <LinearGradient colors={['#1E40AF', '#3B82F6']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Firma Electrónica</Text>
          <Text style={styles.headerSubtitle}>Formulario 8879 - Autorización de e-file</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Form 8879 Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="document-text" size={28} color="#3B82F6" />
            <View style={styles.infoHeaderText}>
              <Text style={styles.infoTitle}>IRS Form 8879</Text>
              <Text style={styles.infoSubtitle}>IRS e-file Signature Authorization</Text>
            </View>
          </View>

          <View style={styles.taxpayerInfo}>
            <Text style={styles.taxpayerLabel}>Información del Contribuyente:</Text>
            <View style={styles.taxpayerGrid}>
              <View style={styles.taxpayerItem}>
                <Text style={styles.itemLabel}>Nombre:</Text>
                <Text style={styles.itemValue}>{fullName || 'No especificado'}</Text>
              </View>
              <View style={styles.taxpayerItem}>
                <Text style={styles.itemLabel}>Año Fiscal:</Text>
                <Text style={styles.itemValue}>{taxYear}</Text>
              </View>
              <View style={styles.taxpayerItem}>
                <Text style={styles.itemLabel}>SSN:</Text>
                <Text style={styles.itemValue}>***-**-{personalInfo.ssn?.slice(-4) || '****'}</Text>
              </View>
              <View style={styles.taxpayerItem}>
                <Text style={styles.itemLabel}>Estado Civil:</Text>
                <Text style={styles.itemValue}>{personalInfo.filing_status || 'N/A'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Declaration */}
        <View style={styles.declarationCard}>
          <Text style={styles.declarationTitle}>Declaración del Contribuyente</Text>
          <Text style={styles.declarationText}>
            Al firmar este formulario, declaro bajo pena de perjurio que la información 
            proporcionada en mi declaración de impuestos electrónica es verdadera, correcta 
            y completa según mi leal saber y entender.
          </Text>
          <Text style={styles.declarationText}>
            Autorizo a Ross Tax Preparation LLC a transmitir mi declaración de impuestos 
            electrónicamente al Internal Revenue Service (IRS).
          </Text>
        </View>

        {/* Signature Pad */}
        <View style={styles.signatureCard}>
          <View style={styles.signatureHeader}>
            <Text style={styles.signatureTitle}>Tu Firma</Text>
            <TouchableOpacity onPress={clearSignature}>
              <Text style={styles.clearButton}>Limpiar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signatureCanvas}>
            <GestureDetector gesture={panGesture}>
              <View style={styles.canvasWrapper}>
                <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
                  {paths.map((path, index) => (
                    <Path
                      key={index}
                      d={path}
                      stroke="#1F2937"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {currentPath ? (
                    <Path
                      d={currentPath}
                      stroke="#1F2937"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </Svg>
                {!hasSignature && (
                  <View style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>Firma aquí con tu dedo</Text>
                  </View>
                )}
              </View>
            </GestureDetector>
          </View>

          {hasSignature && (
            <View style={styles.signatureCaptured}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.signatureCapturedText}>Firma capturada</Text>
            </View>
          )}
        </View>

        {/* Agreement Checkbox */}
        <TouchableOpacity
          style={styles.agreementCard}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Ionicons name="checkmark" size={18} color="#fff" />}
          </View>
          <Text style={styles.agreementText}>
            Confirmo que he revisado mi declaración de impuestos, que toda la información 
            es verdadera y correcta, y autorizo la transmisión electrónica al IRS.
          </Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (!agreed || !hasSignature || signing) && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!agreed || !hasSignature || signing}
        >
          {signing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>Firmar y Continuar al Pago</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Security Note */}
        <View style={styles.securityNote}>
          <Ionicons name="lock-closed" size={16} color="#6B7280" />
          <Text style={styles.securityText}>
            Tu firma se almacena de forma segura y encriptada
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backBtn: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#BFDBFE',
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoHeaderText: {
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  infoSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  taxpayerInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  taxpayerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  taxpayerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  taxpayerItem: {
    width: '50%',
    marginBottom: 8,
  },
  itemLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  declarationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  declarationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  declarationText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 8,
  },
  signatureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  signatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  clearButton: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  signatureCanvas: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
  },
  canvasWrapper: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#fff',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  signatureCaptured: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signatureCapturedText: {
    fontSize: 14,
    color: '#10B981',
    marginLeft: 6,
  },
  agreementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
});
