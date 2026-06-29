import { EmbedBuilder } from "discord.js";

const AO3_ICON_URL = "https://i.imgur.com/Ml4X1T6.png";
const AO3_URL = "https://archiveofourown.org";
const AO3_FOOTER_TEXT = "bot not affiliated with OTW or AO3";
const DEFAULT_EMBED_COLOR = 0x2f3136;

export function ao3Embed(color: number | null = DEFAULT_EMBED_COLOR): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color ?? DEFAULT_EMBED_COLOR)
    .setAuthor({
      name: "Archive of Our Own",
      iconURL: AO3_ICON_URL,
      url: AO3_URL,
    })
    .setTimestamp()
    .setFooter({ text: AO3_FOOTER_TEXT });
}