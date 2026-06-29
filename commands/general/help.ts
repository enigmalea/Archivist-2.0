import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

import type { ClientWithCommands } from "../../bot.ts";

const WEBSITE_URL = "https://www.archivistbot.com";
const SUPPORT_SERVER_URL = "https://discord.gg/FzhC9bVFva";
const CLIENT_ID = process.env.CLIENT_ID_PROD;
if (!CLIENT_ID) {
  throw new Error("Missing CLIENT_ID environment variable");
}
const INVITE_URL = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot%20applications.commands&permissions=395137`;
const COMMANDS_PER_PAGE = 4;

// Shape of a command's data once converted to JSON by discord.js.
type CommandJson = {
  name: string;
  description: string;
  options?: Array<{
    type?: number;
    name: string;
    description?: string;
    options?: Array<{
      type?: number;
      name: string;
      description?: string;
    }>;
  }>;
};

// One row in the help embed: a command name plus its description and subcommands.
type HelpEntry = {
  name: string;
  description: string;
  details: string[];
};

// Create help command.
export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show command help and useful links");

// Builds the full, sorted list of help entries from every cached command.
let cachedEntries: HelpEntry[] | null = null;

// Builds the full, sorted list of help entries from every loaded command.
// Cached after the first call since the command list doesn't change at
// runtime — unless commands get hot-reloaded, in which case call
// invalidateHelpCache() to force a rebuild on the next /help.
function getHelpEntries(client: ClientWithCommands): HelpEntry[] {
  if (cachedEntries) return cachedEntries;

  cachedEntries = Array.from(client.commands.values())
    .map((command) => (command as any).data.toJSON() as CommandJson)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((command) => ({
      name: command.name,
      description: command.description,
      details: collectSubcommandLines(command),
    }));

  return cachedEntries;
}

// Call this after hot-reloading commands so the next /help rebuilds fresh.
export function invalidateHelpCache(): void {
  cachedEntries = null;
}

// Turns a command's subcommands/subcommand groups into readable "/command sub" lines.
// option.type 1 = subcommand, option.type 2 = subcommand group (which contains its own subcommands).
function collectSubcommandLines(command: CommandJson): string[] {
  const lines: string[] = [];

  for (const option of command.options ?? []) {
    if (option.type === 1) {
      lines.push(
        `• \`/${command.name} ${option.name}\` — ${option.description ?? "No description."}`,
      );
      continue;
    }

    if (option.type === 2) {
      for (const subcommand of option.options ?? []) {
        if (subcommand.type === 1) {
          lines.push(
            `• \`/${command.name} ${option.name} ${subcommand.name}\` — ${subcommand.description ?? "No description."}`,
          );
        }
      }
    }
  }

  return lines;
}

// Always at least 1 page, even if there are no commands or very few.
function getPageCount(entries: HelpEntry[]): number {
  return Math.max(1, Math.ceil(entries.length / COMMANDS_PER_PAGE));
}

// Builds the embed for one page of the help command, plus the page numbers used to render it.
function buildHelpEmbed(
  client: ClientWithCommands,
  requestedPage: number,
): { embed: EmbedBuilder; page: number; pageCount: number } {
  const entries = getHelpEntries(client);
  const pageCount = getPageCount(entries);
	// Clamp the requested page so it can never go below 0 or past the last page.
  const page = Math.min(Math.max(requestedPage, 0), pageCount - 1);
  const start = page * COMMANDS_PER_PAGE;
  const pageEntries = entries.slice(start, start + COMMANDS_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle("Archivist Help")
    .setDescription(
      [
        `🌐 [Website](${WEBSITE_URL})`,
        `✨ [Join the Support Server](${SUPPORT_SERVER_URL})`,
        `🤖 [Add Archie to your Server](${INVITE_URL})`,
				""
      ].join("\n"),
    )
    .setFooter({
      text: `Page ${page + 1}/${pageCount}`,
      iconURL: client.user?.displayAvatarURL(),
    });

  embed.addFields(
    ...pageEntries.map((entry) => ({
      name: `/${entry.name}`,
      value:
        [entry.description, ...entry.details].filter(Boolean).join("\n") ||
        "No description available.",
    })),
  );

  return { embed, page, pageCount };
}
// Builds the "Previous"/"Next" buttons. The owner's user ID and target page are
// encoded into each button's customId (e.g. "help:123456:2") so we know who the
// panel belongs to and which page to show next, without storing any extra state.
function buildHelpComponents(ownerId: string, page: number, pageCount: number) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`help:${ownerId}:${page - 1}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`help:${ownerId}:${page + 1}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= pageCount - 1),
    ),
  ];
}

// Runs when a user types /help. Replies with page 1 of the help embed,
// visible only to them
export const execute = async (interaction: ChatInputCommandInteraction) => {
  const client = interaction.client as ClientWithCommands;
  const { embed, page, pageCount } = buildHelpEmbed(client, 0);

  await interaction.reply({
    embeds: [embed],
    components: buildHelpComponents(interaction.user.id, page, pageCount),
    ephemeral: true,
  });
};

// Runs when a "Previous"/"Next" button is clicked anywhere in the bot.
// Returns false if the click wasn't meant for this command, so the caller
// (interactionCreate.ts) knows it can keep looking for another handler.
export const handleHelpButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "help") return false;

  // Only the person who ran /help is allowed to flip through their own pages.
  const [, ownerId, pageText] = parts;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "This help panel belongs to someone else. Run `/help` for your own copy.",
      ephemeral: true,
    });
    return true;
  }

  const page = Number.parseInt(pageText, 10) || 0;
  const client = interaction.client as ClientWithCommands;
  const { embed, page: safePage, pageCount } = buildHelpEmbed(client, page);

	// Edit the existing message in place instead of sending a new reply.
  await interaction.update({
    embeds: [embed],
    components: buildHelpComponents(ownerId, safePage, pageCount),
  });

  return true;
};
