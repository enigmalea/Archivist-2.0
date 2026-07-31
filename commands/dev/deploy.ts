import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { devOnlyError, isDevUser } from "../../utils/devUsers.ts";

import { deployCommands } from "../../utils/deployCommands.ts";

export const data = new SlashCommandBuilder()
  .setName("deploy")
  .setDescription(
    "[Dev] Re-register slash commands with Discord from what's currently built in dist/.",
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  if (!isDevUser(interaction.user.id)) {
    await interaction.reply(devOnlyError);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await deployCommands();

    const lines = [`Registered ${result.globalCount} global command(s).`];

    if (result.devCommandCount > 0) {
      if (result.skippedDevServers) {
        lines.push(
          `Skipped ${result.devCommandCount} dev command(s) — no DEV_SERVERS configured.`,
        );
      } else {
        for (const r of result.devServerResults) {
          lines.push(
            r.error
              ? `Failed for guild ${r.guildId}: ${r.error}`
              : `Registered ${result.devCommandCount} dev command(s) for guild ${r.guildId}.`,
          );
        }
      }
    }

    await interaction.editReply({ content: lines.join("\n") });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    await interaction.editReply({ content: `🛑 Deploy failed: ${message}` });
  }
};