import { api } from "@/lib/api/core/http";
export type Category = { category_id: number; category_name: string };

// 서버가 내려주는 PopularMusicDto (요약)
export type RewardInfo = {
  reward_one: string | null;
  reward_total: string | null;
  reward_remain: string | null;
  total_count: number | null;
  remain_count: number | null;
};

export type MusicDetailApi = {
  id: number;
  title: string;
  artist: string;
  cover_image_url: string | null;
  format: 'FULL' | 'INSTRUMENTAL';
  has_lyrics: boolean;
  lyrics_text: string | null;
  lyrics_file_path: string | null;
  grade_required: 0|1|2;
  can_use: boolean;
  lyrics_download_count?: number | null;
  reward: {
    reward_one: string | null;
    reward_total: string | null;
    reward_remain: string | null;
    total_count: number | null;
    remain_count: number | null;
  };
  popularity: number;
  created_at: string;
  category_id: number | null;
  category_name: string | null;
  duration_sec: number | null;
  price_per_play: string | null;
  is_using: boolean;
};
export type MusicTagItem = {
  id: number;
  text: string;                       // 원문 태그
  raw_tag_id: number | null;          // 정규화 매핑된 id (없으면 null)
  canonical_name: string | null;      // 정규화 라벨
  canonical_slug: string | null;
  canonical_type: 'mood'|'genre'|'context'|null;
};

export type RawTagChip = {
  id: number;
  name: string;
  slug: string;
  type: 'mood'|'genre'|'context';
  mapped_count: number;               // 이 칩으로 매핑된 곡 수(정렬/뱃지용)
};
export type PopularMusicDto = {
  id: number;
  title: string;
  artist: string;
  cover_image_url?: string | null;
  cover?: string | null;
  format: 'FULL' | 'INSTRUMENTAL';
  has_lyrics: boolean;
  grade_required: 0 | 1 | 2;
  can_use: boolean;
  reward: RewardInfo;
  popularity: number;
  created_at: string | Date;

  // ⬇️ 서버 싱크
  category_id: number | null;
  category_name: string | null;
};

export type Music = PopularMusicDto & {
  // 프론트에서 편하게 쓰려고 cover 통일
  cover: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | number | null;
  hasMore: boolean;
};

// ── BASE URL ────────────────────────────────────────────────────────────────
const BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}`
    : 'http://localhost:4000');
// ── 공통 유틸 ───────────────────────────────────────────────────────────────
const qs = (o: Record<string, any>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function safeJson(r: Response) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${r.status} – invalid JSON: ${text?.slice(0, 200)}`);
  }
}

function pickArray<T = any>(obj: any, key: string): T[] | undefined {
  if (!obj) return undefined;
  if (Array.isArray(obj[key])) return obj[key];
  if (obj.data && Array.isArray(obj.data[key])) return obj.data[key];
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj)) return obj;
  return undefined;
}

function pickValue<T = any>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
    if (obj?.data && obj.data[k] !== undefined) return obj.data[k];
  }
  return undefined;
}

// 백엔드가 cover 또는 cover_image_url만 줄 수 있으니 cover 통일
function normalize(m: any): Music {
  const cover = (m.cover ?? m.cover_image_url ?? '') as string;
  return { ...m, cover };
}

// 필요 시 Authorization 헤더도 같이 실을 수 있게 훅
function authHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem('accessToken');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// 공통 fetch 옵션
function reqInit(extra?: RequestInit): RequestInit {
  return {
    cache: 'no-store',
    credentials: 'include',
    headers: { ...(extra?.headers || {}), ...authHeaders() },
    ...extra,
  };
}

// ── API 함수들 ──────────────────────────────────────────────────────────────

/** 카테고리 목록 */
export async function fetchCategories(): Promise<Category[]> {
  const r = await fetch(`${BASE}/musics/categories`, reqInit());
  if (!r.ok) throw new Error(`GET ${BASE}/musics/categories ${r.status}`);
  const j = await safeJson(r);

  const items = pickArray<Category>(j, 'items');
  if (Array.isArray(items)) return items;

  throw new Error(`Unexpected categories response: ${JSON.stringify(j).slice(0, 200)}`);
}

/**
 * 일반 목록/검색 API
 * - category: 숫자 ID 또는 문자열 ID를 서버에서 category_id로 받는다고 가정
 * - sort: 'new' | 'popular' → 서버 sort 키로 매핑
 * - cursor: 문자열/숫자 허용
 */
// 기존 시그니처 교체
export async function fetchMusics(params: {
  q?: string;
  // 단일/다중 카테고리 모두 지원
  category?: string | number;           // (하위호환)
  category_id?: string | number;        // (권장)
  categories?: Array<string | number>;

  // 무드/형식
  mood?: string;                         // (하위호환: 단일)
  moods?: string[];                      // (권장)
  formats?: Array<'Full' | 'Inst'>;

  // 검색 옵션
  mode?: 'keyword' | 'semantic';
  min_similarity?: number;
  status?: 'active' | 'inactive' | 'invalid';
  reward_max?: number;
  remaining_reward_max?: number;
  sort?:
    | 'new'
    | 'newest'
    | 'popular'
    | 'most_played'
    | 'remaining_reward'
    | 'relevance'
    | 'total_reward'
    | 'reward_one'
    | 'reward_total'
    | 'per_play_reward';
  limit?: number;
  cursor?: string | number | null;
}): Promise<Page<Music>> {
  const serverParams: Record<string, any> = {};

  if (params.q) serverParams.q = params.q;

  const catId = params.category_id ?? params.category;
  if (catId !== undefined) serverParams.category_id = catId;
  if (params.categories?.length) serverParams.categories = params.categories.join(',');

  if (params.mood) serverParams.mood = params.mood;
  if (params.moods?.length) serverParams.moods = params.moods.join(',');

  if (params.formats?.length) {
    console.log("[API] incoming formats (UI tokens) ▶", params.formats);
    const toServer = (v: string) =>
      v === "Inst" || v === "INSTRUMENTAL" ? "INSTRUMENTAL" : "FULL";

    const mapped = params.formats.map(toServer);
    const csv = mapped.join(",");

    // 서버가 'formats' CSV를 받는 경우
    serverParams.formats = csv;
    // 단일 선택이면 'format'도 같이 (서버가 단수 키만 보는 경우 대비)
    if (mapped.length === 1) {
      serverParams.format = mapped[0];
    }

    console.log("[API] mapped formats (server CSV) ▶", csv);
    if (mapped.length === 1) {
      console.log("[API] single format (server) ▶", serverParams.format);
    }
  }

  if (params.mode) serverParams.mode = params.mode;
  if (params.min_similarity !== undefined) serverParams.min_similarity = params.min_similarity;
  if (params.status) serverParams.status = params.status;
  if (params.reward_max !== undefined) serverParams.reward_max = params.reward_max;
  if (params.remaining_reward_max !== undefined) serverParams.remaining_reward_max = params.remaining_reward_max;

  if (params.sort) {
    const s = params.sort;
    serverParams.sort =
      s === 'popular' || s === 'most_played' ? 'most_played' :
      s === 'new' || s === 'newest'          ? 'newest' :
      s === 'remaining_reward'               ? 'remaining_reward' :
      s === 'total_reward' || s === 'reward_total' ? 'total_reward' :
      s === 'reward_one'  || s === 'per_play_reward' ? 'reward_one' :
      s === 'relevance'                      ? 'relevance' :
      'newest';
  }

  if (params.limit !== undefined) serverParams.limit = params.limit;
  if (params.cursor !== undefined && params.cursor !== null) serverParams.cursor = params.cursor;
  const url = `${BASE}/musics${qs(serverParams)}`;
  console.log("[API] GET", url);
  const r = await fetch(`${BASE}/musics${qs(serverParams)}`, reqInit());
  
  if (!r.ok) throw new Error(`GET ${BASE}/musics ${r.status}`);
  const j = await safeJson(r);

  const itemsRaw = pickArray<PopularMusicDto>(j, 'items');
  const nextCursorRaw = pickValue<string | number | null>(j, 'nextCursor', 'next_cursor');
  const hasMoreRaw = pickValue<boolean>(j, 'hasMore', 'has_more');

  if (!Array.isArray(itemsRaw)) {
    throw new Error(`Unexpected musics response: ${JSON.stringify(j).slice(0, 200)}`);
  }

  const nextCursor = nextCursorRaw ?? null;
  const hasMore = Boolean(hasMoreRaw ?? (nextCursor !== null));

  return {
    items: itemsRaw.map(normalize),
    nextCursor,
    hasMore,
  };
}


/** 차트(인기) 전용 단축 API — 카테고리 칩에서 사용 */
export async function fetchPopular(params: {
  category?: string | number;
  limit?: number;
  days?: number; // 서버가 허용하면 최근기간 조절
} = {}): Promise<Music[]> {
  const serverParams: Record<string, any> = {};
  if (params.category !== undefined) serverParams.category = params.category;
  if (params.limit !== undefined) serverParams.limit = params.limit;
  if (params.days !== undefined) serverParams.days = params.days;

  const r = await fetch(`${BASE}/musics/popular${qs(serverParams)}`, reqInit());
  if (!r.ok) throw new Error(`GET ${BASE}/musics/popular ${r.status}`);
  const j = await safeJson(r);

  const items = pickArray<PopularMusicDto>(j, 'items');
  if (!items) throw new Error(`Unexpected popular response: ${JSON.stringify(j).slice(0, 200)}`);

  return items.map(normalize);
}

/** 상세 */
export async function fetchMusic(id: number | string): Promise<Music> {
  const r = await fetch(`${BASE}/musics/${id}`, reqInit());
  if (!r.ok) throw new Error(`GET ${BASE}/musics/${id} ${r.status}`);
  const j = await safeJson(r);
  const obj = pickValue<any>(j, 'data') ?? j;
  return normalize(obj);
}

  // 음원 상세 
export async function fetchMusicDetail(id: number | string): Promise<MusicDetailApi> {
  const r = await fetch(`${BASE}/musics/${id}`, { credentials: 'include', cache: 'no-store' });
  const j = await safeJson(r);
  if (!r.ok) throw new Error(j?.message || `GET /musics/${id} ${r.status}`);
  return j;
}

// 음원 사용하기
export async function useMusic(musicId: number): Promise<{ isUsing: boolean; usingId?: number }> {
  const r = await fetch(`${BASE}/musics/${musicId}/use`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const j = await safeJson(r);
  if (!r.ok) throw new Error(j?.message || `POST /musics/${musicId}/use ${r.status}`);
  return { isUsing: !!j.is_using, usingId: j.using_id };
}

// ─────────────────────────────────────────────────────────────
// Lyrics API
// ─────────────────────────────────────────────────────────────


type LyricsTextResponse = { text: string };

export async function fetchLyricsText(musicId: number | string): Promise<string> {
  try {
    const body = await api(`/musics/${musicId}/lyrics`, {
      method: "GET",
      skipAuthRedirect: true,
    });
    return (body as LyricsTextResponse).text ?? "";
  } catch (err: any) {
    const status = err?.response?.status as number | undefined;
    const msg = (err?.body?.message || err?.code || err?.message || "").toString();

    // 백엔드가 내려주는 표준 코드 우선 매핑
    if (msg === "LOGIN_REQUIRED" || status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }
    if (msg === "SUBSCRIPTION_REQUIRED" || status === 403) {
      throw new Error("SUBSCRIPTION_REQUIRED");
    }
    if (msg === "NO_LYRICS" || msg === "NO_LYRICS_SOURCE") {
      throw new Error("NO_LYRICS");
    }

    // 기타는 상태코드 포함해서 일반화
    throw new Error(msg || `GET /musics/${musicId}/lyrics ${status ?? "ERROR"}`);
  }
}


/** 가사 txt 다운로드 (다운로드 카운트는 백엔드에서 증가 처리) */
export async function downloadLyricsTxt(musicId: number | string): Promise<void> {
  const r = await fetch(`${BASE}/musics/${musicId}/lyrics.txt`, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!r.ok) {
    let msg = `GET /musics/${musicId}/lyrics.txt ${r.status}`;
    try {
      const j = await r.clone().json();
      msg = j?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const dispo = r.headers.get('Content-Disposition') || '';
  const m1 = dispo.match(/filename\*=(?:UTF-8'')?([^;]+)/i); 
  const m2 = dispo.match(/filename="?([^"]+)"?/i);           
  let filename = 'lyrics.txt';
  if (m1?.[1]) filename = decodeURIComponent(m1[1].replace(/^"+|"+$/g, ''));
  else if (m2?.[1]) filename = m2[1];

  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
export async function fetchMusicTags(musicId: number | string): Promise<MusicTagItem[]> {
  const r = await fetch(`${BASE}/musics/${musicId}/tags`, reqInit());
  if (!r.ok) throw new Error(`GET /musics/${musicId}/tags ${r.status}`);
  const j = await safeJson(r);

  // 백엔드가 배열을 곧장 주거나 {items:[...]}로 줄 수도 있으니 둘 다 수용
  const items = pickArray<MusicTagItem>(j, 'items') ?? (Array.isArray(j) ? j : []);
  return items.map(it => ({
    id: Number(it.id),
    text: String(it.text),
    raw_tag_id: it.raw_tag_id == null ? null : Number(it.raw_tag_id),
    canonical_name: it.canonical_name ?? null,
    canonical_slug: it.canonical_slug ?? null,
    canonical_type: (it.canonical_type ?? null) as any,
  }));
}
export async function fetchRawTagChips(type: 'mood'|'genre'|'context' = 'mood'): Promise<RawTagChip[]> {
  const r = await fetch(`${BASE}/musics/raw-tags${qs({ type })}`, reqInit());
  if (!r.ok) throw new Error(`GET /musics/raw-tags ${r.status}`);
  const j = await safeJson(r);

  const items = pickArray<RawTagChip>(j, 'items') ?? (Array.isArray(j) ? j : []);
  return items.map(it => ({
    id: Number(it.id),
    name: String(it.name),
    slug: String(it.slug),
    type: it.type as any,
    mapped_count: Number(it.mapped_count ?? 0),
  }));
}
export async function fetchMusicTagsBulk(
  ids: number[]
): Promise<Record<number, MusicTagItem[]>> {
  if (!ids.length) return {};
  const r = await fetch(`${BASE}/musics/tags?ids=${ids.join(',')}`, reqInit());
  if (!r.ok) throw new Error(`GET /musics/tags ${r.status}`);
  const j = await safeJson(r) as Array<{ music_id: number; tags: MusicTagItem[] }>;
  const map: Record<number, MusicTagItem[]> = {};
  for (const row of j) map[row.music_id] = row.tags;
  return map;
}

export async function startMusicPlay(musicId: number | string): Promise<string> {
  const base = BASE.replace(/\/$/, '');
  const url  = `${base}/musics/${musicId}/plays/start`; 

  const r = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  const j = await safeJson(r);
  if (!r.ok) throw new Error(j?.message || `POST ${url} ${r.status}`);

  const fp = String(j?.file_path ?? '').trim();
  if (!fp) throw new Error('AUDIO_PATH_EMPTY');
  return fp;
}