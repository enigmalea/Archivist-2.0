import "dotenv/config";

import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema.ts";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable");
}

// `mode: "default"` tells drizzle real foreign keys are enforced by the
// database (as opposed to "planetscale", which doesn't support them) — true
// for MariaDB/MySQL, and needed for the guildSettings.id -> *.guildSettingsId
// cascade deletes defined in schema.ts to actually work as declared.
//
// enableKeepAlive avoids ECONNRESET on idle pool connections.
export const db = drizzle({
  connection: { uri: databaseUrl, enableKeepAlive: true, keepAliveInitialDelay: 10_000 },
  schema,
  mode: "default",
});