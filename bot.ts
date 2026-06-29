import {
  ActionRowBuilder,
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

import Bottleneck from "bottleneck";
import { authError } from "./utils/errors.ts";
import { chapterEmbed } from "./utils/embeds/chapterEmbed.ts";
import dotenv from "dotenv";
import fs from "node:fs";
import { handleAo3Url } from "./utils/urls.ts";
import path from "node:path";
import { seriesEmbed } from "./utils/embeds/seriesEmbed.ts";
import { userEmbed } from "./utils/embeds/userEmbed.ts";
import { worksEmbed } from "./utils/embeds/worksEmbed.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ao3Limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2500,
  reservoir: 20,
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 60 * 1000,
});

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

const client = new ClientWithCommands({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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

const ao3Links =
  /https?:\/\/(?:www\.)?(?:archiveofourown\.org|ao3\.org)\/\S+/g;

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const urls = message.content.replaceAll(">", "").match(ao3Links) ?? [];
  if (!urls.length) return;

  for (const url of urls) {
    try {
      if (url.includes("/works/") && !url.includes("/chapters/")) {
        await handleAo3Url({
          message,
          url,
          ao3Limiter,
          embedFn: worksEmbed,
          authError,
        });
        continue;
      }

      if (url.includes("/users/")) {
        await handleAo3Url({
          message,
          url,
          ao3Limiter,
          embedFn: userEmbed,
        });
        continue;
      }

      if (url.includes("/series/")) {
        await handleAo3Url({
          message,
          url,
          ao3Limiter,
          embedFn: seriesEmbed,
        });
        continue;
      }

      if (url.includes("/chapters/")) {
        await handleChapterLink(message, url);
        continue;
      }
    } catch (error) {
      console.error("Failed to process AO3 URL:", url, error);
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
      await handleAo3Url({
        message,
        url,
        ao3Limiter,
        embedFn: worksEmbed,
        authError,
      });
      return;
    }

    if (buttonInteraction.customId === "chapter") {
      await handleAo3Url({
        message,
        url,
        ao3Limiter,
        embedFn: chapterEmbed,
        authError,
      });
    }
  });

  collector.on("end", (collected: Collection<string, ButtonInteraction>) => {
    console.log(`Collected ${collected.size} interactions.`);
  });
}

client.login(process.env.TOKEN);