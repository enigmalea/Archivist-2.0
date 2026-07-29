import { formatCompletionStatus, startedDate, updatedAt } from "../statuses.ts";

import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetSeries } from "../cache.ts";
import { constructCreators } from "../creators.ts";
import { getSeriesIdFromUrl } from "../urls.ts";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";
import { getFieldMaxLength, getGuildSettingsBundle, isFieldEnabled } from "../embedFields.ts";
import { truncateText } from "../truncate.ts";

export const seriesEmbed = async (seriesURL: string, guildId?: string | null) => {
  const seriesId = getSeriesIdFromUrl(seriesURL);
  const series = await cachedGetSeries(seriesId);
  const bundle = await getGuildSettingsBundle(guildId);

  const creators =
    constructCreators(series.authors, series.authors?.[0]?.anonymous) ||
    "Anonymous";
  const notes = truncateText(
    htmlToMarkdown(series.notes) ?? "*This series does not have notes.*",
    getFieldMaxLength(bundle, "series", "notes"),
  );
  const seriesDescription = truncateText(
    htmlToMarkdown(series.description) ?? "*This series does not have a description.*",
    getFieldMaxLength(bundle, "series", "description"),
  );

  const descriptionLines = [
    { key: "authors", line: `**Authors:** ${creators}` },
    { key: "complete", line: `**Complete:** ${formatCompletionStatus(series)}` },
    { key: "workCount", line: `**Works:** ${series.workCount.toLocaleString()}` },
    { key: "wordCount", line: `**Total Word Count:** ${series.words.toLocaleString()}` },
    { key: "bookmarks", line: `**Bookmarks:** ${series.bookmarks.toLocaleString()}` },
  ]
    .filter((f) => isFieldEnabled(bundle, "series", f.key))
    .map((f) => f.line)
    .join("\n");

  const fields = [
    { key: "started", name: "Started:", value: startedDate(series), inline: true },
    { key: "updated", name: "Updated:", value: updatedAt(series), inline: true },
    { key: "notes", name: "Notes:", value: notes, inline: false },
    { key: "description", name: "Description", value: seriesDescription, inline: false },
  ].filter((f) => isFieldEnabled(bundle, "series", f.key));

  const embed = ao3Embed().setTitle(series.name).setURL(seriesURL);
  if (descriptionLines) embed.setDescription(descriptionLines);
  embed.addFields(fields.map(({ name, value, inline }) => ({ name, value, inline })));

  return embed;
};