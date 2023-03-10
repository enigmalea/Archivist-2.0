import { ActivityType, Events } from "discord.js";

import type { ClientWithCommands } from "../bot";

export const name = Events.ClientReady;
export const once = true;
export const execute = (client: ClientWithCommands) => {
	client.user?.setPresence({
		activities: [{ name: `archivistbot.com`, type: ActivityType.Watching }],
		status: 'online',
	  });
    console.log(`Ready! Logged in as ${client.user?.tag}`);
};
