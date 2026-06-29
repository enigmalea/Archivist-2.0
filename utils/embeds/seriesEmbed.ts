import { formatCompletionStatus, startedDate, updatedAt } from "../statuses.ts";

import { EmbedBuilder } from "discord.js";
import { ao3Embed } from "../baseEmbed.ts";
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

  const seriesEmbed = ao3Embed()
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
    });

  return seriesEmbed;
};
