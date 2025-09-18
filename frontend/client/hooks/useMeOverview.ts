"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMeOverview } from "@/lib/api/me";
import type { MeOverview } from "@/lib/types/me";

/** 안전 숫자화 */
const toNum = (v: any, def = 0) => {
  if (v == null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
/** 소문자 + 트림 정규화 (핵심!) */
const lowerTrim = (v: any, def = "") => String(v ?? def).trim().toLowerCase();

/** 서버/raw/adapted 응답을 MyPage가 기대하는 ViewModel로 정규화 */
function normalize(raw: any): MeOverview {
  // --- 회사 리워드 계산 (서버가 rewardBalance 주면 우선 신뢰) ---
  const earned =
    raw?.company?.totalRewardsEarned ??
    raw?.total_rewards_earned ??
    0;

  const used =
    raw?.company?.totalRewardsUsed ??
    raw?.total_rewards_used ??
    0;

  const rewardBalanceRaw =
    raw?.company?.rewardBalance ??
    raw?.reward_balance ??
    raw?.company?.reward_balance ??
    undefined;

  const rewardBalance =
    rewardBalanceRaw != null && rewardBalanceRaw !== ""
      ? toNum(rewardBalanceRaw, 0)
      : Math.max(0, toNum(earned, 0) - toNum(used, 0));

  // --- company 묶음 (camel 우선, snake 호환) ---
  const company = {
    id: toNum(raw?.company?.id ?? raw?.id, 0),
    name: String(raw?.company?.name ?? raw?.name ?? ""),
    grade: lowerTrim(raw?.company?.grade ?? raw?.grade ?? "free") as "free" | "standard" | "business",
    ceoName: raw?.company?.ceoName ?? raw?.ceo_name ?? "",
    phone: raw?.company?.phone ?? raw?.phone ?? "",
    homepageUrl: raw?.company?.homepageUrl ?? raw?.homepage_url ?? "",
    profileImageUrl:
      raw?.company?.profileImageUrl ??
      raw?.profile_image_url ??
      raw?.company?.profile_image_url ??
      null,
    smartAccountAddress:
      raw?.company?.smartAccountAddress ??
      raw?.smart_account_address ??
      null,
    totalRewardsEarned: toNum(earned, 0),
    totalRewardsUsed: toNum(used, 0),
    rewardBalance,
  };

  // --- API Key last4 ---
  const apiKey = (() => {
    if (raw?.apiKey?.last4) return { last4: String(raw.apiKey.last4) };
    if (typeof raw?.api_key === "string") return { last4: String(raw.api_key).slice(-4) };
    return { last4: null as string | null };
  })();

  // --- 사용 요약/목록 ---
  const usingSummary = raw?.usingSummary ?? {
    usingCount: toNum(raw?.using_count, 0),
  };
  const usingList = Array.isArray(raw?.usingList)
    ? raw.usingList
    : Array.isArray(raw?.using_list)
    ? raw.using_list
    : [];

  // --- 구독 정보 ---
  const subscriptionRaw = raw?.subscription ?? {};

  // (1) 모든 후보를 lower+trim
  const planCandidates = [
    subscriptionRaw.plan,
    raw?.subscriptionStatus,
    raw?.subscription_status,
    raw?.grade,
    raw?.company?.grade,
    company.grade,
  ].map((v) => lowerTrim(v, "")).filter(Boolean);

  let planLower = planCandidates[0] || "free";
  if (!["free", "standard", "business"].includes(planLower)) planLower = "free";

  let statusLower = lowerTrim(
    subscriptionRaw.status ?? raw?.status ?? "none",
    "none"
  );

  const remainingDays = toNum(
    subscriptionRaw.remainingDays ??
      subscriptionRaw.remaining_days ??
      raw?.remaining_days,
    0
  );

  // (2) plan vs company.grade 충돌 시, 더 높은 등급을 신뢰 (핵심!)
  const rank: Record<"free" | "standard" | "business", number> = {
    free: 0, standard: 1, business: 2,
  };
  const companyPlan = company.grade;
  if (["free","standard","business"].includes(companyPlan)) {
    const cp = companyPlan as "free"|"standard"|"business";
    const pp = (["free","standard","business"].includes(planLower) ? planLower : "free") as "free"|"standard"|"business";
    if (rank[cp] > rank[pp]) {
      planLower = cp;
      if (statusLower === "none") statusLower = "active";
    }
  }

  const subscription = {
    plan: planLower as "free" | "standard" | "business",
    status: statusLower,
    remainingDays,
  };

  // 디버깅 로그(원인이 또 생기면 확인용)
  // console.log("[useMeOverview] normalized:", { company, subscription });

  return {
    company,
    apiKey,
    usingSummary,
    usingList,
    subscription,
  } as MeOverview;
}

export function useMeOverview() {
  const [data, setData] = useState<MeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState<string | null>(null);

  const doFetch = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setErr(null);
        const raw = await fetchMeOverview({ signal });
        const vm = normalize(raw);
        setData(vm);
      } catch (e: any) {
        if (e?.name === "AbortError" || String(e?.message).includes("aborted")) return;
        if (e?.status === 401 || e?.response?.status === 401) {
          setData(null);
          setErr(null);
          return;
        }
        setErr(e?.message ?? "failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const ac = new AbortController();
    doFetch(ac.signal);
    return () => ac.abort();
  }, [doFetch]);

  const refresh = useCallback(async () => {
    await doFetch();
  }, [doFetch]);

  useEffect(() => {
    const onOverviewChanged = () => { refresh(); };
    const onAuthChanged = () => { refresh(); };
    window.addEventListener("mps:me:overview:changed", onOverviewChanged);
    window.addEventListener("mps:auth:changed", onAuthChanged);
    return () => {
      window.removeEventListener("mps:me:overview:changed", onOverviewChanged);
      window.removeEventListener("mps:auth:changed", onAuthChanged);
    };
  }, [refresh]);

  return { data, loading, error, refresh, setData };
}
