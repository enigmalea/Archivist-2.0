import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { ao3SeriesError } from "../../utils/errors";
import { commaLists } from "common-tags";
import { getSeries } from "@bobaboard/ao3.js";
import { getUserProfileUrl } from "@bobaboard/ao3.js/urls";

export const data = new SlashCommandBuilder()

  // Creates the download command and sets the options
  .setName("list")
  .setDescription("Gets a list of works in a series.")
  // Adds a required option to provide the url.
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("Provide the series link.")
      .setRequired(true)
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  // Assigns a variable to the url provided.
  const seriesURL = interaction.options.getString("url")!;

  if (
    // ! Tests if the url provided is an ao3 work URL and if not, produces an error message.
    seriesURL?.includes("archiveofourown.org/series/") === false &&
    seriesURL?.includes("ao3.org/series/") === false
  ) {
    await interaction.reply(ao3SeriesError);
  } else {
    // Now that we are certain this is a work link, assigns variables to identify the work.
    const seriesId = seriesURL
      .replaceAll("https://", "")
      .replaceAll("http://", "")
      .split("/")[2];
    const series = await getSeries({ seriesId: seriesId });

    // Gets the name for the series.
    let title = series.name;

    // Creates a list of creators.
    let seriesAuthors;
    switch (series.authors[0].anonymous) {
      case true:
        seriesAuthors = "Anonymous";
        break;

      // Default for the switch case assumes authors are not anonymous.
      default:
        // Constructs variables which are accessible outside of the loop.
        let authorsArray: string[] = [];
        // For each author in the array, we define their display name (pseud), username (actual AO3 username), and their url.
        for (let i in series.authors) {
          const display = series.authors[i].pseud;
          const username = series.authors[i].username;
          const url = getUserProfileUrl({ username: username });

          // Construct a new array consisting of a markdown formatted masked link of their display name and url.
          const author = `[${display}](${url})`;
          authorsArray.push(author);
        }

        // Join the array of markdown links with commas to create a string for display.
        seriesAuthors = commaLists`${authorsArray}`;
        break;
    }

		// Constructs an array of series works.
		let allWorks = [];
		for (let i in series.works) {
			const title = series.works[i].title;
			const url = series.works[i].url;
			const link = `${i + 1}. [${title}](${url})`;

			allWorks.push(link);
		}

		let seriesWorks = allWorks.join("\n")

    // * Constructs embed to send to Discord.
    const listEmbed = new EmbedBuilder()
      .setTitle(title)
      .setURL(seriesURL)
      .setColor(0x2f3136)
      .setAuthor({
        name: "Archive of Our Own",
        iconURL: "https://i.imgur.com/Ml4X1T6.png",
        url: "https://archiveofourown.org",
      })
      .setDescription(seriesWorks)
      .setTimestamp()
      .setFooter({
        text: `bot not affiliated with OTW or AO3`,
      });

    // * Sends reply to Discord.
    await interaction.reply({ embeds: [listEmbed] });
  }
};
