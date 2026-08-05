/**
 * AI Load Planner — Planificador de Carga Inteligente para Car Haulers
 * Visualizador de trailer con posiciones optimizadas por AI
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Modal, Platform, KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText, Line, G, Circle } from 'react-native-svg';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  bg: '#F2F2F7', card: '#fff', text: '#1C1C1E', sub: '#636366', muted: '#AEAEB2',
  border: '#E5E5EA', brand: '#1E40AF', success: '#059669', danger: '#DC2626',
  warning: '#D97706', purple: '#7C3AED',
};

const VEHICLE_TYPES = [
  { id: 'sedan', label: 'Sedán', icon: '🚗', weight: 3500, color: '#3B82F6' },
  { id: 'suv', label: 'SUV', icon: '🚙', weight: 4500, color: '#10B981' },
  { id: 'truck', label: 'Pickup', icon: '🛻', weight: 5500, color: '#F59E0B' },
  { id: 'van', label: 'Van', icon: '🚐', weight: 4800, color: '#8B5CF6' },
  { id: 'compact', label: 'Compacto', icon: '🏎️', weight: 2800, color: '#06B6D4' },
  { id: 'sports', label: 'Deportivo', icon: '🏎️', weight: 3200, color: '#EF4444' },
  { id: 'luxury', label: 'Lujo', icon: '✨', weight: 4200, color: '#EC4899' },
  { id: 'electric', label: 'Eléctrico', icon: '⚡', weight: 4800, color: '#14B8A6' },
  { id: 'motorcycle', label: 'Moto', icon: '🏍️', weight: 500, color: '#6366F1' },
];

const POSITION_LABELS: Record<string, string> = {
  U1: 'Superior Frente', U2: 'Superior Centro', U3: 'Superior Atrás', U4: 'Superior Extra',
  L1: 'Inferior Frente', L2: 'Inferior Centro', L3: 'Inferior Atrás', L4: 'Inferior Extra', L5: 'Inferior Cola',
};

export default function TruckerLoadPlannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<'input' | 'planning' | 'result'>('input');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [planResult, setPlanResult] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);

  const [vehicleForm, setVehicleForm] = useState({
    vin: '', year: '', make: '', model: '', color: '', type: 'sedan',
    pickup_address: '', delivery_address: '',
  });

  // VIN Decoder
  const [vinLoading, setVinLoading] = useState(false);
  const [vinDecoded, setVinDecoded] = useState<any>(null);

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const res = await api.get('/trucker/car-hauler/plans');
      setPlans(res.data.plans || []);
    } catch (e) {
      console.error('Load plans error', e);
    }
  };

  const addVehicle = () => {
    if (!vehicleForm.make || !vehicleForm.model) {
      Alert.alert('⚠️', 'Marca y modelo son requeridos');
      return;
    }
    setVehicles(prev => [...prev, { ...vehicleForm, id: Date.now(), vinDecoded }]);
    setVehicleForm({ vin: '', year: '', make: '', model: '', color: '', type: 'sedan', pickup_address: '', delivery_address: '' });
    setVinDecoded(null);
    setShowAddVehicle(false);
  };

  const decodeVin = async () => {
    const vin = vehicleForm.vin.trim().toUpperCase();
    if (vin.length !== 17) {
      Alert.alert('⚠️ VIN Inválido', 'El VIN debe tener exactamente 17 caracteres.');
      return;
    }
    setVinLoading(true);
    setVinDecoded(null);
    try {
      const res = await api.get(`/trucker/vin-decode/${vin}`);
      if (res.data?.success) {
        const d = res.data;
        setVehicleForm(prev => ({
          ...prev,
          year: d.year || prev.year,
          make: d.make || prev.make,
          model: d.model || prev.model,
          type: d.type || prev.type,
        }));
        setVinDecoded(d);
        Alert.alert('✅ VIN Decodificado', `${d.year} ${d.make} ${d.model}\n${d.body_class || ''}\n${d.engine || ''}`);
      } else {
        Alert.alert('❌ Error', 'No se pudo decodificar el VIN.');
      }
    } catch (e: any) {
      Alert.alert('❌ Error VIN', e?.response?.data?.detail || 'Error al conectar con NHTSA');
    } finally {
      setVinLoading(false);
    }
  };

  const removeVehicle = (id: number) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const generatePlan = async () => {
    if (vehicles.length < 2) {
      Alert.alert('⚠️', 'Agrega al menos 2 vehículos para optimizar la carga');
      return;
    }

    setStep('planning');
    try {
      const res = await api.post('/trucker/car-hauler/ai-plan', { vehicles });
      if (res.data.success) {
        setPlanResult(res.data);
        setStep('result');
      } else {
        Alert.alert('Error', 'No se pudo generar el plan');
        setStep('input');
      }
    } catch (e: any) {
      console.error('AI Plan error', e);
      Alert.alert('Error', 'Fallo al generar plan de carga');
      setStep('input');
    }
  };

  const resetPlan = () => {
    setStep('input');
    setPlanResult(null);
  };

  // ═══ RENDER ═══

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={['#4C1D95', '#7C3AED']} style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>🤖 AI Load Planner</Text>
            <Text style={{ fontSize: 12, color: '#C4B5FD' }}>Planificador inteligente de carga</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ═══ STEP: INPUT ═══ */}
      {step === 'input' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>
          {/* Info */}
          <View style={[s.card, { padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#C4B5FD' }]}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.purple, marginBottom: 6 }}>🤖 ¿Cómo funciona?</Text>
            <Text style={{ fontSize: 13, color: C.sub, lineHeight: 20 }}>
              1. Agrega los vehículos que necesitas transportar{'\n'}
              2. La AI analizará peso, altura y direcciones{'\n'}
              3. Recibirás el plan óptimo de carga con:{'\n'}
              {'   '}• Posición ideal para cada vehículo{'\n'}
              {'   '}• Orden de carga recomendado{'\n'}
              {'   '}• Distribución de peso{'\n'}
              {'   '}• Secuencia de entrega por ruta
            </Text>
          </View>

          {/* Vehicle List */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🚗 Vehículos ({vehicles.length}/9)</Text>
            <TouchableOpacity onPress={() => setShowAddVehicle(true)} disabled={vehicles.length >= 9}
              style={{ backgroundColor: vehicles.length >= 9 ? C.muted : C.purple, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          {vehicles.length === 0 ? (
            <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
              <Text style={{ fontSize: 50 }}>🚛</Text>
              <Text style={{ fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 8 }}>
                Agrega vehículos para que la AI planifique{'\n'}la carga óptima de tu trailer.
              </Text>
            </View>
          ) : (
            vehicles.map((v, idx) => {
              const vt = VEHICLE_TYPES.find(t => t.id === v.type);
              return (
                <View key={v.id} style={[s.card, { padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: vt?.color || C.brand }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                        {vt?.icon} {v.year} {v.make} {v.model}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                        {vt?.label} · {(vt?.weight || 3500).toLocaleString()} lbs · {v.color || 'Sin color'}
                      </Text>
                      {v.pickup_address ? (
                        <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }} numberOfLines={1}>
                          📍 {v.pickup_address} → {v.delivery_address}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity onPress={() => removeVehicle(v.id)} style={{ padding: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {vehicles.length >= 2 && (
            <TouchableOpacity onPress={generatePlan}
              style={{ backgroundColor: C.purple, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>🤖 Generar Plan con AI</Text>
            </TouchableOpacity>
          )}

          {/* Previous Plans */}
          {plans.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.sub, marginBottom: 8 }}>📋 Planes Anteriores</Text>
              {plans.slice(0, 3).map((plan: any) => (
                <TouchableOpacity key={plan.id} onPress={() => { setPlanResult(plan); setStep('result'); }}
                  style={[s.card, { padding: 12, marginBottom: 6 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>
                      🚗 {plan.total_vehicles} vehículos · {plan.total_weight?.toLocaleString()} lbs
                    </Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>
                      {new Date(plan.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ═══ STEP: PLANNING (Loading) ═══ */}
      {step === 'planning' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator size="large" color={C.purple} />
            <Text style={{ fontSize: 24, marginTop: 16 }}>🤖</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 8 }}>Analizando tu carga...</Text>
            <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              La AI está calculando la distribución{'\n'}óptima de peso, altura y ruta de entrega{'\n'}para tus {vehicles.length} vehículos.
            </Text>
          </View>
        </View>
      )}

      {/* ═══ STEP: RESULT ═══ */}
      {step === 'result' && planResult && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
          {/* Trailer Visualization */}
          <View style={[s.card, { padding: 16, marginBottom: 16 }]}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12, textAlign: 'center' }}>
              🚛 Visualización del Trailer
            </Text>
            <TrailerVisualization plan={planResult.plan} vehicles={vehicles.length > 0 ? vehicles : planResult.vehicles} />
          </View>

          {/* Weight Analysis */}
          {planResult.weight_analysis && (
            <View style={[s.card, { padding: 16, marginBottom: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>⚖️ Distribución de Peso</Text>
              <WeightDistribution analysis={planResult.weight_analysis} />
            </View>
          )}

          {/* Load Order */}
          {planResult.plan && planResult.plan.length > 0 && (
            <View style={[s.card, { padding: 16, marginBottom: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>📋 Orden de Carga Recomendado</Text>
              {planResult.plan.map((item: any, idx: number) => {
                const v = (vehicles.length > 0 ? vehicles : planResult.vehicles || [])[item.vehicle_index - 1];
                const vt = VEHICLE_TYPES.find(t => t.id === (v?.type || 'sedan'));
                return (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: idx < planResult.plan.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: vt?.color || C.brand, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>
                        {vt?.icon} {v?.year || ''} {v?.make || `Vehículo ${item.vehicle_index}`} {v?.model || ''}
                      </Text>
                      <Text style={{ fontSize: 12, color: C.sub }}>{POSITION_LABELS[item.position] || item.position}</Text>
                    </View>
                    <View style={{ backgroundColor: item.deck === 'upper' ? '#EFF6FF' : '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: item.deck === 'upper' ? C.brand : C.success }}>
                        {item.position}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Route Sequence */}
          {planResult.route_sequence && planResult.route_sequence.length > 0 && (
            <View style={[s.card, { padding: 16, marginBottom: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>🗺️ Secuencia de Entrega</Text>
              {planResult.route_sequence.map((addr: string, idx: number) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.brand, width: 24 }}>{idx + 1}.</Text>
                  <Text style={{ fontSize: 13, color: C.text, flex: 1 }}>{addr}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tips */}
          {planResult.tips && planResult.tips.length > 0 && (
            <View style={[s.card, { padding: 16, marginBottom: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.warning, marginBottom: 8 }}>💡 Recomendaciones</Text>
              {planResult.tips.map((tip: string, idx: number) => (
                <Text key={idx} style={{ fontSize: 13, color: C.text, marginBottom: 4, lineHeight: 18 }}>• {tip}</Text>
              ))}
            </View>
          )}

          {/* Safety Notes */}
          {planResult.safety_notes && planResult.safety_notes.length > 0 && (
            <View style={[s.card, { padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.danger, marginBottom: 8 }}>⚠️ Notas de Seguridad</Text>
              {planResult.safety_notes.map((note: string, idx: number) => (
                <Text key={idx} style={{ fontSize: 13, color: C.text, marginBottom: 4, lineHeight: 18 }}>• {note}</Text>
              ))}
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity onPress={resetPlan}
            style={{ backgroundColor: C.purple, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>🔄 Nuevo Plan</Text>
          </TouchableOpacity>

          {planResult.fallback && (
            <Text style={{ fontSize: 11, color: C.warning, textAlign: 'center', marginTop: 8 }}>
              ⚡ Plan generado con reglas básicas. La AI no estaba disponible temporalmente.
            </Text>
          )}
        </ScrollView>
      )}

      {/* ═══ ADD VEHICLE MODAL ═══ */}
      <Modal visible={showAddVehicle} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setShowAddVehicle(false)}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🚗 Agregar Vehículo</Text>
              <TouchableOpacity onPress={addVehicle}>
                <Text style={{ color: C.brand, fontWeight: '700' }}>Agregar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.formLabel}>Tipo de Vehículo *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {VEHICLE_TYPES.map(vt => (
                    <TouchableOpacity key={vt.id} onPress={() => setVehicleForm(p => ({...p, type: vt.id}))}
                      style={[s.typeBtn, vehicleForm.type === vt.id && { backgroundColor: vt.color, borderColor: vt.color }]}>
                      <Text style={{ fontSize: 20 }}>{vt.icon}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: vehicleForm.type === vt.id ? '#fff' : C.text }}>{vt.label}</Text>
                      <Text style={{ fontSize: 9, color: vehicleForm.type === vt.id ? 'rgba(255,255,255,0.8)' : C.muted }}>{vt.weight.toLocaleString()}lb</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* ── VIN WITH DECODE BUTTON ── */}
              <Text style={s.formLabel}>VIN (Auto-llenar con escaneo)</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="17 caracteres"
                  value={vehicleForm.vin}
                  onChangeText={v => {
                    setVehicleForm(p => ({...p, vin: v.toUpperCase()}));
                    if (vinDecoded) setVinDecoded(null);
                  }}
                  maxLength={17}
                  autoCapitalize="characters"
                  placeholderTextColor={C.muted}
                />
                <TouchableOpacity
                  onPress={decodeVin}
                  disabled={vinLoading || vehicleForm.vin.length !== 17}
                  style={{
                    backgroundColor: vehicleForm.vin.length === 17 ? C.brand : '#D1D5DB',
                    borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
                    minWidth: 48,
                  }}
                >
                  {vinLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="scan-outline" size={22} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
                {vehicleForm.vin.length}/17 · Toca el botón para decodificar automáticamente
              </Text>

              {/* VIN Decoded Info */}
              {vinDecoded && (
                <View style={{
                  backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 12,
                  borderWidth: 1, borderColor: '#86EFAC',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="checkmark-circle" size={18} color={C.success} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#166534' }}>VIN Decodificado</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {vinDecoded.body_class ? (
                      <View style={s.vinTag}><Text style={s.vinTagText}>🚗 {vinDecoded.body_class}</Text></View>
                    ) : null}
                    {vinDecoded.engine ? (
                      <View style={s.vinTag}><Text style={s.vinTagText}>⚙️ {vinDecoded.engine}</Text></View>
                    ) : null}
                    {vinDecoded.drive_type ? (
                      <View style={s.vinTag}><Text style={s.vinTagText}>🔄 {vinDecoded.drive_type}</Text></View>
                    ) : null}
                    {vinDecoded.fuel_type ? (
                      <View style={s.vinTag}><Text style={s.vinTagText}>⛽ {vinDecoded.fuel_type}</Text></View>
                    ) : null}
                    {vinDecoded.weight_lbs > 0 ? (
                      <View style={s.vinTag}><Text style={s.vinTagText}>⚖️ {vinDecoded.weight_lbs.toLocaleString()} lbs</Text></View>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Año</Text>
                  <TextInput style={s.input} placeholder="2024" keyboardType="numeric" value={vehicleForm.year}
                    onChangeText={v => setVehicleForm(p => ({...p, year: v}))} placeholderTextColor={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Marca *</Text>
                  <TextInput style={s.input} placeholder="Honda" value={vehicleForm.make}
                    onChangeText={v => setVehicleForm(p => ({...p, make: v}))} placeholderTextColor={C.muted} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Modelo *</Text>
                  <TextInput style={s.input} placeholder="Civic" value={vehicleForm.model}
                    onChangeText={v => setVehicleForm(p => ({...p, model: v}))} placeholderTextColor={C.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Color</Text>
                  <TextInput style={s.input} placeholder="Blanco" value={vehicleForm.color}
                    onChangeText={v => setVehicleForm(p => ({...p, color: v}))} placeholderTextColor={C.muted} />
                </View>
              </View>

              <Text style={s.formLabel}>📍 Dirección de Pickup</Text>
              <TextInput style={s.input} placeholder="Ej: 123 Main St, Miami, FL" value={vehicleForm.pickup_address}
                onChangeText={v => setVehicleForm(p => ({...p, pickup_address: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>🏁 Dirección de Entrega</Text>
              <TextInput style={s.input} placeholder="Ej: 456 Park Ave, New York, NY" value={vehicleForm.delivery_address}
                onChangeText={v => setVehicleForm(p => ({...p, delivery_address: v}))} placeholderTextColor={C.muted} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════
// ─── TRAILER VISUALIZATION COMPONENT ───
// ═══════════════════════════════════════════

function TrailerVisualization({ plan, vehicles }: { plan: any[]; vehicles: any[] }) {
  const svgWidth = SCREEN_WIDTH - 64;
  const svgHeight = 200;
  const trailerWidth = svgWidth - 30;
  const deckHeight = 70;
  const deckGap = 10;
  const startX = 15;
  const upperY = 15;
  const lowerY = upperY + deckHeight + deckGap;

  const upperSlots = 4;
  const lowerSlots = 5;
  const upperSlotWidth = trailerWidth / upperSlots;
  const lowerSlotWidth = trailerWidth / lowerSlots;

  const getVehicleColor = (vehicleIndex: number) => {
    const v = vehicles[vehicleIndex - 1];
    if (!v) return '#94A3B8';
    const vt = VEHICLE_TYPES.find(t => t.id === v.type);
    return vt?.color || '#94A3B8';
  };

  const getVehicleLabel = (vehicleIndex: number) => {
    const v = vehicles[vehicleIndex - 1];
    if (!v) return `V${vehicleIndex}`;
    return `${v.make?.substring(0, 4) || '?'}`;
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={svgWidth} height={svgHeight}>
        {/* Upper Deck */}
        <Rect x={startX} y={upperY} width={trailerWidth} height={deckHeight}
          rx={6} fill="#EFF6FF" stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="4,2" />
        <SvgText x={startX + 4} y={upperY + 12} fontSize={9} fill="#3B82F6" fontWeight="bold">
          UPPER DECK
        </SvgText>

        {/* Upper Slots */}
        {Array.from({ length: upperSlots }).map((_, i) => {
          const x = startX + i * upperSlotWidth + 2;
          const pos = `U${i + 1}`;
          const planned = plan.find(p => p.position === pos);
          const filled = !!planned;
          const color = planned ? getVehicleColor(planned.vehicle_index) : '#E2E8F0';
          return (
            <G key={pos}>
              <Rect x={x} y={upperY + 18} width={upperSlotWidth - 4} height={deckHeight - 24}
                rx={4} fill={color} opacity={filled ? 0.85 : 0.3} />
              <SvgText x={x + upperSlotWidth / 2 - 2} y={upperY + 38}
                fontSize={filled ? 10 : 8} fill={filled ? '#fff' : '#94A3B8'}
                textAnchor="middle" fontWeight="bold">
                {filled ? getVehicleLabel(planned.vehicle_index) : pos}
              </SvgText>
              {filled && (
                <SvgText x={x + upperSlotWidth / 2 - 2} y={upperY + 52}
                  fontSize={8} fill="#fff" textAnchor="middle">
                  {pos}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Lower Deck */}
        <Rect x={startX} y={lowerY} width={trailerWidth} height={deckHeight}
          rx={6} fill="#ECFDF5" stroke="#10B981" strokeWidth={1.5} strokeDasharray="4,2" />
        <SvgText x={startX + 4} y={lowerY + 12} fontSize={9} fill="#10B981" fontWeight="bold">
          LOWER DECK
        </SvgText>

        {/* Lower Slots */}
        {Array.from({ length: lowerSlots }).map((_, i) => {
          const x = startX + i * lowerSlotWidth + 2;
          const pos = `L${i + 1}`;
          const planned = plan.find(p => p.position === pos);
          const filled = !!planned;
          const color = planned ? getVehicleColor(planned.vehicle_index) : '#E2E8F0';
          return (
            <G key={pos}>
              <Rect x={x} y={lowerY + 18} width={lowerSlotWidth - 4} height={deckHeight - 24}
                rx={4} fill={color} opacity={filled ? 0.85 : 0.3} />
              <SvgText x={x + lowerSlotWidth / 2 - 2} y={lowerY + 38}
                fontSize={filled ? 10 : 8} fill={filled ? '#fff' : '#94A3B8'}
                textAnchor="middle" fontWeight="bold">
                {filled ? getVehicleLabel(planned.vehicle_index) : pos}
              </SvgText>
              {filled && (
                <SvgText x={x + lowerSlotWidth / 2 - 2} y={lowerY + 52}
                  fontSize={8} fill="#fff" textAnchor="middle">
                  {pos}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Truck cab indicator */}
        <Rect x={svgWidth - 18} y={lowerY + 20} width={12} height={deckHeight - 30}
          rx={3} fill="#374151" />
        <SvgText x={svgWidth - 14} y={lowerY + 44} fontSize={6} fill="#fff" textAnchor="middle">
          CAB
        </SvgText>
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'center' }}>
        {plan.map((item: any) => {
          const v = vehicles[item.vehicle_index - 1];
          const vt = VEHICLE_TYPES.find(t => t.id === (v?.type || 'sedan'));
          return (
            <View key={item.position} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: vt?.color || '#94A3B8' }} />
              <Text style={{ fontSize: 10, color: C.sub }}>{item.position}: {v?.make || `V${item.vehicle_index}`}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════
// ─── WEIGHT DISTRIBUTION COMPONENT ───
// ═══════════════════════════════════════════

function WeightDistribution({ analysis }: { analysis: any }) {
  const total = analysis.total_weight || 1;
  const upperPct = Math.round((analysis.upper_deck_weight || 0) / total * 100);
  const lowerPct = 100 - upperPct;
  const balanceScore = analysis.balance_score || 50;
  const scoreColor = balanceScore >= 75 ? C.success : balanceScore >= 50 ? C.warning : C.danger;

  return (
    <View>
      {/* Balance Score */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: C.sub }}>Balance Score</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 100, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
            <View style={{ width: `${balanceScore}%`, height: '100%', borderRadius: 4, backgroundColor: scoreColor }} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: scoreColor }}>{balanceScore}%</Text>
        </View>
      </View>

      {/* Weight bars */}
      <View style={{ gap: 8 }}>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: C.brand, fontWeight: '600' }}>Deck Superior</Text>
            <Text style={{ fontSize: 12, color: C.text, fontWeight: '700' }}>
              {(analysis.upper_deck_weight || 0).toLocaleString()} lbs ({upperPct}%)
            </Text>
          </View>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: '#EFF6FF', overflow: 'hidden' }}>
            <View style={{ width: `${upperPct}%`, height: '100%', borderRadius: 6, backgroundColor: '#3B82F6' }} />
          </View>
        </View>
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 12, color: C.success, fontWeight: '600' }}>Deck Inferior</Text>
            <Text style={{ fontSize: 12, color: C.text, fontWeight: '700' }}>
              {(analysis.lower_deck_weight || 0).toLocaleString()} lbs ({lowerPct}%)
            </Text>
          </View>
          <View style={{ height: 12, borderRadius: 6, backgroundColor: '#ECFDF5', overflow: 'hidden' }}>
            <View style={{ width: `${lowerPct}%`, height: '100%', borderRadius: 6, backgroundColor: '#10B981' }} />
          </View>
        </View>
      </View>

      {/* Total */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>Total</Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: total > 80000 ? C.danger : C.text }}>
          {total.toLocaleString()} lbs {total > 80000 ? '⚠️ EXCEDE 80K' : ''}
        </Text>
      </View>

      {/* Warnings */}
      {analysis.warnings && analysis.warnings.length > 0 && (
        <View style={{ marginTop: 8 }}>
          {analysis.warnings.map((w: string, i: number) => (
            <Text key={i} style={{ fontSize: 12, color: C.danger, fontWeight: '600' }}>{w}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' },
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
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 2, minWidth: 65,
  },
  vinTag: {
    backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0',
  },
  vinTagText: {
    fontSize: 11, fontWeight: '600', color: '#166534',
  },
});
