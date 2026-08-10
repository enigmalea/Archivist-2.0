import { RecentFailureError } from "./cache.ts";

// How long an error notice stays before it's auto-deleted.
export const ERROR_MESSAGE_LIFETIME_MS = 20 * 1000;

const GENERIC_AO3_FAILURE_NOTICE = "⚠️ Something went wrong fetching that from AO3.";
const RECENT_FAILURE_NOTICE =
  "⏳ AO3 just failed to load this a moment ago and hasn't had time to recover yet — try again in a few seconds.";

// Fresh failure vs. still-in-cooldown from a moments-ago attempt.
export function getAo3FailureNotice(error: unknown): string {
  return error instanceof RecentFailureError ? RECENT_FAILURE_NOTICE : GENERIC_AO3_FAILURE_NOTICE;
}

interface DeletableMessage {
  delete: () => Promise<unknown>;
}

// Deletes an already-sent message after a delay.
export function scheduleMessageDeletion(
  message: DeletableMessage | null | undefined,
  delayMs: number = ERROR_MESSAGE_LIFETIME_MS,
): void {
  if (!message) return;
  setTimeout(() => {
    message.delete().catch(() => {});
  }, delayMs);
}
