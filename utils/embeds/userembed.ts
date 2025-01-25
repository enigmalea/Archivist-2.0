import { EmbedBuilder } from "discord.js";
import { getUser } from "@bobaboard/ao3.js";
import { stripIndents } from "common-tags";

export var userEmbed = async (userURL: string) => {
  const username = userURL
    .replaceAll("https://", "")
    .replaceAll("http://", "")
    .split("/")[2];
  const user = await getUser({ username: username });

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

  const userEmbed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setAuthor({
      name: "Archive of Our Own",
      iconURL: "https://i.imgur.com/Ml4X1T6.png",
      url: "https://archiveofourown.org",
    })
    .setTitle(username)
    .setURL(userURL)
    .setDescription(description)
    .setThumbnail(user.icon)

    .setTimestamp()
    .setFooter({
      text: "bot not affiliated with OTW or AO3",
    });

  return userEmbed;
};
