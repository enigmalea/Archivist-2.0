require("dotenv").config();

import { ShardingManager } from "discord.js";

const manager = new ShardingManager("./dist/bot.js", { token: process.env.TOKEN });

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));

manager.spawn();
