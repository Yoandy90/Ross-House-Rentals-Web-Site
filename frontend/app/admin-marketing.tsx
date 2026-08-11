import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, Platform, Linking, Image, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { apiCall, getToken } from '../src/utils/api';
import { Config } from '../src/constants/config';
import { useColors, Spacing, FontSizes, BorderRadius } from '../src/constants/theme';

const notify = (title: string, msg: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
  else Alert.alert(title, msg);
};

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: '🌎 Público',
  MUTUAL_FOLLOW_FRIENDS: '👥 Amigos',
  FOLLOWER_OF_CREATOR: '👤 Seguidores',
  SELF_ONLY: '🔒 Solo yo',
};

const TT_STATUS: Record<string, { label: string; color: string }> = {
  PUBLISH_COMPLETE: { label: 'Publicado', color: '#10B981' },
  FAILED: { label: 'Falló', color: '#EF4444' },
  PROCESSING_DOWNLOAD: { label: 'Procesando', color: '#F59E0B' },
  PROCESSING_UPLOAD: { label: 'Procesando', color: '#F59E0B' },
  SEND_TO_USER_INBOX: { label: 'En bandeja', color: '#3B82F6' },
};

const INTENTS = [
  { key: 'rental_listing', label: '🏠 Casa disponible' },
  { key: 'available_soon', label: '⏳ Próximamente' },
  { key: 'general_promo', label: '📣 Promo general' },
  { key: 'contractor_recruit', label: '🔧 Buscar contratistas' },
];

type Tab = 'tiktok' | 'social' | 'newsletter';

export default function AdminMarketingScreen() {
  const Colors = useColors();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tiktok');
  const [refreshing, setRefreshing] = useState(false);

  // ── TikTok state ──
  const [ttStatus, setTtStatus] = useState<any>(null);
  const [ttCreator, setTtCreator] = useState<any>(null);
  const [ttPosts, setTtPosts] = useState<any[]>([]);
  const [ttLoading, setTtLoading] = useState(true);
  const [video, setVideo] = useState<{ uri: string; name: string; size?: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('SELF_ONLY');
  const [draftMode, setDraftMode] = useState(false);
  const [consent, setConsent] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // ── Social state ──
  const [groups, setGroups] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [intent, setIntent] = useState('rental_listing');
  const [socialProps, setSocialProps] = useState<any[]>([]);
  const [propId, setPropId] = useState<string | null>(null);
  const [variations, setVariations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  // ── Newsletter state ──
  const [nlStats, setNlStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadTikTok = useCallback(async () => {
    try {
      const st: any = await apiCall('/admin/marketing/tiktok/status');
      setTtStatus(st);
      if (st?.connected) {
        const [ci, ps] = await Promise.all([
          apiCall('/admin/marketing/tiktok/creator-info').catch(() => null),
          apiCall('/admin/marketing/tiktok/posts').catch(() => ({ posts: [] })),
        ]);
        setTtCreator(ci);
        setTtPosts(ps?.posts || []);
        if (ci?.privacy_level_options?.length) setPrivacy(ci.privacy_level_options.includes('SELF_ONLY') ? 'SELF_ONLY' : ci.privacy_level_options[0]);
      }
    } catch (e) { console.log('tiktok load err', e); }
    setTtLoading(false);
  }, []);

  const loadSocial = useCallback(async () => {
    try {
      const [gs, ms, ap] = await Promise.all([
        apiCall('/admin/marketing/social/groups').catch(() => ({ groups: [] })),
        apiCall('/admin/marketing/social/metrics?days=30').catch(() => null),
        apiCall('/admin/marketing/social/available-properties').catch(() => ({ properties: [] })),
      ]);
      setGroups(gs?.groups || []);
      setMetrics(ms);
      setSocialProps(ap?.properties || []);
    } catch (e) { console.log('social load err', e); }
  }, []);

  const loadNewsletter = useCallback(async () => {
    try {
      const [subs, camps] = await Promise.all([
        apiCall('/admin/newsletter/subscribers?limit=1').catch(() => null),
        apiCall('/admin/newsletter/campaigns?limit=10').catch(() => ({ campaigns: [] })),
      ]);
      setNlStats(subs?.stats || null);
      setCampaigns(camps?.campaigns || []);
    } catch (e) { console.log('newsletter load err', e); }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadTikTok(), loadSocial(), loadNewsletter()]);
    setRefreshing(false);
  }, [loadTikTok, loadSocial, loadNewsletter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── TikTok actions ──
  const connectTikTok = async () => {
    try {
      const d: any = await apiCall('/admin/marketing/tiktok/connect', { method: 'POST' });
      if (d?.authorize_url) {
        await Linking.openURL(d.authorize_url);
        notify('Autoriza en TikTok', 'Cuando termines, regresa y desliza hacia abajo para actualizar');
      }
    } catch (e: any) { notify('Error', e?.message || 'No se pudo iniciar conexión'); }
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain) {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) return;
      } else {
        Alert.alert('Permiso requerido', 'Habilita el acceso a tus videos para publicar en TikTok', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configuración', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setVideo({ uri: a.uri, name: a.fileName || 'video.mp4', size: a.fileSize });
    }
  };

  const publishTikTok = async () => {
    if (!consent) { notify('Falta consentimiento', 'Confirma que revisaste el video antes de publicar'); return; }
    if (!video) { notify('Falta el video', 'Selecciona un video de tu galería'); return; }
    if (!draftMode && !caption.trim()) { notify('Falta caption', 'Escribe el título/caption del video'); return; }
    setPublishing(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(video.uri)).blob();
        fd.append('file', new File([blob], video.name, { type: 'video/mp4' }));
      } else {
        fd.append('file', { uri: video.uri, name: video.name, type: 'video/mp4' } as any);
      }
      fd.append('title', caption.trim());
      fd.append('privacy_level', privacy);
      fd.append('mode', draftMode ? 'draft' : 'direct');
      const r = await fetch(`${Config.API_URL}/api/admin/marketing/tiktok/publish-file`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const d = await r.json();
      if (r.ok && d.success) {
        notify('🚀 Enviado a TikTok', draftMode ? 'El video llegó a tu bandeja de TikTok como borrador' : 'Publicando — revisa el historial');
        setVideo(null); setCaption(''); setConsent(false);
        loadTikTok();
      } else notify('Error', d?.detail || 'No se pudo publicar');
    } catch (e: any) { notify('Error', e?.message || 'No se pudo publicar'); }
    setPublishing(false);
  };

  const checkTtStatus = async (publishId: string) => {
    setCheckingId(publishId);
    try {
      const d: any = await apiCall(`/admin/marketing/tiktok/posts/${encodeURIComponent(publishId)}/status`);
      setTtPosts(prev => prev.map(p => p.publish_id === publishId ? { ...p, status: d.status || p.status } : p));
    } catch (e) { console.log(e); }
    setCheckingId(null);
  };

  // ── Social actions ──
  const generatePosts = async () => {
    setGenerating(true);
    setVariations([]);
    try {
      const d: any = await apiCall('/admin/marketing/social/generate', {
        method: 'POST',
        body: { intent, property_id: propId, tone: 'friendly', include_hashtags: true, include_cta: true },
      });
      setVariations(d?.variations || []);
    } catch (e: any) { notify('Error', e?.message || 'No se pudo generar'); }
    setGenerating(false);
  };

  const copyVariation = async (v: any, idx: number) => {
    await Clipboard.setStringAsync(v.composed_text || `${v.headline}\n\n${v.body}\n\n${v.cta}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const markPosted = async (g: any) => {
    setBusyGroup(g.id);
    try {
      await apiCall(`/admin/marketing/social/groups/${g.id}/mark-posted`, { method: 'POST' });
      loadSocial();
    } catch (e) { console.log(e); }
    setBusyGroup(null);
  };

  // ═════════════ RENDER ═════════════
  const acct = ttStatus?.account;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Marketing</Text>
          <Text style={styles.headerSubtitle}>TikTok · Facebook · Newsletter</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {([
          { k: 'tiktok', label: 'TikTok', icon: 'musical-notes' },
          { k: 'social', label: 'Facebook', icon: 'share-social' },
          { k: 'newsletter', label: 'Newsletter', icon: 'mail' },
        ] as const).map(t => (
          <TouchableOpacity key={t.k} onPress={() => setTab(t.k)}
            style={[styles.tabBtn, tab === t.k && styles.tabBtnActive]}>
            <Ionicons name={t.icon as any} size={15} color={tab === t.k ? '#22D3EE' : Colors.textMuted} />
            <Text style={[styles.tabText, tab === t.k && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#22D3EE" />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ════════ TIKTOK TAB ════════ */}
        {tab === 'tiktok' && (
          ttLoading ? <ActivityIndicator size="large" color="#22D3EE" style={{ marginTop: 40 }} /> : (
          <View style={{ gap: 12 }}>
            {/* Connection card */}
            {ttStatus?.connected && acct ? (
              <View style={styles.card}>
                <View style={styles.rowCenter}>
                  {acct.avatar_url || ttCreator?.creator_avatar_url ? (
                    <Image source={{ uri: acct.avatar_url || ttCreator?.creator_avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="musical-notes" size={18} color="#22D3EE" /></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>@{ttCreator?.creator_username || acct.username || 'rosshouserentals'}</Text>
                    <Text style={styles.mutedXs}>✅ Cuenta conectada</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Conecta la cuenta TikTok</Text>
                <Text style={[styles.mutedXs, { marginTop: 4, marginBottom: 10 }]}>Autoriza la cuenta de la empresa para publicar videos</Text>
                <TouchableOpacity onPress={connectTikTok} style={styles.primaryBtn}>
                  <Ionicons name="link" size={16} color="#0A0F1E" />
                  <Text style={styles.primaryBtnText}>Conectar con TikTok</Text>
                </TouchableOpacity>
              </View>
            )}

            {ttStatus?.connected && (
              <>
                {/* Publish card */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>🎬 Publicar video</Text>

                  <TouchableOpacity onPress={pickVideo} style={styles.pickBox}>
                    <Ionicons name={video ? 'videocam' : 'cloud-upload-outline'} size={22} color="#22D3EE" />
                    <Text style={styles.pickText}>
                      {video ? `${video.name}${video.size ? ` (${(video.size / (1024 * 1024)).toFixed(1)} MB)` : ''}` : 'Elegir video de la galería'}
                    </Text>
                  </TouchableOpacity>

                  {!draftMode && (
                    <>
                      <Text style={styles.formLabel}>Caption / hashtags</Text>
                      <TextInput
                        style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                        value={caption} onChangeText={setCaption} multiline
                        placeholder="🏠 Casa disponible en Dumas TX… #DumasTX #CasasEnRenta"
                        placeholderTextColor={Colors.textMuted}
                      />
                      <Text style={styles.formLabel}>Privacidad</Text>
                      <View style={styles.chipsWrap}>
                        {(ttCreator?.privacy_level_options || ['SELF_ONLY']).map((opt: string) => (
                          <TouchableOpacity key={opt} onPress={() => setPrivacy(opt)}
                            style={[styles.chip, privacy === opt && styles.chipActive]}>
                            <Text style={[styles.chipText, privacy === opt && styles.chipTextActive]}>{PRIVACY_LABELS[opt] || opt}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <View style={[styles.rowCenter, { marginTop: 10 }]}>
                    <Switch value={draftMode} onValueChange={setDraftMode}
                      trackColor={{ true: 'rgba(34,211,238,0.4)' }} thumbColor={draftMode ? '#22D3EE' : '#94A3B8'} />
                    <Text style={[styles.mutedXs, { flex: 1, marginLeft: 8 }]}>
                      {draftMode ? '📥 Borrador: llega a tu bandeja de TikTok para editar y publicar desde la app' : '🚀 Publicación directa en el perfil'}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={() => setConsent(!consent)} style={[styles.rowCenter, { marginTop: 10 }]}>
                    <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={20} color={consent ? '#10B981' : Colors.textMuted} />
                    <Text style={[styles.mutedXs, { flex: 1, marginLeft: 8 }]}>Revisé el video y autorizo publicarlo en la cuenta conectada</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={publishTikTok} disabled={publishing || !consent}
                    style={[styles.primaryBtn, { marginTop: 12 }, (publishing || !consent) && { opacity: 0.5 }]}>
                    {publishing ? <ActivityIndicator size="small" color="#0A0F1E" /> : <Ionicons name="send" size={16} color="#0A0F1E" />}
                    <Text style={styles.primaryBtnText}>{publishing ? 'Subiendo…' : draftMode ? 'Enviar borrador' : 'Publicar en TikTok'}</Text>
                  </TouchableOpacity>
                </View>

                {/* History */}
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Historial ({ttPosts.length})</Text>
                  {ttPosts.length === 0 ? (
                    <Text style={[styles.mutedXs, { textAlign: 'center', paddingVertical: 14 }]}>Sin publicaciones aún</Text>
                  ) : ttPosts.map(p => {
                    const m = TT_STATUS[p.status] || { label: p.status || '—', color: Colors.textMuted };
                    return (
                      <View key={p.publish_id} style={styles.postRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.postTitle} numberOfLines={1}>{p.title || '(borrador)'}</Text>
                          <Text style={styles.mutedXs}>
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('es-MX') : ''} · {p.mode === 'draft' ? '📥 Borrador' : (PRIVACY_LABELS[p.privacy_level] || '')}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: `${m.color}22`, borderColor: `${m.color}55` }]}>
                          <Text style={[styles.badgeText, { color: m.color }]}>{m.label}</Text>
                        </View>
                        <TouchableOpacity onPress={() => checkTtStatus(p.publish_id)} style={styles.iconBtn}>
                          {checkingId === p.publish_id ? <ActivityIndicator size="small" color={Colors.textMuted} /> : <Ionicons name="refresh" size={14} color={Colors.textMuted} />}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
          )
        )}

        {/* ════════ SOCIAL (FB) TAB ════════ */}
        {tab === 'social' && (
          <View style={{ gap: 12 }}>
            {/* Metrics */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{metrics?.total_posts ?? '—'}</Text>
                <Text style={styles.statLabel}>Posts 30d</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#10B981' }]}>{metrics?.total_leads_from_social ?? '—'}</Text>
                <Text style={styles.statLabel}>Leads social</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#22D3EE' }]}>{groups.length}</Text>
                <Text style={styles.statLabel}>Grupos FB</Text>
              </View>
            </View>

            {/* AI Generator */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>✨ Generar post con AI</Text>
              <View style={styles.chipsWrap}>
                {INTENTS.map(i => (
                  <TouchableOpacity key={i.key} onPress={() => setIntent(i.key)}
                    style={[styles.chip, intent === i.key && styles.chipActive]}>
                    <Text style={[styles.chipText, intent === i.key && styles.chipTextActive]}>{i.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {socialProps.length > 0 && (
                <>
                  <Text style={styles.formLabel}>Propiedad (opcional)</Text>
                  <View style={styles.chipsWrap}>
                    <TouchableOpacity onPress={() => setPropId(null)} style={[styles.chip, !propId && styles.chipActive]}>
                      <Text style={[styles.chipText, !propId && styles.chipTextActive]}>Ninguna</Text>
                    </TouchableOpacity>
                    {socialProps.map(p => (
                      <TouchableOpacity key={p.id} onPress={() => setPropId(p.id)} style={[styles.chip, propId === p.id && styles.chipActive]}>
                        <Text style={[styles.chipText, propId === p.id && styles.chipTextActive]}>{p.address}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <TouchableOpacity onPress={generatePosts} disabled={generating}
                style={[styles.primaryBtn, { marginTop: 10 }, generating && { opacity: 0.6 }]}>
                {generating ? <ActivityIndicator size="small" color="#0A0F1E" /> : <Ionicons name="sparkles" size={16} color="#0A0F1E" />}
                <Text style={styles.primaryBtnText}>{generating ? 'Generando…' : 'Generar 5 variaciones'}</Text>
              </TouchableOpacity>

              {variations.map((v, idx) => (
                <View key={idx} style={styles.variationBox}>
                  <Text style={styles.postTitle}>{v.headline}</Text>
                  <Text style={[styles.mutedXs, { marginVertical: 4 }]} numberOfLines={4}>{v.body}</Text>
                  <TouchableOpacity onPress={() => copyVariation(v, idx)} style={styles.copyBtn}>
                    <Ionicons name={copiedIdx === idx ? 'checkmark' : 'copy-outline'} size={13} color={copiedIdx === idx ? '#10B981' : '#22D3EE'} />
                    <Text style={[styles.copyText, copiedIdx === idx && { color: '#10B981' }]}>{copiedIdx === idx ? 'Copiado' : 'Copiar texto'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Groups */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Grupos de Facebook</Text>
              {groups.length === 0 ? (
                <Text style={[styles.mutedXs, { textAlign: 'center', paddingVertical: 14 }]}>Agrega grupos desde el panel web</Text>
              ) : groups.map(g => (
                <View key={g.id} style={styles.postRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postTitle} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.mutedXs}>
                      {g.days_since_last_post === null ? 'Nunca publicado' : g.days_since_last_post === 0 ? 'Publicado hoy' : `Hace ${g.days_since_last_post} días`}
                      {g.member_count ? ` · ${(g.member_count / 1000).toFixed(1)}k miembros` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => Linking.openURL(g.url)} style={styles.iconBtn}>
                    <Ionicons name="open-outline" size={15} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => markPosted(g)} style={styles.iconBtn} disabled={busyGroup === g.id}>
                    {busyGroup === g.id ? <ActivityIndicator size="small" color={Colors.textMuted} /> : <Ionicons name="checkmark-done-outline" size={15} color="#10B981" />}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ════════ NEWSLETTER TAB ════════ */}
        {tab === 'newsletter' && (
          <View style={{ gap: 12 }}>
            {/* Newsletter Pro CTA */}
            <TouchableOpacity
              style={styles.proBanner}
              onPress={() => router.push('/admin-newsletter')}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.proBannerTitle}>✨ Newsletter Pro</Text>
                <Text style={styles.proBannerSub}>
                  Campañas con AI · Plan anual · Programación · Quién abrió cada email
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{nlStats?.total ?? '—'}</Text>
                <Text style={styles.statLabel}>Suscriptores</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#10B981' }]}>{nlStats?.active ?? '—'}</Text>
                <Text style={styles.statLabel}>Activos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: '#F59E0B' }]}>{nlStats?.leads ?? '—'}</Text>
                <Text style={styles.statLabel}>Leads</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Campañas recientes</Text>
              {campaigns.length === 0 ? (
                <Text style={[styles.mutedXs, { textAlign: 'center', paddingVertical: 14 }]}>Sin campañas — se crean desde el panel web</Text>
              ) : campaigns.map((c: any) => (
                <View key={c.id || c._id} style={styles.postRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postTitle} numberOfLines={1}>{c.subject || c.title || 'Campaña'}</Text>
                    <Text style={styles.mutedXs}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('es-MX') : ''}
                      {c.sent_count != null ? ` · ${c.sent_count} enviados` : ''}
                      {c.open_count != null ? ` · ${c.open_count} abiertos` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.glassLight,
    borderWidth: 1, borderColor: Colors.glassBorderLight, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: FontSizes['2xl'], fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: FontSizes.xs, color: Colors.textMuted, marginTop: 1 },

  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.base, marginBottom: 10 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.glass,
    borderWidth: 1, borderColor: Colors.glassBorderLight, minHeight: 42,
  },
  tabBtnActive: { backgroundColor: 'rgba(34,211,238,0.12)', borderColor: 'rgba(34,211,238,0.4)' },
  tabText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  tabTextActive: { color: '#22D3EE' },

  card: {
    backgroundColor: Colors.glass, borderRadius: BorderRadius.card,
    borderWidth: 1, borderColor: Colors.glassBorder, padding: 14,
  },
  cardTitle: { fontSize: FontSizes.md, fontWeight: '700', color: Colors.textPrimary },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mutedXs: { fontSize: 11, color: Colors.textMuted },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: Colors.glassBorderActive },
  avatarFallback: { backgroundColor: 'rgba(34,211,238,0.1)', justifyContent: 'center', alignItems: 'center' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#22D3EE', borderRadius: 12, paddingVertical: 13, minHeight: 44,
  },
  primaryBtnText: { fontSize: FontSizes.sm, fontWeight: '800', color: '#0A0F1E' },

  pickBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.glassBorderActive,
    borderRadius: 14, paddingVertical: 20, paddingHorizontal: 12, marginBottom: 10,
  },
  pickText: { fontSize: FontSizes.sm, color: Colors.textSecondary, flexShrink: 1 },

  formLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginBottom: 5, marginTop: 8, letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.glassLight, borderWidth: 1, borderColor: Colors.glassBorderLight,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSizes.sm, color: Colors.textPrimary,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorderLight, minHeight: 34,
  },
  chipActive: { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.5)' },
  chipText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: '#22D3EE', fontWeight: '800' },

  postRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.glassLight,
  },
  postTitle: { fontSize: FontSizes.sm, fontWeight: '600', color: Colors.textPrimary },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  iconBtn: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.glassLight,
    justifyContent: 'center', alignItems: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 8 },
  proBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.brandRed, borderRadius: BorderRadius.lg, padding: 16, minHeight: 64 },
  proBannerTitle: { color: '#fff', fontWeight: '800', fontSize: FontSizes.base },
  proBannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: FontSizes.xs, marginTop: 3, lineHeight: 16 },
  statBox: {
    flex: 1, backgroundColor: Colors.glass, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.glassBorder, alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  variationBox: {
    backgroundColor: Colors.glass, borderRadius: 12, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: Colors.glassBorderLight,
  },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  copyText: { fontSize: 11, fontWeight: '700', color: '#22D3EE' },
});
