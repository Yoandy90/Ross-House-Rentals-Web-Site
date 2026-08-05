'use client';

import React, { useEffect, useState } from 'react';
import { Maximize2, X, Download as DownloadIcon } from 'lucide-react';

export function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">{title}</h3>
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
        {children}
      </div>
    </div>
  );
}

export function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-sm">
      <span className="text-gray-400 flex items-center gap-2"><span className="text-gray-500">{icon}</span> {label}</span>
      <span className="text-white font-medium text-right">{value}</span>
    </div>
  );
}

export function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition text-left">
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {sub && <div className="text-xs text-gray-500">{sub}</div>}
      </div>
      <div className={`w-11 h-6 rounded-full p-0.5 transition ${value ? 'bg-amber-500' : 'bg-white/10'}`}>
        <div className={`w-5 h-5 rounded-full bg-white transition transform ${value ? 'translate-x-5' : ''}`} />
      </div>
    </button>
  );
}

export function MediaGrid({ items, icon, onOpen }: { items: string[]; icon: React.ReactNode; onOpen: (idx: number) => void }) {
  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-2">
        {items.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onOpen(i)}
            className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40 group focus:outline-none focus:ring-2 focus:ring-amber-500"
            title={`Abrir ${i + 1}`}
          >
            {/* eslint-disable-next-line */}
            <img src={src} alt={`media-${i}`} className="w-full h-full object-cover transition group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between p-1.5">
              <span className="text-[10px] text-white font-semibold flex items-center gap-1">{icon} {i + 1}</span>
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Lightbox({ urls, initialIndex, label, onClose }: { urls: string[]; initialIndex: number; label: string; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(urls.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [urls.length, onClose]);

  const download = () => {
    try {
      const a = document.createElement('a');
      a.href = urls[index];
      a.download = `proveedor-${index + 1}.jpg`;
      a.click();
    } catch { /* noop */ }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" onClick={onClose}>
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold bg-white/10 backdrop-blur px-3 py-1.5 rounded-full border border-white/20">
          {label} · {index + 1}/{urls.length}
        </div>
        <div className="flex gap-2">
          <button onClick={download} className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition" title="Descargar">
            <DownloadIcon className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-rose-500/30 border border-white/20 transition" title="Cerrar (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line */}
        <img src={urls[index]} alt={`Preview ${index + 1}`} className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />

        {urls.length > 1 && index > 0 && (
          <button onClick={() => setIndex(i => Math.max(0, i - 1))}
            className="absolute left-2 sm:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition"
            title="Anterior (←)">‹</button>
        )}
        {urls.length > 1 && index < urls.length - 1 && (
          <button onClick={() => setIndex(i => Math.min(urls.length - 1, i + 1))}
            className="absolute right-2 sm:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition"
            title="Siguiente (→)">›</button>
        )}
      </div>

      {urls.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto p-2 bg-white/5 backdrop-blur rounded-full border border-white/10" onClick={(e) => e.stopPropagation()}>
          {urls.map((u, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className={`w-10 h-10 rounded-md overflow-hidden border-2 transition flex-shrink-0 ${i === index ? 'border-amber-400' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              {/* eslint-disable-next-line */}
              <img src={u} alt={`thumb-${i}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
