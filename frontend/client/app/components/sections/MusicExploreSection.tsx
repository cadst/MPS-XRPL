// app/components/sections/MusicExploreSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { fetchCategories, fetchMusics, fetchMusicDetail, useMusic } from '@/lib/api/musics';
import type { Category } from '@/lib/types/music';
import MusicDetailModal, { type MusicDetail } from '../sections/MusicDetailModal';

import { getExploreSections, type ExploreTrack } from '@/lib/api/explone';
import { resolveImageUrl } from '@/app/utils/resolveImageUrl';

import { fetchMusicTagsBulk, type MusicTagItem } from '@/lib/api/musics';
import { useMeOverview } from '@/hooks/useMeOverview';

/* ---------------- Types ---------------- */
type Tone = 'emerald' | 'amber' | 'sky';
type AccessReason = 'OK' | 'LOGIN_REQUIRED' | 'SUBSCRIPTION_REQUIRED';
type Item = {
  id: number;
  cover: string;
  title: string;
  subtitle: string;
  playCount: number;   // 1회 리워드
  monthTotal: number;  // 총 리워드
  remain: number;      // 남은 리워드
  category?: string;
  tags?: string[];
  format?: 'FULL' | 'INSTRUMENTAL';
  price?: number | null;

  access_type?: 'FREE' | 'SUBSCRIPTION';
  locked?: boolean;
  reason?: AccessReason;
  reward_type?: 'REWARD' | 'NO_REWARD';
  reward_active?: boolean;
};
type BadgeProps = { tone?: Tone; children: React.ReactNode; shine?: boolean; className?: string };
type CardProps = Item & { onOpen?: (it: Item) => void };
type ShelfProps = {
  title: string;
  subtitle?: string;
  items: Item[];
  loading?: boolean;
  pending?: boolean;
  onOpen?: (it: Item) => void;
  autoFlow?: boolean;
  intervalMs?: number;
};
type ChipProps = { active?: boolean; children: React.ReactNode; onClick?: () => void };
export type MusicExploreSectionProps = {
  newReleases?: Item[];
  charts?: Item[];
  moods?: Item[];
  showHero?: boolean;
  stickyTopOffset?: number;
};

/* ---------------- Helpers ---------------- */
const FALLBACK_TAGS = ['Chill', 'Focus', 'Night'];
const MAX_TAGS = 5;

function tagsToLabels(arr?: MusicTagItem[]): string[] {
  if (!arr) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr) {
    const s = String(t.text || '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

async function attachTagsToItems(items: Item[], setItems: (v: Item[]) => void) {
  if (!Array.isArray(items) || items.length === 0) return;

  const need = items.some(i =>
    !Array.isArray(i.tags) || i.tags.length === 0 || i.tags === FALLBACK_TAGS
  );
  if (!need) return;

  try {
    const ids = items.map(i => i.id);
    const map = await fetchMusicTagsBulk(ids); // { [music_id]: MusicTagItem[] }

    const next = items.map(it => {
      const labels = tagsToLabels(map[it.id]);

      const finalTags =
        labels.length > 0
          ? labels
          : (Array.isArray(it.tags) && it.tags.length > 0
              ? [...it.tags]
              : [...FALLBACK_TAGS]);

      return { ...it, tags: finalTags };
    });

    setItems(next);
  } catch (e) {
    console.warn('[attachTagsToItems] 실패, fallback 유지', e);
  }
}


/** 구독이면 SUBSCRIPTION 트랙만 잠금 해제 */
function applyUnlock(items: Item[], isActiveSub: boolean): Item[] {
  if (!isActiveSub) return items;
  return items.map(it =>
    it.access_type === 'SUBSCRIPTION'
      ? { ...it, locked: false, reason: 'OK' as AccessReason }
      : it
  );
}

function normalizeByAuth(it: Item, isLoggedIn: boolean, isActiveSub: boolean): Item {
  const access = it.access_type ?? 'SUBSCRIPTION'; // access_type 없으면 유료로 본다
  let locked = false as boolean;
  let reason: AccessReason = 'OK';

  if (access === 'FREE') {
    // 무료: 비회원만 잠금(=로그인 하세요)
    locked = !isLoggedIn;
    reason = locked ? 'LOGIN_REQUIRED' : 'OK';
  } else {
    // 구독: 비회원 → 로그인 요구 / 회원 비구독 → 구독 요구 / 구독중 → 해제
    if (!isLoggedIn)       { locked = true; reason = 'LOGIN_REQUIRED'; }
    else if (!isActiveSub) { locked = true; reason = 'SUBSCRIPTION_REQUIRED'; }
    else                   { locked = false; reason = 'OK'; }
  }
  return { ...it, locked, reason };
}

const toItemFromExplore = (t: ExploreTrack): Item => ({
  id: t.id,
  cover: t.cover_image_url ?? '/placeholder.png',
  title: t.title,
  subtitle: t.artist || 'Unknown',
  playCount: Number(t.reward.reward_one ?? 0),
  monthTotal: Number(t.reward.reward_total ?? 0),
  remain: Number(t.reward.reward_remain ?? 0),
  format: t.format,
  price: t.price_per_play ?? null,
  category: t.category_name ?? undefined,
  tags: FALLBACK_TAGS,
  access_type: t.access_type,
  locked: t.locked,
  reason: t.reason as AccessReason | undefined,
  reward_type: t.reward_type,
  reward_active: t.reward_active,
});

const Star: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={props.className}>
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.7 1.1 6.6L12 17.8 6.2 20.7l1.1-6.6L2.5 9.4l6.6-.9L12 2.5z" />
  </svg>
);

const Badge: React.FC<BadgeProps> = ({ tone = 'emerald', children, shine = false, className = '' }) => {
  const base =
    'relative inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] sm:text-[12px] font-medium leading-none whitespace-nowrap overflow-hidden';
  const toneCls =
    tone === 'emerald'
      ? ' bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
      : tone === 'amber'
      ? ' bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
      : ' bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300';
  return (
    <span className={`${base} ${toneCls} ${className}`}>
      {children}
      {shine && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shine bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      )}
    </span>
  );
};

/* ---------------- Card ---------------- */
const Card: React.FC<CardProps> = ({
  cover, title, subtitle, playCount, monthTotal, remain, onOpen, ...raw
}) => {
  const isReward = (raw as any).reward_type === 'REWARD';
  const price = (raw as any).price as number | null | undefined;
  const format = (raw as any).format as 'FULL' | 'INSTRUMENTAL' | undefined;

  return (
    <div
      className="
        group shrink-0 
        w-[280px] sm:w-[300px] md:w-[315px] lg:w-[320px]
        h-[380px] sm:h-[400px] md:h-[420px] lg:h-[440px]
        overflow-hidden rounded-xl sm:rounded-2xl 
        border border-black/5 dark:border-white/10
        bg-white dark:bg-zinc-900 shadow-sm transition hover:shadow-md
        snap-start flex flex-col
      "
      data-card
    >
      <button
        type="button"
        onClick={() =>
          onOpen?.({
            id: (raw as any).id,
            cover, title, subtitle, playCount, monthTotal, remain,
            category: (raw as any).category,
            tags: (raw as any).tags,
            access_type: (raw as any).access_type,
            locked: (raw as any).locked,
            reason: (raw as any).reason,
            reward_type: (raw as any).reward_type,
            reward_active: (raw as any).reward_active,
            format, price,
          })
        }
        className="block w-full text-left h-full flex flex-col relative"
      >
        {/* 이미지: 4:3 */}
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <img
            src={resolveImageUrl(cover, 'music')}
            alt={`${title} cover`}
            className="h-full w-full object-cover"
            loading="lazy"
          />

          <div className="absolute left-1.5 sm:left-2 top-1.5 sm:top-2 flex gap-1">
            {(raw as any).access_type && (
              <Badge tone={(raw as any).access_type === 'FREE' ? 'emerald' : 'sky'}>
                {(raw as any).access_type === 'FREE' ? '무료' : '구독'}
              </Badge>
            )}
            {(raw as any).reward_type === 'REWARD' && (
              <Badge tone="amber">{(raw as any).reward_active ? '리워드' : '리워드 소진'}</Badge>
            )}
          </div>

          {/* 우상단: Format + Category */}
          {(format || (raw as any).category) && (
            <div className="absolute right-1.5 sm:right-2 top-1.5 sm:top-2 z-20 flex items-center gap-1">
              {format && (
                <Badge tone="sky">{format === 'INSTRUMENTAL' ? 'Inst' : 'Full'}</Badge>
              )}
              {(raw as any).category && (
                <span className="inline-flex items-center rounded-full border border-zinc-200
                                dark:border-white/15 bg-white/90 dark:bg-black/40 backdrop-blur
                                px-1.5 sm:px-2 py-[2px] sm:py-[3px] text-[10px] sm:text-[12px] 
                                text-zinc-800 dark:text-white">
                  {(raw as any).category}
                </span>
              )}
            </div>
          )}

          {/* 호버/잠금 오버레이 */}
          <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
            <span className="rounded-full bg-black/70 px-3 sm:px-4 py-1.5 sm:py-2 text-xs tracking-wide text-white">
              자세히 보기
            </span>
          </span>
          {(raw as any).locked && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45">
              <span className="rounded-full bg-black/70 px-3 sm:px-4 py-1.5 sm:py-2 text-xs text-white text-center max-w-[90%]">
                {(raw as any).reason === 'LOGIN_REQUIRED' ? '로그인 하신 후에 사용 가능합니다' : '구독하면 사용 가능합니다'}
              </span>
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="p-3 sm:p-4 flex-1 flex flex-col">
          <div className="text-sm sm:text-[15px] font-semibold leading-snug line-clamp-2 min-h-[36px] sm:min-h-[42px] text-zinc-900 dark:text-white">
            {title}
          </div>
          <div className="mt-0.5 text-xs sm:text-[13px] text-zinc-500 dark:text-white/70 min-h-[16px] sm:min-h-[18px] overflow-hidden text-ellipsis whitespace-nowrap">
            {subtitle}
          </div>

          {/* 리워드 배지들 */}
          <div className="mt-2 sm:mt-3 flex items-center gap-1.5 min-h-[20px] sm:min-h-[24px] flex-wrap">
            {isReward && (
              <>
                <Badge tone="emerald">
                  <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">1회 {playCount}</span>
                  <span className="sm:hidden">{playCount}</span>
                </Badge>
                <Badge tone="amber">
                  <span className="hidden sm:inline">월총 {monthTotal}</span>
                  <span className="sm:hidden">{monthTotal}</span>
                </Badge>
                <Badge tone="sky">
                  <span className="hidden sm:inline">남음 {remain}</span>
                  <span className="sm:hidden">{remain}</span>
                </Badge>
              </>
            )}
          </div>

          {/* 태그 줄 */}
          <div className="mt-auto flex flex-wrap gap-1 sm:gap-1.5 min-h-[24px] sm:min-h-[28px]">
            {Array.isArray((raw as any).tags) && (() => {
              const MAX_CARD_TAGS = 3;
              const tags: string[] = (raw as any).tags
                .map((t: any) => String(t ?? '').trim())
                .filter(Boolean);
              const seen = new Set<string>();
              const labels: string[] = [];
              for (const tag of tags) {
                const key = tag.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                labels.push(tag);
                if (labels.length >= MAX_CARD_TAGS) break;
              }
              return labels.map((t, idx) => (
                <span
                  key={`${(raw as any).id}-${idx}-${t.toLowerCase()}`}
                  className="inline-flex items-center rounded-full border border-zinc-200 
                           dark:border-white/15 bg-white dark:bg-white/10 
                           px-1.5 sm:px-2 py-[2px] sm:py-[3px] 
                           text-[10px] sm:text-[12px] text-zinc-700 dark:text-white/80"
                >
                  #{t}
                </span>
              ));
            })()}
          </div>
        </div>
      </button>
    </div>
  );
};

/* ---------------- Shelf ---------------- */
const Shelf: React.FC<ShelfProps> = ({
  title, subtitle, items, loading, pending=false, onOpen,
  autoFlow=true, intervalMs=2000,
}) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const uniqItems = useMemo(() => {
    const seen = new Set<number>();
    return (items ?? []).filter(it => {
      if (seen.has(it.id)) return false;
      seen.add(it.id);
      return true;
    });
  }, [items]);

  const shouldLoop = autoFlow && uniqItems.length >= 8;
  const loopItems = useMemo(
    () => (shouldLoop ? [...uniqItems, ...uniqItems] : uniqItems),
    [uniqItems, shouldLoop]
  );

  const moveByOne = (dir: 'left' | 'right' = 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('[data-card]');
    if (!first) return;

    const rect = first.getBoundingClientRect();
    const gapPx = parseInt(getComputedStyle(el).columnGap || '16', 10) || 16;
    const step = rect.width + gapPx;

    el.scrollBy({ left: dir === 'right' ? step : -step, behavior: 'smooth' });

    if (!shouldLoop) return;
    const half = el.scrollWidth / 2;
    window.setTimeout(() => {
      if (el.scrollLeft >= half - step) {
        const prev = (el as any).style.scrollBehavior;
        (el as any).style.scrollBehavior = 'auto';
        el.scrollLeft = el.scrollLeft - half + step;
        (el as any).style.scrollBehavior = prev || '';
      } else if (el.scrollLeft <= 0) {
        const prev = (el as any).style.scrollBehavior;
        (el as any).style.scrollBehavior = 'auto';
        el.scrollLeft = el.scrollLeft + half - step;
        (el as any).style.scrollBehavior = prev || '';
      }
    }, 350);
  };

  const scrollByButton = React.useCallback((dir: 'left' | 'right') => {
    moveByOne(dir);
  }, []);

  useEffect(() => {
    if (!shouldLoop || loading || pending || uniqItems.length === 0) return;
    timerRef.current = window.setInterval(() => {
      if (!hoverRef.current) moveByOne('right');
    }, intervalMs) as unknown as number;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [shouldLoop, intervalMs, loading, pending, uniqItems.length]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-white/70 truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 sm:gap-2 ml-4">
          <button
            className="rounded-full border border-zinc-200 dark:border-white/15 
                     bg-white/90 dark:bg-white/10 backdrop-blur 
                     px-2.5 sm:px-3 py-1 text-sm text-zinc-700 dark:text-white/80 
                     shadow-sm hover:bg-zinc-50 dark:hover:bg-white/15 
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                     transition-colors"
            onClick={() => scrollByButton('left')}
            aria-label="왼쪽으로 스크롤"
          >
            ←
          </button>
          <button
            className="rounded-full border border-zinc-200 dark:border-white/15 
                     bg-white/90 dark:bg-white/10 backdrop-blur 
                     px-2.5 sm:px-3 py-1 text-sm text-zinc-700 dark:text-white/80 
                     shadow-sm hover:bg-zinc-50 dark:hover:bg-white/15 
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                     transition-colors"
            onClick={() => scrollByButton('right')}
            aria-label="오른쪽으로 스크롤"
          >
            →
          </button>
        </div>
      </div>

      <div className="relative">
        {loading && (!items || items.length === 0) ? (
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[280px] sm:w-[300px] md:w-[315px] lg:w-[320px] 
                         h-[200px] sm:h-[220px] md:h-[236px] lg:h-[250px] 
                         rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 
                         bg-zinc-100 dark:bg-white/10 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div
            ref={scrollerRef}
            onMouseEnter={() => (hoverRef.current = true)}
            onMouseLeave={() => (hoverRef.current = false)}
            className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory 
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-opacity"
            style={{ opacity: pending ? 0.6 : 1 }}
          >
            {loopItems.map((t, idx) => (
              <div key={`${t.id}-${idx}`} data-card>
                <Card {...t} onOpen={onOpen} />
              </div>
            ))}
          </div>
        )}

        {pending && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-6 w-6 sm:h-8 sm:w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent dark:border-white/40 dark:border-t-transparent" />
          </div>
        )}
      </div>
    </section>
  );
};

/* ---------------- Chip ---------------- */
const Chip: React.FC<ChipProps> = ({ active = false, children, onClick }) => (
  <button
    onClick={onClick}
    className={
      'inline-flex items-center gap-1 rounded-full border px-2.5 sm:px-3 py-1 ' +
      'text-xs sm:text-sm transition-colors whitespace-nowrap ' +
      (active
        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/15 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/15')
    }
  >
    {children}
  </button>
);

/* ---------------- Main Section ---------------- */
export default function MusicExploreSection({
  newReleases,
  charts,
  moods,
  showHero = true,
  stickyTopOffset = 70,
}: MusicExploreSectionProps) {
  const [loadingNew, setLoadingNew] = useState(!newReleases);
  const [loadingCharts, setLoadingCharts] = useState(!charts);
  const [loadingMoods, setLoadingMoods] = useState(!moods);
  const [catLoading, setCatLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [dataNew, setDataNew] = useState<Item[]>(newReleases ?? []);
  const [dataCharts, setDataCharts] = useState<Item[]>(charts ?? []);
  const [dataMoods, setDataMoods] = useState<Item[]>(moods ?? []);

  const [isChartsPending, startChartsTransition] = useTransition();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<MusicDetail | null>(null);
  const [usage, setUsage] = useState<{ perRead: number; monthlyTotal: number; remaining: number }>();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // 카테고리 목록(칩용)
  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
        setActiveCat(cats[0]?.category_name ?? null);
      } catch (e) {
        console.error('[MusicExploreSection] fetchCategories 실패', e);
      } finally {
        setCatLoading(false);
      }
    })();
  }, []);

  const { data: overview, refresh: refreshOverview } = useMeOverview();

  const isLoggedIn = useMemo(() => {
    const o = overview as any;
  
    if (o?.isLoggedIn === true || o?.loggedIn === true) return true;
  
    if (o?.user?.id || o?.me?.id || o?.id) return true;
    if (o?.user?.email || o?.me?.email || o?.email) return true;
  
    return false;
  }, [overview]);
  const isActiveSub = useMemo(() => {
    const s = String(overview?.subscription?.status ?? 'none').toLowerCase();
    const days = Number(overview?.subscription?.remainingDays ?? 0);
    const plan = String(overview?.subscription?.plan ?? 'free').toLowerCase();
    return s === 'active' || s === 'trialing' || days > 0 || plan !== 'free';
  }, [overview]);

  useEffect(() => {
    const h = () => refreshOverview?.();
    window.addEventListener('mps:me:overview:changed', h);
    return () => window.removeEventListener('mps:me:overview:changed', h);
  }, [refreshOverview]);

  // explore 섹션 로드
  useEffect(() => {
    if (newReleases && charts && moods) return;
    (async () => {
      try {
        if (!newReleases) setLoadingNew(true);
        if (!charts) setLoadingCharts(true);
        if (!moods) setLoadingMoods(true);

        const data = await getExploreSections();
        if (!newReleases) setDataNew(applyUnlock(data.news.items.map(toItemFromExplore), isActiveSub));
        if (!charts) setDataCharts(applyUnlock(data.charts.items.map(toItemFromExplore), isActiveSub));
        if (!moods) setDataMoods(applyUnlock(data.moods.items.map(toItemFromExplore), isActiveSub));
      } catch (e) {
        console.error('[MusicExploreSection] getExploreSections 실패', e);
      } finally {
        if (!newReleases) setLoadingNew(false);
        if (!charts) setLoadingCharts(false);
        if (!moods) setLoadingMoods(false);
      }
    })();
  }, [newReleases, charts, moods, isActiveSub]);

  // 태그 부착
  useEffect(() => {
    if (!loadingNew && dataNew.length) attachTagsToItems(dataNew, setDataNew);
  }, [loadingNew, dataNew]);
  useEffect(() => {
    if (!loadingCharts && dataCharts.length) attachTagsToItems(dataCharts, setDataCharts);
  }, [loadingCharts, dataCharts]);
  useEffect(() => {
    if (!loadingMoods && dataMoods.length) attachTagsToItems(dataMoods, setDataMoods);
  }, [loadingMoods, dataMoods]);

  // 구독 변동 시 unlock 반영 (초기/무드/차트 섹션 유지용)
  useEffect(() => { setDataNew(v => applyUnlock(v, isActiveSub)); }, [isActiveSub]);
  useEffect(() => { setDataMoods(v => applyUnlock(v, isActiveSub)); }, [isActiveSub]);

  useEffect(() => {
    setDataCharts(prev => prev.map(it => normalizeByAuth(it, isLoggedIn, isActiveSub)));
  }, [isLoggedIn, isActiveSub]);

  // 카테고리 클릭
  const onClickCategory = async (c: Category) => {
    const label = c.category_name ?? String(c.category_id);
    setActiveCat(label);
  
    startChartsTransition(async () => {
      try {
        const { items } = await fetchMusics({
          category: c.category_id,
          sort: 'most_played',
          limit: 12,
        });
  
        // 1) 서버 locked/reason 무시하고 access만 정규화(없으면 추정)
        const mapped: Item[] = items.map((m: any) => {
          const access: 'FREE' | 'SUBSCRIPTION' =
            m.access_type === 'FREE' || m.access_type === 'SUBSCRIPTION'
              ? m.access_type
              : (
                  m.is_free === true ||
                  m.price_per_play === 0 ||
                  (m.reward_type === 'REWARD' && (m.reward?.reward_one ?? m.reward_amount) === 0) ||
                  (Array.isArray(m.tags) && m.tags.some((t: string) => String(t).toLowerCase().includes('무료')))
                )
              ? 'FREE'
              : 'SUBSCRIPTION';
  
          return {
            id: m.id,
            cover: m.cover ?? m.cover_image_url ?? '/placeholder.png',
            title: m.title,
            subtitle: m.artist || 'Unknown',
            playCount: Number(m.reward?.reward_one ?? m.reward_amount ?? 0),
            monthTotal: Number(m.reward?.reward_total ?? 0),
            remain: Number(m.reward?.reward_remain ?? m.reward_remaining ?? 0),
            category: m.category_name ?? m.category ?? undefined,
            tags: FALLBACK_TAGS,
  
            access_type: access,
            locked: undefined,
            reason: undefined,
  
            reward_type: m.reward_type,
            reward_active: m.reward_active,
            format: m.format,
            price: m.price_per_play ?? null,
          };
        });
  
        // 2) 현재 로그인/구독 상태로 잠금/문구 재계산
        const normalized = mapped.map(it => normalizeByAuth(it, isLoggedIn, isActiveSub));
  
        // 3) 반영 + 태그 붙이기 (반드시 normalized 기준)
        setDataCharts(normalized);
        attachTagsToItems(normalized, setDataCharts);
      } catch (e) {
        console.error('[MusicExploreSection] fetchMusics(category) 실패', e);
      }
    });
  };
  

  const categoryChips = useMemo(
    () =>
      (categories ?? []).map((c) => {
        const label = c.category_name ?? String(c.category_id);
        const active = activeCat === label;
        return (
          <Chip key={c.category_id} active={active} onClick={() => onClickCategory(c)}>
            #{label}
          </Chip>
        );
      }),
    [categories, activeCat]
  );

  // modal open → 상세 API 조회
  const openModalFromItem = async (it: Item) => {
    // 구독 중이면 SUBSCRIPTION 트랙 잠금 해제
    if (isActiveSub && it.access_type === 'SUBSCRIPTION') {
      it = { ...it, locked: false, reason: 'OK' };
    }

    if (it.locked) {
      if (it.reason === 'LOGIN_REQUIRED') setShowLoginModal(true);
      else if (it.reason === 'SUBSCRIPTION_REQUIRED') setShowSubscribeModal(true);
      return;
    }

    try {
      const d = await fetchMusicDetail(it.id);
      const detail: MusicDetail = {
        id: d.id,
        title: d.title,
        artist: d.artist,
        cover: d.cover_image_url ?? it.cover,
        lyrics: d.lyrics_text ?? '가사 준비중...\n\n(상세 API 연결됨)',
        company: { id: 0, name: '—' },
        isSubscribed: !!d.is_using,
        lyricsDownloadCount: d.lyrics_download_count ?? 0,
        category: d.category_name ?? it.category ?? null,
      };
      setModalItem(detail);
      setUsage({
        perRead: Number(d.reward?.reward_one ?? it.playCount ?? 0),
        monthlyTotal: Number(d.reward?.reward_total ?? it.monthTotal ?? 0),
        remaining: Number(d.reward?.reward_remain ?? it.remain ?? 0),
      });
      setModalOpen(true);
    } catch (e: any) {
      console.error('[openModalFromItem] fetchMusicDetail 실패', e);
      if (e?.status === 401 || e?.body?.message === 'LOGIN_REQUIRED') {
        setShowLoginModal(true);
        return;
      }
      if (e?.status === 403 || e?.body?.message === 'SUBSCRIPTION_REQUIRED') {
        setShowSubscribeModal(true);
        return;
      }
      const fallback: MusicDetail = {
        id: it.id,
        title: it.title,
        artist: it.subtitle,
        cover: it.cover,
        lyrics: '가사 준비중...',
        company: { id: 0, name: '—' },
        isSubscribed: false,
        category: it.category ?? null,
      };
      setModalItem(fallback);
      setUsage({ perRead: it.playCount, monthlyTotal: it.monthTotal, remaining: it.remain });
      setModalOpen(true);
    }
  };

  // "사용하기" → POST /musics/:id/use
  const handleSubscribe = async (musicId: number) => {
    try {
      const res = await useMusic(musicId);
      if (res.isUsing) {
        setModalItem((prev) => (prev ? { ...prev, isSubscribed: true } : prev));
      }
    } catch (e) {
      console.error('[useMusic] 실패', e);
    }
  };

  const handleAddToPlaylist = async (musicId: number, playlistId: number) => {
    console.log('addToPlaylist', { musicId, playlistId });
  };
  const handleCreatePlaylist = async (name: string) => {
    return { id: Math.floor(Math.random() * 1e6), name };
  };

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      <style>{`@keyframes shine { to { transform: translateX(200%); } } .animate-shine { animation: shine 1.8s infinite; }`}</style>

      {/* hero */}
      {showHero && (
        <div className="mb-6 sm:mb-8 overflow-hidden rounded-2xl sm:rounded-3xl 
                      border border-zinc-200 dark:border-white/10 
                      bg-gradient-to-r from-indigo-50 via-sky-50 to-cyan-50 
                      dark:from-zinc-900 dark:via-zinc-800 dark:to-zinc-900 
                      p-4 sm:p-6 lg:p-8 text-zinc-900 dark:text-white shadow">
          <div className="flex flex-col gap-2">
            <span className="text-xs sm:text-sm leading-5 text-zinc-600 dark:text-white/70">
              둘러보기
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              지금 막 나온 트랙 · 카테고리별 차트 · 인기 급상승
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-white/70">
              섹션(선반)별 캐러셀로 탐색하세요.
            </p>
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
              <Badge tone="amber" shine>NEW 오늘 업데이트</Badge>
              <Badge tone="sky">장르 · 무드</Badge>
              <Badge tone="emerald">개인화 추천</Badge>
            </div>
          </div>
        </div>
      )}

      {/* sticky categories */}
      <div
        className="sticky z-10 mt-6 sm:mt-10 mb-4 sm:mb-5 
                 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 
                 bg-white/80 dark:bg-zinc-900/70 backdrop-blur 
                 p-2.5 sm:p-3"
        style={{ top: stickyTopOffset }}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-white/85">
            카테고리
          </h3>
        </div>
        <div className="mt-2 flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 
                      [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {catLoading
            ? [...Array(8)].map((_, i) => (
                <div key={i} className="h-7 sm:h-8 w-16 sm:w-20 shrink-0 rounded-full 
                                     bg-zinc-200 dark:bg-white/10 animate-pulse" />
              ))
            : categoryChips}
        </div>
      </div>

      {/* shelves */}
      <div className="space-y-8 sm:space-y-10">
        <Shelf
          title="새로 올라온 곡"
          subtitle="오늘 막 올라온 트랙"
          items={dataNew}
          loading={loadingNew}
          pending={false}
          onOpen={openModalFromItem}
          autoFlow
          intervalMs={3000}
        />
        <Shelf
          title="차트 Charts"
          subtitle={activeCat ? `카테고리: ${activeCat}` : '이번 주 인기'}
          items={dataCharts}
          loading={loadingCharts}
          pending={isChartsPending}
          onOpen={openModalFromItem}
          autoFlow
          intervalMs={3000}
        />
        <Shelf
          title="무드 & 장르 Moods & Genres"
          subtitle="상황별 추천"
          items={dataMoods}
          loading={loadingMoods}
          pending={false}
          onOpen={openModalFromItem}
          autoFlow
          intervalMs={3000}
        />
      </div>

      {/* 상세 모달 */}
      <MusicDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={modalItem}
        myPlaylists={[]}
        onSubscribe={handleSubscribe}
        usage={usage}
      />

      {/* 로그인 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-xs sm:max-w-sm rounded-xl sm:rounded-2xl 
                        bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow">
            <h4 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
              로그인이 필요합니다
            </h4>
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/70">
              이 트랙은 로그인 후 이용할 수 있어요.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-1.5 text-sm border border-zinc-300 dark:border-white/20 
                         hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors"
                onClick={() => setShowLoginModal(false)}
              >
                닫기
              </button>
              <a
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm bg-zinc-900 text-white 
                         dark:bg-white dark:text-black hover:bg-zinc-800 
                         dark:hover:bg-zinc-100 transition-colors"
              >
                로그인하기
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 구독 모달 (클래스 오타 수정: bg-зinc-900 → bg-zinc-900) */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-xs sm:max-w-sm rounded-xl sm:rounded-2xl 
                        bg-white dark:bg-zinc-900 p-4 sm:p-6 shadow">
            <h4 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white">
              구독이 필요합니다
            </h4>
            <p className="mt-2 text-sm text-zinc-600 dark:text-white/70">
              업그레이드(스탠다드/비즈니스) 구독 후 사용하실 수 있어요.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-1.5 text-sm border border-zinc-300 dark:border-white/20 
                         hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors"
                onClick={() => setShowSubscribeModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
