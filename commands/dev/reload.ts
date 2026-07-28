import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ClientWithCommands } from "../../bot.ts";
import { devOnlyError } from "../../utils/devUsers.ts";
import fs from "node:fs";
import { invalidateHelpCache } from "../general/help.ts";
import { isDevUser } from "../../utils/devUsers.ts";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This file lives at dist/commands/dev/reload.js at runtime, so the
// commands root (dist/commands) is one level up.
const commandsRoot = path.join(__dirname, "..");

export const data = new SlashCommandBuilder()
  .setName("reload")
  .setDescription("[Dev] Reload one command's code, or all of them, without restarting the bot.")
  .addStringOption((option) =>
    option
      .setName("command")
      .setDescription("Name of the command to reload. Leave blank to reload every command.")
      .setRequired(false),
  );

// Searches every commands/<folder> for a file named `${commandName}.js`.
// Returns the full path, or null if no matching file exists anywhere.
function findCommandFile(commandName: string): string | null {
  const folders = fs.readdirSync(commandsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const folder of folders) {
    const candidate = path.join(commandsRoot, folder, `${commandName}.js`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Full paths to every command file across every commands/<folder>, for the
// reload-all path.
function listAllCommandFiles(): string[] {
  const folders = fs.readdirSync(commandsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const files: string[] = [];
  for (const folder of folders) {
    const folderPath = path.join(commandsRoot, folder);
    const commandFiles = fs
      .readdirSync(folderPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      files.push(path.join(folderPath, file));
    }
  }

  return files;
}

// Re-imports a single command file with a cache-busting query string and
// swaps it into client.commands. Throws on failure — caller decides how to
// report that (immediate reply for a single reload, collected into a list
// of failures for reload-all).
async function reloadCommandFile(
  client: ClientWithCommands,
  filePath: string,
): Promise<string> {
  const fileUrl = pathToFileURL(filePath);
  fileUrl.searchParams.set("update", Date.now().toString());

  const newCommand = await import(fileUrl.href);

  if (!("data" in newCommand) || !("execute" in newCommand)) {
    throw new Error(
      `${path.basename(filePath)} is missing a required "data" or "execute" export.`,
    );
  }

  client.commands.set(newCommand.data.name, newCommand);
  return newCommand.data.name;
}

export const execute = async (interaction: ChatInputCommandInteraction) => {
  if (!isDevUser(interaction.user.id)) {
    await interaction.reply(devOnlyError);
    return;
  }

  const commandName = interaction.options.getString("command");
  const client = interaction.client as ClientWithCommands;

  // No command name given — reload everything.
  if (!commandName) {
    await interaction.deferReply({ ephemeral: true });

    const reloaded: string[] = [];
    const failed: { file: string; error: string }[] = [];

    for (const filePath of listAllCommandFiles()) {
      try {
        reloaded.push(await reloadCommandFile(client, filePath));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ file: path.basename(filePath), error: message });
      }
    }

    // Reloaded commands may have changed descriptions/options; help caches
    // its entries on first build, so invalidate once after the full pass.
    invalidateHelpCache();

    const summary = [`Reloaded ${reloaded.length} command(s).`];
    if (failed.length > 0) {
      summary.push(
        `Failed to reload ${failed.length}:`,
        ...failed.map((f) => `\`${f.file}\`: ${f.error}`),
      );
    }

    await interaction.editReply({ content: summary.join("\n") });
    return;
  }

  // A specific command name was given — reload just that one.
  const filePath = findCommandFile(commandName);
  if (!filePath) {
    await interaction.reply({
      content: `No command file found for \`${commandName}\`.`,
      ephemeral: true,
    });
    return;
  }

  try {
    const reloadedName = await reloadCommandFile(client, filePath);

    // The help command caches its entries on first build; a reloaded
    // command may have a changed description/options, so invalidate it.
    invalidateHelpCache();

    await interaction.reply({
      content: `Command \`${reloadedName}\` was reloaded!`,
      ephemeral: true,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    await interaction.reply({
      content: `There was an error while reloading command \`${commandName}\`:\n\`${message}\``,
      ephemeral: true,
    });
  }
};