import { pgTable, bigserial, bigint, integer, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { playlists } from './playlists'
import { musics } from './musics'

export const playlist_items = pgTable('playlist_items', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    playlist_id: bigint('playlist_id', { mode: 'number' }).notNull(),
    music_id: bigint('music_id', { mode: 'number' }).notNull(),
    added_at: timestamp('added_at', { withTimezone: true }).defaultNow(),
})

export const playlist_itemsRelations = relations(playlist_items, ({ one }) => ({
    playlist: one(playlists, {
        fields: [playlist_items.playlist_id],
        references: [playlists.id],
    }),
    music: one(musics, {
        fields: [playlist_items.music_id],
        references: [musics.id],
    }),
}))
