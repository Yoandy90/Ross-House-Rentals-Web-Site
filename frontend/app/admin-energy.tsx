/**
 * Admin Energy Screen - Xcel Energy Green Button
 * Electricity consumption per rental property
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getToken } from '../src/utils/api';
import { useColors } from '../src/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

interface Connection {
  id: string;
  property_id: string;
  property_address?: string;
  status?: string;
  last_sync?: string;
  last_error?: string;
}

interface Usage {
  monthly: { month: string; kwh: number }[];
  current_month_kwh: number;
  prev_month_kwh: number;
  delta_pct: number | null;
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const monthLabel = (ym: string) => MONTHS_ES[parseInt(ym.split('-')[1], 10) - 1];

export default function AdminEnergyScreen() {
  const C = useColors();
  const styles = React.useMemo(() => create_styles(C), [C]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, Usage>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const connsRes = await fetch(`${API_URL}/api/admin/xcel/connections`, { headers });
      const connsData = await connsRes.json();
      const conns: Connection[] = connsData.connections || [];
      setConnections(conns);

      const entries = await Promise.all(
        conns.map(async (c) => {
          const r = await fetch(`${API_URL}/api/admin/xcel/usage/${c.property_id}?months=6`, { headers });
          return [c.property_id, await r.json()] as [string, Usage];
        })
      );
      setUsageMap(Object.fromEntries(entries));
    } catch (e) {
      console.error('Error loading energy data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const connectProperty = () => {
    // Flujo oficial de Xcel (jul 2026): la autorización la inicia el TITULAR
    // de la cuenta de luz desde SU cuenta de Xcel — no desde nuestra app.
    Alert.alert(
      'Cómo conectar con Xcel',
      'El titular de la cuenta de luz debe autorizar desde SU cuenta de Xcel:\n\n' +
        '1. Entrar a xcelenergy.com → My Account\n' +
        '2. Ir a Usage & Cost\n' +
        '3. Tocar "GREEN BUTTON CONNECT"\n' +
        '4. Seleccionar el medidor → Next\n' +
        '5. Elegir "Ross House Rent" de la lista\n' +
        '6. Rango de fechas (2 años) → aceptar → Submit\n\n' +
        'Después, registra el token desde el panel web:\nAdmin → Energía → Registrar conexión',
      [
        { text: 'Abrir xcelenergy.com', onPress: () => Linking.openURL('https://www.xcelenergy.com') },
        { text: 'Entendido', style: 'cancel' as const },
      ]
    );
  };

  const syncConnection = async (conn: Connection) => {
    setSyncing(conn.id);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_URL}/api/admin/xcel/connections/${conn.id}/sync`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al sincronizar');
      Alert.alert('✅ Sincronizado', `${data.days_updated} días de consumo actualizados`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <View style={styles.container} testID="admin-energy-screen">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity testID="energy-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Energía</Text>
          <Text style={styles.headerSub}>Consumo Xcel Energy por propiedad</Text>
        </View>
        <TouchableOpacity testID="energy-connect-btn" onPress={connectProperty} style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EAB308" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EAB308" />}
        >
          {connections.length === 0 ? (
            <View style={styles.emptyBox} testID="energy-empty-state">
              <View style={styles.emptyIcon}>
                <Ionicons name="flash-outline" size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>Sin propiedades conectadas</Text>
              <Text style={styles.emptyText}>
                Toca + para conectar una propiedad con Xcel Energy y ver su consumo eléctrico
              </Text>
            </View>
          ) : (
            connections.map((conn) => {
              const usage = usageMap[conn.property_id];
              const maxKwh = usage?.monthly?.length ? Math.max(...usage.monthly.map((m) => m.kwh), 1) : 1;
              return (
                <View key={conn.id} style={styles.card} testID={`energy-card-${conn.property_id}`}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {conn.property_address || conn.property_id}
                      </Text>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: conn.status === 'active' ? '#10B981' : '#F59E0B' },
                          ]}
                        />
                        <Text style={styles.statusText}>
                          {conn.status === 'active' ? 'Conectada' : 'Requiere reautorización'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      testID={`energy-sync-${conn.property_id}`}
                      onPress={() => syncConnection(conn)}
                      style={styles.syncBtn}
                      disabled={syncing === conn.id}
                    >
                      {syncing === conn.id ? (
                        <ActivityIndicator size="small" color="#EAB308" />
                      ) : (
                        <Ionicons name="refresh" size={18} color="#EAB308" />
                      )}
                    </TouchableOpacity>
                  </View>

                  {usage && usage.monthly.length > 0 ? (
                    <>
                      <View style={styles.kpiRow}>
                        <View style={styles.kpi}>
                          <Text style={styles.kpiValue}>{usage.current_month_kwh.toLocaleString()}</Text>
                          <Text style={styles.kpiLabel}>kWh este mes</Text>
                        </View>
                        <View style={styles.kpi}>
                          <Text style={[styles.kpiValue, { color: '#94A3B8' }]}>
                            {usage.prev_month_kwh.toLocaleString()}
                          </Text>
                          <Text style={styles.kpiLabel}>mes anterior</Text>
                        </View>
                        {usage.delta_pct !== null && (
                          <View style={styles.kpi}>
                            <Text
                              style={[
                                styles.kpiValue,
                                { color: usage.delta_pct > 0 ? '#EF4444' : '#10B981' },
                              ]}
                            >
                              {usage.delta_pct > 0 ? '▲' : '▼'} {Math.abs(usage.delta_pct)}%
                            </Text>
                            <Text style={styles.kpiLabel}>variación</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.chart}>
                        {usage.monthly.map((m) => (
                          <View key={m.month} style={styles.barCol}>
                            <View
                              style={[
                                styles.bar,
                                { height: `${Math.max((m.kwh / maxKwh) * 100, 4)}%` },
                              ]}
                            />
                            <Text style={styles.barLabel}>{monthLabel(m.month)}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noData}>
                      Sin datos todavía — toca el botón de sincronizar para traerlos de Xcel
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const create_styles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    backgroundColor: '#1E293B',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.glassBorderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary },
  headerSub: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAB308',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 6, paddingHorizontal: 30 },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, color: '#94A3B8' },
  syncBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(234,179,8,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  kpi: {},
  kpiValue: { fontSize: 18, fontWeight: '700', color: '#EAB308' },
  kpiLabel: { fontSize: 10, color: '#64748B', marginTop: 2, textTransform: 'uppercase' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    marginTop: 16,
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: {
    width: '70%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#EAB308',
  },
  barLabel: { fontSize: 9, color: '#64748B', marginTop: 4 },
  noData: { fontSize: 12, color: '#64748B', marginTop: 12 },
});
