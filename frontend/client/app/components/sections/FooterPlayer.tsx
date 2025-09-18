// app/components/sections/FooterPlayer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuPlay, LuPause, LuSkipBack, LuSkipForward, LuVolume2, LuListPlus
} from "react-icons/lu";
import { resolveFileUrl } from "@/app/utils/resolveFileUrl";
import { resolveImageUrl } from "@/app/utils/resolveImageUrl";

export type Track = {
  id: number | string;
  title: string;
  artist: string;
  cover?: string;   // 이미지 경로(상대/절대) → resolveImageUrl로 보정
  src?: string;     // 오디오 경로(상대/절대) → resolveFileUrl로 보정
  duration?: number;
};

type PlayEventDetail = Track & { autoPlay?: boolean };

export default function FooterPlayer({
  track,
  onSubscribe,
  onAddToPlaylist,
  onPrev,
  onNext,
  autoPlay,
  onAutoPlayConsumed,
  onOpenPickModal,
  onClose,
}: {
  track: Track | null | undefined;
  onSubscribe?: (trackId: Track["id"]) => void;
  onAddToPlaylist?: (trackId: Track["id"]) => void;
  onPrev?: () => void;
  onNext?: () => void;
  autoPlay?: boolean;
  onAutoPlayConsumed?: () => void;
  onOpenPickModal?: () => void;
  onClose?: () => void;
}) {
  const [localTrack, setLocalTrack] = useState<Track | null>(null);
  const [localAutoPlay, setLocalAutoPlay] = useState(false);

  useEffect(() => {
    const onPlayEvent = (e: Event) => {
      const detail = (e as CustomEvent<PlayEventDetail>).detail;
      if (!detail?.src) return;

      const resolved = resolveFileUrl(detail.src, "music");

      setLocalTrack({
        id: detail.id,
        title: detail.title,
        artist: detail.artist,
        cover: detail.cover,
        src: resolved,
        duration: detail.duration,
      });
      setLocalAutoPlay(true);

      const el = audioRef.current;
      if (!el) return;

      el.src = resolved;

      const tryPlay = () =>
        el.play()
          .then(() => setPlaying(true))
          .catch((err) => {
            if (err?.name === "NotAllowedError") {
              el.muted = true;
              el.play()
                .then(() => {
                  setPlaying(true);
                  const unmute = () => { el.muted = false; el.removeEventListener("canplay", unmute); };
                  el.addEventListener("canplay", unmute);
                })
                .catch(() => setPlaying(false));
            } else {
              setPlaying(false);
            }
          });

      if (el.readyState >= 3) {
        tryPlay();
      } else {
        const onCanPlay = () => { el.removeEventListener("canplay", onCanPlay); tryPlay(); };
        el.addEventListener("canplay", onCanPlay);
      }
    };

    window.addEventListener("app:player:play", onPlayEvent as EventListener);
    return () => window.removeEventListener("app:player:play", onPlayEvent as EventListener);
  }, []);

  const effTrack = localTrack ?? track ?? null;

  const audioSrc = useMemo(
    () => resolveFileUrl(effTrack?.src ?? "", "music"),
    [effTrack?.src]
  );
  const coverSrc = useMemo(
    () => (effTrack?.cover ? resolveImageUrl(effTrack.cover, "music") : ""),
    [effTrack?.cover]
  );

  const effAutoPlay = Boolean(autoPlay || localAutoPlay);
  const hasTrack = !!effTrack;
  const hasSrc = !!audioSrc;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(effTrack?.duration ?? 0);
  const [volume, setVolume] = useState(0.9);

  useEffect(() => {
    setCurrent(0);
    setDuration(effTrack?.duration ?? 0);
  }, [effTrack?.id, audioSrc]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasSrc) return;

    const onLoaded = () => setDuration(el.duration || effTrack?.duration || 0);
    const onTime = () => setCurrent(el.currentTime || 0);
    const onEnded = () => setPlaying(false);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.volume = volume;

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [hasSrc, audioSrc, volume, effTrack?.duration]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !hasSrc) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  useEffect(() => {
    if (!effAutoPlay) return;
    const el = audioRef.current;
    if (!el || !hasSrc) {
      onAutoPlayConsumed?.();
      setLocalAutoPlay(false);
      return;
    }
    el.play()
      .then(() => {
        setPlaying(true);
        onAutoPlayConsumed?.();
        setLocalAutoPlay(false);
      })
      .catch(() => {
        onAutoPlayConsumed?.();
        setLocalAutoPlay(false);
      });
  }, [effAutoPlay, hasSrc, audioSrc, onAutoPlayConsumed]);

  const seek = (sec: number) => {
    const el = audioRef.current;
    const clamped = Math.max(0, Math.min(sec, duration || 0));
    if (el && hasSrc) el.currentTime = clamped;
    setCurrent(clamped);
  };

  const fmt = (s: number) => {
    const t = Math.max(0, Math.floor(s || 0));
    const mm = String(Math.floor(t / 60)).padStart(2, "0");
    const ss = String(t % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (current / duration) * 100));
  }, [current, duration]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="h-px w-full bg-white/10" />
      <div
        className="w-full backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60 bg-zinc-900/80 text-white"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        {/* 상단 얇은 진행바 */}
        <div className="relative h-1 w-full bg-white/10">
          <div className="absolute inset-y-0 left-0 bg-white/50" style={{ width: `${progress}%` }} />
        </div>

        {/* ── 메인 바: 3열 그리드 → 중앙 완전 고정 ── */}
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 py-1.5 sm:gap-4 sm:px-3 sm:py-2">
          {/* 좌측: 커버 + 타이틀 */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-md bg-white/10 shrink-0">
              {hasTrack && coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverSrc}
                  alt={effTrack!.title}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : null}
            </div>
            <div className="min-w-0 max-w-[45vw] sm:max-w-none">
              <div className="truncate text-[13px] font-medium sm:text-sm">
                {hasTrack ? effTrack!.title : "재생할 곡이 없습니다"}
              </div>
              <div className="truncate text-[11px] text-white/70 sm:text-xs">
                {hasTrack ? effTrack!.artist : "플레이리스트에서 곡을 선택하세요"}
              </div>
            </div>
          </div>

          {/* 중앙 컨트롤: grid 중앙 칸 + 고정폭 확보 → 절대 안 흔들림 */}
          <div className="col-start-2 col-end-3 justify-self-center">
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-[132px]">
              <button
                className="inline-flex rounded-full p-2 hover:bg-white/10 disabled:opacity-40"
                onClick={onPrev}
                aria-label="이전 곡"
                title="이전"
                disabled={!hasSrc}
              >
                <LuSkipBack className="h-5 w-5" />
              </button>

              <button
                className="rounded-full bg-white text-zinc-900 p-2 sm:p-2.5 hover:bg-white disabled:opacity-50"
                onClick={toggle}
                aria-label={playing ? "일시정지" : "재생"}
                title={playing ? "일시정지" : "재생"}
                disabled={!hasSrc}
              >
                {playing ? <LuPause className="h-5 w-5" /> : <LuPlay className="h-5 w-5" />}
              </button>

              <button
                className="inline-flex rounded-full p-2 hover:bg-white/10 disabled:opacity-40"
                onClick={onNext}
                aria-label="다음 곡"
                title="다음"
                disabled={!hasSrc}
              >
                <LuSkipForward className="h-5 w-5" />
              </button>

              {/* 시간은 작은 화면에선 숨겨서 중앙폭 보호 */}
              <div className="ml-1 hidden items-center gap-2 text-xs text-white/70 md:flex">
                <span className="tabular-nums">{fmt(current)}</span>
                <span className="text-white/40">/</span>
                <span className="tabular-nums">{fmt(duration)}</span>
              </div>
            </div>
          </div>

          {/* 우측: 볼륨/액션 */}
          <div className="col-start-3 col-end-4 justify-self-end flex items-center gap-1.5 sm:gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <LuVolume2 className="h-5 w-5 text-white/80" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="h-1 w-24 cursor-pointer appearance-none rounded bg-white/15 accent-white"
                aria-label="볼륨"
                disabled={!hasSrc}
              />
            </div>

            {hasTrack && onSubscribe && (
              <button
                onClick={() => onSubscribe(effTrack!.id)}
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10 sm:px-3 sm:py-1.5"
                title="구독"
                aria-label="구독"
              >
                <span className="hidden sm:inline">사용하기</span>
              </button>
            )}

            {hasTrack && (onAddToPlaylist || onOpenPickModal) && (
              <button
                onClick={() =>
                  onAddToPlaylist ? onAddToPlaylist(effTrack!.id) : onOpenPickModal?.()
                }
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs hover:bg-white/10 sm:px-3 sm:py-1.5"
                title="플레이리스트 추가"
                aria-label="플레이리스트 추가"
              >
                <LuListPlus className="h-4 w-4" />
                <span className="hidden sm:inline">플레이리스트 추가</span>
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/10 text-xs hover:bg-white/20"
                aria-label="플레이어 닫기"
                title="플레이어 닫기"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* 오디오 엘리먼트 */}
        <audio ref={audioRef} src={audioSrc || undefined} preload="metadata" playsInline />

        {/* 하단 시크바 */}
        <div className="mx-auto hidden max-w-6xl items-center gap-3 px-3 pb-3 sm:flex">
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={1}
            value={current}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded bg-white/15 accent-white"
            aria-label="재생 위치"
            disabled={!hasSrc}
          />
        </div>
      </div>
    </div>
  );
}
