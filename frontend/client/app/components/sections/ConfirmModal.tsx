"use client";

import React, { useEffect } from "react";

export default function ConfirmModal({
  open,
  title = "확인",
  message = "이 작업을 진행하시겠습니까?",
  confirmText = "확인",
  cancelText = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10050] grid place-items-center p-4" role="dialog" aria-modal="true">
      <button
        aria-label="닫기"
        onClick={() => onCancel?.()}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="h-10 rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => onConfirm?.()}
            className={`h-10 rounded-md px-4 text-sm font-semibold text-white hover:opacity-95 ${
              danger ? "bg-rose-600" : "bg-zinc-900 dark:bg-white dark:text-zinc-900"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
