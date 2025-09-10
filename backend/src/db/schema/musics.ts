import { pgTable, bigserial, text, timestamp, integer, numeric, boolean, date, varchar, bigint } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { music_categories } from './music_categories'
import { music_tags } from './music_tags'
import { music_plays } from './music_plays'
import { rewards } from './rewards'
import { playlist_items } from './playlist_items'
import { monthly_music_rewards } from './monthly_music_rewards'

export const musics = pgTable('musics', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  file_path: varchar('file_path', { length: 255 }).notNull().unique(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  composer: text('composer'),
  music_arranger: text('music_arranger'),
  lyricist: text('lyricist'),
  lyrics_text: text('lyrics_text'),
  lyrics_file_path: text('lyrics_file_path'), // 가사 파일 경로 (기존 lyrics_file에서 변경)
  inst: boolean('inst').notNull().default(false), // true: instrumental, false: with vocal. 가사가 없으면 true
  isrc: text('isrc'),
  duration_sec: integer('duration_sec'),
  release_date: date('release_date'),
  cover_image_url: text('cover_image_url'),
  lyrics_download_count: bigint('lyrics_download_count', { mode: 'number' }).default(0),
  price_per_play: numeric('price_per_play'),
  lyrics_price: numeric('lyrics_price'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  category_id: integer('category_id'),
  grade: integer('grade_required').notNull().default(0), // 0: free, standard, business | 1: standard, business (리워드 있음) | 2: standard, business (리워드 없음)
  total_valid_play_count: bigint('valid_play_count', { mode: 'number' }).default(0),
  total_play_count: bigint('total_play_count', { mode: 'number' }).default(0),
  total_rewarded_amount: numeric('total_rewarded_amount').default('0'), // 누적 지급된 리워드 금액
  total_revenue: numeric('total_revenue').default('0'),
  file_size_bytes: bigint('file_size_bytes', { mode: 'number' }),
  last_played_at: timestamp('last_played_at', { withTimezone: true }),
})

export const musicsRelations = relations(musics, ({ many, one }) => ({
  category: one(music_categories, {
    fields: [musics.category_id],
    references: [music_categories.id],
  }),
  tags: many(music_tags),
  plays: many(music_plays),
  rewards: many(rewards),
  playlist_items: many(playlist_items),
  monthly_rewards: many(monthly_music_rewards),
}))