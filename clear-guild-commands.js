import { Client, GatewayIntentBits } from "discord.js";

import dotenv from "dotenv";

dotenv.config({ quiet: true });

// One-off maintenance script: wipes any guild-scoped slash commands so only
// the globally-registered set (from deploy-commands.js) remains, clearing
// the "each command shows twice" duplication when both scopes are populated.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      const existing = await guild.commands.fetch();
      if (existing.size === 0) {
        console.log(`${guild.name} (${guild.id}): no guild-specific commands.`);
        continue;
      }
      await guild.commands.set([]);
      console.log(`${guild.name} (${guild.id}): cleared ${existing.size} guild-specific command(s).`);
    } catch (error) {
      console.error(`${guild.name} (${guild.id}): failed to clear commands.`, error);
    }
  }

  process.exit(0);
});

client.login(process.env.TOKEN);
