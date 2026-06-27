require("dotenv").config({ override: true });

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { REST, Routes } = require("discord.js");

function fail(message, error = null) {
  console.error(message);
  if (error) {
    console.error(error);
  }
  process.exit(1);
}

function collectCommands(commandsRoot) {
  const commands = [];
  const commandFolders = fs.readdirSync(commandsRoot);

  for (const folder of commandFolders) {
    const commandsPath = path.join(commandsRoot, folder);
    const stat = fs.statSync(commandsPath);
    if (!stat.isDirectory()) {
      continue;
    }

    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
        );
      }
    }
  }

  return commands;
}

async function registerCommands(runtimeRoot) {
  if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    fail("Missing TOKEN, CLIENT_ID, or GUILD_ID in .env.");
  }

  const commandsRoot = path.join(runtimeRoot, "commands");
  if (!fs.existsSync(commandsRoot)) {
    fail(`Could not find commands directory at ${commandsRoot}.`);
  }

  const commands = collectCommands(commandsRoot);
  const rest = new REST().setToken(process.env.TOKEN);

  console.log(`Started refreshing ${commands.length} application (/) commands.`);

  const data = await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID,
    ),
    { body: commands },
  );

  console.log(`Successfully reloaded ${data.length} application (/) commands.`);
}

async function main() {
  const runtimeRoot = __dirname;
  const tsConfigPath = path.join(runtimeRoot, "tsconfig.json");
  const isCompiledRuntime = !fs.existsSync(tsConfigPath);
  const isCompiledFlag = process.argv.includes("--compiled");

  if (!isCompiledRuntime && !isCompiledFlag) {
    const tscCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const buildResult = spawnSync(tscCommand, ["tsc"], {
      cwd: runtimeRoot,
      stdio: "inherit",
      shell: false,
    });

    if (buildResult.status !== 0) {
      fail("TypeScript build failed. Commands were not deployed.");
    }

    const distDeployPath = path.join(runtimeRoot, "dist", "deploy-commands.js");
    if (!fs.existsSync(distDeployPath)) {
      fail("Build completed, but dist/deploy-commands.js was not found.");
    }

    const nodeCommand = process.execPath;
    const deployResult = spawnSync(nodeCommand, [distDeployPath, "--compiled"], {
      cwd: runtimeRoot,
      stdio: "inherit",
      shell: false,
      env: process.env,
    });

    if (deployResult.status !== 0) {
      process.exit(deployResult.status || 1);
    }
    return;
  }

  await registerCommands(runtimeRoot);
}

main().catch((error) => fail("Failed to deploy commands.", error));
