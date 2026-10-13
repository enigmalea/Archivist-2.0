import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("vote")
  .setDescription("Vote for Archivist on bot lists!");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const botName = interaction.client.user.username;

  const voteEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`Vote for ${botName}`)
    .setDescription(
      `Votes help more people find ${botName}. You can vote on both sites, and it's free!`,
    )
    .setTimestamp()
    .setFooter({
      text: `Thank you for using ${botName}!`,
      iconURL: "https://www.archivistbot.com/img/logo.png",
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Vote on top.gg")
      .setStyle(ButtonStyle.Link)
      .setURL("https://top.gg/bot/812505952959856690/vote"),
    new ButtonBuilder()
      .setLabel("Vote on Discord Bot List")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discordbotlist.com/bots/archivist/upvote"),
  );

  await interaction.reply({ embeds: [voteEmbed], components: [buttons] });