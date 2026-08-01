import {
  AutocompleteInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import {
  addRedirectRule,
  listRedirectRules,
  removeRedirectRule,
  type RedirectRule,
  type RedirectDestinationType,
  type RedirectType,
} from "../../utils/redirects.ts";

const RATING_CHOICES = [
  "Not Rated",
  "General Audiences",
  "Teen And Up Audiences",
  "Mature",
  "Explicit",
];

export const data = new SlashCommandBuilder()
  .setName("redirect")
  .setDescription(
    "Configure which channel, thread, or forum AO3 embeds get posted to.",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) =>
    subcommand
      .setName("add")
      .setDescription("Add a rule that redirects matching embeds.")
      .addChannelOption((option) =>
        option
          .setName("destination")
          .setDescription(
            "Channel, thread, or forum to send matching embeds to.",
          )
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildForum,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
          )
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("rating")
          .setDescription("Only match this AO3 rating.")
          .addChoices(
            ...RATING_CHOICES.map((rating) => ({
              name: rating,
              value: rating,
            })),
          ),
      )
      .addStringOption((option) =>
        option
          .setName("fandom")
          .setDescription("Only match works/chapters/series tagged with this fandom."),
      )
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("Only match this link type.")
          .addChoices(
            { name: "Work", value: "work" },
            { name: "Chapter", value: "chapter" },
            { name: "Series", value: "series" },
            { name: "User Profile", value: "user" },
          ),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove a redirect rule by its ID.")
      .addStringOption((option) =>
        option
          .setName("id")
          .setDescription("The rule to remove.")
          .setAutocomplete(true)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("list")
      .setDescription("List this server's redirect rules."),
  );

// Human-readable summary of what a rule matches, e.g. "rating: Explicit, fandom: ...".
function describeRuleCriteria(rule: RedirectRule): string {
  const criteria = [
    rule.rating && `rating: ${rule.rating}`,
    rule.fandom && `fandom: ${rule.fandom}`,
    rule.type && `type: ${rule.type}`,
  ]
    .filter(Boolean)
    .join(", ");

  return criteria || "matches everything";
}

export const autocomplete = async (interaction: AutocompleteInteraction) => {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.respond([]);
    return;
  }

  const focused = interaction.options.getFocused().toLowerCase();

  const rules = await listRedirectRules(guildId);
  const choices = rules
    .map((rule) => {
      const channelName = interaction.guild?.channels.cache.get(
        rule.destinationId,
      )?.name;

      const channelLabel = channelName ? `#${channelName}` : rule.destinationId;
      return {
        id: rule.id,
        label: `${rule.id} → ${channelLabel} (${describeRuleCriteria(rule)})`,
      };
    })
    .filter(
      ({ id, label }) =>
        label.toLowerCase().includes(focused) || id.includes(focused),
    )
    .slice(0, 25)
    .map(({ id, label }) => ({ name: label.slice(0, 100), value: id }));

  await interaction.respond(choices);
};

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const destination = interaction.options.getChannel("destination", true);

    let destinationType: RedirectDestinationType;
    switch (destination.type) {
      case ChannelType.GuildText:
        destinationType = "channel";
        break;
      case ChannelType.PublicThread:
      case ChannelType.PrivateThread:
        destinationType = "thread";
        break;
      case ChannelType.GuildForum:
        destinationType = "forum";
        break;
      default:
        await interaction.reply({
          content: "Unsupported destination type.",
          flags: MessageFlags.Ephemeral,
        });
        return;
    }

    const rating = interaction.options.getString("rating") ?? undefined;
    const fandom = interaction.options.getString("fandom") ?? undefined;
    const type = (interaction.options.getString("type") ?? undefined) as
      RedirectType | undefined;

    try {
      const rule = await addRedirectRule(guildId, {
        destinationId: destination.id,
        destinationType,
        rating,
        fandom,
        type,
      });

      await interaction.reply({
        content: `Added redirect rule \`${rule.id}\` → <#${rule.destinationId}>.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content:
          error instanceof Error ? error.message : "⁉️ Couldn't add that rule.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (subcommand === "remove") {
    const id = interaction.options.getString("id", true);

    try {
      const removed = await removeRedirectRule(guildId, id);
      await interaction.reply({
        content: removed
          ? `Removed redirect rule \`${id}\`.`
          : `No redirect rule found with ID \`${id}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      await interaction.reply({
        content:
          error instanceof Error ? error.message : "⁉️ Couldn't remove that rule.",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  // subcommand === "list"
  const rules = await listRedirectRules(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle("Redirect Rules")
    .setDescription(
      rules.length === 0
        ? "No redirect rules configured. Links post in the channel they're shared in."
        : rules
            .map(
              (rule) =>
                `\`${rule.id}\` → <#${rule.destinationId}> (${describeRuleCriteria(rule)})`,
            )
            .join("\n"),
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
};
