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
  workCache,
  ao3Limiter,
  worksEmbed,
  getWorkDetailsFromUrl,
  isCachedWorkError,
  authError,
}: {
  message: any;
  url: string;
  // accept any cache-like with get/set (node-cache, Map-like, etc.)
  workCache: { get(key: any): any; set(key: any, value: any): any };
  ao3Limiter: any;
  worksEmbed: (url: string) => Promise<any>;
  // allow workId to be number or string to match external getWorkDetailsFromUrl
  getWorkDetailsFromUrl: (opts: { url: string }) => {
    workId: string | number;
    chapterId?: number;
    collectionName?: string;
    [k: string]: any;
  };
  isCachedWorkError: (v: any) => boolean;
  authError: any;
}): Promise<boolean> {
  const workId = getWorkDetailsFromUrl({ url }).workId;
  const cachedWork = workCache.get(workId) as any | null;

  if (cachedWork) {
    if (isCachedWorkError(cachedWork)) {
      await message.channel.send(cachedWork.payload);
    } else {
      await message.channel.send({ embeds: [cachedWork] });
    }
    return true;
  }

  const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");
  try {
    const urlResponse = await ao3Limiter.schedule(() => worksEmbed(url));
    if (urlResponse) workCache.set(workId, urlResponse);
    await waitingMsg.edit({ content: "", embeds: [urlResponse!] });
  } catch (error) {
    if (error === "locked") {
      workCache.set(workId, { type: "error", payload: authError });
      await waitingMsg.edit(authError);
    }
  }

  return false;
}