'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  MessageSquare, Send, Users, Phone, Mail, Clock, CheckCircle2,
  Search, FileText, Loader2, AlertTriangle, Inbox, Smartphone,
  Plus, Pencil, Trash2, X, Save, Tag, CreditCard, Wrench, Home,
  AlertCircle, PartyPopper, ClipboardCheck, Settings2,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────── */
interface Tenant { _id: string; name: string; phone?: string; email?: string; property_name?: string; property_address?: string; }
interface Template { _id: string; name: string; subject: string; message: string; channel: string; category?: string; }
interface HistoryItem { _id: string; channel: string; subject: string; message: string; recipient_count: number; sent: number; failed: number; created_at: string; }

type Channel = 'sms' | 'email' | 'both';
type Tab = 'compose' | 'templates' | 'history';

const CHANNEL_CONFIG: Record<Channel, { label: string; icon: any; color: string; bg: string; border: string }> = {
  sms:   { label: 'SMS',          icon: Smartphone, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  email: { label: 'Email',        icon: Mail,       color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  both:  { label: 'SMS + Email',  icon: Send,       color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20' },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pagos:         { label: 'Pagos',         icon: CreditCard,     color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  mantenimiento: { label: 'Mantenimiento', icon: Wrench,         color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  contratos:     { label: 'Contratos',     icon: FileText,       color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  inspecciones:  { label: 'Inspecciones',  icon: ClipboardCheck, color: 'text-lime-400',    bg: 'bg-lime-500/10' },
  emergencia:    { label: 'Emergencia',    icon: AlertCircle,    color: 'text-red-400',     bg: 'bg-red-500/10' },
  general:       { label: 'General',       icon: Home,           color: 'text-gray-400',    bg: 'bg-gray-500/10' },
};

export default function MensajesPage() {
  const { headers } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>('compose');

  /* ─── State ──────────────────────────────────────────────── */
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  // Compose form
  const [channel, setChannel] = useState<Channel>('both');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Template editor
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', message: '', channel: 'both', category: 'general' });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  /* ─── Fetch Data ─────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    try {
      const [tRes, tmplRes, hRes] = await Promise.all([
        fetch('/api/admin/tenants', { headers: headers() }),
        fetch('/api/admin/message-templates', { headers: headers() }),
        fetch('/api/admin/message-history', { headers: headers() }),
      ]);
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.tenants || []); }
      if (tmplRes.ok) { const d = await tmplRes.json(); setTemplates(d.templates || []); }
      if (hRes.ok) { const d = await hRes.json(); setHistory(d.messages || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── Tenant helpers ───────────────────────────────────────── */
  const filteredTenants = tenants.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) ||
      (t.phone || '').includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.property_name || t.property_address || '').toLowerCase().includes(q);
  });

  const toggleTenant = (id: string) => {
    const next = new Set(selectedTenants);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTenants(next);
  };

  const selectAll = () => {
    if (selectedTenants.size === filteredTenants.length) setSelectedTenants(new Set());
    else setSelectedTenants(new Set(filteredTenants.map(t => t._id)));
  };

  const applyTemplate = (tmpl: Template) => {
    setSubject(tmpl.subject);
    setMessage(tmpl.message);
    if (tmpl.channel === 'sms' || tmpl.channel === 'email' || tmpl.channel === 'both') {
      setChannel(tmpl.channel as Channel);
    }
    setActiveTab('compose');
  };

  /* ─── Send ───────────────────────────────────────────────── */
  const sendMessage = async () => {
    if (!message.trim() || selectedTenants.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const recipients = tenants
        .filter(t => selectedTenants.has(t._id))
        .map(t => ({ name: t.name, phone: t.phone, email: t.email }));

      const res = await fetch('/api/admin/send-message', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ recipients, channel, subject, message }),
      });
      const data = await res.json();
      setResult({ sent: data.sent || 0, failed: data.failed || 0, errors: data.errors || [] });
      const hRes = await fetch('/api/admin/message-history', { headers: headers() });
      if (hRes.ok) { const d = await hRes.json(); setHistory(d.messages || []); }
    } catch (e: any) {
      setResult({ sent: 0, failed: selectedTenants.size, errors: [e.message] });
    }
    setSending(false);
  };

  /* ─── Template CRUD ──────────────────────────────────────── */
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', subject: '', message: '', channel: 'both', category: 'general' });
    setShowTemplateForm(true);
  };

  const openEditTemplate = (tmpl: Template) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      name: tmpl.name, subject: tmpl.subject, message: tmpl.message,
      channel: tmpl.channel || 'both', category: tmpl.category || 'general',
    });
    setShowTemplateForm(true);
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.message.trim()) return;
    setSavingTemplate(true);
    try {
      if (editingTemplate) {
        await fetch(`/api/admin/message-templates/${editingTemplate._id}`, {
          method: 'PUT', headers: headers(), body: JSON.stringify(templateForm),
        });
      } else {
        await fetch('/api/admin/message-templates', {
          method: 'POST', headers: headers(), body: JSON.stringify(templateForm),
        });
      }
      setShowTemplateForm(false);
      const tmplRes = await fetch('/api/admin/message-templates', { headers: headers() });
      if (tmplRes.ok) { const d = await tmplRes.json(); setTemplates(d.templates || []); }
    } catch (e) { console.error(e); }
    setSavingTemplate(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    try {
      await fetch(`/api/admin/message-templates/${id}`, { method: 'DELETE', headers: headers() });
      setTemplates(templates.filter(t => t._id !== id));
    } catch (e) { console.error(e); }
  };

  const filteredTemplates = templates.filter(t =>
    categoryFilter === 'all' || (t.category || 'general') === categoryFilter
  );

  /* ─── Render ─────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-pink-500/30 border-t-pink-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-pink-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-500/5 border border-pink-500/20 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Mensajes</h2>
            <p className="text-sm text-gray-500">SMS y emails masivos a inquilinos y propietarios</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Inquilinos" value={tenants.length} color="violet" icon={Users} />
        <StatCard label="Plantillas" value={templates.length} color="pink" icon={FileText} />
        <StatCard label="Mensajes Enviados" value={history.reduce((a: number, h: HistoryItem) => a + h.sent, 0)} color="emerald" icon={Send} />
        <StatCard label="Campañas" value={history.length} color="blue" icon={Inbox} />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
        {([
          { key: 'compose' as Tab, label: 'Componer', icon: Send },
          { key: 'templates' as Tab, label: `Plantillas (${templates.length})`, icon: FileText },
          { key: 'history' as Tab, label: `Historial (${history.length})`, icon: Clock },
        ]).map(tab => {
          const TIcon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition ${
                activeTab === tab.key
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/25'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}>
              <TIcon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ COMPOSE TAB ═══════════════════════════════════════ */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: Recipients */}
          <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col" style={{ maxHeight: '600px' }}>
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-bold text-white">Destinatarios</h3>
                  {selectedTenants.size > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-bold">{selectedTenants.size}</span>
                  )}
                </div>
                <button onClick={selectAll} className="text-[11px] text-pink-400 hover:text-pink-300 font-bold transition">
                  {selectedTenants.size === filteredTenants.length && filteredTenants.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none"
                  placeholder="Buscar inquilino..." />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
              {filteredTenants.length === 0 ? (
                <div className="p-6 text-center text-gray-600 text-sm">No se encontraron inquilinos</div>
              ) : filteredTenants.map(t => {
                const selected = selectedTenants.has(t._id);
                return (
                  <div key={t._id} onClick={() => toggleTenant(t._id)}
                    className={`p-3 flex items-center gap-3 cursor-pointer transition hover:bg-white/[0.03] ${selected ? 'bg-pink-500/[0.05]' : ''}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                      selected ? 'bg-pink-500 border-pink-500' : 'border-gray-600 hover:border-gray-500'}`}>
                      {selected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{t.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        {t.phone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{t.phone}</span>}
                        {t.email && <span className="flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{t.email}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-600 truncate max-w-[100px]">{t.property_name || t.property_address || ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Compose */}
          <div className="lg:col-span-3 space-y-4">
            {/* Channel Selector */}
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4">
              <p className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Canal de envío</p>
              <div className="flex gap-2">
                {(Object.entries(CHANNEL_CONFIG) as [Channel, typeof CHANNEL_CONFIG['sms']][]).map(([key, cfg]) => {
                  const CIcon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setChannel(key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition ${
                        channel === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                      <CIcon className="w-4 h-4" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Templates */}
            {templates.length > 0 && (
              <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plantillas rápidas</p>
                  <button onClick={() => setActiveTab('templates')} className="text-[10px] text-pink-400 hover:text-pink-300 font-bold">
                    Ver todas →
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {templates.slice(0, 6).map(tmpl => {
                    const cat = CATEGORY_CONFIG[tmpl.category || 'general'] || CATEGORY_CONFIG.general;
                    const CatIcon = cat.icon;
                    return (
                      <button key={tmpl._id} onClick={() => applyTemplate(tmpl)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white transition">
                        <CatIcon className={`w-3 h-3 ${cat.color}`} /> {tmpl.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Form */}
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4 space-y-4">
              {(channel === 'email' || channel === 'both') && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Asunto</label>
                  <input value={subject} onChange={e => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none"
                    placeholder="Asunto del email..." />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Mensaje</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                  className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none resize-none leading-relaxed"
                  placeholder="Escribe tu mensaje aquí..." />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-600">{message.length} caracteres</span>
                  {message.length > 160 && (channel === 'sms' || channel === 'both') && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> SMS largo ({Math.ceil(message.length / 160)} partes)
                    </span>
                  )}
                </div>
              </div>

              {/* Result */}
              {result && (
                <div className={`p-4 rounded-xl border ${result.failed > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {result.failed > 0
                      ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                      : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span className="text-sm font-bold text-white">
                      {result.sent} enviados {result.failed > 0 && `/ ${result.failed} fallidos`}
                    </span>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-[11px] text-amber-400/80">• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Send */}
              <button onClick={sendMessage} disabled={sending || !message.trim() || selectedTenants.size === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-pink-600 to-pink-500 text-white rounded-xl font-bold text-sm hover:opacity-90 transition disabled:opacity-30 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  : <><Send className="w-4 h-4" /> Enviar a {selectedTenants.size} inquilino{selectedTenants.size !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TEMPLATES TAB ═════════════════════════════════════ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Category Filter + Add Button */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06] flex-wrap">
              <button onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  categoryFilter === 'all' ? 'bg-pink-500/15 text-pink-400 border border-pink-500/25' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
                Todas ({templates.length})
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                const count = templates.filter(t => (t.category || 'general') === key).length;
                if (count === 0) return null;
                const CIcon = cfg.icon;
                return (
                  <button key={key} onClick={() => setCategoryFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1 ${
                      categoryFilter === key ? `${cfg.bg} ${cfg.color} border border-current/25` : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
                    <CIcon className="w-3 h-3" /> {cfg.label} ({count})
                  </button>
                );
              })}
            </div>
            <button onClick={openCreateTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-pink-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_15px_rgba(236,72,153,0.2)]">
              <Plus className="w-4 h-4" /> Nueva Plantilla
            </button>
          </div>

          {/* Templates Grid */}
          {filteredTemplates.length === 0 ? (
            <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No hay plantillas en esta categoría</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredTemplates.map(tmpl => {
                const cat = CATEGORY_CONFIG[tmpl.category || 'general'] || CATEGORY_CONFIG.general;
                const ch = CHANNEL_CONFIG[(tmpl.channel || 'both') as Channel] || CHANNEL_CONFIG.both;
                const CatIcon = cat.icon;
                const ChIcon = ch.icon;
                return (
                  <div key={tmpl._id} className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition group">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                          <CatIcon className={`w-4 h-4 ${cat.color}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{tmpl.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${cat.bg} ${cat.color}`}>{cat.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${ch.bg} ${ch.color} flex items-center gap-0.5`}>
                              <ChIcon className="w-2.5 h-2.5" />{ch.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEditTemplate(tmpl)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-blue-400 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteTemplate(tmpl._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Subject */}
                    {tmpl.subject && (
                      <p className="text-[11px] text-gray-400 font-medium mb-1 truncate">📧 {tmpl.subject}</p>
                    )}

                    {/* Message preview */}
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 mb-3">{tmpl.message}</p>

                    {/* Use button */}
                    <button onClick={() => applyTemplate(tmpl)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-pink-500/10 border border-pink-500/20 rounded-xl text-pink-400 text-xs font-bold hover:bg-pink-500/20 transition">
                      <Send className="w-3 h-3" /> Usar Plantilla
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ HISTORY TAB ═══════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
            <Clock className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-bold text-white">Historial de Campañas</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-gray-400">{history.length}</span>
          </div>
          {history.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No hay mensajes enviados aún</p>
              <p className="text-xs text-gray-600 mt-1">Los mensajes enviados aparecerán aquí</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {history.map(h => {
                const ch = CHANNEL_CONFIG[h.channel as Channel] || CHANNEL_CONFIG.sms;
                const ChIcon = ch.icon;
                const allSent = h.failed === 0 && h.sent > 0;
                return (
                  <div key={h._id} className="p-4 hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-10 rounded-xl ${ch.bg} ${ch.border} border flex items-center justify-center`}>
                        <ChIcon className={`w-5 h-5 ${ch.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{h.subject || 'Mensaje directo'}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ch.bg} ${ch.color}`}>{ch.label}</span>
                          {allSent && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400">✓ Enviado</span>}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>{h.created_at ? new Date(h.created_at).toLocaleString('es-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {h.recipient_count} destinatario{h.recipient_count !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span className="text-emerald-400">{h.sent} enviados</span>
                          {h.failed > 0 && <><span>•</span><span className="text-red-400">{h.failed} fallidos</span></>}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 ml-[52px] line-clamp-2">{h.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Template Form Modal ═══════════════════════════════ */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateForm(false)}>
          <div className="bg-[#0c1220] rounded-2xl border border-white/[0.08] w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
              <button onClick={() => setShowTemplateForm(false)} className="text-gray-500 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Nombre</label>
              <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none"
                placeholder="Ej: Recordatorio de Pago" />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Categoría</label>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const CIcon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setTemplateForm({ ...templateForm, category: key })}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                        templateForm.category === key ? `${cfg.bg} ${cfg.color} border-current/25` : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                      <CIcon className="w-3 h-3" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Canal</label>
              <div className="flex gap-2">
                {(Object.entries(CHANNEL_CONFIG) as [Channel, typeof CHANNEL_CONFIG['sms']][]).map(([key, cfg]) => {
                  const CIcon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setTemplateForm({ ...templateForm, channel: key })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition ${
                        templateForm.channel === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'}`}>
                      <CIcon className="w-3.5 h-3.5" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Asunto (Email)</label>
              <input value={templateForm.subject} onChange={e => setTemplateForm({ ...templateForm, subject: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none"
                placeholder="Asunto del email..." />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Mensaje</label>
              <textarea value={templateForm.message} onChange={e => setTemplateForm({ ...templateForm, message: e.target.value })} rows={4}
                className="w-full px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-pink-500 focus:outline-none resize-none"
                placeholder="Contenido del mensaje..." />
              <span className="text-[10px] text-gray-600">{templateForm.message.length} caracteres</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTemplateForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-400 text-sm font-bold hover:bg-white/[0.03] transition">
                Cancelar
              </button>
              <button onClick={saveTemplate} disabled={savingTemplate || !templateForm.name.trim() || !templateForm.message.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-pink-600 to-pink-500 text-white rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-30">
                {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────── */
function StatCard({ label, value, color, icon: Icon, alert }: { label: string; value: number; color: string; icon: any; alert?: boolean }) {
  return (
    <div className={`bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3 ${alert ? 'border-pink-500/20' : ''}`}>
      <div className={`w-9 h-9 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-400`} />
      </div>
      <div>
        <div className={`text-lg font-bold ${alert ? 'text-pink-400' : 'text-white'}`}>{value}</div>
        <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
