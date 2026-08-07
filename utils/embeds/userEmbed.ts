import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import type { ButtonInteraction, EmbedBuilder } from "discord.js";
import { getFieldMaxLength, getGuildSettingsBundle, isFieldEnabled } from "../embedFields.ts";

import { ao3Embed } from "../baseEmbed.ts";
import { cachedGetUser } from "../cache.ts";
import { chunkText } from "../chunkText.ts";
import { htmlToMarkdown } from "../htmlToMarkdown.ts";
import { scheduleInactivityReset } from "../inactivityReset.ts";
import { truncateText } from "../truncate.ts";

const BIO_PAGE_LENGTH = 750;
const BIO_INLINE_THRESHOLD = 300;
const BIO_TRAILING_MERGE_THRESHOLD = 350;
const MAX_HR_PER_PAGE = 2;
const AO3_BASE_URL = "https://archiveofourown.org";

// Resolves AO3's relative default-avatar path to an absolute URL.
function resolveIconUrl(icon: string | null | undefined): string | null {
  return icon ? new URL(icon, AO3_BASE_URL).href : null;
}

function padInlineRow(embed: EmbedBuilder, fieldCount: number) {
  const padding = (3 - (fieldCount % 3)) % 3;
  for (let i = 0; i < padding; i++) {
    embed.addFields({ name: "​", value: "​", inline: true });
  }
}

// Keeps at most MAX_HR_PER_PAGE horizontal rules ("---") per chunk before
// splitting, so a page never straddles more section breaks than that even
// if it would otherwise fit under BIO_PAGE_LENGTH.
function splitBioByHr(bio: string, maxHrPerPage: number): string[] {
  const lines = bio.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  let hrCount = 0;

  for (const line of lines) {
    current.push(line);
    if (line.trim() === "---") {
      hrCount++;
      if (hrCount >= maxHrPerPage) {
        sections.push(current.join("\n").trim());
        current = [];
        hrCount = 0;
      }
    }
  }

  const remainder = current.join("\n").trim();
  if (remainder) sections.push(remainder);

  return sections;
}

// A line that's nothing but a bold label (e.g. "**Warnings**") or an ATX
// heading (e.g. "## Warnings") - a subheader, as opposed to "**Pronouns:**
// she/her" which already carries its content on the same line.
const SUBHEADER_LINE = /^(#{1,6}\s+\S.*|\*\*[^*\n]+\*\*)$/;

// Moves a subheader line stranded at the end of a chunk to the start of the
// next chunk, so a page never ends with a bare section header while its
// content begins the following page.
function pullSubheadersForward(chunks: string[]): string[] {
  const result = [...chunks];

  for (let i = 0; i < result.length - 1; i++) {
    const lines = result[i].split("\n");
    const lastLine = lines[lines.length - 1]?.trim();
    if (!lastLine || !SUBHEADER_LINE.test(lastLine)) continue;

    lines.pop();
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

    result[i] = lines.join("\n").trim();
    result[i + 1] = `${lastLine}\n${result[i + 1]}`.trim();
  }

  return result.filter((chunk) => chunk.length > 0);
}

// A chunk that's nothing but a single markdown link - typically a long
// image/profile URL that pushes it past minLength even though it has no
// real content of its own.
const LONE_LINK_CHUNK = /^\[[^\]]*\]\([^)]+\)$/;

// Folds a too-short (or link-only) trailing chunk into the one before it
// instead of leaving a near-empty, link-only final page.
function mergeShortTrailingChunk(
  chunks: string[],
  minLength: number,
): string[] {
  if (chunks.length < 2) return chunks;

  const last = chunks[chunks.length - 1];
  if (last.length >= minLength && !LONE_LINK_CHUNK.test(last.trim())) {
    return chunks;
  }

  const secondToLast = chunks[chunks.length - 2];
  return [...chunks.slice(0, -2), `${secondToLast}\n${last}`];
}

export async function buildUserEmbedPages(
  username: string,
  guildId?: string | null,
): Promise<EmbedBuilder[]> {
  const user = await cachedGetUser(username);
  const userURL = `https://archiveofourown.org/users/${user.username}`;

  const bundle = await getGuildSettingsBundle(guildId);
  const enabled = (key: string) => isFieldEnabled(bundle, "user", key);

  const header = user.header ? `# ${user.header}` : null;
  const rawBio = enabled("bio") ? htmlToMarkdown(user.bioHtml) : null;
  const bio = rawBio
    ? truncateText(rawBio, getFieldMaxLength(bundle, "user", "bio"))
    : rawBio;

  const profilePage = ao3Embed()
    .setTitle(username)
    .setURL(userURL)
    .setThumbnail(resolveIconUrl(user.icon))
    .setDescription(header);

  if (enabled("pseuds")) {
    profilePage.addFields({ name: "Pseuds", value: user.pseuds, inline: false });
  }

  const profileRow: { name: string; value: string; inline: boolean }[] = [];
  if (enabled("joined")) {
    profileRow.push({ name: "Joined", value: user.joined, inline: true });
  }
  if (user.location && enabled("location")) {
    profileRow.push({ name: "Location", value: user.location, inline: true });
  }
  if (user.birthday && enabled("birthday")) {
    profileRow.push({ name: "Birthday", value: user.birthday, inline: true });
  }
  if (profileRow.length > 0) {
    profilePage.addFields(profileRow);
    padInlineRow(profilePage, profileRow.length);
  }

  const statsRow = [
    { key: "works", name: "Works", value: `[${user.works}](${userURL}/works)`, inline: true },
    { key: "series", name: "Series", value: `[${user.series}](${userURL}/series)`, inline: true },
    {
      key: "collections",
      name: "Collections",
      value: `[${user.collections}](${userURL}/collections)`,
      inline: true,
    },
    {
      key: "bookmarks",
      name: "Bookmarks",
      value: `[${user.bookmarks}](${userURL}/bookmarks)`,
      inline: true,
    },
    { key: "gifts", name: "Gifts", value: `[${user.gifts}](${userURL}/gifts)`, inline: true },
  ].filter((f) => enabled(f.key));

  if (statsRow.length > 0) {
    profilePage.addFields(statsRow.map(({ name, value, inline }) => ({ name, value, inline })));
    padInlineRow(profilePage, statsRow.length);
  }

  // Short or missing bios stay on the profile page instead of spending a
  // whole extra page on a couple lines of text.
  if (!bio || bio.length < BIO_INLINE_THRESHOLD) {
    if (enabled("bio")) {
      profilePage.addFields({
        name: "​",
        value: `${bio ?? "*This user does not have a bio.*"}`,
        inline: false,
      });
    }
    return [profilePage];
  }

  const bioChunks = mergeShortTrailingChunk(
    pullSubheadersForward(
      splitBioByHr(bio, MAX_HR_PER_PAGE).flatMap((section) =>
        mergeShortTrailingChunk(
          chunkText(section, BIO_PAGE_LENGTH),
          BIO_TRAILING_MERGE_THRESHOLD,
        ),
      ),
    ),
    BIO_TRAILING_MERGE_THRESHOLD,
  );

  const bioPages = bioChunks.map((chunk) =>
    ao3Embed()
      .setTitle(username)
      .setURL(userURL)
      .setThumbnail(resolveIconUrl(user.icon))
      .setDescription(chunk),
  );

  return [profilePage, ...bioPages];
}

export function buildUserEmbedComponents(
  ownerId: string,
  page: number,
  pageCount: number,
  username: string,
) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`user:${ownerId}:${page - 1}:${username}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`user:${ownerId}:${page + 1}:${username}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pageCount - 1),
    ),
  ];
}

// Default-page payload for the inactivity auto-reset.
export async function buildUserEmbedDefaultPayload(
  username: string,
  guildId: string | null | undefined,
  ownerId: string,
): Promise<{ embeds: EmbedBuilder[]; components: ReturnType<typeof buildUserEmbedComponents> | [] } | null> {
  const bundle = await getGuildSettingsBundle(guildId);
  if (!isFieldEnabled(bundle, "user-inactivity", "resetToFirstPage")) return null;

  const pages = await buildUserEmbedPages(username, guildId);
  return {
    embeds: [pages[0]],
    components: pages.length > 1 ? buildUserEmbedComponents(ownerId, 0, pages.length, username) : [],
  };
}

export const handleUserEmbedButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "user") return false;

  const [, ownerId, pageText, username] = parts;
  const isOwner = interaction.user.id === ownerId;

  // Non-owners get their own ephemeral copy to page through instead of being
  // turned away, so they don't have to repost the link to get a working embed.
  if (isOwner) {
    await interaction.deferUpdate();
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  try {
    const pages = await buildUserEmbedPages(username, interaction.guildId);
    const page = Math.min(
      Math.max(Number.parseInt(pageText, 10) || 0, 0),
      pages.length - 1,
    );

    const componentOwnerId = isOwner ? ownerId : interaction.user.id;
    await interaction.editReply({
      embeds: [pages[page]],
      components:
        pages.length > 1
          ? buildUserEmbedComponents(componentOwnerId, page, pages.length, username)
          : [],
    });

    if (isOwner) {
      scheduleInactivityReset(interaction.message, () =>
        buildUserEmbedDefaultPayload(username, interaction.guildId, ownerId),
      );
    }
  } catch (error) {
    console.error(`Failed to refresh user embed for ${username}`, error);
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
