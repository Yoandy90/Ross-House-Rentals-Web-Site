'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Mail, Send, Users, Trash2, RefreshCw, Search, Megaphone,
  CheckCircle2, XCircle, Clock, Sparkles,
} from 'lucide-react';
import DripPanel from '../../components/admin/DripPanel';
import NewsletterHealthPanel from '../../components/admin/NewsletterHealthPanel';

const AUDIENCES = [
  { v: 'newsletter', l: '📬 Suscriptores del newsletter' },
  { v: 'leads', l: '📝 Interesados (waitlist)' },
  { v: 'both', l: '🚀 Ambos (sin duplicados)' },
];

const SOURCE_LABEL: Record<string, string> = {
  modal: '💬 Modal', section: '📄 Sección', footer: '🦶 Footer', web: '🌐 Web',
};

export default function MarketingPage() {
  const { headers } = useAdminAuth();
  const [tab, setTab] = useState<'subs' | 'camps' | 'drip' | 'health'>('subs');
  const [subs, setSubs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [camps, setCamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [subTotal, setSubTotal] = useState(0);
  const SUBS_PER_PAGE = 50;

  // Campaign composer
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('newsletter');
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState('');

  const fetchSubs = useCallback(async () => {
    try {
      const p = new URLSearchParams({ limit: String(SUBS_PER_PAGE), skip: String((subPage - 1) * SUBS_PER_PAGE) });
      if (search) p.set('search', search);
      const res = await fetch(`/api/admin/newsletter/subscribers?${p}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setSubs(d.subscribers || []); setStats(d.stats || null);
        setSubTotal(d.filtered_total ?? (d.subscribers || []).length);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, search, subPage]);

  const fetchCamps = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/newsletter/campaigns', { headers: headers() });
      if (res.ok) { const d = await res.json(); setCamps(d.campaigns || []); }
    } catch (e) { console.error(e); }
  }, [headers]);

  useEffect(() => { fetchSubs(); fetchCamps(); }, [fetchSubs, fetchCamps]);

  const deleteSub = async (id: string) => {
    if (!confirm('¿Eliminar este suscriptor?')) return;
    await fetch(`/api/admin/newsletter/subscribers/${id}`, { method: 'DELETE', headers: headers() });
    fetchSubs();
  };

  const sendCampaign = async () => {
    if (!subject.trim() || !message.trim()) { alert('Asunto y mensaje son requeridos'); return; }
    const audLabel = AUDIENCES.find(a => a.v === audience)?.l || audience;
    if (!confirm(`¿Enviar la campaña "${subject}" a: ${audLabel}?`)) return;
    setSending(true); setSentMsg('');
    try {
      const res = await fetch('/api/admin/newsletter/campaigns', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ subject, message, audience }),
      });
      const d = await res.json();
      if (res.ok) {
        setSentMsg(d.message || 'Campaña en envío ✅');
        setSubject(''); setMessage('');
        setTimeout(fetchCamps, 3000);
      } else {
        alert(d.detail || 'Error enviando campaña');
      }
    } catch (e: any) { alert(e?.message || 'Error de red'); }
    setSending(false);
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/20 flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Marketing & Newsletter</h2>
            <p className="text-sm text-gray-500">Suscriptores del sitio público + campañas por email</p>
          </div>
        </div>
        <button onClick={() => { fetchSubs(); fetchCamps(); }} className="flex items-center gap-2 px-3 py-2 border border-white/[0.08] rounded-lg text-xs text-gray-400 hover:bg-white/[0.04] transition"><RefreshCw className="w-3.5 h-3.5" /> Refrescar</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Suscriptores', value: stats.total, color: 'text-cyan-400', Icon: Mail },
            { label: 'Activos', value: stats.active, color: 'text-emerald-400', Icon: CheckCircle2 },
            { label: 'Bajas', value: stats.unsubscribed, color: 'text-red-400', Icon: XCircle },
            { label: 'Interesados (waitlist)', value: stats.leads, color: 'text-violet-400', Icon: Users },
          ].map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1"><Icon className={`w-4 h-4 ${color}`} /><span className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</span></div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('subs')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'subs' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' : 'text-gray-500 border border-white/[0.06] hover:bg-white/[0.03]'}`}>📬 Suscriptores</button>
        <button onClick={() => setTab('camps')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'camps' ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30' : 'text-gray-500 border border-white/[0.06] hover:bg-white/[0.03]'}`}>📣 Campañas</button>
        <button onClick={() => setTab('drip')} data-testid="tab-drip" className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'drip' ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30' : 'text-gray-500 border border-white/[0.06] hover:bg-white/[0.03]'}`}>🤖 Drip AI & Blog</button>
        <button onClick={() => setTab('health')} data-testid="tab-health" className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === 'health' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 border border-white/[0.06] hover:bg-white/[0.03]'}`}>📊 Salud de la lista</button>
      </div>

      {tab === 'health' && <NewsletterHealthPanel headers={headers} />}

      {tab === 'drip' && <DripPanel headers={headers} />}

      {tab === 'subs' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text" value={search} onChange={e => { setSearch(e.target.value); setSubPage(1); }}
              placeholder="Buscar por email o nombre..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#0C1220]/60 border border-white/[0.08] rounded-xl text-sm text-white focus:border-cyan-500 focus:outline-none placeholder:text-gray-600"
            />
          </div>

          {subs.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl">
              <Mail className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Aún no hay suscriptores</p>
              <p className="text-gray-600 text-xs mt-1">Se registran desde la sección de noticias y el modal del sitio público</p>
            </div>
          ) : (
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider hidden sm:table-cell">Fuente</th>
                      <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                      <th className="px-4 py-3 text-[11px] text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s: any) => (
                      <tr key={s._id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{s.email}</div>
                          {s.name && <div className="text-[11px] text-gray-500">{s.name}</div>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">{SOURCE_LABEL[s.source] || s.source || '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">{fmtDate(s.created_at)}</td>
                        <td className="px-4 py-3">
                          {s.unsubscribed
                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold">BAJA</span>
                            : <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">ACTIVO</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => deleteSub(s._id)} className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {subTotal > SUBS_PER_PAGE && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Mostrando {(subPage - 1) * SUBS_PER_PAGE + 1}–{Math.min(subPage * SUBS_PER_PAGE, subTotal)} de {subTotal}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSubPage(p => Math.max(1, p - 1))} disabled={subPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] disabled:opacity-30 transition">← Anterior</button>
                <span className="text-xs text-gray-400 font-bold">{subPage} / {Math.ceil(subTotal / SUBS_PER_PAGE)}</span>
                <button onClick={() => setSubPage(p => Math.min(Math.ceil(subTotal / SUBS_PER_PAGE), p + 1))} disabled={subPage >= Math.ceil(subTotal / SUBS_PER_PAGE)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] text-gray-400 hover:bg-white/[0.04] disabled:opacity-30 transition">Siguiente →</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'camps' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Composer */}
          <div className="bg-white/[0.03] border border-pink-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-bold text-white">Nueva campaña</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Audiencia</label>
                <select value={audience} onChange={e => setAudience(e.target.value)} className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none">
                  {AUDIENCES.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Asunto</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="🏡 Nueva casa disponible en Dumas..." className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none placeholder:text-gray-600" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Mensaje</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Escribe tu mensaje... (los saltos de línea se respetan en el email)" className="w-full px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none h-36 resize-none placeholder:text-gray-600" />
              </div>
              <button onClick={sendCampaign} disabled={sending || !subject.trim() || !message.trim()} className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-30 shadow-[0_0_15px_rgba(236,72,153,0.25)]">
                {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar campaña
              </button>
              {sentMsg && <p className="text-emerald-400 text-xs text-center font-medium">{sentMsg}</p>}
              <p className="text-[10px] text-gray-600 text-center">Cada email incluye link de baja automático (suscriptores) y el branding de Ross House Rentals.</p>
            </div>
          </div>

          {/* History */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">📜 Historial de campañas</h3>
            {camps.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-8">Sin campañas enviadas aún</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {camps.map((c: any) => (
                  <div key={c._id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{c.subject}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{fmtDate(c.created_at)} · {AUDIENCES.find(a => a.v === c.audience)?.l || c.audience}</div>
                      </div>
                      {c.status === 'sending'
                        ? <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold shrink-0"><Clock className="w-3 h-3" /> ENVIANDO</span>
                        : c.status === 'failed'
                          ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold shrink-0">FALLÓ</span>
                          : <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">✓ {c.sent}/{c.total_recipients}</span>}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">{c.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
