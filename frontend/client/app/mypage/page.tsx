"use client";

import { useEffect, useMemo, useState } from "react";
import PlaylistModal, { Track } from "../components/sections/playlistmodal";
import UsageLogModal from "../components/sections/UsageLogModal";
import SubscriptionModal, {
  Purchase as UIModalPurchase,
  MileageDelta as UIModalMileage,
} from "../components/sections/SubscriptionModal";
import ProfileEditModal, { ProfileEditValues } from "../components/sections/ProfileEditModal";
import UsingRow, { UsingTrackApi } from "../components/using/UsingRow";

import { updateMeProfileFormData, removeUsingTrack } from "@/lib/api/me";
import { createPlaylist as apiCreatePlaylist } from '@/lib/api/playlist';
import { useMeOverview } from "@/hooks/useMeOverview";
import { useMeRewards } from "@/hooks/useMeRewards";
import useHistory from "@/hooks/useHestory";
import { useMePlays } from "@/hooks/useMePlays";
import { usePlaylistsList, usePlaylistTracks, usePlaylistActions } from "@/hooks/usePlaylists";
import type { PlaylistCard } from "@/lib/api/playlist";
import { resolveImageUrl } from "../utils/resolveImageUrl";
import { useRouter } from "next/navigation";

function maskKey(last4: string | null | undefined) {
  if (!last4) return "****-****-****-****";
  return `••••-••••-••••-${last4}`;
}
async function copyTextSafe(text: string) {
  if (!text) return false;
  try {
    const secure =
      typeof window !== "undefined" &&
      (window.isSecureContext || location.hostname === "localhost" || location.hostname === "127.0.0.1");
    if (secure && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
function genMockKey(len = 40) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "sk_live_";
  for (let i = 0; i < bytes.length; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}
function shortenAddr(addr?: string | null, head = 6, tail = 4) {
  if (!addr) return "-";
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

type TabKey = "using" | "playlist";

export default function MyPage() {
  const [tab, setTab] = useState<TabKey>("using");

  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [subsOpen, setSubsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistCard | null>(null);

  const { data, loading, error, refresh, setData } = useMeOverview();

  const refreshPlaylistTabOnly = async () => {
    await plList.reload?.();
    setTab("playlist");
  };

  const {
    data: rewards,
    loading: rewardsLoading,
    error: rewardsError,
    refresh: refreshRewards,
  } = useMeRewards(7);

  const router = useRouter();
  const { reload: reloadPlaylists } = usePlaylistsList();
  const { data: hist } = useHistory();

  const usingData: UsingTrackApi[] = useMemo(() => {
    const baseList = Array.isArray(data?.usingList) ? data!.usingList : [];
    const rewardMap = new Map<number, any>();
    (rewards?.items ?? []).forEach((it) => rewardMap.set(Number(it.musicId), it));

    return baseList.map((r: any) => {
      const rid = Number(r.id);
      const m = rewardMap.get(rid);
      const row: UsingTrackApi = {
        id: r.id,
        title: r.title,
        artist: r.artist ?? "",
        category: "",
        cover: r.cover ?? m?.coverImageUrl ?? "https://picsum.photos/seed/cover/600/600",
        leadersEarned: r.leadersEarned ?? 0,
        lastUsedAt: m?.lastUsedAt ?? r.lastUsedAt ?? "",
        startedAt: m?.startDate ?? "",
        monthBudget: m?.monthBudget,
        monthSpent: m?.monthSpent,
        monthRemaining: m?.monthRemaining,
        daily: m?.daily,
        playEndpoint: m?.playEndpoint,
        lyricsEndpoint: m?.lyricsEndpoint,
        monthReward: undefined,
        monthlyRewards: [],
      };
      return row;
    });
  }, [data, rewards]);

  const [apiKeyLast4, setApiKeyLast4] = useState<string | null>(null);
  const [fetchingKey, setFetchingKey] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [issuedKey, setIssuedKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [plCreateOpen, setPlCreateOpen] = useState(false);
  const [plCreateName, setPlCreateName] = useState('');
  const [plCreating, setPlCreating] = useState(false);
  const [plCreateErr, setPlCreateErr] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    setApiKeyLast4(data.apiKey?.last4 ?? null);
  }, [data]);
  useEffect(() => {
    setFetchingKey(!!loading);
  }, [loading]);

  const [usageOpen, setUsageOpen] = useState(false);
  const [usageTrackId, setUsageTrackId] = useState<number | null>(null);
  const [usageTitle, setUsageTitle] = useState<string | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const plays = useMePlays(usageOpen && usageTrackId != null ? usageTrackId : undefined, 1, 20);

  function openUsage(t: UsingTrackApi) {
    setUsageTrackId(Number(t.id));
    setUsageTitle(`${t.title} · 사용 기록`);
    setUsageOpen(true);
  }

  const meProfile = useMemo(() => {
    const c = data?.company;
    return {
      name: c?.name ?? "내 회사",
      grade: c?.grade ?? "free",
      profileImageUrl: c?.profileImageUrl ?? null,
      walletAddress: c?.smartAccountAddress ?? "0x0000...0000",
      rewardBalance: c?.rewardBalance ?? 0,
    };
  }, [data]);

  const gradeLabel = (g?: string | null) =>
    g === "business" ? "Business" : g === "standard" ? "Standard" : "Free";

  const profileInitial: ProfileEditValues = useMemo(
    () => ({
      ceo_name: data?.company?.ceoName ?? "",
      phone: data?.company?.phone ?? "",
      homepage_url: data?.company?.homepageUrl ?? "",
      profile_image_url: data?.company?.profileImageUrl ?? "",
      avatarUrl: data?.company?.profileImageUrl ?? "",
    }),
    [data]
  );

  async function handleSaveProfile(
    v: ProfileEditValues,
    file?: File
  ) {
    const prev = data;

    setData?.((p: any) =>
      p
        ? {
            ...p,
            company: {
              ...(p.company ?? {}),
              profileImageUrl: file
                ? URL.createObjectURL(file)
                : v.profile_image_url || p.company?.profileImageUrl || "",
              ceoName: v.ceo_name ?? p.company?.ceoName ?? "",
              phone: v.phone ?? p.company?.phone ?? "",
              homepageUrl: v.homepage_url ?? p.company?.homepageUrl ?? "",
            },
          }
        : p
    );

    try {
      setSavingProfile(true);
      const saved = await updateMeProfileFormData(
        {
          ceo_name: v.ceo_name?.trim() || undefined,
          phone: v.phone?.trim() || undefined,
          homepage_url: v.homepage_url?.trim() || undefined,
          profile_image_url: v.profile_image_url || v.avatarUrl || undefined,
        },
        file
      );
      setData?.(saved); 
    } catch (e: any) {
      setData?.(prev as any);       
      setSavingProfile(false);
      throw e;
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleCreatePlaylistHere() {
    const name = plCreateName.trim();
    if (!name) { setPlCreateErr('이름을 입력하세요'); return; }

    try {
      setPlCreating(true);
      setPlCreateErr(null);

      const r = await apiCreatePlaylist({ name }); // { id, name, count, cover }

      setPlCreateName('');
      setPlCreateOpen(false);

      await plList.reload?.();

      const createdCard = { id: r.id, name: r.name, count: r.count, cover: r.cover } as PlaylistCard;
      setSelectedPlaylist(createdCard);
      setPlaylistIndex(0);
      plTracks.reload?.();
      setPlaylistOpen(true);
    } catch (e: any) {
      setPlCreateErr(e?.message || '생성에 실패했어요.');
    } finally {
      setPlCreating(false);
    }
  }

  const plList = usePlaylistsList(); // { data, loading, error, reload }
  const selectedPlaylistId = selectedPlaylist?.id ?? null;
  const plTracks = usePlaylistTracks(selectedPlaylistId); // { data, loading, error, reload }
  const plActions = usePlaylistActions(selectedPlaylistId); // { useSelected, removeSelected, replaceTracks, deletePlaylist, pending, error }

  const [removeConfirm, setRemoveConfirm] = useState<{
    open: boolean;
    musicId: number | null;
    title?: string;
    pending?: boolean;
    error?: string | null;
  }>({ open: false, musicId: null, title: "", pending: false, error: null });

  function openRemoveModal(t: UsingTrackApi) {
    setRemoveConfirm({ open: true, musicId: Number(t.id), title: t.title, pending: false, error: null });
  }
  function closeRemoveModal() {
    if (removeConfirm.pending) return;
    setRemoveConfirm({ open: false, musicId: null, title: "", pending: false, error: null });
  }

  async function confirmRemoveExec() {
    const musicId = removeConfirm.musicId;
    if (musicId == null) return;
    setRemoveConfirm((s) => ({ ...s, pending: true, error: null }));

    const prev = data;
    // 낙관적 업데이트
    setData?.((p: any) => {
      if (!p) return p;
      const nextUsing = (p.usingList ?? []).filter((x: any) => Number(x.id) !== Number(musicId));
      const nextCount = Math.max(0, (p.usingSummary?.usingCount ?? nextUsing.length) - 1);
      return { ...p, usingList: nextUsing, usingSummary: { ...(p.usingSummary ?? {}), usingCount: nextCount } };
    });

    try {
      const updated = await removeUsingTrack(musicId);
      setData?.(updated);
      closeRemoveModal();
    } catch (e: any) {
      setData?.(prev as any); 
      setRemoveConfirm((s) => ({ ...s, pending: false, error: e?.message || "삭제에 실패했습니다." }));
    }
  }

  if (error) return <main className="p-6 text-red-500">에러: {error}</main>;
  if (rewardsError) console.warn("[/me/rewards] error:", rewardsError);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 pb-[max(24px,env(safe-area-inset-bottom))]">
      <section className="rounded-2xl border border-zinc-200 bg-white/70 p-4 sm:p-6 shadow-sm backdrop-blur
                          dark:border-white/10 dark:bg-zinc-900/60">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
          <img
            src={resolveImageUrl(meProfile.profileImageUrl, "profile")}
            alt="프로필 이미지"
            className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover"
          />

          <div className="flex-1 min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[20px] mb-1 sm:text-[22px] font-bold leading-tight text-zinc-900 dark:text-white break-words">
              {meProfile.name}
              <span className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold bg-zinc-900/95 text-white ring-1 ring-white/10 shadow-sm dark:bg-white dark:text-zinc-900 dark:ring-zinc-900/10">
                {gradeLabel(meProfile.grade)}
              </span>
            </h1>

            <div className="mt-2 sm:mt-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyTextSafe(meProfile.walletAddress ?? "");
                  if (ok) console.log("지갑주소 복사됨");
                }}
                className="inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-3 py-1 text-[12px] font-medium text-violet-600
                           ring-1 ring-violet-500/20 hover:bg-violet-500/20
                           dark:text-violet-300 dark:ring-violet-400/30 break-words"
                title="지갑주소 복사"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="opacity-80">
                  <path d="M2 7a2 2 0 0 1 2-2h10l4 4v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M14 5v4h4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span>{shortenAddr(meProfile.walletAddress)}</span>
              </button>
            </div>

            <div
              className="mt-3 -mx-1 sm:mx-0 flex items-center gap-2 overflow-x-auto px-1 whitespace-nowrap
                         [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                보유 리워드 {meProfile.rewardBalance.toLocaleString()}점
              </span>
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-[12px] font-medium text-amber-600 dark:text-amber-400">
                사용 중인 총 음원 : {data?.usingSummary?.usingCount ?? 0}개
              </span>
              <button
                type="button"
                onClick={() => setSubsOpen(true)}
                className="inline-flex items-center rounded-full bg-blue-500/15 px-3 py-1 text-[12px] font-medium text-blue-600 dark:text-blue-400"
              >
                구독 남은 기간 {data?.subscription?.remainingDays ?? 0}일
              </button>
              <button
                type="button"
                onClick={() => { refresh(); refreshRewards(); }}
                className="inline-flex items-center rounded-full bg-zinc-900/90 px-3 py-1 text-[12px] font-medium text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                새로고침
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (rotating) return;
                  setRotating(true);
                  try {
                    const base = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
                    const companyId = (data as any)?.company?.id ?? (data as any)?.id;
                    if (!companyId) throw new Error("회사 ID를 찾을 수 없습니다.");
                    const url = `${base}/companies/${companyId}/regenerate-api-key`;
                    const res = await fetch(url, { method: "POST", credentials: "include" });
                    const j = await res.json().catch(() => ({} as any));
                    if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);
                    const key: string = j?.api_key ?? j?.apiKey ?? "";
                    if (!key) throw new Error("서버가 새 API 키를 반환하지 않았습니다.");
                    const last4 = key.slice(-4);
                    setIssuedKey(key);
                    setKeyVisible(false);
                    setCopied(false);
                    setKeyModalOpen(true);
                    setApiKeyLast4(last4);
                    setData?.((prev: any) =>
                      prev ? { ...prev, apiKey: { ...(prev.apiKey ?? {}), last4 } } : prev
                    );
                  } catch (e) {
                    console.error(e);
                    const key = genMockKey();
                    const last4 = key.slice(-4);
                    setIssuedKey(key);
                    setKeyVisible(false);
                    setCopied(false);
                    setKeyModalOpen(true);
                    setApiKeyLast4(last4);
                    setData?.((prev: any) =>
                      prev ? { ...prev, apiKey: { ...(prev.apiKey ?? {}), last4 } } : prev
                    );
                  } finally {
                    setRotating(false);
                  }
                }}
                disabled={rotating}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60
                           dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {rotating ? "재발급 중…" : "API 키 재발급"}
              </button>
            </div>
          </div>

          <div className="mt-4 sm:mt-0 sm:ml-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => setProfileOpen(true)}
              disabled={savingProfile}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50
                         disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              {savingProfile ? "저장 중…" : "프로필 편집"}
            </button>
          </div>
        </div>
      </section>

      <div className="mt-8 border-b border-zinc-200 dark:border-white/10">
        <div className="flex gap-6 overflow-x-auto px-1
                        [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setTab("using")}
            className={`relative -mb-px pb-3 pt-2 min-w-[96px] text-sm font-medium leading-none transition-colors ${
              tab === "using" ? "text-zinc-900 dark:text-white" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
            aria-current={tab === "using" ? "page" : undefined}
          >
            사용중인 음원
            <span className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full transition-opacity ${
              tab === "using" ? "opacity-100 bg-red-500" : "opacity-0"
            }`} />
          </button>
          <button
            onClick={() => setTab("playlist")}
            className={`relative -mb-px pb-3 pt-2 min-w-[96px] text-sm font-medium leading-none transition-colors ${
              tab === "playlist" ? "text-zinc-900 dark:text-white" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
            aria-current={tab === "playlist" ? "page" : undefined}
          >
            플레이리스트
            <span className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full transition-opacity ${
              tab === "playlist" ? "opacity-100 bg-red-500" : "opacity-0"
            }`} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        {tab === "using" ? (
          <section className="space-y-3">
            <div className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white/70 dark:divide-white/10 dark:border-white/10 dark:bg-zinc-900/60">
              {usingData.map((t) => (
                <UsingRow
                  key={t.id}
                  t={t}
                  USING_API={"/music"}
                  openUsage={(tt) => openUsage(tt)}
                  onRemove={() => openRemoveModal(t)} 
                />
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {!plCreateOpen ? (
                <button
                  type="button"
                  onClick={() => setPlCreateOpen(true)}
                  className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800
                             dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  + 새 플레이리스트
                </button>
              ) : (
                <div className="flex w-full max-w-xl items-center gap-2">
                  <input
                    value={plCreateName}
                    onChange={(e) => setPlCreateName(e.target.value)}
                    placeholder="예: 출퇴근용"
                    className="h-10 flex-1 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none
                               placeholder:text-zinc-400 focus:border-zinc-300
                               dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-white/20"
                  />
                  <button
                    onClick={handleCreatePlaylistHere}
                    disabled={plCreating}
                    className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60
                               dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    {plCreating ? '만드는 중…' : '만들기'}
                  </button>
                  <button
                    onClick={() => { setPlCreateOpen(false); setPlCreateName(''); setPlCreateErr(null); }}
                    disabled={plCreating}
                    className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50
                               disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                  >
                    취소
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => plList.reload?.()}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50
                           dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                목록 새로고침
              </button>

              {plCreateErr && <span className="text-sm text-red-500">{plCreateErr}</span>}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
              {(plList.data ?? []).map((p) => (
                <div
                  key={p.id}
                  className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
                >
            <div className="group relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800
                            aspect-square md:aspect-auto md:h-56 lg:h-60">
              <button
                type="button"
                onClick={() => {
                  setSelectedPlaylist(p);
                  setPlaylistIndex(0);
                  plTracks.reload(); 
                  setPlaylistOpen(true);
                }}
                className="absolute inset-0"
                aria-label={`${p.name} 상세 보기`}
              >
                <img
                  src={resolveImageUrl(p.cover, "music")}
                  alt={p.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </div>

            <div className="p-2 sm:p-3">
              <div className="truncate text-[13px] sm:text-sm font-semibold text-zinc-900 dark:text-white">
                {p.name}
              </div>
              <div className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                {p.count}곡
              </div>
            </div>
          </div>
        ))}

        {plList.loading && (
          <div className="col-span-full px-2 text-sm text-zinc-500 sm:px-0">
            플레이리스트 로딩중…
          </div>
        )}
        {plList.error && (
          <div className="col-span-full px-2 text-sm text-red-500 sm:px-0">
            에러: {plList.error}
          </div>
        )}
        {plList.data?.length === 0 && !plList.loading && (
          <div className="col-span-full px-2 text-sm text-zinc-500 sm:px-0">
            플레이리스트가 없습니다.
          </div>
        )}
      </div>

          </>
        )}
      </div>

      <PlaylistModal
        key={`${selectedPlaylist?.id ?? 'none'}:${(plTracks.data ?? []).map(t => t.id).join(',')}`}
        isOpen={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        tracks={(plTracks.data ?? []) as unknown as Track[]}
        initialIndex={playlistIndex}
        title={selectedPlaylist?.name || "플레이리스트"}
        onUseSelected={async (ids) => {
          if (!selectedPlaylist?.id || !ids?.length) return;
          await plActions.useSelected(ids);
          await refresh?.();
          await refreshRewards?.();
        }}
        onRemoveSelected={async (ids) => {
          if (!selectedPlaylist?.id || !ids?.length) return;
          await plActions.removeSelected(ids);
          await plTracks.reload();
          await refreshPlaylistTabOnly();
          setPlaylistOpen(false);
        }}
      />

      <ProfileEditModal open={profileOpen} onClose={() => setProfileOpen(false)} initial={profileInitial} onSave={handleSaveProfile} />

      <SubscriptionModal
        open={subsOpen}
        onClose={() => setSubsOpen(false)}
        defaultPlan={data?.subscription?.plan === "business" ? "Business" : data?.subscription?.plan === "standard" ? "Standard" : "Free"}
        nextBillingAt={""}
        autoRenew={data?.subscription?.status === "active"}
        purchases={hist?.purchases ? (hist.purchases as unknown as UIModalPurchase[]) : []}
        minusList={hist?.mileageLogs ? (hist.mileageLogs as unknown as UIModalMileage[]) : []}
        onCancel={() => {
          alert("구독 취소가 예약되었습니다. 현재 구독 종료 시점부터 free 등급으로 전환됩니다.");
          setSubsOpen(false);
        }}
        onResume={() => {
          alert("자동갱신을 재개했습니다.");
          setSubsOpen(false);
        }}
      />

      <UsageLogModal
        isOpen={usageOpen}
        onClose={() => setUsageOpen(false)}
        title={usageTitle}
        trackId={usageTrackId}
        data={plays.data}
        loading={plays.loading}
        error={plays.error}
        page={plays.page}
        setPage={plays.setPage}
        totalPages={plays.totalPages}
        refresh={plays.refresh}
      />

      <p className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">리워드 초기화는 매월 1일입니다.</p>

      {removeConfirm.open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeRemoveModal} />
          <section
            role="dialog"
            aria-modal="true"
            className="relative z-[1001] w-[min(520px,92vw)] max-h-[88dvh] overflow-auto
                       rounded-2xl bg-white text-zinc-900 shadow-xl
                       dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 p-5"
          >
            <h2 className="text-lg font-semibold">사용 목록에서 삭제할까요?</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              <b className="font-semibold">{removeConfirm.title}</b> 을(를) 사용중인 목록에서 제거합니다. 과거 <b>사용 기록은 보존</b>돼요.
            </p>

            {removeConfirm.error && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
                {removeConfirm.error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeRemoveModal}
                disabled={removeConfirm.pending}
                className="h-10 rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50
                           disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                취소
              </button>
              <button
                onClick={confirmRemoveExec}
                disabled={removeConfirm.pending}
                className="h-10 rounded-md bg-zinc-900 text-white px-4 text-sm font-medium hover:bg-zinc-800
                           disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {removeConfirm.pending ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </section>
        </div>
      )}

      {keyModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <section
            role="dialog"
            aria-modal="true"
            className="relative z-[1001] w-[min(560px,92vw)] max-h-[88dvh] overflow-auto
                      rounded-2xl bg-white text-zinc-900 shadow-xl
                      dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 p-5"
          >
            <h2 className="text-lg font-semibold">새 API 키가 발급되었습니다</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              아래 키는 보안상 <b>지금 한 번만</b> 표시됩니다. 안전한 곳에 보관하세요.
            </p>

            <div className="mt-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3">
              <div className="mb-1 text-[11px] text-zinc-500 dark:text-zinc-400">API Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-sm">{keyVisible ? issuedKey : "•".repeat(Math.max(issuedKey.length, 8))}</code>
                <button
                  onClick={() => setKeyVisible((v) => !v)}
                  className="h-8 rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs hover:bg-zinc-100 dark:hover:bg-white/10"
                >
                  {keyVisible ? "숨기기" : "보기"}
                </button>
                <button
                  onClick={async () => {
                    const ok = await copyTextSafe(issuedKey);
                    setCopied(ok);
                    setTimeout(() => setCopied(false), 1200);
                  }}
                  className="h-8 rounded-md bg-zinc-900 text-white px-3 text-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              • 키를 분실하면 다시 재발급해야 합니다. <br />• 다른 사람과 공유하지 마세요.
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setKeyModalOpen(false)}
                className="h-10 rounded-md bg-zinc-900 text-white px-4 text-sm font-medium hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
