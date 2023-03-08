import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { Command } from "..";

export const data = new SlashCommandBuilder()
  .setName("support")
  .setDescription("Want to support Archivist? Here's how!");

export const execute: Command["execute"] = async (
  _,
  interaction: ChatInputCommandInteraction
) => {
  const freeOptions = `**✨ [Follow @\\_ArchivistBot\\_ on Twitter](https://twitter.com/_ArchivistBot_)**
▸ Make sure to like and retweet **@\\_ArchivistBot\\_'s** tweets.

**✨ [Join the Support Server](https://discord.gg/FzhC9bVFva)**
▸ Have an idea for a feature or something you'd like to see? Join the Support Server to share it with the dev.

**✨ Vote and rate the bot on botlists**
▸ [DiscordBotList](https://discordbotlist.com/bots/archivist)
▸ [top.gg](https://top.gg/bot/812505952959856690)

**✨ Tell your friends**
▸ Post about <:logo:848627809647329320> **Archivist** on tumblr, twitter, or other fandom spaces.
▸ Ask mods to add <:logo:848627809647329320> **Archivist** to Discord servers you're in.`;

  const paidOptions = `__There are no premium or paid features to use <:logo:848627809647329320> **Archivist**.__ This is not a for profit project. However, if you would like to donate to help offset the cost of hosting or to just say thank you, feel free to visit my ko-fi.
    <:kofi:848631801046892604> **[enigmalea](https://ko-fi.com/enigmalea)**\n`;

  const supportEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle("Support Archivist")
    .setDescription(
      `Thank you for wanting to support the bot. Below you'll find some ideas for what you can do to help Archivist grow!`
    )
    .addFields({
      name: "💡 HOW TO SUPPORT FOR FREE 💡",
      value: `${freeOptions}`,
    })
    .addFields({ name: "PAID SUPPORT", value: `${paidOptions}` })
    .setTimestamp()
    .setFooter({
      text: "Thank you for using Archivist!",
      iconURL: "https://www.archivistbot.com/img/logo.png",
    });

  await interaction.reply({ embeds: [supportEmbed] });
};
