import * as t from "drizzle-orm/mysql-core";

import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { mysqlTable as table } from "drizzle-orm/mysql-core";

/**
 * One row per guild. Guild-wide bot behavior — not tied to a specific
 * embed type (work vs chapter).
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

  // Message cleanup behavior.
  deleteOriginalLink: t.boolean().default(false).notNull(),
  deleteOnUpdate: t.boolean().default(false).notNull(),
  deleteOnError: t.boolean().default(false).notNull(),
  deleteOnDownload: t.boolean().default(false).notNull(),
  deleteOnChapter: t.boolean().default(false).notNull(),

  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().onUpdateNow().notNull(),
});

/**
 * One row per (guild, embedType). Replaces the old flat Fan/cFan,
 * Rel/cRel, etc. column pairs — instead of 6 toggles duplicated across
 * 12 columns, it's 6 columns with 2 rows per guild (work + chapter).
 */
export const embedFieldSettings = table(
  "embed_field_settings",
  {
    id: t.int().primaryKey().autoincrement(),
    guildSettingsId: t.int()
      .notNull()
      .references((): AnyMySqlColumn => guildSettings.id, { onDelete: "cascade" }),
    embedType: t.mysqlEnum(["work", "chapter"]).notNull(),

    showPublishedInfo: t.boolean().default(true).notNull(),
    showFandoms: t.boolean().default(true).notNull(),
    showRelationships: t.boolean().default(true).notNull(),
    showCharacters: t.boolean().default(true).notNull(),
    showAdditionalTags: t.boolean().default(true).notNull(),
    showSummary: t.boolean().default(true).notNull(),
    summaryLength: t.int().default(700).notNull(),
  },
  (table) => [
    t.unique("unique_guild_embed_type").on(table.guildSettingsId, table.embedType),
  ],
);

/**
 * Redirect rules (Fox's feature). A guild can define N rules, each with
 * an arbitrary filter object (rating / fandom / type, AND'd together
 * within a rule) and a destination channel/forum/thread ID.
 *
 * Match priority across multiple matching rules, when more than one rule
 * matches the same work: rating > fandom > type (computed at match time
 * in bot.ts, not stored — see ruleSpecificity()).
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

    // Shape: { rating?: string, fandom?: string[], type?: "work" | "series" | "user" | "chapter" }
    // Kept as JSON since the filter shape is variable and fandom may be
    // multi-value; not queried via SQL WHERE, just read + matched in app code.
    filters: t.json().notNull(),

    createdAt: t.timestamp().defaultNow().notNull(),
  },
  (table) => [
    t.index("redirect_rules_guild_idx").on(table.guildSettingsId),
  ],
);

// --- Relations (for query convenience) ---

export const guildSettingsRelations = relations(guildSettings, ({ many }) => ({
  embedFields: many(embedFieldSettings),
  redirectRules: many(redirectRules),
}));

export const embedFieldSettingsRelations = relations(embedFieldSettings, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [embedFieldSettings.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

export const redirectRulesRelations = relations(redirectRules, ({ one }) => ({
  guild: one(guildSettings, {
    fields: [redirectRules.guildSettingsId],
    references: [guildSettings.id],
  }),
}));

/**
 * Embed tracking tables — one per embed type.
 *
 * These intentionally have NO foreign key to guild_settings. An accidental
 * bot kick should not kill active embeds; if the bot is re-invited, the
 * stored IDs are still valid and refresh will still work.
 *
 * channelId is required on all four: Discord's API needs both channelId +
 * messageId to locate and edit a message. messageId alone is not globally
 * resolvable.
 */

export const workEmbeds = table(
  "work_embeds",
  {
    id: t.varchar({ length: 36 }).primaryKey(), // UUID
    guildId: t.varchar({ length: 20 }).notNull(),
    channelId: t.varchar({ length: 20 }).notNull(),
    messageId: t.varchar({ length: 20 }).notNull().unique(),
    workId: t.varchar({ length: 20 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  },
  (table) => [
    t.index("work_embeds_guild_idx").on(table.guildId),
  ],
);

export const chapterEmbeds = table(
  "chapter_embeds",
  {
    id: t.varchar({ length: 36 }).primaryKey(), // UUID
    guildId: t.varchar({ length: 20 }).notNull(),
    channelId: t.varchar({ length: 20 }).notNull(),
    messageId: t.varchar({ length: 20 }).notNull().unique(),
    workId: t.varchar({ length: 20 }).notNull(),
    chapterId: t.varchar({ length: 20 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  },
  (table) => [
    t.index("chapter_embeds_guild_idx").on(table.guildId),
  ],
);

export const seriesEmbeds = table(
  "series_embeds",
  {
    id: t.varchar({ length: 36 }).primaryKey(), // UUID
    guildId: t.varchar({ length: 20 }).notNull(),
    channelId: t.varchar({ length: 20 }).notNull(),
    messageId: t.varchar({ length: 20 }).notNull().unique(),
    seriesId: t.varchar({ length: 20 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  },
  (table) => [
    t.index("series_embeds_guild_idx").on(table.guildId),
  ],
);

export const userEmbeds = table(
  "user_embeds",
  {
    id: t.varchar({ length: 36 }).primaryKey(), // UUID
    guildId: t.varchar({ length: 20 }).notNull(),
    channelId: t.varchar({ length: 20 }).notNull(),
    messageId: t.varchar({ length: 20 }).notNull().unique(),
    username: t.varchar({ length: 255 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  },
  (table) => [
    t.index("user_embeds_guild_idx").on(table.guildId),
  ],
);

/**
 * Embed message index — one row per bot-posted embed message, regardless
 * of type. Exists solely so MessageDelete and MessageDeleteBulk handlers
 * can resolve messageId → embedType in a single query without hitting all
 * four embed tables, and without depending on Discord's message cache.
 *
 * No FK to guild_settings (same reasoning as the four embed tables —
 * accidental kick should not kill active embeds).
 *
 * Writes: insert a row here alongside every insert into work/chapter/
 * series/user embed tables (always in a transaction).
 * Deletes: when a message delete event fires, look up the type here first,
 * then delete from the appropriate embed table + this index together.
 */
export const embedMessageIndex = table("embed_message_index", {
  messageId: t.varchar({ length: 20 }).primaryKey(),
  embedType: t.mysqlEnum(["work", "chapter", "series", "user"]).notNull(),
});
