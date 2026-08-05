'use client';

import React, { useState } from 'react';
import { useAdminAuth } from '../../../admin/layout';

export default function DispatchModal({ provider, onClose, onSent }: { provider: any; onClose: () => void; onSent: () => void }) {
  const { headers } = useAdminAuth();
  const [subject, setSubject] = useState('Ross House Rentals — Trabajo de mantenimiento');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(true);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) { alert('Escribe el detalle del trabajo'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/admin/service-providers/dispatch', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ provider_id: provider._id, subject, message, via_email: email, via_sms: sms }),
      });
      const data = await res.json();
      alert(`Email: ${data.email_sent ? '✓' : '✗'} | SMS: ${data.sms_sent ? '✓' : '✗'}`);
      onSent();
    } catch (e: any) { alert('Error: ' + e.message); }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0a1020] border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-1">Enviar trabajo a {provider.name}</h3>
        <p className="text-xs text-gray-500 mb-4">Se enviará por los canales seleccionados</p>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto" className="w-full px-3 py-2 mb-3 bg-white/5 border border-white/10 rounded-lg text-sm" />
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Detalle del trabajo: dirección, fecha, descripción, precio estimado..." rows={6} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
        <div className="flex gap-3 mt-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> Email</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} /> SMS</label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">Cancelar</button>
          <button disabled={sending} onClick={send} className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 font-semibold text-sm disabled:opacity-50">
            {sending ? 'Enviando...' : 'Enviar trabajo'}
          </button>
        </div>
      </div>
    </div>
  );
}
