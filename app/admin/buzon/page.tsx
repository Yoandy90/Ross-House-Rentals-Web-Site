'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Inbox, Send, Mail, MailOpen, Trash2, RefreshCw, PenSquare, X,
  Search, Clock, CornerUpLeft, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useAdminAuth } from '../layout';

interface EmailItem {
  id: string; folder: string; from_email: string; from_name?: string;
  to: string; subject: string; preview?: string; text?: string; html?: string;
  read: boolean; created_at: string; scheduled_for?: string;
  sendgrid_batch_id?: string; cancelled?: boolean; sent_by?: string;
}

export default function BuzonPage() {
  const { headers } = useAdminAuth();
  const [folder, setFolder] = useState<'inbox' | 'sent'>('inbox');
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [selected, setSelected] = useState<EmailItem | null>(null);
  const [thread, setThread] = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ to: '', subject: '', body: '', send_at: '' });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const notify = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async (f = folder, query = q) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ folder: f, limit: '50' });
      if (query) params.set('q', query);
      const res = await fetch(`/api/admin/inbox?${params}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setEmails(d.emails || []);
        setUnread(d.unread_count || 0);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [folder, q]);

  useEffect(() => { load(); }, [folder]);

  const open = async (item: EmailItem) => {
    try {
      const res = await fetch(`/api/admin/inbox/${item.id}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setSelected(d.email);
        setThread(d.thread || []);
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

  const startReply = () => {
    if (!selected) return;
    setForm({
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
        <button onClick={() => { setSelected(null); setForm({ to: '', subject: '', body: '', send_at: '' }); setCompose(true); }}
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
        <div className="flex-1 min-w-[200px] max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(folder, q)}
            placeholder="Buscar por asunto, email, contenido…"
            className="w-full pl-9 pr-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-pink-500 focus:outline-none" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4">
        {/* Lista */}
        <div className="bg-[#0d1526]/80 border border-white/[0.08] rounded-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-10"><RefreshCw className="w-6 h-6 text-gray-500 animate-spin" /></div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">{folder === 'inbox' ? 'Sin correos recibidos' : 'Sin correos enviados'}</p>
              {folder === 'inbox' && (
                <p className="text-gray-600 text-xs mt-2">Para recibir correos aquí se necesita activar Inbound Parse (ver instrucciones abajo)</p>
              )}
            </div>
          ) : emails.map(e => (
            <button key={e.id} onClick={() => open(e)}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition ${selected?.id === e.id ? 'bg-pink-500/[0.06]' : ''}`}>
              <div className="flex items-center gap-2">
                {folder === 'inbox' && (e.read
                  ? <MailOpen className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  : <Mail className="w-3.5 h-3.5 text-pink-400 shrink-0" />)}
                <span className={`text-sm truncate flex-1 ${e.read ? 'text-gray-400' : 'text-white font-bold'}`}>
                  {folder === 'inbox' ? (e.from_name || e.from_email) : e.to}
                </span>
                <span className="text-[10px] text-gray-600 shrink-0">{fmtDate(e.created_at)}</span>
              </div>
              <p className={`text-xs truncate mt-0.5 ${e.read ? 'text-gray-500' : 'text-gray-300 font-semibold'}`}>{e.subject}</p>
              {e.scheduled_for && !e.cancelled && new Date(e.scheduled_for) > new Date() && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-400"><Clock className="w-3 h-3" /> Programado: {fmtDate(e.scheduled_for)}</span>
              )}
              {e.cancelled && <span className="inline-block mt-1 text-[10px] text-red-400 font-bold">CANCELADO</span>}
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

      {/* Modal Redactar */}
      {compose && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCompose(false)}>
          <div className="bg-[#0d1526] border border-white/[0.1] rounded-2xl w-full max-w-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-lg flex items-center gap-2"><PenSquare className="w-5 h-5 text-pink-400" /> {selected && form.subject.startsWith('Re:') ? 'Responder' : 'Nuevo correo'}</h3>
              <button onClick={() => setCompose(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
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
