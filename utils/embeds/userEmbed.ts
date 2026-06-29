import { EmbedBuilder } from "discord.js";
import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetUser } from "../cache.ts";
import { getUsernameFromUrl } from "../urls.ts";
import { stripIndents } from "common-tags";

export var userEmbed = async (userURL: string) => {
  const username = getUsernameFromUrl(userURL)
  const user = await cachedGetUser(username);
	
  let header;
  switch (user.header) {
    case null:
      header = "";
      break;

    default:
      header = `# ${user.header}\n`;
      break;
  }

  let bio;
  switch (user.bioHtml) {
    case null:
      bio = "*This user does not have a bio.*";
      break;

    default:
      bio = user.bioHtml;
      break;
  }

  let description = stripIndents`**Pseuds:** ${user.pseuds}
	
	**Works:** ${user.works}
	**Bookmarks:** ${user.bookmarks}
	**Collections:** ${user.collections}
	**Gifts:** ${user.gifts}
	
	**Bio:**
	${header}${bio}`;

  const userEmbed = ao3Embed()
    .setTitle(username)
    .setURL(userURL)
    .setDescription(description)
    .setThumbnail(user.icon);
  return userEmbed;
};
