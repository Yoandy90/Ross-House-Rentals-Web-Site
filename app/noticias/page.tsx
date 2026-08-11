'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';

type Post = {
  slug: string; title_es: string; title_en: string;
  category: string; category_label: string; excerpt: string; published_at: string;
};

function SubscribeBanner() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const subscribe = async () => {
    if (!email.includes('@')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/public/newsletter/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'blog' }),
      });
      if (r.ok) setOk(true);
    } catch { /* noop */ }
    setBusy(false);
  };

  return (
    <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-5 sm:p-6 text-white shadow-lg mb-8 max-w-2xl mx-auto">
      {ok ? (
        <div className="text-center text-sm font-semibold py-2">✅ ¡Listo! Bienvenido a la comunidad — revisa tu correo.</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 text-center sm:text-left">
            <div className="font-bold">Recibe estos consejos en tu email 📬</div>
            <div className="text-cyan-100 text-xs mt-0.5">Gratis · 2 por semana · date de baja cuando quieras</div>
          </div>
          <div className="flex w-full sm:w-auto gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && subscribe()}
              placeholder="tu@email.com" data-testid="list-sub-email"
              className="flex-1 sm:w-52 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50" />
            <button onClick={subscribe} disabled={busy || !email.includes('@')} data-testid="list-sub-btn"
              className="px-4 py-2.5 bg-white text-cyan-700 rounded-xl text-sm font-bold hover:bg-cyan-50 transition disabled:opacity-60">
              {busy ? '...' : 'Suscribirme'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NoticiasPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<{ key: string; label: string }[]>([]);
  const [cat, setCat] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      const r = await fetch(`/api/public/blog/posts?limit=30${cat ? `&category=${cat}` : ''}`);
      if (r.ok) {
        const d = await r.json();
        setPosts(d.posts || []);
        setCategories(d.categories || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [cat]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="max-w-5xl mx-auto px-4 pt-28 pb-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Noticias y Consejos</h1>
          <p className="text-slate-500 mt-2 text-sm sm:text-base">
            Guías prácticas para rentar, comprar y cuidar tu hogar en Dumas, Texas 🏠
          </p>
        </div>

        {/* Suscripción destacada */}
        <SubscribeBanner />

        {/* Filtro por categoría */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button onClick={() => setCat('')}
            className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition ${!cat ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400'}`}>
            Todas
          </button>
          {categories.map(c => (
            <button key={c.key} onClick={() => setCat(cat === c.key ? '' : c.key)}
              className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition ${cat === c.key ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Muy pronto publicaremos consejos y noticias aquí. ¡Vuelve pronto! ✨
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map(p => (
              <Link key={p.slug} href={`/noticias/${p.slug}`}
                className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-cyan-300 transition flex flex-col">
                <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-full px-2.5 py-1 self-start mb-3">
                  {p.category_label}
                </span>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-cyan-700 transition leading-snug">
                  {p.title_es}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 italic">{p.title_en}</p>
                <p className="text-sm text-slate-500 mt-2 line-clamp-3 flex-1">{p.excerpt}</p>
                <div className="text-[11px] text-slate-400 mt-3">
                  {p.published_at ? new Date(p.published_at).toLocaleDateString('es-US', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                  <span className="text-cyan-600 font-semibold float-right group-hover:underline">Leer más →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
