import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { ao3WorkError, authError } from "../../utils/errors.ts";
import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../../utils/statuses.ts";
import { embedColor, ratingIcon } from "../../utils/ratings.ts"

import { cachedGetWork } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
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
	// Defer reply for long-running operation.
  await interaction.deferReply();

  // Assigns a variable to the url provided.
  const workURL = interaction.options.getString("url")!;

  if (
    // ! Tests if the url provided is an ao3 work URL and if not, produces an error message.
    workURL?.includes("archiveofourown.org/works/") === false &&
    workURL?.includes("ao3.org/works/") === false
  ) {
    await interaction.reply(ao3WorkError);
  } else {
    // Now that we are certain this is a work link, assigns variables to identify the work.
    const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
    const work = await cachedGetWork(workId );

    if (work.locked) {
      // ! Tests to see if the work is locked. If so, returns an error message.
      await interaction.reply(authError);
    } else {
      // Gets the stats for the work.
      let title = `Stats for ${work.title}`;
      let published = publishedDate(work);
      let wordCount = work.words.toString();
      let hits = work.stats.hits.toString();
      let kudos = work.stats.kudos.toString();
      let bookmarks = work.stats.bookmarks.toString();
      let comments = work.stats.comments.toString();
      let category = shipCategories(work);

      let chapters = chapterDisplay(work);
      let updatedDate = updatedAt(work);
      let status = formatCompletionStatus(work);
      let rating = ratingIcon(work);
      let color = embedColor(work);
      let creators = constructCreators(work);

      // TODO: add series and collections to description.
      let description = `by ${creators!}`;

      // * Constructs embed to send to Discord.
      const statsEmbed = new EmbedBuilder()
        .setTitle(title)
        .setURL(workURL)
        .setColor(color)
        .setAuthor({
          name: "Archive of Our Own",
          iconURL: "https://i.imgur.com/Ml4X1T6.png",
          url: "https://archiveofourown.org",
        })
        .setDescription(description)
        .addFields({ name: "Rating:", value: rating!, inline: true })
        .addFields({ name: "Language:", value: work.language, inline: true })
        .addFields({ name: "Category:", value: category, inline: true })

        .addFields({ name: "Date Published:", value: published, inline: true })
        .addFields({ name: "Date Updated:", value: updatedDate, inline: true })
        .addFields({ name: "Status:", value: status, inline: true })

        .addFields({ name: "Chapters:", value: chapters, inline: true })
        .addFields({ name: "Words:", value: wordCount, inline: true })
        .addFields({ name: "Hits:", value: hits, inline: true })

        .addFields({ name: "Kudos:", value: kudos, inline: true })
        .addFields({ name: "Bookmarks:", value: bookmarks, inline: true })
        .addFields({ name: "Comments:", value: comments, inline: true })

        .setTimestamp()
        .setFooter({
          text: `bot not affiliated with OTW or AO3`,
        });

      // * Sends reply to Discord.
      await interaction.editReply({ embeds: [statsEmbed] });
    }
  }
};
