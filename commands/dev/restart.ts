import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { devOnlyError, isDevUser } from "../../utils/devUsers.ts";

import type { ClientWithCommands } from "../../bot.ts";

export const data = new SlashCommandBuilder()
  .setName("restart")
  .setDescription("[Dev] Restart the bot process.")
  .addStringOption((option) =>
    option
      .setName("scope")
      .setDescription("Restart just this shard, or every shard. Defaults to this shard.")
      .addChoices(
        { name: "This shard", value: "shard" },
        { name: "All shards", value: "all" },
      ),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  if (!isDevUser(interaction.user.id)) {
    await interaction.reply(devOnlyError);
    return;
  }

  const client = interaction.client as ClientWithCommands;

  if (!client.shard) {
    await interaction.reply({
      content: "This client isn't running under a ShardingManager, so it can't be respawned this way.",
      ephemeral: true,
    });
    return;
  }

  const scope = interaction.options.getString("scope") ?? "shard";

  // Reply before triggering the respawn — once we ask for a restart, this
  // process (or all of them, on "all") gets killed and relaunched, so the
  // interaction needs to already be answered.
  await interaction.reply({
    content:
      scope === "all"
        ? "Restarting all shards — this'll take a few seconds per shard, picking up whatever's currently built in `dist/`."
        : `Restarting shard ${client.shard.ids[0]} — back in a few seconds, picking up whatever's currently built in \`dist/\`.`,
    ephemeral: true,
  });

  if (scope === "all") {
    client.shard
      .respawnAll({ shardDelay: 5500, respawnDelay: 500, timeout: 30000 })
      .catch((error) => {
        console.error("Failed to respawn all shards:", error);
      });
  } else {
    // No client-side single-shard respawn exists in discord.js — ask the
    // ShardingManager (index.ts) to do it via a custom IPC message instead.
    client.shard.send({ type: "shardRestartRequest" }).catch((error) => {
      console.error("Failed to send shard restart request:", error);
    });
  }
};