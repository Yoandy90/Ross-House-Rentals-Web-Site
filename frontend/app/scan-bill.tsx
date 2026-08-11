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
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { apiCall } from '../src/utils/api';
import { Spacing, FontSizes, BorderRadius, Shadows, useColors } from '../src/constants/theme';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  electricity: { icon: 'flash', color: '#F59E0B', label: 'Electricidad' },
  gas: { icon: 'flame', color: '#EF4444', label: 'Gas' },
  water: { icon: 'water', color: '#3B82F6', label: 'Agua' },
  internet: { icon: 'wifi', color: '#8B5CF6', label: 'Internet' },
  phone: { icon: 'call', color: '#06B6D4', label: 'Teléfono' },
  tv: { icon: 'tv', color: '#6366F1', label: 'TV' },
  other: { icon: 'document-text', color: '#6B7280', label: 'Otro' },
};

interface ExtractedData {
  provider_name?: string;
  provider_type?: string;
  account_number?: string;
  amount_due?: number;
  due_date?: string;
  billing_period?: string;
  usage_kwh?: number | null;
  usage_therms?: number | null;
  usage_gallons?: number | null;
  customer_name?: string;
  service_address?: string;
  confidence?: string;
}

export default function ScanBillScreen() {
  const C = useColors();
  const styles = React.useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'capture' | 'review' | 'saved'>('capture');

  // Editable fields
  const [editAmount, setEditAmount] = useState('');
  const [editAccount, setEditAccount] = useState('');
  const [editPeriod, setEditPeriod] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [markPaid, setMarkPaid] = useState(false);

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para escanear recibos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería para seleccionar recibos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          base64: true,
          allowsEditing: false,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);

        if (asset.base64) {
          await scanBill(asset.base64);
        }
      }
    } catch (err) {
      console.log('Image pick error:', err);
      Alert.alert('Error', 'No se pudo obtener la imagen.');
    }
  };

  const scanBill = async (base64: string) => {
    setScanning(true);
    try {
      const res = await apiCall('/tenant/utilities/scan', {
        method: 'POST',
        body: { image_base64: base64 },
      });

      if (res.success && res.extracted_data) {
        const data = res.extracted_data;
        setExtracted(data);
        setEditAmount(data.amount_due?.toString() || '');
        setEditAccount(data.account_number || '');
        setEditPeriod(data.billing_period || '');
        setStep('review');
      } else {
        Alert.alert(
          'No se pudo extraer',
          res.message || 'Intenta con una foto más clara del recibo.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      console.log('Scan error:', err);
      Alert.alert('Error', err.message || 'Error al analizar la imagen.');
    } finally {
      setScanning(false);
    }
  };

  const saveRecord = async () => {
    if (!extracted) return;
    setSaving(true);

    // Find provider_id from the list
    const providerType = extracted.provider_type || 'other';
    const config = TYPE_CONFIG[providerType] || TYPE_CONFIG.other;

    try {
      const res = await apiCall('/tenant/utilities', {
        method: 'POST',
        body: {
          provider_id: providerType,
          provider_name: extracted.provider_name || config.label,
          provider_type: providerType,
          account_number: editAccount,
          amount: parseFloat(editAmount) || 0,
          period: editPeriod || new Date().toISOString().slice(0, 7),
          due_date: extracted.due_date || '',
          paid: markPaid,
          notes: editNotes,
          extracted_data: extracted,
        },
      });

      if (res.success) {
        setStep('saved');
      } else {
        Alert.alert('Error', 'No se pudo guardar el registro.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const config = extracted?.provider_type
    ? (TYPE_CONFIG[extracted.provider_type] || TYPE_CONFIG.other)
    : TYPE_CONFIG.other;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        <View style={styles.bgGlow1} />

        <ScrollView
          style={[styles.container, { paddingTop: insets.top }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={C.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 'capture' ? 'Escanear Recibo' : step === 'review' ? 'Verificar Datos' : 'Guardado'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* ═══ STEP 1: CAPTURE ═══ */}
          {step === 'capture' && (
            <View style={styles.captureSection}>
              {imageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
                  {scanning && (
                    <View style={styles.scanOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.scanOverlayText}>Analizando recibo con AI...</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.captureBox}>
                  <View style={styles.captureIconWrap}>
                    <Ionicons name="receipt-outline" size={64} color={C.textDim} />
                  </View>
                  <Text style={styles.captureTitle}>Escanea tu recibo</Text>
                  <Text style={styles.captureDesc}>
                    Toma una foto o selecciona de tu galería. La IA extraerá automáticamente el proveedor, monto y período.
                  </Text>
                </View>
              )}

              <View style={styles.captureActions}>
                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={() => pickImage('camera')}
                  activeOpacity={0.7}
                  disabled={scanning}
                >
                  <LinearGradient
                    colors={[C.brandRed, '#9B1B30']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Ionicons name="camera" size={22} color="#fff" />
                  <Text style={styles.captureBtnText}>Tomar Foto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.captureBtn2}
                  onPress={() => pickImage('library')}
                  activeOpacity={0.7}
                  disabled={scanning}
                >
                  <Ionicons name="images" size={22} color={C.brandRed} />
                  <Text style={styles.captureBtn2Text}>Galería</Text>
                </TouchableOpacity>
              </View>

              {imageUri && !scanning && (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => { setImageUri(null); setImageBase64(null); setExtracted(null); }}
                >
                  <Ionicons name="refresh" size={16} color={C.textMuted} />
                  <Text style={styles.retryBtnText}>Tomar otra foto</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ═══ STEP 2: REVIEW ═══ */}
          {step === 'review' && extracted && (
            <View style={styles.reviewSection}>
              {/* Detected Provider */}
              <View style={styles.detectedCard}>
                <LinearGradient
                  colors={[`${config.color}12`, `${config.color}04`]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.detectedIcon, { backgroundColor: `${config.color}20` }]}>
                  <Ionicons name={config.icon as any} size={28} color={config.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detectedProvider}>{extracted.provider_name || 'Proveedor'}</Text>
                  <Text style={styles.detectedType}>{config.label}</Text>
                </View>
                {extracted.confidence && (
                  <View style={[
                    styles.confidenceBadge,
                    { backgroundColor: extracted.confidence === 'high' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }
                  ]}>
                    <Text style={[
                      styles.confidenceText,
                      { color: extracted.confidence === 'high' ? C.success : C.warning }
                    ]}>
                      {extracted.confidence === 'high' ? 'Alta' : extracted.confidence === 'medium' ? 'Media' : 'Baja'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Editable Fields */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Monto a Pagar</Text>
                <View style={styles.fieldInputWrap}>
                  <Text style={styles.fieldPrefix}>$</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={C.textDim}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>No. de Cuenta</Text>
                <TextInput
                  style={styles.fieldInputFull}
                  value={editAccount}
                  onChangeText={setEditAccount}
                  placeholder="Número de cuenta"
                  placeholderTextColor={C.textDim}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Período</Text>
                <TextInput
                  style={styles.fieldInputFull}
                  value={editPeriod}
                  onChangeText={setEditPeriod}
                  placeholder="YYYY-MM"
                  placeholderTextColor={C.textDim}
                />
              </View>

              {extracted.due_date && (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={C.textMuted} />
                  <Text style={styles.infoText}>Vence: {extracted.due_date}</Text>
                </View>
              )}

              {extracted.service_address && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={16} color={C.textMuted} />
                  <Text style={styles.infoText}>{extracted.service_address}</Text>
                </View>
              )}

              {(extracted.usage_kwh || extracted.usage_therms || extracted.usage_gallons) && (
                <View style={styles.usageCard}>
                  <Text style={styles.usageTitle}>Consumo Detectado</Text>
                  {extracted.usage_kwh && (
                    <Text style={styles.usageValue}>{extracted.usage_kwh} kWh</Text>
                  )}
                  {extracted.usage_therms && (
                    <Text style={styles.usageValue}>{extracted.usage_therms} Therms</Text>
                  )}
                  {extracted.usage_gallons && (
                    <Text style={styles.usageValue}>{extracted.usage_gallons} Galones</Text>
                  )}
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Notas (opcional)</Text>
                <TextInput
                  style={[styles.fieldInputFull, { height: 60, textAlignVertical: 'top' }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Agrega una nota..."
                  placeholderTextColor={C.textDim}
                  multiline
                />
              </View>

              {/* Paid Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setMarkPaid(!markPaid)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={markPaid ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={markPaid ? C.success : C.textMuted}
                />
                <Text style={styles.toggleText}>Marcar como pagado</Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.reviewActions}>
                <TouchableOpacity
                  style={styles.reviewBackBtn}
                  onPress={() => { setStep('capture'); setExtracted(null); setImageUri(null); }}
                >
                  <Text style={styles.reviewBackBtnText}>Volver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveRecord}
                  disabled={saving || !editAmount}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={[C.brandRed, '#9B1B30']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>Guardar</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ═══ STEP 3: SAVED ═══ */}
          {step === 'saved' && (
            <View style={styles.savedSection}>
              <View style={styles.savedIconWrap}>
                <Ionicons name="checkmark-circle" size={72} color={C.success} />
              </View>
              <Text style={styles.savedTitle}>¡Registro Guardado!</Text>
              <Text style={styles.savedDesc}>
                Tu factura de {extracted?.provider_name || 'servicio'} por ${editAmount} ha sido registrada exitosamente.
              </Text>

              <View style={styles.savedActions}>
                <TouchableOpacity
                  style={styles.savedBtn}
                  onPress={() => {
                    setStep('capture');
                    setImageUri(null);
                    setImageBase64(null);
                    setExtracted(null);
                    setEditAmount('');
                    setEditAccount('');
                    setEditPeriod('');
                    setEditNotes('');
                    setMarkPaid(false);
                  }}
                >
                  <Ionicons name="camera" size={18} color={C.brandRed} />
                  <Text style={styles.savedBtnText}>Escanear Otro</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.savedBtnPrimary}
                  onPress={() => router.replace('/services')}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={[C.brandRed, '#9B1B30']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Ionicons name="list" size={18} color="#fff" />
                  <Text style={styles.savedBtnPrimaryText}>Ver Mis Servicios</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.base },
  bgGlow1: {
    position: 'absolute', top: -60, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.brandRed, opacity: 0.05,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.base,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.glassLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', color: C.textPrimary },

  // Capture
  captureSection: { paddingTop: 10 },
  captureBox: {
    alignItems: 'center', paddingVertical: 50,
    backgroundColor: C.glass,
    borderRadius: BorderRadius.lg, borderWidth: 2,
    borderColor: C.glassBorder, borderStyle: 'dashed',
    marginBottom: 20,
  },
  captureIconWrap: {
    width: 100, height: 100, borderRadius: 30,
    backgroundColor: C.glass,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  captureTitle: { fontSize: FontSizes.xl, fontWeight: '700', color: C.textPrimary },
  captureDesc: {
    fontSize: FontSizes.sm, color: C.textMuted, textAlign: 'center',
    marginTop: 8, maxWidth: 280, lineHeight: 20,
  },
  previewWrap: {
    borderRadius: BorderRadius.lg, overflow: 'hidden',
    marginBottom: 16, position: 'relative',
    backgroundColor: C.glass,
  },
  preview: { width: '100%', height: 280, borderRadius: BorderRadius.lg },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  scanOverlayText: { color: '#fff', fontSize: FontSizes.base, fontWeight: '600', marginTop: 12 },

  captureActions: { flexDirection: 'row', gap: 12 },
  captureBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14, overflow: 'hidden',
    ...Shadows.button,
  },
  captureBtnText: { color: C.textPrimary, fontWeight: '700', fontSize: FontSizes.base },
  captureBtn2: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(200,16,46,0.10)',
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.25)',
  },
  captureBtn2Text: { color: C.brandRed, fontWeight: '700', fontSize: FontSizes.base },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 16,
  },
  retryBtnText: { color: C.textMuted, fontSize: FontSizes.sm },

  // Review
  reviewSection: { paddingTop: 10 },
  detectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: Spacing.base, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: C.glassBorder,
    overflow: 'hidden', marginBottom: 20,
  },
  detectedIcon: {
    width: 52, height: 52, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  detectedProvider: { fontSize: FontSizes.md, fontWeight: '700', color: C.white },
  detectedType: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 2 },
  confidenceBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  confidenceText: { fontSize: 10, fontWeight: '700' },

  // Fields
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: FontSizes.xs, color: C.textMuted,
    fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 6,
  },
  fieldInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.glass,
    borderRadius: 12, borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 14,
  },
  fieldPrefix: { fontSize: 20, fontWeight: '700', color: C.brandRed, marginRight: 4 },
  fieldInput: {
    flex: 1, height: 52, fontSize: 20, fontWeight: '700',
    color: C.white,
  },
  fieldInputFull: {
    backgroundColor: C.glass,
    borderRadius: 12, borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 14, height: 48,
    fontSize: FontSizes.base, color: C.white,
  },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  infoText: { fontSize: FontSizes.sm, color: C.textSecondary },

  usageCard: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)',
  },
  usageTitle: { fontSize: FontSizes.xs, color: C.info, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  usageValue: { fontSize: FontSizes.lg, fontWeight: '700', color: C.white, marginTop: 4 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, marginBottom: 20,
  },
  toggleText: { fontSize: FontSizes.base, color: C.textPrimary, fontWeight: '500' },

  reviewActions: { flexDirection: 'row', gap: 12 },
  reviewBackBtn: {
    flex: 1, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: C.glassLight,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  reviewBackBtnText: { color: C.textMuted, fontWeight: '600', fontSize: FontSizes.base },
  saveBtn: {
    flex: 2, height: 52, borderRadius: 14,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, overflow: 'hidden',
    ...Shadows.button,
  },
  saveBtnText: { color: C.textPrimary, fontWeight: '700', fontSize: FontSizes.base },

  // Saved
  savedSection: { alignItems: 'center', paddingTop: 60 },
  savedIconWrap: { marginBottom: 20 },
  savedTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: C.textPrimary },
  savedDesc: {
    fontSize: FontSizes.base, color: C.textMuted,
    textAlign: 'center', marginTop: 8, maxWidth: 300, lineHeight: 22,
  },
  savedActions: { flexDirection: 'row', gap: 12, marginTop: 30, width: '100%' },
  savedBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(200,16,46,0.10)',
    borderWidth: 1, borderColor: 'rgba(200,16,46,0.25)',
  },
  savedBtnText: { color: C.brandRed, fontWeight: '700', fontSize: FontSizes.sm },
  savedBtnPrimary: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: 14, overflow: 'hidden',
    ...Shadows.button,
  },
  savedBtnPrimaryText: { color: C.textPrimary, fontWeight: '700', fontSize: FontSizes.sm },
});
