import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { getWorkUrl } from "@fujocoded/ao3.js/urls";

import { ao3Embed } from "./baseEmbed.ts";
import { Cache, cachedGetWork } from "./cache.ts";
import { embedColor } from "./ratings.ts";
import { getGuildSettingsBundle, shouldShowNsfwWarning } from "./embedFields.ts";

import type {
  ButtonInteraction,
  EmbedBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

type CacheKey = string | number;

const IMAGES_PER_PAGE = 4;
const HOUR_MS = 60 * 60 * 1000;

// Rewrites known image hosts' URLs to smaller variants before handing them
// to Discord, so its embed-image proxy has less to fetch/render — this is
// what actually determines how fast a page "appears" once the bot itself
// has responded (the bot's own lookup is cache-instant after the first load).
export function optimizeImageUrl(src: string): string {
  try {
    const url = new URL(src);

    if (url.hostname.includes("tumblr.com")) {
      // Reduce size segment (e.g. s2048x3072 → s1280) only when larger than 1280px wide
      url.pathname = url.pathname.replace(/\/s(\d+)(?:x\d+)?\//, (match, w) =>
        parseInt(w, 10) > 1280 ? "/s1280/" : match,
      );
      url.pathname = url.pathname.replace(/\.(jpe?g|png)$/i, ".webp");
      return url.toString();
    }

    if (url.hostname === "pbs.twimg.com") {
      url.searchParams.set("format", "webp");
      const name = url.searchParams.get("name") ?? "orig";
      if (name === "orig" || name === "large" || name === "4096x4096") {
        url.searchParams.set("name", "medium");
      }
      return url.toString();
    }
  } catch {}
  return src;
}

function nsfwWarningText(rating: string): string {
  const article = rating === "Explicit" ? "an" : "a";
  return `## ⚠️ NSFW Warning ⚠️\nBe advised that the following images are from ${article} **${rating}**-rated work and *may* contain NSFW content.`;
}

const workImagesCache = new Cache<string[]>(HOUR_MS);

export interface GalleryPage {
  embeds: EmbedBuilder[];
  files: AttachmentBuilder[];
}

export interface GalleryResult {
  page: GalleryPage;
  totalPages: number;
}

export function extractImagesFromHtml(html: string): string[] {
  return [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*/gi)]
    .map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'))
    .filter((src) => src.startsWith("http://") || src.startsWith("https://"));
}

// Fetches the full work in one request using AO3's view_full_work param
// instead of one request per chapter, then caches the extracted image URLs.
async function fetchWorkImages(workId: CacheKey): Promise<string[]> {
  return workImagesCache.getOrSet(workId, async () => {
    const url = `${getWorkUrl({ workId })}?view_full_work=true`;
    const response = await fetch(url, {
      headers: { Cookie: "view_adult=true;" },
    });
    return extractImagesFromHtml(await response.text());
  });
}

// Builds a single gallery page. Returns null if the work has no images.
export async function buildWorkGalleryPage(
  workId: CacheKey,
  workURL: string,
  pageIndex: number,
  { nsfwWarning = false }: { nsfwWarning?: boolean } = {},
): Promise<GalleryResult | null> {
  const [imageUrls, work] = await Promise.all([
    fetchWorkImages(workId),
    cachedGetWork(workId),
  ]);

  if (imageUrls.length === 0) return null;

  const title = work.locked ? "Gallery" : `Gallery ${work.title}`;
  const color = work.locked ? undefined : embedColor(work);

  const imagePageCount = Math.ceil(imageUrls.length / IMAGES_PER_PAGE);
  // With a warning enabled, page 0 is a dedicated warning-only page — no
  // images are attached to that page, so nothing is visible until Next is
  // clicked. Image pages then shift down by one.
  const totalPages = imagePageCount + (nsfwWarning ? 1 : 0);
  const clampedPage = Math.min(Math.max(pageIndex, 0), totalPages - 1);

  if (nsfwWarning && clampedPage === 0) {
    console.log(`Gallery: work ${workId} page 1/${totalPages} [warning, no images]`);

    const warningEmbed = ao3Embed(color)
      .setTitle(title)
      .setURL(workURL)
      .setDescription(nsfwWarningText(work.locked ? "Mature" : work.rating))
      .setFooter({ text: `Page 1 of ${totalPages}` });

    return { page: { embeds: [warningEmbed], files: [] }, totalPages };
  }

  const imagePageIndex = clampedPage - (nsfwWarning ? 1 : 0);
  const start = imagePageIndex * IMAGES_PER_PAGE;
  const slice = imageUrls.slice(start, start + IMAGES_PER_PAGE);

  console.log(
    `Gallery: work ${workId} page ${clampedPage + 1}/${totalPages} (images ${start + 1}–${start + slice.length}/${imageUrls.length})\n` +
      slice.map((src, i) => `  ${start + i + 1}. ${src}`).join("\n"),
  );

  const footer = `Page ${clampedPage + 1} of ${totalPages} · Images ${start + 1}–${start + slice.length} of ${imageUrls.length}`;

  const embeds = slice.map((src, i) => {
    const embed = ao3Embed(color).setTitle(title).setURL(workURL).setImage(optimizeImageUrl(src));
    if (i === 0) embed.setFooter({ text: footer });
    return embed;
  });

  return { page: { embeds, files: [] }, totalPages };
}

const MAX_SELECT_OPTIONS = 25;

// Discord select menus cap out at 25 options, so for long galleries we show
// a window of pages centered on the current one instead of every page.
function buildPageSelectRow(
  ownerId: string,
  page: number,
  pageCount: number,
  workId: CacheKey,
  loading: boolean,
) {
  const windowStart =
    pageCount <= MAX_SELECT_OPTIONS
      ? 0
      : Math.max(0, Math.min(page - Math.floor(MAX_SELECT_OPTIONS / 2), pageCount - MAX_SELECT_OPTIONS));
  const windowEnd = Math.min(windowStart + MAX_SELECT_OPTIONS, pageCount);

  const options = [];
  for (let i = windowStart; i < windowEnd; i++) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`Page ${i + 1}`)
        .setValue(String(i))
        .setDefault(i === page),
    );
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`gallery-select:${ownerId}:${workId}`)
      .setPlaceholder(`Page ${page + 1} of ${pageCount}`)
      .setDisabled(loading)
      .addOptions(options),
  );
}

export function buildWorkGalleryComponents(
  ownerId: string,
  page: number,
  pageCount: number,
  workId: CacheKey,
  { loading = false }: { loading?: boolean } = {},
) {
  const rows = [];

  if (pageCount > 1) {
    rows.push(buildPageSelectRow(ownerId, page, pageCount, workId, loading));
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`gallery:${ownerId}:${page - 1}:${workId}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(loading || page <= 0),
      new ButtonBuilder()
        .setCustomId(`gallery:${ownerId}:${page + 1}:${workId}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(loading || page >= pageCount - 1),
    ),
  );

  return rows;
}

// Shared by the Prev/Next buttons and the page-jump select menu — both just
// need to know which page to render next.
async function renderGalleryPage(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  ownerId: string,
  workId: CacheKey,
  currentPage: number,
): Promise<void> {
  await interaction.deferUpdate();

  await interaction.editReply({
    components: buildWorkGalleryComponents(
      ownerId,
      currentPage,
      currentPage + 2,
      workId,
      { loading: true },
    ),
  });

  const work = await cachedGetWork(workId);
  const nsfwWarning = work.locked
    ? false
    : shouldShowNsfwWarning(await getGuildSettingsBundle(interaction.guildId), work.rating, work.locked);

  const workURL = getWorkUrl({ workId });
  const result = await buildWorkGalleryPage(workId, workURL, currentPage, {
    nsfwWarning,
  });

  if (!result) {
    await interaction
      .editReply({
        content: "No images found for this work.",
        embeds: [],
        files: [],
        components: [],
      })
      .catch(() => {});
    return;
  }

  await interaction.editReply({
    content: "",
    embeds: result.page.embeds,
    files: result.page.files,
    components:
      result.totalPages > 1
        ? buildWorkGalleryComponents(ownerId, currentPage, result.totalPages, workId)
        : [],
  });
}

export const handleWorkGalleryButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "gallery") return false;

  const [, ownerId, pageText, workId] = parts;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "This gallery belongs to someone else. Post the link yourself to get your own copy.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const currentPage = Number.parseInt(pageText, 10) || 0;
  await renderGalleryPage(interaction, ownerId, workId, currentPage);
  return true;
};

export const handleWorkGallerySelectInteraction = async (
  interaction: StringSelectMenuInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "gallery-select") return false;

  const [, ownerId, workId] = parts;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "This gallery belongs to someone else. Post the link yourself to get your own copy.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const currentPage = Number.parseInt(interaction.values[0], 10) || 0;
  await renderGalleryPage(interaction, ownerId, workId, currentPage);
  return true;
};
