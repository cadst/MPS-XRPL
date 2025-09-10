CREATE TYPE "public"."company_grade" AS ENUM('free', 'standard', 'business');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."reward_code" AS ENUM('0', '1', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."use_case" AS ENUM('0', '1', '2');--> statement-breakpoint
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
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"monthly_fee" numeric(10, 2) NOT NULL,
	"status" varchar(20) NOT NULL,
	"auto_renew" boolean DEFAULT true NOT NULL,
	"payment_status" varchar(20),
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
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"lyrics_text" text,
	"lyrics_file" text,
	"duration_sec" integer,
	"release_date" date,
	"cover_image_url" text,
	"stream_endpoint" text,
	"price_per_play" numeric,
	"lyrics_price" numeric,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"reward_amount" integer,
	"reward_count" integer,
	"category_id" integer,
	"genre" varchar(100),
	"grade" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true,
	"play_count" bigint DEFAULT 0,
	"total_revenue" numeric(10, 2) DEFAULT '0',
	"last_played_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"music_id" bigint NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company_id" bigint NOT NULL,
	"music_id" bigint NOT NULL,
	"play_id" bigint NOT NULL,
	"amount" numeric NOT NULL,
	"status" "reward_status" DEFAULT 'pending' NOT NULL,
	"payout_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "music_plays" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"music_id" bigint NOT NULL,
	"using_company_id" bigint NOT NULL,
	"reward_amount" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"transaction_hash" text,
	"api_latency" integer,
	"reward_code" "reward_code" NOT NULL,
	"use_case" "use_case" NOT NULL,
	"use_price" numeric,
	"played_at" timestamp with time zone,
	"playlist_id" bigint,
	"is_valid_play" boolean DEFAULT true,
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
	"music_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "raw_tags" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "raw_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_settings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tier" varchar(20) NOT NULL,
	"monthly_fee" numeric(10, 2) NOT NULL,
	"annual_discount_rate" numeric(5, 2) DEFAULT '0',
	"max_api_calls_per_month" integer,
	"max_rewards_per_month" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "music_embeddings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"music_id" integer NOT NULL,
	"kind" text,
	"model" text,
	"dim" integer,
	"embedding" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
