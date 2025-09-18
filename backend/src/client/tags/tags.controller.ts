import { Controller, Post, Query, Body, InternalServerErrorException  } from "@nestjs/common";
import { TagsService } from "./tags.service";

@Controller("tags")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Post("normalize/mood")
async normalizeMood(@Query("limit") limit = "200") {
  try {
    const n = Number(limit) || 200;
    await this.tags.quickSqlPrepass();
    return await this.tags.backfillNullMusicTags("mood", n);
  } catch (e: any) {
    console.error("[normalize/mood] error:", e);
    throw new InternalServerErrorException({ message: String(e?.message ?? e), stack: e?.stack });
  }
}

  @Post("normalize/one")
  async normalizeOne(@Body() dto: { text: string; type?: "mood"|"genre"|"context" }) {
    try {
      const type = dto.type ?? "mood";
      return await this.tags.normalizeOneTextToRawTagId(dto.text, type);
    } catch (e: any) {
      console.error("[normalize/one] error:", e);
      throw new InternalServerErrorException({ message: String(e?.message ?? e), stack: e?.stack });
    }
  }
}
