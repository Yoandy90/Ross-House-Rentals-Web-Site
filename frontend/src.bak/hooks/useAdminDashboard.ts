/**
 * useAdminDashboard — Data fetching hook for Admin Dashboard
 * Modular: Each endpoint is a separate fetch, all composed here.
 */
import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export interface DashboardStats {
  kpis: {
    total_invested: number;
    total_profit: number;
    total_balance: number;
    total_collected: number;
    total_interest: number;
    total_admin_fees: number;
    pending_applications: number;
    total_clients: number;
    delinquency_rate: number;
    collection_rate: number;
  };
  counts: {
    total: number;
    active: number;
    paid_off: number;
    delinquent: number;
    this_month: number;
  };
  month_invested: number;
  month_profit: number;
}

export interface ChartData {
  loan_type_distribution: Array<{
    name: string;
    count: number;
    amount: number;
    color: string;
    legendFontColor: string;
  }>;
  status_distribution: Array<{
    name: string;
    count: number;
    color: string;
    legendFontColor: string;
  }>;
  monthly_trend: Array<{
    month: string;
    invested: number;
    profit: number;
    count: number;
  }>;
}

export interface Alert {
  type: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  subtitle: string;
  date: string;
  id: string;
}

export function useAdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/lending/dashboard/stats`, { headers: headers() });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error('Dashboard stats error:', e); }
  }, [headers]);

  const fetchCharts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/lending/dashboard/charts`, { headers: headers() });
      if (res.ok) setCharts(await res.json());
    } catch (e) { console.error('Dashboard charts error:', e); }
  }, [headers]);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/lending/dashboard/alerts`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (e) { console.error('Dashboard alerts error:', e); }
  }, [headers]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchCharts(), fetchAlerts()]);
    setLoading(false);
  }, [fetchStats, fetchCharts, fetchAlerts]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchCharts(), fetchAlerts()]);
    setRefreshing(false);
  }, [fetchStats, fetchCharts, fetchAlerts]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  return { stats, charts, alerts, loading, refreshing, refresh };
}
