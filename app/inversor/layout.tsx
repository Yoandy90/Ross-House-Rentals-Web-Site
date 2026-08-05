'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Briefcase, TrendingUp, FileText, LogOut, Building2 } from 'lucide-react';

type InvestorCtx = {
  user: any;
  token: string;
  headers: () => HeadersInit;
  logout: () => void;
};

const Ctx = createContext<InvestorCtx | null>(null);

export const useInvestorAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useInvestorAuth must be inside InvestorLayout');
  return v;
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === '/inversor' || pathname === '/inversor/login';
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('investor_token') : null;
    const u = typeof window !== 'undefined' ? localStorage.getItem('investor_user') : null;
    if (t && u) {
      try {
        setToken(t);
        setUser(JSON.parse(u));
      } catch {
        // ignore corrupt storage
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!isLogin && !token) router.replace('/inversor');
  }, [ready, token, isLogin, router]);

  const logout = () => {
    localStorage.removeItem('investor_token');
    localStorage.removeItem('investor_user');
    setToken('');
    setUser(null);
    router.replace('/inversor');
  };

  const ctxValue: InvestorCtx = {
    user,
    token,
    logout,
    headers: () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
  };

  if (!ready) return <div className="min-h-screen bg-[#070912] flex items-center justify-center"><div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  if (isLogin) {
    return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
  }

  // Authenticated layout with nav
  return (
    <Ctx.Provider value={{ ...ctxValue, headers: () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }) }}>
      <div className="min-h-screen bg-[#070912] text-white">
        <div className="fixed top-0 left-0 right-0 bg-[#0a1020]/80 backdrop-blur-xl border-b border-white/[0.05] z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/inversor/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-none">Ross House Rentals</div>
                <div className="text-[10px] text-emerald-400 font-bold tracking-wider mt-0.5">PORTAL DEL INVERSIONISTA</div>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink href="/inversor/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === '/inversor/dashboard'} />
              <NavLink href="/inversor/deals" icon={Briefcase} label="Mis Deals" active={pathname?.startsWith('/inversor/deals') || false} />
              <NavLink href="/inversor/distribuciones" icon={TrendingUp} label="Distribuciones" active={pathname === '/inversor/distribuciones'} />
            </nav>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-white">{user?.name || user?.email}</div>
                <div className="text-[10px] text-gray-500">LP · {user?.email}</div>
              </div>
              <button onClick={logout} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl text-gray-400 hover:text-red-400 hover:border-red-500/20 transition" title="Cerrar sesión"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">{children}</main>
      </div>
    </Ctx.Provider>
  );
}

function NavLink({ href, icon: Icon, label, active }: any) {
  return (
    <Link href={href} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </Link>
  );
}
