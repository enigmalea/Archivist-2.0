import { ShardingManager } from "discord.js";
import dotenv from "dotenv";
import { getBotCredentials } from "./utils/botEnv.ts";

dotenv.config({ quiet: true });

const { token, env } = getBotCredentials();
console.log(`Starting ShardingManager in "${env}" mode.`);

const manager = new ShardingManager("./dist/bot.js", {
  token,
});

manager.on("shardCreate", (shard) => {
  console.log(`Launched shard ${shard.id}`);

  // discord.js only exposes respawnAll() from the client side — there's no
  // built-in way for a single shard to ask to be respawned on its own. The
  // /restart dev command's "this shard" scope works around that by sending
  // a plain IPC message via client.shard.send(), which we listen for here
  // and turn into a respawn of just that one shard.
  shard.on("message", (message) => {
    if (message?.type === "shardRestartRequest") {
      shard.respawn({ delay: 500, timeout: 30000 }).catch((error) => {
        console.error(`Failed to respawn shard ${shard.id}:`, error);
      });
    }
  });
});

manager.spawn();