import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";

import { isDevUser } from "../../utils/devUsers.ts";
import { postStats } from "../../utils/stats.ts";

export const data = new SlashCommandBuilder()
  .setName("poststats")
  .setDescription("Dev: push server counts to top.gg and discordbotlist.")
  .addBooleanOption((o) =>
    o.setName("dry_run").setDescription("Log the payload without sending it."),
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

  const dryRun = interaction.options.getBoolean("dry_run") ?? false;
  const { stats, lines } = await postStats(interaction.client.shard!, {
    dryRun,
  });

  await interaction.editReply(
    `Servers: ${stats.guilds}, users: ${stats.users}, shards: ${stats.shards}\n${lines.join("\n")}`,
  );
};