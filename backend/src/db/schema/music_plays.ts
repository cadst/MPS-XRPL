import { pgTable, bigserial, bigint, numeric, text, integer, pgEnum, boolean, timestamp, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { musics } from './musics'
import { companies } from './companies'

export const rewardCodeEnum = pgEnum('reward_code', ['0', '1', '2', '3'])
export const useCaseEnum = pgEnum('use_case', ['0', '1', '2'])

export const music_plays = pgTable('music_plays', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  music_id: bigint('music_id', { mode: 'number' }).notNull(),
  using_company_id: bigint('using_company_id', { mode: 'number' }).notNull(),
  reward_amount: numeric('reward_amount').default('0'), // 지급된 리워드 금액
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  transaction_hash: text('transaction_hash'),
  // api_latency: integer('api_latency'),
  reward_code: rewardCodeEnum('reward_code').notNull(),
  use_case: useCaseEnum('use_case').notNull(),
  use_price: numeric('use_price').default('0'), // 실제 청구 비용
  // played_at: timestamp('played_at', { withTimezone: true }).defaultNow(),
  is_valid_play: boolean('is_valid_play').default(false), // 60초 이상 = true
  play_duration_sec: integer('play_duration_sec'), // 실제 재생 시간
})

export const music_playsRelations = relations(music_plays, ({ one }) => ({
  music: one(musics, {
    fields: [music_plays.music_id],
    references: [musics.id],
  }),
  company: one(companies, {
    fields: [music_plays.using_company_id],
    references: [companies.id],
  }),
})) 