import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { buildGroupComponents, buildGroupEmbed } from "../../utils/settingsPanel.ts";

export const data = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Choose which fields are shown in Work/Gallery/Chapter/Series/User embeds.");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  // Deferred immediately, before any DB I/O below, so the 3s interaction
  // ACK deadline can't be missed while waiting on the guild settings query.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply({ content: "This command can only be used in a server." });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({
      content: "You need the **Manage Server** permission to change bot settings.",
    });
    return;
  }

  await interaction.editReply({
    embeds: [await buildGroupEmbed(interaction.guildId, 0)],
    components: buildGroupComponents(0),
  });
};
