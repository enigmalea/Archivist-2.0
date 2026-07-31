import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { ButtonInteraction, EmbedBuilder } from "discord.js";
import {
  FIELD_VALUE_HARD_CAP,
  getFieldMaxLength,
  getGuildSettingsBundle,
  isFieldEnabled,
} from "../embedFields.ts";
import {
  chapterDisplay,
  formatCompletionStatus,
  publishedDate,
  updatedAt,
} from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import {
  formatCharacters,
  formatFandoms,
  formatRelationships,
  formatTags,
  formatWarnings,
  shipCategories,
} from "../tags.ts";
import { formatWorkSeries, formatWorkStartNotes, formatWorkSummary } from "../../utils/details.ts";
import { getWorkDetailsFromUrl, getWorkUrl } from "@fujocoded/ao3.js/urls";

import { ao3Embed } from "../baseEmbed.ts";
import { authError } from "../errors.ts";
import { cachedGetWork } from "../cache.ts";
import { chunkText } from "../chunkText.ts";
import { constructCreators } from "../creators.ts";
import { truncateText } from "../truncate.ts";

type CacheKey = string | number;

type WorkFieldEntry = { key: string; name: string; value: string; inline: boolean };

// Shared field computation for both the paginated (Stats/Tags/Summary tabs)
// and legacy (single embed) work embed variants, so the two stay in sync
// instead of maintaining two separate field lists.
async function computeWorkFieldData(workURL: string, guildId?: string | null) {
  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await cachedGetWork(workId);

  if (work.locked) return { locked: true as const };

  const bundle = await getGuildSettingsBundle(guildId);

  const color = embedColor(work);
  const truncateTag = (key: string, s: string) =>
    truncateText(s, getFieldMaxLength(bundle, "work-tags", key));

  const creators =
    constructCreators(work.authors, work.authors?.[0]?.anonymous) ||
    "Anonymous";
  const series = formatWorkSeries(work);
  const published = publishedDate(work);
  const updatedDate = updatedAt(work);
  const status = formatCompletionStatus(work);
  const rating = ratingIcon(work) ?? "N/A";
  const warnings = formatWarnings(work) || "None";
  const category = shipCategories(work) || "N/A";
  const fandoms = truncateTag("fandoms", formatFandoms(work) || "N/A");
  const relationships = truncateTag("relationships", formatRelationships(work) || "N/A");
  const characters = truncateTag("characters", formatCharacters(work) || "N/A");
  const tags = truncateTag("tags", formatTags(work) || "N/A");
  const rawSummary = formatWorkSummary(work);
  const fullSummaryText = rawSummary === "N/A" ? formatWorkStartNotes(work) : rawSummary;
  const summaryText =
    fullSummaryText && fullSummaryText !== "N/A"
      ? truncateText(fullSummaryText, getFieldMaxLength(bundle, "work-summary", "summary"))
      : fullSummaryText;

  const description = [`by ${creators}`, series].filter(Boolean).join("\n");

  // TODO: Add collections to embed.
  const statsFields: WorkFieldEntry[] = [
    { key: "words", name: "Words", value: work.words.toLocaleString("en-US"), inline: true },
    { key: "chapters", name: "Chapters", value: chapterDisplay(work), inline: true },
    { key: "language", name: "Language", value: work.language ?? "N/A", inline: true },
    { key: "published", name: "Published", value: published, inline: true },
    { key: "updated", name: "Updated", value: updatedDate, inline: true },
    { key: "status", name: "Status", value: status, inline: true },
    { key: "rating", name: "Rating", value: rating, inline: true },
    { key: "warnings", name: "Warnings", value: warnings, inline: true },
    { key: "category", name: "Category", value: category, inline: true },
  ].filter((f) => isFieldEnabled(bundle, "work-stats", f.key));

  const tagsFields: WorkFieldEntry[] = [
    { key: "fandoms", name: "Fandoms", value: fandoms, inline: false },
    { key: "relationships", name: "Relationships", value: relationships, inline: false },
    { key: "characters", name: "Characters", value: characters, inline: false },
    { key: "tags", name: "Additional Tags", value: tags, inline: false },
  ].filter((f) => isFieldEnabled(bundle, "work-tags", f.key));

  const summaryEnabled =
    !!summaryText && summaryText !== "N/A" && isFieldEnabled(bundle, "work-summary", "summary");

  return {
    locked: false as const,
    work,
    color,
    workURL,
    description,
    statsFields,
    tagsFields,
    summaryText,
    summaryEnabled,
  };
}

export async function buildWorkEmbedPages(
  workURL: string,
  guildId?: string | null,
): Promise<EmbedBuilder[] | { locked: true }> {
  const data = await computeWorkFieldData(workURL, guildId);
  if (data.locked) return { locked: true };

  const { work, color, description, statsFields, tagsFields, summaryText, summaryEnabled } = data;

  const statsEmbed = ao3Embed(color)
    .setTitle(work.title)
    .setURL(workURL)
    .setDescription(description)
    .addFields(statsFields.map(({ name, value, inline }) => ({ name, value, inline })));

  const tagsEmbed = ao3Embed(color)
    .setTitle(work.title)
    .setURL(workURL)
    .addFields(tagsFields.map(({ name, value, inline }) => ({ name, value, inline })));

  const pages: EmbedBuilder[] = [statsEmbed, tagsEmbed];

  // Page 3+: summary chunked at 750 chars
  if (summaryEnabled) {
    const chunks = chunkText(summaryText, 750);
    // Merge a short trailing chunk (< 250 chars) into the previous page
    if (chunks.length >= 2 && chunks[chunks.length - 1].length < 250) {
      const last = chunks.pop()!;
      chunks[chunks.length - 1] += "\n" + last;
    }
    for (const chunk of chunks) {
      pages.push(
        ao3Embed(color)
          .setTitle(work.title)
          .setURL(workURL)
          .setDescription(chunk),
      );
    }
  }

  return pages;
}

// Legacy single-embed variant (no pagination) — everything crammed into one
// embed's fields, gated behind the "Use the old single-page work embed"
// General setting. Summary/notes get hard-truncated to fit a single field
// instead of spanning pages like the paginated version does.
export async function buildLegacyWorkEmbed(
  workURL: string,
  guildId?: string | null,
): Promise<EmbedBuilder | { locked: true }> {
  const data = await computeWorkFieldData(workURL, guildId);
  if (data.locked) return { locked: true };

  const { work, color, description, statsFields, tagsFields, summaryText, summaryEnabled } = data;

  const fields = [...statsFields, ...tagsFields];
  if (summaryEnabled) {
    // The paginated variant's summary length cap can go well past 1024 (it
    // spans multiple pages), but this is a single addFields() entry — always
    // hard-cap to Discord's field limit regardless of that setting.
    fields.push({
      key: "summary",
      name: "Summary",
      value: truncateText(summaryText, FIELD_VALUE_HARD_CAP),
      inline: false,
    });
  }

  return ao3Embed(color)
    .setTitle(work.title)
    .setURL(workURL)
    .setDescription(description)
    .addFields(fields.map(({ name, value, inline }) => ({ name, value, inline })));
}

export function buildWorkEmbedComponents(
  ownerId: string,
  page: number,
  pageCount: number,
  workId: CacheKey,
) {
  const hasSummary = pageCount > 2;
  const onStats = page === 0;
  const onTags = page === 1;
  const onSummary = page >= 2;

  const tabButtons = [
    new ButtonBuilder()
      .setCustomId(`workemd-tab:${ownerId}:0:${workId}`)
      .setLabel("Stats")
      .setStyle(onStats ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(onStats),
    new ButtonBuilder()
      .setCustomId(`workemd-tab:${ownerId}:1:${workId}`)
      .setLabel("Tags")
      .setStyle(onTags ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(onTags),
  ];

  // Omitted entirely (not just disabled) when the guild has turned off the
  // Summary field, rather than showing a permanently-grayed-out button.
  if (hasSummary) {
    tabButtons.push(
      new ButtonBuilder()
        .setCustomId(`workemd-tab:${ownerId}:2:${workId}`)
        .setLabel("Summary")
        .setStyle(onSummary ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(onSummary),
    );
  }

  const tabRow = new ActionRowBuilder<ButtonBuilder>().addComponents(tabButtons);

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`workemd-nav:${ownerId}:${page - 1}:${workId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`workemd-nav:${ownerId}:${page + 1}:${workId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount - 1),
  );

  return [tabRow, navRow];
}

export const handleWorkEmbedButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (!parts[0].startsWith("workemd")) return false;

  const [, ownerId, pageText, workId] = parts;
  const isOwner = interaction.user.id === ownerId;

  // Non-owners get their own ephemeral copy to page through instead of being
  // turned away, so they don't have to repost the link to get a working embed.
  if (isOwner) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const workURL = getWorkUrl({ workId });
    const result = await buildWorkEmbedPages(workURL, interaction.guildId);
    if ("locked" in result) {
      await interaction.editReply({
        content: authError.content,
        embeds: [],
        components: [],
      });
      return true;
    }

    const page = Math.min(
      Math.max(Number.parseInt(pageText, 10) || 0, 0),
      result.length - 1,
    );
    const componentOwnerId = isOwner ? ownerId : interaction.user.id;
    await interaction.editReply({
      embeds: [result[page]],
      components:
        result.length > 1
          ? buildWorkEmbedComponents(componentOwnerId, page, result.length, workId)
          : [],
    });
  } catch (error) {
    console.error(`Failed to refresh work embed for ${workId}`, error);
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
