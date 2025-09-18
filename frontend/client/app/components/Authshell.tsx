"use client";
import { PropsWithChildren } from "react";

export default function AuthShell({ children }: PropsWithChildren) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-white">
      <div className="relative w-[min(920px,92vw)] h-[520px] rounded-2xl bg-black/30 shadow-[0_10px_40px_rgba(0,0,0,.45)] overflow-hidden">
        {/* 배경 장식 */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute right-10 top-28 h-56 w-56 rounded-full bg-white/4 blur-2xl" />
          <div className="absolute right-24 bottom-16 h-40 w-40 rounded-full bg-white/3 blur-xl" />
        </div>

        {/* 로고 */}
        <div className="absolute left-1/2 top-[22%] -translate-x-1/2">
          <div className="logo">gratafy</div>
        </div>

        {/* 중앙 카드 */}
        <div className="absolute left-1/2 top-1/2 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-soft-plate p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
