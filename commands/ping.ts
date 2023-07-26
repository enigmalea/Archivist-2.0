import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with the roundtrip latency of the bot.");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const sent = await interaction.reply({
    content: "Pinging...",
    fetchReply: true,
  });
  interaction.editReply(
    `Pong! Roundtrip latency: ${
      sent.createdTimestamp - interaction.createdTimestamp
    }ms`
  );
};
