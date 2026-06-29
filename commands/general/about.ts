import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { oneLine, stripIndents } from "common-tags";

// Import Archivist version
const settings = await import(
  new URL("../../../package.json", import.meta.url).href,
  { with: { type: "json" } }
);

// Construct text variables for 
const launchDate = "16 Mar 2021";
const serverURL = "https://discord.gg/FzhC9bVFva";
const homepageURL = "https://www.archivistbot.com";
const CLIENT_ID = process.env.CLIENT_ID_PROD;
if (!CLIENT_ID) {
  throw new Error("Missing CLIENT_ID environment variable");
}
const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=395137`;
const privacyPolicy = "https://www.archivistbot.com/privacy";

const formatUptime = (uptimeMs: number) => {
  const totalSeconds = Math.floor(uptimeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days} day ${hours}:${minutes}:${seconds}`;
};

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("Provides information about Archivist");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const botName = interaction.client.user?.username ?? "Archivist";
  const botVersion = settings.default.version;

  const shard = interaction.client.shard;
  if (!shard) {
    await interaction.reply("This command requires sharding support.");
    return;
  }

  const serverCount = (
    await shard.fetchClientValues("guilds.cache.size")
  ).reduce((sum: number, count) => sum + Number(count), 0);

  const totalUsers = (
    await shard.broadcastEval((c) =>
      c.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0),
    )
  ).reduce((sum: number, count) => sum + Number(count), 0);

  const botUptime = formatUptime(interaction.client.uptime ?? 0);
  const shardID = interaction.guild?.shardId ?? "N/A";

  const links = stripIndents`💻 [archivistbot.com](${homepageURL})
    <:add:906993610329841734> [Invite to Your Server](${inviteURL})
    ❔ [Support Server](${serverURL})
    🔒 [Privacy Policy](${privacyPolicy})`;

  const stats = stripIndents`**Servers:** ${serverCount}
    **Total Users:** ${totalUsers}
    **Shard ID:** ${shardID}
    **Launched:** ${launchDate}`;

  const disclosure = oneLine`*${botName} does not store any user messages.
    For information on what information the bot stores and how it uses the
    information please review the privacy policy at the link above.*`;

  const aboutEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`About ${botName}`)
    .addFields(
      { name: "Developers", value: "enigmalea, FoxInBoots", inline: true },
      { name: "Version", value: botVersion, inline: true },
      { name: "Uptime", value: botUptime, inline: true },
      { name: "Stats", value: stats },
      { name: "Links", value: links },
      { name: "\u200B", value: disclosure },
    )
    .setTimestamp()
    .setFooter({
      text: `Thank you for using ${botName}!`,
      iconURL: "https://www.archivistbot.com/img/logo.png",
    });

  await interaction.reply({ embeds: [aboutEmbed] });
};