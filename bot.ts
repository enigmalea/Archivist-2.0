import {
  ActionRowBuilder,
  AutocompleteInteraction,
  BaseInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  Collection,
  ComponentType,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getCacheStatsByType, getCacheStatsTotals } from "./utils/cacheStats.ts";
import {
  getSeriesIdFromUrl,
  getUsernameFromUrl,
  sendRedirectableEmbed,
  showTemporaryNotice,
} from "./utils/urls.ts";

import Bottleneck from "bottleneck";
import { authError } from "./utils/errors.ts";
import { buildWorkGalleryComponents, buildWorkGalleryPage } from "./utils/images.ts";
import { cachedGetSeries, cachedGetWork } from "./utils/cache.ts";
import { chapterEmbed } from "./utils/embeds/chapterEmbed.ts";
import dotenv from "dotenv";
import {
  findDisallowedWarning,
  getGuildSettingsBundle,
  getIgnoreChar,
  isFieldEnabled,
  isRatingAllowed,
  shouldShowNsfwWarning,
} from "./utils/embedFields.ts";
import { findBlockedTag } from "./utils/restrictions.ts";
import fs from "node:fs";
import { getBotCredentials } from "./utils/botEnv.ts";
import path from "node:path";
import { seriesEmbed } from "./utils/embeds/seriesEmbed.ts";
import { buildUserEmbedComponents, buildUserEmbedPages } from "./utils/embeds/userEmbed.ts";
import {
  buildLegacyWorkEmbed,
  buildWorkEmbedComponents,
  buildWorkEmbedPages,
} from "./utils/embeds/worksEmbed.ts";
import { getWorkDetailsFromUrl } from "@fujocoded/ao3.js/urls";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ao3Limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2500,
  reservoir: 20,
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 60 * 1000,
});

dotenv.config({ quiet: true });

const { token } = getBotCredentials();

// Extends Client class to add Commands
export class ClientWithCommands extends Client {
  public commands = new Collection<
    string,
    {
      name: string;
      once: boolean | undefined;
      execute: (arg: BaseInteraction | ClientWithCommands) => void;
      autocomplete?: (interaction: AutocompleteInteraction) => void;
    }
  >();

  // Exposed so broadcastEval can pull this shard's cache stats
  // (mirrors the pattern about.ts uses for guild/user counts).
  public getCacheStatsTotals = getCacheStatsTotals;
  public getCacheStatsByType = getCacheStatsByType;
}

// Declares Intents
const client = new ClientWithCommands({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Loads event listeners.
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter((file) => {
  console.log("Event Loaded:", file);
  return file.endsWith(".js");
});

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const eventModule = await import(pathToFileURL(filePath).href);
  const event = eventModule.default ?? eventModule;
  if (event.once) {
    client.once(event.name, (...args: any) => event.execute(...args));
  } else {
    client.on(event.name, (...args: any) => event.execute(...args));
  }
}

// Loads commands.
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const commandModule = await import(pathToFileURL(filePath).href);
    const command = commandModule.default ?? commandModule;

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      console.log("Command Loaded:", file);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

// TODO: Add support for respect masked links setting.
// Listens to message.
const BLOCKED_CONTENT_NOTICE_LIFETIME_MS = 10_000;

// Posts a work embed (legacy single-embed or new paginated Stats/Tags/Summary,
// per the guild's General setting) plus its gallery, redirecting either to a
// /redirect-configured destination if a rule matches this work's
// rating/fandoms. Shared by direct /works/ links and the "Work" choice on
// the chapter-link disambiguation prompt, so both get the same treatment.
async function postWorkLink(message: any, url: string) {
  const bundle = await getGuildSettingsBundle(message.guildId);
  const galleryEnabled = isFieldEnabled(bundle, "gallery", "enabled");
  const useLegacyEmbed = isFieldEnabled(bundle, "general", "legacyWorkEmbed");

  const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");
  const galleryWaitingMsg = galleryEnabled
    ? await message.channel.send("⏳ Fetching gallery...")
    : null;
  const workId = getWorkDetailsFromUrl({ url }).workId;

  // Queue both to the limiter immediately so gallery starts fetching right
  // after the work embed, without waiting for message edits in between.
  // The abort flag prevents the gallery from running if the work embed fails.
  let abortGallery = !galleryEnabled;

  // Normalized to EmbedBuilder[] either way so downstream handling (and
  // ao3Limiter's return-type inference) doesn't need to branch on which
  // embed style was built. Rating/tag restrictions are checked first so a
  // blocked work never gets its embed built at all.
  const workTask = ao3Limiter.schedule(async () => {
    const work = await cachedGetWork(workId);
    if (!work.locked) {
      if (!isRatingAllowed(bundle, work.rating)) {
        return {
          blocked: true as const,
          reason: `Links to **${work.rating}** works aren't allowed in this server.`,
        };
      }
      const blockedTag = findBlockedTag(bundle, work.tags?.additional);
      if (blockedTag) {
        return {
          blocked: true as const,
          reason: `This work is tagged "${blockedTag}", which is blocked in this server.`,
        };
      }
      const blockedWarning = findDisallowedWarning(bundle, work.tags?.warnings);
      if (blockedWarning) {
        return {
          blocked: true as const,
          reason: `This work has the "${blockedWarning}" warning, which is blocked in this server.`,
        };
      }
    }

    if (!useLegacyEmbed) return buildWorkEmbedPages(url, message.guildId);
    const result = await buildLegacyWorkEmbed(url, message.guildId);
    return "locked" in result ? result : [result];
  });
  const galleryTask = galleryEnabled
    ? ao3Limiter.schedule(async () => {
        if (abortGallery) return null;
        const work = await cachedGetWork(workId);
        const nsfwWarning = work.locked
          ? false
          : shouldShowNsfwWarning(bundle, work.rating, work.locked);
        return buildWorkGalleryPage(workId, url, 0, { nsfwWarning });
      })
    : null;

  workTask
    .then(async (result) => {
      if (result && "blocked" in result) {
        abortGallery = true;
        await showTemporaryNotice(
          waitingMsg,
          `🚫 ${result.reason}`,
          BLOCKED_CONTENT_NOTICE_LIFETIME_MS,
        );
        await galleryWaitingMsg?.delete().catch(() => {});
        return;
      }

      if (result && "locked" in result) {
        abortGallery = true;
        await waitingMsg.edit(authError);
        await galleryWaitingMsg?.delete().catch(() => {});
        return;
      }

      const embeds = [result[0]];
      const components =
        result.length > 1
          ? buildWorkEmbedComponents(message.author.id, 0, result.length, workId)
          : [];

      const work = await cachedGetWork(workId);
      await sendRedirectableEmbed(
        message,
        { embeds, components },
        {
          rating: work.locked ? undefined : work.rating,
          fandoms: work.locked ? undefined : work.fandoms,
          type: "work",
        },
        waitingMsg,
      );
    })
    .catch(async (error) => {
      abortGallery = true;
      console.error(`Failed to build work embed for ${url}`, error);
      await waitingMsg.edit("⚠️ Something went wrong fetching that from AO3.").catch(() => {});
      await galleryWaitingMsg?.delete().catch(() => {});
    });

  galleryTask
    ?.then(async (result) => {
      if (!result) {
        await galleryWaitingMsg?.delete().catch(() => {});
        return;
      }

      const work = await cachedGetWork(workId);
      await sendRedirectableEmbed(
        message,
        {
          embeds: result.page.embeds,
          files: result.page.files,
          components:
            result.totalPages > 1
              ? buildWorkGalleryComponents(message.author.id, 0, result.totalPages, workId)
              : [],
        },
        {
          rating: work.locked ? undefined : work.rating,
          fandoms: work.locked ? undefined : work.fandoms,
          type: "work",
        },
        galleryWaitingMsg,
      );
    })
    .catch(async (error) => {
      console.error(`Failed to build gallery for ${url}`, error);
      await galleryWaitingMsg?.delete().catch(() => {});
    });
}

client.on(Events.MessageCreate, async (message) => {
  // Tells bot to ignore messages from other bots.
  if (message.author.bot) return;

  // Regex used to identify if AO3 links are in the message.
  const ao3Links =
    /https?:\/\/(?:www\.)?(?:archiveofourown\.org|ao3\.org)\/\S+/g;

  // Strips the ">" Discord uses around a suppressed link preview before
  // matching. Bail out before touching the DB if there's nothing to match
  // at all — most messages in a chatty server have no AO3 link in them.
  const content = message.content.replaceAll(">", "");
  const rawMatches = [...content.matchAll(ao3Links)];
  if (rawMatches.length === 0) return;

  // Drops any link immediately preceded by the guild's configured ignore
  // character (default "%", e.g. "%https://...") — needs matchAll's
  // per-match index rather than a plain .match(), since that only returns
  // the matched URL text with no way to see what precedes it.
  const bundle = await getGuildSettingsBundle(message.guildId);
  const ignoreChar = getIgnoreChar(bundle);
  const urls = rawMatches
    .filter((match) => !ignoreChar || content[match.index - 1] !== ignoreChar)
    .map((match) => match[0]);

  if (urls.length > 0) {
    // * Identifies what type of AO3 links are in message and responds.
    for (const url of urls) {
      // For works link that does not contain chapter information:
      if (url.includes("/works/") && !url.includes("/chapters/")) {
        await postWorkLink(message, url);
        continue;
      } if (url.includes("/users/")) {
        const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");
        try {
          const username = getUsernameFromUrl(url);
          const pages = await ao3Limiter.schedule(() => buildUserEmbedPages(username, message.guildId));
          await sendRedirectableEmbed(
            message,
            {
              embeds: [pages[0]],
              components:
                pages.length > 1
                  ? buildUserEmbedComponents(message.author.id, 0, pages.length, username)
                  : [],
            },
            { type: "user" },
            waitingMsg,
          );
        } catch (error) {
          console.error(`Failed to build user embed for ${url}`);
          console.error(error);
          await waitingMsg.edit("⚠️ Something went wrong fetching that from AO3.").catch(() => {});
        }
        continue;
      }

      if (url.includes("/series/")) {
        const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");
        try {
          const seriesId = getSeriesIdFromUrl(url);
          const [embed, series] = await ao3Limiter.schedule(() =>
            Promise.all([seriesEmbed(url, message.guildId), cachedGetSeries(seriesId)]),
          );
          const fandoms = [...new Set(series.works.flatMap((w) => w.fandoms))];

          await sendRedirectableEmbed(
            message,
            { embeds: [embed] },
            { fandoms, type: "series" },
            waitingMsg,
          );
        } catch (error) {
          console.error(`Failed to build series embed for ${url}`, error);
          await waitingMsg.edit("⚠️ Something went wrong fetching that from AO3.").catch(() => {});
        }
        continue;
      }

      if (url.includes("/chapters/")) {
        await handleChapterLink(message, url);
        continue;
      }
    }

    // Deleted after processing (not before), so it only disappears once the
    // bot has actually registered/responded to every link in the message —
    // and only when there was an actual (non-ignored) link to respond to,
    // not for every message in the channel.
    if (isFieldEnabled(bundle, "general", "deleteOriginalMessage")) {
      await message.delete().catch((error: unknown) => {
        console.error(
          `Failed to delete original message ${message.id} in channel ${message.channelId} — likely missing "Manage Messages" permission there.`,
          error,
        );
      });
    }
  }
});

async function handleChapterLink(message: any, url: string) {
  const question = "Would you like a work or chapter embed?";

  const workButton = new ButtonBuilder()
    .setCustomId("work")
    .setLabel("Work")
    .setStyle(ButtonStyle.Secondary);

  const chapterButton = new ButtonBuilder()
    .setCustomId("chapter")
    .setLabel("Chapter")
    .setStyle(ButtonStyle.Secondary);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    workButton,
    chapterButton,
  );

  const botReply = await message.channel.send({
    content: question,
    components: [buttons],
  });

  const collector = botReply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15_000,
  });

  collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.user.id !== message.author.id) {
      await buttonInteraction.reply({
        content: "These buttons aren't for you!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    botReply.delete();

    if (buttonInteraction.customId === "work") {
      await postWorkLink(message, url);
      return;
    }

    if (buttonInteraction.customId === "chapter") {
      const waitingMsg = await message.channel.send("⏳ Fetching from AO3...");

      try {
        const workId = getWorkDetailsFromUrl({ url }).workId;
        const work = await cachedGetWork(workId);
        const bundle = await getGuildSettingsBundle(message.guildId);

        if (!work.locked) {
          if (!isRatingAllowed(bundle, work.rating)) {
            await showTemporaryNotice(
              waitingMsg,
              `🚫 Links to **${work.rating}** works aren't allowed in this server.`,
              BLOCKED_CONTENT_NOTICE_LIFETIME_MS,
            );
            return;
          }
          const blockedTag = findBlockedTag(bundle, work.tags?.additional);
          if (blockedTag) {
            await showTemporaryNotice(
              waitingMsg,
              `🚫 This work is tagged "${blockedTag}", which is blocked in this server.`,
              BLOCKED_CONTENT_NOTICE_LIFETIME_MS,
            );
            return;
          }
          const blockedWarning = findDisallowedWarning(bundle, work.tags?.warnings);
          if (blockedWarning) {
            await showTemporaryNotice(
              waitingMsg,
              `🚫 This work has the "${blockedWarning}" warning, which is blocked in this server.`,
              BLOCKED_CONTENT_NOTICE_LIFETIME_MS,
            );
            return;
          }
        }

        const urlResponse = await ao3Limiter.schedule(() => chapterEmbed(url, message.guildId));

        if (urlResponse && "locked" in urlResponse) {
          await waitingMsg.edit(authError);
          return;
        }

        await sendRedirectableEmbed(
          message,
          { embeds: [urlResponse] },
          {
            rating: work.locked ? undefined : work.rating,
            fandoms: work.locked ? undefined : work.fandoms,
            type: "chapter",
          },
          waitingMsg,
        );
      } catch (error) {
        console.error(`Failed to build chapter embed for ${url}`);
        console.error(error);
        await waitingMsg.edit("⚠️ Something went wrong fetching that from AO3.").catch(() => {});
      }
    }
  });

  collector.on("end", (collected: Collection<string, ButtonInteraction>) => {
    console.log(`Collected ${collected.size} interactions.`);
  });
}

// Login to Discord and start bot.
client.login(token);
