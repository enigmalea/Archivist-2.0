import {
    BaseInteraction,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
} from "discord.js";

import fs from "node:fs";
import path from "node:path";

const { token } = require("./config.json"); // TODO: update to .env

export type Command = {
    name: string;
    once: boolean | undefined;
    execute: (client: ClientWithCommands, ...args: any[]) => void;
};

export class ClientWithCommands extends Client {
    public commands = new Collection<string, Command>();
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

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (message.content.toLowerCase().includes("https://")) {
        await message.channel.send("This is a URL.");
    }
});

client.login(token);
