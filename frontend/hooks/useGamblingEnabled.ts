import { useState, useEffect } from 'react';
import api from '../services/api';

export function useGamblingEnabled() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const checkFlags = async () => {
      try {
        const res = await api.get('/feature-flags');
        const flags = res.data || {};
        setEnabled(!!(flags.gambling_enabled || flags.raffles_enabled));
      } catch {
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    };
    checkFlags();
  }, []);

  return { loading, enabled };
}
