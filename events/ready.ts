import { ActivityType, Events } from "discord.js";

import type { ClientWithCommands } from "../bot.ts";
import { loadEmojis } from "../utils/emojis.ts";
import { startOutageMonitor } from "../utils/otwStatus.ts";

export const name = Events.ClientReady;
export const once = true;

export const execute = async (client: ClientWithCommands) => {
  await loadEmojis(client);
  client.user?.setPresence({
		activities: [{ name: `archivistbot.com`, type: ActivityType.Watching }],
		status: 'online', });
  startOutageMonitor(client);
  console.log(`Ready! Logged in as ${client.user?.tag}`);
};