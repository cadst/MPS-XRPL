import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { slugifyKo } from "../lib/slug";
import { openai } from "../lib/openai";

import { raw_tags, music_tags } from "../../db/schema";

type Candidate = { id: number; name: string; slug: string };
type TagType = "mood" | "genre" | "context";
type MatchedBy = "name" | "slug" | "synonym" | "llm" | "none";

// 필요하면 여기 유의어 늘리기
const SYNONYM_TO_CANON: Record<string, string> = {
  "리렉스": "차분한",
  "조용한": "차분한",
  "부드러운": "차분한",
  "즐거운": "행복한",
  "느낌이 좋은": "행복한",
  "촉촉한": "우울한",
};

@Injectable()
export class TagsService {
  constructor(@Inject('DB') private readonly db: any) {}

  private async loadCandidates(type: TagType): Promise<Candidate[]> {
    return this.db
      .select({ id: raw_tags.id, name: raw_tags.name, slug: raw_tags.slug })
      .from(raw_tags)
      .where(eq(raw_tags.type, type));
  }

  private ruleMatch(text: string, candidates: Candidate[]) {
    const byName = new Map<string, Candidate>();
    const bySlug = new Map<string, Candidate>();
    for (const c of candidates) {
      byName.set(c.name.trim().toLowerCase(), c);
      bySlug.set(c.slug, c);
    }
    const q = text.trim().toLowerCase();
    const qSlug = slugifyKo(text);

    if (byName.has(q)) return { hit: byName.get(q)!, matchedBy: "name" as MatchedBy };
    if (bySlug.has(qSlug)) return { hit: bySlug.get(qSlug)!, matchedBy: "slug" as MatchedBy };

    const canon = SYNONYM_TO_CANON[text.trim()];
    if (canon && byName.has(canon.toLowerCase())) {
      return { hit: byName.get(canon.toLowerCase())!, matchedBy: "synonym" as MatchedBy };
    }
    return { hit: null as Candidate | null, matchedBy: "none" as MatchedBy };
  }

  /** ② LLM 매칭: 후보 중 택1 (Chat Completions + tool calling) */
  private async llmPickOne(inputText: string, candidates: Candidate[]) {
    const list = candidates.map(c => `${c.name} :: ${c.slug}`).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "너는 음악 '무드' 태그 정규화기다.",
            "후보 목록에서 의미가 가장 가까운 하나만 골라라.",
            "후보에 없는 새 태그를 만들지 마라.",
            "반드시 도구 호출로만 응답해라."
          ].join(" "),
        },
        {
          role: "user",
          content: `입력: "${inputText}"\n후보(이름 :: slug):\n${list}`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "pick_one",
            description: "후보 중 가장 가까운 태그 하나를 선택한다.",
            parameters: {
              type: "object",
              additionalProperties: false,
              properties: {
                // string | null 은 anyOf 로 안전하게
                match_slug: { anyOf: [{ type: "string" }, { type: "null" }] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" }
              },
              required: ["match_slug","confidence","reason"]
            }
          }
        }
      ],
      // TS 타입이 빡세면 한 줄 캐스트
      tool_choice: { type: "function", function: { name: "pick_one" } } as any
    });

    const toolCalls = completion.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return { hit: null as Candidate | null, confidence: 0, reason: "no_tool_call" };
    }

    const fnCall = toolCalls.find(tc => tc.type === "function");
    if (!fnCall) {
      return { hit: null as Candidate | null, confidence: 0, reason: "no_function_call" };
    }

    // 일부 TS 정의에선 유니온이라 `'function' in fnCall` 체크가 안전
    const fnPart: any = (fnCall as any).function ?? (fnCall as any)["function"];
    if (!fnPart?.arguments) {
      return { hit: null as Candidate | null, confidence: 0, reason: "no_args" };
    }

    let parsed: { match_slug: string | null; confidence: number; reason: string };
    try {
      parsed = JSON.parse(fnPart.arguments);
    } catch {
      return { hit: null as Candidate | null, confidence: 0, reason: "bad_json" };
    }

    const hit = parsed.match_slug
      ? candidates.find(c => c.slug === parsed.match_slug) ?? null
      : null;

    return { hit, confidence: parsed.confidence ?? 0, reason: parsed.reason ?? "" };
  }

  /** 단일 텍스트 → raw_tag_id */
  async normalizeOneTextToRawTagId(
    text: string,
    type: TagType = "mood",
    minConfidence = 0.7
  ): Promise<{ rawTagId: number | null; matchedBy: MatchedBy; confidence?: number; reason?: string }> {
    const candidates = await this.loadCandidates(type);

    // ① 규칙
    const r = this.ruleMatch(text, candidates);
    if (r.hit) return { rawTagId: r.hit.id, matchedBy: r.matchedBy };

    // ② LLM 백업
    const { hit, confidence, reason } = await this.llmPickOne(text, candidates);
    if (hit && confidence >= minConfidence) {
      return { rawTagId: hit.id, matchedBy: "llm", confidence, reason };
    }
    return { rawTagId: null, matchedBy: "none" };
  }

  /** NULL 대상 일괄 백필 */
/** NULL 대상 일괄 백필 */
async backfillNullMusicTags(type: TagType = "mood", limit = 200) {
  const qres = await this.db.execute(sql`
    SELECT id, text
    FROM ${music_tags}
    WHERE ${music_tags.raw_tag_id} IS NULL
    ORDER BY ${music_tags.id} ASC
    LIMIT ${limit}
  `);

  const list: { id: number; text: string }[] =
    Array.isArray(qres) ? (qres as any) :
    (qres && (qres as any).rows ? (qres as any).rows : []);

  let updated = 0;
  const errors: Array<{ id: number; text: string; error: string }> = [];

  for (const row of list) {
    try {
      const { rawTagId } = await this.normalizeOneTextToRawTagId(row.text, type);
      if (!rawTagId) continue;
      await this.db.update(music_tags)
        .set({ raw_tag_id: rawTagId })
        .where(eq(music_tags.id, row.id));
      updated += 1;
    } catch (e: any) {
      errors.push({ id: row.id, text: row.text, error: String(e?.message ?? e) });
      // 계속 진행 (배치가 한 건 때문에 멈추지 않도록)
    }
  }

  return { scanned: list.length, updated, errors };
}


  /** (옵션) 선행 규칙 매핑 SQL 두 방 */
/** (옵션) 선행 규칙 매핑 SQL 두 방 */
async quickSqlPrepass() {
  // 1) 이름 정확 일치
  await this.db.execute(sql`
    UPDATE "music_tags" AS mt
    SET "raw_tag_id" = rt.id
    FROM "raw_tags" AS rt
    WHERE mt."raw_tag_id" IS NULL
      AND rt."type" = 'mood'
      AND lower(trim(mt."text")) = lower(rt."name");
  `);

  // 2) 공백→하이픈 slug 일치
  await this.db.execute(sql`
    UPDATE "music_tags" AS mt
    SET "raw_tag_id" = rt.id
    FROM "raw_tags" AS rt
    WHERE mt."raw_tag_id" IS NULL
      AND rt."type" = 'mood'
      AND replace(lower(trim(mt."text")), ' ', '-') = rt."slug";
  `);
}
}
