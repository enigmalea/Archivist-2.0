function parseDevUserIds(): Set<string> {
  const raw = process.env.DEV_USER_IDS;
  if (!raw) {
    console.warn(
      "[devUsers] DEV_USER_IDS is not set — no user will be able to run dev-only commands.",
    );
    return new Set();
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      throw new Error("DEV_USER_IDS must be a JSON array of strings");
    }
    return new Set(parsed);
  } catch (err) {
    console.warn(
      `[devUsers] Failed to parse DEV_USER_IDS, no dev commands will be usable: ${err}`,
    );
    return new Set();
  }
}

const DEV_USER_IDS = parseDevUserIds();

export function isDevUser(userId: string): boolean {
  return DEV_USER_IDS.has(userId);
}

export const devOnlyError = {
  content: "This command is restricted to bot developers.",
  ephemeral: true,
};