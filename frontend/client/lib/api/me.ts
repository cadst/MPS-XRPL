// lib/api/me.ts
import { MeOverview, MeRewardsResponse, MePlaysResponse } from "@/lib/types/me";
import { getAccessToken } from "@/lib/api/auth/token";
import { HistoryResponse } from "@/lib/types/history";
import { apiOrNull } from "@/lib/api/core/http";
/* ---------------- helpers ---------------- */
function normalizeToken(t: unknown): string | null {
  const s = typeof t === "string" ? t.trim() : "";
  if (!s || s === "undefined" || s === "null") return null;
  return s;
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal) {
  if (!a) return b;
  if (!b) return a;
  const c = new AbortController();
  const abortA = () => c.abort(a.reason ?? "merge:a");
  const abortB = () => c.abort(b.reason ?? "merge:b");
  if (a.aborted) c.abort(a.reason ?? "merge:a");
  if (b.aborted) c.abort(b.reason ?? "merge:b");
  a.addEventListener("abort", abortA, { once: true });
  b.addEventListener("abort", abortB, { once: true });
  return c.signal;
}

/** base + 상대경로를 절대 URL로 변환 */
function toAbsolute(base: string, path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

const DEFAULT_BASE = "http://localhost:4000";

/** 서버 JSON을 프론트 ViewModel(MeOverview)로 적응 */
function adaptMe(json: any, base: string): MeOverview {
  const rawCompany =
    json && typeof json.company === "object" ? json.company : {};
  const top = json ?? {};
  const pick = <T>(...cands: T[]) =>
    cands.find((v) => v !== undefined && v !== null);

  // ---- grade (유니온 안전)
  const gradeRaw = pick(rawCompany.grade, top.grade, "free");
  const validGrades = ["free", "standard", "business"] as const;
  const grade: (typeof validGrades)[number] = validGrades.includes(
    gradeRaw as any
  )
    ? (gradeRaw as any)
    : "free";

  const profileImageRaw = pick(
    rawCompany.profile_image_url,
    rawCompany.profileImageUrl,
    top.profile_image_url,
    top.profileImageUrl
  );
  const ceoNameRaw = pick(
    rawCompany.ceo_name,
    rawCompany.ceoName,
    top.ceo_name,
    top.ceoName
  );
  const phoneRaw = pick(rawCompany.phone, top.phone);
  const homepageUrlRaw = pick(
    rawCompany.homepage_url,
    rawCompany.homepageUrl,
    top.homepage_url,
    top.homepageUrl
  );
  const smartAddrRaw = pick(
    rawCompany.smart_account_address,
    rawCompany.smartAccountAddress,
    top.smart_account_address,
    top.smartAccountAddress
  );
  const xrplAddrRaw = pick(
    (rawCompany as any).xrpl_address,
    (rawCompany as any).xrplAddress,
    (top as any).xrpl_address,
    (top as any).xrplAddress
  );
  const totalEarnedRaw = pick(
    rawCompany.total_rewards_earned,
    rawCompany.totalRewardsEarned,
    top.total_rewards_earned,
    top.totalRewardsEarned,
    0
  );
  const totalUsedRaw = pick(
    rawCompany.total_rewards_used,
    rawCompany.totalRewardsUsed,
    top.total_rewards_used,
    top.totalRewardsUsed,
    0
  );
  const rewardBalanceRaw = pick(
    rawCompany.reward_balance,
    rawCompany.rewardBalance,
    top.reward_balance,
    top.rewardBalance,
    (Number(totalEarnedRaw) || 0) - (Number(totalUsedRaw) || 0)
  );

  const subs =
    json && typeof json.subscription === "object" ? json.subscription : {};
  const apiKeyRaw = json?.api_key ?? json?.apiKey ?? { last4: null };
  const summaryRaw = json?.using_summary ?? json?.usingSummary ?? {};

  const usingList = Array.isArray(json?.using_list)
    ? json.using_list
    : Array.isArray(json?.usingList)
    ? json.usingList
    : [];

  return {
    company: {
      id: Number(pick(rawCompany.id, top.id, 0)),
      name: String(pick(rawCompany.name, top.name, "")),
      grade,
      profileImageUrl: toAbsolute(base, String(profileImageRaw ?? "")) ?? null,
      smartAccountAddress: smartAddrRaw ?? null,
      xrplAddress: xrplAddrRaw ?? null,
      totalRewardsEarned: Number(totalEarnedRaw ?? 0),
      totalRewardsUsed: Number(totalUsedRaw ?? 0),
      rewardBalance: Number(rewardBalanceRaw ?? 0),
      ceoName: ceoNameRaw ?? null,
      phone: phoneRaw ?? null,
      homepageUrl: homepageUrlRaw ?? null,
    },
    subscription: {
      plan:
        subs.plan ??
        json?.subscriptionStatus ??
        json?.subscription_status ??
        grade,
      status: subs.status ?? "none",
      remainingDays: Number(subs.remaining_days ?? subs.remainingDays ?? 0),
    },
    apiKey: { last4: apiKeyRaw?.last4 ?? null },
    usingSummary: {
      usingCount: Number(summaryRaw.using_count ?? summaryRaw.usingCount ?? 0),
    },
    usingList,
  };
}

/* ---------------- API: GET ---------------- */
export async function fetchMeOverview(opts?: {
  base?: string;
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<MeOverview | null> {
  // 반환 타입을 MeOverview | null 로 변경
  const baseRaw = (
    opts?.base ??
    process.env.NEXT_PUBLIC_API_BASE ??
    DEFAULT_BASE
  ).replace(/\/+$/, "");
  const json = await apiOrNull<any>("/me/overview");
  if (!json) return null;
  return adaptMe(json, baseRaw);
}

/** AbortError는 조용히 무시하고 null 반환 */
export async function tryFetchMeOverview(
  opts?: Parameters<typeof fetchMeOverview>[0]
): Promise<MeOverview | null> {
  try {
    return await fetchMeOverview(opts);
  } catch (e: any) {
    if (e?.name === "AbortError") return null;
    throw e;
  }
}

/* ---------------- API: PATCH (JSON) ---------------- */
export async function updateMeProfile(payload: {
  ceo_name?: string;
  phone?: string;
  homepage_url?: string;
  profile_image_url?: string;
}): Promise<MeOverview> {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const raw =
    typeof getAccessToken === "function" ? await getAccessToken() : null;
  const token = normalizeToken(raw);

  const res = await fetch(`${base}/me/profile`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: token ? "omit" : "include",
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);

  const json = JSON.parse(txt || "{}");
  return adaptMe(json, base);
}

export async function updateMeProfileFormData(
  fields: {
    ceo_name?: string;
    phone?: string;
    homepage_url?: string;
    profile_image_url?: string;
  },
  file?: File
): Promise<MeOverview> {
  if (!file) return updateMeProfile(fields);

  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const raw =
    typeof getAccessToken === "function" ? await getAccessToken() : null;
  const token = normalizeToken(raw);

  const fd = new FormData();
  if (fields.ceo_name) fd.append("ceo_name", fields.ceo_name);
  if (fields.phone) fd.append("phone", fields.phone);
  if (fields.homepage_url) fd.append("homepage_url", fields.homepage_url);
  if (fields.profile_image_url)
    fd.append("profile_image_url", fields.profile_image_url);
  fd.append("profile_image", file);

  const res = await fetch(`${base}/me/profile`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: token ? "omit" : "include",
    body: fd,
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);

  const json = JSON.parse(txt || "{}");
  return adaptMe(json, base);
}

/* ---------------- API: POST (구독 결제) ---------------- */
export async function subscribeMe(opts: {
  tier: "standard" | "business";
  use_rewards: number; // 사용할 리워드 (원화가 아님)
}) {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );

  const res = await fetch(`${base}/me/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include", // 쿠키 인증
    body: JSON.stringify(opts),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);

  // 서버가 overview 형태를 그대로 주니까 기존 어댑터로 변환해서 반환
  return adaptMe(json, base);
}

/* ---------------- API: GET (구매/마일리지 이력) ---------------- */
export async function fetchHistory(): Promise<HistoryResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/me/history`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

/* =========================
 *  /me/rewards & /me/plays
 * ========================= */

/** /me/rewards — 월 요약 + 아코디언 + 최근 N일 */
export async function getMeRewards(params?: {
  days?: number;
  musicId?: number;
}) {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const raw =
    typeof getAccessToken === "function" ? await getAccessToken() : null;
  const token = normalizeToken(raw);

  const qs = new URLSearchParams();
  if (params?.days) qs.set("days", String(params.days));
  if (params?.musicId) qs.set("musicId", String(params.musicId));

  const url = `${base}/me/rewards${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: token ? "omit" : "include",
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);

  const json = JSON.parse(txt || "{}");
  return json as MeRewardsResponse;
}

/** /me/plays — 특정 음원의 재생 로그(유효/리워드 포함) */
export async function getMePlays(params: {
  musicId: number;
  page?: number;
  limit?: number;
}) {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const raw =
    typeof getAccessToken === "function" ? await getAccessToken() : null;
  const token = normalizeToken(raw);

  const qs = new URLSearchParams({ musicId: String(params.musicId) });
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));

  const url = `${base}/me/plays?${qs.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: token ? "omit" : "include",
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);

  const json = JSON.parse(txt || "{}");
  return json as MePlaysResponse;
}

export async function removeUsingTrack(musicId: number) {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const raw =
    typeof getAccessToken === "function" ? await getAccessToken() : null;
  const token = normalizeToken(raw);

  const url = `${base}/me/using/${musicId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: token ? "omit" : "include",
  });

  if (res.status === 204) return null;

  const txt = await res.text();
  if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
  if (!txt || !txt.trim()) return null;

  const json = JSON.parse(txt);
  return adaptMe(json, base);
}

/* ---------------- XRPL ---------------- */
export async function createXrplWallet() {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const res = await fetch(`${base}/xrpl/wallet`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json as { address: string; seed: string };
}

export async function convertRewards(params: {
  amount: number;
  destination?: string;
}) {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_BASE).replace(
    /\/+$/,
    ""
  );
  const res = await fetch(`${base}/me/rewards/convert`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json as {
    ok: boolean;
    destination: string;
    amount: number;
    xrpAmount: string;
    txHash: string;
  };
}
