import {
  ActionRowBuilder,
  BaseInteraction,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Collection,
  ComponentType,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from "discord.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { seriesCache, userCache, workCache } from "./utils/cache.ts"

import Bottleneck from "bottleneck";
import { authError } from "./utils/errors.ts";
import { chapterEmbed } from "./utils/embeds/chapterEmbed.ts";
import dotenv from "dotenv";
import fs from "node:fs";
import { getUser } from "@fujocoded/ao3.js";
import { getWorkDetailsFromUrl } from "@fujocoded/ao3.js/urls";
import path from "node:path";
import { seriesEmbed } from "./utils/embeds/seriesEmbed.ts";
import { userEmbed } from "./utils/embeds/userEmbed.ts";
import { worksEmbed } from "./utils/embeds/worksEmbed.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ao3Limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2500,
  reservoir: 20,
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 60 * 1000,
});

dotenv.config();

// Extends Client class to add Commands
export class ClientWithCommands extends Client {
  public commands = new Collection<
    string,
    {
      name: string;
      once: boolean | undefined;
      execute: (arg: BaseInteraction | ClientWithCommands) => void;
    }
  >();
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

// Listens to message.
client.on(Events.MessageCreate, async (message) => {
  // Tells bot to ignore messages from other bots.
  if (message.author.bot) return;

  // Regex used to identify if AO3 links are in the message.
  let ao3Links =
    /(http|https):\/\/(www.|)(archiveofourown.org|ao3.org)\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;

  // Identifies if AO3 links are in message.
  if (ao3Links.test(message.content) === true) {
    /*
		Creates an Array of AO3 links in the message and removes symbol used for
		suppressing embeds from end of AO3 links.
		*/
    let urls = message.content.replaceAll(">", "").match(ao3Links)!;

    // * Identifies what type of AO3 links are in message and responds.
    for (const url of urls) {
			
			// We have a works link that does not contain chapter information
      if (url.includes("/works/") && !url.includes("/chapters/")) {

				// check cache for workID & return cache work embed
				const workId = getWorkDetailsFromUrl({ url }).workId;
				const cachedWork = workCache.get(workId);

				if (cachedWork) {
					await message.channel.send({ embeds: [cachedWork] });
					return;
				}

				// Uncached works begin fetch request from AO3
        const waitingMsg = await message.channel.send(
          "⏳ Fetching from AO3...",
        );
        try {
          const urlResponse = await ao3Limiter.schedule(() => worksEmbed(url));
          await waitingMsg.edit({ content: "", embeds: [urlResponse!] });
        } catch (error) {
          if (error === "locked") {
            await waitingMsg.edit(authError);
          }
        }
      } else if (url.includes("/users/")) {
        const waitingMsg = await message.channel.send(
          "⏳ Fetching from AO3...",
        );
        const urlResponse = await ao3Limiter.schedule(() => userEmbed(url));
        await waitingMsg.edit({ content: "", embeds: [urlResponse!] });
      } else if (url.includes("/series/")) {
        const waitingMsg = await message.channel.send(
          "⏳ Fetching from AO3...",
        );
        const urlResponse = await ao3Limiter.schedule(() => seriesEmbed(url));
        await waitingMsg.edit({ content: "", embeds: [urlResponse!] });
      } else if (url.includes("/chapters/")) {
        const question = "Would you like a work or chapter embed?";

        const work = new ButtonBuilder()
          .setCustomId("work")
          .setLabel("Work")
          .setStyle(ButtonStyle.Secondary);

        const chapter = new ButtonBuilder()
          .setCustomId("chapter")
          .setLabel("Chapter")
          .setStyle(ButtonStyle.Secondary);

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          work,
          chapter,
        );

        const botReply = await message.channel.send({
          content: question,
          components: [buttons],
        });

        const collector = botReply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15_000,
        });

        collector.on("collect", async (buttonInteraction) => {
          if (
            buttonInteraction.user.id === message.author.id &&
            buttonInteraction.customId === "work"
          ) {
            botReply.delete();
            const waitingMsg = await message.channel.send(
              "⏳ Fetching from AO3...",
            );
            const urlResponse = await ao3Limiter.schedule(() =>
              worksEmbed(url),
            );
            await waitingMsg.edit({ content: "", embeds: [urlResponse!] });
          } else if (
            buttonInteraction.user.id === message.author.id &&
            buttonInteraction.customId === "chapter"
          ) {
            botReply.delete();
            const waitingMsg = await message.channel.send(
              "⏳ Fetching from AO3...",
            );
            // replace with your chapter embed logic when ready
            const urlResponse = await ao3Limiter.schedule(() => chapterEmbed(url));
            await waitingMsg.edit({ content: "", embeds: [urlResponse!] });
          } else {
            buttonInteraction.reply({
              content: `These buttons aren't for you!`,
              flags: MessageFlags.Ephemeral,
            });
          }
        });

        collector.on("end", (collected) => {
          console.log(`Collected ${collected.size} interactions.`);
        });
      }
    }
  }
});

// Login to Discord and start bot.
client.login(process.env.TOKEN);
