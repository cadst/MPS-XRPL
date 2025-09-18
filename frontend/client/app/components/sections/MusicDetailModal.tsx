"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveImageUrl } from "@/app/utils/resolveImageUrl";
import {
  fetchLyricsText,
  downloadLyricsTxt,
  fetchMusicTags,
  startMusicPlay,
  type MusicTagItem,
} from "@/lib/api/musics";
import { removeUsingTrack } from "@/lib/api/me";
import {
  getPlaylists,   
  addTracksToPlaylist,
  createPlaylist as apiCreatePlaylist,
} from "@/lib/api/playlist";
import { resolveFileUrl } from "@/app/utils/resolveFileUrl";
import { useAudioPlayer } from "@/app/providers/AudioPlayerProvider";
import { useMeOverview } from "@/hooks/useMeOverview";
import { refreshAuth } from "@/lib/api/core/http";
/* ───────────────── types ───────────────── */

type Company = { id: number; name: string; tier?: "Free" | "Standard" | "Business" };
type Playlist = { id: number; name: string };

export type MusicDetail = {
  id: number;
  title: string;
  artist: string;
  cover?: string;
  lyrics: string;
  company: Company;
  isSubscribed?: boolean;
  audioUrl?: string;
  access_type?: "FREE" | "SUBSCRIPTION";
  locked?: boolean;
  reason?: "LOGIN_REQUIRED" | "SUBSCRIPTION_REQUIRED";
  lyricsDownloadCount?: number | null;
  category?: string | null;
};

type UsageMetrics = {
  perRead: number;
  monthlyTotal: number;
  remaining: number;
};

/* ───────────────── helpers ───────────────── */

function getSelectedTextIn(container: HTMLElement | null): string {
  if (!container || typeof window === "undefined") return "";
  const sel = window.getSelection?.();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  const isInside = container.contains(range.commonAncestorContainer as Node);
  return isInside ? sel.toString() : "";
}

type AnyObj = Record<string, unknown>;
function extractStreamUrl(r: unknown): string {
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    const o = r as AnyObj;
    const candidates = ["stream_url", "url", "src", "file_path", "path", "streamUrl", "filePath"] as const;
    for (const k of candidates) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    const nests = ["data", "stream", "result"] as const;
    for (const nk of nests) {
      const nv = o[nk];
      if (nv && typeof nv === "object") {
        const oo = nv as AnyObj;
        for (const k of candidates) {
          const v = oo[k];
          if (typeof v === "string" && v.trim()) return v;
        }
      }
    }
  }
  return "";
}

async function copyToClipboard(text: string) {
  if (!text) throw new Error("복사할 내용이 없습니다.");
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

const MAX_DETAIL_TAGS = 12;
function tagsToLabelsForDetail(arr?: MusicTagItem[]): string[] {
  if (!arr) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of arr) {
    const s = String(t.text || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_DETAIL_TAGS) break;
  }
  return out;
}

/* ───────────────── component ───────────────── */

export default function MusicDetailModal({
  open,
  onClose,
  item,
  myPlaylists = [],
  onSubscribe,
  onAddToPlaylist,
  onCreatePlaylist,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  item: MusicDetail | null;
  myPlaylists?: Playlist[];
  onSubscribe?: (musicId: number) => Promise<void> | void;
  onAddToPlaylist?: (musicId: number, playlistId: number) => Promise<void> | void;
  onCreatePlaylist?: (name: string) => Promise<{ id: number; name: string }> | Promise<Playlist> | void;
  usage?: UsageMetrics;
}) {
  /* ─ hooks (순서 고정) ─ */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const portalRoot =
    mounted && typeof window !== "undefined"
      ? document.getElementById("modal-root") ?? document.body
      : null;

  const fmt = useMemo(() => new Intl.NumberFormat("ko-KR"), []);
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const [dlCount, setDlCount] = useState<number | null>(null);

  const [lyricsText, setLyricsText] = useState<string>("");
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsError, setLyricsError] =
    useState<null | "LOGIN_REQUIRED" | "SUBSCRIPTION_REQUIRED" | "NO_LYRICS">(null);

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [playlists, setPlaylists] = useState<Playlist[]>(myPlaylists ?? []);
  const [plsLoading, setPlsLoading] = useState(false);
  const [plsError, setPlsError] = useState<string | null>(null);

  const [tagLoading, setTagLoading] = useState(false);
  const [tagLabels, setTagLabels] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);

  const { playTrack } = useAudioPlayer();
  const { data: overview, refresh: refreshOverview } = useMeOverview();

  // 구독 상태
  const isActiveSub = useMemo(() => {
    const plan = String(overview?.subscription?.plan ?? "free").toLowerCase();
    const status = String(overview?.subscription?.status ?? "none").toLowerCase();
    const days = Number(overview?.subscription?.remainingDays ?? 0);
    return status === "active" || status === "trialing" || days > 0 || plan !== "free";
  }, [overview]);

  const isFreeCompany = useMemo(() => {
    const plan = String(overview?.subscription?.plan ?? "free").toLowerCase();
    return plan === "free";
  }, [overview]);

  // 버튼 노출 정의
  const isSubOnly = useMemo(() => {
    if (!item) return false;
    const needsByAccess = String(item.access_type ?? "").toUpperCase() === "SUBSCRIPTION";
    const needsByFlags = item.locked === true || item.reason === "SUBSCRIPTION_REQUIRED";
    const needsByLyrics = lyricsError === "SUBSCRIPTION_REQUIRED";
    return needsByAccess || needsByFlags || needsByLyrics;
  }, [item, lyricsError]);

  const canUseButtons = useMemo(() => {
    if (!item) return false;
    if (isFreeCompany && isSubOnly) return false; // 무료 플랜에서 구독 전용이면 숨김
    return true;
  }, [item, isFreeCompany, isSubOnly]);

  // 외부 myPlaylists 동기화
  useEffect(() => {
    if (Array.isArray(myPlaylists) && myPlaylists.length) {
      setPlaylists(myPlaylists);
    }
  }, [myPlaylists]);

  useEffect(() => {
    // 모달이 열리고, 목록 피커가 열렸을 때 서버에서 1회 로드
    if (!open || !showPicker) return;
  
    // 이미 목록이 있으면 재요청 스킵
    if (playlists.length > 0) return;
  
    let aborted = false;
  
    (async () => {
      try {
        setPlsLoading(true);
        setPlsError(null);
  
        // 토큰 만료 대비 (선택): 첫 시도 전에 한 번
        await refreshAuth().catch(() => {});
  
        const res = await getPlaylists();
  
        if (aborted) return;
  
        // { items: [...] } 또는 [] 대응
        const items = Array.isArray((res as any)?.items)
          ? (res as any).items
          : (Array.isArray(res) ? res : []);
  
        const mapped = items.map((p: any) => ({
          id: Number(p.id),
          name: String(p.name),
        }));
  
        setPlaylists(mapped);
      } catch (e: any) {
        if (aborted) return;
        setPlsError(e?.message || "플레이리스트를 불러오지 못했어요.");
      } finally {
        if (!aborted) setPlsLoading(false);
      }
    })();
  
    return () => { aborted = true; };
  }, [open, showPicker, playlists.length]);

  // 구독/개요 변경 브로드캐스트
  useEffect(() => {
    const h = () => refreshOverview?.();
    window.addEventListener("mps:me:overview:changed", h);
    return () => window.removeEventListener("mps:me:overview:changed", h);
  }, [refreshOverview]);

  useEffect(() => {
    if (!open || !item) return;
    setDlCount(typeof item.lyricsDownloadCount === "number" ? item.lyricsDownloadCount : null);
  }, [open, item?.id]);

  /* ───────── 가사 로드 + 자동 재시도 (백오프) ───────── */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const maxRetry = 5;
  const inFlightAbortRef = useRef<AbortController | null>(null);

  // 구독 미활성 + 구독전용 트랙이면 API 호출 자체를 막아서 403 스팸 제거
  const needsSubscriptionGate = useMemo(() => {
    if (!item) return false;
    const subOnly = String(item.access_type ?? "").toUpperCase() === "SUBSCRIPTION";
    const locked = !!item.locked || item.reason === "SUBSCRIPTION_REQUIRED";
    return !isActiveSub && (subOnly || locked);
  }, [item, isActiveSub]);

  const loadLyrics = useCallback(async () => {
    if (!item) return;

    // 사전 게이트: 권한 없으면 호출 안 함
    if (needsSubscriptionGate) {
      setLyricsText("");
      setLyricsError("SUBSCRIPTION_REQUIRED");
      return;
    }

    // 이전 요청 취소
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
      inFlightAbortRef.current = null;
    }
    const ac = new AbortController();
    inFlightAbortRef.current = ac;

    try {
      setLyricsLoading(true);
      setLyricsError(null);
      setLyricsText("");

      const t = await fetchLyricsText(item.id); 
      if (ac.signal.aborted) return;

      if (t && t.trim()) {
        setLyricsText(t);
        setLyricsError(null);
        retryAttemptRef.current = 0;
        return;
      }
      setLyricsText("");
      setLyricsError("NO_LYRICS");
    // loadLyrics 정의 내부 catch 부분만 이처럼 바꿔줘
} catch (e: any) {
  if (ac.signal.aborted) return;
  const msg = e?.message || "";

  if (msg === "LOGIN_REQUIRED") {
    setLyricsText("");
    setLyricsError("LOGIN_REQUIRED");
    return;
  }

  if (msg === "SUBSCRIPTION_REQUIRED") {
    setLyricsText("");
    setLyricsError("SUBSCRIPTION_REQUIRED");

    // 〈NEW〉 구독은 활성인데 토큰이 낡아서 403인 경우 → 첫 재시도 전에 토큰 자동 갱신
    if (isActiveSub) {
      if (retryAttemptRef.current === 0) {
        await refreshAuth().catch(() => {}); // 〈NEW〉
      }

      if (retryAttemptRef.current < maxRetry) {
        const attempt = retryAttemptRef.current++;
        const delay = Math.min(1000 * Math.pow(1.7, attempt), 6000);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          loadLyrics();
        }, delay);
      }
    }
    return;
  }

  // 알 수 없는 응답은 가사 없음으로 폴백
  setLyricsText("");
  setLyricsError("NO_LYRICS");
} finally {
  if (!inFlightAbortRef.current?.signal.aborted) setLyricsLoading(false);
}
  }, [item?.id, isActiveSub, needsSubscriptionGate]);

  // 모달 열릴 때 & 트랙/구독 상태 변화 시 로드
  useEffect(() => {
    if (!open || !item) return;
    // 리셋
    retryAttemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    loadLyrics();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
        inFlightAbortRef.current = null;
      }
    };
  }, [open, item?.id, isActiveSub, needsSubscriptionGate, loadLyrics]);

  /* ───────── 태그 로드 ───────── */
  useEffect(() => {
    if (!open || !item) return;
    (async () => {
      try {
        setTagLoading(true);
        setTagError(null);
        setTagLabels([]);
        const list = await fetchMusicTags(item.id);
        setTagLabels(tagsToLabelsForDetail(list));
      } catch (e: any) {
        setTagError(e?.message || "태그를 불러오지 못했어요.");
      } finally {
        setTagLoading(false);
      }
    })();
  }, [open, item?.id]);

  // 가사 DOM
  const lyricsBoxRef = useRef<HTMLPreElement>(null);

  // 토스트 & 모달 라이프사이클
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => firstFocusRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      setShowPicker(false);
      setCreating(false);
      setNewName("");
      setToast("");
      setConfirmRemoveOpen(false);
      setRemoving(false);
      setAdding(false);
      setPlsLoading(false);
      setPlsError(null);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!mounted || !open || !item || !portalRoot) return null;

  /* ───────── actions ───────── */

  const handlePrimaryClick = async () => {
    if (!canUseButtons) return;
    if (item.isSubscribed) {
      setConfirmRemoveOpen(true);
      return;
    }
  
    await onSubscribe?.(item.id);              
    await refreshAuth().catch(() => {});       
    await Promise.resolve(refreshOverview?.()); 
    window.dispatchEvent(new CustomEvent("mps:me:overview:changed"));
  
    // ⭐ 가사 즉시 재시도 (백오프는 loadLyrics가 관리)
    retryAttemptRef.current = 0;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setLyricsLoading(true);
    setLyricsError(null);
    setLyricsText("");
    loadLyrics();
  };

  const confirmRemove = async () => {
    try {
      setRemoving(true);
      await removeUsingTrack(item.id);
      setToast("사용 목록에서 제거했어요.");
      setConfirmRemoveOpen(false);
      onClose();
    } catch (e: any) {
      setToast(e?.message || "삭제에 실패했어요.");
    } finally {
      setRemoving(false);
    }
  };

  const handlePick = async (playlistId: number) => {
    if (!canUseButtons) return;
    try {
      setAdding(true);
      const pid = Number(playlistId);
      const mid = Number(item.id);
      if (onAddToPlaylist) await onAddToPlaylist(mid, pid);
      else await addTracksToPlaylist(pid, [mid]);
      setToast("플레이리스트에 담았어요.");
      setShowPicker(false);
    } catch (e: any) {
      setToast(e?.message || "담기에 실패했어요.");
    } finally {
      setAdding(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      let created: { id: number; name: string } | undefined;
      if (onCreatePlaylist) {
        const r = await onCreatePlaylist(newName.trim());
        if (r && "id" in (r as any)) created = { id: (r as any).id, name: (r as any).name };
      } else {
        const r = await apiCreatePlaylist({ name: newName.trim() });
        created = { id: r.id, name: r.name };
      }
      if (!created) throw new Error("플레이리스트 생성에 실패했어요.");

      setPlaylists((prev) => [{ id: created.id, name: created.name }, ...prev]);

      if (onAddToPlaylist) await onAddToPlaylist(Number(item.id), Number(created.id));
      else await addTracksToPlaylist(Number(created.id), [Number(item.id)]);

      setToast("새 플레이리스트를 만들고 담았어요.");
      setShowPicker(false);
    } catch (e: any) {
      setToast(e?.message || "생성에 실패했어요.");
    } finally {
      setCreating(false);
      setNewName("");
    }
  };

  const handlePlay = async () => {
    if (!canUseButtons) return;
    try {
      const resp: unknown = await startMusicPlay(item.id);
      const raw = extractStreamUrl(resp);
      if (!raw) throw new Error("재생 URL을 받을 수 없어요.");
      const resolved = resolveFileUrl(raw, "music");
      const src = `${resolved}${resolved.includes("?") ? "&" : "?"}cb=${Date.now()}`;
      playTrack({ id: item.id, title: item.title, artist: item.artist, cover: item.cover, src });
      requestAnimationFrame(() => onClose());
    } catch (e: any) {
      alert(e?.message || "재생을 시작할 수 없습니다.");
    }
  };

  const copyAll = async () => {
    try {
      await copyToClipboard(lyricsText);
      setToast("가사 전체를 복사했어요.");
    } catch {
      setToast("복사에 실패했어요.");
    }
  };
  const copySelection = async () => {
    const selected = getSelectedTextIn(lyricsBoxRef.current?.parentElement || null);
    if (!selected.trim()) {
      setToast("가사에서 복사할 부분을 드래그하세요.");
      return;
    }
    try {
      await copyToClipboard(selected);
      setToast("선택한 부분을 복사했어요.");
    } catch {
      setToast("복사에 실패했어요.");
    }
  };
  const handleDownloadTxt = async () => {
    try {
      await downloadLyricsTxt(item.id);
      setToast("TXT 다운로드를 시작했어요.");
      setDlCount((prev) => (prev == null ? 1 : prev + 1));
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg === "LOGIN_REQUIRED") setToast("로그인이 필요합니다.");
      else if (msg === "SUBSCRIPTION_REQUIRED") setToast("구독이 필요합니다.");
      else if (msg === "NO_LYRICS" || msg === "NO_LYRICS_SOURCE") setToast("가사가 없습니다.");
      else setToast("다운로드에 실패했어요.");
    }
  };

  const Stat = ({ label, value }: { label: string; value: number | string | undefined }) => (
    <div className="min-w-[120px] rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5">
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-0.5 font-semibold text-zinc-900 dark:text-white">
        {typeof value === "number" ? fmt.format(value) : value ?? "--"}
      </div>
    </div>
  );

  const shouldShowButtons = canUseButtons && !lyricsLoading;

  /* ───────── UI ───────── */

  const ui = (
    <div className="fixed inset-0 z-[1000] flex items-end md:items-stretch justify-center overscroll-contain">
      <div aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="music-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-[1001] w-full h-[calc(100svh-var(--app-header-height,0px))] md:h-[calc(100%-6rem)] md:w-[min(100%,980px)] md:my-[4.5rem] overflow-hidden bg-white text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-white md:rounded-2xl md:border md:border-zinc-200 md:dark:border-white/10 pt-[max(env(safe-area-inset-top),0px)] pb-[max(env(safe-area-inset-bottom),0px)] flex flex-col"
      >
        {/* Header */}
        <header className="flex flex-wrap items-start gap-4 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
          <img
            src={resolveImageUrl(item!.cover, "music")}
            alt={`${item!.title} cover`}
            className="h-16 w-16 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-white/10"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="music-modal-title" className="truncate text-lg font-semibold">
                {item!.title}
              </h2>
              {item!.category && (
                <span className="shrink-0 inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-[3px] text-xs text-zinc-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-100">
                  {item!.category}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="truncate">{item!.artist}</span>
            </div>

            {shouldShowButtons && (
              <div className="mt-3">
                <button
                  ref={firstFocusRef}
                  onClick={handlePlay}
                  className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 active:bg-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  재생
                </button>
              </div>
            )}
          </div>

          <div className="hidden gap-2 md:flex">
            <Stat label="1회 리워드 량" value={usage?.perRead} />
            <Stat label="총 월별 리워드 량" value={usage?.monthlyTotal} />
            <Stat label="남은 량" value={usage?.remaining} />
            {typeof item!.lyricsDownloadCount === "number" && (
              <Stat label="가사 다운로드" value={item!.lyricsDownloadCount} />
            )}
          </div>

          <button
            onClick={onClose}
            className="ml-auto rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="모달 닫기"
          >
            ×
          </button>
        </header>

        {/* Mobile usage metrics */}
        {usage ? (
          <div className="flex gap-2 border-b border-zinc-200 px-5 py-3 md:hidden dark:border-white/10">
            <Stat label="1회 리워드 량" value={usage.perRead} />
            <Stat label="총 월별 리워드 량" value={usage.monthlyTotal} />
            <Stat label="남은 량" value={usage.remaining} />
          </div>
        ) : null}

        {/* Body */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px]">
          {/* Lyrics */}
          <div className="relative min-h-0 flex flex-col border-b border-zinc-200 md:border-b-0 md:border-r dark:border-white/10">
            <div className="px-5 pt-5">
              <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">가사</h3>
            </div>

            <div className="flex-1 min-h-0 px-5 pr-4 pb-3 md:pb-4">
              <div className="h-full overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                {lyricsLoading ? (
                  <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</div>
                ) : lyricsError ? (
                  <div className="p-3 text-sm rounded-md">
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-400/30 dark:bg-amber-300/10 dark:text-amber-200">
                      {lyricsError === "LOGIN_REQUIRED" && "가사를 보려면 로그인이 필요합니다."}
                      {lyricsError === "SUBSCRIPTION_REQUIRED" &&
                        (isActiveSub ? (
                          <div className="flex items-center justify-between gap-2">
                            <span>구독 갱신 중이에요. 잠시 후 다시 시도해 주세요.</span>
                            <div className="flex gap-2">
                              <button
                                className="shrink-0 rounded-md border border-amber-300/60 px-2 py-1 text-[12px] font-medium hover:bg-amber-100/60 dark:border-amber-300/20 dark:hover:bg-amber-200/10"
                                onClick={() => {
                                  setLyricsLoading(true);
                                  setLyricsError(null);
                                  setLyricsText("");
                                  Promise.resolve(refreshOverview?.()).finally(() => setLyricsLoading(false));
                                  retryAttemptRef.current = 0;
                                  if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
                                  loadLyrics();
                                }}
                              >
                                다시 시도
                              </button>

                              {/* ⭐ 추가: 권한(토큰) 갱신 후 재시도 */}
                              <button
                                className="shrink-0 rounded-md border border-amber-300/60 px-2 py-1 text-[12px] font-medium hover:bg-amber-100/60 dark:border-amber-300/20 dark:hover:bg-amber-200/10"
                                onClick={async () => {
                                  await refreshAuth().catch(() => {});
                                  retryAttemptRef.current = 0;
                                  if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
                                  setLyricsLoading(true);
                                  setLyricsError(null);
                                  setLyricsText("");
                                  loadLyrics();
                                }}
                              >
                                권한 갱신
                              </button>
                            </div>
                          </div>
                        ) : (
                          "가사를 보려면 구독이 필요합니다."
                        ))
                      }
                      {lyricsError === "NO_LYRICS" && "이 트랙은 가사가 제공되지 않습니다."}
                    </div>
                  </div>
                ) : (
                  <pre
                    ref={lyricsBoxRef}
                    className="m-0 whitespace-pre-wrap p-3 text-[15px] leading-7 text-zinc-800 dark:text-zinc-100 select-text bg-transparent"
                  >
                    {lyricsText}
                  </pre>
                )}
              </div>
            </div>

            {/* actions */}
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyAll}
                  disabled={!lyricsText || !!lyricsError}
                  className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  전체 복사
                </button>
                <button
                  onClick={copySelection}
                  disabled={!lyricsText || !!lyricsError}
                  className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  선택 복사
                </button>
                <button
                  onClick={handleDownloadTxt}
                  disabled={!!lyricsError}
                  className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 active:bg-zinc-900 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  TXT 다운로드
                </button>
              </div>

              {toast && <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{toast}</div>}
            </div>
          </div>

          {/* Right panel */}
          <aside className="flex h-full flex-col justify-between p-5">
            <div className="space-y-4">
              <div className="flex flex-col gap-2.5">
                {shouldShowButtons && (
                  <button
                    onClick={handlePrimaryClick}
                    disabled={removing}
                    className="h-10 w-full rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 active:bg-zinc-900 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    {item!.isSubscribed ? (removing ? "삭제 중…" : "사용중 · 해제하기") : "사용하기"}
                  </button>
                )}

                {shouldShowButtons && (
                  <div className="relative">
                    <button
                      onClick={() => setShowPicker((s) => !s)}
                      className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
                    >
                      플레이리스트에 추가
                    </button>

                    {showPicker && (
                      <div className="absolute z-[1002] mt-2 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900">
                        <div className="max-h-[45vh] md:max-h-56 overflow-y-auto p-2">
                          {plsLoading ? (
                            <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">불러오는 중…</div>
                          ) : plsError ? (
                            <div className="px-3 py-2 text-sm text-red-500">
                              {plsError}{" "}
                              <button
                                className="ml-2 underline"
                                onClick={() => {
                                  setPlaylists([]);
                                  setShowPicker(false);
                                  setTimeout(() => setShowPicker(true), 0);
                                }}
                              >
                                다시 시도
                              </button>
                            </div>
                          ) : playlists.length ? (
                            playlists.map((pl) => (
                              <button
                                key={pl.id}
                                onClick={() => handlePick(pl.id)}
                                disabled={adding}
                                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-white/10"
                              >
                                <span className="truncate">{pl.name}</span>
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                  {adding ? "담는 중…" : "담기"}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">플레이리스트가 없습니다.</div>
                          )}

                          <div className="my-2 h-px bg-zinc-200 dark:bg-white/10" />

                          <div className="p-2">
                            <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">새 플레이리스트</div>
                            <div className="flex gap-2">
                              <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="예: 출퇴근용"
                                className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white/20"
                              />
                              <button
                                disabled={creating}
                                onClick={handleCreate}
                                className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
                              >
                                {creating ? "만드는 중…" : "만들기"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 태그 */}
              <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="mb-2 text-sm font-medium text-zinc-900 dark:text-white">태그</div>

                {tagLoading ? (
                  <div className="flex gap-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-6 w-16 rounded-full bg-zinc-200/80 dark:bg-white/10 animate-pulse" />
                    ))}
                  </div>
                ) : tagError ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">태그를 불러오지 못했어요.</div>
                ) : tagLabels.length === 0 ? (
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">태그가 없습니다.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagLabels.map((t, idx) => (
                      <span
                        key={`${item!.id}-${idx}-${t.toLowerCase()}`}
                        className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-zinc-100"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* 삭제 확인 모달 */}
        {confirmRemoveOpen && (
          <div className="absolute inset-0 z-[1100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => !removing && setConfirmRemoveOpen(false)} />
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-[1101] w-[min(520px,92vw)] rounded-2xl border border-zinc-200 bg-white p-5 md:p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">사용 중인 음원을 삭제할까요?</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                이 음원을 <b>사용 목록에서 제거</b>합니다. 과거 사용 기록과 리워드 집계는 그대로 보존됩니다.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setConfirmRemoveOpen(false)}
                  disabled={removing}
                  className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  취소
                </button>
                <button
                  onClick={confirmRemove}
                  disabled={removing}
                  className="h-9 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-500 active:bg-red-600 disabled:opacity-60"
                >
                  {removing ? "삭제 중…" : "삭제"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  return portalRoot ? createPortal(ui, portalRoot) : null;
}
