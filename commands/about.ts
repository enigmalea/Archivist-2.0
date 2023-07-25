import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { oneLine, stripIndents } from "common-tags";

import type { ClientWithCommands } from "../bot";
import { version as botVersion } from "../package.json";

export const data = new SlashCommandBuilder()
  .setName("about")
  .setDescription("Provides information about Archivist");

// TODO: optional: add member count of shards.

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const botName = interaction.client.user?.username;
  const launchDate = "16 Mar 2021";

  // Calculates server count for shards.
  let findServerCount = async () => {
    let counts = (await interaction.client.shard!.fetchClientValues(
      "guilds.cache.size"
    )) as number[];
    return counts.reduce((acc, guildCount) => acc + guildCount);
  };

  let serverCount = await findServerCount();

	// Fetches guild Shard ID.
	let shardID = interaction.guild?.shardId;

	// Calculates total users.
	let findTotalUsers = async () => {
		let users = await interaction.client.shard!
		.broadcastEval(c => c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0));
		return users;
	};

	let totalUsers = await findTotalUsers();

  // Calculates bot uptime.
  let totalSeconds = interaction.client.uptime! / 1000;
  let days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.floor(totalSeconds % 60);

  const botUptime = `${days} day ${hours}:${minutes}:${seconds}`;

  // Constructs links list
  const serverURL = "https://discord.gg/FzhC9bVFva";
  const homepageURL = "https://www.archivistbot.com";
  const inviteURL =
    "https://discord.com/api/oauth2/authorize?client_id=812505952959856690&permissions=294205549632&scope=bot";
  const privacyPolicy = "https://www.archivistbot.com/privacy";

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

  // Constructs embed to send to Discord.
  const aboutEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`About ${botName}`)
    .addFields(
      { name: "Owner/Developer", value: "enigmalea", inline: true },
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
