/**
 * useAdminLoans — Fetch regulated loans list
 */
import { useState, useCallback, useEffect } from 'react';
import { API_URL } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export interface RegulatedLoan {
  _id: string;
  loan_number: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  loan_type: string;
  amount: number;
  balance: number;
  monthly_payment: number;
  total_to_pay: number;
  total_interest: number;
  admin_fee: number;
  status: string;
  term_months: number;
  payments_made: number;
  created_at: string;
}

export function useAdminLoans() {
  const { token } = useAuth();
  const [loans, setLoans] = useState<RegulatedLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  const fetchLoans = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/api/admin/regulated-loans?${params}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setLoans(data.loans || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, search, statusFilter]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLoans();
    setRefreshing(false);
  }, [fetchLoans]);

  useEffect(() => { if (token) fetchLoans(); }, [token, fetchLoans]);

  return { loans, loading, refreshing, refresh, search, setSearch, statusFilter, setStatusFilter };
}
