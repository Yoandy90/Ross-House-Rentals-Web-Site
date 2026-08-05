import { ArrowLeft, Shield, FileText, Globe, Trash2, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

const BACKEND_URL = process.env.BACKEND_URL || 'https://ross-house-backend-production.up.railway.app';

export type LegalDocKey = 'terms' | 'privacy' | 'cookies' | 'account_deletion';

const ICONS: Record<LegalDocKey, any> = {
  terms: FileText,
  privacy: Shield,
  cookies: Globe,
  account_deletion: Trash2,
};

const SLUGS: Record<LegalDocKey, { en: string; es: string }> = {
  terms: { en: '/terms', es: '/terms/es' },
  privacy: { en: '/privacy-policy', es: '/privacy-policy/es' },
  cookies: { en: '/cookies', es: '/cookies/es' },
  account_deletion: { en: '/delete-account', es: '/delete-account/es' },
};

async function fetchDocument(docKey: LegalDocKey, lang: 'es' | 'en'): Promise<{ content: string; updated_at: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/legal-documents`, {
      next: { revalidate: 60 }, // ISR: re-fetch every 60s
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      content: data[`${docKey}_${lang}`] || '',
      updated_at: data.updated_at || '',
    };
  } catch (e) {
    console.error('[LegalDocumentPage] fetch failed', e);
    return { content: '', updated_at: '' };
  }
}

// Tiny Markdown -> HTML renderer (supports # ## ### , **bold**, - lists, links, paragraphs)
function renderMarkdown(md: string): string {
  if (!md) return '';
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let inOrderedList = false;

  const inline = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-emerald-300 text-xs">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-emerald-400 hover:text-emerald-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');

  for (let raw of lines) {
    const line = raw.replace(/\r$/, '');
    if (/^\s*$/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      continue;
    }
    if (/^###\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      html += `<h3 class="text-lg font-bold text-white mt-6 mb-3">${inline(line.replace(/^###\s+/, ''))}</h3>`;
    } else if (/^##\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      html += `<h2 class="text-xl font-bold text-white mt-8 mb-3 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>${inline(line.replace(/^##\s+/, ''))}</h2>`;
    } else if (/^#\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      html += `<h1 class="text-3xl font-bold text-white mt-4 mb-6">${inline(line.replace(/^#\s+/, ''))}</h1>`;
    } else if (/^\s*-\s+/.test(line)) {
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      if (!inList) { html += '<ul class="list-disc pl-6 space-y-1.5 text-gray-300 mb-4">'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*-\s+/, ''))}</li>`;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inOrderedList) { html += '<ol class="list-decimal pl-6 space-y-1.5 text-gray-300 mb-4">'; inOrderedList = true; }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      html += `<p class="text-gray-300 leading-relaxed mb-4">${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  if (inOrderedList) html += '</ol>';
  return html;
}

export default async function LegalDocumentPage({
  docKey,
  lang,
  title,
}: {
  docKey: LegalDocKey;
  lang: 'es' | 'en';
  title: string;
}) {
  const { content, updated_at } = await fetchDocument(docKey, lang);
  const otherLang = lang === 'es' ? 'en' : 'es';
  const otherUrl = SLUGS[docKey][otherLang];
  const Icon = ICONS[docKey];

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <header className="border-b border-white/10 bg-[#0a1020]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="text-xs text-gray-500">Ross House Rentals LLC</p>
            </div>
          </div>
          <Link
            href={otherUrl}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 px-3 py-2 rounded-lg border border-white/10 hover:border-emerald-500/30 transition"
          >
            <Globe className="w-3.5 h-3.5" /> {otherLang === 'es' ? 'Español' : 'English'}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {updated_at && (
          <p className="text-gray-400 mb-6 text-sm">
            <strong>{lang === 'es' ? 'Última actualización' : 'Last updated'}:</strong>{' '}
            {new Date(updated_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        )}

        {content ? (
          <article
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
            <p className="text-amber-300 text-sm">
              {lang === 'es'
                ? 'No se ha publicado contenido aún. El administrador puede gestionarlo desde el panel.'
                : 'No content has been published yet. The administrator can manage it from the panel.'}
            </p>
          </div>
        )}

        <section className="mt-12 bg-white/5 rounded-2xl p-6 border border-white/10">
          <h3 className="text-base font-bold mb-3 text-white">
            {lang === 'es' ? 'Contacto' : 'Contact'}
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 text-gray-300">
              <Mail className="w-4 h-4 text-emerald-400" />
              <a href="mailto:privacy@rosshouserentals.com" className="hover:text-emerald-400">privacy@rosshouserentals.com</a>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Phone className="w-4 h-4 text-emerald-400" />
              <a href="tel:+18069342018" className="hover:text-emerald-400">(806) 934-2018</a>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>305 Bruce Ave, Dumas, TX 79029, {lang === 'es' ? 'EE.UU.' : 'USA'}</span>
            </div>
          </div>
        </section>

        <p className="text-sm text-gray-500 border-t border-white/10 pt-6 mt-12">
          © {new Date().getFullYear()} Ross House Rentals LLC. {lang === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'}
        </p>
      </main>
    </div>
  );
}
