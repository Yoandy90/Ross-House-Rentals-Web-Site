/**
 * Business Receipt Upload - Scan & Upload receipts with AI classification
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

export default function BusinessReceiptUploadScreen() {
  const { i18n: i18nInstance } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isES = i18nInstance.language === 'es';

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [uploaded, setUploaded] = useState(false);

  // Editable fields
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  const categories = [
    { id: 'office_expense', label: isES ? 'Oficina' : 'Office' },
    { id: 'supplies', label: isES ? 'Suministros' : 'Supplies' },
    { id: 'meals', label: isES ? 'Comidas' : 'Meals' },
    { id: 'car_expenses', label: isES ? 'Vehículo' : 'Car' },
    { id: 'utilities', label: isES ? 'Servicios' : 'Utilities' },
    { id: 'rent_lease', label: isES ? 'Alquiler' : 'Rent' },
    { id: 'travel', label: isES ? 'Viajes' : 'Travel' },
    { id: 'insurance', label: isES ? 'Seguros' : 'Insurance' },
    { id: 'repairs', label: isES ? 'Reparaciones' : 'Repairs' },
    { id: 'advertising', label: isES ? 'Publicidad' : 'Advertising' },
    { id: 'contract_labor', label: isES ? 'Contratistas' : 'Contractors' },
    { id: 'cogs', label: isES ? 'Costo de Ventas' : 'COGS' },
    { id: 'other_expense', label: isES ? 'Otros' : 'Other' },
  ];

  const pickImage = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          isES ? 'Permiso requerido' : 'Permission needed',
          isES ? 'Necesitamos acceso para tomar fotos.' : 'We need access to take photos.'
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: true,
            allowsEditing: true,
          });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImageBase64(asset.base64 || null);
        setImageUri(asset.uri);
        setAiResult(null);
        setUploaded(false);

        // Auto-analyze with AI
        if (asset.base64) {
          setAnalyzing(true);
          try {
            const res = await api.post('/my-business/receipts', {
              image_base64: asset.base64,
            });
            if (res.data.success) {
              const ai = res.data.ai_result;
              setAiResult(ai);
              if (ai.merchant) setMerchant(ai.merchant);
              if (ai.amount) setAmount(String(ai.amount));
              if (ai.category) {
                // Map AI category to our IRS category
                const mapped = mapAICategory(ai.category);
                setCategory(mapped);
              }
              setUploaded(true);
            }
          } catch (err) {
            console.error('AI analysis error:', err);
          } finally {
            setAnalyzing(false);
          }
        }
      }
    } catch (err) {
      console.error('Image picker error:', err);
    }
  };

  const mapAICategory = (aiCat: string): string => {
    const lower = (aiCat || '').toLowerCase();
    if (lower.includes('comida') || lower.includes('restaur') || lower.includes('meal')) return 'meals';
    if (lower.includes('oficina') || lower.includes('office')) return 'office_expense';
    if (lower.includes('transport') || lower.includes('gas') || lower.includes('vehíc') || lower.includes('car')) return 'car_expenses';
    if (lower.includes('utilid') || lower.includes('utilit') || lower.includes('servicio')) return 'utilities';
    if (lower.includes('viaje') || lower.includes('travel')) return 'travel';
    if (lower.includes('suministro') || lower.includes('suppli')) return 'supplies';
    if (lower.includes('alquiler') || lower.includes('rent')) return 'rent_lease';
    if (lower.includes('seguro') || lower.includes('insur')) return 'insurance';
    if (lower.includes('reparac') || lower.includes('repair')) return 'repairs';
    if (lower.includes('negocio') || lower.includes('business')) return 'other_expense';
    return 'other_expense';
  };

  const handleUpload = async () => {
    if (!imageBase64) {
      Alert.alert(isES ? 'Error' : 'Error', isES ? 'Toma una foto primero' : 'Take a photo first');
      return;
    }

    if (uploaded) {
      // Already uploaded during AI analysis, show success
      Alert.alert(
        isES ? '✅ Recibo Guardado' : '✅ Receipt Saved',
        isES ? 'Tu recibo ha sido subido exitosamente.' : 'Your receipt has been uploaded successfully.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    setUploading(true);
    try {
      const res = await api.post('/my-business/receipts', {
        image_base64: imageBase64,
        merchant,
        amount: amount ? parseFloat(amount) : undefined,
        category: category || undefined,
        notes,
      });

      if (res.data.success) {
        Alert.alert(
          isES ? '✅ Recibo Guardado' : '✅ Receipt Saved',
          isES ? 'Tu recibo ha sido subido y clasificado.' : 'Your receipt has been uploaded and classified.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#1E40AF', '#3B82F6']} style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isES ? 'Escanear Recibo' : 'Scan Receipt'}</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Image Preview or Camera Buttons */}
          {!imageUri ? (
            <View style={styles.cameraSection}>
              <View style={styles.cameraPlaceholder}>
                <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
                <Text style={styles.cameraPlaceholderText}>
                  {isES ? 'Toma una foto de tu recibo' : 'Take a photo of your receipt'}
                </Text>
              </View>
              <View style={styles.cameraButtons}>
                <TouchableOpacity style={styles.cameraBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={styles.cameraBtnText}>{isES ? 'Cámara' : 'Camera'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cameraBtn, styles.galleryBtn]} onPress={() => pickImage(false)}>
                  <Ionicons name="images" size={28} color="#fff" />
                  <Text style={styles.cameraBtnText}>{isES ? 'Galería' : 'Gallery'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewSection}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                  setAiResult(null);
                  setUploaded(false);
                  setMerchant('');
                  setAmount('');
                  setCategory('');
                }}
              >
                <Ionicons name="refresh" size={18} color="#3B82F6" />
                <Text style={styles.retakeText}>{isES ? 'Cambiar foto' : 'Change photo'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* AI Analysis Status */}
          {analyzing && (
            <View style={styles.aiCard}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.aiText}>{isES ? 'Analizando recibo con AI...' : 'Analyzing receipt with AI...'}</Text>
            </View>
          )}

          {aiResult && (
            <View style={[styles.aiCard, { backgroundColor: aiResult.classified ? '#ECFDF5' : '#FEF3C7' }]}>
              <Ionicons
                name={aiResult.classified ? 'checkmark-circle' : 'warning'}
                size={20}
                color={aiResult.classified ? '#10B981' : '#F59E0B'}
              />
              <Text style={styles.aiText}>
                {aiResult.classified
                  ? `AI: ${aiResult.merchant || '?'} - $${aiResult.amount || '?'} (${Math.round((aiResult.confidence || 0) * 100)}%)`
                  : isES ? 'No se pudo clasificar automáticamente' : 'Could not auto-classify'}
              </Text>
            </View>
          )}

          {/* Editable Fields */}
          {imageUri && (
            <View style={styles.fieldsSection}>
              <Text style={styles.fieldLabel}>{isES ? 'Comercio' : 'Merchant'}</Text>
              <TextInput
                style={styles.input}
                value={merchant}
                onChangeText={setMerchant}
                placeholder={isES ? 'Nombre del comercio' : 'Business name'}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>{isES ? 'Monto' : 'Amount'}</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>{isES ? 'Categoría IRS' : 'IRS Category'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, category === cat.id && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={[styles.categoryChipText, category === cat.id && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>{isES ? 'Notas' : 'Notes'}</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder={isES ? 'Notas opcionales...' : 'Optional notes...'}
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <TouchableOpacity
                style={[styles.uploadBtn, (uploading || uploaded) && styles.uploadBtnDisabled]}
                onPress={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name={uploaded ? 'checkmark-circle' : 'cloud-upload'} size={22} color="#fff" />
                    <Text style={styles.uploadBtnText}>
                      {uploaded
                        ? (isES ? 'Guardado ✓' : 'Saved ✓')
                        : (isES ? 'Guardar Recibo' : 'Save Receipt')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E40AF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 16, paddingHorizontal: 20 },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16 },
  cameraSection: { alignItems: 'center', marginTop: 40 },
  cameraPlaceholder: { alignItems: 'center', marginBottom: 32 },
  cameraPlaceholderText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  cameraButtons: { flexDirection: 'row', gap: 16 },
  cameraBtn: { backgroundColor: '#3B82F6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, gap: 10 },
  galleryBtn: { backgroundColor: '#6366F1' },
  cameraBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  previewSection: { alignItems: 'center', marginBottom: 12 },
  previewImage: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#E5E7EB' },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  retakeText: { color: '#3B82F6', fontWeight: '600' },
  aiCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, marginBottom: 12, gap: 10 },
  aiText: { flex: 1, fontSize: 13, color: '#374151' },
  fieldsSection: { marginTop: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 15, color: '#111827' },
  categoriesScroll: { marginBottom: 4 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  categoryChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  categoryChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  categoryChipTextActive: { color: '#fff' },
  uploadBtn: { backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 14, marginTop: 20, gap: 10 },
  uploadBtnDisabled: { backgroundColor: '#6EE7B7' },
  uploadBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
