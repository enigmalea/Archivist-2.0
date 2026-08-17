import { ShardingManager } from "discord.js";
import dotenv from "dotenv";
import fs from "node:fs";
import { getBotCredentials } from "./utils/botEnv.ts";
import path from "node:path";
import readline from "node:readline";

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

// Console command listener — lets PebbleHost's "Send command" scheduler
// task trigger maintenance actions without needing a shell.
const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const command = line.trim().toLowerCase();

  if (command === "clearlogs") {
    clearLogs();
  }
});

function clearLogs() {
  const logsDir = path.join(process.cwd(), "logs");

  try {
    if (fs.existsSync(logsDir)) {
      // Clear contents, not the folder itself — PebbleHost's daemon expects
      // the logs/ directory to already exist and won't necessarily recreate
      // it if it's rm -rf'd outright.
      for (const entry of fs.readdirSync(logsDir)) {
        fs.rmSync(path.join(logsDir, entry), { recursive: true, force: true });
      }
      console.log("Cleared logs/ folder");
    }
  } catch (err) {
    console.error("Failed to clear logs:", err);
  }
}