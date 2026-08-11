'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import {
  Share2, MessageCircle, Facebook, Twitter, Link2, Check, Send, Loader2, Mail,
} from 'lucide-react';

type Post = {
  slug: string; title_es: string; title_en: string; category: string;
  category_label: string; body_es: string; body_en: string; published_at: string;
};
type Related = { slug: string; title_es: string; category_label: string; excerpt: string };
type Comment = { id: string; name: string; comment: string; created_at: string };

export default function NoticiaDetallePage() {
  const params = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // comentario
  const [cName, setCName] = useState('');
  const [cText, setCText] = useState('');
  const [cBusy, setCBusy] = useState(false);
  const [cMsg, setCMsg] = useState('');
  // suscripción
  const [subEmail, setSubEmail] = useState('');
  const [subBusy, setSubBusy] = useState(false);
  const [subOk, setSubOk] = useState(false);

  const slug = params?.slug;

  const fetchAll = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await fetch(`/api/public/blog/posts/${slug}`);
      const d = r.ok ? await r.json() : null;
      setPost(d?.post || null);
      if (d?.post?.category) {
        const rr = await fetch(`/api/public/blog/posts?category=${d.post.category}&limit=4`);
        if (rr.ok) {
          const dd = await rr.json();
          setRelated((dd.posts || []).filter((p: Related) => p.slug !== slug).slice(0, 3));
        }
      }
      const rc = await fetch(`/api/public/blog/posts/${slug}/comments`);
      if (rc.ok) setComments((await rc.json()).comments || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = post ? `${post.title_es} — Ross House Rentals` : '';

  const share = (net: 'wa' | 'fb' | 'x') => {
    const u = encodeURIComponent(pageUrl);
    const t = encodeURIComponent(shareText);
    const links = {
      wa: `https://wa.me/?text=${t}%20${u}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    };
    window.open(links[net], '_blank', 'noopener,width=600,height=500');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const submitComment = async () => {
    if (!cName.trim() || cText.trim().length < 3) { setCMsg('Escribe tu nombre y un comentario'); return; }
    setCBusy(true); setCMsg('');
    try {
      const r = await fetch(`/api/public/blog/posts/${slug}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cName.trim(), comment: cText.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setComments(prev => [d.comment, ...prev]);
        setCText(''); setCMsg('¡Gracias por comentar! 🎉');
      } else setCMsg(d.detail || 'No se pudo publicar');
    } catch { setCMsg('Error de conexión'); }
    setCBusy(false);
  };

  const subscribe = async () => {
    if (!subEmail.includes('@')) return;
    setSubBusy(true);
    try {
      const r = await fetch('/api/public/newsletter/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail.trim(), source: 'blog' }),
      });
      if (r.ok) setSubOk(true);
    } catch { /* noop */ }
    setSubBusy(false);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
          </div>
        ) : !post ? (
          <div className="text-center py-16">
            <p className="text-slate-500">Post no encontrado.</p>
            <Link href="/noticias" className="text-cyan-600 font-semibold text-sm hover:underline">← Volver a Noticias</Link>
          </div>
        ) : (
          <>
            <article className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
              <Link href="/noticias" className="text-cyan-600 text-xs font-semibold hover:underline">← Noticias</Link>
              <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
                <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-full px-2.5 py-1">
                  {post.category_label}
                </span>
                <span className="text-[11px] text-slate-400">
                  {post.published_at ? new Date(post.published_at).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </span>
                <div className="ml-auto flex rounded-lg overflow-hidden border border-slate-200">
                  {(['es', 'en'] as const).map(l => (
                    <button key={l} onClick={() => setLang(l)}
                      className={`px-3 py-1 text-[11px] font-bold transition ${lang === l ? 'bg-cyan-600 text-white' : 'bg-white text-slate-500'}`}>
                      {l === 'es' ? 'Español' : 'English'}
                    </button>
                  ))}
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                {lang === 'es' ? post.title_es : (post.title_en || post.title_es)}
              </h1>
              <div className="mt-6 text-slate-700 text-[15px] leading-relaxed whitespace-pre-wrap">
                {lang === 'es' ? post.body_es : (post.body_en || post.body_es)}
              </div>

              {/* Compartir */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1">
                    <Share2 className="w-3.5 h-3.5" /> Compartir:
                  </span>
                  <button onClick={() => share('wa')} data-testid="share-wa"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                  <button onClick={() => share('fb')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition">
                    <Facebook className="w-3.5 h-3.5" /> Facebook
                  </button>
                  <button onClick={() => share('x')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition">
                    <Twitter className="w-3.5 h-3.5" /> X
                  </button>
                  <button onClick={copyLink}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Link2 className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado' : 'Copiar enlace'}
                  </button>
                </div>
              </div>
            </article>

            {/* Suscripción */}
            <div className="mt-6 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-white/15 rounded-xl"><Mail className="w-5 h-5" /></div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">Recibe estos consejos en tu email 📬</h3>
                  <p className="text-cyan-100 text-sm mt-0.5">Tips para rentar, comprar y cuidar tu hogar en Dumas — gratis, 2 veces por semana.</p>
                  {subOk ? (
                    <div className="mt-3 bg-white/15 rounded-xl px-4 py-3 text-sm font-semibold">✅ ¡Listo! Revisa tu correo — bienvenido a la comunidad.</div>
                  ) : (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && subscribe()}
                        placeholder="tu@email.com" data-testid="sub-email"
                        className="flex-1 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50" />
                      <button onClick={subscribe} disabled={subBusy || !subEmail.includes('@')} data-testid="sub-btn"
                        className="px-5 py-2.5 bg-white text-cyan-700 rounded-xl text-sm font-bold hover:bg-cyan-50 transition disabled:opacity-60">
                        {subBusy ? 'Enviando...' : 'Suscribirme'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comentarios */}
            <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-cyan-600" /> Comentarios ({comments.length})
              </h3>
              <div className="mt-4 space-y-2">
                <div className="grid sm:grid-cols-[200px_1fr] gap-2">
                  <input value={cName} onChange={e => setCName(e.target.value)} placeholder="Tu nombre" data-testid="comment-name"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400" />
                  <input value={cText} onChange={e => setCText(e.target.value)} placeholder="Escribe un comentario..." data-testid="comment-text"
                    onKeyDown={e => e.key === 'Enter' && submitComment()}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-400" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={submitComment} disabled={cBusy} data-testid="comment-btn"
                    className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition disabled:opacity-60">
                    {cBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Comentar
                  </button>
                  {cMsg && <span className="text-xs text-slate-500">{cMsg}</span>}
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400">Sé el primero en comentar 👇</p>
                )}
                {comments.map(c => (
                  <div key={c.id} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold flex items-center justify-center">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                      <span className="text-[11px] text-slate-400">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString('es-US', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5">{c.comment}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Relacionados */}
            {related.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-slate-900 mb-3">También te puede interesar</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {related.map(p => (
                    <Link key={p.slug} href={`/noticias/${p.slug}`}
                      className="bg-white border border-slate-200 rounded-xl p-4 hover:border-cyan-300 hover:shadow transition">
                      <span className="text-[10px] font-bold text-cyan-700">{p.category_label}</span>
                      <div className="text-sm font-semibold text-slate-900 mt-1 leading-snug">{p.title_es}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 text-center text-sm text-slate-500">
              ¿Buscas casa en Dumas? <Link href="/propiedades" className="text-cyan-600 font-semibold hover:underline">Mira nuestras propiedades disponibles</Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
