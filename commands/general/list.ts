import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { ao3Embed } from "../../utils/baseEmbed.ts";
import { ao3SeriesError } from "../../utils/errors.ts";
import { cachedGetSeries } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { getSeriesIdFromUrl } from "../../utils/urls.ts";

const MAX_DESCRIPTION = 4096;
const MAX_WORKS_PER_PAGE = 10;

type SeriesData = Awaited<ReturnType<typeof cachedGetSeries>>;

type ListSession = {
  series: SeriesData;
  seriesURL: string;
  authors: string;
  pageBoundaries: number[];
};

const sessionCache = new Map<string, ListSession>();

function computePageBoundaries(
  series: SeriesData,
  seriesAuthors: string,
): number[] {
  const header = `by ${seriesAuthors}\n\n`;
  const boundaries: number[] = [0];
  let currentLength = header.length;
  let itemsOnPage = 0;

  for (let i = 0; i < series.works.length; i++) {
    const work = series.works[i];
    const line = `${i + 1}. [${work.title}](${work.url})\n`;

    const wouldExceedLength = currentLength + line.length > MAX_DESCRIPTION;
    const wouldExceedCount = itemsOnPage >= MAX_WORKS_PER_PAGE;

    if ((wouldExceedLength || wouldExceedCount) && itemsOnPage > 0) {
      boundaries.push(i);
      currentLength = header.length + line.length;
      itemsOnPage = 1;
    } else {
      currentLength += line.length;
      itemsOnPage++;
    }
  }

  return boundaries;
}

function buildListEmbed(
  series: SeriesData,
  seriesURL: string,
  seriesAuthors: string,
  pageBoundaries: number[],
  requestedPage: number,
) {
  const pageCount = pageBoundaries.length;
  const page = Math.min(Math.max(requestedPage, 0), pageCount - 1);

  const start = pageBoundaries[page];
  const end = pageBoundaries[page + 1] ?? series.works.length;
  const pageWorks = series.works.slice(start, end);

  const workList = pageWorks
    .map((work, i) => `${start + i + 1}. [${work.title}](${work.url})`)
    .join("\n");

  const embed = ao3Embed()
    .setTitle(series.name)
    .setURL(seriesURL)
    .setDescription(`by ${seriesAuthors}\n\n${workList}`)
    .setFooter({
      text: `Page ${page + 1}/${pageCount} · ${series.works.length} works`,
    });

  return { embed, page, pageCount };
}

function buildListComponents(
  ownerId: string,
  page: number,
  pageCount: number,
) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`list:${ownerId}:${page - 1}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`list:${ownerId}:${page + 1}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pageCount - 1),
    ),
  ];
}

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
  const seriesAuthors = constructCreators(
    series.authors,
    series.authors?.[0]?.anonymous,
  );

  const pageBoundaries = computePageBoundaries(series, seriesAuthors);

  sessionCache.set(interaction.user.id, {
    series,
    seriesURL,
    authors: seriesAuthors,
    pageBoundaries,
  });

  const { embed, page, pageCount } = buildListEmbed(
    series,
    seriesURL,
    seriesAuthors,
    pageBoundaries,
    0,
  );

  await interaction.editReply({
    embeds: [embed],
    components:
      pageCount > 1 ? buildListComponents(interaction.user.id, page, pageCount) : [],
  });
};

export const handleListButtonInteraction = async (
  interaction: ButtonInteraction,
): Promise<boolean> => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "list") return false;

  const [, ownerId, pageText] = parts;

  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "This list belongs to someone else. Run `/list` for your own copy.",
      flags: 64,
    });
    return true;
  }

  const session = sessionCache.get(ownerId);
  if (!session) {
    await interaction.reply({
      content: "This list has expired. Please run `/list` again.",
      flags: 64,
    });
    return true;
  }

  const page = parseInt(pageText, 10) || 0;
  const { embed, page: safePage, pageCount } = buildListEmbed(
    session.series,
    session.seriesURL,
    session.authors,
    session.pageBoundaries,
    page,
  );

  await interaction.update({
    embeds: [embed],
    components: buildListComponents(ownerId, safePage, pageCount),
  });

  return true;
};