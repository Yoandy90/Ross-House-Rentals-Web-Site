'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles, Send, Loader2, Pencil, Trash2, Globe, X, CheckCircle2, Zap,
} from 'lucide-react';

type Template = {
  id: string; category: string; category_label: string;
  subject_es: string; subject_en: string; body_es: string; body_en: string;
  status: string; sent_at: string | null; sent_count: number;
  published_to_blog: boolean; slug: string;
};

type DripConfig = { enabled: boolean; per_week: number; hour_ct: number };
type Queue = {
  pending: number; sent: number; total: number; subscribers: number;
  next: Template | null; last_sent_at: string | null;
};

const FREQ_LABEL: Record<number, string> = { 1: '1/semana (martes)', 2: '2/semana (mar y vie)', 3: '3/semana (lun, mié y vie)' };

export default function DripPanel({ headers }: { headers: () => Record<string, string> }) {
  const [config, setConfig] = useState<DripConfig | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([]);
  const [fCat, setFCat] = useState('');
  const [fSent, setFSent] = useState('');
  const [gen, setGen] = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });
  const [genCount, setGenCount] = useState(50);
  const [editing, setEditing] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const genPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/drip/config', { headers: headers() });
      if (r.ok) { const d = await r.json(); setConfig(d.config); setQueue(d.queue); }
    } catch (e) { console.error(e); }
  }, [headers]);

  const fetchTemplates = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (fCat) p.set('category', fCat);
      if (fSent) p.set('sent', fSent);
      p.set('limit', '100');
      const r = await fetch(`/api/admin/drip/templates?${p}`, { headers: headers() });
      if (r.ok) {
        const d = await r.json();
        setTemplates(d.templates || []); setTotal(d.total || 0);
        setCategories(d.categories || []);
      }
    } catch (e) { console.error(e); }
  }, [headers, fCat, fSent]);

  const pollGen = useCallback(() => {
    if (genPoll.current) clearInterval(genPoll.current);
    const tick = async () => {
      try {
        const r = await fetch('/api/admin/drip/generation-status', { headers: headers() });
        if (!r.ok) return;
        const d = await r.json();
        setGen(d);
        if (!d.running) {
          if (genPoll.current) { clearInterval(genPoll.current); genPoll.current = null; }
          fetchTemplates(); fetchConfig();
        }
      } catch (e) { console.error(e); }
    };
    tick();
    genPoll.current = setInterval(tick, 5000);
  }, [headers, fetchTemplates, fetchConfig]);

  useEffect(() => { fetchConfig(); pollGen(); }, [fetchConfig, pollGen]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => () => { if (genPoll.current) clearInterval(genPoll.current); }, []);

  const patchConfig = async (body: Partial<DripConfig>) => {
    const r = await fetch('/api/admin/drip/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    });
    if (r.ok) fetchConfig();
  };

  const startGen = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/drip/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ count: genCount }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setMsg('🤖 Generando en segundo plano...'); pollGen(); }
      else setMsg(d.detail || 'Error');
    } catch { setMsg('Error de red'); }
    setBusy(false);
  };

  const sendNext = async () => {
    if (!queue?.next) return;
    if (!window.confirm(`¿Enviar AHORA "${queue.next.subject_es}" a ${queue.subscribers} suscriptores?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/drip/send-next', { method: 'POST', headers: headers() });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `✅ Enviada a ${d.sent} suscriptores` : (d.detail || 'Error'));
      fetchConfig(); fetchTemplates();
    } catch { setMsg('Error de red'); }
    setBusy(false);
  };

  const patchTemplate = async (id: string, body: Record<string, unknown>) => {
    const r = await fetch(`/api/admin/drip/templates/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      const d = await r.json();
      setTemplates(prev => prev.map(t => t.id === id ? d.template : t));
      if (editing?.id === id) setEditing(d.template);
      fetchConfig();
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    await fetch(`/api/admin/drip/templates/${id}`, { method: 'DELETE', headers: headers() });
    setTemplates(prev => prev.filter(t => t.id !== id));
    fetchConfig();
  };

  return (
    <div className="space-y-4">
      {msg && <div className="text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2">{msg}</div>}

      {/* Motor de goteo */}
      {config && queue && (
        <div className="bg-white/[0.03] border border-violet-500/20 rounded-2xl p-4 space-y-3" data-testid="drip-engine">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400" /> Motor de goteo automático
            </div>
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${config.enabled ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-gray-500/15 text-gray-400 border-gray-500/30'}`}>
              {config.enabled ? '● Activo' : '⏸ Pausado'}
            </span>
            <div className="flex gap-2 ml-auto items-center">
              <select value={config.per_week} onChange={e => patchConfig({ per_week: Number(e.target.value) })}
                className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-gray-200">
                {[1, 2, 3].map(n => <option key={n} value={n}>{FREQ_LABEL[n]}</option>)}
              </select>
              <select value={config.hour_ct} onChange={e => patchConfig({ hour_ct: Number(e.target.value) })}
                className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-gray-200">
                {[7, 8, 9, 10, 11, 12, 17, 18].map(h => <option key={h} value={h}>{h}:00 CT</option>)}
              </select>
              <button onClick={() => patchConfig({ enabled: !config.enabled })}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${config.enabled ? 'bg-white/[0.04] text-gray-300 border-white/[0.08]' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'}`}>
                {config.enabled ? 'Pausar' : 'Activar'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { l: 'En cola', v: queue.pending, c: 'text-violet-300' },
              { l: 'Enviadas', v: queue.sent, c: 'text-emerald-300' },
              { l: 'Suscriptores', v: queue.subscribers, c: 'text-cyan-300' },
              { l: 'Semanas de contenido', v: config.per_week ? Math.floor(queue.pending / config.per_week) : 0, c: 'text-amber-300' },
            ].map(s => (
              <div key={s.l} className="bg-black/20 border border-white/[0.05] rounded-xl px-3 py-2">
                <div className={`text-lg font-bold ${s.c}`}>{s.v}</div>
                <div className="text-[10px] text-gray-500">{s.l}</div>
              </div>
            ))}
          </div>
          {queue.next && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 bg-black/20 border border-white/[0.05] rounded-xl px-3 py-2">
              <span className="text-gray-500">Próximo envío:</span>
              <b className="text-white">{queue.next.subject_es}</b>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08]">{queue.next.category_label}</span>
              <button onClick={sendNext} disabled={busy}
                className="ml-auto px-3 py-1.5 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-lg text-[11px] font-bold hover:bg-violet-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
                <Send className="w-3 h-3" /> Enviar ahora
              </button>
            </div>
          )}
        </div>
      )}

      {/* Generador AI */}
      <div className="bg-white/[0.03] border border-cyan-500/20 rounded-2xl p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" /> Fábrica de contenido AI
          </div>
          <div className="flex gap-2 ml-auto items-center">
            <select value={genCount} onChange={e => setGenCount(Number(e.target.value))}
              className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-gray-200">
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>hasta {n} en total</option>)}
            </select>
            <button onClick={startGen} disabled={busy || gen.running} data-testid="gen-btn"
              className="px-3 py-1.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold hover:bg-cyan-500/25 transition flex items-center gap-1.5 disabled:opacity-50">
              {gen.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {gen.running ? `Generando ${gen.done}/${gen.total}...` : 'Generar con AI'}
            </button>
          </div>
        </div>
        {gen.running && (
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-400 transition-all duration-500"
              style={{ width: gen.total ? `${Math.round((gen.done / gen.total) * 100)}%` : '5%' }} />
          </div>
        )}
        <p className="text-[10px] text-gray-600">Claude escribe emails bilingües (ES + EN) por categoría: rentar, comprar, crédito, mantenimiento, energía, Dumas, mudanzas, seguros, inversión y derechos del inquilino. Revísalas y edítalas cuando quieras.</p>
      </div>

      {/* Filtros + lista */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={fCat} onChange={e => setFCat(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-gray-200">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={fSent} onChange={e => setFSent(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-gray-200">
          <option value="">Todas</option>
          <option value="no">En cola (sin enviar)</option>
          <option value="yes">Ya enviadas</option>
        </select>
        <span className="text-[11px] text-gray-500 ml-auto">{total} plantilla(s)</span>
      </div>

      <div className="space-y-2" data-testid="templates-list">
        {templates.length === 0 && (
          <div className="text-center text-xs text-gray-600 py-8">No hay plantillas aún — genera las primeras con el botón de AI ✨</div>
        )}
        {templates.map(t => (
          <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex flex-wrap items-center gap-2 hover:border-white/[0.12] transition">
            <div className="flex-1 min-w-[240px]">
              <div className="text-sm font-semibold text-white">{t.subject_es}</div>
              <div className="text-[11px] text-gray-500">{t.subject_en}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-gray-400">{t.category_label}</span>
                {t.sent_at
                  ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Enviada a {t.sent_count}</span>
                  : <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">⏳ En cola</span>}
                {t.status !== 'active' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20">{t.status === 'draft' ? 'Borrador' : 'Archivada'}</span>}
                {t.published_to_blog && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">🌐 En el blog</span>}
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => patchTemplate(t.id, { published_to_blog: !t.published_to_blog })}
                title={t.published_to_blog ? 'Quitar del blog' : 'Publicar en el blog'}
                className={`p-2 rounded-lg border transition ${t.published_to_blog ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.08] hover:text-white'}`}>
                <Globe className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(t)} title="Editar"
                className="p-2 rounded-lg bg-white/[0.03] text-gray-500 border border-white/[0.08] hover:text-white transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteTemplate(t.id)} title="Eliminar"
                className="p-2 rounded-lg bg-white/[0.03] text-gray-500 border border-white/[0.08] hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar */}
      {editing && (
        <EditModal tpl={editing} onClose={() => setEditing(null)}
          onSave={async (body) => { await patchTemplate(editing.id, body); setEditing(null); }} />
      )}
    </div>
  );
}

function EditModal({ tpl, onClose, onSave }: {
  tpl: Template; onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [se, setSe] = useState(tpl.subject_es);
  const [sn, setSn] = useState(tpl.subject_en);
  const [be, setBe] = useState(tpl.body_es);
  const [bn, setBn] = useState(tpl.body_en);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0d1017] border border-white/[0.08] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><Pencil className="w-4 h-4 text-cyan-400" /> Editar plantilla</h3>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/[0.04] text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold">Asunto (ES)</label>
            <input value={se} onChange={e => setSe(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-200" />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 uppercase font-bold">Subject (EN)</label>
            <input value={sn} onChange={e => setSn(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-200" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold">Cuerpo (ES)</label>
          <textarea value={be} onChange={e => setBe(e.target.value)} rows={8}
            className="w-full mt-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-200 resize-y" />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 uppercase font-bold">Body (EN)</label>
          <textarea value={bn} onChange={e => setBn(e.target.value)} rows={8}
            className="w-full mt-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-gray-200 resize-y" />
        </div>
        <button disabled={saving}
          onClick={async () => { setSaving(true); await onSave({ subject_es: se, subject_en: sn, body_es: be, body_en: bn }); setSaving(false); }}
          className="w-full py-2.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold hover:bg-cyan-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar cambios
        </button>
      </div>
    </div>
  );
}
