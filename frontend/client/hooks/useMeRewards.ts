// hooks/useMeRewards.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { getMeRewards } from "@/lib/api/me";
import type { MeRewardsResponse } from "@/lib/types/me";

export function useMeRewards(initialDays = 7, initialMusicId?: number) {
  const [data, setData] = useState<MeRewardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);

  const daysRef = useRef<number>(initialDays);
  const musicIdRef = useRef<number | undefined>(initialMusicId);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await getMeRewards({
        days: daysRef.current,
        musicId: musicIdRef.current,
      });
      setData(res);
    } catch (e: any) {
      setErr(e?.message || "리워드 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => load(), [load]);
  const setDays = useCallback((d: number) => { daysRef.current = d; refresh(); }, [refresh]);
  const setMusicId = useCallback((id?: number) => { musicIdRef.current = id; refresh(); }, [refresh]);

  return { data, loading, error, refresh, setDays, setMusicId, setData };
}
