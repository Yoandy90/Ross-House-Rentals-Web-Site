/**
 * Reefer Temperature & Fuel Management — Control de Temperatura Refrigerado
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
  warning: '#D97706', cyan: '#0891B2',
};

const REEFER_CARGO = [
  { id: 'produce', label: 'Frutas/Verduras', icon: '🥬', temp: '34°F' },
  { id: 'meat', label: 'Carnes', icon: '🥩', temp: '28°F' },
  { id: 'frozen', label: 'Congelados', icon: '🧊', temp: '-10°F' },
  { id: 'dairy', label: 'Lácteos', icon: '🧀', temp: '36°F' },
  { id: 'pharma', label: 'Farmacéuticos', icon: '💊', temp: '46°F' },
  { id: 'flowers', label: 'Flores', icon: '💐', temp: '34°F' },
  { id: 'beverages', label: 'Bebidas', icon: '🥤', temp: '40°F' },
  { id: 'other', label: 'Otro', icon: '📦', temp: '35°F' },
];

export default function TruckerReeferScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    set_temp: '', actual_temp: '', temp_unit: 'F',
    cargo_type: '', pre_cool_hours: '',
    reefer_fuel_gallons: '', reefer_fuel_cost: '', reefer_hours: '',
    location: '', notes: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/trucker/reefer/temp-logs?limit=20');
      setLogs(res.data.logs || []);
      setStats(res.data.stats || {});
    } catch (e) {
      console.error('Reefer load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveLog = async () => {
    if (!form.set_temp && !form.actual_temp) {
      Alert.alert('⚠️', 'Ingresa al menos una lectura de temperatura');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/trucker/reefer/temp-log', {
        ...form,
        set_temp: form.set_temp ? parseFloat(form.set_temp) : null,
        actual_temp: form.actual_temp ? parseFloat(form.actual_temp) : null,
        pre_cool_hours: parseFloat(form.pre_cool_hours) || 0,
        reefer_fuel_gallons: parseFloat(form.reefer_fuel_gallons) || 0,
        reefer_fuel_cost: parseFloat(form.reefer_fuel_cost) || 0,
        reefer_hours: parseFloat(form.reefer_hours) || 0,
      });

      if (res.data.temp_ok) {
        Alert.alert('✅ Temperatura OK', `Set: ${form.set_temp}°${form.temp_unit} · Actual: ${form.actual_temp}°${form.temp_unit}`);
      } else {
        Alert.alert('⚠️ Alerta de Temperatura', `La temperatura actual (${form.actual_temp}°${form.temp_unit}) se desvía de la configurada (${form.set_temp}°${form.temp_unit}).`);
      }
      setShowNew(false);
      setForm({ set_temp: '', actual_temp: '', temp_unit: 'F', cargo_type: '', pre_cool_hours: '',
        reefer_fuel_gallons: '', reefer_fuel_cost: '', reefer_hours: '', location: '', notes: '' });
      loadData();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar');
    }
    setSaving(false);
  };

  const deleteLog = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/trucker/reefer/temp-logs/${id}`); loadData(); }
        catch { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]);
  };

  if (loading) return (
    <View style={[s.center, { flex: 1, backgroundColor: C.bg }]}>
      <ActivityIndicator size="large" color={C.cyan} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#0E7490', '#155E75']} style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }}>❄️ Reefer — Temperatura</Text>
          <TouchableOpacity onPress={() => setShowNew(true)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Log</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>

        {/* Stats */}
        {stats.total_logs > 0 && (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#ECFEFF' }]}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#0E7490' }}>{stats.avg_set_temp || 0}°</Text>
                <Text style={s.statLabel}>Temp Prom.</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: stats.temp_alerts > 0 ? '#FEF2F2' : '#ECFDF5' }]}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: stats.temp_alerts > 0 ? C.danger : C.success }}>{stats.temp_alerts || 0}</Text>
                <Text style={s.statLabel}>Alertas</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#FFFBEB' }]}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: C.warning }}>{stats.total_reefer_fuel || 0}</Text>
                <Text style={s.statLabel}>Gal Reefer</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E40AF' }}>{stats.total_reefer_hours || 0}h</Text>
                <Text style={s.statLabel}>Horas Reefer</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#FEF2F2' }]}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.danger }}>${stats.total_reefer_fuel_cost || 0}</Text>
                <Text style={s.statLabel}>Costo Diesel Reefer</Text>
              </View>
            </View>
          </>
        )}

        {/* Temp Logs */}
        {logs.length === 0 ? (
          <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
            <Text style={{ fontSize: 50 }}>❄️</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 8 }}>Sin Registros de Temperatura</Text>
            <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 4 }}>
              Presiona "+ Log" para registrar tu primera lectura.
            </Text>
          </View>
        ) : (
          logs.map((log: any) => {
            const ct = REEFER_CARGO.find(t => t.id === log.cargo_type);
            return (
              <TouchableOpacity key={log.id} onLongPress={() => deleteLog(log.id)}
                style={[s.card, { padding: 14, marginBottom: 8, borderLeftWidth: 4,
                  borderLeftColor: log.temp_ok ? C.success : C.danger }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: log.temp_ok ? '#ECFDF5' : '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: log.temp_ok ? C.success : C.danger }}>
                        {log.temp_ok ? '✅ OK' : '⚠️ ALERTA'}
                      </Text>
                    </View>
                    {ct && <Text style={{ fontSize: 13, color: C.sub }}>{ct.icon} {ct.label}</Text>}
                  </View>
                  <Text style={{ fontSize: 12, color: C.muted }}>{log.date}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.cyan }}>
                    🌡️ Set: {log.set_temp}°{log.temp_unit}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: log.temp_ok ? C.success : C.danger }}>
                    📊 Actual: {log.actual_temp}°{log.temp_unit}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 14 }}>
                  {log.reefer_fuel_gallons > 0 && <Text style={{ fontSize: 12, color: C.warning }}>⛽ {log.reefer_fuel_gallons} gal</Text>}
                  {log.reefer_hours > 0 && <Text style={{ fontSize: 12, color: C.brand }}>⏱️ {log.reefer_hours}h</Text>}
                  {log.pre_cool_hours > 0 && <Text style={{ fontSize: 12, color: C.cyan }}>❄️ Pre-cool: {log.pre_cool_hours}h</Text>}
                </View>
                {log.location && <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>📍 {log.location}</Text>}
              </TouchableOpacity>
            );
          })
        )}
        <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 }}>Mantén presionado para eliminar</Text>
      </ScrollView>

      {/* ── NEW TEMP LOG MODAL ── */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setShowNew(false)}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>❄️ Nuevo Registro</Text>
              <TouchableOpacity onPress={saveLog} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={C.brand} /> : (
                  <Text style={{ color: C.brand, fontWeight: '700' }}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Temperature Section */}
              <View style={{ backgroundColor: '#ECFEFF', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#A5F3FC' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0E7490', marginBottom: 10 }}>🌡️ Temperatura</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity onPress={() => setForm(p => ({...p, temp_unit: 'F'}))}
                    style={[s.toggleBtn, { flex: 1 }, form.temp_unit === 'F' && { backgroundColor: C.cyan, borderColor: C.cyan }]}>
                    <Text style={{ fontWeight: '700', color: form.temp_unit === 'F' ? '#fff' : C.text }}>°F Fahrenheit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setForm(p => ({...p, temp_unit: 'C'}))}
                    style={[s.toggleBtn, { flex: 1 }, form.temp_unit === 'C' && { backgroundColor: C.cyan, borderColor: C.cyan }]}>
                    <Text style={{ fontWeight: '700', color: form.temp_unit === 'C' ? '#fff' : C.text }}>°C Celsius</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formLabel}>Set (Configurada)</Text>
                    <TextInput style={[s.input, { marginBottom: 0, fontSize: 20, textAlign: 'center', fontWeight: '700' }]}
                      placeholder="34" keyboardType="numeric" value={form.set_temp}
                      onChangeText={v => setForm(p => ({...p, set_temp: v}))} placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formLabel}>Actual (Lectura)</Text>
                    <TextInput style={[s.input, { marginBottom: 0, fontSize: 20, textAlign: 'center', fontWeight: '700' }]}
                      placeholder="35" keyboardType="numeric" value={form.actual_temp}
                      onChangeText={v => setForm(p => ({...p, actual_temp: v}))} placeholderTextColor={C.muted} />
                  </View>
                </View>
              </View>

              {/* Cargo Type */}
              <Text style={s.formLabel}>Tipo de Carga</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {REEFER_CARGO.map(ct => (
                    <TouchableOpacity key={ct.id} onPress={() => setForm(p => ({...p, cargo_type: ct.id}))}
                      style={[s.toggleBtn, form.cargo_type === ct.id && { backgroundColor: C.cyan, borderColor: C.cyan }]}>
                      <Text style={{ fontSize: 18 }}>{ct.icon}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: form.cargo_type === ct.id ? '#fff' : C.text }}>{ct.label}</Text>
                      <Text style={{ fontSize: 9, color: form.cargo_type === ct.id ? '#A5F3FC' : C.muted }}>{ct.temp}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Pre-cool */}
              <Text style={s.formLabel}>Pre-enfriamiento (horas)</Text>
              <TextInput style={s.input} placeholder="Ej: 2.5" keyboardType="numeric" value={form.pre_cool_hours}
                onChangeText={v => setForm(p => ({...p, pre_cool_hours: v}))} placeholderTextColor={C.muted} />

              {/* Reefer Fuel */}
              <View style={{ backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.warning, marginBottom: 10 }}>⛽ Diesel del Reefer</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formLabel}>Galones</Text>
                    <TextInput style={[s.input, { marginBottom: 0 }]} placeholder="0" keyboardType="numeric" value={form.reefer_fuel_gallons}
                      onChangeText={v => setForm(p => ({...p, reefer_fuel_gallons: v}))} placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formLabel}>Costo ($)</Text>
                    <TextInput style={[s.input, { marginBottom: 0 }]} placeholder="0.00" keyboardType="numeric" value={form.reefer_fuel_cost}
                      onChangeText={v => setForm(p => ({...p, reefer_fuel_cost: v}))} placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formLabel}>Horas Motor</Text>
                    <TextInput style={[s.input, { marginBottom: 0 }]} placeholder="0" keyboardType="numeric" value={form.reefer_hours}
                      onChangeText={v => setForm(p => ({...p, reefer_hours: v}))} placeholderTextColor={C.muted} />
                  </View>
                </View>
              </View>

              <Text style={s.formLabel}>Ubicación</Text>
              <TextInput style={s.input} placeholder="Dónde se tomó la lectura" value={form.location}
                onChangeText={v => setForm(p => ({...p, location: v}))} placeholderTextColor={C.muted} />

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
