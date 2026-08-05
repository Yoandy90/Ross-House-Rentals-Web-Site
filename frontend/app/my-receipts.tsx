/**
 * Recibos de Negocio - Business Receipts for Mi Negocio
 * Separate ecosystem from personal finance receipts.
 * Focused on: gastos deducibles, Schedule C, categorías comerciales.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';

const C = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', sub: '#636366',
  muted: '#AEAEB2', border: '#E5E5EA', brand: '#8B1A1A',
  success: '#34C759', warning: '#FF9500', blue: '#007AFF',
};

// IRS Schedule C categories for business expenses
const BUSINESS_CATEGORIES = [
  { id: 'supplies', label: 'Suministros', icon: '📦', color: '#FF9500' },
  { id: 'travel', label: 'Viajes', icon: '✈️', color: '#007AFF' },
  { id: 'meals', label: 'Comidas', icon: '🍽️', color: '#FF3B30' },
  { id: 'vehicle', label: 'Vehículo', icon: '🚗', color: '#5856D6' },
  { id: 'utilities', label: 'Servicios', icon: '💡', color: '#FFCC00' },
  { id: 'rent', label: 'Renta/Oficina', icon: '🏢', color: '#34C759' },
  { id: 'insurance', label: 'Seguros', icon: '🛡️', color: '#AF52DE' },
  { id: 'other', label: 'Otros', icon: '📋', color: '#8E8E93' },
];

interface BusinessReceipt {
  id: string;
  filename: string;
  vendor?: string;
  amount?: number;
  category?: string;
  category_name_es?: string;
  date?: string;
  status: string;
  reviewed: boolean;
  created_at: string;
  receipt_type?: string;
}

export default function MyReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [receipts, setReceipts] = useState<BusinessReceipt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadReceipts = useCallback(async () => {
    try {
      // Fetch business receipts specifically
      const res = await api.get('/admin/classified-receipts?limit=200');
      if (res.data?.receipts) {
        // Filter to show only business-tagged receipts or all if no tag
        const businessReceipts = res.data.receipts.filter((r: any) =>
          r.receipt_type === 'business' || !r.receipt_type
        );
        setReceipts(businessReceipts);
      }
    } catch (e) {
      console.log('Error loading business receipts:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReceipts();
  }, [loadReceipts]);

  const uploadReceipt = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7, base64: true });
      }

      if (!result.canceled && result.assets[0]?.base64) {
        setUploading(true);
        try {
          const res = await api.post('/receipts/classify', {
            image_base64: result.assets[0].base64,
            filename: result.assets[0].fileName || 'business_receipt.jpg',
            receipt_type: 'business',  // Tag as business receipt
          });
          if (res.data.success) {
            const d = res.data.data || {};
            Alert.alert(
              '✅ Recibo de Negocio Clasificado',
              `Vendedor: ${d.vendor || 'N/A'}\nMonto: $${d.amount || '0'}\nCategoría: ${d.category_name_es || 'N/A'}\n\n💼 Guardado como gasto de negocio`
            );
            loadReceipts();
          } else {
            Alert.alert('Error', 'No se pudo clasificar el recibo.');
          }
        } catch (e) {
          Alert.alert('Error', 'No se pudo subir el recibo. Intenta de nuevo.');
        } finally {
          setUploading(false);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo procesar la imagen.');
    }
  };

  const filteredReceipts = selectedCategory === 'all'
    ? receipts
    : receipts.filter(r => r.category === selectedCategory);

  const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const pendingCount = receipts.filter(r => !r.reviewed).length;
  const deductibleEstimate = totalAmount * 0.75; // Rough estimate

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient
        colors={['#E65100', '#FF9500', '#FFB74D']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
        style={[s.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Recibos de Negocio</Text>
            <Text style={s.headerSub}>{receipts.length} recibos • ${totalAmount.toLocaleString()} total</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.warning} />}
      >
        {/* Upload Actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <TouchableOpacity
            style={[s.uploadBtn, { flex: 1, backgroundColor: C.brand }]}
            onPress={() => uploadReceipt('camera')}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={s.uploadText}>📸 Foto</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.uploadBtn, { flex: 1, backgroundColor: C.blue }]}
            onPress={() => uploadReceipt('gallery')}
            disabled={uploading}
          >
            <Ionicons name="image" size={18} color="#fff" />
            <Text style={s.uploadText}>🖼️ Galería</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', fontWeight: '600' }}>Total Gastos</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>${totalAmount.toLocaleString()}</Text>
          </View>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', fontWeight: '600' }}>Deducible Est.</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.success }}>${deductibleEstimate.toLocaleString()}</Text>
          </View>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase', fontWeight: '600' }}>Pendientes</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: pendingCount > 0 ? '#EF4444' : C.success }}>{pendingCount}</Text>
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <TouchableOpacity
            style={[s.catChip, selectedCategory === 'all' && s.catChipActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[s.catChipText, selectedCategory === 'all' && s.catChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {BUSINESS_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[s.catChip, selectedCategory === cat.id && s.catChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[s.catChipText, selectedCategory === cat.id && s.catChipTextActive]}>
                {cat.icon} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Receipts List */}
        {filteredReceipts.length === 0 ? (
          <View style={[s.stat, { alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 48 }}>💼</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 12 }}>
              {selectedCategory === 'all' ? 'Sin recibos de negocio aún' : 'Sin recibos en esta categoría'}
            </Text>
            <Text style={{ fontSize: 13, color: C.sub, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 }}>
              Sube fotos de tus gastos de negocio para clasificarlos automáticamente con IA y generar reportes para el IRS (Schedule C)
            </Text>
          </View>
        ) : (
          filteredReceipts.map((receipt) => (
            <View key={receipt.id} style={[s.receiptRow, { marginBottom: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.receiptIcon, { backgroundColor: receipt.reviewed ? '#E8F9ED' : '#FFF3E0' }]}>
                  <Text style={{ fontSize: 18 }}>
                    {BUSINESS_CATEGORIES.find(c => c.id === receipt.category)?.icon || '📋'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }} numberOfLines={1}>
                    {receipt.vendor || receipt.filename || 'Recibo'}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.sub }}>
                    {receipt.category_name_es || receipt.category || 'Sin categoría'} • {receipt.date || 'Sin fecha'}
                  </Text>
                  {receipt.reviewed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="checkmark-circle" size={12} color={C.success} />
                      <Text style={{ fontSize: 10, color: C.success, fontWeight: '600' }}>Revisado</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>
                    ${(receipt.amount || 0).toLocaleString()}
                  </Text>
                  <Text style={{ fontSize: 10, color: C.success, fontWeight: '600' }}>
                    Deducible
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Schedule C Info */}
        {receipts.length > 0 && (
          <View style={[s.stat, { marginTop: 6 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="document-text" size={18} color={C.blue} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Schedule C (IRS)</Text>
            </View>
            <Text style={{ fontSize: 12, color: C.sub, lineHeight: 18 }}>
              Tus recibos de negocio se clasifican automáticamente según las categorías del Schedule C del IRS para facilitar tu declaración de impuestos.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerGradient: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 16 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }),
  },
  uploadText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  stat: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },
  catChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.card, marginRight: 8, borderWidth: 1, borderColor: C.border },
  catChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  catChipText: { fontSize: 12, fontWeight: '600', color: C.sub },
  catChipTextActive: { color: '#fff' },
  receiptRow: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }),
  },
  receiptIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
