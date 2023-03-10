import type { ClientWithCommands } from "..";
import { Events } from "discord.js";

export const name = Events.ClientReady;
export const once = true;
export const execute = (client: ClientWithCommands) => {
    console.log(`Ready! Logged in as ${client.user?.tag}`);
};
