import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, ScrollView, Alert, Platform, Linking,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { apiCall, getToken } from '../src/utils/api';
import { Config } from '../src/constants/config';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';
import { formatCurrency } from '../src/utils/formatters';

// ─── Types ─────────────────────────────────────────────
interface Lead {
  id: string;
  address: string;
  owner_name: string;
  county: string;
  city?: string;
  appraised_value: number;
  tax_due_total: number;
  signals: string[];
  status: string;
  ai_score?: number | null;
  offer_letter?: { letter_en?: string; letter_es?: string } | null;
  mail?: { status?: string; mode?: string; lob_id?: string } | null;
  offer?: {
    amount?: number;
    response?: {
      action: string; price?: number; phone?: string; message?: string;
      ai_analysis?: {
        recommendation: string; suggested_counter?: number | null;
        max_price?: number; deal_score?: number; reasoning?: string;
      } | null;
    } | null;
  } | null;
  contract?: { price: number } | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: 'Nuevo', color: '#3B82F6' },
  contacted: { label: 'Contactado', color: '#F59E0B' },
  interested: { label: 'Interesado', color: '#8B5CF6' },
  offer_sent: { label: 'Oferta enviada', color: '#06B6D4' },
  negotiating: { label: 'Negociando', color: '#F97316' },
  acquired: { label: 'Adquirida', color: '#10B981' },
  discarded: { label: 'Descartada', color: '#6B7280' },
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'new', label: 'Nuevos' },
  { value: 'offer_sent', label: 'Oferta enviada' },
  { value: 'negotiating', label: 'Negociando' },
  { value: 'acquired', label: 'Adquiridas' },
];

const SIGNAL_LABEL: Record<string, string> = {
  tax_delinquent: '💰 Impuestos atrasados',
  absentee_owner: '📮 Dueño ausente',
  out_of_state_owner: '🗺️ Dueño fuera de TX',
  vacant_land: '🌾 Terreno',
  low_value: '🏚️ Valor bajo',
};

const REC_META: Record<string, { label: string; color: string }> = {
  accept: { label: '✅ Aceptar', color: '#10B981' },
  counter: { label: '🔁 Contraofertar', color: '#F59E0B' },
  reject: { label: '❌ Pasar', color: '#EF4444' },
};

// ─── Anillo circular premium (SVG) ─────────────────────
function RingStat({ value, total, label, color, isPct }: {
  value: number; total: number; label: string; color: string; isPct?: boolean;
}) {
  const size = 68, stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={ringStyles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${c}`} strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={ringStyles.center}>
          <Text style={[ringStyles.value, { color }]}>
            {isPct ? `${Math.round(pct * 100)}%` : value.toLocaleString()}
          </Text>
        </View>
      </View>
      <Text style={ringStyles.label}>{label}</Text>
      {!isPct && total > 0 && <Text style={ringStyles.sub}>{Math.round(pct * 100)}%</Text>}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  center: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  value: { fontSize: 13, fontWeight: '800' },
  label: { fontSize: 9, color: '#8A94A6', fontWeight: '700', textTransform: 'uppercase', marginTop: 5 },
  sub: { fontSize: 9, color: '#8A94A6', marginTop: 1, fontWeight: '600' },
});

export default function AdminOpportunitiesScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null); // `${leadId}:letter|mail|analyze`

  const fetchData = useCallback(async (status: string, q: string) => {
    try {
      const params = new URLSearchParams({ limit: '50', sort: 'score' });
      if (status) params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const [leadsRes, statsRes, funnelRes] = await Promise.allSettled([
        apiCall(`/admin/deal-finder/leads?${params.toString()}`),
        apiCall('/admin/deal-finder/stats'),
        apiCall('/admin/deal-finder/campaign-stats'),
      ]);
      if (leadsRes.status === 'fulfilled') {
        const d: any = leadsRes.value;
        setLeads(d?.leads || d?.items || []);
      }
      if (statsRes.status === 'fulfilled') {
        setStats((statsRes.value as any)?.stats || null);
      }
      if (funnelRes.status === 'fulfilled') {
        setFunnel((funnelRes.value as any)?.funnel || null);
      }
    } catch (err) {
      console.log('Opportunities error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(statusFilter, search); }, [statusFilter]);
  const onRefresh = () => { setRefreshing(true); fetchData(statusFilter, search); };
  const onSearchSubmit = () => { setLoading(true); fetchData(statusFilter, search); };

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n${msg}`);
    } else Alert.alert(title, msg);
  };

  const patchLead = (id: string, patch: Partial<Lead>) =>
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const previewLetter = async (lead: Lead, lang: 'en' | 'es') => {
    const token = await getToken();
    const url = `${Config.API_URL}/api/admin/deal-finder/leads/${lead.id}/letter.pdf?lang=${lang}&token=${token}`;
    if (Platform.OS === 'web') window.open(url, '_blank');
    else Linking.openURL(url);
  };

  const trackMail = async (lead: Lead) => {
    setBusyAction(`${lead.id}:track`);
    try {
      const d: any = await apiCall(`/admin/deal-finder/leads/${lead.id}/mail-status`);
      const lines = (d.events?.length
        ? d.events.map((e: any) => `${e.label}\n   ${e.time ? new Date(e.time).toLocaleString('es-MX') : ''}${e.location ? ' · ' + e.location : ''}`)
        : [d.note || 'USPS aún no reporta eventos de rastreo']);
      notify('📬 Rastreo de carta',
        `Despachada: ${d.send_date || '—'}\nEntrega estimada: ${d.expected_delivery || '—'}\nCarrier: ${d.carrier}\n\n${lines.join('\n')}`);
    } catch (e: any) { notify('Error', e?.message || 'No se pudo rastrear'); }
    setBusyAction(null);
  };

  const generateLetter = async (lead: Lead) => {
    setBusyAction(`${lead.id}:letter`);
    try {
      const d: any = await apiCall(`/admin/deal-finder/leads/${lead.id}/letter`, { method: 'POST' });
      if (d?.success) {
        patchLead(lead.id, { offer_letter: d.offer_letter });
        notify('✅ Carta generada', 'La carta bilingüe está lista. Ahora puedes enviarla por correo físico.');
      } else notify('Error', d?.detail || 'No se pudo generar la carta');
    } catch (e: any) { notify('Error', e?.message || 'No se pudo generar la carta'); }
    setBusyAction(null);
  };

  const sendMail = (lead: Lead) => {
    const doSend = async () => {
      setBusyAction(`${lead.id}:mail`);
      try {
        const d: any = await apiCall(`/admin/deal-finder/leads/${lead.id}/mail`, { method: 'POST' });
        if (d?.success) {
          patchLead(lead.id, { mail: d.mail || { status: 'enviada' }, status: lead.status === 'new' ? 'offer_sent' : lead.status });
          notify('📮 Carta enviada', 'Lob verificó la dirección y despachó la carta física (doble cara EN/ES con foto y QR).');
        } else notify('Error', d?.detail || 'No se pudo enviar');
      } catch (e: any) { notify('Error', e?.message || 'No se pudo enviar la carta'); }
      setBusyAction(null);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Enviar carta física a ${lead.owner_name}?\nEsto genera un cargo en Lob (~$0.89).`)) doSend();
    } else {
      Alert.alert('Enviar carta física', `¿Enviar la carta a ${lead.owner_name} vía Lob?\nEsto genera un cargo (~$0.89).`,
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Enviar', style: 'default', onPress: doSend }]);
    }
  };

  const analyzeCounter = async (lead: Lead) => {
    setBusyAction(`${lead.id}:analyze`);
    try {
      const d: any = await apiCall(`/admin/deal-finder/leads/${lead.id}/analyze-counter`, { method: 'POST' });
      if (d?.success && lead.offer?.response) {
        patchLead(lead.id, { offer: { ...lead.offer, response: { ...lead.offer.response, ai_analysis: d.analysis } } });
      } else notify('Error', d?.detail || 'No se pudo analizar');
    } catch (e: any) { notify('Error', e?.message || 'No se pudo analizar'); }
    setBusyAction(null);
  };

  const renderLead = ({ item }: { item: Lead }) => {
    const meta = STATUS_META[item.status] || STATUS_META.new;
    const expanded = expandedId === item.id;
    const resp = item.offer?.response;
    const ai = resp?.ai_analysis;
    const rec = ai ? (REC_META[ai.recommendation] || null) : null;
    return (
      <TouchableOpacity
        style={styles.leadCard}
        activeOpacity={0.75}
        onPress={() => setExpandedId(expanded ? null : item.id)}
      >
        <View style={styles.leadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.leadAddress} numberOfLines={1}>{item.address}</Text>
            <Text style={styles.leadOwner} numberOfLines={1}>
              <Ionicons name="person-outline" size={11} color={Colors.textMuted} /> {item.owner_name || '—'}
            </Text>
          </View>
          {typeof item.ai_score === 'number' && (
            <View style={styles.scoreBadge}>
              <Ionicons name="sparkles" size={11} color="#8B5CF6" />
              <Text style={styles.scoreText}>{Math.round(item.ai_score)}</Text>
            </View>
          )}
        </View>

        <View style={styles.leadRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${meta.color}20`, borderColor: `${meta.color}50` }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {item.mail?.status ? (
            <View style={styles.mailBadge}>
              <Ionicons name="mail-outline" size={11} color="#06B6D4" />
              <Text style={styles.mailText}>{item.mail.status}</Text>
            </View>
          ) : null}
          {item.contract ? (
            <View style={[styles.mailBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
              <Ionicons name="document-text-outline" size={11} color="#F59E0B" />
              <Text style={[styles.mailText, { color: '#F59E0B' }]}>Contrato</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.leadStats}>
          <View style={styles.leadStat}>
            <Text style={styles.leadStatLabel}>Valor tasado</Text>
            <Text style={styles.leadStatValue}>{formatCurrency(item.appraised_value || 0)}</Text>
          </View>
          <View style={styles.leadStat}>
            <Text style={styles.leadStatLabel}>Impuestos deben</Text>
            <Text style={[styles.leadStatValue, { color: '#EF4444' }]}>{formatCurrency(item.tax_due_total || 0)}</Text>
          </View>
          {item.offer?.amount ? (
            <View style={styles.leadStat}>
              <Text style={styles.leadStatLabel}>Oferta</Text>
              <Text style={[styles.leadStatValue, { color: '#06B6D4' }]}>{formatCurrency(item.offer.amount)}</Text>
            </View>
          ) : null}
        </View>

        {resp && (
          <View style={styles.respBox}>
            <Text style={styles.respTitle}>
              {resp.action === 'accept' ? '✅ Aceptó la oferta' :
               resp.action === 'counter' ? `💬 Contraoferta: ${formatCurrency(resp.price || 0)}` :
               resp.action === 'call' ? '📞 Pide llamada' : '❌ No interesado'}
            </Text>
            {rec && ai && (
              <View style={[styles.aiBox, { borderColor: `${rec.color}50` }]}>
                <Text style={[styles.aiRec, { color: rec.color }]}>
                  🤖 IA: {rec.label}
                  {ai.suggested_counter ? `  →  ${formatCurrency(ai.suggested_counter)}` : ''}
                </Text>
                {expanded && !!ai.reasoning && <Text style={styles.aiReason}>{ai.reasoning}</Text>}
                {expanded && !!ai.max_price && (
                  <Text style={styles.aiMax}>Máximo walk-away: {formatCurrency(ai.max_price)}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {expanded && (
          <View style={styles.expandArea}>
            <View style={styles.signalsWrap}>
              {(item.signals || []).map(s => (
                <Text key={s} style={styles.signalChip}>{SIGNAL_LABEL[s] || s}</Text>
              ))}
            </View>
            {resp?.phone ? <Text style={styles.expandInfo}>📱 {resp.phone}</Text> : null}
            {resp?.message ? <Text style={styles.expandInfo}>💬 “{resp.message}”</Text> : null}

            {/* ── Flujo de carta ── */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: 'rgba(139,92,246,0.4)', backgroundColor: 'rgba(139,92,246,0.1)' }]}
                disabled={busyAction === `${item.id}:letter`}
                onPress={() => generateLetter(item)}
              >
                {busyAction === `${item.id}:letter`
                  ? <ActivityIndicator size="small" color="#8B5CF6" />
                  : <Ionicons name={item.offer_letter?.letter_en ? 'refresh-outline' : 'create-outline'} size={14} color="#8B5CF6" />}
                <Text style={[styles.actionText, { color: '#A78BFA' }]}>
                  {item.offer_letter?.letter_en ? 'Regenerar carta' : '1. Generar carta IA'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn,
                  { borderColor: 'rgba(6,182,212,0.4)', backgroundColor: 'rgba(6,182,212,0.1)' },
                  !item.offer_letter?.letter_en && styles.actionDisabled]}
                disabled={!item.offer_letter?.letter_en || busyAction === `${item.id}:mail`}
                onPress={() => sendMail(item)}
              >
                {busyAction === `${item.id}:mail`
                  ? <ActivityIndicator size="small" color="#06B6D4" />
                  : <Ionicons name="send-outline" size={14} color="#06B6D4" />}
                <Text style={[styles.actionText, { color: '#22D3EE' }]}>
                  {item.mail?.status ? 'Reenviar carta' : '2. Enviar por Lob'}
                </Text>
              </TouchableOpacity>
            </View>
            {item.offer_letter?.letter_en ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: 'rgba(245,203,92,0.4)', backgroundColor: 'rgba(245,203,92,0.08)' }]}
                  onPress={() => previewLetter(item, 'en')}
                >
                  <Ionicons name="document-text-outline" size={14} color="#F5CB5C" />
                  <Text style={[styles.actionText, { color: '#F5CB5C' }]}>Vista previa PDF (EN/ES)</Text>
                </TouchableOpacity>
                {item.mail?.lob_id ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: 'rgba(16,185,129,0.4)', backgroundColor: 'rgba(16,185,129,0.08)' }]}
                    onPress={() => trackMail(item)}
                    disabled={busyAction === `${item.id}:track`}
                  >
                    {busyAction === `${item.id}:track`
                      ? <ActivityIndicator size="small" color="#10B981" />
                      : <Ionicons name="navigate-outline" size={14} color="#10B981" />}
                    <Text style={[styles.actionText, { color: '#10B981' }]}>Rastrear envío</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {resp?.action === 'counter' && (resp.price || 0) > 0 && !ai && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionFull, { borderColor: 'rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.1)' }]}
                disabled={busyAction === `${item.id}:analyze`}
                onPress={() => analyzeCounter(item)}
              >
                {busyAction === `${item.id}:analyze`
                  ? <ActivityIndicator size="small" color="#818CF8" />
                  : <Ionicons name="sparkles-outline" size={14} color="#818CF8" />}
                <Text style={[styles.actionText, { color: '#A5B4FC' }]}>Analizar contraoferta con IA</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.expandHint}>Contratos y casas de título → panel web</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(16,185,129,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }}
        style={styles.bgGradient}
      />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Oportunidades</Text>
            <Text style={styles.headerSubtitle}>Radar off-market · Deal Finder</Text>
          </View>
          <View style={styles.countBadge}>
            <Ionicons name="locate" size={13} color="#10B981" />
            <Text style={styles.countText}>{stats?.total ?? '—'}</Text>
          </View>
        </View>

        {/* Stats strip */}
        {stats && (
          <View style={styles.statsStrip}>
            <View style={styles.statPill}>
              <Text style={styles.statPillValue}>{stats.tax_delinquent ?? 0}</Text>
              <Text style={styles.statPillLabel}>Imp. atrasados</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statPillValue, { color: '#8B5CF6' }]}>{stats.high_score ?? 0}</Text>
              <Text style={styles.statPillLabel}>Score ≥70</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statPillValue, { color: '#06B6D4' }]}>{stats.mail?.month_live ?? 0}</Text>
              <Text style={styles.statPillLabel}>Cartas mes</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statPillValue, { color: '#F59E0B' }]}>{formatCurrency(stats.mail?.month_cost ?? 0)}</Text>
              <Text style={styles.statPillLabel}>Gasto Lob</Text>
            </View>
          </View>
        )}

        {/* Embudo de campaña — anillos premium */}
        {funnel && (funnel.sent || 0) > 0 && (
          <View style={styles.funnelCard}>
            <View style={styles.funnelHeader}>
              <Ionicons name="mail-unread-outline" size={14} color="#06B6D4" />
              <Text style={styles.funnelTitle}>Campaña de cartas</Text>
              <Text style={styles.funnelRate}>Respuesta {funnel.response_rate ?? 0}%</Text>
            </View>
            <View style={styles.funnelRow}>
              <RingStat value={funnel.sent || 0} total={funnel.sent || 0} label="Enviadas" color="#06B6D4" />
              <RingStat value={funnel.delivered || 0} total={funnel.sent || 0} label="Entregadas" color="#3B82F6" />
              <RingStat value={funnel.scanned || 0} total={funnel.sent || 0} label="Escaneadas" color="#8B5CF6" />
              <RingStat value={funnel.responded || 0} total={funnel.sent || 0} label="Respondieron" color="#10B981" />
            </View>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSearchSubmit}
            placeholder="Buscar dirección o dueño…"
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setLoading(true); fetchData(statusFilter, ''); }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map(f => {
            const active = statusFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => { setLoading(true); setStatusFilter(f.value); }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#10B981" /></View>
        ) : (
          <FlatList
            data={leads}
            style={{ flex: 1 }}
            keyExtractor={l => l.id}
            renderItem={renderLead}
            contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="telescope-outline" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No hay oportunidades con este filtro</Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bgGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },
  countText: { fontSize: 12, fontWeight: '800', color: '#10B981' },

  statsStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.base, marginBottom: 10 },
  statPill: {
    flex: 1, backgroundColor: Colors.glass, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.glassBorder,
    paddingVertical: 8, alignItems: 'center',
  },
  statPillValue: { fontSize: FontSizes.md, fontWeight: '800', color: Colors.textPrimary },
  statPillLabel: { fontSize: 8.5, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.base, marginBottom: 8,
    paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: FontSizes.sm, color: Colors.textPrimary },

  chipsScroll: { flexGrow: 0, flexShrink: 0, minHeight: 34, marginBottom: 8 },
  chipsRow: { gap: 8, paddingHorizontal: Spacing.base, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorderLight,
    justifyContent: 'center', minHeight: 30,
  },
  chipActive: { backgroundColor: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.4)' },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, lineHeight: 16 },
  chipTextActive: { color: '#10B981', fontWeight: '700' },

  leadCard: {
    backgroundColor: Colors.glass, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: Colors.glassBorder,
    padding: 14, marginBottom: 10,
  },
  leadTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  leadAddress: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  leadOwner: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 2 },
  scoreBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  scoreText: { fontSize: 11, fontWeight: '800', color: '#8B5CF6' },

  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  mailBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  mailText: { fontSize: 10, fontWeight: '600', color: '#06B6D4', textTransform: 'capitalize' },

  leadStats: { flexDirection: 'row', gap: 14, marginTop: 10 },
  leadStat: {},
  leadStatLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  leadStatValue: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary, marginTop: 1 },

  respBox: {
    marginTop: 10, padding: 10, borderRadius: 12,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder,
  },
  respTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textPrimary },
  aiBox: { marginTop: 8, padding: 8, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  aiRec: { fontSize: 12, fontWeight: '800' },
  aiReason: { fontSize: 11, color: Colors.textSecondary, marginTop: 5, lineHeight: 16 },
  aiMax: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontWeight: '600' },

  expandArea: { marginTop: 10, gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderRadius: 12, paddingVertical: 10, minHeight: 44,
  },
  actionFull: { flex: undefined, alignSelf: 'stretch' },
  actionDisabled: { opacity: 0.35 },
  actionText: { fontSize: 11.5, fontWeight: '700' },

  funnelCard: {
    marginHorizontal: Spacing.base, marginBottom: 10, padding: 12,
    borderRadius: BorderRadius.card, backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)',
  },
  funnelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  funnelTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: Colors.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  funnelRate: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  funnelRow: { flexDirection: 'row' },
  signalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  signalChip: {
    fontSize: 10, color: Colors.textSecondary,
    backgroundColor: Colors.glassLight, borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden',
  },
  expandInfo: { fontSize: FontSizes.xs, color: Colors.textSecondary },
  expandHint: { fontSize: 10, color: Colors.textMuted, fontStyle: 'italic', marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: FontSizes.sm, color: Colors.textMuted },
});
