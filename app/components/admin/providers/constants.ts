import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Provider = any;
export type Status = 'active' | 'paused' | 'blacklisted' | 'pending_review';

export const STATUS_CFG: Record<Status, { label: string; color: string; icon: LucideIcon }> = {
  active:         { label: 'Activo',      color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  pending_review: { label: 'Pendiente',   color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',     icon: Clock },
  paused:         { label: 'Pausado',     color: 'bg-slate-500/15 text-slate-300 border-slate-500/30',     icon: Clock },
  blacklisted:    { label: 'Lista negra', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',        icon: XCircle },
};

export const SERVICE_ICONS: Record<string, string> = {
  plumber: '🚰', electrician: '⚡', hvac: '❄️', mason: '🧱', painter: '🎨',
  gardener: '🌿', cleaner: '🧹', locksmith: '🔐', roofer: '🏠',
  appliance_repair: '🔧', pest_control: '🐜', handyman: '🛠️',
  flooring: '🪵', drywall: '🧱', tile: '⬜', concrete: '⚪', fence: '🚧',
  pool: '🏊', security: '🛡️', other: '📦',
};

export const SERVICE_LABELS: Record<string, string> = {
  plumber: 'Plomero', electrician: 'Electricista', hvac: 'HVAC',
  mason: 'Albañil', painter: 'Pintor', gardener: 'Jardinero',
  cleaner: 'Limpieza', locksmith: 'Cerrajero', roofer: 'Techos',
  appliance_repair: 'Electrodomésticos', pest_control: 'Plagas', handyman: 'Mantenimiento',
  flooring: 'Pisos', drywall: 'Tablaroca', tile: 'Azulejos', concrete: 'Concreto',
  fence: 'Cercas', pool: 'Piscinas', security: 'Seguridad', other: 'Otro',
};

export const PAYMENT_METHODS: Array<{ id: string; label: string; icon: string }> = [
  { id: 'cash', label: 'Efectivo', icon: '💵' },
  { id: 'check', label: 'Cheque', icon: '📝' },
  { id: 'zelle', label: 'Zelle', icon: '🏦' },
  { id: 'cashapp', label: 'CashApp', icon: '💵' },
  { id: 'venmo', label: 'Venmo', icon: '💜' },
  { id: 'stripe_ach', label: 'Stripe ACH', icon: '🏦' },
  { id: 'stripe_card', label: 'Tarjeta', icon: '💳' },
  { id: 'wire', label: 'Transferencia', icon: '🌐' },
  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
  { id: 'other', label: 'Otro', icon: '📦' },
];

export function methodLabel(id: string): string {
  const m = PAYMENT_METHODS.find(x => x.id === id);
  return m ? `${m.icon} ${m.label}` : id;
}
