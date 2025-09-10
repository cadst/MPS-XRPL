import { pgTable, bigserial, text, timestamp, pgEnum, numeric } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { company_subscriptions } from './company_subscriptions'
import { playlists } from './playlists'
import { music_plays } from './music_plays'
import { rewards } from './rewards'
import { business_numbers } from './business_numbers'

export const companyGradeEnum = pgEnum('company_grade', ['free', 'standard', 'business'])

export const companies = pgTable('companies', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull().unique(),
  business_number: text('business_number').notNull().unique(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  phone: text('phone'),
  grade: companyGradeEnum('grade').notNull().default('free'),
  ceo_name: text('ceo_name'),
  profile_image_url: text('profile_image_url'),
  homepage_url: text('homepage_url'),
  smart_account_address: text('smart_account_address').unique(),
  api_key_hash: text('api_key_hash'),
  total_rewards_earned: numeric('total_rewards_earned').default('0'), // 전체 누적 적립 리워드
  total_rewards_used: numeric('total_rewards_used').default('0'), // 전체 누적 사용 리워드 (할인용)
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const companiesRelations = relations(companies, ({ many }) => ({
  subscriptions: many(company_subscriptions),
  playlists: many(playlists),
  music_plays: many(music_plays),
  rewards: many(rewards),
  business_numbers: many(business_numbers),
}))