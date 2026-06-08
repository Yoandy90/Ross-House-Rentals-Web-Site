'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  UserCog, Search, Plus, Home, DollarSign, CreditCard,
  Phone, Mail, Building2, ChevronDown, ChevronUp,
  ExternalLink, Banknote, PiggyBank, CheckCircle2,
} from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function PropietariosPage() {
  const { headers } = useAdminAuth();
  const [owners, setOwners] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [owRes, prRes, fnRes] = await Promise.all([
        fetch('/api/admin/owner-financials', { headers: headers() }),
        fetch('/api/admin/properties', { headers: headers() }),
        fetch('/api/admin/rental-dashboard', { headers: headers() }),
      ]);
      if (owRes.ok) { const d = await owRes.json(); setFinancials(d); }
      if (prRes.ok) { const d = await prRes.json(); setProperties(d.properties || []); }
      // Extract unique owners from properties
      if (prRes.ok) {
        const d = await prRes.json().catch(() => null);
      }
    } catch (e) { console.error(e); }

    // Build owner list from properties + app_users with role=landlord
    try {
      const usersRes = await fetch('/api/admin/marketplace-listings', { headers: headers() });
      if (usersRes.ok) {
        const d = await usersRes.json();
        // Listings have owner info
      }
    } catch(e) {}

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Build owners from properties (group by owner_name)
  const ownerMap = new Map<string, any>();
  properties.forEach(p => {
    const name = p.owner_name || p.owner || 'Sin Propietario';
    if (!ownerMap.has(name)) {
      ownerMap.set(name, {
        name,
        email: p.owner_email || '',
        phone: p.owner_phone || '',
        properties: [],
        total_revenue: 0,
        total_expenses: 0,
        stripe_connected: !!p.stripe_account_id,
      });
    }
    const o = ownerMap.get(name)!;
    o.properties.push(p);
    o.total_revenue += (p.monthly_rent || 0) * 12;
    if (p.owner_email && !o.email) o.email = p.owner_email;
    if (p.owner_phone && !o.phone) o.phone = p.owner_phone;
  });
  const ownerList = Array.from(ownerMap.values());

  const filtered = ownerList.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.name.toLowerCase().includes(s) || o.email.toLowerCase().includes(s) || o.phone.includes(s);
  });

  const totalProps = properties.length;
  const totalRevenue = ownerList.reduce((s, o) => s + o.total_revenue, 0);

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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-purple-400" />
          </div>
          <div><div className="text-lg font-bold text-white">{ownerList.length}</div><div className="text-[10px] text-gray-500">PROPIETARIOS</div></div>
        </div>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Home className="w-4 h-4 text-cyan-400" />
          </div>
          <div><div className="text-lg font-bold text-white">{totalProps}</div><div className="text-[10px] text-gray-500">PROPIEDADES</div></div>
        </div>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div><div className="text-lg font-bold text-white">{fmt(totalRevenue)}</div><div className="text-[10px] text-gray-500">INGRESOS ANUALES EST.</div></div>
        </div>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div><div className="text-lg font-bold text-white">{ownerList.filter(o => o.stripe_connected).length}</div><div className="text-[10px] text-gray-500">STRIPE CONNECT</div></div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white text-sm focus:border-purple-500 focus:outline-none"
          placeholder="Buscar propietario por nombre, email, teléfono..." />
      </div>

      {/* Owner Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-12 text-center">
          <UserCog className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron propietarios</p>
          <p className="text-xs text-gray-600 mt-1">Los propietarios se crean automáticamente al asignar dueño a una propiedad</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((owner, idx) => {
            const isExp = expanded === owner.name;
            return (
              <div key={idx} className={`bg-white/[0.03] backdrop-blur-sm rounded-2xl border transition ${isExp ? 'border-purple-500/20' : 'border-white/[0.06] hover:border-white/[0.12]'}`}>
                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : owner.name)}>
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/15 flex items-center justify-center text-purple-400 font-bold text-lg flex-shrink-0">
                    {owner.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{owner.name}</span>
                      {owner.stripe_connected && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">STRIPE ✓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5">
                      {owner.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {owner.email}</span>}
                      {owner.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {owner.phone}</span>}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold text-white">{owner.properties.length} prop.</div>
                    <div className="text-[10px] text-emerald-400 font-medium">{fmt(owner.total_revenue)}/año</div>
                  </div>

                  {isExp ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {isExp && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3">
                    <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5" /> Propiedades ({owner.properties.length})
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {owner.properties.map((p: any, pi: number) => (
                        <div key={pi} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                            <Home className="w-4 h-4 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{p.name || p.address || 'Propiedad'}</p>
                            <p className="text-[10px] text-gray-500">{p.address || ''}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-emerald-400">{fmt(p.monthly_rent || 0)}/mo</p>
                            <p className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${p.status === 'occupied' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {p.status === 'occupied' ? 'Ocupada' : 'Vacante'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Financial summary */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="text-center p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                        <p className="text-sm font-bold text-emerald-400">{fmt(owner.total_revenue)}</p>
                        <p className="text-[9px] text-gray-500">INGRESO ANUAL EST.</p>
                      </div>
                      <div className="text-center p-2 bg-purple-500/5 rounded-lg border border-purple-500/10">
                        <p className="text-sm font-bold text-purple-400">{fmt(owner.total_revenue * 0.1)}</p>
                        <p className="text-[9px] text-gray-500">COMISIÓN 10%</p>
                      </div>
                      <div className="text-center p-2 bg-blue-500/5 rounded-lg border border-blue-500/10">
                        <p className="text-sm font-bold text-blue-400">{fmt(owner.total_revenue * 0.9)}</p>
                        <p className="text-[9px] text-gray-500">PAGO PROPIETARIO</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
