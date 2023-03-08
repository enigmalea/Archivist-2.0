import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command } from "..";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

export const execute: Command["execute"] = async (
  _,
  interaction: ChatInputCommandInteraction
) => {
  await interaction.reply("Pong! The JS Rewrite has begun!");
};
