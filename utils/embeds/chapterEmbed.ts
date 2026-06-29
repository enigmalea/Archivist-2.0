import { cachedGetWorkChapter, cachedGetWorkContent } from "../cache.ts";
import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import { getWorkDetailsFromUrl, getWorkUrl } from "@fujocoded/ao3.js/urls";

import { EmbedBuilder } from "discord.js";
import { ao3Embed } from "../baseEmbed.ts";
import { constructCreators } from "../creators.ts";
import { countChapterWords } from "../words.ts";
import { formatWarnings } from "../tags.ts";
import { formatWorkSeries } from "../../utils/details.ts";
import { stripIndents } from "common-tags";

export var chapterEmbed = async (workURL: string) => {
  const { workId, chapterId } = getWorkDetailsFromUrl({ url: workURL });
  const work = await cachedGetWorkChapter( workId, chapterId );

  if (work.locked) {
    return work;
  } else {
		const content = await cachedGetWorkContent(workId, chapterId);

    // Creates the variables for the embed.
    const color = embedColor(work);

    const creators = constructCreators(work.authors, work.authors?.[0]?.anonymous);
    const series = formatWorkSeries(work);

    const chapterWords = countChapterWords(content.content);
		const totalWords = work.words.toString();
		const wordCount = `**${chapterWords}** [${totalWords}]`;
    const chapters = chapterDisplay(work);

    const published = publishedDate(work);
    const updatedDate = updatedAt(work);
    const status = formatCompletionStatus(work);

    const rating = ratingIcon(work);
    const warnings = formatWarnings(work);

		const chapterName = work.chapterInfo?.name ?? `Chapter ${work.chapterInfo?.index ?? ""}`;
  	const chapterSummary = work.chapterInfo?.summary?.trim() || "*This chapter does not have a summary.*";

		const readFromBeginningUrl = getWorkUrl({ workId });

    // TODO: add collections to description.
    const description = stripIndents`## [${chapterName}](${workURL})
		by ${creators!}
		${series!}`;

    // * Constructs embed to send to Discord.
    const worksEmbed = ao3Embed(color)
      .setTitle(work.title)
      .setURL(readFromBeginningUrl)
      .setDescription(description)
      .addFields({ name: "Words:", value: wordCount, inline: true })
      .addFields({ name: "Chapters:", value: chapters, inline: true })
			.addFields({ name: "Rating:", value: rating!, inline: true })

      .addFields({ name: "Published:", value: published, inline: true })
      .addFields({ name: "Updated:", value: updatedDate, inline: true })
      .addFields({ name: "Status:", value: status, inline: true })

      

      .addFields({ name: "Warnings:", value: warnings, inline: false })

      .addFields({ name: "Summary:", value: chapterSummary, inline: false })
    return worksEmbed;
  }
};
