import { getEmoji } from "./emojis.ts";

// Rating lookup table.
const RATING_INFO: Record<string, { color: number; icon: string }> = {
  "Not Rated": { color: 0xffffff, icon: getEmoji("notrated") },
  "General Audiences": { color: 0x77a50e, icon: getEmoji("general") },
  "Teen And Up Audiences": { color: 0xe8d506, icon: getEmoji("teen") },
  "Mature": { color: 0xde7e28, icon: getEmoji("mature") },
  "Explicit": { color: 0x9c0000, icon: getEmoji("explicit") },
};

// Returns embed sidebar color for works and chapter icon. 
export function embedColor(work: any): number | null {
  if (work?.locked) return null;
  return RATING_INFO[work?.rating]?.color ?? null;
}

// Returns embed ratings icon.
export function ratingIcon(work: any): string | undefined {
  if (work?.locked) return undefined;
  return RATING_INFO[work?.rating]?.icon;
}