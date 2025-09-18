// HeroVideo.tsx
"use client";
import { useEffect, useRef } from "react";

export default function HeroVideo() {
  const vidRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const tryPlay = () => v.play().catch(() => {});
    const onVisibility = () => (document.hidden ? v.pause() : tryPlay());
    document.addEventListener("visibilitychange", onVisibility);
    tryPlay();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <section className="relative z-0 w-full overflow-hidden bg-black min-h-[520px] sm:min-h-[600px] lg:min-h-[650px] h-[65svh] sm:h-[72svh] md:h-[86svh]">
      <video
        key="/videos/blockchain.mp4"
        ref={vidRef}
        className="absolute inset-0 z-0 h-full w-full object-cover"
        src="/videos/blockchain.mp4"
        poster="/images/hero-poster.jpg"
        autoPlay
        muted
        playsInline
        loop
        preload="metadata"
      />
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />
      <div className="pointer-events-none absolute inset-0 z-10 [background:radial-gradient(80%_60%_at_50%_30%,transparent,rgba(0,0,0,0.35))]" />
      <div className="relative z-20 mx-auto flex h-full max-w-6xl flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-sm font-medium text-teal-300/90">
          블록체인 B2B 저작권 · 스트리밍 · 구독 · 리워드 보상
        </p>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-6xl">
          저작권 걱정없이 쓰는 <span className="text-teal-300">기업용 음악</span> 플랫폼
        </h1>
        <p className="mt-4 max-w-2xl text-white/85">
          구독권 사면 모든음악 사용가능 · 스트리밍 트래킹 · 코인 보상 자동 적립
        </p>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-white/70">▼</div>
      </div>
    </section>
  );
}
