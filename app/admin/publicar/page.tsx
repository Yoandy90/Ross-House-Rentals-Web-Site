'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../layout';
import {
  Megaphone, Copy, Check, Sparkles, RefreshCw, ExternalLink,
  Loader2, Rss, ChevronDown, ChevronUp, Home,
} from 'lucide-react';

type Listing = {
  listing_id: string; property_id: string; unit_id: string | null;
  name: string; address: string; city: string; state: string; zip: string;
  bedrooms: number; bathrooms: number; square_feet: number;
  rent: number; deposit: number; photos: string[];
  ad_copy?: { es: AdLang; en: AdLang; generated_at: string } | null;
};
type AdLang = { title: string; description: string; bullets: string[]; social: string };

const fmt = (n: number) => `$${(n || 0).toLocaleString('en-US')}`;

const PORTALS = [
  { name: 'Zillow Rental Manager', url: 'https://rentalmanager.zillow.com', how: 'Crea el anuncio manualmente y pega el título + descripción generados por la IA. Zillow lo publica también en Trulia y HotPads.' },
  { name: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/create/rental', how: 'Usa el "Post social" generado — está optimizado con emojis y teléfono. Sube las mismas fotos de la propiedad.' },
  { name: 'Zumper (feed para partners)', url: 'https://www.zumper.com/list-your-property', how: 'Regístrate como landlord. Si te dan opción de feed XML (property management software), comparte la URL del feed de abajo.' },
  { name: 'Apartments.com', url: 'https://www.apartments.com/advertise/', how: 'Publica manualmente con el texto en inglés generado por la IA.' },
];

function CopyBtn({ k, text, copied, onCopy }: { k: string; text: string; copied: string; onCopy: (k: string, t: string) => void }) {
  return (
    <button onClick={() => onCopy(k, text)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-white/[0.05] border border-white/[0.08] text-gray-400 hover:text-white transition">
      {copied === k ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} {copied === k ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export default function PublicarPage() {
  const { headers } = useAdminAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [genBusy, setGenBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [showPortals, setShowPortals] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/listings/publish-info', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setListings(d.listings || []);
        setFeedUrl(d.feed_url || '');
      }
    } catch { /* noop */ }
    setLoading(false);
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch { notify('No se pudo copiar', false); }
  };

  const generate = async (l: Listing) => {
    setGenBusy(l.listing_id);
    try {
      const res = await fetch(`/api/admin/listings/${l.property_id}/ad-copy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ unit_id: l.unit_id }),
      });
      const d = await res.json();
      if (res.ok) { notify('Anuncio generado ✨'); load(); }
      else notify(d.detail || 'Error generando', false);
    } catch { notify('Error de red', false); }
    setGenBusy('');
  };



  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.ok ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>{toast.msg}</div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Megaphone className="w-6 h-6 text-pink-400" /> Publicar Anuncios</h1>
        <p className="text-xs text-gray-500 mt-1">Genera anuncios con IA para tus propiedades disponibles y publícalos en Zillow, Facebook Marketplace, Zumper y más.</p>
      </div>

      {/* Feed URL */}
      <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white"><Rss className="w-4 h-4 text-orange-400" /> Feed XML de propiedades disponibles</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-[11px] text-cyan-300 truncate">{feedUrl}</code>
          <CopyBtn k="feed" text={feedUrl} copied={copied} onCopy={copy} />
          <a href={feedUrl} target="_blank" rel="noreferrer" className="p-1.5 text-gray-500 hover:text-white"><ExternalLink className="w-4 h-4" /></a>
        </div>
        <p className="text-[11px] text-gray-500">Se actualiza automáticamente: solo incluye propiedades/unidades <span className="text-emerald-400 font-bold">disponibles</span> con sus fotos. Compártelo con portales que acepten feeds (Zumper/Hotpads partners).</p>
      </div>

      {/* Portales */}
      <div className="border border-white/[0.06] rounded-2xl overflow-hidden">
        <button onClick={() => setShowPortals(!showPortals)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-white bg-white/[0.02]">
          <span>📣 Dónde publicar (guía rápida)</span>
          {showPortals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPortals && (
          <div className="divide-y divide-white/[0.04]">
            {PORTALS.map(p => (
              <div key={p.name} className="px-4 py-3 flex flex-wrap items-start gap-2">
                <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-bold text-cyan-400 hover:underline min-w-[210px]">{p.name} <ExternalLink className="w-3 h-3" /></a>
                <p className="flex-1 text-[11px] text-gray-500 min-w-[240px]">{p.how}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-gray-500 animate-spin" /></div>
      ) : listings.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-12">No hay propiedades ni unidades <b>disponibles</b> ahora mismo.<br />Cuando una quede libre aparecerá aquí lista para publicar. 🎉</p>
      ) : (
        listings.map(l => {
          const ad = l.ad_copy?.[lang];
          return (
            <div key={l.listing_id} className="border border-white/[0.06] rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Home className="w-5 h-5 text-cyan-400" />
                <div className="flex-1 min-w-[180px]">
                  <div className="font-bold text-white">{l.name}</div>
                  <div className="text-[11px] text-gray-500">{l.address}, {l.city} · {l.bedrooms}hab/{l.bathrooms}ba{l.square_feet ? ` · ${l.square_feet} ft²` : ''} · {l.photos.length} foto(s)</div>
                </div>
                <div className="text-lg font-bold text-cyan-400">{fmt(l.rent)}<span className="text-[10px] text-gray-600">/mes</span></div>
                <button onClick={() => generate(l)} disabled={genBusy === l.listing_id}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/15 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-bold hover:bg-violet-500/25 transition disabled:opacity-40">
                  {genBusy === l.listing_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {l.ad_copy ? 'Regenerar anuncio' : 'Generar anuncio con IA'}
                </button>
              </div>

              {l.ad_copy && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {(['es', 'en'] as const).map(lg => (
                      <button key={lg} onClick={() => setLang(lg)} className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition ${lang === lg ? 'bg-pink-500/15 text-pink-300 border-pink-500/30' : 'bg-white/[0.03] text-gray-500 border-white/[0.06]'}`}>
                        {lg === 'es' ? '🇲🇽 Español' : '🇺🇸 English'}
                      </button>
                    ))}
                    <span className="text-[10px] text-gray-600 self-center ml-2">Generado: {l.ad_copy.generated_at?.slice(0, 10)}</span>
                  </div>
                  {ad && (
                    <>
                      <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Título</span>
                          <CopyBtn k={`t-${l.listing_id}-${lang}`} text={ad.title} copied={copied} onCopy={copy} />
                        </div>
                        <p className="text-sm font-bold text-white">{ad.title}</p>
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Descripción (Zillow/Apartments.com)</span>
                          <CopyBtn k={`d-${l.listing_id}-${lang}`} text={`${ad.description}\n\n${(ad.bullets || []).map(b => `• ${b}`).join('\n')}`} copied={copied} onCopy={copy} />
                        </div>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{ad.description}</p>
                        {(ad.bullets || []).length > 0 && (
                          <ul className="mt-2 space-y-0.5">{ad.bullets.map((b, i) => <li key={i} className="text-xs text-gray-400">• {b}</li>)}</ul>
                        )}
                      </div>
                      <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Post social (Facebook Marketplace)</span>
                          <CopyBtn k={`s-${l.listing_id}-${lang}`} text={ad.social} copied={copied} onCopy={copy} />
                        </div>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap">{ad.social}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
