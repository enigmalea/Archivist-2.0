import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { ao3WorkError, authError } from "../utils/errors";
import {
  getUserProfileUrl,
  getWorkDetailsFromUrl,
} from "@bobaboard/ao3.js/urls";

import dayjs from "dayjs";
import { getWork } from "@bobaboard/ao3.js";
import localizedFormat from "dayjs/plugin/localizedFormat";

// Extends dayjs to offer localized date formats.
dayjs.extend(localizedFormat);

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
    const work = await getWork({ workId: workId });

    if (work.locked) {
      // ! Tests to see if the work is locked. If so, returns an error message.
      await interaction.reply(authError);
    } else {
      // Gets the stats for the work.
      let title = `Stats for ${work.title}`;
      let publishedDate = dayjs(work.publishedAt).format("ll");
      let wordCount = work.words.toString();
      let hits = work.stats.hits.toString();
      let kudos = work.stats.kudos.toString();
      let bookmarks = work.stats.bookmarks.toString();
      let comments = work.stats.comments.toString();
      let category = work.category!.join(", ");

      let chapters;
      switch (work.chapters.total) {
        case null:
          chapters = `${work.chapters.published}/?`;
          break;
        default:
          chapters = `${work.chapters.published}/${work.chapters.total}`;
          break;
      }

      let updatedDate;
      switch (work.updatedAt) {
        case null:
          updatedDate = `N/A`;
          break;
        default:
          updatedDate = dayjs(work.updatedAt).format("ll");
          break;
      }

      let status;
      switch (work.complete) {
        case true:
          status = "Complete";
          break;
        case false:
          status = "Work in Progress";
          break;
      }

      let rating!: string;
      let color!: number;
      switch (work.rating) {
        case "Not Rated":
          rating = "<:notrated:866825856236519426>";
          color = 0xffffff;
          break;
        case "General Audiences":
          rating = "<:general:866823809180631040>";
          color = 0x77a50e;
          break;
        case "Teen And Up Audiences":
          rating = "<:teen:866823893015330826>";
          color = 0xe8d506;
          break;
        case "Mature":
          rating = "<:mature:866823956684996628>";
          color = 0xde7e28;
          break;
        case "Explicit":
          rating = "<:explicit:866824069050269736>";
          color = 0x9c0000;
          break;
      }

      // Creates the author links for the work.
      let allAuthors;
      switch (work.authors) {
        case "Anonymous":
          allAuthors = "Anonymous";
          break;

        default:
          let authorsArray = [];
          let display;
          let username;
          let url;
					
          for (let i in work.authors) {
            display = work.authors[i].pseud;
            username = work.authors[i].username;
            url = getUserProfileUrl({ username: username });
          }

          let author = `[${display}](${url})`;
          authorsArray.push(author);

          allAuthors = authorsArray.join(", ");
          break;
      }

      // TODO: add series and collections to description.
      let description = `by ${allAuthors}`;

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
        .addFields({ name: "Rating:", value: rating, inline: true })
        .addFields({ name: "Language:", value: work.language, inline: true })
        .addFields({ name: "Category:", value: category, inline: true })

        .addFields({
          name: "Date Published:",
          value: publishedDate,
          inline: true,
        })
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
      await interaction.reply({ embeds: [statsEmbed] });
			console.log(work.words)
    }
  }
};
