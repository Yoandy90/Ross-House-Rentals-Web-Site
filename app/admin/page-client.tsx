'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, FileText, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, ArrowRight, Loader2, Home,
  Wrench, Calendar, CreditCard, Activity, PieChart, BarChart3,
  Sparkles, Zap, Shield, Bell
} from 'lucide-react';
import { useAdminAuth } from './layout';

interface DashboardStats {
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
  totalTenants: number;
  activeContracts: number;
  pendingPayments: number;
  monthlyRevenue: number;
  maintenanceRequests: number;
}

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string; glow: string; gradient: string }> = {
  blue:    { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-gradient-to-br from-blue-500/30 to-blue-600/20', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]', gradient: 'from-blue-500 to-blue-400' },
  violet:  { bg: 'bg-violet-500/10', text: 'text-violet-400', icon: 'bg-gradient-to-br from-violet-500/30 to-violet-600/20', glow: 'shadow-[0_0_20px_rgba(139,92,246,0.15)]', gradient: 'from-violet-500 to-violet-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/20', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', gradient: 'from-emerald-500 to-emerald-400' },
  green:   { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'bg-gradient-to-br from-green-500/30 to-green-600/20', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]', gradient: 'from-green-500 to-green-400' },
  amber:   { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'bg-gradient-to-br from-amber-500/30 to-amber-600/20', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', gradient: 'from-amber-500 to-amber-400' },
  red:     { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'bg-gradient-to-br from-red-500/30 to-red-600/20', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]', gradient: 'from-red-500 to-red-400' },
  cyan:    { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/20', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]', gradient: 'from-cyan-500 to-cyan-400' },
};

export default function AdminDashboard() {
  const { headers, token, user } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/admin/dashboard-stats', { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error('Error fetching stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  // Fallback stats
  const displayStats = stats || {
    totalProperties: 2,
    occupiedProperties: 2,
    vacantProperties: 0,
    totalTenants: 3,
    activeContracts: 2,
    pendingPayments: 0,
    monthlyRevenue: 2300,
    maintenanceRequests: 0,
  };

  const occupancyRate = displayStats.totalProperties > 0 
    ? Math.round((displayStats.occupiedProperties / displayStats.totalProperties) * 100) 
    : 0;

  const statCards = [
    { 
      title: 'Propiedades', 
      value: displayStats.totalProperties, 
      icon: Building2, 
      color: 'blue',
      subtext: `${displayStats.occupiedProperties} ocupadas`,
      trend: '+0%',
      trendUp: true,
    },
    { 
      title: 'Inquilinos', 
      value: displayStats.totalTenants, 
      icon: Users, 
      color: 'violet',
      subtext: 'Activos',
      trend: '+1',
      trendUp: true,
    },
    { 
      title: 'Contratos', 
      value: displayStats.activeContracts, 
      icon: FileText, 
      color: 'emerald',
      subtext: 'Vigentes',
      trend: '100%',
      trendUp: true,
    },
    { 
      title: 'Ingresos Mensuales', 
      value: `$${displayStats.monthlyRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'green',
      subtext: 'Este mes',
      trend: '+$300',
      trendUp: true,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-transparent border border-white/[0.08] p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-violet-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl shadow-lg shadow-blue-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              ¡Bienvenido{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </h1>
          </div>
          <p className="text-gray-400 text-sm max-w-xl">
            Tu portafolio de propiedades está funcionando a <span className="text-emerald-400 font-semibold">{occupancyRate}%</span> de ocupación. 
            Aquí tienes un resumen de hoy.
          </p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const colors = COLOR_MAP[stat.color];
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-2xl bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] p-5 hover:border-white/[0.12] transition-all duration-300 group ${colors.glow}`}
            >
              {/* Background Glow */}
              <div className={`absolute top-0 right-0 w-24 h-24 ${colors.bg} rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity`} />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${colors.icon} ring-1 ring-white/10`}>
                    <stat.icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  {stat.trendUp !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stat.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stat.trend}
                    </div>
                  )}
                </div>
                <h3 className={`text-3xl font-bold bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
                  {stat.value}
                </h3>
                <p className="text-gray-400 text-sm mt-1">{stat.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{stat.subtext}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Middle Section - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Occupancy Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-xl ring-1 ring-emerald-500/20">
              <PieChart className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Tasa de Ocupación</h3>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Circular Progress */}
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                <circle 
                  cx="50" cy="50" r="42" 
                  stroke="rgba(255,255,255,0.06)" 
                  strokeWidth="8" 
                  fill="none" 
                />
                <circle 
                  cx="50" cy="50" r="42" 
                  stroke="url(#gradient)" 
                  strokeWidth="8" 
                  fill="none"
                  strokeDasharray={`${occupancyRate * 2.64} 264`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-3xl font-bold text-white">{occupancyRate}</span>
                  <span className="text-lg text-emerald-400">%</span>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-gray-300">Ocupadas</span>
                </div>
                <span className="text-lg font-bold text-emerald-400">{displayStats.occupiedProperties}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-gray-300">Disponibles</span>
                </div>
                <span className="text-lg font-bold text-amber-400">{displayStats.vacantProperties}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl ring-1 ring-blue-500/20">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Acciones Rápidas</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nueva Propiedad', icon: Home, href: '/admin/propiedades', color: 'blue' },
              { label: 'Nuevo Inquilino', icon: Users, href: '/admin/inquilinos', color: 'violet' },
              { label: 'Registrar Pago', icon: CreditCard, href: '/admin/pagos', color: 'emerald' },
              { label: 'Mantenimiento', icon: Wrench, href: '/admin/mantenimiento', color: 'amber' },
            ].map((action) => {
              const colors = COLOR_MAP[action.color];
              return (
                <a
                  key={action.label}
                  href={action.href}
                  className={`flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-200 group`}
                >
                  <div className={`p-2 rounded-lg ${colors.icon} group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-4 h-4 ${colors.text}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">{action.label}</span>
                </a>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Financial Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="rounded-2xl bg-[#0c1222]/80 backdrop-blur-xl border border-white/[0.06] p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-500/30 to-green-600/20 rounded-xl ring-1 ring-green-500/20">
              <BarChart3 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Resumen Financiero</h3>
              <p className="text-xs text-gray-500">Últimos 30 días</p>
            </div>
          </div>
          <a href="/admin/rendimiento" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            Ver detalles <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Ingresos</span>
            </div>
            <p className="text-2xl font-bold text-green-400">${displayStats.monthlyRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">Este mes</p>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-gray-400">Pendientes</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{displayStats.pendingPayments}</p>
            <p className="text-xs text-gray-500 mt-1">Pagos por cobrar</p>
          </div>
          
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-gray-400">Mantenimiento</span>
            </div>
            <p className="text-2xl font-bold text-violet-400">{displayStats.maintenanceRequests}</p>
            <p className="text-xs text-gray-500 mt-1">Solicitudes activas</p>
          </div>
        </div>
      </motion.div>

      {/* Footer Note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex items-center justify-center gap-2 text-xs text-gray-600 py-4"
      >
        <Shield className="w-3 h-3" />
        <span>Panel seguro • Ross House Rentals LLC • Dumas, TX</span>
      </motion.div>
    </div>
  );
}
