import {
  ChatInputCommandInteraction,
  MessageFlags,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { DBLError, postBotCommands } from "discordbotlist";

import type { APIApplicationCommand } from "discord.js";
import { Api } from "@top-gg/sdk";
import type { RESTPutAPIApplicationCommandsJSONBody } from "discord.js";
import { isDevUser } from "../../utils/devUsers.ts";

export const data = new SlashCommandBuilder()
  .setName("postcommands")
  .setDescription("Dev: push the global command list to discordbotlist.")
  .addBooleanOption((o) =>
    o
      .setName("dry_run")
      .setDescription("Show what would be sent without sending it."),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  if (!isDevUser(interaction.user.id)) {
    await interaction.reply({
      content: "Dev only.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const token = process.env.DBL_TOKEN;
	const topggToken = process.env.TOPGG_TOKEN;
  const botId = interaction.client.application.id;
  const dryRun = interaction.options.getBoolean("dry_run") ?? false;

  // Global commands only, in the raw shape Discord's API returns.
  const commands = (await interaction.client.rest.get(
    Routes.applicationCommands(botId),
  )) as RESTPutAPIApplicationCommandsJSONBody;

  const names = commands.map((c) => `/${c.name}`).join(", ") || "none";

  if (dryRun) {
    await interaction.editReply(
      `Dry run: would send ${commands.length} commands: ${names}`,
    );
    return;
  }

  if (!token) {
    await interaction.editReply("No DBL_TOKEN set, nothing sent.");
    return;
  }

  if (topggToken) {
    await new Api(topggToken).postCommands(
    	commands as unknown as APIApplicationCommand[],
    );
  }

  try {
    await postBotCommands(token, botId, commands);
    await interaction.editReply(
      `Sent ${commands.length} commands to discordbotlist: ${names}`,
    );
  } catch (error) {
    const status =
      error instanceof DBLError
        ? (error.context as { response?: Response } | undefined)?.response
            ?.status
        : undefined;
    console.error("[postcommands] failed:", error);
    await interaction.editReply(
      `Failed to post commands${status ? ` (HTTP ${status})` : ""}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};