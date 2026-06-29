import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import { formatCharacters, formatFandoms, formatRelationships, formatTags, formatWarnings, shipCategories } from "../tags.ts";
import { formatWorkSeries, formatWorkSummary } from "../../utils/details.ts";

import { EmbedBuilder } from "discord.js";
import { cachedGetWork } from "../cache.ts";
import { constructCreators } from "../creators.ts";
import { getWorkDetailsFromUrl } from "@fujocoded/ao3.js/urls";

export var worksEmbed = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await cachedGetWork(workId);

  if (work.locked) {
    return work;
  } else {
    // Creates the variables for the embed.
    const color = embedColor(work);

    const creators = constructCreators(work.authors, work.authors?.[0]?.anonymous);
    const series = formatWorkSeries(work);

    const wordCount = work.words.toString();
    const chapters = chapterDisplay(work);

    const published = publishedDate(work);
    const updatedDate = updatedAt(work);
    const status = formatCompletionStatus(work);

    const rating = ratingIcon(work);
    const warnings = formatWarnings(work);
    const category = shipCategories(work);

		const fandoms = formatFandoms(work);
		const relationships = formatRelationships(work);
		const characters = formatCharacters(work);
		const tags = formatTags(work);

    const summary = formatWorkSummary(work);

    // TODO: add collections to description.
    const description = `by ${creators!}\n${series!}`;

    // * Constructs embed to send to Discord.
    const worksEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: "Archive of Our Own",
        iconURL: "https://i.imgur.com/Ml4X1T6.png",
        url: "https://archiveofourown.org",
      })
      .setTitle(work.title)
      .setURL(workURL)
      .setDescription(description)
      .addFields({ name: "Words:", value: wordCount, inline: true })
      .addFields({ name: "Chapters:", value: chapters, inline: true })
      .addFields({ name: "Language:", value: work.language, inline: true })

      .addFields({ name: "Date Published:", value: published, inline: true })
      .addFields({ name: "Updated:", value: updatedDate, inline: true })
      .addFields({ name: "Status:", value: status, inline: true })

      .addFields({ name: "Rating:", value: rating!, inline: true })
      .addFields({ name: "Warnings:", value: warnings, inline: true })
      .addFields({ name: "Category:", value: category, inline: true })

			.addFields({ name: "Fandoms:", value: fandoms, inline: false })
			.addFields({ name: "Relationships:", value: relationships, inline: false })
			.addFields({ name: "Characters:", value: characters, inline: false })

			.addFields({ name: "Additional Tags:", value: tags, inline: false })
      .addFields({ name: "Summary:", value: summary!, inline: false })

      .setTimestamp()
      .setFooter({
        text: "bot not affiliated with OTW or AO3",
      });

    return worksEmbed;
  }
};
