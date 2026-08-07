import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import { ao3Embed } from "../../utils/baseEmbed.ts";
import { ao3Limiter } from "../../utils/ao3Limiter.ts";
import { ao3SeriesError } from "../../utils/errors.ts";
import { cachedGetSeries } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { getGuildSettingsBundle, getListResetToFirstPage } from "../../utils/embedFields.ts";
import { getSeriesIdFromUrl } from "../../utils/urls.ts";
import { getSeriesUrl } from "@fujocoded/ao3.js/urls";
import { ratingIcon } from "../../utils/ratings.ts";
import { scheduleInactivityReset } from "../../utils/inactivityReset.ts";

const MAX_DESCRIPTION = 4096;
const MAX_WORKS_PER_PAGE = 10;
const MAX_SELECT_OPTIONS = 25;

type SeriesData = Awaited<ReturnType<typeof cachedGetSeries>>;

type ListSession = {
  series: SeriesData;
  seriesURL: string;
  authors: string;
  pageBoundaries: number[];
};

// Keyed by seriesId, not ownerId — the series ID now travels in the
// button's customId (see buildListComponents), so this is purely a fast
// path to skip recomputing page boundaries on the next click, not the only
// copy of the data. On a miss (TTL-less cache evicted, bot restarted, or
// simply never populated because a page was reached by scrolling from
// someone else's button) getListSession rebuilds it from AO3 via the
// seriesId alone. Keying by seriesId also means two different guilds/users
// listing the same series share one cache entry instead of duplicating it.
const sessionCache = new Map<string, ListSession>();

async function getListSession(seriesId: string): Promise<ListSession> {
  const cached = sessionCache.get(seriesId);
  if (cached) return cached;

  // Rate-limited fetch — long series can mean several AO3 requests.
  const series = await ao3Limiter.schedule(() => cachedGetSeries(seriesId));
  const authors = constructCreators(series.authors, series.authors?.[0]?.anonymous);
  const seriesURL = getSeriesUrl({ seriesId });
  const pageBoundaries = computePageBoundaries(series, authors);

  const session: ListSession = { series, seriesURL, authors, pageBoundaries };
  sessionCache.set(seriesId, session);
  return session;
}

// Formats one work line, with a rating icon.
function formatWorkLine(index: number, work: SeriesData["works"][number]): string {
  const icon = ratingIcon(work);
  return `${index + 1}. ${icon ? `${icon} ` : ""}[${work.title}](${work.url})`;
}

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
    const line = `${formatWorkLine(i, work)}\n`;

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
    .map((work, i) => formatWorkLine(start + i, work))
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

// Page-jump dropdown — windowed to Discord's 25-option cap.
function buildListPageSelectRow(
  ownerId: string,
  page: number,
  pageBoundaries: number[],
  totalWorks: number,
  seriesId: string,
) {
  const pageCount = pageBoundaries.length;
  const windowStart =
    pageCount <= MAX_SELECT_OPTIONS
      ? 0
      : Math.max(0, Math.min(page - Math.floor(MAX_SELECT_OPTIONS / 2), pageCount - MAX_SELECT_OPTIONS));
  const windowEnd = Math.min(windowStart + MAX_SELECT_OPTIONS, pageCount);

  const options = [];
  for (let i = windowStart; i < windowEnd; i++) {
    const start = pageBoundaries[i] + 1;
    const end = pageBoundaries[i + 1] ?? totalWorks;
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Page ${i + 1}: ${start}-${end}`)
        .setValue(String(i))
        .setDefault(i === page),
    );
  }

  const currentStart = pageBoundaries[page] + 1;
  const currentEnd = pageBoundaries[page + 1] ?? totalWorks;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`list-select:${ownerId}:${seriesId}`)
      .setPlaceholder(`Page ${page + 1} of ${pageCount}: works ${currentStart}-${currentEnd}`)
      .addOptions(options),
  );
}

function buildListComponents(
  ownerId: string,
  page: number,
  pageBoundaries: number[],
  totalWorks: number,
  seriesId: string,
) {
  const pageCount = pageBoundaries.length;
  const rows = [];

  if (pageCount > 1) {
    rows.push(buildListPageSelectRow(ownerId, page, pageBoundaries, totalWorks, seriesId));
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`list:${ownerId}:${page - 1}:${seriesId}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`list:${ownerId}:${page + 1}:${seriesId}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pageCount - 1),
    ),
  );

  return rows;
}

// Default-page payload for the inactivity auto-reset.
async function buildListDefaultPayload(
  seriesId: string,
  guildId: string | null | undefined,
  ownerId: string,
): Promise<{ embeds: ReturnType<typeof ao3Embed>[]; components: ReturnType<typeof buildListComponents> | [] } | null> {
  const bundle = await getGuildSettingsBundle(guildId);
  if (!getListResetToFirstPage(bundle)) return null;

  const session = await getListSession(seriesId);
  const { embed, page, pageCount } = buildListEmbed(
    session.series,
    session.seriesURL,
    session.authors,
    session.pageBoundaries,
    0,
  );

  return {
    embeds: [embed],
    components:
      pageCount > 1
        ? buildListComponents(ownerId, page, session.pageBoundaries, session.series.works.length, seriesId)
        : [],
  };
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
  const session = await getListSession(seriesId);

  const { embed, page, pageCount } = buildListEmbed(
    session.series,
    session.seriesURL,
    session.authors,
    session.pageBoundaries,
    0,
  );

  const message = await interaction.editReply({
    embeds: [embed],
    components:
      pageCount > 1
        ? buildListComponents(
            interaction.user.id,
            page,
            session.pageBoundaries,
            session.series.works.length,
            seriesId,
          )
        : [],
  });

  scheduleInactivityReset(message, () =>
    buildListDefaultPayload(seriesId, interaction.guildId, interaction.user.id),
  );
};

export const handleListButtonInteraction = async (
  interaction: ButtonInteraction,
): Promise<boolean> => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "list") return false;

  const [, ownerId, pageText, seriesId] = parts;
  const isOwner = interaction.user.id === ownerId;
  const componentOwnerId = isOwner ? ownerId : interaction.user.id;

  // Defer immediately — getListSession can be slow on a cache miss.
  // Non-owners get their own ephemeral copy.
  if (isOwner) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const session = await getListSession(seriesId);

  const page = parseInt(pageText, 10) || 0;
  const { embed, page: safePage } = buildListEmbed(
    session.series,
    session.seriesURL,
    session.authors,
    session.pageBoundaries,
    page,
  );

  await interaction.editReply({
    embeds: [embed],
    components:
      session.pageBoundaries.length > 1
        ? buildListComponents(
            componentOwnerId,
            safePage,
            session.pageBoundaries,
            session.series.works.length,
            seriesId,
          )
        : [],
  });

  if (isOwner) {
    scheduleInactivityReset(interaction.message, () =>
      buildListDefaultPayload(seriesId, interaction.guildId, ownerId),
    );
  }

  return true;
};

export const handleListSelectInteraction = async (
  interaction: StringSelectMenuInteraction,
): Promise<boolean> => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "list-select") return false;

  const [, ownerId, seriesId] = parts;
  const isOwner = interaction.user.id === ownerId;
  const componentOwnerId = isOwner ? ownerId : interaction.user.id;

  // Defer immediately — non-owners get their own ephemeral copy.
  if (isOwner) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  const session = await getListSession(seriesId);

  const page = parseInt(interaction.values[0], 10) || 0;
  const { embed, page: safePage } = buildListEmbed(
    session.series,
    session.seriesURL,
    session.authors,
    session.pageBoundaries,
    page,
  );

  await interaction.editReply({
    embeds: [embed],
    components:
      session.pageBoundaries.length > 1
        ? buildListComponents(
            componentOwnerId,
            safePage,
            session.pageBoundaries,
            session.series.works.length,
            seriesId,
          )
        : [],
  });

  if (isOwner) {
    scheduleInactivityReset(interaction.message, () =>
      buildListDefaultPayload(seriesId, interaction.guildId, ownerId),
    );
  }

  return true;
};