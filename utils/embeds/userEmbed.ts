import type { EmbedBuilder } from "discord.js";
import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetUser } from "../cache.ts";
import { chunkText } from "../chunkText.ts";
import { getUsernameFromUrl } from "../urls.ts";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";

function padInlineRow(embed: EmbedBuilder, fieldCount: number) {
  const padding = (3 - (fieldCount % 3)) % 3;
  for (let i = 0; i < padding; i++) {
    embed.addFields({ name: "​", value: "​", inline: true });
  }
}

export const userEmbed = async (userURL: string) => {
  const username = getUsernameFromUrl(userURL);
  const user = await cachedGetUser(username);

  const header = user.header ? `# ${user.header}` : null;
	// TODO: Parse HTML to markdown.
  const bio = htmlToMarkdown(user.bioHtml) ?? "*This user does not have a bio.*";

  const embed = ao3Embed()
    .setTitle(username)
    .setURL(userURL)
    .setThumbnail(user.icon)
    .setDescription(header);

  embed.addFields({ name: "Pseuds:", value: user.pseuds, inline: false });

  const profileRow = [{ name: "Joined:", value: user.joined, inline: true }];
  if (user.location) {
    profileRow.push({ name: "Location:", value: user.location, inline: true });
  }
  if (user.birthday) {
    profileRow.push({ name: "Birthday:", value: user.birthday, inline: true });
  }
  embed.addFields(profileRow);
  padInlineRow(embed, profileRow.length);

  const profileBaseUrl = `https://archiveofourown.org/users/${user.username}`;
  embed.addFields(
    { name: "Works:", value: `[${user.works}](${profileBaseUrl}/works)`, inline: true },
    { name: "Series:", value: `[${user.series}](${profileBaseUrl}/series)`, inline: true },
    { name: "Collections:", value: `[${user.collections}](${profileBaseUrl}/collections)`, inline: true },
    { name: "Bookmarks:", value: `[${user.bookmarks}](${profileBaseUrl}/bookmarks)`, inline: true },
    { name: "Gifts:", value: `[${user.gifts}](${profileBaseUrl}/gifts)`, inline: true },
  );
  padInlineRow(embed, 5);

  chunkText(bio, 1024).forEach((chunk) => {
    embed.addFields({ name: "​", value: chunk, inline: false });
  });

  return embed;
};
