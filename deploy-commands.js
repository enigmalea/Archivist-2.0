require("dotenv").config();

import { REST, Routes } from "discord.js";

import fs from "node:fs";
import path from "node:path";

const commands = [];
// Selects all commands from command directory.
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

// Selects output of each command's data for deployment.
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
}

// Constructs and prepare an instance of the REST module.
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// Deploys commands to the guild.
(async () => {
    try {
        console.log(
            `Started refreshing ${commands.length} application (/) commands.`
        );

        // Fully refresh all commands in the guild with the current set.
        const data = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log(
            `Successfully reloaded ${data.length} application (/) commands.`
        );
    } catch (error) {
        // Catches and log any errors.
        console.error(error);
    }
})();
