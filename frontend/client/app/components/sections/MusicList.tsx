"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import MusicDetailModal, { type MusicDetail } from "./MusicDetailModal";
import {
  fetchMusics,
  fetchMusicTagsBulk,
  fetchCategories,
  fetchRawTagChips,
  fetchMusicDetail, 
  useMusic,
  type Music as ApiMusic,
  type Category,
  type MusicTagItem,
} from "@/lib/api/musics";
import MusicSearch from "./MusicSearch";
import { LuChevronDown } from "react-icons/lu";
import { resolveImageUrl } from "@/app/utils/resolveImageUrl";
import { useMeOverview } from "@/hooks/useMeOverview";
import { refreshAuth } from "@/lib/api/core/http";
/* ───────── Types / constants ───────── */

const FORMATS = ["Full", "Inst"] as const;
type FormatLabel = (typeof FORMATS)[number];

type AccessReason = "LOGIN_REQUIRED" | "SUBSCRIPTION_REQUIRED" | undefined;

type UIMusic = {
  id: number;
  title: string;
  artist: string;
  cover: string;

  reward_amount?: number;
  reward_total?: number;
  reward_remaining?: number;

  category?: string;
  category_id?: number;
  tags?: string[];
  format?: FormatLabel;

  access_type?: "FREE" | "SUBSCRIPTION";
  locked?: boolean;
  reason?: AccessReason;
};

type SortKey = "popular" | "latest" | "remainderReward" | "totalReward" | "rewardOne";

const SORT_LABELS: Record<SortKey, string> = {
  popular: "인기순",
  latest: "최신순",
  remainderReward: "남은 리워드 많은순",
  totalReward: "총 리워드 많은순",
  rewardOne: "1회 리워드 높은순",
};

function mapClientSortToServer(k: SortKey) {
  switch (k) {
    case "latest":
      return "newest";
    case "popular":
      return "most_played";
    case "remainderReward":
      return "remaining_reward";
    case "totalReward":
      return "total_reward";
    case "rewardOne":
      return "reward_one";
    default:
      return "relevance";
  }
}


const num = (v: any): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

function normalizeReason(v: any): "LOGIN_REQUIRED" | "SUBSCRIPTION_REQUIRED" | undefined {
  const s = String(v ?? "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("login")) return "LOGIN_REQUIRED";
  if (s.includes("subscribe") || s.includes("subscription") || s.includes("paid") || s.includes("member"))
    return "SUBSCRIPTION_REQUIRED";
  return undefined;
}

function normalizeLocked(v: any): boolean {
  if (typeof v === "boolean") return v;
  const n = Number(v);
  if (Number.isFinite(n)) return n === 1;
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "true" || s === "locked" || s === "yes") return true;
  if (s === "false" || s === "unlocked" || s === "no" || s === "0") return false;
  return Boolean(v);
}

function normalizeAccess(
  x: any,
  obj?: any,
): "FREE" | "SUBSCRIPTION" | undefined {
  const s = String(x ?? "").toLowerCase();

  if (["free", "public", "open", "unlocked"].includes(s)) return "FREE";
  if (["subscription", "subscription_only", "sub", "paid", "members", "members_only", "premium", "pro", "vip", "paid_only", "locked", "private", "restricted"].includes(s))
    return "SUBSCRIPTION";

  if (typeof x === "boolean") return x ? "SUBSCRIPTION" : "FREE";
  const nx = Number(x);
  if (Number.isFinite(nx)) {
    if (nx === 0) return "FREE";
    if (nx >= 1) return "SUBSCRIPTION";
  }

  if (obj && typeof obj === "object") {
    if ("is_free" in obj) return obj.is_free ? "FREE" : "SUBSCRIPTION";
    if (obj.members_only || obj.subscription_only || obj.is_subscription || obj.is_premium) return "SUBSCRIPTION";
    const price = Number(obj.price_per_play ?? obj.price ?? obj.play_price ?? NaN);
    if (Number.isFinite(price)) return price > 0 ? "SUBSCRIPTION" : "FREE";
  }
  return undefined;
}



function mapApiToUI(m: ApiMusic): UIMusic {
  const fmtApi = (m as any).format as "FULL" | "INSTRUMENTAL" | undefined;
  const format: FormatLabel | undefined =
    fmtApi === "INSTRUMENTAL" ? "Inst" : fmtApi === "FULL" ? "Full" : undefined;

  // 응답에 access_type/locked/reason은 없음 → 힌트만 모으기
  const rawAccess =
    (m as any).access_type ??
    (m as any).accessType ??
    (m as any).access ??
    (m as any).access_level ??
    (m as any).subscription_only ??
    (m as any).is_subscription ??
    (m as any).is_premium ??
    (m as any).paid;

  // 새로: grade/can_use 사용
  const grade = Number((m as any).grade_required ?? NaN); // 0이면 무료, 1이상이면 구독
  const canUse = Boolean((m as any).can_use);

  // 기존 normalizeAccess도 시도(혹시 모를 케이스 대비)
  const normalizedFromServer = normalizeAccess(rawAccess, m);

  // 최종 access_type 결정: 1) 서버 힌트 2) grade_required 규칙
  let access_type: "FREE" | "SUBSCRIPTION" | undefined = normalizedFromServer;
  if (!access_type) {
    if (Number.isFinite(grade)) {
      access_type = grade > 0 ? "SUBSCRIPTION" : "FREE";
    }
  }

  // locked 계산: 리스트 응답에 locked 없음 → 구독 트랙인데 can_use=false면 잠금
  let locked = false;
  if (access_type === "SUBSCRIPTION") {
    locked = !canUse;
  }

  // reason은 응답에 없으니 생략(렌더링은 access_type 기준으로 배지 뜸)
  const reason: AccessReason | undefined = undefined;

  return {
    id: (m as any).id,
    title: (m as any).title,
    artist: (m as any).artist ?? "",
    cover: (m as any).cover ?? (m as any).cover_image_url ?? "/placeholder.png",
    reward_amount: Number((m as any).reward?.reward_one ?? undefined),
    reward_total: Number((m as any).reward?.reward_total ?? undefined),
    reward_remaining: Number((m as any).reward?.reward_remain ?? undefined),
    category: (m as any).category ?? (m as any).category_name ?? undefined,
    category_id: (m as any).category_id ?? (m as any).categoryId ?? undefined,
    tags: undefined,
    format,
    access_type, // ← 이제 FREE/ SUBSCRIPTION 들어옴
    locked,
    reason,
  };
}





function categoryIdForServer(sp: URLSearchParams): string | undefined {
  const single = sp.get("category");
  if (single) return single;
  const csv = sp.get("categories");
  if (!csv) return undefined;
  const arr = csv.split(",").map((s) => s.trim()).filter(Boolean);
  return arr[0]; 
}


const PAGE_SIZE = 20;

export default function MusicList({ initialQuery = {} }) {
  const sp = useSearchParams();
  const router = useRouter();

  const q = sp.get("q") ?? "";
  const sortKey = (sp.get("sort") as SortKey) ?? "popular";
  const serverCategoryId = useMemo(() => categoryIdForServer(sp), [sp]);
  const [sortOpen, setSortOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<MusicDetail | null>(null);
  const [usage, setUsage] = useState<{ perRead: number; monthlyTotal: number; remaining: number }>();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const selectedFormats = useMemo<FormatLabel[]>(() => {
    const arr = (sp.get("formats") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.filter((v): v is FormatLabel => (FORMATS as readonly string[]).includes(v));
  }, [sp]);

  const { data: overview, refresh: refreshMe } = useMeOverview();
  const [upgrading, setUpgrading] = useState(false);
  const isActiveSub = useMemo(() => {
    const plan = String(overview?.subscription?.plan ?? "free").toLowerCase();
    const status = String(overview?.subscription?.status ?? "none").toLowerCase();
    const days = Number(overview?.subscription?.remainingDays ?? 0);
    return status === "active" || status === "trialing" || days > 0 || plan !== "free";
  }, [overview]);

  const selectedMoodNames = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          (sp.get("moods") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    [sp],
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const selectedCategoryIds = useMemo<string[]>(() => {
    const list: string[] = [];
    const multi = (sp.get("categories") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const single = (sp.get("category") ?? "").trim();

    list.push(...multi);
    if (single) list.push(single);

    return Array.from(new Set(list));
  }, [sp]);

  const [moodItems, setMoodItems] = useState<string[]>([]);

  const [items, setItems] = useState<UIMusic[]>([]);
  const [err, setErr] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tagsById, setTagsById] = useState<Record<number, string[]>>({});

  const [cursor, setCursor] = useState<string | number | "first">("first");
  const [hasMore, setHasMore] = useState(true);

  const inflightRef = useRef(false);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const reqSeqRef = useRef(0);
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);

  type URLPatch = {
    q?: string;
    sort?: SortKey;
    moods?: string[]; 
    formats?: string[]; 
    categories?: string[]; 
    category?: string; 
  };

  const patchParams = useCallback(
    (patch: URLPatch) => {
      const next = new URLSearchParams(sp.toString());

      const setArr = (key: string, arr?: string[]) => {
        if (arr && arr.length) next.set(key, arr.join(","));
        else next.delete(key);
      };

      if (patch.q !== undefined) {
        const s = (patch.q ?? "").trim();
        s ? next.set("q", s) : next.delete("q");
      }

      if (patch.sort !== undefined) next.set("sort", String(patch.sort));
      if (patch.moods !== undefined) setArr("moods", patch.moods);
      if (patch.formats !== undefined) setArr("formats", patch.formats);
      if (patch.categories !== undefined) {
        setArr("categories", patch.categories);
        next.delete("category"); 
      }
      if (patch.category !== undefined) {
        const s = (patch.category ?? "").trim();
        if (s) next.set("category", s);
        else next.delete("category");
        next.delete("categories");
      }

      next.delete("cursor");
      startTransition(() => router.replace("?" + next.toString(), { scroll: false }));
    },
    [router, sp],
  );

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCategories();
        const deduped = Array.from(new Map(list.map((c) => [String(c.category_id), c])).values());
        setCategories(deduped);
      } catch (e) {
        console.warn("[MusicList] fetchCategories 실패:", e);
      }
    })();

    (async () => {
      try {
        const chips = await fetchRawTagChips("mood");
        const names = chips.map((c) => String(c.name || "").trim()).filter(Boolean);
        setMoodItems(Array.from(new Set(names)));
      } catch (e) {
        console.warn("[MusicList] fetchRawTagChips 실패:", e);
        setMoodItems([]);
      }
    })();
  }, []);

  const fetchNext = useCallback(
    async (cursorArg?: number | "first", replace = false) => {
      if (inflightRef.current) return;
      if (!hasMore && !(replace && cursorArg === "first")) return;
  
      // ★ 이 호출의 고유 요청 id 발급
      const mySeq = ++reqSeqRef.current;
  
      inflightRef.current = true;
      setErr("");
  
      try {
        const eff = cursorArg ?? cursor;
        const cursorParam = eff === "first" ? undefined : eff;
  
        const req = {
          q: q || undefined,
          sort: mapClientSortToServer(sortKey),
          limit: PAGE_SIZE,
          cursor: cursorParam,
          category_id: serverCategoryId ? Number(serverCategoryId) : undefined,
          categories: selectedCategoryIds.map((s) => Number(s)).filter(Number.isFinite),
          formats: selectedFormats.map((f) => (f === "Inst" ? "INSTRUMENTAL" : "FULL")),
          moods: selectedMoodNames,
        };
  
        // (옵션) 디버깅
        console.log("[MusicList] fetchMusics(req) ▶", req);
  
        const page = await fetchMusics(req as any);
  
        // ★ 여기서도 내 요청이 최신인지 확인 (늦게 끝난 이전 요청이면 버린다)
        if (mySeq !== reqSeqRef.current) return;
  
        const rawItems = page.items || [];
        const batch = rawItems.map(mapApiToUI);
  
        // ★ 클라 보정 필터(형식)
        const filteredByClient = (() => {
          if (!selectedFormats.length) return batch;
          const wantInst = selectedFormats.includes("Inst");
          const wantFull = selectedFormats.includes("Full");
          const out = batch.filter((x) => {
            if (!x.format) return false;
            return (wantInst && x.format === "Inst") || (wantFull && x.format === "Full");
          });
          const stat = out.reduce((acc, x) => {
            const k = x.format || "N/A";
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          console.log("[MusicList] client-filtered format stats ▶", stat);
          return out;
        })();
  
        if (replace) {
          // ★ 교체 모드일 땐 먼저 누적/태그 캐시 싹 리셋
          seenIdsRef.current = new Set();
          setTagsById({});
        }
  
        const seenGlobal = seenIdsRef.current;
        const seenLocal = new Set<number>();
  
        const deduped = filteredByClient.filter((m) => {
          if (!m || typeof m.id !== "number") return false;
          if (seenLocal.has(m.id)) return false;
          seenLocal.add(m.id);
          if (seenGlobal.has(m.id)) return false;
          seenGlobal.add(m.id);
          return true;
        });
        

        

        const ensureAccessBadge = (it: UIMusic): UIMusic => {
          if (it.access_type === "FREE" || it.access_type === "SUBSCRIPTION") return it;
          if (it.locked || it.reason === "SUBSCRIPTION_REQUIRED") {
            return { ...it, access_type: "SUBSCRIPTION" };
          }
          return it;
        };
  
        const nextItems: UIMusic[] = deduped.map((raw) => {
          const it = ensureAccessBadge(raw);
          if (!isActiveSub) return it;
          const needsSub =
            it.access_type === "SUBSCRIPTION" || it.locked || it.reason === "SUBSCRIPTION_REQUIRED";
          return needsSub ? { ...it, access_type: "SUBSCRIPTION", locked: false, reason: undefined } : it;
        });
  
        // ★ 여기서도 최신 요청인지 한 번 더 체크
        if (mySeq !== reqSeqRef.current) return;
  
        if (replace) setItems(nextItems);
        else setItems((prev) => [...prev, ...nextItems]);
  
        // 태그 벌크 (여기도 최신 요청인지 체크)
        try {
          const ids = deduped.map((d) => d.id);
          if (ids.length) {
            const map = await fetchMusicTagsBulk(ids);
            if (mySeq !== reqSeqRef.current) return; // ★ 늦게 끝나면 무시
            const next: Record<number, string[]> = {};
            for (const id of ids) {
              const arr: MusicTagItem[] = (map as any)[id] || [];
              const out: string[] = [];
              const seen = new Set<string>();
              for (const t of arr) {
                const s = String((t as any).text || "").trim();
                if (!s) continue;
                const key = s.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(s);
              }
              if (out.length) next[id] = out;
            }
            if (replace) setTagsById(next);
            else setTagsById((prev) => ({ ...prev, ...next }));
          }
        } catch {}
  
        setCursor(((page.nextCursor ?? null) as any) ?? null);
        setHasMore(Boolean(page?.hasMore ?? page?.nextCursor != null));
      } catch (e: any) {
        setErr(e?.message || "목록을 불러오지 못했습니다.");
      } finally {
        // ★ 최신 요청만 inflight 종료
        if (mySeq === reqSeqRef.current) {
          inflightRef.current = false;
        }
      }
    },
    [
      cursor,
      hasMore,
      q,
      sortKey,
      serverCategoryId,
      selectedCategoryIds,
      selectedFormats,
      selectedMoodNames,
      isActiveSub,
    ],
  );
  const applyPaidUpgrade = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      // 1) 구독 상태 업데이트(네 백엔드 규격 맞춰서)
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/me/subscription-settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ plan: "standard", autoRenew: true }), // business면 바꿔
      });
  
      // 2) 새 JWT 발급(쿠키 갱신)
      await refreshAuth(); // /auth/refresh 호출
  
      // 3) 전역 me/overview 갱신
      await refreshMe();
  
      // 4) 리스트 첫 페이지부터 리로드
      setIsRefreshing(true);
      await fetchNext("first", true);
      setIsRefreshing(false);
  
      // 5) 모달 닫기
      setShowSubscribeModal(false);
    } finally {
      setUpgrading(false);
    }
  };
  

  const depsKey = useMemo(
      () =>
        JSON.stringify({
          q,
          sortKey,
          category: sp.get("category"),
          categories: sp.get("categories"),
          formats: sp.get("formats"),
          moods: sp.get("moods"),
          isActiveSub,
        }),
      [q, sortKey, sp, isActiveSub],
    );
  useEffect(() => {
    setIsRefreshing(true);
    fetchNext("first", true).finally(() => setIsRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  const handleSubscribe = async (musicId: number) => {
    try {
      const res = await useMusic(musicId);
      if (res.isUsing) {
        setModalItem((prev) => (prev ? { ...prev, isSubscribed: true } : prev));
      }
    } catch (e) {
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
  
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === "reload";
  
    if (isReload) {
      const next = new URLSearchParams(sp.toString());
      next.delete("moods");
      next.delete("categories");
      next.delete("category");
      next.delete("formats");
      next.delete("cursor");
      next.set("filtersReset", "1");
  
      startTransition(() => router.replace("?" + next.toString(), { scroll: false }));
    }
  }, []);


  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        fetchNext(cursor === "first" ? "first" : undefined);
      },
      {
        root: null,
        rootMargin: "200px 0px",
        threshold: 0,
      },
    );

    observerRef.current.observe(node);
    return () => observerRef.current?.disconnect();
  }, [fetchNext, cursor]);



  const openDetail = async (m: UIMusic) => {
    if (m.locked) {
      if (m.reason === "LOGIN_REQUIRED") setShowLoginModal(true);
      else if (m.reason === "SUBSCRIPTION_REQUIRED") setShowSubscribeModal(true);
      return;
    }

    try {
      const d = await fetchMusicDetail(m.id);
                const rawAccess =
            (d as any).access_type ??
            (d as any).accessType ??
            (d as any).access ??
            (d as any).access_level ??
            m.access_type;

        const inferredFromFlags =
          ((d as any).locked ?? (d as any).is_locked ?? m.locked) ||
          ((d as any).reason ?? m.reason) === "SUBSCRIPTION_REQUIRED"
            ? "SUBSCRIPTION"
            : undefined;

      const detail: MusicDetail = {
        id: d.id,
        title: d.title,
        artist: d.artist,
        cover: d.cover_image_url ?? m.cover,
        lyrics: d.lyrics_text ?? "가사 준비중...\n\n(상세 API 연결됨)",
        company: { id: 0, name: "—" },
        isSubscribed: !!d.is_using,
        lyricsDownloadCount: d.lyrics_download_count ?? 0,
        category: d.category_name ?? m.category ?? null,
        access_type: normalizeAccess(inferredFromFlags ?? rawAccess, d),
        locked: Boolean((d as any).locked ?? (d as any).is_locked ?? m.locked),
        reason: (d as any).reason ?? m.reason,
      };
      setModalItem(detail);
      setUsage({
        perRead: Number(d.reward?.reward_one ?? m.reward_amount ?? 0),
        monthlyTotal: Number(d.reward?.reward_total ?? m.reward_total ?? 0),
        remaining: Number(d.reward?.reward_remain ?? m.reward_remaining ?? 0),
      });
      setModalOpen(true);
    } catch (e: any) {
      const msg = e?.body?.message || e?.message;
      if (e?.status === 401 || msg === "LOGIN_REQUIRED") {
        setShowLoginModal(true);
        return;
      }
      if (e?.status === 403 || msg === "SUBSCRIPTION_REQUIRED") {
        setShowSubscribeModal(true);
        return;
      }
      const d: MusicDetail = {
        id: m.id,
        title: m.title,
        artist: m.artist,
        cover: m.cover,
        lyrics: "가사/설명은 상세 API로 교체하세요.",
        company: { id: 1, name: "MPS Music" },
        isSubscribed: false,
      };
      setModalItem(d);
      setUsage({
        perRead: m.reward_amount ?? 0,
        monthlyTotal: m.reward_total ?? 0,
        remaining: m.reward_remaining ?? 0,
      });
      setModalOpen(true);
    }
  };

  return (
    <>
      <div className="mb-3 flex justify-center px-2 sm:px-0">
        <MusicSearch
          value={searchInput}
          onChange={setSearchInput}
          onSearch={(next) => patchParams({ q: next })}
        />
      </div>

      <div className="mb-2 flex justify-end px-2 sm:px-0">
        <SortDropdown
          open={sortOpen}
          setOpen={setSortOpen}
          sortKey={sortKey}
          onSelect={(v) => patchParams({ sort: v })}
          allowedKeys={["popular", "latest", "remainderReward", "totalReward", "rewardOne"]}
        />
      </div>

      <FilterBar
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        selectedFormats={selectedFormats}
        selectedMoods={selectedMoodNames}
        moodItems={moodItems}
        onChange={(p) => patchParams(p)}
      />

      {err && !items.length ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white/70 p-6 text-center text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          {err}
        </div>
      ) : null}

      <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white/70 dark:divide-white/10 dark:border-white/10 dark:bg-white/5">
        {items.map((m) => {
          const tags = tagsById[m.id] ?? m.tags ?? [];
          const hasReward =
            (m.reward_amount ?? 0) > 0 ||
            (m.reward_total ?? 0) > 0 ||
            (m.reward_remaining ?? 0) > 0;

          return (
            <li
              key={m.id}
              onClick={() => openDetail(m)}
              className="group flex flex-col sm:flex-row cursor-pointer items-start sm:items-stretch gap-2 p-2 transition hover:bg-white dark:hover:bg-white/10 select-none" /* 모바일 세로, 데스크톱 가로 */
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="relative shrink-0">
                <img
                  src={resolveImageUrl(m.cover ?? "", "music")}
                  alt={`${m.title} cover`}
                  className="h-16 w-16 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-white/10 pointer-events-none select-none"
                  draggable={false}
                />

                {m.format && (
                  <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/70 px-1.5 py-[2px] text-[10px] font-semibold text-white">
                    {m.format === "Inst" ? "INST" : "FULL"}
                  </span>
                )}

                {m.locked && (
                  <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-md bg-black/45">
                    <span className="rounded bg-black/70 px-1.5 py-[2px] text-[10px] leading-none text-white">
                      {m.reason === "LOGIN_REQUIRED" ? "로그인이 필요합니다" : "구독 전용"}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2"> {/* 모바일 줄바꿈 */}
                  <div className="min-w-0 flex items-center gap-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-white">
                      {m.title}
                    </h3>

                    <div className="shrink-0 flex flex-wrap items-center gap-1">
                      {m.category && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-800 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100">
                          {m.category}
                        </span>
                      )}
                      {m.format && (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-800 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100">
                          {m.format === "Inst" ? "INST" : "FULL"}
                        </span>
                      )}
                      {(() => {
                        const accessForBadge =
                          m.access_type ??
                          ((m.locked || m.reason === "SUBSCRIPTION_REQUIRED") ? "SUBSCRIPTION" : undefined);

                        return accessForBadge ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
                              accessForBadge === "FREE"
                                ? "border border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "border border-indigo-300 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                            }`}
                          >
                            {accessForBadge === "FREE" ? "무료" : "구독"}
                          </span>
                        ) : null;
                      })()}
                      {hasReward && (m.reward_remaining ?? 1) > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                          리워드
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 mt-1 sm:mt-0 flex flex-wrap items-center gap-1">
                    {m.reward_amount != null && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                        1회 {m.reward_amount}
                      </span>
                    )}
                    {m.reward_total != null && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        총 {m.reward_total}
                      </span>
                    )}
                    {m.reward_remaining != null && (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-300">
                        남음 {m.reward_remaining}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-white/60">
                  {m.artist}
                </div>

                {Array.isArray(tags) && tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {tags.slice(0, 6).map((t, idx) => (
                      <span
                        key={`${m.id}-${t}-${idx}`}
                        className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {items.length > 0 && hasMore && !inflightRef.current && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => fetchNext()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15"
          >
            더보기 (다음 {PAGE_SIZE}개)
          </button>
        </div>
      )}

      <div ref={sentinelRef} className="h-6 w-full" />

      <MusicDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={modalItem}
        myPlaylists={[]}
        onSubscribe={handleSubscribe}
        usage={usage}
      />

      {showLoginModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow">
            <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">로그인이 필요합니다</h4>
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/70">
              이 트랙은 로그인 후 이용할 수 있어요.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-1.5 text-sm border border-zinc-300 dark:border-white/20"
                onClick={() => setShowLoginModal(false)}
              >
                닫기
              </button>
              <a
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm bg-zinc-900 text-white dark:bg-white dark:text-black"
              >
                로그인하기
              </a>
            </div>
          </div>
        </div>
      )}

{showSubscribeModal && (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
    <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow">
      <h4 className="text-lg font-semibold text-zinc-900 dark:text-white">구독이 필요합니다</h4>
      <p className="mt-2 text-sm text-zinc-600 dark:text-white/70">
        업그레이드(스탠다드/비즈니스) 구독 후 사용하실 수 있어요.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-lg px-3 py-1.5 text-sm border border-zinc-300 dark:border-white/20"
          onClick={() => setShowSubscribeModal(false)}
        >
          닫기
        </button>
        <button
          className="rounded-lg px-3 py-1.5 text-sm bg-indigo-600 text-white dark:bg-indigo-500 disabled:opacity-60"
          onClick={applyPaidUpgrade}
          disabled={upgrading}
        >
          {upgrading ? "처리중..." : "지금 업그레이드"}
        </button>
      </div>
    </div>
  </div>
)}

    </>
  );
}

function SortDropdown({
  open,
  setOpen,
  sortKey,
  onSelect,
  allowedKeys,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sortKey: SortKey;
  onSelect: (v: SortKey) => void;
  allowedKeys?: SortKey[];
}) {
  const keys = allowedKeys ?? (Object.keys(SORT_LABELS) as SortKey[]);
  return (
    <div className="relative z-30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-white/20"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {SORT_LABELS[sortKey]}
        <LuChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-md dark:border-white/10 dark:bg-zinc-800" /* z-40로 모바일 팝업 가림 방지 */
        >
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => {
                onSelect(k);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-white/10 ${
                sortKey === k ? "font-semibold text-teal-600 dark:text-teal-400" : ""
              }`}
              role="menuitem"
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterBar({
  categories,
  selectedCategoryIds,
  selectedFormats,
  selectedMoods,
  moodItems,
  onChange,
}: {
  categories: Category[];
  selectedCategoryIds: string[];
  selectedFormats: FormatLabel[];
  selectedMoods: string[];
  moodItems: string[];
  onChange: (p: { categories?: string[]; formats?: string[]; moods?: string[] }) => void;
}) {
  const [open, setOpen] = useState<null | "moods" | "categories" | "formats">(null);

  const toggle = (arr: string[], val: string) => {
    const s = new Set(arr);
    s.has(val) ? s.delete(val) : s.add(val);
    return Array.from(s);
  };

  return (
    <section className="rounded-xl">
      <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 gap-2 px-2 sm:px-0"> 
        <button
          className={`h-10 rounded-lg text-sm transition-colors ${
            open === "moods"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white/90 dark:hover:bg-zinc-800"
          }`}
          onClick={() => setOpen(open === "moods" ? null : "moods")}
        >
          분위기
        </button>
        <button
          className={`h-10 rounded-lg text-sm transition-colors ${
            open === "categories"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white/90 dark:hover:bg-zinc-800"
          }`}
          onClick={() => setOpen(open === "categories" ? null : "categories")}
        >
          장르
        </button>
        <button
          className={`h-10 rounded-lg text-sm transition-colors ${
            open === "formats"
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white/90 dark:hover:bg-zinc-800"
          }`}
          onClick={() => setOpen(open === "formats" ? null : "formats")}
        >
          형식
        </button>
      </div>

      <div className="mt-2 space-y-2 px-2 sm:px-0">
        {/* 분위기 */}
        {moodItems.length > 0 && (
      // FilterBar 컴포넌트 내부

// ...중략...
<Accordion open={open === "moods"}>
  <TagGridString
    items={moodItems}
    selected={selectedMoods}
    onToggle={(v) => {
      onChange({ moods: toggle(selectedMoods, v) });
      // setOpen(null); // 변경 시 닫기
    }}
    onClear={() => {
      onChange({ moods: [] });
      setOpen(null); // 초기화 시 닫기
    }}
  />
</Accordion>
 )}
<Accordion open={open === "categories"}>
  <TagGridCategory
    items={categories}
    selectedIds={selectedCategoryIds}
    onToggle={(id) => {
      onChange({ categories: toggle(selectedCategoryIds, String(id)) });
      // setOpen(null);
    }}
    onClear={() => {
      onChange({ categories: [] });
      setOpen(null);
    }}
  />
</Accordion>
       
<Accordion open={open === "formats"}>
  <TagGridString
    items={[...FORMATS]}
    selected={selectedFormats}
    onToggle={(v) => {
      onChange({ formats: toggle(selectedFormats, v) });
      // setOpen(null);
    }}
    onClear={() => {
      onChange({ formats: [] });
      setOpen(null);
    }}
  />
</Accordion>

      </div>

      {selectedMoods.length || selectedCategoryIds.length || selectedFormats.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 px-2 sm:px-0"> 
                       {selectedMoods.map((m, idx) => (
                <span
                  key={`mood-${m}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-500/15 px-2.5 py-1 text-xs text-teal-700 dark:bg-teal-500/20 dark:text-teal-300"
                >
                  {m}
                  <button
                    className="ml-1 rounded px-1 hover:bg-teal-500/20 dark:hover:bg-teal-500/25"
                    onClick={() => onChange({ moods: selectedMoods.filter((x) => x !== m) })}
                  >
                    ✕
                  </button>
                </span>
              ))}

              {selectedCategoryIds.map((cid, idx) => {
                const label =
                  categories.find((c) => String(c.category_id) === cid)?.category_name ?? cid;
                return (
                  <span
                    key={`cat-${cid}-${idx}`}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-200 px-2.5 py-1 text-xs text-zinc-800 dark:bg-white/10 dark:text-zinc-200"
                  >
                    {label}
                    <button
                      className="ml-1 rounded px-1 hover:bg-zinc-300 dark:hover:bg-white/15"
                      onClick={() =>
                        onChange({
                          categories: selectedCategoryIds.filter((x) => x !== cid),
                        })
                      }
                    >
                      ✕
                    </button>
                  </span>
                );
              })}

              {selectedFormats.map((f, idx) => (
                <span
                  key={`fmt-${f}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                >
                  {f}
                  <button
                    className="ml-1 rounded px-1 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/25"
                    onClick={() => onChange({ formats: selectedFormats.filter((x) => x !== f) })}
                  >
                    ✕
                  </button>
                </span>
              ))}

              <button
                className="ml-1 inline-flex items-center rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-white/10"
                onClick={() => onChange({ moods: [], categories: [], formats: [] })}
              >
                모두 지우기
              </button>
            </div>
          ) : null}
        </section>
  );
}


function Accordion({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`overflow-hidden transition-[max-height] duration-300 ease-out ${open ? "max-h-[520px]" : "max-h-0"}`}
      style={{ willChange: "max-height" as any }}
    >
      <div className="rounded-xl border border-zinc-200 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5">
        {children}
      </div>
    </div>
  );
}

function TagGridString({
  items,
  selected,
  onToggle,
  onClear,
}: {
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <ul className="flex flex-wrap gap-2 p-1">
        {items.map((it, idx) => {
          const active = selected.includes(it);
          return (
            <li key={`${it}-${idx}`}>
              <button
                type="button"
                onClick={() => onToggle(it)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  active
                    ? "bg-teal-500 text-black shadow-sm"
                    : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                }`}
              >
                {it}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex justify-end px-1">
        <button
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          전체 해제
        </button>
      </div>
    </>
  );
}

function TagGridCategory({
  items,
  selectedIds,
  onToggle,
  onClear,
}: {
  items: Category[];
  selectedIds: string[];
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  return (
    <>
      <ul className="flex flex-wrap gap-2 p-1">
        {items.map((c, idx) => {
          const id = String(c.category_id);
          const active = selectedIds.includes(id);
          return (
            <li key={`${id}-${idx}`}>
              <button
                type="button"
                onClick={() => onToggle(c.category_id)}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  active
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15"
                }`}
                title={`#${c.category_name}`}
              >
                {c.category_name}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex justify-end px-1">
        <button
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/10"
        >
          전체 해제
        </button>
      </div>
    </>
  );
}

