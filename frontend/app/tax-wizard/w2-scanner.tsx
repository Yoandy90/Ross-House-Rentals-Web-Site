/**
 * Tax Wizard - W-2 Scanner Screen
 * Scan W-2 documents with camera and extract data using AI
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

interface ExtractedW2Data {
  employer_name: string;
  employer_ein: string;
  box1_wages: number;
  box2_federal_withheld: number;
  box17_state_withheld: number;
  employee_name: string;
  confidence_score: number;
  needs_review: boolean;
  review_notes?: string;
}

export default function W2ScannerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedW2Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('wizard.w2Scanner.permissionRequired'),
          t('wizard.w2Scanner.needCameraAccess')
        );
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setExtractedData(null);
        setError(null);
        
        if (result.assets[0].base64) {
          await processImage(result.assets[0].base64, 'image/jpeg');
        }
      }
    } catch (e) {
      console.error('Camera error:', e);
      Alert.alert(t('common.error'), t('wizard.w2Scanner.couldNotOpenCamera'));
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setExtractedData(null);
        setError(null);
        
        if (result.assets[0].base64) {
          const mimeType = result.assets[0].uri.toLowerCase().includes('.png') 
            ? 'image/png' 
            : 'image/jpeg';
          await processImage(result.assets[0].base64, mimeType);
        }
      }
    } catch (e) {
      console.error('Gallery error:', e);
      Alert.alert(t('common.error'), t('wizard.w2Scanner.couldNotOpenGallery'));
    }
  };

  const processImage = async (base64: string, mimeType: string) => {
    setProcessing(true);
    setError(null);

    try {
      const response = await api.post('/tax-wizard/ocr/w2', {
        image_base64: base64,
        mime_type: mimeType,
      });

      if (response.data.success) {
        setExtractedData(response.data.extracted_data);
        
        if (response.data.needs_review) {
          Alert.alert(
            t('wizard.w2Scanner.reviewNeeded'),
            'Algunos datos podrían necesitar verificación manual. Por favor revisa los valores extraídos.',
            [{ text: 'Entendido' }]
          );
        }
      } else {
        setError(response.data.error || 'Error al procesar la imagen');
      }
    } catch (e: any) {
      console.error('OCR error:', e);
      setError(e.response?.data?.detail || 'Error al procesar la imagen');
    } finally {
      setProcessing(false);
    }
  };

  const handleUseData = () => {
    if (extractedData && sessionId) {
      // Navigate back to income screen with the extracted data
      router.push({
        pathname: '/tax-wizard/income',
        params: {
          sessionId,
          w2Data: JSON.stringify({
            employer_name: extractedData.employer_name,
            employer_ein: extractedData.employer_ein,
            amount: extractedData.box1_wages,
            federal_withheld: extractedData.box2_federal_withheld,
            state_withheld: extractedData.box17_state_withheld,
          }),
        },
      });
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#065F46', '#10B981']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Escanear W-2</Text>
            <Text style={styles.headerSubtitle}>Extrae datos automáticamente</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Instructions */}
        {!image && (
          <View style={styles.instructionsCard}>
            <Ionicons name="scan" size={48} color="#10B981" />
            <Text style={styles.instructionsTitle}>Escanea tu W-2</Text>
            <Text style={styles.instructionsText}>
              Toma una foto clara de tu formulario W-2 y extraeremos los datos automáticamente usando inteligencia artificial.
            </Text>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <Ionicons name="sunny" size={20} color="#F59E0B" />
                <Text style={styles.tipText}>Buena iluminación</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="scan-outline" size={20} color="#3B82F6" />
                <Text style={styles.tipText}>Documento plano</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="eye" size={20} color="#8B5CF6" />
                <Text style={styles.tipText}>Texto legible</Text>
              </View>
            </View>
          </View>
        )}

        {/* Capture Buttons */}
        <View style={styles.captureButtons}>
          <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
            <Ionicons name="camera" size={28} color="#fff" />
            <Text style={styles.cameraButtonText}>Tomar Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
            <Ionicons name="images" size={28} color="#10B981" />
            <Text style={styles.galleryButtonText}>Galería</Text>
          </TouchableOpacity>
        </View>

        {/* Image Preview */}
        {image && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: image }} style={styles.previewImage} />
            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.processingText}>Procesando con IA...</Text>
              </View>
            )}
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning" size={24} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={styles.retryText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Extracted Data */}
        {extractedData && (
          <View style={styles.resultsCard}>
            <View style={styles.resultsHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.resultsTitle}>Datos Extraídos</Text>
              <View style={[
                styles.confidenceBadge,
                { backgroundColor: extractedData.confidence_score >= 80 ? '#D1FAE5' : '#FEF3C7' }
              ]}>
                <Text style={[
                  styles.confidenceText,
                  { color: extractedData.confidence_score >= 80 ? '#065F46' : '#92400E' }
                ]}>
                  {extractedData.confidence_score}% confianza
                </Text>
              </View>
            </View>

            {extractedData.needs_review && (
              <View style={styles.reviewWarning}>
                <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                <Text style={styles.reviewWarningText}>
                  {extractedData.review_notes || 'Algunos valores pueden necesitar revisión'}
                </Text>
              </View>
            )}

            <View style={styles.dataGrid}>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Empleador</Text>
                <Text style={styles.dataValue}>{extractedData.employer_name || t('wizard.notDetected')}</Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>EIN Empleador</Text>
                <Text style={styles.dataValue}>{extractedData.employer_ein || t('wizard.notDetected')}</Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Salario (Box 1)</Text>
                <Text style={styles.dataValueLarge}>{formatCurrency(extractedData.box1_wages)}</Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Impuesto Federal (Box 2)</Text>
                <Text style={styles.dataValueLarge}>{formatCurrency(extractedData.box2_federal_withheld)}</Text>
              </View>
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Impuesto Estatal (Box 17)</Text>
                <Text style={styles.dataValue}>{formatCurrency(extractedData.box17_state_withheld)}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.useDataButton} onPress={handleUseData}>
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.useDataButtonText}>Usar Estos Datos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.scanAnotherButton} onPress={() => {
              setImage(null);
              setExtractedData(null);
            }}>
              <Ionicons name="add-circle-outline" size={20} color="#10B981" />
              <Text style={styles.scanAnotherText}>Escanear Otro W-2</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  content: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    padding: 20,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  tipsList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  tipItem: {
    alignItems: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
  },
  captureButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  cameraButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cameraButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  galleryButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  galleryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  imagePreview: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    textAlign: 'center',
    marginTop: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 12,
  },
  resultsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reviewWarning: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reviewWarningText: {
    fontSize: 13,
    color: '#92400E',
    marginLeft: 10,
    flex: 1,
  },
  dataGrid: {
    marginBottom: 20,
  },
  dataItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dataLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dataValueLarge: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
  },
  useDataButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  useDataButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scanAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  scanAnotherText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
});
