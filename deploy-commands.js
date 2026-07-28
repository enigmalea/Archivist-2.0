import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve .env relative to the project root (one level up from dist/),
// not process.cwd(). dotenv's default cwd-relative lookup silently finds
// nothing (and sets no env vars, with no error) if this script is ever
// invoked directly from inside dist/ rather than via `npm run register`
// from the project root.
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { deployCommands } = await import("./utils/deployCommands.js");

(async () => {
  try {
    const result = await deployCommands();

    console.log(`Successfully reloaded ${result.globalCount} global application (/) commands.`);

    if (result.devCommandCount === 0) {
      return;
    }

    if (result.skippedDevServers) {
      console.log(
        `Skipping ${result.devCommandCount} dev command(s) — no DEV_SERVERS configured.`,
      );
      return;
    }

    for (const r of result.devServerResults) {
      if (r.error) {
        console.error(`Failed to register dev commands for guild ${r.guildId}:`, r.error);
      } else {
        console.log(
          `Successfully reloaded ${r.count} dev application (/) commands for guild ${r.guildId}.`,
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
})();