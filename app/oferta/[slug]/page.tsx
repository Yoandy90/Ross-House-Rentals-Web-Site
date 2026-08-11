'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

const T: Record<string, Record<string, string>> = {
  es: {
    hello: 'Hola', want: 'Queremos comprar tu propiedad en:',
    offer: 'Nuestra oferta en efectivo', accept: '✅ Aceptar la oferta',
    counterTitle: '¿Tienes otro precio en mente?', counterPh: 'Tu precio (ej. 45000)',
    counterBtn: '💬 Enviar mi precio', askTitle: '¿Cuánto aceptarías por tu propiedad?',
    callTitle: '¿Prefieres hablar por teléfono?', phonePh: 'Tu teléfono',
    timePh: 'Mejor horario (ej. tardes)', callBtn: '📞 Llámenme',
    reject: 'No me interesa vender', rejectConfirm: '¿Seguro? Toca de nuevo para confirmar',
    msgPh: 'Mensaje (opcional)', thanks: '¡Gracias! 🎉',
    thanksBody: 'Recibimos tu respuesta. Te contactaremos muy pronto.',
    already: 'Ya recibimos tu respuesta anteriormente. ¡Gracias! Te contactaremos pronto.',
    expired: 'Esta oferta ha expirado, pero aún nos interesa tu propiedad. Llámanos:',
    valid: 'Oferta válida por 30 días · Sin compromiso', notFound: 'Enlace no válido o expirado.',
    cash: 'Pago en efectivo · Cierre rápido · Sin comisiones de agente',
  },
  en: {
    hello: 'Hello', want: 'We want to buy your property at:',
    offer: 'Our cash offer', accept: '✅ Accept the offer',
    counterTitle: 'Have another price in mind?', counterPh: 'Your price (e.g. 45000)',
    counterBtn: '💬 Send my price', askTitle: 'How much would you accept for your property?',
    callTitle: 'Prefer to talk by phone?', phonePh: 'Your phone number',
    timePh: 'Best time (e.g. afternoons)', callBtn: '📞 Call me',
    reject: "I'm not interested in selling", rejectConfirm: 'Sure? Tap again to confirm',
    msgPh: 'Message (optional)', thanks: 'Thank you! 🎉',
    thanksBody: 'We received your response. We will contact you very soon.',
    already: 'We already received your response. Thank you! We will contact you soon.',
    expired: 'This offer has expired, but we are still interested. Call us:',
    valid: 'Offer valid for 30 days · No obligation', notFound: 'Invalid or expired link.',
    cash: 'Cash payment · Fast closing · No agent fees',
  },
};

export default function OfertaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState('');
  const [bestTime, setBestTime] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [rejectArm, setRejectArm] = useState(false);
  const t = T[lang];

  useEffect(() => {
    fetch(`/api/public/oferta/${slug}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const respond = useCallback(async (action: string) => {
    setSending(true);
    try {
      const res = await fetch(`/api/public/oferta/${slug}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          price: action === 'counter' ? Number(price) || 0 : 0,
          phone, best_time: bestTime, message,
        }),
      });
      if (res.ok) setDone(true);
      else alert((await res.json()).detail || 'Error');
    } catch { alert('Error de conexión'); }
    setSending(false);
  }, [slug, price, phone, bestTime, message]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#ED1B33]/30 border-t-[#ED1B33] rounded-full animate-spin" />
    </div>
  );

  if (!data?.success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <img src="/logo.jpg" alt="Ross House Rentals" className="w-16 h-16 rounded-full border-2 border-[#ED1B33] mx-auto mb-4" />
        <p className="text-gray-600">{t.notFound}</p>
        <a href="tel:+18069342018" className="text-[#ED1B33] font-bold">(806) 934-2018</a>
      </div>
    </div>
  );

  const Header = (
    <div className="text-center pt-8 pb-2">
      <img src="/logo.jpg" alt="Ross House Rentals" className="w-16 h-16 rounded-full border-[3px] border-[#ED1B33] mx-auto" />
      <h1 className="text-lg font-extrabold text-[#231F20] mt-2">Ross House Rentals</h1>
      <p className="text-[10px] font-bold tracking-[3px] text-[#ED1B33] uppercase">LLC · Dumas, Texas</p>
      <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
        className="mt-2 text-[11px] font-bold text-gray-400 border border-gray-200 rounded-full px-3 py-1">
        {lang === 'es' ? '🇺🇸 English' : '🇲🇽 Español'}
      </button>
    </div>
  );

  if (done || data.responded) return (
    <div className="min-h-screen bg-gray-50">
      {Header}
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mt-6">
          <div className="text-5xl mb-3">🤝</div>
          <h2 className="text-xl font-extrabold text-[#231F20]">{t.thanks}</h2>
          <p className="text-gray-500 text-sm mt-2">{done ? t.thanksBody : t.already}</p>
          <a href="tel:+18069342018" className="inline-block mt-5 bg-gradient-to-r from-[#ED1B33] to-[#C41428] text-white font-bold px-6 py-3 rounded-xl text-sm">
            📞 (806) 934-2018
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {Header}
      <div className="max-w-md mx-auto px-4 space-y-4">
        {/* Saludo + propiedad */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 text-center">
          <h2 className="text-2xl font-extrabold text-[#231F20]">{t.hello} {data.owner_first} 👋</h2>
          <p className="text-gray-500 text-sm mt-1">{t.want}</p>
          <p className="text-base font-bold text-[#231F20] mt-2">📍 {data.address}</p>
          <div className="mt-3 rounded-2xl overflow-hidden border border-gray-100">
            <iframe title="mapa" width="100%" height="180" style={{ border: 0 }} loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(data.address)}&z=16&output=embed`} />
          </div>
          <p className="text-[11px] text-emerald-600 font-bold mt-3">💵 {t.cash}</p>
        </div>

        {data.expired ? (
          <div className="bg-white rounded-3xl shadow-sm border border-amber-200 p-6 text-center">
            <p className="text-sm text-gray-600">{t.expired}</p>
            <a href="tel:+18069342018" className="text-[#ED1B33] font-extrabold text-lg">(806) 934-2018</a>
          </div>
        ) : (
          <>
            {/* Oferta con monto */}
            {data.mode === 'amount' && data.amount > 0 && (
              <div className="bg-gradient-to-br from-[#ED1B33] to-[#C41428] rounded-3xl shadow-lg p-6 text-center text-white">
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">{t.offer}</p>
                <p className="text-4xl font-black mt-1">${Number(data.amount).toLocaleString('en-US')}</p>
                <p className="text-[11px] opacity-75 mt-1">{t.valid}</p>
                <button onClick={() => respond('accept')} disabled={sending}
                  className="mt-4 w-full bg-white text-[#C41428] font-extrabold py-4 rounded-2xl text-base shadow disabled:opacity-60">
                  {t.accept}
                </button>
              </div>
            )}

            {/* Contraoferta / pedir precio */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-extrabold text-[#231F20] text-base">
                {data.mode === 'amount' ? t.counterTitle : t.askTitle}
              </h3>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xl font-bold text-gray-400">$</span>
                <input value={price} onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric" placeholder={t.counterPh}
                  className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-bold text-[#231F20] focus:border-[#ED1B33] focus:outline-none" />
              </div>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.phonePh} inputMode="tel"
                className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#ED1B33] focus:outline-none" />
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={t.msgPh} rows={2}
                className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-[#ED1B33] focus:outline-none" />
              <button onClick={() => respond('counter')} disabled={sending || !price}
                className="mt-3 w-full bg-[#231F20] text-white font-extrabold py-3.5 rounded-2xl text-sm disabled:opacity-40">
                {t.counterBtn}
              </button>
            </div>

            {/* Llámenme */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-extrabold text-[#231F20] text-base">{t.callTitle}</h3>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t.phonePh} inputMode="tel"
                className="w-full mt-3 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#ED1B33] focus:outline-none" />
              <input value={bestTime} onChange={e => setBestTime(e.target.value)} placeholder={t.timePh}
                className="w-full mt-2 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-[#ED1B33] focus:outline-none" />
              <button onClick={() => respond('call')} disabled={sending || !phone}
                className="mt-3 w-full border-2 border-[#ED1B33] text-[#ED1B33] font-extrabold py-3.5 rounded-2xl text-sm disabled:opacity-40">
                {t.callBtn}
              </button>
            </div>

            {/* No me interesa */}
            <div className="text-center pt-1">
              <button onClick={() => { if (rejectArm) respond('reject'); else setRejectArm(true); }}
                disabled={sending}
                className="text-xs text-gray-400 underline">
                {rejectArm ? t.rejectConfirm : t.reject}
              </button>
            </div>
          </>
        )}

        <p className="text-center text-[10px] text-gray-400 pt-2">
          Ross House Rentals LLC · Dumas, TX · <a href="tel:+18069342018" className="text-[#ED1B33] font-bold">(806) 934-2018</a>
        </p>
      </div>
    </div>
  );
}
