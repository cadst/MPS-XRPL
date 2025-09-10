ALTER TABLE "musics" DROP CONSTRAINT IF EXISTS "musics_isrc_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "musics_isrc_unique";
ALTER TABLE "music_tags" ALTER COLUMN "raw_tag_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN IF EXISTS "is_active";--> statement-breakpoint
ALTER TABLE "music_plays" DROP COLUMN IF EXISTS "api_latency";--> statement-breakpoint
ALTER TABLE "music_plays" DROP COLUMN IF EXISTS "played_at";