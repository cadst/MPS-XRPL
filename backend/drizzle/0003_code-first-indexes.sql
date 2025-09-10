CREATE TABLE "company_musics" (
	"company_id" bigint NOT NULL,
	"music_id" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."reward_status";--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('successed', 'falied', 'pending');--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."reward_status";--> statement-breakpoint
ALTER TABLE "rewards" ALTER COLUMN "status" SET DATA TYPE "public"."reward_status" USING "status"::"public"."reward_status";--> statement-breakpoint
ALTER TABLE "company_musics" ADD CONSTRAINT "company_musics_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_musics" ADD CONSTRAINT "company_musics_music_id_musics_id_fk" FOREIGN KEY ("music_id") REFERENCES "public"."musics"("id") ON DELETE cascade ON UPDATE no action;