/**
 * Identity Verification Step - Tax Wizard
 * Captures ID photo + selfie for IRS e-filing verification
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

type VerificationStep = 'intro' | 'id_capture' | 'selfie_capture' | 'review' | 'submitted';

const ID_TYPES = [
  { value: 'drivers_license', label: 'Licencia de conducir', icon: 'car-outline' },
  { value: 'passport', label: 'Pasaporte', icon: 'globe-outline' },
  { value: 'state_id', label: 'ID estatal', icon: 'card-outline' },
];

export default function IdentityVerificationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [step, setStep] = useState<VerificationStep>('intro');
  const [idType, setIdType] = useState('drivers_license');
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('');

  const compressImage = async (uri: string): Promise<string> => {
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return manipulated.base64 || '';
    } catch (e) {
      console.error('Error compressing image:', e);
      return '';
    }
  };

  const captureFromCamera = async (type: 'id' | 'selfie') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('wizard.idVerification.permissionNeeded'), t('wizard.idVerification.cameraPermission'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: type === 'id' ? [16, 10] : [1, 1],
      base64: false,
      cameraType: type === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });

    if (!result.canceled && result.assets?.[0]) {
      const base64 = await compressImage(result.assets[0].uri);
      if (type === 'id') {
        setIdPhoto(`data:image/jpeg;base64,${base64}`);
        setStep('selfie_capture');
      } else {
        setSelfiePhoto(`data:image/jpeg;base64,${base64}`);
        setStep('review');
      }
    }
  };

  const pickFromGallery = async (type: 'id' | 'selfie') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('wizard.idVerification.permissionNeeded'), t('wizard.idVerification.galleryPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: type === 'id' ? [16, 10] : [1, 1],
      base64: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      const base64 = await compressImage(result.assets[0].uri);
      if (type === 'id') {
        setIdPhoto(`data:image/jpeg;base64,${base64}`);
        setStep('selfie_capture');
      } else {
        setSelfiePhoto(`data:image/jpeg;base64,${base64}`);
        setStep('review');
      }
    }
  };

  const handleSubmit = async () => {
    if (!idPhoto || !selfiePhoto || !sessionId) {
      Alert.alert(t('common.error'), t('wizard.idVerification.missingPhotos'));
      return;
    }

    try {
      setSubmitting(true);

      // Extract base64 data (remove data:image/jpeg;base64, prefix)
      const idBase64 = idPhoto.replace(/^data:image\/\w+;base64,/, '');
      const selfieBase64 = selfiePhoto.replace(/^data:image\/\w+;base64,/, '');

      const response = await api.post(`/tax-wizard/session/${sessionId}/identity-verification`, {
        id_photo_base64: idBase64,
        selfie_base64: selfieBase64,
        id_type: idType,
      });

      if (response.data?.success) {
        setStep('submitted');
        setVerificationStatus('submitted');
      } else {
        Alert.alert('Error', response.data?.error || 'No se pudo enviar la verificación');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Error al enviar la verificación';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (sessionId) {
      router.push({
        pathname: '/tax-wizard/signature',
        params: { sessionId },
      });
    }
  };

  // INTRO STEP
  if (step === 'intro') {
    return (
      <SafeAreaView style={st.container}>
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
          {/* Header */}
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>

          <View style={st.introSection}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={st.introIcon}>
              <Ionicons name="shield-checkmark" size={48} color="#FFF" />
            </LinearGradient>

            <Text style={st.introTitle}>Verifica tu identidad</Text>
            <Text style={st.introSubtitle}>
              El IRS requiere verificación de identidad para presentar tu declaración electrónicamente. 
              Este proceso es seguro y tus datos están protegidos.
            </Text>

            {/* Steps Preview */}
            <View style={st.stepsPreview}>
              <View style={st.stepPreviewItem}>
                <View style={[st.stepPreviewIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="card" size={24} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.stepPreviewTitle}>1. Foto de tu ID</Text>
                  <Text style={st.stepPreviewDesc}>Licencia, pasaporte o ID estatal</Text>
                </View>
              </View>
              <View style={st.stepPreviewItem}>
                <View style={[st.stepPreviewIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="person" size={24} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.stepPreviewTitle}>2. Selfie</Text>
                  <Text style={st.stepPreviewDesc}>Para confirmar que eres tú</Text>
                </View>
              </View>
              <View style={st.stepPreviewItem}>
                <View style={[st.stepPreviewIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="checkmark-circle" size={24} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.stepPreviewTitle}>3. Revisión</Text>
                  <Text style={st.stepPreviewDesc}>Nuestro equipo verifica en horas</Text>
                </View>
              </View>
            </View>

            {/* ID Type Selection */}
            <Text style={st.sectionLabel}>Selecciona tu tipo de ID</Text>
            {ID_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                style={[st.idTypeCard, idType === type.value && st.idTypeCardActive]}
                onPress={() => setIdType(type.value)}
              >
                <Ionicons name={type.icon as any} size={24} color={idType === type.value ? '#4F46E5' : '#9CA3AF'} />
                <Text style={[st.idTypeLabel, idType === type.value && st.idTypeLabelActive]}>{type.label}</Text>
                {idType === type.value && <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={st.primaryBtn} onPress={() => setStep('id_capture')}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={st.primaryBtnGradient}>
              <Ionicons name="camera" size={20} color="#FFF" />
              <Text style={st.primaryBtnText}>Comenzar verificación</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ID CAPTURE STEP
  if (step === 'id_capture') {
    return (
      <SafeAreaView style={st.container}>
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
          <TouchableOpacity style={st.backBtn} onPress={() => setStep('intro')}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>

          <View style={st.captureSection}>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: '33%' }]} />
            </View>
            <Text style={st.captureTitle}>Paso 1: Foto de tu ID</Text>
            <Text style={st.captureDesc}>
              Toma una foto clara de tu {ID_TYPES.find(t => t.value === idType)?.label || 'identificación'}. 
              Asegúrate de que todos los datos sean legibles.
            </Text>

            {/* Tips */}
            <View style={st.tipBox}>
              <Ionicons name="bulb-outline" size={20} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={st.tipTitle}>Consejos para una buena foto:</Text>
                <Text style={st.tipText}>• Buena iluminación, sin reflejos</Text>
                <Text style={st.tipText}>• Toda la ID visible, sin dedos tapando</Text>
                <Text style={st.tipText}>• Fondo oscuro o uniforme</Text>
              </View>
            </View>

            {/* Preview */}
            {idPhoto && (
              <View style={st.previewBox}>
                <Image source={{ uri: idPhoto }} style={st.previewImageID} resizeMode="contain" />
                <TouchableOpacity style={st.retakeBtn} onPress={() => setIdPhoto(null)}>
                  <Ionicons name="refresh" size={16} color="#EF4444" />
                  <Text style={st.retakeBtnText}>Volver a tomar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Capture Buttons */}
            {!idPhoto && (
              <View style={st.captureButtons}>
                <TouchableOpacity style={st.captureBtn} onPress={() => captureFromCamera('id')}>
                  <LinearGradient colors={['#3B82F6', '#2563EB']} style={st.captureBtnGradient}>
                    <Ionicons name="camera" size={32} color="#FFF" />
                    <Text style={st.captureBtnText}>Tomar foto</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={st.galleryBtn} onPress={() => pickFromGallery('id')}>
                  <Ionicons name="images-outline" size={24} color="#3B82F6" />
                  <Text style={st.galleryBtnText}>Seleccionar de galería</Text>
                </TouchableOpacity>
              </View>
            )}

            {idPhoto && (
              <TouchableOpacity style={st.primaryBtn} onPress={() => setStep('selfie_capture')}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={st.primaryBtnGradient}>
                  <Text style={st.primaryBtnText}>Continuar al selfie</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // SELFIE CAPTURE STEP
  if (step === 'selfie_capture') {
    return (
      <SafeAreaView style={st.container}>
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
          <TouchableOpacity style={st.backBtn} onPress={() => setStep('id_capture')}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>

          <View style={st.captureSection}>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: '66%' }]} />
            </View>
            <Text style={st.captureTitle}>Paso 2: Selfie</Text>
            <Text style={st.captureDesc}>
              Toma un selfie claro con buena iluminación. Tu rostro debe ser claramente visible.
            </Text>

            <View style={st.tipBox}>
              <Ionicons name="bulb-outline" size={20} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={st.tipTitle}>Para un buen selfie:</Text>
                <Text style={st.tipText}>• Mira directamente a la cámara</Text>
                <Text style={st.tipText}>• Sin gafas de sol ni gorras</Text>
                <Text style={st.tipText}>• Buena iluminación frontal</Text>
              </View>
            </View>

            {selfiePhoto && (
              <View style={st.previewBox}>
                <Image source={{ uri: selfiePhoto }} style={st.previewImageSelfie} resizeMode="cover" />
                <TouchableOpacity style={st.retakeBtn} onPress={() => setSelfiePhoto(null)}>
                  <Ionicons name="refresh" size={16} color="#EF4444" />
                  <Text style={st.retakeBtnText}>Volver a tomar</Text>
                </TouchableOpacity>
              </View>
            )}

            {!selfiePhoto && (
              <View style={st.captureButtons}>
                <TouchableOpacity style={st.captureBtn} onPress={() => captureFromCamera('selfie')}>
                  <LinearGradient colors={['#F59E0B', '#D97706']} style={st.captureBtnGradient}>
                    <Ionicons name="person" size={32} color="#FFF" />
                    <Text style={st.captureBtnText}>Tomar selfie</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={st.galleryBtn} onPress={() => pickFromGallery('selfie')}>
                  <Ionicons name="images-outline" size={24} color="#D97706" />
                  <Text style={st.galleryBtnText}>Seleccionar de galería</Text>
                </TouchableOpacity>
              </View>
            )}

            {selfiePhoto && (
              <TouchableOpacity style={st.primaryBtn} onPress={() => setStep('review')}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={st.primaryBtnGradient}>
                  <Text style={st.primaryBtnText}>Revisar y enviar</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // REVIEW STEP
  if (step === 'review') {
    return (
      <SafeAreaView style={st.container}>
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}>
          <TouchableOpacity style={st.backBtn} onPress={() => setStep('selfie_capture')}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>

          <View style={st.captureSection}>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: '90%' }]} />
            </View>
            <Text style={st.captureTitle}>Revisa tus fotos</Text>
            <Text style={st.captureDesc}>
              Asegúrate de que ambas fotos sean claras y legibles antes de enviarlas.
            </Text>

            {/* ID Preview */}
            <View style={st.reviewCard}>
              <Text style={st.reviewLabel}>
                <Ionicons name="card" size={16} color="#4F46E5" /> {ID_TYPES.find(t => t.value === idType)?.label}
              </Text>
              {idPhoto && <Image source={{ uri: idPhoto }} style={st.reviewImageID} resizeMode="contain" />}
              <TouchableOpacity onPress={() => setStep('id_capture')}>
                <Text style={st.changeLink}>Cambiar foto</Text>
              </TouchableOpacity>
            </View>

            {/* Selfie Preview */}
            <View style={st.reviewCard}>
              <Text style={st.reviewLabel}>
                <Ionicons name="person" size={16} color="#D97706" /> Selfie
              </Text>
              {selfiePhoto && <Image source={{ uri: selfiePhoto }} style={st.reviewImageSelfie} resizeMode="cover" />}
              <TouchableOpacity onPress={() => setStep('selfie_capture')}>
                <Text style={st.changeLink}>Cambiar foto</Text>
              </TouchableOpacity>
            </View>

            {/* Security Note */}
            <View style={st.securityNote}>
              <Ionicons name="lock-closed" size={18} color="#059669" />
              <Text style={st.securityText}>
                Tus fotos son encriptadas y solo se usan para verificar tu identidad con el IRS. 
                Serán eliminadas después de la verificación.
              </Text>
            </View>

            <TouchableOpacity
              style={st.primaryBtn}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <LinearGradient colors={['#059669', '#10B981']} style={st.primaryBtnGradient}>
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                    <Text style={st.primaryBtnText}>Enviar verificación</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // SUBMITTED STEP
  return (
    <SafeAreaView style={st.container}>
      <View style={st.submittedSection}>
        <LinearGradient colors={['#059669', '#10B981']} style={st.submittedIcon}>
          <Ionicons name="checkmark-circle" size={64} color="#FFF" />
        </LinearGradient>
        <Text style={st.submittedTitle}>¡Verificación enviada!</Text>
        <Text style={st.submittedDesc}>
          Tu identidad está siendo verificada por nuestro equipo. 
          Este proceso generalmente toma entre 1-24 horas.
        </Text>
        <Text style={st.submittedNote}>
          Te notificaremos cuando tu verificación sea aprobada para que puedas continuar con tu declaración.
        </Text>

        <TouchableOpacity style={st.primaryBtn} onPress={handleContinue}>
          <LinearGradient colors={['#3B82F6', '#2563EB']} style={st.primaryBtnGradient}>
            <Text style={st.primaryBtnText}>{t('wizard.continue')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={st.secondaryBtn} onPress={() => router.push('/(tabs)/taxes')}>
          <Text style={st.secondaryBtnText}>Volver a Mis Impuestos</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // Back
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },

  // Intro
  introSection: { alignItems: 'center' },
  introIcon: { width: 100, height: 100, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  introTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 12, textAlign: 'center' },
  introSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 10 },

  // Steps Preview
  stepsPreview: { width: '100%', marginBottom: 28 },
  stepPreviewItem: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16, backgroundColor: '#FFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  stepPreviewIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepPreviewTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  stepPreviewDesc: { fontSize: 13, color: '#6B7280' },

  // ID Type
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', alignSelf: 'flex-start', marginBottom: 10 },
  idTypeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', backgroundColor: '#FFF', padding: 16, borderRadius: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#E5E7EB' },
  idTypeCardActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  idTypeLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#6B7280' },
  idTypeLabelActive: { color: '#4F46E5' },

  // Capture
  captureSection: { alignItems: 'center' },
  progressBar: { width: '100%', height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 24, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 3 },
  captureTitle: { fontSize: 22, fontWeight: '800', color: '#1F2937', marginBottom: 8, textAlign: 'center' },
  captureDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 20, paddingHorizontal: 10 },

  // Tips
  tipBox: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, marginBottom: 24, width: '100%', borderWidth: 1, borderColor: '#FDE68A' },
  tipTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  tipText: { fontSize: 12, color: '#78350F', lineHeight: 18 },

  // Preview
  previewBox: { width: '100%', alignItems: 'center', marginBottom: 20 },
  previewImageID: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#F3F4F6', marginBottom: 12 },
  previewImageSelfie: { width: 200, height: 200, borderRadius: 100, backgroundColor: '#F3F4F6', marginBottom: 12 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16 },
  retakeBtnText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },

  // Capture Buttons
  captureButtons: { width: '100%', gap: 12 },
  captureBtn: { borderRadius: 20, overflow: 'hidden' },
  captureBtnGradient: { alignItems: 'center', paddingVertical: 30, gap: 10, borderRadius: 20 },
  captureBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  galleryBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },

  // Review
  reviewCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center' },
  reviewLabel: { fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 12, alignSelf: 'flex-start' },
  reviewImageID: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F3F4F6', marginBottom: 8 },
  reviewImageSelfie: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#F3F4F6', marginBottom: 8 },
  changeLink: { fontSize: 13, fontWeight: '600', color: '#3B82F6', paddingVertical: 4 },

  // Security
  securityNote: { flexDirection: 'row', gap: 10, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 14, marginBottom: 20, width: '100%', borderWidth: 1, borderColor: '#A7F3D0' },
  securityText: { flex: 1, fontSize: 12, color: '#065F46', lineHeight: 18 },

  // Buttons
  primaryBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 10 },
  primaryBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  secondaryBtn: { marginTop: 12, paddingVertical: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280', textAlign: 'center' },

  // Submitted
  submittedSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  submittedIcon: { width: 120, height: 120, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  submittedTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 12, textAlign: 'center' },
  submittedDesc: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  submittedNote: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 28 },
});
