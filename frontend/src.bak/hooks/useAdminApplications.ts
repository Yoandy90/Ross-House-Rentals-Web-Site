/**
 * useAdminApplications — Fetch and manage loan applications
 */
import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export interface LoanApplication {
  _id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  amount: string;
  loan_type: string;
  purpose: string;
  status: string;
  created_at: string;
}

export function useAdminApplications() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/lending/applications`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers]);

  const reviewApplication = useCallback(async (appId: string, decision: 'approved' | 'denied', notes?: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/lending/applications/${appId}/review`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ decision, notes: notes || '' }),
      });
      if (res.ok) {
        await fetchApplications();
        return true;
      }
    } catch (e) { console.error(e); }
    return false;
  }, [headers, fetchApplications]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchApplications();
    setRefreshing(false);
  }, [fetchApplications]);

  useEffect(() => { if (token) fetchApplications(); }, [token, fetchApplications]);

  return { applications, loading, refreshing, refresh, reviewApplication };
}
