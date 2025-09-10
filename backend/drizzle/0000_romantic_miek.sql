CREATE TYPE "public"."company_grade" AS ENUM('free', 'standard', 'business');--> statement-breakpoint
CREATE TYPE "public"."reward_code" AS ENUM('0', '1', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."use_case" AS ENUM('0', '1', '2');--> statement-breakpoint
CREATE TYPE "public"."raw_tag_type" AS ENUM('genre', 'mood', 'context');--> statement-breakpoint
CREATE TABLE "business_numbers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"number" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"business_number" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone" text,
	"grade" "company_grade" DEFAULT 'free' NOT NULL,
	"ceo_name" text,
	"profile_image_url" text,
	"homepage_url" text,
	"smart_account_address" text,
	"api_key_hash" text,
	"total_rewards_earned" numeric DEFAULT '0',
	"total_rewards_used" numeric DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "companies_name_unique" UNIQUE("name"),
	CONSTRAINT "companies_business_number_unique" UNIQUE("business_number"),
	CONSTRAINT "companies_email_unique" UNIQUE("email"),
	CONSTRAINT "companies_smart_account_address_unique" UNIQUE("smart_account_address")
);
--> statement-breakpoint
CREATE TABLE "company_subscriptions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"tier" varchar(20) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"total_paid_amount" numeric(10, 2),
	"payment_count" integer,
	"discount_amount" numeric(10, 2),
	"actual_paid_amount" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "musics" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"file_path" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"composer" text,
	"music_arranger" text,
	"lyricist" text,
	"lyrics_text" text,
	"lyrics_file_path" text,
	"inst" boolean DEFAULT false NOT NULL,
	"isrc" text,
	"duration_sec" integer,
	"release_date" date,
	"cover_image_url" text,
	"lyrics_download_count" bigint DEFAULT 0,
	"price_per_play" numeric,
	"lyrics_price" numeric,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"category_id" integer,
	"grade_required" integer DEFAULT 0 NOT NULL,
	"valid_play_count" bigint DEFAULT 0,
	"total_play_count" bigint DEFAULT 0,
	"total_rewarded_amount" numeric DEFAULT '0',
	"total_revenue" numeric DEFAULT '0',
	"file_size_bytes" bigint,
	"last_played_at" timestamp with time zone,
	CONSTRAINT "musics_file_path_unique" UNIQUE("file_path")
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"playlist_id" bigint NOT NULL,
	"music_id" bigint NOT NULL,
	"added_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"music_id" bigint NOT NULL,
	"play_id" bigint NOT NULL,
	"reward_code" "reward_code" NOT NULL,
	"amount" numeric NOT NULL,
	"status" "reward_status" DEFAULT 'pending' NOT NULL,
	"payout_tx_hash" text,
	"block_number" integer,
	"gas_used" bigint,
	"blockchain_recorded_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "music_plays" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"music_id" bigint NOT NULL,
	"using_company_id" bigint NOT NULL,
	"reward_amount" numeric DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"transaction_hash" text,
	"reward_code" "reward_code" NOT NULL,
	"use_case" "use_case" NOT NULL,
	"use_price" numeric DEFAULT '0',
	"is_valid_play" boolean DEFAULT false,
	"play_duration_sec" integer
);
--> statement-breakpoint
CREATE TABLE "music_categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "music_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "music_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"music_id" bigint NOT NULL,
	"raw_tag_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "raw_tags" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "raw_tag_type" NOT NULL,
	CONSTRAINT "raw_tags_slug_unique" UNIQUE("slug")
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
