'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

const T: Record<string, Record<string, string>> = {
  es: {
    title: 'Formulario W-9', hello: 'Hola', intro: 'necesitamos tu W-9 para emitirte el formulario de impuestos 1099-NEC. Toma 2 minutos y tus datos van seguros.',
    legal: 'Nombre legal (como en tu declaración de impuestos) *', business: 'Nombre del negocio / DBA (opcional)',
    classification: 'Clasificación fiscal', individual: 'Individual / Sole proprietor', llc: 'LLC', corp: 'Corporación', partnership: 'Sociedad (Partnership)',
    tinType: 'Tipo de número fiscal', ssn: 'SSN (Seguro Social)', ein: 'EIN (Empresa)', tin: 'Número (9 dígitos) *',
    address: 'Dirección *', city: 'Ciudad *', state: 'Estado *', zip: 'Código postal *',
    certify: 'Certifico que el número fiscal es correcto, que no estoy sujeto a retención adicional (backup withholding) y que soy persona de EE.UU. (o extranjero residente).',
    signature: 'Firma (escribe tu nombre completo) *', submit: '✅ Enviar mi W-9', sending: 'Enviando…',
    thanks: '¡Listo! 🎉', thanksBody: 'Recibimos tu W-9. Te enviaremos tu 1099-NEC en enero. Gracias.',
    already: 'Ya recibimos tu W-9 anteriormente. ¡Gracias!', notFound: 'Enlace no válido o expirado.',
    secure: '🔒 Conexión segura · Solo se usa para tu formulario de impuestos', err: 'Revisa los campos marcados',
  },
  en: {
    title: 'Form W-9', hello: 'Hi', intro: 'we need your W-9 to issue your 1099-NEC tax form. It takes 2 minutes and your data is safe.',
    legal: 'Legal name (as shown on your tax return) *', business: 'Business name / DBA (optional)',
    classification: 'Tax classification', individual: 'Individual / Sole proprietor', llc: 'LLC', corp: 'Corporation', partnership: 'Partnership',
    tinType: 'Tax ID type', ssn: 'SSN (Social Security)', ein: 'EIN (Business)', tin: 'Number (9 digits) *',
    address: 'Street address *', city: 'City *', state: 'State *', zip: 'ZIP code *',
    certify: 'I certify the TIN is correct, I am not subject to backup withholding, and I am a U.S. person (or resident alien).',
    signature: 'Signature (type your full name) *', submit: '✅ Submit my W-9', sending: 'Sending…',
    thanks: 'All set! 🎉', thanksBody: 'We received your W-9. Your 1099-NEC will be sent in January. Thank you.',
    already: 'We already received your W-9. Thank you!', notFound: 'Invalid or expired link.',
    secure: '🔒 Secure connection · Only used for your tax form', err: 'Check the highlighted fields',
  },
};

const inputCls = 'w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-[#231F20] focus:outline-none focus:border-[#ED1B33] bg-white';
const labelCls = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1';

export default function W9Page() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [form, setForm] = useState<any>({
    legal_name: '', business_name: '', tax_classification: 'individual',
    tin_type: 'ssn', tin: '', address: '', city: '', state: 'TX', zip: '',
    certified: false, signature: '',
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const t = T[lang];

  useEffect(() => {
    fetch(`/api/public/w9/${token}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setData(d);
        if (d?.lang === 'en') setLang('en');
        if (d?.prefill) setForm((f: any) => ({ ...f, ...Object.fromEntries(Object.entries(d.prefill).filter(([, v]) => v)) }));
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    const tin = form.tin.replace(/[^\d]/g, '');
    if (!form.legal_name.trim() || tin.length !== 9 || !form.address.trim() || !form.city.trim() || !form.zip.trim() || !form.certified || !form.signature.trim()) {
      setError(t.err); return;
    }
    setSending(true);
    try {
      const r = await fetch(`/api/public/w9/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tin }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setDone(true);
      else setError(d.detail || t.err);
    } catch { setError('Error de conexión'); }
    setSending(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#ED1B33]/30 border-t-[#ED1B33] rounded-full animate-spin" />
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

  if (!data?.success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <img src="/logo.jpg" alt="Ross House Rentals" className="w-16 h-16 rounded-full border-2 border-[#ED1B33] mx-auto mb-4" />
        <p className="text-gray-600">{t.notFound}</p>
        <a href="tel:+18069342018" className="text-[#ED1B33] font-bold">(806) 934-2018</a>
      </div>
    </div>
  );

  if (done || data.completed) return (
    <div className="min-h-screen bg-gray-50">
      {Header}
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mt-6">
          <div className="text-5xl mb-3">🤝</div>
          <h2 className="text-xl font-extrabold text-[#231F20]">{t.thanks}</h2>
          <p className="text-gray-500 text-sm mt-2">{done ? t.thanksBody : t.already}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {Header}
      <div className="max-w-md mx-auto px-4 space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-extrabold text-[#231F20]">📝 {t.title}</h2>
          <p className="text-gray-500 text-sm mt-1">{t.hello} <b>{data.name}</b> 👋 — {t.intro}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className={labelCls}>{t.legal}</label>
            <input value={form.legal_name} onChange={e => set('legal_name', e.target.value)} className={inputCls} data-testid="w9-legal-name" />
          </div>
          <div>
            <label className={labelCls}>{t.business}</label>
            <input value={form.business_name} onChange={e => set('business_name', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t.classification}</label>
            <select value={form.tax_classification} onChange={e => set('tax_classification', e.target.value)} className={inputCls}>
              <option value="individual">{t.individual}</option>
              <option value="llc">{t.llc}</option>
              <option value="corporation">{t.corp}</option>
              <option value="partnership">{t.partnership}</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t.tinType}</label>
            <div className="flex gap-2">
              {(['ssn', 'ein'] as const).map(k => (
                <button key={k} onClick={() => set('tin_type', k)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition ${form.tin_type === k ? 'bg-[#ED1B33]/10 border-[#ED1B33] text-[#C41428]' : 'border-gray-200 text-gray-500'}`}>
                  {k === 'ssn' ? t.ssn : t.ein}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>{t.tin}</label>
            <input value={form.tin} onChange={e => set('tin', e.target.value.replace(/[^\d-]/g, '').slice(0, 11))}
              inputMode="numeric" placeholder={form.tin_type === 'ssn' ? '123-45-6789' : '12-3456789'} className={inputCls} data-testid="w9-tin" />
          </div>
          <div>
            <label className={labelCls}>{t.address}</label>
            <input value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} data-testid="w9-address" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className={labelCls}>{t.city}</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.state}</label>
              <input value={form.state} onChange={e => set('state', e.target.value.toUpperCase().slice(0, 2))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.zip}</label>
              <input value={form.zip} onChange={e => set('zip', e.target.value.replace(/[^\d-]/g, '').slice(0, 10))} inputMode="numeric" className={inputCls} />
            </div>
          </div>
          <label className="flex items-start gap-2.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.certified} onChange={e => set('certified', e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#ED1B33]" data-testid="w9-certify" />
            <span>{t.certify}</span>
          </label>
          <div>
            <label className={labelCls}>{t.signature}</label>
            <input value={form.signature} onChange={e => set('signature', e.target.value)}
              className={`${inputCls} italic`} style={{ fontFamily: 'cursive' }} data-testid="w9-signature" />
          </div>
          {error && <p className="text-xs font-bold text-[#C41428] bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <button onClick={submit} disabled={sending} data-testid="w9-submit"
            className="w-full bg-gradient-to-r from-[#ED1B33] to-[#C41428] text-white font-extrabold py-3.5 rounded-xl text-base disabled:opacity-60">
            {sending ? t.sending : t.submit}
          </button>
          <p className="text-[10px] text-gray-400 text-center">{t.secure}</p>
        </div>
      </div>
    </div>
  );
}
