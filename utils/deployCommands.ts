import { REST, Routes } from "discord.js";
import { fileURLToPath, pathToFileURL } from "node:url";

import fs from "node:fs";
import { getBotCredentials } from "./botEnv.ts";
import path from "node:path";

// Guild IDs that dev-only commands (commands/dev/*) should be registered
// to, e.g. DEV_SERVERS=["123456789012345678"] in .env.
function getDevServerIds(): string[] {
  const raw = process.env.DEV_SERVERS;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      throw new Error("DEV_SERVERS must be a JSON array of strings");
    }
    return parsed;
  } catch {
    return [];
  }
}

// This file lives at dist/utils/deployCommands.js at runtime, so the
// commands root (dist/commands) is one level up from dist/utils.
function getCommandsRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, "..", "commands");
}

export interface DevServerResult {
  guildId: string;
  count?: number;
  error?: string;
}

export interface DeployResult {
  globalCount: number;
  devCommandCount: number;
  devServerResults: DevServerResult[];
  // True when there are dev commands to register but no DEV_SERVERS is
  // configured, so nothing was registered to any guild.
  skippedDevServers: boolean;
}

// Reads every command file straight from disk (not from an already-loaded
// client.commands Collection), splits them into global vs. dev-only the
// same way commands/dev/* is treated everywhere else, and registers each
// with Discord. Safe to call repeatedly — re-registering is idempotent.
export async function deployCommands(): Promise<DeployResult> {
  const commandsRoot = getCommandsRoot();
  const folders = fs.readdirSync(commandsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const globalCommands: unknown[] = [];
  const devCommands: unknown[] = [];

  for (const folder of folders) {
    const folderPath = path.join(commandsRoot, folder);
    const files = fs.readdirSync(folderPath).filter((file) => file.endsWith(".js"));

    for (const file of files) {
      const filePath = path.join(folderPath, file);

      // Cache-bust so this always reflects what's on disk right now, even
      // if a prior /reload already imported an older version of the file.
      const fileUrl = pathToFileURL(filePath);
      fileUrl.searchParams.set("update", Date.now().toString());
      const command = await import(fileUrl.href);

      if ("data" in command && "execute" in command) {
        const target = folder === "dev" ? devCommands : globalCommands;
        target.push(command.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }
  }

  const { token, clientId } = getBotCredentials();
  const rest = new REST().setToken(token);

  await rest.put(Routes.applicationCommands(clientId), { body: globalCommands });

  const devServerResults: DevServerResult[] = [];
  const devServerIds = getDevServerIds();
  const skippedDevServers = devCommands.length > 0 && devServerIds.length === 0;

  if (devCommands.length > 0 && !skippedDevServers) {
    for (const guildId of devServerIds) {
      try {
        const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: devCommands,
        });
        devServerResults.push({ guildId, count: (data as unknown[]).length });
      } catch (error) {
        devServerResults.push({
          guildId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    globalCount: globalCommands.length,
    devCommandCount: devCommands.length,
    devServerResults,
    skippedDevServers,
  };
}