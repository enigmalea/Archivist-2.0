import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { oneLine, stripIndents } from "common-tags";

const settings = await import(
  new URL("../../../package.json", import.meta.url).href,
  { with: { type: "json" } }
);

export const data = new SlashCommandBuilder()
  // Creates the about command.
  .setName("about")
  .setDescription("Provides information about Archivist");

export const execute = async (interaction: ChatInputCommandInteraction) => {
  // Sets variables for the bot's nickname in the server, version #, and the launch date.
  const botName: string = interaction.client.user?.username;
  const botVersion: string = settings.default.version;
  const launchDate = "16 Mar 2021";

  // Calculates server count for shards.
  let findServerCount = async () => {
    let counts: number[] = (await interaction.client.shard!.fetchClientValues(
      "guilds.cache.size",
    )) as number[];
    return counts.reduce(
      (acc: number, guildCount: number): number => acc + guildCount,
    );
  };

  let serverCount: number = await findServerCount();

  // Fetches guild Shard ID.
  let shardID = interaction.guild?.shardId;

  // Calculates total users.
  let findTotalUsers = async () => {
    let users = await interaction.client.shard!.broadcastEval((c) =>
      c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
    );
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
  const clientId =
    process.env.CLIENT_ID || interaction.client.user?.id || "YOUR_CLIENT_ID";
  const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=395137`;
  const privacyPolicy = "https://www.archivistbot.com/privacy";

  const links = stripIndents`💻 [archivistbot.com](${homepageURL})
		<:add:906993610329841734> [Invite to Your Server](${inviteURL})
		❔ [Support Server](${serverURL})
		🔒 [Privacy Policy](${privacyPolicy})`;

  //Constructs Stats Text.
  const stats = stripIndents`**Servers:** ${serverCount}
		**Total Users:** ${totalUsers}
		**Shard ID:** ${shardID}
		**Launched:** ${launchDate}`;

  //Constructs required Discord disclosure.
  const disclosure = oneLine`*${botName} does not store any user messages.
		For information on what information the bot stores and how it uses the
		information please review the privacy policy at the link above.*`;

  // * Constructs embed to send to Discord.
  const aboutEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`About ${botName}`)
    .addFields(
      { name: "Owner/Developer", value: "enigmalea", inline: true },
      { name: "Version", value: `${botVersion}`, inline: true },
      { name: "Uptime", value: `${botUptime}`, inline: true },
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

  // Sends embed to Discord.
  await interaction.reply({ embeds: [aboutEmbed] });
};
