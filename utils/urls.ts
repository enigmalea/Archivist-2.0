import { resolveRedirectRule, updateRedirectRuleThreadId, type RedirectType } from "./redirects.ts";

export function extractPathnameGroup(url: string, regex: RegExp): string {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(regex);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

// Extract a username from a profile url
export function getUsernameFromUrl(userURL: string): string {
  return extractPathnameGroup(userURL, /\/users\/([^/?#]+)/i);
}

// Extract a seriesID from a seriesURL
export function getSeriesIdFromUrl(seriesURL: string): string {
  return extractPathnameGroup(seriesURL, /\/series\/(\d+)/i);
}

export interface RedirectSendResult {
  channelId: string;
}

export interface RedirectableSendPayload {
  embeds: any[];
  components?: any[];
  files?: any[];
}

// Regular channel messages can't be made ephemeral — that's an
// interaction-response-only concept, and this fires from a plain
// MessageCreate, not a command interaction. Auto-deleting these notices
// after a few seconds is the closest equivalent: they don't linger and
// clutter the channel like a normal message would.
const REDIRECT_NOTICE_LIFETIME_MS = 10_000;

export async function showTemporaryNotice(
  waitingMsg: any,
  content: string,
  lifetimeMs: number,
): Promise<void> {
  await waitingMsg.edit(content);
  setTimeout(() => {
    waitingMsg.delete().catch(() => {});
  }, lifetimeMs);
}

// Sends an embed payload, redirecting to a channel/thread/forum configured
// via /redirect if a rule matches. Falls back to editing waitingMsg in
// place when no rule matches, the target is gone, or the guild has no
// rules. Returns where it ended up so callers (e.g. a gallery follow-up)
// can be told to land in the same place — resolveRedirectRule is
// deterministic for the same guildId + meta, so a second independent call
// with the same meta naturally lands on the same rule/thread.
export async function sendRedirectableEmbed(
  message: any,
  payload: RedirectableSendPayload,
  meta: { rating?: string; fandoms?: string[]; type: RedirectType },
  waitingMsg: any,
): Promise<RedirectSendResult | null> {
  const rule = message.guildId ? await resolveRedirectRule(message.guildId, meta) : null;

  if (rule && rule.destinationId !== message.channelId) {
    const dest = await message.guild?.channels.fetch(rule.destinationId).catch(() => null);

    if (!dest) {
      console.warn(`Redirect target ${rule.destinationId} unavailable; falling back.`);
      await waitingMsg.edit({ content: "", ...payload });
      return null;
    }

    switch (rule.destinationType) {
      case "channel":
      case "thread": {
        await dest.send(payload);
        await showTemporaryNotice(waitingMsg, `➡️ Sent to <#${rule.destinationId}>`, REDIRECT_NOTICE_LIFETIME_MS);
        return { channelId: rule.destinationId };
      }

      case "forum": {
        // Reuse the thread from the first time this rule fired, if it still exists.
        if (rule.forumThreadId) {
          const existing = await dest.threads.fetch(rule.forumThreadId).catch(() => null);
          if (existing) {
            if (existing.archived) await existing.setArchived(false).catch(() => {});
            await existing.send(payload);
            await showTemporaryNotice(waitingMsg, `➡️ Sent to <#${rule.forumThreadId}>`, REDIRECT_NOTICE_LIFETIME_MS);
            return { channelId: rule.forumThreadId };
          }
        }

        // No saved thread (or it was deleted) — create a new one and remember it.
        const thread = await dest.threads.create({ name: "AO3 Redirect", message: payload });
        if (message.guildId) {
          await updateRedirectRuleThreadId(message.guildId, rule.id, thread.id);
        }
        await showTemporaryNotice(waitingMsg, `➡️ Sent to new thread <#${thread.id}>`, REDIRECT_NOTICE_LIFETIME_MS);
        return { channelId: thread.id };
      }
    }
  }

  await waitingMsg.edit({ content: "", ...payload });
  return null;
}