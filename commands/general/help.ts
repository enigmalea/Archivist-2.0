import {
  ActionRowBuilder,
  BaseInteraction,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { ClientWithCommands } from "../../bot";

const WEBSITE_URL = "https://www.archivistbot.com";
const SUPPORT_SERVER_URL = "https://discord.gg/FzhC9bVFva";
const COMMANDS_PER_PAGE = 4;

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

type HelpEntry = {
  name: string;
  description: string;
  details: string[];
};

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show command help and useful links");

function getHelpEntries(client: ClientWithCommands): HelpEntry[] {
  return Array.from(client.commands.values())
    .map((command) => (command as any).data.toJSON() as CommandJson)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((command) => ({
      name: command.name,
      description: command.description,
      details: collectSubcommandLines(command),
    }));
}

function collectSubcommandLines(command: CommandJson): string[] {
  const lines: string[] = [];

  for (const option of command.options || []) {
    if (option.type === 1) {
      lines.push(
        `• \`/${command.name} ${option.name}\` — ${option.description || "No description."}`,
      );
      continue;
    }

    if (option.type === 2) {
      for (const subcommand of option.options || []) {
        if (subcommand.type === 1) {
          lines.push(
            `• \`/${command.name} ${option.name} ${subcommand.name}\` — ${subcommand.description || "No description."}`,
          );
        }
      }
    }
  }

  return lines;
}

function getPageCount(entries: HelpEntry[]): number {
  return Math.max(1, Math.ceil(entries.length / COMMANDS_PER_PAGE));
}

function buildHelpEmbed(
  client: ClientWithCommands,
  requestedPage: number,
): { embed: EmbedBuilder; page: number; pageCount: number } {
  const entries = getHelpEntries(client);
  const pageCount = getPageCount(entries);
  const page = Math.min(Math.max(requestedPage, 0), pageCount - 1);
  const start = page * COMMANDS_PER_PAGE;
  const pageEntries = entries.slice(start, start + COMMANDS_PER_PAGE);

  const clientId = process.env.CLIENT_ID || client.user?.id || "YOUR_CLIENT_ID";
  const inviteURL = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=395137`;

  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle("Archivist Help")
    .setDescription(
      [
        `🌐 [Website](${WEBSITE_URL})`,
        `✨ [Join the Support Server](${SUPPORT_SERVER_URL})`,
        `🤖 [Add Archie to your Server](${inviteURL})`,
        "",
      ].join("\n"),
    )
    .setFooter({
      text: `Page ${page + 1}/${pageCount}`,
      iconURL: client.user?.displayAvatarURL(),
    });

  for (const entry of pageEntries) {
    embed.addFields({
      name: `/${entry.name}`,
      value:
        [entry.description, ...entry.details].filter(Boolean).join("\n") ||
        "No description available.",
    });
  }

  return { embed, page, pageCount };
}

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

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const client = interaction.client as ClientWithCommands;
  const { embed, page, pageCount } = buildHelpEmbed(client, 0);

  await interaction.reply({
    embeds: [embed],
    components: buildHelpComponents(interaction.user.id, page, pageCount),
    flags: 64,
  });
};

export const handleHelpButtonInteraction = async (
  interaction: ButtonInteraction,
) => {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "help") {
    return false;
  }

  const [, ownerId, pageText] = parts;
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content:
        "This help panel belongs to someone else. Run `/help` for your own copy.",
      flags: 64,
    });
    return true;
  }

  const page = Number.parseInt(pageText, 10) || 0;
  const client = interaction.client as ClientWithCommands;
  const { embed, page: safePage, pageCount } = buildHelpEmbed(client, page);

  await interaction.update({
    embeds: [embed],
    components: buildHelpComponents(ownerId, safePage, pageCount),
  });
  return true;
};
