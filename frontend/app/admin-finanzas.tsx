import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall, getToken } from '../src/utils/api';
import { Config } from '../src/constants/config';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

const fmt = (n: number) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PROC_COLORS: Record<string, string> = {
  stripe: '#8B5CF6',
  square: '#10B981',
  clover: '#F97316',
};

export default function AdminFinanzasScreen({ embedded }: { embedded?: boolean }) {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [fees, setFees] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiCall('/admin/payment-processors/fee-comparison');
      setFees(d);
    } catch (e) {
      console.log('fees error', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const token = await getToken();
      const url = `${Config.API_URL}/api/admin/property-expenses/tax-report?year=${reportYear}`;
      if (Platform.OS === 'web') {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('No se pudo generar el reporte');
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `Reporte_Fiscal_${reportYear}_ScheduleE.pdf`;
        a.click();
        URL.revokeObjectURL(objUrl);
      } else {
        const FileSystem = await import('expo-file-system/legacy');
        const Sharing = await import('expo-sharing');
        const dest = `${FileSystem.cacheDirectory}Reporte_Fiscal_${reportYear}_ScheduleE.pdf`;
        const r = await FileSystem.downloadAsync(url, dest, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.status !== 200) throw new Error('No se pudo generar el reporte');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(r.uri, { mimeType: 'application/pdf', dialogTitle: `Reporte Fiscal ${reportYear}` });
        } else {
          Alert.alert('Listo', `PDF guardado en: ${r.uri}`);
        }
      }
    } catch (e: any) {
      const msg = e?.message || 'Error descargando el reporte';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Error', msg);
    }
    setDownloading(false);
  };

  const years = [0, 1, 2, 3].map(i => new Date().getFullYear() - i);
  const maxFee = fees?.comparison?.length
    ? Math.max(...fees.comparison.map((c: any) => c.fee_annual)) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        {!embedded && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Finanzas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + (embedded ? 120 : 40) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={Colors.brandRed} />}
      >
        {/* ── Reporte Fiscal ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <Ionicons name="document-text" size={20} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Reporte Fiscal (IRS Schedule E)</Text>
              <Text style={styles.cardSub}>Gastos deducibles por propiedad, listo para tu contador</Text>
            </View>
          </View>
          <View style={styles.yearRow}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, reportYear === y && styles.yearChipActive]}
                onPress={() => setReportYear(y)}
              >
                <Text style={[styles.yearText, reportYear === y && styles.yearTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.downloadBtn} onPress={downloadReport} disabled={downloading}>
            {downloading
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Ionicons name="download" size={18} color={Colors.white} />}
            <Text style={styles.downloadText}>
              {downloading ? 'Generando PDF...' : `Descargar Reporte ${reportYear}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Comparador de Comisiones ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(34,211,238,0.12)' }]}>
              <Ionicons name="bar-chart" size={20} color="#22D3EE" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Comparador de Comisiones</Text>
              <Text style={styles.cardSub}>
                {fees ? `Con tu volumen real de los últimos ${fees.months_with_data} ${fees.months_with_data === 1 ? 'mes' : 'meses'}` : 'Estimado con tu volumen real'}
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.brandRed} style={{ paddingVertical: 20 }} />
          ) : !fees || !fees.tx_count_12m ? (
            <Text style={styles.emptyText}>Aún no hay pagos cobrados para comparar.</Text>
          ) : (
            <>
              {/* Stats */}
              <View style={styles.statsGrid}>
                {[
                  { label: 'Volumen cobrado', value: fmt(fees.volume_12m), color: Colors.success },
                  { label: 'Transacciones', value: String(fees.tx_count_12m), color: '#3B82F6' },
                  { label: 'Prom. mensual', value: fmt(fees.monthly_avg_volume), color: '#22D3EE' },
                  { label: 'Ticket promedio', value: fmt(fees.avg_ticket), color: '#8B5CF6' },
                ].map((s, i) => (
                  <View key={i} style={styles.statBox}>
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  </View>
                ))}
              </View>

              {/* Processors */}
              {fees.comparison.map((c: any) => {
                const isCheapest = c.processor === fees.cheapest;
                const pct = maxFee > 0 ? (c.fee_annual / maxFee) * 100 : 0;
                return (
                  <View key={c.processor} style={[styles.procRow, isCheapest && styles.procRowCheapest]}>
                    <View style={styles.procTop}>
                      <Text style={styles.procName}>{c.label}</Text>
                      <Text style={styles.procRate}>{c.rate_label}</Text>
                      {isCheapest && <View style={styles.badgeGreen}><Text style={styles.badgeGreenText}>MÁS BARATO</Text></View>}
                      {c.is_active && <View style={styles.badgeBlue}><Text style={styles.badgeBlueText}>ACTIVO</Text></View>}
                    </View>
                    <View style={styles.procBottom}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, {
                          width: `${pct}%`,
                          backgroundColor: isCheapest ? Colors.success : PROC_COLORS[c.processor] || '#64748B',
                        }]} />
                      </View>
                      <Text style={[styles.procFee, isCheapest && { color: Colors.success }]}>{fmt(c.fee_annual)}</Text>
                    </View>
                    <Text style={styles.procDetail}>{c.effective_pct}% efectivo · ~{fmt(c.fee_monthly_avg)}/mes</Text>
                  </View>
                );
              })}

              {/* Recomendación */}
              <View style={[styles.recoBox, fees.savings_annual_vs_active > 0 ? styles.recoSave : styles.recoOk]}>
                <Ionicons
                  name={fees.savings_annual_vs_active > 0 ? 'trending-down' : 'checkmark-circle'}
                  size={16}
                  color={fees.savings_annual_vs_active > 0 ? Colors.success : '#3B82F6'}
                />
                <Text style={styles.recoText}>
                  {fees.savings_annual_vs_active > 0
                    ? `Con ${fees.cheapest} ahorrarías ${fmt(fees.savings_annual_vs_active)} al año con este volumen.`
                    : 'Tu procesador activo ya está entre los más baratos para tu volumen. 👍'}
                </Text>
              </View>
              <Text style={styles.noteText}>{fees.note}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.glassBorder,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.textPrimary },

  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.textPrimary },
  cardSub: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted, paddingVertical: 10, textAlign: 'center' },

  yearRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  yearChip: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, alignItems: 'center',
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  yearChipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.45)' },
  yearText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textMuted },
  yearTextActive: { color: Colors.success },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.success, paddingVertical: 14, borderRadius: BorderRadius.md,
  },
  downloadText: { fontSize: FontSizes.sm, fontWeight: '800', color: Colors.textPrimary },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  statBox: {
    flexBasis: '48%', flexGrow: 1, padding: 12, borderRadius: BorderRadius.md,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: FontSizes.lg, fontWeight: '800', marginTop: 4 },

  procRow: {
    padding: 12, borderRadius: BorderRadius.md, marginBottom: 8,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  procRowCheapest: { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.05)' },
  procTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  procName: { fontSize: FontSizes.sm, fontWeight: '800', color: Colors.textPrimary },
  procRate: { fontSize: 11, color: Colors.textMuted },
  badgeGreen: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)' },
  badgeGreenText: { fontSize: 9, fontWeight: '800', color: Colors.success, letterSpacing: 0.5 },
  badgeBlue: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)' },
  badgeBlueText: { fontSize: 9, fontWeight: '800', color: '#3B82F6', letterSpacing: 0.5 },
  procBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.glassBorder, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  procFee: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.textPrimary, minWidth: 70, textAlign: 'right' },
  procDetail: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },

  recoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: BorderRadius.md, marginTop: 4, borderWidth: 1 },
  recoSave: { backgroundColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.3)' },
  recoOk: { backgroundColor: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.25)' },
  recoText: { flex: 1, fontSize: FontSizes.xs, color: Colors.textPrimary, fontWeight: '600' },
  noteText: { fontSize: 10, color: Colors.textMuted, marginTop: 8 },
});
