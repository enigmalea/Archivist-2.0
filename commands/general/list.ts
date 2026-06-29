import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { ao3Embed } from "../../utils/baseEmbed.ts";
import { ao3SeriesError } from "../../utils/errors.ts";
import { cachedGetSeries } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { getSeriesIdFromUrl } from "../../utils/urls.ts";

export const data = new SlashCommandBuilder()
  .setName("list")
  .setDescription("Gets a list of works in a series.")
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("Provide the series link.")
      .setRequired(true),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const seriesURL = interaction.options.getString("url", true);

  const isSeriesUrl =
    seriesURL.includes("archiveofourown.org/series/") ||
    seriesURL.includes("ao3.org/series/");

  if (!isSeriesUrl) {
    await interaction.reply(ao3SeriesError);
    return;
  }

  await interaction.deferReply();

  const seriesId = getSeriesIdFromUrl(seriesURL);
  const series = await cachedGetSeries(seriesId);

  const title = series.name;
  const seriesAuthors = constructCreators(
    series.authors,
    series.authors?.[0]?.anonymous,
  );

  const seriesWorks = series.works
    .map(
      (work, index) => `${index + 1}. [${work.title}](${work.url})`,
    )
    .join("\n");

  const description = `by ${seriesAuthors}\n\n${seriesWorks}`;

  const listEmbed = ao3Embed()
    .setTitle(title)
    .setURL(seriesURL)
    .setDescription(description);

  await interaction.editReply({ embeds: [listEmbed] });
};