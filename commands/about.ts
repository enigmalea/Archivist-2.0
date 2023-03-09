import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { ClientWithCommands, Command } from "..";

import { version as botVersion } from "../package.json";

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("Provides information about Archivist");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const client = interaction.client;
  const botName = client.user?.username;
  const serverCount = client.guilds.cache.size;
  const launchDate = "16 Mar 2021";
  // shard = ctx.guild.shard_id

  // Calculates bot uptime
  let totalSeconds = client.uptime! / 1000;
  let days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.floor(totalSeconds % 60);

  const botUptime = `${days} day ${hours}:${minutes}:${seconds}`;

  // Constructs links list
  const serverURL = "https://discord.gg/FzhC9bVFva";
  const twitterURL = "https://twitter.com/_ArchivistBot_";
  const homepageURL = "https://www.archivistbot.com";
  const inviteURL =
    "https://discord.com/api/oauth2/authorize?client_id=812505952959856690&permissions=294205549632&scope=bot";
  const privacyPolicy = "https://www.archivistbot.com/privacy";

  const links = `💻 [archivistbot.com](${homepageURL})\n<:add:906993610329841734> [Invite to Your Server](${inviteURL})\n❔ [Support Server](${serverURL})\n<:twitter:906993635508248596> [@\\_ArchivistBot\\_](${twitterURL})\n🔒 [Privacy Policy](${privacyPolicy})`;

  const stats = `**Servers:** ${serverCount}\n**Shard ID:** Coming Soon\n**Launched:** ${launchDate}`;

  const disclosure = `*${botName} does not store any user messages. For information on what information the bot stores and how it uses the information please review the privacy policy at the link above.*`;

  const aboutEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`About ${botName}`)
    .addFields(
      { name: "Owner/Developer", value: "enigmalea#6509", inline: true },
      { name: "Version", value: `${botVersion}`, inline: true },
      { name: "Uptime", value: `${botUptime}`, inline: true }
    )
    .addFields({
      name: "Stats",
      value: `${stats}`,
    })
    .addFields({
      name: "Links",
      value: `${links}`,
    })
    .addFields({
      name: "\u200B",
      value: `${disclosure}`,
    })
    .setTimestamp()
    .setFooter({
      text: `Thank you for using ${botName}!`,
      iconURL: "https://www.archivistbot.com/img/logo.png",
    });

  await interaction.reply({ embeds: [aboutEmbed] });
};
