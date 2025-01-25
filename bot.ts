require("dotenv").config();

import {
  BaseInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
} from "discord.js";

import fs from "node:fs";
import path from "node:path";
import { seriesEmbed } from "./utils/embeds/seriesembed";
import { userEmbed } from "./utils/embeds/userembed";
import { worksEmbed } from "./utils/embeds/worksembed";

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
  const event = require(filePath);
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
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      console.log("Command Loaded:", file);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
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
    for (let i in urls) {
      if (urls[i].includes("/works/")) {
        let urlResponse = await worksEmbed(urls[i]);
        await message.channel.send({ embeds: [urlResponse!] });
      } else if (urls[i].includes("/users/")) {
        let urlResponse = await userEmbed(urls[i]);
        await message.channel.send({ embeds: [urlResponse!] });
      } else if (urls[i].includes("/series/")) {
        let urlResponse = await seriesEmbed(urls[i]);
        await message.channel.send({ embeds: [urlResponse!] });
      }
    }
  }
});

// Login to Discord and start bot.
client.login(process.env.TOKEN);
