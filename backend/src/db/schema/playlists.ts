import { pgTable, bigserial, text, timestamp, bigint } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { companies } from './companies'
import { playlist_items } from './playlist_items'

export const playlists = pgTable('playlists', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  company_id: bigint('company_id', { mode: 'number' }).notNull(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  company: one(companies, {
    fields: [playlists.company_id],
    references: [companies.id],
  }),
  items: many(playlist_items),
}))