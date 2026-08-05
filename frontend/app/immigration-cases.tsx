import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Alert,
  StyleSheet, Platform, ActivityIndicator, RefreshControl, StatusBar,
  KeyboardAvoidingView, Keyboard, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W } = Dimensions.get('window');

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL 
  || Constants.expoConfig?.extra?.backendUrl 
  || '';

const api = axios.create({ baseURL: `${API_BASE}/api` });
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('session_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── COLORS ───
const C = {
  bg: '#0A0E1A',
  card: '#141B2D',
  cardAlt: '#1C2438',
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  accent: '#06B6D4',
  green: '#10B981',
  red: '#EF4444',
  yellow: '#F59E0B',
  orange: '#F97316',
  purple: '#8B5CF6',
  text: '#F8FAFC',
  sub: '#94A3B8',
  muted: '#64748B',
  border: '#1E293B',
  surface: '#0F172A',
};

interface Case {
  id: string;
  case_type: 'uscis' | 'eoir';
  case_number: string;
  display_number: string;
  nickname: string;
  current_status: string;
  last_description: string;
  next_hearing?: string;
  court_location?: string;
  judge_name?: string;
  form_type?: string;
  last_checked: string;
  last_status_change?: string;
  check_success: boolean;
  history: Array<{ status: string; description: string; checked_at: string }>;
}

interface QuickCheckResult {
  success: boolean;
  receipt_number?: string;
  alien_number?: string;
  status_title?: string;
  status_description?: string;
  status_spanish?: string;
  form_type?: string;
  case_status?: string;
  next_hearing?: string;
  court_location?: string;
  judge_name?: string;
  sandbox_mode?: boolean;
  sandbox_reason?: string;
  error?: string;
}

// USCIS Status translations
const STATUS_ES: Record<string, string> = {
  'Case Was Received': 'Caso Recibido',
  'Case Was Approved': 'Caso Aprobado',
  'Case Was Denied': 'Caso Denegado',
  'Request for Evidence Was Sent': 'Solicitud de Evidencia (RFE)',
  'Request for Evidence Was Received': 'Evidencia Recibida',
  'Case Is Being Actively Reviewed': 'En Revisión Activa',
  'Fingerprint Fee Was Received': 'Pago de Huellas Recibido',
  'Case Was Updated To Show Fingerprints Were Taken': 'Huellas Tomadas',
  'Card Is Being Produced': 'Tarjeta en Producción',
  'Card Was Produced': 'Tarjeta Producida',
  'Card Was Mailed To Me': 'Tarjeta Enviada por Correo',
  'Card Was Picked Up By The United States Postal Service': 'Tarjeta Recogida por USPS',
  'Card Was Delivered To Me By The Post Office': 'Tarjeta Entregada',
  'Interview Was Scheduled': 'Entrevista Programada',
  'Interview Was Completed': 'Entrevista Completada',
  'Decision Was Mailed': 'Decisión Enviada',
  'Case Was Transferred': 'Caso Transferido',
  'Case Closed': 'Caso Cerrado',
};

const translateStatus = (s: string) => STATUS_ES[s] || s;

const getStatusColor = (status: string) => {
  const lower = (status || '').toLowerCase();
  if (lower.includes('approved') || lower.includes('produced') || lower.includes('delivered') || lower.includes('mailed') || lower.includes('granted')) return C.green;
  if (lower.includes('denied') || lower.includes('rejected') || lower.includes('closed')) return C.red;
  if (lower.includes('evidence') || lower.includes('interview') || lower.includes('scheduled')) return C.yellow;
  if (lower.includes('review') || lower.includes('fingerprint') || lower.includes('pending')) return C.orange;
  return C.primaryLight;
};

const getStatusEmoji = (status: string) => {
  const lower = (status || '').toLowerCase();
  if (lower.includes('approved') || lower.includes('granted')) return '✅';
  if (lower.includes('denied') || lower.includes('rejected')) return '❌';
  if (lower.includes('produced') || lower.includes('mailed') || lower.includes('delivered')) return '📬';
  if (lower.includes('evidence')) return '📋';
  if (lower.includes('interview') || lower.includes('scheduled')) return '📅';
  if (lower.includes('review') || lower.includes('actively')) return '🔍';
  if (lower.includes('fingerprint')) return '👆';
  if (lower.includes('received')) return '📨';
  return '⏳';
};

type TabType = 'quick' | 'cases' | 'info';

export default function ImmigrationCasesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>('quick');
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Quick Check state
  const [quickType, setQuickType] = useState<'uscis' | 'eoir'>('uscis');
  const [quickNumber, setQuickNumber] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<QuickCheckResult | null>(null);
  
  // Add Case state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'uscis' | 'eoir'>('uscis');
  const [caseNumber, setCaseNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [adding, setAdding] = useState(false);
  
  // Detail state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [refreshingCase, setRefreshingCase] = useState('');
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    checkAuth();
  }, []);
  
  useEffect(() => {
    if (activeTab === 'cases' && isLoggedIn) loadCases();
  }, [activeTab, isLoggedIn]);
  
  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('session_token');
    setIsLoggedIn(!!token);
  };
  
  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/immigration/cases');
      setCases(res.data.cases || []);
    } catch (e: any) {
      if (e.response?.status === 401) setIsLoggedIn(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const doQuickCheck = async () => {
    if (!quickNumber.trim()) {
      Alert.alert('Error', quickType === 'uscis' 
        ? 'Ingresa tu número de recibo (ej: EAC2490123456)' 
        : 'Ingresa tu número A (ej: A123456789)');
      return;
    }
    Keyboard.dismiss();
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await api.post('/immigration/quick-check', {
        case_type: quickType,
        case_number: quickNumber.trim(),
      });
      setQuickResult(res.data);
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Error al consultar. Intenta de nuevo.';
      setQuickResult({ success: false, error: msg });
    } finally {
      setQuickLoading(false);
    }
  };

  const addCase = async () => {
    if (!caseNumber.trim()) {
      Alert.alert('Error', 'Ingresa un número de caso');
      return;
    }
    setAdding(true);
    try {
      const res = await api.post('/immigration/cases', {
        case_type: addType,
        case_number: caseNumber.trim(),
        nickname: nickname.trim(),
      });
      if (res.data.success) {
        setCases(prev => [res.data.case, ...prev]);
        setShowAddModal(false);
        setCaseNumber('');
        setNickname('');
        Alert.alert('✅ Caso Agregado', 'Recibirás notificaciones cuando cambie el estado.');
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Error agregando caso';
      Alert.alert('Error', msg);
    } finally {
      setAdding(false);
    }
  };

  const refreshCase = async (caseId: string) => {
    setRefreshingCase(caseId);
    try {
      const res = await api.post(`/immigration/cases/${caseId}/refresh`);
      if (res.data.success) {
        if (res.data.status_changed) {
          Alert.alert('🔔 ¡Cambio Detectado!', `Nuevo estado: ${translateStatus(res.data.current_status)}`);
        }
        await loadCases();
      } else {
        Alert.alert('Info', res.data.error || 'No se pudo actualizar');
      }
    } catch (e: any) {
      Alert.alert('Error', 'No se pudo actualizar el caso');
    } finally {
      setRefreshingCase('');
    }
  };

  const deleteCase = (caseId: string) => {
    Alert.alert('Eliminar Caso', '¿Dejar de rastrear este caso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/immigration/cases/${caseId}`);
            setCases(prev => prev.filter(c => c.id !== caseId));
            if (selectedCase?.id === caseId) setSelectedCase(null);
          } catch {}
        }
      }
    ]);
  };

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Ahora';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)} sem`;
  };

  // ═══════════════════════════════════════════════
  // CASE DETAIL VIEW
  // ═══════════════════════════════════════════════
  if (selectedCase) {
    return (
      <View style={s.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0A0E1A', '#141B2D']} style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setSelectedCase(null)} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: C.sub, letterSpacing: 1 }}>
              {selectedCase.case_type === 'uscis' ? '🇺🇸 USCIS' : '⚖️ EOIR'}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.text }}>
              {selectedCase.display_number}
            </Text>
          </View>
          <TouchableOpacity onPress={() => refreshCase(selectedCase.id)} style={s.backBtn}>
            {refreshingCase === selectedCase.id 
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="refresh" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          {/* Big Status Card */}
          <LinearGradient 
            colors={[getStatusColor(selectedCase.current_status) + '25', C.card]}
            style={s.bigStatusCard}
          >
            <Text style={{ fontSize: 36, marginBottom: 8 }}>{getStatusEmoji(selectedCase.current_status)}</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' }}>
              {translateStatus(selectedCase.current_status) || 'Pendiente'}
            </Text>
            {selectedCase.form_type && (
              <View style={[s.pill, { marginTop: 10 }]}>
                <Text style={{ fontSize: 12, color: C.accent, fontWeight: '600' }}>{selectedCase.form_type}</Text>
              </View>
            )}
            {selectedCase.last_description ? (
              <Text style={{ fontSize: 13, color: C.sub, marginTop: 12, textAlign: 'center', lineHeight: 19 }}>
                {selectedCase.last_description}
              </Text>
            ) : null}
          </LinearGradient>

          {/* EOIR Hearing Info */}
          {selectedCase.case_type === 'eoir' && selectedCase.next_hearing && (
            <View style={s.infoCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="calendar" size={18} color={C.yellow} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginLeft: 8 }}>Próxima Audiencia</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.yellow }}>📅 {selectedCase.next_hearing}</Text>
              {selectedCase.court_location && (
                <Text style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>📍 {selectedCase.court_location}</Text>
              )}
              {selectedCase.judge_name && (
                <Text style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>⚖️ {selectedCase.judge_name}</Text>
              )}
            </View>
          )}

          {/* Meta */}
          <View style={[s.infoCard, { flexDirection: 'row', justifyContent: 'space-around' }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: C.muted }}>Verificado</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginTop: 2 }}>{timeAgo(selectedCase.last_checked)}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: C.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: C.muted }}>Cambios</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginTop: 2 }}>
                {selectedCase.history?.length || 0}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: C.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: C.muted }}>Tipo</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: C.accent, marginTop: 2 }}>
                {selectedCase.case_type.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* History */}
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, marginTop: 20, marginBottom: 12 }}>
            Historial de Cambios
          </Text>
          {(!selectedCase.history || selectedCase.history.length === 0) ? (
            <View style={s.infoCard}>
              <Text style={{ color: C.sub, textAlign: 'center', fontSize: 13 }}>
                Sin cambios registrados. Te notificaremos cuando haya actualizaciones.
              </Text>
            </View>
          ) : (
            selectedCase.history.slice().reverse().map((h, i) => (
              <View key={i} style={[s.historyItem, i === 0 && { borderLeftColor: C.green }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.text, flex: 1 }}>
                    {getStatusEmoji(h.status)} {translateStatus(h.status)}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{new Date(h.checked_at).toLocaleDateString('es')}</Text>
                </View>
              </View>
            ))
          )}

          {/* Actions */}
          <TouchableOpacity onPress={() => deleteCase(selectedCase.id)} style={s.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={C.red} />
            <Text style={{ color: C.red, fontSize: 14, fontWeight: '600', marginLeft: 6 }}>Dejar de rastrear</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════
  // ADD CASE MODAL
  // ═══════════════════════════════════════════════
  if (showAddModal) {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#0A0E1A', '#141B2D']} style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.backBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' }}>
            Agregar Caso
          </Text>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {/* Type selector */}
          <Text style={s.label}>Tipo de caso</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => setAddType('uscis')}
              style={[s.typeBtn, addType === 'uscis' && s.typeBtnActive]}
            >
              <Text style={{ fontSize: 32 }}>🇺🇸</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginTop: 8 }}>USCIS</Text>
              <Text style={{ fontSize: 11, color: C.sub, marginTop: 4, textAlign: 'center' }}>Green Card, EAD,{'\n'}Ciudadanía</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAddType('eoir')}
              style={[s.typeBtn, addType === 'eoir' && s.typeBtnActive]}
            >
              <Text style={{ fontSize: 32 }}>⚖️</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginTop: 8 }}>Corte (EOIR)</Text>
              <Text style={{ fontSize: 11, color: C.sub, marginTop: 4, textAlign: 'center' }}>Audiencias, Asilo,{'\n'}Deportación</Text>
            </TouchableOpacity>
          </View>

          {/* Case number */}
          <Text style={s.label}>{addType === 'uscis' ? 'Número de Recibo' : 'Número A (Alien Number)'}</Text>
          <TextInput
            style={s.input}
            value={caseNumber}
            onChangeText={setCaseNumber}
            placeholder={addType === 'uscis' ? 'EAC2490123456' : 'A123456789'}
            placeholderTextColor={C.muted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={s.hint}>
            {addType === 'uscis'
              ? '📝 3 letras + 10 dígitos. Encuéntralo en tu notificación de USCIS.'
              : '📝 9 dígitos. Encuéntralo en tu citación de corte.'}
          </Text>

          {/* Nickname */}
          <Text style={[s.label, { marginTop: 20 }]}>Apodo (opcional)</Text>
          <TextInput
            style={s.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Ej: Green Card de mamá"
            placeholderTextColor={C.muted}
          />

          {/* Submit */}
          <TouchableOpacity onPress={addCase} style={s.mainBtn} disabled={adding}>
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.mainBtnText}>🔍 Verificar y Rastrear</Text>
            )}
          </TouchableOpacity>
          
          <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 12 }}>
            Te enviaremos una notificación cada vez que cambie el estado de tu caso.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ═══════════════════════════════════════════════
  // MAIN SCREEN WITH TABS
  // ═══════════════════════════════════════════════
  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient colors={['#0A0E1A', '#0F172A']} style={[s.headerBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>Mi Caso USA</Text>
          <Text style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>Rastreo de Inmigración</Text>
        </View>
        {isLoggedIn && activeTab === 'cases' && (
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={s.addBtnHeader}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        {([
          { key: 'quick' as TabType, label: 'Consulta', icon: 'search' },
          { key: 'cases' as TabType, label: 'Mis Casos', icon: 'folder-open' },
          { key: 'info' as TabType, label: 'Tiempos', icon: 'time' },
        ]).map(tab => (
          <TouchableOpacity 
            key={tab.key} 
            onPress={() => setActiveTab(tab.key)}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={18} 
              color={activeTab === tab.key ? C.accent : C.muted} 
            />
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── TAB: QUICK CHECK ─── */}
      {activeTab === 'quick' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView 
            style={{ flex: 1 }} 
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero */}
            <View style={s.heroCard}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🛂</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' }}>
                Consulta Rápida
              </Text>
              <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 4, lineHeight: 18 }}>
                Verifica el estado de tu caso de inmigración al instante. No requiere cuenta.
              </Text>
            </View>

            {/* Type Toggle */}
            <View style={s.toggleRow}>
              <TouchableOpacity 
                onPress={() => { setQuickType('uscis'); setQuickResult(null); }}
                style={[s.toggleBtn, quickType === 'uscis' && s.toggleBtnActive]}
              >
                <Text style={{ fontSize: 16 }}>🇺🇸</Text>
                <Text style={[s.toggleText, quickType === 'uscis' && s.toggleTextActive]}>USCIS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { setQuickType('eoir'); setQuickResult(null); }}
                style={[s.toggleBtn, quickType === 'eoir' && s.toggleBtnActive]}
              >
                <Text style={{ fontSize: 16 }}>⚖️</Text>
                <Text style={[s.toggleText, quickType === 'eoir' && s.toggleTextActive]}>Corte</Text>
              </TouchableOpacity>
            </View>

            {/* Input */}
            <View style={s.inputRow}>
              <TextInput
                style={s.searchInput}
                value={quickNumber}
                onChangeText={setQuickNumber}
                placeholder={quickType === 'uscis' ? 'EAC2490123456' : 'A123456789'}
                placeholderTextColor={C.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={doQuickCheck}
              />
              <TouchableOpacity onPress={doQuickCheck} style={s.searchBtn} disabled={quickLoading}>
                {quickLoading 
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="search" size={20} color="#fff" />
                }
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>
              {quickType === 'uscis'
                ? '📝 Número de recibo: 3 letras + 10 dígitos'
                : '📝 Número A: 7-9 dígitos (con o sin la letra A)'}
            </Text>

            {/* Quick Result */}
            {quickResult && (
              <View style={{ marginTop: 20 }}>
                {quickResult.success ? (
                  <View style={s.resultCard}>
                    {/* Sandbox indicator */}
                    {quickResult.sandbox_mode && (
                      <View style={s.sandboxBanner}>
                        <Ionicons name="information-circle" size={14} color={C.yellow} />
                        <Text style={{ fontSize: 11, color: C.yellow, marginLeft: 6, flex: 1 }}>
                          Modo demo • {quickResult.sandbox_reason || 'Datos de demostración'}
                        </Text>
                      </View>
                    )}
                    
                    {/* Status */}
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <Text style={{ fontSize: 40, marginBottom: 8 }}>
                        {getStatusEmoji(quickResult.status_title || quickResult.case_status || '')}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center' }}>
                        {translateStatus(quickResult.status_title || quickResult.case_status || '')}
                      </Text>
                      {quickResult.form_type && (
                        <View style={[s.pill, { marginTop: 8 }]}>
                          <Text style={{ fontSize: 12, color: C.accent }}>{quickResult.form_type}</Text>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    {quickResult.status_description && (
                      <View style={{ backgroundColor: C.surface, borderRadius: 12, padding: 12, marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: C.sub, lineHeight: 19 }}>
                          {quickResult.status_description}
                        </Text>
                      </View>
                    )}

                    {/* EOIR details */}
                    {quickResult.next_hearing && (
                      <View style={{ marginTop: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <Ionicons name="calendar" size={16} color={C.yellow} />
                          <Text style={{ fontSize: 13, color: C.yellow, fontWeight: '600', marginLeft: 6 }}>
                            {quickResult.next_hearing}
                          </Text>
                        </View>
                        {quickResult.court_location && (
                          <Text style={{ fontSize: 12, color: C.sub, marginLeft: 22 }}>📍 {quickResult.court_location}</Text>
                        )}
                        {quickResult.judge_name && (
                          <Text style={{ fontSize: 12, color: C.sub, marginLeft: 22, marginTop: 2 }}>⚖️ {quickResult.judge_name}</Text>
                        )}
                      </View>
                    )}

                    {/* CTA */}
                    {isLoggedIn && (
                      <TouchableOpacity 
                        onPress={() => {
                          setAddType(quickType);
                          setCaseNumber(quickNumber);
                          setShowAddModal(true);
                        }}
                        style={[s.mainBtn, { marginTop: 16 }]}
                      >
                        <Text style={s.mainBtnText}>📌 Rastrear Este Caso</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={[s.resultCard, { borderColor: C.red + '40' }]}>
                    <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>⚠️</Text>
                    <Text style={{ fontSize: 14, color: C.red, textAlign: 'center', fontWeight: '600' }}>
                      {quickResult.error}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Info boxes */}
            {!quickResult && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 }}>
                  ¿Dónde encuentro mi número?
                </Text>
                <View style={s.tipCard}>
                  <Text style={{ fontSize: 13, color: C.sub, lineHeight: 20 }}>
                    🇺🇸 <Text style={{ fontWeight: '600', color: C.text }}>USCIS Receipt Number</Text>{'\n'}
                    Está en la esquina superior izquierda de tu notificación I-797C. Empieza con 3 letras (EAC, WAC, LIN, SRC, MSC, IOE).
                  </Text>
                </View>
                <View style={[s.tipCard, { marginTop: 8 }]}>
                  <Text style={{ fontSize: 13, color: C.sub, lineHeight: 20 }}>
                    ⚖️ <Text style={{ fontWeight: '600', color: C.text }}>Número A (Corte)</Text>{'\n'}
                    Está en tu NTA (Notice to Appear) o citación de corte. Es un número de 9 dígitos que empieza con "A".
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ─── TAB: MY CASES ─── */}
      {activeTab === 'cases' && (
        <>
          {!isLoggedIn ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'center' }}>
                Inicia Sesión
              </Text>
              <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                Necesitas una cuenta para rastrear tus casos y recibir notificaciones de cambios.
              </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={[s.mainBtn, { marginTop: 20, width: '100%' }]}>
                <Text style={s.mainBtnText}>Iniciar Sesión</Text>
              </TouchableOpacity>
            </View>
          ) : loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={C.accent} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCases(); }} tintColor={C.accent} />}
            >
              {cases.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>Sin Casos</Text>
                  <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
                    Agrega tu primer caso para recibir alertas automáticas cuando USCIS o la Corte actualice tu estatus.
                  </Text>
                  <TouchableOpacity onPress={() => setShowAddModal(true)} style={[s.mainBtn, { marginTop: 20, paddingHorizontal: 32 }]}>
                    <Text style={s.mainBtnText}>+ Agregar Caso</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                cases.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => setSelectedCase(c)} activeOpacity={0.8}>
                    <View style={s.caseCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[s.caseIcon, { backgroundColor: getStatusColor(c.current_status) + '20' }]}>
                          <Text style={{ fontSize: 20 }}>{c.case_type === 'uscis' ? '🇺🇸' : '⚖️'}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{c.display_number}</Text>
                          <Text style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                            {c.nickname || c.form_type || (c.case_type === 'uscis' ? 'USCIS' : 'Corte')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => refreshCase(c.id)}
                          style={{ padding: 10 }}
                          disabled={refreshingCase === c.id}
                        >
                          {refreshingCase === c.id ? (
                            <ActivityIndicator size="small" color={C.accent} />
                          ) : (
                            <Ionicons name="sync-outline" size={18} color={C.muted} />
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Status Badge */}
                      <View style={[s.statusBadge, { backgroundColor: getStatusColor(c.current_status) + '15', marginTop: 12 }]}>
                        <Text style={{ fontSize: 14, marginRight: 6 }}>{getStatusEmoji(c.current_status)}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: getStatusColor(c.current_status) }}>
                          {translateStatus(c.current_status) || 'Verificando...'}
                        </Text>
                      </View>

                      {/* EOIR hearing */}
                      {c.case_type === 'eoir' && c.next_hearing && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <Ionicons name="calendar-outline" size={13} color={C.yellow} />
                          <Text style={{ fontSize: 12, color: C.yellow, marginLeft: 6 }}>Audiencia: {c.next_hearing}</Text>
                        </View>
                      )}

                      {/* Footer */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                        <Text style={{ fontSize: 11, color: C.muted }}>Verificado {timeAgo(c.last_checked)}</Text>
                        {c.last_status_change && (
                          <Text style={{ fontSize: 11, color: C.green }}>Cambio {timeAgo(c.last_status_change)}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* ─── TAB: PROCESSING TIMES ─── */}
      {activeTab === 'info' && (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        >
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 }}>
            Tiempos de Procesamiento
          </Text>
          <Text style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>
            Estimados de USCIS • Actualizado Enero 2026
          </Text>

          {/* Processing time cards */}
          {[
            { form: 'I-130', name: 'Petición Familiar', time: '12-24 meses', icon: '👨‍👩‍👧', color: C.purple },
            { form: 'I-485', name: 'Ajuste de Estatus (Green Card)', time: '8-14 meses', icon: '💚', color: C.green },
            { form: 'I-765', name: 'Permiso de Trabajo (EAD)', time: '3-7 meses', icon: '💼', color: C.primaryLight },
            { form: 'N-400', name: 'Ciudadanía', time: '6-12 meses', icon: '🗽', color: C.accent },
            { form: 'I-131', name: 'Documento de Viaje', time: '4-8 meses', icon: '✈️', color: C.orange },
            { form: 'I-140', name: 'Petición de Trabajador', time: '6-18 meses', icon: '🏢', color: C.yellow },
            { form: 'I-751', name: 'Remover Condiciones (Green Card)', time: '12-24 meses', icon: '📋', color: C.red },
            { form: 'I-90', name: 'Renovar Green Card', time: '8-14 meses', icon: '🔄', color: C.green },
          ].map((item, idx) => (
            <View key={idx} style={s.timeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 24, marginRight: 12 }}>{item.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{item.form}</Text>
                </View>
                <View style={[s.timeBadge, { backgroundColor: item.color + '20' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: item.color }}>{item.time}</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Disclaimer */}
          <View style={[s.tipCard, { marginTop: 16 }]}>
            <Text style={{ fontSize: 12, color: C.sub, lineHeight: 18 }}>
              ⚠️ Los tiempos son estimados y varían según el centro de servicio, complejidad del caso, y demanda actual. Consulta uscis.gov/processing-times para datos oficiales.
            </Text>
          </View>

          {/* Cross-sell */}
          <LinearGradient colors={['#1E3A5F', '#1E293B']} style={s.crossSell}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>¿Necesitas preparar taxes?</Text>
            <Text style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 17 }}>
              Ross Tax Preparation • Servicio especial para inmigrantes con ITIN o SSN nuevo.
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/services')}
              style={{ marginTop: 10, backgroundColor: C.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Ver Servicios →</Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  addBtnHeader: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  
  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  tabTextActive: { color: C.accent },
  
  // Quick check
  heroCard: { alignItems: 'center', paddingVertical: 20, backgroundColor: C.card, borderRadius: 16, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  toggleBtnActive: { backgroundColor: C.primary + '30' },
  toggleText: { fontSize: 13, fontWeight: '600', color: C.muted },
  toggleTextActive: { color: C.accent },
  inputRow: { flexDirection: 'row', gap: 10 },
  searchInput: { flex: 1, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border },
  searchBtn: { width: 50, height: 50, borderRadius: 12, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  
  // Results
  resultCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  sandboxBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.yellow + '10', borderRadius: 8, padding: 8, marginBottom: 12 },
  pill: { backgroundColor: C.accent + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  
  // Tips
  tipCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  
  // Cases
  caseCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  caseIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  
  // Detail
  bigStatusCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  infoCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  historyItem: { backgroundColor: C.card, borderRadius: 10, padding: 12, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: C.muted },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 16 },
  
  // Forms
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8 },
  hint: { fontSize: 11, color: C.muted, marginTop: 6 },
  input: { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: C.text, borderWidth: 1, borderColor: C.border },
  typeBtn: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: C.border },
  typeBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '10' },
  mainBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  mainBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  
  // Times
  timeCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  timeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  
  // Cross sell
  crossSell: { borderRadius: 16, padding: 20, marginTop: 20 },
});
