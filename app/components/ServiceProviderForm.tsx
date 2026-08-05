'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import TurnstileWidget from './TurnstileWidget';
import {
  ArrowLeft, Mail, Phone, MapPin, Globe, Sparkles, Wrench, CheckCircle2,
  AlertCircle, Briefcase, DollarSign, Shield, Award, Languages, Building2,
  FileText, Camera, ImageIcon, X, Upload, Clock, Hammer, Layers,
} from 'lucide-react';

type Lang = 'es' | 'en';
type BillingType = 'per_hour' | 'per_job' | 'both';

const T = {
  es: {
    title: 'Únete a nuestra red de proveedores',
    subtitle: 'Plomeros, electricistas, jardineros, pintores, albañiles y más. Si ofreces servicios de mantenimiento o reparación, regístrate y te llamaremos cuando te necesitemos.',
    benefits: [
      { icon: '📄', t: 'Sin compromiso', d: 'Registro 100% gratis, sin cuotas ni contratos' },
      { icon: '📞', t: 'Te llamamos', d: 'Cuando necesitemos servicios en la zona' },
      { icon: '🤝', t: 'Tú decides', d: 'Aceptas o rechazas cada trabajo que te ofrezcamos' },
      { icon: '📋', t: 'Directorio local', d: 'Un contacto útil para ambos, sin exclusividad' },
    ],
    sectionContact: 'Información de contacto',
    sectionServices: 'Servicios que ofreces',
    sectionPricing: 'Modalidad y tarifas',
    sectionCredentials: 'Credenciales y documentos',
    sectionPortfolio: 'Fotos de trabajos anteriores',
    sectionBio: 'Sobre ti',
    name: 'Nombre completo',
    company: 'Nombre de empresa (opcional)',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    serviceAreas: 'Zonas que atiendes (códigos ZIP, separados por coma)',
    billingType: '¿Cómo cobras?',
    billingPerHour: 'Por hora',
    billingPerJob: 'Por trabajo terminado',
    billingBoth: 'Ambas (depende del trabajo)',
    hourlyRate: 'Tarifa por hora (USD)',
    projectMin: 'Proyecto mínimo (USD)',
    projectMax: 'Proyecto máximo (USD)',
    years: 'Años de experiencia',
    hasInsurance: '¿Tienes seguro de responsabilidad?',
    insuranceProvider: 'Aseguradora (opcional)',
    license: 'Número de licencia (opcional)',
    licenseDocs: 'Sube fotos de tu licencia, seguro o certificaciones (opcional)',
    licenseDocsHelp: 'Toma una foto con la cámara o sube desde tu dispositivo. Máximo 3 archivos.',
    workPhotos: 'Sube fotos de trabajos que hayas hecho (opcional)',
    workPhotosHelp: 'Muestra tu trabajo a posibles clientes. Máximo 6 fotos.',
    addPhoto: 'Agregar foto',
    addDocument: 'Agregar documento',
    takePhoto: 'Tomar foto',
    chooseFile: 'Elegir archivo',
    fileTooLarge: 'Archivo muy grande (máximo 5MB)',
    languages: 'Idiomas que hablas',
    bio: 'Cuenta brevemente sobre ti y tu experiencia',
    references: 'Referencias (clientes anteriores, opcional)',
    website: 'Sitio web o redes sociales (opcional)',
    submit: 'Registrarme como proveedor',
    submitting: 'Enviando...',
    successTitle: '¡Registro exitoso!',
    successText: 'Te enviamos un correo y SMS de confirmación. Revisaremos tu perfil y te contactaremos cuando tengamos un trabajo que coincida con tus servicios.',
    back: 'Volver al inicio',
    yes: 'Sí',
    no: 'No',
    errorPrefix: 'Error: ',
    privacyNote: 'Tus datos están protegidos. Lee nuestra',
    privacyLink: 'Política de Privacidad',
    selectAtLeastOne: 'Selecciona al menos un servicio',
  },
  en: {
    title: 'Join our provider network',
    subtitle: 'Plumbers, electricians, gardeners, painters, masons, and more. If you provide maintenance or repair services, register and we will call you when we need you.',
    benefits: [
      { icon: '📄', t: 'No commitment', d: 'Free signup, no fees, no contracts' },
      { icon: '📞', t: 'We call you', d: 'When we need service in your area' },
      { icon: '🤝', t: 'You decide', d: 'Accept or decline each job we offer' },
      { icon: '📋', t: 'Local directory', d: 'A useful contact for both of us, no exclusivity' },
    ],
    sectionContact: 'Contact info',
    sectionServices: 'Services you offer',
    sectionPricing: 'Billing & rates',
    sectionCredentials: 'Credentials & documents',
    sectionPortfolio: 'Photos of previous work',
    sectionBio: 'About you',
    name: 'Full name',
    company: 'Company name (optional)',
    email: 'Email address',
    phone: 'Phone',
    serviceAreas: 'Areas served (ZIP codes, comma separated)',
    billingType: 'How do you charge?',
    billingPerHour: 'Per hour',
    billingPerJob: 'Per finished job',
    billingBoth: 'Both (depends on the job)',
    hourlyRate: 'Hourly rate (USD)',
    projectMin: 'Project minimum (USD)',
    projectMax: 'Project maximum (USD)',
    years: 'Years of experience',
    hasInsurance: 'Do you have liability insurance?',
    insuranceProvider: 'Insurance provider (optional)',
    license: 'License number (optional)',
    licenseDocs: 'Upload photos of your license, insurance, or certifications (optional)',
    licenseDocsHelp: 'Take a photo with the camera or upload from your device. Max 3 files.',
    workPhotos: 'Upload photos of jobs you have done (optional)',
    workPhotosHelp: 'Show your work to potential clients. Max 6 photos.',
    addPhoto: 'Add photo',
    addDocument: 'Add document',
    takePhoto: 'Take photo',
    chooseFile: 'Choose file',
    fileTooLarge: 'File too large (max 5MB)',
    languages: 'Languages you speak',
    bio: 'Briefly tell us about yourself and your experience',
    references: 'References (previous clients, optional)',
    website: 'Website or social media (optional)',
    submit: 'Register as a provider',
    submitting: 'Submitting...',
    successTitle: 'Registration successful!',
    successText: "We sent you a confirmation email and SMS. We'll review your profile and contact you when we have a job matching your services.",
    back: 'Back to home',
    yes: 'Yes',
    no: 'No',
    errorPrefix: 'Error: ',
    privacyNote: 'Your data is protected. Read our',
    privacyLink: 'Privacy Policy',
    selectAtLeastOne: 'Select at least one service',
  },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENTS = 3;
const MAX_WORK_PHOTOS = 6;

// Compress an image file to a max width and return base64 data URL
async function compressImage(file: File, maxWidth = 1280, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image_failed'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas_failed'));
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ServiceProviderForm({ lang }: { lang: Lang }) {
  const t = T[lang];
  const [services, setServices] = useState<Array<{ id: string; es: string; en: string }>>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Numeric inputs as strings so user can fully clear them
  const [hourlyRate, setHourlyRate] = useState('');
  const [projectMin, setProjectMin] = useState('');
  const [projectMax, setProjectMax] = useState('');
  const [yearsExp, setYearsExp] = useState('');

  const [licenseDocs, setLicenseDocs] = useState<string[]>([]);
  const [workPhotos, setWorkPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const docCameraRef = useRef<HTMLInputElement | null>(null);
  const docFileRef = useRef<HTMLInputElement | null>(null);
  const photoCameraRef = useRef<HTMLInputElement | null>(null);
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: '', company_name: '', email: '', phone: '',
    service_areas: '',
    billing_type: 'per_hour' as BillingType,
    has_insurance: false, insurance_provider: '',
    license_number: '', languages: ['es'] as string[], bio: '',
    references_text: '', website: '', language_pref: lang, source: 'web',
  });

  useEffect(() => {
    fetch('/api/public/service-providers/services')
      .then(r => r.json())
      .then(d => setServices(d.services || []))
      .catch(() => { /* noop */ });
  }, []);

  const toggleService = (id: string) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const toggleLanguage = (l: string) => {
    setForm(f => ({ ...f, languages: f.languages.includes(l) ? f.languages.filter(x => x !== l) : [...f.languages, l] }));
  };

  const set = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  const handleFiles = async (
    files: FileList | null,
    target: 'docs' | 'photos',
  ) => {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const arr = Array.from(files);
      const max = target === 'docs' ? MAX_DOCUMENTS : MAX_WORK_PHOTOS;
      const current = target === 'docs' ? licenseDocs : workPhotos;
      const available = Math.max(0, max - current.length);
      const accepted = arr.slice(0, available);
      const added: string[] = [];
      for (const f of accepted) {
        if (f.size > MAX_FILE_SIZE * 2) {
          // truly huge file - skip
          setError(t.fileTooLarge);
          continue;
        }
        try {
          const b64 = await compressImage(f);
          added.push(b64);
        } catch {
          // noop
        }
      }
      if (target === 'docs') setLicenseDocs(prev => [...prev, ...added]);
      else setWorkPhotos(prev => [...prev, ...added]);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (target: 'docs' | 'photos', idx: number) => {
    if (target === 'docs') setLicenseDocs(prev => prev.filter((_, i) => i !== idx));
    else setWorkPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0) { setError(t.selectAtLeastOne); return; }
    if (!captchaToken) { setError(lang === 'es' ? 'Verifica el captcha antes de enviar' : 'Please complete the captcha'); return; }
    setLoading(true); setError(null);
    try {
      const payload = {
        ...form,
        services: selectedServices,
        service_areas: form.service_areas.split(',').map(z => z.trim()).filter(Boolean),
        hourly_rate: parseFloat(hourlyRate || '0') || 0,
        project_rate_min: parseFloat(projectMin || '0') || 0,
        project_rate_max: parseFloat(projectMax || '0') || 0,
        years_experience: parseInt(yearsExp || '0') || 0,
        license_documents: licenseDocs,
        work_photos: workPhotos,
        captcha_token: captchaToken,
      };
      const res = await fetch('/api/public/service-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Reset captcha so the user can try again (token is single-use)
        setCaptchaToken(null);
        setCaptchaKey(k => k + 1);
        throw new Error(data.detail || 'Failed');
      }
      setSubmitted(true);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* noop */ }
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#070B14] via-[#0d1a2e] to-[#070B14] text-white">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle2 className="w-14 h-14 text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4">{t.successTitle}</h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">{t.successText}</p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 rounded-full font-semibold transition">
            <ArrowLeft className="w-4 h-4" /> {t.back}
          </Link>
        </div>
      </div>
    );
  }

  const showHourly = form.billing_type === 'per_hour' || form.billing_type === 'both';
  const showProject = form.billing_type === 'per_job' || form.billing_type === 'both';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#070B14] via-[#0d1a2e] to-[#070B14] text-white">
      <header className="border-b border-white/10 bg-[#0a1020]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> {t.back}
          </Link>
          <Link href={lang === 'es' ? '/proveedores/en' : '/proveedores'} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-amber-400 px-3 py-2 rounded-lg border border-white/10 hover:border-amber-500/30 transition">
            <Globe className="w-3.5 h-3.5" /> {lang === 'es' ? 'English' : 'Español'}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
            <Wrench className="w-3.5 h-3.5" /> Ross House Rentals · Provider Network
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.title}</h1>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto">{t.subtitle}</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <aside className="lg:col-span-2 space-y-4">
            {t.benefits.map((b, i) => (
              <div key={i} className="flex gap-4 p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-amber-500/30 transition">
                <div className="text-3xl">{b.icon}</div>
                <div>
                  <div className="font-bold text-white mb-1">{b.t}</div>
                  <div className="text-gray-400 text-sm">{b.d}</div>
                </div>
              </div>
            ))}
            <div className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl">
              <div className="flex items-center gap-2 text-amber-300 font-bold mb-2">
                <Phone className="w-4 h-4" /> {lang === 'es' ? '¿Prefieres llamar?' : 'Prefer to call?'}
              </div>
              <a href="tel:+18069342018" className="text-white text-2xl font-bold hover:text-amber-300">(806) 934-2018</a>
            </div>
          </aside>

          <form id="provider-form" onSubmit={submit} className="lg:col-span-3 bg-white/[0.04] border border-white/10 rounded-3xl p-6 md:p-8 space-y-6 scroll-mt-24">
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{t.errorPrefix}{error}</span>
              </div>
            )}

            {/* Contact */}
            <SectionTitle icon={<Sparkles className="w-4 h-4" />} title={t.sectionContact} />
            <Field icon={<Briefcase className="w-4 h-4" />} label={t.name} required>
              <input value={form.name} onChange={e => set('name', e.target.value)} required minLength={2} className="input" />
            </Field>
            <Field icon={<Building2 className="w-4 h-4" />} label={t.company}>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="input" />
            </Field>
            <div className="grid md:grid-cols-2 gap-5">
              <Field icon={<Mail className="w-4 h-4" />} label={t.email} required>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="input" />
              </Field>
              <Field icon={<Phone className="w-4 h-4" />} label={t.phone} required>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required minLength={10} placeholder="(806) 555-1234" className="input" />
              </Field>
            </div>
            <Field icon={<MapPin className="w-4 h-4" />} label={t.serviceAreas}>
              <input value={form.service_areas} onChange={e => set('service_areas', e.target.value)} placeholder="79029, 79045, 79018" className="input" />
            </Field>

            {/* Services */}
            <SectionTitle icon={<Wrench className="w-4 h-4" />} title={t.sectionServices} />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {services.map(s => {
                const active = selectedServices.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition ${active ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                  >
                    {lang === 'es' ? s.es : s.en}
                  </button>
                );
              })}
            </div>

            {/* Billing & Pricing */}
            <SectionTitle icon={<DollarSign className="w-4 h-4" />} title={t.sectionPricing} />
            <Field icon={<Clock className="w-4 h-4" />} label={t.billingType}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['per_hour', t.billingPerHour, <Clock key="ph" className="w-4 h-4" />],
                  ['per_job', t.billingPerJob, <Hammer key="pj" className="w-4 h-4" />],
                  ['both', t.billingBoth, <Layers key="b" className="w-4 h-4" />],
                ] as const).map(([val, label, icon]) => {
                  const active = form.billing_type === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => set('billing_type', val)}
                      className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl border text-sm font-semibold transition ${active ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <div className="grid md:grid-cols-2 gap-5">
              {showHourly && (
                <Field label={t.hourlyRate}>
                  <input
                    type="number" inputMode="decimal" min={0} step={5}
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </Field>
              )}
              <Field icon={<Award className="w-4 h-4" />} label={t.years}>
                <input
                  type="number" inputMode="numeric" min={0} max={80}
                  value={yearsExp}
                  onChange={e => setYearsExp(e.target.value)}
                  placeholder="0"
                  className="input"
                />
              </Field>
            </div>
            {showProject && (
              <div className="grid md:grid-cols-2 gap-5">
                <Field label={t.projectMin}>
                  <input
                    type="number" inputMode="decimal" min={0} step={50}
                    value={projectMin}
                    onChange={e => setProjectMin(e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </Field>
                <Field label={t.projectMax}>
                  <input
                    type="number" inputMode="decimal" min={0} step={100}
                    value={projectMax}
                    onChange={e => setProjectMax(e.target.value)}
                    placeholder="0"
                    className="input"
                  />
                </Field>
              </div>
            )}

            {/* Credentials & Documents */}
            <SectionTitle icon={<Shield className="w-4 h-4" />} title={t.sectionCredentials} />
            <Field label={t.hasInsurance}>
              <div className="flex gap-2">
                <button type="button" onClick={() => set('has_insurance', true)} className={`flex-1 py-2.5 rounded-xl font-medium transition ${form.has_insurance ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{t.yes}</button>
                <button type="button" onClick={() => set('has_insurance', false)} className={`flex-1 py-2.5 rounded-xl font-medium transition ${!form.has_insurance ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{t.no}</button>
              </div>
            </Field>
            {form.has_insurance && (
              <Field label={t.insuranceProvider}>
                <input value={form.insurance_provider} onChange={e => set('insurance_provider', e.target.value)} className="input" />
              </Field>
            )}
            <Field label={t.license}>
              <input value={form.license_number} onChange={e => set('license_number', e.target.value)} className="input" />
            </Field>

            {/* Document upload */}
            <Field icon={<FileText className="w-4 h-4" />} label={t.licenseDocs}>
              <p className="text-xs text-gray-500 mb-2">{t.licenseDocsHelp}</p>
              <UploadGrid
                items={licenseDocs}
                onRemove={(i) => removeFile('docs', i)}
                onAddCamera={() => docCameraRef.current?.click()}
                onAddFile={() => docFileRef.current?.click()}
                takeLabel={t.takePhoto}
                fileLabel={t.chooseFile}
                addLabel={t.addDocument}
                max={MAX_DOCUMENTS}
                disabled={uploading}
              />
              <input ref={docCameraRef} type="file" accept="image/*" capture="environment"
                     className="hidden" onChange={(e) => { handleFiles(e.target.files, 'docs'); e.target.value = ''; }} />
              <input ref={docFileRef} type="file" accept="image/*" multiple
                     className="hidden" onChange={(e) => { handleFiles(e.target.files, 'docs'); e.target.value = ''; }} />
            </Field>

            {/* Languages */}
            <Field icon={<Languages className="w-4 h-4" />} label={t.languages}>
              <div className="flex gap-2">
                {[['es', '🇪🇸 Español'], ['en', '🇺🇸 English']].map(([code, label]) => {
                  const active = form.languages.includes(code);
                  return (
                    <button key={code} type="button" onClick={() => toggleLanguage(code)} className={`flex-1 py-2.5 rounded-xl font-medium transition ${active ? 'bg-amber-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{label}</button>
                  );
                })}
              </div>
            </Field>

            {/* Portfolio */}
            <SectionTitle icon={<ImageIcon className="w-4 h-4" />} title={t.sectionPortfolio} />
            <Field label={t.workPhotos}>
              <p className="text-xs text-gray-500 mb-2">{t.workPhotosHelp}</p>
              <UploadGrid
                items={workPhotos}
                onRemove={(i) => removeFile('photos', i)}
                onAddCamera={() => photoCameraRef.current?.click()}
                onAddFile={() => photoFileRef.current?.click()}
                takeLabel={t.takePhoto}
                fileLabel={t.chooseFile}
                addLabel={t.addPhoto}
                max={MAX_WORK_PHOTOS}
                disabled={uploading}
              />
              <input ref={photoCameraRef} type="file" accept="image/*" capture="environment"
                     className="hidden" onChange={(e) => { handleFiles(e.target.files, 'photos'); e.target.value = ''; }} />
              <input ref={photoFileRef} type="file" accept="image/*" multiple
                     className="hidden" onChange={(e) => { handleFiles(e.target.files, 'photos'); e.target.value = ''; }} />
            </Field>

            {/* Bio */}
            <SectionTitle icon={<FileText className="w-4 h-4" />} title={t.sectionBio} />
            <Field label={t.bio}>
              <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={4} className="input resize-none" />
            </Field>
            <Field label={t.references}>
              <textarea value={form.references_text} onChange={e => set('references_text', e.target.value)} rows={2} className="input resize-none" />
            </Field>
            <Field label={t.website}>
              <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://" className="input" />
            </Field>

            {/* Cloudflare Turnstile — anti-bot CAPTCHA */}
            <div className="flex justify-center pt-2">
              <TurnstileWidget
                key={captchaKey}
                onToken={setCaptchaToken}
                theme="dark"
                size="flexible"
                action="provider-signup"
              />
            </div>

            <button type="submit" disabled={loading || uploading || !captchaToken} className="w-full py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? t.submitting : t.submit}
            </button>

            <p className="text-xs text-gray-500 text-center">
              {t.privacyNote} <Link href={lang === 'es' ? '/privacy-policy/es' : '/privacy-policy'} className="text-amber-400 hover:underline">{t.privacyLink}</Link>
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
          border-color: rgb(245 158 11);
          background: rgba(255,255,255,0.07);
        }
        .input::placeholder { color: rgba(255,255,255,0.30); }
        /* Hide spinners on number inputs (cleaner mobile UX) */
        .input[type=number]::-webkit-outer-spin-button,
        .input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .input[type=number] { -moz-appearance: textfield; }
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
        {icon && <span className="text-amber-400">{icon}</span>}
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1 border-b border-white/10 text-sm font-bold text-amber-300">
      {icon} {title}
    </div>
  );
}

function UploadGrid({
  items, onRemove, onAddCamera, onAddFile, takeLabel, fileLabel, addLabel, max, disabled,
}: {
  items: string[];
  onRemove: (i: number) => void;
  onAddCamera: () => void;
  onAddFile: () => void;
  takeLabel: string;
  fileLabel: string;
  addLabel: string;
  max: number;
  disabled?: boolean;
}) {
  const canAdd = items.length < max && !disabled;
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {items.map((src, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40 group">
            {/* eslint-disable-next-line */}
            <img src={src} alt={`upload-${i}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500 border border-white/20 text-white flex items-center justify-center transition"
              aria-label="Remove"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {canAdd && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onAddCamera}
            disabled={!canAdd}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-sm font-medium transition disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {takeLabel}
          </button>
          <button
            type="button"
            onClick={onAddFile}
            disabled={!canAdd}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 text-sm font-medium transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {fileLabel}
          </button>
        </div>
      )}
      <div className="mt-2 text-[11px] text-gray-500">
        {items.length} / {max} · <span className="italic">{addLabel}</span>
      </div>
    </div>
  );
}
