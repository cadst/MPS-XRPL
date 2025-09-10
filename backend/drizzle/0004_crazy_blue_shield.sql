ALTER TABLE "company_musics" ADD COLUMN "id" bigserial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "company_musics" ADD COLUMN "created_at" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "company_musics" ADD CONSTRAINT "uq_company_musics_company_id_music_id" UNIQUE("company_id","music_id");