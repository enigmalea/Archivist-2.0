import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
    SlashCommandStringOption,
} from "discord.js";
import type { ClientWithCommands, Command } from "..";

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
	// TODO: write code for command. Should check if URL is for an AO3 work. If not, send ephemeral message. Be sure to declare custom icons as an object. structure embed.
    await interaction.reply("DL request received.");
};
