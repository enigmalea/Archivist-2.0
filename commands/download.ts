import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { ao3WorkError, authError } from "../utils/errors";
import {
  getUserProfileUrl,
  getWorkDetailsFromUrl,
} from "@bobaboard/ao3.js/urls";
import { oneLine, stripIndents } from "common-tags";

import { getWork } from "@bobaboard/ao3.js";

export const data = new SlashCommandBuilder()

  // Creates the download command and sets the options
  .setName("download")
  .setDescription(
    "Provides a link so you can a fic with a specific format from AO3."
  )
  // Adds a required option for the file type.
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
  // Adds a required option to provide the url.
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("Provide the work link.")
      .setRequired(true)
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  // Assigns a variable to the url provided.
  const workURL = interaction.options.getString("url")!;

  if (
    // ! Tests if the url provided is an ao3 work URL and if not, produces an error message.
    workURL?.includes("archiveofourown.org/works/") === false &&
    workURL?.includes("ao3.org/works/") === false
  ) {
    await interaction.reply(ao3WorkError);
  } else {
    // Now that we are certain this is a work link, assigns variables to identify the work.
    const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
    const work = await getWork({ workId: workId });

    if (work.locked) {
      // ! Tests to see if the work is locked. If so, returns an error message.
      await interaction.reply(authError);
    } else {
      // Gets the title for the work.
      let title = work.title;

      // Creates the author links for the work.
      let allAuthors;
      switch (work.authors) {
        case "Anonymous":
          allAuthors = "Anonymous";
          break;

        default:
          let authorsArray = [];
          for (let i in work.authors) {
            let author;
            let display;
            let url;
            switch (work.authors[i].pseud) {
              case work.authors[i].username:
                display = work.authors[i].username;
                url = getUserProfileUrl({ username: display });
                break;
              default:
                display = work.authors[i].pseud;
                let username = work.authors[i].username;
                url = getUserProfileUrl({ username: username });
                break;
            }
            author = `[${display}](${url})`;
            authorsArray.push(author);
          }
          allAuthors = authorsArray.join(", ");
          break;
      }

      /*
			Defines the file type info from the file type option of the command
			and sets variables to call later based on the user's input.  
			*/
      type fileType = "azw3" | "epub" | "html" | "mobi" | "pdf";
      let file = interaction.options.getString("filetype")! as fileType;

      const emoji = {
        azw3: "<:azw3:848005536283885579>",
        epub: "<:epub:848005536241680434>",
        html: "<:html:848005536347455498>",
        mobi: "<:mobi:848005536493600768>",
        pdf: "<:pdf:848005536552976444>",
      };

      // Constructs the proper download link for the work.
      let download = oneLine`https://ao3.org/downloads/${workId}/${encodeURI(
        title.replaceAll(".", "")
      )}.${file}`;

      // creates the description for the discord embed.
      const description = stripIndents`by ${allAuthors}
		
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

      // * Sends reply to Discord.
      await interaction.reply({ embeds: [downloadEmbed] });
    }
  }
};
