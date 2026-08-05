'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  UserCog, Search, Plus, Home, DollarSign, CreditCard,
  Phone, Mail, Building2, ChevronDown, ChevronUp,
  Banknote, CheckCircle2, X, Edit3, Trash2, Save, AlertCircle, FileText, Wrench,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  tax_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  status: string;
  kyc_status?: string;
  stripe_connected?: boolean;
  stripe_account_id?: string;
  created_at?: string;
  stats: {
    admin_properties: number;
    marketplace_listings: number;
    total_properties: number;
    revenue_ytd: number;
    maintenance_ytd: number;
    paid_ytd: number;
    pending_payout: number;
  };
}

interface OwnerDetail {
  owner: Owner;
  admin_properties: any[];
  marketplace_listings: any[];
  payments: any[];
  expenses: any[];
  payouts: any[];
  contracts: any[];
  summary: any;
}

export default function PropietariosPage() {
  const { headers } = useAdminAuth();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, OwnerDetail>>({});
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', tax_id: '',
    address: '', city: '', state: 'TX', zip_code: '', password: '',
  });
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const fetchOwners = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/owners', { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setOwners(d.owners || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => { fetchOwners(); }, [fetchOwners]);

  const fetchDetail = async (id: string) => {
    if (detailMap[id]) return;
    try {
      const res = await fetch(`/api/admin/owners/${id}`, { headers: headers() });
      if (res.ok) {
        const d = await res.json();
        setDetailMap((prev) => ({ ...prev, [id]: d as OwnerDetail }));
      }
    } catch (e) { console.error(e); }
  };

  const filtered = owners.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.name || '').toLowerCase().includes(s)
      || (o.email || '').toLowerCase().includes(s)
      || (o.phone || '').includes(s);
  });

  const totalProps = owners.reduce((s, o) => s + (o.stats?.total_properties || 0), 0);
  const totalRevenue = owners.reduce((s, o) => s + (o.stats?.revenue_ytd || 0), 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', company: '', tax_id: '', address: '', city: '', state: 'TX', zip_code: '', password: '' });
    setErrMsg('');
    setShowForm(true);
  };

  const openEdit = (o: Owner) => {
    setEditing(o);
    setForm({
      name: o.name || '', email: o.email || '', phone: o.phone || '',
      company: o.company || '', tax_id: o.tax_id || '',
      address: o.address || '', city: o.city || '', state: o.state || 'TX', zip_code: o.zip_code || '',
      password: '',
    });
    setErrMsg('');
    setShowForm(true);
  };

  const submit = async () => {
    setErrMsg('');
    if (!form.name.trim() || !form.email.trim()) {
      setErrMsg('Nombre y email son requeridos');
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/admin/owners/${editing.id}` : '/api/admin/owners';
      const method = editing ? 'PUT' : 'POST';
      const body: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        tax_id: form.tax_id.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip_code: form.zip_code.trim(),
      };
      if (!editing && form.password.trim()) body.password = form.password.trim();

      const res = await fetch(url, { method, headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setErrMsg(d.detail || 'Error guardando'); setSaving(false); return; }
      if (!editing && d.temp_password) {
        alert(`✅ Propietario creado.\n\nPassword temporal: ${d.temp_password}\n\nGuárdala — el propietario debe cambiarla en su primer login.`);
      }
      setShowForm(false);
      await fetchOwners();
    } catch (e: any) {
      setErrMsg(e?.message || 'Error de red');
    }
    setSaving(false);
  };

  const removeOwner = async (o: Owner) => {
    const props = o.stats?.total_properties || 0;
    const msg = props > 0
      ? `¿Eliminar a ${o.name}? Tiene ${props} propiedad(es) que quedarán sin propietario asignado (no se borran).`
      : `¿Eliminar a ${o.name}?`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/admin/owners/${o.id}`, { method: 'DELETE', headers: headers() });
      const d = await res.json();
      if (!res.ok) { alert(d.detail || 'Error eliminando'); return; }
      alert(`✅ Eliminado. ${d.properties_unassigned || 0} propiedad(es) desasignada(s).`);
      await fetchOwners();
    } catch (e: any) {
      alert(e?.message || 'Error de red');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-purple-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/20 flex items-center justify-center">
            <UserCog className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Propietarios</h2>
            <p className="text-sm text-gray-500">Gestión de dueños de propiedades</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-300 text-sm font-bold transition">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<UserCog className="w-4 h-4 text-purple-400" />} label="PROPIETARIOS" value={owners.length} accent="purple" />
        <StatCard icon={<Home className="w-4 h-4 text-cyan-400" />} label="PROPIEDADES" value={totalProps} accent="cyan" />
        <StatCard icon={<DollarSign className="w-4 h-4 text-emerald-400" />} label="INGRESOS YTD" value={fmt(totalRevenue)} accent="emerald" />
        <StatCard icon={<CreditCard className="w-4 h-4 text-blue-400" />} label="STRIPE CONECT." value={owners.filter((o) => o.stripe_connected).length} accent="blue" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-purple-500 focus:outline-none"
          placeholder="Buscar propietario por nombre, email, teléfono..." />
      </div>

      {/* Owner Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <UserCog className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron propietarios</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 text-sm font-bold hover:bg-purple-500/30 transition">
            <Plus className="w-4 h-4" /> Crear primer propietario
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((owner) => {
            const isExp = expanded === owner.id;
            const detail = detailMap[owner.id];
            return (
              <div key={owner.id}
                className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition ${isExp ? 'border-purple-500/20' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                <div className="p-4 flex items-center gap-4">
                  <button
                    onClick={() => { const next = isExp ? null : owner.id; setExpanded(next); if (next) fetchDetail(owner.id); }}
                    className="flex items-center gap-4 flex-1 text-left">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/15 flex items-center justify-center text-purple-400 font-bold text-lg flex-shrink-0">
                      {(owner.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{owner.name || '(sin nombre)'}</span>
                        {owner.stripe_connected && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">STRIPE ✓</span>
                        )}
                        {owner.kyc_status === 'pending' && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">KYC PENDIENTE</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                        {owner.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {owner.email}</span>}
                        {owner.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {owner.phone}</span>}
                        {owner.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {owner.company}</span>}
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold text-white">{owner.stats.total_properties} prop.</div>
                      <div className="text-[10px] text-emerald-400 font-medium">{fmt(owner.stats.revenue_ytd)} YTD</div>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(owner); }} title="Editar"
                      className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-400 transition">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); removeOwner(owner); }} title="Eliminar"
                      className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3">
                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <MiniStat label="PROPIEDADES" value={String(owner.stats.total_properties)} sub={`${owner.stats.admin_properties} admin · ${owner.stats.marketplace_listings} market`} accent="cyan" />
                      <MiniStat label="INGRESO YTD" value={fmt(owner.stats.revenue_ytd)} accent="emerald" />
                      <MiniStat label="MANTENIMIENTO YTD" value={fmt(owner.stats.maintenance_ytd)} accent="amber" />
                      <MiniStat label="PENDIENTE PAGAR" value={fmt(owner.stats.pending_payout)} sub={`Pagado: ${fmt(owner.stats.paid_ytd)}`} accent="blue" />
                    </div>

                    {detail ? (
                      <>
                        {/* Properties */}
                        {(detail.admin_properties.length + detail.marketplace_listings.length) > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                              <Home className="w-3.5 h-3.5" /> Propiedades ({detail.admin_properties.length + detail.marketplace_listings.length})
                            </p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {detail.admin_properties.map((p: any) => (
                                <div key={p._id} className="flex items-center gap-3 p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                                  <Home className="w-4 h-4 text-cyan-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{p.name || p.address}</p>
                                    <p className="text-[10px] text-gray-500 truncate">{p.address} · {p.city}</p>
                                  </div>
                                  <p className="text-xs font-bold text-emerald-400">{fmt(p.rent_amount || 0)}</p>
                                </div>
                              ))}
                              {detail.marketplace_listings.map((p: any) => (
                                <div key={p._id} className="flex items-center gap-3 p-2.5 bg-purple-500/[0.05] rounded-lg border border-purple-500/[0.15]">
                                  <Home className="w-4 h-4 text-purple-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{p.address}</p>
                                    <p className="text-[10px] text-purple-400 truncate">Marketplace · {p.status}</p>
                                  </div>
                                  <p className="text-xs font-bold text-emerald-400">{fmt(p.rent_amount || 0)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent activity */}
                        <div className="grid sm:grid-cols-3 gap-2">
                          <ActivityList icon={<DollarSign className="w-3.5 h-3.5" />} title="Pagos recientes" items={detail.payments.slice(0, 5).map((p: any) => `${fmt(p.amount || 0)} · ${p.payment_date?.slice(0, 10) || ''}`)} accent="emerald" />
                          <ActivityList icon={<Wrench className="w-3.5 h-3.5" />} title="Gastos" items={detail.expenses.slice(0, 5).map((e: any) => `${fmt(e.amount || 0)} · ${e.category} · ${e.expense_date?.slice(0, 10) || ''}`)} accent="amber" />
                          <ActivityList icon={<Banknote className="w-3.5 h-3.5" />} title="Payouts" items={detail.payouts.slice(0, 5).map((p: any) => `${fmt(p.amount || 0)} · ${p.payout_date?.slice(0, 10) || ''}`)} accent="blue" />
                        </div>

                        {detail.contracts.length > 0 && (
                          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                            <FileText className="w-3 h-3" /> {detail.contracts.length} contrato(s) activo(s)
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-center py-6">
                        <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create/Edit */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{editing ? 'Editar propietario' : 'Nuevo propietario'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-white/5 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <FormField label="Nombre completo *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Juan Pérez" />
              <FormField label="Email *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="juan@example.com" type="email" disabled={!!editing} />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+1 555 555 5555" />
                <FormField label="Empresa / LLC" value={form.company} onChange={(v) => setForm({ ...form, company: v })} placeholder="Pérez Properties LLC" />
              </div>
              <FormField label="EIN / Tax ID" value={form.tax_id} onChange={(v) => setForm({ ...form, tax_id: v })} placeholder="12-3456789" />
              <FormField label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="123 Main St" />
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <FormField label="Estado" value={form.state} onChange={(v) => setForm({ ...form, state: v.toUpperCase().slice(0, 2) })} />
                <FormField label="ZIP" value={form.zip_code} onChange={(v) => setForm({ ...form, zip_code: v })} />
              </div>
              {!editing && (
                <FormField label="Password (opcional)" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="Mínimo 6 caracteres. Si no, se genera una temp" type="password" />
              )}

              {errMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errMsg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} disabled={saving}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm font-bold hover:bg-white/10 transition">
                  Cancelar
                </button>
                <button onClick={submit} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-500 hover:bg-purple-600 rounded-xl text-white text-sm font-bold transition disabled:opacity-50">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4" /> {editing ? 'Guardar' : 'Crear'}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg bg-${accent}-500/10 flex items-center justify-center`}>{icon}</div>
      <div>
        <div className="text-lg font-bold text-white">{value}</div>
        <div className="text-[10px] text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className={`text-center p-2 bg-${accent}-500/5 rounded-lg border border-${accent}-500/10`}>
      <p className={`text-sm font-bold text-${accent}-400`}>{value}</p>
      <p className="text-[9px] text-gray-500">{label}</p>
      {sub && <p className="text-[9px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function ActivityList({ icon, title, items, accent }: { icon: React.ReactNode; title: string; items: string[]; accent: string }) {
  return (
    <div className="bg-white/[0.02] rounded-lg border border-white/[0.05] p-2.5">
      <p className={`text-[10px] font-bold text-${accent}-400 flex items-center gap-1 mb-1.5`}>{icon} {title}</p>
      {items.length === 0 ? (
        <p className="text-[10px] text-gray-600 italic">Sin movimientos</p>
      ) : items.map((it, i) => (
        <p key={i} className="text-[10px] text-gray-300 truncate">{it}</p>
      ))}
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type, disabled }: any) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-400 mb-1">{label}</label>
      <input
        type={type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}
