import { ShardingManager } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TOKEN;
if (!token) {
  throw new Error("Missing TOKEN environment variable");
}

const manager = new ShardingManager("./dist/bot.js", { token });

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));

manager.spawn().catch((error) => {
  console.error("Failed to spawn shards:", error);
  process.exit(1);
});