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
    console.log("Attempting to load event file:", file);
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
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((file) => {
    console.log("Attempting to load command file:", file);
    return file.endsWith(".js");
});

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(
            '[WARNING] The command at $(filePath) is missing a required "data" or "execute" property.'
        );
    }
}

// TODO: find out from ms. boba how to handle the code in this section.

// Listens to events.
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

		let ao3Links = /(http|https):\/\/(www.|)(archiveofourown.org|ao3.org)/g;
    if (ao3Links.test(message.content.toLowerCase()) === true) {
        await message.channel.send("This is a AO3 URL.");
    }
});

// Login to Discord and start bot.
client.login(process.env.TOKEN);
