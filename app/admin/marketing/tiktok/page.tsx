'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../layout';
import {
  Music2, Link2, Unlink, Loader2, RefreshCw, Send, ExternalLink,
  CheckCircle2, XCircle, Clock, AlertTriangle, Video, ShieldCheck, Copy, Check,
} from 'lucide-react';

interface Account {
  open_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  scopes: string;
  access_expires_at: string | null;
  connected_at: string | null;
}

interface Status {
  configured: boolean;
  redirect_uri: string;
  connected: boolean;
  account: Account | null;
  posts_count: number;
}

interface CreatorInfo {
  creator_nickname?: string;
  creator_username?: string;
  creator_avatar_url?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
}

interface Post {
  publish_id: string;
  title: string;
  privacy_level: string;
  mode?: string;
  status: string;
  fail_reason?: string;
  created_at: string | null;
}

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: '🌎 Público',
  MUTUAL_FOLLOW_FRIENDS: '👥 Amigos',
  FOLLOWER_OF_CREATOR: '👤 Seguidores',
  SELF_ONLY: '🔒 Solo yo',
};

// Direct-to-backend base for large file uploads (bypasses Vercel proxy limits)
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const STATUS_META: Record<string, { label: string; cls: string; Icon: any }> = {
  PUBLISH_COMPLETE: { label: 'Publicado', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', Icon: CheckCircle2 },
  FAILED: { label: 'Falló', cls: 'bg-red-500/15 text-red-300 border-red-500/30', Icon: XCircle },
  PROCESSING_DOWNLOAD: { label: 'Procesando', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: Clock },
  PROCESSING_UPLOAD: { label: 'Procesando', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', Icon: Clock },
  SEND_TO_USER_INBOX: { label: 'En bandeja', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30', Icon: Clock },
};

export default function TikTokPage() {
  const { token } = useAdminAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [copied, setCopied] = useState(false);

  // Publish form
  const [mode, setMode] = useState<'direct' | 'draft'>('direct');
  const [sourceType, setSourceType] = useState<'file' | 'url'>('file');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [disableComment, setDisableComment] = useState(false);
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [consent, setConsent] = useState(false);

  const authHdr = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const st: Status = await fetch('/api/admin/marketing/tiktok/status', { headers: authHdr }).then(r => r.json());
      setStatus(st);
      if (st.connected) {
        const [ci, ps] = await Promise.all([
          fetch('/api/admin/marketing/tiktok/creator-info', { headers: authHdr }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/admin/marketing/tiktok/posts', { headers: authHdr }).then(r => r.json()).catch(() => ({ posts: [] })),
        ]);
        setCreator(ci);
        setPosts(ps?.posts || []);
        if (ci?.privacy_level_options?.length && !privacy) setPrivacy(ci.privacy_level_options[0]);
      }
    } catch { showToast('Error al cargar estado de TikTok', 'err'); }
    setLoading(false);

  }, [token, authHdr]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('connected') === '1') showToast('✅ Cuenta TikTok conectada exitosamente');
    if (p.get('error')) showToast(`Error de TikTok: ${p.get('error')}`, 'err');
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const r = await fetch('/api/admin/marketing/tiktok/connect', { method: 'POST', headers: authHdr });
      const d = await r.json();
      if (r.ok && d.authorize_url) {
        window.location.href = d.authorize_url;
      } else showToast(d?.detail || 'No se pudo iniciar conexión', 'err');
    } catch { showToast('Error de conexión', 'err'); }
    setConnecting(false);
  };

  const disconnect = async () => {
    if (!window.confirm('¿Desconectar la cuenta TikTok? Tendrás que autorizar de nuevo para publicar.')) return;
    try {
      await fetch('/api/admin/marketing/tiktok/account', { method: 'DELETE', headers: authHdr });
      showToast('Cuenta desconectada');
      setCreator(null);
      load();
    } catch { showToast('Error al desconectar', 'err'); }
  };

  const publish = async () => {
    if (!consent) { showToast('Debes confirmar el consentimiento antes de publicar', 'err'); return; }
    if (sourceType === 'url' && !videoUrl.trim()) { showToast('La URL del video es requerida', 'err'); return; }
    if (sourceType === 'file' && !videoFile) { showToast('Selecciona un video de tu dispositivo', 'err'); return; }
    if (mode === 'direct' && (!title.trim() || !privacy)) { showToast('Título y privacidad son requeridos', 'err'); return; }
    setPublishing(true);
    try {
      let r: Response;
      if (sourceType === 'file' && videoFile) {
        const fd = new FormData();
        fd.append('file', videoFile);
        fd.append('title', title.trim());
        fd.append('privacy_level', privacy || 'SELF_ONLY');
        fd.append('disable_comment', String(disableComment));
        fd.append('disable_duet', String(disableDuet));
        fd.append('disable_stitch', String(disableStitch));
        fd.append('mode', mode);
        r = await fetch(`${API_BASE}/api/admin/marketing/tiktok/publish-file`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
      } else {
        r = await fetch('/api/admin/marketing/tiktok/publish', {
          method: 'POST', headers: authHdr,
          body: JSON.stringify({
            mode, title: title.trim(), video_url: videoUrl.trim(), privacy_level: privacy || 'SELF_ONLY',
            disable_comment: disableComment, disable_duet: disableDuet, disable_stitch: disableStitch,
          }),
        });
      }
      const d = await r.json();
      if (r.ok && d.success) {
        showToast(mode === 'draft' ? '📥 Video enviado como borrador a tu bandeja de TikTok' : '🚀 Video enviado a TikTok — procesando');
        setTitle(''); setVideoUrl(''); setVideoFile(null); setConsent(false);
        load();
      } else showToast(d?.detail || 'Error al publicar', 'err');
    } catch { showToast('Error al publicar', 'err'); }
    setPublishing(false);
  };

  const checkStatus = async (publishId: string) => {
    setCheckingId(publishId);
    try {
      const d = await fetch(`/api/admin/marketing/tiktok/posts/${encodeURIComponent(publishId)}/status`, { headers: authHdr }).then(r => r.json());
      setPosts(prev => prev.map(p => p.publish_id === publishId ? { ...p, status: d.status || p.status, fail_reason: d.fail_reason } : p));
    } catch { showToast('Error al consultar estado', 'err'); }
    setCheckingId(null);
  };

  const copyRedirect = () => {
    navigator.clipboard.writeText(status?.redirect_uri || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !status) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center">
          <Music2 className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">TikTok Publisher</h1>
          <p className="text-sm text-gray-400">Publica videos directo en la cuenta de la empresa</p>
        </div>
      </div>

      {/* ── Not configured ── */}
      {status && !status.configured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <AlertTriangle className="w-5 h-5" /> Configuración pendiente
          </div>
          <p className="text-sm text-gray-300">
            Aún no hay credenciales de TikTok en el backend. Completa el registro en{' '}
            <a href="https://developers.tiktok.com/" target="_blank" rel="noreferrer" className="text-cyan-300 underline inline-flex items-center gap-1">
              developers.tiktok.com <ExternalLink className="w-3 h-3" />
            </a>{' '}
            y cuando tengas el <b>Client Key</b> y <b>Client Secret</b>, agrégalos como variables de entorno del backend:
          </p>
          <div className="rounded-xl bg-black/30 border border-white/10 p-4 font-mono text-xs text-gray-300 space-y-1">
            <div>TIKTOK_CLIENT_KEY=tu_client_key</div>
            <div>TIKTOK_CLIENT_SECRET=tu_client_secret</div>
            <div className="break-all">TIKTOK_REDIRECT_URI={status.redirect_uri}</div>
          </div>
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1">📌 Registra este Callback URL en Login Kit (debe coincidir EXACTO):</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-black/30 border border-white/10 rounded-lg px-3 py-2 break-all flex-1">{status.redirect_uri}</code>
              <button onClick={copyRedirect} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <ul className="text-xs text-gray-400 space-y-1 list-disc pl-5">
            <li>Productos requeridos: <b>Login Kit</b> + <b>Content Posting API</b> (Direct Post activado)</li>
            <li>Scopes: <code>video.publish</code>, <code>user.info.basic</code></li>
            <li>Antes del audit de TikTok solo podrás publicar en modo <b>Solo yo (SELF_ONLY)</b></li>
          </ul>
        </div>
      )}

      {/* ── Configured but not connected ── */}
      {status?.configured && !status.connected && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-4">
          <Music2 className="w-12 h-12 text-cyan-300 mx-auto" />
          <h2 className="text-lg font-bold">Conecta la cuenta TikTok de la empresa</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Serás redirigido a TikTok para autorizar la publicación de videos. Usa la cuenta desde donde quieres que salgan las publicaciones (Ross House Rentals).
          </p>
          <button onClick={connect} disabled={connecting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Conectar con TikTok
          </button>
        </div>
      )}

      {/* ── Connected ── */}
      {status?.connected && status.account && (
        <>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-wrap items-center gap-4">
            {status.account.avatar_url ? (
              <img src={status.account.avatar_url} alt="avatar" className="w-12 h-12 rounded-full border border-white/20" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><Music2 className="w-5 h-5" /></div>
            )}
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center gap-2">
                <span className="font-bold">{status.account.display_name || 'Cuenta TikTok'}</span>
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Conectada
                </span>
              </div>
              {status.account.username && <div className="text-xs text-gray-400">@{status.account.username}</div>}
              <div className="text-[11px] text-gray-500 mt-0.5">Scopes: {status.account.scopes}</div>
            </div>
            <button onClick={disconnect}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20 transition-colors">
              <Unlink className="w-3.5 h-3.5" /> Desconectar
            </button>
          </div>

          {/* Publish form */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
            <div className="flex items-center gap-2 font-bold"><Video className="w-4 h-4 text-pink-400" /> Publicar video</div>
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button onClick={() => setMode('direct')}
                className={`flex-1 px-4 py-3 rounded-xl border text-left transition-colors ${mode === 'direct'
                  ? 'bg-pink-500/10 border-pink-500/40' : 'bg-white/[0.02] border-white/10 hover:bg-white/5'}`}>
                <div className={`text-sm font-bold ${mode === 'direct' ? 'text-pink-300' : 'text-gray-300'}`}>🚀 Publicación directa</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Se publica de inmediato en el perfil</div>
              </button>
              <button onClick={() => setMode('draft')}
                className={`flex-1 px-4 py-3 rounded-xl border text-left transition-colors ${mode === 'draft'
                  ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-white/[0.02] border-white/10 hover:bg-white/5'}`}>
                <div className={`text-sm font-bold ${mode === 'draft' ? 'text-cyan-300' : 'text-gray-300'}`}>📥 Borrador</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Llega a tu bandeja de TikTok para editar y publicar desde la app</div>
              </button>
            </div>
            {creator?.max_video_post_duration_sec ? (
              <p className="text-[11px] text-gray-500">Duración máxima permitida para esta cuenta: {Math.floor(creator.max_video_post_duration_sec / 60)} min</p>
            ) : null}
            {mode === 'direct' && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Título / Caption (con #hashtags)</label>
              <textarea value={title} onChange={e => setTitle(e.target.value)} rows={3} maxLength={2200}
                placeholder="🏠 Casa disponible en Dumas TX — 3 recámaras, 2 baños… #DumasTX #CasasEnRenta"
                className="w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50" />
            </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Video</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setSourceType('file')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${sourceType === 'file'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                  📱 Subir desde mi dispositivo
                </button>
                <button onClick={() => setSourceType('url')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${sourceType === 'url'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                  🔗 Desde URL
                </button>
              </div>
              {sourceType === 'file' ? (
                <div>
                  <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 bg-black/20 px-4 py-6 cursor-pointer hover:border-cyan-500/40 transition-colors">
                    <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
                      onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                    <Video className="w-5 h-5 text-cyan-400" />
                    <span className="text-sm text-gray-300">
                      {videoFile ? `🎬 ${videoFile.name} (${(videoFile.size / (1024 * 1024)).toFixed(1)} MB)` : 'Toca para elegir un video (MP4/MOV, máx 280MB)'}
                    </span>
                  </label>
                </div>
              ) : (
                <div>
                  <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.rosshouserentals.com/videos/tour-812.mp4"
                    className="w-full rounded-xl bg-black/25 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50" />
                  <p className="text-[11px] text-gray-500 mt-1">TikTok descarga el video desde esta URL (dominio verificado) — o el sistema lo sube automáticamente como archivo.</p>
                </div>
              )}
            </div>
            {mode === 'direct' && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Privacidad</label>
              <div className="flex flex-wrap gap-2">
                {(creator?.privacy_level_options || ['SELF_ONLY']).map(opt => (
                  <button key={opt} onClick={() => setPrivacy(opt)}
                    className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${privacy === opt
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                    {PRIVACY_LABELS[opt] || opt}
                  </button>
                ))}
              </div>
            </div>
            )}
            {mode === 'direct' && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-300">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={disableComment} onChange={e => setDisableComment(e.target.checked)} disabled={creator?.comment_disabled} className="accent-cyan-500" />
                Desactivar comentarios
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={disableDuet} onChange={e => setDisableDuet(e.target.checked)} disabled={creator?.duet_disabled} className="accent-cyan-500" />
                Desactivar Duet
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={disableStitch} onChange={e => setDisableStitch(e.target.checked)} disabled={creator?.stitch_disabled} className="accent-cyan-500" />
                Desactivar Stitch
              </label>
            </div>
            )}
            <label className="flex items-start gap-2.5 text-xs text-gray-300 cursor-pointer rounded-xl bg-black/20 border border-white/10 p-3">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5 accent-emerald-500" />
              <span className="flex items-center gap-1.5 flex-wrap">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Revisé el video y el caption, y autorizo publicarlo en la cuenta TikTok conectada{creator?.creator_nickname ? ` (${creator.creator_nickname})` : ''}.
              </span>
            </label>
            <button onClick={publish} disabled={publishing || !consent}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-40">
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {publishing && sourceType === 'file' ? 'Subiendo video…' : mode === 'draft' ? 'Enviar borrador a TikTok' : 'Publicar en TikTok'}
            </button>
          </div>

          {/* Posts history */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" /> Historial ({posts.length})</div>
              <button onClick={load} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {posts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Aún no has publicado videos</p>
            ) : (
              <div className="space-y-2">
                {posts.map(p => {
                  const meta = STATUS_META[p.status] || { label: p.status || '—', cls: 'bg-white/5 text-gray-400 border-white/10', Icon: Clock };
                  return (
                    <div key={p.publish_id} className="flex items-center gap-3 rounded-xl bg-black/20 border border-white/5 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.title || '(borrador sin título)'}</div>
                        <div className="text-[11px] text-gray-500">
                          {p.created_at ? new Date(p.created_at).toLocaleString('es-MX') : ''} · {p.mode === 'draft' ? '📥 Borrador' : (PRIVACY_LABELS[p.privacy_level] || p.privacy_level)}
                          {p.fail_reason ? <span className="text-red-400"> · {p.fail_reason}</span> : null}
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${meta.cls}`}>
                        <meta.Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      <button onClick={() => checkStatus(p.publish_id)} disabled={checkingId === p.publish_id}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors" title="Actualizar estado">
                        {checkingId === p.publish_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl ${toast.type === 'ok'
          ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
          : 'bg-red-950/90 border-red-500/40 text-red-200'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
