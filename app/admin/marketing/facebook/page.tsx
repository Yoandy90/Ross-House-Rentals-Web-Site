'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Facebook, Send, Loader2, RefreshCw, ImagePlus, Video, X, Link2,
  MessageCircle, Sparkles, Bot, Settings2, CheckCircle2, ExternalLink,
  ThumbsUp, Share2, Unplug, Copy,
} from 'lucide-react';
import { useAdminAuth } from '../../layout';

interface FbPost {
  id: string; message: string; created_time?: string; picture?: string;
  permalink?: string; comments_count: number; likes_count: number; shares_count: number;
}
interface FbComment {
  id: string; message: string; from_name: string; is_page: boolean;
  created_time?: string; like_count: number;
  replies: { id: string; message: string; from_name: string; is_page: boolean; created_time?: string }[];
}
interface FbConv {
  id: string; user_name: string; user_id?: string; updated_time?: string; unread_count: number;
  messages: { id?: string; message: string; from_name: string; is_page: boolean; created_time?: string }[];
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.floor(m / 60)} h`;
  return `hace ${Math.floor(m / 1440)} d`;
}

type Tab = 'publicar' | 'comentarios' | 'messenger' | 'config';

export default function FacebookMarketingPage() {
  const { headers } = useAdminAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('publicar');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // composer
  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<{ base64: string; type: 'photo' | 'video'; name: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // posts + comments
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selPost, setSelPost] = useState<FbPost | null>(null);
  const [comments, setComments] = useState<FbComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  // messenger
  const [convs, setConvs] = useState<FbConv[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [selConv, setSelConv] = useState<FbConv | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/marketing/facebook/status', { headers: headers() });
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [headers]);

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) showToast('¡Página de Facebook conectada! 🎉');
    if (params.get('error')) showToast(`Error al conectar: ${params.get('error')}`, false);
  }, [fetchStatus]);

  const connect = async () => {
    const r = await fetch('/api/admin/marketing/facebook/connect', { method: 'POST', headers: headers() });
    const d = await r.json();
    if (r.ok && d.auth_url) window.location.href = d.auth_url;
    else showToast(d.detail || 'Error al iniciar conexión', false);
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar la página de Facebook?')) return;
    await fetch('/api/admin/marketing/facebook/account', { method: 'DELETE', headers: headers() });
    fetchStatus();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith('video');
    if (f.size > (isVideo ? 90 : 10) * 1024 * 1024) {
      showToast(isVideo ? 'Video máx 90MB' : 'Foto máx 10MB', false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setMedia({ base64: String(reader.result), type: isVideo ? 'video' : 'photo', name: f.name });
    reader.readAsDataURL(f);
  };

  const publish = async () => {
    if (!message.trim() && !media) return;
    setPublishing(true);
    try {
      const r = await fetch('/api/admin/marketing/facebook/publish', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          message,
          media_base64: media?.base64 || null,
          media_type: media?.type || null,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        showToast('¡Publicado en Facebook! 🎉');
        setMessage(''); setMedia(null);
        loadPosts();
      } else showToast(typeof d.detail === 'string' ? d.detail : 'Error al publicar', false);
    } catch { showToast('Error de red', false); }
    setPublishing(false);
  };

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const r = await fetch('/api/admin/marketing/facebook/posts', { headers: headers() });
      const d = await r.json();
      if (r.ok) setPosts(d.posts || []);
    } catch { /* ignore */ }
    setLoadingPosts(false);
  }, [headers]);

  const loadComments = useCallback(async (post: FbPost) => {
    setSelPost(post);
    setLoadingComments(true);
    try {
      const r = await fetch(`/api/admin/marketing/facebook/posts/${post.id}/comments`, { headers: headers() });
      const d = await r.json();
      if (r.ok) setComments(d.comments || []);
      else showToast(typeof d.detail === 'string' ? d.detail : 'Error al cargar comentarios', false);
    } catch { /* ignore */ }
    setLoadingComments(false);
  }, [headers]);

  const aiSuggest = async (key: string, text: string, author: string, context: string) => {
    setAiLoading(key);
    try {
      const r = await fetch('/api/admin/marketing/facebook/ai-suggest', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ text, author, context }),
      });
      const d = await r.json();
      if (r.ok && d.suggestion) {
        if (key.startsWith('msg:')) setMsgDraft(d.suggestion);
        else setReplyDrafts(p => ({ ...p, [key]: d.suggestion }));
      } else showToast('La IA no pudo generar la sugerencia', false);
    } catch { showToast('Error de red', false); }
    setAiLoading(null);
  };

  const sendReply = async (commentId: string) => {
    const text = (replyDrafts[commentId] || '').trim();
    if (!text || !selPost) return;
    setSendingReply(commentId);
    try {
      const r = await fetch(`/api/admin/marketing/facebook/comments/${commentId}/reply`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ message: text, source: 'human' }),
      });
      if (r.ok) {
        setReplyDrafts(p => ({ ...p, [commentId]: '' }));
        loadComments(selPost);
        showToast('Respuesta publicada ✅');
      } else showToast('Error al responder', false);
    } catch { showToast('Error de red', false); }
    setSendingReply(null);
  };

  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const r = await fetch('/api/admin/marketing/facebook/messenger/conversations', { headers: headers() });
      const d = await r.json();
      if (r.ok) setConvs(d.conversations || []);
      else showToast(typeof d.detail === 'string' ? d.detail : 'Error al cargar Messenger', false);
    } catch { /* ignore */ }
    setLoadingConvs(false);
  }, [headers]);

  const sendMessenger = async () => {
    if (!msgDraft.trim() || !selConv?.user_id) return;
    setSendingMsg(true);
    try {
      const r = await fetch('/api/admin/marketing/facebook/messenger/send', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ recipient_id: selConv.user_id, message: msgDraft, source: 'human' }),
      });
      if (r.ok) { setMsgDraft(''); loadConvs(); showToast('Mensaje enviado ✅'); }
      else {
        const d = await r.json();
        showToast(typeof d.detail === 'string' ? d.detail : 'Error al enviar', false);
      }
    } catch { showToast('Error de red', false); }
    setSendingMsg(false);
  };

  const toggleSetting = async (key: 'auto_comments' | 'auto_messages') => {
    const cur = status?.settings?.[key];
    const r = await fetch('/api/admin/marketing/facebook/settings', {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ [key]: !cur }),
    });
    if (r.ok) {
      const d = await r.json();
      setStatus((s: any) => ({ ...s, settings: d.settings }));
      showToast(!cur ? '🤖 IA automática ACTIVADA' : '✋ Modo manual activado');
    }
  };

  useEffect(() => {
    if (tab === 'comentarios' && status?.connected) loadPosts();
    if (tab === 'messenger' && status?.connected) loadConvs();
  }, [tab, status?.connected, loadPosts, loadConvs]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  const connected = status?.connected;
  const S = status?.settings || {};

  return (
    <div className="space-y-5 relative">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
            <Facebook className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Facebook</h2>
            <p className="text-sm text-gray-500">Publica, responde comentarios y Messenger — con IA 🤖</p>
          </div>
        </div>
        {connected ? (
          <div className="flex items-center gap-2">
            {status.page?.picture && <img src={status.page.picture} alt="" className="w-8 h-8 rounded-full" />}
            <span className="text-sm text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> {status.page?.name}
            </span>
            <button onClick={disconnect} className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition" title="Desconectar">
              <Unplug className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={connect} disabled={!status?.configured}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-white/[0.06] disabled:text-gray-600 text-white text-sm font-semibold flex items-center gap-2 transition">
            <Facebook className="w-4 h-4" /> Conectar página
          </button>
        )}
      </div>

      {!status?.configured && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 text-sm text-amber-300">
          Configura <b>META_APP_ID</b> y <b>META_APP_SECRET</b> en Configuración → API Keys para habilitar Facebook.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit flex-wrap">
        {([
          { key: 'publicar', label: '📤 Publicar' },
          { key: 'comentarios', label: '💬 Comentarios' },
          { key: 'messenger', label: '✉️ Messenger' },
          { key: 'config', label: '⚙️ IA & Webhooks' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t.key ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ PUBLICAR ══ */}
      {tab === 'publicar' && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 max-w-2xl space-y-4">
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="¿Qué quieres publicar en la página? (nueva propiedad, promoción, aviso...)"
            rows={5}
            className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
          />
          {media && (
            <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
              {media.type === 'photo'
                ? <img src={media.base64} alt="" className="w-16 h-16 rounded-lg object-cover" />
                : <div className="w-16 h-16 rounded-lg bg-blue-500/15 flex items-center justify-center"><Video className="w-6 h-6 text-blue-400" /></div>}
              <span className="text-sm text-gray-300 flex-1 truncate">{media.name}</span>
              <button onClick={() => setMedia(null)} className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*,video/mp4" className="hidden" onChange={onFile} />
              <button onClick={() => fileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-white text-sm flex items-center gap-2 transition">
                <ImagePlus className="w-4 h-4" /> Foto / Video
              </button>
            </div>
            <button onClick={publish} disabled={publishing || !connected || (!message.trim() && !media)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-white/[0.06] disabled:text-gray-600 text-white text-sm font-semibold flex items-center gap-2 transition">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publicar en Facebook
            </button>
          </div>
          {!connected && <p className="text-xs text-gray-500">Conecta tu página primero (botón azul arriba).</p>}
        </div>
      )}

      {/* ══ COMENTARIOS ══ */}
      {tab === 'comentarios' && (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
          {/* posts list */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Publicaciones recientes</span>
              <button onClick={loadPosts} className="p-1.5 rounded-lg text-gray-500 hover:text-white"><RefreshCw className={`w-4 h-4 ${loadingPosts ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {loadingPosts ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm px-6">No hay publicaciones (o conecta la página)</div>
              ) : posts.map(p => (
                <button key={p.id} onClick={() => loadComments(p)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition flex gap-3 ${selPost?.id === p.id ? 'bg-blue-500/[0.07] border-l-2 border-l-blue-500' : ''}`}>
                  {p.picture && <img src={p.picture} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 line-clamp-2">{p.message || '(sin texto)'}</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{p.likes_count}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{p.comments_count}</span>
                      <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{p.shares_count}</span>
                      <span>{timeAgo(p.created_time)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* comments thread */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
            {!selPost ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-2">
                <MessageCircle className="w-10 h-10 opacity-30" />
                <p className="text-sm">Selecciona una publicación para ver sus comentarios</p>
              </div>
            ) : loadingComments ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            ) : (
              <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 line-clamp-1 flex-1">{selPost.message || '(sin texto)'}</span>
                  {selPost.permalink && <a href={selPost.permalink} target="_blank" rel="noreferrer" className="text-blue-400 p-1.5"><ExternalLink className="w-4 h-4" /></a>}
                </div>
                {comments.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-10">Sin comentarios todavía</p>
                ) : comments.map(c => (
                  <div key={c.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-bold ${c.is_page ? 'text-blue-400' : 'text-white'}`}>{c.from_name}</span>
                      <span className="text-gray-600">{timeAgo(c.created_time)}</span>
                      {c.like_count > 0 && <span className="text-gray-500 flex items-center gap-0.5"><ThumbsUp className="w-3 h-3" />{c.like_count}</span>}
                    </div>
                    <p className="text-sm text-gray-200">{c.message}</p>
                    {c.replies.map(r => (
                      <div key={r.id} className={`ml-5 rounded-lg px-3 py-2 text-sm ${r.is_page ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-white/[0.04]'}`}>
                        <span className={`text-[11px] font-bold ${r.is_page ? 'text-blue-400' : 'text-gray-400'}`}>{r.is_page ? `📘 ${r.from_name}` : r.from_name}</span>
                        <p className="text-gray-200">{r.message}</p>
                      </div>
                    ))}
                    {!c.is_page && (
                      <div className="flex gap-2 items-end">
                        <textarea
                          value={replyDrafts[c.id] || ''}
                          onChange={e => setReplyDrafts(p => ({ ...p, [c.id]: e.target.value }))}
                          placeholder="Responder..."
                          rows={1}
                          className="flex-1 px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-blue-500 focus:outline-none resize-none"
                        />
                        <button onClick={() => aiSuggest(c.id, c.message, c.from_name, selPost.message)}
                          disabled={aiLoading === c.id}
                          className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition" title="Sugerencia de IA">
                          {aiLoading === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                        <button onClick={() => sendReply(c.id)} disabled={!(replyDrafts[c.id] || '').trim() || sendingReply === c.id}
                          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-white/[0.06] disabled:text-gray-600 text-white transition">
                          {sendingReply === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MESSENGER ══ */}
      {tab === 'messenger' && (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Conversaciones</span>
              <button onClick={loadConvs} className="p-1.5 rounded-lg text-gray-500 hover:text-white"><RefreshCw className={`w-4 h-4 ${loadingConvs ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              {loadingConvs ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : convs.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm px-6">Sin conversaciones de Messenger</div>
              ) : convs.map(c => (
                <button key={c.id} onClick={() => setSelConv(c)}
                  className={`w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition ${selConv?.id === c.id ? 'bg-blue-500/[0.07] border-l-2 border-l-blue-500' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white flex-1 truncate">{c.user_name}</span>
                    {c.unread_count > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-500 text-[10px] text-white font-bold flex items-center justify-center">{c.unread_count}</span>}
                  </div>
                  <div className="flex justify-between mt-0.5 gap-2">
                    <span className="text-xs text-gray-500 truncate flex-1">{c.messages[c.messages.length - 1]?.message || '—'}</span>
                    <span className="text-[10px] text-gray-600">{timeAgo(c.updated_time)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden" style={{ minHeight: 420 }}>
            {!selConv ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-2">
                <MessageCircle className="w-10 h-10 opacity-30" />
                <p className="text-sm">Selecciona una conversación</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-white/[0.06] font-semibold text-white text-sm">{selConv.user_name}</div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ maxHeight: 380 }}>
                  {selConv.messages.map((m, i) => (
                    <div key={m.id || i} className={`flex ${m.is_page ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.is_page ? 'bg-blue-500/15 border border-blue-500/25 text-blue-50 rounded-tr-md' : 'bg-white/[0.05] border border-white/[0.08] text-gray-200 rounded-tl-md'}`}>
                        <div className="whitespace-pre-wrap break-words">{m.message}</div>
                        <div className="text-[10px] text-gray-600 mt-0.5">{timeAgo(m.created_time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-white/[0.06] flex items-end gap-2">
                  <textarea value={msgDraft} onChange={e => setMsgDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessenger(); } }}
                    placeholder="Responder..." rows={1}
                    className="flex-1 px-4 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none resize-none max-h-24" />
                  <button onClick={() => aiSuggest(`msg:${selConv.id}`, selConv.messages.filter(m => !m.is_page).slice(-1)[0]?.message || '', selConv.user_name, '')}
                    disabled={aiLoading === `msg:${selConv.id}`}
                    className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25 transition" title="Sugerencia de IA">
                    {aiLoading === `msg:${selConv.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </button>
                  <button onClick={sendMessenger} disabled={!msgDraft.trim() || sendingMsg}
                    className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-white/[0.06] disabled:text-gray-600 text-white flex items-center justify-center transition shrink-0">
                    {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ CONFIG ══ */}
      {tab === 'config' && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><Bot className="w-5 h-5 text-violet-400" /> Respuestas con IA</h3>
            {([
              { key: 'auto_comments', title: 'Comentarios de publicaciones', desc: 'La IA responde automáticamente los comentarios nuevos' },
              { key: 'auto_messages', title: 'Mensajes de Messenger', desc: 'La IA responde automáticamente los mensajes privados' },
            ] as const).map(item => (
              <div key={item.key} className="flex items-center justify-between gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <div>
                  <div className="font-semibold text-white text-sm">{item.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                </div>
                <button onClick={() => toggleSetting(item.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${S[item.key] ? 'bg-violet-500 text-white' : 'bg-white/[0.06] text-gray-400 border border-white/[0.1]'}`}>
                  {S[item.key] ? '🤖 AUTOMÁTICO' : '✋ MANUAL'}
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-500">
              En modo <b>Manual</b>, usa el botón ✨ junto a cada comentario/mensaje para que la IA te sugiera la respuesta y tú la apruebes.
              En <b>Automático</b>, la IA responde sola al instante (requiere webhook configurado abajo). Siempre recibes notificación push.
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><Settings2 className="w-5 h-5 text-blue-400" /> Webhook (tiempo real)</h3>
            <p className="text-xs text-gray-500">Para notificaciones instantáneas y el modo Automático, configura en Meta dashboard → <b>Webhooks → Página (Page)</b>:</p>
            {[
              { label: 'URL de devolución de llamada', value: status?.webhook_url || '' },
              { label: 'Token de verificación', value: status?.webhook_verify_token || '' },
            ].map(f => (
              <div key={f.label} className="bg-[#0a1020]/60 border border-white/[0.08] rounded-xl p-3">
                <div className="text-[11px] text-gray-500 mb-1">{f.label}</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-blue-300 flex-1 break-all">{f.value}</code>
                  <button onClick={() => { navigator.clipboard.writeText(f.value); showToast('Copiado 📋'); }}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white shrink-0"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500">Campos a suscribir: <b>feed</b> (comentarios) y <b>messages</b> (Messenger). La página se suscribe automáticamente al conectarla.</p>
          </div>
        </div>
      )}
    </div>
  );
}
