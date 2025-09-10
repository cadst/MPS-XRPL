import { pgTable, bigserial, bigint, text } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { companies } from './companies'

export const business_numbers = pgTable('business_numbers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  company_id: bigint('company_id', { mode: 'number' }).notNull(),
  number: text('number').notNull(),
})

export const business_numbersRelations = relations(business_numbers, ({ one }) => ({
  company: one(companies, {
    fields: [business_numbers.company_id],
    references: [companies.id],
  }),
})) 