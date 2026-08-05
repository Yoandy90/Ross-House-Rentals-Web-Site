/**
 * Trucker Tools — Herramientas del Camionero
 * Dashboard + Pre-trip Inspection + Trip Log + Fuel Log
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, TextInput, Modal, FlatList, Platform, Dimensions,
  KeyboardAvoidingView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { findRouteStates, extractState } from '../src/data/stateRoutes';
import AddressAutocomplete from '../src/components/AddressAutocomplete';

const { width } = Dimensions.get('window');

const C = {
  bg: '#F2F2F7', card: '#fff', text: '#1C1C1E', sub: '#636366', muted: '#AEAEB2',
  border: '#E5E5EA', brand: '#1E40AF', brandSoft: '#EFF6FF', success: '#059669',
  successSoft: '#ECFDF5', warning: '#D97706', warnSoft: '#FFFBEB', danger: '#DC2626',
  dangerSoft: '#FEF2F2', purple: '#7C3AED',
};

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY',
  'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
  'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

export default function TruckerToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<'none'|'inspection'|'trip'|'fuel'|'setup'>('none');
  const [activeTab, setActiveTab] = useState<'dashboard'|'trips'|'fuel'|'inspections'>('dashboard');

  // ── History State ──
  const [inspections, setInspections] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [fuelStats, setFuelStats] = useState<any>({});
  const [iftaByState, setIftaByState] = useState<any[]>([]);
  const [tripStats, setTripStats] = useState<any>({});

  // ── Inspection State ──
  const [inspTemplate, setInspTemplate] = useState<any[]>([]);
  const [inspItems, setInspItems] = useState<Record<string, {status: string; notes: string}>>({});
  const [inspSection, setInspSection] = useState(0);
  const [inspOdometer, setInspOdometer] = useState('');
  const [inspLocation, setInspLocation] = useState('');
  const [inspSaving, setInspSaving] = useState(false);

  // ── Trip State ──
  const [tripForm, setTripForm] = useState({
    origin: '', origin_state: '', destination: '', destination_state: '',
    miles: '', loaded: true, cargo_description: '', broker: '', rate: '',
    states_traveled: [] as string[], notes: '',
  });
  const [tripSaving, setTripSaving] = useState(false);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [showStatesPicker, setShowStatesPicker] = useState(false);

  // ── Fuel State ──
  const [fuelForm, setFuelForm] = useState({
    station: '', state: '', city: '', gallons: '', price_per_gallon: '', total_cost: '',
    fuel_type: 'diesel', odometer: '', notes: '',
  });
  const [fuelSaving, setFuelSaving] = useState(false);
  const [fuelScanning, setFuelScanning] = useState(false);
  const [fuelReceiptImage, setFuelReceiptImage] = useState<string | null>(null);

  // ── IFTA Report State ──
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const m = new Date().getMonth();
    if (m < 3) return 'Q1';
    if (m < 6) return 'Q2';
    if (m < 9) return 'Q3';
    return 'Q4';
  });
  const [iftaReport, setIftaReport] = useState<any>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

  const loadSavedAddresses = async () => {
    try {
      const res = await api.get('/trucker/addresses');
      setSavedAddresses(res.data.addresses || []);
    } catch (e) { /* ignore */ }
  };

  const saveAddress = async (address: string, state: string | null) => {
    try {
      await api.post('/trucker/addresses', { address, state: state || '', type: 'general' });
      loadSavedAddresses();
    } catch (e) { /* ignore */ }
  };

  // ── Setup State ──
  const [setupForm, setSetupForm] = useState({
    business_subtype: '', cdl_type: 'A', mc_number: '', dot_number: '',
    trailer_type: '', trailer_length: '', company_name: '', home_state: '',
  });
  const [subtypes, setSubtypes] = useState<any[]>([]);
  const [setupSaving, setSetupSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [dashRes, templateRes, profilesRes] = await Promise.all([
        api.get('/trucker/dashboard'),
        api.get('/trucker/inspection-template'),
        api.get('/trucker/business-profiles'),
      ]);
      setDashboard(dashRes.data);
      setInspTemplate(templateRes.data.categories || []);

      const truckProfile = profilesRes.data.find((p: any) => p.id === 'truck_driver');
      if (truckProfile) setSubtypes(truckProfile.subtypes || []);

      // Load trucker profile for setup
      const profileRes = await api.get('/trucker/profile');
      if (profileRes.data.exists) {
        setSetupForm({
          business_subtype: profileRes.data.business_subtype || '',
          cdl_type: profileRes.data.cdl_type || 'A',
          mc_number: profileRes.data.mc_number || '',
          dot_number: profileRes.data.dot_number || '',
          trailer_type: profileRes.data.trailer_type || '',
          trailer_length: profileRes.data.trailer_length || '',
          company_name: profileRes.data.company_name || '',
          home_state: profileRes.data.home_state || '',
        });
      }

      // Load history data
      const [inspRes, tripsRes, fuelRes] = await Promise.all([
        api.get('/trucker/inspections?limit=10').catch(() => ({ data: { inspections: [] } })),
        api.get('/trucker/trips?limit=20').catch(() => ({ data: { trips: [], stats: {} } })),
        api.get('/trucker/fuel?limit=20').catch(() => ({ data: { logs: [], stats: {}, ifta_by_state: [] } })),
      ]);
      setInspections(inspRes.data.inspections || []);
      setTrips(tripsRes.data.trips || []);
      setTripStats(tripsRes.data.stats || {});
      setFuelLogs(fuelRes.data.logs || []);
      setFuelStats(fuelRes.data.stats || {});
      setIftaByState(fuelRes.data.ifta_by_state || []);
    } catch (e) {
      console.error('Trucker dashboard error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); loadSavedAddresses(); }, []);

  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  // ── INSPECTION LOGIC ──
  const startInspection = () => {
    const initial: Record<string, {status: string; notes: string}> = {};
    inspTemplate.forEach(cat => cat.items.forEach((item: any) => {
      initial[item.id] = { status: '', notes: '' };
    }));
    setInspItems(initial);
    setInspSection(0);
    setInspOdometer('');
    setInspLocation('');
    setActiveModal('inspection');
  };

  const toggleInspItem = (itemId: string, status: string) => {
    setInspItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status: prev[itemId]?.status === status ? '' : status },
    }));
  };

  const saveInspection = async () => {
    const unanswered = Object.values(inspItems).filter(v => !v.status).length;
    if (unanswered > 5) {
      Alert.alert('⚠️', `Faltan ${unanswered} ítems por inspeccionar. ¿Deseas completarlos primero?`);
      return;
    }
    setInspSaving(true);
    try {
      const res = await api.post('/trucker/inspections', {
        type: 'pre_trip', odometer: inspOdometer, location: inspLocation, items: inspItems,
      });
      const d = res.data;
      if (d.failed > 0) {
        Alert.alert('⚠️ Inspección con Fallos', `${d.passed} aprobados, ${d.failed} fallidos.\nRevisa los ítems marcados en rojo antes de salir.`);
      } else {
        Alert.alert('✅ Inspección Completada', `${d.passed} ítems aprobados. ¡Buen viaje!`);
      }
      setActiveModal('none');
      loadDashboard();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la inspección');
    }
    setInspSaving(false);
  };

  // ── TRIP LOGIC ──
  const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

  const calculateDistance = async (origin: string, destination: string) => {
    if (!origin || !destination || !GOOGLE_API_KEY) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      if (data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        const el = data.rows[0].elements[0];
        const distanceMeters = el.distance.value;
        const miles = Math.round(distanceMeters * 0.000621371);
        setTripForm(p => ({...p, miles: miles.toString()}));
        // Format duration (e.g. "5 hours 23 mins" → "5h 23min")
        const durationSec = el.duration.value;
        const hrs = Math.floor(durationSec / 3600);
        const mins = Math.round((durationSec % 3600) / 60);
        const etaText = hrs > 0 ? `${hrs}h ${mins}min` : `${mins} min`;
        setEstimatedDuration(etaText);
      }
    } catch (e) {
      console.error('Distance Matrix API error:', e);
    }
  };

  const saveTrip = async () => {
    if (!tripForm.origin || !tripForm.destination || !tripForm.miles) {
      Alert.alert('⚠️', 'Origen, destino y millas son requeridos');
      return;
    }
    setTripSaving(true);
    try {
      await api.post('/trucker/trips', {
        ...tripForm,
        miles: parseFloat(tripForm.miles) || 0,
        rate: parseFloat(tripForm.rate) || 0,
      });
      Alert.alert('✅ Viaje Registrado', `${tripForm.miles} millas de ${tripForm.origin} a ${tripForm.destination}`);
      setActiveModal('none');
      setTripForm({ origin: '', origin_state: '', destination: '', destination_state: '', miles: '', loaded: true, cargo_description: '', broker: '', rate: '', states_traveled: [], notes: '' });
      setEstimatedDuration('');
      loadDashboard();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el viaje');
    }
    setTripSaving(false);
  };

  // ── FUEL RECEIPT AI SCAN ──
  const generateIFTAReport = async () => {
    setGeneratingReport(true);
    try {
      const year = new Date().getFullYear();
      const res = await api.get(`/trucker/ifta/quarterly-report?quarter=${selectedQuarter}&year=${year}`);
      if (res.data.success) {
        setIftaReport(res.data.report);
      } else {
        Alert.alert('⚠️', 'No se pudo generar el reporte');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Fallo al generar reporte IFTA');
    }
    setGeneratingReport(false);
  };

  const exportIFTAReport = async () => {
    if (!iftaReport) {
      Alert.alert('⚠️', 'Primero genera el reporte con "Calcular Impuesto"');
      return;
    }
    try {
      const year = new Date().getFullYear();
      const url = `/trucker/ifta/quarterly-report/export?quarter=${selectedQuarter}&year=${year}`;
      const response = await api.get(url);
      // response.data is HTML string
      const htmlContent = typeof response.data === 'string' ? response.data : response.data.toString();
      
      // Generate PDF using expo-print
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      // Share the PDF
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Reporte IFTA ${selectedQuarter} ${year}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('✅', 'PDF generado exitosamente');
      }
    } catch (e) {
      console.error('IFTA PDF export error:', e);
      Alert.alert('Error', 'No se pudo exportar el reporte PDF');
    }
  };

  const scanFuelReceipt = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para escanear recibos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería para seleccionar recibos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
          allowsEditing: true,
        });
      }

      if (result.canceled || !result.assets?.[0]?.base64) return;

      const base64 = result.assets[0].base64;
      setFuelReceiptImage(result.assets[0].uri);
      setFuelScanning(true);

      try {
        const response = await api.post('/trucker/fuel/scan-receipt', {
          image_base64: base64,
        });

        if (response.data.success && response.data.data) {
          const d = response.data.data;
          setFuelForm(prev => ({
            ...prev,
            station: d.station || prev.station,
            state: d.state || prev.state,
            city: d.city || prev.city,
            gallons: d.gallons ? String(d.gallons) : prev.gallons,
            price_per_gallon: d.price_per_gallon ? String(d.price_per_gallon) : prev.price_per_gallon,
            total_cost: d.total_cost ? String(d.total_cost) : prev.total_cost,
            fuel_type: d.fuel_type || prev.fuel_type,
            odometer: d.odometer || prev.odometer,
          }));
          Alert.alert('✅ Recibo Escaneado', `${d.station || 'Estación'} — ${d.gallons || '?'} gal @ $${d.price_per_gallon || '?'}/gal\n\nVerifica los datos y guarda.`);
        } else {
          Alert.alert('⚠️ No se pudo leer', response.data.error || 'Intenta con otra foto más clara del recibo.');
        }
      } catch (apiErr: any) {
        console.error('Scan receipt API error:', apiErr);
        Alert.alert('Error', 'No se pudo conectar con el servicio de AI. Intenta de nuevo.');
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Error', 'No se pudo acceder a la cámara/galería.');
    } finally {
      setFuelScanning(false);
    }
  };

  // ── FUEL LOGIC ──
  const saveFuel = async () => {
    if (!fuelForm.gallons || !fuelForm.state) {
      Alert.alert('⚠️', 'Galones y estado son requeridos');
      return;
    }
    setFuelSaving(true);
    try {
      const gallons = parseFloat(fuelForm.gallons) || 0;
      const ppg = parseFloat(fuelForm.price_per_gallon) || 0;
      const total = fuelForm.total_cost ? parseFloat(fuelForm.total_cost) : gallons * ppg;
      await api.post('/trucker/fuel', {
        ...fuelForm, gallons, price_per_gallon: ppg, total_cost: total,
      });
      Alert.alert('✅ Combustible Registrado', `${gallons} gal en ${fuelForm.state} — $${total.toFixed(2)}`);
      setActiveModal('none');
      setFuelForm({ station: '', state: '', city: '', gallons: '', price_per_gallon: '', total_cost: '', fuel_type: 'diesel', odometer: '', notes: '' });
      setFuelReceiptImage(null);
      loadDashboard();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar');
    }
    setFuelSaving(false);
  };

  // ── SETUP LOGIC ──
  const saveSetup = async () => {
    if (!setupForm.business_subtype) {
      Alert.alert('⚠️', 'Selecciona tu tipo de transporte');
      return;
    }
    setSetupSaving(true);
    try {
      await api.put('/trucker/profile', {
        business_type: 'truck_driver',
        ...setupForm,
      });
      Alert.alert('✅ Perfil Guardado', '¡Tu perfil de camionero está configurado!');
      setActiveModal('none');
      loadDashboard();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el perfil');
    }
    setSetupSaving(false);
  };

  const toggleState = (st: string) => {
    setTripForm(prev => ({
      ...prev,
      states_traveled: prev.states_traveled.includes(st)
        ? prev.states_traveled.filter(s => s !== st)
        : [...prev.states_traveled, st],
    }));
  };

  const deleteTrip = (tripId: string, origin: string, dest: string) => {
    Alert.alert('Eliminar Viaje', `¿Eliminar viaje ${origin} → ${dest}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/trucker/trips/${tripId}`); loadDashboard(); }
        catch { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]);
  };

  const deleteFuel = (fuelId: string, station: string) => {
    Alert.alert('Eliminar Registro', `¿Eliminar ${station || 'este registro'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/trucker/fuel/${fuelId}`); loadDashboard(); }
        catch { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]);
  };

  const shareInspection = async (inspId: string) => {
    try {
      const res = await api.get(`/trucker/inspections/${inspId}/html`);
      const html = res.data.html;
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) {
          const toolbar = `<div style="background:#0F172A;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;font-family:-apple-system,sans-serif" class="no-print">
            <span style="font-size:14px;font-weight:bold">📋 Inspección DVIR</span>
            <div style="display:flex;gap:10px"><button onclick="window.print()" style="background:#2563EB;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-weight:bold;cursor:pointer">🖨️ Imprimir PDF</button>
            <button onclick="window.close()" style="background:#64748B;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer">✕</button></div></div>`;
          const styled = html.replace('</head><body>', '</head><body>' + toolbar);
          w.document.write(styled); w.document.close();
        }
      } else {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); }
        else { Alert.alert('PDF guardado', uri); }
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el reporte');
    }
  };

  const exportIFTA = async () => {
    try {
      const res = await api.get('/trucker/ifta-report');
      const html = res.data.html;
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) {
          const toolbar = `<div style="background:#0F172A;color:#fff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;font-family:-apple-system,sans-serif" class="no-print">
            <span style="font-size:14px;font-weight:bold">📊 Reporte IFTA</span>
            <div style="display:flex;gap:10px"><button onclick="window.print()" style="background:#059669;color:#fff;border:none;padding:8px 20px;border-radius:8px;font-weight:bold;cursor:pointer">🖨️ Imprimir PDF</button>
            <button onclick="window.close()" style="background:#64748B;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer">✕</button></div></div>`;
          const styled = html.replace('</head><body>', '</head><body>' + toolbar);
          w.document.write(styled); w.document.close();
        }
      } else {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(uri); }
        else { Alert.alert('PDF guardado', uri); }
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el reporte IFTA');
    }
  };

  const TABS = [
    { id: 'dashboard' as const, label: '📊 Panel', icon: 'speedometer-outline' },
    { id: 'trips' as const, label: '🛣️ Viajes', icon: 'map-outline' },
    { id: 'fuel' as const, label: '⛽ IFTA', icon: 'flame-outline' },
    { id: 'inspections' as const, label: '🔍 DVIR', icon: 'shield-checkmark-outline' },
  ];

  // ── LOADING ──
  if (loading) return (
    <View style={[s.center, { flex: 1, backgroundColor: C.bg }]}>
      <ActivityIndicator size="large" color={C.brand} />
      <Text style={{ marginTop: 12, color: C.sub }}>Cargando herramientas...</Text>
    </View>
  );

  const d = dashboard || {};
  const hasProfile = d.has_profile;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── HEADER FIJO ── */}
      <LinearGradient colors={['#0F172A', '#1E3A5F']} style={{ paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>🚛 Herramientas del Camionero</Text>
          <TouchableOpacity onPress={() => setActiveModal('setup')} style={{ padding: 4 }}>
            <Ionicons name="settings-outline" size={22} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        {hasProfile && d.business_subtype ? (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ backgroundColor: '#1E40AF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '600' }}>
                {subtypes.find((st: any) => st.id === d.business_subtype)?.label || d.business_subtype}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {TABS.map(tab => (
              <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === tab.id ? '#0F172A' : '#94A3B8' }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </LinearGradient>

      {/* ── CONTENIDO SCROLLABLE ── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
      >

        {/* ── SETUP PROMPT ── */}
        {!hasProfile && (
          <TouchableOpacity onPress={() => setActiveModal('setup')} style={[s.card, { margin: 16, borderWidth: 2, borderColor: '#F59E0B', borderStyle: 'dashed' }]}>
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontSize: 40 }}>🚛</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, marginTop: 8 }}>Configura tu Perfil de Camionero</Text>
              <Text style={{ fontSize: 13, color: C.sub, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 }}>
                Ingresa tu CDL, MC#, DOT# y tipo de trailer para personalizar tus herramientas
              </Text>
              <View style={{ marginTop: 12, backgroundColor: C.brand, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Configurar Ahora →</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ═══════════════════════ TAB: DASHBOARD (REDESIGNED) ═══════════════════════ */}
        {activeTab === 'dashboard' && (
          <>
            {/* ── HERO STATS WITH GRADIENT ── */}
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <LinearGradient
                colors={['#1E40AF', '#3B82F6', '#60A5FA']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ borderRadius: 20, padding: 20, marginBottom: 12 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 }}>Ganancia Neta</Text>
                    <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 4 }}>
                      ${(d.net_income || 0).toLocaleString()}
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      {new Date().toLocaleDateString('es-US', { month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 10 }}>
                      <Text style={{ fontSize: 28 }}>💰</Text>
                    </View>
                    {d.trips?.revenue > 0 && (
                      <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                          Ingresos: ${(d.trips?.revenue || 0).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Mini stat row inside hero */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>{d.trips?.total || 0}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>VIAJES</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>{((d.trips?.miles || 0)).toLocaleString()}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>MILLAS</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#fff' }}>{d.fuel?.gallons || 0}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>GALONES</Text>
                  </View>
                </View>
              </LinearGradient>

              {/* ── PERFORMANCE METRICS ── */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>⛽</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>${(d.fuel?.cost || 0).toLocaleString()}</Text>
                      <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600' }}>Combustible</Text>
                    </View>
                  </View>
                </View>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>📊</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{d.fuel?.avg_mpg || '—'}</Text>
                      <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600' }}>MPG Promedio</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>💵</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>${d.fuel?.cost_per_mile || '—'}</Text>
                      <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600' }}>Costo/Milla</Text>
                    </View>
                  </View>
                </View>
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>🗺️</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{d.states_traveled?.length || 0}</Text>
                      <Text style={{ fontSize: 10, color: C.muted, fontWeight: '600' }}>Estados IFTA</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── STATES TRAVELED VISUAL ── */}
              {d.states_traveled && d.states_traveled.length > 0 && (
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>🗺️ Estados Recorridos (IFTA)</Text>
                    <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E40AF' }}>{d.states_traveled.length} estados</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {d.states_traveled.map((st: string, idx: number) => (
                      <LinearGradient
                        key={st}
                        colors={['#3B82F6', '#1D4ED8']}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{st}</Text>
                      </LinearGradient>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── QUICK ACTIONS (MODERN GRID) ── */}
            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 }}>⚡ Acciones Rápidas</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <TouchableOpacity onPress={startInspection} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1.5, borderColor: '#FEE2E2' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 26 }}>🔍</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, textAlign: 'center' }}>Inspección{'\n'}DVIR</Text>
                  {d.last_inspection ? (
                    <Text style={{ fontSize: 9, color: d.last_inspection.status === 'pass' ? C.success : C.danger, marginTop: 4, fontWeight: '600' }}>
                      {d.last_inspection.status === 'pass' ? '✅ OK' : `⚠️ ${d.last_inspection.failed_items} fallos`}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveModal('trip')} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1.5, borderColor: '#DBEAFE' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 26 }}>🛣️</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, textAlign: 'center' }}>Registrar{'\n'}Viaje</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveModal('fuel')} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, borderWidth: 1.5, borderColor: '#FEF3C7' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 26 }}>⛽</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, textAlign: 'center' }}>Registrar{'\n'}Combustible</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── ADVANCED TOOLS (MODERN CARDS) ── */}
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 12 }}>🛰️ Herramientas Avanzadas</Text>
              <View style={{ gap: 10 }}>
                {/* GPS */}
                <TouchableOpacity onPress={() => router.push('/trucker-gps')} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
                  <LinearGradient colors={['#059669', '#10B981']} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 24 }}>🛰️</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>GPS — Rastreo de Ruta</Text>
                    <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Rastrea millas y estados en tiempo real</Text>
                  </View>
                  <View style={{ backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Ionicons name="chevron-forward" size={16} color="#059669" />
                  </View>
                </TouchableOpacity>

                {/* Car Hauler */}
                {(setupForm.business_subtype === 'car_hauler' || setupForm.business_subtype === '') && (
                  <TouchableOpacity onPress={() => router.push('/trucker-car-hauler')} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
                    <LinearGradient colors={['#7C3AED', '#A78BFA']} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 24 }}>🚗</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Car Hauler — Cargas</Text>
                      <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>VIN Scanner, inspección y GPS integrado</Text>
                    </View>
                    <View style={{ backgroundColor: '#F3E8FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Ionicons name="chevron-forward" size={16} color="#7C3AED" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* AI Load Planner */}
                {(setupForm.business_subtype === 'car_hauler' || setupForm.business_subtype === '') && (
                  <TouchableOpacity onPress={() => router.push('/trucker-load-planner')} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
                    <LinearGradient colors={['#8B5CF6', '#C4B5FD']} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 24 }}>🤖</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>AI Load Planner</Text>
                      <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Optimiza posiciones con inteligencia artificial</Text>
                    </View>
                    <View style={{ backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Ionicons name="chevron-forward" size={16} color="#8B5CF6" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Tanker */}
                {(setupForm.business_subtype === 'tanker' || setupForm.business_subtype === '') && (
                  <TouchableOpacity onPress={() => router.push('/trucker-tanker')} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
                    <LinearGradient colors={['#0E7490', '#22D3EE']} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 24 }}>🛢️</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Tanker — Carga Líquida</Text>
                      <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>HAZMAT, capacidad, wash-outs y más</Text>
                    </View>
                    <View style={{ backgroundColor: '#ECFEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Ionicons name="chevron-forward" size={16} color="#0E7490" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Reefer */}
                {(setupForm.business_subtype === 'reefer' || setupForm.business_subtype === '') && (
                  <TouchableOpacity onPress={() => router.push('/trucker-reefer')} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
                    <LinearGradient colors={['#0891B2', '#67E8F9']} style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 24 }}>❄️</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Reefer — Temperatura</Text>
                      <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Control de temp, pre-cool y diesel</Text>
                    </View>
                    <View style={{ backgroundColor: '#ECFEFF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <Ionicons name="chevron-forward" size={16} color="#0891B2" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        )}

        {/* ═══════════════════════ TAB: TRIPS ═══════════════════════ */}
        {activeTab === 'trips' && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🛣️ Historial de Viajes</Text>
              <TouchableOpacity onPress={() => setActiveModal('trip')} style={{ backgroundColor: C.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Nuevo Viaje</Text>
              </TouchableOpacity>
            </View>

            {/* Trip Totals */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E40AF' }}>{tripStats.total_trips || 0}</Text>
                <Text style={s.statLabel}>Total Viajes</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#ECFDF5' }]}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#059669' }}>{(tripStats.total_miles || 0).toLocaleString()}</Text>
                <Text style={s.statLabel}>Total Millas</Text>
              </View>
            </View>

            {trips.length === 0 ? (
              <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
                <Text style={{ fontSize: 40 }}>🛣️</Text>
                <Text style={{ fontSize: 14, color: C.sub, marginTop: 8, textAlign: 'center' }}>No hay viajes registrados aún.{'\n'}Presiona "+ Nuevo Viaje" para empezar.</Text>
              </View>
            ) : (
              trips.map((trip: any) => (
                <TouchableOpacity key={trip.id} onLongPress={() => deleteTrip(trip.id, trip.origin, trip.destination)}
                  style={[s.card, { padding: 14, marginBottom: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: trip.loaded ? C.brand : '#6B7280' }}>
                      {trip.loaded ? '📦 Cargado' : '📭 Vacío'}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>{trip.trip_date}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{trip.origin} → {trip.destination}</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                    <Text style={{ fontSize: 13, color: C.sub }}>🛣️ {trip.miles} mi</Text>
                    {trip.rate > 0 && <Text style={{ fontSize: 13, color: C.success, fontWeight: '600' }}>💰 ${trip.rate.toLocaleString()}</Text>}
                    {trip.rate > 0 && trip.miles > 0 && <Text style={{ fontSize: 13, color: C.purple, fontWeight: '600' }}>${(trip.rate / trip.miles).toFixed(2)}/mi</Text>}
                  </View>
                  {trip.states_traveled?.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {trip.states_traveled.map((st: string) => (
                        <View key={st} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#1E40AF' }}>{st}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {trip.cargo_description ? <Text style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>📝 {trip.cargo_description}</Text> : null}
                </TouchableOpacity>
              ))
            )}
            <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 }}>Mantén presionado un viaje para eliminarlo</Text>
          </View>
        )}

        {/* ═══════════════════════ TAB: FUEL / IFTA ═══════════════════════ */}
        {activeTab === 'fuel' && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>⛽ Combustible & IFTA</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity onPress={exportIFTA} style={{ backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>📄 IFTA</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveModal('fuel')} style={{ backgroundColor: '#D97706', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>+ Fuel</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Fuel Stats */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#FFFBEB' }]}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#D97706' }}>{fuelStats.total_gallons || 0}</Text>
                <Text style={s.statLabel}>Galones</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#FEF2F2' }]}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#DC2626' }}>${(fuelStats.total_cost || 0).toLocaleString()}</Text>
                <Text style={s.statLabel}>Total Gastado</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E40AF' }}>${fuelStats.avg_price || 0}</Text>
                <Text style={s.statLabel}>Precio Prom.</Text>
              </View>
            </View>

            {/* IFTA by State */}
            {iftaByState.length > 0 && (
              <View style={[s.card, { padding: 14, marginBottom: 14 }]}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 }}>🗺️ IFTA — Combustible por Estado</Text>
                {iftaByState.map((item: any) => (
                  <View key={item.state} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <View style={{ backgroundColor: '#1E40AF', width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{item.state}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{item.gallons.toFixed(1)} galones</Text>
                      <Text style={{ fontSize: 12, color: C.sub }}>${item.cost.toFixed(2)}</Text>
                    </View>
                    <View style={{ backgroundColor: '#FFFBEB', borderRadius: 8, overflow: 'hidden', width: 100, height: 8 }}>
                      <View style={{ backgroundColor: '#D97706', height: 8, width: `${Math.min(100, (item.gallons / (fuelStats.total_gallons || 1)) * 100)}%` as any }} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* IFTA Quarterly Report Generator */}
            <View style={[s.card, { padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1E40AF' }]}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E40AF', marginBottom: 6 }}>📋 Reporte IFTA Trimestral</Text>
              <Text style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
                Genera tu reporte completo con cálculo de impuestos por estado.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                  <TouchableOpacity key={q} onPress={() => setSelectedQuarter(q)}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                      backgroundColor: selectedQuarter === q ? '#1E40AF' : '#EFF6FF',
                      borderWidth: 1, borderColor: selectedQuarter === q ? '#1E40AF' : '#BFDBFE' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedQuarter === q ? '#fff' : '#1E40AF' }}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={generateIFTAReport}
                  disabled={generatingReport}
                  style={{ flex: 1, backgroundColor: '#059669', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                  {generatingReport ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name="calculator" size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Calcular Impuesto</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={exportIFTAReport}
                  style={{ flex: 1, backgroundColor: '#7C3AED', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="document-text" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Exportar PDF</Text>
                </TouchableOpacity>
              </View>

              {/* Inline Report Result */}
              {iftaReport && (
                <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                      {iftaReport.quarter} {iftaReport.year}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.danger, fontWeight: '600' }}>
                      📅 Límite: {iftaReport.deadline}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                    <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E40AF' }}>{iftaReport.summary?.total_miles?.toLocaleString()}</Text>
                      <Text style={{ fontSize: 9, color: C.sub }}>Millas</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#D97706' }}>{iftaReport.summary?.fleet_mpg}</Text>
                      <Text style={{ fontSize: 9, color: C.sub }}>MPG</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: iftaReport.summary?.net_tax_due > 0 ? '#FEF2F2' : '#ECFDF5', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: iftaReport.summary?.net_tax_due > 0 ? '#DC2626' : '#059669' }}>
                        ${Math.abs(iftaReport.summary?.net_tax_due || 0).toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 9, color: C.sub }}>{iftaReport.summary?.net_status}</Text>
                    </View>
                  </View>

                  {/* State breakdown mini */}
                  {iftaReport.state_reports?.slice(0, 5).map((sr: any) => (
                    <View key={sr.state} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                      <Text style={{ width: 28, fontWeight: '700', fontSize: 12, color: '#1E40AF' }}>{sr.state}</Text>
                      <Text style={{ flex: 1, fontSize: 11, color: C.sub }}>{sr.miles?.toFixed(0)} mi · {sr.taxable_gallons?.toFixed(1)} gal</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: sr.net_tax > 0 ? '#DC2626' : '#059669' }}>
                        {sr.net_tax > 0 ? '' : '-'}${Math.abs(sr.net_tax).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  {(iftaReport.state_reports?.length || 0) > 5 && (
                    <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4 }}>
                      +{iftaReport.state_reports.length - 5} estados más — Exporta PDF para ver todo
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Fuel History */}
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 8 }}>📋 Historial de Compras</Text>
            {fuelLogs.length === 0 ? (
              <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
                <Text style={{ fontSize: 40 }}>⛽</Text>
                <Text style={{ fontSize: 14, color: C.sub, marginTop: 8, textAlign: 'center' }}>No hay registros de combustible.</Text>
              </View>
            ) : (
              fuelLogs.map((log: any) => (
                <TouchableOpacity key={log.id} onLongPress={() => deleteFuel(log.id, log.station)}
                  style={[s.card, { padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ backgroundColor: '#FFFBEB', width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>⛽</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{log.station || 'Estación'} ({log.state})</Text>
                    <Text style={{ fontSize: 12, color: C.sub }}>{log.date} · {log.gallons} gal · {log.fuel_type}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#DC2626' }}>${log.total_cost?.toFixed(2)}</Text>
                </TouchableOpacity>
              ))
            )}
            <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 }}>Mantén presionado para eliminar</Text>
          </View>
        )}

        {/* ═══════════════════════ TAB: INSPECTIONS ═══════════════════════ */}
        {activeTab === 'inspections' && (
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🔍 Inspecciones DVIR</Text>
              <TouchableOpacity onPress={startInspection} style={{ backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Nueva Inspección</Text>
              </TouchableOpacity>
            </View>

            {inspections.length === 0 ? (
              <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
                <Text style={{ fontSize: 40 }}>🔍</Text>
                <Text style={{ fontSize: 14, color: C.sub, marginTop: 8, textAlign: 'center' }}>No hay inspecciones registradas.{'\n'}Realiza tu primera inspección pre-viaje.</Text>
              </View>
            ) : (
              inspections.map((insp: any) => (
                <View key={insp.id} style={[s.card, { padding: 14, marginBottom: 8, borderLeftWidth: 4,
                  borderLeftColor: insp.overall_status === 'pass' ? '#059669' : '#DC2626' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: insp.overall_status === 'pass' ? '#ECFDF5' : '#FEF2F2',
                        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700',
                          color: insp.overall_status === 'pass' ? '#059669' : '#DC2626' }}>
                          {insp.overall_status === 'pass' ? '✅ APROBADA' : '⚠️ CON FALLOS'}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: C.muted }}>
                        {insp.type === 'pre_trip' ? 'Pre-Viaje' : insp.type === 'post_trip' ? 'Post-Viaje' : 'En Ruta'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, color: C.sub }}>{new Date(insp.created_at).toLocaleDateString()}</Text>
                      <TouchableOpacity onPress={() => shareInspection(insp.id)} style={{ backgroundColor: '#EFF6FF', padding: 6, borderRadius: 6 }}>
                        <Ionicons name="share-outline" size={16} color={C.brand} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: C.success }}>✅ {insp.passed} OK</Text>
                    {insp.failed > 0 && <Text style={{ fontSize: 13, color: C.danger }}>❌ {insp.failed} Fallos</Text>}
                    {insp.na_count > 0 && <Text style={{ fontSize: 13, color: C.muted }}>⊘ {insp.na_count} N/A</Text>}
                  </View>
                  {insp.odometer && <Text style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>🔢 Odómetro: {insp.odometer}</Text>}
                  {insp.location && <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>📍 {insp.location}</Text>}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ════════════════════════════════════════════════ */}
      {/* ── INSPECTION MODAL ── */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'inspection'} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setActiveModal('none')}>
              <Text style={{ color: C.danger, fontWeight: '600', fontSize: 15 }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🔍 Inspección DVIR</Text>
            <TouchableOpacity onPress={saveInspection} disabled={inspSaving}>
              {inspSaving ? <ActivityIndicator size="small" color={C.brand} /> : (
                <Text style={{ color: C.brand, fontWeight: '700', fontSize: 15 }}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Info fields */}
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Odómetro" keyboardType="numeric" value={inspOdometer} onChangeText={setInspOdometer} placeholderTextColor={C.muted} />
            <TextInput style={[s.input, { flex: 1 }]} placeholder="Ubicación" value={inspLocation} onChangeText={setInspLocation} placeholderTextColor={C.muted} />
          </View>

          {/* Section Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, paddingHorizontal: 12 }}>
            {inspTemplate.map((cat, idx) => {
              const catItems = cat.items.map((item: any) => inspItems[item.id]);
              const answered = catItems.filter((ci: any) => ci?.status).length;
              const failed = catItems.filter((ci: any) => ci?.status === 'fail').length;
              return (
                <TouchableOpacity key={cat.id} onPress={() => setInspSection(idx)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, marginRight: 4,
                    borderRadius: 8, backgroundColor: inspSection === idx ? C.brand : '#E2E8F0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: inspSection === idx ? '#fff' : C.sub }}>
                    {cat.icon} {answered}/{cat.items.length} {failed > 0 ? `⚠️${failed}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Inspection Items */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {inspTemplate[inspSection] && (
              <>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 12 }}>
                  {inspTemplate[inspSection].icon} {inspTemplate[inspSection].label}
                </Text>
                {inspTemplate[inspSection].items.map((item: any) => {
                  const status = inspItems[item.id]?.status || '';
                  return (
                    <View key={item.id} style={[s.card, { marginBottom: 8, padding: 12 }]}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 8 }}>{item.label}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => toggleInspItem(item.id, 'pass')}
                          style={[s.inspBtn, status === 'pass' && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                          <Ionicons name="checkmark-circle" size={18} color={status === 'pass' ? '#fff' : '#059669'} />
                          <Text style={[s.inspBtnText, status === 'pass' && { color: '#fff' }]}>OK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleInspItem(item.id, 'fail')}
                          style={[s.inspBtn, status === 'fail' && { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}>
                          <Ionicons name="close-circle" size={18} color={status === 'fail' ? '#fff' : '#DC2626'} />
                          <Text style={[s.inspBtnText, status === 'fail' && { color: '#fff' }]}>Falla</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleInspItem(item.id, 'na')}
                          style={[s.inspBtn, status === 'na' && { backgroundColor: '#6B7280', borderColor: '#6B7280' }]}>
                          <Text style={[s.inspBtnText, status === 'na' && { color: '#fff' }]}>N/A</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                {/* Nav buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  {inspSection > 0 && (
                    <TouchableOpacity onPress={() => setInspSection(inspSection - 1)} style={[s.navBtn, { flex: 1, backgroundColor: '#E2E8F0' }]}>
                      <Text style={{ fontWeight: '600', color: C.text }}>← Anterior</Text>
                    </TouchableOpacity>
                  )}
                  {inspSection < inspTemplate.length - 1 && (
                    <TouchableOpacity onPress={() => setInspSection(inspSection + 1)} style={[s.navBtn, { flex: 1, backgroundColor: C.brand }]}>
                      <Text style={{ fontWeight: '600', color: '#fff' }}>Siguiente →</Text>
                    </TouchableOpacity>
                  )}
                  {inspSection === inspTemplate.length - 1 && (
                    <TouchableOpacity onPress={saveInspection} disabled={inspSaving} style={[s.navBtn, { flex: 1, backgroundColor: '#059669' }]}>
                      <Text style={{ fontWeight: '700', color: '#fff' }}>✅ Guardar Inspección</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* ── TRIP MODAL ── */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'trip'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setActiveModal('none')}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🛣️ Nuevo Viaje</Text>
              <TouchableOpacity onPress={saveTrip} disabled={tripSaving}>
                {tripSaving ? <ActivityIndicator size="small" color={C.brand} /> : (
                  <Text style={{ color: C.brand, fontWeight: '700' }}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={s.formLabel}>Origen *</Text>
              <AddressAutocomplete
                value={tripForm.origin}
                onChangeText={v => setTripForm(p => ({...p, origin: v}))}
                onAddressSelected={(address, state) => {
                  setTripForm(p => ({...p, origin: address}));
                  if (tripForm.destination) {
                    const route = findRouteStates(address, tripForm.destination);
                    if (route.length > 0) setTripForm(p => ({...p, states_traveled: route}));
                    calculateDistance(address, tripForm.destination);
                  }
                  saveAddress(address, state);
                }}
                placeholder="Escribe dirección origen..."
                savedAddresses={savedAddresses}
                onRefreshSaved={loadSavedAddresses}
              />

              <Text style={s.formLabel}>Destino *</Text>
              <AddressAutocomplete
                value={tripForm.destination}
                onChangeText={v => setTripForm(p => ({...p, destination: v}))}
                onAddressSelected={(address, state) => {
                  setTripForm(p => ({...p, destination: address}));
                  if (tripForm.origin) {
                    const route = findRouteStates(tripForm.origin, address);
                    if (route.length > 0) setTripForm(p => ({...p, states_traveled: route}));
                    calculateDistance(tripForm.origin, address);
                  }
                  saveAddress(address, state);
                }}
                placeholder="Escribe dirección destino..."
                savedAddresses={savedAddresses}
                onRefreshSaved={loadSavedAddresses}
              />

              {/* Auto-route indicator */}
              {tripForm.states_traveled.length > 0 && tripForm.origin && tripForm.destination && (
                <View style={{ backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 14 }}>🗺️</Text>
                  <Text style={{ fontSize: 12, color: C.brand, flex: 1 }}>
                    Ruta sugerida: {tripForm.states_traveled.join(' → ')} ({tripForm.states_traveled.length} estados)
                  </Text>
                </View>
              )}

              <Text style={s.formLabel}>Millas * {tripForm.miles ? '✅ Auto-calculado' : ''}</Text>
              <TextInput style={s.input} placeholder="Se calculará automáticamente" keyboardType="numeric" value={tripForm.miles} onChangeText={v => setTripForm(p => ({...p, miles: v}))} placeholderTextColor={C.muted} />

              {/* ETA indicator */}
              {estimatedDuration && tripForm.miles ? (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#BBF7D0' }}>
                  <Text style={{ fontSize: 18 }}>⏱️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>
                      Tiempo estimado: {estimatedDuration}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#15803D' }}>
                      {tripForm.miles} millas · Ruta más rápida
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setTripForm(p => ({...p, loaded: true}))}
                  style={[s.toggleBtn, tripForm.loaded && { backgroundColor: C.brand, borderColor: C.brand }]}>
                  <Text style={{ fontWeight: '600', color: tripForm.loaded ? '#fff' : C.text }}>📦 Cargado</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTripForm(p => ({...p, loaded: false}))}
                  style={[s.toggleBtn, !tripForm.loaded && { backgroundColor: '#6B7280', borderColor: '#6B7280' }]}>
                  <Text style={{ fontWeight: '600', color: !tripForm.loaded ? '#fff' : C.text }}>📭 Vacío</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.formLabel}>Tarifa ($)</Text>
              <TextInput style={s.input} placeholder="0.00" keyboardType="numeric" value={tripForm.rate} onChangeText={v => setTripForm(p => ({...p, rate: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Descripción de carga</Text>
              <TextInput style={s.input} placeholder="Ej: 8 vehículos, carga seca..." value={tripForm.cargo_description} onChangeText={v => setTripForm(p => ({...p, cargo_description: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Broker / Dispatcher</Text>
              <TextInput style={s.input} placeholder="Nombre del broker" value={tripForm.broker} onChangeText={v => setTripForm(p => ({...p, broker: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Estados por donde viajaste (IFTA)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {US_STATES.map(st => (
                  <TouchableOpacity key={st} onPress={() => toggleState(st)}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: tripForm.states_traveled.includes(st) ? C.brand : '#E2E8F0' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: tripForm.states_traveled.includes(st) ? '#fff' : C.sub }}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.formLabel}>Notas</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top' }]} multiline placeholder="Notas adicionales..." value={tripForm.notes} onChangeText={v => setTripForm(p => ({...p, notes: v}))} placeholderTextColor={C.muted} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* ── FUEL MODAL ── */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'fuel'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setActiveModal('none')}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>⛽ Registrar Combustible</Text>
              <TouchableOpacity onPress={saveFuel} disabled={fuelSaving}>
                {fuelSaving ? <ActivityIndicator size="small" color={C.brand} /> : (
                  <Text style={{ color: C.brand, fontWeight: '700' }}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* ── AI Receipt Scanner ── */}
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F59E0B' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 8 }}>📸 Escanear Recibo con AI</Text>
                <Text style={{ fontSize: 12, color: '#78350F', marginBottom: 12 }}>
                  Toma una foto o selecciona de la galería y la AI extraerá los datos automáticamente.
                </Text>

                {fuelScanning ? (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <ActivityIndicator size="large" color="#D97706" />
                    <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '600', color: '#92400E' }}>🔍 Analizando recibo con AI...</Text>
                    <Text style={{ marginTop: 4, fontSize: 11, color: '#78350F' }}>Esto puede tomar unos segundos</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => scanFuelReceipt('camera')}
                      style={{ flex: 1, backgroundColor: '#D97706', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="camera" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Cámara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => scanFuelReceipt('gallery')}
                      style={{ flex: 1, backgroundColor: '#92400E', paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                    >
                      <Ionicons name="images" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {fuelReceiptImage && !fuelScanning && (
                  <View style={{ marginTop: 10, alignItems: 'center' }}>
                    <Image source={{ uri: fuelReceiptImage }} style={{ width: 120, height: 160, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }} resizeMode="cover" />
                    <Text style={{ fontSize: 11, color: '#059669', marginTop: 4, fontWeight: '600' }}>✅ Recibo procesado</Text>
                  </View>
                )}
              </View>

              <View style={{ height: 1, backgroundColor: C.border, marginBottom: 16 }} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.sub, marginBottom: 10 }}>✏️ Datos del Combustible</Text>

              <Text style={s.formLabel}>Galones *</Text>
              <TextInput style={s.input} placeholder="0.00" keyboardType="numeric" value={fuelForm.gallons} onChangeText={v => setFuelForm(p => ({...p, gallons: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Precio por Galón ($)</Text>
              <TextInput style={s.input} placeholder="0.000" keyboardType="numeric" value={fuelForm.price_per_gallon} onChangeText={v => setFuelForm(p => ({...p, price_per_gallon: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Total ($)</Text>
              <TextInput style={s.input} placeholder="Auto-calculado si vacío" keyboardType="numeric" value={fuelForm.total_cost} onChangeText={v => setFuelForm(p => ({...p, total_cost: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Estado *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {US_STATES.map(st => (
                    <TouchableOpacity key={st} onPress={() => setFuelForm(p => ({...p, state: st}))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                        backgroundColor: fuelForm.state === st ? '#D97706' : '#E2E8F0' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: fuelForm.state === st ? '#fff' : C.sub }}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={s.formLabel}>Estación</Text>
              <TextInput style={s.input} placeholder="Nombre de la estación" value={fuelForm.station} onChangeText={v => setFuelForm(p => ({...p, station: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Ciudad</Text>
              <TextInput style={s.input} placeholder="Ciudad" value={fuelForm.city} onChangeText={v => setFuelForm(p => ({...p, city: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Odómetro</Text>
              <TextInput style={s.input} placeholder="Lectura actual" keyboardType="numeric" value={fuelForm.odometer} onChangeText={v => setFuelForm(p => ({...p, odometer: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Tipo de Combustible</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {[{id: 'diesel', label: '⛽ Diesel'}, {id: 'def', label: '💧 DEF'}, {id: 'gas', label: '🔥 Gasolina'}].map(ft => (
                  <TouchableOpacity key={ft.id} onPress={() => setFuelForm(p => ({...p, fuel_type: ft.id}))}
                    style={[s.toggleBtn, fuelForm.fuel_type === ft.id && { backgroundColor: '#D97706', borderColor: '#D97706' }]}>
                    <Text style={{ fontWeight: '600', color: fuelForm.fuel_type === ft.id ? '#fff' : C.text }}>{ft.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.formLabel}>Notas</Text>
              <TextInput style={[s.input, { height: 60, textAlignVertical: 'top' }]} multiline placeholder="Notas..." value={fuelForm.notes} onChangeText={v => setFuelForm(p => ({...p, notes: v}))} placeholderTextColor={C.muted} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════ */}
      {/* ── SETUP MODAL ── */}
      {/* ════════════════════════════════════════════════ */}
      <Modal visible={activeModal === 'setup'} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: C.bg }}>
            <View style={[s.modalHeader, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setActiveModal('none')}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>🚛 Perfil Camionero</Text>
              <TouchableOpacity onPress={saveSetup} disabled={setupSaving}>
                {setupSaving ? <ActivityIndicator size="small" color={C.brand} /> : (
                  <Text style={{ color: C.brand, fontWeight: '700' }}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={s.formLabel}>Tipo de Transporte *</Text>
              <View style={{ gap: 8, marginBottom: 16 }}>
                {subtypes.map((st: any) => (
                  <TouchableOpacity key={st.id} onPress={() => setSetupForm(p => ({...p, business_subtype: st.id}))}
                    style={[s.card, { padding: 14, flexDirection: 'row', alignItems: 'center',
                      borderWidth: 2, borderColor: setupForm.business_subtype === st.id ? C.brand : 'transparent' }]}>
                    <Text style={{ fontSize: 24, marginRight: 12 }}>{st.icon}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, flex: 1 }}>{st.label}</Text>
                    {setupForm.business_subtype === st.id && <Ionicons name="checkmark-circle" size={22} color={C.brand} />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.formLabel}>Compañía / Company Name</Text>
              <TextInput style={s.input} placeholder="Tu compañía o nombre de negocio" value={setupForm.company_name} onChangeText={v => setSetupForm(p => ({...p, company_name: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Tipo de CDL</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['A', 'B', 'C'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setSetupForm(p => ({...p, cdl_type: t}))}
                    style={[s.toggleBtn, { flex: 1 }, setupForm.cdl_type === t && { backgroundColor: C.brand, borderColor: C.brand }]}>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: setupForm.cdl_type === t ? '#fff' : C.text, textAlign: 'center' }}>CDL {t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.formLabel}>MC Number</Text>
              <TextInput style={s.input} placeholder="MC-XXXXXXX" value={setupForm.mc_number} onChangeText={v => setSetupForm(p => ({...p, mc_number: v}))} placeholderTextColor={C.muted} autoCapitalize="characters" />

              <Text style={s.formLabel}>DOT Number</Text>
              <TextInput style={s.input} placeholder="DOT XXXXXXX" value={setupForm.dot_number} onChangeText={v => setSetupForm(p => ({...p, dot_number: v}))} placeholderTextColor={C.muted} keyboardType="numeric" />

              <Text style={s.formLabel}>Tipo de Trailer</Text>
              <TextInput style={s.input} placeholder="Ej: 53' Dry Van, Car Hauler 9-car..." value={setupForm.trailer_type} onChangeText={v => setSetupForm(p => ({...p, trailer_type: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Largo del Trailer (ft)</Text>
              <TextInput style={s.input} placeholder="Ej: 53" keyboardType="numeric" value={setupForm.trailer_length} onChangeText={v => setSetupForm(p => ({...p, trailer_length: v}))} placeholderTextColor={C.muted} />

              <Text style={s.formLabel}>Estado Base (Home State)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {US_STATES.map(st => (
                    <TouchableOpacity key={st} onPress={() => setSetupForm(p => ({...p, home_state: st}))}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                        backgroundColor: setupForm.home_state === st ? C.brand : '#E2E8F0' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: setupForm.home_state === st ? '#fff' : C.sub }}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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
  actionCard: {
    backgroundColor: C.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12, borderLeftWidth: 4,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  actionSub: { fontSize: 12, color: C.sub, marginTop: 2 },
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
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border, alignItems: 'center',
  },
  inspBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: C.border,
  },
  inspBtnText: { fontSize: 13, fontWeight: '600', color: C.text },
  navBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  divider: { height: 1, backgroundColor: C.border },
});
