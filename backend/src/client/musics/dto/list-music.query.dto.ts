// apps/backend/src/client/musics/dto/list-music.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

/* ───────── enums/consts (Swagger & validator용) ───────── */

export const SEARCH_MODES = ['keyword', 'semantic'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const SORT_KEYS = [
  'relevance',
  'newest',
  'most_played',
  'remaining_reward',
  'total_reward',   // 총 리워드 많은순
  'reward_one',     // 1회 리워드 높은순
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

// 별칭(프론트에서 잘못 보내도 수용하기 위함)
export const SORT_ALIASES = ['reward_total', 'per_play_reward'] as const;
export type SortAlias = (typeof SORT_ALIASES)[number];

export const STATUS_KEYS = ['active', 'inactive', 'invalid'] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

// UI 라벨 (프론트와 동일)
export const FORMAT_LABELS = ['Full', 'Inst'] as const;
export type FormatLabel = (typeof FORMAT_LABELS)[number];

/* ───────── 공통 Transform 유틸 ───────── */

function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => toStringArray(v))
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumberOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/* ───────── 원본 DTO (쿼리 수용층) ───────── */

export class ListMusicQueryDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: SEARCH_MODES })
  @IsOptional() @IsEnum(SEARCH_MODES)
  mode?: SearchMode = 'keyword';

  @ApiPropertyOptional()
  @IsOptional() @IsBooleanString()
  explain?: string; // 'true'|'false'

  @ApiPropertyOptional()
  @IsOptional() @IsNumber() @Min(0) @Max(1)
  @Transform(({ value }) => toNumberOrUndef(value))
  min_similarity?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  category_id?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray()
  @Transform(({ value }) => toStringArray(value))
  categories?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  mood?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray()
  @Transform(({ value }) => toStringArray(value))
  moods?: string[];

  @ApiPropertyOptional({ enum: FORMAT_LABELS, isArray: true })
  @IsOptional() @IsArray()
  @Transform(({ value }) => toStringArray(value))
  formats?: FormatLabel[];

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  @Transform(({ value }) => toNumberOrUndef(value))
  reward_max?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  @Transform(({ value }) => toNumberOrUndef(value))
  remaining_reward_max?: number;

  @ApiPropertyOptional({ enum: STATUS_KEYS })
  @IsOptional() @IsEnum(STATUS_KEYS)
  status?: StatusKey;

  @ApiPropertyOptional({ enum: SORT_KEYS })
  @IsOptional() @IsEnum([...SORT_KEYS, ...SORT_ALIASES] as any)
  sort?: SortKey | SortAlias = 'relevance';

  @ApiPropertyOptional()
  @IsOptional() @IsInt() @Min(1) @Max(50)
  @Transform(({ value }) => (toNumberOrUndef(value) ?? 20))
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  cursor?: string;
}

/* ───────── 서비스에서 바로 쓰는 정규화 타입 ───────── */

export type NormalizedListQuery = {
  q?: string;
  mode: SearchMode;
  explain: boolean;
  minSimilarity?: number;

  categories: string[];
  moodsLower: string[];
  formatsDb: Array<'FULL' | 'INSTRUMENTAL'>;
  rewardMax?: number;
  remainingRewardMax?: number;
  status?: StatusKey;

  sort: SortKey; // 표준 키만
  limit: number;
  cursor?: string;
};

export function normalizeListQuery(dto: ListMusicQueryDto): NormalizedListQuery {
  const catSet = new Set<string>();
  if (dto.category_id?.trim()) catSet.add(dto.category_id.trim());
  (dto.categories ?? []).forEach((c) => {
    const s = String(c).trim();
    if (s) catSet.add(s);
  });
  const categories = Array.from(catSet);

  const moodSet = new Set<string>();
  if (dto.mood?.trim()) moodSet.add(dto.mood.trim().toLowerCase());
  (dto.moods ?? []).forEach((m) => {
    const s = String(m).trim().toLowerCase();
    if (s) moodSet.add(s);
  });
  const moodsLower = Array.from(moodSet);

  const fm = new Set(dto.formats ?? []);
  const formatsDb: Array<'FULL' | 'INSTRUMENTAL'> = [];
  if (fm.has('Full')) formatsDb.push('FULL');
  if (fm.has('Inst')) formatsDb.push('INSTRUMENTAL');

  const explainBool =
    String(dto.explain ?? '').toLowerCase() === 'true' ||
    String(dto.explain ?? '') === '1';

  const toCanonicalSort = (s?: string): SortKey => {
    switch (s) {
      case 'reward_total': return 'total_reward';
      case 'per_play_reward': return 'reward_one';
      case 'total_reward':
      case 'reward_one':
      case 'relevance':
      case 'newest':
      case 'most_played':
      case 'remaining_reward':
        return s as SortKey;
      default:
        return 'relevance';
    }
  };

  return {
    q: dto.q?.trim() || undefined,
    mode: dto.mode ?? 'keyword',
    explain: explainBool,
    minSimilarity: dto.min_similarity,

    categories,
    moodsLower,
    formatsDb,
    rewardMax: dto.reward_max,
    remainingRewardMax: dto.remaining_reward_max,
    status: dto.status,

    sort: toCanonicalSort(dto.sort),
    limit: Math.min(Math.max(dto.limit ?? 20, 1), 50),
    cursor: dto.cursor,
  };
}
