"use client";

import { useMemo, useState } from "react";
import { resolveImageUrl } from "@/app/utils/resolveImageUrl"

export type UsingTrackApi = {
  id: number | string;
  title: string;
  cover?: string;
  artist?: string;
  category?: string;
  leadersEarned?: number; // 평생 누적(백엔드 lifetimeExtracted)
  lastUsedAt?: string;
  startedAt?: string;

  monthlyRewards?: number[];
  monthReward?: number;
  rewardTotal?: number;
  rewardUsed?: number;
  remainingReward?: number;

  monthBudget?: number;
  monthSpent?: number;      
  monthRemaining?: number;

  daily?: { date: string; amount: number }[];

  playEndpoint?: string;   // 예: /music/{id}/play
  lyricsEndpoint?: string; // 예: /lyric/{id}/download
};

export default function UsingRow({
  t,
  USING_API,
  openUsage,
  onRemove,
}: {
  t: UsingTrackApi;
  USING_API: string;
  openUsage: (t: UsingTrackApi) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);

  // === 계산 helpers ===
  // 1) 일 단가(폴백): monthReward → monthlyRewards 마지막 값/30 → 0
  const dailyBase = useMemo(() => {
    if (typeof t.monthReward === "number") return t.monthReward;
    const lastMonthly = t.monthlyRewards?.[t.monthlyRewards.length - 1] ?? 0;
    return Math.round((Number(lastMonthly) || 0) / 30);
  }, [t.monthReward, t.monthlyRewards]);

  // 2) 월 총 리워드(우선순위: 실데이터 monthBudget → 직접 지정 rewardTotal → 추정)
  const rewardTotal = useMemo(() => {
    if (typeof t.monthBudget === "number") return Math.max(0, t.monthBudget);
    if (typeof t.rewardTotal === "number") return Math.max(0, t.rewardTotal);
    if (typeof t.monthReward === "number") return Math.max(0, Math.round(t.monthReward * 30));
    return Math.max(0, Math.round(dailyBase * 30));
  }, [t.monthBudget, t.rewardTotal, t.monthReward, dailyBase]);

  // 3) 월 사용(우선순위: 실데이터 monthSpent → 직접 지정 rewardUsed → 추정 70%)
  const rewardUsed = useMemo(() => {
    if (typeof t.monthSpent === "number") return Math.max(0, t.monthSpent);
    if (typeof t.rewardUsed === "number") return Math.max(0, t.rewardUsed);
    return Math.round(rewardTotal * 0.7);
  }, [t.monthSpent, t.rewardUsed, rewardTotal]);

  // 4) 월 잔여(우선순위: 실데이터 monthRemaining → 직접 지정 remainingReward → 계산)
  const rewardRemaining = useMemo(() => {
    if (typeof t.monthRemaining === "number") return Math.max(0, t.monthRemaining);
    if (typeof t.remainingReward === "number") return Math.max(0, t.remainingReward);
    return Math.max(rewardTotal - rewardUsed, 0);
  }, [t.monthRemaining, t.remainingReward, rewardTotal, rewardUsed]);

  const monthlyEarned = useMemo(
    () => Number(t.monthSpent ?? Math.max(0, (rewardTotal || 0) - (rewardRemaining || 0))),
    [t.monthSpent, rewardTotal, rewardRemaining]
  );

  const usedPct = rewardTotal > 0 ? Math.min(Math.round((rewardUsed / rewardTotal) * 100), 100) : 0;

  const trackEndpoint = t.playEndpoint ?? `${USING_API}/${t.id}/play`;
  // const lyricsEndpoint = t.lyricsEndpoint ?? `${USING_API}/${t.id}/lyrics`;

  const recent = useMemo(() => {
    if (Array.isArray(t.daily) && t.daily.length) {
      // label 포매팅
      return t.daily.map(({ date, amount }) => {
        const d = new Date(date);
        const label = isNaN(d.getTime())
          ? date
          : d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
        return { label, amount: Math.max(0, Number(amount) || 0) };
      });
    }
    const days = 7;
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
      return { label, amount: Math.max(0, dailyBase) };
    });
  }, [t.daily, dailyBase]);

  return (
    <div className="group">
      {/* 아코디언 헤더 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-white/5"
      >
            <img
              src={resolveImageUrl(t.cover, "music")}
              alt={t.title}
              className="h-12 w-12 flex-shrink-0 rounded object-cover"
            />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{t.title}</div>
          <div className="mt-0.5 line-clamp-1 text-[12px] text-zinc-500 dark:text-zinc-400">
            {t.artist ?? "Various"} · {t.category ?? "카테고리 미지정"}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-600 dark:text-amber-400">
            남은 리워드 {rewardRemaining.toLocaleString()}
          </span>

          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-600 dark:text-emerald-400">
            +{monthlyEarned.toLocaleString()} 이번 달 누적
          </span>

          {/* (선택) 총 누적 */}
          {/* {typeof t.leadersEarned === "number" && (
            <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2 py-1 font-medium text-zinc-600 dark:text-zinc-300">
              총 누적 {t.leadersEarned.toLocaleString()}
            </span>
          )} */}

          {(t.lastUsedAt ?? "").length > 0 && (
            <span className="hidden md:inline text-zinc-500 dark:text-zinc-400">최근 사용: {t.lastUsedAt}</span>
          )}
        </div>

        <svg
          className={`h-5 w-5 flex-shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 아코디언 본문 */}
      {open && (
        <div className="px-4 pb-4">
          {/* 엔드포인트 안내 */}
          <div className="flex flex-wrap gap-2">
            <span className="sm:ml-2 inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-mono text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              음원 EndPoint: GET&nbsp;{trackEndpoint}
            </span>
            {/* <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-mono text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              가사 EndPoint: GET&nbsp;{lyricsEndpoint}
            </span> */}
          </div>

          {/* 상단 요약 4칸 */}
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <InfoCell label="사용 시작일" value={t.startedAt ?? "-"} />
            <InfoCell
              label="월 총 리워드"
              value={`+${rewardTotal.toLocaleString()}`}
              badgeClass="text-emerald-600 dark:text-emerald-400"
            />
            <InfoCell label="최근 사용" value={t.lastUsedAt ?? "-"} />
            <InfoCell
              label="남은 리워드"
              value={rewardRemaining.toLocaleString()}
              badgeClass="text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* (선택) 이번 달 누적 별도 표기 */}
          <div className="mt-3">
            <InfoCell
              label="이번 달 누적"
              value={`+${monthlyEarned.toLocaleString()}`}
              badgeClass="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          {/* 진행바 */}
          {rewardTotal > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>리워드 사용량</span>
                <span>{usedPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-500/70 dark:bg-emerald-400/70 transition-[width]"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>총 {rewardTotal.toLocaleString()}</span>
                <span>사용 {rewardUsed.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* 액션 */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openUsage(t)}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800
                         dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              사용 기록 보기
            </button>
            {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100
                         dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              사용중인 목록에서 삭제
            </button>
          )}
          </div>

          {/* 최근 7일 — 금액 리스트 */}
          <div className="mt-3 rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:text-zinc-400">
              최근 7일 리워드
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-white/10">
              {recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{r.label}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{r.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value, badgeClass }: { label: string; value: string | number; badgeClass?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
      <div className="text-[12px] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-0.5 font-semibold text-zinc-900 dark:text-white ${badgeClass ?? ""}`}>{value}</div>
    </div>
  );
}
