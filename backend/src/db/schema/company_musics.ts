import { pgTable, bigint, bigserial, date, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { companies } from './companies'
import { musics } from './musics'

export const company_musics = pgTable('company_musics', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  company_id: bigint('company_id', { mode: 'number' })
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),

  music_id: bigint('music_id', { mode: 'number' })
    .notNull()
    .references(() => musics.id, { onDelete: 'cascade' }),

  created_at: date('created_at', { mode: 'date' })
    .notNull()
    .default(sql`CURRENT_DATE`),
}, (t) => ({
  uqCompanyMusic: unique('uq_company_musics_company_id_music_id').on(t.company_id, t.music_id),
}))

export const company_musicsRelations = relations(company_musics, ({ one }) => ({
  company: one(companies, {
    fields: [company_musics.company_id],
    references: [companies.id],
  }),
  music: one(musics, {
    fields: [company_musics.music_id],
    references: [musics.id],
  }),
}))


// import { pgTable, bigint, bigserial, unique, timestamp } from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm';
// import { companies } from './companies';
// import { musics } from './musics';

// export const company_musics = pgTable('company_musics', {
//   id: bigserial('id', { mode: 'number' }).primaryKey(),

//   company_id: bigint('company_id', { mode: 'number' })
//     .notNull()
//     .references(() => companies.id, { onDelete: 'cascade' }),

//   music_id: bigint('music_id', { mode: 'number' })
//     .notNull()
//     .references(() => musics.id, { onDelete: 'cascade' }),

//   // ✅ 시간/분/초 + 타임존까지 저장
//   created_at: timestamp('created_at', { withTimezone: true, mode: 'date' })
//     .notNull()
//     .defaultNow(),
// }, (t) => ({
//   uqCompanyMusic: unique('uq_company_musics_company_id_music_id').on(t.company_id, t.music_id),
// }));

// export const company_musicsRelations = relations(company_musics, ({ one }) => ({
//   company: one(companies, {
//     fields: [company_musics.company_id],
//     references: [companies.id],
//   }),
//   music: one(musics, {
//     fields: [company_musics.music_id],
//     references: [musics.id],
//   }),
// }));
