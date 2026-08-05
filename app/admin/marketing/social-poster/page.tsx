'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../layout';
import {
  Share2, Sparkles, Plus, ExternalLink, Copy, Check, Trash2, Edit, Save,
  Loader2, RefreshCw, Users, TrendingUp, MessageSquare, Clock,
  Wand2, ImageDown, X, Facebook, Zap, BarChart3,
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  url: string;
  category: string;
  member_count: number;
  notes: string;
  last_posted_at: string | null;
  days_since_last_post: number | null;
  total_posts: number;
  leads_generated: number;
}

interface Variation {
  headline: string;
  body: string;
  cta: string;
  hashtags: string[];
  composed_text: string;
  char_count: number;
}

interface Metrics {
  total_posts: number;
  total_leads_from_social: number;
  conversion_rate_pct: number;
  top_groups: Array<{ group_id: string; group_name: string; post_count: number; last_posted: string | null }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  rentals: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  hispanic: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  dumas: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  amarillo: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  'buy-sell': 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  general: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
};

const badgeForDays = (days: number | null): string => {
  if (days === null) return 'bg-white/5 text-gray-400 border-white/10';
  if (days === 0) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (days < 2) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (days < 5) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  return 'bg-emerald-500/25 text-emerald-200 border-emerald-500/50';
};

export default function SocialPosterPage() {
  const { token } = useAdminAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [gs, ms] = await Promise.all([
        fetch('/api/admin/marketing/social/groups', { headers: authHdr }).then(r => r.json()),
        fetch('/api/admin/marketing/social/metrics?days=30', { headers: authHdr }).then(r => r.json()),
      ]);
      setGroups(gs?.groups || []);
      setMetrics(ms || null);
    } catch { setToast({ msg: 'Error al cargar', type: 'err' }); }
    setLoading(false);
  }, [token, authHdr]);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const markPosted = async (id: string) => {
    try {
      await fetch(`/api/admin/marketing/social/groups/${id}/mark-posted`, { method: 'POST', headers: authHdr });
      showToast('Marcado como publicado ✓');
      load();
    } catch { showToast('Error', 'err'); }
  };

  const deleteGroup = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el grupo "${name}"?`)) return;
    try {
      await fetch(`/api/admin/marketing/social/groups/${id}`, { method: 'DELETE', headers: authHdr });
      showToast('Grupo eliminado');
      load();
    } catch { showToast('Error', 'err'); }
  };

  const copyText = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch { showToast('Error al copiar', 'err'); }
  };

  return (
    <div className="min-h-full bg-[#050810] text-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Share2 className="w-6 h-6 text-blue-400" />
              Social Poster · FB Groups
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Genera posts con IA · Publica en grupos como persona real (no shares de página) · Trackea leads
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowGenerator(true)} className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 hover:brightness-110 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
              <Wand2 className="w-3.5 h-3.5" /> Generar post con IA
            </button>
            <a href="/api/marketing/flyer?campaign=facebook" target="_blank" rel="noopener noreferrer" download
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1.5">
              <ImageDown className="w-3.5 h-3.5" /> Descargar flyer
            </a>
            <button onClick={() => setShowAddGroup(true)} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Grupo
            </button>
            <button onClick={load} disabled={loading} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Metrics cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Posts (30d)" value={metrics.total_posts} icon={<MessageSquare className="w-4 h-4" />} tint="blue" />
            <MetricCard label="Leads generados" value={metrics.total_leads_from_social} icon={<TrendingUp className="w-4 h-4" />} tint="emerald" />
            <MetricCard label="Conversión" value={`${metrics.conversion_rate_pct}%`} icon={<BarChart3 className="w-4 h-4" />} tint="violet" />
            <MetricCard label="Grupos activos" value={groups.length} icon={<Users className="w-4 h-4" />} tint="cyan" />
          </div>
        )}

        {/* Tip */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-[11px] text-blue-200 leading-relaxed">
          💡 <b>Estrategia recomendada</b>: Genera un post con IA → Copia el texto → Ve al grupo → Pégalo como post NUEVO (no share desde tu página).
          Espacia 20-30 min entre grupos. Rota entre variaciones para evitar detección de duplicados. Click en &ldquo;Marcar publicado&rdquo; al terminar.
        </div>

        {/* Groups list */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Facebook className="w-4 h-4 text-blue-400" /> Tus grupos</h3>
            <span className="text-[10px] text-gray-500">{groups.length} grupos · Ordenados por &ldquo;más antiguo publicado&rdquo;</span>
          </div>
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
          ) : groups.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Aún no has agregado grupos. <button onClick={() => setShowAddGroup(true)} className="text-blue-400 hover:underline">Agregar el primero</button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {groups.map(g => (
                <div key={g.id} className="p-3 sm:p-4 hover:bg-white/[0.02] transition">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 flex-shrink-0">
                      <Facebook className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-blue-300 flex items-center gap-1 truncate">
                          {g.name} <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold border ${CATEGORY_COLORS[g.category] || CATEGORY_COLORS.general}`}>{g.category}</span>
                        {g.member_count > 0 && <span className="text-[10px] text-gray-500">{g.member_count.toLocaleString()} miembros</span>}
                      </div>
                      <div className="text-[11px] text-gray-400 flex flex-wrap gap-x-3">
                        <span>Posts: <b className="text-white">{g.total_posts}</b></span>
                        <span>Leads: <b className="text-emerald-400">{g.leads_generated}</b></span>
                        {g.notes && <span className="italic truncate">{g.notes}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end gap-1.5">
                      <span className={`text-[10px] px-2 py-1 rounded-lg border font-semibold ${badgeForDays(g.days_since_last_post)} whitespace-nowrap`}>
                        {g.days_since_last_post === null ? 'Nunca posteado' : g.days_since_last_post === 0 ? 'Hoy' : g.days_since_last_post === 1 ? 'Ayer' : `Hace ${g.days_since_last_post}d`}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => markPosted(g.id)} className="px-2 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 text-[10px] font-bold whitespace-nowrap">
                          ✓ Publicado
                        </button>
                        <button onClick={() => setEditingGroup(g)} className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400"><Edit className="w-3 h-3" /></button>
                        <button onClick={() => deleteGroup(g.id, g.name)} className="p-1.5 rounded-md bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-300"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showGenerator && <GeneratorModal onClose={() => setShowGenerator(false)} authHdr={authHdr} onCopy={copyText} copiedIdx={copiedIdx} showToast={showToast} />}
      {(showAddGroup || editingGroup) && <GroupModal group={editingGroup} onClose={() => { setShowAddGroup(false); setEditingGroup(null); }} authHdr={authHdr} onDone={() => { setShowAddGroup(false); setEditingGroup(null); load(); showToast('Guardado ✓'); }} showToast={showToast} />}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-[110] px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold flex items-center gap-2 border ${toast.type === 'ok' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100' : 'bg-red-500/20 border-red-500/40 text-red-100'}`}>
          {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, tint }: { label: string; value: string | number; icon: React.ReactNode; tint: string }) {
  const map: Record<string, string> = {
    blue: 'from-blue-500/15 to-blue-600/5 border-blue-500/25 text-blue-300',
    emerald: 'from-emerald-500/15 to-emerald-600/5 border-emerald-500/25 text-emerald-300',
    violet: 'from-violet-500/15 to-violet-600/5 border-violet-500/25 text-violet-300',
    cyan: 'from-cyan-500/15 to-cyan-600/5 border-cyan-500/25 text-cyan-300',
  };
  return (
    <div className={`bg-gradient-to-br ${map[tint]} border rounded-xl p-3 flex flex-col gap-1 min-h-[76px]`}>
      <div className="flex items-center justify-between opacity-80">
        <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
        {icon}
      </div>
      <div className="font-black tracking-tight text-white text-xl">{value}</div>
    </div>
  );
}

function GeneratorModal({ onClose, authHdr, onCopy, copiedIdx, showToast }: { onClose: () => void; authHdr: Record<string, string>; onCopy: (text: string, i: number) => void; copiedIdx: number | null; showToast: (msg: string, type?: 'ok' | 'err') => void }) {
  const [intent, setIntent] = useState('rental_listing');
  const [tone, setTone] = useState('friendly');
  const [propertyId, setPropertyId] = useState('');
  const [context, setContext] = useState('');
  const [properties, setProperties] = useState<Array<{ id: string; address: string; city: string; bedrooms: number; bathrooms: number; rent_amount: number }>>([]);
  const [generating, setGenerating] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);

  useEffect(() => {
    fetch('/api/admin/marketing/social/available-properties', { headers: authHdr })
      .then(r => r.json())
      .then(d => setProperties(d?.properties || []))
      .catch(() => {});
  }, [authHdr]);

  const generate = async () => {
    setGenerating(true);
    setVariations([]);
    try {
      const r = await fetch('/api/admin/marketing/social/generate', {
        method: 'POST',
        headers: authHdr,
        body: JSON.stringify({
          intent,
          tone,
          property_id: propertyId || undefined,
          custom_context: context,
          include_hashtags: true,
          include_cta: true,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setVariations(data.variations || []);
        showToast(`${data.variations?.length || 0} variaciones generadas ✓`);
      } else {
        showToast(data.detail || 'Error al generar', 'err');
      }
    } catch { showToast('Error de red', 'err'); }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b1220] border border-white/10 rounded-3xl p-5 max-w-3xl w-full shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#0b1220] pb-2 -mt-1 pt-1 z-10">
          <h3 className="font-bold text-base text-white flex items-center gap-2"><Wand2 className="w-4 h-4 text-violet-400" /> Generador de posts (Claude Sonnet 4.5)</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {variations.length === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Objetivo del post</label>
                <select value={intent} onChange={(e) => setIntent(e.target.value)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                  <option value="rental_listing">🏠 Casa disponible en renta</option>
                  <option value="available_soon">🔜 Próximamente disponible</option>
                  <option value="general_promo">📣 Promo general Ross House</option>
                  <option value="contractor_recruit">🔧 Reclutar proveedores</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Tono</label>
                <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                  <option value="friendly">😊 Amigable · cálido</option>
                  <option value="urgent">🔥 Urgente · oportunidad</option>
                  <option value="professional">💼 Profesional</option>
                  <option value="informal">💬 Informal · WhatsApp</option>
                </select>
              </div>
            </div>

            {intent === 'rental_listing' && properties.length > 0 && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Propiedad específica (opcional)</label>
                <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                  <option value="">— Sin propiedad específica (post genérico) —</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.address}, {p.city} · {p.bedrooms}br/{p.bathrooms}ba · ${p.rent_amount}/mes</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Contexto adicional (opcional)</label>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Ej: mencionar que aceptamos mascotas, que hay descuento el primer mes, etc." rows={2}
                className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white resize-none" />
            </div>

            <button onClick={generate} disabled={generating} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 hover:brightness-110 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando 5 variaciones...</> : <><Zap className="w-4 h-4" /> Generar 5 variaciones</>}
            </button>
          </div>
        )}

        {variations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400"><b className="text-white">{variations.length}</b> variaciones · Copia cada una y pégala en un grupo distinto</span>
              <button onClick={() => setVariations([])} className="text-xs text-blue-400 hover:underline">← Generar otras</button>
            </div>
            {variations.map((v, i) => (
              <div key={i} className="p-3 bg-white/[0.03] border border-white/10 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-violet-300">Variación {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{v.char_count} caracteres</span>
                    <button onClick={() => onCopy(v.composed_text, i)} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white flex items-center gap-1">
                      {copiedIdx === i ? <><Check className="w-3 h-3 text-emerald-400" /> ¡Copiado!</> : <><Copy className="w-3 h-3" /> Copiar</>}
                    </button>
                  </div>
                </div>
                <div className="text-sm font-bold text-white mb-1">{v.headline}</div>
                <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{v.body}</div>
                {v.cta && <div className="text-xs text-blue-300 mt-2 italic">→ {v.cta}</div>}
                {v.hashtags && v.hashtags.length > 0 && (
                  <div className="text-[11px] text-gray-500 mt-2 flex flex-wrap gap-1">
                    {v.hashtags.map((h, j) => <span key={j} className="px-1.5 py-0.5 bg-white/5 rounded">#{h.replace(/^#/, '')}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupModal({ group, onClose, authHdr, onDone, showToast }: { group: Group | null; onClose: () => void; authHdr: Record<string, string>; onDone: () => void; showToast: (msg: string, type?: 'ok' | 'err') => void }) {
  const [name, setName] = useState(group?.name || '');
  const [url, setUrl] = useState(group?.url || '');
  const [category, setCategory] = useState(group?.category || 'general');
  const [memberCount, setMemberCount] = useState(group?.member_count || 0);
  const [notes, setNotes] = useState(group?.notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !url.trim()) { showToast('Nombre y URL requeridos', 'err'); return; }
    setSaving(true);
    try {
      const endpoint = group ? `/api/admin/marketing/social/groups/${group.id}` : '/api/admin/marketing/social/groups';
      const method = group ? 'PUT' : 'POST';
      const r = await fetch(endpoint, { method, headers: authHdr, body: JSON.stringify({ name, url, category, member_count: memberCount, notes }) });
      if (r.ok) onDone();
      else showToast('Error al guardar', 'err');
    } catch { showToast('Error de red', 'err'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0b1220] border border-white/10 rounded-3xl p-5 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-white">{group ? 'Editar grupo' : 'Agregar grupo de FB'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Nombre del grupo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Rentas Dumas TX" className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">URL de FB</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://facebook.com/groups/..." className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white">
                <option value="rentals">🏠 Rentas</option>
                <option value="hispanic">🌎 Hispano</option>
                <option value="dumas">📍 Dumas</option>
                <option value="amarillo">📍 Amarillo</option>
                <option value="buy-sell">💰 Compra/Venta</option>
                <option value="general">📌 General</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Miembros (opcional)</label>
              <input type="number" min={0} value={memberCount} onChange={(e) => setMemberCount(Number(e.target.value) || 0)} className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1 block">Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ej: Alta conversión, admins estrictos con links, etc." className="w-full py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 hover:brightness-110 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
