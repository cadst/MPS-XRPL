import { pgTable, bigserial, bigint, varchar, integer, numeric, boolean, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { musics } from './musics'

export const monthly_music_rewards = pgTable('monthly_music_rewards', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  music_id: bigint('music_id', { mode: 'number' }).notNull(),
  year_month: varchar('year_month', { length: 7 }).notNull(), // '2025-08' 형식
  total_reward_count: integer('total_reward_count').notNull(), // 이달 총 리워드 제공 횟수 (MPS 운영자가 설정)
  remaining_reward_count: integer('remaining_reward_count').notNull(), // 남은 리워드 횟수
  reward_per_play: numeric('reward_per_play').notNull(), // 재생 1회당 리워드 금액 (MPS 운영자가 설정)
  is_auto_reset: boolean('is_auto_reset').default(true), // 매월 1일 자동 초기화 여부
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const monthly_music_rewardsRelations = relations(monthly_music_rewards, ({ one }) => ({
  music: one(musics, {
    fields: [monthly_music_rewards.music_id],
    references: [musics.id],
  }),
}))
