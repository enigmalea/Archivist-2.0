import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { Api } from "@top-gg/sdk";
import { isDevUser } from "../../utils/devUsers.ts";

type Category = "announcement" | "event" | "new_feature";

export const data = new SlashCommandBuilder()
  .setName("announce")
  .setDescription("Dev: post an announcement to the top.gg page.")
  .addStringOption((o) =>
    o
      .setName("category")
      .setDescription("Announcement category (default: new feature).")
      .addChoices(
        { name: "New feature", value: "new_feature" },
        { name: "Event", value: "event" },
        { name: "Announcement", value: "announcement" },
      ),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  if (!isDevUser(interaction.user.id)) {
    await interaction.reply({
      content: "Dev only.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const token = process.env.TOPGG_TOKEN;
  if (!token) {
    await interaction.reply({
      content: "No TOPGG_TOKEN set, nothing can be posted.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const category = (interaction.options.getString("category") ??
    "new_feature") as Category;
  const modalId = `announce:${interaction.id}`;

  // top.gg limits: title 3-100 characters, body 10-2000 characters.
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle("Post to top.gg")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Title (3-100 characters)")
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("body")
          .setLabel("Body (10-2000 characters)")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(10)
          .setMaxLength(2000)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);

  const submitted = await interaction
    .awaitModalSubmit({
      time: 10 * 60_000,
      filter: (i) =>
        i.customId === modalId && i.user.id === interaction.user.id,
    })
    .catch(() => null);
  if (!submitted) return; // modal dismissed or timed out

  const title = submitted.fields.getTextInputValue("title").trim();
  const body = submitted.fields.getTextInputValue("body").trim();

  // Preview first, since announcements are public.
  const confirmId = `${modalId}:confirm`;
  const cancelId = `${modalId}:cancel`;

  const preview = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle(title)
    .setDescription(body)
    .setFooter({ text: `Category: ${category}` });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(confirmId)
      .setLabel("Post to top.gg")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(cancelId)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  await submitted.reply({
    content: "This will be posted publicly on your top.gg page. Post it?",
    embeds: [preview],
    components: [buttons],
    flags: MessageFlags.Ephemeral,
  });
  const message = await submitted.fetchReply();

  const choice = await message
    .awaitMessageComponent({
      componentType: ComponentType.Button,
      time: 2 * 60_000,
      filter: (i) => i.user.id === interaction.user.id,
    })
    .catch(() => null);

  if (!choice) {
    await submitted.editReply({
      content: "Timed out, nothing posted.",
      embeds: [],
      components: [],
    });
    return;
  }

  if (choice.customId === cancelId) {
    await choice.update({
      content: "Cancelled, nothing posted.",
      embeds: [],
      components: [],
    });
    return;
  }

  await choice.deferUpdate();

  try {
    await new Api(token).postAnnouncement(title, body, category);
    await choice.editReply({
      content: `Posted to top.gg (${category}).`,
      embeds: [],
      components: [],
    });
  } catch (error) {
    console.error("[announce] failed:", error);
    await choice.editReply({
      content: `Failed to post: ${
        error instanceof Error ? error.message : String(error)
      }`,
      embeds: [],
      components: [],
    });
  }
};