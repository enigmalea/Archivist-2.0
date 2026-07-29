import { cachedGetWorkChapter, cachedGetWorkContent } from "../cache.ts";
import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import { getWorkDetailsFromUrl, getWorkUrl } from "@fujocoded/ao3.js/urls";

import { ao3Embed } from "../baseEmbed.ts";
import { constructCreators } from "../creators.ts";
import { countChapterWords } from "../words.ts";
import { formatWarnings } from "../tags.ts";
import { formatWorkSeries } from "../../utils/details.ts";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";
import { getFieldMaxLength, getGuildSettingsBundle, isFieldEnabled } from "../embedFields.ts";
import { extractImagesFromHtml, optimizeImageUrl } from "../images.ts";
import { stripIndents } from "common-tags";
import { truncateText } from "../truncate.ts";

export const chapterEmbed = async (workURL: string, guildId?: string | null) => {
  const { workId, chapterId } = getWorkDetailsFromUrl({ url: workURL });
  const work = await cachedGetWorkChapter(workId, chapterId);

  if (work.locked) {
    return work;
  }

  const content = await cachedGetWorkContent(workId, chapterId);
  const bundle = await getGuildSettingsBundle(guildId);
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

  // Always leads with "Chapter N" so it's unmistakable at a glance that this
  // is a chapter embed, not a work embed — a custom chapter name (if any) is
  // appended rather than replacing the "Chapter N" indicator.
  const chapterIndex = work.chapterInfo?.index ?? "?";
  const chapterTitle = work.chapterInfo?.name
    ? `Chapter ${chapterIndex}: ${work.chapterInfo.name}`
    : `Chapter ${chapterIndex}`;

  const chapterSummary = truncateText(
    htmlToMarkdown(work.chapterInfo?.summary) ?? "*This chapter does not have a summary.*",
    getFieldMaxLength(bundle, "chapter", "summary"),
  );

  const noteParts = [
    content.startNotes && `**Beginning:**\n${htmlToMarkdown(content.startNotes)}`,
    content.endNotes && `**End:**\n${htmlToMarkdown(content.endNotes)}`,
  ].filter(Boolean);
  const chapterNotes = noteParts.length
    ? truncateText(noteParts.join("\n\n"), getFieldMaxLength(bundle, "chapter", "notes"))
    : null;

  const readFromBeginningUrl = getWorkUrl({ workId });

	// TODO: Add collections to embed.
  const description = stripIndents`
    **${work.title}**
    by ${creators}
    ${series}
    [Read from the beginning](${readFromBeginningUrl})
  `;

  const fields = [
    { key: "words", name: "Words", value: wordCount, inline: true },
    { key: "chapters", name: "Chapters", value: chapterDisplay(work), inline: true },
    { key: "rating", name: "Rating", value: rating, inline: true },
    { key: "published", name: "Published", value: published, inline: true },
    { key: "updated", name: "Updated", value: updatedDate, inline: true },
    { key: "status", name: "Status", value: status, inline: true },
    { key: "warnings", name: "Warnings", value: warnings, inline: false },
    { key: "summary", name: "Summary", value: chapterSummary, inline: false },
    ...(chapterNotes ? [{ key: "notes", name: "Notes", value: chapterNotes, inline: false }] : []),
  ].filter((f) => isFieldEnabled(bundle, "chapter", f.key));

  // The title/URL point at this specific chapter (not the work's first
  // chapter), so clicking through lands where the embed says it will.
  const embed = ao3Embed(color)
    .setTitle(chapterTitle)
    .setURL(workURL)
    .setDescription(description)
    .addFields(fields.map(({ name, value, inline }) => ({ name, value, inline })));

  // Just the first embedded image as a small thumbnail — unlike the Work
  // gallery, which fetches every image into its own paginated set of embeds.
  // Its own settings category (not the general Fields checkbox group) so it
  // can carry rating-based exclusions independent of the master toggle.
  const thumbnailExcludedByRating =
    (work.rating === "Mature" && isFieldEnabled(bundle, "chapter-thumbnail", "excludeMature")) ||
    (work.rating === "Explicit" && isFieldEnabled(bundle, "chapter-thumbnail", "excludeExplicit"));

  if (isFieldEnabled(bundle, "chapter-thumbnail", "enabled") && !thumbnailExcludedByRating) {
    const [firstImage] = extractImagesFromHtml(content.content);
    if (firstImage) embed.setThumbnail(optimizeImageUrl(firstImage));
  }

  return embed;
};
