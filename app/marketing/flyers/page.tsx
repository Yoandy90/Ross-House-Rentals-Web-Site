import Link from 'next/link';
import { ChevronLeft, Download, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Flyers de marketing · Ross House Rentals',
  robots: { index: false, follow: false },
};

const CONCEPTS = [
  { key: 'bold',         name: 'Bold & Energetic',       tagline: 'Alto contraste · Naranja / Navy',   emoji: '🔥' },
  { key: 'professional', name: 'Professional & Modern',  tagline: 'Elegante · Violeta / Indigo',       emoji: '✨' },
  { key: 'trust',        name: 'Trust & Local',          tagline: 'Confianza · Verde / Amarillo',      emoji: '🌱' },
];

const FORMATS = [
  { key: 'square',     label: 'Cuadrado 1080×1080',  desc: 'Feed FB / Instagram / WhatsApp', ratio: 'aspect-square' },
  { key: 'vertical',   label: 'Vertical 1080×1920',  desc: 'Stories / Reels / TikTok',       ratio: 'aspect-[9/16]' },
  { key: 'horizontal', label: 'Horizontal 1200×630', desc: 'Link preview / Cover FB',         ratio: 'aspect-[1200/630]' },
];

export default function FlyersPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-3">
              <ChevronLeft className="w-3.5 h-3.5" /> Volver al admin
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">Flyers de Facebook</h1>
                <p className="text-sm text-slate-400">9 diseños listos — click para descargar</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total</div>
            <div className="text-3xl font-black text-white">9</div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-8 bg-gradient-to-br from-indigo-950/40 to-violet-950/40 border border-white/[0.06] rounded-2xl p-5">
          <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-fuchsia-400" /> Cómo usar
          </h3>
          <ol className="space-y-1.5 text-sm text-slate-300">
            <li>1. Elige el diseño y formato que quieras (o descárgalos todos)</li>
            <li>2. Click en <strong className="text-white">&quot;Descargar&quot;</strong> — se guarda como PNG</li>
            <li>3. Súbelo a Facebook / Instagram junto con el texto del post que ya te dí</li>
            <li>4. <strong className="text-fuchsia-300">Formato Cuadrado</strong> = feed de FB · <strong className="text-fuchsia-300">Vertical</strong> = Stories/Reels · <strong className="text-fuchsia-300">Horizontal</strong> = link preview / cover</li>
          </ol>
        </div>

        {/* Grid: 3 concepts × 3 formats */}
        <div className="space-y-10">
          {CONCEPTS.map(concept => (
            <section key={concept.key}>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-2xl">{concept.emoji}</span>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight">{concept.name}</h2>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">{concept.tagline}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FORMATS.map(format => {
                  const src = `/api/marketing/flyer?concept=${concept.key}&format=${format.key}`;
                  const filename = `flyer-${concept.key}-${format.key}.png`;
                  return (
                    <div key={format.key} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.15] transition group">
                      <div className={`${format.ratio} bg-slate-900 overflow-hidden flex items-center justify-center`}>
                        {/* preview via <img> intentional (data endpoint) */}
                        <img src={src} alt={`${concept.name} ${format.label}`} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="p-4">
                        <div className="text-sm font-bold text-white leading-tight mb-1">{format.label}</div>
                        <div className="text-[11px] text-slate-500 mb-3">{format.desc}</div>
                        <a
                          href={src}
                          download={filename}
                          className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-indigo-500 to-violet-600 hover:brightness-110 text-white text-sm font-bold py-2.5 rounded-xl shadow-md shadow-indigo-500/30 transition"
                        >
                          <Download className="w-4 h-4" /> Descargar PNG
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Post text ready to copy */}
        <div className="mt-12 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/[0.06] rounded-3xl p-6">
          <h3 className="text-lg font-black text-white mb-1">📝 Texto para copiar en Facebook</h3>
          <p className="text-xs text-slate-400 mb-4">Copia este texto y súbelo junto con la imagen que descargaste</p>
          <pre className="whitespace-pre-wrap text-sm text-slate-200 bg-black/40 p-4 rounded-2xl border border-white/5 leading-relaxed font-sans">
{`📋 DIRECTORIO DE CONTRATISTAS DE DUMAS · Regístrate

¿Eres plomero, electricista, técnico HVAC, jardinero, pintor, albañil o handyman en Dumas o cercanías?

Ross House Rentals está armando una base de datos de proveedores locales para contactar cuando necesitemos servicios en las casas de renta que administramos.

✅ Registro GRATIS · 2 minutos
✅ Sin compromisos ni cuotas
✅ Sin exclusividad — tú sigues con tus otros clientes
✅ Cuando necesitemos servicios, te llamamos
✅ Tú decides si aceptas el trabajo o no
✅ Servicio bilingüe 🇺🇸🇲🇽

Regístrate aquí 👉 https://www.rosshouserentals.com/proveedores?utm_source=facebook&utm_campaign=directory-2026

🏠 Ross House Rentals LLC · Dumas, TX 79029
📞 (806) 934-2018

#DumasTX #Contratistas #Plomero #Electricista #Jardinero #HVAC`}
          </pre>
        </div>

        <p className="mt-10 text-center text-xs text-slate-600">
          🎨 Diseños generados con Next.js + @vercel/og · sin costo AI · CDN edge
        </p>
      </div>
    </div>
  );
}
