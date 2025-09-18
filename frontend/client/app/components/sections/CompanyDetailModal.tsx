"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/******************** Types ********************/
export type Company = {
  id: string;
  name: string;
  tier: string;
  totalTokens: number;
  monthlyEarned: number;
  monthlyUsed: number;
  usageRate: number; // 0~100
  activeTracks: number;
  status: "active" | "inactive" | "suspended";
  lastActivity: string; // e.g., "2025-08-19 14:22"
  joinedDate: string; // e.g., "2024-12-01"
  contactEmail: string;
  contactPhone: string;
  subscriptionStart: string;
  subscriptionEnd: string;
  monthlyUsage: number[]; // length 12
  monthlyRewards: number[]; // length 12
  topTracks: Array<{ title: string; usage: number; category: string }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  company: Company | null;
};

/******************** Utilities ********************/
function cx(...cls: (string | false | undefined | null)[]) {
  return cls.filter(Boolean).join(" ");
}

/******************** Lightweight Line Chart (SVG) ********************/
function SimpleLineChart({
  labels,
  series,
  colors = [],
  strokeWidth = 2,
}: {
  labels: string[];
  series: { label: string; data: number[] }[];
  colors?: string[];
  strokeWidth?: number;
}) {
  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 24, bottom: 28, left: 40 };

  const all = series.flatMap((s) => s.data);
  const maxY = Math.max(1, Math.max(...all));
  const minY = Math.min(0, Math.min(...all));

  const xStep =
    (width - padding.left - padding.right) / Math.max(1, labels.length - 1);
  const yScale = (v: number) =>
    height -
    padding.bottom -
    ((v - minY) / (maxY - minY || 1)) * (height - padding.top - padding.bottom);
  const xScale = (i: number) => padding.left + i * xStep;

  const paths = series.map((s, sIdx) => {
    const d = s.data
      .map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(v)}`)
      .join(" ");
    const color = colors[sIdx] || `hsl(${(sIdx * 70) % 360} 70% 55%)`;
    return (
      <path
        key={s.label}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    );
  });

  const yTicks = 4;
  const tickValues = Array.from(
    { length: yTicks + 1 },
    (_, i) => minY + ((maxY - minY) * i) / yTicks
  );

  return (
    <div className="h-full w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          className="fill-transparent"
        />
        {tickValues.map((tv, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(tv)}
              y2={yScale(tv)}
              className="stroke-zinc-200/80 dark:stroke-white/10"
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={yScale(tv)}
              textAnchor="end"
              alignmentBaseline="middle"
              fontSize={10}
              className="fill-zinc-500 dark:fill-white/60"
            >
              {Math.round(tv).toLocaleString()}
            </text>
          </g>
        ))}
        {labels.map((lb, i) => (
          <text
            key={lb + i}
            x={xScale(i)}
            y={height - padding.bottom + 16}
            textAnchor="middle"
            fontSize={10}
            className="fill-zinc-500 dark:fill-white/60"
          >
            {lb}
          </text>
        ))}
        {paths}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s, i) => (
          <div
            key={s.label}
            className="flex items-center gap-2 text-xs text-zinc-600 dark:text-white/70"
          >
            <span
              className="inline-block h-2 w-2 rounded"
              style={{
                background: colors[i] || `hsl(${(i * 70) % 360} 70% 55%)`,
              }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/******************** Company Detail Modal (Portal + Light/Dark) ********************/
export default function CompanyDetailModal({ open, onClose, company }: Props) {
  const [activeTab, setActiveTab] =
    useState<"info" | "usage" | "rewards">("info");
  const [mounted, setMounted] = useState(false);

  // Portal mount target (CSR only)
  useEffect(() => setMounted(true), []);

  // ESC close + prevent background scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !company || !mounted) return null;

  const months = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Business":
        return "from-fuchsia-500/10 to-fuchsia-600/10 text-fuchsia-600 border-fuchsia-400/25 dark:text-fuchsia-300";
      case "Standard":
        return "from-blue-500/10 to-blue-600/10 text-blue-600 border-blue-400/25 dark:text-blue-300";
      case "Free":
        return "from-zinc-400/15 to-zinc-500/15 text-zinc-700 border-zinc-400/25 dark:text-zinc-300";
      default:
        return "from-teal-400/15 to-blue-400/15 text-teal-700 border-teal-400/25 dark:text-teal-300";
    }
  };

  const getStatusColor = (status: Company["status"]) => {
    switch (status) {
      case "active":
        return "bg-emerald-500";
      case "inactive":
        return "bg-zinc-400";
      case "suspended":
        return "bg-rose-500";
      default:
        return "bg-zinc-400";
    }
  };

  return createPortal(
    <>
      {/* Custom scrollbar (both themes) */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.04);
          border-radius: 4px;
        }
        :global(.dark) .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        :global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>

      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 dark:bg-black/50 backdrop-blur-sm"
        role="dialog"
        aria-modal
      >
        <div className="w-full max-w-6xl h-[90vh] flex flex-col rounded-2xl border shadow-2xl bg-white/95 border-zinc-200 backdrop-blur-md dark:bg-neutral-900 dark:border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-white/10">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
              {company.name} 상세 정보
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent transition-all dark:text-white/70 dark:hover:bg-white/10"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-zinc-200 dark:border-white/10">
            {[
              { id: "info", label: "기업 기본 정보" },
              { id: "usage", label: "음원 사용 현황" },
              { id: "rewards", label: "리워드 현황" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cx(
                  "px-6 py-4 text-sm font-medium border-b-2 transition-all",
                  activeTab === (tab.id as any)
                    ? "text-teal-600 border-teal-500 dark:text-teal-400 dark:border-teal-400"
                    : "text-zinc-600 border-transparent hover:text-zinc-900 hover:border-zinc-200 dark:text-white/60 dark:hover:text-white/80 dark:hover:border-white/20"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {/* Info */}
            {activeTab === "info" && (
              <div className="space-y-6">
                {/* Overview */}
                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    기업 개요
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Row label="기업명" value={company.name} />
                      <div className="flex items-center justify-between py-2.5 border-b border-zinc-200 dark:border-white/10">
                        <span className="text-sm text-zinc-600 dark:text-white/60">
                          등급
                        </span>
                        <span
                          className={cx(
                            "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r border",
                            getTierColor(company.tier)
                          )}
                        >
                          {company.tier}
                        </span>
                      </div>
                      <Row label="가입일" value={company.joinedDate} />
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-sm text-zinc-600 dark:text-white/60">
                          상태
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cx(
                              "w-3 h-3 rounded-full",
                              getStatusColor(company.status)
                            )}
                          />
                          <span className="text-zinc-900 dark:text-white">
                            {company.status === "active"
                              ? "활성"
                              : company.status === "inactive"
                              ? "비활성"
                              : "정지"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Row label="이메일" value={company.contactEmail} />
                      <Row label="전화번호" value={company.contactPhone} />
                      <Row label="구독 시작일" value={company.subscriptionStart} />
                      <Row
                        label="구독 종료일"
                        value={company.subscriptionEnd}
                        noBorder
                      />
                    </div>
                  </div>
                </div>

                {/* KPIs */}
                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    핵심 지표
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPI
                      label="보유 토큰"
                      hint="현재 잔액"
                      value={company.totalTokens}
                      valueClass="text-teal-600 dark:text-teal-400"
                    />
                    <KPI
                      label="이번 달 적립"
                      hint="신규 적립"
                      value={company.monthlyEarned}
                      prefix="+"
                      valueClass="text-teal-600 dark:text-teal-400"
                    />
                    <KPI
                      label="이번 달 사용"
                      hint="소모량"
                      value={company.monthlyUsed}
                      valueClass="text-teal-600 dark:text-teal-400"
                    />
                    <KPI
                      label="활성 음원"
                      hint="사용 중"
                      value={company.activeTracks}
                      valueClass="text-teal-600 dark:text-teal-400"
                    />
                  </div>
                </div>

                {/* Usage & Activity */}
                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    사용률 및 활동 현황
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600 dark:text-white/60">
                          토큰 사용률
                        </span>
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {company.usageRate}%
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2 bg-zinc-200 dark:bg-white/10">
                        <div
                          className="h-2 rounded-full transition-all bg-gradient-to-r from-teal-500 to-blue-500"
                          style={{ width: `${company.usageRate}%` }}
                        />
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-white/50">
                        월 한도 대비 {company.usageRate}% 사용 중
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-600 dark:text-white/60">
                          최근 활동
                        </span>
                        <span className="text-zinc-900 dark:text-white">
                          {company.lastActivity}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Usage */}
            {activeTab === "usage" && (
              <div className="space-y-6">
                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    월별 API 사용량
                  </h3>
                  <div className="h-64">
                    <SimpleLineChart
                      labels={months}
                      series={[
                        { label: "현재 기업", data: company.monthlyUsage },
                        {
                          label: "업계 평균",
                          data: [
                            1200, 1350, 1100, 1400, 1600, 1800, 2000, 1900, 2100,
                            1950, 2200, 2400,
                          ],
                        },
                      ]}
                      colors={["#14b8a6", "#9ca3af"]}
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-3 text-zinc-900 dark:text-white">
                      <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                      전체 음원 사용 현황
                    </h3>
                    <select className="px-3 py-2 rounded-lg text-sm border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-white/10 dark:bg-white/5 dark:text-white">
                      <option value="all">전체 기간</option>
                      {months.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left">
                        <tr className="border-b border-zinc-200 dark:border-white/10">
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            순위
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            음원명
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            카테고리
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            사용 횟수
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            사용률
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            최근 사용
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {company.topTracks.map((track, index) => {
                          const maxUsage = Math.max(
                            ...company.topTracks.map((t) => t.usage),
                            1
                          );
                          const usagePercentage = Math.round(
                            (track.usage / maxUsage) * 100
                          );
                          return (
                            <tr
                              key={track.title}
                              className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <span
                                  className={cx(
                                    "text-sm font-bold",
                                    index < 3
                                      ? "text-teal-600 dark:text-teal-400"
                                      : "text-zinc-900 dark:text-white"
                                  )}
                                >
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                                {track.title}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border border-zinc-200 bg-white text-zinc-700 dark:bg-white/10 dark:text-white/80 dark:border-white/20">
                                  {track.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">
                                {track.usage.toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 rounded-full h-2 bg-zinc-200 dark:bg-white/10">
                                    <div
                                      className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-blue-500"
                                      style={{ width: `${usagePercentage}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-zinc-600 dark:text-white/70">
                                    {usagePercentage}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-500 dark:text-white/60">
                                {new Date().toLocaleDateString("ko-KR")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Rewards */}
            {activeTab === "rewards" && (
              <div className="space-y-6">
                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    월별 리워드 적립
                  </h3>
                  <div className="h-64">
                    <SimpleLineChart
                      labels={months}
                      series={[
                        { label: "현재 기업", data: company.monthlyRewards },
                        {
                          label: "업계 평균",
                          data: [
                            8000, 9500, 11000, 12500, 14000, 15500, 17000, 16500,
                            18000, 17500, 19000, 20500,
                          ],
                        },
                      ]}
                      colors={["#14b8a6", "#9ca3af"]}
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    월별 리워드 상세 현황
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left">
                        <tr className="border-b border-zinc-200 dark:border-white/10">
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            월
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            총 적립
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            월별 적립
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            구독제 할인 사용
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            남은 리워드
                          </th>
                          <th className="px-4 py-3 font-medium text-zinc-700 dark:text-white/80">
                            누적 잔액
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((month, index) => {
                          const monthlyReward = company.monthlyRewards[index] ?? 0;
                          const subscriptionDiscount = Math.floor(
                            monthlyReward * 0.3
                          );
                          const remainingReward =
                            monthlyReward - subscriptionDiscount;
                          const cumulativeBalance = company.monthlyRewards
                            .slice(0, index + 1)
                            .reduce((sum, reward) => sum + reward, 0);

                          return (
                            <tr
                              key={month}
                              className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                                {month}
                              </td>
                              <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">
                                {monthlyReward.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-zinc-700 dark:text-white/80">
                                +{monthlyReward.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-amber-600 dark:text-orange-400">
                                -{subscriptionDiscount.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-zinc-700 dark:text-white/80">
                                {remainingReward.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 font-medium text-teal-700 dark:text-teal-400">
                                {cumulativeBalance.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border p-6 border-zinc-200 bg-white/80 dark:bg-transparent dark:border-white/10">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
                    <span className="w-1.5 h-6 rounded-full bg-teal-500" />
                    연간 리워드 요약
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <KPI
                      label="총 적립 리워드"
                      value={sum(company.monthlyRewards)}
                      valueClass="text-teal-700 dark:text-teal-400"
                    />
                    <KPI
                      label="총 할인 사용"
                      value={sum(
                        company.monthlyRewards.map((r) => Math.floor(r * 0.3))
                      )}
                      valueClass="text-amber-600 dark:text-orange-400"
                    />
                    <KPI
                      label="총 남은 리워드"
                      value={sum(
                        company.monthlyRewards.map((r) => r - Math.floor(r * 0.3))
                      )}
                      valueClass="text-zinc-900 dark:text-white"
                    />
                    <KPI
                      label="월 평균 적립"
                      value={Math.round(sum(company.monthlyRewards) / 12)}
                      valueClass="text-teal-700 dark:text-teal-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/******************** Small UI bits ********************/
function Row({
  label,
  value,
  noBorder,
}: {
  label: string;
  value: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-center justify-between py-2.5",
        !noBorder && "border-b border-zinc-200 dark:border-white/10"
      )}
    >
      <span className="text-sm text-zinc-600 dark:text-white/60">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-white">{value}</span>
    </div>
  );
}

function KPI({
  label,
  hint,
  value,
  prefix = "",
  valueClass = "",
}: {
  label: string;
  hint?: string;
  value: number;
  prefix?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-center p-4 rounded-lg border border-zinc-200 bg-white/70 dark:bg-transparent dark:border-white/10">
      <div className={cx("text-2xl font-bold mb-1", valueClass)}>
        {prefix}
        {Number(value).toLocaleString()}
      </div>
      <div className="text-sm text-zinc-700 dark:text-white/80">{label}</div>
      {hint && (
        <div className="mt-1 text-xs text-zinc-500 dark:text-white/50">
          {hint}
        </div>
      )}
    </div>
  );
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

/******************** Demo (Optional) ********************/
export function CompanyDetailModalDemo() {
  const [open, setOpen] = useState(true);
  const mock: Company = {
    id: "c1",
    name: "구이김 뮤직스",
    tier: "Business",
    totalTokens: 321000,
    monthlyEarned: 18320,
    monthlyUsed: 12540,
    usageRate: 68,
    activeTracks: 42,
    status: "active",
    lastActivity: "2025-08-19 14:22",
    joinedDate: "2024-12-01",
    contactEmail: "biz@gkim-music.com",
    contactPhone: "02-1234-5678",
    subscriptionStart: "2025-01-01",
    subscriptionEnd: "2025-12-31",
    monthlyUsage: [900, 1100, 980, 1300, 1500, 1750, 2100, 2050, 2200, 2000, 2300, 2500],
    monthlyRewards: [8000, 9000, 10000, 11000, 12000, 15000, 16000, 17000, 16500, 17500, 19000, 21000],
    topTracks: [
      { title: "Midnight Drive", usage: 5420, category: "EDM" },
      { title: "Ocean Breeze", usage: 4980, category: "Pop" },
      { title: "City Lights", usage: 4310, category: "Hip-Hop" },
      { title: "Soft Rain", usage: 2860, category: "발라드" },
      { title: "Sunset Chill", usage: 2650, category: "R&B" },
    ],
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-6 dark:bg-neutral-950 dark:text-white">
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-500"
      >
        Open CompanyDetailModal
      </button>
      <CompanyDetailModal
        open={open}
        onClose={() => setOpen(false)}
        company={mock}
      />
    </div>
  );
}
