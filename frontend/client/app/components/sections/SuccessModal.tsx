"use client";

import { useEffect } from "react";

type NoticeVariant = "success" | "error" | "info";
type NoticeMode = "modal" | "toast";

export default function SuccessModal({
  isOpen,
  message = "완료되었습니다.",
  autoCloseMs = 1500,
  onClose,
  variant = "success",
  mode = "modal",
  dismissible = true,
}: {
  isOpen: boolean;
  message?: string;
  autoCloseMs?: number;
  onClose?: () => void;
  variant?: NoticeVariant;
  mode?: NoticeMode;
  dismissible?: boolean;
}) {
  // 자동 닫기
  useEffect(() => {
    if (!isOpen) return;
    if (autoCloseMs > 0) {
      const t = setTimeout(() => onClose?.(), autoCloseMs);
      return () => clearTimeout(t);
    }
  }, [isOpen, autoCloseMs, onClose]);

  if (!isOpen) return null;

  const COLOR: Record<NoticeVariant, string> = {
    success: "bg-emerald-500",
    error: "bg-rose-500",
    info: "bg-sky-500",
  };

  /* ───────── Modal ───────── */
  if (mode === "modal") {
    return (
      <div
        className="fixed inset-0 z-[10000] grid place-items-center p-4"
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
      >
        {dismissible && (
          <button
            onClick={() => onClose?.()}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
        )}

        <div
          className="relative w-full max-w-sm rounded-2xl bg-white/95 px-6 py-6 text-center text-zinc-900 shadow-2xl ring-1 ring-black/5
                     dark:bg-zinc-900/95 dark:text-zinc-100 animate-[fadeIn_.2s_ease-out]"
        >
          <div
            className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full text-2xl font-bold text-white shadow-lg ${COLOR[variant]}`}
          >
            ✓
          </div>
          <p className="mt-1 mb-3 text-base font-semibold">{message}</p>
          <button
            onClick={() => onClose?.()}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-semibold text-white shadow hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${COLOR[variant]}`}
          >
            확인
          </button>
        </div>

        <style>{`
          @keyframes fadeIn {
            from {opacity:0; transform:scale(.95)}
            to {opacity:1; transform:scale(1)}
          }
        `}</style>
      </div>
    );
  }

  /* ───────── Toast ───────── */
  return (
    <div className="fixed top-5 right-5 z-[10000] animate-[slideIn_.3s_ease-out]">
      <div
        className={`flex items-center space-x-3 rounded-xl px-4 py-3 text-white shadow-lg ${COLOR[variant]}`}
      >
        <span className="text-lg font-bold">✓</span>
        <span className="font-medium">{message}</span>
      </div>

      <style>{`
        @keyframes slideIn {
          from {opacity:0; transform:translateX(100%)}
          to {opacity:1; transform:translateX(0)}
        }
      `}</style>
    </div>
  );
}
