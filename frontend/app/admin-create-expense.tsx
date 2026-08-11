import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { apiCall, getToken } from '../src/utils/api';
import { Config } from '../src/constants/config';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

interface Property {
  _id: string;
  name: string;
  address: string;
}

const EXPENSE_CATEGORIES = [
  { value: 'maintenance', label: 'Mantenimiento', icon: 'construct' },
  { value: 'utilities', label: 'Servicios', icon: 'flash' },
  { value: 'taxes', label: 'Impuestos', icon: 'document-text' },
  { value: 'insurance', label: 'Seguro', icon: 'shield-checkmark' },
  { value: 'repair', label: 'Reparaciones', icon: 'hammer' },
  { value: 'management', label: 'Administración', icon: 'briefcase' },
  { value: 'supplies', label: 'Suministros', icon: 'cube' },
  { value: 'legal', label: 'Legal', icon: 'document' },
  { value: 'other', label: 'Otro', icon: 'ellipsis-horizontal' },
];

const IRS_CATEGORIES = [
  { value: '', label: 'Sin clasificar' },
  { value: 'advertising', label: 'Advertising (L5)' },
  { value: 'auto_travel', label: 'Auto/Travel (L6)' },
  { value: 'cleaning_maintenance', label: 'Cleaning/Maint. (L7)' },
  { value: 'commissions', label: 'Commissions (L8)' },
  { value: 'insurance', label: 'Insurance (L9)' },
  { value: 'legal_professional', label: 'Legal/Prof. (L10)' },
  { value: 'management_fees', label: 'Management (L11)' },
  { value: 'mortgage_interest', label: 'Mortgage Int. (L12)' },
  { value: 'other_interest', label: 'Other Int. (L13)' },
  { value: 'repairs', label: 'Repairs (L14)' },
  { value: 'supplies', label: 'Supplies (L15)' },
  { value: 'taxes', label: 'Taxes (L16)' },
  { value: 'utilities', label: 'Utilities (L17)' },
  { value: 'other', label: 'Other (L19)' },
];

export default function AdminCreateExpenseScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);

  // Form fields
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [category, setCategory] = useState('maintenance');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [receiptImages, setReceiptImages] = useState<string[]>([]);
  const [irsCategory, setIrsCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [receiptId, setReceiptId] = useState('');

  // AI Scanner
  const [scanning, setScanning] = useState(false);
  const [aiMeta, setAiMeta] = useState<{ confidence: number; items: string[]; duplicate: any } | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const data = await apiCall('/admin/properties');
      setProperties(data.properties || data || []);
    } catch (err) {
      console.log('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setReceiptImages([...receiptImages, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar fotos de recibos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setReceiptImages([...receiptImages, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removeImage = (index: number) => {
    setReceiptImages(receiptImages.filter((_, i) => i !== index));
  };

  const scanReceipt = async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        if (!perm.canAskAgain) {
          Alert.alert(
            'Cámara sin permiso',
            'Activa el acceso a la cámara en Ajustes para escanear recibos.',
            [{ text: 'Cancelar', style: 'cancel' }, { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() }],
          );
        } else {
          Alert.alert('Permiso requerido', 'Necesitamos la cámara para tomar la foto del recibo.');
        }
        return;
      }
      result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    }
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setScanning(true);
    setAiMeta(null);
    try {
      const token = await getToken();
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        fd.append('file', new File([blob], 'recibo.jpg', { type: 'image/jpeg' }));
      } else {
        fd.append('file', { uri: asset.uri, name: 'recibo.jpg', type: 'image/jpeg' } as any);
      }
      const r = await fetch(`${Config.API_URL}/api/admin/property-expenses/scan-receipt`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        Alert.alert('No se pudo analizar', d?.detail || 'Intenta con una foto más clara del recibo.');
        setScanning(false);
        return;
      }
      const x = d.extracted;
      setCategory(EXPENSE_CATEGORIES.some(c => c.value === x.category) ? x.category : 'other');
      setIrsCategory(x.irs_category || '');
      setAmount(x.amount ? String(x.amount) : '');
      setDescription(x.description || '');
      setVendor(x.vendor || '');
      setExpenseDate(x.expense_date || '');
      setReceiptId(d.receipt_id || '');
      if (x.property_id) {
        const match = properties.find(p => p._id === x.property_id);
        if (match) setSelectedProperty(match);
      }
      setReceiptImages([asset.uri]);
      setAiMeta({ confidence: x.confidence || 0, items: x.items || [], duplicate: d.possible_duplicate });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo conectar con el servidor');
    }
    setScanning(false);
  };

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Ingresa una descripción');
      return;
    }

    setSubmitting(true);
    try {
      await apiCall('/admin/property-expenses', {
        method: 'POST',
        body: {
          property_id: selectedProperty?._id || '',
          category,
          irs_category: irsCategory,
          amount: parseFloat(amount),
          description: description.trim(),
          vendor: vendor.trim() || null,
          receipt_id: receiptId,
          receipt_images: receiptImages,
          expense_date: expenseDate || new Date().toISOString().split('T')[0],
        },
      });

      Alert.alert('Éxito', 'Gasto registrado correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo registrar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.brandRed} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(245,158,11,0.08)', 'transparent']} style={styles.bgGradient} />
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={[styles.container, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Nuevo Gasto</Text>
              <Text style={styles.headerSubtitle}>Registrar gasto de propiedad</Text>
            </View>
          </View>

          {/* AI Scanner */}
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Ionicons name="sparkles" size={16} color="#A78BFA" />
              <Text style={styles.aiCardTitle}>Escanear Recibo con AI</Text>
            </View>
            <Text style={styles.aiCardSub}>Toma una foto del recibo y la AI llena el formulario y clasifica el gasto automáticamente</Text>
            {scanning ? (
              <View style={styles.aiScanning}>
                <ActivityIndicator color="#A78BFA" />
                <Text style={styles.aiScanningText}>Leyendo el recibo con AI...</Text>
              </View>
            ) : (
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.aiBtn} onPress={() => scanReceipt('camera')}>
                  <Ionicons name="camera" size={20} color="#FFF" />
                  <Text style={styles.aiBtnText}>Tomar Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.aiBtnAlt} onPress={() => scanReceipt('gallery')}>
                  <Ionicons name="images" size={20} color="#A78BFA" />
                  <Text style={styles.aiBtnAltText}>Galería</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {aiMeta && (
            <View style={styles.aiResult}>
              <View style={styles.aiResultRow}>
                <Ionicons name="checkmark-circle" size={16} color={aiMeta.confidence >= 80 ? Colors.success : '#F59E0B'} />
                <Text style={styles.aiResultText}>Datos extraídos ({aiMeta.confidence}% confianza) — revisa y ajusta</Text>
              </View>
              {aiMeta.items.length > 0 && (
                <Text style={styles.aiItemsText} numberOfLines={2}>🛒 {aiMeta.items.join(' · ')}</Text>
              )}
              {aiMeta.duplicate && (
                <View style={styles.dupWarning}>
                  <Ionicons name="warning" size={14} color="#F59E0B" />
                  <Text style={styles.dupWarningText}>
                    Posible duplicado: {aiMeta.duplicate.expense_number} — ${aiMeta.duplicate.amount} ({aiMeta.duplicate.expense_date})
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Property Selector */}
          <Text style={styles.label}>Propiedad</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setShowPropertyPicker(!showPropertyPicker)}
          >
            <Ionicons name="business" size={18} color={Colors.brandRed} />
            <Text style={[styles.selectorText, !selectedProperty && { color: Colors.textMuted }]}>
              {selectedProperty?.name || 'General (sin propiedad)'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {showPropertyPicker && (
            <View style={styles.pickerList}>
              <TouchableOpacity
                style={[styles.pickerItem, !selectedProperty && styles.pickerItemActive]}
                onPress={() => { setSelectedProperty(null); setShowPropertyPicker(false); }}
              >
                <Text style={styles.pickerItemText}>General (sin propiedad)</Text>
              </TouchableOpacity>
              {properties.map((p) => (
                <TouchableOpacity
                  key={p._id}
                  style={[styles.pickerItem, selectedProperty?._id === p._id && styles.pickerItemActive]}
                  onPress={() => { setSelectedProperty(p); setShowPropertyPicker(false); }}
                >
                  <Text style={styles.pickerItemText}>{p.name}</Text>
                  <Text style={styles.pickerItemSub}>{p.address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Category */}
          <Text style={styles.label}>Categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.categoryChip, category === cat.value && styles.categoryChipActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={16}
                  color={category === cat.value ? Colors.white : Colors.textMuted}
                />
                <Text style={[styles.categoryText, category === cat.value && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* IRS Schedule E */}
          <Text style={styles.label}>Categoría IRS (Schedule E)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {IRS_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value || 'none'}
                style={[styles.categoryChip, irsCategory === cat.value && styles.irsChipActive]}
                onPress={() => setIrsCategory(cat.value)}
              >
                <Text style={[styles.categoryText, irsCategory === cat.value && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Amount */}
          <Text style={styles.label}>Monto *</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Vendor */}
          <Text style={styles.label}>Proveedor / Vendedor</Text>
          <TextInput
            style={styles.input}
            value={vendor}
            onChangeText={setVendor}
            placeholder="Nombre del proveedor (opcional)"
            placeholderTextColor={Colors.textMuted}
          />

          {/* Description */}
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe el gasto..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
          />

          {/* Receipt Images */}
          <Text style={styles.label}>Recibos / Fotos</Text>
          <View style={styles.imageSection}>
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color={Colors.brandRed} />
                <Text style={styles.imageBtnText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                <Ionicons name="images" size={20} color={Colors.brandRed} />
                <Text style={styles.imageBtnText}>Galería</Text>
              </TouchableOpacity>
            </View>

            {receiptImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewRow}>
                {receiptImages.map((img, idx) => (
                  <View key={idx} style={styles.imagePreview}>
                    <Image source={{ uri: img }} style={styles.previewImg} />
                    <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={24} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                <Text style={styles.submitText}>Registrar Gasto</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: Spacing.md },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  label: {
    fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textSecondary,
    marginTop: Spacing.md, marginBottom: 8,
  },

  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.glass, padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  selectorText: { flex: 1, fontSize: FontSizes.sm, color: Colors.textPrimary },

  pickerList: {
    backgroundColor: Colors.glassLight, borderRadius: BorderRadius.md,
    marginTop: 8, overflow: 'hidden',
  },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.glassLight },
  pickerItemActive: { backgroundColor: 'rgba(200,16,46,0.15)' },
  pickerItemText: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '600' },
  pickerItemSub: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },

  categoryRow: { marginBottom: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
    backgroundColor: Colors.glassLight, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  categoryChipActive: { backgroundColor: Colors.brandRed, borderColor: Colors.brandRed },
  categoryText: { fontSize: FontSizes.xs, color: Colors.textMuted, fontWeight: '600' },
  categoryTextActive: { color: Colors.textPrimary },
  irsChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },

  aiCard: {
    marginTop: Spacing.md, padding: 14, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(124,58,237,0.10)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiCardTitle: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.textPrimary },
  aiCardSub: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 4, marginBottom: 12 },
  aiBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#7C3AED', padding: 13, borderRadius: BorderRadius.md,
  },
  aiBtnText: { fontSize: FontSizes.sm, color: Colors.textPrimary, fontWeight: '700' },
  aiBtnAlt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(124,58,237,0.15)', padding: 13, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)',
  },
  aiBtnAltText: { fontSize: FontSizes.sm, color: '#A78BFA', fontWeight: '700' },
  aiScanning: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  aiScanningText: { fontSize: FontSizes.sm, color: '#A78BFA', fontWeight: '600' },

  aiResult: {
    marginTop: 10, padding: 12, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  aiResultRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiResultText: { flex: 1, fontSize: FontSizes.xs, color: Colors.textPrimary, fontWeight: '600' },
  aiItemsText: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 6 },
  dupWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    padding: 8, borderRadius: 8, backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  dupWarningText: { flex: 1, fontSize: FontSizes.xs, color: '#F59E0B', fontWeight: '600' },


  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.glass, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  currencySymbol: {
    fontSize: FontSizes.xl, fontWeight: '700', color: Colors.success,
    paddingLeft: 14,
  },
  amountInput: {
    flex: 1, fontSize: FontSizes.xl, fontWeight: '700', color: Colors.textPrimary,
    padding: 14,
  },

  input: {
    backgroundColor: Colors.glass, padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.glassBorderLight,
    fontSize: FontSizes.sm, color: Colors.textPrimary,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  imageSection: { marginTop: 8 },
  imageActions: { flexDirection: 'row', gap: 12 },
  imageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(200,16,46,0.1)', padding: 14,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(200,16,46,0.3)',
  },
  imageBtnText: { fontSize: FontSizes.sm, color: Colors.brandRed, fontWeight: '600' },

  imagePreviewRow: { marginTop: 12 },
  imagePreview: { marginRight: 12, position: 'relative' },
  previewImg: { width: 100, height: 100, borderRadius: 8 },
  removeImgBtn: { position: 'absolute', top: -8, right: -8 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.brandRed, padding: 16, borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  submitText: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
});
