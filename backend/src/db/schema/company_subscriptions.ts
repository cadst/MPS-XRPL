import { pgTable, bigserial, bigint, varchar, timestamp, decimal, integer, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { companies } from './companies'

export const company_subscriptions = pgTable('company_subscriptions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  company_id: bigint('company_id', { mode: 'number' }).notNull(),
  tier: varchar('tier', { length: 20 }).notNull(), // 'free', 'standard', 'business'
  start_date: timestamp('start_date', { withTimezone: true }).notNull(), // 구독 시작일
  end_date: timestamp('end_date', { withTimezone: true }).notNull(), // 구독 종료일
  total_paid_amount: decimal('total_paid_amount', { precision: 10, scale: 2 }),
  payment_count: integer('payment_count'),
  discount_amount: decimal('discount_amount', { precision: 10, scale: 2 }), // 리워드로 할인받은 금액
  actual_paid_amount: decimal('actual_paid_amount', { precision: 10, scale: 2 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const company_subscriptionsRelations = relations(company_subscriptions, ({ one, many }) => ({
  company: one(companies, {
    fields: [company_subscriptions.company_id],
    references: [companies.id],
  }),
})) 