import { cachedGetWork } from "./cache.ts";

/* 
URL UTILITIES
*/
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

// Used by bots to handle incoming works URLs
export async function handleWorkUrl({
  message,
  url,
  ao3Limiter,
  worksEmbed,
  authError,
}: {
  message: any;
  url: string;
  ao3Limiter: any;
  worksEmbed: (url: string) => Promise<any>;
  authError: any;
}): Promise<void> {
  const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");

  const urlResponse = await ao3Limiter.schedule(() => worksEmbed(url));

  if (urlResponse.locked) {
    await waitingMsg.edit(authError);
    return;
  }
  await waitingMsg.edit({ content: "", embeds: [urlResponse] });
}