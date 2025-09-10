CREATE TYPE "public"."raw_tag_type" AS ENUM('genre', 'mood', 'context');--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"playlist_id" bigint NOT NULL,
	"music_id" bigint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monthly_music_rewards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"music_id" bigint NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"total_reward_count" integer NOT NULL,
	"remaining_reward_count" integer NOT NULL,
	"reward_per_play" numeric NOT NULL,
	"is_auto_reset" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "subscription_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "music_embeddings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "subscription_settings" CASCADE;--> statement-breakpoint
DROP TABLE "music_embeddings" CASCADE;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "musics" ALTER COLUMN "total_revenue" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "musics" ALTER COLUMN "total_revenue" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "music_plays" ALTER COLUMN "reward_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "music_plays" ALTER COLUMN "reward_amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "music_plays" ALTER COLUMN "use_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "music_plays" ALTER COLUMN "played_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "music_plays" ALTER COLUMN "is_valid_play" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "music_tags" ALTER COLUMN "music_id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "raw_tags" ALTER COLUMN "type" SET DATA TYPE "public"."raw_tag_type" USING "type"::"public"."raw_tag_type";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "total_rewards_earned" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "total_rewards_used" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "file_path" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "composer" text;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "music_arranger" text;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "lyricist" text;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "lyrics_file_path" text;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "inst" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "isrc" text;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "lyrics_download_count" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "grade_required" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "valid_play_count" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "total_play_count" bigint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "total_rewarded_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "musics" ADD COLUMN "file_size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "reward_code" "reward_code" NOT NULL;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "block_number" integer;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "gas_used" bigint;--> statement-breakpoint
ALTER TABLE "rewards" ADD COLUMN "blockchain_recorded_at" timestamp;--> statement-breakpoint
ALTER TABLE "music_tags" ADD COLUMN "raw_tag_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "company_subscriptions" DROP COLUMN "monthly_fee";--> statement-breakpoint
ALTER TABLE "company_subscriptions" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "company_subscriptions" DROP COLUMN "auto_renew";--> statement-breakpoint
ALTER TABLE "company_subscriptions" DROP COLUMN "payment_status";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "lyrics_file";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "stream_endpoint";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "reward_amount";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "reward_count";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "genre";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "grade";--> statement-breakpoint
ALTER TABLE "musics" DROP COLUMN "play_count";--> statement-breakpoint
ALTER TABLE "playlists" DROP COLUMN "music_id";--> statement-breakpoint
ALTER TABLE "music_plays" DROP COLUMN "playlist_id";--> statement-breakpoint
ALTER TABLE "musics" ADD CONSTRAINT "musics_file_path_unique" UNIQUE("file_path");--> statement-breakpoint
ALTER TABLE "musics" ADD CONSTRAINT "musics_isrc_unique" UNIQUE("isrc");