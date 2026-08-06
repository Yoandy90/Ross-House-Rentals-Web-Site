'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Inbox, Send, Mail, MailOpen, Trash2, RefreshCw, PenSquare, X,
  Search, Clock, CornerUpLeft, AlertCircle, CheckCircle2,
  Sparkles, Settings2, ShieldAlert, ArrowUpFromLine,
} from 'lucide-react';
import { useAdminAuth } from '../layout';

interface EmailItem {
  id: string; folder: string; from_email: string; from_name?: string;
  to: string; subject: string; preview?: string; text?: string; html?: string;
  read: boolean; created_at: string; scheduled_for?: string;
  sendgrid_batch_id?: string; cancelled?: boolean; sent_by?: string;
  ai_draft?: string; ai_status?: string; ack_sent?: boolean; spam_score?: number;
  category?: string; category_manual?: boolean;
}

const CAT_META: Record<string, { label: string; emoji: string; chip: string; badge: string }> = {
  lead: { label: 'Interesados', emoji: '🏠', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  tenant: { label: 'Inquilinos', emoji: '👤', chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  provider: { label: 'Proveedores', emoji: '🔧', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  invoice: { label: 'Facturas', emoji: '🧾', chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30', badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' },
  other: { label: 'Otros', emoji: '📌', chip: 'bg-gray-500/15 text-gray-400 border-gray-500/30', badge: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
};

interface AiConfig {
  auto_ack_enabled: boolean;
  auto_draft_enabled: boolean;
  auto_send_enabled: boolean;
  ack_message: string;
}

export default function BuzonPage() {
  const { headers, token } = useAdminAuth();
  const [folder, setFolder] = useState<'inbox' | 'sent' | 'spam'>('inbox');
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [selected, setSelected] = useState<EmailItem | null>(null);
  const [thread, setThread] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ from: '', to: '', subject: '', body: '', send_at: '' });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [senders, setSenders] = useState<Record<string, string>>({});
  const [defaultSender, setDefaultSender] = useState('');
  const [aiCfg, setAiCfg] = useState<AiConfig | null>(null);
  const [showAiCfg, setShowAiCfg] = useState(false);
  const [draftEdit, setDraftEdit] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [classifying, setClassifying] = useState(false);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async (f = folder, query = q, cat = catFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ folder: f, limit: '50' });
      if (query) params.set('q', query);
      if (cat && f === 'inbox') params.set('category', cat);
      const res = await fetch(`/api/admin/inbox?${params}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setEmails(d.emails || []);
        setUnread(d.unread_count || 0);
        setCatCounts(d.category_counts || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [folder, q, catFilter]);

  useEffect(() => { load(); }, [folder, catFilter]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/inbox/ai-config', { headers: headers() });
        if (res.ok) {
          const d = await res.json();
          setAiCfg(d.config);
          setSenders(d.senders || {});
          setDefaultSender(d.default_sender || '');
        }
      } catch { /* noop */ }
    })();
  }, [token]);

  const saveAiCfg = async (patch: Partial<AiConfig>) => {
    try {
      const res = await fetch('/api/admin/inbox/ai-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (res.ok) { setAiCfg(d.config); notify(true, 'Configuración AI guardada'); }
      else notify(false, d.detail || 'Error');
    } catch { notify(false, 'Error de red'); }
  };

  const regenDraft = async (id: string) => {
    setAiBusy(true);
    try {
      const res = await fetch(`/api/admin/inbox/${id}/ai-draft`, { method: 'POST', headers: headers() });
      const d = await res.json();
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, ai_draft: d.ai_draft, ai_status: 'draft' } : prev);
        setDraftEdit(d.ai_draft);
        notify(true, 'Borrador AI generado');
      } else notify(false, d.detail || 'Error generando borrador');
    } catch { notify(false, 'Error de red'); }
    setAiBusy(false);
  };

  const approveDraft = async (id: string) => {
    setAiBusy(true);
    try {
      const res = await fetch(`/api/admin/inbox/${id}/approve-draft`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ body: draftEdit }),
      });
      const d = await res.json();
      if (res.ok) {
        notify(true, d.message || 'Respuesta enviada');
        setSelected(prev => prev ? { ...prev, ai_status: 'approved' } : prev);
      } else notify(false, d.detail || 'Error al enviar');
    } catch { notify(false, 'Error de red'); }
    setAiBusy(false);
  };

  const setCategory = async (id: string, category: string) => {
    try {
      const res = await fetch(`/api/admin/inbox/${id}/category`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ category }),
      });
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, category, category_manual: true } : prev);
        setEmails(prev => prev.map(e => e.id === id ? { ...e, category } : e));
        notify(true, `Categoría: ${CAT_META[category]?.label || category}`);
        load();
      } else notify(false, 'Error al cambiar categoría');
    } catch { notify(false, 'Error de red'); }
  };

  const classifyPending = async () => {
    setClassifying(true);
    try {
      const res = await fetch('/api/admin/inbox/classify-pending', { method: 'POST', headers: headers() });
      const d = await res.json();
      if (res.ok) {
        notify(true, `${d.classified} correo(s) clasificados con AI`);
        load();
      } else notify(false, d.detail || 'Error clasificando');
    } catch { notify(false, 'Error de red'); }
    setClassifying(false);
  };

  const moveTo = async (id: string, dest: 'inbox' | 'spam') => {
    await fetch(`/api/admin/inbox/${id}/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ folder: dest }),
    });
    setSelected(null);
    notify(true, dest === 'spam' ? 'Movido a Spam' : 'Movido a Recibidos');
    load();
  };

  const open = async (item: EmailItem) => {
    try {
      const res = await fetch(`/api/admin/inbox/${item.id}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setSelected(d.email);
        setThread(d.thread || []);
        setDraftEdit(d.email?.ai_draft || '');
        setEmails(prev => prev.map(e => e.id === item.id ? { ...e, read: true } : e));
      }
    } catch (e) { console.error(e); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar este email?')) return;
    await fetch(`/api/admin/inbox/${id}`, { method: 'DELETE', headers: headers() });
    setSelected(null);
    load();
  };

  const cancelScheduled = async (batchId: string) => {
    if (!confirm('¿Cancelar este envío programado?')) return;
    const res = await fetch(`/api/admin/inbox/cancel-scheduled/${batchId}`, { method: 'POST', headers: headers() });
    const d = await res.json();
    notify(res.ok, res.ok ? d.message : (d.detail || 'Error'));
    load();
  };

  // Responder desde el alias al que escribieron (si es uno permitido)
  const pickSender = (toField?: string) => {
    const txt = (toField || '').toLowerCase();
    return Object.keys(senders).find(a => txt.includes(a)) || defaultSender;
  };

  const startReply = () => {
    if (!selected) return;
    setForm({
      from: selected.folder === 'inbox' ? pickSender(selected.to) : defaultSender,
      to: selected.folder === 'inbox' ? selected.from_email : selected.to,
      subject: selected.subject.toLowerCase().startsWith('re:') ? selected.subject : `Re: ${selected.subject}`,
      body: '', send_at: '',
    });
    setCompose(true);
  };

  const send = async () => {
    if (!form.to || !form.subject || !form.body) { notify(false, 'Completa destinatario, asunto y mensaje'); return; }
    setSending(true);
    try {
      const body: any = { to: form.to, subject: form.subject, body_text: form.body };
      if (form.send_at) body.send_at = new Date(form.send_at).toISOString();
      if (selected) body.reply_to_id = selected.id;
      const res = await fetch('/api/admin/inbox/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (res.ok) {
        notify(true, d.message || 'Enviado');
        setCompose(false);
        setForm({ to: '', subject: '', body: '', send_at: '' });
        setFolder('sent');
      } else notify(false, d.detail || 'Error al enviar');
    } catch { notify(false, 'Error de red'); }
    setSending(false);
  };

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-pink-400" /> Buzón de Email
          </h1>
          <p className="text-sm text-gray-500">Recibe, revisa y envía correos desde la plataforma</p>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowAiCfg(true)}
          className="flex items-center gap-2 px-3 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-lg text-sm font-bold hover:bg-violet-500/25 transition"
          title="Automatización AI del buzón">
          <Sparkles className="w-4 h-4" /> AI
          {aiCfg?.auto_send_enabled && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">AUTO</span>}
        </button>
        <button onClick={() => { setSelected(null); setForm({ from: defaultSender, to: '', subject: '', body: '', send_at: '' }); setCompose(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-pink-500/15 text-pink-400 border border-pink-500/30 rounded-lg text-sm font-bold hover:bg-pink-500/25 transition">
          <PenSquare className="w-4 h-4" /> Redactar
        </button>
        <button onClick={() => load()} className="p-2 text-gray-400 hover:text-white transition" title="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${toast.ok ? 'bg-green-500/10 border-green-500/25 text-green-400' : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {toast.text}
        </div>
      )}

      {/* Tabs + búsqueda */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setFolder('inbox'); setSelected(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${folder === 'inbox' ? 'bg-pink-500/15 text-pink-400 border-pink-500/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:text-white'}`}>
          <Inbox className="w-4 h-4" /> Recibidos
          {unread > 0 && <span className="px-1.5 py-0.5 bg-pink-500 text-white text-[10px] font-bold rounded-full">{unread}</span>}
        </button>
        <button onClick={() => { setFolder('sent'); setSelected(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${folder === 'sent' ? 'bg-pink-500/15 text-pink-400 border-pink-500/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:text-white'}`}>
          <Send className="w-4 h-4" /> Enviados
        </button>
        <button onClick={() => { setFolder('spam'); setSelected(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${folder === 'spam' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:text-white'}`}>
          <ShieldAlert className="w-4 h-4" /> Spam
        </button>
        <div className="flex-1 min-w-[200px] max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(folder, q)}
            placeholder="Buscar por asunto, email, contenido…"
            className="w-full pl-9 pr-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-pink-500 focus:outline-none" />
        </div>
      </div>

      {/* Filtros por categoría AI */}
      {folder === 'inbox' && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setCatFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${!catFilter ? 'bg-pink-500/15 text-pink-400 border-pink-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-white'}`}>
            Todos
          </button>
          {Object.entries(CAT_META).map(([key, meta]) => (
            <button key={key} onClick={() => setCatFilter(catFilter === key ? '' : key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${catFilter === key ? meta.chip : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:text-white'}`}>
              {meta.emoji} {meta.label}
              {(catCounts[key] || 0) > 0 && <span className="opacity-70">{catCounts[key]}</span>}
            </button>
          ))}
          {(catCounts['unclassified'] || 0) > 0 && (
            <button onClick={classifyPending} disabled={classifying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-violet-500/15 text-violet-300 border-violet-500/30 hover:bg-violet-500/25 transition disabled:opacity-40">
              {classifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Clasificar {catCounts['unclassified']} pendiente{catCounts['unclassified'] > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        {/* Lista */}
        <div className="bg-[#0d1526]/80 border border-white/[0.08] rounded-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-10"><RefreshCw className="w-6 h-6 text-gray-500 animate-spin" /></div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">{folder === 'inbox' ? 'Sin correos recibidos' : folder === 'spam' ? 'Sin spam 🎉' : 'Sin correos enviados'}</p>
              {folder === 'inbox' && (
                <p className="text-gray-600 text-xs mt-2">Para recibir correos aquí se necesita activar Inbound Parse (ver instrucciones abajo)</p>
              )}
            </div>
          ) : emails.map(e => (
            <button key={e.id} onClick={() => open(e)}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition ${selected?.id === e.id ? 'bg-pink-500/[0.06]' : ''}`}>
              <div className="flex items-center gap-2">
                {folder !== 'sent' && (e.read
                  ? <MailOpen className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  : <Mail className="w-3.5 h-3.5 text-pink-400 shrink-0" />)}
                <span className={`text-sm truncate flex-1 ${e.read ? 'text-gray-400' : 'text-white font-bold'}`}>
                  {folder !== 'sent' ? (e.from_name || e.from_email) : e.to}
                </span>
                <span className="text-[10px] text-gray-600 shrink-0">{fmtDate(e.created_at)}</span>
              </div>
              <p className={`text-xs truncate mt-0.5 ${e.read ? 'text-gray-500' : 'text-gray-300 font-semibold'}`}>{e.subject}</p>
              {e.scheduled_for && !e.cancelled && new Date(e.scheduled_for) > new Date() && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-400"><Clock className="w-3 h-3" /> Programado: {fmtDate(e.scheduled_for)}</span>
              )}
              {e.cancelled && <span className="inline-block mt-1 text-[10px] text-red-400 font-bold">CANCELADO</span>}
              {e.category && CAT_META[e.category] && folder !== 'sent' && (
                <span className={`inline-block mt-1 mr-1 text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${CAT_META[e.category].badge}`}>
                  {CAT_META[e.category].emoji} {CAT_META[e.category].label}
                </span>
              )}
              {e.ai_status === 'draft' && <span className="inline-block mt-1 mr-1 text-[10px] text-violet-300 font-bold">✨ Borrador AI listo</span>}
              {e.ai_status === 'sent_auto' && <span className="inline-block mt-1 mr-1 text-[10px] text-emerald-300 font-bold">🤖 Respondido por AI</span>}
              {e.ai_status === 'approved' && <span className="inline-block mt-1 mr-1 text-[10px] text-emerald-300 font-bold">✅ Respondido</span>}
              {e.preview && <p className="text-[11px] text-gray-600 truncate mt-0.5">{e.preview}</p>}
            </button>
          ))}
        </div>

        {/* Detalle */}
        <div className="bg-[#0d1526]/80 border border-white/[0.08] rounded-2xl p-5 max-h-[70vh] overflow-y-auto">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center">
              <Mail className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm">Selecciona un correo para leerlo</p>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-1">
                  <h2 className="text-white font-bold text-lg leading-snug">{selected.subject}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {selected.folder === 'inbox'
                      ? <>De: <span className="text-gray-300">{selected.from_name ? `${selected.from_name} <${selected.from_email}>` : selected.from_email}</span></>
                      : <>Para: <span className="text-gray-300">{selected.to}</span></>}
                    {' · '}{fmtDate(selected.created_at)}
                  </p>
                  {selected.folder !== 'sent' && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Categoría:</span>
                      <select value={selected.category || ''}
                        onChange={ev => ev.target.value && setCategory(selected.id, ev.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg border bg-[#0a1020]/60 focus:outline-none cursor-pointer ${selected.category && CAT_META[selected.category] ? CAT_META[selected.category].badge : 'text-gray-400 border-white/[0.08]'}`}>
                        <option value="">Sin clasificar</option>
                        {Object.entries(CAT_META).map(([key, meta]) => (
                          <option key={key} value={key} className="bg-[#0d1526] text-white">{meta.emoji} {meta.label}</option>
                        ))}
                      </select>
                      {selected.category_manual && <span className="text-[9px] text-gray-600">(manual)</span>}
                    </div>
                  )}
                  {selected.scheduled_for && !selected.cancelled && new Date(selected.scheduled_for) > new Date() && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Clock className="w-3.5 h-3.5" /> Programado para {fmtDate(selected.scheduled_for)}</span>
                      {selected.sendgrid_batch_id && (
                        <button onClick={() => cancelScheduled(selected.sendgrid_batch_id!)}
                          className="text-xs text-red-400 underline hover:text-red-300">Cancelar envío</button>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={startReply} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition">
                  <CornerUpLeft className="w-3.5 h-3.5" /> Responder
                </button>
                {selected.folder === 'inbox' && (
                  <button onClick={() => moveTo(selected.id, 'spam')} title="Mover a Spam"
                    className="p-1.5 text-gray-500 hover:text-amber-400 transition"><ShieldAlert className="w-4 h-4" /></button>
                )}
                {selected.folder === 'spam' && (
                  <button onClick={() => moveTo(selected.id, 'inbox')} title="No es spam — mover a Recibidos"
                    className="p-1.5 text-gray-500 hover:text-emerald-400 transition"><ArrowUpFromLine className="w-4 h-4" /></button>
                )}
                <button onClick={() => del(selected.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
              </div>

              {thread.length > 0 && (
                <div className="mb-3 p-2 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Hilo ({thread.length} anteriores)</p>
                  {thread.map(t => (
                    <p key={t.id} className="text-[11px] text-gray-500 truncate">• {fmtDate(t.created_at)} — {t.folder === 'sent' ? '→' : '←'} {t.subject}</p>
                  ))}
                </div>
              )}

              <div className="border-t border-white/[0.06] pt-4">
                {selected.html ? (
                  <div className="bg-white rounded-xl p-4 text-black text-sm overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: selected.html }} />
                ) : (
                  <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">{selected.text}</pre>
                )}
              </div>

              {/* ── Respuesta AI ── */}
              {selected.folder !== 'sent' && (
                <div className="mt-4 p-4 bg-violet-500/[0.05] border border-violet-500/20 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> Respuesta sugerida por AI
                    </span>
                    {selected.ai_status === 'sent_auto' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">✅ ENVIADA AUTOMÁTICAMENTE</span>
                    )}
                    {selected.ai_status === 'approved' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">✅ APROBADA Y ENVIADA</span>
                    )}
                    {selected.ack_sent && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold">📨 Confirmación de recibido enviada</span>
                    )}
                    <span className="text-[10px] text-gray-500">Se enviará desde: <span className="text-gray-400">{pickSender(selected.to)}</span></span>
                  </div>
                  {(selected.ai_draft || draftEdit) ? (
                    <>
                      <textarea value={draftEdit} onChange={e => setDraftEdit(e.target.value)} rows={7}
                        className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-violet-500 focus:outline-none resize-y" />
                      <div className="flex flex-wrap gap-2">
                        {selected.ai_status !== 'sent_auto' && selected.ai_status !== 'approved' && (
                          <button onClick={() => approveDraft(selected.id)} disabled={aiBusy}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold hover:bg-emerald-500/25 transition disabled:opacity-40">
                            {aiBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Aprobar y enviar
                          </button>
                        )}
                        <button onClick={() => regenDraft(selected.id)} disabled={aiBusy}
                          className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 text-violet-300 border border-violet-500/25 rounded-xl text-xs font-bold hover:bg-violet-500/20 transition disabled:opacity-40">
                          <Sparkles className="w-3.5 h-3.5" /> Regenerar
                        </button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => regenDraft(selected.id)} disabled={aiBusy}
                      className="flex items-center gap-2 px-4 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold hover:bg-violet-500/25 transition disabled:opacity-40">
                      {aiBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Generar respuesta con AI
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aviso Inbound Parse */}
      <div className="p-4 bg-blue-500/[0.06] border border-blue-500/15 rounded-xl text-xs text-gray-400 leading-relaxed">
        <b className="text-blue-400">📥 Para RECIBIR correos en este buzón:</b> se necesita activar SendGrid Inbound Parse una sola vez —
        (1) agregar en el DNS del dominio un registro <code className="text-gray-300">MX</code> para <code className="text-gray-300">inbox.rosshouserentals.com</code> → <code className="text-gray-300">mx.sendgrid.net</code> (prioridad 10);
        (2) en SendGrid → Settings → Inbound Parse → Add Host & URL con destino <code className="text-gray-300">https://ross-house-backend-production.up.railway.app/api/webhooks/email-inbound</code>.
        Los correos enviados a <code className="text-gray-300">cualquier-cosa@inbox.rosshouserentals.com</code> aparecerán aquí automáticamente. El envío de correos ya funciona sin este paso.
      </div>

      {/* Modal Configuración AI */}
      {showAiCfg && aiCfg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAiCfg(false)}>
          <div className="bg-[#0d1526] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-400" /> Automatización AI del buzón</h3>
              <button onClick={() => setShowAiCfg(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {[
              { key: 'auto_ack_enabled' as const, label: '📨 Confirmación automática de recibido', desc: 'Cuando alguien escribe, se le responde al instante que recibimos su email (máx 1 vez por remitente cada 24h).' },
              { key: 'auto_draft_enabled' as const, label: '✨ Borradores AI automáticos', desc: 'La AI lee cada email que entra y prepara una respuesta; tú solo revisas y apruebas.' },
              { key: 'auto_send_enabled' as const, label: '🤖 Envío 100% automático (piloto)', desc: 'La AI envía su respuesta SOLA, sin que apruebes. Actívalo solo cuando confíes en los borradores.' },
            ].map(opt => (
              <label key={opt.key} className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl cursor-pointer hover:border-violet-500/30 transition">
                <input type="checkbox" checked={aiCfg[opt.key]} onChange={e => saveAiCfg({ [opt.key]: e.target.checked })}
                  className="mt-0.5 accent-violet-500" />
                <div>
                  <div className="text-sm font-bold text-white">{opt.label}</div>
                  <div className="text-[11px] text-gray-500 leading-relaxed">{opt.desc}</div>
                </div>
              </label>
            ))}

            <div>
              <div className="text-xs font-bold text-gray-400 mb-1.5">Mensaje de confirmación de recibido</div>
              <textarea value={aiCfg.ack_message} rows={6}
                onChange={e => setAiCfg({ ...aiCfg, ack_message: e.target.value })}
                className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-xs focus:border-violet-500 focus:outline-none resize-y" />
              <button onClick={() => saveAiCfg({ ack_message: aiCfg.ack_message })}
                className="mt-2 px-4 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold hover:bg-violet-500/25 transition">
                Guardar mensaje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Redactar */}
      {compose && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCompose(false)}>
          <div className="bg-[#0d1526] border border-white/[0.1] rounded-2xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><PenSquare className="w-5 h-5 text-pink-400" /> {selected && form.subject.startsWith('Re:') ? 'Responder' : 'Nuevo correo'}</h3>
              <button onClick={() => setCompose(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {Object.keys(senders).length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-bold shrink-0">De:</span>
                <select value={form.from || defaultSender} onChange={e => setForm({ ...form, from: e.target.value })}
                  className="flex-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none cursor-pointer">
                  {Object.entries(senders).map(([addr, label]) => (
                    <option key={addr} value={addr} className="bg-[#0d1526]">{label} — {addr}</option>
                  ))}
                </select>
              </div>
            )}
            <input value={form.to} onChange={e => setForm({ ...form, to: e.target.value })}
              placeholder="Para (separar con comas)"
              className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none" />
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Asunto"
              className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none" />
            <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="Escribe tu mensaje…" rows={8}
              className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none resize-y" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <Clock className="w-4 h-4" /> Programar (opcional, máx 72h):
                <input type="datetime-local" value={form.send_at} onChange={e => setForm({ ...form, send_at: e.target.value })}
                  className="px-2 py-1.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-xs focus:border-pink-500 focus:outline-none" />
              </label>
              <div className="flex-1" />
              <button onClick={send} disabled={sending}
                className="flex items-center gap-2 px-5 py-2.5 bg-pink-500/15 text-pink-400 border border-pink-500/30 rounded-xl text-sm font-bold hover:bg-pink-500/25 transition disabled:opacity-40">
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {form.send_at ? 'Programar envío' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
