import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { ButtonInteraction, EmbedBuilder } from "discord.js";
import { cachedGetWorkChapter, cachedGetWorkContent } from "../cache.ts";
import { chapterDisplay, formatCompletionStatus, publishedDate, updatedAt } from "../statuses.ts";
import { embedColor, ratingIcon } from "../ratings.ts";
import { getWorkDetailsFromUrl, getWorkUrl } from "@fujocoded/ao3.js/urls";

import { ao3Embed } from "../baseEmbed.ts";
import { authError } from "../errors.ts";
import { constructCreators } from "../creators.ts";
import { countChapterWords } from "../words.ts";
import {
  formatCharacters,
  formatFandoms,
  formatRelationships,
  formatTags,
  formatWarnings,
} from "../tags.ts";
import { formatWorkSeries } from "../../utils/details.ts";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";
import { getChapterDefaultTab, getFieldMaxLength, getGuildSettingsBundle, isFieldEnabled } from "../embedFields.ts";
import type { ChapterDefaultTab } from "../embedFields.ts";
import { extractImagesFromHtml, optimizeImageUrl } from "../images.ts";
import { chunkTextMerged } from "../chunkText.ts";
import { scheduleInactivityReset } from "../inactivityReset.ts";
import { stripIndents } from "common-tags";
import { truncateText } from "../truncate.ts";

type ChapterFieldEntry = { key: string; name: string; value: string; inline: boolean };
type CacheKey = string | number;
type ContentTabLabel = "Summary" | "Notes" | null;

const CHUNK_LENGTH = 750;

async function computeChapterFieldData(workURL: string, guildId?: string | null) {
  const { workId, chapterId } = getWorkDetailsFromUrl({ url: workURL });
  const work = await cachedGetWorkChapter(workId, chapterId);

  if (work.locked) return { locked: true as const };

  const content = await cachedGetWorkContent(workId, chapterId);
  const bundle = await getGuildSettingsBundle(guildId);
  const color = embedColor(work);

  const creators =
    constructCreators(work.authors, work.authors?.[0]?.anonymous) || "Anonymous";
  const series = formatWorkSeries(work);
  const chapterWords = countChapterWords(content.content);
  const totalWords = work.words.toString();
  const wordCount = `**${chapterWords}** [${totalWords}]`;
  const published = publishedDate(work);
  const updatedDate = updatedAt(work);
  const status = formatCompletionStatus(work);
  const rating = ratingIcon(work) ?? "N/A";
  const warnings = formatWarnings(work) || "None";

  // Chapter title: "Chapter N" or "Chapter N: Name".
  const chapterIndex = work.chapterInfo?.index ?? "?";
  const chapterTitle = work.chapterInfo?.name
    ? `Chapter ${chapterIndex}: ${work.chapterInfo.name}`
    : `Chapter ${chapterIndex}`;

  const rawSummary = htmlToMarkdown(work.chapterInfo?.summary);
  const summaryText = rawSummary
    ? truncateText(rawSummary, getFieldMaxLength(bundle, "chapter", "summary"))
    : null;

  const noteParts = [
    content.startNotes && `**Beginning:**\n${htmlToMarkdown(content.startNotes)}`,
    content.endNotes && `**End:**\n${htmlToMarkdown(content.endNotes)}`,
  ].filter(Boolean);
  const rawNotes = noteParts.length ? noteParts.join("\n\n") : null;
  const notesText = rawNotes
    ? truncateText(rawNotes, getFieldMaxLength(bundle, "chapter", "notes"))
    : null;

  const readFromBeginningUrl = getWorkUrl({ workId });

  // TODO: Add collections to embed.
  const description = stripIndents`
    **${work.title}**
    by ${creators}
    ${series}
    [Read from the beginning](${readFromBeginningUrl})
  `;

  const statsFields: ChapterFieldEntry[] = [
    { key: "words", name: "Words", value: wordCount, inline: true },
    { key: "chapters", name: "Chapters", value: chapterDisplay(work), inline: true },
    { key: "rating", name: "Rating", value: rating, inline: true },
    { key: "published", name: "Published", value: published, inline: true },
    { key: "updated", name: "Updated", value: updatedDate, inline: true },
    { key: "status", name: "Status", value: status, inline: true },
    { key: "warnings", name: "Warnings", value: warnings, inline: false },
  ].filter((f) => isFieldEnabled(bundle, "chapter", f.key));

  // Tags tab — reuses the work's tag data.
  const truncateTag = (key: string, s: string) =>
    truncateText(s, getFieldMaxLength(bundle, "chapter-tags", key));

  const tagsFields: ChapterFieldEntry[] = [
    { key: "fandoms", name: "Fandoms", value: truncateTag("fandoms", formatFandoms(work) || "N/A"), inline: false },
    {
      key: "relationships",
      name: "Relationships",
      value: truncateTag("relationships", formatRelationships(work) || "N/A"),
      inline: false,
    },
    {
      key: "characters",
      name: "Characters",
      value: truncateTag("characters", formatCharacters(work) || "N/A"),
      inline: false,
    },
    { key: "tags", name: "Additional Tags", value: truncateTag("tags", formatTags(work) || "N/A"), inline: false },
  ].filter((f) => isFieldEnabled(bundle, "chapter-tags", f.key));

  const summaryEnabled = !!summaryText && isFieldEnabled(bundle, "chapter", "summary");
  const notesEnabled = !!notesText && isFieldEnabled(bundle, "chapter", "notes");

  // Summary/Notes tab — Notes merges into Summary if both exist.
  let contentText: string | null = null;
  let contentTabLabel: ContentTabLabel = null;
  if (summaryEnabled && summaryText) {
    contentText = notesEnabled && notesText ? `${summaryText}\n\n**Notes**\n${notesText}` : summaryText;
    contentTabLabel = "Summary";
  } else if (notesEnabled && notesText) {
    contentText = notesText;
    contentTabLabel = "Notes";
  }

  // Thumbnail — first embedded image.
  const thumbnailExcludedByRating =
    (work.rating === "Mature" && isFieldEnabled(bundle, "chapter-thumbnail", "excludeMature")) ||
    (work.rating === "Explicit" && isFieldEnabled(bundle, "chapter-thumbnail", "excludeExplicit"));

  let thumbnailUrl: string | undefined;
  if (isFieldEnabled(bundle, "chapter-thumbnail", "enabled") && !thumbnailExcludedByRating) {
    const [firstImage] = extractImagesFromHtml(content.content);
    if (firstImage) thumbnailUrl = optimizeImageUrl(firstImage);
  }

  return {
    locked: false as const,
    workId,
    chapterId,
    color,
    workURL,
    chapterTitle,
    description,
    statsFields,
    tagsFields,
    contentText,
    contentTabLabel,
    thumbnailUrl,
  };
}

export interface ChapterEmbedPages {
  pages: EmbedBuilder[];
  tagsPageCount: number;
  contentPageCount: number;
  contentTabLabel: ContentTabLabel;
}

export async function buildChapterEmbedPages(
  workURL: string,
  guildId?: string | null,
): Promise<ChapterEmbedPages | { locked: true }> {
  const data = await computeChapterFieldData(workURL, guildId);
  if (data.locked) return { locked: true };

  const {
    color,
    workURL: url,
    chapterTitle,
    description,
    statsFields,
    tagsFields,
    contentText,
    contentTabLabel,
    thumbnailUrl,
  } = data;

  const statsEmbed = ao3Embed(color)
    .setTitle(chapterTitle)
    .setURL(url)
    .setDescription(description)
    .addFields(statsFields.map(({ name, value, inline }) => ({ name, value, inline })));
  if (thumbnailUrl) statsEmbed.setThumbnail(thumbnailUrl);

  const pages: EmbedBuilder[] = [statsEmbed];

  const tagsPageCount = tagsFields.length > 0 ? 1 : 0;
  if (tagsPageCount > 0) {
    pages.push(
      ao3Embed(color)
        .setTitle(chapterTitle)
        .setURL(url)
        .addFields(tagsFields.map(({ name, value, inline }) => ({ name, value, inline }))),
    );
  }

  let contentPageCount = 0;
  if (contentText) {
    const chunks = chunkTextMerged(contentText, CHUNK_LENGTH);
    contentPageCount = chunks.length;
    for (const chunk of chunks) {
      pages.push(ao3Embed(color).setTitle(chapterTitle).setURL(url).setDescription(chunk));
    }
  }

  return { pages, tagsPageCount, contentPageCount, contentTabLabel };
}

export function buildChapterEmbedComponents(
  ownerId: string,
  page: number,
  tagsPageCount: number,
  contentPageCount: number,
  contentTabLabel: ContentTabLabel,
  workId: CacheKey,
  chapterId: CacheKey,
) {
  const tagsStart = 1;
  const contentStart = tagsStart + tagsPageCount;
  const totalPages = contentStart + contentPageCount;

  const onStats = page === 0;
  const onTags = tagsPageCount > 0 && page >= tagsStart && page < contentStart;
  const onContent = contentPageCount > 0 && page >= contentStart;

  const tabButtons = [
    new ButtonBuilder()
      .setCustomId(`chapteremd-tab:${ownerId}:0:${workId}:${chapterId}`)
      .setLabel("Stats")
      .setStyle(onStats ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(onStats),
  ];

  // Tags tab — omitted if empty.
  if (tagsPageCount > 0) {
    tabButtons.push(
      new ButtonBuilder()
        .setCustomId(`chapteremd-tab:${ownerId}:${tagsStart}:${workId}:${chapterId}`)
        .setLabel("Tags")
        .setStyle(onTags ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(onTags),
    );
  }

  if (contentPageCount > 0 && contentTabLabel) {
    tabButtons.push(
      new ButtonBuilder()
        .setCustomId(`chapteremd-tab:${ownerId}:${contentStart}:${workId}:${chapterId}`)
        .setLabel(contentTabLabel)
        .setStyle(onContent ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(onContent),
    );
  }

  const tabRow = new ActionRowBuilder<ButtonBuilder>().addComponents(tabButtons);

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`chapteremd-nav:${ownerId}:${page - 1}:${workId}:${chapterId}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`chapteremd-nav:${ownerId}:${page + 1}:${workId}:${chapterId}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );

  return [tabRow, navRow];
}

// Default tab resolver.
function resolveChapterDefaultPage(
  tagsPageCount: number,
  contentPageCount: number,
  defaultTab: ChapterDefaultTab,
): number | null {
  if (defaultTab === "none") return null;
  const tagsStart = 1;
  const contentStart = tagsStart + tagsPageCount;
  if (defaultTab === "tags" && tagsPageCount > 0) return tagsStart;
  if (defaultTab === "summary" && contentPageCount > 0) return contentStart;
  return 0;
}

// Default-tab payload for the inactivity auto-reset.
export async function buildChapterEmbedDefaultPayload(
  workURL: string,
  guildId: string | null | undefined,
  ownerId: string,
): Promise<{ embeds: EmbedBuilder[]; components: ReturnType<typeof buildChapterEmbedComponents> | [] } | null> {
  const bundle = await getGuildSettingsBundle(guildId);
  const defaultTab = getChapterDefaultTab(bundle);
  if (defaultTab === "none") return null;

  const result = await buildChapterEmbedPages(workURL, guildId);
  if ("locked" in result) return null;

  const page = resolveChapterDefaultPage(result.tagsPageCount, result.contentPageCount, defaultTab);
  if (page === null) return null;

  const { workId, chapterId } = getWorkDetailsFromUrl({ url: workURL });
  return {
    embeds: [result.pages[page]],
    components:
      result.pages.length > 1
        ? buildChapterEmbedComponents(
            ownerId,
            page,
            result.tagsPageCount,
            result.contentPageCount,
            result.contentTabLabel,
            workId,
            chapterId!,
          )
        : [],
  };
}

export const handleChapterEmbedButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (!parts[0].startsWith("chapteremd")) return false;

  const [, ownerId, pageText, workId, chapterId] = parts;
  const isOwner = interaction.user.id === ownerId;

  // Non-owners get their own ephemeral copy.
  if (isOwner) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const workURL = getWorkUrl({ workId, chapterId });
    const result = await buildChapterEmbedPages(workURL, interaction.guildId);
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
      result.pages.length - 1,
    );
    const componentOwnerId = isOwner ? ownerId : interaction.user.id;
    await interaction.editReply({
      embeds: [result.pages[page]],
      components:
        result.pages.length > 1
          ? buildChapterEmbedComponents(
              componentOwnerId,
              page,
              result.tagsPageCount,
              result.contentPageCount,
              result.contentTabLabel,
              workId,
              chapterId,
            )
          : [],
    });

    if (isOwner) {
      scheduleInactivityReset(interaction.message, () =>
        buildChapterEmbedDefaultPayload(workURL, interaction.guildId, ownerId),
      );
    }
  } catch (error) {
    console.error(`Failed to refresh chapter embed for ${workId}/${chapterId}`, error);
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
