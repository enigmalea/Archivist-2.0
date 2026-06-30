import { formatCompletionStatus, startedDate, updatedAt } from "../statuses.ts";

import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetSeries } from "../cache.ts";
import { constructCreators } from "../creators.ts";
import { getSeriesIdFromUrl } from "../urls.ts";
import { stripIndents } from "common-tags";

export const seriesEmbed = async (seriesURL: string) => {
  const seriesId = getSeriesIdFromUrl(seriesURL);
  const series = await cachedGetSeries(seriesId);

  const creators =
    constructCreators(series.authors, series.authors?.[0]?.anonymous) ||
    "Anonymous";
	// TODO: Parse HTML notes into markdown.
  const notes = series.notes ?? "*This series does not have notes.*";
	// TODO: Parse HTML description into markdown.
  const seriesDescription =
    series.description ?? "*This series does not have a description.*";

  const description = stripIndents`
    **Authors:** ${creators}
    **Complete:** ${formatCompletionStatus(series)}
    **Works:** ${series.workCount.toLocaleString()}
    **Total Word Count:** ${series.words.toLocaleString()}
    **Bookmarks:** ${series.bookmarks.toLocaleString()}
  `;

  const embed = ao3Embed()
    .setTitle(series.name)
    .setURL(seriesURL)
    .setDescription(description)
    .addFields([
      { name: "Started:", value: startedDate(series), inline: true },
      { name: "Updated:", value: updatedAt(series), inline: true },
      { name: "Notes:", value: notes, inline: false },
      { name: "Description", value: seriesDescription, inline: false },
    ]);

  return embed;
};