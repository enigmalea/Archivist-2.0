import type { ClientWithCommands } from "../bot.ts";

let emojiMap: Map<string, string> | null = null;

// Fetches this app's own emoji set and builds a name -> mention string map.
// Because emojis are scoped per-app, this naturally resolves to the right
// set for whichever bot (test or live) is running the token.
export async function loadEmojis(client: ClientWithCommands): Promise<void> {
  const emojis = await client.application?.emojis.fetch();
  emojiMap = new Map(
    emojis?.map((emoji) => [emoji.name!, emoji.toString()]) ?? [],
  );
}

export function getEmoji(name: string): string {
  const emoji = emojiMap?.get(name);
  if (!emoji) {
    console.warn(`[emojis] No emoji found for "${name}" — check it's uploaded to this app.`);
  }
  return emoji ?? "";
}