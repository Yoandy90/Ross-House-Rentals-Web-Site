'use client';

import { useState } from 'react';
import Link from 'next/link';
import TurnstileWidget from './TurnstileWidget';
import { ArrowLeft, Home, DollarSign, Calendar, Users, Heart, Briefcase, Mail, Phone, MapPin, CheckCircle2, Globe, Sparkles, AlertCircle } from 'lucide-react';

type Lang = 'es' | 'en';

const T = {
  es: {
    title: 'Lista de Espera de Inquilinos',
    subtitle: 'Regístrate y te avisaremos cuando tengamos una propiedad disponible que coincida con tus criterios.',
    benefits: [
      { icon: '🏠', t: 'Acceso prioritario', d: 'Te avisamos antes de publicar en otras plataformas' },
      { icon: '📲', t: 'Alertas por email y SMS', d: 'Nunca pierdas una oportunidad' },
      { icon: '🎯', t: 'Match inteligente', d: 'Solo recibes propiedades que cumplen TU criterio' },
      { icon: '✅', t: '100% gratis', d: 'No cobramos por estar en la lista' },
    ],
    name: 'Nombre completo',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    bedrooms: '¿Cuántas habitaciones necesitas?',
    budget: 'Presupuesto máximo mensual',
    moveIn: '¿Cuándo te mudarías?',
    flexible: 'Flexible',
    household: '¿Cuántas personas vivirán contigo?',
    pets: '¿Tienes mascotas?',
    petDetails: 'Tipo y tamaño de mascota',
    situation: 'Situación actual',
    sitOptions: [
      ['renting', 'Rentando'],
      ['own', 'Propietario'],
      ['with_family', 'Con familiares'],
      ['other', 'Otro'],
    ],
    employment: 'Empleo',
    empOptions: [
      ['employed', 'Empleado'],
      ['self_employed', 'Independiente'],
      ['student', 'Estudiante'],
      ['retired', 'Jubilado'],
      ['unemployed', 'Buscando empleo'],
    ],
    income: 'Ingreso mensual (USD)',
    notesLabel: '¿Algo más que quieras decirnos?',
    notesPlaceholder: 'Comentarios adicionales (opcional)',
    submit: 'Únete a la lista de espera',
    submitting: 'Enviando...',
    successTitle: '¡Bienvenido a la lista!',
    successText: 'Te enviamos un correo y SMS de confirmación. Te avisaremos apenas tengamos una propiedad que coincida con tus criterios.',
    back: 'Volver al inicio',
    yes: 'Sí',
    no: 'No',
    required: 'Requerido',
    errorPrefix: 'Error: ',
    privacyNote: 'Tus datos están protegidos. Lee nuestra',
    privacyLink: 'Política de Privacidad',
  },
  en: {
    title: 'Tenant Waitlist',
    subtitle: "Sign up and we'll notify you when a property matching your criteria becomes available.",
    benefits: [
      { icon: '🏠', t: 'Priority access', d: 'Get alerts before we publish elsewhere' },
      { icon: '📲', t: 'Email & SMS alerts', d: "Never miss an opportunity" },
      { icon: '🎯', t: 'Smart matching', d: 'Only get properties that fit YOUR criteria' },
      { icon: '✅', t: '100% free', d: 'We don\'t charge to join the list' },
    ],
    name: 'Full name',
    email: 'Email address',
    phone: 'Phone number',
    bedrooms: 'How many bedrooms do you need?',
    budget: 'Max monthly budget',
    moveIn: 'When would you move in?',
    flexible: 'Flexible',
    household: 'How many people will live with you?',
    pets: 'Do you have pets?',
    petDetails: 'Pet type and size',
    situation: 'Current situation',
    sitOptions: [
      ['renting', 'Renting'],
      ['own', 'Homeowner'],
      ['with_family', 'With family'],
      ['other', 'Other'],
    ],
    employment: 'Employment',
    empOptions: [
      ['employed', 'Employed'],
      ['self_employed', 'Self-employed'],
      ['student', 'Student'],
      ['retired', 'Retired'],
      ['unemployed', 'Job seeking'],
    ],
    income: 'Monthly income (USD)',
    notesLabel: 'Anything else you\'d like to tell us?',
    notesPlaceholder: 'Additional comments (optional)',
    submit: 'Join the waitlist',
    submitting: 'Submitting...',
    successTitle: 'Welcome to the list!',
    successText: "We sent you a confirmation email and SMS. We'll let you know as soon as a matching property is available.",
    back: 'Back to home',
    yes: 'Yes',
    no: 'No',
    required: 'Required',
    errorPrefix: 'Error: ',
    privacyNote: 'Your data is protected. Read our',
    privacyLink: 'Privacy Policy',
  },
};

export default function TenantWaitlistForm({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    bedrooms_wanted: 2, max_budget: 1500,
    move_in_date: '', household_size: 1,
    has_pets: false, pet_details: '',
    current_situation: '', employment_status: '',
    monthly_income: 0, language_pref: lang,
    notes: '', source: 'web',
  });

  const set = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      setError(lang === 'es' ? 'Verifica el captcha antes de enviar' : 'Please complete the captcha');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/public/tenant-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, captcha_token: captchaToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCaptchaToken(null);
        setCaptchaKey(k => k + 1);
        throw new Error(data.detail || 'Failed');
      }
      setSubmitted(true);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#070B14] via-[#0a1530] to-[#070B14] text-white">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4">{t.successTitle}</h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">{t.successText}</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-full font-semibold transition">
            <ArrowLeft className="w-4 h-4" /> {t.back}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070B14] via-[#0a1530] to-[#070B14] text-white">
      <header className="border-b border-white/10 bg-[#0a1020]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> {t.back}
          </Link>
          <Link href={lang === 'es' ? '/interesados/en' : '/interesados'} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 px-3 py-2 rounded-lg border border-white/10 hover:border-emerald-500/30 transition">
            <Globe className="w-3.5 h-3.5" /> {lang === 'es' ? 'English' : 'Español'}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Ross House Rentals · Dumas, TX
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.title}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Benefits */}
          <aside className="lg:col-span-2 space-y-4">
            {t.benefits.map((b, i) => (
              <div key={i} className="flex gap-4 p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-emerald-500/30 transition">
                <div className="text-3xl">{b.icon}</div>
                <div>
                  <div className="font-bold text-white mb-1">{b.t}</div>
                  <div className="text-gray-400 text-sm">{b.d}</div>
                </div>
              </div>
            ))}
            <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                <Phone className="w-4 h-4" /> {lang === 'es' ? '¿Prefieres llamar?' : 'Prefer to call?'}
              </div>
              <a href="tel:+18069342018" className="text-white text-2xl font-bold hover:text-emerald-300">(806) 934-2018</a>
              <div className="text-gray-400 text-xs mt-1">{lang === 'es' ? 'Lun–Vie 9am–6pm CT' : 'Mon–Fri 9am–6pm CT'}</div>
            </div>
          </aside>

          {/* Form */}
          <form onSubmit={submit} className="lg:col-span-3 bg-white/[0.04] border border-white/10 rounded-3xl p-6 md:p-8 space-y-5">
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{t.errorPrefix}{error}</span>
              </div>
            )}

            <Field icon={<Users className="w-4 h-4" />} label={t.name} required>
              <input value={form.name} onChange={e => set('name', e.target.value)} required minLength={2} className="input" />
            </Field>
            <div className="grid md:grid-cols-2 gap-5">
              <Field icon={<Mail className="w-4 h-4" />} label={t.email} required>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="input" />
              </Field>
              <Field icon={<Phone className="w-4 h-4" />} label={t.phone} required>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required minLength={10} placeholder="(806) 555-1234" className="input" />
              </Field>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <Field icon={<Home className="w-4 h-4" />} label={t.bedrooms} required>
                <select value={form.bedrooms_wanted} onChange={e => set('bedrooms_wanted', parseInt(e.target.value))} className="input">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {lang === 'es' ? (n === 1 ? 'habitación' : 'habitaciones') : (n === 1 ? 'bedroom' : 'bedrooms')}</option>)}
                </select>
              </Field>
              <Field icon={<DollarSign className="w-4 h-4" />} label={t.budget} required>
                <input type="number" value={form.max_budget} min={500} max={10000} step={50} onChange={e => set('max_budget', parseFloat(e.target.value || '0'))} required className="input" />
              </Field>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <Field icon={<Calendar className="w-4 h-4" />} label={t.moveIn}>
                <input type="date" value={form.move_in_date} onChange={e => set('move_in_date', e.target.value)} className="input" />
              </Field>
              <Field icon={<Users className="w-4 h-4" />} label={t.household}>
                <input type="number" value={form.household_size} min={1} max={20} onChange={e => set('household_size', parseInt(e.target.value || '1'))} className="input" />
              </Field>
            </div>

            <Field icon={<Heart className="w-4 h-4" />} label={t.pets}>
              <div className="flex gap-2">
                <button type="button" onClick={() => set('has_pets', true)} className={`flex-1 py-2.5 rounded-xl font-medium transition ${form.has_pets ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{t.yes}</button>
                <button type="button" onClick={() => { set('has_pets', false); set('pet_details', ''); }} className={`flex-1 py-2.5 rounded-xl font-medium transition ${!form.has_pets ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{t.no}</button>
              </div>
            </Field>
            {form.has_pets && (
              <input value={form.pet_details} onChange={e => set('pet_details', e.target.value)} placeholder={t.petDetails} className="input" />
            )}

            <div className="grid md:grid-cols-2 gap-5">
              <Field icon={<MapPin className="w-4 h-4" />} label={t.situation}>
                <select value={form.current_situation} onChange={e => set('current_situation', e.target.value)} className="input">
                  <option value="">—</option>
                  {t.sitOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field icon={<Briefcase className="w-4 h-4" />} label={t.employment}>
                <select value={form.employment_status} onChange={e => set('employment_status', e.target.value)} className="input">
                  <option value="">—</option>
                  {t.empOptions.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>

            <Field icon={<DollarSign className="w-4 h-4" />} label={t.income}>
              <input type="number" value={form.monthly_income} min={0} step={100} onChange={e => set('monthly_income', parseFloat(e.target.value || '0'))} className="input" />
            </Field>

            <Field label={t.notesLabel}>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t.notesPlaceholder} rows={3} className="input resize-none" />
            </Field>

            {/* Cloudflare Turnstile — anti-bot CAPTCHA */}
            <div className="flex justify-center pt-2">
              <TurnstileWidget
                key={captchaKey}
                onToken={setCaptchaToken}
                theme="dark"
                size="flexible"
                action="waitlist-signup"
              />
            </div>

            <button type="submit" disabled={loading || !captchaToken} className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? t.submitting : t.submit}
            </button>

            <p className="text-xs text-gray-500 text-center">
              {t.privacyNote} <Link href={lang === 'es' ? '/privacy-policy/es' : '/privacy-policy'} className="text-emerald-400 hover:underline">{t.privacyLink}</Link>
            </p>
          </form>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 12px;
          color: white;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .input:focus {
          border-color: rgb(16 185 129);
          background: rgba(255,255,255,0.07);
        }
        .input::placeholder { color: rgba(255,255,255,0.30); }
        html[data-theme="light"] .input {
          background: #FFFFFF;
          border-color: #CBD5E1;
          color: #0F172A;
        }
        html[data-theme="light"] .input::placeholder { color: #94A3B8; }
      `}} />
    </div>
  );
}

function Field({ icon, label, required, children }: { icon?: React.ReactNode; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-1.5">
        {icon && <span className="text-emerald-400">{icon}</span>}
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}
