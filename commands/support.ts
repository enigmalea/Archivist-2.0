import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { ClientWithCommands } from "../bot";
import { stripIndents } from "common-tags";

export const data = new SlashCommandBuilder()
  .setName("support")
  .setDescription("Want to support Archivist? Here's how!");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  // Defines variables for embed.
  const botName = interaction.client.user.username;
  const freeOptions = stripIndents`**✨ [Join the Support Server](https://discord.gg/FzhC9bVFva)**
    ▸ Have an idea for a feature or something you'd like to see? Join the Support Server to share it with the dev.

    **✨ Vote and rate the bot on botlists**
    ▸ [DiscordBotList](https://discordbotlist.com/bots/archivist)
    ▸ [top.gg](https://top.gg/bot/812505952959856690)

    **✨ Tell your friends**
    ▸ Post about <:logo:848627809647329320> **${botName}** on tumblr, twitter, or other fandom spaces.
    ▸ Ask mods to add <:logo:848627809647329320> **${botName}** to Discord servers you're in.`;

  const paidOptions = `__There are no premium or paid features to use <:logo:848627809647329320> **${botName}**.__ This is not a for profit project. However, if you would like to donate to help offset the cost of hosting or to just say thank you, feel free to visit my ko-fi.
    <:kofi:848631801046892604> **[enigmalea](https://ko-fi.com/enigmalea)**\n`;

  // Creates embed to post.
  const supportEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`Support ${botName}`)
    .setDescription(
      `Thank you for wanting to support ${botName}. Below you'll find some ideas for what you can do to help ${botName} grow!`
    )
    .addFields({
      name: "💡 HOW TO SUPPORT FOR FREE 💡",
      value: `${freeOptions}`,
    })
    .addFields({ name: "PAID SUPPORT", value: `${paidOptions}` })
    .setTimestamp()
    .setFooter({
      text: `Thank you for using ${botName}!`,
      iconURL: "https://www.archivistbot.com/img/logo.png",
    });

  await interaction.reply({ embeds: [supportEmbed] });
};
