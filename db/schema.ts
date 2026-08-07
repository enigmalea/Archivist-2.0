import * as t from "drizzle-orm/mysql-core";

import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { mysqlTable as table } from "drizzle-orm/mysql-core";

/**
 * One row per guild. Guild-wide bot behavior — not tied to a specific
 * embed type (work vs chapter) — plus the "general", "gallery", "ratings"
 * and "restrictions" categories from the settings panel (utils/embedFields.ts),
 * which are themselves inherently one-per-guild rather than one-per-embed-type,
 * so they live here rather than in one of the *_field_settings tables below.
 */
export const guildSettings = table("guild_settings", {
  id: t.int().primaryKey().autoincrement(),
  guildId: t.varchar({ length: 20 }).notNull().unique(),

  // Display toggles that apply regardless of embed type.
  showBasicInfo: t.boolean().default(true).notNull(),
  showCoverImage: t.boolean().default(true).notNull(),

  // Per-link suppression. User types <ignoreChar><url> to fully suppress
  // the bot's embed for that one link (e.g. "%https://...").
  ignoreChar: t.varchar({ length: 1 }).default("%").notNull(),

  // Guild-wide policy: does the bot respond to AO3 links hidden inside
  // markdown masks, e.g. [text](url)? Defaults true to preserve existing
  // 1.0 behavior on migration.
  respondToMaskedLinks: t.boolean().default(true).notNull(),

  // Message cleanup behavior. deleteOriginalLink doubles as the settings
  // panel's General -> "Delete original message with link" toggle.
  deleteOriginalLink: t.boolean().default(false).notNull(),
  deleteOnUpdate: t.boolean().default(false).notNull(),
  deleteOnError: t.boolean().default(false).notNull(),
  deleteOnDownload: t.boolean().default(false).notNull(),
  deleteOnChapter: t.boolean().default(false).notNull(),

  // General category.
  legacyWorkEmbed: t.boolean().default(false).notNull(),
  // AO3 outage alerts.
  outageAlertsEnabled: t.boolean().default(false).notNull(),
  outageAlertChannelId: t.varchar({ length: 20 }),

  // Gallery category.
  galleryEnabled: t.boolean().default(true).notNull(),
  galleryNsfwWarningMature: t.boolean().default(true).notNull(),
  galleryNsfwWarningExplicit: t.boolean().default(true).notNull(),
  // Inactivity auto-reset.
  galleryResetToFirstPage: t.boolean().default(true).notNull(),
  listResetToFirstPage: t.boolean().default(true).notNull(),

  // Ratings category — a work/chapter with a disallowed rating is blocked
  // from being posted at all (see isRatingAllowed in utils/embedFields.ts).
  allowRatingNotRated: t.boolean().default(true).notNull(),
  allowRatingGeneralAudiences: t.boolean().default(true).notNull(),
  allowRatingTeenAndUpAudiences: t.boolean().default(true).notNull(),
  allowRatingMature: t.boolean().default(true).notNull(),
  allowRatingExplicit: t.boolean().default(true).notNull(),

  // Restrictions category — Archive Warning blocklist (findDisallowedWarning
  // in utils/embedFields.ts). The freeform Additional Tags blocklist lives
  // in the separate blocked_tags table below since it isn't a fixed set.
  allowWarningGraphicViolence: t.boolean().default(true).notNull(),
  allowWarningMajorCharacterDeath: t.boolean().default(true).notNull(),
  allowWarningNoWarningsApply: t.boolean().default(true).notNull(),
  allowWarningNoncon: t.boolean().default(true).notNull(),
  allowWarningUnderage: t.boolean().default(true).notNull(),
  allowWarningChooseNotToWarn: t.boolean().default(true).notNull(),

  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().onUpdateNow().notNull(),
});

/**
 * One row per guild. Work-embed field visibility + length limits — the
 * "work-stats"/"work-tags"/"work-summary" categories in the settings panel
 * are one table here since that 3-way split only exists to fit each
 * category under Discord's 10-option CheckboxGroup cap in the UI, not
 * because they're separate data.
 */
export const workFieldSettings = table("work_field_settings", {
  id: t.int().primaryKey().autoincrement(),
  guildSettingsId: t.int()
    .notNull()
    .unique()
    .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),

  // work-stats
  showWords: t.boolean().default(true).notNull(),
  showChapters: t.boolean().default(true).notNull(),
  showLanguage: t.boolean().default(true).notNull(),
  showPublished: t.boolean().default(true).notNull(),
  showUpdated: t.boolean().default(true).notNull(),
  showStatus: t.boolean().default(true).notNull(),
  showRating: t.boolean().default(true).notNull(),
  showWarnings: t.boolean().default(true).notNull(),
  showCategory: t.boolean().default(true).notNull(),

  // work-tags
  showFandoms: t.boolean().default(true).notNull(),
  fandomsMaxLength: t.int().default(1024).notNull(),
  showRelationships: t.boolean().default(true).notNull(),
  relationshipsMaxLength: t.int().default(1024).notNull(),
  showCharacters: t.boolean().default(true).notNull(),
  charactersMaxLength: t.int().default(1024).notNull(),
  showTags: t.boolean().default(true).notNull(),
  tagsMaxLength: t.int().default(1024).notNull(),

  // work-summary
  showSummary: t.boolean().default(true).notNull(),
  summaryMaxLength: t.int().default(3000).notNull(),

  // Inactivity auto-reset: default tab.
  defaultTab: t.mysqlEnum(["stats", "tags", "summary", "none"]).default("stats").notNull(),
});

/**
 * One row per guild. Chapter-embed field visibility + length limits.
 */
export const chapterFieldSettings = table("chapter_field_settings", {
  id: t.int().primaryKey().autoincrement(),
  guildSettingsId: t.int()
    .notNull()
    .unique()
    .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),

  showWords: t.boolean().default(true).notNull(),
  showChapters: t.boolean().default(true).notNull(),
  showRating: t.boolean().default(true).notNull(),
  showPublished: t.boolean().default(true).notNull(),
  showUpdated: t.boolean().default(true).notNull(),
  showStatus: t.boolean().default(true).notNull(),
  showWarnings: t.boolean().default(true).notNull(),
  showSummary: t.boolean().default(true).notNull(),
  summaryMaxLength: t.int().default(1024).notNull(),
  // This chapter's own beginning/end author notes, not the work's.
  showNotes: t.boolean().default(true).notNull(),
  notesMaxLength: t.int().default(1024).notNull(),

  // Tags tab (reuses the work's tags).
  showFandoms: t.boolean().default(true).notNull(),
  fandomsMaxLength: t.int().default(1024).notNull(),
  showRelationships: t.boolean().default(true).notNull(),
  relationshipsMaxLength: t.int().default(1024).notNull(),
  showCharacters: t.boolean().default(true).notNull(),
  charactersMaxLength: t.int().default(1024).notNull(),
  showTags: t.boolean().default(true).notNull(),
  tagsMaxLength: t.int().default(1024).notNull(),

  // Thumbnail: its own settings category (see EMBED_FIELD_CATEGORIES in
  // utils/embedFields.ts) rather than bundled into the general Fields
  // checkbox group, so it can carry its own rating-based exclusions instead
  // of being a single flat on/off toggle. The chapter's first embedded
  // image, shown as a small thumbnail.
  showThumbnail: t.boolean().default(true).notNull(),
  hideThumbnailOnMature: t.boolean().default(false).notNull(),
  hideThumbnailOnExplicit: t.boolean().default(false).notNull(),

  // Inactivity auto-reset: default tab.
  defaultTab: t.mysqlEnum(["stats", "tags", "summary", "none"]).default("stats").notNull(),
});

/**
 * One row per guild. Series-embed field visibility + length limits.
 */
export const seriesFieldSettings = table("series_field_settings", {
  id: t.int().primaryKey().autoincrement(),
  guildSettingsId: t.int()
    .notNull()
    .unique()
    .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),

  showAuthors: t.boolean().default(true).notNull(),
  showComplete: t.boolean().default(true).notNull(),
  showWorkCount: t.boolean().default(true).notNull(),
  showWordCount: t.boolean().default(true).notNull(),
  showBookmarks: t.boolean().default(true).notNull(),
  showStarted: t.boolean().default(true).notNull(),
  showUpdated: t.boolean().default(true).notNull(),
  showNotes: t.boolean().default(true).notNull(),
  notesMaxLength: t.int().default(1024).notNull(),
  showDescription: t.boolean().default(true).notNull(),
  descriptionMaxLength: t.int().default(1024).notNull(),

  // Inactivity auto-reset: default tab.
  defaultTab: t.mysqlEnum(["stats", "notes", "description", "none"]).default("stats").notNull(),
});

/**
 * One row per guild. User-profile-embed field visibility + length limits.
 */
export const userFieldSettings = table("user_field_settings", {
  id: t.int().primaryKey().autoincrement(),
  guildSettingsId: t.int()
    .notNull()
    .unique()
    .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),

  showPseuds: t.boolean().default(true).notNull(),
  showJoined: t.boolean().default(true).notNull(),
  showLocation: t.boolean().default(true).notNull(),
  showBirthday: t.boolean().default(true).notNull(),
  showWorks: t.boolean().default(true).notNull(),
  showSeries: t.boolean().default(true).notNull(),
  showCollections: t.boolean().default(true).notNull(),
  showBookmarks: t.boolean().default(true).notNull(),
  showGifts: t.boolean().default(true).notNull(),
  // Paginated if long — bioMaxLength governs the profile page's inline cutoff
  // before it spills onto its own paginated bio page(s), see userEmbed.ts.
  showBio: t.boolean().default(true).notNull(),
  bioMaxLength: t.int().default(6000).notNull(),

  // Inactivity auto-reset.
  resetToFirstPage: t.boolean().default(true).notNull(),
});

/**
 * Freeform Additional-Tags blocklist (Restrictions panel) — one row per
 * blocked tag rather than a JSON array, since these are matched with a
 * case-insensitive substring check against every tag on every work
 * (utils/restrictions.ts's findBlockedTag), not looked up by exact key like
 * the toggle/length maps above.
 */
export const blockedTags = table(
  "blocked_tags",
  {
    id: t.int().primaryKey().autoincrement(),
    guildSettingsId: t.int()
      .notNull()
      .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),
    tag: t.varchar({ length: 100 }).notNull(),
  },
  (table) => [
    t.index("blocked_tags_guild_idx").on(table.guildSettingsId),
  ],
);

/**
 * Redirect rules (Fox's feature). A guild can define N rules, each with
 * an arbitrary filter object (rating / fandom / type, AND'd together
 * within a rule) and a destination channel/forum/thread ID.
 *
 * When more than one rule matches the same work, the first one created
 * wins (see resolveRedirectRule in utils/redirects.ts) — there's no
 * specificity-based priority between rating/fandom/type.
 */
export const redirectRules = table(
  "redirect_rules",
  {
    id: t.varchar({ length: 36 }).primaryKey(), // UUID
    guildSettingsId: t.int()
      .notNull()
      .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),
    destinationId: t.varchar({ length: 20 }).notNull(),
    destinationType: t.mysqlEnum(["channel", "forum", "thread"]).notNull(),

    // Shape: { rating?: string, fandom?: string, type?: "work" | "series" | "user" | "chapter" }
    // Kept as JSON since the filter shape is variable; not queried via SQL
    // WHERE, just read + matched in app code.
    filters: t.json().notNull(),

    // Set the first time a "forum" destination rule redirects a link — the
    // thread Discord created for it, so later matches post into that same
    // thread instead of creating a new one every time. Null for
    // channel/thread destinations, and for forum rules that haven't fired
    // yet. Kept as its own column (not folded into `filters`) since it's
    // mutable runtime state assigned by the bot, not a match condition set
    // by the guild admin.
    forumThreadId: t.varchar({ length: 20 }),

    createdAt: t.timestamp().defaultNow().notNull(),
  },
  (table) => [
    t.index("redirect_rules_guild_idx").on(table.guildSettingsId),
  ],
);

// --- Relations (for query convenience) ---

export const guildSettingsRelations = relations(guildSettings, ({ one, many }) => ({
  workFieldSettings: one(workFieldSettings),
  chapterFieldSettings: one(chapterFieldSettings),
  seriesFieldSettings: one(seriesFieldSettings),
  userFieldSettings: one(userFieldSettings),
  blockedTags: many(blockedTags),
  redirectRules: many(redirectRules),
}));

export const workFieldSettingsRelations = relations(workFieldSettings, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [workFieldSettings.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

export const chapterFieldSettingsRelations = relations(chapterFieldSettings, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [chapterFieldSettings.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

export const seriesFieldSettingsRelations = relations(seriesFieldSettings, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [seriesFieldSettings.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

export const userFieldSettingsRelations = relations(userFieldSettings, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [userFieldSettings.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

export const blockedTagsRelations = relations(blockedTags, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [blockedTags.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

export const redirectRulesRelations = relations(redirectRules, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [redirectRules.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

