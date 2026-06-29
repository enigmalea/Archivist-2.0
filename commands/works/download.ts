import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { ao3WorkError, authError } from "../../utils/errors.ts";
import { getDownloadUrls, getWorkDetailsFromUrl } from "@fujocoded/ao3.js/urls";

import { ao3Embed } from "../../utils/baseEmbed.ts";
import { cachedGetWork } from "../../utils/cache.ts";
import { constructCreators } from "../../utils/creators.ts";
import { stripIndents } from "common-tags";

export const data = new SlashCommandBuilder()
  .setName("download")
  .setDescription(
    "Provides a link so you can download a work with a specific format from AO3."
  )
  .addStringOption((option) =>
    option
      .setName("filetype")
      .setDescription("Select the file type you would like.")
      .setRequired(true)
      .addChoices(
        { name: "AZW3", value: "azw3" },
        { name: "EPUB", value: "epub" },
        { name: "HTML", value: "html" },
        { name: "MOBI", value: "mobi" },
        { name: "PDF", value: "pdf" }
      )
  )
  .addStringOption((option) =>
    option
      .setName("url")
      .setDescription("Provide the work link.")
      .setRequired(true)
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  // validate early to avoid deferring when input is invalid
  const workURL = interaction.options.getString("url", true);

  const isWorkUrl =
    workURL.includes("archiveofourown.org/works/") ||
    workURL.includes("ao3.org/works/");

  if (!isWorkUrl) {
    await interaction.reply(ao3WorkError);
    return;
  }

  await interaction.deferReply();

  const workId = getWorkDetailsFromUrl({ url: workURL }).workId;
  const work = await cachedGetWork(workId);

  if (work.locked) {
    await interaction.editReply(authError);
    return;
  }

  const title = work.title;
  const creators = constructCreators(work);

  type FileType = "azw3" | "epub" | "html" | "mobi" | "pdf";
  const file = interaction.options.getString("filetype", true) as FileType;

  const urls = getDownloadUrls(work);

  const FILE_TYPE: Record<FileType, { url?: string; icon: string }> = {
    azw3: { url: urls.azw3, icon: "<:azw3:848005536283885579>" },
    epub: { url: urls.epub, icon: "<:epub:848005536241680434>" },
    html: { url: urls.html, icon: "<:html:848005536347455498>" },
    mobi: { url: urls.mobi, icon: "<:mobi:848005536493600768>" },
    pdf: { url: urls.pdf, icon: "<:pdf:848005536552976444>" },
  };

  const downloadLink = FILE_TYPE[file]?.url;
  const fileIcon = FILE_TYPE[file]?.icon ?? "";

  if (!downloadLink) {
    await interaction.editReply({
      content: "Sorry — that format is not available for this work.",
    });
    return;
  }

  const description = stripIndents`by ${creators}

    *Click the link below to download the **${file.toUpperCase()}** file you requested.*

    ${fileIcon} [**Download**](${downloadLink})

    ☆ DON'T FORGET TO VISIT AO3 TO LEAVE KUDOS OR COMMENTS! ☆`;

  const downloadEmbed = ao3Embed()
    .setTitle(title)
    .setURL(workURL)
    .setDescription(description);

  await interaction.editReply({ embeds: [downloadEmbed] });
};