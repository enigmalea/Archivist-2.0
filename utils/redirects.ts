import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "../db/index.ts";
import { guildSettings, redirectRules } from "../db/schema.ts";
import { getOrCreateGuildSettingsId } from "./settings.ts";

const MAX_RULES_PER_GUILD = 25;

export type RedirectType = "work" | "chapter" | "series" | "user";
export type RedirectDestinationType = "channel" | "thread" | "forum";

export interface RedirectRule {
  id: string;
  destinationId: string;
  destinationType: RedirectDestinationType;
  forumThreadId?: string;
  rating?: string;
  fandom?: string;
  type?: RedirectType;
}

interface RedirectFilters {
  rating?: string;
  fandom?: string;
  type?: RedirectType;
}

function rowToRule(row: typeof redirectRules.$inferSelect): RedirectRule {
  const filters = (row.filters as RedirectFilters | null) ?? {};
  return {
    id: row.id,
    destinationId: row.destinationId,
    destinationType: row.destinationType,
    forumThreadId: row.forumThreadId ?? undefined,
    rating: filters.rating,
    fandom: filters.fandom,
    type: filters.type,
  };
}

// Cached per guild for the same reason as the settings bundle
// (utils/settings.ts): resolveRedirectRule runs for every AO3 link posted
// in every guild, and rules change rarely (an admin running /redirect
// add/remove). Every write below invalidates this so an admin's own change
// is visible immediately rather than waiting out the TTL.
const CACHE_TTL_MS = 30_000;
const ruleCache = new Map<string, { data: RedirectRule[]; expiresAt: number }>();

function invalidateRuleCache(guildId: string): void {
  ruleCache.delete(guildId);
}

async function findGuildSettingsRow(guildId: string) {
  return db.query.guildSettings.findFirst({ where: eq(guildSettings.guildId, guildId) });
}

async function fetchRules(guildId: string): Promise<RedirectRule[]> {
  // A guild with no guild_settings row has never written anything at all
  // (rows are only created lazily, on first write — see
  // getOrCreateGuildSettingsId), so it can't have any redirect rules either.
  const guildRow = await findGuildSettingsRow(guildId);
  if (!guildRow) return [];

  const rows = await db.query.redirectRules.findMany({
    where: eq(redirectRules.guildSettingsId, guildRow.id),
  });
  return rows.map(rowToRule);
}

export async function listRedirectRules(guildId: string): Promise<RedirectRule[]> {
  const cached = ruleCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const data = await fetchRules(guildId);
  ruleCache.set(guildId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function addRedirectRule(
  guildId: string,
  rule: Omit<RedirectRule, "id">,
): Promise<RedirectRule> {
  const existing = await listRedirectRules(guildId);
  if (existing.length >= MAX_RULES_PER_GUILD) {
    throw new Error(`A server can have at most ${MAX_RULES_PER_GUILD} redirect rules.`);
  }

  const guildSettingsId = await getOrCreateGuildSettingsId(guildId);
  const newRule: RedirectRule = { id: randomUUID().slice(0, 8), ...rule };

  const filters: RedirectFilters = {};
  if (newRule.rating) filters.rating = newRule.rating;
  if (newRule.fandom) filters.fandom = newRule.fandom;
  if (newRule.type) filters.type = newRule.type;

  try {
    await db.insert(redirectRules).values({
      id: newRule.id,
      guildSettingsId,
      destinationId: newRule.destinationId,
      destinationType: newRule.destinationType,
      filters,
    });
  } catch (error) {
    console.error(`Failed to save redirect rule for guild ${guildId}.`, error);
    throw new Error("Couldn't save the redirect rule, please try again.");
  }

  invalidateRuleCache(guildId);
  return newRule;
}

export async function removeRedirectRule(guildId: string, id: string): Promise<boolean> {
  const guildRow = await findGuildSettingsRow(guildId);
  if (!guildRow) return false;

  // Confirms the rule actually belongs to this guild before deleting —
  // rule IDs are short (8 hex chars) and not guild-scoped in the URL/UI, so
  // this stops one guild from deleting another's rule by guessing an ID.
  const existing = await db.query.redirectRules.findFirst({
    where: and(eq(redirectRules.id, id), eq(redirectRules.guildSettingsId, guildRow.id)),
  });
  if (!existing) return false;

  await db.delete(redirectRules).where(eq(redirectRules.id, id));
  invalidateRuleCache(guildId);
  return true;
}

// Persists the thread ID Discord assigned when a forum redirect created its
// first thread, so subsequent redirects post there instead of creating a new
// one each time.
export async function updateRedirectRuleThreadId(
  guildId: string,
  ruleId: string,
  threadId: string,
): Promise<void> {
  await db.update(redirectRules).set({ forumThreadId: threadId }).where(eq(redirectRules.id, ruleId));
  invalidateRuleCache(guildId);
}

// First rule (in creation order) where every set field matches wins. Unset
// fields on a rule act as wildcards. Returns null when nothing matches (or
// if anything goes wrong), so the caller always falls back to today's
// behavior (post in the original channel) instead of breaking the message.
export async function resolveRedirectRule(
  guildId: string,
  target: { rating?: string; fandoms?: string[]; type: RedirectType },
): Promise<RedirectRule | null> {
  try {
    const rules = await listRedirectRules(guildId);

    for (const rule of rules) {
      if (rule.rating && rule.rating !== target.rating) continue;
      if (rule.type && rule.type !== target.type) continue;
      if (
        rule.fandom &&
        !(target.fandoms ?? []).some((fandom) =>
          fandom.toLowerCase().includes(rule.fandom!.toLowerCase()),
        )
      ) {
        continue;
      }

      return rule;
    }
  } catch (error) {
    console.error(
      `Redirect rule lookup failed for guild ${guildId}; skipping redirect.`,
    );
    console.error(error);
  }

  return null;
}
