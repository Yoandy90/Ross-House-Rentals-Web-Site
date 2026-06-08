'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  Briefcase, Plus, DollarSign, Home, TrendingUp, Wrench,
  Tag, X, Calendar, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Hammer, ShoppingCart, BarChart3,
} from 'lucide-react';

interface Investment {
  id: string;
  address: string;
  city: string;
  state: string;
  purchase_price: number;
  current_value: number;
  phase: string;
  status: string;
  total_expenses: number;
  total_invested: number;
  potential_profit: number;
  profit_margin: number;
  expenses: any[];
  notes: string;
  created_at: string;
}

interface DashboardData {
  phases: Record<string, number>;
  total_invested: number;
  total_potential_value: number;
  total_potential_profit: number;
  avg_profit_margin: number;
  recent_expenses: any[];
}

export default function InversionesPage() {
  const { headers } = useAdminAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  // Form state
  const [form, setForm] = useState({
    address: '', city: '', state: 'TX', purchase_price: '',
    current_value: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Expense form
  const [showExpense, setShowExpense] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', category: 'repair',
  });

  const fetchData = useCallback(async () => {
    try {
      const [invRes, dashRes] = await Promise.all([
        fetch(`/api/admin/investments${filter !== 'all' ? `?phase=${filter}` : ''}`, { headers: headers() }),
        fetch('/api/admin/investments/dashboard', { headers: headers() }),
      ]);
      if (invRes.ok) {
        const d = await invRes.json();
        setInvestments(d.investments || []);
      }
      if (dashRes.ok) {
        const d = await dashRes.json();
        setDashboard(d.dashboard || null);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createInvestment = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/investments', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...form,
          purchase_price: parseFloat(form.purchase_price) || 0,
          current_value: parseFloat(form.current_value) || 0,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ address: '', city: '', state: 'TX', purchase_price: '', current_value: '', notes: '' });
        fetchData();
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const addExpense = async (invId: string) => {
    try {
      const res = await fetch(`/api/admin/investments/${invId}/expenses`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...expenseForm,
          amount: parseFloat(expenseForm.amount) || 0,
        }),
      });
      if (res.ok) {
        setShowExpense(null);
        setExpenseForm({ description: '', amount: '', category: 'repair' });
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const updatePhase = async (invId: string, phase: string) => {
    try {
      await fetch(`/api/admin/investments/${invId}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ phase }),
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const phaseConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    acquisition: { label: 'Adquisición', icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    repair: { label: 'Reparación', icon: Hammer, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    listed: { label: 'En Venta', icon: Tag, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
    sold: { label: 'Vendida', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  };

  const fmt = (n: number) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/20 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Inversiones</h2>
            <p className="text-sm text-gray-500">Comprar · Reparar · Vender</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl text-sm font-bold hover:opacity-90 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
        >
          <Plus className="w-4 h-4" /> Nueva Inversión
        </button>
      </div>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Invertido" value={fmt(dashboard.total_invested)} icon={DollarSign} color="blue" />
          <StatCard label="Valor Potencial" value={fmt(dashboard.total_potential_value)} icon={TrendingUp} color="emerald" />
          <StatCard label="Ganancia Potencial" value={fmt(dashboard.total_potential_profit)} icon={BarChart3} color="amber" />
          <StatCard label="Margen Promedio" value={`${(dashboard.avg_profit_margin || 0).toFixed(1)}%`} icon={TrendingUp} color="purple" />
        </div>
      )}

      {/* Phase Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ key: 'all', label: 'Todas' }, ...Object.entries(phaseConfig).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f.key ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25' : 'bg-white/[0.03] text-gray-400 border border-white/[0.06] hover:bg-white/[0.06]'
            }`}
          >
            {f.label} {f.key !== 'all' && dashboard?.phases?.[f.key] !== undefined && `(${dashboard.phases[f.key]})`}
          </button>
        ))}
      </div>

      {/* Investments List */}
      {investments.length === 0 ? (
        <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
          <Briefcase className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">No hay inversiones</p>
          <p className="text-gray-600 text-sm mt-1">Agrega una propiedad para comenzar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {investments.map(inv => {
            const phase = phaseConfig[inv.phase] || phaseConfig.acquisition;
            const isExpanded = expandedId === inv.id;
            return (
              <div key={inv.id} className="bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-orange-500/15 transition">
                <div className="p-5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${phase.bg}`}>
                        <phase.icon className={`w-5 h-5 ${phase.color}`} />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{inv.address}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {inv.city}, {inv.state}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">Compra</p>
                        <p className="text-white font-bold">{fmt(inv.purchase_price)}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">Gastos</p>
                        <p className="text-amber-400 font-bold">{fmt(inv.total_expenses)}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">Ganancia</p>
                        <p className={`font-bold ${inv.potential_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(inv.potential_profit)}</p>
                      </div>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${phase.bg} ${phase.color}`}>{phase.label}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-5 space-y-4">
                    {/* Phase Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 py-2">Cambiar fase:</span>
                      {Object.entries(phaseConfig).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => updatePhase(inv.id, key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            inv.phase === key ? `${cfg.bg} ${cfg.color}` : 'bg-white/[0.02] text-gray-500 border-white/[0.06] hover:bg-white/[0.05]'
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>

                    {/* Expenses */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-300">Gastos ({inv.expenses?.length || 0})</h4>
                        <button
                          onClick={() => setShowExpense(showExpense === inv.id ? null : inv.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-xs font-semibold hover:bg-amber-500/20"
                        >
                          <Plus className="w-3 h-3" /> Agregar Gasto
                        </button>
                      </div>
                      {inv.expenses && inv.expenses.length > 0 && (
                        <div className="space-y-1">
                          {inv.expenses.map((exp: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-white/[0.02] rounded-lg">
                              <div className="flex items-center gap-2">
                                <Wrench className="w-3.5 h-3.5 text-gray-500" />
                                <span className="text-sm text-gray-300">{exp.description}</span>
                              </div>
                              <span className="text-sm font-bold text-amber-400">{fmt(exp.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {showExpense === inv.id && (
                        <div className="mt-2 p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2">
                          <input
                            value={expenseForm.description}
                            onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                            placeholder="Descripción del gasto"
                            className="w-full px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={expenseForm.amount}
                              onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                              placeholder="Monto ($)"
                              className="flex-1 px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                            />
                            <select
                              value={expenseForm.category}
                              onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                              className="px-3 py-2 bg-[#0a1020]/60 border border-white/[0.08] rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
                            >
                              <option value="repair">Reparación</option>
                              <option value="material">Material</option>
                              <option value="labor">Mano de obra</option>
                              <option value="permit">Permiso</option>
                              <option value="other">Otro</option>
                            </select>
                            <button
                              onClick={() => addExpense(inv.id)}
                              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {inv.notes && (
                      <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                        <p className="text-xs text-gray-500 mb-1">Notas</p>
                        <p className="text-sm text-gray-300">{inv.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Investment Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] rounded-2xl border border-white/[0.1] w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Briefcase className="w-5 h-5 text-orange-400" /> Nueva Inversión</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dirección *</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full mt-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ciudad *</label>
                  <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full mt-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="Dumas" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</label>
                  <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="w-full mt-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Precio de Compra ($) *</label>
                  <input type="number" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})} className="w-full mt-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="85000" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Valor Estimado ($)</label>
                  <input type="number" value={form.current_value} onChange={e => setForm({...form, current_value: e.target.value})} className="w-full mt-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none" placeholder="120000" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={3} className="w-full mt-1 px-3 py-2.5 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-orange-500 focus:outline-none resize-none" placeholder="Detalles sobre la propiedad..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-gray-400 hover:text-white text-sm">Cancelar</button>
              <button
                onClick={createInvestment}
                disabled={saving || !form.address || !form.city || !form.purchase_price}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-30"
              >
                {saving ? 'Guardando...' : 'Crear Inversión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 text-${color}-400`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
