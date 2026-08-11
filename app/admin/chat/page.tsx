'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessagesSquare, Search, Send, Loader2, RefreshCw, Trash2,
  Globe, Smartphone, Bot, User, ShieldCheck,
} from 'lucide-react';
import { useAdminAuth } from '../layout';

interface Conversation {
  id: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  last_message?: string;
  last_message_at?: string;
  unread_admin?: number;
  source?: string;
  is_guest?: boolean;
  chatbot_session_id?: string;
}

interface Message {
  id: string;
  sender_type: 'tenant' | 'admin' | 'ai';
  sender_name?: string;
  content?: string;
  created_at?: string;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function AdminChatPage() {
  const { headers } = useAdminAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'web' | 'app'>('all');
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  const fetchConvs = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/admin/conversations?source=${sourceFilter}`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      setConvs(data.conversations || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [sourceFilter, headers]);

  const fetchMessages = useCallback(async (convId: string, showSpinner = false) => {
    if (showSpinner) setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/chat/admin/messages/${convId}?limit=100`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* ignore */ }
    setLoadingMsgs(false);
  }, [headers]);

  // Poll conversations every 8s
  useEffect(() => {
    fetchConvs();
    const iv = setInterval(fetchConvs, 8000);
    return () => clearInterval(iv);
  }, [fetchConvs]);

  // Poll selected thread every 5s
  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.id, true);
    const iv = setInterval(() => {
      const cur = selectedRef.current;
      if (cur) fetchMessages(cur.id);
    }, 5000);
    return () => clearInterval(iv);
  }, [selected?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendReply = async () => {
    const content = reply.trim();
    if (!content || !selected || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat/admin/send', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ conversation_id: selected.id, content }),
      });
      if (res.ok) {
        setReply('');
        await fetchMessages(selected.id);
        fetchConvs();
      }
    } catch { /* ignore */ }
    setSending(false);
  };

  const hideConv = async (conv: Conversation) => {
    if (!window.confirm(`¿Ocultar la conversación con ${conv.tenant_name || 'este visitante'} de tu lista? (reaparece si escribe de nuevo)`)) return;
    try {
      await fetch(`/api/chat/admin/conversations/${conv.id}?delete_for_both=false`, {
        method: 'DELETE', headers: headers(),
      });
      if (selected?.id === conv.id) { setSelected(null); setMessages([]); }
      fetchConvs();
    } catch { /* ignore */ }
  };

  const filtered = convs.filter(c => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (c.tenant_name || '').toLowerCase().includes(s)
      || (c.tenant_email || '').toLowerCase().includes(s)
      || (c.last_message || '').toLowerCase().includes(s);
  });

  const totalUnread = convs.reduce((acc, c) => acc + (c.unread_admin || 0), 0);
  const webCount = convs.filter(c => c.source === 'web').length;

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center">
            <MessagesSquare className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Chat en Vivo</h2>
            <p className="text-sm text-gray-500">
              Conversaciones del chat web (Rossy) y la app móvil
              {totalUnread > 0 && <span className="ml-2 text-emerald-400 font-semibold">· {totalUnread} sin leer</span>}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchConvs(); }}
          className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white transition"
          aria-label="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4" style={{ minHeight: 560 }}>
        {/* ── Conversation list ── */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar nombre, email, mensaje..."
                className="w-full pl-9 pr-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-1">
              {([
                { key: 'all', label: `Todos (${convs.length})` },
                { key: 'web', label: `🌐 Web (${webCount})` },
                { key: 'app', label: `📱 App (${convs.length - webCount})` },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setSourceFilter(tab.key); setLoading(true); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition ${sourceFilter === tab.key ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/[0.03] text-gray-500 border border-transparent hover:text-gray-300'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm px-6">
                No hay conversaciones{q ? ' que coincidan con la búsqueda' : ' todavía'}.
              </div>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition group ${selected?.id === c.id ? 'bg-emerald-500/[0.06] border-l-2 border-l-emerald-500' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white truncate flex-1">
                    {c.tenant_name || 'Visitante'}
                  </span>
                  {c.source === 'web'
                    ? <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    : <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  {(c.unread_admin || 0) > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-[10px] text-white font-bold flex items-center justify-center shrink-0">
                      {c.unread_admin}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5 gap-2">
                  <span className="text-xs text-gray-500 truncate flex-1">{c.last_message || '—'}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(c.last_message_at)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Thread ── */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
              <MessagesSquare className="w-12 h-12 opacity-30" />
              <p className="text-sm">Selecciona una conversación para ver los mensajes</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 flex items-center justify-center text-emerald-300 font-bold text-sm">
                  {(selected.tenant_name || 'V')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{selected.tenant_name || 'Visitante'}</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {selected.source === 'web' ? '🌐 Chat web (Rossy)' : '📱 App móvil'}
                    {selected.tenant_email ? ` · ${selected.tenant_email}` : ''}
                    {selected.tenant_phone ? ` · ${selected.tenant_phone}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => hideConv(selected)}
                  className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  aria-label="Ocultar conversación"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 440 }}>
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-600 text-sm">Sin mensajes</div>
                ) : messages.map(m => {
                  const isAdmin = m.sender_type === 'admin';
                  const isAI = m.sender_type === 'ai';
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isAdmin
                          ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-50 rounded-tr-md'
                          : isAI
                            ? 'bg-violet-500/10 border border-violet-500/20 text-gray-200 rounded-tl-md'
                            : 'bg-white/[0.05] border border-white/[0.08] text-gray-200 rounded-tl-md'
                      }`}>
                        <div className={`text-[10px] font-bold mb-0.5 flex items-center gap-1 ${isAdmin ? 'text-emerald-400' : isAI ? 'text-violet-400' : 'text-gray-500'}`}>
                          {isAdmin ? <ShieldCheck className="w-3 h-3" /> : isAI ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {m.sender_name || (isAdmin ? 'Admin' : isAI ? 'Rossy (IA)' : 'Cliente')}
                          <span className="font-normal text-gray-600 ml-1">{timeAgo(m.created_at)}</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply box */}
              <div className="px-4 py-3 border-t border-white/[0.06] flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
                  }}
                  placeholder={selected.source === 'web' ? 'Responder al visitante (lo verá en el chat de la web)...' : 'Responder al cliente...'}
                  rows={1}
                  className="flex-1 px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none resize-none max-h-28"
                />
                <button
                  onClick={sendReply}
                  disabled={!reply.trim() || sending}
                  className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/[0.06] disabled:text-gray-600 text-white flex items-center justify-center transition shrink-0"
                  aria-label="Enviar"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
