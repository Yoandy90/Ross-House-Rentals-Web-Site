'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Brain, Send, Plus, Trash2, MessageSquare, Loader2, Sparkles,
  Mail, Megaphone, RefreshCw, ChevronRight, Copy, Check, X,
  Zap, CheckCircle2, XCircle, AlertTriangle, Clock,
} from 'lucide-react';

interface Conversation {
  _id: string;
  title: string;
  last_message: string;
  updated_at: string;
  message_count?: number;
}

interface Message {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const QUICK_PROMPTS = [
  { emoji: '📊', text: 'Resumen ejecutivo del mes' },
  { emoji: '💰', text: '¿Quién no ha pagado todavía?' },
  { emoji: '🔥', text: 'Top 3 leads más calientes' },
  { emoji: '📅', text: '¿Qué contratos vencen pronto?' },
  { emoji: '🏠', text: '¿Qué propiedades están vacías?' },
  { emoji: '💡', text: 'Dame 3 ideas para crecer este mes' },
];

// Simple markdown renderer (no external deps)
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  const flushList = (idx: number) => {
    if (listItems.length === 0) return;
    const items = listItems.map((it, i) => (
      <li key={`li-${idx}-${i}`} className="ml-5 mb-1.5" dangerouslySetInnerHTML={{ __html: inlineFormat(it) }} />
    ));
    out.push(inList === 'ul'
      ? <ul key={`ul-${idx}`} className="list-disc my-2">{items}</ul>
      : <ol key={`ol-${idx}`} className="list-decimal my-2">{items}</ol>
    );
    listItems = [];
    inList = null;
  };

  function inlineFormat(s: string): string {
    return s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-white/[0.06] px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  }

  lines.forEach((line, idx) => {
    const ul = line.match(/^[\s]*[-*]\s+(.+)$/);
    const ol = line.match(/^[\s]*\d+\.\s+(.+)$/);
    const h = line.match(/^(#+)\s+(.+)$/);

    if (ul) {
      if (inList !== 'ul') flushList(idx);
      inList = 'ul';
      listItems.push(ul[1]);
    } else if (ol) {
      if (inList !== 'ol') flushList(idx);
      inList = 'ol';
      listItems.push(ol[1]);
    } else {
      flushList(idx);
      if (h) {
        const level = h[1].length;
        const Tag = (`h${Math.min(level + 1, 6)}`) as keyof JSX.IntrinsicElements;
        const sizes: Record<string, string> = { h2: 'text-xl', h3: 'text-lg', h4: 'text-base', h5: 'text-sm', h6: 'text-xs' };
        out.push(<Tag key={`h-${idx}`} className={`font-bold mt-3 mb-1 ${sizes[Tag] || 'text-base'}`} dangerouslySetInnerHTML={{ __html: inlineFormat(h[2]) }} />);
      } else if (line.trim()) {
        out.push(<p key={`p-${idx}`} className="mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
      } else {
        out.push(<div key={`br-${idx}`} className="h-2" />);
      }
    }
  });
  flushList(lines.length);
  return out;
}

export default function AIBrainPage() {
  const { token } = useAdminAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showMarketing, setShowMarketing] = useState(false);
  const [briefingSending, setBriefingSending] = useState(false);
  const [briefingResult, setBriefingResult] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const authHeaders = useCallback((): HeadersInit => ({
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
  }), [token]);

  // Load pending actions queue (Phase 2 — AI Write permissions)
  const loadPendingActions = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/ai-brain/pending-actions?status=pending', { headers: authHeaders() });
      const data = await res.json();
      setPendingActions(data.actions || []);
    } catch (e) { console.error(e); }
  }, [token, authHeaders]);

  useEffect(() => {
    loadPendingActions();
    const id = setInterval(loadPendingActions, 30000);
    return () => clearInterval(id);
  }, [loadPendingActions]);

  const approveAction = async (actionId: string) => {
    setActionsLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-brain/pending-actions/${actionId}/approve`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      const status = data.action?.status;
      if (status === 'failed') {
        alert(`⚠️ Acción ejecutada con error: ${data.action?.error || 'sin detalle'}`);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    await loadPendingActions();
    setActionsLoading(false);
  };

  const rejectAction = async (actionId: string) => {
    const reason = prompt('Motivo del rechazo (opcional):') || '';
    setActionsLoading(true);
    try {
      await fetch(`/api/admin/ai-brain/pending-actions/${actionId}/reject`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ reason }),
      });
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    await loadPendingActions();
    setActionsLoading(false);
  };

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/ai-brain/conversations', { headers: authHeaders() });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e) { console.error(e); }
  }, [token, authHeaders]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load specific conversation
  const loadConversation = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/ai-brain/conversations/${id}`, { headers: authHeaders() });
      const data = await res.json();
      setMessages(data.messages || []);
      setCurrentId(id);
    } catch (e) { console.error(e); }
  };

  // Delete conversation
  const deleteConversation = async (id: string) => {
    if (!confirm('¿Eliminar esta conversación? No se puede deshacer.')) return;
    await fetch(`/api/admin/ai-brain/conversations/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (currentId === id) { setCurrentId(null); setMessages([]); }
    loadConversations();
  };

  // Send message with streaming
  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput('');

    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/admin/ai-brain/chat', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ message: msg, conversation_id: currentId }),
      });
      if (!res.ok || !res.body) throw new Error('No response');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'meta' && data.conversation_id) {
              setCurrentId(data.conversation_id);
            } else if (data.type === 'delta') {
              assistantText += data.content;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            } else if (data.type === 'error') {
              assistantText = `❌ ${data.message}`;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            } else if (data.type === 'actions_proposed') {
              loadPendingActions();
            }
          } catch (_) { /* ignore */ }
        }
      }
      loadConversations();
    } catch (e: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `❌ Error: ${e.message}` };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  // Trigger daily briefing manually
  const sendBriefing = async () => {
    setBriefingSending(true);
    setBriefingResult(null);
    try {
      const res = await fetch('/api/admin/ai-brain/briefing/send', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) setBriefingResult(`✅ Briefing enviado a ${data.recipient}`);
      else setBriefingResult(`❌ No se pudo enviar`);
    } catch (e: any) {
      setBriefingResult(`❌ ${e.message}`);
    } finally {
      setBriefingSending(false);
      setTimeout(() => setBriefingResult(null), 8000);
    }
  };

  const newChat = () => {
    setCurrentId(null);
    setMessages([]);
  };

  return (
    <div className="min-h-[100dvh] bg-[#060910] flex">
      {/* Mobile sidebar backdrop */}
      {showSidebar && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* SIDEBAR — full drawer on mobile, docked on desktop */}
      <aside className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        fixed lg:static top-0 left-0 z-40 h-[100dvh]
        w-[85vw] max-w-[320px] lg:w-72
        bg-[#0c1222] border-r border-white/[0.08] flex flex-col
        transition-transform duration-300 ease-out
        shadow-2xl lg:shadow-none
      `}>
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
          <button
            onClick={newChat}
            className="flex-1 flex items-center justify-center gap-2 bg-charcoal hover:bg-primary text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition"
          >
            <Plus className="w-4 h-4" /> Nueva
          </button>
          <button
            onClick={() => setShowSidebar(false)}
            className="lg:hidden p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center text-gray-400 text-sm p-6">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Aún no tienes conversaciones
            </div>
          ) : conversations.map(c => (
            <div key={c._id} className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg cursor-pointer mb-1 ${currentId === c._id ? 'bg-primary/10' : 'active:bg-white/[0.08] lg:hover:bg-[#060910]'}`} onClick={() => { loadConversation(c._id); if (window.innerWidth < 1024) setShowSidebar(false); }}>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${currentId === c._id ? 'text-primary' : 'text-slate-100'}`}>{c.title || 'Sin título'}</div>
                <div className="text-xs text-gray-400 truncate">{c.last_message}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteConversation(c._id); }} className="lg:opacity-0 lg:group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-white/[0.06] space-y-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <button onClick={sendBriefing} disabled={briefingSending} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-100 hover:bg-[#060910] active:bg-white/[0.08] transition disabled:opacity-50">
            {briefingSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 text-amber-600" />}
            <span>Enviar briefing diario</span>
          </button>
          {briefingResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${briefingResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-500/10 text-red-700'}`}>{briefingResult}</div>
          )}
          <button onClick={() => { setShowMarketing(true); if (window.innerWidth < 1024) setShowSidebar(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-100 hover:bg-[#060910] active:bg-white/[0.08] transition">
            <Megaphone className="w-4 h-4 text-blue-600" />
            <span>Generar marketing</span>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        {/* Header — compact on mobile */}
        <header className="bg-[#0c1222] border-b border-white/[0.08] px-3 lg:px-6 py-2.5 lg:py-4 flex items-center justify-between sticky top-14 lg:top-0 z-20">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg hover:bg-white/[0.06] active:bg-white/[0.1] transition"
              aria-label="Menú"
            >
              <MessageSquare className="w-5 h-5 text-slate-100 lg:hidden" />
              <ChevronRight className={`w-4 h-4 hidden lg:block transition-transform ${showSidebar ? 'rotate-180' : ''}`} />
            </button>
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-charcoal to-primary flex items-center justify-center shrink-0">
              <Brain className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base lg:text-xl font-bold text-slate-100 leading-tight truncate">AI Brain</h1>
              <p className="text-[10px] lg:text-xs text-slate-400 leading-tight truncate">Copiloto · Claude Sonnet 4.5</p>
            </div>
          </div>
          <a href="/admin" className="text-xs lg:text-sm text-slate-400 hover:text-primary shrink-0 ml-2 whitespace-nowrap">← Admin</a>
        </header>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto px-3 lg:px-6 py-4 lg:py-6">
          {pendingActions.length > 0 && (
            <PendingActionsBanner
              actions={pendingActions}
              onApprove={approveAction}
              onReject={rejectAction}
              loading={actionsLoading}
            />
          )}
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto pt-6 lg:pt-12">
              <div className="text-center mb-6 lg:mb-10 px-2">
                <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-charcoal to-primary flex items-center justify-center mx-auto mb-3 lg:mb-4">
                  <Sparkles className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
                </div>
                <h2 className="font-display text-2xl lg:text-3xl font-bold text-slate-100 mb-1.5 lg:mb-2">¡Hola Yoandy!</h2>
                <p className="text-sm lg:text-base text-slate-400">Pregúntame lo que quieras sobre tu negocio.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 lg:gap-3">
                {QUICK_PROMPTS.map((p, i) => (
                  <button key={i} onClick={() => sendMessage(p.text)} className="text-left p-3.5 lg:p-4 bg-[#0c1222] border border-white/[0.08] hover:border-primary hover:shadow-md active:scale-[0.98] rounded-xl transition group min-h-[64px] flex items-center gap-3 lg:block">
                    <div className="text-2xl lg:mb-1 shrink-0">{p.emoji}</div>
                    <div className="text-sm font-medium text-slate-100 group-hover:text-primary leading-snug">{p.text}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4 lg:space-y-6">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input — sticky bottom w/ iOS safe area */}
        <footer className="bg-[#0c1222] border-t border-white/[0.08] px-3 lg:px-6 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:py-4">
          <div className="max-w-3xl mx-auto flex items-end gap-2 lg:gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 1024) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Pregúntame algo sobre tu negocio…"
              rows={1}
              className="flex-1 px-3.5 lg:px-4 py-3 rounded-xl border border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none text-[15px] lg:text-sm max-h-32 leading-relaxed"
              disabled={sending}
              enterKeyHint="send"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || sending}
              className="bg-primary hover:bg-primary-dark disabled:bg-white/[0.15] disabled:cursor-not-allowed text-white p-3 rounded-xl transition shrink-0 active:scale-95"
              aria-label="Enviar"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] lg:text-xs text-center text-gray-400 mt-1.5 lg:mt-2 max-w-3xl mx-auto hidden sm:block">
            AI Brain puede cometer errores. Verifica info crítica antes de tomar decisiones.
          </p>
        </footer>
      </main>

      {showMarketing && <MarketingModal onClose={() => setShowMarketing(false)} authHeaders={authHeaders} />}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-white rounded-2xl rounded-tr-md px-4 lg:px-5 py-2.5 lg:py-3 max-w-[85%] lg:max-w-[80%]">
          <div className="whitespace-pre-wrap text-[15px] lg:text-sm leading-relaxed break-words">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 lg:gap-3 group">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-charcoal to-primary flex items-center justify-center flex-shrink-0">
        <Brain className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[#0c1222] border border-white/[0.08] rounded-2xl rounded-tl-md px-4 lg:px-5 py-3 lg:py-4 text-[15px] lg:text-sm text-slate-100 break-words">
          {message.content ? renderMarkdown(message.content) : <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        {message.content && (
          <button onClick={copy} className="mt-1 ml-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 text-xs text-gray-400 active:text-primary hover:text-primary flex items-center gap-1 transition py-1">
            {copied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
          </button>
        )}
      </div>
    </div>
  );
}

function MarketingModal({ onClose, authHeaders }: { onClose: () => void; authHeaders: () => HeadersInit }) {
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [tone, setTone] = useState('warm_professional');
  const [channels, setChannels] = useState<string[]>(['facebook_es', 'facebook_en', 'zillow', 'waitlist_email']);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch('/api/public/properties').then(r => r.json()).then(d => setProperties(d.properties || []));
  }, []);

  const generate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/ai-brain/marketing/generate', {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ property_id: selectedId, channels, tone }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const toggleChannel = (c: string) => {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0c1222] rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0c1222] border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-slate-100">Generador de Marketing</h2>
              <p className="text-xs text-slate-400">AI escribe copy para múltiples canales</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.06]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-100 mb-2">Propiedad</label>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-primary text-sm">
              <option value="">Selecciona una propiedad...</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.address}, {p.city} — ${p.rent_amount}/mes ({p.status})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-100 mb-2">Tono</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { v: 'warm_professional', l: 'Cálido pro' },
                { v: 'casual', l: 'Casual' },
                { v: 'luxury', l: 'Lujo' },
                { v: 'family_oriented', l: 'Familiar' },
              ].map(t => (
                <button key={t.v} onClick={() => setTone(t.v)} className={`px-3 py-2 rounded-lg text-sm font-medium transition ${tone === t.v ? 'bg-primary text-white' : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.09]'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-100 mb-2">Canales</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'facebook_es', l: '📘 Facebook ES' },
                { v: 'facebook_en', l: '📘 Facebook EN' },
                { v: 'instagram', l: '📷 Instagram' },
                { v: 'zillow', l: '🏠 Zillow' },
                { v: 'craigslist', l: '📋 Craigslist' },
                { v: 'waitlist_email', l: '✉️ Email Waitlist' },
              ].map(c => (
                <button key={c.v} onClick={() => toggleChannel(c.v)} className={`px-3 py-2 rounded-lg text-sm font-medium transition text-left ${channels.includes(c.v) ? 'bg-primary/10 text-primary border-2 border-primary' : 'bg-[#060910] border-2 border-transparent text-slate-300 hover:bg-white/[0.06]'}`}>
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generate} disabled={!selectedId || channels.length === 0 || generating} className="w-full bg-primary hover:bg-primary-dark disabled:bg-white/[0.15] disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> : <><Sparkles className="w-4 h-4" /> Generar contenido</>}
          </button>

          {result && result.content && (
            <div className="space-y-3">
              {Object.entries(result.content).map(([channel, text]: [string, any]) => (
                <div key={channel} className="bg-[#060910] rounded-xl p-4 border border-white/[0.08]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-100 text-sm uppercase">{channel.replace('_', ' ')}</span>
                    <button onClick={() => copyToClipboard(String(text))} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans">{String(text)}</pre>
                </div>
              ))}
            </div>
          )}
          {result?.error && (
            <div className="text-red-600 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">{result.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────────────────────
// PendingActionsBanner — Phase 2 AI Write/Execution Permissions
// ──────────────────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  send_email_to_lead:     { label: 'Enviar email al lead',     emoji: '📧', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  update_lead_status:     { label: 'Cambiar estado del lead',  emoji: '🔄', color: 'bg-amber-500/10 border-amber-500/25 text-amber-700' },
  add_lead_note:          { label: 'Agregar nota al lead',     emoji: '📝', color: 'bg-violet-50 border-violet-200 text-violet-700' },
  update_lead_priority:   { label: 'Cambiar prioridad',        emoji: '⚡', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  notify_property_match:  { label: 'Notificar propiedad',      emoji: '🏡', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  rescore_lead:           { label: 'Recomputar score',         emoji: '🧠', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  send_briefing_now:      { label: 'Enviar briefing diario',   emoji: '☕', color: 'bg-[#0c1222] border-white/[0.08] text-slate-300' },
};

function PendingActionsBanner({
  actions, onApprove, onReject, loading,
}: {
  actions: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  loading: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto mb-6">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/100 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-amber-900 text-sm flex items-center gap-2">
              Acciones propuestas por la IA
              <span className="bg-amber-500/100 text-white text-[10px] px-1.5 py-0.5 rounded-full">{actions.length}</span>
            </div>
            <div className="text-xs text-amber-700">Revisa y aprueba antes de ejecutar</div>
          </div>
        </div>
        <div className="space-y-2">
          {actions.map(a => {
            const cfg = ACTION_TYPE_LABELS[a.action_type] || { label: a.action_type, emoji: '⚙️', color: 'bg-[#060910] border-white/[0.08] text-slate-300' };
            const expanded = expandedId === a._id;
            return (
              <div key={a._id} className="bg-[#0c1222] border border-amber-500/25 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{cfg.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(a.proposed_at).toLocaleString('es-MX')}</span>
                    </div>
                    <div className="text-sm font-medium text-slate-100">{a.summary}</div>
                    <button onClick={() => setExpandedId(expanded ? null : a._id)} className="mt-1 text-[11px] text-amber-600 hover:underline">
                      {expanded ? 'Ocultar payload' : 'Ver payload ▾'}
                    </button>
                    {expanded && (
                      <pre className="mt-2 bg-gray-900 text-gray-100 text-[11px] p-3 rounded-lg overflow-x-auto max-h-48">{JSON.stringify(a.payload, null, 2)}</pre>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => onApprove(a._id)}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button
                      onClick={() => onReject(a._id)}
                      disabled={loading}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0c1222] hover:bg-red-500/150/10 text-red-600 border border-red-500/30 text-xs font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Las acciones se ejecutan en el sistema productivo. Verifica los datos antes de aprobar.</span>
        </div>
      </div>
    </div>
  );
}
