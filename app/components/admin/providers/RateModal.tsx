'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { useAdminAuth } from '../../../admin/layout';

export default function RateModal({ provider, onClose, onSent }: { provider: any; onClose: () => void; onSent: () => void }) {
  const { headers } = useAdminAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/service-providers/${provider._id}/rate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rating, comment }),
      });
      onSent();
    } catch (e: any) { alert('Error: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a1020] border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4">Calificar a {provider.name}</h3>
        <div className="flex justify-center gap-2 mb-5">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} className="transition hover:scale-110">
              <Star className={`w-10 h-10 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentario (opcional)" rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm mb-4" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">Cancelar</button>
          <button disabled={saving} onClick={save} className="flex-1 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm disabled:opacity-50">
            {saving ? 'Guardando...' : 'Calificar'}
          </button>
        </div>
      </div>
    </div>
  );
}
