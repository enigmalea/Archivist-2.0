import {
	ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";

import type { ClientWithCommands } from "..";

export const data = new SlashCommandBuilder()
	.setName("about")
	.setDescription("Provides information about Archivist");

export const execute = async (
	interaction: ChatInputCommandInteraction,
	client: ClientWithCommands
) => {
	// const botName = client.user?.username;
	// const serverCount = client.guilds.cache.size;
	// version = self.bot.VERSION
	// const launchDate = "16 Mar 2021";
	// shard = ctx.guild.shard_id

	// // Calculates bot uptime
	// let totalSeconds = client.uptime! / 1000;
	// let days = Math.floor(totalSeconds / 86400);
	// totalSeconds %= 86400;
	// let hours = Math.floor(totalSeconds / 3600);
	// totalSeconds %= 3600;
	// let minutes = Math.floor(totalSeconds / 60);
	// let seconds = Math.floor(totalSeconds % 60);

	// const botUptime = `${days} day ${hours} hours, ${minutes} minutes ${seconds} seconds`;

	// // Constructs links list
	// const serverURL = "https://discord.gg/FzhC9bVFva";
	// const twitterURL = "https://twitter.com/_ArchivistBot_";
	// const homepageURL = "https://www.archivistbot.com";
	// const inviteURL =
	// 	"https://discord.com/api/oauth2/authorize?client_id=812505952959856690&permissions=294205549632&scope=bot";
	// const privacyPolicy = "https://www.archivistbot.com/privacy";

	// const links = `💻 [archivistbot.com](${homepageURL})\n<:add:906993610329841734> [Invite to Your Server](${inviteURL})\n❔ [Support Server](${serverURL})\n<:twitter:906993635508248596> [@\_ArchivistBot\_](${twitterURL})\n🔒 [Privacy Policy](${privacyPolicy})`;

	// const stats = `**Servers:** Coming Soon\n**Shard ID:** Coming Soon\n**Launched:** ${launchDate}`;

	// const disclosure = `*${botName} does not store any user messages. For information on what information the bot stores and how it uses the information please review the privacy policy at the link above.*`;

	const exampleEmbed = new EmbedBuilder()
		.setColor(0x0099ff)
		.setTitle("Some title")
		.setURL("https://discord.js.org/")
		.setDescription("Some description here")
		.setThumbnail("https://i.imgur.com/AfFp7pu.png")
		.addFields(
			{ name: "Regular field title", value: "Some value here" },
			{ name: "\u200B", value: "\u200B" },
			{ name: "Inline field title", value: "Some value here", inline: true },
			{ name: "Inline field title", value: "Some value here", inline: true }
		)
		.addFields({
			name: "Inline field title",
			value: "Some value here",
			inline: true,
		})
		.setImage("https://i.imgur.com/AfFp7pu.png")
		.setTimestamp()
		.setFooter({
			text: "Some footer text here",
			iconURL: "https://i.imgur.com/AfFp7pu.png",
		});

	await interaction.reply({ embeds: [exampleEmbed] });
};
