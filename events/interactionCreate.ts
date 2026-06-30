import { BaseInteraction, Events } from "discord.js";

import type { ClientWithCommands } from "../bot.ts";
import { handleHelpButtonInteraction } from "../commands/general/help.ts";
import { handleUserEmbedButtonInteraction } from "../utils/embeds/userEmbed.ts";

export const name = Events.InteractionCreate;
export const execute = async (interaction: BaseInteraction) => {
  if (interaction.isButton()) {
    if (await handleHelpButtonInteraction(interaction)) return;
    if (await handleUserEmbedButtonInteraction(interaction)) return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as ClientWithCommands).commands.get(
    interaction.commandName
  );

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}`);
    console.error(error);
  }
};
