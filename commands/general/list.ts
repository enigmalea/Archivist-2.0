import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import { ao3Embed } from "../../utils/baseEmbed.ts";
import { ao3SeriesError } from "../../utils/errors.ts";
import { cachedGetSeries } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { getSeriesIdFromUrl } from "../../utils/urls.ts";

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
    const listEmbed = ao3Embed()
      .setTitle(title)
      .setURL(seriesURL)
      .setDescription(description);

    // * Sends reply to Discord.
    await interaction.editReply({ embeds: [listEmbed] });
  }
};
