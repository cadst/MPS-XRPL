"use client";

import { useMemo } from "react";
import type { MePlaysResponse } from "@/lib/types/me";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  trackId: number | string | null;

  data: MePlaysResponse | null;
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  refresh: () => void | Promise<void>;
};

export default function UsageLogModal({
  isOpen,
  onClose,
  title,
  trackId,
  data,
  loading,
  error,
  page,
  setPage,
  totalPages,
  refresh,
}: Props) {
  if (!isOpen) return null;

  const safeTotalPages = useMemo(() => {
    if (!data) return 1;
    const lim = data.limit || 20;
    return Math.max(1, Math.ceil((data.total || 0) / lim));
  }, [data]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-[1001] w-[min(720px,96vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title ?? "사용 기록"} {trackId != null ? `#${trackId}` : ""}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            닫기
          </button>
        </div>

        {loading && <div className="py-8 text-center text-zinc-500">불러오는 중…</div>}
        {!!error && !loading && <div className="py-4 text-center text-red-600">{error}</div>}

        {data && !loading && !error && (
          <>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  <tr>
                    <th className="px-3 py-2 text-left">재생 시각</th>
                    <th className="px-3 py-2 text-left">유효</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-left">리워드ID</th>
                    <th className="px-3 py-2 text-left">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.playId} className="border-t border-zinc-200 dark:border-white/10">
                      <td className="px-3 py-2">{it.playedAt}</td>
                      <td className="px-3 py-2">{it.isValid ? "유효" : "무효"}</td>
                      <td className="px-3 py-2 text-right">{it.amount ?? 0}</td>
                      <td className="px-3 py-2">{it.rewardId ?? "-"}</td>
                      <td className="px-3 py-2">{it.status ?? "-"}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-zinc-500" colSpan={5}>
                        기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="text-zinc-500 dark:text-zinc-400">
                총 {data.total}개 / 페이지 {page} / {safeTotalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/10"
                >
                  이전
                </button>
                <button
                  disabled={page >= safeTotalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-sm disabled:opacity-50 dark:border-white/10"
                >
                  다음
                </button>
                <button
                  onClick={refresh}
                  className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  새로고침
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
