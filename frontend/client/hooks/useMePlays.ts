// hooks/useMePlays.ts
import { useCallback, useEffect, useState } from "react";
import { getMePlays } from "@/lib/api/me";
import type { MePlaysResponse } from "@/lib/types/me";

export function useMePlays(musicId?: number, initialPage = 1, initialLimit = 20) {
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [data, setData] = useState<MePlaysResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!musicId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await getMePlays({ musicId, page, limit });
      setData(res);
    } catch (e: any) {
      setErr(e?.message || "재생 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [musicId, page, limit]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => load(), [load]);
  const totalPages = data ? Math.max(1, Math.ceil((data.total || 0) / (data.limit || 1))) : 1;

  return { data, loading, error, page, setPage, limit, totalPages, refresh };
}
