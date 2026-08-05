/**
 * Car Hauler Load Planner — Planificador de Carga para Car Haulers
 * Features: Visual trailer, VIN Scanner (NHTSA + Camera Barcode), Inspection Photos
 * Fixed: No nested modals (causes iOS freeze) - Pickers are inline
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal, Platform, KeyboardAvoidingView, FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { VEHICLE_MAKE_LIST, getModelsForMake } from '../src/data/vehicleDatabase';
import { INSPECTION_ILLUSTRATIONS } from '../src/components/CarInspectionIllustrations';

const C = {
  bg: '#F2F2F7', card: '#fff', text: '#1C1C1E', sub: '#636366', muted: '#AEAEB2',
  border: '#E5E5EA', brand: '#1E40AF', success: '#059669', danger: '#DC2626',
  warning: '#D97706', purple: '#7C3AED',
};

const VEHICLE_TYPES = [
  { id: 'sedan', label: 'Sedán', icon: '🚗', weight: 3500 },
  { id: 'suv', label: 'SUV', icon: '🚙', weight: 4500 },
  { id: 'truck', label: 'Pickup', icon: '🛻', weight: 5500 },
  { id: 'van', label: 'Van', icon: '🚐', weight: 4800 },
  { id: 'compact', label: 'Compacto', icon: '🏎️', weight: 2800 },
  { id: 'sports', label: 'Deportivo', icon: '🏎️', weight: 3200 },
  { id: 'luxury', label: 'Lujo', icon: '✨', weight: 4200 },
  { id: 'electric', label: 'Eléctrico', icon: '⚡', weight: 4800 },
  { id: 'motorcycle', label: 'Moto', icon: '🏍️', weight: 500 },
];

const SLOTS = [
  { slot: 1, deck: 'upper', label: 'U1' },
  { slot: 2, deck: 'upper', label: 'U2' },
  { slot: 3, deck: 'upper', label: 'U3' },
  { slot: 4, deck: 'upper', label: 'U4' },
  { slot: 5, deck: 'lower', label: 'L1' },
  { slot: 6, deck: 'lower', label: 'L2' },
  { slot: 7, deck: 'lower', label: 'L3' },
  { slot: 8, deck: 'lower', label: 'L4' },
  { slot: 9, deck: 'lower', label: 'L5' },
];

export default function TruckerCarHaulerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loads, setLoads] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<'load' | 'vehicle' | 'makePicker' | 'modelPicker' | 'vinScanner' | 'guidedInspection'>('load');
  const [editingSlot, setEditingSlot] = useState<number>(1);
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Camera permissions for VIN scanner
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [vinScanned, setVinScanned] = useState(false);

  const [loadForm, setLoadForm] = useState({
    load_number: '', broker: '', pickup_location: '', delivery_location: '', rate: '', notes: '',
  });
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleForm, setVehicleForm] = useState({
    vin: '', year: '', make: '', model: '', color: '',
    type: 'sedan', pickup_address: '', delivery_address: '', condition_notes: '',
  });

  // VIN Decoder states
  const [vinLoading, setVinLoading] = useState(false);
  const [vinDecoded, setVinDecoded] = useState<any>(null);

  // Inspection photos
  const [inspectionPhotos, setInspectionPhotos] = useState<{ uri: string; label: string; timestamp: string }[]>([]);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);

  const [makeSearch, setMakeSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');

  const filteredMakes = useMemo(() => {
    if (!makeSearch) return VEHICLE_MAKE_LIST;
    return VEHICLE_MAKE_LIST.filter(m => m.toLowerCase().includes(makeSearch.toLowerCase()));
  }, [makeSearch]);

  const filteredModels = useMemo(() => {
    const models = getModelsForMake(vehicleForm.make);
    if (!modelSearch) return models;
    return models.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));
  }, [vehicleForm.make, modelSearch]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await api.get('/trucker/car-hauler/loads?limit=20');
      setLoads(res.data.loads || []);
    } catch (e) {
      console.error('Car hauler loads error', e);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const openNewLoad = () => {
    setEditingLoadId(null);
    setLoadForm({ load_number: '', broker: '', pickup_location: '', delivery_location: '', rate: '', notes: '' });
    setVehicles([]);
    setModalStep('load');
    setShowModal(true);
  };

  const openAddVehicle = (slot: number) => {
    setEditingSlot(slot);
    const existing = vehicles.find(v => v.slot === slot);
    if (existing) {
      setVehicleForm({ ...existing });
      setInspectionPhotos(existing.inspectionPhotos || []);
    } else {
      setVehicleForm({ vin: '', year: '', make: '', model: '', color: '', type: 'sedan', pickup_address: '', delivery_address: '', condition_notes: '' });
      setInspectionPhotos([]);
    }
    setVinDecoded(null);
    setMakeSearch('');
    setModelSearch('');
    setModalStep('vehicle');
  };

  // ─── VIN DECODER ───
  const decodeVin = async () => {
    const vin = vehicleForm.vin.trim().toUpperCase();
    if (vin.length !== 17) {
      Alert.alert('⚠️', t('carHauler.vinMust17'));
      return;
    }
    setVinLoading(true);
    setVinDecoded(null);
    try {
      const res = await api.get(`/trucker/vin-decode/${vin}`);
      if (res.data?.success) {
        const d = res.data;
        // Auto-fill form
        setVehicleForm(prev => ({
          ...prev,
          year: d.year || prev.year,
          make: d.make || prev.make,
          model: d.model || prev.model,
          type: d.type || prev.type,
        }));
        setVinDecoded(d);
        Alert.alert(
          '✅ VIN Decodificado',
          `${d.year} ${d.make} ${d.model}\n${d.body_class || ''}\n${d.engine || ''}`,
        );
      } else {
        Alert.alert('❌', t('carHauler.vinError'));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Error al conectar con NHTSA';
      Alert.alert('❌ Error VIN', msg);
    } finally {
      setVinLoading(false);
    }
  };

  // ─── VIN BARCODE SCANNER ───
  const openVinScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(t('carHauler.cameraPermission'), t('carHauler.cameraPermissionMsg'));
        return;
      }
    }
    setVinScanned(false);
    setModalStep('vinScanner');
  };

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (vinScanned) return; // Prevent multiple scans
    setVinScanned(true);
    // VIN barcodes typically contain 17 alphanumeric characters
    const cleanVin = data.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase().slice(0, 17);
    if (cleanVin.length === 17) {
      setVehicleForm(prev => ({ ...prev, vin: cleanVin }));
      setModalStep('vehicle');
      // Auto-decode
      setTimeout(() => {
        setVinLoading(true);
        api.get(`/trucker/vin-decode/${cleanVin}`).then(res => {
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
            Alert.alert(t('carHauler.vinScanned'), `${d.year} ${d.make} ${d.model}`);
          }
        }).catch(() => {}).finally(() => setVinLoading(false));
      }, 300);
    } else {
      Alert.alert(t('carHauler.invalidCode'), t('carHauler.invalidCodeMsg', { vin: cleanVin, length: cleanVin.length }));
      setVinScanned(false);
    }
  };

  // ─── INSPECTION PHOTOS ───
  // ─── GUIDED INSPECTION SYSTEM ───
  const INSPECTION_POSITIONS = [
    { id: 'front', label: t('carHauler.front'), icon: '🚗', description: t('carHauler.frontDesc'), emoji: '⬆️' },
    { id: 'rear', label: t('carHauler.rear'), icon: '🔙', description: t('carHauler.rearDesc'), emoji: '⬇️' },
    { id: 'left', label: t('carHauler.leftSide'), icon: '⬅️', description: t('carHauler.leftSideDesc'), emoji: '◀️' },
    { id: 'right', label: t('carHauler.rightSide'), icon: '➡️', description: t('carHauler.rightSideDesc'), emoji: '▶️' },
    { id: 'roof', label: t('carHauler.roof'), icon: '☁️', description: t('carHauler.roofDesc'), emoji: '🔝' },
    { id: 'interior', label: t('carHauler.interior'), icon: '🔑', description: t('carHauler.interiorDesc'), emoji: '📊' },
    { id: 'tires', label: t('carHauler.tires'), icon: '🛞', description: t('carHauler.tiresDesc'), emoji: '⭕' },
    { id: 'extra', label: t('carHauler.extra'), icon: '📸', description: t('carHauler.extraDesc'), emoji: '➕' },
  ];

  const DAMAGE_TYPES = [
    { id: 'none', label: t('carHauler.noDamage'), icon: '✅', color: '#059669' },
    { id: 'scratch', label: t('carHauler.scratch'), icon: '〰️', color: '#D97706' },
    { id: 'dent', label: t('carHauler.dent'), icon: '🔵', color: '#DC2626' },
    { id: 'crack', label: t('carHauler.crack'), icon: '💔', color: '#DC2626' },
    { id: 'paint', label: t('carHauler.paintDamage'), icon: '🎨', color: '#D97706' },
    { id: 'glass', label: t('carHauler.brokenGlass'), icon: '🪟', color: '#DC2626' },
    { id: 'missing', label: t('carHauler.missingPart'), icon: '❓', color: '#DC2626' },
    { id: 'rust', label: t('carHauler.rust'), icon: '🟤', color: '#D97706' },
    { id: 'other', label: t('carHauler.other'), icon: '📝', color: '#6B7280' },
  ];

  const [inspectionStep, setInspectionStep] = useState(0);
  const [currentDamages, setCurrentDamages] = useState<string[]>([]);
  const [damageNote, setDamageNote] = useState('');

  const startGuidedInspection = () => {
    setInspectionStep(0);
    setCurrentDamages([]);
    setDamageNote('');
    setModalStep('guidedInspection');
  };

  const takeGuidedPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('⚠️ Permiso Requerido', 'Se necesita acceso a la cámara para tomar fotos de inspección.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.4,
      base64: false,
      allowsEditing: false,
      exif: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const position = INSPECTION_POSITIONS[inspectionStep];
      const photo = {
        uri: result.assets[0].uri,
        label: position.label,
        position: position.id,
        damages: currentDamages,
        damageNote: damageNote,
        timestamp: new Date().toISOString(),
      };
      setInspectionPhotos(prev => {
        // Replace existing photo for this position if any
        const filtered = prev.filter(p => p.position !== position.id);
        return [...filtered, photo];
      });
      // Move to next position or finish
      if (inspectionStep < INSPECTION_POSITIONS.length - 1) {
        setInspectionStep(prev => prev + 1);
        setCurrentDamages([]);
        setDamageNote('');
      } else {
        Alert.alert(`✅ ${t('carHauler.inspectionComplete')}`, t('carHauler.inspectionCompleteMsg', { count: inspectionStep + 1 }));
        setModalStep('vehicle');
      }
    }
  };

  const skipPosition = () => {
    if (inspectionStep < INSPECTION_POSITIONS.length - 1) {
      setInspectionStep(prev => prev + 1);
      setCurrentDamages([]);
      setDamageNote('');
    } else {
      setModalStep('vehicle');
    }
  };

  const toggleDamage = (damageId: string) => {
    if (damageId === 'none') {
      setCurrentDamages(['none']);
      return;
    }
    setCurrentDamages(prev => {
      const without = prev.filter(d => d !== 'none'); // Remove 'none' if selecting a damage
      if (without.includes(damageId)) {
        return without.filter(d => d !== damageId);
      }
      return [...without, damageId];
    });
  };

  const takeInspectionPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('⚠️ Permiso Requerido', 'Se necesita acceso a la cámara para tomar fotos de inspección.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.4,
      base64: false,
      allowsEditing: false,
      exif: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const photo = {
        uri: result.assets[0].uri,
        label: `Foto ${inspectionPhotos.length + 1}`,
        position: 'extra',
        damages: [],
        damageNote: '',
        timestamp: new Date().toISOString(),
      };
      setInspectionPhotos(prev => [...prev, photo]);
    }
  };

  const pickInspectionPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('⚠️ Permiso Requerido', 'Se necesita acceso a la galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.4,
      base64: false,
      allowsMultipleSelection: true,
      selectionLimit: 3,
      exif: false,
    });
    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map((asset, idx) => ({
        uri: asset.uri,
        label: `Foto ${inspectionPhotos.length + idx + 1}`,
        position: 'extra',
        damages: [],
        damageNote: '',
        timestamp: new Date().toISOString(),
      }));
      setInspectionPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const removeInspectionPhoto = (idx: number) => {
    setInspectionPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const saveVehicle = () => {
    if (!vehicleForm.make || !vehicleForm.model) {
      Alert.alert('⚠️', 'Marca y modelo son requeridos');
      return;
    }
    const slotDef = SLOTS.find(s => s.slot === editingSlot);
    const vehicle = {
      ...vehicleForm,
      slot: editingSlot,
      deck: slotDef?.deck || 'lower',
      status: 'pending',
      inspectionPhotos: inspectionPhotos,
      vinDecoded: vinDecoded,
    };
    setVehicles(prev => {
      const filtered = prev.filter(v => v.slot !== editingSlot);
      return [...filtered, vehicle].sort((a, b) => a.slot - b.slot);
    });
    setModalStep('load'); // Go back to load view
  };

  const removeVehicle = (slot: number) => {
    setVehicles(prev => prev.filter(v => v.slot !== slot));
  };

  const saveLoad = async () => {
    if (vehicles.length === 0) { Alert.alert('⚠️', 'Agrega al menos un vehículo'); return; }
    setSaving(true);
    try {
      if (editingLoadId) {
        // Update existing load
        await api.put(`/trucker/car-hauler/loads/${editingLoadId}`, { ...loadForm, vehicles });
        const tw = vehicles.reduce((s, v) => s + (VEHICLE_TYPES.find(t => t.id === v.type)?.weight || 3500), 0);
        Alert.alert('✅ Carga Actualizada', `${vehicles.length} vehículos · ${tw.toLocaleString()} lbs`);
      } else {
        // Create new load
        await api.post('/trucker/car-hauler/loads', { ...loadForm, vehicles });
        const tw = vehicles.reduce((s, v) => s + (VEHICLE_TYPES.find(t => t.id === v.type)?.weight || 3500), 0);
        Alert.alert('✅ Carga Creada', `${vehicles.length} vehículos · ${tw.toLocaleString()} lbs`);
      }
      setShowModal(false);
      setEditingLoadId(null);
      loadData();
    } catch (e) { Alert.alert('Error', 'No se pudo guardar'); }
    setSaving(false);
  };

  const deleteLoad = async (loadId: string) => {
    try { await api.delete(`/trucker/car-hauler/loads/${loadId}`); loadData(); }
    catch { Alert.alert('Error', 'No se pudo eliminar'); }
  };

  const totalWeight = vehicles.reduce((s, v) => s + (VEHICLE_TYPES.find(t => t.id === v.type)?.weight || 3500), 0);

  if (loading) return (
    <View style={[st.center, { flex: 1, backgroundColor: C.bg }]}>
      <ActivityIndicator size="large" color={C.brand} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#4C1D95']} style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }}>🚗 {t('carHauler.title')}</Text>
          <TouchableOpacity onPress={openNewLoad}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('carHauler.newLoad')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        {loads.length === 0 ? (
          <View style={[st.card, { padding: 30, alignItems: 'center' }]}>
            <Text style={{ fontSize: 50 }}>🚗</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 8 }}>{t('carHauler.noLoads')}</Text>
            <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 4 }}>
              {t('carHauler.pullRefresh')}
            </Text>
          </View>
        ) : null}

        {loads.map((load: any) => (
          <View key={load.id} style={[st.card, { marginBottom: 10, borderLeftWidth: 4, borderLeftColor: load.status === 'delivered' ? C.success : load.status === 'in_transit' ? C.warning : C.purple }]}>
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>
                  {load.load_number || `Carga #${load.id?.slice(-6)}`}
                </Text>
                <View style={{ backgroundColor: load.status === 'delivered' ? '#ECFDF5' : load.status === 'in_transit' ? '#FFFBEB' : '#F3E8FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: load.status === 'delivered' ? C.success : load.status === 'in_transit' ? C.warning : C.purple }}>
                    {load.status === 'delivered' ? `✅ ${t('carHauler.delivered')}` : load.status === 'in_transit' ? `🚛 ${t('carHauler.inRoute')}` : `📋 ${t('carHauler.planning')}`}
                  </Text>
                </View>
              </View>
              {(load.pickup_location || load.delivery_location) ? (
                <Text style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}>{load.pickup_location} → {load.delivery_location}</Text>
              ) : null}
              {load.broker ? (
                <Text style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>🏢 {load.broker}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Text style={{ fontSize: 13, color: C.brand, fontWeight: '600' }}>🚗 {load.total_vehicles} vehículos</Text>
                <Text style={{ fontSize: 13, color: C.warning, fontWeight: '600' }}>⚖️ {load.estimated_weight?.toLocaleString()} lbs</Text>
                {load.rate ? <Text style={{ fontSize: 13, color: C.success, fontWeight: '600' }}>💰 ${load.rate}</Text> : null}
              </View>
            </View>

            {/* ── Action buttons ── */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
              {/* Edit button */}
              <TouchableOpacity
                onPress={() => {
                  // Load the existing data into the modal for editing
                  setEditingLoadId(load.id);
                  setLoadForm({
                    load_number: load.load_number || '',
                    broker: load.broker || '',
                    pickup_location: load.pickup_location || '',
                    delivery_location: load.delivery_location || '',
                    rate: load.rate?.toString() || '',
                    notes: load.notes || '',
                  });
                  setVehicles(load.vehicles || []);
                  setModalStep('load');
                  setShowModal(true);
                }}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  backgroundColor: '#EFF6FF', paddingVertical: 10, borderRadius: 10,
                  borderWidth: 1.5, borderColor: '#BFDBFE',
                }}
              >
                <Ionicons name="create-outline" size={16} color="#1E40AF" />
                <Text style={{ color: '#1E40AF', fontWeight: '700', fontSize: 13 }}>{t('carHauler.edit')}</Text>
              </TouchableOpacity>

              {/* Delete button */}
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    `🗑️ ${t('carHauler.deleteConfirm')}`,
                    t('carHauler.deleteMessage'),
                    [
                      { text: t('carHauler.cancel'), style: 'cancel' },
                      { text: t('carHauler.delete'), style: 'destructive', onPress: () => deleteLoad(load.id) },
                    ]
                  );
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                  backgroundColor: '#FEF2F2', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
                  borderWidth: 1.5, borderColor: '#FECACA',
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#DC2626" />
              </TouchableOpacity>

              {/* GPS / Delivered button */}
              {load.status !== 'delivered' && (
                <>
                  {load.status !== 'in_transit' ? (
                    <TouchableOpacity
                      onPress={() => {
                        router.push({
                          pathname: '/trucker-gps',
                          params: {
                            origin: load.pickup_location || '',
                            destination: load.delivery_location || '',
                            load_id: load.id,
                            load_number: load.load_number || `Carga #${load.id?.slice(-6)}`,
                          },
                        });
                      }}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        backgroundColor: '#059669', paddingVertical: 10, borderRadius: 10,
                      }}
                    >
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>GPS</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('✅ Marcar Entregada', `¿Marcar ${load.load_number || 'esta carga'} como entregada?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Confirmar', onPress: async () => {
                            try {
                              await api.put(`/trucker/car-hauler/loads/${load.id}`, { status: 'delivered' });
                              loadData();
                              Alert.alert('✅', 'Carga marcada como entregada');
                            } catch { Alert.alert('Error', 'No se pudo actualizar'); }
                          }},
                        ]);
                      }}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                        backgroundColor: C.success, paddingVertical: 10, borderRadius: 10,
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('carHauler.delivered')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── SINGLE MODAL (no nesting) ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            {/* Modal Header */}
            <View style={[st.modalHeader, { paddingTop: insets.top + 8 }]}>
              {modalStep === 'load' ? (
                <>
                  <TouchableOpacity onPress={() => { setShowModal(false); setEditingLoadId(null); }}>
                    <Text style={{ color: C.danger, fontWeight: '600' }}>{t('carHauler.cancel')}</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>
                    {editingLoadId ? `✏️ ${t('carHauler.editLoadTitle')}` : `🚗 ${t('carHauler.newLoadTitle')}`}
                  </Text>
                  <TouchableOpacity onPress={saveLoad} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color={C.brand} /> : (
                      <Text style={{ color: C.brand, fontWeight: '700' }}>{editingLoadId ? t('carHauler.update') : t('carHauler.save')}</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setModalStep('load')}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="arrow-back" size={18} color={C.brand} />
                      <Text style={{ color: C.brand, fontWeight: '600' }}>Atrás</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🚗 Pos. {editingSlot}</Text>
                  <TouchableOpacity onPress={saveVehicle}>
                    <Text style={{ color: C.success, fontWeight: '700' }}>Agregar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* ── STEP: LOAD DETAILS ── */}
            {modalStep === 'load' && (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={st.formLabel}># de Carga</Text>
                <TextInput style={st.input} placeholder="Ej: LOAD-001" value={loadForm.load_number}
                  onChangeText={v => setLoadForm(p => ({...p, load_number: v}))} placeholderTextColor={C.muted} />

                <Text style={st.formLabel}>Broker</Text>
                <TextInput style={st.input} placeholder="Nombre del broker" value={loadForm.broker}
                  onChangeText={v => setLoadForm(p => ({...p, broker: v}))} placeholderTextColor={C.muted} />

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>Pickup</Text>
                    <TextInput style={st.input} placeholder="Ciudad, Estado" value={loadForm.pickup_location}
                      onChangeText={v => setLoadForm(p => ({...p, pickup_location: v}))} placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>Delivery</Text>
                    <TextInput style={st.input} placeholder="Ciudad, Estado" value={loadForm.delivery_location}
                      onChangeText={v => setLoadForm(p => ({...p, delivery_location: v}))} placeholderTextColor={C.muted} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>💰 Rate ($)</Text>
                    <TextInput style={st.input} placeholder="Ej: 1500" value={loadForm.rate}
                      onChangeText={v => setLoadForm(p => ({...p, rate: v}))} keyboardType="numeric" placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>📝 Notas</Text>
                    <TextInput style={st.input} placeholder="Notas adicionales" value={loadForm.notes}
                      onChangeText={v => setLoadForm(p => ({...p, notes: v}))} placeholderTextColor={C.muted} />
                  </View>
                </View>

                {/* ── VISUAL TRAILER ── */}
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginTop: 16, marginBottom: 8 }}>
                  🚛 Posiciones ({vehicles.length}/9)
                </Text>

                <View style={[st.card, { padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }}>⚖️ Peso:</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: totalWeight > 80000 ? C.danger : C.success }}>
                    {totalWeight.toLocaleString()} lbs
                  </Text>
                </View>

                {/* Trailer Side View */}
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6 }}>
                  {/* Upper Deck */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 }}>
                    {/* Upper deck label */}
                    <View style={{ width: 22, justifyContent: 'center', alignItems: 'center', marginRight: 2 }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: '#94A3B8', transform: [{ rotate: '-90deg' }], width: 45 }}>UPPER</Text>
                    </View>
                    {/* Upper deck slots with ramp shape */}
                    <View style={{ flex: 1, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }}>
                      {SLOTS.filter(sl => sl.deck === 'upper').map((sl, idx) => {
                        const v = vehicles.find(vh => vh.slot === sl.slot);
                        const isFirst = idx === 0;
                        const isLast = idx === 3;
                        return (
                          <TouchableOpacity key={sl.slot}
                            onPress={() => openAddVehicle(sl.slot)}
                            onLongPress={() => v && removeVehicle(sl.slot)}
                            activeOpacity={0.7}
                            style={{
                              flex: 1, height: 58, justifyContent: 'center', alignItems: 'center',
                              backgroundColor: v ? '#DBEAFE' : '#F1F5F9',
                              borderWidth: 1, borderColor: v ? '#93C5FD' : '#CBD5E1',
                              borderLeftWidth: isFirst ? 1 : 0,
                              borderTopLeftRadius: isFirst ? 8 : 0,
                              borderBottomLeftRadius: isFirst ? 8 : 0,
                              borderTopRightRadius: isLast ? 8 : 0,
                              borderBottomRightRadius: isLast ? 8 : 0,
                            }}>
                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#94A3B8', position: 'absolute', top: 2, left: 4 }}>{sl.label}</Text>
                            {v ? (
                              <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 22 }}>{VEHICLE_TYPES.find(t => t.id === v.type)?.icon || '🚗'}</Text>
                                <Text style={{ fontSize: 7, fontWeight: '700', color: '#1E40AF', marginTop: -2 }} numberOfLines={1}>{v.year} {v.make}</Text>
                                <Text style={{ fontSize: 7, color: '#3B82F6' }} numberOfLines={1}>{v.model}</Text>
                              </View>
                            ) : (
                              <View style={{ alignItems: 'center', opacity: 0.4 }}>
                                <Text style={{ fontSize: 20 }}>🚗</Text>
                                <Text style={{ fontSize: 7, color: '#94A3B8', fontWeight: '600' }}>Vacío</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {/* Cab top */}
                    <View style={{ width: 42, height: 58, marginLeft: 2, justifyContent: 'flex-end' }}>
                      <View style={{ height: 32, backgroundColor: '#334155', borderTopLeftRadius: 4, borderTopRightRadius: 10, borderBottomRightRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10 }}>🪟</Text>
                      </View>
                    </View>
                  </View>

                  {/* Chassis/Frame line */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 1 }}>
                    <View style={{ width: 22, marginRight: 2 }} />
                    <View style={{ flex: 1, height: 3, backgroundColor: '#475569', borderRadius: 2 }} />
                    <View style={{ width: 42, height: 3, backgroundColor: '#475569', borderRadius: 2, marginLeft: 2 }} />
                  </View>

                  {/* Lower Deck */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 2 }}>
                    {/* Lower deck label */}
                    <View style={{ width: 22, justifyContent: 'center', alignItems: 'center', marginRight: 2 }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: '#94A3B8', transform: [{ rotate: '-90deg' }], width: 45 }}>LOWER</Text>
                    </View>
                    {/* Lower deck slots */}
                    <View style={{ flex: 1, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }}>
                      {SLOTS.filter(sl => sl.deck === 'lower').map((sl, idx) => {
                        const v = vehicles.find(vh => vh.slot === sl.slot);
                        const isFirst = idx === 0;
                        const isLast = idx === 4;
                        return (
                          <TouchableOpacity key={sl.slot}
                            onPress={() => openAddVehicle(sl.slot)}
                            onLongPress={() => v && removeVehicle(sl.slot)}
                            activeOpacity={0.7}
                            style={{
                              flex: 1, height: 58, justifyContent: 'center', alignItems: 'center',
                              backgroundColor: v ? '#DCFCE7' : '#F1F5F9',
                              borderWidth: 1, borderColor: v ? '#86EFAC' : '#CBD5E1',
                              borderLeftWidth: isFirst ? 1 : 0,
                              borderTopLeftRadius: isFirst ? 8 : 0,
                              borderBottomLeftRadius: isFirst ? 8 : 0,
                              borderTopRightRadius: isLast ? 8 : 0,
                              borderBottomRightRadius: isLast ? 8 : 0,
                            }}>
                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#94A3B8', position: 'absolute', top: 2, left: 4 }}>{sl.label}</Text>
                            {v ? (
                              <View style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 22 }}>{VEHICLE_TYPES.find(t => t.id === v.type)?.icon || '🚗'}</Text>
                                <Text style={{ fontSize: 7, fontWeight: '700', color: '#166534', marginTop: -2 }} numberOfLines={1}>{v.year} {v.make}</Text>
                                <Text style={{ fontSize: 7, color: '#16A34A' }} numberOfLines={1}>{v.model}</Text>
                              </View>
                            ) : (
                              <View style={{ alignItems: 'center', opacity: 0.4 }}>
                                <Text style={{ fontSize: 20 }}>🚗</Text>
                                <Text style={{ fontSize: 7, color: '#94A3B8', fontWeight: '600' }}>Vacío</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {/* Cab bottom / engine */}
                    <View style={{ width: 42, height: 58, marginLeft: 2, justifyContent: 'flex-start' }}>
                      <View style={{ height: 42, backgroundColor: '#334155', borderBottomLeftRadius: 4, borderBottomRightRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12 }}>🔧</Text>
                      </View>
                    </View>
                  </View>

                  {/* Wheels */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <View style={{ width: 22, marginRight: 2 }} />
                    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 }}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#475569' }} />
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#475569' }} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#475569' }} />
                        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#475569' }} />
                      </View>
                    </View>
                    <View style={{ width: 42, flexDirection: 'row', justifyContent: 'center', gap: 3, marginLeft: 2 }}>
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#475569' }} />
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#475569' }} />
                    </View>
                  </View>
                </View>

                <Text style={{ fontSize: 10, color: C.muted, textAlign: 'center', marginBottom: 6 }}>Toca una posición para agregar · Mantén presionado para quitar</Text>
              </ScrollView>
            )}

            {/* ── STEP: ADD VEHICLE ── */}
            {modalStep === 'vehicle' && (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                <Text style={st.formLabel}>{t('carHauler.vehicleType')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {VEHICLE_TYPES.map(vt => (
                      <TouchableOpacity key={vt.id} onPress={() => setVehicleForm(p => ({...p, type: vt.id}))}
                        style={[st.toggleBtn, vehicleForm.type === vt.id && { backgroundColor: C.brand, borderColor: C.brand }]}>
                        <Text style={{ fontSize: 18 }}>{vt.icon}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: vehicleForm.type === vt.id ? '#fff' : C.text }}>{vt.label}</Text>
                        <Text style={{ fontSize: 9, color: vehicleForm.type === vt.id ? '#93C5FD' : C.muted }}>{vt.weight.toLocaleString()} lb</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* ── VIN WITH DECODE + SCAN BUTTONS ── */}
                <Text style={st.formLabel}>VIN (Escanear o escribir)</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                  <TextInput
                    style={[st.input, { flex: 1, marginBottom: 0 }]}
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
                  {/* Camera Scan Button */}
                  <TouchableOpacity
                    onPress={openVinScanner}
                    style={{
                      backgroundColor: '#7C3AED',
                      borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
                      minWidth: 48,
                    }}
                  >
                    <Ionicons name="camera" size={20} color="#fff" />
                  </TouchableOpacity>
                  {/* Decode Button */}
                  <TouchableOpacity
                    onPress={decodeVin}
                    disabled={vinLoading || vehicleForm.vin.length !== 17}
                    style={{
                      backgroundColor: vehicleForm.vin.length === 17 ? C.brand : '#D1D5DB',
                      borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center',
                      minWidth: 48,
                    }}
                  >
                    {vinLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="search" size={20} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
                  {vehicleForm.vin.length}/17 · 📷 Escanear | 🔍 Decodificar
                </Text>

                {/* VIN Decoded Info Banner */}
                {vinDecoded && (
                  <View style={{
                    backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginBottom: 12,
                    borderWidth: 1, borderColor: '#86EFAC',
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Ionicons name="checkmark-circle" size={20} color={C.success} />
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#166534' }}>VIN Decodificado</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {vinDecoded.body_class ? (
                        <View style={st.vinTag}>
                          <Text style={st.vinTagText}>🚗 {vinDecoded.body_class}</Text>
                        </View>
                      ) : null}
                      {vinDecoded.engine ? (
                        <View style={st.vinTag}>
                          <Text style={st.vinTagText}>⚙️ {vinDecoded.engine}</Text>
                        </View>
                      ) : null}
                      {vinDecoded.drive_type ? (
                        <View style={st.vinTag}>
                          <Text style={st.vinTagText}>🔄 {vinDecoded.drive_type}</Text>
                        </View>
                      ) : null}
                      {vinDecoded.fuel_type ? (
                        <View style={st.vinTag}>
                          <Text style={st.vinTagText}>⛽ {vinDecoded.fuel_type}</Text>
                        </View>
                      ) : null}
                      {vinDecoded.weight_lbs > 0 ? (
                        <View style={st.vinTag}>
                          <Text style={st.vinTagText}>⚖️ {vinDecoded.weight_lbs.toLocaleString()} lbs</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>Año</Text>
                    <TextInput style={st.input} placeholder="2024" keyboardType="numeric" value={vehicleForm.year}
                      onChangeText={v => setVehicleForm(p => ({...p, year: v}))} placeholderTextColor={C.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>Marca *</Text>
                    <TouchableOpacity
                      style={[st.input, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }]}
                      onPress={() => { setMakeSearch(''); setModalStep('makePicker'); }}>
                      <Text style={{ flex: 1, fontSize: 14, color: vehicleForm.make ? C.text : C.muted }}>
                        {vehicleForm.make || t('carHauler.selectMake')}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>Modelo *</Text>
                    <TouchableOpacity
                      style={[st.input, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center', opacity: vehicleForm.make ? 1 : 0.5 }]}
                      onPress={() => {
                        if (!vehicleForm.make) { Alert.alert('⚠️', 'Primero selecciona la marca'); return; }
                        setModelSearch(''); setModalStep('modelPicker');
                      }}>
                      <Text style={{ flex: 1, fontSize: 14, color: vehicleForm.model ? C.text : C.muted }}>
                        {vehicleForm.model || t('carHauler.selectModel')}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.formLabel}>Color</Text>
                    <TextInput style={st.input} placeholder="Blanco" value={vehicleForm.color}
                      onChangeText={v => setVehicleForm(p => ({...p, color: v}))} placeholderTextColor={C.muted} />
                  </View>
                </View>

                <Text style={st.formLabel}>Pickup</Text>
                <TextInput style={st.input} placeholder="Dirección de recogida" value={vehicleForm.pickup_address}
                  onChangeText={v => setVehicleForm(p => ({...p, pickup_address: v}))} placeholderTextColor={C.muted} />

                <Text style={st.formLabel}>Entrega</Text>
                <TextInput style={st.input} placeholder="Dirección de entrega" value={vehicleForm.delivery_address}
                  onChangeText={v => setVehicleForm(p => ({...p, delivery_address: v}))} placeholderTextColor={C.muted} />

                <Text style={st.formLabel}>{t('carHauler.condition')}</Text>
                <TextInput style={[st.input, { height: 60, textAlignVertical: 'top' }]} multiline
                  placeholder={t('carHauler.conditionPlaceholder')}
                  value={vehicleForm.condition_notes}
                  onChangeText={v => setVehicleForm(p => ({...p, condition_notes: v}))} placeholderTextColor={C.muted} />

                {/* ── INSPECTION PHOTOS ── */}
                <View style={{ marginTop: 4, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
                      📸 {t('carHauler.inspectionTitle')} ({inspectionPhotos.length})
                    </Text>
                  </View>

                  {/* Guided Inspection Button */}
                  <TouchableOpacity
                    onPress={startGuidedInspection}
                    style={{
                      backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginBottom: 12,
                      borderWidth: 2, borderColor: C.brand, borderStyle: 'dashed',
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                    }}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="shield-checkmark" size={24} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: C.brand }}>{t('carHauler.guidedInspection')}</Text>
                      <Text style={{ fontSize: 11, color: C.sub }}>{t('carHauler.guidedInspectionDesc')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={C.brand} />
                  </TouchableOpacity>

                  {/* Quick photo buttons */}
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={takeInspectionPhoto}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: '#F3E8FF', borderRadius: 12, paddingVertical: 12,
                        borderWidth: 1, borderColor: '#C4B5FD',
                      }}
                    >
                      <Ionicons name="camera" size={18} color={C.purple} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: C.purple }}>{t('carHauler.quickPhoto')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickInspectionPhoto}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                        backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 12,
                        borderWidth: 1, borderColor: '#BBF7D0',
                      }}
                    >
                      <Ionicons name="images" size={18} color={C.success} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: C.success }}>{t('carHauler.gallery')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Photo grid with damage badges */}
                  {inspectionPhotos.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {inspectionPhotos.map((photo, idx) => (
                        <View key={idx} style={{ width: '31%', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                          <TouchableOpacity
                            onPress={() => { setSelectedPhotoIdx(idx); setShowPhotoViewer(true); }}
                            activeOpacity={0.85}
                          >
                            <Image
                              source={{ uri: photo.uri }}
                              style={{ width: '100%', aspectRatio: 1, borderRadius: 10 }}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                          {/* Position label */}
                          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 3 }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                              {photo.label || `Foto ${idx + 1}`}
                            </Text>
                          </View>
                          {/* Damage indicator */}
                          {photo.damages && photo.damages.length > 0 && !photo.damages.includes('none') && (
                            <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{photo.damages.length} daño{photo.damages.length > 1 ? 's' : ''}</Text>
                            </View>
                          )}
                          {photo.damages && photo.damages.includes('none') && (
                            <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>✅ OK</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => removeInspectionPhoto(idx)}
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              backgroundColor: 'rgba(220,38,38,0.9)', borderRadius: 12,
                              width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
                            }}
                          >
                            <Ionicons name="close" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  {inspectionPhotos.length === 0 && (
                    <View style={{
                      backgroundColor: '#FFFBEB', borderRadius: 10, padding: 14,
                      borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center',
                    }}>
                      <Ionicons name="information-circle-outline" size={20} color={C.warning} />
                      <Text style={{ fontSize: 12, color: '#92400E', textAlign: 'center', marginTop: 4 }}>
                        {t('carHauler.inspectionHint')}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* ── STEP: MAKE PICKER (inline) ── */}
            {modalStep === 'makePicker' && (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <TouchableOpacity onPress={() => setModalStep('vehicle')}>
                    <Ionicons name="arrow-back" size={24} color={C.brand} />
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: C.text }}>Seleccionar Marca</Text>
                  <View style={{ width: 24 }} />
                </View>
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 }}>
                    <Ionicons name="search" size={18} color={C.muted} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: C.text }}
                      placeholder={t('carHauler.searchMake')}
                      placeholderTextColor={C.muted}
                      value={makeSearch}
                      onChangeText={setMakeSearch}
                      autoFocus
                    />
                    {makeSearch ? (
                      <TouchableOpacity onPress={() => setMakeSearch('')}>
                        <Ionicons name="close-circle" size={18} color={C.muted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <FlatList
                  data={filteredMakes}
                  keyExtractor={item => item}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setVehicleForm(p => ({ ...p, make: item, model: '' }));
                        setModalStep('vehicle');
                      }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.card,
                        borderBottomWidth: 1, borderBottomColor: C.border, borderRadius: 8, marginBottom: 2,
                      }}>
                      <Text style={{ fontSize: 16, color: C.text, fontWeight: vehicleForm.make === item ? '700' : '400' }}>{item}</Text>
                      <Text style={{ fontSize: 12, color: C.muted }}>{getModelsForMake(item).length} modelos</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* ── STEP: MODEL PICKER (inline) ── */}
            {modalStep === 'modelPicker' && (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <TouchableOpacity onPress={() => setModalStep('vehicle')}>
                    <Ionicons name="arrow-back" size={24} color={C.brand} />
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: C.text }}>{vehicleForm.make} — Modelos</Text>
                  <View style={{ width: 24 }} />
                </View>
                <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12 }}>
                    <Ionicons name="search" size={18} color={C.muted} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: C.text }}
                      placeholder={t('carHauler.searchModel')}
                      placeholderTextColor={C.muted}
                      value={modelSearch}
                      onChangeText={setModelSearch}
                      autoFocus
                    />
                    {modelSearch ? (
                      <TouchableOpacity onPress={() => setModelSearch('')}>
                        <Ionicons name="close-circle" size={18} color={C.muted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <FlatList
                  data={filteredModels}
                  keyExtractor={item => item}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setVehicleForm(p => ({ ...p, model: item }));
                        setModalStep('vehicle');
                      }}
                      style={{
                        paddingVertical: 14, paddingHorizontal: 16, backgroundColor: C.card,
                        borderBottomWidth: 1, borderBottomColor: C.border, borderRadius: 8, marginBottom: 2,
                      }}>
                      <Text style={{ fontSize: 16, color: C.text, fontWeight: vehicleForm.model === item ? '700' : '400' }}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            {/* ── STEP: VIN BARCODE SCANNER ── */}
            {modalStep === 'vinScanner' && (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <TouchableOpacity onPress={() => setModalStep('vehicle')}>
                    <Ionicons name="arrow-back" size={24} color={C.brand} />
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: C.text }}>📷 {t('carHauler.vinScanner')}</Text>
                  <View style={{ width: 24 }} />
                </View>
                <View style={{ flex: 1, overflow: 'hidden', borderRadius: 12, margin: 16 }}>
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['code39', 'code128', 'datamatrix', 'pdf417', 'qr'] }}
                    onBarcodeScanned={vinScanned ? undefined : onBarcodeScanned}
                  />
                  {/* Overlay guide */}
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ width: '85%', height: 80, borderWidth: 2, borderColor: '#10B981', borderRadius: 8, backgroundColor: 'transparent' }} />
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 16, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                      {t('carHauler.aimBarcode')}
                    </Text>
                    <Text style={{ color: '#D1D5DB', fontSize: 11, marginTop: 4, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>
                      {t('carHauler.barcodeLocation')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setModalStep('vehicle')}
                  style={{ backgroundColor: C.danger, margin: 16, marginTop: 0, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('carHauler.cancelScan')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP: GUIDED INSPECTION ── */}
            {modalStep === 'guidedInspection' && (
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <TouchableOpacity onPress={() => setModalStep('vehicle')}>
                    <Ionicons name="arrow-back" size={24} color={C.brand} />
                  </TouchableOpacity>
                  <Text style={{ fontWeight: '700', fontSize: 16, color: C.text }}>
                    📸 {t('carHauler.guidedTitle')} ({inspectionStep + 1}/{INSPECTION_POSITIONS.length})
                  </Text>
                  <TouchableOpacity onPress={() => setModalStep('vehicle')}>
                    <Text style={{ color: C.success, fontWeight: '600', fontSize: 13 }}>{t('carHauler.done')}</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ padding: 16 }}>
                  {/* Progress Bar */}
                  <View style={{ flexDirection: 'row', gap: 3, marginBottom: 16 }}>
                    {INSPECTION_POSITIONS.map((_, idx) => (
                      <View key={idx} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        backgroundColor: idx < inspectionStep ? C.success : idx === inspectionStep ? C.brand : '#E5E5EA',
                      }} />
                    ))}
                  </View>

                  {/* Current Position Guide */}
                  {(() => {
                    const pos = INSPECTION_POSITIONS[inspectionStep];
                    const existingPhoto = inspectionPhotos.find(p => p.position === pos.id);
                    return (
                      <View>
                        {/* Position Card with Car Illustration */}
                        <View style={{
                          backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 16,
                          borderWidth: 2, borderColor: C.brand, alignItems: 'center',
                        }}>
                          {/* SVG Car Illustration */}
                          <View style={{ marginBottom: 12 }}>
                            {(() => {
                              const IllustrationComponent = INSPECTION_ILLUSTRATIONS[pos.id];
                              return IllustrationComponent ? <IllustrationComponent width={pos.id === 'left' || pos.id === 'right' ? 160 : 120} height={pos.id === 'roof' ? 120 : 90} /> : <Text style={{ fontSize: 48 }}>{pos.icon}</Text>;
                            })()}
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 }}>{pos.label}</Text>
                          <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center' }}>{pos.description}</Text>

                          {existingPhoto ? (
                            <View style={{ marginTop: 12, alignItems: 'center' }}>
                              <Image source={{ uri: existingPhoto.uri }} style={{ width: 200, height: 150, borderRadius: 12 }} resizeMode="cover" />
                              <Text style={{ fontSize: 11, color: C.success, fontWeight: '700', marginTop: 6 }}>✅ {t('carHauler.photoTaken')}</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Damage Selector */}
                        <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 8 }}>
                          {t('carHauler.damagesQuestion')}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                          {DAMAGE_TYPES.map(dmg => {
                            const isSelected = currentDamages.includes(dmg.id);
                            return (
                              <TouchableOpacity
                                key={dmg.id}
                                onPress={() => toggleDamage(dmg.id)}
                                style={{
                                  flexDirection: 'row', alignItems: 'center', gap: 6,
                                  paddingVertical: 8, paddingHorizontal: 12,
                                  borderRadius: 10, borderWidth: 1.5,
                                  borderColor: isSelected ? dmg.color : C.border,
                                  backgroundColor: isSelected ? `${dmg.color}15` : C.card,
                                }}
                              >
                                <Text style={{ fontSize: 14 }}>{dmg.icon}</Text>
                                <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? dmg.color : C.text }}>
                                  {dmg.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Damage Note */}
                        {currentDamages.length > 0 && !currentDamages.includes('none') && (
                          <TextInput
                            style={[st.input, { height: 60, textAlignVertical: 'top' }]}
                            multiline
                            placeholder={t('carHauler.describeDamage')}
                            value={damageNote}
                            onChangeText={setDamageNote}
                            placeholderTextColor={C.muted}
                          />
                        )}

                        {/* Action Buttons */}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={skipPosition}
                            style={{
                              flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
                              backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: C.border,
                            }}
                          >
                            <Text style={{ color: C.sub, fontWeight: '600', fontSize: 14 }}>{t('carHauler.skip')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={takeGuidedPhoto}
                            style={{
                              flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                              backgroundColor: C.brand,
                            }}
                          >
                            <Ionicons name="camera" size={20} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                              {existingPhoto ? t('carHauler.retakePhoto') : t('carHauler.takePhoto')}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Navigation between positions */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                          <TouchableOpacity
                            onPress={() => { if (inspectionStep > 0) { setInspectionStep(prev => prev - 1); setCurrentDamages([]); setDamageNote(''); } }}
                            disabled={inspectionStep === 0}
                            style={{ opacity: inspectionStep === 0 ? 0.3 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          >
                            <Ionicons name="chevron-back" size={18} color={C.brand} />
                            <Text style={{ color: C.brand, fontWeight: '600', fontSize: 13 }}>{t('carHauler.previous')}</Text>
                          </TouchableOpacity>
                          <Text style={{ color: C.muted, fontSize: 12 }}>
                            {inspectionPhotos.filter(p => p.position !== 'extra').length} {t('carHauler.of')} {INSPECTION_POSITIONS.length} {t('carHauler.photos')}
                          </Text>
                          <TouchableOpacity
                            onPress={() => { if (inspectionStep < INSPECTION_POSITIONS.length - 1) { setInspectionStep(prev => prev + 1); setCurrentDamages([]); setDamageNote(''); } }}
                            disabled={inspectionStep === INSPECTION_POSITIONS.length - 1}
                            style={{ opacity: inspectionStep === INSPECTION_POSITIONS.length - 1 ? 0.3 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                          >
                            <Text style={{ color: C.brand, fontWeight: '600', fontSize: 13 }}>{t('carHauler.next')}</Text>
                            <Ionicons name="chevron-forward" size={18} color={C.brand} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })()}
                </ScrollView>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Viewer Modal */}
      <Modal visible={showPhotoViewer} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setShowPhotoViewer(false)}
            style={{ position: 'absolute', top: insets.top + 10, right: 16, zIndex: 10, padding: 8 }}
          >
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
          {inspectionPhotos[selectedPhotoIdx] && (
            <View style={{ width: '92%', aspectRatio: 4/3 }}>
              <Image
                source={{ uri: inspectionPhotos[selectedPhotoIdx].uri }}
                style={{ width: '100%', height: '100%', borderRadius: 12 }}
                resizeMode="contain"
              />
              <Text style={{ color: '#fff', textAlign: 'center', marginTop: 10, fontSize: 14, fontWeight: '600' }}>
                {inspectionPhotos[selectedPhotoIdx].label} · {new Date(inspectionPhotos[selectedPhotoIdx].timestamp).toLocaleTimeString()}
              </Text>
            </View>
          )}
          {/* Navigation arrows */}
          {inspectionPhotos.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 40, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setSelectedPhotoIdx(prev => (prev > 0 ? prev - 1 : inspectionPhotos.length - 1))}
                style={{ padding: 12 }}
              >
                <Ionicons name="chevron-back-circle" size={40} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', alignSelf: 'center' }}>
                {selectedPhotoIdx + 1} / {inspectionPhotos.length}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedPhotoIdx(prev => (prev < inspectionPhotos.length - 1 ? prev + 1 : 0))}
                style={{ padding: 12 }}
              >
                <Ionicons name="chevron-forward-circle" size={40} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Make Picker - INLINE within main modal */}
      {/* Model Picker - INLINE within main modal */}
      {/* Both are now handled inside the main modal via modalStep */}
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' },
  slotCard: {
    flex: 1, minWidth: 65, maxWidth: 85, height: 72, backgroundColor: C.card,
    borderRadius: 10, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4,
  },
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
  vinTag: {
    backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#BBF7D0',
  },
  vinTagText: {
    fontSize: 11, fontWeight: '600', color: '#166534',
  },
});
