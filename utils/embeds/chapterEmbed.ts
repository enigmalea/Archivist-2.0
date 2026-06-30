import { cachedGetWorkChapter, cachedGetWorkContent } from "../cache.ts";
import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import { getWorkDetailsFromUrl, getWorkUrl } from "@fujocoded/ao3.js/urls";

import { ao3Embed } from "../baseEmbed.ts";
import { constructCreators } from "../creators.ts";
import { countChapterWords } from "../words.ts";
import { formatWarnings } from "../tags.ts";
import { formatWorkSeries } from "../../utils/details.ts";
import { stripIndents } from "common-tags";

export const chapterEmbed = async (workURL: string) => {
  const { workId, chapterId } = getWorkDetailsFromUrl({ url: workURL });
  const work = await cachedGetWorkChapter(workId, chapterId);

  if (work.locked) {
    return work;
  }

  const content = await cachedGetWorkContent(workId, chapterId);
  const color = embedColor(work);
	
  const creators =
    constructCreators(work.authors, work.authors?.[0]?.anonymous) || "Anonymous";
  const series = formatWorkSeries(work);
  const chapterWords = countChapterWords(content.content);
  const totalWords = work.words.toString();
  const wordCount = `**${chapterWords}** [${totalWords}]`;
  const published = publishedDate(work);
  const updatedDate = updatedAt(work);
  const status = formatCompletionStatus(work);
  const rating = ratingIcon(work) ?? "N/A";
  const warnings = formatWarnings(work) || "None";

  const chapterName =
    work.chapterInfo?.name || `Chapter ${work.chapterInfo?.index ?? "?"}`;
	// TODO: Parse this HTML summary to markdown.
  const chapterSummary =
    work.chapterInfo?.summary?.trim() || "*This chapter does not have a summary.*";
  const readFromBeginningUrl = getWorkUrl({ workId });

	// TODO: Add collections to embed.
  const description = stripIndents`
    ## [${chapterName}](${workURL})
    by ${creators}
    ${series}
  `;

  return ao3Embed(color)
    .setTitle(work.title)
    .setURL(readFromBeginningUrl)
    .setDescription(description)
    .addFields([
			// TODO: Wire up settings checks to hide various fields.
      { name: "Words", value: wordCount, inline: true },
      { name: "Chapters", value: chapterDisplay(work), inline: true },
      { name: "Rating", value: rating, inline: true },
      { name: "Published", value: published, inline: true },
      { name: "Updated", value: updatedDate, inline: true },
      { name: "Status", value: status, inline: true },
      { name: "Warnings", value: warnings, inline: false },
      { name: "Summary", value: chapterSummary, inline: false },
    ]);
};
