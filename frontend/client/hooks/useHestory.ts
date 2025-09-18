"use client";
import { useCallback, useEffect, useState } from 'react';
import { fetchHistory } from '@/lib/api/me';
import { HistoryResponse } from '../lib/types/history';

export default function useHistory() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchHistory();
      setData(res);
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}