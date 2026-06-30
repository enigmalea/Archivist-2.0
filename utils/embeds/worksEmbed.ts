import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import {
  formatCharacters,
  formatFandoms,
  formatRelationships,
  formatTags,
  formatWarnings,
  shipCategories,
} from "../tags.ts";
import { formatWorkSeries, formatWorkSummary } from "../../utils/details.ts";

import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetWork } from "../cache.ts";
import { constructCreators } from "../creators.ts";
import { getWorkDetailsFromUrl } from "@fujocoded/ao3.js/urls";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";

export const worksEmbed = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await cachedGetWork(workId);

  if (work.locked) {
    return work;
  }

  const color = embedColor(work);
  const creators = constructCreators(work.authors, work.authors?.[0]?.anonymous) || "Anonymous";
  const series = formatWorkSeries(work);
  const published = publishedDate(work);
  const updatedDate = updatedAt(work);
  const status = formatCompletionStatus(work);
  const rating = ratingIcon(work) ?? "N/A";
  const warnings = formatWarnings(work) || "None";
  const category = shipCategories(work) || "N/A";
  const fandoms = formatFandoms(work) || "N/A";
  const relationships = formatRelationships(work) || "N/A";
  const characters = formatCharacters(work) || "N/A";
  const tags = formatTags(work) || "N/A";
  const summary = htmlToMarkdown(formatWorkSummary(work)) ?? "No summary available.";

  const description = [ `by ${creators}`, series ].filter(Boolean).join("\n");

  return ao3Embed(color)
    .setTitle(work.title)
    .setURL(workURL)
    .setDescription(description)
    .addFields([
      { name: "Words", value: work.words.toString(), inline: true },
      { name: "Chapters", value: chapterDisplay(work), inline: true },
      { name: "Language", value: work.language ?? "N/A", inline: true },
      { name: "Date Published", value: published, inline: true },
      { name: "Updated", value: updatedDate, inline: true },
      { name: "Status", value: status, inline: true },
      { name: "Rating", value: rating, inline: true },
      { name: "Warnings", value: warnings, inline: true },
      { name: "Category", value: category, inline: true },
      { name: "Fandoms", value: fandoms, inline: false },
      { name: "Relationships", value: relationships, inline: false },
      { name: "Characters", value: characters, inline: false },
      { name: "Additional Tags", value: tags, inline: false },
      { name: "Summary", value: summary, inline: false },
    ]);
};