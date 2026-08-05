'use client';

import React, { useState } from 'react';
import {
  Mail, Phone, MapPin, Globe, ExternalLink, DollarSign, Award, Briefcase,
  Shield, Star, Clock, Hammer, Layers, Send, Trash2, X, FileText, Camera,
} from 'lucide-react';
import { useAdminAuth } from '../../../admin/layout';
import { STATUS_CFG, SERVICE_ICONS, SERVICE_LABELS, type Provider, type Status } from './constants';
import { Section, Info, MediaGrid, Lightbox } from './ui';
import DispatchModal from './DispatchModal';
import RateModal from './RateModal';
import { PaymentModal, PaymentsSection } from './PaymentModal';

export default function ProviderDetailDrawer({ provider: p, onClose, onUpdate }: { provider: Provider; onClose: () => void; onUpdate: () => void }) {
  const { headers } = useAdminAuth();
  const [notes, setNotes] = useState(p.admin_notes || '');
  const [status, setStatus] = useState<Status>(p.status);
  const [isFeatured, setIsFeatured] = useState(!!p.is_featured);
  const [showDispatch, setShowDispatch] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number; label: string } | null>(null);

  const billingLabels: Record<string, { label: string; icon: any }> = {
    per_hour: { label: 'Por hora', icon: Clock },
    per_job: { label: 'Por trabajo terminado', icon: Hammer },
    both: { label: 'Por hora o por trabajo', icon: Layers },
  };
  const billing = billingLabels[p.billing_type as string] || billingLabels.per_hour;
  const BillingIcon = billing.icon;

  const save = async () => {
    await fetch(`/api/admin/service-providers/${p._id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ status, admin_notes: notes, is_featured: isFeatured }),
    });
    onUpdate();
  };

  const del = async () => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await fetch(`/api/admin/service-providers/${p._id}`, { method: 'DELETE', headers: headers() });
    onClose(); onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0a1020] border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 bg-[#0a1020]/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {isFeatured && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
              {p.name}
            </h2>
            {p.company_name && <p className="text-xs text-gray-500">{p.company_name}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <Section title="Contacto">
            <Info icon={<Mail className="w-4 h-4" />} label="Email" value={<a href={`mailto:${p.email}`} className="text-amber-400 hover:underline">{p.email}</a>} />
            <Info icon={<Phone className="w-4 h-4" />} label="Teléfono" value={<a href={`tel:${p.phone}`} className="text-amber-400 hover:underline">{p.phone}</a>} />
            <Info icon={<MapPin className="w-4 h-4" />} label="Zonas" value={(p.service_areas || []).join(', ') || '—'} />
            <Info icon={<Globe className="w-4 h-4" />} label="Idiomas" value={(p.languages || []).join(', ').toUpperCase()} />
            {p.website && <Info icon={<ExternalLink className="w-4 h-4" />} label="Web" value={<a href={p.website} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline truncate">{p.website}</a>} />}
          </Section>

          <Section title="Servicios">
            <div className="px-3 py-3 flex flex-wrap gap-1.5">
              {(p.services || []).map((s: string) => (
                <span key={s} className="px-2.5 py-1 rounded-lg text-xs bg-amber-500/10 border border-amber-500/20 text-amber-200">
                  {SERVICE_ICONS[s]} {SERVICE_LABELS[s] || s}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Tarifas y experiencia">
            <Info icon={<BillingIcon className="w-4 h-4" />} label="Modalidad" value={<span className="text-amber-300 font-semibold">{billing.label}</span>} />
            {(p.billing_type === 'per_hour' || p.billing_type === 'both' || !p.billing_type) && (
              <Info icon={<DollarSign className="w-4 h-4" />} label="Por hora" value={p.hourly_rate ? `$${p.hourly_rate}` : '—'} />
            )}
            {(p.billing_type === 'per_job' || p.billing_type === 'both') && (
              <Info icon={<DollarSign className="w-4 h-4" />} label="Proyecto mín/máx" value={`$${p.project_rate_min || 0} – $${p.project_rate_max || 0}`} />
            )}
            <Info icon={<Award className="w-4 h-4" />} label="Experiencia" value={p.years_experience ? `${p.years_experience} años` : '—'} />
            <Info icon={<Briefcase className="w-4 h-4" />} label="Trabajos" value={`${p.completed_jobs || 0} completados / ${p.total_jobs || 0} totales`} />
            <Info icon={<Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />} label="Rating" value={`${(p.rating || 0).toFixed(2)} / 5`} />
          </Section>

          <Section title="Credenciales">
            <Info icon={<Shield className="w-4 h-4" />} label="Seguro" value={p.has_insurance ? `Sí ${p.insurance_provider ? `(${p.insurance_provider})` : ''}` : 'No'} />
            <Info icon={<Award className="w-4 h-4" />} label="Licencia #" value={p.license_number || '—'} />
          </Section>

          {Array.isArray(p.license_documents) && p.license_documents.length > 0 && (
            <Section title={`Licencia y documentos (${p.license_documents.length})`}>
              <MediaGrid items={p.license_documents} icon={<FileText className="w-3.5 h-3.5" />}
                onOpen={(idx) => setLightbox({ urls: p.license_documents, index: idx, label: `Documento ${idx + 1} de ${p.license_documents.length}` })} />
            </Section>
          )}

          {Array.isArray(p.work_photos) && p.work_photos.length > 0 && (
            <Section title={`Fotos de trabajos anteriores (${p.work_photos.length})`}>
              <MediaGrid items={p.work_photos} icon={<Camera className="w-3.5 h-3.5" />}
                onOpen={(idx) => setLightbox({ urls: p.work_photos, index: idx, label: `Trabajo ${idx + 1} de ${p.work_photos.length}` })} />
            </Section>
          )}

          {p.bio && <Section title="Bio"><div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{p.bio}</div></Section>}
          {p.references_text && <Section title="Referencias"><div className="p-3 text-sm text-gray-300 whitespace-pre-wrap">{p.references_text}</div></Section>}

          <Section title="Gestión interna">
            <div className="p-3 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-400 mb-1.5 block">Estado</span>
                <select value={status} onChange={e => setStatus(e.target.value as Status)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm">
                  {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={e => setIsFeatured(e.target.checked)} />
                <span className="text-sm">⭐ Proveedor destacado</span>
              </label>
              <label className="block">
                <span className="text-xs text-gray-400 mb-1.5 block">Notas internas</span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm" />
              </label>
              <button onClick={save} className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 font-semibold text-sm">Guardar cambios</button>
            </div>
          </Section>

          {(p.dispatch_history?.length || 0) > 0 && (
            <Section title={`Historial de trabajos enviados (${p.dispatch_history.length})`}>
              <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                {p.dispatch_history.slice().reverse().map((d: any, i: number) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs">
                    <div className="text-gray-500 text-[10px] mb-1">{d.sent_at ? new Date(d.sent_at).toLocaleString('es-MX') : ''}</div>
                    <div className="font-semibold mb-1">{d.subject}</div>
                    <div className="text-gray-300 line-clamp-2">{d.message}</div>
                    <div className="flex gap-2 mt-1.5">
                      {d.email && <span className="text-emerald-400">📧 ✓</span>}
                      {d.sms && <span className="text-cyan-400">📱 ✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div className="flex gap-2 pt-3">
            <button onClick={() => setShowDispatch(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-semibold text-sm">
              <Send className="w-4 h-4" /> Enviar trabajo
            </button>
            <button onClick={() => setShowPayment(true)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-semibold text-sm">
              💰 Pagar
            </button>
            <button onClick={() => setShowRate(true)} className="px-4 py-3 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-sm" title="Calificar">
              <Star className="w-4 h-4" />
            </button>
            <button onClick={del} className="px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-sm">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <PaymentsSection provider={p} />
        </div>

        {showDispatch && <DispatchModal provider={p} onClose={() => setShowDispatch(false)} onSent={() => { setShowDispatch(false); onUpdate(); }} />}
        {showRate && <RateModal provider={p} onClose={() => setShowRate(false)} onSent={() => { setShowRate(false); onUpdate(); }} />}
        {showPayment && <PaymentModal provider={p} onClose={() => setShowPayment(false)} onSaved={() => { setShowPayment(false); onUpdate(); }} />}
        {lightbox && (
          <Lightbox urls={lightbox.urls} initialIndex={lightbox.index} label={lightbox.label} onClose={() => setLightbox(null)} />
        )}
      </div>
    </div>
  );
}
