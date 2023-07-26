import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { ao3WorkError, authError } from "../utils/errors";
import { oneLine, oneLineCommaListsAnd, stripIndents } from "common-tags";

import { getWork } from "@bobaboard/ao3.js";
import { getWorkDetailsFromUrl } from "@bobaboard/ao3.js/urls";

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
  const workURL = interaction.options.getString("url")!;
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  if (
    workURL?.includes("archiveofourown.org/works/") === false &&
    workURL?.includes("ao3.org/works/") === false
  ) {
    await interaction.reply(ao3WorkError); // ! sends error that link not a work link.
  } else if (work.locked) {
    await interaction.reply(authError); // ! sends error if work is locked.
  } else {
		let title = work.title;

		//TODO: update authors to be links and to support more than one author.
		let author;
		if (work.authors !== "Anonymous") {
			author = work.authors[0].username;
		} else {
			author = "Anonymous";
		}

    type fileType = "azw3" | "epub" | "html" | "mobi" | "pdf";
    let file = interaction.options.getString("filetype")! as fileType;

    const emoji = {
      azw3: "<:azw3:848005536283885579>",
      epub: "<:epub:848005536241680434>",
      html: "<:html:848005536347455498>",
      mobi: "<:mobi:848005536493600768>",
      pdf: "<:pdf:848005536552976444>",
    };

    let download = oneLine`https://ao3.org/downloads/${workId}/${encodeURI(
      title.replaceAll(".", "")
    )}.${file}`;

    const description = stripIndents`by ${author}
		
		*Click the link below to download the **${file}** file you requested.*

		${emoji[file]} [**Download**](${download})
		
		☆ DON'T FORGET TO VISIT AO3 TO LEAVE KUDOS OR COMMENTS! ☆`;

    // * Constructs embed to send to Discord.
    const downloadEmbed = new EmbedBuilder()
      .setTitle(title)
      .setURL(workURL)
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
