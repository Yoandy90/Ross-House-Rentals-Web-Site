'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import {
  LayoutDashboard, Home, Users, FileText, CreditCard, Wrench, CalendarDays,
  Settings, LogOut, ChevronLeft, ChevronRight, Menu, X,
  DollarSign, Building2, TrendingUp, Briefcase, Store, UserCog,
  FileBarChart, MessageSquare, ClipboardCheck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════
interface AdminAuthContextType {
  user: any;
  token: string;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  headers: () => Record<string, string>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  user: null, token: '', isLoading: true,
  login: async () => ({ ok: false }), logout: () => {},
  headers: () => ({}),
});

export const useAdminAuth = () => useContext(AdminAuthContext);

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION GROUPS
// ═══════════════════════════════════════════════════════════════════════════════
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/admin', Icon: LayoutDashboard, label: 'Dashboard', desc: 'Vista general', color: 'blue' },
    ],
  },
  {
    label: 'PROPIEDADES',
    items: [
      { href: '/admin/propiedades', Icon: Home, label: 'Propiedades', desc: 'Inventario', color: 'cyan' },
      { href: '/admin/inquilinos', Icon: Users, label: 'Inquilinos', desc: 'Base de datos', color: 'violet' },
      { href: '/admin/contratos', Icon: FileText, label: 'Contratos', desc: 'Alquileres', color: 'emerald' },
      { href: '/admin/marketplace', Icon: Store, label: 'Marketplace', desc: 'Listados & Consultas', color: 'cyan' },
      { href: '/admin/mantenimiento', Icon: Wrench, label: 'Mantenimiento', desc: 'Solicitudes', color: 'amber' },
      { href: '/admin/inspecciones', Icon: ClipboardCheck, label: 'Inspecciones', desc: 'Move-in/Move-out', color: 'lime' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { href: '/admin/pagos', Icon: CreditCard, label: 'Pagos', desc: 'Cobros & Rentas', color: 'amber' },
      { href: '/admin/gastos', Icon: DollarSign, label: 'Gastos', desc: 'Mantenimiento', color: 'red' },
      { href: '/admin/rendimiento', Icon: TrendingUp, label: 'Rendimiento', desc: 'ROI & Analytics', color: 'indigo' },
      { href: '/admin/inversiones', Icon: Briefcase, label: 'Inversiones', desc: 'Comprar/Reparar/Vender', color: 'orange' },
      { href: '/admin/propietarios', Icon: UserCog, label: 'Propietarios', desc: 'Gestión Owners', color: 'purple' },
      { href: '/admin/calendario', Icon: CalendarDays, label: 'Calendario', desc: 'Eventos & Fechas', color: 'teal' },
      { href: '/admin/reportes', Icon: FileBarChart, label: 'Reportes', desc: 'PDF & CSV Export', color: 'sky' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { href: '/admin/mensajes', Icon: MessageSquare, label: 'Mensajes', desc: 'SMS & Email', color: 'pink' },
      { href: '/admin/configuracion', Icon: Settings, label: 'Configuración', desc: 'Ajustes', color: 'slate' },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; glow: string; icon: string; gradient: string }> = {
  blue:    { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.15)]', icon: 'bg-gradient-to-br from-blue-500/30 to-blue-600/20', gradient: 'from-blue-400 to-blue-500' },
  cyan:    { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', glow: 'shadow-[0_0_12px_rgba(6,182,212,0.15)]', icon: 'bg-gradient-to-br from-cyan-500/30 to-cyan-600/20', gradient: 'from-cyan-400 to-cyan-500' },
  violet:  { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30', glow: 'shadow-[0_0_12px_rgba(139,92,246,0.15)]', icon: 'bg-gradient-to-br from-violet-500/30 to-violet-600/20', gradient: 'from-violet-400 to-violet-500' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]', icon: 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/20', gradient: 'from-emerald-400 to-emerald-500' },
  amber:   { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]', icon: 'bg-gradient-to-br from-amber-500/30 to-amber-600/20', gradient: 'from-amber-400 to-amber-500' },
  red:     { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]', icon: 'bg-gradient-to-br from-red-500/30 to-red-600/20', gradient: 'from-red-400 to-red-500' },
  indigo:  { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-[0_0_12px_rgba(99,102,241,0.15)]', icon: 'bg-gradient-to-br from-indigo-500/30 to-indigo-600/20', gradient: 'from-indigo-400 to-indigo-500' },
  slate:   { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', glow: 'shadow-[0_0_12px_rgba(100,116,139,0.15)]', icon: 'bg-gradient-to-br from-slate-500/30 to-slate-600/20', gradient: 'from-slate-400 to-slate-500' },
  orange:  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-[0_0_12px_rgba(249,115,22,0.15)]', icon: 'bg-gradient-to-br from-orange-500/30 to-orange-600/20', gradient: 'from-orange-400 to-orange-500' },
  purple:  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', glow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]', icon: 'bg-gradient-to-br from-purple-500/30 to-purple-600/20', gradient: 'from-purple-400 to-purple-500' },
  teal:    { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/30', glow: 'shadow-[0_0_12px_rgba(20,184,166,0.15)]', icon: 'bg-gradient-to-br from-teal-500/30 to-teal-600/20', gradient: 'from-teal-400 to-teal-500' },
  sky:     { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', glow: 'shadow-[0_0_12px_rgba(14,165,233,0.15)]', icon: 'bg-gradient-to-br from-sky-500/30 to-sky-600/20', gradient: 'from-sky-400 to-sky-500' },
  pink:    { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30', glow: 'shadow-[0_0_12px_rgba(236,72,153,0.15)]', icon: 'bg-gradient-to-br from-pink-500/30 to-pink-600/20', gradient: 'from-pink-400 to-pink-500' },
  lime:    { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/30', glow: 'shadow-[0_0_12px_rgba(132,204,22,0.15)]', icon: 'bg-gradient-to-br from-lime-500/30 to-lime-600/20', gradient: 'from-lime-400 to-lime-500' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = Cookies.get('rhr_admin_token');
    const savedUser = Cookies.get('rhr_admin_user');
    if (saved && savedUser) {
      try { setUser(JSON.parse(savedUser)); setToken(saved); }
      catch { Cookies.remove('rhr_admin_token'); Cookies.remove('rhr_admin_user'); }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        setUser(data.user);
        Cookies.set('rhr_admin_token', data.token, { expires: 7 });
        Cookies.set('rhr_admin_user', JSON.stringify(data.user), { expires: 7 });
        return { ok: true };
      }
      return { ok: false, error: data.detail || data.error || 'Login fallido' };
    } catch (e: any) {
      return { ok: false, error: 'Error de conexión' };
    }
  };

  const logout = () => {
    Cookies.remove('rhr_admin_token');
    Cookies.remove('rhr_admin_user');
    setToken('');
    setUser(null);
    router.push('/admin');
  };

  const headers = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  // ─── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!isLoading && !token) {
    return (
      <AdminAuthContext.Provider value={{ user, token, isLoading, login, logout, headers }}>
        <LoginScreen login={login} />
      </AdminAuthContext.Provider>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060910] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find(i => i.href === pathname);
  const activeColor = activeItem ? COLOR_MAP[activeItem.color] : COLOR_MAP.blue;

  return (
    <AdminAuthContext.Provider value={{ user, token, isLoading, login, logout, headers }}>
      <div className="flex min-h-screen bg-[#060910]">
        {/* Mobile overlay */}
        {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed lg:relative z-50 h-screen flex flex-col bg-[#080d18]/95 backdrop-blur-xl border-r border-white/[0.06] transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[220px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/20 flex-shrink-0">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-white tracking-wide whitespace-nowrap">ROSS HOUSE</div>
                <div className="text-[9px] text-blue-400/70 tracking-[0.2em] font-medium">RENTALS</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            {NAV_GROUPS.map((group, gi) => (
              <div key={gi} className="mb-2">
                {group.label && !collapsed && (
                  <div className="px-3 py-2 text-[10px] font-bold text-gray-500/80 tracking-[0.2em]">{group.label}</div>
                )}
                {group.label && collapsed && <div className="h-px bg-white/[0.04] mx-2 my-2" />}
                {group.items.map(item => {
                  const isActive = pathname === item.href;
                  const c = COLOR_MAP[item.color];
                  return (
                    <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl mb-0.5 transition-all duration-200 group relative
                        ${isActive ? `${c.bg} ${c.border} border ${c.glow}` : 'hover:bg-white/[0.03] border border-transparent'}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all
                        ${isActive ? c.icon : 'bg-white/[0.03] group-hover:bg-white/[0.05]'}`}>
                        <item.Icon className={`w-4 h-4 ${isActive ? c.text : 'text-gray-500 group-hover:text-gray-400'}`} />
                      </div>
                      {!collapsed && (
                        <div className="overflow-hidden">
                          <div className={`text-sm font-semibold truncate ${isActive ? c.text : 'text-gray-300 group-hover:text-white'}`}>{item.label}</div>
                          <div className="text-[10px] text-gray-600 truncate">{item.desc}</div>
                        </div>
                      )}
                      {isActive && (
                        <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full bg-gradient-to-b ${c.gradient}`} />
                      )}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User bar */}
          <div className="border-t border-white/[0.06] p-3 flex-shrink-0">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-full flex items-center justify-center text-blue-400 text-xs font-bold flex-shrink-0">
                  {user?.name?.[0] || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-300 truncate">{user?.email || 'Admin'}</div>
                </div>
              </div>
            ) : null}
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'mt-2 justify-between'}`}>
              <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-white/[0.04] transition">
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              {!collapsed && (
                <button onClick={logout} className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-500/5">
                  <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
          {/* Top bar */}
          <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.06] bg-[#080d18]/50 backdrop-blur-md flex-shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/[0.04]">
                <Menu className="w-5 h-5 text-gray-400" />
              </button>
              <h1 className="text-base font-bold text-white">{activeItem?.label || 'Admin'}</h1>
              <span className="text-[10px] text-gray-600 hidden sm:block">Ross House Rentals • Dumas TX</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="hidden sm:block">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-bold">Online</span>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </AdminAuthContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ login }: { login: (e: string, p: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await login(email, password);
    if (!result.ok) setError(result.error || 'Error');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#060910] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/[0.04] rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-[120px]" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-500">Ross House Rentals</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/[0.08] p-6">
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm text-center">{error}</div>}
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
              placeholder="admin@rosshouserentals.com" required />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a1020]/60 border border-white/[0.08] rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none"
              placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Acceder'}
          </button>
        </form>
      </div>
    </div>
  );
}
