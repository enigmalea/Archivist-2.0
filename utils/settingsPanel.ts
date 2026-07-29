import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import { ao3Embed } from "./baseEmbed.ts";
import {
  EMBED_FIELD_CATEGORIES,
  EMBED_FIELD_GROUPS,
  FIELD_VALUE_HARD_CAP,
  getCategoryFieldStates,
  getFieldMaxLength,
  getFieldMaxLengthCap,
  getGuildSettingsBundle,
  getIgnoreChar,
  isFieldEnabled,
  resetCategoryToDefaults,
  setCategoryFields,
  setFieldMaxLengths,
  setIgnoreChar,
  setSingleFieldEnabled,
} from "./embedFields.ts";
import { getBlockedTags, setBlockedTags } from "./restrictions.ts";

import type { EmbedFieldCategory, GuildSettingsBundle } from "./embedFields.ts";
import type {
  ButtonInteraction,
  EmbedBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";

const NAV_PREFIX = "settingsfields-nav";
const SELECT_PREFIX = "settingsfields-select";
const CONFIGURE_PREFIX = "settingsfields-cfg";
const MODAL_PREFIX = "settingsfields-modal";
const RESTRICTIONS_MODAL_PREFIX = "settingsfields-restrictions-modal";
const RESET_PREFIX = "settingsfields-reset";
const RESET_CONFIRM_PREFIX = "settingsfields-reset-confirm";
const RESET_CANCEL_PREFIX = "settingsfields-reset-cancel";
const DELETE_CONFIRM_PREFIX = "settingsfields-delmsg-confirm";
const DELETE_CANCEL_PREFIX = "settingsfields-delmsg-cancel";
const CHECKBOX_GROUP_ID = "fields";
const LENGTH_PREFIX = "length";
const BLOCKED_TAGS_INPUT_ID = "blockedTags";
const IGNORE_CHAR_INPUT_ID = "ignoreChar";

const DELETE_ORIGINAL_MESSAGE_KEY = "deleteOriginalMessage";
const DELETE_ORIGINAL_MESSAGE_WARNING =
  "The bot will delete the user's **entire original message** after posting " +
  "its embed(s) — not just the link. Any other text they wrote in that " +
  "message is deleted too, and this can't be undone.";

function groupAt(index: number) {
  return EMBED_FIELD_GROUPS[Math.min(Math.max(index, 0), EMBED_FIELD_GROUPS.length - 1)];
}

function buildCheckboxOption(f: { key: string; label: string; description?: string; enabled: boolean }) {
  const option = new CheckboxGroupOptionBuilder().setLabel(f.label).setValue(f.key).setDefault(f.enabled);
  if (f.description) option.setDescription(f.description);
  return option;
}

function formatRestrictionsSummary(bundle: GuildSettingsBundle): string {
  const warningLines = getCategoryFieldStates(bundle, "restrictions")
    .map((f) => `${f.enabled ? "✅" : "❌"} ${f.label}`)
    .join("\n");

  const tags = getBlockedTags(bundle);
  const tagsLine =
    tags.length > 0 ? tags.map((t) => `🚫 ${t}`).join(", ") : "*none*";

  return `${warningLines}\n\n**Blocked Additional Tags:**\n${tagsLine}`;
}

export async function buildGroupEmbed(
  guildId: string | null | undefined,
  groupIndex: number,
): Promise<EmbedBuilder> {
  const group = groupAt(groupIndex);
  const bundle = await getGuildSettingsBundle(guildId);

  const embed = ao3Embed()
    .setTitle(group.title)
    .setFooter({ text: `Page ${groupIndex + 1} of ${EMBED_FIELD_GROUPS.length}` });

  for (const categoryKey of group.categories) {
    const meta = EMBED_FIELD_CATEGORIES[categoryKey];

    const fieldLines =
      categoryKey === "restrictions"
        ? formatRestrictionsSummary(bundle)
        : getCategoryFieldStates(bundle, categoryKey)
            .map((f) => {
              const check = f.enabled ? "✅" : "❌";
              const length = f.maxLength
                ? ` *(max ${getFieldMaxLength(bundle, categoryKey, f.key)})*`
                : "";
              return `${check} ${f.label}${length}`;
            })
            .join("\n");

    const showsLegacySummaryCapNote =
      categoryKey === "work-summary" &&
      getFieldMaxLength(bundle, "work-summary", "summary") > FIELD_VALUE_HARD_CAP &&
      isFieldEnabled(bundle, "general", "legacyWorkEmbed");

    const lines =
      categoryKey === "general"
        ? `${fieldLines}\n\n**Ignore character:** \`${getIgnoreChar(bundle)}\``
        : showsLegacySummaryCapNote
          ? `${fieldLines}\n\n⚠️ *Legacy embed mode is on, so Summary is capped at ${FIELD_VALUE_HARD_CAP} characters here regardless of the length above — that only applies to the paginated embed.*`
          : fieldLines;

    embed.addFields({
      name: meta.title,
      value: lines,
      inline: group.key !== "general" && group.categories.length > 1,
    });
  }

  return embed;
}

export function buildGroupComponents(groupIndex: number) {
  const group = groupAt(groupIndex);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(SELECT_PREFIX)
      .setPlaceholder("Jump to a category…")
      .addOptions(
        EMBED_FIELD_GROUPS.map((g, i) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(g.title)
            .setValue(String(i))
            .setDefault(i === groupIndex),
        ),
      ),
  );

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${NAV_PREFIX}:${groupIndex - 1}`)
      .setLabel("Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(groupIndex <= 0),
    new ButtonBuilder()
      .setCustomId(`${NAV_PREFIX}:${groupIndex + 1}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(groupIndex >= EMBED_FIELD_GROUPS.length - 1),
  );

  const configureRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    group.categories.map((categoryKey) =>
      new ButtonBuilder()
        .setCustomId(`${CONFIGURE_PREFIX}:${groupIndex}:${categoryKey}`)
        .setLabel(EMBED_FIELD_CATEGORIES[categoryKey].title)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  const resetRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${RESET_PREFIX}:${groupIndex}`)
      .setLabel(`Reset ${group.title} to defaults`)
      .setStyle(ButtonStyle.Danger),
  );

  return [selectRow, navRow, configureRow, resetRow];
}

function buildResetConfirmEmbed(groupIndex: number): EmbedBuilder {
  const group = groupAt(groupIndex);
  const categoryTitles = group.categories
    .map((categoryKey) => EMBED_FIELD_CATEGORIES[categoryKey].title)
    .join(", ");

  return ao3Embed()
    .setTitle(`Reset ${group.title}?`)
    .setDescription(
      `This resets **every category on this page** (${categoryTitles}) back to their default values` +
        (group.categories.includes("restrictions")
          ? ", including clearing the Blocked Additional Tags list"
          : "") +
        `. This can't be undone.`,
    );
}

function buildResetConfirmComponents(groupIndex: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${RESET_CONFIRM_PREFIX}:${groupIndex}`)
        .setLabel("Yes, reset to defaults")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${RESET_CANCEL_PREFIX}:${groupIndex}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildDeleteOriginalMessageConfirmEmbed(): EmbedBuilder {
  return ao3Embed()
    .setTitle("Enable full message deletion?")
    .setDescription(DELETE_ORIGINAL_MESSAGE_WARNING);
}

function buildDeleteOriginalMessageConfirmComponents(groupIndex: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${DELETE_CONFIRM_PREFIX}:${groupIndex}`)
        .setLabel("Yes, delete entire messages")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`${DELETE_CANCEL_PREFIX}:${groupIndex}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

async function buildFieldsModal(
  guildId: string | null | undefined,
  groupIndex: number,
  categoryKey: EmbedFieldCategory,
): Promise<ModalBuilder> {
  const group = groupAt(groupIndex);
  const meta = EMBED_FIELD_CATEGORIES[categoryKey];
  const bundle = await getGuildSettingsBundle(guildId);
  const states = getCategoryFieldStates(bundle, categoryKey);

  const checkboxGroup = new CheckboxGroupBuilder()
    .setCustomId(CHECKBOX_GROUP_ID)
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(states.length)
    .setOptions(states.map(buildCheckboxOption));

  const [label, description] =
    categoryKey === "ratings"
      ? ["Allowed ratings", "Uncheck a rating to block links to works with it."]
      : categoryKey === "general"
        ? ["Preferences", "Toggle general bot behavior for this server."]
        : ["Visible fields", "Uncheck a field to hide it from this embed."];

  const checkboxLabel = new LabelBuilder()
    .setLabel(label)
    .setDescription(description)
    .setCheckboxGroupComponent(checkboxGroup);

  const lengthLabels = states
    .filter((f) => f.maxLength)
    .map((f) => {
      const cap = getFieldMaxLengthCap(categoryKey, f.key);
      return new LabelBuilder()
        .setLabel(`${f.label} — max length (1–${cap})`)
        .setDescription("Characters over this limit are cut off with an ellipsis.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(`${LENGTH_PREFIX}:${f.key}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(String(cap).length)
            .setValue(String(getFieldMaxLength(bundle, categoryKey, f.key))),
        );
    });

  // Not a toggle or a length limit, so it doesn't fit the catalog-driven
  // FieldDef shape above — appended directly here, only for Preferences.
  const ignoreCharLabel =
    categoryKey === "general"
      ? [
          new LabelBuilder()
            .setLabel("Ignore character")
            .setDescription('Prefix a link with this to stop it from being embedded, e.g. "%https://...".')
            .setTextInputComponent(
              new TextInputBuilder()
                .setCustomId(IGNORE_CHAR_INPUT_ID)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(1)
                .setValue(getIgnoreChar(bundle)),
            ),
        ]
      : [];

  return new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}:${groupIndex}:${categoryKey}`)
    .setTitle(`${group.title} — ${meta.title}`.slice(0, 45))
    .addComponents(checkboxLabel, ...lengthLabels, ...ignoreCharLabel);
}

// Restrictions doesn't fit the checkbox-group shape (it's a free-text list
// of Additional Tags to exclude works by, not a fixed set of toggles), so
// it gets its own text-input-only modal.
async function buildRestrictionsModal(
  guildId: string | null | undefined,
  groupIndex: number,
): Promise<ModalBuilder> {
  const bundle = await getGuildSettingsBundle(guildId);
  const states = getCategoryFieldStates(bundle, "restrictions");

  const checkboxGroup = new CheckboxGroupBuilder()
    .setCustomId(CHECKBOX_GROUP_ID)
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(states.length)
    .setOptions(states.map(buildCheckboxOption));

  const warningsLabel = new LabelBuilder()
    .setLabel("Allowed Archive Warnings")
    .setDescription("Uncheck a warning to block any work tagged with it.")
    .setCheckboxGroupComponent(checkboxGroup);

  const currentTags = getBlockedTags(bundle).join(", ");
  const tagsLabel = new LabelBuilder()
    .setLabel("Blocked Additional Tags (comma-separated)")
    .setDescription("Any work with a matching tag is blocked from being posted at all.")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(BLOCKED_TAGS_INPUT_ID)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000)
        .setValue(currentTags)
        .setPlaceholder("e.g. Character Death, Non-Con, Rape/Non-Con"),
    );

  return new ModalBuilder()
    .setCustomId(`${RESTRICTIONS_MODAL_PREFIX}:${groupIndex}`)
    .setTitle("General — Restrictions")
    .addComponents(warningsLabel, tagsLabel);
}

// Handles the Prev/Next pagination, the per-category Configure buttons that
// open the field-toggle modal for that category, the reset-to-defaults
// confirm/cancel pair, and the delete-original-message confirm/cancel pair.
export async function handleSettingsPanelButtonInteraction(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const parts = interaction.customId.split(":");
  const prefix = parts[0];

  if (prefix === NAV_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    await interaction.update({
      embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
      components: buildGroupComponents(groupIndex),
    });
    return true;
  }

  if (prefix === CONFIGURE_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    const categoryKey = parts[2] as EmbedFieldCategory;
    // showModal must be the interaction's first response — no defer beforehand.
    const modal =
      categoryKey === "restrictions"
        ? await buildRestrictionsModal(interaction.guildId, groupIndex)
        : await buildFieldsModal(interaction.guildId, groupIndex, categoryKey);
    await interaction.showModal(modal);
    return true;
  }

  if (prefix === RESET_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    await interaction.update({
      embeds: [buildResetConfirmEmbed(groupIndex)],
      components: buildResetConfirmComponents(groupIndex),
    });
    return true;
  }

  if (prefix === RESET_CANCEL_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    await interaction.update({
      embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
      components: buildGroupComponents(groupIndex),
    });
    return true;
  }

  if (prefix === RESET_CONFIRM_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    if (await rejectUnlessAllowed(interaction)) return true;

    const group = groupAt(groupIndex);
    await Promise.all(
      group.categories.map(async (categoryKey) => {
        await resetCategoryToDefaults(interaction.guildId!, categoryKey);
        if (categoryKey === "restrictions") await setBlockedTags(interaction.guildId!, []);
      }),
    );

    await interaction.update({
      embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
      components: buildGroupComponents(groupIndex),
    });
    return true;
  }

  if (prefix === DELETE_CANCEL_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    await interaction.update({
      embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
      components: buildGroupComponents(groupIndex),
    });
    return true;
  }

  if (prefix === DELETE_CONFIRM_PREFIX) {
    const groupIndex = Number.parseInt(parts[1], 10) || 0;
    if (await rejectUnlessAllowed(interaction)) return true;

    await setSingleFieldEnabled(interaction.guildId!, "general", DELETE_ORIGINAL_MESSAGE_KEY, true);

    await interaction.update({
      embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
      components: buildGroupComponents(groupIndex),
    });
    return true;
  }

  return false;
}

export async function handleSettingsPanelSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  if (interaction.customId !== SELECT_PREFIX) return false;

  const groupIndex = Number.parseInt(interaction.values[0], 10) || 0;
  await interaction.update({
    embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
    components: buildGroupComponents(groupIndex),
  });
  return true;
}

// Shared guard for the modal submit handlers and the reset/delete-confirm
// buttons above. Returns true (and replies) if the interaction should be
// rejected before doing anything else.
async function rejectUnlessAllowed(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<boolean> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
    return true;
  }

  // Re-checked here since the panel is a long-lived ephemeral message and
  // guild roles could change between opening it and submitting the modal.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: "You need the **Manage Server** permission to change bot settings.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

async function refreshPanel(interaction: ModalSubmitInteraction, groupIndex: number): Promise<void> {
  const payload = {
    embeds: [await buildGroupEmbed(interaction.guildId, groupIndex)],
    components: buildGroupComponents(groupIndex),
  };

  // The modal was opened from the Configure button on our own message, so
  // isFromMessage() narrows this to the variant that can edit it directly.
  if (interaction.isFromMessage()) {
    await interaction.update(payload);
  } else {
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  }
}

export async function handleRestrictionsModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const parts = interaction.customId.split(":");
  if (parts[0] !== RESTRICTIONS_MODAL_PREFIX) return false;

  const groupIndex = Number.parseInt(parts[1], 10) || 0;
  if (await rejectUnlessAllowed(interaction)) return true;

  const enabledWarningKeys = [...interaction.fields.getCheckboxGroup(CHECKBOX_GROUP_ID)];
  await setCategoryFields(interaction.guildId!, "restrictions", enabledWarningKeys);

  const raw = interaction.fields.getTextInputValue(BLOCKED_TAGS_INPUT_ID);
  const tags = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  await setBlockedTags(interaction.guildId!, tags);

  await refreshPanel(interaction, groupIndex);
  return true;
}

export async function handleSettingsPanelModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const parts = interaction.customId.split(":");
  if (parts[0] !== MODAL_PREFIX) return false;

  const groupIndex = Number.parseInt(parts[1], 10) || 0;
  const categoryKey = parts[2] as EmbedFieldCategory;

  if (await rejectUnlessAllowed(interaction)) return true;

  const wasDeleteOriginalMessageEnabled =
    categoryKey === "general" &&
    isFieldEnabled(await getGuildSettingsBundle(interaction.guildId), "general", DELETE_ORIGINAL_MESSAGE_KEY);

  const submittedKeys = [...interaction.fields.getCheckboxGroup(CHECKBOX_GROUP_ID)];

  // Turning this on is destructive and irreversible (deletes the user's
  // whole message, not just the link) in a way that isn't obvious from the
  // checkbox label alone, so it's gated behind an explicit confirm step
  // instead of being applied straight from the modal like every other
  // field here — left at its old (off) value until confirmed.
  const needsDeleteConfirmation =
    categoryKey === "general" &&
    !wasDeleteOriginalMessageEnabled &&
    submittedKeys.includes(DELETE_ORIGINAL_MESSAGE_KEY);

  const enabledKeys = needsDeleteConfirmation
    ? submittedKeys.filter((key) => key !== DELETE_ORIGINAL_MESSAGE_KEY)
    : submittedKeys;
  await setCategoryFields(interaction.guildId!, categoryKey, enabledKeys);

  const lengths: Record<string, number> = {};
  for (const field of EMBED_FIELD_CATEGORIES[categoryKey].fields) {
    if (!field.maxLength) continue;
    const raw = interaction.fields.getTextInputValue(`${LENGTH_PREFIX}:${field.key}`);
    lengths[field.key] = Number.parseInt(raw, 10);
  }
  await setFieldMaxLengths(interaction.guildId!, categoryKey, lengths);

  if (categoryKey === "general") {
    await setIgnoreChar(interaction.guildId!, interaction.fields.getTextInputValue(IGNORE_CHAR_INPUT_ID));
  }

  if (needsDeleteConfirmation) {
    const payload = {
      embeds: [buildDeleteOriginalMessageConfirmEmbed()],
      components: buildDeleteOriginalMessageConfirmComponents(groupIndex),
    };
    // Same isFromMessage() branching as refreshPanel — the modal was opened
    // from our own message's Configure button in the normal case.
    if (interaction.isFromMessage()) {
      await interaction.update(payload);
    } else {
      await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  } else {
    await refreshPanel(interaction, groupIndex);
  }

  return true;
}
