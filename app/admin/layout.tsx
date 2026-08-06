'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import AdminLoginScreen from '../components/admin/AdminLoginScreen';
import { AppHeaderButton } from '../components/AppPromoBanner';
import NavBell, { type NavSummary } from '../components/admin/NavBell';
import CommandPalette from '../components/admin/CommandPalette';
import MobileBottomNav from '../components/admin/MobileBottomNav';
import ThemeToggle from '../components/ThemeToggle';
import {
  LayoutDashboard, Home, Users, FileText, CreditCard, Wrench, CalendarDays,
  Settings, LogOut, ChevronLeft, ChevronRight, Menu, X,
  DollarSign, Building2, TrendingUp, Briefcase, Store, UserCog,
  FileBarChart, MessageSquare, ClipboardCheck, Zap, ShieldAlert, ScanLine,
  Wallet, Repeat, Vault, ClipboardList, Heart, Brain, Globe, Smartphone, Share2, Mail, Megaphone,
  Search, ChevronDown, Landmark, Star,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════
interface AdminAuthContextType {
  user: any;
  token: string;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithToken: (token: string, user: any) => void;
  logout: () => void;
  headers: () => Record<string, string>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  user: null, token: '', isLoading: true,
  login: async () => ({ ok: false }),
  loginWithToken: () => {},
  logout: () => {},
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
      { href: '/admin/ai-brain', Icon: Brain, label: 'AI Brain', desc: 'Tu copiloto inteligente ⭐', color: 'violet' },
      { href: '/admin/ai-brain/insights', Icon: Brain, label: 'Business Insights', desc: 'Análisis IA', color: 'fuchsia' },
      { href: '/admin/lease-renewals', Icon: Repeat, label: 'Renovaciones', desc: 'IA · propuestas leases', color: 'amber' },
      { href: '/admin/analytics', Icon: Globe, label: 'Visitantes', desc: 'Tráfico en vivo + Geo 🔴', color: 'emerald' },
      { href: '/admin/app-adoption', Icon: Smartphone, label: 'App Adoption', desc: '¿Quién descargó la app? 📱', color: 'indigo' },
    ],
  },
  {
    label: 'PROPIEDADES',
    items: [
      { href: '/admin/propiedades', Icon: Home, label: 'Propiedades', desc: 'Inventario', color: 'cyan' },
      { href: '/admin/aplicaciones', Icon: ClipboardList, label: 'Aplicaciones', desc: 'Prospectos web', color: 'blue' },
      { href: '/admin/interesados', Icon: Heart, label: 'Lista de Espera', desc: 'Inquilinos interesados', color: 'pink' },
      { href: '/admin/publicar', Icon: Megaphone, label: 'Publicar', desc: 'Zillow · Zumper · Feed 📣', color: 'pink' },
      { href: '/admin/pm-waitlist', Icon: Building2, label: 'PM Waitlist', desc: 'Propietarios interesados 🚧', color: 'indigo' },
      { href: '/admin/proveedores', Icon: Wrench, label: 'Proveedores', desc: 'Plomeros, electricistas...', color: 'amber' },
      { href: '/admin/inquilinos', Icon: Users, label: 'Inquilinos', desc: 'Base de datos', color: 'violet' },
      { href: '/admin/contratos', Icon: FileText, label: 'Contratos', desc: 'Alquileres', color: 'emerald' },
      { href: '/admin/marketplace', Icon: Store, label: 'Marketplace', desc: 'Listados & Consultas', color: 'cyan' },
      { href: '/admin/mantenimiento', Icon: Wrench, label: 'Mantenimiento', desc: 'Solicitudes', color: 'amber' },
      { href: '/admin/inspecciones', Icon: ClipboardCheck, label: 'Inspecciones', desc: 'Move-in/Move-out', color: 'lime' },
      { href: '/admin/energia', Icon: Zap, label: 'Energía', desc: 'Consumo Xcel', color: 'yellow' },
      { href: '/admin/facturas-ocr', Icon: ScanLine, label: 'Facturas OCR', desc: 'Water/Gas con IA', color: 'cyan' },
      { href: '/admin/alineacion-utilities', Icon: ShieldAlert, label: 'Alineación', desc: 'Título ↔ Servicios', color: 'rose' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { href: '/admin/pagos', Icon: CreditCard, label: 'Pagos', desc: 'Cobros & Rentas', color: 'amber' },
      { href: '/admin/metodos-pago', Icon: Wallet, label: 'Métodos Pago', desc: 'Stripe, Zelle, etc.', color: 'green' },
      { href: '/admin/autopagos', Icon: Repeat, label: 'Autopagos', desc: 'Cobros automáticos', color: 'red' },
      { href: '/admin/baul', Icon: Vault, label: 'Baúl Seguro', desc: 'Tarjetas + Bancos PIN', color: 'amber' },
      { href: '/admin/gastos', Icon: DollarSign, label: 'Gastos', desc: 'Mantenimiento', color: 'red' },
      { href: '/admin/impuestos', Icon: Landmark, label: 'Impuestos', desc: 'Moore County · deuda real 🏛️', color: 'orange' },
      { href: '/admin/formularios-1099', Icon: FileBarChart, label: '1099-NEC', desc: 'Contratistas · IRS 📋', color: 'lime' },
      { href: '/admin/rendimiento', Icon: TrendingUp, label: 'Rendimiento', desc: 'ROI & Analytics', color: 'indigo' },
      { href: '/admin/inversiones', Icon: Briefcase, label: 'Inversiones', desc: 'Comprar/Reparar/Vender', color: 'orange' },
      { href: '/admin/propietarios', Icon: UserCog, label: 'Propietarios', desc: 'Gestión Owners', color: 'purple' },
      { href: '/admin/calendario', Icon: CalendarDays, label: 'Calendario', desc: 'Eventos & Fechas', color: 'teal' },
      { href: '/admin/reportes', Icon: FileBarChart, label: 'Reportes', desc: 'PDF & CSV Export', color: 'sky' },
    ],
  },
  {
    label: 'SYNDICATION',
    items: [
      { href: '/admin/syndication', Icon: Briefcase, label: 'Deals', desc: 'Capital raise & LP cap table', color: 'emerald' },
      { href: '/admin/inversionistas', Icon: Users, label: 'Inversionistas', desc: 'Portafolio LPs cross-deal', color: 'violet' },
    ],
  },
  {
    label: 'MARKETING',
    items: [
      { href: '/admin/marketing', Icon: Mail, label: 'Newsletter', desc: 'Suscriptores & campañas 📬', color: 'pink' },
      { href: '/admin/marketing/social-poster', Icon: Share2, label: 'Social Poster', desc: 'AI · FB groups · leads 📣', color: 'blue' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { href: '/admin/mensajes', Icon: MessageSquare, label: 'Mensajes', desc: 'SMS & Email', color: 'pink' },
      { href: '/admin/buzon', Icon: Mail, label: 'Buzón Email', desc: 'Recibir & enviar correos 📬', color: 'pink' },
      { href: '/admin/seguridad', Icon: ShieldAlert, label: 'Seguridad', desc: '2FA & Dispositivos', color: 'green' },
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
  rose:    { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', glow: 'shadow-[0_0_12px_rgba(244,63,94,0.15)]', icon: 'bg-gradient-to-br from-rose-500/30 to-rose-600/20', gradient: 'from-rose-400 to-rose-500' },
  yellow:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.15)]', icon: 'bg-gradient-to-br from-yellow-500/30 to-yellow-600/20', gradient: 'from-yellow-400 to-yellow-500' },
  fuchsia: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', glow: 'shadow-[0_0_12px_rgba(217,70,239,0.15)]', icon: 'bg-gradient-to-br from-fuchsia-500/30 to-fuchsia-600/20', gradient: 'from-fuchsia-400 to-fuchsia-500' },
  green:   { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', glow: 'shadow-[0_0_12px_rgba(34,197,94,0.15)]', icon: 'bg-gradient-to-br from-green-500/30 to-green-600/20', gradient: 'from-green-400 to-green-500' },
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
  const [navQuery, setNavQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<NavSummary | null>(null);
  const [favs, setFavs] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Favorites (pinned menu items) from localStorage
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('rhr_nav_favs') || '[]')); } catch { /* noop */ }
  }, []);
  const toggleFav = (href: string) => {
    setFavs(prev => {
      const next = prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href];
      try { localStorage.setItem('rhr_nav_favs', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  // ⌘K / Ctrl+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Restore open groups from localStorage + always open the active route's group
  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try { saved = JSON.parse(localStorage.getItem('rhr_nav_groups') || '{}'); } catch { /* noop */ }
    const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.href === pathname))?.label;
    if (activeGroup) saved[activeGroup] = true;
    setOpenGroups(saved);
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem('rhr_nav_groups', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

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
      const res = await fetch('/api/public/marketplace-login', {
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

  const loginWithToken = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    Cookies.set('rhr_admin_token', newToken, { expires: 7 });
    Cookies.set('rhr_admin_user', JSON.stringify(newUser), { expires: 7 });
  };

  const headers = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

  // Pending-counts summary for the bell + sidebar badges (refresh every 60s)
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/nav-summary', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok && alive) setSummary(await res.json());
      } catch { /* noop */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, [token, pathname]);

  const badgeFor = (href: string): number => {
    if (!summary) return 0;
    switch (href) {
      case '/admin/aplicaciones': return summary.new_applications;
      case '/admin/mantenimiento': return summary.open_maintenance;
      case '/admin/contratos': return summary.pending_signatures;
      case '/admin/pagos': return summary.late_payments;
      case '/admin/impuestos': return summary.delinquent_taxes?.count || 0;
      default: return 0;
    }
  };

  // ─── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!isLoading && !token) {
    return (
      <AdminAuthContext.Provider value={{ user, token, isLoading, login, loginWithToken, logout, headers }}>
        <AdminLoginScreen onSuccess={loginWithToken} />
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
  const activeColor = activeItem ? (COLOR_MAP[activeItem.color] || COLOR_MAP.blue) : COLOR_MAP.blue;

  return (
    <AdminAuthContext.Provider value={{ user, token, isLoading, login, loginWithToken, logout, headers }}>
      <div className="dark flex min-h-screen bg-[#060910]">
        {/* Mobile overlay */}
        {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

        {/* Sidebar */}
        <aside className={`fixed lg:relative z-50 h-screen flex flex-col bg-white/95 dark:bg-[#080d18]/95 backdrop-blur-xl border-r border-slate-200 dark:border-white/[0.06] transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[236px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-200 dark:border-white/[0.06] flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-400 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-400/20 flex-shrink-0">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="font-bold text-sm text-slate-900 dark:text-white tracking-wide whitespace-nowrap">ROSS HOUSE</div>
                <div className="text-[9px] text-blue-600 dark:text-blue-400/70 tracking-[0.2em] font-medium">RENTALS</div>
              </div>
            )}
          </div>

          {/* Buscador rápido del menú */}
          {!collapsed && (
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-gray-600" />
                <input
                  type="text"
                  value={navQuery}
                  onChange={e => setNavQuery(e.target.value)}
                  placeholder="Buscar en el menú..."
                  className="w-full pl-8 pr-7 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-xs text-slate-800 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500/50"
                />
                {navQuery && (
                  <button onClick={() => setNavQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-600 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {navQuery.trim() && !collapsed ? (
              /* ── Resultados de búsqueda (lista plana) ── */
              (() => {
                const q = navQuery.trim().toLowerCase();
                const results = NAV_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
                if (results.length === 0) return <div className="px-3 py-4 text-xs text-slate-400 dark:text-gray-600 text-center">Sin resultados</div>;
                return results.map(item => {
                  const isActive = pathname === item.href;
                  const c = COLOR_MAP[item.color] || COLOR_MAP.blue;
                  return (
                    <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={item.desc}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 transition-colors
                        ${isActive ? `${c.bg} ${c.text} border ${c.border}` : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white border border-transparent'}`}>
                      <item.Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? c.text : ''}`} />
                      <span className="text-[13px] font-medium truncate">{item.label}</span>
                    </a>
                  );
                });
              })()
            ) : (
              <>
              {/* ── Favoritos (fijados por el admin) ── */}
              {favs.length > 0 && !collapsed && (
                <div className="mb-1">
                  <div className="px-3 py-2 text-[10px] font-bold tracking-[0.18em] text-amber-500/90 flex items-center gap-1.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> FAVORITOS
                  </div>
                  {favs.map(href => {
                    const item = NAV_ITEMS.find(i => i.href === href);
                    if (!item) return null;
                    const isActive = pathname === item.href;
                    const c = COLOR_MAP[item.color] || COLOR_MAP.blue;
                    const badge = badgeFor(item.href);
                    return (
                      <a key={`fav-${item.href}`} href={item.href} onClick={() => setMobileOpen(false)} title={item.desc}
                        className={`group/item flex items-center gap-2.5 rounded-lg mb-0.5 px-3 py-2 ml-1 transition-colors relative
                          ${isActive ? `${c.bg} border ${c.border} ${c.glow}` : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-transparent'}`}>
                        <item.Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? c.text : 'text-slate-500 dark:text-gray-500'}`} />
                        <span className={`flex-1 text-[13px] font-medium truncate ${isActive ? c.text : 'text-slate-600 dark:text-gray-400'}`}>{item.label}</span>
                        {badge > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/25 text-[10px] font-bold flex items-center justify-center">{badge}</span>
                        )}
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFav(item.href); }} title="Quitar de favoritos"
                          className="opacity-0 group-hover/item:opacity-100 transition p-0.5">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </button>
                      </a>
                    );
                  })}
                  <div className="h-px bg-slate-200 dark:bg-white/[0.04] mx-2 my-2" />
                </div>
              )}
              {NAV_GROUPS.map((group, gi) => {
                const hasActive = group.items.some(i => i.href === pathname);
                const isOpen = !group.label || openGroups[group.label] || false;
                return (
                  <div key={gi} className="mb-1">
                    {group.label && !collapsed && (
                      <button
                        onClick={() => toggleGroup(group.label!)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors group/hdr
                          ${hasActive && !isOpen ? 'bg-slate-100 dark:bg-white/[0.03]' : 'hover:bg-slate-100 dark:hover:bg-white/[0.03]'}`}
                      >
                        <span className={`text-[10px] font-bold tracking-[0.18em] ${hasActive ? 'text-slate-700 dark:text-gray-300' : 'text-slate-500 dark:text-gray-500'}`}>
                          {group.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1.5 py-px rounded-full bg-slate-200 dark:bg-white/[0.06] text-slate-500 dark:text-gray-500 font-bold">{group.items.length}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                    )}
                    {group.label && collapsed && <div className="h-px bg-slate-200 dark:bg-white/[0.04] mx-2 my-2" />}
                    {(isOpen || collapsed) && group.items.map(item => {
                      const isActive = pathname === item.href;
                      const c = COLOR_MAP[item.color] || COLOR_MAP.blue;
                      const badge = badgeFor(item.href);
                      const isFav = favs.includes(item.href);
                      return (
                        <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={item.desc}
                          className={`group/item flex items-center gap-2.5 rounded-lg mb-0.5 transition-colors relative
                            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2 ml-1'}
                            ${isActive ? `${c.bg} border ${c.border} ${c.glow}` : 'hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-transparent'}`}>
                          <item.Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? c.text : 'text-slate-500 dark:text-gray-500'}`} />
                          {collapsed && badge > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                          )}
                          {!collapsed && (
                            <>
                              <span className={`flex-1 text-[13px] font-medium truncate ${isActive ? c.text : 'text-slate-600 dark:text-gray-400'}`}>{item.label}</span>
                              {badge > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 border border-red-500/25 text-[10px] font-bold flex items-center justify-center">{badge}</span>
                              )}
                              <button onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFav(item.href); }}
                                title={isFav ? 'Quitar de favoritos' : 'Fijar en favoritos'}
                                className={`transition p-0.5 ${isFav ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'}`}>
                                <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-400 dark:text-gray-600'}`} />
                              </button>
                            </>
                          )}
                          {isActive && !collapsed && badge === 0 && (
                            <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-b ${c.gradient}`} />
                          )}
                        </a>
                      );
                    })}
                  </div>
                );
              })}
              </>
            )}
          </nav>

          {/* User bar */}
          <div className="border-t border-slate-200 dark:border-white/[0.06] p-3 flex-shrink-0">
            {!collapsed ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold flex-shrink-0">
                  {user?.name?.[0] || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 dark:text-gray-300 truncate">{user?.email || 'Admin'}</div>
                </div>
              </div>
            ) : null}
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'mt-2 justify-between'}`}>
              <button onClick={() => setCollapsed(!collapsed)} className="text-slate-500 dark:text-gray-500 hover:text-slate-900 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition">
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              {!collapsed && (
                <button onClick={logout} className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-500/5">
                  <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300`}>
          {/* Top bar */}
          <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#080d18]/50 backdrop-blur-md flex-shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04]">
                <Menu className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              </button>
              <h1 className="text-base font-bold text-slate-900 dark:text-white">{activeItem?.label || 'Admin'}</h1>
              <span className="text-[10px] text-slate-500 dark:text-gray-600 hidden sm:block">{activeItem?.desc || 'Ross House Rentals • Dumas TX'}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-500 dark:text-gray-500">
              <button onClick={() => setPaletteOpen(true)} data-testid="open-palette-btn"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 transition-colors"
                title="Búsqueda global (Ctrl+K)">
                <Search className="w-3.5 h-3.5" />
                <span className="text-[11px]">Buscar...</span>
                <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/10 font-bold">⌘K</kbd>
              </button>
              <button onClick={() => setPaletteOpen(true)}
                className="sm:hidden p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400"
                title="Buscar">
                <Search className="w-3.5 h-3.5" />
              </button>
              <NavBell summary={summary} />
              <AppHeaderButton />
              <ThemeToggle variant="icon-only" />
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Online</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 sm:p-6 pb-20 lg:pb-6 overflow-auto">{children}</main>
        </div>

        {/* Búsqueda global ⌘K */}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}
          menuItems={NAV_ITEMS.map(i => ({ href: i.href, label: i.label, desc: i.desc }))} headers={headers} />

        {/* Barra inferior en móvil */}
        <MobileBottomNav pathname={pathname} onMenu={() => setMobileOpen(true)} badgeTotal={summary?.total || 0} />
      </div>
    </AdminAuthContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN COMPONENT — moved to /components/admin/AdminLoginScreen.tsx (2FA flow)
// ═══════════════════════════════════════════════════════════════════════════════
