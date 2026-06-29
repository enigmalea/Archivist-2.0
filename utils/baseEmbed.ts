import { EmbedBuilder } from "discord.js";

export function ao3Embed(color: number | null = 0x2f3136): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: "Archive of Our Own",
      iconURL: "https://i.imgur.com/Ml4X1T6.png",
      url: "https://archiveofourown.org",
    })
    .setTimestamp()
    .setFooter({ text: "bot not affiliated with OTW or AO3" });
}