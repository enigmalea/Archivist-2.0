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

// Used by bots to handle incoming URLs
// Generic handler for fetching + posting an AO3 embed, used for works,
// series, and user links. Optionally checks for a locked work via
// onLocked — series/users never lock, so they simply omit it.
export async function handleAo3Url({
  message,
  url,
  ao3Limiter,
  embedFn,
  authError,
}: {
  message: any;
  url: string;
  ao3Limiter: any;
  embedFn: (url: string) => Promise<any>;
  authError?: any;
}): Promise<void> {
  const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");

  try {
    const urlResponse = await ao3Limiter.schedule(() => embedFn(url));

    if (authError && urlResponse && typeof urlResponse === "object" && "locked" in urlResponse) {
      await waitingMsg.edit(authError);
      return;
    }

    await waitingMsg.edit({ content: "", embeds: [urlResponse] });
  } catch (error) {
    await waitingMsg.edit({
      content: "Failed to fetch AO3 content. Please try again later.",
      embeds: [],
    });
    throw error;
  }
}