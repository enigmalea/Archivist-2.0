// Rating lookup table.
const RATING_INFO: Record<string, { color: number; icon: string }> = {
  "Not Rated": { color: 0xffffff, icon: "<:notrated:866825856236519426>" },
  "General Audiences": { color: 0x77a50e, icon: "<:general:866823809180631040>" },
  "Teen And Up Audiences": { color: 0xe8d506, icon: "<:teen:866823893015330826>" },
  "Mature": { color: 0xde7e28, icon: "<:mature:866823956684996628>" },
  "Explicit": { color: 0x9c0000, icon: "<:explicit:866824069050269736>" },
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