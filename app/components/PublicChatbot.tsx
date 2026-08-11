'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { trackEvent } from './VisitorTracker';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  admin?: boolean;
}

const STORAGE_KEY = 'rh_chatbot_session_id';
const OPEN_KEY = 'rh_chatbot_open';

// Markdown ultra-mínimo (negritas, links, listas).
function mdInline(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s)]+)/g, '<a href="$1" target="_blank" rel="noopener" class="underline text-amber-600">$1</a>');
}

function renderMd(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      return <li key={i} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: mdInline(ul[1]) }} />;
    }
    if (!line.trim()) return <br key={i} />;
    return <p key={i} className="mb-1.5" dangerouslySetInnerHTML={{ __html: mdInline(line) }} />;
  });
}

export default function PublicChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [unreadHint, setUnreadHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenAdminRef = useRef(0);
  const historyLoadedRef = useRef(false);

  // Restore session
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (saved) setSessionId(saved);
      const wasOpen = typeof window !== 'undefined' ? window.localStorage.getItem(OPEN_KEY) === '1' : false;
      if (wasOpen) setOpen(true);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  // Restore full history from server (includes admin replies bridged from the app)
  useEffect(() => {
    if (!sessionId || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/public/chatbot/sessions/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        const msgs: ChatMsg[] = (data.messages || [])
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => ({ role: m.role, content: m.content, admin: !!m.from_admin }));
        seenAdminRef.current = msgs.filter(m => m.admin).length;
        if (msgs.length > 0) setMessages(msgs);
        if (data.lead_captured) setLeadCaptured(true);
      } catch {
        /* ignore */
      }
    })();
  }, [sessionId]);

  // Poll for human (admin) replies bridged from the admin app
  useEffect(() => {
    if (!sessionId) return;
    const iv = setInterval(async () => {
      if (sending) return;
      try {
        const res = await fetch(`/api/public/chatbot/sessions/${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        const adminMsgs = (data.messages || []).filter((m: any) => m.from_admin);
        if (adminMsgs.length > seenAdminRef.current) {
          const fresh = adminMsgs.slice(seenAdminRef.current);
          seenAdminRef.current = adminMsgs.length;
          setMessages(prev => [
            ...prev,
            ...fresh.map((m: any) => ({ role: 'assistant' as const, content: m.content, admin: true })),
          ]);
          if (!open) setUnreadHint(true);
        }
      } catch {
        /* ignore */
      }
    }, 7000);
    return () => clearInterval(iv);
  }, [sessionId, sending, open]);

  // Persist session id + open state
  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, sessionId);
    }
  }, [sessionId]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    }
    if (open) {
      setUnreadHint(false);
      // Fire analytics event for the funnel
      trackEvent('chatbot_open');
    }
  }, [open]);

  // Welcome greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const ctx = typeof window !== 'undefined' ? window.localStorage.getItem('rh_chatbot_context') : null;
      if (ctx === 'contractor') {
        setMessages([{
          role: 'assistant',
          content: '👷‍♂️ ¡Hola! Soy **Rossy**, asistente de Ross House Rentals.\n\nVeo que eres **contratista** o estás interesado en unirte a nuestra red. ¿En qué te puedo ayudar?\n\n- Tipos de trabajo disponibles (plomería, electricidad, jardinería, pintura, etc.)\n- Cómo registrarte sin contrato\n- Requisitos (seguro, licencia, etc.)\n- Frecuencia y forma de pago\n\nO si prefieres, **registrate ya** en el formulario de arriba 👆'
        }]);
      } else {
        setMessages([{
          role: 'assistant',
          content: '¡Hola! 👋 Soy **Rossy**, tu asistente de Ross House Rentals.\n\n¿En qué te puedo ayudar hoy? Puedo contarte sobre nuestras casas disponibles, requisitos, o agendarte para nuestra lista de espera.'
        }]);
      }
    }
  }, [open, messages.length]);

  // Listen for external open events (e.g., from ProviderSocialActions)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.context && typeof window !== 'undefined') {
        window.localStorage.setItem('rh_chatbot_context', String(detail.context));
      }
      setOpen(true);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('rh:open-chatbot', handler as EventListener);
      return () => window.removeEventListener('rh:open-chatbot', handler as EventListener);
    }
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/public/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: sessionId, lang: 'es' }),
      });
      if (!res.ok || !res.body) throw new Error('Sin conexión');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let assistantText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'meta' && data.session_id) {
              setSessionId(data.session_id);
            } else if (data.type === 'delta') {
              assistantText += data.content;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            } else if (data.type === 'replace') {
              assistantText = data.content || '';
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            } else if (data.type === 'lead_captured') {
              setLeadCaptured(true);
            }
          } catch {
            /* ignore malformed event */
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: '⚠️ Tuvimos un problema. Llama al (806) 934-2018.' };
        return copy;
      });
    }
    setSending(false);
  }, [input, sending, sessionId]);

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir chat con Rossy"
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-2xl shadow-amber-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition"
        >
          <MessageCircle className="w-7 h-7" />
          {unreadHint && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white" />
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-24px)] h-[560px] max-h-[calc(100vh-32px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm leading-tight">Rossy · Ross House</div>
              <div className="text-[10px] text-amber-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> En línea · Responde 24/7
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1.5 rounded-lg hover:bg-white/10 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Captured banner */}
          {leadCaptured && (
            <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ¡Te registramos en nuestra lista! Te contactaremos pronto.
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'user' ? (
                  <div className="max-w-[80%] px-3.5 py-2 rounded-2xl rounded-tr-md bg-amber-500 text-white text-sm leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <div className={`max-w-[85%] px-3.5 py-2 rounded-2xl rounded-tl-md text-sm leading-relaxed ${m.admin ? 'bg-emerald-50 border border-emerald-300 text-gray-800' : 'bg-white border border-gray-200 text-gray-800'}`}>
                    {m.admin && (
                      <div className="text-[10px] font-bold text-emerald-600 mb-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Equipo Ross House
                      </div>
                    )}
                    {m.content ? renderMd(m.content) : <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Escribe tu pregunta..."
                rows={1}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 resize-none max-h-24"
                disabled={sending}
              />
              <button
                onClick={send}
                disabled={!input.trim() || sending}
                aria-label="Enviar"
                className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white flex items-center justify-center transition shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] text-gray-400 text-center mt-1.5">
              Powered by AI · Información sujeta a verificación
            </div>
          </div>
        </div>
      )}
    </>
  );
}
