'use client';

/**
 * Recruit Share Panel — admin tool to spread the contractor signup link.
 *
 * Lets the admin:
 *   - Copy the link (with UTM campaign tag)
 *   - Open Facebook / WhatsApp / X share dialogs (web)
 *   - Send the link via SMS / Email from the backend
 *   - View / print a QR code (uses public api.qrserver.com)
 */
import React, { useMemo, useState } from 'react';
import {
  Copy, Check, Facebook, MessageCircle, Twitter, Mail, Phone, QrCode,
  Send, X, ExternalLink, Sparkles, Loader2,
} from 'lucide-react';

const BASE_URL = 'https://www.rosshouserentals.com/proveedores';

export default function ProviderRecruitPanel({ token }: { token: string | null }) {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [campaign, setCampaign] = useState<string>('share');
  const [copied, setCopied] = useState(false);
  const [openModal, setOpenModal] = useState<null | 'sms' | 'email' | 'qr'>(null);

  const fullLink = useMemo(() => {
    const url = lang === 'en' ? `${BASE_URL}/en` : BASE_URL;
    return `${url}?utm_source=share&utm_medium=admin&utm_campaign=${encodeURIComponent(campaign || 'share')}`;
  }, [lang, campaign]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('No se pudo copiar. Copia manualmente:\n' + fullLink);
    }
  };

  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullLink)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('¿Eres contratista? Únete a Ross House Rentals en Dumas TX 👷‍♂️')}&url=${encodeURIComponent(fullLink)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent('👷‍♂️ Únete a la red de contratistas de Ross House Rentals. Sin contrato, trabajos directos: ' + fullLink)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(fullLink)}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-sm leading-tight">Recluta más contratistas</h3>
          <p className="text-[11px] text-slate-500 leading-tight">Comparte el formulario y trackea conversiones</p>
        </div>
      </div>

      {/* Lang + campaign */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Idioma</label>
          <div className="flex bg-slate-100 p-0.5 rounded-md">
            <button onClick={() => setLang('es')} className={`flex-1 py-1 rounded text-[11px] font-bold ${lang === 'es' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>🇲🇽 ES</button>
            <button onClick={() => setLang('en')} className={`flex-1 py-1 rounded text-[11px] font-bold ${lang === 'en' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>🇺🇸 EN</button>
          </div>
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Campaña UTM</label>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value.replace(/\s+/g, '_').toLowerCase().slice(0, 32))}
            placeholder="facebook_jun"
            className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1.5 font-mono"
          />
        </div>
      </div>

      {/* Link preview + copy */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-[10px] text-slate-700 truncate">
          {fullLink}
        </div>
        <button
          onClick={copy}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
            copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
        </button>
      </div>

      {/* Share buttons grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <ShareBtn href={fbUrl} bg="bg-[#1877F2]" icon={<Facebook className="w-4 h-4" />} label="Facebook" />
        <ShareBtn href={waUrl} bg="bg-emerald-500" icon={<MessageCircle className="w-4 h-4" />} label="WhatsApp" />
        <ShareBtn href={xUrl} bg="bg-black" icon={<Twitter className="w-4 h-4" />} label="X" />
        <ActionBtn onClick={() => setOpenModal('sms')}    bg="bg-blue-600"   icon={<Phone className="w-4 h-4" />}   label="SMS" />
        <ActionBtn onClick={() => setOpenModal('email')}  bg="bg-violet-600" icon={<Mail className="w-4 h-4" />}    label="Email" />
        <ActionBtn onClick={() => setOpenModal('qr')}     bg="bg-slate-900"  icon={<QrCode className="w-4 h-4" />}  label="QR" />
      </div>

      {openModal === 'sms' && <SendModal type="sms" lang={lang} campaign={campaign} token={token} onClose={() => setOpenModal(null)} />}
      {openModal === 'email' && <SendModal type="email" lang={lang} campaign={campaign} token={token} onClose={() => setOpenModal(null)} />}
      {openModal === 'qr' && (
        <Modal onClose={() => setOpenModal(null)} title="Código QR para imprimir">
          <div className="text-center">
            {/* eslint-disable-next-line */}
            <img src={qrUrl} alt="QR Code" width={300} height={300} className="mx-auto rounded-lg border border-slate-200" />
            <p className="text-[11px] text-slate-500 mt-3 break-all">{fullLink}</p>
            <a
              href={qrUrl}
              download="proveedores-qr.png"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
            >
              <ExternalLink className="w-4 h-4" /> Descargar PNG
            </a>
            <p className="text-[10px] text-slate-400 mt-3">Imprime y pega en tiendas, ferreterías o eventos locales.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function ShareBtn({ href, bg, icon, label }: { href: string; bg: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${bg} text-white py-2.5 rounded-lg flex flex-col items-center gap-1 hover:opacity-90 active:scale-[0.97] transition`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </a>
  );
}

function ActionBtn({ onClick, bg, icon, label }: { onClick: () => void; bg: string; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`${bg} text-white py-2.5 rounded-lg flex flex-col items-center gap-1 hover:opacity-90 active:scale-[0.97] transition`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SendModal({ type, lang, campaign, token, onClose }: {
  type: 'sms' | 'email'; lang: 'es' | 'en'; campaign: string; token: string | null; onClose: () => void;
}) {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    if (!to.trim() || !token) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/service-providers/share-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channel: type,
          to: to.trim(),
          lang,
          campaign: campaign || 'share',
          message: msg.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      setResult({ ok: true, text: type === 'sms' ? '✅ SMS enviado correctamente' : '✅ Email enviado correctamente' });
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setResult({ ok: false, text: 'Error: ' + (e.message || 'falló el envío') });
    }
    setSending(false);
  };

  const isSms = type === 'sms';
  return (
    <Modal onClose={onClose} title={isSms ? 'Enviar link por SMS' : 'Enviar link por Email'}>
      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            {isSms ? 'Número de teléfono' : 'Email destino'}
          </label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            type={isSms ? 'tel' : 'email'}
            placeholder={isSms ? '+1 (806) 555-1234' : 'contratista@ejemplo.com'}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
            autoFocus
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-1">
            Mensaje (opcional, se agrega antes del link)
          </label>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            rows={isSms ? 2 : 4}
            maxLength={isSms ? 160 : 600}
            placeholder={isSms
              ? 'Mensaje personalizado (opcional)'
              : 'Saludo o invitación personalizada (opcional)'}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-amber-500"
          />
          <div className="text-[10px] text-slate-400 text-right mt-0.5">
            {msg.length} / {isSms ? 160 : 600}
          </div>
        </div>
        {result && (
          <div className={`text-xs p-2.5 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {result.text}
          </div>
        )}
        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50"
          >Cancelar</button>
          <button
            onClick={send}
            disabled={sending || !to.trim()}
            className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </Modal>
  );
}
