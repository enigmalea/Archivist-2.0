import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetUser } from "../cache.ts";
import { getUsernameFromUrl } from "../urls.ts";
import { stripIndents } from "common-tags";

export const userEmbed = async (userURL: string) => {
  const username = getUsernameFromUrl(userURL);
  const user = await cachedGetUser(username);

  const header = user.header ? `# ${user.header}\n` : "";
	// TODO: Parse HTML to markdown.
  const bio = user.bioHtml ?? "*This user does not have a bio.*";

  const description = stripIndents`
    **Pseuds:** ${user.pseuds}
    **Works:** ${user.works}
    **Bookmarks:** ${user.bookmarks}
    **Collections:** ${user.collections}
    **Gifts:** ${user.gifts}

    **Bio:**
    ${header}${bio}
  `;

  return ao3Embed()
    .setTitle(username)
    .setURL(userURL)
    .setDescription(description)
    .setThumbnail(user.icon);
};