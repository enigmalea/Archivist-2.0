import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command } from "..";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.reply("Pong! The TS Rewrite has begun!");
};
