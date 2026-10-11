import "dotenv/config";

import {
  chapterFieldSettings,
  guildSettings,
  redirectRules,
  seriesFieldSettings,
  userFieldSettings,
  workFieldSettings,
} from "../db/schema.ts";

import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/mysql2";
import { inArray } from "drizzle-orm";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

// adjust path

const [sqlitePath, ...flags] = process.argv.slice(2);
const DRY_RUN = flags.includes("--dry-run");

const arg = (name: string): string | undefined => {
  const i = flags.indexOf(`--${name}`);
  return i >= 0 ? flags[i + 1] : undefined;
};

const LIMIT = arg("limit") ? Number.parseInt(arg("limit")!, 10) : Infinity;
const BATCH_SIZE = Number.parseInt(arg("batch-size") ?? "100", 10);
const ONLY = arg("guilds")
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!sqlitePath) {
  console.error(
    "Usage: node dist/scripts/migrate-from-v1.js <1.0.sqlite> [--dry-run]",
  );
  process.exit(1);
}

type OldRow = Record<string, string | number | null>;

type Mapped = {
  guild: typeof guildSettings.$inferInsert;
  work: Omit<typeof workFieldSettings.$inferInsert, "guildSettingsId">;
  chapter: Omit<typeof chapterFieldSettings.$inferInsert, "guildSettingsId">;
  series: Omit<typeof seriesFieldSettings.$inferInsert, "guildSettingsId">;
  user: Omit<typeof userFieldSettings.$inferInsert, "guildSettingsId">;
  rules: { destinationId: string; filters: { type: string } }[];
};

// ---------- helpers ----------

// 1.0 stored toggles as "on"/"off" text.
const on = (v: unknown, fallback: boolean): boolean => {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim().toLowerCase();
  if (["on", "true", "1", "yes"].includes(s)) return true;
  if (["off", "false", "0", "no"].includes(s)) return false;
  return fallback;
};

const length = (v: unknown, fallback: number): number => {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 4096) : fallback;
};

// Discord snowflakes are 17-20 digits. Anything else is junk.
const snowflake = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return /^\d{17,20}$/.test(s) ? s : null;
};

const chunk = <T>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

// ---------- the actual mapping (edit here if a guess below is wrong) ----------

function mapGuild(r: OldRow): Mapped | null {
  const guildId = snowflake(r.GuildID);
  if (!guildId) return null;

  const ign = String(r.Ign ?? "").trim();

  // 1.0 grouped several fields under one toggle; fan each toggle out.
  const pubInfo = on(r.PubInfo, true); // GUESS: words/chapters/language/published/updated/status
  const rate = on(r.Rate, true); // GUESS: rating/warnings/category
  const cPubInfo = on(r.cPubInfo, true);
  const image = on(r.Image, true);

  const rules: Mapped["rules"] = [];
  for (const [col, type] of [
    ["redFic", "work"],
    ["redCh", "chapter"],
    ["redSer", "series"],
    ["redUse", "user"],
  ] as const) {
    const destinationId = snowflake(r[col]);
    if (destinationId) rules.push({ destinationId, filters: { type } });
  }

  return {
    guild: {
      guildId,
      ignoreChar: ign ? [...ign][0] : "%",
      showBasicInfo: on(r.Basic, true),
      showCoverImage: image, // GUESS: Image -> both this and chapter thumbnail
      deleteOriginalLink: on(r.DelLink, false),
      deleteOnUpdate: on(r.DelUpdate, false),
      deleteOnError: on(r.DelErr, false),
      deleteOnDownload: on(r.DelDL, false),
      deleteOnChapter: on(r.DelChapter, false),
      // respondToMaskedLinks defaults true on purpose (matches 1.0 behavior).
    },
    work: {
      showWords: pubInfo,
      showChapters: pubInfo,
      showLanguage: pubInfo,
      showPublished: pubInfo,
      showUpdated: pubInfo,
      showStatus: pubInfo,
      showRating: rate,
      showWarnings: rate,
      showCategory: rate,
      showFandoms: on(r.Fan, true),
      showRelationships: on(r.Rel, true),
      showCharacters: on(r.Ch, true),
      showTags: on(r.AddTags, true),
      showSummary: on(r.Summ, true),
      summaryMaxLength: length(r.SumLength, 700),
    },
    chapter: {
      showWords: cPubInfo,
      showChapters: cPubInfo,
      showPublished: cPubInfo,
      showUpdated: cPubInfo,
      showStatus: cPubInfo,
      showFandoms: on(r.cFan, false),
      showRelationships: on(r.cRel, false),
      showCharacters: on(r.cCh, false),
      showTags: on(r.cAddTags, false),
      showSummary: on(r.cSumm, true),
      summaryMaxLength: length(r.cSumLength, 700),
      showThumbnail: image,
    },
    series: {}, // no 1.0 equivalent; table defaults
    user: {}, // no 1.0 equivalent; table defaults
    rules,
  };
}

// ---------- main ----------

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const oldRows = sqlite
  .prepare(
    `SELECT CAST(GuildID AS TEXT) AS GuildID, Ign, Basic, PubInfo, Rate, Fan, Rel, Ch,
            AddTags, Summ, SumLength, DelLink, cPubInfo, cFan, cRel, cCh, cAddTags,
            cSumm, cSumLength, DelUpdate, DelErr, DelDL, DelChapter, Image,
            redFic, redCh, redSer, redUse
     FROM settings`,
  )
  .all() as OldRow[];

const mapped: Mapped[] = [];
let invalid = 0;
for (const row of oldRows) {
  const m = mapGuild(row);
  if (m) mapped.push(m);
  else {
    invalid++;
    console.warn(`Skipping row with invalid GuildID: ${row.GuildID}`);
  }
}

const pool = mysql.createPool(process.env.DATABASE_URL!);
const db = drizzle(pool);

try {
  // Idempotent: guilds already in the new DB are left alone.
  const existing = new Set(
    (
      await db.select({ guildId: guildSettings.guildId }).from(guildSettings)
    ).map((r) => r.guildId),
  );

  if (ONLY) {
    const known = new Set(mapped.map((m) => m.guild.guildId));
    for (const id of ONLY) {
      if (!known.has(id))
        console.warn(`--guilds: ${id} not found in the 1.0 DB`);
    }
  }

  const candidates = ONLY
    ? mapped.filter((m) => ONLY.includes(m.guild.guildId))
    : mapped;
  const pending = candidates.filter((m) => !existing.has(m.guild.guildId));
  const fresh = pending.slice(0, LIMIT);
  const ruleCount = fresh.reduce((n, m) => n + m.rules.length, 0);

  console.log(
    `1.0 rows: ${oldRows.length} | invalid: ${invalid} | already migrated: ${
      candidates.length - pending.length
    } | this run: ${fresh.length} | remaining after: ${pending.length - fresh.length} | redirect rules this run: ${ruleCount}`,
  );

  if (DRY_RUN) {
    console.log("Dry run, sample mapping:", JSON.stringify(fresh[0], null, 2));
  } else {
    for (const batch of chunk(fresh, BATCH_SIZE)) {
      await db.transaction(async (tx) => {
        await tx.insert(guildSettings).values(batch.map((m) => m.guild));

        const ids = await tx
          .select({ id: guildSettings.id, guildId: guildSettings.guildId })
          .from(guildSettings)
          .where(
            inArray(
              guildSettings.guildId,
              batch.map((m) => m.guild.guildId),
            ),
          );
        const idByGuild = new Map(ids.map((r) => [r.guildId, r.id]));
        const fk = (m: Mapped) => idByGuild.get(m.guild.guildId)!;

        await tx
          .insert(workFieldSettings)
          .values(batch.map((m) => ({ ...m.work, guildSettingsId: fk(m) })));
        await tx
          .insert(chapterFieldSettings)
          .values(batch.map((m) => ({ ...m.chapter, guildSettingsId: fk(m) })));
        await tx
          .insert(seriesFieldSettings)
          .values(batch.map((m) => ({ ...m.series, guildSettingsId: fk(m) })));
        await tx
          .insert(userFieldSettings)
          .values(batch.map((m) => ({ ...m.user, guildSettingsId: fk(m) })));

        const rules = batch.flatMap((m) =>
          m.rules.map((r) => ({
            id: randomUUID(),
            guildSettingsId: fk(m),
            destinationId: r.destinationId,
            destinationType: "channel" as const,
            filters: r.filters,
          })),
        );
        if (rules.length) await tx.insert(redirectRules).values(rules);
      });
      console.log(`Inserted batch of ${batch.length}`);
    }
    console.log("Done.");
  }
} finally {
  await pool.end();
  sqlite.close();
}
