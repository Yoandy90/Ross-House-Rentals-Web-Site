'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, FileText, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, ArrowRight, Loader2, Home,
  Wrench, Calendar, CreditCard
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

export default function AdminDashboard() {
  const { headers, token } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

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
    },
    { 
      title: 'Inquilinos', 
      value: displayStats.totalTenants, 
      icon: Users, 
      color: 'violet',
      subtext: 'Activos',
    },
    { 
      title: 'Contratos', 
      value: displayStats.activeContracts, 
      icon: FileText, 
      color: 'emerald',
      subtext: 'Vigentes',
    },
    { 
      title: 'Ingresos Mensuales', 
      value: `$${displayStats.monthlyRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'green',
      subtext: 'Este mes',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Bienvenido al panel de administración</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-${stat.color}-100`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
            <p className="text-gray-500 text-sm">{stat.title}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.subtext}</p>
          </motion.div>
        ))}
      </div>

      {/* Occupancy Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasa de Ocupación</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                <circle 
                  cx="48" cy="48" r="40" 
                  stroke="#10b981" strokeWidth="8" fill="none"
                  strokeDasharray={`${occupancyRate * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{occupancyRate}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-emerald-600">{displayStats.occupiedProperties}</span> de {displayStats.totalProperties} propiedades ocupadas
              </p>
              {displayStats.vacantProperties > 0 && (
                <p className="text-sm text-amber-600 mt-1">
                  {displayStats.vacantProperties} propiedad(es) disponible(s)
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Nueva Propiedad', icon: Home, href: '/admin/propiedades' },
              { label: 'Nuevo Inquilino', icon: Users, href: '/admin/inquilinos' },
              { label: 'Registrar Pago', icon: CreditCard, href: '/admin/pagos' },
              { label: 'Mantenimiento', icon: Wrench, href: '/admin/mantenimiento' },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <action.icon className="w-5 h-5 text-gray-600 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{action.label}</span>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
