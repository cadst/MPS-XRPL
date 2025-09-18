"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RxCross2 } from "react-icons/rx";
import { IoPlay, IoPlaySkipBack, IoPlaySkipForward } from "react-icons/io5";
import { useAudioPlayer } from "@/app/providers/AudioPlayerProvider";
import SuccessModal from "./SuccessModal";
import ConfirmModal from "../common/ConfirmModal";
import { resolveImageUrl } from "@/app/utils/resolveImageUrl";
import { resolveFileUrl } from "@/app/utils/resolveFileUrl";

export type Track = {
  id: number;
  title: string;
  artist: string;
  cover: string;  
  audioUrl: string;
  durationSec?: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  initialIndex?: number;
  onUseSelected?: (trackIds: number[]) => Promise<void> | void;
  onRemoveSelected?: (trackIds: number[]) => Promise<void> | void;
  title?: string;
  onPlaylistEmptied?: () => void;
};

export default function PlaylistModal({
  isOpen,
  onClose,
  tracks,
  initialIndex = 0,
  onUseSelected,
  onRemoveSelected,
  onPlaylistEmptied,
  title = "플레이리스트",
}: Props) {
  // 삭제 직후 즉시 숨기기(낙관적)
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const visibleTracks = useMemo(
    () => tracks.filter((t) => !hiddenIds.has(t.id)),
    [tracks, hiddenIds]
  );

  const [index, setIndex] = useState(initialIndex);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 삭제 확인 모달
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);

  const allChecked = useMemo(
    () => visibleTracks.length > 0 && visibleTracks.every((t) => checked[t.id]),
    [visibleTracks, checked]
  );
  const someChecked = useMemo(
    () => visibleTracks.some((t) => checked[t.id]),
    [visibleTracks, checked]
  );

  const { playTrack } = useAudioPlayer();

  // 모달 열릴 때 초기화 (visibleTracks 기준)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setIndex(Math.min(initialIndex, Math.max(0, visibleTracks.length - 1)));
    const init: Record<number, boolean> = {};
    visibleTracks.forEach((t) => (init[t.id] = true)); // 기본 전체 선택
    setChecked(init);

    return () => {
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialIndex, visibleTracks.map((t) => t.id).join(",")]);

  // tracks가 바뀌면 낙관 숨김 리셋
  useEffect(() => {
    setHiddenIds(new Set());
  }, [tracks.map((t) => t.id).join(",")]);

  // visibleTracks 길이가 바뀌면 현재 index 보정
  useEffect(() => {
    if (index >= visibleTracks.length) {
      setIndex(Math.max(0, visibleTracks.length - 1));
    }
  }, [visibleTracks.length, index]);

  // 빈 리스트면 자동 닫기
  useEffect(() => {
    if (isOpen && visibleTracks.length === 0) onClose();
  }, [isOpen, visibleTracks.length, onClose]);

  // 키 단축키
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === " ") {
        e.preventDefault();
        handlePlayCurrentAndClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, index, visibleTracks]);

  // ===== 재생 유틸 =====
  const toQueue = (list: Track[]) =>
    list.map((t) => {
      const raw = resolveFileUrl(t.audioUrl, "music"); // 상대/절대 보정
      const src = `${raw}${raw.includes("?") ? "&" : "?"}cb=${Date.now()}`; // 304 회피
      return {
        id: t.id,
        title: t.title,
        artist: t.artist,
        cover: t.cover, 
        src,
        duration: t.durationSec,
      };
    });

  const playQueueAndClose = (queueTracks: Track[], startIdx: number) => {
    if (!queueTracks.length) return;
    const queue = toQueue(queueTracks);
    playTrack(queue[startIdx], queue, startIdx);
    onClose();
  };

  const handlePrev = () => {
    if (!visibleTracks.length) return;
    const nextIdx = (index - 1 + visibleTracks.length) % visibleTracks.length;
    setIndex(nextIdx);
  };

  const handleNext = () => {
    if (!visibleTracks.length) return;
    const nextIdx = (index + 1) % visibleTracks.length;
    setIndex(nextIdx);
  };

  // 현재 인덱스부터 보이는 리스트 전체 큐로 재생 + 닫기
  const handlePlayCurrentAndClose = () => {
    if (!visibleTracks.length) return;
    playQueueAndClose(visibleTracks, index);
  };

  // 선택만 재생 + 닫기
  const handlePlaySelectedAndClose = () => {
    const selected = visibleTracks.filter((t) => checked[t.id]);
    if (!selected.length) return;
    const currentId = visibleTracks[index]?.id;
    const startIdx = Math.max(0, selected.findIndex((t) => t.id === currentId));
    playQueueAndClose(selected, startIdx >= 0 ? startIdx : 0);
  };

  // 선택 사용하기
  const handleUseSelected = async () => {
    const ids = visibleTracks.filter((t) => checked[t.id]).map((t) => t.id);
    if (!ids.length) return;
    try {
      await onUseSelected?.(ids);
      setSuccessMsg("체크된 음원을 사용하였습니다.");
    } catch (e) {
      console.error(e);
    }
  };

  // 삭제 확인 열기
  const openConfirmDelete = () => {
    if (!someChecked) return;
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    const ids = visibleTracks.filter((t) => checked[Number(t.id)]).map((t) => Number(t.id));
    if (!ids.length) {
      setConfirmOpen(false);
      return;
    }

    // 낙관적 선반영
    setHiddenIds((prev) => new Set([...prev, ...ids]));
    setConfirmPending(true);

    try {
      await onRemoveSelected?.(ids);
      const remaining = visibleTracks.length - ids.length;

      setChecked({});
      setIndex(0);
      setSuccessMsg("체크된 음원을 삭제하였습니다.");
      setConfirmOpen(false);

      if (remaining <= 0) {
        onPlaylistEmptied?.();
      }
    } catch (e) {
      // 롤백
      setHiddenIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      console.error(e);
    } finally {
      setConfirmPending(false);
    }
  };

  // 체크박스 helpers
  const toggleOne = (id: number) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const setAll = (value: boolean) => {
    const next: Record<number, boolean> = {};
    visibleTracks.forEach((t) => (next[t.id] = value));
    setChecked(next);
  };

  if (!isOpen || !visibleTracks.length) return null;

  const track = visibleTracks[index];

  const fmt = (s?: number) => {
    const n = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(n / 60).toString();
    const ss = String(n % 60).padStart(2, "0");
    return `${m}:${ss}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" aria-modal role="dialog">
      {/* 성공 모달 */}
      <SuccessModal
        isOpen={!!successMsg}
        message={successMsg ?? ""}
        onClose={() => setSuccessMsg(null)}
        autoCloseMs={1500}
      />

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={confirmOpen}
        title="선택한 곡 삭제"
        description="선택한 곡을 이 플레이리스트에서 삭제할까요? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        danger
        pending={confirmPending}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-[101] w-full h-full max-w-full md:max-w-3xl md:h-auto 
                   md:rounded-2xl bg-white p-4 shadow-2xl dark:bg-zinc-900 md:p-6"
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAll(true)}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs hover:bg-zinc-50
                         dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              전체 선택
            </button>
            <button
              onClick={() => setAll(false)}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs hover:bg-zinc-50
                         dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              전체 해제
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="닫기"
            >
              <RxCross2 className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
            </button>
          </div>
        </div>

        {/* 상단 액션바 */}
        <div className="mb-3 flex items-center justify-between text-xs">
          <div className="text-zinc-500 dark:text-zinc-400">
            선택됨: {visibleTracks.filter((t) => checked[t.id]).length}/{visibleTracks.length}
            {!someChecked ? " (없음)" : allChecked ? " (전체)" : ""}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlaySelectedAndClose}
              disabled={!someChecked}
              className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-semibold text-white enabled:hover:bg-zinc-800
                         disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:enabled:hover:bg-zinc-100"
            >
              선택 재생 (닫고 재생)
            </button>
            <button
              onClick={handleUseSelected}
              disabled={!someChecked}
              className="h-8 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white enabled:hover:bg-blue-500
                         disabled:opacity-50"
            >
              선택 사용하기
            </button>
            {onRemoveSelected && (
              <button
                onClick={openConfirmDelete}
                disabled={!someChecked}
                className="h-8 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white enabled:hover:bg-rose-500
                           disabled:opacity-50"
                title="플레이리스트에서 제거"
              >
                선택 삭제
              </button>
            )}
          </div>
        </div>

        {/* 본문 */}
        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          {/* 좌측 현재 트랙 */}
          <div className="rounded-2xl border border-black/5 bg-black/3 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex gap-4">
              {/* 커버 */}
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
              {(() => {
                   const cover = track?.cover ?? (track as any)?.cover;
                   return cover ? (
                     <img src={resolveImageUrl(cover, "music")} alt={track.title} className="h-full w-full object-cover" draggable={false} />
                   ) : null;
                 })
                 ()}
              </div>

              {/* 정보 + 컨트롤 */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-zinc-900 dark:text-white">{track?.title}</div>
                <div className="truncate text-sm text-zinc-600 dark:text-zinc-300">{track?.artist}</div>

                {/* ▶️ 이전/재생/다음 : 항상 가운데 정렬 */}
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={handlePrev}
                    className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="이전 곡"
                  >
                    <IoPlaySkipBack className="h-6 w-6" />
                  </button>
                  <button
                    onClick={handlePlayCurrentAndClose}
                    className="rounded-full bg-zinc-900 p-3 text-white hover:opacity-90 dark:bg-white dark:text-zinc-900"
                    aria-label="재생"
                  >
                    <IoPlay className="h-6 w-6 translate-x-[1px]" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="다음 곡"
                  >
                    <IoPlaySkipForward className="h-6 w-6" />
                  </button>
                </div>

                <div className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  재생 바는 화면 하단에 표시됩니다. 모달을 닫으면 바로 재생돼요.
                </div>
              </div>
            </div>
          </div>

          {/* 우측 리스트 */}
          <div className="max-h-[420px] overflow-auto rounded-2xl border border-black/5 dark:border-white/10">
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {visibleTracks.map((t, i) => {
                const selectedRow = i === index;
                return (
                  <li
                    key={t.id}
                    className={`flex items-center gap-3 px-3 py-2 ${
                      selectedRow ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-zinc-900 dark:accent-white"
                      checked={!!checked[t.id]}
                      onChange={() => toggleOne(t.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="선택"
                    />

                    {/* 썸네일 (탭하면 바로 재생) */}
                    <button
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800"
                      onClick={() => {
                        setIndex(i);
                        playQueueAndClose(visibleTracks, i);
                      }}
                    >
                      + {(() => {
                       const cover = track?.cover ?? (track as any)?.cover;
                       return cover ? (
                         <img src={resolveImageUrl(cover, "music")} alt={track.title} className="h-full w-full object-cover" draggable={false} />
                       ) : null;
                     })
                     ()}
                    </button>

                    {/* 제목/아티스트 (탭하면 바로 재생) */}
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setIndex(i);
                        playQueueAndClose(visibleTracks, i);
                      }}
                    >
                      <div className="truncate text-sm font-medium text-zinc-900 dark:text-white">{t.title}</div>
                      <div className="truncate text-xs text-zinc-600 dark:text-zinc-300">{t.artist}</div>
                    </button>

                    <div
                      className="ml-auto flex-none w-24 sm:w-28 md:w-32 grid place-items-center
                                 text-xs text-zinc-600 dark:text-zinc-300"
                    >
                      {typeof t.durationSec === "number" ? (
                        <span className="tabular-nums leading-none">{fmt(t.durationSec)}</span>
                      ) : (
                        <span className="leading-none">&nbsp;</span>
                      )}
                      <button
                        className="mt-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] hover:bg-zinc-50
                                   dark:border-white/10 dark:bg-transparent dark:hover:bg-white/10"
                        onClick={() => {
                          setIndex(i);
                          playQueueAndClose(visibleTracks, i);
                        }}
                      >
                        재생
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>   
          </div>
        </div>
      </div>
    </div>
  );
}
