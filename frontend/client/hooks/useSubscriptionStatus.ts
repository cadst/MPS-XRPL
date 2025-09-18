// hooks/useSubscriptionStatus.ts
"use client";
import { useEffect, useMemo } from "react";
import { useMeOverview } from "@/hooks/useMeOverview";

export function useSubscriptionStatus() {
  const { data: overview, refresh } = useMeOverview();

  useEffect(() => {
    const h = () => refresh?.();
    window.addEventListener("mps:me:overview:changed", h);
    return () => window.removeEventListener("mps:me:overview:changed", h);
  }, [refresh]);

  const isActiveSub = useMemo(() => {
    const s = String(overview?.subscription?.status ?? "none").toLowerCase();
    const days = Number(overview?.subscription?.remainingDays ?? 0);
    const plan = String(overview?.subscription?.plan ?? "free").toLowerCase();
    return s === "active" || s === "trialing" || days > 0 || plan !== "free";
  }, [overview]);

  return { isActiveSub, overview };
}
