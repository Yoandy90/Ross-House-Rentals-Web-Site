'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Home, Users, FileText, ClipboardList, CornerDownLeft, Loader2 } from 'lucide-react';

type MenuItem = { href: string; label: string; desc: string };
type ApiResult = { type: string; id: string; title: string; subtitle: string; href: string };

const TYPE_ICON: Record<string, any> = {
  property: Home, tenant: Users, contract: FileText, application: ClipboardList,
};

export default function CommandPalette({ open, onClose, menuItems, headers }: {
  open: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  headers: () => Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [apiResults, setApiResults] = useState<ApiResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQ(''); setApiResults([]); setSel(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Debounced backend search (tenants, properties, contracts, applications)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setApiResults([]); setSearching(false); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/global-search?q=${encodeURIComponent(q.trim())}`, { headers: headers() });
        const d = await res.json().catch(() => ({}));
        setApiResults(res.ok ? (d.results || []) : []);
      } catch { setApiResults([]); }
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, headers]);

  const menuMatches = q.trim()
    ? menuItems.filter(i => `${i.label} ${i.desc}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : menuItems.slice(0, 8);

  const all: Array<{ key: string; title: string; subtitle: string; href: string; Icon: any; kind: string }> = [
    ...menuMatches.map(m => ({ key: `menu-${m.href}`, title: m.label, subtitle: m.desc, href: m.href, Icon: Search, kind: 'Menú' })),
    ...apiResults.map(r => ({ key: `${r.type}-${r.id}`, title: r.title, subtitle: r.subtitle, href: r.href, Icon: TYPE_ICON[r.type] || Search, kind: 'Datos' })),
  ];

  const go = useCallback((href: string) => { onClose(); router.push(href); }, [onClose, router]);

  useEffect(() => { setSel(0); }, [q, apiResults.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#0b1220] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, all.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
          if (e.key === 'Enter' && all[sel]) go(all[sel].href);
        }}>
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
          {searching ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> : <Search className="w-4 h-4 text-slate-400 dark:text-gray-500" />}
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar páginas, inquilinos, propiedades, contratos..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none"
            data-testid="command-palette-input"
          />
          <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-gray-500 font-bold">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {all.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-slate-400 dark:text-gray-500">
              {q.trim().length >= 2 && !searching ? 'Sin resultados' : 'Escribe para buscar en todo el sistema'}
            </div>
          )}
          {all.map((r, i) => (
            <button key={r.key} onClick={() => go(r.href)} onMouseEnter={() => setSel(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                i === sel ? 'bg-blue-500/10' : ''
              }`}>
              <r.Icon className={`w-4 h-4 flex-shrink-0 ${i === sel ? 'text-blue-400' : 'text-slate-400 dark:text-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold truncate ${i === sel ? 'text-blue-500 dark:text-blue-300' : 'text-slate-800 dark:text-gray-200'}`}>{r.title}</div>
                <div className="text-[10px] text-slate-400 dark:text-gray-500 truncate">{r.subtitle}</div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-gray-500 font-bold uppercase">{r.kind}</span>
              {i === sel && <CornerDownLeft className="w-3 h-3 text-blue-400" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
