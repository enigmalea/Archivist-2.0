import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { ButtonInteraction, EmbedBuilder } from "discord.js";
import { formatCompletionStatus, startedDate, updatedAt } from "../statuses.ts";
import { getFieldMaxLength, getGuildSettingsBundle, getSeriesDefaultTab, isFieldEnabled } from "../embedFields.ts";
import type { SeriesDefaultTab } from "../embedFields.ts";

import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetSeries } from "../cache.ts";
import { chunkTextMerged } from "../chunkText.ts";
import { constructCreators } from "../creators.ts";
import { getSeriesIdFromUrl } from "../urls.ts";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";
import { scheduleInactivityReset } from "../inactivityReset.ts";
import { truncateText } from "../truncate.ts";

type SeriesFieldEntry = { key: string; name: string; value: string; inline: boolean };
type CacheKey = string | number;

const CHUNK_LENGTH = 750;

async function computeSeriesFieldData(seriesURL: string, guildId?: string | null) {
  const seriesId = getSeriesIdFromUrl(seriesURL);
  const series = await cachedGetSeries(seriesId);
  const bundle = await getGuildSettingsBundle(guildId);

  const creators =
    constructCreators(series.authors, series.authors?.[0]?.anonymous) ||
    "Anonymous";

  const rawNotes = htmlToMarkdown(series.notes);
  const notesText = rawNotes ? truncateText(rawNotes, getFieldMaxLength(bundle, "series", "notes")) : null;

  const rawDescription = htmlToMarkdown(series.description);
  const descriptionText = rawDescription
    ? truncateText(rawDescription, getFieldMaxLength(bundle, "series", "description"))
    : null;

  const descriptionLines = [
    { key: "authors", line: `**Authors:** ${creators}` },
  ]
    .filter((f) => isFieldEnabled(bundle, "series", f.key))
    .map((f) => f.line)
    .join("\n");

  const statsFields: SeriesFieldEntry[] = [
    { key: "started", name: "Started", value: startedDate(series), inline: true },
    { key: "updated", name: "Updated", value: updatedAt(series), inline: true },
    { key: "complete", name: "Status", value: `${formatCompletionStatus(series)}`, inline: true },
    { key: "workCount", name: "Works", value: `${series.workCount.toLocaleString()}`, inline: true },
    { key: "wordCount", name: "Total Words", value: `${series.words.toLocaleString()}`, inline: true },
    {
      key: "bookmarks",
      name: "Bookmarks",
      value: `${Number.isFinite(series.bookmarks) ? series.bookmarks.toLocaleString() : "0"}`,
      inline: true,
    },
  ].filter((f) => isFieldEnabled(bundle, "series", f.key));

  const notesEnabled = !!notesText && isFieldEnabled(bundle, "series", "notes");
  const descriptionEnabled = !!descriptionText && isFieldEnabled(bundle, "series", "description");

  return {
    seriesId,
    seriesName: series.name,
    seriesURL,
    descriptionLines,
    statsFields,
    notesText,
    notesEnabled,
    descriptionText,
    descriptionEnabled,
  };
}

export interface SeriesEmbedPages {
  pages: EmbedBuilder[];
  notesPageCount: number;
  descriptionPageCount: number;
}

export async function buildSeriesEmbedPages(
  seriesURL: string,
  guildId?: string | null,
): Promise<SeriesEmbedPages> {
  const {
    seriesName,
    seriesURL: url,
    descriptionLines,
    statsFields,
    notesText,
    notesEnabled,
    descriptionText,
    descriptionEnabled,
  } = await computeSeriesFieldData(seriesURL, guildId);

  const statsEmbed = ao3Embed().setTitle(seriesName).setURL(url);
  if (descriptionLines) statsEmbed.setDescription(descriptionLines);
  statsEmbed.addFields(statsFields.map(({ name, value, inline }) => ({ name, value, inline })));

  const pages: EmbedBuilder[] = [statsEmbed];

  let notesPageCount = 0;
  if (notesEnabled && notesText) {
    const chunks = chunkTextMerged(notesText, CHUNK_LENGTH);
    notesPageCount = chunks.length;
    for (const chunk of chunks) {
      pages.push(ao3Embed().setTitle(seriesName).setURL(url).setDescription(chunk));
    }
  }

  let descriptionPageCount = 0;
  if (descriptionEnabled && descriptionText) {
    const chunks = chunkTextMerged(descriptionText, CHUNK_LENGTH);
    descriptionPageCount = chunks.length;
    for (const chunk of chunks) {
      pages.push(ao3Embed().setTitle(seriesName).setURL(url).setDescription(chunk));
    }
  }

  return { pages, notesPageCount, descriptionPageCount };
}

export function buildSeriesEmbedComponents(
  ownerId: string,
  page: number,
  notesPageCount: number,
  descriptionPageCount: number,
  seriesId: CacheKey,
) {
  const notesStart = 1;
  const descriptionStart = notesStart + notesPageCount;
  const totalPages = descriptionStart + descriptionPageCount;

  const onStats = page === 0;
  const onNotes = notesPageCount > 0 && page >= notesStart && page < descriptionStart;
  const onDescription = descriptionPageCount > 0 && page >= descriptionStart;

  const tabButtons = [
    new ButtonBuilder()
      .setCustomId(`seriesemd-tab:${ownerId}:0:${seriesId}`)
      .setLabel("Stats")
      .setStyle(onStats ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(onStats),
  ];

  // Notes/Description tabs — omitted if empty.
  if (notesPageCount > 0) {
    tabButtons.push(
      new ButtonBuilder()
        .setCustomId(`seriesemd-tab:${ownerId}:${notesStart}:${seriesId}`)
        .setLabel("Notes")
        .setStyle(onNotes ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(onNotes),
    );
  }

  if (descriptionPageCount > 0) {
    tabButtons.push(
      new ButtonBuilder()
        .setCustomId(`seriesemd-tab:${ownerId}:${descriptionStart}:${seriesId}`)
        .setLabel("Description")
        .setStyle(onDescription ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(onDescription),
    );
  }

  const tabRow = new ActionRowBuilder<ButtonBuilder>().addComponents(tabButtons);

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`seriesemd-nav:${ownerId}:${page - 1}:${seriesId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`seriesemd-nav:${ownerId}:${page + 1}:${seriesId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return [tabRow, navRow];
}

// Default tab resolver.
function resolveSeriesDefaultPage(
  notesPageCount: number,
  descriptionPageCount: number,
  defaultTab: SeriesDefaultTab,
): number | null {
  if (defaultTab === "none") return null;
  const notesStart = 1;
  const descriptionStart = notesStart + notesPageCount;
  if (defaultTab === "notes" && notesPageCount > 0) return notesStart;
  if (defaultTab === "description" && descriptionPageCount > 0) return descriptionStart;
  return 0;
}

// Default-tab payload for the inactivity auto-reset.
export async function buildSeriesEmbedDefaultPayload(
  seriesURL: string,
  guildId: string | null | undefined,
  ownerId: string,
): Promise<{ embeds: EmbedBuilder[]; components: ReturnType<typeof buildSeriesEmbedComponents> | [] } | null> {
  const bundle = await getGuildSettingsBundle(guildId);
  const defaultTab = getSeriesDefaultTab(bundle);
  if (defaultTab === "none") return null;

  const result = await buildSeriesEmbedPages(seriesURL, guildId);
  const page = resolveSeriesDefaultPage(result.notesPageCount, result.descriptionPageCount, defaultTab);
  if (page === null) return null;

  const seriesId = getSeriesIdFromUrl(seriesURL);
  return {
    embeds: [result.pages[page]],
    components:
      result.pages.length > 1
        ? buildSeriesEmbedComponents(ownerId, page, result.notesPageCount, result.descriptionPageCount, seriesId)
        : [],
  };
}

export const handleSeriesEmbedButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (!parts[0].startsWith("seriesemd")) return false;

  const [, ownerId, pageText, seriesId] = parts;
  const isOwner = interaction.user.id === ownerId;

  // Non-owners get their own ephemeral copy.
  if (isOwner) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const seriesURL = `https://archiveofourown.org/series/${seriesId}`;
    const result = await buildSeriesEmbedPages(seriesURL, interaction.guildId);

    const page = Math.min(
      Math.max(Number.parseInt(pageText, 10) || 0, 0),
      result.pages.length - 1,
    );
    const componentOwnerId = isOwner ? ownerId : interaction.user.id;
    await interaction.editReply({
      embeds: [result.pages[page]],
      components:
        result.pages.length > 1
          ? buildSeriesEmbedComponents(
              componentOwnerId,
              page,
              result.notesPageCount,
              result.descriptionPageCount,
              seriesId,
            )
          : [],
    });

    if (isOwner) {
      scheduleInactivityReset(interaction.message, () =>
        buildSeriesEmbedDefaultPayload(seriesURL, interaction.guildId, ownerId),
      );
    }
  } catch (error) {
    console.error(`Failed to refresh series embed for ${seriesId}`, error);
    await interaction
      .editReply({
        content: "⚠️ Something went wrong fetching that from AO3.",
        embeds: [],
        components: [],
      })
      .catch(() => {});
  }
  return true;
};
