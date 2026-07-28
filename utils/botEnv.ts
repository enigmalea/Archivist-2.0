// Both the test and live bot's credentials live in the same .env — this
// picks which pair is "active" via BOT_ENV, so switching between them is a
// one-line edit (BOT_ENV=test / BOT_ENV=prod) instead of swapping files.
//
// Expected .env shape:
//   BOT_ENV=test
//   TOKEN_TEST=...
//   CLIENT_ID_TEST=...
//   TOKEN_PROD=...
//   CLIENT_ID_PROD=...
export type BotEnv = "test" | "prod";

export interface BotCredentials {
  env: BotEnv;
  token: string;
  clientId: string;
}

function getRawBotEnv(): BotEnv {
  const raw = process.env.BOT_ENV;
  if (raw !== "test" && raw !== "prod") {
    throw new Error(
      `BOT_ENV must be set to "test" or "prod" in .env (got: ${JSON.stringify(raw)}).`,
    );
  }
  return raw;
}

// Reads BOT_ENV plus the matching TOKEN_*/CLIENT_ID_* pair. Throws a clear,
// specific error naming exactly which var is missing rather than letting a
// blank token/clientId silently propagate into a Discord API call.
export function getBotCredentials(): BotCredentials {
  const env = getRawBotEnv();
  const token = env === "test" ? process.env.TOKEN_TEST : process.env.TOKEN_PROD;
  const clientId = env === "test" ? process.env.CLIENT_ID_TEST : process.env.CLIENT_ID_PROD;

  if (!token || !clientId) {
    const tokenVar = env === "test" ? "TOKEN_TEST" : "TOKEN_PROD";
    const clientIdVar = env === "test" ? "CLIENT_ID_TEST" : "CLIENT_ID_PROD";
    const missing = [!token && tokenVar, !clientId && clientIdVar].filter(Boolean).join(", ");
    throw new Error(`Cannot start — BOT_ENV is "${env}" but ${missing} not set in .env.`);
  }

  return { env, token, clientId };
}