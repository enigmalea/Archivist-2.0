import { EmbedBuilder } from "discord.js";
import dayjs from "dayjs";
import { getSeries } from "@bobaboard/ao3.js";
import { getUserProfileUrl } from "@bobaboard/ao3.js/urls";
import localizedFormat from "dayjs/plugin/localizedFormat";
import { stripIndents } from "common-tags";

// Extends dayjs to offer localized date formats.
dayjs.extend(localizedFormat);

export var seriesEmbed = async (seriesURL: string) => {
  const seriesId = seriesURL
    .replaceAll("https://", "")
    .replaceAll("http://", "")
    .split("/")[2];
  const series = await getSeries({ seriesId: seriesId });

  let seriesAuthors;
  switch (series.authors[0].anonymous) {
    case true:
      seriesAuthors = "Anonymous";
      break;

    // Default for the switch case assumes authors are not anonymous.
    default:
      // Constructs variables which are accessible outside of the loop.
      let authorsArray: string[] = [];
      // For each author in the array, we define their display name (pseud), username (actual AO3 username), and their url.
      for (let i in series.authors) {
        const display = series.authors[i].pseud;
        const username = series.authors[i].username;
        const url = getUserProfileUrl({ username: username });

        // Construct a new array consisting of a markdown formatted masked link of their display name and url.
        const author = `[${display}](${url})`;
        authorsArray.push(author);
      }

      // Join the array of markdown links with commas to create a string for display.
      seriesAuthors = authorsArray.join(", ");
      break;
  }

  let complete;
  switch (series.complete) {
    case true:
      complete = "Yes";
      break;

    default:
      complete = "No";
      break;
  }

  let notes;
  switch (series.notes) {
    case null:
      notes = "*This series does not have notes.*";
      break;

    default:
      notes = series.notes;
      break;
  }

  let seriesDescription;
  switch (series.description) {
    case null:
      seriesDescription = "*This series does not have a description.*";
      break;

    default:
      seriesDescription = series.description;
      break;
  }

  let description = stripIndents`**Authors:** ${seriesAuthors}
	**Complete:** ${complete}
	**Works:** ${series.workCount}
	**Total Word Count:** ${series.words}
	**Bookmarks:** ${series.bookmarks}`;

  const seriesEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setAuthor({
      name: "Archive of Our Own",
      iconURL: "https://i.imgur.com/Ml4X1T6.png",
      url: "https://archiveofourown.org",
    })

    .setTitle(series.name)
    .setURL(seriesURL)
    .setDescription(description)

    .addFields({
      name: "Series Started:",
      value: dayjs(series.startedAt).format("ll"),
      inline: true,
    })
    .addFields({
      name: "Last Updated:",
      value: dayjs(series.updatedAt).format("ll"),
      inline: true,
    })

    .addFields({ name: "Notes:", value: notes, inline: false })

    .addFields({
      name: "Description:",
      value: seriesDescription,
      inline: false,
    })

    .setTimestamp()
    .setFooter({
      text: "bot not affiliated with OTW or AO3",
    });

  return seriesEmbed;
};
