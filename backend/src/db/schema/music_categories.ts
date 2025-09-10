import { pgTable, bigserial, text } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { musics } from './musics'

export const music_categories = pgTable('music_categories', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull().unique(),
})

export const music_categoriesRelations = relations(music_categories, ({ many }) => ({
  musics: many(musics),
})) 