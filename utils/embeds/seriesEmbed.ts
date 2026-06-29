import { formatCompletionStatus, startedDate, updatedAt } from "../statuses.ts";

import { EmbedBuilder } from "discord.js";
import { cachedGetSeries } from "../cache.ts";
import { constructCreators } from "../creators.ts";
import { getSeriesIdFromUrl } from "../urls.ts"
import { stripIndents } from "common-tags";

export var seriesEmbed = async (seriesURL: string) => {
	const seriesId = getSeriesIdFromUrl(seriesURL);
  const series = await cachedGetSeries(seriesId );

	const creators = constructCreators(series.authors, series.authors?.[0]?.anonymous);
  const complete = formatCompletionStatus(series);

  let notes;
  switch (series.notes) {
    case null:
      notes = "*This series does not have notes.*";
      break;

    default:
      notes = series.notes;
      break;
  }

  let seriesDescription;
  switch (series.description) {
    case null:
      seriesDescription = "*This series does not have a description.*";
      break;

    default:
      seriesDescription = series.description;
      break;
  }

  let description = stripIndents`**Authors:** ${creators}
	**Complete:** ${complete}
	**Works:** ${series.workCount}
	**Total Word Count:** ${series.words}
	**Bookmarks:** ${series.bookmarks}`;

  const seriesEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setAuthor({
      name: "Archive of Our Own",
      iconURL: "https://i.imgur.com/Ml4X1T6.png",
      url: "https://archiveofourown.org",
    })

    .setTitle(series.name)
    .setURL(seriesURL)
    .setDescription(description)

    .addFields({
      name: "Series Started:",
      value: startedDate(series),
      inline: true,
    })
    .addFields({
      name: "Last Updated:",
      value: updatedAt(series),
      inline: true,
    })

    .addFields({ name: "Notes:", value: notes, inline: false })

    .addFields({
      name: "Description:",
      value: seriesDescription,
      inline: false,
    })

    .setTimestamp()
    .setFooter({
      text: "bot not affiliated with OTW or AO3",
    });

  return seriesEmbed;
};
