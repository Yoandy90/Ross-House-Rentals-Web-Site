/**
 * GPS Route Tracker — Rastreo de Ruta en Tiempo Real
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  ScrollView, Platform, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import api from '../services/api';

const C = {
  bg: '#F2F2F7', card: '#fff', text: '#1C1C1E', sub: '#636366', muted: '#AEAEB2',
  border: '#E5E5EA', brand: '#1E40AF', success: '#059669', danger: '#DC2626',
  warning: '#D97706', purple: '#7C3AED',
};

export default function TruckerGPSScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ origin?: string; destination?: string; load_id?: string; load_number?: string }>();

  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [totalMiles, setTotalMiles] = useState(0);
  const [statesDetected, setStatesDetected] = useState<string[]>([]);
  const [waypointCount, setWaypointCount] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentState, setCurrentState] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [routes, setRoutes] = useState<any[]>([]);
  const [origin, setOrigin] = useState(params.origin || '');
  const [destination, setDestination] = useState(params.destination || '');
  const [linkedLoadId, setLinkedLoadId] = useState(params.load_id || '');
  const [linkedLoadNumber, setLinkedLoadNumber] = useState(params.load_number || '');

  const locationSubRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Load initial data
  useEffect(() => {
    loadData();
    return () => {
      if (locationSubRef.current) locationSubRef.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Timer for elapsed time
  useEffect(() => {
    if (tracking && startTime) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - startTime.getTime()) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${h}:${m}:${s}`);
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tracking, startTime]);

  const loadData = async () => {
    try {
      // Check active route
      const activeRes = await api.get('/trucker/gps/active');
      if (activeRes.data.active) {
        setTracking(true);
        setRouteId(activeRes.data.id);
        setTotalMiles(activeRes.data.total_miles || 0);
        setStatesDetected(activeRes.data.states_detected || []);
        setWaypointCount(activeRes.data.waypoints?.length || 0);
        setStartTime(new Date(activeRes.data.start_time));
        setOrigin(activeRes.data.origin || '');
        setDestination(activeRes.data.destination || '');
        // Resume tracking
        startLocationTracking();
      }

      // Load completed routes
      const routesRes = await api.get('/trucker/gps/routes?limit=10');
      setRoutes(routesRes.data.routes || []);
    } catch (e) {
      console.error('GPS load error', e);
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso al GPS para rastrear tu ruta.');
        return false;
      }

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 100, // Update every 100 meters
          timeInterval: 30000, // or every 30 seconds
        },
        async (location) => {
          try {
            const res = await api.post('/trucker/gps/waypoint', {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              speed: (location.coords.speed || 0) * 2.237, // m/s to mph
            });
            if (res.data.success) {
              setTotalMiles(res.data.total_miles);
              setWaypointCount(res.data.waypoint_count);
              if (res.data.state) setCurrentState(res.data.state);
            }
          } catch (e) {
            console.error('Waypoint error', e);
          }
          setCurrentSpeed(Math.round((location.coords.speed || 0) * 2.237));
        }
      );
      return true;
    } catch (e) {
      console.error('Location tracking error', e);
      return false;
    }
  };

  const startTracking = async () => {
    try {
      // Get current location first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso GPS', 'Necesitamos acceso al GPS para rastrear tu ruta.');
        return;
      }

      const currentLoc = await Location.getCurrentPositionAsync({});

      const res = await api.post('/trucker/gps/start', {
        origin,
        destination,
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
        speed: (currentLoc.coords.speed || 0) * 2.237,
        load_id: linkedLoadId || undefined,
      });

      if (res.data.success) {
        setRouteId(res.data.route_id);
        setTracking(true);
        setStartTime(new Date());
        setTotalMiles(0);
        setStatesDetected([]);
        setWaypointCount(1);
        await startLocationTracking();

        // Update load status to in_transit if linked
        if (linkedLoadId) {
          try {
            await api.put(`/trucker/car-hauler/loads/${linkedLoadId}`, { status: 'in_transit' });
          } catch (e) { console.log('Could not update load status', e); }
        }

        Alert.alert('🛰️ GPS Activo', linkedLoadNumber
          ? `Rastreando ruta para carga ${linkedLoadNumber}`
          : 'Tu ruta se está rastreando en tiempo real.');
      } else {
        Alert.alert('⚠️', res.data.error || 'No se pudo iniciar el rastreo');
      }
    } catch (e) {
      console.error('Start tracking error', e);
      Alert.alert('Error', 'No se pudo iniciar el GPS');
    }
  };

  const stopTracking = async () => {
    Alert.alert('⏹️ Detener GPS', '¿Deseas detener el rastreo de ruta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Detener', style: 'destructive', onPress: async () => {
          try {
            if (locationSubRef.current) {
              locationSubRef.current.remove();
              locationSubRef.current = null;
            }

            const res = await api.post('/trucker/gps/stop');
            setTracking(false);
            setRouteId(null);

            // Update load status to delivered if linked
            if (linkedLoadId) {
              try {
                await api.put(`/trucker/car-hauler/loads/${linkedLoadId}`, { status: 'delivered' });
              } catch (e) { console.log('Could not update load status', e); }
            }

            Alert.alert('✅ Ruta Finalizada',
              `📏 ${res.data.total_miles?.toFixed(1)} millas\n🗺️ ${res.data.states_detected?.length || 0} estados\n⏱️ ${res.data.duration_hours?.toFixed(1)} horas${linkedLoadNumber ? `\n📦 Carga ${linkedLoadNumber} marcada como entregada` : ''}`
            );
            loadData();
          } catch (e) {
            Alert.alert('Error', 'No se pudo detener el rastreo');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[s.center, { flex: 1, backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E3A5F']} style={{ paddingTop: insets.top + 10, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }}>🛰️ GPS — Rastreo de Ruta</Text>
          {tracking && (
            <View style={{ backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>● EN VIVO</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 30 }}>
        {/* ── LINKED LOAD BANNER ── */}
        {linkedLoadId && !tracking ? (
          <View style={{
            backgroundColor: '#F3E8FF', borderRadius: 12, padding: 14, marginBottom: 12,
            borderWidth: 1.5, borderColor: '#C4B5FD', flexDirection: 'row', alignItems: 'center', gap: 10,
          }}>
            <Ionicons name="link" size={22} color="#7C3AED" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#5B21B6' }}>
                📦 Carga Vinculada: {linkedLoadNumber || linkedLoadId.slice(-6)}
              </Text>
              <Text style={{ fontSize: 11, color: '#7C3AED', marginTop: 2 }}>
                {origin} → {destination}
              </Text>
              <Text style={{ fontSize: 10, color: '#8B5CF6', marginTop: 2 }}>
                Al iniciar GPS, la carga cambiará a "En Ruta". Al detener, se marcará "Entregada".
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── ACTIVE TRACKING PANEL ── */}
        {tracking ? (
          <View style={[s.card, { padding: 20, marginBottom: 16, borderWidth: 2, borderColor: '#059669' }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.success, letterSpacing: 2 }}>🛰️ RASTREO ACTIVO</Text>
              <Text style={{ fontSize: 48, fontWeight: '900', color: C.text, marginTop: 4, fontVariant: ['tabular-nums'] }}>{elapsedTime}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#1E40AF' }}>{totalMiles.toFixed(1)}</Text>
                <Text style={s.statLabel}>Millas</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#ECFDF5' }]}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#059669' }}>{currentSpeed}</Text>
                <Text style={s.statLabel}>MPH</Text>
              </View>
              <View style={[s.statCard, { flex: 1, backgroundColor: '#FFFBEB' }]}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#D97706' }}>{waypointCount}</Text>
                <Text style={s.statLabel}>Puntos</Text>
              </View>
            </View>

            {currentState ? (
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <View style={{ backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>📍 Estado actual: {currentState}</Text>
                </View>
              </View>
            ) : null}

            {statesDetected.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.sub, marginBottom: 6 }}>Estados detectados:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {statesDetected.map(st => (
                    <View key={st} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E40AF' }}>{st}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity onPress={stopTracking}
              style={{ backgroundColor: '#DC2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>⏹️ Detener Rastreo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── START TRACKING ── */
          <View style={[s.card, { padding: 20, marginBottom: 16 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 50 }}>🛰️</Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 8 }}>Iniciar Rastreo GPS</Text>
              <Text style={{ fontSize: 13, color: C.sub, textAlign: 'center', marginTop: 4 }}>
                Rastrea tu ruta en tiempo real. Detectaremos automáticamente las millas y estados por los que viajes.
              </Text>
            </View>

            <TouchableOpacity onPress={startTracking}
              style={{ backgroundColor: '#059669', paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>▶️ Iniciar GPS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── COMPLETED ROUTES ── */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 10 }}>📍 Rutas Completadas</Text>
        {routes.length === 0 ? (
          <View style={[s.card, { padding: 30, alignItems: 'center' }]}>
            <Text style={{ fontSize: 40 }}>🗺️</Text>
            <Text style={{ fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 8 }}>No hay rutas completadas aún.{'\n'}Inicia tu primer rastreo GPS.</Text>
          </View>
        ) : (
          routes.map((route: any) => (
            <View key={route.id} style={[s.card, { padding: 14, marginBottom: 8 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>
                  {route.origin || '📍'} → {route.destination || '🏁'}
                </Text>
                <Text style={{ fontSize: 12, color: C.muted }}>{new Date(route.end_time).toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Text style={{ fontSize: 13, color: C.brand, fontWeight: '600' }}>📏 {route.total_miles?.toFixed(1)} mi</Text>
                <Text style={{ fontSize: 13, color: C.success, fontWeight: '600' }}>⏱️ {route.duration_hours?.toFixed(1)}h</Text>
                <Text style={{ fontSize: 13, color: C.warning, fontWeight: '600' }}>🗺️ {route.states_detected?.length || 0} estados</Text>
              </View>
              {route.states_detected?.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {route.states_detected.map((st: string) => (
                    <View key={st} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#1E40AF' }}>{st}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.card, borderRadius: 12, overflow: 'hidden' },
  statCard: { borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, fontWeight: '600', color: C.sub, marginTop: 2 },
});
