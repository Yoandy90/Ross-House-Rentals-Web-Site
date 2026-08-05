/**
 * Tanker Cargo Management — Gestión de Carga para Cisternas
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

const C = {
  bg: '#F2F2F7', card: '#fff', text: '#1C1C1E', sub: '#636366', muted: '#AEAEB2',
  border: '#E5E5EA', brand: '#1E40AF', success: '#059669', danger: '#DC2626',
  warning: '#D97706',
};

const CARGO_TYPES = [
  { id: 'gasoline', label: 'Gasolina', icon: '⛽', hazmat: true },
  { id: 'diesel_fuel', label: 'Diesel', icon: '🛢️', hazmat: true },
  { id: 'crude_oil', label: 'Petróleo', icon: '🪨', hazmat: true },
  { id: 'chemicals', label: 'Químicos', icon: '⚗️', hazmat: true },
  { id: 'milk', label: 'Leche', icon: '🥛', hazmat: false },
  { id: 'water', label: 'Agua', icon: '💧', hazmat: false },
  { id: 'juice', label: 'Jugo', icon: '🧃', hazmat: false },
  { id: 'lpg', label: 'Gas LP', icon: '🔥', hazmat: true },
  { id: 'other', label: 'Otro', icon: '📦', hazmat: false },
];

export default function TruckerTankerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cargo_type: '', capacity_gallons: '', loaded_gallons: '', temperature: '',
    hazmat_class: '', hazmat_placard: '', origin: '', destination: '',
    shipper: '', receiver: '', rate: '',
    wash_required: false, wash_completed: false, wash_location: '', wash_cost: '',
    notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/trucker/tanker/cargo?limit=20');
      setLogs(res.data.logs || []);
      setStats(res.data.stats || {});
    } catch (e) {
      console.error('Tanker load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveCargo = async () => {
    if (!form.cargo_type) {
      Alert.alert('⚠️', 'Selecciona el tipo de carga');
      return;
    }
    setSaving(true);
    try {
      await api.post('/trucker/tanker/cargo', {
        ...form,
        capacity_gallons: parseFloat(form.capacity_gallons) || 0,
        loaded_gallons: parseFloat(form.loaded_gallons) || 0,
        rate: parseFloat(form.rate) || 0,
        wash_cost: parseFloat(form.wash_cost) || 0,
      });
      const ct = CARGO_TYPES.find(t => t.id === form.cargo_type);
      Alert.alert('✅ Carga Registrada', `${ct?.icon} ${ct?.label} — ${form.loaded_gallons || 0} galones`);
      setShowNew(false);
      setForm({ cargo_type: '', capacity_gallons: '', loaded_gallons: '', temperature: '',
        hazmat_class: '', hazmat_placard: '', origin: '', destination: '',
        shipper: '', receiver: '', rate: '',
        wash_required: false, wash_completed: false, wash_location: '', wash_cost: '', notes: '' });
      loadData();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar');
    }
    setSaving(false);
  };

  const deleteCargo = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/trucker/tanker/cargo/${id}`); loadData(); }
        catch { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]);
  };

  const selectedCargo = CARGO_TYPES.find(t => t.id === form.cargo_type);

  if (loading) return (
    <View style={[s.center, { flex: 1, backgroundColor: C.bg }]}>
      <ActivityIndicator size="large" color={C.brand} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#1E3A5F', '#0F172A']} style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }}>🛢️ Tanker — Carga Líquida</Text>
          <TouchableOpacity onPress={() => setShowNew(true)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Nueva</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>

        {/* Stats */}
        {stats.total_loads > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <View style={[s.statCard, { flex: 1, backgroundColor: '#EFF6FF' }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E40AF' }}>{stats.total_loads}</Text>
              <Text style={s.statLabel}>Cargas</Text>
            </View>
            <View style={[s.statCard, { flex: 1, backgroundColor: '#FFFBEB' }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#D97706' }}>{(stats.total_gallons || 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Galones</Text>
            </View>
            <View style={[s.statCard, { flex: 1, backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#059669' }}>${(stats.total_revenue || 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Ingresos</Text>
            </View>
          </View>
        )}

        {/* Cargo History */}
        {logs.length === 0 ? (
          <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
            <Text style={{ fontSize: 50 }}>🛢️</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 8 }}>Sin Cargas Registradas</Text>
            <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 4 }}>
              Presiona "+ Nueva" para registrar tu primera carga líquida.
            </Text>
          </View>
        ) : (
          logs.map((log: any) => {
            const ct = CARGO_TYPES.find(t => t.id === log.cargo_type);
            return (
              <TouchableOpacity key={log.id} onLongPress={() => deleteCargo(log.id)}
                style={[s.card, { padding: 14, marginBottom: 8, borderLeftWidth: 4,
                  borderLeftColor: ct?.hazmat ? C.danger : C.brand }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                    {ct?.icon} {ct?.label || log.cargo_type}
                  </Text>
                  {ct?.hazmat && (
                    <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.danger }}>☢️ HAZMAT</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: C.sub }}>{log.origin} → {log.destination}</Text>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 6 }}>
                  <Text style={{ fontSize: 13, color: C.warning, fontWeight: '600' }}>💧 {log.loaded_gallons?.toLocaleString()} gal</Text>
                  {log.rate > 0 && <Text style={{ fontSize: 13, color: C.success, fontWeight: '600' }}>💰 ${log.rate?.toLocaleString()}</Text>}
                  {log.wash_required && (
                    <Text style={{ fontSize: 13, color: log.wash_completed ? C.success : C.danger, fontWeight: '600' }}>
                      🚿 {log.wash_completed ? 'Lavado ✅' : 'Lavado pendiente'}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{log.date}</Text>
              </TouchableOpacity>
            );
          })
        )}
        <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 }}>Mantén presionado para eliminar</Text>
      </ScrollView>

      {/* ── NEW CARGO MODAL ── */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setShowNew(false)}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🛢️ Nueva Carga</Text>
              <TouchableOpacity onPress={saveCargo} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={C.brand} /> : (
                  <Text style={{ color: C.brand, fontWeight: '700' }}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.formLabel}>Tipo de Carga *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {CARGO_TYPES.map(ct => (
                    <TouchableOpacity key={ct.id} onPress={() => setForm(p => ({...p, cargo_type: ct.id}))}
                      style={[s.toggleBtn, form.cargo_type === ct.id && { backgroundColor: ct.hazmat ? C.danger : C.brand, borderColor: ct.hazmat ? C.danger : C.brand }]}>
                      <Text style={{ fontSize: 20 }}>{ct.icon}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: form.cargo_type === ct.id ? '#fff' : C.text }}>{ct.label}</Text>
                      {ct.hazmat && <Text style={{ fontSize: 9, color: form.cargo_type === ct.id ? '#FCA5A5' : C.danger }}>HAZMAT</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {selectedCargo?.hazmat && (
                <View style={{ backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.danger, marginBottom: 6 }}>☢️ Información HAZMAT</Text>
                  <TextInput style={s.input} placeholder="Clase HAZMAT (ej: 3 - Líquidos Inflamables)" value={form.hazmat_class}
                    onChangeText={v => setForm(p => ({...p, hazmat_class: v}))} placeholderTextColor={C.muted} />
                  <TextInput style={[s.input, { marginBottom: 0 }]} placeholder="Placard # (ej: 1203)" value={form.hazmat_placard}
                    onChangeText={v => setForm(p => ({...p, hazmat_placard: v}))} placeholderTextColor={C.muted} />
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Capacidad (gal)</Text>
                  <TextInput style={s.input} placeholder="9,000" keyboardType="numeric" value={form.capacity_gallons}
                    onChangeText={v => setForm(p => ({...p, capacity_gallons: v}))} placeholderTextColor={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Galones Cargados</Text>
                  <TextInput style={s.input} placeholder="8,500" keyboardType="numeric" value={form.loaded_gallons}
                    onChangeText={v => setForm(p => ({...p, loaded_gallons: v}))} placeholderTextColor={C.muted} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Origen</Text>
                  <TextInput style={s.input} placeholder="Terminal, Ciudad" value={form.origin}
                    onChangeText={v => setForm(p => ({...p, origin: v}))} placeholderTextColor={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Destino</Text>
                  <TextInput style={s.input} placeholder="Estación, Ciudad" value={form.destination}
                    onChangeText={v => setForm(p => ({...p, destination: v}))} placeholderTextColor={C.muted} />
                </View>
              </View>

              <Text style={s.formLabel}>Tarifa ($)</Text>
              <TextInput style={s.input} placeholder="0.00" keyboardType="numeric" value={form.rate}
                onChangeText={v => setForm(p => ({...p, rate: v}))} placeholderTextColor={C.muted} />

              {/* Wash Section */}
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.brand, marginBottom: 8 }}>🚿 Lavado (Wash-out)</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity onPress={() => setForm(p => ({...p, wash_required: !p.wash_required}))}
                    style={[s.toggleBtn, { flex: 1 }, form.wash_required && { backgroundColor: C.warning, borderColor: C.warning }]}>
                    <Text style={{ fontWeight: '600', color: form.wash_required ? '#fff' : C.text }}>
                      {form.wash_required ? '✅ Requerido' : 'No requerido'}
                    </Text>
                  </TouchableOpacity>
                  {form.wash_required && (
                    <TouchableOpacity onPress={() => setForm(p => ({...p, wash_completed: !p.wash_completed}))}
                      style={[s.toggleBtn, { flex: 1 }, form.wash_completed && { backgroundColor: C.success, borderColor: C.success }]}>
                      <Text style={{ fontWeight: '600', color: form.wash_completed ? '#fff' : C.text }}>
                        {form.wash_completed ? '✅ Completado' : 'Pendiente'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {form.wash_required && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[s.input, { flex: 2, marginBottom: 0 }]} placeholder="Ubicación del wash" value={form.wash_location}
                      onChangeText={v => setForm(p => ({...p, wash_location: v}))} placeholderTextColor={C.muted} />
                    <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} placeholder="$ Costo" keyboardType="numeric" value={form.wash_cost}
                      onChangeText={v => setForm(p => ({...p, wash_cost: v}))} placeholderTextColor={C.muted} />
                  </View>
                )}
              </View>

              <Text style={s.formLabel}>Notas</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top' }]} multiline placeholder="Notas..."
                value={form.notes} onChangeText={v => setForm(p => ({...p, notes: v}))} placeholderTextColor={C.muted} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' },
  statCard: { borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', color: C.sub, marginTop: 2 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  input: {
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  formLabel: { fontSize: 13, fontWeight: '600', color: C.sub, marginBottom: 6, marginTop: 4 },
  toggleBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 2,
  },
});
