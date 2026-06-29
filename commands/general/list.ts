import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { ao3SeriesError } from "../../utils/errors.ts";
import { cachedGetSeries } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { getSeriesIdFromUrl } from "../../utils/urls.ts";
import { getUserProfileUrl } from "@fujocoded/ao3.js/urls";

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
		// Defer for long-running operation
    await interaction.deferReply();

    // Now that we are certain this is a work link, assigns variables to identify the work.
    const seriesId = getSeriesIdFromUrl(seriesURL);
    const series = await cachedGetSeries(seriesId);

    // Gets the name for the series.
    let title = series.name;

    // Creates a list of creators.
    const seriesAuthors = constructCreators(series.authors, series.authors?.[0]?.anonymous);

		// Constructs an array of series works.
		let allWorks: string[] = [];
		series.works.forEach((work, i) => {
			const count = i + 1;
			const link = `${count}. [${work.title}](${work.url})`;
			allWorks.push(link);
		});

		let seriesWorks = allWorks.join("\n");

		let description = "by " + seriesAuthors + "\n\n" + seriesWorks

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
      .setDescription(description)
      .setTimestamp()
      .setFooter({
        text: `bot not affiliated with OTW or AO3`,
      });

    // * Sends reply to Discord.
    await interaction.editReply({ embeds: [listEmbed] });
  }
};
