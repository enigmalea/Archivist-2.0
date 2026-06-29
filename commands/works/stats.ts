import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { ao3WorkError, authError } from "../../utils/errors.ts";
import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../../utils/statuses.ts";
import { embedColor, ratingIcon } from "../../utils/ratings.ts"

import { ao3Embed } from "../../utils/baseEmbed.ts";
import { cachedGetWork } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { formatWorkSeries } from "../../utils/details.ts";
import { getWorkDetailsFromUrl } from "@fujocoded/ao3.js/urls";
import { shipCategories } from "../../utils/tags.ts";

export const data = new SlashCommandBuilder()

  // Creates the stats command and sets the options
  .setName("stats")
  .setDescription("Provides stats for an AO3 work.")
  // Adds a required option to provide the url.
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("Provide the work link.")
      .setRequired(true)
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const workURL = interaction.options.getString("url", true);

  const isWorkUrl =
    workURL.includes("archiveofourown.org/works/") ||
    workURL.includes("ao3.org/works/");

  if (!isWorkUrl) {
    await interaction.reply(ao3WorkError);
    return;
  }

  await interaction.deferReply();

  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await cachedGetWork(workId);

  if (work.locked) {
    await interaction.editReply(authError);
    return;
  }

  const title = `Stats for ${work.title}`;
  const published = publishedDate(work);
  const wordCount = work.words.toLocaleString();
  const hits = work.stats.hits.toLocaleString();
  const kudos = work.stats.kudos.toLocaleString();
  const bookmarks = work.stats.bookmarks.toLocaleString();
  const comments = work.stats.comments.toLocaleString();
  const category = shipCategories(work);

  const chapters = chapterDisplay(work);
  const updatedDate = updatedAt(work);
  const status = formatCompletionStatus(work);
  const rating = ratingIcon(work);
  const color = embedColor(work);
  const creators = constructCreators(work.authors, work.authors?.[0]?.anonymous);
  const series = formatWorkSeries(work);

  const description = `by ${creators}\n${series}`;

  const statsEmbed = ao3Embed(color)
    .setTitle(title)
    .setURL(workURL)
    .setDescription(description)
    .addFields([
      { name: "Rating", value: rating ?? "N/A", inline: true },
      { name: "Language", value: work.language ?? "N/A", inline: true },
      { name: "Category", value: category || "N/A", inline: true },
      { name: "Date Published", value: published ?? "N/A", inline: true },
      { name: "Date Updated", value: updatedDate ?? "N/A", inline: true },
      { name: "Status", value: status ?? "N/A", inline: true },
      { name: "Chapters", value: chapters ?? "N/A", inline: true },
      { name: "Words", value: wordCount, inline: true },
      { name: "Hits", value: hits, inline: true },
      { name: "Kudos", value: kudos, inline: true },
      { name: "Bookmarks", value: bookmarks, inline: true },
      { name: "Comments", value: comments, inline: true },
    ]);

  await interaction.editReply({ embeds: [statsEmbed] });
};
