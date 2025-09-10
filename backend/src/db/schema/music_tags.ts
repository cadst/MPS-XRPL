import { pgTable, serial, integer, text, timestamp, bigint } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { musics } from './musics'
import { raw_tags } from './raw_tags'

export const music_tags = pgTable('music_tags', {
  id: serial('id').primaryKey(),
  text: text('text').notNull(),
  music_id: bigint('music_id', { mode: 'number' }).notNull(),
  raw_tag_id: integer('raw_tag_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const music_tagsRelations = relations(music_tags, ({ one }) => ({
  music: one(musics, {
    fields: [music_tags.music_id],
    references: [musics.id],
  }),
  raw_tag: one(raw_tags, {
    fields: [music_tags.raw_tag_id],
    references: [raw_tags.id],
  }),
}))