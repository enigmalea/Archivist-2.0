import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
    SlashCommandStringOption,
} from "discord.js";

import type { ClientWithCommands } from "../bot";
import { ao3WorkError } from "../utils/errors";
import { stripIndents } from "common-tags";

export const data = new SlashCommandBuilder()
    .setName("download")
    .setDescription(
        "Provides a link so you can a fic with a specific format from AO3."
    )
    .addStringOption((option) =>
        option
            .setName("filetype")
            .setDescription("Select the file type you would like.")
            .setRequired(true)
            .addChoices(
                { name: "AZW3", value: "azw3" },
                { name: "EPUB", value: "epub" },
                { name: "HTML", value: "html" },
                { name: "MOBI", value: "mobi" },
                { name: "PDF", value: "pdf" }
            )
    )
    .addStringOption((option) =>
        option
            .setName("url")
            .setDescription("Provide the work link.")
            .setRequired(true)
    );

export const execute = async (interaction: ChatInputCommandInteraction) => {
    const workURL = interaction.options.getString("url");

    if (
        workURL?.includes("archiveofourown.org/works/") === false &&
        workURL?.includes("ao3.org/works/") === false
    ) {
        await interaction.reply(ao3WorkError); // ! sends error that link not a work link
    } else {
		type fileType = "azw3" | "epub" | "html" | "mobi" | "pdf";
		let file = interaction.options.getString("filetype")! as fileType;

		const emoji = {	
		"azw3": "<:azw3:848005536283885579>",
		"epub": "<:epub:848005536241680434>",
		"html": "<:html:848005536347455498>",
		"mobi": "<:mobi:848005536493600768>",
		"pdf": "<:pdf:848005536552976444>",
		}

		let dlURL = "http://google.com"; // TODO: replace with logic to determine download URL. need to import AO3.js to determine the work title.

		// TODO: add author name and link to description
		const description = stripIndents`*Click the link below to download the **${file}** file you requested.*\n\n
			${emoji[file]} [**Download**](${dlURL})\n\n☆ DON'T FORGET TO VISIT AO3 TO LEAVE KUDOS OR COMMENTS! ☆`;

        // TODO: add Title of work as embed title and link to work.
        // * Constructs embed to send to Discord.
        const downloadEmbed = new EmbedBuilder()
            .setColor(0x2f3136)
            .setAuthor({
                name: "Archive of Our Own",
                iconURL: "https://i.imgur.com/Ml4X1T6.png",
                url: "https://archiveofourown.org",
            })
            .setDescription(description)
            .setTimestamp()
            .setFooter({
                text: `bot not affiliated with OTW or AO3`,
            });

        await interaction.reply({ embeds: [downloadEmbed] });
    }
};
