/**
 * Business Receipts — Capture & manage business expense receipts
 * Features: AI receipt scanning with auto-categorization + manual entry + editing
 * Categories: IRS Schedule C deductible expenses
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const C = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', sub: '#636366',
  muted: '#AEAEB2', border: '#E5E5EA', brand: '#8B1A1A',
  success: '#34C759', blue: '#007AFF', orange: '#FF9500',
  ai: '#8B5CF6',
};

const CATEGORIES: { id: string; label: string; labelEn: string; icon: string; color: string }[] = [
  { id: 'office_expense', label: 'Oficina', labelEn: 'Office', icon: 'desktop-outline', color: '#6366f1' },
  { id: 'supplies', label: 'Suministros', labelEn: 'Supplies', icon: 'cube-outline', color: '#8B5CF6' },
  { id: 'meals', label: 'Comidas', labelEn: 'Meals', icon: 'restaurant-outline', color: '#F97316' },
  { id: 'car_expenses', label: 'Vehículo', labelEn: 'Vehicle', icon: 'car-outline', color: '#3B82F6' },
  { id: 'utilities', label: 'Servicios', labelEn: 'Utilities', icon: 'flash-outline', color: '#EAB308' },
  { id: 'rent_lease', label: 'Alquiler', labelEn: 'Rent', icon: 'business-outline', color: '#10B981' },
  { id: 'travel', label: 'Viajes', labelEn: 'Travel', icon: 'airplane-outline', color: '#06B6D4' },
  { id: 'insurance', label: 'Seguros', labelEn: 'Insurance', icon: 'shield-checkmark-outline', color: '#EC4899' },
  { id: 'repairs', label: 'Reparaciones', labelEn: 'Repairs', icon: 'construct-outline', color: '#78716C' },
  { id: 'advertising', label: 'Publicidad', labelEn: 'Advertising', icon: 'megaphone-outline', color: '#F43F5E' },
  { id: 'contract_labor', label: 'Contratistas', labelEn: 'Contractors', icon: 'people-outline', color: '#0EA5E9' },
  { id: 'equipment', label: 'Equipo', labelEn: 'Equipment', icon: 'hardware-chip-outline', color: '#14B8A6' },
  { id: 'phone_internet', label: 'Tel/Internet', labelEn: 'Phone/Internet', icon: 'wifi-outline', color: '#A855F7' },
  { id: 'professional_services', label: 'Profesional', labelEn: 'Professional', icon: 'school-outline', color: '#2563EB' },
  { id: 'other_expense', label: 'Otros', labelEn: 'Other', icon: 'ellipsis-horizontal-circle-outline', color: '#6B7280' },
];

// Map AI classifier categories → business receipt categories
const AI_TO_BIZ_CATEGORY: Record<string, string> = {
  fuel: 'car_expenses', auto_repair: 'car_expenses', medical: 'other_expense',
  home_office: 'office_expense', phone_communication: 'phone_internet',
  business_meals: 'meals', travel: 'travel', education: 'other_expense',
  rent: 'rent_lease', utilities: 'utilities', supplies: 'supplies',
  other: 'other_expense', office_expense: 'office_expense', meals: 'meals',
  car_expenses: 'car_expenses', rent_lease: 'rent_lease', insurance: 'insurance',
  repairs: 'repairs', advertising: 'advertising', contract_labor: 'contract_labor',
  equipment: 'equipment', phone_internet: 'phone_internet',
  professional_services: 'professional_services', other_expense: 'other_expense',
};

const getCatInfo = (id: string) => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Receipt {
  id: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  notes: string;
  tax_deductible: boolean;
}

interface Stats {
  total_receipts: number;
  total_amount: number;
  by_category: { category: string; total: number; count: number }[];
  year: number;
}

export default function BusinessReceiptsScreen() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // AI scanning state
  const [scanning, setScanning] = useState(false);
  const [aiDetected, setAiDetected] = useState(false);
  const [aiConfidence, setAiConfidence] = useState(0);

  const now = new Date();
  const [form, setForm] = useState({
    merchant: '', amount: '', category: 'other_expense',
    date: now.toISOString().split('T')[0], notes: '',
  });

  useEffect(() => { loadAll(); }, [filterCat]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [listRes, statsRes] = await Promise.all([
        api.get(`/business-receipts?category=${filterCat}`),
        api.get('/business-receipts/stats'),
      ]);
      setReceipts(listRes.data?.receipts || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Load biz receipts error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const resetForm = () => {
    setForm({ merchant: '', amount: '', category: 'other_expense', date: now.toISOString().split('T')[0], notes: '' });
    setEditingReceipt(null);
    setImageUri(null);
    setImageBase64(null);
    setAiDetected(false);
    setAiConfidence(0);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (r: Receipt) => {
    setEditingReceipt(r);
    setForm({ merchant: r.merchant, amount: String(r.amount), category: r.category, date: r.date, notes: r.notes || '' });
    setAiDetected(false);
    setAiConfidence(0);
    setShowForm(true);
  };

  // ══════════════════════════════════════════════════
  // AI RECEIPT SCANNING
  // ══════════════════════════════════════════════════

  const scanWithAI = async (fromCamera: boolean) => {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images' as any,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      };

      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(isEn ? 'Permission needed' : 'Permiso requerido', isEn ? 'Camera access needed' : 'Necesitamos acceso a la cámara.');
          return;
        }
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(isEn ? 'Permission needed' : 'Permiso requerido', isEn ? 'Gallery access needed' : 'Necesitamos acceso a tu galería.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 || null);
      setScanning(true);
      setShowForm(true);

      // Call AI classifier
      try {
        const classifyRes = await api.post('/receipts/classify', {
          image_base64: asset.base64,
          filename: asset.fileName || 'business_receipt.jpg',
          receipt_type: 'business',
        });

        if (classifyRes.data?.success && classifyRes.data?.data) {
          const d = classifyRes.data.data;

          // Map AI category to business category
          const aiCat = d.category || 'other';
          const bizCat = AI_TO_BIZ_CATEGORY[aiCat] || 'other_expense';

          setForm({
            merchant: d.vendor || '',
            amount: d.amount ? String(d.amount) : '',
            category: bizCat,
            date: d.date || now.toISOString().split('T')[0],
            notes: d.description || '',
          });
          setAiDetected(true);
          setAiConfidence(d.confidence || 0.8);
        } else {
          // AI failed — show form anyway with empty fields
          Alert.alert(
            isEn ? 'AI could not read receipt' : 'La IA no pudo leer el recibo',
            isEn ? 'Please fill in the details manually.' : 'Por favor completa los datos manualmente.',
            [{ text: 'OK' }]
          );
        }
      } catch (aiError: any) {
        console.error('AI classification error:', aiError);
        Alert.alert(
          isEn ? 'AI temporarily unavailable' : 'IA temporalmente no disponible',
          isEn ? 'You can still fill in the details manually.' : 'Puedes completar los datos manualmente.',
          [{ text: 'OK' }]
        );
      } finally {
        setScanning(false);
      }
    } catch (e) {
      console.error('Image pick error:', e);
      setScanning(false);
    }
  };

  const showScanOptions = () => {
    Alert.alert(
      isEn ? 'Scan Receipt with AI' : 'Escanear Recibo con IA',
      isEn ? 'AI will read the receipt and fill in the details automatically' : 'La IA leerá el recibo y llenará los datos automáticamente',
      [
        { text: isEn ? 'Camera' : 'Cámara', onPress: () => scanWithAI(true) },
        { text: isEn ? 'Gallery' : 'Galería', onPress: () => scanWithAI(false) },
        { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
      ]
    );
  };

  // For the modal's photo area — re-scan or add photo to manual entry
  const pickOrRescan = async (fromCamera: boolean) => {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images' as any,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

      if (!result.canceled && result.assets?.[0]) {
        setImageUri(result.assets[0].uri);
        setImageBase64(result.assets[0].base64 || null);

        // Ask if they want to run AI on this image
        Alert.alert(
          isEn ? 'Analyze with AI?' : '¿Analizar con IA?',
          isEn ? 'Want AI to read the receipt?' : '¿Quieres que la IA lea el recibo?',
          [
            {
              text: isEn ? 'Yes, analyze' : 'Sí, analizar',
              onPress: async () => {
                setScanning(true);
                try {
                  const classifyRes = await api.post('/receipts/classify', {
                    image_base64: result.assets[0].base64,
                    filename: result.assets[0].fileName || 'business_receipt.jpg',
                    receipt_type: 'business',
                  });
                  if (classifyRes.data?.success && classifyRes.data?.data) {
                    const d = classifyRes.data.data;
                    const aiCat = d.category || 'other';
                    const bizCat = AI_TO_BIZ_CATEGORY[aiCat] || 'other_expense';
                    setForm({
                      merchant: d.vendor || form.merchant,
                      amount: d.amount ? String(d.amount) : form.amount,
                      category: bizCat,
                      date: d.date || form.date,
                      notes: d.description || form.notes,
                    });
                    setAiDetected(true);
                    setAiConfidence(d.confidence || 0.8);
                  }
                } catch (e) {
                  console.error('AI re-scan error:', e);
                }
                setScanning(false);
              }
            },
            { text: isEn ? 'No, just save photo' : 'No, solo guardar foto', style: 'cancel' },
          ]
        );
      }
    } catch (e) {
      console.error('Image pick error:', e);
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      isEn ? 'Receipt Photo' : 'Foto del Recibo',
      '',
      [
        { text: isEn ? 'Camera' : 'Cámara', onPress: () => pickOrRescan(true) },
        { text: isEn ? 'Gallery' : 'Galería', onPress: () => pickOrRescan(false) },
        { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!form.merchant.trim()) {
      Alert.alert('Error', isEn ? 'Merchant name required' : 'Nombre del comercio requerido');
      return;
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      Alert.alert('Error', isEn ? 'Enter a valid amount' : 'Ingresa un monto válido');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        merchant: form.merchant.trim(),
        amount: parseFloat(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes.trim(),
        tax_deductible: true,
      };
      if (imageBase64) payload.image_base64 = imageBase64;

      if (editingReceipt) {
        await api.put(`/business-receipts/${editingReceipt.id}`, payload);
      } else {
        await api.post('/business-receipts', payload);
      }

      setShowForm(false);
      resetForm();
      await loadAll();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || (isEn ? 'Could not save' : 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: Receipt) => {
    Alert.alert(
      isEn ? 'Delete Receipt?' : '¿Eliminar Recibo?',
      `${r.merchant} - ${fmt(r.amount)}`,
      [
        { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
        { text: isEn ? 'Delete' : 'Eliminar', style: 'destructive', onPress: async () => {
          try { await api.delete(`/business-receipts/${r.id}`); await loadAll(); } catch { Alert.alert('Error'); }
        }},
      ]
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0A1628', '#132240', '#1A2F55']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.headerGrad, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/my-business')} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEn ? 'Business Receipts' : 'Recibos de Negocio'}</Text>
          <TouchableOpacity onPress={openCreate} style={[s.headerBtn, { backgroundColor: 'rgba(52,199,89,0.3)' }]}>
            <Ionicons name="add" size={22} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        {/* Stats Summary */}
        {stats && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={s.heroPill}>
                <Ionicons name="receipt-outline" size={18} color="#FBBF24" />
                <Text style={s.heroValue}>{stats.total_receipts}</Text>
                <Text style={s.heroLabel}>{isEn ? 'receipts' : 'recibos'}</Text>
              </View>
              <View style={[s.heroPill, { flex: 1.5 }]}>
                <Ionicons name="cash-outline" size={18} color="#F87171" />
                <Text style={[s.heroValue, { color: '#F87171' }]}>{fmt(stats.total_amount)}</Text>
                <Text style={s.heroLabel}>{isEn ? 'total expenses' : 'gastos totales'}</Text>
              </View>
              <View style={s.heroPill}>
                <Ionicons name="shield-checkmark" size={18} color="#4ADE80" />
                <Text style={[s.heroValue, { color: '#4ADE80', fontSize: 12 }]}>{isEn ? 'Deductible' : 'Deducible'}</Text>
                <Text style={s.heroLabel}>IRS</Text>
              </View>
            </View>

            {/* Top categories mini */}
            {stats.by_category.length > 0 && (
              <View style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10 }}>
                {stats.by_category.slice(0, 3).map((cat, idx) => {
                  const info = getCatInfo(cat.category);
                  const pct = stats.total_amount > 0 ? (cat.total / stats.total_amount) * 100 : 0;
                  return (
                    <View key={cat.category || idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: idx < 2 ? 6 : 0 }}>
                      <Ionicons name={info.icon as any} size={14} color={info.color} />
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 6, flex: 1 }}>
                        {isEn ? info.labelEn : info.label}
                      </Text>
                      <View style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 8 }}>
                        <View style={{ width: `${Math.min(pct, 100)}%` as any, height: 4, borderRadius: 2, backgroundColor: info.color }} />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: info.color }}>{fmt(cat.total)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        <TouchableOpacity
          style={[s.filterChip, filterCat === 'all' && s.filterChipActive]}
          onPress={() => setFilterCat('all')}
        >
          <Text style={[s.filterChipText, filterCat === 'all' && s.filterChipTextActive]}>{isEn ? 'All' : 'Todos'}</Text>
        </TouchableOpacity>
        {CATEGORIES.slice(0, 8).map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[s.filterChip, filterCat === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
            onPress={() => setFilterCat(cat.id)}
          >
            <Ionicons name={cat.icon as any} size={12} color={filterCat === cat.id ? '#fff' : cat.color} />
            <Text style={[s.filterChipText, filterCat === cat.id && { color: '#fff' }]}>{isEn ? cat.labelEn : cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
          showsVerticalScrollIndicator={false}
        >
          {receipts.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>🧾</Text>
              <Text style={s.emptyTitle}>{isEn ? 'No business receipts' : 'Sin recibos de negocio'}</Text>
              <Text style={s.emptySub}>{isEn ? 'Capture your first business expense' : 'Captura tu primer gasto de negocio'}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[s.emptyBtn, { backgroundColor: C.blue }]} onPress={showScanOptions}>
                  <Ionicons name="scan" size={18} color="#fff" />
                  <Text style={s.emptyBtnText}>{isEn ? 'Scan' : 'Escanear'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
                  <Ionicons name="create" size={18} color="#fff" />
                  <Text style={s.emptyBtnText}>{isEn ? 'Manual' : 'Manual'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 12, textAlign: 'center', lineHeight: 16 }}>
                {isEn
                  ? '✨ AI analyzes your receipt and auto-fills vendor, amount, date and category'
                  : '✨ La IA analiza tu recibo y auto-llena vendedor, monto, fecha y categoría'}
              </Text>
            </View>
          ) : (
            receipts.map(r => {
              const cat = getCatInfo(r.category);
              return (
                <TouchableOpacity key={r.id} style={s.receiptCard} onPress={() => openEdit(r)} activeOpacity={0.7}>
                  <View style={[s.catDot, { backgroundColor: `${cat.color}18` }]}>
                    <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.rMerchant}>{r.merchant}</Text>
                    <Text style={s.rMeta}>{r.date} · {isEn ? cat.labelEn : cat.label}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.rAmount}>{fmt(r.amount)}</Text>
                    <TouchableOpacity onPress={() => handleDelete(r)} style={{ padding: 4, marginTop: 4 }}>
                      <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB — Scan + Manual */}
      {receipts.length > 0 && (
        <View style={[s.fabContainer, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={showScanOptions} activeOpacity={0.85}>
            <LinearGradient colors={['#6366F1', '#8B5CF6']} style={s.fabInner}>
              <Ionicons name="scan" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreate} activeOpacity={0.85}>
            <LinearGradient colors={['#8B1A1A', '#A52020']} style={[s.fabInner, { width: 48, height: 48, borderRadius: 24 }]}>
              <Ionicons name="add" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.formHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.formTitle}>
              {editingReceipt ? (isEn ? 'Edit Receipt' : 'Editar Recibo') : (isEn ? 'New Business Receipt' : 'Nuevo Recibo de Negocio')}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || scanning} style={[s.saveBtn, (saving || scanning) && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{isEn ? 'Save' : 'Guardar'}</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* AI Scanning Indicator */}
            {scanning && (
              <View style={s.scanningBanner}>
                <ActivityIndicator size="small" color={C.ai} />
                <Text style={s.scanningText}>
                  {isEn ? '✨ AI is analyzing your receipt...' : '✨ La IA está analizando tu recibo...'}
                </Text>
              </View>
            )}

            {/* AI Detected Banner */}
            {aiDetected && !scanning && (
              <View style={s.aiBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={18} color={C.ai} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.aiBannerTitle}>
                      {isEn ? 'AI Auto-filled' : 'Auto-llenado por IA'}
                    </Text>
                    <Text style={s.aiBannerSub}>
                      {isEn
                        ? `${Math.round(aiConfidence * 100)}% confidence — Review and edit if needed`
                        : `${Math.round(aiConfidence * 100)}% confianza — Revisa y edita si es necesario`}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Photo capture */}
            <TouchableOpacity style={s.photoArea} onPress={showImageOptions}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={s.photoPreview} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="camera" size={32} color={C.muted} />
                  <Text style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{isEn ? 'Tap to add receipt photo' : 'Toca para agregar foto del recibo'}</Text>
                  <Text style={{ fontSize: 11, color: C.ai, marginTop: 4, fontWeight: '600' }}>
                    {isEn ? '✨ AI will auto-fill details' : '✨ La IA auto-llenará los datos'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Fields */}
            <Text style={s.sectionLabel}>
              {isEn ? 'Details' : 'Detalles'}
              {aiDetected && <Text style={{ color: C.ai }}> ✨</Text>}
            </Text>
            <View style={s.formCard}>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[s.input, aiDetected && form.merchant ? s.inputAiFilled : {}]}
                  placeholder={isEn ? 'Merchant / Store *' : 'Comercio / Tienda *'}
                  placeholderTextColor={C.muted}
                  value={form.merchant}
                  onChangeText={v => setForm(p => ({ ...p, merchant: v }))}
                  autoCapitalize="words"
                />
                {aiDetected && form.merchant ? <View style={s.aiBadge}><Text style={s.aiBadgeText}>AI</Text></View> : null}
              </View>
              <View style={s.inputDivider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, position: 'relative' }}>
                <Text style={{ fontSize: 18, color: C.text, fontWeight: '700' }}>$</Text>
                <TextInput
                  style={[s.input, { flex: 1 }, aiDetected && form.amount ? s.inputAiFilled : {}]}
                  placeholder={isEn ? 'Amount *' : 'Monto *'}
                  placeholderTextColor={C.muted}
                  value={form.amount}
                  onChangeText={v => setForm(p => ({ ...p, amount: v }))}
                  keyboardType="decimal-pad"
                />
                {aiDetected && form.amount ? <View style={s.aiBadge}><Text style={s.aiBadgeText}>AI</Text></View> : null}
              </View>
              <View style={s.inputDivider} />
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={[s.input, aiDetected && form.date !== now.toISOString().split('T')[0] ? s.inputAiFilled : {}]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={C.muted}
                  value={form.date}
                  onChangeText={v => setForm(p => ({ ...p, date: v }))}
                />
                {aiDetected && form.date !== now.toISOString().split('T')[0] ? <View style={s.aiBadge}><Text style={s.aiBadgeText}>AI</Text></View> : null}
              </View>
            </View>

            {/* Category Selection */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>
              {isEn ? 'Category' : 'Categoría'}
              {aiDetected && <Text style={{ color: C.ai }}> ✨</Text>}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(cat => {
                const active = form.category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      s.catChip,
                      active && { backgroundColor: cat.color, borderColor: cat.color },
                      active && aiDetected && { borderWidth: 2.5 },
                    ]}
                    onPress={() => setForm(p => ({ ...p, category: cat.id }))}
                  >
                    <Ionicons name={cat.icon as any} size={12} color={active ? '#fff' : cat.color} />
                    <Text style={[s.catChipText, active && { color: '#fff' }]}>{isEn ? cat.labelEn : cat.label}</Text>
                    {active && aiDetected && (
                      <Text style={{ fontSize: 9, color: '#fff', fontWeight: '800' }}>AI</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>{isEn ? 'Notes' : 'Notas'}</Text>
            <View style={s.formCard}>
              <TextInput
                style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder={isEn ? 'Optional details...' : 'Detalles opcionales...'}
                placeholderTextColor={C.muted}
                value={form.notes}
                onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                multiline
              />
            </View>

            {/* Tax deductible info */}
            <View style={s.infoCard}>
              <Ionicons name="information-circle" size={18} color={C.blue} />
              <Text style={s.infoText}>
                {isEn
                  ? 'All business receipts are marked as tax-deductible for Schedule C.'
                  : 'Todos los recibos de negocio se marcan como deducibles para el Schedule C del IRS.'}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerGrad: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  heroPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 10, alignItems: 'center', gap: 4 },
  heroValue: { fontSize: 18, fontWeight: '800', color: '#FBBF24' },
  heroLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },

  filterBar: { backgroundColor: C.card, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  filterChipText: { fontSize: 12, fontWeight: '600', color: C.sub },
  filterChipTextActive: { color: '#fff' },

  receiptCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },
  catDot: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rMerchant: { fontSize: 15, fontWeight: '700', color: C.text },
  rMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  rAmount: { fontSize: 16, fontWeight: '800', color: C.brand },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: C.sub, marginTop: 6, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  fabContainer: { position: 'absolute', right: 20, zIndex: 10, flexDirection: 'column', gap: 10 },
  fabInner: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }),
  },

  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0A1628', borderBottomWidth: 0 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  saveBtn: { backgroundColor: C.brand, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  formCard: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 1 } }) },
  input: { height: 48, paddingHorizontal: 14, fontSize: 15, color: C.text },
  inputAiFilled: { backgroundColor: '#F5F3FF' },
  inputDivider: { height: 1, backgroundColor: C.border, marginLeft: 14 },

  photoArea: { height: 140, backgroundColor: C.card, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },

  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  catChipText: { fontSize: 11, fontWeight: '600', color: C.text },

  // AI indicators
  scanningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F5F3FF',
    borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: '#DDD6FE',
  },
  scanningText: { fontSize: 14, fontWeight: '600', color: C.ai },

  aiBanner: {
    backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#DDD6FE',
  },
  aiBannerTitle: { fontSize: 14, fontWeight: '700', color: C.ai },
  aiBannerSub: { fontSize: 11, color: C.sub, marginTop: 2 },

  aiBadge: {
    position: 'absolute', right: 12, top: 14,
    backgroundColor: C.ai, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  aiBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF',
    borderRadius: 12, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#DBEAFE',
  },
  infoText: { fontSize: 12, color: '#1E40AF', lineHeight: 18, flex: 1 },
});
