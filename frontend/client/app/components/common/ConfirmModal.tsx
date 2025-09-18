// app/components/common/ConfirmModal.tsx
"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";

type ConfirmModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmModal({
  isOpen,
  title = "확인",
  description = "계속 진행하시겠어요?",
  confirmText = "확인",
  cancelText = "취소",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      aria-modal
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[2001] w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{description}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/10"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className={`h-9 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50 ${
              danger
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
