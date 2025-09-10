import { pgTable, bigserial, bigint, text, unique, numeric, timestamp, varchar, integer, boolean, date, serial, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const companyGrade = pgEnum("company_grade", ['free', 'standard', 'business'])
export const rawTagType = pgEnum("raw_tag_type", ['genre', 'mood', 'context'])
export const rewardCode = pgEnum("reward_code", ['0', '1', '2', '3'])
export const rewardStatus = pgEnum("reward_status", ['pending', 'paid'])
export const useCase = pgEnum("use_case", ['0', '1', '2'])


export const businessNumbers = pgTable("business_numbers", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	companyId: bigint("company_id", { mode: "number" }).notNull(),
	number: text().notNull(),
});

export const companies = pgTable("companies", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	name: text().notNull(),
	businessNumber: text("business_number").notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	phone: text(),
	grade: companyGrade().default('free').notNull(),
	ceoName: text("ceo_name"),
	profileImageUrl: text("profile_image_url"),
	homepageUrl: text("homepage_url"),
	smartAccountAddress: text("smart_account_address"),
	apiKeyHash: text("api_key_hash"),
	totalRewardsEarned: numeric("total_rewards_earned").default('0'),
	totalRewardsUsed: numeric("total_rewards_used").default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("companies_name_unique").on(table.name),
	unique("companies_business_number_unique").on(table.businessNumber),
	unique("companies_email_unique").on(table.email),
	unique("companies_smart_account_address_unique").on(table.smartAccountAddress),
]);

export const companySubscriptions = pgTable("company_subscriptions", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	companyId: bigint("company_id", { mode: "number" }).notNull(),
	tier: varchar({ length: 20 }).notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }).notNull(),
	totalPaidAmount: numeric("total_paid_amount", { precision: 10, scale:  2 }),
	paymentCount: integer("payment_count"),
	discountAmount: numeric("discount_amount", { precision: 10, scale:  2 }),
	actualPaidAmount: numeric("actual_paid_amount", { precision: 10, scale:  2 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const musics = pgTable("musics", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	filePath: varchar("file_path", { length: 255 }).notNull(),
	title: text().notNull(),
	artist: text().notNull(),
	composer: text(),
	musicArranger: text("music_arranger"),
	lyricist: text(),
	lyricsText: text("lyrics_text"),
	lyricsFilePath: text("lyrics_file_path"),
	inst: boolean().default(false).notNull(),
	isrc: text(),
	durationSec: integer("duration_sec"),
	releaseDate: date("release_date"),
	coverImageUrl: text("cover_image_url"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	lyricsDownloadCount: bigint("lyrics_download_count", { mode: "number" }).default(0),
	pricePerPlay: numeric("price_per_play"),
	lyricsPrice: numeric("lyrics_price"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	categoryId: integer("category_id"),
	gradeRequired: integer("grade_required").default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	validPlayCount: bigint("valid_play_count", { mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPlayCount: bigint("total_play_count", { mode: "number" }).default(0),
	totalRewardedAmount: numeric("total_rewarded_amount").default('0'),
	totalRevenue: numeric("total_revenue").default('0'),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
	lastPlayedAt: timestamp("last_played_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	unique("musics_file_path_unique").on(table.filePath),
]);

export const playlists = pgTable("playlists", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	companyId: bigint("company_id", { mode: "number" }).notNull(),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const playlistItems = pgTable("playlist_items", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playlistId: bigint("playlist_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	musicId: bigint("music_id", { mode: "number" }).notNull(),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const rewards = pgTable("rewards", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	companyId: bigint("company_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	musicId: bigint("music_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	playId: bigint("play_id", { mode: "number" }).notNull(),
	rewardCode: rewardCode("reward_code").notNull(),
	amount: numeric().notNull(),
	status: rewardStatus().default('pending').notNull(),
	payoutTxHash: text("payout_tx_hash"),
	blockNumber: integer("block_number"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	gasUsed: bigint("gas_used", { mode: "number" }),
	blockchainRecordedAt: timestamp("blockchain_recorded_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const musicPlays = pgTable("music_plays", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	musicId: bigint("music_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usingCompanyId: bigint("using_company_id", { mode: "number" }).notNull(),
	rewardAmount: numeric("reward_amount").default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	transactionHash: text("transaction_hash"),
	rewardCode: rewardCode("reward_code").notNull(),
	useCase: useCase("use_case").notNull(),
	usePrice: numeric("use_price").default('0'),
	isValidPlay: boolean("is_valid_play").default(false),
	playDurationSec: integer("play_duration_sec"),
});

export const musicCategories = pgTable("music_categories", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	name: text().notNull(),
}, (table) => [
	unique("music_categories_name_unique").on(table.name),
]);

export const musicTags = pgTable("music_tags", {
	id: serial().primaryKey().notNull(),
	text: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	musicId: bigint("music_id", { mode: "number" }).notNull(),
	rawTagId: integer("raw_tag_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const rawTags = pgTable("raw_tags", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	type: rawTagType().notNull(),
}, (table) => [
	unique("raw_tags_slug_unique").on(table.slug),
]);

export const monthlyMusicRewards = pgTable("monthly_music_rewards", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	musicId: bigint("music_id", { mode: "number" }).notNull(),
	yearMonth: varchar("year_month", { length: 7 }).notNull(),
	totalRewardCount: integer("total_reward_count").notNull(),
	remainingRewardCount: integer("remaining_reward_count").notNull(),
	rewardPerPlay: numeric("reward_per_play").notNull(),
	isAutoReset: boolean("is_auto_reset").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
