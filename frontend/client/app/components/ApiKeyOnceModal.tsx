"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function copyToClipboard(text: string) {
  if (!text) return Promise.resolve();
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

export default function ApiKeyOnceModal() {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // 쿼리 showKey=1 일 때, 세션에서 API 키 꺼냄
  useEffect(() => {
    const shouldShow = sp.get("showKey") === "1";
    if (!shouldShow) return;

    const key = sessionStorage.getItem("one_time_api_key") || "";
    if (key) {
      setApiKey(key);
      setOpen(true);
    } else {
      // 키가 없으면 쿼리만 제거
      const qs = new URLSearchParams(sp.toString());
      qs.delete("showKey");
      router.replace(`/login${qs.toString() ? "?" + qs.toString() : ""}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hideAndClean = () => {
    setOpen(false);
    // 한 번만 노출되도록 세션에서 제거
    sessionStorage.removeItem("one_time_api_key");
    // URL 쿼리 정리
    const qs = new URLSearchParams(sp.toString());
    qs.delete("showKey");
    router.replace(`/login${qs.toString() ? "?" + qs.toString() : ""}`);
  };

  const handleCopy = async () => {
    await copyToClipboard(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Dimmer (닫기 비활성: 반드시 확인을 누르게) */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Panel */}
      <section
        role="dialog"
        aria-modal="true"
        className="
          relative z-[1001] w-[min(560px,92vw)] rounded-2xl
          bg-white text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-white
          border border-zinc-200 dark:border-white/10
          p-5
        "
      >
        <h2 className="text-lg font-semibold">API 키가 발급되었습니다</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          아래 키는 보안상 <b>지금 한 번만</b> 표시됩니다. 안전한 곳에 보관하세요.
        </p>

        <div className="mt-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">API Key</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-sm">
              {visible ? apiKey : "•".repeat(Math.max(apiKey.length, 8))}
            </code>
            <button
              onClick={() => setVisible((v) => !v)}
              className="h-8 rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              {visible ? "숨기기" : "보기"}
            </button>
            <button
              onClick={handleCopy}
              className="h-8 rounded-md bg-zinc-900 text-white px-3 text-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          • 키를 분실하면 재발급이 필요합니다. <br />
          • 다른 사람과 공유하지 마세요.
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={hideAndClean}
            className="h-10 rounded-md bg-zinc-900 text-white px-4 text-sm font-medium hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            확인
          </button>
        </div>
      </section>
    </div>
  );
}
