import {
  allAuthors,
  chapterDisplay,
  embedColor,
  lastUpdated,
  ratingIcon,
  workCategory,
  workSeries,
  workStatus,
  workSummary
} from "../utils/works";

import { EmbedBuilder } from "discord.js";
import dayjs from "dayjs";
import { getWork } from "@bobaboard/ao3.js";
import { getWorkDetailsFromUrl } from "@bobaboard/ao3.js/urls";

export var worksEmbed = async (workURL: string) => {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await getWork({ workId: workId });

  if (work.locked) {
    return;
  } else {
    // Creates the variables for the embed.
    let color = await embedColor(workURL);

    let creators = await allAuthors(workURL);
		let series = await workSeries(workURL);

    let wordCount = work.words.toString();
    let chapters = await chapterDisplay(workURL);

    let publishedDate = dayjs(work.publishedAt).format("ll");
    let updatedDate = await lastUpdated(workURL);
    let status = await workStatus(workURL);

    let rating = await ratingIcon(workURL);
		let warnings = work.tags.warnings.join(", ");
		let category = await workCategory(workURL);

		let summary = await workSummary(workURL);

    // TODO: add series and collections to description.
    let description = `by ${creators!}\n${series!}`;

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

      .addFields({
        name: "Date Published:",
        value: publishedDate,
        inline: true,
      })
      .addFields({ name: "Updated:", value: updatedDate, inline: true })
      .addFields({ name: "Status:", value: status, inline: true })

      .addFields({ name: "Rating:", value: rating!, inline: true })
      .addFields({ name: "Warnings:", value: warnings, inline: true })
      .addFields({ name: "Category:", value: category, inline: true })

			.addFields({ name: "Summary:", value: summary!, inline: false })

      .setTimestamp()
      .setFooter({
        text: "bot not affiliated with OTW or AO3",
      });

    return worksEmbed;
  }
};