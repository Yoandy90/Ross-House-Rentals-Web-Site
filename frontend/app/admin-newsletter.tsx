import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal,
  RefreshControl, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiCall } from '../src/utils/api';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

const notify = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
  else Alert.alert(title, msg);
};

const confirmAction = (title: string, msg: string, onOk: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${msg}`)) onOk();
  } else {
    Alert.alert(title, msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onOk },
    ]);
  }
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: '#9CA3AF' },
  scheduled: { label: 'Programada', color: '#3B82F6' },
  recurring: { label: 'Recurrente', color: '#8B5CF6' },
  sending: { label: 'Enviando…', color: '#F59E0B' },
  sent: { label: 'Enviada', color: '#10B981' },
  cancelled: { label: 'Cancelada', color: '#6B7280' },
  failed: { label: 'Falló', color: '#EF4444' },
};

const AUDIENCES = [
  { key: 'both', label: '👥 Todos' },
  { key: 'newsletter', label: '📧 Suscriptores' },
  { key: 'leads', label: '🎯 Prospectos' },
];

const FREQS = [
  { key: 'weekly', label: 'Semanal' },
  { key: 'biweekly', label: 'Quincenal' },
  { key: 'monthly', label: 'Mensual' },
];

const fmtDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  return d.toLocaleString('es-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function AdminNewsletterScreen() {
  const C = useColors();
  const styles = useMemo(() => createStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subjectEs, setSubjectEs] = useState('');
  const [messageEs, setMessageEs] = useState('');
  const [subjectEn, setSubjectEn] = useState('');
  const [messageEn, setMessageEn] = useState('');
  const [audience, setAudience] = useState('both');
  const [sendMode, setSendMode] = useState<'now' | 'schedule' | 'recurring'>('now');
  const [schedDate, setSchedDate] = useState('');   // DD/MM/YYYY
  const [schedTime, setSchedTime] = useState('10:00');
  const [frequency, setFrequency] = useState('monthly');
  const [saving, setSaving] = useState(false);

  // AI
  const [aiTopics, setAiTopics] = useState<any[]>([]);
  const [aiLoadingTopics, setAiLoadingTopics] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [yearPlanLoading, setYearPlanLoading] = useState(false);

  // Detail
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'opened' | 'not_opened'>('opened');

  const load = useCallback(async () => {
    try {
      const d: any = await apiCall('/admin/newsletter/pro/campaigns?limit=100');
      setCampaigns(d.campaigns || []);
    } catch (e) { console.log('nl load err', e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetComposer = () => {
    setEditingId(null); setSubjectEs(''); setMessageEs(''); setSubjectEn(''); setMessageEn('');
    setAudience('both'); setSendMode('now'); setSchedDate(''); setSchedTime('10:00');
    setFrequency('monthly'); setAiTopics([]);
  };

  const openComposer = (camp?: any) => {
    resetComposer();
    if (camp) {
      setEditingId(camp._id);
      setSubjectEs(camp.subject || '');
      setMessageEs(camp.message || '');
      setSubjectEn(camp.subject_en || '');
      setMessageEn(camp.message_en || '');
      setAudience(camp.audience || 'both');
      if (camp.status === 'scheduled') setSendMode('schedule');
      if (camp.status === 'recurring') { setSendMode('recurring'); setFrequency(camp.frequency || 'monthly'); }
      const at = camp.send_at || camp.next_run_at;
      if (at) {
        const d = new Date(at.endsWith('Z') ? at : at + 'Z');
        setSchedDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
        setSchedTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      }
    }
    setComposerOpen(true);
  };

  const parseSchedule = (): string | null => {
    const m = schedDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const t = schedTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !t) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1], +t[1], +t[2]);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const saveCampaign = async (asDraft: boolean) => {
    if (!subjectEs.trim() || !messageEs.trim()) {
      notify('Faltan datos', 'El asunto y mensaje en español son requeridos');
      return;
    }
    let send_at: string | null = null;
    if (!asDraft && (sendMode === 'schedule' || (sendMode === 'recurring' && schedDate))) {
      send_at = parseSchedule();
      if (sendMode === 'schedule' && !send_at) {
        notify('Fecha inválida', 'Usa el formato DD/MM/AAAA y hora HH:MM');
        return;
      }
    }
    const payload: any = {
      subject: subjectEs.trim(), message: messageEs.trim(),
      subject_en: subjectEn.trim(), message_en: messageEn.trim(),
      audience,
      mode: asDraft ? 'draft' : sendMode,
      frequency: sendMode === 'recurring' ? frequency : undefined,
      send_at,
    };
    setSaving(true);
    try {
      let d: any;
      if (editingId) {
        d = await apiCall(`/admin/newsletter/pro/campaigns/${editingId}`, {
          method: 'PUT', body: JSON.stringify(payload),
        });
        if (!asDraft && sendMode === 'now') {
          d = await apiCall(`/admin/newsletter/pro/campaigns/${editingId}/send`, { method: 'POST' });
        }
      } else {
        d = await apiCall('/admin/newsletter/pro/campaigns', {
          method: 'POST', body: JSON.stringify(payload),
        });
      }
      notify('✅ Listo', d.message || 'Guardado');
      setComposerOpen(false);
      resetComposer();
      load();
    } catch (e: any) {
      notify('Error', e?.message || 'No se pudo guardar');
    }
    setSaving(false);
  };

  // ── AI ──
  const generateTopics = async () => {
    setAiLoadingTopics(true);
    try {
      const d: any = await apiCall('/admin/newsletter/ai/topics', {
        method: 'POST', body: JSON.stringify({ count: 6 }),
      });
      setAiTopics(d.topics || []);
    } catch (e: any) { notify('Error AI', e?.message || 'No se pudieron generar ideas'); }
    setAiLoadingTopics(false);
  };

  const generateContent = async (topic: string) => {
    setAiGenerating(true);
    try {
      const d: any = await apiCall('/admin/newsletter/ai/generate', {
        method: 'POST', body: JSON.stringify({ topic }),
      });
      setSubjectEs(d.subject_es || ''); setMessageEs(d.message_es || '');
      setSubjectEn(d.subject_en || ''); setMessageEn(d.message_en || '');
      setAiTopics([]);
    } catch (e: any) { notify('Error AI', e?.message || 'No se pudo generar el contenido'); }
    setAiGenerating(false);
  };

  const generateYearPlan = () => {
    confirmAction(
      '🗓️ Plan Anual AI',
      'La IA creará 12 campañas bilingües programadas (una por mes, el día 15). Podrás editarlas o eliminarlas antes de su envío. ¿Continuar?',
      async () => {
        setYearPlanLoading(true);
        try {
          const d: any = await apiCall('/admin/newsletter/ai/year-plan', {
            method: 'POST', body: JSON.stringify({ day_of_month: 15 }),
          });
          notify('✅ Plan Anual creado', d.message || `${d.created} campañas programadas`);
          load();
        } catch (e: any) { notify('Error', e?.message || 'No se pudo crear el plan'); }
        setYearPlanLoading(false);
      },
    );
  };

  // ── Actions ──
  const openDetail = async (camp: any) => {
    setDetailLoading(true);
    setDetailTab('opened');
    setDetail({ campaign: camp, tracking: camp.tracking, opened: [], not_opened: [] });
    try {
      const d: any = await apiCall(`/admin/newsletter/pro/campaigns/${camp._id}`);
      setDetail(d);
    } catch (e) { console.log('detail err', e); }
    setDetailLoading(false);
  };

  const deleteCampaign = (camp: any) => {
    const future = ['draft', 'scheduled', 'recurring'].includes(camp.status);
    confirmAction(
      future ? 'Cancelar campaña' : 'Eliminar del historial',
      `"${camp.subject}"${future ? ' no se enviará.' : ' y su tracking se eliminarán.'}`,
      async () => {
        try {
          await apiCall(`/admin/newsletter/pro/campaigns/${camp._id}`, { method: 'DELETE' });
          setDetail(null);
          load();
        } catch (e: any) { notify('Error', e?.message || 'No se pudo eliminar'); }
      },
    );
  };

  const sendNow = (camp: any) => {
    confirmAction('Enviar ahora', `Se enviará "${camp.subject}" a la audiencia seleccionada.`, async () => {
      try {
        const d: any = await apiCall(`/admin/newsletter/pro/campaigns/${camp._id}/send`, { method: 'POST' });
        notify('🚀', d.message || 'En envío');
        load();
      } catch (e: any) { notify('Error', e?.message || 'No se pudo enviar'); }
    });
  };

  const duplicate = async (camp: any) => {
    try {
      await apiCall(`/admin/newsletter/pro/campaigns/${camp._id}/duplicate`, { method: 'POST' });
      notify('✅', 'Duplicada como borrador');
      setDetail(null);
      load();
    } catch (e: any) { notify('Error', e?.message || 'No se pudo duplicar'); }
  };

  const upcoming = campaigns.filter(c => ['draft', 'scheduled', 'recurring', 'sending'].includes(c.status));
  const history = campaigns.filter(c => ['sent', 'failed', 'cancelled'].includes(c.status));

  const renderCard = (c: any) => {
    const meta = STATUS_META[c.status] || STATUS_META.draft;
    const editable = ['draft', 'scheduled', 'recurring'].includes(c.status);
    return (
      <TouchableOpacity key={c._id} style={styles.card} onPress={() => openDetail(c)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <View style={[styles.statusChip, { backgroundColor: `${meta.color}18`, borderColor: `${meta.color}45` }]}>
            <Text style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {!!(c.subject_en && c.message_en) && <Text style={styles.bilingualTag}>🌎 ES+EN</Text>}
        </View>
        <Text style={styles.cardSubject} numberOfLines={2}>{c.subject}</Text>
        <Text style={styles.cardMeta}>
          {c.status === 'scheduled' && `📅 Envío: ${fmtDate(c.send_at)}`}
          {c.status === 'recurring' && `🔁 ${FREQS.find(f => f.key === c.frequency)?.label || c.frequency} · próx: ${fmtDate(c.next_run_at)}`}
          {c.status === 'sent' && `✉️ ${c.sent || 0} enviados · 👁 ${c.tracking?.opened || 0} abiertos · 🖱 ${c.tracking?.clicked || 0} clicks`}
          {c.status === 'draft' && `Creado ${fmtDate(c.created_at)}`}
          {c.status === 'sending' && 'Enviando…'}
          {c.status === 'failed' && (c.error || 'Error en el envío')}
        </Text>
        <View style={styles.cardActions}>
          {editable && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => openComposer(c)}>
              <Ionicons name="create-outline" size={15} color={C.info} />
              <Text style={[styles.actionText, { color: C.info }]}>Editar</Text>
            </TouchableOpacity>
          )}
          {editable && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => sendNow(c)}>
              <Ionicons name="send-outline" size={15} color={C.success} />
              <Text style={[styles.actionText, { color: C.success }]}>Enviar</Text>
            </TouchableOpacity>
          )}
          {c.status === 'sent' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => duplicate(c)}>
              <Ionicons name="copy-outline" size={15} color={C.violet} />
              <Text style={[styles.actionText, { color: C.violet }]}>Duplicar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={() => deleteCampaign(c)}>
            <Ionicons name="trash-outline" size={15} color={C.error} />
            <Text style={[styles.actionText, { color: C.error }]}>{editable ? 'Cancelar' : 'Eliminar'}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Newsletter Pro</Text>
          <Text style={styles.headerSubtitle}>AI · Programación · Tracking</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => openComposer()}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Nueva Campaña</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={generateYearPlan} disabled={yearPlanLoading}>
          {yearPlanLoading
            ? <ActivityIndicator size="small" color={C.violet} />
            : <Ionicons name="calendar-outline" size={18} color={C.violet} />}
          <Text style={styles.secondaryBtnText}>{yearPlanLoading ? 'Generando…' : 'Plan Anual AI'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.brandRed} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brandRed} />}
        >
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>📌 Próximas y borradores ({upcoming.length})</Text>
              {upcoming.map(renderCard)}
            </>
          )}
          <Text style={styles.sectionTitle}>📜 Historial de envíos ({history.length})</Text>
          {history.length === 0
            ? <Text style={styles.emptyText}>Aún no hay campañas enviadas</Text>
            : history.map(renderCard)}
        </ScrollView>
      )}

      {/* ═════════ Composer Modal ═════════ */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? '✏️ Editar Campaña' : '✨ Nueva Campaña'}</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}>
                <Ionicons name="close" size={24} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
              {/* AI helper */}
              <TouchableOpacity style={styles.aiBtn} onPress={generateTopics} disabled={aiLoadingTopics || aiGenerating}>
                {aiLoadingTopics
                  ? <ActivityIndicator size="small" color={C.violet} />
                  : <Ionicons name="sparkles" size={16} color={C.violet} />}
                <Text style={styles.aiBtnText}>
                  {aiLoadingTopics ? 'Generando ideas…' : 'Generar ideas de temas con AI'}
                </Text>
              </TouchableOpacity>
              {aiTopics.length > 0 && (
                <View style={styles.topicsBox}>
                  <Text style={styles.topicsTitle}>Elige un tema (la AI escribirá el contenido ES+EN):</Text>
                  {aiTopics.map((t, i) => (
                    <TouchableOpacity key={i} style={styles.topicItem} onPress={() => generateContent(t.title)} disabled={aiGenerating}>
                      <Text style={styles.topicText}>• {t.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {aiGenerating && (
                <View style={styles.generatingBox}>
                  <ActivityIndicator size="small" color={C.violet} />
                  <Text style={styles.generatingText}>Escribiendo contenido bilingüe…</Text>
                </View>
              )}

              <Text style={styles.label}>🇪🇸 Asunto (Español) *</Text>
              <TextInput style={styles.input} value={subjectEs} onChangeText={setSubjectEs}
                placeholder="Asunto del email" placeholderTextColor={C.textMuted} />
              <Text style={styles.label}>🇪🇸 Mensaje (Español) *</Text>
              <TextInput style={[styles.input, styles.textArea]} value={messageEs} onChangeText={setMessageEs}
                placeholder="Contenido del newsletter…" placeholderTextColor={C.textMuted} multiline />

              <Text style={styles.label}>🇺🇸 Asunto (English)</Text>
              <TextInput style={styles.input} value={subjectEn} onChangeText={setSubjectEn}
                placeholder="Email subject (opcional — si lo llenas, cada persona recibe 2 emails)" placeholderTextColor={C.textMuted} />
              <Text style={styles.label}>🇺🇸 Mensaje (English)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={messageEn} onChangeText={setMessageEn}
                placeholder="Newsletter content…" placeholderTextColor={C.textMuted} multiline />

              <Text style={styles.label}>Audiencia</Text>
              <View style={styles.chipsRow}>
                {AUDIENCES.map(a => (
                  <TouchableOpacity key={a.key} style={[styles.chip, audience === a.key && styles.chipActive]}
                    onPress={() => setAudience(a.key)}>
                    <Text style={[styles.chipText, audience === a.key && styles.chipTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>¿Cuándo enviar?</Text>
              <View style={styles.chipsRow}>
                {([['now', '🚀 Ahora'], ['schedule', '📅 Programar'], ['recurring', '🔁 Recurrente']] as const).map(([k, l]) => (
                  <TouchableOpacity key={k} style={[styles.chip, sendMode === k && styles.chipActive]}
                    onPress={() => setSendMode(k)}>
                    <Text style={[styles.chipText, sendMode === k && styles.chipTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {sendMode === 'recurring' && (
                <View style={styles.chipsRow}>
                  {FREQS.map(f => (
                    <TouchableOpacity key={f.key} style={[styles.chip, frequency === f.key && styles.chipActive]}
                      onPress={() => setFrequency(f.key)}>
                      <Text style={[styles.chipText, frequency === f.key && styles.chipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {(sendMode === 'schedule' || sendMode === 'recurring') && (
                <View style={styles.dateRow}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={styles.labelSmall}>{sendMode === 'schedule' ? 'Fecha (DD/MM/AAAA)' : 'Primera corrida (opcional)'}</Text>
                    <TextInput style={styles.input} value={schedDate} onChangeText={setSchedDate}
                      placeholder="15/09/2026" placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.labelSmall}>Hora (HH:MM)</Text>
                    <TextInput style={styles.input} value={schedTime} onChangeText={setSchedTime}
                      placeholder="10:00" placeholderTextColor={C.textMuted} keyboardType="numbers-and-punctuation" />
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.draftBtn} onPress={() => saveCampaign(true)} disabled={saving}>
                  <Text style={styles.draftBtnText}>Guardar borrador</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sendBtn} onPress={() => saveCampaign(false)} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <Text style={styles.sendBtnText}>
                      {sendMode === 'now' ? '🚀 Enviar ahora' : sendMode === 'schedule' ? '📅 Programar' : '🔁 Activar recurrente'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═════════ Detail Modal ═════════ */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={styles.modalWrap}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>📊 {detail?.campaign?.subject}</Text>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={24} color={C.textMuted} />
              </TouchableOpacity>
            </View>
            {detailLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={C.brandRed} /></View>
            ) : (
              <ScrollView style={{ maxHeight: 560 }}>
                <View style={styles.statsGrid}>
                  {[
                    ['Destinatarios', detail?.campaign?.total_recipients ?? 0, C.textPrimary],
                    ['Entregados', detail?.tracking?.delivered ?? 0, C.info],
                    ['Abiertos', detail?.tracking?.opened ?? 0, C.success],
                    ['Clicks', detail?.tracking?.clicked ?? 0, C.violet],
                    ['Rebotes', detail?.tracking?.bounced ?? 0, C.error],
                  ].map(([label, val, color]: any) => (
                    <View key={label} style={styles.statBox}>
                      <Text style={[styles.statVal, { color }]}>{val}</Text>
                      <Text style={styles.statLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                {detail?.campaign?.status === 'sent' && (detail?.opened?.length || 0) + (detail?.not_opened?.length || 0) === 0 && (
                  <Text style={styles.noTrackNote}>
                    ℹ️ El detalle por persona está disponible para campañas enviadas con el nuevo sistema.
                  </Text>
                )}

                <View style={styles.detailTabs}>
                  <TouchableOpacity style={[styles.detailTab, detailTab === 'opened' && styles.detailTabActive]}
                    onPress={() => setDetailTab('opened')}>
                    <Text style={[styles.detailTabText, detailTab === 'opened' && { color: C.success }]}>
                      👁 Abrieron ({detail?.opened?.length || 0})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.detailTab, detailTab === 'not_opened' && styles.detailTabActive]}
                    onPress={() => setDetailTab('not_opened')}>
                    <Text style={[styles.detailTabText, detailTab === 'not_opened' && { color: C.warning }]}>
                      🙈 No abrieron ({detail?.not_opened?.length || 0})
                    </Text>
                  </TouchableOpacity>
                </View>

                {(detailTab === 'opened' ? detail?.opened : detail?.not_opened)?.map((r: any, i: number) => (
                  <View key={i} style={styles.recipientRow}>
                    <Ionicons
                      name={detailTab === 'opened' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={detailTab === 'opened' ? C.success : C.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recipientEmail} numberOfLines={1}>{r.email}</Text>
                      {detailTab === 'opened' && (
                        <Text style={styles.recipientMeta}>
                          Abrió: {fmtDate(r.first_open_at)}{(r.opens || 0) > 1 ? ` · ${r.opens} veces` : ''}{r.clicked ? ' · 🖱 hizo click' : ''}
                        </Text>
                      )}
                      {detailTab === 'not_opened' && r.bounced && (
                        <Text style={[styles.recipientMeta, { color: C.error }]}>⚠️ Rebotó</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.base, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.glassBorder },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '800', color: C.textPrimary },
  headerSubtitle: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.base, marginBottom: 10 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.brandRed, borderRadius: BorderRadius.lg, paddingVertical: 12, minHeight: 44 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.sm },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.violetBg, borderRadius: BorderRadius.lg, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)', minHeight: 44 },
  secondaryBtnText: { color: C.violet, fontWeight: '700', fontSize: FontSizes.sm },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '700', color: C.textSecondary, paddingHorizontal: Spacing.base, marginTop: 14, marginBottom: 8 },
  emptyText: { color: C.textMuted, fontSize: FontSizes.sm, textAlign: 'center', paddingVertical: 24 },
  card: { backgroundColor: C.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.glassBorder, padding: 14, marginHorizontal: Spacing.base, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  bilingualTag: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  cardSubject: { fontSize: FontSizes.base, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  cardMeta: { fontSize: FontSizes.xs, color: C.textMuted, lineHeight: 17 },
  cardActions: { flexDirection: 'row', gap: 14, marginTop: 10, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, minHeight: 28 },
  actionText: { fontSize: 12.5, fontWeight: '700' },
  // Modal
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.background === '#F8FAFC' ? '#FFFFFF' : '#141418', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.base, borderWidth: 1, borderColor: C.glassBorderLight },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
  modalTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: C.textPrimary, flex: 1 },
  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.violetBg, borderRadius: BorderRadius.lg, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', marginBottom: 10, minHeight: 44 },
  aiBtnText: { color: C.violet, fontWeight: '700', fontSize: FontSizes.sm },
  topicsBox: { backgroundColor: C.glass, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: C.glassBorder, padding: 12, marginBottom: 10 },
  topicsTitle: { fontSize: FontSizes.xs, color: C.textSecondary, fontWeight: '700', marginBottom: 8 },
  topicItem: { paddingVertical: 8, minHeight: 36 },
  topicText: { fontSize: FontSizes.sm, color: C.textPrimary, lineHeight: 19 },
  generatingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 10 },
  generatingText: { color: C.violet, fontSize: FontSizes.sm, fontWeight: '600' },
  label: { fontSize: FontSizes.sm, fontWeight: '700', color: C.textSecondary, marginBottom: 6, marginTop: 10 },
  labelSmall: { fontSize: FontSizes.xs, fontWeight: '600', color: C.textMuted, marginBottom: 4 },
  input: { backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorderLight, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, color: C.textPrimary, fontSize: FontSizes.sm, minHeight: 44 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorderLight, minHeight: 34, justifyContent: 'center' },
  chipActive: { backgroundColor: C.brandRedLight, borderColor: 'rgba(200,16,46,0.45)' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: C.textMuted },
  chipTextActive: { color: C.brandRed },
  dateRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  draftBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg, paddingVertical: 13, borderWidth: 1, borderColor: C.glassBorderLight, minHeight: 46 },
  draftBtnText: { color: C.textSecondary, fontWeight: '700', fontSize: FontSizes.sm },
  sendBtn: { flex: 1.4, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brandRed, borderRadius: BorderRadius.lg, paddingVertical: 13, minHeight: 46 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: FontSizes.sm },
  // Detail
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statBox: { flexGrow: 1, minWidth: '17%', backgroundColor: C.glass, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.glassBorder, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: C.textMuted, marginTop: 2 },
  noTrackNote: { fontSize: FontSizes.xs, color: C.textMuted, backgroundColor: C.glass, borderRadius: BorderRadius.md, padding: 10, marginBottom: 10, lineHeight: 17 },
  detailTabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  detailTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: BorderRadius.md, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder, minHeight: 38 },
  detailTabActive: { borderColor: C.glassBorderActive, backgroundColor: C.surfaceElevated },
  detailTabText: { fontSize: FontSizes.xs, fontWeight: '700', color: C.textMuted },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.glassBorder },
  recipientEmail: { fontSize: FontSizes.sm, color: C.textPrimary, fontWeight: '600' },
  recipientMeta: { fontSize: FontSizes.xs, color: C.textMuted, marginTop: 1 },
});
