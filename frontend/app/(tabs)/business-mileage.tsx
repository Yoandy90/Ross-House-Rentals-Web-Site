/**
 * Business Mileage Tracker — Log trips & calculate IRS tax deductions
 * IRS Standard Mileage Rate 2025: $0.70/mile
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
  TextInput, KeyboardAvoidingView, Platform, Dimensions, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_W } = Dimensions.get('window');
const IRS_RATE = 0.70;

const C = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', sub: '#636366',
  muted: '#AEAEB2', border: '#E5E5EA', brand: '#8B1A1A',
  success: '#34C759', successSoft: '#E8F9ED', warning: '#FF9500',
  blue: '#007AFF', blueSoft: '#EFF6FF', purple: '#AF52DE',
  orange: '#FF9500', orangeSoft: '#FFF8EC',
};

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PURPOSES = [
  { value: 'client_visit', label: 'Visita a Cliente', labelEn: 'Client Visit', icon: 'people', color: '#007AFF' },
  { value: 'supplies', label: 'Compra de Suministros', labelEn: 'Supplies', icon: 'cart', color: '#FF9500' },
  { value: 'meeting', label: 'Reunión de Negocios', labelEn: 'Business Meeting', icon: 'briefcase', color: '#AF52DE' },
  { value: 'delivery', label: 'Entrega', labelEn: 'Delivery', icon: 'cube', color: '#34C759' },
  { value: 'bank', label: 'Banco / Oficina', labelEn: 'Bank / Office', icon: 'business', color: '#636366' },
  { value: 'other', label: 'Otro', labelEn: 'Other', icon: 'car', color: '#8B1A1A' },
];

const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Trip {
  id: string;
  date: string;
  from_location: string;
  to_location: string;
  miles: number;
  purpose: string;
  notes: string;
  round_trip: boolean;
  deduction_amount: number;
}

interface MileageStats {
  month: { total_miles: number; total_deduction: number; trip_count: number };
  ytd: { total_miles: number; total_deduction: number; trip_count: number };
  monthly_breakdown: { month: number; miles: number; deduction: number; trips: number }[];
  irs_rate: number;
}

export default function BusinessMileageScreen() {
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<MileageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());

  // Form
  const [form, setForm] = useState({
    date: now.toISOString().split('T')[0],
    from_location: '', to_location: '', miles: '',
    purpose: 'client_visit', notes: '', round_trip: false,
  });

  useEffect(() => { loadAll(); }, [selectedMonth]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [tripsRes, statsRes] = await Promise.all([
        api.get(`/mileage?year=${selectedYear}&month=${selectedMonth}`),
        api.get(`/mileage/stats?year=${selectedYear}&month=${selectedMonth}`),
      ]);
      setTrips(tripsRes.data || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Load mileage error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const resetForm = () => {
    setForm({
      date: now.toISOString().split('T')[0],
      from_location: '', to_location: '', miles: '',
      purpose: 'client_visit', notes: '', round_trip: false,
    });
    setEditingTrip(null);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (trip: Trip) => {
    setEditingTrip(trip);
    setForm({
      date: trip.date,
      from_location: trip.from_location,
      to_location: trip.to_location,
      miles: String(trip.round_trip ? trip.miles / 2 : trip.miles),
      purpose: trip.purpose,
      notes: trip.notes,
      round_trip: trip.round_trip,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const miles = parseFloat(form.miles);
    if (!miles || miles <= 0) {
      Alert.alert('Error', isEn ? 'Enter valid miles' : 'Ingresa millas válidas');
      return;
    }
    if (!form.from_location.trim() || !form.to_location.trim()) {
      Alert.alert('Error', isEn ? 'Enter origin and destination' : 'Ingresa origen y destino');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date: form.date,
        from_location: form.from_location.trim(),
        to_location: form.to_location.trim(),
        miles: miles,
        purpose: form.purpose,
        notes: form.notes.trim(),
        round_trip: form.round_trip,
      };

      if (editingTrip) {
        await api.put(`/mileage/${editingTrip.id}`, payload);
      } else {
        await api.post('/mileage', payload);
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

  const handleDelete = (trip: Trip) => {
    Alert.alert(
      isEn ? 'Delete Trip?' : '¿Eliminar Viaje?',
      isEn ? 'This cannot be undone.' : 'No se puede deshacer.',
      [
        { text: isEn ? 'Cancel' : 'Cancelar', style: 'cancel' },
        {
          text: isEn ? 'Delete' : 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/mileage/${trip.id}`);
              await loadAll();
            } catch { Alert.alert('Error'); }
          },
        },
      ]
    );
  };

  const monthNames = isEn ? MONTHS_EN : MONTHS_ES;
  const effectiveMiles = parseFloat(form.miles) || 0;
  const previewDeduction = (form.round_trip ? effectiveMiles * 2 : effectiveMiles) * IRS_RATE;

  return (
    <View style={s.container}>
      {/* Header */}
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.headerGrad, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.replace('/my-business')} style={s.headerBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{isEn ? 'Mileage Tracker' : 'Rastreo de Millas'}</Text>
          <TouchableOpacity onPress={openCreate} style={[s.headerBtn, { backgroundColor: 'rgba(255,149,0,0.3)' }]}>
            <Ionicons name="add" size={22} color="#FBBF24" />
          </TouchableOpacity>
        </View>

        {/* Hero Stats */}
        {stats && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            {/* This Month */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={s.heroPill}>
                <Ionicons name="speedometer-outline" size={18} color="#FBBF24" />
                <Text style={s.heroValue}>{stats.month.total_miles.toLocaleString()}</Text>
                <Text style={s.heroLabel}>{isEn ? 'miles' : 'millas'}</Text>
              </View>
              <View style={[s.heroPill, { flex: 1.3 }]}>
                <Ionicons name="cash-outline" size={18} color="#4ADE80" />
                <Text style={[s.heroValue, { color: '#4ADE80' }]}>{fmt(stats.month.total_deduction)}</Text>
                <Text style={s.heroLabel}>{isEn ? 'tax savings' : 'ahorro fiscal'}</Text>
              </View>
              <View style={s.heroPill}>
                <Ionicons name="navigate-outline" size={18} color="#60A5FA" />
                <Text style={s.heroValue}>{stats.month.trip_count}</Text>
                <Text style={s.heroLabel}>{isEn ? 'trips' : 'viajes'}</Text>
              </View>
            </View>

            {/* YTD bar */}
            <View style={s.ytdBar}>
              <Text style={s.ytdLabel}>YTD</Text>
              <Text style={s.ytdValue}>{stats.ytd.total_miles.toLocaleString()} mi</Text>
              <View style={s.ytdDot} />
              <Text style={[s.ytdValue, { color: '#4ADE80' }]}>{fmt(stats.ytd.total_deduction)}</Text>
              <View style={s.ytdDot} />
              <Text style={s.ytdValue}>{stats.ytd.trip_count} {isEn ? 'trips' : 'viajes'}</Text>
            </View>

            {/* Mini chart */}
            {stats.monthly_breakdown.length > 0 && (
              <View style={s.chartRow}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                  const data = stats.monthly_breakdown.find(b => b.month === m);
                  const maxMiles = Math.max(...stats.monthly_breakdown.map(b => b.miles), 1);
                  const h = data ? Math.max((data.miles / maxMiles) * 40, 3) : 3;
                  const isCurrentMonth = m === selectedMonth;
                  return (
                    <TouchableOpacity key={m} style={s.chartCol} onPress={() => setSelectedMonth(m)} activeOpacity={0.7}>
                      <View style={[s.chartBar, { height: h, backgroundColor: isCurrentMonth ? '#FBBF24' : data?.miles ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)' }]} />
                      <Text style={[s.chartLabel, isCurrentMonth && { color: '#FBBF24', fontWeight: '700' }]}>{monthNames[m - 1]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* IRS Rate Badge */}
      <View style={s.irsBar}>
        <Ionicons name="information-circle" size={16} color={C.blue} />
        <Text style={s.irsText}>IRS {isEn ? 'Rate' : 'Tarifa'} 2025: <Text style={{ fontWeight: '800' }}>$0.70/{isEn ? 'mile' : 'milla'}</Text></Text>
      </View>

      {/* Trip List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.orange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
          showsVerticalScrollIndicator={false}
        >
          {trips.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>🚗</Text>
              <Text style={s.emptyTitle}>{isEn ? 'No trips this month' : 'Sin viajes este mes'}</Text>
              <Text style={s.emptySub}>{isEn ? 'Log your first business trip' : 'Registra tu primer viaje de negocios'}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={s.emptyBtnText}>{isEn ? 'Log Trip' : 'Registrar Viaje'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            trips.map(trip => {
              const purpose = PURPOSES.find(p => p.value === trip.purpose) || PURPOSES[5];
              return (
                <TouchableOpacity key={trip.id} style={s.tripCard} onPress={() => openEdit(trip)} activeOpacity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[s.purposeIcon, { backgroundColor: `${purpose.color}15` }]}>
                      <Ionicons name={purpose.icon as any} size={18} color={purpose.color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.tripFrom}>{trip.from_location}</Text>
                        <Ionicons name="arrow-forward" size={12} color={C.muted} />
                        <Text style={s.tripTo}>{trip.to_location}</Text>
                      </View>
                      <Text style={s.tripMeta}>
                        {trip.date} · {isEn ? purpose.labelEn : purpose.label}
                        {trip.round_trip ? ` · ${isEn ? 'Round trip' : 'Ida y vuelta'}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.tripMiles}>{trip.miles} mi</Text>
                      <Text style={s.tripDeduction}>{fmt(trip.deduction_amount)}</Text>
                    </View>
                  </View>
                  {trip.notes ? (
                    <Text style={s.tripNotes} numberOfLines={1}>{trip.notes}</Text>
                  ) : null}
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(trip)}>
                    <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB */}
      {trips.length > 0 && (
        <TouchableOpacity style={[s.fab, { bottom: insets.bottom + 20 }]} onPress={openCreate} activeOpacity={0.85}>
          <LinearGradient colors={['#FF9500', '#F59E0B']} style={s.fabInner}>
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Add/Edit Trip Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.formHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.formTitle}>{editingTrip ? (isEn ? 'Edit Trip' : 'Editar Viaje') : (isEn ? 'New Trip' : 'Nuevo Viaje')}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{isEn ? 'Save' : 'Guardar'}</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Deduction Preview */}
            <View style={s.previewCard}>
              <Text style={s.previewLabel}>{isEn ? 'Estimated Tax Deduction' : 'Deducción Fiscal Estimada'}</Text>
              <Text style={s.previewValue}>{fmt(previewDeduction)}</Text>
              <Text style={s.previewSub}>
                {form.round_trip ? (effectiveMiles * 2).toFixed(1) : effectiveMiles.toFixed(1)} mi × $0.70
              </Text>
            </View>

            {/* Date */}
            <Text style={s.sectionLabel}>{isEn ? 'Date' : 'Fecha'}</Text>
            <View style={s.formCard}>
              <TextInput
                style={s.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.muted}
                value={form.date}
                onChangeText={v => setForm(p => ({ ...p, date: v }))}
              />
            </View>

            {/* Route */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>{isEn ? 'Route' : 'Ruta'}</Text>
            <View style={s.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[s.routeDot, { backgroundColor: '#34C759' }]} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={isEn ? 'From (origin)' : 'Desde (origen)'}
                  placeholderTextColor={C.muted}
                  value={form.from_location}
                  onChangeText={v => setForm(p => ({ ...p, from_location: v }))}
                  autoCapitalize="words"
                />
              </View>
              <View style={s.inputDivider} />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[s.routeDot, { backgroundColor: '#FF3B30' }]} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={isEn ? 'To (destination)' : 'Hasta (destino)'}
                  placeholderTextColor={C.muted}
                  value={form.to_location}
                  onChangeText={v => setForm(p => ({ ...p, to_location: v }))}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Miles & Round Trip */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>{isEn ? 'Distance' : 'Distancia'}</Text>
            <View style={s.formCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                <Ionicons name="speedometer-outline" size={20} color={C.orange} />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder={isEn ? 'Miles (one way)' : 'Millas (solo ida)'}
                  placeholderTextColor={C.muted}
                  value={form.miles}
                  onChangeText={v => setForm(p => ({ ...p, miles: v }))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={s.inputDivider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="repeat" size={18} color={C.sub} />
                  <Text style={{ fontSize: 15, color: C.text }}>{isEn ? 'Round trip' : 'Ida y vuelta'}</Text>
                </View>
                <Switch
                  value={form.round_trip}
                  onValueChange={v => setForm(p => ({ ...p, round_trip: v }))}
                  trackColor={{ false: C.border, true: '#FF950060' }}
                  thumbColor={form.round_trip ? C.orange : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Purpose */}
            <Text style={[s.sectionLabel, { marginTop: 16 }]}>{isEn ? 'Purpose' : 'Propósito'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PURPOSES.map(p => {
                const active = form.purpose === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[s.purposeChip, active && { backgroundColor: p.color, borderColor: p.color }]}
                    onPress={() => setForm(prev => ({ ...prev, purpose: p.value }))}
                  >
                    <Ionicons name={p.icon as any} size={14} color={active ? '#fff' : p.color} />
                    <Text style={[s.purposeChipText, active && { color: '#fff' }]}>{isEn ? p.labelEn : p.label}</Text>
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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  headerGrad: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Hero Stats
  heroPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 10, alignItems: 'center', gap: 4 },
  heroValue: { fontSize: 18, fontWeight: '800', color: '#FBBF24' },
  heroLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' },

  ytdBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  ytdLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.4)' },
  ytdValue: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  ytdDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Mini chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, gap: 2 },
  chartCol: { alignItems: 'center', flex: 1 },
  chartBar: { width: 14, borderRadius: 4, minHeight: 3 },
  chartLabel: { fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '500' },

  // IRS bar
  irsBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.blueSoft, borderBottomWidth: 1, borderBottomColor: C.border },
  irsText: { fontSize: 12, color: C.blue },

  // Trip Card
  tripCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, position: 'relative',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }),
  },
  purposeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tripFrom: { fontSize: 14, fontWeight: '700', color: C.text },
  tripTo: { fontSize: 14, fontWeight: '600', color: C.sub },
  tripMeta: { fontSize: 11, color: C.muted, marginTop: 3 },
  tripMiles: { fontSize: 16, fontWeight: '800', color: C.text },
  tripDeduction: { fontSize: 12, fontWeight: '600', color: C.success, marginTop: 2 },
  tripNotes: { fontSize: 11, color: C.muted, marginTop: 8, fontStyle: 'italic' },
  deleteBtn: { position: 'absolute', top: 10, right: 10, padding: 6 },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 12 },
  emptySub: { fontSize: 14, color: C.sub, marginTop: 6, textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.orange, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 20 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // FAB
  fab: { position: 'absolute', right: 20, zIndex: 10 },
  fabInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }) },

  // Form
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0F172A', borderBottomWidth: 0 },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  saveBtn: { backgroundColor: C.orange, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  formCard: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 1 } }) },
  input: { height: 48, paddingHorizontal: 14, fontSize: 15, color: C.text },
  inputDivider: { height: 1, backgroundColor: C.border, marginLeft: 14 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 14 },

  // Preview
  previewCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  previewLabel: { fontSize: 12, fontWeight: '600', color: '#059669', textTransform: 'uppercase' },
  previewValue: { fontSize: 32, fontWeight: '900', color: '#059669', marginTop: 4 },
  previewSub: { fontSize: 12, color: '#6EE7B7', marginTop: 4 },

  // Purpose chips
  purposeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  purposeChipText: { fontSize: 13, fontWeight: '600', color: C.text },
});
