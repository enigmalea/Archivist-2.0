import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { stripIndents } from "common-tags";

export const data = new SlashCommandBuilder()
  .setName("invite")
  .setDescription("Get a link to invite the bot to your server");

export const execute = async (interaction: ChatInputCommandInteraction) => {

const CLIENT_ID = process.env.CLIENT_ID_PROD;
	if (!CLIENT_ID) {
		throw new Error("Missing CLIENT_ID environment variable");
	}
	const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=395137`;

	const link = `## [Click to Invite](${inviteURL}))`;

		const description = stripIndents`*Want to invite ${interaction.client.user?.username ?? "Archivist"} to your server? Use the link below!*

		${link}`;

  const inviteEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(`${botName} Invite`)
    .setDescription(`${description}`)
    .setTimestamp()
    .setFooter({
      text: `Thank you for using ${botName}!`,
      iconURL: "https://www.archivistbot.com/img/logo.png",
    });

  await interaction.reply({ embeds: [inviteEmbed] });
};

}