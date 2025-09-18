"use client";

import { useMemo, useState, useEffect } from "react";

export type Purchase = {
  id: string;
  date: string;
  item: string;
  amount: number;
  method?: string;
};

export type MileageDelta = {
  id: string;
  at: string;
  reason: string;
  delta: number;
};

type Plan = { name: string; price: number };

export default function SubscriptionModal({
  open,
  onClose,
  nextBillingAt = "2025-09-14 00:00",
  autoRenew = true,
  purchases = [],
  minusList = [],
  onCancel,
  onResume,
  mileageBalance = 0,
  plannedReward = 0,
  onChangePlannedReward,
  onApplyReward,
  onPurchase,
  onAfterPurchased,
  availablePlans = [
    { name: "Standard", price: 29000 },
    { name: "Business", price: 39000 },
  ],
  defaultPlan = "Business",
}: {
  open: boolean;
  onClose: () => void;
  nextBillingAt?: string;
  autoRenew?: boolean;
  purchases?: Purchase[];
  minusList?: MileageDelta[];
  onCancel?: () => void;
  onResume?: () => void;
  mileageBalance?: number;
  plannedReward?: number;
  onChangePlannedReward?: (value: number) => void;
  onApplyReward?: (value: number) => void;
  onPurchase?: (opts: { plan: string; useRewards: number }) => Promise<void> | void;
  onAfterPurchased?: () => void;
  availablePlans?: Plan[];
  defaultPlan?: string;
}) {
  const totalMinus = useMemo(
    () => minusList.reduce((s, m) => s + (m.delta || 0), 0),
    [minusList]
  );

  const [selectedPlan, setSelectedPlan] = useState<string>(defaultPlan);
  useEffect(() => setSelectedPlan(defaultPlan), [defaultPlan]);

  const currentPlan = useMemo(
    () => availablePlans.find(p => p.name === selectedPlan) ?? availablePlans[0],
    [availablePlans, selectedPlan]
  );

  const maxUse = Math.max(0, Math.floor(mileageBalance));
  const isControlled = typeof onChangePlannedReward === "function";
  const [localPlanned, setLocalPlanned] = useState<number>(clamp(plannedReward, 0, maxUse));
  useEffect(() => {
    if (isControlled) setLocalPlanned(clamp(plannedReward, 0, maxUse));
  }, [plannedReward, maxUse, isControlled]);
  const value = isControlled ? clamp(plannedReward, 0, maxUse) : localPlanned;

  const handleChange = (next: number) => {
    const v = clamp(Math.floor(next), 0, maxUse);
    if (isControlled) onChangePlannedReward?.(v);
    else setLocalPlanned(v);
  };

  const expectedCharge = Math.max(0, Math.floor((currentPlan?.price ?? 0) - value));

  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const handlePurchase = async () => {
    if (!onPurchase) return;
    try {
      setLoading(true);
      await onPurchase({ plan: selectedPlan, useRewards: value });
      setSuccessOpen(true);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        className="relative z-[1001] w-[92vw] sm:w-[90vw] max-w-[960px] max-h-[88dvh] overflow-auto rounded-2xl bg-white text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 p-4 sm:p-5"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold break-words">구독 정보</h2>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 break-words">
              자동갱신 {autoRenew ? "ON" : "OFF"} · 다음 결제 예정일 <b>{nextBillingAt}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="shrink-0 rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
            >
              닫기
            </button>
          </div>
        </header>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              구매 내역
            </div>
            <div className="max-h-[40vh] overflow-auto overflow-x-auto sm:rounded-none">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">일시</th>
                    <th className="px-3 py-2 text-left">항목</th>
                    <th className="px-3 py-2 text-right">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                  {purchases.length > 0 ? (
                    purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5">
                        <td className="px-3 py-2">{p.date}</td>
                        <td className="px-3 py-2">{p.item}</td>
                        <td className="px-3 py-2 text-right">{p.amount.toLocaleString()}원</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-400">
                        구매 내역이 없어요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 px-3 py-2">
              <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">마일리지 차감 목록</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">합계 {totalMinus}</div>
            </div>
            <div className="max-h-[40vh] overflow-auto overflow-x-auto sm:rounded-none">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">일시</th>
                    <th className="px-3 py-2 text-left">사유</th>
                    <th className="px-3 py-2 text-right">변동</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                  {minusList.length > 0 ? (
                    minusList.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5">
                        <td className="px-3 py-2">{m.at}</td>
                        <td className="px-3 py-2">{m.reason}</td>
                        <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">{m.delta}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-400">
                        차감 내역이 없어요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 dark:border-white/10 p-4">
            <div className="text-sm font-semibold mb-3">플랜 선택</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {availablePlans.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelectedPlan(p.name)}
                  className={[
                    "rounded-xl border p-4 text-left transition",
                    selectedPlan === p.name
                      ? "border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/40"
                      : "border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold">{p.name}</div>
                    <div className="text-sm">{p.price.toLocaleString()}원/월</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-white/10 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-zinc-600 dark:text-zinc-300">
                  다음 결제(<b>{nextBillingAt}</b>)에 사용할 리워드
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  보유 <b>{mileageBalance.toLocaleString()}원</b> · 최대 <b>{maxUse.toLocaleString()}원</b>
                  {!autoRenew && (
                    <span className="ml-2 inline-block rounded-md border border-amber-300/40 bg-amber-100/40 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-300/10 dark:text-amber-200">
                      자동갱신이 꺼져 있어요.
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">예상 청구 금액</div>
                <div className="text-base font-semibold">
                  {expectedCharge.toLocaleString()}원
                  <span className="ml-1 block sm:inline text-xs text-zinc-500 dark:text-zinc-400">
                    (기준가 {(currentPlan?.price ?? 0).toLocaleString()} − 리워드 {value.toLocaleString()})
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="range"
                min={0}
                max={maxUse}
                step={10}
                value={value}
                onChange={(e) => handleChange(Number(e.target.value))}
                className="w-full h-6"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={maxUse}
                  step={10}
                  value={value}
                  onChange={(e) => handleChange(Number(e.target.value))}
                  className="w-40 rounded-md border border-zinc-300 px-2 py-2 text-base sm:text-sm text-right dark:border-white/10 dark:bg-white/5"
                  inputMode="numeric"
                />
                <span className="text-sm text-zinc-600 dark:text-zinc-300">원</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onApplyReward?.(value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                사용값 적용
              </button>
              <button
                onClick={() => handleChange(0)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                0원
              </button>
              <button
                onClick={handlePurchase}
                disabled={loading}
                className="ml-auto rounded-md bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "결제 중..." : `${selectedPlan} 결제하기`}
              </button>
            </div>
          </section>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 dark:border-white/10 p-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            현재 구독: <b>{selectedPlan}</b> · 자동갱신 {autoRenew ? "ON" : "OFF"} · 다음 결제일 <b>{nextBillingAt}</b>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {autoRenew ? (
              <button
                onClick={onCancel}
                className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                구독 취소
              </button>
            ) : (
              <button
                onClick={onResume}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                자동갱신 재개
              </button>
            )}
          </div>
        </div>
      </section>

      {successOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-[1101] rounded-xl bg-white dark:bg-zinc-900 p-6 shadow-xl max-w-sm w-[90%]">
            <h3 className="text-lg font-semibold mb-2">결제 완료</h3>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {selectedPlan} 구독권 결제가 완료되었습니다.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSuccessOpen(false);
                  onAfterPurchased?.();
                }}
                className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
