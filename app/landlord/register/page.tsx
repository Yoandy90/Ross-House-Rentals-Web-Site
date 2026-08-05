'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, User, Mail, Phone, Lock, MapPin, FileText, ArrowRight, CheckCircle2, Upload } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_RHR_API_URL || 'https://ross-house-backend-production.up.railway.app/api';

export default function LandlordRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>({
    name: '', email: '', phone: '', password: '', business_name: '',
    tax_id: '', address: '', city: '', state: 'TX', zip_code: '',
    bank_info: '', id_doc_base64: '',
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleId = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('ID demasiado grande (max 5MB)'); return; }
    const r = new FileReader();
    r.onload = () => set('id_doc_base64', r.result as string);
    r.readAsDataURL(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('Nombre, email y contraseña requeridos'); return; }
    if (form.password.length < 6) { setError('Contraseña mínimo 6 caracteres'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/public/landlord-register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (res.ok) setStep('success');
      else setError(d.detail || 'Error al registrar');
    } catch (err: any) { setError(err.message || 'Error de red'); }
    setLoading(false);
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#070912] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white/[0.03] border border-white/[0.06] rounded-3xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">¡Solicitud enviada!</h1>
          <p className="text-sm text-gray-400 mb-4">Tu cuenta de landlord fue creada con éxito. Nuestro equipo verificará tu información KYC en 24-72 horas y te enviaremos un email cuando esté aprobada.</p>
          <Link href="/" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl text-sm font-bold">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070912] flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/[0.06] rounded-full blur-3xl pointer-events-none" />
      <div className="max-w-2xl w-full relative">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center"><Building2 className="w-5 h-5 text-white" /></div>
          <div>
            <div className="text-sm font-bold text-white">Ross House Rentals</div>
            <div className="text-[10px] text-cyan-400 font-bold tracking-wider">REGISTRO DE LANDLORD</div>
          </div>
        </div>
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-3xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Únete como propietario</h1>
          <p className="text-sm text-gray-500 mb-6">Publica tus propiedades en Ross House Rentals · Comisión 10% del primer mes</p>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-sm text-red-300">{error}</div>}

          <form onSubmit={submit} className="space-y-4">
            <Section title="Información personal">
              <Grid>
                <Field icon={User} label="Nombre completo *"><input required value={form.name} onChange={e=>set('name',e.target.value)} className="inp" /></Field>
                <Field icon={Mail} label="Email *"><input type="email" required value={form.email} onChange={e=>set('email',e.target.value)} className="inp" /></Field>
                <Field icon={Phone} label="Teléfono"><input value={form.phone} onChange={e=>set('phone',e.target.value)} className="inp" /></Field>
                <Field icon={Lock} label="Contraseña *"><input type="password" required minLength={6} value={form.password} onChange={e=>set('password',e.target.value)} className="inp" /></Field>
              </Grid>
            </Section>
            <Section title="Información de negocio (KYC)">
              <Grid>
                <Field icon={Building2} label="Nombre del negocio / LLC"><input value={form.business_name} onChange={e=>set('business_name',e.target.value)} className="inp" placeholder="(Opcional, si aplicas como negocio)"/></Field>
                <Field icon={FileText} label="EIN / Tax ID"><input value={form.tax_id} onChange={e=>set('tax_id',e.target.value)} className="inp" placeholder="XX-XXXXXXX"/></Field>
              </Grid>
              <Field icon={MapPin} label="Dirección"><input value={form.address} onChange={e=>set('address',e.target.value)} className="inp" /></Field>
              <Grid>
                <Field icon={MapPin} label="Ciudad"><input value={form.city} onChange={e=>set('city',e.target.value)} className="inp"/></Field>
                <Field icon={MapPin} label="Estado"><input value={form.state} onChange={e=>set('state',e.target.value.toUpperCase().slice(0,2))} className="inp" maxLength={2}/></Field>
                <Field icon={MapPin} label="ZIP"><input value={form.zip_code} onChange={e=>set('zip_code',e.target.value)} className="inp"/></Field>
              </Grid>
              <Field icon={FileText} label="Información bancaria (opcional, se encriptará)"><textarea value={form.bank_info} onChange={e=>set('bank_info',e.target.value)} rows={2} className="inp resize-y" placeholder="Banco + routing + cuenta (o agrega después vía Stripe Connect)"/></Field>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1.5">ID oficial (driver license / passport)</label>
                <label className="flex flex-col items-center justify-center gap-2 p-6 bg-white/[0.02] border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-cyan-500/30 transition">
                  <Upload className="w-6 h-6 text-gray-500" />
                  <span className="text-xs text-gray-400">{form.id_doc_base64 ? 'Archivo cargado ✓' : 'Click para subir (max 5MB)'}</span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleId} />
                </label>
              </div>
            </Section>
            <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <>Crear cuenta <ArrowRight className="w-4 h-4"/></>}
            </button>
            <p className="text-[10px] text-gray-600 text-center">Al registrarte aceptas los términos y la política de privacidad. KYC tarda 24-72h.</p>
          </form>
        </div>
        <style>{`.inp { width: 100%; padding: 10px 12px 10px 36px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; color: #fff; font-size: 14px; outline: none; } .inp:focus { border-color: rgb(6, 182, 212); }`}</style>
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (<div className="space-y-3"><div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/[0.04] pb-1">{title}</div>{children}</div>);
}
function Grid({ children }: any) { return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>; }
function Field({ icon: Icon, label, children }: any) {
  return (<div><label className="block text-[11px] font-bold text-gray-400 mb-1">{label}</label><div className="relative"><Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>{children}</div></div>);
}
