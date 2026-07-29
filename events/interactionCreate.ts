import { BaseInteraction, Events } from "discord.js";

import type { ClientWithCommands } from "../bot.ts";
import { handleHelpButtonInteraction } from "../commands/general/help.ts";
import { handleListButtonInteraction } from "../commands/general/list.ts";
import {
  handleWorkGalleryButtonInteraction,
  handleWorkGallerySelectInteraction,
} from "../utils/images.ts";
import { handleUserEmbedButtonInteraction } from "../utils/embeds/userEmbed.ts";
import { handleWorkEmbedButtonInteraction } from "../utils/embeds/worksEmbed.ts";
import {
  handleRestrictionsModalSubmit,
  handleSettingsPanelButtonInteraction,
  handleSettingsPanelModalSubmit,
  handleSettingsPanelSelectInteraction,
} from "../utils/settingsPanel.ts";

export const name = Events.InteractionCreate;
export const execute = async (interaction: BaseInteraction) => {
  if (interaction.isButton()) {
    try {
      if (await handleHelpButtonInteraction(interaction)) return;
      if (await handleWorkEmbedButtonInteraction(interaction)) return;
      if (await handleWorkGalleryButtonInteraction(interaction)) return;
      if (await handleUserEmbedButtonInteraction(interaction)) return;
      if (await handleListButtonInteraction(interaction)) return;
      if (await handleSettingsPanelButtonInteraction(interaction)) return;
    } catch (error) {
      console.error("Error handling button interaction:", error);
    }
  }

  if (interaction.isStringSelectMenu()) {
    try {
      if (await handleWorkGallerySelectInteraction(interaction)) return;
      if (await handleSettingsPanelSelectInteraction(interaction)) return;
    } catch (error) {
      console.error("Error handling select menu interaction:", error);
    }
  }

  if (interaction.isModalSubmit()) {
    try {
      if (await handleRestrictionsModalSubmit(interaction)) return;
      if (await handleSettingsPanelModalSubmit(interaction)) return;
    } catch (error) {
      console.error("Error handling modal submit interaction:", error);
    }
  }

  if (interaction.isAutocomplete()) {
    const command = (interaction.client as ClientWithCommands).commands.get(
      interaction.commandName,
    );
    try {
      await command?.autocomplete?.(interaction);
    } catch (error) {
      console.error(`Error handling autocomplete for ${interaction.commandName}`);
      console.error(error);
    }
    return;
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
