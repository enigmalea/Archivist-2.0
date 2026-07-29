import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with the roundtrip latency of the bot.");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const { resource } = await interaction.reply({
    content: "Pinging...",
    withResponse: true,
  });

  const latency = resource!.message!.createdTimestamp - interaction.createdTimestamp;

  await interaction.editReply(`Pong! Roundtrip latency: ${latency}ms`);
};