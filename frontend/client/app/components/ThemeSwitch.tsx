"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SunMedium, MoonStar } from "lucide-react";

export function ThemeSwitch() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 항상 보이게: 강한 대비 + 명시적 색/테두리
  const btnClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl " +
    "border border-zinc-300 text-zinc-900 bg-white shadow-sm " +                 // 라이트
    "dark:border-white/25 dark:text-white dark:bg-white/10 dark:shadow-none " + // 다크
    "hover:bg-zinc-50 dark:hover:bg-white/15 transition";

  // SSR 단계에서는 고정 아이콘 보여주기 (불일치 방지)
  if (!mounted) {
    return (
      <button aria-label="toggle theme" className={btnClass}>
        <SunMedium size={16} />
      </button>
    );
  }

  const isDark = (theme ?? resolvedTheme) === "dark";
  return (
    <button
      aria-label="toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={btnClass}
    >
      {isDark ? <MoonStar size={16} /> : <SunMedium size={16} />}
    </button>
  );
}
