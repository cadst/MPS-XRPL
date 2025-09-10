import { pgTable, bigserial, text, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { music_tags } from './music_tags'

export const typeEnum = pgEnum('raw_tag_type', ['genre', 'mood', 'context'])


export const raw_tags = pgTable('raw_tags', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: typeEnum('type').notNull(),
})

export const raw_tagsRelations = relations(raw_tags, ({ many }) => ({
  music_tags: many(music_tags),
}))