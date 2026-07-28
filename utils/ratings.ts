import { getEmoji } from "./emojis.ts";

const RATING_COLORS: Record<string, number> = {
  "Not Rated": 0xffffff,
  "General Audiences": 0x77a50e,
  "Teen And Up Audiences": 0xe8d506,
  "Mature": 0xde7e28,
  "Explicit": 0x9c0000,
};

const RATING_EMOJI_NAMES: Record<string, string> = {
  "Not Rated": "notrated",
  "General Audiences": "general",
  "Teen And Up Audiences": "teen",
  "Mature": "mature",
  "Explicit": "explicit",
};

export function embedColor(work: any): number | null {
  if (work?.locked) return null;
  return RATING_COLORS[work?.rating] ?? null;
}

export function ratingIcon(work: any): string | undefined {
  if (work?.locked) return undefined;
  const emojiName = RATING_EMOJI_NAMES[work?.rating];
  return emojiName ? getEmoji(emojiName) : undefined;
}
