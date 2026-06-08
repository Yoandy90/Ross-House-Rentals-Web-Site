'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../layout';
import {
  CalendarDays, ChevronLeft, ChevronRight, Home, Users,
  FileText, DollarSign, Wrench, AlertTriangle, Clock,
  CheckCircle2, ArrowRight,
} from 'lucide-react';

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

type EventType = 'contract_end' | 'payment_due' | 'maintenance' | 'move_in' | 'move_out' | 'overdue';
interface CalEvent { date: string; type: EventType; title: string; detail?: string; color: string; icon: any; }

const EVENT_COLORS: Record<EventType, { color: string; bg: string; border: string; icon: any }> = {
  contract_end: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: FileText },
  payment_due:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: DollarSign },
  maintenance:  { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Wrench },
  move_in:      { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: ArrowRight },
  move_out:     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: ArrowRight },
  overdue:      { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle },
};

export default function CalendarioPage() {
  const { headers } = useAdminAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    const allEvents: CalEvent[] = [];
    try {
      // Fetch contracts for end dates
      const cRes = await fetch('/api/admin/rental-contracts', { headers: headers() });
      if (cRes.ok) {
        const d = await cRes.json();
        (d.contracts || []).forEach((c: any) => {
          if (c.end_date) {
            allEvents.push({
              date: c.end_date, type: 'contract_end',
              title: `Fin contrato: ${c.tenant_name || c.property_name || ''}`,
              detail: c.property_name || '', color: 'amber', icon: FileText,
            });
          }
          if (c.start_date) {
            allEvents.push({
              date: c.start_date, type: 'move_in',
              title: `Inicio: ${c.tenant_name || ''}`,
              detail: c.property_name || '', color: 'cyan', icon: ArrowRight,
            });
          }
        });
      }

      // Fetch overdue payments
      const oRes = await fetch('/api/admin/overdue-payments', { headers: headers() });
      if (oRes.ok) {
        const d = await oRes.json();
        (d.overdue || []).forEach((o: any) => {
          allEvents.push({
            date: o.due_date || o.created_at || new Date().toISOString(), type: 'overdue',
            title: `Pago atrasado: ${o.tenant_name || ''}`,
            detail: `$${o.amount || 0}`, color: 'red', icon: AlertTriangle,
          });
        });
      }

      // Fetch maintenance
      const mRes = await fetch('/api/admin/maintenance-requests', { headers: headers() });
      if (mRes.ok) {
        const d = await mRes.json();
        (d.requests || []).filter((r: any) => r.status !== 'completed').forEach((r: any) => {
          allEvents.push({
            date: r.created_at || new Date().toISOString(), type: 'maintenance',
            title: `Mantenimiento: ${r.title || ''}`,
            detail: r.property_name || '', color: 'blue', icon: Wrench,
          });
        });
      }

      // Add recurring payment dates (1st of each month for all active leases)
      const lRes = await fetch('/api/admin/rental-contracts?status=active', { headers: headers() });
      if (lRes.ok) {
        const d = await lRes.json();
        (d.contracts || []).forEach((c: any) => {
          if (c.status === 'active') {
            const payDate = new Date(year, month, c.payment_day || 1).toISOString();
            allEvents.push({
              date: payDate, type: 'payment_due',
              title: `Pago: ${c.tenant_name || ''}`,
              detail: `$${c.rent_amount || c.monthly_rent || 0}`, color: 'emerald', icon: DollarSign,
            });
          }
        });
      }
    } catch (e) { console.error(e); }

    setEvents(allEvents);
    setLoading(false);
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const getEventsForDay = (day: number) => {
    return events.filter(e => {
      try {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      } catch { return false; }
    });
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(today.getDate()); };

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // Upcoming events (next 30 days)
  const now = new Date();
  const upcoming = events
    .filter(e => { try { return new Date(e.date) >= now; } catch { return false; } })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 8);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 relative">
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-teal-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/20 flex items-center justify-center">
          <CalendarDays className="w-6 h-6 text-teal-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Calendario</h2>
          <p className="text-sm text-gray-500">Eventos, vencimientos y fechas importantes</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] transition">
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">{MONTHS_ES[month]} {year}</h3>
            </div>
            <div className="flex gap-2">
              <button onClick={goToday} className="px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold hover:bg-teal-500/20 transition">Hoy</button>
              <button onClick={nextMonth} className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center hover:bg-white/[0.08] transition">
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_ES.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="h-16" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = isCurrentMonth && day === today.getDate();
              const isSelected = selectedDay === day;

              return (
                <button key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`h-16 rounded-xl border transition text-left p-1.5 relative flex flex-col ${
                    isSelected ? 'border-teal-500/40 bg-teal-500/10' :
                    isToday ? 'border-teal-500/20 bg-teal-500/5' :
                    dayEvents.length > 0 ? 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]' :
                    'border-transparent hover:bg-white/[0.02]'
                  }`}>
                  <span className={`text-xs font-bold ${isToday ? 'text-teal-400' : isSelected ? 'text-teal-300' : 'text-gray-400'}`}>
                    {day}
                  </span>
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {dayEvents.slice(0, 3).map((e, ei) => {
                      const cfg = EVENT_COLORS[e.type];
                      return <div key={ei} className={`w-1.5 h-1.5 rounded-full ${cfg.bg.replace('/10', '/60')}`} />;
                    })}
                    {dayEvents.length > 3 && <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-white/[0.06]">
            {Object.entries(EVENT_COLORS).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${cfg.bg.replace('/10', '/60')}`} />
                <span className="text-[10px] text-gray-500">{
                  key === 'contract_end' ? 'Fin contrato' :
                  key === 'payment_due' ? 'Pago' :
                  key === 'maintenance' ? 'Mantenimiento' :
                  key === 'move_in' ? 'Inicio' :
                  key === 'move_out' ? 'Salida' : 'Atrasado'
                }</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Selected day events */}
          {selectedDay && (
            <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-teal-500/15 p-4">
              <h4 className="text-sm font-bold text-white mb-3">
                {selectedDay} {MONTHS_ES[month]}
              </h4>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-gray-500">Sin eventos este día</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e, i) => {
                    const cfg = EVENT_COLORS[e.type];
                    const EIcon = cfg.icon;
                    return (
                      <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                        <EIcon className={`w-4 h-4 ${cfg.color} mt-0.5 flex-shrink-0`} />
                        <div>
                          <p className={`text-xs font-bold ${cfg.color}`}>{e.title}</p>
                          {e.detail && <p className="text-[10px] text-gray-400 mt-0.5">{e.detail}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming events */}
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" /> Próximos Eventos
            </h4>
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-500">No hay eventos próximos</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((e, i) => {
                  const cfg = EVENT_COLORS[e.type];
                  const EIcon = cfg.icon;
                  const eDate = new Date(e.date);
                  return (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition">
                      <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.border} border flex items-center justify-center flex-shrink-0`}>
                        <EIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-300 truncate">{e.title}</p>
                        <p className="text-[10px] text-gray-500">
                          {eDate.getDate()} {MONTHS_ES[eDate.getMonth()].substring(0, 3)}
                          {e.detail ? ` · ${e.detail}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Event count summary */}
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] p-4">
            <h4 className="text-sm font-bold text-white mb-3">Este Mes</h4>
            <div className="space-y-2">
              {Object.entries(EVENT_COLORS).map(([key, cfg]) => {
                const count = events.filter(e => {
                  try { const d = new Date(e.date); return d.getMonth() === month && d.getFullYear() === year && e.type === key; }
                  catch { return false; }
                }).length;
                if (count === 0) return null;
                return (
                  <div key={key} className="flex items-center justify-between">
                    <span className={`text-xs ${cfg.color}`}>{
                      key === 'contract_end' ? 'Fin contratos' :
                      key === 'payment_due' ? 'Pagos' :
                      key === 'maintenance' ? 'Mantenimientos' :
                      key === 'move_in' ? 'Inicios' :
                      key === 'move_out' ? 'Salidas' : 'Atrasados'
                    }</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
